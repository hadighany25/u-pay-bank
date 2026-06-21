const express = require("express");
const router = express.Router();

const {
  verifyUser,
  enforceSystemActive,
} = require("../middleware/authMiddleware");
const {
  checkAccount,
  transfer,
  payBankBill,
  rewardCashback,
} = require("../controllers/transactionController");

// កំណត់ផ្លូវ (Routes)
router.post("/check-account", verifyUser, checkAccount);
router.post("/transfer", verifyUser, enforceSystemActive, transfer);
router.post("/bank/pay-bill", verifyUser, enforceSystemActive, payBankBill);

// 🔥 ផ្លូវថ្មីសម្រាប់ Lucky Spin ភ្ជាប់ដោយសុវត្ថិភាព JWT
router.post(
  "/reward/cashback",
  verifyUser,
  enforceSystemActive,
  rewardCashback,
);
router.post("/claim-promo", authenticateToken, userController.claimPromoCode);
module.exports = router;
