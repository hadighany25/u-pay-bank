const express = require("express");
const router = express.Router();

// ផ្ទៀងផ្ទាត់ Path ឈ្មោះ Folder "middleware" (អត់มี s)
const { verifyB2BSignature } = require("../middleware/b2bAuthMiddleware");
const {
  freezeFunds,
  releaseFunds,
} = require("../controllers/b2bEscrowController");

// កំណត់ Route ទាំងពីរ
router.post("/freeze", verifyB2BSignature, freezeFunds);
router.post("/release", verifyB2BSignature, releaseFunds); // បន្ទាត់ទី ១៨

module.exports = router;
