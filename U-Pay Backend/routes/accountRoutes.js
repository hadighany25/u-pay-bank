const express = require("express");
const router = express.Router();
const accountController = require("../controllers/accountController");

// API សម្រាប់បង្កើតគណនីលេខពិសេស
router.post("/create-premium", accountController.createPremiumAccount);

// 🔥 API ថ្មី: សម្រាប់ទាញយកលេខណែនាំ (Suggested Numbers)
router.get("/suggested-numbers", accountController.getSuggestedNumbers);

module.exports = router;
