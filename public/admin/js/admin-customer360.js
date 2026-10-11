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

    // 🟢 ១.១ ស្វែងរកក្នុង Local Data មុនដើម្បីទាញយកត្រឹម Username (លឿនរហ័ស)
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

    // 🟢 ១.២ បើរកឃើញ Username ក្នុង Local យើងបាញ់ API យក Full Profile ថ្មីៗពី Server (ដើម្បីបាន Referrer Name និង លុយថ្មីៗ)
    if (foundUsername) {
      const res = await fetch("/api/admin/get-user", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ username: foundUsername }),
      });
      const data = await res.json();
      if (data.success && data.user) {
        finalUser = data.user;
      }
    }

    // 🟡 ១.៣ Fallback: បើ Local រកអត់ឃើញសោះ ទើបបាញ់ API ស្វែងរក (Search API) ផ្ទាល់តែម្តង
    if (!finalUser) {
      const res = await fetch("/api/admin/search-user", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ searchTerm: term }),
      });
      const data = await res.json();
      if (data.success && data.user) {
        finalUser = data.user;
      }
    }

    Swal.close();

    if (finalUser) {
      currentC360User = finalUser;

      // Update ទិន្នន័យចូល Global Array ដើម្បីអោយ Cache មានទិន្នន័យថ្មី (រួមទាំង Referrer Name)
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
    Swal.fire({
      icon: "error",
      title: "បរាជ័យ",
      text: "មានបញ្ហាក្នុងការភ្ជាប់ទៅកាន់ Server",
      customClass: { popup: "premium-swal" },
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
    const data = await res.json();

    if (data.success && data.user) {
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
    } else {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "រកមិនឃើញទិន្នន័យថ្មីទេ",
        customClass: { popup: "premium-swal" },
      });
    }
  } catch (e) {
    Swal.fire({
      icon: "error",
      title: "Error",
      text: "បញ្ហាភ្ជាប់ទៅកាន់ Server",
      customClass: { popup: "premium-swal" },
    });
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

            <!-- ៥. ប៊ូតុង Freeze/Unfreeze -->
            <div class="c360-data-box" style="padding: 0; background: transparent; border: none; display: flex; align-items: center;">
                <button onclick="c360ToggleFreeze()" style="width: 100%; padding: 12px; border-radius: 8px; font-family: 'Kantumruy Pro'; font-weight: bold; font-size: 1rem; cursor: pointer; transition: 0.2s; ${freezeBtnStyle}">
                    ${freezeBtnText}
                </button>
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
// ➡️ TAB 3: គ្រប់គ្រងកាត (Virtual Cards Management)
// =======================================================
function renderCardsTab(user) {
  const container = document.getElementById("c360-tab-cards");
  if (!container) return;

  let headerHtml = `
    <div style="margin-bottom: 25px;">
        <button class="btn-primary kh-text" style="width: 100%; padding: 18px; font-size: 1.1rem; background: var(--primary); border-radius: 15px; box-shadow: 0 8px 15px rgba(0,0,0,0.1); display: flex; align-items: center; justify-content: center; gap: 10px; transition: 0.2s;" onclick="c360CreateCardForUser()">
            <i class="fa-solid fa-plus-circle" style="font-size: 1.3rem;"></i> បង្កើតកាតថ្មីឱ្យអតិថិជន
        </button>
    </div>`;

  if (!user.virtualCards || user.virtualCards.length === 0) {
    container.innerHTML =
      headerHtml +
      `<div style="text-align:center; padding: 40px; color: var(--text-muted); font-size: 1.1rem;" class="kh-text">
        <i class="fa-regular fa-credit-card" style="font-size: 4rem; opacity: 0.5; margin-bottom: 15px; display: block;"></i>
        អតិថិជននេះមិនទាន់មានកាត (Virtual Card) នៅឡើយទេ។
      </div>`;
    return;
  }

  let stylesHtml = `
    <style>
      .admin-cards-slider {
        display: flex; overflow-x: auto; padding-bottom: 15px; gap: 20px;
        scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch;
      }
      .admin-cards-slider::-webkit-scrollbar { height: 6px; }
      .admin-cards-slider::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
      .admin-card-wrapper {
        flex: 0 0 340px; scroll-snap-align: start; display: flex; flex-direction: column; gap: 15px;
      }
      
      /* 🔥 3D Flip Effects */
      .card-perspective { perspective: 1000px; width: 100%; height: 215px; z-index: 10; cursor: pointer; }
      .card-inner { position: relative; width: 100%; height: 100%; transition: transform 0.8s cubic-bezier(0.4, 0.2, 0.2, 1); transform-style: preserve-3d; border-radius: 20px; box-shadow: 0 15px 30px rgba(0,0,0,0.15); }
      .card-inner.flipped { transform: rotateY(180deg); }
      .u-card-front, .u-card-back {
        position: absolute; width: 100%; height: 100%; -webkit-backface-visibility: hidden; backface-visibility: hidden;
        border-radius: 20px; box-sizing: border-box; color: #fff; overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.15);
      }
      .u-card-front { padding: 25px; display: flex; flex-direction: column; justify-content: space-between; }
      .u-card-back { transform: rotateY(180deg); padding: 0; display: flex; flex-direction: column; }
      
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

      .u-chip {
        width: 45px; height: 32px; background: linear-gradient(135deg, #e5e7eb, #94a3b8);
        border-radius: 6px; box-shadow: inset 0 0 5px rgba(0, 0, 0, 0.3);
      }
      .theme-standard .u-chip, .theme-metal .u-chip, .theme-eco .u-chip {
        background: linear-gradient(135deg, #fde047, #d97706);
      }
      .u-nfc { font-size: 1.4rem; color: rgba(255,255,255,0.8); transform: rotate(90deg); margin-left: 10px; }
      
      .u-locked-overlay {
        position: absolute; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(3px) grayscale(80%);
        display: flex; align-items: center; justify-content: center; z-index: 20;
      }
      .u-locked-text {
        font-size: 1.8rem; font-weight: 900; color: #fff; letter-spacing: 4px;
        border: 3px solid #fff; padding: 10px 20px; border-radius: 8px; transform: rotate(-15deg);
      }
      .cvv-box { background: #fff; color: #000; padding: 4px 12px; border-radius: 4px; font-family: 'Courier New', monospace; font-weight: bold; font-size: 1.1rem; letter-spacing: 2px; }
    </style>
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

  let cardsHtml = `<div class="admin-cards-slider">`;

  user.virtualCards.forEach((c) => {
    let themeClass = getThemeClass(c.type);
    let isRealNFC = c.isPhysical || (c.uid && c.uid !== "");
    let nfcIconHtml = isRealNFC ? `<i class="fa-solid fa-wifi u-nfc"></i>` : ``;
    let isLocked = c.isLocked;

    let customBgStyle = "";
    if (c.type === "custom" && c.customBgUrl) {
      customBgStyle = `style="background: linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.85)), url('${c.customBgUrl}') center/cover no-repeat !important;"`;
    }

    let cardNameDisplay =
      c.name && c.name.trim() !== ""
        ? c.name
        : c.type
          ? c.type.replace("-", " ").toUpperCase()
          : "STANDARD";

    cardsHtml += `
      <div class="admin-card-wrapper">
        <div class="card-perspective">
          <div class="card-inner ${themeClass}" id="cardInner_${c.id}">
            
            <!-- 💳 FRONT CARD -->
            <div class="u-card-front" ${customBgStyle}>
                ${isLocked ? `<div class="u-locked-overlay"><div class="u-locked-text">FROZEN</div></div>` : ""}
                <div style="display: flex; justify-content: space-between; align-items: flex-start; z-index: 2;">
                    <div style="display: flex; align-items: center;">
                        <div class="u-chip"></div>
                        ${nfcIconHtml}
                    </div>
                    <img src="../images/logo-nobg.png" style="height: 35px; filter: brightness(0) invert(1); opacity: 0.9;" onerror="this.style.display='none'">
                </div>
                
                <div id="c360-cardnum-${c.id}" style="font-family: 'Courier New', monospace; font-size: 1.15rem; letter-spacing: 1.5px; font-weight: bold; text-shadow: 0 2px 4px rgba(0,0,0,0.4); z-index: 2; margin-top: auto; margin-bottom: auto; white-space: nowrap;">
                    **** **** **** ${c.number.slice(-4)}
                </div>
                
                <div style="display: flex; justify-content: space-between; align-items: flex-end; z-index: 2;">
                    <div style="flex: 1.2;">
                        <div style="font-size: 0.6rem; opacity: 0.8; letter-spacing: 1px; margin-bottom: 2px;">CARD HOLDER</div>
                        <div style="font-size: 0.95rem; font-weight: 600; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${user.fullName || user.username}</div>
                    </div>
                    <div style="flex: 0.8; text-align: center;">
                        <div style="font-size: 0.6rem; opacity: 0.8; letter-spacing: 1px; margin-bottom: 2px;">EXPIRES</div>
                        <div id="c360-cardexp-${c.id}" style="font-size: 0.95rem; font-weight: 600;">**/**</div>
                    </div>
                    <div style="flex: 1.5; font-family: 'Inter', sans-serif; font-weight: 800; font-size: 1rem; text-transform: uppercase; text-align: right; text-shadow: 0 1px 2px rgba(0,0,0,0.5); opacity: 0.95; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        ${cardNameDisplay}
                    </div>
                </div>
            </div>

            <!-- 💳 BACK CARD -->
            <div class="u-card-back" ${customBgStyle}>
                ${isLocked ? `<div class="u-locked-overlay"><div class="u-locked-text">FROZEN</div></div>` : ""}
                <div style="width: 100%; height: 40px; background: #111; margin-top: 20px;"></div>
                <div style="padding: 15px 25px 5px; display: flex; justify-content: space-between; align-items: flex-start;">
                    <div style="font-size: 0.65rem; color: rgba(255, 255, 255, 0.95); max-width: 55%; line-height: 1.6;">
                        <span style="font-weight: 800;">AUTHORIZED SIGNATURE</span><br>
                        This card is issued by U-Pay PLC.
                    </div>
                    <div style="display: flex; flex-direction: column; align-items: center; z-index: 5;">
                        <span style="font-size: 0.7rem; color: #fff; font-weight: bold; margin-bottom: 3px;">CVV</span>
                        <div id="c360-cardcvv-${c.id}" class="cvv-box">***</div>
                    </div>
                </div>
                <div style="padding: 0 25px 15px; margin-top: auto; text-align: right;">
                    <img src="../images/logo-nobg.png" style="height: 30px; filter: brightness(0) invert(1);" onerror="this.style.display='none'">
                </div>
            </div>

          </div>
        </div>
        
        <div style="background: var(--bg-card); border: 1px solid var(--border); padding: 12px 15px; border-radius: 12px; font-size: 0.85rem; display: flex; justify-content: space-between; align-items: center;">
            <div style="color: var(--text-main); font-weight: 600;">
               <i class="fa-solid fa-gauge-high" style="color: #d97706; margin-right: 5px;"></i> Limit: $${c.dailyLimit || 500}
            </div>
            <div style="color: var(--text-main); font-weight: 600;">
               <i class="fa-solid fa-globe" style="color: #059669; margin-right: 5px;"></i> Online: ${c.isOnlinePayEnabled !== false ? '<span style="color:#10b981;">ON</span>' : '<span style="color:#ef4444;">OFF</span>'}
            </div>
        </div>

        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
            <button onclick="c360RevealCard('${c.id}')" class="kh-text" style="flex: 1; padding: 10px; border-radius: 10px; border: none; background: var(--accent); color: white; font-weight: 600; cursor: pointer; transition: 0.2s;">
                <i class="fa-solid fa-eye"></i> មើល
            </button>
            <button onclick="document.getElementById('cardInner_${c.id}').classList.toggle('flipped')" class="kh-text" style="flex: 1; padding: 10px; border-radius: 10px; border: none; background: #3b82f6; color: white; font-weight: 600; cursor: pointer; transition: 0.2s;">
                <i class="fa-solid fa-arrows-rotate"></i> ត្រឡប់
            </button>
            <button onclick="c360ToggleCard('${c.id}', ${!isLocked})" class="kh-text" style="flex: 1; padding: 10px; border-radius: 10px; border: none; background: ${isLocked ? "var(--secondary)" : "#ef4444"}; color: white; font-weight: 600; cursor: pointer; transition: 0.2s;">
                <i class="fa-solid ${isLocked ? "fa-unlock" : "fa-lock"}"></i> ${isLocked ? "បើក" : "បិទ"}
            </button>
            <button onclick="c360DeleteCard('${c.id}')" class="kh-text" style="width: 100%; padding: 10px; border-radius: 10px; border: none; background: var(--bg-body); color: #ef4444; font-weight: 600; cursor: pointer; transition: 0.2s; border: 1px solid var(--border);">
                <i class="fa-solid fa-trash"></i> លុបកាតចោល
            </button>
        </div>

      </div>`;
  });

  cardsHtml += `</div>`;
  container.innerHTML = stylesHtml + headerHtml + cardsHtml;
}

// =======================================================
// 🟢 បង្កើតកាតថ្មី (បូកបញ្ចូលតម្លៃ Dynamic Price)
// =======================================================
async function c360CreateCardForUser() {
  const cardTiers = [
    {
      id: "standard",
      name: "Standard",
      price: 2.0,
      styleClass: "theme-standard",
    },
    {
      id: "fifa",
      name: "FIFA World Cup",
      price: 10.0,
      styleClass: "theme-fifa",
    },
    { id: "metal", name: "Metal Gold", price: 15.0, styleClass: "theme-metal" },
    {
      id: "celebrity",
      name: "BTS Edition",
      price: 10.0,
      styleClass: "theme-celebrity",
    },
    {
      id: "anime",
      name: "Naruto Edition",
      price: 8.0,
      styleClass: "theme-anime",
    },
    { id: "gamer", name: "Gamer Pro", price: 8.0, styleClass: "theme-gamer" },
    { id: "eco", name: "Eco Green", price: 3.0, styleClass: "theme-eco" },
    {
      id: "platinum",
      name: "Platinum Premium",
      price: 25.0,
      styleClass: "theme-platinum",
    },
    {
      id: "animal",
      name: "Animal Edition",
      price: 8.0,
      styleClass: "theme-animal",
    },
    {
      id: "custom",
      name: "Custom VIP",
      price: 25.0,
      styleClass: "theme-custom",
    },
  ];

  let gridHtml = cardTiers
    .map((t, index) => {
      return `
      <label style="cursor:pointer;">
        <input type="radio" name="swal-card-type" value="${t.id}" data-price="${t.price}" ${index === 0 ? "checked" : ""} style="display:none;" 
          onchange="document.querySelectorAll('.admin-tier-option').forEach(el=>el.classList.remove('selected')); this.nextElementSibling.classList.add('selected'); document.getElementById('adminCustomBgBox').style.display = (this.value==='custom') ? 'block' : 'none'; document.getElementById('swal-price-display').innerText = '$' + this.getAttribute('data-price');">
        <div class="admin-tier-option ${index === 0 ? "selected" : ""}" style="border: 2px solid var(--border); border-radius: 12px; padding: 10px; text-align: center; transition: 0.2s; background: var(--bg-body);">
            <div class="${t.styleClass}" style="width: 100%; height: 50px; border-radius: 8px; margin-bottom: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);"></div>
            <div class="kh-text" style="font-size: 0.8rem; font-weight: 600; color: var(--text-main); line-height: 1.2;">${t.name}</div>
            <div style="font-size: 0.75rem; color: #ef4444; font-weight: bold; margin-top: 5px;">$${t.price.toFixed(2)}</div>
        </div>
      </label>
    `;
    })
    .join("");

  const { value: formResult } = await Swal.fire({
    title:
      '<span class="kh-text" style="font-size:1.4rem;">បង្កើតកាតថ្មី</span>',
    html: `
      <style>
        .admin-tier-option.selected { border-color: var(--secondary) !important; background: rgba(16, 185, 129, 0.05) !important; }
      </style>
      <div style="text-align: left; margin-top: 15px;">
          <label class="kh-text" style="font-size: 0.85rem; font-weight: bold; color: var(--text-muted); margin-bottom: 8px; display: block;">ជ្រើសរើសប្រភេទកាត (Design)</label>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; max-height: 300px; overflow-y: auto; padding-right: 5px; margin-bottom: 15px;">
              ${gridHtml}
          </div>
          
          <div id="adminCustomBgBox" style="display: none; margin-bottom: 15px;">
              <label class="kh-text" style="font-size: 0.85rem; font-weight: bold; color: var(--text-muted);">បញ្ចូល Link រូបភាព (សម្រាប់កាត Custom)</label>
              <input id="swal-custom-url" type="text" class="swal2-input" placeholder="https://image.com/myphoto.jpg" style="width: 100%; margin: 5px 0 0; background: var(--bg-body); color: var(--text-main); font-size: 0.9rem;">
          </div>

          <div style="background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); border-radius: 10px; padding: 12px; margin-bottom: 15px; text-align: center;">
              <span class="kh-text" style="color: #ef4444; font-size: 0.9rem; font-weight: bold;">ថ្លៃសេវាកាត់ពីគណនីអតិថិជន៖ </span>
              <span id="swal-price-display" style="color: #ef4444; font-size: 1.1rem; font-weight: 900;">$2.00</span>
          </div>

          <label class="kh-text" style="font-size: 0.85rem; font-weight: bold; color: var(--text-muted);">ចំណាំ (Remark)</label>
          <input id="swal-card-remark" class="swal2-input kh-text" placeholder="មូលហេតុ (ឧ. បង្កើតជំនួសអតិថិជន)" style="width: 100%; margin: 5px 0 0; background: var(--bg-body); color: var(--text-main);">
      </div>`,
    showCancelButton: true,
    confirmButtonText: '<span class="kh-text">កាត់លុយ & បង្កើត</span>',
    cancelButtonText: '<span class="kh-text">បោះបង់</span>',
    confirmButtonColor: "var(--secondary)",
    customClass: { popup: "modal-radius" },
    preConfirm: () => {
      const radio = document.querySelector(
        'input[name="swal-card-type"]:checked',
      );
      const cardType = radio.value;
      const customBgUrl = document
        .getElementById("swal-custom-url")
        .value.trim();
      const remark =
        document.getElementById("swal-card-remark").value.trim() ||
        "Admin បង្កើតកាតជំនួស";

      if (cardType === "custom" && !customBgUrl) {
        Swal.showValidationMessage("សូមបញ្ចូល Link រូបភាពសម្រាប់កាត Custom!");
        return false;
      }
      return { cardType, customBgUrl, remark };
    },
  });

  if (formResult) {
    Swal.fire({
      title: "កំពុងកាត់ប្រាក់ និងបង្កើតកាត...",
      didOpen: () => Swal.showLoading(),
      customClass: { popup: "premium-swal" },
    });
    try {
      const res = await fetch("/api/admin/create-card", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          username: currentC360User.username,
          cardType: formResult.cardType,
          customBgUrl: formResult.customBgUrl,
          remark: formResult.remark,
        }),
      });
      const data = await res.json();
      if (data.success) {
        Swal.fire({
          icon: "success",
          title: "ជោគជ័យ!",
          text: "កាត់លុយ និងបង្កើតកាតរួចរាល់។",
          timer: 2000,
          showConfirmButton: false,
          customClass: { popup: "premium-swal" },
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
}

// =======================================================
// 👀 មុខងារបង្ហាញលេខកាត, ថ្ងៃផុតកំណត់, និង CVV
// =======================================================
async function c360RevealCard(cardId) {
  const card = currentC360User.virtualCards.find((c) => c.id === cardId);
  const numEl = document.getElementById(`c360-cardnum-${cardId}`);

  // បើកំពុងបង្ហាញស្រាប់ ចុចម្ដងទៀតដើម្បីលាក់វិញ
  if (numEl.innerText.includes(card.number.slice(0, 4))) {
    numEl.innerText = `**** **** **** ${card.number.slice(-4)}`;
    document.getElementById(`c360-cardexp-${cardId}`).innerText = "**/**";
    document.getElementById(`c360-cardcvv-${cardId}`).innerText = "***";
    return;
  }

  const { value: remark } = await Swal.fire({
    title:
      '<span class="kh-text" style="font-size:1.4rem;">មើលព័ត៌មានកាតសម្ងាត់</span>',
    html: `
      <div style="text-align: left; padding: 10px;">
          <label class="kh-text" style="font-size: 0.85rem; font-weight: 600; color: var(--text-muted);">មូលហេតុ (Remark)</label>
          <input id="swal-reveal-remark" class="swal2-input kh-text" placeholder="បញ្ចូលមូលហេតុ..." style="width: 100%; margin: 5px 0 0; background: var(--bg-body); color: var(--text-main); border: 1px solid var(--border);">
      </div>`,
    showCancelButton: true,
    confirmButtonText: '<span class="kh-text">បញ្ជាក់ (Confirm)</span>',
    cancelButtonText: '<span class="kh-text">បោះបង់</span>',
    confirmButtonColor: "var(--accent)",
    customClass: { popup: "modal-radius" },
    preConfirm: () => {
      const r = document.getElementById("swal-reveal-remark").value.trim();
      if (!r) Swal.showValidationMessage("សូមបញ្ចូលមូលហេតុ!");
      return r;
    },
  });

  if (remark) {
    try {
      await fetch("/api/admin/log-action", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          action: "Viewed Card Details",
          target: currentC360User.username,
          details: `មើលលេខកាត *${card.number.slice(-4)} - មូលហេតុ: ${remark}`,
        }),
      });

      // បង្ហាញលេខទាំង ៣ កន្លែង
      document.getElementById(`c360-cardnum-${cardId}`).innerText = card.number
        .match(/.{1,4}/g)
        .join(" ");
      document.getElementById(`c360-cardexp-${cardId}`).innerText =
        card.expiryDate || card.expiry || "12/28";
      document.getElementById(`c360-cardcvv-${cardId}`).innerText = card.cvv;

      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "បានបញ្ចេញព័ត៌មានកាត!",
        showConfirmButton: false,
        timer: 1500,
        customClass: { popup: "premium-swal" },
      });
    } catch (e) {}
  }
}

// (ហៅ API ពី admin-ops.js)
async function c360ToggleCard(cardId, isLocked) {
  if (typeof toggleCardLock === "function")
    toggleCardLock(currentC360User.username, cardId, !isLocked);
  // setTimeout ចាំឱ្យ Server Update រួច ទើបហៅ Refresh
  setTimeout(() => c360RefreshData(), 1500);
}

async function c360DeleteCard(cardId) {
  const { value: remark } = await Swal.fire({
    title:
      '<span class="kh-text" style="font-size:1.4rem; color: #ef4444;">លុបកាតនេះចោល?</span>',
    html: `<input id="swal-del-remark" class="swal2-input kh-text" placeholder="មូលហេតុលុបកាត..." style="width: 100%; background: var(--bg-body); color: var(--text-main); border: 1px solid var(--border);">`,
    showCancelButton: true,
    confirmButtonText: '<span class="kh-text">លុបចោល (Delete)</span>',
    confirmButtonColor: "#ef4444",
    customClass: { popup: "modal-radius" },
    preConfirm: () => document.getElementById("swal-del-remark").value.trim(),
  });

  if (remark) {
    Swal.fire({
      title: "កំពុងលុប...",
      didOpen: () => Swal.showLoading(),
      customClass: { popup: "premium-swal" },
    });
    try {
      const res = await fetch("/api/admin/delete-card", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          username: currentC360User.username,
          cardId,
          reason: remark,
        }),
      });
      const data = await res.json();
      if (data.success) {
        await fetch("/api/admin/log-action", {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            action: "Deleted Card",
            target: currentC360User.username,
            details: `លុបកាតចោល - មូលហេតុ: ${remark}`,
          }),
        });
        Swal.fire({
          icon: "success",
          title: "ជោគជ័យ!",
          text: "លុបកាតរួចរាល់។",
          timer: 1500,
          showConfirmButton: false,
          customClass: { popup: "premium-swal" },
        });
        c360RefreshData();
      } else
        Swal.fire({
          icon: "error",
          title: "បរាជ័យ",
          text: data.message,
          customClass: { popup: "premium-swal" },
        });
    } catch (e) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "មានបញ្ហា Server",
        customClass: { popup: "premium-swal" },
      });
    }
  }
}

// =======================================================
// 🪪 TAB 4: KYC & Identity
// =======================================================
function renderKycTab(user) {
  const container = document.getElementById("c360-tab-kyc");
  if (!container) return;
  const status = user.kycStatus || "unverified";

  // ✅ FIX: ថែម user.kycDocument ព្រោះក្នុង Model (User.js) ឈ្មោះវា kycDocument
  const imgUrl = user.kycDocument || user.kycImage || user.idCardImage || "";

  let content = "";

  if (
    !imgUrl ||
    status === "unverified" ||
    status === "rejected" ||
    status === "revoked"
  ) {
    content = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; max-width: 500px; margin: 0 auto; gap: 20px; padding: 20px 0;">
          <div style="text-align: center; color: var(--text-muted);" class="kh-text">
              <i class="fa-solid fa-id-card-clip" style="font-size: 4.5rem; color: #cbd5e1; margin-bottom: 15px;"></i>
              <h3 style="color: var(--text-main); margin: 0 0 10px 0;">អតិថិជនមិនទាន់មានឯកសារ KYC ទេ</h3>
              <p style="font-size: 0.9rem; margin: 0;">អ្នកអាចជួយបញ្ចូលឯកសារជំនួសអតិថិជនទីនេះ</p>
          </div>
          <label style="border: 2px dashed var(--secondary); border-radius: 18px; padding: 40px 20px; text-align: center; cursor: pointer; width: 100%; background: rgba(16, 185, 129, 0.05); transition: 0.2s;">
              <input type="file" style="display: none;" accept="image/*" onchange="c360AdminUploadKyc(event)">
              <i class="fa-solid fa-cloud-arrow-up" style="font-size: 2.5rem; color: var(--secondary); margin-bottom: 10px;"></i>
              <div class="kh-text" style="color: var(--secondary); font-weight: bold; font-size: 1.1rem;">ចុចទីនេះដើម្បី Upload ឯកសារ KYC</div>
          </label>
      </div>`;
  } else {
    const isVerified = status === "verified" || status === "approved";
    let buttonsHtml = "";

    if (isVerified) {
      buttonsHtml = `
        <button onclick="if(typeof kycAction === 'function') { kycAction('${user.username}', 'revoke'); setTimeout(c360RefreshData, 1500); }" class="kh-text" style="width: 100%; padding: 15px; background: #ef4444; color: white; border: none; border-radius: 12px; font-weight: bold; font-size: 1.1rem; cursor: pointer; transition: 0.2s; box-shadow: 0 4px 10px rgba(239, 68, 68, 0.2); display: flex; justify-content: center; align-items: center; gap: 10px;">
            <i class="fa-solid fa-ban"></i> បដិសេធសិទ្ធិវិញ (Revoke KYC)
        </button>`;
    } else {
      buttonsHtml = `
        <button onclick="if(typeof kycAction === 'function') { kycAction('${user.username}', 'approved'); setTimeout(c360RefreshData, 1500); }" class="kh-text" style="flex: 1; padding: 15px; background: var(--secondary); color: white; border: none; border-radius: 12px; font-weight: bold; font-size: 1.1rem; cursor: pointer; transition: 0.2s; box-shadow: 0 4px 10px rgba(16, 185, 129, 0.2); display: flex; justify-content: center; align-items: center; gap: 10px;">
            <i class="fa-solid fa-check-circle"></i> អនុម័ត (Approve)
        </button>
        <button onclick="if(typeof kycAction === 'function') { kycAction('${user.username}', 'rejected'); setTimeout(c360RefreshData, 1500); }" class="kh-text" style="flex: 1; padding: 15px; background: #ef4444; color: white; border: none; border-radius: 12px; font-weight: bold; font-size: 1.1rem; cursor: pointer; transition: 0.2s; box-shadow: 0 4px 10px rgba(239, 68, 68, 0.2); display: flex; justify-content: center; align-items: center; gap: 10px;">
            <i class="fa-solid fa-times-circle"></i> បដិសេធ (Reject)
        </button>`;
    }

    let statusBadge = isVerified
      ? `<div style="position: absolute; top: 12px; left: 12px; background: rgba(16, 185, 129, 0.9); color: white; padding: 5px 12px; border-radius: 8px; font-size: 0.8rem; font-weight: bold; box-shadow: 0 2px 5px rgba(0,0,0,0.2); backdrop-filter: blur(4px);" class="kh-text"><i class="fa-solid fa-check-circle"></i> បានអនុម័តរួច</div>`
      : `<div style="position: absolute; top: 12px; left: 12px; background: rgba(245, 158, 11, 0.9); color: white; padding: 5px 12px; border-radius: 8px; font-size: 0.8rem; font-weight: bold; box-shadow: 0 2px 5px rgba(0,0,0,0.2); backdrop-filter: blur(4px);" class="kh-text"><i class="fa-solid fa-clock"></i> រង់ចាំការអនុម័ត</div>`;

    content = `
      <div style="display: flex; flex-direction: column; align-items: center; width: 100%; max-width: 500px; margin: 0 auto; gap: 20px;">
          <h4 class="kh-text" style="margin: 0; color: var(--text-muted); width: 100%; text-align: left;">ឯកសារអត្តសញ្ញាណប័ណ្ណ / លិខិតឆ្លងដែន</h4>
          <div style="width: 100%; border-radius: 15px; overflow: hidden; box-shadow: 0 10px 20px rgba(0,0,0,0.1); cursor: pointer; position: relative; border: 2px solid var(--border); aspect-ratio: 1.6/1; background: #000;" 
               onclick="if(typeof viewKycDocument === 'function') viewKycDocument('${imgUrl}')" title="ចុចដើម្បីពង្រីកមើលឱ្យច្បាស់">
              <img src="${imgUrl}" style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s; opacity: 0.9;" 
                   onmouseover="this.style.transform='scale(1.05)'; this.style.opacity='1'" 
                   onmouseout="this.style.transform='scale(1)'; this.style.opacity='0.9'">
              ${statusBadge}
              <div style="position: absolute; bottom: 12px; right: 12px; background: rgba(0,0,0,0.7); color: white; padding: 6px 12px; border-radius: 20px; font-size: 0.8rem; pointer-events: none; backdrop-filter: blur(4px);" class="kh-text">
                  <i class="fa-solid fa-magnifying-glass-plus"></i> ចុចពង្រីក
              </div>
          </div>
          <div style="display: flex; gap: 15px; width: 100%;">
              ${buttonsHtml}
          </div>
      </div>`;
  }
  container.innerHTML = content;
}

// =======================================================
// ☁️ កន្លែងទី២៖ កែ Function c360AdminUploadKyc អោយបាញ់ទៅ Cloudinary
// =======================================================
async function c360AdminUploadKyc(event) {
  const file = event.target.files[0];
  if (!file) return;

  Swal.fire({
    title: "កំពុងរៀបចំឯកសារបញ្ជូនទៅ Server...",
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading(),
    customClass: { popup: "premium-swal" },
  });

  const CLOUD_NAME = "jp9yg3dj"; // Cloud Name
  const UPLOAD_PRESET = "iaxuqmpb"; // Upload Preset

  const cloudinaryData = new FormData();
  cloudinaryData.append("file", file);
  cloudinaryData.append("upload_preset", UPLOAD_PRESET);

  try {
    // ជំហានទី ១: Upload ទៅ Cloudinary
    const cloudRes = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
      {
        method: "POST",
        body: cloudinaryData,
      },
    );
    const cloudData = await cloudRes.json();

    if (cloudData.secure_url) {
      // ជំហានទី ២: ផ្ញើ URL ទៅកាន់ Backend របស់អ្នក
      const res = await fetch("/api/admin/upload-kyc", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          username: currentC360User.username,
          kycDocument: cloudData.secure_url, // ផ្ញើឈ្មោះអោយត្រូវនឹង Database
        }),
      });
      const data = await res.json();

      if (data.success) {
        await fetch("/api/admin/log-action", {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            action: "Uploaded KYC",
            target: currentC360User.username,
            details: `Admin បានបញ្ចូលឯកសារ KYC ជំនួសអតិថិជន`,
          }),
        });
        Swal.fire({
          icon: "success",
          title: "ជោគជ័យ!",
          text: "លោតចូលផ្ទាំងរង់ចាំអនុម័ត!",
          timer: 1500,
          showConfirmButton: false,
          customClass: { popup: "premium-swal" },
        });
        c360RefreshData();
      } else {
        Swal.fire("បរាជ័យ", data.message, "error");
      }
    } else {
      Swal.fire("បរាជ័យ", "មិនអាច Upload ទៅ Cloudinary បានទេ", "error");
    }
  } catch (e) {
    Swal.fire({
      icon: "error",
      title: "Error",
      text: "មានបញ្ហាក្នុងការ Upload!",
      customClass: { popup: "premium-swal" },
    });
  }
}

// =======================================================
// 💸 TAB 5: Transactions (ADVANCED BANKING STANDARD)
// =======================================================
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
const c360TrxPerPage = 20;
let c360FilteredTrx = [];
let c360CurrentFilterTab = "all";

function renderTrxTab(user) {
  const container = document.getElementById("c360-tab-trx");
  if (!container) return;

  // កំណត់ថ្ងៃទី (ដើមខែ ដល់ ថ្ងៃនេះ)
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const startStr = firstDay.toISOString().split("T")[0];
  const endStr = today.toISOString().split("T")[0];

  // 🟢 កែប្រែការទាញលេខគណនី
  const accUSD = user.mainAccounts?.USD?.accountNumber;
  const accKHR = user.mainAccounts?.KHR?.accountNumber;

  let accOptions = `<option value="ALL">ប្រតិបត្តិការទាំងអស់ (All)</option>`;
  if (accUSD)
    accOptions += `<option value="USD">គណនី Main USD: ${accUSD}</option>`;
  if (accKHR)
    accOptions += `<option value="KHR">គណនី Main KHR: ${accKHR}</option>`;

  if (user.subAccounts && user.subAccounts.length > 0) {
    user.subAccounts.forEach((sub) => {
      accOptions += `<option value="${sub.accountNumber}">${sub.accountName} (${sub.currency}): ${sub.accountNumber}</option>`;
    });
  }

  let html = `
    <style>
      .c360-filter-tab { flex:1; padding:10px; border:none; background:transparent; color:var(--text-muted); font-weight:bold; border-radius:10px; cursor:pointer; transition:0.2s; }
      .c360-filter-tab.active { background:var(--primary); color:white; box-shadow:0 4px 10px rgba(0,0,0,0.1); }
      .c360-trx-item { display:flex; align-items:center; justify-content:space-between; padding:16px; background:var(--bg-body); border-radius:16px; margin-bottom:12px; cursor:pointer; box-shadow:0 2px 8px rgba(0,0,0,0.02); border:1px solid var(--border); transition:0.2s; }
      .c360-trx-item:hover { border-color:var(--secondary); transform:translateY(-2px); }
      .c360-page-btn { padding:8px 15px; background:var(--bg-body); border:1px solid var(--border); border-radius:8px; color:var(--text-main); font-weight:bold; cursor:pointer; transition:0.2s; }
      .c360-page-btn:hover:not(:disabled) { background:var(--secondary); color:white; border-color:var(--secondary); }
      .c360-page-btn:disabled { opacity:0.5; cursor:not-allowed; }
    </style>

    <div style="background: var(--bg-card); padding: 20px; border-radius: 18px; border: 1px solid var(--border); margin-bottom: 20px;">
        <div style="display:flex; gap:15px; flex-wrap:wrap; margin-bottom:15px;">
            <div style="flex:1; min-width:200px;">
                <label class="kh-text" style="font-size:0.8rem; color:var(--text-muted); font-weight:bold;">ជ្រើសរើសគណនី (Account)</label>
                <select id="c360-trx-acc-filter" class="form-input" style="margin-top:5px;" onchange="c360FilterTrxList(true)">
                    ${accOptions}
                </select>
            </div>
            <div style="flex:1; min-width:200px;">
                <label class="kh-text" style="font-size:0.8rem; color:var(--text-muted); font-weight:bold;">កាលបរិច្ឆេទ (Date Range)</label>
                <div style="display:flex; gap:10px; margin-top:5px; align-items:center;">
                    <input type="date" id="c360-date-start" class="form-input" value="${startStr}" onchange="c360FilterTrxList(true)">
                    <span style="color:var(--text-muted); font-weight:bold;">-</span>
                    <input type="date" id="c360-date-end" class="form-input" value="${endStr}" onchange="c360FilterTrxList(true)">
                </div>
            </div>
        </div>

        <div style="display:flex; gap:10px; background:var(--bg-body); padding:5px; border-radius:12px; border:1px solid var(--border); margin-bottom:15px;">
            <button class="c360-filter-tab kh-text active" onclick="c360SetFilterTab('all', this)">ទាំងអស់ (All)</button>
            <button class="c360-filter-tab kh-text" onclick="c360SetFilterTab('in', this)">ចំណូល (Income)</button>
            <button class="c360-filter-tab kh-text" onclick="c360SetFilterTab('out', this)">ចំណាយ (Expense)</button>
        </div>

        <button onclick="c360ExportStatementPDF()" class="kh-text" style="width:100%; padding:12px; background:#10b981; color:white; border:none; border-radius:10px; font-weight:bold; cursor:pointer; font-size:1rem; box-shadow:0 4px 10px rgba(16,185,129,0.2);">
            <i class="fa-solid fa-file-pdf"></i> ទាញយករបាយការណ៍ (Export Statement PDF)
        </button>
    </div>

    <div id="c360-trx-content" style="min-height: 300px;"></div>

    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:20px; padding-top:15px; border-top:1px dashed var(--border);">
        <button id="c360-btn-prev" class="c360-page-btn kh-text" onclick="c360ChangeTrxPage(-1)" disabled><i class="fa-solid fa-chevron-left"></i> ថយក្រោយ</button>
        <span id="c360-page-info" class="kh-text" style="font-weight:bold; color:var(--text-main);">ទំព័រ 1</span>
        <button id="c360-btn-next" class="c360-page-btn kh-text" onclick="c360ChangeTrxPage(1)">បន្ទាប់ <i class="fa-solid fa-chevron-right"></i></button>
    </div>
  `;
  container.innerHTML = html;

  // រត់ Filter លើកដំបូង
  c360CurrentFilterTab = "all";
  c360FilterTrxList(true);
}

window.c360SetFilterTab = function (type, btnEl) {
  c360CurrentFilterTab = type;
  document
    .querySelectorAll(".c360-filter-tab")
    .forEach((b) => b.classList.remove("active"));
  btnEl.classList.add("active");
  c360FilterTrxList(true);
};

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
        (t) => t.senderAcc === accVal || t.receiverAcc === accVal,
      );
    }
  }

  // 2. Filter by Date (ប្រើ createdAt សម្រាប់ទិន្នន័យច្បាស់លាស់ ឬ date ជា fallback)
  if (startStr && endStr) {
    trxs = trxs.filter((t) => {
      let dDate = t.createdAt
        ? new Date(t.createdAt)
        : c360ParseDateString(t.date);
      if (isNaN(dDate.getTime())) return true; // រំលងបើមើលថ្ងៃអត់ដាច់
      let iso = dDate.toISOString().split("T")[0];
      return iso >= startStr && iso <= endStr;
    });
  }

  // 3. Filter by Tab
  if (c360CurrentFilterTab === "in")
    trxs = trxs.filter((t) => t.amount > 0 || t.type === "Received");
  if (c360CurrentFilterTab === "out")
    trxs = trxs.filter((t) => t.amount < 0 && t.type !== "Received");

  // 4. ដក Pending ចេញកុំអោយរញ៉េរញ៉ៃ Statement
  trxs = trxs.filter((t) => t.status !== "Pending");

  // តម្រៀបពីថ្មីទៅចាស់
  c360FilteredTrx = trxs.sort(
    (a, b) =>
      new Date(b.createdAt || c360ParseDateString(b.date)) -
      new Date(a.createdAt || c360ParseDateString(a.date)),
  );

  c360RenderTrxPage();
};

function c360RenderTrxPage() {
  const container = document.getElementById("c360-trx-content");
  const btnPrev = document.getElementById("c360-btn-prev");
  const btnNext = document.getElementById("c360-btn-next");
  const pageInfo = document.getElementById("c360-page-info");

  if (c360FilteredTrx.length === 0) {
    container.innerHTML = `
        <div style="text-align:center; padding: 50px 20px; color: var(--text-muted);" class="kh-text">
            <i class="fa-solid fa-file-invoice" style="font-size: 4rem; opacity: 0.2; margin-bottom: 15px;"></i>
            <h3 style="margin: 0 0 5px;">មិនមានប្រតិបត្តិការទេ</h3>
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

  pageItems.forEach((t) => {
    const isIncome = t.amount > 0 || t.type === "Received";
    const isRefunded = t.status === "Refunded";

    let parsedDate = t.createdAt
      ? new Date(t.createdAt)
      : c360ParseDateString(t.date);
    let dateLabel = c360GetSmartDateLabel(parsedDate);

    if (dateLabel !== lastDateLabel) {
      html += `<div class="kh-text" style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted); margin: 20px 0 10px 5px; text-transform: uppercase;">${dateLabel}</div>`;
      lastDateLabel = dateLabel;
    }

    let iconClass = isIncome ? "fa-arrow-down" : "fa-arrow-up";
    let bgStyle = isIncome
      ? "background: rgba(16, 185, 129, 0.15); color: #10b981;"
      : "background: rgba(239, 68, 68, 0.15); color: #ef4444;";
    let textColor = isIncome ? "#10b981" : "#ef4444";

    if (isRefunded) {
      bgStyle = "background: var(--bg-body); color: var(--text-muted);";
      textColor = "var(--text-muted)";
    }

    const tType = (t.type || "").toLowerCase();
    const tMethod = (t.trxMethod || "").toLowerCase();
    const tSender = (t.senderName || "").toLowerCase();

    if (
      tType.includes("deposit") ||
      tMethod.includes("cashier") ||
      tSender.includes("deposit")
    ) {
      iconClass = "fa-hand-holding-dollar";
    } else if (tType.includes("payroll") || tMethod.includes("payout")) {
      iconClass = "fa-money-bill-transfer";
    } else if (tType.includes("promo") || tType.includes("reward")) {
      iconClass = "fa-sack-dollar";
    } else if (
      tType.includes("merchant") ||
      tMethod.includes("merchant") ||
      t.merchantId
    ) {
      iconClass = "fa-store";
    } else if (tType.includes("fee")) {
      iconClass = "fa-receipt";
      bgStyle = "background:#fff7ed; color:#ea580c;";
      textColor = "#ea580c";
    } else if (tType.includes("refund")) {
      iconClass = "fa-arrow-rotate-left";
    }

    let title = isIncome
      ? t.senderName || t.merchantName || t.type || "Received"
      : t.receiverName || t.merchantName || t.type || "Transfer";
    if (title === "U-Pay Central Bank" || title === "U-Pay Bank")
      title = t.trxMethod || t.type || "System Transaction";

    const displayAmt =
      t.currency === "KHR"
        ? Math.abs(t.amount).toLocaleString() + " ៛"
        : "$" + Math.abs(t.amount).toFixed(2);
    const sign = isIncome ? "+" : "-";
    const timeStr = c360GetTimeString(parsedDate, t.date);

    const safeRefId = t.refId || t.id || t._id || t.transactionId || "";
    html += `
        <div class="c360-trx-item" onclick="c360ViewTrxDetails('${safeRefId}')">
            <div style="display: flex; align-items: center; gap: 15px;">
                <div style="${bgStyle} width: 45px; height: 45px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">
                    <i class="fa-solid ${iconClass}"></i>
                </div>
                <div>
                    <h4 class="kh-text" style="margin: 0; font-size: 0.95rem; color: var(--text-main); font-weight: 700; text-transform: capitalize;">${title}</h4>
                    <p style="margin: 4px 0 0; font-size: 0.8rem; color: var(--text-muted); font-family: 'Inter', sans-serif;">${timeStr} • ${t.trxMethod || t.type}</p>
                </div>
            </div>
            <div style="text-align: right;">
                <div style="font-weight: bold; font-size: 1.1rem; color: ${textColor}; font-family: 'Inter', sans-serif;">
                    ${isRefunded ? "" : sign}${displayAmt}
                </div>
                <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 3px; font-family: monospace;">#${(t.refId || "").substring(0, 8)}</div>
            </div>
        </div>`;
  });

  container.innerHTML = html;

  // Update Pagination Controls
  pageInfo.innerText = `ទំព័រ ${c360CurrentTrxPage} នៃ ${totalPages}`;
  btnPrev.disabled = c360CurrentTrxPage === 1;
  btnNext.disabled = c360CurrentTrxPage === totalPages;
}

window.c360ChangeTrxPage = function (step) {
  c360CurrentTrxPage += step;
  c360RenderTrxPage();
};

// =======================================================
// មុខងារបង្ហាញ Detail របស់ Transaction (មានប្រព័ន្ធការពារ Error)
// =======================================================
window.c360ViewTrxDetails = function (refId) {
  // 1. រកមើលទិន្នន័យ (គាំទ្រទាំង refId, id និង _id ការពារការគាំង)
  const t = currentC360User.transactions.find(
    (x) =>
      x.refId === refId ||
      x.id === refId ||
      x._id === refId ||
      x.transactionId === refId,
  );

  if (!t) {
    Swal.fire(
      "បរាជ័យ",
      "រកមិនឃើញទិន្នន័យវិក្កយបត្រនេះទេ (ID: " + refId + ")",
      "error",
    );
    return;
  }

  // 2. សាកល្បងហៅមុខងារពី slip.js
  if (typeof openGlobalSlip === "function") {
    try {
      openGlobalSlip(t, currentC360User.username);
      return; // បើ Slip ដើរជោគជ័យ បញ្ចប់ត្រឹមនេះមិនបាច់ចុះទៅក្រោមទៀតទេ
    } catch (error) {
      console.warn("slip.js មិនអាចដំណើរការពេញលេញនៅលើ Admin ទេ: ", error);
      // បើមាន Error វានឹងរំលង ហើយទៅបើកវិក្កយបត្រ Admin ជំនួសវិញដោយស្វ័យប្រវត្តិ
    }
  }

  // ==========================================
  // 3. FALLBACK: វិក្កយបត្រកម្រិត Admin (បើ slip.js ដើរមិនរួច ឬមិនដំណើរការ)
  // ==========================================
  const isIncome = t.amount > 0 || t.type === "Received";
  const displayAmt =
    t.currency === "KHR"
      ? Math.abs(t.amount).toLocaleString() + " ៛"
      : "$" + Math.abs(t.amount).toFixed(2);
  const sign = isIncome ? "+" : "-";
  const color = isIncome ? "var(--secondary)" : "#ef4444";

  let statusBadge = "";
  const s = (t.status || "").toLowerCase();
  if (["completed", "success", "approved", "paid"].includes(s))
    statusBadge = `<span style="background: rgba(16, 185, 129, 0.15); color: var(--secondary); padding: 5px 12px; border-radius: 8px; font-size: 0.85rem; font-weight: bold;"><i class="fa-solid fa-check-circle"></i> ជោគជ័យ</span>`;
  else if (s === "refunded")
    statusBadge = `<span style="background: var(--bg-body); color: var(--text-muted); padding: 5px 12px; border-radius: 8px; font-size: 0.85rem; font-weight: bold;"><i class="fa-solid fa-rotate-left"></i> បានបង្វិលសង</span>`;
  else
    statusBadge = `<span style="background: rgba(239, 68, 68, 0.15); color: #ef4444; padding: 5px 12px; border-radius: 8px; font-size: 0.85rem; font-weight: bold;"><i class="fa-solid fa-times-circle"></i> បរាជ័យ</span>`;

  Swal.fire({
    title:
      '<span class="kh-text" style="font-size:1.3rem;">វិក្កយបត្រលម្អិត (Admin View)</span>',
    html: `
      <div class="kh-text" style="text-align: left; background: var(--bg-body); padding: 25px 20px; border-radius: 20px; border: 1px solid var(--border); margin-top: 10px;">
          <div style="text-align: center; margin-bottom: 25px;">
              <div style="font-size: 2.2rem; font-weight: 800; color: ${color}; font-family: 'Inter', sans-serif; letter-spacing: -1px;">${sign}${displayAmt}</div>
              <div style="margin-top: 10px;">${statusBadge}</div>
          </div>
          <div style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px dashed var(--border); padding-bottom: 12px;">
              <span style="color: var(--text-muted); font-size: 0.9rem;">ប្រភេទ៖</span><span style="font-weight: bold; color: var(--text-main);">${t.type || t.trxMethod || "ប្រតិបត្តិការ"}</span>
          </div>
          <div style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px dashed var(--border); padding-bottom: 12px;">
              <span style="color: var(--text-muted); font-size: 0.9rem;">កាលបរិច្ឆេទ៖</span><span style="font-weight: bold; color: var(--text-main); text-align: right; font-size: 0.9rem;">${t.createdAt || t.date || "N/A"}</span>
          </div>
          <div style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px dashed var(--border); padding-bottom: 12px;">
              <span style="color: var(--text-muted); font-size: 0.9rem;">អ្នកពាក់ព័ន្ធ៖</span><span style="font-weight: bold; color: var(--text-main); text-align: right;">${t.senderName || t.receiverName || t.merchantName || "N/A"}</span>
          </div>
          <div style="display:flex; justify-content: space-between; align-items: center;">
              <span style="color: var(--text-muted); font-size: 0.9rem;">លេខយោង (Ref)៖</span><span style="font-weight: bold; color: var(--accent); font-family: monospace; font-size: 1rem; background: rgba(59, 130, 246, 0.15); padding: 3px 8px; border-radius: 6px;">${t.refId || t.id || t._id || "N/A"}</span>
          </div>
      </div>
    `,
    showConfirmButton: true,
    confirmButtonText: '<span class="kh-text">បិទ (Close)</span>',
    confirmButtonColor: "var(--primary)",
    customClass: { popup: "modal-radius premium-swal" },
  });
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
// 🛡️ TAB 6: Security (សុវត្ថិភាព និង Force Logout)
// =======================================================
function renderSecurityTab(user) {
  const container = document.getElementById("c360-tab-security");
  if (!container) return;
  const lastIp = user.lastIp || "មិនមានទិន្នន័យ (N/A)";
  const lastDevice = user.lastDevice || "មិនមានទិន្នន័យ (N/A)";
  const lastLogin = user.lastLogin || "មិនមានទិន្នន័យ (N/A)";

  container.innerHTML = `
    <div style="max-width: 500px; margin: 0 auto; display: flex; flex-direction: column; gap: 20px;">
        <div style="background: var(--bg-card); border-radius: 18px; padding: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.03); border: 1px solid var(--border);">
            <h4 class="kh-text" style="margin: 0 0 15px; color: var(--text-main); display: flex; align-items: center; gap: 10px;">
                <i class="fa-solid fa-shield-halved" style="color: var(--accent);"></i> ព័ត៌មានចូលប្រើប្រាស់ចុងក្រោយ
            </h4>
            <div style="display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px dashed var(--border);">
                <span class="kh-text" style="color: var(--text-muted); font-size: 0.9rem;">អាសយដ្ឋាន IP:</span>
                <span style="font-weight: 600; color: var(--text-main); font-family: 'Inter', monospace; font-size: 0.9rem;">${lastIp}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px dashed var(--border);">
                <span class="kh-text" style="color: var(--text-muted); font-size: 0.9rem;">ឧបករណ៍ (Device):</span>
                <span style="font-weight: 600; color: var(--text-main); font-family: 'Inter', sans-serif; font-size: 0.9rem;">${lastDevice}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 12px 0;">
                <span class="kh-text" style="color: var(--text-muted); font-size: 0.9rem;">ពេលវេលា:</span>
                <span style="font-weight: 600; color: var(--text-main); font-family: 'Inter', sans-serif; font-size: 0.9rem;">${lastLogin}</span>
            </div>
        </div>

        <div style="background: rgba(239, 68, 68, 0.1); border-radius: 18px; padding: 25px; box-shadow: 0 4px 15px rgba(0,0,0,0.03); border: 1px solid rgba(239, 68, 68, 0.3);">
            <h4 class="kh-text" style="margin: 0 0 10px; color: #ef4444; display: flex; align-items: center; gap: 10px;">
                <i class="fa-solid fa-triangle-exclamation"></i> សកម្មភាពបន្ទាន់ (Emergency)
            </h4>
            <p class="kh-text" style="font-size: 0.85rem; color: #ef4444; margin-bottom: 20px; line-height: 1.6;">
                ប្រសិនបើអ្នកសង្ស័យថាគណនីនេះត្រូវបានគេលួចប្រើប្រាស់ ឬមានហានិភ័យ អ្នកអាចទាត់អតិថិជននេះចេញពីកម្មវិធីភ្លាមៗ។ គាត់នឹងត្រូវតម្រូវឱ្យ Login ម្តងទៀត។
            </p>
            <button onclick="c360ForceLogout()" class="kh-text" style="width: 100%; padding: 15px; background: #ef4444; color: white; border: none; border-radius: 12px; font-weight: bold; font-size: 1.05rem; cursor: pointer; transition: 0.2s; box-shadow: 0 4px 10px rgba(239, 68, 68, 0.25); display: flex; justify-content: center; align-items: center; gap: 10px;">
                <i class="fa-solid fa-right-from-bracket"></i> ទាត់ចេញពីគណនី (Force Logout)
            </button>
        </div>
    </div>`;
}

window.c360ForceLogout = async function () {
  const { value: remark } = await Swal.fire({
    title:
      '<span class="kh-text" style="font-size:1.4rem; color: #ef4444;">Force Logout</span>',
    html: `
        <p class="kh-text" style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 15px;">តើអ្នកពិតជាចង់ទាត់អតិថិជននេះចេញពីប្រព័ន្ធមែនទេ?</p>
        <div style="text-align: left; padding: 0 10px;">
            <label class="kh-text" style="font-size: 0.85rem; font-weight: 600; color: var(--text-muted);">មូលហេតុ (Remark)</label>
            <input id="swal-logout-remark" class="swal2-input kh-text" placeholder="បញ្ជាក់មូលហេតុ..." style="width: 100%; margin: 5px 0 0; background: var(--bg-body); color: var(--text-main); border: 1px solid var(--border);">
        </div>`,
    showCancelButton: true,
    confirmButtonText: '<span class="kh-text">យល់ព្រមទាត់ចេញ</span>',
    cancelButtonText: '<span class="kh-text">បោះបង់</span>',
    confirmButtonColor: "#ef4444",
    customClass: { popup: "modal-radius" },
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
          username: currentC360User.username,
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
            target: currentC360User.username,
            details: `បានទាត់អតិថិជនចេញពីប្រព័ន្ធ - មូលហេតុ: ${remark}`,
          }),
        });
        Swal.fire({
          icon: "success",
          title: "ជោគជ័យ!",
          text: "អតិថិជនត្រូវបានទាត់ចេញពីប្រព័ន្ធ។",
          timer: 1500,
          showConfirmButton: false,
          customClass: { popup: "premium-swal" },
        });
      } else
        Swal.fire({
          icon: "error",
          title: "បរាជ័យ",
          text: data.message,
          customClass: { popup: "premium-swal" },
        });
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

// =======================================================
// 🏪 TAB 7: Merchant
// =======================================================
let c360CurrentMerchantId = null;

async function renderMerchantTab(user) {
  const container = document.getElementById("c360-tab-merchant");
  if (!container) return;
  container.innerHTML = `<div style="text-align: center; padding: 50px;"><i class="fa-solid fa-spinner fa-spin" style="font-size: 2rem; color: var(--text-muted);"></i></div>`;

  try {
    const res = await fetch("/api/merchants/admin/all-merchants", {
      headers: getAuthHeaders(),
    });
    const data = await res.json();

    let userMerchants = [];
    if (data.success && data.merchants) {
      userMerchants = data.merchants.filter(
        (m) => m.userId === user.username || m.merchantId === user.merchantId,
      );
    }

    if (userMerchants.length === 0) {
      container.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 50px 20px;">
            <i class="fa-solid fa-store-slash" style="font-size: 5rem; color: var(--text-muted); opacity: 0.5; margin-bottom: 20px;"></i>
            <h3 class="kh-text" style="color: var(--text-main); margin: 0 0 10px;">អតិថិជននេះមិនទាន់មានអាជីវកម្មទេ</h3>
            <p class="kh-text" style="color: var(--text-muted); font-size: 0.95rem; margin-bottom: 25px;">អតិថិជននេះកំពុងប្រើប្រាស់គណនីជាទម្រង់បុគ្គលប៉ុណ្ណោះ។</p>
            <button onclick="c360RegisterMerchant()" class="kh-text btn-primary" style="padding: 14px 30px; border-radius: 14px; font-size: 1.05rem; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);">
                <i class="fa-solid fa-plus-circle"></i> ចុះឈ្មោះជាអាជីវកម្ម (Add Shop)
            </button>
        </div>`;
      return;
    }

    if (
      !c360CurrentMerchantId ||
      !userMerchants.find((m) => m._id === c360CurrentMerchantId)
    )
      c360CurrentMerchantId = userMerchants[0]._id;
    const m = userMerchants.find((m) => m._id === c360CurrentMerchantId);
    const isSuspended = m.status === "Suspended";

    let branchSelector = "";
    if (userMerchants.length > 1) {
      let options = userMerchants
        .map(
          (branch) =>
            `<option value="${branch._id}" ${branch._id === c360CurrentMerchantId ? "selected" : ""}>${branch.name || "Unnamed"} (MID: ${branch.merchantId})</option>`,
        )
        .join("");
      branchSelector = `
        <div style="margin-bottom: 15px; background: var(--bg-card); padding: 10px; border-radius: 12px; border: 1px solid var(--border); display: flex; align-items: center; gap: 10px;">
            <i class="fa-solid fa-code-branch" style="color: var(--text-muted);"></i>
            <select class="kh-text" style="flex: 1; border: none; outline: none; font-weight: bold; color: var(--text-main); background: transparent; font-size: 1rem;" onchange="c360CurrentMerchantId = this.value; renderMerchantTab(currentC360User);">
                ${options}
            </select>
        </div>`;
    }

    let balUSD =
      m.collected && m.collected.USD
        ? parseFloat(m.collected.USD).toFixed(2)
        : "0.00";
    let balKHR =
      m.collected && m.collected.KHR
        ? parseFloat(m.collected.KHR).toLocaleString()
        : "0";

    let html = `
      <div style="display: flex; flex-direction: column; gap: 20px;">
          ${branchSelector}
          <div style="background: linear-gradient(135deg, var(--secondary) 0%, var(--primary) 100%); border-radius: 20px; padding: 25px; color: white; box-shadow: 0 10px 25px rgba(0,0,0,0.1); display: flex; justify-content: space-between; align-items: center;">
              <div style="display: flex; align-items: center; gap: 20px;">
                  <div style="width: 60px; height: 60px; background: rgba(255,255,255,0.1); border-radius: 15px; display: flex; align-items: center; justify-content: center; font-size: 1.8rem; border: 1px solid rgba(255,255,255,0.2);">
                      <i class="fa-solid fa-store"></i>
                  </div>
                  <div>
                      <h2 class="kh-text" style="margin: 0 0 5px; font-size: 1.4rem;">${m.name}</h2>
                      <p class="kh-text" style="margin: 0; font-size: 0.85rem; color: #e2e8f0;">MID: <span style="font-family: monospace;">${m.merchantId}</span> • ${m.category}</p>
                  </div>
              </div>
              <div style="text-align: right;">
                  <div style="font-size: 0.75rem; color: #e2e8f0; margin-bottom: 5px;">${isSuspended ? "បានផ្អាក" : "ដំណើរការ"}</div>
                  <label class="switch" style="transform: scale(1.1);">
                      <input type="checkbox" ${!isSuspended ? "checked" : ""} onchange="if(typeof toggleMerchantFreeze === 'function') toggleMerchantFreeze('${m._id}', !this.checked); setTimeout(()=>renderMerchantTab(currentC360User), 1000);">
                      <span class="slider"></span>
                  </label>
              </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
              <div style="background: var(--bg-card); border-radius: 16px; padding: 20px; border: 1px solid var(--border); position: relative;">
                  <div class="kh-text" style="color: var(--text-muted); font-size: 0.85rem; font-weight: bold;">ចំណូលសរុប (Total Received)</div>
                  <div style="font-size: 1.6rem; font-weight: 800; color: var(--secondary); margin: 5px 0 0; font-family: 'Inter', sans-serif;">$${balUSD}</div>
                  <div style="font-size: 1.2rem; font-weight: 700; color: #047857; font-family: 'Inter', sans-serif;">៛${balKHR}</div>
              </div>
              
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                  <button onclick="if(typeof editMerchantByAdmin === 'function') { editMerchantByAdmin('${m._id}'); setTimeout(()=>renderMerchantTab(currentC360User), 2000); }" class="kh-text" style="background: rgba(59, 130, 246, 0.1); color: var(--accent); border: 1px solid rgba(59, 130, 246, 0.2); border-radius: 12px; font-weight: bold; cursor: pointer; transition: 0.2s;">
                      <i class="fa-solid fa-pen" style="font-size: 1.3rem; display: block; margin-bottom: 5px;"></i> កែប្រែហាង
                  </button>
                  <button onclick="if(typeof deleteMerchantByAdmin === 'function') { deleteMerchantByAdmin('${m._id}'); setTimeout(c360RefreshData, 2000); }" class="kh-text" style="background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 12px; font-weight: bold; cursor: pointer; transition: 0.2s;">
                      <i class="fa-solid fa-trash" style="font-size: 1.3rem; display: block; margin-bottom: 5px;"></i> លុបហាង
                  </button>
                  <button onclick="c360RegisterMerchant()" class="kh-text" style="background: var(--bg-body); color: var(--text-main); border: 1px dashed var(--border); border-radius: 12px; padding: 10px; font-weight: bold; cursor: pointer; transition: 0.2s; grid-column: span 2;">
                      <i class="fa-solid fa-plus"></i> បង្កើតសាខាថ្មី
                  </button>
              </div>
          </div>

          <div style="background: var(--bg-card); border-radius: 16px; padding: 20px; border: 1px solid var(--border);">
              <h4 class="kh-text" style="margin: 0 0 15px; color: var(--text-main);"><i class="fa-solid fa-receipt" style="color: var(--secondary);"></i> ប្រវត្តិការលក់ (Transactions)</h4>
              <div id="c360-merchant-trx-list">
                  <div style="text-align: center; padding: 30px;"><i class="fa-solid fa-spinner fa-spin" style="font-size: 2rem; color: var(--text-muted);"></i></div>
              </div>
          </div>
      </div>`;
    container.innerHTML = html;
    c360FetchMerchantTransactions(m._id);
  } catch (e) {
    container.innerHTML = `<div class="kh-text" style="text-align: center; padding: 40px; color: red;">មានបញ្ហាក្នុងការទាញទិន្នន័យ Server</div>`;
  }
}

async function c360FetchMerchantTransactions(mid) {
  const listDiv = document.getElementById("c360-merchant-trx-list");
  try {
    const res = await fetch(`/api/merchants/transactions/${mid}?filter=total`, {
      headers: getAuthHeaders(),
    });
    const data = await res.json();

    if (data.success && data.transactions && data.transactions.length > 0) {
      listDiv.innerHTML = data.transactions
        .slice(0, 15)
        .map((t) => {
          let color =
            t.type === "Received" || t.amount > 0
              ? "var(--secondary)"
              : "#ef4444";
          let sign = t.type === "Received" || t.amount > 0 ? "+" : "";
          return `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px dashed var(--border);">
                <div>
                    <div class="kh-text" style="font-weight: 600; color: var(--text-main);">${t.senderName || t.receiverName}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted); font-family: monospace;">${t.date}</div>
                </div>
                <div style="text-align: right;">
                    <div style="font-weight: bold; color: ${color}; font-family: 'JetBrains Mono', monospace;">${sign}${t.amount} ${t.currency}</div>
                    <div style="font-size: 0.7rem; background: var(--bg-body); padding: 2px 6px; border-radius: 4px; color: var(--text-muted); display: inline-block; margin-top: 4px;">${t.status}</div>
                </div>
            </div>`;
        })
        .join("");
    } else
      listDiv.innerHTML = `<div class="kh-text" style="text-align: center; color: var(--text-muted); padding: 20px;">មិនទាន់មានប្រតិបត្តិការនៅឡើយទេ</div>`;
  } catch (error) {
    listDiv.innerHTML = `<div class="kh-text" style="text-align: center; color: #ef4444; padding: 20px;">បរាជ័យក្នុងការទាញយកប្រតិបត្តិការ</div>`;
  }
}

window.c360RegisterMerchant = async function () {
  const { value: formValues } = await Swal.fire({
    title:
      '<span class="kh-text" style="color:var(--secondary);">បង្កើតហាងថ្មី</span>',
    html: `
        <div style="text-align: left;">
            <label class="kh-text" style="font-size:0.85rem; font-weight:bold; color:var(--text-muted);">ឈ្មោះហាង</label>
            <input id="m-name" class="swal2-input kh-text" placeholder="ឧ. Smart Shop" style="width:100%; margin: 5px 0 15px; background: var(--bg-body); color: var(--text-main); border: 1px solid var(--border);">
            <label class="kh-text" style="font-size:0.85rem; font-weight:bold; color:var(--text-muted);">ទីក្រុង / ខេត្ត</label>
            <input id="m-city" class="swal2-input kh-text" placeholder="ឧ. Phnom Penh" value="Phnom Penh" style="width:100%; margin: 5px 0 15px; background: var(--bg-body); color: var(--text-main); border: 1px solid var(--border);">
            <label class="kh-text" style="font-size:0.85rem; font-weight:bold; color:var(--text-muted);">ប្រភេទអាជីវកម្ម</label>
            <input id="m-category" class="swal2-input kh-text" placeholder="ឧ. Food & Beverage" value="Food & Beverage" style="width:100%; margin: 5px 0 15px; background: var(--bg-body); color: var(--text-main); border: 1px solid var(--border);">
            <label class="kh-text" style="font-size:0.85rem; font-weight:bold; color:var(--text-muted);">គណនីទទួលប្រាក់</label>
            <select id="m-linked" class="swal2-select kh-text" style="width:100%; margin: 5px 0 0; background: var(--bg-body); color: var(--text-main); border: 1px solid var(--border);">
                <option value="USD">គណនីប្រាក់ដុល្លារ (USD)</option>
                <option value="KHR">គណនីប្រាក់រៀល (KHR)</option>
            </select>
        </div>`,
    showCancelButton: true,
    confirmButtonText: "រក្សាទុក (Save)",
    confirmButtonColor: "var(--secondary)",
    customClass: { popup: "modal-radius premium-swal" },
    preConfirm: () => {
      return {
        name: document.getElementById("m-name").value,
        city: document.getElementById("m-city").value,
        category: document.getElementById("m-category").value,
        linkedAccount: document.getElementById("m-linked").value,
      };
    },
  });

  if (formValues && formValues.name) {
    Swal.fire({
      title: "កំពុងបង្កើត...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
      customClass: { popup: "premium-swal" },
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
          timer: 1500,
          showConfirmButton: false,
          customClass: { popup: "premium-swal" },
        });
        c360RefreshData();
      } else
        Swal.fire({
          icon: "error",
          title: "បរាជ័យ",
          text: data.message,
          customClass: { popup: "premium-swal" },
        });
    } catch (e) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "បញ្ហា Server",
        customClass: { popup: "premium-swal" },
      });
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
