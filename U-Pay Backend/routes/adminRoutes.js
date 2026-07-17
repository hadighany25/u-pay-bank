const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const merchantController = require("../controllers/merchantController");
const { checkRole } = require("../middleware/authMiddleware");

// ==========================================
// 🛡️ កំណត់អថេរសិទ្ធិ (Role Variables)
// ==========================================
const ROLE_SUPER = "super_admin";
const ROLE_FINANCE = "finance_admin";
const ROLE_SUPPORT = "support_agent";
const ROLE_CUSTOM = "custom";

// ==========================================
// 👑 ១. មុខងារកំពូល (ភាគច្រើនទាមទារសិទ្ធិ Super Admin តែម្នាក់គត់)
// ==========================================
// បិទ/បើក ប្រព័ន្ធទាំងមូល
router.post(
  "/toggle-system",
  checkRole([ROLE_SUPER]),
  adminController.toggleSystem,
);
// លុបគណនីអតិថិជន (បើកសិទ្ធិអោយ Custom ព្រោះ controller មានឆែកសិទ្ធិលម្អិតទៀត)
router.post(
  "/delete-user",
  checkRole([ROLE_SUPER, ROLE_CUSTOM]),
  adminController.deleteUser,
);
// មើលកំណត់ត្រាសកម្មភាពរបស់ Admin ទាំងអស់
router.get("/logs", checkRole([ROLE_SUPER]), adminController.getAdminLogs);
// បង្វិលលុយត្រឡប់ (Refund)
router.post(
  "/refund-transaction",
  checkRole([ROLE_SUPER, ROLE_FINANCE, ROLE_CUSTOM]),
  adminController.refundTransaction,
);
// មើលស្ថានភាពប្រព័ន្ធ
router.get(
  "/system-status",
  checkRole([ROLE_SUPER, ROLE_FINANCE, ROLE_SUPPORT, ROLE_CUSTOM]),
  adminController.getSystemStatus,
);
// មើលអត្រាប្តូរប្រាក់
router.get(
  "/fx/rates",
  checkRole([ROLE_SUPER, ROLE_FINANCE, ROLE_SUPPORT, ROLE_CUSTOM]),
  adminController.getFXRates,
);

// ==========================================
// 💰 ២. មុខងារហិរញ្ញវត្ថុ (Finance, Super, និង Custom)
// ==========================================
// ដាក់/ដកប្រាក់
router.post(
  "/adjust-balance",
  checkRole([ROLE_SUPER, ROLE_FINANCE, ROLE_CUSTOM]),
  adminController.adjustBalance,
);
// អនុម័តប្រតិបត្តិការ
router.post(
  "/approve-transaction",
  checkRole([ROLE_SUPER, ROLE_FINANCE, ROLE_CUSTOM]),
  adminController.approveTransaction,
);
// ផ្លាស់ប្តូរអត្រាប្តូរប្រាក់ (FX Rates)
router.post(
  "/fx/update",
  checkRole([ROLE_SUPER, ROLE_FINANCE, ROLE_CUSTOM]),
  adminController.updateFX,
);

// ==========================================
// 👥 ៣. មុខងារគ្រប់គ្រងគណនី Admin (សម្រាប់តែ Super Admin ប៉ុណ្ណោះ)
// ==========================================
// មើលបញ្ជីអ្នកគ្រប់គ្រង (Admins)
router.get(
  "/list-admins",
  checkRole([ROLE_SUPER]),
  adminController.getAdminsList,
);
// បង្កើត ឬកែប្រែគណនី Admin
router.post(
  "/save-admin",
  checkRole([ROLE_SUPER]),
  adminController.saveAdminAccount,
);
// លុបគណនី Admin
router.post(
  "/delete-admin",
  checkRole([ROLE_SUPER]),
  adminController.deleteAdminAccount,
);

// ==========================================
// 📊 ៤. មុខងារទូទៅ និងការគ្រប់គ្រងអតិថិជន
// ==========================================
// របាយការណ៍ស្ថិតិ (Stats)
router.get(
  "/stats",
  checkRole([ROLE_SUPER, ROLE_FINANCE, ROLE_SUPPORT, ROLE_CUSTOM]),
  adminController.getStats,
);
// របាយការណ៍បន្ថែម (Extra Dashboard)
router.get(
  "/dashboard-extra",
  checkRole([ROLE_SUPER, ROLE_FINANCE, ROLE_SUPPORT, ROLE_CUSTOM]),
  adminController.getDashboardExtra,
);
// មើលប្រតិបត្តិការលម្អិត
router.get(
  "/transaction/:id",
  checkRole([ROLE_SUPER, ROLE_FINANCE, ROLE_SUPPORT, ROLE_CUSTOM]),
  adminController.getTransaction,
);
// កែប្រែព័ត៌មានអតិថិជន
router.post(
  "/edit-user",
  checkRole([ROLE_SUPER, ROLE_FINANCE, ROLE_SUPPORT, ROLE_CUSTOM]),
  adminController.editUser,
);
// បិទ/បើក គណនីអតិថិជន (Freeze User)
router.post(
  "/toggle-freeze",
  checkRole([ROLE_SUPER, ROLE_FINANCE, ROLE_SUPPORT, ROLE_CUSTOM]),
  adminController.toggleFreeze,
);
// បិទ/បើក កាតអតិថិជន (Lock Card)
router.post(
  "/toggle-card-lock",
  checkRole([ROLE_SUPER, ROLE_FINANCE, ROLE_SUPPORT, ROLE_CUSTOM]),
  adminController.toggleAdminCardLock,
);
// អនុម័ត ឬបដិសេធ KYC
router.post(
  "/kyc-action",
  checkRole([ROLE_SUPER, ROLE_SUPPORT, ROLE_CUSTOM]),
  adminController.kycAction,
);
// ឆ្លើយតបសំបុត្រជំនួយ (Ticket Reply)
router.post(
  "/ticket-reply",
  checkRole([ROLE_SUPER, ROLE_SUPPORT, ROLE_CUSTOM]),
  adminController.ticketReply,
);
// ទាញយកព័ត៌មាន Admin ផ្ទាល់ខ្លួន
router.get(
  "/me",
  checkRole([ROLE_SUPER, ROLE_FINANCE, ROLE_SUPPORT, ROLE_CUSTOM]),
  adminController.getMe,
);

// ==========================================
// 📢 ៥. មុខងារផ្សព្វផ្សាយ និងរង្វាន់ (Broadcast & Promo)
// ==========================================
// ផ្ញើសារជូនដំណឹង (Broadcast)
router.post(
  "/broadcast",
  checkRole([ROLE_SUPER, ROLE_FINANCE, ROLE_SUPPORT, ROLE_CUSTOM]),
  adminController.broadcast,
);
// លុបសារជូនដំណឹង
router.post(
  "/delete-broadcast",
  checkRole([ROLE_SUPER, ROLE_FINANCE, ROLE_SUPPORT, ROLE_CUSTOM]),
  adminController.deleteBroadcast,
);
// មើលថ្លៃសេវា (Fee Settings)
router.get(
  "/fees",
  checkRole([ROLE_SUPER, ROLE_FINANCE, ROLE_SUPPORT, ROLE_CUSTOM]),
  adminController.getFeeSettings,
);
// កែប្រែថ្លៃសេវា (Super Admin តែម្នាក់គត់)
router.post(
  "/fees",
  checkRole([ROLE_SUPER]),
  adminController.updateFeeSettings,
);
// បង្កើតកូដប្រូម៉ូសិន (Promo Code)
router.post(
  "/promo/create",
  checkRole([ROLE_SUPER, ROLE_FINANCE, ROLE_CUSTOM]),
  adminController.createPromoCode,
);
// មើលបញ្ជីកូដប្រូម៉ូសិន
router.get(
  "/promos",
  checkRole([ROLE_SUPER, ROLE_FINANCE, ROLE_SUPPORT, ROLE_CUSTOM]),
  adminController.getPromoCodes,
);
// បិទ/បើក កូដប្រូម៉ូសិន
router.post(
  "/promo/toggle",
  checkRole([ROLE_SUPER, ROLE_FINANCE, ROLE_CUSTOM]),
  adminController.togglePromoCode,
);

// ==========================================
// 🏪 ៦. មុខងារគ្រប់គ្រង ហាងទំនិញ (Merchant Management)
// ==========================================
// ផ្អាកហាង (Freeze Merchant)
router.post(
  "/toggle-merchant-freeze",
  checkRole([ROLE_SUPER, ROLE_FINANCE, ROLE_CUSTOM]),
  merchantController.adminToggleMerchantFreeze,
);
// លុបហាង
router.delete(
  "/delete-merchant/:id",
  checkRole([ROLE_SUPER, ROLE_FINANCE, ROLE_CUSTOM]),
  merchantController.adminDeleteMerchant,
);
// កែប្រែព័ត៌មានហាង
router.put(
  "/edit-merchant",
  checkRole([ROLE_SUPER, ROLE_FINANCE, ROLE_CUSTOM]),
  merchantController.adminEditMerchant,
);
// បង្កើតហាងថ្មី
router.post(
  "/create-merchant",
  checkRole([ROLE_SUPER, ROLE_CUSTOM]),
  adminController.adminCreateMerchant,
);

// ==========================================
// ⚙️ ៧. មុខងារ Logs និងកាតបន្ថែម
// ==========================================
// កត់ត្រាសកម្មភាព Admin
router.post(
  "/log-action",
  checkRole([ROLE_SUPER, ROLE_FINANCE, ROLE_SUPPORT, ROLE_CUSTOM]),
  adminController.logCustomAction,
);
// លុបកាតចោល
router.post(
  "/delete-card",
  checkRole([ROLE_SUPER, ROLE_CUSTOM]),
  adminController.adminDeleteCard,
);
// បង្កើតកាតថ្មី
router.post(
  "/create-card",
  checkRole([ROLE_SUPER, ROLE_CUSTOM]),
  adminController.adminCreateCard,
);
// អាប់ឡូតឯកសារ KYC
router.post(
  "/upload-kyc",
  checkRole([ROLE_SUPER, ROLE_SUPPORT, ROLE_CUSTOM]),
  adminController.adminUploadKyc,
);
// បង្ខំអោយ Logout (Force Logout)
router.post(
  "/force-logout",
  checkRole([ROLE_SUPER, ROLE_CUSTOM]),
  adminController.adminForceLogout,
);

// ==========================================
// 🛍️ ៨. មុខងារសម្រាប់បញ្ជរគិតប្រាក់ (Cashier System)
// ==========================================
// ស្វែងរកអតិថិជនដើម្បីគិតប្រាក់
router.get(
  "/cashier/search/:identifier",
  checkRole([ROLE_SUPER, ROLE_FINANCE, ROLE_SUPPORT, ROLE_CUSTOM]),
  adminController.searchCashierUser,
);
// ដំណើរការគិតប្រាក់ (Cashier Transaction)
router.post(
  "/cashier/transaction",
  checkRole([ROLE_SUPER, ROLE_FINANCE, ROLE_SUPPORT, ROLE_CUSTOM]),
  adminController.processCashierTransaction,
);

// ==========================================
// 🔍 ៩. CUSTOMER 360° ROUTES (LIVE DB SEARCH)
// ==========================================
// ស្វែងរកអតិថិជនដោយ Admin
router.post(
  "/search-user",
  checkRole([ROLE_SUPER, ROLE_FINANCE, ROLE_SUPPORT, ROLE_CUSTOM]),
  adminController.searchUserByAdmin,
);
// ទាញយកព័ត៌មានអតិថិជនលម្អិត
router.post(
  "/get-user",
  checkRole([ROLE_SUPER, ROLE_FINANCE, ROLE_SUPPORT, ROLE_CUSTOM]),
  adminController.getUserByAdmin,
);

module.exports = router;
