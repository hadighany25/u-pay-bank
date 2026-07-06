// ==========================================
// MERCHANT MANAGEMENT LOGIC
// ==========================================

let globalMerchantsData = [];

// មុខងារនេះទាញទិន្នន័យហាងចេញពី Users ទាំងអស់ដែលបាន Load រួចហើយក្នុង admin-core.js
async function loadMerchantsData() {
  try {
    const tbody = document.getElementById("merchantTableBody");
    tbody.innerHTML =
      '<tr><td colspan="5" style="text-align: center; padding: 40px; color: var(--text-muted);"><i class="fa-solid fa-circle-notch fa-spin" style="font-size: 2rem; margin-bottom: 10px;"></i><br>កំពុងរៀបចំទិន្នន័យ...</td></tr>';

    // ប្រមូលទិន្នន័យហាងពីអតិថិជនទាំងអស់
    let allMerchants = [];

    // globalUsersData គឺជាអញ្ញាត (Variable) ដែលមានស្រាប់នៅក្នុង admin-core.js
    if (globalUsersData && globalUsersData.length > 0) {
      globalUsersData.forEach((user) => {
        // បើអតិថិជននេះមានគណនី Merchant
        if (
          user.merchantProfile &&
          user.merchantProfile.merchants &&
          user.merchantProfile.merchants.length > 0
        ) {
          user.merchantProfile.merchants.forEach((m) => {
            // បញ្ចូលទិន្នន័យហាង និងភ្ជាប់ឈ្មោះម្ចាស់ហាងទៅជាមួយផង
            allMerchants.push({
              ...m,
              ownerUsername: user.username,
              ownerName: user.fullName || user.username,
              ownerId: user._id || user.id,
            });
          });
        }
      });
    }

    globalMerchantsData = allMerchants;

    // បង្ហាញទិន្នន័យ
    if (globalMerchantsData.length > 0) {
      renderMerchantsTable(globalMerchantsData);
    } else {
      tbody.innerHTML =
        '<tr><td colspan="5" style="text-align: center; padding: 40px; color: var(--text-muted);"><i class="fa-solid fa-store-slash" style="font-size: 2.5rem; opacity: 0.5; margin-bottom: 15px;"></i><br>មិនទាន់មានទិន្នន័យហាងនៅឡើយទេ</td></tr>';
    }
  } catch (error) {
    console.error("Error loading merchants:", error);
    document.getElementById("merchantTableBody").innerHTML =
      '<tr><td colspan="5" style="text-align: center; padding: 20px; color: #ef4444;">មានបញ្ហាក្នុងការទាញទិន្នន័យ។</td></tr>';
  }
}

// មុខងារគូរតារាងបង្ហាញទិន្នន័យ
function renderMerchantsTable(merchants) {
  const tbody = document.getElementById("merchantTableBody");
  tbody.innerHTML = "";

  merchants.forEach((m) => {
    // កុងតាក់បិទ/បើកហាង
    let isFrozen = m.isFrozen || false;
    let freezeHtml = `<label class="switch"><input type="checkbox" ${isFrozen ? "checked" : ""} onchange="toggleMerchantFreeze('${m.ownerId}', '${m.id}', this.checked)"><span class="slider"></span></label>`;

    // រៀបចំលុយក្នុងហាង
    let balUSD = m.balanceUSD || m.balance || 0;
    let balKHR = m.balanceKHR || 0;

    let balanceHtml = `<div class="acc-stack">
        <div style="color: #0369a1; font-weight: bold;">$${parseFloat(balUSD).toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
        <div style="color: #047857; font-weight: bold;">${parseFloat(balKHR).toLocaleString("en-US")} ៛</div>
    </div>`;

    // ប៊ូតុងសកម្មភាព (Action)
    let actionButtonsHtml = `
      <button class="btn-action" style="background:#3b82f6;" title="ពិនិត្យមើលប្រតិបត្តិការ" onclick="viewMerchantTrx('${m.merchantId}')"><i class="fa-solid fa-file-invoice"></i></button>
      <button class="btn-action btn-delete" title="លុបហាងចោល" onclick="deleteMerchantByAdmin('${m.ownerId}', '${m.id}')"><i class="fa-solid fa-trash"></i></button>
    `;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <div style="display: flex; align-items: center; gap: 12px">
          <div style="width: 45px; height: 45px; border-radius: 12px; background: #e0f2fe; color: #0284c7; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; border: 1px solid #bae6fd;">
            <i class="fa-solid fa-store"></i>
          </div>
          <div>
            <div style="font-weight: bold; color: var(--text-main); font-size: 1.05rem;">${m.name || "Unnamed Shop"}</div>
            <div style="font-size: 0.8rem; color: var(--text-muted); font-family: 'JetBrains Mono', monospace;"><i class="fa-solid fa-hashtag"></i> MID: ${m.merchantId || "N/A"}</div>
          </div>
        </div>
      </td>
      <td>
        <div style="font-weight: 600; color: var(--text-main);">@${m.ownerUsername}</div>
        <div style="font-size: 0.8rem; color: var(--text-muted);"><i class="fa-solid fa-tags"></i> ${m.category || "General"}</div>
      </td>
      <td>${balanceHtml}</td>
      <td>${freezeHtml}</td>
      <td><div style="display: flex; gap: 8px; justify-content: flex-end;">${actionButtonsHtml}</div></td>
    `;
    tbody.appendChild(tr);
  });
}

// មុខងារស្វែងរកហាង
function filterMerchants() {
  const term = document.getElementById("searchMerchantBox").value.toLowerCase();
  const rows = document.querySelectorAll("#merchantTableBody tr");
  rows.forEach((r) => {
    if (r.innerText.toLowerCase().includes(term)) {
      r.style.display = "";
    } else {
      r.style.display = "none";
    }
  });
}

// មុខងារមើលប្រវត្តិប្រតិបត្តិការ (លោតទៅ Tab Trx Check ដោយស្វ័យប្រវត្តិ)
function viewMerchantTrx(mid) {
  // បញ្ចូលលេខ Merchant ID ទៅក្នុងប្រអប់ស្វែងរក
  document.getElementById("searchTrxId").value = mid;
  // លោតទៅកាន់ Tab Transaction Check
  showSection("check-trx");
  // ចុចប៊ូតុងស្វែងរកដោយស្វ័យប្រវត្តិ
  if (typeof searchTrx === "function") {
    searchTrx();
  }
}

// មុខងារផ្អាកហាង (Freeze) - [Placeholder]
async function toggleMerchantFreeze(userId, merchantId, isFrozen) {
  Swal.fire({
    title: "មុខងារកំពុងអភិវឌ្ឍ",
    text: "ការផ្អាកហាងនេះកំពុងត្រូវបានរៀបចំតភ្ជាប់ទៅកាន់ Backend។",
    icon: "info",
    customClass: { popup: "premium-swal" },
  });
}

// មុខងារលុបហាង (Delete) - [Placeholder]
function deleteMerchantByAdmin(userId, merchantId) {
  Swal.fire({
    title: "តើអ្នកប្រាកដទេ?",
    text: "ទិន្នន័យហាងនេះនឹងត្រូវលុបចោលទាំងស្រុងពីប្រព័ន្ធ!",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#ef4444",
    cancelButtonColor: "#64748b",
    confirmButtonText: "បាទ/ចាស, លុប!",
    cancelButtonText: "បោះបង់",
    customClass: { popup: "premium-swal" },
  }).then(async (result) => {
    if (result.isConfirmed) {
      Swal.fire({
        title: "មុខងារកំពុងអភិវឌ្ឍ",
        text: "សិទ្ធិលុបហាងពី Admin កំពុងរៀបចំតភ្ជាប់ទៅកាន់ Database។",
        icon: "info",
        customClass: { popup: "premium-swal" },
      });
    }
  });
}
