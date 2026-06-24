const express = require("express");
const router = express.Router();

// ==========================================
// 🛡️ IMPORT MIDDLEWARE (សម្រាប់ការពារសុវត្ថិភាព API)
// ==========================================
const {
  verifyUser,
  enforceSystemActive,
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
  scanBankBill, // 🔥 ត្រូវថែមពាក្យនេះនៅទីនេះទើបវាស្គាល់
} = require("../controllers/transactionController");

// ==========================================
// 🌐 កំណត់ផ្លូវ API (API ROUTES)
// ==========================================

router.post("/check-account", verifyUser, checkAccount);
router.post("/transfer", verifyUser, enforceSystemActive, transfer);
router.post("/bank/scan-bill", scanBankBill);
router.post("/bank/pay-bill", enforceSystemActive, payBankBill);
router.post(
  "/reward/cashback",
  verifyUser,
  enforceSystemActive,
  rewardCashback,
);
router.post("/claim-promo", verifyUser, enforceSystemActive, claimPromoCode);

module.exports = router;
