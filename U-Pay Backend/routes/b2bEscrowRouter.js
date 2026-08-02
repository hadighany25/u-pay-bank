// routes/b2bEscrowRouter.js
const express = require("express");
const router = express.Router();

const { verifyB2BSignature } = require("../middleware/b2bAuthMiddleware");
const {
  freezeFunds,
  releaseFunds,
} = require("../controllers/b2bEscrowController");

// 🔍 ឆែកមើលថាតើវាជា function ពិតមែន ឬអត់?
console.log("verifyB2BSignature:", typeof verifyB2BSignature);
console.log("freezeFunds:", typeof freezeFunds);
console.log("releaseFunds:", typeof releaseFunds);

router.post("/freeze", verifyB2BSignature, freezeFunds);
router.post("/release", verifyB2BSignature, releaseFunds);

module.exports = router;
