const express = require("express");
const router = express.Router();
const gatewayController = require("../controllers/gatewayController");
const { verifyUser } = require("../middleware/authMiddleware"); // ឬ verifyAdmin ទៅតាមសិទ្ធិរបស់បង

// 1. API សម្រាប់ 3rd Party (U-Mall) ហៅចូល (ផ្ទៀងផ្ទាត់ដោយ API Secret Hash)
router.post("/charge-card", gatewayController.requestCardPayment);

// 2. API សម្រាប់ App U-Pay ហៅចូល (ត្រូវមានសិទ្ធិជា User)
router.post(
  "/payment-request/confirm",
  verifyUser,
  gatewayController.confirmPayment,
);
router.post(
  "/payment-request/reject",
  verifyUser,
  gatewayController.rejectPayment,
);

// 🌟 3. API ថ្មី៖ សម្រាប់បញ្ចេញលុយ Hold ភ្លាមៗ (អាចអោយ Merchant ឬ Admin ហៅ)
router.post(
  "/payment-request/release",
  verifyUser,
  gatewayController.releaseHoldPayment,
);

module.exports = router;
