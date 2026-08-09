// ========================================================================
// 🛡️ CUSTOMER 360° VIEW LOGIC (ALL-IN-ONE SYSTEM)
// រក្សាទុកកូដចាស់ទាំងអស់ និងបន្ថែមមុខងារបញ្ជាទិន្នន័យ (Actions)
// ========================================================================

let currentC360User = null;

// =======================================================
// ១. មុខងារស្វែងរកអតិថិជន (Live Search API - ចាប់ ១០០% ពី Database)
// =======================================================
async function searchCustomer360() {
  const term = document.getElementById("searchC360").value.trim();
  if (!term) return;

  Swal.fire({
    title: "កំពុងស្វែងរក...",
    text: "ឆែកមើលក្នុងមូលដ្ឋានទិន្នន័យផ្ទាល់",
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading(),
    customClass: { popup: "premium-swal" },
  });

  try {
    // បាញ់ API ទៅស្វែងរក User ក្នុង Database ផ្ទាល់
    const res = await fetch("/api/admin/search-user", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ searchTerm: term }),
    });
    const data = await res.json();

    Swal.close();

    if (data.success && data.user) {
      currentC360User = data.user;

      // Update ទិន្នន័យចូល Global Array ដើម្បីអោយប្រើបានកន្លែងផ្សេង
      if (typeof globalUsersData !== "undefined") {
        const index = globalUsersData.findIndex(
          (u) => u.username === data.user.username,
        );
        if (index !== -1) globalUsersData[index] = data.user;
        else globalUsersData.push(data.user);
      }

      // បង្ហាញទិន្នន័យលើអេក្រង់
      renderCustomerProfile(data.user);
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
// ២. មុខងារបង្ហាញទិន្នន័យ Header និង Quick Actions
// =======================================================
function renderCustomerProfile(user) {
  currentC360User = user;

  const emptyState = document.getElementById("c360-empty-state");
  if (emptyState) emptyState.style.display = "none";

  const profileView = document.getElementById("c360-profile-view");
  if (profileView) profileView.style.display = "block";

  // បង្ហាញទិន្នន័យខាងលើ (Header)
  const avatarEl = document.getElementById("c360-avatar");
  if (avatarEl)
    avatarEl.src = user.profileImage || "../images/default-avatar.png";

  const nameEl = document.getElementById("c360-name");
  if (nameEl) nameEl.innerText = user.fullName || user.username || "Unknown";

  const userEl = document.getElementById("c360-username");
  if (userEl)
    userEl.innerHTML = `<i class="fa-solid fa-at"></i> ${user.username}`;

  const phoneEl = document.getElementById("c360-phone");
  if (phoneEl)
    phoneEl.innerHTML = `<i class="fa-solid fa-phone"></i> ${user.phone || user.phoneNumber || "N/A"}`;

  // Font ខ្មែរសម្រាប់ Status & ប៊ូតុង
  let statusHtml = user.isFrozen
    ? `<span style="background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); padding: 4px 8px; border-radius: 8px; font-weight: bold; font-size: 0.75rem; font-family:'Kantumruy Pro';">FROZEN (ផ្អាក)</span> `
    : `<span style="background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); padding: 4px 8px; border-radius: 8px; font-weight: bold; font-size: 0.75rem; font-family:'Kantumruy Pro';">ACTIVE (ធម្មតា)</span> `;

  if (user.kycStatus === "verified" || user.kycStatus === "approved") {
    statusHtml += `<span style="background: rgba(59, 130, 246, 0.15); color: #3b82f6; border: 1px solid rgba(59, 130, 246, 0.3); padding: 4px 8px; border-radius: 8px; font-weight: bold; font-size: 0.75rem; margin-left: 5px;"><i class="fa-solid fa-circle-check"></i> KYC</span>`;
  }

  const statusBadge = document.getElementById("c360-status-badge");
  if (statusBadge) statusBadge.innerHTML = statusHtml;

  // ប៊ូតុងមាន Font ខ្មែរស្អាត និងថែមប៊ូតុង Refresh
  const quickActions = document.getElementById("c360-quick-actions");
  if (quickActions) {
    quickActions.innerHTML = `
      <button onclick="c360RefreshData()" class="kh-text" style="background: var(--bg-body); color: var(--text-muted); border: 1px solid var(--border); padding: 10px 15px; border-radius: 10px; cursor: pointer; font-weight: bold; transition: 0.2s;" title="Refresh ទិន្នន័យអតិថិជននេះ">
        <i class="fa-solid fa-arrows-rotate" id="c360-refresh-icon"></i>
      </button>
      <button onclick="c360ToggleFreeze()" class="kh-text" style="background: ${user.isFrozen ? "var(--secondary)" : "#ef4444"}; color: white; border: none; padding: 10px 15px; border-radius: 10px; cursor: pointer; font-weight: bold; transition: 0.2s;">
        <i class="fa-solid ${user.isFrozen ? "fa-unlock" : "fa-lock"}"></i> ${user.isFrozen ? "ដោះសោរ (Unfreeze)" : "ផ្អាក (Freeze)"}
      </button>
      <button onclick="c360OpenFloatingChat()" class="kh-text" style="background: var(--accent); color: white; border: none; padding: 10px 15px; border-radius: 10px; cursor: pointer; font-weight: bold; transition: 0.2s;">
        <i class="fa-solid fa-comment-dots"></i> ផ្ញើសារ (Chat)
      </button>
    `;
  }

  // ហៅមុខងារគូរ Tab ទាំង ៨
  renderInfoTab(user);
  renderWalletsTab(user);
  renderCardsTab(user);
  renderKycTab(user);
  renderTrxTab(user);
  renderSecurityTab(user);
  renderMerchantTab(user);
  renderLogsTab(user);
}

function switchC360Tab(tabName) {
  document
    .querySelectorAll(".c360-tab")
    .forEach((t) => t.classList.remove("active"));
  document
    .querySelectorAll(".c360-tab-content")
    .forEach((c) => (c.style.display = "none"));
  if (event && event.currentTarget) event.currentTarget.classList.add("active");
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

// ➡️ TAB 1: ព័ត៌មានទូទៅ (Information) - ធ្វើឱ្យ Professional
function renderInfoTab(user) {
  const container = document.getElementById("c360-tab-info");
  if (!container) return;

  const dateCreated = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString("km-KH")
    : "មិនស្គាល់";

  container.innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px;">
      <div class="form-group">
        <label class="kh-text" style="font-weight:600; color:var(--text-muted);">ឈ្មោះពេញ (Full Name)</label>
        <input type="text" id="c360-edit-fullname" class="form-input kh-text" value="${user.fullName || ""}" />
      </div>
      <div class="form-group">
        <label class="kh-text" style="font-weight:600; color:var(--text-muted);">ឈ្មោះប្រើប្រាស់ (Username)</label>
        <input type="text" class="form-input" value="${user.username}" readonly style="background: var(--bg-body); cursor: not-allowed; color: var(--text-muted); font-weight:bold;" title="មិនអាចកែប្រែបានទេ ការពារការបាត់បង់ទិន្នន័យ" />
      </div>
      <div class="form-group">
        <label class="kh-text" style="font-weight:600; color:var(--text-muted);">លេខទូរស័ព្ទ (Phone)</label>
        <input type="text" id="c360-edit-phone" class="form-input" value="${user.phone || user.phoneNumber || ""}" />
      </div>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 15px;">
      <div class="form-group">
        <label class="kh-text" style="font-weight:600; color:var(--text-muted);">អ៊ីមែល (Email)</label>
        <input type="email" id="c360-edit-email" class="form-input" value="${user.email || ""}" />
      </div>
      <div class="form-group">
        <label class="kh-text" style="font-weight:600; color:var(--text-muted);">ថ្ងៃបង្កើតគណនី</label>
        <input type="text" class="form-input kh-text" value="${dateCreated}" readonly style="background: var(--bg-body); cursor: not-allowed;" />
      </div>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px;">
      <div class="form-group" style="border: 1px solid var(--border); padding: 15px; border-radius: 10px; background: var(--bg-card);">
        <label class="kh-text" style="color: #ef4444; font-weight:600;"><i class="fa-solid fa-key"></i> ប្តូរ ឬ Reset PIN</label>
        <div style="position: relative; margin-top: 10px;">
          <input type="password" maxlength="4" id="c360-edit-pin" class="form-input" placeholder="វាយ PIN ៤ខ្ទង់ថ្មី ទីនេះ" value="${user.pin || ""}" style="padding-right: 40px; margin:0;" />
          <i class="fa-solid fa-eye-slash" onclick="toggleSensitiveView('c360-edit-pin', this, 'PIN')" style="position: absolute; right: 15px; top: 50%; transform: translateY(-50%); cursor: pointer; color: var(--text-muted); font-size: 1.1rem;"></i>
        </div>
      </div>
      <div class="form-group" style="border: 1px solid var(--border); padding: 15px; border-radius: 10px; background: var(--bg-card);">
        <label class="kh-text" style="color: #ef4444; font-weight:600;"><i class="fa-solid fa-lock"></i> ប្តូរ Password ថ្មី</label>
        <div style="position: relative; margin-top: 10px;">
          <input type="password" id="c360-edit-pass" class="form-input" placeholder="ទុកទទេបើមិនចង់ប្តូរ" value="*********" style="padding-right: 40px; margin:0;" />
          <i class="fa-solid fa-eye-slash" onclick="toggleSensitiveView('c360-edit-pass', this, 'Password')" style="position: absolute; right: 15px; top: 50%; transform: translateY(-50%); cursor: pointer; color: var(--text-muted); font-size: 1.1rem;"></i>
        </div>
      </div>
    </div>

    <button class="btn-primary kh-text" style="width: 100%; display: block; text-align: center; margin-top: 25px; padding: 18px; font-size: 1.1rem; background: var(--primary); box-shadow: 0 10px 20px rgba(0,0,0,0.1);" onclick="saveC360Info()">
      <i class="fa-solid fa-floppy-disk" style="margin-right: 8px;"></i> រក្សាទុកការកែប្រែ (Save Changes)
    </button>
  `;
}

async function toggleSensitiveView(inputId, iconEl, type) {
  const input = document.getElementById(inputId);
  const isPassword = input.type === "password";

  if (isPassword) {
    input.type = "text";
    iconEl.classList.remove("fa-eye-slash");
    iconEl.classList.add("fa-eye");
    iconEl.style.color = "var(--accent)";

    if (type === "Password") {
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "info",
        title: "Password ត្រូវបាន Hashed ការពារសុវត្ថិភាព",
        customClass: { popup: "premium-swal" },
      });
    }

    try {
      await fetch("/api/admin/log-action", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          action: "Viewed Sensitive Data",
          target: currentC360User.username,
          details: `Admin បានចុចបើកមើល ${type}`,
        }),
      });
    } catch (e) {}
  } else {
    input.type = "password";
    iconEl.classList.remove("fa-eye");
    iconEl.classList.add("fa-eye-slash");
    iconEl.style.color = "var(--text-muted)";
  }
}

// Save ការកែប្រែក្នុង Tab 1 (ប្រើ API edit-user ពី admin-users.js)
async function saveC360Info() {
  const pinVal = document.getElementById("c360-edit-pin").value;
  const passVal = document.getElementById("c360-edit-pass").value;

  const bodyData = {
    id: currentC360User._id || currentC360User.id,
    username: currentC360User.username, // មិនអោយប្តូរ
    accountNumber: currentC360User.accountNumber,
    accountNumberKHR: currentC360User.accountNumberKHR,
    pin: pinVal,
    password: passVal === "*********" ? "" : passVal,
    fullName: document.getElementById("c360-edit-fullname").value,
    phone: document.getElementById("c360-edit-phone").value,
    email: document.getElementById("c360-edit-email").value,
  };

  try {
    const res = await fetch("/api/admin/edit-user", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(bodyData),
    });
    const data = await res.json();
    if (data.success) {
      Swal.fire({
        icon: "success",
        title: "រក្សាទុកជោគជ័យ",
        showConfirmButton: false,
        timer: 1500,
        customClass: { popup: "premium-swal kh-text" },
      });

      if (passVal !== "*********" || pinVal !== (currentC360User.pin || "")) {
        await fetch("/api/admin/log-action", {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            action: "Changed Credentials",
            target: currentC360User.username,
            details: `Admin បានកែប្រែ PIN/Password ថ្មី`,
          }),
        });
      }
      c360RefreshData(); // ហៅ Refresh ទិន្នន័យដើម្បីបង្ហាញថ្មី
    } else throw new Error(data.message);
  } catch (e) {
    Swal.fire({
      icon: "error",
      title: "បរាជ័យ",
      text: "មិនអាចកែប្រែបានទេ",
      customClass: { popup: "premium-swal" },
    });
  }
}

// ➡️ TAB 2: Wallets (គណនីហិរញ្ញវត្ថុ)
function renderWalletsTab(user) {
  const container = document.getElementById("c360-tab-finance");
  if (!container) return;
  container.innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
      <div class="dash-card" style="border-left: 5px solid var(--accent);">
        <h4 style="margin: 0 0 10px; color: var(--text-muted);" class="kh-text">គណនី USD ($)</h4>
        <h2 style="margin: 0 0 10px; color: var(--text-main); font-size: 2rem;">$${(user.balance || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</h2>
        <p style="margin:0; font-family: monospace; color: var(--text-muted);">Acc: ${user.accountNumber || "N/A"}</p>
      </div>
      <div class="dash-card" style="border-left: 5px solid var(--secondary);">
        <h4 style="margin: 0 0 10px; color: var(--text-muted);" class="kh-text">គណនី KHR (៛)</h4>
        <h2 style="margin: 0 0 10px; color: var(--text-main); font-size: 2rem;">${(user.balanceKHR || 0).toLocaleString()} ៛</h2>
        <p style="margin:0; font-family: monospace; color: var(--text-muted);">Acc: ${user.accountNumberKHR || "N/A"}</p>
      </div>
    </div>
    
    <div style="display: flex; gap: 15px; margin-top: 20px;">
      <button class="btn-primary kh-text" style="background: #ef4444; flex:1; padding: 18px; font-size: 1.1rem; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 10px; border-radius: 12px;" onclick="if(typeof openAdjustBalance === 'function') openAdjustBalance('${user.username}', 'deduct')">
          <i class="fa-solid fa-minus"></i> ដកប្រាក់
      </button>
      <button class="btn-primary kh-text" style="background: var(--secondary); flex:1; padding: 18px; font-size: 1.1rem; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 10px; border-radius: 12px;" onclick="if(typeof openAdjustBalance === 'function') openAdjustBalance('${user.username}', 'add')">
          <i class="fa-solid fa-plus"></i> ដាក់ប្រាក់
      </button>
    </div>
  `;
}

// ➡️ TAB 3: គ្រប់គ្រងកាត (Virtual Cards Management)
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
      `<div style="text-align:center; padding: 40px; color: var(--text-muted); font-size: 1.1rem;" class="kh-text">អតិថិជននេះមិនទាន់មានកាត (Virtual Card) នៅឡើយទេ។</div>`;
    return;
  }

  let html =
    headerHtml +
    `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 25px;">`;

  user.virtualCards.forEach((c) => {
    const bgGradient =
      c.type === "standard"
        ? "linear-gradient(135deg, #149a83 0%, #00695c 100%)"
        : "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)";
    const chipColor =
      c.type === "standard"
        ? "linear-gradient(135deg, #e2c35d, #c4a038)"
        : "linear-gradient(135deg, #e5e7eb, #94a3b8)";
    const isLocked = c.isLocked;

    html += `
      <div style="display: flex; flex-direction: column; gap: 15px;">
          <div style="background: ${bgGradient}; border-radius: 18px; padding: 25px; color: white; box-shadow: 0 15px 30px rgba(0,0,0,0.15); position: relative; overflow: hidden;">
            ${isLocked ? `<div style="position: absolute; top:0; left:0; right:0; bottom:0; background: rgba(0,0,0,0.5); backdrop-filter: blur(2px); z-index: 10; display: flex; align-items: center; justify-content: center;"><span class="kh-text" style="color: white; border: 3px solid white; padding: 5px 15px; font-weight: 900; font-size: 1.5rem; transform: rotate(-15deg); border-radius: 8px; letter-spacing: 2px;">FROZEN</span></div>` : ""}

            <div style="display: flex; justify-content: space-between; align-items: flex-start; z-index: 1; position: relative;">
                <div style="width: 45px; height: 32px; background: ${chipColor}; border-radius: 6px; box-shadow: inset 0 0 5px rgba(0,0,0,0.3);"></div>
                <div style="font-weight: 800; font-size: 1.3rem; font-family: 'Inter', sans-serif;">U-PAY</div>
            </div>
            
            <div id="c360-cardnum-${c.id}" style="margin-top: 25px; font-size: 1.4rem; letter-spacing: 4px; font-family: 'Courier New', monospace; font-weight: bold; text-shadow: 0 2px 4px rgba(0,0,0,0.5); z-index: 1; position: relative;">
                **** **** **** ${c.number.slice(-4)}
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 25px; z-index: 1; position: relative;">
                <div>
                    <div style="font-size: 0.6rem; opacity: 0.8; letter-spacing: 1px;">CARD HOLDER</div>
                    <div style="font-size: 0.95rem; font-weight: 600; text-transform: uppercase;">${user.fullName || user.username}</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 0.6rem; opacity: 0.8; letter-spacing: 1px;">EXPIRES</div>
                    <div id="c360-cardexp-${c.id}" style="font-size: 0.95rem; font-weight: 600;">**/**</div>
                </div>
                <div style="font-family: 'Inter', sans-serif; font-weight: 900; font-size: 1.6rem; font-style: italic; opacity: 0.9;">VISA</div>
            </div>
          </div>
          
          <div style="display: flex; flex-direction: column; gap: 10px;">
              <div style="display: flex; gap: 10px;">
                  <button onclick="c360RevealCard('${c.id}')" class="kh-text" style="flex: 1; padding: 12px; border-radius: 10px; border: none; background: var(--accent); color: white; font-weight: 600; cursor: pointer; transition: 0.2s;">
                      <i class="fa-solid fa-eye"></i> មើល
                  </button>
                  <button onclick="c360ToggleCard('${c.id}', ${!isLocked})" class="kh-text" style="flex: 1; padding: 12px; border-radius: 10px; border: none; background: ${isLocked ? "var(--secondary)" : "#ef4444"}; color: white; font-weight: 600; cursor: pointer; transition: 0.2s;">
                      <i class="fa-solid ${isLocked ? "fa-unlock" : "fa-lock"}"></i> ${isLocked ? "បើក" : "បិទ"}
                  </button>
                  <button onclick="c360DeleteCard('${c.id}')" class="kh-text" style="flex: 1; padding: 12px; border-radius: 10px; border: none; background: var(--bg-body); color: #ef4444; font-weight: 600; cursor: pointer; transition: 0.2s; border: 1px solid var(--border);">
                      <i class="fa-solid fa-trash"></i> លុប
                  </button>
              </div>
          </div>
      </div>`;
  });
  container.innerHTML = html + `</div>`;
}

async function c360CreateCardForUser() {
  const { value: cardType } = await Swal.fire({
    title:
      '<span class="kh-text" style="font-size:1.4rem;">ជ្រើសរើសប្រភេទកាត</span>',
    html: `
      <div style="display:flex; flex-direction:column; gap:15px; text-align: left; margin-top: 15px;">
          <label style="padding:15px; border:2px solid var(--border); border-radius:12px; cursor:pointer; display:flex; align-items:center; gap:15px; background: var(--bg-body);" onclick="this.style.borderColor='var(--secondary)'">
              <input type="radio" name="swal-card-type" value="platinum" checked style="width:20px; height:20px; accent-color:var(--secondary);">
              <div style="width:60px; height:40px; background:linear-gradient(135deg, #1e293b, #0f172a); border-radius:6px;"></div>
              <div><h4 class="kh-text" style="margin:0; font-size:1rem; color:var(--text-main);">Platinum (កាតខ្មៅ)</h4></div>
          </label>
          <label style="padding:15px; border:2px solid var(--border); border-radius:12px; cursor:pointer; display:flex; align-items:center; gap:15px; background: var(--bg-body);" onclick="this.previousElementSibling.style.borderColor='var(--border)'; this.style.borderColor='var(--secondary)'">
              <input type="radio" name="swal-card-type" value="standard" style="width:20px; height:20px; accent-color:var(--secondary);">
              <div style="width:60px; height:40px; background:linear-gradient(135deg, #149a83, #00695c); border-radius:6px;"></div>
              <div><h4 class="kh-text" style="margin:0; font-size:1rem; color:var(--text-main);">Standard (កាតបៃតង)</h4></div>
          </label>
      </div>`,
    showCancelButton: true,
    confirmButtonText: '<span class="kh-text">បន្ត (Next)</span>',
    cancelButtonText: '<span class="kh-text">បោះបង់</span>',
    confirmButtonColor: "var(--secondary)",
    customClass: { popup: "modal-radius" },
    preConfirm: () =>
      document.querySelector('input[name="swal-card-type"]:checked').value,
  });

  if (cardType) {
    const { value: remark } = await Swal.fire({
      title:
        '<span class="kh-text" style="font-size:1.4rem;">បញ្ជាក់ការបង្កើតកាត</span>',
      html: `
        <div style="text-align:left; font-size:0.95rem; background: var(--bg-body); padding: 15px; border-radius: 10px; border: 1px solid var(--border);" class="kh-text">
            <p style="margin: 0 0 10px; color: var(--text-main);">ប្រភេទកាត: <b style="text-transform:uppercase;">${cardType}</b></p>
            <p style="margin: 0; color: var(--text-main);">ថ្លៃសេវា: <b style="color:#ef4444;">$5.00</b> (កាត់ទៅចូលប្រព័ន្ធ)</p>
        </div>
        <div style="text-align: left; margin-top: 15px;">
            <input id="swal-card-remark" class="swal2-input kh-text" placeholder="មូលហេតុ (Remark)..." style="width: 100%; background: var(--bg-body); color: var(--text-main); border: 1px solid var(--border);">
        </div>`,
      showCancelButton: true,
      confirmButtonText: '<span class="kh-text">បញ្ជាក់ & បង្កើត</span>',
      confirmButtonColor: "var(--secondary)",
      customClass: { popup: "modal-radius" },
      preConfirm: () =>
        document.getElementById("swal-card-remark").value.trim() ||
        "គ្មានមូលហេតុ",
    });

    if (remark) {
      Swal.fire({
        title: "កំពុងដំណើរការ...",
        didOpen: () => Swal.showLoading(),
        customClass: { popup: "premium-swal" },
      });
      try {
        const res = await fetch("/api/admin/create-card", {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            username: currentC360User.username,
            cardType,
          }),
        });
        const data = await res.json();
        if (data.success) {
          await fetch("/api/admin/log-action", {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({
              action: "Created Card",
              target: currentC360User.username,
              details: `បង្កើតកាត ${cardType} - ${remark}`,
            }),
          });
          Swal.fire({
            icon: "success",
            title: "ជោគជ័យ!",
            text: "កាត់លុយ និងបង្កើតកាតរួចរាល់។",
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
}

async function c360RevealCard(cardId) {
  const card = currentC360User.virtualCards.find((c) => c.id === cardId);
  const numEl = document.getElementById(`c360-cardnum-${cardId}`);
  if (numEl.innerText.includes(card.number.slice(0, 4))) {
    numEl.innerText = `**** **** **** ${card.number.slice(-4)}`;
    document.getElementById(`c360-cardexp-${cardId}`).innerText = "**/**";
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
      document.getElementById(`c360-cardnum-${cardId}`).innerText = card.number
        .match(/.{1,4}/g)
        .join(" ");
      document.getElementById(`c360-cardexp-${cardId}`).innerText =
        card.expiryDate || card.expiry || "12/28";
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "បានបញ្ចេញលេខកាត!",
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
  const imgUrl = user.kycImage || user.idCardImage || "";

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

async function c360AdminUploadKyc(event) {
  const file = event.target.files[0];
  if (!file) return;

  Swal.fire({
    title: "កំពុងរៀបចំឯកសារ...",
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading(),
    customClass: { popup: "premium-swal" },
  });
  try {
    const base64Image = await compressImageAndPreview(file);
    const res = await fetch("/api/admin/upload-kyc", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        username: currentC360User.username,
        kycImage: base64Image,
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
      text: "មានបញ្ហាក្នុងការ Upload!",
      customClass: { popup: "premium-swal" },
    });
  }
}

// =======================================================
// 💸 TAB 5: Transactions
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

function renderTrxTab(user) {
  const container = document.getElementById("c360-tab-trx");
  if (!container) return;
  let filterHtml = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; background: var(--bg-card); padding: 15px; border-radius: 15px; border: 1px solid var(--border);">
          <div class="kh-text" style="color: var(--text-muted); font-weight: bold; display: flex; align-items: center; gap: 10px;">
              <i class="fa-solid fa-filter" style="color: var(--accent);"></i> ជ្រើសរើសគណនី
          </div>
          <select id="c360-trx-filter" class="kh-text" style="padding: 10px 15px; border-radius: 10px; border: 1px solid var(--border); outline: none; cursor: pointer; background: var(--bg-body); color: var(--text-main); font-weight: bold;" onchange="c360FilterTrxList()">
              <option value="ALL">ប្រតិបត្តិការទាំងអស់ (All)</option>
              <option value="USD">គណនី USD: ${user.accountNumber || ""}</option>
              ${user.accountNumberKHR ? `<option value="KHR">គណនី KHR: ${user.accountNumberKHR}</option>` : ""}
          </select>
      </div>
      <div id="c360-trx-content"></div>
  `;
  container.innerHTML = filterHtml;
  c360FilterTrxList();
}

window.c360FilterTrxList = function () {
  const user = currentC360User;
  if (!user) return;
  const filterVal = document.getElementById("c360-trx-filter").value;
  const container = document.getElementById("c360-trx-content");

  let trxs = user.transactions || [];
  if (filterVal === "USD")
    trxs = trxs.filter((t) => !t.currency || t.currency === "USD");
  if (filterVal === "KHR") trxs = trxs.filter((t) => t.currency === "KHR");

  if (trxs.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding: 50px 20px; color: var(--text-muted);" class="kh-text">
          <i class="fa-solid fa-folder-open" style="font-size: 3.5rem; opacity: 0.3; margin-bottom: 15px;"></i>
          <h3 style="margin: 0 0 5px;">មិនមានទិន្នន័យទេ</h3>
          <p style="margin: 0; font-size: 0.9rem;">អតិថិជននេះគ្មានប្រវត្តិប្រតិបត្តិការលើគណនីនេះឡើយ។</p>
      </div>`;
    return;
  }

  trxs = [...trxs].reverse();
  let html = "";
  let lastDateLabel = "";

  trxs.slice(0, 100).forEach((t) => {
    const isIncome = t.amount > 0 || t.type === "Received";
    const isPending = t.status === "Pending";
    const isRefunded = t.status === "Refunded";

    let parsedDate = c360ParseDateString(t.date);
    let dateLabel = c360GetSmartDateLabel(parsedDate);

    if (dateLabel !== lastDateLabel) {
      html += `<div class="kh-text" style="font-size: 0.85rem; font-weight: 700; color: var(--text-muted); margin: 20px 0 10px 0; padding: 0 5px; text-transform: uppercase;">${dateLabel}</div>`;
      lastDateLabel = dateLabel;
    }

    let iconClass = isIncome ? "fa-arrow-down" : "fa-arrow-up";
    let bgStyle = isIncome
      ? "background: rgba(16, 185, 129, 0.15); color: var(--secondary);"
      : "background: rgba(239, 68, 68, 0.15); color: #ef4444;";
    if (isPending)
      bgStyle = "background: rgba(245, 158, 11, 0.15); color: #f97316;";
    if (isRefunded)
      bgStyle = "background: var(--bg-body); color: var(--text-muted);";

    let textColor = isIncome ? "var(--secondary)" : "#ef4444";
    if (isPending) textColor = "#f97316";
    if (isRefunded) textColor = "var(--text-muted)";

    let isMerchantTrx =
      t.type === "Merchant Payment" ||
      t.trxMethod === "Merchant Payment" ||
      t.merchantId ||
      t.receiverType === "Merchant";
    if (isMerchantTrx) iconClass = "fa-store";
    else if (t.type === "E-Gift Sent" || t.type === "E-Gift Received")
      iconClass = "fa-gift";
    else if (
      t.type === "Card Issuance Fee" ||
      (t.type && t.type.includes("Fee"))
    ) {
      iconClass = "fa-file-invoice-dollar";
      bgStyle = "background: rgba(245, 158, 11, 0.15); color: #f97316;";
    } else if (t.type === "Promo Reward" || t.type === "Promo Expense")
      iconClass = "fa-tag";
    else if (
      t.type === "Cash Deposit" ||
      t.type === "Cash Withdrawal" ||
      (t.type && t.type.includes("System"))
    )
      iconClass = "fa-money-bill-transfer";

    let title = t.type;
    if (isIncome) title = t.senderName || "Received";
    else
      title =
        t.receiverName ||
        (t.type === "Card Payment" ? "Card Payment" : "Transfer");
    if (title === "U-Pay Central Bank" || title === "U-Pay Bank")
      title = t.type || t.trxMethod || title;

    const displayAmt =
      t.currency === "KHR"
        ? Math.abs(t.amount).toLocaleString() + " ៛"
        : "$" + Math.abs(t.amount).toFixed(2);
    const sign = isIncome ? "+" : "-";
    const timeStr = c360GetTimeString(parsedDate, t.date);

    html += `
      <div onclick="c360ViewTrxDetails('${t.refId}')" style="display: flex; align-items: center; justify-content: space-between; padding: 16px; background: var(--bg-card); border-radius: 16px; margin-bottom: 12px; cursor: pointer; box-shadow: 0 4px 10px rgba(0,0,0,0.02); border: 1px solid var(--border); transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);" onmouseover="this.style.borderColor='var(--accent)'; this.style.transform='translateY(-2px)'" onmouseout="this.style.borderColor='var(--border)'; this.style.transform='translateY(0)'">
          <div style="display: flex; align-items: center; gap: 15px;">
              <div style="${bgStyle} width: 45px; height: 45px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">
                  <i class="fa-solid ${isRefunded ? "fa-rotate-left" : isPending ? "fa-clock-rotate-left" : iconClass}"></i>
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
};

window.c360ViewTrxDetails = function (refId) {
  const t = currentC360User.transactions.find((x) => x.refId === refId);
  if (!t) return;

  const isIncome = t.amount > 0 || t.type === "Received";
  const displayAmt =
    t.currency === "KHR"
      ? Math.abs(t.amount).toLocaleString() + " ៛"
      : "$" + Math.abs(t.amount).toFixed(2);
  const sign = isIncome ? "+" : "-";
  const color = isIncome ? "var(--secondary)" : "#ef4444";

  let statusBadge = "";
  const s = (t.status || "").toLowerCase();
  const successStatus = [
    "completed",
    "success",
    "approved",
    "paid",
    "finished",
  ];

  if (successStatus.includes(s))
    statusBadge = `<span style="background: rgba(16, 185, 129, 0.15); color: var(--secondary); padding: 5px 12px; border-radius: 8px; font-size: 0.85rem; font-weight: bold;"><i class="fa-solid fa-check-circle"></i> ជោគជ័យ</span>`;
  else if (s === "pending")
    statusBadge = `<span style="background: rgba(245, 158, 11, 0.15); color: #f97316; padding: 5px 12px; border-radius: 8px; font-size: 0.85rem; font-weight: bold;"><i class="fa-solid fa-clock"></i> កំពុងរង់ចាំ</span>`;
  else if (s === "refunded")
    statusBadge = `<span style="background: var(--bg-body); color: var(--text-muted); padding: 5px 12px; border-radius: 8px; font-size: 0.85rem; font-weight: bold;"><i class="fa-solid fa-rotate-left"></i> បានបង្វិលសង</span>`;
  else if (s === "failed" || s === "rejected")
    statusBadge = `<span style="background: rgba(239, 68, 68, 0.15); color: #ef4444; padding: 5px 12px; border-radius: 8px; font-size: 0.85rem; font-weight: bold;"><i class="fa-solid fa-times-circle"></i> បរាជ័យ</span>`;
  else
    statusBadge = `<span style="background: var(--bg-body); color: var(--text-muted); padding: 5px 12px; border-radius: 8px; font-size: 0.85rem; font-weight: bold;">${t.status || "N/A"}</span>`;

  let refundBtnHtml = "";
  if (t.amount < 0 && t.status !== "Refunded") {
    refundBtnHtml = `<button onclick="Swal.close(); setTimeout(() => { if(typeof handleAdminAction === 'function') handleAdminAction('refund', '${t.refId}'); setTimeout(c360RefreshData, 1500); }, 300)" class="kh-text" style="width:100%; margin-top:15px; padding: 14px; background: #f59e0b; color: white; border: none; border-radius: 12px; font-weight: bold; font-size: 1.05rem; cursor: pointer; transition: 0.2s; box-shadow: 0 4px 10px rgba(245, 158, 11, 0.2);"><i class="fa-solid fa-rotate-left"></i> ធ្វើការ Refund ប្រាក់ត្រឡប់មកវិញ</button>`;
  }

  Swal.fire({
    title:
      '<span class="kh-text" style="font-size:1.3rem;">វិក្កយបត្រលម្អិត (Receipt)</span>',
    html: `
      <div class="kh-text" style="text-align: left; background: var(--bg-body); padding: 25px 20px; border-radius: 20px; border: 1px solid var(--border); margin-top: 10px;">
          <div style="text-align: center; margin-bottom: 25px;">
              <div style="font-size: 2.2rem; font-weight: 800; color: ${color}; font-family: 'Inter', sans-serif; letter-spacing: -1px;">${sign}${displayAmt}</div>
              <div style="margin-top: 10px;">${statusBadge}</div>
          </div>
          
          <div style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px dashed var(--border); padding-bottom: 12px;">
              <span style="color: var(--text-muted); font-size: 0.9rem;">ប្រភេទ៖</span>
              <span style="font-weight: bold; color: var(--text-main);">${t.type}</span>
          </div>
          <div style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px dashed var(--border); padding-bottom: 12px;">
              <span style="color: var(--text-muted); font-size: 0.9rem;">កាលបរិច្ឆេទ៖</span>
              <span style="font-weight: bold; color: var(--text-main); text-align: right; font-size: 0.9rem;">${t.date}</span>
          </div>
          <div style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px dashed var(--border); padding-bottom: 12px;">
              <span style="color: var(--text-muted); font-size: 0.9rem;">អ្នកផ្ញើ៖</span>
              <span style="font-weight: bold; color: var(--text-main);">${t.senderName || "N/A"}</span>
          </div>
          <div style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px dashed var(--border); padding-bottom: 12px;">
              <span style="color: var(--text-muted); font-size: 0.9rem;">អ្នកទទួល៖</span>
              <span style="font-weight: bold; color: var(--text-main);">${t.receiverName || "N/A"}</span>
          </div>
          <div style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px dashed var(--border); padding-bottom: 12px;">
              <span style="color: var(--text-muted); font-size: 0.9rem;">លេខយោង (Ref)៖</span>
              <span style="font-weight: bold; color: var(--accent); font-family: monospace; font-size: 1.1rem; background: rgba(59, 130, 246, 0.15); padding: 2px 8px; border-radius: 6px;">${t.refId}</span>
          </div>
          <div style="display:flex; justify-content: space-between; align-items: flex-start;">
              <span style="color: var(--text-muted); font-size: 0.9rem; min-width: 80px;">ចំណាំ៖</span>
              <span style="font-weight: 600; color: var(--text-main); text-align: right; font-size: 0.9rem;">${t.description || t.remark || "គ្មាន"}</span>
          </div>
      </div>
      ${refundBtnHtml}
    `,
    showConfirmButton: true,
    confirmButtonText: '<span class="kh-text">បិទ (Close)</span>',
    confirmButtonColor: "var(--primary)",
    customClass: { popup: "modal-radius" },
  });
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
