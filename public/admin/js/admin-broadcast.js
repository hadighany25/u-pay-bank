// ========================================================================
// ឯកសារ: admin-broadcast.js (100% Pro Redesign - Push Notification Center)
// អត្ថន័យ: ផ្ញើសារជូនដំណឹងជាប្រព័ន្ធ (Broadcast Messages), Live Preview, Templates & Pagination
// ========================================================================

let allBroadcastList = [];
let filteredBroadcastList = [];
let currentBroadcastPage = 1;
const BROADCAST_PER_PAGE = 6; // បង្ហាញ ៦ សារក្នុង ១ ទំព័រ
let abroadCurrentCatFilter = "ALL"; // 'ALL', 'TODAY', 'PROMO', 'SYSTEM', 'SECURITY', 'GENERAL'

// 🔍 ១. ចំណាត់ថ្នាក់ប្រភេទសារដោយស្វ័យប្រវត្តិ (Smart Broadcast Classifier)
function classifyBroadcastItem(title = "", message = "") {
  const combined = `${title} ${message}`.toLowerCase();

  if (
    combined.includes("promo") ||
    combined.includes("reward") ||
    combined.includes("bonus") ||
    combined.includes("ប្រូម៉ូសិន") ||
    combined.includes("រង្វាន់") ||
    combined.includes("បញ្ចុះតម្លៃ") ||
    combined.includes("កូដ")
  ) {
    return {
      key: "PROMO",
      badgeClass: "abroad-cat-promo",
      icon: "fa-gift",
      label: "ប្រូម៉ូសិន & រង្វាន់",
      color: "#8b5cf6",
    };
  }

  if (
    combined.includes("maintenance") ||
    combined.includes("system") ||
    combined.includes("update") ||
    combined.includes("server") ||
    combined.includes("ថែទាំ") ||
    combined.includes("ប្រព័ន្ធ") ||
    combined.includes("អាប់ដេត")
  ) {
    return {
      key: "SYSTEM",
      badgeClass: "abroad-cat-system",
      icon: "fa-screwdriver-wrench",
      label: "ថែទាំប្រព័ន្ធ",
      color: "#f59e0b",
    };
  }

  if (
    combined.includes("security") ||
    combined.includes("alert") ||
    combined.includes("warning") ||
    combined.includes("otp") ||
    combined.includes("pin") ||
    combined.includes("សុវត្ថិភាព") ||
    combined.includes("ប្រុងប្រយ័ត្ន") ||
    combined.includes("បន្ទាន់")
  ) {
    return {
      key: "SECURITY",
      badgeClass: "abroad-cat-security",
      icon: "fa-shield-halved",
      label: "សុវត្ថិភាព & បន្ទាន់",
      color: "#ef4444",
    };
  }

  return {
    key: "GENERAL",
    badgeClass: "abroad-cat-general",
    icon: "fa-bullhorn",
    label: "ដំណឹងទូទៅ",
    color: "#3b82f6",
  };
}

// 🔍 ២. ឆែកថាតើសារនោះត្រូវបានផ្ញើក្នុងថ្ងៃនេះឬអត់
function isBroadcastFromToday(dateStr = "") {
  if (!dateStr) return false;
  try {
    const today = new Date();
    const m = today.getMonth() + 1;
    const d = today.getDate();
    const y = today.getFullYear();

    const str = String(dateStr);
    const usFormat = `${m}/${d}/${y}`;
    const padFormat = `${String(m).padStart(2, "0")}/${String(d).padStart(2, "0")}/${y}`;
    const isoFormat = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    return (
      str.includes(usFormat) ||
      str.includes(padFormat) ||
      str.includes(isoFormat)
    );
  } catch (e) {
    return false;
  }
}

// ========================================================================
// 🚀 SECTION 2: PRO BROADCAST COMPOSER (Quick Templates + Live Preview)
// ========================================================================

window.applyBroadcastTemplate = function (type) {
  const titleEl = document.getElementById("swal-bc-title");
  const msgEl = document.getElementById("swal-bc-msg");
  if (!titleEl || !msgEl) return;

  if (type === "maintenance") {
    titleEl.value = "🛠️ ដំណឹងថែទាំប្រព័ន្ធធនាគារ (System Maintenance)";
    msgEl.value =
      "សូមគោរពជូនដំណឹងដល់អតិថិជន U-Pay ទាំងអស់៖ ប្រព័ន្ធនឹងធ្វើការអាប់ដេតមុខងារថ្មីនៅយប់នេះ ចាប់ពីម៉ោង 12:00 AM ដល់ 01:00 AM។ សូមអភ័យទោសចំពោះការរំខាន!";
  } else if (type === "promo") {
    titleEl.value = "🎁 កម្មវិធីចែករង្វាន់ពិសេសពីធនាគារ U-Pay!";
    msgEl.value =
      "អបអរសាទរ! គ្រាន់តែបញ្ចូលកូដប្រូម៉ូសិនពិសេសនៅក្នុងកម្មវិធី U-Pay ថ្ងៃនេះ លោកអ្នកនឹងទទួលបានទឹកប្រាក់រង្វាន់ភ្លាមៗចូលក្នុងគណនី USD របស់អ្នក!";
  } else if (type === "security") {
    titleEl.value = "🛡️ សារក្រើនរំលឹកអំពីសុវត្ថិភាពគណនី (Security Alert)";
    msgEl.value =
      "ដើម្បីសុវត្ថិភាពទឹកប្រាក់របស់លោកអ្នក សូមមេត្តាកុំប្រាប់លេខកូដសម្ងាត់ (Password), លេខ PIN ៤ខ្ទង់ ឬលេខកូដ OTP ទៅកាន់ជនណាម្នាក់ឱ្យសោះ។ បុគ្គលិកធនាគារមិនដែលសួររកលេខសម្ងាត់ឡើយ!";
  } else if (type === "feature") {
    titleEl.value = "✨ មុខងារថ្មីត្រូវបានដាក់ឱ្យប្រើប្រាស់ហើយ!";
    msgEl.value =
      "ឥឡូវនេះ លោកអ្នកអាចប្រើប្រាស់មុខងារកាតនិម្មិត (Virtual Card), កាតរូបវ័ន្ត NFC និងការផ្ទៀងផ្ទាត់អត្តសញ្ញាណដោយ AI កាន់តែរហ័សទាន់ចិត្តនៅក្នុង U-Pay!";
  }
  updateBroadcastLivePreview();
};

window.updateBroadcastLivePreview = function () {
  const titleVal =
    document.getElementById("swal-bc-title")?.value.trim() ||
    "ចំណងជើងសារជូនដំណឹង...";
  const msgVal =
    document.getElementById("swal-bc-msg")?.value.trim() ||
    "ខ្លឹមសារសារជូនដំណឹងរបស់អ្នកនឹងបង្ហាញនៅទីនេះដូចគ្នានឹងអេក្រង់ទូរស័ព្ទរបស់អតិថិជន...";

  const prevTitle = document.getElementById("swal-bc-preview-title");
  const prevMsg = document.getElementById("swal-bc-preview-msg");
  if (prevTitle) prevTitle.innerText = titleVal;
  if (prevMsg) prevMsg.innerText = msgVal;
};

window.sendBroadcast = async function (prefillTitle = "", prefillMsg = "") {
  const activeSender =
    (typeof c360GetActiveAdminIdentity === "function"
      ? c360GetActiveAdminIdentity().username
      : "") || "admin";

  const { value: formValues } = await Swal.fire({
    title: `<span style="font-family:'Kantumruy Pro',sans-serif; font-size:1.22rem; font-weight:800; color:var(--text-main,#0f172a);"><i class="fa-solid fa-bullhorn" style="color:#0d9488;"></i> បញ្ជូនសារជូនដំណឹងទូទាំងប្រព័ន្ធ (New Broadcast)</span>`,
    html: `
      <div style="text-align: left; font-family: 'Kantumruy Pro', sans-serif; display: flex; flex-direction: column; gap: 12px; margin-top: 6px;">
        <!-- គំរូសាររហ័ស (Quick Templates) -->
        <div>
          <label style="font-size: 0.76rem; font-weight: 800; color: #64748b; display: block; margin-bottom: 6px;">ជ្រើសរើសគំរូសាររហ័ស (QUICK TEMPLATES)៖</label>
          <div style="display: flex; gap: 6px; flex-wrap: wrap;">
            <span onclick="applyBroadcastTemplate('promo')" style="font-size:0.74rem; background:#f3e8ff; color:#7e22ce; border:1px solid #d8b4fe; padding:4px 10px; border-radius:8px; cursor:pointer; font-weight:800;"><i class="fa-solid fa-gift"></i> ប្រូម៉ូសិនរង្វាន់</span>
            <span onclick="applyBroadcastTemplate('maintenance')" style="font-size:0.74rem; background:#fef3c7; color:#b45309; border:1px solid #fde68a; padding:4px 10px; border-radius:8px; cursor:pointer; font-weight:800;"><i class="fa-solid fa-screwdriver-wrench"></i> ថែទាំប្រព័ន្ធ</span>
            <span onclick="applyBroadcastTemplate('security')" style="font-size:0.74rem; background:#fee2e2; color:#dc2626; border:1px solid #fecaca; padding:4px 10px; border-radius:8px; cursor:pointer; font-weight:800;"><i class="fa-solid fa-shield-halved"></i> សុវត្ថិភាពគណនី</span>
            <span onclick="applyBroadcastTemplate('feature')" style="font-size:0.74rem; background:#e0f2fe; color:#0284c7; border:1px solid #bae6fd; padding:4px 10px; border-radius:8px; cursor:pointer; font-weight:800;"><i class="fa-solid fa-wand-magic-sparkles"></i> មុខងារថ្មី</span>
          </div>
        </div>

        <!-- ចំណងជើងសារ -->
        <div>
          <label style="font-size: 0.8rem; font-weight: 800; color: #475569; display: block; margin-bottom: 5px;">១. ចំណងជើងសារជូនដំណឹង (Notification Title) <span style="color:#ef4444;">*</span></label>
          <input id="swal-bc-title" type="text" value="${prefillTitle.replace(/"/g, "&quot;")}" placeholder="ឧ. ដំណឹងថែទាំប្រព័ន្ធ ឬ កម្មវិធីចែករង្វាន់ពិសេស..." oninput="updateBroadcastLivePreview()" style="width: 100%; height: 42px; padding: 0 14px; border-radius: 10px; border: 1.5px solid #cbd5e1; font-size: 0.92rem; font-weight: 800; outline: none; box-sizing: border-box;">
        </div>

        <!-- ខ្លឹមសារសារ -->
        <div>
          <label style="font-size: 0.8rem; font-weight: 800; color: #475569; display: block; margin-bottom: 5px;">២. ខ្លឹមសារសារលម្អិត (Message Content) <span style="color:#ef4444;">*</span></label>
          <textarea id="swal-bc-msg" rows="4" placeholder="សរសេរខ្លឹមសារសារជូនដំណឹងទៅកាន់អតិថិជនទាំងអស់នៅទីនេះ..." oninput="updateBroadcastLivePreview()" style="width: 100%; padding: 12px 14px; border-radius: 10px; border: 1.5px solid #cbd5e1; font-size: 0.9rem; font-weight: 600; outline: none; box-sizing: border-box; resize: vertical; line-height: 1.5;">${prefillMsg}</textarea>
        </div>

        <!-- Live Mobile Push Preview -->
        <div style="background: #0f172a; border-radius: 14px; padding: 12px 15px; border: 1px solid #334155; color: #f8fafc;">
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.7rem; color: #94a3b8; margin-bottom: 6px; font-weight: 700;">
            <span><i class="fa-solid fa-mobile-screen-button" style="color:#10b981;"></i> រូបរាងបង្ហាញលើទូរស័ព្ទអតិថិជន (LIVE PREVIEW)</span>
            <span>ឥឡូវនេះ • U-PAY</span>
          </div>
          <div id="swal-bc-preview-title" style="font-weight: 800; font-size: 0.9rem; color: #34d399; margin-bottom: 3px;">
            ${prefillTitle || "ចំណងជើងសារជូនដំណឹង..."}
          </div>
          <div id="swal-bc-preview-msg" style="font-size: 0.8rem; color: #e2e8f0; line-height: 1.45; word-break: break-word;">
            ${prefillMsg || "ខ្លឹមសារសារជូនដំណឹងរបស់អ្នកនឹងបង្ហាញនៅទីនេះដូចគ្នានឹងអេក្រង់ទូរស័ព្ទរបស់អតិថិជន..."}
          </div>
        </div>
      </div>
    `,
    width: "540px",
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText:
      '<i class="fa-solid fa-paper-plane"></i> បញ្ជូនទៅគ្រប់អតិថិជនទាំងអស់',
    cancelButtonText: "បោះបង់",
    confirmButtonColor: "#004d40",
    cancelButtonColor: "#64748b",
    customClass: { popup: "modal-radius kh-text abroad-swal-scope" },
    preConfirm: () => {
      const title = document.getElementById("swal-bc-title").value.trim();
      const msg = document.getElementById("swal-bc-msg").value.trim();
      if (!title || !msg) {
        Swal.showValidationMessage(
          "សូមបំពេញទាំងចំណងជើង និងខ្លឹមសារសារជូនដំណឹង!",
        );
        return false;
      }
      return { title, message: msg, sender: activeSender };
    },
  });

  if (formValues && formValues.title && formValues.message) {
    Swal.fire({
      title: "កំពុងបញ្ជូនសារទៅគ្រប់គណនី...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
      customClass: { popup: "premium-swal kh-text abroad-swal-scope" },
    });

    try {
      const res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(formValues),
      });
      const data = await res.json();
      if (data.success) {
        await loadBroadcastHistory();
        Swal.fire({
          icon: "success",
          title: "បញ្ជូនសារជោគជ័យ! 🎉",
          text: `សារជូនដំណឹងត្រូវបានបញ្ជូនទៅកាន់គណនីអតិថិជនចំនួន ${data.count || 0} គណនីរួចរាល់។`,
          timer: 2200,
          showConfirmButton: false,
          customClass: { popup: "premium-swal kh-text abroad-swal-scope" },
        });
      } else {
        Swal.fire({
          icon: "error",
          title: "បរាជ័យ",
          text: data.message || "មិនអាចបញ្ជូនសារ Broadcast បានទេ!",
          customClass: { popup: "premium-swal kh-text abroad-swal-scope" },
        });
      }
    } catch (error) {
      Swal.fire("Error!", "មានបញ្ហាតភ្ជាប់ទៅកាន់ Server", "error");
    }
  }
};

// ========================================================================
// 🔄 SECTION 3: LOAD HISTORY, KPI STATS & FILTERING
// ========================================================================

window.loadBroadcastHistory = async function (showToast = false) {
  const spinIcon = document.getElementById("abroad-refresh-icon");
  if (spinIcon) spinIcon.classList.add("fa-spin");

  try {
    const res = await fetch("/api/admin/broadcast-history", {
      headers: getAuthHeaders(),
    });
    const data = await res.json();

    if (data.success && Array.isArray(data.broadcasts)) {
      allBroadcastList = data.broadcasts;
    } else {
      allBroadcastList = [];
    }

    updateBroadcastKpiStats();
    filterBroadcastHistory();

    if (showToast) {
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "ប្រវត្តិសារ Broadcast ត្រូវបានធ្វើបច្ចុប្បន្នភាព!",
        showConfirmButton: false,
        timer: 1300,
        customClass: { popup: "kh-text" },
      });
    }
  } catch (error) {
    console.error("Error loading broadcast history:", error);
    const list = document.getElementById("broadcastList");
    if (list) {
      list.innerHTML =
        '<tr><td colspan="5" style="text-align: center; padding: 40px; color: #ef4444; font-weight: 800;">មានបញ្ហាក្នុងការទាញយកទិន្នន័យពី Server</td></tr>';
    }
  } finally {
    if (spinIcon) spinIcon.classList.remove("fa-spin");
  }
};

function updateBroadcastKpiStats() {
  let todayCount = 0;
  let promoCount = 0;
  let systemCount = 0;
  let securityCount = 0;

  allBroadcastList.forEach((n) => {
    if (isBroadcastFromToday(n.date)) todayCount++;
    const cat = classifyBroadcastItem(n.title, n.message);
    if (cat.key === "PROMO") promoCount++;
    else if (cat.key === "SYSTEM") systemCount++;
    else if (cat.key === "SECURITY") securityCount++;
  });

  const setTxt = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.innerText = val;
  };
  setTxt("abroad-stat-total", allBroadcastList.length);
  setTxt("abroad-stat-today", todayCount);
  setTxt("abroad-stat-promo", promoCount);
  setTxt("abroad-stat-system", systemCount);
  setTxt("abroad-stat-security", securityCount);
}

window.abroadSetCategoryFilter = function (catKey) {
  abroadCurrentCatFilter = catKey;
  currentBroadcastPage = 1;

  document.querySelectorAll(".abroad-filter-pill").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-cat") === catKey);
  });

  document.querySelectorAll(".abroad-kpi-card").forEach((card) => {
    card.classList.remove("active-kpi");
  });
  const activeKpi = document.getElementById(`abroad-kpi-${catKey}`);
  if (activeKpi) activeKpi.classList.add("active-kpi");

  filterBroadcastHistory();
};

window.filterBroadcastHistory = function () {
  const keyword = (document.getElementById("searchBroadcastBox")?.value || "")
    .toLowerCase()
    .trim();

  filteredBroadcastList = allBroadcastList.filter((n) => {
    const cat = classifyBroadcastItem(n.title, n.message);

    if (abroadCurrentCatFilter === "TODAY" && !isBroadcastFromToday(n.date)) {
      return false;
    }
    if (
      ["PROMO", "SYSTEM", "SECURITY", "GENERAL"].includes(
        abroadCurrentCatFilter,
      ) &&
      cat.key !== abroadCurrentCatFilter
    ) {
      return false;
    }

    if (keyword) {
      const searchStr =
        `${n.title || ""} ${n.message || ""} ${n.sender || ""} ${n.date || ""}`.toLowerCase();
      return searchStr.includes(keyword);
    }
    return true;
  });

  currentBroadcastPage = 1;
  renderBroadcastTable();
};

// ========================================================================
// 📋 SECTION 4: TABLE RENDERING & PAGINATION
// ========================================================================

function renderBroadcastTable() {
  const tbody = document.getElementById("broadcastList");
  if (!tbody) return;

  if (!filteredBroadcastList || filteredBroadcastList.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 55px 20px; color: var(--text-muted);">
          <i class="fa-solid fa-bullhorn" style="font-size: 3rem; opacity: 0.3; margin-bottom: 12px; display: block;"></i>
          <div style="font-weight: 800; font-size: 1rem; color: var(--text-main);">គ្មានប្រវត្តិសារជូនដំណឹង Broadcast ក្នុងផ្នែកនេះទេ</div>
          <div style="font-size: 0.85rem; margin-top: 4px;">សូមចុចប៊ូតុង "ផ្ញើសារ Broadcast ថ្មី" ខាងលើ ដើម្បីបញ្ជូនដំណឹងទៅកាន់អតិថិជន។</div>
        </td>
      </tr>
    `;
    document.getElementById("broadcastPageInfo").innerText =
      "ទំព័រ 1 នៃ 1 (0 សារ)";
    document.getElementById("btnPrevBroadcast").disabled = true;
    document.getElementById("btnNextBroadcast").disabled = true;
    return;
  }

  const totalPages =
    Math.ceil(filteredBroadcastList.length / BROADCAST_PER_PAGE) || 1;
  if (currentBroadcastPage > totalPages) currentBroadcastPage = totalPages;
  if (currentBroadcastPage < 1) currentBroadcastPage = 1;

  const startIndex = (currentBroadcastPage - 1) * BROADCAST_PER_PAGE;
  const pageItems = filteredBroadcastList.slice(
    startIndex,
    startIndex + BROADCAST_PER_PAGE,
  );

  tbody.innerHTML = pageItems
    .map((n, idx) => {
      const actualIdx = startIndex + idx;
      const safeId = n.id || n._id;
      const cat = classifyBroadcastItem(n.title, n.message);

      const rawDate = String(n.date || "N/A");
      const dateParts = rawDate.split(",");
      const dateMain = dateParts[0] || rawDate;
      const timeMain = dateParts.slice(1).join(",").trim();
      const senderName = String(n.sender || "admin").replace(/^@/, "");

      return `
        <tr style="border-bottom: 1px solid var(--border, #e2e8f0); transition: 0.15s;" onmouseover="this.style.background='rgba(15, 23, 42, 0.015)'" onmouseout="this.style.background='transparent'">
          <!-- ១. កាលបរិច្ឆេទ & ម៉ោង -->
          <td style="padding: 14px 12px;">
            <div style="font-weight: 800; font-size: 0.85rem; color: var(--text-main);">
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

          <!-- ២. ប្រភេទ & អ្នកផ្ញើ -->
          <td style="padding: 14px 12px;">
            <span class="abroad-cat-badge ${cat.badgeClass}">
              <i class="fa-solid ${cat.icon}"></i>
              <span>${cat.label}</span>
            </span>
            <div style="font-size: 0.74rem; color: var(--text-muted); font-weight: 700; margin-top: 5px;">
              ដោយ៖ <b style="color: var(--text-main);">@${senderName}</b>
            </div>
          </td>

          <!-- ៣. ចំណងជើងសារ -->
          <td style="padding: 14px 12px;">
            <div style="font-weight: 800; font-size: 0.94rem; color: var(--text-main); line-height: 1.4;">
              ${n.title || "គ្មានចំណងជើង"}
            </div>
          </td>

          <!-- ៤. ខ្លឹមសារសារ -->
          <td style="padding: 14px 12px; max-width: 380px;">
            <div style="font-size: 0.86rem; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; line-height: 1.48;">
              ${n.message || "-"}
            </div>
          </td>

          <!-- ៥. សកម្មភាព (មើល, ផ្ញើម្ដងទៀត, ដកហូត Recall) -->
          <td style="padding: 14px 12px; text-align: right; white-space: nowrap;">
            <div style="display: inline-flex; gap: 6px; align-items: center;">
              <button type="button" class="abroad-act-btn" style="background: var(--bg-body, #f1f5f9); color: var(--text-main); border-color: var(--border, #cbd5e1);" onclick="viewBroadcastDetailModal(${actualIdx})" title="អានខ្លឹមសារពេញលេញ">
                <i class="fa-solid fa-eye"></i> មើល
              </button>

              <button type="button" class="abroad-act-btn" style="background: rgba(13, 148, 136, 0.12); color: #0d9488; border-color: rgba(13, 148, 136, 0.3);" onclick="resendExistingBroadcast(${actualIdx})" title="យកសារនេះមកកែ ឬផ្ញើម្ដងទៀត">
                <i class="fa-solid fa-paper-plane"></i>
              </button>

              <button type="button" class="abroad-act-btn" style="background: rgba(239, 68, 68, 0.12); color: #ef4444; border-color: rgba(239, 68, 68, 0.3);" onclick="deleteBroadcast('${safeId}')" title="ដកហូត និងលុបសារនេះចេញពីប្រអប់សារអតិថិជនទាំងអស់ (Recall)">
                <i class="fa-solid fa-trash-can"></i> ដកហូត
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  // អាប់ដេត Pagination Footer
  const pageInfo = document.getElementById("broadcastPageInfo");
  if (pageInfo) {
    pageInfo.innerText = `ទំព័រ ${currentBroadcastPage} នៃ ${totalPages} (សរុប ${filteredBroadcastList.length} សារ)`;
  }

  const prevBtn = document.getElementById("btnPrevBroadcast");
  const nextBtn = document.getElementById("btnNextBroadcast");
  if (prevBtn) {
    prevBtn.disabled = currentBroadcastPage === 1;
    prevBtn.style.opacity = currentBroadcastPage === 1 ? "0.5" : "1";
  }
  if (nextBtn) {
    nextBtn.disabled = currentBroadcastPage >= totalPages;
    nextBtn.style.opacity = currentBroadcastPage >= totalPages ? "0.5" : "1";
  }
}

window.changeBroadcastPage = function (step) {
  const totalPages =
    Math.ceil(filteredBroadcastList.length / BROADCAST_PER_PAGE) || 1;
  currentBroadcastPage += step;
  if (currentBroadcastPage < 1) currentBroadcastPage = 1;
  if (currentBroadcastPage > totalPages) currentBroadcastPage = totalPages;
  renderBroadcastTable();
};

// ========================================================================
// 🔎 SECTION 5: VIEW FULL MESSAGE, RESEND, RECALL & EXPORT CSV
// ========================================================================

window.viewBroadcastDetailModal = function (index) {
  const item = filteredBroadcastList[index];
  if (!item) return;

  const cat = classifyBroadcastItem(item.title, item.message);
  const safeId = item.id || item._id;

  Swal.fire({
    title: `<span style="font-family:'Kantumruy Pro',sans-serif; font-size:1.18rem; font-weight:800;"><i class="fa-solid ${cat.icon}" style="color:${cat.color};"></i> ព័ត៌មានលម្អិតនៃសារ Broadcast</span>`,
    html: `
      <div style="text-align: left; font-family: 'Kantumruy Pro', sans-serif; display: flex; flex-direction: column; gap: 10px; margin-top: 8px;">
        <div style="display:flex; justify-content:space-between; padding:10px 14px; background:var(--bg-body,#f8fafc); border:1px solid var(--border,#e2e8f0); border-radius:10px; font-size:0.86rem;">
          <span style="color:var(--text-muted); font-weight:700;">កាលបរិច្ឆេទផ្ញើ៖</span>
          <span style="font-weight:800; font-family:monospace;">${item.date || "N/A"}</span>
        </div>

        <div style="display:flex; justify-content:space-between; padding:10px 14px; background:var(--bg-body,#f8fafc); border:1px solid var(--border,#e2e8f0); border-radius:10px; font-size:0.86rem;">
          <span style="color:var(--text-muted); font-weight:700;">អ្នកផ្ញើ (Sender)៖</span>
          <span style="font-weight:800; color:#0d9488;">@${String(item.sender || "admin").replace(/^@/, "")}</span>
        </div>

        <div style="padding:14px; background:var(--bg-body,#f8fafc); border:1px solid var(--border,#e2e8f0); border-radius:12px;">
          <div style="font-size:0.75rem; color:var(--text-muted); font-weight:700; margin-bottom:4px;">ចំណងជើងសារ (TITLE)៖</div>
          <div style="font-weight:800; font-size:1rem; color:var(--text-main); margin-bottom:12px;">${item.title || "-"}</div>

          <div style="font-size:0.75rem; color:var(--text-muted); font-weight:700; margin-bottom:4px;">ខ្លឹមសារពេញលេញ (MESSAGE CONTENT)៖</div>
          <div style="font-size:0.92rem; color:var(--text-main); line-height:1.55; white-space:pre-wrap; word-break:break-word;">${item.message || "-"}</div>
        </div>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText:
      '<i class="fa-solid fa-paper-plane"></i> កែសម្រួល & ផ្ញើម្ដងទៀត',
    cancelButtonText: "បិទផ្ទាំង",
    confirmButtonColor: "#004d40",
    cancelButtonColor: "#64748b",
    customClass: { popup: "modal-radius kh-text abroad-swal-scope" },
  }).then((res) => {
    if (res.isConfirmed) {
      sendBroadcast(item.title || "", item.message || "");
    }
  });
};

window.resendExistingBroadcast = function (index) {
  const item = filteredBroadcastList[index];
  if (!item) return;
  sendBroadcast(item.title || "", item.message || "");
};

window.deleteBroadcast = async function (notifId) {
  const result = await Swal.fire({
    title:
      "<span style=\"font-family:'Kantumruy Pro',sans-serif; font-size:1.22rem; color:#ef4444;\">ដកហូតសារជូនដំណឹងនេះវិញ (Recall Broadcast)?</span>",
    html: `<span style="font-family:'Kantumruy Pro',sans-serif; font-size:0.9rem; color:var(--text-muted);">ការដកហូតនេះនឹង <b>លុបសារជូនដំណឹងនេះចេញពីប្រអប់សារ (Inbox) របស់អតិថិជនទាំងអស់</b> ក្នុងប្រព័ន្ធភ្លាមៗ!</span>`,
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#ef4444",
    cancelButtonColor: "#64748b",
    confirmButtonText: '<i class="fa-solid fa-trash-can"></i> យល់ព្រមដកហូតសារ',
    cancelButtonText: "បោះបង់",
    customClass: { popup: "modal-radius kh-text abroad-swal-scope" },
  });

  if (result.isConfirmed) {
    Swal.fire({
      title: "កំពុងដកហូតសារចេញពីប្រព័ន្ធ...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
      customClass: { popup: "premium-swal kh-text abroad-swal-scope" },
    });

    try {
      const res = await fetch("/api/admin/delete-broadcast", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ notifId }),
      });
      const data = await res.json();
      if (data.success) {
        await loadBroadcastHistory();
        Swal.fire({
          icon: "success",
          title: "បានដកហូតសារជោគជ័យ!",
          text: "សារជូនដំណឹងនេះត្រូវបានលុបចេញពីប្រអប់សាររបស់អតិថិជនទាំងអស់រួចរាល់។",
          timer: 1600,
          showConfirmButton: false,
          customClass: { popup: "premium-swal kh-text abroad-swal-scope" },
        });
      }
    } catch (e) {
      Swal.fire("Error", "មានបញ្ហាតភ្ជាប់ទៅកាន់ Server", "error");
    }
  }
};

window.exportBroadcastHistoryCSV = function () {
  if (!filteredBroadcastList || filteredBroadcastList.length === 0) {
    return Swal.fire({
      icon: "info",
      title: "គ្មានទិន្នន័យ",
      text: "មិនមានប្រវត្តិសារ Broadcast សម្រាប់ទាញយកទេ!",
      customClass: { popup: "kh-text" },
    });
  }

  const headers = [
    "Broadcast_ID",
    "Date",
    "Category",
    "Sender",
    "Title",
    "Message",
  ];
  const rows = filteredBroadcastList.map((n) => {
    const cat = classifyBroadcastItem(n.title, n.message);
    return [
      `"${String(n.id || n._id || "").replace(/"/g, '""')}"`,
      `"${String(n.date || "").replace(/"/g, '""')}"`,
      `"${cat.key}"`,
      `"${String(n.sender || "admin").replace(/"/g, '""')}"`,
      `"${String(n.title || "").replace(/"/g, '""')}"`,
      `"${String(n.message || "").replace(/"/g, '""')}"`,
    ];
  });

  const csvContent =
    "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `UPAY_Broadcast_History_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// Auto-Load ពេលចុចចូលផ្ទាំង Broadcast History
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => loadBroadcastHistory(), 800);

  document.body.addEventListener("click", (e) => {
    const navItem = e.target.closest(
      "[onclick*='broadcast'], [data-target*='broadcast']",
    );
    if (navItem) {
      setTimeout(() => loadBroadcastHistory(), 100);
    }
  });
});
