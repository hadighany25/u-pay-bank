// វចនានុក្រម (Dictionary) សម្រាប់ប្តូរភាសា
const translations = {
  en: {
    "menu-main": "Main Menu",
    "menu-dash": "Dashboard",
    "menu-users": "User Management",
    "menu-ops": "Operations",
    "menu-checktrx": "Transaction Check",
    "menu-broadcast": "Broadcast History",
    "menu-finance": "Finance & Cards",
    "menu-fx": "Exchange Rates",
    "menu-fees": "Fee & Limits",
    "menu-promo": "Promo Codes",
    "menu-cards": "Card Management",
    "menu-security": "Security & Support",
    "menu-kyc": "KYC Approvals",
    "menu-tickets": "Support Tickets",
    "menu-chat": "Live Support Chat",
    "menu-super": "Super Admin Only",
    "menu-admins": "Admin Management",
    "menu-logs": "Audit Logs",
    "menu-system": "System Control",
    "menu-logout": "Secure Logout",

    // បន្ថែមពាក្យផ្សេងៗទៀតតាមក្រោយបាន...
    "dash-title": "Platform Overview",
  },
  km: {
    "menu-main": "ម៉ឺនុយចម្បង",
    "menu-dash": "ផ្ទាំងគ្រប់គ្រង",
    "menu-users": "គ្រប់គ្រងអតិថិជន",
    "menu-ops": "ប្រតិបត្តិការ",
    "menu-checktrx": "ពិនិត្យប្រតិបត្តិការ",
    "menu-broadcast": "ប្រវត្តិសារជូនដំណឹង",
    "menu-finance": "ហិរញ្ញវត្ថុ និងកាត",
    "menu-fx": "អត្រាប្តូរប្រាក់",
    "menu-fees": "កម្រៃសេវា និងកម្រិត",
    "menu-promo": "កូដប្រូម៉ូសិន",
    "menu-cards": "គ្រប់គ្រងកាត",
    "menu-security": "សុវត្ថិភាព និងជំនួយ",
    "menu-kyc": "ឯកសារបញ្ជាក់អត្តសញ្ញាណ",
    "menu-tickets": "សំបុត្រជំនួយ (Tickets)",
    "menu-chat": "ឆាតគាំទ្រអតិថិជន",
    "menu-super": "សម្រាប់តែមេធំប៉ុណ្ណោះ",
    "menu-admins": "គ្រប់គ្រងបុគ្គលិក",
    "menu-logs": "ប្រវត្តិសកម្មភាព (Logs)",
    "menu-system": "គ្រប់គ្រងប្រព័ន្ធ (System)",
    "menu-logout": "ចាកចេញ (Logout)",

    "dash-title": "ទិដ្ឋភាពទូទៅនៃប្រព័ន្ធ",
  },
};

let currentLang = localStorage.getItem("adminLang") || "en";

function toggleLanguage() {
  currentLang = currentLang === "en" ? "km" : "en";
  localStorage.setItem("adminLang", currentLang);
  applyLanguage();
}

function applyLanguage() {
  const elements = document.querySelectorAll("[data-i18n]");
  elements.forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (translations[currentLang] && translations[currentLang][key]) {
      // បើជាប្រអប់ Input លោតចូល Placeholder
      if (el.tagName === "INPUT" && el.hasAttribute("placeholder")) {
        el.placeholder = translations[currentLang][key];
      } else {
        // បើជា Text ធម្មតា (យើងរក្សា Icon ទុកដដែល)
        const icon = el.querySelector("i");
        el.innerHTML =
          (icon ? icon.outerHTML + " " : "") + translations[currentLang][key];
      }
    }
  });

  // ដូរអក្សរលើប៊ូតុង
  document.querySelectorAll(".lang-text").forEach((span) => {
    span.innerText = currentLang === "en" ? "KH" : "EN";
  });
}

document.addEventListener("DOMContentLoaded", applyLanguage);
