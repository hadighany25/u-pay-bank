// ==========================================
// CUSTOMER 360° VIEW LOGIC
// ==========================================

let currentC360User = null;

// ១. ស្វែងរកអតិថិជន (Search ឆ្លាតវៃ)
function searchCustomer360() {
  const term = document.getElementById("searchC360").value.toLowerCase().trim();
  if (!term) return;

  // ស្វែងរកក្នុង globalUsersData (ការពារ Case-sensitive និង DataType)
  const foundUser = globalUsersData.find((u) => {
    const uname = (u.username || "").toLowerCase();
    const fname = (u.fullName || "").toLowerCase();
    // ព្យាយាមរក field លេខទូរស័ព្ទ (អាចជា phone ឬ phoneNumber)
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

  if (foundUser) {
    renderCustomerProfile(foundUser);
  } else {
    Swal.fire({
      icon: "error",
      title: "រកមិនឃើញអតិថិជននេះទេ",
      text: "សូមពិនិត្យមើលឈ្មោះ, លេខទូរស័ព្ទ ឬលេខគណនីម្តងទៀត។",
      customClass: { popup: "premium-swal" },
    });
    document.getElementById("c360-result-container").style.display = "none";
  }
}

// ២. បង្ហាញ Header & ចែកចាយទិន្នន័យទៅកាន់ Tabs
function renderCustomerProfile(user) {
  currentC360User = user;
  document.getElementById("c360-result-container").style.display = "block";

  // Header ព័ត៌មាន
  document.getElementById("c360-avatar").src =
    user.profileImage || "../images/default-avatar.png";
  document.getElementById("c360-name").innerText =
    user.fullName || user.username || "Unknown";
  document.getElementById("c360-username").innerHTML =
    `<i class="fa-solid fa-at"></i> ${user.username}`;

  // បង្ហាញលេខទូរស័ព្ទ (ដោះស្រាយបញ្ហា N/A)
  const phoneVal = user.phone || user.phoneNumber || "មិនមានលេខទូរស័ព្ទ";
  document.getElementById("c360-phone").innerHTML =
    `<i class="fa-solid fa-phone"></i> ${phoneVal}`;

  // Status Badges
  let statusHtml = "";
  if (user.isFrozen)
    statusHtml += `<span style="background: #fee2e2; color: #ef4444; padding: 4px 8px; border-radius: 8px; font-weight: bold; font-size: 0.75rem;">FROZEN (ផ្អាក)</span> `;
  else
    statusHtml += `<span style="background: #dcfce7; color: #10b981; padding: 4px 8px; border-radius: 8px; font-weight: bold; font-size: 0.75rem;">ACTIVE (ធម្មតា)</span> `;

  if (user.kycStatus === "verified" || user.kycStatus === "approved") {
    statusHtml += `<span style="background: #dbeafe; color: #3b82f6; padding: 4px 8px; border-radius: 8px; font-weight: bold; font-size: 0.75rem;"><i class="fa-solid fa-circle-check"></i> KYC</span>`;
  }
  document.getElementById("c360-status-badge").innerHTML = statusHtml;

  // គូរទិន្នន័យចូល Tab ទាំង ៨
  renderInfoTab(user);
  renderWalletsTab(user);
  renderCardsTab(user);
  renderKycTab(user);
  renderTrxTab(user);
  renderSecurityTab(user);
  renderMerchantTab(user);
  renderLogsTab(user);
}

// ៣. ប្តូរ Tab ទៅមក
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

// Tab 1: ព័ត៌មានផ្ទាល់ខ្លួន (អាចកែប្រែបាន)
function renderInfoTab(user) {
  const container = document.getElementById("c360-tab-info");
  const phoneVal = user.phone || user.phoneNumber || "";

  container.innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
      <div class="form-group"><label>Username</label><input type="text" id="c360-edit-username" class="form-input" value="${user.username}" readonly style="background: #f1f5f9; cursor: not-allowed;" /></div>
      <div class="form-group"><label>ឈ្មោះពេញ (Full Name)</label><input type="text" id="c360-edit-fullname" class="form-input" value="${user.fullName || ""}" /></div>
      <div class="form-group"><label>លេខទូរស័ព្ទ (Phone)</label><input type="text" id="c360-edit-phone" class="form-input" value="${phoneVal}" /></div>
      <div class="form-group"><label>Email</label><input type="email" id="c360-edit-email" class="form-input" value="${user.email || ""}" /></div>
      <div class="form-group"><label>ប្តូរលេខកូដ PIN ថ្មី</label><input type="text" maxlength="4" id="c360-edit-pin" class="form-input" placeholder="ទុកទទេបើមិនចង់ដូរ" /></div>
      <div class="form-group"><label>ប្តូរពាក្យសម្ងាត់ (Password)</label><input type="text" id="c360-edit-pass" class="form-input" placeholder="ទុកទទេបើមិនចង់ដូរ" /></div>
    </div>
    <button class="btn-primary" style="margin-top: 15px;" onclick="saveC360Info()"><i class="fa-solid fa-floppy-disk"></i> រក្សាទុកការកែប្រែ</button>
  `;
}

// មុខងារ Save ព័ត៌មាន (ហៅ API ដែលមានស្រាប់ edit-user)
async function saveC360Info() {
  const id = currentC360User._id || currentC360User.id;
  const bodyData = {
    id: id,
    username: currentC360User.username, // មិនអោយកែ Username ទេការពារ Error
    fullName: document.getElementById("c360-edit-fullname").value,
    phone: document.getElementById("c360-edit-phone").value,
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
      Swal.fire({
        icon: "success",
        title: "រក្សាទុកជោគជ័យ",
        showConfirmButton: false,
        timer: 1500,
      });
      loadData(); // ហៅទិន្នន័យមកវិញដើម្បី Update Global Variable
    } else Swal.fire("បរាជ័យ", data.message, "error");
  } catch (e) {
    Swal.fire("Error", "Server Connection Failed", "error");
  }
}

// Tab 2: Wallets (គណនី)
function renderWalletsTab(user) {
  const container = document.getElementById("c360-tab-finance");
  let balUSD = parseFloat(user.balance || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
  });
  let balKHR = parseFloat(user.balanceKHR || 0).toLocaleString("en-US");

  container.innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
      <div class="dash-card" style="border-left: 5px solid #3b82f6;">
        <h4 style="margin: 0 0 10px; color: var(--text-muted);">គណនី USD ($)</h4>
        <h2 style="margin: 0 0 10px; color: var(--primary); font-size: 2rem;">$${balUSD}</h2>
        <p style="margin:0; font-family: monospace; color: var(--text-muted);">Acc: ${user.accountNumber || "N/A"}</p>
      </div>
      <div class="dash-card" style="border-left: 5px solid #10b981;">
        <h4 style="margin: 0 0 10px; color: var(--text-muted);">គណនី KHR (៛)</h4>
        <h2 style="margin: 0 0 10px; color: var(--primary); font-size: 2rem;">${balKHR} ៛</h2>
        <p style="margin:0; font-family: monospace; color: var(--text-muted);">Acc: ${user.accountNumberKHR || "N/A"}</p>
      </div>
    </div>
  `;
}

// Tab 3: កាត (Cards)
function renderCardsTab(user) {
  const container = document.getElementById("c360-tab-cards");
  if (!user.virtualCards || user.virtualCards.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding: 30px; color: var(--text-muted);">អតិថិជននេះមិនមានកាត (Cards) នៅឡើយទេ។</div>`;
    return;
  }

  let html = `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">`;
  user.virtualCards.forEach((c) => {
    let statColor = c.isLocked ? "#ef4444" : "#10b981";
    let statText = c.isLocked ? "Locked (ជាប់សោ)" : "Active (ធម្មតា)";
    let num = c.number || "XXXX-XXXX-XXXX-XXXX";

    html += `
      <div class="dash-card" style="background: linear-gradient(135deg, #1e293b, #0f172a); color: white; border:none; box-shadow: 0 10px 20px rgba(0,0,0,0.15);">
        <h4 style="margin:0; color: #94a3b8; display:flex; justify-content:space-between;"><span>Virtual Card</span> <i class="fa-brands fa-cc-visa" style="font-size:1.5rem; color: #fff;"></i></h4>
        <h3 style="margin: 20px 0; font-family: 'JetBrains Mono', monospace; font-size: 1.2rem; letter-spacing: 2px;">${num}</h3>
        <div style="display: flex; justify-content: space-between; align-items: flex-end; font-size: 0.85rem;">
          <div><span style="color:#64748b;">CVV</span><br/><b>${c.cvv || "***"}</b></div>
          <div><span style="color:#64748b;">EXP</span><br/><b>${c.expiryDate || "MM/YY"}</b></div>
          <div style="text-align:right;"><span style="color:${statColor}; font-weight:bold;">${statText}</span></div>
        </div>
      </div>
    `;
  });
  html += `</div>`;
  container.innerHTML = html;
}

// Tab 4: KYC & Identity
function renderKycTab(user) {
  const kycTab = document.getElementById("c360-tab-kyc");
  if (!user.kycDocument) {
    kycTab.innerHTML = `<div style="text-align:center; padding: 30px; color: var(--text-muted);">អតិថិជននេះមិនទាន់បានបញ្ជូនឯកសារ KYC ទេ។</div>`;
    return;
  }

  let revokeBtnHtml = "";
  if (user.kycStatus === "verified" || user.kycStatus === "approved") {
    revokeBtnHtml = `<button onclick="promptRevokeKyc('${user.username}')" style="background: #ef4444; color: white; border: none; padding: 10px 20px; border-radius: 10px; cursor: pointer; font-weight: bold; margin-top:15px;"><i class="fa-solid fa-ban"></i> បដិសេធ KYC វិញ (Revoke)</button>`;
  } else if (user.kycStatus === "pending") {
    revokeBtnHtml = `<div style="margin-top: 15px; color: #f59e0b; font-weight: bold;">ឯកសារនេះកំពុងរង់ចាំការពិនិត្យ (Pending)</div>`;
  } else {
    revokeBtnHtml = `<div style="margin-top: 15px; color: #ef4444; font-weight: bold;">ឯកសារនេះត្រូវបានបដិសេធរួចហើយ។</div>`;
  }

  kycTab.innerHTML = `
    <h4>ឯកសារអត្តសញ្ញាណប័ណ្ណ / លិខិតឆ្លងដែន</h4>
    <img src="${user.kycDocument}" style="max-width: 400px; max-height: 250px; border-radius: 15px; border: 1px solid var(--border); cursor: pointer; object-fit: cover;" onclick="viewKycDocument('${user.kycDocument}')" />
    <br>
    ${revokeBtnHtml}
  `;
}

// មុខងារដកសិទ្ធិ KYC
async function promptRevokeKyc(username) {
  const { value: reason } = await Swal.fire({
    title: "បដិសេធឯកសារ KYC នេះ?",
    input: "text",
    inputLabel: "មូលហេតុនៃការបដិសេធ (Reason):",
    inputPlaceholder: "ឧ. ឯកសារផុតកំណត់, រូបភាពមិនច្បាស់...",
    showCancelButton: true,
    confirmButtonColor: "#ef4444",
    confirmButtonText: "បញ្ជាក់ការបដិសេធ",
    customClass: { popup: "premium-swal" },
    inputValidator: (value) => {
      if (!value) return "សូមបញ្ជាក់មូលហេតុ!";
    },
  });

  if (reason) {
    // ហៅ API /api/admin/kyc-action ដែលមានស្រាប់
    const res = await fetch("/api/admin/kyc-action", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        username: username,
        action: "rejected",
        reason: reason,
      }),
    });
    const data = await res.json();
    if (data.success) {
      Swal.fire({
        icon: "success",
        title: "បានបដិសេធជោគជ័យ!",
        customClass: { popup: "premium-swal" },
      });
      currentC360User.kycStatus = "rejected";
      renderCustomerProfile(currentC360User);
    }
  }
}

// Tab 5: Transactions
function renderTrxTab(user) {
  const container = document.getElementById("c360-tab-trx");
  if (!user.transactions || user.transactions.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding: 30px; color: var(--text-muted);">គ្មានប្រវត្តិប្រតិបត្តិការទេ។</div>`;
    return;
  }

  let html = `<table style="width: 100%; border-collapse: collapse;">
    <thead><tr style="background:#f8fafc;"><th style="padding:10px;text-align:left;">កាលបរិច្ឆេទ</th><th style="padding:10px;text-align:left;">ប្រភេទ</th><th style="padding:10px;text-align:left;">ទឹកប្រាក់</th><th style="padding:10px;text-align:left;">ស្ថានភាព</th></tr></thead>
    <tbody>`;

  // តម្រៀបពីថ្មីទៅចាស់
  const sortedTrx = [...user.transactions].reverse();
  sortedTrx.forEach((t) => {
    let color = t.type === "Received" || t.amount > 0 ? "#10b981" : "#ef4444";
    let sign = t.type === "Received" || t.amount > 0 ? "+" : "";
    html += `<tr style="border-bottom: 1px solid var(--border);">
      <td style="padding:12px 10px; font-size:0.85rem; color:var(--text-muted);">${t.date}</td>
      <td style="padding:12px 10px; font-weight:600;">${t.type}</td>
      <td style="padding:12px 10px; font-weight:bold; color:${color}; font-family:'JetBrains Mono';">${sign}${t.amount} ${t.currency}</td>
      <td style="padding:12px 10px;">${t.status}</td>
    </tr>`;
  });
  html += `</tbody></table>`;
  container.innerHTML = html;
}

// Tab 6: Security (សន្តិសុខ)
function renderSecurityTab(user) {
  const container = document.getElementById("c360-tab-security");
  let isFrozen = user.isFrozen ? "checked" : "";

  container.innerHTML = `
    <div class="dash-card">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <h4 style="margin:0 0 5px;">ផ្អាកគណនី (Freeze Account)</h4>
          <p style="margin:0; font-size:0.85rem; color:var(--text-muted);">ទប់ស្កាត់ការវេរលុយ និងដកប្រាក់ទាំងអស់។</p>
        </div>
        <label class="switch"><input type="checkbox" ${isFrozen} onchange="toggleFreeze('${user._id || user.id}', this.checked); currentC360User.isFrozen = this.checked; renderCustomerProfile(currentC360User);"><span class="slider"></span></label>
      </div>
      <hr style="border:0; border-bottom:1px dashed var(--border); margin:20px 0;">
      <div>
        <h4 style="margin:0 0 10px;">ឧបករណ៍ និងប្រវត្តិ Login (Devices)</h4>
        <div style="padding:15px; background:var(--bg-main); border-radius:10px; font-family:monospace; font-size:0.85rem;">
          IP ចុងក្រោយ: ${user.lastLoginIp || "មិនស្គាល់"} <br/>
          ម៉ាស៊ីន: ${user.lastLoginDevice || "Mobile Application"}
        </div>
      </div>
    </div>
  `;
}

// Tab 7: Merchant (ហាង)
function renderMerchantTab(user) {
  const container = document.getElementById("c360-tab-merchant");
  if (
    !user.merchantProfile ||
    !user.merchantProfile.merchants ||
    user.merchantProfile.merchants.length === 0
  ) {
    container.innerHTML = `<div style="text-align:center; padding: 40px; color: var(--text-muted);">អតិថិជននេះមិនមានគណនីអាជីវកម្ម (Merchant) ទេ។</div>`;
    return;
  }

  let html = `<div style="display: grid; gap: 15px;">`;
  user.merchantProfile.merchants.forEach((m) => {
    html += `
      <div class="dash-card" style="display:flex; justify-content:space-between; align-items:center;">
        <div style="display: flex; gap: 15px; align-items:center;">
          <div style="width:50px; height:50px; background:#e0f2fe; color:#0284c7; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:1.5rem;"><i class="fa-solid fa-store"></i></div>
          <div>
            <h3 style="margin:0 0 5px;">${m.name}</h3>
            <span style="font-size:0.85rem; color:var(--text-muted); font-family:monospace;">MID: ${m.merchantId} | ប្រភេទ: ${m.category}</span>
          </div>
        </div>
        <div style="text-align:right;">
          <h3 style="margin:0; color:var(--primary);">$${(m.balanceUSD || 0).toFixed(2)}</h3>
          <span style="background:#dcfce7; color:#10b981; padding:3px 8px; border-radius:8px; font-size:0.75rem; font-weight:bold;">ACTIVE</span>
        </div>
      </div>
    `;
  });
  html += `</div>`;
  container.innerHTML = html;
}

// Tab 8: Admin Logs
function renderLogsTab(user) {
  const container = document.getElementById("c360-tab-logs");
  // ដោយសារប្រព័ន្ធខ្លះអត់មានទិន្នន័យ log ក្នុង user model យើងដាក់ Placeholder សិន
  container.innerHTML = `<div style="text-align:center; padding: 40px; color: var(--text-muted);"><i class="fa-solid fa-clock-rotate-left" style="font-size:2rem; margin-bottom:10px; opacity:0.5;"></i><br>មិនទាន់មានកំណត់ត្រាសកម្មភាព Admin ទៅលើគណនីនេះទេ។</div>`;
}
