// services/payrollProcessor.js
const mongoose = require("mongoose");
const User = require("../models/User");
const JointAccount = require("../models/JointAccount");
const Transaction = require("../models/Transaction");
const { readFXRates } = require("./systemService");
const { generateHash } = require("./helpers");

const executePayroll = async (payroll) => {
  // 🔥 បង្កើត Transaction Session ការពារការគាំង
  const session = await mongoose.startSession();
  session.startTransaction();

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
    }).session(session);

    if (!sender && mongoose.Types.ObjectId.isValid(uid)) {
      sender = await User.findById(uid).session(session);
    }

    if (!sender) throw new Error("រកមិនឃើញគណនីអ្នកផ្ញើក្នុង Database ទេ!");
    if (sender.isFrozen) throw new Error("គណនីអ្នកផ្ញើត្រូវបានផ្អាក (Frozen)!");

    // ទាញយកអត្រាប្តូរប្រាក់ប្រចាំប្រព័ន្ធ
    const currentFXRates = readFXRates();

    // ==========================================
    // ១. កំណត់អត្តសញ្ញាណគណនីប្រភព (ក្រុមហ៊ុន)
    // ==========================================
    let actualSourceAcc = payroll.sourceAccount;
    let isSenderKHR = false;
    let isSenderSubAccount = false;
    let senderSubIndex = -1;
    let jointSenderAcc = null;
    let juniorSenderAcc = null;
    let senderAvailableBal = 0;

    if (payroll.sourceAccount === "MAIN_USD") {
      actualSourceAcc = sender.accountNumber;
      senderAvailableBal = sender.balance;
    } else if (payroll.sourceAccount === "MAIN_KHR") {
      actualSourceAcc = sender.accountNumberKHR;
      isSenderKHR = true;
      senderAvailableBal = sender.balanceKHR;
    } else {
      senderSubIndex = sender.subAccounts.findIndex(
        (acc) => acc.accountNumber === payroll.sourceAccount,
      );
      if (senderSubIndex === -1) throw new Error("គណនីប្រភពមិនត្រឹមត្រូវ!");
      isSenderSubAccount = true;
      const subAcc = sender.subAccounts[senderSubIndex];
      actualSourceAcc = subAcc.accountNumber;
      isSenderKHR = subAcc.currency === "KHR";

      if (
        subAcc.accountType === "joint" ||
        subAcc.accountType === "joint_member"
      ) {
        jointSenderAcc = await JointAccount.findOne({
          accountId: subAcc.accountId,
        }).session(session);
        if (!jointSenderAcc) throw new Error("រកគណនីរួមនេះមិនឃើញទេ!");
        senderAvailableBal = jointSenderAcc.balance;
      } else if (subAcc.accountType === "junior") {
        juniorSenderAcc = await User.findOne({
          accountNumber: actualSourceAcc,
        }).session(session);
        if (!juniorSenderAcc) throw new Error("រកគណនីកូនមិនឃើញទេ!");

        const dailyLimit = juniorSenderAcc.dailyLimit || 0;
        const dailySpent = juniorSenderAcc.dailySpent || 0;
        if (dailyLimit > 0 && dailySpent + payroll.totalAmount > dailyLimit) {
          throw new Error("ការចំណាយលើសដែនកំណត់របស់ Junior Account!");
        }
        senderAvailableBal = isSenderKHR
          ? juniorSenderAcc.balanceKHR || 0
          : juniorSenderAcc.balance || 0;
      } else {
        senderAvailableBal = subAcc.balance;
      }
    }

    if (senderAvailableBal < payroll.totalAmount) {
      throw new Error(
        "សមតុល្យគណនីប្រភពមិនគ្រប់គ្រាន់សម្រាប់កាត់បើកប្រាក់ខែទេ!",
      );
    }

    // ==========================================
    // ២. កាត់លុយពីគណនីប្រភព (Sender)
    // ==========================================
    if (isSenderSubAccount) {
      if (jointSenderAcc) {
        jointSenderAcc.balance -= payroll.totalAmount;
        await jointSenderAcc.save({ session });
      } else if (juniorSenderAcc) {
        if (isSenderKHR) juniorSenderAcc.balanceKHR -= payroll.totalAmount;
        else juniorSenderAcc.balance -= payroll.totalAmount;
        juniorSenderAcc.dailySpent =
          (juniorSenderAcc.dailySpent || 0) + payroll.totalAmount;
        await juniorSenderAcc.save({ session });

        if (isSenderKHR)
          sender.subAccounts[senderSubIndex].balanceKHR =
            juniorSenderAcc.balanceKHR;
        else
          sender.subAccounts[senderSubIndex].balance = juniorSenderAcc.balance;
        sender.markModified("subAccounts");
      } else {
        sender.subAccounts[senderSubIndex].balance -= payroll.totalAmount;
        sender.markModified("subAccounts");
      }
    } else {
      if (isSenderKHR) sender.balanceKHR -= payroll.totalAmount;
      else sender.balance -= payroll.totalAmount;
    }
    await sender.save({ session });

    // ==========================================
    // ៣. បែងចែកលុយចូលគណនីអ្នកទទួលម្តងម្នាក់ៗ
    // ==========================================
    const sharedRefId =
      "PRL-" + Math.floor(100000000 + Math.random() * 900000000);
    const dateStr = new Date().toLocaleString("en-US", {
      timeZone: "Asia/Phnom_Penh",
      hour12: true,
    });
    const finalSenderName = jointSenderAcc
      ? jointSenderAcc.accountName
      : sender.fullName || sender.username;

    let bulkTransactions = [];
    let successCount = 0;

    for (let r of payroll.recipients) {
      // ស្វែងរកគណនីអ្នកទទួលគ្រប់ទម្រង់ (Main, KHR, Sub-Account, Junior)
      let receiver = await User.findOne({
        $or: [
          { accountNumber: r.account },
          { accountNumberKHR: r.account },
          { "subAccounts.accountNumber": r.account },
        ],
      }).session(session);

      if (!receiver) {
        console.log(`⚠️ រំលងអ្នកទទួល ${r.account} (រកមិនឃើញក្នុង Database)`);
        continue;
      }

      let isReceiverKHR = false;
      let receiverAmount = parseFloat(r.amount);
      let actualReceiverAccNum = r.account;
      let targetSubAccIndex = receiver.subAccounts.findIndex(
        (acc) => acc.accountNumber === r.account,
      );
      let isReceiverSubAccount = false;
      let jointReceiverAcc = null;

      if (receiver.accountNumberKHR === r.account) {
        isReceiverKHR = true;
      } else if (
        receiver.accountNumber !== r.account &&
        targetSubAccIndex !== -1
      ) {
        isReceiverSubAccount = true;
        isReceiverKHR =
          receiver.subAccounts[targetSubAccIndex].currency === "KHR";
      }

      // 💱 ប្រព័ន្ធប្តូរប្រាក់អូតូបើរូបិយប័ណ្ណខុសគ្នា
      if (!isSenderKHR && isReceiverKHR) {
        receiverAmount = parseFloat(r.amount) * currentFXRates.usdToKhrBuy;
      } else if (isSenderKHR && !isReceiverKHR) {
        receiverAmount = parseFloat(r.amount) / currentFXRates.usdToKhrSell;
      }

      // បូកលុយចូលកុងអ្នកទទួល
      if (isReceiverSubAccount) {
        const targetSubAcc = receiver.subAccounts[targetSubAccIndex];
        if (
          targetSubAcc.accountType === "joint" ||
          targetSubAcc.accountType === "joint_member"
        ) {
          jointReceiverAcc = await JointAccount.findOne({
            accountId: targetSubAcc.accountId,
          }).session(session);
          if (jointReceiverAcc) {
            jointReceiverAcc.balance += receiverAmount;
            await jointReceiverAcc.save({ session });
          }
        } else {
          targetSubAcc.balance += receiverAmount;
          receiver.markModified("subAccounts");
          await receiver.save({ session });
        }
      } else {
        if (isReceiverKHR)
          receiver.balanceKHR = (receiver.balanceKHR || 0) + receiverAmount;
        else receiver.balance = (receiver.balance || 0) + receiverAmount;
        await receiver.save({ session });

        // Sync លុយទៅកុងម៉ាក់ប៉ា បើអ្នកទទួលជាកូន
        if (receiver.role === "junior" && receiver.parentUsername) {
          let parentDoc =
            sender.username === receiver.parentUsername
              ? sender
              : await User.findOne({
                  username: receiver.parentUsername,
                }).session(session);
          if (parentDoc) {
            const subIdx = parentDoc.subAccounts.findIndex(
              (acc) => acc.accountNumber === r.account,
            );
            if (subIdx !== -1) {
              if (isReceiverKHR)
                parentDoc.subAccounts[subIdx].balanceKHR = receiver.balanceKHR;
              else parentDoc.subAccounts[subIdx].balance = receiver.balance;
              parentDoc.markModified("subAccounts");
              if (parentDoc.username !== sender.username)
                await parentDoc.save({ session });
            }
          }
        }
      }

      const itemHash = generateHash();
      const finalReceiverName = jointReceiverAcc
        ? jointReceiverAcc.accountName
        : receiver.fullName || receiver.username;
      const remarkText = r.remark || payroll.name || "Auto Payout";

      // ៤. កត់ត្រា Transaction សម្រាប់អ្នកផ្ញើ (កាត់លុយ)
      const senderTrx = {
        username: sender.username,
        refId: sharedRefId,
        hash: itemHash,
        date: dateStr,
        type: payroll.type === "bulk" ? "Payroll Transfer" : "Transfer",
        amount: -parseFloat(r.amount), // ដកតាមចំនួនលុយផ្ញើ
        currency: isSenderKHR ? "KHR" : "USD",
        senderName: finalSenderName,
        receiverName: finalReceiverName,
        receiverAcc: actualReceiverAccNum,
        senderAcc: actualSourceAcc,
        trxMethod: "Auto Payouts",
        remark: remarkText,
        status: "Success",
      };

      // ៥. កត់ត្រា Transaction សម្រាប់អ្នកទទួល (បូកលុយ)
      const receiverTrx = {
        username: receiver.username,
        refId: sharedRefId,
        hash: itemHash,
        date: dateStr,
        type: payroll.type === "bulk" ? "Payroll Received" : "Receive",
        amount: receiverAmount, // បូកតាមលុយដែលប្តូររួច
        currency: isReceiverKHR ? "KHR" : "USD",
        senderName: finalSenderName,
        receiverName: finalReceiverName,
        receiverAcc: actualReceiverAccNum,
        senderAcc: actualSourceAcc,
        trxMethod: "Auto Payouts",
        remark: remarkText,
        status: "Success",
      };

      // រក្សាទុកក្នុង Array
      if (jointSenderAcc) {
        for (let m of jointSenderAcc.members) {
          if (m.status === "active")
            bulkTransactions.push({ ...senderTrx, username: m.username });
        }
      } else {
        bulkTransactions.push(senderTrx);
      }

      if (jointReceiverAcc) {
        for (let m of jointReceiverAcc.members) {
          if (m.status === "active")
            bulkTransactions.push({ ...receiverTrx, username: m.username });
        }
      } else {
        bulkTransactions.push(receiverTrx);
      }

      successCount++;
    }

    // បាញ់ Transactions ចូល Database ទាំងអស់ម្តង
    if (bulkTransactions.length > 0) {
      await Transaction.insertMany(bulkTransactions, { session });
    }

    // Commit ការរក្សាទុក
    await session.commitTransaction();
    session.endSession();

    console.log(
      `✅ Auto Payout រួចរាល់: ${payroll.name} | ជោគជ័យ: ${successCount} នាក់`,
    );
    return true;
  } catch (error) {
    // 🚨 បើមាន Error ណាមួយកើតឡើង កូដនឹង Rollback លុយនិងទិន្នន័យមកដើមវិញទាំងអស់
    await session.abortTransaction();
    session.endSession();
    console.error(
      `❌ បរាជ័យក្នុងការកាត់លុយ Auto Payout (${payroll.name}):`,
      error.message,
    );
    return false;
  }
};

module.exports = { executePayroll };
