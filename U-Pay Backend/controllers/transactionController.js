// ==========================================
// 📦 នាំចូលម៉ូឌុល និងឯកសារដែលចាំបាច់ (Imports)
// ==========================================
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
// 🔍 ១. មុខងារឆែកឈ្មោះគណនីមុនពេលវេរលុយ (Check Account)
// ==========================================
const checkAccount = async (req, res) => {
  const { accountNumber } = req.body;
  try {
    // ឆែករកក្នុងប្រព័ន្ធ User (ស្វែងរកទាំង Main Account និង Sub-Accounts)
    let target = await User.findOne({
      $or: [
        { accountNumber: accountNumber },
        { accountNumberKHR: accountNumber },
        { "subAccounts.accountNumber": accountNumber },
      ],
    });

    let isMerchant = false;
    let targetName = "";
    let isReceiverKHR = false;

    // ប្រសិនបើមិនឃើញក្នុង User ទេ គឺត្រូវទៅឆែករកក្នុងប្រព័ន្ធ Merchant វិញ
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
      // ករណីរកឃើញ User ធម្មតា
      targetName = target.fullName || target.username;

      // ឆែកមើលថាតើជាកុងប្រាក់រៀល ឬដុល្លារ
      if (target.accountNumberKHR === accountNumber) {
        isReceiverKHR = true;
      } else {
        // បើវាជា Sub-Account ត្រូវឆែកមើល Currency របស់វា
        const subAcc = target.subAccounts.find(
          (acc) => acc.accountNumber === accountNumber,
        );
        if (subAcc && subAcc.currency === "KHR") {
          isReceiverKHR = true;
          targetName = targetName + " (" + subAcc.accountName + ")"; // បង្ហាញឈ្មោះហោប៉ៅបន្ថែម
        }
      }
    }

    // ឆ្លើយតបទិន្នន័យទៅ Frontend វិញ
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
// 💸 ២. មុខងារវេរលុយ (Transfer & Merchant Payment)
// ==========================================
const transfer = async (req, res) => {
  const {
    senderUsername,
    senderAccount, // លេខគណនីប្រភពដែលអ្នកផ្ញើបានរើស
    receiverAccount,
    amount,
    remark,
    pin,
    trxMethod,
    currency,
  } = req.body;

  // របាំងការពារសុវត្ថិភាព
  if (req.user.username !== senderUsername) {
    return res
      .status(403)
      .json({ success: false, message: "បម្រាមសុវត្ថិភាព! 🚨" });
  }

  try {
    // ស្វែងរកគណនីអ្នកផ្ញើ
    const sender = await User.findOne({ username: senderUsername });
    if (!sender) return res.json({ success: false, message: "Account Error" });
    if (sender.isFrozen)
      return res.json({ success: false, message: "Account Frozen" });

    // ស្វែងរកអ្នកទទួល (ឆែកទាំង Main និង Sub-Accounts របស់ User)
    let receiver = await User.findOne({
      $or: [
        { accountNumber: receiverAccount },
        { accountNumberKHR: receiverAccount },
        { "subAccounts.accountNumber": receiverAccount },
      ],
    });

    let receiverMerchant = null;
    let isMerchant = false;

    // បើរកមិនឃើញ User ទេ ស្វែងរកក្នុង Merchant
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

    // ឆែកមើលលេខកូដសម្ងាត់ (PIN)
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
    sender.pinAttempts = 0; // Reset PIN វិញពេលវាយត្រូវ

    // គណនាថ្លៃសេវា (Fee) ផ្អែកលើទំហំទឹកប្រាក់
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

    // កំណត់ថាតើគាត់វេរចេញពីកុង Main ឬ កុង Sub? (ផ្នែកអ្នកផ្ញើ)
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

    // ឆែកសមតុល្យតាមគណនីជាក់លាក់ ថាតើគ្រប់គ្រាន់ឬអត់
    if (senderAvailableBal < totalDeduction)
      return res.json({ success: false, message: "សមតុល្យមិនគ្រប់គ្រាន់" });

    // ==========================================
    // ដំណើរការបញ្ចូលលុយទៅអ្នកទទួល (Receiver Side)
    // ==========================================
    let receiverAmount = transferAmount;
    let isReceiverKHR = false;

    // ចាប់យកលេខកុងពិតប្រាកដដែលត្រូវទទួលលុយ
    let actualReceiverAccNum = receiverAccount;

    if (isMerchant) {
      // ករណីបាញ់ចូលហាង (Merchant Payment)
      isReceiverKHR = receiverMerchant.accountNumbers.KHR === receiverAccount;
      if (!isSenderKHR && isReceiverKHR)
        receiverAmount = transferAmount * currentFXRates.usdToKhrBuy;
      else if (isSenderKHR && !isReceiverKHR)
        receiverAmount = transferAmount / currentFXRates.usdToKhrSell;

      // បូកចំណូលក្នុង Profile របស់ហាង
      if (isReceiverKHR) receiverMerchant.collected.KHR += receiverAmount;
      else receiverMerchant.collected.USD += receiverAmount;
      await receiverMerchant.save();

      // រកម្ចាស់ហាងពិតប្រាកដ (Owner)
      const owner = await User.findOne({ username: receiverMerchant.userId });

      if (owner) {
        // ចាប់យកលេខគណនីដែលម្ចាស់ហាងបានភ្ជាប់ទុក (Linked Account)
        actualReceiverAccNum = isReceiverKHR
          ? receiverMerchant.linkedAccounts.KHR
          : receiverMerchant.linkedAccounts.USD;

        // ធ្វើការបូកលុយចូលគណនីដែលម្ចាស់ហាងបានរើស
        if (actualReceiverAccNum === owner.accountNumber) {
          owner.balance += receiverAmount;
        } else if (actualReceiverAccNum === owner.accountNumberKHR) {
          owner.balanceKHR = (owner.balanceKHR || 0) + receiverAmount;
        } else {
          // ករណីកុងរង (Sub-account)
          const sub = owner.subAccounts.find(
            (s) => s.accountNumber === actualReceiverAccNum,
          );
          if (sub) {
            sub.balance += receiverAmount;
          } else {
            // ការពារករណី Error គឺទម្លាក់ចូលកុង Main ធម្មតា
            if (isReceiverKHR)
              owner.balanceKHR = (owner.balanceKHR || 0) + receiverAmount;
            else owner.balance += receiverAmount;

            actualReceiverAccNum = isReceiverKHR
              ? owner.accountNumberKHR
              : owner.accountNumber;
          }
        }
        await owner.save();
        receiver = owner; // Assign ត្រលប់ទៅ receiver វិញដើម្បីប្រព័ន្ធស្គាល់
      } else {
        return res.json({
          success: false,
          message: "ប្រព័ន្ធមានបញ្ហា៖ រកគណនីម្ចាស់ហាងមិនឃើញ",
        });
      }
    } else {
      // ករណីវេរលុយធម្មតា (User to User Transfer)
      let isReceiverSubAccount = false;
      let targetSubAccIndex = receiver.subAccounts.findIndex(
        (acc) => acc.accountNumber === receiverAccount,
      );

      if (receiver.accountNumberKHR === receiverAccount) {
        isReceiverKHR = true;
      } else if (
        receiver.accountNumber !== receiverAccount &&
        targetSubAccIndex !== -1
      ) {
        isReceiverSubAccount = true;
        isReceiverKHR =
          receiver.subAccounts[targetSubAccIndex].currency === "KHR";
      }

      // ប្តូររូបិយប័ណ្ណបើវេរឆ្លង Currency គ្នា
      if (!isSenderKHR && isReceiverKHR)
        receiverAmount = transferAmount * currentFXRates.usdToKhrBuy;
      else if (isSenderKHR && !isReceiverKHR)
        receiverAmount = transferAmount / currentFXRates.usdToKhrSell;

      // បូកលុយអ្នកទទួលចំកុង
      if (isReceiverSubAccount) {
        receiver.subAccounts[targetSubAccIndex].balance += receiverAmount;
      } else {
        if (isReceiverKHR)
          receiver.balanceKHR = (receiver.balanceKHR || 0) + receiverAmount;
        else receiver.balance = (receiver.balance || 0) + receiverAmount;
      }

      // លោត Notification អោយអ្នកទទួល
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

    // ==========================================
    // ដំណើរការកាត់លុយពីអ្នកផ្ញើ (Sender Side)
    // ==========================================
    if (isSenderSubAccount) {
      sender.subAccounts[senderSubIndex].balance -= totalDeduction;
    } else {
      if (isSenderKHR) sender.balanceKHR -= totalDeduction;
      else sender.balance -= totalDeduction;
    }

    // ចាប់យកម៉ោងស្រុកខ្មែរ
    const date = new Date().toLocaleString("en-US", {
      timeZone: "Asia/Phnom_Penh",
      hour12: true,
    });

    // 🔥 កំណត់អថេររួម (Shared Variables) ដើម្បីឱ្យអ្នកផ្ញើ និងអ្នកទទួលមានទិន្នន័យដូចគ្នា ១០០%
    const sharedRefId = generateRefId(); // លេខប្រតិបត្តិការរួមគ្នា
    const sharedHash = generateHash(); // លេខ Hash រួមគ្នា
    const currentMethod = isMerchant
      ? "Merchant Payment"
      : trxMethod || "Account Transfer";
    const sharedRemark = isMerchant
      ? remark || `Payment via ${receiverMerchant.name}`
      : remark || "General";

    // កំណត់លេខកុងអ្នកផ្ញើអោយចំ
    const actualSenderAccNum = isSenderSubAccount
      ? senderAccount
      : isSenderKHR
        ? sender.accountNumberKHR
        : sender.accountNumber;

    // 📝 កត់ត្រាប្រវត្តិសម្រាប់ "អ្នកផ្ញើ"
    const senderTrx = {
      refId: sharedRefId,
      hash: sharedHash,
      date,
      type: "Transfer",
      amount: -totalDeduction,
      currency: isSenderKHR ? "KHR" : "USD",
      fee: appliedFee,
      senderName: sender.fullName || sender.username,
      receiverName: isMerchant
        ? receiverMerchant.name
        : receiver.fullName || receiver.username,
      receiverAcc: actualReceiverAccNum, // ប្រើលេខកុងពិតប្រាកដ
      senderAcc: actualSenderAccNum,
      trxMethod: currentMethod,
      remark: sharedRemark, // ប្រើ Remark ដូចគ្នា
      status: "Success",
      username: sender.username,
    };

    // 📝 កត់ត្រាប្រវត្តិសម្រាប់ "អ្នកទទួល"
    const receiverTrx = {
      refId: sharedRefId,
      hash: sharedHash,
      date,
      type: "Receive",
      amount: receiverAmount,
      currency: isReceiverKHR ? "KHR" : "USD",
      fee: 0,
      senderName: sender.fullName || sender.username,
      receiverName: isMerchant
        ? receiverMerchant.name
        : receiver.fullName || receiver.username,
      receiverAcc: actualReceiverAccNum, // ប្រើលេខកុងពិតប្រាកដ
      senderAcc: actualSenderAccNum,
      trxMethod: currentMethod,
      remark: sharedRemark, // ប្រើ Remark ដូចគ្នា
      status: "Success",
      username: isMerchant ? receiverMerchant.userId : receiver.username, // ប្រើ username ម្ចាស់ហាងបើជា Merchant
      merchantId: isMerchant ? receiverMerchant.merchantId : undefined, // ភ្ជាប់ ID ហាង
    };

    // បញ្ចូលទិន្នន័យទៅក្នុង Database ទាំងសងខាង
    await Transaction.create(senderTrx);
    await Transaction.create(receiverTrx);
    await sender.save();

    // 🔔 លោត Socket (Live Notification) ជូនដំណឹងដល់អ្នកទទួល
    const io = req.app.get("io");
    if (io) {
      const targetSocketUser = isMerchant
        ? receiverMerchant.userId
        : receiver.username;
      io.to(targetSocketUser).emit("paymentReceived", {
        amount: receiverAmount,
        currency: isReceiverKHR ? "KHR" : "USD",
        senderName: sender.fullName || sender.username,
      });
    }

    // បញ្ជូនទឹកប្រាក់ដែលនៅសល់ទៅកាន់ Frontend វិញឱ្យចំកុង
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
// 🔍 ៣. មុខងារស្វែងរកវិក្កយបត្រពីប្រព័ន្ធ PayHub
// ==========================================
const scanBankBill = async (req, res) => {
  const { bill_id } = req.body;
  try {
    // បាញ់សំណើទៅសួរ PayHub ផ្ទាល់
    const response = await fetch(
      `https://payhub-kh.fly.dev/api/gateway/check-bill?query=${bill_id}`,
    );
    const data = await response.json();

    if (data.success) {
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
// 💳 ៤. មុខងារបង់វិក្កយបត្រ (Pay Bill)
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

    // បាញ់សំណើទៅ PayHub ដើម្បីទូទាត់ប្រាក់
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

    // បើការទូទាត់ជោគជ័យ ទើបកាត់លុយ
    if (payhubData && payhubData.success) {
      payingUser.balance -= amount;
      const newHash = generateHash();

      // 📝 កត់ត្រាប្រតិបត្តិការសម្រាប់តែអតិថិជន
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

      // ឆ្លើយតបទៅអតិថិជនវិញ
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
// 🎁 ៥. មុខងាររង្វាន់ និងការបង្វិលសង (Lucky Spin Cashback)
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

        // 🔥 កំណត់អថេររួម (Shared Variables) ទាំងអ្នកទទួលរង្វាន់ និងអ្នកបើករង្វាន់ (Central Bank)
        const sharedHash = generateHash();
        const sharedRefId = "RWD-" + Date.now().toString().slice(-6);
        const sharedRemark = `Lucky Spin Reward (Trx: ${refId})`; // Remark ដូចគ្នា

        user.balance += reward;
        centralBank.balance -= reward;

        // 📝 កត់ត្រាសម្រាប់អ្នកឈ្នះ (User)
        await Transaction.create({
          username: user.username,
          refId: sharedRefId,
          hash: sharedHash,
          date: date,
          type: "Cashback Reward",
          amount: reward,
          currency: "USD",
          fee: 0,
          senderName: "U-Pay Central Bank",
          receiverName: user.username,
          remark: sharedRemark, // ប្រើ Remark រួម
          status: "Success",
          device: "App",
          ip: req.ip || "127.0.0.1",
        });

        // 📝 កត់ត្រាសម្រាប់ធនាគារកណ្តាល (Central Bank)
        await Transaction.create({
          username: centralBank.username,
          refId: sharedRefId,
          hash: sharedHash,
          date: date,
          type: "Cashback Payout",
          amount: -reward,
          currency: "USD",
          fee: 0,
          senderName: "U-Pay Central Bank",
          receiverName: user.username,
          remark: sharedRemark, // ប្រើ Remark រួម
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
// 🚀 ៦. មុខងារទាមទាររង្វាន់ប្រូម៉ូកូដ (Redeem Promo API)
// ==========================================
const claimPromoCode = async (req, res) => {
  const { username, code } = req.body;

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

    // ស្កេនរកកូដក្នុងប្រព័ន្ធ
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

    // ទាញយកលុយចេញពីធនាគារកណ្តាល
    const centralBank = await User.findOne({ accountNumber: "888888888" });
    if (!centralBank)
      return res.json({
        success: false,
        message: "System Error: Central Bank Not Found!",
      });

    const rewardAmt = promo.rewardValue;

    // បូកដកលុយជាក់ស្តែង
    user.balance += rewardAmt;
    centralBank.balance -= rewardAmt;

    const date = new Date().toLocaleString("en-US", {
      timeZone: "Asia/Phnom_Penh",
      hour12: true,
    });

    // 🔥 កំណត់អថេររួម (Shared Variables) សម្រាប់ប្រតិបត្តិការទាំងសងខាង
    const sharedHash = generateHash();
    const sharedRefId = "PRM-" + Date.now().toString().slice(-6);
    const sharedRemark = `Claimed Promo Code: ${promo.code}`; // Remark ដូចគ្នា

    // 📝 កត់ត្រាសម្រាប់អ្នកទាមទាររង្វាន់ (User)
    await Transaction.create({
      username: user.username,
      refId: sharedRefId,
      hash: sharedHash,
      date: date,
      type: "Promo Reward",
      amount: rewardAmt,
      currency: "USD",
      fee: 0,
      senderName: "U-Pay Promos",
      receiverName: user.username,
      remark: sharedRemark, // ប្រើ Remark រួម
      status: "Success",
      trxMethod: "API Endpoint",
    });

    // 📝 កត់ត្រាសម្រាប់ធនាគារកណ្តាល (Central Bank)
    await Transaction.create({
      username: centralBank.username,
      refId: sharedRefId,
      hash: sharedHash,
      date: date,
      type: "Promo Expense",
      amount: -rewardAmt,
      currency: "USD",
      fee: 0,
      senderName: "U-Pay Promos",
      receiverName: user.username,
      remark: sharedRemark, // ប្រើ Remark រួម
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
// 🧧 ៧. មុខងារផ្ញើអាំងប៉ាវ (Send E-Gift)
// ==========================================
const sendEgift = async (req, res) => {
  const {
    senderUsername,
    senderAccount,
    receiverInput,
    amount,
    currency,
    theme,
    message,
    pin,
  } = req.body;

  try {
    const User = require("../models/User");
    const Transaction = require("../models/Transaction");

    // កំណត់អត្រាប្តូរប្រាក់ (Fix ទុកសិន)
    const fxRates = { usdToKhrBuy: 4050, usdToKhrSell: 4100 };
    const giftAmount = parseFloat(amount);

    // ផ្ទៀងផ្ទាត់អ្នកផ្ញើ និងលេខកូដ PIN
    const sender = await User.findOne({ username: senderUsername });
    if (!sender)
      return res.json({ success: false, message: "រកមិនឃើញគណនីរបស់អ្នកទេ" });
    if (sender.pin !== pin)
      return res.json({
        success: false,
        message: "លេខកូដ PIN មិនត្រឹមត្រូវទេ!",
      });

    // គណនាទឹកប្រាក់ត្រូវកាត់
    let finalDeduction = giftAmount;
    let sourceCurrency = "USD";
    let actualSenderAccNum = sender.accountNumber;

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

    // ប្តូរប្រាក់បើកាដូ និងកុងខុសរូបិយប័ណ្ណ
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

    // ស្វែងរកអ្នកទទួល
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

    // ដំណើរការបញ្ចូលប្រាក់ទៅឱ្យអ្នកទទួល
    let isReceiverSubAccount = false;
    let receiverSubIndex = receiver.subAccounts.findIndex(
      (acc) => acc.accountNumber === receiverInput,
    );
    let actualReceiverAccNum = receiver.accountNumber;

    if (receiverSubIndex !== -1) {
      isReceiverSubAccount = true;
      actualReceiverAccNum = receiverInput;
      let targetCur = receiver.subAccounts[receiverSubIndex].currency;
      let receiveAmt = giftAmount;

      if (currency === "USD" && targetCur === "KHR")
        receiveAmt = receiveAmt * fxRates.usdToKhrBuy;
      if (currency === "KHR" && targetCur === "USD")
        receiveAmt = receiveAmt / fxRates.usdToKhrSell;

      receiver.subAccounts[receiverSubIndex].balance += receiveAmt;
    } else {
      if (receiverInput === receiver.accountNumberKHR)
        actualReceiverAccNum = receiver.accountNumberKHR;

      if (currency === "USD") receiver.balance += giftAmount;
      else receiver.balanceKHR = (receiver.balanceKHR || 0) + giftAmount;
    }

    const dateStr = new Date().toLocaleString("en-US", {
      timeZone: "Asia/Phnom_Penh",
      hour12: true,
    });

    // 🔥 កំណត់អថេររួម (Shared Variables) ទាំងអ្នកផ្ញើ និងអ្នកទទួលអាំងប៉ាវ
    const sharedRefId = "GIFT" + Date.now().toString().slice(-6);
    const sharedHash = Math.random().toString(36).substring(2, 11);
    const sharedRemark = message || "E-Gift"; // ប្រើ Remark ដូចគ្នា

    // 📝 បង្កើតប្រវត្តិសម្រាប់អ្នកផ្ញើ
    const senderTrx = {
      username: sender.username,
      refId: sharedRefId,
      hash: sharedHash,
      type: "E-Gift Sent",
      amount: -finalDeduction,
      currency: sourceCurrency,
      senderName: sender.fullName || sender.username,
      receiverName: receiver.fullName || receiver.username,
      senderAcc: actualSenderAccNum,
      receiverAcc: actualReceiverAccNum,
      trxMethod: "U-Pay App",
      date: dateStr,
      remark: sharedRemark, // ប្រើ Remark រួម
      status: "Completed",
    };

    // 📝 បង្កើតប្រវត្តិសម្រាប់អ្នកទទួល
    const receiverTrx = {
      username: receiver.username,
      refId: sharedRefId,
      hash: sharedHash,
      type: "E-Gift Received",
      amount: giftAmount,
      currency: currency,
      senderName: sender.fullName || sender.username,
      receiverName: receiver.fullName || receiver.username,
      senderAcc: actualSenderAccNum,
      receiverAcc: actualReceiverAccNum,
      trxMethod: "U-Pay App",
      date: dateStr,
      remark: sharedRemark, // ប្រើ Remark រួម
      status: "Completed",
    };

    await Transaction.create(senderTrx);
    await Transaction.create(receiverTrx);

    // 🎁 បង្កើត Notification ពិសេសឱ្យអ្នកទទួល (ភ្ជាប់ទិន្នន័យអាំងប៉ាវ)
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
        senderUsername: sender.username,
      },
    };

    if (!receiver.notifications) receiver.notifications = [];
    receiver.notifications.push(giftNotification);

    await sender.save();
    await receiver.save();

    // ត្រលប់ទិន្នន័យទៅ Frontend
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

// ==========================================
// 🔔 ៨. មុខងារបញ្ជាក់ការបើកអាំងប៉ាវ (E-Gift Opened Notification)
// ==========================================
const egiftOpened = async (req, res) => {
  const { receiverName, senderUsername, notifId } = req.body;

  try {
    const User = require("../models/User");

    // Mark អាំងប៉ាវជា "បានអាន"
    if (notifId) {
      await User.updateOne(
        { "notifications._id": notifId },
        { $set: { "notifications.$.isRead": true } },
      );
    }

    // បង្កើត Notification ជូនដំណឹងដល់អ្នកផ្ញើវិញ
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
