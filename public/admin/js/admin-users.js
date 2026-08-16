// communicationController.js

// ========================================================================
// 👥 ផ្នែកទី ១៖ ការគ្រប់គ្រងអ្នកប្រើប្រាស់ (USER MANAGEMENT LOGIC)
// ========================================================================

// ------------------------------------------------------------------------
// 📌 ១.១ មុខងារគូរតារាងបង្ហាញទិន្នន័យអ្នកប្រើប្រាស់ (Render Table)
// ------------------------------------------------------------------------
function renderUsersTable(users) {
  const tbody = document.querySelector("#userTable tbody");

  // បើគ្មានទិន្នន័យ បង្ហាញសារទទេ
  if (!users || users.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="5" style="text-align:center; padding: 40px; color: var(--text-muted);">មិនមានទិន្នន័យទេ</td></tr>';
    return;
  }

  // ឆែកមើលសិទ្ធិរបស់ Admin (Dynamic Permissions)
  const canEdit =
    adminRole === "super_admin" ||
    (myAdminPermissions && myAdminPermissions.actions?.editUser);
  const canDelete =
    adminRole === "super_admin" ||
    (myAdminPermissions && myAdminPermissions.actions?.deleteUser);
  const canFreeze =
    adminRole === "super_admin" ||
    (myAdminPermissions && myAdminPermissions.actions?.freezeUser);
  const canAdjust =
    adminRole === "super_admin" ||
    (myAdminPermissions && myAdminPermissions.actions?.adjustBal);

  // គូរតារាងជួរនីមួយៗ
  const rowsHtml = users
    .map((u) => {
      const uid = u._id || u.id;
      const isCentralBank = u.accountNumber === "888888888";

      // រៀបចំ HTML គណនី និង សមតុល្យ
      let accountsHtml = `<div style="display:flex; flex-direction:column; gap:8px;">`;
      let balanceHtml = `<div style="display:flex; flex-direction:column; gap:8px;">`;

      // គណនី Main USD
      accountsHtml += `
        <div class="acc-badge usd" style="height: 28px; display: flex; align-items: center;" title="Main USD">
            <span>$</span> ${u.accountNumber || "N/A"}
        </div>`;
      balanceHtml += `
        <div style="height: 28px; display: flex; align-items: center; color: #0369a1; font-weight: bold;" title="Main USD">
            $${(u.balance || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
        </div>`;

      // គណនី Main KHR
      if (u.accountNumberKHR) {
        accountsHtml += `
            <div class="acc-badge khr" style="height: 28px; display: flex; align-items: center;" title="Main KHR">
                <span>៛</span> ${u.accountNumberKHR}
            </div>`;
        balanceHtml += `
            <div style="height: 28px; display: flex; align-items: center; color: #047857; font-weight: bold;" title="Main KHR">
                ${(u.balanceKHR || 0).toLocaleString("en-US")} ៛
            </div>`;
      }

      // គណនី Sub-accounts (បើមាន)
      if (u.subAccounts && u.subAccounts.length > 0) {
        u.subAccounts.forEach((sub) => {
          const sym = sub.currency === "USD" ? "$" : "៛";
          const colorClass = sub.currency === "USD" ? "usd" : "khr";
          const valColor = sub.currency === "USD" ? "#0369a1" : "#047857";
          const formattedBal =
            sub.currency === "USD"
              ? (sub.balance || 0).toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                })
              : (sub.balance || 0).toLocaleString("en-US");

          accountsHtml += `
            <div class="acc-badge ${colorClass}" style="height: 28px; display: flex; align-items: center; opacity: 0.85;" title="${sub.accountName}">
                <span>${sym}</span> ${sub.accountNumber} <span style="font-size:0.65rem; color:#64748b; margin-left: 5px;">(${sub.accountName})</span>
            </div>`;

          balanceHtml += `
            <div style="height: 28px; display: flex; align-items: center; color: ${valColor}; font-weight: bold; opacity: 0.85;" title="${sub.accountName}">
                ${sub.currency === "USD" ? "$" : ""}${formattedBal}${sub.currency === "KHR" ? " ៛" : ""}
            </div>`;
        });
      }

      accountsHtml += `</div>`;
      balanceHtml += `</div>`;

      // ប៊ូតុងសកម្មភាព (Actions)
      let actionButtonsHtml = "";
      if (isCentralBank) {
        if (canEdit)
          actionButtonsHtml = `<button class="btn-action btn-edit" title="Edit Info" onclick="openEditModal('${uid}')"><i class="fa-solid fa-pen"></i></button>`;
      } else {
        if (canAdjust) {
          actionButtonsHtml += `<button class="btn-action" style="background:#ecfdf5; color:#10b981; border: 1px solid #a7f3d0;" title="Add Money" onclick="openAdjustBalance('${u.username}', 'add')"><i class="fa-solid fa-plus"></i></button>`;
          actionButtonsHtml += `<button class="btn-action" style="background:#fef2f2; color:#ef4444; border: 1px solid #fecaca;" title="Deduct Money" onclick="openAdjustBalance('${u.username}', 'deduct')"><i class="fa-solid fa-minus"></i></button>`;
        }
        if (canEdit)
          actionButtonsHtml += `<button class="btn-action btn-edit" title="Edit Info" onclick="openEditModal('${uid}')"><i class="fa-solid fa-pen"></i></button>`;
        if (canDelete)
          actionButtonsHtml += `<button class="btn-action btn-delete" title="Delete User" onclick="deleteUser('${uid}')"><i class="fa-solid fa-trash"></i></button>`;
      }

      // ស្ថានភាពគណនី (Freeze Status)
      const freezeHtml = isCentralBank
        ? `<span class="status-badge" style="background:#dbeafe; color:#2563eb; padding: 4px 8px; border-radius: 6px;">System Bank</span>`
        : canFreeze
          ? `<label class="switch" style="margin: 0 auto;"><input type="checkbox" ${u.isFrozen ? "checked" : ""} onchange="toggleFreeze('${uid}', this.checked)"><span class="slider"></span></label>`
          : `<span style="color: ${u.isFrozen ? "#ef4444" : "#10b981"}">${u.isFrozen ? "Frozen" : "Active"}</span>`;

      const bgStyle = isCentralBank ? "background-color: #fef9c3;" : "";
      const imgSrc = u.profileImage || "/images/logo.png";

      return `
      <tr style="${bgStyle}">
        <td style="vertical-align: middle;">
            <div style="display: flex; align-items: center; gap: 10px">
                <img loading="lazy" src="${imgSrc}" style="width: 35px; height: 35px; border-radius: 50%; object-fit: cover; border: 1px solid #ddd;" onerror="this.src='/images/logo.png'" />
                <div>
                    <div style="font-weight: bold; color: var(--text-dark)">${u.fullName || u.username} ${isCentralBank ? "🏦" : ""}</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted)">@${u.username}</div>
                </div>
            </div>
        </td>
        <td style="vertical-align: middle;">${accountsHtml}</td>
        <td style="vertical-align: middle;">${balanceHtml}</td>
        <td style="vertical-align: middle; text-align: center;">${freezeHtml}</td>
        <td style="vertical-align: middle; text-align: center;">
            <div style="display: flex; gap: 8px; justify-content: flex-end;">${actionButtonsHtml}</div>
        </td>
      </tr>`;
    })
    .join("");

  tbody.innerHTML = rowsHtml;
}

// ------------------------------------------------------------------------
// 📌 ១.២ មុខងារស្វែងរកអ្នកប្រើប្រាស់ (Instant Search)
// ------------------------------------------------------------------------
function filterUsers() {
  const term = document.getElementById("searchBox").value.toLowerCase().trim();

  if (!term) {
    renderUsersTable(globalUsersData);
    return;
  }

  const filteredData = globalUsersData.filter((u) => {
    const uname = (u.username || "").toLowerCase();
    const fname = (u.fullName || "").toLowerCase();
    const accUSD = (u.accountNumber || "").toString();
    const accKHR = (u.accountNumberKHR || "").toString();

    let subMatch = false;
    if (u.subAccounts && u.subAccounts.length > 0) {
      subMatch = u.subAccounts.some((sub) =>
        (sub.accountNumber || "").toString().includes(term),
      );
    }

    return (
      uname.includes(term) ||
      fname.includes(term) ||
      accUSD.includes(term) ||
      accKHR.includes(term) ||
      subMatch
    );
  });

  renderUsersTable(filteredData);
}

// ------------------------------------------------------------------------
// 📌 ១.៣ មុខងារបង្រួមរូបភាព និង កែប្រែគណនី (Image Compress & Edit)
// ------------------------------------------------------------------------
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

window.handleProfileImageUpload = async function (event) {
  const file = event.target.files[0];
  if (!file) return;

  Swal.fire({
    title: "កំពុងរៀបចំរូបភាព...",
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading(),
  });
  const smallBase64 = await compressImageAndPreview(file);

  document.getElementById("e-preview").src = smallBase64;
  document.getElementById("editProfileImg").value = smallBase64;
  Swal.close();
};

window.openEditModal = function (id) {
  const u = globalUsersData.find(
    (user) => (user._id || user.id) === id || user.username === id,
  );
  if (!u) return;

  document.getElementById("editUserId").value = u._id || u.id;
  document.getElementById("editUsername").value = u.username || "";
  document.getElementById("editAccNum").value = u.accountNumber || "";
  document.getElementById("editAccNumKHR").value = u.accountNumberKHR || "";
  document.getElementById("editPin").value = u.pin || "";
  document.getElementById("editPassword").value = "";

  if (u.profileImage && u.profileImage.startsWith("data:image")) {
    document.getElementById("editProfileImg").value = u.profileImage;
  } else {
    document.getElementById("editProfileImg").value = u.profileImage || "";
  }

  document.getElementById("e-preview").src =
    u.profileImage || "images/logo.png";
  document
    .getElementById("editUserModal")
    .style.setProperty("display", "flex", "important");
};

window.closeModal = function (modalId) {
  document
    .getElementById(modalId)
    .style.setProperty("display", "none", "important");
};

window.saveUserEdit = async function () {
  const id = document.getElementById("editUserId").value;
  const imgInputVal = document.getElementById("editProfileImg").value;

  const bodyData = {
    id: id,
    username: document.getElementById("editUsername").value,
    accountNumber: document.getElementById("editAccNum").value,
    accountNumberKHR: document.getElementById("editAccNumKHR").value,
    pin: document.getElementById("editPin").value,
    password: document.getElementById("editPassword").value,
  };

  if (imgInputVal && imgInputVal.trim() !== "") {
    bodyData.profileImage = imgInputVal;
  }

  try {
    const res = await fetch("/api/admin/edit-user", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(bodyData),
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
      closeModal("editUserModal");
      if (typeof loadData === "function") loadData();
    } else {
      Swal.fire("បរាជ័យ!", data.message, "error");
    }
  } catch (error) {
    Swal.fire("Error", "មានបញ្ហាក្នុងការភ្ជាប់ទៅកាន់ Server", "error");
  }
};

// ------------------------------------------------------------------------
// 📌 ១.៤ មុខងារបន្ថែម ឬ ដកប្រាក់ពីតារាងផ្ទាល់ (Adjust Balance)
// ------------------------------------------------------------------------
window.openAdjustBalance = function (username, type) {
  const isAdd = type === "add";
  const title = isAdd
    ? "ដាក់ប្រាក់ (Cash Deposit)"
    : "ដកប្រាក់ (Cash Withdrawal)";
  const confirmBtnColor = isAdd ? "#10b981" : "#ef4444";
  const icon = isAdd ? "circle-down" : "circle-up";

  const user = globalUsersData.find((u) => u.username === username);
  if (!user) return;

  let optionsHtml = `<option value="MAIN_USD" data-curr="USD">គណនី Main USD ($) - ${user.accountNumber}</option>`;
  if (user.accountNumberKHR) {
    optionsHtml += `<option value="MAIN_KHR" data-curr="KHR">គណនី Main KHR (៛) - ${user.accountNumberKHR}</option>`;
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

        <!-- 🔥 ប្រអប់បង្ហាញការដូរលុយអូតូ (Preview) -->
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
        } else
          Swal.fire({
            icon: "error",
            title: "បរាជ័យ",
            text: data.message,
            customClass: { popup: "premium-swal" },
          });
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

// 🔥 មុខងារគណនាបង្ហាញលុយមុន សម្រាប់ Modal (ទាញអត្រាប្តូរប្រាក់អូតូពី Database)
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

  // ទាញអត្រាប្តូរប្រាក់ពីអថេរសកល (ដែលបាន Update ដោយ fetchFXRates)
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

// ------------------------------------------------------------------------
// 📌 ១.៦ មុខងារលុប និង ផ្អាកគណនីអតិថិជន
// ------------------------------------------------------------------------
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
        } else
          Swal.fire("Error", data.message || "មិនអាចលុបទិន្នន័យបានទេ", "error");
      } catch (e) {
        Swal.fire("Error", "បញ្ហាការតភ្ជាប់", "error");
      }
    }
  });
};

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
