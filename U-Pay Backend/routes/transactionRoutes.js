const express = require("express");
const router = express.Router();
const transactionController = require("../controllers/transactionController");
const {
  verifyUser,
  enforceSystemActive,
} = require("../middleware/authMiddleware");

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
router.post("/scan-bill", verifyUser, transactionController.scanBankBill);

// 🔥 នេះជាកន្លែងដែលត្រូវកែអោយត្រូវ៖ បងត្រូវប្រាកដថាប្រើឈ្មោះ /pay-bill
router.post(
  "/pay-bill",
  verifyUser,
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

// ==========================================
// 🤝 មុខងារ B2B (Server to Server)
// ==========================================
router.post("/b2b/transfer", transactionController.b2bTransfer);

module.exports = router;
