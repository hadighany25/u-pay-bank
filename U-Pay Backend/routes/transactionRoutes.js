const express = require("express");
const router = express.Router();

// ==========================================
// 🛡️ IMPORT MIDDLEWARE (សម្រាប់ការពារសុវត្ថិភាព API)
// ==========================================
const {
  verifyUser, // 👈 ប្រើ verifyUser សម្រាប់ឆែក User Login
  enforceSystemActive, // ឆែកមើលថាប្រព័ន្ធកំពុងដំណើរការ
} = require("../middleware/authMiddleware");

// ==========================================
// 🕹️ IMPORT CONTROLLERS (មុខងារចាត់ចែងប្រតិបត្តិការ)
// ==========================================
const {
  checkAccount,
  transfer,
  payBankBill,
  rewardCashback,
  claimPromoCode,
} = require("../controllers/transactionController");

// ==========================================
// 🌐 កំណត់ផ្លូវ API (API ROUTES API)
// ==========================================

router.post("/check-account", verifyUser, checkAccount);
router.post("/transfer", verifyUser, enforceSystemActive, transfer);
router.post("/bank/pay-bill", verifyUser, enforceSystemActive, payBankBill);
router.post(
  "/reward/cashback",
  verifyUser,
  enforceSystemActive,
  rewardCashback,
);

// 🔥 ជួសជុល Error: ប្រើ verifyUser ជំនួស authenticateToken វិញ
router.post("/claim-promo", verifyUser, enforceSystemActive, claimPromoCode);

module.exports = router;
