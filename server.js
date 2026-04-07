const express = require("express");
const fs = require("fs");
const cors = require("cors");
const path = require("path");
const TelegramBot = require("node-telegram-bot-api");

// 🔥 ថែម multer សម្រាប់ទទួលរូបភាព
const multer = require("multer");

const app = express();
const PORT = 3000;

// កំណត់ទំហំធំដើម្បីទទួលរូបភាព Profile
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(express.static("public"));
app.use(cors());

// 🔥 កំណត់ទីតាំងផ្ទុករូបភាពដែលគេ Upload ចូលមក (Save ចូល /public/uploads/)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, "public", "uploads");
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    // បង្កើតឈ្មោះរូបកុំអោយជាន់គ្នា (ឧទាហរណ៍: 1709123456789.png)
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage: storage });

const DATA_FILE = path.join(__dirname, "data", "users.json");

// --- HELPER FUNCTIONS ---
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

// 🔥 1. បង្កើត Transaction ID (លេខសុទ្ធ ១០ ខ្ទង់)
const generateRefId = () => {
  return Math.floor(1000000000 + Math.random() * 9000000000).toString();
};

// 🔥 2. បង្កើត Hash (អក្សរ + លេខ ៨ ខ្ទង់)
const generateHash = () => {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// --- AUTO INIT BILLERS ---
const initBillers = () => {
  let users = readData();
  const billers = [
    { username: "EDC", accountNumber: "100000001" },
    { username: "PPWSA", accountNumber: "100000002" },
    { username: "Internet", accountNumber: "100000003" },
    { username: "Fashion Shop", accountNumber: "100000004" }, // 🔥 ថែម Fashion Shop នៅទីនេះ
  ];

  let updated = false;
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

  if (updated) writeData(users);
};
initBillers(); // Run on startup

// ==========================================
// 🔥 TELEGRAM BOT SETUP & LOGIC
// ==========================================
// យក Token ពី BotFather មកដាក់ត្រង់នេះ
const token = "8786350689:AAEncWXnaMjzk1QpMyZmo_Censsu4DVHSG0";

// បង្កើត Bot ឱ្យវាចាប់ផ្តើមស្តាប់សារ (polling: true គឺឱ្យវាបើកភ្នែករហូត)
const bot = new TelegramBot(token, { polling: true });

// កូដសម្រាប់ប្រាប់ Bot ពេលមានគេវាយអក្សរចូល Group
bot.on("message", (msg) => {
  const chatId = msg.chat.id; // ចាប់យក ID របស់ Group
  const text = msg.text ? msg.text.trim() : ""; // សារដែលបងវាយ (ឧ. 7570)

  // បើសារនោះមាន ៤ ខ្ទង់ និងជាលេខសុទ្ធ
  if (text.length === 4 && !isNaN(text)) {
    let users = readData();
    let userLinked = false;

    // ស្វែងរក User ណាដែលមាន linkCode ត្រូវនឹងលេខដែលវាយ
    for (let i = 0; i < users.length; i++) {
      if (users[i].linkCode === text) {
        users[i].telegramChatId = chatId; // Save Chat ID
        users[i].linkCode = null; // លុបកូដចោល ការពារកុំឱ្យប្រើម្តងទៀត
        userLinked = true;

        const replyMsg = `🎉 អបអរសាទរ! គណនី U-Pay (<b>${users[i].username}</b>) ត្រូវបានភ្ជាប់មកកាន់ Telegram Group នេះជោគជ័យ។ រាល់ការវេរប្រាក់ចូល នឹងលោតដំណឹងនៅទីនេះ!`;
        bot.sendMessage(chatId, replyMsg, { parse_mode: "HTML" });

        console.log(
          `✅ ភ្ជាប់ជោគជ័យ! Account: ${users[i].username}, Group ID: ${chatId}`,
        );
        break;
      }
    }

    if (userLinked) {
      writeData(users); // Save ចូល Database
    }
  }
});

// API សម្រាប់ Generate លេខកូដ ៤ ខ្ទង់ ពី App (ហៅចេញពី UI Telegram Settings)
app.post("/api/generate-telegram-code", (req, res) => {
  const { username } = req.body;
  let users = readData();
  const userIndex = users.findIndex((u) => u.username === username);

  if (userIndex !== -1) {
    const randomCode = Math.floor(1000 + Math.random() * 9000).toString();
    users[userIndex].linkCode = randomCode; // Save កូដបណ្តោះអាសន្ន
    writeData(users);
    res.json({ success: true, code: randomCode });
  } else {
    res.json({ success: false, message: "User not found" });
  }
});

// API សម្រាប់ ផ្តាច់ Telegram (Unlink)
app.post("/api/unlink-telegram", (req, res) => {
  const { username } = req.body;
  let users = readData();
  const userIndex = users.findIndex((u) => u.username === username);

  if (userIndex !== -1) {
    const oldChatId = users[userIndex].telegramChatId;

    // លុប Chat ID ចេញពី Database
    users[userIndex].telegramChatId = null;
    writeData(users);

    // លោតសារទៅប្រាប់ Group ថាបានផ្តាច់ហើយ
    if (oldChatId) {
      bot
        .sendMessage(
          oldChatId,
          `⚠️ គណនី U-Pay (<b>${username}</b>) ត្រូវបានផ្តាច់ចេញពី Group នេះហើយ!`,
          { parse_mode: "HTML" },
        )
        .catch((e) => console.log(e));
    }

    res.json({ success: true });
  } else {
    res.json({ success: false, message: "User not found" });
  }
});
// ==========================================

// --- AUTH ROUTES ---
// 1. REGISTER
app.post("/api/register", (req, res) => {
  const { username, password, fullName, phone, pin } = req.body;
  let users = readData();

  if (users.find((u) => u.username === username)) {
    return res.json({ success: false, message: "Username already taken!" });
  }

  if (users.find((u) => u.phone === phone)) {
    return res.json({
      success: false,
      message: "Phone number already registered!",
    });
  }

  const newUser = {
    id: Date.now().toString(),
    username: username,
    password: password,
    fullName: fullName || username,
    phone: phone,
    pin: pin,
    accountNumber: Math.floor(100000000 + Math.random() * 900000000).toString(),
    balance: 100.0, // 🔥 ឱ្យលុយចាយហ្វ្រី $100 សម្រាប់តេស្ត
    role: "user",
    trxLimit: 1000.0,
    profileImage: "",
    isFrozen: false,
    pinAttempts: 0,
    transactions: [],
    lastActive: new Date().toISOString(),
    telegramChatId: null, // 🔥 បន្ថែមសម្រាប់ Telegram
    linkCode: null, // 🔥 បន្ថែមសម្រាប់ Telegram
  };

  users.push(newUser);
  writeData(users);
  res.json({ success: true, user: newUser });
});

// 2. LOGIN
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
    user.lastActive = new Date().toISOString();
    writeData(users);
    res.json({ success: true, user });
  } else {
    res.json({ success: false, message: "Invalid Credentials" });
  }
});

// --- TRANSACTION ROUTES ---

// 3. TRANSFER
app.post("/api/transfer", (req, res) => {
  const { senderUsername, receiverAccount, amount, remark, pin, trxMethod } =
    req.body;
  let users = readData();
  const sender = users.find((u) => u.username === senderUsername);
  const receiver = users.find((u) => u.accountNumber === receiverAccount);

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

  if (parseFloat(amount) > sender.trxLimit) {
    return res.json({
      success: false,
      message: `Over Limit! Your limit is $${sender.trxLimit}`,
    });
  }

  if (!receiver)
    return res.json({ success: false, message: "Receiver not found" });
  if (sender.balance < parseFloat(amount))
    return res.json({ success: false, message: "Insufficient Balance" });
  if (sender.accountNumber === receiverAccount)
    return res.json({ success: false, message: "Cannot transfer to self" });

  const transferAmount = parseFloat(amount);
  sender.balance -= transferAmount;
  receiver.balance += transferAmount;

  const date = getFormattedDate();
  const refId = generateRefId();
  const trxHash = generateHash();
  const deviceName = getDevice(req.headers["user-agent"]);
  const ipAddress = req.ip || req.connection.remoteAddress;

  const senderTrx = {
    refId,
    hash: trxHash,
    date,
    type: "Transfer",
    amount: -transferAmount,
    fee: 0.0,
    senderName: sender.username,
    senderAcc: sender.accountNumber,
    receiverName: receiver.username,
    receiverAcc: receiver.accountNumber,
    remark: remark || "General",
    status: "Success",
    device: deviceName,
    ip: ipAddress,
    trxMethod: trxMethod || "Account Input",
  };

  const receiverTrx = {
    ...senderTrx,
    amount: transferAmount,
    type: "Received",
  };

  sender.transactions.unshift(senderTrx);
  receiver.transactions.unshift(receiverTrx);

  // 🔥 ថែមកូដបញ្ជូនសារ (Notification) ចូលប្រអប់កណ្ដឹងអ្នកទទួល
  if (!receiver.notifications) receiver.notifications = [];
  receiver.notifications.unshift({
    id: "NOTIF-" + Date.now(),
    title: "Money Received!",
    message: `You have received $${transferAmount.toFixed(2)} from ${sender.fullName || sender.username}.`,
    date: date,
    isRead: false, // ដាក់ពណ៌ក្រហម (មិនទាន់អាន)
  });

  writeData(users);

  // 🔥 បាញ់សារទៅ Telegram បើអ្នកទទួលមានភ្ជាប់ Group
  if (receiver.telegramChatId) {
    const alertMsg = `
🔔 <b>ប្រាក់ចូល (Money Received)</b> 🔔
━━━━━━━━━━━━━━━━━━━━
💰 <b>ចំនួនទឹកប្រាក់៖</b> +$${transferAmount.toFixed(2)}
📥 <b>ចូលគណនី៖</b> ${receiver.fullName || receiver.username}
📤 <b>ពីគណនី៖</b> ${sender.fullName || sender.username}
🧾 <b>លេខប្រតិបត្តិការ៖</b> ${refId}
⏰ <b>កាលបរិច្ឆេទ៖</b> ${date}
📝 <b>ចំណាំ៖</b> ${remark || "គ្មាន"}
━━━━━━━━━━━━━━━━━━━━
✅ <i>ប្រតិបត្តិការជោគជ័យ (U-Pay)</i>
    `;
    // កុំភ្លេចប្រាកដថាអថេរ `bot` ដើរជាធម្មតានៅទីនេះ
    if (typeof bot !== "undefined") {
      bot
        .sendMessage(receiver.telegramChatId, alertMsg, { parse_mode: "HTML" })
        .catch((err) => console.error("Telegram Alert Error:", err));
    }
  }

  res.json({ success: true, newBalance: sender.balance, slipData: senderTrx });
});

// 4. BILL PAYMENT
app.post("/api/payment", (req, res) => {
  const { username, billerName, billId, amount, pin } = req.body;
  let users = readData();
  const user = users.find((u) => u.username === username);
  const biller = users.find((u) => u.username === billerName);

  if (!user) return res.json({ success: false, message: "User Error" });
  if (!biller) return res.json({ success: false, message: "Biller Not Found" });
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
        message: "Wrong PIN 3 times! Account Frozen.",
      });
    }
    writeData(users);
    return res.json({ success: false, message: "Wrong PIN" });
  }
  user.pinAttempts = 0;

  if (parseFloat(amount) > user.trxLimit)
    return res.json({
      success: false,
      message: `Over Limit! Your limit is $${user.trxLimit}`,
    });
  if (user.balance < parseFloat(amount))
    return res.json({ success: false, message: "Insufficient Balance" });

  const payAmount = parseFloat(amount);
  user.balance -= payAmount;
  biller.balance += payAmount;

  const refId = generateRefId();
  const trxHash = generateHash();
  const date = getFormattedDate();
  const deviceName = getDevice(req.headers["user-agent"]);

  const trx = {
    refId,
    hash: trxHash,
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
    device: deviceName,
    ip: req.ip,
  };

  user.transactions.unshift(trx);
  biller.transactions.unshift({
    ...trx,
    amount: payAmount,
    type: "Income (Bill)",
  });

  writeData(users);

  // 🔥 បន្ថែមកូដ Alert Telegram សម្រាប់ Bill Payment នៅទីនេះ!
  if (biller.telegramChatId) {
    const alertMsg = `
🔔 <b>វិក្កយបត្របានទូទាត់ (Bill Received)</b> 🔔
━━━━━━━━━━━━━━━━━━━━
💰 <b>ចំនួនទឹកប្រាក់៖</b> +$${payAmount.toFixed(2)}
🏢 <b>ចូលគណនី (ហាង)៖</b> ${biller.fullName || biller.username}
👤 <b>ពីអតិថិជន៖</b> ${user.fullName || user.username}
🧾 <b>លេខវិក្កយបត្រ៖</b> ${billId}
🏷️ <b>លេខប្រតិបត្តិការ៖</b> ${refId}
⏰ <b>កាលបរិច្ឆេទ៖</b> ${date}
━━━━━━━━━━━━━━━━━━━━
✅ <i>ប្រតិបត្តិការជោគជ័យ (U-Pay)</i>
    `;
    bot
      .sendMessage(biller.telegramChatId, alertMsg, { parse_mode: "HTML" })
      .catch((err) => console.error("Telegram Alert Error:", err));
  }

  res.json({ success: true, newBalance: user.balance, slipData: trx });
});

// --- SETTINGS ROUTES ---
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

// 🔥 API ចាស់ដែលត្រូវលុបចោល ហើយប្រើ API `upload-image` ថ្មីជំនួស
// app.post("/api/update-profile-pic", ...) => ជំនួសដោយខាងក្រោម៖

app.post("/api/user/upload-image", upload.single("profileImg"), (req, res) => {
  const userId = req.body.id;

  if (!req.file) {
    return res.json({ success: false, message: "No image uploaded" });
  }

  // បង្កើត URL សម្រាប់បង្ហាញរូបភាពដែលបាន Upload
  const imageUrl = "/uploads/" + req.file.filename;

  let users = readData();
  const userIndex = users.findIndex((u) => u.id === userId);

  if (userIndex !== -1) {
    users[userIndex].profileImage = imageUrl;
    writeData(users);
    res.json({ success: true, imageUrl: imageUrl });
  } else {
    res.json({ success: false, message: "User not found" });
  }
});

// --- ADMIN ROUTES ---
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

app.post("/api/admin/edit-user", (req, res) => {
  const { id, username, balance, pin, profileImage, accountNumber, password } =
    req.body;
  let users = readData();
  const u = users.find((user) => user.id === id);
  if (u) {
    u.username = username;
    u.accountNumber = accountNumber;
    u.balance = parseFloat(balance);
    u.pin = pin;
    u.profileImage = profileImage;
    if (password && password.trim() !== "") u.password = password;
    writeData(users);
    res.json({ success: true });
  } else res.json({ success: false });
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

app.post("/api/admin/add-money", (req, res) => {
  const { id, amount, note } = req.body;
  let users = readData();
  const u = users.find((user) => user.id === id);

  if (u) {
    const depositAmount = parseFloat(amount);
    u.balance += depositAmount;

    const date = getFormattedDate();
    const refId = "DEP" + Math.floor(Math.random() * 1000000);

    const depositTrx = {
      refId: refId,
      hash: "HSH" + Math.random().toString(36).substring(7).toUpperCase(),
      date: date,
      type: "Received", // ដើម្បីឱ្យ isSender ស្មើ false (t.amount > 0)
      amount: depositAmount,
      senderName: "CASH DEPOSIT", // នឹងបង្ហាញក្នុង slipSenderName
      senderAcc: "SYSTEM",
      receiverName: u.fullName || u.username, // នឹងបង្ហាញក្នុង slipReceiverName
      receiverAcc: u.accountNumber,
      remark: note || "Admin Deposit",
      status: "Success", // 🔥 សំខាន់បំផុត! បើអត់មានជួរនេះ slipTitle នឹងលោតថា "Failed"
      trxMethod: "U-PAY System",
    };

    if (!u.transactions) u.transactions = [];
    u.transactions.unshift(depositTrx);

    // 🔔 ឱ្យលោតកណ្ដឹងទៅ User
    if (!u.notifications) u.notifications = [];
    u.notifications.unshift({
      id: "NOTIF-" + Date.now(),
      title: "Deposit Received",
      message: `+$${depositAmount.toFixed(2)} credited to your account.`,
      date: date,
      isRead: false,
    });

    writeData(users);
    res.json({ success: true, message: "Deposit Success" });
  } else {
    res.json({ success: false, message: "User not found" });
  }
});

// 🔥 API សម្រាប់ទាញយក System Revenue និង Recent Activity (Fixed Sorting & Duplicates)
app.get("/api/admin/dashboard-extra", (req, res) => {
  try {
    const users = readData();
    let totalRevenue = 0;
    let allActivities = [];

    users.forEach((user) => {
      // ១. គណនាចំណូលសរុប (តែងតែបូក)
      if (user.transactions) {
        user.transactions.forEach((t) => {
          if (t.fee) totalRevenue += parseFloat(t.fee) || 0;
          // បូកចំណូលពីការបង្កើតកាតចូល Revenue ដែរ បើកុងនោះជាកុង Admin Fee
          if (
            user.accountNumber === "999999999" &&
            t.type === "System Income"
          ) {
            totalRevenue += parseFloat(t.amount) || 0;
          }
        });
      }

      // 🔥 រំលងកុង Admin មិនបាច់យកមកបង្ហាញក្នុង Activity ទេ ដើម្បីកុំឱ្យលោតជាន់គ្នា ២ ដង
      if (user.accountNumber === "999999999" || user.role === "system") return;

      // ២. ទាញយក Activity ពី Transactions របស់ Users ធម្មតា
      if (user.transactions) {
        user.transactions.forEach((t) => {
          // 🔥 ចាប់យកម៉ោងពិតពី t.date បើអត់ម៉ោង ឱ្យវាស្មើ ០ (ធ្លាក់ទៅក្រោមគេ)
          let rawDate = new Date(t.date).getTime();
          if (isNaN(rawDate)) {
            // ព្យាយាមទាញពី ID បើ date ទាញមិនបាន
            if (t.refId && t.refId.includes("-")) {
              rawDate = parseInt(t.refId.split("-")[1]) || 0;
            } else {
              rawDate = 0;
            }
          }

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

      // ៣. ទាញយក Activity ពីការបង្កើតកាតថ្មី (Virtual Cards)
      if (user.virtualCards) {
        user.virtualCards.forEach((card) => {
          let rawDate = 0;
          if (card.id && card.id.includes("_")) {
            rawDate = parseInt(card.id.split("_")[1]) || 0;
          }

          if (rawDate > 0) {
            // បង្ហាញតែកាតណាដែលមានម៉ោងច្បាស់លាស់
            let niceDate = new Date(rawDate).toLocaleString("en-US", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            });
            allActivities.push({
              type: "Card Created",
              user: user.username,
              amount: 0,
              date: niceDate,
              receiver: "N/A",
              rawDate: rawDate,
            });
          }
        });
      }
    });

    // ៤. តម្រៀប Activity ពីធំទៅតូច (ថ្មីបំផុត នៅលើគេ)
    allActivities.sort((a, b) => b.rawDate - a.rawDate);
    const recentActivities = allActivities.slice(0, 10);

    res.json({
      success: true,
      revenue: totalRevenue,
      activities: recentActivities,
    });
  } catch (error) {
    console.error("❌ Dashboard Extra Error:", error);
    res.json({ success: false, revenue: 0, activities: [] });
  }
});

// Common
app.get("/api/users", (req, res) => res.json(readData()));
app.post("/api/check-account", (req, res) => {
  const { accountNumber } = req.body;
  const u = readData().find((user) => user.accountNumber === accountNumber);
  res.json(u ? { success: true, username: u.username } : { success: false });
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

app.post("/api/user/change-password", (req, res) => {
  const { id, oldPassword, newPassword } = req.body;
  let users = readData();
  const u = users.find((user) => user.id === id);
  if (u && u.password === oldPassword) {
    u.password = newPassword;
    writeData(users);
    res.json({ success: true });
  } else res.json({ success: false, message: "Incorrect old password!" });
});

app.post("/api/user/change-pin", (req, res) => {
  const { id, oldPin, newPin } = req.body;
  let users = readData();
  const u = users.find((user) => user.id === id);
  if (u && u.pin === oldPin) {
    if (newPin.length !== 4)
      return res.json({ success: false, message: "PIN must be 4 digits" });
    u.pin = newPin;
    writeData(users);
    res.json({ success: true });
  } else res.json({ success: false, message: "Incorrect old PIN!" });
});

// 🔥 API សម្រាប់កែប្រែឈ្មោះ និង លេខទូរស័ព្ទ (Edit Profile)
function generateLuhnNumber(prefix) {
  let num = prefix; // "4215"

  // 1. បង្កើតលេខចៃដន្យឱ្យបាន ១៥ ខ្ទង់
  while (num.length < 15) {
    num += Math.floor(Math.random() * 10).toString();
  }

  // 2. គណនា Sum តាមច្បាប់ Luhn (រាប់ពីឆ្វេងទៅស្តាំ)
  let sum = 0;
  for (let i = 0; i < num.length; i++) {
    let digit = parseInt(num[i]);

    // ច្បាប់៖ បើចំនួនខ្ទង់សរុបគឺ ១៦ នោះខ្ទង់ទី ១, ៣, ៥, ៧... (Index គូ 0, 2, 4...) ត្រូវគុណនឹង ២
    if (i % 2 === 0) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }

  // 3. គណនា Check Digit (ខ្ទង់ទី ១៦) ដើម្បីឱ្យ Sum សរុបបូកជាមួយវាហើយចែកដាច់នឹង ១០
  // រូបមន្ត៖ (10 - (sum % 10)) % 10
  let checkDigit = (10 - (sum % 10)) % 10;

  const finalCardNumber = num + checkDigit.toString();

  console.log(
    "🚀 New Card Generated:",
    finalCardNumber,
    "| CheckSum:",
    sum + checkDigit,
  );
  return finalCardNumber;
}

app.post("/api/card/generate", (req, res) => {
  // 🔥 ថែម pin ដែលបោះមកពី Client
  const { username, cardType, pin } = req.body;
  let users = readData();
  const userIndex = users.findIndex((u) => u.username === username);

  if (userIndex !== -1) {
    let user = users[userIndex];

    // ==========================================
    // ១. ផ្ទៀងផ្ទាត់ PIN និង សមតុល្យទឹកប្រាក់ (ថ្មី)
    // ==========================================
    if (user.pin !== pin) {
      return res.json({ success: false, message: "លេខ PIN មិនត្រឹមត្រូវទេ!" });
    }

    const FEE_AMOUNT = 5.0; // ថ្លៃសេវា ៥ ដុល្លារ
    if (user.balance < FEE_AMOUNT) {
      return res.json({
        success: false,
        message: `សមតុល្យមិនគ្រប់គ្រាន់ទេ! ថ្លៃសេវាបង្កើតកាតគឺ $${FEE_AMOUNT.toFixed(2)}`,
      });
    }

    // ==========================================
    // ២. ឆែកលក្ខខណ្ឌចំនួនកាត (កូដចាស់របស់បង)
    // ==========================================
    if (!user.virtualCards) {
      user.virtualCards = [];
      if (user.virtualCard) {
        user.virtualCards.push(user.virtualCard);
        delete user.virtualCard;
      }
    }

    if (user.virtualCards.length >= 3) {
      return res.json({
        success: false,
        message: "Limit reached (Max 3 cards)",
      });
    }

    // ==========================================
    // ៣. ដំណើរការកាត់លុយ និងបូកចូល U-PAY Fee (ថ្មី)
    // ==========================================
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

    user.balance -= FEE_AMOUNT; // កាត់ ៥$ ពីអ្នកប្រើ
    feeAccount.balance += FEE_AMOUNT; // បូក ៥$ ចូលប្រព័ន្ធ

    // កត់ត្រា Transaction ឱ្យម្ចាស់កាត
    const dateStr = getFormattedDate();
    const refId = "FEE-" + Date.now();
    const hash = generateHash();

    if (!user.transactions) user.transactions = [];
    user.transactions.unshift({
      refId: refId,
      hash: hash,
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

    // កត់ត្រាចំណូលចូល Admin (U-PAY Fee)
    if (!feeAccount.transactions) feeAccount.transactions = [];
    feeAccount.transactions.unshift({
      refId: refId,
      hash: hash,
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
    // ៤. បង្កើតកាតថ្មី (កូដចាស់របស់បងរក្សាទុកដដែល)
    // ==========================================
    const prefix = cardType === "platinum" ? "4305" : "4215";
    const cardNumber = generateLuhnNumber(prefix);

    const d = new Date();
    const expiry =
      ("0" + (d.getMonth() + 1)).slice(-2) +
      "/" +
      (d.getFullYear() + 3).toString().slice(-2);
    const cvv = Math.floor(100 + Math.random() * 900).toString();

    const newCard = {
      id: "card_" + Date.now(),
      type: cardType || "visa_classic",
      number: cardNumber,
      expiry: expiry,
      cvv: cvv,
      pin: "1234",
      isLocked: false,
      isOnlinePayEnabled: true, // Default បើក
      dailyLimit: 500.0, // 🔥 ថែម Daily Spending Limit $500 ជា Default
    };

    user.virtualCards.push(newCard);

    // Save ទិន្នន័យទាំងអស់ចូល File
    writeData(users);

    // 🔥 ត្រឡប់ newBalance ទៅវិញ ដើម្បីឱ្យកាបូបលុយខាងមុខធ្លាក់ចុះ $5 ភ្លាមៗ
    res.json({
      success: true,
      cards: user.virtualCards,
      newBalance: user.balance,
    });
  } else {
    res.json({ success: false, message: "User not found" });
  }
});

// 2. API សម្រាប់ Lock/Unlock កាត (តាម ID កាត)
app.post("/api/card/toggle-lock", (req, res) => {
  const { username, cardId, isLocked } = req.body;
  let users = readData();
  const userIndex = users.findIndex((u) => u.username === username);

  if (userIndex !== -1 && users[userIndex].virtualCards) {
    const cardIndex = users[userIndex].virtualCards.findIndex(
      (c) => c.id === cardId,
    );
    if (cardIndex !== -1) {
      users[userIndex].virtualCards[cardIndex].isLocked = isLocked;
      writeData(users);
      return res.json({ success: true, cards: users[userIndex].virtualCards });
    }
  }
  res.json({ success: false, message: "Card not found" });
});

// 🔥 API សម្រាប់បើក/បិទ ការទូទាត់អនឡាញ (Online Payments)
app.post("/api/card/toggle-online-pay", (req, res) => {
  const { username, cardId, isEnabled } = req.body;
  let users = readData();
  const userIndex = users.findIndex((u) => u.username === username);

  if (userIndex !== -1 && users[userIndex].virtualCards) {
    const cardIndex = users[userIndex].virtualCards.findIndex(
      (c) => c.id === cardId,
    );
    if (cardIndex !== -1) {
      // រក្សាទុកស្ថានភាពចូលក្នុង Database
      users[userIndex].virtualCards[cardIndex].isOnlinePayEnabled = isEnabled;
      writeData(users);
      return res.json({ success: true, cards: users[userIndex].virtualCards });
    }
  }
  res.json({ success: false, message: "បានបិទការទូទាត់អនឡាញ!" });
});

// 🔥 API សម្រាប់ប្តូរលេខ PIN របស់កាត
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
    if (newPin.length !== 4)
      return res.json({
        success: false,
        message: "PIN ថ្មីត្រូវតែមាន ៤ខ្ទង់!",
      });

    card.pin = newPin; // ប្តូរ PIN ថ្មី
    writeData(users);
    res.json({ success: true, message: "ប្តូរលេខ PIN កាតជោគជ័យ!" });
  } else {
    res.json({ success: false, message: "រកមិនឃើញអ្នកប្រើប្រាស់!" });
  }
});

// 3. API សម្រាប់ លុបកាតចោល (Close Card)
app.post("/api/card/delete", (req, res) => {
  const { username, cardId, reason } = req.body;
  let users = readData();
  const userIndex = users.findIndex((u) => u.username === username);

  if (userIndex !== -1 && users[userIndex].virtualCards) {
    const initialCount = users[userIndex].virtualCards.length;

    // 🔥 កែសម្រួលត្រង់នេះ៖ លុបកាតចេញពី Array ដោយប្រើ filter ធៀបនឹង ID
    users[userIndex].virtualCards = users[userIndex].virtualCards.filter(
      (c) => c.id !== cardId,
    );

    // ពិនិត្យមើលថា តើមានកាតត្រូវបានលុបមែនដែរឬទេ
    if (users[userIndex].virtualCards.length < initialCount) {
      writeData(users);
      console.log(
        `🗑️ Card ${cardId} deleted for ${username}. Reason: ${reason}`,
      );
      return res.json({ success: true, cards: users[userIndex].virtualCards });
    } else {
      return res.json({
        success: false,
        message: "រកមិនឃើញកាតដែលត្រូវលុបឡើយ (ID mismatch)",
      });
    }
  }
  res.json({ success: false, message: "រកមិនឃើញអ្នកប្រើប្រាស់!" });
});

// ==========================================
// 🔥 SAVING GOALS APIS (កូនជ្រូកសន្សំប្រាក់)
// ==========================================

// បង្កើតកូនជ្រូកថ្មី
app.post("/api/savings/create", (req, res) => {
  const { username, goalName, targetAmount } = req.body;
  let users = readData();
  const userIndex = users.findIndex((u) => u.username === username);

  if (userIndex !== -1) {
    if (!users[userIndex].savings) users[userIndex].savings = [];

    const newGoal = {
      id: "goal_" + Date.now(),
      name: goalName,
      target: parseFloat(targetAmount),
      current: 0,
      status: "active",
      createdAt: new Date().toISOString(),
    };

    users[userIndex].savings.push(newGoal);
    writeData(users);
    res.json({ success: true, savings: users[userIndex].savings });
  } else {
    res.json({ success: false, message: "User not found" });
  }
});

// ដាក់លុយចូលកូនជ្រូក (កាត់ពី Balance គោល)
app.post("/api/savings/deposit", (req, res) => {
  const { username, goalId, amount } = req.body;
  let users = readData();
  const user = users.find((u) => u.username === username);

  if (user) {
    const depositAmount = parseFloat(amount);
    if (user.balance < depositAmount) {
      return res.json({
        success: false,
        message: "Insufficient main balance!",
      });
    }

    if (!user.savings) user.savings = [];
    const goal = user.savings.find((g) => g.id === goalId);

    if (goal) {
      user.balance -= depositAmount; // កាត់លុយពីកុងធំ
      goal.current += depositAmount; // បញ្ចូលលុយទៅកូនជ្រូក

      // កត់ត្រាចូលប្រវត្តិប្រតិបត្តិការ
      const refId = generateRefId();
      const trxHash = generateHash();
      user.transactions.unshift({
        refId,
        hash: trxHash,
        date: getFormattedDate(),
        type: "Saving Deposit",
        amount: -depositAmount,
        fee: 0,
        senderName: user.username,
        receiverName: `Piggy Bank: ${goal.name}`,
        remark: "Saved to Goal",
        status: "Success",
        device: "App",
        ip: "127.0.0.1",
      });

      writeData(users);
      res.json({ success: true, balance: user.balance, savings: user.savings });
    } else {
      res.json({ success: false, message: "Goal not found" });
    }
  } else {
    res.json({ success: false, message: "User not found" });
  }
});
// ដកលុយពីកូនជ្រូក (វាយបំបែកកូនជ្រូក)
app.post("/api/savings/break", (req, res) => {
  const { username, goalId } = req.body;
  let users = readData();
  const user = users.find((u) => u.username === username);

  if (user && user.savings) {
    const goalIndex = user.savings.findIndex((g) => g.id === goalId);
    if (goalIndex !== -1) {
      const goal = user.savings[goalIndex];
      const refundAmount = goal.current;

      // បើមានលុយក្នុងហ្នឹង បូកចូលកុងធំវិញ
      if (refundAmount > 0) {
        user.balance += refundAmount;

        // កត់ត្រាចូលប្រវត្តិប្រតិបត្តិការថា លុយចូល
        const refId = generateRefId();
        const trxHash = generateHash();
        user.transactions.unshift({
          refId,
          hash: trxHash,
          date: getFormattedDate(),
          type: "Saving Withdrawal",
          amount: refundAmount,
          fee: 0,
          senderName: `Piggy Bank (${goal.name})`,
          receiverName: user.username,
          remark: "Broke Piggy Bank",
          status: "Success",
          device: "App",
          ip: "127.0.0.1",
        });
      }

      // លុបកូនជ្រូកនោះចោល
      user.savings.splice(goalIndex, 1);
      writeData(users);

      res.json({
        success: true,
        balance: user.balance,
        savings: user.savings,
        amount: refundAmount,
      });
    } else {
      res.json({ success: false, message: "Goal not found" });
    }
  } else {
    res.json({ success: false, message: "User not found" });
  }
});

// ==========================================
// 🔥 CASHBACK & REWARDS API (កងវិលផ្សងសំណាង)
// ==========================================
app.post("/api/reward/cashback", (req, res) => {
  const { username, amount, refId } = req.body;
  let users = readData();
  const user = users.find((u) => u.username === username);

  if (user) {
    const reward = parseFloat(amount);
    if (reward > 0) {
      user.balance += reward; // បូកលុយចូលកុង

      const trxHash = generateHash();
      user.transactions.unshift({
        refId: "RWD-" + Date.now().toString().slice(-6),
        hash: trxHash,
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
  } else {
    res.json({ success: false });
  }
});
// 🔥 ផ្ទុកសំណើបង់ប្រាក់ដែលកំពុងរង់ចាំការ Confirm
let pendingPayments = [];

// ១. API សម្រាប់ Shop ផ្ញើសំណើរបង់ប្រាក់មក U-Pay (រកម្ចាស់កាត)
app.post("/api/card/request-payment", (req, res) => {
  const { cardNumber, expiry, cvv, amount, orderId, shopName } = req.body;
  let users = readData();

  let owner = null;
  let targetCard = null;

  // ១. ស្វែងរកម្ចាស់កាត និងព័ត៌មានកាត
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

  // ២. ឆែកមើលស្ថានភាពបង្កក (Freeze Card)
  if (targetCard.isLocked) {
    return res.json({
      success: false,
      message: "កាតនេះត្រូវបានបង្កក (Frozen)! សូមដោះលែងកាតជាមុនសិន។",
    });
  }

  // ៣. ឆែកមើលស្ថានភាព Online Payments
  if (targetCard.isOnlinePayEnabled === false) {
    return res.json({
      success: false,
      message: "ការទូទាត់អនឡាញត្រូវបានបិទសម្រាប់កាតនេះ។",
    });
  }

  // 🔥 ៤. មុខងារ Daily Spending Limit
  const limit = targetCard.dailyLimit || 500;
  const today = new Date().toLocaleDateString("en-US", {
    timeZone: "Asia/Phnom_Penh",
  });

  const totalSpentToday = (owner.transactions || [])
    .filter(
      (t) =>
        t.cardId === targetCard.id &&
        t.type === "Card Payment" &&
        t.date.includes(today),
    )
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  if (totalSpentToday + parseFloat(amount) > limit) {
    return res.json({
      success: false,
      message: `លើសកម្រិតចំណាយប្រចាំថ្ងៃ! (Limit: $${limit}, ចាយរួច: $${totalSpentToday.toFixed(2)})`,
    });
  }

  // ៥. ឆែកសមតុល្យលុយក្នុងកុង
  if (owner.balance < amount)
    return res.json({ success: false, message: "សមតុល្យមិនគ្រប់គ្រាន់!" });

  // ៦. បង្កើតសំណើបង់ប្រាក់ក្នុងបញ្ជី Pending
  const paymentId = "PAY-" + Date.now();
  pendingPayments.push({
    paymentId,
    cardNumber,
    amount: parseFloat(amount),
    orderId,
    shopName,
    // 🔥 កែប្រែត្រង់នេះ៖ បង្ខំឱ្យរក្សាទុក username ជាអក្សរតូចទាំងអស់ ដើម្បីកុំឱ្យច្រឡំជាមួយ App
    username: owner.username.toLowerCase(),
    status: "pending",
    date: getFormattedDate(),
  });

  console.log(
    `✅ [New Request] User: ${owner.username.toLowerCase()} | Amount: $${amount}`,
  );
  res.json({ success: true, paymentId: paymentId });
});

// ២. API សម្រាប់ឱ្យ App ឆែកមើលថាតើមានសំណើណាត្រូវ Confirm ដែរឬទេ (ហៅពី Dashboard)
app.get("/api/user/pending-payments/:username", (req, res) => {
  const searchUsername = req.params.username.toLowerCase(); // បំប្លែងជាអក្សរតូច
  const list = pendingPayments.filter(
    (p) =>
      p.username.toLowerCase() === searchUsername && p.status === "pending",
  );
  res.json({ success: true, pending: list });
});

// ៣. API សម្រាប់ឱ្យ User វាយ PIN ដើម្បី Confirm (ប្រើ Card PIN ផ្សេងពី Account PIN)
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

  // 🚀 ទាញយកព័ត៌មាន Device និង IP
  const userIP =
    req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1";
  const userDevice = req.headers["user-agent"] || "Unknown Device";

  // ១. កាត់លុយពី User
  user.balance -= payment.amount;

  // ២. បូកលុយឱ្យហាង Fashion Shop (100000004)
  const merchant = users.find((u) => u.accountNumber === "100000004");
  if (merchant) {
    merchant.balance += payment.amount;
    if (!merchant.transactions) merchant.transactions = [];
    merchant.transactions.unshift({
      refId: "REV-" + Date.now(),
      date: getFormattedDate(),
      type: "Sale Income",
      amount: payment.amount,
      senderName: user.fullName,
      senderAccount: user.accountNumber,
      senderCard: `**** **** **** ${payment.cardNumber.slice(-4)}`,
      status: "Success",
    });
  }

  // ៣. កត់ត្រាឱ្យ User (សម្រាប់ Admin ឆែកមើល DETAILS)
  user.transactions.unshift({
    refId: paymentId,
    hash: generateHash(),
    date: getFormattedDate(),
    type: "Card Payment",
    amount: -payment.amount,
    senderName: user.fullName || user.username,
    senderAccount: payment.cardNumber, // បង្ហាញលេខកាតក្នុង Account របស់ Admin
    receiverName: payment.shopName,
    receiverAccount: "100000004",
    device: userDevice,
    ip: userIP,
    cardId: usedCard.id,
    status: "Success",
    trxMethod: "Virtual Card",
    isHold: true,
    releaseDate: Date.now() + 1 * 60 * 1000,
  });

  // ៤. ប្តូរ Status និងរក្សាទុកទិន្នន័យ
  pendingPayments[payIndex].status = "success";
  writeData(users);

  // ៥. ផ្ញើ Response ត្រឡប់ទៅវិញ
  res.json({ success: true, message: "ការទូទាត់ជោគជ័យ!" });
}); // <--- ត្រូវប្រាកដថាមានសញ្ញានេះបិទជានិច្ច

// 🔥 API សម្រាប់ប្តូរលំដាប់កំណត់ចំណាយប្រចាំថ្ងៃ (Daily Limit) តាមកាត
app.post("/api/card/update-limit", (req, res) => {
  const { username, cardId, newLimit } = req.body;
  let users = readData();
  const user = users.find((u) => u.username === username);

  if (user && user.virtualCards) {
    const card = user.virtualCards.find((c) => c.id === cardId);
    if (card) {
      card.dailyLimit = parseFloat(newLimit); // Save តម្លៃថ្មី
      writeData(users);
      return res.json({ success: true, cards: user.virtualCards });
    }
  }
  res.json({ success: false, message: "រកមិនឃើញកាត!" });
});

// 🔥 API សម្រាប់បដិសេធការបង់ប្រាក់ (Decline Payment)
app.post("/api/card/decline-payment", (req, res) => {
  const { paymentId } = req.body;
  const payIndex = pendingPayments.findIndex((p) => p.paymentId === paymentId);

  if (payIndex !== -1) {
    // ប្តូរ Status ទៅជា declined ដើម្បីកុំឱ្យវាលោតសួរទៀត
    pendingPayments[payIndex].status = "declined";
    console.log(`❌ Payment ${paymentId} was Declined by user.`);
    return res.json({ success: true });
  }
  res.json({ success: false, message: "រកមិនឃើញសំណើបង់ប្រាក់!" });
});

// 🔥 មុខងារសម្រាប់ដោះលែងលុយដែលបង្កក (Auto Release Hold)
const autoReleaseHold = () => {
  let users = readData(); // អានទិន្នន័យពី JSON
  let hasChange = false;
  const now = Date.now();

  users.forEach((u) => {
    if (u.transactions) {
      u.transactions.forEach((t) => {
        // លក្ខខណ្ឌ៖ ត្រូវតែជា Hold + Pending + ដល់ម៉ោងកំណត់
        if (
          t.isHold &&
          t.status === "Pending" &&
          t.releaseDate &&
          t.releaseDate <= now
        ) {
          t.status = "Success";
          t.isHold = false;
          hasChange = true;
          console.log(
            `✅ [RELEASED] Order: ${t.refId} for user: ${u.username}`,
          );
        }
      });
    }
  });

  if (hasChange) {
    writeData(users); // សរសេរចូល JSON វិញ
    console.log("💾 Database updated with released transactions.");
  }
};

// ឱ្យវាដើររៀងរាល់ ១០ វិនាទី (សម្រាប់ Test)
setInterval(autoReleaseHold, 10000);

// ៤. API សម្រាប់ឱ្យ Shop តាមដាន Status រហូតដល់ User ចុច Confirm
app.get("/api/card/check-status/:paymentId", (req, res) => {
  const pay = pendingPayments.find((p) => p.paymentId === req.params.paymentId);
  res.json({ success: true, status: pay ? pay.status : "expired" });
});

// 🔥 ១. API សម្រាប់ Admin ផ្ញើសារ (Broadcast) ទៅកាន់គ្រប់ User
app.post("/api/admin/broadcast", (req, res) => {
  const { title, message } = req.body;
  let users = readData();
  let count = 0;

  users.forEach((user) => {
    if (user.role !== "admin") {
      // ក. បញ្ចូលទៅក្នុងប្រអប់កណ្ដឹង (Notifications)
      if (!user.notifications) user.notifications = [];
      user.notifications.unshift({
        id: "NOTIF-" + Date.now(),
        title: title,
        message: message,
        date: getFormattedDate(),
        isRead: false,
      });

      // // ខ. បញ្ចូលទៅក្នុងប្រវត្តិ History (Transactions) ឱ្យ User ឃើញ
      // if (!user.transactions) user.transactions = [];
      // user.transactions.unshift({
      //   refId: "MSG-" + Date.now(),
      //   hash: generateHash(),
      //   date: getFormattedDate(),
      //   type: "System Message",
      //   amount: 0, // លុយ $0.00 ព្រោះជាសារប្រកាស
      //   senderName: "U-PAY Admin",
      //   senderAccount: "System",
      //   receiverName: user.fullName || user.username,
      //   receiverAccount: user.accountNumber,
      //   status: "Info",
      //   trxMethod: "Broadcast",
      //   note: message, // ទុកសារនៅទីនេះ
      // });
      count++;
    }
  });

  writeData(users);
  res.json({ success: true, count: count });
});

// 🔥 ២. API សម្រាប់ User ចុចអានសារ (លុបសញ្ញាកណ្ដឹងក្រហមចេញ)
app.post("/api/user/read-notifications", (req, res) => {
  const { username } = req.body;
  let users = readData();
  let user = users.find((u) => u.username === username);

  if (user && user.notifications) {
    user.notifications.forEach((n) => (n.isRead = true)); // ប្តូរទៅជាអានរួច
    writeData(users);
    res.json({ success: true });
  } else {
    res.json({ success: false });
  }
});

// 🔥 API សម្រាប់លុបសារដែលបានផ្ញើចេញ (Delete Broadcast)
app.post("/api/admin/delete-broadcast", (req, res) => {
  const { notifId } = req.body;
  let users = readData();

  // លុបសារចេញពីគ្រប់ User ទាំងអស់ដែលមាន Notif ID នេះ
  users.forEach((user) => {
    if (user.notifications) {
      user.notifications = user.notifications.filter((n) => n.id !== notifId);
    }
  });

  writeData(users);
  res.json({ success: true, message: "Message deleted from all users!" });
});

app.listen(PORT, "0.0.0.0", () =>
  console.log(`✅ U-PAY SERVER RUNNING on Port ${PORT}`),
);
