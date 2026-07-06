// ==========================================
// MERCHANT MANAGEMENT LOGIC
// ==========================================

let globalMerchantsData = [];

// ទាញទិន្នន័យហាងទាំងអស់ពី Backend
async function loadMerchantsData() {
  try {
    const tbody = document.getElementById("merchantTableBody");
    tbody.innerHTML =
      '<tr><td colspan="5" style="text-align: center; padding: 20px;"><i class="fa-solid fa-circle-notch fa-spin"></i> កំពុងទាញយកទិន្នន័យ...</td></tr>';

    // ហៅ API ទាញទិន្នន័យ (យើងសន្មតថាអ្នកមាន API នេះ បើមិនទាន់មាន វានឹងលោត Error តែមិនប៉ះពាល់កូដផ្សេងទេ)
    const res = await fetch("/api/admin/all-merchants", {
      headers: getAuthHeaders(),
    });

    const data = await res.json();
    if (data.success && data.merchants) {
      globalMerchantsData = data.merchants;
      renderMerchantsTable(globalMerchantsData);
    } else {
      tbody.innerHTML =
        '<tr><td colspan="5" style="text-align: center; padding: 20px; color: #ef4444;">មិនទាន់មានទិន្នន័យហាងទេ ឬ API មិនទាន់រួចរាល់។</td></tr>';
    }
  } catch (error) {
    console.log("Error loading merchants:", error);
    document.getElementById("merchantTableBody").innerHTML =
      '<tr><td colspan="5" style="text-align: center; padding: 20px; color: var(--text-muted);">គ្មានទិន្នន័យហាងអាជីវកម្មឡើយ។</td></tr>';
  }
}

// បង្ហាញទិន្នន័យចូលក្នុងតារាង
function renderMerchantsTable(merchants) {
  const tbody = document.getElementById("merchantTableBody");
  tbody.innerHTML = "";

  if (merchants.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="5" style="text-align: center; padding: 20px; color: var(--text-muted);">មិនទាន់មានហាងត្រូវបានបង្កើតនៅឡើយទេ។</td></tr>';
    return;
  }

  merchants.forEach((m) => {
    // ពណ៌ Status
    let freezeHtml = `<label class="switch"><input type="checkbox" ${m.isFrozen ? "checked" : ""} onchange="toggleMerchantFreeze('${m._id}', this.checked)"><span class="slider"></span></label>`;

    // បង្ហាញលុយ
    let balanceHtml = `<div class="acc-stack">
        <div style="color: #0369a1; font-weight: bold;">$${(m.balanceUSD || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
        <div style="color: #047857; font-weight: bold;">${(m.balanceKHR || 0).toLocaleString("en-US")} ៛</div>
    </div>`;

    // ប៊ូតុងសកម្មភាព
    let actionButtonsHtml = `
      <button class="btn-action" style="background:#3b82f6;" title="មើលប្រវត្តិលុយ" onclick="viewMerchantTrx('${m.merchantId}')"><i class="fa-solid fa-file-invoice"></i></button>
      <button class="btn-action btn-delete" title="លុបហាង" onclick="deleteMerchantByAdmin('${m._id}')"><i class="fa-solid fa-trash"></i></button>
    `;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <div style="display: flex; align-items: center; gap: 10px">
          <div style="width: 40px; height: 40px; border-radius: 10px; background: var(--primary-light, #e0f2f1); color: var(--primary); display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">
            <i class="fa-solid fa-store"></i>
          </div>
          <div>
            <div style="font-weight: bold; color: var(--text-dark)">${m.name}</div>
            <div style="font-size: 0.8rem; color: var(--text-muted)"><i class="fa-solid fa-hashtag"></i> ${m.merchantId}</div>
          </div>
        </div>
      </td>
      <td>
        <div style="font-weight: 600;">@${m.ownerUsername || "N/A"}</div>
        <div style="font-size: 0.8rem; color: var(--text-muted);">${m.category || "N/A"}</div>
      </td>
      <td>${balanceHtml}</td>
      <td>${freezeHtml}</td>
      <td><div style="display: flex; gap: 8px; justify-content: flex-end;">${actionButtonsHtml}</div></td>
    `;
    tbody.appendChild(tr);
  });
}

// ស្វែងរកហាង
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

// ផ្អាកហាង (Freeze)
async function toggleMerchantFreeze(id, isFrozen) {
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
        title: "បានកែប្រែស្ថានភាពហាង",
        showConfirmButton: false,
        timer: 1500,
      });
    } else {
      Swal.fire("បរាជ័យ", data.message, "error");
    }
  } catch (e) {
    console.log(e);
  }
}

function viewMerchantTrx(mid) {
  Swal.fire(
    "មុខងារកំពុងអភិវឌ្ឍ",
    `ការមើលប្រវត្តិប្រតិបត្តិការរបស់ Merchant ID: ${mid} នឹងមានឆាប់ៗនេះ។`,
    "info",
  );
}

function deleteMerchantByAdmin(id) {
  Swal.fire("មុខងារកំពុងអភិវឌ្ឍ", "សិទ្ធិលុបហាងពី Admin កំពុងរៀបចំ។", "info");
}
