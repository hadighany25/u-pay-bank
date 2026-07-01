const express = require("express");
const router = express.Router();
const {
  createMerchant,
  getMyMerchants,
  deleteMerchant,
} = require("../controllers/merchantController");
const { protect } = require("../middleware/authMiddleware"); // Middleware ចាស់របស់អ្នក

router.post("/create", protect, createMerchant);
router.get("/my-merchants", protect, getMyMerchants);
router.delete("/:merchantId", protect, deleteMerchant);

module.exports = router;
