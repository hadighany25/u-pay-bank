const express = require("express");
const router = express.Router();

// ១. Import Controllers
const merchantController = require("../controllers/merchantController");

// ២. Import Middleware
const { verifyUser } = require("../middleware/authMiddleware");

// ៣. កំណត់ Routes (មិនបាច់មាន /api/merchants ពីមុខទៀតទេ)
router.post("/create", verifyUser, merchantController.createMerchant);
router.get("/my-merchants", verifyUser, merchantController.getMyMerchants);

// 🔥 នេះគឺជា Route សម្រាប់ Update និង Delete ដែលកែត្រូវហើយ
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

// សម្រាប់ Dashboard និង Report
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
// បន្ថែម Route នេះ ដើម្បីឱ្យ Admin អាចទាញទិន្នន័យ Merchant ទាំងអស់បាន
app.get("/api/admin/all-merchants", async (req, res) => {
  try {
    const merchants = await Merchant.find({}); // ទាញយក Merchant ទាំងអស់ពី Database
    res.json({ success: true, merchants });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
module.exports = router;
