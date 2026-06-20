const {
  readSystemStatus,
  writeSystemStatus,
  readFXRates,
  writeFXRates,
} = require("../services/systemService");

const User = require("../models/User");
const Chat = require("../models/Chat");
const mongoose = require("mongoose");
const { getFormattedDate, generateHash } = require("../services/helpers");

const toggleSystem = async (req, res) => {
  try {
    const currentStatus = readSystemStatus();
    const newStatus = !currentStatus.isSystemFrozen;
    await writeSystemStatus({ isSystemFrozen: newStatus });
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
    res.json({ success: true, message: "Exchange Rates Updated" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

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

const toggleFreeze = async (req, res) => {
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
      res.json({ success: true });
    } else res.json({ success: false });
  } catch (err) {
    res.status(500).json({ success: false });
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

const editUser = async (req, res) => {
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

      if (accountNumber && accountNumber !== u.accountNumber) {
        const exists = await User.findOne({
          _id: { $ne: u._id },
          $or: [
            { accountNumber: accountNumber },
            { accountNumberKHR: accountNumber },
          ],
        });
        if (exists)
          return res.json({
            success: false,
            message: `លេខគណនី USD (${accountNumber}) មានគេប្រើរួចហើយ។`,
          });
        u.accountNumber = accountNumber;
      }

      if (accountNumberKHR && accountNumberKHR !== u.accountNumberKHR) {
        const existsKHR = await User.findOne({
          _id: { $ne: u._id },
          $or: [
            { accountNumber: accountNumberKHR },
            { accountNumberKHR: accountNumberKHR },
          ],
        });
        if (existsKHR)
          return res.json({
            success: false,
            message: `លេខគណនី KHR (${accountNumberKHR}) មានគេប្រើរួចហើយ។`,
          });
        u.accountNumberKHR = accountNumberKHR;
      }

      if (username) u.username = username;
      if (pin) u.pin = pin;
      if (profileImage !== undefined) u.profileImage = profileImage;
      if (password && password.trim() !== "") u.password = password;

      await u.save();
      res.json({ success: true });
    } else res.json({ success: false, message: "រកមិនឃើញគណនីដើម្បីកែប្រែទេ។" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

const deleteUser = async (req, res) => {
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
      res.json({ success: true });
    } else res.json({ success: false, message: "User not found" });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

const adjustBalance = async (req, res) => {
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
        return res.json({ success: true, message: "Transaction Approved!" });
      }
    }
    res.json({ success: false, message: "Transaction not found/pending" });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

// ========================================================
// 🔥 ១១. មុខងារ Refund ពិតប្រាកដ (កាត់ពី B សង A វិញ)
// ========================================================
const refundTransaction = async (req, res) => {
  const { refId, reason } = req.body;

  // ១. ការពារសិទ្ធិ: អោយតែ Super Admin ទើបអាចចុច Refund បាន
  if (req.admin.role !== "super_admin") {
    return res.status(403).json({
      success: false,
      message:
        "បម្រាម៖ មានតែ Super Admin ប៉ុណ្ណោះ ទើបមានសិទ្ធិ Refund ប្រាក់បាន! 🛑",
    });
  }

  try {
    // ២. រកម្ចាស់ដើមដែលជាអ្នកផ្ញើលុយ (Sender) ដោយប្រើ refId ដែលបានកាត់លុយ (amount < 0)
    const sender = await User.findOne({
      "transactions.refId": refId,
      "transactions.amount": { $lt: 0 },
    });

    if (!sender) {
      return res.json({
        success: false,
        message: "រកប្រតិបត្តិការមិនឃើញ ឬមិនមែនជាការវេរប្រាក់ចេញ!",
      });
    }

    const originalTrx = sender.transactions.find(
      (t) => t.refId === refId && t.amount < 0,
    );

    if (!originalTrx || originalTrx.status === "Refunded") {
      return res.json({
        success: false,
        message: "ប្រតិបត្តិការនេះត្រូវបាន Refund រួចហើយ ឬមិនត្រឹមត្រូវ!",
      });
    }

    // ៣. រកអ្នកទទួលលុយ (Receiver) ដោយប្រើលេខគណនី
    const receiver = await User.findOne({
      $or: [
        { accountNumber: originalTrx.receiverAcc },
        { accountNumberKHR: originalTrx.receiverAcc },
      ],
    });

    if (!receiver) {
      return res.json({
        success: false,
        message: "រកគណនីអ្នកទទួលមិនឃើញទេ! មិនអាចកាត់លុយមកវិញបានឡើយ។",
      });
    }

    const isKHR = originalTrx.currency === "KHR";
    const refundAmount = Math.abs(originalTrx.amount);

    // ៤. ឆែកមើលលុយអ្នកទទួល (តើគាត់ដកចាយអស់ហើយឬនៅ?)
    const receiverBalance = isKHR
      ? receiver.balanceKHR || 0
      : receiver.balance || 0;
    if (receiverBalance < refundAmount) {
      return res.json({
        success: false,
        message: `មិនអាច Refund បានទេ! អ្នកទទួល (${receiver.username}) បានដកលុយចាយអស់ខ្លះហើយ សមតុល្យគាត់នៅសល់តែ ${isKHR ? "៛" : "$"}${receiverBalance} ប៉ុណ្ណោះ។`,
      });
    }

    // ៥. ចាប់ផ្តើមធ្វើការកាត់ និង បូកលុយពិតប្រាកដ
    if (isKHR) {
      receiver.balanceKHR -= refundAmount;
      sender.balanceKHR += refundAmount;
    } else {
      receiver.balance -= refundAmount;
      sender.balance += refundAmount;
    }

    // ៦. Update Status ប្រតិបត្តិការចាស់ទាំងសងខាង
    originalTrx.status = "Refunded";
    originalTrx.remark = `[REFUNDED] មូលហេតុ: ${reason}`;

    const receiverOriginalTrx = receiver.transactions.find(
      (t) => t.refId === refId,
    );
    if (receiverOriginalTrx) {
      receiverOriginalTrx.status = "Refunded";
      receiverOriginalTrx.remark = `[REFUNDED BY ADMIN] មូលហេតុ: ${reason}`;
    }

    // ៧. បង្កើត Slip ថ្មីអោយអ្នកទាំងពីរ
    const refundRef = "RF-" + Date.now().toString().slice(-6);
    const dateNow = getFormattedDate();
    const newHash = generateHash();

    // Slip សម្រាប់ Sender (បានលុយវិញ)
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

    // Slip សម្រាប់ Receiver (ត្រូវគេកាត់លុយ)
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

    // ៨. លោត Notification ប្រាប់អ្នកទាំងពីរ
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

    return res.json({
      success: true,
      message: `កាត់លុយពី ${receiver.username} មកអោយ ${sender.username} ជោគជ័យ!`,
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
        res.json({ success: true });
      } else res.json({ success: false });
    } else res.json({ success: false });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

const getSystemStatus = (req, res) => {
  const sys = readSystemStatus();
  res.json(sys);
};

const getFXRates = (req, res) => {
  const rates = readFXRates();
  res.json({ success: true, rates });
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
  kycAction,
  ticketReply,
  getSystemStatus,
  getFXRates,
};
