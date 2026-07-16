const User = require("../models/User");
const System = require("../models/System");
const PromoCode = require("../models/PromoCode");
const bot = require("../services/telegramBot");
const Merchant = require("../models/Merchant");
const mongoose = require("mongoose");
const Transaction = require("../models/Transaction");

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
const { readFXRates } = require("../services/systemService");

// ==========================================
// ១. ឆែកឈ្មោះគណនីមុនពេលវេរលុយ (ស្គាល់ Sub-Accounts)
// ==========================================
const checkAccount = async (req, res) => {
  const { accountNumber } = req.body;
  try {
    // ឆែករកក្នុង User ទាំង Main Account និង Sub-Accounts
    let target = await User.findOne({
      $or: [
        { accountNumber: accountNumber },
        { accountNumberKHR: accountNumber },
        { "subAccounts.accountNumber": accountNumber }, // 🔥 ស្គាល់លេខគណនីពិសេស (Sub-Accounts)
      ],
    });

    let isMerchant = false;
    let targetName = "";
    let isReceiverKHR = false;

    // បើមិនឃើញក្នុង User, ឆែករកក្នុង Merchant
    if (!target) {
      target = await Merchant.findOne({
        $or: [
          { "accountNumbers.USD": accountNumber },
          { "accountNumbers.KHR": accountNumber },
        ],
      });

      if (target) {
        isMerchant = true;
        targetName = target.name;
        isReceiverKHR = target.accountNumbers.KHR === accountNumber;
      }
    } else {
      targetName = target.fullName || target.username;

      // ឆែកថាតើលេខដែលវាយបញ្ចូលនោះ ជារបស់កុងរៀល ឬកុងដុល្លារ?
      if (target.accountNumberKHR === accountNumber) {
        isReceiverKHR = true;
      } else {
        // បើជារបស់ Sub-Account ត្រូវឆែកមើល Currency របស់វា
        const subAcc = target.subAccounts.find(
          (acc) => acc.accountNumber === accountNumber,
        );
        if (subAcc && subAcc.currency === "KHR") {
          isReceiverKHR = true;
          targetName = targetName + " (" + subAcc.accountName + ")"; // បង្ហាញឈ្មោះហោប៉ៅបន្ថែម (Option)
        }
      }
    }

    if (target) {
      const currentFXRates = readFXRates();
      const sys = await System.findOne({ settingId: "GLOBAL_SETTINGS" });

      res.json({
        success: true,
        username: targetName,
        isReceiverKHR: isReceiverKHR,
        isMerchant: isMerchant,
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
// ២. មុខងារវេរលុយ (Transfer) - គាំទ្រគណនីពិសេស (Sub-Accounts)
// ==========================================
const transfer = async (req, res) => {
  const {
    senderUsername,
    senderAccount, // 🔥 ទទួលលេខកុងដែលគេរើសពី Dropdown
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
      .json({ success: false, message: "បម្រាមសុវត្ថិភាព! 🚨" });
  }

  try {
    const sender = await User.findOne({ username: senderUsername });
    if (!sender) return res.json({ success: false, message: "Account Error" });
    if (sender.isFrozen)
      return res.json({ success: false, message: "Account Frozen" });

    // ១. រកអ្នកទទួល (ឆែកទាំង Main និង Sub-Accounts)
    let receiver = await User.findOne({
      $or: [
        { accountNumber: receiverAccount },
        { accountNumberKHR: receiverAccount },
        { "subAccounts.accountNumber": receiverAccount },
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

    // ៣. គណនា Fee និងដែនកំណត់
    const sys = await System.findOne({ settingId: "GLOBAL_SETTINGS" });
    const transferAmount = parseFloat(amount);
    const isSenderKHR = currency === "KHR";
    const currentFXRates = readFXRates();

    let transferUsdAmount = isSenderKHR
      ? transferAmount / currentFXRates.usdToKhrSell
      : transferAmount;

    let appliedFeeUsd = 0;
    const feeTiers = sys ? sys.feeTiers : [];
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

    // 🔥 ៤. កំណត់ថាតើគាត់វេរចេញពីកុង Main ឬ កុង Sub? (Sender Side)
    let isSenderSubAccount = false;
    let senderSubIndex = -1;

    if (
      senderAccount &&
      senderAccount !== "MAIN_USD" &&
      senderAccount !== "MAIN_KHR"
    ) {
      senderSubIndex = sender.subAccounts.findIndex(
        (acc) => acc.accountNumber === senderAccount,
      );
      if (senderSubIndex !== -1) {
        isSenderSubAccount = true;
      }
    }

    let senderAvailableBal = 0;
    if (isSenderSubAccount) {
      senderAvailableBal = sender.subAccounts[senderSubIndex].balance;
    } else {
      senderAvailableBal = isSenderKHR
        ? sender.balanceKHR || 0
        : sender.balance || 0;
    }

    // ឆែកសមតុល្យតាមគណនីជាក់លាក់
    if (senderAvailableBal < totalDeduction)
      return res.json({ success: false, message: "សមតុល្យមិនគ្រប់គ្រាន់" });

    // ៥. ដំណើរការវេរលុយចូល (Receiver side)
    let receiverAmount = transferAmount;
    let isReceiverKHR = false;

    if (isMerchant) {
      isReceiverKHR = receiverMerchant.accountNumbers.KHR === receiverAccount;
      if (!isSenderKHR && isReceiverKHR)
        receiverAmount = transferAmount * currentFXRates.usdToKhrBuy;
      else if (isSenderKHR && !isReceiverKHR)
        receiverAmount = transferAmount / currentFXRates.usdToKhrSell;

      if (isReceiverKHR) receiverMerchant.collected.KHR += receiverAmount;
      else receiverMerchant.collected.USD += receiverAmount;
      await receiverMerchant.save();

      const owner = await User.findOne({
        $or: [
          { username: receiverMerchant.userId },
          { accountNumber: receiverMerchant.userId },
          { accountNumberKHR: receiverMerchant.userId },
        ],
      });

      if (owner) {
        if (isReceiverKHR)
          owner.balanceKHR = (owner.balanceKHR || 0) + receiverAmount;
        else owner.balance = (owner.balance || 0) + receiverAmount;
        await owner.save();
        receiver = owner;
      } else {
        return res.json({
          success: false,
          message: "ប្រព័ន្ធមានបញ្ហា៖ រកគណនីម្ចាស់ហាងមិនឃើញ",
        });
      }
    } else {
      let isReceiverSubAccount = false;
      let targetSubAccIndex = -1;

      if (receiver.accountNumberKHR === receiverAccount) {
        isReceiverKHR = true;
      } else if (receiver.accountNumber !== receiverAccount) {
        targetSubAccIndex = receiver.subAccounts.findIndex(
          (acc) => acc.accountNumber === receiverAccount,
        );
        if (targetSubAccIndex !== -1) {
          isReceiverSubAccount = true;
          isReceiverKHR =
            receiver.subAccounts[targetSubAccIndex].currency === "KHR";
        }
      }

      if (!isSenderKHR && isReceiverKHR)
        receiverAmount = transferAmount * currentFXRates.usdToKhrBuy;
      else if (isSenderKHR && !isReceiverKHR)
        receiverAmount = transferAmount / currentFXRates.usdToKhrSell;

      if (isReceiverSubAccount) {
        receiver.subAccounts[targetSubAccIndex].balance += receiverAmount;
      } else {
        if (isReceiverKHR)
          receiver.balanceKHR = (receiver.balanceKHR || 0) + receiverAmount;
        else receiver.balance = (receiver.balance || 0) + receiverAmount;
      }

      const currencySymbol = isReceiverKHR ? "៛" : "$";
      const transferNotification = {
        title: "ទទួលបានទឹកប្រាក់! 💸",
        message: `អ្នកទទួលបាន ${currencySymbol}${receiverAmount.toLocaleString()} ពី ${sender.fullName || sender.username}។`,
        type: "transfer_receive",
        date: new Date().toLocaleString("en-US", {
          timeZone: "Asia/Phnom_Penh",
          hour12: true,
        }),
        isRead: false,
      };
      if (!receiver.notifications) receiver.notifications = [];
      receiver.notifications.push(transferNotification);

      await receiver.save();
    }

    // 🔥 ៦. កាត់លុយពីអ្នកផ្ញើចំកុងដែលបានរើស
    if (isSenderSubAccount) {
      sender.subAccounts[senderSubIndex].balance -= totalDeduction;
    } else {
      if (isSenderKHR) sender.balanceKHR -= totalDeduction;
      else sender.balance -= totalDeduction;
    }

    const date = new Date().toLocaleString("en-US", {
      timeZone: "Asia/Phnom_Penh",
      hour12: true,
    });
    const refId = generateRefId();
    const currentMethod = isMerchant
      ? "Merchant Payment"
      : trxMethod || "Account Transfer";

    // ថែម senderAcc ចូលក្នុង Transaction
    const actualSenderAccNum = isSenderSubAccount
      ? senderAccount
      : isSenderKHR
        ? sender.accountNumberKHR
        : sender.accountNumber;

    const senderTrx = {
      refId,
      hash: generateHash(),
      date,
      type: "Transfer",
      amount: -totalDeduction,
      currency: isSenderKHR ? "KHR" : "USD",
      fee: appliedFee,
      senderName: sender.fullName || sender.username,
      receiverName: isMerchant
        ? receiverMerchant.name
        : receiver.fullName || receiver.username,
      receiverAcc: receiverAccount,
      senderAcc: actualSenderAccNum,
      trxMethod: currentMethod,
      remark: remark || "General",
      status: "Success",
      username: sender.username,
    };

    const receiverTrx = {
      refId,
      hash: generateHash(),
      date,
      type: "Receive",
      amount: receiverAmount,
      currency: isReceiverKHR ? "KHR" : "USD",
      fee: 0,
      senderName: sender.fullName || sender.username,
      receiverName: isMerchant
        ? receiverMerchant.name
        : receiver.fullName || receiver.username,
      receiverAcc: receiverAccount,
      senderAcc: actualSenderAccNum,
      trxMethod: currentMethod,
      remark: isMerchant
        ? `Payment via ${receiverMerchant.name}`
        : remark || "General",
      status: "Success",
      username: receiver.username,
    };

    await Transaction.create(senderTrx);
    await Transaction.create(receiverTrx);
    await sender.save();

    const io = req.app.get("io");
    if (io)
      io.to(receiver.username).emit("paymentReceived", {
        amount: receiverAmount,
        senderName: sender.fullName || sender.username,
      });

    // 🔥 បញ្ជូនទឹកប្រាក់ដែលនៅសល់ទៅកាន់ Frontend វិញឱ្យចំកុង
    res.json({
      success: true,
      newBalance: isSenderSubAccount
        ? sender.subAccounts[senderSubIndex].balance
        : isSenderKHR
          ? sender.balanceKHR
          : sender.balance,
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

      // 👈 បញ្ជូនទិន្នន័យចូល Collection ថ្មី (Transaction) ត្រង់ៗ
      await Transaction.create({
        username: payingUser.username,
        refId: currentRefId,
        hash: newHash,
        date: new Date().toLocaleString("en-US", {
          timeZone: "Asia/Phnom_Penh",
          hour12: true,
        }),
        type: "Bill Payment",
        amount: -amount,
        receiverName: company,
        remark: "ទូទាត់វិក្កយបត្រ: " + bill_id,
        status: "Success",
      });

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
        const date = new Date().toLocaleString("en-US", {
          timeZone: "Asia/Phnom_Penh",
          hour12: true,
        });
        const newHash = generateHash();
        const newRef = "RWD-" + Date.now().toString().slice(-6);

        user.balance += reward;
        centralBank.balance -= reward;

        // 👈 បញ្ជូនទិន្នន័យចូល Collection ថ្មី (Transaction) ត្រង់ៗ
        await Transaction.create({
          username: user.username,
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

        await Transaction.create({
          username: centralBank.username,
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

    const date = new Date().toLocaleString("en-US", {
      timeZone: "Asia/Phnom_Penh",
      hour12: true,
    });
    const newHash = generateHash();
    const newRef = "PRM-" + Date.now().toString().slice(-6);

    // 👈 បញ្ជូនទិន្នន័យចូល Collection ថ្មី (Transaction) ត្រង់ៗ
    await Transaction.create({
      username: user.username,
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

    await Transaction.create({
      username: centralBank.username,
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

// ==========================================
// 6. Egift / Scan Bank Bill API (សម្រាប់ App ផ្សេងៗហៅមកទាញលុយ)
// ==========================================

// មុខងារសម្រាប់ផ្ញើ E-Gift (អាំងប៉ាវ) គាំទ្រគណនីពិសេស និងខ្វែងរូបិយប័ណ្ណ
const sendEgift = async (req, res) => {
  // ទទួលទិន្នន័យពី Frontend
  const {
    senderUsername,
    senderAccount, // លេខគណនីប្រភព (MAIN_USD, MAIN_KHR ឬ លេខ Sub-Account)
    receiverInput, // លេខទូរស័ព្ទ, ឈ្មោះ ឬ លេខគណនីអ្នកទទួល
    amount, // ចំនួនទឹកប្រាក់កាដូ
    currency, // រូបិយប័ណ្ណកាដូ (USD ឬ KHR)
    theme,
    message,
    pin,
  } = req.body;

  try {
    const User = require("../models/User");
    const Transaction = require("../models/Transaction"); // ហៅ Transaction Model

    // 💡 កំណត់អត្រាប្តូរប្រាក់ (ប្រើអថេរ Global របស់បង ឬកំណត់តម្លៃ Default ត្រង់នេះ)
    const fxRates = { usdToKhrBuy: 4050, usdToKhrSell: 4100 };
    const giftAmount = parseFloat(amount);

    // ១. ផ្ទៀងផ្ទាត់អ្នកផ្ញើ និងលេខកូដ PIN
    const sender = await User.findOne({ username: senderUsername });
    if (!sender)
      return res.json({ success: false, message: "រកមិនឃើញគណនីរបស់អ្នកទេ" });
    if (sender.pin !== pin)
      return res.json({
        success: false,
        message: "លេខកូដ PIN មិនត្រឹមត្រូវទេ!",
      });

    // ២. គណនាទឹកប្រាក់ត្រូវកាត់ និងកាត់ចេញពីគណនីអ្នកផ្ញើ
    let finalDeduction = giftAmount;
    let sourceCurrency = "USD";
    let actualSenderAccNum = sender.accountNumber; // កំណត់ Default

    if (senderAccount === "MAIN_KHR") {
      sourceCurrency = "KHR";
      actualSenderAccNum = sender.accountNumberKHR;
    } else if (senderAccount !== "MAIN_USD") {
      const sub = sender.subAccounts.find(
        (a) => a.accountNumber === senderAccount,
      );
      if (!sub)
        return res.json({
          success: false,
          message: "គណនីប្រភពមិនត្រឹមត្រូវទេ",
        });
      sourceCurrency = sub.currency;
      actualSenderAccNum = sub.accountNumber;
    }

    // គណនាអត្រាប្តូរប្រាក់ប្រសិនបើគណនីប្រភព និងរូបិយប័ណ្ណកាដូខុសគ្នា
    if (sourceCurrency !== currency) {
      if (sourceCurrency === "USD" && currency === "KHR")
        finalDeduction = giftAmount / fxRates.usdToKhrSell;
      if (sourceCurrency === "KHR" && currency === "USD")
        finalDeduction = giftAmount * fxRates.usdToKhrBuy;
    }

    // កាត់ប្រាក់ពីគណនីជាក់លាក់
    if (senderAccount === "MAIN_USD") {
      if (sender.balance < finalDeduction)
        return res.json({
          success: false,
          message: "សមតុល្យប្រាក់ដុល្លារមិនគ្រប់គ្រាន់ទេ",
        });
      sender.balance -= finalDeduction;
    } else if (senderAccount === "MAIN_KHR") {
      if ((sender.balanceKHR || 0) < finalDeduction)
        return res.json({
          success: false,
          message: "សមតុល្យប្រាក់រៀលមិនគ្រប់គ្រាន់ទេ",
        });
      sender.balanceKHR -= finalDeduction;
    } else {
      const subIdx = sender.subAccounts.findIndex(
        (a) => a.accountNumber === senderAccount,
      );
      if (sender.subAccounts[subIdx].balance < finalDeduction)
        return res.json({
          success: false,
          message: "សមតុល្យគណនីនេះមិនគ្រប់គ្រាន់ទេ",
        });
      sender.subAccounts[subIdx].balance -= finalDeduction;
    }

    // ៣. ស្វែងរកអ្នកទទួល (តាមរយៈលេខទូរស័ព្ទ, Username, ឬលេខគណនី Main/Sub)
    const receiver = await User.findOne({
      $or: [
        { username: receiverInput },
        { phone: receiverInput },
        { accountNumber: receiverInput },
        { accountNumberKHR: receiverInput },
        { "subAccounts.accountNumber": receiverInput },
      ],
    });

    if (!receiver)
      return res.json({ success: false, message: "រកមិនឃើញគណនីអ្នកទទួលទេ!" });
    if (sender.username === receiver.username)
      return res.json({
        success: false,
        message: "មិនអាចផ្ញើអាំងប៉ាវឱ្យខ្លួនឯងបានទេ!",
      });

    // ៤. ដំណើរការបញ្ចូលប្រាក់ទៅឱ្យអ្នកទទួល
    let isReceiverSubAccount = false;
    let receiverSubIndex = receiver.subAccounts.findIndex(
      (acc) => acc.accountNumber === receiverInput,
    );
    let actualReceiverAccNum = receiver.accountNumber; // Default Main USD

    if (receiverSubIndex !== -1) {
      // បើគេផ្ញើចូលកុង Sub-Account ផ្ទាល់
      isReceiverSubAccount = true;
      actualReceiverAccNum = receiverInput;
      let targetCur = receiver.subAccounts[receiverSubIndex].currency;
      let receiveAmt = giftAmount;

      // ប្តូរប្រាក់បើកាដូ និងកុងទទួលខុសរូបិយប័ណ្ណគ្នា
      if (currency === "USD" && targetCur === "KHR")
        receiveAmt = receiveAmt * fxRates.usdToKhrBuy;
      if (currency === "KHR" && targetCur === "USD")
        receiveAmt = receiveAmt / fxRates.usdToKhrSell;

      receiver.subAccounts[receiverSubIndex].balance += receiveAmt;
    } else {
      // បើគេផ្ញើចូលតាមឈ្មោះ/ទូរស័ព្ទ ឬ លេខកុង Main
      if (receiverInput === receiver.accountNumberKHR)
        actualReceiverAccNum = receiver.accountNumberKHR;

      // Main Account ទទួលតាមប្រភេទរូបិយប័ណ្ណកាដូផ្ទាល់
      if (currency === "USD") receiver.balance += giftAmount;
      else receiver.balanceKHR = (receiver.balanceKHR || 0) + giftAmount;
    }

    // ៥. កត់ត្រាប្រវត្តិប្រតិបត្តិការ (Transactions) អោយត្រូវស្តង់ដារ Dashboard ថ្មី
    const refId = "GIFT" + Date.now().toString().slice(-6);
    const trxHash = Math.random().toString(36).substring(2, 11);
    const dateStr = new Date().toLocaleString("en-US", {
      timeZone: "Asia/Phnom_Penh",
      hour12: true,
    });

    // 🌟 បង្កើត Trx សម្រាប់អ្នកផ្ញើ
    const senderTrx = {
      username: sender.username,
      refId,
      hash: trxHash,
      type: "E-Gift Sent",
      amount: -finalDeduction,
      currency: sourceCurrency, // កត់ត្រាលុយពិតដែលកាត់
      senderName: sender.fullName || sender.username,
      receiverName: receiver.fullName || receiver.username,
      senderAcc: actualSenderAccNum, // 🔥 លេខកុងអ្នកផ្ញើ (ដើម្បីឱ្យចេញក្នុង History)
      receiverAcc: actualReceiverAccNum, // 🔥 លេខកុងអ្នកទទួល
      trxMethod: "U-Pay App",
      date: dateStr,
      remark: message || "E-Gift",
      status: "Completed",
    };

    // 🌟 បង្កើត Trx សម្រាប់អ្នកទទួល (ទោះមិនទាន់បើកក៏កត់ទុកថាបានទទួលដែរ)
    const receiverTrx = {
      username: receiver.username,
      refId,
      hash: trxHash,
      type: "E-Gift Received",
      amount: giftAmount,
      currency: currency, // កត់ត្រាលុយកាដូសុទ្ធ
      senderName: sender.fullName || sender.username,
      receiverName: receiver.fullName || receiver.username,
      senderAcc: actualSenderAccNum,
      receiverAcc: actualReceiverAccNum,
      trxMethod: "U-Pay App",
      date: dateStr,
      remark: message || "E-Gift",
      status: "Completed",
    };

    await Transaction.create(senderTrx);
    await Transaction.create(receiverTrx);

    // ៦. 🎁 បង្កើត Notification ពិសេសឱ្យអ្នកទទួល (មានភ្ជាប់ Theme អាំងប៉ាវ)
    const giftNotification = {
      title: "មានកាដូថ្មី! 🎁",
      message: `អ្នកទទួលបានអាំងប៉ាវពី ${sender.fullName || sender.username}។ ចុចដើម្បីបើកមើល!`,
      type: "egift_receive",
      date: dateStr,
      isRead: false,
      egiftData: {
        amount: giftAmount,
        currency: currency,
        theme: theme,
        message: message,
        senderName: sender.fullName || sender.username,
        senderUsername: sender.username, // សំខាន់ដើម្បីផ្ញើសារត្រឡប់
      },
    };

    if (!receiver.notifications) receiver.notifications = [];
    receiver.notifications.push(giftNotification);

    // Save ទិន្នន័យទាំងសងខាងចូល Database
    await sender.save();
    await receiver.save();

    // ត្រលប់ទឹកប្រាក់ថ្មីទៅអោយអ្នកផ្ញើវិញដើម្បី Update ក្នុង App
    let newBalanceRes = 0;
    if (senderAccount === "MAIN_USD") newBalanceRes = sender.balance;
    else if (senderAccount === "MAIN_KHR") newBalanceRes = sender.balanceKHR;
    else {
      const sub = sender.subAccounts.find(
        (a) => a.accountNumber === senderAccount,
      );
      newBalanceRes = sub.balance;
    }

    res.json({
      success: true,
      message: "អាំងប៉ាវត្រូវបានផ្ញើដោយជោគជ័យ!",
      newBalance: newBalanceRes,
    });
  } catch (error) {
    console.error("E-Gift Error:", error);
    res
      .status(500)
      .json({ success: false, message: "មានបញ្ហាបច្ចេកទេសលើ Server" });
  }
};

// 🔥 មុខងារថ្មី៖ ទទួលដំណឹងពេលបើកអាំងប៉ាវ និងផ្ញើសារទៅអ្នកផ្ញើវិញ
const egiftOpened = async (req, res) => {
  const { receiverName, senderUsername, notifId } = req.body;

  try {
    const User = require("../models/User");

    // ១. Mark អាំងប៉ាវនេះជា "បានអានហើយ" សម្រាប់អ្នកទទួល (ដើម្បីកុំឱ្យវាលោតជាប៊ូតុង "បើកអាំងប៉ាវ" ទៀត)
    if (notifId) {
      await User.updateOne(
        { "notifications._id": notifId },
        { $set: { "notifications.$.isRead": true } },
      );
    }

    // ២. បង្កើត Notification ជូនដំណឹងដល់អ្នកផ្ញើវិញ (Sender) ថាបានបើកហើយ
    if (senderUsername) {
      const sender = await User.findOne({ username: senderUsername });
      if (sender) {
        const dateStr = new Date().toLocaleString("en-US", {
          timeZone: "Asia/Phnom_Penh",
          hour12: true,
        });

        const openedNotification = {
          title: "អាំងប៉ាវត្រូវបានបើកហើយ! 🎉",
          message: `${receiverName} បានបើកមើលអាំងប៉ាវរបស់អ្នកហើយ។`,
          type: "egift_opened",
          date: dateStr,
          isRead: false,
        };

        if (!sender.notifications) sender.notifications = [];
        sender.notifications.push(openedNotification);
        await sender.save();
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error("E-Gift Opened Error:", error);
    res.status(500).json({ success: false });
  }
};

module.exports = {
  checkAccount,
  transfer,
  payBankBill,
  rewardCashback,
  claimPromoCode,
  scanBankBill,
  sendEgift,
  egiftOpened,
};
