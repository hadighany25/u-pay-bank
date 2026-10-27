// ============================================================================
// ឯកសារ: controllers/adminController.js
// អត្ថន័យ: ខួរក្បាលបញ្ជាប្រព័ន្ធទាំងមូលរបស់ Admin (System, Users, Finance, Reports)
// ស្តង់ដារថ្មី: ចាប់ទិន្នន័យតាម MongoDB `_id` សុទ្ធសាធ + បង្ហាញឈ្មោះពេញ (fullName) + បែងចែក Icon សារជូនដំណឹង
// ============================================================================

// ============================================================================
// 📦 ជំពូកទី ១៖ ការនាំចូលបណ្ណាល័យ និងម៉ូដែល (IMPORTS & MODELS)
// ============================================================================
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

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

// ============================================================================
// 🛠️ ជំពូកទី ២៖ អនុគមន៍ជំនួយស្នូល, ចាប់តាម `_id` និងម៉ាស៊ីនលុបទិន្នន័យ (CORE HELPERS)
// ============================================================================

/**
 * 🔹 ២.១ បង្កើត Hash ស្ដង់ដារ ១០ ខ្ទង់ និង Reference ID ៨ ខ្ទង់
 */
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
 * 🔹 ២.២ ការកំណត់តម្លៃ និងប្រភេទកាតទាំង ១០ ប្រភេទ + បង្កើតលេខកាត ១៦ ខ្ទង់
 */
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
 * 🔹 ២.៣ អនុគមន៍ទាញយកឈ្មោះពេញ (Full Name) សម្រាប់បង្ហាញក្នុងសារជូនដំណឹង (ហាមប្រើ @username!)
 */
const getDisplayName = (entity, fallbackLabel = "អតិថិជន U-Pay") => {
  if (!entity) return fallbackLabel;
  if (typeof entity === "string") return entity;
  if (entity.fullName && String(entity.fullName).trim() !== "") {
    return String(entity.fullName).trim();
  }
  if (entity.name && String(entity.name).trim() !== "") {
    return String(entity.name).trim();
  }
  if (entity.nickname && String(entity.nickname).trim() !== "") {
    return String(entity.nickname).trim();
  }
  return entity.username || fallbackLabel;
};

/**
 * 🔹 ២.៤ អនុគមន៍ទាញយកឈ្មោះពេញរបស់បុគ្គលិក Admin សម្រាប់បង្ហាញក្នុងសារជូនដំណឹង
 */
const getAdminFullDisplayName = async (reqAdmin) => {
  if (!reqAdmin) return "មន្ត្រីប្រតិបត្តិធនាគារ U-Pay";
  if (reqAdmin.fullName && String(reqAdmin.fullName).trim() !== "") {
    return String(reqAdmin.fullName).trim();
  }
  try {
    const adminId = reqAdmin._id || reqAdmin.id;
    const adm = mongoose.isValidObjectId(adminId)
      ? await Admin.findById(adminId)
          .select("fullName nickname username")
          .lean()
      : await Admin.findOne({ username: reqAdmin.username })
          .select("fullName nickname username")
          .lean();
    if (adm) {
      return adm.fullName || adm.nickname || "មន្ត្រីប្រតិបត្តិធនាគារ U-Pay";
    }
  } catch (e) {}
  return "មន្ត្រីប្រតិបត្តិធនាគារ U-Pay";
};

/**
 * 🔹 ២.៥ ម៉ាស៊ីនស្វែងរកអតិថិជនសកលដោយផ្តល់អាទិភាព ១០០% លើ MongoDB `_id` (Strict _id Resolver)
 * - បើ Frontend បោះ `_id` (ឬ `userId`, `id`, `username`) មក វានឹងរកតាម `_id` មុនគេជានិច្ច!
 */
const resolveCustomerById = async (identifier, selectFields = null) => {
  if (!identifier) return null;
  const raw =
    typeof identifier === "object"
      ? identifier._id ||
        identifier.userId ||
        identifier.id ||
        identifier.targetUserId ||
        identifier.username
      : identifier;

  const clean = String(raw || "")
    .replace(/^@/, "")
    .trim();
  if (!clean) return null;

  // ១. អាទិភាពទី ១៖ ប្រសិនបើជា MongoDB ObjectId ២៤ ខ្ទង់ គឺចាប់តាម _id ផ្ទាល់តែម្ដង!
  if (mongoose.isValidObjectId(clean)) {
    const byIdQuery = User.findById(clean);
    if (selectFields) byIdQuery.select(selectFields);
    const foundById = await byIdQuery;
    if (foundById) return foundById;
  }

  // ២. Fallback សម្រាប់ទ្រទ្រង់កន្លែងដែលវាយស្វែងរកតាមលេខគណនី លេខទូរស័ព្ទ ឬឈ្មោះ
  const exactRx = new RegExp(
    "^" + clean.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$",
    "i",
  );
  const fallbackQuery = User.findOne({
    $or: [
      { username: exactRx },
      { "mainAccounts.USD.accountNumber": clean },
      { "mainAccounts.KHR.accountNumber": clean },
      { "subAccounts.accountNumber": clean },
      { phone: clean },
    ],
  });
  if (selectFields) fallbackQuery.select(selectFields);
  return await fallbackQuery;
};

/**
 * 🔹 ២.៦ កត់ត្រារាល់សកម្មភាពរបស់ Admin ចូលក្នុង AdminLog (រក្សាទុកទាំង _id និង ឈ្មោះពេញ)
 */
const logAdminAction = async (adminName, action, target, details) => {
  try {
    const now = new Date();
    const khmerTimeStr = now.toLocaleString("en-US", {
      timeZone: "Asia/Phnom_Penh",
    });
    await AdminLog.create({
      admin: adminName || "System",
      action: action,
      target: target ? String(target) : "System",
      details: details || "",
      date: khmerTimeStr,
    });
  } catch (error) {
    console.error("Failed to log admin action:", error);
  }
};

/**
 * 🔹 ២.៧ ត្រួតពិនិត្យសិទ្ធិ និងម៉ោងធ្វើការរបស់បុគ្គលិក Admin (តាម Admin _id)
 */
const checkAdminAccess = async (reqAdmin, actionKey) => {
  if (reqAdmin.role === "super_admin") return { allowed: true };

  const adminAcc = await Admin.findById(reqAdmin._id || reqAdmin.id);
  if (!adminAcc) {
    return { allowed: false, message: "គណនីបុគ្គលិកមិនត្រឹមត្រូវ!" };
  }

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
    await logAdminAction(
      req.admin.fullName || req.admin.username,
      action,
      target,
      details,
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false });
  }
};

/**
 * 🔹 ២.៨ ម៉ាស៊ីនបោសសម្អាតទិន្នន័យអតិថិជនចេញពីគ្រប់ Models ទាំងអស់ដោយប្រើ `_id` សុទ្ធសាធ!
 * (Cascading Purge Engine: User, Junior Kids, Parent SubAccounts, Cards, Merchants, Chats, Notifs, Tickets, Trxs, Logs)
 */
async function cascadePurgeSingleUserDocument(
  targetUser,
  centralBank,
  reason = "Admin Deleted Account",
) {
  if (!targetUser) return { usdRecovered: 0, khrRecovered: 0 };

  const targetObjId = targetUser._id;
  const targetStrId = String(targetUser._id);
  const targetFullName = getDisplayName(targetUser);
  const dateStr = new Date().toLocaleString("en-US", {
    timeZone: "Asia/Phnom_Penh",
    hour12: true,
  });

  // ១. បើគណនីដែលត្រូវលុបនេះជាអាណាព្យាបាល (Parent) ត្រូវលុបគណនីកូនៗតាម `parentId: targetObjId` (_id សុទ្ធ!)
  const childAccounts = await User.find({
    role: "junior",
    parentId: targetObjId,
  });

  for (const childDoc of childAccounts) {
    await cascadePurgeSingleUserDocument(
      childDoc,
      centralBank,
      `Parent Account (${targetFullName}) Deleted`,
    );
  }

  // ២. បើគណនីដែលត្រូវលុបនេះជាគណនីកូន (Junior) ដកចេញពីបញ្ជី subAccounts របស់ប៉ាម៉ាក់តាម `parentId` (_id សុទ្ធ!)
  if (targetUser.role === "junior" && targetUser.parentId) {
    const parentUser = await User.findById(targetUser.parentId);
    if (parentUser && Array.isArray(parentUser.subAccounts)) {
      parentUser.subAccounts = parentUser.subAccounts.filter((sa) => {
        const matchByLinkedId =
          sa.linkedUserId && String(sa.linkedUserId) === targetStrId;
        const matchByAccId =
          sa.accountId === targetStrId || sa.accountId === targetStrId + "_khr";
        return !(matchByLinkedId || matchByAccId);
      });
      parentUser.markModified("subAccounts");
      await parentUser.save();
    }
  }

  // ៣. ប្រមូលសមតុល្យដែលនៅសល់ក្នុងគណនី (Main + Sub មិនមែន Junior) ផ្ទេរចូលធនាគារកណ្តាល (Central Bank Recovery)
  let totalUSD = Number(targetUser.mainAccounts?.USD?.balance || 0);
  let totalKHR = Number(targetUser.mainAccounts?.KHR?.balance || 0);

  if (Array.isArray(targetUser.subAccounts)) {
    targetUser.subAccounts.forEach((sub) => {
      if (sub.accountType !== "junior") {
        if (sub.currency === "USD") totalUSD += Number(sub.balance || 0);
        if (sub.currency === "KHR") totalKHR += Number(sub.balance || 0);
      }
    });
  }

  if (centralBank && (totalUSD > 0 || totalKHR > 0)) {
    centralBank.mainAccounts.USD.balance =
      (centralBank.mainAccounts.USD.balance || 0) + totalUSD;
    centralBank.mainAccounts.KHR.balance =
      (centralBank.mainAccounts.KHR.balance || 0) + totalKHR;
    centralBank.markModified("mainAccounts");
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
        senderName: targetFullName,
        receiverName: "ធនាគារកណ្តាល U-Pay (Central Bank)",
        remark: `ប្រមូលមូលនិធិពីគណនីដែលត្រូវបានលុប (${targetFullName}) | មូលហេតុ: ${reason}`,
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
        senderName: targetFullName,
        receiverName: "ធនាគារកណ្តាល U-Pay (Central Bank)",
        remark: `ប្រមូលមូលនិធិពីគណនីដែលត្រូវបានលុប (${targetFullName}) | មូលហេតុ: ${reason}`,
        status: "Success",
      });
    }
  }

  // ៤. លុបទិន្នន័យពាក់ព័ន្ធទាំងអស់ចេញពីគ្រប់ Models ដោយចាប់តាម `_id` តែមួយគត់!
  await Promise.all([
    Card.deleteMany({ userId: targetObjId }),
    Merchant.deleteMany({ ownerId: targetObjId }),
    Notification.deleteMany({ userId: targetObjId }),
    Chat.deleteMany({
      $or: [{ senderId: targetStrId }, { receiverId: targetStrId }],
    }),
    CashierTicket.deleteMany({ userId: targetObjId }),
    Transaction.deleteMany({ userId: targetObjId }),
    JointAccount.deleteMany({ "members.userId": targetObjId }),
    AdminLog.deleteMany({ target: targetStrId }),
  ]);

  // ៥. លុប Document អតិថិជនចេញពីតារាង User ជាស្ថាពរ
  await User.deleteOne({ _id: targetObjId });

  return { usdRecovered: totalUSD, khrRecovered: totalKHR };
}

// ============================================================================
// 🛡️ ជំពូកទី ៣៖ ការគ្រប់គ្រងគណនីបុគ្គលិក ADMIN (ADMIN STAFF MANAGEMENT BY `_id`)
// ============================================================================

/**
 * 🔹 ៣.១ ទាញយកព័ត៌មានបុគ្គលិក Admin ដែលកំពុង Login តាម `_id`
 */
const getMe = async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin._id || req.admin.id).select(
      "-password",
    );
    res.json({ success: true, admin });
  } catch (error) {
    res.status(500).json({ success: false });
  }
};

/**
 * 🔹 ៣.២ ទាញយកបញ្ជីបុគ្គលិក Admin ទាំងអស់
 */
const getAdminsList = async (req, res) => {
  try {
    const admins = await Admin.find({}, "-password");
    res.json({ success: true, admins });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * 🔹 ៣.៣ ទាញយកកំណត់ត្រាសកម្មភាព (Audit Logs) សម្រាប់អតិថិជនជាក់លាក់តាម `_id` តែមួយគត់!
 */
const getUserLogs = async (req, res) => {
  try {
    const identifier = req.params.id || req.params.username;
    const customer = await resolveCustomerById(identifier, "_id createdAt");
    if (!customer) {
      return res.json({ success: true, logs: [] });
    }

    const canonicalId = String(customer._id);
    const userCreatedAtMs = customer.createdAt
      ? new Date(customer.createdAt).getTime() - 60000
      : 0;

    // 🎯 ចាប់យកតែកំណត់ត្រាណាដែលមាន target ស្មើនឹង MongoDB `_id` របស់គណនីនេះប៉ុណ្ណោះ!
    const rawLogs = await AdminLog.find({ target: canonicalId })
      .sort({ _id: -1 })
      .limit(100)
      .lean();

    const validLogs = rawLogs.filter((log) => {
      const actLower = String(log.action || "").toLowerCase();
      if (
        actLower.includes("delete user") ||
        actLower.includes("delete account")
      ) {
        return false;
      }
      const logTimeMs =
        log._id && String(log._id).length === 24
          ? parseInt(String(log._id).substring(0, 8), 16) * 1000
          : 0;
      if (userCreatedAtMs > 0 && logTimeMs > 0 && logTimeMs < userCreatedAtMs) {
        return false;
      }
      return true;
    });

    res.json({ success: true, logs: validLogs });
  } catch (err) {
    console.error("Get User Logs Error:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * 🔹 ៣.៤ ទាញយកកំណត់ត្រាសកម្មភាពរបស់បុគ្គលិក Admin ទាំងអស់
 */
const getAdminLogs = async (req, res) => {
  try {
    if (req.admin.role !== "super_admin") {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    const logs = await AdminLog.find().sort({ _id: -1 }).limit(500);
    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

/**
 * 🔹 ៣.៥ បង្កើត ឬ កែប្រែគណនីបុគ្គលិក Admin តាម `_id`
 */
const saveAdminAccount = async (req, res) => {
  const {
    id,
    _id,
    staffId,
    fullName,
    nickname,
    profileImage,
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
    const targetAdminId = _id || id;
    const cleanNfc =
      nfcUid && String(nfcUid).trim() !== "" ? String(nfcUid).trim() : null;

    if (cleanNfc) {
      const existingNfcUser = await Admin.findOne({ nfcUid: cleanNfc });
      if (
        existingNfcUser &&
        existingNfcUser._id.toString() !== String(targetAdminId)
      ) {
        return res.json({
          success: false,
          message: `កាត NFC នេះត្រូវបានភ្ជាប់ជាមួយបុគ្គលិកឈ្មោះ "${getDisplayName(existingNfcUser)}" រួចហើយ! សូមផ្តាច់ពីគណនីនោះសិន ឬប្រើកាតថ្មី។`,
        });
      }
    }

    if (targetAdminId && mongoose.isValidObjectId(targetAdminId)) {
      const adminToUpdate = await Admin.findById(targetAdminId);
      if (!adminToUpdate) {
        return res.json({
          success: false,
          message: "រកមិនឃើញគណនីបុគ្គលិកទេ!",
        });
      }

      if (username) adminToUpdate.username = username;
      if (role) adminToUpdate.role = role;
      if (fullName !== undefined) adminToUpdate.fullName = fullName;
      if (nickname !== undefined) adminToUpdate.nickname = nickname;
      if (profileImage !== undefined) adminToUpdate.profileImage = profileImage;
      if (phone !== undefined) adminToUpdate.phone = phone;
      if (email !== undefined) adminToUpdate.email = email;
      if (department !== undefined) adminToUpdate.department = department;
      if (remarks !== undefined) adminToUpdate.remarks = remarks;
      if (nfcUid !== undefined) adminToUpdate.nfcUid = cleanNfc;
      if (permissions) adminToUpdate.permissions = permissions;
      if (password && password.trim() !== "") {
        adminToUpdate.password = await bcrypt.hash(password, 10);
      }

      await adminToUpdate.save();
      await logAdminAction(
        req.admin.fullName || req.admin.username,
        "Update Admin",
        String(adminToUpdate._id),
        `Updated staff "${getDisplayName(adminToUpdate)}" (Role: ${adminToUpdate.role}, NFC: ${cleanNfc || "Unlinked"})`,
      );
      return res.json({
        success: true,
        message: "កែប្រែព័ត៌មានបុគ្គលិកបានជោគជ័យ!",
        admin: adminToUpdate,
      });
    } else {
      const exists = await Admin.findOne({ username });
      if (exists) {
        return res.json({
          success: false,
          message: "ឈ្មោះគណនី (Username) នេះមានអ្នកប្រើប្រាស់ហើយ!",
        });
      }
      if (!password) {
        return res.json({ success: false, message: "សូមបញ្ចូលពាក្យសម្ងាត់!" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const newAdmin = new Admin({
        staffId:
          staffId || "UPAY-" + Math.floor(100000 + Math.random() * 900000),
        fullName,
        nickname,
        profileImage: profileImage || "",
        phone,
        email,
        department,
        remarks,
        nfcUid: cleanNfc,
        username,
        password: hashedPassword,
        role,
        permissions,
      });
      await newAdmin.save();

      await logAdminAction(
        req.admin.fullName || req.admin.username,
        "Create Admin",
        String(newAdmin._id),
        `Created new staff account "${getDisplayName(newAdmin)}" as ${role}`,
      );
      return res.json({
        success: true,
        message: "បង្កើតគណនីបុគ្គលិកថ្មីជោគជ័យ!",
        admin: newAdmin,
      });
    }
  } catch (err) {
    console.error("Save Admin Error:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * 🔹 ៣.៦ ឆែកមើលភាពទំនេរនៃកាត NFC បុគ្គលិក Admin តាម `_id`
 */
const checkAdminNfcUid = async (req, res) => {
  const { nfcUid, adminId } = req.body;
  try {
    if (!nfcUid) {
      return res.json({ available: false, message: "គ្មានទិន្នន័យ NFC" });
    }
    const existingAdmin = await Admin.findOne({ nfcUid: nfcUid });
    if (
      existingAdmin &&
      existingAdmin._id.toString() !== String(adminId || "")
    ) {
      return res.json({
        available: false,
        owner: getDisplayName(existingAdmin),
      });
    }
    return res.json({ available: true });
  } catch (error) {
    res.status(500).json({ available: false, message: "Server Error" });
  }
};

/**
 * 🔹 ៣.៧ លុបគណនីបុគ្គលិក Admin តាម `_id`
 */
const deleteAdminAccount = async (req, res) => {
  const { id, _id } = req.body;
  const targetId = _id || id;
  try {
    const adminToDelete = await Admin.findById(targetId);
    if (adminToDelete && adminToDelete.username === "admin") {
      return res.json({
        success: false,
        message: "មិនអាចលុបគណនី មេធំ (Master Admin) បានទេ!",
      });
    }

    await Admin.findByIdAndDelete(targetId);
    await logAdminAction(
      req.admin.fullName || req.admin.username,
      "Delete Admin",
      String(targetId),
      `Terminated Admin Account: ${getDisplayName(adminToDelete)}`,
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

/**
 * 🔹 ៣.៨ ប្តូរលេខសម្ងាត់បុគ្គលិក Admin តាម `_id`
 */
const adminResetPassword = async (req, res) => {
  const { adminId, newPassword } = req.body;
  try {
    if (!adminId || !newPassword) {
      return res.json({ success: false, message: "ទិន្នន័យមិនគ្រប់គ្រាន់ទេ!" });
    }

    const targetAdmin = await Admin.findById(adminId);
    if (!targetAdmin) {
      return res.json({
        success: false,
        message: "រកមិនឃើញគណនីបុគ្គលិកនេះទេ!",
      });
    }

    if (targetAdmin.username === "admin" && req.admin.username !== "admin") {
      return res.json({
        success: false,
        message: "អ្នកគ្មានសិទ្ធិ Reset Password របស់ Master Admin ទេ!",
      });
    }

    targetAdmin.password = await bcrypt.hash(newPassword, 10);
    await targetAdmin.save();

    await logAdminAction(
      req.admin.fullName || req.admin.username,
      "Reset Admin Password",
      String(targetAdmin._id),
      `Password reset for "${getDisplayName(targetAdmin)}" by Super Admin`,
    );
    res.json({
      success: true,
      message: `ពាក្យសម្ងាត់របស់បុគ្គលិក "${getDisplayName(targetAdmin)}" ត្រូវបានប្តូរថ្មីដោយជោគជ័យ!`,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * 🔹 ៣.៩ បិទ ឬ បើកដំណើរការគណនីបុគ្គលិក Admin តាម `_id`
 */
const toggleAdminStatus = async (req, res) => {
  const { adminId } = req.body;
  try {
    const targetAdmin = await Admin.findById(adminId);
    if (!targetAdmin) {
      return res.json({
        success: false,
        message: "រកមិនឃើញគណនីបុគ្គលិកនេះទេ!",
      });
    }

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
      message: `គណនីរបស់បុគ្គលិក "${getDisplayName(targetAdmin)}" ត្រូវបាន${targetAdmin.isActive ? "បើកដំណើរការ" : "បិទ"}ដោយជោគជ័យ!`,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// ============================================================================
// ⚙️ ជំពូកទី ៤៖ ការកំណត់ប្រព័ន្ធ, កាលវិភាគថែទាំ និងអត្រាប្តូរប្រាក់ (SYSTEM & FX)
// ============================================================================

let isMaintenanceSchedulerRunning = false;
let exactStartTimer = null;
let exactEndTimer = null;

const formatKhmerDateTime = (d = new Date()) =>
  d.toLocaleString("en-US", { timeZone: "Asia/Phnom_Penh", hour12: true });

const formatDurationText = (diffMs) => {
  const diffSec = Math.max(1, Math.floor(diffMs / 1000));
  const hrs = Math.floor(diffSec / 3600);
  const mins = Math.floor((diffSec % 3600) / 60);
  const secs = diffSec % 60;
  return (
    (hrs > 0 ? `${hrs}ម៉ោង ` : "") +
    (mins > 0 ? `${mins}នាទី ` : "") +
    `${secs}វិនាទី`
  );
};

/**
 * 🔹 ៤.១ បញ្ជូនសារជូនដំណឹងអំពីការថែទាំប្រព័ន្ធទៅកាន់អតិថិជនទាំងអស់តាម `_id` (ប្រើឈ្មោះពេញ & Icon `system_alert` / `system_online`)
 */
async function broadcastSystemMaintenanceAlert(
  title,
  msgBody,
  senderFullName,
  incidentId,
  notifType = "system_alert",
) {
  try {
    const users = await User.find({ role: { $ne: "admin" } })
      .select("_id username fullName")
      .lean();
    if (users.length === 0) return 0;

    const nowStr = formatKhmerDateTime();
    const bcId = "BC-SYS-" + Date.now();
    const notifs = users.map((u) => ({
      userId: u._id,
      username: u.username,
      title,
      message: `ជូនចំពោះ ${getDisplayName(u)}៖ ${msgBody}`,
      type: notifType, // 🔔 បែងចែក Icon ច្បាស់លាស់ (system_alert, system_online, system_schedule)
      date: nowStr,
      isRead: false,
      metadata: {
        sender: senderFullName || "ប្រព័ន្ធគ្រប់គ្រងធនាគារ U-Pay",
        broadcastId: bcId,
        incidentId: incidentId || "SYS",
      },
    }));
    await Notification.insertMany(notifs);
    return users.length;
  } catch (e) {
    console.error("Broadcast System Alert Error:", e);
    return 0;
  }
}

/**
 * 🔹 ៤.២ រ៉ូបូតឆែកម៉ោងបិទ និងបើកប្រព័ន្ធស្វ័យប្រវត្តិ (Auto-Freeze & Auto-Resume Scheduler)
 */
async function runSystemMaintenanceScheduler() {
  if (isMaintenanceSchedulerRunning) return;
  if (mongoose.connection.readyState !== 1) return;
  isMaintenanceSchedulerRunning = true;

  try {
    let sys = await System.findOne({ settingId: "GLOBAL_SETTINGS" });
    if (!sys || !sys.maintenanceMeta) return;

    const meta = { ...sys.maintenanceMeta };
    const historyList = Array.isArray(sys.maintenanceHistory)
      ? [...sys.maintenanceHistory]
      : [];
    const nowMs = Date.now();
    const nowStr = formatKhmerDateTime();

    // ១. បើដល់ម៉ោងដែលបានកំណត់ទុក (SCHEDULED) -> បិទប្រព័ន្ធដោយស្វ័យប្រវត្តិ
    if (
      meta.scheduleStatus === "SCHEDULED" &&
      !meta.isSystemFrozen &&
      meta.startAtMs &&
      nowMs >= Number(meta.startAtMs)
    ) {
      await writeSystemStatus({ isSystemFrozen: true });

      meta.isSystemFrozen = true;
      meta.scheduleStatus = "FROZEN";
      meta.frozenAtMs = nowMs;
      meta.frozenAtStr = nowStr;

      const idx = historyList.findIndex(
        (h) => h.incidentId === meta.incidentId,
      );
      if (idx !== -1) {
        historyList[idx].status = "FROZEN";
        historyList[idx].startTimeStr = nowStr;
        historyList[idx].actualEndTimeStr =
          "កំពុងផ្អាកដំណើរការ (Auto-Frozen)...";
        historyList[idx].durationText = "កំពុងផ្អាក (Active Freeze)";
        historyList[idx].startedAtMs = nowMs;
      }

      sys.set("maintenanceMeta", meta, { strict: false });
      sys.set("maintenanceHistory", historyList, { strict: false });
      sys.markModified("maintenanceMeta");
      sys.markModified("maintenanceHistory");
      await sys.save();
      scheduleExactMaintenanceTimers();

      if (meta.notifyUsers !== false) {
        await broadcastSystemMaintenanceAlert(
          "🛑 ប្រព័ន្ធចាប់ផ្តើមផ្អាកថែទាំតាមកាលកំណត់ (System Maintenance)",
          `ប្រព័ន្ធធនាគារ U-Pay បានចាប់ផ្តើមផ្អាកប្រតិបត្តិការបណ្តោះអាសន្នតាមកាលកំណត់ (${meta.freezeType})។ មូលហេតុ៖ ${meta.reason} | រំពឹងបើកដំណើរការវិញ៖ ${meta.expectedEndTime}។`,
          meta.frozenBy || "ប្រព័ន្ធស្វ័យប្រវត្តិ U-Pay",
          meta.incidentId,
          "system_alert",
        );
      }

      if (global.io) {
        global.io.emit("system_maintenance_status", {
          isSystemFrozen: true,
          meta,
        });
      }

      await logAdminAction(
        "System Auto-Scheduler",
        "Auto-Freeze System",
        "System Control",
        `[${meta.incidentId}] Auto-frozen on schedule at ${nowStr}`,
      );
    }

    // ២. បើដល់ម៉ោងបើកដំណើរការវិញ (expectedEndAtMs) -> បើកប្រព័ន្ធវិញដោយស្វ័យប្រវត្តិ
    const updatedMeta = sys.maintenanceMeta || {};
    if (
      updatedMeta.isSystemFrozen &&
      updatedMeta.expectedEndAtMs &&
      nowMs >= Number(updatedMeta.expectedEndAtMs)
    ) {
      await writeSystemStatus({ isSystemFrozen: false });

      const startedMs =
        updatedMeta.frozenAtMs || updatedMeta.startAtMs || nowMs;
      const durationStr = formatDurationText(nowMs - startedMs);
      const autoNote =
        "បើកដំណើរការវិញដោយស្វ័យប្រវត្តិតាមម៉ោងកំណត់ (Auto-Resumed on Schedule)";

      const idx = historyList.findIndex(
        (h) => h.incidentId === updatedMeta.incidentId || h.status === "FROZEN",
      );
      if (idx !== -1) {
        historyList[idx].actualEndTimeStr = nowStr;
        historyList[idx].durationText = durationStr;
        historyList[idx].resumedBy = "ប្រព័ន្ធស្វ័យប្រវត្តិ 🤖";
        historyList[idx].resolutionNote = autoNote;
        historyList[idx].status = "COMPLETED";
        historyList[idx].endedAtMs = nowMs;
      }

      const nextMeta = {
        isSystemFrozen: false,
        scheduleStatus: "ONLINE",
        lastResumedAt: nowStr,
        lastResumedBy: "ប្រព័ន្ធស្វ័យប្រវត្តិ 🤖",
        lastDuration: durationStr,
      };

      sys.set("maintenanceMeta", nextMeta, { strict: false });
      sys.set("maintenanceHistory", historyList, { strict: false });
      sys.markModified("maintenanceMeta");
      sys.markModified("maintenanceHistory");
      await sys.save();
      scheduleExactMaintenanceTimers();

      if (updatedMeta.notifyUsers !== false) {
        await broadcastSystemMaintenanceAlert(
          "🟢 ប្រព័ន្ធដំណើរការធម្មតាវិញហើយ (System Online)",
          `ការថែទាំប្រព័ន្ធធនាគារ U-Pay បានបញ្ចប់តាមកាលកំណត់នៅម៉ោង ${nowStr} (រយៈពេលសរុប៖ ${durationStr})។ លោកអ្នកអាចធ្វើប្រតិបត្តិការហិរញ្ញវត្ថុបានធម្មតាវិញហើយ។ សូមអរគុណ!`,
          "ប្រព័ន្ធស្វ័យប្រវត្តិ U-Pay",
          updatedMeta.incidentId,
          "system_online",
        );
      }

      if (global.io) {
        global.io.emit("system_maintenance_status", {
          isSystemFrozen: false,
          meta: nextMeta,
        });
      }

      await logAdminAction(
        "System Auto-Scheduler",
        "Auto-Resume System",
        "System Control",
        `[${updatedMeta.incidentId || "SYS"}] Auto-resumed on schedule. Duration: ${durationStr}`,
      );
    }
  } catch (err) {
    console.error("System Scheduler Error:", err);
  } finally {
    isMaintenanceSchedulerRunning = false;
  }
}

setInterval(runSystemMaintenanceScheduler, 5000);

async function scheduleExactMaintenanceTimers() {
  try {
    if (exactStartTimer) clearTimeout(exactStartTimer);
    if (exactEndTimer) clearTimeout(exactEndTimer);

    if (mongoose.connection.readyState !== 1) return;
    const sys = await System.findOne({ settingId: "GLOBAL_SETTINGS" }).lean();
    if (!sys || !sys.maintenanceMeta) return;

    const meta = sys.maintenanceMeta;
    const nowMs = Date.now();

    if (
      meta.scheduleStatus === "SCHEDULED" &&
      !meta.isSystemFrozen &&
      meta.startAtMs
    ) {
      const delayStart = Math.max(0, Number(meta.startAtMs) - nowMs);
      if (delayStart < 2147483647) {
        exactStartTimer = setTimeout(async () => {
          await runSystemMaintenanceScheduler();
          await scheduleExactMaintenanceTimers();
        }, delayStart + 50);
      }
    }

    if (meta.expectedEndAtMs) {
      const delayEnd = Math.max(0, Number(meta.expectedEndAtMs) - nowMs);
      if (delayEnd < 2147483647) {
        exactEndTimer = setTimeout(async () => {
          await runSystemMaintenanceScheduler();
        }, delayEnd + 50);
      }
    }
  } catch (e) {
    console.error("Exact Timer Error:", e);
  }
}

setTimeout(() => {
  runSystemMaintenanceScheduler();
  scheduleExactMaintenanceTimers();
}, 3000);

/**
 * 🔹 ៤.៣ ទាញយកស្ថានភាពប្រព័ន្ធ និងប្រវត្តិថែទាំ
 */
const getSystemStatus = async (req, res) => {
  try {
    await runSystemMaintenanceScheduler();
    const fileStatus = readSystemStatus() || { isSystemFrozen: false };
    let sys = await System.findOne({ settingId: "GLOBAL_SETTINGS" }).lean();

    const maintenanceMeta = sys?.maintenanceMeta || {
      isSystemFrozen: Boolean(fileStatus.isSystemFrozen),
      scheduleStatus: fileStatus.isSystemFrozen ? "FROZEN" : "ONLINE",
    };

    const maintenanceHistory = Array.isArray(sys?.maintenanceHistory)
      ? sys.maintenanceHistory
      : [];

    res.json({
      success: true,
      isSystemFrozen: Boolean(fileStatus.isSystemFrozen),
      maintenanceMeta: {
        ...maintenanceMeta,
        isSystemFrozen: Boolean(fileStatus.isSystemFrozen),
      },
      maintenanceHistory,
    });
  } catch (err) {
    const fallback = readSystemStatus() || { isSystemFrozen: false };
    res.json({
      success: true,
      isSystemFrozen: Boolean(fallback.isSystemFrozen),
      maintenanceMeta: {},
      maintenanceHistory: [],
    });
  }
};

/**
 * 🔹 ៤.៤ បញ្ជាបិទ/បើកប្រព័ន្ធ ឬកំណត់ម៉ោងថែទាំទុកជាមុន
 */
const toggleSystem = async (req, res) => {
  try {
    const currentStatus = readSystemStatus() || { isSystemFrozen: false };
    const {
      actionMode,
      targetFreezeState,
      freezeType = "Scheduled Maintenance",
      reason = "",
      startTime = "",
      expectedEndTime = "",
      startAtMs = null,
      expectedEndAtMs = null,
      resolutionNote = "",
      notifyUsers = true,
    } = req.body || {};

    let sys = await System.findOne({ settingId: "GLOBAL_SETTINGS" });
    if (!sys) sys = new System({ settingId: "GLOBAL_SETTINGS" });

    const nowMs = Date.now();
    const khmerNowStr = formatKhmerDateTime();
    const historyList = Array.isArray(sys.maintenanceHistory)
      ? [...sys.maintenanceHistory]
      : [];
    const adminDisplayName = await getAdminFullDisplayName(req.admin);
    let broadcastCount = 0;

    if (actionMode === "CANCEL_SCHEDULE") {
      const prevMeta = sys.maintenanceMeta || {};
      const idx = historyList.findIndex(
        (h) => h.incidentId === prevMeta.incidentId && h.status === "SCHEDULED",
      );
      if (idx !== -1) {
        historyList[idx].status = "CANCELLED";
        historyList[idx].actualEndTimeStr = khmerNowStr;
        historyList[idx].durationText = "បានបោះបង់មុនដល់ម៉ោង (Cancelled)";
        historyList[idx].resumedBy = adminDisplayName;
        historyList[idx].resolutionNote =
          resolutionNote || "បោះបង់ការកំណត់ម៉ោងដោយអ្នកគ្រប់គ្រង";
      }

      await writeSystemStatus({ isSystemFrozen: false });
      const nextMeta = {
        isSystemFrozen: false,
        scheduleStatus: "ONLINE",
        lastResumedAt: khmerNowStr,
        lastResumedBy: adminDisplayName,
      };

      sys.set("maintenanceMeta", nextMeta, { strict: false });
      sys.set("maintenanceHistory", historyList, { strict: false });
      sys.markModified("maintenanceMeta");
      sys.markModified("maintenanceHistory");
      await sys.save();
      scheduleExactMaintenanceTimers();

      await logAdminAction(
        adminDisplayName,
        "Cancel Scheduled Maintenance",
        "System Control",
        `Cancelled scheduled maintenance [${prevMeta.incidentId || "SYS"}]`,
      );

      return res.json({
        success: true,
        isSystemFrozen: false,
        scheduleCancelled: true,
        maintenanceMeta: nextMeta,
        maintenanceHistory: historyList,
      });
    }

    const wantFreezeOrSchedule =
      actionMode === "FREEZE_OR_SCHEDULE" ||
      actionMode === "FORCE_FREEZE_NOW" ||
      (targetFreezeState !== undefined
        ? Boolean(targetFreezeState)
        : !currentStatus.isSystemFrozen);

    if (wantFreezeOrSchedule) {
      const incidentId =
        "INC-" + Math.floor(100000 + Math.random() * 900000).toString();
      const cleanReason =
        reason.trim() ||
        "ធ្វើបច្ចុប្បន្នភាព និងថែទាំប្រព័ន្ធសុវត្ថិភាពធនាគារ (System Maintenance)";

      const parsedStartMs =
        actionMode === "FORCE_FREEZE_NOW"
          ? nowMs
          : startAtMs && !isNaN(Number(startAtMs))
            ? Number(startAtMs)
            : nowMs;
      const parsedEndMs =
        expectedEndAtMs && !isNaN(Number(expectedEndAtMs))
          ? Number(expectedEndAtMs)
          : null;

      if (parsedStartMs > nowMs + 30000) {
        await writeSystemStatus({ isSystemFrozen: false });

        const metaObj = {
          incidentId,
          isSystemFrozen: false,
          scheduleStatus: "SCHEDULED",
          freezeType,
          reason: cleanReason,
          startTime: startTime || formatKhmerDateTime(new Date(parsedStartMs)),
          expectedEndTime:
            expectedEndTime ||
            (parsedEndMs
              ? formatKhmerDateTime(new Date(parsedEndMs))
              : "រហូតដល់មានការជូនដំណឹងបន្ថែម"),
          startAtMs: parsedStartMs,
          expectedEndAtMs: parsedEndMs,
          frozenBy: adminDisplayName,
          notifyUsers: Boolean(notifyUsers),
          scheduledAtStr: khmerNowStr,
        };

        sys.set("maintenanceMeta", metaObj, { strict: false });

        historyList.unshift({
          incidentId,
          freezeType,
          reason: cleanReason,
          startTimeStr: metaObj.startTime,
          expectedEndTimeStr: metaObj.expectedEndTime,
          actualEndTimeStr: "រង់ចាំដល់ម៉ោងចាប់ផ្តើម...",
          durationText: "បានកំណត់ម៉ោងទុក (Scheduled ⏳)",
          frozenBy: adminDisplayName,
          resumedBy: "-",
          resolutionNote: "ប្រព័ន្ធនឹងបិទ-បើកដោយស្វ័យប្រវត្តិពេលដល់ម៉ោង",
          notifyUsers: Boolean(notifyUsers),
          status: "SCHEDULED",
          startedAtMs: parsedStartMs,
        });

        sys.set("maintenanceHistory", historyList.slice(0, 100), {
          strict: false,
        });
        sys.markModified("maintenanceMeta");
        sys.markModified("maintenanceHistory");
        await sys.save();
        scheduleExactMaintenanceTimers();

        if (notifyUsers) {
          broadcastCount = await broadcastSystemMaintenanceAlert(
            "⏰ សេចក្តីជូនដំណឹងជាមុន៖ គម្រោងថែទាំប្រព័ន្ធ (Scheduled Maintenance)",
            `ធនាគារ U-Pay នឹងធ្វើការផ្អាកប្រព័ន្ធបណ្តោះអាសន្ន (${freezeType}) ចាប់ពីម៉ោង ${metaObj.startTime} រហូតដល់ម៉ោង ${metaObj.expectedEndTime}។ មូលហេតុ៖ ${cleanReason}។ សូមអភ័យទោសទុកជាមុន!`,
            adminDisplayName,
            incidentId,
            "system_schedule",
          );
        }

        await logAdminAction(
          adminDisplayName,
          "Schedule System Maintenance",
          "System Control",
          `[${incidentId}] Scheduled from ${metaObj.startTime} to ${metaObj.expectedEndTime}`,
        );

        return res.json({
          success: true,
          isSystemFrozen: false,
          isScheduled: true,
          broadcastCount,
          maintenanceMeta: metaObj,
          maintenanceHistory: sys.maintenanceHistory,
        });
      }

      await writeSystemStatus({ isSystemFrozen: true });

      const metaObj = {
        incidentId,
        isSystemFrozen: true,
        scheduleStatus: "FROZEN",
        freezeType,
        reason: cleanReason,
        startTime: startTime || khmerNowStr,
        expectedEndTime:
          expectedEndTime ||
          (parsedEndMs
            ? formatKhmerDateTime(new Date(parsedEndMs))
            : "រហូតដល់មានការជូនដំណឹងបន្ថែម"),
        startAtMs: nowMs,
        expectedEndAtMs: parsedEndMs,
        frozenBy: adminDisplayName,
        frozenAtMs: nowMs,
        frozenAtStr: khmerNowStr,
        notifyUsers: Boolean(notifyUsers),
      };

      sys.set("maintenanceMeta", metaObj, { strict: false });

      historyList.unshift({
        incidentId,
        freezeType,
        reason: cleanReason,
        startTimeStr: metaObj.startTime,
        expectedEndTimeStr: metaObj.expectedEndTime,
        actualEndTimeStr: parsedEndMs
          ? "នឹងបើកវិញអូតូតាមម៉ោងកំណត់..."
          : "កំពុងផ្អាកដំណើរការ...",
        durationText: "កំពុងផ្អាក (Active Freeze)",
        frozenBy: adminDisplayName,
        resumedBy: "-",
        resolutionNote: "-",
        notifyUsers: Boolean(notifyUsers),
        status: "FROZEN",
        startedAtMs: nowMs,
      });

      sys.set("maintenanceHistory", historyList.slice(0, 100), {
        strict: false,
      });
      sys.markModified("maintenanceMeta");
      sys.markModified("maintenanceHistory");
      await sys.save();
      scheduleExactMaintenanceTimers();

      if (notifyUsers) {
        broadcastCount = await broadcastSystemMaintenanceAlert(
          "🛑 សេចក្តីជូនដំណឹង៖ ផ្អាកប្រព័ន្ធបណ្តោះអាសន្ន (System Maintenance)",
          `ប្រព័ន្ធធនាគារ U-Pay ត្រូវបានផ្អាកប្រតិបត្តិការបណ្តោះអាសន្ន (${freezeType})។ មូលហេតុ៖ ${cleanReason} | ចាប់ផ្តើម៖ ${metaObj.startTime} | រំពឹងបើកវិញ៖ ${metaObj.expectedEndTime}។`,
          adminDisplayName,
          incidentId,
          "system_alert",
        );
      }

      if (global.io) {
        global.io.emit("system_maintenance_status", {
          isSystemFrozen: true,
          meta: metaObj,
        });
      }

      await logAdminAction(
        adminDisplayName,
        "Freeze System Platform",
        "System Control",
        `[${incidentId}] Type: ${freezeType} | Auto-Resume At: ${metaObj.expectedEndTime}`,
      );

      return res.json({
        success: true,
        isSystemFrozen: true,
        broadcastCount,
        maintenanceMeta: metaObj,
        maintenanceHistory: sys.maintenanceHistory,
      });
    } else {
      await writeSystemStatus({ isSystemFrozen: false });

      const prevMeta = sys.maintenanceMeta || {};
      const startedMs = prevMeta.frozenAtMs || prevMeta.startAtMs || nowMs;
      const durationStr = formatDurationText(nowMs - startedMs);
      const cleanNote =
        resolutionNote.trim() ||
        "ការថែទាំប្រព័ន្ធត្រូវបានបញ្ចប់ និងបើកដំណើរការវិញដោយជោគជ័យ ១០០%";

      const idx = historyList.findIndex(
        (h) => h.status === "FROZEN" || h.incidentId === prevMeta.incidentId,
      );
      if (idx !== -1) {
        historyList[idx].actualEndTimeStr = khmerNowStr;
        historyList[idx].durationText = durationStr;
        historyList[idx].resumedBy = adminDisplayName;
        historyList[idx].resolutionNote = cleanNote;
        historyList[idx].status = "COMPLETED";
        historyList[idx].endedAtMs = nowMs;
      }

      const nextMeta = {
        isSystemFrozen: false,
        scheduleStatus: "ONLINE",
        lastResumedAt: khmerNowStr,
        lastResumedBy: adminDisplayName,
        lastDuration: durationStr,
      };

      sys.set("maintenanceMeta", nextMeta, { strict: false });
      sys.set("maintenanceHistory", historyList.slice(0, 100), {
        strict: false,
      });
      sys.markModified("maintenanceMeta");
      sys.markModified("maintenanceHistory");
      await sys.save();
      scheduleExactMaintenanceTimers();

      if (notifyUsers) {
        broadcastCount = await broadcastSystemMaintenanceAlert(
          "🟢 ប្រព័ន្ធដំណើរការធម្មតាវិញហើយ (System Online)",
          `ប្រព័ន្ធធនាគារ U-Pay បានបើកដំណើរការធម្មតាវិញហើយនៅម៉ោង ${khmerNowStr} (រយៈពេលថែទាំសរុប៖ ${durationStr})។ លោកអ្នកអាចធ្វើប្រតិបត្តិការហិរញ្ញវត្ថុបានធម្មតា។ សូមអរគុណ!`,
          adminDisplayName,
          prevMeta.incidentId,
          "system_online",
        );
      }

      if (global.io) {
        global.io.emit("system_maintenance_status", {
          isSystemFrozen: false,
          meta: nextMeta,
        });
      }

      await logAdminAction(
        adminDisplayName,
        "Resume System Platform",
        "System Control",
        `System Online | Total Duration: ${durationStr} | Note: ${cleanNote}`,
      );

      return res.json({
        success: true,
        isSystemFrozen: false,
        broadcastCount,
        maintenanceMeta: nextMeta,
        maintenanceHistory: sys.maintenanceHistory,
      });
    }
  } catch (err) {
    console.error("Toggle System Error:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * 🔹 ៤.៥ មុខងារគ្រប់គ្រងអត្រាប្តូរប្រាក់ផ្លូវការ (NBC FX Sync & Manual Override)
 */
async function fetchOfficialNbcRatesHelper() {
  const res = await fetch("https://open.er-api.com/v6/latest/USD");
  const data = await res.json();
  if (!data || !data.rates || !data.rates.KHR) {
    throw new Error("មិនអាចទាញទិន្នន័យអត្រាប្តូរប្រាក់ពីប្រភពផ្លូវការបានទេ");
  }

  const r = data.rates;
  const officialMidKhr = Math.round(Number(r.KHR || 4065) / 5) * 5;
  const usdBuy = officialMidKhr - 15;
  const usdSell = officialMidKhr + 25;

  const thbMid = officialMidKhr / Number(r.THB || 34.2);
  const cnyMid = officialMidKhr / Number(r.CNY || 7.18);
  const eurMid = officialMidKhr / Number(r.EUR || 0.92);
  const sgdMid = officialMidKhr / Number(r.SGD || 1.34);
  const vndMid = (officialMidKhr / Number(r.VND || 25200)) * 1000;
  const audMid = officialMidKhr / Number(r.AUD || 1.51);
  const jpyMid = (officialMidKhr / Number(r.JPY || 152)) * 100;

  const multiCurrencies = [
    {
      code: "USD/KHR",
      c1: "us",
      c2: "kh",
      name: "ដុល្លារអាមេរិក ⇄ រៀលខ្មែរ",
      unit: "1 USD",
      buy: usdBuy,
      sell: usdSell,
      quote: "៛",
      change: "+0.10%",
      trend: "up",
      isCore: true,
    },
    {
      code: "THB/KHR",
      c1: "th",
      c2: "kh",
      name: "បាតថៃ ⇄ រៀលខ្មែរ",
      unit: "1 THB",
      buy: Number((thbMid * 0.99).toFixed(2)),
      sell: Number((thbMid * 1.01).toFixed(2)),
      quote: "៛",
      change: "+0.22%",
      trend: "up",
    },
    {
      code: "CNY/KHR",
      c1: "cn",
      c2: "kh",
      name: "យន់ចិន ⇄ រៀលខ្មែរ",
      unit: "1 CNY",
      buy: Number((cnyMid * 0.99).toFixed(2)),
      sell: Number((cnyMid * 1.01).toFixed(2)),
      quote: "៛",
      change: "+0.14%",
      trend: "up",
    },
    {
      code: "EUR/KHR",
      c1: "eu",
      c2: "kh",
      name: "អឺរ៉ូ ⇄ រៀលខ្មែរ",
      unit: "1 EUR",
      buy: Math.round(eurMid * 0.992),
      sell: Math.round(eurMid * 1.008),
      quote: "៛",
      change: "+0.18%",
      trend: "up",
    },
    {
      code: "SGD/KHR",
      c1: "sg",
      c2: "kh",
      name: "ដុល្លារសិង្ហបុរី ⇄ រៀលខ្មែរ",
      unit: "1 SGD",
      buy: Math.round(sgdMid * 0.992),
      sell: Math.round(sgdMid * 1.008),
      quote: "៛",
      change: "+0.15%",
      trend: "up",
    },
    {
      code: "VND/KHR",
      c1: "vn",
      c2: "kh",
      name: "ដុងវៀតណាម ⇄ រៀលខ្មែរ",
      unit: "1,000 VND",
      buy: Number((vndMid * 0.985).toFixed(2)),
      sell: Number((vndMid * 1.015).toFixed(2)),
      quote: "៛",
      change: "-0.05%",
      trend: "down",
    },
    {
      code: "AUD/KHR",
      c1: "au",
      c2: "kh",
      name: "ដុល្លារអូស្ត្រាលី ⇄ រៀលខ្មែរ",
      unit: "1 AUD",
      buy: Math.round(audMid * 0.99),
      sell: Math.round(audMid * 1.01),
      quote: "៛",
      change: "+0.20%",
      trend: "up",
    },
    {
      code: "JPY/KHR",
      c1: "jp",
      c2: "kh",
      name: "យ៉េនជប៉ុន ⇄ រៀលខ្មែរ",
      unit: "100 JPY",
      buy: Math.round(jpyMid * 0.99),
      sell: Math.round(jpyMid * 1.01),
      quote: "៛",
      change: "-0.12%",
      trend: "down",
    },
  ];

  return {
    usdToKhrBuy: usdBuy,
    usdToKhrSell: usdSell,
    officialNbcMidRate: officialMidKhr,
    multiCurrencies,
    lastNbcSyncAt: new Date().toISOString(),
  };
}

const getFXRates = async (req, res) => {
  try {
    let sys = await System.findOne({ settingId: "GLOBAL_SETTINGS" });
    if (!sys) sys = new System({ settingId: "GLOBAL_SETTINGS" });

    let currentRates = sys.fxRates ||
      readFXRates() || {
        usdToKhrBuy: 4050,
        usdToKhrSell: 4100,
      };

    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const lastSyncTime = currentRates.lastNbcSyncAt
      ? new Date(currentRates.lastNbcSyncAt).getTime()
      : 0;
    const isDueForWeeklySync =
      currentRates.autoWeeklySync !== false &&
      Date.now() - lastSyncTime >= SEVEN_DAYS_MS;

    if (isDueForWeeklySync) {
      try {
        const freshNbc = await fetchOfficialNbcRatesHelper();
        currentRates = {
          ...currentRates,
          ...freshNbc,
          autoWeeklySync: currentRates.autoWeeklySync !== false,
          lastModifiedBy: "NBC Auto-Sync (7-Day Schedule)",
        };
        sys.fxRates = currentRates;
        sys.markModified("fxRates");
        await sys.save();
        scheduleExactMaintenanceTimers();
        await writeFXRates(currentRates);
      } catch (syncErr) {
        console.warn("Weekly NBC Auto-Sync skipped:", syncErr.message);
      }
    }

    res.json({ success: true, rates: currentRates });
  } catch (err) {
    res.json({ success: true, rates: readFXRates() });
  }
};

const updateFX = async (req, res) => {
  const { buy, sell, multiCurrencies, autoWeeklySync } = req.body;
  try {
    let sys = await System.findOne({ settingId: "GLOBAL_SETTINGS" });
    if (!sys) sys = new System({ settingId: "GLOBAL_SETTINGS" });

    const adminName = await getAdminFullDisplayName(req.admin);
    const currentRates = sys.fxRates || readFXRates() || {};
    const updatedPayload = {
      ...currentRates,
      usdToKhrBuy: parseFloat(buy) || 4050,
      usdToKhrSell: parseFloat(sell) || 4100,
      autoWeeklySync:
        autoWeeklySync !== undefined
          ? Boolean(autoWeeklySync)
          : currentRates.autoWeeklySync !== false,
      lastModifiedBy: `${adminName} (Manual)`,
      lastManualUpdateAt: new Date().toISOString(),
    };

    if (Array.isArray(multiCurrencies)) {
      updatedPayload.multiCurrencies = multiCurrencies;
    }

    sys.fxRates = updatedPayload;
    sys.markModified("fxRates");
    await sys.save();
    scheduleExactMaintenanceTimers();
    await writeFXRates(updatedPayload);

    await logAdminAction(
      adminName,
      "Update FX Rates",
      "Exchange System",
      `USD/KHR Buy: ${buy}៛, Sell: ${sell}៛ (Manual Override)`,
    );

    res.json({
      success: true,
      message: "អត្រាប្តូរប្រាក់ត្រូវបានរក្សាទុកដោយជោគជ័យ!",
      rates: updatedPayload,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

const syncNbcFXRates = async (req, res) => {
  try {
    let sys = await System.findOne({ settingId: "GLOBAL_SETTINGS" });
    if (!sys) sys = new System({ settingId: "GLOBAL_SETTINGS" });

    const adminName = await getAdminFullDisplayName(req.admin);
    const freshNbc = await fetchOfficialNbcRatesHelper();
    const updatedPayload = {
      ...(sys.fxRates || {}),
      ...freshNbc,
      autoWeeklySync: true,
      lastModifiedBy: `${adminName} (NBC Live Sync)`,
    };

    sys.fxRates = updatedPayload;
    sys.markModified("fxRates");
    await sys.save();
    scheduleExactMaintenanceTimers();
    await writeFXRates(updatedPayload);

    await logAdminAction(
      adminName,
      "Sync NBC FX Rates",
      "Exchange System",
      `Synced NBC Mid Rate: ${freshNbc.officialNbcMidRate}៛ (Buy: ${freshNbc.usdToKhrBuy}៛, Sell: ${freshNbc.usdToKhrSell}៛)`,
    );

    res.json({
      success: true,
      message: `បានទាញយកអត្រាប្តូរប្រាក់យោងផ្លូវការជោគជ័យ! (អត្រាទិញ: ${freshNbc.usdToKhrBuy}៛ / លក់: ${freshNbc.usdToKhrSell}៛)`,
      rates: updatedPayload,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "មិនអាចតភ្ជាប់ទៅប្រភពអត្រាប្តូរប្រាក់អន្តរជាតិបានទេ!",
    });
  }
};

/**
 * 🔹 ៤.៦ មុខងារកំណត់តម្លៃសេវាផ្ទេរប្រាក់ និងដែនកំណត់ប្រតិបត្តិការ (System Fees & Limits)
 */
const getFeeSettings = async (req, res) => {
  try {
    let sys = await System.findOne({ settingId: "GLOBAL_SETTINGS" });
    if (!sys) {
      sys = new System();
      await sys.save();
      scheduleExactMaintenanceTimers();
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
    scheduleExactMaintenanceTimers();

    await logAdminAction(
      await getAdminFullDisplayName(req.admin),
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

// ============================================================================
// 📊 ជំពូកទី ៥៖ របាយការណ៍ និងស្ថិតិប្រព័ន្ធ (DASHBOARD & PRO ANALYTICS)
// ============================================================================

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
      user: t.senderName || t.username || "Unknown",
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

/**
 * 🔹 ៥.៣ ទាញយកទិន្នន័យវិភាគគ្រប់ជ្រុងជ្រោយសម្រាប់ Admin Pro Dashboard (ភ្ជាប់ `_id` គ្រប់កាតទាំងអស់)
 */
const getDashboardAnalyticsPro = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const sysFx = readFXRates() || { usdToKhrBuy: 4050, usdToKhrSell: 4100 };
    const khrRate = parseFloat(sysFx.usdToKhrSell) || 4100;
    const sysStatus = readSystemStatus() || { isSystemFrozen: false };

    let startMs = 0;
    let endMs = Date.now() + 86400000;
    if (startDate) {
      const s = new Date(startDate + "T00:00:00");
      if (!isNaN(s.getTime())) startMs = s.getTime();
    }
    if (endDate) {
      const e = new Date(endDate + "T23:59:59.999");
      if (!isNaN(e.getTime())) endMs = e.getTime();
    }

    const parseItemTime = (item) => {
      if (item.createdAt) {
        const t = new Date(item.createdAt).getTime();
        if (!isNaN(t)) return t;
      }
      if (item.date || item.joinDate) {
        const t = new Date(item.date || item.joinDate).getTime();
        if (!isNaN(t)) return t;
      }
      if (item._id && typeof item._id.getTimestamp === "function") {
        return item._id.getTimestamp().getTime();
      }
      return Date.now();
    };

    const [
      allUsers,
      allCards,
      allMerchants,
      allCashierTickets,
      allPromos,
      allAdmins,
      recentTrxsRaw,
      broadcastAgg,
    ] = await Promise.all([
      User.find().select("-password -pin").lean(),
      Card.find().lean(),
      Merchant.find().lean(),
      CashierTicket.find().sort({ createdAt: -1 }).limit(300).lean(),
      PromoCode.find().lean(),
      Admin.find({}, "-password").lean(),
      Transaction.find().sort({ _id: -1 }).limit(2500).lean(),
      Notification.distinct("metadata.broadcastId", {
        "metadata.broadcastId": { $exists: true },
      }),
    ]);

    const clients = allUsers.filter(
      (u) => u.role !== "admin" && u.username !== "superadmin",
    );
    const centralBankUser = allUsers.find(
      (u) =>
        u.mainAccounts?.USD?.accountNumber === "888888888" ||
        u.username === "superadmin",
    );

    let activeOnlineUsers = 0;
    let newUsersInPeriod = 0;
    let frozenUsersCount = 0;
    let verifiedKycCount = 0;
    let pendingKycCount = 0;
    let openSupportTickets = 0;

    let totalClientUSD = 0;
    let totalClientKHR = 0;
    let totalFixedDepositUSD = 0;

    const topUsersList = [];

    clients.forEach((u) => {
      if (u.isOnline) activeOnlineUsers++;
      if (u.isFrozen) frozenUsersCount++;

      const kycSt = String(u.kycStatus || "").toLowerCase();
      if (kycSt === "verified" || kycSt === "approved") verifiedKycCount++;
      else if (kycSt === "pending") pendingKycCount++;

      const joinT = parseItemTime(u);
      if (joinT >= startMs && joinT <= endMs) newUsersInPeriod++;

      let uUsd = Number(u.mainAccounts?.USD?.balance || 0);
      let uKhr = Number(u.mainAccounts?.KHR?.balance || 0);

      if (Array.isArray(u.subAccounts)) {
        u.subAccounts.forEach((sub) => {
          if (sub.accountType !== "junior") {
            if (sub.currency === "KHR") uKhr += Number(sub.balance || 0);
            else uUsd += Number(sub.balance || 0);
          }
        });
      }

      if (Array.isArray(u.deposits)) {
        u.deposits.forEach((dep) => {
          totalFixedDepositUSD += Number(dep.amount || 0);
        });
      }

      if (Array.isArray(u.tickets)) {
        u.tickets.forEach((tk) => {
          if (tk.status === "Open" || tk.status === "Pending") {
            openSupportTickets++;
          }
        });
      }

      totalClientUSD += uUsd;
      totalClientKHR += uKhr;

      const combinedUsdEq = uUsd + uKhr / khrRate;
      topUsersList.push({
        _id: String(u._id),
        username: u.username,
        fullName: getDisplayName(u),
        profileImage: u.profileImage || "",
        usdBalance: uUsd,
        khrBalance: uKhr,
        totalUsdEq: combinedUsdEq,
        kycStatus: u.kycStatus || "unverified",
      });
    });

    topUsersList.sort((a, b) => b.totalUsdEq - a.totalUsdEq);

    let totalMerchantEscrowUSD = 0;
    let totalMerchantCollectedUSD = 0;
    const topMerchantsList = [];

    allMerchants.forEach((m) => {
      const holdUsd =
        Number(m.escrowHold?.USD || 0) +
        Number(m.escrowHold?.KHR || 0) / khrRate;
      const colUsd =
        Number(m.collected?.USD || 0) + Number(m.collected?.KHR || 0) / khrRate;
      totalMerchantEscrowUSD += holdUsd;
      totalMerchantCollectedUSD += colUsd;

      topMerchantsList.push({
        _id: String(m._id),
        ownerId: m.ownerId ? String(m.ownerId) : "",
        name: m.name,
        merchantId: m.merchantId,
        owner: m.username || m.userId,
        category: m.category || "General",
        collectedUSD: colUsd,
        escrowUSD: holdUsd,
        status: m.status || "Active",
      });
    });
    topMerchantsList.sort((a, b) => b.collectedUSD - a.collectedUSD);

    const pendingCashierTickets = allCashierTickets.filter(
      (t) => t.status === "pending_approve" || t.status === "pending_verify",
    ).length;

    const toUsd = (amt, cur) =>
      cur === "KHR"
        ? Math.abs(Number(amt || 0)) / khrRate
        : Math.abs(Number(amt || 0));

    let periodTrxCount = 0;
    let periodVolumeUSD = 0;
    let periodRevenueUSD = 0;
    let periodDepositsUSD = 0;
    let periodWithdrawalsUSD = 0;
    let periodTransfersCount = 0;
    let periodMerchantPayCount = 0;
    let periodCardPayCount = 0;
    let periodBillPayCount = 0;
    let periodCashierCount = 0;
    let pendingTrxCount = 0;

    const dailyMap = {};
    const seenRefForVolume = new Set();

    recentTrxsRaw.forEach((t) => {
      if (t.status === "Pending" || t.status === "Hold") pendingTrxCount++;

      const tTime = parseItemTime(t);
      if (tTime < startMs || tTime > endMs) return;
      if (t.username === "superadmin" && t.type !== "System Income") return;

      const dObj = new Date(tTime);
      const dayKey = dObj.toISOString().split("T")[0];
      if (!dailyMap[dayKey]) {
        dailyMap[dayKey] = {
          date: dayKey,
          inflowUSD: 0,
          outflowUSD: 0,
          revenueUSD: 0,
          count: 0,
        };
      }

      const amtUsd = toUsd(t.amount, t.currency);
      const feeUsd = toUsd(t.fee || 0, t.currency);
      const tType = String(t.type || "").toLowerCase();
      const tMethod = String(t.trxMethod || "").toLowerCase();

      if (feeUsd > 0) {
        periodRevenueUSD += feeUsd;
        dailyMap[dayKey].revenueUSD += feeUsd;
      }
      if (
        t.receiverAcc === "888000999" ||
        tType.includes("issuance fee") ||
        tType.includes("transfer fee")
      ) {
        periodRevenueUSD += amtUsd;
        dailyMap[dayKey].revenueUSD += amtUsd;
      }

      const refKey = t.refId || String(t._id);
      if (!seenRefForVolume.has(refKey)) {
        seenRefForVolume.add(refKey);
        periodTrxCount++;
        periodVolumeUSD += amtUsd;
        dailyMap[dayKey].count++;

        if (tType.includes("deposit")) {
          periodDepositsUSD += amtUsd;
          periodCashierCount++;
          dailyMap[dayKey].inflowUSD += amtUsd;
        } else if (tType.includes("withdrawal")) {
          periodWithdrawalsUSD += amtUsd;
          periodCashierCount++;
          dailyMap[dayKey].outflowUSD += amtUsd;
        } else if (
          t.cardNumber ||
          tType.includes("card") ||
          tMethod.includes("nfc")
        ) {
          periodCardPayCount++;
          dailyMap[dayKey].outflowUSD += amtUsd;
        } else if (
          t.merchantId ||
          tType.includes("merchant") ||
          tMethod.includes("qr")
        ) {
          periodMerchantPayCount++;
          dailyMap[dayKey].outflowUSD += amtUsd;
        } else if (tType.includes("bill") || t.receiverAcc === "777888999") {
          periodBillPayCount++;
          dailyMap[dayKey].outflowUSD += amtUsd;
        } else {
          periodTransfersCount++;
          if (Number(t.amount) > 0) dailyMap[dayKey].inflowUSD += amtUsd;
          else dailyMap[dayKey].outflowUSD += amtUsd;
        }
      }
    });

    const sortedTimeline = Object.values(dailyMap).sort((a, b) =>
      a.date.localeCompare(b.date),
    );

    const liveStream = recentTrxsRaw
      .filter((t) => t.username !== "superadmin")
      .slice(0, 25)
      .map((t) => ({
        _id: t._id,
        userId: t.userId ? String(t.userId) : "",
        refId: t.refId || "N/A",
        hash: t.hash || "",
        username: t.username || "System",
        senderName: t.senderName || t.username || "System",
        receiverName: t.receiverName || "System",
        senderAcc: t.senderAcc || "",
        receiverAcc: t.receiverAcc || "",
        amount: Number(t.amount || 0),
        currency: t.currency || "USD",
        type: t.type || "Transaction",
        trxMethod: t.trxMethod || "U-Pay",
        status: t.status || "Success",
        date: t.date || new Date(t.createdAt || Date.now()).toLocaleString(),
      }));

    res.json({
      success: true,
      system: {
        isFrozen: Boolean(sysStatus.isSystemFrozen),
        fxBuy: sysFx.usdToKhrBuy || 4050,
        fxSell: sysFx.usdToKhrSell || 4100,
        centralBankUSD: Number(
          centralBankUser?.mainAccounts?.USD?.balance || 0,
        ),
        centralBankKHR: Number(
          centralBankUser?.mainAccounts?.KHR?.balance || 0,
        ),
      },
      kpis: {
        totalUsers: clients.length,
        activeOnlineUsers,
        newUsersInPeriod,
        frozenUsersCount,
        verifiedKycCount,
        pendingKycCount,
        openSupportTickets,
        pendingCashierTickets,
        pendingTrxCount,
        totalPendingApprovals:
          pendingKycCount + pendingCashierTickets + pendingTrxCount,
        totalClientUSD,
        totalClientKHR,
        totalSystemLiquidityUSD: totalClientUSD + totalClientKHR / khrRate,
        totalFixedDepositUSD,
        totalMerchantEscrowUSD,
        totalMerchantCollectedUSD,
        periodRevenueUSD,
        periodVolumeUSD,
        periodTrxCount,
        periodDepositsUSD,
        periodWithdrawalsUSD,
        periodTransfersCount,
        totalCards: allCards.length,
        physicalCards: allCards.filter((c) => c.isPhysical).length,
        lockedCards: allCards.filter((c) => c.isLocked).length,
        totalMerchants: allMerchants.length,
        activePromos: allPromos.filter((p) => p.isActive).length,
        totalAdmins: allAdmins.length,
        broadcastsCount: broadcastAgg ? broadcastAgg.length : 0,
      },
      breakdown: {
        transfers: periodTransfersCount,
        merchantPay: periodMerchantPayCount,
        cashier: periodCashierCount,
        cardPay: periodCardPayCount,
        billPay: periodBillPayCount,
      },
      timeline: sortedTimeline,
      liveStream,
      topUsers: topUsersList.slice(0, 6),
      topMerchants: topMerchantsList.slice(0, 6),
    });
  } catch (err) {
    console.error("Dashboard Analytics Pro Error:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// ============================================================================
// 👥 ជំពូកទី ៦៖ ការគ្រប់គ្រងអតិថិជន, គណនីរង និង KYC (CUSTOMER 360° & KYC BY `_id`)
// ============================================================================

/**
 * 🔹 ៦.១ អនុគមន៍រៀបចំកញ្ចប់ទិន្នន័យអតិថិជនពេញលេញ ៣៦០ ដឺក្រេ ដោយចាប់តាម `_id` សុទ្ធសាធ!
 * (ការពារកុំឱ្យទាញប្រតិបត្តិការ ឬកាតចាស់មកបង្ហាញ ប្រសិនបើថ្ងៃក្រោយមានគណនីថ្មីប្រើឈ្មោះ ឬលេខគណនីដដែល)
 */
async function buildCustomer360ProfileById(userObj) {
  if (!userObj) return null;
  let userDetails = userObj.toObject ? userObj.toObject() : { ...userObj };
  userDetails._id = String(userObj._id);
  userDetails.id = String(userObj._id);

  // 🎯 ១. ទាញយកប្រតិបត្តិការរបស់អតិថិជននេះ ដោយចាប់តាម `userId: userObj._id` ជាគោល!
  const userTransactions = await Transaction.find({
    userId: userObj._id,
  }).sort({ _id: -1 });
  userDetails.transactions = userTransactions || [];

  // 🎯 ២. ទាញយកកាតទាំងអស់របស់អតិថិជននេះ ដោយចាប់តាម `userId: userObj._id` ជាគោល!
  userDetails.virtualCards = await Card.find({
    userId: userObj._id,
  }).sort({ orderIndex: 1, createdAt: 1 });

  // 🧹 ៣. ឆែកគណនីកូន (Junior) ក្នុង subAccounts តាមរយៈ MongoDB `_id` (`parentId` & `linkedUserId`) សុទ្ធសាធ!
  if (
    Array.isArray(userDetails.subAccounts) &&
    userDetails.subAccounts.length > 0
  ) {
    const jrSubItems = userDetails.subAccounts.filter(
      (s) => s.accountType === "junior",
    );
    if (jrSubItems.length > 0) {
      const aliveKids = await User.find({
        role: "junior",
        parentId: userObj._id,
      })
        .select("_id")
        .lean();

      const aliveIds = new Set(aliveKids.map((k) => String(k._id)));

      userDetails.subAccounts = userDetails.subAccounts.filter((sa) => {
        if (sa.accountType !== "junior") return true;
        if (sa.linkedUserId && aliveIds.has(String(sa.linkedUserId)))
          return true;
        const cleanAid = String(sa.accountId || "").replace(/_khr$/i, "");
        return aliveIds.has(cleanAid);
      });
    }
  }

  // ៤. រៀបចំរូបភាព KYC (បំបែកដាច់ពីរូបភាព Profile)
  userDetails.kycDocument =
    userDetails.kycDocument ||
    userDetails.kycImage ||
    userDetails.idCardImage ||
    "";
  userDetails.kycImage = userDetails.kycDocument;

  // ៥. ស្វែងរកឈ្មោះពេញរបស់អ្នកណែនាំ (Referrer) បើមាន
  if (userDetails.referredBy) {
    const refConds = [{ userId: userDetails.referredBy }];
    if (mongoose.isValidObjectId(userDetails.referredBy)) {
      refConds.unshift({ _id: userDetails.referredBy });
    }
    const referrer = await User.findOne({ $or: refConds }).select(
      "fullName username",
    );
    if (referrer) {
      userDetails.referrerName = getDisplayName(referrer);
    }
  }

  return userDetails;
}

/**
 * 🔹 ៦.២ ស្វែងរកអតិថិជនសម្រាប់ Customer 360° (គាំទ្រការស្វែងរកតាម `_id`, ឈ្មោះពេញ, លេខទូរស័ព្ទ, លេខគណនី)
 */
const searchUserByAdmin = async (req, res) => {
  try {
    const { searchTerm } = req.body;
    if (!searchTerm) {
      return res.json({ success: false, message: "សូមបញ្ចូលពាក្យស្វែងរក!" });
    }

    const cleanTerm = String(searchTerm).trim();
    let userObj = null;

    if (mongoose.isValidObjectId(cleanTerm)) {
      userObj = await User.findById(cleanTerm).select("-password");
    }

    if (!userObj) {
      const regex = new RegExp(
        cleanTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "i",
      );
      userObj = await User.findOne({
        $or: [
          { fullName: regex },
          { username: regex },
          { phone: regex },
          { "mainAccounts.USD.accountNumber": cleanTerm },
          { "mainAccounts.KHR.accountNumber": cleanTerm },
          { "subAccounts.accountNumber": cleanTerm },
        ],
      }).select("-password");
    }

    if (userObj) {
      const userDetails = await buildCustomer360ProfileById(userObj);
      res.json({ success: true, user: userDetails });
    } else {
      res.json({ success: false, message: "រកមិនឃើញអតិថិជននេះទេ!" });
    }
  } catch (error) {
    console.error("Search User By Admin Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * 🔹 ៦.៣ ទាញយកទិន្នន័យអតិថិជនម្នាក់តាម `_id` (getUserByAdmin & getSingleUser)
 */
const getUserByAdmin = async (req, res) => {
  try {
    const identifier =
      req.body._id || req.body.userId || req.body.id || req.body.username;
    const userObj = await resolveCustomerById(identifier, "-password");

    if (userObj) {
      const userDetails = await buildCustomer360ProfileById(userObj);
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
    const identifier =
      req.body._id || req.body.userId || req.body.id || req.body.username;
    const user = await resolveCustomerById(identifier, "-password");
    if (user) res.json({ success: true, user });
    else res.json({ success: false, message: "User not found" });
  } catch (error) {
    res.status(500).json({ success: false });
  }
};

/**
 * 🔹 ៦.៤ បង្កើតគណនីអតិថិជនថ្មីដោយ Admin (adminCreateUser)
 */
const adminCreateUser = async (req, res) => {
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
    duplicateReason,
    duplicateIdReason,
    idCardUrl,
    selfieUrl,
  } = req.body;

  try {
    const existingUser = await User.findOne({
      $or: [{ username: username }, { email: email || "N/A_EMAIL_CHECK" }],
    });

    if (existingUser) {
      return res.json({
        success: false,
        message: "ឈ្មោះគណនី ឬ អ៊ីមែលនេះមានគេប្រើប្រាស់រួចហើយ!",
      });
    }

    const cleanIdNumber = String(idNumber || "").trim();
    let finalDupReason = String(
      duplicateIdReason || duplicateReason || "",
    ).trim();

    if (cleanIdNumber && cleanIdNumber !== "N/A") {
      const existingIdUsers = await User.find({ idNumber: cleanIdNumber });
      if (existingIdUsers.length > 0 && !finalDupReason) {
        return res.json({
          success: false,
          requireDuplicateReason: true,
          message: `លេខអត្តសញ្ញាណប័ណ្ណ (${cleanIdNumber}) ធ្លាប់មានគណនីប្រើប្រាស់រួចហើយ! សូមបញ្ចូលមូលហេតុនៃការបង្កើតគណនីបន្ថែម។`,
        });
      }
    }

    const tsId = Date.now().toString();
    const prefix = Math.floor(Math.random() * 9) + 1;
    const suffix = Math.floor(Math.random() * 890) + 100;
    const baseAcc = parseInt(`${prefix}00${prefix}00${suffix}`, 10);

    const newAccUSD = baseAcc.toString();
    const newAccKHR = (baseAcc + 1).toString();
    const newUserId = Math.floor(
      10000000 + Math.random() * 90000000,
    ).toString();

    let initialKycStatus = idCardUrl && selfieUrl ? "pending" : "unverified";
    const adminDisplayName = await getAdminFullDisplayName(req.admin);

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
      idNumber: cleanIdNumber,
      duplicateIdReason: finalDupReason,

      // 🖼️ ពេលបង្កើតដំបូង យករូប Selfie KYC ដាក់ជា Profile សិន (តែរក្សាទុកដាច់ពីគ្នា)
      profileImage: selfieUrl || "",
      kycStatus: initialKycStatus,
      kycDocument: idCardUrl || "",
      kycImage: idCardUrl || "",
      selfieUrl: selfieUrl || "",
      kycSubmittedAt: initialKycStatus === "pending" ? getFormattedDate() : "",
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

    await newUser.save();

    if (cleanIdNumber && finalDupReason) {
      await User.updateMany(
        { idNumber: cleanIdNumber },
        { $set: { duplicateIdReason: finalDupReason } },
      );
    }

    await logAdminAction(
      adminDisplayName,
      "Create User",
      String(newUser._id),
      `Created new account for "${getDisplayName(newUser)}"${finalDupReason ? ` (Duplicate ID Reason: ${finalDupReason})` : ""}`,
    );

    res.json({
      success: true,
      message: "គណនីត្រូវបានបង្កើតដោយជោគជ័យ!",
      userId: String(newUser._id),
    });
  } catch (err) {
    console.error("Admin Create User Error:", err);
    res
      .status(500)
      .json({ success: false, message: "Server Error ពេលបង្កើតគណនី" });
  }
};

/**
 * 🔹 ៦.៥ កែប្រែព័ត៌មានអតិថិជនតាម `_id` (editUser)
 */
const editUser = async (req, res) => {
  const access = await checkAdminAccess(req.admin, "editUser");
  if (!access.allowed)
    return res.status(403).json({ success: false, message: access.message });

  const {
    id,
    _id,
    userId,
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
    duplicateIdReason,
  } = req.body;

  try {
    const u = await resolveCustomerById(_id || id || userId || username);
    if (!u) {
      return res.json({
        success: false,
        message: "រកមិនឃើញគណនីដើម្បីកែប្រែទេ។",
      });
    }

    const checkUSD = accountNumber || u.mainAccounts?.USD?.accountNumber || "";
    const checkKHR =
      accountNumberKHR || u.mainAccounts?.KHR?.accountNumber || "";
    if (checkUSD && checkKHR && checkUSD === checkKHR) {
      return res.json({
        success: false,
        message: "បរាជ័យ! លេខគណនី USD និង KHR មិនអាចដូចគ្នាបានទេ។",
      });
    }

    if (accountNumber) u.mainAccounts.USD.accountNumber = accountNumber;
    if (accountNumberKHR) u.mainAccounts.KHR.accountNumber = accountNumberKHR;
    if (username) u.username = username;
    if (pin) u.pin = pin;
    // 🖼️ កែប្រែតែរូបថត Profile ប៉ុណ្ណោះ មិនប៉ះពាល់រូបថត KYC (selfieUrl) ទេ!
    if (profileImage !== undefined) u.profileImage = profileImage;
    if (password && password.trim() !== "") {
      u.password = await bcrypt.hash(password, 10);
    }

    if (fullName !== undefined) u.fullName = fullName;
    if (phone !== undefined) u.phone = phone;
    if (email !== undefined) u.email = email;
    if (dob !== undefined) u.dob = dob;
    if (gender !== undefined) u.gender = gender;
    if (idNumber !== undefined) u.idNumber = idNumber.trim();
    if (duplicateIdReason !== undefined) {
      u.duplicateIdReason = duplicateIdReason.trim();
    }

    u.markModified("mainAccounts");
    await u.save();

    const targetIdNum = (
      idNumber !== undefined ? idNumber : u.idNumber || ""
    ).trim();
    if (targetIdNum && targetIdNum !== "N/A") {
      const sameIdUsers = await User.find({ idNumber: targetIdNum });
      if (sameIdUsers.length > 1) {
        const sharedReason =
          (duplicateIdReason !== undefined
            ? duplicateIdReason
            : u.duplicateIdReason) ||
          sameIdUsers.find((item) => item.duplicateIdReason)
            ?.duplicateIdReason ||
          "ប្រើប្រាស់អត្តសញ្ញាណប័ណ្ណរួមគ្នា (Multiple Accounts)";

        await User.updateMany(
          { idNumber: targetIdNum },
          { $set: { duplicateIdReason: sharedReason } },
        );
      }
    }

    await logAdminAction(
      await getAdminFullDisplayName(req.admin),
      "Edit User",
      String(u._id),
      `Updated profile for "${getDisplayName(u)}"${duplicateIdReason ? ` (Duplicate ID Reason: ${duplicateIdReason})` : ""}`,
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Edit User Error:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * 🔹 ៦.៦ ផ្ញើតំណភ្ជាប់កំណត់លេខសម្ងាត់ ឬ PIN ថ្មីទៅកាន់អ៊ីមែលអតិថិជនតាម `_id`
 */
const requestCredentialReset = async (req, res) => {
  const access = await checkAdminAccess(req.admin, "editUser");
  if (!access.allowed)
    return res.status(403).json({ success: false, message: access.message });

  const { _id, userId, username, resetType } = req.body;
  try {
    const user = await resolveCustomerById(_id || userId || username);
    if (!user) return res.json({ success: false, message: "រកគណនីមិនឃើញទេ!" });

    if (!user.email) {
      return res.json({
        success: false,
        message:
          "បរាជ័យ! អតិថិជននេះមិនទាន់មាន អ៊ីមែល (Email) ក្នុងប្រព័ន្ធទេ។ សូមបញ្ចូល Email ឱ្យគាត់ជាមុនសិន។",
      });
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    user.resetToken = rawToken;
    user.resetTokenExpire = Date.now() + 5 * 60 * 1000;
    await user.save();

    const baseUrl = process.env.CLIENT_URL || "https://u-pay-bank.fly.dev";
    const resetUrl = `${baseUrl}/reset-credential.html?token=${rawToken}&type=${resetType}`;

    if (typeof sendResetLink === "function") {
      const emailSent = await sendResetLink(
        user.email,
        getDisplayName(user),
        resetUrl,
        resetType,
      );
      if (!emailSent) {
        return res.json({
          success: false,
          message: "មានបញ្ហាក្នុងការផ្ញើអ៊ីមែល!",
        });
      }
    }

    await logAdminAction(
      await getAdminFullDisplayName(req.admin),
      `Request Reset ${resetType}`,
      String(user._id),
      `Sent reset link to ${user.email} for "${getDisplayName(user)}"`,
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

/**
 * 🔹 ៦.៧ លុបគណនីអតិថិជន ឬ គណនីរងតាម `_id` (សម្អាតទិន្នន័យចេញពីគ្រប់ Models ទាំងអស់ ១០០%!)
 */
const deleteUser = async (req, res) => {
  const access = await checkAdminAccess(req.admin, "deleteUser");
  if (!access.allowed)
    return res.status(403).json({ success: false, message: access.message });

  const { id, _id, userId, targetAccount, reason } = req.body;
  try {
    const user = await resolveCustomerById(_id || id || userId);
    if (!user) {
      return res.json({ success: false, message: "រកមិនឃើញគណនីនេះទេ!" });
    }

    const centralBank = await User.findOne({
      $or: [
        { "mainAccounts.USD.accountNumber": "888888888" },
        { username: "superadmin" },
      ],
    });

    let logDetail = "";
    const dateStr = new Date().toLocaleString("en-US", {
      timeZone: "Asia/Phnom_Penh",
      hour12: true,
    });

    // ករណីទី ១៖ លុបតែគណនីរងមួយ (Sub-Account)
    if (targetAccount && targetAccount !== "ALL") {
      const subIndex = user.subAccounts.findIndex(
        (s) => s.accountNumber === targetAccount,
      );
      if (subIndex === -1)
        return res.json({ success: false, message: "រកមិនឃើញគណនីរងនេះទេ!" });

      const subAcc = user.subAccounts[subIndex];

      // 👶 បើគណនីរងនោះជាគណនីកូន (Junior) ត្រូវលុបគណនីពិតរបស់កូនចេញពីតារាង User និងគ្រប់ Models ទាំងអស់!
      if (subAcc.accountType === "junior") {
        const cleanJrAid = String(subAcc.accountId || "").replace(/_khr$/i, "");
        const jrOrConds = [
          { "mainAccounts.USD.accountNumber": targetAccount },
          { "mainAccounts.KHR.accountNumber": targetAccount },
        ];
        if (
          subAcc.linkedUserId &&
          mongoose.isValidObjectId(subAcc.linkedUserId)
        ) {
          jrOrConds.unshift({ _id: subAcc.linkedUserId });
        }
        if (mongoose.isValidObjectId(cleanJrAid)) {
          jrOrConds.unshift({ _id: cleanJrAid });
        } else if (cleanJrAid) {
          jrOrConds.push({ username: cleanJrAid });
        }

        const juniorUserDoc = await User.findOne({
          role: "junior",
          $or: jrOrConds,
        });

        if (juniorUserDoc) {
          await cascadePurgeSingleUserDocument(
            juniorUserDoc,
            centralBank,
            reason || "Admin Deleted Junior Sub-Account",
          );
        } else {
          user.subAccounts.splice(subIndex, 1);
          user.markModified("subAccounts");
          await user.save();
        }
        logDetail = `Purged Junior Account completely (${targetAccount}). Reason: ${reason}`;
      } else {
        const subBalance = Number(subAcc.balance || 0);
        const subCurrency = subAcc.currency || "USD";

        if (subBalance > 0) {
          if (subCurrency === "USD") {
            user.mainAccounts.USD.balance += subBalance;
          } else {
            user.mainAccounts.KHR.balance =
              (user.mainAccounts.KHR.balance || 0) + subBalance;
          }
          user.markModified("mainAccounts");

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
            receiverName: getDisplayName(user),
            senderAcc: targetAccount,
            receiverAcc:
              subCurrency === "USD"
                ? user.mainAccounts.USD.accountNumber
                : user.mainAccounts.KHR.accountNumber,
            remark: "ផ្ទេរសមតុល្យចូលគណនីគោលដោយស្វ័យប្រវត្តិ (បិទគណនីរង)",
            status: "Success",
          });
        }

        user.subAccounts.splice(subIndex, 1);
        user.markModified("subAccounts");
        await user.save();
        logDetail = `Deleted Sub-account: ${targetAccount}. Auto-Transferred: ${subBalance} ${subCurrency} to Main. Reason: ${reason}`;
      }
    } else {
      // ករណីទី ២៖ លុបគណនីអតិថិជនទាំងមូល + បោសសម្អាតគ្រប់ Models ទាំងអស់តាម `_id`!
      const { usdRecovered, khrRecovered } =
        await cascadePurgeSingleUserDocument(user, centralBank, reason);
      logDetail = `Purged User "${getDisplayName(user)}" (_id: ${user._id}) & all related data across all models. Recovered $${usdRecovered} & ៛${khrRecovered}. Reason: ${reason}`;
    }

    await logAdminAction(
      await getAdminFullDisplayName(req.admin),
      "Delete User/Account",
      "DELETED_" + String(user._id),
      logDetail,
    );

    res.json({
      success: true,
      message: "បានលុបគណនី និងបោសសម្អាតទិន្នន័យពាក់ព័ន្ធទាំងអស់ដោយជោគជ័យ!",
    });
  } catch (err) {
    console.error("Delete User Error:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * 🔹 ៦.៨ មុខងារគ្រប់គ្រងគណនីរងដោយ Admin តាម `_id` (Edit, Delete, Limit, Freeze, Hide)
 */
const editSubAccount = async (req, res) => {
  const { _id, userId, username, oldAccountNumber, newName, newAccountNumber } =
    req.body;
  try {
    const user = await resolveCustomerById(_id || userId || username);
    if (!user) return res.json({ success: false, message: "រកគណនីមិនឃើញទេ!" });

    if (oldAccountNumber !== newAccountNumber) {
      const accExists = await User.findOne({
        $or: [
          { "mainAccounts.USD.accountNumber": newAccountNumber },
          { "mainAccounts.KHR.accountNumber": newAccountNumber },
          { "subAccounts.accountNumber": newAccountNumber },
        ],
      });
      if (accExists) {
        return res.json({
          success: false,
          message: "លេខគណនីថ្មីនេះ មានអ្នកប្រើប្រាស់រួចហើយ!",
        });
      }
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
        { userId: user._id, senderAcc: oldAccountNumber },
        { $set: { senderAcc: newAccountNumber } },
      );
      await Transaction.updateMany(
        { userId: user._id, receiverAcc: oldAccountNumber },
        { $set: { receiverAcc: newAccountNumber } },
      );
    }

    await logAdminAction(
      await getAdminFullDisplayName(req.admin),
      "Edit Sub Account",
      String(user._id),
      `Changed ${oldAccountNumber} to ${newName} (${newAccountNumber}) for "${getDisplayName(user)}"`,
    );
    res.json({ success: true, message: "កែប្រែជោគជ័យ!" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

const deleteSubAccount = async (req, res) => {
  const { _id, userId, username, accountNumber } = req.body;
  try {
    const user = await resolveCustomerById(_id || userId || username);
    if (!user) return res.json({ success: false, message: "រកគណនីមិនឃើញទេ!" });

    const subIdx = user.subAccounts.findIndex(
      (a) => String(a.accountNumber) === String(accountNumber),
    );
    if (subIdx === -1)
      return res.json({ success: false, message: "រកគណនីរងនេះមិនឃើញទេ!" });

    const subAcc = user.subAccounts[subIdx];

    // 👶 បើគណនីរងនេះជាគណនីកូន (Junior) ត្រូវលុបគណនីពិតរបស់កូនចេញពីតារាង User និងគ្រប់ Models ទាំងអស់!
    if (subAcc.accountType === "junior") {
      const centralBank = await User.findOne({
        $or: [
          { "mainAccounts.USD.accountNumber": "888888888" },
          { username: "superadmin" },
        ],
      });
      const cleanJrAid = String(subAcc.accountId || "").replace(/_khr$/i, "");
      const jrOrConds = [
        { "mainAccounts.USD.accountNumber": accountNumber },
        { "mainAccounts.KHR.accountNumber": accountNumber },
      ];
      if (
        subAcc.linkedUserId &&
        mongoose.isValidObjectId(subAcc.linkedUserId)
      ) {
        jrOrConds.unshift({ _id: subAcc.linkedUserId });
      }
      if (mongoose.isValidObjectId(cleanJrAid)) {
        jrOrConds.unshift({ _id: cleanJrAid });
      } else if (cleanJrAid) {
        jrOrConds.push({ username: cleanJrAid });
      }

      const juniorUserDoc = await User.findOne({
        role: "junior",
        $or: jrOrConds,
      });

      if (juniorUserDoc) {
        await cascadePurgeSingleUserDocument(
          juniorUserDoc,
          centralBank,
          "Deleted Junior Account from Customer 360",
        );
        return res.json({
          success: true,
          message:
            "បានលុបគណនីកុមារ និងទិន្នន័យពាក់ព័ន្ធទាំងអស់ចេញពីប្រព័ន្ធជោគជ័យ!",
        });
      }
    }

    if (subAcc.balance > 0) {
      if (subAcc.currency === "USD") {
        user.mainAccounts.USD.balance += subAcc.balance;
      } else {
        user.mainAccounts.KHR.balance =
          (user.mainAccounts.KHR.balance || 0) + subAcc.balance;
      }
      user.markModified("mainAccounts");

      await Transaction.create({
        userId: user._id,
        username: user.username,
        refId: `SYS-${Date.now()}`,
        date: new Date().toISOString(),
        type: "System Auto-Transfer",
        amount: subAcc.balance,
        currency: subAcc.currency,
        senderName: subAcc.accountName,
        receiverName: getDisplayName(user),
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

    await logAdminAction(
      await getAdminFullDisplayName(req.admin),
      "Delete Sub Account",
      String(user._id),
      `Deleted ${accountNumber} for "${getDisplayName(user)}". Balance recovered: ${subAcc.balance}`,
    );
    res.json({ success: true, message: "លុបជោគជ័យ!" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

const adminUpdateAccountLimit = async (req, res) => {
  const { _id, userId, username, accountNumber, dailyLimit } = req.body;
  try {
    const user = await resolveCustomerById(_id || userId || username);
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
      await logAdminAction(
        await getAdminFullDisplayName(req.admin),
        "Update Account Limit",
        String(user._id),
        `កំណត់ Limit ថ្មីឱ្យគណនី ${accountNumber} ចំនួន: ${dailyLimit}`,
      );
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
  const { _id, userId, username, accountNumber } = req.body;
  try {
    const user = await resolveCustomerById(_id || userId || username);
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
      await logAdminAction(
        await getAdminFullDisplayName(req.admin),
        "Toggle Account Freeze",
        String(user._id),
        `គណនី ${accountNumber} ត្រូវបាន ${newStatus ? "FROZEN" : "ACTIVE"}`,
      );
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
  const { _id, userId, username, accountNumber } = req.body;
  try {
    const user = await resolveCustomerById(_id || userId || username);
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
      await logAdminAction(
        await getAdminFullDisplayName(req.admin),
        "Toggle Account Visibility",
        String(user._id),
        `គណនី ${accountNumber} ត្រូវបាន ${isHiddenNow ? "HIDDEN" : "VISIBLE"}`,
      );
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

/**
 * 🔹 ៦.៩ ផ្អាក ឬ បើកដំណើរការគណនីអតិថិជនទាំងមូលតាម `_id` (toggleFreeze & adminForceLogout)
 */
const toggleFreeze = async (req, res) => {
  const access = await checkAdminAccess(req.admin, "freezeUser");
  if (!access.allowed)
    return res.status(403).json({ success: false, message: access.message });

  const { id, _id, userId, isFrozen } = req.body;
  try {
    const u = await resolveCustomerById(_id || id || userId);
    if (u) {
      u.isFrozen = isFrozen;
      if (!isFrozen) {
        u.pinAttempts = 0;
        u.passwordAttempts = 0;
      }
      await u.save();

      await Notification.create({
        userId: u._id,
        username: u.username,
        title: isFrozen
          ? "គណនីត្រូវបានផ្អាកបណ្តោះអាសន្ន ❄️"
          : "គណនីត្រូវបានបើកដំណើរការវិញ 🟢",
        message: isFrozen
          ? `ជូនចំពោះ ${getDisplayName(u)}៖ គណនីរបស់អ្នកត្រូវបានផ្អាកដំណើរការបណ្តោះអាសន្នដោយផ្នែកសុវត្ថិភាពធនាគារ។`
          : `ជូនចំពោះ ${getDisplayName(u)}៖ គណនីរបស់អ្នកត្រូវបានដោះសោ និងអាចប្រើប្រាស់បានធម្មតាវិញហើយ។`,
        date: getFormattedDate(),
        type: isFrozen ? "security_alert" : "account_unfrozen",
        isRead: false,
      });

      await logAdminAction(
        await getAdminFullDisplayName(req.admin),
        "Freeze User",
        String(u._id),
        `Status of "${getDisplayName(u)}" changed to ${isFrozen ? "FROZEN" : "UNFROZEN"}`,
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
  const { _id, userId, username } = req.body;
  try {
    const user = await resolveCustomerById(_id || userId || username);
    if (!user) return res.json({ success: false, message: "រកមិនឃើញអតិថិជន" });

    user.forceLogout = true;
    user.set("currentToken", undefined, { strict: false });
    user.set("pushToken", undefined, { strict: false });
    await user.save();

    if (global.io) {
      global.io.emit("force_logout_triggered", {
        userId: String(user._id),
        username: user.username,
      });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 🔹 ៦.១០ មុខងារត្រួតពិនិត្យ និងអនុម័តឯកសារបញ្ជាក់អត្តសញ្ញាណ (KYC Maker-Checker by `_id` + Auto-Unfreeze Junior)
 */
const adminUploadKyc = async (req, res) => {
  const { _id, userId, username, kycDocument, kycImage } = req.body;
  try {
    const finalKycUrl = kycDocument || kycImage;
    if (!finalKycUrl)
      return res.json({ success: false, message: "មិនមាន URL ឯកសារទេ!" });

    const user = await resolveCustomerById(_id || userId || username);
    if (!user)
      return res.json({ success: false, message: "រកមិនឃើញគណនីអតិថិជន" });

    user.kycDocument = finalKycUrl;
    user.kycImage = finalKycUrl;
    user.kycStatus = "pending";
    await user.save();

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const kycAction = async (req, res) => {
  const { _id, userId, username, action, rejectReason } = req.body;
  try {
    const u = await resolveCustomerById(_id || userId || username);
    if (!u) {
      return res.json({
        success: false,
        message: "រកមិនឃើញគណនីអតិថិជននេះទេ!",
      });
    }

    const currentAdminUsername = String(req.admin.username || "").trim();
    const currentAdminFullName = await getAdminFullDisplayName(req.admin);
    const customerFullName = getDisplayName(u);
    const uploadedBy = String(u.kycUploadedBy || "")
      .replace(/^@/, "")
      .trim();

    if (
      (action === "approved" ||
        action === "verified" ||
        action === "rejected") &&
      uploadedBy !== "" &&
      uploadedBy !== "អតិថិជនផ្ទាល់" &&
      uploadedBy.toLowerCase() === currentAdminUsername.toLowerCase()
    ) {
      return res.json({
        success: false,
        message:
          "បម្រាម Maker-Checker៖ អ្នកជាអ្នកបញ្ជូនឯកសារនេះ (Maker) មិនអាចអនុម័ត ឬបដិសេធដោយខ្លួនឯងបានទេ! សូមឱ្យមន្ត្រីផ្សេងទៀតជាអ្នកពិនិត្យ។",
      });
    }

    const dateStr = new Date().toLocaleString("en-US", {
      timeZone: "Asia/Phnom_Penh",
      hour12: true,
    });

    if (action === "withdraw") {
      u.kycStatus = "unverified";
      u.kycRejectReason = rejectReason || "ដកសំណើមកកែសម្រួលវិញដោយ Maker";
      await u.save();

      await logAdminAction(
        currentAdminFullName,
        "Withdraw KYC Request",
        String(u._id),
        `Maker withdrew KYC submission for "${customerFullName}". Note: ${u.kycRejectReason}`,
      );
      return res.json({
        success: true,
        message: "បានដកសំណើ KYC មកកែសម្រួលវិញដោយជោគជ័យ!",
      });
    }

    if (action === "rejected" || action === "revoke") {
      if (!rejectReason || rejectReason.trim() === "") {
        return res.json({
          success: false,
          message: "សូមបញ្ជាក់មូលហេតុនៃការបដិសេធ!",
        });
      }

      const oldIdNumber = String(u.idNumber || "").trim();

      u.kycStatus = "rejected";
      u.kycRejectReason = rejectReason.trim();
      u.kycRejectedBy = currentAdminFullName;
      u.kycRejectedAt = dateStr;

      // 🧹 លុបតែឯកសារ KYC (kycDocument, selfieUrl, idNumber) មិនលុបរូប profileImage ទេ!
      u.kycDocument = "";
      u.kycImage = "";
      u.selfieUrl = "";
      u.kycUploadedBy = "";
      u.idNumber = "";
      u.duplicateIdReason = "";

      await u.save();

      if (oldIdNumber && oldIdNumber !== "N/A") {
        const remainingUsers = await User.find({ idNumber: oldIdNumber });
        if (remainingUsers.length === 1) {
          remainingUsers[0].duplicateIdReason = "";
          await remainingUsers[0].save();
        }
      }

      await Notification.create({
        userId: u._id,
        username: u.username,
        title: "ការផ្ទៀងផ្ទាត់អត្តសញ្ញាណបរាជ័យ (KYC Rejected) ❌",
        message: `ជូនចំពោះ ${customerFullName}៖ ឯកសារបញ្ជាក់អត្តសញ្ញាណរបស់អ្នកត្រូវបានបដិសេធដោយមន្ត្រីត្រួតពិនិត្យ (${currentAdminFullName})។ មូលហេតុ៖ "${rejectReason}"។ សូមបញ្ជូនឯកសារថ្មីម្តងទៀត។`,
        date: getFormattedDate(),
        type: "kyc_rejected", // 🔔 Icon ក្រហមសម្រាប់ KYC Rejected
        isRead: false,
        metadata: { sender: currentAdminFullName },
      });

      await logAdminAction(
        currentAdminFullName,
        action === "revoke" ? "Revoke KYC & Clear ID" : "Reject KYC & Clear ID",
        String(u._id),
        `Cleared ID (${oldIdNumber || "N/A"}) for "${customerFullName}". Reason: ${rejectReason}`,
      );

      return res.json({
        success: true,
        message:
          "បានបដិសេធសំណើ KYC និងលុបលេខអត្តសញ្ញាណប័ណ្ណចេញពីប្រព័ន្ធរួចរាល់!",
      });
    } else if (action === "approved" || action === "verified") {
      if (u.fullName) u.fullName = String(u.fullName).trim().toUpperCase();
      u.kycStatus = "verified";
      u.kycRejectReason = "";
      u.kycApprovedBy = currentAdminFullName;
      u.kycApprovedAt = dateStr;

      // 👶 បើជាគណនីកុមារ (Junior Account) ពេល Admin អនុម័តសំបុត្រកំណើតរួច បើកដំណើរការគណនីតាម `_id` ភ្លាមៗ!
      if (u.role === "junior") {
        u.isFrozen = false;
        if (u.mainAccounts?.USD) {
          u.mainAccounts.USD.isFrozen = false;
          u.mainAccounts.USD.isSystemLocked = false;
        }
        if (u.mainAccounts?.KHR) {
          u.mainAccounts.KHR.isFrozen = false;
          u.mainAccounts.KHR.isSystemLocked = false;
        }
        u.markModified("mainAccounts");

        if (u.parentId && mongoose.isValidObjectId(u.parentId)) {
          const parentDoc = await User.findById(u.parentId);
          if (parentDoc && Array.isArray(parentDoc.subAccounts)) {
            parentDoc.subAccounts.forEach((sa) => {
              if (
                (sa.linkedUserId &&
                  String(sa.linkedUserId) === String(u._id)) ||
                sa.accountId === String(u._id) ||
                sa.accountId === String(u._id) + "_khr"
              ) {
                sa.isFrozen = false;
                sa.isLocked = false;
                sa.isSystemLocked = false;
              }
            });
            parentDoc.markModified("subAccounts");
            await parentDoc.save();

            await Notification.create({
              userId: parentDoc._id,
              username: parentDoc.username,
              title: "គណនីកូនត្រូវបានអនុម័ត និងបើកដំណើរការ! 🎉👶",
              message: `ជូនចំពោះ ${getDisplayName(parentDoc)}៖ សំបុត្រកំណើតរបស់កូន "${customerFullName}" ត្រូវបានពិនិត្យ និងអនុម័តដោយមន្ត្រីធនាគាររួចរាល់ហើយ! គណនីកូនបានបើកដំណើរការដោយស្វ័យប្រវត្តិ។`,
              date: getFormattedDate(),
              type: "kyc_approved",
              isRead: false,
              metadata: { sender: currentAdminFullName },
            });
          }
        }
      }

      await u.save();

      await Notification.create({
        userId: u._id,
        username: u.username,
        title: "គណនីត្រូវបានផ្ទៀងផ្ទាត់ជោគជ័យ (KYC Verified) ✅",
        message: `អបអរសាទរ ${customerFullName}! ឯកសារបញ្ជាក់អត្តសញ្ញាណរបស់អ្នកត្រូវបានអនុម័តពេញលេញដោយធនាគារ U-Pay។`,
        date: getFormattedDate(),
        type: "kyc_approved", // 🔔 Icon បៃតងសម្រាប់ KYC Approved
        isRead: false,
        metadata: { sender: currentAdminFullName },
      });

      await logAdminAction(
        currentAdminFullName,
        "Approve KYC",
        String(u._id),
        `Approved KYC Document for "${customerFullName}"`,
      );

      return res.json({
        success: true,
        message: "បានអនុម័តឯកសារ KYC និងបើកដំណើរការគណនីដោយជោគជ័យ!",
      });
    }

    res.json({ success: true, message: "បានធ្វើបច្ចុប្បន្នភាព KYC ជោគជ័យ!" });
  } catch (err) {
    console.error("KYC Action Error:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

const uploadSpecificKyc = async (req, res) => {
  const { _id, userId, username, type, url } = req.body;
  try {
    const u = await resolveCustomerById(_id || userId || username);
    if (!u) return res.json({ success: false, message: "រកអតិថិជនមិនឃើញទេ!" });

    if (type === "idCard") {
      u.kycDocument = url;
      u.kycImage = url;
    } else if (type === "selfie") {
      u.selfieUrl = url;
      // បើគណនីមិនទាន់មានរូប Profile ទេ យករូប Selfie ដាក់ឱ្យសិន
      if (!u.profileImage) u.profileImage = url;
    }

    if ((u.kycDocument || u.kycImage) && u.selfieUrl) {
      u.kycStatus = "pending";
      u.kycSubmittedAt = getFormattedDate();
    } else {
      u.kycStatus = "unverified";
    }

    u.kycUploadedBy = req.admin.username;
    await u.save();

    await logAdminAction(
      await getAdminFullDisplayName(req.admin),
      `Upload KYC (${type})`,
      String(u._id),
      `Uploaded ${type} for "${getDisplayName(u)}"`,
    );

    res.json({ success: true, message: "Upload ជោគជ័យ!" });
  } catch (error) {
    console.error("Upload Specific KYC Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// ============================================================================
// 💰 ជំពូកទី ៧៖ ប្រតិបត្តិការហិរញ្ញវត្ថុ និងការបង្វិលប្រាក់ (FINANCE & REFUND BY `_id`)
// ============================================================================

/**
 * 🔹 ៧.១ ត្រួតពិនិត្យព័ត៌មានលម្អិតនៃប្រតិបត្តិការ (Transaction Forensics by `_id`)
 */
const getTransaction = async (req, res) => {
  const searchTerm = String(req.params.id || "").trim();
  try {
    const matchedTrxs = await Transaction.find({
      $or: [{ refId: searchTerm }, { hash: searchTerm }],
    });

    if (!matchedTrxs || matchedTrxs.length === 0) {
      return res.json({
        success: false,
        message: "រកមិនឃើញប្រតិបត្តិការនេះទេ! លេខ Ref ID ឬ Hash មិនត្រឹមត្រូវ។",
      });
    }

    const senderLeg = matchedTrxs.find((t) => t.amount < 0) || matchedTrxs[0];
    const receiverLeg = matchedTrxs.find((t) => t.amount > 0) || matchedTrxs[0];
    const primaryTrx = matchedTrxs[0];

    const sAccNum = senderLeg.senderAcc || primaryTrx.senderAcc || "";
    const rAccNum = receiverLeg.receiverAcc || primaryTrx.receiverAcc || "";

    // 🎯 ១. ស្វែងរកគណនីអ្នកផ្ញើតាម `senderLeg.userId` (_id) មុនគេបង្អស់!
    let senderObj = null;
    if (
      senderLeg.amount < 0 &&
      senderLeg.userId &&
      mongoose.isValidObjectId(senderLeg.userId)
    ) {
      senderObj = await User.findById(senderLeg.userId).select(
        "-password -pin",
      );
    }
    if (!senderObj && sAccNum && sAccNum !== "N/A" && sAccNum !== "888888888") {
      senderObj = await User.findOne({
        $or: [
          { "mainAccounts.USD.accountNumber": sAccNum },
          { "mainAccounts.KHR.accountNumber": sAccNum },
          { "subAccounts.accountNumber": sAccNum },
        ],
      }).select("-password -pin");
    }

    // 🎯 ២. ស្វែងរកហាង និងគណនីអ្នកទទួលតាម `ownerId` / `receiverLeg.userId` (_id) មុនគេបង្អស់!
    const merchIdVal = receiverLeg.merchantId || primaryTrx.merchantId;
    let merchantData = null;
    if (merchIdVal) {
      merchantData = await Merchant.findOne({
        $or: [
          { merchantId: merchIdVal },
          ...(mongoose.isValidObjectId(merchIdVal)
            ? [{ _id: merchIdVal }]
            : []),
        ],
      });
    }
    if (!merchantData && rAccNum) {
      merchantData = await Merchant.findOne({
        $or: [
          { name: primaryTrx.receiverName },
          { "accountNumbers.USD": rAccNum },
          { "accountNumbers.KHR": rAccNum },
          { "linkedAccounts.USD": rAccNum },
          { "linkedAccounts.KHR": rAccNum },
          { "cashiers.virtualAccounts.USD": rAccNum },
          { "cashiers.virtualAccounts.KHR": rAccNum },
        ],
      });
    }

    let receiverObj = null;
    if (merchantData && merchantData.ownerId) {
      receiverObj = await User.findById(merchantData.ownerId).select(
        "-password -pin",
      );
    }
    if (
      !receiverObj &&
      receiverLeg.amount > 0 &&
      receiverLeg.userId &&
      mongoose.isValidObjectId(receiverLeg.userId)
    ) {
      receiverObj = await User.findById(receiverLeg.userId).select(
        "-password -pin",
      );
    }
    if (
      !receiverObj &&
      rAccNum &&
      rAccNum !== "N/A" &&
      rAccNum !== "888888888"
    ) {
      receiverObj = await User.findOne({
        $or: [
          { "mainAccounts.USD.accountNumber": rAccNum },
          { "mainAccounts.KHR.accountNumber": rAccNum },
          { "subAccounts.accountNumber": rAccNum },
        ],
      }).select("-password -pin");
    }

    const cashierTicket = await CashierTicket.findOne({
      $or: [{ transactionId: primaryTrx.refId }, { ticketId: searchTerm }],
    });

    let trxDetails = {
      ...(primaryTrx.toObject ? primaryTrx.toObject() : primaryTrx),
    };

    trxDetails.amount = Math.abs(Number(primaryTrx.amount || 0));
    trxDetails.senderAmount = senderLeg ? senderLeg.amount : primaryTrx.amount;
    trxDetails.senderCurrency = senderLeg
      ? senderLeg.currency
      : primaryTrx.currency;
    trxDetails.receiverAmount = receiverLeg
      ? Math.abs(receiverLeg.amount)
      : Math.abs(primaryTrx.amount);
    trxDetails.receiverCurrency = receiverLeg
      ? receiverLeg.currency
      : primaryTrx.currency;

    trxDetails.senderUserId = senderObj ? String(senderObj._id) : null;
    trxDetails.senderRealUsername = senderObj ? senderObj.username : null;
    trxDetails.senderRealFullName = senderObj
      ? getDisplayName(senderObj)
      : null;
    trxDetails.senderPhone = senderObj ? senderObj.phone || "" : "";
    trxDetails.senderKyc = senderObj
      ? senderObj.kycStatus || "unverified"
      : "System";
    trxDetails.senderDevice = senderObj
      ? senderObj.lastDevice ||
        senderObj.connectedDevices?.[0]?.device ||
        "គ្មានកំណត់ត្រាឧបករណ៍"
      : "ប្រព័ន្ធធនាគារ (System)";
    trxDetails.senderIp = senderObj
      ? senderObj.lastIp ||
        senderObj.connectedDevices?.[0]?.ip ||
        "គ្មានកំណត់ត្រា IP"
      : "Internal Core Network";

    trxDetails.receiverUserId = receiverObj ? String(receiverObj._id) : null;
    trxDetails.receiverRealUsername = receiverObj ? receiverObj.username : null;
    trxDetails.receiverRealFullName = receiverObj
      ? getDisplayName(receiverObj)
      : null;
    trxDetails.receiverPhone = receiverObj ? receiverObj.phone || "" : "";
    trxDetails.receiverKyc = receiverObj
      ? receiverObj.kycStatus || "unverified"
      : "System";
    trxDetails.receiverDevice = receiverObj
      ? receiverObj.lastDevice ||
        receiverObj.connectedDevices?.[0]?.device ||
        "គ្មានកំណត់ត្រាឧបករណ៍"
      : "ប្រព័ន្ធធនាគារ (System)";
    trxDetails.receiverIp = receiverObj
      ? receiverObj.lastIp ||
        receiverObj.connectedDevices?.[0]?.ip ||
        "គ្មានកំណត់ត្រា IP"
      : "Internal Core Network";

    if (merchantData) {
      trxDetails.merchantId = merchantData.merchantId;
      trxDetails.merchantName = merchantData.name;
      trxDetails.merchantCategory = merchantData.category;
      trxDetails.merchantLinkedAcc =
        merchantData.linkedAccounts?.[trxDetails.receiverCurrency] || null;
    }

    if (cashierTicket) {
      trxDetails.cashierMaker = cashierTicket.maker;
      trxDetails.cashierChecker = cashierTicket.checker;
      trxDetails.cashierTicketId = cashierTicket.ticketId;
      trxDetails.depositorName = cashierTicket.depositorName;
      trxDetails.depositorAcc = cashierTicket.slipData?.depositorAccount || "";
    }

    res.json({ success: true, transaction: trxDetails });
  } catch (err) {
    console.error("Get Transaction Forensics Error:", err);
    res.status(500).json({
      success: false,
      message: "មានបញ្ហាតភ្ជាប់ទៅកាន់ Server (Database Error)!",
    });
  }
};

/**
 * 🔹 ៧.២ បន្ថែម ឬ កាត់សមតុល្យអតិថិជនដោយ Admin តាម `_id` (ប្រើឈ្មោះពេញ និង Icon `deposit` / `deduction`)
 */
const adjustBalance = async (req, res) => {
  const access = await checkAdminAccess(req.admin, "adjustBal");
  if (!access.allowed)
    return res.status(403).json({ success: false, message: access.message });

  const {
    _id,
    userId,
    username,
    targetAccount,
    amount,
    type,
    currency,
    remark,
  } = req.body;
  try {
    const user = await resolveCustomerById(_id || userId || username);
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
    const customerFullName = getDisplayName(user);
    const adminDisplayName = await getAdminFullDisplayName(req.admin);

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
      senderName: type === "add" ? "ធនាគារកណ្តាល U-Pay" : customerFullName,
      senderAcc:
        type === "add"
          ? isInputKHR
            ? centralBank.mainAccounts.KHR.accountNumber
            : centralBank.mainAccounts.USD.accountNumber
          : actualUserAcc,
      receiverName: type === "add" ? customerFullName : "ធនាគារកណ្តាល U-Pay",
      receiverAcc:
        type === "add"
          ? actualUserAcc
          : isInputKHR
            ? centralBank.mainAccounts.KHR.accountNumber
            : centralBank.mainAccounts.USD.accountNumber,
      remark: remark || (type === "add" ? "Cash Deposit" : "Cash Withdrawal"),
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
    const fmtFinalAmt = finalAmountToAddOrDeduct.toLocaleString("en-US", {
      minimumFractionDigits: destinationCurrency === "USD" ? 2 : 0,
    });

    if (targetJointAcc) {
      for (let m of targetJointAcc.members) {
        if (m.status === "active") {
          const memberDoc = await resolveCustomerById(m.userId || m.username);
          if (memberDoc) {
            await Transaction.create({
              ...userTrx,
              username: memberDoc.username,
              userId: memberDoc._id,
            });
            await Notification.create({
              userId: memberDoc._id,
              username: memberDoc.username,
              title:
                type === "add"
                  ? "ទទួលបានប្រាក់ដាក់បញ្ចូល (Deposit Received) 💰"
                  : "កាត់សមតុល្យគណនី (Balance Deducted) 🔻",
              message:
                type === "add"
                  ? `ជូនចំពោះ ${getDisplayName(memberDoc)}៖ ទឹកប្រាក់ +${finalSign}${fmtFinalAmt} ត្រូវបានបញ្ចូលទៅក្នុងគណនីរួម (#${actualUserAcc}) ដោយជោគជ័យ។`
                  : `ជូនចំពោះ ${getDisplayName(memberDoc)}៖ ទឹកប្រាក់ -${finalSign}${fmtFinalAmt} ត្រូវបានកាត់ចេញពីគណនីរួម (#${actualUserAcc})។`,
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
        title:
          type === "add"
            ? "ទទួលបានប្រាក់ដាក់បញ្ចូល (Deposit Received) 💰"
            : "កាត់សមតុល្យគណនី (Balance Deducted) 🔻",
        message:
          type === "add"
            ? `ជូនចំពោះ ${customerFullName}៖ ទឹកប្រាក់ +${finalSign}${fmtFinalAmt} ត្រូវបានបញ្ចូលទៅក្នុងគណនី (#${actualUserAcc}) របស់អ្នកដោយជោគជ័យ។`
            : `ជូនចំពោះ ${customerFullName}៖ ទឹកប្រាក់ -${finalSign}${fmtFinalAmt} ត្រូវបានកាត់ចេញពីគណនី (#${actualUserAcc}) របស់អ្នក។`,
        date: dateStr,
        type: type === "add" ? "deposit" : "deduction",
        isRead: false,
      });
    }

    await Transaction.create(bankTrx);
    user.markModified("mainAccounts");
    await user.save();
    centralBank.markModified("mainAccounts");
    await centralBank.save();

    await logAdminAction(
      adminDisplayName,
      type === "add" ? "Add Money" : "Deduct Money",
      String(user._id),
      `${type === "add" ? "+" : "-"}${sign}${adjustAmount} -> (${finalSign}${finalAmountToAddOrDeduct}) for "${customerFullName}"`,
    );

    res.json({
      success: true,
      message: `Operation Success! ទឹកប្រាក់ទទួលបានគឺ ${finalSign}${fmtFinalAmt}`,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * 🔹 ៧.៣ អនុម័តប្រតិបត្តិការដែលស្ថិតក្នុងស្ថានភាព Pending តាម `_id`
 */
const approveTransaction = async (req, res) => {
  const { refId } = req.body;
  try {
    const trx = await Transaction.findOne({ refId: refId, status: "Pending" });
    if (!trx) {
      return res.json({
        success: false,
        message: "រកមិនឃើញប្រតិបត្តិការ ឬមិនស្ថិតក្នុងស្ថានភាព Pending ទេ",
      });
    }

    trx.status = "Success";
    await trx.save();

    const u = await User.findById(trx.userId);
    if (u) {
      await Notification.create({
        userId: u._id,
        username: u.username,
        title: "ប្រតិបត្តិការត្រូវបានអនុម័ត (Payment Approved) ✅",
        message: `ជូនចំពោះ ${getDisplayName(u)}៖ ការទូទាត់ទឹកប្រាក់ ${trx.currency === "USD" ? "$" : "៛"}${Math.abs(trx.amount).toLocaleString()} ត្រូវបានអនុម័តជោគជ័យ។ (លេខយោង: ${refId})`,
        date: getFormattedDate(),
        type: "payment_approved", // 🔔 Icon បៃតងសម្រាប់ការអនុម័តប្រតិបត្តិការ
        isRead: false,
      });
    }

    await logAdminAction(
      await getAdminFullDisplayName(req.admin),
      "Approve Transaction",
      u ? String(u._id) : "Unknown",
      `Approved Trx ID: ${refId}`,
    );
    return res.json({ success: true, message: "ប្រតិបត្តិការត្រូវបានអនុម័ត!" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * 🔹 ៧.៤ ម៉ាស៊ីនបង្វិលប្រាក់សកលដោយ Admin តាម `_id` (Universal Admin Refund Engine)
 */
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

  if (fallbackCurrency === "KHR" && userDoc.mainAccounts?.KHR) {
    if (
      deltaAmount < 0 &&
      (userDoc.mainAccounts.KHR.balance || 0) < Math.abs(deltaAmount)
    ) {
      return {
        ok: false,
        message: `សមតុល្យ KHR របស់ "${getDisplayName(userDoc)}" មិនគ្រប់គ្រាន់ទេ!`,
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
        message: `សមតុល្យ USD របស់ "${getDisplayName(userDoc)}" មិនគ្រប់គ្រាន់ទេ!`,
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

    const senderTrx = trxs.find((t) => t.amount < 0) || trxs[0];
    const receiverTrx = trxs.find((t) => t.amount > 0) || trxs[0];

    const senderAccNum = senderTrx.senderAcc;
    const receiverAccNum = receiverTrx.receiverAcc;

    // 🎯 ចាប់យកអ្នកផ្ញើតាម `senderTrx.userId` (_id) មុនគេបង្អស់!
    let senderUser = null;
    if (
      senderTrx.amount < 0 &&
      senderTrx.userId &&
      mongoose.isValidObjectId(senderTrx.userId)
    ) {
      senderUser = await User.findById(senderTrx.userId);
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

    // 🎯 ចាប់យកអ្នកទទួលតាម `shop.ownerId` ឬ `receiverTrx.userId` (_id) មុនគេបង្អស់!
    let receiverUser = null;
    if (shop && shop.ownerId) {
      receiverUser = await User.findById(shop.ownerId);
    }
    if (
      !receiverUser &&
      receiverTrx.amount > 0 &&
      receiverTrx.userId &&
      mongoose.isValidObjectId(receiverTrx.userId)
    ) {
      receiverUser = await User.findById(receiverTrx.userId);
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

    const receiverCurrency = receiverTrx.currency || "USD";
    const senderCurrency = senderTrx.currency || receiverCurrency;

    const deductFromReceiverAmt = Math.abs(Number(receiverTrx.amount));
    const creditToSenderAmt = Math.abs(Number(senderTrx.amount));

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

    const creditRes = await adjustAccountByNumber(
      senderUser,
      senderAccNum,
      creditToSenderAmt,
      senderCurrency,
    );

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
    const shopOrReceiverName = shop ? shop.name : getDisplayName(receiverUser);
    const customerDisplayName = getDisplayName(senderUser);
    const adminDisplayName = await getAdminFullDisplayName(req.admin);

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
      remark: `បង្វិលប្រាក់ដោយធនាគារ (Ref: ${cleanRefId}) - ${reason}`,
      status: "Success",
      trxMethod: "Admin Refund",
    });

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
      remark: `កាត់បង្វិលប្រាក់ជូនអតិថិជនដោយធនាគារ (Ref: ${cleanRefId}) - ${reason}`,
      status: "Success",
      trxMethod: "Admin Refund",
    });

    const senderSym =
      (creditRes.currency || senderCurrency) === "KHR" ? "៛" : "$";
    const receiverSym =
      (deductRes.currency || receiverCurrency) === "KHR" ? "៛" : "$";

    await Notification.create([
      {
        userId: senderUser._id,
        username: senderUser.username,
        title: "ប្រាក់ត្រូវបានបង្វិលត្រឡប់ (Refunded) ↩️",
        message: `ជូនចំពោះ ${customerDisplayName}៖ ទឹកប្រាក់ ${senderSym}${creditToSenderAmt.toLocaleString()} ពីប្រតិបត្តិការ #${cleanRefId} ត្រូវបានបង្វិលចូលគណនី (#${creditRes.accountNumber}) របស់អ្នកវិញ។ មូលហេតុ៖ ${reason}`,
        date: dateNow,
        type: "refund_receive", // 🔔 Icon សម្រាប់ទទួលប្រាក់បង្វិល
        isRead: false,
      },
      {
        userId: receiverUser._id,
        username: receiverUser.username,
        title: "កាត់ប្រាក់បង្វិលសងអតិថិជន (Refund Deducted) ⚠️",
        message: `ជូនចំពោះ ${getDisplayName(receiverUser)}៖ ទឹកប្រាក់ ${receiverSym}${deductFromReceiverAmt.toLocaleString()} នៃប្រតិបត្តិការ #${cleanRefId} ត្រូវបានដកចេញពីគណនី (#${deductRes.accountNumber}) ដើម្បីបង្វិលជូនអតិថិជន (${customerDisplayName}) វិញ។ មូលហេតុ៖ ${reason}`,
        date: dateNow,
        type: "refund_deduct", // 🔔 Icon សម្រាប់កាត់ប្រាក់បង្វិល
        isRead: false,
      },
    ]);

    if (global.io) {
      global.io.to(senderUser.username).emit("transactionUpdated");
      global.io.to(receiverUser.username).emit("transactionUpdated");
    }

    await logAdminAction(
      adminDisplayName,
      "Refund Transaction",
      `${receiverUser._id} -> ${senderUser._id}`,
      `Refunded ${receiverSym}${deductFromReceiverAmt} (Ref: ${cleanRefId}) from "${shopOrReceiverName}" to "${customerDisplayName}". Reason: ${reason}`,
    );

    return res.json({
      success: true,
      message: `បង្វិលប្រាក់ពី "${shopOrReceiverName}" ទៅកាន់គណនី (#${creditRes.accountNumber}) របស់ "${customerDisplayName}" បានជោគជ័យ ១០០%!`,
    });
  } catch (err) {
    console.error("Admin Refund Error:", err);
    res
      .status(500)
      .json({ success: false, message: "Server Error: " + err.message });
  }
};

/**
 * 🔹 ៧.៥ ដោះ Hold ប្រតិបត្តិការហាងទំនិញ (Release Merchant Escrow Hold -> Success)
 */
const releaseMerchantHold = async (req, res) => {
  const access = await checkAdminAccess(req.admin, "approveTransaction");
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

    trx.status = "Success";
    await trx.save();

    await Transaction.updateMany(
      { $or: [{ refId: cleanRefId }, { hash: cleanRefId }], status: "Hold" },
      { $set: { status: "Success" } },
    );

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

    const u = trx.userId
      ? await User.findById(trx.userId)
      : await User.findOne({ username: trx.username });
    if (u) {
      const curSym = trx.currency === "KHR" ? "៛" : "$";
      await Notification.create({
        userId: u._id,
        username: u.username,
        title: "ការទូទាត់ត្រូវបានអនុម័ត (Payment Released) ✅",
        message: `ជូនចំពោះ ${getDisplayName(u)}៖ ការទូទាត់ទឹកប្រាក់ ${curSym}${Math.abs(trx.amount).toLocaleString()} ត្រូវបានអនុម័ត និងទម្លាក់ចូលហាងជោគជ័យ។ (លេខយោង: ${cleanRefId})`,
        date: getFormattedDate(),
        type: "merchant_release", // 🔔 Icon សម្រាប់ដោះ Hold ហាងទំនិញ
        isRead: false,
      });
    }

    await logAdminAction(
      await getAdminFullDisplayName(req.admin),
      "Release Merchant Hold",
      u ? String(u._id) : "Merchant",
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

/**
 * 🔹 ៧.៦ ទាញយកវិក្កយបត្រសាធារណៈពេលស្កេន QR លើក្រដាសវិក្កយបត្រ (getPublicReceipt by `_id`)
 */
const getPublicReceipt = async (req, res) => {
  try {
    const { id } = req.params;

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
          ? getDisplayName(adminMaker)
          : ticketObj.maker;
      }

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

          ticketObj.slipData.newBalance = currentBal;
          ticketObj.slipData.priorBalance =
            ticketObj.requestType === "Deposit"
              ? currentBal - ticketObj.amount
              : currentBal + ticketObj.amount;
        }
      }

      return res.json({ success: true, data: ticketObj, source: "ticket" });
    }

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
          ? getDisplayName(adminMaker)
          : originalTicket.maker;
        if (originalTicket.slipData) {
          finalData.slipData = originalTicket.slipData;
        }
      } else {
        finalData.maker = "System";
      }

      if (!finalData.slipData) finalData.slipData = {};
      if (finalData.slipData.priorBalance === undefined) {
        const targetUser = finalData.userId
          ? await User.findById(finalData.userId)
          : await User.findOne({
              $or: [
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
          finalData.slipData.customerName = getDisplayName(targetUser);
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

// ============================================================================
// 🛍️ ជំពូកទី ៨៖ ប្រព័ន្ធបញ្ជរគិតប្រាក់ និងការអនុម័ត (CASHIER MAKER-CHECKER BY `_id`)
// ============================================================================

/**
 * 🔹 ៨.១ ស្វែងរកអតិថិជននៅបញ្ជរគិតប្រាក់តាម `_id` ឬលេខគណនី
 */
const searchCashierUser = async (req, res) => {
  try {
    const { identifier } = req.params;
    const user = await resolveCustomerById(identifier, "-password -pin");

    if (!user) {
      return res.json({
        success: false,
        message: "រកមិនឃើញគណនីដែលមានលេខកុង ឬអត្តសញ្ញាណនេះទេ!",
      });
    }

    let userDetails = user.toObject();
    userDetails._id = String(user._id);
    userDetails.id = String(user._id);
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

/**
 * 🔹 ៨.២ អនុគមន៍អនុវត្តប្រតិបត្តិការដាក់/ដកសាច់ប្រាក់ពិតប្រាកដនៅបញ្ជរ (ប្រើ `_id` & `fullName`)
 */
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
    else if (subIndex !== -1) {
      targetUser.subAccounts[subIndex].balance += finalUserMod;
      targetUser.markModified("subAccounts");
    }

    if (isInputKHR)
      centralBank.mainAccounts.KHR.balance =
        (centralBank.mainAccounts.KHR.balance || 0) + finalBankMod;
    else
      centralBank.mainAccounts.USD.balance =
        (centralBank.mainAccounts.USD.balance || 0) + finalBankMod;

    targetUser.markModified("mainAccounts");
    centralBank.markModified("mainAccounts");
    await targetUser.save();
    await centralBank.save();
  }

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
  const customerFullName = getDisplayName(targetUser);

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
    senderName: requestType === "Deposit" ? "Cash Deposit" : customerFullName,
    senderAcc: requestType === "Deposit" ? "" : actualReceiverAcc,
    receiverName: requestType === "Deposit" ? customerFullName : "Cash Deposit",
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
      ? `ជូនចំពោះ ${customerFullName}៖ ទឹកប្រាក់ ${formattedAmount} ត្រូវបានដាក់បញ្ចូលទៅក្នុងគណនី (#${actualReceiverAcc}) របស់អ្នកដោយជោគជ័យ តាមរយៈបញ្ជរធនាគារ។ [អ្នកដាក់ប្រាក់៖ ${depositorName}]`
      : `ជូនចំពោះ ${customerFullName}៖ ទឹកប្រាក់ ${formattedAmount} ត្រូវបានដកចេញពីគណនី (#${actualReceiverAcc}) របស់អ្នកដោយជោគជ័យ តាមរយៈបញ្ជរធនាគារ។ [អ្នកដកប្រាក់៖ ${depositorName}]`;

  let cleanRemark = remark ? remark.trim() : "";
  if (cleanRemark.includes(" | ")) cleanRemark = cleanRemark.split(" | ")[0];
  if (cleanRemark && cleanRemark !== "") notifMsg += `\nចំណាំ៖ ${cleanRemark}`;

  await Notification.create({
    userId: targetUser._id,
    username: targetUser.username,
    title:
      requestType === "Deposit"
        ? "ទទួលបានប្រាក់ដាក់បញ្ចូល (Deposit Received) ✅"
        : "ដកប្រាក់តាមបញ្ជរជោគជ័យ (Cash Withdrawal) 🔻",
    message: notifMsg,
    date: dateStr,
    type: requestType === "Deposit" ? "deposit" : "deduction", // 🔔 Icon តាមប្រភេទដាក់/ដកប្រាក់
    isRead: false,
    metadata: { refId: refId, sender: "បញ្ជរធនាគារ U-Pay" },
  });

  return { success: true, transactionId: refId };
};

/**
 * 🔹 ៨.៣ បង្កើតសំបុត្រដាក់/ដកប្រាក់នៅបញ្ជរដោយ Maker (createCashierTicket by `_id`)
 */
const createCashierTicket = async (req, res) => {
  const {
    targetUserId,
    _id,
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
    const targetUser = await resolveCustomerById(
      targetUserId || _id || targetUsername,
    );
    if (!targetUser)
      return res.json({ success: false, message: "រកមិនឃើញអតិថិជននេះទេ!" });

    const cashAmount = parseFloat(amount);
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

    let finalReceiveAmount = cashAmount;
    const currentFXRates = readFXRates();
    if (currency === "USD" && targetCurrency === "KHR") {
      finalReceiveAmount = cashAmount * currentFXRates.usdToKhrBuy;
    } else if (currency === "KHR" && targetCurrency === "USD") {
      finalReceiveAmount = cashAmount / currentFXRates.usdToKhrSell;
    }

    if (requestType === "Withdrawal" && currentBal < finalReceiveAmount) {
      return res.json({
        success: false,
        message: `ប្រតិបត្តិការបរាជ័យ! លុយក្នុងគណនី (${targetAccount}) មិនគ្រប់គ្រាន់ទេ!`,
      });
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
        customerName: getDisplayName(targetUser),
        depositorAccount: depositorAccount || "N/A",
        priorBalance: priorBalance,
        newBalance: newBalance,
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
      await getAdminFullDisplayName(req.admin),
      "Create Cashier Ticket",
      String(targetUser._id),
      `Type: ${requestType}, Amount: ${cashAmount} ${currency} for "${getDisplayName(targetUser)}"`,
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

/**
 * 🔹 ៨.៤ ទាញយកបញ្ជីសំបុត្របញ្ជរទាំងអស់ និងការអនុម័ត/បដិសេធដោយ Checker តាម `_id`
 */
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

const actionCashierTicket = async (req, res) => {
  const { ticketId, action, reason } = req.body;
  try {
    const ticket = await CashierTicket.findById(ticketId);
    if (!ticket)
      return res.json({ success: false, message: "រកមិនឃើញសំបុត្រនេះទេ!" });
    if (ticket.maker === req.admin.username) {
      return res.json({
        success: false,
        message: "អ្នកមិនអាចអនុម័តប្រតិបត្តិការដែលខ្លួនឯងបញ្ចូលបានទេ!",
      });
    }

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
          title: "សំណើដកប្រាក់ត្រូវបានបដិសេធ (Withdrawal Rejected) ❌",
          message: `ជូនចំពោះ ${getDisplayName(targetUser)}៖ សំណើដកប្រាក់ចំនួន ${curSymbol}${ticket.amount.toLocaleString()} ត្រូវបានបដិសេធ។ ទឹកប្រាក់ត្រូវបានបង្វិលចូលគណនីរបស់អ្នកវិញរួចរាល់។ មូលហេតុ៖ ${reason}`,
          date: dateStr,
          type: "withdrawal_rejected", // 🔔 Icon ក្រហមសម្រាប់បដិសេធការដកប្រាក់
          isRead: false,
          metadata: { sender: await getAdminFullDisplayName(req.admin) },
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

// ============================================================================
// 💳 ជំពូកទី ៩៖ ការគ្រប់គ្រងកាតនិម្មិត, កាត NFC និងហាងទំនិញ (CARDS & MERCHANTS BY `_id`)
// ============================================================================

/**
 * 🔹 ៩.១ អនុគមន៍ជំនួយស្វែងរកគណនីរបស់អតិថិជន (Main, Sub, ឬ Joint) និងស្វែងរកកាតតាម `_id`
 */
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

async function findCardByAdminIdentifier(cardId, userIdentifier = null) {
  if (!cardId) return null;
  const cleanCardId = String(cardId).trim();
  const cardConds = [{ id: cleanCardId }];
  if (mongoose.isValidObjectId(cleanCardId)) {
    cardConds.unshift({ _id: cleanCardId });
  }

  if (userIdentifier) {
    const userDoc = await resolveCustomerById(userIdentifier, "_id");
    if (userDoc) {
      const found = await Card.findOne({
        $and: [{ $or: cardConds }, { userId: userDoc._id }],
      });
      if (found) return found;
    }
  }

  return await Card.findOne({ $or: cardConds });
}

/**
 * 🔹 ៩.២ ទាញយកកាតទាំងអស់ក្នុងប្រព័ន្ធ (រួមទាំង Auto-Migrate កាតចាស់ៗឱ្យភ្ជាប់ `userId: _id` សុទ្ធ)
 */
const adminGetAllCards = async (req, res) => {
  try {
    const rawUsersWithOldCards = await User.collection
      .find({ "virtualCards.0": { $exists: true } })
      .toArray();

    if (rawUsersWithOldCards.length > 0) {
      for (const rawU of rawUsersWithOldCards) {
        if (Array.isArray(rawU.virtualCards)) {
          for (let i = 0; i < rawU.virtualCards.length; i++) {
            const oldC = rawU.virtualCards[i];
            if (!oldC || !oldC.number) continue;

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
                userCustomId: rawU._id.toString(),
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
        await User.collection.updateOne(
          { _id: rawU._id },
          { $unset: { virtualCards: "" } },
        );
      }
    }

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
 * 🔹 ៩.៣ បង្កើតកាតថ្មីឱ្យអតិថិជនតាម `_id` (គាំទ្រទាំង Virtual, Debit, និង Credit)
 */
const adminCreateCard = async (req, res) => {
  const {
    _id,
    userId,
    username,
    cardCategory = "virtual",
    cardType,
    customBgUrl,
    linkedAccount,
    creditLimit,
    deliveryMethod,
    deliveryAddress,
    remark,
  } = req.body;

  try {
    const user = await resolveCustomerById(_id || userId || username);
    if (!user) return res.json({ success: false, message: "រកគណនីមិនឃើញទេ!" });

    const existingCount = await Card.countDocuments({ userId: user._id });
    if (existingCount >= 10) {
      return res.json({
        success: false,
        message: "អតិថិជននេះមានកាតគ្រប់ ១០ សន្លឹកហើយ!",
      });
    }

    const cleanCategory = ["virtual", "debit", "credit"].includes(cardCategory)
      ? cardCategory
      : "virtual";

    let finalCardType = cardType || "standard";
    if (
      cleanCategory === "virtual" &&
      finalCardType !== "standard" &&
      finalCardType !== "metal"
    ) {
      finalCardType = "standard";
    }

    const targetAcc = await resolveAdminUserAccount(user, linkedAccount);
    if (!targetAcc || !targetAcc.accObj) {
      return res.json({
        success: false,
        message: "រកមិនឃើញគណនីដែលចង់ភ្ជាប់ជាមួយកាតទេ!",
      });
    }

    const tier = cardTiersConfig[finalCardType] || cardTiersConfig["standard"];
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
    const isPhysicalCard =
      cleanCategory === "debit" || cleanCategory === "credit";
    const approvedCreditLimit =
      cleanCategory === "credit"
        ? Math.min(10000, Math.max(100, parseFloat(creditLimit) || 1000))
        : 0;

    const dueD = new Date();
    dueD.setDate(dueD.getDate() + 30);
    const billingDueStr = dueD.toISOString().split("T")[0];

    await Card.create({
      userId: user._id,
      username: user.username,
      userCustomId: String(user._id),
      id: newCardId,
      cardCategory: cleanCategory,
      type: finalCardType,
      name: tier.name,
      number: details.number,
      cvv: details.cvv,
      expiry: details.expiry,
      linkedAccount:
        cleanCategory === "credit" ? "CREDIT_LINE" : targetAcc.accountNumber,
      currency: cleanCategory === "credit" ? "USD" : targetAcc.currency,
      creditLimit: approvedCreditLimit,
      currentDebt: 0.0,
      billingDueDate: cleanCategory === "credit" ? billingDueStr : "",
      isLocked: false,
      isOnlinePayEnabled: true,
      dailyLimit: cleanCategory === "credit" ? approvedCreditLimit : 500,
      dailyTxCountLimit: 10,
      pin: "0000",
      uid: null,
      isPhysical: isPhysicalCard,
      deliveryStatus: isPhysicalCard ? "Requested" : "None",
      deliveryMethod: isPhysicalCard
        ? deliveryMethod || "Branch Pickup"
        : "None",
      deliveryPhone: isPhysicalCard ? user.phone || "" : "",
      deliveryAddress: isPhysicalCard ? deliveryAddress || "Branch Pickup" : "",
      deliveryUpdatedAt: isPhysicalCard ? dateStr : "",
      customBgUrl: finalCardType === "custom" ? customBgUrl : "",
      orderIndex: existingCount,
    });

    const catDisplayLabel =
      cleanCategory === "credit"
        ? "Credit Card"
        : cleanCategory === "debit"
          ? "Physical Debit Card"
          : "Virtual Card";
    const customerFullName = getDisplayName(user);
    const adminDisplayName = await getAdminFullDisplayName(req.admin);

    await Transaction.create({
      userId: user._id,
      username: user.username,
      refId,
      hash: trxHash,
      date: dateStr,
      type: "Card Issuance Fee",
      amount: -feeInAccCurrency,
      currency: targetAcc.currency,
      senderName: customerFullName,
      senderAcc: targetAcc.accountNumber,
      receiverName: "សេវាបង្កើតកាត U-Pay",
      receiverAcc: "888000999",
      cardId: newCardId,
      cardNumber: details.number,
      status: "Success",
      remark: `បង្កើតកាត ${tier.name} (${catDisplayLabel}) ដោយ ${adminDisplayName}`,
    });

    await Transaction.create({
      userId: superAdmin?._id,
      username: superAdmin ? superAdmin.username : "superadmin",
      refId,
      hash: trxHash,
      date: dateStr,
      type: "System Income",
      amount: issuanceFeeUSD,
      currency: "USD",
      senderName: customerFullName,
      receiverName: "Central Bank Fee Income",
      senderAcc: targetAcc.accountNumber,
      receiverAcc: "888000999",
      status: "Success",
      remark: `${catDisplayLabel} Issuance Fee`,
    });

    await Notification.create({
      userId: user._id,
      username: user.username,
      title: `បង្កើតកាតថ្មីជោគជ័យ (${tier.name}) 💳`,
      message: `ជូនចំពោះ ${customerFullName}៖ កាត ${tier.name} (${catDisplayLabel}) របស់អ្នកត្រូវបានបង្កើតដោយជោគជ័យ និងភ្ជាប់ជាមួយគណនី #${targetAcc.accountNumber}។`,
      date: dateStr,
      type: "card_update", // 🔔 Icon កាតធនាគារ
      isRead: false,
    });

    await logAdminAction(
      adminDisplayName,
      `Create ${catDisplayLabel}`,
      String(user._id),
      `បង្កើតកាត ${tier.name} (${details.number.slice(-4)}) ជូន "${customerFullName}"។ មូលហេតុ: ${remark || "គ្មាន"}`,
    );

    res.json({ success: true, message: "បង្កើតកាតបានជោគជ័យ!" });
  } catch (err) {
    console.error("Admin Create Card Error:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * 🔹 ៩.៤ លុបកាត, បិទ/បើកកាត, កំណត់ Limit, ប្តូរឈ្មោះ និងប្តូរគណនីភ្ជាប់កាតតាម `_id`
 */
const adminDeleteCard = async (req, res) => {
  const { _id, userId, username, cardId, reason } = req.body;
  try {
    const card = await findCardByAdminIdentifier(
      cardId,
      _id || userId || username,
    );
    if (!card)
      return res.json({ success: false, message: "រកកាតនេះមិនឃើញទេ!" });

    await Card.deleteOne({ _id: card._id });

    await logAdminAction(
      await getAdminFullDisplayName(req.admin),
      "Delete Card",
      String(card.userId || username),
      `លុបកាត **** ${card.number.slice(-4)}។ មូលហេតុ: ${reason || "Admin Deleted"}`,
    );

    res.json({ success: true, message: "លុបកាតជោគជ័យ!" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

const toggleAdminCardLock = async (req, res) => {
  const { _id, userId, username, cardId, isLocked } = req.body;
  try {
    const card = await findCardByAdminIdentifier(
      cardId,
      _id || userId || username,
    );
    if (!card) return res.json({ success: false, message: "រកកាតមិនឃើញទេ!" });

    card.isLocked = Boolean(isLocked);
    card.lockedByAdmin = Boolean(isLocked);
    await card.save();

    await logAdminAction(
      await getAdminFullDisplayName(req.admin),
      "Toggle Card Lock",
      String(card.userId || username),
      `កាត **** ${card.number.slice(-4)} ត្រូវបាន ${isLocked ? "FROZEN" : "UNFROZEN"}`,
    );

    res.json({
      success: true,
      message: isLocked ? "ផ្អាកកាតជោគជ័យ!" : "បើកកាតជោគជ័យ!",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

const adminUpdateCardLimit = async (req, res) => {
  const {
    _id,
    userId,
    username,
    cardId,
    newCreditLimit,
    newLimit,
    newCountLimit,
  } = req.body;
  try {
    const card = await findCardByAdminIdentifier(
      cardId,
      _id || userId || username,
    );
    if (!card) return res.json({ success: false, message: "រកកាតមិនឃើញទេ!" });

    if (newCreditLimit !== undefined && !isNaN(newCreditLimit)) {
      card.creditLimit = parseFloat(newCreditLimit);
    }
    if (newLimit !== undefined) card.dailyLimit = parseFloat(newLimit);
    if (newCountLimit !== undefined)
      card.dailyTxCountLimit = parseInt(newCountLimit, 10);
    await card.save();

    await logAdminAction(
      await getAdminFullDisplayName(req.admin),
      "Update Card Limit",
      String(card.userId || username),
      `កែ Limit កាត **** ${card.number.slice(-4)} -> Daily: $${newLimit}, Count: ${newCountLimit}`,
    );
    res.json({ success: true, message: "បានកំណត់ Limit កាតជោគជ័យ!" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

const adminToggleCardOnline = async (req, res) => {
  const { _id, userId, username, cardId, isEnabled } = req.body;
  try {
    const card = await findCardByAdminIdentifier(
      cardId,
      _id || userId || username,
    );
    if (!card) return res.json({ success: false, message: "រកកាតមិនឃើញទេ!" });

    card.isOnlinePayEnabled = Boolean(isEnabled);
    await card.save();

    await logAdminAction(
      await getAdminFullDisplayName(req.admin),
      "Toggle Card Online Pay",
      String(card.userId || username),
      `Online Pay សម្រាប់កាត **** ${card.number.slice(-4)} ត្រូវបាន ${isEnabled ? "ON" : "OFF"}`,
    );
    res.json({ success: true, message: "ធ្វើបច្ចុប្បន្នភាពជោគជ័យ!" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

const adminRenameCard = async (req, res) => {
  const { _id, userId, username, cardId, name } = req.body;
  try {
    const card = await findCardByAdminIdentifier(
      cardId,
      _id || userId || username,
    );
    if (!card) return res.json({ success: false, message: "រកកាតមិនឃើញទេ!" });

    const oldName = card.name;
    card.name = String(name || "").toUpperCase();
    await card.save();

    await logAdminAction(
      await getAdminFullDisplayName(req.admin),
      "Rename Card",
      String(card.userId || username),
      `ប្តូរឈ្មោះកាតពី ${oldName || "N/A"} ទៅជា ${card.name}`,
    );
    res.json({ success: true, message: "ប្តូរឈ្មោះកាតជោគជ័យ!" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

const adminChangeCardLinkedAccount = async (req, res) => {
  const { _id, userId, username, cardId, linkedAccount } = req.body;
  try {
    const card = await findCardByAdminIdentifier(
      cardId,
      _id || userId || username,
    );
    if (!card)
      return res.json({ success: false, message: "រកកាតនេះមិនឃើញទេ!" });

    const user =
      (await resolveCustomerById(_id || userId || card.userId || username)) ||
      (await User.findById(card.userId));
    if (!user) return res.json({ success: false, message: "រកគណនីមិនឃើញទេ!" });

    const targetAcc = await resolveAdminUserAccount(user, linkedAccount);
    if (!targetAcc) {
      return res.json({
        success: false,
        message: "រកមិនឃើញគណនីដែលចង់ភ្ជាប់នោះទេ!",
      });
    }

    const oldAcc = card.linkedAccount;
    card.linkedAccount = targetAcc.accountNumber;
    card.currency = targetAcc.currency;
    await card.save();

    await logAdminAction(
      await getAdminFullDisplayName(req.admin),
      "Change Card Account",
      String(user._id),
      `ប្តូរគណនីភ្ជាប់កាត **** ${card.number.slice(-4)} ពី ${oldAcc} ទៅជា ${targetAcc.accountNumber} (${targetAcc.currency})`,
    );
    res.json({ success: true, message: "បានប្តូរគណនីភ្ជាប់ជោគជ័យ!" });
  } catch (err) {
    console.error("Change Card Account Error:", err);
    res
      .status(500)
      .json({ success: false, message: "Server Error: " + err.message });
  }
};

/**
 * 🔹 ៩.៥ ភ្ជាប់/ផ្តាច់បន្ទះឈីប NFC និងកែប្រែស្ថានភាពដឹកជញ្ជូនកាតរូបវ័ន្តតាម `_id`
 */
const adminBindNfcCard = async (req, res) => {
  try {
    const { _id, userId, username, cardId, pin, uid } = req.body;
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

    const targetCard = await findCardByAdminIdentifier(
      cardId,
      _id || userId || username,
    );
    if (!targetCard)
      return res.json({ success: false, message: "រកកាតនេះមិនឃើញទេ!" });

    if (targetCard.cardCategory === "virtual" && !targetCard.isPhysical) {
      return res.json({
        success: false,
        message: "🛑 កាតនិម្មិត (Virtual Card) មិនអាចភ្ជាប់បន្ទះឈីប NFC បានទេ!",
      });
    }

    if (targetCard.uid && targetCard.uid !== "" && targetCard.uid !== null) {
      return res.json({
        success: false,
        message:
          "⚠️ កាតនេះបានភ្ជាប់កាត NFC រួចរាល់ហើយ! សូម 'ផ្តាច់កាត' (Unbind) ចាស់ចេញជាមុនសិន។",
      });
    }

    targetCard.uid = cleanUid;
    targetCard.pin = pin || targetCard.pin || "0000";
    targetCard.isPhysical = true;
    await targetCard.save();

    await logAdminAction(
      await getAdminFullDisplayName(req.admin),
      "Bind NFC Card",
      String(targetCard.userId || username),
      `ភ្ជាប់ NFC (${cleanUid}) ទៅកាត **** ${targetCard.number.slice(-4)}`,
    );

    res.json({ success: true, message: "ភ្ជាប់ជោគជ័យ!" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

const adminUnbindNfcCard = async (req, res) => {
  try {
    const { _id, userId, username, cardId } = req.body;
    const card = await findCardByAdminIdentifier(
      cardId,
      _id || userId || username,
    );

    if (card) {
      const oldUid = card.uid;
      card.uid = null;
      if (card.cardCategory === "virtual") {
        card.isPhysical = false;
      }
      await card.save();

      await logAdminAction(
        await getAdminFullDisplayName(req.admin),
        "Unbind NFC Card",
        String(card.userId || username),
        `ផ្តាច់ NFC (${oldUid}) ចេញពីកាត **** ${card.number.slice(-4)}`,
      );
      return res.json({ success: true, message: "ផ្តាច់កាតជោគជ័យ!" });
    }
    res.json({ success: false, message: "បរាជ័យ" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

const adminUpdatePhysicalCardStatus = async (req, res) => {
  try {
    const {
      _id,
      userId,
      username,
      cardId,
      deliveryStatus,
      deliveryMethod,
      trackingNumber,
      deliveryAddress,
      deliveryPhone,
    } = req.body;

    const card = await findCardByAdminIdentifier(
      cardId,
      _id || userId || username,
    );
    if (!card) {
      return res.json({ success: false, message: "រកមិនឃើញកាតនេះទេ!" });
    }

    const nowStr =
      typeof getFormattedDate === "function"
        ? getFormattedDate()
        : new Date().toLocaleString("en-US", { timeZone: "Asia/Phnom_Penh" });

    card.isPhysical = true;
    if (deliveryStatus)
      card.set("deliveryStatus", deliveryStatus, { strict: false });
    if (deliveryMethod !== undefined)
      card.set("deliveryMethod", deliveryMethod, { strict: false });
    if (trackingNumber !== undefined)
      card.set("trackingNumber", trackingNumber, { strict: false });
    if (deliveryAddress !== undefined)
      card.set("deliveryAddress", deliveryAddress, { strict: false });
    if (deliveryPhone !== undefined)
      card.set("deliveryPhone", deliveryPhone, { strict: false });
    card.set("deliveryUpdatedAt", nowStr, { strict: false });

    await card.save();

    const user =
      (card.userId && (await User.findById(card.userId))) ||
      (await resolveCustomerById(_id || userId || username));

    if (user) {
      const custFullName = getDisplayName(user);
      const statusLabels = {
        Requested: "សំណើផលិតកាតរូបវ័ន្តត្រូវបានទទួល 📝",
        Printing: "កាតរូបវ័ន្តរបស់អ្នកកំពុងស្ថិតក្នុងដំណាក់កាលបោះពុម្ព 🖨️",
        Shipped: `កាតរូបវ័ន្តកំពុងដឹកជញ្ជូនតាម ${deliveryMethod || "សេវាដឹកជញ្ជូន"} ${trackingNumber ? `(លេខតាមដាន: #${trackingNumber})` : ""} 🚚`,
        Delivered:
          "កាតរូបវ័ន្តត្រូវបានប្រគល់ជូនដោយជោគជ័យ 📦 សូមពិនិត្យមើលលេខ ៤ ខ្ទង់ចុងក្រោយលើកាតពិត ដើម្បីបើកដំណើរការក្នុងកម្មវិធី!",
        Activated: `កាតរូបវ័ន្ត (**** ${card.number.slice(-4)}) និង NFC ត្រូវបានបើកដំណើរការពេញលេញ 🟢`,
      };

      await Notification.create({
        userId: user._id,
        username: user.username,
        title: `💳 ស្ថានភាពកាតរូបវ័ន្ត (${card.name || card.type.toUpperCase()})`,
        message: `ជូនចំពោះ ${custFullName}៖ ${statusLabels[deliveryStatus] || `ស្ថានភាពកាត: ${deliveryStatus}`}`,
        date: nowStr,
        type: "card_update", // 🔔 Icon កាតធនាគារ
        isRead: false,
      });
    }

    await logAdminAction(
      await getAdminFullDisplayName(req.admin),
      "Update Physical Card Delivery",
      String(card.userId || username),
      `Card **** ${card.number.slice(-4)} -> Status: ${deliveryStatus}`,
    );

    res.json({
      success: true,
      message: "ធ្វើបច្ចុប្បន្នភាពស្ថានភាពកាតរូបវ័ន្តជោគជ័យ!",
    });
  } catch (err) {
    console.error("Update Physical Card Error:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

const adminUpdatePhysicalCardPin = async (req, res) => {
  try {
    const { _id, userId, username, cardId, newPin } = req.body;
    if (!/^\d{4}$/.test(String(newPin || ""))) {
      return res.json({
        success: false,
        message: "លេខកូដ PIN កាតត្រូវតែជាលេខ ៤ ខ្ទង់គត់!",
      });
    }

    const card = await findCardByAdminIdentifier(
      cardId,
      _id || userId || username,
    );
    if (!card) {
      return res.json({ success: false, message: "រកមិនឃើញកាតនេះទេ!" });
    }

    card.pin = String(newPin);
    await card.save();

    await logAdminAction(
      await getAdminFullDisplayName(req.admin),
      "Reset Physical Card PIN",
      String(card.userId || username),
      `កំណត់លេខកូដ POS PIN ថ្មីសម្រាប់កាត **** ${card.number.slice(-4)}`,
    );

    res.json({
      success: true,
      message: "បានកំណត់លេខកូដ POS PIN ៤ ខ្ទង់ថ្មីជោគជ័យ!",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * 🔹 ៩.៦ ការគ្រប់គ្រងហាងទំនិញដោយ Admin តាម `_id` (Create, Get by User `_id`, Edit, Freeze, Delete)
 */
const adminCreateMerchant = async (req, res) => {
  const {
    _id,
    userId,
    username,
    name,
    city,
    category,
    linkedAccUSD,
    linkedAccKHR,
  } = req.body;
  try {
    const user = await resolveCustomerById(_id || userId || username);
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
    const apiKey = "upay_live_" + crypto.randomBytes(16).toString("hex");
    const apiSecret = crypto.randomBytes(32).toString("hex");

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
      userCustomId: String(user._id),
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
      message: `ជូនចំពោះ ${getDisplayName(user)}៖ សាខាហាង "${name}" ត្រូវបានបង្កើតដោយជោគជ័យ និងរួចរាល់សម្រាប់ទទួលប្រាក់។`,
      type: "merchant_alert", // 🔔 Icon ហាងទំនិញ
      date: getFormattedDate(),
      isRead: false,
    });

    await logAdminAction(
      await getAdminFullDisplayName(req.admin),
      "Create Merchant",
      String(user._id),
      `Created merchant shop "${name}" (MID: ${merchantId}) for "${getDisplayName(user)}"`,
    );

    res.status(201).json({ success: true, merchant: savedMerchant });
  } catch (error) {
    console.error("ADMIN CREATE MERCHANT ERROR:", error);
    res
      .status(500)
      .json({ success: false, message: "Server Error: " + error.message });
  }
};

const adminGetMerchantsByUser = async (req, res) => {
  try {
    const identifier = req.params.id || req.params.username;
    const user = await resolveCustomerById(identifier, "_id username");
    if (!user) {
      return res.json({ success: true, merchants: [] });
    }

    // 🎯 ទាញយកហាងទំនិញតាម `ownerId: user._id` តែមួយគត់!
    const merchants = await Merchant.find({ ownerId: user._id });
    res.json({ success: true, merchants });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

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

    const user =
      (merchantToUpdate.ownerId &&
        (await User.findById(merchantToUpdate.ownerId))) ||
      (await resolveCustomerById(
        username || merchantToUpdate.username || merchantToUpdate.userId,
      ));
    if (!user)
      return res.json({ success: false, message: "រកម្ចាស់ហាងមិនឃើញទេ!" });

    let linkedAccountsObj = { USD: null, KHR: null };
    let accountNumbersObj = {
      USD: merchantToUpdate.accountNumbers?.USD || null,
      KHR: merchantToUpdate.accountNumbers?.KHR || null,
    };

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
        accountNumbersObj.USD = null;
      }

      if (linkedAccKHR) {
        linkedAccountsObj.KHR = linkedAccKHR;
        if (!accountNumbersObj.KHR) {
          accountNumbersObj.KHR =
            "999" +
            Math.floor(100000000 + Math.random() * 900000000).toString();
        }
      } else {
        accountNumbersObj.KHR = null;
      }
    } else if (linkedAccount) {
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

    merchantToUpdate.ownerId = user._id;
    merchantToUpdate.username = user.username;
    merchantToUpdate.userCustomId = String(user._id);
    merchantToUpdate.linkedAccounts = linkedAccountsObj;
    merchantToUpdate.accountNumbers = accountNumbersObj;

    merchantToUpdate.markModified("linkedAccounts");
    merchantToUpdate.markModified("accountNumbers");
    await merchantToUpdate.save();

    await logAdminAction(
      await getAdminFullDisplayName(req.admin),
      "Edit Merchant",
      String(user._id),
      `Updated merchant shop: ${merchantToUpdate.name} for "${getDisplayName(user)}"`,
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

const adminToggleMerchantFreeze = async (req, res) => {
  try {
    const { id, isFrozen } = req.body;
    const status = isFrozen ? "Suspended" : "Active";
    const m = await Merchant.findByIdAndUpdate(id, { status: status });
    if (m) {
      await logAdminAction(
        await getAdminFullDisplayName(req.admin),
        "Toggle Merchant Freeze",
        String(m.ownerId || m.userId),
        `Merchant ${m.name} set to ${status}`,
      );
    }
    res.json({ success: true, message: "Status updated successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const adminDeleteMerchant = async (req, res) => {
  try {
    const m = await Merchant.findById(req.params.id);
    if (!m) return res.json({ success: false, message: "រកមិនឃើញហាង" });

    await Merchant.findByIdAndDelete(req.params.id);

    const owner =
      (m.ownerId && (await User.findById(m.ownerId))) ||
      (await User.findOne({ username: m.userId }));
    if (owner) {
      await Notification.create({
        userId: owner._id,
        username: owner.username,
        title: "សាខាហាងត្រូវបានលុប! ❌",
        message: `ជូនចំពោះ ${getDisplayName(owner)}៖ ហាង "${m.name}" របស់អ្នកត្រូវបានលុបចេញពីប្រព័ន្ធ U-Pay ដោយផ្នែកគ្រប់គ្រងធនាគារ។`,
        type: "merchant_alert", // 🔔 Icon ហាងទំនិញ
        date: getFormattedDate(),
        isRead: false,
      });
    }

    await logAdminAction(
      await getAdminFullDisplayName(req.admin),
      "Delete Merchant",
      owner ? String(owner._id) : m.userId,
      `Deleted merchant shop: ${m.name}`,
    );
    res.json({ success: true, message: "Merchant deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================================
// 📢 ជំពូកទី ១០៖ ប្រូម៉ូសិន, បញ្ជូនសារ, សំណើជំនួយ និង LIVE SUPPORT CHAT (BY `_id` & `fullName`)
// ============================================================================

/**
 * 🔹 ១០.១ គ្រប់គ្រងកូដប្រូម៉ូសិន (Promo Codes)
 */
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
      maxUsage: parseInt(maxUsage, 10) || 100,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    });
    await newPromo.save();

    await logAdminAction(
      await getAdminFullDisplayName(req.admin),
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

/**
 * 🔹 ១០.២ បញ្ជូនសារជូនដំណឹងរួម (Broadcast) និងសារផ្ទាល់ខ្លួន (Direct Message) ដោយប្រើ `fullName` & Icon ច្បាស់លាស់
 */
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
    const adminDisplayName = await getAdminFullDisplayName(req.admin);
    const users = await User.find({ role: { $ne: "admin" } }).select(
      "_id username fullName",
    );

    if (users.length > 0) {
      const dateStr = getFormattedDate();
      const bcId = "BC-" + Date.now();
      const broadcastNotifs = users.map((u) => ({
        userId: u._id,
        username: u.username,
        title: title,
        message: message,
        type: "broadcast", // 🔔 Icon ឧឃោសនស័ព្ទសម្រាប់សារ Broadcast
        date: dateStr,
        isRead: false,
        metadata: {
          sender: sender || adminDisplayName,
          broadcastId: bcId,
        },
      }));
      await Notification.insertMany(broadcastNotifs);
    }

    await logAdminAction(
      adminDisplayName,
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
      await getAdminFullDisplayName(req.admin),
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
    const { _id, userId, username, message } = req.body;
    const user = await resolveCustomerById(_id || userId || username);
    if (!user) {
      return res.json({ success: false, message: "រកមិនឃើញអតិថិជននេះទេ!" });
    }

    const adminDisplayName = await getAdminFullDisplayName(req.admin);
    const custFullName = getDisplayName(user);
    const dateStr =
      typeof getFormattedDate === "function"
        ? getFormattedDate()
        : new Date().toLocaleString("en-US", {
            timeZone: "Asia/Phnom_Penh",
            hour12: true,
          });

    await Notification.create({
      userId: user._id,
      username: user.username,
      title: "សារផ្លូវការពីធនាគារ (Direct Message) 📩",
      message: `ជូនចំពោះ ${custFullName}៖ ${message}`,
      date: dateStr,
      type: "direct_message", // 🔔 Icon សំបុត្រសម្រាប់សារផ្ទាល់ខ្លួន
      isRead: false,
      metadata: { sender: adminDisplayName },
    });

    await logAdminAction(
      adminDisplayName,
      "Send Direct Message",
      String(user._id),
      `Sent message to "${custFullName}": ${message}`,
    );

    return res.json({ success: true, message: "សារត្រូវបានផ្ញើជោគជ័យ!" });
  } catch (error) {
    console.error("Direct Message Error:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * 🔹 ១០.៣ ការគ្រប់គ្រងសំបុត្រស្នើសុំជំនួយ (Support Tickets by `_id` & `fullName`)
 */
const ticketReply = async (req, res) => {
  const { _id, userId, username, ticketId, replyMessage } = req.body;
  try {
    const u = await resolveCustomerById(_id || userId || username);
    if (u && u.tickets) {
      const t = u.tickets.find(
        (item) =>
          item.ticketId === ticketId || item._id?.toString() === ticketId,
      );
      if (t) {
        const adminDisplayName = await getAdminFullDisplayName(req.admin);
        const custFullName = getDisplayName(u);
        const replyTime =
          typeof getFormattedDate === "function"
            ? getFormattedDate()
            : new Date().toLocaleString();

        t.status = "Answered";
        t.adminReply = replyMessage;
        t.repliedBy = adminDisplayName;
        t.repliedAt = replyTime;

        await Notification.create({
          userId: u._id,
          username: u.username,
          title: `ការឆ្លើយតបសំណើជំនួយ៖ ${t.subject} 💬`,
          message: `ជូនចំពោះ ${custFullName}៖ មន្ត្រីធនាគារ (${adminDisplayName}) បានឆ្លើយតប៖ "${replyMessage}"`,
          date: replyTime,
          type: "support_reply", // 🔔 Icon ឆ្លើយតបសំណើជំនួយ
          isRead: false,
          metadata: {
            sender: adminDisplayName,
            ticketId: t.ticketId,
            subject: t.subject,
          },
        });

        u.markModified("tickets");
        await u.save();

        await logAdminAction(
          adminDisplayName,
          "Reply Ticket",
          String(u._id),
          `Replied to ticket ID: ${ticketId} for "${custFullName}"`,
        );

        res.json({ success: true, repliedBy: adminDisplayName });
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

const getAllSupportTickets = async (req, res) => {
  try {
    const users = await User.find({ "tickets.0": { $exists: true } }).select(
      "_id username fullName phone profileImage tickets",
    );

    let allTickets = [];
    users.forEach((u) => {
      if (Array.isArray(u.tickets)) {
        u.tickets.forEach((t) => {
          const tObj = t.toObject ? t.toObject() : t;
          allTickets.push({
            ...tObj,
            userId: String(u._id),
            username: u.username,
            fullName: getDisplayName(u),
            phone: u.phone || "N/A",
            profileImage: u.profileImage || "../images/default-avatar.png",
            userCustomId: String(u._id),
          });
        });
      }
    });

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

const getUserTickets = async (req, res) => {
  try {
    const identifier = req.params.username || req.params.id;
    const user = await resolveCustomerById(
      identifier,
      "_id tickets username fullName",
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

const adminResolveTicket = async (req, res) => {
  try {
    const { _id, userId, username, ticketId, adminReply, newStatus } = req.body;
    const user = await resolveCustomerById(_id || userId || username);
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
    if (newStatus) ticket.status = newStatus;

    user.markModified("tickets");
    await user.save();

    await logAdminAction(
      await getAdminFullDisplayName(req.admin),
      "Resolve Support Ticket",
      String(user._id),
      `Updated ticket ID: ${ticketId} to status: ${newStatus || ticket.status}`,
    );

    res.json({ success: true, message: "កែប្រែស្ថានភាពសំណូមពរជោគជ័យ!" });
  } catch (err) {
    console.error("Resolve Ticket Error:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * 🔹 ១០.៤ ប្រើប្រាស់តែ MongoDB `_id` របស់អតិថិជនសម្រាប់ភ្ជាប់ប្រអប់សារ Support Chat
 */
const getAdminSupportUserVariants = (u) => {
  if (!u || !u._id) return [];
  return [String(u._id)];
};

const getAdminSupportPrimaryAcc = (u) => {
  if (!u) return "";
  return (
    u.mainAccounts?.USD?.accountNumber ||
    u.mainAccounts?.KHR?.accountNumber ||
    u.username ||
    ""
  );
};

const adminGetSupportQueue = async (req, res) => {
  try {
    const allChats = await Chat.find({
      $or: [
        { senderId: "ADMIN" },
        { receiverId: "ADMIN" },
        { senderAcc: "ADMIN" },
        { receiverAcc: "ADMIN" },
      ],
      isScheduled: { $ne: true },
    })
      .sort({ timestamp: 1 })
      .lean();

    const users = await User.find({ role: { $ne: "admin" } })
      .select(
        "_id username fullName name phone profileImage mainAccounts needsSupport chatStatus chatSentiment isOnline lastActive kycStatus",
      )
      .lean();

    const queueMap = {};

    for (const c of allChats) {
      const sKey = String(c.senderId || c.senderAcc || "");
      const rKey = String(c.receiverId || c.receiverAcc || "");
      const isFromAdmin = sKey === "ADMIN" || sKey === "UPAY_BOT";
      const rawCustomerKey = isFromAdmin ? rKey : sKey;

      if (!rawCustomerKey || rawCustomerKey === "ADMIN") continue;

      const customer = users.find((u) =>
        getAdminSupportUserVariants(u).includes(rawCustomerKey),
      );
      if (!customer) continue;

      const canonicalId = String(customer._id);
      const isBotMsg =
        c.adminName === "UPAY_BOT" || c.adminName === "U-PAY Smart Bot";

      if (!queueMap[canonicalId]) {
        queueMap[canonicalId] = {
          customer,
          lastMsg: c,
          inLiveAgentMode: false,
          hasHumanAgentReply: false,
          unreadFromUser: 0,
        };
      } else {
        queueMap[canonicalId].lastMsg = c;
      }

      const msgTxt = String(c.message || "");

      if (isFromAdmin && msgTxt.includes("ការសន្ទនាត្រូវបានបញ្ចប់")) {
        queueMap[canonicalId].inLiveAgentMode = false;
        queueMap[canonicalId].unreadFromUser = 0;
      } else if (
        isBotMsg &&
        (msgTxt.includes("បានបញ្ជូនសំណើរបស់បងទៅកាន់ភ្នាក់ងារ") ||
          msgTxt.includes("កំពុងភ្ជាប់ទៅកាន់ភ្នាក់ងារ"))
      ) {
        queueMap[canonicalId].inLiveAgentMode = true;
      } else if (isBotMsg) {
        queueMap[canonicalId].inLiveAgentMode = false;
        queueMap[canonicalId].unreadFromUser = 0;
      } else if (isFromAdmin && !isBotMsg) {
        queueMap[canonicalId].inLiveAgentMode = true;
        queueMap[canonicalId].hasHumanAgentReply = true;
      } else if (
        !isFromAdmin &&
        msgTxt
          .toLowerCase()
          .match(/human|ភ្នាក់ងារ|មនុស្ស|ជួបបុគ្គលិក|បុគ្គលិក|live agent/)
      ) {
        queueMap[canonicalId].inLiveAgentMode = true;
      }

      if (!isFromAdmin && !c.isRead && queueMap[canonicalId].inLiveAgentMode) {
        queueMap[canonicalId].unreadFromUser++;
      }
    }

    const contacts = [];
    for (const item of Object.values(queueMap)) {
      const u = item.customer;
      const lastC = item.lastMsg;

      if (!item.inLiveAgentMode && u.needsSupport) {
        await User.updateOne({ _id: u._id }, { $set: { needsSupport: false } });
        u.needsSupport = false;
      }

      const isEscalatedSession = Boolean(
        item.inLiveAgentMode && u.needsSupport,
      );
      const isResolvedHumanSession =
        !isEscalatedSession &&
        u.chatStatus === "resolved" &&
        item.hasHumanAgentReply;

      if (!isEscalatedSession && !isResolvedHumanSession) {
        continue;
      }

      const isReallyOnline = u.lastActive
        ? Date.now() - new Date(u.lastActive).getTime() < 90000
        : false;

      contacts.push({
        partnerId: String(u._id),
        _id: String(u._id),
        accountNumber: getAdminSupportPrimaryAcc(u),
        username: u.username || "",
        name: getDisplayName(u),
        fullName: getDisplayName(u),
        phone: u.phone || "",
        profileImage: u.profileImage || "",
        kycStatus: u.kycStatus || "unverified",
        needsSupport: isEscalatedSession,
        status: isEscalatedSession
          ? u.chatStatus === "urgent"
            ? "urgent"
            : "pending"
          : "resolved",
        sentiment: u.chatSentiment || "neutral",
        lastMessage: lastC.message,
        time: lastC.time,
        timestamp: lastC.timestamp,
        unreadCount: isEscalatedSession ? item.unreadFromUser : 0,
        isOnline: isReallyOnline,
        lastActive: u.lastActive || null,
      });
    }

    contacts.sort((a, b) => b.timestamp - a.timestamp);
    res.json({ success: true, contacts });
  } catch (err) {
    console.error("Admin Get Support Queue Error:", err);
    res.status(500).json({ success: false, contacts: [] });
  }
};

const adminGetChatHistory = async (req, res) => {
  try {
    const { targetIdentifier } = req.body || {};
    const customer = await resolveCustomerById(targetIdentifier);
    if (!customer) {
      return res.json({
        success: false,
        history: [],
        message: "រកមិនឃើញអតិថិជននេះទេ!",
      });
    }

    const custVariants = getAdminSupportUserVariants(customer);
    const canonicalCustId = String(customer._id);

    const unreadMsgs = await Chat.find({
      $or: [
        { senderId: { $in: custVariants }, receiverId: "ADMIN" },
        { senderAcc: { $in: custVariants }, receiverAcc: "ADMIN" },
      ],
      isRead: false,
    });

    if (unreadMsgs.length > 0) {
      for (const m of unreadMsgs) {
        m.isRead = true;
        if (!m.senderId) m.senderId = canonicalCustId;
        if (!m.receiverId) m.receiverId = "ADMIN";
        await m.save();
      }
      if (global.io) {
        global.io.emit("chat_messages_read", {
          readerId: "ADMIN",
          senderId: canonicalCustId,
        });
      }
    }

    const history = await Chat.find({
      $and: [
        {
          $or: [
            { senderId: { $in: custVariants }, receiverId: "ADMIN" },
            { senderId: "ADMIN", receiverId: { $in: custVariants } },
            { senderAcc: { $in: custVariants }, receiverAcc: "ADMIN" },
            { senderAcc: "ADMIN", receiverAcc: { $in: custVariants } },
          ],
        },
        { isScheduled: { $ne: true } },
      ],
    })
      .sort({ timestamp: 1 })
      .lean();

    const isReallyOnline = customer.lastActive
      ? Date.now() - new Date(customer.lastActive).getTime() < 90000
      : false;

    res.json({
      success: true,
      history,
      customerInfo: {
        partnerId: canonicalCustId,
        _id: canonicalCustId,
        accountNumber: getAdminSupportPrimaryAcc(customer),
        username: customer.username,
        fullName: getDisplayName(customer),
        phone: customer.phone || "",
        profileImage: customer.profileImage || "",
        kycStatus: customer.kycStatus || "unverified",
        needsSupport: Boolean(customer.needsSupport),
        status: customer.chatStatus || "pending",
        isOnline: isReallyOnline,
        lastActive: customer.lastActive || null,
      },
    });
  } catch (err) {
    console.error("Admin Get Chat History Error:", err);
    res.status(500).json({ success: false, history: [] });
  }
};

const adminSendSupportMessage = async (req, res) => {
  try {
    const {
      targetIdentifier,
      message,
      imageUrl,
      audioUrl,
      fileUrl,
      fileName,
      fileSize,
    } = req.body || {};

    const customer = await resolveCustomerById(targetIdentifier);
    if (!customer) {
      return res.json({ success: false, message: "រកមិនឃើញគណនីអតិថិជនទេ!" });
    }

    // ទាញយក Username របស់ Admin ជំនួសឱ្យ Full Name ដើម្បីឱ្យខាងភ្ញៀវមើលឃើញ Username
    const adminObj = await Admin.findById(req.admin._id || req.admin.id)
      .select("username")
      .lean();
    const adminUsernameDisplay = adminObj
      ? adminObj.username
      : req.admin.username || "admin";
    const canonicalCustId = String(customer._id);
    const nowTs = Date.now();
    const timeFormatted = new Date(nowTs).toLocaleTimeString("en-US", {
      timeZone: "Asia/Phnom_Penh",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    customer.needsSupport = true;
    if (customer.chatStatus === "resolved") {
      customer.chatStatus = "pending";
    }
    await customer.save();

    const payload = {
      id: "MSG-ADM-" + nowTs + "-" + Math.floor(100 + Math.random() * 899),
      senderId: "ADMIN",
      receiverId: canonicalCustId,
      adminName: adminUsernameDisplay, // 👈 ប្រើ Username របស់ Admin ទីនេះ
      message: String(message || "").trim() || "ឯកសារភ្ជាប់ 📁",
      time: timeFormatted,
      timestamp: nowTs,
      isRead: false,
    };

    if (imageUrl) payload.imageUrl = imageUrl;
    if (audioUrl) payload.audioUrl = audioUrl;
    if (fileUrl) {
      payload.fileUrl = fileUrl;
      if (fileName) payload.fileName = fileName;
      if (fileSize) payload.fileSize = fileSize;
    }

    const newMsg = await Chat.create(payload);

    if (global.io) {
      global.io.emit("new_chat_message", newMsg);
    }

    res.json({
      success: true,
      message: newMsg,
      adminHandle: adminFullName,
    });
  } catch (err) {
    console.error("Admin Send Support Message Error:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

const adminStartSupportSession = async (req, res) => {
  try {
    const { identifier } = req.body || {};
    const customer = await resolveCustomerById(identifier);
    if (!customer) {
      return res.json({
        success: false,
        message: "រកមិនឃើញអតិថិជនដែលមានអត្តសញ្ញាណ ឬលេខគណនីនេះទេ!",
      });
    }

    customer.needsSupport = true;
    customer.chatStatus = "pending";
    await customer.save();

    res.json({
      success: true,
      partnerId: String(customer._id),
      _id: String(customer._id),
      accountNumber: getAdminSupportPrimaryAcc(customer),
      username: customer.username,
      name: getDisplayName(customer),
      profileImage: customer.profileImage || "",
      status: customer.chatStatus,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

const adminUpdateSupportStatus = async (req, res) => {
  try {
    const { targetIdentifier, status } = req.body || {};
    const customer = await resolveCustomerById(targetIdentifier);
    if (!customer) {
      return res.json({ success: false, message: "រកមិនឃើញគណនីអតិថិជនទេ!" });
    }

    customer.chatStatus = status;
    if (status === "resolved") {
      customer.needsSupport = false;
    } else {
      customer.needsSupport = true;
    }
    await customer.save();

    res.json({ success: true, status: customer.chatStatus });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

const adminEndSupportSession = async (req, res) => {
  try {
    const { targetIdentifier } = req.body || {};
    const customer = await resolveCustomerById(targetIdentifier);
    if (!customer) {
      return res.json({ success: false, message: "រកមិនឃើញអតិថិជនទេ!" });
    }

    const adminFullName = await getAdminFullDisplayName(req.admin);
    const canonicalCustId = String(customer._id);
    const nowTs = Date.now();
    const timeFormatted = new Date(nowTs).toLocaleTimeString("en-US", {
      timeZone: "Asia/Phnom_Penh",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    customer.needsSupport = false;
    customer.chatStatus = "resolved";
    await customer.save();

    const endMsg = await Chat.create({
      id: "MSG-END-" + nowTs,
      senderId: "ADMIN",
      receiverId: canonicalCustId,
      adminName: adminFullName,
      message: `ការសន្ទនាត្រូវបានបញ្ចប់ដោយមន្ត្រីធនាគារ (${adminFullName})។ សូមអរគុណ ${getDisplayName(customer)} ដែលបានទាក់ទងមកកាន់ U-PAY! 🙏`,
      time: timeFormatted,
      timestamp: nowTs,
      isRead: false,
    });

    if (global.io) {
      global.io.emit("new_chat_message", endMsg);
    }

    await logAdminAction(
      adminFullName,
      "End Live Support Chat",
      canonicalCustId,
      `Closed live chat session with "${getDisplayName(customer)}"`,
    );

    res.json({ success: true, message: endMsg });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

// ============================================================================
// 📤 ជំពូកទី ១១៖ ការនាំចេញមុខងារទាំងអស់ (MODULE EXPORTS)
// ============================================================================
module.exports = {
  // ជំពូកទី ២៖ Helpers
  checkAdminAccess,
  logCustomAction,

  // ជំពូកទី ៣៖ Admin Staff Management
  getMe,
  getAdminsList,
  getUserLogs,
  saveAdminAccount,
  deleteAdminAccount,
  adminResetPassword,
  toggleAdminStatus,
  checkAdminNfcUid,
  getAdminLogs,

  // ជំពូកទី ៤៖ System & FX Control
  toggleSystem,
  getSystemStatus,
  getFXRates,
  updateFX,
  getFeeSettings,
  updateFeeSettings,
  syncNbcFXRates,

  // ជំពូកទី ៥៖ Dashboard & Analytics
  getStats,
  getDashboardExtra,
  getDashboardAnalyticsPro,

  // ជំពូកទី ៦៖ Customer 360° & KYC Management
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

  // ជំពូកទី ៧៖ Finance & Transactions
  getTransaction,
  adjustBalance,
  approveTransaction,
  refundTransaction,
  releaseMerchantHold,
  getPublicReceipt,

  // ជំពូកទី ៨៖ Cashier System
  searchCashierUser,
  getCashierTickets,
  actionCashierTicket,
  createCashierTicket,

  // ជំពូកទី ៩៖ Cards & Merchants
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
  adminUpdatePhysicalCardStatus,
  adminUpdatePhysicalCardPin,
  adminCreateMerchant,
  adminGetMerchantsByUser,
  adminToggleMerchantFreeze,
  adminDeleteMerchant,
  adminEditMerchant,

  // ជំពូកទី ១០៖ Promo, Broadcast, Tickets & Live Support Chat
  createPromoCode,
  getPromoCodes,
  togglePromoCode,
  broadcast,
  getBroadcastHistory,
  deleteBroadcast,
  sendDirectMessage,
  ticketReply,
  getAllSupportTickets,
  getUserTickets,
  adminResolveTicket,
  adminGetSupportQueue,
  adminGetChatHistory,
  adminSendSupportMessage,
  adminStartSupportSession,
  adminUpdateSupportStatus,
  adminEndSupportSession,
};
