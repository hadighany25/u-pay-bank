// ==========================================================================
// 📦 ផ្នែកទី ១៖ ទាញយកបណ្ណាល័យ (IMPORTS & CORE MODULES)
// ==========================================================================
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const TelegramBot = require("node-telegram-bot-api");

// ==========================================================================
// ⚙️ ផ្នែកទី ២៖ ការកំណត់ទូទៅ និង MIDDLEWARE (SERVER CONFIGURATIONS)
// ==========================================================================
const app = express();
const PORT = process.env.PORT || 3000;
const PAYHUB_URL = "https://payhub-kh.onrender.com";

// 💡 អនុញ្ញាតឱ្យរាល់ Domain ទាំងអស់ (រួមទាំង PAYHUB) អាច Fetch ចូលបានដោយគ្មានទាស់ CORS
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

// កំណត់ការបង្កើត Folder និងឈ្មោះឯកសារសម្រាប់ Upload រូបភាព Profile
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

// ==========================================================================
// 🗄️ ផ្នែកទី ៣៖ ការតភ្ជាប់ទៅកាន់ MONGODB ATLAS & SCHEMAS
// ==========================================================================
const MONGO_URI =
  "mongodb+srv://hadighany25_db_user:9zFpD1cbPGKqzyKW@cluster0.wuilm9.mongodb.net/upay_db?appName=Cluster0";

mongoose
  .connect(MONGO_URI)
  .then(() => console.log("🟢 [MongoDB] Connected Successfully to Cloud!"))
  .catch((err) => console.error("🔴 [MongoDB] Connection Error:", err));

// ទម្រង់ទិន្នន័យអ្នកប្រើប្រាស់ (User Schema)
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
    trxLimit: { type: Number, default: 1000 },
    profileImage: { type: String, default: "" },
    isFrozen: { type: Boolean, default: false },
    isOnline: { type: Boolean, default: false },
    pinAttempts: { type: Number, default: 0 },
    transactions: { type: Array, default: [] },
    notifications: { type: Array, default: [] },
    tickets: { type: Array, default: [] },
    virtualCards: { type: Array, default: [] },
    deposits: { type: Array, default: [] },
    kycStatus: { type: String, default: "pending" },
    needsSupport: { type: Boolean, default: false },
    telegramChatId: { type: String, default: null },
    linkCode: { type: String, default: null },
    joinDate: { type: String, default: () => new Date().toISOString() },
    lastActive: { type: String, default: () => new Date().toISOString() },
  },
  { timestamps: true },
);

const User = mongoose.model("User", userSchema);

// ទម្រង់ទិន្នន័យឆាត (Chat Schema)
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

// ឯកសារទិន្នន័យប្រព័ន្ធចាស់ៗ (សម្រាប់រក្សាភាពស៊ីគ្នាជាមួយ File System)
const SETTINGS_FILE = path.join(__dirname, "data", "settings.json");
const SYSTEM_FILE = path.join(__dirname, "data", "system.json");

// អថេរផ្ទុក Memory បណ្តោះអាសន្នលើ Server
let tempForgotOtps = {};
let pendingPayments = [];

// ==========================================================================
// 🛠 ផ្នែកទី ៤៖ អនុគមន៍ជំនួយ (HELPER FUNCTIONS)
// ==========================================================================
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

const readSettings = () => {
  if (!fs.existsSync(SETTINGS_FILE)) {
    if (!fs.existsSync(path.dirname(SETTINGS_FILE)))
      fs.mkdirSync(path.dirname(SETTINGS_FILE), { recursive: true });
    const def = { fx: { usdToKhrBuy: 4050, usdToKhrSell: 4100 } };
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(def, null, 2));
    return def;
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

const generateHash = () =>
  "HSH" + Math.random().toString(36).substring(2, 12).toUpperCase();
const generateCompactHash = () =>
  Math.random().toString(36).substring(2, 10).toUpperCase();
const generateRefId = () =>
  Math.floor(1000000000 + Math.random() * 9000000000).toString();

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

const generatePatternAccounts = (users) => {
  let isUnique = false,
    newAccUSD = "",
    newAccKHR = "";
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
    if (!exists) isUnique = true;
  }
  return { usd: newAccUSD, khr: newAccKHR };
};

// ==========================================================================
// 🏦 ផ្នែកទី ៥៖ ការបង្កើតគណនីប្រព័ន្ធស្វ័យប្រវត្តិ (AUTO INIT SYSTEM ACCOUNTS)
// ==========================================================================
const initSystemAccounts = async () => {
  try {
    const billers = [
      { username: "EDC", accountNumber: "100000001" },
      { username: "PPWSA", accountNumber: "100000002" },
      { username: "Internet", accountNumber: "100000003" },
      { username: "Fashion Shop", accountNumber: "100000004" },
    ];

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

    const centralBank = await User.findOne({ accountNumber: "888888888" });
    if (!centralBank) {
      await User.create({
        username: "centralbank",
        fullName: "U-Pay Central Bank",
        accountNumber: "888888888",
        accountNumberKHR: "988888888",
        balance: 1000000000,
        balanceKHR: 4000000000000,
        role: "admin",
        pin: "1234",
        profileImage: "images/logo.png",
        isFrozen: false,
      });
      console.log(`🏦 U-Pay Central Bank Created!`);
    }

    const feeAcc = await User.findOne({ accountNumber: "999999999" });
    if (!feeAcc) {
      await User.create({
        username: "upayfee",
        fullName: "U-PAY Fee Account",
        accountNumber: "999999999",
        accountNumberKHR: "999999998",
        balance: 0,
        balanceKHR: 0,
        role: "admin",
        pin: "9999",
        isFrozen: false,
      });
      console.log(`💵 U-PAY Fee Account Created!`);
    }
  } catch (err) {
    console.error("Init System Accounts Error:", err);
  }
};
mongoose.connection.once("open", initSystemAccounts);

// ==========================================================================
// 🤖 ផ្នែកទី ៦៖ ប្រព័ន្ធ TELEGRAM BOT (MONGODB COMPATIBLE)
// ==========================================================================
const token = "8786350689:AAEncWXnaMjzk1QpMyZmo_Censsu4DVHSG0";
const bot = new TelegramBot(token, { polling: true });
const ADMIN_CHAT_ID = "6741755194";

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text ? msg.text.trim() : "";

  if (text === "/start") {
    bot.sendMessage(
      chatId,
      `សួស្តី! Chat ID របស់អ្នកគឺ៖ <code>${chatId}</code>`,
      { parse_mode: "HTML" },
    );
  } else if (text.length === 4 && !isNaN(text)) {
    try {
      let user = await User.findOne({ linkCode: text });
      if (user) {
        user.telegramChatId = chatId;
        user.linkCode = null;
        await user.save();
        bot.sendMessage(
          chatId,
          `🎉 អបអរសាទរ! គណនី U-Pay (<b>${user.fullName || user.username}</b>) ត្រូវបានភ្ជាប់ជោគជ័យ!`,
          { parse_mode: "HTML" },
        );
        console.log(
          `✅ Linked: Account: ${user.username}, Telegram: ${chatId}`,
        );
      } else {
        bot.sendMessage(
          chatId,
          `❌ លេខកូដ ៤ ខ្ទង់នេះមិនត្រឹមត្រូវ ឬផុតកំណត់ហើយ!`,
        );
      }
    } catch (err) {
      console.error(err);
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
    } else res.json({ success: false, message: "User not found" });
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
      if (oldChatId)
        bot
          .sendMessage(
            oldChatId,
            `⚠️ គណនី U-Pay (<b>${username}</b>) ត្រូវបានផ្តាច់!`,
            { parse_mode: "HTML" },
          )
          .catch((e) => {});
      res.json({ success: true });
    } else res.json({ success: false, message: "User not found" });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// ==========================================================================
// 🔐 ផ្នែកទី ៧៖ ប្រព័ន្ធចុះឈ្មោះ និងការផ្ទៀងផ្ទាត់ (AUTH & MANAGEMENT APIs)
// ==========================================================================
app.get("/", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "upay.html")),
);

app.post("/api/register", async (req, res) => {
  const { username, password, fullName, phone, pin } = req.body;
  try {
    const existingUser = await User.findOne({
      username: username.toLowerCase(),
    });
    if (existingUser)
      return res.json({ success: false, message: "Username already taken!" });

    const allUsers = await User.find({});
    const newAccs = generatePatternAccounts(allUsers);

    const newUser = new User({
      username: username.toLowerCase(),
      password,
      fullName: fullName || username,
      phone,
      pin,
      accountNumber: newAccs.usd,
      accountNumberKHR: newAccs.khr,
      balance: 0,
      balanceKHR: 0,
      role: "user",
      trxLimit: 1000,
      kycStatus: "unverified",
    });
    await newUser.save();
    res.json({ success: true, user: newUser });
  } catch (err) {
    res.status(500).json({ success: false, message: "Register Error" });
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
        { username: identifier.toLowerCase() },
        { phone: identifier },
        { fullName: identifier },
      ],
      password: password,
    });
    if (user) {
      if (user.isFrozen)
        return res.json({ success: false, message: "Account Frozen!" });
      user.isOnline = true;
      user.lastActive = new Date().toISOString();
      await user.save();
      res.json({ success: true, user });
    } else res.json({ success: false, message: "Invalid Credentials" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Login Error" });
  }
});

app.post("/api/logout", async (req, res) => {
  const { username } = req.body;
  try {
    const user = await User.findOne({ username: username.toLowerCase() });
    if (user) {
      user.isOnline = false;
      await user.save();
    }
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false });
  }
});

app.get("/api/users", async (req, res) => {
  try {
    const users = await User.find({});
    res.json(users);
  } catch (e) {
    res.status(500).json([]);
  }
});

app.post("/api/heartbeat", async (req, res) => {
  const { username } = req.body;
  try {
    await User.updateOne(
      { username: username.toLowerCase() },
      { $set: { lastActive: new Date().toISOString(), isOnline: true } },
    );
    res.json({ success: true });
  } catch (e) {
    res.json({ success: false });
  }
});

// ==========================================================================
// 👤 ផ្នែកទី ៨៖ គ្រប់គ្រងព័ត៌មានផ្ទាល់ខ្លួន (USER PROFILE & MANAGEMENT)
// ==========================================================================
app.post("/api/change-password", async (req, res) => {
  const { username, oldPassword, newPassword } = req.body;
  try {
    const user = await User.findOne({
      username: username.toLowerCase(),
      password: oldPassword,
    });
    if (!user)
      return res.json({
        success: false,
        message: "ពាក្យសម្ងាត់ចាស់មិនត្រឹមត្រូវ!",
      });
    user.password = newPassword;
    await user.save();
    res.json({ success: true, message: "ប្តូរពាក្យសម្ងាត់ជោគជ័យ!" });
  } catch (e) {
    res.json({ success: false });
  }
});

app.post("/api/change-pin", async (req, res) => {
  const { username, oldPin, newPin } = req.body;
  try {
    const user = await User.findOne({
      username: username.toLowerCase(),
      pin: oldPin,
    });
    if (!user)
      return res.json({
        success: false,
        message: "លេខ PIN ចាស់មិនត្រឹមត្រូវ!",
      });
    user.pin = newPin;
    await user.save();
    res.json({ success: true, message: "ប្តូរលេខ PIN ជោគជ័យ!" });
  } catch (e) {
    res.json({ success: false });
  }
});

app.post("/api/change-limit", async (req, res) => {
  const { username, newLimit } = req.body;
  try {
    await User.updateOne(
      { username: username.toLowerCase() },
      { $set: { trxLimit: parseFloat(newLimit) } },
    );
    res.json({ success: true });
  } catch (e) {
    res.json({ success: false });
  }
});

app.post(
  "/api/user/upload-image",
  upload.single("profileImg"),
  async (req, res) => {
    const { username } = req.body;
    if (!req.file)
      return res.json({ success: false, message: "No file uploaded" });
    try {
      const relativePath = "uploads/" + req.file.filename;
      await User.updateOne(
        { username: username.toLowerCase() },
        { $set: { profileImage: relativePath } },
      );
      res.json({ success: true, imagePath: relativePath });
    } catch (e) {
      res.json({ success: false });
    }
  },
);

// ==========================================================================
// 💸 ផ្នែកទី ៩៖ ប្រព័ន្ធផ្ទេរប្រាក់ និងអត្រាប្តូរប្រាក់ (TRANSFER & FX RATES)
// ==========================================================================
app.get("/api/fx-rates", (req, res) => {
  const settings = readSettings();
  res.json({ success: true, rates: settings.fx });
});

app.post("/api/admin/fx/update", (req, res) => {
  const { buy, sell } = req.body;
  writeSettings({
    fx: { usdToKhrBuy: parseFloat(buy), usdToKhrSell: parseFloat(sell) },
  });
  res.json({ success: true, message: "Exchange rates updated successfully!" });
});

app.post("/api/check-account", async (req, res) => {
  const { accountNumber, currentUsername } = req.body;
  try {
    const target = await User.findOne({
      $or: [{ accountNumber }, { accountNumberKHR: accountNumber }],
    });
    if (!target)
      return res.json({ success: false, message: "រកមិនឃើញគណនីនេះទេ!" });
    if (target.username === currentUsername?.toLowerCase())
      return res.json({
        success: false,
        message: "មិនអាចផ្ទេរទៅកាន់ខ្លួនឯងបានទេ!",
      });
    const isKHR = target.accountNumberKHR === accountNumber;
    res.json({
      success: true,
      name: target.fullName || target.username,
      currency: isKHR ? "KHR" : "USD",
    });
  } catch (e) {
    res.json({ success: false });
  }
});

app.post("/api/transfer", async (req, res) => {
  const { senderUsername, receiverAccount, amount, pin, remark } = req.body;
  const sysStatus = readSystemStatus();
  if (sysStatus.isSystemFrozen)
    return res.json({
      success: false,
      message: "ប្រព័ន្ធផ្ទេរប្រាក់ត្រូវបានបិទបណ្តោះអាសន្ន! ⚠️",
    });

  try {
    const sender = await User.findOne({
      username: senderUsername.toLowerCase(),
    });
    if (!sender)
      return res.json({ success: false, message: "រកមិនឃើញគណនីអ្នកផ្ញើ!" });
    if (sender.pin !== pin)
      return res.json({ success: false, message: "លេខ PIN មិនត្រឹមត្រូវ!" });

    const receiver = await User.findOne({
      $or: [
        { accountNumber: receiverAccount },
        { accountNumberKHR: receiverAccount },
      ],
    });
    if (!receiver)
      return res.json({ success: false, message: "រកមិនឃើញគណនីអ្នកទទួល!" });

    const isSenderKHR =
      sender.accountNumberKHR === receiverAccount ||
      (receiver.accountNumberKHR === receiverAccount &&
        sender.balanceKHR >= amount);
    const isReceiverKHR = receiver.accountNumberKHR === receiverAccount;
    const transferAmount = parseFloat(amount);
    const settings = readSettings();

    let finalDeduct = transferAmount;
    let finalAdd = transferAmount;

    // Logic គណនាប្តូរប្រាក់ស្វ័យប្រវត្តិកាលណាប្រភេទកុងអ្នកផ្ញើ និងអ្នកទទួលខុសគ្នា
    if (isSenderKHR && !isReceiverKHR) {
      finalAdd = transferAmount / settings.fx.usdToKhrSell;
    } else if (!isSenderKHR && isReceiverKHR) {
      finalAdd = transferAmount * settings.fx.usdToKhrBuy;
    }

    if (isSenderKHR) {
      if (sender.balanceKHR < finalDeduct)
        return res.json({ success: false, message: "សមតុល្យមិនគ្រប់គ្រាន់!" });
      sender.balanceKHR -= finalDeduct;
    } else {
      if (sender.balance < finalDeduct)
        return res.json({ success: false, message: "សមតុល្យមិនគ្រប់គ្រាន់!" });
      sender.balance -= finalDeduct;
    }

    if (isReceiverKHR) receiver.balanceKHR += finalAdd;
    else receiver.balance += finalAdd;

    const refId = generateRefId();
    const hash = generateHash();
    const date = getFormattedDate();
    const displayAmount =
      transferAmount.toLocaleString() + (isSenderKHR ? " ៛" : " $");

    const senderTrx = {
      refId,
      hash,
      date,
      type: "Transfer Out",
      amount: -finalDeduct,
      receiverName: receiver.fullName || receiver.username,
      receiverAccount,
      remark,
      status: "Success",
    };
    const receiverTrx = {
      refId,
      hash,
      date,
      type: "Transfer In",
      amount: finalAdd,
      senderName: sender.fullName || sender.username,
      senderAccount: isSenderKHR
        ? sender.accountNumberKHR
        : sender.accountNumber,
      remark,
      status: "Success",
    };

    sender.transactions.unshift(senderTrx);
    receiver.transactions.unshift(receiverTrx);

    // បញ្ជូនសារ Notification ក្នុង App ទៅកាន់អ្នកទទួល
    receiver.notifications.unshift({
      id: "NOTIF-" + Date.now(),
      title: "ទទួលបានប្រាក់ 📥",
      message: `អ្នកទទួលបានប្រាក់ចំនួន +${displayAmount} ពី ${sender.fullName || sender.username}`,
      date,
      isRead: false,
    });

    await sender.save();
    await receiver.save();

    // ផ្ញើសារ Realtime ចូល Telegram Bot របស់គណនីអ្នកទទួល
    if (receiver.telegramChatId) {
      const alertMsg = `🔔 <b>ទទួលបានប្រាក់ (Money Received)</b> 🔔\n━━━━━━━━━━━━━━━━\n💰 <b>ចំនួនទឹកប្រាក់៖</b> +${displayAmount}\n📥 <b>ចូលគណនី៖</b> ${receiver.fullName || receiver.username}\n📤 <b>ពីគណនី៖</b> ${sender.fullName || sender.username}\n🧾 <b>លេខប្រតិបត្តិការ៖</b> ${refId}\n⏰ <b>កាលបរិច្ឆេទ៖</b> ${date}\n📝 <b>ចំណាំ៖</b> ${remark || "គ្មាន"}\n━━━━━━━━━━━━━━━━━\n✅ <i>ប្រតិបត្តិការជោគជ័យ (U-Pay)</i>`;
      bot
        .sendMessage(receiver.telegramChatId, alertMsg, { parse_mode: "HTML" })
        .catch(() => {});
    }

    res.json({
      success: true,
      newBalance: isSenderKHR ? sender.balanceKHR : sender.balance,
      slipData: senderTrx,
    });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: "Server ផ្ទេរប្រាក់មានបញ្ហា" });
  }
});

// ==========================================================================
// 💳 ផ្នែកទី ១០៖ ប្រព័ន្ធគ្រប់គ្រងកាតនិម្មិត (VIRTUAL CARD SYSTEM)
// ==========================================================================
app.post("/api/card/create", async (req, res) => {
  const { username, cardType } = req.body;
  const FEE_AMOUNT = 1; // ថ្លៃសេវាបង្កើតកាត $1
  try {
    const user = await User.findOne({ username: username.toLowerCase() });
    const feeAccount = await User.findOne({ accountNumber: "999999999" });
    if (!user) return res.json({ success: false, message: "រកមិនឃើញគណនី!" });
    if (user.balance < FEE_AMOUNT)
      return res.json({
        success: false,
        message: "សមតុល្យមិនគ្រប់គ្រាន់សម្រាប់បង់សេវាបង្កើតកាត ($1.00)!",
      });

    user.balance -= FEE_AMOUNT;
    feeAccount.balance += FEE_AMOUNT;

    const refId = "FEE-" + Date.now();
    const hash = generateHash();
    const dateStr = getFormattedDate();

    user.transactions.unshift({
      refId,
      hash,
      date: dateStr,
      type: "Card Service Fee",
      amount: -FEE_AMOUNT,
      receiverName: "U-PAY Fee Account",
      receiverAccount: "999999999",
      status: "Success",
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
      pin: "0000",
      dailyLimit: cardType === "platinum" ? 5000 : 1000,
      status: "active",
    };

    if (!user.virtualCards) user.virtualCards = [];
    user.virtualCards.push(newCard);
    user.markModified("virtualCards");
    await user.save();
    await feeAccount.save();

    res.json({ success: true, card: newCard, newBalance: user.balance });
  } catch (e) {
    res.status(500).json({ success: false });
  }
});

app.post("/api/card/update-pin", async (req, res) => {
  const { username, cardId, oldPin, newPin } = req.body;
  try {
    const user = await User.findOne({ username: username.toLowerCase() });
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
    } else res.json({ success: false, message: "រកមិនឃើញអ្នកប្រើប្រាស់!" });
  } catch (e) {
    res.status(500).json({ success: false });
  }
});

app.post("/api/card/update-limit", async (req, res) => {
  const { username, cardId, newLimit } = req.body;
  try {
    const user = await User.findOne({ username: username.toLowerCase() });
    if (user && user.virtualCards) {
      const card = user.virtualCards.find((c) => c.id === cardId);
      if (card) {
        card.dailyLimit = parseFloat(newLimit);
        user.markModified("virtualCards");
        await user.save();
        return res.json({ success: true });
      }
    }
    res.json({ success: false });
  } catch (e) {
    res.status(500).json({ success: false });
  }
});

app.post("/api/card/delete", async (req, res) => {
  const { username, cardId } = req.body;
  try {
    const user = await User.findOne({ username: username.toLowerCase() });
    if (user && user.virtualCards) {
      user.virtualCards = user.virtualCards.filter((c) => c.id !== cardId);
      user.markModified("virtualCards");
      await user.save();
      res.json({ success: true });
    } else res.json({ success: false });
  } catch (e) {
    res.status(500).json({ success: false });
  }
});

// Simulation ទូទាត់អនឡាញតាមកាត (Card Payment Processor Gateway Simulation)
app.post("/api/card/pay-simulation", async (req, res) => {
  const { cardNumber, cvv, expiry, amount, shopName, orderId } = req.body;
  try {
    const owner = await User.findOne({ "virtualCards.number": cardNumber });
    if (!owner)
      return res.json({ success: false, message: "លេខកាតមិនត្រឹមត្រូវ!" });
    const targetCard = owner.virtualCards.find((c) => c.number === cardNumber);

    if (targetCard.cvv !== cvv || targetCard.expiry !== expiry)
      return res.json({ success: false, message: "ព័ត៌មានកាតមិនត្រឹមត្រូវ!" });
    if (targetCard.status !== "active")
      return res.json({ success: false, message: "កាតនេះត្រូវបានបិទចរាចរណ៍!" });
    if (owner.balance < parseFloat(amount))
      return res.json({
        success: false,
        message: "សមតុល្យគណនីមិនគ្រប់គ្រាន់!",
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

    if (totalSpentToday + parseFloat(amount) > (targetCard.dailyLimit || 1000))
      return res.json({
        success: false,
        message: "លើសកម្រិតចំណាយប្រចាំថ្ងៃរបស់កាត!",
      });

    const paymentId = "PAY-" + Date.now();
    pendingPayments.push({
      paymentId,
      cardNumber,
      amount: parseFloat(amount),
      orderId,
      shopName,
      username: owner.username,
      status: "pending",
      date: getFormattedDate(),
    });

    owner.notifications.unshift({
      id: "NOTIF-" + paymentId,
      title: "សំណើទូទាត់កាត 💳",
      message: `សូមផ្ទៀងផ្ទាត់ការចំណាយចំនួន $${amount} នៅហាង ${shopName}`,
      date: getFormattedDate(),
      isRead: false,
      type: "card_verify",
      paymentId,
    });
    await owner.save();

    res.json({
      success: true,
      paymentId,
      message: "សូមអនុម័តការផ្ទៀងផ្ទាត់ក្នុងកម្មវិធី U-PAY App!",
    });
  } catch (e) {
    res.status(500).json({ success: false });
  }
});

// ==========================================================================
// 💰 ផ្នែកទី ១១៖ ប្រព័ន្ធបញ្ញើមានកាលកំណត់ (FIXED DEPOSIT SYSTEM)
// ==========================================================================
app.post("/api/fixed-deposit/create", async (req, res) => {
  const { accountNumber, amount, duration, currency } = req.body;
  try {
    const user = await User.findOne({
      $or: [{ accountNumber }, { accountNumberKHR: accountNumber }],
    });
    const centralBank = await User.findOne({ accountNumber: "888888888" });
    const isKHR = currency === "KHR";
    const depAmount = parseFloat(amount);

    if (isKHR) {
      if (user.balanceKHR < depAmount)
        return res.json({ success: false, message: "សមតុល្យមិនគ្រប់គ្រាន់!" });
      user.balanceKHR -= depAmount;
      centralBank.balanceKHR += depAmount;
    } else {
      if (user.balance < depAmount)
        return res.json({ success: false, message: "សមតុល្យមិនគ្រប់គ្រាន់!" });
      user.balance -= depAmount;
      centralBank.balance += depAmount;
    }

    const rates = { 3: 0.04, 6: 0.05, 12: 0.06 };
    const rate = rates[duration] || 0.04;
    const interest = depAmount * rate * (duration / 12);

    const newDeposit = {
      id: "DEP-" + Date.now(),
      amount: depAmount,
      duration,
      rate: rate * 100,
      interest,
      currency,
      status: "active",
      startDate: getFormattedDate(),
      maturityDate: new Date(
        Date.now() + duration * 30 * 24 * 60 * 60 * 1000,
      ).toLocaleDateString(),
    };

    if (!user.deposits) user.deposits = [];
    user.deposits.push(newDeposit);

    const refId = "DEP-" + Date.now().toString().slice(-6);
    user.transactions.unshift({
      refId,
      hash: generateHash(),
      date: getFormattedDate(),
      type: "Fixed Deposit Open",
      amount: -depAmount,
      remark: `គណនីសន្សំកាលកំណត់ ${duration} ខែ`,
      status: "Success",
    });

    user.markModified("deposits");
    await user.save();
    await centralBank.save();
    res.json({
      success: true,
      newBalance: isKHR ? user.balanceKHR : user.balance,
    });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

app.post("/api/fixed-deposit/withdraw", async (req, res) => {
  const { accountNumber, depositId } = req.body;
  try {
    const user = await User.findOne({
      $or: [{ accountNumber }, { accountNumberKHR: accountNumber }],
    });
    const centralBank = await User.findOne({ accountNumber: "888888888" });
    const depIndex = user.deposits.findIndex(
      (d) => d.id === depositId && d.status === "active",
    );

    if (depIndex === -1)
      return res.json({
        success: false,
        message: "រកមិនឃើញកញ្ចប់សន្សំសកម្មទេ",
      });
    const dep = user.deposits[depIndex];
    const isKHR = dep.currency === "KHR";
    const totalReturn = dep.amount + dep.interest;

    if (isKHR) {
      centralBank.balanceKHR -= totalReturn;
      user.balanceKHR += totalReturn;
    } else {
      centralBank.balance -= totalReturn;
      user.balance += totalReturn;
    }

    dep.status = "withdrawn";
    user.transactions.unshift({
      refId: "WDL-" + Date.now().toString().slice(-6),
      hash: generateHash(),
      date: getFormattedDate(),
      type: "Fixed Deposit Close",
      amount: totalReturn,
      remark: "ដកប្រាក់សន្សំរួមការប្រាក់",
      status: "Success",
    });

    user.markModified("deposits");
    await user.save();
    await centralBank.save();
    res.json({
      success: true,
      newBalance: isKHR ? user.balanceKHR : user.balance,
    });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// ==========================================================================
// 🎡 ផ្នែកទី ១២៖ មុខងាររង្វាន់ LUCKY SPIN
// ==========================================================================
app.post("/api/lucky-spin/reward", async (req, res) => {
  const { username, amount, refId } = req.body;
  try {
    const user = await User.findOne({ username: username.toLowerCase() });
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
          remark: `Reward for Trx: ${refId || "Spin"}`,
          status: "Success",
          device: "App",
          ip: "127.0.0.1",
        });
        await user.save();
      }
      res.json({ success: true, balance: user.balance });
    } else res.json({ success: false, message: "User not found" });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// ==========================================================================
// 📊 ផ្នែកទី ១៣៖ ស្ថិតិ និងមុខងារ ADMIN DASHBOARD
// ==========================================================================
app.get("/api/admin/stats", async (req, res) => {
  try {
    const users = await User.find({ "transactions.0": { $exists: true } });
    const labels = [];
    const data = Array(7).fill(0);
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      labels.push(
        d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      );
    }
    users.forEach((u) => {
      u.transactions.forEach((t) => {
        const tDate = new Date(t.date).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
        const idx = labels.indexOf(tDate);
        if (idx !== -1) data[idx] += Math.abs(t.amount);
      });
    });
    res.json({ success: true, labels, data });
  } catch (e) {
    res.status(500).json({ success: false, data: [] });
  }
});

app.post("/api/admin/freeze-user", async (req, res) => {
  const { username, isFrozen } = req.body;
  try {
    await User.updateOne(
      { username: username.toLowerCase() },
      { $set: { isFrozen: !!isFrozen, isOnline: false } },
    );
    res.json({ success: true });
  } catch (e) {
    res.json({ success: false });
  }
});

app.get("/api/admin/transaction/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const users = await User.find({});
    let found = null;
    for (const u of users) {
      found = u.transactions.find((t) => t.refId === id || t.hash === id);
      if (found) break;
    }
    if (found) res.json({ success: true, transaction: found });
    else res.json({ success: false, message: "Transaction not found" });
  } catch (e) {
    res.json({ success: false });
  }
});

app.post("/api/admin/adjust-balance", async (req, res) => {
  const { username, currency, type, amount, remark } = req.body;
  try {
    const user = await User.findOne({ username: username.toLowerCase() });
    const centralBank = await User.findOne({ accountNumber: "888888888" });
    const val = parseFloat(amount);
    const isKHR = currency === "KHR";

    if (!user || !centralBank)
      return res.json({ success: false, message: "រកមិនឃើញគណនី!" });

    if (type === "deposit") {
      if (isKHR) {
        user.balanceKHR += val;
        centralBank.balanceKHR -= val;
      } else {
        user.balance += val;
        centralBank.balance -= val;
      }
    } else {
      if (isKHR) {
        user.balanceKHR -= val;
        centralBank.balanceKHR += val;
      } else {
        user.balance -= val;
        centralBank.balance += val;
      }
    }

    const refId = "CB-" + Date.now().toString().slice(-8);
    const hash = generateHash();
    const date = getFormattedDate();

    const userTrx = {
      refId,
      hash,
      date,
      type: type === "deposit" ? "System Deposit" : "System Deduction",
      amount: type === "deposit" ? val : -val,
      senderName: "U-Pay Central Bank",
      remark,
      status: "Success",
    };
    user.transactions.unshift(userTrx);
    user.notifications.unshift({
      id: "NOTIF-" + Date.now(),
      title:
        type === "deposit"
          ? "ប្រព័ន្ធបានបញ្ជូនប្រាក់ 📥"
          : "ប្រព័ន្ធបានកាត់ប្រាក់ 📤",
      message: `${type === "deposit" ? "ទទួលបាន" : "កាត់ប្រាក់"} ចំនួន ${val.toLocaleString()} ${currency} (${remark})`,
      date,
      isRead: false,
    });

    await user.save();
    await centralBank.save();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false });
  }
});

app.post("/api/admin/edit-user", async (req, res) => {
  const { username, fullName, phone, pin, balance, balanceKHR, password } =
    req.body;
  try {
    const u = await User.findOne({ username: username.toLowerCase() });
    if (u) {
      if (fullName) u.fullName = fullName;
      if (phone) u.phone = phone;
      if (pin) u.pin = pin;
      if (balance !== undefined) u.balance = parseFloat(balance);
      if (balanceKHR !== undefined) u.balanceKHR = parseFloat(balanceKHR);
      if (password) u.password = password;
      await u.save();
      res.json({ success: true });
    } else res.json({ success: false, message: "រកមិនឃើញគណនី" });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// ==========================================================================
// 📝 ផ្នែកទី ១៤៖ ប្រព័ន្ធ KYC & TICKETS SUPPORT
// ==========================================================================
app.post("/api/admin/kyc-action", async (req, res) => {
  const { username, action } = req.body;
  try {
    const u = await User.findOne({ username: username.toLowerCase() });
    if (u) {
      u.kycStatus = action;
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
    res.status(500).json({ success: false });
  }
});

app.post("/api/admin/ticket-reply", async (req, res) => {
  const { username, ticketId, replyMessage } = req.body;
  try {
    const u = await User.findOne({ username: username.toLowerCase() });
    if (u && u.tickets) {
      const t = u.tickets.find((tk) => tk.ticketId === ticketId);
      if (t) {
        t.status = "Answered";
        t.adminReply = replyMessage;
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
    res.status(500).json({ success: false });
  }
});

// ==========================================================================
// 🔔 ផ្នែកទី ១៥៖ BROADCAST & NOTIFICATIONS APIS
// ==========================================================================
app.get("/api/user/notifications", async (req, res) => {
  const username = req.query.username;
  if (!username) return res.status(401).json({ error: "មិនទាន់បាន Login" });
  try {
    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user) return res.status(404).json({ error: "រកមិនឃើញគណនី" });
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
    const user = await User.findOne({ username: username.toLowerCase() });
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
                date: getFormattedDate(),
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
    res.status(500).json({ success: false });
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

// ==========================================================================
// 💬 ផ្នែកទី ១៦៖ ប្រព័ន្ធឆាត (UNIFIED CHAT SYSTEM)
// ==========================================================================
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
      return res.json({ success: false, message: "រកមិនឃើញគណនី!" });

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
        const text = message.toLowerCase();
        if (text.includes("human") || text.includes("ភ្នាក់ងារ")) {
          realUser.needsSupport = true;
          await realUser.save();
        }
      }
    }

    const newMessage = new Chat({
      id: "MSG-" + Date.now(),
      senderAcc: sender.accountNumber || "ADMIN",
      receiverAcc: receiver.accountNumber || "ADMIN",
      message,
      adminName: adminName || null,
      time: getFormattedDate(),
      timestamp: Date.now(),
      isRead: false,
    });
    await newMessage.save();
    res.json({ success: true, message: newMessage });
  } catch (err) {
    res.status(500).json({ success: false });
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
    res.json({ success: true, history });
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
      let isValid = true,
        pName = "Unknown",
        pImg = "";

      if (partnerAcc === "ADMIN") {
        pName = "U-PAY Support";
        pImg =
          "https://ui-avatars.com/api/?name=Support&background=004d40&color=fff";
      } else {
        const pInfo = users.find((u) => u.accountNumber === partnerAcc);
        if (pInfo) {
          pName = pInfo.fullName || pInfo.username;
          pImg = pInfo.profileImage;
          if (myAcc === "ADMIN" && !pInfo.needsSupport) isValid = false;
        }
      }

      if (isValid) {
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
            unreadCount,
          };
        }
      }
    }

    const activeContacts = Object.values(contactMap)
      .filter(
        (c) =>
          !(
            myAcc === "ADMIN" &&
            c.lastMessage.includes("ការសន្ទនាត្រូវបានបញ្ចប់ដោយ Admin")
          ),
      )
      .sort((a, b) => b.timestamp - a.timestamp);

    res.json({ success: true, contacts: activeContacts });
  } catch (err) {
    res.status(500).json({ success: false, contacts: [] });
  }
});

// ==========================================================================
// 🔑 ផ្នែកទី ១៧៖ FORGOT PASSWORD & OTP SYSTEM
// ==========================================================================
app.post("/api/forgot-password/verify-user", async (req, res) => {
  const { identifier } = req.body;
  try {
    const user = await User.findOne({
      $or: [{ username: identifier.toLowerCase() }, { phone: identifier }],
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
      otp,
    });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

app.post("/api/forgot-password/reset-password", async (req, res) => {
  const { username, otp, newPassword } = req.body;
  if (!tempForgotOtps[username] || tempForgotOtps[username] !== otp)
    return res.json({ success: false, message: "លេខកូដ OTP មិនត្រឹមត្រូវ!" });
  try {
    const user = await User.findOne({ username });
    if (user) {
      user.password = newPassword;
      await user.save();
      delete tempForgotOtps[username];
      return res.json({
        success: true,
        message: "ពាក្យសម្ងាត់ត្រូវបានប្តូរជោគជ័យ! 🟢",
      });
    }
    res.json({ success: false });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// ==========================================================================
// 🧾 ផ្នែកទី ១៨៖ ប្រព័ន្ធទូទាត់វិក្កយបត្រជាមួយ PAYHUB
// ==========================================================================
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
    res.status(500).json({ success: false });
  }
});

app.post("/api/bank/pay-bill", async (req, res) => {
  const { bill_id, company, amount, username } = req.body;
  try {
    let payingUser = await User.findOne({ username: username.toLowerCase() });
    if (!payingUser)
      return res.status(404).json({ success: false, message: "រកមិនឃើញគណនី!" });
    if (payingUser.balance < amount)
      return res
        .status(400)
        .json({ success: false, message: "សមតុល្យមិនគ្រប់គ្រាន់!" });

    const response = await fetch(`${PAYHUB_URL}/api/gateway/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bill_id }),
    });
    const data = await response.json();

    if (response.ok && data.success) {
      const compRes = await fetch(`${PAYHUB_URL}/api/admin/users`);
      const payhubUsers = await compRes.json();
      const compData = payhubUsers.find(
        (u) => u.name === company && u.role === "company",
      );

      payingUser.balance -= amount;
      const hash = generateCompactHash();
      const refId = `BP-${Date.now()}`;

      payingUser.transactions.unshift({
        refId,
        hash,
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
          companyAccount.balance += net_amount;
          companyAccount.transactions.unshift({
            refId: `SETTLE-${Date.now()}`,
            hash,
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
        transaction_id: refId,
        hash,
      });
    } else res.status(400).json({ success: false, message: data.message });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// ==========================================================================
// 🔍 ផ្នែកទី ១៩៖ API ផ្ទៀងផ្ទាត់គណនី U-PAY
// ==========================================================================
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
    else res.json({ success: false, message: "រកមិនឃើញលេខគណនីនេះទេ!" });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// ==========================================================================
// 🔄 ផ្នែកទី ២០៖ AUTOMATION CRON JOBS (RELEASE HOLD TRXs)
// ==========================================================================
const autoReleaseHold = async () => {
  const now = Date.now();
  try {
    const users = await User.find({
      "transactions.isHold": true,
      "transactions.status": "Pending",
      "transactions.releaseDate": { $lte: now },
    });
    let merchant = await User.findOne({ accountNumber: "100000004" });
    if (!merchant || users.length === 0) return;

    for (let u of users) {
      let changed = false;
      u.transactions.forEach((t) => {
        if (t.isHold && t.status === "Pending" && t.releaseDate <= now) {
          t.status = "Success";
          t.isHold = false;
          const amt = Math.abs(t.amount);
          merchant.balance += amt;
          merchant.transactions.unshift({
            refId: "TRX-" + Date.now().toString().slice(-10),
            hash: generateHash(),
            date: getFormattedDate(),
            type: "Sale Income",
            amount: amt,
            senderName: t.senderName || "Virtual Card",
            status: "Success",
          });
          changed = true;
        }
      });
      if (changed) {
        u.markModified("transactions");
        await u.save();
      }
    }
    await merchant.save();
  } catch (e) {
    console.error("Auto Hold Job Error:", e);
  }
};
setInterval(autoReleaseHold, 10000);

// ==========================================================================
// 🏁 ផ្នែកទី ២១៖ ចាប់ផ្តើមដំណើរការ SERVER
// ==========================================================================
app.listen(PORT, () => {
  console.log(
    `🚀🔥 U-PAY Server is fully loaded and running seamlessly on port ${PORT}`,
  );
});
