// ============================================================================
// ឯកសារ: routes/authRoutes.js
// អត្ថន័យ: បណ្តុំផ្លូវ (Routes) សម្រាប់ភ្ជាប់ទៅកាន់មុខងារ Auth, Profile, និង Settings
// ============================================================================

// ==========================================
// 📦 ផ្នែកទី ១៖ ទាញយកបណ្ណាល័យ និង Controller
// ==========================================
const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");

// ទាញយក Middleware សម្រាប់ការពារផ្លូវ (Route Guardian)
const { verifyUser } = require("../middleware/authMiddleware");

// ==========================================
// 🛡️ ផ្នែកទី ២៖ មុខងារអាវក្រោះការពារ (Safe Wrappers)
// ==========================================
// ការពារកុំឱ្យគាំង Server ពេលហៅឈ្មោះ Controller ឫ Middleware ខុស

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

// ==========================================
// 🚪 ផ្នែកទី ៣៖ ការចូល និងចាកចេញ (Login, Logout & Heartbeat)
// ==========================================
router.post("/login", safeHandler(authController.login, "login"));
router.post("/logout", safeHandler(authController.logout, "logout"));
router.post("/heartbeat", safeHandler(authController.heartbeat, "heartbeat"));

// 🔴 សម្រាប់ Admin (Admin Login)
router.post(
  "/admin/login",
  safeHandler(authController.adminLogin, "adminLogin"),
);
router.post(
  "/admin/nfc-login",
  safeHandler(authController.adminNfcLogin, "adminNfcLogin"),
);

// ==========================================
// 📝 ផ្នែកទី ៤៖ ការចុះឈ្មោះ (Registration)
// ==========================================
// 🟢 ចុះឈ្មោះដោយប្រើការផ្ទៀងផ្ទាត់ OTP (ថ្មី)
router.post(
  "/request-otp",
  safeHandler(authController.requestRegisterOTP, "requestRegisterOTP"),
);
router.post(
  "/verify-register",
  safeHandler(authController.verifyAndRegister, "verifyAndRegister"),
);

// 🔴 ចុះឈ្មោះបែបចាស់ (Legacy)
router.post("/register", safeHandler(authController.register, "register"));

// ==========================================
// 🔑 ផ្នែកទី ៥៖ ការសង្គ្រោះគណនី (Forgot Password)
// ==========================================
router.post(
  "/forgot-password/verify-user",
  safeHandler(authController.verifyUser, "verifyUser"),
);
router.post(
  "/forgot-password/verify-otp",
  safeHandler(authController.verifyForgotOtp, "verifyForgotOtp"),
);
router.post(
  "/forgot-password/reset-password",
  safeHandler(authController.resetPassword, "resetPassword"),
);
router.post(
  "/send-security-otp",
  safeHandler(authController.sendSecurityOtp, "sendSecurityOtp"),
);

// ==========================================
// ⚙️ ផ្នែកទី ៦៖ ការកំណត់សុវត្ថិភាព និងប្រវត្តិរូប (Security & Profile Settings)
// ==========================================
// ផ្ទៀងផ្ទាត់លេខសម្ងាត់ចាស់ ឫ PIN ចាស់
router.post(
  "/verify-password",
  safeHandler(authController.verifyCurrentPassword, "verifyCurrentPassword"),
);
router.post(
  "/verify-pin",
  safeHandler(authController.verifyCurrentPin, "verifyCurrentPin"),
);

// ប្តូរលេខសម្ងាត់ និង PIN ថ្មី
router.post(
  "/change-password",
  safeHandler(authController.changePassword, "changePassword"),
);
router.post("/change-pin", safeHandler(authController.changePin, "changePin"));

// ការបញ្ជូនរូបភាព និងឯកសារ (KYC)
router.post(
  "/user/upload-image",
  safeHandler(authController.uploadImage, "uploadImage"),
);
router.post(
  "/user/submit-kyc",
  safeHandler(authController.submitKyc, "submitKyc"),
);

// ==========================================
// 🏦 ផ្នែកទី ៧៖ ការគ្រប់គ្រងគណនីរង (Account Management - Protected)
// ==========================================
// 🛡️ ផ្លូវទាំងនេះត្រូវឆ្លងកាត់ safeVerifyUser ជាមុនសិន
router.post(
  "/account/rename",
  safeVerifyUser,
  safeHandler(authController.renameAccount, "renameAccount"),
);
router.post(
  "/account/update-limit",
  safeVerifyUser,
  safeHandler(authController.updateAccountLimit, "updateAccountLimit"),
);
router.post(
  "/account/toggle-freeze",
  safeVerifyUser,
  safeHandler(authController.toggleFreezeAccount, "toggleFreezeAccount"),
);
router.post(
  "/account/toggle-hide",
  safeVerifyUser,
  safeHandler(authController.toggleHideAccount, "toggleHideAccount"),
);

// ==========================================
// 📡 ផ្នែកទី ៨៖ ការទាញយកទិន្នន័យ (Data & Bank Operations)
// ==========================================
// ទាញយកទិន្នន័យ Users ទាំងអស់ (ត្រូវការ Token)
router.get(
  "/users",
  safeVerifyUser,
  safeHandler(authController.getUsers, "getUsers"),
);

// ផ្ទៀងផ្ទាត់ឈ្មោះម្ចាស់គណនីមុនវេរលុយ
router.get(
  "/bank/verify-account/:account_number",
  safeHandler(authController.verifyAccount, "verifyAccount"),
);

// ជម្លៀសប្រតិបត្តិការចាស់ៗ
router.get(
  "/migrate-trx",
  safeHandler(authController.migrateTransactions, "migrateTransactions"),
);

// ==========================================
// 🤖 ផ្នែកទី ៩៖ ការតភ្ជាប់ជាមួយ Telegram
// ==========================================
router.post(
  "/generate-telegram-code",
  safeHandler(authController.generateTelegramCode, "generateTelegramCode"),
);
router.post(
  "/unlink-telegram",
  safeHandler(authController.unlinkTelegram, "unlinkTelegram"),
);

// ==========================================
// 📤 ផ្នែកទី ១០៖ បញ្ចេញមុខងារ (Exports)
// ==========================================
module.exports = router;
