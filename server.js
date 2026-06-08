const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
const multer = require("multer"); // 💡 បានថែមជូនដើម្បីជួសជុល Error 'multer is not defined' របស់ប្អូន

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// 🌐 CONFIGURATIONS & MIDDLEWARES
// ==========================================

// URL របស់ PayHub KH
const PAYHUB_URL = "https://payhub-kh.onrender.com";

// អនុញ្ញាតឱ្យរាល់ Website ទាំងអស់ (រួមទាំង PAYHUB) អាចទាញទិន្នន័យបាន
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json()); // សម្រាប់ឱ្យ Server អានទិន្នន័យ JSON បាន

// បម្រើឯកសារនៅក្នុង Folder public
app.use(express.static(path.join(__dirname, "public")));

// មុខងារសម្រាប់គ្រប់គ្រងការ Upload រូបភាព (Multer Configuration)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "public", "uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, "IMG-" + Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage: storage });

// ==========================================
// 🟢 ១. លីងភ្ជាប់ទៅកាន់ MongoDB Atlas
// ==========================================
const MONGO_URI =
  "mongodb+srv://hadighany25_db_user:9zFpD1cbPGKqzyKW@cluster0.wuilm9.mongodb.net/upay_db?appName=Cluster0";

mongoose
  .connect(MONGO_URI)
  .then(() => console.log("🟢 [MongoDB] Connected Successfully to Cloud!"))
  .catch((err) => console.error("🔴 [MongoDB] Connection Error:", err));

// ==========================================
// 🗄️ MONGOOSE MODELS & SCHEMAS
// ==========================================

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    fullName: { type: String, default: "" },
    phone: { type: String, default: "" },
    pin: { type: String, default: "1111" },
    accountNumber: { type: String, unique: true },
    accountNumberKHR: { type: String, unique: true },
    balance: { type: Number, default: 0 },
    balanceKHR: { type: Number, default: 0 },
    role: { type: String, default: "user" },
    trxLimit: { type: Number, default: 100 },
    profileImage: { type: String, default: "" },
    isFrozen: { type: Boolean, default: false },
    isOnline: { type: Boolean, default: false },
    pinAttempts: { type: Number, default: 0 },
    transactions: { type: Array, default: [] },
    notifications: { type: Array, default: [] },
    tickets: { type: Array, default: [] },
    kycStatus: { type: String, default: "pending" },
    needsSupport: { type: Boolean, default: false },
  },
  { timestamps: true },
);

const User = mongoose.model("User", userSchema);

const ChatSchema = new mongoose.Schema({
  id: String,
  senderAcc: String,
  receiverAcc: String,
  message: String,
  adminName: String,
  time: String,
  timestamp: Number,
  isRead: Boolean,
});
const Chat = mongoose.model("Chat", ChatSchema);

let tempForgotOtps = {}; // ផ្ទុកលេខកូដ OTP បណ្តោះអាសន្នលើ Memory Server
// ==========================================
// ⚙️ ១. ការកំណត់ទូទៅ (SERVER CONFIGURATION)
// ==========================================
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(express.static("public"));
// 💡 ១. ត្រូវដាក់ CORS នៅខាងលើគេបង្អស់ មុននឹង Middleware ផ្សេងៗរត់
app.use(
  cors({
    origin: "*", // អនុញ្ញាតឱ្យរាល់គ្រប់ Domain ទាំងអស់ (រួមទាំង PAYHUB) អាច Fetch ចូលបាន
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// 💡 ២. បន្ទាប់មកទើបដាក់ពួក express.json
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(express.static("public"));

// ទីតាំង File ទិន្នន័យ
const DATA_FILE = path.join(__dirname, "data", "users.json");
const SETTINGS_FILE = path.join(__dirname, "data", "settings.json");

// ==========================================
// ⚙️ SYSTEM SETTINGS (GLOBAL FREEZE)
// ==========================================
const SYSTEM_FILE = path.join(__dirname, "data", "system.json");

const readSystemStatus = () => {
  if (!fs.existsSync(SYSTEM_FILE)) {
    fs.writeFileSync(SYSTEM_FILE, JSON.stringify({ isSystemFrozen: false }));
    return { isSystemFrozen: false };
  }
  try {
    return JSON.parse(fs.readFileSync(SYSTEM_FILE));
  } catch (e) {
    return { isSystemFrozen: false };
  }
};

const writeSystemStatus = (data) => {
  fs.writeFileSync(SYSTEM_FILE, JSON.stringify(data, null, 2));
};

// API សម្រាប់ឆែកស្ថានភាពប្រព័ន្ធ
app.get("/api/system-status", (req, res) => {
  res.json(readSystemStatus());
});

// API សម្រាប់ Admin ចុចបិទ/បើកប្រព័ន្ធផ្ទេរប្រាក់
app.post("/api/admin/toggle-system", (req, res) => {
  const current = readSystemStatus();
  current.isSystemFrozen = !current.isSystemFrozen; // ឆ្លាស់គ្នា (បើកទៅបិទ បិទទៅបើក)
  writeSystemStatus(current);
  res.json({ success: true, isSystemFrozen: current.isSystemFrozen });
});

// ==========================================
// 🛠 ២. មុខងារជំនួយ (HELPER FUNCTIONS)
// ==========================================
const readData = () => {
  if (!fs.existsSync(DATA_FILE)) {
    if (!fs.existsSync(path.join(__dirname, "data")))
      fs.mkdirSync(path.join(__dirname, "data"));
    fs.writeFileSync(DATA_FILE, "[]");
    return [];
  }
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE));
  } catch (e) {
    return [];
  }
};

const writeData = (data) => {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
};

const readSettings = () => {
  if (!fs.existsSync(SETTINGS_FILE)) {
    const defaultSettings = { fx: { usdToKhrBuy: 4050, usdToKhrSell: 4100 } };
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(defaultSettings, null, 2));
    return defaultSettings;
  }
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_FILE));
  } catch (e) {
    return { fx: { usdToKhrBuy: 4050, usdToKhrSell: 4100 } };
  }
};
const writeSettings = (data) => {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2));
};

const getFormattedDate = () => {
  return new Date().toLocaleString("en-US", {
    timeZone: "Asia/Phnom_Penh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
};

const getDevice = (ua) => {
  if (!ua) return "Unknown";
  if (ua.includes("iPhone")) return "iPhone";
  if (ua.includes("Android")) return "Android";
  if (ua.includes("Windows")) return "PC (Windows)";
  if (ua.includes("Mac")) return "Mac";
  return "Web Browser";
};

const generateRefId = () =>
  Math.floor(1000000000 + Math.random() * 9000000000).toString();
const generateHash = () => {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 8; i++)
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
};

// ==========================================
// 🏢 ៣. បង្កើតគណនីក្រុមហ៊ុន និងធនាគារកណ្តាល (AUTO INIT SYSTEM ACCOUNTS)
// ==========================================
const initSystemAccounts = () => {
  let users = readData();
  let updated = false;

  // ៣.១ បង្កើតក្រុមហ៊ុនទូទាត់ទឹកភ្លើង
  const billers = [
    { username: "EDC", accountNumber: "100000001" },
    { username: "PPWSA", accountNumber: "100000002" },
    { username: "Internet", accountNumber: "100000003" },
    { username: "Fashion Shop", accountNumber: "100000004" },
  ];

  billers.forEach((b) => {
    if (!users.find((u) => u.username === b.username)) {
      users.push({
        id: "BILLER-" + b.username,
        username: b.username,
        password: "123",
        accountNumber: b.accountNumber,
        balance: 0.0,
        role: "biller",
        pin: "0000",
        profileImage: "",
        isFrozen: false,
        transactions: [],
        lastActive: new Date().toISOString(),
      });
      updated = true;
      console.log(`✅ Created Biller: ${b.username}`);
    }
  });

  // 🔥 ៣.២ បង្កើត U-Pay Central Bank អូតូ ដើម្បីឱ្យការដាក់ដកលុយដើរ ១០០%
  if (!users.find((u) => u.accountNumber === "888888888")) {
    users.push({
      id: "sys_central_bank",
      username: "centralbank",
      fullName: "U-Pay Central Bank",
      accountNumber: "888888888",
      accountNumberKHR: "988888888",
      balance: 1000000000, // លុយប្រព័ន្ធ $1B
      balanceKHR: 4000000000000, // លុយប្រព័ន្ធ 4 Trillion ៛
      role: "admin",
      pin: "1234",
      profileImage: "images/logo.png",
      isFrozen: false,
      transactions: [],
      deposits: [],
    });
    updated = true;
    console.log(`🏦 U-Pay Central Bank Created!`);
  }

  if (updated) writeData(users);
};
initSystemAccounts();

// ==========================================
// 🤖 ៤. មុខងារ TELEGRAM BOT
// ==========================================
const token = "8786350689:AAEncWXnaMjzk1QpMyZmo_Censsu4DVHSG0";
const bot = new TelegramBot(token, { polling: true });

bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text ? msg.text.trim() : "";

  if (text.length === 4 && !isNaN(text)) {
    let users = readData();
    let userLinked = false;

    for (let i = 0; i < users.length; i++) {
      if (users[i].linkCode === text) {
        users[i].telegramChatId = chatId;
        users[i].linkCode = null;
        userLinked = true;
        bot.sendMessage(
          chatId,
          `🎉 អបអរសាទរ! គណនី U-Pay (<b>${users[i].username}</b>) ត្រូវបានភ្ជាប់ជោគជ័យ!`,
          { parse_mode: "HTML" },
        );
        console.log(
          `✅ Linked: Account: ${users[i].username}, Group: ${chatId}`,
        );
        break;
      }
    }
    if (userLinked) writeData(users);
  }
});

app.post("/api/generate-telegram-code", (req, res) => {
  const { username } = req.body;
  let users = readData();
  const userIndex = users.findIndex((u) => u.username === username);
  if (userIndex !== -1) {
    const randomCode = Math.floor(1000 + Math.random() * 9000).toString();
    users[userIndex].linkCode = randomCode;
    writeData(users);
    res.json({ success: true, code: randomCode });
  } else res.json({ success: false, message: "User not found" });
});

app.post("/api/unlink-telegram", (req, res) => {
  const { username } = req.body;
  let users = readData();
  const userIndex = users.findIndex((u) => u.username === username);
  if (userIndex !== -1) {
    const oldChatId = users[userIndex].telegramChatId;
    users[userIndex].telegramChatId = null;
    writeData(users);
    if (oldChatId)
      bot
        .sendMessage(
          oldChatId,
          `⚠️ គណនី U-Pay (<b>${username}</b>) ត្រូវបានផ្តាច់!`,
          { parse_mode: "HTML" },
        )
        .catch((e) => console.log(e));
    res.json({ success: true });
  } else res.json({ success: false, message: "User not found" });
});

// ==========================================
// 🔐 ៥. ផ្នែកចូលគណនី (AUTH & USER LOGIN)
// ==========================================

// 🔥 មុខងារបង្កើតលេខគណនីថ្មី (Random Prefix: 100100..., 200200..., 800800...)
const generatePatternAccounts = (users) => {
  let isUnique = false;
  let newAccUSD = "";
  let newAccKHR = "";

  while (!isUnique) {
    // ជ្រើសរើសក្បាលលេខចៃដន្យពី 1 ដល់ 9
    const n = Math.floor(Math.random() * 9) + 1;
    const prefix = `${n}00${n}00`; // វានឹងចេញជា: 100100, 200200, 500500...

    // ជ្រើសរើសកន្ទុយចៃដន្យ ៣ ខ្ទង់ (ចាប់ពី 100 ដល់ 990 ដើម្បីងាយស្រួលបូក ១)
    const suffix = Math.floor(Math.random() * 890) + 100; // វានឹងចេញជា: 105, 450, 990...

    // ផ្គុំចូលគ្នា
    const baseAcc = parseInt(prefix + suffix.toString());

    newAccUSD = baseAcc.toString(); // ឧទាហរណ៍: 200200450
    newAccKHR = (baseAcc + 1).toString(); // ឧទាហរណ៍: 200200451

    // 🛡️ ឆែកមើលក្រែងលោវា Random ទៅជាន់នឹងលេខដែលមានស្រាប់ក្នុងប្រព័ន្ធ
    const exists = users.some(
      (u) =>
        u.accountNumber === newAccUSD ||
        u.accountNumberKHR === newAccUSD ||
        u.accountNumber === newAccKHR ||
        u.accountNumberKHR === newAccKHR,
    );

    // បើអត់ជាន់គេទេ អនុញ្ញាតឱ្យប្រើប្រាស់បាន (Loop នឹងឈប់)
    if (!exists) {
      isUnique = true;
    }
  }

  return { usd: newAccUSD, khr: newAccKHR };
};

app.post("/api/register", async (req, res) => {
  // 💡 ថែមពាក្យ async នៅត្រង់នេះ
  const { username, password, fullName, phone, pin } = req.body;

  try {
    // 🔍 ១. ឆែកមើលថាតើមាន Username នេះក្នុង MongoDB ហើយឬនៅ
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.json({ success: false, message: "Username already taken!" });
    }

    // 🔄 ២. ទាញយកទិន្នន័យ User ទាំងអស់ពី MongoDB មកជា Array មួយភ្លែត ដើម្បីយកទៅឱ្យអនុគមន៍បង្កើតលេខកុងអូតូដំណើរការ
    const users = await User.find({});

    // 🔥 ហៅមុខងារបង្កើតលេខកុងអូតូតាម Pattern ថ្មី (ទុកដដែល)
    const newAccs = generatePatternAccounts(users);

    // 🛡️ ការពារទី ១: កុង USD និង KHR របស់គាត់ផ្ទាល់ហាមដូចគ្នា (ទុកដដែល)
    if (newAccs.usd === newAccs.khr) {
      return res.json({
        success: false,
        message: "ប្រព័ន្ធមានបញ្ហា! លេខគណនី USD និង KHR មិនអាចដូចគ្នាទេ។",
      });
    }

    // 🛡️ ការពារទី ២: ហាមជាន់នឹងលេខគណនីរបស់អ្នកផ្សេង (ទុកដដែល)
    const isDuplicate = users.some(
      (u) =>
        u.accountNumber === newAccs.usd ||
        u.accountNumberKHR === newAccs.usd ||
        u.accountNumber === newAccs.khr ||
        u.accountNumberKHR === newAccs.khr,
    );

    if (isDuplicate) {
      return res.json({
        success: false,
        message: "ប្រព័ន្ធមានបញ្ហា! លេខគណនីនេះត្រូវបានប្រើប្រាស់រួចហើយ។",
      });
    }

    // 📝 ៣. រៀបចំទិន្នន័យបង្កើត User ថ្មីទៅតាមទម្រង់ចាស់ ១០០%
    const newUser = new User({
      username,
      password,
      fullName: fullName || username,
      phone,
      pin,
      accountNumber: newAccs.usd,
      accountNumberKHR: newAccs.khr,
      balance: 0.0,
      balanceKHR: 0.0,
      role: "user",
      trxLimit: 1000.0, // រក្សាទុកតម្លៃចាស់របស់ប្អូន
      profileImage: "",
      isFrozen: false,
      isOnline: false,
      pinAttempts: 0,
      transactions: [],
      // 💡 ចំណាំ៖ joinDate និង lastActive ប្អូនអាចប្រើ timestamps របស់ MongoDB ឬដាក់បែបនេះក៏បាន
      joinDate: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      telegramChatId: null,
      linkCode: null,
      kycStatus: "unverified",
    });

    // 💾 ៤. បញ្ជាឱ្យរក្សាទុក (Save) ទៅលើ Cloud MongoDB Atlas
    await newUser.save();

    // 🎉 ឆ្លើយតបទៅកាន់ Frontend វិញយ៉ាងជោគជ័យ
    res.json({ success: true, user: newUser });
  } catch (err) {
    console.error("Register Error:", err);
    res
      .status(500)
      .json({ success: false, message: "Server មានបញ្ហាក្នុងការចុះឈ្មោះ!" });
  }
});

// ==========================================
// 1. API សម្រាប់ Login (ឆែកជាមួយ MongoDB)
// ==========================================
app.post("/api/login", async (req, res) => {
  // 💡 ថែម async
  const { identifier, password } = req.body;

  // 🛡️ រក្សាទុកគណនី Admin ដដែល ១០០%
  if (identifier === "admin" && password === "123") {
    return res.json({
      success: true,
      user: {
        username: "Admin",
        role: "admin",
        balance: 999999,
        accountNumber: "HQ-001",
      },
    });
  }

  try {
    // 🔍 ស្វែងរកក្នុង MongoDB តាមរយៈ Username, លេខទូរស័ព្ទ ឬ ឈ្មោះពេញ និងផ្ទៀងផ្ទាត់ Password
    const user = await User.findOne({
      $or: [
        { username: identifier },
        { phone: identifier },
        { fullName: identifier },
      ],
      password: password,
    });

    if (user) {
      if (user.isFrozen) {
        return res.json({ success: false, message: "Account Frozen!" });
      }

      // 🟢 កែប្រែស្ថានភាពទៅជា Online លើ Cloud
      user.isOnline = true;
      user.lastActive = new Date().toISOString();
      await user.save(); // 💾 រក្សាទុកការផ្លាស់ប្តូរចូល MongoDB

      res.json({ success: true, user });
    } else {
      res.json({ success: false, message: "Invalid Credentials" });
    }
  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ success: false, message: "Server មានបញ្ហាឡកអ៊ីន" });
  }
});

// ==========================================
// 2. API សម្រាប់ Logout (ដូរស្ថានភាពលើ Cloud)
// ==========================================
app.post("/api/logout", async (req, res) => {
  // 💡 ថែម async
  const { username } = req.body;

  try {
    // 🔍 រកមើល User រួចកែទៅជា Offline
    const user = await User.findOne({ username });
    if (user) {
      user.isOnline = false;
      await user.save(); // 💾 រក្សាទុកចូល MongoDB
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: "Logout Error" });
  }
});

// ==========================================
// 3. API សម្រាប់ Heartbeat (រក្សាការ Active លើ Cloud)
// ==========================================
app.post("/api/heartbeat", async (req, res) => {
  // 💡 ថែម async
  const { username } = req.body;

  try {
    // 🔍 រកមើល User រួចធ្វើបច្ចុប្បន្នភាពថ្ងៃខែចុងក្រោយ
    const user = await User.findOne({ username });
    if (user) {
      user.lastActive = new Date().toISOString();
      await user.save(); // 💾 រក្សាទុកចូល MongoDB
      res.json({ success: true });
    } else {
      res.json({ success: false });
    }
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// ==========================================
// 4. API សម្រាប់ទាញយក User ទាំងអស់ (ទៅបង្ហាញក្នុង Admin Panel)
// ==========================================
app.get("/api/users", async (req, res) => {
  // 💡 ថែម async
  try {
    // 💡 ទាញយកទិន្នន័យ User ទាំងអស់ដែលមាននៅក្នុង MongoDB Atlas បោះទៅឱ្យ Frontend
    const users = await User.find({});
    res.json(users);
  } catch (err) {
    console.error("Fetch Users Error:", err);
    res.status(500).json({ success: false, message: "មិនអាចទាញទិន្នន័យបានទេ" });
  }
});

// ==========================================
// 👤 ៦. ការគ្រប់គ្រងទម្រង់គណនី (USER SETTINGS - MongoDB Version)
// ==========================================

// 1. API សម្រាប់ដូរពាក្យសម្ងាត់ (Change Password)
app.post("/api/change-password", async (req, res) => {
  // 💡 ថែម async
  const { username, oldPassword, newPassword } = req.body;

  try {
    // 🔍 រកមើល User តាមរយៈ username
    const user = await User.findOne({ username });

    if (user && user.password === oldPassword) {
      user.password = newPassword;
      await user.save(); // 💾 រក្សាទុកចូល MongoDB
      res.json({ success: true });
    } else {
      res.json({ success: false, message: "Old password incorrect" });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: "Server មានបញ្ហា" });
  }
});

// 2. API សម្រាប់ដូរលេខកូដសម្ងាត់វេរលុយ (Change PIN)
app.post("/api/change-pin", async (req, res) => {
  // 💡 ថែម async
  const { username, password, newPin } = req.body;

  try {
    const user = await User.findOne({ username });

    if (user && user.password === password) {
      user.pin = newPin;
      user.pinAttempts = 0; // Reset ការវាយខុស
      await user.save(); // 💾 រក្សាទុកចូល MongoDB
      res.json({ success: true });
    } else {
      res.json({ success: false, message: "Password incorrect" });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: "Server មានបញ្ហា" });
  }
});

// 3. API សម្រាប់ដូរដែនកំណត់វេរលុយប្រចាំថ្ងៃ (Change Transaction Limit)
app.post("/api/change-limit", async (req, res) => {
  // 💡 ថែម async
  const { username, password, newLimit } = req.body;

  try {
    const user = await User.findOne({ username });

    if (user && user.password === password) {
      user.trxLimit = parseFloat(newLimit);
      await user.save(); // 💾 រក្សាទុកចូល MongoDB
      res.json({ success: true });
    } else {
      res.json({ success: false, message: "Password incorrect" });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: "Server មានបញ្ហា" });
  }
});

// 4. API សម្រាប់ប្តូររូបថត Profile (Upload Profile Image)
app.post(
  "/api/user/upload-image",
  upload.single("profileImg"),
  async (req, res) => {
    // 💡 ថែម async
    const username = req.body.username; // 💡 ដូរមកស្វែងរកតាម username វិញដើម្បីសុវត្ថិភាពទិន្នន័យ

    if (!req.file) {
      return res.json({ success: false, message: "No image uploaded" });
    }

    const imageUrl = "/uploads/" + req.file.filename;

    try {
      const user = await User.findOne({ username });
      if (user) {
        user.profileImage = imageUrl;
        await user.save(); // 💾 រក្សាទុកចូល MongoDB
        res.json({ success: true, imageUrl: imageUrl });
      } else {
        res.json({ success: false, message: "User not found" });
      }
    } catch (err) {
      res
        .status(500)
        .json({ success: false, message: "Server មានបញ្ហា Upload" });
    }
  },
);

// 5. API សម្រាប់ដាក់ឯកសារ KYC បញ្ជាក់អត្តសញ្ញាណ (Submit KYC)
app.post("/api/user/submit-kyc", upload.single("kycDoc"), async (req, res) => {
  // 💡 ថែម async
  const username = req.body.username;

  if (!req.file) {
    return res.json({ success: false, message: "No document uploaded" });
  }

  const docUrl = "/uploads/" + req.file.filename;

  try {
    const user = await User.findOne({ username });
    if (user) {
      user.kycStatus = "pending";
      user.kycDocument = docUrl;
      // 💡 បើប្អូនមានអនុគមន៍ getFormattedDate() គឺប្រើវាដដែល ឬដូរទៅប្រើ new Date().toISOString() ក៏បាន
      user.kycSubmittedAt =
        typeof getFormattedDate === "function"
          ? getFormattedDate()
          : new Date().toISOString();

      await user.save(); // 💾 រក្សាទុកចូល MongoDB
      res.json({
        success: true,
        message: "ឯកសារបញ្ជាក់អត្តសញ្ញាណត្រូវបានបញ្ជូន!",
      });
    } else {
      res.json({ success: false, message: "User not found" });
    }
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: "Server មានបញ្ហាដាក់ KYC" });
  }
});

// ==========================================
// 💱 ៧. អត្រាប្តូរប្រាក់ & ផ្ទេរប្រាក់ (EXCHANGE & TRANSFERS - MongoDB Version)
// ==========================================
const FX_FILE = path.join(__dirname, "data", "fx.json");
let globalFXRates = { usdToKhrBuy: 4050, usdToKhrSell: 4100 };

if (fs.existsSync(FX_FILE)) {
  try {
    globalFXRates = JSON.parse(fs.readFileSync(FX_FILE));
  } catch (e) {}
}

const writeFX = (data) => {
  globalFXRates = data;
  const dir = path.join(__dirname, "data");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(FX_FILE, JSON.stringify(data, null, 2));
};

// 1. API ទាញយកអត្រាប្តូរប្រាក់
app.get("/api/fx/rates", (req, res) => {
  res.json({ success: true, rates: globalFXRates });
});

// 2. API Admin ធ្វើបច្ចុប្បន្នភាពអត្រាប្តូរប្រាក់
app.post("/api/admin/fx/update", (req, res) => {
  const { buy, sell } = req.body;
  writeFX({ usdToKhrBuy: parseFloat(buy), usdToKhrSell: parseFloat(sell) });
  res.json({ success: true, message: "Exchange rates updated successfully!" });
});

// 3. API ឆែកគណនីមុនផ្ទេរប្រាក់ (ឆែកក្នុង MongoDB)
app.post("/api/check-account", async (req, res) => {
  // 💡 ថែម async
  const { accountNumber } = req.body;

  try {
    const targetUser = await User.findOne({
      $or: [
        { accountNumber: accountNumber },
        { accountNumberKHR: accountNumber },
      ],
    });

    if (targetUser) {
      const isReceiverKHR = targetUser.accountNumberKHR === accountNumber;
      res.json({
        success: true,
        username: targetUser.fullName || targetUser.username,
        isReceiverKHR: isReceiverKHR,
        fxRates: globalFXRates,
      });
    } else {
      res.json({ success: false, message: "Account not found" });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// 4. API ផ្ទេរប្រាក់ធំ (Transfer Money - រក្សាទុកលក្ខខណ្ឌចាស់ ១០០%)
app.post("/api/transfer", async (req, res) => {
  // 💡 ថែម async
  // 🔥 ១. ឆែកមើលថាតើ Admin បានបិទប្រព័ន្ធឬនៅ?
  const system =
    typeof readSystemStatus === "function"
      ? readSystemStatus()
      : { isSystemFrozen: false };
  if (system.isSystemFrozen) {
    return res.json({
      success: false,
      message:
        "ប្រព័ន្ធកំពុងធ្វើការថែទាំ (Maintenance) 🛠️ សូមព្យាយាមម្តងទៀតនៅពេលក្រោយ។",
    });
  }

  const {
    senderUsername,
    receiverAccount,
    amount,
    remark,
    pin,
    trxMethod,
    currency,
  } = req.body;

  try {
    const fxRates = globalFXRates;

    // 🔍 ទាញយកទិន្នន័យអ្នកផ្ញើ និងអ្នកទទួលពី MongoDB
    const sender = await User.findOne({ username: senderUsername });
    const receiver = await User.findOne({
      $or: [
        { accountNumber: receiverAccount },
        { accountNumberKHR: receiverAccount },
      ],
    });

    if (!sender) return res.json({ success: false, message: "Account Error" });
    if (sender.isFrozen)
      return res.json({ success: false, message: "Account Frozen" });

    // 🛡️ ឆែកលេខកូដ PIN និងចងលក្ខខណ្ឌខុស ៣ ដងចាក់សោរ
    if (sender.pin !== pin) {
      sender.pinAttempts = (sender.pinAttempts || 0) + 1;
      if (sender.pinAttempts >= 3) {
        sender.isFrozen = true;
        sender.pinAttempts = 0;
        await sender.save(); // 💾 រក្សាទុកការចាក់សោរចូល MongoDB
        return res.json({
          success: false,
          message: "Wrong PIN 3 times! Account Frozen.",
        });
      }
      await sender.save();
      return res.json({
        success: false,
        message: `Wrong PIN! Attempts left: ${3 - sender.pinAttempts}`,
      });
    }
    sender.pinAttempts = 0;

    if (!receiver)
      return res.json({ success: false, message: "Receiver not found" });

    const transferAmount = parseFloat(amount);
    const isSenderKHR = currency === "KHR";
    const isReceiverKHR = receiver.accountNumberKHR === receiverAccount;

    // ឆែក Limit ប្រតិបត្តិការ
    let amountInUSDForLimit = isSenderKHR
      ? transferAmount / fxRates.usdToKhrSell
      : transferAmount;
    if (amountInUSDForLimit > sender.trxLimit) {
      return res.json({
        success: false,
        message: `Over Limit! Your limit is $${sender.trxLimit}`,
      });
    }

    // ឆែកសមតុល្យទឹកប្រាក់ក្នុងកុង
    if (isSenderKHR) {
      if ((sender.balanceKHR || 0) < transferAmount)
        return res.json({
          success: false,
          message: "Insufficient KHR Balance",
        });
    } else {
      if (sender.balance < transferAmount)
        return res.json({
          success: false,
          message: "Insufficient USD Balance",
        });
    }

    // ហាមវេរឱ្យខ្លួនឯង
    if (
      sender.accountNumber === receiverAccount ||
      sender.accountNumberKHR === receiverAccount
    ) {
      return res.json({ success: false, message: "Cannot transfer to self" });
    }

    // គណនាប្តូរលុយអូតូពេលវេរឆ្លង Currency
    let receiverAmount = transferAmount;
    if (!isSenderKHR && isReceiverKHR)
      receiverAmount = transferAmount * fxRates.usdToKhrBuy;
    else if (isSenderKHR && !isReceiverKHR)
      receiverAmount = transferAmount / fxRates.usdToKhrSell;

    // កាត់លុយអ្នកផ្ញើ និងបូកលុយឱ្យអ្នកទទួល
    if (isSenderKHR) sender.balanceKHR -= transferAmount;
    else sender.balance -= transferAmount;

    if (isReceiverKHR)
      receiver.balanceKHR = (receiver.balanceKHR || 0) + receiverAmount;
    else receiver.balance += receiverAmount;

    // រៀបចំ Slip Data
    const date =
      typeof getFormattedDate === "function"
        ? getFormattedDate()
        : new Date().toLocaleString();
    const refId =
      typeof generateRefId === "function"
        ? generateRefId()
        : "REF" + Date.now();
    const trxHash =
      typeof generateHash === "function" ? generateHash() : "HASH" + Date.now();
    const deviceName =
      typeof getDevice === "function"
        ? getDevice(req.headers["user-agent"])
        : "Unknown Device";
    const ipAddress = req.ip || req.connection.remoteAddress;
    const signSender = isSenderKHR ? "៛" : "$";
    const signReceiver = isReceiverKHR ? "៛" : "$";

    const senderTrx = {
      refId,
      hash: trxHash,
      date,
      type: "Transfer",
      amount: -transferAmount,
      currency: isSenderKHR ? "KHR" : "USD",
      fee: 0.0,
      senderName: sender.username,
      senderAcc: isSenderKHR ? sender.accountNumberKHR : sender.accountNumber,
      receiverName: receiver.username,
      receiverAcc: receiverAccount,
      remark: remark || "General",
      status: "Success",
      device: deviceName,
      ip: ipAddress,
      trxMethod: trxMethod || "Account Input",
    };

    const receiverTrx = {
      ...senderTrx,
      amount: receiverAmount,
      currency: isReceiverKHR ? "KHR" : "USD",
      type: "Received",
    };

    // ញាត់ប្រវត្តិចូលក្នុង Array របស់ MongoDB វិញ
    sender.transactions.unshift(senderTrx);
    if (!receiver.transactions) receiver.transactions = [];
    receiver.transactions.unshift(receiverTrx);

    // ប្រព័ន្ធ Notification ក្នុង App
    if (!receiver.notifications) receiver.notifications = [];
    receiver.notifications.unshift({
      id: "NOTIF-" + Date.now(),
      title: "Money Received!",
      message: `You have received ${signReceiver}${receiverAmount.toLocaleString("en-US", { minimumFractionDigits: isReceiverKHR ? 0 : 2 })} from ${sender.fullName || sender.username}.`,
      date: date,
      isRead: false,
    });

    // 💾 រក្សាទុកការប្រែប្រួលទាំងអស់របស់គណនីទាំងពីរចូល MongoDB Atlas
    await sender.save();
    await receiver.save();

    // 🔔 ប្រព័ន្ធបាញ់សារប្រកាសអាសន្នចូល Telegram Bot (រក្សាទុកទម្រង់ចាស់ ១០០%)
    if (receiver.telegramChatId) {
      let displayAmount = `${signReceiver}${receiverAmount.toLocaleString("en-US", { minimumFractionDigits: isReceiverKHR ? 0 : 2 })}`;
      const alertMsg = `🔔 <b>ប្រាក់ចូល (Money Received)</b> 🔔\n━━━━━━━━━━━━━━━━\n💰 <b>ចំនួនទឹកប្រាក់៖</b> +${displayAmount}\n📥 <b>ចូលគណនី៖</b> ${receiver.fullName || receiver.username}\n📤 <b>ពីគណនី៖</b> ${sender.fullName || sender.username}\n🧾 <b>លេខប្រតិបត្តិការ៖</b> ${refId}\n⏰ <b>កាលបរិច្ឆេទ៖</b> ${date}\n📝 <b>ចំណាំ៖</b> ${remark || "គ្មាន"}\n━━━━━━━━━━━━━━━━━\n✅ <i>ប្រតិបត្តិការជោគជ័យ (U-Pay)</i>`;
      if (typeof bot !== "undefined")
        bot
          .sendMessage(receiver.telegramChatId, alertMsg, {
            parse_mode: "HTML",
          })
          .catch((err) => console.error(err));
    }

    res.json({
      success: true,
      newBalance: isSenderKHR ? sender.balanceKHR : sender.balance,
      slipData: senderTrx,
    });
  } catch (err) {
    console.error("Transfer Error:", err);
    res
      .status(500)
      .json({ success: false, message: "Server មានបញ្ហាក្នុងការផ្ទេរប្រាក់" });
  }
});

// 5. API ទូទាត់វិក្កយបត្រ (Bill Payment - រក្សាទុកលក្ខខណ្ឌចាស់ ១០០%)
app.post("/api/payment", async (req, res) => {
  // 💡 ថែម async
  const { username, billerName, billId, amount, pin } = req.body;

  try {
    const user = await User.findOne({ username });
    const biller = await User.findOne({ username: billerName });

    if (!user || !biller)
      return res.json({ success: false, message: "Error User/Biller" });
    if (user.isFrozen)
      return res.json({ success: false, message: "Account Frozen" });

    // ឆែក PIN ករណីបង់វិក្កយបត្រ
    if (user.pin !== pin) {
      user.pinAttempts = (user.pinAttempts || 0) + 1;
      if (user.pinAttempts >= 3) {
        user.isFrozen = true;
        user.pinAttempts = 0;
        await user.save();
        return res.json({
          success: false,
          message: "Wrong PIN 3 times! Frozen.",
        });
      }
      await user.save();
      return res.json({ success: false, message: "Wrong PIN" });
    }
    user.pinAttempts = 0;

    if (parseFloat(amount) > user.trxLimit)
      return res.json({ success: false, message: `Over Limit!` });
    if (user.balance < parseFloat(amount))
      return res.json({ success: false, message: "Insufficient Balance" });

    const payAmount = parseFloat(amount);
    user.balance -= payAmount;
    biller.balance += payAmount;

    const refId =
      typeof generateRefId === "function"
        ? generateRefId()
        : "REF" + Date.now();
    const date =
      typeof getFormattedDate === "function"
        ? getFormattedDate()
        : new Date().toLocaleString();

    const trx = {
      refId,
      hash:
        typeof generateHash === "function"
          ? generateHash()
          : "HASH" + Date.now(),
      date,
      type: "Bill Payment",
      amount: -payAmount,
      fee: 0.0,
      senderName: user.username,
      senderAcc: user.accountNumber,
      receiverName: billerName,
      receiverAcc: biller.accountNumber,
      remark: `Bill ID: ${billId}`,
      status: "Success",
      billId: billId,
      device:
        typeof getDevice === "function"
          ? getDevice(req.headers["user-agent"])
          : "Unknown Device",
      ip: req.ip,
    };

    user.transactions.unshift(trx);
    biller.transactions.unshift({
      ...trx,
      amount: payAmount,
      type: "Income (Bill)",
    });

    // 💾 រក្សាទុកទិន្នន័យការទូទាត់ចូល MongoDB Atlas
    await user.save();
    await biller.save();

    // 🔔 ផ្ញើសារប្រកាសអាសន្នទៅកាន់ Telegram Biller ម្ចាស់ហាង
    if (biller.telegramChatId) {
      const alertMsg = `🔔 <b>វិក្កយបត្របានទូទាត់</b> 🔔\n━━━━━━━━━━━━━━━━━━━━\n💰 <b>ទឹកប្រាក់៖</b> +$${payAmount.toFixed(2)}\n🏢 <b>ហាង៖</b> ${biller.fullName || biller.username}\n👤 <b>អតិថិជន៖</b> ${user.fullName || user.username}\n🧾 <b>វិក្កយបត្រ៖</b> ${billId}\n🏷️ <b>ប្រតិបត្តិការ៖</b> ${refId}\n━━━━━━━━━━━━━━━━━━━━\n✅ <i>ប្រតិបត្តិការជោគជ័យ</i>`;
      if (typeof bot !== "undefined")
        bot
          .sendMessage(biller.telegramChatId, alertMsg, { parse_mode: "HTML" })
          .catch((err) => console.error(err));
    }

    res.json({ success: true, newBalance: user.balance, slipData: trx });
  } catch (err) {
    console.error("Payment Error:", err);
    res.status(500).json({
      success: false,
      message: "Server មានបញ្ហាក្នុងការទូទាត់វិក្កយបត្រ",
    });
  }
});

// ==========================================
// 💳 ៨. ប្រព័ន្ធកាត (CARD MANAGEMENT SYSTEM - MongoDB Version)
// ==========================================

// 💡 រក្សាទុកអនុគមន៍គណនាលេខកាតតាមស្តង់ដារ Luhn ដដែល ១០០%
function generateLuhnNumber(prefix) {
  let num = prefix;
  while (num.length < 15) num += Math.floor(Math.random() * 10).toString();
  let sum = 0;
  for (let i = 0; i < num.length; i++) {
    let digit = parseInt(num[i]);
    if (i % 2 === 0) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  let checkDigit = (10 - (sum % 10)) % 10;
  return num + checkDigit.toString();
}

// 💡 រក្សាទុក Array ក្នុង Memory សម្រាប់ចាំស្កេនទូទាត់បណ្តោះអាសន្នដដែល ១០០%
let pendingPayments = [];

// 1. API បង្កើតកាត Virtual (Classic / Platinum)
app.post("/api/card/generate", async (req, res) => {
  // 💡 ថែម async
  // 🔥 ១. ឆែកមើលថាតើ Admin បានបិទប្រព័ន្ធឬនៅ?
  const system =
    typeof readSystemStatus === "function"
      ? readSystemStatus()
      : { isSystemFrozen: false };
  if (system.isSystemFrozen) {
    return res.json({
      success: false,
      message: "ប្រព័ន្ធកំពុងធ្វើការថែទាំ 🛠️ មិនអាចបង្កើតកាតថ្មីបានទេនៅពេលនេះ។",
    });
  }

  const { username, cardType, pin } = req.body;

  try {
    // 🔍 ស្វែងរកអ្នកប្រើប្រាស់ក្នុង MongoDB
    const user = await User.findOne({ username });
    if (!user) return res.json({ success: false, message: "User not found" });

    if (user.pin !== pin)
      return res.json({ success: false, message: "លេខ PIN មិនត្រឹមត្រូវទេ!" });

    const FEE_AMOUNT = 5.0;
    if (user.balance < FEE_AMOUNT)
      return res.json({
        success: false,
        message: `សមតុល្យមិនគ្រប់គ្រាន់ទេ! ថ្លៃសេវាបង្កើតកាតគឺ $${FEE_AMOUNT.toFixed(2)}`,
      });

    if (!user.virtualCards) user.virtualCards = [];
    if (user.virtualCards.length >= 3)
      return res.json({
        success: false,
        message: "Limit reached (Max 3 cards)",
      });

    // 🔍 ស្វែងរកគណនីប្រមូលថ្លៃសេវាប្រព័ន្ធក្នុង MongoDB
    let feeAccount = await User.findOne({ accountNumber: "999999999" });
    if (!feeAccount) {
      feeAccount = new User({
        username: "system_fee",
        fullName: "U-PAY Fee",
        accountNumber: "999999999",
        balance: 0,
        role: "system",
        transactions: [],
      });
      await feeAccount.save();
    }

    // កាត់លុយ និង បូកចូលគណនីសេវាកម្ម
    user.balance -= FEE_AMOUNT;
    feeAccount.balance += FEE_AMOUNT;

    const dateStr =
      typeof getFormattedDate === "function"
        ? getFormattedDate()
        : new Date().toLocaleString();
    const refId = "FEE-" + Date.now();
    const hash =
      typeof generateHash === "function" ? generateHash() : "HASH" + Date.now();

    // បញ្ចូលប្រវត្តិប្រតិបត្តិការ
    user.transactions.unshift({
      refId,
      hash,
      date: dateStr,
      type: "Card Issuance Fee",
      amount: -FEE_AMOUNT,
      senderName: user.fullName || user.username,
      senderAccount: user.accountNumber,
      receiverName: "U-PAY Fee",
      receiverAccount: "999999999",
      status: "Success",
      trxMethod: "Account Balance",
      isHold: false,
    });

    feeAccount.transactions.unshift({
      refId,
      hash,
      date: dateStr,
      type: "System Income",
      amount: FEE_AMOUNT,
      senderName: user.fullName || user.username,
      senderAccount: user.accountNumber,
      receiverName: "U-PAY Fee",
      receiverAccount: "999999999",
      status: "Success",
      trxMethod: "Service Fee",
      isHold: false,
    });

    // បង្កើតព័ត៌មានកាតថ្មី
    const prefix = cardType === "platinum" ? "4305" : "4215";
    const d = new Date();
    const newCard = {
      id: "card_" + Date.now(),
      type: cardType || "visa_classic",
      number: generateLuhnNumber(prefix),
      expiry:
        ("0" + (d.getMonth() + 1)).slice(-2) +
        "/" +
        d.getFullYear().toString().slice(-2),
      cvv: Math.floor(100 + Math.random() * 900).toString(),
      pin: "1234",
      isLocked: false,
      isOnlinePayEnabled: true,
      dailyLimit: 500.0,
    };

    user.virtualCards.push(newCard);

    // 💾 រក្សាទុកទិន្នន័យទាំងពីរចូល MongoDB Atlas
    await user.save();
    await feeAccount.save();

    res.json({
      success: true,
      cards: user.virtualCards,
      newBalance: user.balance,
    });
  } catch (err) {
    console.error("Card Generate Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// 2. API បិទ/បើក ផ្អាកកាតបណ្តោះអាសន្ន (Toggle Lock Card)
app.post("/api/card/toggle-lock", async (req, res) => {
  // 💡 ថែម async
  const { username, cardId, isLocked } = req.body;

  try {
    const user = await User.findOne({ username });
    if (user && user.virtualCards) {
      const card = user.virtualCards.find((c) => c.id === cardId);
      if (card) {
        card.isLocked = isLocked;
        user.markModified("virtualCards"); // ប្រាប់ Mongoose ថា Array ក្នុងមានការកែប្រែ
        await user.save(); // 💾 រក្សាទុកចូល MongoDB
        return res.json({ success: true, cards: user.virtualCards });
      }
    }
    res.json({ success: false, message: "Card not found" });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// 3. API បិទ/បើក ការទូទាត់អនឡាញ (Toggle Online Pay)
app.post("/api/card/toggle-online-pay", async (req, res) => {
  // 💡 ថែម async
  const { username, cardId, isEnabled } = req.body;

  try {
    const user = await User.findOne({ username });
    if (user && user.virtualCards) {
      const card = user.virtualCards.find((c) => c.id === cardId);
      if (card) {
        card.isOnlinePayEnabled = isEnabled;
        user.markModified("virtualCards");
        await user.save(); // 💾 រក្សាទុកចូល MongoDB
        return res.json({ success: true, cards: user.virtualCards });
      }
    }
    res.json({ success: false });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// 4. API ប្តូរលេខកូដសម្ងាត់កាត (Change Card PIN)
app.post("/api/card/change-pin", async (req, res) => {
  // 💡 ថែម async
  const { username, cardId, oldPin, newPin } = req.body;

  try {
    const user = await User.findOne({ username });
    if (user && user.virtualCards) {
      const card = user.virtualCards.find((c) => c.id === cardId);
      if (!card) return res.json({ success: false, message: "រកមិនឃើញកាត!" });
      if (card.pin !== oldPin)
        return res.json({
          success: false,
          message: "លេខ PIN ចាស់មិនត្រឹមត្រូវ!",
        });

      card.pin = newPin;
      user.markModified("virtualCards");
      await user.save(); // 💾 រក្សាទុកចូល MongoDB
      res.json({ success: true, message: "ប្តូរលេខ PIN កាតជោគជ័យ!" });
    } else {
      res.json({ success: false, message: "រកមិនឃើញអ្នកប្រើប្រាស់!" });
    }
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// 5. API កំណត់ដែនកំណត់ចំណាយរបស់កាត (Update Card Limit)
app.post("/api/card/update-limit", async (req, res) => {
  // 💡 ថែម async
  const { username, cardId, newLimit } = req.body;

  try {
    const user = await User.findOne({ username });
    if (user && user.virtualCards) {
      const card = user.virtualCards.find((c) => c.id === cardId);
      if (card) {
        card.dailyLimit = parseFloat(newLimit);
        user.markModified("virtualCards");
        await user.save(); // 💾 រក្សាទុកចូល MongoDB
        return res.json({ success: true, cards: user.virtualCards });
      }
    }
    res.json({ success: false, message: "រកមិនឃើញកាត!" });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// 6. API លុបកាតចោល (Delete Card)
app.post("/api/card/delete", async (req, res) => {
  // 💡 ថែម async
  const { username, cardId } = req.body;

  try {
    const user = await User.findOne({ username });
    if (user && user.virtualCards) {
      const initialCount = user.virtualCards.length;
      user.virtualCards = user.virtualCards.filter((c) => c.id !== cardId);

      if (user.virtualCards.length < initialCount) {
        await user.save(); // 💾 រក្សាទុកចូល MongoDB
        return res.json({ success: true, cards: user.virtualCards });
      }
    }
    res.json({ success: false, message: "Error deleting card" });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// 7. API ស្នើសុំកាត់លុយពីកាតអនឡាញ (Card Payment Request)
app.post("/api/card/request-payment", async (req, res) => {
  // 💡 ថែម async
  // 🔥 ១. ឆែកមើលថាតើ Admin បានបិទប្រព័ន្ធឬនៅ?
  const system =
    typeof readSystemStatus === "function"
      ? readSystemStatus()
      : { isSystemFrozen: false };
  if (system.isSystemFrozen) {
    return res.json({
      success: false,
      message:
        "ប្រព័ន្ធធនាគាកំពុងធ្វើការថែទាំ (Maintenance) 🛠️ មិនអាចធ្វើការទូទាត់បានទេ។",
    });
  }

  const { cardNumber, expiry, cvv, amount, orderId, shopName } = req.body;

  try {
    // 🔍 រាវរកគណនីម្ចាស់កាតនៅក្នុង MongoDB តាមរយៈព័ត៌មានកាត
    let owner = await User.findOne({
      "virtualCards.number": cardNumber,
      "virtualCards.expiry": expiry,
      "virtualCards.cvv": cvv,
    });

    if (!owner)
      return res.json({ success: false, message: "ព័ត៌មានកាតមិនត្រឹមត្រូវ!" });

    // ចាប់យក Object កាតដែលត្រូវមកប្រើ
    const targetCard = owner.virtualCards.find(
      (c) => c.number === cardNumber && c.expiry === expiry && c.cvv === cvv,
    );

    if (targetCard.isLocked)
      return res.json({ success: false, message: "កាតនេះត្រូវបានបង្កក!" });
    if (targetCard.isOnlinePayEnabled === false)
      return res.json({
        success: false,
        message: "ការទូទាត់អនឡាញត្រូវបានបិទ。",
      });

    // គណនាលុយចំណាយសរុបថ្ងៃនេះពីប្រវត្តិប្រតិបត្តិការ
    const todayStr = new Date().toLocaleDateString("en-US", {
      timeZone: "Asia/Phnom_Penh",
    });
    const totalSpentToday = (owner.transactions || [])
      .filter(
        (t) =>
          t.cardId === targetCard.id &&
          t.type === "Card Payment" &&
          t.date.includes(todayStr),
      )
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    if (totalSpentToday + parseFloat(amount) > (targetCard.dailyLimit || 500))
      return res.json({ success: false, message: "លើសកម្រិតចំណាយប្រចាំថ្ងៃ!" });
    if (owner.balance < amount)
      return res.json({ success: false, message: "សមតុល្យមិនគ្រប់គ្រាន់!" });

    const paymentId = "PAY-" + Date.now();
    pendingPayments.push({
      paymentId,
      cardNumber,
      amount: parseFloat(amount),
      orderId,
      shopName,
      username: owner.username.toLowerCase(),
      status: "pending",
      date:
        typeof getFormattedDate === "function"
          ? getFormattedDate()
          : new Date().toLocaleString(),
    });

    // 🔥 បាញ់សំណើចូលទៅកាន់ Notification របស់ User ផ្ទាល់ (រក្សាទុកប៊ូតុងចុចដដែល)
    if (!owner.notifications) owner.notifications = [];
    owner.notifications.unshift({
      id: "NOTIF-" + paymentId,
      title: "សំណើទូទាត់ប្រាក់ 🛒",
      message: `ហាង <b>${shopName}</b> បានស្នើសុំកាត់ប្រាក់ <b>$${parseFloat(amount).toFixed(2)}</b> ពីកាតរបស់អ្នក。<br><br>
      <button onclick="handlePaymentRequest('${paymentId}', '${shopName}', ${amount})" style="background:#10b981; color:white; border:none; padding:5px 10px; border-radius:5px; cursor:pointer; margin-top:10px;">ចុចទីនេះដើម្បីទូទាត់</button>`,
      date:
        typeof getFormattedDate === "function"
          ? getFormattedDate()
          : new Date().toLocaleString(),
      isRead: false,
      sender: "system",
      type: "payment_request",
    });

    // 💾 រក្សាទុកសំណើចូល MongoDB Atlas
    await owner.save();

    res.json({ success: true, paymentId: paymentId });
  } catch (err) {
    console.error("Request Payment Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// 8. API សម្រាប់ទាញយកសំណើទូទាត់ដែលកំពុងរង់ចាំ (Pending Payments)
app.get("/api/card/pending-payments/:username", (req, res) => {
  const searchUsername = req.params.username.toLowerCase();
  const list = pendingPayments.filter(
    (p) => p.username === searchUsername && p.status === "pending",
  );
  res.json({ success: true, pending: list });
});

// 9. API សម្រាប់បញ្ជាក់ការទូទាត់លុយពីកាត (Confirm Card Payment)
app.post("/api/card/confirm-payment", async (req, res) => {
  // 💡 ថែម async
  const { paymentId, pin, username } = req.body;

  try {
    const user = await User.findOne({ username });
    const payIndex = pendingPayments.findIndex(
      (p) => p.paymentId === paymentId,
    );

    if (!user || payIndex === -1)
      return res.json({ success: false, message: "សំណើមិនត្រឹមត្រូវ!" });

    const payment = pendingPayments[payIndex];
    const usedCard = user.virtualCards.find(
      (c) => c.number === payment.cardNumber,
    );

    if (!usedCard || usedCard.pin !== pin)
      return res.json({ success: false, message: "លេខ PIN មិនត្រឹមត្រូវ!" });

    // កាត់លុយគណនី
    user.balance -= payment.amount;

    // បញ្ចូលប្រវត្តិ Card Payment
    user.transactions.unshift({
      refId: paymentId,
      hash:
        typeof generateHash === "function"
          ? generateHash()
          : "HASH" + Date.now(),
      date:
        typeof getFormattedDate === "function"
          ? getFormattedDate()
          : new Date().toLocaleString(),
      type: "Card Payment",
      amount: -payment.amount,
      senderName: user.fullName || user.username,
      senderAccount: payment.cardNumber,
      receiverName: payment.shopName,
      receiverAccount: "100000004",
      device: req.headers["user-agent"] || "Unknown Device",
      ip: req.ip || "127.0.0.1",
      cardId: usedCard.id,
      status: "Pending",
      trxMethod: "Virtual Card",
      isHold: true,
      releaseDate: Date.now() + 1 * 300 * 1000,
    });

    pendingPayments[payIndex].status = "success";

    // 🔥 លុបសារ Notification ចេញពីកុងអ្នកប្រើប្រាស់ បន្ទាប់ពីទូទាត់រួច
    if (user.notifications) {
      user.notifications = user.notifications.filter(
        (n) => n.id !== "NOTIF-" + paymentId,
      );
    }

    // 💾 រក្សាទុកទិន្នន័យចូល MongoDB Atlas
    await user.save();
    res.json({ success: true, message: "ការទូទាត់ជោគជ័យ!" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// 10. API សម្រាប់បដិសេធការទូទាត់ (Decline Card Payment)
app.post("/api/card/decline-payment", async (req, res) => {
  // 💡 ថែម async
  const { paymentId } = req.body;
  const payIndex = pendingPayments.findIndex((p) => p.paymentId === paymentId);

  if (payIndex !== -1) {
    pendingPayments[payIndex].status = "declined";

    try {
      const ownerUsername = pendingPayments[payIndex].username;
      const owner = await User.findOne({ username: ownerUsername });

      if (owner && owner.notifications) {
        owner.notifications = owner.notifications.filter(
          (n) => n.id !== "NOTIF-" + paymentId,
        );
        await owner.save(); // 💾 រក្សាទុកចូល MongoDB
      }
      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ success: false });
    }
  }
  res.json({ success: false });
});

// 11. API សម្រាប់ឆែកស្ថានភាពទូទាត់ (Check Payment Request Status)
app.get("/api/card/check-status/:paymentId", (req, res) => {
  const pay = pendingPayments.find((p) => p.paymentId === req.params.paymentId);
  res.json({ success: true, status: pay ? pay.status : "expired" });
});

// ==========================================
// 🐷 ៩. កូនជ្រូកសន្សំប្រាក់ (SAVINGS GOALS - MongoDB Version)
// ==========================================

// 1. API សម្រាប់បង្កើតកូនជ្រូកសន្សំប្រាក់ថ្មី (Create Savings Goal)
app.post("/api/savings/create", async (req, res) => {
  // 💡 ថែម async
  const { username, goalName, targetAmount } = req.body;

  try {
    // 🔍 ស្វែងរកអ្នកប្រើប្រាស់ក្នុង MongoDB
    const user = await User.findOne({ username });
    if (user) {
      if (!user.savings) user.savings = [];

      // រក្សាទម្រង់ Object ចាស់របស់ប្អូន ១០០%
      user.savings.push({
        id: "goal_" + Date.now(),
        name: goalName,
        target: parseFloat(targetAmount),
        current: 0,
        status: "active",
        createdAt: new Date().toISOString(),
      });

      await user.save(); // 💾 រក្សាទុកចូល MongoDB
      res.json({ success: true, savings: user.savings });
    } else {
      res.json({ success: false });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

// 2. API សម្រាប់វេរលុយសន្សំចូលកូនជ្រូក (Deposit to Savings Goal)
app.post("/api/savings/deposit", async (req, res) => {
  // 💡 ថែម async
  const { username, goalId, amount } = req.body;

  try {
    const user = await User.findOne({ username });
    if (user) {
      const depositAmount = parseFloat(amount);

      // 🛡️ ឆែកមើលថាតើលុយក្នុងកុងធំគ្រប់គ្រាន់សម្រាប់សន្សំអត់
      if (user.balance < depositAmount) {
        return res.json({ success: false, message: "Insufficient balance!" });
      }

      // រាវរកកូនជ្រូកមួយណាដែលត្រូវញាត់លុយចូល
      const goal = user.savings?.find((g) => g.id === goalId);
      if (goal) {
        user.balance -= depositAmount; // កាត់លុយក្នុងកុងធំ
        goal.current += depositAmount; // លុយក្នុងកូនជ្រូកកើនឡើង

        // បញ្ចូលប្រវត្តិប្រតិបត្តិការណ៍ (ទម្រង់ចាស់ដដែល)
        user.transactions.unshift({
          refId:
            typeof generateRefId === "function"
              ? generateRefId()
              : "REF" + Date.now(),
          hash:
            typeof generateHash === "function"
              ? generateHash()
              : "HASH" + Date.now(),
          date:
            typeof getFormattedDate === "function"
              ? getFormattedDate()
              : new Date().toLocaleString(),
          type: "Saving Deposit",
          amount: -depositAmount,
          fee: 0,
          senderName: user.username,
          receiverName: `Piggy Bank: ${goal.name}`,
          remark: "Saved to Goal",
          status: "Success",
        });

        user.markModified("savings"); // ប្រាប់ Mongoose ឱ្យដឹងថា Array ខាងក្នុងមានការកែប្រែ
        await user.save(); // 💾 រក្សាទុកការផ្លាស់ប្តូរចូល MongoDB

        res.json({
          success: true,
          balance: user.balance,
          savings: user.savings,
        });
      } else {
        res.json({ success: false });
      }
    } else {
      res.json({ success: false });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

// 3. API សម្រាប់វាយកូនជ្រូកយកលុយមកវិញ (Break Savings Goal)
app.post("/api/savings/break", async (req, res) => {
  // 💡 ថែម async
  const { username, goalId } = req.body;

  try {
    const user = await User.findOne({ username });
    if (user && user.savings) {
      // ស្វែងរកទីតាំងកូនជ្រូកក្នុង Array
      const goalIndex = user.savings.findIndex((g) => g.id === goalId);

      if (goalIndex !== -1) {
        const refundAmount = user.savings[goalIndex].current; // ចំនួនលុយដែលត្រូវដកមកវិញ

        if (refundAmount > 0) {
          user.balance += refundAmount; // បូកលុយចូលកុងធំវិញ

          // បញ្ចូលប្រវត្តិប្រតិបត្តិការណ៍ (ទម្រង់ចាស់ដដែល)
          user.transactions.unshift({
            refId:
              typeof generateRefId === "function"
                ? generateRefId()
                : "REF" + Date.now(),
            hash:
              typeof generateHash === "function"
                ? generateHash()
                : "HASH" + Date.now(),
            date:
              typeof getFormattedDate === "function"
                ? getFormattedDate()
                : new Date().toLocaleString(),
            type: "Saving Withdrawal",
            amount: refundAmount,
            fee: 0,
            senderName: `Piggy Bank`,
            receiverName: user.username,
            remark: "Broke Piggy Bank",
            status: "Success",
          });
        }

        // លុបកូនជ្រូកនេះចេញពី Array
        user.savings.splice(goalIndex, 1);

        user.markModified("savings"); // ប្រាប់ Mongoose ឱ្យដឹងថា Array ខាងក្នុងមានការកែប្រែ
        await user.save(); // 💾 រក្សាទុកការផ្លាស់ប្តូរចូល MongoDB

        res.json({
          success: true,
          balance: user.balance,
          savings: user.savings,
          amount: refundAmount,
        });
      } else {
        res.json({ success: false });
      }
    } else {
      res.json({ success: false });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

// ==========================================
// 🏦 ១០. គណនីបញ្ញើ (FIXED DEPOSITS - MongoDB Version)
// ==========================================

// 1. API សម្រាប់បើកគណនីសន្សំបញ្ញើមានកាលកំណត់ (Create Fixed Deposit)
app.post("/api/fixed-deposit", async (req, res) => {
  // 💡 ថែម async
  const { accountNumber, amount, pin, duration, rate, type, currency } =
    req.body;
  const depAmount = parseFloat(amount);

  try {
    // 🔍 ស្វែងរកគណនីអ្នកប្រើប្រាស់ក្នុង MongoDB តាមរយៈ លេខកុង USD ឬ KHR
    const user = await User.findOne({
      $or: [
        { accountNumber: accountNumber },
        { accountNumberKHR: accountNumber },
      ],
    });

    if (!user || user.pin !== pin) {
      return res.json({ success: false, message: "លេខ PIN មិនត្រឹមត្រូវទេ" });
    }

    const isKHR = currency === "KHR";

    // 🛡️ ឆែកសមតុល្យលុយក្នុងកុងទៅតាមប្រភេទរូបិយប័ណ្ណ
    if (isKHR) {
      if ((user.balanceKHR || 0) < depAmount)
        return res.json({
          success: false,
          message: "សមតុល្យប្រាក់រៀលមិនគ្រប់គ្រាន់ទេ",
        });
    } else {
      if (user.balance < depAmount)
        return res.json({
          success: false,
          message: "សមតុល្យប្រាក់ដុល្លារមិនគ្រប់គ្រាន់ទេ",
        });
    }

    // 🔥 ប្រើប្រាស់គណនី Central Bank ដែលធានាថាមានជានិច្ចនៅក្នុង MongoDB
    let centralBank = await User.findOne({ accountNumber: "888888888" });
    if (!centralBank) {
      centralBank = new User({
        username: "central_bank",
        fullName: "U-Pay Central Bank",
        accountNumber: "888888888",
        balance: 0,
        balanceKHR: 0,
        role: "system",
        transactions: [],
      });
      await centralBank.save();
    }

    // 🔄 កាត់លុយពីអ្នកសន្សំ ហើយបាញ់ចូលកុងធនាគារកណ្តាល Central Bank
    if (isKHR) {
      user.balanceKHR -= depAmount;
      centralBank.balanceKHR = (centralBank.balanceKHR || 0) + depAmount;
    } else {
      user.balance -= depAmount;
      centralBank.balance += depAmount;
    }

    const dateStr =
      typeof getFormattedDate === "function"
        ? getFormattedDate()
        : new Date().toLocaleString();
    const refId = "DEP-" + Date.now();
    const hash =
      typeof generateHash === "function" ? generateHash() : "HASH" + Date.now();

    const senderAcc = isKHR ? user.accountNumberKHR : user.accountNumber;
    const bankAcc = isKHR
      ? centralBank.accountNumberKHR
      : centralBank.accountNumber;

    // បញ្ចូលប្រវត្តិប្រតិបត្តិការរបស់អ្នកប្រើប្រាស់
    if (!user.transactions) user.transactions = [];
    user.transactions.unshift({
      refId,
      hash,
      date: dateStr,
      type: `Fixed Deposit - ${type}`,
      amount: -depAmount,
      currency: isKHR ? "KHR" : "USD",
      senderName: user.fullName || user.username,
      senderAccount: senderAcc,
      receiverName: "U-Pay Central Bank",
      receiverAccount: bankAcc,
      status: "Success",
      trxMethod: "Fixed Deposit",
      isHold: false,
    });

    // បញ្ចូលប្រវត្តិប្រតិបត្តិការរបស់ Central Bank
    if (!centralBank.transactions) centralBank.transactions = [];
    centralBank.transactions.unshift({
      refId,
      hash,
      date: dateStr,
      type: `Received Deposit - ${type}`,
      amount: depAmount,
      currency: isKHR ? "KHR" : "USD",
      senderName: user.fullName || user.username,
      senderAccount: senderAcc,
      receiverName: "U-Pay Central Bank",
      receiverAccount: bankAcc,
      status: "Success",
      trxMethod: "Fixed Deposit",
      isHold: false,
    });

    // បង្កើតកញ្ចប់សន្សំបញ្ញើ (Deposits Object) ក្នុងកុងអ្នកប្រើប្រាស់
    if (!user.deposits) user.deposits = [];
    user.deposits.push({
      id: "DEP" + Date.now(),
      amount: depAmount,
      currency: isKHR ? "KHR" : "USD",
      rate: rate,
      type: type,
      durationMonths: duration,
      startDate: dateStr,
      maturityDate: new Date(
        new Date().setMonth(new Date().getMonth() + parseInt(duration)),
      ).toISOString(),
      status: "active",
    });

    // 💾 រក្សាទុកទិន្នន័យទាំងពីរចូល MongoDB Atlas ព្រមគ្នា
    await user.save();
    await centralBank.save();

    res.json({
      success: true,
      newBalance: isKHR ? user.balanceKHR : user.balance,
    });
  } catch (err) {
    console.error("Fixed Deposit Error:", err);
    res.status(500).json({
      success: false,
      message: "Server មានបញ្ហាក្នុងការបង្កើតប្រាក់បញ្ញើ",
    });
  }
});

// 2. API សម្រាប់ដកប្រាក់បញ្ញើមកវិញ (Withdraw Fixed Deposit)
app.post("/api/fixed-deposit/withdraw", async (req, res) => {
  // 💡 ថែម async
  const { accountNumber, depositId } = req.body;

  try {
    // 🔍 ទាញទិន្នន័យ User និង Central Bank ពី MongoDB
    const user = await User.findOne({
      $or: [
        { accountNumber: accountNumber },
        { accountNumberKHR: accountNumber },
      ],
    });
    const centralBank = await User.findOne({ accountNumber: "888888888" });

    if (!user || !centralBank || !user.deposits) {
      return res.json({
        success: false,
        message: "រកមិនឃើញគណនី ឬប្រាក់បញ្ញើទេ",
      });
    }

    // 🔍 ស្វែងរកកញ្ចប់សន្សំដែលត្រូវដក និងធានាថាវាមានស្ថានភាព active
    const depIndex = user.deposits.findIndex(
      (d) => d.id === depositId && d.status === "active",
    );
    if (depIndex === -1) {
      return res.json({
        success: false,
        message: "ប្រាក់បញ្ញើនេះត្រូវបានដក ឬអសកម្ម",
      });
    }

    const deposit = user.deposits[depIndex];
    const withdrawAmount = deposit.amount;
    const isKHR = deposit.currency === "KHR";

    // ប្តូរស្ថានភាពប្រាក់បញ្ញើទៅជាបិទ (closed)
    user.deposits[depIndex].status = "closed";

    // 🔄 ផ្ទេរលុយពី Central Bank ត្រឡប់មកចូលកុង User វិញ
    if (isKHR) {
      user.balanceKHR = (user.balanceKHR || 0) + withdrawAmount;
      centralBank.balanceKHR -= withdrawAmount;
    } else {
      user.balance += withdrawAmount;
      centralBank.balance -= withdrawAmount;
    }

    const dateStr =
      typeof getFormattedDate === "function"
        ? getFormattedDate()
        : new Date().toLocaleString();
    const refId = "WD-" + Date.now();
    const hash =
      typeof generateHash === "function" ? generateHash() : "HASH" + Date.now();

    // បញ្ចូលប្រវត្តិការដកលុយរបស់ User
    user.transactions.unshift({
      refId,
      hash,
      date: dateStr,
      type: `Withdraw Deposit`,
      amount: withdrawAmount,
      currency: isKHR ? "KHR" : "USD",
      senderName: "U-Pay Central Bank",
      receiverName: user.fullName || user.username,
      status: "Success",
      trxMethod: "Fixed Deposit",
    });

    // បញ្ចូលប្រវត្តិការបង្វិលលុយរបស់ Central Bank
    centralBank.transactions.unshift({
      refId,
      hash,
      date: dateStr,
      type: `Deposit Refund`,
      amount: -withdrawAmount,
      currency: isKHR ? "KHR" : "USD",
      senderName: "U-Pay Central Bank",
      receiverName: user.fullName || user.username,
      status: "Success",
      trxMethod: "Fixed Deposit",
    });

    // 💾 រក្សាទុកទិន្នន័យដែលបានធ្វើបច្ចុប្បន្នភាពចូល MongoDB Atlas
    user.markModified("deposits"); // បញ្ជាក់ទៅ Mongoose ថា Array ខាងក្នុងមានការប្រែប្រួល
    await user.save();
    await centralBank.save();

    res.json({
      success: true,
      newBalance: isKHR ? user.balanceKHR : user.balance,
    });
  } catch (err) {
    console.error("Withdraw Deposit Error:", err);
    res.status(500).json({
      success: false,
      message: "Server មានបញ្ហាក្នុងការដកប្រាក់បញ្ញើ",
    });
  }
});
// ==========================================
// 🎁 ១១. រង្វាន់ និងការបង្វិលសង (REWARDS & CASHBACK - MongoDB Version)
// ==========================================
app.post("/api/reward/cashback", async (req, res) => {
  // 💡 ថែម async
  const { username, amount, refId } = req.body;

  try {
    // 🔍 ស្វែងរកអ្នកប្រើប្រាស់ក្នុង MongoDB
    const user = await User.findOne({ username });

    if (user) {
      const reward = parseFloat(amount);
      if (reward > 0) {
        user.balance += reward; // បូកលុយរង្វាន់ចូលកុងធំ

        // បញ្ចូលប្រវត្តិប្រតិបត្តិការ (ទម្រង់ចាស់ដដែល ១០០%)
        user.transactions.unshift({
          refId: "RWD-" + Date.now().toString().slice(-6),
          hash:
            typeof generateHash === "function"
              ? generateHash()
              : "HASH" + Date.now(),
          date:
            typeof getFormattedDate === "function"
              ? getFormattedDate()
              : new Date().toLocaleString(),
          type: "Cashback Reward",
          amount: reward,
          fee: 0,
          senderName: "U-Pay Lucky Spin",
          receiverName: user.username,
          remark: `Reward for Trx: ${refId}`,
          status: "Success",
          device: "App",
          ip: "127.0.0.1",
        });

        await user.save(); // 💾 រក្សាទុកចូល MongoDB
      }
      res.json({ success: true, balance: user.balance });
    } else {
      res.json({ success: false });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ==========================================
// 🎧 ១២. សេវាកម្មអតិថិជន (SUPPORT TICKETS - MongoDB Version)
// ==========================================
app.post("/api/ticket/create", async (req, res) => {
  // 💡 ថែម async
  const { username, subject, description, priority } = req.body;

  try {
    // 🔍 ស្វែងរកអ្នកប្រើប្រាស់ក្នុង MongoDB
    const user = await User.findOne({ username });

    if (user) {
      if (!user.tickets) user.tickets = [];

      // --- ផ្នែកកែសម្រួលសម្រាប់ MongoDB (រក្សា Logic និងលទ្ធផលចាស់ ១០០%) ---

      // ១. រាប់ចំនួន Tickets សរុបដែលមានក្នុងប្រព័ន្ធទាំងអស់ពី MongoDB Atlas
      // ប្រើប្រាស់ $size ទៅលើ Array tickets របស់ User គ្រប់គ្នា រួចបូកបញ្ចូលគ្នា
      const results = await User.aggregate([
        {
          $project: {
            numberOfTickets: { $size: { $ifNull: ["$tickets", []] } },
          },
        },
        { $group: { _id: null, total: { $sum: "$numberOfTickets" } } },
      ]);

      const allTicketsCount = results.length > 0 ? results[0].total : 0;

      // ២. បង្កើត ID ថ្មី (បូក ១ បន្ថែម) រួចប្រើ padStart ដើម្បីថែមលេខ ០ ឱ្យគ្រប់ ៣ ខ្ទង់ដូចមុន
      const nextNumber = allTicketsCount + 1;
      const formattedId = "TK-" + nextNumber.toString().padStart(3, "0");

      // --- ចប់ផ្នែកកែសម្រួល ---

      // បញ្ចូលទិន្នន័យ Ticket ចូលក្នុង Array របស់ User (ទម្រង់ចាស់ដដែល)
      user.tickets.push({
        ticketId: formattedId, // លទ្ធផលនឹងចេញ TK-001, TK-002... ដូចដើម
        subject,
        description,
        priority: priority || "Normal",
        status: "Open",
        date:
          typeof getFormattedDate === "function"
            ? getFormattedDate()
            : new Date().toLocaleString(),
      });

      await user.save(); // 💾 រក្សាទុកចូល MongoDB Atlas

      res.json({
        success: true,
        message: "Ticket Created!",
        ticketId: formattedId,
      });
    } else {
      res.json({ success: false });
    }
  } catch (err) {
    console.error("Ticket Create Error:", err);
    res.status(500).json({
      success: false,
      message: "Server មានបញ្ហាក្នុងការបង្កើត Ticket",
    });
  }
});

// ==========================================
// 👑 ១៣. ប្រព័ន្ធគ្រប់គ្រង ADMIN (ADMIN DASHBOARD - MongoDB Version)
// ==========================================

// 1. API ទាញយកស្ថិតិចំណាយ ៧ ថ្ងៃចុងក្រោយ (7-Day Transaction Stats)
app.get("/api/admin/stats", async (req, res) => {
  // 💡 ថែម async
  try {
    const users = await User.find({ "transactions.0": { $exists: true } });
    const labels = [];
    const data = Array(7).fill(0);
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      labels.push(d.toLocaleDateString("en-US", { weekday: "short" }));
    }

    users.forEach((u) => {
      if (u.transactions) {
        u.transactions.forEach((t) => {
          if (t.amount < 0) {
            const tDate = new Date(t.date.split(",")[0]);
            const diffDays = Math.ceil(
              Math.abs(today - tDate) / (1000 * 60 * 60 * 24),
            );
            const index = 7 - diffDays;
            if (index >= 0 && index < 7) data[index] += Math.abs(t.amount);
          }
        });
      }
    });
    res.json({ labels, data });
  } catch (error) {
    res.status(500).json({ labels: [], data: Array(7).fill(0) });
  }
});

// 2. API ទាញយកចំណូលប្រព័ន្ធ និងសកម្មភាពថ្មីៗទាំង ១០ (Revenue & Recent Activities)
app.get("/api/admin/dashboard-extra", async (req, res) => {
  // 💡 ថែម async
  try {
    const users = await User.find({});
    let totalRevenue = 0;
    let allActivities = [];

    users.forEach((user) => {
      if (user.transactions) {
        user.transactions.forEach((t) => {
          if (t.fee) totalRevenue += parseFloat(t.fee) || 0;
          if (user.accountNumber === "888888888" && t.type === "System Income")
            totalRevenue += parseFloat(t.amount) || 0;
        });
      }

      if (user.accountNumber === "888888888" || user.role === "system") return;

      if (user.transactions) {
        user.transactions.forEach((t) => {
          let rawDate = new Date(t.date).getTime();
          if (isNaN(rawDate))
            rawDate =
              t.refId && t.refId.includes("-")
                ? parseInt(t.refId.split("-")[1])
                : 0;

          allActivities.push({
            type: t.type || "Transaction",
            user: user.username,
            amount: t.amount || 0,
            date: t.date || "Unknown Date",
            receiver: t.receiverName || "System",
            rawDate: rawDate,
          });
        });
      }
      if (user.virtualCards) {
        user.virtualCards.forEach((card) => {
          let rawDate =
            card.id && card.id.includes("_")
              ? parseInt(card.id.split("_")[1])
              : 0;
          if (rawDate > 0)
            allActivities.push({
              type: "Card Created",
              user: user.username,
              amount: 0,
              date: new Date(rawDate).toLocaleString("en-US"),
              receiver: "N/A",
              rawDate: rawDate,
            });
        });
      }
    });

    allActivities.sort((a, b) => b.rawDate - a.rawDate);
    res.json({
      success: true,
      revenue: totalRevenue,
      activities: allActivities.slice(0, 10),
    });
  } catch (error) {
    res.json({ success: false, revenue: 0, activities: [] });
  }
});

// 3. API បង្កកគណនី ឬ ដោះលែងគណនីអ្នកប្រើប្រាស់ (Toggle Freeze Account)
app.post("/api/admin/toggle-freeze", async (req, res) => {
  // 💡 ថែម async
  const { id, isFrozen } = req.body;
  try {
    const u = await User.findOne({ id: id });
    if (u) {
      u.isFrozen = isFrozen;
      if (!isFrozen) u.pinAttempts = 0; // កំណត់លេខព្យាយាម PIN ទៅ 0 វិញបើដោះលែង
      await u.save(); // 💾 រក្សាទុកចូល MongoDB
      res.json({ success: true });
    } else res.json({ success: false });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// 4. API ស្វែងរកប្រតិបត្តិការតាមរយៈ RefID ឬ Hash (Find Transaction by ID)
app.get("/api/admin/transaction/:id", async (req, res) => {
  // 💡 ថែម async
  const searchTerm = req.params.id.trim();
  try {
    const owner = await User.findOne({
      $or: [
        { "transactions.refId": searchTerm },
        { "transactions.hash": searchTerm },
      ],
    });

    if (owner) {
      const foundTrx = owner.transactions.find(
        (t) => t.refId === searchTerm || t.hash === searchTerm,
      );
      res.json({
        success: true,
        transaction: foundTrx,
        user: { username: owner.username, accountNumber: owner.accountNumber },
      });
    } else {
      res.json({ success: false });
    }
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// 5. API កែប្រែព័ត៌មានគណនីភ្ញៀវ និងការពារការកែលេខគណនីជាន់គ្នា (Edit User Data)
app.post("/api/admin/edit-user", async (req, res) => {
  // 💡 ថែម async
  const {
    id,
    username,
    pin,
    profileImage,
    accountNumber,
    accountNumberKHR,
    password,
  } = req.body;

  try {
    const u = await User.findOne({ $or: [{ id: id }, { username: id }] });
    if (u) {
      // 🛡️ ១. ឆែកការពារ: កុង USD និង KHR របស់ភ្ញៀវម្នាក់នេះ មិនអាចដូចគ្នាដាច់ខាត!
      const checkUSD = accountNumber || u.accountNumber;
      const checkKHR = accountNumberKHR || u.accountNumberKHR;

      if (checkUSD === checkKHR) {
        return res.json({
          success: false,
          message:
            "បរាជ័យ! លេខគណនី USD និង KHR របស់បុគ្គលម្នាក់ មិនអាចដូចគ្នាបានទេ។",
        });
      }

      // 🛡️ ២. ឆែកការពារការកែលេខគណនី USD ជាន់នឹងអ្នកផ្សេង
      if (accountNumber && accountNumber !== u.accountNumber) {
        const exists = await User.findOne({
          id: { $ne: u.id },
          $or: [
            { accountNumber: accountNumber },
            { accountNumberKHR: accountNumber },
          ],
        });
        if (exists)
          return res.json({
            success: false,
            message: `បរាជ័យ! លេខគណនី USD (${accountNumber}) มีគេប្រើរួចហើយ។`,
          });
        u.accountNumber = accountNumber;
      }

      // 🛡️ ៣. ឆែកការពារការកែលេខគណនី KHR ជាន់នឹងអ្នកផ្សេង
      if (accountNumberKHR && accountNumberKHR !== u.accountNumberKHR) {
        const existsKHR = await User.findOne({
          id: { $ne: u.id },
          $or: [
            { accountNumber: accountNumberKHR },
            { accountNumberKHR: accountNumberKHR },
          ],
        });
        if (existsKHR)
          return res.json({
            success: false,
            message: `បរាជ័យ! លេខគណនី KHR (${accountNumberKHR}) មានគេប្រើរួចហើយ។`,
          });
        u.accountNumberKHR = accountNumberKHR;
      }

      // ធ្វើបច្ចុប្បន្នភាពព័ត៌មានដែលផ្ញើមក
      if (username) u.username = username;
      if (pin) u.pin = pin;
      if (profileImage !== undefined) u.profileImage = profileImage;
      if (password && password.trim() !== "") u.password = password;

      await u.save(); // 💾 រក្សាទុកចូល MongoDB
      res.json({ success: true });
    } else {
      res.json({ success: false, message: "រកមិនឃើញគណនីដើម្បីកែប្រែទេ។" });
    }
  } catch (err) {
    console.error("Admin Edit User Error:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

// 6. API លុបអ្នកប្រើប្រាស់ចេញពីប្រព័ន្ធ (Delete User)
app.post("/api/admin/delete-user", async (req, res) => {
  // 💡 ថែម async
  const { id } = req.body;
  try {
    const result = await User.deleteOne({ id: id });
    if (result.deletedCount > 0) {
      res.json({ success: true });
    } else {
      res.json({ success: false, message: "User not found" });
    }
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// 7. API កែសម្រួលសមតុល្យលុយ (Add/Deduct) ភ្ជាប់គណនី Central Bank (Adjust Balance)
app.post("/api/admin/adjust-balance", async (req, res) => {
  // 💡 ថែម async
  const { username, amount, type, currency } = req.body;

  try {
    const user = await User.findOne({ username });
    const centralBank = await User.findOne({ accountNumber: "888888888" });

    if (!user) return res.json({ success: false, message: "User not found!" });
    if (!centralBank)
      return res.json({ success: false, message: "Central Bank not found!" });

    const adjustAmount = parseFloat(amount);
    if (isNaN(adjustAmount) || adjustAmount <= 0)
      return res.json({ success: false, message: "Invalid amount!" });

    const isKHR = currency === "KHR";
    const sign = isKHR ? "៛" : "$";

    if (type === "deduct") {
      if (isKHR && (user.balanceKHR || 0) < adjustAmount)
        return res.json({
          success: false,
          message: "Insufficient KHR balance!",
        });
      if (!isKHR && user.balance < adjustAmount)
        return res.json({
          success: false,
          message: "Insufficient USD balance!",
        });
    }

    // Double-Entry Accounting (Double-Check និងដំណើរការលើ MongoDB)
    if (type === "add") {
      if (isKHR) {
        centralBank.balanceKHR = (centralBank.balanceKHR || 0) - adjustAmount;
        user.balanceKHR = (user.balanceKHR || 0) + adjustAmount;
      } else {
        centralBank.balance -= adjustAmount;
        user.balance += adjustAmount;
      }
    } else if (type === "deduct") {
      if (isKHR) {
        centralBank.balanceKHR = (centralBank.balanceKHR || 0) + adjustAmount;
        user.balanceKHR = (user.balanceKHR || 0) - adjustAmount;
      } else {
        centralBank.balance += adjustAmount;
        user.balance -= adjustAmount;
      }
    }

    const date =
      typeof getFormattedDate === "function"
        ? getFormattedDate()
        : new Date().toLocaleString();
    const refId =
      (type === "add" ? "DEP-" : "DED-") + Math.floor(Math.random() * 1000000);
    const trxHash =
      "HSH" + Math.random().toString(36).substring(7).toUpperCase();

    const userTrx = {
      refId,
      hash: trxHash,
      date,
      type: type === "add" ? "Received" : "Deducted",
      amount: type === "add" ? adjustAmount : -adjustAmount,
      currency: currency,
      fee: 0,
      senderName: type === "add" ? "U-Pay Central Bank" : user.username,
      senderAcc:
        type === "add"
          ? isKHR
            ? centralBank.accountNumberKHR
            : centralBank.accountNumber
          : isKHR
            ? user.accountNumberKHR
            : user.accountNumber,
      receiverName:
        type === "add" ? user.fullName || user.username : "U-Pay Central Bank",
      receiverAcc:
        type === "add"
          ? isKHR
            ? user.accountNumberKHR
            : user.accountNumber
          : isKHR
            ? centralBank.accountNumberKHR
            : centralBank.accountNumber,
      remark: type === "add" ? "Admin Deposit" : "Admin Deduction",
      status: "Success",
      trxMethod: "U-PAY System",
    };

    const bankTrx = {
      ...userTrx,
      amount: type === "add" ? -adjustAmount : adjustAmount,
      type: type === "add" ? "Fund Disbursement" : "Fund Recovery",
    };

    if (!user.transactions) user.transactions = [];
    user.transactions.unshift(userTrx);

    if (!centralBank.transactions) centralBank.transactions = [];
    centralBank.transactions.unshift(bankTrx);

    // បាញ់សារ Notification ទៅកាន់គណនីភ្ញៀវ
    if (!user.notifications) user.notifications = [];
    const notifMsg =
      type === "add"
        ? `+${sign}${adjustAmount.toLocaleString("en-US", { minimumFractionDigits: isKHR ? 0 : 2 })} credited to your account.`
        : `-${sign}${adjustAmount.toLocaleString("en-US", { minimumFractionDigits: isKHR ? 0 : 2 })} deducted from your account.`;

    user.notifications.unshift({
      id: "NOTIF-" + Date.now(),
      title: type === "add" ? "Deposit Received" : "Balance Deducted",
      message: notifMsg,
      date,
      isRead: false,
    });

    // 💾 រក្សាទុកគណនីទាំងពីរចូល MongoDB Atlas
    await user.save();
    await centralBank.save();

    res.json({ success: true, message: `Operation Success!` });
  } catch (err) {
    console.error("Adjust Balance Error:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

// 8. API អនុម័តប្រតិបត្តិការដែលកំពុងជាប់ឃាត់ (Approve Pending Transaction)
app.post("/api/admin/approve-transaction", async (req, res) => {
  // 💡 ថែម async
  const { refId } = req.body;
  try {
    // 🔍 ស្វែងរកអ្នកប្រើប្រាស់ណាដែលមាន RefID នេះក្នុង Array transactions
    const u = await User.findOne({ "transactions.refId": refId });

    if (u) {
      const trx = u.transactions?.find((t) => t.refId === refId);
      if (trx && trx.status === "Pending") {
        trx.status = "Success";
        trx.isHold = false;

        if (!u.notifications) u.notifications = [];
        u.notifications.unshift({
          id: Date.now(),
          title: "Payment Approved",
          message: `ការទូទាត់ $${Math.abs(trx.amount)} ត្រូវបានអនុម័តជោគជ័យ។`,
          date:
            typeof getFormattedDate === "function"
              ? getFormattedDate()
              : new Date().toLocaleString(),
          isRead: false,
        });

        u.markModified("transactions"); // ប្រាប់ Mongoose ថាមានការប្រែប្រួល Array ខាងក្នុង
        await u.save(); // 💾 រក្សាទុកចូល MongoDB Atlas
        return res.json({ success: true, message: "Transaction Approved!" });
      }
    }
    res.json({ success: false, message: "Transaction not found/pending" });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// 9. API បង្វិលលុយត្រឡប់ទៅគណនីវិញ (Refund Pending Transaction)
app.post("/api/admin/refund-transaction", async (req, res) => {
  // 💡 ថែម async
  const { refId } = req.body;
  try {
    const u = await User.findOne({ "transactions.refId": refId });

    if (u) {
      const trx = u.transactions?.find((t) => t.refId === refId);
      if (trx && trx.status === "Pending") {
        u.balance += Math.abs(trx.amount); // វេរលុយត្រឡប់ចូលសមតុល្យគណនីធំវិញ
        trx.status = "Refunded";
        trx.isHold = false;

        if (!u.notifications) u.notifications = [];
        u.notifications.unshift({
          id: Date.now(),
          title: "Refund Processed",
          message: `ការទូទាត់ $${Math.abs(trx.amount)} ត្រូវបានសងត្រឡប់មកវិញ។`,
          date:
            typeof getFormattedDate === "function"
              ? getFormattedDate()
              : new Date().toLocaleString(),
          isRead: false,
        });

        u.markModified("transactions");
        await u.save(); // 💾 រក្សាទុកចូល MongoDB Atlas
        return res.json({ success: true, message: "Refund Successful!" });
      }
    }
    res.json({ success: false, message: "Transaction not found" });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// ==========================================
// 📢 ១៤. ការជូនដំណឹង (NOTIFICATIONS & BROADCASTS - MongoDB Version)
// ==========================================

// 1. API សម្រាប់ឆែកមើលចំនួនសារដែលមិនទាន់អាន (Get Unread Notifications Count)
app.get("/api/user/notifications", async (req, res) => {
  // 💡 ថែម async
  if (!req.session || !req.session.username)
    return res.status(401).json({ error: "មិនទាន់បាន Login" });

  try {
    const user = await User.findOne({ username: req.session.username });
    if (!user) return res.status(404).json({ error: "រកមិនឃើញគណនីនេះ" });

    const unread = user.notifications
      ? user.notifications.filter((n) => !n.isRead)
      : [];
    res.json({ hasNew: unread.length > 0, count: unread.length });
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
});

// 2. API សម្រាប់កត់សម្គាល់ថាសារទាំងអស់ត្រូវបានអានរួចរាល់ (Mark All Notifications as Read)
app.post("/api/user/read-notifications", async (req, res) => {
  // 💡 ថែម async
  const { username } = req.body;

  try {
    const user = await User.findOne({ username });
    if (user && user.notifications) {
      user.notifications.forEach((n) => (n.isRead = true));

      user.markModified("notifications"); // ប្រាប់ Mongoose ថា Array ខាងក្នុងមានការប្រែប្រួល
      await user.save(); // 💾 រក្សាទុកចូល MongoDB Atlas
      res.json({ success: true });
    } else {
      res.json({ success: false });
    }
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// 3. API សម្រាប់ Admin ផ្សព្វផ្សាយដំណឹងទៅកាន់ User ទាំងអស់ (Broadcast Notification to All Users)
app.post("/api/admin/broadcast", async (req, res) => {
  // 💡 ថែម async
  const { title, message, sender } = req.body;
  const sharedNotifId = "BC-" + Date.now();

  try {
    // 📣 ប្រើប្រាស់ updateMany ដើម្បីរុញសារថ្មីចូលទៅកាន់គ្រប់ User ទាំងអស់ដែលមិនមែនជា Admin
    const result = await User.updateMany(
      { role: { $ne: "admin" } },
      {
        $push: {
          notifications: {
            $each: [
              {
                id: sharedNotifId,
                title,
                message,
                sender: sender || "admin",
                date: new Date().toLocaleString(),
                isRead: false,
              },
            ],
            $position: 0, // ដាក់នៅខាងលើគេបង្អស់ (unshift)
          },
        },
      },
    );

    res.json({
      success: true,
      count: result.matchedCount, // ចំនួន User ទាំងអស់ដែលទទួលបានសារ
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// 4. API សម្រាប់ Admin លុបសារដែលបាន Broadcast ចេញពីគ្រប់ User (Delete Broadcast Notification)
app.post("/api/admin/delete-broadcast", async (req, res) => {
  // 💡 ថែម async
  const { notifId } = req.body;

  try {
    // 🗑️ ប្រើប្រាស់ updateMany ជាមួយ $pull ដើម្បីលុបសារចេញពី Array notifications របស់គ្រប់គ្នា
    await User.updateMany(
      { "notifications.id": notifId },
      { $pull: { notifications: { id: notifId } } },
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// ==========================================
// ⏱ ១៥. ស្វ័យប្រវត្តិកម្ម (AUTO JOBS - MongoDB Version)
// ==========================================

// មុខងារដោះលែងលុយដែលកកកុញដោយស្វ័យប្រវត្តទៅឱ្យ Merchant (Auto Release Hold Funds)
const autoReleaseHold = async () => {
  // 💡 ថែម async សម្រាប់ដោះស្រាយជាមួយ Database
  const now = Date.now();

  try {
    // 🔍 ស្វែងរកគណនី User ទាំងអស់ដែលមានប្រតិបត្តិការជាប់ឃាត់ (Pending & isHold) ហើយដល់ម៉ោងត្រូវដោះលែង
    const users = await User.find({
      "transactions.isHold": true,
      "transactions.status": "Pending",
      "transactions.releaseDate": { $lte: now },
    });

    if (users.length === 0) return;

    // 🔥 ស្វែងរកគណនី Merchant ដែលត្រូវទទួលលុយ (ធានាថាមានក្នុង MongoDB)
    let merchant = await User.findOne({ accountNumber: "100000004" });

    if (!merchant) {
      console.log("⚠️ [AUTO-RELEASE] រកមិនឃើញគណនី Merchant 100000004 ទេ!");
      return;
    }

    for (let u of users) {
      let userChanged = false;

      u.transactions.forEach((t) => {
        if (
          t.isHold &&
          t.status === "Pending" &&
          t.releaseDate &&
          t.releaseDate <= now
        ) {
          t.status = "Success";
          t.isHold = false;

          // 🔄 បូកលុយបញ្ចូលគណនី Merchant
          const amountToRelease = Math.abs(t.amount);
          merchant.balance += amountToRelease;

          if (!merchant.transactions) merchant.transactions = [];
          merchant.transactions.unshift({
            refId:
              "TRX-" +
              Date.now().toString().slice(-10) +
              "-" +
              Math.floor(Math.random() * 1000),
            hash:
              typeof generateHash === "function"
                ? generateHash()
                : "HASH" + Date.now(),
            date:
              typeof getFormattedDate === "function"
                ? getFormattedDate()
                : new Date().toLocaleString(),
            type: "Sale Income",
            amount: amountToRelease,
            senderName: t.senderName || "Unknown",
            status: "Success",
          });

          userChanged = true;
          console.log(
            `✅ [AUTO-RELEASED] Order: ${t.refId} for user: ${u.username}`,
          );
        }
      });

      if (userChanged) {
        u.markModified("transactions");
        await u.save(); // 💾 រក្សាទុកគណនីអ្នកទិញម្នាក់ៗ
      }
    }

    // 💾 រក្សាទុកគណនី Merchant បន្ទាប់ពីទទួលបានលុយសរុបទាំងអស់រួចរាល់
    await merchant.save();
  } catch (err) {
    console.error("❌ Error in autoReleaseHold Job:", err);
  }
};

// ដំណើរការដោះលែងលុយស្វ័យប្រវត្តរៀងរាល់ ១០ វិនាទីម្តងដូចដើម
setInterval(autoReleaseHold, 10000);

// ==========================================
// 🛡 ១៦. ADMIN ACTIONS (KYC & TICKETS - MongoDB Version)
// ==========================================

// 1. API សម្រាប់អនុម័ត ឬ បដិសេធឯកសារ KYC (Approve/Reject KYC)
app.post("/api/admin/kyc-action", async (req, res) => {
  // 💡 ថែម async
  const { username, action } = req.body;

  try {
    const u = await User.findOne({ username });
    if (u) {
      u.kycStatus = action;

      if (!u.notifications) u.notifications = [];
      u.notifications.unshift({
        id: "NOTIF-" + Date.now(),
        title: "KYC Verification",
        message: `ឯកសារបញ្ជាក់អត្តសញ្ញាណរបស់អ្នកត្រូវបាន ${action === "approved" ? "អនុម័តជោគជ័យ ✅" : "បដិសេធ ❌"}។`,
        date:
          typeof getFormattedDate === "function"
            ? getFormattedDate()
            : new Date().toLocaleString(),
        isRead: false,
        sender: "system",
      });

      await u.save(); // 💾 រក្សាទុកចូល MongoDB
      res.json({ success: true });
    } else {
      res.json({ success: false });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

// 2. API សម្រាប់ Admin ឆ្លើយតប Support Ticket ទៅកាន់ភ្ញៀវ (Reply to Support Ticket)
app.post("/api/admin/ticket-reply", async (req, res) => {
  // 💡 ថែម async
  const { username, ticketId, replyMessage } = req.body;

  try {
    const u = await User.findOne({ username });
    if (u && u.tickets) {
      const t = u.tickets.find((t) => t.ticketId === ticketId);
      if (t) {
        t.status = "Answered";
        t.adminReply = replyMessage;

        if (!u.notifications) u.notifications = [];
        u.notifications.unshift({
          id: "NOTIF-" + Date.now(),
          title: "Support Reply: " + t.subject,
          message: `Admin: ${replyMessage}`,
          date:
            typeof getFormattedDate === "function"
              ? getFormattedDate()
              : new Date().toLocaleString(),
          isRead: false,
          sender: "system",
        });

        u.markModified("tickets"); // ប្រាប់ Mongoose ថា Array tickets ខាងក្នុងមានការប្រែប្រួល
        await u.save(); // 💾 រក្សាទុកចូល MongoDB Atlas
        res.json({ success: true });
      } else {
        res.json({ success: false });
      }
    } else {
      res.json({ success: false });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

// ==========================================
// 💬 ប្រព័ន្ធ CHAT ថ្មី (UNIFIED CHAT - BOT & HUMAN - MongoDB Version)
// ==========================================
// 💡 លែងត្រូវការការប្រើប្រាស់ file chats.json ទៀតហើយ ព្រោះយើងរក្សាទុកលើ MongoDB Collection ផ្ទាល់

// ១. API សម្រាប់ផ្ញើសារ និងគ្រប់គ្រងចរន្តភ្នាក់ងារ (Send Message & Chat Logic)
app.post("/api/chat/send", async (req, res) => {
  // 💡 ថែម async
  const { senderAcc, receiverAcc, message, adminName } = req.body;

  try {
    // ស្វែងរកគណនី (អនុញ្ញាតអោយ ADMIN ក្លាយជាគណនីកណ្តាល)
    const getAcc = async (acc) => {
      if (acc === "ADMIN") return { accountNumber: "ADMIN" };
      return await User.findOne({
        $or: [{ accountNumber: acc }, { accountNumberKHR: acc }],
      });
    };

    const sender = await getAcc(senderAcc);
    const receiver = await getAcc(receiverAcc);

    if (!sender || !receiver)
      return res.json({ success: false, message: "រកមិនឃើញគណនីនេះទេ!" });

    // 🔥 គ្រប់គ្រងចរន្តនៃសារ ដោយគ្រាន់តែ "លួចស្តាប់" និង "បើកផ្លូវ" តែមិនតបសារជាន់គ្នាទេ
    if (senderAcc === "ADMIN") {
      // បើ Admin ចុចបញ្ចប់ការសន្ទនា ទម្លាក់ User ចេញពីបញ្ជី Admin វិញ
      if (message.includes("ការសន្ទនាត្រូវបានបញ្ចប់ដោយ Admin")) {
        const realUser = await User.findOne({
          accountNumber: receiver.accountNumber,
        });
        if (realUser) {
          realUser.needsSupport = false;
          await realUser.save(); // 💾 រក្សាទុកស្ថានភាព
        }
      }
    } else {
      // បើ User ជាអ្នកផ្ញើ
      const realUser = await User.findOne({
        accountNumber: sender.accountNumber,
      });
      if (realUser) {
        // បើមិនទាន់ភ្ជាប់ទៅ Admin ទេ (កំពុងជួប Bot) យើងចាំចាប់ពាក្យសម្ងាត់
        if (!realUser.needsSupport) {
          const text = message.toLowerCase();
          // បើភ្ញៀវសុំជួបភ្នាក់ងារ យើងគ្រាន់តែបើកផ្លូវអោយ Admin ឃើញឈ្មោះ
          if (text.includes("human") || text.includes("ភ្នាក់ងារ")) {
            realUser.needsSupport = true; // លោតឈ្មោះចូល Admin Dashboard
            await realUser.save(); // 💾 រក្សាទុកស្ថានភាព
          }
        }
      }
    }

    // ផ្ទុកសារចូល Database MongoDB (ទម្រង់ចាស់របស់ប្អូន ១០០%)
    const newMessage = new Chat({
      id: "MSG-" + Date.now(),
      senderAcc: sender.accountNumber || "ADMIN",
      receiverAcc: receiver.accountNumber || "ADMIN",
      message: message,
      adminName: adminName || null,
      time:
        typeof getFormattedDate === "function"
          ? getFormattedDate()
          : new Date().toLocaleString(),
      timestamp: Date.now(),
      isRead: false,
    });

    await newMessage.save(); // 💾 រក្សាទុកសារចូល MongoDB Atlas
    res.json({ success: true, message: newMessage });
  } catch (err) {
    console.error("Chat Send Error:", err);
    res.status(500).json({ success: false, message: "Server Chat មានបញ្ហា" });
  }
});

// ២. API ទាញយកប្រវត្តិសាររវាងគូសន្ទនា (Get Chat History & Mark Read)
app.post("/api/chat/history", async (req, res) => {
  // 💡 ថែម async
  const { user1Acc, user2Acc } = req.body;

  try {
    // 🔍 ទាញយកសារទាំងអស់រវាង User ទាំងពីរចេញពី MongoDB
    const history = await Chat.find({
      $or: [
        { senderAcc: user1Acc, receiverAcc: user2Acc },
        { senderAcc: user2Acc, receiverAcc: user1Acc },
      ],
    });

    // 🔄 ប្តូរស្ថានភាពសារដែលទទួលបានឱ្យទៅជាបានអានរួច (isRead = true)
    await Chat.updateMany(
      { receiverAcc: user1Acc, senderAcc: user2Acc, isRead: false },
      { $set: { isRead: true } },
    );

    res.json({ success: true, history: history });
  } catch (err) {
    res.status(500).json({ success: false, history: [] });
  }
});

// ៣. API សម្រាប់ទាញយកបញ្ជីឈ្មោះអ្នកឆាតទាំងអស់ (Get Contact List)
app.post("/api/chat/contacts", async (req, res) => {
  // 💡 ថែម async
  const { myAcc } = req.body;

  try {
    // ទាញយកសារទាំងអស់ដែលពាក់ព័ន្ធនឹង myAcc
    const chats = await Chat.find({
      $or: [{ senderAcc: myAcc }, { receiverAcc: myAcc }],
    });

    // ទាញយកទិន្នន័យ Users ទាំងអស់ដើម្បីយកឈ្មោះ និងរូបភាពមកបង្ហាញ
    const users = await User.find({});
    let contactMap = {};

    for (let c of chats) {
      const partnerAcc = c.senderAcc === myAcc ? c.receiverAcc : c.senderAcc;

      // 🔥 កំណត់សិទ្ធិអោយ Admin ឃើញ
      let isValidToDisplay = true;
      let pName = "Unknown";
      let pImg = "";

      if (partnerAcc === "ADMIN") {
        pName = "U-PAY Support";
        pImg =
          "https://ui-avatars.com/api/?name=Support&background=004d40&color=fff";
      } else {
        const partnerInfo = users.find((u) => u.accountNumber === partnerAcc);
        if (partnerInfo) {
          pName = partnerInfo.fullName || partnerInfo.username;
          pImg = partnerInfo.profileImage;

          // 🚨 ចំណុចសំខាន់៖ បើ Account ជា Admin ត្រូវឆែកមើលថាអតិថិជនសុំជួបភ្នាក់ងារឬនៅ?
          if (myAcc === "ADMIN" && !partnerInfo.needsSupport) {
            isValidToDisplay = false;
          }
        }
      }

      // បើឆែកទៅត្រឹមត្រូវ ទើបបញ្ជូនទៅបង្ហាញ
      if (isValidToDisplay) {
        if (
          !contactMap[partnerAcc] ||
          contactMap[partnerAcc].timestamp < c.timestamp
        ) {
          // រាប់ចំនួនសារមិនទាន់អានសម្រាប់ Contact នេះ
          const unreadCount = chats.filter(
            (m) =>
              m.receiverAcc === myAcc &&
              m.senderAcc === partnerAcc &&
              !m.isRead,
          ).length;

          contactMap[partnerAcc] = {
            accountNumber: partnerAcc,
            name: pName,
            profileImage: pImg,
            lastMessage: c.message,
            time: c.time,
            timestamp: c.timestamp,
            unreadCount: unreadCount,
          };
        }
      }
    }

    // ត្រងយកតែអ្នកដែលមិនទាន់បញ្ចប់ការសន្ទនា
    const activeContacts = Object.values(contactMap)
      .filter((c) => {
        if (
          myAcc === "ADMIN" &&
          c.lastMessage.includes("ការសន្ទនាត្រូវបានបញ្ចប់ដោយ Admin")
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => b.timestamp - a.timestamp);

    res.json({ success: true, contacts: activeContacts });
  } catch (err) {
    console.error("Get Contacts Error:", err);
    res.status(500).json({ success: false, contacts: [] });
  }
});

// ៤. API ឆែកមើលព័ត៌មាន User តាមលេខគណនី (Check Chat User Info)
app.post("/api/chat/check-user", async (req, res) => {
  // 💡 ថែម async
  const { accountNumber } = req.body;

  try {
    const targetUser = await User.findOne({
      $or: [
        { accountNumber: accountNumber },
        { accountNumberKHR: accountNumber },
      ],
    });

    if (targetUser) {
      res.json({
        success: true,
        name: targetUser.fullName || targetUser.username,
        accountNumber: targetUser.accountNumber,
        profileImage: targetUser.profileImage,
      });
    } else {
      res.json({ success: false, message: "លេខគណនីមិនត្រឹមត្រូវទេ!" });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
});
// ==========================================
// 🔑 ប្រព័ន្ធ FORGOT PASSWORD & OTP SYSTEM (MongoDB Version)
// ==========================================
let tempForgotOtps = {}; // ផ្ទុកលេខកូដ OTP បណ្តោះអាសន្នលើ Memory Server ដដែល

// ១. API សម្រាប់ឆែកគណនី និងបង្កើត OTP
app.post("/api/forgot-password/verify-user", async (req, res) => {
  // 💡 ថែម async
  const { identifier } = req.body;

  try {
    // 🔍 ស្វែងរកអ្នកប្រើប្រាស់តាម Username ឬ លេខទូរស័ព្ទក្នុង MongoDB
    const user = await User.findOne({
      $or: [{ username: identifier }, { phone: identifier }],
    });

    if (!user) {
      return res.json({
        success: false,
        message: "រកមិនឃើញគណនី ឬលេខទូរស័ព្ទនេះក្នុងប្រព័ន្ធទេ! ❌",
      });
    }

    // បង្កើតលេខកូដ OTP ៦ខ្ទង់ (Random)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    tempForgotOtps[user.username] = otp; // រក្សាទុកបណ្តោះអាសន្នលើ Server

    // ផ្ញើលទ្ធផលត្រឡប់ទៅវិញ (ភ្ជាប់ជាមួយ OTP ដើម្បីឱ្យ Frontend លោត Alert បែប Simulation)
    res.json({
      success: true,
      username: user.username,
      phone: user.phone,
      otp: otp,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

// ២. API សម្រាប់ផ្ទៀងផ្ទាត់ OTP និងប្តូរ Password ថ្មី
app.post("/api/forgot-password/reset-password", async (req, res) => {
  // 💡 ថែម async
  const { username, otp, newPassword } = req.body;

  // ឆែកមើលថាតើ OTP ត្រូវជាមួយអ្វីដែលរក្សាទុកលើ Server ដែរឬទេ
  if (!tempForgotOtps[username] || tempForgotOtps[username] !== otp) {
    return res.json({
      success: false,
      message: "លេខកូដ OTP មិនត្រឹមត្រូវ ឬផុតកំណត់ហើយ! ❌",
    });
  }

  try {
    const user = await User.findOne({ username });

    if (user) {
      user.password = newPassword; // ធ្វើបច្ចុប្បន្នភាព Password ថ្មី
      await user.save(); // 💾 រក្សាទុកចូល MongoDB

      delete tempForgotOtps[username]; // ប្រើរួចលុបចោលដើម្បីសុវត្ថិភាព
      return res.json({
        success: true,
        message: "ពាក្យសម្ងាត់របស់អ្នកត្រូវបានប្តូរជោគជ័យ! 🟢",
      });
    }

    res.json({
      success: false,
      message: "មានបញ្ហាផ្នែកប្រព័ន្ធ សូមព្យាយាមម្តងទៀត!",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

// ==========================================
// 🌐 CONFIGURATIONS & MIDDLEWARES
// ==========================================

// URL របស់ PayHub KH
const PAYHUB_URL = "https://payhub-kh.onrender.com";

// 👉 កូដបើកសិទ្ធិទូលាយ CORS អនុញ្ញាតឱ្យរាល់ Website ទាំងអស់ (រួមទាំង PAYHUB) អាចទាញទិន្នន័យបាន
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json());

// បម្រើឯកសារ upay.html ពី Folder public
app.use(express.static(path.join(__dirname, "public")));

// ពេលវាយ localhost:3000 លោតទៅ upay.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "upay.html"));
});

// មុខងារជំនួយសម្រាប់បង្កើត Compact Hash
const generateCompactHash = () =>
  Math.random().toString(36).substring(2, 10).toUpperCase();

// ==========================================
// 💳 ប្រព័ន្ធទូទាត់វិក្កយបត្រ (BILL PAYMENTS INTERACTION WITH PAYHUB)
// ==========================================

// ១. API: U-PAY ឆែកវិក្កយបត្រដោយបាញ់ឆ្លងទៅ PayHub Gateway
app.post("/api/bank/scan-bill", async (req, res) => {
  const { bill_id } = req.body;
  try {
    // បាញ់ Request ទៅកាន់ API Gateway របស់ PayHub KH
    const response = await fetch(
      `${PAYHUB_URL}/api/gateway/check-bill?query=${encodeURIComponent(bill_id)}`,
    );
    const data = await response.json();

    if (response.ok && data.success) {
      res.json({ success: true, billData: data.bill });
    } else {
      res
        .status(404)
        .json({ success: false, message: data.message || "រកមិនឃើញទិន្នន័យ" });
    }
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: "មិនអាចភ្ជាប់ទៅប្រព័ន្ធ PayHub បានទេ" });
  }
});

// ២. API: បង់ប្រាក់វិក្កយបត្រ និង Settlement លុយចូលក្រុមហ៊ុន (Pay & Settle)
app.post("/api/bank/pay-bill", async (req, res) => {
  const { bill_id, company, amount, username } = req.body;

  try {
    // 🔍 ស្វែងរកគណនីអ្នកបង់ប្រាក់ក្នុង MongoDB
    let payingUser = await User.findOne({ username });

    if (!payingUser)
      return res
        .status(404)
        .json({ success: false, message: "រកមិនឃើញគណនីរបស់អ្នក!" });

    if (payingUser.balance < amount)
      return res
        .status(400)
        .json({ success: false, message: "សមតុល្យមិនគ្រប់គ្រាន់!" });

    // 🔄 ផ្ញើការទូទាត់ទៅកាន់ Link ផ្លូវការរបស់ PAYHUB លើ Cloud Internet
    const response = await fetch(`${PAYHUB_URL}/api/gateway/pay`, {
      // 💡 ជួសជុល Bug Link និងការប្រកាស const response
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bill_id: bill_id }), // 💡 កែពី currentBillId (Bug) មកជា bill_id ដែលផ្ញើមកពី client ផ្ទាល់
    });

    const data = await response.json();

    if (response.ok && data.success) {
      // ទាញយកទិន្នន័យដើម្បីស្វែងរកព័ត៌មានកាត់ភាគរយ (Fee Percent) របស់ក្រុមហ៊ុនពី PayHub
      const compRes = await fetch(`${PAYHUB_URL}/api/admin/users`);
      const payhubUsers = await compRes.json();
      const compData = payhubUsers.find(
        (u) => u.name === company && u.role === "company",
      );

      // កាត់លុយ និងកត់ត្រាប្រវត្តិប្រតិបត្តិការរបស់ User (ទម្រង់ដើមដដែល)
      payingUser.balance -= amount;
      if (!payingUser.transactions) payingUser.transactions = [];
      const newHash = generateCompactHash(); // បង្កើត Hash តែមួយរួមគ្នា
      const currentRefId = `BP-${Date.now()}`;

      payingUser.transactions.unshift({
        refId: currentRefId,
        hash: newHash,
        date: new Date().toLocaleString("en-US", {
          timeZone: "Asia/Phnom_Penh",
        }),
        type: "Bill Payment",
        amount: -amount,
        receiverName: company,
        remark: "ទូទាត់វិក្កយបត្រ: " + bill_id,
        status: "Success",
      });

      await payingUser.save(); // 💾 រក្សាទុកទិន្នន័យ User ចូល MongoDB

      // បញ្ចូលលុយទៅឱ្យគណនីក្រុមហ៊ុន (Settlement)
      if (compData && compData.upay_account) {
        const fee_percent = parseFloat(compData.fee_percent) || 0;
        const net_amount = amount - (amount * fee_percent) / 100;

        // 🔍 ស្វែងរកគណនីក្រុមហ៊ុននៅក្នុងប្រព័ន្ធ U-PAY តាមរយៈលេខគណនី
        let companyAccount = await User.findOne({
          $or: [
            { accountNumber: compData.upay_account },
            { accountNumberKHR: compData.upay_account },
          ],
        });

        if (companyAccount) {
          companyAccount.balance =
            (parseFloat(companyAccount.balance) || 0) + net_amount;
          if (!companyAccount.transactions) companyAccount.transactions = [];

          companyAccount.transactions.unshift({
            refId: `SETTLE-${Date.now()}`,
            hash: newHash,
            date: new Date().toLocaleString("en-US", {
              timeZone: "Asia/Phnom_Penh",
            }),
            type: "Bill Settlement",
            amount: net_amount,
            senderName: payingUser.fullName || payingUser.username,
            remark: `ទូទាត់វិក្កយបត្រ ${bill_id} (Fee: ${fee_percent}%)`,
            status: "Success",
          });

          await companyAccount.save(); // 💾 រក្សាទុកទិន្នន័យក្រុមហ៊ុនចូល MongoDB
        }
      }

      // ឆ្លើយតបទៅកាន់ Frontend
      res.json({
        success: true,
        newBalance: payingUser.balance,
        transaction_id: currentRefId,
        hash: newHash,
      });
    } else {
      res.status(400).json({
        success: false,
        message: data.message || "ការទូទាត់នៅ PayHub បរាជ័យ",
      });
    }
  } catch (err) {
    console.error("Pay Bill Error:", err);
    res
      .status(500)
      .json({ success: false, message: "ការទូទាត់បរាជ័យ (Server Error)" });
  }
});
// ==========================================
// ថ្មី៖ API សម្រាប់ផ្ទៀងផ្ទាត់លេខគណនី U-PAY (ទាញពី Database MongoDB ពិត)
// ==========================================
app.get("/api/bank/verify-account/:account_number", async (req, res) => {
  // 💡 ថែម async
  const { account_number } = req.params;

  try {
    // 🔍 ស្វែងរកគណនីអ្នកប្រើប្រាស់ក្នុង MongoDB ទាំងកុង USD ឬ កុង KHR
    const targetUser = await User.findOne({
      $or: [
        { accountNumber: account_number },
        { accountNumberKHR: account_number },
      ],
    });

    if (targetUser) {
      // បើរកឃើញ បោះ success: true (រក្សាទម្រង់ Key ដើម ១០០%)
      return res.json({
        success: true,
        account_name: targetUser.fullName || targetUser.username,
      });
    } else {
      // 🔥 សំខាន់ខ្លាំង៖ បើរកមិនឃើញ ត្រូវតែបោះ success: false ទៅប្រាប់គេវិញភ្លាម កុំឱ្យគេអង្គុយវិលចាំ
      return res.json({
        success: false,
        message: "រកមិនឃើញលេខគណនីនេះនៅក្នុងប្រព័ន្ធ U-PAY ទេ!",
      });
    }
  } catch (err) {
    console.error("Verify Account Error:", err);
    res.status(500).json({
      success: false,
      message: "Server Error ក្នុងការផ្ទៀងផ្ទាត់គណនី",
    });
  }
});

// ==========================================
// 🚀 ចាប់ផ្តើម SERVER (START SERVER)
// ==========================================

app.listen(PORT, () => {
  console.log(
    `🚀🔥 U-PAY Banking Server is running successfully on port ${PORT}`,
  );
});
