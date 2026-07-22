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
// 🔥 កែទី១៖ ប្តូរពី /check ទៅ /check-account ឲ្យត្រូវនឹងការហៅរបស់ Frontend
router.post("/check-account", verifyUser, transactionController.checkAccount);

// 🔥 កែទី២៖ ប្តូរពី /submit ទៅ /transfer ឲ្យត្រូវនឹងការហៅរបស់ Frontend
router.post(
  "/transfer",
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
// 🔥 កែទី៣៖ ប្តូរពី /reward/spin ទៅ /reward/cashback ឲ្យត្រូវនឹង Frontend
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

module.exports = router;
