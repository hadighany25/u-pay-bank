// ============================================================================
// ឯកសារ: routes/payrollRouter.js
// អត្ថន័យ: បណ្តាញបញ្ជូន (Routes) សម្រាប់គ្រប់គ្រងប្រព័ន្ធបើកប្រាក់ខែស្វ័យប្រវត្តិ
// ============================================================================

const express = require("express");
const router = express.Router();

// 🛡️ Middleware សម្រាប់ផ្ទៀងផ្ទាត់ Token (Login Check)
const { verifyUser } = require("../middleware/authMiddleware");

// 📦 ហៅបញ្ចូល Controller Functions ទាំងអស់
const {
  createSchedule,
  getTemplates,
  getHistory,
  updateScheduleStatus,
  deleteSchedule,
  deleteTemplate,
  updateSchedule,
} = require("../controllers/payrollController");

// ==========================================
// 🚀 API Routes ទាំងអស់ត្រូវបានការពារដោយ verifyUser
// ==========================================

// ១. បង្កើតកាលវិភាគ ឬបើកប្រាក់ខែភ្លាមៗ (Single / Bulk)
router.post("/create", verifyUser, createSchedule);

// ២. ទាញយក Template ដែលបាន Save ទុក
router.get("/templates", verifyUser, getTemplates);

// ៣. ទាញយកប្រវត្តិការទូទាត់ (Payout History)
router.get("/history", verifyUser, getHistory);

// ៤. 🌟 លុប Template ក្នុង Web Sheet ចោល (ត្រូវដាក់ពីលើ /:id ដើម្បីការពារការជាន់ Route)
router.delete("/templates/:id", verifyUser, deleteTemplate);

// ៥. កែប្រែស្ថានភាព (Pause / Resume កាលវិភាគ)
router.patch("/:id/status", verifyUser, updateScheduleStatus);

// ៦. កែសម្រួល និងរត់កាលវិភាគចាស់ឡើងវិញ (Edit & Retry)
router.patch("/update/:id", verifyUser, updateSchedule);

// ៧. លុបកាលវិភាគ ឬប្រវត្តិការទូទាត់ចោល
router.delete("/:id", verifyUser, deleteSchedule);

module.exports = router;
