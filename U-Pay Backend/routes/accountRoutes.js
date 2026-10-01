// ============================================================================
// ឯកសារ: accountRoutes.js
// អត្ថន័យ: កំណត់ផ្លូវ (Routes/Endpoints) សម្រាប់ Controller ទាក់ទងនឹងគណនី
// ============================================================================

const express = require("express");
const router = express.Router();
const accountController = require("../controllers/accountController");
const { verifyUser } = require("../middleware/authMiddleware");

// ទាញយក File ផ្លូវរបស់ Junior
const juniorRoutes = require("./juniorRoutes");

// ----------------------------------------------------------------------------
// 🌟 ក្រុមទី ១៖ ផ្លូវសម្រាប់ Premium Account (Premium Routes)
// ----------------------------------------------------------------------------
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

// ----------------------------------------------------------------------------
// 🤝 ក្រុមទី ២៖ ផ្លូវសម្រាប់គណនីរួម (Joint Account Routes)
// ----------------------------------------------------------------------------
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

// ----------------------------------------------------------------------------
// 👶 ក្រុមទី ៣៖ បញ្ជូនរាល់ Request /junior ទាំងអស់ទៅកាន់ juniorRoutes
// ----------------------------------------------------------------------------
router.use("/junior", juniorRoutes);

module.exports = router;
