const express = require("express");
const router = express.Router();

// 🛡️ IMPORT MIDDLEWARE
// សំខាន់៖ បើវានៅតែ error ត្រង់នេះ បងត្រូវឆែកមើលក្នុង authMiddleware.js ថាបង export ឈ្មោះអ្វី
const {
  verifyUser,
  enforceSystemActive,
} = require("../middleware/authMiddleware");

// 🕹️ IMPORT CONTROLLERS
const transactionController = require("../controllers/transactionController");

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

// 🔥 Route សម្រាប់ E-Gift
router.post(
  "/egift/send",
  verifyUser,
  enforceSystemActive,
  transactionController.sendEgift,
);

router.post("/egift/opened", verifyUser, transactionController.egiftOpened);

module.exports = router;
