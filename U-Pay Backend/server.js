const express = require("express");
const cors = require("cors");
const path = require("path");

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

const app = express();
const PORT = process.env.PORT || 3000;

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

// ប្រើប្រាស់ Routes
app.use("/api", authRoutes);
app.use("/api", transactionRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/card", cardRoutes);
app.use("/api", financeRoutes);
app.use("/api", communicationRoutes);

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/upay.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀🔥 U-PAY Server is running on port ${PORT}`);
});
