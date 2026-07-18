const express = require("express");
const router = express.Router();

// 🛡️ IMPORT MIDDLEWARE (ត្រូវគ្នា ១០០% ជាមួយ Folder របស់បង)
const {
  verifyUser,
  enforceSystemActive,
} = require("../middleware/authMiddleware");

// 🕹️ IMPORT CONTROLLERS (ត្រូវគ្នា ១០០% ជាមួយឈ្មោះ File របស់បង)
const transactionController = require("../controllers/transactionController");

// ==========================================
// 💸 មុខងារវេរលុយ និង ទូទាត់ប្រាក់
// ==========================================
router.post("/check-account", verifyUser, transactionController.checkAccount);
router.post(
  "/transfer",
  verifyUser,
  enforceSystemActive,
  transactionController.transfer,
);

// ==========================================
// 🧾 មុខងារបង់វិក្កយបត្រ (PayHub)
// ==========================================
router.post("/bank/scan-bill", transactionController.scanBankBill);
router.post(
  "/bank/pay-bill",
  enforceSystemActive,
  transactionController.payBankBill,
);

// ==========================================
// 🎁 មុខងាររង្វាន់ និង ប្រូម៉ូកូដ
// ==========================================
router.post(
  "/reward/cashback",
  verifyUser,
  enforceSystemActive,
  transactionController.rewardCashback,
);
router.post(
  "/claim-promo",
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
router.post("/egift/opened", verifyUser, transactionController.egiftOpened);

module.exports = router;
