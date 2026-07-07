// ==========================================
// MERCHANT MANAGEMENT LOGIC (FULL FEATURES)
// ==========================================

let globalMerchantsData = [];

// 1. ទាញទិន្នន័យពី Database
async function loadMerchantsData() {
  try {
    const tbody = document.getElementById("merchantTableBody");
    tbody.innerHTML =
      '<tr><td colspan="5" style="text-align: center; padding: 40px;"><i class="fa-solid fa-circle-notch fa-spin"></i> កំពុងទាញយកទិន្នន័យហាង...</td></tr>';

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
    document.getElementById("merchantTableBody").innerHTML =
      '<tr><td colspan="5" style="text-align: center; padding: 20px; color: #ef4444;">មានបញ្ហាក្នុងការតភ្ជាប់ទៅ Server។</td></tr>';
  }
}

// 2. មុខងារគូរតារាង និងប៊ូតុង Actions
function renderMerchantsTable(merchants) {
  const tbody = document.getElementById("merchantTableBody");
  tbody.innerHTML = "";

  merchants.forEach((m) => {
    let shopName = m.name || "Unnamed Shop";
    let owner = m.userId || "Unknown";
    let mid = m.merchantId || "N/A";
    let category = m.category || "Other";

    let balanceUSD = m.collected && m.collected.USD ? m.collected.USD : 0;
    let balanceKHR = m.collected && m.collected.KHR ? m.collected.KHR : 0;

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
      <td>${balanceHtml}</td>
      <td>${freezeHtml}</td>
      <td>
        <div style="display: flex; gap: 8px; justify-content: flex-end;">
          <button class="btn-action" style="background:#10b981;" title="មើលប្រតិបត្តិការ" onclick="viewMerchantTrx('${owner}')"><i class="fa-solid fa-file-invoice"></i></button>
          <button class="btn-action" style="background:#f59e0b;" title="កែប្រែហាង" onclick="editMerchantByAdmin('${m._id}', '${shopName}', '${category}')"><i class="fa-solid fa-pen"></i></button>
          <button class="btn-action btn-delete" title="លុបហាង" onclick="deleteMerchantByAdmin('${m._id}')"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// 3. មុខងារ Search ឆ្លាតវៃ
function filterMerchants() {
  const term = document
    .getElementById("searchMerchantBox")
    .value.toLowerCase()
    .trim();
  const rows = document.querySelectorAll("#merchantTableBody tr");
  rows.forEach((r) => {
    r.style.display = r.innerText.toLowerCase().includes(term) ? "" : "none";
  });
}

// 4. មុខងារផ្អាកគណនី (Freeze)
async function toggleMerchantFreeze(id, isChecked) {
  try {
    const res = await fetch("/api/admin/toggle-merchant-freeze", {
      method: "POST",
      headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ id: id, isFrozen: isChecked }),
    });
    const data = await res.json();
    if (data.success) {
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: isChecked ? "ហាងត្រូវបានផ្អាក!" : "ហាងត្រូវបានបើកវិញ!",
        showConfirmButton: false,
        timer: 1500,
      });
    } else {
      throw new Error(data.message);
    }
  } catch (error) {
    Swal.fire("បរាជ័យ", "មិនអាចផ្លាស់ប្តូរស្ថានភាពបានទេ", "error");
    setTimeout(() => loadMerchantsData(), 1500); // ហៅទិន្នន័យដើមមកវិញ
  }
}

// 5. មុខងារលុបហាង (Delete)
function deleteMerchantByAdmin(id) {
  Swal.fire({
    title: "តើអ្នកប្រាកដទេ?",
    text: "ទិន្នន័យហាងនេះនឹងត្រូវលុបចោលទាំងស្រុងពីប្រព័ន្ធ!",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#ef4444",
    cancelButtonColor: "#64748b",
    confirmButtonText: "បាទ/ចាស, លុប!",
    cancelButtonText: "បោះបង់",
  }).then(async (result) => {
    if (result.isConfirmed) {
      try {
        const res = await fetch(`/api/admin/delete-merchant/${id}`, {
          method: "DELETE",
          headers: getAuthHeaders(),
        });
        const data = await res.json();
        if (data.success) {
          Swal.fire("ជោគជ័យ", "ហាងត្រូវបានលុប!", "success");
          loadMerchantsData(); // Refresh តារាង
        } else throw new Error(data.message);
      } catch (e) {
        Swal.fire("Error", "មិនអាចលុបបានទេ", "error");
      }
    }
  });
}

// 6. មុខងារកែប្រែហាង (Edit)
async function editMerchantByAdmin(id, oldName, oldCat) {
  const { value: formValues } = await Swal.fire({
    title: "កែប្រែព័ត៌មានហាង",
    html: `<div style="text-align: left; margin-bottom: 5px; font-weight: bold; color: var(--text-muted);">ឈ្មោះហាង៖</div>
         <input id="swal-input1" class="swal2-input" value="${oldName}" style="margin-top: 0;">
         <div style="text-align: left; margin-bottom: 5px; font-weight: bold; color: var(--text-muted); margin-top: 15px;">ប្រភេទអាជីវកម្ម៖</div>
         <input id="swal-input2" class="swal2-input" value="${oldCat}" style="margin-top: 0;">`,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: "រក្សាទុក",
    cancelButtonText: "បោះបង់",
    confirmButtonColor: "#3b82f6",
    preConfirm: () => {
      return [
        document.getElementById("swal-input1").value,
        document.getElementById("swal-input2").value,
      ];
    },
  });

  if (formValues) {
    const [newName, newCat] = formValues;
    if (!newName) return Swal.fire("បរាជ័យ", "សូមបញ្ចូលឈ្មោះហាង", "warning");

    try {
      const res = await fetch(`/api/admin/edit-merchant`, {
        method: "PUT",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ id: id, name: newName, category: newCat }),
      });
      const data = await res.json();
      if (data.success) {
        Swal.fire({
          toast: true,
          position: "top-end",
          icon: "success",
          title: "បានកែប្រែជោគជ័យ",
          showConfirmButton: false,
          timer: 1500,
        });
        loadMerchantsData(); // Refresh តារាង
      } else throw new Error(data.message);
    } catch (e) {
      Swal.fire("Error", "មិនអាចកែប្រែបានទេ", "error");
    }
  }
}

// 7. មុខងារមើលប្រតិបត្តិការ (View Trx)
function viewMerchantTrx(ownerUsername) {
  // វាយបញ្ចូលឈ្មោះម្ចាស់ហាងទៅកាន់ប្រអប់ Search ក្នុង Customer 360 ដោយស្វ័យប្រវត្តិ
  const c360Input = document.getElementById("searchC360");
  if (c360Input) {
    c360Input.value = ownerUsername;
    // លោតទៅកាន់ Tab Customer 360
    showSection("customer-360");
    // បញ្ជាឱ្យស្វែងរក
    if (typeof searchCustomer360 === "function") {
      searchCustomer360();
      // បើក Tab របស់ Merchant ឱ្យស្រាប់
      setTimeout(() => switchC360Tab("merchant"), 500);
    }
  }
}
