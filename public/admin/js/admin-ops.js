// admin-ops.js

// ========================================================================
// 📂 SECTION 1: KYC & DOCUMENTS MANAGEMENT
// ========================================================================
function viewKycDocument(base64Image) {
  Swal.fire({
    title: "ឯកសារបញ្ជាក់អត្តសញ្ញាណ",
    imageUrl: base64Image,
    imageAlt: "KYC Document",
    width: "600px",
    customClass: { popup: "premium-swal" },
  });
}

async function kycAction(username, action) {
  const actionText = action === "approved" ? "Approve" : "Reject";
  const confirm = await Swal.fire({
    title: `${actionText} KYC?`,
    icon: "question",
    showCancelButton: true,
  });
  if (confirm.isConfirmed) {
    const res = await fetch("/api/admin/kyc-action", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ username, action }),
    });
    const data = await res.json();
    if (data.success) {
      Swal.fire("Success", `KYC ${actionText}d.`, "success");
      loadData();
    }
  }
}

// ========================================================================
// 💳 SECTION 2: CARDS MANAGEMENT & NFC BINDING
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

// ២. ស្វែងរកកាត (Search Filtering) - ថ្មី!
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

// ៣. មុខងារភ្ជាប់កាត NFC
// ========================================================================
// 💳 SECTION: SECURE QUICK NFC BINDING (FLOW សុវត្ថិភាពខ្ពស់ ១០០%)
// ========================================================================
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
    linkedAccNum = targetUser.accountNumber || "N/A";
  } else if (targetCard.linkedAccount === "KHR") {
    linkedAccNum = targetUser.accountNumberKHR || "N/A";
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

  // 🟢 ជំហានទី៤៖ ដំណើរការមុខងារស្កេន NFC ដដែល
  if (!("NDEFReader" in window)) {
    return Swal.fire(
      "គ្មានមុខងារ NFC",
      "ឧបករណ៍នេះមិនអាចស្កេនកាតបានទេ!",
      "error",
    );
  }

  Swal.fire({
    title: "📡 កំពុងរង់ចាំស្កេនកាត NFC...",
    html: '<div style="margin: 20px 0;"><i class="fa-solid fa-wifi fa-beat" style="font-size: 4.5rem; color: #0ea5e9;"></i></div><p style="color: #64748b; font-family: \'Kantumruy Pro\';">សូមយកកាតមកផ្អឹបនឹងផ្នែកខាងក្រោយទូរស័ព្ទ ឬម៉ាស៊ីន POS</p>',
    showConfirmButton: false,
    allowOutsideClick: false,
    customClass: { popup: "premium-swal" },
  });

  try {
    const ndef = new NDEFReader();
    await ndef.scan();

    ndef.onreading = async (event) => {
      let serialNumber = event.serialNumber;
      if (serialNumber) {
        serialNumber = serialNumber.replaceAll(":", "").toUpperCase();
      }

      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);

      // 🟢 ជំហានទី៥៖ បញ្ជូនទៅ Backend ដោយប្រើ PIN ដើមរបស់អតិថិជន (មិនប៉ះពាល់លេខសម្ងាត់គាត់ទេ)
      processCardBinding(username, cardId, currentCardPin, serialNumber);
    };

    ndef.onreadingerror = () => {
      Swal.fire("បរាជ័យ", "មិនអាចអានកាតបានទេ សូមព្យាយាមម្តងទៀត។", "error");
    };
  } catch (error) {
    console.error("NFC Scan Error:", error);
    Swal.fire("កំហុស", "មិនអាចបើកមុខងារ NFC របស់ម៉ាស៊ីនបានទេ!", "error");
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

// ========================================================================
// 🎫 SECTION 3: TICKETS & CUSTOMER SUPPORT
// ========================================================================
async function replyTicket(username, ticketId) {
  const { value: text } = await Swal.fire({
    title: "Reply to Ticket",
    input: "textarea",
    inputPlaceholder: "Type your reply here...",
    showCancelButton: true,
  });
  if (text) {
    const res = await fetch("/api/admin/ticket-reply", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ username, ticketId, replyMessage: text }),
    });
    const data = await res.json();
    if (data.success) {
      Swal.fire("Success", "Reply sent to user.", "success");
      loadData();
    }
  }
}

function viewUserMessage(username, ticketId) {
  const targetUser = globalUsersData.find((u) => u.username === username);
  const ticket = targetUser?.tickets?.find((t) => t.ticketId === ticketId);
  if (!ticket) return;
  Swal.fire({
    title:
      '<i class="fa-solid fa-envelope-open-text" style="color:#004d40;"></i> សារពីអតិថិជន',
    html: `<div style="text-align: left; font-family: 'Kantumruy Pro';"><div style="margin-bottom: 15px; padding: 18px; background: #f1f5f9; border-radius: 16px; border: 1px solid #e2e8f0;"><p style="margin: 0 0 8px; font-size: 0.85rem; color: #64748b; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">សេចក្តីពិពណ៌នាបញ្ហា៖</p><p style="margin: 0; font-size: 1.05rem; color: #1e293b; line-height: 1.6;">${ticket.description}</p></div><div style="font-size: 0.8rem; color: #94a3b8; padding-left: 5px;"><i class="fa-regular fa-clock"></i> បញ្ជូននៅថ្ងៃ៖ ${ticket.date}</div></div>`,
    confirmButtonText: "យល់ព្រម",
    buttonsStyling: false,
    customClass: {
      popup: "premium-swal",
      title: "premium-swal-title",
      confirmButton: "premium-btn-confirm",
    },
  });
}

// ========================================================================
// 🔍 SECTION 4: TRANSACTION CHECK & ACTION (Approve / Refund)
// ========================================================================
async function searchTrx() {
  const id = document.getElementById("searchTrxId").value.trim();
  if (!id)
    return Swal.fire("បំរាម", "សូមបញ្ចូលលេខ Ref ID ឬ Hash Code!", "warning");

  Swal.fire({
    title: "Searching...",
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading(),
  });

  try {
    const res = await fetch(`/api/admin/transaction/${id}`, {
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    const box = document.getElementById("trxResult");
    Swal.close();

    if (data.success && data.transaction) {
      const t = data.transaction;
      const isPending = t.status === "Pending";
      const isKHR = t.currency === "KHR";
      const currSym = isKHR ? "៛" : "$";

      const fmtAmt = isKHR
        ? Math.abs(t.amount || 0).toLocaleString("en-US", {
            maximumFractionDigits: 0,
          })
        : Math.abs(t.amount || 0).toFixed(2);
      const fmtFee = isKHR
        ? Math.abs(t.fee || 0).toLocaleString("en-US", {
            maximumFractionDigits: 0,
          })
        : Math.abs(t.fee || 0).toFixed(2);
      const fmtProfit = isKHR
        ? Math.abs(t.profit || t.commission || 0).toLocaleString("en-US", {
            maximumFractionDigits: 0,
          })
        : Math.abs(t.profit || t.commission || 0).toFixed(2);

      let sName =
        t.senderName || t.sender || t.fromName || t.senderPhone || "System";
      let sAcc =
        t.senderAcc ||
        t.senderAccount ||
        t.fromAccount ||
        t.accountNumber ||
        "N/A";
      let rName =
        t.receiverName || t.receiver || t.toName || t.receiverPhone || "System";
      let rAcc = t.receiverAcc || t.receiverAccount || t.toAccount || "N/A";

      let sDevice = t.senderDevice || "Mobile Device";
      let rDevice = t.receiverDevice || "Mobile Device";
      let sIp = t.senderIp || "127.0.0.1";
      let rIp = t.receiverIp || "127.0.0.1";

      let sKyc = t.senderKyc || t.kycStatus || "Unverified";
      let rKyc = t.receiverKyc || t.kycStatus || "Unverified";
      let sKycColor =
        sKyc.toLowerCase() === "verified" || sKyc.toLowerCase() === "approved"
          ? "#10b981"
          : "#ef4444";
      let rKycColor =
        rKyc.toLowerCase() === "verified" || rKyc.toLowerCase() === "approved"
          ? "#10b981"
          : "#ef4444";

      let depositorHtml = "";

      if (t.type === "Cash Deposit") {
        sName = "Cash Deposit (ដាក់ប្រាក់)";
        sAcc = "CASH-DESK";
        sDevice = "Branch Admin System";
        sIp = "Internal Network";
        t.senderType = "System";
        sKyc = "System";
        sKycColor = "#3b82f6";

        let dName = t.depositorName;
        if (!dName)
          dName =
            t.remark && t.remark.includes("អ្នកផ្សេង")
              ? t.remark
              : "ម្ចាស់គណនីផ្ទាល់ (Self)";
        let dAcc =
          t.depositorAcc && t.depositorAcc !== "N/A"
            ? `(${t.depositorAcc})`
            : "";
        depositorHtml = `<div class="t-row"><span class="t-label">Deposited By</span><span class="t-value" style="font-weight: 900; color: #d97706; background: #fffbeb; padding: 3px 10px; border-radius: 6px; border: 1px dashed #fcd34d;">${dName} ${dAcc}</span></div>`;
      } else if (t.type === "Cash Withdrawal") {
        rName = "Cash Withdrawal (ដកប្រាក់)";
        rAcc = "CASH-DESK";
        rDevice = "Branch Admin System";
        rIp = "Internal Network";
        t.receiverType = "System";
        rKyc = "System";
        rKycColor = "#3b82f6";
      } else if (
        t.type === "Card Issuance Fee" ||
        (t.type && t.type.includes("Fee")) ||
        (rName && rName.toLowerCase().includes("service"))
      ) {
        rAcc = "SYSTEM-FEE-WALLET";
        rDevice = "U-PAY Core System";
        rIp = "Internal Network";
        t.receiverType = "System Revenue";
        rKyc = "System";
        rKycColor = "#3b82f6";
      }

      if (sName.toLowerCase().includes("system")) {
        sAcc = "SYSTEM-WALLET";
        sDevice = "System Server";
        sIp = "Internal Network";
        t.senderType = "System";
        sKyc = "System";
        sKycColor = "#3b82f6";
      }
      if (rName.toLowerCase().includes("system")) {
        rAcc = "SYSTEM-WALLET";
        rDevice = "System Server";
        rIp = "Internal Network";
        t.receiverType = "System";
        rKyc = "System";
        rKycColor = "#3b82f6";
      }

      let mId = t.merchantId || t.receiverMerchantId;
      let merchantHtml = mId
        ? `<div class="t-row"><span class="t-label">Merchant ID</span> <span class="t-value" style="font-family: monospace; color: #8b5cf6; font-weight: 900; background: #f5f3ff; padding: 3px 10px; border-radius: 6px; border: 1px dashed #ddd6fe;">${mId}</span></div>`
        : "";

      let canRefund =
        adminRole === "super_admin" ||
        (myAdminPermissions && myAdminPermissions.actions?.refund);
      let refundHtml = canRefund
        ? `<button onclick="handleAdminAction('refund', '${t.refId || t.id}')" style="padding: 8px 15px; background: #ef4444; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; font-family: inherit; font-size: 0.9rem; display: flex; align-items: center; gap: 6px; transition: 0.2s;" onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'"><i class="fa-solid fa-rotate-left"></i> Refund Transaction</button>`
        : `<span style="color: var(--text-muted);">គ្មានសិទ្ធិ Refund ទេ</span>`;

      box.style.display = "block";
      box.innerHTML = `
        <div class="trx-grid">
          <div class="trx-box">
            <h4><i class="fa-solid fa-arrow-up-right-from-square"></i> Sender Details</h4>
            <div class="t-row"><span class="t-label">Name</span> <span class="t-value">${sName}</span></div>
            ${depositorHtml}
            <div class="t-row"><span class="t-label">Account No.</span> <span class="t-value" style="font-family: monospace; color: var(--accent);">${sAcc}</span></div>
            <div class="t-row"><span class="t-label">Device</span> <span class="t-value">${sDevice}</span></div>
            <div class="t-row"><span class="t-label">IP Address</span> <span class="t-value">${sIp}</span></div>
            <div class="t-row"><span class="t-label">Account Type</span> <span class="t-value">${t.senderType || t.accountType || "Personal"}</span></div>
            <div class="t-row"><span class="t-label">KYC Status</span> <span class="t-value" style="font-weight: 600; color: ${sKycColor}">${sKyc}</span></div>
            <div class="t-row"><span class="t-label">Remark</span> <span class="t-value">${t.senderNote || t.remark || "General"}</span></div>
          </div>
          <div class="trx-box">
            <h4><i class="fa-solid fa-arrow-down-to-bracket"></i> Receiver Details</h4>
            <div class="t-row"><span class="t-label">Name</span> <span class="t-value">${rName}</span></div>
            ${merchantHtml}
            <div class="t-row"><span class="t-label">Account No.</span> <span class="t-value" style="font-family: monospace; color: var(--accent);">${rAcc}</span></div>
            <div class="t-row"><span class="t-label">Device</span> <span class="t-value">${rDevice}</span></div>
            <div class="t-row"><span class="t-label">IP Address</span> <span class="t-value">${rIp}</span></div>
            <div class="t-row"><span class="t-label">Account Type</span> <span class="t-value">${t.receiverType || (merchantHtml ? "Merchant" : "Personal")}</span></div>
            <div class="t-row"><span class="t-label">KYC Status</span> <span class="t-value" style="font-weight: 600; color: ${rKycColor}">${rKyc}</span></div>
            <div class="t-row"><span class="t-label">Remark</span> <span class="t-value">${t.receiverNote || t.remark || "General"}</span></div>
          </div>
          <div class="trx-box full">
            <h4><i class="fa-solid fa-circle-info"></i> Transaction Information</h4>
            <div class="t-row"><span class="t-label">Transaction Type</span> <span class="t-value" style="font-weight: 600; color: #3b82f6;">${t.type || "Platform Transfer"}</span></div>
            <div class="t-row"><span class="t-label">Payment Method</span> <span class="t-value">${t.trxMethod || t.method || "App Deep Link"}</span></div>
            <div class="t-row"><span class="t-label">Amount</span> <span class="t-value" style="font-size: 1.1rem; font-weight: bold; color: #10b981;">${isKHR ? "" : currSym}${fmtAmt}${isKHR ? " " + currSym : ""}</span></div>
            <div class="t-row"><span class="t-label">Status</span> <span class="t-value" style="color: ${isPending ? "#d97706" : t.status === "Failed" || t.status === "Rejected" || t.status === "Refunded" ? "#ef4444" : "#10b981"}; font-weight: bold;">${t.status || "Success"}</span></div>
            <div class="t-row"><span class="t-label">Network Fee</span> <span class="t-value">${isKHR ? "" : currSym}${fmtFee}${isKHR ? " " + currSym : ""}</span></div>
            <div class="t-row"><span class="t-label">System Profit</span> <span class="t-value" style="color: #6366f1;">${isKHR ? "" : currSym}${fmtProfit}${isKHR ? " " + currSym : ""}</span></div>
            <div class="t-row"><span class="t-label">Reference ID</span> <span class="t-value" style="font-family: monospace;">${t.refId || t.id || "N/A"}</span></div>
            <div class="t-row"><span class="t-label">Blockchain/Hash</span> <span class="t-value hash" style="font-family: monospace; word-break: break-all;">${t.hash || "N/A"}</span></div>
            <div class="t-row"><span class="t-label">Date & Time</span> <span class="t-value">${t.date || t.createdAt || "N/A"}</span></div>
            <div class="t-row" style="align-items: center;"><span class="t-label">Action</span><span class="t-value">${refundHtml}</span></div>
          </div>
        </div>
        ${isPending ? `<div class="trx-r-footer"><button class="btn-action-lg btn-approve" onclick="handleAdminAction('approve', '${t.refId || t.id}')"><i class="fa-solid fa-check"></i> Approve Only</button></div>` : ""}
      `;
    } else {
      box.style.display = "none";
      Swal.fire(
        "Not Found",
        data.message || "មិនមានទិន្នន័យប្រតិបត្តិការនេះនៅក្នុងប្រព័ន្ធទេ!",
        "error",
      );
    }
  } catch (error) {
    Swal.fire("Error", "មានបញ្ហាតភ្ជាប់ទៅកាន់ Server!", "error");
  }
}

async function handleAdminAction(action, id) {
  if (!id || id === "undefined")
    return Swal.fire(
      "Error",
      "រកមិនឃើញលេខសម្គាល់ប្រតិបត្តិការ (ID) ទេ!",
      "error",
    );
  let reason = "Admin Action";
  if (action === "refund") {
    const { value: text, isDismissed } = await Swal.fire({
      title: "បញ្ជាក់ការ Refund",
      input: "textarea",
      inputLabel: "សូមបញ្ជាក់មូលហេតុដែលដកលុយឱ្យអ្នកផ្ញើវិញ៖",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#94a3b8",
      confirmButtonText: "យល់ព្រម Refund",
      inputValidator: (value) => {
        if (!value || value.trim() === "")
          return "អ្នកត្រូវតែសរសេរមូលហេតុជាដាច់ខាត!";
      },
    });
    if (isDismissed || !text) return;
    reason = text;
  }
  const endpoint =
    action === "approve"
      ? "/api/admin/approve-transaction"
      : "/api/admin/refund-transaction";
  try {
    Swal.fire({
      title: "កំពុងដំណើរការ...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });
    const res = await fetch(endpoint, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ refId: id, reason: reason }),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      Swal.fire("ជោគជ័យ!", data.message, "success");
      if (typeof searchTrx === "function") searchTrx();
      else location.reload();
    } else {
      Swal.fire(
        "បរាជ័យ!",
        data.message || "មិនអាចធ្វើប្រតិបត្តិការបានទេ",
        "error",
      );
    }
  } catch (err) {
    Swal.fire("Error", "បញ្ហាក្នុងការតភ្ជាប់ទៅកាន់ Server", "error");
  }
}

// ========================================================================
// 📢 SECTION 5: BROADCAST MESSAGES
// ========================================================================
async function sendBroadcast() {
  const { value: formValues } = await Swal.fire({
    title:
      '<i class="fa-solid fa-bullhorn" style="color:var(--secondary); font-size: 2.5rem; margin-bottom: 10px;"></i><br>Send Broadcast',
    html: '<div style="text-align: left; margin-bottom: 8px; font-size: 0.9rem; font-weight: 600; color: var(--text-main);">Notification Title</div><input id="swal-title" class="swal2-input" placeholder="e.g., System Maintenance" style="width: 100%; box-sizing: border-box; margin: 0 0 20px 0; border-radius: 10px;"><div style="text-align: left; margin-bottom: 8px; font-size: 0.9rem; font-weight: 600; color: var(--text-main);">Message Content</div><textarea id="swal-msg" class="swal2-textarea" placeholder="Type your message here..." style="width: 100%; box-sizing: border-box; margin: 0; border-radius: 10px;"></textarea>',
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: "Blast to All Users",
    confirmButtonColor: "#10b981",
    preConfirm: () => {
      const title = document.getElementById("swal-title").value;
      const msg = document.getElementById("swal-msg").value;
      if (!title || !msg) {
        Swal.showValidationMessage("Title and Message are required!");
        return false;
      }
      return { title: title, message: msg };
    },
  });
  if (formValues && formValues.title && formValues.message) {
    try {
      const res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ ...formValues, sender: "admin" }),
      });
      const data = await res.json();
      if (data.success) {
        Swal.fire(
          "Sent!",
          `Broadcast delivered to ${data.count} accounts.`,
          "success",
        );
        loadData();
      } else Swal.fire("Error!", "Failed to send broadcast.", "error");
    } catch (error) {
      Swal.fire("Error!", "Connection issue.", "error");
    }
  }
}

async function loadBroadcastHistory() {
  const res = await fetch("/api/users", { headers: getAuthHeaders() });
  const users = await res.json();
  let allNotifications = [];
  users.forEach((u) => {
    if (u.notifications)
      allNotifications.push(
        ...u.notifications.filter((n) => n.sender === "admin"),
      );
  });
  const uniqueNotifications = Array.from(
    new Map(allNotifications.map((n) => [n.id, n])).values(),
  );
  const list = document.getElementById("broadcastList");
  list.innerHTML = "";
  uniqueNotifications
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .forEach((n) => {
      list.innerHTML += `<tr style="border-bottom: 1px solid var(--border);"><td style="color:var(--text-muted); font-size: 0.85rem;"><i class="fa-regular fa-clock" style="margin-right: 5px;"></i> ${n.date}</td><td style="font-weight:600; color:var(--text-main);">${n.title}</td><td style="color:var(--text-muted); font-size: 0.9rem;">${n.message}</td><td style="text-align: right;"><button onclick="deleteBroadcast('${n.id}')" class="btn-action btn-delete" style="width: auto; padding: 0 15px; background: #fee2e2; color: #ef4444;"><i class="fa-solid fa-trash-can" style="margin-right: 5px;"></i> Recall</button></td></tr>`;
    });
}

async function deleteBroadcast(notifId) {
  const result = await Swal.fire({
    title: "Recall Broadcast?",
    text: "This will delete the message from all users' inboxes.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#ef4444",
    confirmButtonText: "Recall",
  });
  if (result.isConfirmed) {
    const res = await fetch("/api/admin/delete-broadcast", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ notifId }),
    });
    const data = await res.json();
    if (data.success) {
      Swal.fire("Recalled", "Message removed.", "success");
      loadBroadcastHistory();
    }
  }
}

// ========================================================================
// 🧑‍💼 SECTION 6 ADMIN ACCOUNTS MANAGEMENT
// ========================================================================
async function loadAdminList() {
  if (adminRole !== "super_admin") return;
  try {
    const res = await fetch("/api/admin/list-admins", {
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (data.success) {
      const tbody = document.getElementById("adminTableBody");
      if (!data.admins || data.admins.length === 0) {
        tbody.innerHTML =
          '<tr><td colspan="5" style="text-align: center; padding: 20px; color: var(--text-muted);">គ្មានទិន្នន័យបុគ្គលិក</td></tr>';
        return;
      }
      tbody.innerHTML = data.admins
        .map((a) => {
          let displayRole =
            a.role === "custom" && a.permissions?.customRoleName
              ? a.permissions.customRoleName
              : a.role || "support_agent";
          return `<tr><td style="font-weight: 600;">@${a.username}</td><td><span style="background: #e0f2fe; color: #0284c7; padding: 4px 10px; border-radius: 8px; font-size: 0.8rem; font-weight: bold;">${displayRole.toUpperCase()}</span></td><td style="font-family: monospace; font-size: 0.9rem;">${a.permissions?.workStart || "00:00"} - ${a.permissions?.workEnd || "23:59"}</td><td>${new Date(a.createdAt).toLocaleDateString()}</td><td style="text-align: right;"><button class="btn-action btn-edit" onclick="openAdminModal('${a._id}', '${a.username}', '${a.role}')"><i class="fa-solid fa-pen"></i></button>${a.username !== "admin" ? `<button class="btn-action btn-delete" onclick="deleteAdminAcc('${a._id}')"><i class="fa-solid fa-trash"></i></button>` : ""}</td></tr>`;
        })
        .join("");
    }
  } catch (e) {}
}
setTimeout(loadAdminList, 1000);

function toggleCustomPermissions(role) {
  const customBox = document.getElementById("customPermissionBox");
  const customInput = document.getElementById("customRoleInputGroup");
  if (role === "custom") {
    customBox.style.display = "block";
    customInput.style.display = "block";
  } else {
    customBox.style.display = "none";
    customInput.style.display = "none";
  }
}

function openAdminModal(id = "", username = "", role = "support_agent") {
  document.getElementById("manageAdminId").value = id;
  document.getElementById("manageAdminUser").value = username;
  document.getElementById("manageAdminPass").value = "";
  document.getElementById("manageAdminRole").value = role;
  toggleCustomPermissions(role);
  document.getElementById("adminModalTitle").innerText = id
    ? "កែប្រែគណនីបុគ្គលិក"
    : "បន្ថែមបុគ្គលិកថ្មី";
  document
    .getElementById("adminAccModal")
    .style.setProperty("display", "flex", "important");
}

async function saveAdminAccount() {
  const id = document.getElementById("manageAdminId").value;
  const role = document.getElementById("manageAdminRole").value;
  const permissions = {
    customRoleName: document.getElementById("customRoleName").value,
    workStart: document.getElementById("permWorkStart").value,
    workEnd: document.getElementById("permWorkEnd").value,
    menus: {
      users: document.getElementById("p_users").checked,
      checktrx: document.getElementById("p_checktrx").checked,
      broadcast: document.getElementById("p_broadcast").checked,
      fx: document.getElementById("p_fx").checked,
      cards: document.getElementById("p_cards").checked,
      kyc: document.getElementById("p_kyc").checked,
      tickets: document.getElementById("p_tickets").checked,
      chat: document.getElementById("p_chat").checked,
    },
    actions: {
      editUser: document.getElementById("p_edit_user").checked,
      deleteUser: document.getElementById("p_delete_user").checked,
      freezeUser: document.getElementById("p_freeze_user").checked,
      adjustBal: document.getElementById("p_adjust_bal").checked,
      refund: document.getElementById("p_refund").checked,
    },
  };
  const payload = {
    id,
    username: document.getElementById("manageAdminUser").value,
    password: document.getElementById("manageAdminPass").value,
    role,
    permissions,
  };
  const res = await fetch("/api/admin/save-admin", {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (data.success) {
    Swal.fire("ជោគជ័យ!", data.message, "success");
    closeModal("adminAccModal");
    loadAdminList();
  } else Swal.fire("បរាជ័យ", data.message, "error");
}

async function deleteAdminAcc(id) {
  const confirm = await Swal.fire({
    title: "លុបគណនីនេះ?",
    icon: "warning",
    showCancelButton: true,
  });
  if (confirm.isConfirmed) {
    const res = await fetch("/api/admin/delete-admin", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ id }),
    });
    const data = await res.json();
    if (data.success) {
      Swal.fire("លុបរួចរាល់", "", "success");
      loadAdminList();
    }
  }
}

// ========================================================================
// 🛡️ SECTION 8: ADMIN AUDIT LOGS (Pagination & Filters)
// ========================================================================
let allAuditLogs = [];
let filteredAuditLogs = [];
let currentLogPage = 1;
const LOGS_PER_PAGE = 15;

async function loadAdminLogs() {
  if (adminRole !== "super_admin") return;
  try {
    const res = await fetch("/api/admin/logs", { headers: getAuthHeaders() });
    const data = await res.json();
    if (data.success && data.logs && data.logs.length > 0) {
      allAuditLogs = data.logs;
      applyLogFilters();
    } else {
      allAuditLogs = [];
      filteredAuditLogs = [];
      document.getElementById("logsTableBody").innerHTML =
        '<tr><td colspan="5" style="text-align: center; padding: 20px; color: var(--text-muted);">គ្មានប្រវត្តិសកម្មភាពទេ</td></tr>';
      document.getElementById("logPageInfo").innerText = "ទំព័រទី 1 / 0";
    }
  } catch (e) {
    console.error("Error loading logs:", e);
  }
}

function applyLogFilters() {
  const filterDate = document.getElementById("filterLogDate").value;
  const filterAdmin = document
    .getElementById("filterLogAdmin")
    .value.toLowerCase()
    .trim();
  const filterAction = document
    .getElementById("filterLogAction")
    .value.toLowerCase()
    .trim();

  filteredAuditLogs = allAuditLogs.filter((log) => {
    let matchDate = true;
    if (filterDate) {
      const [year, month, day] = filterDate.split("-");
      const format1 = `${year}-${month}-${day}`;
      const format2 = `${day}/${month}/${year}`;
      matchDate = log.date.includes(format1) || log.date.includes(format2);
    }
    const matchAdmin =
      !filterAdmin ||
      (log.admin && log.admin.toLowerCase().includes(filterAdmin));
    const matchAction =
      !filterAction ||
      (log.action && log.action.toLowerCase().includes(filterAction));
    return matchDate && matchAdmin && matchAction;
  });

  currentLogPage = 1;
  renderAuditLogs();
}

function renderAuditLogs() {
  const tbody = document.getElementById("logsTableBody");
  if (filteredAuditLogs.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="5" style="text-align: center; padding: 20px; color: var(--text-muted);">រកមិនឃើញទិន្នន័យដែលអ្នកស្វែងរកទេ</td></tr>';
    document.getElementById("logPageInfo").innerText = "ទំព័រទី 1 / 0";
    document.getElementById("btnPrevLogs").disabled = true;
    document.getElementById("btnNextLogs").disabled = true;
    return;
  }
  const totalPages = Math.ceil(filteredAuditLogs.length / LOGS_PER_PAGE);
  const startIndex = (currentLogPage - 1) * LOGS_PER_PAGE;
  const endIndex = startIndex + LOGS_PER_PAGE;
  const logsToShow = filteredAuditLogs.slice(startIndex, endIndex);

  tbody.innerHTML = logsToShow
    .map(
      (l) =>
        `<tr><td style="font-size: 0.85rem; color: var(--text-muted);"><i class="fa-regular fa-clock"></i> ${l.date}</td><td style="font-weight: bold; color: var(--primary);">@${l.admin}</td><td><span style="background: #f1f5f9; color: var(--primary); padding: 4px 10px; border-radius: 6px; font-size: 0.85rem; font-weight: 600;">${l.action}</span></td><td style="font-family: monospace; font-size: 0.95rem;">${l.target || "-"}</td><td style="color: var(--text-muted); font-size: 0.9rem;">${l.details || "-"}</td></tr>`,
    )
    .join("");
  document.getElementById("logPageInfo").innerText =
    `ទំព័រទី ${currentLogPage} / ${totalPages}`;
  document.getElementById("btnPrevLogs").disabled = currentLogPage === 1;
  document.getElementById("btnNextLogs").disabled =
    currentLogPage === totalPages;
}

function changeLogPage(step) {
  const totalPages = Math.ceil(filteredAuditLogs.length / LOGS_PER_PAGE);
  currentLogPage += step;
  if (currentLogPage < 1) currentLogPage = 1;
  if (currentLogPage > totalPages) currentLogPage = totalPages;
  renderAuditLogs();
}
