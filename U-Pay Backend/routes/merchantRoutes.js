const express = require("express");
const router = express.Router();

const merchantController = require("../controllers/merchantController");
const { verifyUser } = require("../middleware/authMiddleware");

router.post("/create", verifyUser, merchantController.createMerchant);
router.get("/my-merchants", verifyUser, merchantController.getMyMerchants);

// ត្រង់នេះ៖ ប្រសិនបើ merchantController.getMerchantTransactions ជា undefined វានឹង Error
router.get(
  "/transactions/:merchantId",
  verifyUser,
  merchantController.getMerchantTransactions,
);

module.exports = router;
