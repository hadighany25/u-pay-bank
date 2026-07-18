const express = require("express");
const router = express.Router();

// 🔥 កែទី១៖ ដូរទៅជា transactionController.js តាមរូបភាពជាក់ស្តែង
const transactionController = require("../controllers/transactionController");

// 🔥 កែទី២៖ លុបអក្សរ s ចេញពីពាក្យ middleware តាមរូបភាពជាក់ស្តែង
const { verifyToken } = require("../middleware/authMiddleware");

// ==========================================
// 💸 មុខងារវេរលុយ និង ទូទាត់ប្រាក់
// ==========================================
// ឆែកឈ្មោះអ្នកទទួលមុនពេលវេរលុយ
router.post("/check", verifyToken, transactionController.checkAccount);

// វេរលុយ (ទៅកាន់គណនីធម្មតា, គណនីរួម, ឬ Merchant)
router.post("/submit", verifyToken, transactionController.transfer);

// ==========================================
// 🧾 មុខងារបង់វិក្កយបត្រ (PayHub)
// ==========================================
router.post("/bill/scan", verifyToken, transactionController.scanBankBill);
router.post("/bill/pay", verifyToken, transactionController.payBankBill);

// ==========================================
// 🎁 មុខងាររង្វាន់ និង ប្រូម៉ូកូដ
// ==========================================
router.post("/reward/spin", verifyToken, transactionController.rewardCashback);
router.post("/reward/promo", verifyToken, transactionController.claimPromoCode);

// ==========================================
// 🧧 មុខងារអាំងប៉ាវ (E-Gift)
// ==========================================
router.post("/egift/send", verifyToken, transactionController.sendEgift);
router.post("/egift/open", verifyToken, transactionController.egiftOpened);

module.exports = router;
