const User = require("../models/User");
const bot = require("../services/telegramBot");
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

// 🔥 ទាញយកមុខងារអាន FX Rate ពិតប្រាកដពី MongoDB (ជំនួសអោយការកំណត់ចោល)
const { readFXRates } = require("../services/systemService");

// ១. ឆែកឈ្មោះគណនីមុនពេលវេរលុយ
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
      const currentFXRates = readFXRates(); // ទាញ Rate ថ្មីបំផុតពី Admin

      res.json({
        success: true,
        username: targetUser.fullName || targetUser.username,
        isReceiverKHR: isReceiverKHR,
        fxRates: currentFXRates,
      });
    } else res.json({ success: false, message: "Account not found" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ២. មុខងារវេរលុយ (Transfer)
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

  // របាំងការពារទី១៖ ការពារការលួចបន្លំគណនីវេរលុយ (Anti-Fraud)
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

    // ឆែក PIN កូដ
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
    sender.pinAttempts = 0; // Reset វិញបើវាយត្រូវ

    if (!receiver)
      return res.json({ success: false, message: "Receiver not found" });

    // ការគិតលុយ និងអត្រាប្តូរប្រាក់
    const transferAmount = parseFloat(amount);
    const isSenderKHR = currency === "KHR";
    const isReceiverKHR = receiver.accountNumberKHR === receiverAccount;

    if (isSenderKHR && (sender.balanceKHR || 0) < transferAmount)
      return res.json({ success: false, message: "Insufficient KHR Balance" });
    if (!isSenderKHR && sender.balance < transferAmount)
      return res.json({ success: false, message: "Insufficient USD Balance" });

    if (
      sender.accountNumber === receiverAccount ||
      sender.accountNumberKHR === receiverAccount
    )
      return res.json({ success: false, message: "Cannot transfer to self" });

    // ប្រើប្រាស់អត្រាប្តូរប្រាក់ពិតប្រាកដដែល Admin ទើបកំណត់
    const currentFXRates = readFXRates();
    let receiverAmount = transferAmount;

    if (!isSenderKHR && isReceiverKHR)
      receiverAmount = transferAmount * currentFXRates.usdToKhrBuy;
    else if (isSenderKHR && !isReceiverKHR)
      receiverAmount = transferAmount / currentFXRates.usdToKhrSell;

    // កាត់លុយ
    if (isSenderKHR) sender.balanceKHR -= transferAmount;
    else sender.balance -= transferAmount;

    // បញ្ចូលលុយ
    if (isReceiverKHR)
      receiver.balanceKHR = (receiver.balanceKHR || 0) + receiverAmount;
    else receiver.balance += receiverAmount;

    // បង្កើតប្រវត្តិប្រតិបត្តិការ
    const date = getFormattedDate();
    const refId = generateRefId();
    const trxHash = generateHash();

    const senderTrx = {
      refId,
      hash: trxHash,
      date,
      type: "Transfer",
      amount: -transferAmount,
      currency: isSenderKHR ? "KHR" : "USD",
      fee: 0.0,
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
      currency: isReceiverKHR ? "KHR" : "USD",
      type: "Received",
    };

    sender.transactions.unshift(senderTrx);
    receiver.transactions.unshift(receiverTrx);

    // ជូនដំណឹងទៅអ្នកទទួល
    receiver.notifications.unshift({
      id: "NOTIF-" + Date.now(),
      title: "Money Received!",
      message: `You have received money from ${sender.fullName || sender.username}.`,
      date: date,
      isRead: false,
    });

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
    res
      .status(500)
      .json({ success: false, message: "Server មានបញ្ហាក្នុងការផ្ទេរប្រាក់" });
  }
};

// ៣. បង់វិក្កយបត្រជាមួយ PayHub
const payBankBill = async (req, res) => {
  const { bill_id, company, amount, username } = req.body;

  // របាំងការពារទី២៖ ការពារការលួចបន្លំគណនីបង់វិក្កយបត្រ
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

    // ហៅ Service របស់ PayHub
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

  // របាំងការពារ Security: ត្រូវប្រាកដថា Token ជារបស់អ្នកដែលត្រូវទទួលរង្វាន់មែន
  if (req.user.username !== username) {
    return res
      .status(403)
      .json({ success: false, message: "បម្រាមសុវត្ថិភាព!" });
  }

  try {
    const user = await User.findOne({ username });
    // ទាញយកគណនីធនាគារកណ្តាល (សន្មត់ថាមានលេខគណនី 888888888)
    const centralBank = await User.findOne({ accountNumber: "888888888" });

    if (user && centralBank) {
      const reward = parseFloat(amount);
      if (reward > 0) {
        const date = getFormattedDate();
        const newHash = generateHash();
        const newRef = "RWD-" + Date.now().toString().slice(-6);

        // ១. បញ្ចូលលុយទៅអោយ User ធម្មតា
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

        // ២. កាត់លុយចេញពី U-Pay Central Bank
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

// បន្ថែម `rewardCashback` ចូលទៅក្នុង module.exports
module.exports = { checkAccount, transfer, payBankBill, rewardCashback };
