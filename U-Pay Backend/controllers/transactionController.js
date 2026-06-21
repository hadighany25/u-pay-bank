const User = require("../models/User");
const System = require("../models/System"); // 👈 ហៅ System Model មកប្រើផ្ទាល់
const bot = require("../services/telegramBot");
const PromoCode = require("../models/PromoCode"); // 👈 ហៅ PromoCode Model មកប្រើផ្ទាល់
const {
  getFormattedDate,
  generateRefId,
  generateHash,
  getDevice,
} = require("../services/helpers");
const {
  checkBillFromPayHub,
  payBillToPayHub,
  getCompanyDetails,
} = require("../services/payhubService");

const { authenticateToken } = require("../middleware/authMiddleware");
// 🔥 ទាញយកមុខងារអាន FX Rate
const { readFXRates } = require("../services/systemService");

// ១. ឆែកឈ្មោះគណនីមុនពេលវេរលុយ (បន្ថែមការបញ្ជូនតារាង Fee ទៅអោយ Frontend)
const checkAccount = async (req, res) => {
  const { accountNumber } = req.body;
  try {
    const targetUser = await User.findOne({
      $or: [
        { accountNumber: accountNumber },
        { accountNumberKHR: accountNumber },
      ],
    });

    if (targetUser) {
      const isReceiverKHR = targetUser.accountNumberKHR === accountNumber;
      const currentFXRates = readFXRates();

      // ទាញយក Fee Tiers ពី Database ផ្ទាល់ៗដើម្បីបញ្ជូនទៅ Frontend
      const sys = await System.findOne({ settingId: "GLOBAL_SETTINGS" });

      res.json({
        success: true,
        username: targetUser.fullName || targetUser.username,
        isReceiverKHR: isReceiverKHR,
        fxRates: currentFXRates,
        feeTiers: sys ? sys.feeTiers : [], // 👈 បញ្ជូនតារាងសេវាទៅអោយទូរស័ព្ទអតិថិជន
      });
    } else res.json({ success: false, message: "Account not found" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ២. មុខងារវេរលុយ (Transfer) + ប្រព័ន្ធកាត់សេវាដែលបានជួសជុលរួច
const transfer = async (req, res) => {
  const {
    senderUsername,
    receiverAccount,
    amount,
    remark,
    pin,
    trxMethod,
    currency,
  } = req.body;

  if (req.user.username !== senderUsername) {
    return res.status(403).json({
      success: false,
      message: "បម្រាមសុវត្ថិភាព៖ អ្នកមិនអាចវេរប្រាក់ចេញពីគណនីអ្នកដទៃបានទេ! 🚨",
    });
  }

  try {
    const sender = await User.findOne({ username: senderUsername });
    const receiver = await User.findOne({
      $or: [
        { accountNumber: receiverAccount },
        { accountNumberKHR: receiverAccount },
      ],
    });

    if (!sender) return res.json({ success: false, message: "Account Error" });
    if (sender.isFrozen)
      return res.json({ success: false, message: "Account Frozen" });

    // ឆែក PIN
    if (sender.pin !== pin) {
      sender.pinAttempts = (sender.pinAttempts || 0) + 1;
      if (sender.pinAttempts >= 3) {
        sender.isFrozen = true;
        sender.pinAttempts = 0;
        await sender.save();
        return res.json({
          success: false,
          message: "Wrong PIN 3 times! Account Frozen.",
        });
      }
      await sender.save();
      return res.json({
        success: false,
        message: `Wrong PIN! Attempts left: ${3 - sender.pinAttempts}`,
      });
    }
    sender.pinAttempts = 0;

    if (!receiver)
      return res.json({ success: false, message: "Receiver not found" });
    if (
      sender.accountNumber === receiverAccount ||
      sender.accountNumberKHR === receiverAccount
    )
      return res.json({ success: false, message: "Cannot transfer to self" });

    // ទាញទិន្នន័យពី Database ផ្ទាល់ៗ (ជួសជុលបញ្ហាជាប់ $10 រហូត)
    const sys = await System.findOne({ settingId: "GLOBAL_SETTINGS" });
    const transferLimit = sys ? parseFloat(sys.transferLimit) : 5000;
    const feeTiers = sys ? sys.feeTiers : [];

    const transferAmount = parseFloat(amount);
    const isSenderKHR = currency === "KHR";
    const isReceiverKHR = receiver.accountNumberKHR === receiverAccount;
    const currentFXRates = readFXRates();

    let transferUsdAmount = transferAmount;
    if (isSenderKHR) {
      transferUsdAmount = transferAmount / currentFXRates.usdToKhrSell;
    }

    // ឆែកមើល Limit ប្រចាំថ្ងៃ
    const todayStr = getFormattedDate().split(",")[0];
    let todayTotalUsd = 0;

    if (sender.transactions) {
      sender.transactions.forEach((t) => {
        if (
          t.type === "Transfer" &&
          t.amount < 0 &&
          t.date.startsWith(todayStr)
        ) {
          let pastUsdAmt = Math.abs(t.amount);
          if (t.currency === "KHR")
            pastUsdAmt = pastUsdAmt / currentFXRates.usdToKhrSell;
          todayTotalUsd += pastUsdAmt;
        }
      });
    }

    if (todayTotalUsd + transferUsdAmount > transferLimit) {
      return res.json({
        success: false,
        message: `បដិសេធ! ដែនកំណត់ប្រចាំថ្ងៃរបស់អ្នកគឺ $${transferLimit}។ ថ្ងៃនេះអ្នកវេរអស់ $${todayTotalUsd.toFixed(2)} រួចហើយ! 🛑`,
      });
    }

    // គណនាសេវាកម្ម (Force as parseFloat) ការពារ Error បូកអក្សរ
    let appliedFeeUsd = 0;
    for (let i = 0; i < feeTiers.length; i++) {
      let tMin = parseFloat(feeTiers[i].min);
      let tMax = parseFloat(feeTiers[i].max);
      let tFee = parseFloat(feeTiers[i].fee);

      if (transferUsdAmount >= tMin && transferUsdAmount <= tMax) {
        appliedFeeUsd = tFee;
        break;
      }
    }

    let appliedFee = appliedFeeUsd;
    if (isSenderKHR) {
      appliedFee = appliedFeeUsd * currentFXRates.usdToKhrSell;
    }

    // សរុបលុយដែលត្រូវកាត់ (Number រួចរាល់)
    const totalDeduction = parseFloat((transferAmount + appliedFee).toFixed(2));

    if (isSenderKHR && (sender.balanceKHR || 0) < totalDeduction) {
      return res.json({
        success: false,
        message: `សមតុល្យមិនគ្រប់គ្រាន់! វេរ: ${transferAmount}៛ + សេវា: ${appliedFee}៛`,
      });
    }
    if (!isSenderKHR && sender.balance < totalDeduction) {
      return res.json({
        success: false,
        message: `សមតុល្យមិនគ្រប់គ្រាន់! វេរ: $${transferAmount} + សេវា: $${appliedFee}`,
      });
    }

    let receiverAmount = transferAmount;
    if (!isSenderKHR && isReceiverKHR)
      receiverAmount = transferAmount * currentFXRates.usdToKhrBuy;
    else if (isSenderKHR && !isReceiverKHR)
      receiverAmount = transferAmount / currentFXRates.usdToKhrSell;

    if (isSenderKHR) sender.balanceKHR -= totalDeduction;
    else sender.balance -= totalDeduction;

    if (isReceiverKHR)
      receiver.balanceKHR = (receiver.balanceKHR || 0) + receiverAmount;
    else receiver.balance += receiverAmount;

    const date = getFormattedDate();
    const refId = generateRefId();
    const trxHash = generateHash();

    const senderTrx = {
      refId,
      hash: trxHash,
      date,
      type: "Transfer",
      amount: -totalDeduction,
      currency: isSenderKHR ? "KHR" : "USD",
      fee: appliedFee,
      senderName: sender.username,
      senderAcc: isSenderKHR ? sender.accountNumberKHR : sender.accountNumber,
      receiverName: receiver.username,
      receiverAcc: receiverAccount,
      remark: remark || "General",
      status: "Success",
      device: getDevice(req.headers["user-agent"]),
      ip: req.ip || "127.0.0.1",
      trxMethod: trxMethod || "Account Input",
    };

    const receiverTrx = {
      ...senderTrx,
      amount: receiverAmount,
      fee: 0,
      currency: isReceiverKHR ? "KHR" : "USD",
      type: "Received",
    };

    sender.transactions.unshift(senderTrx);
    receiver.transactions.unshift(receiverTrx);

    receiver.notifications.unshift({
      id: "NOTIF-" + Date.now(),
      title: "Money Received!",
      message: `You have received money from ${sender.fullName || sender.username}.`,
      date: date,
      isRead: false,
    });

    if (appliedFee > 0) {
      const feeAccount = await User.findOne({ username: "system_fee" });
      if (feeAccount) {
        if (isSenderKHR)
          feeAccount.balanceKHR = (feeAccount.balanceKHR || 0) + appliedFee;
        else feeAccount.balance += appliedFee;

        feeAccount.transactions.unshift({
          refId: "FEE-" + refId,
          hash: generateHash(),
          date,
          type: "System Income",
          amount: appliedFee,
          currency: isSenderKHR ? "KHR" : "USD",
          fee: 0,
          senderName: sender.username,
          senderAcc: isSenderKHR
            ? sender.accountNumberKHR
            : sender.accountNumber,
          receiverName: feeAccount.fullName || "U-PAY Fee",
          receiverAcc: isSenderKHR ? "999999998" : "999999999",
          remark: "Transfer Fee Revenue",
          status: "Success",
          device: "System",
          ip: "127.0.0.1",
          trxMethod: "System Auto-Deduct",
        });
        feeAccount.markModified("transactions");
        await feeAccount.save();
      }
    }

    sender.markModified("transactions");
    receiver.markModified("transactions");
    receiver.markModified("notifications");
    await sender.save();
    await receiver.save();

    res.json({
      success: true,
      newBalance: isSenderKHR ? sender.balanceKHR : sender.balance,
      slipData: senderTrx,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// ៣. បង់វិក្កយបត្រជាមួយ PayHub
const payBankBill = async (req, res) => {
  const { bill_id, company, amount, username } = req.body;

  if (req.user.username !== username) {
    return res.status(403).json({
      success: false,
      message:
        "បម្រាមសុវត្ថិភាព៖ អ្នកមិនអាចបង់វិក្កយបត្រចេញពីគណនីអ្នកដទៃបានទេ! 🚨",
    });
  }

  try {
    let payingUser = await User.findOne({ username });
    if (!payingUser)
      return res
        .status(404)
        .json({ success: false, message: "រកមិនឃើញគណនីរបស់អ្នក!" });
    if (payingUser.balance < amount)
      return res
        .status(400)
        .json({ success: false, message: "សមតុល្យមិនគ្រប់គ្រាន់!" });

    const payhubData = await payBillToPayHub(bill_id);

    if (payhubData && payhubData.success) {
      payingUser.balance -= amount;
      const newHash = generateHash();
      const currentRefId = `BP-${Date.now()}`;

      payingUser.transactions.unshift({
        refId: currentRefId,
        hash: newHash,
        date: getFormattedDate(),
        type: "Bill Payment",
        amount: -amount,
        receiverName: company,
        remark: "ទូទាត់វិក្កយបត្រ: " + bill_id,
        status: "Success",
      });
      payingUser.markModified("transactions");
      await payingUser.save();

      res.json({
        success: true,
        newBalance: payingUser.balance,
        transaction_id: currentRefId,
        hash: newHash,
      });
    } else {
      res.status(400).json({
        success: false,
        message: payhubData.message || "ការទូទាត់នៅ PayHub បរាជ័យ",
      });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ==========================================
// 🎁 ៤. មុខងាររង្វាន់ និងការបង្វិលសង (Lucky Spin Cashback)
// ==========================================
const rewardCashback = async (req, res) => {
  const { username, amount, refId } = req.body;

  if (req.user.username !== username) {
    return res
      .status(403)
      .json({ success: false, message: "បម្រាមសុវត្ថិភាព!" });
  }

  try {
    const user = await User.findOne({ username });
    const centralBank = await User.findOne({ accountNumber: "888888888" });

    if (user && centralBank) {
      const reward = parseFloat(amount);
      if (reward > 0) {
        const date = getFormattedDate();
        const newHash = generateHash();
        const newRef = "RWD-" + Date.now().toString().slice(-6);

        user.balance += reward;
        if (!user.transactions) user.transactions = [];
        user.transactions.unshift({
          refId: newRef,
          hash: newHash,
          date: date,
          type: "Cashback Reward",
          amount: reward,
          currency: "USD",
          fee: 0,
          senderName: "U-Pay Central Bank",
          receiverName: user.username,
          remark: `Lucky Spin Reward (Trx: ${refId})`,
          status: "Success",
          device: "App",
          ip: req.ip || "127.0.0.1",
        });

        centralBank.balance -= reward;
        if (!centralBank.transactions) centralBank.transactions = [];
        centralBank.transactions.unshift({
          refId: newRef,
          hash: newHash,
          date: date,
          type: "Cashback Payout",
          amount: -reward,
          currency: "USD",
          fee: 0,
          senderName: "U-Pay Central Bank",
          receiverName: user.username,
          remark: `Paid Lucky Spin to ${user.username}`,
          status: "Success",
          device: "System",
          ip: "127.0.0.1",
        });

        user.markModified("transactions");
        centralBank.markModified("transactions");

        await user.save();
        await centralBank.save();
      }
      res.json({ success: true, balance: user.balance });
    } else {
      res.json({ success: false, message: "រកមិនឃើញគណនីធនាគារកណ្តាល!" });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ==========================================
// 🚀 API សម្រាប់ឲ្យ App ផ្សេងៗហៅមកទាញលុយ (Redeem Promo API)
// ==========================================
const claimPromoCode = async (req, res) => {
  const { username, code } = req.body;

  // របាំងការពារ Security
  if (req.user.username !== username) {
    return res
      .status(403)
      .json({ success: false, message: "បម្រាមសុវត្ថិភាព API!" });
  }

  try {
    const user = await User.findOne({ username });
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "រកមិនឃើញគណនីអតិថិជន!" });

    // ១. ស្កេនរកកូដក្នុងប្រព័ន្ធ
    const promo = await PromoCode.findOne({ code: code.toUpperCase() });
    if (!promo)
      return res.json({ success: false, message: "កូដមិនត្រឹមត្រូវទេ!" });
    if (!promo.isActive)
      return res.json({
        success: false,
        message: "កូដនេះត្រូវបានបិទលែងអោយប្រើហើយ!",
      });
    if (promo.expiresAt && new Date() > promo.expiresAt)
      return res.json({ success: false, message: "កូដនេះផុតកំណត់ហើយ!" });
    if (promo.usedCount >= promo.maxUsage)
      return res.json({
        success: false,
        message: "កូដនេះត្រូវបានគេប្រើអស់ហើយ (Fully Claimed)!",
      });
    if (promo.usedBy.includes(username))
      return res.json({
        success: false,
        message: "អ្នកបានប្រើកូដនេះយកលុយរួចហើយ!",
      });

    // ២. ទាញយកលុយចេញពីធនាគារកណ្តាល មកឲ្យអតិថិជន
    const centralBank = await User.findOne({ accountNumber: "888888888" });
    if (!centralBank)
      return res.json({
        success: false,
        message: "System Error: Central Bank Not Found!",
      });

    const rewardAmt = promo.rewardValue;

    // បូកលុយ
    user.balance += rewardAmt;
    centralBank.balance -= rewardAmt;

    const date = getFormattedDate();
    const newHash = generateHash();
    const newRef = "PRM-" + Date.now().toString().slice(-6);

    // កត់ត្រាប្រវត្តិ
    user.transactions.unshift({
      refId: newRef,
      hash: newHash,
      date: date,
      type: "Promo Reward",
      amount: rewardAmt,
      currency: "USD",
      fee: 0,
      senderName: "U-Pay Promos",
      receiverName: user.username,
      remark: `Claimed Code: ${promo.code}`,
      status: "Success",
      trxMethod: "API Endpoint",
    });

    centralBank.transactions.unshift({
      refId: newRef,
      hash: newHash,
      date: date,
      type: "Promo Expense",
      amount: -rewardAmt,
      currency: "USD",
      fee: 0,
      senderName: "U-Pay Promos",
      receiverName: user.username,
      remark: `Paid Promo ${promo.code} to ${user.username}`,
      status: "Success",
      trxMethod: "API Endpoint",
    });

    // កត់ឈ្មោះអ្នកដែលបានយកលុយរួច
    promo.usedCount += 1;
    promo.usedBy.push(username);

    user.markModified("transactions");
    centralBank.markModified("transactions");

    await promo.save();
    await user.save();
    await centralBank.save();

    res.json({
      success: true,
      message: `អបអរសាទរ! អ្នកទទួលបាន $${rewardAmt.toFixed(2)} ពីកូដ ${promo.code}!`,
      newBalance: user.balance,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

module.exports = {
  checkAccount,
  transfer,
  payBankBill,
  rewardCashback,
  claimPromoCode,
};
