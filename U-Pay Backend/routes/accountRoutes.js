// ============================================================================
// ឯកសារ: accountRoutes.js
// អត្ថន័យ: កំណត់ផ្លូវ (Routes/Endpoints) សម្រាប់ Controller ទាក់ទងនឹងគណនីទាំងអស់
// (Premium Accounts, Joint Accounts, និង Junior Accounts)
// ============================================================================

const express = require("express");
const router = express.Router();

// 📦 ទាញយក Controller ដែលយើងទើបតែបញ្ចូលគ្នារួច និង Middleware ការពារ Route
const accountController = require("../controllers/accountController");
const { verifyUser } = require("../middleware/authMiddleware");

// ----------------------------------------------------------------------------
// 🌟 ក្រុមទី ១៖ ផ្លូវសម្រាប់គណនីលំដាប់ខ្ពស់ (Premium Account Routes)
// ----------------------------------------------------------------------------

// ១.១ បង្កើតគណនី Premium
router.post(
  "/premium/create",
  verifyUser,
  accountController.createPremiumAccount,
);

// ១.២ ទាញយកបញ្ជីលេខណែនាំពិសេសៗ
router.get(
  "/premium/suggested",
  verifyUser,
  accountController.getSuggestedNumbers,
);

// ១.៣ ត្រួតពិនិត្យភាពទំនេរនៃលេខគណនី
router.post("/premium/check", verifyUser, accountController.checkAvailability);

// ----------------------------------------------------------------------------
// 🤝 ក្រុមទី ២៖ ផ្លូវសម្រាប់គណនីរួម (Joint Account Routes)
// ----------------------------------------------------------------------------

// ២.១ ស្វែងរកអ្នកប្រើប្រាស់សម្រាប់អញ្ជើញចូលគណនីរួម
router.get(
  "/joint/search/:identifier",
  verifyUser,
  accountController.searchUserForJoint,
);

// ២.២ បង្កើតគណនីរួម និងបញ្ជូនការអញ្ជើញ
router.post("/joint/create", verifyUser, accountController.createJointAccount);

// ២.៣ ឆ្លើយតបទៅនឹងការអញ្ជើញ (Accept/Reject)
router.post(
  "/joint/respond",
  verifyUser,
  accountController.respondToJointInvite,
);

// ----------------------------------------------------------------------------
// 👶 ក្រុមទី ៣៖ ផ្លូវសម្រាប់គណនីកុមារ (Junior Account Routes)
// ចំណាំ៖ បានបញ្ជូលពី juniorRoutes.js មកដាក់ផ្ទាល់នៅទីនេះ ដោយហៅចេញពី accountController
// ----------------------------------------------------------------------------

// ៣.១ បង្កើតគណនីកូន
router.post(
  "/junior/create",
  verifyUser,
  accountController.createJuniorAccount,
);

// ៣.២ ផ្អាក ឬ បើកគណនីកូន (Toggle Freeze)
router.post(
  "/junior/toggle-freeze",
  verifyUser,
  accountController.toggleFreeze,
);

// ៣.៣ កំណត់រនាំងចំណាយប្រចាំថ្ងៃ (Update Daily Limit)
router.post(
  "/junior/update-limit",
  verifyUser,
  accountController.updateDailyLimit,
);

// ============================================================================
// បញ្ជូន Router ចេញទៅប្រើប្រាស់ (Export)
// ============================================================================
module.exports = router;
