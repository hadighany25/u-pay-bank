// js/admin-core.js

// ========================================================================
// ⚙️ SECTION 1: GLOBAL VARIABLES & AUTHENTICATION
// ========================================================================
const adminToken = sessionStorage.getItem("adminToken");
const adminRole = sessionStorage.getItem("adminRole");
let myAdminPermissions = null;
let myChart = null;
let globalUsersData = [];

if (!adminToken || !adminRole) {
  window.location.href = "admin-login.html";
}

const getAuthHeaders = () => {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${adminToken}`,
  };
};

// 🟢 យកទិន្នន័យ Profile មកបង្ហាញលើ Sidebar ឱ្យចេញជា "FULL NAME" និង "ID : UPAY-xxxxxx"
const adminFullName =
  sessionStorage.getItem("adminFullName") ||
  "U-PAY " + (adminRole ? adminRole.split("_")[0].toUpperCase() : "ADMIN");
const adminStaffId = sessionStorage.getItem("adminStaffId") || "UPAY-SYSTEM";

document.getElementById("adminNameDisplay").innerText = adminFullName;
document.getElementById("adminRoleDisplay").innerText = "ID : " + adminStaffId;

// ========================================================================
// 🌙 SECTION 2: UI & THEME MANAGEMENT (DARK / LIGHT MODE)
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

document.addEventListener("DOMContentLoaded", () => {
  applyTheme();
});

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

  sections.forEach((sec) => {
    const el = document.getElementById("sec-" + sec);
    if (el) el.style.display = "none";
  });
  document.getElementById("sec-" + id).style.display = "block";

  if (id === "broadcast-history" && typeof loadBroadcastHistory === "function")
    loadBroadcastHistory();
  if (id === "fx" && typeof fetchFXRates === "function") fetchFXRates();
  if (id === "logs" && typeof loadAdminLogs === "function") loadAdminLogs();
  if (id === "promo" && typeof loadPromoCodes === "function") loadPromoCodes();

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
      window.location.href = window.location.origin + "/admin-login.html";
    }
  });
}

// ========================================================================
// 📊 SECTION 4: DASHBOARD CHART RENDERER
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
      if (index !== -1) {
        dailyDataCounts[index] += 1;
      }
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
// 🔄 SECTION 5: CORE DATA FETCHING (Load Data)
// ========================================================================
async function loadData() {
  try {
    const [userRes, chartRes, extraRes] = await Promise.all([
      fetch("/api/users", { headers: getAuthHeaders() }),
      fetch("/api/admin/stats", { headers: getAuthHeaders() }),
      fetch("/api/admin/dashboard-extra", { headers: getAuthHeaders() }),
    ]);

    const users = await userRes.json();
    const chartData = await chartRes.json();
    const extraData = await extraRes.json();

    globalUsersData = users;
    const clients = users.filter((u) => u.role !== "admin");

    if (typeof renderUsersTable === "function")
      renderUsersTable(globalUsersData);
    renderDashboardChart(globalUsersData);

    let kycHtml = "";
    let ticketsHtml = "";

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

    clients.forEach((u) => {
      if (u.isOnline) activeToday++;
      if (u.joinDate && u.joinDate.split("T")[0] === todayStr) newUsers++;
      if (u.isFrozen) frozenCount++;
      totalFunds += Number(u.balance) || 0;

      if (u.deposits && Array.isArray(u.deposits))
        u.deposits.forEach(
          (dep) => (totalFixedDeposits += Number(dep.amount || 0)),
        );

      if (u.transactions && Array.isArray(u.transactions)) {
        totalTrxCount += u.transactions.length;
        u.transactions.forEach((trx) => {
          if (trx.status === "Pending") pendingCount++;
          if (
            trx.amount < 0 &&
            (trx.type === "Withdrawal" ||
              trx.type === "Transfer" ||
              trx.trxMethod === "U-PAY Transfer")
          )
            totalWithdrawals += Math.abs(Number(trx.amount || 0));
          if (trx.type === "Transfer" || trx.trxMethod === "U-PAY Transfer")
            totalTransfers++;
        });
      }

      if (u.notifications && Array.isArray(u.notifications))
        u.notifications.forEach((n) => {
          if (n.sender === "admin")
            allAdminNotifs.add(n.id || n.title + n.date);
        });

      if (u.virtualCards && u.virtualCards.length > 0) {
        u.virtualCards.forEach((c) => {
          allIssuedCards.push({ user: u, card: c });
        });
      }

      // KYC
      if (u.kycStatus === "pending") {
        kycHtml += `<tr><td><div style="font-weight:600;">${u.fullName || u.username}</div><div style="font-size:0.8rem; color:var(--text-muted);">Account: ${u.accountNumber}</div></td><td>Identity Document</td><td>${u.kycSubmittedAt || "Recent"}</td><td><span style="background:#fef3c7; color:#d97706; padding:3px 10px; border-radius:12px; font-size:0.8rem; font-weight:bold;">PENDING</span></td><td style="text-align: right;"><button class="btn-action" style="background:#10b981;" onclick="kycAction('${u.username}', 'approved')" title="Approve"><i class="fa-solid fa-check"></i></button><button class="btn-action" style="background:#ef4444;" onclick="kycAction('${u.username}', 'rejected')" title="Reject"><i class="fa-solid fa-xmark"></i></button><button class="btn-action" style="background:var(--primary);" onclick="viewKycDocument('${u.kycDocument}')" title="View Docs"><i class="fa-solid fa-eye"></i></button></td></tr>`;
      }

      // Support Tickets
      if (u.tickets) {
        u.tickets.forEach((t) => {
          const statusColor =
            t.status === "Open"
              ? "color:#d97706; background:#fef3c7;"
              : "color:#10b981; background:#dcfce7;";
          ticketsHtml += `<tr><td style="font-family:monospace; font-weight:bold;">${t.ticketId}</td><td><div style="font-weight:600;">${u.username}</div></td><td>${t.subject}</td><td style="text-align: center;"><button class="btn-action" style="background:#f1f5f9; color:#64748b; border:1px solid #e2e8f0;" onclick="viewUserMessage('${u.username}', '${t.ticketId}')" title="View Message"><i class="fa-solid fa-eye"></i></button></td><td><span style="color:${t.priority === "High" ? "#ef4444" : "#64748b"}; font-weight:bold;"><i class="fa-solid fa-circle-exclamation"></i> ${t.priority}</span></td><td><span style="padding:3px 10px; border-radius:12px; font-size:0.8rem; font-weight:bold; ${statusColor}">${t.status}</span></td><td style="text-align: right;">${t.status === "Open" ? `<button class="btn-primary" style="padding: 6px 12px; font-size: 0.85rem;" onclick="replyTicket('${u.username}', '${t.ticketId}')">Reply</button>` : `<span style="color:var(--text-muted); font-size:0.8rem;">Answered</span>`}</td></tr>`;
        });
      }
    });

    window.globalCardsData = allIssuedCards;
    if (!window.currentCardPage) window.currentCardPage = 1;
    renderCardTablePage();

    document.getElementById("kycTableBody").innerHTML =
      kycHtml ||
      '<tr><td colspan="5" style="text-align:center; padding: 20px;">No pending KYC requests.</td></tr>';
    document.getElementById("ticketTableBody").innerHTML =
      ticketsHtml ||
      '<tr><td colspan="6" style="text-align:center; padding: 20px;">No support tickets found.</td></tr>';

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

    // Activity Feed
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
  } catch (e) {}
}

// ========================================================================
// 💳 SECTION 6: CARD PAGINATION RENDERER (៨កាត/ទំព័រ)
// ========================================================================
const CARDS_PER_PAGE = 8;

function renderCardTablePage() {
  const tbody = document.getElementById("cardTableBody");
  const searchBox = document.getElementById("searchCardBox");
  const isSearching = searchBox && searchBox.value.trim().length > 0;

  const cardsList = window.globalCardsData || [];

  if (cardsList.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="5" style="text-align:center; padding: 20px;">No issued cards found.</td></tr>';
    const pg = document.getElementById("cardPaginationFooter");
    if (pg) pg.style.display = "none";
    return;
  }

  let pageItems = cardsList;
  let totalPages = 1;

  if (!isSearching) {
    totalPages = Math.ceil(cardsList.length / CARDS_PER_PAGE);
    if (window.currentCardPage > totalPages)
      window.currentCardPage = totalPages;
    if (window.currentCardPage < 1) window.currentCardPage = 1;

    const startIndex = (window.currentCardPage - 1) * CARDS_PER_PAGE;
    const endIndex = startIndex + CARDS_PER_PAGE;
    pageItems = cardsList.slice(startIndex, endIndex);
  }

  let cardsHtml = "";
  pageItems.forEach((item) => {
    const u = item.user;
    const c = item.card;

    const statusHtml = c.isLocked
      ? `<span style="background:#fee2e2; color:#ef4444; padding:3px 10px; border-radius:12px; font-size:0.8rem; font-weight:bold;">BLOCKED</span>`
      : `<span style="background:#dcfce7; color:#10b981; padding:3px 10px; border-radius:12px; font-size:0.8rem; font-weight:bold;">ACTIVE</span>`;
    const freezeBtn = c.isLocked
      ? `<button class="btn-action" style="background:#10b981;" onclick="toggleCardLock('${u.username}', '${c.id}', true)" title="Unblock"><i class="fa-solid fa-unlock"></i></button>`
      : `<button class="btn-action" style="background:#f59e0b;" onclick="toggleCardLock('${u.username}', '${c.id}', false)" title="Freeze"><i class="fa-solid fa-snowflake"></i></button>`;

    let nfcBtn = "";
    let cardType = c.name || `Virtual ${c.type || "Standard"}`;
    let nfcIconTitle = "";

    if (c.uid || c.isPhysical) {
      nfcBtn = `<button class="btn-action" style="background:#ef4444; margin-left:5px;" onclick="event.stopPropagation(); unbindNFC('${u.username}', '${c.id}')" title="ផ្តាច់កាត NFC"><i class="fa-solid fa-trash"></i></button>`;
      cardType = `<span style="color:var(--text-main); font-weight:bold;">Physical NFC</span> <br><span style="font-size:0.7rem; color:var(--text-muted);">${cardType}</span>`;
      nfcIconTitle = `<i class="fa-solid fa-wifi" style="color:#3b82f6; margin-left:5px; cursor:pointer;" onclick="event.stopPropagation(); Swal.fire({title: 'NFC UID របស់កាតនេះ', html: '<b style=\\'font-size: 1.2rem; color: #3b82f6; font-family: monospace;\\'>${c.uid || "N/A"}</b>', icon: 'info', customClass: { popup: 'premium-swal' }})" title="NFC UID: ${c.uid || "N/A"}"></i>`;
    } else {
      nfcBtn = `<button class="btn-action" style="background:#0f172a; margin-left:5px;" onclick="event.stopPropagation(); quickBindNFC('${u.username}', '${c.id}')" title="ភ្ជាប់កាត NFC"><i class="fa-solid fa-wifi"></i></button>`;
    }

    const cardNumSlice = c.number ? c.number.slice(-4) : "XXXX";

    let allUserAccounts = [u.accountNumber || "", u.accountNumberKHR || ""];
    if (u.subAccounts && Array.isArray(u.subAccounts)) {
      u.subAccounts.forEach((sub) => allUserAccounts.push(sub.accountNumber));
    }
    let searchKeywords =
      `${c.cvv || ""} ${u.phone || ""} ${c.number || ""} ${u.username || ""} ${u.fullName || ""} ${c.linkedAccount || ""} ${allUserAccounts.join(" ")}`.toLowerCase();

    cardsHtml += `<tr data-search="${searchKeywords}">
        <td><div style="font-weight:600; color:var(--text-main);">${u.fullName || u.username} ${nfcIconTitle}</div></td>
        <td style="font-family:monospace; font-size:1rem; color:var(--accent);">**** **** **** ${cardNumSlice}</td>
        <td>${cardType}</td>
        <td>${statusHtml}</td>
        <td style="text-align: right; white-space: nowrap;">${freezeBtn}${nfcBtn}</td>
      </tr>`;
  });

  tbody.innerHTML = cardsHtml;

  let paginationContainer = document.getElementById("cardPaginationFooter");
  if (!paginationContainer) {
    paginationContainer = document.createElement("div");
    paginationContainer.id = "cardPaginationFooter";
    paginationContainer.style.cssText =
      "display: flex; justify-content: space-between; align-items: center; margin-top: 15px; padding: 10px 0;";
    tbody.closest(".table-container").after(paginationContainer);
  }

  if (isSearching || cardsList.length <= CARDS_PER_PAGE) {
    paginationContainer.style.display = "none";
  } else {
    paginationContainer.style.display = "flex";
    paginationContainer.innerHTML = `
        <button onclick="changeCardPage(-1)" ${window.currentCardPage === 1 ? "disabled" : ""} style="height: 40px; padding: 0 20px; background: #f1f5f9; color: #64748b; border: 1px solid #cbd5e1; border-radius: 8px; cursor: pointer; font-weight: bold;">
          <i class="fa-solid fa-chevron-left"></i> ថយក្រោយ
        </button>
        <span style="font-weight: bold; color: var(--text-main);">ទំព័រទី ${window.currentCardPage} / ${totalPages}</span>
        <button onclick="changeCardPage(1)" ${window.currentCardPage >= totalPages ? "disabled" : ""} style="height: 40px; padding: 0 20px; background: #0f172a; color: #fff; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">
          បន្ទាប់ <i class="fa-solid fa-chevron-right"></i>
        </button>
      `;
  }
}

function changeCardPage(step) {
  const cardsList = window.globalCardsData || [];
  const totalPages = Math.ceil(cardsList.length / CARDS_PER_PAGE);
  window.currentCardPage += step;
  if (window.currentCardPage < 1) window.currentCardPage = 1;
  if (window.currentCardPage > totalPages) window.currentCardPage = totalPages;
  renderCardTablePage();
}

// ========================================================================
// 🔐 SECTION 7: DYNAMIC MENU PERMISSION ENFORCER (CSS Injection)
// ========================================================================
async function applyDynamicPermissions() {
  try {
    const res = await fetch("/api/admin/me", { headers: getAuthHeaders() });
    const data = await res.json();

    if (data.success && data.admin && data.admin.permissions) {
      window.myAdminPermissions = data.admin.permissions;

      // បង្ហាញឈ្មោះ Custom Role លើ Header
      if (
        data.admin.role === "custom" &&
        data.admin.permissions.customRoleName
      ) {
        document.getElementById("adminRoleDisplay").innerText =
          data.admin.permissions.customRoleName.toUpperCase();
      }

      // 🔴 ប្រព័ន្ធលាក់ម៉ឺនុយដ៏រឹងមាំ (បាញ់ CSS)
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

        // លាក់ម៉ឺនុយ Super Admin ជានិច្ច
        cssRules +=
          "#menu-super-only, #menu-admins, #menu-system, #menu-logs { display: none !important; }\n";

        let style = document.createElement("style");
        style.innerHTML = cssRules;
        document.head.appendChild(style);

        // លាក់ Title Group បើកូនៗវាបាត់អស់
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
        if (toggleData.success)
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
    });
  } catch (e) {}
}

// ========================================================================
// 🔔 SECTION 8: NOTIFICATIONS & SOUND ALERTS POLLING
// ========================================================================
let previousTotalUnread = 0,
  previousQueueLength = 0,
  previousPendingKyc = 0,
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
        currentQueueLength = chatData.contacts.length,
        currentPendingKyc = 0,
        currentOpenTickets = 0;

      chatData.contacts.forEach((c) => {
        currentTotalUnread += c.unreadCount;
      });
      userData.forEach((u) => {
        if (u.kycStatus === "pending") currentPendingKyc++;
        if (u.tickets && Array.isArray(u.tickets))
          u.tickets.forEach((t) => {
            if (t.status === "Open") currentOpenTickets++;
          });
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

setInterval(checkAdminNotifications, 3000);

// ========================================================================
// 🎬 SECTION 9: EVENT LISTENERS
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
      )
        targetBtn = item;
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
