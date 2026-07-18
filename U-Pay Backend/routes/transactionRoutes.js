const express = require("express");
const router = express.Router();
const transferController = require("../controllers/transferController");
const { verifyToken } = require("../middlewares/authMiddleware"); // ឬ middleware ផ្សេងដែលបងកំពុងប្រើ

// ==========================================
// 💸 មុខងារវេរលុយ និង ទូទាត់ប្រាក់
// ==========================================
// ឆែកឈ្មោះអ្នកទទួលមុនពេលវេរលុយ
router.post("/check", verifyToken, transferController.checkAccount);

// វេរលុយ (ទៅកាន់គណនីធម្មតា, គណនីរួម, ឬ Merchant)
router.post("/submit", verifyToken, transferController.transfer);

// ==========================================
// 🧾 មុខងារបង់វិក្កយបត្រ (PayHub)
// ==========================================
router.post("/bill/scan", verifyToken, transferController.scanBankBill);
router.post("/bill/pay", verifyToken, transferController.payBankBill);

// ==========================================
// 🎁 មុខងាររង្វាន់ និង ប្រូម៉ូកូដ
// ==========================================
router.post("/reward/spin", verifyToken, transferController.rewardCashback);
router.post("/reward/promo", verifyToken, transferController.claimPromoCode);

// ==========================================
// 🧧 មុខងារអាំងប៉ាវ (E-Gift)
// ==========================================
router.post("/egift/send", verifyToken, transferController.sendEgift);
router.post("/egift/open", verifyToken, transferController.egiftOpened);

module.exports = router;
