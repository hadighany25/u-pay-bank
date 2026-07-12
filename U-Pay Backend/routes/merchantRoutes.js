const express = require("express");
const router = express.Router();

// នាំចូល Models និង Controllers ដែលចាំបាច់
const Merchant = require("../models/Merchant");
const merchantController = require("../controllers/merchantController");
const { verifyUser } = require("../middleware/authMiddleware");

// ========================================================
// ផ្នែកទី១៖ Routes សម្រាប់ម្ចាស់ហាង (Merchant End-User)
// ទាមទារការផ្ទៀងផ្ទាត់ (verifyUser) មុននឹងអាចប្រើបាន
// ========================================================

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

// ========================================================
// ផ្នែកទី២៖ Route សម្រាប់ Admin
// (សម្រាប់ទាញយកទិន្នន័យហាងទាំងអស់ទៅបង្ហាញលើ Admin Dashboard)
// ========================================================

router.get("/admin/all-merchants", verifyUser, async (req, res) => {
  try {
    // ឆែកសិទ្ធិ: អនុញ្ញាតឱ្យតែ Super Admin ប៉ុណ្ណោះដែលអាចមើលបញ្ជីហាងទាំងអស់បាន
    if (req.user.role !== "super_admin") {
      return res
        .status(403)
        .json({
          success: false,
          message: "Access Denied: គ្មានសិទ្ធិចូលមើលទេ!",
        });
    }

    // ទាញយកហាងទាំងអស់ពី Database
    const merchants = await Merchant.find({});
    res.json({ success: true, merchants });
  } catch (error) {
    console.error("GET ALL MERCHANTS ERROR:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
