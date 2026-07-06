// ==========================================
// BROADCAST & SUPPORT TICKETS
// ==========================================
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
// LIVE CHAT
// ==========================================
let adminCurrentChat = null;
let adminChatInterval = null;
let adminLastMsgCount = 0;
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
  const currentAdminName =
    "U-PAY " + document.getElementById("adminRoleDisplay").innerText;
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
      const currentAdminName =
        "U-PAY " + document.getElementById("adminRoleDisplay").innerText;
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

// Notifications
let previousTotalUnread = 0,
  previousQueueLength = 0,
  previousPendingKyc = 0,
  previousOpenTickets = 0,
  isFirstLoadNotif = true;
const chatSound = new Audio(
  "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3",
);
const kycSound = new Audio(
  "https://assets.mixkit.co/active_storage/sfx/2870/2870-preview.mp3",
);
const ticketSound = new Audio(
  "https://assets.mixkit.co/active_storage/sfx/2870/2870-preview.mp3",
);

async function checkAdminNotifications() {
  if (!window.location.href.includes("admin.html")) return;
  try {
    const [chatRes, userRes] = await Promise.all([
      fetch("/api/chat/contacts", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ myAcc: "ADMIN" }),
      }),
      fetch("/api/users", { headers: getAuthHeaders() }),
    ]);
    const chatData = await chatRes.json();
    const userData = await userRes.json();
    if (chatData.success && Array.isArray(userData)) {
      let currentTotalUnread = 0,
        currentQueueLength = chatData.contacts.length,
        currentPendingKyc = 0,
        currentOpenTickets = 0;
      chatData.contacts.forEach((c) => {
        currentTotalUnread += c.unreadCount;
      });
      userData.forEach((u) => {
        if (u.kycStatus === "pending") currentPendingKyc++;
        if (u.tickets && Array.isArray(u.tickets))
          u.tickets.forEach((t) => {
            if (t.status === "Open") currentOpenTickets++;
          });
      });
      if (!isFirstLoadNotif) {
        let shouldRefreshTable = false;
        if (currentQueueLength > previousQueueLength)
          playCustomNotif(
            "អតិថិជនថ្មី សុំជួបភ្នាក់ងារ! 👨‍💻",
            chatSound,
            "#0ea5e9",
          );
        else if (currentTotalUnread > previousTotalUnread)
          playCustomNotif("មានសារថ្មីពីអតិថិជន! 💬", chatSound, "#0ea5e9");
        if (currentPendingKyc > previousPendingKyc) {
          playCustomNotif(
            "មានសំណើផ្ទៀងផ្ទាត់ KYC ថ្មី! 🪪",
            kycSound,
            "#8b5cf6",
          );
          shouldRefreshTable = true;
        }
        if (currentOpenTickets > previousOpenTickets) {
          playCustomNotif(
            "មានសំបុត្រជំនួយ (Ticket) ថ្មី! 🎫",
            ticketSound,
            "#f59e0b",
          );
          shouldRefreshTable = true;
        }
        if (shouldRefreshTable && typeof loadData === "function") loadData();
      }
      previousQueueLength = currentQueueLength;
      previousTotalUnread = currentTotalUnread;
      previousPendingKyc = currentPendingKyc;
      previousOpenTickets = currentOpenTickets;
      isFirstLoadNotif = false;
    }
  } catch (e) {}
}
function playCustomNotif(message, soundObj, iconColorHex) {
  soundObj.play().catch(() => {});
  Swal.fire({
    toast: true,
    position: "top-end",
    icon: "info",
    title: message,
    showConfirmButton: false,
    timer: 4500,
    background: "#1e293b",
    color: "white",
    iconColor: iconColorHex,
    customClass: { popup: "premium-swal" },
  });
}
setInterval(checkAdminNotifications, 3000);

// ==========================================
// SYSTEM CONTROL & ADMIN MANAGEMENT
// ==========================================
async function toggleSystemFreeze() {
  try {
    const res = await fetch("/api/admin/system-status", {
      headers: getAuthHeaders(),
    });
    const sys = await res.json();
    const isCurrentlyFrozen = sys.isSystemFrozen;
    Swal.fire({
      title: isCurrentlyFrozen
        ? "បើកដំណើរការប្រព័ន្ធវិញ?"
        : "ផ្អាកប្រព័ន្ធទាំងមូល?",
      html: isCurrentlyFrozen
        ? "អតិថិជននឹងអាចធ្វើប្រតិបត្តិការវេរលុយ/ដកលុយបានធម្មតាវិញ។"
        : "អតិថិជនទាំងអស់នឹង <b>មិនអាច</b> ធ្វើប្រតិបត្តិការហិរញ្ញវត្ថុបានទេរហូតដល់អ្នកបើកវាវិញ!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: isCurrentlyFrozen ? "#10b981" : "#ef4444",
      cancelButtonColor: "#64748b",
      confirmButtonText: isCurrentlyFrozen ? "បាទ, បើកវិញ 🟢" : "បាទ, ផ្អាក 🛑",
      cancelButtonText: "បោះបង់",
    }).then(async (result) => {
      if (result.isConfirmed) {
        const toggleRes = await fetch("/api/admin/toggle-system", {
          method: "POST",
          headers: getAuthHeaders(),
        });
        const toggleData = await toggleRes.json();
        if (toggleData.success)
          Swal.fire({
            title: toggleData.isSystemFrozen
              ? "ប្រព័ន្ធត្រូវបានផ្អាក! 🛑"
              : "ប្រព័ន្ធដំណើរការធម្មតា! 🟢",
            text: toggleData.isSystemFrozen
              ? "រាល់ប្រតិបត្តិការត្រូវបាន Block ទាំងស្រុង។"
              : "អតិថិជនអាចប្រើប្រាស់បានវិញហើយ។",
            icon: "success",
            background: "#1e293b",
            color: "white",
          });
      }
    });
  } catch (e) {}
}

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
    } else
      tbody.innerHTML =
        '<tr><td colspan="5" style="text-align: center; padding: 20px; color: var(--text-muted);">គ្មានប្រវត្តិសកម្មភាពទេ</td></tr>';
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
  const payload = {
    id: document.getElementById("manageAdminId").value,
    username: document.getElementById("manageAdminUser").value,
    password: document.getElementById("manageAdminPass").value,
    role: document.getElementById("manageAdminRole").value,
    permissions: {
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
    },
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
setTimeout(loadAdminList, 1000);
