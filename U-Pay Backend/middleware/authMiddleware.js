const express = require("express");
const router = express.Router();

// 🛡️ IMPORT MIDDLEWARE (កែតម្រូវឈ្មោះតាម authMiddleware.js របស់បងផ្ទាល់)
const {
  verifyUser,
  enforceSystemActive,
} = require("../middleware/authMiddleware");

// 🕹️ IMPORT CONTROLLERS (ទាញយកពី controllers/transactionController.js)
const transactionController = require("../controllers/transactionController");

// ==========================================
// 🌐 API ROUTES (រក្សាទម្រង់តាមកូដចាស់របស់បង)
// ==========================================

// ឆែកឈ្មោះគណនីមុនពេលវេរលុយ
router.post("/check-account", verifyUser, transactionController.checkAccount);

// វេរលុយ
router.post(
  "/transfer",
  verifyUser,
  enforceSystemActive,
  transactionController.transfer,
);

// ស្កែនវិក្កយបត្របង់ប្រាក់
router.post("/bank/scan-bill", transactionController.scanBankBill);

// បង់វិក្កយបត្រ
router.post(
  "/bank/pay-bill",
  enforceSystemActive,
  transactionController.payBankBill,
);

// រង្វាន់ Lucky Spin
router.post(
  "/reward/cashback",
  verifyUser,
  enforceSystemActive,
  transactionController.rewardCashback,
);

// ប្រូម៉ូកូដ
router.post(
  "/claim-promo",
  verifyUser,
  enforceSystemActive,
  transactionController.claimPromoCode,
);

// មុខងារផ្ញើអាំងប៉ាវ (E-Gift)
router.post(
  "/egift/send",
  verifyUser,
  enforceSystemActive,
  transactionController.sendEgift,
);

// មុខងារបើកអាំងប៉ាវ (E-Gift Opened)
router.post("/egift/opened", verifyUser, transactionController.egiftOpened);

module.exports = router;
