// js/admin-core.js

// ========================================================================
// ⚙️ SECTION 1: GLOBAL VARIABLES & AUTHENTICATION
// គ្រប់គ្រងអថេរសកល និងការផ្ទៀងផ្ទាត់សិទ្ធិចូលប្រព័ន្ធ
// ========================================================================
const adminToken = sessionStorage.getItem("adminToken");
const adminRole = sessionStorage.getItem("adminRole");
let myAdminPermissions = null;
let myChart = null;
let globalUsersData = [];

// ទាត់អ្នកប្រើប្រាស់ចេញ បើគ្មាន Token ត្រឹមត្រូវ
if (!adminToken || !adminRole) {
  window.location.href = "admin-login.html";
}

// មុខងារសម្រាប់ភ្ជាប់ Token ទៅរាល់ API Requests
const getAuthHeaders = () => {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${adminToken}`,
  };
};

// 🟢 បង្ហាញឈ្មោះ Admin និង Staff ID នៅលើ Sidebar Menu
const adminFullName =
  sessionStorage.getItem("adminFullName") ||
  "U-PAY " + (adminRole ? adminRole.split("_")[0].toUpperCase() : "ADMIN");
const adminStaffId = sessionStorage.getItem("adminStaffId") || "UPAY-SYSTEM";

document.getElementById("adminNameDisplay").innerText = adminFullName;
document.getElementById("adminRoleDisplay").innerText = "ID : " + adminStaffId;

// ========================================================================
// 🌙 SECTION 2: UI & THEME MANAGEMENT
// គ្រប់គ្រង Dark Mode / Light Mode និងការបិទបើក Sidebar
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
  if (force !== undefined) {
    force ? sb.classList.add("active") : sb.classList.remove("active");
    force ? ov.classList.add("active") : ov.classList.remove("active");
  } else {
    sb.classList.toggle("active");
    ov.classList.toggle("active");
  }
}

// ========================================================================
// 🧭 SECTION 3: MENU NAVIGATION & LOGOUT
// គ្រប់គ្រងការផ្លាស់ប្តូរទំព័រ (Tabs) និងការចាកចេញពីប្រព័ន្ធ
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
    "cashier",
    "system",
  ];

  // លាក់ទំព័រទាំងអស់ រួចបង្ហាញតែទំព័រដែលបានជ្រើសរើស
  sections.forEach((sec) => {
    const el = document.getElementById("sec-" + sec);
    if (el) el.style.display = "none";
  });
  const targetSec = document.getElementById("sec-" + id);
  if (targetSec) targetSec.style.display = "block";

  // ហៅទិន្នន័យជាក់លាក់ពេលចូលដល់ទំព័រនីមួយៗ
  if (id === "broadcast-history" && typeof loadBroadcastHistory === "function")
    loadBroadcastHistory();
  if (id === "fx" && typeof fetchFXRates === "function") fetchFXRates();
  if (id === "logs" && typeof loadAdminLogs === "function") loadAdminLogs();
  if (id === "promo" && typeof loadPromoCodes === "function") loadPromoCodes();
  // 🟢 ហៅមុខងារទាញយក Support Tickets ថ្មីពេលចុចបើកផ្ទាំង Tickets
  if (id === "tickets" && typeof fetchAllSupportTickets === "function")
    fetchAllSupportTickets(false);

  // ដូរពណ៌ប៊ូតុង Menu ឱ្យសកម្ម (Active State)
  document
    .querySelectorAll(".menu-item")
    .forEach((m) => m.classList.remove("active"));
  if (btn) btn.classList.add("active");
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
// 📊 SECTION 4: DASHBOARD CHART RENDERER
// គូរតារាងក្រាហ្វិក (Chart.js) សម្រាប់ប្រតិបត្តិការ ៧ ថ្ងៃចុងក្រោយ
// ========================================================================
let trxChartInstance = null;

function renderDashboardChart(usersData) {
  const canvas = document.getElementById("trxChart");
  if (!canvas) return;

  const last7DaysLabels = [];
  const dailyDataCounts = [0, 0, 0, 0, 0, 0, 0];

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    last7DaysLabels.push(d.toLocaleDateString());
  }

  let allTransactions = [];
  usersData.forEach((user) => {
    if (user.transactions && Array.isArray(user.transactions)) {
      allTransactions = allTransactions.concat(user.transactions);
    }
  });

  allTransactions.forEach((trx) => {
    const trxDateStr = trx.date || trx.createdAt;
    if (trxDateStr) {
      const justDate = new Date(trxDateStr).toLocaleDateString();
      const index = last7DaysLabels.indexOf(justDate);
      if (index !== -1) dailyDataCounts[index] += 1;
    }
  });

  if (trxChartInstance) {
    trxChartInstance.data.labels = last7DaysLabels;
    trxChartInstance.data.datasets[0].data = dailyDataCounts;
    trxChartInstance.update();
  } else {
    const ctx = canvas.getContext("2d");
    trxChartInstance = new Chart(ctx, {
      type: "line",
      data: {
        labels: last7DaysLabels,
        datasets: [
          {
            label: "Transaction Volume",
            data: dailyDataCounts,
            borderColor: "#10b981",
            backgroundColor: "rgba(16, 185, 129, 0.1)",
            borderWidth: 2,
            pointBackgroundColor: "#10b981",
            pointBorderColor: "#fff",
            pointRadius: 4,
            tension: 0.3,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
      },
    });
  }
}

// ========================================================================
// 🔄 SECTION 5: CORE DATA FETCHING (MASTER LOADER)
// ទាញយកទិន្នន័យសំខាន់ៗទាំងអស់ពី Server ម្តងរួមគ្នា (Users, Stats, Activities)
// ========================================================================
async function loadData() {
  try {
    // --------------------------------------------------
    // ៥.១ ទាញយកទិន្នន័យពី APIs (ប្រើ .catch ការពារកុំឱ្យគាំង Promise.all)
    // --------------------------------------------------
    const [userRes, chartRes, extraRes, cardsRes] = await Promise.all([
      fetch("/api/users", { headers: getAuthHeaders() }),
      fetch("/api/admin/stats", { headers: getAuthHeaders() }),
      fetch("/api/admin/dashboard-extra", { headers: getAuthHeaders() }),
      fetch("/api/admin/all-cards", { headers: getAuthHeaders() }).catch(
        () => null,
      ),
    ]);

    const users = await userRes.json();
    const chartData = await chartRes.json();
    const extraData = await extraRes.json();

    let allCardsList = [];
    if (cardsRes && cardsRes.ok) {
      const cardsData = await cardsRes.json();
      if (cardsData && Array.isArray(cardsData.cards)) {
        allCardsList = cardsData.cards;
      }
    }

    // 🟢 ភ្ជាប់កាតពីតារាង Card.js ចូលទៅក្នុង User ម្នាក់ៗវិញ (គាំទ្រទាំង username និង userId)
    users.forEach((u) => {
      const matchedCards = allCardsList.filter(
        (c) =>
          (c.username &&
            u.username &&
            c.username.toLowerCase() === u.username.toLowerCase()) ||
          (c.userId &&
            (String(c.userId) === String(u._id) ||
              String(c.userId) === String(u.id))),
      );
      if (matchedCards.length > 0) {
        u.virtualCards = matchedCards;
      } else if (!Array.isArray(u.virtualCards)) {
        u.virtualCards = [];
      }
    });

    globalUsersData = users;
    const clients = users.filter((u) => u.role !== "admin");

    if (typeof filterUsers === "function") {
      filterUsers();
    }

    renderDashboardChart(globalUsersData);

    // --------------------------------------------------
    // ៥.២ អថេរសម្រាប់គណនាស្ថិតិ (Statistics Initialization)
    // --------------------------------------------------
    let activeToday = 0,
      newUsers = 0,
      totalFunds = 0,
      totalFixedDeposits = 0;
    let totalTrxCount = 0,
      pendingCount = 0,
      totalWithdrawals = 0,
      totalTransfers = 0,
      frozenCount = 0;

    let allAdminNotifs = new Set();
    const todayStr = new Date().toISOString().split("T")[0];
    let allIssuedCards = [];

    // --------------------------------------------------
    // ៥.៣ ដំណើរការទិន្នន័យរបស់អតិថិជនម្នាក់ៗ (Data Processing Loop)
    // --------------------------------------------------
    clients.forEach((u) => {
      if (u.isOnline) activeToday++;
      if (u.joinDate && u.joinDate.split("T")[0] === todayStr) newUsers++;
      if (u.isFrozen) frozenCount++;

      const balUSD = u.mainAccounts?.USD?.balance || 0;
      const balKHRinUSD = (u.mainAccounts?.KHR?.balance || 0) / 4100;
      totalFunds += balUSD + balKHRinUSD;

      if (u.deposits && Array.isArray(u.deposits)) {
        u.deposits.forEach(
          (dep) => (totalFixedDeposits += Number(dep.amount || 0)),
        );
      }

      // គណនាស្ថិតិប្រតិបត្តិការ
      if (u.transactions && Array.isArray(u.transactions)) {
        totalTrxCount += u.transactions.length;
        u.transactions.forEach((trx) => {
          if (trx.status === "Pending") pendingCount++;
          if (
            trx.amount < 0 &&
            (trx.type === "Withdrawal" ||
              trx.type === "Transfer" ||
              trx.trxMethod === "U-PAY Transfer")
          ) {
            totalWithdrawals += Math.abs(Number(trx.amount || 0));
          }
          if (trx.type === "Transfer" || trx.trxMethod === "U-PAY Transfer")
            totalTransfers++;
        });
      }

      // ប្រមូលសារ Broadcast
      if (u.notifications && Array.isArray(u.notifications)) {
        u.notifications.forEach((n) => {
          if (n.sender === "admin")
            allAdminNotifs.add(n.id || n.title + n.date);
        });
      }

      // ប្រមូលកាតនិម្មិតទាំងអស់
      if (u.virtualCards && u.virtualCards.length > 0) {
        u.virtualCards.forEach((c) => {
          allIssuedCards.push({ user: u, card: c });
        });
      }
    });

    // --------------------------------------------------
    // ៥.៤ បញ្ជូនទិន្នន័យទៅឱ្យឯកសារខាងក្រៅគ្រប់គ្រង (Delegation)
    // --------------------------------------------------
    if (allIssuedCards.length === 0 && allCardsList.length > 0) {
      allCardsList.forEach((c) => {
        const owner = users.find((u) => u.username === c.username) || {
          username: c.username || "Unknown",
          fullName: c.username || "Unknown",
        };
        allIssuedCards.push({ user: owner, card: c });
      });
    }

    // បញ្ជូនទិន្នន័យកាតទៅឱ្យម៉ូឌុល Card Render
    window.globalCardsData = allIssuedCards;
    if (!window.currentCardPage) window.currentCardPage = 1;
    renderCardTablePage();

    // 🟢 បញ្ជូនការអាប់ដេតតារាង Support Tickets ទៅឱ្យម៉ូឌុលថ្មីក្នុង admin-tickets.js គ្រប់គ្រងវិញ
    if (typeof fetchAllSupportTickets === "function") {
      fetchAllSupportTickets(false);
    }

    // --------------------------------------------------
    // ៥.៥ បច្ចុប្បន្នភាព UI នៅលើអេក្រង់ (DOM Updates)
    // --------------------------------------------------
    document.getElementById("d-users").innerText = clients.length;
    document.getElementById("d-active").innerText = activeToday;
    document.getElementById("d-new-users").innerText = newUsers;
    document.getElementById("d-balance").innerText =
      "$" + totalFunds.toLocaleString("en-US", { minimumFractionDigits: 2 });
    document.getElementById("d-fixed-dep").innerText =
      "$" +
      totalFixedDeposits.toLocaleString("en-US", { minimumFractionDigits: 2 });
    document.getElementById("d-trx").innerText = totalTrxCount;
    document.getElementById("d-pending").innerText = pendingCount;
    document.getElementById("d-withdrawals").innerText =
      "$" +
      totalWithdrawals.toLocaleString("en-US", { minimumFractionDigits: 2 });
    document.getElementById("d-broadcasts").innerText = allAdminNotifs.size;
    document.getElementById("d-transfers").innerText = totalTransfers;
    document.getElementById("d-frozen").innerText = frozenCount;

    // Activity Feed (ចំណូលប្រព័ន្ធ និងសកម្មភាពថ្មីៗ)
    try {
      if (extraData.success || extraData.revenue !== undefined) {
        document.getElementById("d-revenue").innerText =
          "$" +
          (extraData.revenue || 0).toLocaleString("en-US", {
            minimumFractionDigits: 2,
          });
        const activityBox = document.getElementById("activity-feed");
        const currentDataStr = JSON.stringify(extraData.activities);

        if (activityBox.dataset.lastData !== currentDataStr) {
          activityBox.dataset.lastData = currentDataStr;
          if (!extraData.activities || extraData.activities.length === 0) {
            activityBox.innerHTML = `<div style="text-align:center; padding:20px 0; color:var(--text-muted);">No new activity yet.</div>`;
          } else {
            activityBox.innerHTML = extraData.activities
              .map((act) => {
                let icon = `<i class="fa-solid fa-bell"></i>`,
                  bg = "#f1f5f9",
                  col = "#64748b";
                if (
                  act.type.includes("Payment") ||
                  act.type.includes("Income")
                ) {
                  icon =
                    act.amount < 0
                      ? `<i class="fa-solid fa-arrow-up"></i>`
                      : `<i class="fa-solid fa-arrow-down"></i>`;
                  bg = act.amount < 0 ? "#fee2e2" : "#d1fae5";
                  col = act.amount < 0 ? "#dc2626" : "#059669";
                } else if (act.type === "Card Created") {
                  icon = `<i class="fa-regular fa-credit-card"></i>`;
                  bg = "#fef3c7";
                  col = "#d97706";
                }
                return `<div class="activity-item"><div class="act-icon" style="background:${bg}; color:${col};">${icon}</div><div class="act-text"><h5>${act.user} <span style="font-weight:400; color:#64748b;">- ${act.type}</span></h5><p>${act.date}</p></div></div>`;
              })
              .join("");
          }
        }
      }
    } catch (err) {}
  } catch (e) {
    console.error("Dashboard Load Data Error:", e);
  }
}
// ========================================================================
// 🔐 SECTION 7: DYNAMIC MENU PERMISSION ENFORCER
// ចាក់សោរ និងលាក់ម៉ឺនុយទៅតាមតួនាទី (Roles & Permissions) របស់បុគ្គលិក
// ========================================================================
async function applyDynamicPermissions() {
  try {
    const res = await fetch("/api/admin/me", { headers: getAuthHeaders() });
    const data = await res.json();

    if (data.success && data.admin && data.admin.permissions) {
      window.myAdminPermissions = data.admin.permissions;

      if (
        data.admin.role === "custom" &&
        data.admin.permissions.customRoleName
      ) {
        document.getElementById("adminRoleDisplay").innerText =
          data.admin.permissions.customRoleName.toUpperCase();
      }

      // 🔴 លាក់ម៉ឺនុយដោយប្រើប្រព័ន្ធ CSS (Injection)
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
          cssRules += "#menu-promo, #menu-fees { display: none !important; }\n";
        if (!menus.cards)
          cssRules += "#menu-cards { display: none !important; }\n";
        if (!menus.broadcast)
          cssRules += "#menu-broadcast { display: none !important; }\n";
        if (!menus.kyc) cssRules += "#menu-kyc { display: none !important; }\n";
        if (!menus.tickets)
          cssRules += "#menu-tickets { display: none !important; }\n";
        if (!menus.chat)
          cssRules += "#menu-chat { display: none !important; }\n";

        cssRules +=
          "#menu-super-only, #menu-admins, #menu-system, #menu-logs { display: none !important; }\n";

        let style = document.createElement("style");
        style.innerHTML = cssRules;
        document.head.appendChild(style);

        setTimeout(() => {
          const checkGroupLabel = (labelId, menuIds) => {
            const label = document.getElementById(labelId);
            if (!label) return;
            const hasVisibleChild = menuIds.some((id) => {
              const el = document.getElementById(id);
              return el && window.getComputedStyle(el).display !== "none";
            });
            label.style.display = hasVisibleChild ? "" : "none";
          };
          checkGroupLabel("label-main", [
            "menu-dashboard",
            "menu-users",
            "menu-merchants",
          ]);
          checkGroupLabel("label-ops", [
            "menu-customer-360",
            "menu-cashier",
            "menu-checktrx",
            "menu-broadcast",
          ]);
          checkGroupLabel("label-finance", [
            "menu-fx",
            "menu-fees",
            "menu-promo",
            "menu-cards",
          ]);
          checkGroupLabel("label-security", [
            "menu-kyc",
            "menu-tickets",
            "menu-chat",
          ]);
        }, 100);
      }
    }
  } catch (err) {
    console.error("Error fetching permissions:", err);
  }

  // ចាប់ផ្តើមទាញយកទិន្នន័យរៀងរាល់ ១៥វិនាទី
  setInterval(loadData, 15000);
  loadData();
}

async function toggleSystemFreeze() {
  try {
    const res = await fetch("/api/admin/system-status", {
      headers: getAuthHeaders(),
    });
    const sys = await res.json();
    const isCurrentlyFrozen = sys.isSystemFrozen;
    Swal.fire({
      title: isCurrentlyFrozen
        ? "បើកដំណើរការប្រព័ន្ធវិញ?"
        : "ផ្អាកប្រព័ន្ធទាំងមូល?",
      html: isCurrentlyFrozen
        ? "អតិថិជននឹងអាចធ្វើប្រតិបត្តិការវេរលុយ/ដកលុយបានធម្មតាវិញ។"
        : "អតិថិជនទាំងអស់នឹង <b>មិនអាច</b> ធ្វើប្រតិបត្តិការហិរញ្ញវត្ថុបានទេរហូតដល់អ្នកបើកវាវិញ!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: isCurrentlyFrozen ? "#10b981" : "#ef4444",
      cancelButtonColor: "#64748b",
      confirmButtonText: isCurrentlyFrozen ? "បាទ, បើកវិញ 🟢" : "បាទ, ផ្អាក 🛑",
      cancelButtonText: "បោះបង់",
    }).then(async (result) => {
      if (result.isConfirmed) {
        const toggleRes = await fetch("/api/admin/toggle-system", {
          method: "POST",
          headers: getAuthHeaders(),
        });
        const toggleData = await toggleRes.json();
        if (toggleData.success) {
          Swal.fire({
            title: toggleData.isSystemFrozen
              ? "ប្រព័ន្ធត្រូវបានផ្អាក! 🛑"
              : "ប្រព័ន្ធដំណើរការធម្មតា! 🟢",
            text: toggleData.isSystemFrozen
              ? "រាល់ប្រតិបត្តិការត្រូវបាន Block ទាំងស្រុង។"
              : "អតិថិជនអាចប្រើប្រាស់បានវិញហើយ។",
            icon: "success",
            background: "#1e293b",
            color: "white",
          });
        }
      }
    });
  } catch (e) {}
}

// ========================================================================
// 🔔 SECTION 8: NOTIFICATIONS & SOUND ALERTS POLLING
// ប្រព័ន្ធផ្តល់សញ្ញាដំណឹង និងសំឡេងរោទ៍ពេលមាន Ticket, Chat, ឬ KYC ថ្មីៗ
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
      fetch("/api/chat/contacts", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ myAcc: "ADMIN" }),
      }),
      fetch("/api/users", { headers: getAuthHeaders() }),
    ]);

    const chatData = await chatRes.json();
    const userData = await userRes.json();

    if (chatData.success && Array.isArray(userData)) {
      let currentTotalUnread = 0,
        currentQueueLength = chatData.contacts.length;
      let currentPendingKyc = 0,
        currentOpenTickets = 0;

      chatData.contacts.forEach((c) => {
        currentTotalUnread += c.unreadCount;
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
        let shouldRefreshTable = false;
        if (currentQueueLength > previousQueueLength)
          playCustomNotif(
            "អតិថិជនថ្មី សុំជួបភ្នាក់ងារ! 👨‍💻",
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
          shouldRefreshTable = true;
        }
        if (currentOpenTickets > previousOpenTickets) {
          playCustomNotif(
            "មានសំបុត្រជំនួយ (Ticket) ថ្មី! 🎫",
            ticketSound,
            "#f59e0b",
          );
          shouldRefreshTable = true;
        }
        if (shouldRefreshTable && typeof loadData === "function") loadData();
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

// ឆែកមើលសារថ្មីៗរៀងរាល់ ៣ វិនាទី
setInterval(checkAdminNotifications, 3000);

// ========================================================================
// 🎬 SECTION 9: SYSTEM INITIALIZATION & EVENT LISTENERS
// ដំណើរការកូដជាមូលដ្ឋាននៅពេលវេបសាយដើរចប់ (On Load)
// ========================================================================
window.addEventListener("DOMContentLoaded", () => {
  const savedSection = sessionStorage.getItem("activeSection");
  if (savedSection) {
    const menuItems = document.querySelectorAll(".menu-item");
    let targetBtn = null;
    menuItems.forEach((item) => {
      if (
        item.getAttribute("onclick") &&
        item.getAttribute("onclick").includes(`'${savedSection}'`)
      ) {
        targetBtn = item;
      }
    });
    showSection(savedSection, targetBtn);
  }

  const searchInput = document.getElementById("searchTrxId");
  if (searchInput) {
    searchInput.addEventListener("keypress", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        if (typeof searchTrx === "function") searchTrx();
      }
    });
  }

  // ហៅមុខងារអានសិទ្ធិពេល Load ទំព័រ
  applyDynamicPermissions();
});

// ========================================================================
// 🔍 មុខងារស្វែងរកស្តង់ដារ (Universal Search Helper)
// ========================================================================
window.standardDataSearch = function (dataArray, keyword, searchFields) {
  if (!keyword || keyword.trim() === "") return dataArray;

  const lowerKeyword = keyword.toLowerCase().trim();

  return dataArray.filter((item) => {
    return searchFields.some((field) => {
      const value = field
        .split(".")
        .reduce((obj, key) => (obj ? obj[key] : null), item);
      return value && String(value).toLowerCase().includes(lowerKeyword);
    });
  });
};
