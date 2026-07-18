const express = require("express");
const router = express.Router();
const accountController = require("../controllers/accountController");
const { verifyToken } = require("../middlewares/authMiddleware"); // ឬ middleware របស់បង

router.post(
  "/premium/create",
  verifyToken,
  accountController.createPremiumAccount,
);
router.get(
  "/premium/suggested",
  verifyToken,
  accountController.getSuggestedNumbers,
);
router.post("/premium/check", verifyToken, accountController.checkAvailability);

// 🔥 ខ្សែ API ថ្មីសម្រាប់គណនីរួម (Joint Account) ដែលយើងទើបបន្ថែម
router.get(
  "/joint/search/:identifier",
  verifyToken,
  accountController.searchUserForJoint,
);
router.post("/joint/create", verifyToken, accountController.createJointAccount);
router.post(
  "/joint/respond",
  verifyToken,
  accountController.respondToJointInvite,
);

module.exports = router;
