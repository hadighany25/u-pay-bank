const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/User");
const Transaction = require("../models/Transaction");
// 🔥 ថែមម៉ូឌុល JointAccount ដើម្បីទាញលុយពិតប្រាកដ
const JointAccount = require("../models/JointAccount");
const bot = require("../services/telegramBot");
const { getFormattedDate } = require("../services/helpers");

const Admin = require("../models/Admin");
const bcrypt = require("bcryptjs");

let tempForgotOtps = {};

// មុខងារជំនួយសម្រាប់បង្កើតលេខគណនីអូតូ
const generatePatternAccounts = (users) => {
  let isUnique = false;
  let newAccUSD = "";
  let newAccKHR = "";
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

const register = async (req, res) => {
  const { username, password, fullName, phone, pin } = req.body;
  try {
    const existingUser = await User.findOne({ username });
    if (existingUser)
      return res.json({ success: false, message: "Username already taken!" });

    const allUsers = await User.find({});
    const newAccs = generatePatternAccounts(allUsers);

    const newUser = new User({
      id: Date.now().toString(),
      username,
      password,
      fullName: fullName || username,
      phone,
      pin,
      accountNumber: newAccs.usd,
      accountNumberKHR: newAccs.khr,
      balance: 0.0,
      balanceKHR: 0.0,
      role: "user",
      trxLimit: 1000.0,
      joinDate: new Date().toISOString(),
      lastActive: new Date().toISOString(),
    });

    await newUser.save();

    const token = jwt.sign(
      { id: newUser.id, username: newUser.username, role: newUser.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    const safeUser = newUser.toObject();
    delete safeUser.password;
    delete safeUser.pin;

    res.json({ success: true, user: safeUser, token: token });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

const login = async (req, res) => {
  const { identifier, password } = req.body;
  try {
    const user = await User.findOne({
      $or: [
        { username: identifier },
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

      const jwt = require("jsonwebtoken");
      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: "7d" },
      );

      const safeUser = user.toObject();

      // ========================================================
      // 🔥 ចំណុចកែទី១៖ ធ្វើបច្ចុប្បន្នភាពលុយគណនីរួមពី JointAccount អោយត្រូវ ១០០%
      // ========================================================
      if (safeUser.subAccounts && safeUser.subAccounts.length > 0) {
        const jointAccIds = safeUser.subAccounts
          .filter(
            (sa) =>
              sa.accountType === "joint" || sa.accountType === "joint_member",
          )
          .map((sa) => sa.accountId);

        if (jointAccIds.length > 0) {
          // ទាញយកទិន្នន័យពីធុងលុយ JointAccount
          const jointAccounts = await JointAccount.find({
            accountId: { $in: jointAccIds },
          });
          const jointMap = {};
          jointAccounts.forEach((ja) => {
            jointMap[ja.accountId] = ja.balance;
          });

          // Update លុយក្នុង Array មុននឹងបញ្ជូនទៅ Dashboard
          safeUser.subAccounts.forEach((sa) => {
            if (
              sa.accountType === "joint" ||
              sa.accountType === "joint_member"
            ) {
              if (jointMap[sa.accountId] !== undefined) {
                sa.balance = jointMap[sa.accountId];
              }
            }
          });
        }
      }

      delete safeUser.password;
      delete safeUser.pin;

      res.json({ success: true, user: safeUser, token: token });
    } else {
      res.json({ success: false, message: "Invalid Credentials" });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

const logout = async (req, res) => {
  const { username } = req.body;
  try {
    const user = await User.findOneAndUpdate(
      { username: username },
      {
        $set: {
          isOnline: false,
          forceLogout: false,
        },
        $unset: {
          currentToken: "",
        },
      },
      { new: true },
    );

    if (req.session) {
      req.session.destroy();
    }

    res.json({ success: true, message: "Logged out successfully" });
  } catch (err) {
    console.error("Logout Error:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

const heartbeat = async (req, res) => {
  const { username } = req.body;
  try {
    const user = await User.findOne({ username });
    if (user) {
      user.lastActive = new Date().toISOString();
      await user.save();
      res.json({ success: true });
    } else res.json({ success: false });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

// ==========================================
// 🔄 ទាញយកទិន្នន័យ User និងទាញ Transaction ថ្មីៗ ១០០%
// ==========================================
const getUsers = async (req, res) => {
  try {
    const users = await User.find({});
    const allTransactions = await Transaction.find({}).sort({ createdAt: -1 });

    // 🔥 ចំណុចកែទី២៖ ទាញយកធុងលុយគណនីរួមទាំងអស់ ដើម្បី Update លុយអោយត្រូវរាល់ពេល Load
    const allJointAccounts = await JointAccount.find({});
    const jointMap = {};
    allJointAccounts.forEach((ja) => {
      jointMap[ja.accountId] = ja.balance;
    });

    const usersWithTrx = users.map((user) => {
      const userObj = user.toObject();

      // Update លុយគណនីរួមមុននឹងបញ្ជូនទៅ UI របស់ Admin ឫ Dashboard
      if (userObj.subAccounts && userObj.subAccounts.length > 0) {
        userObj.subAccounts.forEach((sa) => {
          if (sa.accountType === "joint" || sa.accountType === "joint_member") {
            if (jointMap[sa.accountId] !== undefined) {
              sa.balance = jointMap[sa.accountId]; // Update លុយអោយត្រូវ
            }
          }
        });
      }

      userObj.transactions = allTransactions.filter(
        (t) => t.username === user.username,
      );
      return userObj;
    });

    res.json(usersWithTrx);
  } catch (err) {
    console.error("GET USERS ERROR:", err);
    res.status(500).json({ success: false });
  }
};

const changePassword = async (req, res) => {
  const { username, oldPassword, newPassword } = req.body;
  try {
    const user = await User.findOne({ username });
    if (user && user.password === oldPassword) {
      user.password = newPassword;
      await user.save();
      res.json({ success: true });
    } else res.json({ success: false, message: "Old password incorrect" });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

const changePin = async (req, res) => {
  const { username, password, newPin } = req.body;
  try {
    const user = await User.findOne({ username });
    if (user && user.password === password) {
      user.pin = newPin;
      user.pinAttempts = 0;
      await user.save();
      res.json({ success: true });
    } else res.json({ success: false, message: "Password incorrect" });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

const changeLimit = async (req, res) => {
  const { username, password, newLimit } = req.body;
  try {
    const user = await User.findOne({ username });
    if (user && user.password === password) {
      user.trxLimit = parseFloat(newLimit);
      await user.save();
      res.json({ success: true });
    } else res.json({ success: false, message: "Password incorrect" });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

const uploadImage = async (req, res) => {
  const userId = req.body.id;
  if (!req.file)
    return res.json({ success: false, message: "No image uploaded" });
  try {
    const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
    let query = [{ id: userId }, { username: userId }];
    if (mongoose.isValidObjectId(userId)) query.push({ _id: userId });

    const user = await User.findOne({ $or: query });
    if (user) {
      user.profileImage = base64Image;
      await user.save();
      res.json({ success: true, imageUrl: base64Image });
    } else res.json({ success: false, message: "User not found" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

const submitKyc = async (req, res) => {
  const username = req.body.username;
  if (!req.file)
    return res.json({ success: false, message: "No document uploaded" });
  try {
    const base64Doc = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
    const user = await User.findOne({ username });
    if (user) {
      user.kycStatus = "pending";
      user.kycDocument = base64Doc;
      user.kycSubmittedAt = getFormattedDate();
      await user.save();
      res.json({
        success: true,
        message: "ឯកសារបញ្ជាក់អត្តសញ្ញាណត្រូវបានបញ្ជូន!",
      });
    } else res.json({ success: false, message: "User not found" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

const verifyUser = async (req, res) => {
  const { identifier } = req.body;
  try {
    const user = await User.findOne({
      $or: [{ username: identifier }, { phone: identifier }],
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
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

const resetPassword = async (req, res) => {
  const { username, otp, newPassword } = req.body;
  if (!tempForgotOtps[username] || tempForgotOtps[username] !== otp)
    return res.json({ success: false, message: "លេខកូដ OTP មិនត្រឹមត្រូវ!" });
  try {
    const user = await User.findOne({ username });
    if (user) {
      user.password = newPassword;
      await user.save();
      delete tempForgotOtps[username];
      res.json({ success: true, message: "ពាក្យសម្ងាត់ត្រូវបានប្តូរជោគជ័យ!" });
    } else res.json({ success: false });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

const generateTelegramCode = async (req, res) => {
  const { username } = req.body;
  try {
    const user = await User.findOne({ username });
    if (user) {
      const randomCode = Math.floor(1000 + Math.random() * 9000).toString();
      user.linkCode = randomCode;
      await user.save();
      res.json({ success: true, code: randomCode });
    } else res.json({ success: false });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

const unlinkTelegram = async (req, res) => {
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
          .catch((e) => console.log(e));
      res.json({ success: true });
    } else res.json({ success: false });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

const verifyAccount = async (req, res) => {
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
    else
      res.status(404).json({ success: false, message: "រកមិនឃើញគណនីនេះទេ!" });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

const adminLogin = async (req, res) => {
  const { username, password } = req.body;
  try {
    let isValid = false;
    let finalRole = "support_agent";
    let adminId = "";

    const newAdminAcc = await Admin.findOne({ username: username });

    if (newAdminAcc) {
      isValid = await bcrypt.compare(password, newAdminAcc.password);
      if (!isValid && newAdminAcc.password === password) isValid = true;

      if (isValid) {
        finalRole = newAdminAcc.role;
        adminId = newAdminAcc.id || newAdminAcc._id;
      }
    } else {
      const legacyAdmin = await User.findOne({
        username: username,
        role: {
          $in: ["admin", "super_admin", "finance_admin", "support_agent"],
        },
      });

      if (legacyAdmin && legacyAdmin.password === password) {
        isValid = true;
        finalRole =
          legacyAdmin.role === "admin" ? "super_admin" : legacyAdmin.role;
        adminId = legacyAdmin.id || legacyAdmin._id;
      }
    }

    if (!isValid) {
      return res.json({
        success: false,
        message: "ឈ្មោះ ឬលេខសម្ងាត់ Admin មិនត្រឹមត្រូវទេ!",
      });
    }

    const token = jwt.sign(
      { id: adminId, username: username, role: finalRole },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );

    res.json({
      success: true,
      token: token,
      user: {
        username: username,
        role: finalRole,
      },
    });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: "Server Error ពេល Admin login" });
  }
};

const migrateTransactions = async (req, res) => {
  try {
    const users = await User.find({ "transactions.0": { $exists: true } });
    let totalMigrated = 0;

    for (let user of users) {
      if (user.transactions && user.transactions.length > 0) {
        const trxsToInsert = user.transactions.map((t) => {
          const tObj = t.toObject ? t.toObject() : t;
          return { ...tObj, username: user.username };
        });

        await Transaction.insertMany(trxsToInsert);
        totalMigrated += trxsToInsert.length;

        user.transactions = undefined;
        await user.save();
      }
    }

    await User.updateMany({}, { $unset: { transactions: 1 } });

    res.json({
      success: true,
      message: `អបអរសាទរ! បានជម្លៀសប្រតិបត្តិការចាស់ៗចំនួន ${totalMigrated} ទៅកាន់ប្រព័ន្ធថ្មីដោយជោគជ័យ និងលុបចេញពីគណនីចាស់ៗអស់ហើយ!`,
      usersAffected: users.length,
    });
  } catch (err) {
    console.error("MIGRATION ERROR:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  register,
  login,
  logout,
  heartbeat,
  getUsers,
  changePassword,
  changePin,
  changeLimit,
  uploadImage,
  submitKyc,
  verifyUser,
  resetPassword,
  generateTelegramCode,
  unlinkTelegram,
  verifyAccount,
  adminLogin,
  migrateTransactions,
};
