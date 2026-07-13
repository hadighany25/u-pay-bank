const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const merchantController = require("../controllers/merchantController");
const { checkRole } = require("../middleware/authMiddleware");

const ROLE_SUPER = "super_admin";
const ROLE_FINANCE = "finance_admin";
const ROLE_SUPPORT = "support_agent";
const ROLE_CUSTOM = "custom";

// ១. មុខងារដែលទាមទារសិទ្ធិ Super Admin តែម្នាក់គត់
router.post(
  "/toggle-system",
  checkRole([ROLE_SUPER]),
  adminController.toggleSystem,
);
router.post(
  "/delete-user",
  checkRole([ROLE_SUPER]),
  adminController.deleteUser,
);
router.get("/logs", checkRole([ROLE_SUPER]), adminController.getAdminLogs);

router.post(
  "/refund-transaction",
  checkRole([ROLE_SUPER]),
  adminController.refundTransaction,
);

router.get(
  "/system-status",
  checkRole([ROLE_SUPER, ROLE_FINANCE, ROLE_SUPPORT]),
  adminController.getSystemStatus,
);
router.get(
  "/fx/rates",
  checkRole([ROLE_SUPER, ROLE_FINANCE, ROLE_SUPPORT]),
  adminController.getFXRates,
);

// ២. មុខងារហិរញ្ញវត្ថុ (Super Admin និង Finance អាចធ្វើបាន)
router.post(
  "/adjust-balance",
  checkRole([ROLE_SUPER, ROLE_FINANCE]),
  adminController.adjustBalance,
);
router.post(
  "/approve-transaction",
  checkRole([ROLE_SUPER, ROLE_FINANCE]),
  adminController.approveTransaction,
);
router.post(
  "/fx/update",
  checkRole([ROLE_SUPER, ROLE_FINANCE]),
  adminController.updateFX,
);

router.get(
  "/list-admins",
  checkRole([ROLE_SUPER]),
  adminController.getAdminsList,
);
router.post(
  "/save-admin",
  checkRole([ROLE_SUPER]),
  adminController.saveAdminAccount,
);
router.post(
  "/delete-admin",
  checkRole([ROLE_SUPER]),
  adminController.deleteAdminAccount,
);

// ៣. មុខងារទូទៅ (Admin ទាំង ៣ ប្រភេទអាចមើលបាន)
router.get(
  "/stats",
  checkRole([ROLE_SUPER, ROLE_FINANCE, ROLE_SUPPORT]),
  adminController.getStats,
);
router.get(
  "/dashboard-extra",
  checkRole([ROLE_SUPER, ROLE_FINANCE, ROLE_SUPPORT]),
  adminController.getDashboardExtra,
);
router.get(
  "/transaction/:id",
  checkRole([ROLE_SUPER, ROLE_FINANCE, ROLE_SUPPORT]),
  adminController.getTransaction,
);
router.post(
  "/edit-user",
  checkRole([ROLE_SUPER, ROLE_FINANCE, ROLE_SUPPORT]),
  adminController.editUser,
);
router.post(
  "/toggle-card-lock",
  checkRole([ROLE_SUPER, ROLE_FINANCE, ROLE_SUPPORT, ROLE_CUSTOM]),
  adminController.toggleAdminCardLock,
);
router.post(
  "/kyc-action",
  checkRole([ROLE_SUPER, ROLE_SUPPORT]),
  adminController.kycAction,
);
router.post(
  "/ticket-reply",
  checkRole([ROLE_SUPER, ROLE_SUPPORT]),
  adminController.ticketReply,
);
router.get(
  "/me",
  checkRole([ROLE_SUPER, ROLE_FINANCE, ROLE_SUPPORT, ROLE_CUSTOM]),
  adminController.getMe,
);

router.post(
  "/broadcast",
  checkRole([ROLE_SUPER, ROLE_FINANCE, ROLE_SUPPORT, ROLE_CUSTOM]),
  adminController.broadcast,
);
router.post(
  "/delete-broadcast",
  checkRole([ROLE_SUPER, ROLE_FINANCE, ROLE_SUPPORT, ROLE_CUSTOM]),
  adminController.deleteBroadcast,
);
router.get(
  "/fees",
  checkRole([ROLE_SUPER, ROLE_FINANCE, ROLE_SUPPORT, ROLE_CUSTOM]),
  adminController.getFeeSettings,
);
router.post(
  "/fees",
  checkRole([ROLE_SUPER]),
  adminController.updateFeeSettings,
);
router.post(
  "/promo/create",
  checkRole([ROLE_SUPER, ROLE_FINANCE]),
  adminController.createPromoCode,
);
router.get(
  "/promos",
  checkRole([ROLE_SUPER, ROLE_FINANCE, ROLE_SUPPORT, ROLE_CUSTOM]),
  adminController.getPromoCodes,
);
router.post(
  "/promo/toggle",
  checkRole([ROLE_SUPER, ROLE_FINANCE]),
  adminController.togglePromoCode,
);

// ៤. មុខងារគ្រប់គ្រង Merchant
router.post(
  "/toggle-merchant-freeze",
  checkRole([ROLE_SUPER, ROLE_FINANCE]),
  merchantController.adminToggleMerchantFreeze,
);
router.delete(
  "/delete-merchant/:id",
  checkRole([ROLE_SUPER, ROLE_FINANCE]),
  merchantController.adminDeleteMerchant,
);
router.put(
  "/edit-merchant",
  checkRole([ROLE_SUPER, ROLE_FINANCE]),
  merchantController.adminEditMerchant,
);
router.post(
  "/create-merchant",
  checkRole([ROLE_SUPER]),
  adminController.adminCreateMerchant,
);

// ៥. មុខងារ Logs និងកាត
router.post(
  "/log-action",
  checkRole([ROLE_SUPER, ROLE_FINANCE, ROLE_SUPPORT, ROLE_CUSTOM]),
  adminController.logCustomAction,
);
router.post(
  "/delete-card",
  checkRole([ROLE_SUPER]),
  adminController.adminDeleteCard,
);
router.post(
  "/create-card",
  checkRole([ROLE_SUPER]),
  adminController.adminCreateCard,
);
router.post(
  "/upload-kyc",
  checkRole([ROLE_SUPER, ROLE_SUPPORT]),
  adminController.adminUploadKyc,
);
router.post(
  "/force-logout",
  checkRole([ROLE_SUPER]),
  adminController.adminForceLogout,
);

// 🌟 ៦. Routes សម្រាប់មុខងារ Cashier
router.get(
  "/cashier/search/:identifier",
  checkRole([ROLE_SUPER, ROLE_FINANCE, ROLE_SUPPORT, ROLE_CUSTOM]),
  adminController.searchCashierUser,
);
router.post(
  "/cashier/transaction",
  checkRole([ROLE_SUPER, ROLE_FINANCE, ROLE_SUPPORT, ROLE_CUSTOM]),
  adminController.processCashierTransaction,
);

// ==========================================
// 🛡️ ៧. CUSTOMER 360° ROUTES (LIVE DB SEARCH)
// ==========================================
router.post(
  "/search-user",
  checkRole([ROLE_SUPER, ROLE_FINANCE, ROLE_SUPPORT, ROLE_CUSTOM]),
  adminController.searchUserByAdmin,
);
// 🔥 ទុកតែមួយនេះ ដើម្បីកុំឱ្យជាន់គ្នា (លុបអាចាស់ចោលហើយ)
router.post(
  "/get-user",
  checkRole([ROLE_SUPER, ROLE_FINANCE, ROLE_SUPPORT, ROLE_CUSTOM]),
  adminController.getUserByAdmin,
);

module.exports = router;
