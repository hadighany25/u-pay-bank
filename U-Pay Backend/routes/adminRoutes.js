const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const { checkRole } = require("../middleware/authMiddleware");

const ROLE_SUPER = "super_admin";
const ROLE_FINANCE = "finance_admin";
const ROLE_SUPPORT = "support_agent";

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
// បន្ថែមបន្ទាត់នេះ ដើម្បីអោយ Super Admin អាចទាញមើលប្រវត្តិ Logs បាន
router.get("/logs", checkRole(["super_admin"]), adminController.getAdminLogs);
// 🔥 អាប់ដេត៖ ដកសិទ្ធិ Finance ចេញ អោយតែ Super ទើបអាច Refund បាន!
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
// 🔥 បន្ថែមផ្លូវនេះដើម្បីឱ្យ Admin អាច Save អត្រាប្តូរប្រាក់ (FX) ថ្មីបាន!
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
  checkRole(["super_admin", "finance_admin", "support_agent", "custom"]),
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
// បន្ថែមពាក្យ "custom" ចូលទៅក្នុង Array ផង ដើម្បីអោយអ្នកមាន Role នេះអាចចូលបាន
router.get(
  "/me",
  checkRole([ROLE_SUPER, ROLE_FINANCE, ROLE_SUPPORT, "custom"]),
  adminController.getMe,
);

router.post(
  "/broadcast",
  checkRole(["super_admin", "finance_admin", "support_agent", "custom"]),
  adminController.broadcast,
);
router.post(
  "/delete-broadcast",
  checkRole(["super_admin", "finance_admin", "support_agent", "custom"]),
  adminController.deleteBroadcast,
);
router.get(
  "/fees",
  checkRole(["super_admin", "finance_admin", "support_agent", "custom"]),
  adminController.getFeeSettings,
);
router.post(
  "/fees",
  checkRole(["super_admin"]),
  adminController.updateFeeSettings,
);
router.post(
  "/promo/create",
  checkRole(["super_admin", "finance_admin"]),
  adminController.createPromoCode,
);
// ផ្លូវសម្រាប់ទាញយក និង បិទ/បើកកូដ
router.get(
  "/promos",
  checkRole(["super_admin", "finance_admin", "support_agent", "custom"]),
  adminController.getPromoCodes,
);
router.post(
  "/promo/toggle",
  checkRole(["super_admin", "finance_admin"]),
  adminController.togglePromoCode,
);
router.post(
  "/toggle-merchant-freeze",
  checkRole([ROLE_SUPER, ROLE_FINANCE]),
  merchantController.adminToggleMerchantFreeze,
);

// បន្ថែម ២ បន្ទាត់នេះ៖
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
module.exports = router;
