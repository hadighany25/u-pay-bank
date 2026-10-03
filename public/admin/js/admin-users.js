// ========================================================================
// ឯកសារ: admin-users.js (Admin User Management)
// អត្ថន័យ: គ្រប់គ្រងការបង្ហាញ ស្វែងរក កែប្រែ និងប្រតិបត្តិការលើគណនីអតិថិជន
// ========================================================================

// ========================================================================
// 🧩 SECTION 1: UNIVERSAL HELPERS (មុខងារជំនួយទូទៅ)
// ========================================================================

/**
 * 📌 ១.១ មុខងារស្វែងរកទិន្នន័យស្តង់ដារ (Universal Deep Search)
 * អាចរាវរកទិន្នន័យជ្រៅៗ (ឧ. mainAccounts.USD.accountNumber ឬ subAccounts.accountNumber)
 */
window.standardDataSearch = function (dataArray, keyword, searchFields) {
  // បើគ្មានពាក្យស្វែងរកទេ បោះទិន្នន័យដើមទៅវិញ
  if (!keyword || keyword.trim() === "") return dataArray;

  const lowerKeyword = keyword.toLowerCase().trim();

  // Helper សម្រាប់ចាប់យកតម្លៃទិន្នន័យដែលនៅជ្រៅ (Deep Nested Value)
  const getNestedValue = (obj, path) => {
    return path.split(".").reduce((acc, part) => {
      if (acc === null || acc === undefined) return null;
      // ប្រសិនបើវាជា Array (ឧ. subAccounts) វាត្រូវ Loop ចូលទៅចាប់តម្លៃខាងក្នុង
      if (Array.isArray(acc)) {
        return acc.map((item) => (item ? item[part] : null)).flat();
      }
      return acc[part];
    }, obj);
  };

  // ធ្វើការ Filter ស្វែងរក
  return dataArray.filter((item) => {
    return searchFields.some((field) => {
      const value = getNestedValue(item, field);
      if (Array.isArray(value)) {
        // បើលទ្ធផលជា Array (ឧទាហរណ៍មានគណនីរងច្រើន) ឆែកគ្រប់គណនីរង
        return value.some(
          (v) =>
            v !== null &&
            v !== undefined &&
            String(v).toLowerCase().includes(lowerKeyword),
        );
      }
      // បើជាតម្លៃធម្មតា
      return (
        value !== null &&
        value !== undefined &&
        String(value).toLowerCase().includes(lowerKeyword)
      );
    });
  });
};

/**
 * 📌 ១.២ មុខងារបង្រួមទំហំរូបភាព (Image Compression)
 */
function compressImageAndPreview(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = function (event) {
      const img = new Image();
      img.src = event.target.result;
      img.onload = function () {
        const MAX_WIDTH = 300;
        const MAX_HEIGHT = 300;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
    };
  });
}

// ========================================================================
// 👥 SECTION 2: USER DIRECTORY (បញ្ជីអ្នកប្រើប្រាស់ និង Drawer)
// ========================================================================

/**
 * 📌 ២.១ មុខងារស្វែងរកអ្នកប្រើប្រាស់
 */
function filterUsers() {
  const term = document.getElementById("searchBox").value;
  const filteredData = window.standardDataSearch(globalUsersData, term, [
    "username",
    "fullName",
    "phone",
    "email",
    "idNumber",
    "userId",
    "mainAccounts.USD.accountNumber",
    "mainAccounts.KHR.accountNumber",
  ]);
  renderUsersTable(filteredData);
}

/**
 * 📌 ២.២ មុខងារគូរកាតអ្នកប្រើប្រាស់ (ជំនួសតារាងចាស់)
 */
function renderUsersTable(users) {
  const listContainer = document.getElementById("userDirectoryList");
  if (!listContainer) return;

  if (!users || users.length === 0) {
    listContainer.innerHTML = `
      <div style="text-align:center; padding: 50px 20px; color: var(--text-muted);">
        <i class="fa-solid fa-users-slash" style="font-size: 3.5rem; margin-bottom: 15px; opacity: 0.3;"></i>
        <h3 style="margin:0; font-family: 'Kantumruy Pro';">មិនមានទិន្នន័យអតិថិជនទេ</h3>
      </div>`;
    return;
  }

  const cardsHtml = users
    .map((u) => {
      const imgSrc = u.profileImage || "../images/default-avatar.png";
      const name = u.fullName || u.username;

      // ប្តូរពណ៌ Status
      const statusHtml = u.isFrozen
        ? `<span style="background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: bold;">FROZEN</span>`
        : `<span style="background: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.2); padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: bold;">ACTIVE</span>`;

      const isSystem = u.mainAccounts?.USD?.accountNumber === "888888888";
      const roleBadge = isSystem
        ? `<i class="fa-solid fa-building-columns" style="color:#3b82f6; margin-left:5px;" title="System Bank"></i>`
        : "";

      return `
      <div class="modern-user-card" onclick="openUserDrawer('${u.username}', this)">
        <div style="display: flex; align-items: center; gap: 15px;">
          <img loading="lazy" src="${imgSrc}" style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover; border: 2px solid var(--border);" onerror="this.src='../images/default-avatar.png'">
          <div>
            <h4 style="margin: 0; color: var(--text-main); font-size: 1.05rem;">${name} ${roleBadge}</h4>
            <p style="margin: 3px 0 0; color: var(--text-muted); font-size: 0.85rem; font-family: 'Inter', sans-serif;">@${u.username} • ${u.phone || "N/A"}</p>
          </div>
        </div>
        <div style="text-align: right;">
          ${isSystem ? `<span style="background: #e0f2fe; color: #0284c7; padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: bold;">SYSTEM</span>` : statusHtml}
        </div>
      </div>
    `;
    })
    .join("");

  listContainer.innerHTML = cardsHtml;
}
/**
 * 📌 ២.៣ មុខងារបើក Drawer និងចាក់ទិន្នន័យចូល (រួមទាំង Sub-Accounts)
 */
window.openUserDrawer = function (username, cardElement) {
  const user = globalUsersData.find((u) => u.username === username);
  if (!user) return;

  // ចាក់ទិន្នន័យចូល HTML Drawer (ព័ត៌មានទូទៅ)
  document.getElementById("drawerName").innerText =
    user.fullName || user.username;
  // 🟢 បន្ថែម ID : នៅពីមុខ Username ជាមួយបន្ទាត់បញ្ឈរ |
  const displayId = user.userId || "N/A";
  document.getElementById("drawerUsername").innerHTML =
    `<span style="color: var(--text-muted); font-size: 0.95rem;">ID : ${displayId}</span> <span style="color: #cbd5e1; margin: 0 10px;">|</span> @${user.username}`;

  document.getElementById("drawerAvatar").src =
    user.profileImage || "../images/default-avatar.png";
  document.getElementById("drawerUsdAcc").innerText =
    user.mainAccounts?.USD?.accountNumber || "N/A";
  document.getElementById("drawerKhrAcc").innerText =
    user.mainAccounts?.KHR?.accountNumber || "N/A";
  document.getElementById("drawerPhone").innerText = user.phone || "N/A";
  document.getElementById("drawerEmail").innerText = user.email || "N/A";

  // 🟢 គូរ Sub-Accounts (បើមាន) បញ្ចូលទៅក្នុង Drawer
  const subAccContainer = document.getElementById("drawerSubAccountsContainer");
  if (user.subAccounts && user.subAccounts.length > 0) {
    let subHtml = `<h4 style="margin: 5px 0 10px; color: var(--text-muted);"><i class="fa-solid fa-layer-group"></i> គណនីរង (Sub-Accounts)</h4>
                   <div class="info-block" style="display: flex; flex-direction: column; gap: 10px;">`;

    user.subAccounts.forEach((sub, index) => {
      const currColor = sub.currency === "USD" ? "#0ea5e9" : "#10b981";
      const borderTop =
        index > 0
          ? "border-top: 1px dashed var(--border); padding-top: 10px;"
          : "";

      subHtml += `
        <div style="display: flex; justify-content: space-between; align-items: center; ${borderTop}">
          <div style="display: flex; flex-direction: column;">
            <span style="color: ${currColor}; font-weight: bold; font-size: 0.95rem;">${sub.currency}</span>
            <span style="font-size: 0.75rem; color: var(--text-muted);">${sub.accountName}</span>
          </div>
          <span style="font-family: 'Inter', monospace; font-weight: bold; color: var(--text-main);">${sub.accountNumber}</span>
        </div>
      `;
    });

    subHtml += `</div>`;
    subAccContainer.innerHTML = subHtml;
  } else {
    // លុបចោលវិញបើអតិថិជននេះគ្មាន Sub-Account ការពារការជាប់ទិន្នន័យពីអតិថិជនមុន
    subAccContainer.innerHTML = "";
  }

  // KYC Status
  let kycStatus = user.kycStatus || "Unverified";
  let kycColor =
    kycStatus === "verified" || kycStatus === "approved"
      ? "#10b981"
      : "#f59e0b";
  if (kycStatus === "rejected") kycColor = "#ef4444";
  document.getElementById("drawerKyc").innerHTML =
    `<span style="color: ${kycColor}; font-weight: bold; text-transform: capitalize;">${kycStatus}</span>`;

  // Toggle Switch ផ្អាកគណនី
  const toggleBtn = document.getElementById("drawerFreezeToggle");
  if (toggleBtn) {
    toggleBtn.checked = !user.isFrozen;
    toggleBtn.onchange = function () {
      if (typeof toggleFreeze === "function")
        toggleFreeze(user._id || user.id, !this.checked);
    };
  }

  // ភ្ជាប់ប៊ូតុង Actions ទៅកាន់មុខងារថ្មី
  document.getElementById("btnMessageDrawer").onclick = () =>
    sendDirectMessage(user.username);
  document.getElementById("btnForceLogoutDrawer").onclick = () =>
    forceLogoutUser(user.username);
  document.getElementById("btnC360Drawer").onclick = () =>
    goToCustomer360(user.username);

  const isSystem = user.mainAccounts?.USD?.accountNumber === "888888888";
  const delBtn = document.getElementById("btnDeleteDrawer");
  if (isSystem) {
    delBtn.style.display = "none";
  } else {
    delBtn.style.display = "block";
    delBtn.onclick = () => deleteUser(user._id || user.id);
  }

  // បើកផ្ទាំង Drawer
  document.getElementById("userDetailDrawer").classList.add("open");

  // លាបពណ៌កាតដែលកំពុង Select
  document
    .querySelectorAll(".modern-user-card")
    .forEach((c) => c.classList.remove("selected"));
  if (cardElement) cardElement.classList.add("selected");
};

/**
 * 📌 ២.៤ មុខងារបិទ Drawer និងលោតទៅ Customer 360
 */
window.closeUserDrawer = function () {
  document.getElementById("userDetailDrawer").classList.remove("open");
  document
    .querySelectorAll(".modern-user-card")
    .forEach((c) => c.classList.remove("selected"));
};

window.goToCustomer360 = function (username) {
  closeUserDrawer();
  showSection("customer-360");
  document.getElementById("searchC360").value = username;
  if (typeof searchCustomer360 === "function") searchCustomer360();
};

// ========================================================================
// ✏️ SECTION 3: PROFILE EDITING & CLOUDINARY UPLOAD (កែប្រែប្រវត្តិរូប)
// ========================================================================
// ឈប់ប្រើបកូដនៅទីនេះ

// ========================================================================
// 💰 SECTION 4: BALANCE ADJUSTMENT (បន្ថែម ឬ ដកប្រាក់)
// ========================================================================

/**
 * 📌 ៤.១ បើកផ្ទាំងបន្ថែម/ដកប្រាក់
 */
window.openAdjustBalance = function (username, type) {
  const isAdd = type === "add";
  const title = isAdd
    ? "ដាក់ប្រាក់ (Cash Deposit)"
    : "ដកប្រាក់ (Cash Withdrawal)";
  const confirmBtnColor = isAdd ? "#10b981" : "#ef4444";
  const icon = isAdd ? "circle-down" : "circle-up";

  const user = globalUsersData.find((u) => u.username === username);
  if (!user) return;

  let optionsHtml = `<option value="MAIN_USD" data-curr="USD">គណនី Main USD ($) - ${user.mainAccounts?.USD?.accountNumber || "N/A"}</option>`;

  if (user.mainAccounts?.KHR?.accountNumber) {
    optionsHtml += `<option value="MAIN_KHR" data-curr="KHR">គណនី Main KHR (៛) - ${user.mainAccounts.KHR.accountNumber}</option>`;
  }

  if (user.subAccounts && user.subAccounts.length > 0) {
    user.subAccounts.forEach((sub) => {
      const sym = sub.currency === "USD" ? "$" : "៛";
      optionsHtml += `<option value="${sub.accountNumber}" data-curr="${sub.currency}">${sub.accountName} (${sym}) - ${sub.accountNumber}</option>`;
    });
  }

  const formHtml = `
    <div style="text-align: left; font-family: 'Kantumruy Pro', sans-serif;">
        <div style="background: var(--bg-body); padding: 12px 15px; border-radius: 8px; margin-bottom: 20px; border: 1px solid var(--border); display: flex; align-items: center; gap: 10px;">
            <i class="fa-solid fa-user-circle" style="color: var(--text-muted); font-size: 1.5rem;"></i>
            <div>
                <div style="color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase; font-weight: bold;">សម្រាប់អតិថិជន</div>
                <div style="color: var(--text-main); font-size: 1.05rem; font-weight: bold;">@${username}</div>
            </div>
        </div>
        
        <div style="margin-bottom: 15px;">
            <label style="display: block; font-size: 0.85rem; font-weight: 600; color: var(--text-muted); margin-bottom: 6px;">ប្រភេទគណនី (Target Account)</label>
            <select id="adjTargetAccount" class="custom-swal-input" onchange="previewUserTableExchange()">
                ${optionsHtml}
            </select>
        </div>

        <div style="margin-bottom: 15px;">
            <label style="display: block; font-size: 0.85rem; font-weight: 600; color: var(--text-muted); margin-bottom: 6px;">ប្រភេទប្រាក់ដែល Admin កាន់ (Input Currency)</label>
            <select id="adjCurrency" class="custom-swal-input" onchange="previewUserTableExchange()">
                <option value="USD">ប្រាក់ដុល្លារ (USD)</option>
                <option value="KHR">ប្រាក់រៀល (KHR)</option>
            </select>
        </div>

        <div style="margin-bottom: 15px;">
            <label style="display: block; font-size: 0.85rem; font-weight: 600; color: var(--text-muted); margin-bottom: 6px;">ចំនួនទឹកប្រាក់ (Amount)</label>
            <input id="adjAmount" type="number" class="custom-swal-input" placeholder="ឧ. 50.00 ឬ 40000" oninput="previewUserTableExchange()">
        </div>

        <!-- ប្រអប់បង្ហាញការដូរលុយអូតូ (Preview) -->
        <div id="userTableExchangePreviewBox" style="display: none; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); padding: 12px 15px; border-radius: 12px; margin-bottom: 15px; text-align: left; animation: fadeIn 0.3s ease;">
            <p style="margin: 0 0 5px 0; font-size: 0.85rem; color: #10b981; display: flex; justify-content: space-between;">
                <span>Exchange Rate:</span>
                <span id="userTableFxRateDisplay" style="font-weight: 600;">...</span>
            </p>
            <p style="margin: 0; font-size: 0.85rem; color: #10b981; display: flex; justify-content: space-between; font-weight: bold; align-items: center;">
                <span>Receiver Gets:</span>
                <span id="userTableExchangeResult" style="font-size: 1.15rem; font-weight: 800;">...</span>
            </p>
        </div>

        <div style="margin-bottom: 5px;">
            <label style="display: block; font-size: 0.85rem; font-weight: 600; color: var(--text-muted); margin-bottom: 6px;">ចំណាំ (Remark)</label>
            <input id="adjRemark" type="text" class="custom-swal-input" placeholder="បញ្ជាក់មូលហេតុ... (ជម្រើស)">
        </div>
        <style>
            .custom-swal-input {
                width: 100%; box-sizing: border-box; height: 45px; padding: 0 15px;
                font-size: 0.95rem; border: 1px solid var(--border); border-radius: 8px;
                color: var(--text-main); background: var(--bg-body); transition: all 0.2s ease-in-out; font-family: inherit;
            }
            .custom-swal-input:focus { border-color: ${confirmBtnColor}; box-shadow: 0 0 0 3px ${confirmBtnColor}20; outline: none; }
        </style>
    </div>
  `;

  Swal.fire({
    title: `<div style="color: var(--text-main); font-size: 1.4rem;"><i class="fa-solid fa-${icon}" style="color: ${confirmBtnColor}; margin-right: 8px;"></i> ${title}</div>`,
    html: formHtml,
    showCancelButton: true,
    confirmButtonColor: confirmBtnColor,
    cancelButtonColor: "#64748b",
    confirmButtonText: "បញ្ជាក់ (Confirm)",
    cancelButtonText: "បោះបង់",
    customClass: { popup: "premium-swal" },
    preConfirm: () => {
      const selectAcc = document.getElementById("adjTargetAccount");
      const targetAccount = selectAcc.value;
      const selectCur = document.getElementById("adjCurrency");
      const currency = selectCur.value;
      const amount = document.getElementById("adjAmount").value;
      const remark = document.getElementById("adjRemark").value.trim();

      if (!amount || amount <= 0) {
        Swal.showValidationMessage("សូមបញ្ចូលចំនួនទឹកប្រាក់ឱ្យបានត្រឹមត្រូវ!");
      }
      return { targetAccount, currency, amount, remark };
    },
  }).then(async (result) => {
    if (result.isConfirmed) {
      Swal.fire({
        title: "កំពុងដំណើរការ...",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
        customClass: { popup: "premium-swal" },
      });
      try {
        const res = await fetch("/api/admin/adjust-balance", {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            username,
            targetAccount: result.value.targetAccount,
            amount: result.value.amount,
            currency: result.value.currency,
            type,
            remark: result.value.remark,
          }),
        });
        const data = await res.json();
        if (data.success) {
          Swal.fire({
            icon: "success",
            title: "ជោគជ័យ!",
            text: data.message || "ប្រតិបត្តិការជោគជ័យ",
            customClass: { popup: "premium-swal" },
          });
          if (typeof loadData === "function") loadData();
        } else {
          Swal.fire({
            icon: "error",
            title: "បរាជ័យ",
            text: data.message,
            customClass: { popup: "premium-swal" },
          });
        }
      } catch (error) {
        Swal.fire({
          icon: "error",
          title: "Error",
          text: "មានបញ្ហាភ្ជាប់ទៅកាន់ Server",
          customClass: { popup: "premium-swal" },
        });
      }
    }
  });
};

/**
 * 📌 ៤.២ គណនាបង្ហាញលុយមុន សម្រាប់ផ្ទាំង Modal (Exchange Auto-Calculate)
 */
window.previewUserTableExchange = function () {
  const targetSelect = document.getElementById("adjTargetAccount");
  if (!targetSelect) return;

  const targetCurrency =
    targetSelect.options[targetSelect.selectedIndex].getAttribute("data-curr");
  const inputCurrency = document.getElementById("adjCurrency").value;
  const amountInput = document.getElementById("adjAmount");
  const amount = parseFloat(amountInput.value) || 0;

  const previewBox = document.getElementById("userTableExchangePreviewBox");
  const rateDisplay = document.getElementById("userTableFxRateDisplay");
  const resultText = document.getElementById("userTableExchangeResult");

  const rateBuy = window.currentFXRates
    ? window.currentFXRates.usdToKhrBuy || 4050
    : 4050;
  const rateSell = window.currentFXRates
    ? window.currentFXRates.usdToKhrSell || 4100
    : 4100;

  if (amount > 0 && targetCurrency !== inputCurrency) {
    previewBox.style.display = "block";
    if (inputCurrency === "USD" && targetCurrency === "KHR") {
      const khrAmt = Math.round(amount * rateBuy);
      rateDisplay.innerText = `$1 = ${rateBuy.toLocaleString("en-US")} ៛`;
      resultText.innerText = `${khrAmt.toLocaleString("en-US")} ៛`;
    } else if (inputCurrency === "KHR" && targetCurrency === "USD") {
      const usdAmt = (amount / rateSell).toFixed(2);
      rateDisplay.innerText = `$1 = ${rateSell.toLocaleString("en-US")} ៛`;
      resultText.innerText = `$${usdAmt}`;
    }
  } else {
    previewBox.style.display = "none";
  }
};

// ========================================================================
// 🛑 SECTION 5: ACCOUNT STATUS MANAGEMENT (ផ្អាក និងលុបគណនី)
// ========================================================================

/**
 * 📌 ៥.១ លុបអ្នកប្រើប្រាស់ ឬ គណនីរង (Delete User/Sub-account)
 */
window.deleteUser = function (id) {
  const user = globalUsersData.find((u) => (u._id || u.id) === id);
  if (!user) return;

  let optionsHtml = `<option value="ALL">លុបគណនីអ្នកប្រើប្រាស់ទាំងមូល (Delete Entire User)</option>`;
  if (user.subAccounts && user.subAccounts.length > 0) {
    user.subAccounts.forEach((sub) => {
      optionsHtml += `<option value="${sub.accountNumber}">លុបតែគណនីរង: ${sub.accountNumber} (${sub.accountName})</option>`;
    });
  }

  const formHtml = `
    <div style="text-align: left; font-family: 'Kantumruy Pro', sans-serif;">
        <div style="margin-bottom: 15px;">
            <label style="display: block; font-size: 0.85rem; font-weight: 600; color: var(--text-muted); margin-bottom: 6px;">ជ្រើសរើសទិន្នន័យដែលត្រូវលុប</label>
            <select id="delTarget" class="custom-swal-input" style="width: 100%; height: 45px; padding: 0 15px; border: 1px solid var(--border); background: var(--bg-body); color: var(--text-main); border-radius: 8px; font-family: inherit;">
                ${optionsHtml}
            </select>
        </div>
        <div style="margin-bottom: 5px;">
            <label style="display: block; font-size: 0.85rem; font-weight: 600; color: var(--text-muted); margin-bottom: 6px;">មូលហេតុ (Reason - ចាំបាច់)</label>
            <input id="delReason" type="text" class="custom-swal-input" style="width: 100%; height: 45px; padding: 0 15px; border: 1px solid var(--border); background: var(--bg-body); color: var(--text-main); border-radius: 8px; font-family: inherit;" placeholder="បញ្ជាក់មូលហេតុនៃការលុប...">
        </div>
    </div>
  `;

  Swal.fire({
    title: `<div style="color: #ef4444; font-size: 1.4rem;"><i class="fa-solid fa-triangle-exclamation"></i> បញ្ជាក់ការលុបទិន្នន័យ</div>`,
    html: formHtml,
    showCancelButton: true,
    confirmButtonColor: "#ef4444",
    cancelButtonColor: "#64748b",
    confirmButtonText: "បាទ/ចាស, លុប!",
    cancelButtonText: "បោះបង់",
    customClass: { popup: "premium-swal" },
    preConfirm: () => {
      const targetAccount = document.getElementById("delTarget").value;
      const reason = document.getElementById("delReason").value.trim();
      if (!reason) {
        Swal.showValidationMessage("សូមបញ្ចូលមូលហេតុនៃការលុបឱ្យបានច្បាស់លាស់!");
      }
      return { targetAccount, reason };
    },
  }).then(async (result) => {
    if (result.isConfirmed) {
      try {
        Swal.fire({
          title: "កំពុងដំណើរការ...",
          allowOutsideClick: false,
          didOpen: () => Swal.showLoading(),
        });
        const res = await fetch("/api/admin/delete-user", {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            id: id,
            targetAccount: result.value.targetAccount,
            reason: result.value.reason,
          }),
        });
        const data = await res.json();
        if (data.success) {
          Swal.fire({
            toast: true,
            position: "top-end",
            icon: "success",
            title: "បានលុបជោគជ័យ",
            showConfirmButton: false,
            timer: 1500,
            customClass: { popup: "premium-swal" },
          });
          if (typeof loadData === "function") loadData();
        } else {
          Swal.fire("Error", data.message || "មិនអាចលុបទិន្នន័យបានទេ", "error");
        }
      } catch (e) {
        Swal.fire("Error", "បញ្ហាការតភ្ជាប់", "error");
      }
    }
  });
};

/**
 * 📌 ៥.២ ផ្អាក / បើកដំណើរការគណនី (Freeze / Unfreeze)
 */
window.toggleFreeze = async function (id, isFrozen) {
  try {
    const res = await fetch("/api/admin/toggle-freeze", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ id, isFrozen }),
    });

    if (!res.ok)
      throw new Error(`Serverឆ្លើយតបខុសប្រក្រតី (Status: ${res.status})`);

    const data = await res.json();
    if (data.success) {
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: isFrozen ? "គណនីត្រូវបានផ្អាក" : "គណនីបានដោះសោរ",
        showConfirmButton: false,
        timer: 1500,
        customClass: { popup: "premium-swal" },
      });
      const user = globalUsersData.find((u) => (u._id || u.id) === id);
      if (user) user.isFrozen = isFrozen;
    } else {
      Swal.fire({
        icon: "error",
        title: "បរាជ័យ",
        text: data.message || "មិនអាចប្តូរស្ថានភាពបានទេ",
        customClass: { popup: "premium-swal" },
      });
      if (typeof loadData === "function") loadData();
    }
  } catch (e) {
    console.error("TOGGLE FREEZE FRONTEND ERROR:", e);
    Swal.fire({
      icon: "error",
      title: "Error",
      text: "បញ្ហាតភ្ជាប់: " + e.message,
      customClass: { popup: "premium-swal" },
    });
    if (typeof loadData === "function") loadData();
  }
};

/**
 * 📌 ៥.៣ មុខងារសម្រាប់ផ្ញើសារផ្ទាល់ទៅកាន់អតិថិជន
 */
window.sendDirectMessage = async function (username) {
  const { value: text } = await Swal.fire({
    title: `ផ្ញើសារទៅកាន់ @${username}`,
    input: "textarea",
    inputPlaceholder: "វាយបញ្ចូលសាររបស់អ្នកនៅទីនេះ...",
    showCancelButton: true,
    confirmButtonColor: "#3b82f6",
    confirmButtonText: "ផ្ញើសារ",
    customClass: { popup: "premium-swal" },
  });

  if (text) {
    // កូដសម្រាប់ហៅ API ផ្ញើសារ (អាចប្រើ API ticket-reply ឬ broadcast)
    Swal.fire({
      toast: true,
      position: "top-end",
      icon: "success",
      title: "សារត្រូវបានបញ្ជូន!",
      showConfirmButton: false,
      timer: 1500,
    });
  }
};

/**
 * 📌 ៥.៤ មុខងារសម្រាប់ Force Logout អតិថិជន
 */
window.forceLogoutUser = function (username) {
  Swal.fire({
    title: "ផ្តាច់គណនីអតិថិជន?",
    text: `តើអ្នកចង់បង្ខំឱ្យ @${username} Log out ចេញពីគ្រប់ឧបករណ៍មែនទេ?`,
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#f59e0b",
    confirmButtonText: "បាទ/ចាស ផ្តាច់គណនី",
    customClass: { popup: "premium-swal" },
  }).then(async (result) => {
    if (result.isConfirmed) {
      try {
        const res = await fetch("/api/admin/force-logout", {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({ username }),
        });
        const data = await res.json();
        if (data.success) {
          Swal.fire({
            toast: true,
            position: "top-end",
            icon: "success",
            title: "គណនីត្រូវបានផ្តាច់!",
            showConfirmButton: false,
            timer: 1500,
          });
        }
      } catch (e) {
        Swal.fire("Error", "មិនអាចភ្ជាប់ទៅកាន់ Server", "error");
      }
    }
  });
};
