const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const TelegramBot = require("node-telegram-bot-api");

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// 🌐 CONFIGURATIONS & MIDDLEWARES
// ==========================================

const PAYHUB_URL = "https://payhub-kh.onrender.com";

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(express.static(path.join(__dirname, "public")));

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
  "mongodb+srv://hadighany25_db_user:WeBa4KcTKxl71UzY@cluster0.kkvnknp.mongodb.net/?appName=Cluster0";

mongoose
  .connect(MONGO_URI)
  .then(async () => {
    console.log("🟢 MongoDB Connected Successfully");

    await initSystemAccounts();
  })
  .catch((err) => {
    console.error("🔴 MongoDB Connection Error:", err);
  });

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
    virtualCards: { type: Array, default: [] },
    savings: { type: Array, default: [] },
    deposits: { type: Array, default: [] },
    kycStatus: { type: String, default: "pending" },
    needsSupport: { type: Boolean, default: false },
    telegramChatId: { type: String, default: null },
    linkCode: { type: String, default: null },
    lastActive: { type: String, default: "" },
    joinDate: { type: String, default: "" },
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

let tempForgotOtps = {};

// ==========================================
// ⚙️ SYSTEM SETTINGS (GLOBAL FREEZE)
// ==========================================
const SYSTEM_FILE = path.join(__dirname, "data", "system.json");
const SETTINGS_FILE = path.join(__dirname, "data", "settings.json");

const readSystemStatus = () => {
  if (!fs.existsSync(SYSTEM_FILE)) {
    if (!fs.existsSync(path.dirname(SYSTEM_FILE)))
      fs.mkdirSync(path.dirname(SYSTEM_FILE), { recursive: true });
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

app.get("/api/system-status", (req, res) => {
  res.json(readSystemStatus());
});

app.post("/api/admin/toggle-system", (req, res) => {
  const current = readSystemStatus();
  current.isSystemFrozen = !current.isSystemFrozen;
  writeSystemStatus(current);
  res.json({ success: true, isSystemFrozen: current.isSystemFrozen });
});

// ==========================================
// 🛠 ២. មុខងារជំនួយ (HELPER FUNCTIONS)
// ==========================================
const readSettings = () => {
  if (!fs.existsSync(SETTINGS_FILE)) {
    if (!fs.existsSync(path.dirname(SETTINGS_FILE)))
      fs.mkdirSync(path.dirname(SETTINGS_FILE), { recursive: true });
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
const generateCompactHash = () =>
  Math.random().toString(36).substring(2, 10).toUpperCase();

// ==========================================
// 🏢 ៣. បង្កើតគណនីក្រុមហ៊ុន និងធនាគារកណ្តាល (AUTO INIT SYSTEM ACCOUNTS)
// ==========================================
const initSystemAccounts = async () => {
  try {
    console.log("🚀 Checking System Accounts...");

    const billers = [
      { username: "EDC", accountNumber: "100000001" },
      { username: "PPWSA", accountNumber: "100000002" },
      { username: "Internet", accountNumber: "100000003" },
      { username: "Fashion Shop", accountNumber: "100000004" },
    ];

    // Create Billers
    for (const b of billers) {
      const exists = await User.findOne({ username: b.username });

      if (!exists) {
        await User.create({
          username: b.username,
          password: "123",
          accountNumber: b.accountNumber,
          accountNumberKHR: "9" + b.accountNumber,
          balance: 0,
          balanceKHR: 0,
          role: "biller",
          pin: "0000",
          isFrozen: false,
        });

        console.log(`✅ Created Biller: ${b.username}`);
      }
    }

    // Create Central Bank
    const centralBank = await User.findOne({
      $or: [{ accountNumber: "888888888" }, { username: "centralbank" }],
    });

    if (!centralBank) {
      const bank = new User({
        username: "centralbank",
        fullName: "U-Pay Central Bank",
        password: "123456",
        accountNumber: "888888888",
        accountNumberKHR: "988888888",
        balance: 1000000000,
        balanceKHR: 4000000000000,
        role: "admin",
        pin: "1234",
        profileImage: "images/logo.png",
        isFrozen: false,
        transactions: [],
        notifications: [],
      });

      await bank.save();

      console.log("🏦 U-Pay Central Bank Created!");
    } else {
      console.log("🏦 U-Pay Central Bank Already Exists");
    }
  } catch (err) {
    console.error("❌ Init System Accounts Error:", err);
  }
};

// ==========================================
// 🤖 ៤. មុខងារ TELEGRAM BOT
// ==========================================
const token = "8786350689:AAEncWXnaMjzk1QpMyZmo_Censsu4DVHSG0";
const bot = new TelegramBot(token, { polling: true });

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text ? msg.text.trim() : "";

  if (text.length === 4 && !isNaN(text)) {
    try {
      let user = await User.findOne({ linkCode: text });
      if (user) {
        user.telegramChatId = chatId;
        user.linkCode = null;
        await user.save();
        bot.sendMessage(
          chatId,
          `🎉 អបអរសាទរ! គណនី U-Pay (<b>${user.username}</b>) ត្រូវបានភ្ជាប់ជោគជ័យ!`,
          { parse_mode: "HTML" },
        );
        console.log(`✅ Linked: Account: ${user.username}, Group: ${chatId}`);
      }
    } catch (err) {
      console.error("Telegram Binding Error:", err);
    }
  }
});

app.post("/api/generate-telegram-code", async (req, res) => {
  const { username } = req.body;
  try {
    const user = await User.findOne({ username });
    if (user) {
      const randomCode = Math.floor(1000 + Math.random() * 9000).toString();
      user.linkCode = randomCode;
      await user.save();
      res.json({ success: true, code: randomCode });
    } else {
      res.json({ success: false, message: "User not found" });
    }
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

app.post("/api/unlink-telegram", async (req, res) => {
  const { username } = req.body;
  try {
    const user = await User.findOne({ username });
    if (user) {
      const oldChatId = user.telegramChatId;
      user.telegramChatId = null;
      await user.save();
      if (oldChatId) {
        bot
          .sendMessage(
            oldChatId,
            `⚠️ គណនី U-Pay (<b>${username}</b>) ត្រូវបានផ្តាច់!`,
            { parse_mode: "HTML" },
          )
          .catch((e) => console.log(e));
      }
      res.json({ success: true });
    } else {
      res.json({ success: false, message: "User not found" });
    }
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// ==========================================
// 🔐 ៥. ផ្នែកចូលគណនី (AUTH & USER LOGIN)
// ==========================================

const generatePatternAccounts = (users) => {
  let isUnique = false;
  let newAccUSD = "";
  let newAccKHR = "";

  while (!isUnique) {
    const n = Math.floor(Math.random() * 9) + 1;
    const prefix = `${n}00${n}00`;
    const suffix = Math.floor(Math.random() * 890) + 100;
    const baseAcc = parseInt(prefix + suffix.toString());

    newAccUSD = baseAcc.toString();
    newAccKHR = (baseAcc + 1).toString();

    const exists = users.some(
      (u) =>
        u.accountNumber === newAccUSD ||
        u.accountNumberKHR === newAccUSD ||
        u.accountNumber === newAccKHR ||
        u.accountNumberKHR === newAccKHR,
    );

    if (!exists) {
      isUnique = true;
    }
  }
  return { usd: newAccUSD, khr: newAccKHR };
};

app.post("/api/register", async (req, res) => {
  const { username, password, fullName, phone, pin } = req.body;

  try {
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.json({ success: false, message: "Username already taken!" });
    }

    const users = await User.find({});
    const newAccs = generatePatternAccounts(users);

    if (newAccs.usd === newAccs.khr) {
      return res.json({
        success: false,
        message: "ប្រព័ន្ធមានបញ្ហា! លេខគណនី USD និង KHR មិនអាចដូចគ្នាទេ។",
      });
    }

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
    });

    await newUser.save();
    res.json({ success: true, user: newUser });
  } catch (err) {
    console.error("Register Error:", err);
    res
      .status(500)
      .json({ success: false, message: "Server មានបញ្ហាក្នុងការចុះឈ្មោះ!" });
  }
});

app.post("/api/login", async (req, res) => {
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

  try {
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

      user.isOnline = true;
      user.lastActive = new Date().toISOString();
      await user.save();

      res.json({ success: true, user });
    } else {
      res.json({ success: false, message: "Invalid Credentials" });
    }
  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ success: false, message: "Server មានបញ្ហាឡកអ៊ីន" });
  }
});

app.post("/api/logout", async (req, res) => {
  const { username } = req.body;
  try {
    const user = await User.findOne({ username });
    if (user) {
      user.isOnline = false;
      await user.save();
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: "Logout Error" });
  }
});

app.post("/api/heartbeat", async (req, res) => {
  const { username } = req.body;
  try {
    const user = await User.findOne({ username });
    if (user) {
      user.lastActive = new Date().toISOString();
      await user.save();
      res.json({ success: true });
    } else {
      res.json({ success: false });
    }
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

app.get("/api/users", async (req, res) => {
  try {
    const users = await User.find({});
    res.json(users);
  } catch (err) {
    console.error("Fetch Users Error:", err);
    res.status(500).json({ success: false, message: "មិនអាចទាញទិន្នន័យបានទេ" });
  }
});

// ==========================================
// 👤 ៦. ការគ្រប់គ្រងទម្រង់គណនី (USER SETTINGS)
// ==========================================

app.post("/api/change-password", async (req, res) => {
  const { username, oldPassword, newPassword } = req.body;
  try {
    const user = await User.findOne({ username });
    if (user && user.password === oldPassword) {
      user.password = newPassword;
      await user.save();
      res.json({ success: true });
    } else {
      res.json({ success: false, message: "Old password incorrect" });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: "Server មានបញ្ហា" });
  }
});

app.post("/api/change-pin", async (req, res) => {
  const { username, password, newPin } = req.body;
  try {
    const user = await User.findOne({ username });
    if (user && user.password === password) {
      user.pin = newPin;
      user.pinAttempts = 0;
      await user.save();
      res.json({ success: true });
    } else {
      res.json({ success: false, message: "Password incorrect" });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: "Server មានបញ្ហា" });
  }
});

app.post("/api/change-limit", async (req, res) => {
  const { username, password, newLimit } = req.body;
  try {
    const user = await User.findOne({ username });
    if (user && user.password === password) {
      user.trxLimit = parseFloat(newLimit);
      await user.save();
      res.json({ success: true });
    } else {
      res.json({ success: false, message: "Password incorrect" });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: "Server មានបញ្ហា" });
  }
});

app.post(
  "/api/user/upload-image",
  upload.single("profileImg"),
  async (req, res) => {
    try {
      const userId = req.body.id;

      if (!req.file) {
        return res.json({
          success: false,
          message: "No image uploaded",
        });
      }

      const imageUrl = "/uploads/" + req.file.filename;

      const user = await User.findById(userId);

      if (!user) {
        return res.json({
          success: false,
          message: "User not found",
        });
      }

      user.profileImage = imageUrl;

      await user.save();

      res.json({
        success: true,
        imageUrl,
      });
    } catch (err) {
      console.error("PROFILE UPLOAD ERROR:", err);

      res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  },
);

app.post("/api/user/submit-kyc", upload.single("kycDoc"), async (req, res) => {
  try {
    const username = req.body.username;

    if (!req.file) {
      return res.json({
        success: false,
        message: "No document uploaded",
      });
    }

    const docUrl = "/uploads/" + req.file.filename;

    const user = await User.findOne({ username });

    if (!user) {
      return res.json({
        success: false,
        message: "User not found",
      });
    }

    user.kycStatus = "pending";
    user.kycDocument = docUrl;
    user.kycSubmittedAt = getFormattedDate();

    await user.save();

    res.json({
      success: true,
      message: "ឯកសារបញ្ជាក់អត្តសញ្ញាណត្រូវបានបញ្ជូន!",
    });
  } catch (err) {
    console.error("KYC ERROR:", err);

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

// ==========================================
// 💱 ៧. អត្រាប្តូរប្រាក់ & ផ្ទេរប្រាក់ (EXCHANGE & TRANSFERS)
// ==========================================

let globalFXRates = { usdToKhrBuy: 4050, usdToKhrSell: 4100 };
try {
  globalFXRates = readSettings().fx;
} catch (e) {}

app.get("/api/fx/rates", (req, res) => {
  res.json({ success: true, rates: globalFXRates });
});

app.post("/api/admin/fx/update", (req, res) => {
  const { buy, sell } = req.body;
  globalFXRates = {
    usdToKhrBuy: parseFloat(buy),
    usdToKhrSell: parseFloat(sell),
  };
  writeSettings({ fx: globalFXRates });
  res.json({ success: true, message: "Exchange rates updated successfully!" });
});

app.post("/api/check-account", async (req, res) => {
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

app.post("/api/transfer", async (req, res) => {
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

  try {
    const fxRates = globalFXRates;
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

    if (sender.pin !== pin) {
      sender.pinAttempts = (sender.pinAttempts || 0) + 1;
      if (sender.pinAttempts >= 3) {
        sender.isFrozen = true;
        sender.pinAttempts = 0;
        await sender.save();
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

    await sender.save();
    await receiver.save();

    if (receiver.telegramChatId) {
      let displayAmount = `${signReceiver}${receiverAmount.toLocaleString("en-US", { minimumFractionDigits: isReceiverKHR ? 0 : 2 })}`;
      const alertMsg = `🔔 <b>ប្រាក់ចូល (Money Received)</b> 🔔\n━━━━━━━━━━━━━━━━\n💰 <b>ចំនួនទឹកប្រាក់៖</b> +${displayAmount}\n📥 <b>ចូលគណនី៖</b> ${receiver.fullName || receiver.username}\n📤 <b>ពីគណនី៖</b> ${sender.fullName || sender.username}\n🧾 <b>លេខប្រតិបត្តិការ៖</b> ${refId}\n⏰ <b>កាលបរិច្ឆេទ៖</b> ${date}\n📝 <b>ចំណាំ៖</b> ${remark || "គ្មាន"}\n━━━━━━━━━━━━━━━━━\n✅ <i>ប្រតិបត្តិការជោគជ័យ (U-Pay)</i>`;
      bot
        .sendMessage(receiver.telegramChatId, alertMsg, { parse_mode: "HTML" })
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

app.post("/api/payment", async (req, res) => {
  const { username, billerName, billId, amount, pin } = req.body;
  try {
    const user = await User.findOne({ username });
    const biller = await User.findOne({ username: billerName });

    if (!user || !biller)
      return res.json({ success: false, message: "Error User/Biller" });
    if (user.isFrozen)
      return res.json({ success: false, message: "Account Frozen" });

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

    await user.save();
    await biller.save();

    if (biller.telegramChatId) {
      const alertMsg = `🔔 <b>វិក្កយបត្របានទូទាត់</b> 🔔\n━━━━━━━━━━━━━━━━━━━━\n💰 <b>ទឹកប្រាក់៖</b> +$${payAmount.toFixed(2)}\n🏢 <b>ហាង៖</b> ${biller.fullName || biller.username}\n👤 <b>អតិថិជន៖</b> ${user.fullName || user.username}\n🧾 <b>វិក្កយបត្រ៖</b> ${billId}\n🏷️ <b>ប្រតិបត្តិការ៖</b> ${refId}\n━━━━━━━━━━━━━━━━━━━━\n✅ <i>ប្រតិបត្តិការជោគជ័យ</i>`;
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

let pendingPayments = [];

app.post("/api/card/generate", async (req, res) => {
  const system = readSystemStatus();

  if (system.isSystemFrozen) {
    return res.json({
      success: false,
      message: "ប្រព័ន្ធកំពុងធ្វើការថែទាំ 🛠️ មិនអាចបង្កើតកាតថ្មីបានទេនៅពេលនេះ។",
    });
  }

  const { username, cardType, pin } = req.body;

  try {
    const user = await User.findOne({ username });

    if (!user) {
      return res.json({
        success: false,
        message: "User not found",
      });
    }

    if (user.pin !== pin) {
      return res.json({
        success: false,
        message: "លេខ PIN មិនត្រឹមត្រូវទេ!",
      });
    }

    const FEE_AMOUNT = 5.0;

    if (user.balance < FEE_AMOUNT) {
      return res.json({
        success: false,
        message: `សមតុល្យមិនគ្រប់គ្រាន់ទេ! ថ្លៃសេវាបង្កើតកាតគឺ $${FEE_AMOUNT.toFixed(
          2,
        )}`,
      });
    }

    if (!user.virtualCards) user.virtualCards = [];

    if (user.virtualCards.length >= 3) {
      return res.json({
        success: false,
        message: "Limit reached (Max 3 cards)",
      });
    }

    // ==========================================
    // Create Fee Account Automatically (First Time Only)
    // ==========================================
    let feeAccount = await User.findOne({
      accountNumber: "999999999",
    });

    if (!feeAccount) {
      feeAccount = new User({
        username: "system_fee",
        fullName: "U-PAY Fee",
        password: "123456",
        pin: "0000",
        accountNumber: "999999999",
        accountNumberKHR: "999999998",
        balance: 0,
        balanceKHR: 0,
        role: "system",
        isFrozen: false,
        transactions: [],
        notifications: [],
      });

      await feeAccount.save();

      console.log("💰 U-PAY Fee Account Created!");
    }

    // ==========================================
    // Deduct Fee
    // ==========================================
    user.balance -= FEE_AMOUNT;
    feeAccount.balance += FEE_AMOUNT;

    if (!user.transactions) user.transactions = [];
    if (!feeAccount.transactions) feeAccount.transactions = [];

    const dateStr = getFormattedDate();
    const refId = "FEE-" + Date.now();
    const hash = generateHash();

    // User Transaction
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

    // Fee Account Transaction
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

    // ==========================================
    // Generate Card
    // ==========================================
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

    await user.save();
    await feeAccount.save();

    res.json({
      success: true,
      cards: user.virtualCards,
      newBalance: user.balance,
    });
  } catch (err) {
    console.error("Card Generate Error:", err);

    res.status(500).json({
      success: false,
      message: err.message || "Server error",
    });
  }
});

app.post("/api/card/toggle-lock", async (req, res) => {
  const { username, cardId, isLocked } = req.body;
  try {
    const user = await User.findOne({ username });
    if (user && user.virtualCards) {
      const card = user.virtualCards.find((c) => c.id === cardId);
      if (card) {
        card.isLocked = isLocked;
        user.markModified("virtualCards");
        await user.save();
        return res.json({ success: true, cards: user.virtualCards });
      }
    }
    res.json({ success: false, message: "Card not found" });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

app.post("/api/card/toggle-online-pay", async (req, res) => {
  const { username, cardId, isEnabled } = req.body;
  try {
    const user = await User.findOne({ username });
    if (user && user.virtualCards) {
      const card = user.virtualCards.find((c) => c.id === cardId);
      if (card) {
        card.isOnlinePayEnabled = isEnabled;
        user.markModified("virtualCards");
        await user.save();
        return res.json({ success: true, cards: user.virtualCards });
      }
    }
    res.json({ success: false });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

app.post("/api/card/change-pin", async (req, res) => {
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
      await user.save();
      res.json({ success: true, message: "ប្តូរលេខ PIN កាតជោគជ័យ!" });
    } else {
      res.json({ success: false, message: "រកមិនឃើញអ្នកប្រើប្រាស់!" });
    }
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

app.post("/api/card/update-limit", async (req, res) => {
  const { username, cardId, newLimit } = req.body;
  try {
    const user = await User.findOne({ username });
    if (user && user.virtualCards) {
      const card = user.virtualCards.find((c) => c.id === cardId);
      if (card) {
        card.dailyLimit = parseFloat(newLimit);
        user.markModified("virtualCards");
        await user.save();
        return res.json({ success: true, cards: user.virtualCards });
      }
    }
    res.json({ success: false, message: "រកមិនឃើញកាត!" });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

app.post("/api/card/delete", async (req, res) => {
  const { username, cardId } = req.body;
  try {
    const user = await User.findOne({ username });
    if (user && user.virtualCards) {
      const initialCount = user.virtualCards.length;
      user.virtualCards = user.virtualCards.filter((c) => c.id !== cardId);
      if (user.virtualCards.length < initialCount) {
        await user.save();
        return res.json({ success: true, cards: user.virtualCards });
      }
    }
    res.json({ success: false, message: "Error deleting card" });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

app.post("/api/card/request-payment", async (req, res) => {
  const system = readSystemStatus();
  if (system.isSystemFrozen) {
    return res.json({
      success: false,
      message:
        "ប្រព័ន្ធធនាគាកំពុងធ្វើការថែទាំ (Maintenance) 🛠️ មិនអាចធ្វើការទូទាត់បានទេ។",
    });
  }

  const { cardNumber, expiry, cvv, amount, orderId, shopName } = req.body;

  try {
    let owner = await User.findOne({
      "virtualCards.number": cardNumber,
      "virtualCards.expiry": expiry,
      "virtualCards.cvv": cvv,
    });

    if (!owner)
      return res.json({ success: false, message: "ព័ត៌មានកាតមិនត្រឹមត្រូវ!" });

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
      date: getFormattedDate(),
    });

    if (!owner.notifications) owner.notifications = [];
    owner.notifications.unshift({
      id: "NOTIF-" + paymentId,
      title: "សំណើទូទាត់ប្រាក់ 🛒",
      message: `ហាង <b>${shopName}</b> បានស្នើសុំកាត់ប្រាក់ <b>$${parseFloat(amount).toFixed(2)}</b> ពីកាតរបស់អ្នក。<br><br><button onclick="handlePaymentRequest('${paymentId}', '${shopName}', ${amount})" style="background:#10b981; color:white; border:none; padding:5px 10px; border-radius:5px; cursor:pointer; margin-top:10px;">ចុចទីនេះដើម្បីទូទាត់</button>`,
      date: getFormattedDate(),
      isRead: false,
      sender: "system",
      type: "payment_request",
    });

    await owner.save();
    res.json({ success: true, paymentId: paymentId });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.get("/api/card/pending-payments/:username", (req, res) => {
  const searchUsername = req.params.username.toLowerCase();
  const list = pendingPayments.filter(
    (p) => p.username === searchUsername && p.status === "pending",
  );
  res.json({ success: true, pending: list });
});

app.post("/api/card/confirm-payment", async (req, res) => {
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

    if (user.notifications) {
      user.notifications = user.notifications.filter(
        (n) => n.id !== "NOTIF-" + paymentId,
      );
    }

    await user.save();
    res.json({ success: true, message: "ការទូទាត់ជោគជ័យ!" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.post("/api/card/decline-payment", async (req, res) => {
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
        await owner.save();
      }
      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ success: false });
    }
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
app.post("/api/savings/create", async (req, res) => {
  const { username, goalName, targetAmount } = req.body;
  try {
    const user = await User.findOne({ username });
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
      await user.save();
      res.json({ success: true, savings: user.savings });
    } else {
      res.json({ success: false });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

app.post("/api/savings/deposit", async (req, res) => {
  const { username, goalId, amount } = req.body;
  try {
    const user = await User.findOne({ username });
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
        user.markModified("savings");
        await user.save();
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

app.post("/api/savings/break", async (req, res) => {
  const { username, goalId } = req.body;
  try {
    const user = await User.findOne({ username });
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
        user.markModified("savings");
        await user.save();
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
// 🏦 ១០. គណនីបញ្ញើ (FIXED DEPOSITS)
// ==========================================
app.post("/api/fixed-deposit", async (req, res) => {
  const { accountNumber, amount, pin, duration, rate, type, currency } =
    req.body;

  const depAmount = parseFloat(amount);

  try {
    const user = await User.findOne({
      $or: [
        { accountNumber: accountNumber },
        { accountNumberKHR: accountNumber },
      ],
    });

    if (!user || user.pin !== pin) {
      return res.json({
        success: false,
        message: "លេខ PIN មិនត្រឹមត្រូវទេ",
      });
    }

    const isKHR = currency === "KHR";

    if (isKHR) {
      if ((user.balanceKHR || 0) < depAmount) {
        return res.json({
          success: false,
          message: "សមតុល្យប្រាក់រៀលមិនគ្រប់គ្រាន់ទេ",
        });
      }
    } else {
      if ((user.balance || 0) < depAmount) {
        return res.json({
          success: false,
          message: "សមតុល្យប្រាក់ដុល្លារមិនគ្រប់គ្រាន់ទេ",
        });
      }
    }

    const centralBank = await User.findOne({
      accountNumber: "888888888",
    });

    if (!centralBank) {
      return res.json({
        success: false,
        message: "Central Bank Account Not Found",
      });
    }

    if (!user.transactions) user.transactions = [];
    if (!centralBank.transactions) centralBank.transactions = [];
    if (!user.deposits) user.deposits = [];

    if (isKHR) {
      user.balanceKHR -= depAmount;
      centralBank.balanceKHR = (centralBank.balanceKHR || 0) + depAmount;
    } else {
      user.balance -= depAmount;
      centralBank.balance = (centralBank.balance || 0) + depAmount;
    }

    const dateStr = getFormattedDate();
    const refId = "DEP-" + Date.now();
    const hash = generateHash();

    const senderAcc = isKHR ? user.accountNumberKHR : user.accountNumber;

    const bankAcc = isKHR
      ? centralBank.accountNumberKHR
      : centralBank.accountNumber;

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

    user.deposits.push({
      id: "DEP" + Date.now(),
      amount: depAmount,
      currency: isKHR ? "KHR" : "USD",
      rate,
      type,
      durationMonths: duration,
      startDate: dateStr,
      maturityDate: new Date(
        new Date().setMonth(new Date().getMonth() + parseInt(duration)),
      ).toISOString(),
      status: "active",
    });

    user.markModified("transactions");
    user.markModified("deposits");
    centralBank.markModified("transactions");

    await user.save();
    await centralBank.save();

    return res.json({
      success: true,
      newBalance: isKHR ? user.balanceKHR : user.balance,
    });
  } catch (err) {
    console.error("FIXED DEPOSIT ERROR:", err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

app.post("/api/fixed-deposit/withdraw", async (req, res) => {
  const { accountNumber, depositId } = req.body;

  try {
    const user = await User.findOne({
      $or: [
        { accountNumber: accountNumber },
        { accountNumberKHR: accountNumber },
      ],
    });

    const centralBank = await User.findOne({
      accountNumber: "888888888",
    });

    if (!user || !centralBank || !user.deposits) {
      return res.json({
        success: false,
        message: "រកមិនឃើញគណនី ឬប្រាក់បញ្ញើទេ",
      });
    }

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

    if (!user.transactions) user.transactions = [];
    if (!centralBank.transactions) centralBank.transactions = [];

    user.deposits[depIndex].status = "closed";

    if (isKHR) {
      user.balanceKHR = (user.balanceKHR || 0) + withdrawAmount;
      centralBank.balanceKHR = (centralBank.balanceKHR || 0) - withdrawAmount;
    } else {
      user.balance = (user.balance || 0) + withdrawAmount;
      centralBank.balance = (centralBank.balance || 0) - withdrawAmount;
    }

    const dateStr = getFormattedDate();
    const refId = "WD-" + Date.now();
    const hash = generateHash();

    user.transactions.unshift({
      refId,
      hash,
      date: dateStr,
      type: "Withdraw Deposit",
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
      type: "Deposit Refund",
      amount: -withdrawAmount,
      currency: isKHR ? "KHR" : "USD",
      senderName: "U-Pay Central Bank",
      receiverName: user.fullName || user.username,
      status: "Success",
      trxMethod: "Fixed Deposit",
    });

    user.markModified("transactions");
    user.markModified("deposits");
    centralBank.markModified("transactions");

    await user.save();
    await centralBank.save();

    return res.json({
      success: true,
      newBalance: isKHR ? user.balanceKHR : user.balance,
    });
  } catch (err) {
    console.error("FIXED DEPOSIT WITHDRAW ERROR:", err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

// ==========================================
// 🎁 ១១. រង្វាន់ និងការបង្វិលសង (REWARDS & CASHBACK)
// ==========================================
app.post("/api/reward/cashback", async (req, res) => {
  const { username, amount, refId } = req.body;
  try {
    const user = await User.findOne({ username });
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
        await user.save();
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
// 🎧 ១២. សេវាកម្មអតិថិជន (SUPPORT TICKETS)
// ==========================================
app.post("/api/ticket/create", async (req, res) => {
  const { username, subject, description, priority } = req.body;
  try {
    const user = await User.findOne({ username });
    if (user) {
      if (!user.tickets) user.tickets = [];
      const results = await User.aggregate([
        {
          $project: {
            numberOfTickets: { $size: { $ifNull: ["$tickets", []] } },
          },
        },
        { $group: { _id: null, total: { $sum: "$numberOfTickets" } } },
      ]);
      const allTicketsCount = results.length > 0 ? results[0].total : 0;
      const nextNumber = allTicketsCount + 1;
      const formattedId = "TK-" + nextNumber.toString().padStart(3, "0");

      user.tickets.push({
        ticketId: formattedId,
        subject,
        description,
        priority: priority || "Normal",
        status: "Open",
        date: getFormattedDate(),
      });
      await user.save();
      res.json({
        success: true,
        message: "Ticket Created!",
        ticketId: formattedId,
      });
    } else {
      res.json({ success: false });
    }
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Server មានបញ្ហាក្នុងការបង្កើត Ticket",
    });
  }
});

// ==========================================
// 👑 ១៣. ប្រព័ន្ធគ្រប់គ្រង ADMIN (ADMIN DASHBOARD)
// ==========================================
app.get("/api/admin/stats", async (req, res) => {
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

app.get("/api/admin/dashboard-extra", async (req, res) => {
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

app.post("/api/admin/toggle-freeze", async (req, res) => {
  const { id, isFrozen } = req.body;
  try {
    const u = await User.findOne({ id: id });
    if (u) {
      u.isFrozen = isFrozen;
      if (!isFrozen) u.pinAttempts = 0;
      await u.save();
      res.json({ success: true });
    } else res.json({ success: false });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

app.get("/api/admin/transaction/:id", async (req, res) => {
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

app.post("/api/admin/edit-user", async (req, res) => {
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
      const checkUSD = accountNumber || u.accountNumber;
      const checkKHR = accountNumberKHR || u.accountNumberKHR;

      if (checkUSD === checkKHR)
        return res.json({
          success: false,
          message:
            "បរាជ័យ! លេខគណនី USD និង KHR របស់បុគ្គលម្នាក់ មិនអាចដូចគ្នាបានទេ។",
        });

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

      if (username) u.username = username;
      if (pin) u.pin = pin;
      if (profileImage !== undefined) u.profileImage = profileImage;
      if (password && password.trim() !== "") u.password = password;

      await u.save();
      res.json({ success: true });
    } else {
      res.json({ success: false, message: "រកមិនឃើញគណនីដើម្បីកែប្រែទេ។" });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

app.post("/api/admin/delete-user", async (req, res) => {
  const { id } = req.body;
  try {
    const result = await User.deleteOne({ id: id });
    if (result.deletedCount > 0) res.json({ success: true });
    else res.json({ success: false, message: "User not found" });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

app.post("/api/admin/adjust-balance", async (req, res) => {
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

    await user.save();
    await centralBank.save();

    res.json({ success: true, message: `Operation Success!` });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

app.post("/api/admin/approve-transaction", async (req, res) => {
  const { refId } = req.body;
  try {
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
          date: getFormattedDate(),
          isRead: false,
        });
        u.markModified("transactions");
        await u.save();
        return res.json({ success: true, message: "Transaction Approved!" });
      }
    }
    res.json({ success: false, message: "Transaction not found/pending" });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

app.post("/api/admin/refund-transaction", async (req, res) => {
  const { refId } = req.body;
  try {
    const u = await User.findOne({ "transactions.refId": refId });
    if (u) {
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
        u.markModified("transactions");
        await u.save();
        return res.json({ success: true, message: "Refund Successful!" });
      }
    }
    res.json({ success: false, message: "Transaction not found" });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// ==========================================
// 📢 ១៤. ការជូនដំណឹង (NOTIFICATIONS & BROADCASTS)
// ==========================================
app.get("/api/user/notifications", async (req, res) => {
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

app.post("/api/user/read-notifications", async (req, res) => {
  const { username } = req.body;
  try {
    const user = await User.findOne({ username });
    if (user && user.notifications) {
      user.notifications.forEach((n) => (n.isRead = true));
      user.markModified("notifications");
      await user.save();
      res.json({ success: true });
    } else res.json({ success: false });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

app.post("/api/admin/broadcast", async (req, res) => {
  const { title, message, sender } = req.body;
  const sharedNotifId = "BC-" + Date.now();
  try {
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
            $position: 0,
          },
        },
      },
    );
    res.json({ success: true, count: result.matchedCount });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.post("/api/admin/delete-broadcast", async (req, res) => {
  const { notifId } = req.body;
  try {
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
// ⏱ ១៥. ស្វ័យប្រវត្តិកម្ម (AUTO JOBS)
// ==========================================
const autoReleaseHold = async () => {
  const now = Date.now();
  try {
    const users = await User.find({
      "transactions.isHold": true,
      "transactions.status": "Pending",
      "transactions.releaseDate": { $lte: now },
    });
    if (users.length === 0) return;
    let merchant = await User.findOne({ accountNumber: "100000004" });
    if (!merchant) return;

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
          const amountToRelease = Math.abs(t.amount);
          merchant.balance += amountToRelease;
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
        await u.save();
      }
    }
    await merchant.save();
  } catch (err) {
    console.error("❌ Error in autoReleaseHold Job:", err);
  }
};
setInterval(autoReleaseHold, 10000);

// ==========================================
// 🛡 ១៦. ADMIN ACTIONS (KYC & TICKETS)
// ==========================================
app.post("/api/admin/kyc-action", async (req, res) => {
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
        date: getFormattedDate(),
        isRead: false,
        sender: "system",
      });
      await u.save();
      res.json({ success: true });
    } else res.json({ success: false });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

app.post("/api/admin/ticket-reply", async (req, res) => {
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
          date: getFormattedDate(),
          isRead: false,
          sender: "system",
        });
        u.markModified("tickets");
        await u.save();
        res.json({ success: true });
      } else res.json({ success: false });
    } else res.json({ success: false });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

// ==========================================
// 💬 ប្រព័ន្ធ CHAT ថ្មី (UNIFIED CHAT - BOT & HUMAN)
// ==========================================
app.post("/api/chat/send", async (req, res) => {
  const { senderAcc, receiverAcc, message, adminName } = req.body;
  try {
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

    if (senderAcc === "ADMIN") {
      if (message.includes("ការសន្ទនាត្រូវបានបញ្ចប់ដោយ Admin")) {
        const realUser = await User.findOne({
          accountNumber: receiver.accountNumber,
        });
        if (realUser) {
          realUser.needsSupport = false;
          await realUser.save();
        }
      }
    } else {
      const realUser = await User.findOne({
        accountNumber: sender.accountNumber,
      });
      if (realUser) {
        if (!realUser.needsSupport) {
          const text = message.toLowerCase();
          if (text.includes("human") || text.includes("ភ្នាក់ងារ")) {
            realUser.needsSupport = true;
            await realUser.save();
          }
        }
      }
    }

    const newMessage = new Chat({
      id: "MSG-" + Date.now(),
      senderAcc: sender.accountNumber || "ADMIN",
      receiverAcc: receiver.accountNumber || "ADMIN",
      message: message,
      adminName: adminName || null,
      time: getFormattedDate(),
      timestamp: Date.now(),
      isRead: false,
    });
    await newMessage.save();
    res.json({ success: true, message: newMessage });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Chat មានបញ្ហា" });
  }
});

app.post("/api/chat/history", async (req, res) => {
  const { user1Acc, user2Acc } = req.body;
  try {
    const history = await Chat.find({
      $or: [
        { senderAcc: user1Acc, receiverAcc: user2Acc },
        { senderAcc: user2Acc, receiverAcc: user1Acc },
      ],
    });
    await Chat.updateMany(
      { receiverAcc: user1Acc, senderAcc: user2Acc, isRead: false },
      { $set: { isRead: true } },
    );
    res.json({ success: true, history: history });
  } catch (err) {
    res.status(500).json({ success: false, history: [] });
  }
});

app.post("/api/chat/contacts", async (req, res) => {
  const { myAcc } = req.body;
  try {
    const chats = await Chat.find({
      $or: [{ senderAcc: myAcc }, { receiverAcc: myAcc }],
    });
    const users = await User.find({});
    let contactMap = {};

    for (let c of chats) {
      const partnerAcc = c.senderAcc === myAcc ? c.receiverAcc : c.senderAcc;
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
          if (myAcc === "ADMIN" && !partnerInfo.needsSupport)
            isValidToDisplay = false;
        }
      }

      if (isValidToDisplay) {
        if (
          !contactMap[partnerAcc] ||
          contactMap[partnerAcc].timestamp < c.timestamp
        ) {
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

    const activeContacts = Object.values(contactMap)
      .filter((c) => {
        if (
          myAcc === "ADMIN" &&
          c.lastMessage.includes("ការសន្ទនាត្រូវបានបញ្ចប់ដោយ Admin")
        )
          return false;
        return true;
      })
      .sort((a, b) => b.timestamp - a.timestamp);

    res.json({ success: true, contacts: activeContacts });
  } catch (err) {
    res.status(500).json({ success: false, contacts: [] });
  }
});

app.post("/api/chat/check-user", async (req, res) => {
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
// 🔑 ប្រព័ន្ធ FORGOT PASSWORD & OTP SYSTEM
// ==========================================
app.post("/api/forgot-password/verify-user", async (req, res) => {
  const { identifier } = req.body;
  try {
    const user = await User.findOne({
      $or: [{ username: identifier }, { phone: identifier }],
    });
    if (!user)
      return res.json({
        success: false,
        message: "រកមិនឃើញគណនី ឬលេខទូរស័ព្ទនេះក្នុងប្រព័ន្ធទេ! ❌",
      });
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    tempForgotOtps[user.username] = otp;
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

app.post("/api/forgot-password/reset-password", async (req, res) => {
  const { username, otp, newPassword } = req.body;
  if (!tempForgotOtps[username] || tempForgotOtps[username] !== otp) {
    return res.json({
      success: false,
      message: "លេខកូដ OTP មិនត្រឹមត្រូវ ឬផុតកំណត់ហើយ! ❌",
    });
  }
  try {
    const user = await User.findOne({ username });
    if (user) {
      user.password = newPassword;
      await user.save();
      delete tempForgotOtps[username];
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
// 💳 ប្រព័ន្ធទូទាត់វិក្កយបត្រ (BILL PAYMENTS INTERACTION WITH PAYHUB)
// ==========================================
app.post("/api/bank/scan-bill", async (req, res) => {
  const { bill_id } = req.body;
  try {
    const response = await fetch(
      `${PAYHUB_URL}/api/gateway/check-bill?query=${encodeURIComponent(bill_id)}`,
    );
    const data = await response.json();
    if (response.ok && data.success)
      res.json({ success: true, billData: data.bill });
    else
      res
        .status(404)
        .json({ success: false, message: data.message || "រកមិនឃើញទិន្នន័យ" });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: "មិនអាចភ្ជាប់ទៅប្រព័ន្ធ PayHub បានទេ" });
  }
});

app.post("/api/bank/pay-bill", async (req, res) => {
  const { bill_id, company, amount, username } = req.body;
  try {
    let payingUser = await User.findOne({ username });
    if (!payingUser)
      return res
        .status(404)
        .json({ success: false, message: "រកមិនឃើញគណនីរបស់អ្នក!" });
    if (payingUser.balance < amount)
      return res
        .status(400)
        .json({ success: false, message: "សមតុល្យមិនគ្រប់គ្រាន់!" });

    const response = await fetch(`${PAYHUB_URL}/api/gateway/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bill_id: bill_id }),
    });

    const data = await response.json();
    if (response.ok && data.success) {
      const compRes = await fetch(`${PAYHUB_URL}/api/admin/users`);
      const payhubUsers = await compRes.json();
      const compData = payhubUsers.find(
        (u) => u.name === company && u.role === "company",
      );

      payingUser.balance -= amount;
      const newHash = generateCompactHash();
      const currentRefId = `BP-${Date.now()}`;

      payingUser.transactions.unshift({
        refId: currentRefId,
        hash: newHash,
        date: getFormattedDate(),
        type: "Bill Payment",
        amount: -amount,
        receiverName: company,
        remark: "ទូទាត់វិក្កយបត្រ: " + bill_id,
        status: "Success",
      });
      await payingUser.save();

      if (compData && compData.upay_account) {
        const fee_percent = parseFloat(compData.fee_percent) || 0;
        const net_amount = amount - (amount * fee_percent) / 100;
        let companyAccount = await User.findOne({
          $or: [
            { accountNumber: compData.upay_account },
            { accountNumberKHR: compData.upay_account },
          ],
        });

        if (companyAccount) {
          companyAccount.balance =
            (parseFloat(companyAccount.balance) || 0) + net_amount;
          companyAccount.transactions.unshift({
            refId: `SETTLE-${Date.now()}`,
            hash: newHash,
            date: getFormattedDate(),
            type: "Bill Settlement",
            amount: net_amount,
            senderName: payingUser.fullName || payingUser.username,
            remark: `ទូទាត់វិក្កយបត្រ ${bill_id} (Fee: ${fee_percent}%)`,
            status: "Success",
          });
          await companyAccount.save();
        }
      }
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
    res
      .status(500)
      .json({ success: false, message: "ការទូទាត់បរាជ័យ (Server Error)" });
  }
});

// ==========================================
// 🔄 API សម្រាប់ផ្ទៀងផ្ទាត់លេខគណនី U-PAY
// ==========================================
app.get("/api/bank/verify-account/:account_number", async (req, res) => {
  const { account_number } = req.params;
  try {
    const targetUser = await User.findOne({
      $or: [
        { accountNumber: account_number },
        { accountNumberKHR: account_number },
      ],
    });
    if (targetUser)
      res.json({
        success: true,
        account_name: targetUser.fullName || targetUser.username,
      });
    else
      res.json({
        success: false,
        message: "រកមិនឃើញលេខគណនីនេះនៅក្នុងប្រព័ន្ធ U-PAY ទេ!",
      });
  } catch (err) {
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
