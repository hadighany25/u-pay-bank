// ============================================================================
// ឯកសារ: js/admin-chat.js (100% Dedicated Admin Backend & Strict Escalation Queue)
// អត្ថន័យ: ប្រើប្រាស់ /api/admin/chat/* សុទ្ធសាធ, ចាប់តាម User `_id`, បង្ហាញតែអ្នកសុំជួបភ្នាក់ងារ
// ស្តង់ដារថ្មី: ចាប់ទិន្នន័យអតិថិជនតាម MongoDB `_id` សុទ្ធសាធ + បង្ហាញឈ្មោះពេញ (fullName)
// ============================================================================

// ============================================================================
// 🔐 ជំពូកទី ១៖ អថេរសកល, អត្តសញ្ញាណមន្ត្រី ADMIN និងការភ្ជាប់ SOCKET (STATE & SOCKET INIT)
// ============================================================================
let adminCurrentPartnerId = null; // 🆔 MongoDB `_id` ពិតប្រាកដរបស់អតិថិជន
let adminCurrentPartnerAcc = ""; // លេខគណនីសម្រាប់បង្ហាញលើផ្លាក
let adminCurrentPartnerName = "";
let adminCurrentPartnerAvatar = "";
let adminChatInterval = null;
let adminLastMsgHash = "";
let adminCachedContacts = [];
let adminChatFilterStatus = "ACTIVE_QUEUE"; // "ACTIVE_QUEUE" | "urgent" | "pending" | "resolved" | "BOT_LOGS"
let resolvedAdminUsername = "";
let resolvedAdminFullName = "";
let prevEscalatedUnreadCount = -1;

/**
 * 🔹 ១.១ សំឡេងជូនដំណឹងស្រទន់ពេលមានអតិថិជនស្នើសុំជំនួយថ្មី
 */
function playAdminSupportAlertSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    osc.type = "sine";
    osc.frequency.setValueAtTime(523.25, now); // C5
    osc.frequency.setValueAtTime(783.99, now + 0.08); // G5
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.start(now);
    osc.stop(now + 0.25);
  } catch (e) {}
}

/**
 * 🔹 ១.២ ទាញយកឈ្មោះពេញ (Full Name) និងអត្តសញ្ញាណពិតប្រាកដរបស់មន្ត្រី Admin
 */
function decodeJwtAdminPayload() {
  try {
    const tk = sessionStorage.getItem("adminToken");
    if (!tk) return {};
    const base64Url = tk.split(".")[1];
    if (!base64Url) return {};
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(window.atob(base64)) || {};
  } catch (e) {
    return {};
  }
}

async function ensureAdminIdentityLoaded() {
  if (resolvedAdminFullName && resolvedAdminUsername) {
    return { username: resolvedAdminUsername, fullName: resolvedAdminFullName };
  }

  const jwtPayload = decodeJwtAdminPayload();
  const fromStorageUser =
    jwtPayload.username ||
    sessionStorage.getItem("adminUsername") ||
    localStorage.getItem("adminUsername") ||
    "";
  const fromStorageName =
    jwtPayload.fullName ||
    sessionStorage.getItem("adminFullName") ||
    document.getElementById("adminNameDisplay")?.innerText?.trim() ||
    "";

  if (fromStorageUser) resolvedAdminUsername = fromStorageUser;
  if (fromStorageName) resolvedAdminFullName = fromStorageName;

  if (!resolvedAdminFullName || !resolvedAdminUsername) {
    try {
      const res = await fetch("/api/admin/me", { headers: getAuthHeaders() });
      const data = await res.json();
      if (data.success && data.admin) {
        resolvedAdminUsername = data.admin.username || "admin";
        resolvedAdminFullName =
          data.admin.fullName ||
          data.admin.nickname ||
          "មន្ត្រីប្រតិបត្តិ U-Pay";
        sessionStorage.setItem("adminUsername", resolvedAdminUsername);
        sessionStorage.setItem("adminFullName", resolvedAdminFullName);
      }
    } catch (e) {}
  }

  return {
    username: resolvedAdminUsername || "admin",
    fullName: resolvedAdminFullName || "មន្ត្រីប្រតិបត្តិ U-Pay",
  };
}

function getAdminDisplayInfo() {
  const fullName =
    resolvedAdminFullName ||
    sessionStorage.getItem("adminFullName") ||
    document.getElementById("adminNameDisplay")?.innerText?.trim() ||
    "មន្ត្រីប្រតិបត្តិ U-Pay";
  const cleanName = String(fullName).replace(/^@/, "").trim();
  return {
    fullName: cleanName,
    label: cleanName,
  };
}

/**
 * 🔹 ១.៣ បម្លែងស្ថានភាព Online / សកម្មចុងក្រោយរបស់អតិថិជន
 */
function formatCustomerPresenceText(isOnline, lastActiveIso) {
  if (isOnline) return "🟢 កំពុងសកម្ម (Online)";
  if (!lastActiveIso) return "Offline";
  const diffMins = Math.floor(
    (Date.now() - new Date(lastActiveIso).getTime()) / 60000,
  );
  if (isNaN(diffMins) || diffMins < 0) return "Offline";
  if (diffMins < 2) return "🟢 ទើបតែសកម្មអម្បាញ់មិញ";
  if (diffMins < 60) return `សកម្ម ${diffMins} នាទីមុន`;
  const hrs = Math.floor(diffMins / 60);
  if (hrs < 24) return `សកម្ម ${hrs} ម៉ោងមុន`;
  return "Offline";
}

ensureAdminIdentityLoaded();

/**
 * 🔹 ១.៤ ភ្ជាប់ Socket.io សម្រាប់ទទួលសារថ្មី និងសញ្ញាធីក ២ (✓✓) ភ្លាមៗ
 */
try {
  if (typeof io === "function") {
    const adminSocket = io();
    adminSocket.on("new_chat_message", (msg) => {
      if (msg.needsSupport && msg.senderId !== "ADMIN") {
        playAdminSupportAlertSound();
      }
      fetchAdminContacts(false);
      if (adminCurrentPartnerId) {
        fetchAdminMessages();
      }
    });
    adminSocket.on("chat_messages_read", () => {
      if (adminCurrentPartnerId) {
        document.querySelectorAll(".admin-read-check").forEach((el) => {
          el.style.color = "#38bdf8";
          el.className = "fa-solid fa-check-double admin-read-check";
        });
      }
    });
  }
} catch (e) {}

// ============================================================================
// 📋 ជំពូកទី ២៖ ការទាញយកបញ្ជីអតិថិជនក្នុងជួររង់ចាំតាម `_id` (SUPPORT QUEUE BY `_id`)
// ============================================================================

/**
 * 🔹 ២.១ កំណត់តម្រងស្ថានភាពបញ្ជីសន្ទនា (ACTIVE_QUEUE, urgent, pending, resolved)
 */
window.setAdminChatFilter = function (filterKey) {
  adminChatFilterStatus = filterKey === "ALL" ? "ACTIVE_QUEUE" : filterKey;
  document.querySelectorAll(".achat-pill-btn").forEach((btn) => {
    const bf = btn.getAttribute("data-filter");
    btn.classList.toggle(
      "active",
      bf === filterKey || (filterKey === "ACTIVE_QUEUE" && bf === "ALL"),
    );
  });
  fetchAdminContacts(false);
};

/**
 * 🔹 ២.២ ទាញយកបញ្ជីអតិថិជនពី `/api/admin/chat/queue`
 */
async function fetchAdminContacts(showSpin = false) {
  const spin = document.getElementById("achat-refresh-spin");
  if (showSpin && spin) spin.classList.add("fa-spin");

  try {
    const res = await fetch("/api/admin/chat/queue", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        includeBotOnly: adminChatFilterStatus === "BOT_LOGS",
      }),
    });
    const data = await res.json();
    if (data.success && Array.isArray(data.contacts)) {
      adminCachedContacts = data.contacts;

      let totalUnread = 0;
      adminCachedContacts.forEach((c) => {
        if (c.needsSupport && c.unreadCount > 0) totalUnread += c.unreadCount;
      });
      if (
        prevEscalatedUnreadCount !== -1 &&
        totalUnread > prevEscalatedUnreadCount
      ) {
        playAdminSupportAlertSound();
      }
      prevEscalatedUnreadCount = totalUnread;

      renderAdminContactsList();
    }
  } catch (e) {
    console.error("Error fetching admin support queue:", e);
  } finally {
    if (showSpin && spin) {
      setTimeout(() => spin.classList.remove("fa-spin"), 350);
    }
  }
}

/**
 * 🔹 ២.៣ គូរតារាងឈ្មោះអតិថិជននៅរបារខាងឆ្វេងដោយចាប់តាម `partnerId` (`_id`) សុទ្ធសាធ!
 */
window.renderAdminContactsList = function () {
  const list = document.getElementById("adminContactList");
  if (!list) return;

  const kw = String(
    document.getElementById("adminChatSearchInput")?.value || "",
  )
    .toLowerCase()
    .trim();

  const activeSupportList = adminCachedContacts.filter((c) => c.needsSupport);
  const urgentCount = activeSupportList.filter(
    (c) => c.status === "urgent",
  ).length;
  const pendingCount = activeSupportList.filter(
    (c) => c.status === "pending",
  ).length;

  const setCnt = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.innerText = `(${val})`;
  };
  setCnt("achat-cnt-all", activeSupportList.length);
  setCnt("achat-cnt-urgent", urgentCount);
  setCnt("achat-cnt-pending", pendingCount);

  const filtered = adminCachedContacts.filter((c) => {
    if (
      adminChatFilterStatus === "ACTIVE_QUEUE" ||
      adminChatFilterStatus === "ALL"
    ) {
      if (!c.needsSupport) return false;
    } else if (adminChatFilterStatus === "urgent") {
      if (!c.needsSupport || c.status !== "urgent") return false;
    } else if (adminChatFilterStatus === "pending") {
      if (!c.needsSupport || c.status !== "pending") return false;
    } else if (adminChatFilterStatus === "resolved") {
      if (c.status !== "resolved") return false;
    }

    if (kw) {
      const idStr = String(c._id || c.partnerId || "").toLowerCase();
      const nameStr = String(c.fullName || c.name || "").toLowerCase();
      const accStr = String(c.accountNumber || "").toLowerCase();
      const msgStr = String(c.lastMessage || "").toLowerCase();
      return (
        idStr.includes(kw) ||
        nameStr.includes(kw) ||
        accStr.includes(kw) ||
        msgStr.includes(kw)
      );
    }
    return true;
  });

  if (filtered.length === 0) {
    list.innerHTML = `
      <div style="text-align:center; padding:40px 15px; color:var(--text-muted); font-size:0.84rem; line-height:1.6">
        <i class="fa-solid fa-headset" style="font-size:2rem; color:#10b981; opacity:0.65; margin-bottom:10px; display:block"></i>
        <b>មិនមានអតិថិជនកំពុងរង់ចាំជំនួយទេ!</b><br/>
        <span style="font-size:0.76rem">អតិថិជននឹងលោតចូលទីនេះដោយស្វ័យប្រវត្តិ នៅពេលពួកគាត់ចុចស្នើសុំជួបភ្នាក់ងារផ្ទាល់ (Live Agent)។</span>
      </div>
    `;
    return;
  }

  list.innerHTML = filtered
    .map((c) => {
      // 🎯 ចាប់យក MongoDB `_id` របស់អតិថិជនជា Primary Key
      const pId = String(c._id || c.partnerId || c.accountNumber);
      const isSelected = String(adminCurrentPartnerId) === pId;
      const moodEmoji =
        c.sentiment === "angry" ? "😡" : c.sentiment === "happy" ? "😍" : "🙂";

      let statusBadge = `<span style="background:rgba(245,158,11,0.15); color:#d97706; border:1px solid rgba(245,158,11,0.3); font-size:0.64rem; padding:2px 7px; border-radius:6px; font-weight:800">⏳ រង់ចាំភ្នាក់ងារ</span>`;
      if (c.status === "urgent") {
        statusBadge = `<span style="background:rgba(239,68,68,0.15); color:#ef4444; border:1px solid rgba(239,68,68,0.3); font-size:0.64rem; padding:2px 7px; border-radius:6px; font-weight:800">🚨 បន្ទាន់</span>`;
      } else if (c.status === "resolved") {
        statusBadge = `<span style="background:rgba(16,185,129,0.15); color:#10b981; border:1px solid rgba(16,185,129,0.3); font-size:0.64rem; padding:2px 7px; border-radius:6px; font-weight:800">✅ ដោះស្រាយរួច</span>`;
      } else if (c.status === "bot_only") {
        statusBadge = `<span style="background:rgba(14,165,233,0.15); color:#0ea5e9; font-size:0.64rem; padding:2px 7px; border-radius:6px; font-weight:800">🤖 កំពុងសួរ Bot</span>`;
      }

      const displayTime = c.timestamp
        ? new Date(c.timestamp).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          })
        : c.time || "";

      const avatarInner = c.profileImage
        ? `<img src="${c.profileImage}" onerror="this.outerHTML='<i class=\\'fa-solid fa-user\\'></i>'">`
        : `<i class="fa-solid fa-user"></i>`;

      const displayFullName = c.fullName || c.name || "អតិថិជន U-Pay";
      const safeName = String(displayFullName).replace(/'/g, "\\'");
      const safeAvatar = String(c.profileImage || "").replace(/'/g, "\\'");
      const cleanPreview = String(c.lastMessage || "")
        .replace(/<[^>]*>?/gm, "")
        .slice(0, 48);

      return `
        <div
          class="achat-contact-card ${isSelected ? "active" : ""}"
          onclick="openAdminChat('${pId}', '${safeName}', '${c.status || "pending"}', '${safeAvatar}', '${c.accountNumber || ""}')"
        >
          <div class="achat-avatar">
            ${avatarInner}
            <span class="achat-mood-tag" title="${c.isOnline ? "កំពុង Online" : "អារម្មណ៍អតិថិជន"}">${c.isOnline ? "🟢" : moodEmoji}</span>
          </div>

          <div style="flex:1; min-width:0">
            <div style="display:flex; justify-content:space-between; align-items:center; gap:6px">
              <h4 style="margin:0; font-size:0.9rem; font-weight:800; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis">
                ${displayFullName}
              </h4>
              <span style="font-size:0.68rem; color:var(--text-muted); font-weight:700; flex-shrink:0">${displayTime}</span>
            </div>

            <div style="display:flex; align-items:center; gap:6px; margin:3px 0">
              <span style="font-family:'JetBrains Mono',monospace; font-size:0.7rem; color:#0d9488; font-weight:700">#${c.accountNumber}</span>${statusBadge}
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; gap:6px">
              <p style="margin:0; font-size:0.78rem; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis">
                ${cleanPreview || "..."}
              </p>
              ${
                c.unreadCount > 0
                  ? `<span style="background:#ef4444; color:white; font-size:0.68rem; font-weight:900; padding:2px 7px; border-radius:12px; flex-shrink:0">${c.unreadCount}</span>`
                  : ""
              }
            </div>
          </div>
        </div>
      `;
    })
    .join("");
};

/**
 * 🔹 ២.៤ ចាប់ផ្តើមឆាតទៅកាន់អតិថិជនណាម្នាក់មុនតាមរយៈ `/api/admin/chat/start`
 */
window.promptStartNewAdminChat = async function () {
  const { value: targetIdentifier } = await Swal.fire({
    title: "ចាប់ផ្តើមការសន្ទនាទៅកាន់អតិថិជន",
    html: `
      <p style="font-size:0.85rem; color:#64748b; margin:0 0 12px">
        វាយបញ្ចូល <b>ឈ្មោះពេញ, លេខគណនី, លេខទូរស័ព្ទ, ឬ _id</b> របស់អតិថិជនដែលអ្នកចង់ទាក់ទង៖
      </p>
      <input type="text" id="swalAdminNewChatAcc" class="swal2-input" style="margin:0; width:100%" placeholder="ឧ. 100100100 ឬ ឈ្មោះអតិថិជន...">
    `,
    showCancelButton: true,
    confirmButtonColor: "#004d40",
    confirmButtonText: '<i class="fa-solid fa-comments"></i> បើកប្រអប់សន្ទនា',
    cancelButtonText: "បោះបង់",
    preConfirm: () => {
      const v = document.getElementById("swalAdminNewChatAcc").value.trim();
      if (!v) Swal.showValidationMessage("សូមបញ្ចូលអត្តសញ្ញាណអតិថិជន!");
      return v;
    },
  });

  if (!targetIdentifier) return;

  try {
    const res = await fetch("/api/admin/chat/start", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ identifier: targetIdentifier }),
    });
    const data = await res.json();
    if (!data.success) {
      return Swal.fire(
        "រកមិនឃើញ!",
        data.message || "គណនីមិនត្រឹមត្រូវ",
        "error",
      );
    }

    await fetchAdminContacts(false);
    openAdminChat(
      data._id || data.partnerId,
      data.name,
      "pending",
      data.profileImage || "",
      data.accountNumber || "",
    );
  } catch (e) {
    Swal.fire("Error", "មិនអាចភ្ជាប់ទៅកាន់ Server បានទេ!", "error");
  }
};

// ============================================================================
// 💬 ជំពូកទី ៣៖ ការបើកបន្ទប់សន្ទនា និងទាញប្រវត្តិសារតាម `_id` (CHAT ROOM & HISTORY BY `_id`)
// ============================================================================

/**
 * 🔹 ៣.១ បើកបន្ទប់សន្ទនាជាមួយអតិថិជនតាមរយៈ MongoDB `_id`
 */
window.openAdminChat = async function (
  partnerId,
  name,
  currentStatus = "pending",
  avatarUrl = "",
  accountNumberDisplay = "",
) {
  await ensureAdminIdentityLoaded();
  adminCurrentPartnerId = String(partnerId);
  adminCurrentPartnerAcc = accountNumberDisplay || String(partnerId);
  adminCurrentPartnerName = name;
  adminCurrentPartnerAvatar = avatarUrl;
  adminLastMsgHash = "";

  const { fullName: adminFullName } = getAdminDisplayInfo();
  const avatarHtml = avatarUrl
    ? `<img src="${avatarUrl}" onerror="this.outerHTML='<i class=\\'fa-solid fa-user\\'></i>'">`
    : `<i class="fa-solid fa-user"></i>`;

  document.getElementById("adminChatHeader").innerHTML = `
    <div style="display:flex; align-items:center; justify-content:space-between; width:100%; flex-wrap:wrap; gap:10px">
      <div style="display:flex; align-items:center; gap:12px">
        <div class="achat-avatar" style="width:42px; height:42px; border-radius:12px">
          ${avatarHtml}
        </div>
        <div>
          <div style="display:flex; align-items:center; gap:8px">
            <h3 style="margin:0; color:var(--text-main); font-size:1rem; font-weight:900">${name}</h3>
            <span id="adminHeaderAccBadge" style="font-family:'JetBrains Mono',monospace; font-size:0.76rem; background:rgba(13,148,136,0.12); color:#0d9488; padding:2px 8px; border-radius:6px; font-weight:800">
              #${adminCurrentPartnerAcc}
            </span>
          </div>
         <div style="font-size:0.74rem; color:var(--text-muted); margin-top:2px; font-weight:700; display:flex; align-items:center; gap:8px">
            <span id="adminHeaderPresenceText">កំពុងពិនិត្យស្ថានភាព...</span>
            <span>•</span>
            <span>មន្ត្រីប្រតិបត្តិ៖ <b style="color:#10b981;">@${resolvedAdminUsername || "admin"}</b></span>
          </div>
        </div>
      </div>

      <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap">
        <select
          id="adminHeaderStatusSelect"
          onchange="updateAdminChatStatus('${adminCurrentPartnerId}', this.value)"
          style="height:36px; padding:0 12px; background:var(--bg-body); color:var(--text-main); border:1px solid var(--border); border-radius:10px; font-size:0.8rem; font-weight:800; outline:none; cursor:pointer"
        >
          <option value="pending" ${currentStatus === "pending" ? "selected" : ""}>⏳ កំពុងរង់ចាំ (Pending)</option>
          <option value="urgent" ${currentStatus === "urgent" ? "selected" : ""}>🚨 បន្ទាន់ (Urgent)</option>
          <option value="resolved" ${currentStatus === "resolved" ? "selected" : ""}>✅ ដោះស្រាយរួច (Resolved)</option>
        </select>

        <button
          type="button"
          onclick="jumpToCustomer360FromChat()"
          title="មើលព័ត៌មានលម្អិតរបស់អតិថិជននេះក្នុង Customer 360° តាម _id"
          style="height:36px; padding:0 12px; border-radius:10px; border:1px solid rgba(59,130,246,0.35); background:rgba(59,130,246,0.1); color:#3b82f6; font-weight:800; font-size:0.78rem; cursor:pointer; display:inline-flex; align-items:center; gap:6px"
        >
          <i class="fa-solid fa-users-viewfinder"></i> Customer 360°
        </button>

        <button
          type="button"
          onclick="endAdminChat()"
          class="btn-end-chat"
          style="height:36px; padding:0 14px; border-radius:10px; display:inline-flex; align-items:center; gap:6px; font-size:0.8rem; font-weight:800"
        >
          <i class="fa-solid fa-circle-xmark"></i> បញ្ចប់ការសន្ទនា
        </button>
      </div>
    </div>
  `;

  document.getElementById("adminChatInputBox").style.display = "flex";
  renderAdminContactsList();
  fetchAdminMessages();

  if (adminChatInterval) clearInterval(adminChatInterval);
  adminChatInterval = setInterval(fetchAdminMessages, 2000);
};

/**
 * 🔹 ៣.២ កែប្រែស្ថានភាពសន្ទនា និងលោតទៅ Customer 360° តាមរយៈ MongoDB `_id`
 */
window.updateAdminChatStatus = async function (targetId, newStatus) {
  try {
    await fetch("/api/admin/chat/status", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ targetIdentifier: targetId, status: newStatus }),
    });
    fetchAdminContacts(false);
    Swal.fire({
      toast: true,
      position: "top-end",
      icon: "success",
      title: "បានកែប្រែស្ថានភាពសន្ទនា!",
      showConfirmButton: false,
      timer: 1200,
    });
  } catch (e) {}
};

window.jumpToCustomer360FromChat = function () {
  // 🎯 បោះ MongoDB `_id` (`adminCurrentPartnerId`) ទៅកាន់ Customer 360° ជាអាទិភាពទី ១!
  const searchKey = adminCurrentPartnerId || adminCurrentPartnerAcc;
  if (!searchKey) return;
  if (typeof goToCustomer360 === "function") {
    goToCustomer360(searchKey);
    return;
  }
  if (typeof showSection === "function") {
    showSection("customer-360");
    setTimeout(() => {
      const inp = document.getElementById("searchC360");
      if (inp) {
        inp.value = searchKey;
        if (typeof searchCustomer360 === "function") searchCustomer360();
      }
    }, 150);
  }
};

/**
 * 🔹 ៣.៣ ទាញយកប្រវត្តិសារសន្ទនារបស់អតិថិជនតាមរយៈ `_id` និងបង្ហាញឈ្មោះពេញរបស់មន្ត្រីប្រតិបត្តិ
 */
async function fetchAdminMessages() {
  if (!adminCurrentPartnerId) return;
  try {
    const res = await fetch("/api/admin/chat/history", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        targetIdentifier: adminCurrentPartnerId,
      }),
    });
    const data = await res.json();
    if (!data.success || !Array.isArray(data.history)) return;

    if (data.customerInfo) {
      const ci = data.customerInfo;
      if (ci.accountNumber) {
        adminCurrentPartnerAcc = ci.accountNumber;
        const badgeEl = document.getElementById("adminHeaderAccBadge");
        if (badgeEl) badgeEl.innerText = `#${ci.accountNumber}`;
      }
      const presEl = document.getElementById("adminHeaderPresenceText");
      if (presEl) {
        presEl.innerText = formatCustomerPresenceText(
          ci.isOnline,
          ci.lastActive,
        );
        presEl.style.color = ci.isOnline ? "#10b981" : "var(--text-muted)";
      }
    }

    const readCount = data.history.filter((m) => m.isRead).length;
    const lastMsg = data.history[data.history.length - 1];
    const currentHash = `${data.history.length}_${lastMsg?.id || ""}_${readCount}_${lastMsg?.isEdited || false}`;

    if (currentHash === adminLastMsgHash) return;
    adminLastMsgHash = currentHash;

    const { fullName: adminFullName } = getAdminDisplayInfo();
    const body = document.getElementById("adminChatBody");
    body.innerHTML = "";

    if (data.history.length === 0) {
      body.innerHTML = `
        <div style="text-align:center; padding:40px; color:var(--text-muted); margin:auto">
          មិនទាន់មានសារសន្ទនានៅឡើយទេ។ សូមវាយសារនៅខាងក្រោមដើម្បីចាប់ផ្តើម!
        </div>
      `;
      return;
    }

    data.history.forEach((m) => {
      const sKey = String(m.senderId || m.senderAcc || "");
      const isSent = sKey === "ADMIN" || sKey === "UPAY_BOT";
      const isBot =
        isSent &&
        (m.adminName === "UPAY_BOT" || m.adminName === "U-PAY Smart Bot");

      const rowClass = !isSent
        ? "from-user"
        : isBot
          ? "from-admin from-bot"
          : "from-admin";

      const adminUsernameDisplay = String(resolvedAdminUsername || "admin")
        .replace(/^@/, "")
        .trim();

      const senderLabel = !isSent
        ? adminCurrentPartnerName || `#${adminCurrentPartnerAcc}`
        : isBot
          ? "🤖 U-PAY Smart Bot"
          : `👨‍💻 @${adminUsernameDisplay}`;

      const timeDisplay = m.timestamp
        ? new Date(m.timestamp).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          })
        : (m.time || "").split(",")[1] || m.time || "";

      let mediaHtml = "";
      if (m.imageUrl) {
        mediaHtml += `
          <div style="margin-bottom:6px">
            <img
              src="${m.imageUrl}"
              onclick="window.open('${m.imageUrl}', '_blank')"
              style="max-width:260px; max-height:260px; border-radius:12px; cursor:pointer; display:block; border:1px solid rgba(255,255,255,0.2)"
              title="ចុចដើម្បីមើលរូបភាពពេញ"
            />
          </div>
        `;
      }
      if (m.audioUrl) {
        mediaHtml += `
          <div style="margin-bottom:6px">
            <audio controls src="${m.audioUrl}" style="height:36px; max-width:240px"></audio>
          </div>
        `;
      }
      if (m.fileUrl) {
        mediaHtml += `
          <div style="margin-bottom:6px">
            <a href="${m.fileUrl}" target="_blank" style="display:inline-flex; align-items:center; gap:8px; padding:8px 12px; border-radius:10px; background:rgba(0,0,0,0.15); color:inherit; text-decoration:none; font-weight:800; font-size:0.82rem">
              <i class="fa-solid fa-file-arrow-down"></i> ${m.fileName || "ទាញយកឯកសារ"}
            </a>
          </div>
        `;
      }

      let cleanText = m.message || "";
      if (
        (cleanText === "រូបភាព 🖼️" && m.imageUrl) ||
        (cleanText === "សំឡេង 🎤" && m.audioUrl) ||
        (cleanText === "ឯកសារ 📄" && m.fileUrl)
      ) {
        cleanText = "";
      }

      const checkIconHtml =
        isSent && !isBot
          ? m.isRead
            ? `<i class="fa-solid fa-check-double admin-read-check" style="color:#0ea5e9" title="អតិថិជនបានអាន (Seen)"></i>`
            : `<i class="fa-solid fa-check admin-read-check" style="color:#94a3b8" title="បានផ្ញើ (Sent)"></i>`
          : "";

      const wrap = document.createElement("div");
      wrap.className = `achat-msg-row ${rowClass}`;
      if (!isSent && cleanText) {
        wrap.setAttribute(
          "data-customer-msg",
          cleanText.replace(/<[^>]*>?/gm, ""),
        );
      }

      wrap.innerHTML = `
        <div class="achat-bubble">
          ${mediaHtml}${cleanText ? `<div>${cleanText}</div>` : ""}
        </div>
        <div class="achat-meta-line">
          <span>${timeDisplay}</span>
          <span>•</span>
          <span style="color:${!isSent ? "#0d9488" : isBot ? "#94a3b8" : "#3b82f6"}; font-weight:700;">${senderLabel}</span>${checkIconHtml}
        </div>
      `;

      body.appendChild(wrap);
    });

    body.scrollTop = body.scrollHeight;
  } catch (e) {
    console.error("Fetch Admin Messages Error:", e);
  }
}

// ============================================================================
// 🚀 ជំពូកទី ៤៖ ការផ្ញើសារ, ផ្ញើរូបភាព/ឯកសារ និងបញ្ចប់ការសន្ទនាតាម `_id` (SEND & END SESSION)
// ============================================================================

/**
 * 🔹 ៤.១ ផ្ញើសារអត្ថបទទៅកាន់អតិថិជនតាមរយៈ MongoDB `_id`
 */
window.sendAdminChat = async function () {
  const input = document.getElementById("adminChatInput");
  const text = (input?.value || "").trim();
  if (!text || !adminCurrentPartnerId) return;
  input.value = "";

  await fetch("/api/admin/chat/send", {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({
      targetIdentifier: adminCurrentPartnerId,
      message: text,
    }),
  });

  adminLastMsgHash = "";
  fetchAdminMessages();
  fetchAdminContacts(false);
};

/**
 * 🔹 ៤.២ បង្ហោះ និងផ្ញើរូបភាព ឬឯកសារទៅកាន់អតិថិជនតាមរយៈ MongoDB `_id`
 */
window.handleAdminChatFileUpload = async function (e) {
  const file = e.target.files[0];
  if (!file || !adminCurrentPartnerId) return;

  const CLOUD_NAME = "jp9yg3dj";
  const UPLOAD_PRESET = "iaxuqmpb";
  const isImage = file.type.startsWith("image/");

  Swal.fire({
    title: "កំពុងផ្ញើឯកសារជូនអតិថិជន...",
    didOpen: () => Swal.showLoading(),
    customClass: { popup: "premium-swal" },
  });

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);

  try {
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`,
      { method: "POST", body: formData },
    );
    const data = await res.json();
    Swal.close();

    if (data.secure_url) {
      const payload = {
        targetIdentifier: adminCurrentPartnerId,
        message: isImage ? "រូបភាព 🖼️" : "ឯកសារ 📄",
        ...(isImage
          ? { imageUrl: data.secure_url }
          : {
              fileUrl: data.secure_url,
              fileName: file.name,
              fileSize: (file.size / (1024 * 1024)).toFixed(2) + " MB",
            }),
      };

      await fetch("/api/admin/chat/send", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });
      adminLastMsgHash = "";
      fetchAdminMessages();
    }
  } catch (err) {
    Swal.fire("Error", "មិនអាចផ្ញើរូបភាពបានទេ!", "error");
  }
  e.target.value = "";
};

/**
 * 🔹 ៤.៣ បញ្ចប់ការសន្ទនា និងប្តូរអតិថិជនទៅជាដោះស្រាយរួចរាល់ (Resolved)
 */
window.endAdminChat = function () {
  if (!adminCurrentPartnerId) return;

  Swal.fire({
    title: "បញ្ចប់ការសន្ទនានេះ?",
    text: `ប្រព័ន្ធនឹងផ្ញើសារជម្រាបលាទៅកាន់ "${adminCurrentPartnerName}" ហើយប្តូរគាត់ចេញពីជួររង់ចាំទៅជាដោះស្រាយរួចរាល់ (Resolved)។`,
    icon: "question",
    showCancelButton: true,
    confirmButtonColor: "#ef4444",
    cancelButtonColor: "#64748b",
    confirmButtonText: '<i class="fa-solid fa-check"></i> បាទ, បញ្ចប់ការសន្ទនា',
    cancelButtonText: "បោះបង់",
    customClass: { popup: "premium-swal" },
  }).then(async (res) => {
    if (res.isConfirmed) {
      await fetch("/api/admin/chat/end", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          targetIdentifier: adminCurrentPartnerId,
        }),
      });

      adminCurrentPartnerId = null;
      adminLastMsgHash = "";
      document.getElementById("adminChatHeader").innerHTML = `
        <h3 style="margin:0; color:var(--text-main); font-size:1rem; font-weight:800">
          <i class="fa-regular fa-comments" style="color:#0d9488; margin-right:6px"></i>
          សូមជ្រើសរើសអតិថិជនពីបញ្ជីខាងឆ្វេងដើម្បីចាប់ផ្តើមសន្ទនា
        </h3>
      `;
      document.getElementById("adminChatBody").innerHTML = `
        <div style="text-align:center; color:var(--text-muted); margin:auto">
          <i class="fa-regular fa-circle-check" style="font-size:3rem; color:#10b981; margin-bottom:10px"></i><br/>
          <b>ការសន្ទនាត្រូវបានបញ្ចប់ និងដាក់ចូលបញ្ជីដោះស្រាយរួចរាល់!</b>
        </div>
      `;
      document.getElementById("adminChatInputBox").style.display = "none";
      if (adminChatInterval) clearInterval(adminChatInterval);
      fetchAdminContacts(false);
    }
  });
};

// ============================================================================
// ⚡ ជំពូកទី ៥៖ ឃ្លាំងសារគំរូរហ័ស និងជំនួយការឆ្លើយតបឆ្លាតវៃ AI (QUICK REPLIES & AI)
// ============================================================================
const DEFAULT_QUICK_REPLIES = [
  "សួស្តីបង! 🙏 តើមានអ្វីឱ្យមន្ត្រីធនាគារ U-PAY យើងខ្ញុំជួយបងបានដែរ?",
  "សូមបងមេត្តារង់ចាំបន្តិច ប្អូនកំពុងត្រួតពិនិត្យទិន្នន័យក្នុងប្រព័ន្ធជូនបងហើយ... 👨‍💻",
  "សូមបងមេត្តាផ្ញើលេខយោងវិក្កយបត្រ (Ref ID) ឬរូបភាពប្រតិបត្តិការមកកាន់ប្អូនបន្តិចណាបង។",
  "ប្រតិបត្តិការ និងសំណើរបស់បងត្រូវបានដោះស្រាយរួចរាល់ ១០០% ហើយបង! ✅",
  "សូមអភ័យទោសចំពោះភាពរអាក់រអួលនេះណាបង បច្ចុប្បន្នប្រព័ន្ធដំណើរការធម្មតាវិញហើយ។",
  "សូមអរគុណដែលបានប្រើប្រាស់សេវាកម្ម U-PAY! សូមជូនពរបងឱ្យជួបតែសំណាងល្អ 🙏💚",
];

function getSavedQuickReplies() {
  try {
    const custom = JSON.parse(
      localStorage.getItem("upay_custom_quick_replies") || "null",
    );
    if (Array.isArray(custom) && custom.length > 0) return custom;
  } catch (e) {}
  return DEFAULT_QUICK_REPLIES;
}

/**
 * 🔹 ៥.១ បើកផ្ទាំងជ្រើសរើសសារគំរូរហ័ស (Floating Quick Replies Popover)
 */
window.openQuickReplies = function (event) {
  if (event) event.stopPropagation();
  const existingPopup = document.getElementById("quickRepliesPopover");
  if (existingPopup) {
    existingPopup.remove();
    return;
  }

  const templates = getSavedQuickReplies();
  const inputContainer = document.getElementById("adminChatInputBox");
  if (!inputContainer) return;

  const popover = document.createElement("div");
  popover.id = "quickRepliesPopover";
  popover.style.cssText = `
    position: absolute;
    bottom: calc(100% + 12px);
    left: 18px;
    width: 400px;
    max-width: calc(100vw - 40px);
    background: var(--bg-card, #ffffff);
    border: 1px solid var(--border, #cbd5e1);
    border-radius: 18px;
    box-shadow: 0 18px 40px rgba(15, 23, 42, 0.22);
    padding: 16px;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    gap: 10px;
  `;

  popover.innerHTML = `
    <div style="display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid var(--border, #e2e8f0); padding-bottom:10px">
      <div style="font-size:0.88rem; font-weight:900; color:var(--text-main); display:flex; align-items:center; gap:7px">
        <i class="fa-solid fa-bolt" style="color:#f59e0b"></i>
        <span>ឃ្លាំងសារគំរូរហ័ស (Quick Replies)</span>
      </div>
      <div style="display:flex; align-items:center; gap:8px">
        <button
          type="button"
          onclick="addCustomQuickReplyPrompt()"
          style="border:none; background:rgba(13,148,136,0.12); color:#0d9488; padding:4px 10px; border-radius:8px; font-size:0.74rem; font-weight:800; cursor:pointer"
        >
          + បន្ថែមគំរូថ្មី
        </button>
        <i class="fa-solid fa-xmark" style="cursor:pointer; color:#94a3b8; font-size:1.05rem; padding:4px" onclick="document.getElementById('quickRepliesPopover')?.remove()"></i>
      </div>
    </div>

    <div style="display:flex; flex-direction:column; gap:7px; max-height:250px; overflow-y:auto; padding-right:4px">
      ${templates
        .map(
          (msg) => `
          <div style="display:flex; align-items:center; gap:6px">
            <button
              type="button"
              onclick="insertQuickReply('${msg.replace(/'/g, "\\'")}', false)"
              style="flex:1; text-align:left; padding:10px 12px; border-radius:11px; border:1px solid var(--border, #e2e8f0); background:var(--bg-body, #f8fafc); color:var(--text-main); font-size:0.83rem; font-weight:600; cursor:pointer; line-height:1.45; transition:0.15s"
            >
              ${msg}
            </button>
            <button
              type="button"
              onclick="insertQuickReply('${msg.replace(/'/g, "\\'")}', true)"
              title="ផ្ញើចេញភ្លាមៗ"
              style="width:36px; height:36px; border-radius:10px; border:none; background:linear-gradient(135deg,#004d40,#0d9488); color:white; cursor:pointer; flex-shrink:0"
            >
              <i class="fa-solid fa-paper-plane" style="font-size:0.75rem"></i>
            </button>
          </div>
        `,
        )
        .join("")}
    </div>
  `;

  inputContainer.appendChild(popover);

  setTimeout(() => {
    document.addEventListener("click", function closeQrOutside(ev) {
      const pop = document.getElementById("quickRepliesPopover");
      if (!pop) {
        document.removeEventListener("click", closeQrOutside);
        return;
      }
      if (!pop.contains(ev.target) && !ev.target.closest(".btn-quick-reply")) {
        pop.remove();
        document.removeEventListener("click", closeQrOutside);
      }
    });
  }, 50);
};

window.insertQuickReply = function (msg, sendImmediately = false) {
  const input = document.getElementById("adminChatInput");
  if (input) {
    input.value = msg;
    input.focus();
  }
  document.getElementById("quickRepliesPopover")?.remove();
  if (sendImmediately) {
    sendAdminChat();
  }
};

window.addCustomQuickReplyPrompt = async function () {
  document.getElementById("quickRepliesPopover")?.remove();
  const { value: newMsg } = await Swal.fire({
    title: "បន្ថែមសារគំរូរហ័សថ្មី",
    input: "textarea",
    inputPlaceholder: "វាយសារគំរូដែលអ្នកឧស្សាហ៍ប្រើនៅទីនេះ...",
    showCancelButton: true,
    confirmButtonColor: "#004d40",
    confirmButtonText: "រក្សាទុក",
    cancelButtonText: "បោះបង់",
  });
  if (newMsg && newMsg.trim()) {
    const list = getSavedQuickReplies();
    list.unshift(newMsg.trim());
    localStorage.setItem("upay_custom_quick_replies", JSON.stringify(list));
    openQuickReplies();
  }
};

/**
 * 🔹 ៥.២ មុខងារ AI ជំនួយការតាក់តែងចម្លើយឆ្លាតវៃ
 */
window.generateAIReply = async function (selectedTone = "polite") {
  if (!adminCurrentPartnerId) return;

  const inputField = document.getElementById("adminChatInput");
  const currentDraft = (inputField?.value || "").trim();

  const customerRows = document.querySelectorAll(
    "#adminChatBody .achat-msg-row.from-user",
  );

  let lastUserText = "";
  const recentContextLines = [];

  customerRows.forEach((row) => {
    const txt = (
      row.getAttribute("data-customer-msg") ||
      row.querySelector(".achat-bubble")?.innerText ||
      ""
    ).trim();
    if (txt) {
      lastUserText = txt;
      recentContextLines.push(`អតិថិជន: ${txt}`);
    }
  });

  if (!lastUserText) {
    lastUserText = "អតិថិជនទើបតែចូលមកសុំជំនួយពីភ្នាក់ងារធនាគារ";
  }

  const maskText = (str) =>
    String(str || "")
      .replace(/\b\d{6,}\b/g, "[លេខគណនី]")
      .replace(/(0\d{2}[-\s]?\d{3}[-\s]?\d{3,4})/g, "[លេខទូរស័ព្ទ]");

  const btnAi = document.getElementById("btnAdminAiSparkle");
  if (btnAi) {
    btnAi.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    btnAi.disabled = true;
  }

  try {
    const res = await fetch("/api/admin/ai-reply", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        message: maskText(lastUserText),
        conversationContext: maskText(recentContextLines.slice(-5).join("\n")),
        adminDraft: currentDraft,
        tone: selectedTone,
      }),
    });

    const data = await res.json();

    if (data.success && data.reply) {
      if (inputField) {
        inputField.value = data.reply;
        inputField.focus();
      }
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: `✨ រៀបចំដោយ ${data.engine || "U-Pay AI"}`,
        showConfirmButton: false,
        timer: 1600,
      });
    } else {
      Swal.fire("បរាជ័យ", "មិនអាចបង្កើតចម្លើយ AI បានទេ", "error");
    }
  } catch (error) {
    Swal.fire("Error", "មានបញ្ហាតភ្ជាប់ទៅកាន់ប្រព័ន្ធ AI", "error");
  } finally {
    if (btnAi) {
      btnAi.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i>';
      btnAi.disabled = false;
    }
  }
};

// ============================================================================
// 🎬 ជំពូកទី ៦៖ ការចាប់ផ្តើមទាញបញ្ជីសន្ទនាដោយស្វ័យប្រវត្តិ (AUTO-POLLING INIT)
// ============================================================================
setInterval(() => {
  fetchAdminContacts(false);
}, 3000);
fetchAdminContacts(false);
