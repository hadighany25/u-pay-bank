// ==========================================
// 🔔 GLOBAL IN-APP NOTIFICATION SYSTEM (U-PAY)
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
  // ១. បង្កើត Container សម្រាប់ Notification ឱ្យនៅចំកណ្តាល App 480px
  if (!document.getElementById("global-toast-container")) {
    const toastContainer = document.createElement("div");
    toastContainer.id = "global-toast-container";
    toastContainer.style.cssText = `
      position: fixed;
      top: 15px;
      left: 50%;
      transform: translateX(-50%);
      width: 92%;
      max-width: 440px;
      z-index: 100000;
      display: flex;
      flex-direction: column;
      gap: 10px;
      pointer-events: none;
    `;
    document.body.appendChild(toastContainer);

    // ២. បញ្ចូល CSS Animations & Styles សម្រាប់ Toast
    const style = document.createElement("style");
    style.innerHTML = `
      .global-toast {
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(15px);
        border-radius: 20px;
        padding: 15px 18px;
        display: flex;
        align-items: center;
        gap: 15px;
        box-shadow: 0 15px 35px rgba(0,0,0,0.1);
        border: 1px solid rgba(0,0,0,0.05);
        pointer-events: auto;
        cursor: pointer;
        animation: slideDownFade 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
        transition: transform 0.2s, opacity 0.2s;
        touch-action: pan-y;
      }
      body.dark-mode .global-toast {
        background: rgba(30, 41, 59, 0.95);
        border: 1px solid rgba(255,255,255,0.1);
        box-shadow: 0 15px 35px rgba(0,0,0,0.5);
      }
      .global-toast.hiding {
        animation: slideUpFade 0.3s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
      }
      .toast-icon {
        width: 45px; height: 45px; border-radius: 14px;
        display: flex; align-items: center; justify-content: center; 
        font-size: 1.3rem; flex-shrink: 0;
      }
      .toast-content { flex: 1; overflow: hidden; }
      .toast-title { 
        margin: 0; font-size: 0.95rem; font-weight: 700; 
        color: #1e293b; font-family: 'Inter', sans-serif;
      }
      body.dark-mode .toast-title { color: #f8fafc; }
      .toast-message { 
        margin: 3px 0 0; font-size: 0.85rem; color: #64748b; 
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis; 
        font-family: 'Kantumruy Pro', 'Inter', sans-serif;
      }
      body.dark-mode .toast-message { color: #94a3b8; }
      .toast-pull-bar {
        position: absolute; bottom: 4px; left: 50%; transform: translateX(-50%);
        width: 30px; height: 3px; background: rgba(0,0,0,0.1); border-radius: 10px;
      }
      body.dark-mode .toast-pull-bar { background: rgba(255,255,255,0.2); }
      
      @keyframes slideDownFade {
        0% { opacity: 0; transform: translateY(-40px) scale(0.9); }
        100% { opacity: 1; transform: translateY(0) scale(1); }
      }
      @keyframes slideUpFade {
        0% { opacity: 1; transform: translateY(0) scale(1); }
        100% { opacity: 0; transform: translateY(-40px) scale(0.9); }
      }
    `;
    document.head.appendChild(style);
  }
});

// ៣. មុខងារសម្រាប់ហៅ Notification ឱ្យលោតចេញមក
// type អាចជា: "receive", "send", "chat", "system"
window.showAppNotification = function (title, message, type, actionData) {
  const container = document.getElementById("global-toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = "global-toast";

  // រៀបចំ Icon និងពណ៌តាមប្រភេទសារ
  let iconHtml = "";
  if (type === "receive") {
    iconHtml = `<div class="toast-icon" style="background:#ecfdf5; color:#10b981;"><i class="fa-solid fa-hand-holding-dollar"></i></div>`;
  } else if (type === "send") {
    iconHtml = `<div class="toast-icon" style="background:#fef2f2; color:#ef4444;"><i class="fa-solid fa-paper-plane"></i></div>`;
  } else if (type === "chat") {
    iconHtml = `<div class="toast-icon" style="background:#eff6ff; color:#3b82f6;"><i class="fa-solid fa-message"></i></div>`;
  } else {
    iconHtml = `<div class="toast-icon" style="background:#f1f5f9; color:#64748b;"><i class="fa-solid fa-bell"></i></div>`;
  }

  toast.innerHTML = `
    ${iconHtml}
    <div class="toast-content">
      <h4 class="toast-title">${title}</h4>
      <p class="toast-message">${message}</p>
    </div>
    <div class="toast-pull-bar"></div>
  `;

  // 🖱️ មុខងារចុចលើ Notification (Click to Action)
  toast.onclick = () => {
    if (type === "receive" || type === "send") {
      // បើមានមុខងារ Slip ឱ្យបើក Slip
      if (typeof openGlobalSlip === "function" && actionData) {
        const sessionUser = JSON.parse(sessionStorage.getItem("user"));
        openGlobalSlip(actionData, sessionUser ? sessionUser.username : "User");
      } else {
        window.location.href = "dashboard.html"; // ទៅមុខ History
      }
    } else if (type === "chat") {
      window.location.href = "chat.html";
    } else {
      window.location.href = "dashboard.html";
    }
    hideToast(toast);
  };

  // 👆 មុខងារអូសឡើងលើដើម្បីបិទ (Swipe Up to Dismiss)
  let startY = 0;
  let currentY = 0;
  let isDragging = false;

  toast.addEventListener(
    "touchstart",
    (e) => {
      startY = e.touches[0].clientY;
      isDragging = true;
      toast.style.transition = "none"; // បិទ Animation ពេលកំពុងអូស
    },
    { passive: true },
  );

  toast.addEventListener(
    "touchmove",
    (e) => {
      if (!isDragging) return;
      currentY = e.touches[0].clientY;
      const diff = currentY - startY;
      if (diff < 0) {
        // អនុញ្ញាតឱ្យអូសតែឡើងលើ
        toast.style.transform = `translateY(${diff}px)`;
        toast.style.opacity = 1 + diff / 100; // ធ្វើឱ្យរាងព្រាលៗពេលអូសឡើង
      }
    },
    { passive: true },
  );

  toast.addEventListener("touchend", (e) => {
    isDragging = false;
    toast.style.transition = "transform 0.2s, opacity 0.2s";
    const diff = currentY - startY;
    if (diff < -25) {
      // បើអូសឡើងលើស 25px គឺបិទវាតែម្តង
      hideToast(toast);
    } else {
      // បើអូសតិចតួច លែងដៃវាលោតមកកន្លែងដើមវិញ
      toast.style.transform = "translateY(0)";
      toast.style.opacity = 1;
    }
  });

  // ដាក់ Notification ចូលក្នុងអេក្រង់
  container.appendChild(toast);

  // លេងសំឡេង
  const soundUrl =
    type === "chat"
      ? "https://notificationsounds.com/storage/sounds/file-sounds-1150-pristine.mp3"
      : "https://notificationsounds.com/storage/sounds/file-sounds-1148-juntos.mp3";
  new Audio(soundUrl).play().catch(() => {});

  // ⏱️ បាត់ទៅវិញដោយស្វ័យប្រវត្តិក្នុងរយៈពេល 3 វិនាទីកន្លះ
  setTimeout(() => {
    if (toast.parentElement) hideToast(toast);
  }, 3500);

  function hideToast(element) {
    element.classList.add("hiding");
    setTimeout(() => {
      if (element.parentElement) element.remove();
    }, 300); // រង់ចាំ Animation ចប់ទើបលុបចេញពី DOM
  }
};
