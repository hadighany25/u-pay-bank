// File: routes/accountRoutes.js
const express = require("express");
const router = express.Router();

const accountController = require("../controllers/accountController");

// API សម្រាប់បង្កើតគណនីលេខពិសេស
router.post("/create-premium", accountController.createPremiumAccount);

module.exports = router;
