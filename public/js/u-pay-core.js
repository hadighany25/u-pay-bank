// ==========================================
// 🧠 U-PAY CORE SYSTEM (ខួរក្បាលកណ្តាលរបស់ App)
// មុខងារ: ឆែកសុវត្ថិភាព, ប្តូរភាសា, Dark Mode, និងការពារការលោតពណ៌ស
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
  // ឆែកមើលថាតើ File lang.js ត្រូវបានភ្ជាប់ហើយឬនៅ
  if (typeof translations === "undefined") {
    console.warn(
      "⚠️ មិនទាន់មានទិន្នន័យភាសា (translations) ទេ។ សូមប្រាកដថាបានភ្ជាប់ js/lang.js នៅពីលើ u-pay-core.js",
    );
    return;
  }

  window.currentLang = localStorage.getItem("lang") || "en";

  // ចាប់យកគ្រប់ tags ដែលមានអត្តសញ្ញាណ data-i18n ឬ data-lang
  document.querySelectorAll("[data-i18n], [data-lang]").forEach((el) => {
    const key = el.getAttribute("data-i18n") || el.getAttribute("data-lang");

    if (
      translations[window.currentLang] &&
      translations[window.currentLang][key]
    ) {
      // បើវាជា Input Placeholder ឱ្យវាដូរ Placeholder
      if (el.tagName === "INPUT" && el.hasAttribute("placeholder")) {
        el.placeholder = translations[window.currentLang][key];
      } else {
        // បើជា Text ធម្មតា ដូរ Text ខាងក្នុង
        el.innerHTML = translations[window.currentLang][key];
      }
    }
  });

  // ប្តូរ Font តាមភាសា (ខ្មែរ ត្រូវការ Font Kantumruy Pro)
  if (window.currentLang === "kh") {
    document.body.style.fontFamily = "'Kantumruy Pro', sans-serif";
  } else {
    document.body.style.fontFamily = "'Inter', 'Kantumruy Pro', sans-serif";
  }
};

// ៤. ដំណើរការស្វ័យប្រវត្តិពេលទំព័រ (HTML) ដើរចប់
document.addEventListener("DOMContentLoaded", () => {
  // ដាក់ Theme និង ភាសា
  window.applyTheme();
  window.applyLanguage();

  // បង្ហាញ Body វិញយ៉ាងរលូន (ការពារកុំឱ្យលោតស ឬ FOUC)
  // តម្រូវឱ្យមាន CSS: body { visibility: hidden; opacity: 0; } body.loaded { visibility: visible; opacity: 1; }
  setTimeout(() => {
    document.body.classList.add("loaded");
  }, 50); // រង់ចាំ 50ms ឱ្យ CSS Render ចប់សព្វគ្រប់
});
