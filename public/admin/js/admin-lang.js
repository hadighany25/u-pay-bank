// វចនានុក្រម (Dictionary) សម្រាប់ប្តូរភាសា
const translations = {
  en: {
    "menu-main": "Main Menu",
    "menu-dash": "Dashboard",
    "menu-users": "User Management",
    "menu-ops": "Operations",
    "menu-checktrx": "Transaction Check",
    "menu-cashier": "Cashier (Deposit/Withdraw)",
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
    "Real-time": "Real-time statistics and insights for U-Pay.",
    "total-users": "Total Users",
    "active-today": "Active Today",
    "new-registrations": "New Registrations",
    "system-funds": "System Funds",
    "fixed-deposits": "Fixed Deposits",
    "system-revenue": "System Revenue",
    "total-transactions": "Total Transactions",
    "pending-approvals": "Pending Approvals",
    "total-withdrawals": "Total Withdrawals",
    "broadcasts-sent": "Broadcasts Sent",
    "total-transfers": "Total Transfers",
    "frozen-accounts": "Frozen Accounts",
    "user-mgmt": "User Mgmt",
    "trx-check": "Trx Check",
    broadcast: "Broadcast",
    "exchange-rates": "Exchange Rates",
    "cards-mgmt": "Cards Mgmt",
    "custom-role": "Custom Role",
    "promo-reward": "ទឹកប្រាក់រង្វាន់ (Reward Value in $)",
    "promo-max-usage": "ចំនួនអ្នកអាចប្រើបានអតិបរមា (Max Usage)",
    "promo-expiry": "ថ្ងៃផុតកំណត់ (Expiry Date) - មិនដាក់ក៏បាន",
    cancel: "Cancel",
    "create-promo-code": "Create Promo Code",
    save: "Save",
    "menu-merchants": "Merchant Mgmt",
    "merchant-title": "Merchant Management",
    "merchant-desc":
      "Manage business accounts, approve shops, and monitor activities.",
    "shop-info": "Shop / Merchant Info",
    "owner-info": "Owner / Account",
    "merchant-balance": "Balance",
    "dash-title": "Platform Overview",
    "menu-customer-360": "Customer 360°",
    "c360-title": "Customer 360° View",
    "c360-desc": "Search and view complete details of a customer.",
    "search-c360-ph": "Search by name, username, phone, or account...",
    "tab-finance": "Wallets & Cards",
    "tab-kyc": "KYC & Identity",
    "tab-trx": "Transactions",
    "tab-security": "Security",
    "tab-logs": "Admin Logs",
    "revoke-kyc": "Revoke KYC",
  },
  km: {
    "menu-main": "ម៉ឺនុយចម្បង",
    "menu-dash": "ផ្ទាំងគ្រប់គ្រង",
    "menu-users": "គ្រប់គ្រងអតិថិជន",
    "menu-ops": "ប្រតិបត្តិការ",
    "menu-checktrx": "ពិនិត្យប្រតិបត្តិការ",
    "menu-cashier": "បេឡាករ (ដាក់/ដកប្រាក់)",
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
    "menu-super": "សម្រាប់អ្នកគ្រប់គ្រងកំពូល",
    "menu-admins": "គ្រប់គ្រងបុគ្គលិក",
    "menu-logs": "ប្រវត្តិសកម្មភាព (Logs)",
    "menu-system": "គ្រប់គ្រងប្រព័ន្ធ (System)",
    "menu-logout": "ចាកចេញ (Logout)",
    "dash-title": "ទិដ្ឋភាពទូទៅនៃប្រព័ន្ធ",
    "Real-time": "ស្ថិតិ និងការយល់ដឹងពេលវេលាពិតសម្រាប់ U-Pay",
    "total-users": "អ្នកប្រើប្រាស់សរុប",
    "active-today": "សកម្មថ្ងៃនេះ",
    "new-registrations": "ការចុះឈ្មោះថ្មី",
    "system-funds": "មូលនិធិប្រព័ន្ធ",
    "fixed-deposits": "ការដាក់ត្រា",
    "system-revenue": "ចំណូលប្រព័ន្ធ",
    "total-transactions": "ប្រតិបត្តិការសរុប",
    "pending-approvals": "ការអនុម័តដែលរងចាំ",
    "total-withdrawals": "ការទទួលបានសរុប",
    "broadcasts-sent": "ប្រវត្តិសារជូនដំណឹង",
    "total-transfers": "ការផ្លាស់ប្ដូរសរុប",
    "frozen-accounts": "គណនីដែលត្រូវបានកាត់",
    "user-mgmt": "គ្រប់គ្រងអតិថិជន",
    "trx-check": "ពិនិត្យប្រតិបត្តិការ",
    broadcast: "ប្រវត្តិសារជូនដំណឹង",
    "exchange-rates": "អត្រាប្តូរប្រាក់",
    "cards-mgmt": "គ្រប់គ្រងកាត",
    "custom-role": "តួនាទីផ្ទាល់ខ្លួន",
    "promo-reward": "ទឹកប្រាក់រង្វាន់ (Reward Value in $)",
    "promo-max-usage": "ចំនួនអ្នកអាចប្រើបានអតិបរមា (Max Usage)",
    "promo-expiry": "ថ្ងៃផុតកំណត់ (Expiry Date) - មិនដាក់ក៏បាន",
    cancel: "បោះបង់",
    "create-promo-code": "បង្កើតកូដប្រូម៉ូសិន",
    save: "រក្សាទុក",
    "menu-merchants": "គ្រប់គ្រងអាជីវកម្ម",
    "merchant-title": "ការគ្រប់គ្រងអាជីវកម្ម (Merchant)",
    "merchant-desc": "គ្រប់គ្រងគណនីហាង អនុម័តអាជីវកម្ម និងតាមដានសកម្មភាព។",
    "shop-info": "ព័ត៌មានហាង",
    "owner-info": "ម្ចាស់ហាង / គណនី",
    "merchant-balance": "សមតុល្យហាង",
    "menu-customer-360": "ត្រួតពិនិត្យអតិថិជន 360°",
    "c360-title": "ទិដ្ឋភាពអតិថិជន ៣៦០ដឺក្រេ",
    "c360-desc": "ស្វែងរក និងមើលព័ត៌មានលម្អិតទាំងអស់របស់អតិថិជន។",
    "search-c360-ph": "ស្វែងរកតាមឈ្មោះ, Username, ទូរស័ព្ទ, ឬគណនី...",
    "tab-finance": "គណនី & កាត",
    "tab-kyc": "ឯកសារ KYC",
    "tab-trx": "ប្រតិបត្តិការ",
    "tab-security": "សុវត្ថិភាព",
    "tab-logs": "កំណត់ត្រា Admin",
    "revoke-kyc": "បដិសេធ KYC វិញ",
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
      // ត្រួតពិនិត្យរកមើល Icon មុនពេលជំនួសអត្ថបទ
      const icon = el.querySelector("i");
      const iconHtml = icon ? icon.outerHTML : "";

      // បើជាប្រអប់ Input លោតចូល Placeholder
      if (el.tagName === "INPUT" && el.hasAttribute("placeholder")) {
        el.placeholder = translations[currentLang][key];
      } else {
        // បញ្ចូល Icon មកវិញ រួចតាមដោយអត្ថបទបកប្រែ
        el.innerHTML = iconHtml + " " + translations[currentLang][key];
      }
    }
  });

  // ដូរអក្សរលើប៊ូតុង
  document.querySelectorAll(".lang-text").forEach((span) => {
    span.innerText = currentLang === "en" ? "KH" : "EN";
  });
}

document.addEventListener("DOMContentLoaded", applyLanguage);
