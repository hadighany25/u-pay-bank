// ========================================================================
// ឯកសារ: js/admin-core.js (Pro Modular Core + Smart Resizable Sidebar Engine)
// អត្ថន័យ: បង្កើត Sidebar ស្វ័យប្រវត្តិ, អូសពង្រីក/បង្រួមទទឹង, បិទ/បើកម៉ឺនុយ & គ្រប់គ្រងសិទ្ធិ
// ========================================================================

const adminToken = sessionStorage.getItem("adminToken");
const adminRole = sessionStorage.getItem("adminRole");
let myAdminPermissions = null;

// 🟢 ប្រើ var និងភ្ជាប់ទៅ window ដើម្បីឱ្យគ្រប់ឯកសារ JS ទាំងអស់ចាប់ទិន្នន័យអតិថិជនឃើញ ១០០%
var globalUsersData = [];
window.globalUsersData = globalUsersData;

if (!adminToken || !adminRole) {
  window.location.href = "admin-login.html";
}

const getAuthHeaders = () => {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${adminToken}`,
  };
};

// ========================================================================
// 🗂️ SECTION 1: SMART SIDEBAR GENERATOR & DRAG-TO-RESIZE ENGINE
// រៀបចំលំដាប់ក្រុមម៉ឺនុយស្តង់ដារធនាគារ និងកាត់បន្ថយកូដក្នុង index.html
// ========================================================================
const ADMIN_SIDEBAR_SCHEMA = [
  {
    groupId: "label-main",
    groupTitle: "ម៉ឺនុយគោល (MAIN MENU)",
    i18nKey: "menu-main",
    items: [
      {
        id: "menu-dashboard",
        sec: "dashboard",
        icon: "fa-chart-pie",
        label: "ផ្ទាំងគ្រប់គ្រង (Dashboard)",
        i18n: "menu-dash",
      },
      {
        id: "menu-users",
        sec: "users",
        icon: "fa-users",
        label: "គ្រប់គ្រងអតិថិជន (Users)",
        i18n: "menu-users",
      },
      {
        id: "menu-customer-360",
        sec: "customer-360",
        icon: "fa-users-viewfinder",
        label: "អតិថិជន 360° (Customer 360°)",
        i18n: "menu-customer-360",
      },
      {
        id: "menu-merchants",
        sec: "merchants",
        icon: "fa-store",
        label: "ដៃគូហាងទំនិញ (Merchants)",
        i18n: "menu-merchants",
      },
    ],
  },
  {
    groupId: "label-ops",
    groupTitle: "ប្រតិបត្តិការធនាគារ (OPERATIONS)",
    i18nKey: "menu-ops",
    items: [
      {
        id: "menu-cashier",
        sec: "cashier",
        icon: "fa-cash-register",
        label: "បេឡាករ (Cashier Desk)",
        i18n: "menu-cashier",
      },
      {
        id: "menu-checktrx",
        sec: "check-trx",
        icon: "fa-magnifying-glass-dollar",
        label: "ឆែកប្រតិបត្តិការ (Trx Check)",
        i18n: "menu-checktrx",
      },
      {
        id: "menu-cards",
        sec: "cards",
        icon: "fa-credit-card",
        label: "គ្រប់គ្រងកាត (Cards Hub)",
        i18n: "menu-cards",
      },
    ],
  },
  {
    groupId: "label-finance",
    groupTitle: "ហិរញ្ញវត្ថុ & ទីផ្សារ (TREASURY & PROMO)",
    i18nKey: "menu-finance",
    items: [
      {
        id: "menu-fx",
        sec: "fx",
        icon: "fa-money-bill-trend-up",
        label: "អត្រាប្តូរប្រាក់ (FX Rates)",
        i18n: "menu-fx",
      },
      {
        id: "menu-fees",
        sec: "fees",
        icon: "fa-percent",
        label: "កម្រៃសេវា & Limit (Fees)",
        i18n: "menu-fees",
      },
      {
        id: "menu-promo",
        sec: "promo",
        icon: "fa-ticket",
        label: "កូដប្រូម៉ូសិន (Promo Codes)",
        i18n: "menu-promo",
      },
      {
        id: "menu-broadcast",
        sec: "broadcast-history",
        icon: "fa-tower-broadcast",
        label: "សារជូនដំណឹង (Broadcast)",
        i18n: "menu-broadcast",
      },
    ],
  },
  {
    groupId: "label-security",
    groupTitle: "អត្តសញ្ញាណ & ជំនួយ (KYC & SUPPORT)",
    i18nKey: "menu-security",
    items: [
      {
        id: "menu-kyc",
        sec: "kyc",
        icon: "fa-id-card-clip",
        label: "អនុម័ត KYC (KYC Approvals)",
        i18n: "menu-kyc",
      },
      {
        id: "menu-tickets",
        sec: "tickets",
        icon: "fa-headset",
        label: "សំណូមពរអតិថិជន (Tickets)",
        i18n: "menu-tickets",
      },
      {
        id: "menu-chat",
        sec: "live-chat",
        icon: "fa-comments",
        label: "ជជែកផ្ទាល់ (Live Chat)",
        i18n: "menu-chat",
      },
    ],
  },
  {
    groupId: "menu-super-only",
    groupTitle: "រដ្ឋបាលជាន់ខ្ពស់ (SUPER ADMIN)",
    i18nKey: "menu-super",
    items: [
      {
        id: "menu-admins",
        sec: "admins",
        icon: "fa-user-shield",
        label: "គ្រប់គ្រងបុគ្គលិក (Staff IAM)",
        i18n: "menu-admins",
      },
      {
        id: "menu-logs",
        sec: "logs",
        icon: "fa-list-check",
        label: "កំណត់ហេតុប្រព័ន្ធ (Audit Logs)",
        i18n: "menu-logs",
      },
      {
        id: "menu-system",
        sec: "system",
        icon: "fa-power-off",
        iconColor: "#ef4444",
        label: "បិទ/បើកប្រព័ន្ធ (System)",
        i18n: "menu-system",
      },
    ],
  },
];

function buildSmartSidebar() {
  const sb = document.getElementById("sidebar");
  if (!sb) return;

  const adminFullName =
    sessionStorage.getItem("adminFullName") ||
    "U-PAY " + (adminRole ? adminRole.split("_")[0].toUpperCase() : "ADMIN");
  const adminStaffId = sessionStorage.getItem("adminStaffId") || "UPAY-SYSTEM";

  const groupsHtml = ADMIN_SIDEBAR_SCHEMA.map((grp) => {
    const itemsHtml = grp.items
      .map((item) => {
        const clickHandler =
          item.sec === "__SYSTEM_FREEZE__"
            ? "toggleSystemFreeze()"
            : `showSection('${item.sec}', this); toggleSidebar(false);`;
        const iconStyle = item.iconColor
          ? `style="color:${item.iconColor}"`
          : "";

        return `
          <div class="menu-item" id="${item.id}" onclick="${clickHandler}" title="${item.label}">
            <i class="fa-solid ${item.icon}" ${iconStyle}></i>
            <span class="sb-menu-text" data-i18n="${item.i18n}">${item.label}</span>
          </div>
        `;
      })
      .join("");

    return `
      <div class="sb-group-block" id="block-${grp.groupId}">
        <div class="menu-label" id="${grp.groupId}" onclick="toggleSidebarGroup('${grp.groupId}')">
          <span data-i18n="${grp.i18nKey}">${grp.groupTitle}</span>
          <i class="fa-solid fa-chevron-down" id="chev-${grp.groupId}" style="font-size:0.65rem; transition:transform 0.2s;"></i>
        </div>
        <div class="menu-group-items" id="items-${grp.groupId}">
          ${itemsHtml}
        </div>
      </div>
    `;
  }).join("");

  sb.innerHTML = `
    <!-- របារចាប់ទាញពង្រីក/បង្រួមទទឹង Sidebar -->
    <div class="sb-resizer-handle" id="sbResizerHandle" title="ចុចឱ្យជាប់រួចអូសឆ្វេង/ស្តាំដើម្បីសេរ៉េទទឹងម៉ឺនុយ (Double-click ដើម្បីកំណត់ទំហំដើម)"></div>

    <!-- ប្រអប់ព័ត៌មាន និងរូបថត Profile បុគ្គលិក Admin -->
    <div class="sb-profile-box">
      <div class="sb-avatar-circle" id="sbAdminAvatarBox">
        <i class="fa-solid fa-user-shield"></i>
      </div>
      <div class="sb-profile-meta">
        <div id="adminNameDisplay" style="font-weight: 800; font-size: 0.96rem; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          ${adminFullName}
        </div>
        <div id="adminRoleDisplay" style="font-size: 0.72rem; color: #34d399; font-family: 'JetBrains Mono', monospace; font-weight: 700; margin-top: 3px;">
          ID : ${adminStaffId}
        </div>
      </div>
    </div>

    <!-- ប្រអប់ស្វែងរកម៉ឺនុយរហ័ស -->
    <div class="sb-quick-filter-wrap">
      <i class="fa-solid fa-magnifying-glass"></i>
      <input type="text" id="sbMenuQuickSearch" class="sb-quick-filter-input" placeholder="ស្វែងរកម៉ឺនុយរហ័ស..." oninput="filterSidebarMenuItems(this.value)" />
    </div>

    <!-- បញ្ជីម៉ឺនុយតាមក្រុម -->
    <div style="flex: 1; overflow-y: auto; overflow-x: hidden; padding-right: 2px;">
      ${groupsHtml}
    </div>

    <!-- ប៊ូតុងចាកចេញពីប្រព័ន្ធ -->
    <div class="menu-item logout-btn" onclick="logout()" style="margin-top: 12px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 14px;" title="ចាកចេញពីប្រព័ន្ធ (Secure Logout)">
      <i class="fa-solid fa-right-from-bracket"></i>
      <span class="sb-menu-text" data-i18n="menu-logout">ចាកចេញពីប្រព័ន្ធ (Logout)</span>
    </div>
  `;

  initSidebarResizeAndCollapseState();
}

window.toggleSidebarGroup = function (groupId) {
  const itemsBox = document.getElementById(`items-${groupId}`);
  const chev = document.getElementById(`chev-${groupId}`);
  if (!itemsBox) return;
  const isCollapsed = itemsBox.classList.toggle("group-collapsed");
  if (chev) {
    chev.style.transform = isCollapsed ? "rotate(-90deg)" : "rotate(0deg)";
  }
};

window.filterSidebarMenuItems = function (keyword) {
  const kw = String(keyword || "")
    .toLowerCase()
    .trim();
  document
    .querySelectorAll("#sidebar .menu-item:not(.logout-btn)")
    .forEach((el) => {
      const text = el.innerText.toLowerCase();
      el.style.display = !kw || text.includes(kw) ? "" : "none";
    });
};

// 🖱️ មុខងារចាប់ទាញពង្រីក/បង្រួមទទឹង Sidebar និងប៊ូតុងបង្រួម/លាក់ម៉ឺនុយ
function initSidebarResizeAndCollapseState() {
  const savedWidth = parseInt(localStorage.getItem("adminSidebarWidth"), 10);
  if (savedWidth && savedWidth >= 190 && savedWidth <= 440) {
    document.documentElement.style.setProperty("--sb-width", savedWidth + "px");
  }

  const savedCollapsed =
    localStorage.getItem("adminSidebarCollapsed") === "true";
  if (savedCollapsed && window.innerWidth > 768) {
    document.body.classList.add("sb-collapsed");
    updateCollapseButtonUI();
  }

  const handle = document.getElementById("sbResizerHandle");
  if (!handle) return;

  let isDragging = false;

  handle.addEventListener("mousedown", (e) => {
    if (window.innerWidth <= 768) return;
    isDragging = true;
    document.body.classList.add("sb-resizing");
    e.preventDefault();
  });

  window.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    const newWidth = e.clientX;

    if (newWidth < 130) {
      document.body.classList.add("sb-collapsed");
      localStorage.setItem("adminSidebarCollapsed", "true");
      updateCollapseButtonUI();
    } else if (newWidth >= 190 && newWidth <= 440) {
      document.body.classList.remove("sb-collapsed", "sb-hidden");
      localStorage.setItem("adminSidebarCollapsed", "false");
      document.documentElement.style.setProperty("--sb-width", newWidth + "px");
      localStorage.setItem("adminSidebarWidth", String(newWidth));
      updateCollapseButtonUI();
    }
  });

  window.addEventListener("mouseup", () => {
    if (isDragging) {
      isDragging = false;
      document.body.classList.remove("sb-resizing");
    }
  });

  handle.addEventListener("dblclick", () => {
    document.body.classList.remove("sb-collapsed", "sb-hidden");
    document.documentElement.style.setProperty("--sb-width", "275px");
    localStorage.setItem("adminSidebarWidth", "275");
    localStorage.setItem("adminSidebarCollapsed", "false");
    updateCollapseButtonUI();
  });
}

window.toggleDesktopSidebarCollapse = function () {
  if (window.innerWidth <= 768) {
    toggleSidebar();
    return;
  }
  document.body.classList.remove("sb-hidden");
  const isNowCollapsed = document.body.classList.toggle("sb-collapsed");
  localStorage.setItem("adminSidebarCollapsed", String(isNowCollapsed));
  updateCollapseButtonUI();
};

window.toggleFullHideSidebar = function () {
  if (window.innerWidth <= 768) {
    toggleSidebar();
    return;
  }
  const isHidden = document.body.classList.toggle("sb-hidden");
  const icon = document.getElementById("sbFullScreenIcon");
  if (icon) {
    icon.className = isHidden ? "fa-solid fa-compress" : "fa-solid fa-expand";
  }
  updateCollapseButtonUI();
};

function updateCollapseButtonUI() {
  const txt = document.getElementById("sbCollapseText");
  const icon = document.getElementById("sbCollapseIcon");
  const isCollapsed = document.body.classList.contains("sb-collapsed");
  const isHidden = document.body.classList.contains("sb-hidden");

  if (txt) {
    txt.innerText = isHidden || isCollapsed ? "លាតម៉ឺនុយ" : "បង្រួមម៉ឺនុយ";
  }
  if (icon) {
    icon.className =
      isHidden || isCollapsed
        ? "fa-solid fa-indent"
        : "fa-solid fa-bars-staggered";
  }
}

document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
    e.preventDefault();
    toggleDesktopSidebarCollapse();
  }
});

// ========================================================================
// 🌙 SECTION 2: UI & THEME MANAGEMENT
// ========================================================================
let isDarkMode = localStorage.getItem("adminDarkMode") === "true";

function toggleTheme() {
  isDarkMode = !isDarkMode;
  localStorage.setItem("adminDarkMode", isDarkMode);
  applyTheme();
}

function applyTheme() {
  const body = document.body;
  if (isDarkMode) {
    body.classList.add("dark-mode");
    document.querySelectorAll(".theme-icon").forEach((icon) => {
      icon.className = "fa-solid fa-sun theme-icon";
      icon.style.color = "#f59e0b";
    });
  } else {
    body.classList.remove("dark-mode");
    document.querySelectorAll(".theme-icon").forEach((icon) => {
      icon.className = "fa-solid fa-moon theme-icon";
      icon.style.color = "#64748b";
    });
  }
}

function toggleSidebar(force) {
  const sb = document.getElementById("sidebar");
  const ov = document.querySelector(".overlay");
  if (!sb || !ov) return;
  if (force !== undefined) {
    force ? sb.classList.add("active") : sb.classList.remove("active");
    force ? ov.classList.add("active") : ov.classList.remove("active");
  } else {
    sb.classList.toggle("active");
    ov.classList.toggle("active");
  }
}

// ========================================================================
// 🧭 SECTION 3: MODULAR MENU NAVIGATION
// ========================================================================
function showSection(id, btn) {
  sessionStorage.setItem("activeSection", id);
  const sections = [
    "dashboard",
    "users",
    "merchants",
    "customer-360",
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
    "merchant-history",
    "merchant-credentials",
    "cashier",
    "system",
  ];

  sections.forEach((sec) => {
    const el = document.getElementById("sec-" + sec);
    if (el) el.style.display = "none";
  });
  const targetSec = document.getElementById("sec-" + id);
  if (targetSec) targetSec.style.display = "block";

  if (id === "dashboard" && typeof refreshAdminDashboard === "function") {
    refreshAdminDashboard(false);
  } else if (
    (id === "users" || id === "kyc") &&
    typeof loadUsersModuleData === "function"
  ) {
    loadUsersModuleData();
  } else if (id === "merchants" && typeof loadMerchantsData === "function") {
    loadMerchantsData();
  } else if (id === "cards" && typeof loadCardsModuleData === "function") {
    loadCardsModuleData();
  } else if (
    id === "broadcast-history" &&
    typeof loadBroadcastHistory === "function"
  ) {
    loadBroadcastHistory();
  } else if (id === "fx" && typeof fetchFXRates === "function") {
    fetchFXRates();
  } else if (id === "logs" && typeof loadAdminLogs === "function") {
    loadAdminLogs();
  } else if (id === "promo" && typeof loadPromoCodes === "function") {
    loadPromoCodes();
  } else if (id === "tickets" && typeof fetchAllSupportTickets === "function") {
    fetchAllSupportTickets(false);
  } else if (id === "admins" && typeof loadAdminList === "function") {
    loadAdminList(false);
  } else if (id === "system" && typeof loadSystemControlHub === "function") {
    loadSystemControlHub(false);
  }

  document
    .querySelectorAll(".menu-item")
    .forEach((m) => m.classList.remove("active"));
  if (btn) {
    btn.classList.add("active");
  } else {
    const matchedBtn = document.querySelector(`.menu-item[onclick*="'${id}'"]`);
    if (matchedBtn) matchedBtn.classList.add("active");
  }
}

function logout() {
  Swal.fire({
    title: "ចាកចេញពីប្រព័ន្ធ?",
    text: "តើអ្នកពិតជាចង់ចាកចេញពីគណនីនេះមែនទេ?",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#ef4444",
    cancelButtonColor: "#94a3b8",
    confirmButtonText:
      '<i class="fa-solid fa-right-from-bracket"></i> បាទ, ចាកចេញ',
    cancelButtonText: "បោះបង់",
    customClass: { popup: "premium-swal" },
  }).then((result) => {
    if (result.isConfirmed) {
      sessionStorage.removeItem("adminToken");
      sessionStorage.removeItem("adminRole");
      window.location.href = "admin-login.html";
    }
  });
}

// ========================================================================
// 🔄 SECTION 4: LIGHTWEIGHT SHARED LOADERS (Fixed Global & Window Sync 100%)
// ========================================================================
async function loadUsersModuleData() {
  try {
    const res = await fetch("/api/users", { headers: getAuthHeaders() });
    const raw = await res.json();
    const users = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.users)
        ? raw.users
        : [];

    globalUsersData = users;
    window.globalUsersData = users;

    if (typeof filterUsers === "function") {
      filterUsers();
    }
    if (typeof filterKycTable === "function") {
      filterKycTable();
    }
  } catch (e) {
    console.error("Load Users Module Data Error:", e);
  }
}

async function loadCardsModuleData() {
  try {
    const [userRes, cardsRes] = await Promise.all([
      fetch("/api/users", { headers: getAuthHeaders() }),
      fetch("/api/admin/all-cards", { headers: getAuthHeaders() }).catch(
        () => null,
      ),
    ]);
    const rawUsers = await userRes.json();
    const users = Array.isArray(rawUsers)
      ? rawUsers
      : Array.isArray(rawUsers?.users)
        ? rawUsers.users
        : [];

    let allCardsList = [];
    if (cardsRes && cardsRes.ok) {
      const cData = await cardsRes.json();
      if (cData && Array.isArray(cData.cards)) allCardsList = cData.cards;
    }

    globalUsersData = users;
    window.globalUsersData = users;

    const allIssuedCards = [];
    allCardsList.forEach((c) => {
      const owner = users.find((u) => u.username === c.username) || {
        username: c.username || "Unknown",
        fullName: c.username || "Unknown",
      };
      allIssuedCards.push({ user: owner, card: c });
    });
    window.globalCardsData = allIssuedCards;
    if (typeof renderCardTablePage === "function") renderCardTablePage();
  } catch (e) {}
}

async function loadData() {
  const activeSec = sessionStorage.getItem("activeSection") || "dashboard";
  if (
    activeSec === "dashboard" &&
    typeof refreshAdminDashboard === "function"
  ) {
    refreshAdminDashboard(false);
  }
  await loadUsersModuleData();
}

// ========================================================================
// 🔐 SECTION 5: DYNAMIC MENU PERMISSION ENFORCER & PROFILE PHOTO LOADER
// ========================================================================
async function applyDynamicPermissions() {
  try {
    const res = await fetch("/api/admin/me", { headers: getAuthHeaders() });
    const data = await res.json();

    if (data.success && data.admin) {
      if (data.admin.username) {
        sessionStorage.setItem("adminUsername", data.admin.username);
      }

      const nameDisp = document.getElementById("adminNameDisplay");
      const roleDisp = document.getElementById("adminRoleDisplay");
      const avatarBox = document.getElementById("sbAdminAvatarBox");

      if (nameDisp && data.admin.fullName) {
        nameDisp.innerText = data.admin.fullName;
      }
      if (roleDisp && data.admin.staffId) {
        roleDisp.innerText = "ID : " + data.admin.staffId;
      }
      if (
        avatarBox &&
        data.admin.profileImage &&
        String(data.admin.profileImage).trim() !== ""
      ) {
        avatarBox.innerHTML = `<img src="${data.admin.profileImage}" onerror="this.outerHTML='<i class=\\'fa-solid fa-user-shield\\'></i>'">`;
      }

      if (data.admin.permissions) {
        window.myAdminPermissions = data.admin.permissions;

        if (
          data.admin.role === "custom" &&
          data.admin.permissions.customRoleName &&
          roleDisp
        ) {
          roleDisp.innerText =
            data.admin.permissions.customRoleName.toUpperCase();
        }

        if (adminRole !== "super_admin") {
          const menus = data.admin.permissions.menus || {};
          let cssRules = "";

          if (!menus.users)
            cssRules +=
              "#menu-users, #menu-customer-360 { display: none !important; }\n";
          if (!menus.merchant)
            cssRules += "#menu-merchants { display: none !important; }\n";
          if (!menus.cashier)
            cssRules += "#menu-cashier { display: none !important; }\n";
          if (!menus.checktrx)
            cssRules += "#menu-checktrx { display: none !important; }\n";
          if (!menus.fx) cssRules += "#menu-fx { display: none !important; }\n";
          if (!menus.promos)
            cssRules +=
              "#menu-promo, #menu-fees { display: none !important; }\n";
          if (!menus.cards)
            cssRules += "#menu-cards { display: none !important; }\n";
          if (!menus.broadcast)
            cssRules += "#menu-broadcast { display: none !important; }\n";
          if (!menus.kyc)
            cssRules += "#menu-kyc { display: none !important; }\n";
          if (!menus.tickets)
            cssRules += "#menu-tickets { display: none !important; }\n";
          if (!menus.chat)
            cssRules += "#menu-chat { display: none !important; }\n";

          cssRules +=
            "#block-menu-super-only, #menu-super-only, #menu-admins, #menu-system, #menu-logs { display: none !important; }\n";

          let style = document.createElement("style");
          style.innerHTML = cssRules;
          document.head.appendChild(style);
        }
      }
    }
  } catch (err) {
    console.error("Error fetching permissions:", err);
  }

  await loadUsersModuleData();
}

// ========================================================================
// 🔔 SECTION 6: NOTIFICATIONS & SOUND ALERTS POLLING
// ========================================================================
let previousTotalUnread = 0,
  previousQueueLength = 0;
let previousPendingKyc = 0,
  previousOpenTickets = 0;
let isFirstLoadNotif = true;

const chatSound = new Audio(
  "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3",
);
const kycSound = new Audio(
  "https://assets.mixkit.co/active_storage/sfx/2870/2870-preview.mp3",
);
const ticketSound = new Audio(
  "https://assets.mixkit.co/active_storage/sfx/2870/2870-preview.mp3",
);

async function checkAdminNotifications() {
  try {
    const [chatRes, userRes] = await Promise.all([
      fetch("/api/admin/chat/queue", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ includeBotOnly: false }),
      }),
      fetch("/api/users", { headers: getAuthHeaders() }),
    ]);

    const chatData = await chatRes.json();
    const rawUser = await userRes.json();
    const userData = Array.isArray(rawUser) ? rawUser : rawUser?.users || [];

    if (chatData.success && Array.isArray(userData)) {
      globalUsersData = userData;
      window.globalUsersData = userData;

      const escalatedList = (chatData.contacts || []).filter(
        (c) => c.needsSupport,
      );
      let currentTotalUnread = 0,
        currentQueueLength = escalatedList.length;
      let currentPendingKyc = 0,
        currentOpenTickets = 0;

      escalatedList.forEach((c) => {
        currentTotalUnread += c.unreadCount || 0;
      });
      userData.forEach((u) => {
        if (u.kycStatus === "pending") currentPendingKyc++;
        if (u.tickets && Array.isArray(u.tickets)) {
          u.tickets.forEach((t) => {
            if (t.status === "Open" || t.status === "Pending")
              currentOpenTickets++;
          });
        }
      });

      if (!isFirstLoadNotif) {
        let shouldRefresh = false;
        if (currentQueueLength > previousQueueLength)
          playCustomNotif(
            "អតិថិជនថ្មី សុំជួបភ្នាក់ងារផ្ទាល់! 👨‍💻",
            chatSound,
            "#0ea5e9",
          );
        else if (currentTotalUnread > previousTotalUnread)
          playCustomNotif("មានសារថ្មីពីអតិថិជន! 💬", chatSound, "#0ea5e9");

        if (currentPendingKyc > previousPendingKyc) {
          playCustomNotif(
            "មានសំណើផ្ទៀងផ្ទាត់ KYC ថ្មី! 🪪",
            kycSound,
            "#8b5cf6",
          );
          shouldRefresh = true;
        }
        if (currentOpenTickets > previousOpenTickets) {
          playCustomNotif(
            "មានសំបុត្រជំនួយ (Ticket) ថ្មី! 🎫",
            ticketSound,
            "#f59e0b",
          );
          shouldRefresh = true;
        }
        if (shouldRefresh) loadData();
      }

      previousQueueLength = currentQueueLength;
      previousTotalUnread = currentTotalUnread;
      previousPendingKyc = currentPendingKyc;
      previousOpenTickets = currentOpenTickets;
      isFirstLoadNotif = false;
    }
  } catch (e) {}
}

function playCustomNotif(message, soundObj, iconColorHex) {
  soundObj.play().catch(() => {});
  Swal.fire({
    toast: true,
    position: "top-end",
    icon: "info",
    title: message,
    showConfirmButton: false,
    timer: 4500,
    background: "#1e293b",
    color: "white",
    iconColor: iconColorHex,
    customClass: { popup: "premium-swal" },
  });
}

setInterval(checkAdminNotifications, 6000);

// ========================================================================
// 🎬 SECTION 7: SYSTEM INITIALIZATION & UNIVERSAL SEARCH
// ========================================================================
window.addEventListener("DOMContentLoaded", () => {
  buildSmartSidebar();
  applyTheme();

  const savedSection = sessionStorage.getItem("activeSection") || "dashboard";
  showSection(savedSection);

  const searchInput = document.getElementById("searchTrxId");
  if (searchInput) {
    searchInput.addEventListener("keypress", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        if (typeof searchTrx === "function") searchTrx();
      }
    });
  }

  applyDynamicPermissions();
});

window.standardDataSearch = function (dataArray, keyword, searchFields) {
  if (!keyword || keyword.trim() === "") return dataArray;
  const lowerKeyword = keyword.toLowerCase().trim();
  return (dataArray || []).filter((item) => {
    return searchFields.some((field) => {
      const value = field
        .split(".")
        .reduce((obj, key) => (obj ? obj[key] : null), item);
      return value && String(value).toLowerCase().includes(lowerKeyword);
    });
  });
};
