const express = require("express");
const router = express.Router();
const accountController = require("../controllers/accountController");

// 🔥 កែត្រង់នេះ៖ ប្រើឈ្មោះ verifyUser ទើបត្រូវនឹង Middleware របស់បង
const { verifyUser } = require("../middleware/authMiddleware");

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

module.exports = router;
