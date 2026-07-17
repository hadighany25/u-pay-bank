const express = require("express");
const router = express.Router();
const accountController = require("../controllers/accountController");

// API សម្រាប់បង្កើតគណនីលេខពិសេស
router.post("/create-premium", accountController.createPremiumAccount);

// API សម្រាប់ទាញយកលេខណែនាំ (Suggested Numbers)
router.get("/suggested-numbers", accountController.getSuggestedNumbers);

// API ឆែកភាពទំនេរនៃលេខគណនី
router.post("/check-availability", accountController.checkAvailability);

// 🔥 API ថ្មី: សម្រាប់បង្កើតគណនីរួម (Joint Account)
router.post("/create-joint", accountController.createJointAccount);

// 🔥 API ថ្មី: សម្រាប់យល់ព្រម ឬ បដិសេធការអញ្ជើញចូលគណនីរួម
router.post("/respond-joint-invite", accountController.respondToJointInvite);

//
router.get("/search-user/:identifier", accountController.searchUserForJoint);

module.exports = router;
