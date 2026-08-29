// js/admin-management.js

// ========================================================================
// 🧑‍💼 SECTION: ADMIN ACCOUNTS WIZARD & MANAGEMENT
// ========================================================================
let globalAdminsData = [];
let currentAdminStep = 1;
const TOTAL_STEPS = 4;

async function loadAdminList() {
  if (typeof adminRole === "undefined" || adminRole !== "super_admin") return;

  try {
    const res = await fetch("/api/admin/list-admins", {
      headers: getAuthHeaders(),
    });
    const data = await res.json();

    if (data.success) {
      globalAdminsData = data.admins || [];
      const tbody = document.getElementById("adminTableBody");
      if (!tbody) return;

      if (globalAdminsData.length === 0) {
        tbody.innerHTML =
          '<tr><td colspan="5" style="text-align: center; padding: 20px;">គ្មានទិន្នន័យបុគ្គលិក</td></tr>';
        return;
      }

      // 🔄 កែសម្រួលក្បាលតារាង HTML
      tbody.innerHTML = globalAdminsData
        .map((a) => {
          let displayRole =
            a.role === "custom" && a.permissions?.customRoleName
              ? a.permissions.customRoleName
              : a.role || "support_agent";

          const isActive = a.isActive !== false;

          return `
            <tr>
              <!-- 1. NAME & STAFF ID -->
              <td>
                <div style="font-weight: 700; color: var(--text-main); text-transform: uppercase;">
                  ${a.fullName || a.username}
                </div>
                <div style="font-size: 0.8rem; color: var(--text-muted); font-family: monospace;">
                  ${a.staffId || "N/A"}
                </div>
              </td>

              <!-- 2. ROLE -->
              <td>
                <span style="background: #e0f2fe; color: #0284c7; padding: 4px 10px; border-radius: 8px; font-weight: bold; font-size: 0.8rem;">
                  ${displayRole.toUpperCase()}
                </span>
              </td>

              <!-- 3. ម៉ោងធ្វើការ -->
              <td>${a.permissions?.workStart || "00:00"} - ${a.permissions?.workEnd || "23:59"}</td>

              <!-- 4. STATUS & TOGGLE SWITCH -->
              <td>
                <label style="position: relative; display: inline-block; width: 46px; height: 24px; cursor: pointer;">
                  <input type="checkbox" ${isActive ? "checked" : ""} 
                    onchange="toggleAdminStatusAccount('${a._id}')" 
                    style="opacity: 0; width: 0; height: 0;">
                  <span style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: ${isActive ? "#10b981" : "#cbd5e1"}; transition: .3s; border-radius: 24px;"></span>
                  <span style="position: absolute; content: ''; height: 18px; width: 18px; left: ${isActive ? "24px" : "3px"}; bottom: 3px; background-color: white; transition: .3s; border-radius: 50%;"></span>
                </label>
                <div style="font-size: 0.75rem; margin-top: 2px; font-weight: 600; color: ${isActive ? "#10b981" : "#ef4444"};">
                  ${isActive ? "ACTIVE" : "INACTIVE"}
                </div>
              </td>

              <!-- 5. ACTION -->
              <td style="text-align: right; white-space: nowrap;">
                <!-- 📡 ប៊ូតុង NFC Wi-Fi -->
                ${
                  a.nfcUid
                    ? `<button class="btn-action" style="background: #3b82f6;" onclick="showNfcUid('${a.nfcUid}')" title="មើលលេខកាត NFC">
                       <i class="fa-solid fa-wifi"></i>
                     </button>`
                    : ""
                }

                <!-- 🔑 ប៊ូតុង Reset Password -->
                <button class="btn-action" style="background: #f59e0b;" onclick="promptResetAdminPassword('${a._id}', '${a.username}')" title="Reset Password">
                  <i class="fa-solid fa-key"></i>
                </button>

                <!-- ✏️ ប៊ូតុង Edit -->
                <button class="btn-action btn-edit" onclick="openAdminModal('${a._id}')" title="កែប្រែ">
                  <i class="fa-solid fa-pen"></i>
                </button>

                <!-- 🗑️ ប៊ូតុង Delete -->
                ${
                  a.username !== "admin"
                    ? `<button class="btn-action btn-delete" onclick="deleteAdminAcc('${a._id}')" title="លុប">
                       <i class="fa-solid fa-trash"></i>
                     </button>`
                    : ""
                }
              </td>
            </tr>
          `;
        })
        .join("");
    }
  } catch (e) {
    console.error("Error loading admins:", e);
  }
}
setTimeout(loadAdminList, 1000);

function toggleCustomPermissions(role) {
  const customBox = document.getElementById("customPermissionBox");
  const customInput = document.getElementById("customRoleInputGroup");
  if (role === "custom") {
    if (customBox) customBox.style.display = "block";
    if (customInput) customInput.style.display = "block";
  } else {
    if (customBox) customBox.style.display = "none";
    if (customInput) customInput.style.display = "none";
  }
}

// 🟢 មុខងារបង្ហាញ Wizard តាមទំព័រ
function showAdminStep(step) {
  document
    .querySelectorAll(".wizard-content")
    .forEach((el) => el.classList.remove("active"));
  document.querySelectorAll(".wizard-step-indicator").forEach((el) => {
    el.classList.remove("active");
    if (parseInt(el.id.split("-")[2]) < step) el.classList.add("completed");
    else el.classList.remove("completed");
  });

  document.getElementById(`wizard-step-${step}`).classList.add("active");
  document.getElementById(`ind-step-${step}`).classList.add("active");

  document.getElementById("btnWizBack").style.display =
    step === 1 ? "none" : "block";
  document.getElementById("btnWizCancel").style.display =
    step === 1 ? "block" : "none";

  if (step === TOTAL_STEPS) {
    document.getElementById("btnWizNext").style.display = "none";
    document.getElementById("btnWizSave").style.display = "flex";
    generateWizardSummary();
  } else {
    document.getElementById("btnWizNext").style.display = "block";
    document.getElementById("btnWizNext").innerHTML =
      step === 3
        ? 'រំលង / បន្ទាប់ <i class="fa-solid fa-arrow-right"></i>'
        : 'បន្ទាប់ <i class="fa-solid fa-arrow-right"></i>';
    document.getElementById("btnWizSave").style.display = "none";
  }
}

function changeAdminStep(dir) {
  if (dir === 1 && currentAdminStep === 1) {
    const usr = document.getElementById("manageAdminUser").value.trim();
    const fn = document.getElementById("adminFullName").value.trim();
    if (!usr || !fn) {
      return Swal.fire({
        toast: true,
        position: "top-end",
        icon: "warning",
        title: "សូមបំពេញ Username និង Full Name!",
        showConfirmButton: false,
        timer: 2000,
      });
    }
  }

  currentAdminStep += dir;
  if (currentAdminStep < 1) currentAdminStep = 1;
  if (currentAdminStep > TOTAL_STEPS) currentAdminStep = TOTAL_STEPS;
  showAdminStep(currentAdminStep);
}

// 🟢 បង្កើត ID អូតូ UPAY-តួអក្សរ៦ខ្ទង់
function generateAutoStaffId() {
  return "UPAY-" + Math.floor(100000 + Math.random() * 900000);
}

// 🟢 ហៅមុខងារនេះពេលចុចប៊ូតុង "បន្ថែមបុគ្គលិកថ្មី" ឬ "កែប្រែ"
function openAdminModal(id = "") {
  currentAdminStep = 1;
  document.getElementById("manageAdminId").value = id;
  document.getElementById("manageAdminPass").value = "";

  if (id) {
    const admin = globalAdminsData.find((a) => a._id === id);
    if (admin) {
      document.getElementById("staffId").value = admin.staffId || "N/A";
      document.getElementById("manageAdminUser").value = admin.username;
      document.getElementById("adminFullName").value = admin.fullName || "";
      document.getElementById("adminNickname").value = admin.nickname || "";
      document.getElementById("adminPhone").value = admin.phone || "";
      document.getElementById("adminEmail").value = admin.email || "";
      document.getElementById("adminDept").value =
        admin.department || "Customer Support (CS)";
      document.getElementById("adminRemarks").value = admin.remarks || "";
      document.getElementById("manageAdminRole").value = admin.role;
      document.getElementById("customRoleName").value =
        admin.permissions?.customRoleName || "";
      document.getElementById("permWorkStart").value =
        admin.permissions?.workStart || "08:00";
      document.getElementById("permWorkEnd").value =
        admin.permissions?.workEnd || "17:00";

      renderNfcUiBox(admin.nfcUid || "");

      const m = admin.permissions?.menus || {};
      document.getElementById("p_users").checked = m.users ?? true;
      document.getElementById("p_merchant").checked = m.merchant ?? false;
      document.getElementById("p_cashier").checked = m.cashier ?? false;
      document.getElementById("p_checktrx").checked = m.checktrx ?? true;
      document.getElementById("p_fx").checked = m.fx ?? false;
      document.getElementById("p_cards").checked = m.cards ?? false;
      document.getElementById("p_promos").checked = m.promos ?? false;
      document.getElementById("p_broadcast").checked = m.broadcast ?? false;
      document.getElementById("p_kyc").checked = m.kyc ?? true;
      document.getElementById("p_tickets").checked = m.tickets ?? true;
      document.getElementById("p_chat").checked = m.chat ?? true;
      document.getElementById("p_logs").checked = m.logs ?? false;

      const act = admin.permissions?.actions || {};
      document.getElementById("p_edit_user").checked = act.editUser ?? false;
      document.getElementById("p_delete_user").checked =
        act.deleteUser ?? false;
      document.getElementById("p_freeze_user").checked =
        act.freezeUser ?? false;
      document.getElementById("p_adjust_bal").checked = act.adjustBal ?? false;
      document.getElementById("p_refund").checked = act.refund ?? false;

      toggleCustomPermissions(admin.role);
    }
    document.getElementById("adminModalTitle").innerText = "កែប្រែគណនីបុគ្គលិក";
  } else {
    document.getElementById("staffId").value = generateAutoStaffId();
    document.getElementById("manageAdminUser").value = "";
    document.getElementById("adminFullName").value = "";
    document.getElementById("adminNickname").value = "";
    document.getElementById("adminPhone").value = "";
    document.getElementById("adminEmail").value = "";
    document.getElementById("adminDept").value = "Customer Support (CS)";
    document.getElementById("adminRemarks").value = "";
    document.getElementById("manageAdminRole").value = "support_agent";
    document.getElementById("customRoleName").value = "";
    document.getElementById("permWorkStart").value = "08:00";
    document.getElementById("permWorkEnd").value = "17:00";

    renderNfcUiBox("");

    document.getElementById("p_users").checked = true;
    document.getElementById("p_merchant").checked = false;
    document.getElementById("p_cashier").checked = false;
    document.getElementById("p_checktrx").checked = true;
    document.getElementById("p_fx").checked = false;
    document.getElementById("p_cards").checked = false;
    document.getElementById("p_promos").checked = false;
    document.getElementById("p_broadcast").checked = false;
    document.getElementById("p_kyc").checked = true;
    document.getElementById("p_tickets").checked = true;
    document.getElementById("p_chat").checked = true;
    document.getElementById("p_logs").checked = false;

    document.getElementById("p_edit_user").checked = false;
    document.getElementById("p_delete_user").checked = false;
    document.getElementById("p_freeze_user").checked = false;
    document.getElementById("p_adjust_bal").checked = false;
    document.getElementById("p_refund").checked = false;

    toggleCustomPermissions("support_agent");
    document.getElementById("adminModalTitle").innerText = "បន្ថែមបុគ្គលិកថ្មី";
  }

  showAdminStep(1);
  document
    .getElementById("adminAccModal")
    .style.setProperty("display", "flex", "important");
}

// 🟢 មុខងារ Summary នៅផ្ទាំងទី៤
function generateWizardSummary() {
  document.getElementById("sum-id").innerText =
    document.getElementById("staffId").value;
  document.getElementById("sum-name").innerText = document
    .getElementById("adminFullName")
    .value.toUpperCase();
  document.getElementById("sum-user").innerText =
    "@" + document.getElementById("manageAdminUser").value;
  document.getElementById("sum-dept").innerText =
    document.getElementById("adminDept").value;

  let role = document.getElementById("manageAdminRole").value;
  let customName = document.getElementById("customRoleName").value;
  document.getElementById("sum-role").innerText =
    role === "custom" && customName
      ? customName.toUpperCase()
      : role.replace("_", " ").toUpperCase();

  let nfc = document.getElementById("adminNfcUid").value;
  document.getElementById("sum-nfc").innerHTML = nfc
    ? `<span style="color:#10b981;">🟢 Linked (${nfc})</span>`
    : `<span style="color:#ef4444;">🔴 Not Linked</span>`;
}

// 🟢 មុខងារចុច Enter លោតអូតូ
document.addEventListener("keydown", function (e) {
  if (e.key === "Enter") {
    const modal = document.getElementById("adminAccModal");
    if (window.getComputedStyle(modal).display !== "none") {
      const activeStep = document.querySelector(".wizard-content.active");
      if (!activeStep) return;

      const inputs = Array.from(
        activeStep.querySelectorAll(".wizard-input:not([readonly])"),
      );
      const currentIndex = inputs.indexOf(document.activeElement);

      if (currentIndex > -1) {
        e.preventDefault();
        if (currentIndex < inputs.length - 1) {
          inputs[currentIndex + 1].focus();
        } else {
          if (currentAdminStep < TOTAL_STEPS)
            document.getElementById("btnWizNext").click();
          else document.getElementById("btnWizSave").click();
        }
      }
    }
  }
});

// => 🔴 PASTE កូដ normalizeUID នៅត្រង់នេះ 🔴 <=
function normalizeUID(uid) {
  if (!uid) return "";
  uid = String(uid).trim().toUpperCase();
  if (/^\d{10}$/.test(uid)) {
    let hex = parseInt(uid, 10).toString(16).toUpperCase();
    hex = hex.padStart(8, "0");
    let byte1 = hex.substring(6, 8);
    let byte2 = hex.substring(4, 6);
    let byte3 = hex.substring(2, 4);
    let byte4 = hex.substring(0, 2);
    return byte1 + byte2 + byte3 + byte4;
  }
  return uid;
}

// ========================================================================
// 📡 NFC SCANNING & MANAGEMENT
// ========================================================================

// 🟢 មុខងារសម្រាប់ Update ផ្ទាំង UI ប៊ូតុង NFC
function renderNfcUiBox(uid) {
  const box = document.getElementById("nfcStatusBox");
  const btnContainer = document.getElementById("nfcActionBtnContainer");
  const adminNfcInput = document.getElementById("adminNfcUid");

  if (uid && uid.trim() !== "") {
    adminNfcInput.value = uid;

    box.style.border = "1px solid rgba(16, 185, 129, 0.4)";
    box.style.background = "rgba(16, 185, 129, 0.05)";
    box.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; gap: 12px; font-family: 'Kantumruy Pro', sans-serif;">
        <i class="fa-solid fa-circle-check" style="color: #10b981; font-size: 1.4rem;"></i>
        <span style="color: #10b981; font-weight: 600; font-size: 1.05rem;">ភ្ជាប់កាតជោគជ័យ៖</span>
        <span style="background: rgba(16, 185, 129, 0.15); color: #10b981; padding: 4px 12px; border-radius: 8px; font-family: 'JetBrains Mono', monospace; font-weight: 700; font-size: 1.1rem; letter-spacing: 1.5px; border: 1px solid rgba(16, 185, 129, 0.3);">
          ${uid}
        </span>
      </div>
    `;

    if (btnContainer) {
      btnContainer.innerHTML = `
        <button class="btn-primary" onclick="removeAdminNfc()" style="background: #ef4444; width: 100%; justify-content: center; padding: 14px; border-radius: 12px; font-family: 'Kantumruy Pro', sans-serif; font-size: 1.05rem; font-weight: 600; letter-spacing: 0.5px; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.2); transition: all 0.3s ease;">
          <i class="fa-solid fa-link-slash"></i> ផ្តាច់កាត NFC នេះចេញ
        </button>
      `;
    }
  } else {
    adminNfcInput.value = "";

    box.style.border = "1px dashed var(--border)";
    box.style.background = "transparent";
    box.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; gap: 10px; font-family: 'Kantumruy Pro', sans-serif; color: var(--text-muted); font-weight: 500; font-size: 1rem;">
        <i class="fa-regular fa-credit-card"></i> មិនទាន់មានកាតភ្ជាប់នៅឡើយទេ
      </div>
    `;

    if (btnContainer) {
      btnContainer.innerHTML = `
        <button class="btn-primary" onclick="scanAdminNfc()" style="background: #3b82f6; width: 100%; justify-content: center; padding: 14px; border-radius: 12px; font-family: 'Kantumruy Pro', sans-serif; font-size: 1.05rem; font-weight: 600; letter-spacing: 0.5px; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2); transition: all 0.3s ease;">
          <i class="fa-solid fa-wifi"></i> ចាប់ផ្តើម Scan កាតថ្មី
        </button>
      `;
    }
  }
}

// 🟢 ហៅមុខងារនេះពេល Admin ចុចផ្តាច់កាត
function removeAdminNfc() {
  Swal.fire({
    title: "ផ្តាច់កាតនេះ?",
    text: "បុគ្គលិកនឹងមិនអាចយកកាតនេះមក Scan បានទៀតទេ។",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#ef4444",
    cancelButtonColor: "#94a3b8",
    confirmButtonText: "បាទ, ផ្តាច់ចោល",
    customClass: { popup: "premium-swal" },
  }).then((result) => {
    if (result.isConfirmed) {
      renderNfcUiBox("");
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "កាតត្រូវបានផ្តាច់!",
        showConfirmButton: false,
        timer: 2000,
      });
    }
  });
}

// 🟢 មុខងារជំនួយបញ្ជូនទិន្នន័យស្កេនរួចទៅកាន់ Server
async function processScannedUID(serialNumber) {
  // លុបសញ្ញា : និងដកឃ្លាចេញ ដើម្បីឱ្យកូដកាតស្អាត
  const cleanSerialNumber = serialNumber
    .replaceAll(":", "")
    .replace(/\s/g, "")
    .toUpperCase();

  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);

  Swal.fire({
    title: "កំពុងផ្ទៀងផ្ទាត់កាត...",
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading(),
  });

  try {
    const currentAdminId = document.getElementById("manageAdminId").value;
    const res = await fetch("/api/admin/check-nfc", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        nfcUid: cleanSerialNumber,
        adminId: currentAdminId,
      }),
    });
    const data = await res.json();

    if (!data.available) {
      Swal.fire({
        title: "បដិសេធ!",
        text: `កាតនេះត្រូវបានភ្ជាប់ជាមួយគណនី "@${data.owner}" រួចហើយ! សូមផ្តាច់វាពីគណនីនោះសិន ឬប្រើកាតផ្សេង។`,
        icon: "error",
        confirmButtonColor: "#ef4444",
      });
      return;
    }

    renderNfcUiBox(cleanSerialNumber);
    Swal.fire({
      toast: true,
      position: "top-end",
      icon: "success",
      title: "កាតត្រូវបានភ្ជាប់!",
      showConfirmButton: false,
      timer: 2000,
    });
  } catch (e) {
    Swal.fire("កំហុស", "មិនអាចផ្ទៀងផ្ទាត់កាតបានទេ (Server Error)!", "error");
  }
}

// 🟢 មុខងារ Scan NFC គាំទ្រទាំង POS (Web NFC API) និង USB Scanner (ការពារបញ្ហាខុសភាសា Keyboard)
async function scanAdminNfc() {
  let isScanning = true;
  let scanBuffer = ""; // បង្កើតអថេរទុកលេខកូដកាតដោយផ្ទាល់

  Swal.fire({
    title: "កំពុងស្វែងរកកាត...",
    html: `
      <div class="nfc-radar-box">
        <i class="fa-solid fa-wifi fa-fade" style="font-size: 3.5rem; color: #3b82f6;"></i>
      </div>
      <p style="color: #64748b; font-size: 0.95rem; font-family: 'Kantumruy Pro';">
        សូមផ្អឹបកាត NFC លើទូរស័ព្ទ ម៉ាស៊ីន POS ឬ <b>ម៉ាស៊ីន USB Scanner</b>
      </p>
      <!-- 🔴 ប្រអប់លាក់មុខ សម្រាប់ចាប់សញ្ញា Hardware Keyboard -->
      <input type="text" id="hiddenUsbScannerInput" style="opacity: 0; position: absolute; z-index: -1; top: 0; left: 0;" autocomplete="off">
    `,
    showCancelButton: true,
    cancelButtonText: "បោះបង់ (Cancel)",
    cancelButtonColor: "#ef4444",
    showConfirmButton: false,
    allowOutsideClick: false,
    customClass: { popup: "premium-swal" },
    didOpen: () => {
      const hiddenInput = document.getElementById("hiddenUsbScannerInput");
      if (hiddenInput) {
        hiddenInput.focus();

        hiddenInput.addEventListener("blur", () => {
          if (isScanning) setTimeout(() => hiddenInput.focus(), 10);
        });

        // 🔴 ប្រើ keydown និង e.code ដើម្បីចាប់យក Hardware Key មិនខ្វល់ពីភាសាខ្មែរឬអង់គ្លេស
        hiddenInput.addEventListener("keydown", function (e) {
          e.preventDefault(); // បិទមិនឱ្យវាយចេញជាអក្សរចូលប្រអប់ (ការពារការលោតអក្សរខ្មែរ)

          if (e.code === "Enter" || e.code === "NumpadEnter") {
            if (scanBuffer.length >= 4) {
              isScanning = false;
              Swal.close();
              // សម្រាប់ USB Scanner
              processScannedUID(normalizeUID(scanBuffer));
            }
            scanBuffer = ""; // Clear ទុកស្កេនម្តងទៀតបើ Error
          } else {
            // ទាញយកតែលេខ និងអក្សរអង់គ្លេសចេញពី e.code (ឧទាហរណ៍: "Digit1" ទៅជា "1", "KeyA" ទៅជា "A")
            if (e.code.startsWith("Digit")) {
              scanBuffer += e.code.replace("Digit", "");
            } else if (e.code.startsWith("Numpad")) {
              scanBuffer += e.code.replace("Numpad", "");
            } else if (e.code.startsWith("Key")) {
              scanBuffer += e.code.replace("Key", "");
            }
          }
        });
      }
    },
    didClose: () => {
      isScanning = false;
    },
  });

  // ដំណើរការ Web NFC (សម្រាប់ POS / Android) ស្របពេលគ្នា
  if ("NDEFReader" in window) {
    const abortController = new AbortController();

    Swal.getPopup().addEventListener("cancel", () => {
      abortController.abort();
    });

    try {
      const ndef = new NDEFReader();
      await ndef.scan({ signal: abortController.signal });

      ndef.onreading = async (event) => {
        if (!isScanning) return;

        isScanning = false;
        abortController.abort();
        Swal.close();

        // សម្រាប់ Web NFC
        processScannedUID(normalizeUID(event.serialNumber));
      };
    } catch (error) {
      if (error.name !== "AbortError") {
        console.warn(
          "NFC Sensor error, fallback to USB scanner active.",
          error,
        );
      }
    }
  }
}

// ========================================================================
// 💾 SAVE & DELETE API CALLS
// ========================================================================

// 🟢 មុខងារ Save បញ្ជូនទៅ API
async function saveAdminAccount() {
  const id = document.getElementById("manageAdminId").value;
  const role = document.getElementById("manageAdminRole").value;

  const permissions = {
    customRoleName: document.getElementById("customRoleName")?.value || "",
    workStart: document.getElementById("permWorkStart")?.value || "00:00",
    workEnd: document.getElementById("permWorkEnd")?.value || "23:59",
    menus: {
      users: document.getElementById("p_users")?.checked ?? true,
      checktrx: document.getElementById("p_checktrx")?.checked ?? true,
      merchant: document.getElementById("p_merchant")?.checked ?? false,
      cashier: document.getElementById("p_cashier")?.checked ?? false,
      broadcast: document.getElementById("p_broadcast")?.checked ?? false,
      fx: document.getElementById("p_fx")?.checked ?? false,
      cards: document.getElementById("p_cards")?.checked ?? false,
      promos: document.getElementById("p_promos")?.checked ?? false,
      kyc: document.getElementById("p_kyc")?.checked ?? false,
      tickets: document.getElementById("p_tickets")?.checked ?? false,
      chat: document.getElementById("p_chat")?.checked ?? false,
      logs: document.getElementById("p_logs")?.checked ?? false,
    },
    actions: {
      editUser: document.getElementById("p_edit_user")?.checked ?? false,
      deleteUser: document.getElementById("p_delete_user")?.checked ?? false,
      freezeUser: document.getElementById("p_freeze_user")?.checked ?? false,
      adjustBal: document.getElementById("p_adjust_bal")?.checked ?? false,
      refund: document.getElementById("p_refund")?.checked ?? false,
    },
  };

  const payload = {
    id,
    staffId: document.getElementById("staffId").value,
    username: document.getElementById("manageAdminUser").value,
    password: document.getElementById("manageAdminPass").value,
    fullName: document.getElementById("adminFullName").value.toUpperCase(),
    nickname: document.getElementById("adminNickname").value,
    phone: document.getElementById("adminPhone").value,
    email: document.getElementById("adminEmail").value,
    department: document.getElementById("adminDept").value,
    remarks: document.getElementById("adminRemarks").value,
    nfcUid: document.getElementById("adminNfcUid").value,
    role,
    permissions,
  };

  try {
    Swal.fire({
      title: "កំពុងរក្សាទុក...",
      didOpen: () => {
        Swal.showLoading();
      },
    });
    const res = await fetch("/api/admin/save-admin", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (data.success) {
      Swal.fire("ជោគជ័យ!", data.message, "success");
      if (typeof closeModal === "function") closeModal("adminAccModal");
      loadAdminList();
    } else {
      Swal.fire("បរាជ័យ", data.message, "error");
    }
  } catch (err) {
    Swal.fire("Error", "មានបញ្ហាតភ្ជាប់ទៅកាន់ Server", "error");
  }
}

async function deleteAdminAcc(id) {
  const confirm = await Swal.fire({
    title: "លុបគណនីនេះ?",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#ef4444",
    cancelButtonColor: "#94a3b8",
    confirmButtonText: "បាទ/ចាស លុប",
  });
  if (confirm.isConfirmed) {
    try {
      const res = await fetch("/api/admin/delete-admin", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.success) {
        Swal.fire("លុបរួចរាល់", "", "success");
        loadAdminList();
      } else Swal.fire("បរាជ័យ", data.message, "error");
    } catch (e) {
      Swal.fire("Error", "Server Error", "error");
    }
  }
}

// 🟢 មុខងារបើក SweetAlert ឱ្យ Super Admin រိုက် Password ថ្មី
async function promptResetAdminPassword(adminId, username) {
  const { value: newPassword } = await Swal.fire({
    title: `<span style="font-family: 'Kantumruy Pro', sans-serif;">Reset Password ជូន @${username}</span>`,
    input: "text",
    inputLabel: "សូមបញ្ចូលពាក្យសម្ងាត់ថ្មី (New Password)",
    inputPlaceholder: "ឧ. 1234 ឬ admin123...",
    showCancelButton: true,
    confirmButtonText:
      "<span style=\"font-family: 'Kantumruy Pro', sans-serif;\">ប្តូរពាក្យសម្ងាត់</span>",
    cancelButtonText:
      "<span style=\"font-family: 'Kantumruy Pro', sans-serif;\">បោះបង់</span>",
    confirmButtonColor: "#10b981",
    cancelButtonColor: "#64748b",
    customClass: { popup: "premium-swal" },
    inputValidator: (value) => {
      if (!value || value.trim() === "") {
        return "សូមបញ្ចូលពាក្យសម្ងាត់ថ្មី!";
      }
    },
  });

  if (newPassword) {
    executeResetAdminPassword(adminId, newPassword.trim());
  }
}

// 🟢 មុខងារបញ្ជូន Password ថ្មីទៅកាន់ API
async function executeResetAdminPassword(adminId, newPassword) {
  try {
    Swal.fire({
      title: "កំពុងដំណើរការ...",
      didOpen: () => Swal.showLoading(),
      customClass: { popup: "premium-swal" },
    });

    const res = await fetch("/api/admin/reset-admin-password", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ adminId, newPassword }),
    });
    const data = await res.json();

    if (data.success) {
      Swal.fire({
        title: "ជោគជ័យ!",
        text: data.message,
        icon: "success",
        confirmButtonColor: "#10b981",
        customClass: { popup: "premium-swal" },
      });
    } else {
      Swal.fire({
        title: "បរាជ័យ",
        text: data.message,
        icon: "error",
        confirmButtonColor: "#ef4444",
        customClass: { popup: "premium-swal" },
      });
    }
  } catch (err) {
    Swal.fire({
      title: "Error",
      text: "មានបញ្ហាតភ្ជាប់ទៅកាន់ Server",
      icon: "error",
      confirmButtonColor: "#ef4444",
      customClass: { popup: "premium-swal" },
    });
  }
}

// 🟢 មុខងារបង្ហាញ UID ពេលចុចលើ icon Wi-Fi
function showNfcUid(uid) {
  Swal.fire({
    title:
      "<span style=\"font-family: 'Kantumruy Pro', sans-serif;\">លេខកូដកាត NFC</span>",
    html: `
      <div style="text-align: center; padding: 10px;">
        <i class="fa-solid fa-wifi" style="font-size: 3rem; color: #3b82f6; margin-bottom: 15px;"></i>
        <div style="font-family: 'JetBrains Mono', monospace; font-size: 1.4rem; color: var(--text-main); font-weight: bold; background: var(--input-bg, #f1f5f9); border: 1px solid var(--border, #cbd5e1); padding: 15px; border-radius: 12px; letter-spacing: 1.5px;">
          ${uid}
        </div>
      </div>
    `,
    confirmButtonText:
      "<span style=\"font-family: 'Kantumruy Pro', sans-serif;\">បិទ</span>",
    confirmButtonColor: "#3b82f6",
    customClass: { popup: "premium-swal" },
  });
}

// 🟢 មុខងារបញ្ជូនសំណើបិទ/បើក Status ទៅកាន់ Server
async function toggleAdminStatusAccount(adminId) {
  try {
    const res = await fetch("/api/admin/toggle-admin-status", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ adminId }),
    });
    const data = await res.json();

    if (data.success) {
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: data.message,
        showConfirmButton: false,
        timer: 2000,
      });
      loadData();
      loadAdminList();
    } else {
      Swal.fire({
        title: "បរាជ័យ",
        text: data.message,
        icon: "error",
        customClass: { popup: "premium-swal" },
      });
      loadAdminList();
    }
  } catch (err) {
    Swal.fire({
      title: "Error",
      text: "មានបញ្ហាតភ្ជាប់ទៅកាន់ Server",
      icon: "error",
      customClass: { popup: "premium-swal" },
    });
    loadAdminList();
  }
}
