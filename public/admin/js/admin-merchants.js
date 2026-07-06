// ==========================================
// MERCHANT MANAGEMENT LOGIC
// ==========================================

async function loadMerchantsData() {
  try {
    const tbody = document.getElementById("merchantTableBody");
    tbody.innerHTML =
      '<tr><td colspan="5" style="text-align: center; padding: 40px;"><i class="fa-solid fa-circle-notch fa-spin"></i> កំពុងទាញយក...</td></tr>';

    // 🔥 កែ Path ឱ្យត្រូវនឹង Route ដែលយើងទើបបន្ថែមនៅខាងលើ
    const res = await fetch("/api/admin/all-merchants", {
      headers: getAuthHeaders(),
    });

    const data = await res.json();
    if (data.success && data.merchants) {
      globalMerchantsData = data.merchants;
      renderMerchantsTable(globalMerchantsData);
    } else {
      tbody.innerHTML =
        '<tr><td colspan="5" style="text-align: center; padding: 40px;">គ្មានទិន្នន័យ។</td></tr>';
    }
  } catch (error) {
    console.error("Error loading merchants:", error);
  }
}

// 🔥 កែឈ្មោះ function ឱ្យត្រូវនឹង HTML
function filterMerchants() {
  const term = document.getElementById("searchMerchantBox").value.toLowerCase();
  const rows = document.querySelectorAll("#merchantTableBody tr");
  rows.forEach((r) => {
    // ត្រួតពិនិត្យអត្ថបទក្នុងជួរនីមួយៗ
    r.style.display = r.innerText.toLowerCase().includes(term) ? "" : "none";
  });
}

// មុខងារគូរតារាង (កែសម្រួលឈ្មោះ property ឱ្យត្រូវនឹង Database របស់អ្នក)
function renderMerchantsTable(merchants) {
  const tbody = document.getElementById("merchantTableBody");
  tbody.innerHTML = "";

  merchants.forEach((m) => {
    // ប្រើឈ្មោះ Field ឱ្យត្រូវនឹងអ្វីដែលអ្នកបានរក្សាទុកក្នុង MongoDB (Collection: merchants)
    let shopName = m.name || "Unnamed Shop";
    let owner = m.ownerName || m.ownerUsername || "Unknown";
    let mid = m.merchantId || "N/A";
    let balanceUSD = m.balanceUSD || 0;
    let balanceKHR = m.balanceKHR || 0;

    let freezeHtml = `<label class="switch"><input type="checkbox" ${m.isFrozen ? "checked" : ""} onchange="toggleMerchantFreeze('${m._id}', this.checked)"><span class="slider"></span></label>`;

    let balanceHtml = `<div class="acc-stack">
        <div style="color: #0369a1; font-weight: bold;">$${parseFloat(balanceUSD).toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
        <div style="color: #047857; font-weight: bold;">${parseFloat(balanceKHR).toLocaleString("en-US")} ៛</div>
    </div>`;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <div style="display: flex; align-items: center; gap: 12px">
          <div style="width: 45px; height: 45px; border-radius: 12px; background: #e0f2fe; color: #0284c7; display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">
            <i class="fa-solid fa-store"></i>
          </div>
          <div>
            <div style="font-weight: bold; color: var(--text-main); font-size: 1.05rem;">${shopName}</div>
            <div style="font-size: 0.8rem; color: var(--text-muted); font-family: 'JetBrains Mono', monospace;"><i class="fa-solid fa-hashtag"></i> MID: ${mid}</div>
          </div>
        </div>
      </td>
      <td>
        <div style="font-weight: 600; color: var(--text-main);">${owner}</div>
      </td>
      <td>${balanceHtml}</td>
      <td>${freezeHtml}</td>
      <td><div style="display: flex; gap: 8px; justify-content: flex-end;">
          <button class="btn-action" style="background:#3b82f6;" title="មើលប្រតិបត្តិការ" onclick="viewMerchantTrx('${mid}')"><i class="fa-solid fa-file-invoice"></i></button>
      </div></td>
    `;
    tbody.appendChild(tr);
  });
  // បន្ថែមមុខងារនេះចូលក្នុង admin-merchants.js
  function viewMerchantTrx(mid) {
    // ដាក់លេខកូដចូលប្រអប់ស្វែងរក
    const searchInput = document.getElementById("searchTrxId");
    if (searchInput) {
      searchInput.value = mid;
      // ប្តូរ Tab ទៅ Transaction Check
      showSection("check-trx");
      // ហៅមុខងារស្វែងរក
      if (typeof searchTrx === "function") {
        searchTrx();
      }
    }
  }
}
