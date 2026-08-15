// ==========================================================================
// 💳 VIRTUAL CARD ROUTES (ប្រព័ន្ធគ្រប់គ្រងកាត)
// ==========================================================================

const express = require("express");
const router = express.Router();

const { verifyUser } = require("../middleware/authMiddleware");
const cardController = require("../controllers/cardController");

// 🔒 រាល់ប្រតិបត្តិការទាំងអស់ទាមទារការផ្ទៀងផ្ទាត់សិទ្ធិ (Token Verification)

// 🛠️ ១. ការគ្រប់គ្រងកាតទូទៅ (Card Management)
router.post("/generate", verifyUser, cardController.generateCard); // បង្កើតកាតថ្មី (Smart Issuance)
router.post("/delete", verifyUser, cardController.deleteCard); // លុបកាតចោលជារៀងរហូត
router.post("/rename", verifyUser, cardController.renameCard); // ប្តូរឈ្មោះសម្គាល់កាត

// ⚙️ ២. ការកំណត់សុវត្ថិភាព និងដែនកំណត់ (Security & Limits)
router.post("/toggle-lock", verifyUser, cardController.toggleLock); // បិទ/បើកកាត (Freeze/Unfreeze)
router.post("/toggle-online-pay", verifyUser, cardController.toggleOnlinePay); // បិទ/បើក ការទិញទំនិញអនឡាញ
router.post("/update-limit", verifyUser, cardController.updateLimit); // កំណត់ដែនកំណត់ចាយវាយ (Dual Limits)
router.post("/reset-pin", verifyUser, cardController.resetPin); // ប្តូរលេខសម្ងាត់កាត (PIN) ៤ខ្ទង់

// 📡 ៣. ការភ្ជាប់ជាមួយកាតពិត (Physical NFC Card)
router.post("/bind-nfc", verifyUser, cardController.bindNfcCard); // ភ្ជាប់កាតពិត (NFC) ចូលកាត Virtual
router.post("/unbind-nfc", verifyUser, cardController.unbindNfcCard); // ផ្តាច់កាតពិត (NFC) ចេញវិញ

module.exports = router;
