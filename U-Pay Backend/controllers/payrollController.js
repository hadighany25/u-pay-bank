// controllers/payrollController.js
const Payroll = require("../models/Payroll");
const { executePayroll } = require("../services/payrollProcessor");

// 📌 ១. បង្កើតកាលវិភាគថ្មី ឬ Update Template ចាស់ (Overwrite)
const createSchedule = async (req, res) => {
  try {
    const uid = String(req.user.id || req.user._id || req.user.username);
    const {
      templateId, // 👈 ទទួលយក ID ពី Frontend
      type,
      name,
      sourceAccount,
      recipients,
      totalAmount,
      frequency,
      scheduleDetails,
      isTemplate,
      processNow,
    } = req.body;

    if (!recipients || recipients.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "មិនមានបញ្ជីអ្នកទទួលប្រាក់ទេ!" });
    }

    if (processNow) {
      // 🔥 ទាញយកទិន្នន័យ User ដើម្បីយកលេខកុងពិតប្រាកដ
      const User = require("../models/User");
      const senderUser = await User.findOne({
        $or: [{ id: uid }, { username: uid }, { accountNumber: uid }],
      });

      let actualSourceAcc = sourceAccount;
      if (senderUser) {
        if (sourceAccount === "MAIN_USD")
          actualSourceAcc = senderUser.accountNumber;
        else if (sourceAccount === "MAIN_KHR")
          actualSourceAcc = senderUser.accountNumberKHR || sourceAccount;
      }

      const newRecord = await Payroll.create({
        userId: uid,
        type,
        name,
        sourceAccount: actualSourceAcc, // 👈 ប្រើលេខកុងពិតប្រាកដនៅទីនេះ
        recipients,
        totalAmount,
        frequency: "once",
        isTemplate: false,
        status: "completed",
      });
      await executePayroll(newRecord);
      return res
        .status(200)
        .json({ success: true, message: "ការទូទាត់ត្រូវបានបញ្ជូនដោយជោគជ័យ!" });
    }

    // 🔥 ជួសជុលបញ្ហា Duplicate Template (Update Overwrite)
    if (isTemplate) {
      let existingTemplate = null;

      // ទី១: ស្វែងរកតាម ID បើមាន (ពេលគេចុច Edit ពីកុងចាស់)
      if (templateId) {
        existingTemplate = await Payroll.findById(templateId);
      }

      // ទី២: ស្វែងរកតាមឈ្មោះ បើគ្មាន ID (ពេលគេវាយឈ្មោះជាន់គ្នា)
      if (!existingTemplate) {
        existingTemplate = await Payroll.findOne({
          $or: [{ userId: uid }, { userId: req.user.username }],
          name: name,
          isTemplate: true,
        });
      }

      if (existingTemplate) {
        // បើមានហើយ Update ទិន្នន័យពីលើតែម្តង
        existingTemplate.name = name;
        existingTemplate.recipients = recipients;
        existingTemplate.totalAmount = totalAmount;
        await existingTemplate.save();

        return res.status(200).json({
          success: true,
          message: "បានធ្វើបច្ចុប្បន្នភាព (Update) Template រួចរាល់!",
          data: existingTemplate,
        });
      }
    }

    // បើរកមិនឃើញសោះ គឺបង្កើតថ្មីធម្មតា
    const newSchedule = await Payroll.create({
      userId: uid,
      type,
      name,
      sourceAccount,
      recipients,
      totalAmount,
      frequency,
      scheduleDetails,
      isTemplate: isTemplate || false,
      status: isTemplate ? "draft" : "active",
    });

    res.status(200).json({
      success: true,
      message: isTemplate
        ? "បានរក្សាទុក Template ថ្មីជោគជ័យ!"
        : "បានបង្កើតកាលវិភាគដោយជោគជ័យ!",
      data: newSchedule,
    });
  } catch (error) {
    console.error("Create Schedule Error:", error.message);
    res
      .status(500)
      .json({ success: false, message: "មានបញ្ហាក្នុងការរក្សាទុកទិន្នន័យ!" });
  }
};

// 📌 ២. ទាញយក Template ចាស់ៗមកបង្ហាញ
const getTemplates = async (req, res) => {
  try {
    const uid = String(req.user.id || req.user._id || req.user.username);

    // 🔥 ជួសជុលបញ្ហាបាត់ Template: ស្វែងរកទាំងតាម ID ទាំងតាម Username
    const templates = await Payroll.find({
      $or: [
        { userId: uid },
        { userId: req.user.username },
        { userId: String(req.user._id) },
      ],
      isTemplate: true,
    }).sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: templates });
  } catch (error) {
    console.error("Get Templates Error:", error);
    res.status(500).json({
      success: false,
      message: "មានបញ្ហាក្នុងការទាញយកទិន្នន័យ Template",
    });
  }
};

// 📌 ៣. ទាញយកប្រវត្តិការទូទាត់ (Payout History) របស់អ្នកប្រើប្រាស់
const getHistory = async (req, res) => {
  try {
    const uid = String(req.user.id || req.user._id || req.user.username);

    // ទាញយកកាលវិភាគទាំងអស់របស់អ្នកប្រើប្រាស់ (ទាំង completed, active, failed)
    const historyList = await Payroll.find({
      $or: [
        { userId: uid },
        { userId: req.user.username },
        { userId: String(req.user._id) },
      ],
      isTemplate: false, // เอาเฉพาะประวัติการจ่ายจริง ไม่เอา Template
    }).sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: historyList });
  } catch (error) {
    console.error("Get History Error:", error);
    res.status(500).json({
      success: false,
      message: "មានបញ្ហាក្នុងการទាញយកប្រវត្តិការទូទាត់!",
    });
  }
};

// 📌 ៤. ផ្លាស់ប្តូរ Status (Active/Paused) របស់កាលវិភាគ
const updateScheduleStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const updated = await Payroll.findByIdAndUpdate(
      id,
      { status },
      { new: true },
    );
    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "រកមិនឃើញកាលវិភាគនេះទេ!" });
    }

    res.status(200).json({
      success: true,
      message: "បានអាប់ដេតស្ថានភាពជោគជ័យ!",
      data: updated,
    });
  } catch (error) {
    console.error("Update Status Error:", error);
    res
      .status(500)
      .json({ success: false, message: "មានបញ្ហាក្នុងការអាប់ដេតស្ថានភាព!" });
  }
};

// 📌 ៥. លុបកាលវិភាគ ឬ ប្រវត្តិចេញពី Database
const deleteSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Payroll.findByIdAndDelete(id);
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "រកមិនឃើញទិន្នន័យដែលត្រូវលុបទេ!" });
    }

    res.status(200).json({ success: true, message: "បានលុបជោគជ័យ!" });
  } catch (error) {
    console.error("Delete Schedule Error:", error);
    res
      .status(500)
      .json({ success: false, message: "មានបញ្ហាក្នុងការលុបទិន្នន័យ!" });
  }
};

// 📌 ៦. លុប Template ចោល
const deleteTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Payroll.findOneAndDelete({
      _id: id,
      isTemplate: true,
    });

    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "រកមិនឃើញ Template នេះទេ!" });
    }

    res.status(200).json({ success: true, message: "បានលុប Template ជោគជ័យ!" });
  } catch (error) {
    console.error("Delete Template Error:", error);
    res
      .status(500)
      .json({ success: false, message: "មានបញ្ហាក្នុងការលុប Template!" });
  }
};

// 📌 ៧. កែសម្រួលកាលវិភាគដែលកំពុងរត់ (Update Active/Paused Payroll)
const updateSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      recipients,
      totalAmount,
      frequency,
      scheduleDetails,
      name,
      sourceAccount,
    } = req.body;

    const updated = await Payroll.findByIdAndUpdate(
      id,
      {
        recipients,
        totalAmount,
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
    console.error("Update Schedule Error:", error);
    res
      .status(500)
      .json({ success: false, message: "មានបញ្ហាក្នុងការកែសម្រួល!" });
  }
};

// កុំភ្លេចបន្ថែមចូលក្នុង module.exports
module.exports = {
  createSchedule,
  getTemplates,
  getHistory,
  updateScheduleStatus,
  deleteSchedule,
  deleteTemplate,
  updateSchedule,
};
