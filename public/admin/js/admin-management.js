// ========================================================================
// ឯកសារ: js/admin-management.js (100% Pro Staff 360° Hub, Cloudinary & ID Badge)
// អត្ថន័យ: គ្រប់គ្រងបុគ្គលិកបែប 360° Tabs, Upload រូបថត Cloudinary, NFC Toggle & កាតបុគ្គលិក
// ========================================================================

let globalAdminsData = [];
let filteredAdminsData = [];
let globalStaffAuditLogs = [];

let currentAdminTablePage = 1;
const ADMINS_PER_PAGE = 6;
let aadmCurrentFilter = "ALL";

// ☁️ ការកំណត់ Cloudinary ពិតប្រាកដ (ដូចគ្នាបេះបិទជាមួយ settings.html)
const STAFF_CLOUDINARY_CLOUD_NAME = "jp9yg3dj";
const STAFF_CLOUDINARY_UPLOAD_PRESET = "iaxuqmpb";

// 🕒 ១. ពិនិត្យមើលថាតើបុគ្គលិកកំពុងស្ថិតក្នុងម៉ោងធ្វើការបច្ចុប្បន្នឬអត់ (Phnom Penh Time)
function isStaffCurrentlyOnShift(adminObj) {
  if (!adminObj || adminObj.isActive === false) return false;
  if (adminObj.role === "super_admin") return true;

  const start = adminObj.permissions?.workStart || "00:00";
  const end = adminObj.permissions?.workEnd || "23:59";

  const now = new Date();
  const khmerTimeStr = now.toLocaleString("en-US", {
    timeZone: "Asia/Phnom_Penh",
    hour12: false,
  });
  const timeMatch = khmerTimeStr.match(/(\d+):(\d+):/);
  if (!timeMatch) return true;

  const currentHour = timeMatch[1].padStart(2, "0");
  const currentMin = timeMatch[2].padStart(2, "0");
  const currentTime = `${currentHour}:${currentMin}`;

  return currentTime >= start && currentTime <= end;
}

// 🎨 ២. ទាញយកពណ៌ និងផ្លាកសម្រាប់តួនាទីនីមួយៗ
function getAdminRoleMeta(adminObj) {
  const r = adminObj?.role || "support_agent";
  if (r === "super_admin") {
    return {
      label: "SUPER ADMIN",
      icon: "fa-crown",
      bg: "rgba(239, 68, 68, 0.14)",
      color: "#ef4444",
      border: "rgba(239, 68, 68, 0.3)",
      cardGradient:
        "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #7f1d1d 100%)",
      accentHex: "#f87171",
    };
  }
  if (r === "finance_admin") {
    return {
      label: "FINANCE ADMIN",
      icon: "fa-coins",
      bg: "rgba(16, 185, 129, 0.14)",
      color: "#10b981",
      border: "rgba(16, 185, 129, 0.3)",
      cardGradient:
        "linear-gradient(135deg, #004d40 0%, #065f46 55%, #0d9488 100%)",
      accentHex: "#34d399",
    };
  }
  if (r === "custom") {
    const customName = adminObj?.permissions?.customRoleName || "CUSTOM ROLE";
    return {
      label: customName.toUpperCase(),
      icon: "fa-sliders",
      bg: "rgba(139, 92, 246, 0.14)",
      color: "#8b5cf6",
      border: "rgba(139, 92, 246, 0.3)",
      cardGradient:
        "linear-gradient(135deg, #1e1b4b 0%, #4c1d95 55%, #7c3aed 100%)",
      accentHex: "#c4b5fd",
    };
  }
  return {
    label: "SUPPORT AGENT",
    icon: "fa-headset",
    bg: "rgba(59, 130, 246, 0.14)",
    color: "#3b82f6",
    border: "rgba(59, 130, 246, 0.3)",
    cardGradient:
      "linear-gradient(135deg, #0f172a 0%, #1e3a8a 55%, #0284c7 100%)",
    accentHex: "#38bdf8",
  };
}

// 📊 ៣. រាប់ចំនួនសកម្មភាព (Logs) របស់បុគ្គលិកម្នាក់ៗ
function getLogsForStaffUsername(username) {
  if (!username || !Array.isArray(globalStaffAuditLogs)) return [];
  const cleanUser = String(username).replace(/^@/, "").toLowerCase().trim();
  return globalStaffAuditLogs.filter((log) => {
    const logAdmin = String(log.admin || "")
      .replace(/^@/, "")
      .toLowerCase()
      .trim();
    return logAdmin === cleanUser;
  });
}

function generateAutoStaffId() {
  return "UPAY-" + Math.floor(100000 + Math.random() * 900000);
}

function normalizeUID(uid) {
  if (!uid) return "";
  uid = String(uid).replaceAll(":", "").replace(/\s/g, "").trim().toUpperCase();
  if (/^\d{10}$/.test(uid)) {
    let hex = parseInt(uid, 10).toString(16).toUpperCase();
    hex = hex.padStart(8, "0");
    let byte1 = hex.substring(6, 8);
    let byte2 = hex.substring(4, 6);
    let byte3 = hex.substring(2, 4);
    let byte4 = hex.substring(0, 2);
    return byte1 + byte2 + byte3 + byte4;
  }
  return uid;
}

// 🧹 មុខងារបិទ Modal ចាស់ៗទាំងអស់ឱ្យដាច់ ១០០% (ការពារករណីជាប់ !important)
function forceCloseLegacyAdminModal() {
  const legacyModal = document.getElementById("adminAccModal");
  if (legacyModal) {
    legacyModal.style.setProperty("display", "none", "important");
  }
  if (typeof closeModal === "function") {
    try {
      closeModal("adminAccModal");
    } catch (e) {}
  }
}

// ========================================================================
// 🔄 SECTION 1: LOAD ADMINS & AUDIT LOGS, KPI STATS & FILTERING
// ========================================================================

window.loadAdminList = async function (showToast = false) {
  if (typeof adminRole !== "undefined" && adminRole !== "super_admin") return;

  const spinIcon = document.getElementById("aadm-refresh-icon");
  if (spinIcon) spinIcon.classList.add("fa-spin");

  try {
    const [resAdmins, resLogs] = await Promise.all([
      fetch("/api/admin/list-admins", { headers: getAuthHeaders() }),
      fetch("/api/admin/logs", { headers: getAuthHeaders() }).catch(() => null),
    ]);

    const dataAdmins = await resAdmins.json();
    if (dataAdmins.success) {
      globalAdminsData = dataAdmins.admins || [];
    }

    if (resLogs && resLogs.ok) {
      const dataLogs = await resLogs.json();
      if (dataLogs.success && Array.isArray(dataLogs.logs)) {
        globalStaffAuditLogs = dataLogs.logs;
      }
    }

    updateAdminKpiCards();
    filterAdminList();

    if (showToast) {
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "ទិន្នន័យបុគ្គលិក និង Logs ត្រូវបានធ្វើបច្ចុប្បន្នភាព!",
        showConfirmButton: false,
        timer: 1300,
        customClass: { popup: "kh-text" },
      });
    }
  } catch (e) {
    console.error("Error loading admins:", e);
  } finally {
    if (spinIcon) spinIcon.classList.remove("fa-spin");
  }
};
setTimeout(() => loadAdminList(false), 1000);

function updateAdminKpiCards() {
  let activeCount = 0;
  let onShiftCount = 0;
  let nfcCount = 0;

  globalAdminsData.forEach((a) => {
    if (a.isActive !== false) activeCount++;
    if (isStaffCurrentlyOnShift(a)) onShiftCount++;
    if (a.nfcUid && String(a.nfcUid).trim() !== "") nfcCount++;
  });

  const setTxt = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.innerText = val;
  };
  setTxt("aadm-stat-total", globalAdminsData.length);
  setTxt("aadm-stat-active", activeCount);
  setTxt("aadm-stat-onshift", onShiftCount);
  setTxt("aadm-stat-nfc", nfcCount);
  setTxt("aadm-stat-logs", globalStaffAuditLogs.length.toLocaleString("en-US"));
}

window.aadmSetRoleFilter = function (filterKey) {
  aadmCurrentFilter = filterKey;
  currentAdminTablePage = 1;

  document.querySelectorAll(".aadm-filter-pill").forEach((btn) => {
    btn.classList.toggle(
      "active",
      btn.getAttribute("data-filter") === filterKey,
    );
  });

  document.querySelectorAll(".aadm-kpi-card").forEach((card) => {
    card.classList.remove("active-kpi");
  });
  const activeKpi = document.getElementById(`aadm-kpi-${filterKey}`);
  if (activeKpi) activeKpi.classList.add("active-kpi");

  filterAdminList();
};

window.filterAdminList = function () {
  const searchBox = document.getElementById("searchAdminBox");
  const keyword = (searchBox ? searchBox.value : "").toLowerCase().trim();

  filteredAdminsData = (globalAdminsData || []).filter((a) => {
    if (aadmCurrentFilter === "ACTIVE" && a.isActive === false) return false;
    if (aadmCurrentFilter === "ON_SHIFT" && !isStaffCurrentlyOnShift(a))
      return false;
    if (
      aadmCurrentFilter === "NFC_LINKED" &&
      (!a.nfcUid || String(a.nfcUid).trim() === "")
    )
      return false;
    if (
      ["super_admin", "finance_admin", "support_agent", "custom"].includes(
        aadmCurrentFilter,
      ) &&
      a.role !== aadmCurrentFilter
    ) {
      return false;
    }

    if (keyword) {
      const searchStr = [
        a.fullName,
        a.username,
        a.staffId,
        a.role,
        a.department,
        a.phone,
        a.email,
        a.nickname,
        a.permissions?.customRoleName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return searchStr.includes(keyword);
    }
    return true;
  });

  currentAdminTablePage = 1;
  renderAdminTable(filteredAdminsData);
};

// ========================================================================
// 📋 SECTION 2: RENDER ADMIN TABLE (រូប Profile ពិត + ប៊ូតុង NFC ពណ៌បៃតង/ប្រផេះ + ប៊ូតុងកាតបុគ្គលិក)
// ========================================================================

window.renderAdminTable = function (adminsToRender = null) {
  if (Array.isArray(adminsToRender)) {
    filteredAdminsData = adminsToRender;
  }

  const tbody = document.getElementById("adminTableBody");
  if (!tbody) return;

  if (!filteredAdminsData || filteredAdminsData.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 50px 20px; color: var(--text-muted);">
          <i class="fa-solid fa-user-slash" style="font-size: 2.8rem; opacity: 0.3; margin-bottom: 12px; display: block;"></i>
          <div style="font-weight: 800; font-size: 1rem; color: var(--text-main);">មិនមានគណនីបុគ្គលិកក្នុងផ្នែកនេះទេ</div>
          <div style="font-size: 0.84rem; margin-top: 4px;">សូមប្តូរការជ្រើសរើស Filter ឬចុចប៊ូតុង "បង្កើតគណនីបុគ្គលិកថ្មី"។</div>
        </td>
      </tr>
    `;
    const pInfo = document.getElementById("adminTablePageInfo");
    if (pInfo) pInfo.innerText = "ទំព័រ 1 នៃ 1 (0 បុគ្គលិក)";
    return;
  }

  const totalPages =
    Math.ceil(filteredAdminsData.length / ADMINS_PER_PAGE) || 1;
  if (currentAdminTablePage > totalPages) currentAdminTablePage = totalPages;
  if (currentAdminTablePage < 1) currentAdminTablePage = 1;

  const startIndex = (currentAdminTablePage - 1) * ADMINS_PER_PAGE;
  const pageItems = filteredAdminsData.slice(
    startIndex,
    startIndex + ADMINS_PER_PAGE,
  );

  const colors = [
    "#0d9488",
    "#3b82f6",
    "#8b5cf6",
    "#10b981",
    "#f59e0b",
    "#ec4899",
  ];

  tbody.innerHTML = pageItems
    .map((a, idx) => {
      const roleMeta = getAdminRoleMeta(a);
      const isActive = a.isActive !== false;
      const onShift = isStaffCurrentlyOnShift(a);
      const staffLogs = getLogsForStaffUsername(a.username);
      const avatarBg = colors[(startIndex + idx) % colors.length];
      const initials = String(a.fullName || a.username || "AD")
        .substring(0, 2)
        .toUpperCase();

      const hasNfc = Boolean(a.nfcUid && String(a.nfcUid).trim() !== "");

      const avatarHtml =
        a.profileImage && String(a.profileImage).trim() !== ""
          ? `<img src="${a.profileImage}" style="width: 44px; height: 44px; border-radius: 13px; object-fit: cover; border: 2px solid #0d9488; flex-shrink: 0; cursor: pointer;" onclick="openStaff360Modal('${a._id}', 'profile')" onerror="this.outerHTML='<div style=\\'width:44px;height:44px;border-radius:13px;background:${avatarBg};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:0.95rem;flex-shrink:0;\\'>${initials}</div>'">`
          : `<div onclick="openStaff360Modal('${a._id}', 'profile')" style="width: 44px; height: 44px; border-radius: 13px; background: ${avatarBg}; color: #ffffff; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 0.95rem; flex-shrink: 0; cursor: pointer;">
               ${initials}
             </div>`;

      const menuObj = a.permissions?.menus || {};
      const actObj = a.permissions?.actions || {};
      const menuCount =
        a.role === "super_admin"
          ? 12
          : Object.values(menuObj).filter(Boolean).length;
      const actCount =
        a.role === "super_admin"
          ? 5
          : Object.values(actObj).filter(Boolean).length;

      return `
        <tr style="border-bottom: 1px solid var(--border, #e2e8f0); transition: 0.15s;" onmouseover="this.style.background='rgba(15, 23, 42, 0.015)'" onmouseout="this.style.background='transparent'">
          <!-- ១. ឈ្មោះបុគ្គលិក, រូបថត Profile, @username & Staff ID -->
          <td style="padding: 14px 12px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              ${avatarHtml}
              <div>
                <div onclick="openStaff360Modal('${a._id}', 'profile')" style="font-weight: 800; font-size: 0.94rem; color: var(--text-main); text-transform: uppercase; cursor: pointer;">
                  ${a.fullName || a.username}
                  ${a.nickname ? `<span style="font-size:0.75rem; color:var(--text-muted); font-weight:700;">(${a.nickname})</span>` : ""}
                </div>
                <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 2px; display: flex; align-items: center; gap: 6px;">
                  <span style="color: #0d9488; font-weight: 800;">@${a.username}</span>
                  <span>•</span>
                  <span style="font-family: 'JetBrains Mono', monospace; font-weight: 700;">${a.staffId || "UPAY-STAFF"}</span>
                </div>
              </div>
            </div>
          </td>

          <!-- ២. តួនាទី & នាយកដ្ឋាន -->
          <td style="padding: 14px 12px;">
            <span class="aadm-role-badge" style="background: ${roleMeta.bg}; color: ${roleMeta.color}; border: 1px solid ${roleMeta.border};">
              <i class="fa-solid ${roleMeta.icon}"></i>
              <span>${roleMeta.label}</span>
            </span>
            <div style="font-size: 0.76rem; color: var(--text-muted); font-weight: 700; margin-top: 5px;">
              <i class="fa-solid fa-building-user" style="margin-right: 4px;"></i> ${a.department || "General Operations"}
            </div>
          </td>

          <!-- ៣. ម៉ោងធ្វើការ & ស្ថានភាពវេន -->
          <td style="padding: 14px 12px;">
            <div style="font-family: 'JetBrains Mono', monospace; font-weight: 800; font-size: 0.86rem; color: var(--text-main);">
              <i class="fa-regular fa-clock" style="color: #0d9488;"></i>
              ${a.permissions?.workStart || "00:00"} - ${a.permissions?.workEnd || "23:59"}
            </div>
            <span class="aadm-shift-badge" style="background: ${onShift ? "rgba(16, 185, 129, 0.14)" : "rgba(148, 163, 184, 0.16)"}; color: ${onShift ? "#10b981" : "var(--text-muted)"};">
              ${onShift ? "🟢 ក្នុងម៉ោងការងារ (On-Shift)" : "🌙 ក្រៅម៉ោងការងារ (Off-Shift)"}
            </span>
          </td>

          <!-- ៤. សិទ្ធិប្រើប្រាស់ & ប៊ូតុងឆែក Logs បុគ្គលិកម្នាក់ៗ -->
          <td style="padding: 14px 12px;">
            <div style="font-size: 0.76rem; color: var(--text-muted); font-weight: 700; margin-bottom: 5px;">
              ម៉ឺនុយ៖ <b style="color:var(--text-main);">${menuCount}</b> • សិទ្ធិពិសេស៖ <b style="color:var(--text-main);">${actCount}</b>
            </div>
            <button type="button" onclick="openStaff360Modal('${a._id}', 'logs')" style="background: rgba(13, 148, 136, 0.1); color: #0d9488; border: 1px dashed rgba(13, 148, 136, 0.45); padding: 4px 11px; border-radius: 8px; font-size: 0.75rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
              <i class="fa-solid fa-clipboard-check"></i>
              <span>${staffLogs.length} សកម្មភាព (មើល Logs)</span>
            </button>
          </td>

          <!-- ៥. កុងតាក់បិទ/បើកគណនី -->
          <td style="padding: 14px 12px;">
            <label style="position: relative; display: inline-block; width: 46px; height: 24px; cursor: pointer;">
              <input type="checkbox" ${isActive ? "checked" : ""} 
                onchange="toggleAdminStatusAccount('${a._id}')" 
                style="opacity: 0; width: 0; height: 0;">
              <span style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: ${isActive ? "#10b981" : "#cbd5e1"}; transition: .3s; border-radius: 24px;"></span>
              <span style="position: absolute; content: ''; height: 18px; width: 18px; left: ${isActive ? "24px" : "3px"}; bottom: 3px; background-color: white; transition: .3s; border-radius: 50%;"></span>
            </label>
            <div style="font-size: 0.72rem; margin-top: 3px; font-weight: 800; color: ${isActive ? "#10b981" : "#ef4444"};">
              ${isActive ? "ACTIVE" : "SUSPENDED"}
            </div>
          </td>

          <!-- ៦. ប៊ូតុងសកម្មភាព (Wi-Fi NFC បៃតង/ប្រផេះ, កាតបុគ្គលិក ID Badge, Staff 360° Edit, Reset Pass, Delete) -->
          <td style="padding: 14px 12px; text-align: right; white-space: nowrap;">
            <div style="display: inline-flex; gap: 6px; align-items: center;">
              <!-- 📡 ប៊ូតុង Wi-Fi សម្រាប់ភ្ជាប់ ឬផ្តាច់កាត NFC (បៃតង = ភ្ជាប់រួច, ប្រផេះ = មិនទាន់ភ្ជាប់) -->
              <button
                type="button"
                class="aadm-act-btn"
                style="${
                  hasNfc
                    ? "background: rgba(16, 185, 129, 0.16); color: #10b981; border-color: rgba(16, 185, 129, 0.4);"
                    : "background: rgba(148, 163, 184, 0.15); color: #64748b; border-color: rgba(148, 163, 184, 0.35);"
                }"
                onclick="handleQuickNfcToggle('${a._id}')"
                title="${
                  hasNfc
                    ? `ភ្ជាប់កាត NFC រួចរាល់ (${a.nfcUid}) - ចុចដើម្បីផ្តាច់ ឬប្តូរកាត`
                    : "មិនទាន់ភ្ជាប់កាត NFC - ចុចដើម្បីស្កេនភ្ជាប់កាតភ្លាមៗ"
                }"
              >
                <i class="fa-solid fa-wifi"></i>
              </button>

              <!-- 🪪 ប៊ូតុងថ្មី៖ កាតសម្គាល់ខ្លួនបុគ្គលិកលំដាប់ពិភពលោក (Staff ID Card) -->
              <button
                type="button"
                class="aadm-act-btn"
                style="background: rgba(14, 165, 233, 0.14); color: #0284c7; border-color: rgba(14, 165, 233, 0.35);"
                onclick="openStaffIdCardModal('${a._id}')"
                title="បើកមើល និងបោះពុម្ពកាតសម្គាល់ខ្លួនបុគ្គលិក (Staff ID Badge)"
              >
                <i class="fa-solid fa-id-badge"></i>
              </button>

              <!-- 🕵️‍♂️ ប៊ូតុងបើកផ្ទាំង Staff 360° (មើល/កែប្រែគ្រប់យ៉ាងក្នុងផ្ទាំងតែមួយ) -->
              <button
                type="button"
                class="aadm-act-btn"
                style="background: rgba(16, 185, 129, 0.14); color: #059669; border-color: rgba(16, 185, 129, 0.35);"
                onclick="openStaff360Modal('${a._id}', 'profile')"
                title="បើកមជ្ឈមណ្ឌលគ្រប់គ្រងបុគ្គលិក 360° (កែប្រែព័ត៌មាន, សិទ្ធិ & Logs)"
              >
                <i class="fa-solid fa-user-pen"></i> 360°
              </button>

              <!-- 🔑 ប៊ូតុង Reset Password -->
              <button
                type="button"
                class="aadm-act-btn"
                style="background: rgba(245, 158, 11, 0.14); color: #d97706; border-color: rgba(245, 158, 11, 0.3);"
                onclick="promptResetAdminPassword('${a._id}', '${a.username}')"
                title="កំណត់ពាក្យសម្ងាត់ថ្មី (Reset Password)"
              >
                <i class="fa-solid fa-key"></i>
              </button>

              <!-- 🗑️ ប៊ូតុង Delete -->
              ${
                a.username !== "admin"
                  ? `<button
                       type="button"
                       class="aadm-act-btn"
                       style="background: rgba(239, 68, 68, 0.14); color: #ef4444; border-color: rgba(239, 68, 68, 0.3);"
                       onclick="deleteAdminAcc('${a._id}')"
                       title="លុបគណនីបុគ្គលិក"
                     >
                       <i class="fa-solid fa-trash-can"></i>
                     </button>`
                  : ""
              }
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  const pageInfo = document.getElementById("adminTablePageInfo");
  if (pageInfo) {
    pageInfo.innerText = `ទំព័រ ${currentAdminTablePage} នៃ ${totalPages} (សរុប ${filteredAdminsData.length} បុគ្គលិក)`;
  }

  const prevBtn = document.getElementById("btnPrevAdminPage");
  const nextBtn = document.getElementById("btnNextAdminPage");
  if (prevBtn) {
    prevBtn.disabled = currentAdminTablePage === 1;
    prevBtn.style.opacity = currentAdminTablePage === 1 ? "0.5" : "1";
  }
  if (nextBtn) {
    nextBtn.disabled = currentAdminTablePage >= totalPages;
    nextBtn.style.opacity = currentAdminTablePage >= totalPages ? "0.5" : "1";
  }
};

window.changeAdminTablePage = function (step) {
  const totalPages =
    Math.ceil(filteredAdminsData.length / ADMINS_PER_PAGE) || 1;
  currentAdminTablePage += step;
  if (currentAdminTablePage < 1) currentAdminTablePage = 1;
  if (currentAdminTablePage > totalPages) currentAdminTablePage = totalPages;
  renderAdminTable();
};

// ========================================================================
// 📡 SECTION 3: QUICK NFC TOGGLE ON TABLE (បៃតង = សួរបញ្ជាក់ផ្តាច់ / ប្រផេះ = ស្កេនភ្ជាប់ភ្លាម)
// ========================================================================

window.handleQuickNfcToggle = async function (adminId) {
  const staff = globalAdminsData.find((a) => a._id === adminId);
  if (!staff) return;

  const hasNfc = Boolean(staff.nfcUid && String(staff.nfcUid).trim() !== "");

  // ១. បើមានភ្ជាប់កាត NFC រួចហើយ (ប៊ូតុងពណ៌បៃតង) -> លោត SweetAlert សួរបញ្ជាក់ការផ្តាច់កាត!
  if (hasNfc) {
    const res = await Swal.fire({
      title: `<span style="font-family:'Kantumruy Pro',sans-serif; font-size:1.2rem; color:#0f172a;"><i class="fa-solid fa-wifi" style="color:#10b981;"></i> កាត NFC របស់ @${staff.username}</span>`,
      html: `
        <div style="font-family:'Kantumruy Pro',sans-serif; padding:8px 0;">
          <div style="font-size:0.86rem; color:#64748b; margin-bottom:10px;">បុគ្គលិកនេះបានភ្ជាប់ជាមួយលេខកូដកាត NFC៖</div>
          <div style="font-family:'JetBrains Mono',monospace; font-size:1.35rem; font-weight:900; color:#10b981; background:rgba(16,185,129,0.1); border:1.5px dashed #10b981; padding:12px; border-radius:12px; letter-spacing:2px; margin-bottom:12px;">
            ${staff.nfcUid}
          </div>
          <div style="font-size:0.84rem; color:#ef4444; font-weight:700;">
            តើអ្នកចង់ផ្តាច់កាត NFC នេះចេញពីគណនីបុគ្គលិកមែនទេ?
          </div>
        </div>
      `,
      showCancelButton: true,
      showDenyButton: true,
      confirmButtonColor: "#ef4444",
      denyButtonColor: "#3b82f6",
      cancelButtonColor: "#64748b",
      confirmButtonText:
        '<i class="fa-solid fa-link-slash"></i> ផ្តាច់កាត NFC ចេញ',
      denyButtonText: '<i class="fa-solid fa-rotate"></i> ស្កេនប្តូរកាតថ្មី',
      cancelButtonText: "បិទផ្ទាំង",
      customClass: { popup: "modal-radius kh-text aadm-swal-scope" },
    });

    if (res.isConfirmed) {
      await updateStaffNfcOnServer(staff, null);
    } else if (res.isDenied) {
      startQuickNfcScannerForStaff(staff);
    }
  } else {
    // ២. បើមិនទាន់មានកាត NFC (ប៊ូតុងពណ៌ប្រផេះ) -> បើកផ្ទាំងស្កេនភ្ជាប់កាតភ្លាមៗ!
    startQuickNfcScannerForStaff(staff);
  }
};

function startQuickNfcScannerForStaff(staff) {
  let isScanning = true;
  let scanBuffer = "";

  Swal.fire({
    title: `<span style="font-family:'Kantumruy Pro',sans-serif; font-size:1.18rem;">ភ្ជាប់កាត NFC ជូន @${staff.username}</span>`,
    html: `
      <div style="padding: 15px 0; font-family: 'Kantumruy Pro', sans-serif;">
        <div style="width: 82px; height: 82px; border-radius: 50%; background: rgba(59, 130, 246, 0.12); display: flex; align-items: center; justify-content: center; margin: 0 auto 14px; border: 2px dashed #3b82f6;">
          <i class="fa-solid fa-wifi fa-fade" style="font-size: 2.5rem; color: #3b82f6;"></i>
        </div>
        <p style="color: #475569; font-size: 0.9rem; margin: 0 0 12px; line-height: 1.5;">
          សូមផ្អឹបកាត NFC លើ <b>ម៉ាស៊ីន USB Scanner</b> ឬវាយលេខកូដ UID ខាងក្រោម៖
        </p>
        <input type="text" id="swalQuickNfcInput" placeholder="ស្កេន ឬវាយលេខ UID នៅទីនេះ..." style="width: 100%; height: 44px; padding: 0 14px; border-radius: 10px; border: 2px solid #3b82f6; font-family: 'JetBrains Mono', monospace; font-size: 1rem; font-weight: 800; text-align: center; text-transform: uppercase; box-sizing: border-box; outline: none;">
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: '<i class="fa-solid fa-link"></i> ភ្ជាប់កាតឥឡូវនេះ',
    cancelButtonText: "បោះបង់",
    confirmButtonColor: "#004d40",
    cancelButtonColor: "#64748b",
    customClass: { popup: "modal-radius kh-text aadm-swal-scope" },
    didOpen: () => {
      const inp = document.getElementById("swalQuickNfcInput");
      if (inp) {
        inp.focus();
        inp.addEventListener("keydown", (e) => {
          if (e.key === "Enter" && inp.value.trim().length >= 4) {
            e.preventDefault();
            Swal.clickConfirm();
          }
        });
      }

      if ("NDEFReader" in window) {
        try {
          const ndef = new NDEFReader();
          ndef.scan().then(() => {
            ndef.onreading = (event) => {
              if (!isScanning) return;
              const scanned = normalizeUID(event.serialNumber);
              if (inp) inp.value = scanned;
              Swal.clickConfirm();
            };
          });
        } catch (err) {}
      }
    },
    willClose: () => {
      isScanning = false;
    },
    preConfirm: () => {
      const rawVal = document.getElementById("swalQuickNfcInput")?.value || "";
      const cleanUid = normalizeUID(rawVal);
      if (!cleanUid || cleanUid.length < 4) {
        Swal.showValidationMessage(
          "សូមស្កេន ឬបញ្ចូលលេខកូដកាត NFC ឱ្យបានត្រឹមត្រូវ!",
        );
        return false;
      }
      return cleanUid;
    },
  }).then(async (result) => {
    if (result.isConfirmed && result.value) {
      await updateStaffNfcOnServer(staff, result.value);
    }
  });
}

async function updateStaffNfcOnServer(staffObj, newNfcUid) {
  Swal.fire({
    title: "កំពុងធ្វើបច្ចុប្បន្នភាពកាត NFC...",
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading(),
    customClass: { popup: "kh-text" },
  });

  try {
    if (newNfcUid) {
      const chkRes = await fetch("/api/admin/check-nfc", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ nfcUid: newNfcUid, adminId: staffObj._id }),
      });
      const chkData = await chkRes.json();
      if (!chkData.available) {
        return Swal.fire({
          icon: "error",
          title: "កាត NFC ជាន់គ្នា!",
          text: `កាត (${newNfcUid}) ត្រូវបានភ្ជាប់ជាមួយគណនី @${chkData.owner} រួចហើយ!`,
          customClass: { popup: "kh-text" },
        });
      }
    }

    const res = await fetch("/api/admin/save-admin", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        id: staffObj._id,
        username: staffObj.username,
        fullName: staffObj.fullName,
        role: staffObj.role,
        nfcUid: newNfcUid || "",
      }),
    });
    const data = await res.json();

    if (data.success) {
      await loadAdminList(false);
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: newNfcUid
          ? `បានភ្ជាប់កាត NFC (${newNfcUid}) ជោគជ័យ!`
          : `បានផ្តាច់កាត NFC ចេញពី @${staffObj.username}!`,
        showConfirmButton: false,
        timer: 1800,
        customClass: { popup: "kh-text" },
      });
    } else {
      Swal.fire("បរាជ័យ", data.message || "មិនអាចកែប្រែ NFC បានទេ", "error");
    }
  } catch (err) {
    Swal.fire("Error", "បញ្ហាតភ្ជាប់ទៅកាន់ Server", "error");
  }
}

// ========================================================================
// 🕵️‍♂️ SECTION 4: STAFF 360° TABBED COMMAND MODAL (ជំនួស Wizard 4-Step ចាស់!)
// គាំទ្រការបង្កើតថ្មី និងកែប្រែក្នុងផ្ទាំងតែមួយ + Upload រូបថតចូល Cloudinary ផ្ទាល់
// ========================================================================

window.openAdminModal = function (id = "") {
  forceCloseLegacyAdminModal();
  openStaff360Modal(id, "profile");
};

window.inspectStaffAuditLogs = function (id) {
  openStaff360Modal(id, "logs");
};

window.openStaff360Modal = function (adminId = "", initialTab = "profile") {
  forceCloseLegacyAdminModal();

  const isEdit = Boolean(adminId);
  const existing = isEdit
    ? globalAdminsData.find((a) => a._id === adminId)
    : null;

  const staffData = {
    id: existing?._id || "",
    staffId: existing?.staffId || generateAutoStaffId(),
    username: existing?.username || "",
    fullName: existing?.fullName || "",
    nickname: existing?.nickname || "",
    profileImage: existing?.profileImage || "",
    phone: existing?.phone || "",
    email: existing?.email || "",
    department: existing?.department || "Customer Support (CS)",
    remarks: existing?.remarks || "",
    nfcUid: existing?.nfcUid || "",
    role: existing?.role || "support_agent",
    customRoleName: existing?.permissions?.customRoleName || "",
    workStart: existing?.permissions?.workStart || "08:00",
    workEnd: existing?.permissions?.workEnd || "17:00",
    menus: {
      users: existing?.permissions?.menus?.users ?? true,
      checktrx: existing?.permissions?.menus?.checktrx ?? true,
      merchant: existing?.permissions?.menus?.merchant ?? false,
      cashier: existing?.permissions?.menus?.cashier ?? false,
      broadcast: existing?.permissions?.menus?.broadcast ?? false,
      fx: existing?.permissions?.menus?.fx ?? false,
      cards: existing?.permissions?.menus?.cards ?? false,
      promos: existing?.permissions?.menus?.promos ?? false,
      kyc: existing?.permissions?.menus?.kyc ?? true,
      tickets: existing?.permissions?.menus?.tickets ?? true,
      chat: existing?.permissions?.menus?.chat ?? true,
      logs: existing?.permissions?.menus?.logs ?? false,
    },
    actions: {
      editUser: existing?.permissions?.actions?.editUser ?? false,
      deleteUser: existing?.permissions?.actions?.deleteUser ?? false,
      freezeUser: existing?.permissions?.actions?.freezeUser ?? false,
      adjustBal: existing?.permissions?.actions?.adjustBal ?? false,
      refund: existing?.permissions?.actions?.refund ?? false,
    },
  };

  const staffLogs = isEdit ? getLogsForStaffUsername(staffData.username) : [];

  const menuItemsList = [
    { key: "users", label: "អតិថិជន 360° (Customer 360)", icon: "fa-users" },
    {
      key: "checktrx",
      label: "ឆែកប្រតិបត្តិការ (Trx Check)",
      icon: "fa-magnifying-glass-dollar",
    },
    { key: "kyc", label: "អនុម័តអត្តសញ្ញាណ (KYC)", icon: "fa-id-card" },
    {
      key: "cashier",
      label: "បេឡាករ (Cashier Desk)",
      icon: "fa-cash-register",
    },
    { key: "merchant", label: "គ្រប់គ្រងហាង (Merchants)", icon: "fa-store" },
    { key: "cards", label: "គ្រប់គ្រងកាត (Cards)", icon: "fa-credit-card" },
    {
      key: "fx",
      label: "អត្រាប្តូរប្រាក់ (FX Rates)",
      icon: "fa-money-bill-trend-up",
    },
    { key: "promos", label: "កូដប្រូម៉ូសិន (Promo Codes)", icon: "fa-ticket" },
    { key: "broadcast", label: "សារជូនដំណឹង (Broadcast)", icon: "fa-bullhorn" },
    { key: "tickets", label: "សំណូមពរអតិថិជន (Tickets)", icon: "fa-headset" },
    { key: "chat", label: "ប្រអប់សារផ្ទាល់ (Live Chat)", icon: "fa-comments" },
    {
      key: "logs",
      label: "កំណត់ហេតុប្រព័ន្ធ (Audit Logs)",
      icon: "fa-shield-halved",
    },
  ];

  const actionItemsList = [
    {
      key: "editUser",
      label: "កែប្រែព័ត៌មានអតិថិជន (Edit User)",
      color: "#3b82f6",
    },
    {
      key: "freezeUser",
      label: "ផ្អាក/បង្កកគណនី (Freeze Account)",
      color: "#f59e0b",
    },
    {
      key: "adjustBal",
      label: "បន្ថែម/កាត់សមតុល្យ (Adjust Balance)",
      color: "#10b981",
    },
    {
      key: "refund",
      label: "បង្វិលប្រាក់សងវិញ (Refund Trx)",
      color: "#8b5cf6",
    },
    {
      key: "deleteUser",
      label: "លុបគណនីអតិថិជន (Delete User)",
      color: "#ef4444",
    },
  ];

  const initials = String(staffData.fullName || staffData.username || "ST")
    .substring(0, 2)
    .toUpperCase();

  Swal.fire({
    title: `<span style="font-family:'Kantumruy Pro',sans-serif; font-size:1.18rem; font-weight:800; color:var(--text-main,#0f172a);">
      <i class="fa-solid ${isEdit ? "fa-user-gear" : "fa-user-plus"}" style="color:#0d9488;"></i>
      ${isEdit ? `មជ្ឈមណ្ឌលគ្រប់គ្រងបុគ្គលិក 360° (@${staffData.username})` : "បង្កើតគណនីបុគ្គលិកថ្មី (New Staff Onboarding)"}
    </span>`,
    html: `
      <div class="aadm-swal-scope" style="text-align: left; font-family: 'Kantumruy Pro', sans-serif; margin-top: 6px;">
        <!-- របារ Tabs ទាំង ៣ ដូច Customer 360° -->
        <div style="display: flex; gap: 6px; background: #f1f5f9; padding: 5px; border-radius: 12px; margin-bottom: 16px;">
          <button type="button" id="s360-tab-btn-profile" onclick="switchStaff360Tab('profile')" style="flex: 1; padding: 9px 12px; border-radius: 9px; border: none; font-weight: 800; font-size: 0.82rem; cursor: pointer; transition: 0.2s;">
            <i class="fa-solid fa-id-card-clip"></i> ១. ប្រវត្តិរូប & រូបថត
          </button>
          <button type="button" id="s360-tab-btn-perms" onclick="switchStaff360Tab('perms')" style="flex: 1; padding: 9px 12px; border-radius: 9px; border: none; font-weight: 800; font-size: 0.82rem; cursor: pointer; transition: 0.2s;">
            <i class="fa-solid fa-shield-halved"></i> ២. តួនាទី, សិទ្ធិ & NFC
          </button>
          ${
            isEdit
              ? `<button type="button" id="s360-tab-btn-logs" onclick="switchStaff360Tab('logs')" style="flex: 1; padding: 9px 12px; border-radius: 9px; border: none; font-weight: 800; font-size: 0.82rem; cursor: pointer; transition: 0.2s;">
                   <i class="fa-solid fa-clock-rotate-left"></i> ៣. ប្រវត្តិសកម្មភាព (${staffLogs.length})
                 </button>`
              : ""
          }
        </div>

        <!-- ==========================================
             TAB 1: ព័ត៌មានបុគ្គលិក & CLOUDINARY PROFILE PHOTO
             ========================================== -->
        <div id="s360-pane-profile" style="display: none;">
          <!-- ប្រអប់ Upload រូបថត Profile បុគ្គលិក -->
          <div style="display: flex; align-items: center; gap: 16px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 14px 16px; border-radius: 14px; margin-bottom: 14px;">
            <div id="s360-avatar-preview-box" style="width: 68px; height: 68px; border-radius: 18px; background: linear-gradient(135deg, #004d40, #0d9488); color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: 900; overflow: hidden; border: 2px solid #0d9488; flex-shrink: 0;">
              ${
                staffData.profileImage
                  ? `<img src="${staffData.profileImage}" style="width:100%; height:100%; object-fit:cover;">`
                  : initials
              }
            </div>
            <div style="flex: 1;">
              <div style="font-weight: 800; font-size: 0.86rem; color: #0f172a; margin-bottom: 6px;">រូបថតសម្គាល់ខ្លួនបុគ្គលិក (Staff Profile Photo)</div>
              <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
                <label style="background: #0d9488; color: #ffffff; padding: 6px 12px; border-radius: 8px; font-size: 0.76rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
                  <i class="fa-solid fa-cloud-arrow-up" id="s360-upload-icon"></i>
                  <span id="s360-upload-text">បង្ហោះរូបថត (Cloudinary)</span>
                  <input type="file" accept="image/*" style="display: none;" onchange="uploadStaffPhotoToCloudinary(this)">
                </label>
                <input type="text" id="s360-profile-url" value="${staffData.profileImage}" placeholder="ឬបិទភ្ជាប់ Link រូបភាពនៅទីនេះ..." oninput="previewStaffPhotoFromUrl(this.value)" style="flex: 1; min-width: 160px; height: 32px; padding: 0 10px; border-radius: 8px; border: 1px solid #cbd5e1; font-size: 0.76rem; outline: none;">
              </div>
            </div>
          </div>

          <!-- ប្រអប់បំពេញព័ត៌មានបុគ្គលិក -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div>
              <label style="font-size: 0.78rem; font-weight: 800; color: #475569; display: block; margin-bottom: 4px;">លេខសម្គាល់បុគ្គលិក (Staff ID)</label>
              <input type="text" id="s360-staffId" value="${staffData.staffId}" readonly style="width: 100%; height: 40px; padding: 0 12px; border-radius: 10px; border: 1px solid #cbd5e1; background: #f1f5f9; color: #0d9488; font-family: 'JetBrains Mono', monospace; font-weight: 900; box-sizing: border-box;">
            </div>
            <div>
              <label style="font-size: 0.78rem; font-weight: 800; color: #475569; display: block; margin-bottom: 4px;">នាយកដ្ឋាន / សាខា (Department)</label>
              <select id="s360-dept" style="width: 100%; height: 40px; padding: 0 10px; border-radius: 10px; border: 1px solid #cbd5e1; font-weight: 700; font-size: 0.85rem; box-sizing: border-box; outline: none;">
                <option value="Head Office" ${staffData.department === "Head Office" ? "selected" : ""}>ទីស្នាក់ការកណ្តាល (Head Office)</option>
                <option value="Customer Support (CS)" ${staffData.department === "Customer Support (CS)" ? "selected" : ""}>ផ្នែកបម្រើអតិថិជន (Customer Support)</option>
                <option value="Finance & Treasury" ${staffData.department === "Finance & Treasury" ? "selected" : ""}>ផ្នែកហិរញ្ញវត្ថុ & បេឡា (Finance & Treasury)</option>
                <option value="KYC & Compliance" ${staffData.department === "KYC & Compliance" ? "selected" : ""}>ផ្នែកត្រួតពិនិត្យ KYC & សុវត្ថិភាព</option>
                <option value="IT & Core Banking" ${staffData.department === "IT & Core Banking" ? "selected" : ""}>ផ្នែកបច្ចេកវិទ្យា (IT & Core Banking)</option>
              </select>
            </div>

            <div>
              <label style="font-size: 0.78rem; font-weight: 800; color: #475569; display: block; margin-bottom: 4px;">ឈ្មោះពេញផ្លូវការ (Full Name) <span style="color:#ef4444;">*</span></label>
              <input type="text" id="s360-fullName" value="${staffData.fullName}" placeholder="ឧ. SAN SOK" style="width: 100%; height: 40px; padding: 0 12px; border-radius: 10px; border: 1.5px solid #cbd5e1; font-weight: 800; text-transform: uppercase; box-sizing: border-box; outline: none;">
            </div>
            <div>
              <label style="font-size: 0.78rem; font-weight: 800; color: #475569; display: block; margin-bottom: 4px;">ឈ្មោះហៅក្រៅ (Nickname)</label>
              <input type="text" id="s360-nickname" value="${staffData.nickname}" placeholder="ឧ. SOK123" style="width: 100%; height: 40px; padding: 0 12px; border-radius: 10px; border: 1px solid #cbd5e1; font-weight: 700; box-sizing: border-box; outline: none;">
            </div>

            <div>
              <label style="font-size: 0.78rem; font-weight: 800; color: #475569; display: block; margin-bottom: 4px;">ឈ្មោះគណនីចូលប្រព័ន្ធ (Username) <span style="color:#ef4444;">*</span></label>
              <input type="text" id="s360-username" value="${staffData.username}" placeholder="ឧ. admin_sok" style="width: 100%; height: 40px; padding: 0 12px; border-radius: 10px; border: 1.5px solid #cbd5e1; font-weight: 800; box-sizing: border-box; outline: none;">
            </div>
            <div>
              <label style="font-size: 0.78rem; font-weight: 800; color: #475569; display: block; margin-bottom: 4px;">ពាក្យសម្ងាត់ ${isEdit ? "(ទុកទទេបើមិនប្តូរ)" : "<span style='color:#ef4444;'>*</span>"}</label>
              <input type="password" id="s360-password" placeholder="${isEdit ? "•••••••• (មិនផ្លាស់ប្តូរ)" : "បញ្ចូលពាក្យសម្ងាត់ថ្មី..."}" style="width: 100%; height: 40px; padding: 0 12px; border-radius: 10px; border: 1.5px solid #cbd5e1; font-weight: 800; box-sizing: border-box; outline: none;">
            </div>

            <div>
              <label style="font-size: 0.78rem; font-weight: 800; color: #475569; display: block; margin-bottom: 4px;">លេខទូរស័ព្ទ (Phone Number)</label>
              <input type="text" id="s360-phone" value="${staffData.phone}" placeholder="ឧ. 012 345 678" style="width: 100%; height: 40px; padding: 0 12px; border-radius: 10px; border: 1px solid #cbd5e1; font-weight: 700; box-sizing: border-box; outline: none;">
            </div>
            <div>
              <label style="font-size: 0.78rem; font-weight: 800; color: #475569; display: block; margin-bottom: 4px;">អ៊ីមែល (Email Address)</label>
              <input type="email" id="s360-email" value="${staffData.email}" placeholder="ឧ. staff@upay.com" style="width: 100%; height: 40px; padding: 0 12px; border-radius: 10px; border: 1px solid #cbd5e1; font-weight: 700; box-sizing: border-box; outline: none;">
            </div>

            <div style="grid-column: 1 / -1;">
              <label style="font-size: 0.78rem; font-weight: 800; color: #475569; display: block; margin-bottom: 4px;">កំណត់ចំណាំសម្គាល់ (Admin Remarks)</label>
              <input type="text" id="s360-remarks" value="${staffData.remarks}" placeholder="បញ្ជាក់ភារកិច្ច ឬចំណាំបន្ថែម..." style="width: 100%; height: 40px; padding: 0 12px; border-radius: 10px; border: 1px solid #cbd5e1; font-weight: 600; box-sizing: border-box; outline: none;">
            </div>
          </div>
        </div>

        <!-- ==========================================
             TAB 2: តួនាទី, ម៉ោងធ្វើការ, សិទ្ធិម៉ឺនុយ & កាត NFC
             ========================================== -->
        <div id="s360-pane-perms" style="display: none;">
          <div style="display: grid; grid-template-columns: 1.2fr 1fr 1fr; gap: 10px; margin-bottom: 12px;">
            <div>
              <label style="font-size: 0.76rem; font-weight: 800; color: #475569; display: block; margin-bottom: 4px;">តួនាទីគោល (System Role)</label>
              <select id="s360-role" onchange="onStaff360RoleChange(this.value)" style="width: 100%; height: 40px; padding: 0 10px; border-radius: 10px; border: 1.5px solid #0d9488; font-weight: 800; font-size: 0.84rem; outline: none;">
                <option value="support_agent" ${staffData.role === "support_agent" ? "selected" : ""}>🎧 Support Agent</option>
                <option value="finance_admin" ${staffData.role === "finance_admin" ? "selected" : ""}>💰 Finance Admin</option>
                <option value="super_admin" ${staffData.role === "super_admin" ? "selected" : ""}>👑 Super Admin</option>
                <option value="custom" ${staffData.role === "custom" ? "selected" : ""}>⚙️ Custom Role (កំណត់เอง)</option>
              </select>
            </div>
            <div>
              <label style="font-size: 0.76rem; font-weight: 800; color: #475569; display: block; margin-bottom: 4px;">ម៉ោងចូលធ្វើការ (Start)</label>
              <input type="time" id="s360-workStart" value="${staffData.workStart}" style="width: 100%; height: 40px; padding: 0 10px; border-radius: 10px; border: 1px solid #cbd5e1; font-weight: 800; box-sizing: border-box;">
            </div>
            <div>
              <label style="font-size: 0.76rem; font-weight: 800; color: #475569; display: block; margin-bottom: 4px;">ម៉ោងចេញពីធ្វើការ (End)</label>
              <input type="time" id="s360-workEnd" value="${staffData.workEnd}" style="width: 100%; height: 40px; padding: 0 10px; border-radius: 10px; border: 1px solid #cbd5e1; font-weight: 800; box-sizing: border-box;">
            </div>
          </div>

          <div id="s360-custom-role-wrap" style="display: ${staffData.role === "custom" ? "block" : "none"}; margin-bottom: 12px;">
            <label style="font-size: 0.76rem; font-weight: 800; color: #7e22ce; display: block; margin-bottom: 4px;">ឈ្មោះតួនាទីពិសេស (Custom Role Title)</label>
            <input type="text" id="s360-customRoleName" value="${staffData.customRoleName}" placeholder="ឧ. ប្រធានផ្នែកត្រួតពិនិត្យ KYC..." style="width: 100%; height: 38px; padding: 0 12px; border-radius: 9px; border: 1.5px solid #c084fc; font-weight: 800; box-sizing: border-box;">
          </div>

          <!-- ប្រអប់កាត NFC ក្នុងផ្ទាំង 360 -->
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px 14px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap;">
            <div>
              <div style="font-size: 0.78rem; font-weight: 800; color: #0f172a;"><i class="fa-solid fa-wifi" style="color:#3b82f6;"></i> លេខកូដកាតសម្គាល់ខ្លួន NFC (Staff NFC UID)</div>
              <div style="font-size: 0.72rem; color: #64748b;">ផ្អឹបកាតលើម៉ាស៊ីន USB Scanner ឬវាយលេខកូដកាតផ្ទាល់</div>
            </div>
            <div style="display: flex; gap: 6px; align-items: center;">
              <input type="text" id="s360-nfcUid" value="${staffData.nfcUid}" placeholder="មិនទាន់ភ្ជាប់កាត..." style="width: 155px; height: 36px; padding: 0 10px; border-radius: 8px; border: 1px solid #cbd5e1; font-family: 'JetBrains Mono', monospace; font-weight: 800; font-size: 0.82rem; text-transform: uppercase; text-align: center;">
              <button type="button" onclick="document.getElementById('s360-nfcUid').value=''" title="ផ្តាច់កាត NFC" style="height: 36px; padding: 0 10px; border-radius: 8px; border: 1px solid #fecaca; background: #fef2f2; color: #ef4444; cursor: pointer; font-weight: 800; font-size: 0.75rem;">
                <i class="fa-solid fa-link-slash"></i> ផ្តាច់
              </button>
            </div>
          </div>

          <!-- ធីកជ្រើសរើសម៉ឺនុយទាំង ១២ -->
          <div style="margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <span style="font-size: 0.78rem; font-weight: 800; color: #475569;">សិទ្ធិមើលម៉ឺនុយ (ALLOWED MENUS)៖</span>
              <div style="display: flex; gap: 8px;">
                <span onclick="toggleAllStaff360Menus(true)" style="font-size: 0.72rem; color: #0d9488; font-weight: 800; cursor: pointer;">ធីកទាំងអស់</span>
                <span style="color:#cbd5e1;">|</span>
                <span onclick="toggleAllStaff360Menus(false)" style="font-size: 0.72rem; color: #ef4444; font-weight: 800; cursor: pointer;">ដកធីកទាំងអស់</span>
              </div>
            </div>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 7px;">
              ${menuItemsList
                .map(
                  (m) => `
                  <label style="display: flex; align-items: center; gap: 7px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 7px 9px; border-radius: 9px; font-size: 0.75rem; font-weight: 700; cursor: pointer;">
                    <input type="checkbox" class="s360-menu-chk" data-key="${m.key}" ${staffData.menus[m.key] ? "checked" : ""} style="accent-color: #0d9488; width: 15px; height: 15px;">
                    <i class="fa-solid ${m.icon}" style="color: #64748b; width: 14px;"></i>
                    <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${m.label}</span>
                  </label>
                `,
                )
                .join("")}
            </div>
          </div>

          <!-- ធីកជ្រើសរើសសិទ្ធិប្រតិបត្តិការពិសេសទាំង ៥ -->
          <div>
            <div style="font-size: 0.78rem; font-weight: 800; color: #475569; margin-bottom: 6px;">សិទ្ធិប្រតិបត្តិការជាន់ខ្ពស់ (CRITICAL ACTIONS)៖</div>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 7px;">
              ${actionItemsList
                .map(
                  (act) => `
                  <label style="display: flex; align-items: center; gap: 7px; background: #fffbeb; border: 1px solid #fde68a; padding: 7px 10px; border-radius: 9px; font-size: 0.76rem; font-weight: 800; color: ${act.color}; cursor: pointer;">
                    <input type="checkbox" class="s360-act-chk" data-key="${act.key}" ${staffData.actions[act.key] ? "checked" : ""} style="accent-color: ${act.color}; width: 15px; height: 15px;">
                    <span>${act.label}</span>
                  </label>
                `,
                )
                .join("")}
            </div>
          </div>
        </div>

        <!-- ==========================================
             TAB 3: ប្រវត្តិសកម្មភាពបុគ្គលិក (INDIVIDUAL AUDIT LOGS)
             ========================================== -->
        <div id="s360-pane-logs" style="display: none;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; gap: 10px; flex-wrap: wrap;">
            <span style="font-weight: 800; font-size: 0.88rem; color: #0f172a;">
              ប្រវត្តិសកម្មភាពសរុបរបស់ @${staffData.username} (${staffLogs.length} កំណត់ត្រា)
            </span>
            <button type="button" onclick="exportSingleStaffLogsCSV('${staffData.username}', getLogsForStaffUsername('${staffData.username}'))" style="background: #0d9488; color: #ffffff; border: none; padding: 6px 12px; border-radius: 8px; font-size: 0.76rem; font-weight: 800; cursor: pointer;">
              <i class="fa-solid fa-file-csv"></i> ទាញយក CSV
            </button>
          </div>
          <div style="max-height: 290px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
            <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.79rem;">
              <thead style="position: sticky; top: 0; background: #f1f5f9; color: #475569;">
                <tr>
                  <th style="padding: 8px;">កាលបរិច្ឆេទ</th>
                  <th style="padding: 8px;">សកម្មភាព</th>
                  <th style="padding: 8px;">គោលដៅ</th>
                  <th style="padding: 8px;">ព័ត៌មានលម្អិត</th>
                </tr>
              </thead>
              <tbody>
                ${
                  staffLogs.length === 0
                    ? `<tr><td colspan="4" style="text-align:center; padding:35px; color:#94a3b8; font-weight:700;">មិនទាន់មានប្រវត្តិសកម្មភាពនៅឡើយទេ</td></tr>`
                    : staffLogs
                        .slice(0, 80)
                        .map(
                          (l) => `
                          <tr style="border-bottom: 1px solid #f1f5f9;">
                            <td style="padding: 8px; font-family: monospace; color: #64748b; white-space: nowrap;">${l.date || "N/A"}</td>
                            <td style="padding: 8px; font-weight: 800; color: #0d9488;">${l.action || "-"}</td>
                            <td style="padding: 8px; font-weight: 800;">${l.target || "-"}</td>
                            <td style="padding: 8px; color: #475569;">${l.details || "-"}</td>
                          </tr>
                        `,
                        )
                        .join("")
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `,
    width: "760px",
    showCancelButton: true,
    confirmButtonText: `<i class="fa-solid fa-floppy-disk"></i> ${isEdit ? "រក្សាទុកការកែប្រែទាំងអស់" : "បង្កើតគណនីបុគ្គលិកឥឡូវនេះ"}`,
    cancelButtonText: "បោះបង់",
    confirmButtonColor: "#004d40",
    cancelButtonColor: "#64748b",
    customClass: { popup: "modal-radius kh-text aadm-swal-scope" },
    didOpen: () => {
      switchStaff360Tab(initialTab);
    },
    preConfirm: () => {
      const fullName = document.getElementById("s360-fullName")?.value.trim();
      const username = document.getElementById("s360-username")?.value.trim();
      const password = document.getElementById("s360-password")?.value;

      if (!fullName || !username) {
        switchStaff360Tab("profile");
        Swal.showValidationMessage(
          "សូមបំពេញ ឈ្មោះពេញ (Full Name) និង ឈ្មោះគណនី (Username)!",
        );
        return false;
      }
      if (!isEdit && (!password || password.trim() === "")) {
        switchStaff360Tab("profile");
        Swal.showValidationMessage(
          "សូមបញ្ចូលពាក្យសម្ងាត់សម្រាប់គណនីបុគ្គលិកថ្មី!",
        );
        return false;
      }

      const menus = {};
      document.querySelectorAll(".s360-menu-chk").forEach((chk) => {
        menus[chk.getAttribute("data-key")] = chk.checked;
      });

      const actions = {};
      document.querySelectorAll(".s360-act-chk").forEach((chk) => {
        actions[chk.getAttribute("data-key")] = chk.checked;
      });

      return {
        id: staffData.id,
        staffId:
          document.getElementById("s360-staffId")?.value || staffData.staffId,
        fullName: fullName.toUpperCase(),
        nickname: document.getElementById("s360-nickname")?.value.trim() || "",
        profileImage:
          document.getElementById("s360-profile-url")?.value.trim() || "",
        username,
        password: password || "",
        phone: document.getElementById("s360-phone")?.value.trim() || "",
        email: document.getElementById("s360-email")?.value.trim() || "",
        department:
          document.getElementById("s360-dept")?.value ||
          "Customer Support (CS)",
        remarks: document.getElementById("s360-remarks")?.value.trim() || "",
        nfcUid: normalizeUID(
          document.getElementById("s360-nfcUid")?.value || "",
        ),
        role: document.getElementById("s360-role")?.value || "support_agent",
        permissions: {
          customRoleName:
            document.getElementById("s360-customRoleName")?.value.trim() || "",
          workStart:
            document.getElementById("s360-workStart")?.value || "08:00",
          workEnd: document.getElementById("s360-workEnd")?.value || "17:00",
          menus,
          actions,
        },
      };
    },
  }).then(async (result) => {
    if (result.isConfirmed && result.value) {
      await executeSaveStaff360(result.value);
    }
  });
};

window.switchStaff360Tab = function (tabName) {
  ["profile", "perms", "logs"].forEach((t) => {
    const pane = document.getElementById(`s360-pane-${t}`);
    const btn = document.getElementById(`s360-tab-btn-${t}`);
    if (pane) pane.style.display = t === tabName ? "block" : "none";
    if (btn) {
      btn.style.background = t === tabName ? "#004d40" : "transparent";
      btn.style.color = t === tabName ? "#ffffff" : "#64748b";
    }
  });
};

window.onStaff360RoleChange = function (roleVal) {
  const wrap = document.getElementById("s360-custom-role-wrap");
  if (wrap) wrap.style.display = roleVal === "custom" ? "block" : "none";

  if (roleVal === "super_admin") {
    toggleAllStaff360Menus(true);
    document
      .querySelectorAll(".s360-act-chk")
      .forEach((c) => (c.checked = true));
  } else if (roleVal === "finance_admin") {
    const finMenus = ["users", "checktrx", "cashier", "fx", "cards", "promos"];
    document.querySelectorAll(".s360-menu-chk").forEach((c) => {
      c.checked = finMenus.includes(c.getAttribute("data-key"));
    });
  } else if (roleVal === "support_agent") {
    const supMenus = ["users", "checktrx", "kyc", "tickets", "chat"];
    document.querySelectorAll(".s360-menu-chk").forEach((c) => {
      c.checked = supMenus.includes(c.getAttribute("data-key"));
    });
    document
      .querySelectorAll(".s360-act-chk")
      .forEach((c) => (c.checked = false));
  }
};

window.toggleAllStaff360Menus = function (state) {
  document
    .querySelectorAll(".s360-menu-chk")
    .forEach((c) => (c.checked = Boolean(state)));
};

window.previewStaffPhotoFromUrl = function (url) {
  const box = document.getElementById("s360-avatar-preview-box");
  if (!box) return;
  if (url && url.trim() !== "") {
    box.innerHTML = `<img src="${url.trim()}" style="width:100%; height:100%; object-fit:cover;" onerror="this.outerHTML='ST'">`;
  } else {
    box.innerText = "ST";
  }
};

// ☁️ មុខងារបង្ហោះរូបថតបុគ្គលិកចូល Cloudinary ផ្ទាល់ (ដូចក្នុង settings.html ១០០%)
window.uploadStaffPhotoToCloudinary = async function (fileInput) {
  const file = fileInput?.files?.[0];
  if (!file) return;

  // ១. ឆែកទំហំរូបភាពមិនឱ្យលើស 3MB (ដូចក្នុង settings.html)
  if (file.size > 3 * 1024 * 1024) {
    Swal.showValidationMessage(
      "ទំហំរូបភាពធំពេក! សូមជ្រើសរើសរូបភាពដែលមានទំហំតូចជាង 3MB",
    );
    fileInput.value = "";
    return;
  }

  const iconEl = document.getElementById("s360-upload-icon");
  const txtEl = document.getElementById("s360-upload-text");
  if (iconEl) iconEl.className = "fa-solid fa-spinner fa-spin";
  if (txtEl) txtEl.innerText = "កំពុងបញ្ជូនរូបភាព...";

  const cloudinaryData = new FormData();
  cloudinaryData.append("file", file);
  cloudinaryData.append("upload_preset", STAFF_CLOUDINARY_UPLOAD_PRESET);

  try {
    const cloudRes = await fetch(
      `https://api.cloudinary.com/v1_1/${STAFF_CLOUDINARY_CLOUD_NAME}/image/upload`,
      {
        method: "POST",
        body: cloudinaryData,
      },
    );
    const cloudData = await cloudRes.json();

    if (cloudData && cloudData.secure_url) {
      const urlInp = document.getElementById("s360-profile-url");
      if (urlInp) urlInp.value = cloudData.secure_url;
      previewStaffPhotoFromUrl(cloudData.secure_url);

      if (iconEl) iconEl.className = "fa-solid fa-circle-check";
      if (txtEl) txtEl.innerText = "បង្ហោះរួចរាល់!";
    } else {
      throw new Error("មិនអាច Upload ទៅ Cloudinary បានទេ");
    }
  } catch (err) {
    if (iconEl) iconEl.className = "fa-solid fa-triangle-exclamation";
    if (txtEl) txtEl.innerText = "បរាជ័យ! សាកល្បងម្ដងទៀត";
    Swal.showValidationMessage(
      "មានបញ្ហាក្នុងការបង្ហោះរូបភាពទៅកាន់ Cloudinary!",
    );
  }

  fileInput.value = "";
};

async function executeSaveStaff360(payload) {
  Swal.fire({
    title: "កំពុងរក្សាទុកទិន្នន័យបុគ្គលិក...",
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading(),
    customClass: { popup: "kh-text" },
  });

  try {
    const res = await fetch("/api/admin/save-admin", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (data.success) {
      forceCloseLegacyAdminModal();
      await loadAdminList(false);
      Swal.fire({
        icon: "success",
        title: "ជោគជ័យ!",
        text: data.message,
        timer: 1600,
        showConfirmButton: false,
        customClass: { popup: "modal-radius kh-text aadm-swal-scope" },
      });
    } else {
      Swal.fire({
        icon: "error",
        title: "បរាជ័យ",
        text: data.message || "មិនអាចរក្សាទុកបានទេ",
        customClass: { popup: "modal-radius kh-text aadm-swal-scope" },
      });
    }
  } catch (err) {
    Swal.fire("Error", "មានបញ្ហាតភ្ជាប់ទៅកាន់ Server", "error");
  }
}

// រក្សាទុកអនុគមន៍ saveAdminAccount ការពារករណីមានការហៅពីប៊ូតុង HTML ចាស់
window.saveAdminAccount = async function () {
  const id = document.getElementById("manageAdminId")?.value || "";
  const role =
    document.getElementById("manageAdminRole")?.value || "support_agent";

  const payload = {
    id,
    staffId: document.getElementById("staffId")?.value || generateAutoStaffId(),
    username: document.getElementById("manageAdminUser")?.value || "",
    password: document.getElementById("manageAdminPass")?.value || "",
    fullName: (
      document.getElementById("adminFullName")?.value || ""
    ).toUpperCase(),
    nickname: document.getElementById("adminNickname")?.value || "",
    phone: document.getElementById("adminPhone")?.value || "",
    email: document.getElementById("adminEmail")?.value || "",
    department:
      document.getElementById("adminDept")?.value || "Customer Support (CS)",
    remarks: document.getElementById("adminRemarks")?.value || "",
    nfcUid: document.getElementById("adminNfcUid")?.value || "",
    role,
  };

  await executeSaveStaff360(payload);
};

// ========================================================================
// 🪪 SECTION 5: WORLD-CLASS BANK STAFF ID BADGE GENERATOR (កាតសម្គាល់ខ្លួនបុគ្គលិក)
// ========================================================================

window.openStaffIdCardModal = function (adminId) {
  const staff = globalAdminsData.find((a) => a._id === adminId);
  if (!staff) return;

  const roleMeta = getAdminRoleMeta(staff);
  const initials = String(staff.fullName || staff.username || "ST")
    .substring(0, 2)
    .toUpperCase();
  const staffIdCode = staff.staffId || "UPAY-888999";
  const hasNfc = Boolean(staff.nfcUid && String(staff.nfcUid).trim() !== "");

  const verifyQrData = `UPAY-STAFF:${staffIdCode}|USER:@${staff.username}|ROLE:${roleMeta.label}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(verifyQrData)}`;

  const avatarHtml =
    staff.profileImage && String(staff.profileImage).trim() !== ""
      ? `<img src="${staff.profileImage}" crossorigin="anonymous" style="width:100%; height:100%; object-fit:cover;">`
      : `<div style="width:100%; height:100%; background:#0f172a; color:#ffffff; display:flex; align-items:center; justify-content:center; font-size:2rem; font-weight:900;">${initials}</div>`;

  Swal.fire({
    title: `<span style="font-family:'Kantumruy Pro',sans-serif; font-size:1.15rem; font-weight:800;"><i class="fa-solid fa-id-badge" style="color:#0284c7;"></i> ប័ណ្ណសម្គាល់ខ្លួនបុគ្គលិកផ្លូវការ (Official Staff ID Card)</span>`,
    html: `
      <div style="display: flex; flex-direction: column; align-items: center; padding: 10px 0; font-family: 'Kantumruy Pro', 'Inter', sans-serif;">
        <!-- 🪪 តួកាតសម្គាល់ខ្លួនបុគ្គលិក (CR80 Vertical World-Class Badge) -->
        <div id="staffIdBadgeCapture" style="width: 315px; border-radius: 24px; overflow: hidden; background: #ffffff; box-shadow: 0 20px 45px rgba(15, 23, 42, 0.28); border: 1px solid #cbd5e1; position: relative; text-align: center; color: #0f172a;">
          
          <!-- ផ្នែកក្បាលកាត (Lanyard Slot + Holographic Mesh Header) -->
          <div style="background: ${roleMeta.cardGradient}; padding: 16px 20px 48px; position: relative; color: #ffffff;">
            <!-- រន្ធខ្សែคล้องក (Lanyard Punch Slot) -->
            <div style="width: 54px; height: 9px; background: rgba(15, 23, 42, 0.65); border-radius: 10px; margin: 0 auto 14px; border: 1px solid rgba(255, 255, 255, 0.25); box-shadow: inset 0 2px 4px rgba(0,0,0,0.5);"></div>

            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div style="text-align: left;">
                <div style="font-weight: 900; font-size: 1.05rem; letter-spacing: 1px; color: #ffffff;">U-PAY BANK</div>
                <div style="font-size: 0.64rem; color: ${roleMeta.accentHex}; font-weight: 800; letter-spacing: 0.8px;">OFFICIAL STAFF CREDENTIAL</div>
              </div>
              <!-- បន្ទះឈីបមាស & NFC Icon -->
              <div style="display: flex; align-items: center; gap: 7px;">
                <i class="fa-solid fa-wifi" style="transform: rotate(90deg); color: ${hasNfc ? "#34d399" : "rgba(255,255,255,0.4)"}; font-size: 0.95rem;"></i>
                <div style="width: 30px; height: 22px; border-radius: 5px; background: linear-gradient(135deg, #fbbf24, #d97706); border: 1px solid #fef08a; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"></div>
              </div>
            </div>
          </div>

          <!-- រូបថត Profile បុគ្គលិកចំកណ្តាល -->
          <div style="width: 92px; height: 92px; border-radius: 24px; margin: -46px auto 10px; overflow: hidden; border: 4px solid #ffffff; box-shadow: 0 8px 20px rgba(0, 0, 0, 0.18); position: relative; z-index: 2; background: #ffffff;">
            ${avatarHtml}
          </div>

          <!-- ឈ្មោះ និងតួនាទីបុគ្គលិក -->
          <div style="padding: 0 20px 18px;">
            <div style="font-weight: 900; font-size: 1.18rem; color: #0f172a; text-transform: uppercase; letter-spacing: 0.3px;">
              ${staff.fullName || staff.username}
            </div>
            <div style="font-size: 0.78rem; color: #0d9488; font-weight: 800; margin-top: 2px;">
              @${staff.username} ${staff.nickname ? `(${staff.nickname})` : ""}
            </div>

            <div style="margin-top: 8px;">
              <span style="background: ${roleMeta.bg}; color: ${roleMeta.color}; border: 1px solid ${roleMeta.border}; padding: 4px 12px; border-radius: 20px; font-size: 0.72rem; font-weight: 900; display: inline-flex; align-items: center; gap: 5px;">
                <i class="fa-solid ${roleMeta.icon}"></i> ${roleMeta.label}
              </span>
            </div>

            <!-- ប្រអប់ព័ត៌មានលម្អិតលើកាត -->
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 10px 12px; margin-top: 12px; text-align: left; font-size: 0.76rem; display: flex; flex-direction: column; gap: 6px;">
              <div style="display: flex; justify-content: space-between;">
                <span style="color: #64748b; font-weight: 700;">អត្តលេខ (ID)៖</span>
                <strong style="font-family: 'JetBrains Mono', monospace; color: #0f172a;">${staffIdCode}</strong>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="color: #64748b; font-weight: 700;">នាយកដ្ឋាន៖</span>
                <strong style="color: #0f172a;">${staff.department || "Head Office"}</strong>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="color: #64748b; font-weight: 700;">វេនធ្វើការ៖</span>
                <strong style="font-family: 'JetBrains Mono', monospace; color: #0d9488;">${staff.permissions?.workStart || "08:00"} - ${staff.permissions?.workEnd || "17:00"}</strong>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="color: #64748b; font-weight: 700;">ឈីប NFC៖</span>
                <strong style="font-family: 'JetBrains Mono', monospace; color: ${hasNfc ? "#10b981" : "#94a3b8"};">${hasNfc ? staff.nfcUid : "UNLINKED"}</strong>
              </div>
            </div>

            <!-- QR Code & ត្រាសុវត្ថិភាពធនាគារ -->
            <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 14px; padding-top: 12px; border-top: 1.5px dashed #e2e8f0;">
              <div style="text-align: left;">
                <div style="font-size: 0.65rem; font-weight: 900; color: #004d40; letter-spacing: 0.5px;">AUTHORIZED PERSONNEL</div>
                <div style="font-size: 0.62rem; color: #64748b; margin-top: 2px; line-height: 1.3;">
                  ប័ណ្ណនេះជាកម្មសិទ្ធិរបស់ធនាគារ U-Pay។<br>សូមស្កេន QR ដើម្បីផ្ទៀងផ្ទាត់សិទ្ធិ។
                </div>
                <div style="margin-top: 5px; font-size: 0.64rem; font-weight: 800; color: #10b981;">
                  ● STATUS: ${staff.isActive !== false ? "ACTIVE VERIFIED" : "SUSPENDED"}
                </div>
              </div>
              <img src="${qrUrl}" crossorigin="anonymous" style="width: 58px; height: 58px; border-radius: 8px; border: 1px solid #cbd5e1; padding: 3px; background: #ffffff;">
            </div>
          </div>

          <!-- បន្ទាត់ពណ៌ខាងក្រោមបង្អស់ -->
          <div style="height: 7px; background: ${roleMeta.cardGradient};"></div>
        </div>
      </div>
    `,
    width: "420px",
    showCancelButton: true,
    showDenyButton: true,
    confirmButtonText: '<i class="fa-solid fa-download"></i> ទាញយករូបកាត (PNG)',
    denyButtonText: '<i class="fa-solid fa-print"></i> បោះពុម្ពកាត (Print)',
    cancelButtonText: "បិទ",
    confirmButtonColor: "#004d40",
    denyButtonColor: "#0284c7",
    cancelButtonColor: "#64748b",
    customClass: { popup: "modal-radius kh-text aadm-swal-scope" },
    preConfirm: async () => {
      const cardEl = document.getElementById("staffIdBadgeCapture");
      if (cardEl && typeof html2canvas === "function") {
        const canvas = await html2canvas(cardEl, {
          scale: 3,
          useCORS: true,
          backgroundColor: null,
        });
        const link = document.createElement("a");
        link.download = `UPAY_Staff_ID_${staff.username}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
      } else {
        window.print();
      }
      return false; // រក្សាផ្ទាំងទុកកុំឱ្យបិទភ្លាម
    },
    preDeny: () => {
      const cardHtml = document.getElementById(
        "staffIdBadgeCapture",
      )?.outerHTML;
      if (cardHtml) {
        const win = window.open("", "_blank", "width=450,height=650");
        win.document.write(`
          <html>
            <head>
              <title>Print Staff ID - @${staff.username}</title>
              <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
              <link href="https://fonts.googleapis.com/css2?family=Kantumruy+Pro:wght@400;700;900&display=swap" rel="stylesheet">
              <style>body { display:flex; justify-content:center; align-items:center; min-height:95vh; margin:0; font-family:'Kantumruy Pro',sans-serif; -webkit-print-color-adjust:exact; print-color-adjust:exact; }</style>
            </head>
            <body>${cardHtml}<script>setTimeout(()=>{window.print(); window.close();}, 500);<\/script></body>
          </html>
        `);
        win.document.close();
      }
      return false;
    },
  });
};

// ========================================================================
// 📈 SECTION 6: STAFF PERFORMANCE REPORT, EXPORT CSV, RESET PASS & DELETE
// ========================================================================

window.openStaffPerformanceReportModal = function () {
  const summaryRows = globalAdminsData.map((a) => {
    const logs = getLogsForStaffUsername(a.username);
    let kycActions = 0;
    let financeActions = 0;
    let userCardActions = 0;

    logs.forEach((l) => {
      const act = String(l.action || "").toLowerCase();
      if (act.includes("kyc")) kycActions++;
      else if (
        act.includes("money") ||
        act.includes("cashier") ||
        act.includes("refund") ||
        act.includes("fx") ||
        act.includes("approve")
      ) {
        financeActions++;
      } else {
        userCardActions++;
      }
    });

    return {
      admin: a,
      total: logs.length,
      kycActions,
      financeActions,
      userCardActions,
      lastActDate: logs[0]?.date || "មិនទាន់មាន",
    };
  });

  summaryRows.sort((a, b) => b.total - a.total);

  const rowsHtml = summaryRows
    .map(
      (item, idx) => `
      <tr style="border-bottom: 1px solid #e2e8f0; font-size: 0.83rem;">
        <td style="padding: 10px 8px; font-weight: 900; color: #0d9488;">#${idx + 1}</td>
        <td style="padding: 10px 8px;">
          <div style="font-weight: 800; color: #0f172a;">${item.admin.fullName || item.admin.username}</div>
          <div style="font-size: 0.73rem; color: #64748b;">@${item.admin.username} • ${item.admin.staffId || "N/A"}</div>
        </td>
        <td style="padding: 10px 8px; text-align: center; font-weight: 800; color: #3b82f6;">${item.kycActions}</td>
        <td style="padding: 10px 8px; text-align: center; font-weight: 800; color: #10b981;">${item.financeActions}</td>
        <td style="padding: 10px 8px; text-align: center; font-weight: 800; color: #8b5cf6;">${item.userCardActions}</td>
        <td style="padding: 10px 8px; text-align: center;">
          <span style="background: #004d40; color: #ffffff; padding: 3px 10px; border-radius: 14px; font-weight: 900; font-family: monospace;">${item.total}</span>
        </td>
        <td style="padding: 10px 8px; font-size: 0.74rem; color: #64748b; font-family: monospace;">${item.lastActDate}</td>
      </tr>
    `,
    )
    .join("");

  Swal.fire({
    title: `<span style="font-family:'Kantumruy Pro',sans-serif; font-size:1.2rem; font-weight:800;"><i class="fa-solid fa-chart-pie" style="color:#8b5cf6;"></i> របាយការណ៍សកម្មភាព និងលទ្ធផលការងារបុគ្គលិក (Staff Audit Report)</span>`,
    html: `
      <div style="text-align: left; font-family: 'Kantumruy Pro', sans-serif; margin-top: 8px;">
        <p style="font-size: 0.84rem; color: #64748b; margin: 0 0 12px 0;">
          តារាងបូកសរុបចំនួនសកម្មភាពការងាររបស់បុគ្គលិកម្នាក់ៗ ដោយផ្អែកលើកំណត់ត្រា Audit Logs ពិតប្រាកដក្នុងប្រព័ន្ធ៖
        </p>
        <div style="max-height: 340px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 12px;">
          <table style="width: 100%; border-collapse: collapse; text-align: left;">
            <thead style="position: sticky; top: 0; background: #f1f5f9; font-size: 0.75rem; color: #475569;">
              <tr>
                <th style="padding: 10px 8px;">ល.រ</th>
                <th style="padding: 10px 8px;">ឈ្មោះបុគ្គលិក</th>
                <th style="padding: 10px 8px; text-align: center;">ការងារ KYC</th>
                <th style="padding: 10px 8px; text-align: center;">ហិរញ្ញវត្ថុ/បេឡា</th>
                <th style="padding: 10px 8px; text-align: center;">អតិថិជន/កាត/ហាង</th>
                <th style="padding: 10px 8px; text-align: center;">សរុប</th>
                <th style="padding: 10px 8px;">សកម្មភាពចុងក្រោយ</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>
      </div>
    `,
    width: "820px",
    showCancelButton: true,
    confirmButtonText:
      '<i class="fa-solid fa-file-csv"></i> ទាញយករបាយការណ៍រួម (CSV)',
    cancelButtonText: "បិទផ្ទាំង",
    confirmButtonColor: "#004d40",
    cancelButtonColor: "#64748b",
    customClass: { popup: "modal-radius kh-text aadm-swal-scope" },
  }).then((res) => {
    if (res.isConfirmed) {
      exportAdminStaffCSV();
    }
  });
};

function exportSingleStaffLogsCSV(username, logs) {
  if (!logs || logs.length === 0) {
    return Swal.fire(
      "គ្មានទិន្នន័យ",
      "បុគ្គលិកនេះមិនទាន់មានប្រវត្តិសកម្មភាពទេ!",
      "info",
    );
  }
  const headers = [
    "Date_Time",
    "Staff_Username",
    "Action",
    "Target",
    "Details",
  ];
  const rows = logs.map((l) => [
    `"${String(l.date || "").replace(/"/g, '""')}"`,
    `"${username}"`,
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
  a.download = `UPAY_Staff_Logs_${username}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

window.exportAdminStaffCSV = function () {
  if (!filteredAdminsData || filteredAdminsData.length === 0) {
    return Swal.fire(
      "គ្មានទិន្នន័យ",
      "មិនមានបញ្ជីបុគ្គលិកសម្រាប់ទាញយកទេ!",
      "info",
    );
  }
  const headers = [
    "Staff_ID",
    "Full_Name",
    "Username",
    "Role",
    "Department",
    "Phone",
    "Email",
    "Work_Shift",
    "NFC_UID",
    "Total_Audit_Actions",
    "Status",
  ];
  const rows = filteredAdminsData.map((a) => {
    const roleMeta = getAdminRoleMeta(a);
    const logsCount = getLogsForStaffUsername(a.username).length;
    return [
      `"${a.staffId || "N/A"}"`,
      `"${a.fullName || a.username}"`,
      `"${a.username}"`,
      `"${roleMeta.label}"`,
      `"${a.department || "General"}"`,
      `"${a.phone || ""}"`,
      `"${a.email || ""}"`,
      `"${a.permissions?.workStart || "00:00"} - ${a.permissions?.workEnd || "23:59"}"`,
      `"${a.nfcUid || "Unlinked"}"`,
      logsCount,
      `"${a.isActive !== false ? "ACTIVE" : "SUSPENDED"}"`,
    ];
  });
  const csvContent =
    "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `UPAY_Staff_Directory_Report_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

async function deleteAdminAcc(id) {
  const confirm = await Swal.fire({
    title: "លុបគណនីបុគ្គលិកនេះ?",
    text: "គណនីនេះនឹងត្រូវលុបចេញពីប្រព័ន្ធជារៀងរហូត!",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#ef4444",
    cancelButtonColor: "#94a3b8",
    confirmButtonText: "បាទ/ចាស លុប",
    cancelButtonText: "បោះបង់",
  });
  if (confirm.isConfirmed) {
    try {
      const res = await fetch("/api/admin/delete-admin", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.success) {
        Swal.fire("លុបរួចរាល់", "", "success");
        loadAdminList();
      } else Swal.fire("បរាជ័យ", data.message, "error");
    } catch (e) {
      Swal.fire("Error", "Server Error", "error");
    }
  }
}

async function promptResetAdminPassword(adminId, username) {
  const { value: newPassword } = await Swal.fire({
    title: `<span style="font-family: 'Kantumruy Pro', sans-serif;">Reset Password ជូន @${username}</span>`,
    input: "text",
    inputLabel: "សូមបញ្ចូលពាក្យសម្ងាត់ថ្មី (New Password)",
    inputPlaceholder: "ឧ. 1234 ឬ admin123...",
    showCancelButton: true,
    confirmButtonText:
      "<span style=\"font-family: 'Kantumruy Pro', sans-serif;\">ប្តូរពាក្យសម្ងាត់</span>",
    cancelButtonText:
      "<span style=\"font-family: 'Kantumruy Pro', sans-serif;\">បោះបង់</span>",
    confirmButtonColor: "#10b981",
    cancelButtonColor: "#64748b",
    customClass: { popup: "premium-swal" },
    inputValidator: (value) => {
      if (!value || value.trim() === "") return "សូមបញ្ចូលពាក្យសម្ងាត់ថ្មី!";
    },
  });

  if (newPassword) {
    executeResetAdminPassword(adminId, newPassword.trim());
  }
}

async function executeResetAdminPassword(adminId, newPassword) {
  try {
    Swal.fire({
      title: "កំពុងដំណើរការ...",
      didOpen: () => Swal.showLoading(),
      customClass: { popup: "premium-swal" },
    });

    const res = await fetch("/api/admin/reset-admin-password", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ adminId, newPassword }),
    });
    const data = await res.json();

    if (data.success) {
      Swal.fire({
        title: "ជោគជ័យ!",
        text: data.message,
        icon: "success",
        confirmButtonColor: "#10b981",
        customClass: { popup: "premium-swal" },
      });
      loadAdminList();
    } else {
      Swal.fire({
        title: "បរាជ័យ",
        text: data.message,
        icon: "error",
        confirmButtonColor: "#ef4444",
        customClass: { popup: "premium-swal" },
      });
    }
  } catch (err) {
    Swal.fire("Error", "មានបញ្ហាតភ្ជាប់ទៅកាន់ Server", "error");
  }
}

async function toggleAdminStatusAccount(adminId) {
  try {
    const res = await fetch("/api/admin/toggle-admin-status", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ adminId }),
    });
    const data = await res.json();

    if (data.success) {
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: data.message,
        showConfirmButton: false,
        timer: 2000,
      });
      if (typeof loadData === "function") loadData();
      loadAdminList();
    } else {
      Swal.fire("បរាជ័យ", data.message, "error");
      loadAdminList();
    }
  } catch (err) {
    Swal.fire("Error", "មានបញ្ហាតភ្ជាប់ទៅកាន់ Server", "error");
    loadAdminList();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.body.addEventListener("click", (e) => {
    const navItem = e.target.closest(
      "[onclick*='sec-admins'], [data-target*='sec-admins']",
    );
    if (navItem) {
      setTimeout(() => loadAdminList(false), 100);
    }
  });
});
