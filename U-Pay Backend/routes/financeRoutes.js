const express = require("express");
const router = express.Router();
const {
  createFixedDeposit,
  withdrawFixedDeposit,
  cashbackReward,
} = require("../controllers/financeController");
const {
  verifyUser,
  enforceSystemActive,
} = require("../middleware/authMiddleware");

// ត្រូវមាន verifyUser និង enforceSystemActive ដូច APIដទៃទៀត ដើម្បីកុំឱ្យទติด Security Block
router.post(
  "/fixed-deposit",
  verifyUser,
  enforceSystemActive,
  createFixedDeposit,
);
router.post(
  "/fixed-deposit/withdraw",
  verifyUser,
  enforceSystemActive,
  withdrawFixedDeposit,
);
router.post(
  "/reward/cashback",
  verifyUser,
  enforceSystemActive,
  cashbackReward,
);

module.exports = router;
