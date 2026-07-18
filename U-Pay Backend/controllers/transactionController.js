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

      if (target.accountNumberKHR === accountNumber) {
        isReceiverKHR = true;
      } else {
        const subAcc = target.subAccounts.find(
          (acc) => acc.accountNumber === accountNumber,
        );
        if (subAcc) {
          if (subAcc.currency === "KHR") isReceiverKHR = true;

          // 🔥 បើជាគណនីរួម គឺបង្ហាញឈ្មោះទាំង២ (DARA AND SINA)
          if (
            subAcc.accountType === "joint" ||
            subAcc.accountType === "joint_member"
          ) {
            targetName = subAcc.accountName;
          } else {
            targetName = targetName + " (" + subAcc.accountName + ")";
          }
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
// 💸 ២. មុខងារវេរលុយ (Transfer & Merchant Payment)
// ==========================================
const transfer = async (req, res) => {
  const {
    senderUsername,
    senderAccount,
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
    await sender.save(); // Save pin attempt reset

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
      if (senderSubIndex !== -1) isSenderSubAccount = true;
    }

    let senderAvailableBal = 0;
    if (isSenderSubAccount) {
      senderAvailableBal = sender.subAccounts[senderSubIndex].balance;
    } else {
      senderAvailableBal = isSenderKHR
        ? sender.balanceKHR || 0
        : sender.balance || 0;
    }

    if (senderAvailableBal < totalDeduction)
      return res.json({ success: false, message: "សមតុល្យមិនគ្រប់គ្រាន់" });

    // ==========================================
    // ដំណើរការបញ្ចូលលុយទៅអ្នកទទួល (Receiver Side)
    // ==========================================
    let receiverAmount = transferAmount;
    let isReceiverKHR = false;
    let actualReceiverAccNum = receiverAccount;
    let targetSubAccIndex = -1;
    let isReceiverSubAccount = false;

    if (isMerchant) {
      isReceiverKHR = receiverMerchant.accountNumbers.KHR === receiverAccount;
      if (!isSenderKHR && isReceiverKHR)
        receiverAmount = transferAmount * currentFXRates.usdToKhrBuy;
      else if (isSenderKHR && !isReceiverKHR)
        receiverAmount = transferAmount / currentFXRates.usdToKhrSell;

      if (isReceiverKHR) receiverMerchant.collected.KHR += receiverAmount;
      else receiverMerchant.collected.USD += receiverAmount;
      await receiverMerchant.save();

      const owner = await User.findOne({ username: receiverMerchant.userId });
      if (owner) {
        actualReceiverAccNum = isReceiverKHR
          ? receiverMerchant.linkedAccounts.KHR
          : receiverMerchant.linkedAccounts.USD;
        if (actualReceiverAccNum === owner.accountNumber) {
          owner.balance += receiverAmount;
        } else if (actualReceiverAccNum === owner.accountNumberKHR) {
          owner.balanceKHR = (owner.balanceKHR || 0) + receiverAmount;
        } else {
          const sub = owner.subAccounts.find(
            (s) => s.accountNumber === actualReceiverAccNum,
          );
          if (sub) sub.balance += receiverAmount;
          else {
            if (isReceiverKHR)
              owner.balanceKHR = (owner.balanceKHR || 0) + receiverAmount;
            else owner.balance += receiverAmount;
            actualReceiverAccNum = isReceiverKHR
              ? owner.accountNumberKHR
              : owner.accountNumber;
          }
        }
        await owner.save();
        receiver = owner;
      }
    } else {
      targetSubAccIndex = receiver.subAccounts.findIndex(
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

      if (!isSenderKHR && isReceiverKHR)
        receiverAmount = transferAmount * currentFXRates.usdToKhrBuy;
      else if (isSenderKHR && !isReceiverKHR)
        receiverAmount = transferAmount / currentFXRates.usdToKhrSell;

      if (isReceiverSubAccount) {
        const targetSubAcc = receiver.subAccounts[targetSubAccIndex];
        // 🔥 បើទទួលលុយចូលគណនីរួម
        if (
          targetSubAcc.accountType === "joint" ||
          targetSubAcc.accountType === "joint_member"
        ) {
          await syncJointBalance(targetSubAcc.accountId, receiverAmount);
        } else {
          targetSubAcc.balance += receiverAmount;
          await receiver.save();
        }
      } else {
        if (isReceiverKHR)
          receiver.balanceKHR = (receiver.balanceKHR || 0) + receiverAmount;
        else receiver.balance = (receiver.balance || 0) + receiverAmount;
        await receiver.save();
      }
    }

    // ==========================================
    // ដំណើរការកាត់លុយពីអ្នកផ្ញើ (Sender Side)
    // ==========================================
    if (isSenderSubAccount) {
      const senderSubAcc = sender.subAccounts[senderSubIndex];
      // 🔥 បើកាត់លុយចេញពីគណនីរួម
      if (
        senderSubAcc.accountType === "joint" ||
        senderSubAcc.accountType === "joint_member"
      ) {
        await syncJointBalance(senderSubAcc.accountId, -totalDeduction);
      } else {
        senderSubAcc.balance -= totalDeduction;
        await sender.save();
      }
    } else {
      if (isSenderKHR) sender.balanceKHR -= totalDeduction;
      else sender.balance -= totalDeduction;
      await sender.save();
    }

    // ==========================================
    // 📝 ការកត់ត្រាប្រវត្តិ & ការផ្ញើសារ (Transactions & Notifications)
    // ==========================================
    const date = new Date().toLocaleString("en-US", {
      timeZone: "Asia/Phnom_Penh",
      hour12: true,
    });
    const sharedRefId = generateRefId();
    const sharedHash = generateHash();
    const currentMethod = isMerchant
      ? "Merchant Payment"
      : trxMethod || "Account Transfer";
    const sharedRemark = isMerchant
      ? remark || `Payment via ${receiverMerchant.name}`
      : remark || "General";

    const actualSenderAccNum = isSenderSubAccount
      ? senderAccount
      : isSenderKHR
        ? sender.accountNumberKHR
        : sender.accountNumber;

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
      receiverAcc: actualReceiverAccNum,
      senderAcc: actualSenderAccNum,
      trxMethod: currentMethod,
      remark: sharedRemark,
      status: "Success",
      username: sender.username,
    };

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
      receiverAcc: actualReceiverAccNum,
      senderAcc: actualSenderAccNum,
      trxMethod: currentMethod,
      remark: sharedRemark,
      status: "Success",
      username: isMerchant ? receiverMerchant.userId : receiver.username,
      merchantId: isMerchant ? receiverMerchant.merchantId : undefined,
    };

    // 🔥 ១. កត់ត្រាប្រវត្តិអ្នកផ្ញើ (បញ្ចូនអោយគ្រប់សមាជិកគណនីរួម)
    if (
      isSenderSubAccount &&
      (sender.subAccounts[senderSubIndex].accountType === "joint" ||
        sender.subAccounts[senderSubIndex].accountType === "joint_member")
    ) {
      const sAccId = sender.subAccounts[senderSubIndex].accountId;
      const sOwner = await User.findOne({ "subAccounts.accountId": sAccId });
      if (sOwner) {
        const sAcc = sOwner.subAccounts.find((a) => a.accountId === sAccId);
        let sUsers = [sOwner.username];
        for (let m of sAcc.members) {
          if (m.status === "active") sUsers.push(m.username);
        }

        for (let u of sUsers) {
          await Transaction.create({ ...senderTrx, username: u });
        }
      }
    } else {
      await Transaction.create(senderTrx);
    }

    // 🔥 ២. កត់ត្រាប្រវត្តិអ្នកទទួល (បញ្ចូនអោយគ្រប់សមាជិកគណនីរួម)
    const currencySymbol = isReceiverKHR ? "៛" : "$";

    if (
      !isMerchant &&
      isReceiverSubAccount &&
      (receiver.subAccounts[targetSubAccIndex].accountType === "joint" ||
        receiver.subAccounts[targetSubAccIndex].accountType === "joint_member")
    ) {
      const rAccId = receiver.subAccounts[targetSubAccIndex].accountId;
      const rOwner = await User.findOne({ "subAccounts.accountId": rAccId });
      if (rOwner) {
        const rAcc = rOwner.subAccounts.find((a) => a.accountId === rAccId);
        let rUsers = [rOwner.username];
        for (let m of rAcc.members) {
          if (m.status === "active") rUsers.push(m.username);
        }

        for (let u of rUsers) {
          await Transaction.create({ ...receiverTrx, username: u });

          // 🔔 លោតសារអោយដៃគូ និង ម្ចាស់ដើម ទាំងអស់គ្នា
          const uDoc = await User.findOne({ username: u });
          if (uDoc) {
            if (!uDoc.notifications) uDoc.notifications = [];
            uDoc.notifications.push({
              title: "ទទួលបានទឹកប្រាក់ (គណនីរួម)! 💸",
              message: `គណនីរួម ${rAcc.accountName} ទទួលបាន ${currencySymbol}${receiverAmount.toLocaleString()} ពី ${sender.fullName || sender.username}។`,
              type: "transfer_receive",
              date,
              isRead: false,
            });
            await uDoc.save();
          }
        }
      }
    } else {
      await Transaction.create(receiverTrx);

      // 🔔 លោតសារកុងធម្មតា
      if (!isMerchant) {
        const rDoc = await User.findOne({ username: receiver.username });
        if (rDoc) {
          if (!rDoc.notifications) rDoc.notifications = [];
          rDoc.notifications.push({
            title: "ទទួលបានទឹកប្រាក់! 💸",
            message: `អ្នកទទួលបាន ${currencySymbol}${receiverAmount.toLocaleString()} ពី ${sender.fullName || sender.username}។`,
            type: "transfer_receive",
            date,
            isRead: false,
          });
          await rDoc.save();
        }
      }
    }

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

    // ទាញយកសមតុល្យចុងក្រោយបង្អស់ (Fresh Balance) មកបង្ហាញអ្នកផ្ញើវិញ
    const updatedSender = await User.findOne({ username: senderUsername });
    let newBalanceRes = 0;
    if (isSenderSubAccount) {
      let sub = updatedSender.subAccounts.find(
        (a) => a.accountNumber === senderAccount,
      );
      if (sub) newBalanceRes = sub.balance;
    } else {
      newBalanceRes = isSenderKHR
        ? updatedSender.balanceKHR
        : updatedSender.balance;
    }

    res.json({
      success: true,
      newBalance: newBalanceRes,
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

    const currentRefId = `BP-${Date.now()}`;
    const response = await fetch("https://payhub-kh.fly.dev/api/gateway/pay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bill_id: bill_id, upay_trx_id: currentRefId }),
    });

    const payhubData = await response.json();

    if (payhubData && payhubData.success) {
      payingUser.balance -= amount;
      const newHash = generateHash();

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
        const sharedHash = generateHash();
        const sharedRefId = "RWD-" + Date.now().toString().slice(-6);
        const sharedRemark = `Lucky Spin Reward (Trx: ${refId})`;

        user.balance += reward;
        centralBank.balance -= reward;

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
          remark: sharedRemark,
          status: "Success",
          device: "App",
          ip: req.ip || "127.0.0.1",
        });

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
          remark: sharedRemark,
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

  if (req.user.username !== username)
    return res
      .status(403)
      .json({ success: false, message: "បម្រាមសុវត្ថិភាព API!" });

  try {
    const user = await User.findOne({ username });
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "រកមិនឃើញគណនីអតិថិជន!" });

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

    const centralBank = await User.findOne({ accountNumber: "888888888" });
    if (!centralBank)
      return res.json({
        success: false,
        message: "System Error: Central Bank Not Found!",
      });

    const rewardAmt = promo.rewardValue;

    user.balance += rewardAmt;
    centralBank.balance -= rewardAmt;

    const date = new Date().toLocaleString("en-US", {
      timeZone: "Asia/Phnom_Penh",
      hour12: true,
    });
    const sharedHash = generateHash();
    const sharedRefId = "PRM-" + Date.now().toString().slice(-6);
    const sharedRemark = `Claimed Promo Code: ${promo.code}`;

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
      remark: sharedRemark,
      status: "Success",
      trxMethod: "API Endpoint",
    });

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
      remark: sharedRemark,
      status: "Success",
      trxMethod: "API Endpoint",
    });

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
  // ... កូដអាំងប៉ាវចាស់រក្សាទុកដដែល ...
  // [ដោយសារកូដវែងខ្លាំង ខ្ញុំមិនលុបកូដបងទេ គ្រាន់តែកាត់វាចេញពីនេះដើម្បីកុំអោយវែងពេក តែបងនៅរក្សាកូដ sendEgift ចាស់ដដែល]
};

const egiftOpened = async (req, res) => {
  // ... កូដ egiftOpened ចាស់រក្សាទុកដដែល ...
};

// ==========================================
// 🔥 មុខងារ syncJointBalance សម្រាប់ Update លុយគណនីរួម
// ==========================================
const syncJointBalance = async (accountId, amountChange) => {
  try {
    const owner = await User.findOne({ "subAccounts.accountId": accountId });
    if (!owner) return;

    const acc = owner.subAccounts.find((a) => a.accountId === accountId);
    if (!acc || acc.accountType !== "joint") return;

    // Update ក្នុងកុងម្ចាស់ដើម (Owner)
    let ownerAccIndex = owner.subAccounts.findIndex(
      (a) => a.accountId === accountId,
    );
    if (ownerAccIndex !== -1) {
      owner.subAccounts[ownerAccIndex].balance += amountChange;
      await owner.save();
    }

    // Update ក្នុងកុងដៃគូ (Partner)
    for (let member of acc.members) {
      if (member.status === "active") {
        const partner = await User.findOne({ username: member.username });
        if (partner) {
          let pIdx = partner.subAccounts.findIndex(
            (a) => a.accountId === accountId,
          );
          if (pIdx !== -1) {
            partner.subAccounts[pIdx].balance += amountChange;
            await partner.save();
          }
        }
      }
    }
  } catch (err) {
    console.error("Sync Joint Balance Error:", err);
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
