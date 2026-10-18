// ============================================================================
// ឯកសារ: js/admin-lang.js (100% Enterprise Bilingual Engine - KH / EN)
// អត្ថន័យ: គ្រប់គ្រងការបកប្រែភាសា (ខ្មែរ ⇄ អង់គ្លេស) ទូទាំងប្រព័ន្ធ U-PAY Admin ទាំង ១៧ ផ្ទាំង
// ============================================================================

const translations = {
  // ==========================================================================
  // 🇬🇧 ENGLISH DICTIONARY (ភាសាអង់គ្លេស)
  // ==========================================================================
  en: {
    // ១. Sidebar Menu & Topbar Controls
    "menu-main": "MAIN MENU",
    "menu-dash": "Dashboard",
    "menu-users": "User Management",
    "menu-customer-360": "Customer 360°",
    "menu-merchants": "Merchant Hub",
    "menu-ops": "BANKING OPERATIONS",
    "menu-cashier": "Cashier Desk",
    "menu-checktrx": "Transaction Check",
    "menu-cards": "Cards Command Center",
    "menu-finance": "TREASURY & PROMO",
    "menu-fx": "FX Exchange Rates",
    "menu-fees": "Fees & Limits",
    "menu-promo": "Promo & Vouchers",
    "menu-broadcast": "Broadcast Center",
    "menu-security": "KYC & SUPPORT",
    "menu-kyc": "KYC Compliance",
    "menu-tickets": "Support Tickets",
    "menu-chat": "Live Support Chat",
    "menu-super": "SUPER ADMIN",
    "menu-admins": "Staff IAM & Audit",
    "menu-logs": "System Audit Logs",
    "menu-system": "System Freeze Control",
    "menu-logout": "Secure Logout",
    "sb-collapse": "Collapse Menu",
    "sb-expand": "Expand Menu",
    "sb-search-ph": "Quick search menu...",

    // ២. [ផ្ទាំង ០១] Executive Dashboard
    "dash-title": "Executive Banking Command & Analytics Center",
    "sys-live-badge": "SYSTEM ONLINE (LIVE)",
    "preset-today": "Today",
    "preset-7d": "7 Days",
    "preset-30d": "30 Days",
    "preset-year": "This Year",
    "preset-all": "All-Time",
    "date-to": "To",
    "csv-report": "CSV Report",
    "hero-liquidity": "TOTAL CLIENT LIQUIDITY IN SYSTEM",
    "hero-volume": "PERIOD TRANSACTION VOLUME",
    "hero-revenue": "BANK FEE & ISSUANCE REVENUE",
    "total-users": "Total Users",
    "active-today": "Online Now",
    "new-registrations": "New Users",
    "pending-approvals": "Pending Action",
    "total-transactions": "Total Transactions",
    "total-transfers": "P2P Transfers",
    "total-withdrawals": "Withdrawals",
    "fixed-deposits": "Fixed Deposits",
    "issued-cards": "Issued Bank Cards",
    "registered-merchants": "Partner Merchants",
    "broadcasts-sent": "Broadcasts Sent",
    "frozen-accounts": "Frozen Accounts",
    "trx-volume": "Cashflow & Transaction Volume Analytics",
    "chart-vol-btn": "Volume ($)",
    "chart-cnt-btn": "Trx Count",
    "channel-ratio-title": "Transaction Ratio by Channel",
    "recent-activity": "Live Real-Time Transaction Stream",
    "top-leaderboards": "Top System Leaderboards",
    "top-users-btn": "Top Customers",
    "top-merchants-btn": "Top Merchants",

    // ៣. [ផ្ទាំង ០២] User Management
    "user-management": "Customer Directory & Account Control",
    "user-mgmt-desc":
      "Manage customer accounts, KYC status, balances, and security permissions.",
    "btn-create-user": "Create New Account",
    "filter-all-users": "All Customers",
    "filter-active-users": "Active",
    "filter-frozen-users": "Frozen",
    "filter-pending-kyc": "Pending KYC",
    "filter-unverified-kyc": "Unverified KYC",
    "search-ph": "Search...",
    "btn-prev": "Previous",
    "btn-next": "Next",
    "create-user-form-title": "Customer Account Creation Form",
    "create-user-form-sub": "Please fill in all required fields below (*)",
    "btn-submit-new-user": "Create Account Now",
    "main-accounts-title": "Main Accounts",
    "contact-info-title": "Contact Information",
    "quick-actions-title": "Quick Actions",
    "btn-direct-msg": "Direct Message",
    "btn-force-logout": "Force Logout",
    "btn-view-c360": "View Full Profile (Customer 360°)",
    "btn-delete-user": "Delete This Account",

    // ៤. [ផ្ទាំង ០៣] Transaction Forensics Hub
    "trx-verification": "Transaction Verification & Forensics Hub",
    "trx-verification-desc":
      "Trace real-time ledger records, approve pending transfers, release merchant holds, or issue refunds.",
    "btn-refresh-data": "Refresh Data",
    trace: "Deep Trace Server",

    // ៥. [ផ្ទាំង ០៤] Customer 360° View
    "c360-title": "Customer 360° Intelligence View",
    "c360-desc":
      "Search and analyze complete 360-degree customer profile, wallets, cards, and logs.",
    "search-c360-ph": "Enter phone number, account number, or @username...",
    "btn-search": "Search",
    "tab-info": "Profile Info",
    "tab-finance": "Wallets & Sub-Accounts",
    "tab-cards": "Bank Cards",
    "tab-trx": "Transactions",
    "tab-kyc": "KYC Documents",
    "tab-security": "Security & Logs",
    "tab-merchant": "Merchant Shops",

    // ៦. [ផ្ទាំង ០៥] Cashier System
    "cashier-sys-title": "Bank Cashier & Teller System",
    "cashier-sys-desc":
      "Process over-the-counter cash deposits, withdrawals, and Maker-Checker approvals.",
    "tab-teller-desk": "Teller Desk",
    "tab-approvals": "Verification & Approvals",

    // ៧. [ផ្ទាំង ០៦] Broadcast Command Center
    "broadcast-history": "System-Wide Broadcast Command Center",
    "manage-broadcasts":
      "Send push announcements, promotions, or maintenance alerts to all users simultaneously.",
    "send-broadcast": "New Broadcast",
    "loading-history": "Loading broadcast history...",
    action: "Actions",

    // ៨. [ផ្ទាំង ០៧ & ០៨] Merchant Hub
    "merchant-title": "Business & Merchant Management Hub",
    "merchant-desc":
      "Monitor partner shops, sales revenue, escrow holds, QR stands, and API credentials.",
    "btn-register-shop": "Register New Shop",

    // ៩. [ផ្ទាំង ០៩] FX Treasury Desk
    "fx-settings": "International FX Treasury & Market Desk",
    "fx-desc":
      "Configure official bank exchange rates (USD ⇄ KHR) and live international currency board.",
    "save-rates": "Save All Exchange Rates",
    "usd-to-khr-buy": "Bank Buy USD Rate (USD to KHR - Buy)",
    "bank-buys-usd":
      "Applied when customers convert or transfer from USD ($) to KHR (៛)",
    "usd-to-khr-sell": "Bank Sell USD Rate (USD to KHR - Sell)",
    "bank-sells-usd":
      "Applied when customers convert or transfer from KHR (៛) to USD ($)",

    // ១០. [ផ្ទាំង ១០] Fees & Limits Engine
    "fee-transfer-limits": "Fee Schedule & Transfer Limit Policy Engine",
    "manage-fee-limits":
      "Manage global daily transfer ceilings and tiered transfer fee schedules (USD ⇄ KHR).",
    "save-settings": "Save All Settings",
    "daily-transfer-limit": "Maximum Daily Outbound Transfer Limit",
    "from-amount": "Min Amount (From)",
    "to-amount": "Max Amount (To)",
    fee: "Transfer Fee",

    // ១១. [ផ្ទាំង ១១] Promo & Voucher Hub
    "promo-codes": "Promo Codes & Marketing Voucher Hub",
    "manage-promo-codes":
      "Create and manage digital promotional vouchers to reward U-Pay customers.",
    "create-new-code": "Create Promo Code",
    "promo-code": "Voucher Code",
    reward: "Reward & Total Distributed",
    usage: "Redemption Progress",
    status: "Status",

    // ១២. [ផ្ទាំង ១២] Card Command Center
    "card-cmd-title": "Bank Card Command Center",
    "card-cmd-desc":
      "Manage Virtual, Debit, and Credit cards, physical fulfillment steps, and NFC chips.",
    "btn-issue-card": "Issue New Card",

    // ១៣. [ផ្ទាំង ១៣] KYC Compliance Hub
    "kyc-hub-title": "KYC Identity Verification & Compliance Hub",
    "kyc-hub-desc":
      "Verify National ID cards and selfies under Maker-Checker policy and detect duplicate IDs.",

    // ១៤. [ផ្ទាំង ១៤ & ១៥] Support Tickets & Live Chat
    "support-tickets": "Customer Support Tickets Helpdesk",
    "respond-to-user-disputes":
      "Monitor and resolve customer inquiries and dispute tickets across the platform.",
    "ticket-id": "Ticket ID",
    customer: "Customer",
    subject: "Subject & Summary",
    priority: "Priority",
    "support-messages": "Support Messages",
    "loading-contacts": "Loading contacts...",
    "select-customer": "Select a customer to chat",
    "select-message": "Please select a conversation from the left list",

    // ១៥. [ផ្ទាំង ១៦ & ១៧] Admin IAM & Audit Logs
    "admin-management": "Staff IAM, Permissions & Audit Hub",
    "manage-admin-accounts":
      "Manage staff accounts, working shifts, NFC badges, and staff activity reports.",
    "create-new-admin": "Create Staff Account",
    name: "Staff Profile",
    role: "Role & Department",
    "working-hours": "Working Shift & Status",
    "loading-admins": "Loading staff accounts...",
    "admin-audit-logs": "Security & Admin Audit Logs Center",
    "track-admin-activities":
      "Automatically record and inspect every administrative action across the system.",
    "reload-data": "Reload Data",
    date: "Date & Timestamp",
    "admin-account": "Operator (Admin)",
    target: "Target Entity",
    details: "Audit Details",
    "loading-logs": "Loading audit logs...",
  },

  // ==========================================================================
  // 🇰🇭 KHMER DICTIONARY (ភាសាខ្មែរ)
  // ==========================================================================
  km: {
    // ១. Sidebar Menu & Topbar Controls
    "menu-main": "ម៉ឺនុយគោល (MAIN MENU)",
    "menu-dash": "ផ្ទាំងគ្រប់គ្រង (Dashboard)",
    "menu-users": "គ្រប់គ្រងអតិថិជន (Users)",
    "menu-customer-360": "អតិថិជន 360° (Customer 360°)",
    "menu-merchants": "ដៃគូហាងទំនិញ (Merchants)",
    "menu-ops": "ប្រតិបត្តិការធនាគារ (OPERATIONS)",
    "menu-cashier": "បេឡាករ (Cashier Desk)",
    "menu-checktrx": "ឆែកប្រតិបត្តិការ (Trx Check)",
    "menu-cards": "គ្រប់គ្រងកាត (Cards Hub)",
    "menu-finance": "ហិរញ្ញវត្ថុ & ទីផ្សារ (TREASURY & PROMO)",
    "menu-fx": "អត្រាប្តូរប្រាក់ (FX Rates)",
    "menu-fees": "កម្រៃសេវា & Limit (Fees)",
    "menu-promo": "កូដប្រូម៉ូសិន (Promo Codes)",
    "menu-broadcast": "សារជូនដំណឹង (Broadcast)",
    "menu-security": "អត្តសញ្ញាណ & ជំនួយ (KYC & SUPPORT)",
    "menu-kyc": "អនុម័ត KYC (KYC Approvals)",
    "menu-tickets": "សំណូមពរអតិថិជន (Tickets)",
    "menu-chat": "ជជែកផ្ទាល់ (Live Chat)",
    "menu-super": "រដ្ឋបាលជាន់ខ្ពស់ (SUPER ADMIN)",
    "menu-admins": "គ្រប់គ្រងបុគ្គលិក (Staff IAM)",
    "menu-logs": "កំណត់ហេតុប្រព័ន្ធ (Audit Logs)",
    "menu-system": "បិទ/បើកប្រព័ន្ធ (System)",
    "menu-logout": "ចាកចេញពីប្រព័ន្ធ (Logout)",
    "sb-collapse": "បង្រួមម៉ឺនុយ",
    "sb-expand": "លាតម៉ឺនុយ",
    "sb-search-ph": "ស្វែងរកម៉ឺនុយរហ័ស...",

    // ២. [ផ្ទាំង ០១] Executive Dashboard
    "dash-title":
      "មជ្ឈមណ្ឌលបញ្ជាការ និងវិភាគទិន្នន័យធនាគារ (Executive Overview)",
    "sys-live-badge": "ប្រព័ន្ធដំណើរការធម្មតា (LIVE)",
    "preset-today": "ថ្ងៃនេះ",
    "preset-7d": "៧ ថ្ងៃ",
    "preset-30d": "៣០ ថ្ងៃ",
    "preset-year": "ឆ្នាំនេះ",
    "preset-all": "សរុបទាំងអស់",
    "date-to": "ដល់",
    "csv-report": "របាយការណ៍ CSV",
    "hero-liquidity": "មូលនិធិអតិថិជនសរុបក្នុងប្រព័ន្ធ (TOTAL LIQUIDITY)",
    "hero-volume": "ទំហំចរាចរណ៍សាច់ប្រាក់ (PERIOD TRX VOLUME)",
    "hero-revenue": "ប្រាក់ចំណូលធនាគារពីថ្លៃសេវា (BANK REVENUE)",
    "total-users": "អតិថិជនសរុប (Total Users)",
    "active-today": "កំពុងសកម្ម (Online Now)",
    "new-registrations": "ចុះឈ្មោះថ្មី (New Users)",
    "pending-approvals": "រង់ចាំអនុម័ត (Pending Action)",
    "total-transactions": "ប្រតិបត្តិការសរុប (Transactions)",
    "total-transfers": "វេរប្រាក់ P2P (Transfers)",
    "total-withdrawals": "ទឹកប្រាក់ដកចេញ (Withdrawals)",
    "fixed-deposits": "បញ្ញើមានកាលកំណត់ (Fixed Dep)",
    "issued-cards": "កាតធនាគារសរុប (Issued Cards)",
    "registered-merchants": "ដៃគូហាងទំនិញ (Merchants)",
    "broadcasts-sent": "សារជូនដំណឹង (Broadcasts)",
    "frozen-accounts": "គណនីជាប់បង្កក (Frozen)",
    "trx-volume":
      "ក្រាហ្វវិភាគលំហូរសាច់ប្រាក់ និងប្រតិបត្តិការ (Cashflow & Volume Analytics)",
    "chart-vol-btn": "ទំហំទឹកប្រាក់ ($)",
    "chart-cnt-btn": "ចំនួនប្រតិបត្តិការ",
    "channel-ratio-title": "សមាមាត្រប្រតិបត្តិការតាមសេវាកម្ម",
    "recent-activity":
      "ផ្ទាំងតាមដានប្រតិបត្តិការផ្ទាល់ (Live Transaction Stream)",
    "top-leaderboards": "ចំណាត់ថ្នាក់កំពូល (Top Leaderboards)",
    "top-users-btn": "កំពូលអតិថិជន",
    "top-merchants-btn": "កំពូលហាងទំនិញ",

    // ៣. [ផ្ទាំង ០២] User Management
    "user-management": "បញ្ជីគ្រប់គ្រងគណនីអតិថិជន (User Directory)",
    "user-mgmt-desc": "គ្រប់គ្រងគណនី ស្ថានភាព និងសិទ្ធិរបស់អតិថិជន។",
    "btn-create-user": "បង្កើតគណនីថ្មី",
    "filter-all-users": "អតិថិជនទាំងអស់",
    "filter-active-users": "ធម្មតា (Active)",
    "filter-frozen-users": "ផ្អាក (Frozen)",
    "filter-pending-kyc": "រង់ចាំ KYC (Pending)",
    "filter-unverified-kyc": "មិនទាន់ KYC",
    "search-ph": "ស្វែងរក...",
    "btn-prev": "ថយក្រោយ",
    "btn-next": "បន្ទាប់",
    "create-user-form-title": "ទម្រង់បង្កើតគណនីអតិថិជន",
    "create-user-form-sub": "សូមបញ្ចូលព័ត៌មានខាងក្រោមទាំងអស់ជាការចាំបាច់ (*)",
    "btn-submit-new-user": "បង្កើតគណនីឥឡូវនេះ",
    "main-accounts-title": "គណនីគោល (Main Accounts)",
    "contact-info-title": "ព័ត៌មានទំនាក់ទំនង",
    "quick-actions-title": "សកម្មភាពរហ័ស (Quick Actions)",
    "btn-direct-msg": "ផ្ញើសារផ្ទាល់",
    "btn-force-logout": "ផ្តាច់គណនី",
    "btn-view-c360": "មើលប្រវត្តិលម្អិត (Customer 360°)",
    "btn-delete-user": "លុបគណនីនេះចោល",

    // ៤. [ផ្ទាំង ០៣] Transaction Forensics Hub
    "trx-verification":
      "មជ្ឈមណ្ឌលត្រួតពិនិត្យ និងផ្ទៀងផ្ទាត់ប្រតិបត្តិការ (Transaction Forensics Hub)",
    "trx-verification-desc":
      "ឆែកតាមដានប្រភពប្រតិបត្តិការពិតប្រាកដ (Real-Time Ledger) អនុម័តប្រតិបត្តិការ Pending ដោះ Hold ហាង និងបង្វិលប្រាក់សងអតិថិជន។",
    "btn-refresh-data": "ធ្វើបច្ចុប្បន្នភាពទិន្នន័យ",
    trace: "ឆែកវិក្កយបត្រស៊ីជម្រៅ (Trace Server)",

    // ៥. [ផ្ទាំង ០៤] Customer 360° View
    "c360-title": "ទិដ្ឋភាពអតិថិជន 360° (Customer 360° View)",
    "c360-desc": "ស្វែងរក និងវិភាគព័ត៌មានអតិថិជនលម្អិតគ្រប់ជ្រុងជ្រោយ។",
    "search-c360-ph": "វាយលេខទូរស័ព្ទ, លេខគណនី ឬ Username...",
    "btn-search": "ស្វែងរក",
    "tab-info": "ព័ត៌មាន (Info)",
    "tab-finance": "ហិរញ្ញវត្ថុ (Wallets)",
    "tab-cards": "កាត (Cards)",
    "tab-trx": "ប្រតិបត្តិការ (Trx)",
    "tab-kyc": "ឯកសារ (KYC)",
    "tab-security": "សន្តិសុខ (Security)",
    "tab-merchant": "ហាង (Merchant)",

    // ៦. [ផ្ទាំង ០៥] Cashier System
    "cashier-sys-title": "ប្រព័ន្ធបេឡាករ (Cashier System)",
    "cashier-sys-desc": "គ្រប់គ្រងការដាក់/ដកប្រាក់ និងអនុម័តប្រតិបត្តិការធំៗ។",
    "tab-teller-desk": "បញ្ជរប្រតិបត្តិការ (Teller Desk)",
    "tab-approvals": "ត្រួតពិនិត្យ & អនុម័ត (Approvals)",

    // ៧. [ផ្ទាំង ០៦] Broadcast Command Center
    "broadcast-history":
      "មជ្ឈមណ្ឌលបញ្ជូនសារជូនដំណឹងទូទាំងប្រព័ន្ធ (Broadcast Command Center)",
    "manage-broadcasts":
      "ផ្ញើសារជូនដំណឹង សារប្រូម៉ូសិន ឬដំណឹងថែទាំប្រព័ន្ធទៅកាន់គ្រប់គណនីអតិថិជនទាំងអស់ក្នុងពេលតែមួយ និងគ្រប់គ្រងប្រវត្តិសារ។",
    "send-broadcast": "ផ្ញើសារ Broadcast ថ្មី",
    "loading-history": "កំពុងទាញយកប្រវត្តិសារ Broadcast...",
    action: "សកម្មភាពគ្រប់គ្រង",

    // ៨. [ផ្ទាំង ០៧ & ០៨] Merchant Hub
    "merchant-title": "មជ្ឈមណ្ឌលគ្រប់គ្រងអាជីវកម្ម និងហាងទំនិញ (Merchant Hub)",
    "merchant-desc":
      "ត្រួតពិនិត្យហាងទំនិញ ចំណូលការលក់ ប្រតិបត្តិការជាប់ Hold, QR Stand និង API Credentials ទូទាំងប្រព័ន្ធ។",
    "btn-register-shop": "ចុះឈ្មោះហាងថ្មីជូនអតិថិជន",

    // ៩. [ផ្ទាំង ០៩] FX Treasury Desk
    "fx-settings":
      "មជ្ឈមណ្ឌលគ្រប់គ្រងអត្រាប្តូរប្រាក់អន្តរជាតិ (FX Treasury & Market Desk)",
    "fx-desc":
      "កំណត់អត្រាប្តូរប្រាក់ផ្លូវការរបស់ធនាគារ (USD ⇄ KHR) និងតារាងអត្រាប្តូរប្រាក់អន្តរជាតិផ្ទាល់ (Live Market Board)។",
    "save-rates": "រក្សាទុកអត្រាប្តូរប្រាក់ទាំងអស់",
    "usd-to-khr-buy": "អត្រាទិញប្រាក់ដុល្លារចូល (USD to KHR - Buy)",
    "bank-buys-usd":
      "ប្រើពេលអតិថិជនប្តូរ ឬផ្ទេរពីគណនីដុល្លារ ($1) ទៅជាប្រាក់រៀល (៛)",
    "usd-to-khr-sell": "អត្រាលក់ប្រាក់ដុល្លារចេញ (USD to KHR - Sell)",
    "bank-sells-usd":
      "ប្រើពេលអតិថិជនយកប្រាក់រៀល (៛) មកទិញ ឬផ្ទេរចូលគណនីដុល្លារ ($1)",

    // ១០. [ផ្ទាំង ១០] Fees & Limits Engine
    "fee-transfer-limits":
      "មជ្ឈមណ្ឌលកំណត់កម្រៃសេវា និងដែនកំណត់ផ្ទេរប្រាក់ (Fee & Limit Policy Engine)",
    "manage-fee-limits":
      "គ្រប់គ្រងពិដានទឹកប្រាក់អតិបរមាប្រចាំថ្ងៃ និងតារាងកម្រៃសេវាផ្ទេរប្រាក់តាមកម្រិតទឹកប្រាក់ (Tiered Pricing) ដោយគណនា USD ⇄ KHR ស្វ័យប្រវត្តិ។",
    "save-settings": "រក្សាទុកការកំណត់ទាំងអស់",
    "daily-transfer-limit": "ពិដានទឹកប្រាក់វេរចេញសរុប (ក្នុង ១ ថ្ងៃ)",
    "from-amount": "ចាប់ពីចំនួនទឹកប្រាក់ (Min Amount)",
    "to-amount": "រហូតដល់ចំនួនទឹកប្រាក់ (Max Amount)",
    fee: "កាត់ថ្លៃសេវា (Transfer Fee)",

    // ១១. [ផ្ទាំង ១១] Promo & Voucher Hub
    "promo-codes":
      "មជ្ឈមណ្ឌលគ្រប់គ្រងកូដប្រូម៉ូសិន និងរង្វាន់ (Promo & Voucher Hub)",
    "manage-promo-codes":
      "បង្កើត និងគ្រប់គ្រងកូដប្រូម៉ូសិន (Vouchers) ដើម្បីទាក់ទាញអតិថិជនថ្មី ឬចែករង្វាន់ពិសេសក្នុងប្រព័ន្ធ U-Pay។",
    "create-new-code": "បង្កើតកូដប្រូម៉ូសិនថ្មី",
    "promo-code": "លេខកូដប្រូម៉ូសិន (Voucher Code)",
    reward: "ទឹកប្រាក់រង្វាន់ & ចំណាយសរុប",
    usage: "ចំនួនអ្នកប្រើប្រាស់ (Redemption Progress)",
    status: "ស្ថានភាពកូដ",

    // ១២. [ផ្ទាំង ១២] Card Command Center
    "card-cmd-title": "មជ្ឈមណ្ឌលគ្រប់គ្រងកាតទាំងអស់ (Card Command Center)",
    "card-cmd-desc":
      "គ្រប់គ្រងកាតនិម្មិត (Virtual), កាតឥណពន្ធ (Debit), កាតឥណទាន (Credit), ការដឹកជញ្ជូន និងបន្ទះឈីប NFC ទូទាំងប្រព័ន្ធ។",
    "btn-issue-card": "បង្កើតកាតថ្មីជូនអតិថិជន",

    // ១៣. [ផ្ទាំង ១៣] KYC Compliance Hub
    "kyc-hub-title":
      "មជ្ឈមណ្ឌលត្រួតពិនិត្យ និងអនុម័តអត្តសញ្ញាណ (KYC Compliance Hub)",
    "kyc-hub-desc":
      "ពិនិត្យផ្ទៀងផ្ទាត់ឯកសារអត្តសញ្ញាណប័ណ្ណ រូបថត Selfie តាមគោលការណ៍ Maker-Checker និងគ្រប់គ្រងអត្តសញ្ញាណប័ណ្ណស្ទួន។",

    // ១៤. [ផ្ទាំង ១៤ & ១៥] Support Tickets & Live Chat
    "support-tickets": "មជ្ឈមណ្ឌលគ្រប់គ្រងសំណូមពរ (Support Tickets)",
    "respond-to-user-disputes":
      "ត្រួតពិនិត្យ និងឆ្លើយតបរបាយការណ៍បញ្ហារបស់អតិថិជនទាំងអស់ក្នុងប្រព័ន្ធ។",
    "ticket-id": "លេខសំបុត្រ (Ticket ID)",
    customer: "អតិថិជន (Customer)",
    subject: "ប្រធានបទ និងខ្លឹមសារសង្ខេប",
    priority: "កម្រិត (Priority)",
    "support-messages": "សារជំនួយអតិថិជន (Support Messages)",
    "loading-contacts": "កំពុងទាញយកបញ្ជីទំនាក់ទំនង...",
    "select-customer": "ជ្រើសរើសអតិថិជនដើម្បីឆាត",
    "select-message": "សូមជ្រើសរើសសារពីបញ្ជីខាងឆ្វេង",

    // ១៥. [ផ្ទាំង ១៦ & ១៧] Admin IAM & Audit Logs
    "admin-management":
      "មជ្ឈមណ្ឌលគ្រប់គ្រងបុគ្គលិក សិទ្ធិប្រើប្រាស់ និងរបាយការណ៍ (Admin IAM & Audit Hub)",
    "manage-admin-accounts":
      "គ្រប់គ្រងគណនីបុគ្គលិក កំណត់ម៉ោងធ្វើការ កាតសម្គាល់ខ្លួន NFC តាមដានប្រវត្តិសកម្មភាព (Logs) និងរបាយការណ៍ការងារបុគ្គលិក។",
    "create-new-admin": "បង្កើតគណនីបុគ្គលិកថ្មី",
    name: "ព័ត៌មានបុគ្គលិក (Staff Profile)",
    role: "តួនាទី & នាយកដ្ឋាន (Role & Dept)",
    "working-hours": "ម៉ោងធ្វើការ & វេនបច្ចុប្បន្ន",
    "loading-admins": "កំពុងទាញយកទិន្នន័យបុគ្គលិក...",
    "admin-audit-logs": "មជ្ឈមណ្ឌលតាមដានសកម្មភាពបុគ្គលិក (Admin Audit Logs)",
    "track-admin-activities":
      "កត់ត្រា និងត្រួតពិនិត្យរាល់ប្រតិបត្តិការកែប្រែរបស់បុគ្គលិក Admin ទាំងអស់ក្នុងប្រព័ន្ធដោយស្វ័យប្រវត្តិ។",
    "reload-data": "ទាញយកទិន្នន័យថ្មី",
    date: "កាលបរិច្ឆេទ & ម៉ោង",
    "admin-account": "ប្រតិបត្តិករ (Admin)",
    target: "គោលដៅ (Target)",
    details: "ព័ត៌មានលម្អិត (Audit Details)",
    "loading-logs": "កំពុងទាញយកទិន្នន័យ...",
  },
};

// ============================================================================
// 🔄 វចនានុក្រមបកប្រែឃ្លាស្វ័យប្រវត្តិ (Auto Phrase Map សម្រាប់កន្លែងគ្មាន data-i18n)
// ============================================================================
const AUTO_PHRASE_PAIRS = [
  ["ថ្ងៃនេះ", "Today"],
  ["៧ ថ្ងៃ", "7 Days"],
  ["៣០ ថ្ងៃ", "30 Days"],
  ["ឆ្នាំនេះ", "This Year"],
  ["សរុបទាំងអស់", "All-Time"],
  ["ទាំងអស់ (All)", "All"],
  ["ទាំងអស់", "All"],
  ["ថយក្រោយ", "Previous"],
  ["បន្ទាប់", "Next"],
  ["ធ្វើបច្ចុប្បន្នភាពទិន្នន័យ", "Refresh Data"],
  ["ធ្វើបច្ចុប្បន្នភាព", "Refresh"],
  ["ទាញយក CSV", "Export CSV"],
  ["របាយការណ៍ CSV", "CSV Report"],
  ["សម្អាត", "Clear"],
  ["ស្វែងរក", "Search"],
  ["បង្រួមម៉ឺនុយ", "Collapse Menu"],
  ["លាតម៉ឺនុយ", "Expand Menu"],
  ["ចំណាត់ថ្នាក់កំពូល (Top Leaderboards)", "Top System Leaderboards"],
  ["កំពូលអតិថិជន", "Top Customers"],
  ["កំពូលហាងទំនិញ", "Top Merchants"],
  ["សមាមាត្រប្រតិបត្តិការតាមសេវាកម្ម", "Transaction Ratio by Channel"],
  ["ទំហំទឹកប្រាក់ ($)", "Volume ($)"],
  ["ចំនួនប្រតិបត្តិការ", "Trx Count"],
];

let currentLang = localStorage.getItem("adminLang") || "km";

function toggleLanguage() {
  currentLang = currentLang === "en" ? "km" : "en";
  localStorage.setItem("adminLang", currentLang);
  applyLanguage();
}

function applyLanguage() {
  const dict = translations[currentLang] || translations.km;

  // ១. បកប្រែគ្រប់ធាតុដែលមាន Attribute [data-i18n] ដោយរក្សាទុក Icon មិនឱ្យបាត់
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    const translated = dict[key];
    if (!translated) return;

    if (
      (el.tagName === "INPUT" || el.tagName === "TEXTAREA") &&
      el.hasAttribute("placeholder")
    ) {
      el.placeholder = translated;
      return;
    }

    const icon = el.querySelector("i");
    if (icon && el.children.length === 1) {
      el.innerHTML = `${icon.outerHTML} <span>${translated}</span>`;
    } else if (el.children.length === 0) {
      el.textContent = translated;
    } else {
      // បើមានធាតុកូនច្រើន កែតែ Text Node ដើម្បីកុំឱ្យដាច់ Event ឬបាត់ Badge
      let updatedText = false;
      el.childNodes.forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE && node.nodeValue.trim() !== "") {
          node.nodeValue = " " + translated + " ";
          updatedText = true;
        }
      });
      if (!updatedText) {
        const span = el.querySelector("span:not(.adash-pulse-dot)");
        if (span) span.textContent = translated;
      }
    }
  });

  // ២. បកប្រែស្វ័យប្រវត្តិសម្រាប់ប៊ូតុង និងផ្ទាំងដែលមិនទាន់មាន data-i18n
  document
    .querySelectorAll(
      "button, .adash-preset-btn, .atrx-filter-pill, .abroad-filter-pill, .gm-filter-pill, .apromo-filter-pill, .gc-filter-pill, .gkyc-filter-pill, .aadm-filter-pill, .alogs-filter-pill",
    )
    .forEach((btn) => {
      if (btn.hasAttribute("data-i18n")) return;
      btn.childNodes.forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          const raw = node.nodeValue.trim();
          if (!raw) return;
          AUTO_PHRASE_PAIRS.forEach(([kmTxt, enTxt]) => {
            if (currentLang === "en" && raw === kmTxt) {
              node.nodeValue = node.nodeValue.replace(kmTxt, enTxt);
            } else if (currentLang === "km" && raw === enTxt) {
              node.nodeValue = node.nodeValue.replace(enTxt, kmTxt);
            }
          });
        }
      });
    });

  // ៣. ប្តូរអក្សរលើប៊ូតុងភាសា (KH / EN)
  document.querySelectorAll(".lang-text").forEach((span) => {
    span.innerText = currentLang === "en" ? "KH" : "EN";
  });

  // ៤. ធ្វើបច្ចុប្បន្នភាពអក្សរលើប៊ូតុងបង្រួមម៉ឺនុយ
  if (typeof updateCollapseButtonUI === "function") {
    updateCollapseButtonUI();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(applyLanguage, 80);
});
