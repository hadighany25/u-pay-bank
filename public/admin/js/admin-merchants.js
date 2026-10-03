// ========================================================================
// ឯកសារ: admin-merchants.js
// អត្ថន័យ: គ្រប់គ្រងទិន្នន័យហាងទំនិញ (Merchants), ប្រតិបត្តិការ និង API Credentials
// ========================================================================

// ========================================================================
// 📦 SECTION 1: STATE MANAGEMENT & VIEWS (អថេរគ្រប់គ្រងទិន្នន័យ និងផ្ទាំង)
// ========================================================================
let globalMerchantsData = [];
let currentViewedMerchantId = null;

/**
 * 📌 មុខងារបិទផ្ទាំង Sub-views ឱ្យអស់ ការពារការជាន់គ្នាពេលចុច Back
 */
function closeMerchantSubViews() {
  document.getElementById("sec-merchant-credentials").style.display = "none";
  document.getElementById("sec-merchant-history").style.display = "none";
  showSection("merchants"); // បង្ហាញផ្ទាំងមេវិញ
}

// ========================================================================
// 🔄 SECTION 2: DATA LOADING, SEARCH & RENDERING (ទាញយក ស្វែងរក និងបង្ហាញ)
// ========================================================================

/**
 * 📌 ២.១ ទាញយកទិន្នន័យពី Database
 */
async function loadMerchantsData() {
  try {
    const tbody = document.getElementById("merchantTableBody");
    tbody.innerHTML =
      '<tr><td colspan="5" style="text-align: center; padding: 40px;"><i class="fa-solid fa-circle-notch fa-spin"></i> កំពុងទាញយកទិន្នន័យ...</td></tr>';

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

/**
 * 📌 ២.២ មុខងារស្វែងរកស្តង់ដារ (Universal Search Filter) 🚀
 * រាវរកទិន្នន័យបានដល់លេខកុង USD, KHR របស់ Merchant
 */
function filterMerchants() {
  const searchBox = document.getElementById("searchMerchantBox");
  const keyword = searchBox ? searchBox.value : "";
  const allMerchants = globalMerchantsData || [];

  // ប្រើប្រាស់ស្តង់ដារកណ្តាល (Universal Search) បើមាន
  if (typeof window.standardDataSearch === "function") {
    const filteredList = window.standardDataSearch(allMerchants, keyword, [
      "name",
      "merchantId",
      "userId",
      "category",
      "linkedAccount",
      "accountNumbers.USD",
      "accountNumbers.KHR",
    ]);
    renderMerchantsTable(filteredList);
  } else {
    // Fallback: ការពារពេលរកមុខងារស្តង់ដារមិនឃើញ
    const lowerKeyword = keyword.toLowerCase().trim();
    const filteredList = allMerchants.filter((m) => {
      const text =
        `${m.name || ""} ${m.merchantId || ""} ${m.userId || ""} ${m.category || ""}`.toLowerCase();
      return text.includes(lowerKeyword);
    });
    renderMerchantsTable(filteredList);
  }
}

/**
 * 📌 ២.៣ បង្ហាញទិន្នន័យក្នុងតារាង (Render Table)
 */
function renderMerchantsTable(merchants) {
  const tbody = document.getElementById("merchantTableBody");
  tbody.innerHTML = "";

  if (!merchants || merchants.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="5" style="text-align: center; padding: 40px; color: var(--text-muted);">គ្មានទិន្នន័យហាងដែលអ្នកស្វែងរកទេ</td></tr>';
    return;
  }

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
          <button class="btn-action" style="background:#0284c7;" title="មើលព័ត៌មានសម្ងាត់" onclick="viewMerchantCredentials('${m._id}')"><i class="fa-solid fa-key"></i></button>
          <button class="btn-action" style="background:#10b981;" title="មើលប្រតិបត្តិការ" onclick="viewMerchantTrx('${m._id}')"><i class="fa-solid fa-file-invoice"></i></button>
          <button class="btn-action" style="background:#f59e0b;" title="កែប្រែហាង" onclick="editMerchantByAdmin('${m._id}')"><i class="fa-solid fa-pen"></i></button>
          <button class="btn-action btn-delete" title="លុបហាង" onclick="deleteMerchantByAdmin('${m._id}')"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ========================================================================
// 🛠️ SECTION 3: MERCHANT ACTIONS (កែប្រែ លុប និងផ្អាកហាង)
// ========================================================================

/**
 * 📌 ៣.១ មុខងារកែប្រែហាង (Edit Action)
 */
async function editMerchantByAdmin(id) {
  const mData = globalMerchantsData.find((m) => m._id === id);
  if (!mData) return;

  const { value: formValues } = await Swal.fire({
    title:
      '<h3 style="margin:0 0 10px 0; color: #0f172a; font-size: 1.25rem; font-weight: 700;">⚙️ កែប្រែព័ត៌មានហាង</h3>',
    html: `
      <div style="text-align: left; display: flex; flex-direction: column; gap: 14px; padding: 5px 10px;">
        <div><label style="display: block; font-weight: 600; font-size: 0.85rem; color: #475569; margin-bottom: 6px;">ឈ្មោះហាង (Shop Name)</label><input id="swal-name" class="swal2-input" value="${mData.name}" style="margin: 0; width: 100%; box-sizing: border-box; border-radius: 10px; border: 1px solid #cbd5e1; font-size: 0.95rem; padding: 10px 14px;"></div>
        <div><label style="display: block; font-weight: 600; font-size: 0.85rem; color: #475569; margin-bottom: 6px;">Merchant ID (MID)</label><input id="swal-mid" class="swal2-input" value="${mData.merchantId}" style="margin: 0; width: 100%; box-sizing: border-box; border-radius: 10px; border: 1px solid #cbd5e1; font-size: 0.95rem; padding: 10px 14px;"></div>
        <div><label style="display: block; font-weight: 600; font-size: 0.85rem; color: #475569; margin-bottom: 6px;">ប្រភេទអាជីវកម្ម (Category)</label><input id="swal-cat" class="swal2-input" value="${mData.category}" style="margin: 0; width: 100%; box-sizing: border-box; border-radius: 10px; border: 1px solid #cbd5e1; font-size: 0.95rem; padding: 10px 14px;"></div>
        <div><label style="display: block; font-weight: 600; font-size: 0.85rem; color: #475569; margin-bottom: 6px;">Webhook URL</label><input id="swal-webhook" class="swal2-input" value="${mData.webhookUrl || ""}" placeholder="https://..." style="margin: 0; width: 100%; box-sizing: border-box; border-radius: 10px; border: 1px solid #cbd5e1; font-size: 0.95rem; padding: 10px 14px;"></div>
        <div><label style="display: block; font-weight: 600; font-size: 0.85rem; color: #475569; margin-bottom: 6px;">គណនីទទួលប្រាក់</label>
          <select id="swal-acc" class="swal2-select" style="margin: 0; width: 100%; box-sizing: border-box; border-radius: 10px; border: 1px solid #cbd5e1; font-size: 0.95rem; padding: 10px 14px; background: #fff;">
              <option value="USD" ${mData.linkedAccount === "USD" ? "selected" : ""}>USD</option>
              <option value="KHR" ${mData.linkedAccount === "KHR" ? "selected" : ""}>KHR</option>
          </select>
        </div>
      </div>`,
    width: "500px",
    showCancelButton: true,
    confirmButtonText: "រក្សាទុកការផ្លាស់ប្តូរ",
    cancelButtonText: "បោះបង់",
    confirmButtonColor: "#004d40",
    preConfirm: () => [
      document.getElementById("swal-name").value,
      document.getElementById("swal-mid").value,
      document.getElementById("swal-cat").value,
      document.getElementById("swal-webhook").value,
      document.getElementById("swal-acc").value,
    ],
  });

  if (formValues) {
    const [newName, newMid, newCat, newWebhook, newAcc] = formValues;
    if (!newName || !newMid)
      return Swal.fire("បរាជ័យ", "សូមបញ្ចូលឈ្មោះ និង MID", "warning");
    try {
      const res = await fetch(`/api/admin/edit-merchant`, {
        method: "PUT",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          name: newName,
          merchantId: newMid,
          category: newCat,
          webhookUrl: newWebhook,
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
        loadMerchantsData();
      } else throw new Error(data.message);
    } catch (e) {
      Swal.fire("Error", e.message, "error");
    }
  }
}

/**
 * 📌 ៣.២ លុបហាង (Delete Merchant)
 */
async function deleteMerchantByAdmin(id) {
  let isKh = window.currentLang === "kh";
  Swal.fire({
    title: isKh ? "តើអ្នកប្រាកដទេ?" : "Are you sure?",
    text: isKh ? "ទិន្នន័យហាងនេះនឹងត្រូវលុបចោល!" : "This shop will be deleted!",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#ef4444",
    cancelButtonColor: "#64748b",
    confirmButtonText: isKh ? "បាទ/ចាស, លុប!" : "Yes, delete!",
    cancelButtonText: isKh ? "បោះបង់" : "Cancel",
  }).then(async (result) => {
    if (result.isConfirmed) {
      try {
        const response = await fetch(`/api/merchants/delete-merchant/${id}`, {
          method: "DELETE",
          headers: getAuthHeaders(),
        });
        const data = await response.json();
        if (data.success) {
          Swal.fire({
            icon: "success",
            title: isKh ? "លុបរួចរាល់" : "Deleted",
            timer: 1500,
            showConfirmButton: false,
          });
          loadMerchantsData();
        } else throw new Error(data.message);
      } catch (err) {
        Swal.fire(
          "Error",
          isKh ? "មិនអាចលុបបានទេ" : "Could not delete shop",
          "error",
        );
      }
    }
  });
}

/**
 * 📌 ៣.៣ ផ្អាកហាង (Freeze/Suspend)
 */
async function toggleMerchantFreeze(id, isFrozen) {
  try {
    const res = await fetch("/api/merchants/toggle-merchant-freeze", {
      method: "POST",
      headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ id, isFrozen }),
    });
    const data = await res.json();
    if (!data.success) {
      Swal.fire("Error", data.message, "error");
      loadMerchantsData();
    }
  } catch (e) {
    Swal.fire("Error", "Server Error", "error");
    loadMerchantsData();
  }
}

// ========================================================================
// 🔎 SECTION 4: MERCHANT SUB-VIEWS (មើលប្រវត្តិ និង Credentials)
// ========================================================================

/**
 * 📌 ៤.១ មើលប្រតិបត្តិការហាង (View Transactions)
 */
async function viewMerchantTrx(mid) {
  document.getElementById("sec-merchants").style.display = "none";
  document.getElementById("sec-merchant-credentials").style.display = "none";
  document.getElementById("sec-merchant-history").style.display = "block";

  const tbody = document.getElementById("merchantTrxBody");
  tbody.innerHTML =
    '<tr><td colspan="5" style="text-align:center; padding: 30px;"><i class="fa-solid fa-circle-notch fa-spin"></i> កំពុងទាញយកប្រវត្តិលុយ...</td></tr>';

  try {
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

/**
 * 📌 ៤.២ មើលព័ត៌មានសម្ងាត់ (Credentials View) ដូច Excel
 */
function viewMerchantCredentials(id) {
  const mData = globalMerchantsData.find((m) => m._id === id);
  if (!mData) return;

  currentViewedMerchantId = id;

  document.getElementById("sec-merchants").style.display = "none";
  document.getElementById("sec-merchant-history").style.display = "none";
  document.getElementById("sec-merchant-credentials").style.display = "block";

  document.getElementById("credShopTitle").innerText =
    `${mData.name.toUpperCase()} - MERCHANT INFORMATION`;
  const tbody = document.getElementById("credTableBody");

  const createRow = (
    field,
    value,
    hasCheckbox = false,
    checkboxId = "",
    bgColor = "#ffffff",
    isStatus = false,
  ) => {
    let checkboxHtml = hasCheckbox
      ? `<input type="checkbox" id="${checkboxId}" checked style="width:18px; height:18px; accent-color: #004d40; cursor:pointer;">`
      : `<span style="color:#cbd5e1;">—</span>`;

    let displayValueHtml = "";

    if (isStatus) {
      displayValueHtml = value;
    } else {
      const rawTextForCopy = value
        ? String(value).replace(/<[^>]*>?/gm, "")
        : "";
      const safeTextForCopy = rawTextForCopy.replace(/'/g, "\\'");

      displayValueHtml = `
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="color: ${field.includes("Secret") || field.includes("Key") ? "#047857" : "#475569"}; font-family: ${field.includes("Key") || field.includes("Id") || field.includes("Secret") || field.includes("USD") || field.includes("KHR") ? "'JetBrains Mono', monospace" : "inherit"}; word-break: break-all;">${value || "N/A"}</span>
            ${value && value !== "N/A" && value !== "null" ? `<i class="fa-regular fa-copy" style="cursor: pointer; color: #94a3b8; transition: color 0.2s;" onmouseover="this.style.color='#0f172a'" onmouseout="this.style.color='#94a3b8'" onclick="copyToClipboard('${safeTextForCopy}')" title="ចម្លង"></i>` : ""}
          </div>
        `;
    }

    return `
      <tr style="border-bottom: 1px solid #e2e8f0; background: ${bgColor};">
        <td style="padding: 12px 20px; font-weight: 600; color: #334155; width: 30%;">${field}</td>
        <td style="padding: 12px 20px;">${displayValueHtml}</td>
        <td style="padding: 12px 20px; text-align: center; width: 120px;">${checkboxHtml}</td>
      </tr>
    `;
  };

  const createHeaderRow = (title) => {
    return `<tr style="background: #e0f2fe; border-bottom: 1px solid #bae6fd;"><td colspan="3" style="padding: 10px 20px; font-weight: bold; color: #0369a1;">${title}</td></tr>`;
  };

  let html = "";
  html += createRow("userId", mData.userId);
  html += createRow("name", mData.name);
  html += createRow("city", mData.city);
  html += createRow("category", mData.category);

  html += createHeaderRow("Linked Accounts");
  html += createRow("Currency", "Account Number", false, "", "#f8fafc");
  html += createRow("USD", mData.linkedAccounts?.USD);
  html += createRow("KHR", mData.linkedAccounts?.KHR);
  html += createRow("merchantId", mData.merchantId);

  html += createHeaderRow("Account Numbers (Virtual)");
  html += createRow("Currency", "Account Number", false, "", "#f8fafc");
  html += createRow("USD", mData.accountNumbers?.USD);
  html += createRow("KHR", mData.accountNumbers?.KHR);

  html += createHeaderRow("API & Security Credentials");
  html += createRow("apiKey", mData.apiKey, true, "chk-apikey");
  html += createRow("apiSecret", mData.apiSecret, true, "chk-apisecret");
  html += createRow(
    "webhookUrl",
    mData.webhookUrl || "null",
    true,
    "chk-webhook",
  );

  html += createRow(
    "status",
    `<span style="background:#10b981; color:white; padding: 3px 10px; border-radius:12px; font-size:0.8rem;">${mData.status}</span>`,
    false,
    "",
    "#ffffff",
    true,
  );

  tbody.innerHTML = html;
}

// ========================================================================
// 🧰 SECTION 5: UTILITIES (Tools ជំនួយផ្សេងៗ PDF & Clipboard)
// ========================================================================

/**
 * 📌 ៥.១ មុខងារទាញយក PDF (Download Credentials)
 */
async function downloadCredentialPDF() {
  if (!currentViewedMerchantId) return;

  const showApiKey = document.getElementById("chk-apikey")?.checked || false;
  const showApiSecret =
    document.getElementById("chk-apisecret")?.checked || false;
  const showWebhook = document.getElementById("chk-webhook")?.checked || false;

  Swal.fire({
    title: "កំពុងបង្កើតឯកសារ PDF...",
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading(),
  });

  try {
    const response = await fetch(
      `/api/merchants/admin/credential-pdf/${currentViewedMerchantId}?showKey=${showApiKey}&showSecret=${showApiSecret}&showWebhook=${showWebhook}`,
      { method: "GET", headers: getAuthHeaders() },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || "មិនអាចទាញយក PDF បានទេ! សូមពិនិត្យសិទ្ធិឡើងវិញ។",
      );
    }

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = `Merchant-Credentials-${currentViewedMerchantId}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(downloadUrl);
    Swal.close();
  } catch (error) {
    Swal.fire("បរាជ័យ!", error.message, "error");
  }
}

/**
 * 📌 ៥.២ មុខងារសម្រាប់ចម្លងអត្ថបទ (Copy to Clipboard)
 */
function copyToClipboard(text) {
  if (!text || text === "N/A" || text === "null") return;
  navigator.clipboard
    .writeText(text)
    .then(() => {
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "បានចម្លងរួចរាល់",
        showConfirmButton: false,
        timer: 1500,
      });
    })
    .catch((err) => {
      console.error("Failed to copy: ", err);
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "error",
        title: "មិនអាចចម្លងបានទេ",
        showConfirmButton: false,
        timer: 1500,
      });
    });
}
