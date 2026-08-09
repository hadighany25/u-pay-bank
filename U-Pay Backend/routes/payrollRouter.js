// routes/payrollRouter.js
const express = require("express");
const router = express.Router();

// ⚠️ ប្រើប្រាស់ verifyUser តាមកូដដែលមានស្រាប់របស់បង
const { verifyUser } = require("../middleware/authMiddleware");

// 🔥 កុំភ្លេច bring in getHistory មកជាមួយផង
const {
  createSchedule,
  getTemplates,
  getHistory,
  updateScheduleStatus,
  deleteSchedule,
  deleteTemplate,
  updateSchedule,
} = require("../controllers/payrollController");

// ប្រើ verifyUser ដើម្បីការពារ API ទាំងអស់នេះ
router.post("/create", verifyUser, createSchedule);
router.get("/templates", verifyUser, getTemplates);
router.get("/history", verifyUser, getHistory); // 👈 ឥឡូវស្គាល់ getHistory ແລ້ວ 💯
router.patch("/:id/status", verifyUser, updateScheduleStatus);
router.delete("/:id", verifyUser, deleteSchedule);
router.delete("/templates/:id", verifyUser, deleteTemplate); // 👈 បន្ថែមផ្លូវនេះសម្រាប់លុប Template
router.patch("/update/:id", verifyUser, updateSchedule); // 👈 បន្ថែមផ្លូវនេះ

module.exports = router;
