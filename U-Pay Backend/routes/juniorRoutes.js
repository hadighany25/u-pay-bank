const express = require("express");
const router = express.Router();

// ទាញយក Controller និង Middleware
const { createJuniorAccount } = require("../controllers/juniorController");
const { verifyUser } = require("../middleware/authMiddleware");

// ==========================================
// 👶 ខ្សែ API សម្រាប់គណនីកុមារ (Junior Account)
// Path ដើមគឺ: /api/account/junior
// ==========================================

// បង្កើតគណនីកូន: (POST /api/account/junior/create)
router.post("/create", verifyUser, createJuniorAccount);

// ថ្ងៃក្រោយបងអាចថែម API ផ្សេងៗនៅទីនេះបានយ៉ាងងាយស្រួល ឧទាហរណ៍៖
// router.post("/update-limit", verifyUser, updateDailyLimit);
// router.post("/freeze", verifyUser, freezeAccount);

module.exports = router;
