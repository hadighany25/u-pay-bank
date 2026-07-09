const {
  readSystemStatus,
  writeSystemStatus,
  readFXRates,
  writeFXRates,
} = require("../services/systemService");

const Admin = require("../models/Admin");
const AdminLog = require("../models/AdminLog");
const System = require("../models/System");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Chat = require("../models/Chat");
const mongoose = require("mongoose");
const PromoCode = require("../models/PromoCode");
const { getFormattedDate, generateHash } = require("../services/helpers");

// ========================================================
// 🧠 មុខងារលួចកត់ត្រាសកម្មភាពចូល Database (Audit Log Helper)
// ========================================================
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

// ========================================================
// 🧠 ខួរក្បាលត្រួតពិនិត្យសិទ្ធិ និង ម៉ោងធ្វើការ
// ========================================================
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

// ========================================================
// មុខងារចាស់ៗ ដែលភ្ជាប់ជាមួយប្រព័ន្ធ Log រួចជាស្រេច
// ========================================================

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

const toggleFreeze = async (req, res) => {
  const access = await checkAdminAccess(req.admin, "freezeUser");
  if (!access.allowed)
    return res.status(403).json({ success: false, message: access.message });

  const { id, isFrozen } = req.body;
  try {
    if (!id) return res.json({ success: false });
    let query = [{ id: id }, { username: id }];
    if (mongoose.isValidObjectId(id)) query.push({ _id: id });
    const u = await User.findOne({ $or: query });
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
      res.json({ success: true });
    } else res.json({ success: false });
  } catch (err) {
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

    let query = [{ id: id }, { username: id }];
    if (mongoose.isValidObjectId(id)) query.push({ _id: id });

    const u = await User.findOne({ $or: query });
    if (u) {
      const checkUSD = accountNumber || u.accountNumber;
      const checkKHR = accountNumberKHR || u.accountNumberKHR;
      if (checkUSD === checkKHR)
        return res.json({
          success: false,
          message: "បរាជ័យ! លេខគណនី USD និង KHR មិនអាចដូចគ្នាបានទេ។",
        });

      if (accountNumber && accountNumber !== u.accountNumber)
        u.accountNumber = accountNumber;
      if (accountNumberKHR && accountNumberKHR !== u.accountNumberKHR)
        u.accountNumberKHR = accountNumberKHR;
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
    } else res.json({ success: false, message: "រកមិនឃើញគណនីដើម្បីកែប្រែទេ។" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

const deleteUser = async (req, res) => {
  const access = await checkAdminAccess(req.admin, "deleteUser");
  if (!access.allowed)
    return res.status(403).json({ success: false, message: access.message });

  const { id } = req.body;
  try {
    if (!id) return res.json({ success: false });
    let query = [{ id: id }, { username: id }];
    if (mongoose.isValidObjectId(id)) query.push({ _id: id });

    const userToDelete = await User.findOne({ $or: query });
    if (userToDelete) {
      await Chat.deleteMany({
        $or: [
          { senderAcc: userToDelete.accountNumber },
          { receiverAcc: userToDelete.accountNumber },
          { senderAcc: userToDelete.accountNumberKHR },
          { receiverAcc: userToDelete.accountNumberKHR },
        ],
      });
      await User.deleteOne({ _id: userToDelete._id });

      await logAdminAction(
        req.admin.username,
        "Delete User",
        userToDelete.username,
        `Deleted account completely`,
      );
      res.json({ success: true });
    } else res.json({ success: false, message: "User not found" });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

const adjustBalance = async (req, res) => {
  const access = await checkAdminAccess(req.admin, "adjustBal");
  if (!access.allowed)
    return res.status(403).json({ success: false, message: access.message });

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
    user.markModified("transactions");
    if (!centralBank.transactions) centralBank.transactions = [];
    centralBank.transactions.unshift(bankTrx);
    centralBank.markModified("transactions");

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
    user.markModified("notifications");

    await user.save();
    await centralBank.save();

    await logAdminAction(
      req.admin.username,
      type === "add" ? "Add Money" : "Deduct Money",
      user.username,
      `${type === "add" ? "+" : "-"}${sign}${adjustAmount}`,
    );
    res.json({ success: true, message: `Operation Success!` });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

const approveTransaction = async (req, res) => {
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
        u.markModified("notifications");
        await u.save();

        await logAdminAction(
          req.admin.username,
          "Approve Transaction",
          u.username,
          `Approved Trx ID: ${refId}`,
        );
        return res.json({ success: true, message: "Transaction Approved!" });
      }
    }
    res.json({ success: false, message: "Transaction not found/pending" });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

const refundTransaction = async (req, res) => {
  const access = await checkAdminAccess(req.admin, "refund");
  if (!access.allowed)
    return res.status(403).json({ success: false, message: access.message });

  const { refId, reason } = req.body;
  try {
    const sender = await User.findOne({
      "transactions.refId": refId,
      "transactions.amount": { $lt: 0 },
    });
    if (!sender)
      return res.json({
        success: false,
        message: "រកប្រតិបត្តិការមិនឃើញ ឬមិនមែនជាការវេរប្រាក់ចេញ!",
      });

    const originalTrx = sender.transactions.find(
      (t) => t.refId === refId && t.amount < 0,
    );
    if (!originalTrx || originalTrx.status === "Refunded")
      return res.json({
        success: false,
        message: "ប្រតិបត្តិការនេះត្រូវបាន Refund រួចហើយ ឬមិនត្រឹមត្រូវ!",
      });

    const receiver = await User.findOne({
      $or: [
        { accountNumber: originalTrx.receiverAcc },
        { accountNumberKHR: originalTrx.receiverAcc },
      ],
    });
    if (!receiver)
      return res.json({
        success: false,
        message: "រកគណនីអ្នកទទួលមិនឃើញទេ! មិនអាចកាត់លុយមកវិញបានឡើយ។",
      });

    const isKHR = originalTrx.currency === "KHR";
    const refundAmount = Math.abs(originalTrx.amount);
    const receiverBalance = isKHR
      ? receiver.balanceKHR || 0
      : receiver.balance || 0;

    if (receiverBalance < refundAmount) {
      return res.json({
        success: false,
        message: `មិនអាច Refund បានទេ! អ្នកទទួល (${receiver.username}) បានដកលុយចាយអស់ខ្លះហើយ សមតុល្យគាត់នៅសល់តែ ${isKHR ? "៛" : "$"}${receiverBalance} ប៉ុណ្ណោះ។`,
      });
    }

    if (isKHR) {
      receiver.balanceKHR -= refundAmount;
      sender.balanceKHR += refundAmount;
    } else {
      receiver.balance -= refundAmount;
      sender.balance += refundAmount;
    }

    originalTrx.status = "Refunded";
    originalTrx.remark = `[REFUNDED] មូលហេតុ: ${reason}`;

    const receiverOriginalTrx = receiver.transactions.find(
      (t) => t.refId === refId,
    );
    if (receiverOriginalTrx) {
      receiverOriginalTrx.status = "Refunded";
      receiverOriginalTrx.remark = `[REFUNDED BY ADMIN] មូលហេតុ: ${reason}`;
    }

    const refundRef = "RF-" + Date.now().toString().slice(-6);
    const dateNow = getFormattedDate();
    const newHash = generateHash();

    sender.transactions.unshift({
      refId: refundRef,
      hash: newHash,
      date: dateNow,
      type: "Refund Received",
      amount: refundAmount,
      currency: originalTrx.currency,
      fee: 0,
      senderName: receiver.username,
      receiverName: sender.username,
      remark: `Admin Refund: ${reason}`,
      status: "Success",
      trxMethod: "System Refund",
    });
    receiver.transactions.unshift({
      refId: refundRef,
      hash: newHash,
      date: dateNow,
      type: "Refund Deducted",
      amount: -refundAmount,
      currency: originalTrx.currency,
      fee: 0,
      senderName: receiver.username,
      receiverName: sender.username,
      remark: `Reversed by Admin: ${reason}`,
      status: "Success",
      trxMethod: "System Refund",
    });

    if (!sender.notifications) sender.notifications = [];
    sender.notifications.unshift({
      id: "NOTIF-" + Date.now() + "1",
      title: "Refund Processed ✅",
      message: `ទឹកប្រាក់ ${isKHR ? "៛" : "$"}${refundAmount} ត្រូវបានបង្វិលចូលគណនីអ្នកវិញ។ មូលហេតុ: ${reason}`,
      date: dateNow,
      isRead: false,
    });

    if (!receiver.notifications) receiver.notifications = [];
    receiver.notifications.unshift({
      id: "NOTIF-" + Date.now() + "2",
      title: "Refund Deducted ⚠️",
      message: `ទឹកប្រាក់ ${isKHR ? "៛" : "$"}${refundAmount} ត្រូវបានដកចេញពីគណនីអ្នកដោយ Admin។ មូលហេតុ: ${reason}`,
      date: dateNow,
      isRead: false,
    });

    sender.markModified("transactions");
    sender.markModified("notifications");
    receiver.markModified("transactions");
    receiver.markModified("notifications");
    await sender.save();
    await receiver.save();

    await logAdminAction(
      req.admin.username,
      "Refund Transaction",
      `${receiver.username} -> ${sender.username}`,
      `Refunded ${isKHR ? "៛" : "$"}${refundAmount}. Reason: ${reason}`,
    );
    return res.json({
      success: true,
      message: `កាត់លុយពី ${receiver.username} មកអោយ ${sender.username} ជោគជ័យ!`,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

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

const kycAction = async (req, res) => {
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
      u.markModified("notifications");
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

const ticketReply = async (req, res) => {
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
        u.markModified("notifications");
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
    const sharedNotifId = "BC-" + Date.now();
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

    await logAdminAction(
      req.admin.username,
      "Broadcast",
      "All Users",
      `Sent: ${title}`,
    );
    res.json({ success: true, count: result.matchedCount });
  } catch (error) {
    res.status(500).json({ success: false });
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
    await User.updateMany(
      { "notifications.id": notifId },
      { $pull: { notifications: { id: notifId } } },
    );

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

const saveAdminAccount = async (req, res) => {
  const { id, username, password, role, permissions } = req.body;
  try {
    if (id) {
      const adminToUpdate = await Admin.findById(id);
      if (!adminToUpdate)
        return res.json({ success: false, message: "រកមិនឃើញគណនី" });

      adminToUpdate.username = username;
      adminToUpdate.role = role;
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

// ========================================================
// អនុវត្តមុខងារដែលគ្មាន Log (ធម្មតា)
// ========================================================

const getStats = async (req, res) => {
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
};

const getDashboardExtra = async (req, res) => {
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
};

const getTransaction = async (req, res) => {
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
      const senderObj = await User.findOne({ username: foundTrx.senderName });
      const receiverObj = await User.findOne({
        $or: [
          { accountNumber: foundTrx.receiverAcc },
          { accountNumberKHR: foundTrx.receiverAcc },
        ],
      });
      let trxDetails = {
        ...(foundTrx.toObject ? foundTrx.toObject() : foundTrx),
      };
      trxDetails.senderKyc = senderObj ? senderObj.kycStatus : "Unverified";
      trxDetails.receiverKyc = receiverObj
        ? receiverObj.kycStatus
        : "Unverified";
      res.json({
        success: true,
        transaction: trxDetails,
        user: { username: owner.username, accountNumber: owner.accountNumber },
      });
    } else res.json({ success: false });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

const getSystemStatus = (req, res) => {
  res.json(readSystemStatus());
};
const getFXRates = (req, res) => {
  res.json({ success: true, rates: readFXRates() });
};
const getAdminsList = async (req, res) => {
  try {
    const admins = await Admin.find({}, "-password");
    res.json({ success: true, admins });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};
const getMe = async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin.id || req.admin._id);
    res.json({ success: true, admin });
  } catch (error) {
    res.status(500).json({ success: false });
  }
};

// ========================================================
// 🔥 មុខងារគ្រប់គ្រងសេវាវេរលុយ និង កម្រិតកំណត់
// ========================================================
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
    // បើមាន Error បោះសារទៅប្រាប់អោយដឹងច្បាស់ៗ
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
    if (!sys) {
      sys = new System();
    }

    sys.transferLimit = parseFloat(transferLimit);
    sys.feeTiers = feeTiers;

    // 🔥 បន្ថែមបន្ទាត់នេះដាច់ខាត ដើម្បីអោយ Database ព្រម Save Array នេះចូល
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
    // បោះសារ Error ទៅអោយ Frontend ឃើញច្បាស់ៗ
    res
      .status(500)
      .json({ success: false, message: "Server Error: " + err.message });
  }
};
// ==========================================
// 🎁 មុខងារគ្រប់គ្រង PROMO CODE (API សម្រាប់ Admin)
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

// ទាញយកបញ្ជី Promo Codes ទាំងអស់មកបង្ហាញ
const getPromoCodes = async (req, res) => {
  try {
    const promos = await PromoCode.find().sort({ createdAt: -1 });
    res.json({ success: true, promos });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// បិទឬបើក Promo Code ណាមួយ
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

const logCustomAction = async (req, res) => {
  try {
    const { action, target, details } = req.body;
    await logAdminAction(req.admin.username, action, target, details);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false });
  }
};

// ១. មុខងារលុបកាតដោយ Admin
const adminDeleteCard = async (req, res) => {
  const { username, cardId, reason } = req.body;
  try {
    const User = require("../models/User"); // ត្រូវប្រាកដថាបានទាញ Model មក
    const user = await User.findOne({ username });
    if (!user) return res.json({ success: false, message: "រកមិនឃើញអតិថិជន" });

    // ចម្រោះយកកាតដែលត្រូវលុបចេញ
    user.virtualCards = user.virtualCards.filter((c) => c.id !== cardId);
    await user.save();

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// ២. មុខងារបង្កើតកាតដោយ Admin (មានកាត់លុយ $5)
const adminCreateCard = async (req, res) => {
  const { username, cardType } = req.body;
  try {
    const User = require("../models/User");
    const user = await User.findOne({ username });
    if (!user) return res.json({ success: false, message: "រកមិនឃើញអតិថិជន" });

    // ឆែកលុយក្នុងកុង
    if (user.balance < 5) {
      return res.json({
        success: false,
        message: "អតិថិជនមិនមានប្រាក់គ្រប់គ្រាន់ ($5.00) ក្នុងគណនីទេ!",
      });
    }

    // កាត់លុយ User $5
    user.balance -= 5;

    // កូដបន្ថែមលុយ $5 ចូលគណនី @system_fee របស់អ្នក
    const systemFeeAcc = await User.findOne({ username: "system_fee" });
    if (systemFeeAcc) {
      systemFeeAcc.balance += 5;
      await systemFeeAcc.save();
    }

    // បង្កើតលេខកាតថ្មី (Random)
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
      expiryDate: "12/28", // ឬកំណត់ Auto
      cvv: generateNumber(3),
      isLocked: false,
      createdAt: new Date(),
    };

    if (!user.virtualCards) user.virtualCards = [];
    user.virtualCards.push(newCard);
    await user.save();

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// មុខងារសម្រាប់ទាញទិន្នន័យអតិថិជនតែម្នាក់ឯង (ប្រើសម្រាប់ Refresh Customer 360)
const getSingleUser = async (req, res) => {
  try {
    const User = require("../models/User"); // ហៅ Model
    const user = await User.findOne({ username: req.body.username });
    if (user) {
      res.json({ success: true, user: user });
    } else {
      res.json({ success: false, message: "User not found" });
    }
  } catch (error) {
    res.status(500).json({ success: false });
  }
};

// មុខងារ Upload KYC ជំនួសអតិថិជនដោយ Admin
const adminUploadKyc = async (req, res) => {
  const { username, kycImage } = req.body;
  try {
    const User = require("../models/User");

    // 🔥 កូដថ្មី៖ បង្ខំឱ្យ Save ទាំង kycImage និង idCardImage ព្រមទាំងដាក់ strict: false
    const updatedUser = await User.findOneAndUpdate(
      { username: username },
      {
        $set: {
          kycImage: kycImage,
          idCardImage: kycImage, // ដាក់ទាំង២ ដើម្បីកុំឱ្យខុស Schema
          kycStatus: "pending",
        },
      },
      { new: true, strict: false }, // strict:false បង្ខំឱ្យ MongoDB Save ទោះអត់មានក្នុង Schema ក៏ដោយ
    );

    if (updatedUser) {
      res.json({ success: true });
    } else {
      res.json({ success: false, message: "រកមិនឃើញ User" });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  toggleSystem,
  updateFX,
  getStats,
  getDashboardExtra,
  toggleFreeze,
  getTransaction,
  editUser,
  deleteUser,
  adjustBalance,
  approveTransaction,
  refundTransaction,
  toggleAdminCardLock,
  kycAction,
  ticketReply,
  getSystemStatus,
  getFXRates,
  getAdminsList,
  saveAdminAccount,
  deleteAdminAccount,
  checkAdminAccess,
  getMe,
  broadcast,
  deleteBroadcast,
  getAdminLogs,
  getFeeSettings,
  updateFeeSettings,
  createPromoCode,
  getPromoCodes,
  togglePromoCode,
  logCustomAction,
  adminDeleteCard,
  adminCreateCard,
  getSingleUser,
  adminUploadKyc,
};
