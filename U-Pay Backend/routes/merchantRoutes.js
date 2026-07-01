const express = require("express");
const router = express.Router();

// Import Controllers
const merchantController = require("../controllers/merchantController");

// Import verifyUser ពី authMiddleware
const { verifyUser } = require("../middleware/authMiddleware");

// Routes
router.post("/create", verifyUser, merchantController.createMerchant);
router.get("/my-merchants", verifyUser, merchantController.getMyMerchants);
router.delete("/:merchantId", verifyUser, merchantController.deleteMerchant);

module.exports = router;
