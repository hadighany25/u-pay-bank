const express = require("express");
const cors = require("cors");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");

require("dotenv").config();
require("./cron/payrollCron"); // 🔥 បើកដំណើរការរ៉ូបូតកាត់លុយស្វ័យប្រវត្តិ

const connectDB = require("./config/db");
const { initSystem, initAdmins } = require("./services/systemService");
const initCronJobs = require("./services/cronJobs");

// ==========================================
// 📂 ហៅ Routes ទាំងអស់មកជួបគ្នានៅទីនេះ
// ==========================================
const authRoutes = require("./routes/authRoutes");
const transactionRoutes = require("./routes/transactionRoutes");
const adminRoutes = require("./routes/adminRoutes");
const cardRoutes = require("./routes/cardRoutes");
const financeRoutes = require("./routes/financeRoutes");
const communicationRoutes = require("./routes/communicationRoutes");
const merchantRoutes = require("./routes/merchantRoutes");
const ufundRoutes = require("./routes/ufundRoutes");
const accountRoutes = require("./routes/accountRoutes");
const b2bEscrowRoutes = require("./routes/b2bEscrowRouter");
const payrollRouter = require("./routes/payrollRouter"); // 👈 ផ្លាស់ទីវាមកទីនេះ

const PORT = process.env.PORT || 3000;
const app = express();

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(express.static(path.join(__dirname, "../public")));
app.use(cors({ origin: "*" }));

// ==========================================
// 🗄️ ភ្ជាប់ Database និងចាប់ផ្តើមប្រព័ន្ធ
// ==========================================
connectDB()
  .then(() => {
    initSystem();
    initAdmins();
    initCronJobs();
  })
  .catch((error) => {
    console.error("❌ Database connection failed:", error);
  });

// ==========================================
// 🔌 រៀបចំ Socket.io
// ==========================================
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.set("io", io);

io.on("connection", (socket) => {
  socket.on("joinRoom", (username) => {
    socket.join(username);
    console.log(`User ${username} joined socket room.`);
  });
});

// ==========================================
// 🌐 ប្រើប្រាស់ Routes (Routing Registration)
// ==========================================
app.use("/api/merchants", merchantRoutes); // 👈 ផ្លាស់ទីវាមកទីនេះដើម្បីនៅផ្តុំគ្នា
app.use("/api", authRoutes);
app.use("/api", transactionRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/card", cardRoutes);
app.use("/api", financeRoutes);
app.use("/api", communicationRoutes);
app.use("/api/ufund", ufundRoutes);
app.use("/api/account", accountRoutes);
app.use("/api/v1/b2b/escrow", b2bEscrowRoutes);
app.use("/api/payroll", payrollRouter); // 👈 ដាក់វានៅទីនេះ

// 🌟 Route សម្រាប់ទាញយក PDF
const { streamOfficialReceiptPDF } = require("./services/pdfService");
app.get("/api/receipt/:txId", async (req, res) => {
  const { txId } = req.params;
  await streamOfficialReceiptPDF(txId, res);
});

// Route សម្រាប់ទំព័រដើម
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/upay.html"));
});

// ==========================================
// 🚀 ចាប់ផ្តើម Server
// ==========================================
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀🔥 U-PAY Server is running with Socket.io on port ${PORT}`);
});
