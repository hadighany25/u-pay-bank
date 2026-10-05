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
// 👥 SECTION 2: USER DIRECTORY (បញ្ជីអ្នកប្រើប្រាស់ ការបែងចែកទំព័រ និង Drawer)
// ========================================================================

let currentUsersList = []; // ផ្ទុកទិន្នន័យដែលបាន Filter រួច
let userCurrentPage = 1;
const USERS_PER_PAGE = 7; // បង្ហាញត្រឹម ៧ នាក់

/**
 * 📌 ២.១ មុខងារស្វែងរក និងចម្រាញ់ទិន្នន័យ (Search & Filter Status)
 */
function filterUsers() {
  const term = document.getElementById("searchBox").value;
  const status = document.getElementById("statusFilter")
    ? document.getElementById("statusFilter").value
    : "ALL";

  // ១. រាវរកតាមពាក្យគន្លឹះ
  let filtered = window.standardDataSearch(globalUsersData, term, [
    "username",
    "fullName",
    "phone",
    "email",
    "idNumber",
    "userId",
    "mainAccounts.USD.accountNumber",
    "mainAccounts.KHR.accountNumber",
  ]);

  // ២. ចម្រាញ់តាមស្ថានភាព (Status)
  if (status !== "ALL") {
    filtered = filtered.filter((u) => {
      if (status === "FROZEN") return u.isFrozen === true;
      if (status === "ACTIVE") return u.isFrozen === false;
      if (status === "PENDING_KYC") return u.kycStatus === "pending";
      // 🟢 បន្ថែមលក្ខខណ្ឌសម្រាប់អ្នកមិនទាន់ KYC ឬទិន្នន័យទទេ
      if (status === "UNVERIFIED_KYC")
        return u.kycStatus === "unverified" || !u.kycStatus;
      return true;
    });
  }

  currentUsersList = filtered;
  userCurrentPage = 1;
  renderUsersTable();
}

/**
 * 📌 ២.២ មុខងារគូរកាតអ្នកប្រើប្រាស់ (មាន Pagination)
 */
function renderUsersTable() {
  const listContainer = document.getElementById("userDirectoryList");
  if (!listContainer) return;

  // ករណីគ្មានទិន្នន័យ
  if (!currentUsersList || currentUsersList.length === 0) {
    listContainer.innerHTML = `
      <div style="text-align:center; padding: 50px 20px; color: var(--text-muted);">
        <i class="fa-solid fa-users-slash" style="font-size: 3.5rem; margin-bottom: 15px; opacity: 0.3;"></i>
        <h3 style="margin:0; font-family: 'Kantumruy Pro';">មិនមានទិន្នន័យអតិថិជនទេ</h3>
      </div>`;
    updateUserPaginationUI(0);
    return;
  }

  const totalPages = Math.ceil(currentUsersList.length / USERS_PER_PAGE);
  if (userCurrentPage > totalPages) userCurrentPage = totalPages;
  if (userCurrentPage < 1) userCurrentPage = 1;

  // កាត់យកតែ ៥ នាក់ តាមទំព័រ
  const startIndex = (userCurrentPage - 1) * USERS_PER_PAGE;
  const endIndex = startIndex + USERS_PER_PAGE;
  const usersToShow = currentUsersList.slice(startIndex, endIndex);

  const cardsHtml = usersToShow
    .map((u) => {
      const imgSrc = u.profileImage || "../images/default-avatar.png";
      const name = u.fullName || u.username;
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
  updateUserPaginationUI(totalPages);
}

/**
 * 📌 ២.៣ គ្រប់គ្រងប៊ូតុង Pagination
 */
function changeUserPage(step) {
  userCurrentPage += step;
  renderUsersTable();
}

function updateUserPaginationUI(totalPages) {
  const btnPrev = document.getElementById("btnPrevUserPage");
  const btnNext = document.getElementById("btnNextUserPage");
  const pageInfo = document.getElementById("userPageInfo");

  if (totalPages === 0) {
    pageInfo.innerText = `ទំព័រទី 1 / 0`;
    btnPrev.disabled = true;
    btnNext.disabled = true;
    return;
  }

  pageInfo.innerText = `ទំព័រទី ${userCurrentPage} / ${totalPages}`;
  btnPrev.disabled = userCurrentPage === 1;
  btnNext.disabled = userCurrentPage >= totalPages;
}

/**
 * 📌 ២.១ មុខងារស្វែងរក និងចម្រាញ់ទិន្នន័យ (Search & Filter Status)
 */
function filterUsers() {
  const term = document.getElementById("searchBox").value;
  const status = document.getElementById("statusFilter")
    ? document.getElementById("statusFilter").value
    : "ALL";

  // ១. រាវរកតាមពាក្យគន្លឹះ
  let filtered = window.standardDataSearch(globalUsersData, term, [
    "username",
    "fullName",
    "phone",
    "email",
    "idNumber",
    "userId",
    "mainAccounts.USD.accountNumber",
    "mainAccounts.KHR.accountNumber",
  ]);

  // ២. ចម្រាញ់តាមស្ថានភាព (Status)
  if (status !== "ALL") {
    filtered = filtered.filter((u) => {
      if (status === "FROZEN") return u.isFrozen === true;
      if (status === "ACTIVE") return u.isFrozen === false;
      if (status === "PENDING_KYC") return u.kycStatus === "pending";
      return true;
    });
  }

  currentUsersList = filtered;
  userCurrentPage = 1;
  renderUsersTable();
}

/**
 * 📌 ២.៥ មុខងារចម្លងអត្ថបទ (Click-to-Copy)
 */
window.copyToClipboard = function (text, label) {
  if (!text || text === "N/A" || text === "...") return;
  navigator.clipboard.writeText(text).then(() => {
    Swal.fire({
      toast: true,
      position: "top-end",
      icon: "success",
      title: `បានចម្លង ${label} ចូល Clipboard!`,
      showConfirmButton: false,
      timer: 1500,
      customClass: { popup: "premium-swal" },
    });
  });
};

/**
 * 📌 ២.៣ មុខងារបើក Drawer និងភ្ជាប់មុខងារ Click-to-Copy
 */
window.openUserDrawer = function (username, cardElement) {
  const user = globalUsersData.find((u) => u.username === username);
  if (!user) return;

  document.getElementById("drawerName").innerText =
    user.fullName || user.username;

  // 🟢 បន្ថែមមុខងារ Copy ឱ្យ ID និង Username
  const displayId = user.userId || "N/A";
  document.getElementById("drawerUsername").innerHTML =
    `<span style="color: var(--text-muted); font-size: 0.95rem;">ID : <span onclick="copyToClipboard('${displayId}', 'ID')" style="cursor:pointer; text-decoration:underline;" title="ចុចដើម្បីចម្លង">${displayId}</span></span> 
     <span style="color: #cbd5e1; margin: 0 10px;">|</span> 
     <span onclick="copyToClipboard('${user.username}', 'Username')" style="cursor:pointer; text-decoration:underline; color: var(--accent);" title="ចុចដើម្បីចម្លង">@${user.username}</span>`;

  document.getElementById("drawerAvatar").src =
    user.profileImage || "../images/default-avatar.png";

  // 🟢 មុខងារជំនួយសម្រាប់ភ្ជាប់ Click-to-copy ទៅអក្សរធម្មតា
  const setCopyable = (elementId, value, label) => {
    const el = document.getElementById(elementId);
    el.innerText = value || "N/A";
    if (value && value !== "N/A") {
      el.style.cursor = "pointer";
      el.title = "ចុចដើម្បីចម្លង";
      el.style.textDecoration = "underline";
      el.style.textDecorationStyle = "dashed";
      el.onclick = () => copyToClipboard(value, label);
    } else {
      el.style.cursor = "default";
      el.title = "";
      el.style.textDecoration = "none";
      el.onclick = null;
    }
  };

  setCopyable(
    "drawerUsdAcc",
    user.mainAccounts?.USD?.accountNumber,
    "លេខគណនី USD",
  );
  setCopyable(
    "drawerKhrAcc",
    user.mainAccounts?.KHR?.accountNumber,
    "លេខគណនី KHR",
  );
  setCopyable("drawerPhone", user.phone, "លេខទូរស័ព្ទ");
  setCopyable("drawerEmail", user.email, "អ៊ីមែល");

  // 🟢 គូរ Sub-Accounts និងបន្ថែមមុខងារ Copy
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
          <span onclick="copyToClipboard('${sub.accountNumber}', 'លេខគណនីរង')" style="font-family: 'Inter', monospace; font-weight: bold; color: var(--text-main); cursor: pointer; text-decoration: underline; text-decoration-style: dashed;" title="ចុចដើម្បីចម្លង">${sub.accountNumber}</span>
        </div>
      `;
    });
    subHtml += `</div>`;
    subAccContainer.innerHTML = subHtml;
  } else {
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

  document.getElementById("userDetailDrawer").classList.add("open");

  document
    .querySelectorAll(".modern-user-card")
    .forEach((c) => c.classList.remove("selected"));
  if (cardElement) cardElement.classList.add("selected");
};

// ========================================================================
// 🧑‍💻 SECTION 3: INLINE CREATE FORM (ទម្រង់បង្កើតគណនីថ្មី & OCR)
// ========================================================================

let isCreateFormOpen = false;

window.toggleUserCreateForm = function () {
  const form = document.getElementById("inlineCreateUserForm");
  const btn = document.getElementById("btnToggleCreateForm");
  const searchBox = document.querySelector(".user-list-header .search-box");

  if (!isCreateFormOpen) {
    // បើក Form
    isCreateFormOpen = true;
    form.style.display = "flex";
    searchBox.style.visibility = "hidden";
    btn.innerHTML = `<i class="fa-solid fa-arrow-left"></i> លាក់ទម្រង់បង្កើតគណនី`;
    btn.style.background = "var(--bg-body)";
    btn.style.color = "var(--text-main)";
    btn.style.border = "1px solid var(--border)";
    closeUserDrawer();
  } else {
    // បិទ Form (ត្រូវសួរបញ្ជាក់មុនបិទ)
    confirmCloseCreateForm();
  }
};

/**
 * 📌 ៣.១ សួរបញ្ជាក់មុនបិទ និងសម្អាត Form
 */
window.confirmCloseCreateForm = function () {
  const fName = document.getElementById("newFullName").value.trim();
  const uName = document.getElementById("newUsername").value.trim();
  const idImg = document.getElementById("hiddenIdUrl").value;

  if (fName || uName || idImg) {
    Swal.fire({
      title: "បោះបង់ការបង្កើតគណនី?",
      text: "ទិន្នន័យដែលអ្នកកំពុងបំពេញ នឹងត្រូវលុបចោលទាំងស្រុង។",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#64748b",
      confirmButtonText: "បាទ/ចាស បោះបង់",
      customClass: { popup: "premium-swal" },
    }).then((result) => {
      if (result.isConfirmed) {
        clearAdminCreateForm();
        forceCloseFormUI();
      }
    });
  } else {
    forceCloseFormUI();
  }
};

function forceCloseFormUI() {
  isCreateFormOpen = false;
  document.getElementById("inlineCreateUserForm").style.display = "none";
  document.querySelector(".user-list-header .search-box").style.visibility =
    "visible";
  const btn = document.getElementById("btnToggleCreateForm");
  btn.innerHTML = `<i class="fa-solid fa-user-plus"></i> បង្កើតគណនីថ្មី`;
  btn.style.background = "var(--secondary)";
  btn.style.color = "white";
  btn.style.border = "none";
}

function clearAdminCreateForm() {
  document
    .querySelectorAll(".inline-create-form input:not([type='hidden'])")
    .forEach((el) => (el.value = ""));
  document.getElementById("newGender").value = "";

  // លាក់ប្រអប់ស្ទួនលេខ និងលុបរូប
  document.getElementById("adminDuplicateReasonBox").style.display = "none";
  document.getElementById("adminDuplicateReason").value = "";
  document.getElementById("newUsernameFeedback").innerHTML = "";

  document.getElementById("adminIdPreview").style.display = "none";
  document.getElementById("adminSelfiePreview").style.display = "none";
  document.getElementById("hiddenIdUrl").value = "";
  document.getElementById("hiddenSelfieUrl").value = "";

  // Set default លេខសម្ងាត់ និង PIN មក 1234 វិញ
  document.getElementById("newPassword").value = "1234";
  document.getElementById("newPin").value = "1234";
}

/**
 * 📌 ៣.២ ឆែក Username និង លេខ ID (Real-time)
 */
window.adminCheckUsername = async function () {
  const val = document.getElementById("newUsername").value.trim();
  const feedback = document.getElementById("newUsernameFeedback");
  if (val.length < 3) return;
  try {
    const res = await fetch("/api/check-username", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ username: val }),
    });
    const data = await res.json();
    if (data.available) {
      feedback.innerHTML =
        '<span style="color:#10b981;"><i class="fa-solid fa-circle-check"></i> ឈ្មោះនេះអាចប្រើប្រាស់បាន</span>';
    } else {
      feedback.innerHTML =
        '<span style="color:#ef4444;"><i class="fa-solid fa-circle-xmark"></i> ឈ្មោះនេះមានគេប្រើរួចហើយ!</span>';
    }
  } catch (e) {
    console.log(e);
  }
};

window.adminCheckIdNumber = async function () {
  const val = document.getElementById("newIdNumber").value.trim();
  if (!val) return;
  try {
    const res = await fetch("/api/check-id-number", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ idNumber: val }),
    });
    const data = await res.json();
    if (data.exists) {
      document.getElementById("adminDuplicateReasonBox").style.display =
        "block";
    } else {
      document.getElementById("adminDuplicateReasonBox").style.display = "none";
      document.getElementById("adminDuplicateReason").value = "";
    }
  } catch (e) {
    console.log(e);
  }
};

/**
 * 📌 ៣.៣ ការ Upload Selfie ធម្មតា
 */
window.handleAdminFormUpload = async function (
  event,
  previewId,
  hiddenInputId,
) {
  const file = event.target.files[0];
  if (!file) return;

  Swal.fire({
    title: "កំពុងបញ្ជូនរូបភាព...",
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading(),
    customClass: { popup: "premium-swal" },
  });

  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById(previewId).src = e.target.result;
    document.getElementById(previewId).style.display = "block";
  };
  reader.readAsDataURL(file);

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", "iaxuqmpb"); // CLOUD_PRESET

  try {
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/jp9yg3dj/image/upload`,
      { method: "POST", body: formData },
    );
    const data = await res.json();
    if (data.secure_url) {
      document.getElementById(hiddenInputId).value = data.secure_url;
      Swal.close();
    } else {
      Swal.fire("បរាជ័យ", "មិនអាច Upload រូបភាពបានទេ", "error");
    }
  } catch (e) {
    Swal.fire("Error", "បញ្ហាភ្ជាប់ទៅកាន់ Cloudinary", "error");
  }
};

/**
 * 📌 ៣.៤ មុខងារ Upload អត្តសញ្ញាណប័ណ្ណ និងបាញ់ AI (OCR)
 */
window.handleAdminIdOcrUpload = async function (event) {
  const file = event.target.files[0];
  if (!file) return;

  // លុបទិន្នន័យចាស់ចេញសិន
  document.getElementById("newFullName").value = "";
  document.getElementById("newDob").value = "";
  document.getElementById("newIdNumber").value = "";
  document.getElementById("adminDuplicateReasonBox").style.display = "none";

  Swal.fire({
    title: "កំពុងស្កេនដោយ AI...",
    html: "ប្រព័ន្ធកំពុងអានទិន្នន័យពីអត្តសញ្ញាណប័ណ្ណ",
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading(),
    customClass: { popup: "premium-swal" },
  });

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", "iaxuqmpb");

  try {
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/jp9yg3dj/image/upload`,
      { method: "POST", body: formData },
    );
    const data = await res.json();
    if (data.secure_url) {
      const tempUrl = data.secure_url;

      // បាញ់ទៅ API OCR របស់ Backend
      const ocrRes = await fetch("/api/scan-id-card", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ imageUrl: tempUrl }),
      });
      const ocrData = await ocrRes.json();
      Swal.close();

      if (!ocrData.success) {
        event.target.value = "";
        return Swal.fire({
          icon: "error",
          title: "ឯកសារបដិសេធ ❌",
          text: ocrData.message,
          customClass: { popup: "premium-swal" },
        });
      }

      // បង្ហាញរូប និង បំពេញទិន្នន័យអូតូ
      document.getElementById("hiddenIdUrl").value = tempUrl;
      document.getElementById("adminIdPreview").src = tempUrl;
      document.getElementById("adminIdPreview").style.display = "block";

      document.getElementById("newFullName").value =
        ocrData.data.fullName || "";
      document.getElementById("newDob").value = ocrData.data.dob || "";
      document.getElementById("newGender").value = ocrData.data.gender || "";
      document.getElementById("newIdNumber").value =
        ocrData.data.idNumber || "";

      // ឆែកលេខ ID ស្ទួនអូតូ បន្ទាប់ពី AI អានរួច
      if (ocrData.data.idNumber) adminCheckIdNumber();

      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "ស្កេន AI ជោគជ័យ!",
        showConfirmButton: false,
        timer: 2000,
        customClass: { popup: "premium-swal" },
      });
    } else throw new Error("Cloudinary Error");
  } catch (err) {
    Swal.close();
    Swal.fire({
      icon: "error",
      title: "បរាជ័យ",
      text: "មិនអាចស្កេនឯកសារបានទេ",
      customClass: { popup: "premium-swal" },
    });
  }
};

/**
 * 📌 ៣.៥ បញ្ជូនទិន្នន័យទៅ Backend (API បង្កើតគណនី)
 */
window.submitNewUserByAdmin = async function () {
  const payload = {
    fullName: document.getElementById("newFullName").value.trim(),
    username: document.getElementById("newUsername").value.trim(),
    phone: document.getElementById("newPhone").value.trim(),
    email: document.getElementById("newEmail").value.trim(),
    dob: document.getElementById("newDob").value,
    gender: document.getElementById("newGender").value,
    idNumber: document.getElementById("newIdNumber").value.trim(),
    password: document.getElementById("newPassword").value.trim(),
    pin: document.getElementById("newPin").value.trim(),
    idCardUrl: document.getElementById("hiddenIdUrl").value,
    selfieUrl: document.getElementById("hiddenSelfieUrl").value,
    duplicateReason: document
      .getElementById("adminDuplicateReason")
      .value.trim(),
  };

  // ឆែក Required ទាំងអស់
  if (
    !payload.fullName ||
    !payload.username ||
    !payload.phone ||
    !payload.email ||
    !payload.dob ||
    !payload.gender ||
    !payload.idNumber ||
    !payload.password ||
    !payload.pin ||
    !payload.idCardUrl ||
    !payload.selfieUrl
  ) {
    return Swal.fire({
      icon: "warning",
      title: "សូមបំពេញចន្លោះប្រហោង",
      text: "រាល់ព័ត៌មានដែលមានសញ្ញាផ្កាយ (*) និងរូបភាពទាំង២ ត្រូវតែបំពេញ!",
      customClass: { popup: "premium-swal" },
    });
  }

  // ឆែកលេខ PIN
  if (payload.pin.length !== 4)
    return Swal.fire({
      icon: "warning",
      title: "កំហុស",
      text: "លេខកូដ PIN ត្រូវមាន ៤ ខ្ទង់!",
      customClass: { popup: "premium-swal" },
    });

  // ឆែកប្រអប់ Reason បើវាលោតចេញមក តែអត់បំពេញ
  if (
    document.getElementById("adminDuplicateReasonBox").style.display ===
      "block" &&
    !payload.duplicateReason
  ) {
    return Swal.fire({
      icon: "warning",
      title: "ទាមទារមូលហេតុ",
      text: "សូមបញ្ជាក់មូលហេតុក្នុងការបង្កើតគណនីថ្មី (លេខ ID ស្ទួន)!",
      customClass: { popup: "premium-swal" },
    });
  }

  Swal.fire({
    title: "កំពុងបង្កើតគណនី...",
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading(),
    customClass: { popup: "premium-swal" },
  });

  try {
    const res = await fetch("/api/admin/create-user", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (data.success) {
      Swal.fire({
        icon: "success",
        title: "ជោគជ័យ!",
        html: `គណនី <b>@${payload.username}</b> ត្រូវបានបង្កើតរួចរាល់។<br>ស្ថានភាព KYC: <b>Pending (រង់ចាំអនុម័ត)</b>`,
        customClass: { popup: "premium-swal" },
      });

      clearAdminCreateForm();
      forceCloseFormUI();
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
      text: "មានបញ្ហាតភ្ជាប់ទៅកាន់ Server",
      customClass: { popup: "premium-swal" },
    });
  }
};

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

  if (text && text.trim() !== "") {
    try {
      // បង្ហាញ Loading មុនពេលផ្ញើ
      Swal.fire({
        title: "កំពុងបញ្ជូនសារ...",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
        customClass: { popup: "premium-swal" },
      });

      // ហៅទៅកាន់ API ថ្មីដែលបានបង្កើត
      const res = await fetch("/api/admin/send-message", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          username: username,
          message: text.trim(),
        }),
      });

      const data = await res.json();

      if (data.success) {
        Swal.fire({
          toast: true,
          position: "top-end",
          icon: "success",
          title: data.message || "សារត្រូវបានបញ្ជូន!",
          showConfirmButton: false,
          timer: 1500,
          customClass: { popup: "premium-swal" },
        });
      } else {
        Swal.fire({
          icon: "error",
          title: "បរាជ័យ",
          text: data.message || "មិនអាចបញ្ជូនសារបានទេ!",
          customClass: { popup: "premium-swal" },
        });
      }
    } catch (e) {
      console.error("Send Message Error:", e);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "មានបញ្ហាភ្ជាប់ទៅកាន់ Server",
        customClass: { popup: "premium-swal" },
      });
    }
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
