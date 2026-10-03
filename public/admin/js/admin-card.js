// ========================================================================
// ឯកសារ: admin-card.js
// អត្ថន័យ: គ្រប់គ្រងកាតនិម្មិត/រូបវ័ន្ត ការស្កេន និងការភ្ជាប់កាត NFC
// ========================================================================

// ១. ផ្អាកឬបើកកាត (Freeze/Unfreeze)
async function toggleCardLock(username, cardId, isCurrentlyLocked) {
  const actionText = isCurrentlyLocked ? "Unblock" : "Freeze";
  const confirm = await Swal.fire({
    title: `${actionText} Card?`,
    icon: "warning",
    showCancelButton: true,
  });
  if (confirm.isConfirmed) {
    const res = await fetch("/api/admin/toggle-card-lock", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ username, cardId, isLocked: !isCurrentlyLocked }),
    });
    const data = await res.json();
    if (data.success) {
      Swal.fire(
        "Success",
        `Card has been ${isCurrentlyLocked ? "unblocked" : "frozen"}.`,
        "success",
      );
      loadData();
    } else {
      Swal.fire("បរាជ័យ", data.message, "error");
    }
  }
}

// មុខងារ Normalizes UID កាត NFC
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

// ២. ស្វែងរកកាត (Search Filtering)
function filterCards() {
  const searchInput = document
    .getElementById("searchCardBox")
    .value.toLowerCase();
  const tableRows = document.querySelectorAll("#cardTableBody tr");

  tableRows.forEach((row) => {
    if (row.cells.length <= 1) return; // រំលងជួរ Loading...

    const visibleText = row.innerText.toLowerCase();
    const hiddenData = row.getAttribute("data-search")
      ? row.getAttribute("data-search").toLowerCase()
      : "";

    if (visibleText.includes(searchInput) || hiddenData.includes(searchInput)) {
      row.style.display = "";
    } else {
      row.style.display = "none";
    }
  });
}

// ៣. មុខងារភ្ជាប់កាត NFC (Quick Bind NFC)
window.quickBindNFC = async function (username, cardId) {
  // 🟢 ជំហានទី១៖ ទាញយកទិន្នន័យអតិថិជន និងកាត ពី globalUsersData
  const targetUser = globalUsersData.find((u) => u.username === username);
  if (!targetUser)
    return Swal.fire("កំហុស", "រកមិនឃើញគណនីអតិថិជននេះទេ!", "error");

  const targetCard = targetUser.virtualCards?.find((c) => c.id === cardId);
  if (!targetCard) return Swal.fire("កំហុស", "រកមិនឃើញកាតមួយនេះទេ!", "error");

  // 🟢 ជំហានទី២៖ រៀបចំទិន្នន័យសម្រាប់បង្ហាញអោយស្អាត
  const fullName = (targetUser.fullName || targetUser.username).toUpperCase();
  const rawNum = targetCard.number || "0000000000000000";
  const formattedNum = rawNum.match(/.{1,4}/g)?.join(" ") || rawNum;
  const cardType = (
    targetCard.name ||
    targetCard.type ||
    "Standard"
  ).toUpperCase();

  // កំណត់រូបិយប័ណ្ណ និង លេខគណនីដែលភ្ជាប់
  let currency = targetCard.linkedAccount === "KHR" ? "KHR" : "USD";
  let linkedAccNum = "N/A";
  if (targetCard.linkedAccount === "USD") {
    // ចាប់យកពី mainAccounts.USD ថ្មី
    linkedAccNum = targetUser.mainAccounts?.USD?.accountNumber || "N/A";
  } else if (targetCard.linkedAccount === "KHR") {
    // ចាប់យកពី mainAccounts.KHR ថ្មី
    linkedAccNum = targetUser.mainAccounts?.KHR?.accountNumber || "N/A";
  } else {
    currency = targetCard.linkedAccount?.split("_")[0] || "USD";
    linkedAccNum =
      targetCard.linkedAccount?.split("_")[1] || targetCard.linkedAccount;
  }

  // 🔥 ចាប់យក PIN ចាស់របស់គាត់ផ្ទាល់ (បើគ្មាន ទើបយក 0000 ជា Default)
  const currentCardPin = targetCard.pin || "0000";

  // 🟢 ជំហានទី៣៖ បង្ហាញផ្ទាំង UI (SweetAlert2) យ៉ាងស្រស់ស្អាត ដោយគ្មានការវាយ PIN
  const confirm = await Swal.fire({
    title:
      '<i class="fa-solid fa-address-card" style="color: #3b82f6; font-size: 2.5rem; margin-bottom: 10px;"></i><br><span style="font-family: \'Kantumruy Pro\'; font-weight: 700;">ផ្ទៀងផ្ទាត់ព័ត៌មានកាត</span>',
    html: `
      <div style="text-align: left; font-family: 'Kantumruy Pro', sans-serif;">
         <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);">
            
            <!-- ឈ្មោះម្ចាស់កាត -->
            <div style="margin-bottom: 15px;">
               <span style="font-size: 0.8rem; color: #64748b; font-weight: 600;"><i class="fa-solid fa-user"></i> ឈ្មោះម្ចាស់កាត (Card Holder)</span><br>
               <span style="font-size: 1.1rem; color: #0f172a; font-weight: 700;">${fullName}</span>
            </div>
            
            <!-- លេខកាត -->
            <div style="margin-bottom: 15px;">
               <span style="font-size: 0.8rem; color: #64748b; font-weight: 600;"><i class="fa-regular fa-credit-card"></i> ភ្ជាប់ទៅកាតលេខ (Card Number)</span><br>
               <span style="font-size: 1.25rem; color: #3b82f6; font-weight: 800; font-family: 'Courier New', monospace; letter-spacing: 1px;">${formattedNum}</span>
            </div>
            
            <!-- ប្រភេទ និង គណនី -->
            <div style="display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px dashed #cbd5e1; padding-top: 12px;">
               <div>
                  <span style="font-size: 0.8rem; color: #64748b; font-weight: 600;">ប្រភេទកាត (Type)</span><br>
                  <span style="font-size: 0.95rem; color: #0f172a; font-weight: 700;">${cardType}</span>
               </div>
               <div style="text-align: right;">
                  <span style="font-size: 0.8rem; color: #64748b; font-weight: 600;">គណនីភ្ជាប់ (${currency})</span><br>
                  <span style="font-size: 0.95rem; color: #10b981; font-weight: 800; font-family: monospace;">${linkedAccNum}</span>
               </div>
            </div>
            
         </div>
         <p style="text-align: center; color: #ef4444; font-size: 0.85rem; margin-top: 15px; font-weight: 600;">
            <i class="fa-solid fa-circle-exclamation"></i> សូមត្រួតពិនិត្យព័ត៌មានឱ្យបានត្រឹមត្រូវមុនពេលស្កេនកាត!
         </p>
      </div>
    `,
    showCancelButton: true,
    confirmButtonColor: "#10b981",
    cancelButtonColor: "#94a3b8",
    confirmButtonText: '<i class="fa-solid fa-wifi"></i> ចាប់ផ្តើមស្កេន',
    cancelButtonText: "បោះបង់",
    customClass: { popup: "premium-swal" },
  });

  if (!confirm.isConfirmed) return;

  // 🟢 ជំហានទី៤៖ ដំណើរការមុខងារស្កេន NFC (គាំទ្រទាំង Web NFC និង USB Scanner)
  let isScanning = true;
  let scanBuffer = "";

  Swal.fire({
    title: "📡 កំពុងរង់ចាំស្កេនកាត NFC...",
    html: `
      <div style="margin: 20px 0;"><i class="fa-solid fa-wifi fa-beat" style="font-size: 4.5rem; color: #0ea5e9;"></i></div>
      <p style="color: #64748b; font-family: 'Kantumruy Pro';">សូមយកកាតមកផ្អឹបនឹងផ្នែកខាងក្រោយទូរស័ព្ទ ឬម៉ាស៊ីន POS / USB Scanner</p>
      <!-- 🔴 ប្រអប់លាក់មុខ សម្រាប់ចាប់សញ្ញា Hardware Keyboard របស់ USB Scanner -->
      <input type="text" id="hiddenUsbScannerInput" style="opacity: 0; position: absolute; z-index: -1; top: 0; left: 0;" autocomplete="off">
    `,
    showConfirmButton: false,
    showCancelButton: true,
    cancelButtonText: "បោះបង់ (Cancel)",
    cancelButtonColor: "#ef4444",
    allowOutsideClick: false,
    customClass: { popup: "premium-swal" },
    didOpen: () => {
      const hiddenInput = document.getElementById("hiddenUsbScannerInput");
      if (hiddenInput) {
        hiddenInput.focus();

        hiddenInput.addEventListener("blur", () => {
          if (isScanning) setTimeout(() => hiddenInput.focus(), 10);
        });

        hiddenInput.addEventListener("keydown", function (e) {
          e.preventDefault();

          if (e.code === "Enter" || e.code === "NumpadEnter") {
            if (scanBuffer.length >= 4) {
              isScanning = false;
              Swal.close();
              // សម្រាប់ USB Scanner
              processCardBinding(
                username,
                cardId,
                currentCardPin,
                normalizeUID(scanBuffer),
              );
            }
            scanBuffer = "";
          } else {
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

        let serialNumber = event.serialNumber;
        if (serialNumber) {
          serialNumber = serialNumber.replaceAll(":", "").toUpperCase();
        }
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);

        // សម្រាប់ Web NFC
        processCardBinding(
          username,
          cardId,
          currentCardPin,
          normalizeUID(serialNumber), // ✅ ត្រូវហើយ! ប្រើអថេរដែលលុបសញ្ញា : ចេញរួចរាល់
        );
      };

      ndef.onreadingerror = () => {
        if (isScanning) {
          Swal.fire("បរាជ័យ", "មិនអាចអានកាតបានទេ សូមព្យាយាមម្តងទៀត។", "error");
          isScanning = false;
        }
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
};

// ៤. Process Card Binding Backend Request
async function processCardBinding(username, cardId, pin, uid) {
  try {
    const res = await fetch("/api/admin/cards/bind-nfc", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ username, cardId, pin, uid }),
    });
    const data = await res.json();
    if (data.success) {
      Swal.fire({
        icon: "success",
        title: "ភ្ជាប់ជោគជ័យ!",
        text: `កាត NFC ត្រូវបានភ្ជាប់រួចរាល់។`,
        customClass: { popup: "premium-swal" },
      });
      if (typeof loadData === "function") loadData();
    } else {
      Swal.fire({
        icon: "error",
        title: "មិនអាចភ្ជាប់បានទេ!",
        text: data.message || "មានកំហុសកើតឡើង!",
        customClass: { popup: "premium-swal" },
      });
    }
  } catch (e) {
    Swal.fire("កំហុស", "មានបញ្ហាបច្ចេកទេសជាមួយ Server", "error");
  }
}

// ៥. មុខងារផ្តាច់កាត NFC
window.unbindNFC = function (username, cardId) {
  Swal.fire({
    title: "ផ្តាច់កាត NFC នេះ?",
    text: "កាត Physical នេះនឹងត្រូវបានលុបការភ្ជាប់ចោល!",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#ef4444",
    cancelButtonColor: "#94a3b8",
    confirmButtonText: "បាទ, ផ្តាច់ចោល",
    customClass: { popup: "premium-swal" },
  }).then(async (result) => {
    if (result.isConfirmed) {
      Swal.fire({ title: "កំពុងផ្តាច់...", didOpen: () => Swal.showLoading() });
      try {
        const res = await fetch("/api/admin/cards/unbind-nfc", {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({ username, cardId }),
        });
        const data = await res.json();
        if (data.success) {
          Swal.fire("ជោគជ័យ", "បានផ្តាច់កាត NFC ចេញវិញហើយ!", "success");
          if (typeof loadData === "function") loadData();
        } else {
          Swal.fire("បរាជ័យ", data.message || "មានបញ្ហា", "error");
        }
      } catch (e) {
        Swal.fire("Error", "បញ្ហាភ្ជាប់ទៅកាន់ Server", "error");
      }
    }
  });
};
