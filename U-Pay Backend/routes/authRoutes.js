// ============================================================================
// ឯកសារ: routes/authRoutes.js
// អត្ថន័យ: បណ្តុំផ្លូវ (Routes) សម្រាប់ភ្ជាប់ទៅកាន់មុខងារ Auth, Profile, និង Settings
// ============================================================================

// ==========================================
// 📦 ផ្នែកទី ១៖ ទាញយកបណ្ណាល័យ និង Controller (Imports)
// ==========================================
const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");

// ទាញយក Middleware សម្រាប់ការពារផ្លូវ (Route Guardian)
// បញ្ជាក់៖ រាល់ API ណាដែលទាមទារឱ្យ User ត្រូវតែ Login សិន ទើបយើងដាក់ verifyUser ការពារពីមុខ
const { verifyUser } = require("../middleware/authMiddleware");

// ==========================================
// 🛡️ ផ្នែកទី ២៖ មុខងារអាវក្រោះការពារ (Safe Wrappers)
// ==========================================
// ការពារកុំឱ្យគាំង Server ពេលហៅឈ្មោះ Controller ឫ Middleware ខុស (Undefined)

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
// 🚪 ផ្នែកទី ៣៖ ការចូល និងចាកចេញ (Login, Logout & Status)
// ==========================================

// ៣.១ សម្រាប់អតិថិជនទូទៅ (Users)
router.post("/login", safeHandler(authController.login, "login"));
router.post("/logout", safeHandler(authController.logout, "logout"));
router.post("/heartbeat", safeHandler(authController.heartbeat, "heartbeat")); // ឆែកមើលថា User កំពុង Online ឬអត់

// ==========================================
// 📝 ផ្នែកទី ៤៖ ការចុះឈ្មោះគណនីថ្មី (Registration)
// ==========================================

// ៤.១ ការចុះឈ្មោះស្ដង់ដារថ្មី (New Smart Flow ជាមួយ OTP & KYC)
router.post(
  "/request-otp",
  safeHandler(authController.requestRegisterOTP, "requestRegisterOTP"),
);
router.post(
  "/verify-register",
  safeHandler(authController.verifyAndRegister, "verifyAndRegister"),
);

// ៤.២ ការចុះឈ្មោះបែបចាស់ (Legacy Flow - រក្សាទុកកុំឱ្យគាំងប្រព័ន្ធចាស់)
router.post("/register", safeHandler(authController.register, "register"));

// ==========================================
// 🔑 ផ្នែកទី ៥៖ ការសង្គ្រោះគណនី និង OTP (Forgot Password & Security OTP)
// ==========================================

// ៥.១ ភ្លេចលេខសម្ងាត់ (Forgot Password Flow)
router.post(
  "/forgot-password/verify-user",
  safeHandler(authController.verifyUser, "verifyUser"), // ឆែកមើលថាមាន Email នេះអត់ រួចផ្ញើ OTP
);
router.post(
  "/forgot-password/verify-otp",
  safeHandler(authController.verifyForgotOtp, "verifyForgotOtp"), // ផ្ទៀងផ្ទាត់ OTP
);
router.post(
  "/forgot-password/reset-password",
  safeHandler(authController.resetPassword, "resetPassword"), // កំណត់ Password ថ្មី
);

// ៥.២ OTP សម្រាប់សុវត្ថិភាពទូទៅ (ឧ. ពេលចង់ប្តូរ PIN ឬ Password ក្នុង Settings)
router.post(
  "/send-security-otp",
  safeHandler(authController.sendSecurityOtp, "sendSecurityOtp"),
);

// ==========================================
// ⚙️ ផ្នែកទី ៦៖ ការកំណត់សុវត្ថិភាព និងប្រវត្តិរូប (Profile & Security Settings)
// ==========================================

// ៦.១ ផ្ទៀងផ្ទាត់ទិន្នន័យចាស់សិន មុនអនុញ្ញាតឱ្យប្តូរថ្មី
router.post(
  "/verify-password",
  safeHandler(authController.verifyCurrentPassword, "verifyCurrentPassword"),
);
router.post(
  "/verify-pin",
  safeHandler(authController.verifyCurrentPin, "verifyCurrentPin"),
);

// ៦.២ ប្តូរទិន្នន័យសម្ងាត់ថ្មី (Change Credentials)
router.post(
  "/change-password",
  safeHandler(authController.changePassword, "changePassword"),
);
router.post("/change-pin", safeHandler(authController.changePin, "changePin"));

// ៦.៣ រូបថតប្រវត្តិរូប និង ឯកសារ KYC (Profile & Identity)
router.post(
  "/user/upload-image",
  safeHandler(authController.uploadImage, "uploadImage"),
);
router.post(
  "/user/submit-kyc",
  safeHandler(authController.submitKyc, "submitKyc"),
);
// នៅក្នុងផ្នែកចុះឈ្មោះ (Registration)
router.post(
  "/scan-id-card",
  safeHandler(authController.scanIdCard, "scanIdCard"),
);

router.post(
  "/check-username",
  safeHandler(authController.checkUsername, "checkUsername"),
);

router.post(
  "/check-id-number",
  safeHandler(authController.checkIdNumber, "checkIdNumber"),
);
router.post(
  "/check-referral-code",
  safeHandler(authController.checkReferralCode, "checkReferralCode"),
);

// ==========================================
// 🏦 ផ្នែកទី ៧៖ ការគ្រប់គ្រងគណនីរង (Account Management)
// បញ្ជាក់៖ ផ្នែកនេះទាមទារសិទ្ធិ (Token) តាមរយៈ safeVerifyUser
// ==========================================

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
// 🤖 ផ្នែកទី ៨៖ ការតភ្ជាប់ប្រព័ន្ធ Telegram (Telegram Bot)
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
// 📡 ផ្នែកទី ៩៖ ទិន្នន័យទូទៅ និងធនាគារ (Data Retrieval & Banking)
// ==========================================

// ៩.១ ទាញយកទិន្នន័យអ្នកប្រើប្រាស់ទាំងអស់ (សម្រាប់ Admin ឫ ប្រព័ន្ធខាងក្នុង)
router.get(
  "/users",
  safeVerifyUser,
  safeHandler(authController.getUsers, "getUsers"),
);

// ៩.២ ផ្ទៀងផ្ទាត់ឈ្មោះម្ចាស់គណនី (ឧ. មុនពេលវេរលុយត្រូវឆែកឈ្មោះឱ្យឃើញសិន)
router.get(
  "/bank/verify-account/:account_number",
  safeHandler(authController.verifyAccount, "verifyAccount"),
);

// ==========================================
// 👑 ផ្នែកទី ១០៖ សម្រាប់រដ្ឋបាលប្រព័ន្ធ (Admin Operations)
// ==========================================

// ១០.១ ចូលគណនីដោយវាយអក្សរ
router.post(
  "/admin/login",
  safeHandler(authController.adminLogin, "adminLogin"),
);

// ១០.២ ចូលគណនីដោយស្កេនកាត NFC
router.post(
  "/admin/nfc-login",
  safeHandler(authController.adminNfcLogin, "adminNfcLogin"),
);

// ១០.៣ ជម្លៀសប្រតិបត្តិការចាស់ៗ (Data Migration)
router.get(
  "/migrate-trx",
  safeHandler(authController.migrateTransactions, "migrateTransactions"),
);

// ==========================================
// 📤 ផ្នែកទី ១១៖ បញ្ចេញមុខងារ (Exports)
// ==========================================
module.exports = router;
