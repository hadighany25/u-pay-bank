const express = require("express");
const router = express.Router();
const {
  createSaving,
  depositSaving,
  breakSaving,
  createFixedDeposit,
  withdrawFixedDeposit,
  cashbackReward,
} = require("../controllers/financeController");

router.post("/savings/create", createSaving);
router.post("/savings/deposit", depositSaving);
router.post("/savings/break", breakSaving);
router.post("/fixed-deposit", createFixedDeposit);
router.post("/fixed-deposit/withdraw", withdrawFixedDeposit);
router.post("/reward/cashback", cashbackReward);

module.exports = router;
