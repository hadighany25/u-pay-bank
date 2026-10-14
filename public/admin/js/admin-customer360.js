// admin-customer360.js
// ========================================================================
// 🛡️ CUSTOMER 360° VIEW LOGIC (ALL-IN-ONE SYSTEM)
// រក្សាទុកកូដចាស់ទាំងអស់ និងបន្ថែមមុខងារបញ្ជាទិន្នន័យ (Actions)
// ========================================================================

let currentC360User = null;
let currentC360ActiveTab = "info"; // 🟢 ចងចាំ Tab ដែលកំពុងបើក

// =======================================================
// ១. មុខងារស្វែងរកអតិថិជន (Live Search & Get Fresh Data)
// =======================================================
async function searchCustomer360() {
  const term = document.getElementById("searchC360").value.trim();
  if (!term) return;

  Swal.fire({
    title: "កំពុងស្វែងរក...",
    text: "ទាញយកទិន្នន័យថ្មីពី Server...",
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading(),
    customClass: { popup: "premium-swal" },
  });

  try {
    let foundUsername = null;
    let finalUser = null;

    // ១.១ ស្វែងរកក្នុង Local Data មុន
    if (
      typeof window.standardDataSearch === "function" &&
      typeof globalUsersData !== "undefined"
    ) {
      const results = window.standardDataSearch(globalUsersData, term, [
        "username",
        "fullName",
        "phone",
        "phoneNumber",
        "email",
        "idNumber",
        "userId",
        "mainAccounts.USD.accountNumber",
        "mainAccounts.KHR.accountNumber",
        "subAccounts.accountNumber",
      ]);
      if (results && results.length > 0) {
        foundUsername = results[0].username;
      }
    }

    // ១.២ បើរកឃើញ Username ក្នុង Local យើងបាញ់ API យក Full Profile ថ្មីៗពី Server
    if (foundUsername) {
      const res = await fetch("/api/admin/get-user", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ username: foundUsername }),
      });

      // 🟢 ការពារ JSON Parse Error
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();

      if (data.success && data.user) {
        finalUser = data.user;
      }
    }

    // ១.៣ Fallback: ស្វែងរកពី Server ផ្ទាល់
    if (!finalUser) {
      const res = await fetch("/api/admin/search-user", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ searchTerm: term }),
      });

      // 🟢 ការពារ JSON Parse Error
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();

      if (data.success && data.user) {
        finalUser = data.user;
      }
    }

    Swal.close();

    if (finalUser) {
      currentC360User = finalUser;

      // Update ទិន្នន័យចូល Global Array
      if (typeof globalUsersData !== "undefined") {
        const index = globalUsersData.findIndex(
          (u) => u.username === finalUser.username,
        );
        if (index !== -1) globalUsersData[index] = finalUser;
        else globalUsersData.push(finalUser);
      }

      // បង្ហាញទិន្នន័យលើអេក្រង់
      renderCustomerProfile(finalUser);
    } else {
      Swal.fire({
        icon: "error",
        title: "រកមិនឃើញ",
        text: `គ្មានអតិថិជនដែលទាក់ទងនឹងពាក្យ "${term}" ក្នុងប្រព័ន្ធទេ!`,
        customClass: { popup: "premium-swal kh-text" },
      });
    }
  } catch (error) {
    // 🟢 បង្ហាញ Error លម្អិតដើម្បីងាយស្រួលរកកំហុស
    console.error("Search Error:", error);
    Swal.fire({
      icon: "error",
      title: "បរាជ័យ (API Error)",
      text: "មានបញ្ហាក្នុងការភ្ជាប់ទៅកាន់ Server API (សូមឆែក Console)",
      customClass: { popup: "premium-swal kh-text" },
    });
  }
}

// =======================================================
// ២. មុខងារបង្ហាញទិន្នន័យ Header និង Quick Actions (ទម្រង់ Menu ឈរ)
// =======================================================
function renderCustomerProfile(user) {
  currentC360User = user;

  const emptyState = document.getElementById("c360-empty-state");
  if (emptyState) emptyState.style.display = "none";

  const profileView = document.getElementById("c360-profile-view");
  if (profileView) profileView.style.display = "block";

  // កំណត់ពណ៌ និងស្ថានភាព
  const isFrozen = user.isFrozen;
  const statusColor = isFrozen ? "#ef4444" : "#10b981";
  const statusText = isFrozen ? "Frozen" : "Active";
  const statusIcon = isFrozen ? "fa-lock" : "fa-circle-check";

  let statusBadge = isFrozen
    ? `<span style="position: absolute; top: 0; right: -25px; background: rgba(239, 68, 68, 0.15); color: #ef4444; padding: 3px 8px; border-radius: 12px; font-size: 0.7rem; font-weight: bold; display: flex; align-items: center; gap: 4px;"><i class="fa-solid fa-lock"></i> Frozen</span>`
    : `<span style="position: absolute; top: 0; right: -25px; background: rgba(16, 185, 129, 0.15); color: #10b981; padding: 3px 8px; border-radius: 12px; font-size: 0.7rem; font-weight: bold; display: flex; align-items: center; gap: 4px;"><i class="fa-solid fa-circle-check"></i> Active</span>`;

  // កំណត់ KYC Verified Icon
  const isKycVerified =
    user.kycStatus === "verified" || user.kycStatus === "approved";
  const kycIcon = isKycVerified
    ? `<i class="fa-solid fa-circle-check" style="color: #3b82f6; font-size: 1.1rem; margin-left: 5px;" title="KYC Verified"></i>`
    : `<i class="fa-solid fa-circle-check" style="color: #cbd5e1; font-size: 1.1rem; margin-left: 5px;" title="KYC Unverified"></i>`;

  // 🟢 កំណត់ពណ៌ប៊ូតុង Actions ផ្នែកខាងឆ្វេងឱ្យប្រែប្រួលតាមស្ថានភាព
  const actionFreezeBg = isFrozen
    ? "rgba(16, 185, 129, 0.1)"
    : "rgba(239, 68, 68, 0.1)";
  const actionFreezeColor = isFrozen ? "#10b981" : "#ef4444";

  // គូរ Layout ថ្មីដែលមាន Sidebar ឈរ (Vertical) និង ផ្នែក Content ខាងស្តាំ
  profileView.innerHTML = `
    <style>
      .c360-layout { display: flex; gap: 20px; align-items: flex-start; }
      .c360-sidebar { flex: 0 0 260px; background: var(--bg-card); border-radius: 12px; border: 1px solid var(--border); padding: 20px; box-shadow: 0 4px 10px rgba(0,0,0,0.02); position: sticky; top: 20px; }
      .c360-content { flex: 1; background: transparent; min-width: 0; }
      .c360-v-tabs { display: flex; flex-direction: column; gap: 5px; margin-top: 20px; }
      .c360-v-tab { padding: 12px 15px; border-radius: 8px; cursor: pointer; color: var(--text-muted); font-weight: 600; transition: 0.2s; display: flex; align-items: center; gap: 12px; font-family: 'Kantumruy Pro', sans-serif; font-size: 0.95rem; }
      .c360-v-tab:hover { background: rgba(16, 185, 129, 0.05); color: var(--secondary); }
      .c360-v-tab.active { background: rgba(16, 185, 129, 0.15); color: #10b981; }
      .c360-action-btn { width: 100%; padding: 12px 15px; border-radius: 8px; font-weight: bold; cursor: pointer; border: none; display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 10px; font-family: 'Kantumruy Pro', sans-serif; font-size: 0.9rem; transition: 0.2s; }
    </style>

    <div class="c360-layout">
        <!-- 🔹 ផ្នែកខាងឆ្វេង (Sidebar) -->
        <div class="c360-sidebar">
            <!-- Profile Image & Name -->
            <div style="text-align: center; margin-bottom: 20px;">
                <div style="position: relative; display: inline-block;">
                    <img src="${user.profileImage || "../images/default-avatar.png"}" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; border: 2px solid var(--border); cursor: pointer;" onclick="c360ChangeProfileImage()" title="ចុចដើម្បីប្តូររូប" onerror="this.src='../images/default-avatar.png'">
                </div>
                <h3 style="margin: 10px 0 5px; color: var(--text-main); font-size: 1.1rem; text-transform: uppercase; display: flex; justify-content: center; align-items: center;">
                    ${user.fullName || user.username} ${kycIcon}
                </h3>
                <p style="margin: 0; color: var(--text-muted); font-size: 0.85rem;">ID : ${user.userId || "N/A"}</p>
            </div>

            <!-- Vertical Tabs -->
            <div class="c360-v-tabs">
                <div class="c360-v-tab active" id="tab-btn-info" onclick="switchC360Tab('info', this)"><i class="fa-solid fa-user"></i> ព័ត៌មាន (Info)</div>
                <div class="c360-v-tab" id="tab-btn-finance" onclick="switchC360Tab('finance', this)"><i class="fa-solid fa-wallet"></i> កាបូបលុយ (Wallets)</div>
                <div class="c360-v-tab" id="tab-btn-cards" onclick="switchC360Tab('cards', this)"><i class="fa-solid fa-credit-card"></i> កាត (Cards)</div>
                <div class="c360-v-tab" id="tab-btn-trx" onclick="switchC360Tab('trx', this)"><i class="fa-solid fa-receipt"></i> ប្រតិបត្តិការ (Trx)</div>
                <div class="c360-v-tab" id="tab-btn-kyc" onclick="switchC360Tab('kyc', this)"><i class="fa-solid fa-id-card"></i> ឯកសារ (KYC)</div>
                <div class="c360-v-tab" id="tab-btn-security" onclick="switchC360Tab('security', this)"><i class="fa-solid fa-shield-halved"></i> សន្តិសុខ (Security)</div>
                <div class="c360-v-tab" id="tab-btn-merchant" onclick="switchC360Tab('merchant', this)"><i class="fa-solid fa-store"></i> ហាង (Merchant)</div>
                <div class="c360-v-tab" id="tab-btn-logs" onclick="switchC360Tab('logs', this)"><i class="fa-solid fa-list-check"></i> កំណត់ត្រា (Audit Logs)</div>
            </div>

            <!-- Actions Section -->
            <div style="margin-top: 20px; border-top: 1px solid var(--border); padding-top: 20px;">
                <div style="font-size: 0.9rem; font-weight: bold; color: var(--text-main); margin-bottom: 15px;">Actions</div>
                
                <button class="c360-action-btn" style="background: var(--bg-body); border: 1px solid var(--border); color: var(--text-main);" onclick="c360RefreshData()">
                    <i class="fa-solid fa-arrows-rotate" id="c360-refresh-icon"></i> Refresh ទិន្នន័យ
                </button>
                
                <button class="c360-action-btn" style="background: rgba(59, 130, 246, 0.1); color: #3b82f6;" onclick="c360OpenFloatingChat()">
                    <i class="fa-solid fa-comment-dots"></i> ផ្ញើសារ (Direct Message)
                </button>
                
                <!-- 🟢 ប៊ូតុងនេះឥឡូវឆ្លាតវៃហើយ (ប្តូរពណ៌អូតូ) -->
                <button class="c360-action-btn" style="background: ${actionFreezeBg}; color: ${actionFreezeColor};" onclick="c360ToggleFreeze()">
                    <i class="fa-solid ${isFrozen ? "fa-unlock" : "fa-lock"}"></i> ${isFrozen ? "បើកគណនី (Unfreeze)" : "ផ្អាកគណនី (Freeze)"}
                </button>
            </div>
        </div>

        <!-- 🔹 ផ្នែកខាងស្តាំ (Content Area រក្សាទិន្នន័យដូចដើមទាំងអស់) -->
        <div class="c360-content">
            <div class="dash-card" style="padding: 25px;">
                <div id="c360-tab-info" class="c360-tab-content" style="display: block;"></div>
                <div id="c360-tab-finance" class="c360-tab-content" style="display: none;"></div>
                <div id="c360-tab-cards" class="c360-tab-content" style="display: none;"></div>
                <div id="c360-tab-trx" class="c360-tab-content" style="display: none;"></div>
                <div id="c360-tab-kyc" class="c360-tab-content" style="display: none;"></div>
                <div id="c360-tab-security" class="c360-tab-content" style="display: none;"></div>
                <div id="c360-tab-merchant" class="c360-tab-content" style="display: none;"></div>
                <div id="c360-tab-logs" class="c360-tab-content" style="display: none;"></div>
            </div>
        </div>
    </div>
  `;

  // ហៅមុខងារគូរ Tab ទាំងអស់ឡើងវិញ
  renderInfoTab(user);
  renderWalletsTab(user);
  renderCardsTab(user);
  renderKycTab(user);
  renderTrxTab(user);
  renderSecurityTab(user);
  renderMerchantTab(user);
  renderLogsTab(user);
  switchC360Tab(currentC360ActiveTab); // 🟢 បើក Tab ដើមមកវិញបន្ទាប់ពី Render
}

function switchC360Tab(tabName, element = null) {
  currentC360ActiveTab = tabName; // 🟢 ចងចាំ Tab ដែល User កំពុងចុចមើល

  // លាក់ Content ចាស់ៗទាំងអស់
  document
    .querySelectorAll(".c360-tab-content")
    .forEach((c) => (c.style.display = "none"));

  // ដកពណ៌បៃតង (Active) ពី Tab ទាំងអស់នៅ Menu ខាងឆ្វេង
  document
    .querySelectorAll(".c360-v-tab")
    .forEach((t) => t.classList.remove("active"));

  // បើមានចុចលើ Menu ណា កំណត់ពណ៌ Active ឱ្យ Menu នោះ
  if (element) {
    element.classList.add("active");
  } else {
    // Fallback ពេលកូដហៅដោយមិនបានចុចផ្ទាល់
    const activeTabBtn = document.getElementById(`tab-btn-${tabName}`);
    if (activeTabBtn) activeTabBtn.classList.add("active");
  }

  // បង្ហាញ Content គោលដៅនៅខាងស្តាំ
  const targetTab = document.getElementById(`c360-tab-${tabName}`);
  if (targetTab) targetTab.style.display = "block";
}

// =======================================================
// មុខងារ Refresh ទិន្នន័យតែអតិថិជនកំពុងមើល (Fast Refresh)
// =======================================================
async function c360RefreshData() {
  if (!currentC360User) return;

  const icon = document.getElementById("c360-refresh-icon");
  if (icon) icon.classList.add("fa-spin");

  try {
    const res = await fetch("/api/admin/get-user", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ username: currentC360User.username }),
    });

    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const data = await res.json();

    if (data.success && data.user) {
      // 🟢 ទាញយកកាតបន្ថែមពី Model Card មកបញ្ចូលក្នុង Object របស់ User ផ្ទាល់
      const cardsRes = await fetch(`/api/admin/all-cards`, {
        headers: getAuthHeaders(),
      });
      const cardsData = await cardsRes.json();
      if (cardsData.success && cardsData.cards) {
        data.user.virtualCards = cardsData.cards.filter(
          (c) => c.username === data.user.username,
        );
      }

      renderCustomerProfile(data.user);

      if (typeof globalUsersData !== "undefined") {
        const index = globalUsersData.findIndex(
          (u) => u.username === data.user.username,
        );
        if (index !== -1) globalUsersData[index] = data.user;
      }

      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "ទិន្នន័យបានធ្វើបច្ចុប្បន្នភាព",
        showConfirmButton: false,
        timer: 1500,
      });
    }
  } catch (e) {
    console.error("Refresh Error:", e);
  } finally {
    if (icon) icon.classList.remove("fa-spin");
  }
}

// =======================================================
// ៣. អនុវត្ត TABS ទាំង ៨
// =======================================================
// =======================================================
// ➡️ TAB 1: ព័ត៌មានទូទៅ (Information) - GRID BOX & INLINE EDIT
// =======================================================
function renderInfoTab(user) {
  const container = document.getElementById("c360-tab-info");
  if (!container) return;

  const dateCreated = user.createdAt
    ? new Date(user.createdAt).toISOString().split("T")[0]
    : "N/A";

  const dobText = user.dob || "N/A";
  const idNumText = user.idNumber || "N/A";
  const genderText =
    user.gender === "Male" || user.gender === "ប្រុស"
      ? "ប្រុស (Male)"
      : user.gender === "Female" || user.gender === "ស្រី"
        ? "ស្រី (Female)"
        : "N/A";

  let duplicateWarning = "";
  if (user.duplicateIdReason) {
    duplicateWarning = `<div style="color: #ef4444; font-size: 0.75rem; margin-top: 5px; font-weight: 600;"><i class="fa-solid fa-triangle-exclamation"></i> ប្រើលើសពី១គណនី! <br>(មូលហេតុ: ${user.duplicateIdReason})</div>`;
  }

  // 🟢 គណនាសមតុល្យសរុប (Total Balance) គ្រប់គណនី (លើកលែង Junior)
  let totalUSD = user.mainAccounts?.USD?.balance || 0;
  let totalKHR = user.mainAccounts?.KHR?.balance || 0;

  if (user.subAccounts && Array.isArray(user.subAccounts)) {
    user.subAccounts.forEach((acc) => {
      if (acc.accountType !== "junior") {
        if (acc.currency === "USD") totalUSD += acc.balance || 0;
        if (acc.currency === "KHR") totalKHR += acc.balance || 0;
      }
    });
  }

  const formattedTotalUSD = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(totalUSD);
  const formattedTotalKHR =
    new Intl.NumberFormat("en-US").format(totalKHR) + " ៛";

  // 🟢 រកមើលអ្នកណែនាំ (Referred By)
  let referrerId = user.referredBy || "N/A";
  let referrerNameHtml = user.referredBy
    ? `<div style="font-size: 0.85rem; color: #64748b; margin-top: 5px; font-weight: 600; background: #e2e8f0; padding: 4px 8px; border-radius: 6px; display: inline-block;">ឈ្មោះ: ${user.referrerName || "មិនមានទិន្នន័យឈ្មោះ"}</div>`
    : "";

  // 🟢 កំណត់ប៊ូតុង Freeze/Unfreeze
  const freezeBtnStyle = user.isFrozen
    ? "background: #10b981; color: white; border: none; box-shadow: 0 4px 10px rgba(16,185,129,0.2);"
    : "background: #ef4444; color: white; border: none; box-shadow: 0 4px 10px rgba(239,68,68,0.2);";
  const freezeBtnText = user.isFrozen
    ? `<i class="fa-solid fa-unlock"></i> បើកគណនីវិញ`
    : `<i class="fa-solid fa-lock"></i> ផ្អាកគណនី (Freeze)`;

  container.innerHTML = `
    <style>
      .c360-tab-title-main { margin: 0 0 20px 0; font-size: 1.2rem; color: #0f172a; font-family: 'Kantumruy Pro', sans-serif; display: flex; align-items: center; gap: 10px; font-weight: 800; border-bottom: 2px solid #f1f5f9; padding-bottom: 15px; }
      
      .c360-inner-card { background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 25px; margin-bottom: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.02); }
      .c360-inner-title { margin: 0 0 20px 0; font-size: 1rem; color: #1e293b; font-weight: 700; font-family: 'Kantumruy Pro', sans-serif; display: flex; align-items: center; gap: 10px; }
      
      .c360-grid-container { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }
      
      .c360-data-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; position: relative; display: flex; flex-direction: column; justify-content: center; min-height: 75px; transition: 0.2s; box-sizing: border-box; }
      
      .c360-label-small { font-size: 0.75rem; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; font-family: 'Inter', 'Kantumruy Pro', sans-serif; margin-bottom: 4px; }
      .c360-value-text { font-size: 1.05rem; color: #0f172a; font-weight: 700; font-family: 'Inter', 'Kantumruy Pro', sans-serif; word-break: break-word; }
      
      /* Editable Box Styles */
      .c360-data-box.editable:hover { border-color: #cbd5e1; box-shadow: 0 2px 5px rgba(0,0,0,0.02); }
      .c360-data-box.editable .edit-icon { position: absolute; right: 15px; top: 15px; color: #3b82f6; cursor: pointer; opacity: 0; transition: 0.2s; padding: 5px; }
      .c360-data-box.editable:hover .edit-icon { opacity: 1; }
      .c360-data-box.editable .edit-icon:hover { color: #2563eb; transform: scale(1.1); }
      
      .c360-inline-input { width: 100%; padding: 8px 10px; border: 2px solid #3b82f6; border-radius: 6px; font-size: 1rem; color: #0f172a; font-weight: 600; font-family: 'Inter', 'Kantumruy Pro', sans-serif; outline: none; box-sizing: border-box; box-shadow: 0 2px 8px rgba(59, 130, 246, 0.15); margin-top: 5px; }
      .inline-action-btns { display: flex; gap: 8px; margin-top: 10px; width: 100%; }
      .inline-btn-save { flex: 1; background: #10b981; color: white; border: none; padding: 8px; border-radius: 6px; font-size: 0.85rem; cursor: pointer; font-weight: bold; font-family: 'Kantumruy Pro'; transition: 0.2s; display: flex; align-items: center; justify-content: center; gap: 5px; }
      .inline-btn-save:hover { background: #059669; }
      .inline-btn-cancel { flex: 1; background: #f1f5f9; color: #64748b; border: 1px solid #cbd5e1; padding: 8px; border-radius: 6px; font-size: 0.85rem; cursor: pointer; font-weight: bold; font-family: 'Kantumruy Pro'; transition: 0.2s; }
      .inline-btn-cancel:hover { background: #e2e8f0; color: #0f172a; }

      .c360-security-section { background: rgba(239, 68, 68, 0.02); border: 1px solid rgba(239, 68, 68, 0.15); }
      .c360-btn-reset-outline { flex: 1; padding: 14px; border-radius: 8px; font-weight: bold; cursor: pointer; border: 1px solid rgba(239, 68, 68, 0.2); background: white; color: #ef4444; transition: 0.2s; font-family: 'Kantumruy Pro', sans-serif; display: flex; align-items: center; justify-content: center; gap: 8px; }
      .c360-btn-reset-outline:hover { background: #fef2f2; border-color: #ef4444; }

      @media (max-width: 1000px) {
          .c360-grid-container { grid-template-columns: repeat(2, 1fr); }
      }
      @media (max-width: 600px) {
          .c360-grid-container { grid-template-columns: 1fr; }
      }
    </style>

    <h2 class="c360-tab-title-main"><i class="fa-solid fa-user-circle" style="color: #10b981;"></i> ព័ត៌មានអតិថិជន (Information)</h2>

    <!-- 📦 កាតទី១៖ ព័ត៌មានគណនី (ACCOUNT PROFILE) -->
    <div class="c360-inner-card">
        <h4 class="c360-inner-title"><i class="fa-solid fa-address-card" style="color: #64748b;"></i> ព័ត៌មានគណនី (Account Profile)</h4>
        <div class="c360-grid-container">
            
            <!-- ១. ឈ្មោះពេញ (Editable) -->
            <div class="c360-data-box editable" id="box-fullName">
                <div id="view-fullName" style="display: flex; flex-direction: column; width: 100%;">
                    <span class="c360-label-small">ឈ្មោះពេញ (FULL NAME)</span>
                    <span class="c360-value-text">${user.fullName || "N/A"}</span>
                    <i class="fa-solid fa-pen edit-icon" id="icon-fullName" onclick="c360ToggleEdit('fullName', 'text')" title="កែប្រែ"></i>
                </div>
                <div id="edit-fullName" style="display: none; width: 100%;">
                    <span class="c360-label-small" style="color: #3b82f6;">កែប្រែឈ្មោះពេញ (FULL NAME)</span>
                    <input type="text" id="input-fullName" class="c360-inline-input" value="${user.fullName || ""}">
                    <div class="inline-action-btns">
                        <button class="inline-btn-save" onclick="c360SaveField('fullName')"><i class="fa-solid fa-check"></i> រក្សាទុក</button>
                        <button class="inline-btn-cancel" onclick="c360CancelEdit('fullName')">បោះបង់</button>
                    </div>
                </div>
            </div>

            <!-- ២. ឈ្មោះប្រើប្រាស់ -->
            <div class="c360-data-box">
                <span class="c360-label-small">ឈ្មោះប្រើប្រាស់ (USERNAME)</span>
                <span class="c360-value-text">@${user.username}</span>
            </div>

            <!-- ៣. ភេទ -->
            <div class="c360-data-box">
                <span class="c360-label-small">ភេទ (GENDER)</span>
                <span class="c360-value-text">${genderText}</span>
            </div>

            <!-- ៤. User ID -->
            <div class="c360-data-box">
                <span class="c360-label-small">លេខសម្គាល់ (USER ID)</span>
                <span class="c360-value-text">${user.userId || "N/A"}</span>
            </div>

            <!-- ៦. លេខអត្តសញ្ញាណប័ណ្ណ -->
            <div class="c360-data-box">
                <span class="c360-label-small">លេខអត្តសញ្ញាណប័ណ្ណ (ID NUMBER)</span>
                <span class="c360-value-text">${idNumText}</span>
                ${duplicateWarning}
            </div>

            <!-- ៧. ថ្ងៃខែឆ្នាំកំណើត -->
            <div class="c360-data-box">
                <span class="c360-label-small">ថ្ងៃខែឆ្នាំកំណើត (DOB)</span>
                <span class="c360-value-text">${dobText}</span>
            </div>

            <!-- ៨. ថ្ងៃបង្កើតគណនី -->
            <div class="c360-data-box">
                <span class="c360-label-small">ថ្ងៃបង្កើតគណនី (JOIN DATE)</span>
                <span class="c360-value-text">${dateCreated}</span>
            </div>

            <!-- ៩. លុយដុល្លារសរុប -->
            <div class="c360-data-box" style="border-left: 4px solid var(--secondary);">
                <span class="c360-label-small">លុយដុល្លារសរុប (TOTAL USD)</span>
                <span class="c360-value-text" style="color: var(--secondary); font-size: 1.2rem;">${formattedTotalUSD}</span>
            </div>

            <!-- ១0. លុយរៀលសរុប -->
            <div class="c360-data-box" style="border-left: 4px solid var(--accent);">
                <span class="c360-label-small">លុយរៀលសរុប (TOTAL KHR)</span>
                <span class="c360-value-text" style="color: var(--accent); font-size: 1.2rem;">${formattedTotalKHR}</span>
            </div>

        </div>
    </div>

    <!-- 📦 កាតទី២៖ ព័ត៌មានទំនាក់ទំនង (CONTACT INFO) -->
    <div class="c360-inner-card" style="background: #f8fafc;">
        <h4 class="c360-inner-title"><i class="fa-solid fa-address-book" style="color: #3b82f6;"></i> ព័ត៌មានទំនាក់ទំនង (Contact Info)</h4>
        <div class="c360-grid-container">
            
            <!-- ១. លេខទូរស័ព្ទ (Editable) -->
            <div class="c360-data-box editable" id="box-phone" style="background: #ffffff;">
                <div id="view-phone" style="display: flex; flex-direction: column; width: 100%;">
                    <span class="c360-label-small">លេខទូរស័ព្ទ (PHONE)</span>
                    <span class="c360-value-text">${user.phone || user.phoneNumber || "N/A"}</span>
                    <i class="fa-solid fa-pen edit-icon" id="icon-phone" onclick="c360ToggleEdit('phone', 'tel')" title="កែប្រែ"></i>
                </div>
                <div id="edit-phone" style="display: none; width: 100%;">
                    <span class="c360-label-small" style="color: #3b82f6;">កែប្រេលេខទូរស័ព្ទ (PHONE)</span>
                    <input type="tel" id="input-phone" class="c360-inline-input" value="${user.phone || user.phoneNumber || ""}">
                    <div class="inline-action-btns">
                        <button class="inline-btn-save" onclick="c360SaveField('phone')"><i class="fa-solid fa-check"></i> រក្សាទុក</button>
                        <button class="inline-btn-cancel" onclick="c360CancelEdit('phone')">បោះបង់</button>
                    </div>
                </div>
            </div>

            <!-- ២. អ៊ីមែល (Editable) -->
            <div class="c360-data-box editable" id="box-email" style="background: #ffffff;">
                <div id="view-email" style="display: flex; flex-direction: column; width: 100%;">
                    <span class="c360-label-small">អ៊ីមែល (EMAIL)</span>
                    <span class="c360-value-text">${user.email || "N/A"}</span>
                    <i class="fa-solid fa-pen edit-icon" id="icon-email" onclick="c360ToggleEdit('email', 'email')" title="កែប្រែ"></i>
                </div>
                <div id="edit-email" style="display: none; width: 100%;">
                    <span class="c360-label-small" style="color: #3b82f6;">កែប្រែអ៊ីមែល (EMAIL)</span>
                    <input type="email" id="input-email" class="c360-inline-input" value="${user.email || ""}">
                    <div class="inline-action-btns">
                        <button class="inline-btn-save" onclick="c360SaveField('email')"><i class="fa-solid fa-check"></i> រក្សាទុក</button>
                        <button class="inline-btn-cancel" onclick="c360CancelEdit('email')">បោះបង់</button>
                    </div>
                </div>
            </div>

            <!-- ៣. អ្នកណែនាំ (Read-only) -->
             <div class="c360-data-box" style="background: #ffffff;">
                <span class="c360-label-small">អ្នកណែនាំ (REFERRED BY)</span>
                <span class="c360-value-text">${referrerId}</span>
                ${referrerNameHtml}
            </div>

        </div>
    </div>

    <!-- 📦 កាតទី៣៖ សុវត្ថិភាព (Reset Credentials) -->
    <div class="c360-inner-card c360-security-section">
        <h4 class="c360-inner-title" style="color: #ef4444;"><i class="fa-solid fa-shield-halved"></i> សុវត្ថិភាព (Security & Credentials)</h4>
        <p style="font-size: 0.85rem; color: #64748b; margin-bottom: 20px; line-height: 1.5; font-family: 'Kantumruy Pro', sans-serif;">
            លេខសម្ងាត់ (Password) និង លេខកូដ (PIN) ត្រូវបានលាក់ដើម្បីសុវត្ថិភាព។ ប្រសិនបើអតិថិជនភ្លេច អ្នកអាចចុចប៊ូតុងខាងក្រោមដើម្បីផ្ញើ Link អោយគាត់កំណត់វាឡើងវិញដោយខ្លួនឯង។
        </p>
        <div style="display: flex; gap: 15px; flex-wrap: wrap;">
            <button class="c360-btn-reset-outline" onclick="c360TriggerReset('PIN')">
                <i class="fa-solid fa-key"></i> កំណត់ PIN ថ្មី (Reset PIN)
            </button>
            <button class="c360-btn-reset-outline" onclick="c360TriggerReset('Password')">
                <i class="fa-solid fa-lock"></i> កំណត់ Password ថ្មី (Reset Password)
            </button>
        </div>
    </div>
  `;
}

// =======================================================
// មុខងារ Inline Edit Logic
// =======================================================

function c360ToggleEdit(field, type) {
  document.getElementById(`view-${field}`).style.display = "none";
  document.getElementById(`edit-${field}`).style.display = "block";

  // ដក hover effect ចេញពេលកំពុង edit
  document.getElementById(`box-${field}`).classList.remove("editable");

  const input = document.getElementById(`input-${field}`);
  input.focus();
  const val = input.value;
  input.value = "";
  input.value = val;
}

function c360CancelEdit(field) {
  document.getElementById(`edit-${field}`).style.display = "none";
  document.getElementById(`view-${field}`).style.display = "flex";

  // ដាក់ hover effect មកវិញ
  document.getElementById(`box-${field}`).classList.add("editable");

  const currentVal =
    field === "phone"
      ? currentC360User.phone || currentC360User.phoneNumber
      : currentC360User[field];
  document.getElementById(`input-${field}`).value = currentVal || "";
}

async function c360SaveField(field) {
  const inputEl = document.getElementById(`input-${field}`);
  const newValue = inputEl.value.trim();

  if (!newValue && field !== "email") {
    Swal.fire({
      toast: true,
      position: "top",
      icon: "warning",
      title: "សូមបញ្ចូលទិន្នន័យ!",
      showConfirmButton: false,
      timer: 2000,
    });
    return inputEl.focus();
  }

  const bodyData = {
    id: currentC360User._id || currentC360User.id,
    username: currentC360User.username,
  };
  bodyData[field] = newValue;

  Swal.fire({
    title: "កំពុងរក្សាទុក...",
    toast: true,
    position: "top-end",
    showConfirmButton: false,
    didOpen: () => Swal.showLoading(),
  });

  try {
    const res = await fetch("/api/admin/edit-user", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(bodyData),
    });

    const data = await res.json();
    if (data.success) {
      // Update UI
      document
        .getElementById(`view-${field}`)
        .querySelector(".c360-value-text").innerText = newValue || "N/A";

      // Update State ក្នុង Local
      if (field === "phone") {
        currentC360User.phone = newValue;
        currentC360User.phoneNumber = newValue;
      } else {
        currentC360User[field] = newValue;
      }

      // បិទ Edit Mode
      c360CancelEdit(field);

      // បើកែឈ្មោះពេញ ត្រូវអាប់ដេតឈ្មោះនៅលើ Sidebar ខាងឆ្វេងដែរ
      if (field === "fullName") {
        const isKycVerified =
          currentC360User.kycStatus === "verified" ||
          currentC360User.kycStatus === "approved";
        const kycIcon = isKycVerified
          ? `<i class="fa-solid fa-circle-check" style="color: #3b82f6; font-size: 1.1rem; margin-left: 5px;" title="KYC Verified"></i>`
          : `<i class="fa-solid fa-circle-check" style="color: #cbd5e1; font-size: 1.1rem; margin-left: 5px;" title="KYC Unverified"></i>`;
        const sidebarTitle = document.querySelector(".c360-sidebar h3");
        if (sidebarTitle) sidebarTitle.innerHTML = `${newValue} ${kycIcon}`;
      }

      Swal.fire({
        icon: "success",
        title: "បានរក្សាទុក!",
        toast: true,
        position: "top-end",
        timer: 1500,
        showConfirmButton: false,
      });
    } else {
      throw new Error(data.message);
    }
  } catch (e) {
    Swal.fire({
      icon: "error",
      title: "បរាជ័យ",
      text: e.message || "បញ្ហា Server",
      customClass: { popup: "premium-swal kh-text" },
    });
  }
}

// =======================================================
// មុខងារស្នើសុំ Reset PIN ឬ Password (ផ្ញើ Link ទៅ Email)
// =======================================================
async function c360TriggerReset(type) {
  if (!currentC360User) return;

  const email = currentC360User.email;
  if (!email) {
    Swal.fire({
      icon: "warning",
      title: "គ្មានអ៊ីមែល (No Email)",
      text: "អតិថិជននេះមិនទាន់មានអ៊ីមែលក្នុងប្រព័ន្ធទេ។ សូមបញ្ចូលអ៊ីមែលនៅផ្នែកទំនាក់ទំនងខាងលើជាមុនសិន ទើបអាចផ្ញើ Link បាន។",
      customClass: { popup: "premium-swal kh-text" },
    });
    return;
  }

  // សុំការបញ្ជាក់ពី Admin មុននឹងផ្ញើ
  const result = await Swal.fire({
    title: `<span class="kh-text" style="color: #ef4444;">បញ្ជាក់ការផ្ញើ Link Reset ${type}</span>`,
    html: `
      <p class="kh-text" style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 15px; line-height: 1.5;">
        តើអ្នកពិតជាចង់ផ្ញើតំណភ្ជាប់ (Link) ដើម្បីឱ្យអតិថិជនកំណត់ <strong>${type}</strong> ថ្មីដោយខ្លួនឯងមែនទេ?
        <br><br>Link នឹងត្រូវផ្ញើទៅកាន់៖ <strong style="color: #0f172a;">${email}</strong>
      </p>
      <p style="font-size: 0.8rem; color: #eab308; font-family: 'Kantumruy Pro';"><i class="fa-solid fa-clock"></i> Link នេះមានសុពលភាពតែ ៥ នាទីប៉ុណ្ណោះ!</p>
    `,
    showCancelButton: true,
    confirmButtonText:
      '<span class="kh-text"><i class="fa-solid fa-paper-plane"></i> ផ្ញើឥឡូវនេះ</span>',
    cancelButtonText: '<span class="kh-text">បោះបង់</span>',
    confirmButtonColor: "#ef4444",
    customClass: { popup: "modal-radius" },
  });

  if (result.isConfirmed) {
    Swal.fire({
      title: "កំពុងផ្ញើអ៊ីមែល...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
      customClass: { popup: "premium-swal" },
    });

    try {
      const res = await fetch("/api/admin/request-reset", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          username: currentC360User.username,
          resetType: type, // "PIN" ឬ "Password"
        }),
      });

      const data = await res.json();
      if (data.success) {
        Swal.fire({
          icon: "success",
          title: "បានផ្ញើជោគជ័យ!",
          text: `Link ត្រូវបានផ្ញើទៅកាន់អ៊ីមែល ${email} រួចរាល់។`,
          timer: 3000,
          showConfirmButton: true,
          confirmButtonText: "បិទ",
          confirmButtonColor: "#10b981",
          customClass: { popup: "premium-swal kh-text" },
        });
      } else {
        throw new Error(data.message);
      }
    } catch (e) {
      Swal.fire(
        "បរាជ័យ",
        "បញ្ហាក្នុងការផ្ញើ៖ " + (e.message || "Server Error"),
        "error",
      );
    }
  }
}

// =======================================================
// ➡️ TAB 2: គ្រប់គ្រងកាបូបលុយ និងគណនី (Wallets & Accounts)
// =======================================================
function renderWalletsTab(user) {
  const container = document.getElementById("c360-tab-finance");
  if (!container) return;

  const formatUSD = (val) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(val || 0);
  const formatKHR = (val) =>
    new Intl.NumberFormat("en-US").format(val || 0) + " ៛";

  // ----------------------------------------------------
  // ១. គណនីចម្បង (Main Accounts)
  // ----------------------------------------------------
  const mainUSD = user.mainAccounts?.USD || {};
  const mainKHR = user.mainAccounts?.KHR || {};

  let mainAccountsHtml = `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 30px;">
        
        <!-- Main USD -->
        <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-radius: 16px; padding: 20px; color: white; position: relative; box-shadow: 0 10px 20px rgba(15, 23, 42, 0.15); font-family: 'Kantumruy Pro', sans-serif;">
            
            <div style="display: flex; gap: 5px; position: absolute; top: -10px; right: 10px;">
                ${mainUSD.isHidden ? `<div style="background: #64748b; color: white; padding: 4px 12px; border-radius: 12px; font-size: 0.7rem; font-weight: bold; border: 2px solid white; box-shadow: 0 2px 4px rgba(100,116,139,0.3);"><i class="fa-solid fa-eye-slash"></i> HIDDEN</div>` : ""}
                ${mainUSD.isFrozen ? `<div style="background: #ef4444; color: white; padding: 4px 12px; border-radius: 12px; font-size: 0.7rem; font-weight: bold; border: 2px solid white; box-shadow: 0 2px 4px rgba(239,68,68,0.3);"><i class="fa-solid fa-pause"></i> FROZEN</div>` : ""}
            </div>

            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px; margin-top: 5px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="width: 40px; height: 40px; background: rgba(255,255,255,0.1); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; color: #38bdf8;">
                        <i class="fa-solid fa-dollar-sign"></i>
                    </div>
                    <div>
                        <div style="font-size: 0.95rem; font-weight: 700; color: #f8fafc;">${mainUSD.accountName || "Main Account USD"}</div>
                        <div style="font-size: 0.8rem; color: #cbd5e1; font-family: 'Inter', monospace; margin-top: 2px; cursor: pointer; display: flex; align-items: center; gap: 5px;" onclick="navigator.clipboard.writeText('${mainUSD.accountNumber}'); Swal.fire({toast:true, position:'top-end', icon:'success', title:'បានចម្លង (Copied)!', showConfirmButton:false, timer:1000});" title="ចុចដើម្បី Copy">
                            ${mainUSD.accountNumber || "N/A"} <i class="fa-regular fa-copy" style="opacity: 0.8;"></i>
                        </div>
                    </div>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 0.7rem; color: #94a3b8; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px;">Limit</div>
                    <div style="font-size: 0.85rem; color: #f8fafc; font-weight: 600; font-family: 'Kantumruy Pro', sans-serif;">$${mainUSD.dailyLimit || 1000} / ថ្ងៃ</div>
                </div>
            </div>
            
            <div style="margin-bottom: 20px;">
                <div style="font-size: 2.2rem; font-weight: 800; font-family: 'JetBrains Mono', monospace; line-height: 1; color: #ffffff;">${formatUSD(mainUSD.balance)}</div>
            </div>
            
            <div style="display: flex; gap: 8px;">
                <button onclick="c360JumpToTrx('${mainUSD.accountNumber}')" style="flex: 1; background: rgba(255,255,255,0.1); border: none; padding: 10px; border-radius: 8px; color: white; cursor: pointer; font-size: 0.85rem; font-weight: bold; transition: 0.2s; font-family: 'Kantumruy Pro';" onmouseover="this.style.background='rgba(255,255,255,0.2)'" onmouseout="this.style.background='rgba(255,255,255,0.1)'"><i class="fa-solid fa-receipt"></i> របាយការណ៍</button>
                
                <button onclick="c360EditAccountLimit('${mainUSD.accountNumber}', ${mainUSD.dailyLimit || 1000})" style="flex: 1; background: rgba(255,255,255,0.1); border: none; padding: 10px; border-radius: 8px; color: white; cursor: pointer; font-size: 0.85rem; font-weight: bold; transition: 0.2s; font-family: 'Kantumruy Pro';" onmouseover="this.style.background='rgba(255,255,255,0.2)'" onmouseout="this.style.background='rgba(255,255,255,0.1)'"><i class="fa-solid fa-sliders"></i> កំណត់ Limit</button>
                
                <button onclick="c360ToggleAccHide('${mainUSD.accountNumber}', ${mainUSD.isHidden})" style="background: ${mainUSD.isHidden ? "#cbd5e1" : "rgba(255,255,255,0.1)"}; border: none; padding: 10px 15px; border-radius: 8px; color: ${mainUSD.isHidden ? "#0f172a" : "white"}; cursor: pointer; font-size: 0.85rem; font-weight: bold; transition: 0.2s;" title="${mainUSD.isHidden ? "បង្ហាញវិញ (Unhide)" : "លាក់គណនី (Hide)"}"><i class="fa-solid ${mainUSD.isHidden ? "fa-eye" : "fa-eye-slash"}"></i></button>

                <button onclick="c360ToggleAccFreeze('${mainUSD.accountNumber}', ${mainUSD.isFrozen})" style="background: ${mainUSD.isFrozen ? "#10b981" : "rgba(239,68,68,0.2)"}; border: none; padding: 10px 15px; border-radius: 8px; color: ${mainUSD.isFrozen ? "white" : "#fca5a5"}; cursor: pointer; font-size: 0.85rem; font-weight: bold; transition: 0.2s;" title="${mainUSD.isFrozen ? "បើកគណនីនេះវិញ" : "ផ្អាកគណនីនេះ"}"><i class="fa-solid ${mainUSD.isFrozen ? "fa-play" : "fa-pause"}"></i></button>
            </div>
        </div>

        <!-- Main KHR -->
        <div style="background: linear-gradient(135deg, #0f766e 0%, #064e3b 100%); border-radius: 16px; padding: 20px; color: white; position: relative; box-shadow: 0 10px 20px rgba(6, 78, 59, 0.15); font-family: 'Kantumruy Pro', sans-serif;">
            
            <div style="display: flex; gap: 5px; position: absolute; top: -10px; right: 10px;">
                ${mainKHR.isHidden ? `<div style="background: #64748b; color: white; padding: 4px 12px; border-radius: 12px; font-size: 0.7rem; font-weight: bold; border: 2px solid white; box-shadow: 0 2px 4px rgba(100,116,139,0.3);"><i class="fa-solid fa-eye-slash"></i> HIDDEN</div>` : ""}
                ${mainKHR.isFrozen ? `<div style="background: #ef4444; color: white; padding: 4px 12px; border-radius: 12px; font-size: 0.7rem; font-weight: bold; border: 2px solid white; box-shadow: 0 2px 4px rgba(239,68,68,0.3);"><i class="fa-solid fa-pause"></i> FROZEN</div>` : ""}
            </div>

            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px; margin-top: 5px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="width: 40px; height: 40px; background: rgba(255,255,255,0.1); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; color: #34d399;">
                        ៛
                    </div>
                    <div>
                        <div style="font-size: 0.95rem; font-weight: 700; color: #f8fafc;">${mainKHR.accountName || "Main Account KHR"}</div>
                        <div style="font-size: 0.8rem; color: #cbd5e1; font-family: 'Inter', monospace; margin-top: 2px; cursor: pointer; display: flex; align-items: center; gap: 5px;" onclick="navigator.clipboard.writeText('${mainKHR.accountNumber}'); Swal.fire({toast:true, position:'top-end', icon:'success', title:'បានចម្លង (Copied)!', showConfirmButton:false, timer:1000});" title="ចុចដើម្បី Copy">
                            ${mainKHR.accountNumber || "N/A"} <i class="fa-regular fa-copy" style="opacity: 0.8;"></i>
                        </div>
                    </div>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 0.7rem; color: #99f6e4; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px;">Limit</div>
                    <div style="font-size: 0.85rem; color: #f8fafc; font-weight: 600; font-family: 'Kantumruy Pro', sans-serif;">${(mainKHR.dailyLimit || 4000000).toLocaleString()} ៛ / ថ្ងៃ</div>
                </div>
            </div>
            
            <div style="margin-bottom: 20px;">
                <div style="font-size: 2.2rem; font-weight: 800; font-family: 'JetBrains Mono', monospace; line-height: 1; color: #ffffff;">${formatKHR(mainKHR.balance)}</div>
            </div>
            
            <div style="display: flex; gap: 8px;">
                <button onclick="c360JumpToTrx('${mainKHR.accountNumber}')" style="flex: 1; background: rgba(255,255,255,0.1); border: none; padding: 10px; border-radius: 8px; color: white; cursor: pointer; font-size: 0.85rem; font-weight: bold; transition: 0.2s; font-family: 'Kantumruy Pro';" onmouseover="this.style.background='rgba(255,255,255,0.2)'" onmouseout="this.style.background='rgba(255,255,255,0.1)'"><i class="fa-solid fa-receipt"></i> របាយការណ៍</button>
                
                <button onclick="c360EditAccountLimit('${mainKHR.accountNumber}', ${mainKHR.dailyLimit || 4000000})" style="flex: 1; background: rgba(255,255,255,0.1); border: none; padding: 10px; border-radius: 8px; color: white; cursor: pointer; font-size: 0.85rem; font-weight: bold; transition: 0.2s; font-family: 'Kantumruy Pro';" onmouseover="this.style.background='rgba(255,255,255,0.2)'" onmouseout="this.style.background='rgba(255,255,255,0.1)'"><i class="fa-solid fa-sliders"></i> កំណត់ Limit</button>
                
                <button onclick="c360ToggleAccHide('${mainKHR.accountNumber}', ${mainKHR.isHidden})" style="background: ${mainKHR.isHidden ? "#cbd5e1" : "rgba(255,255,255,0.1)"}; border: none; padding: 10px 15px; border-radius: 8px; color: ${mainKHR.isHidden ? "#0f172a" : "white"}; cursor: pointer; font-size: 0.85rem; font-weight: bold; transition: 0.2s;" title="${mainKHR.isHidden ? "បង្ហាញវិញ (Unhide)" : "លាក់គណនី (Hide)"}"><i class="fa-solid ${mainKHR.isHidden ? "fa-eye" : "fa-eye-slash"}"></i></button>

                <button onclick="c360ToggleAccFreeze('${mainKHR.accountNumber}', ${mainKHR.isFrozen})" style="background: ${mainKHR.isFrozen ? "#10b981" : "rgba(239,68,68,0.2)"}; border: none; padding: 10px 15px; border-radius: 8px; color: ${mainKHR.isFrozen ? "white" : "#fca5a5"}; cursor: pointer; font-size: 0.85rem; font-weight: bold; transition: 0.2s;" title="${mainKHR.isFrozen ? "បើកគណនីនេះវិញ" : "ផ្អាកគណនីនេះ"}"><i class="fa-solid ${mainKHR.isFrozen ? "fa-play" : "fa-pause"}"></i></button>
            </div>
        </div>
    </div>
  `;

  // ----------------------------------------------------
  // ២. គណនីរង គណនីសន្សំ និង គណនីកុមារ (Sub & Junior Accounts)
  // ----------------------------------------------------
  let subAccountsHtml = "";
  if (user.subAccounts && user.subAccounts.length > 0) {
    const generateSubCard = (sub) => {
      const isKHR = sub.currency === "KHR";
      const isJunior = sub.accountType === "junior";
      const isJoint =
        sub.accountType === "joint" || sub.accountType === "joint_member";

      let bgStyle = "";
      let textColor = "white";
      let badgeHtml = "";

      if (isJunior && !isKHR) {
        bgStyle =
          "background: linear-gradient(135deg, #c2410c 0%, #f59e0b 100%); box-shadow: 0 8px 15px rgba(245, 158, 11, 0.2);";
        badgeHtml = `<span style="background: white; color: #d97706; padding: 3px 8px; border-radius: 12px; font-size: 0.65rem; font-weight: bold; margin-left: 8px;">JUNIOR</span>`;
      } else if (isJunior && isKHR) {
        bgStyle =
          "background: linear-gradient(135deg, #b45309 0%, #fbbf24 100%); box-shadow: 0 8px 15px rgba(251, 191, 36, 0.2);";
        badgeHtml = `<span style="background: white; color: #b45309; padding: 3px 8px; border-radius: 12px; font-size: 0.65rem; font-weight: bold; margin-left: 8px;">JUNIOR</span>`;
      } else if (isJoint && !isKHR) {
        bgStyle =
          "background: linear-gradient(135deg, #4c1d95 0%, #8b5cf6 100%); box-shadow: 0 8px 15px rgba(139, 92, 246, 0.2);";
        badgeHtml = `<span style="background: white; color: #6d28d9; padding: 3px 8px; border-radius: 12px; font-size: 0.65rem; font-weight: bold; margin-left: 8px;">JOINT</span>`;
      } else if (isJoint && isKHR) {
        bgStyle =
          "background: linear-gradient(135deg, #831843 0%, #ec4899 100%); box-shadow: 0 8px 15px rgba(236, 72, 153, 0.2);";
        badgeHtml = `<span style="background: white; color: #be185d; padding: 3px 8px; border-radius: 12px; font-size: 0.65rem; font-weight: bold; margin-left: 8px;">JOINT</span>`;
      } else if (!isKHR) {
        bgStyle =
          "background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); box-shadow: 0 8px 15px rgba(59, 130, 246, 0.2);";
      } else {
        bgStyle =
          "background: linear-gradient(135deg, #134e4a 0%, #14b8a6 100%); box-shadow: 0 8px 15px rgba(20, 184, 166, 0.2);";
      }

      const balText = isKHR ? formatKHR(sub.balance) : formatUSD(sub.balance);

      const dailyLimitVal = sub.dailyLimit || (isKHR ? 4000000 : 1000);
      const limitDisplay = isKHR
        ? `${dailyLimitVal.toLocaleString()} ៛ / ថ្ងៃ`
        : `$${dailyLimitVal} / ថ្ងៃ`;

      return `
            <div style="${bgStyle} border-radius: 16px; padding: 20px; color: ${textColor}; position: relative; transition: 0.2s; font-family: 'Kantumruy Pro', sans-serif;" id="subcard-${sub.accountNumber}">
                
                <div style="display: flex; gap: 5px; position: absolute; top: -10px; right: 10px;">
                    ${sub.isHidden ? `<div style="background: #64748b; color: white; padding: 4px 12px; border-radius: 12px; font-size: 0.7rem; font-weight: bold; border: 2px solid white; box-shadow: 0 2px 4px rgba(100,116,139,0.3);"><i class="fa-solid fa-eye-slash"></i> HIDDEN</div>` : ""}
                    ${sub.isFrozen ? `<div style="background: #ef4444; color: white; padding: 4px 12px; border-radius: 12px; font-size: 0.7rem; font-weight: bold; border: 2px solid white; box-shadow: 0 2px 4px rgba(239,68,68,0.3);"><i class="fa-solid fa-pause"></i> FROZEN</div>` : ""}
                </div>

                <!-- 🌟 មុខងារ VIEW ទម្រង់ដើម -->
                <div id="view-mode-${sub.accountNumber}" style="margin-top: 5px;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <div style="width: 35px; height: 35px; background: rgba(255,255,255,0.2); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 1rem; color: white; font-weight: bold;">
                                ${isKHR ? "៛" : '<i class="fa-solid fa-dollar-sign"></i>'}
                            </div>
                            <div>
                                <div style="font-size: 0.95rem; font-weight: 700; color: #f8fafc; display: flex; align-items: center;">
                                    ${sub.accountName} ${badgeHtml}
                                </div>
                                <div style="font-size: 0.8rem; color: rgba(255,255,255,0.8); font-family: 'Inter', monospace; margin-top: 2px; cursor: pointer; display: flex; align-items: center; gap: 5px;" onclick="navigator.clipboard.writeText('${sub.accountNumber}'); Swal.fire({toast:true, position:'top-end', icon:'success', title:'បានចម្លង (Copied)!', showConfirmButton:false, timer:1000});" title="ចុចដើម្បី Copy">
                                    ${sub.accountNumber} <i class="fa-regular fa-copy"></i>
                                </div>
                            </div>
                        </div>

                        <div style="text-align: right;">
                            <div style="font-size: 0.65rem; color: rgba(255,255,255,0.7); text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px;">Limit</div>
                            <div style="font-size: 0.85rem; color: #ffffff; font-weight: 600; font-family: 'Kantumruy Pro', sans-serif;">${limitDisplay}</div>
                        </div>
                    </div>

                    <div style="font-size: 1.8rem; font-weight: 800; font-family: 'JetBrains Mono', monospace; color: #ffffff; margin-bottom: 20px; line-height: 1;">
                        ${balText}
                    </div>

                    <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                        <button onclick="c360JumpToTrx('${sub.accountNumber}')" style="flex: 1; background: rgba(255,255,255,0.2); border: none; padding: 8px; border-radius: 8px; color: white; cursor: pointer; font-size: 0.8rem; font-weight: bold; font-family: 'Kantumruy Pro'; transition: 0.2s;"><i class="fa-solid fa-receipt"></i> Trx</button>
                        
                        <button onclick="c360ToggleInlineEdit('${sub.accountNumber}')" style="background: rgba(255,255,255,0.2); border: none; padding: 8px 12px; border-radius: 8px; color: white; cursor: pointer; font-size: 0.8rem; font-weight: bold; transition: 0.2s;" title="កែប្រែគណនី (Edit)"><i class="fa-solid fa-pen"></i></button>
                        
                        <button onclick="c360EditAccountLimit('${sub.accountNumber}', ${sub.dailyLimit || (isKHR ? 4000000 : 1000)})" style="background: rgba(255,255,255,0.2); border: none; padding: 8px 12px; border-radius: 8px; color: white; cursor: pointer; font-size: 0.8rem; font-weight: bold; transition: 0.2s;" title="កំណត់ Limit (Set Limit)"><i class="fa-solid fa-sliders"></i></button>
                        
                        <button onclick="c360ToggleAccHide('${sub.accountNumber}', ${sub.isHidden})" style="background: ${sub.isHidden ? "#cbd5e1" : "rgba(255,255,255,0.2)"}; border: none; padding: 8px 12px; border-radius: 8px; color: ${sub.isHidden ? "#0f172a" : "white"}; cursor: pointer; font-size: 0.8rem; font-weight: bold; transition: 0.2s;" title="${sub.isHidden ? "បង្ហាញវិញ (Unhide)" : "លាក់គណនី (Hide)"}"><i class="fa-solid ${sub.isHidden ? "fa-eye" : "fa-eye-slash"}"></i></button>

                        <button onclick="c360ToggleAccFreeze('${sub.accountNumber}', ${sub.isFrozen})" style="background: ${sub.isFrozen ? "#10b981" : "rgba(255,255,255,0.2)"}; border: 1px solid ${sub.isFrozen ? "#10b981" : "transparent"}; padding: 8px 12px; border-radius: 8px; color: ${sub.isFrozen ? "white" : "#ef4444"}; cursor: pointer; font-size: 0.8rem; font-weight: bold; transition: 0.2s;" title="${sub.isFrozen ? "បើកវិញ (Play)" : "ផ្អាក (Pause)"}"><i class="fa-solid ${sub.isFrozen ? "fa-play" : "fa-pause"}"></i></button>

                        <button onclick="c360DeleteSubAccountConfirm('${sub.accountNumber}')" style="background: rgba(239, 68, 68, 0.4); border: none; padding: 8px 12px; border-radius: 8px; color: white; cursor: pointer; font-size: 0.8rem; font-weight: bold; transition: 0.2s;" title="លុបគណនី (Delete)"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>

                <!-- 🌟 មុខងារ EDIT (លាក់សិន) -->
                <div id="edit-mode-${sub.accountNumber}" style="display: none; margin-top: 5px;">
                    <div style="font-size: 0.85rem; font-weight: bold; margin-bottom: 10px; color: white;"><i class="fa-solid fa-pen"></i> កែប្រែគណនី</div>
                    
                    <label style="font-size: 0.7rem; opacity: 0.9; color: white;">ឈ្មោះគណនី (Account Name)</label>
                    <input type="text" id="edit-name-${sub.accountNumber}" value="${sub.accountName}" style="width: 100%; padding: 8px; margin-bottom: 10px; border-radius: 6px; border: none; outline: none; color: #0f172a; font-weight: bold; font-family: 'Kantumruy Pro'; box-sizing: border-box;">
                    
                    <label style="font-size: 0.7rem; opacity: 0.9; color: white;">លេខគណនី (Account No)</label>
                    <input type="text" id="edit-num-${sub.accountNumber}" value="${sub.accountNumber}" style="width: 100%; padding: 8px; margin-bottom: 15px; border-radius: 6px; border: none; outline: none; color: #0f172a; font-weight: bold; font-family: monospace; box-sizing: border-box;">
                    
                    <div style="display: flex; gap: 8px;">
                        <button onclick="c360SaveInlineEditSubAcc('${sub.accountNumber}')" style="flex: 1; background: #10b981; color: white; border: none; padding: 8px; border-radius: 6px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 5px; font-family: 'Kantumruy Pro';"><i class="fa-solid fa-check"></i> រក្សាទុក</button>
                        <button onclick="c360ToggleInlineEdit('${sub.accountNumber}')" style="flex: 1; background: rgba(255,255,255,0.2); color: white; border: none; padding: 8px; border-radius: 6px; font-weight: bold; cursor: pointer; font-family: 'Kantumruy Pro';">បោះបង់</button>
                    </div>
                </div>
            </div>
          `;
    };

    subAccountsHtml = `
        <h3 style="margin: 0 0 15px 0; font-size: 1.1rem; color: var(--text-main); font-family: 'Kantumruy Pro'; border-top: 1px solid var(--border); padding-top: 20px;">
            <i class="fa-solid fa-layer-group" style="color: #8b5cf6;"></i> គណនីរង និង គណនីកុមារ (Sub & Junior Accounts)
        </h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px;">
            ${user.subAccounts.map(generateSubCard).join("")}
        </div>
      `;
  } else {
    subAccountsHtml = `
        <h3 style="margin: 0 0 15px 0; font-size: 1.1rem; color: var(--text-main); font-family: 'Kantumruy Pro'; border-top: 1px solid var(--border); padding-top: 20px;">
            <i class="fa-solid fa-layer-group" style="color: #8b5cf6;"></i> គណនីរង និង គណនីកុមារ (Sub & Junior Accounts)
        </h3>
        <div style="text-align: center; padding: 30px; background: var(--bg-body); border-radius: 12px; border: 1px dashed var(--border); color: var(--text-muted); font-family: 'Kantumruy Pro';">
            អតិថិជនមិនទាន់មានគណនីរង (Sub-Accounts) នោះទេ។
        </div>
      `;
  }

  container.innerHTML = `
    <h2 style="margin: 0 0 20px 0; font-size: 1.3rem; color: var(--text-main); font-family: 'Kantumruy Pro'; font-weight: 800; border-bottom: 2px solid var(--border); padding-bottom: 15px;">
        <i class="fa-solid fa-wallet" style="color: var(--secondary);"></i> គ្រប់គ្រងកាបូបលុយ និងគណនី (Wallets & Accounts)
    </h2>
    ${mainAccountsHtml}
    ${subAccountsHtml}
  `;
}

// =======================================================
// មុខងារបញ្ជាកាត Sub-Accounts (Inline Actions)
// =======================================================

// ១. បិទ/បើក ផ្ទាំង Edit នៅលើកាតផ្ទាល់
window.c360ToggleInlineEdit = function (accountNumber) {
  const viewMode = document.getElementById(`view-mode-${accountNumber}`);
  const editMode = document.getElementById(`edit-mode-${accountNumber}`);

  if (viewMode.style.display === "none") {
    viewMode.style.display = "block";
    editMode.style.display = "none";
  } else {
    viewMode.style.display = "none";
    editMode.style.display = "block";
  }
};

// ២. រក្សាទុកការកែប្រែ (Save Edit)
window.c360SaveInlineEditSubAcc = async function (oldAccountNumber) {
  const newName = document
    .getElementById(`edit-name-${oldAccountNumber}`)
    .value.trim();
  const newNumber = document
    .getElementById(`edit-num-${oldAccountNumber}`)
    .value.trim();

  if (!newName || !newNumber)
    return Swal.fire({
      toast: true,
      position: "top",
      icon: "warning",
      title: "សូមបំពេញឈ្មោះ និងលេខគណនី!",
      showConfirmButton: false,
      timer: 2000,
    });

  const bodyData = {
    username: currentC360User.username,
    oldAccountNumber: oldAccountNumber,
    newName: newName,
    newAccountNumber: newNumber,
  };

  try {
    const res = await fetch("/api/admin/account/edit-sub-account", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(bodyData),
    });
    const data = await res.json();

    if (data.success) {
      c360RefreshData();
      Swal.fire({
        icon: "success",
        title: "ជោគជ័យ!",
        text: data.message,
        timer: 1500,
        showConfirmButton: false,
        customClass: { popup: "premium-swal kh-text" },
      });
    } else {
      Swal.fire("បរាជ័យ", data.message || "មិនអាចកែប្រែបានទេ!", "error");
    }
  } catch (e) {
    Swal.fire("បរាជ័យ", "មានបញ្ហា Server!", "error");
  }
};

// ៣. លុបគណនី (SweetAlert Delete Confirmation)
window.c360DeleteSubAccountConfirm = async function (accountNumber) {
  const result = await Swal.fire({
    title:
      '<span class="kh-text" style="font-size: 1.2rem; color: #ef4444;">បញ្ជាក់ការលុបគណនី</span>',
    html: '<p class="kh-text" style="font-size: 0.95rem; margin-top: 10px;">តើអ្នកពិតជាចង់លុបគណនីរងនេះចោលមែនទេ?<br><br><b><i class="fa-solid fa-triangle-exclamation"></i> ចំណាំ៖</b> ប្រសិនបើមានសមតុល្យលុយសល់ វានឹងត្រូវបង្វិលចូលគណនីចម្បង (Main Account) វិញដោយស្វ័យប្រវត្តិ។</p>',
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: '<i class="fa-solid fa-trash"></i> យល់ព្រមលុប',
    cancelButtonText: "បោះបង់",
    confirmButtonColor: "#ef4444",
    customClass: { popup: "modal-radius kh-text" },
  });

  if (result.isConfirmed) {
    Swal.fire({
      title: "កំពុងលុប...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });
    try {
      const res = await fetch("/api/admin/account/delete-sub-account", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          username: currentC360User.username,
          accountNumber: accountNumber,
        }),
      });
      const data = await res.json();

      if (data.success) {
        c360RefreshData();
        Swal.fire({
          icon: "success",
          title: "បានលុបជោគជ័យ!",
          timer: 1500,
          showConfirmButton: false,
          customClass: { popup: "premium-swal kh-text" },
        });
      } else {
        Swal.fire("បរាជ័យ", data.message || "មិនអាចលុបបានទេ!", "error");
      }
    } catch (e) {
      Swal.fire("បរាជ័យ", "មានបញ្ហា Server!", "error");
    }
  }
};

// 🟢 មុខងារលាក់/បង្ហាញគណនី (Hide / Unhide Account)
window.c360ToggleAccHide = async function (accountNumber, isCurrentlyHidden) {
  Swal.fire({
    title: "កំពុងដំណើរការ...",
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading(),
  });
  try {
    const res = await fetch("/api/admin/account/toggle-hide", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        username: currentC360User.username,
        accountNumber,
      }),
    });
    const data = await res.json();

    if (data.success) {
      c360RefreshData();
      Swal.fire({
        icon: "success",
        title: "ជោគជ័យ!",
        text: data.message,
        timer: 1500,
        showConfirmButton: false,
        customClass: { popup: "premium-swal kh-text" },
      });
    } else {
      throw new Error(data.message);
    }
  } catch (e) {
    Swal.fire("បរាជ័យ", e.message || "មានបញ្ហា Server", "error");
  }
};

// 🟢 មុខងារកែប្រែកម្រិតចំណាយប្រចាំថ្ងៃ (Edit Daily Limit)
window.c360EditAccountLimit = async function (accountNumber, currentLimit) {
  const { value: newLimit } = await Swal.fire({
    title:
      '<span class="kh-text" style="font-size: 1.2rem;">កំណត់ទំហំចំណាយប្រចាំថ្ងៃ (Daily Limit)</span>',
    input: "number",
    inputValue: currentLimit,
    inputPlaceholder: "បញ្ចូលចំនួនទឹកប្រាក់...",
    showCancelButton: true,
    confirmButtonText: "រក្សាទុក",
    cancelButtonText: "បោះបង់",
    confirmButtonColor: "#8b5cf6",
    customClass: { popup: "modal-radius kh-text" },
    inputValidator: (value) => {
      if (!value || value <= 0)
        return "សូមបញ្ចូលចំនួនទឹកប្រាក់ឱ្យបានត្រឹមត្រូវ!";
    },
  });

  if (newLimit && Number(newLimit) !== Number(currentLimit)) {
    Swal.fire({
      title: "កំពុងរក្សាទុក...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });
    try {
      const res = await fetch("/api/admin/account/update-limit", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          username: currentC360User.username,
          accountNumber,
          dailyLimit: Number(newLimit),
        }),
      });
      const data = await res.json();
      if (data.success) {
        c360RefreshData();
        Swal.fire({
          icon: "success",
          title: "បានកំណត់ Limit ថ្មីជោគជ័យ!",
          timer: 1500,
          showConfirmButton: false,
          customClass: { popup: "premium-swal kh-text" },
        });
      } else throw new Error(data.message);
    } catch (e) {
      Swal.fire("បរាជ័យ", e.message || "មានបញ្ហា Server", "error");
    }
  }
};

// 🟢 មុខងារផ្អាកគណនីជាក់លាក់ (Freeze Specific Account)
window.c360ToggleAccFreeze = async function (accountNumber, isCurrentlyFrozen) {
  const actionText = isCurrentlyFrozen
    ? "បើកឱ្យដំណើរការវិញ (Unfreeze)"
    : "ផ្អាកបណ្តោះអាសន្ន (Freeze)";
  const color = isCurrentlyFrozen ? "#10b981" : "#ef4444";

  const result = await Swal.fire({
    title: `<span class="kh-text" style="font-size: 1.2rem; color: ${color};">${actionText} គណនីនេះ?</span>`,
    text: `តើអ្នកពិតជាចង់ ${actionText} មែនទេ?`,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "យល់ព្រម",
    cancelButtonText: "បោះបង់",
    confirmButtonColor: color,
    customClass: { popup: "modal-radius kh-text" },
  });

  if (result.isConfirmed) {
    Swal.fire({
      title: "កំពុងដំណើរការ...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });
    try {
      const res = await fetch("/api/admin/account/toggle-freeze", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          username: currentC360User.username,
          accountNumber,
        }),
      });
      const data = await res.json();
      if (data.success) {
        c360RefreshData();
        Swal.fire({
          icon: "success",
          title: "ជោគជ័យ!",
          text: data.message,
          timer: 1500,
          showConfirmButton: false,
          customClass: { popup: "premium-swal kh-text" },
        });
      } else throw new Error(data.message);
    } catch (e) {
      Swal.fire("បរាជ័យ", e.message || "មានបញ្ហា Server", "error");
    }
  }
};

// 🟢 មុខងារលោតទៅមើលប្រវត្តិ (Jump to Trx Tab) របស់គណនីនីមួយៗ
window.c360JumpToTrx = function (accountNumber) {
  switchC360Tab("trx");
  setTimeout(() => {
    const accSelect = document.getElementById("c360-trx-acc-filter");
    if (accSelect) {
      accSelect.value = accountNumber;
      c360FilterTrxList(true);
    }
  }, 100);
};

// =======================================================
// ➡️ TAB 3: គ្រប់គ្រងកាត (Virtual Cards Management - Refactored)
// =======================================================
let adminCardsSliderInstance = null;
let adminCurrentCardIndex = 0;

function renderCardsTab(user) {
  const container = document.getElementById("c360-tab-cards");
  if (!container) return;

  // ----------------------------------------------------
  // ១. រចនាប័ទ្ម (CSS) សម្រាប់កាត និងប៊ូតុងបញ្ជា
  // ----------------------------------------------------
  let stylesHtml = `
    <style>
      .admin-cards-slider-wrapper {
        position: relative;
        width: 100%;
        max-width: 450px;
        margin: 0 auto 30px auto;
        overflow: hidden;
      }
      .admin-cards-slider {
        display: flex;
        overflow-x: auto;
        overflow-y: hidden;
        scroll-snap-type: x mandatory;
        scroll-behavior: smooth;
        -webkit-overflow-scrolling: touch;
        padding: 20px 10px;
        gap: 15px;
      }
      .admin-cards-slider::-webkit-scrollbar { display: none; }
      
      .admin-card-perspective {
        flex: 0 0 100%;
        scroll-snap-align: center;
        perspective: 1000px;
        width: 100%;
        height: 230px;
        z-index: 10;
        cursor: pointer;
      }
      
      .admin-card-inner {
        position: relative;
        width: 100%;
        height: 100%;
        text-align: left;
        transition: transform 0.8s cubic-bezier(0.4, 0.2, 0.2, 1);
        transform-style: preserve-3d;
        border-radius: 20px;
        box-shadow: 0 15px 30px rgba(0,0,0,0.15);
      }
      .admin-card-inner.flipped { transform: rotateY(180deg); }
      
      .admin-card-front, .admin-card-back {
        position: absolute; width: 100%; height: 100%;
        -webkit-backface-visibility: hidden; backface-visibility: hidden;
        border-radius: 20px; box-sizing: border-box; color: #fff; overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.15);
      }
      .admin-card-front { padding: 20px; display: flex; flex-direction: column; justify-content: space-between; }
      .admin-card-back { transform: rotateY(180deg); padding: 0; display: flex; flex-direction: column; }
      
      /* THEMES */
      .theme-standard { background: linear-gradient(135deg, #149a83 0%, #004d40 100%) !important; }
      .theme-fifa { background: linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.7)), url("https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQwH-pP-2EY5Ap18poVEhGeFe-THx0TOhEvgFqALyZhJZLzu2V67xpXNOi7&s=10") center/cover no-repeat !important; }
      .theme-metal { background: linear-gradient(135deg, #bf953f 0%, #fcf6ba 25%, #b38728 50%, #fbf5b7 75%, #aa771c 100%) !important; }
      .theme-celebrity { background: linear-gradient(rgba(88,28,135,0.4), rgba(0,0,0,0.8)), url("https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ2RxvoEe_j52IEh_8Fu_DZ0aupMrDFYak0tD3k4Ee_ug&s=10") center/cover no-repeat !important; }
      .theme-anime { background: linear-gradient(rgba(185,28,28,0.5), rgba(0,0,0,0.85)), url("https://static0.cbrimages.com/wordpress/wp-content/uploads/2024/01/sasuke-naruto-and-sakura.jpg") center/cover no-repeat !important; }
      .theme-gamer { background: linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.85)), url("https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSt6gcTeCIeiBjdYzU0kX8wOqoz4k8HLKX_yMu9GDQErQ&s=10") center/cover no-repeat !important; }
      .theme-eco { background: linear-gradient(rgba(21,128,61,0.4), rgba(0,0,0,0.8)), url("https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTmfmcQbkrZqkkSWfuTzzuFZNf65-nxTieNggbtUhV_vw&s=10") center/cover no-repeat !important; }
      .theme-platinum { background: #000000 !important; }
      .theme-animal { background: linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.8)), url("https://images.unsplash.com/photo-1474511320723-9a56873867b5?auto=format&fit=crop&w=600&q=80") center/cover no-repeat !important; }
      .theme-custom { background: linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.8)) center/cover no-repeat !important; }

      .admin-u-chip { width: 40px; height: 28px; background: linear-gradient(135deg, #e5e7eb, #94a3b8); border-radius: 6px; box-shadow: inset 0 0 5px rgba(0, 0, 0, 0.3); }
      .theme-standard .admin-u-chip, .theme-metal .admin-u-chip, .theme-eco .admin-u-chip { background: linear-gradient(135deg, #fde047, #d97706); }
      .admin-u-nfc { font-size: 1.2rem; color: rgba(255,255,255,0.8); transform: rotate(90deg); margin-left: 10px; }
      
      .admin-locked-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(3px) grayscale(80%); display: none; align-items: center; justify-content: center; z-index: 20; border-radius: 20px;}
      .admin-card-inner.locked .admin-locked-overlay { display: flex; }
      .admin-locked-text { font-size: 1.8rem; font-weight: 900; color: #fff; letter-spacing: 4px; border: 3px solid #fff; padding: 10px 20px; border-radius: 8px; transform: rotate(-15deg); }
      
      .admin-slider-dots { display: flex; justify-content: center; gap: 8px; margin-top: 5px; margin-bottom: 25px; }
      .admin-dot { width: 8px; height: 8px; background: #cbd5e1; border-radius: 50%; transition: 0.3s; }
      .admin-dot.active { background: #10b981; width: 22px; border-radius: 10px; }

      /* 🟢 3x3 Grid Actions */
      .admin-card-actions { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; max-width: 450px; margin: 0 auto; }
      .admin-action-btn { background: #ffffff; border: 1px solid #e2e8f0; padding: 12px; border-radius: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; cursor: pointer; transition: 0.2s; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
      .admin-action-btn:hover { border-color: #3b82f6; transform: translateY(-2px); box-shadow: 0 4px 10px rgba(59, 130, 246, 0.1); }
      .admin-action-btn i { font-size: 1.3rem; color: #475569; }
      .admin-action-btn span { font-size: 0.75rem; color: #1e293b; font-weight: 700; font-family: 'Kantumruy Pro', sans-serif; text-align: center; line-height: 1.3;}
      
      .admin-action-btn.danger { background: #fef2f2; border-color: #fca5a5; }
      .admin-action-btn.danger i, .admin-action-btn.danger span { color: #ef4444; }
      .admin-action-btn.danger:hover { border-color: #ef4444; background: #fee2e2; }

      /* 🟢 Information Box Styles */
      .admin-card-info-box { max-width: 450px; margin: 20px auto; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 15px; font-family: 'Kantumruy Pro', sans-serif; }
      .admin-info-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px dashed #cbd5e1; }
      .admin-info-row:last-child { border-bottom: none; }
      .admin-info-label { font-size: 0.8rem; color: #64748b; font-weight: 600; font-family: 'Kantumruy Pro', sans-serif; }
      .admin-info-value { font-size: 0.85rem; color: #0f172a; font-weight: 800; font-family: 'Kantumruy Pro', sans-serif; text-align: right; }

      @media (max-width: 600px) {
        .admin-cards-slider-wrapper { max-width: 100%; }
        .admin-card-actions { max-width: 100%; }
        .admin-card-info-box { max-width: 100%; }
      }
    </style>
  `;

  // ----------------------------------------------------
  // ២. ការបង្ហាញពេលគ្មានកាត (Empty State)
  // ----------------------------------------------------
  if (!user.virtualCards || user.virtualCards.length === 0) {
    container.innerHTML =
      stylesHtml +
      `
      <h2 style="margin: 0 0 20px 0; font-size: 1.3rem; color: var(--text-main); font-family: 'Kantumruy Pro'; font-weight: 800; border-bottom: 2px solid var(--border); padding-bottom: 15px;">
        <i class="fa-regular fa-credit-card" style="color: var(--secondary);"></i> គ្រប់គ្រងកាត (Virtual Cards Management)
      </h2>
      <div style="text-align:center; padding: 50px 20px; color: var(--text-muted); font-family: 'Kantumruy Pro'; border: 2px dashed #e2e8f0; border-radius: 20px;">
        <i class="fa-regular fa-credit-card" style="font-size: 4rem; opacity: 0.5; margin-bottom: 15px; display: block;"></i>
        <h3 style="margin: 0 0 10px 0; color: #0f172a;">អតិថិជនមិនទាន់មានកាតទេ</h3>
        <p style="margin: 0 0 20px 0; font-size: 0.9rem;">ចុចប៊ូតុងខាងក្រោមដើម្បីបង្កើតកាត Virtual ថ្មីឱ្យអតិថិជន។</p>
        <button class="btn-primary kh-text" style="background: #10b981; border: none; padding: 12px 25px; border-radius: 12px; font-weight: bold; font-size: 1rem; color: white; cursor: pointer; box-shadow: 0 4px 10px rgba(16, 185, 129, 0.3);" onclick="c360CreateCardModal()">
          <i class="fa-solid fa-plus"></i> បង្កើតកាតថ្មី (Create Card)
        </button>
      </div>`;
    return;
  }

  // ----------------------------------------------------
  // ៣. បង្កើតរចនាសម្ព័ន្ធកាត Slider 3D
  // ----------------------------------------------------
  let headerHtml = `
    <h2 style="margin: 0 0 20px 0; font-size: 1.3rem; color: var(--text-main); font-family: 'Kantumruy Pro'; font-weight: 800; border-bottom: 2px solid var(--border); padding-bottom: 15px;">
        <i class="fa-regular fa-credit-card" style="color: var(--secondary);"></i> គ្រប់គ្រងកាត (Virtual Cards Management)
    </h2>
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; max-width: 450px; margin: 0 auto 15px auto;">
        <h3 style="margin: 0; font-size: 1.1rem; color: #0f172a; font-family: 'Kantumruy Pro';">កាតរបស់អតិថិជន (${user.virtualCards.length})</h3>
        <button onclick="c360CreateCardModal()" style="background: #10b981; color: white; border: none; padding: 8px 15px; border-radius: 8px; font-size: 0.85rem; font-weight: bold; cursor: pointer; font-family: 'Kantumruy Pro';">
            <i class="fa-solid fa-plus"></i> បង្កើតថ្មី
        </button>
    </div>
  `;

  const getThemeClass = (type) => {
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
  };

  let cardsHtml = `<div class="admin-cards-slider-wrapper"><div class="admin-cards-slider" id="adminCardsSlider" onscroll="c360UpdateActiveCardDot()">`;

  user.virtualCards.forEach((c, index) => {
    let themeClass = getThemeClass(c.type);
    let isRealNFC = c.isPhysical || (c.uid && c.uid !== "");
    let nfcIconHtml = isRealNFC
      ? `<i class="fa-solid fa-wifi admin-u-nfc"></i>`
      : ``;
    let cardNameDisplay =
      c.name && c.name.trim() !== ""
        ? c.name
        : c.type
          ? c.type.replace("-", " ").toUpperCase()
          : "STANDARD";

    let customBgStyle = "";
    if (c.type === "custom" && c.customBgUrl) {
      customBgStyle = `style="background: linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.85)), url('${c.customBgUrl}') center/cover no-repeat !important;"`;
    }

    cardsHtml += `
      <div class="admin-card-perspective" data-id="${c.id}">
        <div class="admin-card-inner ${themeClass} ${c.isLocked ? "locked" : ""}" id="adminCardInner_${c.id}">
          
          <!-- 💳 FRONT CARD -->
          <div class="admin-card-front" ${customBgStyle} onclick="document.getElementById('adminCardInner_${c.id}').classList.toggle('flipped')">
            <div class="admin-locked-overlay"><div class="admin-locked-text">FROZEN</div></div>
            
            <div style="display: flex; justify-content: space-between; align-items: flex-start; z-index: 2;">
                <div style="display: flex; align-items: center;">
                    <div class="admin-u-chip"></div>
                    ${nfcIconHtml}
                </div>
                <img src="../images/logo-nobg.png" style="height: 30px; filter: brightness(0) invert(1); opacity: 0.9;" onerror="this.style.display='none'">
            </div>
            
            <div style="font-family: 'Courier New', monospace; font-size: 1.3rem; letter-spacing: 1.5px; font-weight: bold; text-shadow: 0 2px 4px rgba(0,0,0,0.4); z-index: 2; margin-top: auto; margin-bottom: auto;">
                **** **** **** ${c.number.slice(-4)}
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: flex-end; z-index: 2;">
                <div style="flex: 1.2;">
                    <div style="font-size: 0.6rem; opacity: 0.8; letter-spacing: 1px; margin-bottom: 2px;">CARD HOLDER</div>
                    <div style="font-size: 0.85rem; font-weight: 600; text-transform: uppercase;">${user.fullName || user.username}</div>
                </div>
                <div style="flex: 0.8; text-align: center;">
                    <div style="font-size: 0.6rem; opacity: 0.8; letter-spacing: 1px; margin-bottom: 2px;">EXPIRES</div>
                    <div style="font-size: 0.85rem; font-weight: 600;">${c.expiryDate || c.expiry || "12/28"}</div>
                </div>
                <div style="flex: 1.5; font-family: 'Inter', sans-serif; font-weight: 800; font-size: 0.85rem; text-transform: uppercase; text-align: right; text-shadow: 0 1px 2px rgba(0,0,0,0.5); opacity: 0.95;">
                    ${cardNameDisplay}
                </div>
            </div>
          </div>

          <!-- 💳 BACK CARD -->
          <div class="admin-card-back" ${customBgStyle} onclick="document.getElementById('adminCardInner_${c.id}').classList.toggle('flipped')">
            <div class="admin-locked-overlay"><div class="admin-locked-text">FROZEN</div></div>
            <div style="width: 100%; height: 40px; background: #111; margin-top: 20px;"></div>
            <div style="padding: 15px 20px 5px; display: flex; justify-content: space-between; align-items: flex-start;">
                <div style="font-size: 0.6rem; color: rgba(255, 255, 255, 0.95); max-width: 60%; line-height: 1.5;">
                    <span style="font-weight: 800;">AUTHORIZED SIGNATURE</span><br>
                    This card is issued by U-Pay PLC.
                </div>
                <div style="display: flex; flex-direction: column; align-items: center; z-index: 5;">
                    <span style="font-size: 0.65rem; color: #fff; font-weight: bold; margin-bottom: 3px;">CVV</span>
                    <div style="background: #fff; color: #000; padding: 4px 10px; border-radius: 4px; font-family: 'Courier New', monospace; font-weight: bold; font-size: 1rem; letter-spacing: 2px;">
                        ${c.cvv}
                    </div>
                </div>
            </div>
            <div style="padding: 0 20px 15px; margin-top: auto; text-align: right;">
                <img src="../images/logo-nobg.png" style="height: 25px; filter: brightness(0) invert(1);" onerror="this.style.display='none'">
            </div>
          </div>

        </div>
      </div>`;
  });

  cardsHtml += `</div><div class="admin-slider-dots" id="adminCardsDots"></div></div>`;

  // ----------------------------------------------------
  // ៤. ប៊ូតុង Actions (ទម្រង់ 3x3 Grid បង្ហាញទាំងអស់)
  // ----------------------------------------------------
  let actionsHtml = `
    <div class="admin-card-actions-container" style="max-width: 450px; margin: 0 auto;">
        <div class="admin-card-actions">
            
            <div class="admin-action-btn" onclick="c360JumpToCardTrx()">
                <i class="fa-solid fa-receipt" style="color: #3b82f6;"></i>
                <span>ប្រវត្តិ (Trx)</span>
            </div>
            
            <div class="admin-action-btn" onclick="c360RevealFullCardNumber()">
                <i class="fa-solid fa-eye" style="color: #0ea5e9;"></i>
                <span>មើលលេខពេញ</span>
            </div>
            
            <div class="admin-action-btn" onclick="c360ToggleOnlinePay()">
                <i class="fa-solid fa-globe" style="color: #10b981;" id="adminOnlinePayIcon"></i>
                <span id="adminOnlinePayText">អនឡាញ: ON</span>
            </div>
            
            <div class="admin-action-btn" onclick="c360ChangeCardLimit()">
                <i class="fa-solid fa-sliders" style="color: #f59e0b;"></i>
                <span>កែប្រែ Limit</span>
            </div>

            <div class="admin-action-btn" onclick="c360RenameCard()">
                <i class="fa-solid fa-pen" style="color: #8b5cf6;"></i>
                <span>ប្តូរឈ្មោះកាត</span>
            </div>
            
            <div class="admin-action-btn" onclick="c360ChangeLinkedAccount()">
                <i class="fa-solid fa-link" style="color: #eab308;"></i>
                <span>ប្តូរគណនីភ្ជាប់</span>
            </div>
            
            <div class="admin-action-btn" onclick="c360ToggleCardNFC()" id="adminNfcBtn">
                <i class="fa-solid fa-wifi" style="color: #6366f1;" id="adminNfcIcon"></i>
                <span id="adminNfcText">ភ្ជាប់ NFC</span>
            </div>
            
            <div class="admin-action-btn" onclick="c360ToggleCardLock()">
                <i class="fa-solid fa-lock" style="color: #64748b;" id="adminLockIcon"></i>
                <span id="adminLockText">ផ្អាកកាត</span>
            </div>
            
            <div class="admin-action-btn danger" onclick="c360DeleteCard()">
                <i class="fa-solid fa-trash"></i>
                <span>លុបកាតចោល</span>
            </div>

        </div>
    </div>
    
    <!-- 🟢 ផ្នែកបង្ហាញព័ត៌មានលម្អិតរបស់កាតខាងក្រោម (Info Box) -->
    <div class="admin-card-info-box" id="adminCardInfoBox">
        <!-- Details នឹង Update តាមកាតដែលកំពុងមើល -->
    </div>
  `;

  container.innerHTML = stylesHtml + headerHtml + cardsHtml + actionsHtml;

  // Render Dots
  const dotsContainer = document.getElementById("adminCardsDots");
  user.virtualCards.forEach((_, i) => {
    dotsContainer.innerHTML += `<div class="admin-dot ${i === 0 ? "active" : ""}"></div>`;
  });

  adminCurrentCardIndex = 0;
  c360UpdateCardInfoBox();
}

// =======================================================
// 🟢 អនុគមន៍ជំនួយ UI (Update UI ពេលអូសកាត)
// =======================================================
window.c360UpdateActiveCardDot = function () {
  const slider = document.getElementById("adminCardsSlider");
  if (!slider) return;
  let index = Math.round(slider.scrollLeft / slider.offsetWidth);
  if (
    index !== adminCurrentCardIndex &&
    index >= 0 &&
    index < currentC360User.virtualCards.length
  ) {
    adminCurrentCardIndex = index;
    document
      .querySelectorAll(".admin-dot")
      .forEach((d, i) => d.classList.toggle("active", i === index));
    c360UpdateCardInfoBox();
  }
};

window.c360UpdateCardInfoBox = function () {
  const c = currentC360User.virtualCards[adminCurrentCardIndex];
  if (!c) return;

  // 1. Update Lock Button Status
  const lockIcon = document.getElementById("adminLockIcon");
  const lockText = document.getElementById("adminLockText");
  if (c.isLocked) {
    lockIcon.className = "fa-solid fa-unlock";
    lockText.innerText = "បើកកាតវិញ";
  } else {
    lockIcon.className = "fa-solid fa-lock";
    lockText.innerText = "ផ្អាកកាត";
  }

  // 2. Update Online Pay Button Status
  const onlineIcon = document.getElementById("adminOnlinePayIcon");
  const onlineText = document.getElementById("adminOnlinePayText");
  if (c.isOnlinePayEnabled !== false) {
    onlineIcon.className = "fa-solid fa-globe";
    onlineIcon.style.color = "#10b981";
    onlineText.innerText = "អនឡាញ: ON";
  } else {
    onlineIcon.className = "fa-solid fa-globe";
    onlineIcon.style.color = "#94a3b8";
    onlineText.innerText = "អនឡាញ: OFF";
  }

  // 3. Update NFC Button Status (ការពារមិនឱ្យភ្ជាប់ទៀត បើភ្ជាប់រួច)
  const nfcBtn = document.getElementById("adminNfcBtn");
  const nfcIcon = document.getElementById("adminNfcIcon");
  const nfcText = document.getElementById("adminNfcText");
  if (c.uid && c.uid !== "") {
    nfcIcon.className = "fa-solid fa-wifi-slash";
    nfcIcon.style.color = "#ef4444";
    nfcText.innerText = "ផ្តាច់ NFC";
    nfcBtn.classList.add("danger");
  } else {
    nfcIcon.className = "fa-solid fa-wifi";
    nfcIcon.style.color = "#6366f1";
    nfcText.innerText = "ភ្ជាប់ NFC";
    nfcBtn.classList.remove("danger");
  }

  // 4. Update Detailed Info Box below buttons
  const infoBox = document.getElementById("adminCardInfoBox");
  let linkedName =
    c.linkedAccount === "KHR"
      ? "គណនីចម្បង KHR (៛)"
      : c.linkedAccount === "USD"
        ? "គណនីចម្បង USD ($)"
        : c.linkedAccount;

  let limitCurrencySymbol = c.linkedAccount === "KHR" ? "៛" : "$";
  let limitDisplay =
    c.linkedAccount === "KHR"
      ? (c.dailyLimit || 4000000).toLocaleString()
      : c.dailyLimit || 500;

  infoBox.innerHTML = `
        <div class="admin-info-row">
            <span class="admin-info-label">ប្រភេទកាត (Card Type)</span>
            <span class="admin-info-value" style="color: #3b82f6;">${c.type.toUpperCase()}</span>
        </div>
        <div class="admin-info-row">
            <span class="admin-info-label">គណនីភ្ជាប់ (Linked Account)</span>
            <span class="admin-info-value" style="color: #10b981;">${linkedName}</span>
        </div>
        <div class="admin-info-row">
            <span class="admin-info-label">ដែនកំណត់ចំណាយ (Daily Limit)</span>
            <span class="admin-info-value"><span style="font-family: 'Inter', sans-serif;">${limitCurrencySymbol}${limitDisplay}</span> / ថ្ងៃ</span>
        </div>
        <div class="admin-info-row">
            <span class="admin-info-label">ចំនួនប្រតិបត្តិការ (Tx Count Limit)</span>
            <span class="admin-info-value"><span style="font-family: 'Inter', sans-serif;">${c.dailyTxCountLimit || 10}</span> ដង / ថ្ងៃ</span>
        </div>
        <div class="admin-info-row">
            <span class="admin-info-label">ស្ថានភាពកាត (Status)</span>
            <span class="admin-info-value" style="color: ${c.isLocked ? "#ef4444" : "#10b981"};">${c.isLocked ? '<i class="fa-solid fa-lock"></i> បានផ្អាក (Frozen)' : '<i class="fa-solid fa-circle-check"></i> ដំណើរការ (Active)'}</span>
        </div>
    `;
};

// =======================================================
// 🟢 មុខងារបញ្ជាកាត (Card Operations API)
// =======================================================

// ១. មើលលេខកាតពេញ (Reveal Card Number)
window.c360RevealFullCardNumber = function () {
  const c = currentC360User.virtualCards[adminCurrentCardIndex];
  if (!c) return;

  Swal.fire({
    title: '<span class="kh-text">លេខកាតពេញ (Full Card Number)</span>',
    html: `<div style="font-family: 'Courier New', monospace; font-size: 1.5rem; font-weight: bold; letter-spacing: 2px; padding: 20px; background: #f8fafc; border-radius: 12px; margin-top: 15px; cursor: pointer;" onclick="navigator.clipboard.writeText('${c.number}'); Swal.fire({toast:true, position:'top-end', icon:'success', title:'Copied!', showConfirmButton:false, timer:1000});" title="ចុចដើម្បី Copy">${c.number.match(/.{1,4}/g).join(" ")}</div><p class="kh-text" style="font-size: 0.8rem; color: #64748b; margin-top: 10px;">ចុចលើលេខដើម្បីចម្លង (Copy)</p>`,
    confirmButtonText: "បិទ",
    confirmButtonColor: "#3b82f6",
    customClass: { popup: "premium-swal" },
  });

  fetch("/api/admin/log-action", {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({
      action: "Viewed Card Details",
      target: currentC360User.username,
      details: `មើលលេខកាតពេញ: **** ${c.number.slice(-4)}`,
    }),
  });
};

// ២. លោតទៅមើលប្រវត្តិ (Jump to Card Trx)
window.c360JumpToCardTrx = function () {
  const c = currentC360User.virtualCards[adminCurrentCardIndex];
  if (!c) return;
  switchC360Tab("trx");
  setTimeout(() => {
    const accSelect = document.getElementById("c360-trx-acc-filter");
    if (accSelect) accSelect.value = "ALL";
    c360FilterTrxList(true);
    const globalSearch = document.getElementById("searchC360");
    if (globalSearch) {
      globalSearch.value = c.number;
      Swal.fire({
        toast: true,
        position: "top",
        icon: "info",
        title: `បង្ហាញប្រវត្តិសម្រាប់កាតចុងក្រោយ: ${c.number.slice(-4)}`,
        showConfirmButton: false,
        timer: 2000,
        customClass: { popup: "kh-text" },
      });
    }
  }, 100);
};

// ៣. បិទ/បើក ការទិញអនឡាញ (Toggle Online Pay)
window.c360ToggleOnlinePay = async function () {
  const c = currentC360User.virtualCards[adminCurrentCardIndex];
  if (!c) return;

  const isEnabled = c.isOnlinePayEnabled !== false;
  const actionText = isEnabled ? "បិទមិនឱ្យចាយអនឡាញ" : "បើកឱ្យចាយអនឡាញវិញ";
  const color = isEnabled ? "#ef4444" : "#10b981";

  const result = await Swal.fire({
    title: `<span class="kh-text" style="font-size: 1.2rem; color: ${color};">${actionText}?</span>`,
    text: `តើអ្នកពិតជាចង់ ${actionText} មែនទេ?`,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: '<span class="kh-text">យល់ព្រម</span>',
    cancelButtonText: '<span class="kh-text">បោះបង់</span>',
    confirmButtonColor: color,
    customClass: { popup: "modal-radius kh-text" },
  });

  if (result.isConfirmed) {
    Swal.fire({
      title: "កំពុងដំណើរការ...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });
    try {
      const res = await fetch("/api/admin/toggle-card-online", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          username: currentC360User.username,
          cardId: c.id,
          isEnabled: !isEnabled,
        }),
      });
      const data = await res.json();
      if (data.success) {
        c360RefreshData();
        Swal.fire({
          icon: "success",
          title: "ជោគជ័យ!",
          text: `ការទូទាត់អនឡាញត្រូវបានផ្លាស់ប្តូរ`,
          timer: 1500,
          showConfirmButton: false,
          customClass: { popup: "premium-swal kh-text" },
        });
      } else throw new Error(data.message);
    } catch (e) {
      Swal.fire("បរាជ័យ", e.message || "មានបញ្ហា Server", "error");
    }
  }
};

// ៤. កំណត់ Limit កាត (Change Limits)
window.c360ChangeCardLimit = async function () {
  const c = currentC360User.virtualCards[adminCurrentCardIndex];
  if (!c) return;
  const isKHR = c.linkedAccount === "KHR";

  const { value: formValues } = await Swal.fire({
    title:
      '<span class="kh-text" style="font-size: 1.2rem;">កំណត់ Limit កាត</span>',
    html: `
        <div style="text-align: left; margin-top: 10px;">
            <label class="kh-text" style="font-size: 0.8rem; font-weight: bold; color: var(--text-muted);">ទំហំទឹកប្រាក់ចាយប្រចាំថ្ងៃ (${isKHR ? "៛" : "$"})</label>
            <input id="swal-card-limit-amt" class="swal2-input" type="number" value="${c.dailyLimit || (isKHR ? 4000000 : 500)}" style="margin: 5px 0 15px; width: 100%; box-sizing: border-box; font-family: 'Kantumruy Pro';">
            <label class="kh-text" style="font-size: 0.8rem; font-weight: bold; color: var(--text-muted);">ចំនួនដងប្រតិបត្តិការប្រចាំថ្ងៃ (Trx Count)</label>
            <input id="swal-card-limit-count" class="swal2-input" type="number" value="${c.dailyTxCountLimit || 10}" style="margin: 5px 0 0; width: 100%; box-sizing: border-box; font-family: 'Kantumruy Pro';">
        </div>
    `,
    showCancelButton: true,
    confirmButtonColor: "#f59e0b",
    confirmButtonText:
      '<span class="kh-text"><i class="fa-solid fa-check"></i> រក្សាទុក</span>',
    cancelButtonText: '<span class="kh-text">បោះបង់</span>',
    customClass: { popup: "modal-radius" },
    preConfirm: () => {
      return {
        newLimit: document.getElementById("swal-card-limit-amt").value,
        newCountLimit: document.getElementById("swal-card-limit-count").value,
      };
    },
  });

  if (formValues) {
    Swal.fire({
      title: "កំពុងរក្សាទុក...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });
    try {
      const res = await fetch("/api/admin/update-card-limit", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          username: currentC360User.username,
          cardId: c.id,
          newLimit: parseFloat(formValues.newLimit),
          newCountLimit: parseInt(formValues.newCountLimit),
        }),
      });
      const data = await res.json();
      if (data.success) {
        c360RefreshData();
        Swal.fire({
          icon: "success",
          title: "បានកំណត់ Limit ថ្មី!",
          timer: 1500,
          showConfirmButton: false,
          customClass: { popup: "premium-swal kh-text" },
        });
      } else throw new Error(data.message);
    } catch (e) {
      Swal.fire("បរាជ័យ", e.message || "មានបញ្ហា Server", "error");
    }
  }
};

// ៥. ប្តូរឈ្មោះកាត (Rename Card)
window.c360RenameCard = async function () {
  const c = currentC360User.virtualCards[adminCurrentCardIndex];
  if (!c) return;

  const { value: newName } = await Swal.fire({
    title:
      '<span class="kh-text" style="font-size: 1.2rem;">ប្តូរឈ្មោះកាត</span>',
    input: "text",
    inputValue: c.name || "",
    inputPlaceholder: "បញ្ចូលឈ្មោះកាតថ្មី...",
    showCancelButton: true,
    confirmButtonColor: "#8b5cf6",
    confirmButtonText:
      '<span class="kh-text"><i class="fa-solid fa-check"></i> រក្សាទុក</span>',
    cancelButtonText: '<span class="kh-text">បោះបង់</span>',
    customClass: { popup: "modal-radius kh-text" },
    inputAttributes: { maxlength: 20, style: "font-family: 'Kantumruy Pro';" },
    inputValidator: (value) => {
      if (!value) return "សូមបញ្ចូលឈ្មោះកាត!";
    },
  });

  if (newName && newName !== c.name) {
    Swal.fire({
      title: "កំពុងរក្សាទុក...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });
    try {
      const res = await fetch("/api/admin/rename-card", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          username: currentC360User.username,
          cardId: c.id,
          name: newName,
        }),
      });
      const data = await res.json();
      if (data.success) {
        c360RefreshData();
        Swal.fire({
          icon: "success",
          title: "បានប្តូរឈ្មោះជោគជ័យ!",
          timer: 1500,
          showConfirmButton: false,
          customClass: { popup: "premium-swal kh-text" },
        });
      } else throw new Error(data.message);
    } catch (e) {
      Swal.fire("បរាជ័យ", e.message || "មានបញ្ហា Server", "error");
    }
  }
};

// ៦. ប្តូរគណនីភ្ជាប់ (Change Linked Account)
window.c360ChangeLinkedAccount = async function () {
  const c = currentC360User.virtualCards[adminCurrentCardIndex];
  if (!c) return;

  let accOptions = "";
  if (currentC360User.mainAccounts?.USD) {
    const accNum = currentC360User.mainAccounts.USD.accountNumber;
    let isSelected =
      c.linkedAccount === accNum || c.linkedAccount === "USD" ? "selected" : "";
    accOptions += `<option value="${accNum}" ${isSelected}>គណនីចម្បង USD ($) - ${accNum}</option>`;
  }
  if (currentC360User.mainAccounts?.KHR) {
    const accNum = currentC360User.mainAccounts.KHR.accountNumber;
    let isSelected =
      c.linkedAccount === accNum || c.linkedAccount === "KHR" ? "selected" : "";
    accOptions += `<option value="${accNum}" ${isSelected}>គណនីចម្បង KHR (៛) - ${accNum}</option>`;
  }
  if (currentC360User.subAccounts && currentC360User.subAccounts.length > 0) {
    currentC360User.subAccounts.forEach((sub) => {
      if (!sub.isHidden && sub.accountType !== "junior") {
        let typeLabel =
          sub.accountType === "joint" || sub.accountType === "joint_member"
            ? "[Joint]"
            : "[Sub]";
        let isSelected =
          c.linkedAccount === sub.accountNumber ||
          c.linkedAccount === `${sub.currency}_${sub.accountNumber}`
            ? "selected"
            : "";
        accOptions += `<option value="${sub.accountNumber}" ${isSelected}>${typeLabel} ${sub.accountName} (${sub.accountNumber})</option>`;
      }
    });
  }

  const { value: newLinkedAcc } = await Swal.fire({
    title:
      '<span class="kh-text" style="font-size:1.2rem;">ប្តូរគណនីភ្ជាប់ (Linked Account)</span>',
    html: `
            <div style="text-align: left; margin-top: 15px;" class="kh-text">
                <label style="font-size: 0.85rem; font-weight: bold; color: var(--text-muted);">ជ្រើសរើសគណនីកាត់លុយថ្មី៖</label>
                <select id="swal-edit-linked-acc" class="swal2-input kh-text" style="width:100%; margin: 5px 0 0; font-size: 0.9rem; padding: 10px; box-sizing: border-box;">
                    ${accOptions}
                </select>
            </div>
        `,
    showCancelButton: true,
    confirmButtonColor: "var(--primary)",
    confirmButtonText: '<span class="kh-text">រក្សាទុក</span>',
    cancelButtonText: '<span class="kh-text">បោះបង់</span>',
    customClass: { popup: "modal-radius kh-text" },
    preConfirm: () => document.getElementById("swal-edit-linked-acc").value,
  });

  if (newLinkedAcc) {
    Swal.fire({
      title: "កំពុងរក្សាទុក...",
      didOpen: () => Swal.showLoading(),
      allowOutsideClick: false,
    });
    try {
      const res = await fetch("/api/admin/change-card-account", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          username: currentC360User.username,
          cardId: c.id || c._id,
          linkedAccount: newLinkedAcc,
        }),
      });
      const data = await res.json();
      if (data.success) {
        await c360RefreshData(); // Refresh ទិន្នន័យថ្មីមកបង្ហាញភ្លាមៗ
        Swal.fire({
          icon: "success",
          title: "ជោគជ័យ!",
          text: data.message || "ប្តូរគណនីភ្ជាប់ជោគជ័យ!",
          timer: 1500,
          showConfirmButton: false,
          customClass: { popup: "premium-swal kh-text" },
        });
      } else throw new Error(data.message);
    } catch (e) {
      Swal.fire("បរាជ័យ", e.message || "មានបញ្ហា Server", "error");
    }
  }
};

// ៧. ផ្អាកកាត (Freeze Card)
window.c360ToggleCardLock = async function () {
  const c = currentC360User.virtualCards[adminCurrentCardIndex];
  if (!c) return;

  const actionText = c.isLocked
    ? "បើកឱ្យដំណើរការវិញ (Unlock)"
    : "ផ្អាកបណ្តោះអាសន្ន (Freeze)";
  const color = c.isLocked ? "#10b981" : "#ef4444";

  const result = await Swal.fire({
    title: `<span class="kh-text" style="font-size: 1.2rem; color: ${color};">${actionText} កាតនេះ?</span>`,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: '<span class="kh-text">យល់ព្រម</span>',
    cancelButtonText: '<span class="kh-text">បោះបង់</span>',
    confirmButtonColor: color,
    customClass: { popup: "modal-radius kh-text" },
  });

  if (result.isConfirmed) {
    Swal.fire({
      title: "កំពុងដំណើរការ...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });
    try {
      const res = await fetch("/api/admin/toggle-card-lock", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          username: currentC360User.username,
          cardId: c.id,
          isLocked: !c.isLocked,
        }),
      });
      const data = await res.json();
      if (data.success) {
        c360RefreshData();
        Swal.fire({
          icon: "success",
          title: "ជោគជ័យ!",
          timer: 1500,
          showConfirmButton: false,
          customClass: { popup: "premium-swal kh-text" },
        });
      } else throw new Error(data.message);
    } catch (e) {
      Swal.fire("បរាជ័យ", e.message || "មានបញ្ហា Server", "error");
    }
  }
};

// ៨. លុបកាតចោល (Delete Card)
window.c360DeleteCard = async function () {
  const c = currentC360User.virtualCards[adminCurrentCardIndex];
  if (!c) return;

  const result = await Swal.fire({
    title:
      '<span class="kh-text" style="font-size: 1.2rem; color: #ef4444;">បញ្ជាក់ការលុបកាតចោល</span>',
    html: '<p class="kh-text" style="font-size: 0.95rem; margin-top: 10px;">តើអ្នកពិតជាចង់លុបកាតនេះចោលមែនទេ? សកម្មភាពនេះមិនអាចទាញត្រឡប់វិញបានទេ។</p><input id="swal-del-reason" class="swal2-input kh-text" placeholder="មូលហេតុ (មិនដាក់ក៏បាន)..." style="font-size: 0.85rem; font-family: \'Kantumruy Pro\';">',
    icon: "warning",
    showCancelButton: true,
    confirmButtonText:
      '<span class="kh-text"><i class="fa-solid fa-trash"></i> យល់ព្រមលុប</span>',
    cancelButtonText: '<span class="kh-text">បោះបង់</span>',
    confirmButtonColor: "#ef4444",
    customClass: { popup: "modal-radius kh-text" },
    preConfirm: () => document.getElementById("swal-del-reason").value.trim(),
  });

  if (result.isConfirmed) {
    Swal.fire({
      title: "កំពុងលុប...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });
    try {
      const res = await fetch("/api/admin/delete-card", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          username: currentC360User.username,
          cardId: c.id,
          reason: result.value || "Admin លុប",
        }),
      });
      const data = await res.json();
      if (data.success) {
        adminCurrentCardIndex = 0;
        c360RefreshData();
        Swal.fire({
          icon: "success",
          title: "បានលុបជោគជ័យ!",
          timer: 1500,
          showConfirmButton: false,
          customClass: { popup: "premium-swal kh-text" },
        });
      } else throw new Error(data.message);
    } catch (e) {
      Swal.fire("បរាជ័យ", e.message || "មានបញ្ហា Server", "error");
    }
  }
};

// ៩. បង្កើតកាតថ្មី (Create New Card Modal)
window.c360CreateCardModal = async function () {
  const cardTiers = [
    {
      id: "standard",
      name: "Standard",
      price: 5.0,
      styleClass: "theme-standard",
    },
    {
      id: "fifa",
      name: "FIFA World Cup",
      price: 15.0,
      styleClass: "theme-fifa",
    },
    { id: "metal", name: "Metal Gold", price: 5.0, styleClass: "theme-metal" },
    {
      id: "celebrity",
      name: "BTS Edition",
      price: 15.0,
      styleClass: "theme-celebrity",
    },
    {
      id: "anime",
      name: "Naruto Edition",
      price: 15.0,
      styleClass: "theme-anime",
    },
    { id: "gamer", name: "Gamer Pro", price: 15.0, styleClass: "theme-gamer" },
    { id: "eco", name: "Eco Green", price: 5.0, styleClass: "theme-eco" },
    {
      id: "platinum",
      name: "Platinum Premium",
      price: 25.0,
      styleClass: "theme-platinum",
    },
    {
      id: "animal",
      name: "Animal Edition",
      price: 15.0,
      styleClass: "theme-animal",
    },
    {
      id: "custom",
      name: "Custom VIP",
      price: 25.0,
      styleClass: "theme-custom",
    },
  ];

  let accOptions = "";
  if (currentC360User.mainAccounts?.USD)
    accOptions += `<option value="USD">គណនីចម្បង USD ($)</option>`;
  if (currentC360User.mainAccounts?.KHR)
    accOptions += `<option value="KHR">គណនីចម្បង KHR (៛)</option>`;
  if (currentC360User.subAccounts) {
    currentC360User.subAccounts.forEach((sub) => {
      if (!sub.isHidden)
        accOptions += `<option value="${sub.accountNumber}">${sub.accountName} (${sub.accountNumber})</option>`;
    });
  }

  let gridHtml = cardTiers
    .map(
      (t, index) => `
    <label style="cursor:pointer;">
      <input type="radio" name="swal-card-type" value="${t.id}" data-price="${t.price}" ${index === 0 ? "checked" : ""} style="display:none;" 
        onchange="document.querySelectorAll('.admin-tier-option').forEach(el=>el.classList.remove('selected')); this.nextElementSibling.classList.add('selected'); document.getElementById('adminCustomBgBox').style.display = (this.value==='custom') ? 'block' : 'none'; document.getElementById('swal-price-display').innerText = '$' + this.getAttribute('data-price');">
      <div class="admin-tier-option ${index === 0 ? "selected" : ""}" style="border: 2px solid var(--border); border-radius: 12px; padding: 10px; text-align: center; transition: 0.2s; background: var(--bg-body);">
          <div class="${t.styleClass}" style="width: 100%; height: 40px; border-radius: 6px; margin-bottom: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);"></div>
          <div style="font-size: 0.75rem; font-weight: 700; font-family: 'Inter';">${t.name}</div>
          <div style="font-size: 0.7rem; color: #ef4444; font-weight: bold;">$${t.price.toFixed(2)}</div>
      </div>
    </label>
  `,
    )
    .join("");

  const { value: formResult } = await Swal.fire({
    title:
      '<span class="kh-text" style="font-size:1.3rem;">បង្កើតកាតថ្មីឱ្យអតិថិជន</span>',
    html: `
      <style>.admin-tier-option.selected { border-color: var(--secondary) !important; background: rgba(16, 185, 129, 0.05) !important; }</style>
      <div style="text-align: left; margin-top: 15px;">
          <label class="kh-text" style="font-size: 0.8rem; font-weight: bold; color: var(--text-muted);">១. ជ្រើសរើសគណនីកាត់លុយ/ភ្ជាប់ (Linked Account)</label>
          <select id="swal-linked-acc" class="swal2-input kh-text" style="width:100%; margin: 5px 0 15px; font-size: 0.9rem;">
              ${accOptions}
          </select>

          <label class="kh-text" style="font-size: 0.8rem; font-weight: bold; color: var(--text-muted); display: block; margin-bottom: 8px;">២. ជ្រើសរើសប្រភេទកាត (Card Design)</label>
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; max-height: 250px; overflow-y: auto; padding-right: 5px; margin-bottom: 15px;">
              ${gridHtml}
          </div>
          
          <div id="adminCustomBgBox" style="display: none; margin-bottom: 15px;">
              <input id="swal-custom-url" type="text" class="swal2-input kh-text" placeholder="បញ្ចូល URL រូបភាព..." style="width: 100%; margin: 0; font-size: 0.85rem;">
          </div>

          <div style="background: rgba(239,68,68,0.1); border-radius: 10px; padding: 10px; text-align: center; margin-bottom: 15px;">
              <span class="kh-text" style="color: #ef4444; font-size: 0.85rem; font-weight: bold;">ថ្លៃសេវាចេញកាត៖ </span>
              <span id="swal-price-display" style="color: #ef4444; font-size: 1rem; font-weight: 900;">$5.00</span>
          </div>

          <input id="swal-card-remark" class="swal2-input kh-text" placeholder="ចំណាំ (ឧ. អតិថិជនស្នើសុំតាមទូរស័ព្ទ)" style="width: 100%; margin: 0; font-size: 0.85rem; font-family: 'Kantumruy Pro';">
      </div>`,
    showCancelButton: true,
    confirmButtonText: '<span class="kh-text">បង្កើតកាត</span>',
    cancelButtonText: '<span class="kh-text">បោះបង់</span>',
    confirmButtonColor: "#10b981",
    customClass: { popup: "modal-radius" },
    preConfirm: () => {
      const radio = document.querySelector(
        'input[name="swal-card-type"]:checked',
      );
      const cardType = radio.value;
      const customBgUrl = document
        .getElementById("swal-custom-url")
        .value.trim();
      if (cardType === "custom" && !customBgUrl) {
        Swal.showValidationMessage("សូមបញ្ចូល Link រូបភាព!");
        return false;
      }
      return {
        linkedAccount: document.getElementById("swal-linked-acc").value,
        cardType: cardType,
        customBgUrl: customBgUrl,
        remark: document.getElementById("swal-card-remark").value.trim(),
      };
    },
  });

  if (formResult) {
    Swal.fire({
      title: "កំពុងដំណើរការ...",
      didOpen: () => Swal.showLoading(),
      allowOutsideClick: false,
      customClass: { popup: "premium-swal" },
    });
    try {
      const res = await fetch("/api/admin/create-card", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          username: currentC360User.username,
          ...formResult,
        }),
      });
      const data = await res.json();
      if (data.success) {
        c360RefreshData();
        Swal.fire({
          icon: "success",
          title: "ជោគជ័យ!",
          text: "កាតត្រូវបានបង្កើតរួចរាល់។",
          timer: 2000,
          showConfirmButton: false,
          customClass: { popup: "premium-swal kh-text" },
        });
      } else {
        Swal.fire("បរាជ័យ", data.message, "error");
      }
    } catch (e) {
      Swal.fire("Error", "មានបញ្ហា Server", "error");
    }
  }
};

// ១០. បិទ/បើក NFC (Bind / Unbind NFC)
window.c360ToggleCardNFC = async function () {
  const c = currentC360User.virtualCards[adminCurrentCardIndex];
  if (!c) return;

  if (c.uid && c.uid !== "") {
    const result = await Swal.fire({
      title:
        '<span class="kh-text" style="color:#ef4444;">ផ្តាច់កាត NFC?</span>',
      text: "កាត Physical នេះនឹងត្រូវបានផ្តាច់ចេញពីគណនី។",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: '<span class="kh-text">បាទ, ផ្តាច់ចោល</span>',
      cancelButtonText: '<span class="kh-text">បោះបង់</span>',
      confirmButtonColor: "#ef4444",
      customClass: { popup: "modal-radius kh-text" },
    });

    if (result.isConfirmed) {
      Swal.fire({ title: "កំពុងផ្តាច់...", didOpen: () => Swal.showLoading() });
      try {
        const res = await fetch("/api/admin/cards/unbind-nfc", {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            username: currentC360User.username,
            cardId: c.id,
          }),
        });
        const data = await res.json();
        if (data.success) {
          c360RefreshData();
          Swal.fire({
            icon: "success",
            title: "បានផ្តាច់កាត NFC ចេញវិញហើយ!",
            timer: 1500,
            showConfirmButton: false,
            customClass: { popup: "premium-swal kh-text" },
          });
        } else {
          Swal.fire("បរាជ័យ", data.message, "error");
        }
      } catch (e) {
        Swal.fire("បរាជ័យ", "មានបញ្ហា Server", "error");
      }
    }
    return;
  }

  let isScanning = true;
  let scanBuffer = "";

  Swal.fire({
    title: '<span class="kh-text">📡 កំពុងរង់ចាំស្កេនកាត NFC...</span>',
    html: `
        <div style="margin: 20px 0;"><i class="fa-solid fa-wifi fa-beat" style="font-size: 4.5rem; color: #6366f1;"></i></div>
        <p style="color: #64748b; font-family: 'Kantumruy Pro';">សូមយកកាតមកផ្អឹបនឹងផ្នែកខាងក្រោយទូរស័ព្ទ ឬម៉ាស៊ីន POS / USB Scanner</p>
        <input type="text" id="hiddenUsbScannerInput" style="opacity: 0; position: absolute; z-index: -1; top: 0; left: 0;" autocomplete="off">
    `,
    showConfirmButton: false,
    showCancelButton: true,
    cancelButtonText: '<span class="kh-text">បោះបង់ (Cancel)</span>',
    cancelButtonColor: "#ef4444",
    allowOutsideClick: false,
    customClass: { popup: "premium-swal" },
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
              processAdminNFCBind(c.id, scanBuffer);
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
        let serialNumber = event.serialNumber;
        if (serialNumber)
          serialNumber = serialNumber.replaceAll(":", "").toUpperCase();
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        processAdminNFCBind(c.id, serialNumber);
      };
    } catch (error) {}
  }
};

async function processAdminNFCBind(cardId, rawUid) {
  let uid = String(rawUid).trim().toUpperCase();
  if (/^\d{10}$/.test(uid)) {
    let hex = parseInt(uid, 10).toString(16).toUpperCase();
    hex = hex.padStart(8, "0");
    uid =
      hex.substring(6, 8) +
      hex.substring(4, 6) +
      hex.substring(2, 4) +
      hex.substring(0, 2);
  }

  Swal.fire({ title: "កំពុងភ្ជាប់...", didOpen: () => Swal.showLoading() });
  try {
    const res = await fetch("/api/admin/cards/bind-nfc", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        username: currentC360User.username,
        cardId,
        uid,
        pin: "0000",
      }),
    });
    const data = await res.json();
    if (data.success) {
      c360RefreshData();
      Swal.fire({
        icon: "success",
        title: "ភ្ជាប់ជោគជ័យ!",
        timer: 1500,
        showConfirmButton: false,
        customClass: { popup: "premium-swal kh-text" },
      });
    } else {
      Swal.fire("បរាជ័យ", data.message, "error");
    }
  } catch (e) {
    Swal.fire("បរាជ័យ", "បញ្ហាបច្ចេកទេសជាមួយ Server", "error");
  }
}

// =======================================================
// 💸 TAB 4: Transactions (ADVANCED BANKING STANDARD)
// =======================================================

// 🛠️ អនុគមន៍ជំនួយកាលបរិច្ឆេទ
function c360ParseDateString(dateStr) {
  if (!dateStr) return new Date();
  let d = new Date(dateStr);
  if (isNaN(d.getTime()) && dateStr.includes(","))
    d = new Date(dateStr.split(",")[0].trim());
  return isNaN(d.getTime()) ? new Date() : d;
}

function c360GetSmartDateLabel(d) {
  let t = new Date();
  t.setHours(0, 0, 0, 0);
  let y = new Date();
  y.setDate(t.getDate() - 1);
  y.setHours(0, 0, 0, 0);
  let c = new Date(d);
  c.setHours(0, 0, 0, 0);

  if (c.getTime() === t.getTime()) return "ថ្ងៃនេះ (Today)";
  if (c.getTime() === y.getTime()) return "ម្សិលមិញ (Yesterday)";
  return c.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function c360GetTimeString(d, orig) {
  return !isNaN(d.getTime())
    ? d.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
    : orig.includes(",")
      ? orig.split(",")[1].trim()
      : "";
}

// 🟢 អថេរសម្រាប់គ្រប់គ្រង Pagination និង Filter
let c360CurrentTrxPage = 1;
const c360TrxPerPage = 6;
let c360FilteredTrx = [];
let c360CurrentFilterTab = "all";

function renderTrxTab(user) {
  const container = document.getElementById("c360-tab-trx");
  if (!container) return;

  // 🟢 ទុកថ្ងៃទីឱ្យទទេរ (Empty) ដើម្បិបង្ហាញទាំងអស់រហូតទាល់តែមានការជ្រើសរើស
  const startStr = "";
  const endStr = "";

  // ទាញយកលេខគណនីទាំងអស់របស់អតិថិជន
  const accUSD = user.mainAccounts?.USD?.accountNumber;
  const accKHR = user.mainAccounts?.KHR?.accountNumber;

  let accOptions = `<option value="ALL">គ្រប់គណនីទាំងអស់ (All Accounts)</option>`;
  if (accUSD)
    accOptions += `<option value="USD">គណនីចម្បង USD: ${accUSD}</option>`;
  if (accKHR)
    accOptions += `<option value="KHR">គណនីចម្បង KHR: ${accKHR}</option>`;

  if (user.subAccounts && user.subAccounts.length > 0) {
    user.subAccounts.forEach((sub) => {
      accOptions += `<option value="${sub.accountNumber}">${sub.accountName} (${sub.currency}): ${sub.accountNumber}</option>`;
    });
  }

  // 🟢 បន្ថែម Media Queries សម្រាប់ Responsive Design ឱ្យរួញស្អាតលើទូរស័ព្ទ
  let html = `
    <style>
      .c360-trx-dash-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 20px; margin-bottom: 20px; }
      
      /* 🟢 របាយការណ៍សង្ខេប (Mini Dashboard) */
      .c360-mini-dash { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; }
      .c360-dash-box { background: #f8fafc; padding: 15px; border-radius: 12px; border: 1px solid #e2e8f0; display: flex; align-items: center; gap: 15px; }
      .c360-dash-box.income .icon { background: #ecfdf5; color: #10b981; }
      .c360-dash-box.expense .icon { background: #fef2f2; color: #ef4444; }
      .c360-dash-box .icon { width: 45px; height: 45px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; flex-shrink: 0; }
      .c360-dash-box .label { font-size: 0.75rem; color: #64748b; font-weight: 700; font-family: 'Kantumruy Pro', sans-serif; margin-bottom: 3px; }
      .c360-dash-box .value { font-size: 1.2rem; font-weight: 800; font-family: 'JetBrains Mono', monospace; word-break: break-all; line-height: 1.2; }

      /* 🟢 Tabs & Filters */
      .c360-filter-tab { flex: 1; padding: 10px; border: none; background: transparent; color: var(--text-muted); font-weight: bold; border-radius: 10px; cursor: pointer; transition: 0.2s; font-family: 'Kantumruy Pro', sans-serif; text-align: center; }
      .c360-filter-tab.active { background: var(--primary); color: white; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
      
      /* 🟢 Transaction Items */
      .c360-trx-date-header { position: sticky; top: 0; background: rgba(248, 250, 252, 0.95); backdrop-filter: blur(5px); padding: 8px 10px; font-size: 0.8rem; font-weight: 700; color: #475569; z-index: 10; margin: 15px 0 10px 0; border-radius: 8px; font-family: 'Kantumruy Pro', sans-serif; }
      .c360-trx-item { display: flex; align-items: center; justify-content: space-between; padding: 16px; background: var(--bg-body); border-radius: 16px; margin-bottom: 12px; cursor: pointer; border: 1px solid var(--border); transition: 0.2s; }
      .c360-trx-item:hover { border-color: var(--secondary); transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
      
      .c360-page-btn { padding: 8px 15px; background: var(--bg-body); border: 1px solid var(--border); border-radius: 8px; color: var(--text-main); font-weight: bold; cursor: pointer; transition: 0.2s; font-family: 'Kantumruy Pro', sans-serif; }
      .c360-page-btn:hover:not(:disabled) { background: var(--secondary); color: white; border-color: var(--secondary); }
      .c360-page-btn:disabled { opacity: 0.5; cursor: not-allowed; }

      /* 🔥 Responsive Design (Mobile View) */
      @media (max-width: 600px) {
        .c360-mini-dash { grid-template-columns: 1fr; gap: 10px; }
        .c360-trx-item { flex-direction: column; align-items: flex-start; gap: 10px; }
        .c360-trx-item > div:last-child { width: 100%; display: flex; justify-content: space-between; align-items: center; text-align: left !important; border-top: 1px dashed var(--border); padding-top: 10px; }
        .c360-filter-tab { font-size: 0.8rem; padding: 8px 5px; }
      }
    </style>

    <!-- 🟢 ចំណងជើង Tab (Tab Title) -->
    <h2 style="margin: 0 0 20px 0; font-size: 1.3rem; color: var(--text-main); font-family: 'Kantumruy Pro'; font-weight: 800; border-bottom: 2px solid var(--border); padding-bottom: 15px;">
        <i class="fa-solid fa-receipt" style="color: var(--secondary);"></i> ប្រតិបត្តិការអតិថិជន (Transactions)
    </h2>

    <div class="c360-trx-dash-card">
        <!-- Filters -->
        <div style="display:flex; gap:15px; flex-wrap:wrap; margin-bottom:15px;">
            <div style="flex:1; min-width:100%;">
                <label class="kh-text" style="font-size:0.8rem; color:var(--text-muted); font-weight:bold;">ជ្រើសរើសគណនី (Account)</label>
                <select id="c360-trx-acc-filter" class="form-input kh-text" style="margin-top:5px; font-weight: bold;" onchange="c360FilterTrxList(true)">
                    ${accOptions}
                </select>
            </div>
            <div style="flex:1; min-width:100%;">
                <label class="kh-text" style="font-size:0.8rem; color:var(--text-muted); font-weight:bold;">កាលបរិច្ឆេទ (Date Range)</label>
                <div style="display:flex; gap:10px; margin-top:5px; align-items:center;">
                    <input type="date" id="c360-date-start" class="form-input" value="${startStr}" onchange="c360FilterTrxList(true)">
                    <span style="color:var(--text-muted); font-weight:bold;">-</span>
                    <input type="date" id="c360-date-end" class="form-input" value="${endStr}" onchange="c360FilterTrxList(true)">
                </div>
            </div>
        </div>

        <!-- 🌟 Mini Dashboard Summary -->
        <div class="c360-mini-dash">
            <div class="c360-dash-box income">
                <div class="icon"><i class="fa-solid fa-arrow-down"></i></div>
                <div>
                    <div class="label">ចំណូលសរុប (INCOME)</div>
                    <div class="value" id="c360-total-in" style="color: #10b981;">$0.00</div>
                </div>
            </div>
            <div class="c360-dash-box expense">
                <div class="icon"><i class="fa-solid fa-arrow-up"></i></div>
                <div>
                    <div class="label">ចំណាយសរុប (EXPENSE)</div>
                    <div class="value" id="c360-total-out" style="color: #ef4444;">$0.00</div>
                </div>
            </div>
        </div>

        <!-- Tabs & Export -->
        <div style="display:flex; gap:5px; background:var(--bg-body); padding:5px; border-radius:12px; border:1px solid var(--border); margin-bottom:15px;">
            <button class="c360-filter-tab active kh-text" onclick="c360SetFilterTab('all', this)">ទាំងអស់</button>
            <button class="c360-filter-tab kh-text" onclick="c360SetFilterTab('in', this)">ចំណូល</button>
            <button class="c360-filter-tab kh-text" onclick="c360SetFilterTab('out', this)">ចំណាយ</button>
        </div>

        <button onclick="c360ExportStatementPDF()" class="kh-text" style="width:100%; padding:14px; background:#0f172a; color:white; border:none; border-radius:12px; font-weight:bold; cursor:pointer; font-size:1rem; box-shadow:0 4px 10px rgba(15, 23, 42, 0.2); transition: 0.2s;">
            <i class="fa-solid fa-file-pdf" style="color: #ef4444; margin-right: 5px;"></i> ទាញយករបាយការណ៍ PDF
        </button>
    </div>

    <!-- 🌟 Transaction List Container -->
    <div id="c360-trx-content" style="min-height: 300px; position: relative;"></div>

    <!-- Pagination -->
    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:20px; padding-top:15px; border-top:1px dashed var(--border);">
        <button id="c360-btn-prev" class="c360-page-btn" onclick="c360ChangeTrxPage(-1)" disabled><i class="fa-solid fa-chevron-left"></i> ថយក្រោយ</button>
        <span id="c360-page-info" class="kh-text" style="font-weight:bold; color:var(--text-main);">ទំព័រ 1</span>
        <button id="c360-btn-next" class="c360-page-btn" onclick="c360ChangeTrxPage(1)">បន្ទាប់ <i class="fa-solid fa-chevron-right"></i></button>
    </div>
  `;
  container.innerHTML = html;

  c360CurrentFilterTab = "all";
  c360FilterTrxList(true);
}

// 🟢 គ្រប់គ្រង Tab (All, Income, Expense)
window.c360SetFilterTab = function (type, btnEl) {
  c360CurrentFilterTab = type;
  document
    .querySelectorAll(".c360-filter-tab")
    .forEach((b) => b.classList.remove("active"));
  btnEl.classList.add("active");
  c360FilterTrxList(true);
};

// 🟢 តម្រងទិន្នន័យ និងគណនាសរុប (Filter & Calculate)
window.c360FilterTrxList = function (resetPage = false) {
  const user = currentC360User;
  if (!user) return;

  if (resetPage) c360CurrentTrxPage = 1;

  const accVal = document.getElementById("c360-trx-acc-filter").value;
  const startStr = document.getElementById("c360-date-start").value;
  const endStr = document.getElementById("c360-date-end").value;

  let trxs = user.transactions || [];

  // 1. Filter by Account
  if (accVal !== "ALL") {
    if (accVal === "USD" || accVal === "KHR") {
      trxs = trxs.filter((t) => t.currency === accVal);
    } else {
      trxs = trxs.filter(
        (t) =>
          t.senderAcc === accVal ||
          t.receiverAcc === accVal ||
          t.cardId === accVal,
      );
    }
  }

  // 2. Filter by Date (បើមិនបានរើសថ្ងៃ វានឹងរំលងការ Filter នេះ)
  if (startStr && endStr) {
    trxs = trxs.filter((t) => {
      let dDate = t.createdAt
        ? new Date(t.createdAt)
        : c360ParseDateString(t.date);
      if (isNaN(dDate.getTime())) return true;
      let iso = dDate.toISOString().split("T")[0];
      return iso >= startStr && iso <= endStr;
    });
  }

  // 3. ដក Pending ចេញកុំអោយរញ៉េរញ៉ៃ Statement
  trxs = trxs.filter((t) => t.status !== "Pending");

  // 🌟 គណនា Mini Dashboard (គណនាមុនពេល Filter Tab)
  let totalInUSD = 0,
    totalOutUSD = 0;
  let totalInKHR = 0,
    totalOutKHR = 0;

  trxs.forEach((t) => {
    const amt = parseFloat(t.amount || 0);
    const isIncome = amt > 0 || t.type === "Received";
    const absAmt = Math.abs(amt);

    if (t.status !== "Refunded" && !(t.type && t.type.includes("Refund"))) {
      if (t.currency === "KHR") {
        if (isIncome) totalInKHR += absAmt;
        else totalOutKHR += absAmt;
      } else {
        if (isIncome) totalInUSD += absAmt;
        else totalOutUSD += absAmt;
      }
    }
  });

  // បង្ហាញលទ្ធផលក្នុងប្រអប់ (Show combined if ALL accounts, else show specific currency)
  const isKHR =
    accVal !== "ALL" &&
    (accVal === "KHR" || (trxs.length > 0 && trxs[0].currency === "KHR"));

  if (isKHR && totalInUSD === 0 && totalOutUSD === 0) {
    document.getElementById("c360-total-in").innerHTML =
      `+${totalInKHR.toLocaleString()} ៛`;
    document.getElementById("c360-total-out").innerHTML =
      `-${totalOutKHR.toLocaleString()} ៛`;
  } else if (accVal === "USD" || (totalInKHR === 0 && totalOutKHR === 0)) {
    document.getElementById("c360-total-in").innerHTML =
      `+$${totalInUSD.toFixed(2)}`;
    document.getElementById("c360-total-out").innerHTML =
      `-$${totalOutUSD.toFixed(2)}`;
  } else {
    document.getElementById("c360-total-in").innerHTML =
      `<span style="font-size:1rem;">+$${totalInUSD.toFixed(2)}<br>+${totalInKHR.toLocaleString()}៛</span>`;
    document.getElementById("c360-total-out").innerHTML =
      `<span style="font-size:1rem;">-$${totalOutUSD.toFixed(2)}<br>-${totalOutKHR.toLocaleString()}៛</span>`;
  }

  // 4. Filter by Tab (In / Out)
  if (c360CurrentFilterTab === "in")
    trxs = trxs.filter((t) => t.amount > 0 || t.type === "Received");
  if (c360CurrentFilterTab === "out")
    trxs = trxs.filter((t) => t.amount < 0 && t.type !== "Received");

  // តម្រៀបពីថ្មីទៅចាស់
  c360FilteredTrx = trxs.sort(
    (a, b) =>
      new Date(b.createdAt || c360ParseDateString(b.date)) -
      new Date(a.createdAt || c360ParseDateString(a.date)),
  );

  c360RenderTrxPage();
};

// 🟢 គូរផ្ទាំងបញ្ជីប្រតិបត្តិការ
function c360RenderTrxPage() {
  const container = document.getElementById("c360-trx-content");
  const btnPrev = document.getElementById("c360-btn-prev");
  const btnNext = document.getElementById("c360-btn-next");
  const pageInfo = document.getElementById("c360-page-info");

  if (c360FilteredTrx.length === 0) {
    container.innerHTML = `
        <div style="text-align:center; padding: 50px 20px; color: var(--text-muted); font-family: 'Kantumruy Pro';">
            <i class="fa-solid fa-file-invoice" style="font-size: 4rem; opacity: 0.2; margin-bottom: 15px;"></i>
            <h3 style="margin: 0 0 5px; color: #475569;">មិនមានប្រតិបត្តិការទេ</h3>
            <p style="margin: 0; font-size: 0.9rem;">សូមសាកល្បងប្តូរថ្ងៃខែ ឬ គណនីម្តងទៀត។</p>
        </div>`;
    btnPrev.disabled = true;
    btnNext.disabled = true;
    pageInfo.innerText = "ទំព័រ 0 នៃ 0";
    return;
  }

  const totalPages = Math.ceil(c360FilteredTrx.length / c360TrxPerPage);
  if (c360CurrentTrxPage > totalPages) c360CurrentTrxPage = totalPages;

  const startIndex = (c360CurrentTrxPage - 1) * c360TrxPerPage;
  const endIndex = startIndex + c360TrxPerPage;
  const pageItems = c360FilteredTrx.slice(startIndex, endIndex);

  let html = "";
  let lastDateLabel = "";

  pageItems.forEach((t, index) => {
    const isIncome = t.amount > 0 || t.type === "Received";
    const isRefunded =
      t.status === "Refunded" || (t.type && t.type.includes("Refund"));

    let parsedDate = t.createdAt
      ? new Date(t.createdAt)
      : c360ParseDateString(t.date);
    let dateLabel = c360GetSmartDateLabel(parsedDate);

    // 🌟 ដាក់ Sticky Date Header
    if (dateLabel !== lastDateLabel) {
      html += `<div class="c360-trx-date-header">${dateLabel}</div>`;
      lastDateLabel = dateLabel;
    }

    // 🌟 កំណត់ Icon តាមប្រភេទ
    let iconClass = isIncome ? "fa-arrow-down" : "fa-arrow-up";
    let bgStyle = isIncome
      ? "background: rgba(16, 185, 129, 0.15); color: #10b981;"
      : "background: rgba(239, 68, 68, 0.15); color: #ef4444;";
    let textColor = isIncome ? "#10b981" : "#ef4444";

    const tType = (t.type || "").toLowerCase();
    const tMethod = (t.trxMethod || "").toLowerCase();

    if (tType.includes("deposit") || tMethod.includes("cashier"))
      iconClass = "fa-hand-holding-dollar";
    else if (tType.includes("payroll") || tMethod.includes("payout"))
      iconClass = "fa-money-bill-transfer";
    else if (tType.includes("promo") || tType.includes("reward")) {
      iconClass = "fa-sack-dollar";
      bgStyle = "background: #fef9c3; color: #eab308;";
      textColor = "#d97706";
    } else if (tType.includes("merchant") || t.merchantId)
      iconClass = "fa-store";
    else if (tType.includes("fee")) {
      iconClass = "fa-receipt";
      bgStyle = "background:#fff7ed; color:#ea580c;";
      textColor = "#ea580c";
    }

    if (isRefunded) {
      iconClass = "fa-arrow-rotate-left";
      bgStyle = "background: var(--bg-body); color: var(--text-muted);";
      textColor = "var(--text-muted)";
    }

    let title = isIncome
      ? t.senderName || t.merchantName || t.type || "Received"
      : t.receiverName || t.merchantName || t.type || "Transfer";
    if (title.includes("U-Pay Central Bank") || title.includes("U-Pay Bank"))
      title = t.trxMethod || t.type || "System Transaction";

    const accShow =
      document.getElementById("c360-trx-acc-filter").value === "ALL"
        ? ` • <i class="fa-solid fa-wallet"></i> ${t.senderAcc || t.receiverAcc || t.currency}`
        : "";

    const displayAmt =
      t.currency === "KHR"
        ? Math.abs(t.amount).toLocaleString() + " ៛"
        : "$" + Math.abs(t.amount).toFixed(2);
    const sign = isIncome ? "+" : "-";
    const timeStr = c360GetTimeString(parsedDate, t.date);

    // 🟢 ចាប់យក Ref ID ពេញលេញ
    const safeRefId = t.refId || t.id || t._id || t.transactionId || "";
    const realIndex = startIndex + index;

    html += `
        <div class="c360-trx-item" onclick="c360ViewTrxDetails(${realIndex})">
            <div style="display: flex; align-items: center; gap: 15px; width: 100%;">
                <div style="${bgStyle} width: 45px; height: 45px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; flex-shrink: 0;">
                    <i class="fa-solid ${iconClass}"></i>
                </div>
                <div style="flex: 1; overflow: hidden;">
                    <h4 class="kh-text" style="margin: 0; font-size: 0.95rem; color: var(--text-main); font-weight: 700; text-transform: capitalize; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">${title}</h4>
                    <p style="margin: 4px 0 0; font-size: 0.75rem; color: var(--text-muted); font-family: 'Inter', sans-serif;">${timeStr} • ${t.trxMethod || t.type}${accShow}</p>
                </div>
            </div>
            <div style="text-align: right; flex-shrink: 0;">
                <div style="font-weight: 800; font-size: 1.1rem; color: ${textColor}; font-family: 'Inter', sans-serif;">
                    ${isRefunded ? "" : sign}${displayAmt}
                    ${isRefunded ? '<br><span class="kh-text" style="font-size:0.65rem; color:#10b981; font-weight:bold;">បានបង្វិលសង</span>' : ""}
                </div>
                <!-- 🟢 បង្ហាញ Ref ID ពេញលេញ និងដកសញ្ញា # ចេញ -->
                <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 3px; font-family: monospace;">${safeRefId}</div>
            </div>
        </div>`;
  });

  container.innerHTML = html;

  pageInfo.innerText = `ទំព័រ ${c360CurrentTrxPage} នៃ ${totalPages}`;
  btnPrev.disabled = c360CurrentTrxPage === 1;
  btnNext.disabled = c360CurrentTrxPage === totalPages;
}

window.c360ChangeTrxPage = function (step) {
  c360CurrentTrxPage += step;
  c360RenderTrxPage();
};

// =======================================================
// 🌟 មុខងារបង្ហាញ Slip សម្រាប់ Admin (Admin Standalone Slip)
// មិនពឹងផ្អែកលើ slip.js របស់ User ទៀតទេ ដើម្បីការពារ Error 404 រូបភាព
// =======================================================
window.c360ViewTrxDetails = function (filteredIndex) {
  const t = c360FilteredTrx[filteredIndex];
  if (!t)
    return Swal.fire("បរាជ័យ", "រកមិនឃើញទិន្នន័យវិក្កយបត្រនេះទេ", "error");

  // 1. រៀបចំទិន្នន័យ
  const isKHR = t.currency === "KHR";
  const currSym = isKHR ? "៛" : "$";
  const isIncome = t.amount > 0 || t.type === "Received";

  const feeAmount = t.fee ? parseFloat(t.fee) : 0;
  let principalAmount = Math.abs(t.amount);
  if (!isIncome && feeAmount > 0)
    principalAmount = Math.abs(t.amount) - feeAmount;

  const formattedAmt = principalAmount.toLocaleString("en-US", {
    minimumFractionDigits: isKHR ? 0 : 2,
    maximumFractionDigits: isKHR ? 0 : 2,
  });
  const formattedFee = feeAmount.toLocaleString("en-US", {
    minimumFractionDigits: isKHR ? 0 : 2,
    maximumFractionDigits: isKHR ? 0 : 2,
  });

  // 2. កំណត់ Theme តាមប្រភេទប្រតិបត្តិការ
  let bgColor = "#004d40";
  let iconColor = "#004d40";
  let iconClass = "fa-check";
  let titleText = isIncome ? "Transfer Received" : "Transfer Sent";
  let lblSenderText = "Sender";
  let lblReceiverText = "Receiver";

  const tType = (t.type || "").toLowerCase();

  if (tType.includes("deposit")) {
    bgColor = "#10b981";
    iconColor = "#10b981";
    iconClass = "fa-hand-holding-dollar";
    titleText = "Cash Deposit";
    lblSenderText = "Deposited By";
    lblReceiverText = "Credited To";
  } else if (tType.includes("withdrawal")) {
    bgColor = "#ef4444";
    iconColor = "#ef4444";
    iconClass = "fa-money-bill-transfer";
    titleText = "Cash Withdrawal";
    lblSenderText = "Withdrawn From";
    lblReceiverText = "Withdrawn By";
  } else if (tType.includes("p2p debt record")) {
    bgColor = isIncome ? "#10b981" : "#ef4444";
    iconColor = bgColor;
    iconClass = "fa-handshake";
    titleText = isIncome ? "P2P Receivable Contract" : "P2P Debt Contract";
    lblSenderText = isIncome ? "Debtor" : "Debtor (You)";
    lblReceiverText = isIncome ? "Creditor (You)" : "Creditor";
  } else if (tType.includes("payroll")) {
    bgColor = "#0ea5e9";
    iconColor = "#0ea5e9";
    iconClass = "fa-money-bill-transfer";
    titleText = isIncome ? "Salary Received" : "Payroll Processed";
    lblSenderText = "Company / Payer";
    lblReceiverText = "Employee";
  } else if (
    tType.includes("merchant") ||
    tType.includes("scan") ||
    t.merchantId ||
    t.trxMethod === "NFC Payment"
  ) {
    bgColor = "#8b5cf6";
    iconColor = "#8b5cf6";
    iconClass = "fa-store";
    titleText = isIncome ? "Payment Received" : "Payment Sent";
    lblSenderText = "Paid By";
    lblReceiverText = "Paid To (Merchant)";
  } else if (tType.includes("bill")) {
    bgColor = "#f97316";
    iconColor = "#f97316";
    iconClass = "fa-file-invoice-dollar";
    titleText = "Bill Paid";
    lblSenderText = "Paid By";
    lblReceiverText = "Biller / Company";
  } else if (tType.includes("promo") || tType.includes("cashback")) {
    bgColor = "#f59e0b";
    iconColor = "#f59e0b";
    iconClass = "fa-sack-dollar";
    titleText = "Reward Credited";
    lblSenderText = "Reward From";
    lblReceiverText = "Credited To";
  } else if (tType.includes("fund") || tType.includes("saving")) {
    bgColor = "#ec4899";
    iconColor = "#ec4899";
    iconClass = "fa-piggy-bank";
    titleText = isIncome ? "U-Fund Added" : "Contributed to U-Fund";
    lblSenderText = "Contributor";
    lblReceiverText = "U-Fund Goal";
  } else if (tType.includes("refund")) {
    bgColor = "#10b981";
    iconColor = "#10b981";
    iconClass = "fa-arrow-rotate-left";
    titleText = "Refund Received";
    lblSenderText = "Refund From";
    lblReceiverText = "Refunded To";
  }

  // 3. រៀបចំឈ្មោះ និងគណនី
  let displaySenderAcc = t.senderAcc || "";
  let displayReceiverAcc = t.receiverAcc || "";

  if (t.cardNumber) {
    const maskedCard = `(${t.cardNumber.substring(0, 4)} **** **** ${t.cardNumber.slice(-4)})`;
    if (tType.includes("refund")) displayReceiverAcc = maskedCard;
    else displaySenderAcc = maskedCard;
  }

  let senderNameFull = t.senderName || "SYSTEM";
  let receiverNameFull = t.receiverName || "SYSTEM";

  if (displaySenderAcc)
    senderNameFull += `<br><span style="font-size:0.75rem; color:#64748b; font-family: 'JetBrains Mono', monospace;">${displaySenderAcc}</span>`;
  if (displayReceiverAcc)
    receiverNameFull += `<br><span style="font-size:0.75rem; color:#64748b; font-family: 'JetBrains Mono', monospace;">${displayReceiverAcc}</span>`;

  // 4. បង្កើត Container បើមិនទាន់មាន
  let slipContainer = document.getElementById("admin-standalone-slip");
  if (!slipContainer) {
    slipContainer = document.createElement("div");
    slipContainer.id = "admin-standalone-slip";
    document.body.appendChild(slipContainer);
  }

  // 5. បញ្ចូល HTML ទៅក្នុង Container (ប្រើ Path ត្រឹមត្រូវ ../images/)
  slipContainer.innerHTML = `
    <style>
      .admin-slip-overlay {
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(5px);
        z-index: 999999; display: flex; align-items: center; justify-content: center; flex-direction: column;
        animation: adminFadeIn 0.3s ease forwards;
        font-family: 'Kantumruy Pro', sans-serif;
      }
      .admin-slip-card {
        width: 340px; margin: 0 auto; background: white; border-radius: 20px;
        overflow: hidden; box-shadow: 0 15px 40px rgba(0,0,0,0.3);
        transform: translateY(20px); animation: adminSlideUp 0.3s ease forwards;
      }
      .admin-slip-header {
        padding: 30px 20px 25px; text-align: center; color: white;
      }
      .admin-slip-icon {
        width: 65px; height: 65px; background: white; border-radius: 50%;
        display: flex; align-items: center; justify-content: center; font-size: 2.2rem;
        margin: 0 auto 15px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);
      }
      .admin-slip-body { padding: 20px 25px; background: white; }
      .admin-slip-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; font-size: 0.85rem; line-height: 1.4; }
      .admin-slip-label { color: #64748b; font-weight: 600; white-space: nowrap; }
      .admin-slip-value { font-weight: 800; text-align: right; color: #1e293b; }
      .admin-slip-btn {
        width: 55px; height: 55px; border-radius: 50%; background: rgba(255,255,255,0.2); backdrop-filter: blur(5px);
        display: flex; align-items: center; justify-content: center; font-size: 1.3rem; margin: 0 auto 8px; color: white;
        cursor: pointer; transition: 0.2s; border: 1px solid rgba(255,255,255,0.3);
      }
      .admin-slip-btn:active { transform: scale(0.9); }
      @keyframes adminFadeIn { to { opacity: 1; } }
      @keyframes adminSlideUp { to { transform: translateY(0); } }
    </style>

    <div class="admin-slip-overlay" onclick="closeAdminSlip()">
      <div class="admin-slip-card" onclick="event.stopPropagation()">
        
        <div class="admin-slip-header" style="background: ${bgColor};">
          <div class="admin-slip-icon" style="color: ${iconColor};">
            <i class="fa-solid ${iconClass}"></i>
          </div>
          <div style="font-weight: 700; font-size: 1.15rem; letter-spacing: 0.5px;">${titleText}</div>
          <div style="font-size: 2.8rem; font-weight: 900; margin-top: 5px; font-family: 'Inter', sans-serif; letter-spacing: -1px;">${currSym}${formattedAmt}</div>
        </div>

        <div class="admin-slip-body">
          <div class="admin-slip-row">
            <span class="admin-slip-label">Trx ID</span>
            <span class="admin-slip-value" style="color:#004d40; font-family: 'JetBrains Mono', monospace;">${t.refId || "N/A"}</span>
          </div>
          <div class="admin-slip-row">
            <span class="admin-slip-label">Hash</span>
            <span class="admin-slip-value" style="color:#3b82f6; font-family: 'JetBrains Mono', monospace; font-size:0.75rem;">${t.hash || "N/A"}</span>
          </div>
          
          <div style="margin: 15px -25px; border-top: 2px dashed #e2e8f0;"></div>
          
          <div class="admin-slip-row">
            <span class="admin-slip-label">${lblSenderText}</span>
            <span class="admin-slip-value">${senderNameFull}</span>
          </div>
          <div class="admin-slip-row">
            <span class="admin-slip-label">${lblReceiverText}</span>
            <span class="admin-slip-value">${receiverNameFull}</span>
          </div>

          <div class="admin-slip-row">
            <span class="admin-slip-label">Payment Via</span>
            <span class="admin-slip-value">${t.trxMethod || "U-PAY System"}</span>
          </div>
          <div class="admin-slip-row">
            <span class="admin-slip-label">Date</span>
            <span class="admin-slip-value" style="font-family: 'Inter', sans-serif;">${t.date}</span>
          </div>
          <div class="admin-slip-row">
            <span class="admin-slip-label">Fee</span>
            <span class="admin-slip-value" style="color: #ef4444; font-family: 'Inter', sans-serif;">${currSym}${formattedFee}</span>
          </div>
          <div class="admin-slip-row">
            <span class="admin-slip-label">Remark</span>
            <span class="admin-slip-value" style="max-width: 65%; color: #475569; font-weight: 600;">${t.remark || "-"}</span>
          </div>
          
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:20px;">
            <div style="display:flex; align-items:center; gap:8px; border:1px solid #e2e8f0; padding:6px 10px; border-radius:12px; background:#f8fafc;">
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=Verify_${t.refId}" style="width:35px; height:35px;"/>
              <div style="font-size:0.65rem; font-weight:800; color:#004d40; line-height: 1.2;">SCAN TO<br/>VERIFY</div>
            </div>
            <!-- 🟢 Path រូបភាពត្រឹមត្រូវសម្រាប់ Admin (ទប់ស្កាត់ការ Error) -->
            <img src="../images/logo.png" style="width:75px;" onerror="this.style.display='none'"/>
          </div>
        </div>
      </div>
      
      <!-- Action Buttons -->
      <div style="display:flex; justify-content:center; gap:35px; margin-top: 25px;">
        <div style="text-align:center; color:white;">
          <div class="admin-slip-btn" onclick="c360ExportStatementPDF()"><i class="fa-solid fa-file-pdf"></i></div>
          <span style="font-size:0.85rem; font-weight:600;">Export</span>
        </div>
        <div style="text-align:center; color:white;">
          <div class="admin-slip-btn" onclick="closeAdminSlip()"><i class="fa-solid fa-xmark"></i></div>
          <span style="font-size:0.85rem; font-weight:600;">Close</span>
        </div>
      </div>
    </div>
  `;
};

// មុខងារបិទ Admin Slip
window.closeAdminSlip = function () {
  const slipContainer = document.getElementById("admin-standalone-slip");
  if (slipContainer) {
    slipContainer.innerHTML = ""; // លុបចេញពីអេក្រង់ភ្លាមៗ
  }
};

// =======================================================
// 🖨️ មុខងារ EXPORT PDF (ទម្រង់ដូច History 100%)
// =======================================================
window.c360ExportStatementPDF = async function () {
  if (c360FilteredTrx.length === 0) {
    return Swal.fire(
      "បញ្ជាក់",
      "មិនមានប្រតិបត្តិការដើម្បី Export ទេ!",
      "warning",
    );
  }

  const start = document.getElementById("c360-date-start").value;
  const end = document.getElementById("c360-date-end").value;
  const accVal = document.getElementById("c360-trx-acc-filter").value;
  const isMultipleAccounts = accVal === "ALL";

  if (!start || !end)
    return Swal.fire("បញ្ជាក់", "សូមជ្រើសរើសកាលបរិច្ឆេទ!", "warning");

  Swal.fire({
    title: "កំពុងរៀបចំរបាយការណ៍ PDF...",
    html: "សូមរង់ចាំបន្តិច ប្រព័ន្ធកំពុងគណនាទិន្នន័យ...",
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading(),
    customClass: { popup: "premium-swal kh-text" },
  });

  // Load jsPDF library dynamically if it doesn't exist in admin
  if (typeof window.jspdf === "undefined") {
    await new Promise((resolve) => {
      const script = document.createElement("script");
      script.src =
        "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
      script.onload = resolve;
      document.head.appendChild(script);
    });
    await new Promise((resolve) => {
      const script = document.createElement("script");
      script.src =
        "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js";
      script.onload = resolve;
      document.head.appendChild(script);
    });
  }

  setTimeout(() => {
    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF("p", "pt", "a4");
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;

      const num = (v) => {
        const n = Number(v);
        return isNaN(n) ? 0 : n;
      };

      const sanitizeForPDF = (str) => {
        if (!str) return "";
        let s = str
          .replace(/គណនីបញ្ញើកើនទ្រព្យ/g, "WEALTH GROWTH")
          .replace(/គណនីបញ្ញើកើនចំណូល/g, "INCOME GROWTH")
          .replace(/គណនីប្រាក់បញ្ញើប្រចាំត្រីមាស/g, "QUARTERLY DEPOSIT")
          .replace(/ប្រាក់បញ្ញើប្រចាំត្រីមាស/g, "QUARTERLY DEPOSIT");
        return s
          .replace(/[^\x20-\x7E]/g, "")
          .replace(/\s+/g, " ")
          .trim();
      };

      // ដក Pending ចេញកុំអោយរញ៉េរញ៉ៃ Statement
      const allTrxAsc = [...currentC360User.transactions]
        .filter((t) => t.status !== "Pending")
        .sort(
          (a, b) =>
            new Date(a.createdAt || a.date) - new Date(b.createdAt || b.date),
        );

      let totalInUSD = 0,
        totalOutUSD = 0;
      let totalInKHR = 0,
        totalOutKHR = 0;
      let runningBalUSD = 0,
        runningBalKHR = 0;

      allTrxAsc.forEach((t) => {
        const amt = num(t.amount);
        if (t.currency === "KHR") {
          runningBalKHR += amt;
          t.computedBalance = runningBalKHR;
        } else {
          runningBalUSD += amt;
          t.computedBalance = runningBalUSD;
        }
      });

      // Filter យកតែអីដែលកំពុងបង្ហាញ
      const stTrx = [...c360FilteredTrx].sort(
        (a, b) =>
          new Date(a.createdAt || a.date) - new Date(b.createdAt || b.date),
      );

      stTrx.forEach((t) => {
        const amt = num(t.amount);
        if (t.currency === "KHR") {
          if (amt > 0) totalInKHR += amt;
          else totalOutKHR += Math.abs(amt);
        } else {
          if (amt > 0) totalInUSD += amt;
          else totalOutUSD += Math.abs(amt);
        }
      });

      const beforeStTrx = allTrxAsc.filter((t) => {
        const d = new Date(t.createdAt || t.date);
        if (isNaN(d.getTime())) return false;
        return d.toISOString().split("T")[0] < start;
      });

      let openingUSD = 0,
        openingKHR = 0;
      const lastUSD = beforeStTrx
        .slice()
        .reverse()
        .find((t) => t.currency !== "KHR");
      const lastKHR = beforeStTrx
        .slice()
        .reverse()
        .find((t) => t.currency === "KHR");
      if (lastUSD) openingUSD = num(lastUSD.computedBalance);
      if (lastKHR) openingKHR = num(lastKHR.computedBalance);

      let endingUSD = openingUSD,
        endingKHR = openingKHR;
      const endUSD = stTrx
        .slice()
        .reverse()
        .find((t) => t.currency !== "KHR");
      const endKHR = stTrx
        .slice()
        .reverse()
        .find((t) => t.currency === "KHR");
      if (endUSD) endingUSD = num(endUSD.computedBalance);
      if (endKHR) endingKHR = num(endKHR.computedBalance);

      // បញ្ចូលរូប Logo (ផ្លូវទៅកាន់ File គឺ '../images/' សម្រាប់ Dashboard Admin)
      doc.addImage("../images/logo-nobg.png", "PNG", 40, 40, 70, 32);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);

      const reportTitle = isMultipleAccounts
        ? "CONSOLIDATED STATEMENT"
        : "ACCOUNT STATEMENT";
      doc.text(reportTitle, pageWidth - 40, 55, { align: "right" });

      doc.setFontSize(10);
      doc.setTextColor(16, 185, 129);
      const fStart = new Date(start).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      const fEnd = new Date(end).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      doc.text(`For period: ${fStart} - ${fEnd}`, pageWidth - 40, 70, {
        align: "right",
      });

      doc.setDrawColor(16, 185, 129);
      doc.setLineWidth(1.5);
      doc.line(40, 85, pageWidth - 40, 85);

      let y = 110;
      doc.setFontSize(12);
      doc.setTextColor(0);
      const userNameStr = sanitizeForPDF(
        (currentC360User.fullName || currentC360User.username).toUpperCase(),
      );
      doc.text(userNameStr, 40, y);
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text("Phnom Penh, Cambodia", 40, y + 15);

      let detailY = 110;
      const rightColX = 350;
      const valueColX = pageWidth - 40;

      doc.setFont("helvetica", "bold");
      doc.setTextColor(44, 62, 80);
      doc.text("ACCOUNT DETAILS", rightColX, detailY);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");

      const accNoDisplay = isMultipleAccounts ? "MULTIPLE ACCOUNTS" : accVal;
      const currDisplay = isMultipleAccounts
        ? "MIXED (USD & KHR)"
        : stTrx[0] && stTrx[0].currency === "KHR"
          ? "KHR"
          : "USD";

      const details = [
        ["Account Name", userNameStr],
        ["Account Type", isMultipleAccounts ? "Consolidated" : "Savings"],
        ["Account No.", accNoDisplay],
        ["Currency", currDisplay],
      ];

      details.forEach((item) => {
        detailY += 15;
        doc.setTextColor(100);
        doc.text(item[0], rightColX, detailY);
        doc.setTextColor(0);
        doc.text(item[1], valueColX, detailY, { align: "right" });
      });

      let summaryY = detailY + 30;
      doc.setFont("helvetica", "bold");
      doc.text("ACCOUNT SUMMARY", rightColX, summaryY);
      let summary = [];

      if (!isMultipleAccounts) {
        const sym = currDisplay === "KHR" ? " KHR" : " USD";
        const opBal = currDisplay === "KHR" ? openingKHR : openingUSD;
        const enBal = currDisplay === "KHR" ? endingKHR : endingUSD;
        const inBal = currDisplay === "KHR" ? totalInKHR : totalInUSD;
        const outBal = currDisplay === "KHR" ? totalOutKHR : totalOutUSD;
        const formatFn = (val) =>
          currDisplay === "KHR"
            ? val.toLocaleString("en-US", { maximumFractionDigits: 0 })
            : val.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              });

        summary = [
          ["Opening Balance", formatFn(opBal) + sym],
          ["Total Money In", "+ " + formatFn(inBal) + sym],
          ["Total Money Out", "- " + formatFn(outBal) + sym],
          ["Ending Balance", formatFn(enBal) + sym],
        ];
      } else {
        const formatUSD = (val) =>
          val.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
        const formatKHR = (val) =>
          val.toLocaleString("en-US", { maximumFractionDigits: 0 });

        summary = [
          ["Total USD In", "+ " + formatUSD(totalInUSD) + " USD"],
          ["Total USD Out", "- " + formatUSD(totalOutUSD) + " USD"],
          ["Total KHR In", "+ " + formatKHR(totalInKHR) + " KHR"],
          ["Total KHR Out", "- " + formatKHR(totalOutKHR) + " KHR"],
        ];
      }

      summary.forEach((item, i) => {
        summaryY += 15;
        doc.setFont(
          "helvetica",
          !isMultipleAccounts && i === 3 ? "bold" : "normal",
        );
        doc.setTextColor(100);
        doc.text(item[0], rightColX, summaryY);
        doc.setTextColor(0);
        doc.text(item[1], valueColX, summaryY, { align: "right" });
      });

      const formatDateToPDF = (dateStr) => {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return ["", ""];
        const ds =
          ("0" + (d.getMonth() + 1)).slice(-2) +
          "/" +
          ("0" + d.getDate()).slice(-2) +
          "/" +
          d.getFullYear();
        const ts = d.toLocaleTimeString("en-US");
        return [ds, ts];
      };

      const tableBody = stTrx.map((t) => {
        const amount = num(t.amount);
        const isIn = amount > 0;
        const [ds, ts] = formatDateToPDF(t.createdAt || t.date);
        const isKHRRow = t.currency === "KHR";
        const rowSym = isKHRRow ? " KHR" : " USD";
        const formatRowMoney = (val) =>
          isKHRRow
            ? val.toLocaleString("en-US", { maximumFractionDigits: 0 })
            : val.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              });

        let sender = sanitizeForPDF(
          (t.senderName || t.merchantName || t.name || "SYSTEM").toUpperCase(),
        );
        let receiver = sanitizeForPDF(
          (
            t.receiverName ||
            t.merchantName ||
            t.name ||
            "SYSTEM"
          ).toUpperCase(),
        );
        let detailsText = isIn
          ? `RECEIVED FROM ${sender}`
          : t.type === "Merchant Payment" || t.type === "Scan"
            ? `PAYMENT TO ${receiver}`
            : `TRANSFER TO ${receiver}`;

        if (
          detailsText.includes("U-PAY CENTRAL BANK") ||
          detailsText.includes("U-PAY BANK")
        ) {
          detailsText = sanitizeForPDF(
            (t.trxMethod || t.type || "SYSTEM TRANSACTION").toUpperCase(),
          );
        }
        if (isMultipleAccounts)
          detailsText += `\nACC: ${t.senderAcc || t.receiverAcc || "MAIN"}`;
        detailsText += `\nREF# ${t.refId || "N/A"}`;
        if (t.remark) detailsText += `\nREMARK: ${sanitizeForPDF(t.remark)}`;

        const balStr = isMultipleAccounts
          ? ""
          : formatRowMoney(num(t.computedBalance)) + rowSym;
        return [
          ds + "\n" + ts,
          detailsText,
          isIn ? formatRowMoney(amount) + rowSym : "",
          !isIn ? formatRowMoney(Math.abs(amount)) + rowSym : "",
          balStr,
        ];
      });

      const tableHead = [
        [
          "Date",
          "Transaction Details",
          { content: "Money In", styles: { halign: "right" } },
          { content: "Money Out", styles: { halign: "right" } },
        ],
      ];
      if (!isMultipleAccounts)
        tableHead[0].push({ content: "Balance", styles: { halign: "right" } });

      doc.autoTable({
        startY: summaryY + 30,
        margin: { bottom: 65, left: 40, right: 40 },
        showFoot: "lastPage",
        head: tableHead,
        body: tableBody,
        theme: "plain",
        styles: { fontSize: 8, cellPadding: 5, textColor: [0, 0, 0] },
        headStyles: {
          fillColor: [245, 245, 245],
          fontStyle: "bold",
          textColor: [0, 0, 0],
        },
        columnStyles: {
          0: { cellWidth: 70 },
          1: { cellWidth: "auto" },
          2: { halign: "right", cellWidth: 70, textColor: [16, 185, 129] },
          3: { halign: "right", cellWidth: 70, textColor: [220, 38, 38] },
          4: { halign: "right", cellWidth: 70 },
        },
        didDrawCell: function (data) {
          if (
            data.section === "body" &&
            data.row.index > 0 &&
            data.column.index === 0
          ) {
            doc.setDrawColor(230);
            doc.setLineWidth(0.5);
            doc.line(
              data.cell.x,
              data.cell.y,
              data.cell.x + doc.internal.pageSize.width,
              data.cell.y,
            );
          }
        },
        didDrawPage: function () {
          doc.setFontSize(7);
          doc.setTextColor(150);
          doc.text(
            "The Ending Balance does not reflect any pending withdrawals or uncleared transactions.",
            40,
            pageHeight - 50,
          );
          doc.text(
            "DISCLAIMER: This document is a digitally generated statement for informational purposes only and does not require a physical signature.",
            40,
            pageHeight - 40,
          );
          doc.text(
            "For an official certified copy, please visit your nearest U-Pay branch.",
            40,
            pageHeight - 32,
          );
          doc.text(
            "U-Pay Plc. | +855 98 203 203 | info@upay.com",
            40,
            pageHeight - 20,
          );
          doc.text(
            "Page " + doc.internal.getNumberOfPages(),
            pageWidth - 40,
            pageHeight - 20,
            { align: "right" },
          );
        },
      });

      doc.save(`Statement_${currentC360User.username}_${start}.pdf`);
      Swal.close();
      Swal.fire({
        toast: true,
        position: "top",
        icon: "success",
        title: "ទាញយករបាយការណ៍ជោគជ័យ!",
        showConfirmButton: false,
        timer: 2000,
        customClass: { popup: "premium-swal" },
      });
    } catch (e) {
      console.error(e);
      Swal.close();
      Swal.fire("Error", "បញ្ហាក្នុងការទាញយក PDF", "error");
    }
  }, 500);
};

// =======================================================
// 🪪 TAB 5: KYC & Identity (Maker-Checker Enforced + Edit Mode)
// =======================================================
function renderKycTab(user) {
  const container = document.getElementById("c360-tab-kyc");
  if (!container) return;

  const status = user.kycStatus || "unverified";
  const imgUrl = user.kycDocument || user.kycImage || user.idCardImage || "";
  const selfieUrl = user.selfieUrl || "";
  const kycSubmittedAt = user.kycSubmittedAt
    ? new Date(user.kycSubmittedAt).toLocaleString()
    : "N/A";
  const kycRejectReason = user.kycRejectReason || "N/A";

  // 🟢 ចាប់យក Username របស់ Admin ដែលកំពុង Log in
  let currentAdminUser = "";
  try {
    let adminStr =
      localStorage.getItem("admin") ||
      sessionStorage.getItem("admin") ||
      localStorage.getItem("user");
    if (adminStr) {
      currentAdminUser = JSON.parse(adminStr).username || "";
    }
    if (!currentAdminUser) {
      let token =
        localStorage.getItem("token") ||
        sessionStorage.getItem("token") ||
        localStorage.getItem("adminToken");
      if (token) {
        currentAdminUser = JSON.parse(atob(token.split(".")[1])).username || "";
      }
    }
  } catch (e) {
    console.warn("Failed to get Admin Username", e);
  }

  // កាត់ចន្លោះទទេ និងបំប្លែងជាអក្សរតូចដើម្បីងាយស្រួលផ្ទៀងផ្ទាត់
  currentAdminUser = (currentAdminUser || "").trim().toLowerCase();
  const kycUploadedBy = (user.kycUploadedBy || "អតិថិជនផ្ទាល់").trim();
  const kycUploadedByLower = kycUploadedBy.toLowerCase();

  let isMaker = false;
  let makerDisplay = kycUploadedBy;

  if (
    kycUploadedBy !== "អតិថិជនផ្ទាល់" &&
    kycUploadedByLower === currentAdminUser
  ) {
    isMaker = true;
    makerDisplay = `<span style="color: #3b82f6;">${kycUploadedBy} (អ្នក)</span>`;
  }

  // 🟢 កំណត់ស្ថានភាព និងប៊ូតុងសកម្មភាព
  let statusBadge = "";
  let statusColor = "";
  let isEditable = false;
  let canUpload = false;
  let infoBoxHtml = "";
  let actionsHtml = ""; // 👈 កំណត់តែម្តងគត់នៅទីនេះ កុំឱ្យ Error ទៀត!

  if (status === "unverified") {
    statusBadge = `<div class="kh-text" style="background: rgba(203, 213, 225, 0.3); color: #475569; padding: 6px 15px; border-radius: 8px; font-weight: bold; border: 1px solid #cbd5e1;"><i class="fa-solid fa-circle-question"></i> មិនទាន់មានទិន្នន័យ</div>`;
    statusColor = "#64748b";
    canUpload = true;
  } else if (status === "pending") {
    statusBadge = `<div class="kh-text" style="background: rgba(245, 158, 11, 0.15); color: #d97706; padding: 6px 15px; border-radius: 8px; font-weight: bold; border: 1px solid #fcd34d;"><i class="fa-solid fa-clock"></i> រង់ចាំការអនុម័ត</div>`;
    statusColor = "#f59e0b";
    infoBoxHtml = `
          <div style="background: #f8fafc; padding: 10px; border-radius: 8px; margin-bottom: 15px; font-size: 0.85rem; border: 1px solid #e2e8f0;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                  <span style="color: #64748b;">អ្នកបញ្ជូន (Maker):</span>
                  <span style="font-weight: bold; color: #1e293b;">${makerDisplay}</span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                  <span style="color: #64748b;">កាលបរិច្ឆេទ (Date):</span>
                  <span style="font-weight: bold; color: #1e293b;">${kycSubmittedAt}</span>
              </div>
          </div>
      `;

    // 🛑 Maker-Checker Logic & Custom Actions
    if (isMaker) {
      isEditable = true;
      canUpload = true;

      // បង្ហាញប៊ូតុង "កែប្រែ" (Inline Edit) និង "ដកសំណើវិញ" (Revoke)
      actionsHtml = `
            <div style="display: flex; gap: 15px; width: 100%; align-items: center;">
                <div class="kh-text" style="flex: 1; padding: 14px; background: #f0fdfa; color: #0d9488; border: 1px dashed #5eead4; border-radius: 12px; font-weight: bold; font-size: 1.05rem; display: flex; justify-content: center; align-items: center; gap: 8px; text-align: center;">
                    <i class="fa-solid fa-pen-to-square"></i> របៀបកែប្រែ៖ ចុចលើរូប ឬទិន្នន័យដើម្បីកែប្រែ
                </div>
                <button onclick="c360PromptKycReject('${user.username}')" class="kh-text" style="padding: 14px 25px; background: #fff5f5; color: #ef4444; border: 1px solid #fca5a5; border-radius: 12px; font-weight: bold; font-size: 1.05rem; cursor: pointer; transition: 0.2s;" title="លុបចោលសំណើដែលអ្នកបានបញ្ជូន">
                    <i class="fa-solid fa-trash-can"></i> ដកសំណើវិញ
                </button>
            </div>`;
    } else {
      isEditable = false;
      canUpload = false;

      // បង្ហាញប៊ូតុង Approve និង Reject សម្រាប់ Checker (អ្នកផ្សេង)
      actionsHtml = `
            <div style="display: flex; gap: 15px; width: 100%;">
                <button onclick="c360PromptKycReject('${user.username}')" class="kh-text" style="flex: 1; padding: 14px; background: #fff5f5; color: #ef4444; border: 1px solid #fca5a5; border-radius: 12px; font-weight: bold; font-size: 1.05rem; cursor: pointer; transition: 0.2s; display: flex; justify-content: center; align-items: center; gap: 8px;">
                    <i class="fa-solid fa-xmark"></i> បដិសេធ (Reject)
                </button>
                <button onclick="processC360KycAction('${user.username}', 'approved')" class="kh-text" style="flex: 1; padding: 14px; background: #10b981; color: white; border: none; border-radius: 12px; font-weight: bold; font-size: 1.05rem; cursor: pointer; transition: 0.2s; box-shadow: 0 4px 10px rgba(16, 185, 129, 0.2); display: flex; justify-content: center; align-items: center; gap: 8px;">
                    <i class="fa-solid fa-check-circle"></i> អនុម័ត (Approve)
                </button>
            </div>`;
    }
  } else if (status === "approved" || status === "verified") {
    statusBadge = `<div class="kh-text" style="background: rgba(16, 185, 129, 0.15); color: #10b981; padding: 6px 15px; border-radius: 8px; font-weight: bold; border: 1px solid #6ee7b7;"><i class="fa-solid fa-circle-check"></i> អនុម័តរួចរាល់</div>`;
    statusColor = "#10b981";
    isEditable = false;
    infoBoxHtml = `
          <div style="background: #ecfdf5; padding: 10px; border-radius: 8px; margin-bottom: 15px; font-size: 0.85rem; border: 1px solid #a7f3d0;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                  <span style="color: #065f46;">អ្នកបញ្ជូន (Maker):</span>
                  <span style="font-weight: bold; color: #064e3b;">${makerDisplay}</span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                  <span style="color: #065f46;">អនុម័តដោយ (Checker):</span>
                  <span style="font-weight: bold; color: #064e3b;">${user.kycApprovedBy || "System"}</span>
              </div>
               <div style="display: flex; justify-content: space-between; margin-top: 5px;">
                  <span style="color: #065f46;">កាលបរិច្ឆេទ (Date):</span>
                  <span style="font-weight: bold; color: #064e3b;">${user.kycApprovedAt ? new Date(user.kycApprovedAt).toLocaleString() : kycSubmittedAt}</span>
              </div>
          </div>
      `;
    actionsHtml = `
          <button onclick="c360PromptKycReject('${user.username}')" class="kh-text" style="width: 100%; padding: 14px; background: #ef4444; color: white; border: none; border-radius: 12px; font-weight: bold; font-size: 1.05rem; cursor: pointer; transition: 0.2s; box-shadow: 0 4px 10px rgba(239, 68, 68, 0.2); display: flex; justify-content: center; align-items: center; gap: 8px;">
              <i class="fa-solid fa-ban"></i> ដកហូតសិទ្ធិ (Revoke/Reject)
          </button>`;
  } else if (status === "rejected") {
    statusBadge = `<div class="kh-text" style="background: rgba(239, 68, 68, 0.15); color: #ef4444; padding: 6px 15px; border-radius: 8px; font-weight: bold; border: 1px solid #fca5a5;"><i class="fa-solid fa-circle-xmark"></i> ត្រូវបានបដិសេធ</div>`;
    statusColor = "#ef4444";
    canUpload = true;
    infoBoxHtml = `
          <div style="background: #fef2f2; padding: 10px; border-radius: 8px; margin-bottom: 15px; font-size: 0.85rem; border: 1px dashed #f87171;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                  <span style="color: #991b1b;">អ្នកបដិសេធ (Rejected By):</span>
                  <span style="font-weight: bold; color: #7f1d1d;">${user.kycRejectedBy || "System"}</span>
              </div>
               <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                  <span style="color: #991b1b;">កាលបរិច្ឆេទ (Date):</span>
                  <span style="font-weight: bold; color: #7f1d1d;">${user.kycRejectedAt ? new Date(user.kycRejectedAt).toLocaleString() : "N/A"}</span>
              </div>
              <div style="display: flex; justify-content: space-between; flex-direction: column;">
                  <span style="color: #991b1b;">មូលហេតុ (Reason):</span>
                  <span style="font-weight: bold; color: #7f1d1d; margin-top: 2px;">${kycRejectReason}</span>
              </div>
          </div>
      `;
  }

  // 🟢 មុខងារចុចលើប្រអប់រូបភាព
  const idClickAction = canUpload
    ? `c360UploadSpecificKyc('idCard')`
    : `c360ViewFullImage(document.getElementById('c360-img-id').src)`;
  const selfieClickAction = canUpload
    ? `c360UploadSpecificKyc('selfie')`
    : `c360ViewFullImage(document.getElementById('c360-img-selfie').src)`;

  // 🟢 រៀបចំរូបភាព
  const idView = `
      <div style="flex: 1; border-radius: 12px; overflow: hidden; border: ${canUpload && !imgUrl ? "2px dashed var(--secondary)" : "1px solid var(--border)"}; background: ${imgUrl ? "#000" : "rgba(16, 185, 129, 0.05)"}; position: relative; cursor: pointer; height: 320px; display: flex; flex-direction: column; align-items: center; justify-content: center; transition: 0.2s;" 
           onclick="${idClickAction}" 
           onmouseover="this.style.borderColor='var(--secondary)'; this.style.boxShadow='0 4px 12px rgba(16, 185, 129, 0.1)';" 
           onmouseout="this.style.borderColor='${canUpload && !imgUrl ? "var(--secondary)" : "var(--border)"}'; this.style.boxShadow='none';">
          
          <img id="c360-img-id" src="${imgUrl}" style="width: 100%; height: 100%; object-fit: contain; display: ${imgUrl ? "block" : "none"}; opacity: 0.9; transition: 0.3s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.9'">
          
          <div id="c360-img-id-placeholder" style="display: ${imgUrl ? "none" : "flex"}; flex-direction: column; align-items: center; color: var(--secondary); font-family: 'Kantumruy Pro'; gap: 10px;">
              <i class="fa-solid fa-id-card-clip" style="font-size: 3rem;"></i>
              <span style="font-weight: bold; font-size: 1.1rem;">ចុចទីនេះដើម្បី Upload ID</span>
          </div>

          <div id="c360-lbl-id" style="display: ${imgUrl ? "block" : "none"}; position: absolute; bottom: 8px; left: 0; right: 0; text-align: center; color: white; font-size: 0.8rem; background: rgba(0,0,0,0.6); padding: 6px; font-family: 'Kantumruy Pro'; backdrop-filter: blur(2px);">
              ${canUpload ? '<i class="fa-solid fa-pen"></i> ចុចដើម្បីប្តូររូប ID ថ្មី' : "អត្តសញ្ញាណប័ណ្ណ (ID Card)"}
          </div>
      </div>`;

  const selfieView = `
      <div style="flex: 1; border-radius: 12px; overflow: hidden; border: ${canUpload && !selfieUrl ? "2px dashed #3b82f6" : "1px solid var(--border)"}; background: ${selfieUrl ? "#000" : "rgba(59, 130, 246, 0.05)"}; position: relative; cursor: pointer; height: 320px; display: flex; flex-direction: column; align-items: center; justify-content: center; transition: 0.2s;" 
           onclick="${selfieClickAction}"
           onmouseover="this.style.borderColor='#3b82f6'; this.style.boxShadow='0 4px 12px rgba(59, 130, 246, 0.1)';" 
           onmouseout="this.style.borderColor='${canUpload && !selfieUrl ? "#3b82f6" : "var(--border)"}'; this.style.boxShadow='none';">
          
          <img id="c360-img-selfie" src="${selfieUrl}" style="width: 100%; height: 100%; object-fit: cover; display: ${selfieUrl ? "block" : "none"}; opacity: 0.9; transition: 0.3s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.9'">
          
          <div id="c360-img-selfie-placeholder" style="display: ${selfieUrl ? "none" : "flex"}; flex-direction: column; align-items: center; color: #3b82f6; font-family: 'Kantumruy Pro'; gap: 10px;">
              <i class="fa-solid fa-camera-retro" style="font-size: 3rem;"></i>
              <span style="font-weight: bold; font-size: 1.1rem;">ចុចទីនេះដើម្បី Upload Selfie</span>
          </div>

          <div id="c360-lbl-selfie" style="display: ${selfieUrl ? "block" : "none"}; position: absolute; bottom: 8px; left: 0; right: 0; text-align: center; color: white; font-size: 0.8rem; background: rgba(0,0,0,0.6); padding: 6px; font-family: 'Kantumruy Pro'; backdrop-filter: blur(2px);">
              ${canUpload ? '<i class="fa-solid fa-pen"></i> ចុចដើម្បីប្តូររូប Selfie ថ្មី' : "រូបថតផ្ទាល់ (Live Selfie)"}
          </div>
      </div>`;

  let imagesHtml = `<div style="display: flex; gap: 15px; width: 100%;">${idView}${selfieView}</div>`;

  // 🟢 ប្រអប់ទិន្នន័យ (Grid Boxes - Inline Edit)
  const renderDataBox = (label, id, value, isEditableField) => {
    const editIcon =
      isEditable && isEditableField
        ? `<i class="fa-solid fa-pen edit-icon" onclick="c360ToggleKycEdit('${id}')" style="position: absolute; right: 15px; top: 15px; color: #3b82f6; cursor: pointer; opacity: 0; transition: 0.2s; padding: 5px;" title="កែប្រែ"></i>`
        : "";
    const hoverClass = isEditable && isEditableField ? "editable-box" : "";

    return `
        <div class="c360-data-box ${hoverClass}" id="kyc-box-${id}" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; position: relative; min-height: 70px; display: flex; flex-direction: column; justify-content: center; transition: 0.2s;">
            <div id="kyc-view-${id}">
                <span style="font-size: 0.75rem; color: #64748b; font-weight: 700; font-family: 'Kantumruy Pro', sans-serif; display: block; margin-bottom: 4px;">${label}</span>
                <span id="kyc-val-${id}" style="font-size: 1.05rem; color: #0f172a; font-weight: 700; font-family: 'Inter', 'Kantumruy Pro', sans-serif;">${value || "N/A"}</span>
                ${editIcon}
            </div>
            <div id="kyc-edit-${id}" style="display: none; width: 100%;">
                <span style="font-size: 0.75rem; color: #3b82f6; font-weight: 700; font-family: 'Kantumruy Pro', sans-serif; display: block; margin-bottom: 4px;">កែប្រែ ${label}</span>
                <input type="${id === "dob" ? "date" : "text"}" id="kyc-input-${id}" value="${value || ""}" style="width: 100%; padding: 8px 10px; border: 2px solid #3b82f6; border-radius: 6px; font-size: 0.95rem; font-family: 'Inter', 'Kantumruy Pro', sans-serif; outline: none; box-sizing: border-box; margin-bottom: 8px;">
                <div id="kyc-inline-actions-${id}" style="display: flex; gap: 8px;">
                    <button onclick="c360SaveKycField('${id}')" style="flex: 1; background: #10b981; color: white; border: none; padding: 6px; border-radius: 6px; font-size: 0.8rem; font-weight: bold; cursor: pointer;"><i class="fa-solid fa-check"></i> Save</button>
                    <button onclick="c360CancelKycEdit('${id}')" style="flex: 1; background: #e2e8f0; color: #475569; border: none; padding: 6px; border-radius: 6px; font-size: 0.8rem; font-weight: bold; cursor: pointer;">Cancel</button>
                </div>
            </div>
        </div>
      `;
  };

  const html = `
    <style>
        .editable-box:hover { border-color: #cbd5e1 !important; box-shadow: 0 2px 5px rgba(0,0,0,0.02); }
        .editable-box:hover .edit-icon { opacity: 1 !important; }
        .editable-box .edit-icon:hover { color: #2563eb !important; transform: scale(1.1); }
    </style>
    
    <!-- Hidden inputs ទុកផ្ទុក URL ថ្មីបណ្តោះអាសន្ន -->
    <input type="hidden" id="c360-temp-id" value="">
    <input type="hidden" id="c360-temp-selfie" value="">

    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 2px solid var(--border); padding-bottom: 15px;">
        <h2 style="margin: 0; font-size: 1.3rem; color: var(--text-main); font-family: 'Kantumruy Pro'; font-weight: 800;">
            <i class="fa-solid fa-id-card-clip" style="color: ${statusColor};"></i> ឯកសារ (KYC & Identity)
        </h2>
        ${statusBadge}
    </div>

    ${infoBoxHtml}

    <!-- 🖼️ ផ្នែករូបភាព (ចុចលើប្រអប់ផ្ទាល់) -->
    ${imagesHtml}

    <!-- 📝 ផ្នែកទិន្នន័យ OCR -->
    <h4 class="kh-text" style="margin: 25px 0 15px 0; color: var(--text-main); border-bottom: 1px dashed var(--border); padding-bottom: 10px;">
        <i class="fa-solid fa-file-lines"></i> ទិន្នន័យអត្តសញ្ញាណ (Extracted Data)
    </h4>
    
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
        ${renderDataBox("ឈ្មោះពេញ (FULL NAME)", "fullName", user.fullName, true)}
        ${renderDataBox("លេខអត្តសញ្ញាណប័ណ្ណ (ID NUMBER)", "idNumber", user.idNumber, true)}
        ${renderDataBox("ថ្ងៃខែឆ្នាំកំណើត (DOB)", "dob", user.dob, true)}
        ${renderDataBox("ភេទ (GENDER)", "gender", user.gender, true)}
    </div>

    <!-- 🛠️ ប៊ូតុង Submit & Cancel (លេចឡើងពេលកំពុង Draft Upload រូបថ្មី) -->
    <div id="kyc-draft-actions" style="display: none; gap: 15px; width: 100%; margin-top: 30px;">
        <button onclick="c360CancelKycDraft()" class="kh-text" style="flex: 1; padding: 14px; background: #e2e8f0; color: #475569; border: none; border-radius: 12px; font-weight: bold; font-size: 1.05rem; cursor: pointer; transition: 0.2s;">
            បោះបង់ (Cancel)
        </button>
        <button onclick="c360SubmitKycDraft()" class="kh-text" style="flex: 2; padding: 14px; background: #3b82f6; color: white; border: none; border-radius: 12px; font-weight: bold; font-size: 1.05rem; cursor: pointer; transition: 0.2s; box-shadow: 0 4px 10px rgba(59, 130, 246, 0.2);">
            <i class="fa-solid fa-paper-plane"></i> បញ្ជូនសំណើ KYC ថ្មី
        </button>
    </div>

    <!-- 🛠️ ផ្នែកប៊ូតុងអនុម័ត/បដិសេធដើម ឬ ប៊ូតុងរបស់ Maker -->
    <div id="kyc-default-actions" style="display: flex; gap: 15px; width: 100%; margin-top: 30px;">
        ${actionsHtml}
    </div>
  `;

  container.innerHTML = html;
}

// =======================================================
// 🟢 មុខងារកែប្រែទិន្នន័យ KYC (Inline Edit)
// =======================================================
window.c360ToggleKycEdit = function (id) {
  document.getElementById(`kyc-view-${id}`).style.display = "none";
  document.getElementById(`kyc-edit-${id}`).style.display = "block";
  document.getElementById(`kyc-box-${id}`).classList.remove("editable-box");
};

window.c360CancelKycEdit = function (id) {
  document.getElementById(`kyc-edit-${id}`).style.display = "none";
  document.getElementById(`kyc-view-${id}`).style.display = "block";
  document.getElementById(`kyc-box-${id}`).classList.add("editable-box");
  document.getElementById(`kyc-input-${id}`).value = currentC360User[id] || "";
};

window.c360SaveKycField = async function (id) {
  const newVal = document.getElementById(`kyc-input-${id}`).value.trim();
  if (!newVal && id !== "gender")
    return Swal.fire({
      toast: true,
      position: "top",
      icon: "warning",
      title: "សូមបញ្ជូលទិន្នន័យ!",
      showConfirmButton: false,
      timer: 1500,
    });

  Swal.fire({
    title: "កំពុងរក្សាទុក...",
    toast: true,
    position: "top-end",
    showConfirmButton: false,
    didOpen: () => Swal.showLoading(),
  });

  try {
    const bodyData = {
      id: currentC360User._id || currentC360User.id,
      username: currentC360User.username,
    };
    bodyData[id] = newVal;

    const res = await fetch("/api/admin/edit-user", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(bodyData),
    });
    const data = await res.json();

    if (data.success) {
      currentC360User[id] = newVal;
      document.getElementById(`kyc-val-${id}`).innerText = newVal;
      c360CancelKycEdit(id);
      Swal.fire({
        icon: "success",
        title: "បានរក្សាទុក!",
        toast: true,
        position: "top-end",
        timer: 1500,
        showConfirmButton: false,
      });
    } else {
      throw new Error(data.message);
    }
  } catch (e) {
    Swal.fire({
      icon: "error",
      title: "បរាជ័យ",
      text: e.message || "បញ្ហា Server",
      customClass: { popup: "premium-swal kh-text" },
    });
  }
};

// =======================================================
// 🟢 មុខងារអនុម័ត និងបដិសេធ (Approve & Reject with Reason)
// =======================================================
window.c360PromptKycReject = async function (username) {
  const { value: reason } = await Swal.fire({
    title:
      '<span class="kh-text" style="font-size: 1.3rem; color: #ef4444;">បញ្ជាក់ការបដិសេធ ឬដកសំណើ?</span>',
    html: `
            <p class="kh-text" style="font-size: 0.95rem; color: var(--text-muted); margin-bottom: 15px;">សូមបញ្ជាក់មូលហេតុ (ឧទាហរណ៍៖ រូបភាពព្រិល, ឯកសារផុតកំណត់...)</p>
            <input id="swal-reject-reason" class="swal2-input kh-text" placeholder="វាយបញ្ចូលមូលហេតុទីនេះ..." style="font-size: 1rem; padding: 10px; border-radius: 8px;">
        `,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "យល់ព្រម",
    cancelButtonText: "បោះបង់",
    confirmButtonColor: "#ef4444",
    cancelButtonColor: "#64748b",
    customClass: { popup: "modal-radius kh-text" },
    preConfirm: () => {
      const val = document.getElementById("swal-reject-reason").value.trim();
      if (!val) Swal.showValidationMessage("អ្នកត្រូវតែបញ្ចូលមូលហេតុ!");
      return val;
    },
  });

  if (reason) {
    processC360KycAction(username, "rejected", reason);
  }
};

window.processC360KycAction = async function (
  username,
  action,
  rejectReason = "",
) {
  if (action === "approved") {
    const confirm = await Swal.fire({
      title:
        '<span class="kh-text" style="font-size: 1.3rem; color: #10b981;">អនុម័ត KYC?</span>',
      text: "តើអ្នកប្រាកដថាឯកសារនេះត្រឹមត្រូវ ១០០% ហើយមែនទេ?",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "បាទ/ចាស អនុម័ត",
      cancelButtonText: "ពិនិត្យម្តងទៀត",
      confirmButtonColor: "#10b981",
      cancelButtonColor: "#64748b",
      customClass: { popup: "modal-radius kh-text" },
    });
    if (!confirm.isConfirmed) return;
  }

  Swal.fire({
    title: "កំពុងដំណើរការ...",
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading(),
    customClass: { popup: "premium-swal kh-text" },
  });

  try {
    const payload = { username, action, rejectReason };
    const res = await fetch("/api/admin/kyc-action", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (data.success) {
      Swal.fire({
        icon: "success",
        title: "ជោគជ័យ!",
        text: `ទិន្នន័យត្រូវបានធ្វើបច្ចុប្បន្នភាព។`,
        timer: 1500,
        showConfirmButton: false,
        customClass: { popup: "premium-swal kh-text" },
      });
      c360RefreshData();

      if (action === "rejected") {
        setTimeout(() => {
          Swal.fire({
            title: "សូមចំណាំ!",
            text: `សូមទំនាក់ទំនងទៅកាន់អតិថិជន ដើម្បីប្រាប់ពីមូលហេតុ: "${rejectReason}"`,
            icon: "info",
            confirmButtonText: "យល់ព្រម",
            confirmButtonColor: "#3b82f6",
            customClass: { popup: "premium-swal kh-text" },
          });
        }, 1600);
      }
    } else {
      Swal.fire(
        "បរាជ័យ",
        data.message || "មានបញ្ហាក្នុងការធ្វើបច្ចុប្បន្នភាព",
        "error",
      );
    }
  } catch (e) {
    Swal.fire("Error", "បញ្ហាតភ្ជាប់ទៅកាន់ Server", "error");
  }
};

// =======================================================
// 🟢 មុខងារ Upload រូបថតថ្មីដោយ Admin (ប្រព័ន្ធ Draft & OCR)
// =======================================================
window.c360UploadSpecificKyc = function (type) {
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/*";
  fileInput.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    Swal.fire({
      title: "កំពុងដំណើរការ...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
      customClass: { popup: "premium-swal kh-text" },
    });

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", "iaxuqmpb");

    try {
      const cloudRes = await fetch(
        `https://api.cloudinary.com/v1_1/jp9yg3dj/image/upload`,
        { method: "POST", body: formData },
      );
      const cloudData = await cloudRes.json();

      if (cloudData.secure_url) {
        const url = cloudData.secure_url;

        if (type === "idCard") {
          Swal.fire({
            title: "កំពុងអានទិន្នន័យ AI...",
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading(),
            customClass: { popup: "premium-swal kh-text" },
          });

          const ocrRes = await fetch("/api/scan-id-card", {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({ imageUrl: url }),
          });
          const ocrData = await ocrRes.json();

          if (ocrData.success) {
            document.getElementById("kyc-input-fullName").value =
              ocrData.data.fullName || "";
            document.getElementById("kyc-input-idNumber").value =
              ocrData.data.idNumber || "";
            document.getElementById("kyc-input-dob").value =
              ocrData.data.dob || "";
            document.getElementById("kyc-input-gender").value =
              ocrData.data.gender || "";

            ["fullName", "idNumber", "dob", "gender"].forEach((f) => {
              document.getElementById(`kyc-view-${f}`).style.display = "none";
              document.getElementById(`kyc-edit-${f}`).style.display = "block";
              const inlineActions = document.getElementById(
                `kyc-inline-actions-${f}`,
              );
              if (inlineActions) inlineActions.style.display = "none";
            });

            const idImg = document.getElementById("c360-img-id");
            idImg.src = url;
            idImg.style.display = "block";
            idImg.parentElement.style.background = "#000";
            idImg.parentElement.style.border = "1px solid var(--border)";
            idImg.parentElement.style.borderStyle = "solid";

            const idHolder = document.getElementById("c360-img-id-placeholder");
            if (idHolder) idHolder.style.display = "none";

            const idLabel = document.getElementById("c360-lbl-id");
            if (idLabel) {
              idLabel.style.display = "block";
              idLabel.innerHTML = `<i class="fa-solid fa-pen"></i> ចុចដើម្បីប្តូររូប ID ថ្មី`;
            }

            document.getElementById("c360-temp-id").value = url;
            Swal.close();
          } else {
            Swal.fire(
              "បរាជ័យ",
              ocrData.message || "AI មិនអាចអានអត្តសញ្ញាណប័ណ្ណបានទេ!",
              "error",
            );
            return;
          }
        } else {
          const selfieImg = document.getElementById("c360-img-selfie");
          selfieImg.src = url;
          selfieImg.style.display = "block";
          selfieImg.parentElement.style.background = "#000";
          selfieImg.parentElement.style.border = "1px solid var(--border)";
          selfieImg.parentElement.style.borderStyle = "solid";

          const selfieHolder = document.getElementById(
            "c360-img-selfie-placeholder",
          );
          if (selfieHolder) selfieHolder.style.display = "none";

          const selfieLabel = document.getElementById("c360-lbl-selfie");
          if (selfieLabel) {
            selfieLabel.style.display = "block";
            selfieLabel.innerHTML = `<i class="fa-solid fa-pen"></i> ចុចដើម្បីប្តូររូប Selfie ថ្មី`;
          }

          document.getElementById("c360-temp-selfie").value = url;
          Swal.close();
        }

        document.getElementById("kyc-draft-actions").style.display = "flex";
        document.getElementById("kyc-default-actions").style.display = "none";
      } else {
        Swal.fire("បរាជ័យ", "មិនអាច Upload រូបភាពបានទេ", "error");
      }
    } catch (err) {
      Swal.fire("Error", "បញ្ហាតភ្ជាប់", "error");
    }
  };
  fileInput.click();
};

window.c360CancelKycDraft = function () {
  renderKycTab(currentC360User);
};

window.c360SubmitKycDraft = async function () {
  const fullName = document.getElementById("kyc-input-fullName").value.trim();
  const idNumber = document.getElementById("kyc-input-idNumber").value.trim();
  const dob = document.getElementById("kyc-input-dob").value;
  const gender = document.getElementById("kyc-input-gender").value;

  const tempIdUrl = document.getElementById("c360-temp-id").value;
  const tempSelfieUrl = document.getElementById("c360-temp-selfie").value;

  if (!fullName || !idNumber || !dob || !gender) {
    return Swal.fire({
      icon: "warning",
      title: "សូមបំពេញចន្លោះ",
      text: "ទិន្នន័យអត្តសញ្ញាណមិនទាន់គ្រប់គ្រាន់ទេ!",
      customClass: { popup: "premium-swal kh-text" },
    });
  }

  Swal.fire({
    title: "កំពុងបញ្ជូនសំណើ...",
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading(),
    customClass: { popup: "premium-swal kh-text" },
  });

  try {
    const editRes = await fetch("/api/admin/edit-user", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        id: currentC360User._id || currentC360User.id,
        username: currentC360User.username,
        fullName,
        idNumber,
        dob,
        gender,
      }),
    });

    if (tempIdUrl) {
      await fetch("/api/admin/upload-specific-kyc", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          username: currentC360User.username,
          type: "idCard",
          url: tempIdUrl,
          adminName:
            document.getElementById("adminNameDisplay")?.innerText || "Admin",
        }),
      });
    }
    if (tempSelfieUrl) {
      await fetch("/api/admin/upload-specific-kyc", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          username: currentC360User.username,
          type: "selfie",
          url: tempSelfieUrl,
          adminName:
            document.getElementById("adminNameDisplay")?.innerText || "Admin",
        }),
      });
    }

    Swal.fire({
      icon: "success",
      title: "ជោគជ័យ!",
      text: "សំណើ KYC ត្រូវបានបញ្ជូន។",
      timer: 2000,
      showConfirmButton: false,
      customClass: { popup: "premium-swal kh-text" },
    });
    c360RefreshData();
  } catch (e) {
    Swal.fire({
      icon: "error",
      title: "បរាជ័យ",
      text: "មានបញ្ហាភ្ជាប់ទៅកាន់ Server",
      customClass: { popup: "premium-swal kh-text" },
    });
  }
};

window.c360ViewFullImage = function (url) {
  if (!url || url === "" || url.includes("none")) return;
  Swal.fire({
    imageUrl: url,
    imageAlt: "KYC Document",
    width: "80%",
    showConfirmButton: false,
    showCloseButton: true,
    background: "transparent",
    backdrop: "rgba(0,0,0,0.9)",
  });
};

// =======================================================
// 🛡️ TAB 6: Security (សន្តិសុខ និងសុវត្ថិភាព)
// =======================================================
function renderSecurityTab(user) {
  const container = document.getElementById("c360-tab-security");
  if (!container) return;

  const isFrozen = user.isFrozen || false;
  const pinAttempts = user.pinAttempts || 0;
  const passwordAttempts = user.passwordAttempts || 0;
  const hasTelegram = user.telegramChatId ? true : false;
  const hasEmail = user.email ? true : false;

  // 🟢 ១. រៀបចំ UI សម្រាប់ស្ថានភាពគណនី
  const freezeStatusHtml = isFrozen
    ? `<span style="background: #fee2e2; color: #ef4444; padding: 4px 12px; border-radius: 6px; font-weight: bold; font-size: 0.85rem;"><i class="fa-solid fa-lock" style="margin-right: 5px;"></i> បានផ្អាក (Frozen)</span>`
    : `<span style="background: #dcfce7; color: #10b981; padding: 4px 12px; border-radius: 6px; font-weight: bold; font-size: 0.85rem;"><i class="fa-solid fa-lock-open" style="margin-right: 5px;"></i> ដំណើរការ (Active)</span>`;

  // 🟢 ២. រៀបចំ UI សម្រាប់ ស្ថានភាពអនឡាញ (Online Status) ពិតប្រាកដ
  let isActuallyOnline = false;
  if (user.lastActive) {
    const lastActiveTime = new Date(user.lastActive).getTime();
    const currentTime = new Date().getTime();
    const diffInMinutes = (currentTime - lastActiveTime) / (1000 * 60);

    // បើគាត់មានសកម្មភាព (Heartbeat) ក្នុងរយៈពេល ៥ នាទីចុងក្រោយ ចាត់ទុកថា Online
    if (diffInMinutes <= 5 && user.isOnline) {
      isActuallyOnline = true;
    }
  }

  const onlineStatusHtml = isActuallyOnline
    ? `<span style="color: #10b981; font-weight: bold;"><i class="fa-solid fa-circle" style="font-size: 0.6rem; vertical-align: middle; margin-right: 4px; animation: pulse 2s infinite;"></i> អនឡាញ (Online)</span>`
    : `<span style="color: #94a3b8; font-weight: bold;"><i class="fa-solid fa-circle" style="font-size: 0.6rem; vertical-align: middle; margin-right: 4px;"></i> អហ្វឡាញ (Offline)</span>`;

  // 🟢 ៣. រៀបចំ UI សម្រាប់ កម្រិតសុវត្ថិភាព (KYC Level)
  const isKycVerified =
    user.kycStatus === "verified" || user.kycStatus === "approved";
  const kycLevelHtml = isKycVerified
    ? `<span style="color: #3b82f6; font-weight: bold;"><i class="fa-solid fa-shield-check" style="margin-right: 4px;"></i> កម្រិតខ្ពស់ (Verified)</span>`
    : `<span style="color: #f59e0b; font-weight: bold;"><i class="fa-solid fa-shield-halved" style="margin-right: 4px;"></i> កម្រិតទាប (Unverified)</span>`;

  // 🟢 ៤. រៀបចំ UI សម្រាប់ PIN & Password Attempts
  let pinColor = "#10b981",
    pinLabel = "Normal";
  if (pinAttempts >= 3) {
    pinColor = "#ef4444";
    pinLabel = "Locked 🔒";
  } else if (pinAttempts > 0) {
    pinColor = "#f59e0b";
    pinLabel = "Warning ⚠️";
  }
  const pinStatusHtml = `<span style="color: ${pinColor}; font-weight: bold;">${pinAttempts} ដង (${pinLabel})</span>`;

  let passColor = "#10b981",
    passLabel = "Normal";
  if (passwordAttempts >= 5) {
    passColor = "#ef4444";
    passLabel = "Locked 🔒";
  } else if (passwordAttempts > 0) {
    passColor = "#f59e0b";
    passLabel = "Warning ⚠️";
  }
  const passwordStatusHtml = `<span style="color: ${passColor}; font-weight: bold;">${passwordAttempts} ដង (${passLabel})</span>`;

  // 🟢 ៥. រៀបចំ UI សម្រាប់ Telegram
  const telegramHtml = hasTelegram
    ? `<span style="color: #0ea5e9; font-weight: bold;"><i class="fa-brands fa-telegram"></i> បានភ្ជាប់</span>`
    : `<span style="color: #64748b; font-weight: bold;">មិនទាន់ភ្ជាប់ទេ</span>`;

  // 🟢 ៦. រៀបចំបញ្ជីឧបករណ៍ដែលបានភ្ជាប់ (Connected Devices Array) 🚀 លេង Loop
  let devicesHtml = "";

  if (user.connectedDevices && user.connectedDevices.length > 0) {
    devicesHtml = user.connectedDevices
      .map((dev, index) => {
        let deviceIcon = "fa-laptop";
        const devName = dev.device ? dev.device.toLowerCase() : "";
        if (
          devName.includes("iphone") ||
          devName.includes("android") ||
          devName.includes("mobile")
        )
          deviceIcon = "fa-mobile-screen-button";
        else if (devName.includes("ipad") || devName.includes("tablet"))
          deviceIcon = "fa-tablet-screen-button";
        else if (
          devName.includes("pc") ||
          devName.includes("mac") ||
          devName.includes("windows")
        )
          deviceIcon = "fa-desktop";

        const isActive = index === 0 && isActuallyOnline;
        const deviceStatusText = isActive
          ? `<span style="color: #10b981; font-weight: bold; font-size: 0.8rem;"><i class="fa-solid fa-circle" style="font-size: 0.5rem; vertical-align: middle; margin-right: 3px; animation: pulse 2s infinite;"></i> កំពុងប្រើ (Active)</span>`
          : `<span style="color: #94a3b8; font-weight: bold; font-size: 0.8rem;"><i class="fa-solid fa-circle" style="font-size: 0.5rem; vertical-align: middle; margin-right: 3px;"></i> បានចេញ (Offline)</span>`;

        const timeStr = dev.time ? new Date(dev.time).toLocaleString() : "N/A";

        return `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 18px; background: white; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.03); margin-bottom: 12px; transition: 0.2s;">
              <div style="display: flex; align-items: center; gap: 18px;">
                  <div style="width: 55px; height: 55px; background: #eff6ff; color: #3b82f6; border-radius: 50%; display: flex; justify-content: center; align-items: center; font-size: 1.5rem; border: 1px solid #bfdbfe;">
                      <i class="fa-solid ${deviceIcon}"></i>
                  </div>
                  <div>
                      <div class="kh-text" style="font-weight: 800; color: #1e293b; font-size: 1.1rem; margin-bottom: 5px;">${dev.device || "Unknown"}</div>
                      <div style="font-size: 0.85rem; color: #64748b; font-family: 'Inter', monospace; display: flex; align-items: center; gap: 6px;">
                          <i class="fa-solid fa-globe" style="color: #94a3b8;"></i> IP: ${dev.ip || "N/A"}
                      </div>
                  </div>
              </div>
              <div style="text-align: right;">
                  <div class="kh-text" style="margin-bottom: 5px;">${deviceStatusText}</div>
                  <div class="kh-text" style="font-size: 0.8rem; color: #94a3b8;"><i class="fa-regular fa-clock"></i> ${timeStr}</div>
              </div>
          </div>`;
      })
      .join("");
  } else {
    // Fallback: ប្រើប្រាស់ទិន្នន័យចាស់ បើ Array អត់មានទិន្នន័យ
    const lastIp = user.lastIp || "មិនមានទិន្នន័យ (N/A)";
    const lastDevice = user.lastDevice || "មិនមានទិន្នន័យ (N/A)";
    const lastLogin = user.lastLogin
      ? new Date(user.lastLogin).toLocaleString()
      : "មិនមានទិន្នន័យ (N/A)";

    let deviceIcon = "fa-laptop";
    const devName = lastDevice.toLowerCase();
    if (
      devName.includes("iphone") ||
      devName.includes("android") ||
      devName.includes("mobile")
    )
      deviceIcon = "fa-mobile-screen-button";
    else if (devName.includes("ipad") || devName.includes("tablet"))
      deviceIcon = "fa-tablet-screen-button";
    else if (
      devName.includes("pc") ||
      devName.includes("mac") ||
      devName.includes("windows")
    )
      deviceIcon = "fa-desktop";

    const deviceStatusText = isActuallyOnline
      ? `<span style="color: #10b981; font-weight: bold; font-size: 0.8rem;"><i class="fa-solid fa-circle" style="font-size: 0.5rem; vertical-align: middle; margin-right: 3px; animation: pulse 2s infinite;"></i> កំពុងប្រើ (Active Now)</span>`
      : `<span style="color: #94a3b8; font-weight: bold; font-size: 0.8rem;"><i class="fa-solid fa-circle" style="font-size: 0.5rem; vertical-align: middle; margin-right: 3px;"></i> បានចេញ (Offline)</span>`;

    devicesHtml = `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 18px; background: white; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.03); margin-bottom: 12px;">
              <div style="display: flex; align-items: center; gap: 18px;">
                  <div style="width: 55px; height: 55px; background: #eff6ff; color: #3b82f6; border-radius: 50%; display: flex; justify-content: center; align-items: center; font-size: 1.5rem; border: 1px solid #bfdbfe;">
                      <i class="fa-solid ${deviceIcon}"></i>
                  </div>
                  <div>
                      <div class="kh-text" style="font-weight: 800; color: #1e293b; font-size: 1.1rem; margin-bottom: 5px;">${lastDevice}</div>
                      <div style="font-size: 0.85rem; color: #64748b; font-family: 'Inter', monospace; display: flex; align-items: center; gap: 6px;">
                          <i class="fa-solid fa-globe" style="color: #94a3b8;"></i> IP: ${lastIp}
                      </div>
                  </div>
              </div>
              <div style="text-align: right;">
                  <div class="kh-text" style="margin-bottom: 5px;">${deviceStatusText}</div>
                  <div class="kh-text" style="font-size: 0.8rem; color: #94a3b8;"><i class="fa-regular fa-clock"></i> ${lastLogin}</div>
              </div>
          </div>`;
  }

  // 🟢 ៧. រៀបចំប៊ូតុង Freeze/Unfreeze
  const freezeBtnHtml = isFrozen
    ? `<button onclick="c360ToggleFreeze(false)" class="kh-text" style="width: 100%; padding: 12px; background: #10b981; color: white; border: none; border-radius: 8px; font-weight: bold; font-size: 0.95rem; cursor: pointer; transition: 0.2s; display: flex; justify-content: center; align-items: center; gap: 8px; box-shadow: 0 4px 10px rgba(16, 185, 129, 0.2);">
          <i class="fa-solid fa-unlock-keyhole"></i> បើកគណនីវិញ (Unfreeze)
       </button>`
    : `<button onclick="c360ToggleFreeze(true)" class="kh-text" style="width: 100%; padding: 12px; background: #f59e0b; color: white; border: none; border-radius: 8px; font-weight: bold; font-size: 0.95rem; cursor: pointer; transition: 0.2s; display: flex; justify-content: center; align-items: center; gap: 8px; box-shadow: 0 4px 10px rgba(245, 158, 11, 0.2);">
          <i class="fa-solid fa-user-lock"></i> ផ្អាកគណនី (Freeze Account)
       </button>`;

  const html = `
    <style>
        .c360-sec-card { background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.02); }
        .c360-sec-card-header { display: flex; align-items: center; gap: 10px; margin-bottom: 15px; font-weight: 800; font-family: 'Kantumruy Pro', sans-serif; color: #1e293b; font-size: 1.1rem; }
        .c360-sec-row { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px dashed #e2e8f0; }
        .c360-sec-row:last-child { border-bottom: none; padding-bottom: 0; }
        .c360-sec-label { color: #64748b; font-size: 0.9rem; font-family: 'Kantumruy Pro', sans-serif; font-weight: 600; }
        .c360-sec-val { color: #0f172a; font-size: 0.95rem; font-family: 'Inter', 'Kantumruy Pro', sans-serif; font-weight: 700; text-align: right; }
        
        .c360-sec-action-card { border-radius: 12px; padding: 20px; margin-bottom: 20px; border: 1px solid transparent; }
        .c360-sec-action-title { font-family: 'Kantumruy Pro', sans-serif; font-weight: 800; font-size: 1.1rem; margin-bottom: 10px; display: flex; align-items: center; gap: 8px; }
        .c360-sec-action-desc { font-family: 'Kantumruy Pro', sans-serif; font-size: 0.85rem; line-height: 1.5; margin-bottom: 15px; }

        @media (max-width: 900px) {
            .c360-security-layout { flex-direction: column; }
            .c360-security-left, .c360-security-right { width: 100% !important; }
        }
    </style>

    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; border-bottom: 2px solid var(--border); padding-bottom: 15px;">
        <h2 style="margin: 0; font-size: 1.4rem; color: var(--text-main); font-family: 'Kantumruy Pro'; font-weight: 800; display: flex; align-items: center; gap: 10px;">
            <i class="fa-solid fa-shield-halved" style="color: #3b82f6;"></i> សន្តិសុខ និងសុវត្ថិភាព (Security)
        </h2>
    </div>

    <!-- ផ្នែកខាងលើ៖ ចែកជា ២ ជួរ -->
    <div class="c360-security-layout" style="display: flex; gap: 25px; align-items: stretch; margin-bottom: 20px;">
        
        <!-- ជួរខាងឆ្វេង៖ ព័ត៌មានទូទៅ (Info Cards) -->
        <div class="c360-security-left" style="flex: 1; min-width: 0;">
            
            <!-- កាតស្ថានភាពគណនី -->
            <div class="c360-sec-card" style="background: #f8fafc; height: calc(100% - 20px);">
                <div class="c360-sec-card-header">
                    <i class="fa-solid fa-heart-pulse" style="color: #10b981;"></i> ស្ថានភាពគណនី (Account Health)
                </div>
                <div class="c360-sec-row">
                    <span class="c360-sec-label">ស្ថានភាព (Status)</span>
                    <span class="c360-sec-val">${freezeStatusHtml}</span>
                </div>
                <div class="c360-sec-row">
                    <span class="c360-sec-label">កំពុងប្រើប្រាស់ (Online)</span>
                    <span class="c360-sec-val">${onlineStatusHtml}</span>
                </div>
                <div class="c360-sec-row">
                    <span class="c360-sec-label">កម្រិតសុវត្ថិភាព (KYC Level)</span>
                    <span class="c360-sec-val">${kycLevelHtml}</span>
                </div>
                <div class="c360-sec-row">
                    <span class="c360-sec-label">វាយ PIN ខុស (Attempts)</span>
                    <span class="c360-sec-val">${pinStatusHtml}</span>
                </div>
                <div class="c360-sec-row">
                    <span class="c360-sec-label">វាយ Password ខុស (Attempts)</span>
                    <span class="c360-sec-val">${passwordStatusHtml}</span>
                </div>
                <div class="c360-sec-row">
                    <span class="c360-sec-label">ភ្ជាប់ Telegram</span>
                    <span class="c360-sec-val">${telegramHtml}</span>
                </div>
            </div>
        </div>

       <!-- ជួរខាងស្តាំ៖ សកម្មភាព (Action Cards) -->
        <div class="c360-security-right" style="flex: 1; min-width: 0;">
            
            <!-- កាតគ្រប់គ្រងគណនី (លឿង) -->
            <div class="c360-sec-action-card" style="background: #fffbeb; border-color: #fde68a; margin-bottom: 20px;">
                <div class="c360-sec-action-title" style="color: #d97706;">
                    <i class="fa-solid fa-sliders"></i> ការគ្រប់គ្រងគណនី
                </div>
                <p class="c360-sec-action-desc" style="color: #92400e;">
                    បើក ឬបិទសិទ្ធិប្រើប្រាស់គណនីបណ្តោះអាសន្ន។ អតិថិជននឹងមិនអាចធ្វើប្រតិបត្តិការបានទេ ពេលគណនីត្រូវផ្អាក។
                </p>
                ${freezeBtnHtml}
                
                <hr style="border: 0; border-top: 1px dashed #fcd34d; margin: 20px 0;">
                
                 <div class="c360-sec-action-title" style="color: #3b82f6;">
                    <i class="fa-solid fa-key"></i> កំណត់ពាក្យសម្ងាត់ថ្មី
                </div>
                <p class="c360-sec-action-desc" style="color: #92400e;">
                    ស្នើសុំកំណត់ពាក្យសម្ងាត់ ឬ PIN ថ្មី។ ប្រព័ន្ធនឹងផ្ញើ Link ទៅកាន់ Email អតិថិជន។
                </p>
                <!-- 🟢 បំបែកប៊ូតុង Reset ជាពីរ -->
                <div style="display: flex; gap: 10px;">
                    <button onclick="c360DirectRequestReset('Password', '${user.username}')" ${!hasEmail ? 'disabled title="អតិថិជនមិនទាន់មាន Email ទេ"' : ""} class="kh-text" style="flex: 1; padding: 12px; background: #3b82f6; color: white; border: none; border-radius: 8px; font-weight: bold; font-size: 0.95rem; cursor: pointer; transition: 0.2s; box-shadow: 0 4px 10px rgba(59, 130, 246, 0.3); display: flex; justify-content: center; align-items: center; gap: 8px; opacity: ${!hasEmail ? "0.5" : "1"};">
                        <i class="fa-solid fa-key"></i> Reset Password
                    </button>
                    <button onclick="c360DirectRequestReset('PIN', '${user.username}')" ${!hasEmail ? 'disabled title="អតិថិជនមិនទាន់មាន Email ទេ"' : ""} class="kh-text" style="flex: 1; padding: 12px; background: #8b5cf6; color: white; border: none; border-radius: 8px; font-weight: bold; font-size: 0.95rem; cursor: pointer; transition: 0.2s; box-shadow: 0 4px 10px rgba(139, 92, 246, 0.3); display: flex; justify-content: center; align-items: center; gap: 8px; opacity: ${!hasEmail ? "0.5" : "1"};">
                        <i class="fa-solid fa-th-large"></i> Reset PIN
                    </button>
                </div>
            </div>
            
        </div>
    </div>

    <!-- ផ្នែកកណ្តាល៖ ឧបករណ៍ភ្ជាប់ (Connected Devices Array) លាតពេញ -->
    <div class="c360-sec-card" style="background: #f8fafc; width: 100%;">
        <div class="c360-sec-card-header" style="margin-bottom: 20px;">
            <i class="fa-solid fa-network-wired" style="color: #8b5cf6;"></i> ឧបករណ៍ដែលបានភ្ជាប់ចុងក្រោយ (Connected Devices)
        </div>
        
        ${devicesHtml}
        
        <p class="kh-text" style="font-size: 0.85rem; color: #94a3b8; margin: 15px 0 0 0; text-align: center; display: flex; justify-content: center; align-items: center; gap: 8px;">
            <i class="fa-solid fa-circle-info"></i> ប្រព័ន្ធរក្សាទុកត្រឹម ៤ ឧបករណ៍ចុងក្រោយប៉ុណ្ណោះ។ 
        </p>
    </div>

    <!-- ផ្នែកខាងក្រោមបង្អស់៖ ភាពអាសន្ន (Emergency) លាតពេញ និងវែង -->
    <div class="c360-sec-action-card" style="background: #fef2f2; border-color: #fecaca; width: 100%; margin-top: 20px;">
        <div class="c360-sec-action-title" style="color: #ef4444;">
            <i class="fa-solid fa-triangle-exclamation"></i> ភាពអាសន្ន (Emergency)
        </div>
        <p class="c360-sec-action-desc" style="color: #991b1b; max-width: 800px;">
            ប្រសិនបើគណនីមានហានិភ័យ អ្នកអាចទាត់អតិថិជននេះចេញពីកម្មវិធីភ្លាមៗ (Force Logout) ពីគ្រប់ឧបករណ៍ទាំងអស់។ គាត់នឹងត្រូវតម្រូវឱ្យ Login ចូលម្តងទៀត។
        </p>
        <button onclick="c360ForceLogout('${user.username}')" class="kh-text" style="width: 100%; padding: 12px 24px; background: #ef4444; color: white; border: none; border-radius: 8px; font-weight: bold; font-size: 0.95rem; cursor: pointer; transition: 0.2s; box-shadow: 0 4px 10px rgba(239, 68, 68, 0.3); display: flex; justify-content: center; align-items: center; gap: 8px;">
            <i class="fa-solid fa-right-from-bracket"></i> ទាត់ចេញពីគណនី
        </button>
    </div>
  `;

  container.innerHTML = html;
}

// =======================================================
// 🟢 អនុគមន៍សកម្មភាពសុវត្ថិភាព (Security Actions)
// =======================================================

// ១. ផ្អាក / បើក គណនី (Toggle Freeze)
window.c360ToggleFreeze = async function (freezeAction) {
  const actionText = freezeAction ? "ផ្អាក" : "បើក";
  const color = freezeAction ? "#f59e0b" : "#10b981";

  const { isConfirmed } = await Swal.fire({
    title: `<span class="kh-text" style="color: ${color};">បញ្ជាក់ការ${actionText}គណនី</span>`,
    text: `តើអ្នកពិតជាចង់${actionText}គណនីរបស់ @${currentC360User.username} មែនទេ?`,
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: color,
    cancelButtonColor: "#64748b",
    confirmButtonText: "បាទ/ចាស",
    cancelButtonText: "បោះបង់",
    customClass: { popup: "premium-swal kh-text" },
  });

  if (isConfirmed) {
    Swal.fire({
      title: "កំពុងដំណើរការ...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
      customClass: { popup: "premium-swal" },
    });
    try {
      const res = await fetch("/api/admin/toggle-freeze", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          id: currentC360User._id || currentC360User.id,
          isFrozen: freezeAction,
        }),
      });
      const data = await res.json();
      if (data.success) {
        Swal.fire({
          icon: "success",
          title: "ជោគជ័យ!",
          text: `គណនីត្រូវបាន${actionText}រួចរាល់។`,
          timer: 1500,
          showConfirmButton: false,
          customClass: { popup: "premium-swal kh-text" },
        });
        c360RefreshData();
      } else {
        Swal.fire({
          icon: "error",
          title: "បរាជ័យ",
          text: data.message,
          customClass: { popup: "premium-swal" },
        });
      }
    } catch (e) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "មានបញ្ហា Server",
        customClass: { popup: "premium-swal" },
      });
    }
  }
};

// ២. ផ្ញើ Link កំណត់ Password/PIN ថ្មី
window.c360DirectRequestReset = async function (resetType, username) {
  if (!username || username === "undefined") {
    return Swal.fire("Error", "រកមិនឃើញទិន្នន័យអតិថិជនទេ!", "error");
  }

  Swal.fire({
    title: `កំពុងផ្ញើ Link Reset ${resetType}...`,
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading(),
    customClass: { popup: "premium-swal" },
  });

  try {
    const res = await fetch("/api/admin/request-reset", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        username: username,
        resetType: resetType,
      }),
    });
    const data = await res.json();
    if (data.success) {
      Swal.fire({
        icon: "success",
        title: "ជោគជ័យ!",
        text: `Link សម្រាប់កំណត់ ${resetType} ថ្មីបានផ្ញើទៅកាន់ Email អតិថិជនហើយ។ (ផុតកំណត់ក្នុងរយៈពេល ៥នាទី)`,
        customClass: { popup: "premium-swal kh-text" },
      });
    } else {
      Swal.fire({
        icon: "error",
        title: "បរាជ័យ",
        text: data.message,
        customClass: { popup: "premium-swal kh-text" },
      });
    }
  } catch (e) {
    Swal.fire({
      icon: "error",
      title: "Error",
      text: "មានបញ្ហា Server",
      customClass: { popup: "premium-swal" },
    });
  }
};

// ៣. ទាត់ចេញពីគណនី (Force Logout)
window.c360ForceLogout = async function (username) {
  if (!username || username === "undefined") {
    return Swal.fire("Error", "រកមិនឃើញទិន្នន័យអតិថិជនទេ!", "error");
  }

  const { value: remark } = await Swal.fire({
    title:
      '<span class="kh-text" style="font-size:1.4rem; color: #ef4444;">ទាត់ចេញ (Force Logout)</span>',
    html: `
        <p class="kh-text" style="font-size: 0.9rem; color: #64748b; margin-bottom: 15px;">តើអ្នកពិតជាចង់ទាត់អតិថិជន <b>@${username}</b> នេះចេញពីប្រព័ន្ធមែនទេ?</p>
        <div style="text-align: left; padding: 0 10px;">
            <label class="kh-text" style="font-size: 0.85rem; font-weight: 600; color: #64748b;">មូលហេតុ (Remark)</label>
            <input id="swal-logout-remark" class="swal2-input kh-text" placeholder="បញ្ជាក់មូលហេតុ..." style="width: 100%; margin: 5px 0 0; border: 1px solid #cbd5e1; border-radius: 8px;">
        </div>`,
    showCancelButton: true,
    confirmButtonText: '<span class="kh-text">យល់ព្រមទាត់ចេញ</span>',
    cancelButtonText: '<span class="kh-text">បោះបង់</span>',
    confirmButtonColor: "#ef4444",
    customClass: { popup: "modal-radius kh-text" },
    preConfirm: () => {
      const remark = document.getElementById("swal-logout-remark").value.trim();
      if (!remark) Swal.showValidationMessage("សូមបញ្ចូលមូលហេតុ!");
      return remark;
    },
  });

  if (remark) {
    Swal.fire({
      title: "កំពុងដំណើរការ...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
      customClass: { popup: "premium-swal" },
    });
    try {
      const res = await fetch("/api/admin/force-logout", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          username: username,
          reason: remark,
        }),
      });
      const data = await res.json();
      if (data.success) {
        await fetch("/api/admin/log-action", {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            action: "Force Logout",
            target: username,
            details: `បានទាត់អតិថិជនចេញពីប្រព័ន្ធ - មូលហេតុ: ${remark}`,
          }),
        });
        Swal.fire({
          icon: "success",
          title: "ជោគជ័យ!",
          text: "អតិថិជនត្រូវបានទាត់ចេញពីប្រព័ន្ធ។",
          timer: 1500,
          showConfirmButton: false,
          customClass: { popup: "premium-swal kh-text" },
        });
        c360RefreshData();
      } else {
        Swal.fire({
          icon: "error",
          title: "បរាជ័យ",
          text: data.message,
          customClass: { popup: "premium-swal kh-text" },
        });
      }
    } catch (e) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "មានបញ្ហា Server",
        customClass: { popup: "premium-swal kh-text" },
      });
    }
  }
};

// =======================================================
// 🏪 TAB 7: Merchant (Admin Pro View - Full Integrated)
// =======================================================
let c360CurrentMerchantId = null;
let c360MerchantTrxPage = 1;
const c360MerchantTrxPerPage = 4;
let c360CurrentMerchantsList = []; // អថេររក្សាទុកបញ្ជីហាងបណ្តោះអាសន្ន

async function renderMerchantTab(user) {
  const container = document.getElementById("c360-tab-merchant");
  if (!container) return;

  container.innerHTML = `<div style="text-align: center; padding: 50px;"><i class="fa-solid fa-spinner fa-spin" style="font-size: 2rem; color: var(--text-muted);"></i><br><br><span class="kh-text" style="color: var(--text-muted); font-size: 0.9rem;">កំពុងទាញយកទិន្នន័យហាង...</span></div>`;

  try {
    const res = await fetch(`/api/admin/merchants-by-user/${user.username}`, {
      headers: getAuthHeaders(),
    });
    const data = await res.json();

    let userMerchants = [];
    if (data.success && data.merchants) {
      userMerchants = data.merchants;
      c360CurrentMerchantsList = userMerchants;
    } else {
      c360CurrentMerchantsList = [];
    }

    // 🟢 ករណីគ្មានហាង
    if (userMerchants.length === 0) {
      container.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; background: var(--bg-card); border-radius: 16px; border: 1px dashed var(--border);">
                <div style="width: 80px; height: 80px; background: #f1f5f9; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 20px;">
                    <i class="fa-solid fa-store-slash" style="font-size: 2.5rem; color: #94a3b8;"></i>
                </div>
                <h3 class="kh-text" style="color: var(--text-main); margin: 0 0 10px; font-weight: 800;">អតិថិជននេះមិនទាន់មានអាជីវកម្មទេ</h3>
                <p class="kh-text" style="color: var(--text-muted); font-size: 0.95rem; margin-bottom: 25px; text-align: center; max-width: 400px;">អតិថិជននេះកំពុងប្រើប្រាស់គណនីជាទម្រង់បុគ្គល (Personal User) ប៉ុណ្ណោះ មិនទាន់បានចុះឈ្មោះហាងទទួលប្រាក់ទេ។</p>
                <button onclick="c360RegisterMerchant()" class="kh-text" style="padding: 12px 24px; background: var(--secondary); color: white; border: none; border-radius: 10px; font-size: 1rem; font-weight: bold; cursor: pointer; box-shadow: 0 4px 10px rgba(16, 185, 129, 0.2); transition: 0.2s;">
                    <i class="fa-solid fa-plus-circle"></i> ចុះឈ្មោះហាងឱ្យគាត់ (Add Shop)
                </button>
            </div>`;
      return;
    }

    if (
      !c360CurrentMerchantId ||
      !userMerchants.find((m) => m._id === c360CurrentMerchantId)
    ) {
      c360CurrentMerchantId = userMerchants[0]._id;
    }

    const m = userMerchants.find((m) => m._id === c360CurrentMerchantId);
    const isSuspended = m.status === "Suspended";

    // 🟢 ១. របារជ្រើសរើសសាខា (Branch Selector Pills)
    let branchSelectorHtml = `<div style="display: flex; gap: 10px; overflow-x: auto; padding-bottom: 10px; margin-bottom: 15px;">`;
    userMerchants.forEach((branch) => {
      const isActiveBranch = branch._id === c360CurrentMerchantId;
      const bg = isActiveBranch ? "var(--secondary)" : "var(--bg-body)";
      const color = isActiveBranch ? "white" : "var(--text-main)";
      const border = isActiveBranch ? "none" : "1px solid var(--border)";
      branchSelectorHtml += `
                <div onclick="c360CurrentMerchantId='${branch._id}'; c360MerchantTrxPage=1; renderMerchantTab(currentC360User);" 
                     class="kh-text" style="padding: 8px 16px; background: ${bg}; color: ${color}; border: ${border}; border-radius: 20px; font-size: 0.9rem; font-weight: bold; cursor: pointer; white-space: nowrap; transition: 0.2s;">
                    <i class="fa-solid fa-store"></i> ${branch.name}
                </div>`;
    });
    branchSelectorHtml += `
                <div onclick="c360RegisterMerchant()" class="kh-text" style="padding: 8px 16px; background: transparent; color: var(--secondary); border: 1px dashed var(--secondary); border-radius: 20px; font-size: 0.9rem; font-weight: bold; cursor: pointer; white-space: nowrap; transition: 0.2s;" title="បង្កើតសាខាថ្មី">
                    <i class="fa-solid fa-plus"></i> ថែមសាខា
                </div>
            </div>`;

    let balUSD =
      m.collected && m.collected.USD
        ? parseFloat(m.collected.USD).toFixed(2)
        : "0.00";
    let balKHR =
      m.collected && m.collected.KHR
        ? parseFloat(m.collected.KHR).toLocaleString()
        : "0";

    let hasUSD = !!m.linkedAccounts?.USD;
    let hasKHR = !!m.linkedAccounts?.KHR;

    // អនុគមន៍ជំនួយសម្រាប់ទាញយកឈ្មោះគណនី
    function getAccName(accNum) {
      if (!accNum) return "";
      if (currentC360User.mainAccounts?.USD?.accountNumber === accNum)
        return currentC360User.fullName || currentC360User.username;
      if (currentC360User.mainAccounts?.KHR?.accountNumber === accNum)
        return currentC360User.fullName || currentC360User.username;
      if (
        currentC360User.subAccounts &&
        currentC360User.subAccounts.length > 0
      ) {
        const sub = currentC360User.subAccounts.find(
          (s) => s.accountNumber === accNum,
        );
        if (sub) return sub.accountName;
      }
      return currentC360User.fullName || currentC360User.username;
    }

    const formatLinkedAcc = (accNum, iconClass) => {
      const accName = getAccName(accNum);
      return `
            <div style="display: flex; align-items: center; width: 100%; overflow: hidden; margin-bottom: 4px;">
                <i class="fa-solid ${iconClass}" style="color: #64748b; width: 18px; flex-shrink: 0;"></i>
                <span style="font-family: 'JetBrains Mono', monospace; font-weight: 700; color: var(--secondary); margin-right: 6px; flex-shrink: 0; font-size: 0.9rem;">${accNum}</span>
                <span style="color: var(--text-muted); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-family: 'Kantumruy Pro', sans-serif; font-size: 0.8rem; flex: 1;">- ${accName}</span>
            </div>`;
    };

    let linkedDescHtml = "";
    if (hasUSD && hasKHR) {
      linkedDescHtml =
        formatLinkedAcc(m.linkedAccounts.USD, "fa-dollar-sign") +
        formatLinkedAcc(m.linkedAccounts.KHR, "fa-r");
    } else if (hasUSD) {
      linkedDescHtml = formatLinkedAcc(m.linkedAccounts.USD, "fa-dollar-sign");
    } else if (hasKHR) {
      linkedDescHtml = formatLinkedAcc(m.linkedAccounts.KHR, "fa-r");
    } else {
      linkedDescHtml = `<span style="color: #ef4444; font-size: 0.85rem;">មិនមានគណនីភ្ជាប់</span>`;
    }

    const strAccountsStr = encodeURIComponent(
      JSON.stringify(m.accountNumbers || {}),
    );

    let html = `
        <h2 style="margin: 0 0 20px 0; font-size: 1.3rem; color: var(--text-main); font-family: 'Kantumruy Pro'; font-weight: 800; border-bottom: 2px solid var(--border); padding-bottom: 15px;">
            <i class="fa-solid fa-store" style="color: var(--secondary);"></i> គ្រប់គ្រងអាជីវកម្ម (Merchant)
        </h2>

        <div style="display: flex; flex-direction: column; gap: 15px;">
            
            ${branchSelectorHtml}

            <div style="display: flex; flex-wrap: wrap; gap: 15px;">
                
                <!-- ផ្នែកខាងឆ្វេង៖ ព័ត៌មានលម្អិត -->
                <div style="flex: 2; min-width: 300px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 20px; box-shadow: 0 4px 10px rgba(0,0,0,0.02);">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
                        <div style="display: flex; align-items: center; gap: 15px;">
                            <div style="width: 55px; height: 55px; background: #e0f2fe; color: #0284c7; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; border: 1px solid #bae6fd;">
                                <i class="fa-solid fa-shop"></i>
                            </div>
                            <div>
                                <h3 class="kh-text" style="margin: 0 0 5px; color: var(--text-main); font-size: 1.2rem; font-weight: 800;">${m.name}</h3>
                                <p class="kh-text" style="margin: 0; font-size: 0.85rem; color: var(--text-muted); font-family: monospace;">MID: ${m.merchantId} | ទីតាំង: ${m.city || "N/A"}</p>
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 0.7rem; color: var(--text-muted); margin-bottom: 3px; font-weight: bold;">${isSuspended ? "បានផ្អាក" : "ដំណើរការ"}</div>
                            <label class="switch" title="បិទ/បើកហាង">
                                <input type="checkbox" ${!isSuspended ? "checked" : ""} onchange="adminToggleMerchantFreeze('${m._id}', !this.checked);">
                                <span class="slider"></span>
                            </label>
                        </div>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px;">
                        <div style="background: var(--bg-body); padding: 10px 15px; border-radius: 10px; border: 1px solid var(--border);">
                            <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: bold; margin-bottom: 3px;">ប្រភេទអាជីវកម្ម (Category)</div>
                            <div class="kh-text" style="font-weight: 700; color: var(--text-main); font-size: 0.9rem;">${m.category || "N/A"}</div>
                        </div>
                        <div style="background: var(--bg-body); padding: 10px 15px; border-radius: 10px; border: 1px solid var(--border); display: flex; flex-direction: column; justify-content: center; overflow: hidden;">
                            <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: bold; margin-bottom: 3px;">គណនីទទួលប្រាក់ (Linked)</div>
                            <div style="width: 100%;">
                                ${linkedDescHtml}
                            </div>
                        </div>
                    </div>

                    <!-- ប៊ូតុងសកម្មភាព -->
                    <div style="display: flex; gap: 10px;">
                        <button onclick="editMerchantByAdmin('${m._id}')" class="kh-text" style="flex: 1; padding: 10px; background: white; color: #3b82f6; border: 1px solid #bfdbfe; border-radius: 8px; font-weight: bold; cursor: pointer; transition: 0.2s;"><i class="fa-solid fa-pen"></i> កែប្រែ</button>
                        <button onclick="c360ShowMerchantQR('${m.merchantId}', '${m.name}', '${strAccountsStr}')" class="kh-text" style="flex: 1; padding: 10px; background: white; color: #8b5cf6; border: 1px solid #ddd6fe; border-radius: 8px; font-weight: bold; cursor: pointer; transition: 0.2s;"><i class="fa-solid fa-qrcode"></i> QR Code</button>
                        <button onclick="deleteMerchantByAdmin('${m._id}')" class="kh-text" style="flex: 1; padding: 10px; background: #fef2f2; color: #ef4444; border: 1px solid #fecaca; border-radius: 8px; font-weight: bold; cursor: pointer; transition: 0.2s;"><i class="fa-solid fa-trash"></i> លុបហាង</button>
                    </div>
                </div>

                <!-- ផ្នែកខាងស្តាំ៖ ចំណូលសរុប -->
                <div style="flex: 1; min-width: 250px; background: linear-gradient(135deg, #004d40 0%, #059669 100%); border-radius: 16px; padding: 25px; color: white; display: flex; flex-direction: column; justify-content: center; position: relative; overflow: hidden; box-shadow: 0 10px 20px rgba(5, 150, 105, 0.2);">
                    <i class="fa-solid fa-chart-line" style="position: absolute; right: -20px; bottom: -20px; font-size: 8rem; opacity: 0.1;"></i>
                    <h4 class="kh-text" style="margin: 0 0 15px; font-size: 1rem; color: #d1fae5;"><i class="fa-solid fa-sack-dollar"></i> ចំណូលសរុប (Total Revenue)</h4>
                    <div style="font-size: 2.2rem; font-weight: 800; font-family: 'JetBrains Mono', monospace; line-height: 1; margin-bottom: 10px;">$${balUSD}</div>
                    <div style="font-size: 1.4rem; font-weight: 700; font-family: 'Inter', sans-serif; color: #a7f3d0;">៛${balKHR}</div>
                </div>
            </div>

            <!-- ៣. បញ្ជីប្រតិបត្តិការ និង Refund -->
            <div style="background: var(--bg-card); border-radius: 16px; padding: 20px; border: 1px solid var(--border);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <h4 class="kh-text" style="margin: 0; color: var(--text-main); font-size: 1.1rem; font-weight: 800;"><i class="fa-solid fa-receipt" style="color: var(--secondary);"></i> ប្រតិបត្តិការចូលហាងនេះ (Transactions)</h4>
                    <button onclick="c360MerchantTrxPage=1; c360FetchMerchantTransactions('${m._id}')" style="background: var(--bg-body); border: 1px solid var(--border); padding: 6px 12px; border-radius: 6px; color: var(--text-muted); cursor: pointer; font-family: 'Kantumruy Pro'; font-weight: bold;"><i class="fa-solid fa-rotate-right"></i> Refresh</button>
                </div>
                
                <div id="c360-merchant-trx-list" style="min-height: 250px;">
                    <div style="text-align: center; padding: 30px;"><i class="fa-solid fa-spinner fa-spin" style="font-size: 2rem; color: var(--text-muted);"></i></div>
                </div>

                <!-- 🟢 ប៊ូតុងបញ្ជាទំព័រ (Pagination) -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 15px; padding-top: 15px; border-top: 1px dashed var(--border);">
                    <button id="c360-btn-merch-prev" onclick="c360ChangeMerchantTrxPage(-1)" style="padding: 8px 15px; background: var(--bg-body); border: 1px solid var(--border); border-radius: 8px; color: var(--text-main); font-weight: bold; cursor: pointer; font-family: 'Kantumruy Pro';" disabled><i class="fa-solid fa-chevron-left"></i> ថយក្រោយ</button>
                    <span id="c360-merch-page-info" class="kh-text" style="font-weight: bold; color: var(--text-main);">ទំព័រ 1</span>
                    <button id="c360-btn-merch-next" onclick="c360ChangeMerchantTrxPage(1)" style="padding: 8px 15px; background: var(--bg-body); border: 1px solid var(--border); border-radius: 8px; color: var(--text-main); font-weight: bold; cursor: pointer; font-family: 'Kantumruy Pro';" disabled>បន្ទាប់ <i class="fa-solid fa-chevron-right"></i></button>
                </div>
            </div>
        </div>`;

    container.innerHTML = html;
    c360FetchMerchantTransactions(m._id);
  } catch (e) {
    console.error("Merchant Render Error:", e);
    container.innerHTML = `<div class="kh-text" style="text-align: center; padding: 40px; color: red;">មានបញ្ហាក្នុងការទាញទិន្នន័យហាងពី Server</div>`;
  }
}

// =======================================================
// 🟢 អនុគមន៍ជំនួយសម្រាប់ Tab Merchant (API Logic)
// =======================================================
let c360CachedMerchantTrx = [];

async function c360FetchMerchantTransactions(mid) {
  const listDiv = document.getElementById("c360-merchant-trx-list");
  listDiv.innerHTML = `<div style="text-align: center; padding: 30px;"><i class="fa-solid fa-spinner fa-spin" style="font-size: 2rem; color: var(--text-muted);"></i><br><br><span class="kh-text" style="font-size: 0.9rem; color: var(--text-muted);">កំពុងទាញយកប្រវត្តិ...</span></div>`;

  try {
    const res = await fetch(`/api/merchants/transactions/${mid}?filter=total`, {
      headers: getAuthHeaders(),
    });
    const data = await res.json();

    if (data.success && data.transactions && data.transactions.length > 0) {
      c360CachedMerchantTrx = data.transactions;
      c360RenderMerchantTrxPage();
    } else {
      c360CachedMerchantTrx = [];
      listDiv.innerHTML = `<div class="kh-text" style="text-align: center; color: var(--text-muted); padding: 40px; background: var(--bg-body); border-radius: 12px; border: 1px dashed var(--border);">មិនទាន់មានប្រតិបត្តិការនៅឡើយទេ</div>`;
      document.getElementById("c360-merch-page-info").innerText =
        "ទំព័រ 0 នៃ 0";
      document.getElementById("c360-btn-merch-prev").disabled = true;
      document.getElementById("c360-btn-merch-next").disabled = true;
    }
  } catch (error) {
    listDiv.innerHTML = `<div class="kh-text" style="text-align: center; color: #ef4444; padding: 20px;">បរាជ័យក្នុងការទាញយកប្រតិបត្តិការ</div>`;
  }
}

function c360ChangeMerchantTrxPage(step) {
  c360MerchantTrxPage += step;
  c360RenderMerchantTrxPage();
}

function c360RenderMerchantTrxPage() {
  const listDiv = document.getElementById("c360-merchant-trx-list");
  const totalPages = Math.ceil(
    c360CachedMerchantTrx.length / c360MerchantTrxPerPage,
  );

  if (c360MerchantTrxPage > totalPages) c360MerchantTrxPage = totalPages;
  if (c360MerchantTrxPage < 1) c360MerchantTrxPage = 1;

  const startIndex = (c360MerchantTrxPage - 1) * c360MerchantTrxPerPage;
  const endIndex = startIndex + c360MerchantTrxPerPage;
  const pageItems = c360CachedMerchantTrx.slice(startIndex, endIndex);

  listDiv.innerHTML = pageItems
    .map((t, idx) => {
      const globalIndex = startIndex + idx;
      const isIncome = t.amount > 0 || t.type === "Received";
      const color = isIncome ? "var(--secondary)" : "#ef4444";
      const sign = isIncome ? "+" : "";
      const curSym = t.currency === "USD" ? "$" : "៛";
      const displayAmt =
        t.currency === "USD"
          ? Math.abs(t.amount).toFixed(2)
          : Math.abs(t.amount).toLocaleString();

      let statusBadge = `<span style="color: #10b981; font-weight: bold;">🟢 Success</span>`;
      if (t.status === "Hold") {
        statusBadge = `<span style="color: #f59e0b; font-weight: bold;">🟠 Hold</span>`;
      } else if (t.status === "Refunded" || t.status === "Voided") {
        statusBadge = `<span style="color: #ef4444; font-weight: bold;">🔴 ${t.status}</span>`;
      }

      // 🌟 បង្ហាញប៊ូតុងដោះ Hold (Approve) និង Refund ពេល Status ជា "Hold"
      let refundBtnHtml = "";
      if (isIncome && t.status === "Hold") {
        refundBtnHtml = `
            <div style="display: flex; gap: 6px; justify-content: flex-end; align-items: center;">
                <button onclick="event.stopPropagation(); c360AdminReleaseHold('${t.refId}', '${Math.abs(t.amount)}', '${t.currency}')" class="kh-text" style="padding: 5px 10px; background: #ecfdf5; color: #10b981; border: 1px solid #a7f3d0; border-radius: 8px; font-size: 0.8rem; font-weight: bold; cursor: pointer; transition: 0.2s;" title="អនុម័តទម្លាក់ប្រាក់ភ្លាមៗ">
                    <i class="fa-solid fa-check"></i> Approve
                </button>
                <button onclick="event.stopPropagation(); c360AdminRefundTrx('${t.refId}', '${Math.abs(t.amount)}', '${t.currency}')" class="kh-text" style="padding: 5px 10px; background: #fee2e2; color: #ef4444; border: 1px solid #fca5a5; border-radius: 8px; font-size: 0.8rem; font-weight: bold; cursor: pointer; transition: 0.2s;" title="បង្វិលប្រាក់សងភ្ញៀវ">
                    <i class="fa-solid fa-rotate-left"></i> Refund
                </button>
            </div>`;
      } else if (t.status === "Success") {
        refundBtnHtml = `<span style="font-size: 0.75rem; color: #10b981; font-weight: bold; padding: 4px 8px; background: #ecfdf5; border-radius: 6px;"><i class="fa-solid fa-check-double"></i> Success</span>`;
      } else if (t.status === "Refunded") {
        refundBtnHtml = `<span style="font-size: 0.75rem; color: #94a3b8; font-weight: bold; padding: 4px 8px; background: var(--bg-body); border-radius: 6px;"><i class="fa-solid fa-check"></i> បាន Refund</span>`;
      }

      return `
        <div onclick="c360OpenMerchantTrxSlip(${globalIndex})" 
             style="display: flex; justify-content: space-between; align-items: center; padding: 15px; background: var(--bg-body); border: 1px solid var(--border); border-radius: 12px; margin-bottom: 10px; cursor: pointer; transition: 0.2s;" 
             onmouseover="this.style.borderColor='var(--secondary)'; this.style.transform='translateY(-2px)'" 
             onmouseout="this.style.borderColor='var(--border)'; this.style.transform='translateY(0)'"
             title="ចុចដើម្បីមើលវិក្កយបត្រ (View Slip)">
            <div style="display: flex; align-items: center; gap: 12px;">
                <div style="width: 45px; height: 45px; border-radius: 12px; background: ${isIncome ? "#ecfdf5" : "#fef2f2"}; color: ${color}; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; border: 1px solid ${isIncome ? "#a7f3d0" : "#fecaca"};">
                    <i class="fa-solid ${isIncome ? "fa-arrow-down" : "fa-arrow-up"}"></i>
                </div>
                <div>
                    <div class="kh-text" style="font-weight: 700; color: var(--text-main); font-size: 0.95rem;">${t.senderName || t.receiverName}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted); font-family: monospace; margin-top: 3px;">
                        Ref: ${t.refId} • ${t.date} • ${statusBadge}
                    </div>
                </div>
            </div>
            <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 6px;">
                <div style="font-weight: 800; color: ${t.status === "Refunded" ? "#94a3b8" : color}; font-family: 'JetBrains Mono', monospace; font-size: 1.1rem; text-decoration: ${t.status === "Refunded" ? "line-through" : "none"};">${sign}${curSym}${displayAmt}</div>
                ${refundBtnHtml}
            </div>
        </div>`;
    })
    .join("");

  document.getElementById("c360-merch-page-info").innerText =
    `ទំព័រ ${c360MerchantTrxPage} នៃ ${totalPages}`;
  document.getElementById("c360-btn-merch-prev").disabled =
    c360MerchantTrxPage === 1;
  document.getElementById("c360-btn-merch-next").disabled =
    c360MerchantTrxPage === totalPages;
}

// 🌟 ប្រើប្រាស់គំរូដូច Tab 4 (ហៅ c360ViewTrxDetails ដើម្បីបង្ហាញ Slip យ៉ាងស្អាត)
window.c360OpenMerchantTrxSlip = function (index) {
  const trx = c360CachedMerchantTrx[index];
  if (!trx) return;

  if (!currentC360User.transactions) currentC360User.transactions = [];

  let existIdx = currentC360User.transactions.findIndex(
    (t) => t.refId === trx.refId || t.hash === trx.hash,
  );
  if (existIdx === -1) {
    currentC360User.transactions.unshift(trx);
    existIdx = 0;
  }

  if (typeof c360ViewTrxDetails === "function") {
    c360ViewTrxDetails(existIdx);
  } else {
    Swal.fire(
      "Error",
      "មុខងារបង្ហាញ Slip (c360ViewTrxDetails) មិនមានទេ!",
      "error",
    );
  }
};

window.c360ShowMerchantQR = function (mid, name, strAccountsStr) {
  let accounts = {};
  try {
    accounts = JSON.parse(decodeURIComponent(strAccountsStr));
  } catch (e) {
    console.error("Parse Accounts Error", e);
  }

  let hasUSD = !!accounts.USD;
  let hasKHR = !!accounts.KHR;

  if (!hasUSD && !hasKHR) {
    return Swal.fire(
      "បញ្ជាក់",
      "ហាងនេះមិនទាន់មានគណនីភ្ជាប់ ដើម្បីបង្កើត QR Code ទេ!",
      "warning",
    );
  }

  let defaultAcc = hasUSD ? accounts.USD : accounts.KHR;
  let qrUrl = `https://quickchart.io/qr?text=${encodeURIComponent(defaultAcc)}&dark=004d40&size=400&margin=1`;

  let toggleOrBadgeHtml = "";
  if (hasUSD && hasKHR) {
    toggleOrBadgeHtml = `
            <div style="display: flex; background: #f1f5f9; border-radius: 14px; padding: 5px; margin-bottom: 25px; width: 100%; box-sizing: border-box;">
                <div id="c360-qr-btn-usd" onclick="document.getElementById('c360-dynamic-qr').src='https://quickchart.io/qr?text=${encodeURIComponent(accounts.USD)}&dark=004d40&size=400&margin=1'; document.getElementById('c360-qr-mid').innerText='${accounts.USD}'; this.classList.add('active'); this.nextElementSibling.classList.remove('active'); document.getElementById('c360-qr-mid').style.color='#004d40';" style="flex: 1; text-align: center; padding: 10px 0; font-size: 0.9rem; font-weight: 700; color: #64748b; border-radius: 10px; cursor: pointer; transition: 0.3s;" class="active">
                    USD ($)
                </div>
                <div id="c360-qr-btn-khr" onclick="document.getElementById('c360-dynamic-qr').src='https://quickchart.io/qr?text=${encodeURIComponent(accounts.KHR)}&dark=047857&size=400&margin=1'; document.getElementById('c360-qr-mid').innerText='${accounts.KHR}'; this.classList.add('active'); this.previousElementSibling.classList.remove('active'); document.getElementById('c360-qr-mid').style.color='#047857';" style="flex: 1; text-align: center; padding: 10px 0; font-size: 0.9rem; font-weight: 700; color: #64748b; border-radius: 10px; cursor: pointer; transition: 0.3s;">
                    KHR (៛)
                </div>
            </div>
        `;
  } else {
    const badgeColor = hasUSD ? "#004d40" : "#047857";
    const badgeText = hasUSD ? "USD ($)" : "KHR (៛)";
    toggleOrBadgeHtml = `
            <div style="margin-bottom: 25px; background: var(--bg-main); border: 1px solid var(--border-color); padding: 8px 15px; border-radius: 12px; color: ${badgeColor}; font-weight: 800; font-size: 0.95rem; display: flex; justify-content: center; align-items: center;">
                 ${badgeText}
            </div>
        `;
  }

  let initMidText = hasUSD ? accounts.USD : accounts.KHR;
  let initMidColor = hasUSD ? "#004d40" : "#047857";

  Swal.fire({
    title: `<span class="kh-text" style="color: var(--primary); font-size: 1.4rem;">QR Code ហាង</span>`,
    html: `
            <style>
                #c360-qr-btn-usd.active, #c360-qr-btn-khr.active {
                    background: white !important;
                    color: var(--primary) !important;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
                }
                .c360-qr-container {
                    background: white; width: 100%; max-width: 350px; padding: 30px 25px 25px; border-radius: 30px; box-shadow: 0 20px 40px -10px rgba(0, 77, 64, 0.1); text-align: center; box-sizing: border-box; margin: auto; border: 1px solid var(--border);
                }
            </style>
            
            <div class="c360-qr-container">
                ${toggleOrBadgeHtml}
                <img src="../images/logo-nobg.png" style="height: 40px; margin-bottom: 15px;" alt="U-Pay" onerror="this.style.display='none'">
                <h3 class="kh-text" style="margin: 0; font-size: 1.6rem; color: #1e293b; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px;">${name}</h3>
                <p style="color: #64748b; font-size: 1rem; margin: 8px 0 25px; font-weight: 500; font-family: monospace;">MID: ${mid}</p>
                <div style="background: #ffffff; padding: 15px; border-radius: 20px; display: flex; flex-direction: column; align-items: center; margin-bottom: 15px; border: 1px solid #e2e8f0; box-shadow: inset 0 2px 10px rgba(0, 0, 0, 0.02);">
                    <img id="c360-dynamic-qr" src="${qrUrl}" style="width: 100%; max-width: 220px; height: auto; display: block; border-radius: 12px; transition: 0.3s;">
                </div>
                <p id="c360-qr-mid" style="margin: 0 0 20px; font-family: 'JetBrains Mono', monospace; font-weight: 700; color: ${initMidColor}; font-size: 1.2rem; letter-spacing: 1.5px;">${initMidText}</p>
            </div>
            <p class="kh-text" style="font-size: 0.85rem; color: var(--text-muted); margin-top: 20px;">Admin អាចប្រើ QR នេះដើម្បីសាកល្បងស្កេនទូទាត់ប្រាក់ចូលហាងបាន។</p>
        `,
    showConfirmButton: true,
    confirmButtonText: "បិទផ្ទាំង (Close)",
    confirmButtonColor: "var(--primary)",
    customClass: { popup: "modal-radius kh-text premium-swal" },
  });
};

window.c360AdminRefundTrx = async function (refId, amount, currency) {
  const { value: reason } = await Swal.fire({
    title:
      '<span class="kh-text" style="color: #ef4444;">បញ្ជាក់ការបង្វិលប្រាក់ (Refund)</span>',
    html: `<p class="kh-text" style="font-size: 0.95rem; color: var(--text-muted); margin-bottom: 15px;">តើអ្នកពិតជាចង់បង្វិលប្រាក់ <b>${currency === "USD" ? "$" : "៛"}${Number(amount).toLocaleString()}</b> នេះត្រលប់ទៅគណនីដើមរបស់អតិថិជនវិញមែនទេ?</p>
               <input id="swal-refund-reason" class="swal2-input kh-text" placeholder="វាយបញ្ជាក់មូលហេតុនៅទីនេះ..." style="font-size: 0.95rem; border-radius: 10px; width: 85%; margin: 0 auto;">`,
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#ef4444",
    cancelButtonColor: "#64748b",
    confirmButtonText: "យល់ព្រមបង្វិលលុយសង",
    cancelButtonText: "បោះបង់",
    customClass: { popup: "modal-radius kh-text premium-swal" },
    preConfirm: () => {
      const r = document.getElementById("swal-refund-reason").value.trim();
      if (!r)
        Swal.showValidationMessage("អ្នកត្រូវតែបញ្ចូលមូលហេតុនៃការ Refund!");
      return r;
    },
  });

  if (reason) {
    Swal.fire({
      title: "កំពុងដំណើរការ...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
      customClass: { popup: "premium-swal" },
    });
    try {
      const res = await fetch("/api/admin/refund-transaction", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ refId: refId, reason: reason }),
      });
      const data = await res.json();
      if (data.success) {
        Swal.fire({
          icon: "success",
          title: "ជោគជ័យ!",
          text: data.message || "បានបង្វិលប្រាក់ត្រលប់ទៅអតិថិជនវិញរួចរាល់!",
          timer: 2000,
          showConfirmButton: false,
          customClass: { popup: "kh-text premium-swal" },
        });
        if (typeof c360RefreshData === "function") {
          c360RefreshData();
        } else {
          renderMerchantTab(currentC360User);
        }
      } else {
        Swal.fire({
          icon: "error",
          title: "បរាជ័យ",
          text: data.message,
          customClass: { popup: "kh-text premium-swal" },
        });
      }
    } catch (e) {
      Swal.fire("Error", "មានបញ្ហាភ្ជាប់ទៅកាន់ Server", "error");
    }
  }
};

window.adminToggleMerchantFreeze = async function (id, isFrozen) {
  try {
    const res = await fetch("/api/admin/toggle-merchant-freeze", {
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
        title: "ប្តូរស្ថានភាពហាងជោគជ័យ!",
        showConfirmButton: false,
        timer: 1500,
      });
    } else {
      Swal.fire("Error", data.message, "error");
      renderMerchantTab(currentC360User);
    }
  } catch (e) {
    Swal.fire("Error", "Server Error", "error");
    renderMerchantTab(currentC360User);
  }
};

window.deleteMerchantByAdmin = async function (id) {
  Swal.fire({
    title: "តើអ្នកប្រាកដទេ?",
    text: "ទិន្នន័យហាងនេះនឹងត្រូវលុបចោលទាំងស្រុងពីប្រព័ន្ធ!",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#ef4444",
    cancelButtonColor: "#64748b",
    confirmButtonText: "បាទ/ចាស, លុប!",
    cancelButtonText: "បោះបង់",
    customClass: { popup: "premium-swal kh-text" },
  }).then(async (result) => {
    if (result.isConfirmed) {
      Swal.fire({
        title: "កំពុងដំណើរការ...",
        didOpen: () => Swal.showLoading(),
      });
      try {
        const response = await fetch(`/api/admin/delete-merchant/${id}`, {
          method: "POST",
          headers: getAuthHeaders(),
        });
        const data = await response.json();
        if (data.success) {
          Swal.fire({
            icon: "success",
            title: "លុបរួចរាល់",
            timer: 1500,
            showConfirmButton: false,
          });
          c360CurrentMerchantId = null;
          c360RefreshData();
        } else {
          Swal.fire("Error", data.message, "error");
        }
      } catch (err) {
        Swal.fire("Error", "មានបញ្ហាបច្ចេកទេស", "error");
      }
    }
  });
};

window.editMerchantByAdmin = async function (id) {
  const mData = c360CurrentMerchantsList.find(
    (m) => m._id === id || m.id === id,
  );
  if (!mData) return Swal.fire("Error", "រកទិន្នន័យហាងមិនឃើញទេ!", "error");

  let usdOptions = `<option value="">-- មិនភ្ជាប់ (None) --</option>`;
  let khrOptions = `<option value="">-- មិនភ្ជាប់ (None) --</option>`;

  if (currentC360User.mainAccounts?.USD) {
    let isSelected =
      mData.linkedAccounts?.USD ===
      currentC360User.mainAccounts.USD.accountNumber
        ? "selected"
        : "";
    usdOptions += `<option value="${currentC360User.mainAccounts.USD.accountNumber}" ${isSelected}>គណនីចម្បង USD (${currentC360User.mainAccounts.USD.accountNumber})</option>`;
  }
  if (currentC360User.mainAccounts?.KHR) {
    let isSelected =
      mData.linkedAccounts?.KHR ===
      currentC360User.mainAccounts.KHR.accountNumber
        ? "selected"
        : "";
    khrOptions += `<option value="${currentC360User.mainAccounts.KHR.accountNumber}" ${isSelected}>គណនីចម្បង KHR (${currentC360User.mainAccounts.KHR.accountNumber})</option>`;
  }

  if (currentC360User.subAccounts && currentC360User.subAccounts.length > 0) {
    currentC360User.subAccounts.forEach((sub) => {
      if (sub.accountType !== "junior") {
        let typeLabel =
          sub.accountType === "joint" || sub.accountType === "joint_member"
            ? "[Joint]"
            : "[Sub]";
        if (sub.currency === "USD") {
          let isSelected =
            mData.linkedAccounts?.USD === sub.accountNumber ? "selected" : "";
          usdOptions += `<option value="${sub.accountNumber}" ${isSelected}>${typeLabel} ${sub.accountName} (${sub.accountNumber})</option>`;
        } else {
          let isSelected =
            mData.linkedAccounts?.KHR === sub.accountNumber ? "selected" : "";
          khrOptions += `<option value="${sub.accountNumber}" ${isSelected}>${typeLabel} ${sub.accountName} (${sub.accountNumber})</option>`;
        }
      }
    });
  }

  const { value: formValues } = await Swal.fire({
    title:
      '<h3 style="margin:0 0 10px 0; color: #0f172a; font-size: 1.25rem; font-weight: 700;">⚙️ កែប្រែព័ត៌មានហាង</h3>',
    html: `
        <div style="text-align: left; display: flex; flex-direction: column; gap: 14px; padding: 5px 10px;">
          <div><label style="display: block; font-weight: 600; font-size: 0.85rem; color: #475569; margin-bottom: 6px;">ឈ្មោះហាងថ្មី (Shop Name)</label><input id="swal-edit-mname" class="swal2-input" value="${mData.name}" style="margin: 0; width: 100%; box-sizing: border-box; border-radius: 10px; border: 1px solid #cbd5e1; font-size: 0.95rem; padding: 10px 14px; font-family: 'Kantumruy Pro';"></div>
          
          <div><label style="display: block; font-weight: 600; font-size: 0.85rem; color: #475569; margin-bottom: 6px;">ប្រភេទអាជីវកម្ម (Category)</label>
             <select id="swal-edit-mcat" class="swal2-select" style="margin: 0; width: 100%; box-sizing: border-box; border-radius: 10px; border: 1px solid #cbd5e1; font-size: 0.95rem; padding: 10px 14px; font-family: 'Kantumruy Pro'; background: #fff;">
                  <option value="Food & Beverage" ${mData.category === "Food & Beverage" ? "selected" : ""}>ម្ហូបអាហារ និងភេសជ្ជៈ</option>
                  <option value="Health & Beauty" ${mData.category === "Health & Beauty" ? "selected" : ""}>សម្រស់ និងសុខភាព</option>
                  <option value="Transportation" ${mData.category === "Transportation" ? "selected" : ""}>ដឹកជញ្ជូន</option>
                  <option value="Fashion & Shopping" ${mData.category === "Fashion & Shopping" ? "selected" : ""}>សំលៀកបំពាក់ & ទំនិញ</option>
                  <option value="Service & Cleaning" ${mData.category === "Service & Cleaning" ? "selected" : ""}>សេវាកម្ម</option>
                  <option value="Education" ${mData.category === "Education" ? "selected" : ""}>ការអប់រំ និងបណ្ណាល័យ</option>
                  <option value="Entertainment" ${mData.category === "Entertainment" ? "selected" : ""}>កម្សាន្ត និងទេសចរណ៍</option>
                  <option value="Finance & Insurance" ${mData.category === "Finance & Insurance" ? "selected" : ""}>ហិរញ្ញវត្ថុ និងធានារ៉ាប់រង</option>
                  <option value="Utilities" ${mData.category === "Utilities" ? "selected" : ""}>ទឹកភ្លើង និងសេវាសាធារណៈ</option>
                  <option value="Others" ${mData.category === "Others" ? "selected" : ""}>ផ្សេងៗ</option>
              </select>
          </div>
          
          <div style="background: #f8fafc; padding: 10px; border-radius: 10px; border: 1px solid #e2e8f0;">
              <label class="kh-text" style="font-size:0.85rem; font-weight:bold; color: #334155; margin-bottom: 5px; display: block;">ប្តូរគណនីទទួលប្រាក់ (USD)</label>
              <select id="swal-edit-linked-usd" class="swal2-select kh-text" style="width:100%; margin: 0 0 10px 0; background: white; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.9rem; padding: 5px 10px;">
                  ${usdOptions}
              </select>

              <label class="kh-text" style="font-size:0.85rem; font-weight:bold; color: #334155; margin-bottom: 5px; display: block;">ប្តូរគណនីទទួលប្រាក់ (KHR)</label>
              <select id="swal-edit-linked-khr" class="swal2-select kh-text" style="width:100%; margin: 0; background: white; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.9rem; padding: 5px 10px;">
                  ${khrOptions}
              </select>
          </div>
        </div>`,
    width: "500px",
    showCancelButton: true,
    confirmButtonText: "រក្សាទុកការផ្លាស់ប្តូរ",
    cancelButtonText: "បោះបង់",
    confirmButtonColor: "#004d40",
    customClass: { popup: "kh-text premium-swal" },
    preConfirm: () => {
      const newName = document.getElementById("swal-edit-mname").value.trim();
      const linkedAccUSD = document.getElementById(
        "swal-edit-linked-usd",
      ).value;
      const linkedAccKHR = document.getElementById(
        "swal-edit-linked-khr",
      ).value;

      if (!newName) {
        Swal.showValidationMessage("សូមបញ្ចូលឈ្មោះហាង!");
        return false;
      }
      if (!linkedAccUSD && !linkedAccKHR) {
        Swal.showValidationMessage("សូមជ្រើសរើសគណនីទទួលប្រាក់យ៉ាងហោចណាស់មួយ!");
        return false;
      }

      return {
        name: newName,
        category: document.getElementById("swal-edit-mcat").value,
        linkedAccUSD: linkedAccUSD,
        linkedAccKHR: linkedAccKHR,
      };
    },
  });

  if (formValues && formValues.name) {
    try {
      Swal.fire({
        title: "កំពុងរក្សាទុក...",
        didOpen: () => Swal.showLoading(),
      });
      const res = await fetch(`/api/admin/edit-merchant`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          id: mData._id || mData.id,
          name: formValues.name,
          category: formValues.category,
          linkedAccount:
            formValues.linkedAccUSD && formValues.linkedAccKHR
              ? "BOTH"
              : formValues.linkedAccUSD
                ? "USD"
                : "KHR",
          linkedAccUSD: formValues.linkedAccUSD,
          linkedAccKHR: formValues.linkedAccKHR,
          merchantId: mData.merchantId,
          username: currentC360User.username,
        }),
      });
      const data = await res.json();
      if (data.success) {
        Swal.fire({
          toast: true,
          position: "top-end",
          icon: "success",
          title: "បានកែប្រែជោគជ័យ",
          showConfirmButton: false,
          timer: 1500,
        });
        c360RefreshData();
      } else throw new Error(data.message);
    } catch (e) {
      Swal.fire("Error", e.message, "error");
    }
  }
};

window.c360RegisterMerchant = async function () {
  if (!currentC360User)
    return Swal.fire("Error", "សូមជ្រើសរើសអតិថិជនជាមុនសិន", "error");

  let usdOptions = `<option value="">-- មិនភ្ជាប់ (None) --</option>`;
  let khrOptions = `<option value="">-- មិនភ្ជាប់ (None) --</option>`;

  if (currentC360User.mainAccounts?.USD) {
    usdOptions += `<option value="${currentC360User.mainAccounts.USD.accountNumber}">គណនីចម្បង USD (${currentC360User.mainAccounts.USD.accountNumber})</option>`;
  }
  if (currentC360User.mainAccounts?.KHR) {
    khrOptions += `<option value="${currentC360User.mainAccounts.KHR.accountNumber}">គណនីចម្បង KHR (${currentC360User.mainAccounts.KHR.accountNumber})</option>`;
  }

  if (currentC360User.subAccounts && currentC360User.subAccounts.length > 0) {
    currentC360User.subAccounts.forEach((sub) => {
      if (sub.accountType !== "junior") {
        let typeLabel =
          sub.accountType === "joint" || sub.accountType === "joint_member"
            ? "[Joint]"
            : "[Sub]";
        let opt = `<option value="${sub.accountNumber}">${typeLabel} ${sub.accountName} (${sub.accountNumber})</option>`;
        if (sub.currency === "USD") usdOptions += opt;
        else khrOptions += opt;
      }
    });
  }

  const { value: formValues } = await Swal.fire({
    title:
      '<h3 style="margin: 0; color: var(--secondary); font-size: 1.5rem; font-weight: 800;"><i class="fa-solid fa-store"></i> បង្កើតហាងថ្មី (Admin)</h3>',
    html: `
          <div style="text-align: left; margin-top: 15px; display: flex; flex-direction: column; gap: 15px;">
              <div style="background: var(--bg-body); padding: 15px; border-radius: 12px; border: 1px solid var(--border);">
                  <label class="kh-text" style="font-size:0.85rem; font-weight:bold; color:var(--text-muted); margin-bottom: 5px; display: block;">ឈ្មោះហាង (Shop Name) <span style="color:red">*</span></label>
                  <input id="m-name" class="swal2-input kh-text" placeholder="ឧ. Smart Shop" style="width:100%; margin: 0; background: white; border: 1px solid #cbd5e1; border-radius: 8px;">
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 15px;">
                      <div>
                          <label class="kh-text" style="font-size:0.85rem; font-weight:bold; color:var(--text-muted); margin-bottom: 5px; display: block;">ទីក្រុង / ខេត្ត</label>
                          <input id="m-city" class="swal2-input kh-text" placeholder="ឧ. Phnom Penh" value="Phnom Penh" style="width:100%; margin: 0; background: white; border: 1px solid #cbd5e1; border-radius: 8px;">
                      </div>
                      <div>
                          <label class="kh-text" style="font-size:0.85rem; font-weight:bold; color:var(--text-muted); margin-bottom: 5px; display: block;">ប្រភេទអាជីវកម្ម</label>
                          <select id="m-category" class="swal2-select kh-text" style="width:100%; margin: 0; background: white; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.95rem; padding: 0 10px;">
                              <option value="Food & Beverage">ម្ហូបអាហារ និងភេសជ្ជៈ</option>
                              <option value="Health & Beauty">សម្រស់ និងសុខភាព</option>
                              <option value="Transportation">ដឹកជញ្ជូន</option>
                              <option value="Fashion & Shopping">សំលៀកបំពាក់ & ទំនិញ</option>
                              <option value="Service & Cleaning">សេវាកម្ម</option>
                              <option value="Others">ផ្សេងៗ</option>
                          </select>
                      </div>
                  </div>
              </div>
              <div style="background: #f0fdfa; padding: 15px; border-radius: 12px; border: 1px dashed #5eead4;">
                  <h4 class="kh-text" style="margin: 0 0 10px; color: #0f766e; font-size: 0.95rem;"><i class="fa-solid fa-link"></i> ជ្រើសរើសគណនីទទួលប្រាក់</h4>
                  <label class="kh-text" style="font-size:0.85rem; font-weight:bold; color: #0f766e; margin-bottom: 5px; display: block;">គណនីទទួលប្រាក់ដុល្លារ (USD)</label>
                  <select id="m-linked-usd" class="swal2-select kh-text" style="width:100%; margin: 0 0 10px 0; background: white; border: 1px solid #99f6e4; border-radius: 8px; font-size: 0.95rem; padding: 0 10px;">
                      ${usdOptions}
                  </select>
                  <label class="kh-text" style="font-size:0.85rem; font-weight:bold; color: #0f766e; margin-bottom: 5px; display: block;">គណនីទទួលប្រាក់រៀល (KHR)</label>
                  <select id="m-linked-khr" class="swal2-select kh-text" style="width:100%; margin: 0; background: white; border: 1px solid #99f6e4; border-radius: 8px; font-size: 0.95rem; padding: 0 10px;">
                      ${khrOptions}
                  </select>
              </div>
          </div>`,
    width: "550px",
    showCancelButton: true,
    confirmButtonText: '<i class="fa-solid fa-plus-circle"></i> បង្កើតហាង',
    cancelButtonText: "បោះបង់",
    confirmButtonColor: "var(--secondary)",
    customClass: { popup: "modal-radius premium-swal kh-text" },
    preConfirm: () => {
      const name = document.getElementById("m-name").value.trim();
      const linkedAccUSD = document.getElementById("m-linked-usd").value;
      const linkedAccKHR = document.getElementById("m-linked-khr").value;

      if (!name) {
        Swal.showValidationMessage("សូមបញ្ចូលឈ្មោះហាង!");
        return false;
      }
      if (!linkedAccUSD && !linkedAccKHR) {
        Swal.showValidationMessage("សូមជ្រើសរើសគណនីទទួលប្រាក់យ៉ាងហោចណាស់មួយ!");
        return false;
      }

      return {
        name: name,
        city: document.getElementById("m-city").value,
        category: document.getElementById("m-category").value,
        linkedAccUSD: linkedAccUSD,
        linkedAccKHR: linkedAccKHR,
      };
    },
  });

  if (formValues && formValues.name) {
    Swal.fire({
      title: "កំពុងបង្កើតហាងថ្មី...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
      customClass: { popup: "premium-swal kh-text" },
    });
    try {
      const response = await fetch("/api/admin/create-merchant", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          username: currentC360User.username,
          ...formValues,
        }),
      });
      const data = await response.json();
      if (data.success) {
        Swal.fire({
          icon: "success",
          title: "ជោគជ័យ!",
          text: "បានបង្កើតហាងរួចរាល់។",
          timer: 1500,
          showConfirmButton: false,
          customClass: { popup: "premium-swal kh-text" },
        });
        c360CurrentMerchantId = data.merchant._id;
        c360RefreshData();
      } else {
        Swal.fire({
          icon: "error",
          title: "បរាជ័យ",
          text: data.message,
          customClass: { popup: "premium-swal kh-text" },
        });
      }
    } catch (e) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "បញ្ហា Server",
        customClass: { popup: "premium-swal kh-text" },
      });
    }
  }
};

// 🟢 មុខងារ Admin ចុចដោះ Hold (Approve Trx) ឱ្យហាងភ្លាមៗ
window.c360AdminReleaseHold = async function (refId, amount, currency) {
  const { isConfirmed } = await Swal.fire({
    title:
      '<span class="kh-text" style="color: #10b981;">អនុម័តទម្លាក់ប្រាក់ (Release Hold)</span>',
    html: `<p class="kh-text" style="font-size: 0.95rem; color: var(--text-muted); margin-bottom: 15px;">តើអ្នកពិតជាចង់អនុម័តទម្លាក់ទឹកប្រាក់ <b>${currency === "USD" ? "$" : "៛"}${Number(amount).toLocaleString()}</b> ចូលទៅក្នុងហាងនេះភ្លាមៗមែនទេ?</p>`,
    icon: "question",
    showCancelButton: true,
    confirmButtonColor: "#10b981",
    cancelButtonColor: "#64748b",
    confirmButtonText: "បាទ/ចាស អនុម័ត",
    cancelButtonText: "បោះបង់",
    customClass: { popup: "modal-radius kh-text premium-swal" },
  });

  if (isConfirmed) {
    Swal.fire({
      title: "កំពុងដំណើរការ...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
      customClass: { popup: "premium-swal" },
    });
    try {
      const res = await fetch("/api/admin/release-merchant-hold", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ refId: refId }),
      });
      const data = await res.json();
      if (data.success) {
        Swal.fire({
          icon: "success",
          title: "ជោគជ័យ!",
          text: data.message,
          timer: 2000,
          showConfirmButton: false,
          customClass: { popup: "kh-text premium-swal" },
        });
        if (typeof c360RefreshData === "function") {
          c360RefreshData();
        } else {
          renderMerchantTab(currentC360User);
        }
      } else {
        Swal.fire({
          icon: "error",
          title: "បរាជ័យ",
          text: data.message,
          customClass: { popup: "kh-text premium-swal" },
        });
      }
    } catch (e) {
      Swal.fire("Error", "មានបញ្ហាភ្ជាប់ទៅកាន់ Server", "error");
    }
  }
};

// ➡️ TAB 8: Admin Logs
async function renderLogsTab(user) {
  const container = document.getElementById("c360-tab-logs");
  if (!container) return;
  container.innerHTML = `<div style="text-align:center; padding: 40px;"><i class="fa-solid fa-circle-notch fa-spin fa-2x" style="color:var(--text-muted);"></i><br><br>កំពុងទាញយកកំណត់ត្រា...</div>`;

  try {
    const res = await fetch("/api/admin/logs", { headers: getAuthHeaders() });
    const data = await res.json();
    if (data.success) {
      const userLogs = data.logs.filter((l) => l.target === user.username);
      if (userLogs.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding: 40px; color: var(--text-muted);">គ្មានកំណត់ត្រា Admin កែប្រែលើគណនីនេះទេ។</div>`;
        return;
      }
      let html = `<table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
        <thead><tr style="background:var(--bg-body); text-align:left;">
            <th style="padding:12px; border-bottom: 1px solid var(--border);">កាលបរិច្ឆេទ (Date)</th>
            <th style="padding:12px; border-bottom: 1px solid var(--border);">Admin អ្នកកែប្រែ</th>
            <th style="padding:12px; border-bottom: 1px solid var(--border);">សកម្មភាព (Action)</th>
            <th style="padding:12px; border-bottom: 1px solid var(--border);">ព័ត៌មានលម្អិត</th>
        </tr></thead><tbody>`;

      userLogs.forEach((l) => {
        html += `
          <tr style="border-bottom: 1px solid var(--border);">
              <td style="padding:12px; color:var(--text-muted);">${l.date}</td>
              <td style="padding:12px; font-weight:bold; color: var(--text-main);">${l.admin}</td>
              <td style="padding:12px; color:var(--accent); font-weight: 600;">${l.action}</td>
              <td style="padding:12px; color: var(--text-main);">${l.details}</td>
          </tr>`;
      });
      container.innerHTML = html + `</tbody></table>`;
    }
  } catch (e) {
    container.innerHTML =
      '<div style="text-align:center; padding: 40px; color: red;">បរាជ័យក្នុងការភ្ជាប់ទៅកាន់ Server API សម្រាប់ Logs</div>';
  }
}

// =======================================================
// 📸 មុខងារចុចប្តូររូប Profile នៅក្នុង Customer 360°
// =======================================================
window.c360ChangeProfileImage = async function () {
  if (!currentC360User) return;

  // បង្កើត Input File លាក់មួយដើម្បីឱ្យ Admin ជ្រើសរើសរូបភាព
  let fileInput = document.getElementById("c360-profile-file-input");
  if (!fileInput) {
    fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.id = "c360-profile-file-input";
    fileInput.accept = "image/*";
    fileInput.style.display = "none";
    document.body.appendChild(fileInput);
  }

  // ពេល Admin រើសរូបភាពរួចរាល់
  fileInput.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      Swal.fire("បរាជ័យ", "ទំហំរូបភាពធំពេក! សូមជ្រើសរើសរូបតូចជាង 3MB", "error");
      e.target.value = "";
      return;
    }

    Swal.fire({
      title: "កំពុងបញ្ជូនរូបភាព...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
      customClass: { popup: "premium-swal" },
    });

    const CLOUD_NAME = "jp9yg3dj"; // Cloud Name របស់អ្នក
    const UPLOAD_PRESET = "iaxuqmpb"; // Upload Preset របស់អ្នក
    const cloudinaryData = new FormData();
    cloudinaryData.append("file", file);
    cloudinaryData.append("upload_preset", UPLOAD_PRESET);

    try {
      // 1. បាញ់រូបទៅ Cloudinary
      const cloudRes = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
        {
          method: "POST",
          body: cloudinaryData,
        },
      );
      const cloudData = await cloudRes.json();

      if (cloudData.secure_url) {
        // 2. ផ្ញើ URL ទៅកាន់ Backend ដើម្បី Update Profile
        const res = await fetch("/api/admin/edit-user", {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            id: currentC360User._id || currentC360User.id,
            profileImage: cloudData.secure_url, // Update តែរូបភាព
          }),
        });

        const d = await res.json();

        if (d.success) {
          // Update រូបភាពនៅលើ UI ភ្លាមៗ
          document.getElementById("c360-avatar").src = cloudData.secure_url;
          currentC360User.profileImage = cloudData.secure_url;

          Swal.fire({
            icon: "success",
            title: "ជោគជ័យ",
            text: "ផ្លាស់ប្តូររូបភាព Profile អតិថិជនរួចរាល់!",
            timer: 1500,
            showConfirmButton: false,
            customClass: { popup: "premium-swal" },
          });

          // Refresh ទិន្នន័យក្នុងតារាង User Management បើវាមាន
          if (typeof loadData === "function") loadData();
        } else {
          Swal.fire("បរាជ័យ", d.message, "error");
        }
      } else {
        Swal.fire("បរាជ័យ", "មិនអាច Upload ទៅ Cloudinary បានទេ", "error");
      }
    } catch (err) {
      Swal.fire("Error", "មានបញ្ហាភ្ជាប់ទៅកាន់ Server", "error");
    }

    e.target.value = ""; // Clear input វិញ
  };

  fileInput.click(); // បញ្ជាឱ្យបើកផ្ទាំងរើសរូបភាព
};

// =======================================================
// ❄️ មុខងារបិទ/បើកគណនី (Freeze/Unfreeze) ក្នុង Customer 360°
// =======================================================
window.c360ToggleFreeze = async function () {
  if (!currentC360User) return;

  const newFreezeState = !currentC360User.isFrozen;
  const actionText = newFreezeState ? "ផ្អាក (Freeze)" : "ដោះសោរ (Unfreeze)";
  const actionColor = newFreezeState ? "#ef4444" : "#10b981";

  Swal.fire({
    title: "បញ្ជាក់ការផ្លាស់ប្តូរ",
    text: `តើអ្នកពិតជាចង់ ${actionText} គណនីអតិថិជននេះមែនទេ?`,
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: actionColor,
    cancelButtonColor: "#64748b",
    confirmButtonText: "យល់ព្រម",
    cancelButtonText: "បោះបង់",
    customClass: { popup: "premium-swal kh-text" },
  }).then(async (result) => {
    if (result.isConfirmed) {
      Swal.fire({
        title: "កំពុងដំណើរការ...",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
        customClass: { popup: "premium-swal" },
      });

      try {
        const res = await fetch("/api/admin/toggle-freeze", {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            id: currentC360User._id || currentC360User.id,
            isFrozen: newFreezeState,
          }),
        });

        const data = await res.json();

        if (data.success) {
          Swal.fire({
            icon: "success",
            title: "ជោគជ័យ",
            text: `គណនីត្រូវបាន ${actionText} រួចរាល់!`,
            timer: 1500,
            showConfirmButton: false,
            customClass: { popup: "premium-swal" },
          });

          // Refresh ផ្ទាំង Customer 360° ឡើងវិញ ដើម្បីអោយពណ៌ប៊ូតុង និង Status លោតត្រូវ
          c360RefreshData();

          // Update ទិន្នន័យក្នុងតារាងធំ User Management អោយត្រូវគ្នា
          if (typeof loadData === "function") loadData();
        } else {
          Swal.fire(
            "បរាជ័យ",
            data.message || "មិនអាចប្តូរស្ថានភាពបានទេ",
            "error",
          );
        }
      } catch (e) {
        Swal.fire("Error", "មានបញ្ហាភ្ជាប់ទៅកាន់ Server", "error");
      }
    }
  });
};
