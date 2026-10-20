// ============================================================================
// ឯកសារ: js/admin-logs.js (100% Pro Redesign - Enterprise Security & Audit Center)
// អត្ថន័យ: តាមដានសកម្មភាពបុគ្គលិក (Audit Logs), ញែកប្រភេទហានិភ័យ, Export CSV និង Pagination
// ស្តង់ដារថ្មី: ចាប់គោលដៅអតិថិជនតាម MongoDB `_id` សុទ្ធសាធ + បង្ហាញឈ្មោះពេញ (fullName)
// ============================================================================

// ============================================================================
// 🛡️ ជំពូកទី ១៖ អថេរសកល, ម៉ាស៊ីនចាត់ថ្នាក់ហានិភ័យ និងការស្វែងរកតាម `_id` (STATE & CLASSIFIER)
// ============================================================================
let allAuditLogs = [];
let filteredAuditLogs = [];
let currentLogPage = 1;
const LOGS_PER_PAGE = 6; // បង្ហាញ ៦ កំណត់ត្រាក្នុង ១ ទំព័រ
let alogsCurrentCategory = "ALL"; // 'ALL', 'TODAY', 'FINANCE', 'USER_KYC', 'CRITICAL', 'SYSTEM'

/**
 * 🔹 ១.១ ចំណាត់ថ្នាក់ប្រភេទសកម្មភាព កម្រិតហានិភ័យ និងពណ៌ផ្លាក (Action Classifier)
 */
function classifyAuditAction(actionStr = "", detailsStr = "") {
  const act = String(actionStr || "").toLowerCase();
  const det = String(detailsStr || "").toLowerCase();

  // ១.១.១ សកម្មភាពហានិភ័យខ្ពស់ (Critical / Delete / Freeze / Reject / Revoke / Force Logout / Refund)
  if (
    act.includes("delete") ||
    act.includes("reject") ||
    act.includes("revoke") ||
    act.includes("freeze") ||
    act.includes("force logout") ||
    act.includes("unbind") ||
    act.includes("refund") ||
    det.includes("frozen") ||
    det.includes("purged")
  ) {
    let icon = "fa-triangle-exclamation";
    if (act.includes("delete") || det.includes("purged")) icon = "fa-trash-can";
    else if (act.includes("freeze") || det.includes("frozen"))
      icon = "fa-snowflake";
    else if (act.includes("reject") || act.includes("revoke")) icon = "fa-ban";
    else if (act.includes("refund")) icon = "fa-rotate-left";

    return {
      category: "CRITICAL",
      badgeClass: "alogs-badge-danger",
      icon,
      severityLabel: "ហានិភ័យខ្ពស់ (Critical)",
      severityColor: "#ef4444",
    };
  }

  // ១.១.២ សកម្មភាពហិរញ្ញវត្ថុ កាត និងបញ្ជរគិតប្រាក់ (Finance, Cards, Cashier, Merchant)
  if (
    act.includes("money") ||
    act.includes("balance") ||
    act.includes("transaction") ||
    act.includes("cashier") ||
    act.includes("card") ||
    act.includes("fx") ||
    act.includes("fee") ||
    act.includes("hold") ||
    act.includes("merchant")
  ) {
    let icon = "fa-coins";
    if (act.includes("card")) icon = "fa-credit-card";
    else if (act.includes("merchant")) icon = "fa-store";
    else if (act.includes("cashier")) icon = "fa-cash-register";

    return {
      category: "FINANCE",
      badgeClass: "alogs-badge-finance",
      icon,
      severityLabel: "ហិរញ្ញវត្ថុ & សេវាកម្ម (Finance)",
      severityColor: "#3b82f6",
    };
  }

  // ១.១.៣ សកម្មភាពបង្កើតថ្មី ឬអនុម័ត (Create / Approve / Upload KYC)
  if (
    act.includes("approve") ||
    act.includes("create") ||
    act.includes("bind") ||
    act.includes("upload kyc")
  ) {
    return {
      category: "USER_KYC",
      badgeClass: "alogs-badge-create",
      icon: "fa-circle-check",
      severityLabel: "អនុម័ត / បង្កើតថ្មី (Approved)",
      severityColor: "#10b981",
    };
  }

  // ១.១.៤ សកម្មភាពកែប្រែអតិថិជន ឬ KYC (Edit User / Reset / Limit / Withdraw)
  if (
    act.includes("user") ||
    act.includes("kyc") ||
    act.includes("account") ||
    act.includes("reset") ||
    act.includes("edit") ||
    act.includes("update") ||
    act.includes("rename") ||
    act.includes("withdraw")
  ) {
    return {
      category: "USER_KYC",
      badgeClass: "alogs-badge-update",
      icon: "fa-pen-to-square",
      severityLabel: "កែប្រែព័ត៌មាន (Modified)",
      severityColor: "#f59e0b",
    };
  }

  // ១.១.៥ សកម្មភាពប្រព័ន្ធ បុគ្គលិក Admin និងសារជូនដំណឹង (System / Admin / Broadcast / Ticket)
  return {
    category: "SYSTEM",
    badgeClass: "alogs-badge-system",
    icon: "fa-gears",
    severityLabel: "ប្រព័ន្ធ & រដ្ឋបាល (System)",
    severityColor: "#8b5cf6",
  };
}

/**
 * 🔹 ១.២ ឆែកថាតើកាលបរិច្ឆេទ Log ស្ថិតក្នុងថ្ងៃនេះឬអត់
 */
function isLogFromToday(dateStr = "") {
  if (!dateStr) return false;
  try {
    const today = new Date();
    const m = today.getMonth() + 1;
    const d = today.getDate();
    const y = today.getFullYear();

    const str = String(dateStr);
    const usFormat = `${m}/${d}/${y}`;
    const isoFormat = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    return str.includes(usFormat) || str.includes(isoFormat);
  } catch (e) {
    return false;
  }
}

/**
 * 🔹 ១.៣ ស្វែងរកអតិថិជនគោលដៅ (Target User) តាមរយៈ MongoDB `_id` ដើម្បីបង្ហាញឈ្មោះពេញ (`fullName`)
 */
function resolveAuditTargetUser(targetStr = "") {
  const clean = String(targetStr || "")
    .replace(/^@/, "")
    .trim();
  if (!clean || clean === "-" || clean === "System") return null;

  const list = Array.isArray(window.globalUsersData)
    ? window.globalUsersData
    : [];

  // អាទិភាពទី ១៖ ចាប់តាម MongoDB `_id`
  let found = list.find((u) => String(u._id || u.id) === clean);
  if (found) return found;

  // Fallback សម្រាប់ទិន្នន័យ Log ចាស់ៗដែលធ្លាប់កត់ត្រាជា username
  return (
    list.find(
      (u) => String(u.username || "").toLowerCase() === clean.toLowerCase(),
    ) || null
  );
}

// ============================================================================
// 🔄 ជំពូកទី ២៖ ការទាញយកទិន្នន័យកំណត់ហេតុ និងគណនាស្ថិតិ KPI (LOAD DATA & KPI STATS)
// ============================================================================

/**
 * 🔹 ២.១ ទាញយកកំណត់ត្រាសកម្មភាពទាំងអស់ពី Server (`/api/admin/logs`)
 */
async function loadAdminLogs(showToast = false) {
  if (typeof adminRole !== "undefined" && adminRole !== "super_admin") return;

  const spinIcon = document.getElementById("alogs-refresh-icon");
  if (spinIcon) spinIcon.classList.add("fa-spin");

  try {
    const res = await fetch("/api/admin/logs", { headers: getAuthHeaders() });
    const data = await res.json();

    if (data.success && Array.isArray(data.logs)) {
      allAuditLogs = data.logs;
    } else {
      allAuditLogs = [];
    }

    updateAuditLogKpis();
    applyLogFilters();

    if (showToast) {
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "ទាញយកកំណត់ត្រាថ្មីៗជោគជ័យ!",
        showConfirmButton: false,
        timer: 1300,
        customClass: { popup: "kh-text" },
      });
    }
  } catch (e) {
    console.error("Error loading logs:", e);
  } finally {
    if (spinIcon) spinIcon.classList.remove("fa-spin");
  }
}

/**
 * 🔹 ២.២ គណនា និងបង្ហាញតួលេខ KPI ទាំង ៥ ខាងលើតារាង
 */
function updateAuditLogKpis() {
  let todayCount = 0;
  let financeCount = 0;
  let userKycCount = 0;
  let criticalCount = 0;

  allAuditLogs.forEach((log) => {
    if (isLogFromToday(log.date)) todayCount++;

    const info = classifyAuditAction(log.action, log.details);
    if (info.category === "CRITICAL") criticalCount++;
    if (
      info.category === "FINANCE" ||
      String(log.action).toLowerCase().includes("refund")
    ) {
      financeCount++;
    }
    if (
      info.category === "USER_KYC" ||
      String(log.action).toLowerCase().includes("kyc") ||
      String(log.action).toLowerCase().includes("user")
    ) {
      userKycCount++;
    }
  });

  const setTxt = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.innerText = val;
  };
  setTxt("alogs-stat-total", allAuditLogs.length);
  setTxt("alogs-stat-today", todayCount);
  setTxt("alogs-stat-finance", financeCount);
  setTxt("alogs-stat-userkyc", userKycCount);
  setTxt("alogs-stat-critical", criticalCount);
}

// ============================================================================
// 🔍 ជំពូកទី ៣៖ ការចម្រាញ់កំណត់ហេតុតាមលក្ខខណ្ឌច្រើនជាន់ (MULTI-CRITERIA FILTERING)
// ============================================================================

/**
 * 🔹 ៣.១ ប្តូរប្រភេទតម្រងតាមប៊ូតុង Category Pills និងកាត KPI
 */
window.alogsSetCategoryFilter = function (catKey) {
  alogsCurrentCategory = catKey;
  currentLogPage = 1;

  document.querySelectorAll(".alogs-filter-pill").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-cat") === catKey);
  });

  document.querySelectorAll(".alogs-kpi-card").forEach((card) => {
    card.classList.remove("active-kpi");
  });
  const activeKpi = document.getElementById(`alogs-kpi-${catKey}`);
  if (activeKpi) activeKpi.classList.add("active-kpi");

  applyLogFilters();
};

/**
 * 🔹 ៣.២ សម្អាតប្រអប់ស្វែងរកទាំងអស់ឱ្យត្រឡប់មកលំនាំដើមវិញ
 */
window.resetAuditLogFilters = function () {
  const dEl = document.getElementById("filterLogDate");
  const aEl = document.getElementById("filterLogAdmin");
  const qEl = document.getElementById("filterLogAction");
  if (dEl) dEl.value = "";
  if (aEl) aEl.value = "";
  if (qEl) qEl.value = "";
  alogsSetCategoryFilter("ALL");
};

/**
 * 🔹 ៣.៣ អនុវត្តការចម្រាញ់តាមប្រភេទ, កាលបរិច្ឆេទ, ឈ្មោះបុគ្គលិក Admin និងពាក្យគន្លឹះ
 */
function applyLogFilters() {
  const filterDate = document.getElementById("filterLogDate")?.value || "";
  const filterAdmin = (document.getElementById("filterLogAdmin")?.value || "")
    .toLowerCase()
    .replace(/^@/, "")
    .trim();
  const filterQuery = (document.getElementById("filterLogAction")?.value || "")
    .toLowerCase()
    .trim();

  filteredAuditLogs = allAuditLogs.filter((log) => {
    const info = classifyAuditAction(log.action, log.details);
    const actLower = String(log.action || "").toLowerCase();

    if (alogsCurrentCategory === "TODAY" && !isLogFromToday(log.date)) {
      return false;
    }
    if (
      alogsCurrentCategory === "FINANCE" &&
      info.category !== "FINANCE" &&
      !actLower.includes("refund")
    ) {
      return false;
    }
    if (
      alogsCurrentCategory === "USER_KYC" &&
      info.category !== "USER_KYC" &&
      !actLower.includes("kyc") &&
      !actLower.includes("user")
    ) {
      return false;
    }
    if (alogsCurrentCategory === "CRITICAL" && info.category !== "CRITICAL") {
      return false;
    }
    if (alogsCurrentCategory === "SYSTEM" && info.category !== "SYSTEM") {
      return false;
    }

    if (filterDate) {
      const [year, month, day] = filterDate.split("-");
      const usNoZero = `${Number(month)}/${Number(day)}/${year}`;
      const usPadded = `${month}/${day}/${year}`;
      const khFormat = `${day}/${month}/${year}`;
      const rawDate = String(log.date || "");

      const matchDate =
        rawDate.includes(filterDate) ||
        rawDate.includes(usNoZero) ||
        rawDate.includes(usPadded) ||
        rawDate.includes(khFormat);
      if (!matchDate) return false;
    }

    if (filterAdmin) {
      const adminName = String(log.admin || "").toLowerCase();
      if (!adminName.includes(filterAdmin)) return false;
    }

    if (filterQuery) {
      const targetUser = resolveAuditTargetUser(log.target);
      const targetFullName = targetUser ? targetUser.fullName || "" : "";
      const combined =
        `${log.action || ""} ${log.target || ""} ${targetFullName} ${log.details || ""} ${log.admin || ""}`.toLowerCase();
      if (!combined.includes(filterQuery)) return false;
    }

    return true;
  });

  const counterEl = document.getElementById("alogs-showing-counter");
  if (counterEl) {
    counterEl.innerText = `បង្ហាញ ${filteredAuditLogs.length} នៃ ${allAuditLogs.length} កំណត់ត្រា`;
  }

  currentLogPage = 1;
  renderAuditLogs();
}

// ============================================================================
// 📊 ជំពូកទី ៤៖ ការគូរតារាងកំណត់ហេតុតាម `_id` និងការបែងចែកទំព័រ (TABLE & PAGINATION BY `_id`)
// ============================================================================

/**
 * 🔹 ៤.១ គូរតារាងកំណត់ហេតុដោយបង្ហាញឈ្មោះពេញរបស់ Admin និងភ្ជាប់ប៊ូតុង 360° តាម `_id`
 */
function renderAuditLogs() {
  const tbody = document.getElementById("logsTableBody");
  if (!tbody) return;

  if (!filteredAuditLogs || filteredAuditLogs.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 55px 20px; color: var(--text-muted);">
          <i class="fa-solid fa-clipboard-question" style="font-size: 3rem; opacity: 0.3; margin-bottom: 12px; display: block;"></i>
          <div style="font-weight: 800; font-size: 1rem; color: var(--text-main);">រកមិនឃើញកំណត់ត្រាសកម្មភាពទេ</div>
          <div style="font-size: 0.84rem; margin-top: 4px;">សូមសាកល្បងផ្លាស់ប្តូរការជ្រើសរើសប្រភេទ ឬសម្អាតប្រអប់ស្វែងរក។</div>
        </td>
      </tr>
    `;
    document.getElementById("logPageInfo").innerText =
      "ទំព័រ 1 នៃ 1 (0 កំណត់ត្រា)";
    document.getElementById("btnPrevLogs").disabled = true;
    document.getElementById("btnNextLogs").disabled = true;
    return;
  }

  const totalPages = Math.ceil(filteredAuditLogs.length / LOGS_PER_PAGE) || 1;
  if (currentLogPage > totalPages) currentLogPage = totalPages;
  if (currentLogPage < 1) currentLogPage = 1;

  const startIndex = (currentLogPage - 1) * LOGS_PER_PAGE;
  const logsToShow = filteredAuditLogs.slice(
    startIndex,
    startIndex + LOGS_PER_PAGE,
  );

  tbody.innerHTML = logsToShow
    .map((l, idx) => {
      const actualIdx = startIndex + idx;
      const info = classifyAuditAction(l.action, l.details);

      const rawDate = String(l.date || "N/A");
      const dateParts = rawDate.split(",");
      const dateMain = dateParts[0] || rawDate;
      const timeMain = dateParts.slice(1).join(",").trim();

      // 🎯 ស្វែងរកអតិថិជនគោលដៅតាមរយៈ MongoDB `_id`
      const targetStr = String(l.target || "-").trim();
      const matchedUser = resolveAuditTargetUser(targetStr);

      let targetHtml = `<span style="font-family:'JetBrains Mono',monospace; font-weight:700; color:var(--text-main); font-size:0.86rem;">${targetStr}</span>`;
      if (matchedUser) {
        const canonicalId = String(matchedUser._id || matchedUser.id);
        const custFullName = matchedUser.fullName || matchedUser.username;
        targetHtml = `
          <div style="display:inline-flex; align-items:center; gap:6px; flex-wrap:wrap;">
            <span style="font-weight:800; color:var(--text-main); font-size:0.88rem;">${custFullName}</span>
            <button type="button" onclick="alogsJumpToCustomer360('${canonicalId}')" title="បើកមើលក្នុង Customer 360° តាម _id" style="background:var(--bg-body); border:1px solid var(--border); color:#3b82f6; border-radius:6px; padding:2px 6px; font-size:0.68rem; font-weight:800; cursor:pointer;">
              360° <i class="fa-solid fa-arrow-up-right-from-square" style="font-size:0.58rem;"></i>
            </button>
          </div>
        `;
      }

      const adminDisplayName = String(
        l.admin || "ប្រព័ន្ធស្វ័យប្រវត្តិ",
      ).replace(/^@/, "");
      const adminInitial = adminDisplayName.charAt(0).toUpperCase() || "A";

      return `
        <tr style="border-bottom: 1px solid var(--border, #e2e8f0); transition: 0.15s;" onmouseover="this.style.background='rgba(15, 23, 42, 0.015)'" onmouseout="this.style.background='transparent'">
          <td style="padding: 13px 12px;">
            <div style="font-weight: 800; font-size: 0.84rem; color: var(--text-main);">
              <i class="fa-regular fa-calendar" style="color: #0d9488; margin-right: 4px;"></i> ${dateMain}
            </div>
            ${
              timeMain
                ? `<div style="font-size: 0.74rem; color: var(--text-muted); font-family: 'JetBrains Mono', monospace; margin-top: 2px; padding-left: 18px;">
                     ${timeMain}
                   </div>`
                : ""
            }
          </td>

          <td style="padding: 13px 12px;">
            <div style="display: flex; align-items: center; gap: 9px;">
              <div style="width: 32px; height: 32px; border-radius: 9px; background: linear-gradient(135deg, #004d40, #0d9488); color: #ffffff; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 0.82rem; flex-shrink: 0;">
                ${adminInitial}
              </div>
              <div>
                <div style="font-weight: 800; font-size: 0.88rem; color: var(--text-main);">${adminDisplayName}</div>
                <div style="font-size: 0.68rem; color: var(--text-muted); font-weight: 700;">មន្ត្រីប្រតិបត្តិ (Admin)</div>
              </div>
            </div>
          </td>

          <td style="padding: 13px 12px;">
            <span class="alogs-action-badge ${info.badgeClass}">
              <i class="fa-solid ${info.icon}"></i>
              <span>${l.action || "System Action"}</span>
            </span>
          </td>

          <td style="padding: 13px 12px;">
            ${targetHtml}
          </td>

          <td style="padding: 13px 12px; color: var(--text-muted); font-size: 0.86rem; max-width: 360px;">
            <div style="overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; line-height: 1.45; color: var(--text-main);">
              ${l.details || "-"}
            </div>
          </td>

          <td style="padding: 13px 12px; text-align: right; white-space: nowrap;">
            <button type="button" class="alogs-btn-view" onclick="openAuditLogDetailModal(${actualIdx})">
              <i class="fa-solid fa-eye"></i> លម្អិត
            </button>
          </td>
        </tr>
      `;
    })
    .join("");

  const pageInfo = document.getElementById("logPageInfo");
  if (pageInfo) {
    pageInfo.innerText = `ទំព័រ ${currentLogPage} នៃ ${totalPages} (សរុប ${filteredAuditLogs.length} កំណត់ត្រា)`;
  }

  const prevBtn = document.getElementById("btnPrevLogs");
  const nextBtn = document.getElementById("btnNextLogs");
  if (prevBtn) {
    prevBtn.disabled = currentLogPage === 1;
    prevBtn.style.opacity = currentLogPage === 1 ? "0.5" : "1";
  }
  if (nextBtn) {
    nextBtn.disabled = currentLogPage >= totalPages;
    nextBtn.style.opacity = currentLogPage >= totalPages ? "0.5" : "1";
  }
}

function changeLogPage(step) {
  const totalPages = Math.ceil(filteredAuditLogs.length / LOGS_PER_PAGE) || 1;
  currentLogPage += step;
  if (currentLogPage < 1) currentLogPage = 1;
  if (currentLogPage > totalPages) currentLogPage = totalPages;
  renderAuditLogs();
}

// ============================================================================
// 🔎 ជំពូកទី ៥៖ ផ្ទាំងពិនិត្យលម្អិត, ការលោតទៅ C360° តាម `_id` និងការទាញយក CSV (INSPECTOR & EXPORT)
// ============================================================================

/**
 * 🔹 ៥.១ បើកផ្ទាំងពិនិត្យព័ត៌មានលម្អិតនៃកំណត់ត្រាសកម្មភាពនីមួយៗ
 */
window.openAuditLogDetailModal = function (index) {
  const log = filteredAuditLogs[index];
  if (!log) return;

  const info = classifyAuditAction(log.action, log.details);
  const matchedUser = resolveAuditTargetUser(log.target);
  const targetDisplay = matchedUser
    ? `${matchedUser.fullName || matchedUser.username} (_id: ${String(matchedUser._id).slice(-8)})`
    : log.target || "-";
  const adminDisplayName = String(log.admin || "ប្រព័ន្ធស្វ័យប្រវត្តិ").replace(
    /^@/,
    "",
  );

  Swal.fire({
    title: `<span style="font-family:'Kantumruy Pro',sans-serif; font-size:1.2rem; font-weight:800;"><i class="fa-solid fa-shield-halved" style="color:${info.severityColor};"></i> ព័ត៌មានលម្អិតនៃកំណត់ត្រា (Audit Log Inspector)</span>`,
    html: `
      <div style="text-align: left; font-family: 'Kantumruy Pro', 'Inter', sans-serif; font-size: 0.9rem; display: flex; flex-direction: column; gap: 10px; margin-top: 10px;">
        <div style="display:flex; justify-content:space-between; padding:10px 14px; background:var(--bg-body,#f8fafc); border:1px solid var(--border,#e2e8f0); border-radius:10px;">
          <span style="color:var(--text-muted); font-weight:700;">កម្រិតសកម្មភាព៖</span>
          <span style="font-weight:800; color:${info.severityColor};">${info.severityLabel}</span>
        </div>

        <div style="display:flex; justify-content:space-between; padding:10px 14px; background:var(--bg-body,#f8fafc); border:1px solid var(--border,#e2e8f0); border-radius:10px;">
          <span style="color:var(--text-muted); font-weight:700;">កាលបរិច្ឆេទ និងម៉ោង៖</span>
          <span style="font-weight:800; font-family:monospace;">${log.date || "N/A"}</span>
        </div>

        <div style="display:flex; justify-content:space-between; padding:10px 14px; background:var(--bg-body,#f8fafc); border:1px solid var(--border,#e2e8f0); border-radius:10px;">
          <span style="color:var(--text-muted); font-weight:700;">មន្ត្រីប្រតិបត្តិ (Admin)៖</span>
          <span style="font-weight:800; color:#0d9488;">${adminDisplayName}</span>
        </div>

        <div style="display:flex; justify-content:space-between; padding:10px 14px; background:var(--bg-body,#f8fafc); border:1px solid var(--border,#e2e8f0); border-radius:10px;">
          <span style="color:var(--text-muted); font-weight:700;">ប្រភេទសកម្មភាព (Action)៖</span>
          <span style="font-weight:800;">${log.action || "N/A"}</span>
        </div>

        <div style="display:flex; justify-content:space-between; padding:10px 14px; background:var(--bg-body,#f8fafc); border:1px solid var(--border,#e2e8f0); border-radius:10px;">
          <span style="color:var(--text-muted); font-weight:700;">គោលដៅ (Target)៖</span>
          <span style="font-weight:800;">${targetDisplay}</span>
        </div>

        <div style="padding:12px 14px; background:var(--bg-body,#f8fafc); border:1px solid var(--border,#e2e8f0); border-radius:10px;">
          <div style="color:var(--text-muted); font-weight:700; margin-bottom:6px;">បរិយាយលម្អិត (Audit Trail Details)៖</div>
          <div style="font-weight:700; line-height:1.5; word-break:break-word;">${log.details || "គ្មានការបរិយាយបន្ថែម"}</div>
        </div>
      </div>
    `,
    confirmButtonText:
      "<span style=\"font-family:'Kantumruy Pro',sans-serif;\">បិទផ្ទាំង (Close)</span>",
    confirmButtonColor: "#004d40",
    customClass: { popup: "modal-radius kh-text" },
  });
};

/**
 * 🔹 ៥.២ លោតទៅកាន់ទំព័រ Customer 360° តាមរយៈ MongoDB `_id` របស់អតិថិជនផ្ទាល់!
 */
window.alogsJumpToCustomer360 = function (targetId) {
  if (typeof goToCustomer360 === "function") {
    goToCustomer360(targetId);
    return;
  }
  const searchInput = document.getElementById("searchC360");
  if (searchInput) {
    searchInput.value = targetId;
    if (typeof showSection === "function") showSection("customer-360");
    if (typeof searchCustomer360 === "function") {
      searchCustomer360();
    }
  }
};

/**
 * 🔹 ៥.៣ ទាញយករបាយការណ៍កំណត់ហេតុសកម្មភាពជាឯកសារ CSV
 */
window.exportAuditLogsCSV = function () {
  if (!filteredAuditLogs || filteredAuditLogs.length === 0) {
    return Swal.fire({
      icon: "info",
      title: "គ្មានទិន្នន័យ",
      text: "មិនមានកំណត់ត្រាសម្រាប់ទាញយកទេ!",
      customClass: { popup: "kh-text" },
    });
  }

  const headers = ["Date", "Admin", "Action", "Target_ID", "Details"];
  const rows = filteredAuditLogs.map((l) => [
    `"${String(l.date || "").replace(/"/g, '""')}"`,
    `"${String(l.admin || "")
      .replace(/^@/, "")
      .replace(/"/g, '""')}"`,
    `"${String(l.action || "").replace(/"/g, '""')}"`,
    `"${String(l.target || "").replace(/"/g, '""')}"`,
    `"${String(l.details || "").replace(/"/g, '""')}"`,
  ]);

  const csvContent =
    "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `UPAY_Audit_Logs_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * 🔹 ៥.៤ ចាប់ផ្តើមទាញទិន្នន័យកំណត់ហេតុដោយស្វ័យប្រវត្តិពេលចុចចូលម៉ឺនុយ Audit Logs
 */
document.addEventListener("DOMContentLoaded", () => {
  document.body.addEventListener("click", (e) => {
    const navItem = e.target.closest(
      "[onclick*='logs'], [data-target*='logs']",
    );
    if (navItem) {
      setTimeout(() => loadAdminLogs(), 100);
    }
  });
});
