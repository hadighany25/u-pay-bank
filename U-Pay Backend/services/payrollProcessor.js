// services/payrollProcessor.js
const mongoose = require("mongoose");
const User = require("../models/User");
const Payroll = require("../models/Payroll");
const Transaction = require("../models/Transaction");

const executePayroll = async (payroll) => {
  try {
    const uid = String(payroll.userId);
    let sender = await User.findOne({
      $or: [
        { username: uid },
        { accountNumber: uid },
        { accountNumberKHR: uid },
        { phone: uid },
        { id: uid },
      ],
    });

    if (!sender && mongoose.Types.ObjectId.isValid(uid)) {
      sender = await User.findById(uid);
    }

    if (!sender) throw new Error("រកមិនឃើញគណនីអ្នកផ្ញើក្នុង Database ទេ!");

    // ==========================================
    // ឆែកមើលសមតុល្យអ្នកផ្ញើ
    // ==========================================
    let isUSD = true;
    if (payroll.sourceAccount === "MAIN_USD") {
      if (sender.balance < payroll.totalAmount)
        throw new Error("សមតុល្យ USD មិនគ្រប់គ្រាន់!");
    } else if (payroll.sourceAccount === "MAIN_KHR") {
      if (sender.balanceKHR < payroll.totalAmount)
        throw new Error("សមតុល្យ KHR មិនគ្រប់គ្រាន់!");
      isUSD = false;
    } else {
      const subAcc = sender.subAccounts.find(
        (a) => a.accountNumber === payroll.sourceAccount,
      );
      if (!subAcc || subAcc.balance < payroll.totalAmount)
        throw new Error("សមតុល្យក្នុងគណនីរងមិនគ្រប់គ្រាន់!");
      isUSD = subAcc.currency === "USD";
    }

    let successCount = 0;

    for (let recipient of payroll.recipients) {
      const receiver = await User.findOne({ accountNumber: recipient.account });
      if (!receiver) {
        console.log(`⚠️ រំលងអ្នកទទួល ${recipient.account} (រកមិនឃើញក្នុង DB)`);
        continue;
      }

      // កាត់លុយ និងបូកលុយ
      if (payroll.sourceAccount === "MAIN_USD")
        sender.balance -= recipient.amount;
      else if (payroll.sourceAccount === "MAIN_KHR")
        sender.balanceKHR -= recipient.amount;
      else {
        const subIndex = sender.subAccounts.findIndex(
          (a) => a.accountNumber === payroll.sourceAccount,
        );
        if (subIndex !== -1)
          sender.subAccounts[subIndex].balance -= recipient.amount;
      }

      if (isUSD) receiver.balance += recipient.amount;
      else receiver.balanceKHR += recipient.amount;

      // ==========================================
      // 🔥 ជួសជុលបញ្ហា Dashboard អ្នកផ្ញើអត់លោត
      // ==========================================

      // បំប្លែង MAIN_USD ឬ MAIN_KHR ទៅជាលេខកុងពិតប្រាកដ ដើម្បីអោយ Dashboard ស្គាល់
      let actualSenderAcc = payroll.sourceAccount;
      if (payroll.sourceAccount === "MAIN_USD")
        actualSenderAcc = sender.accountNumber;
      else if (payroll.sourceAccount === "MAIN_KHR")
        actualSenderAcc = sender.accountNumberKHR;

      const refId =
        "PRL-" + Math.floor(1000000000 + Math.random() * 9000000000);
      const hash = Math.random().toString(36).substring(2, 10);
      const dateNow = new Date().toLocaleString("en-US", {
        timeZone: "Asia/Phnom_Penh",
      });

      const baseTx = {
        refId,
        hash,
        type: "transfer",
        currency: isUSD ? "USD" : "KHR",
        senderName: sender.fullName || sender.username,
        senderAcc: actualSenderAcc, // 👈 ប្រើលេខកុងពិតប្រាកដនៅទីនេះ!
        receiverName: receiver.fullName || receiver.username,
        receiverAcc: recipient.account,
        trxMethod: "Auto Payout",
        remark: recipient.remark || payroll.name,
        date: dateNow,
        status: "Success",
      };

      // ១. កត់ត្រាចូលគណនីអ្នកផ្ញើ (Dashboard នឹងឃើញដកលុយពណ៌ក្រហម)
      await Transaction.create({
        ...baseTx,
        username: sender.username,
        amount: -recipient.amount, // លុយដក (អវិជ្ជមាន)
      });

      // ២. កត់ត្រាចូលគណនីអ្នកទទួល (Dashboard នឹងឃើញចូលលុយពណ៌បៃតង)
      await Transaction.create({
        ...baseTx,
        username: receiver.username,
        amount: recipient.amount, // លុយចូល
      });

      await receiver.save();
      successCount++;
    }

    await sender.save();

    if (payroll.frequency === "once") {
      payroll.status = "completed";
      await payroll.save();
    }

    console.log(
      `✅ Auto Payout រួចរាល់: ${payroll.name} | ជោគជ័យ: ${successCount} នាក់`,
    );
    return true;
  } catch (error) {
    console.error(
      `❌ បរាជ័យក្នុងការកាត់លុយ Auto Payout (${payroll.name}):`,
      error.message,
    );
    payroll.status = "failed";
    payroll.lastExecutedAt = new Date();
    await payroll.save();
    return false;
  }
};

module.exports = { executePayroll };
