// ========================================================================
// ឯកសារ: admin-merchants.js (100% Pro Redesign - Enterprise Merchant Hub)
// អត្ថន័យ: គ្រប់គ្រងអាជីវកម្ម (Merchants), ប្រតិបត្តិការ, QR Stand Pro និង API Credentials
// ========================================================================

let globalMerchantsData = [];
let currentViewedMerchantId = null;
let gmCurrentFilter = "ALL"; // 'ALL', 'ACTIVE', 'HOLD', 'SUSPENDED'
let gmCurrentPage = 1;
const gmItemsPerPage = 4; // បង្ហាញ ៥ ហាងក្នុង ១ ទំព័រ
let gmCachedShopTrx = [];

// 🇰🇭 បញ្ជីរាជធានី-ខេត្តទាំង ២៥
const gmCambodiaProvinces = [
  "Phnom Penh",
  "Banteay Meanchey",
  "Battambang",
  "Kampong Cham",
  "Kampong Chhnang",
  "Kampong Speu",
  "Kampong Thom",
  "Kampot",
  "Kandal",
  "Kep",
  "Kratie",
  "Mondulkiri",
  "Oddar Meanchey",
  "Pailin",
  "Sihanoukville",
  "Preah Vihear",
  "Prey Veng",
  "Pursat",
  "Ratanakiri",
  "Siem Reap",
  "Stung Treng",
  "Svay Rieng",
  "Takeo",
  "Tbong Khmum",
];

// 🎨 រូបតំណាង និងពណ៌តាមប្រភេទអាជីវកម្ម (Category Icon Helper)
function gmGetCategoryBadge(category) {
  const cat = String(category || "Others");
  const map = {
    "Food & Beverage": {
      icon: "fa-utensils",
      bg: "#fff7ed",
      color: "#ea580c",
      border: "#fed7aa",
      kh: "ម្ហូបអាហារ & ភេសជ្ជៈ",
    },
    "Health & Beauty": {
      icon: "fa-spa",
      bg: "#fdf2f8",
      color: "#db2777",
      border: "#fbcfe8",
      kh: "សម្រស់ & សុខភាព",
    },
    Transportation: {
      icon: "fa-truck-fast",
      bg: "#eff6ff",
      color: "#2563eb",
      border: "#bfdbfe",
      kh: "ដឹកជញ្ជូន",
    },
    "Fashion & Shopping": {
      icon: "fa-bag-shopping",
      bg: "#f3e8ff",
      color: "#7e22ce",
      border: "#e9d5ff",
      kh: "សំលៀកបំពាក់ & ទំនិញ",
    },
    "Service & Cleaning": {
      icon: "fa-screwdriver-wrench",
      bg: "#f0fdfa",
      color: "#0d9488",
      border: "#99f6e4",
      kh: "សេវាកម្ម",
    },
    Education: {
      icon: "fa-graduation-cap",
      bg: "#eef2ff",
      color: "#4f46e5",
      border: "#c7d2fe",
      kh: "ការអប់រំ",
    },
    Entertainment: {
      icon: "fa-gamepad",
      bg: "#fef2f2",
      color: "#dc2626",
      border: "#fecaca",
      kh: "កម្សាន្ត & ទេសចរណ៍",
    },
  };
  return (
    map[cat] || {
      icon: "fa-store",
      bg: "#e0f2fe",
      color: "#0284c7",
      border: "#bae6fd",
      kh: cat,
    }
  );
}

// 🔍 ស្វែងរកព័ត៌មានម្ចាស់ហាងពី globalUsersData
function gmResolveOwnerObj(merchant) {
  const uname = merchant.username || merchant.userId;
  if (
    typeof globalUsersData !== "undefined" &&
    Array.isArray(globalUsersData)
  ) {
    return globalUsersData.find(
      (u) =>
        u.username === uname ||
        (merchant.ownerId && String(u._id) === String(merchant.ownerId)),
    );
  }
  return null;
}

/**
 * 📌 បិទផ្ទាំង Sub-views ត្រឡប់ទៅផ្ទាំងបញ្ជីហាងធំវិញ
 */
function closeMerchantSubViews() {
  document.getElementById("sec-merchant-credentials").style.display = "none";
  document.getElementById("sec-merchant-history").style.display = "none";
  if (typeof showSection === "function") {
    showSection("merchants");
  } else {
    document.getElementById("sec-merchants").style.display = "block";
  }
}

// ========================================================================
// 🔄 SECTION 2: DATA LOADING, KPI STATS, SEARCH & PAGINATION
// ========================================================================

async function loadMerchantsData() {
  try {
    const tbody = document.getElementById("merchantTableBody");
    if (tbody) {
      tbody.innerHTML =
        '<tr><td colspan="6" style="text-align: center; padding: 40px;"><i class="fa-solid fa-circle-notch fa-spin" style="font-size:1.4rem; color:#0d9488;"></i><br><br>កំពុងទាញយកទិន្នន័យហាងទំនិញ...</td></tr>';
    }

    const res = await fetch("/api/merchants/admin/all-merchants", {
      headers: getAuthHeaders(),
    });
    const data = await res.json();

    if (data.success && Array.isArray(data.merchants)) {
      globalMerchantsData = data.merchants;
      renderMerchantsTable();
    } else {
      globalMerchantsData = [];
      renderMerchantsTable();
    }
  } catch (error) {
    const tbody = document.getElementById("merchantTableBody");
    if (tbody) {
      tbody.innerHTML =
        '<tr><td colspan="6" style="text-align: center; color: #ef4444; padding: 30px; font-weight: bold;">មានបញ្ហាតភ្ជាប់ទៅកាន់ Server API។</td></tr>';
    }
  }
}

window.gmRefreshAllMerchants = async function () {
  const icon = document.getElementById("gm-refresh-spin-icon");
  if (icon) icon.classList.add("fa-spin");
  await loadMerchantsData();
  setTimeout(() => {
    if (icon) icon.classList.remove("fa-spin");
    Swal.fire({
      toast: true,
      position: "top-end",
      icon: "success",
      title: "ទិន្នន័យហាងត្រូវបានធ្វើបច្ចុប្បន្នភាព!",
      showConfirmButton: false,
      timer: 1200,
      customClass: { popup: "kh-text" },
    });
  }, 250);
};

window.gmSetFilter = function (filterKey) {
  gmCurrentFilter = filterKey;
  gmCurrentPage = 1;

  document.querySelectorAll(".gm-filter-pill").forEach((btn) => {
    btn.classList.toggle(
      "active",
      btn.getAttribute("data-filter") === filterKey,
    );
  });

  document.querySelectorAll(".gm-kpi-card").forEach((box) => {
    box.classList.remove("active-kpi");
  });
  const activeKpi = document.getElementById(`gm-kpi-${filterKey}`);
  if (activeKpi) activeKpi.classList.add("active-kpi");

  renderMerchantsTable();
};

function filterMerchants() {
  gmCurrentPage = 1;
  renderMerchantsTable();
}

window.gmChangePage = function (step) {
  gmCurrentPage += step;
  renderMerchantsTable();
};

/**
 * 📌 គូរតារាងហាងទំនិញ និងគណនាស្ថិតិ KPI ទាំង ៥
 */
function renderMerchantsTable() {
  const tbody = document.getElementById("merchantTableBody");
  if (!tbody) return;

  const allShops = globalMerchantsData || [];

  // ១. គណនាស្ថិតិ KPI ទាំង ៥
  let totalShops = allShops.length;
  let activeShops = 0;
  let suspendedShops = 0;
  let totalRevUSD = 0;
  let totalRevKHR = 0;
  let totalHoldUSD = 0;
  let totalHoldKHR = 0;

  allShops.forEach((m) => {
    if (m.status === "Suspended") suspendedShops++;
    else activeShops++;

    totalRevUSD += parseFloat(m.collected?.USD || 0);
    totalRevKHR += parseFloat(m.collected?.KHR || 0);
    totalHoldUSD += parseFloat(m.escrowHold?.USD || 0);
    totalHoldKHR += parseFloat(m.escrowHold?.KHR || 0);
  });

  const setElText = (id, txt) => {
    const el = document.getElementById(id);
    if (el) el.innerText = txt;
  };
  setElText("gm-stat-total", totalShops);
  setElText("gm-stat-active", activeShops);
  setElText("gm-stat-suspended", suspendedShops);
  setElText(
    "gm-stat-rev-usd",
    "$" +
      totalRevUSD.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
  );
  setElText("gm-stat-rev-khr", totalRevKHR.toLocaleString("en-US") + " ៛");
  setElText(
    "gm-stat-hold-usd",
    "$" +
      totalHoldUSD.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
  );
  setElText("gm-stat-hold-khr", totalHoldKHR.toLocaleString("en-US") + " ៛");

  // ២. Filter តាមប្រភេទ និងពាក្យស្វែងរក
  const keyword = (document.getElementById("searchMerchantBox")?.value || "")
    .toLowerCase()
    .trim();

  const filtered = allShops.filter((m) => {
    const isSusp = m.status === "Suspended";
    const holdU = parseFloat(m.escrowHold?.USD || 0);
    const holdK = parseFloat(m.escrowHold?.KHR || 0);
    const hasHold = holdU > 0 || holdK > 0;

    if (gmCurrentFilter === "ACTIVE" && isSusp) return false;
    if (gmCurrentFilter === "SUSPENDED" && !isSusp) return false;
    if (gmCurrentFilter === "HOLD" && !hasHold) return false;

    if (keyword) {
      const ownerObj = gmResolveOwnerObj(m);
      const ownerFullName = ownerObj ? ownerObj.fullName || "" : "";
      const ownerPhone = ownerObj ? ownerObj.phone || "" : "";

      const haystack = [
        m.name,
        m.merchantId,
        m.userId,
        m.username,
        m.city,
        m.category,
        m.linkedAccounts?.USD,
        m.linkedAccounts?.KHR,
        m.accountNumbers?.USD,
        m.accountNumbers?.KHR,
        ownerFullName,
        ownerPhone,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(keyword);
    }
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 55px 20px; color: var(--text-muted);">
          <i class="fa-solid fa-store-slash" style="font-size: 3rem; opacity: 0.3; margin-bottom: 12px; display: block;"></i>
          <div style="font-weight: 800; font-size: 1rem; color: var(--text-main);">គ្មានទិន្នន័យហាងទំនិញដែលត្រូវនឹងការស្វែងរកទេ</div>
          <div style="font-size: 0.85rem; margin-top: 4px;">សូមសាកល្បងប្តូរប្រភេទ Filter ឬវាយពាក្យស្វែងរកផ្សេង។</div>
        </td>
      </tr>
    `;
    const pager = document.getElementById("gm-merchants-pagination-footer");
    if (pager) pager.style.display = "none";
    return;
  }

  // ៣. Pagination Slicing (៥ ហាងក្នុង ១ ទំព័រ)
  const totalPages = Math.ceil(filtered.length / gmItemsPerPage) || 1;
  if (gmCurrentPage > totalPages) gmCurrentPage = totalPages;
  if (gmCurrentPage < 1) gmCurrentPage = 1;

  const startIndex = (gmCurrentPage - 1) * gmItemsPerPage;
  const pageItems = filtered.slice(startIndex, startIndex + gmItemsPerPage);

  tbody.innerHTML = pageItems
    .map((m) => {
      const shopName = m.name || "Unnamed Shop";
      const ownerUsername = m.username || m.userId || "Unknown";
      const ownerObj = gmResolveOwnerObj(m);
      const ownerFullName = ownerObj
        ? ownerObj.fullName || ownerUsername
        : ownerUsername;
      const ownerPhone = ownerObj
        ? ownerObj.phone || ownerObj.phoneNumber || ""
        : "";

      const mid = m.merchantId || "N/A";
      const catInfo = gmGetCategoryBadge(m.category);
      const isFrozen = m.status === "Suspended";

      const balUSD = parseFloat(m.collected?.USD || 0);
      const balKHR = parseFloat(m.collected?.KHR || 0);
      const holdUSD = parseFloat(m.escrowHold?.USD || 0);
      const holdKHR = parseFloat(m.escrowHold?.KHR || 0);

      const linkUSD = m.linkedAccounts?.USD;
      const linkKHR = m.linkedAccounts?.KHR;
      const qrUSD = m.accountNumbers?.USD;
      const qrKHR = m.accountNumbers?.KHR;

      const strAccountsStr = encodeURIComponent(
        JSON.stringify(m.accountNumbers || {}),
      );

      // គណនីភ្ជាប់ និងលេខ QR
      let accountsCellHtml = `<div style="display:flex; flex-direction:column; gap:4px; font-size:0.8rem;">`;
      if (linkUSD) {
        accountsCellHtml += `
          <div>
            <span style="background:#dcfce7; color:#059669; font-weight:800; padding:1px 6px; border-radius:4px; font-size:0.68rem;">USD</span>
            <b style="font-family:'JetBrains Mono',monospace; color:var(--text-main); margin-left:4px;">${linkUSD}</b>
            ${qrUSD ? `<span style="color:#94a3b8; font-size:0.72rem; font-family:monospace;"> (QR: ${qrUSD})</span>` : ""}
          </div>`;
      }
      if (linkKHR) {
        accountsCellHtml += `
          <div>
            <span style="background:#e0f2fe; color:#0284c7; font-weight:800; padding:1px 6px; border-radius:4px; font-size:0.68rem;">KHR</span>
            <b style="font-family:'JetBrains Mono',monospace; color:var(--text-main); margin-left:4px;">${linkKHR}</b>
            ${qrKHR ? `<span style="color:#94a3b8; font-size:0.72rem; font-family:monospace;"> (QR: ${qrKHR})</span>` : ""}
          </div>`;
      }
      if (!linkUSD && !linkKHR) {
        accountsCellHtml += `<span style="color:#ef4444; font-weight:700;">មិនទាន់ភ្ជាប់គណនី</span>`;
      }
      accountsCellHtml += `</div>`;

      // ចំណូលសរុប និងទឹកប្រាក់ជាប់ Hold
      const holdBadgeHtml =
        holdUSD > 0 || holdKHR > 0
          ? `<div onclick="viewMerchantTrx('${m._id}')" style="margin-top:4px; display:inline-flex; align-items:center; gap:4px; background:#fef9c3; color:#d97706; border:1px solid #fde68a; padding:2px 8px; border-radius:6px; font-size:0.7rem; font-weight:800; cursor:pointer;" title="ចុចដើម្បីពិនិត្យ និងដោះ Hold">
               <i class="fa-solid fa-clock"></i> Hold: ${holdUSD > 0 ? `$${holdUSD.toFixed(2)}` : ""} ${holdKHR > 0 ? `${holdKHR.toLocaleString()}៛` : ""}
             </div>`
          : "";

      return `
        <tr style="border-bottom: 1px solid var(--border, #e2e8f0); transition: 0.15s;" onmouseover="this.style.background='rgba(15, 23, 42, 0.015)'" onmouseout="this.style.background='transparent'">
          <!-- ១. ព័ត៌មានហាង -->
          <td style="padding: 14px 12px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="width: 46px; height: 46px; border-radius: 13px; background: ${catInfo.bg}; color: ${catInfo.color}; border: 1px solid ${catInfo.border}; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; flex-shrink: 0;">
                <i class="fa-solid ${catInfo.icon}"></i>
              </div>
              <div>
                <div style="font-weight: 800; color: var(--text-main); font-size: 0.98rem;">${shopName}</div>
                <div style="display: flex; align-items: center; gap: 6px; margin-top: 3px; flex-wrap: wrap;">
                  <span onclick="copyToClipboard('${mid}')" style="font-size: 0.72rem; font-family: 'JetBrains Mono', monospace; background: #f1f5f9; color: #475569; padding: 2px 7px; border-radius: 5px; font-weight: 700; cursor: pointer;" title="ចុចដើម្បី Copy MID">
                    MID: ${mid}
                  </span>
                  <span style="font-size: 0.72rem; color: ${catInfo.color}; background: ${catInfo.bg}; padding: 2px 7px; border-radius: 5px; font-weight: 700;">
                    ${catInfo.kh}
                  </span>
                  <span style="font-size: 0.72rem; color: var(--text-muted);">
                    <i class="fa-solid fa-location-dot"></i> ${m.city || "Phnom Penh"}
                  </span>
                </div>
              </div>
            </div>
          </td>

          <!-- ២. ម្ចាស់ហាង + ប៊ូតុងលោតទៅ 360° -->
          <td style="padding: 14px 12px;">
            <div style="font-weight: 800; font-size: 0.92rem; color: var(--text-main); display: flex; align-items: center; gap: 6px;">
              <span>${ownerFullName}</span>
              <button onclick="gmJumpToCustomer360('${ownerUsername}')" title="បើកមើលម្ចាស់ហាងក្នុង Customer 360°" style="background: #f1f5f9; border: 1px solid #cbd5e1; color: #3b82f6; border-radius: 6px; padding: 2px 6px; font-size: 0.68rem; cursor: pointer; font-weight: 800;">
                360° <i class="fa-solid fa-arrow-up-right-from-square" style="font-size: 0.6rem;"></i>
              </button>
            </div>
            <div style="font-size: 0.76rem; color: var(--text-muted); margin-top: 2px;">
              @${ownerUsername} ${ownerPhone ? `• <i class="fa-solid fa-phone" style="font-size:0.65rem;"></i> ${ownerPhone}` : ""}
            </div>
          </td>

          <!-- ៣. គណនីទទួលប្រាក់ -->
          <td style="padding: 14px 12px;">
            ${accountsCellHtml}
          </td>

          <!-- ៤. ចំណូលសរុប & Hold -->
          <td style="padding: 14px 12px;">
            <div style="font-family: 'JetBrains Mono', monospace; font-weight: 800; font-size: 0.92rem; color: #059669;">
              $${balUSD.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
            <div style="font-family: 'JetBrains Mono', monospace; font-weight: 800; font-size: 0.85rem; color: #0284c7;">
              ${balKHR.toLocaleString("en-US")} ៛
            </div>
            ${holdBadgeHtml}
          </td>

          <!-- ៥. ស្ថានភាពហាង & Toggle Freeze -->
          <td style="padding: 14px 12px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <label class="switch" title="បិទ/បើកដំណើរការហាង">
                <input type="checkbox" ${!isFrozen ? "checked" : ""} onchange="toggleMerchantFreeze('${m._id}', !this.checked)">
                <span class="slider"></span>
              </label>
              <span style="font-size: 0.75rem; font-weight: 800; color: ${isFrozen ? "#ef4444" : "#10b981"};">
                ${isFrozen ? "បានផ្អាក" : "ដំណើរការ"}
              </span>
            </div>
          </td>

          <!-- ៦. ប៊ូតុងគ្រប់គ្រង -->
          <td style="padding: 14px 12px; text-align: right; white-space: nowrap;">
            <div style="display: inline-flex; gap: 6px; align-items: center;">
              <button class="gm-btn-act" style="background: #f3e8ff; color: #7e22ce; border-color: #d8b4fe;" title="បង្ហាញកាត QR Stand Pro & ទាញយក PDF" onclick="if(typeof c360ShowMerchantQR === 'function') c360ShowMerchantQR('${mid}', '${shopName.replace(/'/g, "\\'")}', '${strAccountsStr}')">
                <i class="fa-solid fa-qrcode"></i> QR Stand
              </button>

              <button class="gm-btn-act" style="background: #ecfdf5; color: #059669; border-color: #a7f3d0;" title="មើលប្រតិបត្តិការហាង, ដោះ Hold និង Refund" onclick="viewMerchantTrx('${m._id}')">
                <i class="fa-solid fa-receipt"></i> ប្រតិបត្តិការ
              </button>

              <button class="gm-btn-act" style="background: #e0f2fe; color: #0284c7; border-color: #bae6fd;" title="មើល API Key, Secret & ទាញយក PDF" onclick="viewMerchantCredentials('${m._id}')">
                <i class="fa-solid fa-key"></i> API
              </button>

              <button class="gm-btn-act" style="background: #fef9c3; color: #d97706; border-color: #fde68a;" title="កែប្រែព័ត៌មានហាង និងគណនីភ្ជាប់" onclick="gmOpenEditMerchantModal('${m._id}')">
                <i class="fa-solid fa-pen"></i> កែប្រែ
              </button>

              <button class="gm-btn-act" style="background: #fef2f2; color: #ef4444; border-color: #fca5a5;" title="លុបហាងចោល" onclick="gmDeleteMerchantConfirm('${m._id}')">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  // ៤. បង្កើត ឬអាប់ដេត Pagination Footer
  let pagerContainer = document.getElementById(
    "gm-merchants-pagination-footer",
  );
  if (!pagerContainer) {
    pagerContainer = document.createElement("div");
    pagerContainer.id = "gm-merchants-pagination-footer";
    pagerContainer.style.cssText =
      "display: flex; justify-content: space-between; align-items: center; padding: 14px 20px; background: var(--bg-body, #f8fafc); border-top: 1px solid var(--border, #e2e8f0); font-family: 'Kantumruy Pro', sans-serif;";
    tbody.closest(".table-container").after(pagerContainer);
  }
  pagerContainer.style.display = "flex";

  pagerContainer.innerHTML = `
    <button onclick="gmChangePage(-1)" class="kh-text" style="padding: 7px 14px; border-radius: 8px; border: 1px solid var(--border, #cbd5e1); background: var(--bg-card, white); color: var(--text-main); font-weight: 700; cursor: pointer;" ${gmCurrentPage === 1 ? "disabled" : ""}>
      <i class="fa-solid fa-chevron-left"></i> ថយក្រោយ
    </button>
    <span class="kh-text" style="font-size: 0.85rem; font-weight: 700; color: var(--text-main);">
      ទំព័រ ${gmCurrentPage} នៃ ${totalPages} (សរុប ${filtered.length} ហាង)
    </span>
    <button onclick="gmChangePage(1)" class="kh-text" style="padding: 7px 14px; border-radius: 8px; border: 1px solid var(--border, #cbd5e1); background: var(--bg-card, white); color: var(--text-main); font-weight: 700; cursor: pointer;" ${gmCurrentPage >= totalPages ? "disabled" : ""}>
      បន្ទាប់ <i class="fa-solid fa-chevron-right"></i>
    </button>
  `;
}

// លោតទៅកាន់ Customer 360° របស់ម្ចាស់ហាងហើយបើក Tab 7 (Merchant) ឱ្យអូតូ
window.gmJumpToCustomer360 = function (username) {
  const searchInput = document.getElementById("searchC360");
  if (searchInput) {
    searchInput.value = username;
    const c360Nav = document.querySelector(`[onclick*="sec-c360"]`);
    if (c360Nav) c360Nav.click();
    if (typeof currentC360ActiveTab !== "undefined") {
      currentC360ActiveTab = "merchant";
    }
    if (typeof searchCustomer360 === "function") {
      searchCustomer360();
    }
  }
};

// ========================================================================
// 🛠️ SECTION 3: CREATE, EDIT, FREEZE & DELETE MERCHANT (SHARED APIs)
// ========================================================================

// ១. បង្កើតហាងថ្មីជូនអតិថិជនណាម្នាក់ពីក្នុង Menu ធំផ្ទាល់
window.gmOpenCreateShopForAnyUserModal = async function () {
  const { value: targetUserStr } = await Swal.fire({
    title:
      '<span class="kh-text" style="font-size: 1.2rem; color: #004d40;"><i class="fa-solid fa-store"></i> ចុះឈ្មោះហាងថ្មីជូនអតិថិជន</span>',
    input: "text",
    inputPlaceholder: "វាយបញ្ចូល Username ឬ លេខទូរស័ព្ទម្ចាស់ហាង...",
    showCancelButton: true,
    confirmButtonText: '<span class="kh-text">បន្តទៅបង្កើតហាង</span>',
    cancelButtonText: '<span class="kh-text">បោះបង់</span>',
    confirmButtonColor: "#0d9488",
    customClass: { popup: "premium-swal kh-text" },
  });

  if (targetUserStr) {
    const kw = targetUserStr.trim().toLowerCase();
    let foundUser = (globalUsersData || []).find(
      (u) =>
        (u.username && u.username.toLowerCase() === kw) ||
        u.phone === kw ||
        u.phoneNumber === kw,
    );

    if (!foundUser) {
      try {
        const res = await fetch("/api/admin/search-user", {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({ searchTerm: targetUserStr.trim() }),
        });
        const data = await res.json();
        if (data.success && data.user) foundUser = data.user;
      } catch (e) {}
    }

    if (!foundUser) {
      return Swal.fire({
        icon: "error",
        title: "រកមិនឃើញអតិថិជន",
        text: "មិនមានគណនីអតិថិជននេះក្នុងប្រព័ន្ធទេ!",
        customClass: { popup: "premium-swal kh-text" },
      });
    }

    window.currentC360User = foundUser;
    if (typeof window.c360RegisterMerchant === "function") {
      await window.c360RegisterMerchant();
      setTimeout(() => gmRefreshAllMerchants(), 900);
    }
  }
};

// ២. កែប្រែព័ត៌មានហាង និងគណនីភ្ជាប់ (ប្រើប្រាស់ API `/api/admin/edit-merchant` ដូចក្នុង 360°)
window.gmOpenEditMerchantModal = async function (id) {
  const mData = globalMerchantsData.find(
    (m) => String(m._id) === String(id) || String(m.id) === String(id),
  );
  if (!mData) return Swal.fire("Error", "រកទិន្នន័យហាងមិនឃើញទេ!", "error");

  const ownerUsername = mData.username || mData.userId;
  let ownerUser = gmResolveOwnerObj(mData);

  if (!ownerUser && ownerUsername) {
    try {
      const res = await fetch("/api/admin/get-user", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ username: ownerUsername }),
      });
      const d = await res.json();
      if (d.success && d.user) ownerUser = d.user;
    } catch (e) {}
  }

  let usdOptions = `<option value="">-- មិនភ្ជាប់ (None) --</option>`;
  let khrOptions = `<option value="">-- មិនភ្ជាប់ (None) --</option>`;

  if (ownerUser) {
    if (ownerUser.mainAccounts?.USD) {
      const accNo = ownerUser.mainAccounts.USD.accountNumber;
      const sel = mData.linkedAccounts?.USD === accNo ? "selected" : "";
      usdOptions += `<option value="${accNo}" ${sel}>គណនីចម្បង USD (${accNo})</option>`;
    }
    if (ownerUser.mainAccounts?.KHR) {
      const accNo = ownerUser.mainAccounts.KHR.accountNumber;
      const sel = mData.linkedAccounts?.KHR === accNo ? "selected" : "";
      khrOptions += `<option value="${accNo}" ${sel}>គណនីចម្បង KHR (${accNo})</option>`;
    }
    (ownerUser.subAccounts || []).forEach((sub) => {
      if (sub.accountType !== "junior") {
        const typeLbl =
          sub.accountType === "joint" || sub.accountType === "joint_member"
            ? "[Joint]"
            : "[Sub]";
        if (sub.currency === "USD") {
          const sel =
            mData.linkedAccounts?.USD === sub.accountNumber ? "selected" : "";
          usdOptions += `<option value="${sub.accountNumber}" ${sel}>${typeLbl} ${sub.accountName} (${sub.accountNumber})</option>`;
        } else {
          const sel =
            mData.linkedAccounts?.KHR === sub.accountNumber ? "selected" : "";
          khrOptions += `<option value="${sub.accountNumber}" ${sel}>${typeLbl} ${sub.accountName} (${sub.accountNumber})</option>`;
        }
      }
    });
  } else {
    if (mData.linkedAccounts?.USD) {
      usdOptions += `<option value="${mData.linkedAccounts.USD}" selected>${mData.linkedAccounts.USD}</option>`;
    }
    if (mData.linkedAccounts?.KHR) {
      khrOptions += `<option value="${mData.linkedAccounts.KHR}" selected>${mData.linkedAccounts.KHR}</option>`;
    }
  }

  const { value: formValues } = await Swal.fire({
    title:
      '<h3 style="margin: 0; color: #004d40; font-size: 1.3rem; font-weight: 800; font-family: \'Kantumruy Pro\', sans-serif;"><i class="fa-solid fa-gear"></i> កែប្រែព័ត៌មានហាងទំនិញ</h3>',
    html: `
      <div style="text-align: left; margin-top: 10px; display: flex; flex-direction: column; gap: 12px; font-family: 'Kantumruy Pro', sans-serif;">
        <div style="background: #f8fafc; padding: 16px; border-radius: 14px; border: 1px solid #e2e8f0;">
          <div style="margin-bottom: 10px;">
            <label style="font-size: 0.82rem; font-weight: 700; color: #475569; margin-bottom: 5px; display: block;">ឈ្មោះហាង (Shop Name) <span style="color:red">*</span></label>
            <input id="gm-edit-mname" class="swal2-input kh-text" value="${mData.name || ""}" style="width: 100%; margin: 0; background: white; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 0.92rem; padding: 10px 14px; box-sizing: border-box;">
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
            <div>
              <label style="font-size: 0.82rem; font-weight: 700; color: #475569; margin-bottom: 5px; display: block;">Merchant ID (MID)</label>
              <input id="gm-edit-mid" class="swal2-input" value="${mData.merchantId || ""}" style="width: 100%; margin: 0; background: white; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 0.88rem; font-family: monospace; padding: 10px 12px; box-sizing: border-box;">
            </div>
            <div>
              <label style="font-size: 0.82rem; font-weight: 700; color: #475569; margin-bottom: 5px; display: block;">ប្រភេទអាជីវកម្ម</label>
              <select id="gm-edit-mcat" class="swal2-select kh-text" style="width: 100%; margin: 0; background: white; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 0.88rem; padding: 10px 12px; box-sizing: border-box; height: auto;">
                <option value="Food & Beverage" ${mData.category === "Food & Beverage" ? "selected" : ""}>ម្ហូបអាហារ និងភេសជ្ជៈ</option>
                <option value="Health & Beauty" ${mData.category === "Health & Beauty" ? "selected" : ""}>សម្រស់ និងសុខភាព</option>
                <option value="Transportation" ${mData.category === "Transportation" ? "selected" : ""}>ដឹកជញ្ជូន</option>
                <option value="Fashion & Shopping" ${mData.category === "Fashion & Shopping" ? "selected" : ""}>សំលៀកបំពាក់ & ទំនិញ</option>
                <option value="Service & Cleaning" ${mData.category === "Service & Cleaning" ? "selected" : ""}>សេវាកម្ម</option>
                <option value="Education" ${mData.category === "Education" ? "selected" : ""}>ការអប់រំ</option>
                <option value="Entertainment" ${mData.category === "Entertainment" ? "selected" : ""}>កម្សាន្ត និងទេសចរណ៍</option>
                <option value="Others" ${mData.category === "Others" ? "selected" : ""}>ផ្សេងៗ</option>
              </select>
            </div>
          </div>

          <div>
            <label style="font-size: 0.82rem; font-weight: 700; color: #475569; margin-bottom: 5px; display: block;">Webhook URL (សម្រាប់ B2B Callback)</label>
            <input id="gm-edit-webhook" class="swal2-input" value="${mData.webhookUrl || ""}" placeholder="https://..." style="width: 100%; margin: 0; background: white; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 0.85rem; font-family: monospace; padding: 10px 14px; box-sizing: border-box;">
          </div>
        </div>

        <div style="background: #f0fdfa; padding: 16px; border-radius: 14px; border: 1px dashed #5eead4;">
          <h4 style="margin: 0 0 10px; color: #0f766e; font-size: 0.9rem; font-weight: 800;"><i class="fa-solid fa-link"></i> គណនីទទួលប្រាក់របស់ម្ចាស់ហាង (@${ownerUsername})</h4>
          <div style="margin-bottom: 10px;">
            <label style="font-size: 0.8rem; font-weight: 700; color: #0f766e; margin-bottom: 4px; display: block;">គណនីទទួលប្រាក់ដុល្លារ (USD)</label>
            <select id="gm-edit-linked-usd" class="swal2-select kh-text" style="width: 100%; margin: 0; background: white; border: 1px solid #99f6e4; border-radius: 10px; font-size: 0.88rem; padding: 9px 12px; box-sizing: border-box; height: auto;">
              ${usdOptions}
            </select>
          </div>
          <div>
            <label style="font-size: 0.8rem; font-weight: 700; color: #0f766e; margin-bottom: 4px; display: block;">គណនីទទួលប្រាក់រៀល (KHR)</label>
            <select id="gm-edit-linked-khr" class="swal2-select kh-text" style="width: 100%; margin: 0; background: white; border: 1px solid #99f6e4; border-radius: 10px; font-size: 0.88rem; padding: 9px 12px; box-sizing: border-box; height: auto;">
              ${khrOptions}
            </select>
          </div>
        </div>
      </div>
    `,
    width: "580px",
    showCancelButton: true,
    confirmButtonText:
      '<span class="kh-text"><i class="fa-solid fa-check"></i> រក្សាទុកការផ្លាស់ប្តូរ</span>',
    cancelButtonText: '<span class="kh-text">បោះបង់</span>',
    confirmButtonColor: "#004d40",
    cancelButtonColor: "#64748b",
    customClass: { popup: "premium-swal kh-text" },
    preConfirm: () => {
      const name = document.getElementById("gm-edit-mname").value.trim();
      const merchantId = document.getElementById("gm-edit-mid").value.trim();
      const category = document.getElementById("gm-edit-mcat").value;
      const webhookUrl = document
        .getElementById("gm-edit-webhook")
        .value.trim();
      const linkedAccUSD = document.getElementById("gm-edit-linked-usd").value;
      const linkedAccKHR = document.getElementById("gm-edit-linked-khr").value;

      if (!name || !merchantId) {
        Swal.showValidationMessage("សូមបញ្ចូលឈ្មោះហាង និង MID!");
        return false;
      }
      if (!linkedAccUSD && !linkedAccKHR) {
        Swal.showValidationMessage("សូមជ្រើសរើសគណនីទទួលប្រាក់យ៉ាងហោចណាស់មួយ!");
        return false;
      }
      return {
        name,
        merchantId,
        category,
        webhookUrl,
        linkedAccUSD,
        linkedAccKHR,
      };
    },
  });

  if (formValues) {
    Swal.fire({
      title: "កំពុងរក្សាទុក...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
      customClass: { popup: "premium-swal kh-text" },
    });
    try {
      const res = await fetch("/api/admin/edit-merchant", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          id: mData._id || mData.id,
          username: ownerUsername,
          ...formValues,
        }),
      });
      const data = await res.json();
      if (data.success) {
        await loadMerchantsData();
        Swal.fire({
          toast: true,
          position: "top-end",
          icon: "success",
          title: "បានកែប្រែព័ត៌មានហាងជោគជ័យ!",
          showConfirmButton: false,
          timer: 1500,
          customClass: { popup: "kh-text" },
        });
      } else {
        Swal.fire("បរាជ័យ", data.message, "error");
      }
    } catch (e) {
      Swal.fire("Error", e.message, "error");
    }
  }
};

// ៣. ផ្អាក ឬបើកដំណើរការហាង (Freeze / Unfreeze)
async function toggleMerchantFreeze(id, isFrozen) {
  try {
    const res = await fetch("/api/admin/toggle-merchant-freeze", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ id, isFrozen }),
    });
    const data = await res.json();
    if (data.success) {
      const m = globalMerchantsData.find(
        (item) => String(item._id) === String(id),
      );
      if (m) m.status = isFrozen ? "Suspended" : "Active";
      renderMerchantsTable();
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: isFrozen ? "បានផ្អាកហាងបណ្តោះអាសន្ន!" : "បានបើកដំណើរការហាងវិញ!",
        showConfirmButton: false,
        timer: 1400,
        customClass: { popup: "kh-text" },
      });
    } else {
      Swal.fire("Error", data.message, "error");
      loadMerchantsData();
    }
  } catch (e) {
    Swal.fire("Error", "Server Error", "error");
    loadMerchantsData();
  }
}

// ៤. លុបហាងចោលពីប្រព័ន្ធ (ប្រើប្រាស់ `/api/admin/delete-merchant/:id`)
window.gmDeleteMerchantConfirm = function (id) {
  Swal.fire({
    title:
      '<span class="kh-text" style="color:#ef4444;">តើអ្នកប្រាកដទេ?</span>',
    text: "ទិន្នន័យហាងនេះនឹងត្រូវលុបចោលទាំងស្រុងពីប្រព័ន្ធ!",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#ef4444",
    cancelButtonColor: "#64748b",
    confirmButtonText:
      '<span class="kh-text"><i class="fa-solid fa-trash"></i> បាទ/ចាស លុបចោល!</span>',
    cancelButtonText: '<span class="kh-text">បោះបង់</span>',
    customClass: { popup: "premium-swal kh-text" },
  }).then(async (result) => {
    if (result.isConfirmed) {
      Swal.fire({
        title: "កំពុងលុប...",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
        customClass: { popup: "premium-swal kh-text" },
      });
      try {
        const response = await fetch(`/api/admin/delete-merchant/${id}`, {
          method: "POST",
          headers: getAuthHeaders(),
        });
        const data = await response.json();
        if (data.success) {
          await loadMerchantsData();
          Swal.fire({
            icon: "success",
            title: "បានលុបហាងរួចរាល់!",
            timer: 1500,
            showConfirmButton: false,
            customClass: { popup: "premium-swal kh-text" },
          });
        } else {
          Swal.fire("Error", data.message, "error");
        }
      } catch (err) {
        Swal.fire("Error", "មិនអាចលុបហាងបានទេ", "error");
      }
    }
  });
};

// ========================================================================
// 🔎 SECTION 4: MERCHANT TRANSACTIONS & CREDENTIALS SUB-VIEWS
// ========================================================================

async function viewMerchantTrx(mid) {
  currentViewedMerchantId = mid;
  const shopObj = globalMerchantsData.find(
    (m) => String(m._id) === String(mid),
  );

  document.getElementById("sec-merchants").style.display = "none";
  document.getElementById("sec-merchant-credentials").style.display = "none";
  document.getElementById("sec-merchant-history").style.display = "block";

  if (shopObj) {
    const titleEl = document.getElementById("gmHistoryShopTitle");
    if (titleEl)
      titleEl.innerHTML = `<i class="fa-solid fa-store" style="color:#0d9488;"></i> ប្រវត្តិប្រតិបត្តិការហាង៖ ${shopObj.name} <span style="font-size:0.8rem; font-family:monospace; color:#64748b;">(MID: ${shopObj.merchantId})</span>`;
  }

  const tbody = document.getElementById("merchantTrxBody");
  tbody.innerHTML =
    '<tr><td colspan="6" style="text-align:center; padding: 35px;"><i class="fa-solid fa-circle-notch fa-spin" style="font-size:1.4rem; color:#0d9488;"></i><br><br>កំពុងទាញយកប្រវត្តិប្រតិបត្តិការហាង...</td></tr>';

  try {
    const res = await fetch(`/api/merchants/transactions/${mid}?filter=total`, {
      headers: getAuthHeaders(),
    });
    const data = await res.json();

    if (data.success && data.transactions && data.transactions.length > 0) {
      gmCachedShopTrx = data.transactions;
      tbody.innerHTML = data.transactions
        .map((t, idx) => {
          const isIncome = t.type === "Received" || t.amount > 0;
          const color = isIncome ? "#059669" : "#ef4444";
          const sign = isIncome ? "+" : "-";
          const curSym = t.currency === "USD" ? "$" : "៛";
          const displayAmt =
            t.currency === "USD"
              ? Math.abs(t.amount).toFixed(2)
              : Math.abs(t.amount).toLocaleString("en-US");

          let statusBadge = `<span style="background:#dcfce7; color:#059669; padding:4px 10px; border-radius:20px; font-size:0.75rem; font-weight:800;"><i class="fa-solid fa-circle-check"></i> Success</span>`;
          if (t.status === "Hold") {
            statusBadge = `<span style="background:#fef9c3; color:#d97706; padding:4px 10px; border-radius:20px; font-size:0.75rem; font-weight:800;"><i class="fa-solid fa-clock"></i> Hold (រង់ចាំទម្លាក់ប្រាក់)</span>`;
          } else if (t.status === "Refunded" || t.status === "Voided") {
            statusBadge = `<span style="background:#fee2e2; color:#ef4444; padding:4px 10px; border-radius:20px; font-size:0.75rem; font-weight:800;"><i class="fa-solid fa-rotate-left"></i> ${t.status}</span>`;
          }

          let actionBtns = "";
          if (isIncome && t.status === "Hold") {
            actionBtns = `
              <button onclick="event.stopPropagation(); gmReleaseHoldTrx('${t.refId}', '${Math.abs(t.amount)}', '${t.currency}')" class="gm-btn-act" style="background:#ecfdf5; color:#059669; border-color:#a7f3d0;">
                <i class="fa-solid fa-check"></i> Approve
              </button>
              <button onclick="event.stopPropagation(); gmRefundShopTrx('${t.refId}', '${Math.abs(t.amount)}', '${t.currency}')" class="gm-btn-act" style="background:#fef2f2; color:#ef4444; border-color:#fca5a5;">
                <i class="fa-solid fa-rotate-left"></i> Refund
              </button>
            `;
          } else if (t.status === "Success") {
            actionBtns = `
              <button onclick="event.stopPropagation(); gmRefundShopTrx('${t.refId}', '${Math.abs(t.amount)}', '${t.currency}')" class="gm-btn-act" style="background:#f8fafc; color:#64748b; border-color:#cbd5e1;" title="បង្វិលប្រាក់សងអតិថិជនវិញ">
                <i class="fa-solid fa-rotate-left"></i> Refund
              </button>
            `;
          } else {
            actionBtns = `<span style="font-size:0.75rem; color:#94a3b8; font-weight:700;">បានបង្វិលសងរួច</span>`;
          }

          return `
            <tr onclick="gmOpenShopTrxSlip(${idx})" style="border-bottom: 1px solid var(--border); cursor: pointer; transition: 0.15s;" onmouseover="this.style.background='rgba(15, 23, 42, 0.02)'" onmouseout="this.style.background='transparent'" title="ចុចដើម្បីមើលវិក្កយបត្រ (View Slip)">
              <td style="padding:14px 12px; color:var(--text-muted); font-size: 0.85rem;">${t.date}</td>
              <td style="padding:14px 12px; font-family:'JetBrains Mono', monospace; font-size: 0.85rem; font-weight:700; color:#0f766e;">${t.refId}</td>
              <td style="padding:14px 12px; font-weight:800; color:var(--text-main);">${t.senderName || t.receiverName}</td>
              <td style="padding:14px 12px; font-weight:900; color:${t.status === "Refunded" ? "#94a3b8" : color}; font-family:'JetBrains Mono', monospace; font-size:0.95rem; text-decoration:${t.status === "Refunded" ? "line-through" : "none"};">${sign}${curSym}${displayAmt}</td>
              <td style="padding:14px 12px;">${statusBadge}</td>
              <td style="padding:14px 12px; text-align:right; white-space:nowrap;">${actionBtns}</td>
            </tr>`;
        })
        .join("");
    } else {
      tbody.innerHTML =
        '<tr><td colspan="6" style="text-align:center; padding: 45px; color: var(--text-muted); font-weight:700;">ហាងនេះមិនទាន់មានប្រវត្តិប្រតិបត្តិការនៅឡើយទេ។</td></tr>';
    }
  } catch (e) {
    tbody.innerHTML =
      '<tr><td colspan="6" style="text-align:center; color:#ef4444; padding: 35px; font-weight:bold;">មានបញ្ហាក្នុងការភ្ជាប់ទៅកាន់ Server API</td></tr>';
  }
}

window.gmOpenShopTrxSlip = function (idx) {
  const trx = gmCachedShopTrx[idx];
  if (!trx) return;
  if (
    typeof c360FilteredTrx !== "undefined" &&
    typeof c360ViewTrxDetails === "function"
  ) {
    c360FilteredTrx = gmCachedShopTrx;
    c360ViewTrxDetails(idx);
  }
};

window.gmReleaseHoldTrx = async function (refId, amount, currency) {
  if (typeof window.c360AdminReleaseHold === "function") {
    await window.c360AdminReleaseHold(refId, amount, currency);
    setTimeout(() => {
      if (currentViewedMerchantId) viewMerchantTrx(currentViewedMerchantId);
      loadMerchantsData();
    }, 600);
  }
};

window.gmRefundShopTrx = async function (refId, amount, currency) {
  if (typeof window.c360AdminRefundTrx === "function") {
    await window.c360AdminRefundTrx(refId, amount, currency);
    setTimeout(() => {
      if (currentViewedMerchantId) viewMerchantTrx(currentViewedMerchantId);
      loadMerchantsData();
    }, 600);
  }
};

/**
 * 📌 មើលព័ត៌មានសម្ងាត់ (Credentials View)
 */
function viewMerchantCredentials(id) {
  const mData = globalMerchantsData.find((m) => String(m._id) === String(id));
  if (!mData) return;

  currentViewedMerchantId = id;

  document.getElementById("sec-merchants").style.display = "none";
  document.getElementById("sec-merchant-history").style.display = "none";
  document.getElementById("sec-merchant-credentials").style.display = "block";

  document.getElementById("credShopTitle").innerText =
    `${mData.name.toUpperCase()} - ព័ត៌មានសម្ងាត់ហាង`;
  const tbody = document.getElementById("credTableBody");

  const createRow = (
    field,
    value,
    hasCheckbox = false,
    checkboxId = "",
    bgColor = "#ffffff",
    isStatus = false,
  ) => {
    let checkboxHtml = hasCheckbox
      ? `<input type="checkbox" id="${checkboxId}" checked style="width:18px; height:18px; accent-color: #004d40; cursor:pointer;">`
      : `<span style="color:#cbd5e1;">—</span>`;

    let displayValueHtml = "";
    if (isStatus) {
      displayValueHtml = value;
    } else {
      const rawTextForCopy = value
        ? String(value).replace(/<[^>]*>?/gm, "")
        : "";
      const safeTextForCopy = rawTextForCopy.replace(/'/g, "\\'");

      displayValueHtml = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="color: ${field.includes("Secret") || field.includes("Key") ? "#047857" : "#475569"}; font-family: ${field.includes("Key") || field.includes("Id") || field.includes("Secret") || field.includes("USD") || field.includes("KHR") ? "'JetBrains Mono', monospace" : "inherit"}; font-weight: 700; word-break: break-all;">${value || "N/A"}</span>
          ${value && value !== "N/A" && value !== "null" ? `<i class="fa-regular fa-copy" style="cursor: pointer; color: #94a3b8; transition: color 0.2s;" onmouseover="this.style.color='#0f172a'" onmouseout="this.style.color='#94a3b8'" onclick="copyToClipboard('${safeTextForCopy}')" title="ចម្លងទុក"></i>` : ""}
        </div>
      `;
    }

    return `
      <tr style="border-bottom: 1px solid #e2e8f0; background: ${bgColor};">
        <td style="padding: 12px 20px; font-weight: 700; color: #334155; width: 32%;">${field}</td>
        <td style="padding: 12px 20px;">${displayValueHtml}</td>
        <td style="padding: 12px 20px; text-align: center; width: 140px;">${checkboxHtml}</td>
      </tr>
    `;
  };

  const createHeaderRow = (title) => {
    return `<tr style="background: #f0fdfa; border-bottom: 1px solid #99f6e4;"><td colspan="3" style="padding: 10px 20px; font-weight: 800; color: #0f766e;">${title}</td></tr>`;
  };

  let html = "";
  html += createRow("ម្ចាស់ហាង (Username)", mData.username || mData.userId);
  html += createRow("ឈ្មោះហាង (Shop Name)", mData.name);
  html += createRow("ទីតាំង (City / Province)", mData.city);
  html += createRow("ប្រភេទអាជីវកម្ម (Category)", mData.category);

  html += createHeaderRow("គណនីទទួលប្រាក់ផ្ទាល់ (Linked Accounts)");
  html += createRow("USD Account", mData.linkedAccounts?.USD);
  html += createRow("KHR Account", mData.linkedAccounts?.KHR);
  html += createRow("Merchant ID (MID)", mData.merchantId);

  html += createHeaderRow("លេខគណនី QR និម្មិត (Virtual QR Accounts)");
  html += createRow("USD QR Account", mData.accountNumbers?.USD);
  html += createRow("KHR QR Account", mData.accountNumbers?.KHR);

  html += createHeaderRow("API & Security Credentials");
  html += createRow("API Key", mData.apiKey, true, "chk-apikey");
  html += createRow("API Secret", mData.apiSecret, true, "chk-apisecret");
  html += createRow(
    "Webhook URL",
    mData.webhookUrl || "null",
    true,
    "chk-webhook",
  );

  html += createRow(
    "ស្ថានភាពហាង (Status)",
    `<span style="background:${mData.status === "Suspended" ? "#ef4444" : "#10b981"}; color:white; padding: 4px 12px; border-radius:12px; font-size:0.8rem; font-weight:800;">${mData.status || "Active"}</span>`,
    false,
    "",
    "#ffffff",
    true,
  );

  tbody.innerHTML = html;
}

// ========================================================================
// 🧰 SECTION 5: UTILITIES (PDF Download & Clipboard)
// ========================================================================

async function downloadCredentialPDF() {
  if (!currentViewedMerchantId) return;

  const showApiKey = document.getElementById("chk-apikey")?.checked || false;
  const showApiSecret =
    document.getElementById("chk-apisecret")?.checked || false;
  const showWebhook = document.getElementById("chk-webhook")?.checked || false;

  Swal.fire({
    title: "កំពុងបង្កើតឯកសារ PDF...",
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading(),
    customClass: { popup: "premium-swal kh-text" },
  });

  try {
    const response = await fetch(
      `/api/merchants/admin/credential-pdf/${currentViewedMerchantId}?showKey=${showApiKey}&showSecret=${showApiSecret}&showWebhook=${showWebhook}`,
      { method: "GET", headers: getAuthHeaders() },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || "មិនអាចទាញយក PDF បានទេ! សូមពិនិត្យសិទ្ធិឡើងវិញ។",
      );
    }

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = `Merchant-Credentials-${currentViewedMerchantId}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(downloadUrl);
    Swal.close();
  } catch (error) {
    Swal.fire("បរាជ័យ!", error.message, "error");
  }
}

function copyToClipboard(text) {
  if (!text || text === "N/A" || text === "null") return;
  navigator.clipboard.writeText(text).then(() => {
    Swal.fire({
      toast: true,
      position: "top-end",
      icon: "success",
      title: "បានចម្លងរួចរាល់!",
      showConfirmButton: false,
      timer: 1300,
      customClass: { popup: "kh-text" },
    });
  });
}
