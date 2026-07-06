const express = require("express");
const router = express.Router();
const Merchant = require("../models/Merchant"); // <--- ត្រូវ Import មកទើបប្រើ Merchant.find បាន
const merchantController = require("../controllers/merchantController");
const { verifyUser } = require("../middleware/authMiddleware");

// Routes សម្រាប់ Merchant ធម្មតា
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

// 🔥 Route សម្រាប់ Admin (កែជា router.get ជំនួសអោយ app.get)
router.get("/admin/all-merchants", verifyUser, async (req, res) => {
  try {
    // បន្ថែមការឆែកសិទ្ធិ Admin បន្តិច បើមិនចង់ឱ្យ User ធម្មតាចូលមើលបាន
    if (req.user.role !== "super_admin") {
      return res.status(403).json({ success: false, message: "Access Denied" });
    }
    const merchants = await Merchant.find({});
    res.json({ success: true, merchants });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
