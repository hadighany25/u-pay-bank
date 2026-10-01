// services/payrollProcessor.js
const mongoose = require("mongoose");
const User = require("../models/User");
const JointAccount = require("../models/JointAccount");
const Transaction = require("../models/Transaction");
const Notification = require("../models/Notification"); // 🌟 ថែម Notification
const { readFXRates } = require("./systemService");
const { generateHash } = require("./helpers");

const executePayroll = async (payroll) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 🌟 ប្រើ creatorId ពីរចនាសម្ព័ន្ធ Payroll ថ្មី (ឬ username ជា fallback)
    const senderQuery = payroll.creatorId
      ? { _id: payroll.creatorId }
      : { username: payroll.username };

    let sender = await User.findOne(senderQuery).session(session);

    if (!sender) throw new Error("រកមិនឃើញគណនីអ្នកផ្ញើក្នុង Database ទេ!");
    if (sender.isFrozen) throw new Error("គណនីអ្នកផ្ញើត្រូវបានផ្អាក (Frozen)!");

    const currentFXRates = readFXRates();

    // ==========================================
    // ១. កំណត់អត្តសញ្ញាណគណនីប្រភព (Source Account) យ៉ាងឆ្លាតវៃ
    // ==========================================
    let actualSourceAcc = payroll.sourceAccount;
    let isSenderKHR = false;
    let isSenderSubAccount = false;
    let senderSubIndex = -1;
    let jointSenderAcc = null;
    let juniorSenderAcc = null;
    let senderAvailableBal = 0;

    const mainUsdNum =
      sender.mainAccounts?.USD?.accountNumber || sender.accountNumber;
    const mainKhrNum =
      sender.mainAccounts?.KHR?.accountNumber || sender.accountNumberKHR;

    if (
      payroll.sourceAccount === "MAIN_USD" ||
      payroll.sourceAccount === mainUsdNum ||
      payroll.sourceAccount === sender.accountNumber
    ) {
      actualSourceAcc = mainUsdNum;
      senderAvailableBal =
        sender.mainAccounts?.USD?.balance ?? sender.balance ?? 0;
    } else if (
      payroll.sourceAccount === "MAIN_KHR" ||
      payroll.sourceAccount === mainKhrNum ||
      payroll.sourceAccount === sender.accountNumberKHR
    ) {
      actualSourceAcc = mainKhrNum;
      isSenderKHR = true;
      senderAvailableBal =
        sender.mainAccounts?.KHR?.balance ?? sender.balanceKHR ?? 0;
    } else {
      senderSubIndex = sender.subAccounts.findIndex(
        (acc) => acc.accountNumber === payroll.sourceAccount,
      );

      if (senderSubIndex !== -1) {
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
            $or: [
              { "mainAccounts.USD.accountNumber": actualSourceAcc },
              { accountNumber: actualSourceAcc },
            ],
          }).session(session);
          if (!juniorSenderAcc) throw new Error("រកគណនីកូនមិនឃើញទេ!");

          senderAvailableBal = isSenderKHR
            ? juniorSenderAcc.mainAccounts?.KHR?.balance ||
              juniorSenderAcc.balanceKHR ||
              0
            : juniorSenderAcc.mainAccounts?.USD?.balance ||
              juniorSenderAcc.balance ||
              0;
        } else {
          senderAvailableBal = subAcc.balance;
        }
      } else {
        actualSourceAcc = mainUsdNum;
        senderAvailableBal =
          sender.mainAccounts?.USD?.balance ?? sender.balance ?? 0;
      }
    }

    if (senderAvailableBal < payroll.totalAmount) {
      throw new Error(
        "សមតុល្យគណនីប្រភពមិនគ្រប់គ្រាន់សម្រាប់កាត់បើកប្រាក់ខែទេ!",
      );
    }

    // ==========================================
    // ២. កាត់លុយពីគណនីប្រភព (Sender) តាមរចនាសម្ព័ន្ធថ្មី
    // ==========================================
    if (isSenderSubAccount) {
      if (jointSenderAcc) {
        jointSenderAcc.balance -= payroll.totalAmount;
        await jointSenderAcc.save({ session });
      } else if (juniorSenderAcc) {
        if (isSenderKHR) {
          if (juniorSenderAcc.mainAccounts?.KHR)
            juniorSenderAcc.mainAccounts.KHR.balance -= payroll.totalAmount;
          else juniorSenderAcc.balanceKHR -= payroll.totalAmount;
        } else {
          if (juniorSenderAcc.mainAccounts?.USD)
            juniorSenderAcc.mainAccounts.USD.balance -= payroll.totalAmount;
          else juniorSenderAcc.balance -= payroll.totalAmount;
        }
        await juniorSenderAcc.save({ session });

        if (isSenderKHR) {
          if (sender.subAccounts[senderSubIndex].mainAccounts?.KHR)
            sender.subAccounts[senderSubIndex].mainAccounts.KHR.balance =
              juniorSenderAcc.mainAccounts.KHR.balance;
          else
            sender.subAccounts[senderSubIndex].balanceKHR =
              juniorSenderAcc.balanceKHR;
        } else {
          if (sender.subAccounts[senderSubIndex].mainAccounts?.USD)
            sender.subAccounts[senderSubIndex].mainAccounts.USD.balance =
              juniorSenderAcc.mainAccounts.USD.balance;
          else
            sender.subAccounts[senderSubIndex].balance =
              juniorSenderAcc.balance;
        }
        sender.markModified("subAccounts");
      } else {
        sender.subAccounts[senderSubIndex].balance -= payroll.totalAmount;
        sender.markModified("subAccounts");
      }
    } else {
      if (isSenderKHR) {
        if (sender.mainAccounts?.KHR)
          sender.mainAccounts.KHR.balance -= payroll.totalAmount;
        else sender.balanceKHR -= payroll.totalAmount;
      } else {
        if (sender.mainAccounts?.USD)
          sender.mainAccounts.USD.balance -= payroll.totalAmount;
        else sender.balance -= payroll.totalAmount;
      }
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
      let receiver;
      // 🌟 ឆែកមើលថាតើគាត់វេរចូលកុងខ្លួនឯងដែរឬទេ? (Self-Transfer)
      const isSelf =
        sender.accountNumber === r.account ||
        sender.accountNumberKHR === r.account ||
        sender.mainAccounts?.USD?.accountNumber === r.account ||
        sender.mainAccounts?.KHR?.accountNumber === r.account ||
        (sender.subAccounts &&
          sender.subAccounts.some((sub) => sub.accountNumber === r.account));

      if (isSelf) {
        // 🌟 បើកុងខ្លួនឯង ប្រើប្រាស់ Object មេតែមួយដើម្បីការពារ Write Conflict Error
        receiver = sender;
      } else {
        receiver = await User.findOne({
          $or: [
            { "mainAccounts.USD.accountNumber": r.account },
            { "mainAccounts.KHR.accountNumber": r.account },
            { accountNumber: r.account },
            { accountNumberKHR: r.account },
            { "subAccounts.accountNumber": r.account },
          ],
        }).session(session);
      }

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

      const recKhrNum =
        receiver.mainAccounts?.KHR?.accountNumber || receiver.accountNumberKHR;
      const recUsdNum =
        receiver.mainAccounts?.USD?.accountNumber || receiver.accountNumber;

      if (recKhrNum === r.account) {
        isReceiverKHR = true;
      } else if (recUsdNum !== r.account && targetSubAccIndex !== -1) {
        isReceiverSubAccount = true;
        isReceiverKHR =
          receiver.subAccounts[targetSubAccIndex].currency === "KHR";
      }

      if (!isSenderKHR && isReceiverKHR) {
        receiverAmount = parseFloat(r.amount) * currentFXRates.usdToKhrBuy;
      } else if (isSenderKHR && !isReceiverKHR) {
        receiverAmount = parseFloat(r.amount) / currentFXRates.usdToKhrSell;
      }

      // បូកលុយចូលគណនី
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
        await receiver.save({ session });
      }

      const itemHash = generateHash();
      const finalReceiverName = jointReceiverAcc
        ? jointReceiverAcc.accountName
        : receiver.fullName || receiver.username;
      const remarkText = r.remark || payroll.name || "Auto Payout";

      // 🌟 ត្រូវមាន userId ជានិច្ច
      const senderTrx = {
        userId: sender._id,
        username: sender.username,
        refId: sharedRefId,
        hash: itemHash,
        date: dateStr,
        type: payroll.type === "bulk" ? "Payroll Transfer" : "Transfer",
        amount: -parseFloat(r.amount),
        currency: isSenderKHR ? "KHR" : "USD",
        senderName: finalSenderName,
        receiverName: finalReceiverName,
        receiverAcc: actualReceiverAccNum,
        senderAcc: actualSourceAcc,
        trxMethod: "Auto Payouts",
        remark: remarkText,
        status: "Success",
      };

      const receiverTrx = {
        userId: receiver._id,
        username: receiver.username,
        refId: sharedRefId,
        hash: itemHash,
        date: dateStr,
        type: payroll.type === "bulk" ? "Payroll Received" : "Receive",
        amount: receiverAmount,
        currency: isReceiverKHR ? "KHR" : "USD",
        senderName: finalSenderName,
        receiverName: finalReceiverName,
        receiverAcc: actualReceiverAccNum,
        senderAcc: actualSourceAcc,
        trxMethod: "Auto Payouts",
        remark: remarkText,
        status: "Success",
      };

      if (jointSenderAcc) {
        for (let m of jointSenderAcc.members) {
          if (m.status === "active") {
            const mUser = await User.findOne({ username: m.username }).session(
              session,
            );
            bulkTransactions.push({
              ...senderTrx,
              username: m.username,
              userId: mUser ? mUser._id : undefined,
            });
          }
        }
      } else {
        bulkTransactions.push(senderTrx);
      }

      if (jointReceiverAcc) {
        for (let m of jointReceiverAcc.members) {
          if (m.status === "active") {
            const mUser = await User.findOne({ username: m.username }).session(
              session,
            );
            bulkTransactions.push({
              ...receiverTrx,
              username: m.username,
              userId: mUser ? mUser._id : undefined,
            });
          }
        }
      } else {
        bulkTransactions.push(receiverTrx);
      }

      // 🌟 បាញ់សារ Info ទៅកាន់អ្នកទទួលម្នាក់ៗ
      const currencySymbol = isReceiverKHR ? "៛" : "$";
      await Notification.create(
        [
          {
            userId: receiver._id,
            username: receiver.username,
            title: "ទទួលបានទឹកប្រាក់! 💸",
            message: `អ្នកទទួលបាន ${currencySymbol}${receiverAmount.toLocaleString()} ពី ${finalSenderName} (Auto Payout)។ ${remarkText ? `ចំណាំ៖ ${remarkText}` : ""}`,
            type: "transfer_receive",
            date: dateStr,
            isRead: false,
          },
        ],
        { session },
      );

      successCount++;
    }

    if (bulkTransactions.length > 0) {
      await Transaction.insertMany(bulkTransactions, { session });
    }

    // 🌟 បាញ់សារ Info ទៅកាន់អ្នកផ្ញើ (ម្ចាស់ក្រុមហ៊ុន/ថៅកែ)
    const senderCurSym = isSenderKHR ? "៛" : "$";
    await Notification.create(
      [
        {
          userId: sender._id,
          username: sender.username,
          title:
            payroll.type === "bulk"
              ? "បើកប្រាក់បៀវត្សរ៍ជោគជ័យ! ✅"
              : "ទូទាត់ប្រាក់ជោគជ័យ! ✅",
          message: `ប្រព័ន្ធបានកាត់ប្រាក់សរុប ${senderCurSym}${payroll.totalAmount.toLocaleString()} ដើម្បីទូទាត់ទៅកាន់អ្នកទទួលចំនួន ${successCount} នាក់ តាមកាលវិភាគ "${payroll.name}"។`,
          type: "transfer_sent",
          date: dateStr,
          isRead: false,
        },
      ],
      { session },
    );

    // ចំណាំ៖ មិនចាំបាច់បង្កើត new Payroll() ទីនេះទេ ព្រោះ Cron Job ជាអ្នក Update ឯកសារចាស់
    // បើបង្កើតថ្មី វានឹងស្ទួនទិន្នន័យ Schedule។ គ្រាន់តែ Return True ជាការស្រេច!

    await session.commitTransaction();
    session.endSession();

    console.log(
      `✅ Auto Payout រួចរាល់: ${payroll.name} | ជោគជ័យ: ${successCount} នាក់`,
    );
    return true;
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    // បាញ់ Error Message ចូល DB (ស្រេចចិត្ត) ឬកត់ក្នុង Log
    console.error(
      `❌ បរាជ័យក្នុងការកាត់លុយ Auto Payout (${payroll.name}):`,
      error.message,
    );

    // បាញ់សារ Notification ប្រាប់ថៅកែថា Failed
    try {
      let failSender = await User.findOne({
        $or: [{ _id: payroll.creatorId }, { username: payroll.username }],
      });
      if (failSender) {
        await Notification.create({
          userId: failSender._id,
          username: failSender.username,
          title: "កាលវិភាគទូទាត់បរាជ័យ ❌",
          message: `ប្រព័ន្ធមិនអាចដំណើរការកាលវិភាគ "${payroll.name}" បានទេ! មូលហេតុ: ${error.message}`,
          type: "transfer_sent",
          date: new Date().toLocaleString("en-US", {
            timeZone: "Asia/Phnom_Penh",
            hour12: true,
          }),
          isRead: false,
        });
      }
    } catch (e) {
      /* Ignore notification fail */
    }

    return false;
  }
};

module.exports = { executePayroll };
