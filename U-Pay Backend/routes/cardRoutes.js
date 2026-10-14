// ==========================================================================
// 💳 VIRTUAL CARD ROUTES (ប្រព័ន្ធគ្រប់គ្រងកាត)
// ==========================================================================

const express = require("express");
const router = express.Router();

const { verifyUser } = require("../middleware/authMiddleware");
const cardController = require("../controllers/cardController");

// 🛠️ ១. ការគ្រប់គ្រងកាតទូទៅ (Card Management)
router.get("/my-cards", verifyUser, cardController.getMyCards); // 🟢 ថ្មី៖ ទាញយកកាតពី Model Card.js
router.post("/generate", verifyUser, cardController.generateCard);
router.post("/delete", verifyUser, cardController.deleteCard);
router.post("/rename", verifyUser, cardController.renameCard);

// ⚙️ ២. ការកំណត់សុវត្ថិភាព និងដែនកំណត់ (Security & Limits)
router.post("/toggle-lock", verifyUser, cardController.toggleLock);
router.post("/toggle-online-pay", verifyUser, cardController.toggleOnlinePay);
router.post("/update-limit", verifyUser, cardController.updateLimit);
router.post("/reset-pin", verifyUser, cardController.resetPin);

// 📡 ៣. ការភ្ជាប់ជាមួយកាតពិត (Physical NFC Card) និង រៀបលំដាប់
router.post("/bind-nfc", verifyUser, cardController.bindNfcCard);
router.post("/unbind-nfc", verifyUser, cardController.unbindNfcCard);
router.post("/reorder", verifyUser, cardController.reorderCards);

module.exports = router;
