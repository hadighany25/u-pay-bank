// admin-chat.js
// ========================================================================
// 💬 SECTION: LIVE CHAT SUPPORT MANAGEMENT
// ========================================================================
let adminCurrentChat = null;
let adminChatInterval = null;

// ទាញយកបញ្ជីអ្នកដែលបានឆាតមក (Contact List)
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
        .map((c) => {
          let isSelected = adminCurrentChat === c.accountNumber;

          // 🟢 ប្រើ style ផ្ទាល់ខ្លះៗការពារកុំឱ្យបែករាង (Fix Broken Flexbox Layout)
          return `<div onclick="openAdminChat('${c.accountNumber}', '${c.name}')" class="chat-contact-item ${isSelected ? "active" : ""}" style="display: flex; align-items: center; gap: 12px; cursor: pointer;">
            <div class="chat-contact-avatar" style="min-width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border-radius: 50%;"><i class="fa-solid fa-user"></i></div>
            <div style="flex:1; overflow:hidden;">
              <h4 class="chat-contact-name" style="margin: 0; font-size: 0.95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-family: 'Inter', sans-serif;">${c.name}</h4>
              <p class="chat-contact-msg" style="margin: 3px 0 0 0; font-size: 0.8rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-family: 'Kantumruy Pro', sans-serif;">${c.lastMessage}</p>
            </div>
            ${c.unreadCount > 0 ? `<div style="background:#ef4444; color:white; font-size:0.7rem; font-weight:bold; padding:2px 8px; border-radius:10px;">${c.unreadCount}</div>` : ""}
          </div>`;
        })
        .join("");
    } else {
      list.innerHTML =
        "<div style=\"text-align:center; padding:20px; color:var(--text-muted); font-family: 'Inter', sans-serif;\">No incoming messages</div>";
    }
  } catch (e) {}
}

function openAdminChat(accNum, name) {
  adminCurrentChat = accNum;
  // 🟢 ដូរអក្សរ "បញ្ចប់ការសន្ទនា" ទៅជា "End Chat" និងថែម Icon អោយស្អាត
  document.getElementById("adminChatHeader").innerHTML =
    `<h3 style="margin: 0; color: var(--text-main); font-family: 'Inter', sans-serif;"><i class="fa-solid fa-user" style="color:var(--accent);"></i> ${name} <span style="font-size: 0.9rem; color: var(--text-muted);">(${accNum})</span></h3>
     <button onclick="endAdminChat()" class="btn-end-chat" style="font-family: 'Inter', sans-serif; display: flex; align-items: center; gap: 6px;"><i class="fa-solid fa-circle-xmark"></i> End Chat</button>`;
  document.getElementById("adminChatInputBox").style.display = "flex";
  fetchAdminMessages();
  if (adminChatInterval) clearInterval(adminChatInterval);
  adminChatInterval = setInterval(fetchAdminMessages, 2000);
}

let adminLastMsgCount = 0;

// មុខងារទី១៖ ទាញយកសារមកបង្ហាញ
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
      let msgBg = isSent ? "var(--primary)" : "var(--bg-body, white)";
      let msgColor = isSent ? "white" : "var(--text-main)";

      // 🟢 ថែម word-break: break-word; overflow-wrap: break-word; និង white-space: pre-wrap; ត្រង់នេះ
      body.innerHTML += `<div style="align-self: ${isSent ? "flex-end" : "flex-start"}; max-width: 75%;">
        <div style="padding: 12px 18px; border-radius: ${isSent ? "18px 18px 4px 18px" : "18px 18px 18px 4px"}; background: ${msgBg}; color: ${msgColor}; font-size: 0.95rem; border: 1px solid var(--border); box-shadow: 0 1px 2px rgba(0,0,0,0.02); font-family: 'Kantumruy Pro', sans-serif; line-height: 1.5; word-break: break-word; overflow-wrap: break-word; white-space: pre-wrap;">${m.message}</div>
        <div style="font-size: 0.7rem; color: var(--text-muted); text-align: ${isSent ? "right" : "left"}; margin-top: 4px; font-family: 'Inter', sans-serif;">${m.time.split(",")[1] || m.time}</div>
      </div>`;
    });
    body.scrollTop = body.scrollHeight;
    adminLastMsgCount = data.history.length;
  }
}

// មុខងារទី២៖ ពេល Admin វាយបញ្ជូនសារ
async function sendAdminChat() {
  const input = document.getElementById("adminChatInput");
  const text = input.value.trim();
  if (!text || !adminCurrentChat) return;
  input.value = "";

  const body = document.getElementById("adminChatBody");
  // 🟢 ថែម word-break: break-word; overflow-wrap: break-word; និង white-space: pre-wrap; ត្រង់នេះដូចគ្នា
  body.innerHTML += `<div style="align-self: flex-end; max-width: 75%;">
    <div style="padding: 12px 18px; border-radius: 18px 18px 4px 18px; background: var(--primary); color: white; font-size: 0.95rem; box-shadow: 0 1px 2px rgba(0,0,0,0.05); font-family: 'Kantumruy Pro', sans-serif; line-height: 1.5; word-break: break-word; overflow-wrap: break-word; white-space: pre-wrap;">${text}</div>
    <div style="font-size: 0.7rem; color: var(--text-muted); text-align: right; margin-top: 4px; font-family: 'Inter', sans-serif;">Sending...</div>
  </div>`;
  body.scrollTop = body.scrollHeight;

  let roleDisplayName = document.getElementById("adminRoleDisplay").innerText;
  await fetch("/api/chat/send", {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({
      senderAcc: "ADMIN",
      receiverAcc: adminCurrentChat,
      message: text,
      adminName: "U-PAY " + roleDisplayName,
    }),
  });
  fetchAdminMessages();
}

function endAdminChat() {
  Swal.fire({
    title: "End this chat session?",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#ef4444",
    cancelButtonColor: "#94a3b8",
    confirmButtonText: "Yes, End Chat",
    cancelButtonText: "Cancel",
    customClass: { popup: "premium-swal" },
  }).then(async (res) => {
    if (res.isConfirmed) {
      let roleDisplayName =
        document.getElementById("adminRoleDisplay").innerText;
      await fetch("/api/chat/send", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          senderAcc: "ADMIN",
          receiverAcc: adminCurrentChat,
          message:
            "Chat session ended by Admin. Thank you for contacting U-PAY Support! 🙏",
          adminName: "U-PAY " + roleDisplayName,
        }),
      });
      adminCurrentChat = null;
      document.getElementById("adminChatHeader").innerHTML =
        `<h3 style="margin: 0; color: var(--text-main); font-family: 'Inter', sans-serif;">Select a customer to chat</h3>`;
      document.getElementById("adminChatBody").innerHTML =
        '<div style="text-align:center; color: var(--text-muted); margin-top: 50px;"><i class="fa-regular fa-comments" style="font-size: 3rem; margin-bottom: 10px; opacity:0.5;"></i><br><span style="font-family: \'Inter\', sans-serif;">Select a conversation from the left panel</span></div>';
      document.getElementById("adminChatInputBox").style.display = "none";
      if (adminChatInterval) clearInterval(adminChatInterval);
    }
  });
}

setInterval(fetchAdminContacts, 3000);
fetchAdminContacts();

// ========================================================================
// ⚡ មុខងារសាររហ័ស (QUICK REPLIES - Popover from Bottom)
// ========================================================================
function openQuickReplies() {
  const existingPopup = document.getElementById("quickRepliesPopover");
  if (existingPopup) {
    existingPopup.remove(); // បើចុចម្តងទៀតឱ្យវាបិទវិញ
    return;
  }

  const templates = [
    "សួស្តីបង! តើមានអ្វីឱ្យភ្នាក់ងារ U-PAY ជួយទេ?",
    "សូមរង់ចាំបន្តិច ប្អូនកំពុងត្រួតពិនិត្យទិន្នន័យជូន...",
    "ប្រតិបត្តិការរបស់បងត្រូវបានដោះស្រាយរួចរាល់ហើយ។",
    "សូមអភ័យទោសចំពោះភាពរអាក់រអួលនេះ។",
    "តើបងមានសំណួរ ឬចង់ឱ្យប្អូនជួយអ្វីបន្ថែមទៀតទេ?",
    "អរគុណដែលបានប្រើប្រាស់សេវាកម្ម U-PAY! សូមជូនពរឱ្យមានថ្ងៃល្អ។",
  ];

  const inputContainer = document.getElementById("adminChatInputBox");

  // បង្កើត Popover Element
  const popover = document.createElement("div");
  popover.id = "quickRepliesPopover";
  popover.className = "quick-replies-popover";

  let htmlContent = `
    <div style="font-size: 0.9rem; font-weight: bold; margin-bottom: 10px; color: var(--text-main); display: flex; align-items: center; gap: 6px;">
      <i class="fa-solid fa-bolt" style="color: #f59e0b;"></i> ជ្រើសរើសសាររហ័ស (Quick Replies)
    </div>
    <div style="display: flex; flex-direction: column; gap: 8px; max-height: 220px; overflow-y: auto;">
  `;

  templates.forEach((msg) => {
    htmlContent += `<button type="button" onclick="insertQuickReply('${msg}')" class="quick-reply-btn">${msg}</button>`;
  });
  htmlContent += `</div>`;

  popover.innerHTML = htmlContent;

  // យកទៅដាក់កៀកប្រអប់ Input ខាងក្រោម
  inputContainer.style.position = "relative";
  inputContainer.appendChild(popover);

  // ចុចក្រៅឱ្យបិទ
  document.addEventListener("click", function closePopover(e) {
    if (!popover.contains(e.target) && !e.target.closest(".btn-quick-reply")) {
      popover.remove();
      document.removeEventListener("click", closePopover);
    }
  });
}

window.insertQuickReply = function (msg) {
  const input = document.getElementById("adminChatInput");
  input.value = msg;
  const popover = document.getElementById("quickRepliesPopover");
  if (popover) popover.remove();
  input.focus();
};

function endAdminChat() {
  Swal.fire({
    title: "End this chat session?",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#ef4444",
    cancelButtonColor: "#94a3b8",
    confirmButtonText: "Yes, End Chat",
    cancelButtonText: "Cancel",
    customClass: { popup: "premium-swal" },
  }).then(async (res) => {
    if (res.isConfirmed) {
      let roleDisplayName =
        document.getElementById("adminRoleDisplay").innerText;

      // 🟢 ប្រើប្រាស់ Flow ចាស់របស់បង៖ គ្រាន់តែផ្ញើសារប្រាប់អតិថិជនពីការបញ្ចប់
      await fetch("/api/chat/send", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          senderAcc: "ADMIN",
          receiverAcc: adminCurrentChat,
          message:
            "ការសន្ទនាត្រូវបានបញ្ចប់ដោយ Admin។ អរគុណដែលបានទាក់ទងមកកាន់ភ្នាក់ងារ U-PAY! សូមគោរពលា 🙏",
          adminName: "U-PAY " + roleDisplayName,
        }),
      });

      // 🟢 កសាងអេក្រង់ Admin ឱ្យទំនេរវិញ
      adminCurrentChat = null;
      document.getElementById("adminChatHeader").innerHTML =
        `<h3 style="margin: 0; color: var(--text-main); font-family: 'Inter', sans-serif;">Select a customer to chat</h3>`;
      document.getElementById("adminChatBody").innerHTML =
        '<div style="text-align:center; color: var(--text-muted); margin-top: 50px;"><i class="fa-regular fa-comments" style="font-size: 3rem; margin-bottom: 10px; opacity:0.5;"></i><br><span style="font-family: \'Inter\', sans-serif;">Select a conversation from the left panel</span></div>';
      document.getElementById("adminChatInputBox").style.display = "none";
      if (adminChatInterval) clearInterval(adminChatInterval);
    }
  });
}

// ========================================================================
// 🤖 មុខងារ AI ជំនួយការឆ្លើយតប (AI SMART REPLY - REAL GEMINI API)
// ========================================================================
async function generateAIReply() {
  if (!adminCurrentChat) return;

  const chatBody = document.getElementById("adminChatBody");
  const userMessages = chatBody.querySelectorAll("div[style*='flex-start']");

  if (userMessages.length === 0) {
    Swal.fire({
      toast: true,
      position: "top-end",
      icon: "info",
      title: "គ្មានសារពីអតិថិជនដើម្បីឱ្យ AI វិភាគទេ!",
      showConfirmButton: false,
      timer: 2000,
      customClass: { popup: "premium-swal" },
    });
    return;
  }

  // ទាញយកសារចុងក្រោយរបស់អតិថិជន
  const lastUserMessageBlock = userMessages[userMessages.length - 1];
  const lastUserText = lastUserMessageBlock.innerText;

  // បង្ហាញ Loading ថា Gemini កំពុងគិត
  Swal.fire({
    title:
      '<div style="font-family: \'Kantumruy Pro\';"><i class="fa-solid fa-robot fa-bounce" style="color: #8b5cf6; font-size: 2.5rem; margin-bottom:10px;"></i><br>Gemini AI កំពុងគិត...</div>',
    text: "កំពុងរៀបចំចម្លើយយ៉ាងឆ្លាតវៃជូនអតិថិជន...",
    allowOutsideClick: false,
    showConfirmButton: false,
    background: "var(--bg-body, white)",
    color: "var(--text-main)",
    didOpen: () => {
      Swal.showLoading();
    },
    customClass: { popup: "premium-swal" },
  });

  try {
    // 🧠 ហៅ API ទៅកាន់ Backend របស់បង (ដែលភ្ជាប់ជាមួយ Gemini រួចរាល់)
    const res = await fetch("/api/admin/ai-reply", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ message: lastUserText }),
    });

    const data = await res.json();

    Swal.close();

    if (data.success && data.reply) {
      // យកចម្លើយពិតៗពី Gemini មកដាក់ក្នុងប្រអប់អក្សរអូតូ
      const inputField = document.getElementById("adminChatInput");
      inputField.value = data.reply;
      inputField.focus();
    } else {
      Swal.fire(
        "បរាជ័យ",
        data.reply || "មិនអាចទាញយកចម្លើយពី AI បានទេ",
        "error",
      );
    }
  } catch (error) {
    console.error("AI Request Error:", error);
    Swal.close();
    Swal.fire("Error", "មានបញ្ហាក្នុងការតភ្ជាប់ទៅកាន់ប្រព័ន្ធ AI", "error");
  }
}
