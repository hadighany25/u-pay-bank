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
  "/kyc-action",
  checkRole([ROLE_SUPER, ROLE_SUPPORT]),
  adminController.kycAction,
);
router.post(
  "/ticket-reply",
  checkRole([ROLE_SUPER, ROLE_SUPPORT]),
  adminController.ticketReply,
);

module.exports = router;
