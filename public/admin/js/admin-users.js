// ========================================================================
// 👥 USER MANAGEMENT LOGIC (OPTIMIZED FOR HIGH PERFORMANCE)
// ========================================================================

// =======================================================
// ១. មុខងារគូរតារាងលឿនផ្លេកបន្ទោរ (Batch Rendering)
// =======================================================
function renderUsersTable(users) {
  const tbody = document.querySelector("#userTable tbody");

  // ១.១ បើគ្មានទិន្នន័យ បង្ហាញសារប្រាប់
  if (!users || users.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="5" style="text-align:center; padding: 40px; color: var(--text-muted);">មិនមានទិន្នន័យទេ</td></tr>';
    return;
  }

  // ១.២ ឆែកសិទ្ធិ (Permissions) ម្តងទុកប្រើសម្រាប់គ្រប់ជួរ (សន្សំកម្លាំងម៉ាស៊ីន)
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

  // ១.៣ បង្កើត HTML ជាដុំធំតែមួយតាមរយៈ .map().join("")
  const rowsHtml = users
    .map((u) => {
      const uid = u._id || u.id; // ការពារ Error ពេល MongoDB ប្រើ _id
      const isCentralBank = u.accountNumber === "888888888";

      // រៀបចំគណនី
      const accountsHtml = `
        <div class="acc-stack">
            <div class="acc-badge usd"><span>$</span> ${u.accountNumber || "N/A"}</div>
            ${u.accountNumberKHR ? `<div class="acc-badge khr"><span>៛</span> ${u.accountNumberKHR}</div>` : ""}
        </div>`;

      // រៀបចំទឹកប្រាក់
      const balanceHtml = `
        <div class="acc-stack">
            <div style="color: #0369a1; font-weight: bold;">$${(u.balance || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
            <div style="color: #047857; font-weight: bold;">${(u.balanceKHR || 0).toLocaleString("en-US")} ៛</div>
        </div>`;

      // រៀបចំប៊ូតុងសកម្មភាព (Actions)
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

      // រៀបចំកុងតាក់ផ្អាកគណនី (Freeze Switch)
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
    .join(""); // ភ្ជាប់ Array ទៅជា String

  // ១.៤ បោះ HTML ចូលអេក្រង់តែម្តង (Batch Update គឺលឿនជាង Append ធម្មតា ១០០ដង)
  tbody.innerHTML = rowsHtml;
}

// =======================================================
// ២. មុខងារស្វែងរកឆ្លាតវៃ (Debounced RAM Filter)
// =======================================================
let searchTimeout;

function filterUsers() {
  clearTimeout(searchTimeout);

  // បច្ចេកទេស Debounce: រង់ចាំ ៣០០មីលីវិនាទី បន្ទាប់ពីវាយអក្សរចប់ ទើបចាប់ផ្តើមស្វែងរក
  searchTimeout = setTimeout(() => {
    const term = document
      .getElementById("searchBox")
      .value.toLowerCase()
      .trim();

    // បើប្រអប់ទទេ បង្ហាញទិន្នន័យដើមចេញមកវិញទាំងអស់
    if (!term) {
      renderUsersTable(globalUsersData);
      return;
    }

    // ស្វែងរកនៅក្នុង RAM (globalUsersData) លឿនជាងស្វែងរកតាម innerText លើអេក្រង់រាប់សិបដង
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

    // បោះទិន្នន័យដែលទើបតែ Filter ឃើញ ទៅអោយតារាងគូរ
    renderUsersTable(filteredData);
  }, 300);
}

// =======================================================
// ៣. មុខងារលម្អិតផ្សេងៗ (កែប្រែ, ផ្អាក, លុប, បញ្ចូលប្រាក់)
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
  document.getElementById("editPassword").value = ""; // Clear password field for security

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
      if (typeof loadData === "function") loadData(); // Reload ទិន្នន័យដើម្បី Update តារាង
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
            username: username,
            amount: result.value.amount,
            currency: result.value.currency,
            type: type,
          }),
        });
        const data = await res.json();

        if (data.success) {
          Swal.fire(
            "ជោគជ័យ!",
            data.message || "ប្រតិបត្តិការជោគជ័យ",
            "success",
          );
          if (typeof loadData === "function") loadData(); // Reload តារាង
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
          if (typeof loadData === "function") loadData(); // Reload តារាង
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
      // បើជោគជ័យ យើង Update ក្នុង RAM ផ្ទាល់តែម្តង ដើម្បីកុំអោយបាច់ហៅ API ទាញទិន្នន័យម្តងទៀត
      const user = globalUsersData.find((u) => (u._id || u.id) === id);
      if (user) user.isFrozen = isFrozen;
    } else {
      Swal.fire("បរាជ័យ", data.message || "មិនអាចប្តូរស្ថានភាពបានទេ", "error");
      if (typeof loadData === "function") loadData(); // Reset តារាងអោយត្រូវដើមវិញបើ Error
    }
  } catch (e) {
    Swal.fire("Error", "បញ្ហាតភ្ជាប់", "error");
    if (typeof loadData === "function") loadData(); // Reset វិញបើ Error
  }
}
