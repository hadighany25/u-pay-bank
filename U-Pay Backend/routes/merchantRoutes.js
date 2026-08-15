const express = require("express");
const router = express.Router();
const merchantController = require("../controllers/merchantController");
const { verifyUser } = require("../middleware/authMiddleware");
const Merchant = require("../models/Merchant");

// Routes សម្រាប់ម្ចាស់ហាង (Merchant End-User)
router.post("/create", verifyUser, merchantController.createMerchant);
router.get("/my-merchants", verifyUser, merchantController.getMyMerchants);
router.put(
  "/update/:merchantId",
  verifyUser,
  merchantController.updateMerchant,
);
router.delete(
  "/delete/:merchantId",
  verifyUser,
  merchantController.deleteMerchant,
);
router.get(
  "/revenue/:merchantId",
  verifyUser,
  merchantController.getMerchantRevenue,
);
router.get(
  "/transactions/:merchantId",
  verifyUser,
  merchantController.getMerchantTransactions,
);

// Routes សម្រាប់អ្នកគិតលុយ (Cashiers)
router.get(
  "/cashiers/search/:accountNumber",
  verifyUser,
  merchantController.searchCashierAccount,
);
router.post("/cashiers/add", verifyUser, merchantController.addCashier);
router.delete(
  "/cashiers/remove/:merchantId/:cashierId",
  verifyUser,
  merchantController.removeCashier,
);

// Routes សម្រាប់ Telegram Alert
router.post(
  "/generate-telegram-code",
  verifyUser,
  merchantController.generateTelegramCode,
);
router.post("/unlink-telegram", verifyUser, merchantController.unlinkTelegram);

// Routes សម្រាប់ Admin

router.get("/admin/all-merchants", verifyUser, async (req, res) => {
  try {
    if (req.user.role !== "super_admin") {
      return res
        .status(403)
        .json({ success: false, message: "Access Denied!" });
    }
    const merchants = await Merchant.find({});
    res.json({ success: true, merchants });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========================================================
// 🌐 Routes សម្រាប់ Partner / API ខាងក្រៅ (ឧទាហរណ៍: Fashion Shop)
// ========================================================
// ចំណាំ៖ អត់មានដាក់ verifyUser ទេ ព្រោះយើងផ្ទៀងផ្ទាត់សុវត្ថិភាពតាមរយៈ Signature នៅក្នុង Controller រួចហើយ
router.post("/qr/create", merchantController.createMerchantQR);

// 🔥 បន្ថែមផ្លូវនេះសម្រាប់ការអូសកាត (NFC Tap to Pay)
router.post("/tap-to-pay", verifyUser, merchantController.processTapToPay);

router.post("/refund", verifyUser, merchantController.refundTransaction);

// 🟢 កែត្រង់នេះ៖ ត្រូវប្រើ checkCardBeforePayment (មិនមែន refundTransaction ទេ)
router.post(
  "/check-card",
  verifyUser,
  merchantController.checkCardBeforePayment,
);

module.exports = router;
