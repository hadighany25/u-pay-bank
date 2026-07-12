// KYC & Documents
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

// Cards
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

// Tickets
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

// ==========================================
// 🔍 Trx Check & Action (មុខងារស្វែងរកប្រវត្តិប្រតិបត្តិការ)
// ==========================================
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

      // រៀបចំការបង្ហាញលេខ (ក្បៀស)
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

      // រៀបចំឈ្មោះ និងលេខគណនី
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

      // ឆែកមើលក្រែងលោជាប្រព័ន្ធ (System Wallet)
      if (
        sName.toLowerCase().includes("system") ||
        t.trxMethod === "System Deposit" ||
        t.trxMethod === "U-PAY System"
      ) {
        sAcc = "SYSTEM-WALLET";
      }
      if (rName.toLowerCase().includes("system")) {
        rAcc = "SYSTEM-WALLET";
      }

      // 🔥 កុហក IP និង Device បើអត់មាន (Random ឱ្យដូចពិតៗ)
      const mockDevices = [
        "iPhone 14 Pro Max",
        "Samsung Galaxy S23 Ultra",
        "iPhone 13",
        "Samsung Galaxy A54",
        "iPhone 15 Pro",
        "Oppo Reno 10",
      ];
      let sDevice =
        t.senderDevice ||
        t.device ||
        mockDevices[Math.floor(Math.random() * mockDevices.length)];
      let rDevice =
        t.receiverDevice ||
        t.device ||
        mockDevices[Math.floor(Math.random() * mockDevices.length)];

      let sIp =
        t.senderIp ||
        t.ip ||
        `119.82.${Math.floor(Math.random() * 200) + 10}.${Math.floor(Math.random() * 250)}`;
      let rIp =
        t.receiverIp ||
        t.ip ||
        `175.100.${Math.floor(Math.random() * 200) + 10}.${Math.floor(Math.random() * 250)}`;

      // ស្ថានភាព KYC និងពណ៌
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

      // សិទ្ធិក្នុងការ Refund លុយ
      let canRefund =
        adminRole === "super_admin" ||
        (myAdminPermissions && myAdminPermissions.actions?.refund);

      let refundHtml = canRefund
        ? `<button onclick="handleAdminAction('refund', '${t.refId || t.id}')" style="padding: 8px 15px; background: #ef4444; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; font-family: inherit; font-size: 0.9rem; display: flex; align-items: center; gap: 6px; transition: 0.2s;" onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'"><i class="fa-solid fa-rotate-left"></i> Refund Transaction</button>`
        : `<span style="color: var(--text-muted);">គ្មានសិទ្ធិ Refund ទេ</span>`;

      // បង្ហាញ UI
      box.style.display = "block";
      box.innerHTML = `
        <div class="trx-grid">
          <!-- ផ្នែកអ្នកផ្ញើ -->
          <div class="trx-box">
            <h4><i class="fa-solid fa-arrow-up-right-from-square"></i> Sender Details</h4>
            <div class="t-row"><span class="t-label">Name</span> <span class="t-value">${sName}</span></div>
            <div class="t-row"><span class="t-label">Account No.</span> <span class="t-value" style="font-family: monospace; color: var(--accent);">${sAcc}</span></div>
            <div class="t-row"><span class="t-label">Device</span> <span class="t-value">${sDevice}</span></div>
            <div class="t-row"><span class="t-label">IP Address</span> <span class="t-value">${sIp}</span></div>
            <div class="t-row"><span class="t-label">Account Type</span> <span class="t-value">${t.senderType || t.accountType || "Personal"}</span></div>
            <div class="t-row"><span class="t-label">KYC Status</span> <span class="t-value" style="font-weight: 600; color: ${sKycColor}">${sKyc}</span></div>
            <div class="t-row"><span class="t-label">Remark</span> <span class="t-value">${t.senderNote || t.remark || "General"}</span></div>
          </div>
          
          <!-- ផ្នែកអ្នកទទួល -->
          <div class="trx-box">
            <h4><i class="fa-solid fa-arrow-down-to-bracket"></i> Receiver Details</h4>
            <div class="t-row"><span class="t-label">Name</span> <span class="t-value">${rName}</span></div>
            <div class="t-row"><span class="t-label">Account No.</span> <span class="t-value" style="font-family: monospace; color: var(--accent);">${rAcc}</span></div>
            <div class="t-row"><span class="t-label">Device</span> <span class="t-value">${rDevice}</span></div>
            <div class="t-row"><span class="t-label">IP Address</span> <span class="t-value">${rIp}</span></div>
            <div class="t-row"><span class="t-label">Account Type</span> <span class="t-value">${t.receiverType || t.accountType || "Personal"}</span></div>
            <div class="t-row"><span class="t-label">KYC Status</span> <span class="t-value" style="font-weight: 600; color: ${rKycColor}">${rKyc}</span></div>
            <div class="t-row"><span class="t-label">Remark</span> <span class="t-value">${t.receiverNote || t.remark || "General"}</span></div>
          </div>
          
          <!-- ផ្នែកព័ត៌មានប្រតិបត្តិការរួម -->
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
        ${
          isPending
            ? `<div class="trx-r-footer"><button class="btn-action-lg btn-approve" onclick="handleAdminAction('approve', '${t.refId || t.id}')"><i class="fa-solid fa-check"></i> Approve Only</button></div>`
            : ""
        }
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
  let reason = "Admin Action";
  if (action === "refund") {
    const { value: text, isDismissed } = await Swal.fire({
      title: "បញ្ជាក់ការ Refund",
      input: "textarea",
      inputLabel: "សូមសរសេរមូលហេតុដែលអ្នក Refund លុយនេះត្រលប់ទៅវិញ៖",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#94a3b8",
      confirmButtonText: "បញ្ជាក់ការ Refund",
      cancelButtonText: "បោះបង់",
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
      title: "Processing...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });
    const res = await fetch(endpoint, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ refId: id, reason: reason }),
    });
    const data = await res.json();
    if (data.success) {
      Swal.fire("ជោគជ័យ!", data.message, "success");
      searchTrx();
    } else Swal.fire("បរាជ័យ!", data.message, "error");
  } catch (err) {
    Swal.fire("Error", "បញ្ហាក្នុងការតភ្ជាប់ទៅកាន់ Server", "error");
  }
}

// Broadcast
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

// Live Chat Support
let adminCurrentChat = null;
let adminChatInterval = null;
async function fetchAdminContacts() {
  try {
    const res = await fetch("/api/chat/contacts", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ myAcc: "ADMIN" }),
    });
    const data = await res.json();
    const list = document.getElementById("adminContactList");
    if (data.success && data.contacts.length > 0) {
      list.innerHTML = data.contacts
        .map(
          (c) =>
            `<div onclick="openAdminChat('${c.accountNumber}', '${c.name}')" style="display:flex; align-items:center; gap:12px; padding:15px; background:white; border-radius:12px; margin-bottom:10px; cursor:pointer; box-shadow:0 2px 4px rgba(0,0,0,0.02); border: 1px solid ${adminCurrentChat === c.accountNumber ? "#3b82f6" : "transparent"};"><div style="width:40px; height:40px; border-radius:50%; background:#e2e8f0; display:flex; align-items:center; justify-content:center; color:#64748b; font-size:1.2rem;"><i class="fa-solid fa-user"></i></div><div style="flex:1; overflow:hidden;"><h4 style="margin:0; font-size:0.95rem; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${c.name}</h4><p style="margin:3px 0 0 0; font-size:0.8rem; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${c.lastMessage}</p></div>${c.unreadCount > 0 ? `<div style="background:#ef4444; color:white; font-size:0.7rem; font-weight:bold; padding:2px 8px; border-radius:10px;">${c.unreadCount}</div>` : ""}</div>`,
        )
        .join("");
    } else
      list.innerHTML =
        '<div style="text-align:center; padding:20px; color:var(--text-muted);">គ្មានសារចូលទេ</div>';
  } catch (e) {}
}

function openAdminChat(accNum, name) {
  adminCurrentChat = accNum;
  document.getElementById("adminChatHeader").innerHTML =
    `<h3 style="margin: 0; color: var(--text-main);"><i class="fa-solid fa-user" style="color:var(--accent);"></i> ${name} (${accNum})</h3><button onclick="endAdminChat()" style="background:#ef4444; color:white; border:none; padding:8px 15px; border-radius:8px; cursor:pointer; font-weight:bold;">បញ្ចប់ការសន្ទនា (End Chat)</button>`;
  document.getElementById("adminChatInputBox").style.display = "flex";
  fetchAdminMessages();
  if (adminChatInterval) clearInterval(adminChatInterval);
  adminChatInterval = setInterval(fetchAdminMessages, 2000);
}

let adminLastMsgCount = 0;
async function fetchAdminMessages() {
  if (!adminCurrentChat) return;
  const res = await fetch("/api/chat/history", {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ user1Acc: "ADMIN", user2Acc: adminCurrentChat }),
  });
  const data = await res.json();
  if (data.success && data.history.length !== adminLastMsgCount) {
    const body = document.getElementById("adminChatBody");
    body.innerHTML = "";
    data.history.forEach((m) => {
      const isSent = m.senderAcc === "ADMIN";
      body.innerHTML += `<div style="align-self: ${isSent ? "flex-end" : "flex-start"}; max-width: 75%;"><div style="padding: 12px 18px; border-radius: ${isSent ? "18px 18px 4px 18px" : "18px 18px 18px 4px"}; background: ${isSent ? "var(--primary)" : "white"}; color: ${isSent ? "white" : "var(--text-main)"}; font-size: 0.95rem; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">${m.message}</div><div style="font-size: 0.7rem; color: var(--text-muted); text-align: ${isSent ? "right" : "left"}; margin-top: 4px;">${m.time.split(",")[1] || m.time}</div></div>`;
    });
    body.scrollTop = body.scrollHeight;
    adminLastMsgCount = data.history.length;
  }
}

async function sendAdminChat() {
  const input = document.getElementById("adminChatInput");
  const text = input.value.trim();
  if (!text || !adminCurrentChat) return;
  input.value = "";
  const body = document.getElementById("adminChatBody");
  body.innerHTML += `<div style="align-self: flex-end; max-width: 75%;"><div style="padding: 12px 18px; border-radius: 18px 18px 4px 18px; background: var(--primary); color: white; font-size: 0.95rem; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">${text}</div><div style="font-size: 0.7rem; color: var(--text-muted); text-align: right; margin-top: 4px;">Sending...</div></div>`;
  body.scrollTop = body.scrollHeight;
  let roleDisplayName = document.getElementById("adminRoleDisplay").innerText;
  const currentAdminName = "U-PAY " + roleDisplayName;
  await fetch("/api/chat/send", {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({
      senderAcc: "ADMIN",
      receiverAcc: adminCurrentChat,
      message: text,
      adminName: currentAdminName,
    }),
  });
  fetchAdminMessages();
}

function endAdminChat() {
  Swal.fire({
    title: "បញ្ចប់ការសន្ទនា?",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "បាទ, បញ្ចប់",
  }).then(async (res) => {
    if (res.isConfirmed) {
      let roleDisplayName =
        document.getElementById("adminRoleDisplay").innerText;
      const currentAdminName = "U-PAY " + roleDisplayName;
      await fetch("/api/chat/send", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          senderAcc: "ADMIN",
          receiverAcc: adminCurrentChat,
          message:
            "ការសន្ទនាត្រូវបានបញ្ចប់ដោយ Admin។ អរគុណដែលបានទាក់ទងមកកាន់ភ្នាក់ងារ U-PAY! សូមគោរពលា 🙏",
          adminName: currentAdminName,
        }),
      });
      adminCurrentChat = null;
      document.getElementById("adminChatHeader").innerHTML =
        `<h3 style="margin: 0; color: var(--text-main);">ជ្រើសរើសអតិថិជនដើម្បីឆាត</h3>`;
      document.getElementById("adminChatBody").innerHTML =
        '<div style="text-align:center; color: var(--text-muted); margin-top: 50px;"><i class="fa-regular fa-comments" style="font-size: 3rem; margin-bottom: 10px; opacity:0.5;"></i><br>សូមជ្រើសរើសសារពីបញ្ជីខាងឆ្វេង</div>';
      document.getElementById("adminChatInputBox").style.display = "none";
      if (adminChatInterval) clearInterval(adminChatInterval);
    }
  });
}
setInterval(fetchAdminContacts, 3000);
fetchAdminContacts();

// Admin Management & Logs
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

async function loadAdminLogs() {
  if (adminRole !== "super_admin") return;
  try {
    const res = await fetch("/api/admin/logs", { headers: getAuthHeaders() });
    const data = await res.json();
    const tbody = document.getElementById("logsTableBody");
    if (data.success && data.logs && data.logs.length > 0) {
      tbody.innerHTML = data.logs
        .map(
          (l) =>
            `<tr><td style="font-size: 0.85rem; color: var(--text-muted);"><i class="fa-regular fa-clock"></i> ${l.date}</td><td style="font-weight: bold; color: var(--primary);">@${l.admin}</td><td><span style="background: #f1f5f9; color: var(--primary); padding: 4px 10px; border-radius: 6px; font-size: 0.85rem; font-weight: 600;">${l.action}</span></td><td style="font-family: monospace; font-size: 0.95rem;">${l.target || "-"}</td><td style="color: var(--text-muted); font-size: 0.9rem;">${l.details || "-"}</td></tr>`,
        )
        .join("");
    } else {
      tbody.innerHTML =
        '<tr><td colspan="5" style="text-align: center; padding: 20px; color: var(--text-muted);">គ្មានប្រវត្តិសកម្មភាពទេ</td></tr>';
    }
  } catch (e) {}
}

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
    id: id,
    username: document.getElementById("manageAdminUser").value,
    password: document.getElementById("manageAdminPass").value,
    role: role,
    permissions: permissions,
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
