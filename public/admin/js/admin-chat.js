// admin-chat.js

// ========================================================================
// 💬 SECTION: LIVE CHAT SUPPORT MANAGEMENT (Cleaned & Updated)
// ========================================================================
let adminCurrentChat = null;
let adminChatInterval = null;
let adminLastMsgCount = 0;

// 🟢 ជំនួយការ៖ ទាញយក Nickname ឬឈ្មោះប្រើប្រាស់ពី Session
function getAdminDisplayInfo() {
  const nickname = sessionStorage.getItem("adminNickname") || "Support Agent";
  const fullName = sessionStorage.getItem("adminFullName") || "U-PAY Admin";
  return { nickname, fullName };
}

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
          let moodEmoji =
            c.sentiment === "angry"
              ? "😡"
              : c.sentiment === "happy"
                ? "😍"
                : "😐";

          let statusBadge =
            c.status === "urgent"
              ? `<span style="background:#ef4444; color:white; font-size:0.6rem; padding:2px 6px; border-radius:4px; margin-left:5px; font-weight:bold;">បន្ទាន់ 🚨</span>`
              : c.status === "resolved"
                ? `<span style="background:#10b981; color:white; font-size:0.6rem; padding:2px 6px; border-radius:4px; margin-left:5px; font-weight:bold;">ដោះស្រាយរួច ✅</span>`
                : `<span style="background:#f59e0b; color:white; font-size:0.6rem; padding:2px 6px; border-radius:4px; margin-left:5px; font-weight:bold;">រង់ចាំ ⏳</span>`;

          return `
            <div onclick="openAdminChat('${c.accountNumber}', '${c.name}', '${c.status}')" 
                 class="chat-contact-item ${isSelected ? "active" : ""}" 
                 style="display: flex; align-items: center; gap: 12px; cursor: pointer; padding: 12px 14px; margin-bottom: 8px; border-radius: 10px; background-color: ${isSelected ? "rgba(255, 255, 255, 0.1)" : "transparent"}; border: 1px solid rgba(255, 255, 255, 0.05);">
              <div style="min-width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: rgba(255,255,255,0.08); font-size: 1.2rem;">${moodEmoji}</div>
              <div style="flex:1; overflow:hidden;">
                <h4 style="margin: 0; font-size: 0.95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-family: 'Inter', sans-serif;">
                  ${c.name} ${statusBadge}
                </h4>
                <p style="margin: 4px 0 0 0; font-size: 0.8rem; color: #94a3b8; font-family: 'Kantumruy Pro', sans-serif;">${c.lastMessage}</p>
              </div>
              ${c.unreadCount > 0 ? `<div style="background:#ef4444; color:white; font-size:0.7rem; font-weight:bold; padding:2px 8px; border-radius:10px;">${c.unreadCount}</div>` : ""}
            </div>`;
        })
        .join("");
    } else {
      list.innerHTML =
        '<div style="text-align:center; padding:20px; color:var(--text-muted);">No incoming messages</div>';
    }
  } catch (e) {
    console.error("Error fetching contacts:", e);
  }
}

function openAdminChat(accNum, name, currentStatus = "pending") {
  adminCurrentChat = accNum;

  // 🟢 ដាក់ប្រអប់ Select Status មកវិញ នៅក្បែរឈ្មោះអតិថិជនយ៉ាងស្អាត
  document.getElementById("adminChatHeader").innerHTML = `
    <div style="display:flex; align-items:center; gap: 15px; width: 100%; justify-content: space-between;">
      <div style="display:flex; align-items:center; gap: 10px;">
        <h3 style="margin: 0; color: var(--text-main); font-family: 'Inter', sans-serif; font-size: 1.05rem;">
          <i class="fa-solid fa-user" style="color:var(--accent);"></i> ${name} 
          <span style="font-size: 0.85rem; color: var(--text-muted); font-weight: normal;">(${accNum})</span>
        </h3>
        <select onchange="updateChatStatus('${accNum}', this.value)" style="padding: 5px 10px; background: var(--input-bg, rgba(255,255,255,0.1)); color: var(--text-main, white); border: 1px solid var(--border, rgba(255,255,255,0.2)); border-radius: 8px; font-size: 0.85rem; outline: none; cursor: pointer; font-family: 'Kantumruy Pro', sans-serif;">
          <option value="pending" ${currentStatus === "pending" ? "selected" : ""} style="color: black;">⏳ កំពុងរង់ចាំ</option>
          <option value="urgent" ${currentStatus === "urgent" ? "selected" : ""} style="color: black;">🚨 បន្ទាន់</option>
          <option value="resolved" ${currentStatus === "resolved" ? "selected" : ""} style="color: black;">✅ ដោះស្រាយរួច</option>
        </select>
      </div>
      <button onclick="endAdminChat()" class="btn-end-chat" style="font-family: 'Inter', sans-serif; display: flex; align-items: center; gap: 6px;"><i class="fa-solid fa-circle-xmark"></i> End Chat</button>
    </div>
  `;

  document.getElementById("adminChatInputBox").style.display = "flex";
  fetchAdminMessages();
  if (adminChatInterval) clearInterval(adminChatInterval);
  adminChatInterval = setInterval(fetchAdminMessages, 2000);
}

// 🟢 មុខងារបង្ហាញសារ (លុបអត្ថបទខាងលើចេញ និងប្តូរឈ្មោះ Admin ទៅកៀកខាងស្តាំក្រោមនៃប្រអប់សារ)
async function fetchAdminMessages() {
  if (!adminCurrentChat) return;
  const res = await fetch("/api/chat/history", {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ user1Acc: "ADMIN", user2Acc: adminCurrentChat }),
  });
  const data = await res.json();

  // ទាញយក Nickname របស់ Admin ផ្ទាល់ពី SessionStorage
  const myNickname =
    sessionStorage.getItem("adminNickname") ||
    sessionStorage.getItem("adminFullName") ||
    "Support Agent";

  if (data.success && data.history.length !== adminLastMsgCount) {
    const body = document.getElementById("adminChatBody");
    body.innerHTML = "";
    data.history.forEach((m) => {
      const isSent = m.senderAcc === "ADMIN";

      // ឈ្មោះ Admin ដែលត្រូវបង្ហាញ (បើគ្មាន m.adminName ប្រើ myNickname)
      const senderDisplay = isSent ? m.adminName || myNickname : "";

      body.innerHTML += `
        <div style="display: flex; flex-direction: column; align-items: ${isSent ? "flex-end" : "flex-start"}; margin-bottom: 10px;">
          <!-- ប្រអប់សារ (Bubble) -->
          <div style="max-width: 75%; padding: 12px 18px; border-radius: 18px; background: ${isSent ? "var(--primary)" : "var(--bg-body)"}; color: ${isSent ? "white" : "var(--text-main)"}; font-family: 'Kantumruy Pro'; word-break: break-word; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
            ${m.message}
          </div>
          
          <!-- ព័ត៌មានពេលម៉ោង និង ឈ្មោះ Admin อยู่ខាងស្តាំក្រោមប្រអប់សារ -->
          <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 3px; display: flex; gap: 8px; align-items: center; font-family: 'Inter', sans-serif;">
            <span>${m.time.split(",")[1] || m.time}</span>
            ${isSent ? `<span style="font-weight: 600; color: var(--accent);">${senderDisplay}</span>` : ""}
          </div>
        </div>`;
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

  // 🟢 យក Nickname ផ្ទាល់ខ្លួនរបស់ Admin ផ្ញើទៅជាមួយ
  const myNickname =
    sessionStorage.getItem("adminNickname") ||
    sessionStorage.getItem("adminFullName") ||
    "Support Agent";

  await fetch("/api/chat/send", {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({
      senderAcc: "ADMIN",
      receiverAcc: adminCurrentChat,
      message: text,
      adminName: myNickname, // 🟢 ផ្ញើ Nickname មិនឱ្យខុសទេ។
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
      // 🟢 យក Username ពិតប្រាកដសម្រាប់ពេលបញ្ចប់ឆាត
      let currentAdminName =
        localStorage.getItem("adminUsername") ||
        localStorage.getItem("username") ||
        "Admin";

      await fetch("/api/chat/send", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          senderAcc: "ADMIN",
          receiverAcc: adminCurrentChat,
          message:
            "Chat session ended by Admin. Thank you for contacting U-PAY Support! 🙏",
          adminName: currentAdminName, // 🟢 ផ្ញើឈ្មោះ Username ពិត
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
    "សួស្តីបង! តើមានអ្វីឱ្យភ្នាក់ងារ U-PAY យើងជួយបាន?",
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
  let lastUserText = lastUserMessageBlock.innerText;

  // 🛡️ មុននឹងបញ្ជូនទៅ AI, យើងត្រូវលាក់លេខទូរស័ព្ទ និងលេខគណនីចេញសិន
  lastUserText = lastUserText.replace(/\b\d{6,}\b/g, "[លេខត្រូវបានលាក់]");
  lastUserText = lastUserText.replace(
    /(0\d{2}[-\s]?\d{3}[-\s]?\d{3,4})/g,
    "[លេខទូរស័ព្ទត្រូវបានលាក់]",
  );

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
    // 🧠 ហៅ API ទៅកាន់ Backend របស់បង (បញ្ជូនសារដែលបានលាក់លេខសម្ងាត់រួច)
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
