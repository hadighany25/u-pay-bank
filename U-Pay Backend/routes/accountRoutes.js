const express = require("express");
const router = express.Router();
const accountController = require("../controllers/accountController");
const { verifyUser } = require("../middleware/authMiddleware");

// ទាញយក File ផ្លូវរបស់ Junior
const juniorRoutes = require("./juniorRoutes");

// ==========================================
// 🌟 មុខងារ Premium Account
// ==========================================
router.post(
  "/premium/create",
  verifyUser,
  accountController.createPremiumAccount,
);
router.get(
  "/premium/suggested",
  verifyUser,
  accountController.getSuggestedNumbers,
);
router.post("/premium/check", verifyUser, accountController.checkAvailability);

// ==========================================
// 🤝 ខ្សែ API ថ្មីសម្រាប់គណនីរួម (Joint Account)
// ==========================================
router.get(
  "/joint/search/:identifier",
  verifyUser,
  accountController.searchUserForJoint,
);
router.post("/joint/create", verifyUser, accountController.createJointAccount);
router.post(
  "/joint/respond",
  verifyUser,
  accountController.respondToJointInvite,
);

// ==========================================
// 👶 បញ្ជូនរាល់ Request /junior ទាំងអស់ទៅកាន់ juniorRoutes
// ==========================================
router.use("/junior", juniorRoutes);

module.exports = router;
