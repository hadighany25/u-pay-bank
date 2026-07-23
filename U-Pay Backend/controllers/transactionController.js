// ==========================================
// 📦 នាំចូលម៉ូឌុល និងឯកសារដែលចាំបាច់ (Imports)
// ==========================================
const User = require("../models/User");
const System = require("../models/System");
const PromoCode = require("../models/PromoCode");
const Merchant = require("../models/Merchant");
const mongoose = require("mongoose");
const Transaction = require("../models/Transaction");
const JointAccount = require("../models/JointAccount"); // ធុងលុយគណនីរួម

// នាំចូល Services
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
    // ឆែកមើលថាតើជា User ធម្មតា (Main USD, Main KHR ឬ Sub-Account)
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
      // បើមិនមែន User ធម្មតាទេ ឆែកមើលក្រែងលោជា Merchant
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
      // បើជា User ធម្មតា
      targetName = target.fullName || target.username;

      if (target.accountNumberKHR === accountNumber) {
        isReceiverKHR = true;
      } else {
        // ឆែកមើលក្រែងលោគាត់បាញ់ចូល Sub-Account ណាមួយ
        const subAcc = target.subAccounts.find(
          (acc) => acc.accountNumber === accountNumber,
        );
        if (subAcc) {
          if (subAcc.currency === "KHR") isReceiverKHR = true;

          // បើបាញ់ចូលគណនីរួម (Joint Account) បង្ហាញឈ្មោះគណនីរួមតែម្តង
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
      // ទាញយកអត្រាប្តូរប្រាក់ និងកម្រិតសេវាពី System ដើម្បីឲ្យ Frontend បង្ហាញ
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
// 💸 ២. មុខងារវេរលុយ (មានសេវា, ប្តូរប្រាក់, គណនីរួម & Merchant)
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

  // កុងត្រូលសុវត្ថិភាព៖ ការពារកុំឲ្យ Hacker បាញ់ API ជំនួសអ្នកដទៃ
  if (req.user.username !== senderUsername) {
    return res
      .status(403)
      .json({ success: false, message: "បម្រាមសុវត្ថិភាព! 🚨" });
  }

  try {
    // ------------------------------------------
    // ក. ផ្ទៀងផ្ទាត់អ្នកផ្ញើ និងអ្នកទទួល
    // ------------------------------------------
    const sender = await User.findOne({ username: senderUsername });
    if (!sender) return res.json({ success: false, message: "Account Error" });
    if (sender.isFrozen)
      return res.json({ success: false, message: "Account Frozen" });

    // ឆែក PIN
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
    sender.pinAttempts = 0; // Reset PIN ពេលវាយត្រូវ

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

    if (!receiver && !receiverMerchant) {
      return res.json({ success: false, message: "Receiver not found" });
    }

    // ------------------------------------------
    // ខ. គិតលុយ គិតអត្រាប្តូរប្រាក់ និងកម្រៃសេវា
    // ------------------------------------------
    const sys = await System.findOne({ settingId: "GLOBAL_SETTINGS" });
    const transferAmount = parseFloat(amount);
    const isSenderKHR = currency === "KHR";
    const currentFXRates = readFXRates(); // ត្រូវប្រាកដថាអថេរនេះមាន Data មកពីកន្លែងណាផ្សេង

    // បំប្លែងទៅជា USD ដើម្បីឆែកកម្រិតយកសេវា (Fee Tiers)
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

    // ------------------------------------------
    // គ. កំណត់អត្តសញ្ញាណគណនីប្រភព (អ្នកផ្ញើ) ថាកាត់ពីកុងណា?
    // ------------------------------------------
    let isSenderSubAccount = false;
    let senderSubIndex = -1;
    let jointSenderAcc = null;

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
      const sType = sender.subAccounts[senderSubIndex].accountType;
      if (sType === "joint" || sType === "joint_member") {
        jointSenderAcc = await JointAccount.findOne({
          accountId: sender.subAccounts[senderSubIndex].accountId,
        });
        if (!jointSenderAcc)
          return res.json({ success: false, message: "រកគណនីរួមនេះមិនឃើញទេ!" });
        senderAvailableBal = jointSenderAcc.balance;
      } else {
        senderAvailableBal = sender.subAccounts[senderSubIndex].balance;
      }
    } else {
      senderAvailableBal = isSenderKHR
        ? sender.balanceKHR || 0
        : sender.balance || 0;
    }

    if (senderAvailableBal < totalDeduction) {
      return res.json({ success: false, message: "សមតុល្យមិនគ្រប់គ្រាន់" });
    }

    // ------------------------------------------
    // ឃ. ដំណើរការបញ្ចូលលុយទៅអ្នកទទួល (បូកលុយ)
    // ------------------------------------------
    let receiverAmount = transferAmount;
    let isReceiverKHR = false;
    let actualReceiverAccNum = receiverAccount;
    let targetSubAccIndex = -1;
    let isReceiverSubAccount = false;
    let jointReceiverAcc = null;

    if (isMerchant) {
      isReceiverKHR = receiverMerchant.accountNumbers.KHR === receiverAccount;
      // ប្តូរប្រាក់ប្រសិនបើការបាញ់ខុសរូបិយប័ណ្ណ
      if (!isSenderKHR && isReceiverKHR)
        receiverAmount = transferAmount * currentFXRates.usdToKhrBuy;
      else if (isSenderKHR && !isReceiverKHR)
        receiverAmount = transferAmount / currentFXRates.usdToKhrSell;

      if (isReceiverKHR) receiverMerchant.collected.KHR += receiverAmount;
      else receiverMerchant.collected.USD += receiverAmount;
      await receiverMerchant.save();

      // បញ្ចូលលុយទៅម្ចាស់ Merchant
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
          if (sub) {
            sub.balance += receiverAmount;
            owner.markModified("subAccounts"); // 🔥 Safety Lock
          } else {
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
      // ករណីបាញ់ឲ្យ User ធម្មតា
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
          }
        } else {
          targetSubAcc.balance += receiverAmount;
          receiver.markModified("subAccounts"); // 🔥 Safety Lock
          await receiver.save();
        }
      } else {
        if (isReceiverKHR)
          receiver.balanceKHR = (receiver.balanceKHR || 0) + receiverAmount;
        else receiver.balance = (receiver.balance || 0) + receiverAmount;
        await receiver.save();
      }
    }

    // ------------------------------------------
    // ង. ដំណើរការកាត់លុយពីអ្នកផ្ញើ (ដកលុយចេញ)
    // ------------------------------------------
    if (isSenderSubAccount) {
      const senderSubAcc = sender.subAccounts[senderSubIndex];
      if (
        senderSubAcc.accountType === "joint" ||
        senderSubAcc.accountType === "joint_member"
      ) {
        if (jointSenderAcc) {
          jointSenderAcc.balance -= totalDeduction;
          await jointSenderAcc.save();
        }
      } else {
        senderSubAcc.balance -= totalDeduction;
        sender.markModified("subAccounts"); // 🔥 Safety Lock
        await sender.save();
      }
    } else {
      if (isSenderKHR) sender.balanceKHR -= totalDeduction;
      else sender.balance -= totalDeduction;
      await sender.save();
    }

    // ------------------------------------------
    // ច. ការកត់ត្រាប្រវត្តិ (Transaction Logging)
    // ------------------------------------------
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

    // 🔥 ១. កំណត់ឈ្មោះអ្នកផ្ញើ និងអ្នកទទួលឱ្យចេញឈ្មោះគណនីរួមពេញលេញ (Full Name)
    const finalSenderName = jointSenderAcc
      ? jointSenderAcc.accountName
      : sender.fullName || sender.username;
    const finalReceiverName = isMerchant
      ? receiverMerchant.name
      : jointReceiverAcc
        ? jointReceiverAcc.accountName
        : receiver.fullName || receiver.username;

    const senderTrx = {
      refId: sharedRefId,
      hash: sharedHash,
      date,
      type: "Transfer",
      amount: -totalDeduction,
      currency: isSenderKHR ? "KHR" : "USD",
      fee: appliedFee,
      senderName: finalSenderName, // ប្រើឈ្មោះដែលបានកំណត់
      receiverName: finalReceiverName, // ប្រើឈ្មោះដែលបានកំណត់
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
      senderName: finalSenderName, // ប្រើឈ្មោះដែលបានកំណត់
      receiverName: finalReceiverName, // ប្រើឈ្មោះដែលបានកំណត់
      receiverAcc: actualReceiverAccNum,
      senderAcc: actualSenderAccNum,
      trxMethod: currentMethod,
      remark: sharedRemark,
      status: "Success",
      username: isMerchant ? receiverMerchant.userId : receiver.username,
      merchantId: isMerchant ? receiverMerchant.merchantId : undefined,
    };

    // Save Sender Trx
    if (jointSenderAcc) {
      for (let m of jointSenderAcc.members) {
        if (m.status === "active")
          await Transaction.create({ ...senderTrx, username: m.username });
      }
    } else {
      await Transaction.create(senderTrx);
    }

    // Save Receiver Trx & Send Notification
    const currencySymbol = isReceiverKHR ? "៛" : "$";
    // 🔥 ២. កំណត់ឈ្មោះអ្នកផ្ញើសម្រាប់បង្ហាញក្នុងសារ Notification (មានពាក្យ "គណនីរួម" ពីមុខ បើផ្ញើពីកុងរួម)
    const senderMsgName = jointSenderAcc
      ? `គណនីរួម ${jointSenderAcc.accountName}`
      : finalSenderName;

    if (!isMerchant && jointReceiverAcc) {
      for (let m of jointReceiverAcc.members) {
        if (m.status === "active") {
          await Transaction.create({ ...receiverTrx, username: m.username });
          const uDoc = await User.findOne({ username: m.username });
          if (uDoc) {
            uDoc.notifications = uDoc.notifications || [];
            uDoc.notifications.push({
              title: "ទទួលបានទឹកប្រាក់ (គណនីរួម)! 💸",
              message: `គណនីរួម ${jointReceiverAcc.accountName} ទទួលបាន ${currencySymbol}${receiverAmount.toLocaleString()} ពី ${senderMsgName}។`,
              type: "transfer_receive",
              date,
              isRead: false,
            });
            uDoc.markModified("notifications");
            await uDoc.save();
          }
        }
      }
    } else {
      await Transaction.create(receiverTrx);
      if (!isMerchant) {
        const rDoc = await User.findOne({ username: receiver.username });
        if (rDoc) {
          rDoc.notifications = rDoc.notifications || [];
          rDoc.notifications.push({
            title: "ទទួលបានទឹកប្រាក់! 💸",
            message: `អ្នកទទួលបាន ${currencySymbol}${receiverAmount.toLocaleString()} ពី ${senderMsgName}។`,
            type: "transfer_receive",
            date,
            isRead: false,
          });
          rDoc.markModified("notifications");
          await rDoc.save();
        }
      }
    }

    // បាញ់ Socket (Real-time Alert) ទៅកាន់សមាជិកទាំងអស់ក្នុងគណនីរួម
    const io = req.app.get("io");
    if (io) {
      const socketPayload = {
        amount: receiverAmount,
        currency: isReceiverKHR ? "KHR" : "USD",
        senderName: finalSenderName, // ប្រើឈ្មោះពេញ
      };

      if (!isMerchant && jointReceiverAcc) {
        for (let m of jointReceiverAcc.members) {
          if (m.status === "active") {
            io.to(m.username).emit("paymentReceived", socketPayload);
          }
        }
      } else {
        const targetSocketUser = isMerchant
          ? receiverMerchant.userId
          : receiver.username;
        io.to(targetSocketUser).emit("paymentReceived", socketPayload);
      }
    }

    // ------------------------------------------
    // ឆ. ទាញយកសមតុល្យចុងក្រោយបង្អស់មកបង្ហាញអ្នកផ្ញើវិញ
    // ------------------------------------------
    const updatedSender = await User.findOne({ username: senderUsername });
    let newBalanceRes = 0;

    if (isSenderSubAccount) {
      const sType = updatedSender.subAccounts[senderSubIndex].accountType;
      if (sType === "joint" || sType === "joint_member") {
        const updatedJoint = await JointAccount.findOne({
          accountId: updatedSender.subAccounts[senderSubIndex].accountId,
        });
        newBalanceRes = updatedJoint ? updatedJoint.balance : 0;
      } else {
        newBalanceRes = updatedSender.subAccounts[senderSubIndex].balance;
      }
    } else {
      newBalanceRes = isSenderKHR
        ? updatedSender.balanceKHR
        : updatedSender.balance;
    }

    // ជោគជ័យ! បញ្ជូន Slip ទៅ Frontend វិញ
    res.json({ success: true, newBalance: newBalanceRes, slipData: senderTrx });
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
            senderName: "U PAY Cashback Reward",
            receiverName: user.username,
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
            senderName: "U PAY Cashback Reward",
            receiverName: user.username,
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
    const sharedRefId = "PRM-" + Date.now().toString().slice(-6);
    const sharedRemark = `Claimed Promo Code: ${promo.code}`;

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
        senderName: "U-Pay Promos Reward",
        receiverName: user.username,
        remark: sharedRemark,
        status: "Success",
        trxMethod: "API Endpoint",
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
        senderName: "U-Pay Promos Reward",
        receiverName: user.username,
        remark: sharedRemark,
        status: "Success",
        trxMethod: "API Endpoint",
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
    // កំណត់អត្រាប្តូរប្រាក់ (ទាញពី System មកវិញល្អជាង Fix ចោល)
    const currentFXRates = readFXRates(); // ត្រូវប្រាកដថាអថេរនេះមាន Data មកពីកន្លែងណាផ្សេង
    const giftAmount = parseFloat(amount);

    // ផ្ទៀងផ្ទាត់អ្នកផ្ញើ និងលេខកូដ PIN
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
    sender.pinAttempts = 0; // Reset ពេលវាយត្រូវ

    // គណនាទឹកប្រាក់ត្រូវកាត់ & រកគណនីប្រភព
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

      // ឆែកមើលក្រែងជាគណនីរួម
      if (sub.accountType === "joint" || sub.accountType === "joint_member") {
        jointSenderAcc = await JointAccount.findOne({
          accountId: sub.accountId,
        });
        if (!jointSenderAcc)
          return res.json({ success: false, message: "រកគណនីរួមនេះមិនឃើញទេ!" });
      }
    }

    // ប្តូរប្រាក់បើកាដូ និងកុងខុសរូបិយប័ណ្ណ
    if (sourceCurrency !== currency) {
      if (sourceCurrency === "USD" && currency === "KHR")
        finalDeduction = giftAmount / currentFXRates.usdToKhrSell;
      if (sourceCurrency === "KHR" && currency === "USD")
        finalDeduction = giftAmount * currentFXRates.usdToKhrBuy;
    }

    // ឆែកសមតុល្យលុយ
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

    // កាត់ប្រាក់ពីគណនីជាក់លាក់ (អ្នកផ្ញើ)
    if (isSenderSubAccount) {
      if (jointSenderAcc) {
        jointSenderAcc.balance -= finalDeduction;
        await jointSenderAcc.save();
      } else {
        sender.subAccounts[senderSubIndex].balance -= finalDeduction;
        sender.markModified("subAccounts"); // 🔥 Safety Lock
      }
    } else if (senderAccount === "MAIN_KHR") {
      sender.balanceKHR -= finalDeduction;
    } else {
      sender.balance -= finalDeduction;
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
        receiver.markModified("subAccounts"); // 🔥 Safety Lock
      }
    } else {
      if (receiverInput === receiver.accountNumberKHR) {
        actualReceiverAccNum = receiver.accountNumberKHR;
        receiver.balanceKHR = (receiver.balanceKHR || 0) + giftAmount;
      } else {
        receiver.balance += giftAmount;
      }
    }

    // 📝 ការកត់ត្រាប្រវត្តិ
    const dateStr = new Date().toLocaleString("en-US", {
      timeZone: "Asia/Phnom_Penh",
      hour12: true,
    });
    const sharedRefId = "GIFT" + Date.now().toString().slice(-6);
    const sharedHash = Math.random().toString(36).substring(2, 11);
    const sharedRemark = message || "E-Gift";

    // 🔥 កំណត់ឈ្មោះអ្នកផ្ញើ និងអ្នកទទួលឱ្យចេញឈ្មោះពេញ (Full Name ឬ ឈ្មោះគណនីរួម)
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
      senderName: finalSenderName, // ប្រើឈ្មោះពេញ
      receiverName: finalReceiverName, // ប្រើឈ្មោះពេញ
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
      senderName: finalSenderName, // ប្រើឈ្មោះពេញ
      receiverName: finalReceiverName, // ប្រើឈ្មោះពេញ
      senderAcc: actualSenderAccNum,
      receiverAcc: actualReceiverAccNum,
      trxMethod: "U-Pay App",
      date: dateStr,
      remark: sharedRemark,
      status: "Completed",
    };

    // Save Transactions (ពិនិត្យមើលគណនីរួម)
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

    // 🎁 បង្កើត Notification ពិសេសឱ្យអ្នកទទួល (បង្ហាញឈ្មោះពេញ)
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
        senderName: finalSenderName, // ប្រើឈ្មោះពេញ
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

    // ត្រលប់ទិន្នន័យទៅ Frontend
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

    // 🔥 បាញ់ Socket (Real-time) អោយសមាជិកទាំងអស់ក្នុងកុងរួម (បង្ហាញឈ្មោះពេញ)
    const io = req.app.get("io");
    if (io) {
      const socketPayload = {
        amount: giftAmount,
        currency: currency,
        senderName: finalSenderName, // ប្រើឈ្មោះពេញ
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
    // Mark អាំងប៉ាវជា "បានអាន" នៅក្នុង Database របស់អ្នកទទួល
    if (notifId && req.user) {
      await User.updateOne(
        { username: req.user.username, "notifications._id": notifId },
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
