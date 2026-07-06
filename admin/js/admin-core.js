// ==========================================
// ADMIN CORE - បេះដូងនៃប្រព័ន្ធ
// ==========================================

// ១. ការកំណត់ Global Variables
window.adminToken = sessionStorage.getItem("adminToken");
window.adminRole = sessionStorage.getItem("adminRole");
window.myAdminPermissions = null;
window.myChart = null;
window.globalUsersData = [];

// ឆែកមើល Auth
if (!window.adminToken || !window.adminRole) {
  window.location.href = "admin-login.html";
}

// មុខងារហៅ Token
window.getAuthHeaders = () => {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${window.adminToken}`,
  };
};

// ២. មុខងារ Sidebar និង ការប្តូរទំព័រ
window.toggleSidebar = function (force) {
  const sb = document.getElementById("sidebar");
  const ov = document.querySelector(".overlay");
  if (force !== undefined) {
    force ? sb.classList.add("active") : sb.classList.remove("active");
    force ? ov.classList.add("active") : ov.classList.remove("active");
  } else {
    sb.classList.toggle("active");
    ov.classList.toggle("active");
  }
};

window.showSection = function (id, btn) {
  sessionStorage.setItem("activeSection", id);

  const sections = [
    "dashboard",
    "users",
    "check-trx",
    "broadcast-history",
    "fx",
    "cards",
    "kyc",
    "tickets",
    "live-chat",
    "admins",
    "logs",
    "fees",
    "promo",
  ];
  sections.forEach((sec) => {
    const el = document.getElementById("sec-" + sec);
    if (el) el.style.display = "none";
  });

  const activeSec = document.getElementById("sec-" + id);
  if (activeSec) activeSec.style.display = "block";

  // Trigger functions អាស្រ័យលើទំព័រ
  if (id === "broadcast-history" && window.loadBroadcastHistory)
    window.loadBroadcastHistory();
  if (id === "fx" && window.fetchFXRates) window.fetchFXRates();
  if (id === "logs" && window.loadAdminLogs) window.loadAdminLogs();
  if (id === "promo" && window.loadPromoCodes) window.loadPromoCodes();
  if (id === "fees" && window.loadFeeSettings) window.loadFeeSettings();

  document
    .querySelectorAll(".menu-item")
    .forEach((m) => m.classList.remove("active"));
  if (btn) btn.classList.add("active");
};

window.logout = function () {
  sessionStorage.removeItem("adminToken");
  sessionStorage.removeItem("adminRole");
  window.location.href = "admin-login.html";
};

// ៣. ការគ្រប់គ្រង UI ទូទៅ (Modals)
window.closeModal = function (modalId) {
  const m = document.getElementById(modalId);
  if (m) m.style.setProperty("display", "none", "important");
};

// ៤. ទាញយក Permissions និងចាប់ផ្តើមប្រព័ន្ធ
window.applyDynamicPermissions = async function () {
  if (window.adminRole === "super_admin") {
    setInterval(window.loadData, 15000);
    if (window.loadData) window.loadData();
    return;
  }

  try {
    const res = await fetch("/api/admin/me", {
      headers: window.getAuthHeaders(),
    });
    const data = await res.json();
    if (data.success && data.admin && data.admin.permissions) {
      window.myAdminPermissions = data.admin.permissions;
      const menus = data.admin.permissions.menus;

      const hideIfFalse = (cond, id) => {
        if (!cond && document.getElementById(id))
          document.getElementById(id).style.display = "none";
      };

      hideIfFalse(menus.users, "menu-users");
      hideIfFalse(menus.checktrx, "menu-checktrx");
      hideIfFalse(menus.broadcast, "menu-broadcast");
      hideIfFalse(menus.fx, "menu-fx");
      hideIfFalse(menus.cards, "menu-cards");
      hideIfFalse(menus.kyc, "menu-kyc");
      hideIfFalse(menus.tickets, "menu-tickets");
      hideIfFalse(menus.chat, "menu-chat");

      hideIfFalse(menus.checktrx || menus.broadcast, "label-ops");
      hideIfFalse(menus.fx || menus.cards, "label-finance");
      hideIfFalse(menus.kyc || menus.tickets || menus.chat, "label-security");

      if (
        data.admin.role === "custom" &&
        data.admin.permissions.customRoleName
      ) {
        document.getElementById("adminRoleDisplay").innerText =
          data.admin.permissions.customRoleName.toUpperCase();
      }

      hideIfFalse(false, "menu-super-only");
      hideIfFalse(false, "menu-admins");
      hideIfFalse(false, "menu-logs");
      hideIfFalse(false, "menu-system");
    }
  } catch (err) {
    console.log("Error fetching permissions", err);
  }

  setInterval(window.loadData, 15000);
  if (window.loadData) window.loadData();
};

// Initialization ពេល Load លើកដំបូង
window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("adminNameDisplay").innerText =
    "U-PAY " + window.adminRole.split("_")[0].toUpperCase();
  document.getElementById("adminRoleDisplay").innerText =
    window.adminRole.replace("_", " ");

  const savedSection = sessionStorage.getItem("activeSection");
  if (savedSection) {
    const menuItems = document.querySelectorAll(".menu-item");
    let targetBtn = null;
    menuItems.forEach((item) => {
      if (
        item.getAttribute("onclick") &&
        item.getAttribute("onclick").includes(`'${savedSection}'`)
      )
        targetBtn = item;
    });
    window.showSection(savedSection, targetBtn);
  }

  window.applyDynamicPermissions();
});
