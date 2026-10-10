// controllers/transactionController.js

/**
 * ============================================================================
 * 💸 TRANSACTION CONTROLLER (CENTRAL HUB)
 * ============================================================================
 * តួនាទី (Role): ឯកសារនេះគ្រប់គ្រងប្រតិបត្តិការហិរញ្ញវត្ថុទាំងអស់នៅក្នុងប្រព័ន្ធ U-Pay
 * រួមមាន៖ ការផ្ទេរប្រាក់, បង់វិក្កយបត្រ, ទទួលរង្វាន់, ផ្ញើអាំងប៉ាវ និង B2B Escrow Transfer។
 * [បានអាប់ដេតគាំទ្រទម្រង់ User.js ថ្មី ១០០%]
 * ============================================================================
 */

// ==========================================
// 📦 ១. នាំចូលម៉ូឌុល និងឯកសារដែលចាំបាច់ (Imports)
// ==========================================
const User = require("../models/User");
const System = require("../models/System");
const PromoCode = require("../models/PromoCode");
const Merchant = require("../models/Merchant");
const mongoose = require("mongoose");
const Transaction = require("../models/Transaction");
const JointAccount = require("../models/JointAccount");
const Notification = require("../models/Notification");
const bot = require("../services/telegramBot");
const crypto = require("crypto");

const { getFormattedDate } = require("../services/helpers");
const { readFXRates } = require("../services/systemService");

// ==========================================
// 🛠️ ២. Function ជំនួយ (Helpers) សម្រាប់លេខ Hash & Ref ID
// ==========================================
const generateStandardHash = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 10; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const generateStandardRefId = (prefix) => {
  const random8Digits = Math.floor(10000000 + Math.random() * 90000000);
  return `${prefix}-${random8Digits}`;
};

// ==========================================
// 🔍 ៣. មុខងារឆែកឈ្មោះគណនីមុនពេលវេរលុយ (Check Account)
// ==========================================
const checkAccount = async (req, res) => {
  const { accountNumber } = req.body;
  try {
    // ស្វែងរកគណនី (គាំទ្រទាំង Main USD, Main KHR, Sub-Accounts និងកុងចាស់)
    let target = await User.findOne({
      $or: [
        { "mainAccounts.USD.accountNumber": accountNumber },
        { "mainAccounts.KHR.accountNumber": accountNumber },
        { accountNumber: accountNumber }, // Legacy Support
        { accountNumberKHR: accountNumber }, // Legacy Support
        { "subAccounts.accountNumber": accountNumber },
      ],
    });

    let isMerchant = false;
    let targetName = "";
    let isReceiverKHR = false;

    // ករណីរកមិនឃើញ User ធម្មតា, ឆែកមើលក្រែងលោជាកុងហាង (Merchant)
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
      // ករណីជាគណនី User ធម្មតា
      if (target.role === "junior") {
        let childName = target.fullName || target.username;
        targetName = childName.toUpperCase() + " (JUNIOR)";
        if (
          (target.mainAccounts?.KHR?.accountNumber ||
            target.accountNumberKHR) === accountNumber
        ) {
          isReceiverKHR = true;
        }
      } else {
        targetName = target.fullName || target.username;
        if (
          (target.mainAccounts?.KHR?.accountNumber ||
            target.accountNumberKHR) === accountNumber
        ) {
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
// 💸 ៤. មុខងារវេរលុយ (Transfer)
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
      return res.json({ success: false, message: "Account Frozen by Admin" });

    // ផ្ទៀងផ្ទាត់ PIN Code
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
    sender.pinAttempts = 0; // Reset PIN ក្រោយពេលវាយត្រូវ

    // ស្វែងរកគណនីអ្នកទទួល
    let receiver = await User.findOne({
      $or: [
        { "mainAccounts.USD.accountNumber": receiverAccount },
        { "mainAccounts.KHR.accountNumber": receiverAccount },
        { accountNumber: receiverAccount },
        { accountNumberKHR: receiverAccount },
        { "subAccounts.accountNumber": receiverAccount },
      ],
    });

    let receiverMerchant = null;
    let isMerchant = false;
    let cashierInfo = null;
    let finalReceiverName = "";
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

    // 🌟 កំណត់គណនីប្រភពរបស់អ្នកផ្ញើ
    let actualSenderAccNum = senderAccount;
    if (
      senderAccount === "MAIN_USD" ||
      senderAccount === sender.mainAccounts?.USD?.accountNumber
    ) {
      actualSenderAccNum =
        sender.mainAccounts?.USD?.accountNumber || sender.accountNumber;
    } else if (
      senderAccount === "MAIN_KHR" ||
      senderAccount === sender.mainAccounts?.KHR?.accountNumber
    ) {
      actualSenderAccNum =
        sender.mainAccounts?.KHR?.accountNumber || sender.accountNumberKHR;
    } else {
      senderSubIndex = sender.subAccounts.findIndex(
        (acc) => acc.accountNumber === senderAccount,
      );
      if (senderSubIndex !== -1) isSenderSubAccount = true;
    }

    // ឆែកមើលបើសិនអ្នកទទួលជាហាង (Merchant)
    if (isMerchant) {
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

    // ការគណនាថ្លៃសេវា (Fee) និងអត្រាប្តូរប្រាក់ (FX Rate)
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

    // 🌟 ការទាញយកសមតុល្យអ្នកផ្ញើ (Sender Balance)
    if (isSenderSubAccount) {
      const sType = sender.subAccounts[senderSubIndex].accountType;
      if (sType === "joint" || sType === "joint_member") {
        jointSenderAcc = await JointAccount.findOne({
          accountId: sender.subAccounts[senderSubIndex].accountId,
        });
        senderAvailableBal = jointSenderAcc ? jointSenderAcc.balance : 0;
      } else if (sType === "junior") {
        juniorSenderAcc = await User.findOne({
          $or: [
            { "mainAccounts.USD.accountNumber": senderAccount },
            { accountNumber: senderAccount },
          ],
        });
        if (juniorSenderAcc) {
          const dailyLimit =
            juniorSenderAcc.mainAccounts?.USD?.dailyLimit ||
            juniorSenderAcc.trxLimit ||
            0;
          const dailySpent =
            juniorSenderAcc.mainAccounts?.USD?.dailySpent ||
            juniorSenderAcc.dailySpent ||
            0;
          if (dailyLimit > 0 && dailySpent + totalDeduction > dailyLimit) {
            return res.json({
              success: false,
              message: "ប្រតិបត្តិការបរាជ័យ! ចាយលើសដែនកំណត់។",
            });
          }
          senderAvailableBal = isSenderKHR
            ? juniorSenderAcc.mainAccounts?.KHR?.balance ||
              juniorSenderAcc.balanceKHR ||
              0
            : juniorSenderAcc.mainAccounts?.USD?.balance ||
              juniorSenderAcc.balance ||
              0;
        }
      } else {
        senderAvailableBal = sender.subAccounts[senderSubIndex].balance;
      }
    } else {
      senderAvailableBal = isSenderKHR
        ? sender.mainAccounts?.KHR?.balance || sender.balanceKHR || 0
        : sender.mainAccounts?.USD?.balance || sender.balance || 0;
    }

    if (senderAvailableBal < totalDeduction)
      return res.json({ success: false, message: "សមតុល្យមិនគ្រប់គ្រាន់" });

    // 🌟 ការកាត់លុយពីអ្នកផ្ញើ (Deduct Funds)
    if (isSenderSubAccount) {
      if (jointSenderAcc) {
        jointSenderAcc.balance -= totalDeduction;
        await jointSenderAcc.save();
      } else if (juniorSenderAcc) {
        if (isSenderKHR) {
          if (juniorSenderAcc.mainAccounts?.KHR)
            juniorSenderAcc.mainAccounts.KHR.balance -= totalDeduction;
          else juniorSenderAcc.balanceKHR -= totalDeduction;
        } else {
          if (juniorSenderAcc.mainAccounts?.USD)
            juniorSenderAcc.mainAccounts.USD.balance -= totalDeduction;
          else juniorSenderAcc.balance -= totalDeduction;
        }

        if (juniorSenderAcc.mainAccounts?.USD)
          juniorSenderAcc.mainAccounts.USD.dailySpent += totalDeduction;
        else
          juniorSenderAcc.dailySpent =
            (juniorSenderAcc.dailySpent || 0) + totalDeduction;

        juniorSenderAcc.markModified("mainAccounts");
        await juniorSenderAcc.save();
      } else {
        sender.subAccounts[senderSubIndex].balance -= totalDeduction;
        sender.markModified("subAccounts");
      }
    } else {
      if (isSenderKHR) {
        if (sender.mainAccounts?.KHR)
          sender.mainAccounts.KHR.balance -= totalDeduction;
        else sender.balanceKHR -= totalDeduction;
      } else {
        if (sender.mainAccounts?.USD)
          sender.mainAccounts.USD.balance -= totalDeduction;
        else sender.balance -= totalDeduction;
      }
      sender.markModified("mainAccounts");
    }

    let receiverAmount = transferAmount;
    let isReceiverKHR = false;
    let jointReceiverAcc = null;

    // 🌟 ការបញ្ចូលលុយទៅអ្នកទទួល (Add Funds)
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
        if (
          actualOwnerAccNum === owner.mainAccounts?.USD?.accountNumber ||
          actualOwnerAccNum === owner.accountNumber
        ) {
          if (owner.mainAccounts?.USD)
            owner.mainAccounts.USD.balance += receiverAmount;
          else owner.balance += receiverAmount;
        } else if (
          actualOwnerAccNum === owner.mainAccounts?.KHR?.accountNumber ||
          actualOwnerAccNum === owner.accountNumberKHR
        ) {
          if (owner.mainAccounts?.KHR)
            owner.mainAccounts.KHR.balance += receiverAmount;
          else owner.balanceKHR = (owner.balanceKHR || 0) + receiverAmount;
        } else {
          const sub = owner.subAccounts.find(
            (s) => s.accountNumber === actualOwnerAccNum,
          );
          if (sub) {
            sub.balance += receiverAmount;
            owner.markModified("subAccounts");
          } else {
            if (isReceiverKHR) {
              if (owner.mainAccounts?.KHR)
                owner.mainAccounts.KHR.balance += receiverAmount;
              else owner.balanceKHR = (owner.balanceKHR || 0) + receiverAmount;
            } else {
              if (owner.mainAccounts?.USD)
                owner.mainAccounts.USD.balance += receiverAmount;
              else owner.balance += receiverAmount;
            }
          }
        }
        owner.markModified("mainAccounts");
        await owner.save();
        receiver = owner;
      }
    } else {
      let targetSubAccIndex = receiver.subAccounts.findIndex(
        (acc) => acc.accountNumber === receiverAccount,
      );
      if (
        receiver.mainAccounts?.KHR?.accountNumber === receiverAccount ||
        receiver.accountNumberKHR === receiverAccount
      ) {
        isReceiverKHR = true;
      } else if (targetSubAccIndex !== -1) {
        isReceiverKHR =
          receiver.subAccounts[targetSubAccIndex].currency === "KHR";
      }

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
        }
      } else {
        if (isReceiverKHR) {
          if (receiver.mainAccounts?.KHR)
            receiver.mainAccounts.KHR.balance += receiverAmount;
          else
            receiver.balanceKHR = (receiver.balanceKHR || 0) + receiverAmount;
        } else {
          if (receiver.mainAccounts?.USD)
            receiver.mainAccounts.USD.balance += receiverAmount;
          else receiver.balance = (receiver.balance || 0) + receiverAmount;
        }
        receiver.markModified("mainAccounts");
      }
      await receiver.save();
    }

    await sender.save();

    // ------------------------------------------
    // 📝 ង. កត់ត្រាប្រវត្តិ (Transaction Logging)
    // ------------------------------------------
    const date = new Date().toLocaleString("en-US", {
      timeZone: "Asia/Phnom_Penh",
      hour12: true,
    });
    const sharedRefId = generateStandardRefId("TRX");
    const sharedHash = generateStandardHash();

    const finalSenderName = jointSenderAcc
      ? jointSenderAcc.accountName
      : sender.fullName || sender.username;

    const senderTrx = {
      userId: sender._id,
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

    const receiverTrx = {
      userId: isMerchant ? undefined : receiver._id,
      refId: sharedRefId,
      hash: sharedHash,
      date,
      type: "Receive",
      amount: receiverAmount,
      currency: isReceiverKHR ? "KHR" : "USD",
      fee: 0,
      senderName: finalSenderName,
      receiverName: finalReceiverName,
      receiverAcc: actualLinkedAccountForBalance,
      senderAcc: actualSenderAccNum,
      trxMethod: isMerchant
        ? "Merchant Payment"
        : trxMethod || "Account Transfer",
      remark: remark || "General",
      status: "Success",
      username: isMerchant ? receiverMerchant.userId : receiver.username,
      merchantId: isMerchant ? receiverMerchant.merchantId : undefined,
    };

    if (isMerchant && receiver) receiverTrx.userId = receiver._id;

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
    // 🔔 ច. ការផ្តល់ដំណឹង (Notifications / Socket)
    // ------------------------------------------
    const currencySymbol = isReceiverKHR ? "៛" : "$";
    const senderMsgName = jointSenderAcc
      ? `គណនីរួម ${jointSenderAcc.accountName}`
      : finalSenderName;

    if (receiver) {
      await Notification.create({
        userId: receiver._id,
        username: receiver.username,
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
      if (bot && bot.sendUserPaymentAlert) {
        bot.sendUserPaymentAlert(receiver._id, {
          amount: receiverAmount,
          currency: isReceiverKHR ? "KHR" : "USD",
          senderName: senderMsgName,
          refId: sharedRefId,
        });
      }
    }

    const io = req.app.get("io") || global.io;
    if (io) {
      const socketPayload = {
        amount: receiverAmount,
        currency: isReceiverKHR ? "KHR" : "USD",
        senderName: finalSenderName,
      };
      const targetSocketUser = isMerchant
        ? receiverMerchant.userId
        : receiver.username;
      io.to(targetSocketUser).emit("paymentReceived", socketPayload);
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
        .catch(() => {});
    }

    const updatedSender = await User.findOne({ username: senderUsername });

    res.json({
      success: true,
      newBalance: isSenderKHR
        ? updatedSender.mainAccounts?.KHR?.balance || updatedSender.balanceKHR
        : updatedSender.mainAccounts?.USD?.balance || updatedSender.balance,
      slipData: senderTrx,
      user: updatedSender,
    });
  } catch (err) {
    console.error("TRANSFER ERROR:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// ==========================================
// 🧾 ៥. មុខងារស្វែងរកវិក្កយបត្រ (Scan Bill)
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
    res
      .status(500)
      .json({ success: false, message: "មិនអាចភ្ជាប់ទៅកាន់ PayHub បានទេ!" });
  }
};

// ==========================================
// 💳 ៦. មុខងារបង់វិក្កយបត្រ (Pay Bill) - U-Pay Backend
// ==========================================
const payBankBill = async (req, res) => {
  const { bill_id, company, amount, username, senderAccount, pin } = req.body;

  try {
    let payingUser = await User.findOne({ username });
    if (!payingUser)
      return res
        .status(404)
        .json({ success: false, message: "រកមិនឃើញគណនីរបស់អ្នក!" });

    // ១. ផ្ទៀងផ្ទាត់ PIN Code
    if (payingUser.pin !== pin) {
      return res
        .status(400)
        .json({ success: false, message: "លេខកូដ PIN មិនត្រឹមត្រូវទេ!" });
    }

    const System = require("../models/System");
    const sys = await System.findOne({ settingId: "GLOBAL_SETTINGS" });
    const exchangeRate =
      sys && sys.fxRates && sys.fxRates.usdToKhrSell
        ? parseFloat(sys.fxRates.usdToKhrSell)
        : 4110;

    let isSenderKHR = false;
    let deductAmount = amount;

    // ២. កំណត់កុងដែលត្រូវកាត់លុយ និងឆែកសមតុល្យ
    if (
      payingUser.mainAccounts?.KHR?.accountNumber === senderAccount ||
      payingUser.accountNumberKHR === senderAccount
    ) {
      isSenderKHR = true;
      deductAmount = amount * exchangeRate; // បំប្លែងវិក្កយបត្រ USD ទៅ KHR ដើម្បីកាត់
    } else {
      const subAcc = payingUser.subAccounts.find(
        (s) => s.accountNumber === senderAccount,
      );
      if (subAcc && subAcc.currency === "KHR") {
        isSenderKHR = true;
        deductAmount = amount * exchangeRate;
      }
    }

    let hasEnoughBalance = false;
    // ធ្វើការកាត់លុយពីគណនីជាក់លាក់ (Main ឬ Sub)
    if (
      payingUser.mainAccounts?.USD?.accountNumber === senderAccount ||
      payingUser.accountNumber === senderAccount
    ) {
      if (
        (payingUser.mainAccounts?.USD?.balance || payingUser.balance || 0) >=
        deductAmount
      ) {
        if (payingUser.mainAccounts?.USD)
          payingUser.mainAccounts.USD.balance -= deductAmount;
        else payingUser.balance -= deductAmount;
        hasEnoughBalance = true;
      }
    } else if (
      payingUser.mainAccounts?.KHR?.accountNumber === senderAccount ||
      payingUser.accountNumberKHR === senderAccount
    ) {
      if (
        (payingUser.mainAccounts?.KHR?.balance || payingUser.balanceKHR || 0) >=
        deductAmount
      ) {
        if (payingUser.mainAccounts?.KHR)
          payingUser.mainAccounts.KHR.balance -= deductAmount;
        else payingUser.balanceKHR -= deductAmount;
        hasEnoughBalance = true;
      }
    } else {
      const sub = payingUser.subAccounts.find(
        (s) => s.accountNumber === senderAccount,
      );
      if (sub && sub.balance >= deductAmount) {
        sub.balance -= deductAmount;
        hasEnoughBalance = true;
      }
    }

    if (!hasEnoughBalance) {
      return res
        .status(400)
        .json({ success: false, message: "សមតុល្យមិនគ្រប់គ្រាន់ទេ!" });
    }

    // ៣. បូកលុយចូលគណនី PayHub ធម្មតា (ឧទាហរណ៍ 777888999) 🌟🌟🌟
    const PAYHUB_ACCOUNT_NUMBER = "777888999";
    // ស្វែងរកគណនីអ្នកទទួលលុយនេះក្នុង Database (ទោះបីជានៅ Main ឫ Legacy)
    let payhubBankUser = await User.findOne({
      $or: [
        { "mainAccounts.USD.accountNumber": PAYHUB_ACCOUNT_NUMBER },
        { accountNumber: PAYHUB_ACCOUNT_NUMBER },
      ],
    });

    if (payhubBankUser) {
      if (payhubBankUser.mainAccounts?.USD)
        payhubBankUser.mainAccounts.USD.balance += amount;
      else payhubBankUser.balance += amount;
      payhubBankUser.markModified("mainAccounts");
      await payhubBankUser.save();
    }

    // ៤. ភ្ជាប់ទៅ PayHub ដើម្បីប្តូរ Status វិក្កយបត្រ
    const currentRefId = generateStandardRefId("BIL");
    const response = await fetch("https://payhub-kh.fly.dev/api/gateway/pay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bill_id: bill_id, upay_trx_id: currentRefId }),
    });

    const payhubData = await response.json();

    if (payhubData && payhubData.success) {
      payingUser.markModified("mainAccounts");
      payingUser.markModified("subAccounts");

      const newHash = generateStandardHash();
      const dateStr = new Date().toLocaleString("en-US", {
        timeZone: "Asia/Phnom_Penh",
        hour12: true,
      });

      // ៥. កត់ត្រា History អោយអ្នកបង់លុយ (Slip ចេញឈ្មោះក្រុមហ៊ុន តែលេខកុង 777888999) 🌟🌟🌟
      await Transaction.create({
        userId: payingUser._id,
        username: payingUser.username,
        refId: currentRefId,
        hash: newHash,
        date: dateStr,
        type: "Bill Payment",
        amount: -deductAmount,
        currency: isSenderKHR ? "KHR" : "USD",
        senderName: payingUser.fullName || payingUser.username,
        receiverName: company, // 🌟 បង្ហាញឈ្មោះក្រុមហ៊ុននៅលើ Slip
        senderAcc: senderAccount,
        receiverAcc: PAYHUB_ACCOUNT_NUMBER, // 🌟 លេខគណនី PayHub 777888999
        trxMethod: "Bill Payment",
        remark: `ទូទាត់វិក្កយបត្រ: ${company}`,
        status: "Success",
      });

      // ៦. កត់ត្រា History អោយគណនី PayHub
      if (payhubBankUser) {
        await Transaction.create({
          userId: payhubBankUser._id,
          username: payhubBankUser.username,
          refId: currentRefId,
          hash: newHash,
          date: dateStr,
          type: "Bill Collection",
          amount: amount,
          currency: "USD",
          senderName: payingUser.fullName || payingUser.username,
          receiverName: "PayHub Central",
          senderAcc: senderAccount,
          receiverAcc: PAYHUB_ACCOUNT_NUMBER,
          trxMethod: "Bill Collection",
          remark: `ទទួលបានការទូទាត់វិក្កយបត្រ: ${company}`,
          status: "Success",
        });
      }

      await payingUser.save();

      // ៧. ផ្តល់ដំណឹង Notification
      const Notification = require("../models/Notification");
      await Notification.create({
        userId: payingUser._id,
        username: payingUser.username,
        title: "ទូទាត់វិក្កយបត្រជោគជ័យ! 📄",
        message: `អ្នកបានទូទាត់ទឹកប្រាក់ ${isSenderKHR ? "៛" : "$"}${parseFloat(deductAmount).toLocaleString()} ទៅកាន់ ${company} រួចរាល់។`,
        type: "payment_success",
        date: dateStr,
        isRead: false,
      });

      // ៨. Telegram Alert
      const bot = require("../services/telegramBot");
      if (typeof bot !== "undefined" && bot && bot.sendUserPaymentAlert) {
        bot
          .sendUserPaymentAlert(payingUser._id, {
            amount: -parseFloat(deductAmount),
            currency: isSenderKHR ? "KHR" : "USD",
            senderName: company,
            refId: currentRefId,
          })
          .catch(() => {});
      }

      // 🌟 បញ្ជូនទិន្នន័យត្រឡប់ទៅវិញ
      res.json({
        success: true,
        user: payingUser,
        transaction_id: currentRefId,
        hash: newHash,
      });
    } else {
      // ⚠️ បើ PayHub លោត Error យើងត្រូវសងលុយដែលកាត់មិញចូលកុងគាត់វិញ
      if (
        payingUser.mainAccounts?.USD?.accountNumber === senderAccount ||
        payingUser.accountNumber === senderAccount
      ) {
        if (payingUser.mainAccounts?.USD)
          payingUser.mainAccounts.USD.balance += deductAmount;
        else payingUser.balance += deductAmount;
      } else if (
        payingUser.mainAccounts?.KHR?.accountNumber === senderAccount ||
        payingUser.accountNumberKHR === senderAccount
      ) {
        if (payingUser.mainAccounts?.KHR)
          payingUser.mainAccounts.KHR.balance += deductAmount;
        else payingUser.balanceKHR += deductAmount;
      } else {
        const sub = payingUser.subAccounts.find(
          (s) => s.accountNumber === senderAccount,
        );
        if (sub) sub.balance += deductAmount;
      }
      res.status(400).json({
        success: false,
        message: payhubData.message || "ការទូទាត់បរាជ័យពីខាងក្រុមហ៊ុន",
      });
    }
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "មិនអាចភ្ជាប់ទៅកាន់ម៉ាស៊ីនកណ្តាលបានទេ",
    });
  }
};

// ==========================================
// 🎁 ៧. មុខងាររង្វាន់ (Lucky Spin Cashback)
// ==========================================
const rewardCashback = async (req, res) => {
  const { username, amount, refId } = req.body;
  if (req.user.username !== username)
    return res
      .status(403)
      .json({ success: false, message: "បម្រាមសុវត្ថិភាព!" });

  try {
    const user = await User.findOne({ username });
    const centralBank =
      (await User.findOne({ "mainAccounts.USD.accountNumber": "888888888" })) ||
      (await User.findOne({ accountNumber: "888888888" }));

    if (user && centralBank) {
      const reward = parseFloat(amount);
      if (reward > 0) {
        const dateStr = new Date().toLocaleString("en-US", {
          timeZone: "Asia/Phnom_Penh",
          hour12: true,
        });
        const newRefId = generateStandardRefId("RWD");

        if (user.mainAccounts?.USD) user.mainAccounts.USD.balance += reward;
        else user.balance += reward;
        user.markModified("mainAccounts");

        if (centralBank.mainAccounts?.USD)
          centralBank.mainAccounts.USD.balance -= reward;
        else centralBank.balance -= reward;
        centralBank.markModified("mainAccounts");

        await Transaction.create([
          {
            userId: user._id,
            username: user.username,
            refId: newRefId,
            hash: generateStandardHash(),
            date: dateStr,
            type: "Cashback Reward",
            amount: reward,
            currency: "USD",
            fee: 0,
            senderName: "U-Pay Rewards", // 🌟 ដូរឈ្មោះអ្នកផ្ញើអោយខ្លីស្តាប់ទៅឡូយ
            receiverName: user.fullName || user.username,
            trxMethod: "Lucky Spin", // 🌟 ថែម Payment Via
            remark: `រង្វាន់ពីការបង្វិលកងសំណាង (Ref: ${refId})`, // 🌟 ខ្មែរ Remark
            status: "Success",
            device: "App",
            ip: req.ip || "127.0.0.1",
          },
        ]);

        // 🌟 ថែម Notification អោយអតិថិជនត្រេកអរ
        await Notification.create({
          userId: user._id,
          username: user.username,
          title: "អ្នកទទួលបានរង្វាន់! 🎊",
          message: `អបអរសាទរ! ទឹកប្រាក់ $${reward.toLocaleString()} ពីការបង្វិលកងសំណាងបានបញ្ចូលទៅកាន់គណនីរបស់អ្នក។`,
          type: "reward_receive",
          date: dateStr,
          isRead: false,
        });

        // 🌟 ថែម Telegram Alert
        if (typeof bot !== "undefined" && bot && bot.sendUserPaymentAlert) {
          bot
            .sendUserPaymentAlert(user._id, {
              amount: reward,
              currency: "USD",
              senderName: "U-Pay Lucky Spin",
              refId: newRefId,
            })
            .catch(() => {});
        }

        await user.save();
        await centralBank.save();
      }
      res.json({
        success: true,
        balance: user.mainAccounts?.USD?.balance || user.balance,
      });
    } else {
      res.json({ success: false, message: "រកមិនឃើញគណនីធនាគារកណ្តាល!" });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ==========================================
// 🚀 ៨. មុខងារទាមទាររង្វាន់ប្រូម៉ូកូដ (Redeem Promo)
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

    const centralBank =
      (await User.findOne({ "mainAccounts.USD.accountNumber": "888888888" })) ||
      (await User.findOne({ accountNumber: "888888888" }));
    if (!centralBank)
      return res.json({
        success: false,
        message: "System Error: Central Bank Not Found!",
      });

    const rewardAmt = promo.rewardValue;
    const dateStr = new Date().toLocaleString("en-US", {
      timeZone: "Asia/Phnom_Penh",
      hour12: true,
    });
    const newRefId = generateStandardRefId("PRM");

    if (user.mainAccounts?.USD) user.mainAccounts.USD.balance += rewardAmt;
    else user.balance += rewardAmt;
    user.markModified("mainAccounts");

    if (centralBank.mainAccounts?.USD)
      centralBank.mainAccounts.USD.balance -= rewardAmt;
    else centralBank.balance -= rewardAmt;
    centralBank.markModified("mainAccounts");

    await Transaction.create([
      {
        userId: user._id,
        username: user.username,
        refId: newRefId,
        hash: generateStandardHash(),
        date: dateStr,
        type: "Promo Reward",
        amount: rewardAmt,
        currency: "USD",
        fee: 0,
        senderName: "U-Pay Promotions", // 🌟
        receiverName: user.fullName || user.username,
        remark: `រង្វាន់ពីការបញ្ចូលកូដ: ${promo.code}`, // 🌟 ខ្មែរ Remark
        status: "Success",
        trxMethod: "Promo Code", // 🌟
      },
    ]);

    // 🌟 ថែម Notification
    await Notification.create({
      userId: user._id,
      username: user.username,
      title: "បញ្ចូលកូដប្រូម៉ូសិនជោគជ័យ! 🎟️",
      message: `អបអរសាទរ! អ្នកទទួលបាន $${rewardAmt.toFixed(2)} ពីការបញ្ចូលកូដ ${promo.code}។`,
      type: "reward_receive",
      date: dateStr,
      isRead: false,
    });

    // 🌟 ថែម Telegram Alert
    if (typeof bot !== "undefined" && bot && bot.sendUserPaymentAlert) {
      bot
        .sendUserPaymentAlert(user._id, {
          amount: rewardAmt,
          currency: "USD",
          senderName: `Promo: ${promo.code}`,
          refId: newRefId,
        })
        .catch(() => {});
    }

    promo.usedCount += 1;
    promo.usedBy.push(username);
    await promo.save();
    await user.save();
    await centralBank.save();

    res.json({
      success: true,
      message: `អបអរសាទរ! អ្នកទទួលបាន $${rewardAmt.toFixed(2)} ពីកូដ ${promo.code}!`,
      newBalance: user.mainAccounts?.USD?.balance || user.balance,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// ==========================================
// 🧧 ៩. មុខងារផ្ញើអាំងប៉ាវ (Send E-Gift)
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
    let actualSenderAccNum = senderAccount;
    let isSenderSubAccount = false;
    let senderSubIndex = -1;
    let jointSenderAcc = null;

    if (
      senderAccount === "MAIN_USD" ||
      senderAccount === sender.mainAccounts?.USD?.accountNumber
    ) {
      sourceCurrency = "USD";
      actualSenderAccNum =
        sender.mainAccounts?.USD?.accountNumber || sender.accountNumber;
    } else if (
      senderAccount === "MAIN_KHR" ||
      senderAccount === sender.mainAccounts?.KHR?.accountNumber
    ) {
      sourceCurrency = "KHR";
      actualSenderAccNum =
        sender.mainAccounts?.KHR?.accountNumber || sender.accountNumberKHR;
    } else {
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
        sourceCurrency === "KHR"
          ? sender.mainAccounts?.KHR?.balance || sender.balanceKHR || 0
          : sender.mainAccounts?.USD?.balance || sender.balance || 0;
    }

    if (senderAvailableBal < finalDeduction)
      return res.json({ success: false, message: "សមតុល្យមិនគ្រប់គ្រាន់ទេ" });

    // 🌟 កាត់លុយ
    if (isSenderSubAccount) {
      if (jointSenderAcc) {
        jointSenderAcc.balance -= finalDeduction;
        await jointSenderAcc.save();
      } else {
        sender.subAccounts[senderSubIndex].balance -= finalDeduction;
        sender.markModified("subAccounts");
      }
    } else if (sourceCurrency === "KHR") {
      if (sender.mainAccounts?.KHR)
        sender.mainAccounts.KHR.balance -= finalDeduction;
      else sender.balanceKHR -= finalDeduction;
      sender.markModified("mainAccounts");
    } else {
      if (sender.mainAccounts?.USD)
        sender.mainAccounts.USD.balance -= finalDeduction;
      else sender.balance -= finalDeduction;
      sender.markModified("mainAccounts");
    }

    const receiver = await User.findOne({
      $or: [
        { "mainAccounts.USD.accountNumber": receiverInput },
        { "mainAccounts.KHR.accountNumber": receiverInput },
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
    let actualReceiverAccNum = receiverInput;
    let jointReceiverAcc = null;

    if (receiverSubIndex !== -1) {
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
      if (
        receiverInput === receiver.mainAccounts?.KHR?.accountNumber ||
        receiverInput === receiver.accountNumberKHR
      ) {
        if (receiver.mainAccounts?.KHR)
          receiver.mainAccounts.KHR.balance += giftAmount;
        else receiver.balanceKHR = (receiver.balanceKHR || 0) + giftAmount;
      } else {
        actualReceiverAccNum =
          receiver.mainAccounts?.USD?.accountNumber || receiver.accountNumber;
        if (receiver.mainAccounts?.USD)
          receiver.mainAccounts.USD.balance += giftAmount;
        else receiver.balance = (receiver.balance || 0) + giftAmount;
      }
      receiver.markModified("mainAccounts");
    }

    const dateStr = new Date().toLocaleString("en-US", {
      timeZone: "Asia/Phnom_Penh",
      hour12: true,
    });
    const sharedRefId = generateStandardRefId("GFT");
    const sharedHash = generateStandardHash();
    const finalSenderName = jointSenderAcc
      ? jointSenderAcc.accountName
      : sender.fullName || sender.username;
    const finalReceiverName = jointReceiverAcc
      ? jointReceiverAcc.accountName
      : receiver.fullName || receiver.username;

    const senderTrx = {
      userId: sender._id,
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
      remark: message || "E-Gift",
      status: "Completed",
    };
    const receiverTrx = {
      userId: receiver._id,
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
      remark: message || "E-Gift",
      status: "Completed",
    };

    if (jointSenderAcc) {
      for (let m of jointSenderAcc.members) {
        if (m.status === "active")
          await Transaction.create({ ...senderTrx, username: m.username });
      }
    } else await Transaction.create(senderTrx);

    if (jointReceiverAcc) {
      for (let m of jointReceiverAcc.members) {
        if (m.status === "active")
          await Transaction.create({ ...receiverTrx, username: m.username });
      }
    } else await Transaction.create(receiverTrx);

    const senderMsgName = jointSenderAcc
      ? `គណនីរួម ${jointSenderAcc.accountName}`
      : finalSenderName;

    await Notification.create({
      userId: receiver._id,
      username: receiver.username,
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
    });

    await sender.save();
    await receiver.save();

    let newBalanceRes = 0;
    if (isSenderSubAccount) {
      newBalanceRes = jointSenderAcc
        ? jointSenderAcc.balance
        : sender.subAccounts[senderSubIndex].balance;
    } else if (sourceCurrency === "KHR") {
      newBalanceRes = sender.mainAccounts?.KHR?.balance || sender.balanceKHR;
    } else {
      newBalanceRes = sender.mainAccounts?.USD?.balance || sender.balance;
    }

    const io = req.app.get("io");
    if (io) {
      const socketPayload = {
        amount: giftAmount,
        currency: currency,
        senderName: finalSenderName,
        isGift: true,
      };
      io.to(receiver.username).emit("paymentReceived", socketPayload);
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
// 🔔 ១០. មុខងារបញ្ជាក់ការបើកអាំងប៉ាវ (E-Gift Opened)
// ==========================================
const egiftOpened = async (req, res) => {
  const { receiverName, senderUsername, notifId } = req.body;
  try {
    if (notifId && req.user) {
      if (mongoose.Types.ObjectId.isValid(notifId)) {
        await Notification.findByIdAndUpdate(notifId, {
          isRead: true,
          responseStatus: "opened",
        });
      }
    }

    if (senderUsername) {
      const sender = await User.findOne({ username: senderUsername });
      if (sender) {
        await Notification.create({
          userId: sender._id,
          username: sender.username,
          title: "អាំងប៉ាវត្រូវបានបើកហើយ! 🎉",
          message: `${receiverName} បានបើកមើលអាំងប៉ាវរបស់អ្នកហើយ។`,
          type: "egift_opened",
          date: new Date().toLocaleString("en-US", {
            timeZone: "Asia/Phnom_Penh",
            hour12: true,
          }),
          isRead: false,
        });
      }
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false });
  }
};

// ==========================================
// 🤖 ១១. មុខងារ B2B Transfer (សម្រាប់ U-Mall បាញ់លុយចូល)
// ==========================================
const b2bTransfer = async (req, res) => {
  try {
    const { merchantId, referenceId, amount, receiverAccount, description } =
      req.body;
    const signature = req.headers["x-signature"];
    const timestamp = req.headers["x-timestamp"];

    // 🌟 ១. ស្វែងរក Merchant ជាមុនសិន ដើម្បីយក apiSecret ពី Database
    const merchantProfile = await Merchant.findOne({ merchantId: merchantId });
    if (!merchantProfile)
      return res.status(404).json({
        success: false,
        message: `រកមិនឃើញគណនី Merchant: ${merchantId} ទេ!`,
      });

    // 🌟 ២. ផ្ទៀងផ្ទាត់ហត្ថលេខាដោយប្រើ apiSecret របស់ Merchant ផ្ទាល់ (ដូចដែល Webhook បានធ្វើ)
    const dataToSign = JSON.stringify(req.body) + (timestamp || "");
    const expectedSig = crypto
      .createHmac("sha256", merchantProfile.apiSecret)
      .update(dataToSign)
      .digest("hex");

    if (signature !== expectedSig)
      return res.status(401).json({
        success: false,
        message: "ហត្ថលេខាពី U-Mall មិនត្រឹមត្រូវទេ (Signature Mismatch)!",
      });

    const senderAccNumber = merchantProfile.linkedAccounts.USD;
    if (!senderAccNumber)
      return res.status(400).json({
        success: false,
        message: "Merchant របស់ U-Mall មិនទាន់បានភ្ជាប់គណនី USD ទេ!",
      });

    const sender = await User.findOne({ username: merchantProfile.userId });
    if (!sender)
      return res.status(404).json({
        success: false,
        message: "រកកុងធនាគារគោលរបស់ U-Mall មិនឃើញទេ!",
      });

    let isSenderDeducted = false;
    const actualMainAccUSD =
      sender.mainAccounts?.USD?.accountNumber || sender.accountNumber;

    // 🌟 កាត់លុយពី U-Mall
    if (actualMainAccUSD === senderAccNumber) {
      if (
        (sender.mainAccounts?.USD?.balance || sender.balance) <
        parseFloat(amount)
      ) {
        return res.status(400).json({
          success: false,
          message: `គណនី U-Mall (${senderAccNumber}) ខ្វះប្រាក់!`,
        });
      }
      if (sender.mainAccounts?.USD)
        sender.mainAccounts.USD.balance -= parseFloat(amount);
      else sender.balance -= parseFloat(amount);
      sender.markModified("mainAccounts");
      isSenderDeducted = true;
    } else {
      const subAcc = sender.subAccounts.find(
        (sub) => sub.accountNumber === senderAccNumber,
      );
      if (subAcc) {
        if (subAcc.balance < parseFloat(amount))
          return res.status(400).json({
            success: false,
            message: `គណនីរង U-Mall (${senderAccNumber}) ខ្វះប្រាក់!`,
          });
        subAcc.balance -= parseFloat(amount);
        sender.markModified("subAccounts");
        isSenderDeducted = true;
      }
    }

    if (!isSenderDeducted)
      return res.status(400).json({
        success: false,
        message: `រកមិនឃើញលេខគណនី ${senderAccNumber} ទេ!`,
      });

    await sender.save();

    // 🌟 ស្វែងរកគណនីអ្នកលក់ (Seller)
    const receiver = await User.findOne({
      $or: [
        { "mainAccounts.USD.accountNumber": receiverAccount },
        { accountNumber: receiverAccount },
        { "subAccounts.accountNumber": receiverAccount },
      ],
    });

    if (!receiver) {
      // បើមិនឃើញទេ បង្វិលលុយចូល U-Mall វិញ (Refund)
      if (actualMainAccUSD === senderAccNumber) {
        if (sender.mainAccounts?.USD)
          sender.mainAccounts.USD.balance += parseFloat(amount);
        else sender.balance += parseFloat(amount);
        sender.markModified("mainAccounts");
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

    // 🌟 បូកលុយអោយអ្នកលក់ (Seller)
    const actualRecMainAccUSD =
      receiver.mainAccounts?.USD?.accountNumber || receiver.accountNumber;
    if (actualRecMainAccUSD === receiverAccount) {
      if (receiver.mainAccounts?.USD)
        receiver.mainAccounts.USD.balance += parseFloat(amount);
      else receiver.balance += parseFloat(amount);
      receiver.markModified("mainAccounts");
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

    const dateStr = new Date().toLocaleString("en-US", {
      timeZone: "Asia/Phnom_Penh",
      hour12: true,
    });
    const shortRefId = generateStandardRefId("B2B");
    const shortHash = generateStandardHash();

    // ==========================================
    // 📝 បង្កើត Slip (Transaction) ទាំងសងខាង (អ្នកទទួល និង អ្នកវេរ)
    // ==========================================
    const finalRemark = description || "ទូទាត់ប្រាក់ B2B Gateway";

    // ១. សម្រាប់អ្នកទទួល (Seller) - លុយចូល
    await Transaction.create({
      userId: receiver._id,
      username: receiver.username,
      refId: shortRefId,
      hash: shortHash,
      date: dateStr,
      type: "Receive",
      amount: parseFloat(amount),
      currency: "USD",
      fee: 0,
      senderName: merchantProfile.name,
      senderAcc: senderAccNumber,
      receiverName: receiver.fullName || receiver.username,
      receiverAcc: receiverAccount,
      trxMethod: "B2B Gateway",
      remark: finalRemark, // <--- យកសារពី U-Mall មកបង្ហាញលើ Slip អ្នកទទួល
      status: "Success",
      merchantId: merchantProfile.merchantId,
    });

    // ២. សម្រាប់អ្នកវេរ (U-Mall) - លុយចេញ
    await Transaction.create({
      userId: sender._id,
      username: sender.username,
      refId: shortRefId,
      hash: shortHash,
      date: dateStr,
      type: "Transfer",
      amount: -parseFloat(amount),
      currency: "USD",
      fee: 0,
      senderName: merchantProfile.name,
      senderAcc: senderAccNumber,
      receiverName: receiver.fullName || receiver.username,
      receiverAcc: receiverAccount,
      trxMethod: "B2B Gateway",
      remark: finalRemark, // <--- យកសារពី U-Mall មកបង្ហាញលើ Slip អ្នកវេរ
      status: "Success",
      merchantId: merchantProfile.merchantId,
    });

    // ==========================================
    // 🔔 ប្រព័ន្ធផ្តល់ដំណឹង (Notification, Socket & Telegram)
    // ==========================================

    // ១. បង្កើត In-App Notification ប្រាប់អ្នកលក់
    await Notification.create({
      userId: receiver._id,
      username: receiver.username,
      title: "ទទួលបានប្រាក់ពី U-Mall! 💸",
      message: `អ្នកទទួលបាន $${parseFloat(amount).toLocaleString()} ពី ${merchantProfile.name}។ យោង៖ ${finalRemark}`,
      type: "transfer_receive",
      date: dateStr,
      isRead: false,
    });

    // ២. Refresh ប្រវត្តិប្រតិបត្តិការតាម Socket.io (លុប Popup ពណ៌បៃតងចេញតាមសំណូមពរ)
    const io = req.app.get("io") || global.io;
    if (io) {
      io.to(receiver.username).emit("transactionUpdated");
      io.to(sender.username).emit("transactionUpdated");
    }

    // ៣. បាញ់សារប្រាប់តាម Telegram Bot (បើ User បានភ្ជាប់)
    if (typeof bot !== "undefined" && bot && bot.sendUserPaymentAlert) {
      bot
        .sendUserPaymentAlert(receiver._id, {
          amount: parseFloat(amount),
          currency: "USD",
          senderName: merchantProfile.name,
          refId: shortRefId,
        })
        .catch(() => {});
    }

    res.json({
      success: true,
      transactionId: shortRefId,
      message: "ផ្ទេរប្រាក់ B2B ជោគជ័យ និងបានកាត់ប្រាក់រួចរាល់!",
    });
  } catch (error) {
    console.error("B2B Transfer Error:", error);
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
