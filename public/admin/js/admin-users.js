// ============================================================================
// ឯកសារ: js/admin-users.js (100% Clean & Modular Admin User Directory)
// អត្ថន័យ: គ្រប់គ្រងបញ្ជីគណនីអតិថិជន, ស្ថិតិ KPI, ផ្ទាំង Drawer, ការបង្កើតគណនីថ្មី (AI OCR)
// - រាល់ប្រតិបត្តិការសាច់ប្រាក់ត្រូវបញ្ជូនទៅកាន់ម៉ឺនុយ Cashier Desk ទាំងអស់!
// ============================================================================

function getMasterUsersArray() {
  if (
    typeof globalUsersData !== "undefined" &&
    Array.isArray(globalUsersData) &&
    globalUsersData.length > 0
  ) {
    return globalUsersData;
  }
  if (
    Array.isArray(window.globalUsersData) &&
    window.globalUsersData.length > 0
  ) {
    return window.globalUsersData;
  }
  return [];
}

// ============================================================================
// 🧩 SECTION 1: UNIVERSAL HELPERS (មុខងារជំនួយទូទៅ និងការចម្លងអត្ថបទ)
// ============================================================================

window.standardDataSearch = function (dataArray, keyword, searchFields) {
  if (!keyword || keyword.trim() === "") return dataArray;
  const lowerKeyword = keyword.toLowerCase().trim();

  const getNestedValue = (obj, path) => {
    return path.split(".").reduce((acc, part) => {
      if (acc === null || acc === undefined) return null;
      if (Array.isArray(acc)) {
        return acc.map((item) => (item ? item[part] : null)).flat();
      }
      return acc[part];
    }, obj);
  };

  return (dataArray || []).filter((item) => {
    return searchFields.some((field) => {
      const value = getNestedValue(item, field);
      if (Array.isArray(value)) {
        return value.some(
          (v) =>
            v !== null &&
            v !== undefined &&
            String(v).toLowerCase().includes(lowerKeyword),
        );
      }
      return (
        value !== null &&
        value !== undefined &&
        String(value).toLowerCase().includes(lowerKeyword)
      );
    });
  });
};

window.copyToClipboard = function (text, label = "ទិន្នន័យ") {
  if (!text || text === "N/A" || text === "...") return;
  navigator.clipboard.writeText(text).then(() => {
    Swal.fire({
      toast: true,
      position: "top-end",
      icon: "success",
      title: `បានចម្លង ${label}: ${text}`,
      showConfirmButton: false,
      timer: 1400,
      customClass: { popup: "premium-swal" },
    });
  });
};

function isUserCurrentlyOnline(u) {
  if (!u) return false;
  if (u.lastActive) {
    const diffMs = Date.now() - new Date(u.lastActive).getTime();
    if (!isNaN(diffMs) && diffMs < 120000) return true;
  }
  return Boolean(u.isOnline);
}

function getCombinedUsdBalance(u) {
  if (!u) return 0;
  const usd = Number(u.mainAccounts?.USD?.balance || 0);
  const khr = Number(u.mainAccounts?.KHR?.balance || 0);
  const rate =
    window.currentFXRates && window.currentFXRates.usdToKhrSell
      ? Number(window.currentFXRates.usdToKhrSell)
      : 4100;
  return usd + khr / rate;
}

// ============================================================================
// 👥 SECTION 2: USER DIRECTORY, KPI STATS, FILTERING & PAGINATION
// ============================================================================

let currentUsersList = [];
let userCurrentPage = 1;
const USERS_PER_PAGE = 8;
let isAutoFetchingUsers = false;

function updateUserDirectoryKPIs() {
  const all = getMasterUsersArray().filter(
    (u) => u.role !== "admin" && u.username !== "superadmin",
  );

  let onlineCnt = 0;
  let verifiedCnt = 0;
  let pendingKycCnt = 0;
  let frozenCnt = 0;

  all.forEach((u) => {
    if (isUserCurrentlyOnline(u)) onlineCnt++;
    if (u.isFrozen) frozenCnt++;
    const kyc = String(u.kycStatus || "unverified").toLowerCase();
    if (kyc === "verified" || kyc === "approved") verifiedCnt++;
    else if (kyc === "pending") pendingKycCnt++;
  });

  const setEl = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.innerText = val.toLocaleString("en-US");
  };
  setEl("ausrStatTotal", all.length);
  setEl("ausrStatOnline", onlineCnt);
  setEl("ausrStatVerified", verifiedCnt);
  setEl("ausrStatPendingKyc", pendingKycCnt);
  setEl("ausrStatFrozen", frozenCnt);
}

window.setQuickUserStatusFilter = function (statusVal) {
  const sel = document.getElementById("statusFilter");
  if (sel) sel.value = statusVal;

  document.querySelectorAll(".ausr-kpi-card").forEach((card) => {
    card.classList.toggle("active-kpi", card.id === `ausr-kpi-${statusVal}`);
  });

  filterUsers();
};

window.filterUsers = async function () {
  let masterList = getMasterUsersArray();

  if (masterList.length === 0 && !isAutoFetchingUsers) {
    isAutoFetchingUsers = true;
    try {
      const res = await fetch("/api/users", { headers: getAuthHeaders() });
      const raw = await res.json();
      const fetched = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.users)
          ? raw.users
          : [];
      if (fetched.length > 0) {
        globalUsersData = fetched;
        window.globalUsersData = fetched;
        masterList = fetched;
      }
    } catch (e) {
    } finally {
      isAutoFetchingUsers = false;
    }
  }

  updateUserDirectoryKPIs();

  const term = document.getElementById("searchBox")?.value || "";
  const status = document.getElementById("statusFilter")?.value || "ALL";
  const sortMode = document.getElementById("userSortSelect")?.value || "NEWEST";

  let filtered = window.standardDataSearch(masterList, term, [
    "username",
    "fullName",
    "phone",
    "email",
    "idNumber",
    "userId",
    "mainAccounts.USD.accountNumber",
    "mainAccounts.KHR.accountNumber",
    "subAccounts.accountNumber",
  ]);

  if (status !== "ALL") {
    filtered = filtered.filter((u) => {
      const kyc = String(u.kycStatus || "unverified").toLowerCase();
      if (status === "FROZEN") return u.isFrozen === true;
      if (status === "ACTIVE") return !u.isFrozen;
      if (status === "ONLINE") return isUserCurrentlyOnline(u);
      if (status === "VERIFIED_KYC")
        return kyc === "verified" || kyc === "approved";
      if (status === "PENDING_KYC") return kyc === "pending";
      if (status === "UNVERIFIED_KYC")
        return kyc === "unverified" || kyc === "rejected" || !u.kycStatus;
      return true;
    });
  }

  filtered = [...filtered].sort((a, b) => {
    const aSys = a.mainAccounts?.USD?.accountNumber === "888888888";
    const bSys = b.mainAccounts?.USD?.accountNumber === "888888888";
    if (aSys && !bSys) return -1;
    if (!aSys && bSys) return 1;

    if (sortMode === "BAL_HIGH") {
      return getCombinedUsdBalance(b) - getCombinedUsdBalance(a);
    }
    if (sortMode === "NAME_AZ") {
      return String(a.fullName || a.username).localeCompare(
        String(b.fullName || b.username),
      );
    }
    const tA = new Date(a.joinDate || a.createdAt || 0).getTime();
    const tB = new Date(b.joinDate || b.createdAt || 0).getTime();
    return tB - tA;
  });

  currentUsersList = filtered;
  userCurrentPage = 1;
  renderUsersTable();
};

window.renderUsersTable = function () {
  const listContainer = document.getElementById("userDirectoryList");
  if (!listContainer) return;

  if (!currentUsersList || currentUsersList.length === 0) {
    listContainer.innerHTML = `
      <div style="text-align:center; padding: 55px 20px; color: var(--text-muted)">
        <i class="fa-solid fa-users-slash" style="font-size: 3rem; margin-bottom: 12px; opacity: 0.35"></i>
        <h3 style="margin:0; font-size:1rem">មិនមានទិន្នន័យអតិថិជនត្រូវនឹងការស្វែងរកទេ</h3>
      </div>`;
    updateUserPaginationUI(0);
    return;
  }

  const totalPages = Math.ceil(currentUsersList.length / USERS_PER_PAGE);
  if (userCurrentPage > totalPages) userCurrentPage = totalPages;
  if (userCurrentPage < 1) userCurrentPage = 1;

  const startIndex = (userCurrentPage - 1) * USERS_PER_PAGE;
  const usersToShow = currentUsersList.slice(
    startIndex,
    startIndex + USERS_PER_PAGE,
  );

  listContainer.innerHTML = usersToShow
    .map((u) => {
      const imgSrc = u.profileImage || "../images/default-avatar.png";
      const name = u.fullName || u.username;
      const isSystem = u.mainAccounts?.USD?.accountNumber === "888888888";
      const isOnline = isUserCurrentlyOnline(u);

      const usdAcc = u.mainAccounts?.USD?.accountNumber || "N/A";
      const usdBal = Number(u.mainAccounts?.USD?.balance || 0);
      const khrBal = Number(u.mainAccounts?.KHR?.balance || 0);

      const kyc = String(u.kycStatus || "unverified").toLowerCase();
      let kycBadge = `<span style="background:rgba(148,163,184,0.14); color:#64748b; padding:3px 9px; border-radius:20px; font-size:0.7rem; font-weight:800">⚪ Unverified</span>`;
      if (kyc === "verified" || kyc === "approved") {
        kycBadge = `<span style="background:rgba(13,148,136,0.14); color:#0d9488; padding:3px 9px; border-radius:20px; font-size:0.7rem; font-weight:800"><i class="fa-solid fa-circle-check"></i> KYC Verified</span>`;
      } else if (kyc === "pending") {
        kycBadge = `<span style="background:rgba(245,158,11,0.16); color:#d97706; padding:3px 9px; border-radius:20px; font-size:0.7rem; font-weight:800"><i class="fa-solid fa-clock"></i> Pending KYC</span>`;
      }

      const statusHtml = isSystem
        ? `<span style="background:#e0f2fe; color:#0284c7; padding:4px 10px; border-radius:20px; font-size:0.72rem; font-weight:900">🏛️ CENTRAL BANK</span>`
        : u.isFrozen
          ? `<span style="background:rgba(239,68,68,0.12); color:#ef4444; border:1px solid rgba(239,68,68,0.28); padding:4px 10px; border-radius:20px; font-size:0.72rem; font-weight:900">🛑 FROZEN</span>`
          : `<span style="background:rgba(16,185,129,0.12); color:#10b981; border:1px solid rgba(16,185,129,0.28); padding:4px 10px; border-radius:20px; font-size:0.72rem; font-weight:900">🟢 ACTIVE</span>`;

      return `
        <div class="ausr-row-card" onclick="openUserDrawer('${u.username}', this)">
          <div style="display:flex; align-items:center; gap:14px; min-width:0; flex:1">
            <div class="ausr-avatar-wrap">
              <img loading="lazy" src="${imgSrc}" onerror="this.src='../images/default-avatar.png'" />
              ${isOnline ? '<span class="ausr-online-dot" title="កំពុង Online"></span>' : ""}
            </div>

            <div style="min-width:0; flex:1">
              <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap">
                <h4 style="margin:0; color:var(--text-main); font-size:0.98rem; font-weight:900; white-space:nowrap; overflow:hidden; text-overflow:ellipsis">
                  ${name}
                </h4>
                ${kycBadge}
              </div>

              <div style="display:flex; align-items:center; gap:10px; margin-top:4px; font-size:0.8rem; color:var(--text-muted); flex-wrap:wrap">
                <span class="ausr-mono" style="color:#0d9488; font-weight:800">@${u.username}</span>
                <span>•</span>
                <span class="ausr-mono" onclick="event.stopPropagation(); copyToClipboard('${usdAcc}', 'លេខគណនី USD')" title="ចុចចម្លងលេខកុង">#${usdAcc}</span>
                <span>•</span>
                <span><i class="fa-solid fa-phone" style="font-size:0.7rem"></i> ${u.phone || "N/A"}</span>
              </div>
            </div>
          </div>

          <div class="ausr-row-right" style="display:flex; align-items:center; gap:16px">
            <div style="text-align:right">
              <div class="ausr-mono" style="font-size:0.92rem; font-weight:900; color:#0ea5e9">
                $${usdBal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div class="ausr-mono" style="font-size:0.76rem; font-weight:700; color:#10b981">
                ${khrBal.toLocaleString("en-US")} ៛
              </div>
            </div>

            <div style="display:flex; align-items:center; gap:6px" onclick="event.stopPropagation()">
              <button
                type="button"
                class="ausr-mini-btn"
                onclick="goToCashierDesk('${usdAcc !== "N/A" ? usdAcc : u.username}', 'Deposit')"
                title="ទៅកាន់បញ្ជរគិតប្រាក់ (Cashier Desk)"
              >
                <i class="fa-solid fa-cash-register" style="color:#10b981"></i>
              </button>
              <button
                type="button"
                class="ausr-mini-btn"
                onclick="goToCustomer360('${u.username}')"
                title="មើលក្នុង Customer 360°"
              >
                <i class="fa-solid fa-users-viewfinder" style="color:#3b82f6"></i>
              </button>
            </div>

            <div>${statusHtml}</div>
          </div>
        </div>
      `;
    })
    .join("");

  updateUserPaginationUI(totalPages);
};

window.changeUserPage = function (step) {
  userCurrentPage += step;
  renderUsersTable();
};

function updateUserPaginationUI(totalPages) {
  const btnPrev = document.getElementById("btnPrevUserPage");
  const btnNext = document.getElementById("btnNextUserPage");
  const pageInfo = document.getElementById("userPageInfo");
  if (!pageInfo) return;

  if (totalPages === 0) {
    pageInfo.innerText = `ទំព័រទី 0 / 0 (សរុប 0 នាក់)`;
    if (btnPrev) btnPrev.disabled = true;
    if (btnNext) btnNext.disabled = true;
    return;
  }

  pageInfo.innerText = `ទំព័រទី ${userCurrentPage} / ${totalPages} (សរុប ${currentUsersList.length} នាក់)`;
  if (btnPrev) btnPrev.disabled = userCurrentPage === 1;
  if (btnNext) btnNext.disabled = userCurrentPage >= totalPages;
}

window.exportUserDirectoryCSV = function () {
  if (!currentUsersList || currentUsersList.length === 0) {
    Swal.fire("គ្មានទិន្នន័យ", "មិនមានបញ្ជីអតិថិជនសម្រាប់ទាញយកទេ!", "info");
    return;
  }
  const headers = [
    "User ID",
    "Username",
    "Full Name",
    "Phone",
    "Email",
    "USD Account",
    "USD Balance",
    "KHR Account",
    "KHR Balance",
    "KYC Status",
    "Status",
  ];
  const rows = currentUsersList.map((u) => [
    u.userId || "",
    u.username || "",
    `"${String(u.fullName || "").replace(/"/g, '""')}"`,
    u.phone || "",
    u.email || "",
    u.mainAccounts?.USD?.accountNumber || "",
    Number(u.mainAccounts?.USD?.balance || 0).toFixed(2),
    u.mainAccounts?.KHR?.accountNumber || "",
    Number(u.mainAccounts?.KHR?.balance || 0),
    u.kycStatus || "unverified",
    u.isFrozen ? "FROZEN" : "ACTIVE",
  ]);
  const csv =
    "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `UPAY_Users_Directory_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
};

// ============================================================================
// 💎 SECTION 3: SLIDE-OVER INSPECTOR DRAWER & NAVIGATION TO CASHIER / C360
// ============================================================================

/**
 * 🏦 មុខងារបញ្ជូនអតិថិជនទៅកាន់ម៉ឺនុយ បេឡាករ (Cashier Desk) ដោយស្វ័យប្រវត្តិ
 */
window.goToCashierDesk = function (identifier, requestType = "Deposit") {
  closeUserDrawer();
  showSection("cashier");

  setTimeout(() => {
    // ១. បំពេញលេខគណនី ឬ @username ចូលប្រអប់ស្វែងរកក្នុង Cashier Desk
    const searchInput =
      document.getElementById("cashierSearchAcc") ||
      document.getElementById("cashierSearchInput") ||
      document.querySelector("#sec-cashier input[type='text']");

    if (searchInput) {
      searchInput.value = identifier;
    }

    // ២. ហៅអនុគមន៍ស្វែងរកអតិថិជនក្នុង Cashier Desk ដោយស្វ័យប្រវត្តិ
    if (typeof searchCashierCustomer === "function") {
      searchCashierCustomer();
    } else if (typeof searchUserForCashier === "function") {
      searchUserForCashier();
    }

    // ៣. ជ្រើសរើសប្រភេទប្រតិបត្តិការ (Deposit ឬ Withdrawal) ឱ្យស្រេច
    setTimeout(() => {
      if (typeof selectCashierType === "function") {
        selectCashierType(requestType);
      } else if (typeof setCashierMode === "function") {
        setCashierMode(requestType);
      } else {
        const typeSelect = document.getElementById("cashierRequestType");
        if (typeSelect) {
          typeSelect.value = requestType;
          typeSelect.dispatchEvent(new Event("change"));
        }
      }
    }, 300);
  }, 120);
};

window.openUserDrawer = function (username, cardElement) {
  const user = getMasterUsersArray().find((u) => u.username === username);
  if (!user) return;

  document.getElementById("drawerName").innerText =
    user.fullName || user.username;

  const displayId = user.userId || "N/A";
  document.getElementById("drawerUsername").innerHTML = `
    <span style="color:var(--text-muted); font-size:0.84rem">
      ID: <span class="ausr-mono" onclick="copyToClipboard('${displayId}', 'User ID')" style="cursor:pointer; text-decoration:underline" title="ចុចចម្លង">${displayId}</span>
    </span>
    <span style="color:#cbd5e1; margin:0 8px">|</span>
    <span class="ausr-mono" onclick="copyToClipboard('${user.username}', 'Username')" style="cursor:pointer; text-decoration:underline; color:#0d9488" title="ចុចចម្លង">@${user.username}</span>
  `;

  document.getElementById("drawerAvatar").src =
    user.profileImage || "../images/default-avatar.png";

  const setCopyable = (elementId, value, label) => {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.innerText = value || "N/A";
    if (value && value !== "N/A") {
      el.style.cursor = "pointer";
      el.title = "ចុចដើម្បីចម្លង";
      el.style.textDecoration = "underline";
      el.style.textDecorationStyle = "dashed";
      el.onclick = () => copyToClipboard(value, label);
    } else {
      el.style.cursor = "default";
      el.style.textDecoration = "none";
      el.onclick = null;
    }
  };

  const primaryUsdAcc = user.mainAccounts?.USD?.accountNumber;
  setCopyable("drawerUsdAcc", primaryUsdAcc, "លេខគណនី USD");
  setCopyable(
    "drawerKhrAcc",
    user.mainAccounts?.KHR?.accountNumber,
    "លេខគណនី KHR",
  );
  setCopyable("drawerPhone", user.phone, "លេខទូរស័ព្ទ");
  setCopyable("drawerEmail", user.email, "អ៊ីមែល");

  const usdBalEl = document.getElementById("drawerUsdBal");
  const khrBalEl = document.getElementById("drawerKhrBal");
  if (usdBalEl) {
    usdBalEl.innerText = `សមតុល្យ: $${Number(user.mainAccounts?.USD?.balance || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
  }
  if (khrBalEl) {
    khrBalEl.innerText = `សមតុល្យ: ${Number(user.mainAccounts?.KHR?.balance || 0).toLocaleString("en-US")} ៛`;
  }

  const subAccContainer = document.getElementById("drawerSubAccountsContainer");
  if (subAccContainer) {
    if (Array.isArray(user.subAccounts) && user.subAccounts.length > 0) {
      subAccContainer.innerHTML = `
        <h4 style="margin: 12px 0 8px; color: var(--text-muted); font-size:0.82rem; font-weight:800">
          <i class="fa-solid fa-layer-group" style="color:#8b5cf6"></i> គណនីរង (Sub-Accounts: ${user.subAccounts.length})
        </h4>
        <div class="info-block" style="display:flex; flex-direction:column; gap:8px; padding:12px">
          ${user.subAccounts
            .map((sub, idx) => {
              const currColor = sub.currency === "USD" ? "#0ea5e9" : "#10b981";
              const sym = sub.currency === "USD" ? "$" : "៛";
              const borderTop =
                idx > 0
                  ? "border-top: 1px dashed var(--border); padding-top: 8px;"
                  : "";
              return `
                <div style="display:flex; justify-content:space-between; align-items:center; ${borderTop}">
                  <div>
                    <span style="color:${currColor}; font-weight:800; font-size:0.84rem">${sub.accountName || sub.currency}</span>
                    <div class="ausr-mono" style="font-size:0.74rem; color:var(--text-muted)">${sym}${Number(sub.balance || 0).toLocaleString("en-US")}</div>
                  </div>
                  <span class="ausr-mono" onclick="copyToClipboard('${sub.accountNumber}', 'លេខគណនីរង')" style="font-weight:800; font-size:0.86rem; cursor:pointer; text-decoration:underline; text-decoration-style:dashed" title="ចុចចម្លង">${sub.accountNumber}</span>
                </div>
              `;
            })
            .join("")}
        </div>
      `;
    } else {
      subAccContainer.innerHTML = "";
    }
  }

  const kycStatus = String(user.kycStatus || "unverified").toLowerCase();
  const kycColor =
    kycStatus === "verified" || kycStatus === "approved"
      ? "#10b981"
      : kycStatus === "rejected"
        ? "#ef4444"
        : "#f59e0b";
  document.getElementById("drawerKyc").innerHTML =
    `<span style="color:${kycColor}; font-weight:800; text-transform:uppercase; font-size:0.8rem">${kycStatus}</span>`;

  const toggleBtn = document.getElementById("drawerFreezeToggle");
  const stLabel = document.getElementById("drawerStatusLabel");
  if (toggleBtn) {
    toggleBtn.checked = !user.isFrozen;
    if (stLabel) {
      stLabel.innerText = user.isFrozen ? "FROZEN 🛑" : "ACTIVE 🟢";
      stLabel.style.color = user.isFrozen ? "#ef4444" : "#10b981";
    }
    toggleBtn.onchange = function () {
      const willFreeze = !this.checked;
      if (stLabel) {
        stLabel.innerText = willFreeze ? "FROZEN 🛑" : "ACTIVE 🟢";
        stLabel.style.color = willFreeze ? "#ef4444" : "#10b981";
      }
      toggleFreeze(user._id || user.id, willFreeze);
    };
  }

  // 🏦 ភ្ជាប់ប៊ូតុងដាក់ប្រាក់/ដកប្រាក់ ឱ្យលោតទៅម៉ឺនុយ Cashier Desk ផ្ទាល់តែម្ដង!
  const targetCashierKey = primaryUsdAcc || user.username;
  const btnAdd = document.getElementById("btnDrawerQuickAdd");
  const btnDed = document.getElementById("btnDrawerQuickDeduct");
  if (btnAdd) {
    btnAdd.onclick = () => goToCashierDesk(targetCashierKey, "Deposit");
  }
  if (btnDed) {
    btnDed.onclick = () => goToCashierDesk(targetCashierKey, "Withdrawal");
  }

  document.getElementById("btnMessageDrawer").onclick = () =>
    sendDirectMessage(user.username);
  document.getElementById("btnForceLogoutDrawer").onclick = () =>
    forceLogoutUser(user.username);
  document.getElementById("btnC360Drawer").onclick = () =>
    goToCustomer360(user.username);

  const isSystem = primaryUsdAcc === "888888888";
  const delBtn = document.getElementById("btnDeleteDrawer");
  if (delBtn) {
    delBtn.style.display = isSystem ? "none" : "block";
    delBtn.onclick = () => deleteUser(user._id || user.id);
  }

  document.getElementById("userDetailDrawer").classList.add("open");
  document
    .querySelectorAll(".ausr-row-card")
    .forEach((c) => c.classList.remove("selected"));
  if (cardElement) cardElement.classList.add("selected");
};

window.closeUserDrawer = function () {
  document.getElementById("userDetailDrawer")?.classList.remove("open");
  document
    .querySelectorAll(".ausr-row-card")
    .forEach((c) => c.classList.remove("selected"));
};

window.goToCustomer360 = function (username) {
  closeUserDrawer();
  showSection("customer-360");
  const inp = document.getElementById("searchC360");
  if (inp) inp.value = username;
  if (typeof searchCustomer360 === "function") searchCustomer360();
};

// ============================================================================
// 🧑‍💻 SECTION 4: INLINE CREATE FORM & AI OCR ONBOARDING
// ============================================================================

let isCreateFormOpen = false;

window.toggleUserCreateForm = function () {
  const form = document.getElementById("inlineCreateUserForm");
  const btn = document.getElementById("btnToggleCreateForm");
  const controls = document.getElementById("ausrSearchAndSortControls");

  if (!isCreateFormOpen) {
    isCreateFormOpen = true;
    form.style.display = "flex";
    if (controls) controls.style.visibility = "hidden";
    btn.innerHTML = `<i class="fa-solid fa-arrow-left"></i> ត្រឡប់ទៅបញ្ជីអតិថិជនវិញ`;
    btn.style.background = "var(--bg-body)";
    btn.style.color = "var(--text-main)";
    btn.style.border = "1px solid var(--border)";
    closeUserDrawer();
  } else {
    confirmCloseCreateForm();
  }
};

window.confirmCloseCreateForm = function () {
  const fName = document.getElementById("newFullName").value.trim();
  const uName = document.getElementById("newUsername").value.trim();
  const idImg = document.getElementById("hiddenIdUrl").value;

  if (fName || uName || idImg) {
    Swal.fire({
      title: "បោះបង់ការបង្កើតគណនី?",
      text: "ទិន្នន័យដែលអ្នកកំពុងបំពេញ នឹងត្រូវលុបចោលទាំងស្រុង។",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#64748b",
      confirmButtonText: "បាទ/ចាស បោះបង់",
      cancelButtonText: "បន្តបំពេញ",
      customClass: { popup: "premium-swal" },
    }).then((result) => {
      if (result.isConfirmed) {
        clearAdminCreateForm();
        forceCloseFormUI();
      }
    });
  } else {
    forceCloseFormUI();
  }
};

function forceCloseFormUI() {
  isCreateFormOpen = false;
  document.getElementById("inlineCreateUserForm").style.display = "none";
  const controls = document.getElementById("ausrSearchAndSortControls");
  if (controls) controls.style.visibility = "visible";
  const btn = document.getElementById("btnToggleCreateForm");
  btn.innerHTML = `<i class="fa-solid fa-user-plus"></i> បង្កើតគណនីថ្មី`;
  btn.style.background = "";
  btn.style.color = "";
  btn.style.border = "";
}

function clearAdminCreateForm() {
  document
    .querySelectorAll(".inline-create-form input:not([type='hidden'])")
    .forEach((el) => (el.value = ""));
  document.getElementById("newGender").value = "";
  document.getElementById("adminDuplicateReasonBox").style.display = "none";
  document.getElementById("adminDuplicateReason").value = "";
  document.getElementById("newUsernameFeedback").innerHTML = "";
  document.getElementById("adminIdPreview").style.display = "none";
  document.getElementById("adminSelfiePreview").style.display = "none";
  document.getElementById("hiddenIdUrl").value = "";
  document.getElementById("hiddenSelfieUrl").value = "";
  document.getElementById("newPassword").value = "1234";
  document.getElementById("newPin").value = "1234";
}

window.adminCheckUsername = async function () {
  const val = document.getElementById("newUsername").value.trim();
  const feedback = document.getElementById("newUsernameFeedback");
  if (val.length < 3) return;
  try {
    const res = await fetch("/api/check-username", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ username: val }),
    });
    const data = await res.json();
    if (data.available) {
      feedback.innerHTML =
        '<span style="color:#10b981"><i class="fa-solid fa-circle-check"></i> ឈ្មោះនេះអាចប្រើប្រាស់បាន</span>';
    } else {
      feedback.innerHTML =
        '<span style="color:#ef4444"><i class="fa-solid fa-circle-xmark"></i> ឈ្មោះនេះមានគេប្រើរួចហើយ!</span>';
    }
  } catch (e) {}
};

window.adminCheckIdNumber = async function () {
  const val = document.getElementById("newIdNumber").value.trim();
  if (!val) return;
  try {
    const res = await fetch("/api/check-id-number", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ idNumber: val }),
    });
    const data = await res.json();
    if (data.exists) {
      document.getElementById("adminDuplicateReasonBox").style.display =
        "block";
    } else {
      document.getElementById("adminDuplicateReasonBox").style.display = "none";
      document.getElementById("adminDuplicateReason").value = "";
    }
  } catch (e) {}
};

window.handleAdminFormUpload = async function (
  event,
  previewId,
  hiddenInputId,
) {
  const file = event.target.files[0];
  if (!file) return;

  Swal.fire({
    title: "កំពុងបញ្ជូនរូបភាព...",
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading(),
    customClass: { popup: "premium-swal" },
  });

  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById(previewId).src = e.target.result;
    document.getElementById(previewId).style.display = "block";
  };
  reader.readAsDataURL(file);

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", "iaxuqmpb");

  try {
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/jp9yg3dj/image/upload`,
      { method: "POST", body: formData },
    );
    const data = await res.json();
    if (data.secure_url) {
      document.getElementById(hiddenInputId).value = data.secure_url;
      Swal.close();
    } else {
      Swal.fire("បរាជ័យ", "មិនអាច Upload រូបភាពបានទេ", "error");
    }
  } catch (e) {
    Swal.fire("Error", "បញ្ហាភ្ជាប់ទៅកាន់ Cloudinary", "error");
  }
};

window.handleAdminIdOcrUpload = async function (event) {
  const file = event.target.files[0];
  if (!file) return;

  document.getElementById("newFullName").value = "";
  document.getElementById("newDob").value = "";
  document.getElementById("newIdNumber").value = "";
  document.getElementById("adminDuplicateReasonBox").style.display = "none";

  Swal.fire({
    title: "កំពុងស្កេនដោយ AI OCR...",
    html: "ប្រព័ន្ធកំពុងអានទិន្នន័យពីអត្តសញ្ញាណប័ណ្ណ",
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading(),
    customClass: { popup: "premium-swal" },
  });

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", "iaxuqmpb");

  try {
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/jp9yg3dj/image/upload`,
      { method: "POST", body: formData },
    );
    const data = await res.json();
    if (data.secure_url) {
      const tempUrl = data.secure_url;
      const ocrRes = await fetch("/api/scan-id-card", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ imageUrl: tempUrl }),
      });
      const ocrData = await ocrRes.json();
      Swal.close();

      if (!ocrData.success) {
        event.target.value = "";
        return Swal.fire({
          icon: "error",
          title: "ឯកសារបដិសេធ ❌",
          text: ocrData.message,
          customClass: { popup: "premium-swal" },
        });
      }

      document.getElementById("hiddenIdUrl").value = tempUrl;
      document.getElementById("adminIdPreview").src = tempUrl;
      document.getElementById("adminIdPreview").style.display = "block";

      document.getElementById("newFullName").value =
        ocrData.data.fullName || "";
      document.getElementById("newDob").value = ocrData.data.dob || "";
      document.getElementById("newGender").value = ocrData.data.gender || "";
      document.getElementById("newIdNumber").value =
        ocrData.data.idNumber || "";

      if (ocrData.data.idNumber) adminCheckIdNumber();

      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "ស្កេន AI OCR ជោគជ័យ!",
        showConfirmButton: false,
        timer: 2000,
        customClass: { popup: "premium-swal" },
      });
    } else throw new Error("Cloudinary Error");
  } catch (err) {
    Swal.close();
    Swal.fire({
      icon: "error",
      title: "បរាជ័យ",
      text: "មិនអាចស្កេនឯកសារបានទេ",
      customClass: { popup: "premium-swal" },
    });
  }
};

window.submitNewUserByAdmin = async function () {
  const payload = {
    fullName: document.getElementById("newFullName").value.trim(),
    username: document.getElementById("newUsername").value.trim(),
    phone: document.getElementById("newPhone").value.trim(),
    email: document.getElementById("newEmail").value.trim(),
    dob: document.getElementById("newDob").value,
    gender: document.getElementById("newGender").value,
    idNumber: document.getElementById("newIdNumber").value.trim(),
    password: document.getElementById("newPassword").value.trim(),
    pin: document.getElementById("newPin").value.trim(),
    idCardUrl: document.getElementById("hiddenIdUrl").value,
    selfieUrl: document.getElementById("hiddenSelfieUrl").value,
    duplicateReason: document
      .getElementById("adminDuplicateReason")
      .value.trim(),
  };

  if (
    !payload.fullName ||
    !payload.username ||
    !payload.phone ||
    !payload.email ||
    !payload.dob ||
    !payload.gender ||
    !payload.idNumber ||
    !payload.password ||
    !payload.pin ||
    !payload.idCardUrl ||
    !payload.selfieUrl
  ) {
    return Swal.fire({
      icon: "warning",
      title: "សូមបំពេញចន្លោះប្រហោង",
      text: "រាល់ព័ត៌មានដែលមានសញ្ញាផ្កាយ (*) និងរូបភាពទាំង ២ ត្រូវតែបំពេញ!",
      customClass: { popup: "premium-swal" },
    });
  }

  if (payload.pin.length !== 4) {
    return Swal.fire({
      icon: "warning",
      title: "កំហុស",
      text: "លេខកូដ PIN ត្រូវមាន ៤ ខ្ទង់!",
      customClass: { popup: "premium-swal" },
    });
  }

  if (
    document.getElementById("adminDuplicateReasonBox").style.display ===
      "block" &&
    !payload.duplicateReason
  ) {
    return Swal.fire({
      icon: "warning",
      title: "ទាមទារមូលហេតុ",
      text: "សូមបញ្ជាក់មូលហេតុក្នុងការបង្កើតគណនីថ្មី (លេខ ID ស្ទួន)!",
      customClass: { popup: "premium-swal" },
    });
  }

  Swal.fire({
    title: "កំពុងបង្កើតគណនី...",
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading(),
    customClass: { popup: "premium-swal" },
  });

  try {
    const res = await fetch("/api/admin/create-user", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (data.success) {
      Swal.fire({
        icon: "success",
        title: "ជោគជ័យ!",
        html: `គណនី <b>@${payload.username}</b> ត្រូវបានបង្កើតរួចរាល់។<br>ស្ថានភាព KYC: <b>Pending (រង់ចាំអនុម័ត)</b>`,
        customClass: { popup: "premium-swal" },
      });

      clearAdminCreateForm();
      forceCloseFormUI();
      if (typeof loadData === "function") loadData();
    } else {
      Swal.fire({
        icon: "error",
        title: "បរាជ័យ",
        text: data.message,
        customClass: { popup: "premium-swal" },
      });
    }
  } catch (error) {
    Swal.fire({
      icon: "error",
      title: "Error",
      text: "មានបញ្ហាតភ្ជាប់ទៅកាន់ Server",
      customClass: { popup: "premium-swal" },
    });
  }
};

// ============================================================================
// 🛑 SECTION 5: ACCOUNT SECURITY & STATUS OPERATIONS (ផ្អាកគណនី, ផ្ញើសារ, ផ្តាច់គណនី & លុប)
// ============================================================================

window.deleteUser = function (id) {
  const user = getMasterUsersArray().find((u) => (u._id || u.id) === id);
  if (!user) return;

  let optionsHtml = `<option value="ALL">លុបគណនីអ្នកប្រើប្រាស់ទាំងមូល (Delete Entire User)</option>`;
  if (Array.isArray(user.subAccounts)) {
    user.subAccounts.forEach((sub) => {
      optionsHtml += `<option value="${sub.accountNumber}">លុបតែគណនីរង: ${sub.accountNumber} (${sub.accountName})</option>`;
    });
  }

  Swal.fire({
    title: `<div style="color: #ef4444; font-size: 1.3rem; font-weight:900"><i class="fa-solid fa-triangle-exclamation"></i> បញ្ជាក់ការលុបគណនី</div>`,
    html: `
      <div style="text-align: left; font-family: 'Kantumruy Pro', sans-serif;">
        <div style="margin-bottom: 14px;">
          <label style="display: block; font-size: 0.84rem; font-weight: 700; color: var(--text-muted); margin-bottom: 6px;">ជ្រើសរើសទិន្នន័យដែលត្រូវលុប</label>
          <select id="delTarget" style="width: 100%; height: 44px; padding: 0 12px; border: 1px solid var(--border); background: var(--bg-body); color: var(--text-main); border-radius: 10px;">${optionsHtml}</select>
        </div>
        <div>
          <label style="display: block; font-size: 0.84rem; font-weight: 700; color: var(--text-muted); margin-bottom: 6px;">មូលហេតុនៃការលុប (ចាំបាច់)</label>
          <input id="delReason" type="text" style="width: 100%; height: 44px; padding: 0 12px; border: 1px solid var(--border); background: var(--bg-body); color: var(--text-main); border-radius: 10px; box-sizing:border-box" placeholder="បញ្ជាក់មូលហេតុ...">
        </div>
      </div>
    `,
    showCancelButton: true,
    confirmButtonColor: "#ef4444",
    cancelButtonColor: "#64748b",
    confirmButtonText: "បាទ/ចាស, លុប!",
    cancelButtonText: "បោះបង់",
    customClass: { popup: "premium-swal" },
    preConfirm: () => {
      const targetAccount = document.getElementById("delTarget").value;
      const reason = document.getElementById("delReason").value.trim();
      if (!reason) {
        Swal.showValidationMessage("សូមបញ្ចូលមូលហេតុនៃការលុបឱ្យបានច្បាស់លាស់!");
      }
      return { targetAccount, reason };
    },
  }).then(async (result) => {
    if (result.isConfirmed) {
      try {
        const res = await fetch("/api/admin/delete-user", {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            id,
            targetAccount: result.value.targetAccount,
            reason: result.value.reason,
          }),
        });
        const data = await res.json();
        if (data.success) {
          closeUserDrawer();
          Swal.fire({
            toast: true,
            position: "top-end",
            icon: "success",
            title: "បានលុបជោគជ័យ!",
            showConfirmButton: false,
            timer: 1500,
          });
          if (typeof loadData === "function") loadData();
        } else {
          Swal.fire("Error", data.message || "មិនអាចលុបបានទេ", "error");
        }
      } catch (e) {
        Swal.fire("Error", "បញ្ហាការតភ្ជាប់", "error");
      }
    }
  });
};

window.toggleFreeze = async function (id, isFrozen) {
  try {
    const res = await fetch("/api/admin/toggle-freeze", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ id, isFrozen }),
    });
    const data = await res.json();
    if (data.success) {
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: isFrozen ? "គណនីត្រូវបានផ្អាក 🛑" : "គណនីបានបើកដំណើរការវិញ 🟢",
        showConfirmButton: false,
        timer: 1500,
      });
      const user = getMasterUsersArray().find((u) => (u._id || u.id) === id);
      if (user) user.isFrozen = isFrozen;
      filterUsers();
    } else {
      Swal.fire("បរាជ័យ", data.message, "error");
      if (typeof loadData === "function") loadData();
    }
  } catch (e) {
    if (typeof loadData === "function") loadData();
  }
};

window.sendDirectMessage = async function (username) {
  const { value: text } = await Swal.fire({
    title: `ផ្ញើសារជូនដំណឹងទៅកាន់ @${username}`,
    input: "textarea",
    inputPlaceholder: "វាយបញ្ចូលខ្លឹមសារសារនៅទីនេះ...",
    showCancelButton: true,
    confirmButtonColor: "#0d9488",
    confirmButtonText: "ផ្ញើសារ",
    cancelButtonText: "បោះបង់",
    customClass: { popup: "premium-swal" },
  });

  if (text && text.trim() !== "") {
    try {
      const res = await fetch("/api/admin/send-message", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ username, message: text.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        Swal.fire({
          toast: true,
          position: "top-end",
          icon: "success",
          title: "សារត្រូវបានបញ្ជូន!",
          showConfirmButton: false,
          timer: 1500,
        });
      }
    } catch (e) {
      Swal.fire("Error", "មានបញ្ហាភ្ជាប់ទៅកាន់ Server", "error");
    }
  }
};

window.forceLogoutUser = function (username) {
  Swal.fire({
    title: "ផ្តាច់គណនីអតិថិជន?",
    text: `តើអ្នកចង់បង្ខំឱ្យ @${username} Log out ចេញពីគ្រប់ឧបករណ៍ភ្លាមៗមែនទេ?`,
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#f59e0b",
    confirmButtonText: "បាទ/ចាស ផ្តាច់គណនី",
    cancelButtonText: "បោះបង់",
    customClass: { popup: "premium-swal" },
  }).then(async (result) => {
    if (result.isConfirmed) {
      try {
        const res = await fetch("/api/admin/force-logout", {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({ username }),
        });
        const data = await res.json();
        if (data.success) {
          Swal.fire({
            toast: true,
            position: "top-end",
            icon: "success",
            title: "គណនីត្រូវបានផ្តាច់ចេញពីឧបករណ៍!",
            showConfirmButton: false,
            timer: 1500,
          });
        }
      } catch (e) {
        Swal.fire("Error", "មិនអាចភ្ជាប់ទៅកាន់ Server", "error");
      }
    }
  });
};
