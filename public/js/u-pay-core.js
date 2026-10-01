// js/u-pay-core.js

/**
 * ==========================================
 * 🧠 U-PAY CORE SYSTEM (ខួរក្បាលកណ្តាលរបស់ App)
 * ==========================================
 */

const userString = sessionStorage.getItem("user");
const token = sessionStorage.getItem("userToken");
const currentPage = window.location.pathname.split("/").pop();

if (!userString || !token) {
  if (
    currentPage !== "index.html" &&
    currentPage !== "" &&
    currentPage !== "register.html"
  ) {
    window.location.href = "index.html";
  }
}

window.currentUser = userString ? JSON.parse(userString) : null;
window.authHeaders = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
};
window.currentLang = localStorage.getItem("lang") || "en";

window.t = function (key) {
  const lang = localStorage.getItem("lang") || "en";
  if (
    typeof translations !== "undefined" &&
    translations[lang] &&
    translations[lang][key]
  )
    return translations[lang][key];
  if (
    typeof translations !== "undefined" &&
    translations["en"] &&
    translations["en"][key]
  )
    return translations["en"][key];
  return key;
};

window.applyTheme = function () {
  if (!window.currentUser) return;
  const userThemeKey = "darkMode_" + window.currentUser.username;
  const isDark =
    localStorage.getItem("theme") === "dark" ||
    localStorage.getItem(userThemeKey) === "true";
  if (isDark) document.body.classList.add("dark-mode");
  else document.body.classList.remove("dark-mode");
};

window.applyLanguage = function () {
  if (typeof translations === "undefined") return;
  window.currentLang = localStorage.getItem("lang") || "en";
  document.querySelectorAll("[data-i18n], [data-lang]").forEach((el) => {
    const key = el.getAttribute("data-i18n") || el.getAttribute("data-lang");
    if (
      translations[window.currentLang] &&
      translations[window.currentLang][key]
    ) {
      if (el.tagName === "INPUT" && el.hasAttribute("placeholder"))
        el.placeholder = translations[window.currentLang][key];
      else if (el.tagName === "OPTION")
        el.innerText = translations[window.currentLang][key];
      else el.innerHTML = translations[window.currentLang][key];
    }
  });
  if (window.currentLang === "kh") document.body.classList.add("kh-font");
  else document.body.classList.remove("kh-font");
};

document.addEventListener("DOMContentLoaded", () => {
  window.applyTheme();
  window.applyLanguage();
  setTimeout(() => document.body.classList.add("loaded"), 50);

  if (window.currentUser && typeof io !== "undefined") {
    const socket = io("https://u-pay-bank.fly.dev");
    const uName = window.currentUser.username
      ? window.currentUser.username.trim()
      : "";
    socket.emit("joinRoom", uName);
    if (uName) socket.emit("joinRoom", uName.toLowerCase());

    socket.on("paymentRequest", (data) => {
      const fakeNotif = {
        _id: "SOCKET_" + Date.now(),
        type: "card_payment_request",
        title: "សំណើទូទាត់ប្រាក់ 🛒",
        message: `${data.merchantName || "Merchant"} is requesting to deduct $${Number(data.amount).toFixed(2)} from your card.`,
        date: new Date().toLocaleString(),
        metadata: {
          transactionId: data.transactionId,
          merchantName: data.merchantName,
          amount: data.amount,
        },
        responseStatus: "pending", // 🌟 តម្រូវតាម Backend ថ្មី
      };
      if (typeof window.showSmartNotification === "function") {
        window.showSmartNotification(fakeNotif);
      }
    });
  }

  if (!document.getElementById("smart-notif-global-style")) {
    const style = document.createElement("style");
    style.id = "smart-notif-global-style";
    style.innerHTML = `
        .notif-item { padding: 18px; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; text-align: left; }
        body.dark-mode .notif-item { background: #1e293b; border-color: #334155; }
        .notif-top-row { display: flex; gap: 15px; align-items: flex-start; }
        .notif-icon-box { width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 1.3rem; }
        .notif-text-box { flex: 1; overflow: hidden; }
        .notif-text-box h4 { margin: 0 0 6px 0; font-size: 1rem; color: #1e293b; font-weight: 700; line-height: 1.3; }
        body.dark-mode .notif-text-box h4 { color: #f8fafc; }
        .notif-text-box p { margin: 0 0 10px 0; font-size: 0.85rem; color: #475569; line-height: 1.5; }
        body.dark-mode .notif-text-box p { color: #cbd5e1; }
        .notif-text-box span.msg-date { font-size: 0.75rem; color: #94a3b8; font-weight: 500; display: flex; align-items: center; gap: 5px; margin-top: 10px; }
        
        .action-btn-group { display: flex; gap: 10px; margin-top: 15px; }
        .action-btn-group button { flex: 1; padding: 12px 10px; border-radius: 10px; font-weight: 700; cursor: pointer; border: none; color: white; transition: 0.2s; font-size: 0.9rem; }
        .action-btn-group button:active { transform: scale(0.95); }
        .btn-accept { background: #10b981; box-shadow: 0 4px 10px rgba(16, 185, 129, 0.2); }
        .btn-reject { background: #ef4444; box-shadow: 0 4px 10px rgba(239, 68, 68, 0.2); }
        .btn-full { width: 100%; background: #dc2626; box-shadow: 0 4px 10px rgba(220, 38, 38, 0.2); }

        .premium-swal { width: 92% !important; max-width: 420px !important; border-radius: 24px !important; padding-bottom: 20px; }
        .premium-swal .swal2-title { font-size: 1.25rem !important; margin-bottom: 5px; }
        .premium-swal .swal2-html-container { margin: 1em; overflow: hidden; padding: 0; }
        .premium-swal .notif-item { margin: 0; box-shadow: 0 4px 20px rgba(0,0,0,0.05); border: none; background: #f8fafc; }
        body.dark-mode .premium-swal .notif-item { background: #0f172a; box-shadow: 0 4px 20px rgba(0,0,0,0.5); }

        .smart-toast-notification { position: fixed; top: -100px; left: 50%; transform: translateX(-50%); width: 92%; max-width: 420px; background: rgba(255,255,255,0.95); backdrop-filter: blur(15px); border-radius: 20px; box-shadow: 0 10px 40px rgba(0,0,0,0.15); padding: 16px; z-index: 99999; transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1); overflow: hidden; max-height: 85px; cursor: pointer; border: 1px solid rgba(0,0,0,0.05); }
        body.dark-mode .smart-toast-notification { background: rgba(30,41,59,0.95); box-shadow: 0 10px 40px rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.1); }
        .smart-toast-notification.expanding { max-height: 300px; box-shadow: 0 20px 50px rgba(0,0,0,0.25); border-radius: 24px; }
        .smart-toast-content { display: flex; align-items: flex-start; gap: 15px; }
        .smart-toast-icon { font-size: 1.4rem; width: 45px; height: 45px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .smart-toast-text h4 { margin: 0 0 4px 0; font-size: 1rem; font-weight: 700; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        body.dark-mode .smart-toast-text h4 { color: #f8fafc; }
        .smart-toast-text p { margin: 0; font-size: 0.85rem; color: #475569; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        body.dark-mode .smart-toast-text p { color: #94a3b8; }
        .smart-toast-notification.expanding .smart-toast-text h4 { white-space: normal; }
        .smart-toast-notification.expanding .smart-toast-text p { display: block; overflow: visible; }
        .smart-toast-pull-bar { width: 40px; height: 4px; background: #cbd5e1; border-radius: 10px; margin: 12px auto 0; opacity: 0; transition: 0.3s; }
        .smart-toast-notification.expanding .smart-toast-pull-bar { opacity: 1; }
      `;
    document.head.appendChild(style);
  }
});

function escapeHTML(str) {
  if (typeof str !== "string") return str;
  return str.replace(
    /[&<>'"]/g,
    (tag) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        tag
      ] || tag,
  );
}

// ==========================================
// 🛡️ ANTI-SPAM & STATE MANAGEMENT
// ==========================================

window.getRespondedMap = function () {
  if (!window.currentUser) return {};
  return (
    JSON.parse(
      localStorage.getItem(`respondedNotifs_${window.currentUser.username}`),
    ) || {}
  );
};

window.markNotifResponded = function (uniqueKey, status) {
  if (!uniqueKey || uniqueKey.startsWith("SOCKET_")) return;
  const user = window.currentUser;
  if (!user) return;
  let respondedMap = window.getRespondedMap();
  respondedMap[uniqueKey] = status;
  localStorage.setItem(
    `respondedNotifs_${user.username}`,
    JSON.stringify(respondedMap),
  );
};

// ==========================================
// 💡 មជ្ឈមណ្ឌលបង្កើត និងចាត់ចែងសារ (CENTRAL MESSAGE UI)
// ==========================================

window.generateMessageHTML = function (
  m,
  isHistoryView = false,
  preloadedMap = null,
) {
  let displayMsg = m.message;
  let iconClass = "fa-bullhorn";
  let bgClass = "background:#e0f2fe; color:#0284c7;";
  let actionBtns = "";
  const notifId = m._id || m.id;
  const user = window.currentUser || {};

  const respondedMap = preloadedMap || window.getRespondedMap();
  let responseStatus = null;

  if (m.title.includes("Received") && m.type !== "egift_receive") {
    iconClass = "fa-hand-holding-dollar";
    bgClass = "background:#ecfdf5; color:#10b981;";
    if (user.role === "junior") {
      iconClass = "fa-child-reaching";
      bgClass = "background:#fce7f3; color:#db2777;";
    }
  } else if (
    m.title.includes("សំណើទូទាត់ប្រាក់") ||
    m.type === "payment_request"
  ) {
    iconClass = "fa-cart-shopping";
    bgClass = "background:#fff7ed; color:#ea580c;";
  } else if (
    m.title.includes("Cashback") ||
    m.type === "cashback_reward" ||
    m.title.includes("ឈ្នះបាន")
  ) {
    iconClass = "fa-sack-dollar";
    bgClass = "background:#dcfce7; color:#059669;";
  } else if (m.title.includes("Refund")) {
    iconClass = "fa-arrow-rotate-left";
    bgClass = "background:#f3e8ff; color:#9333ea;";
  }

  // 🎁 អាំងប៉ាវ E-Gift
  if (m.type === "egift_receive") {
    iconClass = "fa-gift";
    const key = notifId;

    // 🌟 ការកែប្រែដ៏សំខាន់៖ ផ្តល់អាទិភាពដល់ DB Status មុន LocalStorage!
    responseStatus =
      m.responseStatus && m.responseStatus !== "pending"
        ? m.responseStatus
        : respondedMap[key];

    if (responseStatus !== "opened") {
      displayMsg = `<span class="kh-text">${window.t("msg_egift_rcv")}</span>`;
      bgClass = "background:#fee2e2; color:#dc2626;";
      const amt = m.egiftData?.amount || m.metadata?.egiftData?.amount || 0,
        cur = m.egiftData?.currency || m.metadata?.egiftData?.currency || "USD",
        sender = (
          m.egiftData?.senderName ||
          m.metadata?.egiftData?.senderName ||
          "Friend"
        ).replace(/'/g, "\\'"),
        note = (
          m.egiftData?.message ||
          m.metadata?.egiftData?.message ||
          ""
        ).replace(/'/g, "\\'"),
        senderUsername =
          m.egiftData?.senderUsername ||
          m.metadata?.egiftData?.senderUsername ||
          "";
      actionBtns = `<div class="action-btn-group"><button class="kh-text btn-full" onclick="window.handleOpenGift('${amt}', '${cur}', '${sender}', '${note}', '${key}', '${senderUsername}')"><i class="fa-solid fa-envelope-open-text"></i> ${window.t("swal_btn_open_gift")}</button></div>`;
    } else {
      displayMsg = `<span class="kh-text">${window.t("msg_egift_opened")}</span>`;
      bgClass = "background:#d1fae5; color:#10b981;";
    }
  }
  // 🎯 U-Fund
  else if (m.type === "ufund_invite") {
    iconClass = "fa-bullseye";
    const key = m.fundId || (m.metadata && m.metadata.fundId) || notifId;

    // 🌟 ការកែប្រែដ៏សំខាន់៖ ផ្តល់អាទិភាពដល់ DB Status មុន LocalStorage!
    responseStatus =
      m.responseStatus && m.responseStatus !== "pending"
        ? m.responseStatus
        : respondedMap[key];

    if (!responseStatus || responseStatus === "pending") {
      bgClass = "background:#ecfeff; color:#0891b2;";
      const actualFundId = m.fundId || (m.metadata && m.metadata.fundId);
      actionBtns = `<div class="action-btn-group"><button class="kh-text btn-accept" onclick="window.respondUFundInvite('${actualFundId}', '${key}', 'accept')">${window.t("notif_btn_accept")}</button><button class="kh-text btn-reject" onclick="window.respondUFundInvite('${actualFundId}', '${key}', 'decline')">${window.t("notif_btn_reject")}</button></div>`;
    } else {
      bgClass = "background:#f1f5f9; color:#94a3b8;";
      const statusText =
        responseStatus === "accepted"
          ? window.t("msg_status_accepted")
          : window.t("msg_status_rejected");
      const statusIcon = responseStatus === "accepted" ? "✅" : "❌";
      displayMsg += ` <br><b class="kh-text" style="color:${responseStatus === "accepted" ? "#10b981" : "#ef4444"}; font-size: 0.8rem;">(${statusIcon} ${statusText})</b>`;
    }
  }
  // 👥 Joint Account
  else if (
    m.type === "joint_invite" ||
    (m.metadata && m.metadata.type === "joint_invite")
  ) {
    iconClass = "fa-users";
    const metaData = m.metadata || {};
    const key = metaData.accountNumber || notifId;

    // 🌟 ការកែប្រែដ៏សំខាន់៖ ផ្តល់អាទិភាពដល់ DB Status មុន LocalStorage!
    responseStatus =
      m.responseStatus && m.responseStatus !== "pending"
        ? m.responseStatus
        : respondedMap[key];

    if (!responseStatus || responseStatus === "pending") {
      bgClass = "background:#e0e7ff; color:#4f46e5;";
      actionBtns = `<div id="joint-action-${key}" class="action-btn-group"><button class="kh-text btn-accept" onclick="window.handleJointInvite(this, '${metaData.ownerUsername}', '${metaData.accountNumber}', 'accept', '${key}')"><i class="fa-solid fa-check"></i> ${window.t("notif_btn_accept")}</button><button class="kh-text btn-reject" onclick="window.handleJointInvite(this, '${metaData.ownerUsername}', '${metaData.accountNumber}', 'reject', '${key}')"><i class="fa-solid fa-xmark"></i> ${window.t("notif_btn_reject")}</button></div>`;
    } else {
      bgClass = "background:#f1f5f9; color:#94a3b8;";
      const statusText =
        responseStatus === "accepted"
          ? window.t("msg_status_accepted")
          : window.t("msg_status_rejected");
      const statusIcon = responseStatus === "accepted" ? "✅" : "❌";
      displayMsg += ` <br><b class="kh-text" style="color:${responseStatus === "accepted" ? "#10b981" : "#ef4444"}; font-size: 0.8rem;">(${statusIcon} ${statusText})</b>`;
    }
  }
  // 💳 Card Payment Request
  else if (m.type === "card_payment_request") {
    iconClass = "fa-credit-card";
    const metaData = m.metadata || {};
    const txId = metaData.transactionId;
    const key = txId || notifId;

    // 🌟 ការកែប្រែដ៏សំខាន់៖ ផ្តល់អាទិភាពដល់ DB Status មុន LocalStorage!
    responseStatus =
      m.responseStatus && m.responseStatus !== "pending"
        ? m.responseStatus
        : respondedMap[key];

    if (!responseStatus || responseStatus === "pending") {
      bgClass = "background:#fff7ed; color:#ea580c;";
      const mName = metaData.merchantName || "U MALL";
      const mAmt = metaData.amount
        ? Number(metaData.amount).toFixed(2)
        : "0.00";
      displayMsg = `<span class="kh-text"><b>${escapeHTML(mName)}</b> ${window.t("msg_card_req")} <b style="color:red;">$${mAmt}</b> ${window.t("msg_from_card")}</span>`;

      actionBtns = `<div class="action-btn-group"><button class="kh-text btn-accept" onclick="window.handleCardPaymentConfirm('${txId}', '${key}')">${window.t("notif_btn_accept")}</button><button class="kh-text btn-reject" onclick="window.handleCardPaymentReject('${txId}', '${key}')">${window.t("notif_btn_reject")}</button></div>`;
    } else {
      bgClass = "background:#f1f5f9; color:#94a3b8;";
      const statusText =
        responseStatus === "accepted"
          ? window.t("msg_status_accepted")
          : window.t("msg_status_rejected");
      const statusIcon = responseStatus === "accepted" ? "✅" : "❌";
      displayMsg = `<span class="kh-text"><b>${escapeHTML(metaData.merchantName || "Merchant")}</b> ${window.t("msg_card_req")} <b style="color:red;">$${Number(metaData.amount || 0).toFixed(2)}</b> ${window.t("msg_from_card")} <br><b class="kh-text" style="color:${responseStatus === "accepted" ? "#10b981" : "#ef4444"}; font-size: 0.8rem;">(${statusIcon} ${statusText})</b></span>`;
    }
  }

  const delBtn = isHistoryView
    ? `<button class="msg-del-btn" onclick="window.deleteMessage('${escapeHTML(m.title)}', '${escapeHTML(m.date)}')"><i class="fa-solid fa-trash-can"></i></button>`
    : "";

  return `
    <div class="${isHistoryView ? "msg-card" : "notif-item"}" id="notif-item-${notifId}">
        <div class="${isHistoryView ? "msg-top" : "notif-top-row"}">
            <div class="${isHistoryView ? "msg-icon" : "notif-icon-box"}" style="${bgClass}"><i class="fa-solid ${iconClass}"></i></div>
            <div class="${isHistoryView ? "msg-content" : "notif-text-box"}">
                <h4 class="kh-text">${escapeHTML(m.title)}</h4>
                <p class="kh-text">${displayMsg}</p>
                ${actionBtns}
                <span class="${isHistoryView ? "msg-date" : "msg-date"} kh-text"><i class="fa-regular fa-clock"></i> ${escapeHTML(m.date) || window.t("notif_just_now")}</span>
            </div>
        </div>
        ${delBtn}
    </div>`;
};

// ==========================================
// 🚀 SMART NOTIFICATION DISPATCHER (បែងចែកការលោតសារ)
// ==========================================

window.sessionPoppedSet = new Set();

window.showSmartNotification = function (m) {
  const notifId = m._id || m.id;
  const respondedMap = window.getRespondedMap();

  const isActionable =
    ["egift_receive", "ufund_invite", "card_payment_request"].includes(
      m.type,
    ) ||
    (m.metadata && m.metadata.type === "joint_invite");

  let uniqueKey = notifId;
  const metaData = m.metadata || {};

  if (m.type === "card_payment_request")
    uniqueKey = metaData.transactionId || notifId;
  else if (m.type === "ufund_invite")
    uniqueKey = m.fundId || metaData.fundId || notifId;
  else if (m.type === "joint_invite" || metaData.type === "joint_invite")
    uniqueKey = metaData.accountNumber || notifId;

  // 🌟 ការពារការលោតសារដែលយើងបាន Accept/Reject រួចនៅក្នុង Database
  if (
    respondedMap[uniqueKey] ||
    (m.responseStatus && m.responseStatus !== "pending")
  )
    return;

  if (isActionable) {
    if (window.sessionPoppedSet.has(uniqueKey)) return;
    window.sessionPoppedSet.add(uniqueKey);
    window.showActionableSweetAlert(m);
  } else {
    if (!window.sessionPoppedSet.has(uniqueKey)) {
      window.sessionPoppedSet.add(uniqueKey);
      window.showPeekToastNotification(m);
    }
  }
};

window.showActionableSweetAlert = function (m) {
  new Audio(
    "https://notificationsounds.com/storage/sounds/file-sounds-1148-juntos.mp3",
  )
    .play()
    .catch(() => {});

  const messageHTML = window.generateMessageHTML(m, false);

  Swal.fire({
    title: `<span class="kh-text" style="color: #3b82f6;"><i class="fa-solid fa-bell"></i> ${window.t("notif_title") || "Notifications"}</span>`,
    html: `<div style="text-align: left; margin-top: 10px;">${messageHTML}</div>`,
    showConfirmButton: false,
    showCloseButton: true,
    allowOutsideClick: false,
    customClass: { popup: "premium-swal kh-text" },
    backdrop: `rgba(0,0,0,0.5)`,
  });
};

window.showPeekToastNotification = function (m) {
  // 🌟 ថែមកូដមួយជួរនេះ ដើម្បីកត់ចំណាំថា Toast នេះបានបង្ហាញរួចហើយ
  window.markNotifResponded(m._id || m.id, "shown");

  new Audio(
    "https://notificationsounds.com/storage/sounds/file-sounds-1150-pristine.mp3",
  )
    .play()
    .catch(() => {});
  const toastId = `toast-${m._id || m.id || Date.now()}`;
  const toastEl = document.createElement("div");
  toastEl.id = toastId;
  toastEl.className = "smart-toast-notification kh-text";

  let iconHtml = '<i class="fa-solid fa-bell"></i>';
  let toastBg = "background: #eff6ff; color: #3b82f6;";
  if (
    m.title.includes("Received") ||
    m.title.includes("Cashback") ||
    m.title.includes("ឈ្នះបាន")
  ) {
    iconHtml = '<i class="fa-solid fa-hand-holding-dollar"></i>';
    toastBg = "background: #ecfdf5; color: #10b981;";
  } else if (m.title.includes("Refund")) {
    iconHtml = '<i class="fa-solid fa-arrow-rotate-left"></i>';
    toastBg = "background: #f3e8ff; color: #9333ea;";
  }

  toastEl.innerHTML = `<div class="smart-toast-content"><div class="smart-toast-icon" style="${toastBg}">${iconHtml}</div><div class="smart-toast-text"><h4 class="kh-text">${escapeHTML(m.title)}</h4><p class="kh-text">${escapeHTML(m.message)}</p></div></div><div class="smart-toast-pull-bar"></div>`;
  document.body.appendChild(toastEl);
  setTimeout(() => {
    toastEl.style.top = "15px";
  }, 50);

  let toastTimer;
  const dismissToast = () => {
    toastEl.style.top = "-150px";
    setTimeout(() => toastEl.remove(), 400);
  };
  const startTimer = () => {
    toastTimer = setTimeout(dismissToast, 5000);
  };
  startTimer();

  toastEl.addEventListener("click", () => {
    if (!toastEl.classList.contains("expanding"))
      window.location.href = "history.html?tab=msg";
  });

  let startY = 0;
  toastEl.addEventListener(
    "touchstart",
    (e) => {
      startY = e.touches[0].clientY;
    },
    { passive: true },
  );
  toastEl.addEventListener(
    "touchmove",
    (e) => {
      if (startY - e.touches[0].clientY > 20) dismissToast();
    },
    { passive: true },
  );

  let pressTimer;
  const startLongPress = () => {
    clearTimeout(toastTimer);
    pressTimer = setTimeout(() => {
      toastEl.classList.add("expanding");
    }, 300);
  };
  const endLongPress = () => {
    clearTimeout(pressTimer);
    toastEl.classList.remove("expanding");
    startTimer();
  };
  toastEl.addEventListener("mousedown", startLongPress);
  toastEl.addEventListener("mouseup", endLongPress);
  toastEl.addEventListener("mouseleave", endLongPress);
  toastEl.addEventListener("touchstart", startLongPress, { passive: true });
  toastEl.addEventListener("touchend", endLongPress, { passive: true });
};

// ==========================================
// 🚀 មុខងារទូទាត់ និងឆ្លើយតប (GLOBAL ACTIONS)
// ==========================================

window.triggerGlobalSync = function () {
  window.lastNotifState = "";
  window.lastTrxState = "";
  window.lastCardState = "";
  if (typeof syncAllData === "function") syncAllData();
  else if (typeof loadDashboardData === "function") loadDashboardData(false);
  else window.location.reload();
};

window.respondUFundInvite = async function (fundId, uniqueKey, response) {
  try {
    Swal.close();
    Swal.fire({
      title: `<span class="kh-text">${window.t("processing")}</span>`,
      didOpen: () => Swal.showLoading(),
      allowOutsideClick: false,
      customClass: { popup: "premium-swal kh-text" },
    });
    const res = await fetch("/api/ufund/respond-invite", {
      method: "POST",
      headers: window.authHeaders,
      body: JSON.stringify({
        username: window.currentUser.username,
        fundId: fundId,
        notifId: uniqueKey,
        response: response,
      }),
    });
    const data = await res.json();
    if (data.success) {
      window.markNotifResponded(
        uniqueKey,
        response === "accept" ? "accepted" : "rejected",
      );
      Swal.fire({
        icon: "success",
        title: `<span class="kh-text">${window.t("ufund_success")}</span>`,
        html: `<span class="kh-text">${escapeHTML(data.message)}</span>`,
        timer: 2000,
        showConfirmButton: false,
        customClass: { popup: "kh-text premium-swal" },
      }).then(() => window.triggerGlobalSync());
    } else {
      Swal.fire({
        icon: "error",
        title: `<span class="kh-text">${window.t("swal_sorry_title") || "Error"}</span>`,
        html: `<span class="kh-text">${escapeHTML(data.message)}</span>`,
        customClass: { popup: "premium-swal kh-text" },
      }).then(() => window.triggerGlobalSync());
    }
  } catch (error) {
    Swal.fire("Error", "Server Connection Error", "error");
  }
};

window.handleJointInvite = async function (
  btnElement,
  ownerUsername,
  accountNumber,
  action,
  uniqueKey,
) {
  Swal.close();
  Swal.fire({
    title: `<span class="kh-text">${window.t("processing")}</span>`,
    didOpen: () => Swal.showLoading(),
    allowOutsideClick: false,
    customClass: { popup: "premium-swal kh-text" },
  });
  try {
    const res = await fetch("/api/account/joint/respond", {
      method: "POST",
      headers: window.authHeaders,
      body: JSON.stringify({
        inviteeUsername: window.currentUser.username,
        ownerUsername: ownerUsername,
        accountNumber: accountNumber,
        action: action,
      }),
    });
    const data = await res.json();
    if (data.success) {
      window.markNotifResponded(
        uniqueKey,
        action === "accept" ? "accepted" : "rejected",
      );
      Swal.fire({
        icon: "success",
        title: `<span class="kh-text">ជោគជ័យ</span>`,
        showConfirmButton: false,
        timer: 1500,
        customClass: { popup: "kh-text premium-swal" },
      }).then(() => window.triggerGlobalSync());
    } else {
      Swal.fire({
        icon: "error",
        title: "Error",
        html: `<span class="kh-text">${escapeHTML(data.message)}</span>`,
        customClass: { popup: "premium-swal kh-text" },
      }).then(() => window.triggerGlobalSync());
    }
  } catch (error) {
    Swal.fire("Error", "Server Connection Error", "error");
  }
};

window.handleOpenGift = async function (
  amount,
  currency,
  sender,
  msg,
  uniqueKey,
  senderUsername,
) {
  Swal.close();
  if (typeof confetti === "function")
    confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
  window.markNotifResponded(uniqueKey, "opened");
  const curSym = currency === "USD" ? "$" : "៛";
  const displayAmt =
    currency === "USD"
      ? Number(amount).toFixed(2)
      : Number(amount).toLocaleString();

  Swal.fire({
    html: `<div style="padding:20px; text-align:center;"><i class="fa-solid fa-gift" style="font-size:4.5rem; color:#dc2626; margin-bottom:15px; animation: tada 1s;"></i><h2 class="kh-text" style="color:#1e293b; font-weight:bold; margin-bottom: 20px;">SURPRISE! 🎁</h2><div style="font-size:3.5rem; font-weight:bold; color:#dc2626; font-family:'JetBrains Mono', monospace;">${curSym}${displayAmt}</div><p class="kh-text" style="color:#64748b; margin-top:10px;">${window.t("swal_gift_from")} <b>${sender}</b></p><div class="kh-text" style="background:#f8fafc; padding:15px; border-radius:12px; font-style:italic; margin-top:15px; color:#475569; font-weight: 500;">"${msg}"</div></div>`,
    confirmButtonText: `<span class="kh-text">${window.t("swal_btn_awesome")}</span>`,
    confirmButtonColor: "#004d40",
    customClass: { popup: "modal-radius premium-swal kh-text" },
  }).then(() => window.triggerGlobalSync());

  try {
    await fetch("/api/egift/opened", {
      method: "POST",
      headers: window.authHeaders,
      body: JSON.stringify({
        receiverName:
          window.currentUser.fullName || window.currentUser.username,
        senderUsername: senderUsername,
        notifId: uniqueKey,
      }),
    });
  } catch (e) {
    console.error(e);
  }
};

window.handleCardPaymentConfirm = async function (transactionId, uniqueKey) {
  Swal.close();
  if (typeof requestPinVerification === "function") {
    requestPinVerification(
      window.t("pin_enter_title"),
      window.t("pin_verify_desc"),
      async function (pinCode) {
        Swal.fire({
          title: `<span class="kh-text">${window.t("processing")}</span>`,
          allowOutsideClick: false,
          didOpen: () => Swal.showLoading(),
          customClass: { popup: "premium-swal kh-text" },
        });
        try {
          const res = await fetch("/api/gateway/payment-request/confirm", {
            method: "POST",
            headers: window.authHeaders,
            body: JSON.stringify({
              transactionId: transactionId,
              pin: pinCode,
            }),
          });
          const data = await res.json();
          if (data.success) {
            window.markNotifResponded(uniqueKey, "accepted");
            // 🌟 លែងត្រូវការបាញ់ API /api/user/notifications/read/... ទៀតហើយ
            // ព្រោះការ Update Status វាត្រូវបានគ្រប់គ្រងស្រាប់ដោយ backend Gateway ពេល confirm
            Swal.fire({
              icon: "success",
              title: `<span class="kh-text">${window.t("swal_pay_success_title")}</span>`,
              html: `<span class="kh-text">${window.t("card_pay_success_desc")}</span>`,
              customClass: { popup: "premium-swal kh-text" },
            }).then(() => window.triggerGlobalSync());
          } else {
            Swal.fire({
              icon: "error",
              title: `<span class="kh-text">${window.t("swal_sorry_title") || "Error"}</span>`,
              html: `<span class="kh-text">${escapeHTML(data.message)}</span>`,
              customClass: { popup: "premium-swal kh-text" },
            }).then(() => window.triggerGlobalSync());
          }
        } catch (e) {
          Swal.fire("Error", window.t("err_server_conn"), "error");
        }
      },
    );
  } else {
    Swal.fire("Error", "PIN Module missing!", "error");
  }
};

window.handleCardPaymentReject = async function (transactionId, uniqueKey) {
  Swal.close();
  Swal.fire({
    title: `<span class="kh-text">${window.t("swal_rejecting")}</span>`,
    didOpen: () => Swal.showLoading(),
    customClass: { popup: "premium-swal kh-text" },
  });
  try {
    await fetch("/api/gateway/payment-request/reject", {
      method: "POST",
      headers: window.authHeaders,
      body: JSON.stringify({ transactionId: transactionId }),
    });
    window.markNotifResponded(uniqueKey, "rejected");
    Swal.fire({
      icon: "info",
      title: `<span class="kh-text">${window.t("swal_pay_reject_title")}</span>`,
      html: `<span class="kh-text">${window.t("swal_pay_reject_desc")}</span>`,
      customClass: { popup: "premium-swal kh-text" },
    }).then(() => window.triggerGlobalSync());
  } catch (e) {
    Swal.fire("Error", window.t("err_server_conn"), "error");
  }
};

window.deleteMessage = function (title, date) {
  Swal.fire({
    title: `<span class="kh-text">${window.t("msg_delete_title")}</span>`,
    html: `<span class="kh-text">${window.t("msg_delete_desc")}</span>`,
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#dc2626",
    cancelButtonColor: "#94a3b8",
    confirmButtonText: `<span class="kh-text">${window.t("msg_btn_yes")}</span>`,
    cancelButtonText: `<span class="kh-text">${window.t("btn_cancel")}</span>`,
    customClass: { popup: "premium-swal kh-text" },
  }).then((result) => {
    if (result.isConfirmed) {
      let deletedMsgs =
        JSON.parse(
          localStorage.getItem(`deletedMsgs_${window.currentUser.username}`),
        ) || [];
      deletedMsgs.push(date + title);
      localStorage.setItem(
        `deletedMsgs_${window.currentUser.username}`,
        JSON.stringify(deletedMsgs),
      );
      window.triggerGlobalSync();
    }
  });
};
