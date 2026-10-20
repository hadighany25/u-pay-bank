// ============================================================================
// ឯកសារ: js/admin-trx.js (100% Pro Redesign - Real-Time Transaction Forensics)
// អត្ថន័យ: ពិនិត្យវិក្កយបត្រពិត (Zero Fake Data), អនុម័ត Pending, ដោះ Hold ហាង និងធ្វើ Refund
// ស្តង់ដារថ្មី: ចាប់ទិន្នន័យភាគីអ្នកផ្ញើ និងអ្នកទទួលតាម MongoDB `_id` សុទ្ធសាធ + បង្ហាញឈ្មោះពេញ
// ============================================================================

// ============================================================================
// 🔍 ជំពូកទី ១៖ អថេរសកល, ម៉ាស៊ីនចាត់ថ្នាក់ប្រតិបត្តិការ និងការប្រមូលទិន្នន័យ (STATE & COLLECTOR)
// ============================================================================
let allSystemTrxList = [];
let filteredSystemTrxList = [];
let currentAtrxPage = 1;
const ATRX_PER_PAGE = 8; // បង្ហាញ ៨ ប្រតិបត្តិការក្នុង ១ ទំព័រ
let atrxCurrentFilter = "ALL"; // 'ALL', 'PENDING', 'HOLD', 'TRANSFER', 'POS_CARD', 'CASHIER', 'REFUNDED'
let currentInspectedTrx = null;
let atrxCachedStream = [];

/**
 * 🔹 ១.១ ចំណាត់ថ្នាក់ប្រភេទប្រតិបត្តិការដោយស្វ័យប្រវត្តិ (Smart Transaction Classifier)
 */
function classifyTrxCategory(t) {
  const type = String(t.type || "").toLowerCase();
  const method = String(t.trxMethod || "").toLowerCase();
  const status = String(t.status || "Success");

  if (status === "Refunded" || type.includes("refund")) {
    return {
      key: "REFUNDED",
      label: "បង្វិលប្រាក់ (Refund)",
      icon: "fa-rotate-left",
      bg: "rgba(239, 68, 68, 0.14)",
      color: "#ef4444",
      border: "rgba(239, 68, 68, 0.3)",
    };
  }
  if (
    type.includes("tap to pay") ||
    method.includes("nfc") ||
    type.includes("merchant") ||
    type.includes("scan") ||
    t.merchantId ||
    t.cardNumber
  ) {
    return {
      key: "POS_CARD",
      label: t.cardNumber ? "ឈូតកាត NFC / Card" : "ទូទាត់ហាង (QR/POS)",
      icon: t.cardNumber ? "fa-credit-card" : "fa-store",
      bg: "rgba(139, 92, 246, 0.14)",
      color: "#8b5cf6",
      border: "rgba(139, 92, 246, 0.3)",
    };
  }
  if (
    type.includes("deposit") ||
    type.includes("withdrawal") ||
    method.includes("cash")
  ) {
    return {
      key: "CASHIER",
      label: type.includes("deposit")
        ? "ដាក់ប្រាក់ (Deposit)"
        : "ដកប្រាក់ (Withdrawal)",
      icon: type.includes("deposit")
        ? "fa-hand-holding-dollar"
        : "fa-money-bill-transfer",
      bg: "rgba(16, 185, 129, 0.14)",
      color: "#10b981",
      border: "rgba(16, 185, 129, 0.3)",
    };
  }
  return {
    key: "TRANSFER",
    label: t.type || "ផ្ទេរប្រាក់ (Transfer)",
    icon: "fa-right-left",
    bg: "rgba(59, 130, 246, 0.14)",
    color: "#3b82f6",
    border: "rgba(59, 130, 246, 0.3)",
  };
}

/**
 * 🔹 ១.២ ប្រមូលប្រតិបត្តិការពិតទាំងអស់ពីប្រព័ន្ធ (Deduplicated by Ref ID & Linked by `_id`)
 */
function collectAllRealTransactions() {
  const mapByRef = new Map();

  // ១.២.១ ប្រមូលពី globalUsersData (បើមានភ្ជាប់មកជាមួយ)
  if (
    typeof globalUsersData !== "undefined" &&
    Array.isArray(globalUsersData)
  ) {
    globalUsersData.forEach((u) => {
      if (!Array.isArray(u.transactions)) return;
      const canonicalId = String(u._id || u.id || "");
      u.transactions.forEach((t) => {
        if (!t) return;
        if (u.username === "superadmin" && t.senderAcc === "888888888") return;

        const key = t.refId || t.hash || `${canonicalId}_${t.date}_${t.amount}`;
        const existing = mapByRef.get(key);

        if (!existing) {
          mapByRef.set(key, {
            ...t,
            ownerId: canonicalId,
            ownerUsername: u.username,
            ownerFullName: u.fullName || u.username,
          });
        } else {
          if (t.status === "Hold" || existing.status === "Hold")
            existing.status = "Hold";
          if (t.status === "Pending" || existing.status === "Pending")
            existing.status = "Pending";
          if (t.status === "Refunded" || existing.status === "Refunded")
            existing.status = "Refunded";
          if (!existing.merchantId && t.merchantId)
            existing.merchantId = t.merchantId;
          if (!existing.cardNumber && t.cardNumber)
            existing.cardNumber = t.cardNumber;
        }
      });
    });
  }

  // ១.២.២ បញ្ចូលបន្ថែមពី Live Stream នៃ Dashboard Analytics (ធានាថាតារាងមានប្រតិបត្តិការជានិច្ច!)
  const streamSource =
    (typeof adashRawPayload !== "undefined" &&
      Array.isArray(adashRawPayload?.liveStream) &&
      adashRawPayload.liveStream) ||
    atrxCachedStream ||
    [];

  streamSource.forEach((t) => {
    if (!t) return;
    const key = t.refId || t.hash || String(t._id || Math.random());
    if (!mapByRef.has(key)) {
      mapByRef.set(key, {
        ...t,
        ownerId: String(t.userId || ""),
        ownerUsername: t.username || "",
        ownerFullName: t.senderName || t.username || "អតិថិជន U-Pay",
      });
    }
  });

  const list = Array.from(mapByRef.values());
  list.sort(
    (a, b) =>
      new Date(b.createdAt || b.date || 0) -
      new Date(a.createdAt || a.date || 0),
  );
  return list;
}

// ============================================================================
// 🔄 ជំពូកទី ២៖ ការធ្វើបច្ចុប្បន្នភាពទិន្នន័យ, ស្ថិតិ KPI និងការចម្រាញ់ (REFRESH, KPI & FILTER)
// ============================================================================

/**
 * 🔹 ២.១ ទាញយកទិន្នន័យប្រតិបត្តិការថ្មីៗពី Server
 */
window.atrxRefreshLedger = async function () {
  const icon = document.getElementById("atrx-refresh-icon");
  if (icon) icon.classList.add("fa-spin");

  try {
    const [dashRes] = await Promise.all([
      fetch("/api/admin/dashboard-analytics", {
        headers: getAuthHeaders(),
      }).catch(() => null),
      typeof loadData === "function" ? loadData() : Promise.resolve(),
    ]);

    if (dashRes && dashRes.ok) {
      const dJson = await dashRes.json();
      if (dJson && Array.isArray(dJson.liveStream)) {
        atrxCachedStream = dJson.liveStream;
      }
    }

    setTimeout(() => {
      initAtrxLedger();
      if (currentInspectedTrx && currentInspectedTrx.refId) {
        document.getElementById("searchTrxId").value =
          currentInspectedTrx.refId;
        searchTrx(true);
      }
      if (icon) icon.classList.remove("fa-spin");
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "ទិន្នន័យប្រតិបត្តិការត្រូវបានធ្វើបច្ចុប្បន្នភាព!",
        showConfirmButton: false,
        timer: 1300,
        customClass: { popup: "kh-text" },
      });
    }, 300);
  } catch (e) {
    if (icon) icon.classList.remove("fa-spin");
  }
};

/**
 * 🔹 ២.២ គណនាស្ថិតិ KPI ទាំង ៥ និងរៀបចំតារាងប្រតិបត្តិការ
 */
window.initAtrxLedger = async function () {
  allSystemTrxList = collectAllRealTransactions();

  if (allSystemTrxList.length === 0 && atrxCachedStream.length === 0) {
    try {
      const res = await fetch("/api/admin/dashboard-analytics", {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const dJson = await res.json();
        if (dJson && Array.isArray(dJson.liveStream)) {
          atrxCachedStream = dJson.liveStream;
          allSystemTrxList = collectAllRealTransactions();
        }
      }
    } catch (e) {}
  }

  let pendingCount = 0;
  let holdCount = 0;
  let posCardCount = 0;
  let refundedCount = 0;

  allSystemTrxList.forEach((t) => {
    const cat = classifyTrxCategory(t);
    if (t.status === "Pending") pendingCount++;
    if (t.status === "Hold") holdCount++;
    if (cat.key === "POS_CARD") posCardCount++;
    if (cat.key === "REFUNDED") refundedCount++;
  });

  const setTxt = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.innerText = val;
  };
  setTxt("atrx-stat-total", allSystemTrxList.length);
  setTxt("atrx-stat-pending", pendingCount);
  setTxt("atrx-stat-hold", holdCount);
  setTxt("atrx-stat-pos", posCardCount);
  setTxt("atrx-stat-refunded", refundedCount);

  atrxFilterTableOnly();
};

/**
 * 🔹 ២.៣ ចម្រាញ់តារាងប្រតិបត្តិការតាមប្រភេទ, រូបិយប័ណ្ណ និងពាក្យគន្លឹះ
 */
window.atrxSetFilter = function (filterKey) {
  atrxCurrentFilter = filterKey;
  currentAtrxPage = 1;

  document.querySelectorAll(".atrx-filter-pill").forEach((btn) => {
    btn.classList.toggle(
      "active",
      btn.getAttribute("data-filter") === filterKey,
    );
  });

  document.querySelectorAll(".atrx-kpi-card").forEach((card) => {
    card.classList.remove("active-kpi");
  });
  const activeKpi = document.getElementById(`atrx-kpi-${filterKey}`);
  if (activeKpi) activeKpi.classList.add("active-kpi");

  atrxFilterTableOnly();
};

window.atrxFilterTableOnly = function () {
  const kw = (document.getElementById("searchTrxId")?.value || "")
    .toLowerCase()
    .trim();
  const curFilter =
    document.getElementById("atrxCurrencyFilter")?.value || "ALL";

  filteredSystemTrxList = allSystemTrxList.filter((t) => {
    const cat = classifyTrxCategory(t);

    if (atrxCurrentFilter === "PENDING" && t.status !== "Pending") return false;
    if (atrxCurrentFilter === "HOLD" && t.status !== "Hold") return false;
    if (atrxCurrentFilter === "TRANSFER" && cat.key !== "TRANSFER")
      return false;
    if (atrxCurrentFilter === "POS_CARD" && cat.key !== "POS_CARD")
      return false;
    if (atrxCurrentFilter === "CASHIER" && cat.key !== "CASHIER") return false;
    if (atrxCurrentFilter === "REFUNDED" && cat.key !== "REFUNDED")
      return false;

    if (curFilter !== "ALL" && t.currency !== curFilter) return false;

    if (kw) {
      const searchStr = [
        t.refId,
        t.hash,
        t.ownerId,
        t.senderName,
        t.senderAcc,
        t.receiverName,
        t.receiverAcc,
        t.ownerFullName,
        t.ownerUsername,
        t.type,
        t.trxMethod,
        t.remark,
        t.cardNumber,
        t.merchantId,
        String(Math.abs(t.amount || 0)),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchStr.includes(kw);
    }
    return true;
  });

  const countEl = document.getElementById("atrx-showing-count");
  if (countEl) {
    countEl.innerText = `បង្ហាញ ${filteredSystemTrxList.length} នៃ ${allSystemTrxList.length} ប្រតិបត្តិការ`;
  }

  currentAtrxPage = 1;
  renderAtrxLedgerTable();
};

// ============================================================================
// 📋 ជំពូកទី ៣៖ ការគូរតារាងប្រតិបត្តិការ និងការបែងចែកទំព័រ (LEDGER TABLE & PAGINATION)
// ============================================================================

/**
 * 🔹 ៣.១ គូរតារាងប្រតិបត្តិការរួម និងប៊ូតុងសកម្មភាពរហ័ស
 */
function renderAtrxLedgerTable() {
  const tbody = document.getElementById("atrxLedgerTableBody");
  if (!tbody) return;

  if (!filteredSystemTrxList || filteredSystemTrxList.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 50px 20px; color: var(--text-muted);">
          <i class="fa-solid fa-file-circle-question" style="font-size: 2.8rem; opacity: 0.3; margin-bottom: 10px; display: block;"></i>
          <div style="font-weight: 800; font-size: 0.98rem; color: var(--text-main);">មិនមានប្រតិបត្តិការក្នុងតារាងដែលត្រូវនឹងការស្វែងរកទេ</div>
          <div style="font-size: 0.82rem; margin-top: 4px;">អ្នកអាចចុចប៊ូតុង <b>"ឆែកវិក្កយបត្រស៊ីជម្រៅ (Trace Server)"</b> ខាងលើ ដើម្បីឆែកផ្ទាល់ពី Database។</div>
        </td>
      </tr>
    `;
    document.getElementById("atrxPageInfo").innerText =
      "ទំព័រ 1 នៃ 1 (0 ប្រតិបត្តិការ)";
    document.getElementById("btnPrevAtrx").disabled = true;
    document.getElementById("btnNextAtrx").disabled = true;
    return;
  }

  const totalPages =
    Math.ceil(filteredSystemTrxList.length / ATRX_PER_PAGE) || 1;
  if (currentAtrxPage > totalPages) currentAtrxPage = totalPages;
  if (currentAtrxPage < 1) currentAtrxPage = 1;

  const startIndex = (currentAtrxPage - 1) * ATRX_PER_PAGE;
  const pageItems = filteredSystemTrxList.slice(
    startIndex,
    startIndex + ATRX_PER_PAGE,
  );

  tbody.innerHTML = pageItems
    .map((t) => {
      const cat = classifyTrxCategory(t);
      const isKHR = t.currency === "KHR";
      const absAmt = Math.abs(Number(t.amount || 0));
      const fmtAmt = isKHR
        ? `${absAmt.toLocaleString("en-US")} ៛`
        : `$${absAmt.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

      const refCode = t.refId || t.id || "N/A";

      let stBadge = `<span style="background:rgba(16,185,129,0.14); color:#10b981; padding:3px 9px; border-radius:20px; font-size:0.72rem; font-weight:800;"><i class="fa-solid fa-circle-check"></i> Success</span>`;
      if (t.status === "Pending") {
        stBadge = `<span style="background:rgba(245,158,11,0.16); color:#f59e0b; padding:3px 9px; border-radius:20px; font-size:0.72rem; font-weight:800;"><i class="fa-solid fa-hourglass-half"></i> Pending</span>`;
      } else if (t.status === "Hold") {
        stBadge = `<span style="background:rgba(139,92,246,0.16); color:#8b5cf6; padding:3px 9px; border-radius:20px; font-size:0.72rem; font-weight:800;"><i class="fa-solid fa-lock"></i> Hold</span>`;
      } else if (t.status === "Refunded" || t.status === "Voided") {
        stBadge = `<span style="background:rgba(239,68,68,0.14); color:#ef4444; padding:3px 9px; border-radius:20px; font-size:0.72rem; font-weight:800;"><i class="fa-solid fa-rotate-left"></i> ${t.status}</span>`;
      }

      let quickBtnHtml = "";
      if (t.status === "Pending") {
        quickBtnHtml = `
          <button type="button" class="atrx-btn-sm" style="background:#ecfdf5; color:#059669; border-color:#a7f3d0;" onclick="handleAdminAction('approve', '${refCode}')" title="អនុម័តប្រតិបត្តិការ Pending ភ្លាមៗ">
            <i class="fa-solid fa-check"></i> អនុម័ត
          </button>
        `;
      } else if (t.status === "Hold") {
        quickBtnHtml = `
          <button type="button" class="atrx-btn-sm" style="background:#f3e8ff; color:#7e22ce; border-color:#d8b4fe;" onclick="handleAdminAction('release_hold', '${refCode}')" title="ដោះ Hold ទម្លាក់ប្រាក់ឱ្យហាង">
            <i class="fa-solid fa-unlock"></i> ដោះ Hold
          </button>
        `;
      }

      return `
        <tr style="border-bottom: 1px solid var(--border, #e2e8f0); transition: 0.15s;" onmouseover="this.style.background='rgba(15, 23, 42, 0.015)'" onmouseout="this.style.background='transparent'">
          <td style="padding: 13px 12px;">
            <div onclick="inspectSpecificTrx('${refCode}')" style="font-family: 'JetBrains Mono', monospace; font-weight: 900; font-size: 0.88rem; color: #0d9488; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;" title="ចុចដើម្បីពិនិត្យលម្អិត">
              <span>${refCode}</span>
              <i class="fa-solid fa-magnifying-glass-plus" style="font-size: 0.72rem;"></i>
            </div>
            <div style="font-size: 0.74rem; color: var(--text-muted); margin-top: 3px;">
              <i class="fa-regular fa-clock"></i> ${t.date || "N/A"}
            </div>
          </td>

          <td style="padding: 13px 12px;">
            <span class="atrx-cat-badge" style="background: ${cat.bg}; color: ${cat.color}; border: 1px solid ${cat.border};">
              <i class="fa-solid ${cat.icon}"></i>
              <span>${cat.label}</span>
            </span>
            <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 3px; font-weight: 700;">
              Via: ${t.trxMethod || "U-PAY System"}
            </div>
          </td>

          <td style="padding: 13px 12px;">
            <div style="font-weight: 800; font-size: 0.88rem; color: var(--text-main);">${t.senderName || "System"}</div>
            <div style="font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">
              Acc: ${t.senderAcc || "N/A"} ${t.cardNumber ? `• កាត ****${t.cardNumber.slice(-4)}` : ""}
            </div>
          </td>

          <td style="padding: 13px 12px;">
            <div style="font-weight: 800; font-size: 0.88rem; color: var(--text-main);">${t.receiverName || "System"}</div>
            <div style="font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">
              Acc: ${t.receiverAcc || "N/A"} ${t.merchantId ? `• MID: ${t.merchantId}` : ""}
            </div>
          </td>

          <td style="padding: 13px 12px;">
            <div style="font-family: 'JetBrains Mono', monospace; font-weight: 900; font-size: 0.96rem; color: var(--text-main); margin-bottom: 4px;">
              ${fmtAmt}
            </div>
            ${stBadge}
          </td>

          <td style="padding: 13px 12px; text-align: right; white-space: nowrap;">
            <div style="display: inline-flex; gap: 6px; align-items: center;">
              ${quickBtnHtml}
              <button type="button" class="atrx-btn-sm" style="background: #004d40; color: #ffffff;" onclick="inspectSpecificTrx('${refCode}')">
                <i class="fa-solid fa-microscope"></i> ពិនិត្យស៊ីជម្រៅ
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  const pageInfo = document.getElementById("atrxPageInfo");
  if (pageInfo) {
    pageInfo.innerText = `ទំព័រ ${currentAtrxPage} នៃ ${totalPages} (សរុប ${filteredSystemTrxList.length} ប្រតិបត្តិការ)`;
  }

  const prevBtn = document.getElementById("btnPrevAtrx");
  const nextBtn = document.getElementById("btnNextAtrx");
  if (prevBtn) {
    prevBtn.disabled = currentAtrxPage === 1;
    prevBtn.style.opacity = currentAtrxPage === 1 ? "0.5" : "1";
  }
  if (nextBtn) {
    nextBtn.disabled = currentAtrxPage >= totalPages;
    nextBtn.style.opacity = currentAtrxPage >= totalPages ? "0.5" : "1";
  }
}

window.changeAtrxPage = function (step) {
  const totalPages =
    Math.ceil(filteredSystemTrxList.length / ATRX_PER_PAGE) || 1;
  currentAtrxPage += step;
  if (currentAtrxPage < 1) currentAtrxPage = 1;
  if (currentAtrxPage > totalPages) currentAtrxPage = totalPages;
  renderAtrxLedgerTable();
};

window.inspectSpecificTrx = function (refId) {
  const input = document.getElementById("searchTrxId");
  if (input) {
    input.value = refId;
    searchTrx();
  }
};

// ============================================================================
// 🕵️‍♂️ ជំពូកទី ៤៖ ការត្រួតពិនិត្យវិក្កយបត្រស៊ីជម្រៅពី SERVER តាម `_id` (DEEP FORENSICS INSPECTOR)
// ============================================================================

/**
 * 🔹 ៤.១ ទាញយកទិន្នន័យកោសល្យវិច័យពិតប្រាកដពី `/api/admin/transaction/:id`
 */
async function searchTrx(silent = false) {
  const id = document.getElementById("searchTrxId")?.value.trim();
  if (!id) {
    return Swal.fire({
      icon: "warning",
      title: "សូមបញ្ចូលលេខកូដ",
      text: "សូមវាយបញ្ចូលលេខ Ref ID ឬ Hash Code ដើម្បីឆែកវិក្កយបត្រ!",
      customClass: { popup: "kh-text" },
    });
  }

  if (!silent) {
    Swal.fire({
      title: "កំពុងឆែកទិន្នន័យពិតពី Server...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
      customClass: { popup: "kh-text" },
    });
  }

  try {
    const res = await fetch(
      `/api/admin/transaction/${encodeURIComponent(id)}`,
      {
        headers: getAuthHeaders(),
      },
    );
    const data = await res.json();
    const box = document.getElementById("trxResult");
    if (!silent) Swal.close();

    if (data.success && data.transaction) {
      const t = data.transaction;
      currentInspectedTrx = t;

      const cat = classifyTrxCategory(t);
      const isPending = t.status === "Pending";
      const isHold = t.status === "Hold";
      const isRefunded = t.status === "Refunded" || t.status === "Voided";
      const isKHR = t.currency === "KHR";

      const absAmt = Math.abs(Number(t.amount || 0));
      const fmtAmt = isKHR
        ? `${absAmt.toLocaleString("en-US")} ៛`
        : `$${absAmt.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

      const feeVal = Math.abs(Number(t.fee || 0));
      const fmtFee = isKHR
        ? `${feeVal.toLocaleString("en-US")} ៛`
        : `$${feeVal.toFixed(2)}`;

      // 🎯 ១. ទិន្នន័យពិតរបស់អ្នកផ្ញើ (Sender Real Data by `_id`)
      const sUserId = t.senderUserId || t.senderRealUsername || null;
      const sFullName = (
        t.senderRealFullName ||
        t.senderName ||
        "ប្រព័ន្ធធនាគារ (System)"
      ).toUpperCase();
      const sPhone = t.senderPhone || "មិនមានលេខទូរស័ព្ទ";
      const sAcc = t.senderAcc || "SYSTEM-WALLET";
      const sDevice = t.senderDevice || "មិនមានកំណត់ត្រាឧបករណ៍";
      const sIp = t.senderIp || "មិនមានកំណត់ត្រា IP";
      const sKyc = String(t.senderKyc || "Unverified").toUpperCase();
      const sKycColor =
        sKyc === "VERIFIED" || sKyc === "APPROVED"
          ? "#10b981"
          : sKyc === "SYSTEM"
            ? "#3b82f6"
            : "#ef4444";

      // 🎯 ២. ទិន្នន័យពិតរបស់អ្នកទទួល (Receiver Real Data by `_id`)
      const rUserId = t.receiverUserId || t.receiverRealUsername || null;
      const rFullName = (
        t.merchantName ||
        t.receiverRealFullName ||
        t.receiverName ||
        "ប្រព័ន្ធធនាគារ (System)"
      ).toUpperCase();
      const rPhone = t.receiverPhone || "មិនមានលេខទូរស័ព្ទ";
      const rAcc = t.receiverAcc || "SYSTEM-WALLET";
      const rDevice = t.receiverDevice || "មិនមានកំណត់ត្រាឧបករណ៍";
      const rIp = t.receiverIp || "មិនមានកំណត់ត្រា IP";
      const rKyc = String(t.receiverKyc || "Unverified").toUpperCase();
      const rKycColor =
        rKyc === "VERIFIED" || rKyc === "APPROVED"
          ? "#10b981"
          : rKyc === "SYSTEM"
            ? "#3b82f6"
            : "#ef4444";

      const canRefund =
        typeof adminRole === "undefined" ||
        adminRole === "super_admin" ||
        (typeof myAdminPermissions !== "undefined" &&
          myAdminPermissions?.actions?.refund);

      const refCode = t.refId || t.id;
      let actionButtonsHtml = "";

      if (isPending) {
        actionButtonsHtml += `
          <button type="button" onclick="handleAdminAction('approve', '${refCode}')" style="padding: 11px 22px; background: linear-gradient(135deg, #059669, #10b981); color: white; border: none; border-radius: 11px; font-weight: 800; font-size: 0.9rem; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.25);">
            <i class="fa-solid fa-circle-check"></i> អនុម័តប្រតិបត្តិការ (Approve Pending)
          </button>
        `;
      }

      if (isHold) {
        actionButtonsHtml += `
          <button type="button" onclick="handleAdminAction('release_hold', '${refCode}')" style="padding: 11px 22px; background: linear-gradient(135deg, #7e22ce, #9333ea); color: white; border: none; border-radius: 11px; font-weight: 800; font-size: 0.9rem; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 4px 12px rgba(147, 51, 234, 0.25);">
            <i class="fa-solid fa-unlock-keyhole"></i> ដោះ Hold ទម្លាក់ប្រាក់ឱ្យហាង (Release Hold)
          </button>
        `;
      }

      if (!isRefunded && canRefund) {
        actionButtonsHtml += `
          <button type="button" onclick="handleAdminAction('refund', '${refCode}')" style="padding: 11px 20px; background: rgba(239, 68, 68, 0.12); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.35); border-radius: 11px; font-weight: 800; font-size: 0.9rem; cursor: pointer; display: inline-flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-rotate-left"></i> បង្វិលប្រាក់សងអតិថិជនវិញ (Refund)
          </button>
        `;
      }

      actionButtonsHtml += `
        <button type="button" onclick="openOfficialSlipFromTrxCheck()" style="padding: 11px 18px; background: var(--bg-body, #f1f5f9); color: var(--text-main, #0f172a); border: 1px solid var(--border, #cbd5e1); border-radius: 11px; font-weight: 800; font-size: 0.88rem; cursor: pointer; display: inline-flex; align-items: center; gap: 8px;">
          <i class="fa-solid fa-receipt" style="color: #0d9488;"></i> មើលវិក្កយបត្រ (View Slip)
        </button>
      `;

      box.style.display = "block";
      box.innerHTML = `
        <!-- ក្បាលផ្ទាំង Forensics -->
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; padding-bottom: 16px; margin-bottom: 18px; border-bottom: 1px solid var(--border, #e2e8f0);">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 48px; height: 48px; border-radius: 14px; background: ${cat.bg}; color: ${cat.color}; border: 1px solid ${cat.border}; display: flex; align-items: center; justify-content: center; font-size: 1.35rem;">
              <i class="fa-solid ${cat.icon}"></i>
            </div>
            <div>
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <span style="font-family: 'JetBrains Mono', monospace; font-weight: 900; font-size: 1.15rem; color: var(--text-main);">${refCode}</span>
                <span class="atrx-cat-badge" style="background: ${cat.bg}; color: ${cat.color}; border: 1px solid ${cat.border};">${cat.label}</span>
                <span style="padding: 3px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 800; background: ${isPending ? "#fef3c7" : isHold ? "#f3e8ff" : isRefunded ? "#fee2e2" : "#dcfce7"}; color: ${isPending ? "#d97706" : isHold ? "#7e22ce" : isRefunded ? "#ef4444" : "#059669"};">
                  ● ${t.status || "Success"}
                </span>
              </div>
              <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 3px; font-family: monospace;">
                Hash: ${t.hash || "N/A"} • កាលបរិច្ឆេទ៖ ${t.date || "N/A"}
              </div>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 14px;">
            <div style="text-align: right;">
              <div style="font-size: 0.72rem; color: var(--text-muted); font-weight: 800;">ចំនួនទឹកប្រាក់ប្រតិបត្តិការ</div>
              <div style="font-family: 'JetBrains Mono', monospace; font-size: 1.65rem; font-weight: 900; color: ${isRefunded ? "#ef4444" : "#10b981"}; text-decoration: ${isRefunded ? "line-through" : "none"};">
                ${fmtAmt}
              </div>
            </div>
            <button type="button" onclick="document.getElementById('trxResult').style.display='none'; currentInspectedTrx=null;" title="បិទផ្ទាំងលម្អិត" style="width: 36px; height: 36px; border-radius: 50%; border: 1px solid var(--border); background: var(--bg-body); color: var(--text-muted); cursor: pointer; font-size: 1rem;">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
        </div>

        <!-- ផ្លូវលំហូរសាច់ប្រាក់ពិត (Sender ➔ Receiver Flow) -->
        <div class="atrx-flow-grid">
          <!-- 📤 ភាគីអ្នកផ្ញើ (Sender Box) -->
          <div class="atrx-party-box">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 2px solid #ef4444;">
              <span style="font-weight: 800; font-size: 0.9rem; color: #ef4444;"><i class="fa-solid fa-arrow-up-from-bracket"></i> ១. ភាគីអ្នកផ្ញើ / ប្រភពប្រាក់ (SENDER)</span>
              ${
                sUserId
                  ? `<button type="button" onclick="atrxJumpTo360('${sUserId}')" style="background:#eff6ff; color:#2563eb; border:1px solid #bfdbfe; border-radius:6px; padding:2px 8px; font-size:0.72rem; font-weight:800; cursor:pointer;">បើក 360° <i class="fa-solid fa-arrow-up-right-from-square" style="font-size:0.6rem;"></i></button>`
                  : ""
              }
            </div>
            <div class="atrx-row"><span class="atrx-lbl">ឈ្មោះពេញ (Full Name)</span><span class="atrx-val">${sFullName}</span></div>
            <div class="atrx-row"><span class="atrx-lbl">លេខគណនីកាត់ប្រាក់</span><span class="atrx-val" style="font-family:'JetBrains Mono',monospace; color:#0d9488;">${sAcc}</span></div>
            ${
              t.cardNumber
                ? `<div class="atrx-row"><span class="atrx-lbl">កាតប្រើប្រាស់ (Card)</span><span class="atrx-val" style="font-family:monospace; color:#7e22ce;">${t.cardNumber.slice(0, 4)} **** **** ${t.cardNumber.slice(-4)}</span></div>`
                : ""
            }
            ${
              t.depositorName
                ? `<div class="atrx-row"><span class="atrx-lbl">អ្នកដាក់/ដកប្រាក់ផ្ទាល់</span><span class="atrx-val" style="color:#d97706;">${t.depositorName}${t.depositorAcc ? ` (${t.depositorAcc})` : ""}</span></div>`
                : ""
            }
            <div class="atrx-row"><span class="atrx-lbl">លេខទូរស័ព្ទពិត</span><span class="atrx-val">${sPhone}</span></div>
            <div class="atrx-row"><span class="atrx-lbl">ស្ថានភាព KYC ពិត</span><span class="atrx-val" style="color:${sKycColor};">${sKyc}</span></div>
            <div class="atrx-row"><span class="atrx-lbl">ឧបករណ៍ចុងក្រោយពិត</span><span class="atrx-val">${sDevice}</span></div>
            <div class="atrx-row"><span class="atrx-lbl">អាសយដ្ឋាន IP ពិត</span><span class="atrx-val" style="font-family:monospace;">${sIp}</span></div>
          </div>

          <!-- ➡️ សញ្ញាព្រួញកណ្តាល -->
          <div class="atrx-flow-arrow" style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 0 4px;">
            <div style="width: 42px; height: 42px; border-radius: 50%; background: rgba(13, 148, 136, 0.12); color: #0d9488; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; border: 1px solid rgba(13, 148, 136, 0.3);">
              <i class="fa-solid fa-angles-right"></i>
            </div>
          </div>

          <!-- 📥 ភាគីអ្នកទទួល (Receiver Box) -->
          <div class="atrx-party-box">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 2px solid #10b981;">
              <span style="font-weight: 800; font-size: 0.9rem; color: #10b981;"><i class="fa-solid fa-arrow-down-to-bracket"></i> ២. ភាគីអ្នកទទួល / គោលដៅ (RECEIVER)</span>
              ${
                rUserId
                  ? `<button type="button" onclick="atrxJumpTo360('${rUserId}')" style="background:#eff6ff; color:#2563eb; border:1px solid #bfdbfe; border-radius:6px; padding:2px 8px; font-size:0.72rem; font-weight:800; cursor:pointer;">បើក 360° <i class="fa-solid fa-arrow-up-right-from-square" style="font-size:0.6rem;"></i></button>`
                  : ""
              }
            </div>
            <div class="atrx-row"><span class="atrx-lbl">ឈ្មោះអ្នកទទួល / ហាង</span><span class="atrx-val">${rFullName}</span></div>
            <div class="atrx-row"><span class="atrx-lbl">លេខគណនីទទួលប្រាក់</span><span class="atrx-val" style="font-family:'JetBrains Mono',monospace; color:#0d9488;">${rAcc}</span></div>
            ${
              t.merchantId
                ? `<div class="atrx-row"><span class="atrx-lbl">លេខសម្គាល់ហាង (MID)</span><span class="atrx-val" style="font-family:monospace; color:#8b5cf6;">${t.merchantId}${t.merchantLinkedAcc ? ` (គណនីភ្ជាប់: ${t.merchantLinkedAcc})` : ""}</span></div>`
                : ""
            }
            <div class="atrx-row"><span class="atrx-lbl">លេខទូរស័ព្ទពិត</span><span class="atrx-val">${rPhone}</span></div>
            <div class="atrx-row"><span class="atrx-lbl">ស្ថានភាព KYC ពិត</span><span class="atrx-val" style="color:${rKycColor};">${rKyc}</span></div>
            <div class="atrx-row"><span class="atrx-lbl">ឧបករណ៍ចុងក្រោយពិត</span><span class="atrx-val">${rDevice}</span></div>
            <div class="atrx-row"><span class="atrx-lbl">អាសយដ្ឋាន IP ពិត</span><span class="atrx-val" style="font-family:monospace;">${rIp}</span></div>
          </div>
        </div>

        <!-- ព័ត៌មានបន្ថែម (Fee, Remark, Cashier Maker/Checker) -->
        <div style="background: var(--bg-body, #f8fafc); border: 1px solid var(--border, #e2e8f0); border-radius: 14px; padding: 14px 18px; margin-bottom: 18px; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; font-size: 0.84rem;">
          <div>
            <span style="color: var(--text-muted); font-weight: 700;">ថ្លៃសេវាផ្ទេរ (Fee)៖</span>
            <b style="color: #ef4444; font-family: monospace; margin-left: 6px;">${fmtFee}</b>
          </div>
          <div>
            <span style="color: var(--text-muted); font-weight: 700;">មធ្យោបាយទូទាត់៖</span>
            <b style="color: var(--text-main); margin-left: 6px;">${t.trxMethod || t.type || "U-PAY System"}</b>
          </div>
          ${
            t.cashierMaker
              ? `<div><span style="color: var(--text-muted); font-weight: 700;">បេឡាករ (Maker)៖</span> <b style="color:#2563eb; margin-left:4px;">${String(t.cashierMaker).replace(/^@/, "")}</b>${t.cashierChecker ? ` • អនុម័តដោយ: <b>${String(t.cashierChecker).replace(/^@/, "")}</b>` : ""}</div>`
              : ""
          }
          <div style="grid-column: 1 / -1;">
            <span style="color: var(--text-muted); font-weight: 700;">ចំណាំប្រតិបត្តិការ (Remark)៖</span>
            <b style="color: var(--text-main); margin-left: 6px;">${t.remark || "-"}</b>
          </div>
        </div>

        <!-- ប៊ូតុងបញ្ជាខាងក្រោម -->
        <div style="display: flex; justify-content: flex-end; align-items: center; gap: 12px; flex-wrap: wrap;">
          ${actionButtonsHtml}
        </div>
      `;

      box.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } else {
      box.style.display = "none";
      Swal.fire({
        icon: "error",
        title: "រកមិនឃើញវិក្កយបត្រ",
        text:
          data.message ||
          "មិនមានទិន្នន័យប្រតិបត្តិការដែលមានលេខ Ref ID ឬ Hash នេះនៅក្នុងប្រព័ន្ធទេ!",
        customClass: { popup: "kh-text" },
      });
    }
  } catch (error) {
    if (!silent) Swal.close();
    Swal.fire("Error", "មានបញ្ហាតភ្ជាប់ទៅកាន់ Server!", "error");
  }
}

window.openOfficialSlipFromTrxCheck = function () {
  if (!currentInspectedTrx) return;
  if (
    typeof c360FilteredTrx !== "undefined" &&
    typeof c360ViewTrxDetails === "function"
  ) {
    c360FilteredTrx = [currentInspectedTrx];
    c360ViewTrxDetails(0);
  }
};

/**
 * 🔹 ៤.២ លោតទៅកាន់ទំព័រ Customer 360° តាមរយៈ MongoDB `_id` របស់អ្នកផ្ញើ ឬអ្នកទទួល
 */
window.atrxJumpTo360 = function (targetId) {
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

// ============================================================================
// ⚡ ជំពូកទី ៥៖ សកម្មភាពអនុម័ត Pending, ដោះ Hold ហាង និងបង្វិលប្រាក់ (APPROVE, RELEASE & REFUND)
// ============================================================================

/**
 * 🔹 ៥.១ ដំណើរការអនុម័ត Pending, ដោះ Hold ហាង ឬធ្វើ Refund ត្រឡប់ទៅអតិថិជនវិញ
 */
async function handleAdminAction(action, id) {
  if (!id || id === "undefined") {
    return Swal.fire(
      "Error",
      "រកមិនឃើញលេខសម្គាល់ប្រតិបត្តិការ (Ref ID) ទេ!",
      "error",
    );
  }

  let reason = "Admin Action";
  let endpoint = "/api/admin/approve-transaction";

  if (action === "approve") {
    const ask = await Swal.fire({
      title:
        '<span class="kh-text" style="color:#059669; font-size:1.2rem;">អនុម័តប្រតិបត្តិការ Pending នេះ?</span>',
      html: `<span class="kh-text" style="font-size:0.9rem; color:var(--text-muted);">តើអ្នកពិតជាចង់អនុម័តប្រតិបត្តិការ <b>#${id}</b> ឱ្យទៅជាជោគជ័យ (Success) មែនទេ?</span>`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#10b981",
      cancelButtonColor: "#64748b",
      confirmButtonText: '<span class="kh-text">បាទ/ចាស អនុម័តឥឡូវនេះ</span>',
      cancelButtonText: '<span class="kh-text">បោះបង់</span>',
      customClass: { popup: "modal-radius kh-text atrx-swal-scope" },
    });
    if (!ask.isConfirmed) return;
    endpoint = "/api/admin/approve-transaction";
  } else if (action === "release_hold") {
    const ask = await Swal.fire({
      title:
        '<span class="kh-text" style="color:#7e22ce; font-size:1.2rem;">ដោះ Hold ទម្លាក់ប្រាក់ឱ្យហាង?</span>',
      html: `<span class="kh-text" style="font-size:0.9rem; color:var(--text-muted);">តើអ្នកពិតជាចង់ដោះ Hold សម្រាប់ប្រតិបត្តិការ <b>#${id}</b> និងបញ្ចូលទៅក្នុងចំណូលពិតរបស់ហាងមែនទេ?</span>`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#7e22ce",
      cancelButtonColor: "#64748b",
      confirmButtonText: '<span class="kh-text">បាទ/ចាស ដោះ Hold</span>',
      cancelButtonText: '<span class="kh-text">បោះបង់</span>',
      customClass: { popup: "modal-radius kh-text atrx-swal-scope" },
    });
    if (!ask.isConfirmed) return;
    endpoint = "/api/admin/release-merchant-hold";
  } else if (action === "refund") {
    const { value: text, isDismissed } = await Swal.fire({
      title:
        '<span class="kh-text" style="color:#ef4444; font-size:1.2rem;">បញ្ជាក់ការបង្វិលប្រាក់ (Refund Transaction)</span>',
      html: `
        <p class="kh-text" style="font-size:0.88rem; color:var(--text-muted); text-align:left; margin-bottom:10px;">
          ប្រព័ន្ធនឹងកាត់ទឹកប្រាក់ពីគណនីអ្នកទទួល/ហាង ហើយបង្វិលចូលគណនីដើមរបស់អ្នកផ្ញើវិញសម្រាប់ប្រតិបត្តិការ <b>#${id}</b>។ សូមបញ្ជាក់មូលហេតុ៖
        </p>
        <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:10px;">
          <span onclick="document.getElementById('atrx-refund-reason').value='អតិថិជនផ្ទេរប្រាក់ច្រឡំគណនី / ច្រឡំចំនួនទឹកប្រាក់'" style="font-size:0.74rem; background:#fef2f2; color:#dc2626; border:1px solid #fecaca; padding:4px 10px; border-radius:14px; cursor:pointer; font-weight:700;">ផ្ទេរច្រឡំគណនី/ទឹកប្រាក់</span>
          <span onclick="document.getElementById('atrx-refund-reason').value='ហាងទំនិញស្នើសុំបង្វិលប្រាក់ជូនអតិថិជនវិញ'" style="font-size:0.74rem; background:#fef2f2; color:#dc2626; border:1px solid #fecaca; padding:4px 10px; border-radius:14px; cursor:pointer; font-weight:700;">ហាងស្នើសុំ Refund</span>
        </div>
        <textarea id="atrx-refund-reason" class="swal2-textarea kh-text" placeholder="វាយបញ្ចូលមូលហេតុនៃការ Refund នៅទីនេះ..." style="width:100%; margin:0; box-sizing:border-box; border-radius:10px; font-size:0.9rem;"></textarea>
      `,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#64748b",
      confirmButtonText:
        '<span class="kh-text">យល់ព្រមបង្វិលប្រាក់ (Refund)</span>',
      cancelButtonText: '<span class="kh-text">បោះបង់</span>',
      customClass: { popup: "modal-radius kh-text atrx-swal-scope" },
      preConfirm: () => {
        const r = document.getElementById("atrx-refund-reason").value.trim();
        if (!r) {
          Swal.showValidationMessage(
            "អ្នកត្រូវតែបញ្ចូលមូលហេតុនៃការ Refund ជាដាច់ខាត!",
          );
          return false;
        }
        return r;
      },
    });
    if (isDismissed || !text) return;
    reason = text;
    endpoint = "/api/admin/refund-transaction";
  }

  try {
    Swal.fire({
      title: "កំពុងដំណើរការ...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
      customClass: { popup: "kh-text" },
    });

    const res = await fetch(endpoint, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ refId: id, reason }),
    });
    const data = await res.json();

    if (res.ok && data.success) {
      await atrxRefreshLedger();
      Swal.fire({
        icon: "success",
        title: "ជោគជ័យ!",
        text: data.message,
        timer: 2000,
        showConfirmButton: false,
        customClass: { popup: "modal-radius kh-text atrx-swal-scope" },
      });
    } else {
      Swal.fire({
        icon: "error",
        title: "បរាជ័យ!",
        text: data.message || "មិនអាចធ្វើប្រតិបត្តិការបានទេ",
        customClass: { popup: "modal-radius kh-text atrx-swal-scope" },
      });
    }
  } catch (err) {
    Swal.fire("Error", "បញ្ហាក្នុងការតភ្ជាប់ទៅកាន់ Server!", "error");
  }
}

/**
 * 🔹 ៥.២ ចាប់ផ្តើមដំណើរការតារាងប្រតិបត្តិការដោយស្វ័យប្រវត្តិពេលបើកទំព័រ
 */
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => initAtrxLedger(), 900);

  document.body.addEventListener("click", (e) => {
    const navItem = e.target.closest(
      "[onclick*='check-trx'], [data-target*='check-trx']",
    );
    if (navItem) {
      setTimeout(() => initAtrxLedger(), 100);
    }
  });
});
