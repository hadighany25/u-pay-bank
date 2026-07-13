const express = require("express");
const router = express.Router();
const ufundController = require("../controllers/ufundController");
const { verifyUser } = require("../middleware/authMiddleware");

router.post("/create", verifyUser, ufundController.createFund);
router.post("/invite", verifyUser, ufundController.inviteMember);
router.post("/deposit", verifyUser, ufundController.depositFund);
router.post("/list", verifyUser, ufundController.getMyFunds);

module.exports = router;
