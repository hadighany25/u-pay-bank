// Global Variables (អាចប្រើបានគ្រប់ File)
const adminToken = sessionStorage.getItem("adminToken");
const adminRole = sessionStorage.getItem("adminRole");
let myAdminPermissions = null;
let myChart = null;
let globalUsersData = [];

// Auth Check
if (!adminToken || !adminRole) {
  window.location.href = "admin-login.html";
}

const getAuthHeaders = () => {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${adminToken}`,
  };
};

document.getElementById("adminNameDisplay").innerText =
  "U-PAY " + adminRole.split("_")[0].toUpperCase();
document.getElementById("adminRoleDisplay").innerText = adminRole.replace(
  "_",
  " ",
);

// ==========================================
// DARK MODE / LIGHT MODE TOGGLE
// ==========================================
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
    // ដូរ Icon គ្រប់ប៊ូតុង Theme ទាំងអស់ទៅជាព្រះអាទិត្យ (ពេលកំពុងងងឹត)
    document.querySelectorAll(".theme-icon").forEach((icon) => {
      icon.className = "fa-solid fa-sun theme-icon";
      icon.style.color = "#f59e0b"; // ពណ៍លឿង
    });
  } else {
    body.classList.remove("dark-mode");
    // ដូរ Icon ទៅជាព្រះចន្ទ (ពេលកំពុងភ្លឺ)
    document.querySelectorAll(".theme-icon").forEach((icon) => {
      icon.className = "fa-solid fa-moon theme-icon";
      icon.style.color = "#64748b"; // ពណ៍ប្រផេះ
    });
  }
}

// ដំណើរការវាពេលទំព័រដើរភ្លាម
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
      // 1. លុបទិន្នន័យ (Token) ចេញពី Browser
      sessionStorage.removeItem("adminToken");
      sessionStorage.removeItem("adminRole");

      // 2. លោតទៅកាន់ទំព័រ Login វិញ
      // (ការប្រើសញ្ញា / ពីមុខ គឺបញ្ជាឱ្យវាលោតទៅកាន់ Root នៃ Domain តែម្តង ដែលស្មើនឹង https://u-pay-bank.fly.dev/admin-login.html)
      window.location.href = "/admin-login.html";
    }
  });
}

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

    let cardsHtml = "";
    let kycHtml = "";
    let ticketsHtml = "";
    let activeToday = 0,
      newUsers = 0,
      totalFunds = 0,
      totalFixedDeposits = 0;
    let totalTrxCount = 0,
      pendingCount = 0,
      totalWithdrawals = 0;
    let totalTransfers = 0,
      frozenCount = 0;
    let allAdminNotifs = new Set();
    const todayStr = new Date().toISOString().split("T")[0];

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

      if (u.virtualCards) {
        u.virtualCards.forEach((c) => {
          const statusHtml = c.isLocked
            ? `<span style="background:#fee2e2; color:#ef4444; padding:3px 10px; border-radius:12px; font-size:0.8rem; font-weight:bold;">BLOCKED</span>`
            : `<span style="background:#dcfce7; color:#10b981; padding:3px 10px; border-radius:12px; font-size:0.8rem; font-weight:bold;">ACTIVE</span>`;
          const btnHtml = c.isLocked
            ? `<button class="btn-action" style="background:#10b981;" onclick="toggleCardLock('${u.username}', '${c.id}', true)" title="Unblock"><i class="fa-solid fa-unlock"></i></button>`
            : `<button class="btn-action" style="background:#f59e0b;" onclick="toggleCardLock('${u.username}', '${c.id}', false)" title="Freeze"><i class="fa-solid fa-snowflake"></i></button>`;
          const cardNumSlice = c.number ? c.number.slice(-4) : "XXXX";
          cardsHtml += `<tr><td><div style="font-weight:600;">${u.fullName || u.username}</div></td><td style="font-family:monospace; font-size:1rem; color:var(--accent);">**** **** **** ${cardNumSlice}</td><td>Virtual ${c.type || "Card"}</td><td>${statusHtml}</td><td style="text-align: right;">${btnHtml}</td></tr>`;
        });
      }

      if (u.kycStatus === "pending") {
        kycHtml += `<tr><td><div style="font-weight:600;">${u.fullName || u.username}</div><div style="font-size:0.8rem; color:var(--text-muted);">Account: ${u.accountNumber}</div></td><td>Identity Document</td><td>${u.kycSubmittedAt || "Recent"}</td><td><span style="background:#fef3c7; color:#d97706; padding:3px 10px; border-radius:12px; font-size:0.8rem; font-weight:bold;">PENDING</span></td><td style="text-align: right;"><button class="btn-action" style="background:#10b981;" onclick="kycAction('${u.username}', 'approved')" title="Approve"><i class="fa-solid fa-check"></i></button><button class="btn-action" style="background:#ef4444;" onclick="kycAction('${u.username}', 'rejected')" title="Reject"><i class="fa-solid fa-xmark"></i></button><button class="btn-action" style="background:var(--primary);" onclick="viewKycDocument('${u.kycDocument}')" title="View Docs"><i class="fa-solid fa-eye"></i></button></td></tr>`;
      }

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

    document.getElementById("cardTableBody").innerHTML =
      cardsHtml ||
      '<tr><td colspan="5" style="text-align:center; padding: 20px;">No issued cards found.</td></tr>';
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

    try {
      const ctx = document.getElementById("trxChart").getContext("2d");
      let gradient = ctx.createLinearGradient(0, 0, 0, 350);
      gradient.addColorStop(0, "rgba(16, 185, 129, 0.4)");
      gradient.addColorStop(1, "rgba(16, 185, 129, 0.0)");
      if (myChart) {
        myChart.data.labels = chartData.labels;
        myChart.data.datasets[0].data = chartData.data;
        myChart.update();
      } else {
        myChart = new Chart(ctx, {
          type: "line",
          data: {
            labels: chartData.labels,
            datasets: [
              {
                label: "Volume ($)",
                data: chartData.data,
                borderColor: "#10b981",
                backgroundColor: gradient,
                borderWidth: 3,
                pointBackgroundColor: "#ffffff",
                pointBorderColor: "#10b981",
                pointRadius: 4,
                fill: true,
                tension: 0.4,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { grid: { display: false } },
              y: { border: { display: false } },
            },
          },
        });
      }
    } catch (err) {}

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

async function applyDynamicPermissions() {
  if (adminRole === "super_admin") {
    setInterval(loadData, 15000);
    loadData();
    return;
  }
  try {
    const res = await fetch("/api/admin/me", { headers: getAuthHeaders() });
    const data = await res.json();
    if (data.success && data.admin && data.admin.permissions) {
      myAdminPermissions = data.admin.permissions;
      const menus = data.admin.permissions.menus;

      if (!menus.users)
        document.getElementById("menu-users").style.display = "none";
      if (!menus.checktrx)
        document.getElementById("menu-checktrx").style.display = "none";
      if (!menus.broadcast)
        document.getElementById("menu-broadcast").style.display = "none";
      if (!menus.fx) document.getElementById("menu-fx").style.display = "none";
      if (!menus.cards)
        document.getElementById("menu-cards").style.display = "none";
      if (!menus.kyc)
        document.getElementById("menu-kyc").style.display = "none";
      if (!menus.tickets)
        document.getElementById("menu-tickets").style.display = "none";
      if (!menus.chat)
        document.getElementById("menu-chat").style.display = "none";

      if (!menus.checktrx && !menus.broadcast)
        document.getElementById("label-ops").style.display = "none";
      if (!menus.fx && !menus.cards)
        document.getElementById("label-finance").style.display = "none";
      if (!menus.kyc && !menus.tickets && !menus.chat)
        document.getElementById("label-security").style.display = "none";

      if (
        data.admin.role === "custom" &&
        data.admin.permissions.customRoleName
      ) {
        document.getElementById("adminRoleDisplay").innerText =
          data.admin.permissions.customRoleName.toUpperCase();
      }

      document.getElementById("menu-super-only").style.display = "none";
      document.getElementById("menu-admins").style.display = "none";
      document.getElementById("menu-logs").style.display = "none";
      document.getElementById("menu-system").style.display = "none";
    }
  } catch (err) {}
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
  if (searchInput)
    searchInput.addEventListener("keypress", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        if (typeof searchTrx === "function") searchTrx();
      }
    });

  applyDynamicPermissions();
});

// Notifications Polling (Core Logic)
let previousTotalUnread = 0;
let previousQueueLength = 0;
let previousPendingKyc = 0;
let previousOpenTickets = 0;
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
  if (!window.location.href.includes("admin.html")) return;
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
      let currentTotalUnread = 0;
      let currentQueueLength = chatData.contacts.length;
      let currentPendingKyc = 0;
      let currentOpenTickets = 0;

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
