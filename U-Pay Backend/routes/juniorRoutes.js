const express = require("express");
const router = express.Router();

// ទាញយក Controller ទាំង៣ មកប្រើ
const {
  createJuniorAccount,
  toggleFreeze,
  updateDailyLimit,
} = require("../controllers/juniorController");
const { verifyUser } = require("../middleware/authMiddleware");

// ==========================================
// 👶 ខ្សែ API សម្រាប់គណនីកុមារ (Junior Account)
// Path ដើមគឺ: /api/account/junior
// ==========================================

// បង្កើតគណនីកូន: (POST /api/account/junior/create)
router.post("/create", verifyUser, createJuniorAccount);

// ផ្អាក ឬ បើកគណនីកូន: (POST /api/account/junior/toggle-freeze)
router.post("/toggle-freeze", verifyUser, toggleFreeze);

// កំណត់រនាំងចំណាយ: (POST /api/account/junior/update-limit)
router.post("/update-limit", verifyUser, updateDailyLimit);

module.exports = router;
