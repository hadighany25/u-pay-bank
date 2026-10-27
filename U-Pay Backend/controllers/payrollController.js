// ============================================================================
// ឯកសារ: controllers/payrollController.js
// អត្ថន័យ: ខួរក្បាលស្នូលសម្រាប់គ្រប់គ្រងការបើកប្រាក់ខែ និងទូទាត់ស្វ័យប្រវត្តិ (Strict _id Binding)
// ============================================================================

const mongoose = require("mongoose");
const Payroll = require("../models/Payroll");
const User = require("../models/User");
const Transaction = require("../models/Transaction");
const JointAccount = require("../models/JointAccount");
const Notification = require("../models/Notification");
const { readFXRates } = require("../services/systemService");

// ==========================================
// 🛠️ ផ្នែកទី ០៖ Function ជំនួយ (Helpers) សម្រាប់បង្កើត Hash & Ref ID
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

// ============================================================================
// 📌 ផ្នែកទី ១៖ បង្កើតកាលវិភាគថ្មី ឬ បើកប្រាក់ខែភ្លាមៗ (Create Schedule or Process Now)
// ============================================================================
const createSchedule = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const senderId = req.user._id || req.user.id;
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

    // 🔒 ត្រួតពិនិត្យបញ្ជីអ្នកទទួល (Recipients Validation)
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "មិនមានបញ្ជីអ្នកទទួលប្រាក់ទេ!" });
    }

    // 🔒 គណនាលុយសរុប (Calculate Total Amount)
    let calculatedTotalAmount = 0;
    for (let r of recipients) {
      const amt = parseFloat(r.amount);
      if (isNaN(amt) || amt <= 0) {
        throw new Error(`ចំនួនទឹកប្រាក់របស់គណនី ${r.account} ត្រូវតែធំជាង ០!`);
      }
      calculatedTotalAmount += amt;
    }

    // 🌟 ទាញយកទិន្នន័យ Sender តាម _id ផ្ទាល់
    const sender = await User.findById(senderId).session(session);
    if (!sender) throw new Error("រកគណនីអ្នកផ្ញើមិនឃើញ!");
    if (sender.isFrozen) throw new Error("គណនីរបស់អ្នកត្រូវបានផ្អាក!");

    const currentFXRates = readFXRates();
    const dateStr = new Date().toLocaleString("en-US", {
      timeZone: "Asia/Phnom_Penh",
      hour12: true,
    });

    // ------------------------------------------
    // កំណត់អត្តសញ្ញាណគណនីប្រភព (Source Account Identification)
    // ------------------------------------------
    let actualSourceAcc = sourceAccount;
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

    if (sourceAccount === "MAIN_USD" || sourceAccount === mainUsdNum) {
      actualSourceAcc = mainUsdNum;
      senderAvailableBal =
        sender.mainAccounts?.USD?.balance ?? sender.balance ?? 0;
    } else if (sourceAccount === "MAIN_KHR" || sourceAccount === mainKhrNum) {
      actualSourceAcc = mainKhrNum;
      isSenderKHR = true;
      senderAvailableBal =
        sender.mainAccounts?.KHR?.balance ?? sender.balanceKHR ?? 0;
    } else {
      senderSubIndex = sender.subAccounts.findIndex(
        (acc) => acc.accountNumber === sourceAccount,
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
          $or: [
            { "mainAccounts.USD.accountNumber": actualSourceAcc },
            { accountNumber: actualSourceAcc },
          ],
        }).session(session);
        if (!juniorSenderAcc) throw new Error("រកគណនីកូនមិនឃើញទេ!");

        const dailyLimit =
          juniorSenderAcc.mainAccounts?.USD?.dailyLimit ||
          juniorSenderAcc.dailyLimit ||
          0;
        const dailySpent =
          juniorSenderAcc.mainAccounts?.USD?.dailySpent ||
          juniorSenderAcc.dailySpent ||
          0;
        if (dailyLimit > 0 && dailySpent + calculatedTotalAmount > dailyLimit) {
          throw new Error(
            `កូនត្រូវបានកំណត់អោយចាយបានត្រឹម $${dailyLimit} ក្នុង១ថ្ងៃ។`,
          );
        }
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
    }

    const scheduleCurrency = isSenderKHR ? "KHR" : "USD";

    // ==========================================
    // 🚀 ក. ករណី Process Now (បើកប្រាក់ខែភ្លាមៗ)
    // ==========================================
    if (processNow) {
      if (senderAvailableBal < calculatedTotalAmount) {
        throw new Error("សមតុល្យគណនីរបស់អ្នកមិនគ្រប់គ្រាន់ទេ!");
      }

      // 🌟 បង្កើតឯកសារ Payroll ថ្មីពេល Process Now ជោគជ័យ
      const newRecord = new Payroll({
        creatorId: sender._id,
        username: sender.username,
        type: type,
        name: name,
        currency: scheduleCurrency,
        sourceAccount: actualSourceAcc,
        recipients,
        totalAmount: calculatedTotalAmount,
        frequency: "once",
        isTemplate: false,
        status: "completed",
        executionCount: 1,
        lastExecutedAt: new Date(),
      });
      await newRecord.save({ session });

      await session.commitTransaction();
      session.endSession();

      return res.status(200).json({
        success: true,
        message:
          type === "bulk"
            ? "ការបើកប្រាក់ខែត្រូវបានដំណើរការជោគជ័យ!"
            : "ប្រាក់ត្រូវបានផ្ទេរដោយជោគជ័យ!",
      });
    }

    // ==========================================
    // 📁 ខ. ករណី Save ជា Template ឬ Schedule
    // ==========================================
    if (isTemplate) {
      let existingTemplate = templateId
        ? await Payroll.findById(templateId)
        : null;
      if (!existingTemplate) {
        existingTemplate = await Payroll.findOne({
          creatorId: sender._id,
          name: name,
          isTemplate: true,
        });
      }

      if (existingTemplate) {
        existingTemplate.name = name;
        existingTemplate.recipients = recipients;
        existingTemplate.totalAmount = calculatedTotalAmount;
        await existingTemplate.save();

        await session.abortTransaction();
        session.endSession();
        return res.status(200).json({
          success: true,
          message: "បានធ្វើបច្ចុប្បន្នភាព Template រួចរាល់!",
        });
      }
    }

    // 🌟 បង្កើត Template ឬកាលវិភាគថ្មី
    await Payroll.create(
      [
        {
          creatorId: sender._id,
          username: sender.username,
          type,
          name,
          currency: scheduleCurrency,
          sourceAccount: actualSourceAcc,
          recipients,
          totalAmount: calculatedTotalAmount,
          frequency,
          scheduleDetails,
          isTemplate: isTemplate || false,
          status: isTemplate ? "draft" : "active",
          executionCount: 0,
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
    await session.abortTransaction();
    session.endSession();
    console.error("CREATE PAYROLL ERROR:", error);
    res.status(500).json({
      success: false,
      message: error.message || "មានបញ្ហាក្នុងការរក្សាទុកទិន្នន័យ!",
    });
  }
};

// ============================================================================
// 📌 ផ្នែកទី ២៖ ការទាញយក Template និងប្រវត្តិ (GETTERS)
// ============================================================================
const getTemplates = async (req, res) => {
  try {
    const templates = await Payroll.find({
      creatorId: req.user._id,
      isTemplate: true,
    }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: templates });
  } catch (error) {
    console.error("GET TEMPLATES ERROR:", error);
    res.status(500).json({
      success: false,
      message: "មានបញ្ហាក្នុងការទាញយកទិន្នន័យ Template",
    });
  }
};

const getHistory = async (req, res) => {
  try {
    const historyList = await Payroll.find({
      creatorId: req.user._id,
      isTemplate: false,
    }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: historyList });
  } catch (error) {
    console.error("GET HISTORY ERROR:", error);
    res.status(500).json({
      success: false,
      message: "មានបញ្ហាក្នុងការទាញយកប្រវត្តិការទូទាត់!",
    });
  }
};

// ============================================================================
// 📌 ផ្នែកទី ៣៖ ការកែប្រែ និងលុបកាលវិភាគ (MANAGEMENT & DELETION)
// ============================================================================
const updateScheduleStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const updated = await Payroll.findOneAndUpdate(
      { _id: id, creatorId: req.user._id },
      { status },
      { new: true },
    );

    if (!updated)
      return res
        .status(404)
        .json({ success: false, message: "រកមិនឃើញកាលវិភាគនេះទេ!" });
    res.status(200).json({
      success: true,
      message: "បានអាប់ដេតស្ថានភាពជោគជ័យ!",
      data: updated,
    });
  } catch (error) {
    console.error("UPDATE STATUS ERROR:", error);
    res
      .status(500)
      .json({ success: false, message: "មានបញ្ហាក្នុងការអាប់ដេតស្ថានភាព!" });
  }
};

const deleteSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Payroll.findOneAndDelete({
      _id: id,
      creatorId: req.user._id,
    });

    if (!deleted)
      return res
        .status(404)
        .json({ success: false, message: "រកមិនឃើញទិន្នន័យដែលត្រូវលុបទេ!" });
    res.status(200).json({ success: true, message: "បានលុបជោគជ័យ!" });
  } catch (error) {
    console.error("DELETE SCHEDULE ERROR:", error);
    res
      .status(500)
      .json({ success: false, message: "មានបញ្ហាក្នុងការលុបទិន្នន័យ!" });
  }
};

const deleteTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Payroll.findOneAndDelete({
      _id: id,
      creatorId: req.user._id,
      isTemplate: true,
    });

    if (!deleted)
      return res
        .status(404)
        .json({ success: false, message: "រកមិនឃើញ Template នេះទេ!" });
    res.status(200).json({ success: true, message: "បានលុប Template ជោគជ័យ!" });
  } catch (error) {
    console.error("DELETE TEMPLATE ERROR:", error);
    res
      .status(500)
      .json({ success: false, message: "មានបញ្ហាក្នុងការលុប Template!" });
  }
};

const updateSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      recipients,
      frequency,
      scheduleDetails,
      name,
      sourceAccount,
      processNow,
    } = req.body;

    let calculatedTotalAmount = 0;
    for (let r of recipients) {
      if (r.amount <= 0)
        return res
          .status(400)
          .json({ success: false, message: "ចំនួនទឹកប្រាក់ត្រូវតែធំជាង ០!" });
      calculatedTotalAmount += Number(r.amount);
    }

    const newStatus = processNow ? "processing" : "active";

    const updated = await Payroll.findOneAndUpdate(
      { _id: id, creatorId: req.user._id },
      {
        recipients,
        totalAmount: calculatedTotalAmount,
        frequency,
        scheduleDetails,
        name,
        sourceAccount,
        status: newStatus,
      },
      { new: true },
    );

    if (!updated)
      return res
        .status(404)
        .json({ success: false, message: "រកមិនឃើញកាលវិភាគនេះទេ!" });

    if (processNow) {
      const { executePayroll } = require("../services/payrollProcessor");
      const success = await executePayroll(updated);

      if (success) {
        updated.status =
          updated.frequency === "once" || frequency === "once"
            ? "completed"
            : "active";
        updated.lastExecutedAt = new Date();
        updated.executionCount = (updated.executionCount || 0) + 1;
        await updated.save();
      } else {
        updated.status = "failed";
        updated.failureReason =
          "មិនអាចកាត់ប្រាក់បាន (អាចដោយសារសមតុល្យមិនគ្រប់គ្រាន់)";
        await updated.save();
        return res.status(500).json({
          success: false,
          message: "បានកែសម្រួលរួចរាល់ ប៉ុន្តែបរាជ័យក្នុងការកាត់ប្រាក់!",
        });
      }
    }

    res.status(200).json({
      success: true,
      message: "បានកែសម្រួលកាលវិភាគជោគជ័យ!",
      data: updated,
    });
  } catch (error) {
    console.error("UPDATE SCHEDULE ERROR:", error);
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
