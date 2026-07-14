const express = require("express");
const router = express.Router();

// ទាញយក Controller ដែលយើងបានសរសេរមុននេះ
const accountController = require("../controllers/accountController");

// ==========================================
// API Routes សម្រាប់ Account
// ==========================================

// 1. API សម្រាប់ទិញ/បង្កើតគណនីលេខពិសេស (Premium Account)
router.post("/create-premium", accountController.createPremiumAccount);

// (ថ្ងៃក្រោយ បងអាចថែម API ផ្សេងៗទៀតនៅទីនេះ)
// router.post("/create-joint", accountController.createJointAccount);
// router.post("/create-pocket", accountController.createPocketAccount);

module.exports = router;
