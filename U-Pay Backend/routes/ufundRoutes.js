// routes/ufundRoutes.js
const express = require("express");
const router = express.Router();
const ufundController = require("../controllers/ufundController");

// ទាញយកបញ្ជី Fund
router.post("/list", ufundController.getMyFunds);

// បង្កើត / ដាក់ប្រាក់
router.post("/create", ufundController.createFund);
router.post("/deposit", ufundController.depositFund);

// អញ្ជើញ / ទទួល
router.post("/invite", ufundController.inviteMember);
router.post("/respond-invite", ufundController.respondToInvite);
router.post("/cancel-invite", ufundController.cancelInvite);
router.post("/transfer-admin", ufundController.transferAdmin);

// វដ្តជីវិតគម្រោង (Lifecycle) & Advanced Settings
router.post("/update-settings", ufundController.updateSettings);
router.post("/close", ufundController.closeOrCancelFund);

// Scan & Information
router.post("/scan-pay", ufundController.scanDepositFund);
router.post("/get-name", ufundController.getUFundName);

// មុខងារ Overdue, Reminder, Nudge & Leave Fund
router.post("/pay-overdue", ufundController.payOverdue);
router.post("/remind", ufundController.remindMember);
router.post("/nudge", ufundController.nudgePending);
router.post("/request-leave", ufundController.requestLeave);
router.post("/approve-leave", ufundController.approveLeave);
router.post("/cancel-leave", ufundController.cancelLeaveRequest);

module.exports = router;
