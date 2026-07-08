// ========================================================================
// 🛡️ CUSTOMER 360° VIEW LOGIC (BANK-GRADE STANDARD)
// ========================================================================

// អថេរសម្រាប់ផ្ទុកទិន្នន័យអតិថិជនដែលកំពុងមើលបច្ចុប្បន្ន
let currentC360User = null;

// =======================================================
// ១. មុខងារស្វែងរកអតិថិជន (Smart Search)
// =======================================================
async function searchCustomer360() {
  const term = document.getElementById("searchC360").value.toLowerCase().trim();
  if (!term) return;

  // បើទិន្នន័យ globalUsersData មិនទាន់មាន (ទទេ) យើងបង្ខំវាឱ្យទៅទាញពី Database មកសិន
  // ចំណាំ៖ មុខងារ loadData() គឺទាញមកពី admin-users.js របស់អ្នក
  if (!globalUsersData || globalUsersData.length === 0) {
    Swal.fire({
      title: "កំពុងទាញយកទិន្នន័យ...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });
    if (typeof loadData === "function") await loadData();
    Swal.close();
  }

  // ស្វែងរកអតិថិជនឆ្លាតវៃ (រកតាម Username, ឈ្មោះ, លេខទូរស័ព្ទ, លេខគណនី)
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

  // បើរកឃើញ បើកផ្ទាំង Profile បើរកមិនឃើញ លោតសារ Error
  if (foundUser) {
    renderCustomerProfile(foundUser);
  } else {
    Swal.fire({
      icon: "error",
      title: "រកមិនឃើញ",
      text: "គ្មានអតិថិជននេះក្នុងប្រព័ន្ធទេ (សូមពិនិត្យទិន្នន័យឡើងវិញ)!",
      customClass: { popup: "premium-swal" },
    });
  }
}

// ត្រឡប់ទៅផ្ទាំង Search វិញ (Back Button)
function backToC360Search() {
  document.getElementById("c360-profile-view").style.display = "none";
  document.getElementById("c360-search-view").style.display = "block";
  currentC360User = null;
}

// =======================================================
// ២. មុខងារបង្ហាញទិន្នន័យ Header និង Quick Actions
// =======================================================
function renderCustomerProfile(user) {
  currentC360User = user;

  // លាក់ផ្ទាំង Empty State រួចបង្ហាញផ្ទាំង Profile នៅពីក្រោមប្រអប់ Search
  const emptyState = document.getElementById("c360-empty-state");
  if (emptyState) emptyState.style.display = "none";

  const profileView = document.getElementById("c360-profile-view");
  profileView.style.display = "block";

  // បំពេញទិន្នន័យ Header
  document.getElementById("c360-avatar").src =
    user.profileImage || "../images/default-avatar.png";
  document.getElementById("c360-name").innerText =
    user.fullName || user.username || "Unknown";
  document.getElementById("c360-username").innerHTML =
    `<i class="fa-solid fa-at"></i> ${user.username}`;
  document.getElementById("c360-phone").innerHTML =
    `<i class="fa-solid fa-phone"></i> ${user.phone || user.phoneNumber || "N/A"}`;

  // ស្លាកសញ្ញាបញ្ជាក់ស្ថានភាពគណនី (Status Badges)
  let statusHtml = user.isFrozen
    ? `<span style="background: #fee2e2; color: #ef4444; padding: 4px 8px; border-radius: 8px; font-weight: bold; font-size: 0.75rem;">FROZEN (ផ្អាក)</span> `
    : `<span style="background: #dcfce7; color: #10b981; padding: 4px 8px; border-radius: 8px; font-weight: bold; font-size: 0.75rem;">ACTIVE (ធម្មតា)</span> `;

  // ស្លាក KYC
  if (user.kycStatus === "verified" || user.kycStatus === "approved")
    statusHtml += `<span style="background: #dbeafe; color: #3b82f6; padding: 4px 8px; border-radius: 8px; font-weight: bold; font-size: 0.75rem;"><i class="fa-solid fa-circle-check"></i> KYC</span>`;
  document.getElementById("c360-status-badge").innerHTML = statusHtml;

  // ប៊ូតុងសកម្មភាពរហ័ស (Quick Actions)
  document.getElementById("c360-quick-actions").innerHTML = `
    <button onclick="c360ToggleFreeze()" style="background: ${user.isFrozen ? "#10b981" : "#ef4444"}; color: white; border: none; padding: 10px 15px; border-radius: 10px; cursor: pointer; font-weight: bold; transition: 0.2s;">
      <i class="fa-solid ${user.isFrozen ? "fa-unlock" : "fa-lock"}"></i> ${user.isFrozen ? "ដោះសោរ (Unfreeze)" : "ផ្អាក (Freeze)"}
    </button>
    <button onclick="c360OpenChat()" style="background: #3b82f6; color: white; border: none; padding: 10px 15px; border-radius: 10px; cursor: pointer; font-weight: bold; transition: 0.2s;">
      <i class="fa-solid fa-comment-dots"></i> ផ្ញើសារ (Chat)
    </button>
  `;

  // ហៅមុខងារគូរទិន្នន័យចូល Tab ទាំង ៨
  renderInfoTab(user);
  renderWalletsTab(user);
  renderCardsTab(user);
  renderKycTab(user);
  renderTrxTab(user);
  renderSecurityTab(user);
  renderMerchantTab(user);
  renderLogsTab(user);
}

// មុខងារសម្រាប់ចុចប្តូរ Tab ទៅមក
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
// ៣. អនុវត្ត TABS ទាំង ៨ ឱ្យដំណើរការ (TABS LOGIC)
// =======================================================

// ➡️ TAB 1: ព័ត៌មានទូទៅ (Information) - អាចកែប្រែ, Reset PIN, ដូរ Password
function renderInfoTab(user) {
  const container = document.getElementById("c360-tab-info");
  const dateCreated = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString()
    : "មិនស្គាល់";

  container.innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
      <div class="form-group"><label>ឈ្មោះពេញ (Full Name)</label><input type="text" id="c360-edit-fullname" class="form-input" value="${user.fullName || ""}" /></div>
      <div class="form-group"><label>លេខទូរស័ព្ទ (Phone)</label><input type="text" id="c360-edit-phone" class="form-input" value="${user.phone || user.phoneNumber || ""}" /></div>
      <div class="form-group"><label>អ៊ីមែល (Email)</label><input type="email" id="c360-edit-email" class="form-input" value="${user.email || ""}" /></div>
      <div class="form-group"><label>ថ្ងៃបង្កើតគណនី</label><input type="text" class="form-input" value="${dateCreated}" readonly style="background: #f1f5f9; cursor: not-allowed;" /></div>
      
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

// Save ការកែប្រែក្នុង Tab 1 (ប្រើប្រាស់ /api/admin/edit-user ដែលមានស្រាប់)
async function saveC360Info() {
  const bodyData = {
    id: currentC360User._id || currentC360User.id,
    fullName: document.getElementById("c360-edit-fullname").value,
    accountNumber: currentC360User.accountNumber, // ត្រូវការអោយ Backend ដើរស្រួល
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
      Swal.fire({
        icon: "success",
        title: "រក្សាទុកជោគជ័យ",
        showConfirmButton: false,
        timer: 1500,
      });
      if (typeof loadData === "function") loadData(); // Update global data
    } else throw new Error(data.message);
  } catch (e) {
    Swal.fire("បរាជ័យ", "មិនអាចកែប្រែបានទេ", "error");
  }
}

// ➡️ TAB 2: Wallets (គណនីហិរញ្ញវត្ថុ) - មានប៊ូតុងបញ្ចូល/ដកប្រាក់
function renderWalletsTab(user) {
  const container = document.getElementById("c360-tab-finance");
  container.innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
      <div class="dash-card" style="border-left: 5px solid #3b82f6;">
        <h4 style="margin: 0 0 10px; color: var(--text-muted);">គណនី USD ($)</h4>
        <h2 style="margin: 0 0 10px; color: var(--primary); font-size: 2rem;">$${(user.balance || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</h2>
        <p style="margin:0; font-family: monospace; color: var(--text-muted);">Acc: ${user.accountNumber || "N/A"}</p>
      </div>
      <div class="dash-card" style="border-left: 5px solid #10b981;">
        <h4 style="margin: 0 0 10px; color: var(--text-muted);">គណនី KHR (៛)</h4>
        <h2 style="margin: 0 0 10px; color: var(--primary); font-size: 2rem;">${(user.balanceKHR || 0).toLocaleString()} ៛</h2>
        <p style="margin:0; font-family: monospace; color: var(--text-muted);">Acc: ${user.accountNumberKHR || "N/A"}</p>
      </div>
    </div>
    <button class="btn-primary" style="background: var(--secondary);" onclick="c360AdjustBalance()"><i class="fa-solid fa-money-bill-transfer"></i> បន្ថែម ឬ ដកប្រាក់ (Adjust Balance)</button>
  `;
}

// ហៅមុខងារ Adjust Balance ដែលមានស្រាប់
function c360AdjustBalance() {
  if (typeof openAdjustBalance === "function") {
    openAdjustBalance(currentC360User.username, "add"); // បើក Modal Adjust Balance
  } else {
    Swal.fire("បម្រាម", "មិនមានសិទ្ធិបញ្ចូលប្រាក់ទេ", "warning");
  }
}

// ➡️ TAB 3: Cards (កាត) - មើលកាត និង បិទ/បើកកាត
function renderCardsTab(user) {
  const container = document.getElementById("c360-tab-cards");
  if (!user.virtualCards || user.virtualCards.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding: 40px; color: var(--text-muted);">អតិថិជននេះមិនមានកាត (Cards) នៅឡើយទេ។</div>`;
    return;
  }
  let html = `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">`;
  user.virtualCards.forEach((c) => {
    let statColor = c.isLocked ? "#ef4444" : "#10b981";
    let statText = c.isLocked ? "Locked (ជាប់សោរ)" : "Active (ធម្មតា)";
    html += `
      <div class="dash-card" style="background: linear-gradient(135deg, #1e293b, #0f172a); color: white; border:none; box-shadow: 0 10px 20px rgba(0,0,0,0.15);">
        <h4 style="margin:0; display:flex; justify-content:space-between; color: #94a3b8;"><span>Virtual Card</span> <i class="fa-brands fa-cc-visa" style="font-size:1.5rem; color:#fff;"></i></h4>
        <h3 style="margin: 20px 0; font-family: 'JetBrains Mono', monospace; font-size: 1.2rem; letter-spacing: 2px;">${c.number || "****-****-****-****"}</h3>
        <div style="display: flex; justify-content: space-between; font-size: 0.85rem;">
          <div>EXP: <b style="color:white;">${c.expiryDate || "MM/YY"}</b></div>
          <div style="color:${statColor}; font-weight:bold;">${statText}</div>
        </div>
        <button onclick="c360ToggleCard('${c.id}', ${!c.isLocked})" style="width:100%; margin-top:15px; padding:10px; border-radius:10px; border:none; cursor:pointer; font-weight:bold; background: ${c.isLocked ? "#10b981" : "#ef4444"}; color:white; transition: 0.2s;">
          <i class="fa-solid ${c.isLocked ? "fa-unlock" : "fa-lock"}"></i> ${c.isLocked ? "បើកកាតនេះវិញ" : "បិទកាតនេះចោល"}
        </button>
      </div>`;
  });
  container.innerHTML = html + `</div>`;
}

// Action បិទ/បើក កាត
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
    if (data.success) {
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "ផ្លាស់ប្តូរស្ថានភាពកាតជោគជ័យ",
        showConfirmButton: false,
        timer: 1500,
      });
    }
  } catch (e) {
    console.error(e);
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

// Action អនុម័ត ឬ បដិសេធ KYC
async function c360KycAction(action) {
  try {
    const res = await fetch("/api/admin/kyc-action", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ username: currentC360User.username, action }),
    });
    const data = await res.json();
    if (data.success) {
      Swal.fire("ជោគជ័យ", "អនុវត្តរួចរាល់", "success");
      currentC360User.kycStatus = action; // Update RAM Data
      renderCustomerProfile(currentC360User); // Re-render
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

// មុខងារចុច Freeze (ផ្អាកគណនី)
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
    }).then(() => {
      currentC360User.isFrozen = isNowFrozen; // Update in RAM
      renderCustomerProfile(currentC360User); // Re-render UI
      if (typeof loadData === "function") loadData(); // Update global memory
    });
  } catch (e) {
    Swal.fire("Error", "បរាជ័យក្នុងការប្តូរស្ថានភាព", "error");
  }
}

// មុខងារចុចបើក Chat (Live Support)
function c360OpenChat() {
  showSection("live-chat"); // លោតទៅផ្ទាំង Chat
  // ប្រសិនបើមានមុខងារផ្ទុក Chat ឱ្យហៅវាឱ្យដំណើរការ
  if (typeof loadAdminChats === "function") loadAdminChats();
}
