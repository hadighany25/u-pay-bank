const express = require("express");
const fs = require("fs");
const cors = require("cors");
const path = require("path");
const TelegramBot = require("node-telegram-bot-api");
const multer = require("multer");

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// ⚙️ ១. ការកំណត់ទូទៅ (SERVER CONFIGURATION)
// ==========================================
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(express.static("public"));
app.use(cors());

// កំណត់ទីតាំងផ្ទុករូបភាពដែលគេ Upload ចូលមក (Save ចូល /public/uploads/)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, "public", "uploads");
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage: storage });

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

app.post("/api/register", (req, res) => {
  const { username, password, fullName, phone, pin } = req.body;
  let users = readData();

  if (users.find((u) => u.username === username)) {
    return res.json({ success: false, message: "Username already taken!" });
  }

  // 🔥 ហៅមុខងារបង្កើតលេខកុងអូតូតាម Pattern ថ្មី
  const newAccs = generatePatternAccounts(users);

  // 🛡️ ការពារទី ១: កុង USD និង KHR របស់គាត់ផ្ទាល់ហាមដូចគ្នា
  if (newAccs.usd === newAccs.khr) {
    return res.json({
      success: false,
      message: "ប្រព័ន្ធមានបញ្ហា! លេខគណនី USD និង KHR មិនអាចដូចគ្នាទេ។",
    });
  }

  // 🛡️ ការពារទី ២: ហាមជាន់នឹងលេខគណនីរបស់អ្នកផ្សេង
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

  const newUser = {
    id: Date.now().toString(),
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
    trxLimit: 1000.0,
    profileImage: "",
    isFrozen: false,
    isOnline: false,
    pinAttempts: 0,
    transactions: [],
    joinDate: new Date().toISOString(),
    lastActive: new Date().toISOString(),
    telegramChatId: null,
    linkCode: null,
    kycStatus: "unverified",
  };

  users.push(newUser);
  writeData(users);
  res.json({ success: true, user: newUser });
});

app.post("/api/login", (req, res) => {
  const { identifier, password } = req.body;
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

  let users = readData();
  const user = users.find(
    (u) =>
      (u.username === identifier ||
        u.phone === identifier ||
        u.fullName === identifier) &&
      u.password === password,
  );

  if (user) {
    if (user.isFrozen)
      return res.json({ success: false, message: "Account Frozen!" });
    user.isOnline = true;
    user.lastActive = new Date().toISOString();
    writeData(users);
    res.json({ success: true, user });
  } else {
    res.json({ success: false, message: "Invalid Credentials" });
  }
});

app.post("/api/logout", (req, res) => {
  const { username } = req.body;
  let users = readData();
  const user = users.find((u) => u.username === username);
  if (user) {
    user.isOnline = false;
    writeData(users);
  }
  res.json({ success: true });
});

app.post("/api/heartbeat", (req, res) => {
  const { username } = req.body;
  let users = readData();
  const idx = users.findIndex((u) => u.username === username);
  if (idx !== -1) {
    users[idx].lastActive = new Date().toISOString();
    writeData(users);
    res.json({ success: true });
  } else res.json({ success: false });
});

app.get("/api/users", (req, res) => {
  res.json(readData());
});

// ==========================================
// 👤 ៦. ការគ្រប់គ្រងទម្រង់គណនី (USER SETTINGS)
// ==========================================
app.post("/api/change-password", (req, res) => {
  const { username, oldPassword, newPassword } = req.body;
  let users = readData();
  const user = users.find((u) => u.username === username);
  if (user && user.password === oldPassword) {
    user.password = newPassword;
    writeData(users);
    res.json({ success: true });
  } else res.json({ success: false, message: "Old password incorrect" });
});

app.post("/api/change-pin", (req, res) => {
  const { username, password, newPin } = req.body;
  let users = readData();
  const user = users.find((u) => u.username === username);
  if (user && user.password === password) {
    user.pin = newPin;
    user.pinAttempts = 0;
    writeData(users);
    res.json({ success: true });
  } else res.json({ success: false, message: "Password incorrect" });
});

app.post("/api/change-limit", (req, res) => {
  const { username, password, newLimit } = req.body;
  let users = readData();
  const user = users.find((u) => u.username === username);
  if (user && user.password === password) {
    user.trxLimit = parseFloat(newLimit);
    writeData(users);
    res.json({ success: true });
  } else res.json({ success: false, message: "Password incorrect" });
});

app.post("/api/user/upload-image", upload.single("profileImg"), (req, res) => {
  const userId = req.body.id;
  if (!req.file)
    return res.json({ success: false, message: "No image uploaded" });
  const imageUrl = "/uploads/" + req.file.filename;
  let users = readData();
  const userIndex = users.findIndex((u) => u.id === userId);
  if (userIndex !== -1) {
    users[userIndex].profileImage = imageUrl;
    writeData(users);
    res.json({ success: true, imageUrl: imageUrl });
  } else res.json({ success: false, message: "User not found" });
});

app.post("/api/user/submit-kyc", upload.single("kycDoc"), (req, res) => {
  const username = req.body.username;
  if (!req.file)
    return res.json({ success: false, message: "No document uploaded" });
  const docUrl = "/uploads/" + req.file.filename;

  let users = readData();
  const user = users.find((u) => u.username === username);
  if (user) {
    user.kycStatus = "pending";
    user.kycDocument = docUrl;
    user.kycSubmittedAt = getFormattedDate();
    writeData(users);
    res.json({
      success: true,
      message: "ឯកសារបញ្ជាក់អត្តសញ្ញាណត្រូវបានបញ្ជូន!",
    });
  } else res.json({ success: false, message: "User not found" });
});

// ==========================================
// 💱 ៧. អត្រាប្តូរប្រាក់ & ផ្ទេរប្រាក់ (EXCHANGE & TRANSFERS)
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

app.get("/api/fx/rates", (req, res) => {
  res.json({ success: true, rates: globalFXRates });
});

app.post("/api/admin/fx/update", (req, res) => {
  const { buy, sell } = req.body;
  writeFX({ usdToKhrBuy: parseFloat(buy), usdToKhrSell: parseFloat(sell) });
  res.json({ success: true, message: "Exchange rates updated successfully!" });
});

app.post("/api/check-account", (req, res) => {
  const { accountNumber } = req.body;
  let users = readData();
  const targetUser = users.find(
    (u) =>
      u.accountNumber === accountNumber || u.accountNumberKHR === accountNumber,
  );

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
});

app.post("/api/transfer", (req, res) => {
  // 🔥 ១. ឆែកមើលថាតើ Admin បានបិទប្រព័ន្ធឬនៅ?
  const system = readSystemStatus();
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
  let users = readData();
  const fxRates = globalFXRates;

  const sender = users.find((u) => u.username === senderUsername);
  const receiver = users.find(
    (u) =>
      u.accountNumber === receiverAccount ||
      u.accountNumberKHR === receiverAccount,
  );

  if (!sender) return res.json({ success: false, message: "Account Error" });
  if (sender.isFrozen)
    return res.json({ success: false, message: "Account Frozen" });

  if (sender.pin !== pin) {
    sender.pinAttempts = (sender.pinAttempts || 0) + 1;
    if (sender.pinAttempts >= 3) {
      sender.isFrozen = true;
      sender.pinAttempts = 0;
      writeData(users);
      return res.json({
        success: false,
        message: "Wrong PIN 3 times! Account Frozen.",
      });
    }
    writeData(users);
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

  let amountInUSDForLimit = isSenderKHR
    ? transferAmount / fxRates.usdToKhrSell
    : transferAmount;
  if (amountInUSDForLimit > sender.trxLimit) {
    return res.json({
      success: false,
      message: `Over Limit! Your limit is $${sender.trxLimit}`,
    });
  }

  if (isSenderKHR) {
    if ((sender.balanceKHR || 0) < transferAmount)
      return res.json({ success: false, message: "Insufficient KHR Balance" });
  } else {
    if (sender.balance < transferAmount)
      return res.json({ success: false, message: "Insufficient USD Balance" });
  }

  if (
    sender.accountNumber === receiverAccount ||
    sender.accountNumberKHR === receiverAccount
  ) {
    return res.json({ success: false, message: "Cannot transfer to self" });
  }

  let receiverAmount = transferAmount;
  if (!isSenderKHR && isReceiverKHR)
    receiverAmount = transferAmount * fxRates.usdToKhrBuy;
  else if (isSenderKHR && !isReceiverKHR)
    receiverAmount = transferAmount / fxRates.usdToKhrSell;

  if (isSenderKHR) sender.balanceKHR -= transferAmount;
  else sender.balance -= transferAmount;
  if (isReceiverKHR)
    receiver.balanceKHR = (receiver.balanceKHR || 0) + receiverAmount;
  else receiver.balance += receiverAmount;

  const date = getFormattedDate();
  const refId = generateRefId();
  const trxHash = generateHash();
  const deviceName = getDevice(req.headers["user-agent"]);
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

  sender.transactions.unshift(senderTrx);
  if (!receiver.transactions) receiver.transactions = [];
  receiver.transactions.unshift(receiverTrx);

  if (!receiver.notifications) receiver.notifications = [];
  receiver.notifications.unshift({
    id: "NOTIF-" + Date.now(),
    title: "Money Received!",
    message: `You have received ${signReceiver}${receiverAmount.toLocaleString("en-US", { minimumFractionDigits: isReceiverKHR ? 0 : 2 })} from ${sender.fullName || sender.username}.`,
    date: date,
    isRead: false,
  });

  writeData(users);

  if (receiver.telegramChatId) {
    let displayAmount = `${signReceiver}${receiverAmount.toLocaleString("en-US", { minimumFractionDigits: isReceiverKHR ? 0 : 2 })}`;
    const alertMsg = `🔔 <b>ប្រាក់ចូល (Money Received)</b> 🔔\n━━━━━━━━━━━━━━━━\n💰 <b>ចំនួនទឹកប្រាក់៖</b> +${displayAmount}\n📥 <b>ចូលគណនី៖</b> ${receiver.fullName || receiver.username}\n📤 <b>ពីគណនី៖</b> ${sender.fullName || sender.username}\n🧾 <b>លេខប្រតិបត្តិការ៖</b> ${refId}\n⏰ <b>កាលបរិច្ឆេទ៖</b> ${date}\n📝 <b>ចំណាំ៖</b> ${remark || "គ្មាន"}\n━━━━━━━━━━━━━━━━━\n✅ <i>ប្រតិបត្តិការជោគជ័យ (U-Pay)</i>`;
    if (typeof bot !== "undefined")
      bot
        .sendMessage(receiver.telegramChatId, alertMsg, { parse_mode: "HTML" })
        .catch((err) => console.error(err));
  }

  res.json({
    success: true,
    newBalance: isSenderKHR ? sender.balanceKHR : sender.balance,
    slipData: senderTrx,
  });
});

app.post("/api/payment", (req, res) => {
  const { username, billerName, billId, amount, pin } = req.body;
  let users = readData();
  const user = users.find((u) => u.username === username);
  const biller = users.find((u) => u.username === billerName);

  if (!user || !biller)
    return res.json({ success: false, message: "Error User/Biller" });
  if (user.isFrozen)
    return res.json({ success: false, message: "Account Frozen" });

  if (user.pin !== pin) {
    user.pinAttempts = (user.pinAttempts || 0) + 1;
    if (user.pinAttempts >= 3) {
      user.isFrozen = true;
      user.pinAttempts = 0;
      writeData(users);
      return res.json({
        success: false,
        message: "Wrong PIN 3 times! Frozen.",
      });
    }
    writeData(users);
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

  const refId = generateRefId();
  const date = getFormattedDate();
  const trx = {
    refId,
    hash: generateHash(),
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
    device: getDevice(req.headers["user-agent"]),
    ip: req.ip,
  };

  user.transactions.unshift(trx);
  biller.transactions.unshift({
    ...trx,
    amount: payAmount,
    type: "Income (Bill)",
  });
  writeData(users);

  if (biller.telegramChatId) {
    const alertMsg = `🔔 <b>វិក្កយបត្របានទូទាត់</b> 🔔\n━━━━━━━━━━━━━━━━━━━━\n💰 <b>ទឹកប្រាក់៖</b> +$${payAmount.toFixed(2)}\n🏢 <b>ហាង៖</b> ${biller.fullName || biller.username}\n👤 <b>អតិថិជន៖</b> ${user.fullName || user.username}\n🧾 <b>វិក្កយបត្រ៖</b> ${billId}\n🏷️ <b>ប្រតិបត្តិការ៖</b> ${refId}\n━━━━━━━━━━━━━━━━━━━━\n✅ <i>ប្រតិបត្តិការជោគជ័យ</i>`;
    if (typeof bot !== "undefined")
      bot
        .sendMessage(biller.telegramChatId, alertMsg, { parse_mode: "HTML" })
        .catch((err) => console.error(err));
  }
  res.json({ success: true, newBalance: user.balance, slipData: trx });
});

// ==========================================
// 💳 ៨. ប្រព័ន្ធកាត (CARD MANAGEMENT SYSTEM)
// ==========================================
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

app.post("/api/card/generate", (req, res) => {
  // 🔥 ១. ឆែកមើលថាតើ Admin បានបិទប្រព័ន្ធឬនៅ?
  const system = readSystemStatus();
  if (system.isSystemFrozen) {
    return res.json({
      success: false,
      message: "ប្រព័ន្ធកំពុងធ្វើការថែទាំ 🛠️ មិនអាចបង្កើតកាតថ្មីបានទេនៅពេលនេះ។",
    });
  }

  const { username, cardType, pin } = req.body;
  let users = readData();
  const user = users.find((u) => u.username === username);

  if (user) {
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

    let feeAccount = users.find((u) => u.accountNumber === "999999999");
    if (!feeAccount) {
      feeAccount = {
        id: "sys_fee_account",
        username: "system_fee",
        fullName: "U-PAY Fee",
        accountNumber: "999999999",
        balance: 0,
        role: "system",
        transactions: [],
      };
      users.push(feeAccount);
    }

    user.balance -= FEE_AMOUNT;
    feeAccount.balance += FEE_AMOUNT;

    const dateStr = getFormattedDate();
    const refId = "FEE-" + Date.now();
    const hash = generateHash();
    if (!user.transactions) user.transactions = [];
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
    if (!feeAccount.transactions) feeAccount.transactions = [];
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
    writeData(users);
    res.json({
      success: true,
      cards: user.virtualCards,
      newBalance: user.balance,
    });
  } else res.json({ success: false, message: "User not found" });
});

app.post("/api/card/toggle-lock", (req, res) => {
  const { username, cardId, isLocked } = req.body;
  let users = readData();
  const user = users.find((u) => u.username === username);
  if (user && user.virtualCards) {
    const card = user.virtualCards.find((c) => c.id === cardId);
    if (card) {
      card.isLocked = isLocked;
      writeData(users);
      return res.json({ success: true, cards: user.virtualCards });
    }
  }
  res.json({ success: false, message: "Card not found" });
});

app.post("/api/card/toggle-online-pay", (req, res) => {
  const { username, cardId, isEnabled } = req.body;
  let users = readData();
  const user = users.find((u) => u.username === username);
  if (user && user.virtualCards) {
    const card = user.virtualCards.find((c) => c.id === cardId);
    if (card) {
      card.isOnlinePayEnabled = isEnabled;
      writeData(users);
      return res.json({ success: true, cards: user.virtualCards });
    }
  }
  res.json({ success: false });
});

app.post("/api/card/change-pin", (req, res) => {
  const { username, cardId, oldPin, newPin } = req.body;
  let users = readData();
  const user = users.find((u) => u.username === username);
  if (user && user.virtualCards) {
    const card = user.virtualCards.find((c) => c.id === cardId);
    if (!card) return res.json({ success: false, message: "រកមិនឃើញកាត!" });
    if (card.pin !== oldPin)
      return res.json({
        success: false,
        message: "លេខ PIN ចាស់មិនត្រឹមត្រូវ!",
      });
    card.pin = newPin;
    writeData(users);
    res.json({ success: true, message: "ប្តូរលេខ PIN កាតជោគជ័យ!" });
  } else res.json({ success: false, message: "រកមិនឃើញអ្នកប្រើប្រាស់!" });
});

app.post("/api/card/update-limit", (req, res) => {
  const { username, cardId, newLimit } = req.body;
  let users = readData();
  const user = users.find((u) => u.username === username);
  if (user && user.virtualCards) {
    const card = user.virtualCards.find((c) => c.id === cardId);
    if (card) {
      card.dailyLimit = parseFloat(newLimit);
      writeData(users);
      return res.json({ success: true, cards: user.virtualCards });
    }
  }
  res.json({ success: false, message: "រកមិនឃើញកាត!" });
});

app.post("/api/card/delete", (req, res) => {
  const { username, cardId } = req.body;
  let users = readData();
  const user = users.find((u) => u.username === username);
  if (user && user.virtualCards) {
    const initialCount = user.virtualCards.length;
    user.virtualCards = user.virtualCards.filter((c) => c.id !== cardId);
    if (user.virtualCards.length < initialCount) {
      writeData(users);
      return res.json({ success: true, cards: user.virtualCards });
    }
  }
  res.json({ success: false, message: "Error deleting card" });
});

let pendingPayments = [];
app.post("/api/card/request-payment", (req, res) => {
  // 🔥 ១. ឆែកមើលថាតើ Admin បានបិទប្រព័ន្ធឬនៅ?
  const system = readSystemStatus();
  if (system.isSystemFrozen) {
    return res.json({
      success: false,
      message:
        "ប្រព័ន្ធធនាគាកំពុងធ្វើការថែទាំ (Maintenance) 🛠️ មិនអាចធ្វើការទូទាត់បានទេ។",
    });
  }

  const { cardNumber, expiry, cvv, amount, orderId, shopName } = req.body;
  let users = readData();
  let owner = null,
    targetCard = null;
  for (let u of users) {
    if (u.virtualCards) {
      const card = u.virtualCards.find(
        (c) => c.number === cardNumber && c.expiry === expiry && c.cvv === cvv,
      );
      if (card) {
        owner = u;
        targetCard = card;
        break;
      }
    }
  }

  if (!owner || !targetCard)
    return res.json({ success: false, message: "ព័ត៌មានកាតមិនត្រឹមត្រូវ!" });
  if (targetCard.isLocked)
    return res.json({ success: false, message: "កាតនេះត្រូវបានបង្កក!" });
  if (targetCard.isOnlinePayEnabled === false)
    return res.json({ success: false, message: "ការទូទាត់អនឡាញត្រូវបានបិទ។" });

  const totalSpentToday = (owner.transactions || [])
    .filter(
      (t) =>
        t.cardId === targetCard.id &&
        t.type === "Card Payment" &&
        t.date.includes(
          new Date().toLocaleDateString("en-US", {
            timeZone: "Asia/Phnom_Penh",
          }),
        ),
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
    date: getFormattedDate(),
  });

  // 🔥 ថ្មី៖ បាញ់សំណើចូលទៅកាន់ Notification របស់ User ផ្ទាល់
  if (!owner.notifications) owner.notifications = [];
  owner.notifications.unshift({
    id: "NOTIF-" + paymentId,
    title: "សំណើទូទាត់ប្រាក់ 🛒",
    message: `ហាង <b>${shopName}</b> បានស្នើសុំកាត់ប្រាក់ <b>$${parseFloat(amount).toFixed(2)}</b> ពីកាតរបស់អ្នក។<br><br>
    <button onclick="handlePaymentRequest('${paymentId}', '${shopName}', ${amount})" style="background:#10b981; color:white; border:none; padding:5px 10px; border-radius:5px; cursor:pointer; margin-top:10px;">ចុចទីនេះដើម្បីទូទាត់</button>`,
    date: getFormattedDate(),
    isRead: false,
    sender: "system",
    type: "payment_request",
  });

  // កុំភ្លេច Save ទិន្នន័យ
  writeData(users);

  res.json({ success: true, paymentId: paymentId });
});

app.get("/api/user/pending-payments/:username", (req, res) => {
  const searchUsername = req.params.username.toLowerCase();
  const list = pendingPayments.filter(
    (p) => p.username === searchUsername && p.status === "pending",
  );
  res.json({ success: true, pending: list });
});

app.post("/api/card/confirm-payment", (req, res) => {
  const { paymentId, pin, username } = req.body;
  let users = readData();
  const user = users.find((u) => u.username === username);
  const payIndex = pendingPayments.findIndex((p) => p.paymentId === paymentId);

  if (!user || payIndex === -1)
    return res.json({ success: false, message: "សំណើមិនត្រឹមត្រូវ!" });
  const payment = pendingPayments[payIndex];
  const usedCard = user.virtualCards.find(
    (c) => c.number === payment.cardNumber,
  );
  if (!usedCard || usedCard.pin !== pin)
    return res.json({ success: false, message: "លេខ PIN មិនត្រឹមត្រូវ!" });

  user.balance -= payment.amount;
  user.transactions.unshift({
    refId: paymentId,
    hash: generateHash(),
    date: getFormattedDate(),
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

  // 🔥 ថ្មី៖ លុបសារ Notification ចេញពីកុងអ្នកប្រើប្រាស់ បន្ទាប់ពីទូទាត់រួច
  if (user.notifications) {
    user.notifications = user.notifications.filter(
      (n) => n.id !== "NOTIF-" + paymentId,
    );
  }

  writeData(users);
  res.json({ success: true, message: "ការទូទាត់ជោគជ័យ!" });
});

app.post("/api/card/decline-payment", (req, res) => {
  const { paymentId } = req.body;
  const payIndex = pendingPayments.findIndex((p) => p.paymentId === paymentId);

  if (payIndex !== -1) {
    pendingPayments[payIndex].status = "declined";

    // 🔥 ថ្មី៖ ស្វែងរកម្ចាស់កុង ហើយលុបសារ Notification ចេញពីកុងអ្នកប្រើប្រាស់
    let users = readData();
    const ownerUsername = pendingPayments[payIndex].username;
    const owner = users.find((u) => u.username === ownerUsername);

    if (owner && owner.notifications) {
      owner.notifications = owner.notifications.filter(
        (n) => n.id !== "NOTIF-" + paymentId,
      );
      writeData(users);
    }

    return res.json({ success: true });
  }
  res.json({ success: false });
});

app.get("/api/card/check-status/:paymentId", (req, res) => {
  const pay = pendingPayments.find((p) => p.paymentId === req.params.paymentId);
  res.json({ success: true, status: pay ? pay.status : "expired" });
});

// ==========================================
// 🐷 ៩. កូនជ្រូកសន្សំប្រាក់ (SAVINGS GOALS)
// ==========================================
app.post("/api/savings/create", (req, res) => {
  const { username, goalName, targetAmount } = req.body;
  let users = readData();
  const user = users.find((u) => u.username === username);
  if (user) {
    if (!user.savings) user.savings = [];
    user.savings.push({
      id: "goal_" + Date.now(),
      name: goalName,
      target: parseFloat(targetAmount),
      current: 0,
      status: "active",
      createdAt: new Date().toISOString(),
    });
    writeData(users);
    res.json({ success: true, savings: user.savings });
  } else res.json({ success: false });
});

app.post("/api/savings/deposit", (req, res) => {
  const { username, goalId, amount } = req.body;
  let users = readData();
  const user = users.find((u) => u.username === username);
  if (user) {
    const depositAmount = parseFloat(amount);
    if (user.balance < depositAmount)
      return res.json({ success: false, message: "Insufficient balance!" });
    const goal = user.savings?.find((g) => g.id === goalId);
    if (goal) {
      user.balance -= depositAmount;
      goal.current += depositAmount;
      user.transactions.unshift({
        refId: generateRefId(),
        hash: generateHash(),
        date: getFormattedDate(),
        type: "Saving Deposit",
        amount: -depositAmount,
        fee: 0,
        senderName: user.username,
        receiverName: `Piggy Bank: ${goal.name}`,
        remark: "Saved to Goal",
        status: "Success",
      });
      writeData(users);
      res.json({ success: true, balance: user.balance, savings: user.savings });
    } else res.json({ success: false });
  } else res.json({ success: false });
});

app.post("/api/savings/break", (req, res) => {
  const { username, goalId } = req.body;
  let users = readData();
  const user = users.find((u) => u.username === username);
  if (user && user.savings) {
    const goalIndex = user.savings.findIndex((g) => g.id === goalId);
    if (goalIndex !== -1) {
      const refundAmount = user.savings[goalIndex].current;
      if (refundAmount > 0) {
        user.balance += refundAmount;
        user.transactions.unshift({
          refId: generateRefId(),
          hash: generateHash(),
          date: getFormattedDate(),
          type: "Saving Withdrawal",
          amount: refundAmount,
          fee: 0,
          senderName: `Piggy Bank`,
          receiverName: user.username,
          remark: "Broke Piggy Bank",
          status: "Success",
        });
      }
      user.savings.splice(goalIndex, 1);
      writeData(users);
      res.json({
        success: true,
        balance: user.balance,
        savings: user.savings,
        amount: refundAmount,
      });
    } else res.json({ success: false });
  } else res.json({ success: false });
});

// ==========================================
// 🏦 ១០. គណនីបញ្ញើ (FIXED DEPOSITS)
// ==========================================
app.post("/api/fixed-deposit", (req, res) => {
  const { accountNumber, amount, pin, duration, rate, type, currency } =
    req.body;
  const depAmount = parseFloat(amount);
  let users = readData();

  const userIndex = users.findIndex(
    (u) =>
      u.accountNumber === accountNumber || u.accountNumberKHR === accountNumber,
  );
  if (userIndex === -1 || users[userIndex].pin !== pin)
    return res.json({ success: false, message: "លេខ PIN មិនត្រឹមត្រូវទេ" });

  const isKHR = currency === "KHR";

  if (isKHR) {
    if ((users[userIndex].balanceKHR || 0) < depAmount)
      return res.json({
        success: false,
        message: "សមតុល្យប្រាក់រៀលមិនគ្រប់គ្រាន់ទេ",
      });
  } else {
    if (users[userIndex].balance < depAmount)
      return res.json({
        success: false,
        message: "សមតុល្យប្រាក់ដុល្លារមិនគ្រប់គ្រាន់ទេ",
      });
  }

  // 🔥 ប្រើប្រាស់គណនី Central Bank ដែលធានាថាមានជានិច្ច
  const centralBank = users.find((u) => u.accountNumber === "888888888");

  if (isKHR) {
    users[userIndex].balanceKHR -= depAmount;
    centralBank.balanceKHR = (centralBank.balanceKHR || 0) + depAmount;
  } else {
    users[userIndex].balance -= depAmount;
    centralBank.balance += depAmount;
  }

  const dateStr = getFormattedDate();
  const refId = "DEP-" + Date.now();
  const hash = generateHash();
  const senderAcc = isKHR
    ? users[userIndex].accountNumberKHR
    : users[userIndex].accountNumber;
  const bankAcc = isKHR
    ? centralBank.accountNumberKHR
    : centralBank.accountNumber;

  if (!users[userIndex].transactions) users[userIndex].transactions = [];
  users[userIndex].transactions.unshift({
    refId,
    hash,
    date: dateStr,
    type: `Fixed Deposit - ${type}`,
    amount: -depAmount,
    currency: isKHR ? "KHR" : "USD",
    senderName: users[userIndex].fullName || users[userIndex].username,
    senderAccount: senderAcc,
    receiverName: "U-Pay Central Bank",
    receiverAccount: bankAcc,
    status: "Success",
    trxMethod: "Fixed Deposit",
    isHold: false,
  });

  if (!centralBank.transactions) centralBank.transactions = [];
  centralBank.transactions.unshift({
    refId,
    hash,
    date: dateStr,
    type: `Received Deposit - ${type}`,
    amount: depAmount,
    currency: isKHR ? "KHR" : "USD",
    senderName: users[userIndex].fullName || users[userIndex].username,
    senderAccount: senderAcc,
    receiverName: "U-Pay Central Bank",
    receiverAccount: bankAcc,
    status: "Success",
    trxMethod: "Fixed Deposit",
    isHold: false,
  });

  if (!users[userIndex].deposits) users[userIndex].deposits = [];
  users[userIndex].deposits.push({
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

  writeData(users);
  res.json({
    success: true,
    newBalance: isKHR ? users[userIndex].balanceKHR : users[userIndex].balance,
  });
});

app.post("/api/fixed-deposit/withdraw", (req, res) => {
  const { accountNumber, depositId } = req.body;
  let users = readData();
  const user = users.find(
    (u) =>
      u.accountNumber === accountNumber || u.accountNumberKHR === accountNumber,
  );
  const centralBank = users.find((u) => u.accountNumber === "888888888");

  if (!user || !centralBank || !user.deposits)
    return res.json({ success: false, message: "រកមិនឃើញគណនី ឬប្រាក់បញ្ញើទេ" });

  const depIndex = user.deposits.findIndex(
    (d) => d.id === depositId && d.status === "active",
  );
  if (depIndex === -1)
    return res.json({
      success: false,
      message: "ប្រាក់បញ្ញើនេះត្រូវបានដក ឬអសកម្ម",
    });

  const deposit = user.deposits[depIndex];
  const withdrawAmount = deposit.amount;
  const isKHR = deposit.currency === "KHR";

  user.deposits[depIndex].status = "closed";

  if (isKHR) {
    user.balanceKHR = (user.balanceKHR || 0) + withdrawAmount;
    centralBank.balanceKHR -= withdrawAmount;
  } else {
    user.balance += withdrawAmount;
    centralBank.balance -= withdrawAmount;
  }

  const dateStr = getFormattedDate();
  const refId = "WD-" + Date.now();
  const hash = generateHash();
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

  writeData(users);
  res.json({
    success: true,
    newBalance: isKHR ? user.balanceKHR : user.balance,
  });
});

// ==========================================
// 🎁 ១១. រង្វាន់ និងការបង្វិលសង (REWARDS & CASHBACK)
// ==========================================
app.post("/api/reward/cashback", (req, res) => {
  const { username, amount, refId } = req.body;
  let users = readData();
  const user = users.find((u) => u.username === username);

  if (user) {
    const reward = parseFloat(amount);
    if (reward > 0) {
      user.balance += reward;
      user.transactions.unshift({
        refId: "RWD-" + Date.now().toString().slice(-6),
        hash: generateHash(),
        date: getFormattedDate(),
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
      writeData(users);
    }
    res.json({ success: true, balance: user.balance });
  } else res.json({ success: false });
});

// ==========================================
// 🎧 ១២. សេវាកម្មអតិថិជន (SUPPORT TICKETS)
// ==========================================
app.post("/api/ticket/create", (req, res) => {
  const { username, subject, description, priority } = req.body;
  let users = readData();
  const user = users.find((u) => u.username === username);

  if (user) {
    if (!user.tickets) user.tickets = [];

    // --- ផ្នែកដែលត្រូវកែសម្រួលចាប់ពីទីនេះ ---

    // ១. រាប់ចំនួន Ticket សរុបដែលមានក្នុងប្រព័ន្ធទាំងអស់ ដើម្បីរកលេខរៀងបន្ត
    let allTicketsCount = 0;
    users.forEach((u) => {
      if (u.tickets) allTicketsCount += u.tickets.length;
    });

    // ២. បង្កើត ID ថ្មី (បូក ១ បន្ថែម) រួចប្រើ padStart ដើម្បីថែមលេខ ០ ឱ្យគ្រប់ ៣ ខ្ទង់
    const nextNumber = allTicketsCount + 1;
    const formattedId = "TK-" + nextNumber.toString().padStart(3, "0");

    // --- ចប់ផ្នែកកែសម្រួល ---

    user.tickets.push({
      ticketId: formattedId, // លទ្ធផលនឹងចេញ TK-001, TK-002...
      subject,
      description,
      priority: priority || "Normal",
      status: "Open",
      date: getFormattedDate(),
    });

    writeData(users);
    res.json({
      success: true,
      message: "Ticket Created!",
      ticketId: formattedId,
    });
  } else {
    res.json({ success: false });
  }
});

// ==========================================
// 👑 ១៣. ប្រព័ន្ធគ្រប់គ្រង ADMIN (ADMIN DASHBOARD)
// ==========================================
app.get("/api/admin/stats", (req, res) => {
  const users = readData();
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
});

app.get("/api/admin/dashboard-extra", (req, res) => {
  try {
    const users = readData();
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

app.post("/api/admin/toggle-freeze", (req, res) => {
  const { id, isFrozen } = req.body;
  let users = readData();
  const u = users.find((user) => user.id === id);
  if (u) {
    u.isFrozen = isFrozen;
    if (!isFrozen) u.pinAttempts = 0;
    writeData(users);
    res.json({ success: true });
  } else res.json({ success: false });
});

app.get("/api/admin/transaction/:id", (req, res) => {
  const searchTerm = req.params.id.trim();
  const users = readData();
  let foundTrx = null,
    owner = null;
  for (const u of users) {
    if (u.transactions) {
      const trx = u.transactions.find(
        (t) => t.refId === searchTerm || t.hash === searchTerm,
      );
      if (trx) {
        foundTrx = trx;
        owner = u;
        break;
      }
    }
  }
  if (foundTrx)
    res.json({
      success: true,
      transaction: foundTrx,
      user: { username: owner.username, accountNumber: owner.accountNumber },
    });
  else res.json({ success: false });
});

// 🔥 ធានាថា Edit ដើរ ១០០% ព្រមទាំងការពារការកែលេខគណនីជាន់គ្នាដាច់ខាត
app.post("/api/admin/edit-user", (req, res) => {
  const {
    id,
    username,
    pin,
    profileImage,
    accountNumber,
    accountNumberKHR,
    password,
  } = req.body;
  let users = readData();
  const u = users.find((user) => user.id === id || user.username === id);

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
      const exists = users.find(
        (x) =>
          x.id !== u.id &&
          (x.accountNumber === accountNumber ||
            x.accountNumberKHR === accountNumber),
      );
      if (exists)
        return res.json({
          success: false,
          message: `បរាជ័យ! លេខគណនី USD (${accountNumber}) មានគេប្រើរួចហើយ។`,
        });
      u.accountNumber = accountNumber;
    }

    // 🛡️ ៣. ឆែកការពារការកែលេខគណនី KHR ជាន់នឹងអ្នកផ្សេង
    if (accountNumberKHR && accountNumberKHR !== u.accountNumberKHR) {
      const existsKHR = users.find(
        (x) =>
          x.id !== u.id &&
          (x.accountNumber === accountNumberKHR ||
            x.accountNumberKHR === accountNumberKHR),
      );
      if (existsKHR)
        return res.json({
          success: false,
          message: `បរាជ័យ! លេខគណនី KHR (${accountNumberKHR}) មានគេប្រើរួចហើយ។`,
        });
      u.accountNumberKHR = accountNumberKHR;
    }

    // Update ព័ត៌មានផ្សេងៗ
    if (username) u.username = username;
    if (pin) u.pin = pin;
    if (profileImage !== undefined) u.profileImage = profileImage;
    if (password && password.trim() !== "") u.password = password;

    writeData(users);
    res.json({ success: true });
  } else {
    res.json({ success: false, message: "រកមិនឃើញគណនីដើម្បីកែប្រែទេ។" });
  }
});

app.post("/api/admin/delete-user", (req, res) => {
  const { id } = req.body;
  let users = readData();
  const initialLength = users.length;
  const newUsers = users.filter((u) => u.id !== id);
  if (newUsers.length < initialLength) {
    writeData(newUsers);
    res.json({ success: true });
  } else res.json({ success: false, message: "User not found" });
});

// 🔥 Adjust Balance (Add/Deduct) ជាមួយ Central Bank (ដើរ ១០០%)
app.post("/api/admin/adjust-balance", (req, res) => {
  const { username, amount, type, currency } = req.body;
  let users = readData();

  const user = users.find((u) => u.username === username);
  const centralBank = users.find((u) => u.accountNumber === "888888888");

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
      return res.json({ success: false, message: "Insufficient KHR balance!" });
    if (!isKHR && user.balance < adjustAmount)
      return res.json({ success: false, message: "Insufficient USD balance!" });
  }

  // Double-Entry Accounting
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

  const date = getFormattedDate();
  const refId =
    (type === "add" ? "DEP-" : "DED-") + Math.floor(Math.random() * 1000000);
  const trxHash = "HSH" + Math.random().toString(36).substring(7).toUpperCase();

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

  writeData(users);
  res.json({ success: true, message: `Operation Success!` });
});

app.post("/api/admin/approve-transaction", (req, res) => {
  const { refId } = req.body;
  let users = readData();
  let found = false;
  users.forEach((u) => {
    const trx = u.transactions?.find((t) => t.refId === refId);
    if (trx && trx.status === "Pending") {
      trx.status = "Success";
      trx.isHold = false;
      if (!u.notifications) u.notifications = [];
      u.notifications.unshift({
        id: Date.now(),
        title: "Payment Approved",
        message: `ការទូទាត់ $${Math.abs(trx.amount)} ត្រូវបានអនុម័តជោគជ័យ។`,
        date: getFormattedDate(),
        isRead: false,
      });
      found = true;
    }
  });
  if (found) {
    writeData(users);
    res.json({ success: true, message: "Transaction Approved!" });
  } else res.json({ success: false, message: "Transaction not found/pending" });
});

app.post("/api/admin/refund-transaction", (req, res) => {
  const { refId } = req.body;
  let users = readData();
  let found = false;
  users.forEach((u) => {
    const trx = u.transactions?.find((t) => t.refId === refId);
    if (trx && trx.status === "Pending") {
      u.balance += Math.abs(trx.amount);
      trx.status = "Refunded";
      trx.isHold = false;
      if (!u.notifications) u.notifications = [];
      u.notifications.unshift({
        id: Date.now(),
        title: "Refund Processed",
        message: `ការទូទាត់ $${Math.abs(trx.amount)} ត្រូវបានសងត្រឡប់មកវិញ។`,
        date: getFormattedDate(),
        isRead: false,
      });
      found = true;
    }
  });
  if (found) {
    writeData(users);
    res.json({ success: true, message: "Refund Successful!" });
  } else res.json({ success: false, message: "Transaction not found" });
});

// ==========================================
// 📢 ១៤. ការជូនដំណឹង (NOTIFICATIONS & BROADCASTS)
// ==========================================
app.get("/api/user/notifications", (req, res) => {
  if (!req.session || !req.session.username)
    return res.status(401).json({ error: "មិនទាន់បាន Login" });
  const user = readData().find((u) => u.username === req.session.username);
  if (!user) return res.status(404).json({ error: "រកមិនឃើញគណនីនេះ" });
  const unread = user.notifications
    ? user.notifications.filter((n) => !n.isRead)
    : [];
  res.json({ hasNew: unread.length > 0, count: unread.length });
});

app.post("/api/user/read-notifications", (req, res) => {
  const { username } = req.body;
  let users = readData();
  const user = users.find((u) => u.username === username);
  if (user && user.notifications) {
    user.notifications.forEach((n) => (n.isRead = true));
    writeData(users);
    res.json({ success: true });
  } else res.json({ success: false });
});

app.post("/api/admin/broadcast", (req, res) => {
  const { title, message, sender } = req.body;
  const sharedNotifId = "BC-" + Date.now();
  try {
    let users = readData();
    users = users.map((user) => {
      if (user.role !== "admin") {
        if (!user.notifications) user.notifications = [];
        user.notifications.unshift({
          id: sharedNotifId,
          title,
          message,
          sender: sender || "admin",
          date: new Date().toLocaleString(),
          isRead: false,
        });
      }
      return user;
    });
    writeData(users);
    res.json({
      success: true,
      count: users.filter((u) => u.role !== "admin").length,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.post("/api/admin/delete-broadcast", (req, res) => {
  const { notifId } = req.body;
  let users = readData();
  users = users.map((user) => {
    if (user.notifications) {
      user.notifications = user.notifications.filter((n) => n.id !== notifId);
    }
    return user;
  });
  writeData(users);
  res.json({ success: true });
});

// ==========================================
// ⏱ ១៥. ស្វ័យប្រវត្តិកម្ម (AUTO JOBS)
// ==========================================
const autoReleaseHold = () => {
  let users = readData();
  let hasChange = false;
  const now = Date.now();
  users.forEach((u) => {
    if (u.transactions) {
      u.transactions.forEach((t) => {
        if (
          t.isHold &&
          t.status === "Pending" &&
          t.releaseDate &&
          t.releaseDate <= now
        ) {
          t.status = "Success";
          t.isHold = false;
          const merchant = users.find((m) => m.accountNumber === "100000004");
          if (merchant) {
            merchant.balance += Math.abs(t.amount);
            if (!merchant.transactions) merchant.transactions = [];
            merchant.transactions.unshift({
              refId:
                "TRX-" +
                Date.now().toString().slice(-10) +
                "-" +
                Math.floor(Math.random() * 1000),
              hash: generateHash(),
              date: getFormattedDate(),
              type: "Sale Income",
              amount: Math.abs(t.amount),
              senderName: t.senderName || "Unknown",
              status: "Success",
            });
          }
          hasChange = true;
          console.log(
            `✅ [AUTO-RELEASED] Order: ${t.refId} for user: ${u.username}`,
          );
        }
      });
    }
  });
  if (hasChange) writeData(users);
};
setInterval(autoReleaseHold, 10000);

// ==========================================
// 🛡 ១៦. ADMIN ACTIONS (KYC & TICKETS)
// ==========================================
app.post("/api/admin/kyc-action", (req, res) => {
  const { username, action } = req.body;
  let users = readData();
  let u = users.find((u) => u.username === username);
  if (u) {
    u.kycStatus = action;
    if (!u.notifications) u.notifications = [];
    u.notifications.unshift({
      id: "NOTIF-" + Date.now(),
      title: "KYC Verification",
      message: `ឯកសារបញ្ជាក់អត្តសញ្ញាណរបស់អ្នកត្រូវបាន ${action === "approved" ? "អនុម័តជោគជ័យ ✅" : "បដិសេធ ❌"}។`,
      date: getFormattedDate(),
      isRead: false,
      sender: "system",
    });
    writeData(users);
    res.json({ success: true });
  } else res.json({ success: false });
});

app.post("/api/admin/ticket-reply", (req, res) => {
  const { username, ticketId, replyMessage } = req.body;
  let users = readData();
  let u = users.find((u) => u.username === username);
  if (u && u.tickets) {
    let t = u.tickets.find((t) => t.ticketId === ticketId);
    if (t) {
      t.status = "Answered";
      t.adminReply = replyMessage;
      if (!u.notifications) u.notifications = [];
      u.notifications.unshift({
        id: "NOTIF-" + Date.now(),
        title: "Support Reply: " + t.subject,
        message: `Admin: ${replyMessage}`,
        date: getFormattedDate(),
        isRead: false,
        sender: "system",
      });
      writeData(users);
      res.json({ success: true });
    } else res.json({ success: false });
  } else res.json({ success: false });
});

// ==========================================
// 💬 ប្រព័ន្ធ CHAT ថ្មី (UNIFIED CHAT - BOT & HUMAN)
// ==========================================
const CHAT_FILE = path.join(__dirname, "data", "chats.json");

const readChats = () => {
  if (!fs.existsSync(CHAT_FILE)) {
    fs.writeFileSync(CHAT_FILE, "[]");
    return [];
  }
  try {
    return JSON.parse(fs.readFileSync(CHAT_FILE));
  } catch (e) {
    return [];
  }
};

const writeChats = (data) => {
  fs.writeFileSync(CHAT_FILE, JSON.stringify(data, null, 2));
};

// ១. API សម្រាប់ផ្ញើសារ (កែសម្រួលមិនឱ្យមានសារ Bot ជាន់គ្នា)
app.post("/api/chat/send", (req, res) => {
  const { senderAcc, receiverAcc, message, adminName } = req.body;
  let chats = readChats();
  let users = readData();

  // ស្វែងរកគណនី (អនុញ្ញាតអោយ ADMIN ក្លាយជាគណនីកណ្តាល)
  const getAcc = (acc) => {
    if (acc === "ADMIN") return { accountNumber: "ADMIN" };
    return users.find(
      (u) => u.accountNumber === acc || u.accountNumberKHR === acc,
    );
  };

  const sender = getAcc(senderAcc);
  const receiver = getAcc(receiverAcc);

  if (!sender || !receiver)
    return res.json({ success: false, message: "រកមិនឃើញគណនីនេះទេ!" });

  // 🔥 គ្រប់គ្រងចរន្តនៃសារ ដោយគ្រាន់តែ "លួចស្តាប់" និង "បើកផ្លូវ" តែមិនតបសារជាន់គ្នាទេ
  if (senderAcc === "ADMIN") {
    // បើ Admin ចុចបញ្ចប់ការសន្ទនា ទម្លាក់ User ចេញពីបញ្ជី Admin វិញ
    if (message.includes("ការសន្ទនាត្រូវបានបញ្ចប់ដោយ Admin")) {
      const realUser = users.find(
        (u) => u.accountNumber === receiver.accountNumber,
      );
      if (realUser) {
        realUser.needsSupport = false;
        writeData(users);
      }
    }
  } else {
    // បើ User ជាអ្នកផ្ញើ
    const realUser = users.find(
      (u) => u.accountNumber === sender.accountNumber,
    );
    if (realUser) {
      // បើមិនទាន់ភ្ជាប់ទៅ Admin ទេ (កំពុងជួប Bot) យើងចាំចាប់ពាក្យសម្ងាត់
      if (!realUser.needsSupport) {
        const text = message.toLowerCase();
        // បើភ្ញៀវសុំជួបភ្នាក់ងារ យើងគ្រាន់តែបើកផ្លូវអោយ Admin ឃើញឈ្មោះ តែមិនបាច់តបសារទេ
        if (text.includes("human") || text.includes("ភ្នាក់ងារ")) {
          realUser.needsSupport = true; // លោតឈ្មោះចូល Admin Dashboard
          writeData(users);
        }
      }
    }
  }

  // ផ្ទុកសារចូល Database តែម្តងគត់ (មិនមាន botReply ខាង Server ទៀតទេ)
  const newMessage = {
    id: "MSG-" + Date.now(),
    senderAcc: sender.accountNumber || "ADMIN",
    receiverAcc: receiver.accountNumber || "ADMIN",
    message: message,
    adminName: adminName || null,
    time: getFormattedDate(),
    timestamp: Date.now(),
    isRead: false,
  };

  chats.push(newMessage);
  writeChats(chats);
  res.json({ success: true, message: newMessage });
});

// ២. API ទាញយកប្រវត្តិសារ
app.post("/api/chat/history", (req, res) => {
  const { user1Acc, user2Acc } = req.body;
  let chats = readChats();

  const history = chats.filter(
    (c) =>
      (c.senderAcc === user1Acc && c.receiverAcc === user2Acc) ||
      (c.senderAcc === user2Acc && c.receiverAcc === user1Acc),
  );

  let updated = false;
  history.forEach((c) => {
    if (c.receiverAcc === user1Acc && !c.isRead) {
      c.isRead = true;
      updated = true;
    }
  });
  if (updated) writeChats(chats);

  res.json({ success: true, history: history });
});

// ៣. API សម្រាប់ទាញយកបញ្ជីឈ្មោះអ្នកឆាត (Contact List)
app.post("/api/chat/contacts", (req, res) => {
  const { myAcc } = req.body;
  let chats = readChats();
  let users = readData();
  let contactMap = {};

  chats.forEach((c) => {
    if (c.senderAcc === myAcc || c.receiverAcc === myAcc) {
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
          // បើ needsSupport ស្មើ false គឺមិនអោយបង្ហាញក្នុងផ្ទាំង Admin ទេ
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
          contactMap[partnerAcc] = {
            accountNumber: partnerAcc,
            name: pName,
            profileImage: pImg,
            lastMessage: c.message,
            time: c.time,
            timestamp: c.timestamp,
            unreadCount: chats.filter(
              (m) =>
                m.receiverAcc === myAcc &&
                m.senderAcc === partnerAcc &&
                !m.isRead,
            ).length,
          };
        }
      }
    }
  });

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
});

// ៤. API ឆែកមើល User
app.post("/api/chat/check-user", (req, res) => {
  const { accountNumber } = req.body;
  let users = readData();
  const targetUser = users.find(
    (u) =>
      u.accountNumber === accountNumber || u.accountNumberKHR === accountNumber,
  );

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
});

// ==========================================
// 🔑 ប្រព័ន្ធ FORGOT PASSWORD & OTP SYSTEM
// ==========================================
let tempForgotOtps = {}; // ផ្ទុកលេខកូដ OTP បណ្តោះអាសន្ន

// ១. API សម្រាប់ឆែកគណនី និងបង្កើត OTP
app.post("/api/forgot-password/verify-user", (req, res) => {
  const { identifier } = req.body;
  let users = readData();

  // ស្វែងរកអ្នកប្រើប្រាស់តាម Username ឬ លេខទូរស័ព្ទ
  const user = users.find(
    (u) => u.username === identifier || u.phone === identifier,
  );

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
});

// ២. API សម្រាប់ផ្ទៀងផ្ទាត់ OTP និងប្តូរ Password ថ្មី
app.post("/api/forgot-password/reset-password", (req, res) => {
  const { username, otp, newPassword } = req.body;

  // ឆែកមើលថាតើ OTP ត្រូវជាមួយអ្វីដែលរក្សាទុកលើ Server ដែរឬទេ
  if (!tempForgotOtps[username] || tempForgotOtps[username] !== otp) {
    return res.json({
      success: false,
      message: "លេខកូដ OTP មិនត្រឹមត្រូវ ឬផុតកំណត់ហើយ! ❌",
    });
  }

  let users = readData();
  let user = users.find((u) => u.username === username);

  if (user) {
    user.password = newPassword; // ធ្វើបច្ចុប្បន្នភាព Password ថ្មី
    writeData(users);
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
});

// URL របស់ PayHub KH
const PAYHUB_URL = "https://payhub-kh.onrender.com";

// 👉 សូមប្តូរមកប្រើកូដបើកសិទ្ធិទូលាយនេះវិញ៖
app.use(
  cors({
    origin: "*", // អនុញ្ញាតឱ្យរាល់ Website ទាំងអស់ (រួមទាំង PAYHUB) អាចទាញទិន្នន័យបាន
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

// API: U-PAY ឆែកវិក្កយបត្រដោយបាញ់ឆ្លងទៅ PayHub
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

// បន្ថែម Function នេះនៅផ្នែកខាងលើនៃ server.js
const generateCompactHash = () =>
  Math.random().toString(36).substring(2, 10).toUpperCase();

// កែសម្រួល API /api/bank/pay-bill ឱ្យដូចនេះ៖
app.post("/api/bank/pay-bill", async (req, res) => {
  const { bill_id, company, amount, username } = req.body;
  try {
    let users = readData();
    let payingUser = users.find((u) => u.username === username);

    if (!payingUser)
      return res
        .status(404)
        .json({ success: false, message: "រកមិនឃើញគណនីរបស់អ្នក!" });
    if (payingUser.balance < amount)
      return res
        .status(400)
        .json({ success: false, message: "សមតុល្យមិនគ្រប់គ្រាន់!" });

    // ប្តូរមកជា Link ផ្លូវការរបស់ PAYHUB លើ Cloud Internet
    fetch("https://payhub-kh.onrender.com/api/gateway/pay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bill_id: currentBillId }),
    });
    const data = await response.json();

    if (response.ok && data.success) {
      const compRes = await fetch(`${PAYHUB_URL}/api/admin/users`);
      const payhubUsers = await compRes.json();
      const compData = payhubUsers.find(
        (u) => u.name === company && u.role === "company",
      );

      // កាត់លុយ និងកត់ត្រាប្រវត្តិ User
      payingUser.balance -= amount;
      if (!payingUser.transactions) payingUser.transactions = [];
      const newHash = generateCompactHash(); // បង្កើត Hash តែមួយ
      payingUser.transactions.unshift({
        refId: `BP-${Date.now()}`,
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

      // បញ្ចូលលុយទៅក្រុមហ៊ុន
      if (compData && compData.upay_account) {
        const fee_percent = parseFloat(compData.fee_percent) || 0;
        const net_amount = amount - (amount * fee_percent) / 100;
        let companyAccount = users.find(
          (u) =>
            u.accountNumber === compData.upay_account ||
            u.accountNumberKHR === compData.upay_account,
        );

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
        }
      }

      writeData(users);
      res.json({
        success: true,
        newBalance: payingUser.balance,
        transaction_id: `BP-${Date.now()}`,
        hash: newHash,
      });
    } else {
      res.status(400).json({ success: false, message: data.message });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: "ការទូទាត់បរាជ័យ" });
  }
});

// ==========================================
// ថ្មី៖ API សម្រាប់ផ្ទៀងផ្ទាត់លេខគណនី U-PAY (ទាញពី Database ពិត)
// ==========================================
app.get("/api/bank/verify-account/:account_number", (req, res) => {
  const { account_number } = req.params;

  // ១. ទាញទិន្នន័យពី users.json ផ្ទាល់
  let users = readData();

  // ២. ស្វែងរកគណនីដែលត្រូវនឹងលេខដែលបានបញ្ចូល (ឆែកទាំងកុង USD និងកុង KHR)
  const targetUser = users.find(
    (u) =>
      u.accountNumber === account_number ||
      u.accountNumberKHR === account_number,
  );

  if (targetUser) {
    // ៣. បើរាវរកឃើញ បោះឈ្មោះពិតរបស់គាត់ទៅឱ្យ Frontend
    res.json({
      success: true,
      account_name: targetUser.fullName || targetUser.username,
    });
  } else {
    // ៤. បើរាវរកមិនឃើញ
    res.status(404).json({
      success: false,
      message: "រកមិនឃើញគណនីនេះក្នុងប្រព័ន្ធ U-PAY ទេ! ❌",
    });
  }
});

// ==========================================
// 🚀 ចាប់ផ្តើម SERVER (START SERVER)
// ==========================================

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
