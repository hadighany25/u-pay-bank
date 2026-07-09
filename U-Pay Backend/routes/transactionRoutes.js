const express = require("express");
const router = express.Router();

// 🛡️ IMPORT MIDDLEWARE
const {
  verifyUser, // ប្រើ verifyUser សម្រាប់ការពារ
  enforceSystemActive,
} = require("../middleware/authMiddleware");

// 🕹️ IMPORT CONTROLLERS
const transactionController = require("../controllers/transactionController"); // Import ទាំងមូលដើម្បីងាយហៅ
const userController = require("../controllers/userController");

// 🌐 API ROUTES
router.post("/check-account", verifyUser, transactionController.checkAccount);
router.post(
  "/transfer",
  verifyUser,
  enforceSystemActive,
  transactionController.transfer,
);
router.post("/bank/scan-bill", transactionController.scanBankBill);
router.post(
  "/bank/pay-bill",
  enforceSystemActive,
  transactionController.payBankBill,
);
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

// 🔥 Route សម្រាប់ E-Gift (ប្រើ verifyUser ឱ្យដូច Route ផ្សេងៗ)
router.post(
  "/egift/send",
  verifyUser,
  enforceSystemActive,
  userController.sendEgift,
);

module.exports = router;
