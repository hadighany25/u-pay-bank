const express = require("express");
const router = express.Router();
const ufundController = require("../controllers/ufundController");
const { verifyUser } = require("../middleware/authMiddleware"); // ប្រសិនបើបងមាន Middleware

// ទាញយកបញ្ជី Fund
router.post("/list", ufundController.getMyFunds); // អាចដាក់ verifyUser បើមាន

// បង្កើត / ដាក់ប្រាក់
router.post("/create", ufundController.createFund);
router.post("/deposit", ufundController.depositFund);

// អញ្ជើញ / ទទួល
router.post("/invite", ufundController.inviteMember);
router.post("/respond-invite", ufundController.respondToInvite);

// វដ្តជីវិតគម្រោង (Lifecycle)
router.post("/edit", ufundController.editFund);
router.post("/close", ufundController.closeOrCancelFund);
// បន្ថែមនៅពីក្រោម Route ចាស់ៗរបស់បង
router.post("/scan-pay", ufundController.scanDepositFund);
router.post("/get-name", ufundController.getUFundName);

module.exports = router;
