const express = require("express");
const router = express.Router();

// ១. Import Controllers
const merchantController = require("../controllers/merchantController");

// ២. Import Middleware (ត្រូវប្រាកដថាឈ្មោះនេះមានក្នុង authMiddleware.js)
const { verifyUser } = require("../middleware/authMiddleware");

// ៣. កំណត់ Routes (ត្រូវប្រើ verifyUser ទាំងអស់ដើម្បីឱ្យមាន req.user)
router.post("/create", verifyUser, merchantController.createMerchant);
router.get("/my-merchants", verifyUser, merchantController.getMyMerchants);

// 🔥 កែត្រង់នេះ៖ ប្តូរពី authMiddleware មកប្រើ verifyUser វិញ
router.get(
  "/revenue/:merchantId",
  verifyUser,
  merchantController.getMerchantRevenue,
);

module.exports = router;
