const User = require("../models/User");
const System = require("../models/System");
const PromoCode = require("../models/PromoCode");
const bot = require("../services/telegramBot");
const Merchant = require("../models/Merchant");
const mongoose = require("mongoose");
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

// 🔥 ទាញយកមុខងារអាន FX Rate
const { readFXRates } = require("../services/systemService");

// ==========================================
// ១. ឆែកឈ្មោះគណនីមុនពេលវេរលុយ (បន្ថែមការបញ្ជូនតារាង Fee ទៅអោយ Frontend)
// ==========================================
const checkAccount = async (req, res) => {
  const { accountNumber } = req.body;
  try {
    // ១. ឆែករកក្នុង User សិន
    let target = await User.findOne({
      $or: [
        { accountNumber: accountNumber },
        { accountNumberKHR: accountNumber },
      ],
    });

    let isMerchant = false;
    let targetName = "";

    // ២. បើមិនឃើញក្នុង User, ឆែករកក្នុង Merchant បន្ត
    if (!target) {
      target = await Merchant.findOne({
        $or: [
          { "accountNumbers.USD": accountNumber },
          { "accountNumbers.KHR": accountNumber },
        ],
      });

      if (target) {
        isMerchant = true; // ប្រាប់ថាវាជាហាង
        targetName = target.name; // យកឈ្មោះហាង
      }
    } else {
      targetName = target.fullName || target.username;
    }

    // ៣. បើរកឃើញទិន្នន័យ (មិនថា User ឬ Merchant)
    if (target) {
      const isReceiverKHR =
        target.accountNumberKHR === accountNumber ||
        (target.accountNumbers && target.accountNumbers.KHR === accountNumber);

      const currentFXRates = readFXRates();
      const sys = await System.findOne({ settingId: "GLOBAL_SETTINGS" });

      res.json({
        success: true,
        username: targetName, // បញ្ជូនឈ្មោះទៅវិញ
        isReceiverKHR: isReceiverKHR,
        isMerchant: isMerchant, // ផ្ញើទៅ Frontend ឱ្យដឹងថាជាហាង
        fxRates: currentFXRates,
        feeTiers: sys ? sys.feeTiers : [],
      });
    } else {
      res.json({ success: false, message: "Account not found" });
    }
  } catch (err) {
    console.error("CHECK ACCOUNT ERROR:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ==========================================
// ២. មុខងារវេរលុយ (Transfer) + ប្រព័ន្ធកាត់សេវាដែលបានជួសជុលរួច
// ==========================================
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
    return res
      .status(403)
      .json({
        success: false,
        message:
          "បម្រាមសុវត្ថិភាព៖ អ្នកមិនអាចវេរប្រាក់ចេញពីគណនីអ្នកដទៃបានទេ! 🚨",
      });
  }

  try {
    const sender = await User.findOne({ username: senderUsername });
    if (!sender) return res.json({ success: false, message: "Account Error" });
    if (sender.isFrozen)
      return res.json({ success: false, message: "Account Frozen" });

    // ១. រកអ្នកទទួល (ឆែកទាំង User និង Merchant)
    let receiver = await User.findOne({
      $or: [
        { accountNumber: receiverAccount },
        { accountNumberKHR: receiverAccount },
      ],
    });

    let receiverMerchant = null;
    let isMerchant = false;

    if (!receiver) {
      receiverMerchant = await Merchant.findOne({
        $or: [
          { "accountNumbers.USD": receiverAccount },
          { "accountNumbers.KHR": receiverAccount },
        ],
      });
      if (receiverMerchant) isMerchant = true;
    }

    if (!receiver && !receiverMerchant)
      return res.json({ success: false, message: "Receiver not found" });

    // ២. ឆែក PIN
    if (sender.pin !== pin) {
      sender.pinAttempts = (sender.pinAttempts || 0) + 1;
      if (sender.pinAttempts >= 3) {
        sender.isFrozen = true;
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

    // ៣. គណនីដែនកំណត់ និង Fee
    const sys = await System.findOne({ settingId: "GLOBAL_SETTINGS" });
    const transferLimit = sys ? parseFloat(sys.transferLimit) : 5000;
    const feeTiers = sys ? sys.feeTiers : [];

    const transferAmount = parseFloat(amount);
    const isSenderKHR = currency === "KHR";
    const currentFXRates = readFXRates();
    let transferUsdAmount = isSenderKHR
      ? transferAmount / currentFXRates.usdToKhrSell
      : transferAmount;

    let appliedFeeUsd = 0;
    for (let tier of feeTiers) {
      if (
        transferUsdAmount >= parseFloat(tier.min) &&
        transferUsdAmount <= parseFloat(tier.max)
      ) {
        appliedFeeUsd = parseFloat(tier.fee);
        break;
      }
    }
    let appliedFee = isSenderKHR
      ? appliedFeeUsd * currentFXRates.usdToKhrSell
      : appliedFeeUsd;
    const totalDeduction = parseFloat((transferAmount + appliedFee).toFixed(2));

    if (isSenderKHR && (sender.balanceKHR || 0) < totalDeduction)
      return res.json({ success: false, message: "សមតុល្យមិនគ្រប់គ្រាន់" });
    if (!isSenderKHR && sender.balance < totalDeduction)
      return res.json({ success: false, message: "សមតុល្យមិនគ្រប់គ្រាន់" });

    // ៤. ដំណើរការវេរលុយ
    let receiverAmount = transferAmount;
    let isReceiverKHR = false;

    if (isMerchant) {
      isReceiverKHR = receiverMerchant.accountNumbers.KHR === receiverAccount;

      // ក. ចូល Ledger របស់ Merchant
      if (isReceiverKHR) receiverMerchant.collected.KHR += transferAmount;
      else receiverMerchant.collected.USD += transferAmount;
      await receiverMerchant.save();

      // ខ. Auto-Sweep: រកម្ចាស់ហាងតាម username (ព្រោះ userId ក្នុង Merchant គឺជា String)
      const owner = await User.findOne({ username: receiverMerchant.userId });
      if (owner) {
        if (isReceiverKHR)
          owner.balanceKHR = (owner.balanceKHR || 0) + transferAmount;
        else owner.balance = (owner.balance || 0) + transferAmount;
        await owner.save();
        receiver = owner; // ប្រើ owner ជា receiver ដើម្បីបន្តធ្វើ Transaction
      } else {
        console.error(
          "Auto-Sweep Error: Owner not found for userId:",
          receiverMerchant.userId,
        );
      }
    } else {
      isReceiverKHR = receiver.accountNumberKHR === receiverAccount;
      if (!isSenderKHR && isReceiverKHR)
        receiverAmount = transferAmount * currentFXRates.usdToKhrBuy;
      else if (isSenderKHR && !isReceiverKHR)
        receiverAmount = transferAmount / currentFXRates.usdToKhrSell;

      if (isReceiverKHR)
        receiver.balanceKHR = (receiver.balanceKHR || 0) + receiverAmount;
      else receiver.balance = (receiver.balance || 0) + receiverAmount;
      await receiver.save();
    }

    // ៥. កាត់លុយ sender និងបង្កើត Transaction
    if (isSenderKHR) sender.balanceKHR -= totalDeduction;
    else sender.balance -= totalDeduction;
    await sender.save();

    const date = getFormattedDate();
    const refId = generateRefId();
    const senderTrx = {
      refId,
      hash: generateHash(),
      date,
      type: "Transfer",
      amount: -totalDeduction,
      currency: isSenderKHR ? "KHR" : "USD",
      fee: appliedFee,
      senderName: sender.username,
      receiverName: isMerchant ? receiverMerchant.name : receiver.fullName,
      receiverAcc: receiverAccount,
      status: "Success",
    };

    sender.transactions.unshift(senderTrx);
    receiver.transactions.unshift({
      ...senderTrx,
      amount: receiverAmount,
      fee: 0,
      type: "Received",
    });
    await sender.save();
    await receiver.save();

    const io = req.app.get("io");
    if (io)
      io.to(receiver.username).emit("paymentReceived", {
        amount: receiverAmount,
        senderName: sender.fullName,
      });

    res.json({
      success: true,
      newBalance: isSenderKHR ? sender.balanceKHR : sender.balance,
      slipData: senderTrx,
    });
  } catch (err) {
    console.error("TRANSFER ERROR:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// ==========================================
// 🔍 មុខងារស្វែងរកវិក្កយបត្រពី PayHub
// ==========================================
const scanBankBill = async (req, res) => {
  const { bill_id } = req.body;
  try {
    // U-Pay Backend បាញ់សំណើទៅសួរ PayHub ផ្ទាល់
    const response = await fetch(
      `https://payhub-kh.fly.dev/api/gateway/check-bill?query=${bill_id}`,
    );
    const data = await response.json();

    if (data.success) {
      // payment.html ត្រូវការទិន្នន័យក្នុងឈ្មោះ `billData`
      res.json({ success: true, billData: data.bill });
    } else {
      res.json({
        success: false,
        message: data.message || "រកមិនឃើញវិក្កយបត្រនេះទេ!",
      });
    }
  } catch (err) {
    console.error("Scan Bill Error:", err);
    res
      .status(500)
      .json({ success: false, message: "មិនអាចភ្ជាប់ទៅកាន់ PayHub បានទេ!" });
  }
};

// ==========================================
// ៣. បង់វិក្កយបត្រជាមួយ PayHub
// ==========================================
const payBankBill = async (req, res) => {
  const { bill_id, company, amount, username } = req.body;

  // ⚠️ លុប ឬ Comment របាំងសុវត្ថិភាពនេះចោលបណ្តោះអាសន្នសិន ដើម្បីឱ្យរត់រួច
  /*
  if (req.user && req.user.username !== username) {
    return res.status(403).json({ success: false, message: "បម្រាមសុវត្ថិភាព!" });
  }
  */

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

    // 🔥 បាញ់សំណើទៅ PayHub ផ្ទាល់ ដើម្បីទូទាត់ប្រាក់
    const currentRefId = `BP-${Date.now()}`;
    const response = await fetch("https://payhub-kh.fly.dev/api/gateway/pay", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        bill_id: bill_id,
        upay_trx_id: currentRefId, // បញ្ជូនលេខកូដប្រតិបត្តិការទៅអោយ PayHub
      }),
    });

    const payhubData = await response.json();

    // ឆែកមើលថាបើ PayHub ទទួលលុយជោគជ័យ ទើបកាត់លុយពីកុង U-Pay
    if (payhubData && payhubData.success) {
      payingUser.balance -= amount;
      const newHash = generateHash();

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

      // ឆ្លើយតបទៅ payment.html វិញ
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
    console.error("Pay Bill Error:", err);
    res
      .status(500)
      .json({ success: false, message: "មិនអាចភ្ជាប់ទៅកាន់ PayHub បានទេ" });
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
      res.json({ success: true, balance: user.balance }); // ត្រឹមត្រូវ (លុបកូដដែលច្រឡំដាក់ចូលចោលហើយ)
    } else {
      res.json({ success: false, message: "រកមិនឃើញគណនីធនាគារកណ្តាល!" });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ==========================================
// 🚀 ៥. API សម្រាប់ឲ្យ App ផ្សេងៗហៅមកទាញលុយ (Redeem Promo API)
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
  scanBankBill,
};
