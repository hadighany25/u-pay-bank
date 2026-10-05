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
const Chat = require("../models/Chat");
const PromoCode = require("../models/PromoCode");
const JointAccount = require("../models/JointAccount");
const Notification = require("../models/Notification");
const Merchant = require("../models/Merchant");
const CashierTicket = require("../models/CashierTicket");

// ==========================================
// 🛠️ ផ្នែកទី ២៖ មុខងារជំនួយ (Helpers & Audit Logs)
// ==========================================

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
    const admins = await Admin.find({}, "-password");
    res.json({ success: true, admins });
  } catch (err) {
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
// 👥 ផ្នែកទី ៦៖ ការគ្រប់គ្រងអតិថិជន (Customer 360 & Management)
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
      userDetails.kycDocument =
        userDetails.kycDocument ||
        userDetails.kycImage ||
        userDetails.idCardImage ||
        "";
      userDetails.kycImage = userDetails.kycDocument;
      res.json({ success: true, user: userDetails });
    } else {
      res.json({ success: false, message: "រកមិនឃើញអតិថិជននេះទេ!" });
    }
  } catch (error) {
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
      userDetails.kycDocument =
        userDetails.kycDocument ||
        userDetails.kycImage ||
        userDetails.idCardImage ||
        "";
      userDetails.kycImage = userDetails.kycDocument;
      res.json({ success: true, user: userDetails });
    } else {
      res.json({ success: false, message: "រកមិនឃើញគណនីនេះទេ!" });
    }
  } catch (error) {
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

    if (accountNumber) u.mainAccounts.USD.accountNumber = accountNumber;
    if (accountNumberKHR) u.mainAccounts.KHR.accountNumber = accountNumberKHR;
    if (username) u.username = username;
    if (pin) u.pin = pin;
    if (profileImage !== undefined) u.profileImage = profileImage;
    if (password && password.trim() !== "") u.password = password;

    await u.save();
    await logAdminAction(
      req.admin.username,
      "Edit User",
      u.username,
      `Updated user profile/credentials`,
    );
    res.json({ success: true });
  } catch (err) {
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

const kycAction = async (req, res) => {
  const { username, action } = req.body;
  try {
    const u = await User.findOne({ username });
    if (u) {
      u.kycStatus = action;
      await Notification.create({
        userId: u._id,
        username: u.username,
        title: "KYC Verification",
        message: `ឯកសារបញ្ជាក់អត្តសញ្ញាណរបស់អ្នកត្រូវបាន ${action === "approved" ? "អនុម័តជោគជ័យ ✅" : "បដិសេធ ❌"}។`,
        date: getFormattedDate(),
        type: "info",
        isRead: false,
        metadata: { sender: "system" },
      });
      await u.save();
      await logAdminAction(
        req.admin.username,
        "KYC Action",
        u.username,
        `KYC ${action.toUpperCase()}`,
      );
      res.json({ success: true });
    } else res.json({ success: false });
  } catch (err) {
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

const refundTransaction = async (req, res) => {
  const access = await checkAdminAccess(req.admin, "refund");
  if (!access.allowed)
    return res.status(403).json({ success: false, message: access.message });

  const { refId, reason } = req.body;
  const cleanRefId = String(refId).trim();

  try {
    const originalTrx = await Transaction.findOne({
      $or: [{ refId: cleanRefId }, { hash: cleanRefId }],
    });
    if (!originalTrx)
      return res.json({
        success: false,
        message: "បរាជ័យ! រកប្រតិបត្តិការមិនឃើញទេ!",
      });
    if (originalTrx.status === "Refunded")
      return res.json({
        success: false,
        message: "ប្រតិបត្តិការនេះត្រូវបាន Refund រួចរាល់ហើយ!",
      });

    const senderAcc = originalTrx.senderAcc;
    const receiverAcc = originalTrx.receiverAcc;
    if (!senderAcc || !receiverAcc)
      return res.json({
        success: false,
        message: "Transaction នេះគ្មានទិន្នន័យលេខកុងគ្រប់គ្រាន់ទេ!",
      });

    const sender = await User.findOne({
      $or: [
        { "mainAccounts.USD.accountNumber": senderAcc },
        { "mainAccounts.KHR.accountNumber": senderAcc },
      ],
    });
    const receiver = await User.findOne({
      $or: [
        { "mainAccounts.USD.accountNumber": receiverAcc },
        { "mainAccounts.KHR.accountNumber": receiverAcc },
      ],
    });

    if (!sender || !receiver)
      return res.json({ success: false, message: "រកគណនីពិតប្រាកដមិនឃើញទេ!" });

    const isKHR = originalTrx.currency === "KHR";
    const refundAmount = Math.abs(Number(originalTrx.amount));
    const receiverBalance = isKHR
      ? receiver.mainAccounts?.KHR?.balance || 0
      : receiver.mainAccounts?.USD?.balance || 0;

    if (receiverBalance < refundAmount) {
      return res.json({
        success: false,
        message: `មិនអាច Refund បានទេ! អ្នកទទួល (@${receiver.username}) ចាយលុយអស់ខ្លះហើយ សល់ត្រឹម ${isKHR ? "៛" : "$"}${receiverBalance}។`,
      });
    }

    if (isKHR) {
      receiver.mainAccounts.KHR.balance -= refundAmount;
      sender.mainAccounts.KHR.balance += refundAmount;
    } else {
      receiver.mainAccounts.USD.balance -= refundAmount;
      sender.mainAccounts.USD.balance += refundAmount;
    }

    const dateNow =
      typeof getFormattedDate === "function"
        ? getFormattedDate()
        : new Date().toISOString();

    const refundTxSender = new Transaction({
      userId: sender._id,
      refId: generateStandardRefId("RFS"),
      hash: generateStandardHash(),
      date: dateNow,
      type: "Refund Received",
      amount: refundAmount,
      currency: originalTrx.currency,
      fee: 0,
      username: sender.username,
      senderName: receiver.username,
      senderAcc: receiver.mainAccounts.USD.accountNumber,
      receiverName: sender.username,
      receiverAcc: sender.mainAccounts.USD.accountNumber,
      remark: `Admin Refund: ${reason}`,
      status: "Success",
      trxMethod: "System Refund",
    });

    const refundTxReceiver = new Transaction({
      userId: receiver._id,
      refId: generateStandardRefId("RFR"),
      hash: generateStandardHash(),
      date: dateNow,
      type: "Refund Deducted",
      amount: -refundAmount,
      currency: originalTrx.currency,
      fee: 0,
      username: receiver.username,
      senderName: receiver.username,
      senderAcc: receiver.mainAccounts.USD.accountNumber,
      receiverName: sender.username,
      receiverAcc: receiver.mainAccounts.USD.accountNumber,
      remark: `Reversed by Admin: ${reason}`,
      status: "Success",
      trxMethod: "System Refund",
    });

    await refundTxSender.save();
    await refundTxReceiver.save();
    await Transaction.updateMany(
      { $or: [{ refId: cleanRefId }, { hash: cleanRefId }] },
      {
        $set: {
          status: "Refunded",
          remark: `[REFUNDED BY ADMIN] មូលហេតុ: ${reason}`,
        },
      },
    );

    await Notification.create([
      {
        userId: sender._id,
        username: sender.username,
        title: "Refund Processed ✅",
        message: `ទឹកប្រាក់ ${isKHR ? "៛" : "$"}${refundAmount} ពីប្រតិបត្តិការលេខ ${cleanRefId} ត្រូវបានបង្វិលចូលគណនីអ្នកវិញ។ មូលហេតុ: ${reason}`,
        date: dateNow,
        type: "refund_receive",
        isRead: false,
      },
      {
        userId: receiver._id,
        username: receiver.username,
        title: "Refund Deducted ⚠️️",
        message: `ទឹកប្រាក់ ${isKHR ? "៛" : "$"}${refundAmount} នៃប្រតិបត្តិការលេខ ${cleanRefId} ត្រូវបានដកចេញពីគណនីអ្នកដោយ Admin។ មូលហេតុ: ${reason}`,
        date: dateNow,
        type: "info",
        isRead: false,
      },
    ]);

    await sender.save();
    await receiver.save();

    if (typeof logAdminAction === "function") {
      await logAdminAction(
        req.admin.username,
        "Refund Transaction",
        `${receiver.username} -> ${sender.username}`,
        `Refunded ${isKHR ? "៛" : "$"}${refundAmount}. Reason: ${reason}`,
      );
    }

    return res.json({
      success: true,
      message: `កាត់លុយពី @${receiver.username} ត្រលប់មកអោយ @${sender.username} វិញបានជោគជ័យ ១០០%!`,
    });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: "Server Error: " + err.message });
  }
};

const getPublicReceipt = async (req, res) => {
  try {
    const { id } = req.params;

    let ticketQuery = [{ transactionId: id }];
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
  depositorAccount, // 🟢 ទទួលយកលេខកុងអ្នកដាក់ពិតប្រាកដ
  currency,
  cashAmount,
  remark,
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
  if (isInputKHR)
    centralBank.mainAccounts.KHR.balance =
      (centralBank.mainAccounts.KHR.balance || 0) + bankModifier;
  else
    centralBank.mainAccounts.USD.balance =
      (centralBank.mainAccounts.USD.balance || 0) + bankModifier;

  const userModifier =
    requestType === "Deposit" ? finalReceiveAmount : -finalReceiveAmount;

  if (targetAccount === targetUser.mainAccounts?.USD?.accountNumber) {
    if (
      requestType === "Withdrawal" &&
      targetUser.mainAccounts.USD.balance < finalReceiveAmount
    )
      return { success: false, message: "លុយមិនគ្រប់គ្រាន់!" };
    targetUser.mainAccounts.USD.balance += userModifier;
  } else if (targetAccount === targetUser.mainAccounts?.KHR?.accountNumber) {
    if (
      requestType === "Withdrawal" &&
      (targetUser.mainAccounts.KHR.balance || 0) < finalReceiveAmount
    )
      return { success: false, message: "លុយមិនគ្រប់គ្រាន់!" };
    targetUser.mainAccounts.KHR.balance =
      (targetUser.mainAccounts.KHR.balance || 0) + userModifier;
  } else if (subIndex !== -1) {
    if (
      requestType === "Withdrawal" &&
      targetUser.subAccounts[subIndex].balance < finalReceiveAmount
    )
      return { success: false, message: "លុយមិនគ្រប់គ្រាន់!" };
    targetUser.subAccounts[subIndex].balance += userModifier;
  }

  const dateStr = new Date().toLocaleString("en-US", {
    timeZone: "Asia/Phnom_Penh",
    hour12: true,
  });
  const refId = generateStandardRefId(
    requestType === "Deposit" ? "DEP" : "WIT",
  );

  // 🟢 ១. កំណត់ Remark ដោយយកឈ្មោះ និងលេខគណនីរបស់អ្នកដាក់ផ្ទាល់
  const autoRemark =
    requestType === "Deposit"
      ? `ដាក់ប្រាក់ដោយ: ${depositorName} (${depositorAccount})`
      : `ដកប្រាក់ដោយ: ${depositorName} (${depositorAccount})`;

  const finalRemark =
    remark && remark.trim() !== ""
      ? `${remark.trim()} | ${autoRemark}`
      : autoRemark;

  // 🟢 ២. កែសម្រួល Sender/Receiver ឱ្យចេញពាក្យ Cash Deposit លើ Slip
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
    // ប្តូរឈ្មោះអ្នកផ្ញើឱ្យទៅជាពាក្យ Cash Deposit / Withdrawal មិនឱ្យចេញឈ្មោះ MENG SENG
    senderName:
      requestType === "Deposit" ? "Cash Deposit" : targetUser.fullName,
    senderAcc: requestType === "Deposit" ? "" : actualReceiverAcc, // បញ្ចេញទទេកុំឱ្យលោតកុងក្រោមពាក្យ Cash Deposit
    receiverName:
      requestType === "Deposit" ? targetUser.fullName : "Cash Withdrawal",
    receiverAcc: requestType === "Deposit" ? actualReceiverAcc : "",
    remark: finalRemark,
    status: "Success",
    // 🟢 ៣. កែប្រែ Payment Via ឱ្យចេញ Cash Deposit មិនមែន U-PAY Cashier ទេ[cite: 18]
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

  // 🟢 ៤. Notification ជូនដំណឹងដល់អតិថិជន
  const sign = requestType === "Deposit" ? "+" : "-";
  const formattedAmount = `${sign}${destCurrency === "USD" ? "$" : "៛"}${finalReceiveAmount.toLocaleString("en-US", { minimumFractionDigits: destCurrency === "USD" ? 2 : 0 })}`;

  // បង្កើតប្រយោគដើម
  let notifMsg =
    requestType === "Deposit"
      ? `ទឹកប្រាក់ ${formattedAmount} ត្រូវបានដាក់ចូលគណនី (${actualReceiverAcc}) របស់អ្នក។ ដាក់ប្រាក់ដោយ: ${depositorName}`
      : `ទឹកប្រាក់ ${formattedAmount} ត្រូវបានដកចេញពីគណនី (${actualReceiverAcc}) របស់អ្នក។ ដកប្រាក់ដោយ: ${depositorName}`;

  // 🟢 បន្ថែមចំណាំ (Remark) ចូលទៅចុងប្រយោគ ប្រសិនបើ Admin បានវាយបញ្ជូល
  if (remark && remark.trim() !== "") {
    notifMsg += `។ ចំណាំ៖ ${remark.trim()}`;
  } else {
    notifMsg += `។`; // បិទប្រយោគដោយសញ្ញាខណ្ឌធម្មតា
  }

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

  await targetUser.save();
  await centralBank.save();
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
    const isBigTrx =
      (currency === "USD" && cashAmount > 10000) ||
      (currency === "KHR" && cashAmount > 40000000);
    const ticketStatus = isBigTrx ? "pending_approve" : "pending_verify";

    const newTicket = new CashierTicket({
      userId: targetUser._id,
      maker: req.admin.username,
      requestType,
      amount: cashAmount,
      currency,
      targetAcc: targetAccount,
      depositorName,
      status: ticketStatus,
      remark,
      // 🟢 ថែរក្សាលេខកុងអ្នកដាក់ចូលទៅក្នុង slipData សម្រាប់ពេល Approve ក្រោយ
      slipData: {
        customerName: targetUser.fullName || targetUser.username,
        depositorAccount: depositorAccount || "N/A",
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
        ? "រង់ចាំការអនុម័ត (Pending Approval)"
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

    if (action === "approve") {
      if (ticket.status === "pending_approve") {
        const targetUser = await User.findById(ticket.userId);
        const result = await executeCashierTransaction(
          targetUser,
          ticket.targetAcc,
          ticket.requestType,
          ticket.depositorName,
          ticket.slipData?.depositorAccount || "N/A", // 🟢 ទាញលេខកុងពី slipData មកប្រើ
          ticket.currency,
          ticket.amount,
          ticket.remark,
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
      ticket.status = "rejected";
      ticket.rejectReason = reason;
      ticket.checker = req.admin.username;
      await ticket.save();
      res.json({ success: true, message: "បានបដិសេធជោគជ័យ!" });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// ==========================================
// 💳 ផ្នែកទី ៩៖ កាតនិម្មិត និងហាងទំនិញ (Cards & Merchants)
// ==========================================

const toggleAdminCardLock = async (req, res) => {
  const access = await checkAdminAccess(req.admin, "freezeUser");
  if (!access.allowed)
    return res.status(403).json({ success: false, message: access.message });

  const { username, cardId, isLocked } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user || !user.virtualCards)
      return res.json({ success: false, message: "រកមិនឃើញគណនី ឬកាតទេ!" });

    const card = user.virtualCards.find((c) => c.id === cardId);
    if (!card)
      return res.json({ success: false, message: "រកមិនឃើញកាតនេះទេ!" });

    card.isLocked = isLocked;
    card.lockedByAdmin = isLocked;
    user.markModified("virtualCards");
    await user.save();

    await logAdminAction(
      req.admin.username,
      "Toggle Card",
      user.username,
      `Card ${card.number?.slice(-4) || ""} set to ${isLocked ? "FROZEN" : "ACTIVE"}`,
    );
    res.json({
      success: true,
      message: `កាតត្រូវបាន ${isLocked ? "បង្កក" : "បើកដំណើរការវិញ"} ជោគជ័យ!`,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

const adminDeleteCard = async (req, res) => {
  const { username, cardId, reason } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user) return res.json({ success: false, message: "រកមិនឃើញអតិថិជន" });
    user.virtualCards = user.virtualCards.filter((c) => c.id !== cardId);
    await user.save();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

const adminCreateCard = async (req, res) => {
  const { username, cardType, customBgUrl, remark } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user) return res.json({ success: false, message: "រកមិនឃើញអតិថិជន" });

    const cardTiers = {
      standard: 2.0,
      fifa: 10.0,
      metal: 15.0,
      celebrity: 10.0,
      anime: 8.0,
      gamer: 8.0,
      eco: 3.0,
      platinum: 25.0,
      animal: 8.0,
      custom: 25.0,
    };
    const price = cardTiers[cardType] || 2.0;

    if ((user.mainAccounts?.USD?.balance || 0) < price) {
      return res.json({
        success: false,
        message: `អតិថិជនមិនមានប្រាក់គ្រប់គ្រាន់ ($${price.toFixed(2)}) ដើម្បីបង្កើតកាតនេះទេ!`,
      });
    }

    user.mainAccounts.USD.balance -= price;
    const dateStr = new Date().toLocaleString("en-US", {
      timeZone: "Asia/Phnom_Penh",
      hour12: true,
    });

    await Transaction.create({
      userId: user._id,
      username: user.username,
      refId: generateStandardRefId("FEE"),
      hash: generateStandardHash(),
      date: dateStr,
      type: "Card Issuance Fee",
      amount: -price,
      currency: "USD",
      fee: 0,
      senderName: user.username,
      senderAcc: user.mainAccounts.USD.accountNumber,
      receiverName: "Card Issuance Service",
      receiverAcc: "888888888",
      remark: `ការកាត់សេវាបង្កើតកាត (${cardType.toUpperCase()}) - ${remark || "ដោយ Admin"}`,
      status: "Success",
      trxMethod: "U PAY Fee",
    });

    const systemAcc = await User.findOne({
      "mainAccounts.USD.accountNumber": "888888888",
    });
    if (systemAcc) {
      systemAcc.mainAccounts.USD.balance += price;
      await systemAcc.save();
    }

    const generateNumber = (length) =>
      Math.floor(Math.random() * Math.pow(10, length))
        .toString()
        .padStart(length, "0");

    const newCard = {
      id: "card_" + Date.now(),
      type: cardType,
      number:
        cardType === "platinum"
          ? "43050521" + generateNumber(8)
          : "47718680" + generateNumber(8),
      expiryDate: "12/28",
      cvv: generateNumber(3),
      isLocked: false,
      customBgUrl: customBgUrl || "",
      createdAt: new Date(),
    };

    if (!user.virtualCards) user.virtualCards = [];
    user.virtualCards.push(newCard);

    await Notification.create({
      userId: user._id,
      username: user.username,
      title: "កាតនិម្មិតថ្មីត្រូវបានបង្កើត",
      message: `កាត ${cardType.toUpperCase()} ថ្មីរបស់អ្នកត្រូវបានបង្កើតរួចរាល់។ ទឹកប្រាក់ $${price.toFixed(2)} ត្រូវបានកាត់ចេញពីគណនីរបស់អ្នក។`,
      date: dateStr,
      type: "info",
      isRead: false,
    });
    await user.save();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

const adminCreateMerchant = async (req, res) => {
  const { username, name, city, category, linkedAccount } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user) return res.json({ success: false, message: "រកមិនឃើញអតិថិជន" });

    const newMerchant = {
      id: "m_" + Date.now(),
      merchantId: Math.floor(100000 + Math.random() * 900000).toString(),
      name: name,
      city: city,
      category: category,
      linkedAccount: linkedAccount,
      status: "active",
      accountNumbers: {
        USD: user.mainAccounts?.USD?.accountNumber || "",
        KHR: user.mainAccounts?.KHR?.accountNumber || "",
      },
      balance: 0,
      createdAt: new Date(),
    };

    if (!user.merchantProfile) user.merchantProfile = { merchants: [] };
    if (!user.merchantProfile.merchants) user.merchantProfile.merchants = [];

    user.merchantProfile.merchants.push(newMerchant);
    await user.save();
    res.json({ success: true, merchant: newMerchant });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error" });
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

const ticketReply = async (req, res) => {
  const { username, ticketId, replyMessage } = req.body;
  try {
    const u = await User.findOne({ username });
    if (u && u.tickets) {
      const t = u.tickets.find((t) => t.ticketId === ticketId);
      if (t) {
        t.status = "Answered";
        t.adminReply = replyMessage;
        await Notification.create({
          userId: u._id,
          username: u.username,
          title: "Support Reply: " + t.subject,
          message: `Admin: ${replyMessage}`,
          date: getFormattedDate(),
          type: "info",
          isRead: false,
          metadata: { sender: "system" },
        });
        u.markModified("tickets");
        await u.save();
        await logAdminAction(
          req.admin.username,
          "Reply Ticket",
          u.username,
          `Replied to ticket ID: ${ticketId}`,
        );
        res.json({ success: true });
      } else res.json({ success: false });
    } else res.json({ success: false });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
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
  deleteUser,
  toggleFreeze,
  adminForceLogout,
  adminUploadKyc,
  kycAction,

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

  // Cards & Merchants
  toggleAdminCardLock,
  adminDeleteCard,
  adminCreateCard,
  adminCreateMerchant,

  // Promo, Tickets, Broadcast
  createPromoCode,
  getPromoCodes,
  togglePromoCode,
  ticketReply,
  broadcast,
  getBroadcastHistory,
  deleteBroadcast,
  sendDirectMessage,
};
