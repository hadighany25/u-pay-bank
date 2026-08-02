// routes/b2bEscrowRouter.js
const express = require("express");
const router = express.Router();

// នាំចូល Middleware
const { verifyB2BSignature } = require("../middlewares/b2bAuthMiddleware");

// នាំចូល Controllers ទាំង២
const {
  freezeFunds,
  releaseFunds,
} = require("../controllers/b2bEscrowController");

// ១. Route សម្រាប់បង្កកប្រាក់
router.post("/freeze", verifyB2BSignature, freezeFunds);

// ២. Route សម្រាប់ព្រលែងប្រាក់ (អាប់ដេតថ្មី) 🔥
router.post("/release", verifyB2BSignature, releaseFunds);

module.exports = router;
