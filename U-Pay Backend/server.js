const express = require("express");
const cors = require("cors");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");

require("dotenv").config();

// ហៅកូដពី Folder ផ្សេងៗ
const connectDB = require("./config/db");

// ✅ Fixed: Combined the imports into a single destructuring assignment
const { initSystem, initAdmins } = require("./services/systemService");
const initCronJobs = require("./services/cronJobs");

// ហៅ Routes ពី Folder routes
const authRoutes = require("./routes/authRoutes");
const transactionRoutes = require("./routes/transactionRoutes");
const adminRoutes = require("./routes/adminRoutes");
const cardRoutes = require("./routes/cardRoutes");
const financeRoutes = require("./routes/financeRoutes");
const communicationRoutes = require("./routes/communicationRoutes");
const merchantRoutes = require("./routes/merchantRoutes");
const ufundRoutes = require("./routes/ufundRoutes");
const accountRoutes = require("./routes/accountRoutes");

const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(express.static(path.join(__dirname, "../public"))); // ចង្អុលទៅ Folder public នៅខាងក្រៅ
app.use(cors({ origin: "*" }));

// ភ្ជាប់ Database និងចាប់ផ្តើមប្រព័ន្ធ
connectDB()
  .then(() => {
    initSystem();
    initAdmins();
    initCronJobs();
  })
  .catch((error) => {
    // ✅ Added a catch block to handle potential database connection failures
    console.error("❌ Database connection failed:", error);
  });

// ==========================================
// 🔥 រៀបចំ Socket.io
// ==========================================
const server = http.createServer(app);

// ✅ រៀបចំ Socket ត្រឹមត្រូវ (ទុកតែមួយនេះគត់!)
const io = new Server(server, {
  cors: {
    origin: "*", // អនុញ្ញាតអោយ Frontend ភ្ជាប់មកបាន
    methods: ["GET", "POST"],
  },
});

// រក្សាទុក io ទៅក្នុង app ដើម្បីអាចយកទៅប្រើក្នុង Controller ផ្សេងៗបាន
app.set("io", io);

io.on("connection", (socket) => {
  // ពេល App ទូរស័ព្ទ ឬ Web ភ្ជាប់មក វាត្រូវប្រាប់ថាខ្លួនវាជា User ណា
  socket.on("joinRoom", (username) => {
    socket.join(username);
    console.log(`User ${username} joined socket room.`);
  });
});

// ==========================================
// 🌐 ប្រើប្រាស់ Routes (ត្រូវដាក់មុនពេល Listen)
// ==========================================
app.use("/api", authRoutes);
app.use("/api", transactionRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/card", cardRoutes);
app.use("/api", financeRoutes);
app.use("/api", communicationRoutes);
app.use("/api/ufund", ufundRoutes);
app.use("/api/merchants", merchantRoutes);
app.use("/api/account", accountRoutes);

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/upay.html"));
});

// ==========================================
// 🚀 ចាប់ផ្តើម Server
// ==========================================
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀🔥 U-PAY Server is running with Socket.io on port ${PORT}`);
});
