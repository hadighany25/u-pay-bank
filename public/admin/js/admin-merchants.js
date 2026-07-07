// ==========================================
// MERCHANT MANAGEMENT LOGIC
// ==========================================

let globalMerchantsData = [];

async function loadMerchantsData() {
  try {
    const tbody = document.getElementById("merchantTableBody");
    tbody.innerHTML =
      '<tr><td colspan="5" style="text-align: center; padding: 40px;"><i class="fa-solid fa-circle-notch fa-spin"></i> កំពុងទាញយកទិន្នន័យពី Database...</td></tr>';

    // 🔥 កែ Path អោយត្រូវទៅនឹង merchantRoutes របស់អ្នក
    const res = await fetch("/api/merchants/admin/all-merchants", {
      headers: getAuthHeaders(),
    });

    const data = await res.json();
    if (data.success && data.merchants && data.merchants.length > 0) {
      globalMerchantsData = data.merchants;
      renderMerchantsTable(globalMerchantsData);
    } else {
      tbody.innerHTML =
        '<tr><td colspan="5" style="text-align: center; padding: 40px; color: var(--text-muted);"><i class="fa-solid fa-store-slash" style="font-size: 2rem; margin-bottom:10px; opacity:0.5;"></i><br>មិនទាន់មានហាងអាជីវកម្មក្នុងប្រព័ន្ធទេ។</td></tr>';
    }
  } catch (error) {
    console.error("Error loading merchants:", error);
    document.getElementById("merchantTableBody").innerHTML =
      '<tr><td colspan="5" style="text-align: center; padding: 20px; color: #ef4444;">មានបញ្ហាក្នុងការតភ្ជាប់ទៅ API។ សូមឆែកមើល Network Tab។</td></tr>';
  }
}

// មុខងារ Search ឆ្លាតវៃសម្រាប់ Merchant
function filterMerchants() {
  const term = document
    .getElementById("searchMerchantBox")
    .value.toLowerCase()
    .trim();
  const rows = document.querySelectorAll("#merchantTableBody tr");

  rows.forEach((r) => {
    // យើងទាញយកទិន្នន័យពី Row នីមួយៗ (ដែលយើងបាន render ទុក)
    // ដើម្បីឱ្យ Search ដើរ អ្នកត្រូវប្រាកដថាអត្ថបទទាំងនោះមានក្នុង Row
    const rowText = r.innerText.toLowerCase();

    // បើមិនទាន់មានទិន្នន័យ មិនបាច់ Search ទេ
    if (rowText.includes("loading")) return;

    // ត្រួតពិនិត្យថា តើ Term ដែលវាយ មានក្នុងអត្ថបទនៃ Row ហ្នឹងឬអត់
    // r.innerText រួមបញ្ចូលទាំងឈ្មោះហាង, Owner, MID, លេខគណនីដែលបង្ហាញក្នុងតារាង
    if (rowText.includes(term)) {
      r.style.display = ""; // បង្ហាញ
    } else {
      r.style.display = "none"; // លាក់
    }
  });
}

// មុខងារគូរតារាង ដោយយកទិន្នន័យត្រូវគ្នា ១០០% ពី Merchant Model
function renderMerchantsTable(merchants) {
  const tbody = document.getElementById("merchantTableBody");
  tbody.innerHTML = "";

  merchants.forEach((m) => {
    // ប្រើឈ្មោះ Field អោយត្រូវនឹង Database (Collection: merchants)
    let shopName = m.name || "Unnamed Shop";
    let owner = m.userId || "Unknown"; // ក្នុង Model របស់អ្នក ម្ចាស់ហាងគឺ userId
    let mid = m.merchantId || "N/A";
    let category = m.category || "Other";

    // លុយដែលហាងរកបាន គឺស្ថិតក្នុង m.collected
    let balanceUSD = m.collected && m.collected.USD ? m.collected.USD : 0;
    let balanceKHR = m.collected && m.collected.KHR ? m.collected.KHR : 0;

    // ស្ថានភាព (Status: "Active", "Inactive", "Suspended")
    let isFrozen = m.status === "Suspended";
    let freezeHtml = `<label class="switch"><input type="checkbox" ${isFrozen ? "checked" : ""} onchange="toggleMerchantFreeze('${m._id}', this.checked)"><span class="slider"></span></label>`;

    let balanceHtml = `<div class="acc-stack">
        <div style="color: #0369a1; font-weight: bold;">$${parseFloat(balanceUSD).toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
        <div style="color: #047857; font-weight: bold;">${parseFloat(balanceKHR).toLocaleString("en-US")} ៛</div>
    </div>`;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <div style="display: flex; align-items: center; gap: 12px">
          <div style="width: 45px; height: 45px; border-radius: 12px; background: #e0f2fe; color: #0284c7; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; border: 1px solid #bae6fd;">
            <i class="fa-solid fa-store"></i>
          </div>
          <div>
            <div style="font-weight: bold; color: var(--text-main); font-size: 1.05rem;">${shopName}</div>
            <div style="font-size: 0.8rem; color: var(--text-muted); font-family: 'JetBrains Mono', monospace;"><i class="fa-solid fa-hashtag"></i> MID: ${mid}</div>
          </div>
        </div>
      </td>
      <td>
        <div style="font-weight: 600; color: var(--text-main);">@${owner}</div>
        <div style="font-size: 0.8rem; color: var(--text-muted);"><i class="fa-solid fa-tags"></i> ${category}</div>
      </td>
      <td>
        <div style="font-weight: 600; color: var(--text-main);">@${owner}</div>
        <div style="font-size: 0.8rem; color: var(--text-muted);">
           <i class="fa-solid fa-phone"></i> ${m.phoneNumber || "N/A"} </div>
      </td>
      <td>${balanceHtml}</td>
      <td>${freezeHtml}</td>
      <td><div style="display: flex; gap: 8px; justify-content: flex-end;">
          <button class="btn-action" style="background:#3b82f6;" title="មើលប្រតិបត្តិការ" onclick="viewMerchantTrx('${mid}')"><i class="fa-solid fa-file-invoice"></i></button>
          <button class="btn-action btn-delete" title="លុបហាង" onclick="deleteMerchantByAdmin('${m._id}')"><i class="fa-solid fa-trash"></i></button>
      </div></td>
    `;
    tbody.appendChild(tr);
  });
}

// មុខងារមើលប្រវត្តិប្រតិបត្តិការ
function viewMerchantTrx(mid) {
  const searchInput = document.getElementById("searchTrxId");
  if (searchInput) {
    searchInput.value = mid;
    showSection("check-trx");
    if (typeof searchTrx === "function") searchTrx();
  }
}

function deleteMerchantByAdmin(id) {
  Swal.fire({
    title: "មុខងារកំពុងអភិវឌ្ឍ",
    text: "សិទ្ធិលុបហាងពី Admin នឹងមកដល់ឆាប់ៗ។",
    icon: "info",
    customClass: { popup: "premium-swal" },
  });
}

async function toggleMerchantFreeze(id, isFrozen) {
  Swal.fire({
    title: "មុខងារកំពុងអភិវឌ្ឍ",
    text: "ការផ្អាកហាងនឹងមកដល់ឆាប់ៗ។",
    icon: "info",
    customClass: { popup: "premium-swal" },
  });
}
