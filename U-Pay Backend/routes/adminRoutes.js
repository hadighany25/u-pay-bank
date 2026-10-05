// ============================================================================
// ឯកសារ: routes/adminRoutes.js
// អត្ថន័យ: បណ្តុំផ្លូវ (Routes) សម្រាប់គ្រប់គ្រងប្រព័ន្ធ U-PAY Admin
// ============================================================================

// ==========================================
// 📦 ផ្នែកទី ១៖ ទាញយកបណ្ណាល័យ និង Controller
// ==========================================
const express = require("express");
const router = express.Router();

const adminController = require("../controllers/adminController");
const merchantController = require("../controllers/merchantController");
const cardController = require("../controllers/cardController");
const aiController = require("../controllers/aiController");

const { checkRole } = require("../middleware/authMiddleware");

// ==========================================
// 🛡️ ផ្នែកទី ២៖ កំណត់សិទ្ធិ (Roles) & មុខងារការពារ (Safe Wrapper)
// ==========================================
const ROLE_SUPER = "super_admin";
const ROLE_FINANCE = "finance_admin";
const ROLE_SUPPORT = "support_agent";
const ROLE_CUSTOM = "custom";

// ការពារកុំឱ្យគាំង Server ពេលហៅឈ្មោះ Controller ខុស
const safeHandler = (handler, name) => {
  if (typeof handler !== "function") {
    console.error(
      `🚨 [រកឃើញកំហុស]: adminController.${name} គឺអត់មានទេ (Undefined)!`,
    );
    return (req, res, next) =>
      res
        .status(500)
        .json({ success: false, message: `កូដផ្នែក ${name} មិនទាន់ដំណើរការ!` });
  }
  return handler;
};

// ==========================================
// 👑 ផ្នែកទី ៣៖ មុខងារកំពូល (System Config & Setup)
// ==========================================
// បិទ/បើក ប្រព័ន្ធទាំងមូល
router.post(
  "/toggle-system",
  checkRole([ROLE_SUPER]),
  safeHandler(adminController.toggleSystem, "toggleSystem"),
);

// មើលស្ថានភាពប្រព័ន្ធ និងអត្រាប្តូរប្រាក់
router.get(
  "/system-status",
  checkRole([ROLE_SUPER, ROLE_FINANCE, ROLE_SUPPORT, ROLE_CUSTOM]),
  safeHandler(adminController.getSystemStatus, "getSystemStatus"),
);
router.get(
  "/fx/rates",
  checkRole([ROLE_SUPER, ROLE_FINANCE, ROLE_SUPPORT, ROLE_CUSTOM]),
  safeHandler(adminController.getFXRates, "getFXRates"),
);

// មើលថ្លៃសេវា និងកែប្រែថ្លៃសេវា
router.get(
  "/fees",
  checkRole([ROLE_SUPER, ROLE_FINANCE, ROLE_SUPPORT, ROLE_CUSTOM]),
  safeHandler(adminController.getFeeSettings, "getFeeSettings"),
);
router.post(
  "/fees",
  checkRole([ROLE_SUPER]),
  safeHandler(adminController.updateFeeSettings, "updateFeeSettings"),
);

// មើលកំណត់ត្រាសកម្មភាពរបស់ Admin ទាំងអស់
router.get(
  "/logs",
  checkRole([ROLE_SUPER]),
  safeHandler(adminController.getAdminLogs, "getAdminLogs"),
);
router.post(
  "/log-action",
  checkRole([ROLE_SUPER, ROLE_FINANCE, ROLE_SUPPORT, ROLE_CUSTOM]),
  safeHandler(adminController.logCustomAction, "logCustomAction"),
);

// ==========================================
// 👥 ផ្នែកទី ៤៖ គ្រប់គ្រងគណនី Admin គ្នាឯង
// ==========================================
router.get(
  "/me",
  checkRole([ROLE_SUPER, ROLE_FINANCE, ROLE_SUPPORT, ROLE_CUSTOM]),
  safeHandler(adminController.getMe, "getMe"),
);
router.get(
  "/list-admins",
  checkRole([ROLE_SUPER]),
  safeHandler(adminController.getAdminsList, "getAdminsList"),
);
router.post(
  "/save-admin",
  checkRole([ROLE_SUPER]),
  safeHandler(adminController.saveAdminAccount, "saveAdminAccount"),
);
router.post(
  "/delete-admin",
  checkRole([ROLE_SUPER]),
  safeHandler(adminController.deleteAdminAccount, "deleteAdminAccount"),
);
router.post(
  "/toggle-admin-status",
  checkRole([ROLE_SUPER]),
  safeHandler(adminController.toggleAdminStatus, "toggleAdminStatus"),
);
router.post(
  "/reset-admin-password",
  checkRole([ROLE_SUPER]),
  safeHandler(adminController.adminResetPassword, "adminResetPassword"),
);
router.post(
  "/check-nfc",
  checkRole([ROLE_SUPER]),
  safeHandler(adminController.checkAdminNfcUid, "checkAdminNfcUid"),
);

// ==========================================
// 📊 ផ្នែកទី ៥៖ របាយការណ៍ និងស្ថិតិ (Dashboard)
// ==========================================
router.get(
  "/stats",
  checkRole([ROLE_SUPER, ROLE_FINANCE, ROLE_SUPPORT, ROLE_CUSTOM]),
  safeHandler(adminController.getStats, "getStats"),
);
router.get(
  "/dashboard-extra",
  checkRole([ROLE_SUPER, ROLE_FINANCE, ROLE_SUPPORT, ROLE_CUSTOM]),
  safeHandler(adminController.getDashboardExtra, "getDashboardExtra"),
);

// ==========================================
// 🔍 ផ្នែកទី ៦៖ គ្រប់គ្រងអតិថិជន (Customer 360)
// ==========================================
router.post(
  "/create-user",
  checkRole([ROLE_SUPER, ROLE_SUPPORT, ROLE_CUSTOM]), // កំណត់ថា Admin ណាខ្លះអាចបង្កើតបាន
  safeHandler(adminController.adminCreateUser, "adminCreateUser"),
);
router.post(
  "/search-user",
  checkRole([ROLE_SUPER, ROLE_FINANCE, ROLE_SUPPORT, ROLE_CUSTOM]),
  safeHandler(adminController.searchUserByAdmin, "searchUserByAdmin"),
);
router.post(
  "/get-user",
  checkRole([ROLE_SUPER, ROLE_FINANCE, ROLE_SUPPORT, ROLE_CUSTOM]),
  safeHandler(adminController.getUserByAdmin, "getUserByAdmin"),
);
router.post(
  "/edit-user",
  checkRole([ROLE_SUPER, ROLE_FINANCE, ROLE_SUPPORT, ROLE_CUSTOM]),
  safeHandler(adminController.editUser, "editUser"),
);
router.post(
  "/delete-user",
  checkRole([ROLE_SUPER, ROLE_CUSTOM]),
  safeHandler(adminController.deleteUser, "deleteUser"),
);
router.post(
  "/toggle-freeze",
  checkRole([ROLE_SUPER, ROLE_FINANCE, ROLE_SUPPORT, ROLE_CUSTOM]),
  safeHandler(adminController.toggleFreeze, "toggleFreeze"),
);
router.post(
  "/force-logout",
  checkRole([ROLE_SUPER, ROLE_CUSTOM]),
  safeHandler(adminController.adminForceLogout, "adminForceLogout"),
);
router.post(
  "/kyc-action",
  checkRole([ROLE_SUPER, ROLE_SUPPORT, ROLE_CUSTOM]),
  safeHandler(adminController.kycAction, "kycAction"),
);
router.post(
  "/upload-kyc",
  checkRole([ROLE_SUPER, ROLE_SUPPORT, ROLE_CUSTOM]),
  safeHandler(adminController.adminUploadKyc, "adminUploadKyc"),
);

// ==========================================
// 💰 ផ្នែកទី ៧៖ ហិរញ្ញវត្ថុ និងប្រតិបត្តិការ (Finance)
// ==========================================
router.get(
  "/transaction/:id",
  checkRole([ROLE_SUPER, ROLE_FINANCE, ROLE_SUPPORT, ROLE_CUSTOM]),
  safeHandler(adminController.getTransaction, "getTransaction"),
);
router.post(
  "/adjust-balance",
  checkRole([ROLE_SUPER, ROLE_FINANCE, ROLE_CUSTOM]),
  safeHandler(adminController.adjustBalance, "adjustBalance"),
);
router.post(
  "/approve-transaction",
  checkRole([ROLE_SUPER, ROLE_FINANCE, ROLE_CUSTOM]),
  safeHandler(adminController.approveTransaction, "approveTransaction"),
);
router.post(
  "/refund-transaction",
  checkRole([ROLE_SUPER, ROLE_FINANCE, ROLE_CUSTOM]),
  safeHandler(adminController.refundTransaction, "refundTransaction"),
);
router.post(
  "/fx/update",
  checkRole([ROLE_SUPER, ROLE_FINANCE, ROLE_CUSTOM]),
  safeHandler(adminController.updateFX, "updateFX"),
);

// ==========================================
// 🛍️ ផ្នែកទី ៨៖ បញ្ជរគិតប្រាក់ (Cashier System & Approvals)
// ==========================================
router.get(
  "/cashier/search/:identifier",
  checkRole([ROLE_SUPER, ROLE_FINANCE, ROLE_SUPPORT, ROLE_CUSTOM]),
  safeHandler(adminController.searchCashierUser, "searchCashierUser"),
);

// 🟢 បង្កើត Ticket ដោយ Maker
router.post(
  "/cashier/ticket/create",
  checkRole([ROLE_SUPER, ROLE_FINANCE, ROLE_SUPPORT, ROLE_CUSTOM]),
  safeHandler(adminController.createCashierTicket, "createCashierTicket"),
);

// 🟢 ទាញយក Ticket ទាំងអស់មកឱ្យ Checker មើល
router.get(
  "/cashier/tickets",
  checkRole([ROLE_SUPER, ROLE_FINANCE, ROLE_SUPPORT, ROLE_CUSTOM]),
  safeHandler(adminController.getCashierTickets, "getCashierTickets"),
);

// 🟢 Checker ចុច Approve ឬ Reject
router.post(
  "/cashier/ticket/action",
  checkRole([ROLE_SUPER, ROLE_FINANCE, ROLE_CUSTOM]), // (Support ធម្មតាមិនឱ្យ Approve ទេ)
  safeHandler(adminController.actionCashierTicket, "actionCashierTicket"),
);

// ==========================================
// 💳 ផ្នែកទី ៩៖ កាត NFC និងហាងទំនិញ (Cards & Merchants)
// ==========================================
router.post(
  "/create-card",
  checkRole([ROLE_SUPER, ROLE_CUSTOM]),
  safeHandler(adminController.adminCreateCard, "adminCreateCard"),
);
router.post(
  "/delete-card",
  checkRole([ROLE_SUPER, ROLE_CUSTOM]),
  safeHandler(adminController.adminDeleteCard, "adminDeleteCard"),
);
router.post(
  "/toggle-card-lock",
  checkRole([ROLE_SUPER, ROLE_FINANCE, ROLE_SUPPORT, ROLE_CUSTOM]),
  safeHandler(adminController.toggleAdminCardLock, "toggleAdminCardLock"),
);

// NFC Cards (តភ្ជាប់មកពី cardController)
router.post(
  "/cards/bind-nfc",
  checkRole([ROLE_SUPER, ROLE_CUSTOM]),
  cardController.bindNfcCard,
);
router.post(
  "/cards/unbind-nfc",
  checkRole([ROLE_SUPER, ROLE_CUSTOM]),
  cardController.unbindNfcCard,
);

// Merchants (តភ្ជាប់មកពី merchantController និង adminController)
router.post(
  "/create-merchant",
  checkRole([ROLE_SUPER, ROLE_CUSTOM]),
  safeHandler(adminController.adminCreateMerchant, "adminCreateMerchant"),
);
router.post(
  "/toggle-merchant-freeze",
  checkRole([ROLE_SUPER, ROLE_FINANCE, ROLE_CUSTOM]),
  merchantController.adminToggleMerchantFreeze,
);
router.put(
  "/edit-merchant",
  checkRole([ROLE_SUPER, ROLE_FINANCE, ROLE_CUSTOM]),
  merchantController.adminEditMerchant,
);
router.delete(
  "/delete-merchant/:id",
  checkRole([ROLE_SUPER, ROLE_FINANCE, ROLE_CUSTOM]),
  merchantController.adminDeleteMerchant,
);

// ==========================================
// 📢 ផ្នែកទី ១០៖ ទីផ្សារ ជំនួយអតិថិជន និង AI (Promo, Tickets, Broadcast & AI)
// ==========================================
router.post(
  "/promo/create",
  checkRole([ROLE_SUPER, ROLE_FINANCE, ROLE_CUSTOM]),
  safeHandler(adminController.createPromoCode, "createPromoCode"),
);
router.get(
  "/promos",
  checkRole([ROLE_SUPER, ROLE_FINANCE, ROLE_SUPPORT, ROLE_CUSTOM]),
  safeHandler(adminController.getPromoCodes, "getPromoCodes"),
);
router.post(
  "/promo/toggle",
  checkRole([ROLE_SUPER, ROLE_FINANCE, ROLE_CUSTOM]),
  safeHandler(adminController.togglePromoCode, "togglePromoCode"),
);

router.post(
  "/ticket-reply",
  checkRole([ROLE_SUPER, ROLE_SUPPORT, ROLE_CUSTOM]),
  safeHandler(adminController.ticketReply, "ticketReply"),
);
router.post(
  "/broadcast",
  checkRole([ROLE_SUPER, ROLE_FINANCE, ROLE_SUPPORT, ROLE_CUSTOM]),
  safeHandler(adminController.broadcast, "broadcast"),
);
router.get(
  "/broadcast-history",
  checkRole([ROLE_SUPER, ROLE_FINANCE, ROLE_SUPPORT, ROLE_CUSTOM]),
  safeHandler(adminController.getBroadcastHistory, "getBroadcastHistory"),
);
router.post(
  "/delete-broadcast",
  checkRole([ROLE_SUPER, ROLE_FINANCE, ROLE_SUPPORT, ROLE_CUSTOM]),
  safeHandler(adminController.deleteBroadcast, "deleteBroadcast"),
);

// 🤖 AI Smart Reply
router.post(
  "/ai-reply",
  checkRole([ROLE_SUPER, ROLE_SUPPORT, ROLE_CUSTOM]),
  aiController.generateAdminAIReply,
);

router.post(
  "/send-message",
  checkRole([ROLE_SUPER, ROLE_SUPPORT, ROLE_CUSTOM]),
  safeHandler(adminController.sendDirectMessage, "sendDirectMessage"),
);

// ==========================================
// 📤 ផ្នែកទី ១១៖ បញ្ចេញមុខងារ (Exports)
// ==========================================
module.exports = router;
