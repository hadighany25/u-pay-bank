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

// =====================================================================
// 🛡️ មុខងារអាវក្រោះការពារ (Safe Wrapper) កុំឱ្យគាំង Server ពេលបាត់ Controller ណាមួយ
// =====================================================================
const safeHandler = (handler, name) => {
  if (typeof handler !== "function") {
    console.error(
      `🚨 [រកឃើញកំហុស]: authController.${name} គឺអត់មានទេ (Undefined)! សូមឆែកមើលឯកសារ authController.js វិញថាតើបាន Export វាហើយឬនៅ។`,
    );
    return (req, res, next) =>
      res
        .status(500)
        .json({ success: false, message: `កូដផ្នែក ${name} មិនទាន់ដំណើរការ!` });
  }
  return handler;
};

// 🛡️ ការពារ Middleware ដូចគ្នា
let safeVerifyUser = verifyUser;
if (typeof verifyUser !== "function") {
  console.error(
    "🚨 [រកឃើញកំហុស]: verifyUser គឺ Undefined! សូមឆែកមើលការ Export ក្នុង authMiddleware.js",
  );
  safeVerifyUser = (req, res, next) =>
    res
      .status(500)
      .json({ success: false, message: "Middleware verifyUser អត់ដំណើរការ!" });
}
// =====================================================================

// ផ្លូវ (Routes) សម្រាប់ការចុះឈ្មោះ និង Login
router.post("/register", safeHandler(authController.register, "register"));
router.post("/login", safeHandler(authController.login, "login"));
router.post("/logout", safeHandler(authController.logout, "logout"));
router.post("/heartbeat", safeHandler(authController.heartbeat, "heartbeat"));
router.post(
  "/admin/login",
  safeHandler(authController.adminLogin, "adminLogin"),
);

// ២. ដាក់ឆ្មាំយាមមុខ API ដែលបញ្ជូនទិន្នន័យអតិថិជន
router.get(
  "/users",
  safeVerifyUser,
  safeHandler(authController.getUsers, "getUsers"),
);

// ផ្លូវ (Routes) សម្រាប់ការកំណត់គណនី
router.post(
  "/change-password",
  safeHandler(authController.changePassword, "changePassword"),
);
router.post("/change-pin", safeHandler(authController.changePin, "changePin"));
router.post(
  "/change-limit",
  safeHandler(authController.changeLimit, "changeLimit"),
);

// 🔥 ផ្លូវ (Routes) សំខាន់សម្រាប់ការអាប់ឡូតរូបភាព និង KYC ចូល MongoDB
router.post(
  "/user/upload-image",
  upload.single("profileImg"),
  safeHandler(authController.uploadImage, "uploadImage"),
);
router.post(
  "/user/submit-kyc",
  upload.single("kycDoc"),
  safeHandler(authController.submitKyc, "submitKyc"),
);

// ផ្លូវ (Routes) សម្រាប់ភ្លេចលេខសម្ងាត់
router.post(
  "/forgot-password/verify-user",
  safeHandler(authController.verifyUser, "verifyUser"),
);
router.post(
  "/forgot-password/reset-password",
  safeHandler(authController.resetPassword, "resetPassword"),
);

// ផ្លូវ (Routes) សម្រាប់ Telegram Bot និងផ្សេងៗ
router.post(
  "/generate-telegram-code",
  safeHandler(authController.generateTelegramCode, "generateTelegramCode"),
);
router.post(
  "/unlink-telegram",
  safeHandler(authController.unlinkTelegram, "unlinkTelegram"),
);
router.get(
  "/bank/verify-account/:account_number",
  safeHandler(authController.verifyAccount, "verifyAccount"),
);

router.get(
  "/migrate-trx",
  safeHandler(authController.migrateTransactions, "migrateTransactions"),
);

module.exports = router;
