// ==========================================
// CUSTOMER 360° VIEW LOGIC (FULL FEATURES)
// ==========================================

let currentC360User = null;

// ១. ស្វែងរកអតិថិជន (ទាញទិន្នន័យពី globalUsersData)
async function searchCustomer360() {
  const term = document.getElementById("searchC360").value.toLowerCase().trim();
  if (!term) return;

  // 1. បើ globalUsersData ទទេ សូមទៅទាញទិន្នន័យពី API ភ្លាមៗ (Safety Check)
  if (!globalUsersData || globalUsersData.length === 0) {
    Swal.fire({
      title: "កំពុងផ្ទុកទិន្នន័យ...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });
    await loadAllUsers(); // ហៅមុខងារទាញ User មកវិញ
    Swal.close();
  }

  // 2. ស្វែងរកអតិថិជន
  const foundUser = globalUsersData.find((u) => {
    // រៀបចំទិន្នន័យអោយមានសុវត្ថិភាព
    const uname = (u.username || "").toLowerCase();
    const fname = (u.fullName || "").toLowerCase();
    const phone = (u.phoneNumber || u.phone || "").toString().toLowerCase();
    const acc = (u.accountNumber || "").toString();

    // ត្រួតពិនិត្យគ្រប់លក្ខខណ្ឌ
    return (
      uname.includes(term) ||
      fname.includes(term) ||
      phone.includes(term) ||
      acc.includes(term)
    );
  });

  if (foundUser) {
    renderCustomerProfile(foundUser);
  } else {
    Swal.fire({
      icon: "error",
      title: "រកមិនឃើញ",
      text: "គ្មានអតិថិជននេះក្នុងប្រព័ន្ធទេ (សូមពិនិត្យលេខទូរស័ព្ទ ឬលេខគណនី)!",
      customClass: { popup: "premium-swal" },
    });
  }
}

// ត្រឡប់ទៅផ្ទាំង Search វិញ
function backToC360Search() {
  document.getElementById("c360-profile-view").style.display = "none";
  document.getElementById("c360-search-view").style.display = "block";
  currentC360User = null;
}

// ២. បង្ហាញ Header & Quick Actions
function renderCustomerProfile(user) {
  currentC360User = user;

  // Slide Animations
  document.getElementById("c360-search-view").style.display = "none";
  const profileView = document.getElementById("c360-profile-view");
  profileView.style.display = "block";
  profileView.classList.remove("slide-in-right");
  void profileView.offsetWidth; // Trigger reflow
  profileView.classList.add("slide-in-right");

  // Header ព័ត៌មាន
  document.getElementById("c360-avatar").src =
    user.profileImage || "../images/default-avatar.png";
  document.getElementById("c360-name").innerText =
    user.fullName || user.username;
  document.getElementById("c360-username").innerHTML =
    `<i class="fa-solid fa-at"></i> ${user.username}`;
  document.getElementById("c360-phone").innerHTML =
    `<i class="fa-solid fa-phone"></i> ${user.phone || user.phoneNumber || "N/A"}`;

  // Status Badges
  let statusHtml = user.isFrozen
    ? `<span style="background: #fee2e2; color: #ef4444; padding: 4px 8px; border-radius: 8px; font-weight: bold; font-size: 0.75rem;">FROZEN</span> `
    : `<span style="background: #dcfce7; color: #10b981; padding: 4px 8px; border-radius: 8px; font-weight: bold; font-size: 0.75rem;">ACTIVE</span> `;

  if (user.kycStatus === "verified" || user.kycStatus === "approved")
    statusHtml += `<span style="background: #dbeafe; color: #3b82f6; padding: 4px 8px; border-radius: 8px; font-weight: bold; font-size: 0.75rem;"><i class="fa-solid fa-circle-check"></i> KYC</span>`;
  document.getElementById("c360-status-badge").innerHTML = statusHtml;

  // Quick Actions (Freeze & Chat)
  document.getElementById("c360-quick-actions").innerHTML = `
    <button onclick="c360ToggleFreeze()" style="background: ${user.isFrozen ? "#10b981" : "#ef4444"}; color: white; border: none; padding: 10px 15px; border-radius: 10px; cursor: pointer; font-weight: bold;">
      <i class="fa-solid ${user.isFrozen ? "fa-unlock" : "fa-lock"}"></i> ${user.isFrozen ? "ដោះសោរ (Unfreeze)" : "ផ្អាក (Freeze)"}
    </button>
    <button onclick="c360OpenChat()" style="background: #3b82f6; color: white; border: none; padding: 10px 15px; border-radius: 10px; cursor: pointer; font-weight: bold;">
      <i class="fa-solid fa-comment-dots"></i> ផ្ញើសារ
    </button>
  `;

  // ហៅគូរទិន្នន័យចូល Tab ទាំង ៨
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

// ================== អនុវត្ត TABS ទាំង ៨ ==================

// Tab 1: Information (អាច Edit, Reset PIN, Password)
function renderInfoTab(user) {
  const container = document.getElementById("c360-tab-info");
  const dateCreated = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString()
    : "N/A";

  container.innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
      <div class="form-group"><label>ឈ្មោះពេញ (Full Name)</label><input type="text" id="c360-edit-fullname" class="form-input" value="${user.fullName || ""}" /></div>
      <div class="form-group"><label>លេខទូរស័ព្ទ (Phone)</label><input type="text" id="c360-edit-phone" class="form-input" value="${user.phone || user.phoneNumber || ""}" /></div>
      <div class="form-group"><label>Email</label><input type="email" id="c360-edit-email" class="form-input" value="${user.email || ""}" /></div>
      <div class="form-group"><label>ថ្ងៃបង្កើតគណនី</label><input type="text" class="form-input" value="${dateCreated}" readonly style="background: #f1f5f9;" /></div>
      
      <div class="form-group" style="border: 1px solid var(--border); padding: 15px; border-radius: 10px;">
        <label style="color: var(--danger);"><i class="fa-solid fa-key"></i> ប្តូរ ឬ Reset PIN</label>
        <input type="text" maxlength="4" id="c360-edit-pin" class="form-input" placeholder="វាយ PIN ៤ខ្ទង់ថ្មី ទីនេះ" value="${user.pin || ""}" />
      </div>
      <div class="form-group" style="border: 1px solid var(--border); padding: 15px; border-radius: 10px;">
        <label style="color: var(--danger);"><i class="fa-solid fa-lock"></i> ប្តូរ Password ថ្មី</label>
        <input type="text" id="c360-edit-pass" class="form-input" placeholder="ទុកទទេបើមិនចង់ប្តូរ" />
      </div>
    </div>
    <button class="btn-primary" style="margin-top: 15px; background: #0f172a;" onclick="saveC360Info()"><i class="fa-solid fa-floppy-disk"></i> រក្សាទុកការកែប្រែ</button>
  `;
}

async function saveC360Info() {
  const bodyData = {
    id: currentC360User._id,
    fullName: document.getElementById("c360-edit-fullname").value,
    phoneNumber: document.getElementById("c360-edit-phone").value,
    email: document.getElementById("c360-edit-email").value,
    pin: document.getElementById("c360-edit-pin").value,
    password: document.getElementById("c360-edit-pass").value,
  };

  try {
    const res = await fetch("/api/admin/edit-user", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(bodyData),
    });
    const data = await res.json();
    if (data.success) {
      Swal.fire({ icon: "success", title: "រក្សាទុកជោគជ័យ", timer: 1500 });
      if (loadData) loadData(); // ទាញទិន្នន័យ global ម្តងទៀត
    } else throw new Error(data.message);
  } catch (e) {
    Swal.fire("បរាជ័យ", "មិនអាចកែប្រែបានទេ", "error");
  }
}

// Tab 2: Wallets (Adjust Balance)
function renderWalletsTab(user) {
  const container = document.getElementById("c360-tab-finance");
  container.innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
      <div class="dash-card" style="border-left: 5px solid #3b82f6;">
        <h4 style="margin: 0 0 10px; color: var(--text-muted);">គណនី USD ($)</h4>
        <h2 style="margin: 0 0 10px; color: var(--primary); font-size: 2rem;">$${(user.balance || 0).toFixed(2)}</h2>
        <p style="margin:0; font-family: monospace; color: var(--text-muted);">Acc: ${user.accountNumber || "N/A"}</p>
      </div>
      <div class="dash-card" style="border-left: 5px solid #10b981;">
        <h4 style="margin: 0 0 10px; color: var(--text-muted);">គណនី KHR (៛)</h4>
        <h2 style="margin: 0 0 10px; color: var(--primary); font-size: 2rem;">${(user.balanceKHR || 0).toLocaleString()} ៛</h2>
        <p style="margin:0; font-family: monospace; color: var(--text-muted);">Acc: ${user.accountNumberKHR || "N/A"}</p>
      </div>
    </div>
    <button class="btn-primary" style="background: var(--secondary);" onclick="c360AdjustBalance()"><i class="fa-solid fa-money-bill-transfer"></i> បន្ថែម/ដកប្រាក់ (Adjust Balance)</button>
  `;
}

function c360AdjustBalance() {
  // លោត Popup អោយ Admin បញ្ចូលលុយ (ប្រើប្រាស់មុខងារពី adminController)
  Swal.fire({
    title: "បញ្ចូល ឬកាត់លុយ",
    html: `
      <select id="adj-type" class="swal2-input"><option value="add">បញ្ចូលប្រាក់ (+)</option><option value="deduct">កាត់ប្រាក់ (-)</option></select>
      <select id="adj-cur" class="swal2-input"><option value="USD">USD</option><option value="KHR">KHR</option></select>
      <input id="adj-amt" type="number" class="swal2-input" placeholder="បញ្ចូលចំនួនទឹកប្រាក់">`,
    preConfirm: () => {
      return {
        username: currentC360User.username,
        type: document.getElementById("adj-type").value,
        currency: document.getElementById("adj-cur").value,
        amount: document.getElementById("adj-amt").value,
      };
    },
  }).then(async (result) => {
    if (result.isConfirmed) {
      try {
        const res = await fetch("/api/admin/adjust-balance", {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify(result.value),
        });
        const data = await res.json();
        if (data.success)
          Swal.fire("ជោគជ័យ", "ប្រតិបត្តិការជោគជ័យ!", "success");
        else throw new Error(data.message);
      } catch (e) {
        Swal.fire("បរាជ័យ", e.message, "error");
      }
    }
  });
}

// Tab 3: Cards
function renderCardsTab(user) {
  const container = document.getElementById("c360-tab-cards");
  if (!user.virtualCards || user.virtualCards.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding: 30px; color: var(--text-muted);">គ្មានកាតត្រូវបានរកឃើញទេ។</div>`;
    return;
  }
  let html = `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">`;
  user.virtualCards.forEach((c) => {
    let statColor = c.isLocked ? "#ef4444" : "#10b981";
    let statText = c.isLocked ? "ជាប់សោរ" : "ធម្មតា";
    html += `
      <div class="dash-card" style="background: linear-gradient(135deg, #1e293b, #0f172a); color: white;">
        <h4 style="margin:0; display:flex; justify-content:space-between;">Virtual Card <i class="fa-brands fa-cc-visa"></i></h4>
        <h3 style="margin: 20px 0; font-family: 'JetBrains Mono'; letter-spacing: 2px;">${c.number || "****"}</h3>
        <div style="display: flex; justify-content: space-between; font-size: 0.85rem;">
          <div>EXP: <b>${c.expiryDate || "MM/YY"}</b></div>
          <div style="color:${statColor}; font-weight:bold;">${statText}</div>
        </div>
        <button onclick="c360ToggleCard('${c.id}', ${!c.isLocked})" style="width:100%; margin-top:15px; padding:10px; border-radius:10px; border:none; cursor:pointer; background: ${c.isLocked ? "#10b981" : "#ef4444"}; color:white; font-weight:bold;">
          <i class="fa-solid ${c.isLocked ? "fa-unlock" : "fa-lock"}"></i> ${c.isLocked ? "បើកកាតនេះវិញ" : "បិទកាតនេះ"}
        </button>
      </div>`;
  });
  container.innerHTML = html + `</div>`;
}

async function c360ToggleCard(cardId, isLocked) {
  try {
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
    if (data.success)
      Swal.fire("ជោគជ័យ", "ផ្លាស់ប្តូរស្ថានភាពកាតជោគជ័យ", "success");
  } catch (e) {
    console.error(e);
  }
}

// Tab 4: KYC & Identity
function renderKycTab(user) {
  const container = document.getElementById("c360-tab-kyc");
  if (!user.kycDocument) {
    container.innerHTML = `<div style="text-align:center; padding: 30px;">អតិថិជននេះមិនទាន់បានបញ្ជូនឯកសារ KYC ទេ។</div>`;
    return;
  }
  container.innerHTML = `
    <img src="${user.kycDocument}" style="max-width: 400px; border-radius: 10px; border: 1px solid var(--border);" />
    <div style="margin-top:20px; display:flex; gap:10px;">
      ${
        user.kycStatus === "pending"
          ? `
        <button class="btn-primary" style="background:#10b981;" onclick="c360KycAction('approved')"><i class="fa-solid fa-check"></i> អនុម័ត (Approve)</button>
        <button class="btn-primary" style="background:#ef4444;" onclick="c360KycAction('rejected')"><i class="fa-solid fa-xmark"></i> បដិសេធ (Reject)</button>
      `
          : `
        <button class="btn-primary" style="background:#ef4444;" onclick="c360KycAction('rejected')"><i class="fa-solid fa-ban"></i> ដកសិទ្ធិវិញ (Revoke KYC)</button>
      `
      }
    </div>`;
}

async function c360KycAction(action) {
  try {
    await fetch("/api/admin/kyc-action", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ username: currentC360User.username, action }),
    });
    Swal.fire("ជោគជ័យ", "អនុវត្តរួចរាល់", "success");
  } catch (e) {}
}

// Tab 5: Transactions
function renderTrxTab(user) {
  const container = document.getElementById("c360-tab-trx");
  if (!user.transactions || user.transactions.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding: 30px;">គ្មានប្រវត្តិប្រតិបត្តិការទេ។</div>`;
    return;
  }
  let html = `<table style="width: 100%; border-collapse: collapse;">
    <thead><tr style="background:#f8fafc; text-align:left;"><th>កាលបរិច្ឆេទ</th><th>Ref ID</th><th>ទឹកប្រាក់</th><th>សកម្មភាព</th></tr></thead><tbody>`;
  user.transactions.slice(0, 50).forEach((t) => {
    // បង្ហាញត្រឹម 50 ដើម
    let color = t.amount > 0 ? "#10b981" : "#ef4444";
    html += `<tr style="border-bottom: 1px solid var(--border);">
      <td style="padding:10px;">${t.date}</td><td style="padding:10px; font-family:monospace;">${t.refId}</td>
      <td style="padding:10px; font-weight:bold; color:${color};">${t.amount} ${t.currency}</td>
      <td style="padding:10px;">
        <button onclick="c360Refund('${t.refId}')" style="background:#f59e0b; color:white; border:none; padding:5px 10px; border-radius:5px; cursor:pointer;" ${t.amount > 0 || t.status === "Refunded" ? "disabled" : ""}>Refund</button>
        <button onclick="document.getElementById('searchTrxId').value='${t.refId}'; showSection('check-trx'); searchTrx();" style="background:#3b82f6; color:white; border:none; padding:5px 10px; border-radius:5px; cursor:pointer;">Trace</button>
      </td>
    </tr>`;
  });
  container.innerHTML = html + `</tbody></table>`;
}

async function c360Refund(refId) {
  const { value: reason } = await Swal.fire({
    title: "Refund លុយត្រឡប់វិញ",
    input: "text",
    inputPlaceholder: "មូលហេតុ",
    showCancelButton: true,
  });
  if (reason) {
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
  }
}

// Tab 6: Security
function renderSecurityTab(user) {
  const container = document.getElementById("c360-tab-security");
  container.innerHTML = `
    <div class="dash-card">
      <h4>កំណត់ត្រាសុវត្ថិភាព</h4>
      <p>IP ចូលចុងក្រោយ: <span style="font-family:monospace;">${user.lastLoginIp || "N/A"}</span></p>
      <p>ម៉ាស៊ីន: <span style="font-family:monospace;">${user.lastLoginDevice || "N/A"}</span></p>
      <p style="color:var(--danger);">ការវាយ PIN ខុស: <b>${user.pinAttempts || 0} ដង</b></p>
      <div style="margin-top:20px; display:flex; gap:10px;">
        <button class="btn-primary" style="background:#10b981;" onclick="c360ClearPinAttempts()"><i class="fa-solid fa-unlock-keyhole"></i> Clear PIN Attempts</button>
        <button class="btn-primary" style="background:#ef4444;" onclick="Swal.fire('ជោគជ័យ','គណនីត្រូវបានទាត់ចេញពី Device ទាំងអស់','success')"><i class="fa-solid fa-power-off"></i> Force Logout</button>
      </div>
    </div>`;
}

async function c360ClearPinAttempts() {
  // មុខងារ toggleFreeze false នៅក្នុង Backend របស់អ្នកគឺ Clear PIN Attempts ដោយស្វ័យប្រវត្តិ
  await fetch("/api/admin/toggle-freeze", {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ id: currentC360User._id, isFrozen: false }),
  });
  Swal.fire("ជោគជ័យ", "បានដោះសោរ PIN វិញហើយ", "success");
}

// Tab 7: Merchant
function renderMerchantTab(user) {
  const container = document.getElementById("c360-tab-merchant");
  // ស្វែងរកហាងដោយប្រើ globalMerchantsData ដែលបាន load រួចក្នុង admin-merchants.js
  let userShops = [];
  if (typeof globalMerchantsData !== "undefined") {
    userShops = globalMerchantsData.filter((m) => m.userId === user.username);
  }

  if (userShops.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding: 30px;">គ្មានអាជីវកម្ម (Merchant) ទេ។</div>`;
    return;
  }

  let html = `<div style="display: grid; gap: 15px;">`;
  userShops.forEach((m) => {
    html += `
      <div class="dash-card" style="display:flex; justify-content:space-between; align-items:center;">
        <div>
            <h3 style="margin:0 0 5px;">${m.name}</h3>
            <span style="font-size:0.85rem; color:var(--text-muted); font-family:monospace;">MID: ${m.merchantId}</span>
        </div>
        <div style="display:flex; gap:10px;">
            <button class="btn-action" style="background:#f59e0b;" onclick="editMerchantByAdmin('${m._id}')"><i class="fa-solid fa-pen"></i> Edit</button>
            <button class="btn-action btn-delete" onclick="deleteMerchantByAdmin('${m._id}')"><i class="fa-solid fa-trash"></i> Delete</button>
        </div>
      </div>`;
  });
  container.innerHTML = html + `</div>`;
}

// Tab 8: Logs
async function renderLogsTab(user) {
  const container = document.getElementById("c360-tab-logs");
  container.innerHTML = `<div style="text-align:center; padding:30px;"><i class="fa-solid fa-spinner fa-spin"></i> កំពុងទាញយក...</div>`;
  try {
    const res = await fetch("/api/admin/logs", { headers: getAuthHeaders() });
    const data = await res.json();
    if (data.success) {
      // ត្រងយកតែ Logs ណាដែល Target ស្មើនឹង username របស់ភ្ញៀវនេះ
      const userLogs = data.logs.filter((l) => l.target === user.username);
      if (userLogs.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding: 30px;">គ្មានកំណត់ត្រា Admin លើគណនីនេះទេ។</div>`;
        return;
      }
      let html = `<table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
            <thead><tr style="background:#f8fafc; text-align:left;"><th>កាលបរិច្ឆេទ</th><th>Admin</th><th>សកម្មភាព</th><th>ព័ត៌មានលម្អិត</th></tr></thead><tbody>`;
      userLogs.forEach((l) => {
        html += `<tr style="border-bottom: 1px solid var(--border);"><td style="padding:10px;">${l.date}</td><td style="padding:10px; font-weight:bold;">${l.admin}</td><td style="padding:10px; color:var(--primary);">${l.action}</td><td style="padding:10px;">${l.details}</td></tr>`;
      });
      container.innerHTML = html + `</tbody></table>`;
    }
  } catch (e) {
    container.innerHTML = "Error loading logs";
  }
}

// Quick Actions Functions
async function c360ToggleFreeze() {
  const isNowFrozen = !currentC360User.isFrozen;
  await fetch("/api/admin/toggle-freeze", {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ id: currentC360User._id, isFrozen: isNowFrozen }),
  });
  Swal.fire("ជោគជ័យ", "ផ្លាស់ប្តូរស្ថានភាពជោគជ័យ", "success").then(() => {
    currentC360User.isFrozen = isNowFrozen;
    renderCustomerProfile(currentC360User); // Render ឡើងវិញ
  });
}
function c360OpenChat() {
  showSection("live-chat");
  // ចុចបើក Chat ជាមួយអតិថិជននេះ (ប្រសិនបើអ្នកមានមុខងារក្នុង admin-ops.js)
  if (typeof loadAdminChats === "function") loadAdminChats();
}
