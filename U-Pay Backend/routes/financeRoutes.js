const express = require("express");
const router = express.Router();
const {
  createFixedDeposit,
  withdrawFixedDeposit,
  cashbackReward,
} = require("../controllers/financeController");

// រក្សាទុកតែមុខងារទាំងនេះ ព្រោះ U-Fund បានទៅនៅ ufundRoutes.js អស់ហើយ
router.post("/fixed-deposit", createFixedDeposit);
router.post("/fixed-deposit/withdraw", withdrawFixedDeposit);
router.post("/reward/cashback", cashbackReward);

module.exports = router;
