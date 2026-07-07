// ==========================================
// MERCHANT MANAGEMENT LOGIC (FULL FEATURES)
// ==========================================

let globalMerchantsData = [];

// ១. ទាញយកទិន្នន័យពី Database
async function loadMerchantsData() {
  try {
    const tbody = document.getElementById("merchantTableBody");
    tbody.innerHTML =
      '<tr><td colspan="5" style="text-align: center; padding: 40px;"><i class="fa-solid fa-circle-notch fa-spin"></i> កំពុងទាញយកទិន្នន័យ...</td></tr>';

    // ហៅ API ដែលមានក្នុង merchantRoutes.js
    const res = await fetch("/api/merchants/admin/all-merchants", {
      headers: getAuthHeaders(),
    });

    const data = await res.json();
    if (data.success && data.merchants && data.merchants.length > 0) {
      globalMerchantsData = data.merchants;
      renderMerchantsTable(globalMerchantsData);
    } else {
      tbody.innerHTML =
        '<tr><td colspan="5" style="text-align: center; padding: 40px; color: var(--text-muted);">មិនមានទិន្នន័យហាងទេ។</td></tr>';
    }
  } catch (error) {
    document.getElementById("merchantTableBody").innerHTML =
      '<tr><td colspan="5" style="text-align: center; color: #ef4444;">មានបញ្ហាតភ្ជាប់ទៅ Server។</td></tr>';
  }
}
// ១. ជំនួសមុខងារ renderMerchantsTable ត្រង់កន្លែងប៊ូតុង Edit និង View Trx (ដើម្បីអោយវាបោះ _id ទៅ)
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
          <button class="btn-action" style="background:#10b981;" title="មើលប្រតិបត្តិការ" onclick="viewMerchantTrx('${m._id}')"><i class="fa-solid fa-file-invoice"></i></button>
          <button class="btn-action" style="background:#f59e0b;" title="កែប្រែហាង" onclick="editMerchantByAdmin('${m._id}')"><i class="fa-solid fa-pen"></i></button>
          <button class="btn-action btn-delete" title="លុបហាង" onclick="deleteMerchantByAdmin('${m._id}')"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ២. មុខងារកែប្រែហាង (Edit Action) ដើរ ១០០%
async function editMerchantByAdmin(id) {
  const mData = globalMerchantsData.find((m) => m._id === id);
  if (!mData) return;

  const { value: formValues } = await Swal.fire({
    title: '<h3 style="margin:0;">កែប្រែព័ត៌មានហាង</h3>',
    html: `
      <div style="text-align: left; margin-top: 15px;">
        <label style="font-weight: 600; font-size: 0.9rem;">ឈ្មោះហាង</label>
        <input id="swal-name" class="swal2-input" value="${mData.name}" style="margin: 5px 0 15px 0; width: 90%;">
        
        <label style="font-weight: 600; font-size: 0.9rem;">Merchant ID</label>
        <input id="swal-mid" class="swal2-input" value="${mData.merchantId}" style="margin: 5px 0 15px 0; width: 90%;">
        
        <label style="font-weight: 600; font-size: 0.9rem;">ប្រភេទអាជីវកម្ម</label>
        <input id="swal-cat" class="swal2-input" value="${mData.category}" style="margin: 5px 0 15px 0; width: 90%;">
        
        <label style="font-weight: 600; font-size: 0.9rem;">គណនីទទួលប្រាក់</label>
        <select id="swal-acc" class="swal2-select" style="margin: 5px 0 0 0; width: 95%; padding: 10px;">
            <option value="USD" ${mData.linkedAccount === "USD" ? "selected" : ""}>USD (គណនីចុះបញ្ចប់ដោយ ${mData.accountNumbers?.USD?.slice(-4) || "..."})</option>
            <option value="KHR" ${mData.linkedAccount === "KHR" ? "selected" : ""}>KHR (គណនីចុះបញ្ចប់ដោយ ${mData.accountNumbers?.KHR?.slice(-4) || "..."})</option>
        </select>
      </div>`,
    confirmButtonText: "រក្សាទុកការផ្លាស់ប្តូរ",
    confirmButtonColor: "#004d40",
    preConfirm: () => [
      document.getElementById("swal-name").value,
      document.getElementById("swal-mid").value,
      document.getElementById("swal-cat").value,
      document.getElementById("swal-acc").value,
    ],
  });

  if (formValues) {
    // ចាប់យកអោយគ្រប់ ៤ ផ្នែក
    const [newName, newMid, newCat, newAcc] = formValues;
    if (!newName || !newMid)
      return Swal.fire(
        "បរាជ័យ",
        "សូមបញ្ចូលឈ្មោះហាង និង Merchant ID",
        "warning",
      );

    try {
      const res = await fetch(`/api/admin/edit-merchant`, {
        method: "PUT",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        // បញ្ជូនទិន្នន័យទាំង ៤ ទៅអោយ Backend
        body: JSON.stringify({
          id: id,
          name: newName,
          merchantId: newMid,
          category: newCat,
          linkedAccount: newAcc,
        }),
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
        loadMerchantsData(); // គូរតារាងឡើងវិញ
      } else throw new Error(data.message);
    } catch (e) {
      Swal.fire("Error", e.message || "មិនអាចកែប្រែបានទេ", "error");
    }
  }
}

// ៣. មើលប្រតិបត្តិការហាង (View Transactions) ដាច់ដោយឡែក ១០០%
async function viewMerchantTrx(mid) {
  // បើក Section ថ្មីដែលយើងទើបបង្កើត
  showSection("merchant-history");

  const tbody = document.getElementById("merchantTrxBody");
  tbody.innerHTML =
    '<tr><td colspan="5" style="text-align:center; padding: 30px;"><i class="fa-solid fa-circle-notch fa-spin"></i> កំពុងទាញយកប្រវត្តិលុយ...</td></tr>';

  try {
    // ហៅ API ទាញយក Transactions របស់ហាងនោះ (API នេះអ្នកមានស្រាប់ហើយក្នុង merchantRoutes.js)
    const res = await fetch(`/api/merchants/transactions/${mid}?filter=total`, {
      headers: getAuthHeaders(),
    });
    const data = await res.json();

    if (data.success && data.transactions && data.transactions.length > 0) {
      tbody.innerHTML = data.transactions
        .map((t) => {
          let color =
            t.type === "Received" || t.amount > 0 ? "#10b981" : "#ef4444";
          let sign = t.type === "Received" || t.amount > 0 ? "+" : "";
          return `
            <tr style="border-bottom: 1px solid var(--border);">
              <td style="padding:15px; color:var(--text-muted); font-size: 0.9rem;">${t.date}</td>
              <td style="padding:15px; font-family:'JetBrains Mono', monospace; font-size: 0.9rem;">${t.refId}</td>
              <td style="padding:15px; font-weight:600;">${t.senderName || t.receiverName}</td>
              <td style="padding:15px; font-weight:bold; color:${color}; font-family:'JetBrains Mono', monospace;">${sign}${t.amount} ${t.currency}</td>
              <td style="padding:15px;"><span style="background: #f1f5f9; padding: 4px 8px; border-radius: 6px; font-size: 0.8rem;">${t.status}</span></td>
            </tr>`;
        })
        .join("");
    } else {
      tbody.innerHTML =
        '<tr><td colspan="5" style="text-align:center; padding: 30px; color: var(--text-muted);">ហាងនេះមិនទាន់មានប្រវត្តិប្រតិបត្តិការនៅឡើយទេ</td></tr>';
    }
  } catch (e) {
    tbody.innerHTML =
      '<tr><td colspan="5" style="text-align:center; color:red; padding: 30px;">មានបញ្ហាក្នុងការភ្ជាប់ទៅកាន់ Server API</td></tr>';
  }
}
