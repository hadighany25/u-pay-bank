function renderUsersTable(users) {
  const tbody = document.querySelector("#userTable tbody");
  tbody.innerHTML = "";
  let canEdit =
    adminRole === "super_admin" ||
    (myAdminPermissions && myAdminPermissions.actions?.editUser);
  let canDelete =
    adminRole === "super_admin" ||
    (myAdminPermissions && myAdminPermissions.actions?.deleteUser);
  let canFreeze =
    adminRole === "super_admin" ||
    (myAdminPermissions && myAdminPermissions.actions?.freezeUser);
  let canAdjust =
    adminRole === "super_admin" ||
    (myAdminPermissions && myAdminPermissions.actions?.adjustBal);

  users.forEach((u) => {
    let accountsHtml = `<div class="acc-stack"><div class="acc-badge usd"><span>$</span> ${u.accountNumber}</div>${u.accountNumberKHR ? `<div class="acc-badge khr"><span>៛</span> ${u.accountNumberKHR}</div>` : ""}</div>`;
    let balanceHtml = `<div class="acc-stack"><div style="color: #0369a1; font-weight: bold;">$${u.balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div><div style="color: #047857; font-weight: bold;">${(u.balanceKHR || 0).toLocaleString("en-US")} ៛</div></div>`;
    const isCentralBank = u.accountNumber === "888888888";

    let actionButtonsHtml = "";
    if (isCentralBank) {
      if (canEdit)
        actionButtonsHtml = `<button class="btn-action btn-edit" title="Edit Info" onclick="openEditModal('${u.id}')"><i class="fa-solid fa-pen"></i></button>`;
    } else {
      if (canAdjust)
        actionButtonsHtml += `<button class="btn-action" style="background:#ecfdf5; color:#10b981; border: 1px solid #a7f3d0;" title="Add Money" onclick="openAdjustBalance('${u.username}', 'add')"><i class="fa-solid fa-plus"></i></button><button class="btn-action" style="background:#fef2f2; color:#ef4444; border: 1px solid #fecaca;" title="Deduct Money" onclick="openAdjustBalance('${u.username}', 'deduct')"><i class="fa-solid fa-minus"></i></button>`;
      if (canEdit)
        actionButtonsHtml += `<button class="btn-action btn-edit" title="Edit Info" onclick="openEditModal('${u.id}')"><i class="fa-solid fa-pen"></i></button>`;
      if (canDelete)
        actionButtonsHtml += `<button class="btn-action btn-delete" title="Delete User" onclick="deleteUser('${u.id}')"><i class="fa-solid fa-trash"></i></button>`;
    }

    let freezeHtml = isCentralBank
      ? `<span class="status-badge" style="background:#dbeafe; color:#2563eb;">System Bank</span>`
      : canFreeze
        ? `<label class="switch"><input type="checkbox" ${u.isFrozen ? "checked" : ""} onchange="toggleFreeze('${u.id}', this.checked)"><span class="slider"></span></label>`
        : `<span style="color: ${u.isFrozen ? "#ef4444" : "#10b981"}">${u.isFrozen ? "Frozen" : "Active"}</span>`;

    const tr = document.createElement("tr");
    tr.style.backgroundColor = isCentralBank ? "#fef9c3" : "";
    tr.innerHTML = `<td><div style="display: flex; align-items: center; gap: 10px"><img src="${u.profileImage || (isCentralBank ? "images/logo.png" : "images/default-avatar.png")}" style="width: 35px; height: 35px; border-radius: 50%; object-fit: cover; border: 1px solid #ddd;" /><div><div style="font-weight: bold; color: var(--text-dark)">${u.fullName || u.username} ${isCentralBank ? "🏦" : ""}</div><div style="font-size: 0.8rem; color: var(--text-muted)">@${u.username}</div></div></div></td><td>${accountsHtml}</td><td>${balanceHtml}</td><td>${freezeHtml}</td><td><div style="display: flex; gap: 8px; justify-content: flex-end;">${actionButtonsHtml}</div></td>`;
    tbody.appendChild(tr);
  });
}

function openEditModal(id) {
  const u = globalUsersData.find(
    (user) => user.id === id || user.username === id,
  );
  if (!u) return;
  document.getElementById("editUserId").value = u.id;
  document.getElementById("editUsername").value = u.username;
  document.getElementById("editAccNum").value = u.accountNumber;
  document.getElementById("editAccNumKHR").value = u.accountNumberKHR || "";
  document.getElementById("editPin").value = u.pin || "";
  document.getElementById("editPassword").value = "";
  if (u.profileImage && u.profileImage.startsWith("data:image"))
    document.getElementById("editProfileImg").value = "Base64 Image Data...";
  else document.getElementById("editProfileImg").value = u.profileImage || "";
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
  if (imgInputVal !== "Base64 Image Data...")
    bodyData.profileImage = imgInputVal;
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
      title: "User Updated",
      showConfirmButton: false,
      timer: 1500,
    });
    closeModal("editUserModal");
    loadData();
  } else Swal.fire("បរាជ័យ!", data.message, "error");
}

function openAdjustBalance(username, type) {
  const title =
    type === "add" ? "ដាក់ប្រាក់ (Add Money)" : "ដកប្រាក់ (Deduct Money)";
  const confirmBtnColor = type === "add" ? "#10b981" : "#ef4444";
  const icon = type === "add" ? "plus-circle" : "minus-circle";
  Swal.fire({
    title: `<i class="fa-solid fa-${icon}"></i> ${title}`,
    html: `<div style="text-align: left; font-family: 'Kantumruy Pro';"><p style="margin-bottom: 10px; color: #64748b;">សម្រាប់អតិថិជន៖ <b style="color: #0f172a;">@${username}</b></p><label style="font-size: 0.85rem; font-weight: bold; color: #475569;">ប្រភេទគណនី</label><select id="adjCurrency" class="swal2-input" style="width: 100%; max-width: 100%; box-sizing: border-box; margin: 5px 0 15px;"><option value="USD">គណនី USD ($)</option><option value="KHR">គណនី KHR (៛)</option></select><label style="font-size: 0.85rem; font-weight: bold; color: #475569;">ចំនួនទឹកប្រាក់</label><input id="adjAmount" class="swal2-input" type="number" placeholder="ឧ. 50.00 ឬ 40000" style="width: 100%; max-width: 100%; box-sizing: border-box; margin: 5px 0 0;"></div>`,
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
          Swal.fire("ជោគជ័យ!", data.message, "success");
          loadData();
        } else Swal.fire("បរាជ័យ", data.message, "error");
      } catch (error) {
        Swal.fire("Error", "មានបញ្ហាភ្ជាប់ទៅកាន់ Server", "error");
      }
    }
  });
}

function deleteUser(id) {
  Swal.fire({
    title: "Delete User?",
    text: "This action cannot be undone.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#ef4444",
    confirmButtonText: "Delete",
  }).then(async (result) => {
    if (result.isConfirmed) {
      const res = await fetch("/api/admin/delete-user", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.success) {
        Swal.fire("Deleted!", "", "success");
        loadData();
      }
    }
  });
}

async function toggleFreeze(id, isFrozen) {
  await fetch("/api/admin/toggle-freeze", {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ id, isFrozen }),
  });
}

function filterUsers() {
  const term = document.getElementById("searchBox").value.toLowerCase();
  const rows = document.querySelectorAll("#userTable tbody tr");
  rows.forEach(
    (r) =>
      (r.style.display = r.innerText.toLowerCase().includes(term)
        ? ""
        : "none"),
  );
}
