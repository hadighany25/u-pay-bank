// ========================================================================
// ឯកសារ: admin-logs.js
// អត្ថន័យ: តាមដានសកម្មភាពបុគ្គលិក (Audit Logs) និងការបែងចែកទំព័រ (Pagination)
// ========================================================================

let allAuditLogs = [];
let filteredAuditLogs = [];
let currentLogPage = 1;
const LOGS_PER_PAGE = 15;

async function loadAdminLogs() {
  if (adminRole !== "super_admin") return;
  try {
    const res = await fetch("/api/admin/logs", { headers: getAuthHeaders() });
    const data = await res.json();
    if (data.success && data.logs && data.logs.length > 0) {
      allAuditLogs = data.logs;
      applyLogFilters();
    } else {
      allAuditLogs = [];
      filteredAuditLogs = [];
      document.getElementById("logsTableBody").innerHTML =
        '<tr><td colspan="5" style="text-align: center; padding: 20px; color: var(--text-muted);">គ្មានប្រវត្តិសកម្មភាពទេ</td></tr>';
      document.getElementById("logPageInfo").innerText = "ទំព័រទី 1 / 0";
    }
  } catch (e) {
    console.error("Error loading logs:", e);
  }
}

function applyLogFilters() {
  const filterDate = document.getElementById("filterLogDate").value;
  const filterAdmin = document
    .getElementById("filterLogAdmin")
    .value.toLowerCase()
    .trim();
  const filterAction = document
    .getElementById("filterLogAction")
    .value.toLowerCase()
    .trim();

  filteredAuditLogs = allAuditLogs.filter((log) => {
    let matchDate = true;
    if (filterDate) {
      const [year, month, day] = filterDate.split("-");
      const format1 = `${year}-${month}-${day}`;
      const format2 = `${day}/${month}/${year}`;
      matchDate = log.date.includes(format1) || log.date.includes(format2);
    }
    const matchAdmin =
      !filterAdmin ||
      (log.admin && log.admin.toLowerCase().includes(filterAdmin));
    const matchAction =
      !filterAction ||
      (log.action && log.action.toLowerCase().includes(filterAction));
    return matchDate && matchAdmin && matchAction;
  });

  currentLogPage = 1;
  renderAuditLogs();
}

function renderAuditLogs() {
  const tbody = document.getElementById("logsTableBody");
  if (filteredAuditLogs.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="5" style="text-align: center; padding: 20px; color: var(--text-muted);">រកមិនឃើញទិន្នន័យដែលអ្នកស្វែងរកទេ</td></tr>';
    document.getElementById("logPageInfo").innerText = "ទំព័រទី 1 / 0";
    document.getElementById("btnPrevLogs").disabled = true;
    document.getElementById("btnNextLogs").disabled = true;
    return;
  }
  const totalPages = Math.ceil(filteredAuditLogs.length / LOGS_PER_PAGE);
  const startIndex = (currentLogPage - 1) * LOGS_PER_PAGE;
  const endIndex = startIndex + LOGS_PER_PAGE;
  const logsToShow = filteredAuditLogs.slice(startIndex, endIndex);

  tbody.innerHTML = logsToShow
    .map(
      (l) =>
        `<tr><td style="font-size: 0.85rem; color: var(--text-muted);"><i class="fa-regular fa-clock"></i> ${l.date}</td><td style="font-weight: bold; color: var(--primary);">@${l.admin}</td><td><span style="background: #f1f5f9; color: var(--primary); padding: 4px 10px; border-radius: 6px; font-size: 0.85rem; font-weight: 600;">${l.action}</span></td><td style="font-family: monospace; font-size: 0.95rem;">${l.target || "-"}</td><td style="color: var(--text-muted); font-size: 0.9rem;">${l.details || "-"}</td></tr>`,
    )
    .join("");
  document.getElementById("logPageInfo").innerText =
    `ទំព័រទី ${currentLogPage} / ${totalPages}`;
  document.getElementById("btnPrevLogs").disabled = currentLogPage === 1;
  document.getElementById("btnNextLogs").disabled =
    currentLogPage === totalPages;
}

function changeLogPage(step) {
  const totalPages = Math.ceil(filteredAuditLogs.length / LOGS_PER_PAGE);
  currentLogPage += step;
  if (currentLogPage < 1) currentLogPage = 1;
  if (currentLogPage > totalPages) currentLogPage = totalPages;
  renderAuditLogs();
}
