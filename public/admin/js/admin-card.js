// ============================================================================
// ឯកសារ: js/admin-card.js (100% Pro Clean - Global Card Command Center)
// អត្ថន័យ: គ្រប់គ្រងកាតទាំង ៣ ប្រភេទ (Virtual, Debit, Credit), ដឹកជញ្ជូន និង NFC
// ស្តង់ដារថ្មី: ចាប់ទិន្នន័យម្ចាស់កាត និងកាតតាម MongoDB `_id` សុទ្ធសាធ + បង្ហាញឈ្មោះពេញ (fullName)
// ============================================================================

// ============================================================================
// 🎨 ជំពូកទី ១៖ អថេរសកល និងអនុគមន៍ជំនួយកាត (GLOBAL STATE & CARD HELPERS)
// ============================================================================
let gcCurrentCategoryFilter = "ALL";
let gcAllFlattenedCards = [];
let gcCurrentCardPage = 1;
const gcCardsPerPage = 4; // បង្ហាញ ៤ កាតក្នុង ១ ទំព័រ
let gcIsFetchingCards = false;

/**
 * 🔹 ១.១ ផែនទី Theme របស់កាតទាំង ១០ ម៉ូដ
 */
function gcGetThemeClass(type) {
  const map = {
    standard: "theme-standard",
    fifa: "theme-fifa",
    metal: "theme-metal",
    celebrity: "theme-celebrity",
    anime: "theme-anime",
    gamer: "theme-gamer",
    eco: "theme-eco",
    platinum: "theme-platinum",
    animal: "theme-animal",
    custom: "theme-custom",
  };
  return map[type] || "theme-standard";
}

/**
 * 🔹 ១.២ មុខងារបម្លែងលេខ UID របស់បន្ទះឈីប NFC ឱ្យទៅជាទម្រង់ស្តង់ដារ Hex ៨ ខ្ទង់
 */
function normalizeUID(uid) {
  if (!uid) return "";
  uid = String(uid).replaceAll(":", "").trim().toUpperCase();
  if (/^\d{10}$/.test(uid)) {
    let hex = parseInt(uid, 10).toString(16).toUpperCase().padStart(8, "0");
    return (
      hex.substring(6, 8) +
      hex.substring(4, 6) +
      hex.substring(2, 4) +
      hex.substring(0, 2)
    );
  }
  return uid;
}

/**
 * 🔹 ១.៣ មុខងារបង្កើតលេខ Tracking អូតូតាមក្រុមហ៊ុនដឹកជញ្ជូន
 */
window.gcGenerateTrackingCode = function (method) {
  const rand8 = Math.floor(10000000 + Math.random() * 90000000);
  if (method === "Virak Buntham") return `VET-${rand8}`;
  if (method === "J&T Express") return `JNT-${rand8}`;
  if (method === "GrabExpress") return `GRB-${rand8}`;
  return "យកផ្ទាល់នៅសាខា (Branch Pickup)";
};

/**
 * 🔹 ១.៤ អនុគមន៍ស្វែងរកកាតក្នុងបញ្ជីរួមតាមរយៈ `ownerId` (`_id`) និង `cardId`
 */
function gcFindFlattenedCard(ownerIdentifier, cardId) {
  const cleanOwner = String(ownerIdentifier || "").trim();
  const cleanCardId = String(cardId || "").trim();

  return (
    gcAllFlattenedCards.find(
      (item) =>
        (String(item.id) === cleanCardId || String(item._id) === cleanCardId) &&
        (String(item.ownerId) === cleanOwner ||
          String(item.ownerUsername) === cleanOwner),
    ) ||
    gcAllFlattenedCards.find(
      (item) =>
        String(item.id) === cleanCardId || String(item._id) === cleanCardId,
    ) ||
    null
  );
}

/**
 * 🔹 ១.៥ អនុគមន៍លោតទៅកាន់ផ្ទាំង Customer 360° តាមរយៈ MongoDB `_id` របស់ម្ចាស់កាតផ្ទាល់!
 */
window.gcJumpToCustomer360 = function (ownerId) {
  if (typeof goToCustomer360 === "function") {
    goToCustomer360(ownerId);
  } else if (typeof showSection === "function") {
    showSection("customer-360");
    const inp = document.getElementById("searchC360");
    if (inp) inp.value = ownerId;
    if (typeof searchCustomer360 === "function") searchCustomer360();
  }
};

// ============================================================================
// 🔄 ជំពូកទី ២៖ ម៉ាស៊ីនប្រមូល និងផ្គូផ្គងទិន្នន័យកាតតាម `_id` (CARD COLLECTION BY `_id`)
// ============================================================================

/**
 * 🔹 ២.១ ប្រមូលទិន្នន័យកាតទាំងអស់ និងចាប់គូជាមួយម្ចាស់គណនីតាម `userId` (`_id`) ១០០%!
 */
window.gcCollectCardsFromUsers = function () {
  const users = Array.isArray(window.globalUsersData)
    ? window.globalUsersData
    : [];
  const list = [];
  const seenCardKeys = new Set();

  // ១. ប្រមូលពី window.globalCardsData (ទាញមកពី /api/admin/all-cards នៃ Model Card.js ថ្មី)
  if (
    Array.isArray(window.globalCardsData) &&
    window.globalCardsData.length > 0
  ) {
    window.globalCardsData.forEach((entry) => {
      const c = entry.card || entry;
      if (!c || !c.number) return;

      const cardKey = String(c._id || c.id || c.number);
      if (seenCardKeys.has(cardKey)) return;
      seenCardKeys.add(cardKey);

      const targetUserId = String(c.userId || entry.user?._id || "");
      // 🎯 ចាប់គូម្ចាស់កាតតាម MongoDB `_id` ជាអាទិភាពទី ១!
      const ownerObj =
        users.find(
          (u) => targetUserId && String(u._id || u.id) === targetUserId,
        ) ||
        users.find((u) => u.username === c.username) ||
        entry.user ||
        {};

      const canonicalOwnerId = String(
        ownerObj._id || ownerObj.id || targetUserId || "",
      );

      list.push({
        ...c,
        id: String(c.id || c._id),
        _id: String(c._id || c.id),
        ownerId: canonicalOwnerId,
        ownerUsername: ownerObj.username || c.username || "Unknown",
        ownerFullName:
          ownerObj.fullName || ownerObj.name || c.username || "អតិថិជន U-Pay",
        ownerPhone: ownerObj.phone || ownerObj.phoneNumber || "N/A",
        ownerProfileImage:
          ownerObj.profileImage || "../images/default-avatar.png",
        ownerObj: ownerObj,
      });
    });
  }

  // ២. Fallback៖ ប្រមូលពី u.virtualCards ប្រសិនបើមានភ្ជាប់មកជាមួយ User Object
  users.forEach((u) => {
    if (Array.isArray(u.virtualCards)) {
      const canonicalOwnerId = String(u._id || u.id || "");
      u.virtualCards.forEach((c) => {
        if (!c || !c.number) return;
        const cardKey = String(c._id || c.id || c.number);
        if (seenCardKeys.has(cardKey)) return;
        seenCardKeys.add(cardKey);

        list.push({
          ...c,
          id: String(c.id || c._id),
          _id: String(c._id || c.id),
          ownerId: canonicalOwnerId,
          ownerUsername: u.username,
          ownerFullName: u.fullName || u.username,
          ownerPhone: u.phone || u.phoneNumber || "N/A",
          ownerProfileImage: u.profileImage || "../images/default-avatar.png",
          ownerObj: u,
        });
      });
    }
  });

  return list;
};

/**
 * 🔹 ២.២ ទាញយកទិន្នន័យកាតថ្មីៗពី Server និងធ្វើបច្ចុប្បន្នភាពតារាង
 */
window.gcRefreshAllCards = async function (silent = false) {
  const spinIcon = document.getElementById("gc-refresh-spin-icon");
  if (spinIcon) spinIcon.classList.add("fa-spin");

  try {
    if (typeof loadCardsModuleData === "function") {
      await loadCardsModuleData();
    } else if (typeof loadData === "function") {
      await loadData();
    }
    renderGlobalCardsTable();
    if (spinIcon) spinIcon.classList.remove("fa-spin");

    if (!silent) {
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "ទិន្នន័យកាតត្រូវបានធ្វើបច្ចុប្បន្នភាព!",
        showConfirmButton: false,
        timer: 1200,
      });
    }
  } catch (e) {
    if (spinIcon) spinIcon.classList.remove("fa-spin");
  }
};

window.gcChangeCardPage = function (step) {
  gcCurrentCardPage += step;
  renderGlobalCardsTable();
};

window.gcSetCategoryFilter = function (filterKey) {
  gcCurrentCategoryFilter = filterKey;
  gcCurrentCardPage = 1;

  document.querySelectorAll(".gc-filter-pill").forEach((btn) => {
    btn.classList.toggle(
      "active",
      btn.getAttribute("data-filter") === filterKey,
    );
  });

  document.querySelectorAll(".gc-kpi-card").forEach((box) => {
    box.classList.remove("active-kpi");
  });
  const activeKpi = document.getElementById(`gc-kpi-${filterKey}`);
  if (activeKpi) activeKpi.classList.add("active-kpi");

  renderGlobalCardsTable();
};

function filterCards() {
  gcCurrentCardPage = 1;
  renderGlobalCardsTable();
}

// ============================================================================
// 📋 ជំពូកទី ៣៖ ការគូរតារាងកាតទាំងស្រុង និងបែងចែកទំព័រ (RICH BANKING TABLE & PAGINATION)
// ============================================================================
window.renderGlobalCardsTable = async function () {
  const tbody = document.getElementById("cardTableBody");
  if (!tbody) return;

  gcAllFlattenedCards = window.gcCollectCardsFromUsers();

  // បើមិនទាន់មានទិន្នន័យកាតក្នុង Memory ទេ ឱ្យទាញពី Backend `/api/admin/all-cards` ដោយស្វ័យប្រវត្តិ១ដង
  if (
    gcAllFlattenedCards.length === 0 &&
    !gcIsFetchingCards &&
    typeof loadCardsModuleData === "function"
  ) {
    gcIsFetchingCards = true;
    await loadCardsModuleData();
    gcAllFlattenedCards = window.gcCollectCardsFromUsers();
    gcIsFetchingCards = false;
  }

  const totalCount = gcAllFlattenedCards.length;
  let virtualCount = 0;
  let physicalCount = 0;
  let nfcCount = 0;
  let pendingCount = 0;

  gcAllFlattenedCards.forEach((c) => {
    const cat = c.cardCategory || (c.isPhysical ? "debit" : "virtual");
    const isPhy =
      cat === "debit" ||
      cat === "credit" ||
      c.isPhysical ||
      Boolean(c.uid && c.uid !== "");

    if (isPhy) {
      physicalCount++;
      const st =
        c.deliveryStatus && c.deliveryStatus !== "None"
          ? c.deliveryStatus
          : "Requested";
      if (["Requested", "Printing", "Shipped", "Delivered"].includes(st)) {
        pendingCount++;
      }
    } else {
      virtualCount++;
    }

    if (c.uid && c.uid !== "" && !c.isLocked) {
      nfcCount++;
    }
  });

  const setTxt = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.innerText = val;
  };
  setTxt("gc-stat-total", totalCount);
  setTxt("gc-stat-virtual", virtualCount);
  setTxt("gc-stat-physical", physicalCount);
  setTxt("gc-stat-nfc", nfcCount);
  setTxt("gc-stat-pending", pendingCount);

  const keyword = (document.getElementById("searchCardBox")?.value || "")
    .toLowerCase()
    .trim();

  const filtered = gcAllFlattenedCards.filter((c) => {
    const cat = c.cardCategory || (c.isPhysical ? "debit" : "virtual");
    const isPhy =
      cat === "debit" ||
      cat === "credit" ||
      c.isPhysical ||
      Boolean(c.uid && c.uid !== "");
    const delivSt =
      c.deliveryStatus && c.deliveryStatus !== "None"
        ? c.deliveryStatus
        : isPhy
          ? "Requested"
          : "None";

    if (gcCurrentCategoryFilter === "VIRTUAL" && isPhy) return false;
    if (gcCurrentCategoryFilter === "PHYSICAL" && !isPhy) return false;
    if (gcCurrentCategoryFilter === "DEBIT" && cat !== "debit") return false;
    if (gcCurrentCategoryFilter === "CREDIT" && cat !== "credit") return false;
    if (gcCurrentCategoryFilter === "NFC" && (!c.uid || c.uid === ""))
      return false;
    if (
      gcCurrentCategoryFilter === "PENDING" &&
      !(
        isPhy &&
        ["Requested", "Printing", "Shipped", "Delivered"].includes(delivSt)
      )
    )
      return false;
    if (gcCurrentCategoryFilter === "FROZEN" && !c.isLocked) return false;

    if (keyword) {
      const searchStr = [
        c.ownerId,
        c.ownerFullName,
        c.ownerUsername,
        c.ownerPhone,
        c.number,
        c.number.slice(-4),
        c.cvv,
        c.name,
        c.type,
        c.uid,
        c.trackingNumber,
        c.linkedAccount,
        cat,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchStr.includes(keyword);
    }
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 55px 20px; color: var(--text-muted);">
          <i class="fa-regular fa-credit-card" style="font-size: 3rem; opacity: 0.3; margin-bottom: 12px; display: block;"></i>
          <div style="font-weight: 800; font-size: 1rem; color: var(--text-main);">មិនមានទិន្នន័យកាតដែលត្រូវនឹងការស្វែងរកទេ</div>
          <div style="font-size: 0.85rem; margin-top: 4px;">សូមសាកល្បងប្តូរប្រភេទ Filter ឬវាយពាក្យស្វែងរកផ្សេង។</div>
        </td>
      </tr>
    `;
    const pager = document.getElementById("gc-cards-pagination-footer");
    if (pager) pager.style.display = "none";
    return;
  }

  const totalPages = Math.ceil(filtered.length / gcCardsPerPage) || 1;
  if (gcCurrentCardPage > totalPages) gcCurrentCardPage = totalPages;
  if (gcCurrentCardPage < 1) gcCurrentCardPage = 1;

  const startIndex = (gcCurrentCardPage - 1) * gcCardsPerPage;
  const endIndex = startIndex + gcCardsPerPage;
  const pageItems = filtered.slice(startIndex, endIndex);

  const stepsOrder = [
    { key: "Requested", label: "១. ស្នើសុំផលិត", icon: "fa-file-signature" },
    { key: "Printing", label: "២. កំពុងបោះពុម្ព", icon: "fa-print" },
    { key: "Shipped", label: "៣. កំពុងដឹកជញ្ជូន", icon: "fa-truck-fast" },
    { key: "Delivered", label: "៤. ប្រគល់ជូនរួច", icon: "fa-box-open" },
    { key: "Activated", label: "៥. ភ្ញៀវបើកប្រើ", icon: "fa-circle-check" },
  ];

  tbody.dataset.gcCustomRendered = "true";
  tbody.innerHTML = pageItems
    .map((c) => {
      const ownerKey = c.ownerId || c.ownerUsername;
      const cat = c.cardCategory || (c.isPhysical ? "debit" : "virtual");
      const isPhy =
        cat === "debit" ||
        cat === "credit" ||
        c.isPhysical ||
        Boolean(c.uid && c.uid !== "");
      const hasUid = Boolean(c.uid && c.uid !== "");
      const last4 = c.number.slice(-4);
      const themeClass = gcGetThemeClass(c.type);

      let customBgStyle = "";
      if (c.type === "custom" && c.customBgUrl) {
        customBgStyle = `style="background: linear-gradient(rgba(0,0,0,0.35), rgba(0,0,0,0.85)), url('${c.customBgUrl}') center/cover no-repeat !important;"`;
      }

      let catBadgeHtml = "";
      if (cat === "credit") {
        catBadgeHtml = `<span style="background: #f3e8ff; color: #7e22ce; border: 1px solid #d8b4fe; padding: 3px 9px; border-radius: 6px; font-size: 0.72rem; font-weight: 800; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-gem"></i> កាតឥណទាន (CREDIT)</span>`;
      } else if (cat === "debit" || isPhy) {
        catBadgeHtml = `<span style="background: #e0f2fe; color: #0284c7; border: 1px solid #bae6fd; padding: 3px 9px; border-radius: 6px; font-size: 0.72rem; font-weight: 800; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-credit-card"></i> កាតឥណពន្ធ (DEBIT)</span>`;
      } else {
        catBadgeHtml = `<span style="background: #dcfce7; color: #059669; border: 1px solid #86efac; padding: 3px 9px; border-radius: 6px; font-size: 0.72rem; font-weight: 800; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-globe"></i> កាតនិម្មិត (VIRTUAL)</span>`;
      }

      let accOrCreditHtml = "";
      if (cat === "credit") {
        const lim = Number(c.creditLimit || 1000);
        const debt = Number(c.currentDebt || 0);
        accOrCreditHtml = `
          <div style="margin-top: 6px; font-size: 0.78rem;">
            <span style="color: #64748b; font-weight: 600;">ឥណទាន:</span> <b style="color: #0d9488; font-family: monospace;">$${lim.toLocaleString()}</b>
            <span style="margin-left: 6px; color: ${debt > 0 ? "#ef4444" : "#10b981"}; font-weight: 800; font-family: monospace;">(ជំពាក់ $${debt.toFixed(2)})</span>
          </div>
        `;
      } else {
        accOrCreditHtml = `
          <div style="margin-top: 6px; font-size: 0.78rem; color: #475569;">
            <i class="fa-solid fa-wallet" style="color: #0d9488;"></i> គណនី: <b style="font-family: monospace; color: var(--text-main);">${c.linkedAccount || "USD"}</b>
            <span style="color: #94a3b8;"> • Limit: $${c.dailyLimit || 500}</span>
          </div>
        `;
      }

      let fulfillmentCellHtml = "";
      if (!isPhy) {
        fulfillmentCellHtml = `
          <div style="font-size: 0.78rem; color: #64748b; background: var(--bg-body); padding: 8px 12px; border-radius: 10px; display: inline-block; border: 1px dashed var(--border);">
            <i class="fa-solid fa-bolt" style="color: #10b981;"></i> ឌីជីថលអនឡាញ (គ្មាន NFC / គ្មានដឹកជញ្ជូន)
          </div>
        `;
      } else {
        const curStepKey =
          c.deliveryStatus && c.deliveryStatus !== "None"
            ? c.deliveryStatus
            : "Requested";
        const curIdx = Math.max(
          0,
          stepsOrder.findIndex((s) => s.key === curStepKey),
        );

        const dotsHtml = stepsOrder
          .map((st, idx) => {
            const isDone = idx < curIdx;
            const isCurrent = idx === curIdx;
            const isNext = idx === curIdx + 1 && st.key !== "Activated";
            let cls = "locked";
            if (isDone) cls = "done";
            else if (isCurrent) cls = "current";
            else if (isNext) cls = "next-step";

            const tooltip =
              st.key === "Activated"
                ? `${st.label} (ភ្ញៀវជាអ្នកចុចបើកក្នុង App)`
                : isNext
                  ? `ចុចដើម្បីប្តូរទៅ៖ ${st.label}`
                  : st.label;

            return `
              <div class="gc-step-dot ${cls}" title="${tooltip}" onclick="gcQuickAdvanceStep('${ownerKey}', '${c.id}', '${st.key}')">
                <i class="fa-solid ${isDone ? "fa-check" : st.icon}"></i>
              </div>
            `;
          })
          .join("");

        fulfillmentCellHtml = `
          <div>
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              ${
                hasUid
                  ? `<span style="background: #ccfbf1; color: #0f766e; padding: 2px 8px; border-radius: 6px; font-size: 0.72rem; font-weight: 800; font-family: monospace;"><i class="fa-solid fa-microchip"></i> UID: ${c.uid}</span>`
                  : `<span onclick="quickBindNFC('${ownerKey}', '${c.id}')" style="background: #fef9c3; color: #d97706; border: 1px dashed #f59e0b; padding: 2px 8px; border-radius: 6px; font-size: 0.72rem; font-weight: 800; cursor: pointer;" title="ចុចដើម្បីស្កេនភ្ជាប់ NFC"><i class="fa-solid fa-wifi"></i> មិនទាន់ភ្ជាប់ NFC (ចុចស្កេន)</span>`
              }
              <span style="font-size: 0.74rem; font-weight: 800; color: #0f766e;">• ${stepsOrder[curIdx]?.label || curStepKey}</span>
            </div>
            <div class="gc-mini-stepper">${dotsHtml}</div>
            ${
              c.trackingNumber
                ? `<div style="font-size: 0.72rem; color: #64748b; margin-top: 4px;"><i class="fa-solid fa-truck"></i> ${c.deliveryMethod || ""}: <b style="color: #2563eb; font-family: monospace;">${c.trackingNumber}</b></div>`
                : ""
            }
          </div>
        `;
      }

      const statusHtml = `
        <div style="display: flex; flex-direction: column; gap: 5px; align-items: flex-start;">
          ${
            c.isLocked
              ? `<span style="background: #fee2e2; color: #ef4444; padding: 4px 10px; border-radius: 20px; font-size: 0.74rem; font-weight: 800;"><i class="fa-solid fa-snowflake"></i> ផ្អាក (Frozen)</span>`
              : `<span style="background: #dcfce7; color: #10b981; padding: 4px 10px; border-radius: 20px; font-size: 0.74rem; font-weight: 800;"><i class="fa-solid fa-circle-check"></i> ដំណើរការ (Active)</span>`
          }
          <span style="font-size: 0.7rem; color: ${c.isOnlinePayEnabled !== false ? "#059669" : "#94a3b8"}; font-weight: 700;">
            <i class="fa-solid fa-globe"></i> អនឡាញ: ${c.isOnlinePayEnabled !== false ? "ON" : "OFF"}
          </span>
        </div>
      `;

      return `
        <tr style="border-bottom: 1px solid var(--border, #e2e8f0); transition: 0.15s;" onmouseover="this.style.background='rgba(15, 23, 42, 0.015)'" onmouseout="this.style.background='transparent'">
          <td style="padding: 14px 12px;">
            <div style="display: flex; align-items: center; gap: 14px;">
              <div class="gc-mini-card ${themeClass}" ${customBgStyle} onclick="gcOpenCardCommandModal('${ownerKey}', '${c.id}')" title="ចុចដើម្បីបើកផ្ទាំងបញ្ជាកាត 3D">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <div style="width: 18px; height: 13px; background: linear-gradient(135deg, #fde047, #ca8a04); border-radius: 3px;"></div>
                  ${isPhy ? `<i class="fa-solid fa-wifi" style="font-size: 0.65rem; transform: rotate(90deg); opacity: ${hasUid ? "1" : "0.4"};"></i>` : ""}
                </div>
                <div style="font-family: 'Courier New', monospace; font-size: 0.68rem; font-weight: 800; letter-spacing: 0.5px; text-shadow: 0 1px 2px rgba(0,0,0,0.6);">
                  **** ${last4}
                </div>
                <div style="font-size: 0.5rem; font-weight: 800; text-transform: uppercase; opacity: 0.9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                  ${c.name || c.type}
                </div>
              </div>

              <div>
                <div style="font-weight: 800; font-size: 0.95rem; color: var(--text-main); display: flex; align-items: center; gap: 6px;">
                  <span>${c.ownerFullName}</span>
                  <button onclick="gcJumpToCustomer360('${ownerKey}')" title="បើកមើលក្នុង Customer 360° តាម _id" style="background: #f1f5f9; border: 1px solid #cbd5e1; color: #3b82f6; border-radius: 6px; padding: 2px 6px; font-size: 0.68rem; cursor: pointer; font-weight: 800;">
                    360° <i class="fa-solid fa-arrow-up-right-from-square" style="font-size: 0.6rem;"></i>
                  </button>
                </div>
                <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 2px;">
                  @${c.ownerUsername} • <i class="fa-solid fa-phone" style="font-size: 0.68rem;"></i> ${c.ownerPhone}
                </div>
              </div>
            </div>
          </td>

          <td style="padding: 14px 12px;">
            <div style="font-family: 'JetBrains Mono', monospace; font-weight: 800; font-size: 0.9rem; color: var(--text-main);">
              **** **** **** ${last4}
            </div>
            <div style="display: flex; align-items: center; gap: 6px; margin-top: 5px; flex-wrap: wrap;">
              <span onclick="navigator.clipboard.writeText('${last4}'); Swal.fire({toast:true, position:'top-end', icon:'success', title:'បានចម្លងលេខ ៤ ខ្ទង់!', showConfirmButton:false, timer:1000});" style="background: #0f172a; color: #fef08a; padding: 2px 8px; border-radius: 6px; font-size: 0.72rem; font-family: monospace; font-weight: 900; cursor: pointer;" title="ចុចដើម្បីចម្លងលេខ ៤ ខ្ទង់ចុងក្រោយ">
                <i class="fa-solid fa-key"></i> ៤ខ្ទង់: ${last4}
              </span>
              <span style="font-size: 0.72rem; color: #64748b; font-family: monospace;">EXP: ${c.expiry || "12/28"}</span>
            </div>
          </td>

          <td style="padding: 14px 12px;">
            ${catBadgeHtml}
            ${accOrCreditHtml}
          </td>

          <td style="padding: 14px 12px;">
            ${fulfillmentCellHtml}
          </td>

          <td style="padding: 14px 12px;">
            ${statusHtml}
          </td>

          <td style="padding: 14px 12px; text-align: right; white-space: nowrap;">
            <div style="display: inline-flex; gap: 6px; align-items: center;">
              ${
                isPhy
                  ? hasUid
                    ? `<button onclick="unbindNFC('${ownerKey}', '${c.id}')" class="gc-btn-act" style="background: #fef2f2; color: #ef4444; border-color: #fca5a5;" title="ផ្តាច់បន្ទះឈីប NFC">
                         <i class="fa-solid fa-link-slash"></i> ផ្តាច់ NFC
                       </button>`
                    : `<button onclick="quickBindNFC('${ownerKey}', '${c.id}')" class="gc-btn-act" style="background: #eff6ff; color: #2563eb; border-color: #bfdbfe;" title="ស្កេនភ្ជាប់បន្ទះឈីប NFC">
                         <i class="fa-solid fa-wifi"></i> ភ្ជាប់ NFC
                       </button>`
                  : ""
              }

              <button onclick="toggleCardLock('${ownerKey}', '${c.id}', ${Boolean(c.isLocked)})" class="gc-btn-act" style="background: ${c.isLocked ? "#dcfce7" : "#f1f5f9"}; color: ${c.isLocked ? "#059669" : "#475569"}; border-color: ${c.isLocked ? "#86efac" : "#cbd5e1"};" title="${c.isLocked ? "បើកដំណើរការកាតវិញ" : "ផ្អាកកាតបណ្តោះអាសន្ន"}">
                <i class="fa-solid ${c.isLocked ? "fa-unlock" : "fa-snowflake"}"></i>
              </button>

              <button onclick="gcOpenCardCommandModal('${ownerKey}', '${c.id}')" class="gc-btn-act" style="background: #004d40; color: #ffffff;" title="បើកផ្ទាំងបញ្ជាគ្រប់គ្រងកាតពេញលេញ">
                <i class="fa-solid fa-sliders"></i> គ្រប់គ្រង
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  let pagerContainer = document.getElementById("gc-cards-pagination-footer");
  if (!pagerContainer) {
    pagerContainer = document.createElement("div");
    pagerContainer.id = "gc-cards-pagination-footer";
    pagerContainer.style.cssText =
      "display: flex; justify-content: space-between; align-items: center; padding: 14px 20px; background: var(--bg-body, #f8fafc); border-top: 1px solid var(--border, #e2e8f0); font-family: 'Kantumruy Pro', sans-serif;";
    tbody.closest(".table-container").after(pagerContainer);
  }
  pagerContainer.style.display = "flex";

  pagerContainer.innerHTML = `
    <button onclick="gcChangeCardPage(-1)" class="kh-text" style="padding: 7px 14px; border-radius: 8px; border: 1px solid var(--border, #cbd5e1); background: var(--bg-card, white); color: var(--text-main); font-weight: 700; cursor: pointer;" ${gcCurrentCardPage === 1 ? "disabled" : ""}>
      <i class="fa-solid fa-chevron-left"></i> ថយក្រោយ
    </button>
    <span class="kh-text" style="font-size: 0.85rem; font-weight: 700; color: var(--text-main);">
      ទំព័រ ${gcCurrentCardPage} នៃ ${totalPages} (សរុប ${filtered.length} កាត)
    </span>
    <button onclick="gcChangeCardPage(1)" class="kh-text" style="padding: 7px 14px; border-radius: 8px; border: 1px solid var(--border, #cbd5e1); background: var(--bg-card, white); color: var(--text-main); font-weight: 700; cursor: pointer;" ${gcCurrentCardPage >= totalPages ? "disabled" : ""}>
      បន្ទាប់ <i class="fa-solid fa-chevron-right"></i>
    </button>
  `;
};

// ============================================================================
// 🚚 ជំពូកទី ៤៖ ការគ្រប់គ្រងដំណាក់កាលផលិត និងដឹកជញ្ជូនកាតរូបវ័ន្តតាម `_id` (PHYSICAL DELIVERY STEPPER)
// ============================================================================
window.gcQuickAdvanceStep = async function (ownerId, cardId, targetStatus) {
  const card = gcFindFlattenedCard(ownerId, cardId);
  if (!card) return;

  if (targetStatus === "Activated") {
    return Swal.fire({
      icon: "info",
      title: "សិទ្ធិរបស់អតិថិជន (User Activation)",
      text: "ដំណាក់កាល '៥. ភ្ញៀវបើកប្រើ' គឺទុកឱ្យអតិថិជនជាអ្នកចុចបើកដោយខ្លួនឯងនៅក្នុងកម្មវិធី (ដោយវាយលេខកាត ៤ ខ្ទង់ចុងក្រោយពេលទទួលបានកាតពិត)។",
      confirmButtonColor: "#0d9488",
      customClass: { popup: "premium-swal kh-text" },
    });
  }

  const hasUid = Boolean(card.uid && card.uid !== "");
  const stepsIndex = {
    Requested: 0,
    Printing: 1,
    Shipped: 2,
    Delivered: 3,
    Activated: 4,
  };
  const statusNames = {
    Requested: "១. ស្នើសុំផលិត",
    Printing: "២. កំពុងបោះពុម្ព",
    Shipped: "៣. កំពុងដឹកជញ្ជូន",
    Delivered: "៤. ប្រគល់ជូនរួច",
    Activated: "៥. ភ្ញៀវបើកប្រើ",
  };

  const currentStatus =
    card.deliveryStatus && card.deliveryStatus !== "None"
      ? card.deliveryStatus
      : "Requested";
  const curIdx = stepsIndex[currentStatus] ?? 0;
  const targetIdx = stepsIndex[targetStatus] ?? 0;

  if (targetIdx === curIdx) return;

  if (targetIdx < curIdx) {
    return Swal.fire({
      icon: "info",
      title: "ដំណាក់កាលនេះបានឆ្លងកាត់រួចហើយ!",
      text: `កាតនេះកំពុងស្ថិតនៅដំណាក់កាល [${statusNames[currentStatus]}] មិនអាចត្រឡប់ថយក្រោយបានទេ។`,
      confirmButtonColor: "#0d9488",
      customClass: { popup: "premium-swal kh-text" },
    });
  }

  if (targetIdx > curIdx + 1) {
    const nextKey = Object.keys(stepsIndex).find(
      (k) => stepsIndex[k] === curIdx + 1,
    );
    return Swal.fire({
      icon: "warning",
      title: "មិនអាចផ្លោះរំលងដំណាក់កាលបានទេ!",
      text: `សូមចុចតាមលំដាប់លំដោយ! ជំហានបន្ទាប់គឺ [${statusNames[nextKey]}]។`,
      confirmButtonColor: "#f59e0b",
      customClass: { popup: "premium-swal kh-text" },
    });
  }

  if (targetIdx >= 2 && !hasUid) {
    return Swal.fire({
      icon: "warning",
      title: "មិនទាន់ភ្ជាប់បន្ទះឈីប NFC!",
      text: "សូមចុចប៊ូតុង 'ភ្ជាប់ NFC' ដើម្បីស្កេនឈីបបញ្ចូលក្នុងកាតជាមុនសិន មុននឹងបញ្ជូនកាតចេញ!",
      confirmButtonColor: "#ef4444",
      customClass: { popup: "premium-swal kh-text" },
    });
  }

  if (targetStatus === "Shipped") {
    const initMethod =
      card.deliveryMethod && card.deliveryMethod !== "None"
        ? card.deliveryMethod
        : "Virak Buntham";
    const initTracking =
      card.trackingNumber || window.gcGenerateTrackingCode(initMethod);

    const { value: shipData } = await Swal.fire({
      title: `<span class="kh-text" style="font-size: 1.15rem; color: #0f766e;"><i class="fa-solid fa-truck-fast"></i> ចាប់ផ្តើមដឹកជញ្ជូនកាតជូន ${card.ownerFullName} (**** ${card.number.slice(-4)})</span>`,
      html: `
        <div style="text-align: left; font-family: 'Kantumruy Pro', sans-serif; display: flex; flex-direction: column; gap: 10px; margin-top: 6px;">
          <div>
            <label style="font-size: 0.8rem; font-weight: 700; color: #475569; display: block; margin-bottom: 4px;">ក្រុមហ៊ុនដឹកជញ្ជូន</label>
            <select id="gc-ship-method" class="swal2-select kh-text" style="width: 100%; margin: 0; padding: 10px; border-radius: 10px; font-size: 0.9rem;"
              onchange="document.getElementById('gc-ship-tracking').value = window.gcGenerateTrackingCode(this.value)">
              <option value="Virak Buntham" ${initMethod === "Virak Buntham" ? "selected" : ""}>វិរៈប៊ុនថាំ (Virak Buntham - VET)</option>
              <option value="J&T Express" ${initMethod === "J&T Express" ? "selected" : ""}>J&T Express (JNT)</option>
              <option value="GrabExpress" ${initMethod === "GrabExpress" ? "selected" : ""}>GrabExpress (GRB)</option>
              <option value="Branch Pickup" ${initMethod === "Branch Pickup" ? "selected" : ""}>មកយកផ្ទាល់នៅសាខា (Branch Pickup)</option>
            </select>
          </div>
          <div>
            <label style="font-size: 0.8rem; font-weight: 700; color: #475569; display: block; margin-bottom: 4px;">លេខសម្គាល់ការដឹកជញ្ជូន (Tracking No)</label>
            <input id="gc-ship-tracking" class="swal2-input kh-text" value="${initTracking}" style="width: 100%; margin: 0; padding: 10px; border-radius: 10px; font-size: 0.9rem; font-family: monospace; font-weight: bold; box-sizing: border-box;">
          </div>
        </div>
      `,
      width: "440px",
      showCancelButton: true,
      confirmButtonText: "បញ្ជាក់ការដឹកជញ្ជូន",
      cancelButtonText: "បោះបង់",
      confirmButtonColor: "#0d9488",
      customClass: { popup: "premium-swal kh-text" },
      preConfirm: () => ({
        deliveryMethod: document.getElementById("gc-ship-method").value,
        trackingNumber: document
          .getElementById("gc-ship-tracking")
          .value.trim(),
      }),
    });

    if (shipData) {
      await gcSaveDeliveryStatus(card, {
        cardId: card.id,
        deliveryStatus: "Shipped",
        deliveryMethod: shipData.deliveryMethod,
        trackingNumber: shipData.trackingNumber,
        deliveryPhone: card.deliveryPhone || card.ownerPhone || "",
        deliveryAddress: card.deliveryAddress || "",
      });
    }
    return;
  }

  const confirm = await Swal.fire({
    title: `<span class="kh-text" style="color: #0f766e; font-size: 1.15rem;">បញ្ជាក់ជំហានបន្ទាប់?</span>`,
    html: `<div class="kh-text" style="font-size: 0.92rem; color: #475569;">តើអ្នកចង់ប្តូរស្ថានភាពកាតរបស់ <b>${card.ownerFullName}</b> (**** ${card.number.slice(-4)}) ទៅជា<br><b style="color: #0d9488;">[${statusNames[targetStatus]}]</b> មែនទេ?</div>`,
    icon: "question",
    width: "400px",
    showCancelButton: true,
    confirmButtonText: "បាទ/ចាស បញ្ជាក់",
    cancelButtonText: "បោះបង់",
    confirmButtonColor: "#0d9488",
    customClass: { popup: "premium-swal kh-text" },
  });

  if (confirm.isConfirmed) {
    await gcSaveDeliveryStatus(card, {
      cardId: card.id,
      deliveryStatus: targetStatus,
      deliveryMethod: card.deliveryMethod || "Branch Pickup",
      trackingNumber: card.trackingNumber || "",
      deliveryPhone: card.deliveryPhone || card.ownerPhone || "",
      deliveryAddress: card.deliveryAddress || "",
    });
  }
};

async function gcSaveDeliveryStatus(cardObj, payload) {
  Swal.fire({
    title: "កំពុងរក្សាទុក...",
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading(),
    customClass: { popup: "premium-swal kh-text" },
  });
  try {
    const res = await fetch("/api/admin/cards/physical-status", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        _id: cardObj.ownerId,
        userId: cardObj.ownerId,
        username: cardObj.ownerUsername,
        ...payload,
      }),
    });
    const data = await res.json();
    if (data.success) {
      await gcRefreshAllCards(true);
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "ធ្វើបច្ចុប្បន្នភាពស្ថានភាពកាតជោគជ័យ!",
        showConfirmButton: false,
        timer: 1400,
      });
    } else {
      Swal.fire("បរាជ័យ", data.message || "មិនអាចរក្សាទុកបានទេ", "error");
    }
  } catch (e) {
    Swal.fire("Error", "មានបញ្ហាតភ្ជាប់ទៅកាន់ Server", "error");
  }
}

// ============================================================================
// 🎛️ ជំពូកទី ៥៖ ផ្ទាំងបញ្ជាកាត 3D ពេញលេញតាម `_id` (3D CARD COMMAND MODAL BY `_id`)
// ============================================================================
window.gcOpenCardCommandModal = function (ownerId, cardId) {
  const c = gcFindFlattenedCard(ownerId, cardId);
  if (!c) return;

  const ownerKey = c.ownerId || c.ownerUsername;
  const cat = c.cardCategory || (c.isPhysical ? "debit" : "virtual");
  const isPhy =
    cat === "debit" ||
    cat === "credit" ||
    c.isPhysical ||
    Boolean(c.uid && c.uid !== "");
  const hasUid = Boolean(c.uid && c.uid !== "");
  const themeClass = gcGetThemeClass(c.type);
  const last4 = c.number.slice(-4);
  const fullNameDisplay = c.ownerFullName || c.ownerUsername;

  let customBgStyle = "";
  if (c.type === "custom" && c.customBgUrl) {
    customBgStyle = `style="background: linear-gradient(rgba(0,0,0,0.35), rgba(0,0,0,0.85)), url('${c.customBgUrl}') center/cover no-repeat !important;"`;
  }

  Swal.fire({
    title: `<span class="kh-text" style="font-size: 1.22rem; color: #0f172a; font-family: 'Kantumruy Pro', sans-serif;"><i class="fa-solid fa-sliders" style="color: #0d9488;"></i> មជ្ឈមណ្ឌលបញ្ជាកាត (${fullNameDisplay})</span>`,
    html: `
      <div style="font-family: 'Kantumruy Pro', sans-serif; text-align: left; margin-top: 8px;">
        <!-- កាត 3D Preview -->
        <div class="gc-mini-card ${themeClass}" ${customBgStyle} style="width: 100%; height: 175px; border-radius: 18px; padding: 20px; margin-bottom: 16px; box-sizing: border-box;" onclick="const numEl = document.getElementById('gc-cmd-card-num'); numEl.innerText = numEl.innerText.includes('*') ? '${c.number.match(/.{1,4}/g).join(" ")}' : '**** **** **** ${last4}';">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <div style="width: 38px; height: 26px; background: linear-gradient(135deg, #fde047, #ca8a04); border-radius: 5px;"></div>
              ${isPhy ? `<i class="fa-solid fa-wifi" style="transform: rotate(90deg); font-size: 1.1rem;"></i>` : ""}
              <span style="background: rgba(0,0,0,0.45); border: 1px solid rgba(255,255,255,0.25); padding: 3px 10px; border-radius: 12px; font-size: 0.65rem; font-weight: 800; font-family: 'Inter', sans-serif;">${cat.toUpperCase()} CARD</span>
            </div>
            <span style="font-size: 0.72rem; background: rgba(255,255,255,0.2); padding: 3px 8px; border-radius: 8px; font-family: 'Inter', sans-serif;">CVV: <b>${c.cvv}</b></span>
          </div>

          <div id="gc-cmd-card-num" style="font-family: 'Courier New', monospace; font-size: 1.35rem; font-weight: 800; letter-spacing: 2px; text-shadow: 0 2px 4px rgba(0,0,0,0.5);" title="ចុចលើកាតដើម្បីបង្ហាញ/លាក់លេខពេញ">
            **** **** **** ${last4}
          </div>

          <div style="display: flex; justify-content: space-between; align-items: flex-end; font-size: 0.78rem;">
            <div>
              <div style="font-size: 0.58rem; opacity: 0.75; font-family: 'Inter', sans-serif;">CARD HOLDER</div>
              <div style="font-weight: 800; text-transform: uppercase;">${c.ownerFullName}</div>
            </div>
            <div>
              <div style="font-size: 0.58rem; opacity: 0.75; font-family: 'Inter', sans-serif;">EXPIRES</div>
              <div style="font-weight: 800; font-family: 'Inter', sans-serif;">${c.expiry || "12/28"}</div>
            </div>
            <div style="font-weight: 900; text-transform: uppercase; font-family: 'Inter', sans-serif;">${c.name || c.type}</div>
          </div>
        </div>

        <!-- ក្រឡាប៊ូតុងបញ្ជាទាំង ៩ (3x3 Command Grid) -->
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 6px;">
          <button type="button" onclick="navigator.clipboard.writeText('${c.number}'); Swal.fire({toast:true, position:'top', icon:'success', title:'បានចម្លងលេខកាតពេញ!', showConfirmButton:false, timer:1200});" class="kh-text" style="padding: 11px 6px; border-radius: 10px; border: 1px solid #e2e8f0; background: #f8fafc; cursor: pointer; font-weight: 700; font-size: 0.78rem; color: #1e293b; display: flex; flex-direction: column; align-items: center; gap: 5px;">
            <i class="fa-regular fa-copy" style="font-size: 1.1rem; color: #0ea5e9;"></i> ចម្លងលេខពេញ
          </button>

          <button type="button" onclick="gcModalEditLimit('${ownerKey}', '${c.id}')" class="kh-text" style="padding: 11px 6px; border-radius: 10px; border: 1px solid #e2e8f0; background: #f8fafc; cursor: pointer; font-weight: 700; font-size: 0.78rem; color: #1e293b; display: flex; flex-direction: column; align-items: center; gap: 5px;">
            <i class="fa-solid fa-sliders" style="font-size: 1.1rem; color: #f59e0b;"></i> កំណត់ Limit
          </button>

          <button type="button" onclick="gcModalToggleOnline('${ownerKey}', '${c.id}', ${c.isOnlinePayEnabled !== false})" class="kh-text" style="padding: 11px 6px; border-radius: 10px; border: 1px solid #e2e8f0; background: #f8fafc; cursor: pointer; font-weight: 700; font-size: 0.78rem; color: #1e293b; display: flex; flex-direction: column; align-items: center; gap: 5px;">
            <i class="fa-solid fa-globe" style="font-size: 1.1rem; color: ${c.isOnlinePayEnabled !== false ? "#10b981" : "#94a3b8"};"></i> អនឡាញ: ${c.isOnlinePayEnabled !== false ? "ON" : "OFF"}
          </button>

          <button type="button" onclick="gcModalRenameCard('${ownerKey}', '${c.id}', '${c.name || ""}')" class="kh-text" style="padding: 11px 6px; border-radius: 10px; border: 1px solid #e2e8f0; background: #f8fafc; cursor: pointer; font-weight: 700; font-size: 0.78rem; color: #1e293b; display: flex; flex-direction: column; align-items: center; gap: 5px;">
            <i class="fa-solid fa-pen" style="font-size: 1.1rem; color: #8b5cf6;"></i> ប្តូរឈ្មោះកាត
          </button>

          <button type="button" onclick="gcModalChangeLinkedAcc('${ownerKey}', '${c.id}')" class="kh-text" style="padding: 11px 6px; border-radius: 10px; border: 1px solid #e2e8f0; background: #f8fafc; cursor: pointer; font-weight: 700; font-size: 0.78rem; color: #1e293b; display: flex; flex-direction: column; align-items: center; gap: 5px;">
            <i class="fa-solid fa-link" style="font-size: 1.1rem; color: #eab308;"></i> ប្តូរគណនីភ្ជាប់
          </button>

          <button type="button" onclick="gcModalResetPosPin('${ownerKey}', '${c.id}')" class="kh-text" style="padding: 11px 6px; border-radius: 10px; border: 1px solid #e2e8f0; background: #f8fafc; cursor: pointer; font-weight: 700; font-size: 0.78rem; color: #1e293b; display: flex; flex-direction: column; align-items: center; gap: 5px;">
            <i class="fa-solid fa-key" style="font-size: 1.1rem; color: #0d9488;"></i> កំណត់កូដ PIN
          </button>

          <button type="button" onclick="${!isPhy ? "Swal.fire('កាតនិម្មិត','កាតនិម្មិតមិនមានបន្ទះឈីប NFC ទេ!','info')" : hasUid ? `unbindNFC('${ownerKey}', '${c.id}')` : `quickBindNFC('${ownerKey}', '${c.id}')`}" class="kh-text" style="padding: 11px 6px; border-radius: 10px; border: 1px solid #e2e8f0; background: #f8fafc; cursor: pointer; font-weight: 700; font-size: 0.78rem; color: #1e293b; display: flex; flex-direction: column; align-items: center; gap: 5px; ${!isPhy ? "opacity:0.45;" : ""}">
            <i class="fa-solid fa-wifi" style="font-size: 1.1rem; color: ${hasUid ? "#ef4444" : "#2563eb"};"></i> ${hasUid ? "ផ្តាច់ NFC" : "ភ្ជាប់ NFC"}
          </button>

          <button type="button" onclick="toggleCardLock('${ownerKey}', '${c.id}', ${Boolean(c.isLocked)})" class="kh-text" style="padding: 11px 6px; border-radius: 10px; border: 1px solid #e2e8f0; background: #f8fafc; cursor: pointer; font-weight: 700; font-size: 0.78rem; color: #1e293b; display: flex; flex-direction: column; align-items: center; gap: 5px;">
            <i class="fa-solid ${c.isLocked ? "fa-unlock" : "fa-snowflake"}" style="font-size: 1.1rem; color: #64748b;"></i> ${c.isLocked ? "បើកកាតវិញ" : "ផ្អាកកាត"}
          </button>

          <button type="button" onclick="gcModalDeleteCard('${ownerKey}', '${c.id}')" class="kh-text" style="padding: 11px 6px; border-radius: 10px; border: 1px solid #fca5a5; background: #fef2f2; cursor: pointer; font-weight: 700; font-size: 0.78rem; color: #ef4444; display: flex; flex-direction: column; align-items: center; gap: 5px;">
            <i class="fa-solid fa-trash" style="font-size: 1.1rem; color: #ef4444;"></i> លុបកាតចោល
          </button>
        </div>
      </div>
    `,
    width: "460px",
    showConfirmButton: false,
    showCancelButton: true,
    cancelButtonText: '<span class="kh-text">បិទផ្ទាំង</span>',
    cancelButtonColor: "#64748b",
    customClass: { popup: "premium-swal kh-text c360-kh-swal" },
  });
};

/**
 * 🔹 ៥.២ មុខងាររងសម្រាប់កែប្រែដែនកំណត់, បិទ/បើកអនឡាញ, ប្តូរឈ្មោះ, ប្តូរគណនីភ្ជាប់, កំណត់កូដ PIN និងលុបកាតតាម `_id`
 */
window.gcModalEditLimit = async function (ownerId, cardId) {
  const c = gcFindFlattenedCard(ownerId, cardId);
  if (!c) return;
  const isCredit = c.cardCategory === "credit";

  const { value: formVal } = await Swal.fire({
    title: `<span class="kh-text" style="font-size:1.15rem;">កំណត់ដែនកំណត់ចំណាយកាតរបស់ ${c.ownerFullName}</span>`,
    html: `
      <div style="text-align: left; font-family: 'Kantumruy Pro', sans-serif; display: flex; flex-direction: column; gap: 10px; margin-top: 8px;">
        ${
          isCredit
            ? `<div>
                 <label style="font-size: 0.8rem; font-weight: 700; color: #0f766e;">ទំហំឥណទានអនុម័តសរុប (Credit Limit $)</label>
                 <input id="gc-lim-credit" type="number" class="swal2-input" value="${c.creditLimit || 1000}" style="width: 100%; margin: 4px 0 0; box-sizing: border-box;">
               </div>`
            : ""
        }
        <div>
          <label style="font-size: 0.8rem; font-weight: 700; color: #475569;">ទំហំទឹកប្រាក់ចាយប្រចាំថ្ងៃ (Daily Limit)</label>
          <input id="gc-lim-daily" type="number" class="swal2-input" value="${c.dailyLimit || 500}" style="width: 100%; margin: 4px 0 0; box-sizing: border-box;">
        </div>
        <div>
          <label style="font-size: 0.8rem; font-weight: 700; color: #475569;">ចំនួនដងប្រតិបត្តិការក្នុង១ថ្ងៃ (Tx Count)</label>
          <input id="gc-lim-count" type="number" class="swal2-input" value="${c.dailyTxCountLimit || 10}" style="width: 100%; margin: 4px 0 0; box-sizing: border-box;">
        </div>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: "រក្សាទុក",
    cancelButtonText: "បោះបង់",
    confirmButtonColor: "#0d9488",
    customClass: { popup: "premium-swal kh-text" },
    preConfirm: () => ({
      newCreditLimit: document.getElementById("gc-lim-credit")
        ? parseFloat(document.getElementById("gc-lim-credit").value)
        : undefined,
      newLimit: parseFloat(document.getElementById("gc-lim-daily").value),
      newCountLimit: parseInt(
        document.getElementById("gc-lim-count").value,
        10,
      ),
    }),
  });

  if (formVal) {
    const res = await fetch("/api/admin/update-card-limit", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        _id: c.ownerId,
        userId: c.ownerId,
        username: c.ownerUsername,
        cardId: c.id,
        ...formVal,
      }),
    });
    const data = await res.json();
    if (data.success) {
      await gcRefreshAllCards();
    } else {
      Swal.fire("បរាជ័យ", data.message, "error");
    }
  }
};

window.gcModalToggleOnline = async function (ownerId, cardId, curState) {
  const c = gcFindFlattenedCard(ownerId, cardId);
  const res = await fetch("/api/admin/toggle-card-online", {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({
      _id: c ? c.ownerId : ownerId,
      userId: c ? c.ownerId : ownerId,
      username: c ? c.ownerUsername : ownerId,
      cardId,
      isEnabled: !curState,
    }),
  });
  const data = await res.json();
  if (data.success) {
    await gcRefreshAllCards();
  }
};

window.gcModalRenameCard = async function (ownerId, cardId, curName) {
  const c = gcFindFlattenedCard(ownerId, cardId);
  const { value: newName } = await Swal.fire({
    title:
      '<span class="kh-text" style="font-size: 1.15rem;">ប្តូរឈ្មោះសម្គាល់កាត</span>',
    input: "text",
    inputValue: curName,
    showCancelButton: true,
    confirmButtonText: "រក្សាទុក",
    cancelButtonText: "បោះបង់",
    confirmButtonColor: "#8b5cf6",
    customClass: { popup: "premium-swal kh-text" },
  });
  if (newName) {
    const res = await fetch("/api/admin/rename-card", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        _id: c ? c.ownerId : ownerId,
        userId: c ? c.ownerId : ownerId,
        username: c ? c.ownerUsername : ownerId,
        cardId,
        name: newName,
      }),
    });
    const data = await res.json();
    if (data.success) await gcRefreshAllCards();
  }
};

window.gcModalChangeLinkedAcc = async function (ownerId, cardId) {
  const c = gcFindFlattenedCard(ownerId, cardId);
  if (!c) return;
  if (c.cardCategory === "credit") {
    return Swal.fire(
      "កាតឥណទាន (Credit Card)",
      "កាតឥណទានប្រើវង់ប្រាក់អនុម័តរបស់ធនាគារ មិនចាំបាច់ភ្ជាប់គណនីកាត់លុយផ្ទាល់ទេ។",
      "info",
    );
  }

  const u = c.ownerObj || {};
  let opts = "";
  if (u.mainAccounts?.USD?.accountNumber) {
    opts += `<option value="${u.mainAccounts.USD.accountNumber}">Main USD (${u.mainAccounts.USD.accountNumber})</option>`;
  }
  if (u.mainAccounts?.KHR?.accountNumber) {
    opts += `<option value="${u.mainAccounts.KHR.accountNumber}">Main KHR (${u.mainAccounts.KHR.accountNumber})</option>`;
  }
  (u.subAccounts || []).forEach((s) => {
    if (!s.isHidden) {
      opts += `<option value="${s.accountNumber}">${s.accountName} (${s.accountNumber})</option>`;
    }
  });

  const { value: newAcc } = await Swal.fire({
    title: `<span class="kh-text" style="font-size: 1.15rem;">ប្តូរគណនីភ្ជាប់កាតរបស់ ${c.ownerFullName}</span>`,
    html: `<select id="gc-new-link-acc" class="swal2-select kh-text" style="width:100%; margin: 10px 0 0; padding:10px; border-radius:10px;">${opts}</select>`,
    showCancelButton: true,
    confirmButtonText: "រក្សាទុក",
    cancelButtonText: "បោះបង់",
    confirmButtonColor: "#0d9488",
    customClass: { popup: "premium-swal kh-text" },
    preConfirm: () => document.getElementById("gc-new-link-acc").value,
  });

  if (newAcc) {
    const res = await fetch("/api/admin/change-card-account", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        _id: c.ownerId,
        userId: c.ownerId,
        username: c.ownerUsername,
        cardId: c.id,
        linkedAccount: newAcc,
      }),
    });
    const data = await res.json();
    if (data.success) await gcRefreshAllCards();
  }
};

window.gcModalResetPosPin = async function (ownerId, cardId) {
  const c = gcFindFlattenedCard(ownerId, cardId);
  const { value: newPin } = await Swal.fire({
    title:
      '<span class="kh-text" style="font-size: 1.15rem;">កំណត់លេខកូដ POS PIN (៤ខ្ទង់)</span>',
    input: "password",
    inputPlaceholder: "បញ្ចូលលេខ PIN ៤ ខ្ទង់...",
    inputAttributes: {
      maxlength: 4,
      inputmode: "numeric",
      style: "text-align:center; letter-spacing:10px; font-weight:bold;",
    },
    showCancelButton: true,
    confirmButtonText: "រក្សាទុក",
    cancelButtonText: "បោះបង់",
    confirmButtonColor: "#0d9488",
    customClass: { popup: "premium-swal kh-text" },
  });
  if (newPin && /^\d{4}$/.test(newPin)) {
    const res = await fetch("/api/admin/cards/update-pin", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        _id: c ? c.ownerId : ownerId,
        userId: c ? c.ownerId : ownerId,
        username: c ? c.ownerUsername : ownerId,
        cardId,
        newPin,
      }),
    });
    const data = await res.json();
    if (data.success) {
      Swal.fire({
        icon: "success",
        title: "រក្សាទុកកូដ PIN ជោគជ័យ!",
        timer: 1400,
        showConfirmButton: false,
      });
    }
  }
};

window.gcModalDeleteCard = async function (ownerId, cardId) {
  const c = gcFindFlattenedCard(ownerId, cardId);
  const confirm = await Swal.fire({
    title:
      '<span class="kh-text" style="color:#ef4444;">បញ្ជាក់ការលុបកាតចោល?</span>',
    text: `សកម្មភាពនេះនឹងលុបកាតរបស់ "${c ? c.ownerFullName : ownerId}" ចេញពីប្រព័ន្ធជារៀងរហូត!`,
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#ef4444",
    confirmButtonText: "យល់ព្រមលុប",
    cancelButtonText: "បោះបង់",
    customClass: { popup: "premium-swal kh-text" },
  });
  if (confirm.isConfirmed) {
    const res = await fetch("/api/admin/delete-card", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        _id: c ? c.ownerId : ownerId,
        userId: c ? c.ownerId : ownerId,
        username: c ? c.ownerUsername : ownerId,
        cardId,
        reason: "Deleted from Card Center",
      }),
    });
    const data = await res.json();
    if (data.success) {
      await gcRefreshAllCards();
    } else {
      Swal.fire("បរាជ័យ", data.message, "error");
    }
  }
};

/**
 * 🔹 ៥.៣ បង្កើតកាតថ្មីឱ្យអតិថិជនណាម្នាក់ពីក្នុងម៉ឺនុយ Cards Hub ផ្ទាល់ (ស្វែងរកតាម `_id`, ឈ្មោះពេញ ឬលេខទូរស័ព្ទ)
 */
window.gcOpenIssueCardForAnyUserModal = async function () {
  const { value: targetUserStr } = await Swal.fire({
    title:
      '<span class="kh-text" style="font-size: 1.15rem;">បង្កើតកាតថ្មីជូនអតិថិជន</span>',
    input: "text",
    inputPlaceholder: "វាយបញ្ចូលឈ្មោះពេញ, លេខគណនី, លេខទូរស័ព្ទ ឬ _id...",
    showCancelButton: true,
    confirmButtonText: "បន្តទៅជ្រើសរើសកាត",
    cancelButtonText: "បោះបង់",
    confirmButtonColor: "#0d9488",
    customClass: { popup: "premium-swal kh-text" },
  });

  if (targetUserStr) {
    const kw = targetUserStr.trim().toLowerCase();
    const found = (window.globalUsersData || []).find(
      (u) =>
        String(u._id || u.id).toLowerCase() === kw ||
        (u.fullName && u.fullName.toLowerCase().includes(kw)) ||
        (u.username && u.username.toLowerCase() === kw) ||
        u.phone === kw ||
        u.mainAccounts?.USD?.accountNumber === kw ||
        u.mainAccounts?.KHR?.accountNumber === kw,
    );
    if (!found) {
      return Swal.fire("រកមិនឃើញ", "មិនមានអតិថិជននេះក្នុងប្រព័ន្ធទេ!", "error");
    }
    window.currentC360User = found;
    if (typeof c360CreateCardModal === "function") {
      await c360CreateCardModal();
      setTimeout(() => gcRefreshAllCards(true), 1000);
    }
  }
};

// ============================================================================
// 📡 ជំពូកទី ៦៖ ការផ្អាកកាត និងការស្កេនភ្ជាប់/ផ្តាច់ឈីប NFC តាម `_id` (LOCK & NFC SCANNER BY `_id`)
// ============================================================================
async function toggleCardLock(ownerId, cardId, isCurrentlyLocked) {
  const c = gcFindFlattenedCard(ownerId, cardId);
  const actionText = isCurrentlyLocked
    ? "បើកដំណើរការកាតវិញ"
    : "ផ្អាកកាតបណ្តោះអាសន្ន";
  const confirm = await Swal.fire({
    title: `<span class="kh-text">${actionText}?</span>`,
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: isCurrentlyLocked ? "#10b981" : "#ef4444",
    confirmButtonText: "បាទ/ចាស យល់ព្រម",
    cancelButtonText: "បោះបង់",
    customClass: { popup: "premium-swal kh-text" },
  });
  if (confirm.isConfirmed) {
    const res = await fetch("/api/admin/toggle-card-lock", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        _id: c ? c.ownerId : ownerId,
        userId: c ? c.ownerId : ownerId,
        username: c ? c.ownerUsername : ownerId,
        cardId,
        isLocked: !isCurrentlyLocked,
      }),
    });
    const data = await res.json();
    if (data.success) {
      await gcRefreshAllCards();
    } else {
      Swal.fire("បរាជ័យ", data.message, "error");
    }
  }
}

window.quickBindNFC = async function (ownerId, cardId) {
  const targetCard = gcFindFlattenedCard(ownerId, cardId);
  if (!targetCard) {
    return Swal.fire("កំហុស", "រកមិនឃើញកាតមួយនេះទេ!", "error");
  }

  const cat =
    targetCard.cardCategory || (targetCard.isPhysical ? "debit" : "virtual");
  if (cat === "virtual" && !targetCard.isPhysical) {
    return Swal.fire(
      "កាតនិម្មិត (Virtual Card)",
      "កាតនិម្មិតមិនអាចភ្ជាប់បន្ទះឈីប NFC បានទេ!",
      "warning",
    );
  }

  const fullName = (
    targetCard.ownerFullName || targetCard.ownerUsername
  ).toUpperCase();
  const rawNum = targetCard.number || "0000000000000000";
  const formattedNum = rawNum.match(/.{1,4}/g)?.join(" ") || rawNum;
  const cardType = (
    targetCard.name ||
    targetCard.type ||
    "Standard"
  ).toUpperCase();
  const currentCardPin = targetCard.pin || "0000";

  const confirm = await Swal.fire({
    title:
      '<i class="fa-solid fa-address-card" style="color: #3b82f6; font-size: 2.2rem; margin-bottom: 8px;"></i><br><span style="font-family: \'Kantumruy Pro\'; font-weight: 800; font-size: 1.2rem;">ផ្ទៀងផ្ទាត់ព័ត៌មានកាតរូបវ័ន្ត</span>',
    html: `
      <div style="text-align: left; font-family: 'Kantumruy Pro', sans-serif;">
         <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 18px;">
            <div style="margin-bottom: 12px;">
               <span style="font-size: 0.78rem; color: #64748b; font-weight: 700;"><i class="fa-solid fa-user"></i> ម្ចាស់កាត (Card Holder)</span><br>
               <span style="font-size: 1.05rem; color: #0f172a; font-weight: 800;">${fullName}</span>
            </div>
            <div style="margin-bottom: 12px;">
               <span style="font-size: 0.78rem; color: #64748b; font-weight: 700;"><i class="fa-regular fa-credit-card"></i> លេខកាត (Card Number)</span><br>
               <span style="font-size: 1.2rem; color: #2563eb; font-weight: 800; font-family: 'Courier New', monospace;">${formattedNum}</span>
            </div>
            <div style="display: flex; justify-content: space-between; border-top: 1px dashed #cbd5e1; padding-top: 10px;">
               <div>
                  <span style="font-size: 0.75rem; color: #64748b;">ប្រភេទកាត</span><br>
                  <span style="font-size: 0.9rem; font-weight: 800;">${cardType} (${cat.toUpperCase()})</span>
               </div>
               <div style="text-align: right;">
                  <span style="font-size: 0.75rem; color: #64748b;">លេខ ៤ ខ្ទង់ចុងក្រោយ</span><br>
                  <span style="font-size: 0.95rem; color: #0d9488; font-weight: 900; font-family: monospace;">${rawNum.slice(-4)}</span>
               </div>
            </div>
         </div>
      </div>
    `,
    showCancelButton: true,
    confirmButtonColor: "#10b981",
    cancelButtonColor: "#94a3b8",
    confirmButtonText: '<i class="fa-solid fa-wifi"></i> ចាប់ផ្តើមស្កេន NFC',
    cancelButtonText: "បោះបង់",
    customClass: { popup: "premium-swal kh-text" },
  });

  if (!confirm.isConfirmed) return;

  let isScanning = true;
  let scanBuffer = "";

  Swal.fire({
    title: '<span class="kh-text">📡 កំពុងរង់ចាំស្កេនកាត NFC...</span>',
    html: `
      <div style="margin: 20px 0;"><i class="fa-solid fa-wifi fa-beat" style="font-size: 4.2rem; color: #0ea5e9;"></i></div>
      <p style="color: #64748b; font-family: 'Kantumruy Pro';">សូមយកកាតរូបវ័ន្តមកផ្អឹបនឹងទូរស័ព្ទ ឬម៉ាស៊ីន USB NFC Reader</p>
      <input type="text" id="hiddenUsbScannerInput" style="opacity: 0; position: absolute; z-index: -1; top: 0; left: 0;" autocomplete="off">
    `,
    showConfirmButton: false,
    showCancelButton: true,
    cancelButtonText: "បោះបង់ (Cancel)",
    cancelButtonColor: "#ef4444",
    allowOutsideClick: false,
    customClass: { popup: "premium-swal kh-text" },
    didOpen: () => {
      const hiddenInput = document.getElementById("hiddenUsbScannerInput");
      if (hiddenInput) {
        hiddenInput.focus();
        hiddenInput.addEventListener("blur", () => {
          if (isScanning) setTimeout(() => hiddenInput.focus(), 10);
        });
        hiddenInput.addEventListener("keydown", function (e) {
          e.preventDefault();
          if (e.code === "Enter" || e.code === "NumpadEnter") {
            if (scanBuffer.length >= 4) {
              isScanning = false;
              Swal.close();
              processCardBinding(
                targetCard,
                currentCardPin,
                normalizeUID(scanBuffer),
              );
            }
            scanBuffer = "";
          } else {
            if (e.code.startsWith("Digit"))
              scanBuffer += e.code.replace("Digit", "");
            else if (e.code.startsWith("Numpad"))
              scanBuffer += e.code.replace("Numpad", "");
            else if (e.code.startsWith("Key"))
              scanBuffer += e.code.replace("Key", "");
          }
        });
      }
    },
    didClose: () => {
      isScanning = false;
    },
  });

  if ("NDEFReader" in window) {
    const abortController = new AbortController();
    Swal.getPopup().addEventListener("cancel", () => abortController.abort());
    try {
      const ndef = new NDEFReader();
      await ndef.scan({ signal: abortController.signal });
      ndef.onreading = async (event) => {
        if (!isScanning) return;
        isScanning = false;
        abortController.abort();
        Swal.close();
        let serialNumber = event.serialNumber
          ? event.serialNumber.replaceAll(":", "").toUpperCase()
          : "";
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        processCardBinding(
          targetCard,
          currentCardPin,
          normalizeUID(serialNumber),
        );
      };
    } catch (error) {}
  }
};

async function processCardBinding(cardObj, pin, uid) {
  try {
    const res = await fetch("/api/admin/cards/bind-nfc", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        _id: cardObj.ownerId,
        userId: cardObj.ownerId,
        username: cardObj.ownerUsername,
        cardId: cardObj.id,
        pin,
        uid,
      }),
    });
    const data = await res.json();
    if (data.success) {
      await gcRefreshAllCards(true);
      Swal.fire({
        icon: "success",
        title: "ភ្ជាប់ឈីប NFC ជោគជ័យ!",
        text: `UID: ${uid}`,
        timer: 1600,
        showConfirmButton: false,
        customClass: { popup: "premium-swal kh-text" },
      });
    } else {
      Swal.fire({
        icon: "error",
        title: "មិនអាចភ្ជាប់បានទេ!",
        text: data.message || "មានកំហុសកើតឡើង!",
        customClass: { popup: "premium-swal kh-text" },
      });
    }
  } catch (e) {
    Swal.fire("កំហុស", "មានបញ្ហាបច្ចេកទេសជាមួយ Server", "error");
  }
}

window.unbindNFC = function (ownerId, cardId) {
  const c = gcFindFlattenedCard(ownerId, cardId);
  Swal.fire({
    title:
      '<span class="kh-text" style="color:#ef4444;">ផ្តាច់បន្ទះឈីប NFC នេះ?</span>',
    text: "បន្ទះឈីប NFC នឹងត្រូវលុបការភ្ជាប់ចេញពីកាតរូបវ័ន្តនេះ!",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#ef4444",
    cancelButtonColor: "#94a3b8",
    confirmButtonText: "បាទ/ចាស ផ្តាច់ចោល",
    cancelButtonText: "បោះបង់",
    customClass: { popup: "premium-swal kh-text" },
  }).then(async (result) => {
    if (result.isConfirmed) {
      Swal.fire({
        title: "កំពុងផ្តាច់...",
        didOpen: () => Swal.showLoading(),
      });
      try {
        const res = await fetch("/api/admin/cards/unbind-nfc", {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            _id: c ? c.ownerId : ownerId,
            userId: c ? c.ownerId : ownerId,
            username: c ? c.ownerUsername : ownerId,
            cardId,
          }),
        });
        const data = await res.json();
        if (data.success) {
          await gcRefreshAllCards();
        } else {
          Swal.fire("បរាជ័យ", data.message || "មានបញ្ហា", "error");
        }
      } catch (e) {
        Swal.fire("Error", "បញ្ហាភ្ជាប់ទៅកាន់ Server", "error");
      }
    }
  });
};

// ============================================================================
// 🎬 ជំពូកទី ៧៖ ការចាប់ផ្តើមដំណើរការតារាងកាតដោយស្វ័យប្រវត្តិ (AUTO-INIT HOOK)
// ============================================================================
window.renderCardTablePage = function () {
  renderGlobalCardsTable();
};

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    if (document.getElementById("cardTableBody")) {
      renderGlobalCardsTable();
    }
  }, 500);

  document.body.addEventListener("click", (e) => {
    const navItem = e.target.closest(
      "[onclick*='cards'], [data-target*='cards']",
    );
    if (navItem) {
      setTimeout(() => renderGlobalCardsTable(), 100);
    }
  });
});
