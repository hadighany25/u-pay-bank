// ==========================================
// 🧠 U-PAY CORE SYSTEM (ខួរក្បាលកណ្តាលរបស់ App)
// មុខងារ: ឆែកសុវត្ថិភាព, ប្តូរភាសា, Dark Mode, ការពារការលោតពណ៌ស និងចាំទទួលសំណើទូទាត់
// ==========================================

// ១. ឆែកសុវត្ថិភាព (JWT Token & Session)
const userString = sessionStorage.getItem("user");
const token = sessionStorage.getItem("userToken");

// ការពារកុំឱ្យវា Redirect បើកំពុងនៅទំព័រ Login (index.html) ស្រាប់
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

// ប្រកាសអថេរជា Global ដើម្បីឱ្យគ្រប់ទំព័រ (HTML) អាចហៅប្រើបានដោយមិនបាច់សរសេរឡើងវិញ
window.currentUser = userString ? JSON.parse(userString) : null;
window.authHeaders = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
};
window.currentLang = localStorage.getItem("lang") || "en";

// ២. មុខងារគ្រប់គ្រង Dark Mode តាម Account
window.applyTheme = function () {
  if (!window.currentUser) return;
  const userThemeKey = "darkMode_" + window.currentUser.username;
  const isDark =
    localStorage.getItem("theme") === "dark" ||
    localStorage.getItem(userThemeKey) === "true";

  if (isDark) {
    document.body.classList.add("dark-mode");
  } else {
    document.body.classList.remove("dark-mode");
  }
};

// ៣. មុខងារគ្រប់គ្រងការបកប្រែភាសា (Language)
window.applyLanguage = function () {
  if (typeof translations === "undefined") {
    console.warn(
      "⚠️ មិនទាន់មានទិន្នន័យភាសា (translations) ទេ។ សូមប្រាកដថាបានភ្ជាប់ js/lang.js នៅពីលើ u-pay-core.js",
    );
    return;
  }

  window.currentLang = localStorage.getItem("lang") || "en";

  document.querySelectorAll("[data-i18n], [data-lang]").forEach((el) => {
    const key = el.getAttribute("data-i18n") || el.getAttribute("data-lang");

    if (
      translations[window.currentLang] &&
      translations[window.currentLang][key]
    ) {
      if (el.tagName === "INPUT" && el.hasAttribute("placeholder")) {
        el.placeholder = translations[window.currentLang][key];
      } else {
        el.innerHTML = translations[window.currentLang][key];
      }
    }
  });

  if (window.currentLang === "kh") {
    document.body.style.fontFamily = "'Kantumruy Pro', sans-serif";
  } else {
    document.body.style.fontFamily = "'Inter', 'Kantumruy Pro', sans-serif";
  }
};

// ៤. ដំណើរការស្វ័យប្រវត្តិពេលទំព័រ (HTML) ដើរចប់
document.addEventListener("DOMContentLoaded", () => {
  window.applyTheme();
  window.applyLanguage();

  setTimeout(() => {
    document.body.classList.add("loaded");
  }, 50);
});

// ==========================================
// ៥. ភ្ជាប់ទៅកាន់ Socket.io សម្រាប់រង់ចាំទទួលសំណើទូទាត់ (Payment Gateway)
// ==========================================
if (window.currentUser && typeof io !== "undefined") {
  // ប្តូរ "https://u-pay-bank.fly.dev" ទៅតាម URL ពិតប្រាកដនៃ Backend U-Pay របស់បង
  const socket = io("https://u-pay-bank.fly.dev");

  // បញ្ចូល User ទៅក្នុងបន្ទប់ (Room) ផ្ទាល់ខ្លួន ដើម្បីរង់ចាំទទួលសារ
  socket.emit("joinRoom", window.currentUser.username);

  // រង់ចាំស្តាប់ពេលមានសំណើទូទាត់បាញ់ចូលមក
  socket.on("paymentRequest", (data) => {
    // ចាក់សំឡេង "ទីង" ផ្តល់ដំណឹង
    new Audio(
      "https://notificationsounds.com/storage/sounds/file-sounds-1148-juntos.mp3",
    )
      .play()
      .catch(() => {});

    // បង្ហាញផ្ទាំងសំណើឱ្យអតិថិជនសម្រេចចិត្ត
    Swal.fire({
      title: "សំណើទូទាត់ប្រាក់ 🔔",
      html: `
        <div style="font-family:'Kantumruy Pro'; font-size: 1rem; color: #1e293b;">
          ហាង <b>${data.merchantName}</b> បានស្នើសុំកាត់ប្រាក់ 
          <b style="color:#ef4444; font-size:1.3rem;">$${Number(data.amount).toFixed(2)}</b> 
          ពីកាតរបស់អ្នក។<br><br>
          <span style="font-size:0.85rem; color:#64748b;">លេខវិក្កយបត្រ៖ ${data.orderId}</span>
        </div>
      `,
      icon: "info",
      showCancelButton: true,
      confirmButtonText: "យល់ព្រម (Confirm)",
      cancelButtonText: "បដិសេធ (Reject)",
      confirmButtonColor: "#004d40",
      cancelButtonColor: "#ef4444",
      allowOutsideClick: false,
      customClass: { popup: "premium-swal" },
    }).then((result) => {
      // បើភ្ញៀវចុច "យល់ព្រម"
      if (result.isConfirmed) {
        if (typeof requestPinVerification === "function") {
          // លោតផ្ទាំងឱ្យវាយលេខ PIN ៤ ខ្ទង់
          requestPinVerification(
            "បញ្ចូលលេខសម្ងាត់",
            "បញ្ជាក់ការទូទាត់កាត",
            async function (pinCode) {
              Swal.fire({
                title: "កំពុងដំណើរការ...",
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading(),
              });

              try {
                // បាញ់ API ទៅប្រាប់ Backend ថាយល់ព្រម ហើយបញ្ជូន PIN ទៅឆែក
                const res = await fetch(
                  "/api/gateway/payment-request/confirm",
                  {
                    method: "POST",
                    headers: window.authHeaders,
                    body: JSON.stringify({
                      transactionId: data.transactionId,
                      pin: pinCode,
                    }),
                  },
                );
                const responseData = await res.json();

                if (responseData.success) {
                  Swal.fire("ជោគជ័យ", "ការទូទាត់បានជោគជ័យ!", "success").then(
                    () => {
                      window.location.reload(); // Refresh ទំព័រដើម្បីឃើញលុយត្រូវកាត់
                    },
                  );
                } else {
                  Swal.fire("បរាជ័យ", responseData.message, "error");
                }
              } catch (e) {
                Swal.fire("Error", "Server Error", "error");
              }
            },
          );
        } else {
          Swal.fire("Error", "មិនអាចស្វែងរកមុខងារវាយ PIN ឃើញទេ", "error");
        }
      }
      // បើភ្ញៀវចុច "បដិសេធ"
      else if (result.dismiss === Swal.DismissReason.cancel) {
        // បាញ់ API ប្រាប់ Backend ថាបដិសេធ
        fetch("/api/gateway/payment-request/reject", {
          method: "POST",
          headers: window.authHeaders,
          body: JSON.stringify({ transactionId: data.transactionId }),
        }).catch((e) => console.log(e));
      }
    });
  });
}
