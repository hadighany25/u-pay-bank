const express = require("express");
const router = express.Router();

// ១. Import Controllers
const merchantController = require("../controllers/merchantController");

// ២. Import Middleware
const { verifyUser } = require("../middleware/authMiddleware");

// ៣. កំណត់ Routes
router.post("/create", verifyUser, merchantController.createMerchant);
router.get("/my-merchants", verifyUser, merchantController.getMyMerchants);
router.delete("/:merchantId", verifyUser, merchantController.deleteMerchant);

// 🔥 បន្ថែម ២ ជួរនេះសម្រាប់ Dashboard និង Report
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

module.exports = router;
