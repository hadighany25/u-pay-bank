const express = require("express");
const router = express.Router();
const multer = require("multer");
const authController = require("../controllers/authController");

// កំណត់ Multer អោយទុករូបក្នុង Memory កុំព្យូទ័របណ្តោះអាសន្ន
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // កំណត់ទំហំរូបមិនអោយលើសពី 5MB
});

// ១. ទាញយកឆ្មាំយាមទ្វារនៅខាងលើគេ
const { verifyUser } = require("../middleware/authMiddleware");

// ផ្លូវ (Routes) សម្រាប់ការចុះឈ្មោះ និង Login
router.post("/register", authController.register);
router.post("/login", authController.login);
router.post("/logout", authController.logout);
router.post("/heartbeat", authController.heartbeat);
router.post("/admin/login", authController.adminLogin);

// ២. ដាក់ឆ្មាំយាមមុខ API ដែលបញ្ជូនទិន្នន័យអតិថិជន (លុបអាជាន់គ្នាចេញសល់តែមួយនេះ)
router.get("/users", verifyUser, authController.getUsers);

// ផ្លូវ (Routes) សម្រាប់ការកំណត់គណនី
router.post("/change-password", authController.changePassword);
router.post("/change-pin", authController.changePin);
router.post("/change-limit", authController.changeLimit);

// 🔥 ផ្លូវ (Routes) សំខាន់សម្រាប់ការអាប់ឡូតរូបភាព និង KYC ចូល MongoDB
router.post(
  "/user/upload-image",
  upload.single("profileImg"),
  authController.uploadImage,
);
router.post(
  "/user/submit-kyc",
  upload.single("kycDoc"),
  authController.submitKyc,
);

// ផ្លូវ (Routes) សម្រាប់ភ្លេចលេខសម្ងាត់
router.post("/forgot-password/verify-user", authController.verifyUser);
router.post("/forgot-password/reset-password", authController.resetPassword);

// ផ្លូវ (Routes) សម្រាប់ Telegram Bot និងផ្សេងៗ
router.post("/generate-telegram-code", authController.generateTelegramCode);
router.post("/unlink-telegram", authController.unlinkTelegram);
router.get(
  "/bank/verify-account/:account_number",
  authController.verifyAccount,
);

router.get("/migrate-trx", authController.migrateTransactions);
module.exports = router;
