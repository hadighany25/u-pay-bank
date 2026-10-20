// ============================================================================
// ឯកសារ: js/admin-promo.js (100% Pro Redesign - Marketing & Voucher Hub)
// អត្ថន័យ: គ្រប់គ្រងលេខកូដប្រូម៉ូសិន (Promo Codes), ស្ថិតិ KPI, បង្កើតកូដឆ្លាតវៃ និង Pagination
// ស្តង់ដារថ្មី: ចាប់ទិន្នន័យកូដតាម MongoDB `_id` + រៀបចំជំពូក និងចំណុចរងតូចៗយ៉ាងមានរបៀប
// ============================================================================

// ============================================================================
// 🎫 ជំពូកទី ១៖ អថេរសកល និងម៉ាស៊ីនពិនិត្យស្ថានភាពកូដប្រូម៉ូសិន (STATE & VOUCHER ANALYZER)
// ============================================================================
let allPromoCodes = [];
let filteredPromoCodes = [];
let currentPromoPage = 1;
const PROMO_PER_PAGE = 6; // បង្ហាញ ៦ កូដក្នុង ១ ទំព័រ
let apromoCurrentStatusFilter = "ALL"; // 'ALL', 'ACTIVE', 'DEPLETED', 'EXPIRED', 'INACTIVE'

/**
 * 🔹 ១.១ ពិនិត្យស្ថានភាពលម្អិតរបស់កូដប្រូម៉ូសិននីមួយៗ (Active, Disabled, Expired, ឬ Depleted)
 */
function getPromoCodeState(p) {
  const used = Number(p.usedCount || 0);
  const max = Math.max(1, Number(p.maxUsage || 100));
  const reward = Number(p.rewardValue || 0);
  const isExpired = p.expiresAt ? new Date(p.expiresAt) < new Date() : false;
  const isDepleted = used >= max;

  if (!p.isActive) {
    return {
      key: "DISABLED",
      badgeClass: "apromo-st-disabled",
      icon: "fa-power-off",
      label: "បានបិទ (Disabled)",
      isUsable: false,
      isExpired,
      isDepleted,
      used,
      max,
      reward,
    };
  }
  if (isExpired) {
    return {
      key: "EXPIRED",
      badgeClass: "apromo-st-expired",
      icon: "fa-calendar-xmark",
      label: "ផុតកំណត់ថ្ងៃខែ (Expired)",
      isUsable: false,
      isExpired,
      isDepleted,
      used,
      max,
      reward,
    };
  }
  if (isDepleted) {
    return {
      key: "DEPLETED",
      badgeClass: "apromo-st-depleted",
      icon: "fa-battery-empty",
      label: "ប្រើអស់ចំនួន (Full)",
      isUsable: false,
      isExpired,
      isDepleted,
      used,
      max,
      reward,
    };
  }
  return {
    key: "ACTIVE",
    badgeClass: "apromo-st-active",
    icon: "fa-circle-check",
    label: "ដំណើរការ (Active)",
    isUsable: true,
    isExpired,
    isDepleted,
    used,
    max,
    reward,
  };
}

// ============================================================================
// ✨ ជំពូកទី ២៖ ផ្ទាំងបង្កើតកូដប្រូម៉ូសិនឆ្លាតវៃ (SMART VOUCHER CREATOR MODAL)
// ============================================================================

/**
 * 🔹 ២.១ បង្កើតអក្សរកូដប្រូម៉ូសិនចៃដន្យដោយស្វ័យប្រវត្តិ (ឧ. UPAY-8K9X2)
 */
window.generateRandomPromoCode = function () {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 5; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const input = document.getElementById("swal-prm-code");
  if (input) input.value = `UPAY-${suffix}`;
};

/**
 * 🔹 ២.២ បើកផ្ទាំង Modal សម្រាប់បង្កើតកូដប្រូម៉ូសិនថ្មី
 */
window.openPromoModal = async function () {
  const { value: formValues } = await Swal.fire({
    title: `<span style="font-family:'Kantumruy Pro',sans-serif; font-size:1.22rem; font-weight:800; color:var(--text-main,#0f172a);"><i class="fa-solid fa-ticket" style="color:#0d9488;"></i> បង្កើតកូដប្រូម៉ូសិនថ្មី (Create Voucher)</span>`,
    html: `
      <div style="text-align: left; font-family: 'Kantumruy Pro', sans-serif; display: flex; flex-direction: column; gap: 14px; margin-top: 8px;">
        <!-- ១. ឈ្មោះកូដ + ប៊ូតុងបង្កើតអូតូ -->
        <div>
          <label style="font-size: 0.8rem; font-weight: 800; color: #475569; display: block; margin-bottom: 5px;">១. ឈ្មោះកូដប្រូម៉ូសិន (Promo Code) <span style="color:#ef4444;">*</span></label>
          <div style="display: flex; gap: 8px;">
            <input id="swal-prm-code" type="text" placeholder="ឧ. UPAY2026 ឬ WELCOME5" oninput="this.value = this.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '')" style="flex: 1; height: 44px; padding: 0 14px; border-radius: 10px; border: 1.5px solid #cbd5e1; font-family: 'JetBrains Mono', monospace !important; font-size: 0.98rem; font-weight: 900; letter-spacing: 1px; outline: none; box-sizing: border-box;">
            <button type="button" onclick="generateRandomPromoCode()" style="padding: 0 14px; border-radius: 10px; background: #f0fdfa; color: #0f766e; border: 1px solid #99f6e4; font-weight: 800; font-size: 0.8rem; cursor: pointer; white-space: nowrap;">
              <i class="fa-solid fa-wand-magic-sparkles"></i> បង្កើតអូតូ
            </button>
          </div>
        </div>

        <!-- ២. ទឹកប្រាក់រង្វាន់ + Quick Chips -->
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
            <label style="font-size: 0.8rem; font-weight: 800; color: #475569;">២. ទឹកប្រាក់រង្វាន់ក្នុង ១ នាក់ (Reward USD $) <span style="color:#ef4444;">*</span></label>
            <div style="display: flex; gap: 5px;">
              <span onclick="document.getElementById('swal-prm-reward').value='1.00'" style="font-size:0.72rem; background:#f1f5f9; padding:2px 8px; border-radius:6px; cursor:pointer; font-weight:800; color:#0f766e;">$1</span>
              <span onclick="document.getElementById('swal-prm-reward').value='2.50'" style="font-size:0.72rem; background:#f1f5f9; padding:2px 8px; border-radius:6px; cursor:pointer; font-weight:800; color:#0f766e;">$2.5</span>
              <span onclick="document.getElementById('swal-prm-reward').value='5.00'" style="font-size:0.72rem; background:#f1f5f9; padding:2px 8px; border-radius:6px; cursor:pointer; font-weight:800; color:#0f766e;">$5</span>
              <span onclick="document.getElementById('swal-prm-reward').value='10.00'" style="font-size:0.72rem; background:#f1f5f9; padding:2px 8px; border-radius:6px; cursor:pointer; font-weight:800; color:#0f766e;">$10</span>
            </div>
          </div>
          <input id="swal-prm-reward" type="number" step="0.01" min="0.01" placeholder="ឧ. 2.00" style="width: 100%; height: 44px; padding: 0 14px; border-radius: 10px; border: 1.5px solid #cbd5e1; font-size: 0.96rem; font-weight: 800; outline: none; box-sizing: border-box;">
        </div>

        <!-- ៣. ចំនួនអ្នកប្រើអតិបរមា & ថ្ងៃផុតកំណត់ -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div>
            <label style="font-size: 0.8rem; font-weight: 800; color: #475569; display: block; margin-bottom: 5px;">៣. ចំនួនអ្នកប្រើអតិបរមា (នាក់)</label>
            <input id="swal-prm-max" type="number" min="1" value="100" style="width: 100%; height: 44px; padding: 0 14px; border-radius: 10px; border: 1.5px solid #cbd5e1; font-size: 0.94rem; font-weight: 800; outline: none; box-sizing: border-box;">
          </div>
          <div>
            <label style="font-size: 0.8rem; font-weight: 800; color: #475569; display: block; margin-bottom: 5px;">៤. ថ្ងៃផុតកំណត់ (មិនដាក់ក៏បាន)</label>
            <input id="swal-prm-expiry" type="date" style="width: 100%; height: 44px; padding: 0 12px; border-radius: 10px; border: 1.5px solid #cbd5e1; font-size: 0.88rem; font-weight: 700; outline: none; box-sizing: border-box;">
          </div>
        </div>
      </div>
    `,
    width: "480px",
    showCancelButton: true,
    confirmButtonText:
      '<i class="fa-solid fa-check-circle"></i> បង្កើតកូដឥឡូវនេះ',
    cancelButtonText: "បោះបង់",
    confirmButtonColor: "#004d40",
    cancelButtonColor: "#64748b",
    customClass: { popup: "modal-radius kh-text apromo-swal-scope" },
    preConfirm: () => {
      const code = document
        .getElementById("swal-prm-code")
        .value.trim()
        .toUpperCase();
      const reward = parseFloat(
        document.getElementById("swal-prm-reward").value,
      );
      const max =
        parseInt(document.getElementById("swal-prm-max").value, 10) || 100;
      const expiry = document.getElementById("swal-prm-expiry").value;

      if (!code) {
        Swal.showValidationMessage("សូមវាយបញ្ចូលឈ្មោះកូដប្រូម៉ូសិន!");
        return false;
      }
      if (isNaN(reward) || reward <= 0) {
        Swal.showValidationMessage(
          "សូមបញ្ចូលទឹកប្រាក់រង្វាន់ឱ្យបានត្រឹមត្រូវ ($ > 0)!",
        );
        return false;
      }
      return {
        code,
        rewardValue: reward,
        maxUsage: max,
        expiresAt: expiry || null,
      };
    },
  });

  if (formValues) {
    await executeCreatePromoCode(formValues);
  }
};

/**
 * 🔹 ២.៣ បញ្ជូនទិន្នន័យកូដប្រូម៉ូសិនថ្មីទៅកាន់ Server (`/api/admin/promo/create`)
 */
async function executeCreatePromoCode(payload) {
  Swal.fire({
    title: "កំពុងបង្កើតកូដប្រូម៉ូសិន...",
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading(),
    customClass: { popup: "premium-swal kh-text apromo-swal-scope" },
  });

  try {
    const res = await fetch("/api/admin/promo/create", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.success) {
      if (typeof closeModal === "function") closeModal("promoModal");
      await loadPromoCodes();
      Swal.fire({
        icon: "success",
        title: "បង្កើតកូដជោគជ័យ!",
        text: data.message,
        timer: 1700,
        showConfirmButton: false,
        customClass: { popup: "premium-swal kh-text apromo-swal-scope" },
      });
    } else {
      Swal.fire({
        icon: "error",
        title: "បរាជ័យ",
        text: data.message || "មិនអាចបង្កើតកូដនេះបានទេ",
        customClass: { popup: "premium-swal kh-text apromo-swal-scope" },
      });
    }
  } catch (e) {
    Swal.fire({
      icon: "error",
      title: "Error",
      text: "បញ្ហាតភ្ជាប់ទៅកាន់ Server",
      customClass: { popup: "premium-swal kh-text apromo-swal-scope" },
    });
  }
}

window.savePromoCode = async function () {
  const code = document.getElementById("prmCode")?.value.trim();
  const reward = document.getElementById("prmReward")?.value;
  const max = document.getElementById("prmMax")?.value || 100;
  const expiry = document.getElementById("prmExpiry")?.value || null;
  if (!code || !reward) return openPromoModal();
  await executeCreatePromoCode({
    code,
    rewardValue: reward,
    maxUsage: max,
    expiresAt: expiry,
  });
};

// ============================================================================
// 🔄 ជំពូកទី ៣៖ ការទាញយកទិន្នន័យ, ស្ថិតិ KPI និងការចម្រាញ់ (LOAD DATA & KPI FILTERING)
// ============================================================================

/**
 * 🔹 ៣.១ ទាញយកបញ្ជីកូដប្រូម៉ូសិនទាំងអស់ពី Server (`/api/admin/promos`)
 */
window.loadPromoCodes = async function (showToast = false) {
  const spinIcon = document.getElementById("apromo-refresh-icon");
  if (spinIcon) spinIcon.classList.add("fa-spin");

  try {
    const res = await fetch("/api/admin/promos", { headers: getAuthHeaders() });
    const data = await res.json();
    if (data.success && Array.isArray(data.promos)) {
      allPromoCodes = data.promos;
    } else {
      allPromoCodes = [];
    }

    updatePromoKpiStats();
    filterPromoCodes();

    if (showToast) {
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "ទិន្នន័យកូដប្រូម៉ូសិនត្រូវបានធ្វើបច្ចុប្បន្នភាព!",
        showConfirmButton: false,
        timer: 1300,
        customClass: { popup: "kh-text" },
      });
    }
  } catch (e) {
    console.error("Load promo codes error:", e);
  } finally {
    if (spinIcon) spinIcon.classList.remove("fa-spin");
  }
};

/**
 * 🔹 ៣.២ គណនា និងបង្ហាញស្ថិតិ KPI ទាំង ៥ ខាងលើតារាង
 */
function updatePromoKpiStats() {
  let activeCount = 0;
  let inactiveOrExpiredCount = 0;
  let totalClaims = 0;
  let totalDistributedUSD = 0;

  allPromoCodes.forEach((p) => {
    const st = getPromoCodeState(p);
    if (st.isUsable) activeCount++;
    else inactiveOrExpiredCount++;

    totalClaims += st.used;
    totalDistributedUSD += st.used * st.reward;
  });

  const setTxt = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.innerText = val;
  };
  setTxt("apromo-stat-total", allPromoCodes.length);
  setTxt("apromo-stat-active", activeCount);
  setTxt("apromo-stat-claims", totalClaims.toLocaleString("en-US"));
  setTxt(
    "apromo-stat-spent",
    "$" +
      totalDistributedUSD.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
  );
  setTxt("apromo-stat-inactive", inactiveOrExpiredCount);
}

/**
 * 🔹 ៣.៣ ចម្រាញ់កូដប្រូម៉ូសិនតាមស្ថានភាព និងពាក្យស្វែងរក
 */
window.apromoSetStatusFilter = function (filterKey) {
  apromoCurrentStatusFilter = filterKey;
  currentPromoPage = 1;

  document.querySelectorAll(".apromo-filter-pill").forEach((btn) => {
    btn.classList.toggle(
      "active",
      btn.getAttribute("data-filter") === filterKey,
    );
  });

  document.querySelectorAll(".apromo-kpi-card").forEach((card) => {
    card.classList.remove("active-kpi");
  });
  const activeKpi = document.getElementById(`apromo-kpi-${filterKey}`);
  if (activeKpi) activeKpi.classList.add("active-kpi");

  filterPromoCodes();
};

window.filterPromoCodes = function () {
  const keyword = (document.getElementById("searchPromoBox")?.value || "")
    .toLowerCase()
    .trim();

  filteredPromoCodes = allPromoCodes.filter((p) => {
    const st = getPromoCodeState(p);

    if (apromoCurrentStatusFilter === "ACTIVE" && !st.isUsable) return false;
    if (apromoCurrentStatusFilter === "DEPLETED" && !st.isDepleted)
      return false;
    if (apromoCurrentStatusFilter === "EXPIRED" && !st.isExpired) return false;
    if (apromoCurrentStatusFilter === "INACTIVE" && st.isUsable) return false;

    if (keyword) {
      const codeStr = String(p.code || "").toLowerCase();
      const rewStr = String(p.rewardValue || "").toLowerCase();
      return codeStr.includes(keyword) || rewStr.includes(keyword);
    }
    return true;
  });

  currentPromoPage = 1;
  renderPromoCodes();
};

// ============================================================================
// 📋 ជំពូកទី ៤៖ ការគូរតារាងកូដប្រូម៉ូសិន និងការបែងចែកទំព័រតាម `_id` (TABLE & PAGINATION BY `_id`)
// ============================================================================

/**
 * 🔹 ៤.១ គូរតារាងកូដប្រូម៉ូសិន និងរបារ Progress Bar នៃការប្រើប្រាស់
 */
window.renderPromoCodes = function (customList = null) {
  if (Array.isArray(customList)) {
    filteredPromoCodes = customList;
  }

  const tbody = document.getElementById("promoTableBody");
  if (!tbody) return;

  if (!filteredPromoCodes || filteredPromoCodes.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 55px 20px; color: var(--text-muted);">
          <i class="fa-solid fa-ticket" style="font-size: 3rem; opacity: 0.3; margin-bottom: 12px; display: block;"></i>
          <div style="font-weight: 800; font-size: 1rem; color: var(--text-main);">មិនមានកូដប្រូម៉ូសិនក្នុងផ្នែកនេះទេ</div>
          <div style="font-size: 0.85rem; margin-top: 4px;">សូមចុចប៊ូតុង "បង្កើតកូដប្រូម៉ូសិនថ្មី" ខាងលើ ឬប្តូរការជ្រើសរើស Filter។</div>
        </td>
      </tr>
    `;
    document.getElementById("promoPageInfo").innerText = "ទំព័រ 1 នៃ 1 (0 កូដ)";
    document.getElementById("btnPrevPromo").disabled = true;
    document.getElementById("btnNextPromo").disabled = true;
    return;
  }

  const totalPages = Math.ceil(filteredPromoCodes.length / PROMO_PER_PAGE) || 1;
  if (currentPromoPage > totalPages) currentPromoPage = totalPages;
  if (currentPromoPage < 1) currentPromoPage = 1;

  const startIndex = (currentPromoPage - 1) * PROMO_PER_PAGE;
  const pageItems = filteredPromoCodes.slice(
    startIndex,
    startIndex + PROMO_PER_PAGE,
  );

  tbody.innerHTML = pageItems
    .map((p) => {
      const promoId = String(p._id || p.id || "");
      const st = getPromoCodeState(p);
      const pct = Math.min(100, Math.round((st.used / st.max) * 100));
      const barColor =
        pct >= 100 ? "#ef4444" : pct >= 75 ? "#f59e0b" : "#10b981";

      const totalSpentOnCode = st.used * st.reward;
      const expiryFormatted = p.expiresAt
        ? new Date(p.expiresAt).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })
        : "គ្មានថ្ងៃផុតកំណត់";

      return `
        <tr style="border-bottom: 1px solid var(--border, #e2e8f0); transition: 0.15s;" onmouseover="this.style.background='rgba(15, 23, 42, 0.015)'" onmouseout="this.style.background='transparent'">
          <td style="padding: 14px 12px;">
            <div class="apromo-voucher-chip" onclick="copyPromoCodeText('${p.code}')" title="ចុចដើម្បីចម្លងកូដ (Copy Code)">
              <i class="fa-solid fa-ticket-simple"></i>
              <span>${p.code}</span>
              <i class="fa-regular fa-copy" style="font-size: 0.78rem; opacity: 0.75;"></i>
            </div>
          </td>

          <td style="padding: 14px 12px;">
            <div style="font-family: 'JetBrains Mono', monospace; font-weight: 900; font-size: 1.08rem; color: #10b981;">
              $${st.reward.toFixed(2)} <span style="font-size: 0.72rem; color: var(--text-muted); font-family: 'Kantumruy Pro', sans-serif; font-weight: 700;">/ ១នាក់</span>
            </div>
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 3px; font-weight: 700;">
              បានចែកសរុប៖ <b style="color: var(--text-main); font-family: 'JetBrains Mono', monospace;">$${totalSpentOnCode.toFixed(2)}</b>
            </div>
          </td>

          <td style="padding: 14px 12px;">
            <div style="display: flex; justify-content: space-between; max-width: 190px; font-size: 0.82rem; font-weight: 800; color: var(--text-main);">
              <span>${st.used} / ${st.max} នាក់</span>
              <span style="color: ${barColor}; font-family: 'JetBrains Mono', monospace;">${pct}%</span>
            </div>
            <div class="apromo-progress-track">
              <div class="apromo-progress-fill" style="width: ${pct}%; background: ${barColor};"></div>
            </div>
          </td>

          <td style="padding: 14px 12px;">
            <div style="font-size: 0.84rem; font-weight: 800; color: ${st.isExpired ? "#ef4444" : "var(--text-main)"};">
              <i class="fa-regular fa-calendar-days" style="color: ${st.isExpired ? "#ef4444" : "#0d9488"}; margin-right: 4px;"></i>
              ${expiryFormatted}
            </div>
          </td>

          <td style="padding: 14px 12px;">
            <span class="apromo-status-badge ${st.badgeClass}">
              <i class="fa-solid ${st.icon}"></i>
              <span>${st.label}</span>
            </span>
          </td>

          <td style="padding: 14px 12px; text-align: right;">
            <label class="switch" title="${p.isActive ? "ចុចដើម្បីបិទកូដនេះ" : "ចុចដើម្បីបើកដំណើរការកូដនេះវិញ"}">
              <input type="checkbox" ${p.isActive ? "checked" : ""} onchange="togglePromoStatus('${promoId}', ${Boolean(p.isActive)})">
              <span class="slider"></span>
            </label>
          </td>
        </tr>
      `;
    })
    .join("");

  const pageInfo = document.getElementById("promoPageInfo");
  if (pageInfo) {
    pageInfo.innerText = `ទំព័រ ${currentPromoPage} នៃ ${totalPages} (សរុប ${filteredPromoCodes.length} កូដ)`;
  }

  const prevBtn = document.getElementById("btnPrevPromo");
  const nextBtn = document.getElementById("btnNextPromo");
  if (prevBtn) {
    prevBtn.disabled = currentPromoPage === 1;
    prevBtn.style.opacity = currentPromoPage === 1 ? "0.5" : "1";
  }
  if (nextBtn) {
    nextBtn.disabled = currentPromoPage >= totalPages;
    nextBtn.style.opacity = currentPromoPage >= totalPages ? "0.5" : "1";
  }
};

window.changePromoPage = function (step) {
  const totalPages = Math.ceil(filteredPromoCodes.length / PROMO_PER_PAGE) || 1;
  currentPromoPage += step;
  if (currentPromoPage < 1) currentPromoPage = 1;
  if (currentPromoPage > totalPages) currentPromoPage = totalPages;
  renderPromoCodes();
};

// ============================================================================
// ⚡ ជំពូកទី ៥៖ ការបិទ/បើកកូដតាម `_id`, ចម្លងកូដ និងទាញយក CSV (ACTIONS & EXPORT)
// ============================================================================

/**
 * 🔹 ៥.១ បិទ ឬ បើកដំណើរការកូដប្រូម៉ូសិនតាមរយៈ MongoDB `_id`
 */
window.togglePromoStatus = async function (id, wasActive) {
  try {
    const res = await fetch("/api/admin/promo/toggle", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ id, _id: id }),
    });
    const data = await res.json();
    if (data.success) {
      await loadPromoCodes();
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: wasActive ? "បានបិទកូដប្រូម៉ូសិន!" : "បានបើកដំណើរការកូដវិញ!",
        showConfirmButton: false,
        timer: 1300,
        customClass: { popup: "kh-text" },
      });
    }
  } catch (e) {
    loadPromoCodes();
  }
};

/**
 * 🔹 ៥.២ ចម្លងអក្សរកូដប្រូម៉ូសិនទុកក្នុង Clipboard
 */
window.copyPromoCodeText = function (codeText) {
  navigator.clipboard.writeText(codeText).then(() => {
    Swal.fire({
      toast: true,
      position: "top-end",
      icon: "success",
      title: `បានចម្លងកូដ៖ ${codeText}`,
      showConfirmButton: false,
      timer: 1300,
      customClass: { popup: "kh-text" },
    });
  });
};

/**
 * 🔹 ៥.៣ ទាញយករបាយការណ៍កូដប្រូម៉ូសិនជាឯកសារ CSV
 */
window.exportPromoCodesCSV = function () {
  if (!filteredPromoCodes || filteredPromoCodes.length === 0) {
    return Swal.fire({
      icon: "info",
      title: "គ្មានទិន្នន័យ",
      text: "មិនមានកូដប្រូម៉ូសិនសម្រាប់ទាញយកទេ!",
      customClass: { popup: "kh-text" },
    });
  }

  const headers = [
    "MongoDB_ID",
    "Code",
    "Reward_USD",
    "Used_Count",
    "Max_Usage",
    "Total_Distributed_USD",
    "Expires_At",
    "Status",
  ];
  const rows = filteredPromoCodes.map((p) => {
    const st = getPromoCodeState(p);
    const exp = p.expiresAt
      ? new Date(p.expiresAt).toISOString().slice(0, 10)
      : "Never";
    return [
      `"${p._id || p.id || ""}"`,
      `"${p.code}"`,
      st.reward.toFixed(2),
      st.used,
      st.max,
      (st.used * st.reward).toFixed(2),
      `"${exp}"`,
      `"${st.key}"`,
    ];
  });

  const csvContent =
    "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `UPAY_Promo_Codes_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * 🔹 ៥.៤ ចាប់ផ្តើមទាញទិន្នន័យកូដប្រូម៉ូសិនដោយស្វ័យប្រវត្តិពេលបើកទំព័រ
 */
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => loadPromoCodes(), 700);

  document.body.addEventListener("click", (e) => {
    const navItem = e.target.closest(
      "[onclick*='promo'], [data-target*='promo']",
    );
    if (navItem) {
      setTimeout(() => loadPromoCodes(), 100);
    }
  });
});
