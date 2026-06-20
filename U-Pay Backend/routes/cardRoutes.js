const express = require("express");
const router = express.Router();

const { verifyUser } = require("../middleware/authMiddleware");
const cardController = require("../controllers/cardController");

// រាល់ផ្លូវកាតទាំងអស់ ត្រូវតែឆ្លងកាត់ការឆែក Token (verifyUser)
router.post("/generate", verifyUser, cardController.generateCard);
router.post("/toggle-lock", verifyUser, cardController.toggleLock);
router.post("/toggle-online-pay", verifyUser, cardController.toggleOnlinePay);
router.post("/update-limit", verifyUser, cardController.updateLimit);
router.post("/delete", verifyUser, cardController.deleteCard);
router.post("/reset-pin", verifyUser, cardController.resetPin);
router.post("/rename", verifyUser, cardController.renameCard);
router.post("/change-account", verifyUser, cardController.changeAccount);

module.exports = router;
