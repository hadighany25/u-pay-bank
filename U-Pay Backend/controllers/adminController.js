// ============================================================================
// ឯកសារ: controllers/adminController.js
// អត្ថន័យ: ខួរក្បាលបញ្ជាប្រព័ន្ធទាំងមូលរបស់ Admin (System, Users, Finance, Reports)
// ============================================================================

// ==========================================
// 📦 ផ្នែកទី ១៖ ទាញយក Modules និង Models (Imports)
// ==========================================
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const {
  readSystemStatus,
  writeSystemStatus,
  readFXRates,
  writeFXRates,
} = require("../services/systemService");
const { getFormattedDate } = require("../services/helpers");

const Admin = require("../models/Admin");
const AdminLog = require("../models/AdminLog");
const Transaction = require("../models/Transaction");
const System = require("../models/System");
const User = require("../models/User");
const Card = require("../models/Card");
const Chat = require("../models/Chat");
const PromoCode = require("../models/PromoCode");
const JointAccount = require("../models/JointAccount");
const Notification = require("../models/Notification");
const Merchant = require("../models/Merchant");
const CashierTicket = require("../models/CashierTicket");

// ========================================================
// 🛠️ Function ជំនួយ (Helpers) សម្រាប់កាត (ចំលងពី cardController)
// ========================================================
const generateStandardHash = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 10; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const generateStandardRefId = (prefix) => {
  const random8Digits = Math.floor(10000000 + Math.random() * 90000000);
  return `${prefix}-${random8Digits}`;
};

// 💳 ការកំណត់តម្លៃ និងឈ្មោះប្រភេទកាតទាំង ៨ (Card Tiers Config) - ដូចគ្នាបេះបិទនឹង User
const cardTiersConfig = {
  standard: { name: "STANDARD", price: 5.0 },
  fifa: { name: "FIFA WORLD CUP", price: 15.0 },
  metal: { name: "METAL GOLD", price: 5.0 },
  celebrity: { name: "BTS EDITION", price: 15.0 },
  anime: { name: "NARUTO EDITION", price: 15.0 },
  gamer: { name: "GAMER PRO", price: 15.0 },
  eco: { name: "ECO GREEN", price: 5.0 },
  platinum: { name: "PLATINUM PREMIUM", price: 25.0 },
  animal: { name: "ANIMAL EDITION", price: 15.0 },
  custom: { name: "CUSTOM VIP", price: 25.0 },
};

// មុខងារជំនួយ: បង្កើតលេខកាត Virtual ស្តង់ដារ (រហូតដល់ ៤ឆ្នាំដូចគ្នា)
const generateCardDetails = () => {
  const number =
    "4" +
    Math.floor(Math.random() * 900000000000000)
      .toString()
      .padStart(15, "0");
  const cvv = Math.floor(100 + Math.random() * 900).toString();
  const d = new Date();
  d.setFullYear(d.getFullYear() + 4);
  const expiry =
    ("0" + (d.getMonth() + 1)).slice(-2) +
    "/" +
    d.getFullYear().toString().slice(-2);
  return { number, cvv, expiry };
};

/**
 * 📌 កត់ត្រារាល់សកម្មភាពរបស់ Admin ចូលក្នុង Database
 */
const logAdminAction = async (adminName, action, target, details) => {
  try {
    const now = new Date();
    const khmerTimeStr = now.toLocaleString("en-US", {
      timeZone: "Asia/Phnom_Penh",
    });
    await AdminLog.create({
      admin: adminName || "Unknown",
      action: action,
      target: target || "System",
      details: details || "",
      date: khmerTimeStr,
    });
  } catch (error) {
    console.error("Failed to log admin action:", error);
  }
};

/**
 * 📌 ត្រួតពិនិត្យសិទ្ធិ និងម៉ោងធ្វើការរបស់បុគ្គលិក Admin
 */
const checkAdminAccess = async (reqAdmin, actionKey) => {
  if (reqAdmin.role === "super_admin") return { allowed: true };

  const adminAcc = await Admin.findById(reqAdmin.id || reqAdmin._id);
  if (!adminAcc)
    return { allowed: false, message: "គណនីបុគ្គលិកមិនត្រឹមត្រូវ!" };

  if (
    adminAcc.permissions &&
    adminAcc.permissions.workStart &&
    adminAcc.permissions.workEnd
  ) {
    const now = new Date();
    const khmerTimeStr = now.toLocaleString("en-US", {
      timeZone: "Asia/Phnom_Penh",
      hour12: false,
    });
    const timeMatch = khmerTimeStr.match(/(\d+):(\d+):/);
    if (timeMatch) {
      const currentHour = timeMatch[1].padStart(2, "0");
      const currentMin = timeMatch[2].padStart(2, "0");
      const currentTime = `${currentHour}:${currentMin}`;

      if (
        currentTime < adminAcc.permissions.workStart ||
        currentTime > adminAcc.permissions.workEnd
      ) {
        return {
          allowed: false,
          message: `បម្រាម៖ អ្នកនៅក្រៅម៉ោងធ្វើការ! (ម៉ោងអនុញ្ញាតរបស់អ្នកគឺ ${adminAcc.permissions.workStart} ដល់ ${adminAcc.permissions.workEnd}) 🛑`,
        };
      }
    }
  }

  if (actionKey && adminAcc.permissions && adminAcc.permissions.actions) {
    if (adminAcc.permissions.actions[actionKey] !== true) {
      return {
        allowed: false,
        message: "សុំទោស! អ្នកគ្មានសិទ្ធិធ្វើសកម្មភាពនេះទេ (Access Denied) 🛑",
      };
    }
  }

  return { allowed: true };
};

const logCustomAction = async (req, res) => {
  try {
    const { action, target, details } = req.body;
    await logAdminAction(req.admin.username, action, target, details);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false });
  }
};

// ==========================================
// 🛡️ ផ្នែកទី ៣៖ ការគ្រប់គ្រងគណនី Admin គ្នាឯង
// ==========================================

const getMe = async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin.id || req.admin._id);
    res.json({ success: true, admin });
  } catch (error) {
    res.status(500).json({ success: false });
  }
};

const getAdminsList = async (req, res) => {
  try {
    const admins = await Admin.find({}, "-password"); // ទាញយកទាំងអស់ដោយលាក់លេខសម្ងាត់
    res.json({ success: true, admins });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// ==========================================
// 📋 [Admin] ទាញយក Logs សម្រាប់ User ជាក់លាក់ (User Audit Logs)
// ==========================================
const getUserLogs = async (req, res) => {
  try {
    const { username } = req.params;
    // ទាញយក Logs ណាដែលមាន target ចំ username នោះ
    const logs = await AdminLog.find({ target: username })
      .sort({ _id: -1 })
      .limit(100);
    res.json({ success: true, logs });
  } catch (err) {
    console.error("Get User Logs Error:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

const getAdminLogs = async (req, res) => {
  try {
    if (req.admin.role !== "super_admin")
      return res.status(403).json({ success: false, message: "Forbidden" });
    const logs = await AdminLog.find().sort({ _id: -1 }).limit(100);
    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

const saveAdminAccount = async (req, res) => {
  const {
    id,
    staffId,
    fullName,
    nickname,
    phone,
    email,
    department,
    remarks,
    nfcUid,
    username,
    password,
    role,
    permissions,
  } = req.body;
  try {
    if (nfcUid && nfcUid.trim() !== "") {
      const existingNfcUser = await Admin.findOne({ nfcUid: nfcUid });
      if (existingNfcUser && existingNfcUser._id.toString() !== id) {
        return res.json({
          success: false,
          message: `កាត NFC នេះត្រូវបានភ្ជាប់ជាមួយបុគ្គលិកឈ្មោះ ${existingNfcUser.username} រួចហើយ! សូមផ្តាច់ពីគណនីនោះសិន ឬប្រើកាតថ្មី។`,
        });
      }
    }

    if (id) {
      const adminToUpdate = await Admin.findById(id);
      if (!adminToUpdate)
        return res.json({ success: false, message: "រកមិនឃើញគណនី" });

      adminToUpdate.username = username;
      adminToUpdate.role = role;
      adminToUpdate.fullName = fullName;
      adminToUpdate.nickname = nickname;
      adminToUpdate.phone = phone;
      adminToUpdate.email = email;
      adminToUpdate.department = department;
      adminToUpdate.remarks = remarks;
      adminToUpdate.nfcUid = nfcUid;

      if (permissions) adminToUpdate.permissions = permissions;
      if (password && password.trim() !== "")
        adminToUpdate.password = await bcrypt.hash(password, 10);

      await adminToUpdate.save();
      await logAdminAction(
        req.admin.username,
        "Update Admin",
        username,
        `Role updated to ${role}`,
      );
      return res.json({ success: true, message: "កែប្រែបានជោគជ័យ!" });
    } else {
      const exists = await Admin.findOne({ username });
      if (exists)
        return res.json({
          success: false,
          message: "ឈ្មោះនេះមានអ្នកប្រើប្រាស់ហើយ!",
        });
      if (!password)
        return res.json({ success: false, message: "សូមបញ្ចូលលេខសម្ងាត់!" });

      const hashedPassword = await bcrypt.hash(password, 10);
      const newAdmin = new Admin({
        staffId,
        fullName,
        nickname,
        phone,
        email,
        department,
        remarks,
        nfcUid,
        username,
        password: hashedPassword,
        role,
        permissions,
      });
      await newAdmin.save();

      await logAdminAction(
        req.admin.username,
        "Create Admin",
        username,
        `Role created as ${role}`,
      );
      return res.json({
        success: true,
        message: "បង្កើតគណនីបុគ្គលិកថ្មីជោគជ័យ!",
      });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

const checkAdminNfcUid = async (req, res) => {
  const { nfcUid, adminId } = req.body;
  try {
    if (!nfcUid)
      return res.json({ available: false, message: "គ្មានទិន្នន័យ NFC" });
    const existingAdmin = await Admin.findOne({ nfcUid: nfcUid });
    if (existingAdmin && existingAdmin._id.toString() !== adminId) {
      return res.json({
        available: false,
        owner: existingAdmin.username || existingAdmin.fullName,
      });
    }
    return res.json({ available: true });
  } catch (error) {
    res.status(500).json({ available: false, message: "Server Error" });
  }
};

const deleteAdminAccount = async (req, res) => {
  const { id } = req.body;
  try {
    const adminToDelete = await Admin.findById(id);
    if (adminToDelete && adminToDelete.username === "admin")
      return res.json({
        success: false,
        message: "មិនអាចលុបគណនី មេធំ (Master Admin) បានទេ!",
      });

    await Admin.findByIdAndDelete(id);
    await logAdminAction(
      req.admin.username,
      "Delete Admin",
      adminToDelete ? adminToDelete.username : id,
      `Admin Account Terminated`,
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

const adminResetPassword = async (req, res) => {
  const { adminId, newPassword } = req.body;
  try {
    if (!adminId || !newPassword)
      return res.json({ success: false, message: "ទិន្នន័យមិនគ្រប់គ្រាន់ទេ!" });

    const targetAdmin = await Admin.findById(adminId);
    if (!targetAdmin)
      return res.json({
        success: false,
        message: "រកមិនឃើញគណនីបុគ្គលិកនេះទេ!",
      });

    if (targetAdmin.username === "admin" && req.admin.username !== "admin") {
      return res.json({
        success: false,
        message: "អ្នកគ្មានសិទ្ធិ Reset Password របស់ Master Admin ទេ!",
      });
    }

    targetAdmin.password = await bcrypt.hash(newPassword, 10);
    await targetAdmin.save();

    await logAdminAction(
      req.admin.username,
      "Reset Admin Password",
      targetAdmin.username,
      `Password successfully reset by Super Admin`,
    );
    res.json({
      success: true,
      message: `ពាក្យសម្ងាត់របស់ @${targetAdmin.username} ត្រូវបានប្តូរថ្មីដោយជោគជ័យ!`,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

const toggleAdminStatus = async (req, res) => {
  const { adminId } = req.body;
  try {
    const targetAdmin = await Admin.findById(adminId);
    if (!targetAdmin)
      return res.json({
        success: false,
        message: "រកមិនឃើញគណនីបុគ្គលិកនេះទេ!",
      });

    if (targetAdmin.username === "admin") {
      return res.json({
        success: false,
        message: "មិនអាចបិទគណនី Master Admin បានទេ។",
      });
    }

    targetAdmin.isActive = !targetAdmin.isActive;
    await targetAdmin.save();

    res.json({
      success: true,
      isActive: targetAdmin.isActive,
      message: `គណនីរបស់ @${targetAdmin.username} ត្រូវ បាន${targetAdmin.isActive ? "បើកដំណើរការ" : "បិទ"} ដោយជោគជ័យ!`,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// ==========================================
// ⚙️ ផ្នែកទី ៤៖ ការកំណត់ប្រព័ន្ធ (System Config & Fees)
// ==========================================

const toggleSystem = async (req, res) => {
  try {
    const currentStatus = readSystemStatus();
    const newStatus = !currentStatus.isSystemFrozen;
    await writeSystemStatus({ isSystemFrozen: newStatus });

    await logAdminAction(
      req.admin.username,
      "Toggle System",
      "System Platform",
      `System set to ${newStatus ? "FROZEN" : "ACTIVE"}`,
    );
    res.json({ success: true, isSystemFrozen: newStatus });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

const getSystemStatus = (req, res) => {
  res.json(readSystemStatus());
};

const getFXRates = (req, res) => {
  res.json({ success: true, rates: readFXRates() });
};

const updateFX = async (req, res) => {
  const { buy, sell } = req.body;
  try {
    await writeFXRates({
      usdToKhrBuy: parseFloat(buy),
      usdToKhrSell: parseFloat(sell),
    });
    await logAdminAction(
      req.admin.username,
      "Update FX Rates",
      "Exchange System",
      `Buy: ${buy}៛, Sell: ${sell}៛`,
    );
    res.json({ success: true, message: "Exchange Rates Updated" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

const getFeeSettings = async (req, res) => {
  try {
    let sys = await System.findOne({ settingId: "GLOBAL_SETTINGS" });
    if (!sys) {
      sys = new System();
      await sys.save();
    }
    res.json({
      success: true,
      transferLimit: sys.transferLimit,
      feeTiers: sys.feeTiers,
    });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
};

const updateFeeSettings = async (req, res) => {
  if (req.admin.role !== "super_admin") {
    return res.status(403).json({
      success: false,
      message: "បម្រាម៖ អ្នកគ្មានសិទ្ធិកែប្រែតម្លៃសេវាកម្មនេះទេ!",
    });
  }
  const { transferLimit, feeTiers } = req.body;
  try {
    let sys = await System.findOne({ settingId: "GLOBAL_SETTINGS" });
    if (!sys) sys = new System();

    sys.transferLimit = parseFloat(transferLimit);
    sys.feeTiers = feeTiers;
    sys.markModified("feeTiers");
    await sys.save();

    await logAdminAction(
      req.admin.username,
      "Update Fees & Limits",
      "System Settings",
      `New Limit: $${transferLimit}, Tiers Updated.`,
    );
    res.json({ success: true, message: "រក្សាទុកការកំណត់ជោគជ័យ!" });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: "Server Error: " + err.message });
  }
};

// ==========================================
// 📊 ផ្នែកទី ៥៖ របាយការណ៍ និងស្ថិតិ (Dashboard & Stats)
// ==========================================

const getStats = async (req, res) => {
  try {
    const labels = [];
    const data = Array(7).fill(0);
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      labels.push(d.toLocaleDateString("en-US", { weekday: "short" }));
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentTrxs = await Transaction.find({
      amount: { $lt: 0 },
      createdAt: { $gte: sevenDaysAgo },
    });

    recentTrxs.forEach((t) => {
      const tDate = new Date(t.createdAt || t.date);
      const diffDays = Math.floor(
        (today.getTime() - tDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      const index = 6 - diffDays;
      if (index >= 0 && index < 7) {
        data[index] += Math.abs(t.amount);
      }
    });

    res.json({ labels, data });
  } catch (error) {
    res.status(500).json({ labels: [], data: Array(7).fill(0) });
  }
};

const getDashboardExtra = async (req, res) => {
  try {
    let totalRevenue = 0;
    const revenueTrxs = await Transaction.find({
      $or: [
        { fee: { $gt: 0 } },
        { receiverAcc: "888888888", amount: { $gt: 0 } },
      ],
    });

    revenueTrxs.forEach((t) => {
      if (t.fee > 0) totalRevenue += t.fee;
      if (t.receiverAcc === "888888888" && t.type !== "Fund Recovery") {
        totalRevenue += t.amount;
      }
    });

    const recentTrxs = await Transaction.find({
      senderAcc: { $ne: "888888888" },
    })
      .sort({ createdAt: -1 })
      .limit(10);
    const allActivities = recentTrxs.map((t) => ({
      type: t.type || "Transaction",
      user: t.username || "Unknown",
      amount: t.amount || 0,
      date: t.date || new Date(t.createdAt).toLocaleString(),
      receiver: t.receiverName || "System",
      rawDate: new Date(t.createdAt || t.date).getTime(),
    }));

    res.json({
      success: true,
      revenue: totalRevenue,
      activities: allActivities,
    });
  } catch (error) {
    res.json({ success: false, revenue: 0, activities: [] });
  }
};

// ==========================================
// 👥 ផ្នែកទី ៦៖ ការគ្រប់គ្រងអតិថិជន (Customer 360 & Management - Updated with Card.js)
// ==========================================
const searchUserByAdmin = async (req, res) => {
  try {
    const { searchTerm } = req.body;
    if (!searchTerm)
      return res.json({ success: false, message: "សូមបញ្ចូលពាក្យស្វែងរក!" });

    const regex = new RegExp(searchTerm, "i");
    const userObj = await User.findOne({
      $or: [
        { username: regex },
        { fullName: regex },
        { phone: regex },
        { phoneNumber: regex },
        { "mainAccounts.USD.accountNumber": searchTerm },
        { "mainAccounts.KHR.accountNumber": searchTerm },
      ],
    }).select("-password");

    if (userObj) {
      let userDetails = userObj.toObject();
      const userTransactions = await Transaction.find({
        $or: [
          { username: userDetails.username },
          { senderAcc: userDetails.mainAccounts?.USD?.accountNumber },
          { senderAcc: userDetails.mainAccounts?.KHR?.accountNumber },
          { receiverAcc: userDetails.mainAccounts?.USD?.accountNumber },
          { receiverAcc: userDetails.mainAccounts?.KHR?.accountNumber },
        ],
      }).sort({ _id: -1 });

      userDetails.transactions = userTransactions || [];

      // 🌟 ទាញយកកាតពី Model Card.js ថ្មីមកដាក់ក្នុង userDetails.virtualCards ឱ្យបានត្រឹមត្រូវ
      userDetails.virtualCards = await Card.find({
        $or: [
          { username: userDetails.username },
          { userId: userDetails._id },
          { userCustomId: userDetails.userId },
        ],
      }).sort({ orderIndex: 1, createdAt: 1 });

      userDetails.kycDocument =
        userDetails.kycDocument ||
        userDetails.kycImage ||
        userDetails.idCardImage ||
        "";
      userDetails.kycImage = userDetails.kycDocument;

      if (userDetails.referredBy) {
        const referrer = await User.findOne({
          userId: userDetails.referredBy,
        }).select("fullName username");
        if (referrer) {
          userDetails.referrerName = referrer.fullName || referrer.username;
        }
      }

      res.json({ success: true, user: userDetails });
    } else {
      res.json({ success: false, message: "រកមិនឃើញអតិថិជននេះទេ!" });
    }
  } catch (error) {
    console.error("Search User By Admin Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

const getUserByAdmin = async (req, res) => {
  try {
    const { username } = req.body;
    const userObj = await User.findOne({ username }).select("-password");

    if (userObj) {
      let userDetails = userObj.toObject();
      const userTransactions = await Transaction.find({
        $or: [
          { username: userDetails.username },
          { senderAcc: userDetails.mainAccounts?.USD?.accountNumber },
          { senderAcc: userDetails.mainAccounts?.KHR?.accountNumber },
          { receiverAcc: userDetails.mainAccounts?.USD?.accountNumber },
          { receiverAcc: userDetails.mainAccounts?.KHR?.accountNumber },
        ],
      }).sort({ _id: -1 });

      userDetails.transactions = userTransactions || [];

      // 🌟 ទាញយកកាតពី Model Card.js ថ្មីមកដាក់ក្នុង userDetails.virtualCards ឱ្យបានត្រឹមត្រូវ
      userDetails.virtualCards = await Card.find({
        $or: [
          { username: userDetails.username },
          { userId: userDetails._id },
          { userCustomId: userDetails.userId },
        ],
      }).sort({ orderIndex: 1, createdAt: 1 });

      userDetails.kycDocument =
        userDetails.kycDocument ||
        userDetails.kycImage ||
        userDetails.idCardImage ||
        "";
      userDetails.kycImage = userDetails.kycDocument;

      if (userDetails.referredBy) {
        const referrer = await User.findOne({
          userId: userDetails.referredBy,
        }).select("fullName username");
        if (referrer) {
          userDetails.referrerName = referrer.fullName || referrer.username;
        }
      }

      res.json({ success: true, user: userDetails });
    } else {
      res.json({ success: false, message: "រកមិនឃើញគណនីនេះទេ!" });
    }
  } catch (error) {
    console.error("Get User By Admin Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

const getSingleUser = async (req, res) => {
  try {
    const user = await User.findOne({ username: req.body.username });
    if (user) res.json({ success: true, user: user });
    else res.json({ success: false, message: "User not found" });
  } catch (error) {
    res.status(500).json({ success: false });
  }
};

const editUser = async (req, res) => {
  const access = await checkAdminAccess(req.admin, "editUser");
  if (!access.allowed)
    return res.status(403).json({ success: false, message: access.message });

  const {
    id,
    username,
    pin,
    profileImage,
    accountNumber,
    accountNumberKHR,
    password,
    fullName,
    phone,
    email,
    dob,
    gender,
    idNumber,
  } = req.body;

  try {
    if (!id) return res.json({ success: false, message: "Invalid ID" });

    let query = [{ username: id }];
    if (mongoose.isValidObjectId(id)) query.push({ _id: id });

    const u = await User.findOne({ $or: query });
    if (!u)
      return res.json({
        success: false,
        message: "រកមិនឃើញគណនីដើម្បីកែប្រែទេ។",
      });

    const checkUSD = accountNumber || u.mainAccounts?.USD?.accountNumber || "";
    const checkKHR =
      accountNumberKHR || u.mainAccounts?.KHR?.accountNumber || "";
    if (checkUSD && checkKHR && checkUSD === checkKHR)
      return res.json({
        success: false,
        message: "បរាជ័យ! លេខគណនី USD និង KHR មិនអាចដូចគ្នាបានទេ។",
      });

    // 🟢 Update ទិន្នន័យចូល Model
    if (accountNumber) u.mainAccounts.USD.accountNumber = accountNumber;
    if (accountNumberKHR) u.mainAccounts.KHR.accountNumber = accountNumberKHR;
    if (username) u.username = username;
    if (pin) u.pin = pin;
    if (profileImage !== undefined) u.profileImage = profileImage;
    if (password && password.trim() !== "")
      u.password = await bcrypt.hash(password, 10); // 🟢 ត្រូវ hash password ផងបើចង់ដូរ

    // 🟢 Update Fields ថ្មី
    if (fullName !== undefined) u.fullName = fullName;
    if (phone !== undefined) {
      u.phone = phone;
      u.phoneNumber = phone; // update ទាំងពីរក្រែងលោមានកន្លែងផ្សេងហៅប្រើ
    }
    if (email !== undefined) u.email = email;
    if (dob !== undefined) u.dob = dob;
    if (gender !== undefined) u.gender = gender;
    if (idNumber !== undefined) u.idNumber = idNumber;

    await u.save();
    await logAdminAction(
      req.admin.username,
      "Edit User",
      u.username,
      `Updated user profile/credentials`,
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Edit User Error:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// 🟢 អនុគមន៍ថ្មី៖ ផ្ញើ Reset Link ទៅកាន់អតិថិជន
const requestCredentialReset = async (req, res) => {
  const access = await checkAdminAccess(req.admin, "editUser"); // ឬកំណត់សិទ្ធិថ្មី "resetCredentials"
  if (!access.allowed)
    return res.status(403).json({ success: false, message: access.message });

  const { username, resetType } = req.body; // resetType = "PIN" ឬ "Password"

  try {
    const user = await User.findOne({ username });
    if (!user) return res.json({ success: false, message: "រកគណនីមិនឃើញទេ!" });

    if (!user.email) {
      return res.json({
        success: false,
        message:
          "បរាជ័យ! អតិថិជននេះមិនទាន់មាន អ៊ីមែល (Email) ក្នុងប្រព័ន្ធទេ។ សូមបញ្ជូល Email ឱ្យគាត់ជាមុនសិន។",
      });
    }

    // ១. បង្កើត Token សុវត្ថិភាព (Random 64 តួ)
    const rawToken = crypto.randomBytes(32).toString("hex");

    // សម្រាប់សុវត្ថិភាពខ្ពស់ គួរតែ Hash token មុននឹង Save ចូល Database (តែដើម្បីងាយស្រួលយល់ ខ្ញុំ save វាផ្ទាល់សិន)
    user.resetToken = rawToken;

    // ២. កំណត់ពេលផុតកំណត់ ៥ នាទី (5 minutes = 5 * 60 * 1000 ms)
    user.resetTokenExpire = Date.now() + 5 * 60 * 1000;

    await user.save();

    // ៣. បង្កើត URL សម្រាប់ទំព័រ Public (ដូរ domain តាមជាក់ស្តែងរបស់អ្នក)
    // ឧទាហរណ៍ URL: https://u-pay-bank.fly.dev/reset-credential?token=xxxx&type=PIN
    const baseUrl = process.env.CLIENT_URL || "https://u-pay-bank.fly.dev";
    const resetUrl = `${baseUrl}/reset-credential.html?token=${rawToken}&type=${resetType}`;

    // ៤. ផ្ញើ Email
    const emailSent = await sendResetLink(
      user.email,
      user.fullName || user.username,
      resetUrl,
      resetType,
    );

    if (!emailSent) {
      return res.json({
        success: false,
        message: "មានបញ្ហាក្នុងការផ្ញើអ៊ីមែល!",
      });
    }

    // ៥. កត់ត្រាសកម្មភាព Admin
    await logAdminAction(
      req.admin.username,
      `Request Reset ${resetType}`,
      user.username,
      `Sent reset link to ${user.email} (Expires in 5m)`,
    );

    res.json({
      success: true,
      message: "បានផ្ញើ Link ទៅកាន់អ៊ីមែលរបស់អតិថិជនរួចរាល់!",
    });
  } catch (error) {
    console.error("Reset Request Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

const deleteUser = async (req, res) => {
  const access = await checkAdminAccess(req.admin, "deleteUser");
  if (!access.allowed)
    return res.status(403).json({ success: false, message: access.message });

  const { id, targetAccount, reason } = req.body;
  try {
    if (!id) return res.json({ success: false, message: "Invalid ID" });

    let query = [{ username: id }];
    if (mongoose.isValidObjectId(id)) query.push({ _id: id });

    const user = await User.findOne({ $or: query });
    if (!user) return res.json({ success: false, message: "User not found" });

    const centralBank = await User.findOne({
      "mainAccounts.USD.accountNumber": "888888888",
    });
    if (!centralBank)
      return res.json({ success: false, message: "Central Bank not found" });

    let logDetail = "";
    const dateStr = new Date().toLocaleString("en-US", {
      timeZone: "Asia/Phnom_Penh",
      hour12: true,
    });

    if (targetAccount && targetAccount !== "ALL") {
      const subIndex = user.subAccounts.findIndex(
        (s) => s.accountNumber === targetAccount,
      );
      if (subIndex === -1)
        return res.json({ success: false, message: "Sub-account not found" });

      const subAcc = user.subAccounts[subIndex];
      const subBalance = subAcc.balance;
      const subCurrency = subAcc.currency;

      if (subBalance > 0) {
        if (subCurrency === "USD") {
          user.mainAccounts.USD.balance += subBalance;
        } else {
          user.mainAccounts.KHR.balance =
            (user.mainAccounts.KHR.balance || 0) + subBalance;
        }

        await Transaction.create({
          userId: user._id,
          username: user.username,
          refId: generateStandardRefId("MOV"),
          hash: generateStandardHash(),
          date: dateStr,
          type: "Internal Transfer",
          amount: subBalance,
          currency: subCurrency,
          senderName: subAcc.accountName,
          receiverName: "Main Account",
          senderAcc: targetAccount,
          receiverAcc:
            subCurrency === "USD"
              ? user.mainAccounts.USD.accountNumber
              : user.mainAccounts.KHR.accountNumber,
          remark: "System Auto-Transfer (Sub-Account Closed)",
          status: "Success",
        });
      }

      user.subAccounts.splice(subIndex, 1);
      await user.save();
      logDetail = `Deleted Sub-account: ${targetAccount}. Auto-Transferred: ${subBalance} ${subCurrency} to Main. Reason: ${reason}`;
    } else {
      let totalUSD = user.mainAccounts?.USD?.balance || 0;
      let totalKHR = user.mainAccounts?.KHR?.balance || 0;

      if (user.subAccounts && user.subAccounts.length > 0) {
        user.subAccounts.forEach((sub) => {
          if (sub.currency === "USD") totalUSD += sub.balance;
          if (sub.currency === "KHR") totalKHR += sub.balance;
        });
      }

      if (totalUSD > 0 || totalKHR > 0) {
        centralBank.mainAccounts.USD.balance += totalUSD;
        centralBank.mainAccounts.KHR.balance =
          (centralBank.mainAccounts.KHR.balance || 0) + totalKHR;
        await centralBank.save();

        if (totalUSD > 0) {
          await Transaction.create({
            userId: centralBank._id,
            username: centralBank.username,
            refId: generateStandardRefId("REC"),
            hash: generateStandardHash(),
            date: dateStr,
            type: "Fund Recovery",
            amount: totalUSD,
            currency: "USD",
            senderName: user.username,
            receiverName: "Central Bank",
            remark: `Account Deleted. Recovered funds from ${user.username}`,
            status: "Success",
          });
        }
        if (totalKHR > 0) {
          await Transaction.create({
            userId: centralBank._id,
            username: centralBank.username,
            refId: generateStandardRefId("REC"),
            hash: generateStandardHash(),
            date: dateStr,
            type: "Fund Recovery",
            amount: totalKHR,
            currency: "KHR",
            senderName: user.username,
            receiverName: "Central Bank",
            remark: `Account Deleted. Recovered funds from ${user.username}`,
            status: "Success",
          });
        }
      }

      await Chat.deleteMany({
        $or: [
          { senderAcc: user.mainAccounts?.USD?.accountNumber },
          { receiverAcc: user.mainAccounts?.USD?.accountNumber },
          { senderAcc: user.mainAccounts?.KHR?.accountNumber },
          { receiverAcc: user.mainAccounts?.KHR?.accountNumber },
        ],
      });
      await Card.deleteMany({ username: user.username });
      await User.deleteOne({ _id: user._id });
      logDetail = `Deleted account completely. Recovered ${totalUSD} USD & ${totalKHR} KHR. Reason: ${reason}`;
    }

    await logAdminAction(
      req.admin.username,
      "Delete User/Account",
      user ? user.username : id,
      logDetail,
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// ==========================================
// មុខងារកំណត់គណនីជាក់លាក់ដោយ Admin (Limit, Freeze, Hide, Edit, Delete)
// ==========================================

const editSubAccount = async (req, res) => {
  const { username, oldAccountNumber, newName, newAccountNumber } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user) return res.json({ success: false, message: "រកគណនីមិនឃើញទេ!" });

    if (oldAccountNumber !== newAccountNumber) {
      const accExists = await User.findOne({
        $or: [
          { "mainAccounts.USD.accountNumber": newAccountNumber },
          { "mainAccounts.KHR.accountNumber": newAccountNumber },
          { "subAccounts.accountNumber": newAccountNumber },
        ],
      });
      if (accExists)
        return res.json({
          success: false,
          message: "លេខគណនីថ្មីនេះ មានអ្នកប្រើប្រាស់រួចហើយ!",
        });
    }

    const subIdx = user.subAccounts.findIndex(
      (a) => String(a.accountNumber) === String(oldAccountNumber),
    );
    if (subIdx === -1)
      return res.json({ success: false, message: "រកគណនីរងនេះមិនឃើញទេ!" });

    user.subAccounts[subIdx].accountName = newName;
    user.subAccounts[subIdx].accountNumber = newAccountNumber;
    user.markModified("subAccounts");
    await user.save();

    if (oldAccountNumber !== newAccountNumber) {
      await Transaction.updateMany(
        { senderAcc: oldAccountNumber },
        { $set: { senderAcc: newAccountNumber } },
      );
      await Transaction.updateMany(
        { receiverAcc: oldAccountNumber },
        { $set: { receiverAcc: newAccountNumber } },
      );
    }

    if (req.admin && req.admin.username) {
      await logAdminAction(
        req.admin.username,
        "Edit Sub Account",
        username,
        `Changed ${oldAccountNumber} to ${newName} (${newAccountNumber})`,
      );
    }
    res.json({ success: true, message: "កែប្រែជោគជ័យ!" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

const deleteSubAccount = async (req, res) => {
  const { username, accountNumber } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user) return res.json({ success: false, message: "រកគណនីមិនឃើញទេ!" });

    const subIdx = user.subAccounts.findIndex(
      (a) => String(a.accountNumber) === String(accountNumber),
    );
    if (subIdx === -1)
      return res.json({ success: false, message: "រកគណនីរងនេះមិនឃើញទេ!" });

    const subAcc = user.subAccounts[subIdx];

    if (subAcc.balance > 0) {
      if (subAcc.currency === "USD") {
        user.mainAccounts.USD.balance += subAcc.balance;
      } else {
        user.mainAccounts.KHR.balance =
          (user.mainAccounts.KHR.balance || 0) + subAcc.balance;
      }

      await Transaction.create({
        userId: user._id,
        username: user.username,
        refId: `SYS-${Date.now()}`,
        date: new Date().toISOString(),
        type: "System Auto-Transfer",
        amount: subAcc.balance,
        currency: subAcc.currency,
        senderName: subAcc.accountName,
        receiverName: "Main Account",
        senderAcc: accountNumber,
        receiverAcc:
          subAcc.currency === "USD"
            ? user.mainAccounts.USD.accountNumber
            : user.mainAccounts.KHR.accountNumber,
        remark: "លុបគណនីរងចោល: លុយត្រូវបានរុញចូលគណនីគោលដោយស្វ័យប្រវត្តិ",
        status: "Success",
      });
    }

    user.subAccounts.splice(subIdx, 1);
    user.markModified("subAccounts");
    await user.save();

    if (req.admin && req.admin.username) {
      await logAdminAction(
        req.admin.username,
        "Delete Sub Account",
        username,
        `Deleted ${accountNumber}. Balance recovered: ${subAcc.balance}`,
      );
    }
    res.json({ success: true, message: "លុបជោគជ័យ!" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

const adminUpdateAccountLimit = async (req, res) => {
  const { username, accountNumber, dailyLimit } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user)
      return res.json({ success: false, message: "រកគណនីអតិថិជនមិនឃើញទេ!" });

    let updated = false;

    if (
      String(user.mainAccounts?.USD?.accountNumber) === String(accountNumber)
    ) {
      user.mainAccounts.USD.dailyLimit = dailyLimit;
      updated = true;
    } else if (
      String(user.mainAccounts?.KHR?.accountNumber) === String(accountNumber)
    ) {
      user.mainAccounts.KHR.dailyLimit = dailyLimit;
      updated = true;
    } else {
      const subIdx = user.subAccounts.findIndex(
        (a) => String(a.accountNumber) === String(accountNumber),
      );
      if (subIdx !== -1) {
        user.subAccounts[subIdx].dailyLimit = dailyLimit;
        updated = true;
      }
    }

    if (updated) {
      user.markModified("mainAccounts");
      user.markModified("subAccounts");
      await user.save();
      if (req.admin && req.admin.username) {
        await logAdminAction(
          req.admin.username,
          "Update Account Limit",
          username,
          `កំណត់ Limit ថ្មីឱ្យគណនី ${accountNumber} ចំនួន: ${dailyLimit}`,
        );
      }
      res.json({ success: true, message: "បានកំណត់ Limit ថ្មីជោគជ័យ!" });
    } else {
      res.json({
        success: false,
        message: "រកលេខគណនីនេះមិនឃើញក្នុងប្រវត្តិរូបទេ!",
      });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: "មានបញ្ហា Server" });
  }
};

const adminToggleFreezeAccount = async (req, res) => {
  const { username, accountNumber } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user)
      return res.json({ success: false, message: "រកគណនីអតិថិជនមិនឃើញទេ!" });

    let newStatus = false;
    let updated = false;

    if (
      String(user.mainAccounts?.USD?.accountNumber) === String(accountNumber)
    ) {
      newStatus = !user.mainAccounts.USD.isFrozen;
      user.mainAccounts.USD.isFrozen = newStatus;
      updated = true;
    } else if (
      String(user.mainAccounts?.KHR?.accountNumber) === String(accountNumber)
    ) {
      newStatus = !user.mainAccounts.KHR.isFrozen;
      user.mainAccounts.KHR.isFrozen = newStatus;
      updated = true;
    } else {
      const subIdx = user.subAccounts.findIndex(
        (a) => String(a.accountNumber) === String(accountNumber),
      );
      if (subIdx !== -1) {
        newStatus = !user.subAccounts[subIdx].isFrozen;
        user.subAccounts[subIdx].isFrozen = newStatus;
        updated = true;
      }
    }

    if (updated) {
      user.markModified("mainAccounts");
      user.markModified("subAccounts");
      await user.save();
      if (req.admin && req.admin.username) {
        await logAdminAction(
          req.admin.username,
          "Toggle Account Freeze",
          username,
          `គណនី ${accountNumber} ត្រូវបាន ${newStatus ? "FROZEN" : "ACTIVE"}`,
        );
      }
      res.json({
        success: true,
        message: newStatus
          ? "គណនីត្រូវបានផ្អាកបណ្តោះអាសន្ន!"
          : "គណនីត្រូវបានបើកដំណើរការវិញ!",
      });
    } else {
      res.json({ success: false, message: "រកលេខគណនីមិនឃើញ!" });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: "មានបញ្ហា Server" });
  }
};

const adminToggleHideAccount = async (req, res) => {
  const { username, accountNumber } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user)
      return res.json({ success: false, message: "រកគណនីអតិថិជនមិនឃើញទេ!" });

    let updated = false;
    let isHiddenNow = false;

    if (
      String(user.mainAccounts?.USD?.accountNumber) === String(accountNumber)
    ) {
      isHiddenNow = !user.mainAccounts.USD.isHidden;
      user.mainAccounts.USD.isHidden = isHiddenNow;
      updated = true;
    } else if (
      String(user.mainAccounts?.KHR?.accountNumber) === String(accountNumber)
    ) {
      isHiddenNow = !user.mainAccounts.KHR.isHidden;
      user.mainAccounts.KHR.isHidden = isHiddenNow;
      updated = true;
    } else {
      const subIdx = user.subAccounts.findIndex(
        (a) => String(a.accountNumber) === String(accountNumber),
      );
      if (subIdx !== -1) {
        isHiddenNow = !user.subAccounts[subIdx].isHidden;
        user.subAccounts[subIdx].isHidden = isHiddenNow;
        updated = true;
      }
    }

    if (updated) {
      user.markModified("mainAccounts");
      user.markModified("subAccounts");
      await user.save();
      if (req.admin && req.admin.username) {
        await logAdminAction(
          req.admin.username,
          "Toggle Account Visibility",
          username,
          `គណនី ${accountNumber} ត្រូវបាន ${isHiddenNow ? "HIDDEN" : "VISIBLE"}`,
        );
      }
      res.json({
        success: true,
        message: isHiddenNow
          ? "គណនីត្រូវបានលាក់ពីអតិថិជន!"
          : "គណនីត្រូវបានបង្ហាញវិញ!",
      });
    } else {
      res.json({ success: false, message: "រកលេខគណនីមិនឃើញ!" });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: "មានបញ្ហា Server" });
  }
};

const toggleFreeze = async (req, res) => {
  const access = await checkAdminAccess(req.admin, "freezeUser");
  if (!access.allowed)
    return res.status(403).json({ success: false, message: access.message });

  const { id, isFrozen } = req.body;
  try {
    if (!id)
      return res
        .status(400)
        .json({ success: false, message: "Missing User ID" });

    let u;
    if (mongoose.isValidObjectId(id)) {
      u = await User.findById(id);
    } else {
      u = await User.findOne({
        $or: [
          { username: id },
          { "mainAccounts.USD.accountNumber": id },
          { "mainAccounts.KHR.accountNumber": id },
        ],
      });
    }

    if (u) {
      u.isFrozen = isFrozen;
      if (!isFrozen) u.pinAttempts = 0;
      u.passwordAttempts = 0;
      await u.save();
      await logAdminAction(
        req.admin.username,
        "Freeze User",
        u.username,
        `Status changed to ${isFrozen ? "FROZEN" : "UNFROZEN"}`,
      );
      return res.json({ success: true, message: "Updated successfully" });
    } else {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
  } catch (err) {
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};

const adminForceLogout = async (req, res) => {
  const { username, reason } = req.body;
  try {
    const updatedUser = await User.findOneAndUpdate(
      { username: username },
      {
        $set: { forceLogout: true },
        $unset: { currentToken: "", pushToken: "" },
      },
      { new: true },
    );

    if (updatedUser) {
      // 🟢 ចំណុចទី១៖ បាញ់សញ្ញា Socket ទៅទាត់អតិថិជនចេញភ្លាមៗ
      if (global.io) {
        global.io.emit("force_logout_triggered", { username: username });
      }

      res.json({ success: true });
    } else {
      res.json({ success: false, message: "រកមិនឃើញអតិថិជន" });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const adminUploadKyc = async (req, res) => {
  const { username, kycDocument, kycImage } = req.body;
  try {
    const finalKycUrl = kycDocument || kycImage;
    if (!finalKycUrl)
      return res.json({ success: false, message: "មិនមាន URL ឯកសារទេ!" });

    const updatedUser = await User.findOneAndUpdate(
      { username: username },
      {
        $set: {
          kycDocument: finalKycUrl,
          kycImage: finalKycUrl,
          kycStatus: "pending",
        },
      },
      { new: true, strict: false },
    );

    if (updatedUser) res.json({ success: true });
    else res.json({ success: false, message: "រកមិនឃើញគណនីអតិថិជន" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// 🛡️ ផ្នែក KYC & Identity (Maker-Checker Flow)
// ==========================================

/**
 * 📌 [Admin] អនុម័ត, បដិសេធ ឬ ដកហូតសិទ្ធិ KYC
 */
const kycAction = async (req, res) => {
  const { username, action, rejectReason } = req.body;
  try {
    const u = await User.findOne({ username });
    if (!u)
      return res.json({ success: false, message: "រកមិនឃើញគណនីអតិថិជននេះទេ!" });

    const currentAdmin = req.admin.username;

    // 🛑 ១. គោលការណ៍ Maker-Checker: ហាម Admin អនុម័ត ឬ បដិសេធ ឯកសារដែលខ្លួនឯងជាអ្នក Upload
    if (
      (action === "approved" || action === "rejected") &&
      u.kycUploadedBy === currentAdmin
    ) {
      return res.json({
        success: false,
        message:
          "បម្រាម Maker-Checker៖ អ្នកមិនអាចអនុម័ត (Approve) ឬ បដិសេធ (Reject) សំណើដែលអ្នកបាន Upload ដោយខ្លួនឯងបានទេ! សូមរង់ចាំ Admin ផ្សេងទៀត។",
      });
    }

    const dateStr = new Date().toLocaleString("en-US", {
      timeZone: "Asia/Phnom_Penh",
      hour12: true,
    });

    // 🛑 ២. ដំណើរការបដិសេធ (Reject) ឬ ដកហូតសិទ្ធិ (Revoke)
    if (action === "rejected" || action === "revoke") {
      if (!rejectReason || rejectReason.trim() === "") {
        return res.json({
          success: false,
          message: "សូមបញ្ជាក់មូលហេតុនៃការបដិសេធ!",
        });
      }

      u.kycStatus = "rejected";
      u.kycRejectReason = rejectReason;

      // 🟢 កត់ត្រាអ្នកបដិសេធ
      u.kycRejectedBy = currentAdmin;
      u.kycRejectedAt = dateStr;

      // 🧹 លុបរូប KYC ចាស់ចោល តាមការស្នើសុំ ដើម្បីឱ្យ Admin អាច Upload ថ្មីបាន
      u.kycDocument = "";
      u.kycImage = "";
      u.selfieUrl = "";
      u.kycUploadedBy = ""; // Reset អ្នក Upload វិញ

      // ផ្ញើសារប្រាប់អតិថិជន
      await Notification.create({
        userId: u._id,
        username: u.username,
        title: "KYC Verification Failed ❌",
        message: `ឯកសារបញ្ជាក់អត្តសញ្ញាណរបស់អ្នកត្រូវបានបដិសេធ។ មូលហេតុ: ${rejectReason}។ សូមទាក់ទងមកកាន់ធនាគារ។`,
        date: getFormattedDate(),
        type: "info",
        isRead: false,
        metadata: { sender: "system" },
      });

      await logAdminAction(
        currentAdmin,
        "Reject/Revoke KYC",
        u.username,
        `Rejected KYC. Reason: ${rejectReason}`,
      );
    }
    // ✅ ៣. ដំណើរការអនុម័ត (Approve)
    else if (action === "approved" || action === "verified") {
      u.kycStatus = "verified";
      u.kycRejectReason = ""; // លុបមូលហេតុបដិសេធចាស់ចោល

      // 🟢 កត់ត្រាអ្នកអនុម័ត
      u.kycApprovedBy = currentAdmin;
      u.kycApprovedAt = dateStr;

      await Notification.create({
        userId: u._id,
        username: u.username,
        title: "KYC Verification Success ✅",
        message: `អបអរសាទរ! ឯកសារបញ្ជាក់អត្តសញ្ញាណរបស់អ្នកត្រូវបានអនុម័តដោយជោគជ័យ។`,
        date: getFormattedDate(),
        type: "info",
        isRead: false,
        metadata: { sender: "system" },
      });

      await logAdminAction(
        currentAdmin,
        "Approve KYC",
        u.username,
        `Approved KYC Document`,
      );
    }

    await u.save();
    res.json({ success: true, message: "បានធ្វើបច្ចុប្បន្នភាពជោគជ័យ!" });
  } catch (err) {
    console.error("KYC Action Error:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * 📌 [Admin] Upload រូបថតអត្តសញ្ញាណប័ណ្ណ ឬ Selfie ថ្មីជំនួសអតិថិជន
 */
const uploadSpecificKyc = async (req, res) => {
  const { username, type, url, adminName } = req.body;
  try {
    const u = await User.findOne({ username });
    if (!u) return res.json({ success: false, message: "រកអតិថិជនមិនឃើញទេ!" });

    // បញ្ចូលរូបតាមប្រភេទ (ID ឬ Selfie)
    if (type === "idCard") {
      u.kycDocument = url;
      u.kycImage = url;
    } else if (type === "selfie") {
      u.selfieUrl = url;
    }

    // 🟢 បើមានរូបទាំង ២ គ្រប់គ្រាន់ហើយ លោតទៅជា Pending ស្វ័យប្រវត្តិ
    if ((u.kycDocument || u.kycImage) && u.selfieUrl) {
      u.kycStatus = "pending";
      u.kycSubmittedAt = getFormattedDate();
    } else {
      u.kycStatus = "unverified"; // នៅខ្វះរូបមួយទៀត
    }

    // 🔒 កត់ត្រាទុកថា Admin មួយណាជាអ្នក Upload ដើម្បីបិទសិទ្ធិគាត់កុំឱ្យគាត់ Approve ខ្លួនឯង
    u.kycUploadedBy = req.admin.username;

    await u.save();
    await logAdminAction(
      req.admin.username,
      `Upload KYC (${type})`,
      username,
      `Admin uploaded ${type}`,
    );

    res.json({ success: true, message: "Upload ជោគជ័យ!" });
  } catch (error) {
    console.error("Upload Specific KYC Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// ==========================================
// 💰 ផ្នែកទី ៧៖ ប្រតិបត្តិការហិរញ្ញវត្ថុ (Finance & Transactions)
// ==========================================

const getTransaction = async (req, res) => {
  const searchTerm = req.params.id.trim();
  try {
    const foundTrx = await Transaction.findOne({
      $or: [{ refId: searchTerm }, { hash: searchTerm }],
    });
    if (foundTrx) {
      const senderObj = await User.findOne({
        $or: [
          { username: foundTrx.senderName },
          { "mainAccounts.USD.accountNumber": foundTrx.senderAcc },
          { fullName: foundTrx.senderName },
        ],
      });
      const receiverObj = await User.findOne({
        $or: [
          { "mainAccounts.USD.accountNumber": foundTrx.receiverAcc },
          { "mainAccounts.KHR.accountNumber": foundTrx.receiverAcc },
          { username: foundTrx.receiverName },
          { fullName: foundTrx.receiverName },
          { username: foundTrx.username },
        ],
      });

      let trxDetails = {
        ...(foundTrx.toObject ? foundTrx.toObject() : foundTrx),
      };
      trxDetails.senderKyc = senderObj
        ? senderObj.kycStatus || "Unverified"
        : "Unverified";
      trxDetails.receiverKyc = receiverObj
        ? receiverObj.kycStatus || "Unverified"
        : "Unverified";

      if (
        (!trxDetails.senderAcc || trxDetails.senderAcc === "N/A") &&
        senderObj
      )
        trxDetails.senderAcc = senderObj.mainAccounts.USD.accountNumber;
      if (
        (!trxDetails.receiverAcc || trxDetails.receiverAcc === "N/A") &&
        receiverObj
      ) {
        trxDetails.receiverAcc =
          trxDetails.currency === "KHR" &&
          receiverObj.mainAccounts?.KHR?.accountNumber
            ? receiverObj.mainAccounts.KHR.accountNumber
            : receiverObj.mainAccounts.USD.accountNumber;
      }

      const merchantData = await Merchant.findOne({
        $or: [
          { name: foundTrx.receiverName },
          { "accountNumbers.USD": foundTrx.receiverAcc },
          { "accountNumbers.KHR": foundTrx.receiverAcc },
        ],
      });
      if (merchantData && merchantData.merchantId)
        trxDetails.merchantId = merchantData.merchantId;

      res.json({ success: true, transaction: trxDetails });
    } else {
      res.json({
        success: false,
        message: "រកមិនឃើញប្រតិបត្តិការនេះទេ! លេខ Ref ID ឬ Hash មិនត្រឹមត្រូវ។",
      });
    }
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "មានបញ្ហាតភ្ជាប់ទៅកាន់ Server (Database Error)!",
    });
  }
};

const adjustBalance = async (req, res) => {
  const access = await checkAdminAccess(req.admin, "adjustBal");
  if (!access.allowed)
    return res.status(403).json({ success: false, message: access.message });

  const { username, targetAccount, amount, type, currency, remark } = req.body;
  try {
    const user = await User.findOne({ username });
    const centralBank = await User.findOne({
      "mainAccounts.USD.accountNumber": "888888888",
    });
    if (!user) return res.json({ success: false, message: "User not found!" });
    if (!centralBank)
      return res.json({ success: false, message: "Central Bank not found!" });

    let adjustAmount = parseFloat(amount);
    if (isNaN(adjustAmount) || adjustAmount <= 0)
      return res.json({ success: false, message: "Invalid amount!" });

    const currentFXRates = readFXRates();
    const isInputKHR = currency === "KHR";
    const sign = isInputKHR ? "៛" : "$";

    let actualUserAcc = "";
    let targetJointAcc = null;
    let finalAmountToAddOrDeduct = adjustAmount;
    let destinationCurrency = "";

    if (targetAccount === "MAIN_USD") {
      actualUserAcc = user.mainAccounts.USD.accountNumber;
      destinationCurrency = "USD";
    } else if (targetAccount === "MAIN_KHR") {
      actualUserAcc = user.mainAccounts.KHR.accountNumber;
      destinationCurrency = "KHR";
    } else {
      const subIdx = user.subAccounts.findIndex(
        (s) => s.accountNumber === targetAccount,
      );
      if (subIdx === -1)
        return res.json({ success: false, message: "Sub-account not found!" });
      actualUserAcc = targetAccount;
      const subAcc = user.subAccounts[subIdx];
      destinationCurrency = subAcc.currency;

      if (
        subAcc.accountType === "joint" ||
        subAcc.accountType === "joint_member"
      ) {
        targetJointAcc = await JointAccount.findOne({
          accountId: subAcc.accountId,
        });
        if (!targetJointAcc)
          return res.json({
            success: false,
            message: "រកគណនីរួមក្នុងប្រព័ន្ធមិនឃើញទេ!",
          });
      }
    }

    if (currency === "USD" && destinationCurrency === "KHR") {
      finalAmountToAddOrDeduct = adjustAmount * currentFXRates.usdToKhrBuy;
    } else if (currency === "KHR" && destinationCurrency === "USD") {
      finalAmountToAddOrDeduct = adjustAmount / currentFXRates.usdToKhrSell;
    }

    if (targetAccount === "MAIN_USD") {
      if (
        type === "deduct" &&
        user.mainAccounts.USD.balance < finalAmountToAddOrDeduct
      )
        return res.json({
          success: false,
          message: "Insufficient USD balance!",
        });
      user.mainAccounts.USD.balance =
        type === "add"
          ? user.mainAccounts.USD.balance + finalAmountToAddOrDeduct
          : user.mainAccounts.USD.balance - finalAmountToAddOrDeduct;
    } else if (targetAccount === "MAIN_KHR") {
      if (
        type === "deduct" &&
        (user.mainAccounts.KHR.balance || 0) < finalAmountToAddOrDeduct
      )
        return res.json({
          success: false,
          message: "Insufficient KHR balance!",
        });
      user.mainAccounts.KHR.balance =
        type === "add"
          ? (user.mainAccounts.KHR.balance || 0) + finalAmountToAddOrDeduct
          : (user.mainAccounts.KHR.balance || 0) - finalAmountToAddOrDeduct;
    } else {
      const subIdx = user.subAccounts.findIndex(
        (s) => s.accountNumber === targetAccount,
      );
      const subAcc = user.subAccounts[subIdx];
      if (targetJointAcc) {
        if (
          type === "deduct" &&
          targetJointAcc.balance < finalAmountToAddOrDeduct
        )
          return res.json({
            success: false,
            message: "សមតុល្យក្នុងគណនីរួមមិនគ្រប់គ្រាន់ទេ!",
          });
        targetJointAcc.balance =
          type === "add"
            ? targetJointAcc.balance + finalAmountToAddOrDeduct
            : targetJointAcc.balance - finalAmountToAddOrDeduct;
        await targetJointAcc.save();
      } else {
        if (type === "deduct" && subAcc.balance < finalAmountToAddOrDeduct)
          return res.json({
            success: false,
            message: "Insufficient balance in Sub-account!",
          });
        user.subAccounts[subIdx].balance =
          type === "add"
            ? subAcc.balance + finalAmountToAddOrDeduct
            : subAcc.balance - finalAmountToAddOrDeduct;
        user.markModified("subAccounts");
      }
    }

    if (type === "add") {
      if (isInputKHR)
        centralBank.mainAccounts.KHR.balance =
          (centralBank.mainAccounts.KHR.balance || 0) - adjustAmount;
      else centralBank.mainAccounts.USD.balance -= adjustAmount;
    } else if (type === "deduct") {
      if (isInputKHR)
        centralBank.mainAccounts.KHR.balance =
          (centralBank.mainAccounts.KHR.balance || 0) + adjustAmount;
      else centralBank.mainAccounts.USD.balance += adjustAmount;
    }

    const dateStr = new Date().toLocaleString("en-US", {
      timeZone: "Asia/Phnom_Penh",
      hour12: true,
    });
    const userTrx = {
      refId: generateStandardRefId(type === "add" ? "DEP" : "DED"),
      hash: generateStandardHash(),
      date: dateStr,
      type: type === "add" ? "Cash Deposit" : "Cash Withdrawal",
      amount:
        type === "add" ? finalAmountToAddOrDeduct : -finalAmountToAddOrDeduct,
      currency: destinationCurrency,
      fee: 0,
      senderName:
        type === "add" ? "Cash Deposit" : user.fullName || user.username,
      senderAcc:
        type === "add"
          ? isInputKHR
            ? centralBank.mainAccounts.KHR.accountNumber
            : centralBank.mainAccounts.USD.accountNumber
          : actualUserAcc,
      receiverName:
        type === "add" ? user.fullName || user.username : "Cash Withdrawal",
      receiverAcc:
        type === "add"
          ? actualUserAcc
          : isInputKHR
            ? centralBank.mainAccounts.KHR.accountNumber
            : centralBank.mainAccounts.USD.accountNumber,
      remark: remark
        ? remark
        : type === "add"
          ? "Cash Deposit"
          : "Cash Withdrawal",
      status: "Success",
      trxMethod: "U-PAY System",
    };

    const bankTrx = {
      ...userTrx,
      userId: centralBank._id,
      username: centralBank.username,
      amount: type === "add" ? -adjustAmount : adjustAmount,
      currency: currency,
      type: type === "add" ? "Fund Disbursement" : "Fund Recovery",
    };

    const finalSign = destinationCurrency === "USD" ? "$" : "៛";
    const notifMsg =
      type === "add"
        ? `+${finalSign}${finalAmountToAddOrDeduct.toLocaleString("en-US", { minimumFractionDigits: destinationCurrency === "USD" ? 2 : 0 })} credited to your account (${actualUserAcc}).`
        : `-${finalSign}${finalAmountToAddOrDeduct.toLocaleString("en-US", { minimumFractionDigits: destinationCurrency === "USD" ? 2 : 0 })} deducted from your account (${actualUserAcc}).`;

    if (targetJointAcc) {
      for (let m of targetJointAcc.members) {
        if (m.status === "active") {
          const memberDoc = await User.findOne({ username: m.username });
          if (memberDoc) {
            await Transaction.create({
              ...userTrx,
              username: m.username,
              userId: memberDoc._id,
            });
            await Notification.create({
              userId: memberDoc._id,
              username: memberDoc.username,
              title: type === "add" ? "Deposit Received" : "Balance Deducted",
              message: notifMsg,
              date: dateStr,
              type: type === "add" ? "deposit" : "deduction",
              isRead: false,
            });
          }
        }
      }
    } else {
      await Transaction.create({
        ...userTrx,
        username: user.username,
        userId: user._id,
      });
      await Notification.create({
        userId: user._id,
        username: user.username,
        title: type === "add" ? "Deposit Received" : "Balance Deducted",
        message: notifMsg,
        date: dateStr,
        type: type === "add" ? "deposit" : "deduction",
        isRead: false,
      });
    }

    await Transaction.create(bankTrx);
    await user.save();
    await centralBank.save();
    await logAdminAction(
      req.admin.username,
      type === "add" ? "Add Money" : "Deduct Money",
      user.username,
      `${type === "add" ? "+" : "-"}${sign}${adjustAmount} -> (${finalSign}${finalAmountToAddOrDeduct})`,
    );

    res.json({
      success: true,
      message: `Operation Success! ទឹកប្រាក់ទទួលបានគឺ ${finalSign}${finalAmountToAddOrDeduct.toLocaleString("en-US", { minimumFractionDigits: destinationCurrency === "USD" ? 2 : 0 })}`,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

const approveTransaction = async (req, res) => {
  const { refId } = req.body;
  try {
    const trx = await Transaction.findOne({ refId: refId, status: "Pending" });
    if (!trx)
      return res.json({
        success: false,
        message: "រកមិនឃើញប្រតិបត្តិការ ឬមិនស្ថិតក្នុងស្ថានភាព Pending ទេ",
      });

    trx.status = "Success";
    await trx.save();

    const u = await User.findById(trx.userId);
    if (u) {
      await Notification.create({
        userId: u._id,
        username: u.username,
        title: "Payment Approved ✅",
        message: `ការទូទាត់ទឹកប្រាក់ ${trx.currency === "USD" ? "$" : "៛"}${Math.abs(trx.amount).toLocaleString()} ត្រូវបានអនុម័តជោគជ័យ។ (Ref: ${refId})`,
        date: getFormattedDate(),
        type: "info",
        isRead: false,
      });

      if (typeof bot !== "undefined" && bot && bot.sendUserPaymentAlert) {
        bot
          .sendUserPaymentAlert(u._id, {
            amount: Math.abs(trx.amount),
            currency: trx.currency,
            senderName: "System Approval",
            refId: refId,
          })
          .catch(() => {});
      }
    }
    await logAdminAction(
      req.admin.username,
      "Approve Transaction",
      u ? u.username : "Unknown",
      `Approved Trx ID: ${refId}`,
    );
    return res.json({ success: true, message: "ប្រតិបត្តិការត្រូវបានអនុម័ត!" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// ============================================================================
// ↩️ អនុគមន៍ជំនួយ និង API សម្រាប់ Admin បង្វិលប្រាក់ (Universal Admin Refund)
// គាំទ្រទាំង Main, Sub, Joint Accounts, Virtual Cards និង Merchant Escrow/Collected
// ============================================================================
async function adjustAccountByNumber(
  userDoc,
  accNum,
  deltaAmount,
  fallbackCurrency = "USD",
) {
  if (!userDoc) return { ok: false, message: "រកមិនឃើញគណនីអតិថិជន!" };

  const cleanAcc = String(accNum || "").includes("_")
    ? String(accNum).split("_")[1]
    : String(accNum || "").trim();

  // ១. ឆែកមើលគណនីចម្បង USD (Main USD)
  if (cleanAcc && userDoc.mainAccounts?.USD?.accountNumber === cleanAcc) {
    if (
      deltaAmount < 0 &&
      (userDoc.mainAccounts.USD.balance || 0) < Math.abs(deltaAmount)
    ) {
      return {
        ok: false,
        message: `សមតុល្យក្នុងគណនីគោល USD (${cleanAcc}) មិនគ្រប់គ្រាន់សម្រាប់កាត់បង្វិលទេ!`,
      };
    }
    userDoc.mainAccounts.USD.balance =
      (userDoc.mainAccounts.USD.balance || 0) + deltaAmount;
    userDoc.markModified("mainAccounts");
    await userDoc.save();
    return { ok: true, accountNumber: cleanAcc, currency: "USD" };
  }

  // ២. ឆែកមើលគណនីចម្បង KHR (Main KHR)
  if (cleanAcc && userDoc.mainAccounts?.KHR?.accountNumber === cleanAcc) {
    if (
      deltaAmount < 0 &&
      (userDoc.mainAccounts.KHR.balance || 0) < Math.abs(deltaAmount)
    ) {
      return {
        ok: false,
        message: `សមតុល្យក្នុងគណនីគោល KHR (${cleanAcc}) មិនគ្រប់គ្រាន់សម្រាប់កាត់បង្វិលទេ!`,
      };
    }
    userDoc.mainAccounts.KHR.balance =
      (userDoc.mainAccounts.KHR.balance || 0) + deltaAmount;
    userDoc.markModified("mainAccounts");
    await userDoc.save();
    return { ok: true, accountNumber: cleanAcc, currency: "KHR" };
  }

  // ៣. ឆែកមើលគណនីរង និង គណនីរួម (Sub & Joint Accounts)
  if (
    cleanAcc &&
    Array.isArray(userDoc.subAccounts) &&
    userDoc.subAccounts.length > 0
  ) {
    const subIdx = userDoc.subAccounts.findIndex(
      (s) => s.accountNumber === cleanAcc,
    );
    if (subIdx !== -1) {
      const subAcc = userDoc.subAccounts[subIdx];
      if (
        subAcc.accountType === "joint" ||
        subAcc.accountType === "joint_member"
      ) {
        const jointDoc = await JointAccount.findOne({
          accountId: subAcc.accountId,
        });
        if (jointDoc) {
          if (
            deltaAmount < 0 &&
            (jointDoc.balance || 0) < Math.abs(deltaAmount)
          ) {
            return {
              ok: false,
              message: `សមតុល្យក្នុងគណនីរួម (${cleanAcc}) មិនគ្រប់គ្រាន់សម្រាប់កាត់បង្វិលទេ!`,
            };
          }
          jointDoc.balance = (jointDoc.balance || 0) + deltaAmount;
          await jointDoc.save();
          userDoc.subAccounts[subIdx].balance = jointDoc.balance;
          userDoc.markModified("subAccounts");
          await userDoc.save();
          return {
            ok: true,
            accountNumber: cleanAcc,
            currency: subAcc.currency || fallbackCurrency,
          };
        }
      } else {
        if (deltaAmount < 0 && (subAcc.balance || 0) < Math.abs(deltaAmount)) {
          return {
            ok: false,
            message: `សមតុល្យក្នុងគណនីរង (${cleanAcc}) មិនគ្រប់គ្រាន់សម្រាប់កាត់បង្វិលទេ!`,
          };
        }
        userDoc.subAccounts[subIdx].balance =
          (subAcc.balance || 0) + deltaAmount;
        userDoc.markModified("subAccounts");
        await userDoc.save();
        return {
          ok: true,
          accountNumber: cleanAcc,
          currency: subAcc.currency || fallbackCurrency,
        };
      }
    }
  }

  // ៤. Fallback បើរកលេខគណនីមិនឃើញ ទម្លាក់ចូលគណនីគោលតាមរូបិយប័ណ្ណ
  if (fallbackCurrency === "KHR" && userDoc.mainAccounts?.KHR) {
    if (
      deltaAmount < 0 &&
      (userDoc.mainAccounts.KHR.balance || 0) < Math.abs(deltaAmount)
    ) {
      return {
        ok: false,
        message: `សមតុល្យ KHR របស់ @${userDoc.username} មិនគ្រប់គ្រាន់ទេ!`,
      };
    }
    userDoc.mainAccounts.KHR.balance =
      (userDoc.mainAccounts.KHR.balance || 0) + deltaAmount;
    userDoc.markModified("mainAccounts");
    await userDoc.save();
    return {
      ok: true,
      accountNumber: userDoc.mainAccounts.KHR.accountNumber,
      currency: "KHR",
    };
  } else if (userDoc.mainAccounts?.USD) {
    if (
      deltaAmount < 0 &&
      (userDoc.mainAccounts.USD.balance || 0) < Math.abs(deltaAmount)
    ) {
      return {
        ok: false,
        message: `សមតុល្យ USD របស់ @${userDoc.username} មិនគ្រប់គ្រាន់ទេ!`,
      };
    }
    userDoc.mainAccounts.USD.balance =
      (userDoc.mainAccounts.USD.balance || 0) + deltaAmount;
    userDoc.markModified("mainAccounts");
    await userDoc.save();
    return {
      ok: true,
      accountNumber: userDoc.mainAccounts.USD.accountNumber,
      currency: "USD",
    };
  }

  return { ok: false, message: "មិនអាចកែប្រែសមតុល្យគណនីបានទេ!" };
}

const refundTransaction = async (req, res) => {
  const access = await checkAdminAccess(req.admin, "refund");
  if (!access.allowed)
    return res.status(403).json({ success: false, message: access.message });

  const { refId, reason } = req.body;
  const cleanRefId = String(refId || "").trim();

  try {
    // ១. ទាញយកប្រតិបត្តិការទាំងអស់ដែលមានលេខយោង (Ref ID) ឬ Hash នេះ
    const trxs = await Transaction.find({
      $or: [{ refId: cleanRefId }, { hash: cleanRefId }],
    });

    if (!trxs || trxs.length === 0) {
      return res.json({
        success: false,
        message: "បរាជ័យ! រកប្រតិបត្តិការនេះមិនឃើញក្នុងប្រព័ន្ធទេ!",
      });
    }

    if (trxs.some((t) => t.status === "Refunded" || t.status === "Voided")) {
      return res.json({
        success: false,
        message:
          "ប្រតិបត្តិការនេះត្រូវបានធ្វើការបង្វិលប្រាក់ (Refund) រួចរាល់ហើយ!",
      });
    }

    // ២. ញែករកវិក្កយបត្រខាងអ្នកចំណាយ (amount < 0) និងខាងអ្នកទទួល/ហាង (amount > 0)
    const senderTrx = trxs.find((t) => t.amount < 0) || trxs[0];
    const receiverTrx = trxs.find((t) => t.amount > 0) || trxs[0];

    const senderAccNum = senderTrx.senderAcc;
    const receiverAccNum = receiverTrx.receiverAcc;

    // ៣. ស្វែងរកគណនីអតិថិជនជាអ្នកចំណាយ (Sender / Customer)
    let senderUser = null;
    if (senderTrx.amount < 0 && senderTrx.username) {
      senderUser = await User.findOne({ username: senderTrx.username });
    }
    if (!senderUser && senderAccNum && senderAccNum !== "N/A") {
      senderUser = await User.findOne({
        $or: [
          { "mainAccounts.USD.accountNumber": senderAccNum },
          { "mainAccounts.KHR.accountNumber": senderAccNum },
          { "subAccounts.accountNumber": senderAccNum },
        ],
      });
    }
    if (!senderUser && senderTrx.senderName) {
      senderUser = await User.findOne({
        $or: [
          { username: senderTrx.senderName },
          { fullName: senderTrx.senderName },
        ],
      });
    }

    // ៤. ស្វែងរកហាង (បើជាប្រតិបត្តិការហាង) និងម្ចាស់គណនីទទួលប្រាក់ (Receiver / Shop Owner)
    const merchIdVal = receiverTrx.merchantId || senderTrx.merchantId;
    let shop = null;
    if (merchIdVal) {
      shop = await Merchant.findOne({
        $or: [
          { merchantId: merchIdVal },
          ...(mongoose.isValidObjectId(merchIdVal)
            ? [{ _id: merchIdVal }]
            : []),
        ],
      });
    }
    if (!shop && receiverAccNum) {
      shop = await Merchant.findOne({
        $or: [
          { "accountNumbers.USD": receiverAccNum },
          { "accountNumbers.KHR": receiverAccNum },
          { "linkedAccounts.USD": receiverAccNum },
          { "linkedAccounts.KHR": receiverAccNum },
          { "cashiers.virtualAccounts.USD": receiverAccNum },
          { "cashiers.virtualAccounts.KHR": receiverAccNum },
        ],
      });
    }

    let receiverUser = null;
    if (shop) {
      receiverUser = await User.findOne({
        $or: [
          { username: shop.username || shop.userId },
          { _id: shop.ownerId },
        ],
      });
    }
    if (!receiverUser && receiverTrx.amount > 0 && receiverTrx.username) {
      receiverUser = await User.findOne({ username: receiverTrx.username });
    }
    if (!receiverUser && receiverAccNum && receiverAccNum !== "N/A") {
      receiverUser = await User.findOne({
        $or: [
          { "mainAccounts.USD.accountNumber": receiverAccNum },
          { "mainAccounts.KHR.accountNumber": receiverAccNum },
          { "subAccounts.accountNumber": receiverAccNum },
        ],
      });
    }

    if (!senderUser || !receiverUser) {
      return res.json({
        success: false,
        message: "រកមិនឃើញគណនីអ្នកផ្ញើ ឬអ្នកទទួលពិតប្រាកដដើម្បីបង្វិលប្រាក់ទេ!",
      });
    }

    // ៥. គណនាទឹកប្រាក់ដែលត្រូវដកពីអ្នកទទួល និងទឹកប្រាក់ដែលត្រូវបង្វិលចូលអ្នកចំណាយ
    const receiverCurrency = receiverTrx.currency || "USD";
    const senderCurrency = senderTrx.currency || receiverCurrency;

    const deductFromReceiverAmt = Math.abs(Number(receiverTrx.amount));
    const creditToSenderAmt = Math.abs(Number(senderTrx.amount));

    // កំណត់លេខកុងពិតប្រាកដរបស់ហាង/អ្នកទទួល (បើ receiverAccNum ជាកុង Virtual 888/999 ត្រូវប្តូរទៅកុង Linked ពិតប្រាកដ)
    let actualReceiverLinkedAcc = receiverAccNum;
    if (shop) {
      const isVirtualAcc =
        receiverAccNum === shop.accountNumbers?.USD ||
        receiverAccNum === shop.accountNumbers?.KHR ||
        (shop.cashiers || []).some(
          (c) =>
            c.virtualAccounts?.USD === receiverAccNum ||
            c.virtualAccounts?.KHR === receiverAccNum ||
            c.virtualAccount === receiverAccNum,
        );
      if (
        isVirtualAcc &&
        shop.linkedAccounts &&
        shop.linkedAccounts[receiverCurrency]
      ) {
        actualReceiverLinkedAcc = shop.linkedAccounts[receiverCurrency];
      }
    }

    // ៦. ដកលុយពីគណនីអ្នកទទួល / ម្ចាស់ហាង
    const deductRes = await adjustAccountByNumber(
      receiverUser,
      actualReceiverLinkedAcc,
      -deductFromReceiverAmt,
      receiverCurrency,
    );

    if (!deductRes.ok) {
      return res.json({
        success: false,
        message: `មិនអាច Refund បានទេ! ${deductRes.message}`,
      });
    }

    // បើជាហាង ត្រូវកាត់បន្ថយចំណូលក្នុង Escrow Hold ឬ Collected ផងដែរ
    if (shop) {
      if (receiverTrx.status === "Hold") {
        if (receiverCurrency === "USD") {
          shop.escrowHold.USD = Math.max(
            0,
            (shop.escrowHold?.USD || 0) - deductFromReceiverAmt,
          );
        } else {
          shop.escrowHold.KHR = Math.max(
            0,
            (shop.escrowHold?.KHR || 0) - deductFromReceiverAmt,
          );
        }
        shop.markModified("escrowHold");
      } else {
        if (receiverCurrency === "USD") {
          shop.collected.USD = Math.max(
            0,
            (shop.collected?.USD || 0) - deductFromReceiverAmt,
          );
        } else {
          shop.collected.KHR = Math.max(
            0,
            (shop.collected?.KHR || 0) - deductFromReceiverAmt,
          );
        }
        shop.markModified("collected");
      }
      await shop.save();
    }

    // ៧. បង្វិលលុយចូលគណនីដើមរបស់អតិថិជន (Sender / Card's Linked Account)
    const creditRes = await adjustAccountByNumber(
      senderUser,
      senderAccNum,
      creditToSenderAmt,
      senderCurrency,
    );

    // ៨. ប្តូរស្ថានភាពប្រតិបត្តិការចាស់ទៅជា "Refunded" និងបង្កើតវិក្កយបត្រ Refund ថ្មី
    const dateNow =
      typeof getFormattedDate === "function"
        ? getFormattedDate()
        : new Date().toLocaleString("en-US", {
            timeZone: "Asia/Phnom_Penh",
            hour12: true,
          });

    await Transaction.updateMany(
      { $or: [{ refId: cleanRefId }, { hash: cleanRefId }] },
      {
        $set: {
          status: "Refunded",
          remark: `[REFUNDED BY ADMIN] មូលហេតុ: ${reason}`,
        },
      },
    );

    const newRefId = generateStandardRefId("RFD");
    const newHash = generateStandardHash();
    const shopOrReceiverName = shop
      ? shop.name
      : receiverUser.fullName || receiverUser.username;
    const customerDisplayName = senderUser.fullName || senderUser.username;

    // វិក្កយបត្រសម្រាប់អតិថិជន (ទទួលលុយវិញ)
    await Transaction.create({
      userId: senderUser._id,
      username: senderUser.username,
      refId: newRefId,
      hash: newHash,
      date: dateNow,
      type: "Refunded",
      amount: creditToSenderAmt,
      currency: creditRes.currency || senderCurrency,
      fee: 0,
      senderName: shopOrReceiverName,
      senderAcc: deductRes.accountNumber,
      receiverName: customerDisplayName,
      receiverAcc: creditRes.accountNumber,
      cardId: senderTrx.cardId || receiverTrx.cardId,
      cardNumber: senderTrx.cardNumber || receiverTrx.cardNumber,
      remark: `បង្វិលប្រាក់ដោយ Admin (Ref: ${cleanRefId}) - ${reason}`,
      status: "Success",
      trxMethod: "Admin Refund",
    });

    // វិក្កយបត្រសម្រាប់ម្ចាស់ហាង/អ្នកទទួល (កាត់លុយចេញ)
    await Transaction.create({
      userId: receiverUser._id,
      username: receiverUser.username,
      merchantId: shop ? shop.merchantId : merchIdVal || null,
      refId: newRefId,
      hash: newHash,
      date: dateNow,
      type: "Refund",
      amount: -deductFromReceiverAmt,
      currency: deductRes.currency || receiverCurrency,
      fee: 0,
      senderName: shopOrReceiverName,
      senderAcc: deductRes.accountNumber,
      receiverName: customerDisplayName,
      receiverAcc: creditRes.accountNumber,
      remark: `កាត់បង្វិលប្រាក់ឱ្យអតិថិជនដោយ Admin (Ref: ${cleanRefId}) - ${reason}`,
      status: "Success",
      trxMethod: "Admin Refund",
    });

    // ៩. ផ្ញើសារជូនដំណឹង (In-App Notifications & Real-time Socket)
    const senderSym =
      (creditRes.currency || senderCurrency) === "KHR" ? "៛" : "$";
    const receiverSym =
      (deductRes.currency || receiverCurrency) === "KHR" ? "៛" : "$";

    await Notification.create([
      {
        userId: senderUser._id,
        username: senderUser.username,
        title: "ប្រាក់ត្រូវបានបង្វិលត្រឡប់ (Refunded) ↩️",
        message: `ទឹកប្រាក់ ${senderSym}${creditToSenderAmt.toLocaleString()} ពីប្រតិបត្តិការ #${cleanRefId} ត្រូវបានបង្វិលចូលគណនី (${creditRes.accountNumber}) របស់អ្នកវិញ។ មូលហេតុ: ${reason}`,
        date: dateNow,
        type: "refund_receive",
        isRead: false,
      },
      {
        userId: receiverUser._id,
        username: receiverUser.username,
        title: "កាត់ប្រាក់បង្វិលសងអតិថិជន (Refund Deducted) ⚠️",
        message: `ទឹកប្រាក់ ${receiverSym}${deductFromReceiverAmt.toLocaleString()} នៃប្រតិបត្តិការ #${cleanRefId} ត្រូវបានដកចេញពីគណនី (${deductRes.accountNumber}) ដើម្បីបង្វិលជូនអតិថិជនវិញដោយ Admin។ មូលហេតុ: ${reason}`,
        date: dateNow,
        type: "info",
        isRead: false,
      },
    ]);

    if (global.io) {
      global.io.to(senderUser.username).emit("transactionUpdated");
      global.io.to(receiverUser.username).emit("transactionUpdated");
    }

    await logAdminAction(
      req.admin.username,
      "Refund Transaction",
      `${receiverUser.username} -> ${senderUser.username}`,
      `Refunded ${receiverSym}${deductFromReceiverAmt} (Ref: ${cleanRefId}). Reason: ${reason}`,
    );

    return res.json({
      success: true,
      message: `បង្វិលប្រាក់ពី ${shopOrReceiverName} ទៅកាន់គណនី (${creditRes.accountNumber}) របស់ @${senderUser.username} បានជោគជ័យ ១០០%!`,
    });
  } catch (err) {
    console.error("Admin Refund Error:", err);
    res
      .status(500)
      .json({ success: false, message: "Server Error: " + err.message });
  }
};

// =======================================================
// 🟢 [Admin] ដោះ Hold ប្រតិបត្តិការហាង (Release Escrow Hold -> Success)
// =======================================================
const releaseMerchantHold = async (req, res) => {
  const access = await checkAdminAccess(req.admin, "approveTransaction"); // ឬសិទ្ធិសមស្រប
  if (!access.allowed)
    return res.status(403).json({ success: false, message: access.message });

  const { refId } = req.body;
  const cleanRefId = String(refId || "").trim();

  try {
    const trx = await Transaction.findOne({
      $or: [{ refId: cleanRefId }, { hash: cleanRefId }],
      status: "Hold",
    });

    if (!trx) {
      return res.json({
        success: false,
        message: "រកមិនឃើញប្រតិបត្តិការដែលមានស្ថានភាព Hold ទេ!",
      });
    }

    // ១. ប្តូរស្ថានភាព Transaction ពី Hold ទៅជា Success
    trx.status = "Success";
    await trx.save();

    // មកអាប់ដេតគ្រប់ transaction ពាក់ព័ន្ធទាំងអស់ (ទាំងฝั่ง Sender និង Receiver)
    await Transaction.updateMany(
      { $or: [{ refId: cleanRefId }, { hash: cleanRefId }], status: "Hold" },
      { $set: { status: "Success" } },
    );

    // ២. ຊອກរកហាង (Merchant) ដើម្បីកាត់លុយចេញពី Escrow Hold បូកចូល Collected ពិតប្រាកដ
    const merchIdVal = trx.merchantId;
    if (merchIdVal) {
      const shop = await Merchant.findOne({
        $or: [
          { merchantId: merchIdVal },
          ...(mongoose.isValidObjectId(merchIdVal)
            ? [{ _id: merchIdVal }]
            : []),
        ],
      });

      if (shop) {
        const amt = Math.abs(Number(trx.amount));
        if (trx.currency === "KHR") {
          shop.escrowHold.KHR = Math.max(0, (shop.escrowHold?.KHR || 0) - amt);
          shop.collected.KHR = (shop.collected?.KHR || 0) + amt;
        } else {
          shop.escrowHold.USD = Math.max(0, (shop.escrowHold?.USD || 0) - amt);
          shop.collected.USD = (shop.collected?.USD || 0) + amt;
        }
        shop.markModified("escrowHold");
        shop.markModified("collected");
        await shop.save();
      }
    }

    // ៣. ផ្ញើសារជូនដំណឹងទៅកាន់អតិថិជន (User)
    const u = await User.findOne({ username: trx.username });
    if (u) {
      const curSym = trx.currency === "KHR" ? "៛" : "$";
      await Notification.create({
        userId: u._id,
        username: u.username,
        title: "Payment Released ✅",
        message: `ការទូទាត់ទឹកប្រាក់ ${curSym}${Math.abs(trx.amount).toLocaleString()} របស់អ្នកត្រូវបានអនុម័ត និងទម្លាក់ជូនហាងជោគជ័យ។ (Ref: ${cleanRefId})`,
        date:
          typeof getFormattedDate === "function"
            ? getFormattedDate()
            : new Date().toLocaleString(),
        type: "info",
        isRead: false,
      });
    }

    await logAdminAction(
      req.admin.username,
      "Release Merchant Hold",
      u ? u.username : "Merchant",
      `Released Hold for Trx ID: ${cleanRefId}`,
    );

    return res.json({
      success: true,
      message: `ប្រាក់ត្រូវបានដោះ Hold និងទម្លាក់ចូលហាងដោយជោគជ័យ ១០០%!`,
    });
  } catch (err) {
    console.error("Release Hold Error:", err);
    res
      .status(500)
      .json({ success: false, message: "Server Error: " + err.message });
  }
};

const getPublicReceipt = async (req, res) => {
  try {
    const { id } = req.params;

    // 🟢 ថែម { ticketId: id } ចូលទីនេះ ដើម្បីឱ្យវាស្គាល់លេខ TCK-... ពេលស្កេន QR
    let ticketQuery = [{ transactionId: id }, { ticketId: id }];
    if (mongoose.isValidObjectId(id)) {
      ticketQuery.push({ _id: id });
    }
    let ticket = await CashierTicket.findOne({ $or: ticketQuery });

    if (ticket) {
      let ticketObj = ticket.toObject ? ticket.toObject() : ticket;

      if (ticketObj.maker) {
        const adminMaker = await Admin.findOne({ username: ticketObj.maker });
        ticketObj.makerFullName = adminMaker
          ? adminMaker.fullName || adminMaker.username
          : ticketObj.maker;
      }

      // 🟢 បើក្នុង ticket.slipData គ្មានសមតុល្យ យើងគណនាជំនួសអោយ
      if (!ticketObj.slipData) ticketObj.slipData = {};
      if (ticketObj.slipData.priorBalance === undefined) {
        const targetUser = await User.findById(ticketObj.userId);
        if (targetUser) {
          let currentBal = 0;
          if (
            ticketObj.targetAcc === targetUser.mainAccounts?.USD?.accountNumber
          )
            currentBal = targetUser.mainAccounts.USD.balance || 0;
          else if (
            ticketObj.targetAcc === targetUser.mainAccounts?.KHR?.accountNumber
          )
            currentBal = targetUser.mainAccounts.KHR.balance || 0;
          else {
            const sub = targetUser.subAccounts?.find(
              (s) => s.accountNumber === ticketObj.targetAcc,
            );
            if (sub) currentBal = sub.balance || 0;
          }

          // គណនាសមតុល្យថយក្រោយរក Prior Balance
          ticketObj.slipData.newBalance = currentBal;
          ticketObj.slipData.priorBalance =
            ticketObj.requestType === "Deposit"
              ? currentBal - ticketObj.amount
              : currentBal + ticketObj.amount;
        }
      }

      return res.json({ success: true, data: ticketObj, source: "ticket" });
    }

    // ២. បើជា Transaction
    const trx = await Transaction.findOne({ refId: id });
    if (trx) {
      const originalTicket = await CashierTicket.findOne({
        transactionId: trx.refId,
      });
      let finalData = trx.toObject ? trx.toObject() : trx;

      if (originalTicket && originalTicket.maker) {
        const adminMaker = await Admin.findOne({
          username: originalTicket.maker,
        });
        finalData.maker = adminMaker
          ? adminMaker.fullName || adminMaker.username
          : originalTicket.maker;
        if (originalTicket.slipData) {
          finalData.slipData = originalTicket.slipData;
        }
      } else {
        finalData.maker = "System";
      }

      // 🟢 បើ transaction គ្មាន slipData សមតុល្យ យើងគណនារកអោយដូចគ្នា
      if (!finalData.slipData) finalData.slipData = {};
      if (finalData.slipData.priorBalance === undefined) {
        const targetUser = await User.findOne({
          $or: [
            { username: finalData.username },
            {
              "mainAccounts.USD.accountNumber":
                finalData.receiverAcc || finalData.senderAcc,
            },
            {
              "mainAccounts.KHR.accountNumber":
                finalData.receiverAcc || finalData.senderAcc,
            },
          ],
        });

        if (targetUser) {
          let currentBal = targetUser.mainAccounts?.USD?.balance || 0;
          const isDep = (finalData.type || "")
            .toLowerCase()
            .includes("deposit");

          finalData.slipData.newBalance = currentBal;
          finalData.slipData.priorBalance = isDep
            ? currentBal - Math.abs(finalData.amount)
            : currentBal + Math.abs(finalData.amount);
          finalData.slipData.customerName =
            targetUser.fullName || targetUser.username;
          finalData.slipData.depositorAccount = "N/A";
        }
      }

      return res.json({
        success: true,
        data: finalData,
        source: "transaction",
      });
    }

    return res.json({
      success: false,
      message: "រកមិនឃើញវិក្កយបត្រនេះទេ ឬលេខកូដមិនត្រឹមត្រូវ!",
    });
  } catch (error) {
    console.error("Receipt Fetch Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal Database Error" });
  }
};

// ==========================================
// 🛍️ ផ្នែកទី ៨៖ បញ្ជរគិតប្រាក់ (Cashier System)
// ==========================================

const searchCashierUser = async (req, res) => {
  try {
    const { identifier } = req.params;
    // ដើម្បីកុំឱ្យ Case-sensitive ពេលវាយ Username (ឧ. DARA និង dara គឺដូចគ្នា)
    const regex = new RegExp("^" + identifier + "$", "i");

    // 🟢 កែប្រែ៖ ឱ្យអាចស្វែងរកបានតាម លេខគណនី, Username, ID អតិថិជន, ឬ លេខទូរស័ព្ទ
    const user = await User.findOne({
      $or: [
        { "mainAccounts.USD.accountNumber": identifier },
        { "mainAccounts.KHR.accountNumber": identifier },
        { "subAccounts.accountNumber": identifier },
        { username: regex },
        { userId: identifier },
        { phone: identifier },
      ],
    }).select("-password -pin");

    if (!user)
      return res.json({
        success: false,
        message: "រកមិនឃើញគណនីដែលមានលេខកុង ឬឈ្មោះនេះទេ!",
      });

    let userDetails = user.toObject();
    userDetails.kycDocument =
      userDetails.kycDocument ||
      userDetails.kycImage ||
      userDetails.idCardImage ||
      "";
    userDetails.kycImage = userDetails.kycDocument;

    res.json({ success: true, user: userDetails });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// ========================================================================
// 🛠️ HELPER FUNCTION: អនុវត្តការកាត់/បញ្ចូលលុយពិតប្រាកដក្នុង Database
// ========================================================================
const executeCashierTransaction = async (
  targetUser,
  targetAccount,
  requestType,
  depositorName,
  depositorAccount,
  currency,
  cashAmount,
  remark,
  actionType = "FULL",
) => {
  const centralBank = await User.findOne({
    "mainAccounts.USD.accountNumber": "888888888",
  });
  if (!centralBank)
    return { success: false, message: "រកមិនឃើញគណនី Central Bank!" };

  const isInputKHR = currency === "KHR";
  let destCurrency = "USD",
    actualReceiverAcc = targetAccount,
    subIndex = -1;

  if (targetAccount === targetUser.mainAccounts?.USD?.accountNumber)
    destCurrency = "USD";
  else if (targetAccount === targetUser.mainAccounts?.KHR?.accountNumber)
    destCurrency = "KHR";
  else {
    subIndex = targetUser.subAccounts.findIndex(
      (s) => s.accountNumber === targetAccount,
    );
    if (subIndex !== -1)
      destCurrency = targetUser.subAccounts[subIndex].currency;
  }

  const currentFXRates = readFXRates();
  let finalReceiveAmount = cashAmount;
  if (currency === "USD" && destCurrency === "KHR")
    finalReceiveAmount = cashAmount * currentFXRates.usdToKhrBuy;
  else if (currency === "KHR" && destCurrency === "USD")
    finalReceiveAmount = cashAmount / currentFXRates.usdToKhrSell;

  const bankModifier = requestType === "Deposit" ? -cashAmount : cashAmount;
  const userModifier =
    requestType === "Deposit" ? finalReceiveAmount : -finalReceiveAmount;

  // 🟢 ផ្នែកទី ១៖ ធ្វើការកាត់ ឬ បញ្ចូលលុយ (Hold ឬ ទូទាត់ពិតប្រាកដ)
  if (
    [
      "FULL",
      "HOLD_WITHDRAWAL",
      "APPROVE_DEPOSIT",
      "REVERT_WITHDRAWAL",
    ].includes(actionType)
  ) {
    let finalUserMod = userModifier;
    let finalBankMod = bankModifier;

    if (actionType === "REVERT_WITHDRAWAL") {
      finalUserMod = Math.abs(userModifier);
      finalBankMod = -cashAmount;
    }

    if (
      ["FULL", "HOLD_WITHDRAWAL"].includes(actionType) &&
      requestType === "Withdrawal"
    ) {
      let currentBal = 0;
      if (destCurrency === "USD" && subIndex === -1)
        currentBal = targetUser.mainAccounts.USD.balance;
      else if (destCurrency === "KHR" && subIndex === -1)
        currentBal = targetUser.mainAccounts.KHR.balance || 0;
      else if (subIndex !== -1)
        currentBal = targetUser.subAccounts[subIndex].balance;

      if (currentBal < finalReceiveAmount) {
        return {
          success: false,
          message: "បរាជ័យ! លុយក្នុងគណនីអតិថិជនមិនគ្រប់គ្រាន់ទេ!",
        };
      }
    }

    if (destCurrency === "USD" && subIndex === -1)
      targetUser.mainAccounts.USD.balance += finalUserMod;
    else if (destCurrency === "KHR" && subIndex === -1)
      targetUser.mainAccounts.KHR.balance =
        (targetUser.mainAccounts.KHR.balance || 0) + finalUserMod;
    else if (subIndex !== -1)
      targetUser.subAccounts[subIndex].balance += finalUserMod;

    if (isInputKHR)
      centralBank.mainAccounts.KHR.balance =
        (centralBank.mainAccounts.KHR.balance || 0) + finalBankMod;
    else
      centralBank.mainAccounts.USD.balance =
        (centralBank.mainAccounts.USD.balance || 0) + finalBankMod;

    await targetUser.save();
    await centralBank.save();
  }

  // 🟢 បើគ្រាន់តែ Hold លុយ ឬ សងលុយ គឺបញ្ចប់ត្រឹមនេះ
  if (actionType === "HOLD_WITHDRAWAL" || actionType === "REVERT_WITHDRAWAL") {
    return { success: true, transactionId: "HELD_OR_REVERTED" };
  }

  const dateStr = new Date().toLocaleString("en-US", {
    timeZone: "Asia/Phnom_Penh",
    hour12: true,
  });
  const refId = generateStandardRefId(
    requestType === "Deposit" ? "DEP" : "WIT",
  );

  const autoRemark =
    requestType === "Deposit"
      ? `ដាក់ប្រាក់ដោយ: ${depositorName} (${depositorAccount})`
      : `ដកប្រាក់ដោយ: ${depositorName} (${depositorAccount})`;

  let finalRemark = remark || "";
  if (!finalRemark.includes(autoRemark)) {
    finalRemark =
      remark && remark.trim() !== ""
        ? `${remark.trim()} | ${autoRemark}`
        : autoRemark;
  }

  const targetTrx = await Transaction.create({
    userId: targetUser._id,
    username: targetUser.username,
    refId: refId,
    hash: generateStandardHash(),
    date: dateStr,
    type: `Cash ${requestType}`,
    amount: userModifier,
    currency: destCurrency,
    fee: 0,
    senderName:
      requestType === "Deposit" ? "Cash Deposit" : targetUser.fullName,
    senderAcc: requestType === "Deposit" ? "" : actualReceiverAcc,
    receiverName:
      requestType === "Deposit" ? targetUser.fullName : "Cash Withdrawal",
    receiverAcc: requestType === "Deposit" ? actualReceiverAcc : "",
    remark: finalRemark,
    status: "Success",
    trxMethod: `Cash ${requestType}`,
  });

  await Transaction.create({
    ...targetTrx.toObject(),
    _id: new mongoose.Types.ObjectId(),
    userId: centralBank._id,
    username: centralBank.username,
    amount: bankModifier,
    currency: currency,
    type: requestType === "Deposit" ? "Fund Disbursement" : "Fund Recovery",
  });

  const sign = requestType === "Deposit" ? "+" : "-";
  const formattedAmount = `${sign}${destCurrency === "USD" ? "$" : "៛"}${finalReceiveAmount.toLocaleString("en-US", { minimumFractionDigits: destCurrency === "USD" ? 2 : 0 })}`;

  let notifMsg =
    requestType === "Deposit"
      ? `ទឹកប្រាក់ ${formattedAmount} ត្រូវបានដាក់បញ្ចូលទៅក្នុងគណនី (${actualReceiverAcc}) របស់អ្នកដោយជោគជ័យ តាមរយៈបញ្ជរធនាគារ (Cashier)។ [អ្នកដាក់ប្រាក់: ${depositorName}]`
      : `ទឹកប្រាក់ ${formattedAmount} ត្រូវបានដកចេញពីគណនី (${actualReceiverAcc}) របស់អ្នកដោយជោគជ័យ តាមរយៈបញ្ជរធនាគារ (Cashier)។ [អ្នកដកប្រាក់: ${depositorName}]`;

  let cleanRemark = remark ? remark.trim() : "";
  if (cleanRemark.includes(" | ")) cleanRemark = cleanRemark.split(" | ")[0];
  if (cleanRemark && cleanRemark !== "") notifMsg += `\nចំណាំ៖ ${cleanRemark}`;

  await Notification.create({
    userId: targetUser._id,
    username: targetUser.username,
    title:
      requestType === "Deposit" ? "Deposit Received ✅" : "Balance Deducted 🔻",
    message: notifMsg,
    date: dateStr,
    type: requestType === "Deposit" ? "deposit" : "deduction",
    isRead: false,
    metadata: { refId: refId, sender: "system" },
  });

  return { success: true, transactionId: refId };
};

// ========================================================================
// 🏦 MAIN API 1: បង្កើតប្រតិបត្តិការ (Maker Request)
// ========================================================================
const createCashierTicket = async (req, res) => {
  const {
    targetUsername,
    targetAccount,
    requestType,
    depositorName,
    depositorAccount,
    currency,
    amount,
    remark,
  } = req.body;

  try {
    const targetUser = await User.findOne({ username: targetUsername });
    if (!targetUser)
      return res.json({ success: false, message: "រកមិនឃើញអតិថិជននេះទេ!" });

    const cashAmount = parseFloat(amount);

    // 🟢 គណនាសមតុល្យ (Balance) ឱ្យហើយ សម្រាប់ទាំង Withdrawal និង Deposit
    let currentBal = 0;
    let targetCurrency = "USD";

    if (targetAccount === targetUser.mainAccounts?.USD?.accountNumber) {
      currentBal = targetUser.mainAccounts.USD.balance || 0;
      targetCurrency = "USD";
    } else if (targetAccount === targetUser.mainAccounts?.KHR?.accountNumber) {
      currentBal = targetUser.mainAccounts.KHR.balance || 0;
      targetCurrency = "KHR";
    } else {
      const subAcc = targetUser.subAccounts?.find(
        (s) => s.accountNumber === targetAccount,
      );
      if (subAcc) {
        currentBal = subAcc.balance || 0;
        targetCurrency = subAcc.currency;
      }
    }

    // គណនាទឹកប្រាក់ (ករណីជាន់រូបិយប័ណ្ណ)
    let finalReceiveAmount = cashAmount;
    const currentFXRates = readFXRates();
    if (currency === "USD" && targetCurrency === "KHR") {
      finalReceiveAmount = cashAmount * currentFXRates.usdToKhrBuy;
    } else if (currency === "KHR" && targetCurrency === "USD") {
      finalReceiveAmount = cashAmount / currentFXRates.usdToKhrSell;
    }

    if (requestType === "Withdrawal") {
      if (currentBal < finalReceiveAmount) {
        return res.json({
          success: false,
          message: `ប្រតិបត្តិការបរាជ័យ! លុយក្នុងគណនី (${targetAccount}) មិនគ្រប់គ្រាន់ទេ!`,
        });
      }
    }

    const isBigTrx =
      (currency === "USD" && cashAmount > 10000) ||
      (currency === "KHR" && cashAmount > 40000000);
    const ticketStatus = isBigTrx ? "pending_approve" : "pending_verify";
    const newTicketId = generateStandardRefId("TCK");

    if (isBigTrx && requestType === "Withdrawal") {
      const holdResult = await executeCashierTransaction(
        targetUser,
        targetAccount,
        requestType,
        depositorName,
        depositorAccount,
        currency,
        cashAmount,
        remark,
        "HOLD_WITHDRAWAL",
      );
      if (!holdResult.success)
        return res.json({ success: false, message: holdResult.message });
    }

    const autoRemark =
      requestType === "Deposit"
        ? `ដាក់ប្រាក់ដោយ: ${depositorName} (${depositorAccount || "N/A"})`
        : `ដកប្រាក់ដោយ: ${depositorName} (${depositorAccount || "N/A"})`;
    const finalRemark =
      remark && remark.trim() !== ""
        ? `${remark.trim()} | ${autoRemark}`
        : autoRemark;

    // 🟢 កំណត់ Prior Balance និង New Balance ឱ្យច្បាស់លាស់ ទុកបង្ហាញលើ Slip
    const priorBalance = currentBal;
    const newBalance =
      requestType === "Deposit"
        ? currentBal + finalReceiveAmount
        : currentBal - finalReceiveAmount;

    const newTicket = new CashierTicket({
      userId: targetUser._id,
      ticketId: newTicketId,
      maker: req.admin.username,
      requestType,
      amount: cashAmount,
      currency,
      targetAcc: targetAccount,
      depositorName,
      status: ticketStatus,
      remark: finalRemark,
      slipData: {
        customerName: targetUser.fullName || targetUser.username,
        depositorAccount: depositorAccount || "N/A",
        priorBalance: priorBalance, // 🟢 Save សមតុល្យចាស់ចូល DB
        newBalance: newBalance, // 🟢 Save សមតុល្យថ្មីចូល DB
      },
    });

    if (!isBigTrx) {
      const result = await executeCashierTransaction(
        targetUser,
        targetAccount,
        requestType,
        depositorName,
        depositorAccount,
        currency,
        cashAmount,
        remark,
        "FULL",
      );
      if (!result.success)
        return res.json({ success: false, message: result.message });
      newTicket.transactionId = result.transactionId;
    }

    await newTicket.save();
    await logAdminAction(
      req.admin.username,
      "Create Cashier Ticket",
      targetUser.username,
      `Type: ${requestType}, Amount: ${cashAmount}`,
    );

    res.json({
      success: true,
      message: isBigTrx
        ? "ប្រព័ន្ធបានឃាត់ប្រាក់ទុក! រង់ចាំការអនុម័ត (Pending Approval)"
        : "ប្រតិបត្តិការជោគជ័យ! លុយបានបញ្ចូលរួចរាល់",
      ticket: newTicket,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// ========================================================================
// 🏦 MAIN API 2: ទាញយកបញ្ជី Ticket ទាំងអស់ (សម្រាប់ Checker)
// ========================================================================
const getCashierTickets = async (req, res) => {
  try {
    const tickets = await CashierTicket.find()
      .sort({ createdAt: -1 })
      .limit(200);
    res.json({ success: true, tickets });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

// ========================================================================
// 🏦 MAIN API 3: អនុម័ត / បដិសេធ ប្រតិបត្តិការ (Checker Action)
// ========================================================================
const actionCashierTicket = async (req, res) => {
  const { ticketId, action, reason } = req.body;
  try {
    const ticket = await CashierTicket.findById(ticketId);
    if (!ticket)
      return res.json({ success: false, message: "រកមិនឃើញសំបុត្រនេះទេ!" });
    if (ticket.maker === req.admin.username)
      return res.json({
        success: false,
        message: "អ្នកមិនអាចអនុម័តប្រតិបត្តិការដែលខ្លួនឯងបញ្ចូលបានទេ!",
      });

    const targetUser = await User.findById(ticket.userId);
    if (!targetUser)
      return res.json({ success: false, message: "រកមិនឃើញអតិថិជននេះទេ!" });

    if (action === "approve") {
      if (ticket.status === "pending_approve") {
        const actionType =
          ticket.requestType === "Withdrawal"
            ? "APPROVE_WITHDRAWAL"
            : "APPROVE_DEPOSIT";

        const result = await executeCashierTransaction(
          targetUser,
          ticket.targetAcc,
          ticket.requestType,
          ticket.depositorName,
          ticket.slipData?.depositorAccount || "N/A",
          ticket.currency,
          ticket.amount,
          ticket.remark,
          actionType,
        );
        if (!result.success)
          return res.json({ success: false, message: result.message });
        ticket.transactionId = result.transactionId;
        ticket.status = "approved";
      } else if (ticket.status === "pending_verify") {
        ticket.status = "verified";
      }
      ticket.checker = req.admin.username;
      await ticket.save();
      res.json({ success: true, message: "បានអនុម័តជោគជ័យ!" });
    } else if (action === "reject") {
      if (
        ticket.status === "pending_approve" &&
        ticket.requestType === "Withdrawal"
      ) {
        await executeCashierTransaction(
          targetUser,
          ticket.targetAcc,
          ticket.requestType,
          ticket.depositorName,
          ticket.slipData?.depositorAccount || "N/A",
          ticket.currency,
          ticket.amount,
          ticket.remark,
          "REVERT_WITHDRAWAL",
        );

        const curSymbol = ticket.currency === "USD" ? "$" : "៛";
        const dateStr = new Date().toLocaleString("en-US", {
          timeZone: "Asia/Phnom_Penh",
          hour12: true,
        });

        await Notification.create({
          userId: targetUser._id,
          username: targetUser.username,
          title: "Withdrawal Rejected ❌",
          message: `សំណើដកប្រាក់ចំនួន ${curSymbol}${ticket.amount.toLocaleString()} ត្រូវបានបដិសេធ។ ទឹកប្រាក់ត្រូវបានបង្វិលចូលគណនីរបស់អ្នកវិញរួចរាល់។ មូលហេតុ: ${reason}`,
          date: dateStr,
          type: "info",
          isRead: false,
          metadata: { sender: "system" },
        });
      }

      ticket.status = "rejected";
      ticket.rejectReason = reason;
      ticket.checker = req.admin.username;
      await ticket.save();

      res.json({
        success: true,
        message: "បានបដិសេធជោគជ័យ និងបានបង្វិលប្រាក់ត្រលប់ចូលគណនីវិញ!",
      });
    }
  } catch (err) {
    console.error("Action Ticket Error:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// ==========================================
// 💳 ផ្នែកទី ៩៖ កាតនិម្មិត និងហាងទំនិញ
// ==========================================

// 🔍 អនុគមន៍ជំនួយ៖ ស្វែងរកគណនីពិតប្រាកដរបស់ User (Main, Sub, ឬ Joint)
async function resolveAdminUserAccount(user, linkedAccStr) {
  let rawAcc = String(linkedAccStr || "USD");
  let accNum = rawAcc.includes("_") ? rawAcc.split("_")[1] : rawAcc;

  if (accNum === "USD" || accNum === user.mainAccounts?.USD?.accountNumber) {
    return {
      type: "MAIN_USD",
      accObj: user.mainAccounts.USD,
      currency: "USD",
      accountNumber:
        user.mainAccounts?.USD?.accountNumber || user.accountNumber,
    };
  }
  if (accNum === "KHR" || accNum === user.mainAccounts?.KHR?.accountNumber) {
    return {
      type: "MAIN_KHR",
      accObj: user.mainAccounts.KHR,
      currency: "KHR",
      accountNumber:
        user.mainAccounts?.KHR?.accountNumber || user.accountNumberKHR,
    };
  }
  if (user.subAccounts && user.subAccounts.length > 0) {
    const idx = user.subAccounts.findIndex(
      (s) =>
        s.accountNumber === accNum ||
        `${s.currency}_${s.accountNumber}` === rawAcc,
    );
    if (idx !== -1) {
      const sub = user.subAccounts[idx];
      if (sub.accountType === "joint" || sub.accountType === "joint_member") {
        const jointDoc = await JointAccount.findOne({
          accountId: sub.accountId,
        });
        return {
          type: "JOINT",
          subIndex: idx,
          accObj: sub,
          jointDoc,
          currency: sub.currency || "USD",
          accountNumber: sub.accountNumber,
        };
      }
      return {
        type: "SUB",
        subIndex: idx,
        accObj: sub,
        currency: sub.currency || "USD",
        accountNumber: sub.accountNumber,
      };
    }
  }
  return null;
}

/**
 * 📌 [Admin] ទាញយកកាតទាំងអស់ក្នុងប្រព័ន្ធ (រួមទាំង Auto-Migrate កាតចាស់ៗទាំងអស់ក្នុងប្រព័ន្ធ)
 */
const adminGetAllCards = async (req, res) => {
  try {
    // 🔄 ១. ឆែកមើលក្រែងលោមាន User ចាស់ៗណាខ្លះដែលនៅសល់ virtualCards ក្នុង Collection User
    const rawUsersWithOldCards = await User.collection
      .find({ "virtualCards.0": { $exists: true } })
      .toArray();

    if (rawUsersWithOldCards.length > 0) {
      for (const rawU of rawUsersWithOldCards) {
        if (Array.isArray(rawU.virtualCards)) {
          for (let i = 0; i < rawU.virtualCards.length; i++) {
            const oldC = rawU.virtualCards[i];
            if (!oldC || !oldC.number) continue;

            // ឆែកកុំឱ្យចម្លងជាន់គ្នា
            const exists = await Card.findOne({
              $or: [{ id: oldC.id }, { number: oldC.number }],
            });

            if (!exists) {
              let linkAcc = oldC.linkedAccount || "USD";
              if (linkAcc === "USD" && rawU.mainAccounts?.USD?.accountNumber) {
                linkAcc = rawU.mainAccounts.USD.accountNumber;
              } else if (
                linkAcc === "KHR" &&
                rawU.mainAccounts?.KHR?.accountNumber
              ) {
                linkAcc = rawU.mainAccounts.KHR.accountNumber;
              } else if (linkAcc.includes("_")) {
                linkAcc = linkAcc.split("_")[1];
              }

              await Card.create({
                userId: rawU._id,
                username: rawU.username,
                userCustomId: rawU.id || rawU._id.toString(),
                id: oldC.id || "card_" + Date.now() + "_" + i,
                type: oldC.type || "standard",
                name: oldC.name || "STANDARD",
                number: oldC.number,
                cvv: oldC.cvv || "000",
                expiry: oldC.expiry || "12/28",
                linkedAccount: linkAcc,
                currency: oldC.linkedAccount === "KHR" ? "KHR" : "USD",
                isLocked: oldC.isLocked || false,
                lockedByAdmin: oldC.lockedByAdmin || false,
                isOnlinePayEnabled: oldC.isOnlinePayEnabled !== false,
                dailyLimit: oldC.dailyLimit || 500,
                dailyTxCountLimit: oldC.dailyTxCountLimit || 10,
                pin: oldC.pin || "0000",
                uid: oldC.uid || null,
                isPhysical: oldC.isPhysical || Boolean(oldC.uid),
                customBgUrl: oldC.customBgUrl || "",
                orderIndex: i,
              });
            }
          }
        }
        // លុប virtualCards ចាស់ចេញពី User ក្រោយពេលចម្លងរួច
        await User.collection.updateOne(
          { _id: rawU._id },
          { $unset: { virtualCards: "" } },
        );
      }
    }

    // 💳 ២. ទាញយកកាតទាំងអស់ពី Model Card.js ថ្មីបោះទៅឱ្យ Admin
    const cards = await Card.find()
      .sort({ createdAt: -1, orderIndex: 1 })
      .lean();

    res.json({ success: true, cards });
  } catch (err) {
    console.error("Admin Get All Cards Error:", err);
    res.status(500).json({ success: false, cards: [] });
  }
};

/**
 * 📌 [Admin] បង្កើតកាតថ្មីឱ្យអតិថិជន (រក្សាទុកក្នុង Card.js & កាត់សេវាពីកុងដែលភ្ជាប់)
 */
const adminCreateCard = async (req, res) => {
  const { username, cardType, customBgUrl, linkedAccount, remark } = req.body;

  try {
    const user = await User.findOne({ username });
    if (!user) return res.json({ success: false, message: "រកគណនីមិនឃើញទេ!" });

    const existingCount = await Card.countDocuments({ username });
    if (existingCount >= 10) {
      return res.json({
        success: false,
        message: "អតិថិជននេះមានកាតគ្រប់ ១០ សន្លឹកហើយ!",
      });
    }

    const targetAcc = await resolveAdminUserAccount(user, linkedAccount);
    if (!targetAcc || !targetAcc.accObj) {
      return res.json({
        success: false,
        message: "រកមិនឃើញគណនីដែលចង់ភ្ជាប់ជាមួយកាតទេ!",
      });
    }

    const tier = cardTiersConfig[cardType] || cardTiersConfig["standard"];
    const issuanceFeeUSD = tier.price;

    let exchangeRate = 4110;
    try {
      const sys = await System.findOne({ settingId: "GLOBAL_SETTINGS" });
      if (sys && sys.fxRates && sys.fxRates.usdToKhrBuy) {
        exchangeRate = parseFloat(sys.fxRates.usdToKhrBuy);
      }
    } catch (e) {}

    const feeInAccCurrency =
      targetAcc.currency === "USD"
        ? issuanceFeeUSD
        : issuanceFeeUSD * exchangeRate;

    const currentBal =
      targetAcc.type === "JOINT" && targetAcc.jointDoc
        ? targetAcc.jointDoc.balance
        : targetAcc.accObj.balance || 0;

    if (currentBal < feeInAccCurrency) {
      const feeStr =
        targetAcc.currency === "USD"
          ? `$${feeInAccCurrency.toFixed(2)}`
          : `៛${feeInAccCurrency.toLocaleString()}`;
      return res.json({
        success: false,
        message: `សមតុល្យក្នុងគណនី (${targetAcc.accountNumber}) មិនគ្រប់គ្រាន់សម្រាប់បង់សេវាបង្កើតកាតតម្លៃ ${feeStr} ទេ!`,
      });
    }

    // 💸 កាត់លុយថ្លៃសេវាពីគណនីដែលបានភ្ជាប់នោះផ្ទាល់
    if (targetAcc.type === "MAIN_USD") {
      user.mainAccounts.USD.balance -= feeInAccCurrency;
      user.markModified("mainAccounts");
    } else if (targetAcc.type === "MAIN_KHR") {
      user.mainAccounts.KHR.balance -= feeInAccCurrency;
      user.markModified("mainAccounts");
    } else if (targetAcc.type === "SUB") {
      user.subAccounts[targetAcc.subIndex].balance -= feeInAccCurrency;
      user.markModified("subAccounts");
    } else if (targetAcc.type === "JOINT" && targetAcc.jointDoc) {
      targetAcc.jointDoc.balance -= feeInAccCurrency;
      await targetAcc.jointDoc.save();
      user.subAccounts[targetAcc.subIndex].balance = targetAcc.jointDoc.balance;
      user.markModified("subAccounts");
    }
    await user.save();

    // 🌟 បូកលុយចូល Sub-Account Fee (888000999) របស់ Super Admin
    let superAdmin = await User.findOne({ username: "superadmin" });
    if (superAdmin) {
      let targetFeeSub = superAdmin.subAccounts?.find(
        (sub) => sub.accountNumber === "888000999",
      );
      if (targetFeeSub) {
        targetFeeSub.balance += issuanceFeeUSD;
        superAdmin.markModified("subAccounts");
      } else if (superAdmin.mainAccounts?.USD) {
        superAdmin.mainAccounts.USD.balance += issuanceFeeUSD;
        superAdmin.markModified("mainAccounts");
      }
      await superAdmin.save();
    }

    const refId = generateStandardRefId("CARD");
    const trxHash = generateStandardHash();
    const dateStr = new Date().toLocaleString("en-US", {
      timeZone: "Asia/Phnom_Penh",
      hour12: true,
    });

    const details = generateCardDetails();
    const newCardId = "card_" + Date.now();

    // 💳 បង្កើតកាតទុកក្នុង Model Card.js ថ្មី
    await Card.create({
      userId: user._id,
      username: user.username,
      userCustomId: user.id || user._id.toString(),
      id: newCardId,
      type: cardType,
      name: tier.name,
      number: details.number,
      cvv: details.cvv,
      expiry: details.expiry,
      linkedAccount: targetAcc.accountNumber,
      currency: targetAcc.currency,
      isLocked: false,
      isOnlinePayEnabled: true,
      dailyLimit: 500,
      dailyTxCountLimit: 10,
      pin: "0000",
      uid: null,
      isPhysical: false,
      customBgUrl: cardType === "custom" ? customBgUrl : "",
      orderIndex: existingCount,
    });

    // 🧾 វិក្កយបត្រកាត់លុយ (User)
    await Transaction.create({
      userId: user._id,
      username: user.username,
      refId,
      hash: trxHash,
      date: dateStr,
      type: "Card Issuance Fee",
      amount: -feeInAccCurrency,
      currency: targetAcc.currency,
      senderName: user.fullName || user.username,
      senderAcc: targetAcc.accountNumber,
      receiverName: "Card Issuance Service",
      receiverAcc: "888000999",
      cardId: newCardId,
      cardNumber: details.number,
      status: "Success",
      remark: `Issued ${tier.name} Virtual Card (By Admin: ${req.admin ? req.admin.username : "System"})`,
    });

    // 🧾 វិក្កយបត្រចំណូលប្រព័ន្ធ (System Fee)
    await Transaction.create({
      userId: superAdmin?._id,
      username: superAdmin ? superAdmin.username : "superadmin",
      refId,
      hash: trxHash,
      date: dateStr,
      type: "System Income",
      amount: issuanceFeeUSD,
      currency: "USD",
      senderName: user.username,
      receiverName: "Central Bank Fee Income",
      senderAcc: targetAcc.accountNumber,
      receiverAcc: "888000999",
      status: "Success",
      remark: "Card Issuance Fee",
    });

    if (req.admin && req.admin.username) {
      await logAdminAction(
        req.admin.username,
        "Create Virtual Card",
        username,
        `បង្កើតកាត ${tier.name} (${details.number.slice(-4)}) ភ្ជាប់កុង ${targetAcc.accountNumber}។ មូលហេតុ: ${remark || "គ្មាន"}`,
      );
    }

    res.json({ success: true, message: "បង្កើតកាតបានជោគជ័យ!" });
  } catch (err) {
    console.error("Admin Create Card Error:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * 📌 [Admin] លុបកាត
 */
const adminDeleteCard = async (req, res) => {
  const { username, cardId, reason } = req.body;
  try {
    const card = await Card.findOneAndDelete({ id: cardId, username });
    if (!card)
      return res.json({ success: false, message: "រកកាតនេះមិនឃើញទេ!" });

    if (req.admin && req.admin.username) {
      await logAdminAction(
        req.admin.username,
        "Delete Virtual Card",
        username,
        `លុបកាត ${card.number.slice(-4)}។ មូលហេតុ: ${reason}`,
      );
    }

    res.json({ success: true, message: "លុបកាតជោគជ័យ!" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * 📌 [Admin] បិទ/បើកកាត (Lock/Unlock)
 */
const toggleAdminCardLock = async (req, res) => {
  const { username, cardId, isLocked } = req.body;
  try {
    const card = await Card.findOne({ id: cardId, username });
    if (!card) return res.json({ success: false, message: "រកកាតមិនឃើញទេ!" });

    card.isLocked = isLocked;
    card.lockedByAdmin = Boolean(isLocked);
    await card.save();

    if (req.admin && req.admin.username) {
      await logAdminAction(
        req.admin.username,
        "Toggle Card Lock",
        username,
        `កាត ${card.number.slice(-4)} ត្រូវបាន ${isLocked ? "FROZEN" : "UNFROZEN"}`,
      );
    }

    res.json({
      success: true,
      message: isLocked ? "ផ្អាកកាតជោគជ័យ!" : "បើកកាតជោគជ័យ!",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * 📌 [Admin] ផ្លាស់ប្តូរដែនកំណត់កាត (Card Limit)
 */
const adminUpdateCardLimit = async (req, res) => {
  const { username, cardId, newLimit, newCountLimit } = req.body;
  try {
    const card = await Card.findOne({ id: cardId, username });
    if (!card) return res.json({ success: false, message: "រកកាតមិនឃើញទេ!" });

    if (newLimit !== undefined) card.dailyLimit = parseFloat(newLimit);
    if (newCountLimit !== undefined)
      card.dailyTxCountLimit = parseInt(newCountLimit, 10);
    await card.save();

    if (req.admin && req.admin.username) {
      await logAdminAction(
        req.admin.username,
        "Update Card Limit",
        username,
        `កែ Limit កាត ${card.number.slice(-4)} ទៅ $${newLimit} និង ${newCountLimit} ដង/ថ្ងៃ`,
      );
    }
    res.json({ success: true, message: "បានកំណត់ Limit កាតជោគជ័យ!" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * 📌 [Admin] បិទ/បើក ការទិញអនឡាញរបស់កាត (Toggle Online Pay)
 */
const adminToggleCardOnline = async (req, res) => {
  const { username, cardId, isEnabled } = req.body;
  try {
    const card = await Card.findOne({ id: cardId, username });
    if (!card) return res.json({ success: false, message: "រកកាតមិនឃើញទេ!" });

    card.isOnlinePayEnabled = isEnabled;
    await card.save();

    if (req.admin && req.admin.username) {
      await logAdminAction(
        req.admin.username,
        "Toggle Card Online Pay",
        username,
        `Online Pay សម្រាប់កាត ${card.number.slice(-4)} ត្រូវបាន ${isEnabled ? "ON" : "OFF"}`,
      );
    }
    res.json({ success: true, message: "ធ្វើបច្ចុប្បន្នភាពជោគជ័យ!" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * 📌 [Admin] ប្តូរឈ្មោះកាត (Rename Card)
 */
const adminRenameCard = async (req, res) => {
  const { username, cardId, name } = req.body;
  try {
    const card = await Card.findOne({ id: cardId, username });
    if (!card) return res.json({ success: false, message: "រកកាតមិនឃើញទេ!" });

    const oldName = card.name;
    card.name = name.toUpperCase();
    await card.save();

    if (req.admin && req.admin.username) {
      await logAdminAction(
        req.admin.username,
        "Rename Card",
        username,
        `ប្តូរឈ្មោះកាតពី ${oldName || "N/A"} ទៅជា ${card.name}`,
      );
    }
    res.json({ success: true, message: "ប្តូរឈ្មោះកាតជោគជ័យ!" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * 📌 [Admin] ផ្លាស់ប្តូរគណនីដែលបានភ្ជាប់ជាមួយកាត (Change Card Linked Account - Fixed Model Card)
 */
const adminChangeCardLinkedAccount = async (req, res) => {
  const { username, cardId, linkedAccount } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user) return res.json({ success: false, message: "រកគណនីមិនឃើញទេ!" });

    // 🔍 ស្វែងរកកាតដោយផ្អែកលើ id ឬ _id ក្នុងតារាង Card.js
    let card = await Card.findOne({
      $or: [
        { id: cardId },
        ...(mongoose.isValidObjectId(cardId) ? [{ _id: cardId }] : []),
      ],
      username: username,
    });

    if (!card)
      return res.json({ success: false, message: "រកកាតនេះមិនឃើញទេ!" });

    // 🔍 ស្វែងរកគណនីពិតប្រាកដ (Main, Sub, ឬ Joint)
    const targetAcc = await resolveAdminUserAccount(user, linkedAccount);
    if (!targetAcc) {
      return res.json({
        success: false,
        message: "រកមិនឃើញគណនីដែលចង់ភ្ជាប់នោះទេ!",
      });
    }

    const oldAcc = card.linkedAccount;
    card.linkedAccount = targetAcc.accountNumber;
    card.currency = targetAcc.currency; // 🌟 អាប់ដេតរូបិយប័ណ្ណកាតតាមគណនីថ្មីអូតូ (USD ឬ KHR)
    await card.save();

    if (req.admin && req.admin.username) {
      await logAdminAction(
        req.admin.username,
        "Change Card Account",
        username,
        `ប្តូរគណនីភ្ជាប់កាត ${card.number.slice(-4)} ពី ${oldAcc} ទៅជា ${targetAcc.accountNumber} (${targetAcc.currency})`,
      );
    }
    res.json({ success: true, message: "បានប្តូរគណនីភ្ជាប់ជោគជ័យ!" });
  } catch (err) {
    console.error("Change Card Account Error:", err);
    res
      .status(500)
      .json({ success: false, message: "Server Error: " + err.message });
  }
};

/**
 * 📌 [Admin] ភ្ជាប់កាត NFC
 */
const adminBindNfcCard = async (req, res) => {
  try {
    const { username, cardId, pin, uid } = req.body;
    const cleanUid = String(uid || "")
      .replaceAll(":", "")
      .trim()
      .toUpperCase();

    const existingUid = await Card.findOne({ uid: cleanUid });
    if (existingUid) {
      return res.json({
        success: false,
        message:
          "⚠️ កាត Physical នេះត្រូវបានភ្ជាប់រួចជាស្រេចជាមួយគណនីផ្សេងបាត់ទៅហើយ!",
      });
    }

    const targetCard = await Card.findOne({ id: cardId, username });
    if (!targetCard)
      return res.json({ success: false, message: "រកកាតនេះមិនឃើញទេ!" });

    if (targetCard.uid && targetCard.uid !== "" && targetCard.uid !== null) {
      return res.json({
        success: false,
        message:
          "⚠️ គណនីនេះបានភ្ជាប់កាត NFC រួចរាល់ហើយ! សូម 'ផ្តាច់កាត' (Unbind) ចាស់ចេញជាមុនសិន។",
      });
    }

    targetCard.uid = cleanUid;
    targetCard.pin = pin || targetCard.pin || "0000";
    targetCard.isPhysical = true;
    await targetCard.save();

    if (req.admin && req.admin.username) {
      await logAdminAction(
        req.admin.username,
        "Bind NFC Card",
        username,
        `ភ្ជាប់ NFC (${cleanUid}) ទៅកាត ${targetCard.number.slice(-4)}`,
      );
    }

    res.json({ success: true, message: "ភ្ជាប់ជោគជ័យ!" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * 📌 [Admin] ផ្តាច់កាត NFC
 */
const adminUnbindNfcCard = async (req, res) => {
  try {
    const { username, cardId } = req.body;
    const card = await Card.findOne({ id: cardId, username });

    if (card) {
      const oldUid = card.uid;
      card.uid = null;
      card.isPhysical = false;
      await card.save();

      if (req.admin && req.admin.username) {
        await logAdminAction(
          req.admin.username,
          "Unbind NFC Card",
          username,
          `ផ្តាច់ NFC (${oldUid}) ចេញពីកាត ${card.number.slice(-4)}`,
        );
      }
      return res.json({ success: true, message: "ផ្តាច់កាតជោគជ័យ!" });
    }
    res.json({ success: false, message: "បរាជ័យ" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// ===============================
// Create & Edit Merchant (Admin Pro)
// ===============================
const adminCreateMerchant = async (req, res) => {
  const { username, name, city, category, linkedAccUSD, linkedAccKHR } =
    req.body;
  try {
    const user = await User.findOne({ username });
    if (!user) return res.json({ success: false, message: "រកមិនឃើញអតិថិជន" });

    if (!linkedAccUSD && !linkedAccKHR) {
      return res.json({
        success: false,
        message: "សូមជ្រើសរើសគណនីភ្ជាប់ (Linked Account) យ៉ាងហោចណាស់មួយ!",
      });
    }

    const merchantId =
      "500" +
      Math.floor(100000000000 + Math.random() * 900000000000).toString();

    const apiKey =
      "upay_live_" + require("crypto").randomBytes(16).toString("hex");
    const apiSecret = require("crypto").randomBytes(32).toString("hex");

    let linkedAccountsObj = { USD: null, KHR: null };
    let accountNumbersObj = { USD: null, KHR: null };

    if (linkedAccUSD) {
      linkedAccountsObj.USD = linkedAccUSD;
      accountNumbersObj.USD =
        "888" + Math.floor(100000000 + Math.random() * 900000000).toString();
    }

    if (linkedAccKHR) {
      linkedAccountsObj.KHR = linkedAccKHR;
      accountNumbersObj.KHR =
        "999" + Math.floor(100000000 + Math.random() * 900000000).toString();
    }

    const newMerchant = new Merchant({
      ownerId: user._id,
      userCustomId: user.userId || user.id || user._id.toString(),
      username: user.username,
      userId: user.username,
      name,
      city,
      category,
      merchantId,
      apiKey,
      apiSecret,
      linkedAccounts: linkedAccountsObj,
      accountNumbers: accountNumbersObj,
      collected: { USD: 0.0, KHR: 0 },
      status: "Active",
    });

    const savedMerchant = await newMerchant.save();

    await Notification.create({
      userId: user._id,
      username: user.username,
      title: "បង្កើតហាងជោគជ័យ! 🏪",
      message: `អបអរសាទរ! ហាង "${name}" ត្រូវបានបង្កើតដោយជោគជ័យ និងរួចរាល់សម្រាប់ទទួលប្រាក់។`,
      type: "system_alert",
      date:
        typeof getFormattedDate === "function"
          ? getFormattedDate()
          : new Date().toLocaleString(),
      isRead: false,
    });

    await logAdminAction(
      req.admin.username,
      "Create Merchant",
      user.username,
      `Created merchant shop: ${name} (MID: ${merchantId})`,
    );

    res.status(201).json({ success: true, merchant: savedMerchant });
  } catch (error) {
    console.error("ADMIN CREATE MERCHANT ERROR:", error);
    res
      .status(500)
      .json({ success: false, message: "Server Error: " + error.message });
  }
};

// 🌟 ទាញយកតែហាងរបស់ User ជាក់លាក់ (រួមទាំង Auto-Migrate សុវត្ថិភាព ៣ ជាន់)
const adminGetMerchantsByUser = async (req, res) => {
  try {
    const { username } = req.params;
    const user = await User.findOne({ username }).select(
      "_id id userId username",
    );

    const query = user
      ? {
          $or: [
            { userId: username },
            { username: username },
            { ownerId: user._id },
          ],
        }
      : { $or: [{ userId: username }, { username: username }] };

    const merchants = await Merchant.find(query);

    if (user && merchants.length > 0) {
      for (const m of merchants) {
        if (!m.ownerId || !m.username || !m.userCustomId) {
          m.ownerId = user._id;
          m.username = user.username;
          m.userCustomId = user.userId || user.id || user._id.toString();
          await m.save();
        }
      }
    }

    res.json({ success: true, merchants });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// 🌟 Admin កែប្រែព័ត៌មានហាង និងគណនីភ្ជាប់ (Fixed 100% សម្រាប់គ្រប់ប្រភេទគណនី)
const adminEditMerchant = async (req, res) => {
  try {
    const {
      id,
      name,
      merchantId,
      category,
      webhookUrl,
      linkedAccount,
      linkedAccUSD,
      linkedAccKHR,
      username,
    } = req.body;

    if (merchantId) {
      const existing = await Merchant.findOne({
        merchantId: merchantId,
        _id: { $ne: id },
      });
      if (existing) {
        return res.json({
          success: false,
          message: "Merchant ID នេះមានអ្នកប្រើហើយ!",
        });
      }
    }

    const merchantToUpdate = await Merchant.findById(id);
    if (!merchantToUpdate)
      return res.json({ success: false, message: "រកហាងមិនឃើញទេ!" });

    const user = await User.findOne({
      username:
        username || merchantToUpdate.username || merchantToUpdate.userId,
    });
    if (!user)
      return res.json({ success: false, message: "រកម្ចាស់ហាងមិនឃើញទេ!" });

    let linkedAccountsObj = { USD: null, KHR: null };
    let accountNumbersObj = {
      USD: merchantToUpdate.accountNumbers?.USD || null,
      KHR: merchantToUpdate.accountNumbers?.KHR || null,
    };

    // 🟢 ករណីទី ១៖ បើបញ្ជូនលេខគណនីជាក់លាក់មកតាម linkedAccUSD / linkedAccKHR (ពី Customer 360)
    if (linkedAccUSD !== undefined || linkedAccKHR !== undefined) {
      if (!linkedAccUSD && !linkedAccKHR) {
        return res.json({
          success: false,
          message: "សូមជ្រើសរើសគណនីទទួលប្រាក់យ៉ាងហោចណាស់មួយ!",
        });
      }

      if (linkedAccUSD) {
        linkedAccountsObj.USD = linkedAccUSD;
        if (!accountNumbersObj.USD) {
          accountNumbersObj.USD =
            "888" +
            Math.floor(100000000 + Math.random() * 900000000).toString();
        }
      } else {
        accountNumbersObj.USD = null; // បើផ្តាច់កុង USD លុបលេខកុង QR USD ចេញ
      }

      if (linkedAccKHR) {
        linkedAccountsObj.KHR = linkedAccKHR;
        if (!accountNumbersObj.KHR) {
          accountNumbersObj.KHR =
            "999" +
            Math.floor(100000000 + Math.random() * 900000000).toString();
        }
      } else {
        accountNumbersObj.KHR = null; // បើផ្តាច់កុង KHR លុបលេខកុង QR KHR ចេញ
      }
    }
    // 🟢 ករណីទី ២៖ Fallback សម្រាប់កន្លែងផ្សេងដែលបោះមកត្រឹមពាក្យ "USD", "KHR", "BOTH"
    else if (linkedAccount) {
      if (linkedAccount === "USD" || linkedAccount === "BOTH") {
        linkedAccountsObj.USD =
          merchantToUpdate.linkedAccounts?.USD ||
          user.mainAccounts?.USD?.accountNumber ||
          null;
        if (linkedAccountsObj.USD && !accountNumbersObj.USD) {
          accountNumbersObj.USD =
            "888" +
            Math.floor(100000000 + Math.random() * 900000000).toString();
        }
      } else {
        accountNumbersObj.USD = null;
      }

      if (linkedAccount === "KHR" || linkedAccount === "BOTH") {
        linkedAccountsObj.KHR =
          merchantToUpdate.linkedAccounts?.KHR ||
          user.mainAccounts?.KHR?.accountNumber ||
          null;
        if (linkedAccountsObj.KHR && !accountNumbersObj.KHR) {
          accountNumbersObj.KHR =
            "999" +
            Math.floor(100000000 + Math.random() * 900000000).toString();
        }
      } else {
        accountNumbersObj.KHR = null;
      }
    }

    if (name) merchantToUpdate.name = name.trim();
    if (merchantId) merchantToUpdate.merchantId = merchantId;
    if (category) merchantToUpdate.category = category;
    if (webhookUrl !== undefined) merchantToUpdate.webhookUrl = webhookUrl;

    // ធានាការភ្ជាប់សុវត្ថិភាព ៣ ជាន់
    merchantToUpdate.ownerId = user._id;
    merchantToUpdate.username = user.username;
    merchantToUpdate.userCustomId =
      user.userId || user.id || user._id.toString();

    merchantToUpdate.linkedAccounts = linkedAccountsObj;
    merchantToUpdate.accountNumbers = accountNumbersObj;

    merchantToUpdate.markModified("linkedAccounts");
    merchantToUpdate.markModified("accountNumbers");

    await merchantToUpdate.save();

    await logAdminAction(
      req.admin.username,
      "Edit Merchant",
      user.username,
      `Updated merchant shop: ${merchantToUpdate.name} (USD: ${linkedAccountsObj.USD || "None"}, KHR: ${linkedAccountsObj.KHR || "None"})`,
    );

    res.json({
      success: true,
      message: "កែប្រែព័ត៌មានហាង និងគណនីភ្ជាប់ជោគជ័យ!",
      merchant: merchantToUpdate,
    });
  } catch (error) {
    console.error("Edit Merchant Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ផ្អាក ឬបើកដំណើរការហាង (Freeze/Unfreeze)
const adminToggleMerchantFreeze = async (req, res) => {
  try {
    const { id, isFrozen } = req.body;
    const status = isFrozen ? "Suspended" : "Active";
    const m = await Merchant.findByIdAndUpdate(id, { status: status });
    if (m) {
      await logAdminAction(
        req.admin.username,
        "Toggle Merchant Freeze",
        m.userId,
        `Merchant ${m.name} set to ${status}`,
      );
    }
    res.json({ success: true, message: "Status updated successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Admin លុបហាងចោលពីប្រព័ន្ធ
const adminDeleteMerchant = async (req, res) => {
  try {
    const m = await Merchant.findById(req.params.id);
    if (!m) return res.json({ success: false, message: "រកមិនឃើញហាង" });

    await Merchant.findByIdAndDelete(req.params.id);

    // 🌟 ផ្តល់ដំណឹងចូល App ពេលលុបហាង
    const owner = await User.findOne({ username: m.userId });
    if (owner) {
      await Notification.create({
        userId: owner._id,
        username: owner.username,
        title: "ហាងត្រូវបានលុប! ❌",
        message: `ហាង "${m.name}" របស់អ្នកត្រូវបានលុបចេញពីប្រព័ន្ធ U-Pay ដោយអ្នកគ្រប់គ្រង (Admin)។`,
        type: "system_alert",
        date: getFormattedDate(),
        isRead: false,
      });
    }

    await logAdminAction(
      req.admin.username,
      "Delete Merchant",
      m.userId,
      `Deleted merchant shop: ${m.name}`,
    );
    res.json({ success: true, message: "Merchant deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// 📢 ផ្នែកទី ១០៖ ទីផ្សារ ជំនួយ និងបញ្ជូនសារ (Promo, Support & Broadcast)
// ==========================================

const createPromoCode = async (req, res) => {
  if (req.admin.role !== "super_admin" && req.admin.role !== "finance_admin") {
    return res.status(403).json({
      success: false,
      message: "បម្រាម៖ អ្នកគ្មានសិទ្ធិបង្កើត Promo Code ទេ!",
    });
  }

  const { code, rewardValue, maxUsage, expiresAt } = req.body;
  try {
    const existing = await PromoCode.findOne({ code: code.toUpperCase() });
    if (existing)
      return res.json({ success: false, message: "កូដនេះមានរួចហើយ!" });

    const newPromo = new PromoCode({
      code: code.toUpperCase(),
      rewardValue: parseFloat(rewardValue),
      maxUsage: parseInt(maxUsage) || 100,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    });
    await newPromo.save();

    await logAdminAction(
      req.admin.username,
      "Create Promo Code",
      code,
      `Reward: $${rewardValue}, Max: ${maxUsage}`,
    );
    res.json({
      success: true,
      message: `កូដ ${code.toUpperCase()} ត្រូវបានបង្កើតជោគជ័យ!`,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getPromoCodes = async (req, res) => {
  try {
    const promos = await PromoCode.find().sort({ createdAt: -1 });
    res.json({ success: true, promos });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

const togglePromoCode = async (req, res) => {
  try {
    const promo = await PromoCode.findById(req.body.id);
    if (promo) {
      promo.isActive = !promo.isActive;
      await promo.save();
      res.json({ success: true });
    } else {
      res.json({ success: false });
    }
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

const broadcast = async (req, res) => {
  try {
    if (req.admin.role !== "super_admin") {
      const adminAcc = await Admin.findById(req.admin.id || req.admin._id);
      if (!adminAcc || !adminAcc.permissions?.menus?.broadcast)
        return res.status(403).json({
          success: false,
          message: "សុំទោស! អ្នកគ្មានសិទ្ធិបញ្ជូនសារ Broadcast ទេ 🛑",
        });
    }
    const { title, message, sender } = req.body;
    const users = await User.find({ role: { $ne: "admin" } }).select(
      "_id username",
    );

    if (users.length > 0) {
      const dateStr = getFormattedDate();
      const broadcastNotifs = users.map((u) => ({
        userId: u._id,
        username: u.username,
        title: title,
        message: message,
        type: "info",
        date: dateStr,
        isRead: false,
        metadata: {
          sender: sender || "admin",
          broadcastId: "BC-" + Date.now(),
        },
      }));
      await Notification.insertMany(broadcastNotifs);
    }

    await logAdminAction(
      req.admin.username,
      "Broadcast",
      "All Users",
      `Sent: ${title}`,
    );
    res.json({ success: true, count: users.length });
  } catch (error) {
    res.status(500).json({ success: false });
  }
};

const getBroadcastHistory = async (req, res) => {
  try {
    const broadcasts = await Notification.aggregate([
      { $match: { "metadata.broadcastId": { $exists: true } } },
      {
        $group: {
          _id: "$metadata.broadcastId",
          title: { $first: "$title" },
          message: { $first: "$message" },
          date: { $first: "$date" },
          sender: { $first: "$metadata.sender" },
          id: { $first: "$metadata.broadcastId" },
        },
      },
      { $sort: { date: -1 } },
    ]);
    res.json({ success: true, broadcasts });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

const deleteBroadcast = async (req, res) => {
  try {
    if (req.admin.role !== "super_admin") {
      const adminAcc = await Admin.findById(req.admin.id || req.admin._id);
      if (!adminAcc || !adminAcc.permissions?.menus?.broadcast)
        return res.status(403).json({
          success: false,
          message: "សុំទោស! អ្នកគ្មានសិទ្ធិលុបសារ Broadcast ទេ 🛑",
        });
    }
    const { notifId } = req.body;
    await Notification.deleteMany({ "metadata.broadcastId": notifId });
    await logAdminAction(
      req.admin.username,
      "Delete Broadcast",
      "All Users",
      `Deleted broadcast ID: ${notifId}`,
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

const sendDirectMessage = async (req, res) => {
  try {
    const { username, message } = req.body;

    // រកមើលអតិថិជន
    const user = await User.findOne({ username });
    if (!user) {
      return res.json({ success: false, message: "រកមិនឃើញអតិថិជននេះទេ!" });
    }

    // ទាញយកម៉ោងបច្ចុប្បន្ន
    const dateStr =
      typeof getFormattedDate === "function"
        ? getFormattedDate()
        : new Date().toLocaleString("en-US", {
            timeZone: "Asia/Phnom_Penh",
            hour12: true,
          });

    // បង្កើត Notification ប្រភេទ Info ផ្ញើទៅគាត់តែម្នាក់ឯង
    await Notification.create({
      userId: user._id,
      username: user.username,
      title: "សារពីធនាគារ (Direct Message)",
      message: message,
      date: dateStr,
      type: "info", // ប្រភេទសារ Info Notification
      isRead: false,
      metadata: { sender: req.admin.username },
    });

    // កត់ត្រាចូលក្នុង Audit Log
    await logAdminAction(
      req.admin.username,
      "Send Direct Message",
      user.username,
      `Sent Info: ${message}`,
    );

    return res.json({ success: true, message: "សារត្រូវបានផ្ញើជោគជ័យ!" });
  } catch (error) {
    console.error("Direct Message Error:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * 📌 បង្កើតគណនីអតិថិជនថ្មីដោយ Admin (គ្មាន OTP, លឿនរហ័ស)
 */
const adminCreateUser = async (req, res) => {
  // ទទួលយកទិន្នន័យពី Frontend
  const {
    username,
    password,
    pin,
    fullName,
    phone,
    email,
    dob,
    gender,
    idNumber,
    idCardUrl,
    selfieUrl,
  } = req.body;

  try {
    // ឆែកសិទ្ធិ: មានតែមេធំ (Super Admin) ឬអ្នកមានសិទ្ធិបង្កើតគណនីទើបអាចធ្វើបាន
    // បើចង់អនុញ្ញាតឱ្យ Admin គ្រប់គ្នាបើកគណនីបាន អាចរំលងការឆែកនេះបាន
    /* 
    const access = await checkAdminAccess(req.admin, "createUser");
    if (!access.allowed) return res.status(403).json({ success: false, message: access.message });
    */

    // ១. ឆែកកុំឱ្យស្ទួន Username ឬ Email
    const existingUser = await User.findOne({
      $or: [
        { username: username },
        { email: email || "N/A" }, // បើគ្មាន Email គឺមិនឱ្យស្ទួនជាមួយ N/A ទេ
      ],
    });

    if (existingUser) {
      return res.json({
        success: false,
        message: "Username ឬ Email នេះមានគេប្រើប្រាស់រួចហើយ!",
      });
    }

    // ២. បង្កើតលេខគណនីធនាគារ អូតូ
    const tsId = Date.now().toString();
    const prefix = Math.floor(Math.random() * 9) + 1; // លេខពី 1 ដល់ 9
    const suffix = Math.floor(Math.random() * 890) + 100; // លេខពី 100 ដល់ 989
    const baseAcc = parseInt(`${prefix}00${prefix}00${suffix}`);

    const newAccUSD = baseAcc.toString();
    const newAccKHR = (baseAcc + 1).toString();

    // លេខសម្គាល់អតិថិជន (Referral ID ៨ខ្ទង់)
    const newUserId = Math.floor(
      10000000 + Math.random() * 90000000,
    ).toString();

    // ៣. កំណត់ស្ថានភាព KYC អូតូ
    let initialKycStatus = idCardUrl && selfieUrl ? "pending" : "unverified";

    // ៤. រៀបចំទិន្នន័យ User ថ្មី
    const newUser = new User({
      id: tsId,
      userId: newUserId,
      username: username,
      password: password || "1234",
      pin: pin || "1234",
      fullName: fullName,
      email: email || "",
      phone: phone || "",
      dob: dob || "",
      gender: gender || "",
      idNumber: idNumber || "",

      kycStatus: initialKycStatus,
      kycDocument: idCardUrl || "",
      selfieUrl: selfieUrl || "",
      kycSubmittedAt: initialKycStatus === "verified" ? getFormattedDate() : "",
      kycUploadedBy: idCardUrl || selfieUrl ? req.admin.username : "",

      mainAccounts: {
        USD: {
          accountId: "MAIN_USD_" + tsId,
          accountNumber: newAccUSD,
          accountName: "Main Account USD",
          accountType: "main",
          currency: "USD",
          balance: 0.0,
          dailyLimit: 1000.0,
          dailySpent: 0.0,
          isFrozen: false,
          isHidden: false,
        },
        KHR: {
          accountId: "MAIN_KHR_" + tsId,
          accountNumber: newAccKHR,
          accountName: "Main Account KHR",
          accountType: "main",
          currency: "KHR",
          balance: 0.0,
          dailyLimit: 4000000.0,
          dailySpent: 0.0,
          isFrozen: false,
          isHidden: false,
        },
      },
      role: "user",
      joinDate: new Date().toISOString(),
      lastActive: new Date().toISOString(),
    });

    // ៥. Save ចូល Database
    await newUser.save();

    // កត់ត្រាចូល Audit Logs របស់ Admin
    await logAdminAction(
      req.admin.username,
      "Create User",
      username,
      `Created new account for ${fullName}`,
    );

    res.json({ success: true, message: "គណនីត្រូវបានបង្កើតដោយជោគជ័យ!" });
  } catch (err) {
    console.error("Admin Create User Error:", err);
    res
      .status(500)
      .json({ success: false, message: "Server Error ពេលបង្កើតគណនី" });
  }
};

const ticketReply = async (req, res) => {
  const { username, ticketId, replyMessage } = req.body;
  try {
    const u = await User.findOne({ username });
    if (u && u.tickets) {
      const t = u.tickets.find(
        (item) =>
          item.ticketId === ticketId || item._id?.toString() === ticketId,
      );
      if (t) {
        const adminUsername = req.admin?.username || "admin";
        const replyTime =
          typeof getFormattedDate === "function"
            ? getFormattedDate()
            : new Date().toLocaleString();

        t.status = "Answered";
        t.adminReply = replyMessage;
        t.repliedBy = adminUsername; // 🟢 កត់ត្រា username អ្នកឆ្លើយតប
        t.repliedAt = replyTime;

        await Notification.create({
          userId: u._id,
          username: u.username,
          title: `របាយការណ៍ឆ្លើយតបសំណើ: ${t.subject}`,
          message: `ឆ្លើយតបដោយ @${adminUsername}: ${replyMessage}`, // 🟢 បង្ហាញ @username ច្បាស់ៗក្នុងសារ
          date: replyTime,
          type: "support_reply", // 🟢 កំណត់ប្រភេទដាច់ដោយឡែកដើម្បីបង្ហាញ Icon របាយការណ៍ស្អាត
          isRead: false,
          metadata: {
            sender: adminUsername,
            ticketId: t.ticketId,
            subject: t.subject,
          },
        });

        u.markModified("tickets");
        await u.save();

        await logAdminAction(
          adminUsername,
          "Reply Ticket",
          u.username,
          `(@${adminUsername}) Replied to ticket ID: ${ticketId}`,
        );

        res.json({ success: true, repliedBy: adminUsername });
      } else {
        res.json({ success: false, message: "រកមិនឃើញសំណូមពរនេះទេ!" });
      }
    } else {
      res.json({ success: false, message: "រកមិនឃើញអតិថិជននេះទេ!" });
    }
  } catch (err) {
    console.error("Ticket Reply Error:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// ==========================================
// 🎫 [Admin] ទាញយក Support Tickets ទាំងអស់សម្រាប់ Menu ធំ (ផ្ទាំងទី ១៤)
// ==========================================
const getAllSupportTickets = async (req, res) => {
  try {
    const users = await User.find({ "tickets.0": { $exists: true } }).select(
      "username fullName phone profileImage userId tickets",
    );

    let allTickets = [];
    users.forEach((u) => {
      if (Array.isArray(u.tickets)) {
        u.tickets.forEach((t) => {
          const tObj = t.toObject ? t.toObject() : t;
          allTickets.push({
            ...tObj,
            username: u.username,
            fullName: u.fullName || u.username,
            phone: u.phone || "N/A",
            profileImage: u.profileImage || "../images/default-avatar.png",
            userCustomId: u.userId || "N/A",
          });
        });
      }
    });

    // តម្រៀបពីសំបុត្រថ្មីបំផុតមកមុន
    allTickets.sort(
      (a, b) =>
        new Date(b.createdAt || b.date || 0) -
        new Date(a.createdAt || a.date || 0),
    );

    res.json({ success: true, tickets: allTickets });
  } catch (err) {
    console.error("Get All Support Tickets Error:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// ==========================================
// 🎫 ទាញយក Support Tickets របស់អតិថិជនម្នាក់ៗ (Fixed for User.tickets array)
// ==========================================
const getUserTickets = async (req, res) => {
  try {
    const { username } = req.params;
    // ទាញយក Field tickets ផ្ទាល់ពី Document របស់ User នោះ
    const user = await User.findOne({ username }).select(
      "tickets username fullName",
    );

    if (!user) {
      return res.json({ success: false, message: "រកមិនឃើញអតិថិជនទេ!" });
    }

    res.json({ success: true, tickets: user.tickets || [] });
  } catch (err) {
    console.error("Get User Tickets Error:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// ២. Admin ตอบ ឬបិទ Ticket (Close/Reply Support Ticket)
const adminResolveTicket = async (req, res) => {
  try {
    const { username, ticketId, adminReply, newStatus } = req.body;
    const user = await User.findOne({ username });
    if (!user)
      return res.json({ success: false, message: "រកមិនឃើញអតិថិជនទេ!" });

    if (!user.tickets) user.tickets = [];
    const ticket = user.tickets.id
      ? user.tickets.id(ticketId)
      : user.tickets.find(
          (t) => t.ticketId === ticketId || t._id?.toString() === ticketId,
        );

    if (!ticket)
      return res.json({
        success: false,
        message: "រកមិនឃើញសំណូមពរ (Ticket) នេះទេ!",
      });

    if (adminReply) ticket.adminReply = adminReply;
    if (newStatus) ticket.status = newStatus; // 'Resolved', 'Closed', 'In Progress'

    user.markModified("tickets");
    await user.save();

    await logAdminAction(
      req.admin.username,
      "Resolve Support Ticket",
      username,
      `Updated ticket ID: ${ticketId} to status: ${newStatus || ticket.status}`,
    );

    res.json({ success: true, message: "កែប្រែស្ថានភាពសំណូមពរជោគជ័យ!" });
  } catch (err) {
    console.error("Resolve Ticket Error:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// ==========================================
// 📤 ផ្នែកទី ១១៖ បញ្ចេញមុខងារ (Exports)
// ==========================================
module.exports = {
  // Helpers
  checkAdminAccess,
  logCustomAction,

  // Admin Manage
  getMe,
  getAdminsList,
  getUserLogs,
  saveAdminAccount,
  deleteAdminAccount,
  adminResetPassword,
  toggleAdminStatus,
  checkAdminNfcUid,
  getAdminLogs,

  // System
  toggleSystem,
  getSystemStatus,
  getFXRates,
  updateFX,
  getFeeSettings,
  updateFeeSettings,

  // Dashboard
  getStats,
  getDashboardExtra,

  // User Manage
  adminCreateUser,
  searchUserByAdmin,
  getUserByAdmin,
  getSingleUser,
  editUser,
  editSubAccount,
  deleteSubAccount,
  adminUpdateAccountLimit,
  adminToggleFreezeAccount,
  adminToggleHideAccount,
  requestCredentialReset,
  deleteUser,
  toggleFreeze,
  adminForceLogout,
  adminUploadKyc,
  kycAction,
  uploadSpecificKyc,

  // Transactions
  getTransaction,
  adjustBalance,
  approveTransaction,
  refundTransaction,
  getPublicReceipt,

  // Cashier
  searchCashierUser,
  getCashierTickets,
  actionCashierTicket,
  createCashierTicket,

  // Cards
  adminGetAllCards,
  adminCreateCard,
  adminDeleteCard,
  toggleAdminCardLock,
  adminUpdateCardLimit,
  adminToggleCardOnline,
  adminRenameCard,
  adminChangeCardLinkedAccount,
  adminBindNfcCard,
  adminUnbindNfcCard,

  // Merchants
  adminCreateMerchant,
  adminGetMerchantsByUser,
  adminToggleMerchantFreeze,
  adminDeleteMerchant,
  adminEditMerchant,
  releaseMerchantHold,

  // Promo, Broadcast
  createPromoCode,
  getPromoCodes,
  togglePromoCode,
  broadcast,
  getBroadcastHistory,
  deleteBroadcast,
  sendDirectMessage,

  // Tickets
  ticketReply,
  getAllSupportTickets,
  getUserTickets,
  adminResolveTicket,
};
