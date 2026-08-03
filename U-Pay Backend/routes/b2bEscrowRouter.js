// routes/b2bEscrowRouter.js
const express = require("express");
const router = express.Router();

const { verifyB2BSignature } = require("../middleware/b2bAuthMiddleware");
const {
  freezeFunds,
  releaseFunds,
} = require("../controllers/b2bEscrowController");

// 🌟 ១. Import Function ថ្មីពី pdfService
const { streamOfficialReceiptPDF } = require("../services/pdfService");

// 🔍 ឆែកមើលថាតើវាជា function ពិតមែន ឬអត់?
console.log("verifyB2BSignature:", typeof verifyB2BSignature);
console.log("freezeFunds:", typeof freezeFunds);
console.log("releaseFunds:", typeof releaseFunds);

router.post("/freeze", verifyB2BSignature, freezeFunds);
router.post("/release", verifyB2BSignature, releaseFunds);

// 🌟 ២. បន្ថែម Route ថ្មីសម្រាប់មើលវិក្កយបត្រ (Real-time PDF Stream)
// 💡 ចំណាំ៖ ប្រសិនបើនៅក្នុង server.js របស់បងបានប្រើ app.use("/", b2bEscrowRouter)
// នោះបងសរសេរ "/api/receipt/:transactionId" គឺត្រឹមត្រូវហើយ។
router.get("/api/receipt/:transactionId", async (req, res) => {
  const { transactionId } = req.params;
  await streamOfficialReceiptPDF(transactionId, res);
});

module.exports = router;
