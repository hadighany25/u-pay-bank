const express = require("express");
const router = express.Router();
const merchantController = require("../controllers/merchantController");
const { verifyUser } = require("../middleware/authMiddleware");

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

// Routes សម្រាប់ Admin
const Merchant = require("../models/Merchant");
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

module.exports = router;
