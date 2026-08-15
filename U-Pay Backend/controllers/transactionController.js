// ==========================================
// 📦 នាំចូលម៉ូឌុល និងឯកសារដែលចាំបាច់ (Imports)
// ==========================================
const User = require("../models/User");
const System = require("../models/System");
const PromoCode = require("../models/PromoCode");
const Merchant = require("../models/Merchant");
const mongoose = require("mongoose");
const Transaction = require("../models/Transaction");
const JointAccount = require("../models/JointAccount");
const bot = require("../services/telegramBot");
const axios = require("axios");

const {
  getFormattedDate,
  generateRefId,
  generateHash,
  getDevice,
} = require("../services/helpers");
const { readFXRates } = require("../services/systemService");

// ==========================================
// 🔍 ១. មុខងារឆែកឈ្មោះគណនីមុនពេលវេរលុយ
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
          { "cashiers.virtualAccounts.USD": accountNumber },
          { "cashiers.virtualAccounts.KHR": accountNumber },
          { "cashiers.virtualAccount": accountNumber },
        ],
      });

      if (target) {
        isMerchant = true;
        const cashier = target.cashiers.find(
          (c) =>
            c.virtualAccounts?.USD === accountNumber ||
            c.virtualAccounts?.KHR === accountNumber ||
            c.virtualAccount === accountNumber,
        );

        if (cashier && cashier.status === "Active") {
          targetName = `${target.name.toUpperCase()} BY ${cashier.displayName.toUpperCase()}`;
          isReceiverKHR = cashier.virtualAccounts?.KHR === accountNumber;
        } else {
          targetName = target.name.toUpperCase();
          isReceiverKHR = target.accountNumbers.KHR === accountNumber;
        }
      }
    } else {
      if (target.role === "junior") {
        let childName = target.fullName || target.username;
        targetName = childName.toUpperCase() + " (JUNIOR)";
        if (target.accountNumberKHR === accountNumber) isReceiverKHR = true;
      } else {
        targetName = target.fullName || target.username;
        if (target.accountNumberKHR === accountNumber) {
          isReceiverKHR = true;
        } else if (target.subAccounts && target.subAccounts.length > 0) {
          const subAcc = target.subAccounts.find(
            (acc) => acc.accountNumber === accountNumber,
          );
          if (subAcc) {
            if (subAcc.currency === "KHR") isReceiverKHR = true;
            if (
              subAcc.accountType === "joint" ||
              subAcc.accountType === "joint_member"
            ) {
              targetName = subAcc.accountName;
            } else if (subAcc.accountType === "junior") {
              let cleanName = subAcc.accountName.replace(
                /\s*\(Junior\)\s*/i,
                "",
              );
              targetName = cleanName.toUpperCase() + " (JUNIOR)";
            } else {
              targetName = targetName + " (" + subAcc.accountName + ")";
            }
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
      res.json({ success: false, message: "រកមិនឃើញគណនីនេះទេ!" });
    }
  } catch (err) {
    console.error("CHECK ACCOUNT ERROR:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ==========================================
// 💸 ២. មុខងារវេរលុយ (Transfer)
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
    orderId,
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

    let receiver = await User.findOne({
      $or: [
        { accountNumber: receiverAccount },
        { accountNumberKHR: receiverAccount },
      ],
    });

    if (!receiver) {
      receiver = await User.findOne({
        "subAccounts.accountNumber": receiverAccount,
      });
    }

    let receiverMerchant = null;
    let isMerchant = false;
    let cashierInfo = null;
    let finalReceiverName = "";

    // អថេរសម្រាប់កំណត់ថាតើត្រូវបូកលុយចូលកុងមេមួយណា
    let actualLinkedAccountForBalance = receiverAccount;

    if (!receiver) {
      receiverMerchant = await Merchant.findOne({
        $or: [
          { "accountNumbers.USD": receiverAccount },
          { "accountNumbers.KHR": receiverAccount },
          { "cashiers.virtualAccounts.USD": receiverAccount },
          { "cashiers.virtualAccounts.KHR": receiverAccount },
          { "cashiers.virtualAccount": receiverAccount },
        ],
      });
      if (receiverMerchant) isMerchant = true;
    }

    if (!receiver && !receiverMerchant)
      return res.json({ success: false, message: "Receiver not found" });

    const isSenderKHR = currency === "KHR";
    let isSenderSubAccount = false,
      senderSubIndex = -1;

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

    const actualSenderAccNum = isSenderSubAccount
      ? senderAccount
      : isSenderKHR
        ? sender.accountNumberKHR
        : sender.accountNumber;

    // 🔥 ១. ការពារមិនអោយបាញ់ពីគណនីភ្ជាប់ ចូលទៅហាងខ្លួនឯង (Block 100%)
    if (isMerchant) {
      // 🌟 ប្លុកមិនអោយថៅកែហាងវេរលុយចូលហាងខ្លួនឯងដាច់ខាត (ទោះប្រើកុងណាក៏ដោយ)
      if (sender.username === receiverMerchant.userId) {
        return res.json({
          success: false,
          message: "ម្ចាស់ហាងមិនអាចវេរប្រាក់ចូលគណនីហាងរបស់ខ្លួនឯងបានទេ!",
        });
      }

      cashierInfo = receiverMerchant.cashiers.find(
        (c) =>
          c.virtualAccounts?.USD === receiverAccount ||
          c.virtualAccounts?.KHR === receiverAccount ||
          c.virtualAccount === receiverAccount,
      );

      let isReceiverKHRTemp = false;
      if (cashierInfo && cashierInfo.status === "Active") {
        isReceiverKHRTemp =
          cashierInfo.virtualAccounts?.KHR === receiverAccount;
      } else {
        isReceiverKHRTemp =
          receiverMerchant.accountNumbers.KHR === receiverAccount;
      }

      let actualOwnerAccNum = isReceiverKHRTemp
        ? receiverMerchant.linkedAccounts.KHR
        : receiverMerchant.linkedAccounts.USD;

      if (!actualOwnerAccNum)
        actualOwnerAccNum =
          receiverMerchant.linkedAccounts.USD ||
          receiverMerchant.linkedAccounts.KHR;

      actualLinkedAccountForBalance = actualOwnerAccNum;
    }

    // គិតលុយ និងកម្រៃសេវា
    const sys = await System.findOne({ settingId: "GLOBAL_SETTINGS" });
    const transferAmount = parseFloat(amount);
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

    let jointSenderAcc = null,
      juniorSenderAcc = null;
    let senderAvailableBal = 0;

    if (isSenderSubAccount) {
      const sType = sender.subAccounts[senderSubIndex].accountType;
      if (sType === "joint" || sType === "joint_member") {
        jointSenderAcc = await JointAccount.findOne({
          accountId: sender.subAccounts[senderSubIndex].accountId,
        });
        senderAvailableBal = jointSenderAcc ? jointSenderAcc.balance : 0;
      } else if (sType === "junior") {
        juniorSenderAcc = await User.findOne({ accountNumber: senderAccount });
        if (juniorSenderAcc) {
          const dailyLimit = juniorSenderAcc.dailyLimit || 0;
          if (
            dailyLimit > 0 &&
            (juniorSenderAcc.dailySpent || 0) + totalDeduction > dailyLimit
          ) {
            return res.json({
              success: false,
              message: "ប្រតិបត្តិការបរាជ័យ! ចាយលើសដែនកំណត់។",
            });
          }
          senderAvailableBal = isSenderKHR
            ? juniorSenderAcc.balanceKHR || 0
            : juniorSenderAcc.balance || 0;
        }
      } else {
        senderAvailableBal = sender.subAccounts[senderSubIndex].balance;
      }
    } else {
      senderAvailableBal = isSenderKHR
        ? sender.balanceKHR || 0
        : sender.balance || 0;
    }

    if (sender.role === "junior") {
      const dailyLimit = sender.dailyLimit || 0;
      const dailySpent = sender.dailySpent || 0;
      let spentUsd = isSenderKHR
        ? totalDeduction / currentFXRates.usdToKhrSell
        : totalDeduction;
      if (dailyLimit > 0 && dailySpent + spentUsd > dailyLimit) {
        return res.json({
          success: false,
          message: `ប្រតិបត្តិការបរាជ័យ! ចាយបានត្រឹម $${dailyLimit} ក្នុង១ថ្ងៃ។`,
        });
      }
    }

    if (senderAvailableBal < totalDeduction)
      return res.json({ success: false, message: "សមតុល្យមិនគ្រប់គ្រាន់" });

    // កាត់លុយពីអ្នកផ្ញើ
    if (isSenderSubAccount) {
      if (jointSenderAcc) {
        jointSenderAcc.balance -= totalDeduction;
        await jointSenderAcc.save();
      } else if (juniorSenderAcc) {
        if (isSenderKHR) juniorSenderAcc.balanceKHR -= totalDeduction;
        else juniorSenderAcc.balance -= totalDeduction;
        juniorSenderAcc.dailySpent =
          (juniorSenderAcc.dailySpent || 0) + totalDeduction;
        await juniorSenderAcc.save();
        sender.markModified("subAccounts");
      } else {
        sender.subAccounts[senderSubIndex].balance -= totalDeduction;
        sender.markModified("subAccounts");
      }
    } else {
      if (isSenderKHR) sender.balanceKHR -= totalDeduction;
      else sender.balance -= totalDeduction;
    }

    // ------------------------------------------
    // ឃ. បញ្ចូលលុយទៅអ្នកទទួល
    // ------------------------------------------
    let receiverAmount = transferAmount;
    let isReceiverKHR = false;
    let jointReceiverAcc = null;

    if (isMerchant) {
      if (cashierInfo && cashierInfo.status === "Active") {
        isReceiverKHR = cashierInfo.virtualAccounts?.KHR === receiverAccount;
        finalReceiverName = `${receiverMerchant.name.toUpperCase()} BY ${cashierInfo.displayName.toUpperCase()}`;
      } else {
        isReceiverKHR = receiverMerchant.accountNumbers.KHR === receiverAccount;
        finalReceiverName = receiverMerchant.name.toUpperCase();
      }

      if (!isSenderKHR && isReceiverKHR)
        receiverAmount = transferAmount * currentFXRates.usdToKhrBuy;
      else if (isSenderKHR && !isReceiverKHR)
        receiverAmount = transferAmount / currentFXRates.usdToKhrSell;

      if (isReceiverKHR) receiverMerchant.collected.KHR += receiverAmount;
      else receiverMerchant.collected.USD += receiverAmount;
      await receiverMerchant.save();

      let owner = await User.findOne({ username: receiverMerchant.userId });

      if (owner) {
        let actualOwnerAccNum = actualLinkedAccountForBalance;

        if (actualOwnerAccNum === owner.accountNumber) {
          owner.balance += receiverAmount;
        } else if (actualOwnerAccNum === owner.accountNumberKHR) {
          owner.balanceKHR = (owner.balanceKHR || 0) + receiverAmount;
        } else {
          const sub = owner.subAccounts.find(
            (s) => s.accountNumber === actualOwnerAccNum,
          );
          if (sub) {
            sub.balance += receiverAmount;
            owner.markModified("subAccounts");
          } else {
            if (isReceiverKHR)
              owner.balanceKHR = (owner.balanceKHR || 0) + receiverAmount;
            else owner.balance += receiverAmount;
          }
        }
        await owner.save();
        receiver = owner;
      }
    } else {
      let targetSubAccIndex = receiver.subAccounts.findIndex(
        (acc) => acc.accountNumber === receiverAccount,
      );
      if (receiver.accountNumberKHR === receiverAccount) isReceiverKHR = true;
      else if (targetSubAccIndex !== -1)
        isReceiverKHR =
          receiver.subAccounts[targetSubAccIndex].currency === "KHR";

      if (!isSenderKHR && isReceiverKHR)
        receiverAmount = transferAmount * currentFXRates.usdToKhrBuy;
      else if (isSenderKHR && !isReceiverKHR)
        receiverAmount = transferAmount / currentFXRates.usdToKhrSell;

      finalReceiverName = receiver.fullName || receiver.username;

      if (targetSubAccIndex !== -1) {
        const targetSubAcc = receiver.subAccounts[targetSubAccIndex];
        if (
          targetSubAcc.accountType === "joint" ||
          targetSubAcc.accountType === "joint_member"
        ) {
          jointReceiverAcc = await JointAccount.findOne({
            accountId: targetSubAcc.accountId,
          });
          if (jointReceiverAcc) {
            jointReceiverAcc.balance += receiverAmount;
            await jointReceiverAcc.save();
            finalReceiverName = jointReceiverAcc.accountName;
          }
        } else {
          targetSubAcc.balance += receiverAmount;
          receiver.markModified("subAccounts");
          await receiver.save();
        }
      } else {
        if (isReceiverKHR)
          receiver.balanceKHR = (receiver.balanceKHR || 0) + receiverAmount;
        else receiver.balance = (receiver.balance || 0) + receiverAmount;
        await receiver.save();
      }
    }

    await sender.save();

    // ------------------------------------------
    // ង. កត់ត្រាប្រវត្តិ (Transaction Logging)
    // ------------------------------------------
    const date = new Date().toLocaleString("en-US", {
      timeZone: "Asia/Phnom_Penh",
      hour12: true,
    });
    const sharedRefId = generateRefId();
    const sharedHash = generateHash();

    const finalSenderName = jointSenderAcc
      ? jointSenderAcc.accountName
      : sender.fullName || sender.username;

    const senderTrx = {
      refId: sharedRefId,
      hash: sharedHash,
      date,
      type: "Transfer",
      amount: -totalDeduction,
      currency: isSenderKHR ? "KHR" : "USD",
      fee: appliedFee,
      senderName: finalSenderName,
      receiverName: finalReceiverName,
      receiverAcc: receiverAccount,
      senderAcc: actualSenderAccNum,
      trxMethod: isMerchant
        ? "Merchant Payment"
        : trxMethod || "Account Transfer",
      remark: remark || "General",
      status: "Success",
      username: sender.username,
    };

    // 🔥 កត់ត្រាចូល History អោយចំលេខកុងពិតរបស់ថៅកែ (ទើប History Frontend ទាញឃើញ ១០០%)
    const receiverTrx = {
      refId: sharedRefId,
      hash: sharedHash,
      date,
      type: "Receive",
      amount: receiverAmount,
      currency: isReceiverKHR ? "KHR" : "USD",
      fee: 0,
      senderName: finalSenderName,
      receiverName: finalReceiverName,
      receiverAcc: actualLinkedAccountForBalance, // 🔥 កែត្រង់នេះ: ប្រើលេខកុងមេពិតប្រាកដ (មិនមែន receiverAccount ទេ)
      senderAcc: actualSenderAccNum,
      trxMethod: isMerchant
        ? "Merchant Payment"
        : trxMethod || "Account Transfer",
      remark: remark || "General",
      status: "Success",
      username: isMerchant ? receiverMerchant.userId : receiver.username,
      merchantId: isMerchant ? receiverMerchant.merchantId : undefined,
    };

    if (jointSenderAcc) {
      for (let m of jointSenderAcc.members) {
        if (m.status === "active")
          await Transaction.create({ ...senderTrx, username: m.username });
      }
    } else await Transaction.create(senderTrx);

    if (!isMerchant && jointReceiverAcc) {
      for (let m of jointReceiverAcc.members) {
        if (m.status === "active")
          await Transaction.create({ ...receiverTrx, username: m.username });
      }
    } else {
      await Transaction.create(receiverTrx);
    }

    // ------------------------------------------
    // ច. ការផ្តល់ដំណឹង (Notifications / Socket / Telegram)
    // ------------------------------------------
    const currencySymbol = isReceiverKHR ? "៛" : "$";
    const senderMsgName = jointSenderAcc
      ? `គណនីរួម ${jointSenderAcc.accountName}`
      : finalSenderName;

    const rDoc = await User.findOne({ username: receiver.username });
    if (rDoc) {
      rDoc.notifications = rDoc.notifications || [];
      rDoc.notifications.push({
        title: isMerchant
          ? "ទទួលបានទឹកប្រាក់ពីហាង! 🏪"
          : "ទទួលបានទឹកប្រាក់! 💸",
        message: isMerchant
          ? `ហាង ${finalReceiverName} ទទួលបាន ${currencySymbol}${receiverAmount.toLocaleString()} ពី ${senderMsgName}។`
          : `អ្នកទទួលបាន ${currencySymbol}${receiverAmount.toLocaleString()} ពី ${senderMsgName}។`,
        type: "transfer_receive",
        date,
        isRead: false,
      });
      rDoc.markModified("notifications");
      await rDoc.save();

      if (bot && bot.sendUserPaymentAlert) {
        bot.sendUserPaymentAlert(rDoc._id, {
          amount: receiverAmount,
          currency: isReceiverKHR ? "KHR" : "USD",
          senderName: senderMsgName,
          refId: sharedRefId,
        });
      }
    }

    // ------------------------------------------
    // 🟢 កែតម្រូវប្រព័ន្ធ Socket.io (លោតសំឡេង និង Refresh ប្រវត្តិ)
    // ------------------------------------------
    const io = req.app.get("io") || global.io; // ប្រើមួយណាក៏បានឲ្យតែស្គាល់
    if (io) {
      const socketPayload = {
        amount: receiverAmount,
        currency: isReceiverKHR ? "KHR" : "USD",
        senderName: finalSenderName,
      };

      const targetSocketUser = isMerchant
        ? receiverMerchant.userId
        : receiver.username;

      // ១. បាញ់ទៅប្រាប់ POS/ទូរស័ព្ទថៅកែ ឲ្យបន្លឺសំឡេង "ទទួលបាន..." និងលោត Notification
      io.to(targetSocketUser).emit("paymentReceived", socketPayload);

      // ២. បាញ់ទៅប្រាប់ទាំងសងខាង (អ្នកផ្ញើ និង អ្នកទទួល) ឲ្យ Refresh ទាញប្រវត្តិថ្មីភ្លាមៗ
      io.to(targetSocketUser).emit("transactionUpdated");
      io.to(senderUsername).emit("transactionUpdated");
    }

    if (isMerchant && bot && bot.sendMerchantPaymentAlert) {
      bot
        .sendMerchantPaymentAlert(receiverMerchant._id, {
          amount: receiverAmount,
          currency: isReceiverKHR ? "KHR" : "USD",
          senderName: finalSenderName,
          refId: sharedRefId,
        })
        .catch((err) => console.log(""));
    }

    try {
      if (
        orderId &&
        isMerchant &&
        receiverMerchant &&
        receiverMerchant.webhookUrl
      ) {
        const webhookPayload = {
          orderId: orderId,
          amount: receiverAmount,
          status: "PAID",
          upayTransactionId: sharedRefId,
        };
        axios
          .post(receiverMerchant.webhookUrl, webhookPayload)
          .catch((err) => console.log(""));
      }
    } catch (webhookErr) {}

    const updatedSender = await User.findOne({ username: senderUsername });

    // 🔥 ឆ្លើយតបធម្មតា មិនបាច់មាន extraSlip ទៀតទេ ព្រោះយើងទាញយកពី Database ១០០% នៅ Frontend
    res.json({
      success: true,
      newBalance: isSenderKHR
        ? updatedSender.balanceKHR
        : updatedSender.balance,
      slipData: senderTrx,
      user: updatedSender,
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
    if (data.success) res.json({ success: true, billData: data.bill });
    else
      res.json({
        success: false,
        message: data.message || "រកមិនឃើញវិក្កយបត្រនេះទេ!",
      });
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
        senderName: payingUser.fullName || payingUser.username,
        receiverName: company,
        senderAcc: payingUser.accountNumber,
        receiverAcc: bill_id,
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
  if (req.user.username !== username)
    return res
      .status(403)
      .json({ success: false, message: "បម្រាមសុវត្ថិភាព!" });

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

        const finalReceiverName = user.fullName || user.username;

        user.balance += reward;
        centralBank.balance -= reward;

        await Transaction.create([
          {
            username: user.username,
            refId: sharedRefId,
            hash: sharedHash,
            date,
            type: "Cashback Reward",
            amount: reward,
            currency: "USD",
            fee: 0,
            senderName: "U-Pay Cashback Reward",
            receiverName: finalReceiverName,
            remark: sharedRemark,
            status: "Success",
            device: "App",
            ip: req.ip || "127.0.0.1",
          },
          {
            username: centralBank.username,
            refId: sharedRefId,
            hash: sharedHash,
            date,
            type: "Cashback Payout",
            amount: -reward,
            currency: "USD",
            fee: 0,
            senderName: "U-Pay Cashback Reward",
            receiverName: finalReceiverName,
            remark: sharedRemark,
            status: "Success",
            device: "System",
            ip: "127.0.0.1",
          },
        ]);
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
// 🚀 ៦. មុខងារទាមទាររង្វាន់ប្រូម៉ូកូដ (Redeem Promo)
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
    const sharedRefId = "PRM-" + Date.now().toString().slice(-10);
    const sharedRemark = `Claimed Promo Code: ${promo.code}`;

    const finalReceiverName = user.fullName || user.username;

    await Transaction.create([
      {
        username: user.username,
        refId: sharedRefId,
        hash: sharedHash,
        date,
        type: "Promo Reward",
        amount: rewardAmt,
        currency: "USD",
        fee: 0,
        senderName: "U-Pay Promo Reward",
        receiverName: finalReceiverName,
        remark: sharedRemark,
        status: "Success",
        trxMethod: "U-Pay Promo",
      },
      {
        username: centralBank.username,
        refId: sharedRefId,
        hash: sharedHash,
        date,
        type: "Promo Expense",
        amount: -rewardAmt,
        currency: "USD",
        fee: 0,
        senderName: "U-Pay Promo Reward",
        receiverName: finalReceiverName,
        remark: sharedRemark,
        status: "Success",
        trxMethod: "U-Pay Promo",
      },
    ]);

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
    const currentFXRates = readFXRates();
    const giftAmount = parseFloat(amount);

    const sender = await User.findOne({ username: senderUsername });
    if (!sender)
      return res.json({ success: false, message: "រកមិនឃើញគណនីរបស់អ្នកទេ" });
    if (sender.isFrozen)
      return res.json({ success: false, message: "គណនីរបស់អ្នកត្រូវបានបង្កក" });

    if (sender.pin !== pin) {
      sender.pinAttempts = (sender.pinAttempts || 0) + 1;
      if (sender.pinAttempts >= 3) {
        sender.isFrozen = true;
        await sender.save();
        return res.json({
          success: false,
          message: "ខុស PIN ៣ដង! គណនីត្រូវបានបង្កក។",
        });
      }
      await sender.save();
      return res.json({
        success: false,
        message: `លេខកូដ PIN មិនត្រឹមត្រូវទេ! នៅសល់ ${3 - sender.pinAttempts} ដង។`,
      });
    }
    sender.pinAttempts = 0;

    let finalDeduction = giftAmount;
    let sourceCurrency = "USD";
    let actualSenderAccNum = sender.accountNumber;
    let isSenderSubAccount = false;
    let senderSubIndex = -1;
    let jointSenderAcc = null;

    if (senderAccount === "MAIN_KHR") {
      sourceCurrency = "KHR";
      actualSenderAccNum = sender.accountNumberKHR;
    } else if (senderAccount !== "MAIN_USD") {
      senderSubIndex = sender.subAccounts.findIndex(
        (a) => a.accountNumber === senderAccount,
      );
      if (senderSubIndex === -1)
        return res.json({
          success: false,
          message: "គណនីប្រភពមិនត្រឹមត្រូវទេ",
        });

      isSenderSubAccount = true;
      const sub = sender.subAccounts[senderSubIndex];
      sourceCurrency = sub.currency;
      actualSenderAccNum = sub.accountNumber;

      if (sub.accountType === "joint" || sub.accountType === "joint_member") {
        jointSenderAcc = await JointAccount.findOne({
          accountId: sub.accountId,
        });
        if (!jointSenderAcc)
          return res.json({ success: false, message: "រកគណនីរួមនេះមិនឃើញទេ!" });
      }
    }

    if (sourceCurrency !== currency) {
      if (sourceCurrency === "USD" && currency === "KHR")
        finalDeduction = giftAmount / currentFXRates.usdToKhrSell;
      if (sourceCurrency === "KHR" && currency === "USD")
        finalDeduction = giftAmount * currentFXRates.usdToKhrBuy;
    }

    let senderAvailableBal = 0;
    if (isSenderSubAccount) {
      senderAvailableBal = jointSenderAcc
        ? jointSenderAcc.balance
        : sender.subAccounts[senderSubIndex].balance;
    } else {
      senderAvailableBal =
        sourceCurrency === "KHR" ? sender.balanceKHR || 0 : sender.balance;
    }

    if (senderAvailableBal < finalDeduction) {
      return res.json({ success: false, message: "សមតុល្យមិនគ្រប់គ្រាន់ទេ" });
    }

    if (isSenderSubAccount) {
      if (jointSenderAcc) {
        jointSenderAcc.balance -= finalDeduction;
        await jointSenderAcc.save();
      } else {
        sender.subAccounts[senderSubIndex].balance -= finalDeduction;
        sender.markModified("subAccounts");
      }
    } else if (senderAccount === "MAIN_KHR") {
      sender.balanceKHR -= finalDeduction;
    } else {
      sender.balance -= finalDeduction;
    }

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

    let receiverSubIndex = receiver.subAccounts.findIndex(
      (acc) => acc.accountNumber === receiverInput,
    );
    let actualReceiverAccNum = receiver.accountNumber;
    let jointReceiverAcc = null;

    if (receiverSubIndex !== -1) {
      actualReceiverAccNum = receiverInput;
      const targetSubAcc = receiver.subAccounts[receiverSubIndex];
      let targetCur = targetSubAcc.currency;
      let receiveAmt = giftAmount;

      if (currency === "USD" && targetCur === "KHR")
        receiveAmt = receiveAmt * currentFXRates.usdToKhrBuy;
      if (currency === "KHR" && targetCur === "USD")
        receiveAmt = receiveAmt / currentFXRates.usdToKhrSell;

      if (
        targetSubAcc.accountType === "joint" ||
        targetSubAcc.accountType === "joint_member"
      ) {
        jointReceiverAcc = await JointAccount.findOne({
          accountId: targetSubAcc.accountId,
        });
        if (jointReceiverAcc) {
          jointReceiverAcc.balance += receiveAmt;
          await jointReceiverAcc.save();
        }
      } else {
        targetSubAcc.balance += receiveAmt;
        receiver.markModified("subAccounts");
      }
    } else {
      if (receiverInput === receiver.accountNumberKHR) {
        actualReceiverAccNum = receiver.accountNumberKHR;
        receiver.balanceKHR = (receiver.balanceKHR || 0) + giftAmount;
      } else {
        receiver.balance += giftAmount;
      }
    }

    const dateStr = new Date().toLocaleString("en-US", {
      timeZone: "Asia/Phnom_Penh",
      hour12: true,
    });
    const sharedRefId = "GIFT" + Date.now().toString().slice(-6);
    const sharedHash = Math.random().toString(36).substring(2, 11);
    const sharedRemark = message || "E-Gift";

    const finalSenderName = jointSenderAcc
      ? jointSenderAcc.accountName
      : sender.fullName || sender.username;
    const finalReceiverName = jointReceiverAcc
      ? jointReceiverAcc.accountName
      : receiver.fullName || receiver.username;

    const senderTrx = {
      username: sender.username,
      refId: sharedRefId,
      hash: sharedHash,
      type: "E-Gift Sent",
      amount: -finalDeduction,
      currency: sourceCurrency,
      senderName: finalSenderName,
      receiverName: finalReceiverName,
      senderAcc: actualSenderAccNum,
      receiverAcc: actualReceiverAccNum,
      trxMethod: "U-Pay App",
      date: dateStr,
      remark: sharedRemark,
      status: "Completed",
    };

    const receiverTrx = {
      username: receiver.username,
      refId: sharedRefId,
      hash: sharedHash,
      type: "E-Gift Received",
      amount: giftAmount,
      currency: currency,
      senderName: finalSenderName,
      receiverName: finalReceiverName,
      senderAcc: actualSenderAccNum,
      receiverAcc: actualReceiverAccNum,
      trxMethod: "U-Pay App",
      date: dateStr,
      remark: sharedRemark,
      status: "Completed",
    };

    if (jointSenderAcc) {
      for (let m of jointSenderAcc.members) {
        if (m.status === "active")
          await Transaction.create({ ...senderTrx, username: m.username });
      }
    } else {
      await Transaction.create(senderTrx);
    }

    if (jointReceiverAcc) {
      for (let m of jointReceiverAcc.members) {
        if (m.status === "active")
          await Transaction.create({ ...receiverTrx, username: m.username });
      }
    } else {
      await Transaction.create(receiverTrx);
    }

    const senderMsgName = jointSenderAcc
      ? `គណនីរួម ${jointSenderAcc.accountName}`
      : finalSenderName;

    const giftNotification = {
      title: "មានកាដូថ្មី! 🎁",
      message: `អ្នកទទួលបានអាំងប៉ាវពី ${senderMsgName}។ ចុចដើម្បីបើកមើល!`,
      type: "egift_receive",
      date: dateStr,
      isRead: false,
      egiftData: {
        amount: giftAmount,
        currency: currency,
        theme: theme,
        message: message,
        senderName: finalSenderName,
        senderUsername: sender.username,
      },
    };

    if (jointReceiverAcc) {
      for (let m of jointReceiverAcc.members) {
        if (m.status === "active") {
          const uDoc = await User.findOne({ username: m.username });
          if (uDoc) {
            uDoc.notifications = uDoc.notifications || [];
            uDoc.notifications.push(giftNotification);
            uDoc.markModified("notifications");
            await uDoc.save();
          }
        }
      }
    } else {
      receiver.notifications = receiver.notifications || [];
      receiver.notifications.push(giftNotification);
      receiver.markModified("notifications");
      await receiver.save();
    }

    await sender.save();

    let newBalanceRes = 0;
    if (isSenderSubAccount) {
      newBalanceRes = jointSenderAcc
        ? jointSenderAcc.balance
        : sender.subAccounts[senderSubIndex].balance;
    } else if (senderAccount === "MAIN_KHR") {
      newBalanceRes = sender.balanceKHR;
    } else {
      newBalanceRes = sender.balance;
    }

    const io = req.app.get("io");
    if (io) {
      const socketPayload = {
        amount: giftAmount,
        currency: currency,
        senderName: finalSenderName,
        isGift: true,
      };

      if (jointReceiverAcc) {
        for (let m of jointReceiverAcc.members) {
          if (m.status === "active") {
            io.to(m.username).emit("paymentReceived", socketPayload);
          }
        }
      } else {
        io.to(receiver.username).emit("paymentReceived", socketPayload);
      }
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
// 🔔 ៨. មុខងារបញ្ជាក់ការបើកអាំងប៉ាវ (E-Gift Opened)
// ==========================================
const egiftOpened = async (req, res) => {
  const { receiverName, senderUsername, notifId } = req.body;
  try {
    if (notifId && req.user) {
      await User.updateOne(
        { username: req.user.username, "notifications._id": notifId },
        { $set: { "notifications.$.isRead": true } },
      );
    }

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

        sender.notifications = sender.notifications || [];
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

// ==========================================
// 🤖 ៩. មុខងារ B2B Transfer (សម្រាប់ U-Mall បាញ់លុយចូល)
// ==========================================
const b2bTransfer = async (req, res) => {
  try {
    const crypto = require("crypto");
    const { merchantId, referenceId, amount, receiverAccount, description } =
      req.body;
    const signature = req.headers["x-signature"];
    const timestamp = req.headers["x-timestamp"];

    // ១. ផ្ទៀងផ្ទាត់សុវត្ថិភាព (HMAC Signature)
    const UPAY_SECRET =
      process.env.UPAY_API_SECRET ||
      "edb7169d82f2ba03eccc06e5d57e3576e2672979bfeea8834a963a60fa515786";
    const dataToSign = JSON.stringify(req.body) + (timestamp || "");
    const expectedSig = crypto
      .createHmac("sha256", UPAY_SECRET)
      .update(dataToSign)
      .digest("hex");

    if (signature !== expectedSig) {
      return res.status(401).json({
        success: false,
        message: "ហត្ថលេខាពី U-Mall មិនត្រឹមត្រូវទេ!",
      });
    }

    // ២. ស្វែងរក Profile ហាង (Merchant) របស់ U-Mall
    const merchantProfile = await Merchant.findOne({ merchantId: merchantId });
    if (!merchantProfile) {
      return res.status(404).json({
        success: false,
        message: `រកមិនឃើញគណនី Merchant: ${merchantId} ទេ!`,
      });
    }

    // ទាញយកលេខគណនីដែល U-Mall បានភ្ជាប់ (Linked Account)
    const senderAccNumber = merchantProfile.linkedAccounts.USD;
    if (!senderAccNumber) {
      return res.status(400).json({
        success: false,
        message:
          "Merchant របស់ U-Mall មិនទាន់បានភ្ជាប់គណនី USD (Linked Account) ទេ!",
      });
    }

    // ៣. ស្វែងរកកុងធនាគាររបស់ម្ចាស់ U-Mall នៅក្នុង User Collection
    const sender = await User.findOne({ username: merchantProfile.userId });
    if (!sender) {
      return res.status(404).json({
        success: false,
        message: "រកកុងធនាគារគោលរបស់ U-Mall មិនឃើញទេ!",
      });
    }

    // ៤. ដំណើរការកាត់លុយ "ចំគណនីដែលបានភ្ជាប់"
    let isSenderDeducted = false;

    if (sender.accountNumber === senderAccNumber) {
      if (sender.balance < parseFloat(amount)) {
        return res.status(400).json({
          success: false,
          message: `គណនី U-Mall (${senderAccNumber}) ខ្វះប្រាក់!`,
        });
      }
      sender.balance -= parseFloat(amount);
      isSenderDeducted = true;
    } else {
      const subAcc = sender.subAccounts.find(
        (sub) => sub.accountNumber === senderAccNumber,
      );
      if (subAcc) {
        if (subAcc.balance < parseFloat(amount)) {
          return res.status(400).json({
            success: false,
            message: `គណនីរង U-Mall (${senderAccNumber}) ខ្វះប្រាក់!`,
          });
        }
        subAcc.balance -= parseFloat(amount);
        sender.markModified("subAccounts");
        isSenderDeducted = true;
      }
    }

    if (!isSenderDeducted) {
      return res.status(400).json({
        success: false,
        message: `រកមិនឃើញលេខគណនី ${senderAccNumber} នៅក្នុង User នេះទេ!`,
      });
    }

    await sender.save();

    // ៥. ស្វែងរក និង បូកលុយចូលគណនីអ្នកលក់ (Seller)
    const receiver = await User.findOne({
      $or: [
        { accountNumber: receiverAccount },
        { "subAccounts.accountNumber": receiverAccount },
      ],
    });

    if (!receiver) {
      // Rollback: បង្វិលលុយអោយ U-Mall វិញបើរកអ្នកទទួលមិនឃើញ
      if (sender.accountNumber === senderAccNumber) {
        sender.balance += parseFloat(amount);
      } else {
        const subAcc = sender.subAccounts.find(
          (sub) => sub.accountNumber === senderAccNumber,
        );
        if (subAcc) subAcc.balance += parseFloat(amount);
        sender.markModified("subAccounts");
      }
      await sender.save();
      return res.status(404).json({
        success: false,
        message: "រកគណនីអ្នកលក់មិនឃើញ! ប្រាក់ត្រូវបានបង្វិលចូល U-Mall វិញ។",
      });
    }

    if (receiver.accountNumber === receiverAccount) {
      receiver.balance += parseFloat(amount);
    } else {
      const rSub = receiver.subAccounts.find(
        (sub) => sub.accountNumber === receiverAccount,
      );
      if (rSub) {
        rSub.balance += parseFloat(amount);
        receiver.markModified("subAccounts");
      }
    }
    await receiver.save();

    // 🌟 ៦. បង្កើតលេខ ID ថ្មីៗ និងខ្លីៗតាមការស្នើសុំ 🌟
    const dateStr = new Date().toLocaleString("en-US", {
      timeZone: "Asia/Phnom_Penh",
      hour12: true,
    });

    // បង្កើតលេខ Hash ៨ខ្ទង់ លាយអក្សរនិងលេខ (ឧ. rxh8222e)
    const generateShortHash = () => {
      const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
      let result = "";
      for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    };
    const shortHash = generateShortHash();

    // បង្កើតលេខ Ref ID មាន B2B ពីមុខ (ឧ. B2B-895421457)
    const shortRefId =
      "B2B-" + Math.floor(100000000 + Math.random() * 900000000);

    // កត់ត្រាសម្រាប់អ្នកលក់
    await Transaction.create({
      username: receiver.username,
      refId: shortRefId, // ដាក់លេខ B2B-... ចូល
      hash: shortHash, // ដាក់លេខ ៨ខ្ទង់ចូល
      date: dateStr,
      type: "Receive",
      amount: parseFloat(amount),
      currency: "USD",
      fee: 0,
      senderName: merchantProfile.name,
      receiverName: receiver.fullName || receiver.username,
      receiverAcc: receiverAccount,
      trxMethod: "B2B Gateway",
      remark: description || "ទូទាត់ប្រាក់ពី U-Mall",
      status: "Success",
      merchantId: merchantProfile.merchantId,
    });

    // កត់ត្រាសម្រាប់ U-Mall
    await Transaction.create({
      username: sender.username,
      refId: shortRefId, // ដាក់លេខ B2B-... ចូល
      hash: shortHash, // ដាក់លេខ ៨ខ្ទង់ចូល
      date: dateStr,
      type: "Transfer",
      amount: parseFloat(amount),
      currency: "USD",
      fee: 0,
      senderName: merchantProfile.name,
      receiverName: receiver.fullName || receiver.username,
      receiverAcc: receiverAccount,
      trxMethod: "B2B Gateway",
      remark: "បើកប្រាក់អោយ Seller: " + receiverAccount,
      status: "Success",
      merchantId: merchantProfile.merchantId,
    });

    // ៧. ឆ្លើយតបទៅ U-Mall វិញ
    res.json({
      success: true,
      transactionId: shortRefId, // 👈 ប្តូរត្រង់នេះ ដើម្បីឱ្យ U-Mall ទទួលបានលេខ B2B-...
      message: "ផ្ទេរប្រាក់ B2B ជោគជ័យ និងបានកាត់ប្រាក់រួចរាល់!",
    });
  } catch (error) {
    console.error("B2B API Error:", error);
    res.status(500).json({ success: false, message: "U-Pay Server Error" });
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
  b2bTransfer,
};
