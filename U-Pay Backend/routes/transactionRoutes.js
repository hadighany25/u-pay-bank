const express = require("express");
const router = express.Router();

// 🔥 ទី១៖ ទាញយកពីកន្លែង controller (ឈ្មោះត្រូវ ១០០% តាមរូបភាព)
const transactionController = require("../controllers/transactionController");

// 🔥 ទី២៖ ទាញយកពីកន្លែង middleware (អត់មានអក្សរ s ទេ ត្រូវ ១០០% តាមរូបភាព)
const { verifyToken } = require("../middleware/authMiddleware");

// ==========================================
// 💸 មុខងារវេរលុយ និង ទូទាត់ប្រាក់
// ==========================================
router.post("/check", verifyToken, transactionController.checkAccount);
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
