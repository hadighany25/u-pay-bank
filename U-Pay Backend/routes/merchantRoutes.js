const express = require("express");
const router = express.Router();

// ១. Import Controllers
const merchantController = require("../controllers/merchantController");

// ២. Import Middleware ឱ្យចំឈ្មោះពិតប្រាកដ (verifyUser)
const { verifyUser } = require("../middleware/authMiddleware");

// ៣. កំណត់ Routes (ប្រើ verifyUser ដើម្បីឱ្យប្រាកដថាមាន req.user)
router.post("/create", verifyUser, merchantController.createMerchant);
router.get("/my-merchants", verifyUser, merchantController.getMyMerchants);
router.get(
  "/revenue/:merchantId",
  authMiddleware,
  merchantController.getMerchantRevenue,
);

module.exports = router;
