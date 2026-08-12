// controllers/payrollController.js
const mongoose = require("mongoose");
const Payroll = require("../models/Payroll");
const User = require("../models/User");
const Transaction = require("../models/Transaction");
const JointAccount = require("../models/JointAccount"); // 👈 ត្រូវតែមានសម្រាប់កុងរួម
const { readFXRates } = require("../services/systemService"); // 👈 ត្រូវតែមានសម្រាប់គិតលុយឆ្លងកុង
const bot = require("../services/telegramBot");
const { generateRefId, generateHash } = require("../services/helpers");

// ========================================================================
// 📌 ១. បង្កើតកាលវិភាគថ្មី ឬ បើកប្រាក់ខែភ្លាមៗ (Bank-Grade Standard)
// ========================================================================
const createSchedule = async (req, res) => {
  // 🔥 ចាប់ផ្តើម Transaction Session ដើម្បីការពារការគាំង (ACID Compliance)
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const username = req.user.username;
    const {
      templateId,
      type,
      name,
      sourceAccount,
      recipients,
      frequency,
      scheduleDetails,
      isTemplate,
      processNow,
    } = req.body;

    // 🔒 សុវត្ថិភាពទី១៖ ត្រួតពិនិត្យបញ្ជី
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "មិនមានបញ្ជីអ្នកទទួលប្រាក់ទេ!" });
    }

    // 🔒 សុវត្ថិភាពទី២៖ គណនាលុយសរុបនៅ Backend
    let calculatedTotalAmount = 0;
    for (let r of recipients) {
      const amt = parseFloat(r.amount);
      if (isNaN(amt) || amt <= 0) {
        throw new Error(`ចំនួនទឹកប្រាក់របស់គណនី ${r.account} ត្រូវតែធំជាង ០!`);
      }
      calculatedTotalAmount += amt;
    }

    // ==========================================
    // 🚀 ក. ករណី Process Now (បើកប្រាក់ខែភ្លាមៗ)
    // ==========================================
    if (processNow) {
      const sender = await User.findOne({ username }).session(session);
      if (!sender) throw new Error("រកគណនីអ្នកផ្ញើមិនឃើញ!");
      if (sender.isFrozen) throw new Error("គណនីរបស់អ្នកត្រូវបានផ្អាក!");

      const currentFXRates = readFXRates(); // ទាញអត្រាប្តូរប្រាក់

      // ------------------------------------------
      // កំណត់អត្តសញ្ញាណគណនីប្រភព (ក្រុមហ៊ុន) ថាកាត់ពីកុងណា?
      // ------------------------------------------
      let actualSourceAcc = sourceAccount;
      let isSenderKHR = false;
      let isSenderSubAccount = false;
      let senderSubIndex = -1;
      let jointSenderAcc = null;
      let juniorSenderAcc = null;
      let senderAvailableBal = 0;

      if (sourceAccount === "MAIN_USD") {
        actualSourceAcc = sender.accountNumber;
        senderAvailableBal = sender.balance;
      } else if (sourceAccount === "MAIN_KHR") {
        actualSourceAcc = sender.accountNumberKHR;
        isSenderKHR = true;
        senderAvailableBal = sender.balanceKHR;
      } else {
        // បើកាត់ពី Sub-Account
        senderSubIndex = sender.subAccounts.findIndex(
          (acc) => acc.accountNumber === sourceAccount,
        );
        if (senderSubIndex === -1) throw new Error("គណនីប្រភពមិនត្រឹមត្រូវ!");
        isSenderSubAccount = true;
        const subAcc = sender.subAccounts[senderSubIndex];
        actualSourceAcc = subAcc.accountNumber;
        isSenderKHR = subAcc.currency === "KHR";

        // ឆែកមើលក្រែងលោជាកុងកូន ឬកុងរួម
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

          // ឆែក Daily Limit កូន
          const dailyLimit = juniorSenderAcc.dailyLimit || 0;
          const dailySpent = juniorSenderAcc.dailySpent || 0;
          if (
            dailyLimit > 0 &&
            dailySpent + calculatedTotalAmount > dailyLimit
          ) {
            throw new Error(
              `កូនត្រូវបានកំណត់អោយចាយបានត្រឹម ${dailyLimit} ក្នុង១ថ្ងៃ (ថ្ងៃនេះចាយអស់ ${dailySpent} ហើយ)។`,
            );
          }
          senderAvailableBal = isSenderKHR
            ? juniorSenderAcc.balanceKHR || 0
            : juniorSenderAcc.balance || 0;
        } else {
          senderAvailableBal = subAcc.balance;
        }
      }

      // ឆែក Daily Limit ប៉ាម៉ាក់ (បើអ្នកផ្ញើជាកូនផ្ទាល់)
      if (sender.role === "junior") {
        const dailyLimit = sender.dailyLimit || 0;
        const dailySpent = sender.dailySpent || 0;
        let spentUsd = isSenderKHR
          ? calculatedTotalAmount / currentFXRates.usdToKhrSell
          : calculatedTotalAmount;
        if (dailyLimit > 0 && dailySpent + spentUsd > dailyLimit) {
          throw new Error(
            `អ្នកត្រូវបានកំណត់អោយចាយបានត្រឹម $${dailyLimit} ក្នុង១ថ្ងៃ!`,
          );
        }
      }

      // 🔒 ឆែកសមតុល្យលុយចុងក្រោយ
      if (senderAvailableBal < calculatedTotalAmount) {
        throw new Error("សមតុល្យគណនីរបស់អ្នកមិនគ្រប់គ្រាន់ទេ!");
      }

      // ------------------------------------------
      // កាត់លុយពីមេ (Sender)
      // ------------------------------------------
      if (isSenderSubAccount) {
        if (jointSenderAcc) {
          jointSenderAcc.balance -= calculatedTotalAmount;
          await jointSenderAcc.save({ session });
        } else if (juniorSenderAcc) {
          if (isSenderKHR) juniorSenderAcc.balanceKHR -= calculatedTotalAmount;
          else juniorSenderAcc.balance -= calculatedTotalAmount;
          juniorSenderAcc.dailySpent =
            (juniorSenderAcc.dailySpent || 0) + calculatedTotalAmount;
          await juniorSenderAcc.save({ session });

          if (isSenderKHR)
            sender.subAccounts[senderSubIndex].balanceKHR =
              juniorSenderAcc.balanceKHR;
          else
            sender.subAccounts[senderSubIndex].balance =
              juniorSenderAcc.balance;
          sender.markModified("subAccounts");
        } else {
          sender.subAccounts[senderSubIndex].balance -= calculatedTotalAmount;
          sender.markModified("subAccounts");
        }
      } else {
        if (isSenderKHR) sender.balanceKHR -= calculatedTotalAmount;
        else sender.balance -= calculatedTotalAmount;

        if (sender.role === "junior") {
          let spentUsd = isSenderKHR
            ? calculatedTotalAmount / currentFXRates.usdToKhrSell
            : calculatedTotalAmount;
          sender.dailySpent = (sender.dailySpent || 0) + spentUsd;
        }
      }
      await sender.save({ session });

      // Sync ទៅកុងប៉ាម៉ាក់បើអ្នកផ្ញើជាកូន
      if (sender.role === "junior" && sender.parentUsername) {
        let parentDoc = await User.findOne({
          username: sender.parentUsername,
        }).session(session);
        if (parentDoc) {
          const subIdx = parentDoc.subAccounts.findIndex(
            (acc) => acc.accountNumber === sender.accountNumber,
          );
          if (subIdx !== -1) {
            parentDoc.subAccounts[subIdx].balance = sender.balance;
            parentDoc.subAccounts[subIdx].balanceKHR = sender.balanceKHR;
            parentDoc.subAccounts[subIdx].dailySpent = sender.dailySpent;
            parentDoc.markModified("subAccounts");
            await parentDoc.save({ session });
          }
        }
      }

      // ------------------------------------------
      // បែងចែកលុយចូលកុងបុគ្គលិក (Receivers) & កត់ត្រា Transactions
      // ------------------------------------------
      const dateStr = new Date().toLocaleString("en-US", {
        timeZone: "Asia/Phnom_Penh",
        hour12: true,
      });
      const sharedRefId =
        "PRL-" + Math.floor(100000000 + Math.random() * 900000000); // លេខកូដវិក្កយបត្ររួម

      const finalSenderName = jointSenderAcc
        ? jointSenderAcc.accountName
        : sender.fullName || sender.username;
      let bulkTransactions = [];
      const io = req.app.get("io"); // សម្រាប់ Socket Alert

      for (let r of recipients) {
        let receiver = await User.findOne({
          $or: [
            { accountNumber: r.account },
            { accountNumberKHR: r.account },
            { "subAccounts.accountNumber": r.account },
          ],
        }).session(session);

        if (!receiver) throw new Error(`រកមិនឃើញគណនីបុគ្គលិក: ${r.account}`);

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

        // 💱 ប្តូរប្រាក់ស្វ័យប្រវត្តិ បើរូបិយប័ណ្ណខុសគ្នា
        if (!isSenderKHR && isReceiverKHR) {
          receiverAmount = parseFloat(r.amount) * currentFXRates.usdToKhrBuy;
        } else if (isSenderKHR && !isReceiverKHR) {
          receiverAmount = parseFloat(r.amount) / currentFXRates.usdToKhrSell;
        }

        // បូកលុយចូលកុង
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

          // Sync លុយទៅកុងប៉ាម៉ាក់ បើអ្នកទទួលជាកូន
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
                  parentDoc.subAccounts[subIdx].balanceKHR =
                    receiver.balanceKHR;
                else parentDoc.subAccounts[subIdx].balance = receiver.balance;
                parentDoc.markModified("subAccounts");
                if (parentDoc.username !== sender.username)
                  await parentDoc.save({ session });
              }
            }
          }
        }

        // កត់ត្រា Transaction សងខាង
        const itemHash = generateHash();
        const finalReceiverName = jointReceiverAcc
          ? jointReceiverAcc.accountName
          : receiver.fullName || receiver.username;
        const remarkText =
          r.remark || (type === "bulk" ? "បើកប្រាក់បៀវត្សរ៍" : "ទូទាត់ប្រាក់");

        const senderTrx = {
          username: sender.username,
          refId: sharedRefId,
          hash: itemHash,
          date: dateStr,
          type: type === "bulk" ? "Payroll Transfer" : "Transfer",
          amount: -parseFloat(r.amount), // កាត់លុយតាមលុយដើម
          currency: isSenderKHR ? "KHR" : "USD",
          fee: 0,
          senderName: finalSenderName,
          receiverName: finalReceiverName,
          receiverAcc: actualReceiverAccNum,
          senderAcc: actualSourceAcc,
          trxMethod: type === "bulk" ? "Auto Payouts" : "Account Transfer",
          remark: remarkText,
          status: "Success",
        };

        const receiverTrx = {
          username: receiver.username,
          refId: sharedRefId,
          hash: itemHash,
          date: dateStr,
          type: type === "bulk" ? "Payroll Received" : "Receive",
          amount: receiverAmount, // លុយដែលបានប្តូរហើយ
          currency: isReceiverKHR ? "KHR" : "USD",
          fee: 0,
          senderName: finalSenderName,
          receiverName: finalReceiverName,
          receiverAcc: actualReceiverAccNum,
          senderAcc: actualSourceAcc,
          trxMethod: type === "bulk" ? "Auto Payouts" : "Account Transfer",
          remark: remarkText,
          status: "Success",
        };

        // Save Transaction អោយអ្នកផ្ញើ (បើជាកុងរួម ដាក់អោយសមាជិកទាំងអស់)
        if (jointSenderAcc) {
          for (let m of jointSenderAcc.members) {
            if (m.status === "active")
              bulkTransactions.push({ ...senderTrx, username: m.username });
          }
        } else {
          bulkTransactions.push(senderTrx);
        }

        // Save Transaction អោយអ្នកទទួល + បាញ់ Notification
        const currencySymbol = isReceiverKHR ? "៛" : "$";
        const senderMsgName = jointSenderAcc
          ? `គណនីរួម ${jointSenderAcc.accountName}`
          : finalSenderName;
        const notifPayload = {
          title: "ទទួលបានទឹកប្រាក់! 💸",
          message: `អ្នកទទួលបាន ${currencySymbol}${receiverAmount.toLocaleString()} ពី ${senderMsgName}។`,
          type: "transfer_receive",
          date: dateStr,
          isRead: false,
        };

        if (jointReceiverAcc) {
          for (let m of jointReceiverAcc.members) {
            if (m.status === "active") {
              bulkTransactions.push({ ...receiverTrx, username: m.username });
              // បាញ់ Notif
              const uDoc = await User.findOne({ username: m.username }).session(
                session,
              );
              if (uDoc) {
                uDoc.notifications = uDoc.notifications || [];
                uDoc.notifications.push(notifPayload);
                uDoc.markModified("notifications");
                await uDoc.save({ session });
                if (io)
                  io.to(m.username).emit("paymentReceived", {
                    amount: receiverAmount,
                    currency: isReceiverKHR ? "KHR" : "USD",
                    senderName: finalSenderName,
                  });
              }
            }
          }
        } else {
          bulkTransactions.push(receiverTrx);
          receiver.notifications = receiver.notifications || [];
          receiver.notifications.push(notifPayload);
          receiver.markModified("notifications");
          await receiver.save({ session });
          if (io)
            io.to(receiver.username).emit("paymentReceived", {
              amount: receiverAmount,
              currency: isReceiverKHR ? "KHR" : "USD",
              senderName: finalSenderName,
            });
        }
      }

      // ៦. បញ្ចូល Transactions ទាំងអស់ទៅក្នុង Database តែម្តង
      if (bulkTransactions.length > 0) {
        await Transaction.insertMany(bulkTransactions, { session });
      }

      // ៧. កត់ត្រាចូលក្នុងប្រវត្តិ Payroll ថាបានដំណើរការជោគជ័យ
      const newRecord = new Payroll({
        userId: username,
        type: type,
        name: name,
        sourceAccount: actualSourceAcc,
        recipients,
        totalAmount: calculatedTotalAmount,
        frequency: "once",
        isTemplate: false,
        status: "completed",
        lastExecutedAt: new Date(),
      });
      await newRecord.save({ session });

      // បញ្ជាក់ការរក្សាទុកទិន្នន័យទាំងអស់ (Commit)
      await session.commitTransaction();
      session.endSession();

      return res
        .status(200)
        .json({
          success: true,
          message:
            type === "bulk"
              ? "ការបើកប្រាក់ខែត្រូវបានដំណើរការជោគជ័យ!"
              : "ប្រាក់ត្រូវបានផ្ទេរដោយជោគជ័យ!",
        });
    }

    // ==========================================
    // 📁 ខ. ករណី Save ជា Template ឬ Schedule (មិនទាន់កាត់លុយ)
    // ==========================================
    if (isTemplate) {
      let existingTemplate = null;

      if (templateId) existingTemplate = await Payroll.findById(templateId);
      if (!existingTemplate)
        existingTemplate = await Payroll.findOne({
          userId: username,
          name: name,
          isTemplate: true,
        });

      if (existingTemplate) {
        existingTemplate.name = name;
        existingTemplate.recipients = recipients;
        existingTemplate.totalAmount = calculatedTotalAmount;
        await existingTemplate.save();

        await session.abortTransaction();
        session.endSession();
        return res
          .status(200)
          .json({
            success: true,
            message: "បានធ្វើបច្ចុប្បន្នភាព Template រួចរាល់!",
          });
      }
    }

    const newSchedule = await Payroll.create(
      [
        {
          userId: username,
          type,
          name,
          sourceAccount,
          recipients,
          totalAmount: calculatedTotalAmount,
          frequency,
          scheduleDetails,
          isTemplate: isTemplate || false,
          status: isTemplate ? "draft" : "active",
        },
      ],
      { session },
    );

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: isTemplate
        ? "បានរក្សាទុក Template ថ្មីជោគជ័យ!"
        : "បានបង្កើតកាលវិភាគដោយជោគជ័យ!",
    });
  } catch (error) {
    // 🚨 បើមាន Error ណាមួយកើតឡើង កូដនឹង Rollback លុយនិងទិន្នន័យមកដើមវិញទាំងអស់
    await session.abortTransaction();
    session.endSession();
    console.error("CREATE PAYROLL ERROR:", error.message);
    res
      .status(500)
      .json({
        success: false,
        message: error.message || "មានបញ្ហាក្នុងការរក្សាទុកទិន្នន័យ!",
      });
  }
};

// ========================================================================
// 📌 ២. ទាញយក Template ចាស់ៗមកបង្ហាញ
// ========================================================================
const getTemplates = async (req, res) => {
  try {
    const templates = await Payroll.find({
      userId: req.user.username,
      isTemplate: true,
    }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: templates });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        message: "មានបញ្ហាក្នុងការទាញយកទិន្នន័យ Template",
      });
  }
};

// ========================================================================
// 📌 ៣. ទាញយកប្រវត្តិការទូទាត់ (Payout History)
// ========================================================================
const getHistory = async (req, res) => {
  try {
    const historyList = await Payroll.find({
      userId: req.user.username,
      isTemplate: false,
    }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: historyList });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        message: "មានបញ្ហាក្នុងการទាញយកប្រវត្តិការទូទាត់!",
      });
  }
};

// ========================================================================
// 📌 ៤. ផ្លាស់ប្តូរ Status (Active/Paused) របស់កាលវិភាគ
// ========================================================================
const updateScheduleStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const updated = await Payroll.findOneAndUpdate(
      { _id: id, userId: req.user.username },
      { status },
      { new: true },
    );
    if (!updated)
      return res
        .status(404)
        .json({ success: false, message: "រកមិនឃើញកាលវិភាគនេះទេ!" });
    res
      .status(200)
      .json({
        success: true,
        message: "បានអាប់ដេតស្ថានភាពជោគជ័យ!",
        data: updated,
      });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "មានបញ្ហាក្នុងការអាប់ដេតស្ថានភាព!" });
  }
};

// ========================================================================
// 📌 ៥. លុបកាលវិភាគ ឬ ប្រវត្តិចេញពី Database
// ========================================================================
const deleteSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Payroll.findOneAndDelete({
      _id: id,
      userId: req.user.username,
    });
    if (!deleted)
      return res
        .status(404)
        .json({ success: false, message: "រកមិនឃើញទិន្នន័យដែលត្រូវលុបទេ!" });
    res.status(200).json({ success: true, message: "បានលុបជោគជ័យ!" });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "មានបញ្ហាក្នុងការលុបទិន្នន័យ!" });
  }
};

// ========================================================================
// 📌 ៦. លុប Template ចោល
// ========================================================================
const deleteTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Payroll.findOneAndDelete({
      _id: id,
      userId: req.user.username,
      isTemplate: true,
    });
    if (!deleted)
      return res
        .status(404)
        .json({ success: false, message: "រកមិនឃើញ Template នេះទេ!" });
    res.status(200).json({ success: true, message: "បានលុប Template ជោគជ័យ!" });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "មានបញ្ហាក្នុងការលុប Template!" });
  }
};

// ========================================================================
// 📌 ៧. កែសម្រួលកាលវិភាគដែលកំពុងរត់ (Update Active/Paused Payroll)
// ========================================================================
const updateSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const { recipients, frequency, scheduleDetails, name, sourceAccount } =
      req.body;

    let calculatedTotalAmount = 0;
    for (let r of recipients) {
      if (r.amount <= 0)
        return res
          .status(400)
          .json({ success: false, message: "ចំនួនទឹកប្រាក់ត្រូវតែធំជាង ០!" });
      calculatedTotalAmount += Number(r.amount);
    }

    const updated = await Payroll.findOneAndUpdate(
      { _id: id, userId: req.user.username },
      {
        recipients,
        totalAmount: calculatedTotalAmount,
        frequency,
        scheduleDetails,
        name,
        sourceAccount,
      },
      { new: true },
    );

    if (!updated)
      return res
        .status(404)
        .json({ success: false, message: "រកមិនឃើញកាលវិភាគនេះទេ!" });
    res
      .status(200)
      .json({
        success: true,
        message: "បានកែសម្រួលកាលវិភាគជោគជ័យ!",
        data: updated,
      });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "មានបញ្ហាក្នុងការកែសម្រួល!" });
  }
};

module.exports = {
  createSchedule,
  getTemplates,
  getHistory,
  updateScheduleStatus,
  deleteSchedule,
  deleteTemplate,
  updateSchedule,
};
