const express = require("express");
const router = express.Router();

// 🔥 កែទី១៖ ទាញយកអោយត្រូវឈ្មោះពិតប្រាកដ "transactionController"
const transactionController = require("../controllers/transactionController");

// 🔥 កែទី២៖ ទាញយកអោយត្រូវឈ្មោះ Middleware "verifyUser" និង "enforceSystemActive"
const {
  verifyUser,
  enforceSystemActive,
} = require("../middleware/authMiddleware");

// ==========================================
// 💸 មុខងារវេរលុយ និង ទូទាត់ប្រាក់
// ==========================================
// ឆែកឈ្មោះអ្នកទទួលមុនពេលវេរលុយ
router.post("/check", verifyUser, transactionController.checkAccount);

// វេរលុយ (ទៅកាន់គណនីធម្មតា, គណនីរួម, ឬ Merchant)
router.post(
  "/submit",
  verifyUser,
  enforceSystemActive,
  transactionController.transfer,
);

// ==========================================
// 🧾 មុខងារបង់វិក្កយបត្រ (PayHub)
// ==========================================
router.post("/bill/scan", verifyUser, transactionController.scanBankBill);
router.post(
  "/bill/pay",
  verifyUser,
  enforceSystemActive,
  transactionController.payBankBill,
);

// ==========================================
// 🎁 មុខងាររង្វាន់ និង ប្រូម៉ូកូដ
// ==========================================
router.post(
  "/reward/spin",
  verifyUser,
  enforceSystemActive,
  transactionController.rewardCashback,
);
router.post(
  "/reward/promo",
  verifyUser,
  enforceSystemActive,
  transactionController.claimPromoCode,
);

// ==========================================
// 🧧 មុខងារអាំងប៉ាវ (E-Gift)
// ==========================================
router.post(
  "/egift/send",
  verifyUser,
  enforceSystemActive,
  transactionController.sendEgift,
);
router.post("/egift/open", verifyUser, transactionController.egiftOpened);

module.exports = router;
