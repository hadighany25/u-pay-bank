const express = require("express");
const router = express.Router();

// ==========================================
// 🛡️ IMPORT MIDDLEWARE (សម្រាប់ការពារសុវត្ថិភាព API)
// ==========================================
const {
  verifyUser, // ឆែកមើលថាអ្នកប្រើប្រាស់ពិតជាបាន Login ឬអត់
  authenticateToken, // ឆែកមើលសុពលភាព Token (JWT)
  enforceSystemActive, // ឆែកមើលថាប្រព័ន្ធកំពុងដំណើរការ (មិនត្រូវបាន Admin បង្កក)
} = require("../middleware/authMiddleware");

// ==========================================
// 🕹️ IMPORT CONTROLLERS (មុខងារចាត់ចែងប្រតិបត្តិការ)
// ==========================================
const {
  checkAccount, // មុខងារឆែកលេខគណនីមុនពេលវេរប្រាក់
  transfer, // មុខងារផ្ទេរប្រាក់ និងកាត់សេវា
  payBankBill, // មុខងារទូទាត់វិក្កយបត្រ (PayHub)
  rewardCashback, // មុខងារបាញ់លុយរង្វាន់ពី Lucky Spin
  claimPromoCode, // មុខងារបញ្ជូលកូដដើម្បីទទួលបានលុយ
} = require("../controllers/transactionController");

// ==========================================
// 🌐 កំណត់ផ្លូវ API (API ROUTES API)
// ==========================================

// ១. ផ្លូវសម្រាប់ឆែកឈ្មោះអ្នកទទួល (គ្រាន់តែឆែកឈ្មោះ មិនបាច់ខ្វល់រឿង System Frozen ទេ)
router.post("/check-account", verifyUser, checkAccount);

// ២. ផ្លូវសម្រាប់វេរប្រាក់ (ត្រូវតែមានសិទ្ធិ User និងប្រព័ន្ធត្រូវតែ Active)
router.post("/transfer", verifyUser, enforceSystemActive, transfer);

// ៣. ផ្លូវសម្រាប់បង់វិក្កយបត្រ
router.post("/bank/pay-bill", verifyUser, enforceSystemActive, payBankBill);

// ៤. ផ្លូវសម្រាប់ផ្តល់រង្វាន់ Cashback (ពីការបង្វិលកង Lucky Spin)
router.post(
  "/reward/cashback",
  verifyUser,
  enforceSystemActive,
  rewardCashback,
);

// ៥. ផ្លូវសម្រាប់ទាញយកលុយពី Promo Code (Voucher)
// 🔥 បានកែសម្រួល៖ ប្រើ claimPromoCode ផ្ទាល់ និងបន្ថែម enforceSystemActive ដើម្បីកុំអោយគេទាញលុយបានពេល Admin បិទប្រព័ន្ធ
router.post(
  "/claim-promo",
  authenticateToken,
  enforceSystemActive,
  claimPromoCode,
);

// នាំចេញ (Export) ផ្លូវទាំងអស់នេះទៅកាន់ server.js ប្រើប្រាស់
module.exports = router;
