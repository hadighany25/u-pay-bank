// ========================================================================
// 👥 USER MANAGEMENT LOGIC (NO LIMITS & INSTANT RENDER)
// ========================================================================

// =======================================================
// ១. មុខងារគូរតារាង (បង្ហាញទាំងអស់ គ្មាន Limit)
// =======================================================
function renderUsersTable(users) {
  const tbody = document.querySelector("#userTable tbody");

  if (!users || users.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="5" style="text-align:center; padding: 40px; color: var(--text-muted);">មិនមានទិន្នន័យទេ</td></tr>';
    return;
  }

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

  // បង្កើត HTML ជាដុំធំតែមួយ ដើម្បីឱ្យ Browser គូរបានលឿនបំផុត ទោះមានរាប់ពាន់ជួរក៏ដោយ
  const rowsHtml = users
    .map((u) => {
      const uid = u._id || u.id;
      const isCentralBank = u.accountNumber === "888888888";

      const accountsHtml = `
        <div class="acc-stack">
            <div class="acc-badge usd"><span>$</span> ${u.accountNumber || "N/A"}</div>
            ${u.accountNumberKHR ? `<div class="acc-badge khr"><span>៛</span> ${u.accountNumberKHR}</div>` : ""}
        </div>`;

      const balanceHtml = `
        <div class="acc-stack">
            <div style="color: #0369a1; font-weight: bold;">$${(u.balance || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
            <div style="color: #047857; font-weight: bold;">${(u.balanceKHR || 0).toLocaleString("en-US")} ៛</div>
        </div>`;

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

      const freezeHtml = isCentralBank
        ? `<span class="status-badge" style="background:#dbeafe; color:#2563eb;">System Bank</span>`
        : canFreeze
          ? `<label class="switch"><input type="checkbox" ${u.isFrozen ? "checked" : ""} onchange="toggleFreeze('${uid}', this.checked)"><span class="slider"></span></label>`
          : `<span style="color: ${u.isFrozen ? "#ef4444" : "#10b981"}">${u.isFrozen ? "Frozen" : "Active"}</span>`;

      const bgStyle = isCentralBank ? "background-color: #fef9c3;" : "";
      const imgSrc =
        u.profileImage ||
        (isCentralBank ? "images/logo.png" : "images/default-avatar.png");

      return `
      <tr style="${bgStyle}">
        <td>
            <div style="display: flex; align-items: center; gap: 10px">
                <img loading="lazy" src="${imgSrc}" style="width: 35px; height: 35px; border-radius: 50%; object-fit: cover; border: 1px solid #ddd;" onerror="this.src='images/default-avatar.png'" />
                <div>
                    <div style="font-weight: bold; color: var(--text-dark)">${u.fullName || u.username} ${isCentralBank ? "🏦" : ""}</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted)">@${u.username}</div>
                </div>
            </div>
        </td>
        <td>${accountsHtml}</td>
        <td>${balanceHtml}</td>
        <td>${freezeHtml}</td>
        <td><div style="display: flex; gap: 8px; justify-content: flex-end;">${actionButtonsHtml}</div></td>
      </tr>`;
    })
    .join("");

  tbody.innerHTML = rowsHtml;
}

// =======================================================
// ២. មុខងារស្វែងរក (Instant Search គ្មានការរង់ចាំ)
// =======================================================
function filterUsers() {
  const term = document.getElementById("searchBox").value.toLowerCase().trim();

  if (!term) {
    renderUsersTable(globalUsersData);
    return;
  }

  // រកភ្លាមៗនៅក្នុង RAM (Instant Filter)
  const filteredData = globalUsersData.filter((u) => {
    const uname = (u.username || "").toLowerCase();
    const fname = (u.fullName || "").toLowerCase();
    const accUSD = (u.accountNumber || "").toString();
    const accKHR = (u.accountNumberKHR || "").toString();

    return (
      uname.includes(term) ||
      fname.includes(term) ||
      accUSD.includes(term) ||
      accKHR.includes(term)
    );
  });

  renderUsersTable(filteredData);
}

// =======================================================
// ៣. មុខងារបង្រួមរូបភាព (Image Compression) ដើម្បីសង្គ្រោះ Database
// =======================================================
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

        const compressedBase64 = canvas.toDataURL("image/jpeg", 0.7);
        resolve(compressedBase64);
      };
    };
  });
}

async function handleProfileImageUpload(event) {
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
}

// =======================================================
// ៤. មុខងារលម្អិត (កែប្រែ, បញ្ចូលប្រាក់, ផ្អាក, លុប)
// =======================================================
function openEditModal(id) {
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
}

function closeModal(modalId) {
  document
    .getElementById(modalId)
    .style.setProperty("display", "none", "important");
}

async function saveUserEdit() {
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
}

function openAdjustBalance(username, type) {
  const isAdd = type === "add";
  const title = isAdd
    ? "ដាក់ប្រាក់ (Cash Deposit)"
    : "ដកប្រាក់ (Cash Withdrawal)";
  const confirmBtnColor = isAdd ? "#10b981" : "#ef4444"; // ពណ៌បៃតង សម្រាប់ដាក់, ក្រហម សម្រាប់ដក
  const icon = isAdd ? "circle-down" : "circle-up";

  // រៀបចំ UI ឱ្យមើលទៅ Professional (Premium Look)
  const formHtml = `
    <div style="text-align: left; font-family: 'Kantumruy Pro', sans-serif;">
        <!-- ប្រអប់បង្ហាញឈ្មោះអតិថិជន -->
        <div style="background: #f8fafc; padding: 12px 15px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #e2e8f0; display: flex; align-items: center; gap: 10px;">
            <i class="fa-solid fa-user-circle" style="color: #94a3b8; font-size: 1.5rem;"></i>
            <div>
                <div style="color: #64748b; font-size: 0.8rem; text-transform: uppercase; font-weight: bold;">សម្រាប់អតិថិជន</div>
                <div style="color: #0f172a; font-size: 1.05rem; font-weight: bold;">@${username}</div>
            </div>
        </div>

        <!-- ជ្រើសរើសប្រភេទគណនី -->
        <div style="margin-bottom: 15px;">
            <label style="display: block; font-size: 0.85rem; font-weight: 600; color: #475569; margin-bottom: 6px;">ប្រភេទគណនី (Account Type)</label>
            <select id="adjCurrency" class="custom-swal-input">
                <option value="USD">គណនី USD ($)</option>
                <option value="KHR">គណនី KHR (៛)</option>
            </select>
        </div>

        <!-- បញ្ចូលចំនួនទឹកប្រាក់ -->
        <div style="margin-bottom: 15px;">
            <label style="display: block; font-size: 0.85rem; font-weight: 600; color: #475569; margin-bottom: 6px;">ចំនួនទឹកប្រាក់ (Amount)</label>
            <input id="adjAmount" type="number" class="custom-swal-input" placeholder="ឧ. 50.00 ឬ 40000">
        </div>

        <!-- 🌟 បន្ថែមប្រអប់ចំណាំ (Remark) ថ្មី -->
        <div style="margin-bottom: 5px;">
            <label style="display: block; font-size: 0.85rem; font-weight: 600; color: #475569; margin-bottom: 6px;">ចំណាំ (Remark)</label>
            <input id="adjRemark" type="text" class="custom-swal-input" placeholder="បញ្ជាក់មូលហេតុ... (ជម្រើស)">
        </div>

        <!-- CSS សម្រាប់ Input ឱ្យស្អាត -->
        <style>
            .custom-swal-input {
                width: 100%;
                box-sizing: border-box;
                height: 45px;
                padding: 0 15px;
                font-size: 0.95rem;
                border: 1px solid #cbd5e1;
                border-radius: 8px;
                color: #1e293b;
                transition: all 0.2s ease-in-out;
                font-family: inherit;
            }
            .custom-swal-input:focus {
                border-color: ${confirmBtnColor};
                box-shadow: 0 0 0 3px ${confirmBtnColor}20;
                outline: none;
            }
        </style>
    </div>
  `;

  Swal.fire({
    title: `<div style="color: #1e293b; font-size: 1.4rem;"><i class="fa-solid fa-${icon}" style="color: ${confirmBtnColor}; margin-right: 8px;"></i> ${title}</div>`,
    html: formHtml,
    showCancelButton: true,
    confirmButtonColor: confirmBtnColor,
    cancelButtonColor: "#64748b",
    confirmButtonText: "បញ្ជាក់ (Confirm)",
    cancelButtonText: "បោះបង់",
    customClass: {
      popup: "professional-popup", // បន្ថែម Class សម្រាប់ Custom បន្ថែមបើចង់
    },
    preConfirm: () => {
      const currency = document.getElementById("adjCurrency").value;
      const amount = document.getElementById("adjAmount").value;
      const remark = document.getElementById("adjRemark").value.trim(); // ទាញយកតម្លៃ Remark

      if (!amount || amount <= 0) {
        Swal.showValidationMessage("សូមបញ្ចូលចំនួនទឹកប្រាក់ឱ្យបានត្រឹមត្រូវ!");
      }
      return { currency, amount, remark }; // បញ្ជូន Remark ទៅកាន់ Promise
    },
  }).then(async (result) => {
    if (result.isConfirmed) {
      Swal.fire({
        title: "កំពុងដំណើរការ...",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });
      try {
        const res = await fetch("/api/admin/adjust-balance", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + localStorage.getItem("adminToken"), // កុំភ្លេច Header
          },
          // 🚀 បញ្ជូន remark ទៅឱ្យ Backend
          body: JSON.stringify({
            username,
            amount: result.value.amount,
            currency: result.value.currency,
            type,
            remark: result.value.remark,
          }),
        });
        const data = await res.json();

        if (data.success) {
          Swal.fire(
            "ជោគជ័យ!",
            data.message || "ប្រតិបត្តិការជោគជ័យ",
            "success",
          );
          if (typeof loadData === "function") loadData();
        } else {
          Swal.fire("បរាជ័យ", data.message, "error");
        }
      } catch (error) {
        Swal.fire("Error", "មានបញ្ហាភ្ជាប់ទៅកាន់ Server", "error");
      }
    }
  });
}

function deleteUser(id) {
  Swal.fire({
    title: "តើអ្នកប្រាកដទេ?",
    text: "ទិន្នន័យគណនីនេះនឹងត្រូវលុបចោលទាំងស្រុងពីប្រព័ន្ធ។",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#ef4444",
    cancelButtonColor: "#64748b",
    confirmButtonText: "បាទ/ចាស, លុប!",
    cancelButtonText: "បោះបង់",
  }).then(async (result) => {
    if (result.isConfirmed) {
      try {
        const res = await fetch("/api/admin/delete-user", {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({ id }),
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
          });
          if (typeof loadData === "function") loadData();
        } else {
          Swal.fire("Error", data.message || "មិនអាចលុបគណនីបានទេ", "error");
        }
      } catch (e) {
        Swal.fire("Error", "បញ្ហាការតភ្ជាប់", "error");
      }
    }
  });
}

async function toggleFreeze(id, isFrozen) {
  try {
    const res = await fetch("/api/admin/toggle-freeze", {
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
        title: isFrozen ? "គណនីត្រូវបានផ្អាក" : "គណនីបានដោះសោរ",
        showConfirmButton: false,
        timer: 1500,
      });
      const user = globalUsersData.find((u) => (u._id || u.id) === id);
      if (user) user.isFrozen = isFrozen;
    } else {
      Swal.fire("បរាជ័យ", data.message || "មិនអាចប្តូរស្ថានភាពបានទេ", "error");
      if (typeof loadData === "function") loadData();
    }
  } catch (e) {
    Swal.fire("Error", "បញ្ហាតភ្ជាប់", "error");
    if (typeof loadData === "function") loadData();
  }
}
