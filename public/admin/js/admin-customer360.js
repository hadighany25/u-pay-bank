// ========================================================================
// 🛡️ CUSTOMER 360° VIEW LOGIC (BANK-GRADE STANDARD)
// ========================================================================

let currentC360User = null;

// =======================================================
// ១. មុខងារស្វែងរកអតិថិជន
// =======================================================
async function searchCustomer360() {
  const term = document.getElementById("searchC360").value.toLowerCase().trim();
  if (!term) return;

  if (!globalUsersData || globalUsersData.length === 0) {
    Swal.fire({
      title: "កំពុងទាញយកទិន្នន័យ...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });
    if (typeof loadData === "function") await loadData();
    Swal.close();
  }

  const foundUser = globalUsersData.find((u) => {
    const uname = (u.username || "").toLowerCase();
    const fname = (u.fullName || "").toLowerCase();
    const phone = (u.phone || u.phoneNumber || "").toString().toLowerCase();
    const accUSD = (u.accountNumber || "").toString();
    const accKHR = (u.accountNumberKHR || "").toString();
    return (
      uname.includes(term) ||
      fname.includes(term) ||
      phone.includes(term) ||
      accUSD.includes(term) ||
      accKHR.includes(term)
    );
  });

  if (foundUser) renderCustomerProfile(foundUser);
  else
    Swal.fire({
      icon: "error",
      title: "រកមិនឃើញ",
      text: "គ្មានអតិថិជននេះក្នុងប្រព័ន្ធទេ!",
      customClass: { popup: "premium-swal kh-text" },
    });
}

// =======================================================
// ២. មុខងារបង្ហាញទិន្នន័យ Header និង Quick Actions
// =======================================================
function renderCustomerProfile(user) {
  currentC360User = user;

  const emptyState = document.getElementById("c360-empty-state");
  if (emptyState) emptyState.style.display = "none";

  const profileView = document.getElementById("c360-profile-view");
  profileView.style.display = "block";

  document.getElementById("c360-avatar").src =
    user.profileImage || "../images/default-avatar.png";
  document.getElementById("c360-name").innerText =
    user.fullName || user.username || "Unknown";
  document.getElementById("c360-username").innerHTML =
    `<i class="fa-solid fa-at"></i> ${user.username}`;
  document.getElementById("c360-phone").innerHTML =
    `<i class="fa-solid fa-phone"></i> ${user.phone || user.phoneNumber || "N/A"}`;

  // Font ខ្មែរសម្រាប់ Status & ប៊ូតុង
  let statusHtml = user.isFrozen
    ? `<span style="background: #fee2e2; color: #ef4444; padding: 4px 8px; border-radius: 8px; font-weight: bold; font-size: 0.75rem; font-family:'Kantumruy Pro';">FROZEN (ផ្អាក)</span> `
    : `<span style="background: #dcfce7; color: #10b981; padding: 4px 8px; border-radius: 8px; font-weight: bold; font-size: 0.75rem; font-family:'Kantumruy Pro';">ACTIVE (ធម្មតា)</span> `;

  if (user.kycStatus === "verified" || user.kycStatus === "approved")
    statusHtml += `<span style="background: #dbeafe; color: #3b82f6; padding: 4px 8px; border-radius: 8px; font-weight: bold; font-size: 0.75rem;"><i class="fa-solid fa-circle-check"></i> KYC</span>`;
  document.getElementById("c360-status-badge").innerHTML = statusHtml;

  // ប៊ូតុងមាន Font ខ្មែរស្អាត
  // ប៊ូតុងមាន Font ខ្មែរស្អាត និងថែមប៊ូតុង Refresh
  document.getElementById("c360-quick-actions").innerHTML = `
    <button onclick="c360RefreshData()" class="kh-text" style="background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; padding: 10px 15px; border-radius: 10px; cursor: pointer; font-weight: bold; transition: 0.2s;" title="Refresh ទិន្នន័យអតិថិជននេះ">
      <i class="fa-solid fa-arrows-rotate" id="c360-refresh-icon"></i>
    </button>
    <button onclick="c360ToggleFreeze()" class="kh-text" style="background: ${user.isFrozen ? "#10b981" : "#ef4444"}; color: white; border: none; padding: 10px 15px; border-radius: 10px; cursor: pointer; font-weight: bold; transition: 0.2s;">
      <i class="fa-solid ${user.isFrozen ? "fa-unlock" : "fa-lock"}"></i> ${user.isFrozen ? "ដោះសោរ (Unfreeze)" : "ផ្អាក (Freeze)"}
    </button>
    <button onclick="c360OpenFloatingChat()" class="kh-text" style="background: #3b82f6; color: white; border: none; padding: 10px 15px; border-radius: 10px; cursor: pointer; font-weight: bold; transition: 0.2s;">
      <i class="fa-solid fa-comment-dots"></i> ផ្ញើសារ (Chat)
    </button>
  `;

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
  event.currentTarget.classList.add("active");
  document.getElementById(`c360-tab-${tabName}`).style.display = "block";
}

// =======================================================
// មុខងារ Refresh ទិន្នន័យតែអតិថិជនកំពុងមើល (Fast Refresh)
// =======================================================
async function c360RefreshData() {
  if (!currentC360User) return;

  const icon = document.getElementById("c360-refresh-icon");
  if (icon) icon.classList.add("fa-spin"); // ធ្វើឱ្យ Icon វិល

  try {
    // ហៅ API ទាញតែទិន្នន័យ User នេះម្នាក់ឯង (ដើរលឿនបំផុត)
    const res = await fetch("/api/admin/get-user", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ username: currentC360User.username }),
    });
    const data = await res.json();

    if (data.success && data.user) {
      // Update ទិន្នន័យក្នុង RAM និងគូរអេក្រង់ឡើងវិញ
      renderCustomerProfile(data.user);

      // ក៏ Update ទិន្នន័យនេះចូលក្នុង globalUsersData ដែរ ការពារពេលចាកចេញ
      const index = globalUsersData.findIndex(
        (u) => u.username === data.user.username,
      );
      if (index !== -1) globalUsersData[index] = data.user;

      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "ទិន្នន័យបានធ្វើបច្ចុប្បន្នភាព",
        showConfirmButton: false,
        timer: 1500,
      });
    } else {
      Swal.fire("Error", "រកមិនឃើញទិន្នន័យថ្មីទេ", "error");
    }
  } catch (e) {
    Swal.fire("Error", "បញ្ហាភ្ជាប់ទៅកាន់ Server", "error");
  } finally {
    if (icon) icon.classList.remove("fa-spin"); // បញ្ឈប់ការវិល
  }
}

// =======================================================
// ៣. អនុវត្ត TABS ទាំង ៨
// =======================================================

// ➡️ TAB 1: ព័ត៌មានទូទៅ (Information) - ធ្វើឱ្យ Professional
function renderInfoTab(user) {
  const container = document.getElementById("c360-tab-info");
  const dateCreated = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString("km-KH")
    : "មិនស្គាល់";

  // ជួរទី១ មាន ៣, ជួរទី២ មាន ២
  container.innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px;">
      <div class="form-group">
        <label class="kh-text" style="font-weight:600; color:var(--text-muted);">ឈ្មោះពេញ (Full Name)</label>
        <input type="text" id="c360-edit-fullname" class="form-input kh-text" value="${user.fullName || ""}" />
      </div>
      <div class="form-group">
        <label class="kh-text" style="font-weight:600; color:var(--text-muted);">ឈ្មោះប្រើប្រាស់ (Username)</label>
        <input type="text" class="form-input" value="${user.username}" readonly style="background: #f8fafc; cursor: not-allowed; color: #94a3b8; font-weight:bold;" title="មិនអាចកែប្រែបានទេ ការពារការបាត់បង់ទិន្នន័យ" />
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
        <input type="text" class="form-input kh-text" value="${dateCreated}" readonly style="background: #f8fafc; cursor: not-allowed;" />
      </div>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px;">
      <div class="form-group" style="border: 1px solid var(--border); padding: 15px; border-radius: 10px; background: white;">
        <label class="kh-text" style="color: var(--danger); font-weight:600;"><i class="fa-solid fa-key"></i> ប្តូរ ឬ Reset PIN</label>
        <div style="position: relative; margin-top: 10px;">
          <input type="password" maxlength="4" id="c360-edit-pin" class="form-input" placeholder="វាយ PIN ៤ខ្ទង់ថ្មី ទីនេះ" value="${user.pin || ""}" style="padding-right: 40px; margin:0;" />
          <i class="fa-solid fa-eye-slash" onclick="toggleSensitiveView('c360-edit-pin', this, 'PIN')" style="position: absolute; right: 15px; top: 50%; transform: translateY(-50%); cursor: pointer; color: #94a3b8; font-size: 1.1rem;"></i>
        </div>
      </div>
      <div class="form-group" style="border: 1px solid var(--border); padding: 15px; border-radius: 10px; background: white;">
        <label class="kh-text" style="color: var(--danger); font-weight:600;"><i class="fa-solid fa-lock"></i> ប្តូរ Password ថ្មី</label>
        <div style="position: relative; margin-top: 10px;">
          <input type="password" id="c360-edit-pass" class="form-input" placeholder="ទុកទទេបើមិនចង់ប្តូរ" value="*********" style="padding-right: 40px; margin:0;" />
          <i class="fa-solid fa-eye-slash" onclick="toggleSensitiveView('c360-edit-pass', this, 'Password')" style="position: absolute; right: 15px; top: 50%; transform: translateY(-50%); cursor: pointer; color: #94a3b8; font-size: 1.1rem;"></i>
        </div>
      </div>
    </div>

    <button class="btn-primary kh-text" style="width: 100%; display: block; text-align: center; margin-top: 25px; padding: 18px; font-size: 1.1rem; background: #0f172a; box-shadow: 0 10px 20px rgba(0,0,0,0.1);" onclick="saveC360Info()">
      <i class="fa-solid fa-floppy-disk" style="margin-right: 8px;"></i> រក្សាទុកការកែប្រែ (Save Changes)
    </button>
  `;
}

// មុខងារបើក/បិទ ភ្នែក និងកត់ត្រា Logs
async function toggleSensitiveView(inputId, iconEl, type) {
  const input = document.getElementById(inputId);
  const isPassword = input.type === "password";

  if (isPassword) {
    input.type = "text";
    iconEl.classList.remove("fa-eye-slash");
    iconEl.classList.add("fa-eye");
    iconEl.style.color = "#3b82f6"; // ដូរពណ៌ពេលបើកមើល

    if (type === "Password") {
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "info",
        title: "Password ត្រូវបាន Hashed ការពារសុវត្ថិភាព",
      });
    }

    // បាញ់ API កត់ត្រាចូល Admin Logs ស្ងាត់ៗ
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
    iconEl.style.color = "#94a3b8";
  }
}

// Save ការកែប្រែក្នុង Tab 1
async function saveC360Info() {
  const pinVal = document.getElementById("c360-edit-pin").value;
  const passVal = document.getElementById("c360-edit-pass").value;

  const bodyData = {
    id: currentC360User._id || currentC360User.id,
    fullName: document.getElementById("c360-edit-fullname").value,
    phoneNumber: document.getElementById("c360-edit-phone").value,
    email: document.getElementById("c360-edit-email").value,
    accountNumber: currentC360User.accountNumber,
    pin: pinVal,
    password: passVal === "*********" ? "" : passVal,
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
        customClass: { popup: "kh-text" },
      });

      // កត់ត្រា Logs ពេលកែប្រែ PIN/Password
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

      if (typeof loadData === "function") loadData();
    } else throw new Error(data.message);
  } catch (e) {
    Swal.fire("បរាជ័យ", "មិនអាចកែប្រែបានទេ", "error");
  }
}

// ➡️ TAB 2: Wallets (គណនីហិរញ្ញវត្ថុ)
function renderWalletsTab(user) {
  const container = document.getElementById("c360-tab-finance");
  container.innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
      <div class="dash-card" style="border-left: 5px solid #3b82f6;">
        <h4 style="margin: 0 0 10px; color: var(--text-muted);" class="kh-text">គណនី USD ($)</h4>
        <h2 style="margin: 0 0 10px; color: var(--primary); font-size: 2rem;">$${(user.balance || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</h2>
        <p style="margin:0; font-family: monospace; color: var(--text-muted);">Acc: ${user.accountNumber || "N/A"}</p>
      </div>
      <div class="dash-card" style="border-left: 5px solid #10b981;">
        <h4 style="margin: 0 0 10px; color: var(--text-muted);" class="kh-text">គណនី KHR (៛)</h4>
        <h2 style="margin: 0 0 10px; color: var(--primary); font-size: 2rem;">${(user.balanceKHR || 0).toLocaleString()} ៛</h2>
        <p style="margin:0; font-family: monospace; color: var(--text-muted);">Acc: ${user.accountNumberKHR || "N/A"}</p>
      </div>
    </div>
    
    <div style="display: flex; gap: 15px; margin-top: 20px;">
    <button class="btn-primary kh-text" 
        style="background: #ef4444; flex:1; padding: 18px; font-size: 1.1rem; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 10px; border-radius: 12px;" 
        onclick="c360AdjustBalance('deduct')">
        <i class="fa-solid fa-minus"></i> ដកប្រាក់
    </button>
    <button class="btn-primary kh-text" 
        style="background: #10b981; flex:1; padding: 18px; font-size: 1.1rem; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 10px; border-radius: 12px;" 
        onclick="c360AdjustBalance('add')">
        <i class="fa-solid fa-plus"></i> ដាក់ប្រាក់
    </button>
</div>
  `;
}

function c360AdjustBalance(type) {
  const isAdd = type === "add";
  const titleText = isAdd ? "ដាក់ប្រាក់ចូលគណនី" : "ដកប្រាក់ចេញពីគណនី";
  const themeColor = isAdd ? "#10b981" : "#ef4444";

  Swal.fire({
    title: `<span style="font-size: 1.5rem; font-weight: 700; color: #1e293b;" class="kh-text">${titleText}</span>`,
    html: `
      <div style="text-align: left; font-family: 'Kantumruy Pro'; padding: 10px;">
        <div style="margin-bottom: 15px;">
            <label class="kh-text" style="font-size: 0.8rem; color: #64748b; font-weight: 600;">ឈ្មោះអតិថិជន</label>
            <div style="font-size: 1.1rem; font-weight: 700; color: #0f172a; padding: 10px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
                ${currentC360User.fullName || currentC360User.username}
            </div>
        </div>

        <div style="margin-bottom: 15px;">
            <label class="kh-text" style="font-size: 0.8rem; color: #64748b; font-weight: 600;">ជ្រើសរើសលេខគណនី</label>
            <select id="adjAccNum" class="swal2-input" style="width: 100%; margin: 5px 0; font-size: 1rem;">
                <option value="${currentC360User.accountNumber}">USD: ${currentC360User.accountNumber}</option>
                ${currentC360User.accountNumberKHR ? `<option value="${currentC360User.accountNumberKHR}">KHR: ${currentC360User.accountNumberKHR}</option>` : ""}
            </select>
        </div>

        <div style="margin-bottom: 15px;">
            <label class="kh-text" style="font-size: 0.8rem; color: #64748b; font-weight: 600;">ចំនួនទឹកប្រាក់</label>
            <input id="adjAmount" class="swal2-input" type="number" placeholder="ឧ. 100.00" style="width: 100%; margin: 5px 0; font-size: 1.1rem; border: 2px solid ${themeColor}40;">
        </div>
        
        <div style="margin-bottom: 5px;">
            <label class="kh-text" style="font-size: 0.8rem; color: #64748b; font-weight: 600;">មូលហេតុ (Remark)</label>
            <input id="adjRemark" class="swal2-input" placeholder="សរសេរមូលហេតុនៅទីនេះ..." style="width: 100%; margin: 5px 0;">
        </div>
      </div>`,
    showCancelButton: true,
    confirmButtonColor: themeColor,
    cancelButtonColor: "#64748b",
    confirmButtonText:
      '<span class="kh-text" style="font-size: 1rem;">បញ្ជាក</span>',
    cancelButtonText:
      '<span class="kh-text" style="font-size: 1rem;">បោះបង់</span>',
    customClass: {
      popup: "modal-radius", // ដាក់ Border Radius ឱ្យស្អាត
    },
    preConfirm: () => {
      const amount = document.getElementById("adjAmount").value;
      if (!amount || amount <= 0)
        Swal.showValidationMessage("សូមបញ្ចូលចំនួនទឹកប្រាក់ឱ្យបានត្រឹមត្រូវ!");
      return {
        accountNumber: document.getElementById("adjAccNum").value,
        amount,
        remark: document.getElementById("adjRemark").value,
      };
    },
  }).then(async (result) => {
    if (result.isConfirmed) {
      Swal.fire({
        title: "កំពុងដំណើរការ...",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });
      try {
        const res = await fetch("/api/admin/adjust-balance", {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            username: currentC360User.username,
            amount: result.value.amount,
            accountNumber: result.value.accountNumber, // ផ្ញើលេខគណនីដែលជ្រើសរើសទៅ Backend
            remark: result.value.remark,
            type: type,
          }),
        });
        const data = await res.json();
        if (data.success) {
          Swal.fire({
            icon: "success",
            title: "ជោគជ័យ!",
            text: "ទិន្នន័យត្រូវបានអាប់ដេត!",
            timer: 1200,
            showConfirmButton: false,
          });
          if (typeof loadData === "function") loadData();
        } else Swal.fire("បរាជ័យ", data.message, "error");
      } catch (e) {
        Swal.fire("Error", "មានបញ្ហា Server", "error");
      }
    }
  });
}

// =======================================================
// 💳 TAB 3: គ្រប់គ្រងកាត (Virtual Cards Management)
// =======================================================

function renderCardsTab(user) {
  const container = document.getElementById("c360-tab-cards");
  let headerHtml = `
    <div style="margin-bottom: 25px;">
        <button class="btn-primary kh-text" style="width: 100%; padding: 18px; font-size: 1.1rem; background: #0f172a; border-radius: 15px; box-shadow: 0 8px 15px rgba(0,0,0,0.1); display: flex; align-items: center; justify-content: center; gap: 10px; transition: 0.2s;" onclick="c360CreateCardForUser()">
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
                  <button onclick="c360RevealCard('${c.id}')" class="kh-text" style="flex: 1; padding: 12px; border-radius: 10px; border: none; background: #3b82f6; color: white; font-weight: 600; cursor: pointer; transition: 0.2s;">
                      <i class="fa-solid fa-eye"></i> មើល
                  </button>
                  <button onclick="c360ToggleCard('${c.id}', ${!isLocked})" class="kh-text" style="flex: 1; padding: 12px; border-radius: 10px; border: none; background: ${isLocked ? "#10b981" : "#ef4444"}; color: white; font-weight: 600; cursor: pointer; transition: 0.2s;">
                      <i class="fa-solid ${isLocked ? "fa-unlock" : "fa-lock"}"></i> ${isLocked ? "បើក" : "បិទ"}
                  </button>
                  <button onclick="c360DeleteCard('${c.id}')" class="kh-text" style="flex: 1; padding: 12px; border-radius: 10px; border: none; background: #f1f5f9; color: #ef4444; font-weight: 600; cursor: pointer; transition: 0.2s; border: 1px solid #e2e8f0;">
                      <i class="fa-solid fa-trash"></i> លុប
                  </button>
              </div>
          </div>
      </div>`;
  });
  container.innerHTML = html + `</div>`;
}

// -------------------------------------------------------
// មុខងារទី ១៖ បង្កើតកាតថ្មី (Create Card) ពី Admin
// -------------------------------------------------------
async function c360CreateCardForUser() {
  const { value: cardType } = await Swal.fire({
    title:
      '<span class="kh-text" style="font-size:1.4rem;">ជ្រើសរើសប្រភេទកាត</span>',
    html: `
            <div style="display:flex; flex-direction:column; gap:15px; text-align: left; margin-top: 15px;">
                <label style="padding:15px; border:2px solid #e2e8f0; border-radius:12px; cursor:pointer; display:flex; align-items:center; gap:15px;" onclick="this.style.borderColor='#004d40'">
                    <input type="radio" name="swal-card-type" value="platinum" checked style="width:20px; height:20px; accent-color:#004d40;">
                    <div style="width:60px; height:40px; background:linear-gradient(135deg, #1e293b, #0f172a); border-radius:6px;"></div>
                    <div><h4 class="kh-text" style="margin:0; font-size:1rem; color:#1e293b;">Platinum (កាតខ្មៅ)</h4></div>
                </label>
                <label style="padding:15px; border:2px solid #e2e8f0; border-radius:12px; cursor:pointer; display:flex; align-items:center; gap:15px;" onclick="this.previousElementSibling.style.borderColor='#e2e8f0'; this.style.borderColor='#004d40'">
                    <input type="radio" name="swal-card-type" value="standard" style="width:20px; height:20px; accent-color:#004d40;">
                    <div style="width:60px; height:40px; background:linear-gradient(135deg, #149a83, #00695c); border-radius:6px;"></div>
                    <div><h4 class="kh-text" style="margin:0; font-size:1rem; color:#1e293b;">Standard (កាតបៃតង)</h4></div>
                </label>
            </div>`,
    showCancelButton: true,
    confirmButtonText: '<span class="kh-text">បន្ត (Next)</span>',
    cancelButtonText: '<span class="kh-text">បោះបង់</span>',
    confirmButtonColor: "#004d40",
    customClass: { popup: "modal-radius" },
    preConfirm: () =>
      document.querySelector('input[name="swal-card-type"]:checked').value,
  });

  if (cardType) {
    const { value: remark } = await Swal.fire({
      title:
        '<span class="kh-text" style="font-size:1.4rem;">បញ្ជាក់ការបង្កើតកាត</span>',
      html: `
                <div style="text-align:left; font-size:0.95rem; background: #f8fafc; padding: 15px; border-radius: 10px;" class="kh-text">
                    <p style="margin: 0 0 10px;">ប្រភេទកាត: <b style="text-transform:uppercase;">${cardType}</b></p>
                    <p style="margin: 0;">ថ្លៃសេវា: <b style="color:#ef4444;">$5.00</b> (កាត់ទៅចូលប្រព័ន្ធ)</p>
                </div>
                <div style="text-align: left; margin-top: 15px;">
                    <input id="swal-card-remark" class="swal2-input kh-text" placeholder="មូលហេតុ (Remark)..." style="width: 100%;">
                </div>`,
      showCancelButton: true,
      confirmButtonText: '<span class="kh-text">បញ្ជាក់ & បង្កើត</span>',
      confirmButtonColor: "#10b981",
      customClass: { popup: "modal-radius" },
      preConfirm: () =>
        document.getElementById("swal-card-remark").value.trim() ||
        "គ្មានមូលហេតុ",
    });

    if (remark) {
      Swal.fire({
        title: "កំពុងដំណើរការ...",
        didOpen: () => Swal.showLoading(),
      });
      try {
        // ហៅទៅ API Admin ថ្មីដែលយើងទើបបង្កើត
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
          });
          if (typeof loadData === "function") loadData();
        } else Swal.fire("បរាជ័យ", data.message, "error");
      } catch (e) {
        Swal.fire("Error", "មានបញ្ហា Server", "error");
      }
    }
  }
}

// -------------------------------------------------------
// មុខងារទី ២៖ មើលលេខកាតពេញ និង EXP (Reveal Card)
// -------------------------------------------------------
async function c360RevealCard(cardId) {
  const card = currentC360User.virtualCards.find((c) => c.id === cardId);

  // បើលេខបង្ហាញរួចហើយ ចុចម្តងទៀតអោយបិទវិញ
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
                <label class="kh-text" style="font-size: 0.85rem; font-weight: 600; color: #475569;">មូលហេតុ (Remark)</label>
                <input id="swal-reveal-remark" class="swal2-input kh-text" placeholder="បញ្ចូលមូលហេតុ..." style="width: 100%; margin: 5px 0 0;">
            </div>`,
    showCancelButton: true,
    confirmButtonText: '<span class="kh-text">បញ្ជាក់ (Confirm)</span>',
    cancelButtonText: '<span class="kh-text">បោះបង់</span>',
    confirmButtonColor: "#3b82f6",
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

      // 🚀 ប្តូរលេខ និង EXP នៅលើកាតផ្ទាល់តែម្តង
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
      });
    } catch (e) {}
  }
}

// -------------------------------------------------------
// មុខងារទី ៣៖ បិទ/បើកកាត (Toggle Freeze)
// -------------------------------------------------------
async function c360ToggleCard(cardId, isLocked) {
  const card = currentC360User.virtualCards.find((c) => c.id === cardId);
  const actionText = isLocked ? "បិទកាត (Freeze)" : "បើកកាត (Unfreeze)";
  const themeColor = isLocked ? "#ef4444" : "#10b981";

  const { value: remark } = await Swal.fire({
    title: `<span class="kh-text" style="font-size:1.4rem; color: ${themeColor};">${actionText}</span>`,
    html: `
            <div style="text-align: left; padding: 10px;">
                <label class="kh-text" style="font-size: 0.85rem; font-weight: 600; color: #475569;">មូលហេតុនៃការ${actionText} (Remark)</label>
                <input id="swal-toggle-remark" class="swal2-input kh-text" placeholder="បញ្ចូលមូលហេតុ..." style="width: 100%; margin: 5px 0 0;">
            </div>
        `,
    showCancelButton: true,
    confirmButtonText: '<span class="kh-text">បញ្ជាក់ (Confirm)</span>',
    cancelButtonText: '<span class="kh-text">បោះបង់</span>',
    confirmButtonColor: themeColor,
    customClass: { popup: "modal-radius" },
    preConfirm: () => {
      const remark = document.getElementById("swal-toggle-remark").value.trim();
      if (!remark) Swal.showValidationMessage("សូមបញ្ចូលមូលហេតុ!");
      return remark;
    },
  });

  if (remark) {
    Swal.fire({
      title: "កំពុងដំណើរការ...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });
    try {
      // ហៅ API បិទ/បើកកាត
      const res = await fetch("/api/admin/toggle-card-lock", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          username: currentC360User.username,
          cardId,
          isLocked,
        }),
      });
      const data = await res.json();

      if (data.success) {
        // កត់ត្រាចូល Logs
        await fetch("/api/admin/log-action", {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            action: isLocked ? "Frozen Card" : "Unfrozen Card",
            target: currentC360User.username,
            details: `${actionText} លេខកាត ${card.number.slice(-4)} - មូលហេតុ: ${remark}`,
          }),
        });

        Swal.fire({
          icon: "success",
          title: "ជោគជ័យ!",
          text: `កាតត្រូវបាន ${isLocked ? "បិទ" : "បើក"} រួចរាល់។`,
          timer: 1500,
          showConfirmButton: false,
        });
        if (typeof loadData === "function") loadData(); // Reload UI
      } else Swal.fire("បរាជ័យ", data.message, "error");
    } catch (e) {
      Swal.fire("Error", "មានបញ្ហា Server", "error");
    }
  }
}

// -------------------------------------------------------
// មុខងារទី ៤៖ លុបកាតចោលទាំងស្រុង (Delete Card)
// -------------------------------------------------------
async function c360DeleteCard(cardId) {
  const { value: remark } = await Swal.fire({
    title:
      '<span class="kh-text" style="font-size:1.4rem; color: #ef4444;">លុបកាតនេះចោល?</span>',
    html: `<input id="swal-del-remark" class="swal2-input kh-text" placeholder="មូលហេតុលុបកាត..." style="width: 100%;">`,
    showCancelButton: true,
    confirmButtonText: '<span class="kh-text">លុបចោល (Delete)</span>',
    confirmButtonColor: "#ef4444",
    customClass: { popup: "modal-radius" },
    preConfirm: () => document.getElementById("swal-del-remark").value.trim(),
  });

  if (remark) {
    Swal.fire({ title: "កំពុងលុប...", didOpen: () => Swal.showLoading() });
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
        // ១. អាប់ដេតទិន្នន័យក្នុង RAM របស់អតិថិជនបច្ចុប្បន្ន
        currentC360User.balance = data.newBalance;
        currentC360User.virtualCards = data.newCards;

        // ២. បញ្ជាឱ្យគូរផ្ទាំងកាត និងផ្ទាំងលុយឡើងវិញភ្លាមៗ (កុំឱ្យចាំបាច់ Refresh)
        renderCardsTab(currentC360User);
        renderWalletsTab(currentC360User);

        // ៣. កត់ត្រាចូល Logs
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
          text: "កាត់លុយ $5.00 និងបង្កើតកាតរួចរាល់។",
          timer: 1500,
          showConfirmButton: false,
        });

        if (typeof loadData === "function") loadData(); // Update តារាងធំខាងក្រៅ
      } else Swal.fire("បរាជ័យ", data.message, "error");
    } catch (e) {
      Swal.fire("Error", "មានបញ្ហា Server", "error");
    }
  }
}

// ➡️ TAB 4: KYC & Identity - ឯកសារបញ្ជាក់អត្តសញ្ញាណ
function renderKycTab(user) {
  const container = document.getElementById("c360-tab-kyc");
  if (!user.kycDocument) {
    container.innerHTML = `<div style="text-align:center; padding: 40px; color: var(--text-muted);">អតិថិជននេះមិនទាន់បានបញ្ជូនឯកសារ KYC មកទេ។</div>`;
    return;
  }

  let actionBtns = "";
  if (user.kycStatus === "pending") {
    actionBtns = `
        <button class="btn-primary" style="background:#10b981; flex:1;" onclick="c360KycAction('approved')"><i class="fa-solid fa-check"></i> អនុម័ត (Approve)</button>
        <button class="btn-primary" style="background:#ef4444; flex:1;" onclick="c360KycAction('rejected')"><i class="fa-solid fa-xmark"></i> បដិសេធ (Reject)</button>`;
  } else {
    actionBtns = `<button class="btn-primary" style="background:#ef4444; width:100%;" onclick="c360KycAction('rejected')"><i class="fa-solid fa-ban"></i> បដិសេធសិទ្ធិវិញ (Revoke KYC)</button>`;
  }

  container.innerHTML = `
    <h4 style="margin-top:0;">ឯកសារអត្តសញ្ញាណប័ណ្ណ / លិខិតឆ្លងដែន</h4>
    <img src="${user.kycDocument}" style="max-width: 400px; max-height: 250px; border-radius: 15px; border: 1px solid var(--border); object-fit: cover; box-shadow: 0 4px 10px rgba(0,0,0,0.05);" />
    <div style="margin-top: 20px; display: flex; gap: 15px; max-width: 400px;">
      ${actionBtns}
    </div>
  `;
}

// Action អនុម័ត ឬ បដិសេធ KYC (កែសម្រួល ១០០%)
async function c360KycAction(action) {
  // ១. បញ្ជាក់មូលហេតុ (អ្នកចង់បាន Feature នេះ)
  const { value: remark } = await Swal.fire({
    title: '<span class="kh-text">បញ្ជាក់មូលហេតុ</span>',
    input: "text",
    inputPlaceholder: "បញ្ចូលមូលហេតុ...",
    showCancelButton: true,
    confirmButtonText: "បញ្ជាក់",
    cancelButtonText: "បោះបង់",
  });

  if (!remark) return; // បើមិនវាយមូលហេតុ មិនឱ្យបន្ត

  try {
    Swal.fire({ title: "កំពុងដំណើរការ...", didOpen: () => Swal.showLoading() });

    const res = await fetch("/api/admin/kyc-action", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        username: currentC360User.username,
        action,
        remark, // បញ្ជូន Remark ទៅ Backend ផង
      }),
    });
    const data = await res.json();

    if (data.success) {
      // ២. Update RAM Data ឱ្យត្រឹមត្រូវ
      if (action === "approve") currentC360User.kycStatus = "approved";
      else if (action === "reject") currentC360User.kycStatus = "rejected";
      else if (action === "revoke") currentC360User.kycStatus = "revoked";

      // ៣. លុបឯកសារចោល បើករណី Reject/Revoke ដើម្បីឱ្យវាលោតទៅផ្ទាំង Upload វិញ
      if (action === "reject" || action === "revoke") {
        currentC360User.kycImage = "";
      }

      Swal.fire({
        icon: "success",
        title: "ជោគជ័យ",
        timer: 1200,
        showConfirmButton: false,
      });

      // ៤. គូរ UI ទាំងមូលឡើងវិញដើម្បីឱ្យផ្ទាំងប្តូរពណ៌/ប៊ូតុង
      renderCustomerProfile(currentC360User);
      renderKycTab(currentC360User); // 🔥 នេះជាគន្លឹះ៖ ហៅមុខងារគូរផ្ទាំង KYC ផ្ទាល់តែម្តង
    } else {
      Swal.fire("បរាជ័យ", data.message, "error");
    }
  } catch (e) {
    Swal.fire("Error", "មានបញ្ហាបច្ចេកទេស", "error");
  }
}

// ➡️ TAB 5: Transactions (ប្រវត្តិប្រតិបត្តិការ)
function renderTrxTab(user) {
  const container = document.getElementById("c360-tab-trx");
  if (!user.transactions || user.transactions.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding: 40px; color: var(--text-muted);">អតិថិជននេះគ្មានប្រវត្តិប្រតិបត្តិការទេ។</div>`;
    return;
  }

  let html = `<table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
    <thead><tr style="background:#f8fafc; text-align:left;">
        <th style="padding:12px;">កាលបរិច្ឆេទ</th>
        <th style="padding:12px;">Ref ID</th>
        <th style="padding:12px;">ប្រភេទ</th>
        <th style="padding:12px;">ទឹកប្រាក់</th>
        <th style="padding:12px; text-align:right;">សកម្មភាព</th>
    </tr></thead><tbody>`;

  // តម្រៀបពីថ្មីទៅចាស់ ហើយបង្ហាញត្រឹម ៥០ ប្រតិបត្តិការដើម
  [...user.transactions]
    .reverse()
    .slice(0, 50)
    .forEach((t) => {
      let color = t.type === "Received" || t.amount > 0 ? "#10b981" : "#ef4444";
      let sign = t.type === "Received" || t.amount > 0 ? "+" : "";
      html += `
    <tr style="border-bottom: 1px solid var(--border);">
      <td style="padding:12px; color: var(--text-muted);">${t.date}</td>
      <td style="padding:12px; font-family:'JetBrains Mono', monospace; font-weight: 600;">${t.refId}</td>
      <td style="padding:12px;">${t.type}</td>
      <td style="padding:12px; font-weight:bold; color:${color}; font-family:'JetBrains Mono', monospace;">${sign}${t.amount} ${t.currency}</td>
      <td style="padding:12px; text-align:right; display: flex; justify-content: flex-end; gap: 5px;">
        <button onclick="c360Refund('${t.refId}')" class="btn-action" style="background:#f59e0b;" title="Refund" ${t.amount > 0 || t.status === "Refunded" ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ""}><i class="fa-solid fa-rotate-left"></i></button>
        <button onclick="document.getElementById('searchTrxId').value='${t.refId}'; showSection('check-trx'); searchTrx();" class="btn-action" style="background:#3b82f6;" title="Trace Trx"><i class="fa-solid fa-magnifying-glass"></i></button>
      </td>
    </tr>`;
    });
  container.innerHTML = html + `</tbody></table>`;
}

// Action Refund លុយ
async function c360Refund(refId) {
  const { value: reason } = await Swal.fire({
    title: "Refund លុយត្រឡប់វិញ",
    input: "text",
    inputPlaceholder: "បញ្ជាក់មូលហេតុ",
    showCancelButton: true,
  });
  if (reason) {
    try {
      const res = await fetch("/api/admin/refund-transaction", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ refId, reason }),
      });
      const data = await res.json();
      Swal.fire(
        data.success ? "ជោគជ័យ" : "បរាជ័យ",
        data.message,
        data.success ? "success" : "error",
      );
    } catch (e) {
      Swal.fire("Error", "Server Error", "error");
    }
  }
}

// ➡️ TAB 6: Security (សន្តិសុខគណនី)
function renderSecurityTab(user) {
  const container = document.getElementById("c360-tab-security");
  container.innerHTML = `
    <div class="dash-card">
      <h4 style="margin-top:0;">កំណត់ត្រាសុវត្ថិភាព និងឧបករណ៍</h4>
      <p style="margin: 10px 0;">IP ចូលប្រើចុងក្រោយ: <span style="font-family:monospace; background:#f1f5f9; padding: 2px 6px; border-radius: 4px;">${user.lastLoginIp || "N/A"}</span></p>
      <p style="margin: 10px 0;">ឧបករណ៍ (Device): <span style="font-family:monospace; background:#f1f5f9; padding: 2px 6px; border-radius: 4px;">${user.lastLoginDevice || "Mobile Application"}</span></p>
      <p style="margin: 10px 0; color:var(--danger);">ការវាយ PIN ខុស: <b>${user.pinAttempts || 0} ដង</b></p>
      
      <div style="margin-top: 25px; display: flex; gap: 15px; border-top: 1px dashed var(--border); padding-top: 20px;">
        <button class="btn-primary" style="background:#10b981; flex:1;" onclick="c360ClearPinAttempts()"><i class="fa-solid fa-unlock-keyhole"></i> Clear PIN Attempts</button>
        <button class="btn-primary" style="background:#ef4444; flex:1;" onclick="Swal.fire('មុខងារ Force Logout','នឹងមានឆាប់ៗនេះ','info')"><i class="fa-solid fa-power-off"></i> Force Logout</button>
      </div>
    </div>`;
}

async function c360ClearPinAttempts() {
  try {
    await fetch("/api/admin/toggle-freeze", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ id: currentC360User._id, isFrozen: false }),
    });
    Swal.fire({
      toast: true,
      position: "top-end",
      icon: "success",
      title: "ដោះសោរ PIN ជោគជ័យ",
      showConfirmButton: false,
      timer: 1500,
    });
  } catch (e) {}
}

// ➡️ TAB 7: Merchant (ហាងអាជីវកម្ម)
function renderMerchantTab(user) {
  const container = document.getElementById("c360-tab-merchant");

  // ស្វែងរកហាងក្នុង globalMerchantsData (Load ពី admin-merchants.js)
  let userShops = [];
  if (typeof globalMerchantsData !== "undefined") {
    userShops = globalMerchantsData.filter((m) => m.userId === user.username);
  }

  if (userShops.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding: 40px; color: var(--text-muted);">អតិថិជននេះមិនទាន់មានអាជីវកម្ម (Merchant) ទេ។</div>`;
    return;
  }

  let html = `<div style="display: grid; gap: 15px;">`;
  userShops.forEach((m) => {
    html += `
      <div class="dash-card" style="display:flex; justify-content:space-between; align-items:center;">
        <div style="display: flex; gap: 15px; align-items:center;">
          <div style="width:50px; height:50px; background:#e0f2fe; color:#0284c7; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:1.5rem;"><i class="fa-solid fa-store"></i></div>
          <div>
            <h3 style="margin:0 0 5px;">${m.name}</h3>
            <span style="font-size:0.85rem; color:var(--text-muted); font-family: 'JetBrains Mono', monospace;">MID: ${m.merchantId} | ប្រភេទ: ${m.category || "Other"}</span>
          </div>
        </div>
        <div style="display:flex; gap:10px;">
            <button class="btn-action" style="background:#f59e0b;" title="Edit Shop" onclick="if(typeof editMerchantByAdmin === 'function') editMerchantByAdmin('${m._id}')"><i class="fa-solid fa-pen"></i> Edit</button>
            <button class="btn-action btn-delete" title="Delete Shop" onclick="if(typeof deleteMerchantByAdmin === 'function') deleteMerchantByAdmin('${m._id}')"><i class="fa-solid fa-trash"></i> Delete</button>
        </div>
      </div>`;
  });
  container.innerHTML = html + `</div>`;
}

// ➡️ TAB 8: Admin Logs (កំណត់ត្រាសកម្មភាព)
async function renderLogsTab(user) {
  const container = document.getElementById("c360-tab-logs");
  container.innerHTML = `<div style="text-align:center; padding: 40px;"><i class="fa-solid fa-circle-notch fa-spin fa-2x" style="color:var(--text-muted);"></i><br><br>កំពុងទាញយកកំណត់ត្រា...</div>`;

  try {
    const res = await fetch("/api/admin/logs", { headers: getAuthHeaders() });
    const data = await res.json();
    if (data.success) {
      // ទាញយកតែ Logs ណាដែល Target ស្មើនឹង Username របស់គាត់
      const userLogs = data.logs.filter((l) => l.target === user.username);
      if (userLogs.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding: 40px; color: var(--text-muted);">គ្មានកំណត់ត្រា Admin កែប្រែលើគណនីនេះទេ។</div>`;
        return;
      }
      let html = `<table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
            <thead><tr style="background:#f8fafc; text-align:left;">
                <th style="padding:12px;">កាលបរិច្ឆេទ (Date)</th>
                <th style="padding:12px;">Admin អ្នកកែប្រែ</th>
                <th style="padding:12px;">សកម្មភាព (Action)</th>
                <th style="padding:12px;">ព័ត៌មានលម្អិត</th>
            </tr></thead><tbody>`;

      userLogs.forEach((l) => {
        html += `
              <tr style="border-bottom: 1px solid var(--border);">
                  <td style="padding:12px; color:var(--text-muted);">${l.date}</td>
                  <td style="padding:12px; font-weight:bold;">${l.admin}</td>
                  <td style="padding:12px; color:var(--primary); font-weight: 600;">${l.action}</td>
                  <td style="padding:12px;">${l.details}</td>
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
// ៤. មុខងារ QUICK ACTIONS (Header Buttons)
// =======================================================
async function c360ToggleFreeze() {
  const isNowFrozen = !currentC360User.isFrozen;
  try {
    await fetch("/api/admin/toggle-freeze", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        id: currentC360User._id || currentC360User.id,
        isFrozen: isNowFrozen,
      }),
    });
    Swal.fire({
      toast: true,
      position: "top-end",
      icon: "success",
      title: isNowFrozen ? "គណនីត្រូវបានផ្អាក" : "គណនីបានដោះសោរ",
      showConfirmButton: false,
      timer: 1500,
    });
    currentC360User.isFrozen = isNowFrozen;
    renderCustomerProfile(currentC360User);
    if (typeof loadData === "function") loadData();
  } catch (e) {
    Swal.fire("Error", "បរាជ័យក្នុងការប្តូរស្ថានភាព", "error");
  }
}

// 💬 មុខងារ Chat អណ្តែតនៅខាងស្តាំ (Floating Chat)
function c360OpenFloatingChat() {
  let chatWidget = document.getElementById("c360-floating-chat");

  // បង្កើត Widget ថ្មីបើមិនទាន់មាន
  if (!chatWidget) {
    chatWidget = document.createElement("div");
    chatWidget.id = "c360-floating-chat";
    chatWidget.innerHTML = `
           <div style="position: fixed; bottom: 20px; right: 20px; width: 350px; height: 500px; background: white; border-radius: 15px; box-shadow: 0 10px 30px rgba(0,0,0,0.25); display: flex; flex-direction: column; z-index: 9999; overflow: hidden; animation: slideUp 0.3s ease; border: 1px solid var(--border);">
              <div style="background: #0ea5e9; color: white; padding: 15px; display: flex; justify-content: space-between; align-items: center;">
                 <div style="display: flex; align-items: center; gap: 10px;">
                    <img id="f-chat-img" src="${currentC360User.profileImage || "../images/default-avatar.png"}" style="width:35px; height:35px; border-radius:50%; object-fit:cover; border: 2px solid white;">
                    <div>
                        <h4 id="f-chat-name" class="kh-text" style="margin:0; font-size: 1rem;">${currentC360User.fullName || currentC360User.username}</h4>
                        <span style="font-size: 0.75rem; opacity: 0.8;">@${currentC360User.username}</span>
                    </div>
                 </div>
                 <i class="fa-solid fa-xmark" style="cursor:pointer; font-size:1.2rem; padding: 5px;" onclick="document.getElementById('c360-floating-chat').style.display='none'"></i>
              </div>
              <div id="f-chat-messages" style="flex: 1; padding: 15px; background: #f8fafc; overflow-y: auto; display: flex; flex-direction: column; gap: 10px;">
                 <div style="text-align:center; color:var(--text-muted); font-size:0.8rem; margin-top:10px; background: #e2e8f0; padding: 5px; border-radius: 10px; align-self: center;" class="kh-text">ការជជែកផ្ទាល់ជាមួយអតិថិជន</div>
              </div>
              <div style="padding: 10px; background: white; border-top: 1px solid var(--border); display: flex; gap: 10px; align-items: center;">
                 <input type="text" id="f-chat-input" class="kh-text" placeholder="វាយសារ..." style="flex:1; padding:12px; border-radius:20px; border:1px solid var(--border); outline:none; background: #f1f5f9;" onkeypress="if(event.key === 'Enter') c360SendFloatingMessage()">
                 <button onclick="c360SendFloatingMessage()" style="background:#0ea5e9; color:white; border:none; width:45px; height:45px; border-radius:50%; cursor:pointer; box-shadow: 0 4px 10px rgba(14,165,233,0.3);"><i class="fa-solid fa-paper-plane"></i></button>
              </div>
           </div>
        `;
    document.body.appendChild(chatWidget);
  } else {
    // បើមានស្រាប់ គ្រាន់តែ Update ឈ្មោះ រូប ហើយបើកវាឡើងវិញ
    document.getElementById("f-chat-name").innerText =
      currentC360User.fullName || currentC360User.username;
    document.getElementById("f-chat-img").src =
      currentC360User.profileImage || "../images/default-avatar.png";
    chatWidget.style.display = "block";
  }
}

// កែសម្រួលមុខងារនេះនៅក្នុង admin-customer360.js
async function c360OpenFloatingChat() {
  // ១. បង្ខំឱ្យ User នោះចូល Support Mode
  await fetch("/api/chat/force-start", {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({
      receiverAcc: currentC360User.accountNumber,
      adminName: "Admin",
    }),
  });

  // ២. បើក Floating Chat ដូចដែលយើងបានសរសេរពីមុន
  // មុខងារចាស់នេះនៅតែដំណើរការធម្មតា
  showFloatingChatWidget();
}

// មុខងារផ្ញើសារដែលភ្ជាប់ទៅ Backend របស់អ្នក
async function c360SendFloatingMessage() {
  const input = document.getElementById("f-chat-input");
  const msg = input.value.trim();
  if (!msg) return;

  // ហៅ API សាររបស់អ្នកដែលអ្នកមានស្រាប់ (sendChat)
  const res = await fetch("/api/chat/send", {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({
      senderAcc: "ADMIN",
      receiverAcc: currentC360User.accountNumber,
      message: msg,
      adminName: "Super Admin",
    }),
  });

  // បង្ហាញសារក្នុង UI បន្ទាប់ពី Save ចូល DB ជោគជ័យ
  const data = await res.json();
  if (data.success) {
    // បង្ហាញសារក្នុង Floating Chat (កូដដដែលដែលខ្ញុំឱ្យពីមុន)
    appendMessageToFloatingChat(msg, true);
    input.value = "";
  }
}
