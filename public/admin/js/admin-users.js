// ========================================================================
// 👥 USER MANAGEMENT LOGIC (ULTRA-FAST & IMAGE COMPRESSION)
// ========================================================================

const MAX_DISPLAY = 50; // កំណត់ត្រឹម ៥០ នាក់ដំបូង ដើម្បីកុំឱ្យគាំង Browser

// =======================================================
// ១. មុខងារគូរតារាង (Render) លឿនផ្លេកបន្ទោរ
// =======================================================
function renderUsersTable(users) {
  const tbody = document.querySelector("#userTable tbody");

  if (!users || users.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="5" style="text-align:center; padding: 40px; color: var(--text-muted);">មិនមានទិន្នន័យទេ</td></tr>';
    return;
  }

  // ឆែកសិទ្ធិ Admin ម្តងទុកប្រើគ្រប់ជួរ
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

  // កាត់យកតែ ៥០ នាក់ដំបូងមកគូរ
  const displayUsers = users.slice(0, MAX_DISPLAY);

  // បង្កើត HTML ជាដុំធំ (Batch DOM)
  const rowsHtml = displayUsers
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

  let finalHtml = rowsHtml;

  // បើទិន្នន័យមានច្រើនជាង ៥០ បង្ហាញសារប្រាប់
  if (users.length > MAX_DISPLAY) {
    finalHtml += `<tr><td colspan="5" style="text-align:center; padding: 15px; background: #f8fafc; color: var(--text-muted); font-size: 0.9rem;">
        <i class="fa-solid fa-circle-info"></i> កំពុងបង្ហាញ ${MAX_DISPLAY} នាក់ដំបូង ក្នុងចំណោមសរុប ${users.length} នាក់។ សូមប្រើប្រអប់ Search ដើម្បីស្វែងរកបន្ថែម។
      </td></tr>`;
  }

  tbody.innerHTML = finalHtml;
}

// =======================================================
// ២. មុខងារស្វែងរកឆ្លាតវៃ (រកក្នុង RAM)
// =======================================================
let searchTimeout;

function filterUsers() {
  clearTimeout(searchTimeout);

  searchTimeout = setTimeout(() => {
    const term = document
      .getElementById("searchBox")
      .value.toLowerCase()
      .trim();

    if (!term) {
      renderUsersTable(globalUsersData);
      return;
    }

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
  }, 300);
}

// =======================================================
// ៣. មុខងារបង្រួមរូបភាព (IMAGE COMPRESSION) កុំអោយធ្ងន់ Database
// =======================================================
function compressImageAndPreview(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = function (event) {
      const img = new Image();
      img.src = event.target.result;
      img.onload = function () {
        // កំណត់ទំហំរូបត្រឹម 300x300 pixels (តូច ស្រាល លឿន)
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

        // បំប្លែងទៅជា Base64 ជាមួយនឹងគុណភាព 70%
        const compressedBase64 = canvas.toDataURL("image/jpeg", 0.7);
        resolve(compressedBase64);
      };
    };
  });
}

// មុខងារនេះត្រូវហៅនៅពេល Admin រើសរូបភាពក្នុង Modal (onchange)
async function handleProfileImageUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  Swal.fire({
    title: "កំពុងបង្រួមរូបភាព...",
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading(),
  });

  // ហៅមុខងារ Compress
  const smallBase64 = await compressImageAndPreview(file);

  // បង្ហាញរូបតូចនេះលើអេក្រង់
  document.getElementById("e-preview").src = smallBase64;
  // ញាត់ចូល Input លាក់ទុកដើម្បី Save
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
    document.getElementById("editProfileImg").value = "Base64 Image Data...";
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

  if (imgInputVal !== "Base64 Image Data...") {
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
  const title =
    type === "add" ? "ដាក់ប្រាក់ (Add Money)" : "ដកប្រាក់ (Deduct Money)";
  const confirmBtnColor = type === "add" ? "#10b981" : "#ef4444";
  const icon = type === "add" ? "plus-circle" : "minus-circle";

  Swal.fire({
    title: `<i class="fa-solid fa-${icon}"></i> ${title}`,
    html: `
        <div style="text-align: left; font-family: 'Kantumruy Pro';">
            <p style="margin-bottom: 10px; color: #64748b;">សម្រាប់អតិថិជន៖ <b style="color: #0f172a;">@${username}</b></p>
            <label style="font-size: 0.85rem; font-weight: bold; color: #475569;">ប្រភេទគណនី</label>
            <select id="adjCurrency" class="swal2-input" style="width: 100%; max-width: 100%; box-sizing: border-box; margin: 5px 0 15px;">
                <option value="USD">គណនី USD ($)</option>
                <option value="KHR">គណនី KHR (៛)</option>
            </select>
            <label style="font-size: 0.85rem; font-weight: bold; color: #475569;">ចំនួនទឹកប្រាក់</label>
            <input id="adjAmount" class="swal2-input" type="number" placeholder="ឧ. 50.00 ឬ 40000" style="width: 100%; max-width: 100%; box-sizing: border-box; margin: 5px 0 0;">
        </div>`,
    showCancelButton: true,
    confirmButtonColor: confirmBtnColor,
    cancelButtonColor: "#64748b",
    confirmButtonText: "បញ្ជាក់ (Confirm)",
    preConfirm: () => {
      const currency = document.getElementById("adjCurrency").value;
      const amount = document.getElementById("adjAmount").value;
      if (!amount || amount <= 0)
        Swal.showValidationMessage("សូមបញ្ចូលចំនួនទឹកប្រាក់ឱ្យបានត្រឹមត្រូវ!");
      return { currency, amount };
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
          headers: getAuthHeaders(),
          body: JSON.stringify({
            username,
            amount: result.value.amount,
            currency: result.value.currency,
            type,
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
