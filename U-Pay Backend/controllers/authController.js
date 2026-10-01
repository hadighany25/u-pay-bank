// ============================================================================
// ឯកសារ: controllers/authController.js
// អត្ថន័យ: គ្រប់គ្រងការចុះឈ្មោះ, ចូលគណនី, ការកំណត់ទម្រង់គណនី និងគ្រប់គ្រងគណនី (User Auth & Profile)
// ============================================================================

// ==========================================
// 📦 ផ្នែកទី ១៖ ទាញយក Modules, Models និង Utils
// ==========================================
// 1.1 បណ្ណាល័យ (Libraries)
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

// 1.2 តារាងទិន្នន័យ (Database Models)
const User = require("../models/User");
const Transaction = require("../models/Transaction");
const JointAccount = require("../models/JointAccount");
const Admin = require("../models/Admin");
const Notification = require("../models/Notification");
const Otp = require("../models/Otp");

// 1.3 មុខងារជំនួយ (Services & Utils)
const sendOTP = require("../utils/sendEmail");
const bot = require("../services/telegramBot");
const { getFormattedDate } = require("../services/helpers");

// អថេរសម្រាប់ផ្ទុក OTP បណ្តោះអាសន្នពេលភ្លេចលេខសម្ងាត់ (រក្សាទុកតាមកូដដើម)
let tempForgotOtps = {};

// ==========================================
// 🛠️ ផ្នែកទី ២៖ មុខងារជំនួយទូទៅ (Helper Functions)
// ==========================================

/**
 * 📌 បង្កើតលេខគណនីអូតូដោយចៃដន្យ (ទម្រង់ x00x00xxx) និងឆែកកុំឱ្យស្ទួន
 */
const generatePatternAccounts = async () => {
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

    // ឆែកមើលក្រែងលោមានលេខស្ទួនក្នុង Database
    const exists = await User.findOne({
      $or: [
        { "mainAccounts.USD.accountNumber": newAccUSD },
        { "mainAccounts.KHR.accountNumber": newAccKHR },
      ],
    });

    if (!exists) isUnique = true;
  }
  return { usd: newAccUSD, khr: newAccKHR };
};

// ==========================================
// 🚪 ផ្នែកទី ៣៖ ការចូល និងចាកចេញ (Login & Logout)
// ==========================================

/**
 * 📌 ចូលគណនី (Login)
 */
const login = async (req, res) => {
  const { identifier, password } = req.body;
  try {
    const user = await User.findOne({
      $or: [
        { username: identifier },
        { phone: identifier },
        { email: identifier },
        { fullName: identifier },
      ],
      password: password,
    });

    if (user) {
      if (user.isFrozen) {
        return res.json({
          success: false,
          message: "គណនីរបស់អ្នកត្រូវបានបិទដោយប្រព័ន្ធ (Admin Locked)!",
        });
      }

      user.isOnline = true;
      user.lastActive = new Date().toISOString();
      await user.save();

      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: "7d" },
      );

      const safeUser = user.toObject();

      // ការធ្វើបច្ចុប្បន្នភាពគណនី Joint
      if (safeUser.subAccounts && safeUser.subAccounts.length > 0) {
        const jointAccIds = safeUser.subAccounts
          .filter(
            (sa) =>
              sa.accountType === "joint" || sa.accountType === "joint_member",
          )
          .map((sa) => sa.accountId);

        if (jointAccIds.length > 0) {
          const jointAccounts = await JointAccount.find({
            accountId: { $in: jointAccIds },
          });
          const jointMap = {};
          jointAccounts.forEach((ja) => {
            jointMap[ja.accountId] = ja.balance;
          });

          safeUser.subAccounts.forEach((sa) => {
            if (
              (sa.accountType === "joint" ||
                sa.accountType === "joint_member") &&
              jointMap[sa.accountId] !== undefined
            ) {
              sa.balance = jointMap[sa.accountId];
            }
          });
        }
      }

      if (safeUser.role === "junior") safeUser.kycStatus = "verified";

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

/**
 * 📌 ចាកចេញពីគណនី (Logout)
 */
const logout = async (req, res) => {
  const { username } = req.body;
  try {
    await User.findOneAndUpdate(
      { username: username },
      { $set: { isOnline: false }, $unset: { currentToken: "" } },
      { new: true },
    );
    if (req.session) req.session.destroy();
    res.json({ success: true, message: "Logged out successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// ==========================================
// 🔐 ផ្នែកទី ៤៖ ការចុះឈ្មោះ និង OTP (Registration)
// ==========================================

/**
 * 📌 សុំលេខកូដ OTP (Request OTP) មុនពេលបង្កើតគណនី
 */
const requestRegisterOTP = async (req, res) => {
  const { username, phone, email } = req.body;

  try {
    const existingUser = await User.findOne({
      $or: [{ username }, { phone }, { email }],
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "ឈ្មោះគណនី, លេខទូរស័ព្ទ ឬអ៊ីមែលនេះ ត្រូវបានប្រើប្រាស់រួចហើយ!",
      });
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    await Otp.create({ email: email, otp: otpCode });
    const emailSent = await sendOTP(email, otpCode, "register");

    if (emailSent) {
      res.json({
        success: true,
        message: "លេខកូដ OTP ត្រូវបានផ្ញើទៅកាន់អ៊ីមែលរបស់អ្នកហើយ!",
      });
    } else {
      res
        .status(500)
        .json({ success: false, message: "បរាជ័យក្នុងការផ្ញើ Email!" });
    }
  } catch (error) {
    console.error("OTP Request Error:", error);
    res
      .status(500)
      .json({ success: false, message: "មានបញ្ហា Server ពេលផ្ញើ OTP" });
  }
};

/**
 * 📌 ផ្ទៀងផ្ទាត់ OTP រួចទើបបង្កើតគណនីពិតប្រាកដ (Verify & Register)
 */
const verifyAndRegister = async (req, res) => {
  const { username, password, fullName, phone, email, pin, otp } = req.body;

  try {
    const validOtp = await Otp.findOne({ email: email, otp: otp });

    if (!validOtp) {
      return res.status(400).json({
        success: false,
        message: "លេខកូដ OTP មិនត្រឹមត្រូវ ឬផុតកំណត់!",
      });
    }

    const newAccs = await generatePatternAccounts();
    const tsId = Date.now().toString();

    const newUser = new User({
      id: tsId,
      username,
      password,
      email,
      fullName: fullName || username,
      phone,
      pin,
      mainAccounts: {
        USD: {
          accountId: "MAIN_USD_" + tsId,
          accountNumber: newAccs.usd,
          accountName: "Main Account USD",
          accountType: "main",
          currency: "USD",
          balance: 0.0,
          holdBalance: 0.0,
          dailyLimit: 1000.0,
          dailySpent: 0.0,
          isFrozen: false,
          isSystemLocked: false,
          isHidden: false,
        },
        KHR: {
          accountId: "MAIN_KHR_" + tsId,
          accountNumber: newAccs.khr,
          accountName: "Main Account KHR",
          accountType: "main",
          currency: "KHR",
          balance: 0.0,
          holdBalance: 0.0,
          dailyLimit: 4000000.0,
          dailySpent: 0.0,
          isFrozen: false,
          isSystemLocked: false,
          isHidden: false,
        },
      },
      role: "user",
      joinDate: new Date().toISOString(),
      lastActive: new Date().toISOString(),
    });

    await newUser.save();
    await Otp.deleteOne({ _id: validOtp._id });

    const token = jwt.sign(
      { id: newUser.id, username: newUser.username, role: newUser.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    const safeUser = newUser.toObject();
    delete safeUser.password;
    delete safeUser.pin;

    res.json({
      success: true,
      message: "បង្កើតគណនីជោគជ័យ!",
      user: safeUser,
      token: token,
    });
  } catch (err) {
    console.error("Registration Error:", err);
    res
      .status(500)
      .json({ success: false, message: "Server Error ពេលបង្កើតគណនី" });
  }
};

/**
 * 📌 ការចុះឈ្មោះបែបចាស់ (Legacy Registration - API ចាស់អត់ត្រូវការ OTP)
 */
const register = async (req, res) => {
  const { username, password, fullName, phone, pin } = req.body;
  try {
    const existingUser = await User.findOne({ username });
    if (existingUser)
      return res.json({ success: false, message: "Username already taken!" });

    const newAccs = await generatePatternAccounts();
    const tsId = Date.now().toString();

    const newUser = new User({
      id: tsId,
      username,
      password,
      fullName: fullName || username,
      phone,
      pin,
      mainAccounts: {
        USD: {
          accountId: "MAIN_USD_" + tsId,
          accountNumber: newAccs.usd,
          accountName: "Main Account USD",
          accountType: "main",
          currency: "USD",
          balance: 0.0,
          dailyLimit: 1000.0,
        },
        KHR: {
          accountId: "MAIN_KHR_" + tsId,
          accountNumber: newAccs.khr,
          accountName: "Main Account KHR",
          accountType: "main",
          currency: "KHR",
          balance: 0.0,
          dailyLimit: 4000000.0,
        },
      },
      role: "user",
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

// ==========================================
// 🔑 ផ្នែកទី ៥៖ ការសង្គ្រោះគណនី (Forgot Password)
// ==========================================

/**
 * 📌 ផ្ទៀងផ្ទាត់ Email ដើម្បីសុំ OTP ពេលភ្លេចលេខសម្ងាត់
 */
const verifyUserAccount = async (req, res) => {
  const { identifier } = req.body;
  try {
    const user = await User.findOne({
      email: { $regex: new RegExp("^" + identifier.trim() + "$", "i") },
    });
    if (!user)
      return res.json({
        success: false,
        message: "រកមិនឃើញគណនីដែលប្រើប្រាស់ Email នេះទេ! ❌",
      });

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    await Otp.create({ email: user.email, otp: otpCode });
    const emailSent = await sendOTP(user.email, otpCode, "forgot");

    if (emailSent)
      res.json({
        success: true,
        email: user.email,
        message: "លេខកូដ OTP បានផ្ញើទៅកាន់ Email របស់អ្នកហើយ!",
      });
    else
      res
        .status(500)
        .json({ success: false, message: "មានបញ្ហាក្នុងការផ្ញើ Email!" });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

/**
 * 📌 ផ្ទៀងផ្ទាត់ OTP សង្គ្រោះគណនី
 */
const verifyForgotOtp = async (req, res) => {
  const { email, otp } = req.body;
  try {
    const validOtp = await Otp.findOne({
      email: { $regex: new RegExp("^" + email.trim() + "$", "i") },
      otp: otp,
    });
    if (!validOtp)
      return res.json({
        success: false,
        message: "លេខកូដ OTP មិនត្រឹមត្រូវ ឬផុតកំណត់ទេ! ❌",
      });
    res.json({ success: true, message: "OTP ត្រឹមត្រូវ!" });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

/**
 * 📌 កំណត់លេខសម្ងាត់ថ្មី (Reset Password)
 */
const resetPassword = async (req, res) => {
  const { email, otp, newPassword } = req.body;
  try {
    const validOtp = await Otp.findOne({
      email: { $regex: new RegExp("^" + email.trim() + "$", "i") },
      otp: otp,
    });
    if (!validOtp)
      return res.json({
        success: false,
        message: "លេខកូដ OTP មិនត្រឹមត្រូវ ឬផុតកំណត់!",
      });

    const user = await User.findOne({
      email: { $regex: new RegExp("^" + email.trim() + "$", "i") },
    });
    if (user) {
      user.password = newPassword;
      await user.save();
      await Otp.deleteOne({ _id: validOtp._id });
      res.json({
        success: true,
        message: "ពាក្យសម្ងាត់ត្រូវបានប្តូរជោគជ័យ! 🎉",
      });
    } else res.json({ success: false, message: "រកមិនឃើញអ្នកប្រើប្រាស់" });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

/**
 * 📌 ផ្ញើ OTP សម្រាប់ពេលប្តូរ Password ឬ PIN ក្នុង Settings (Step 2)
 */
const sendSecurityOtp = async (req, res) => {
  const { email, purpose } = req.body; // purpose អាចជា "security_pass" ឬ "security_pin"
  try {
    const user = await User.findOne({ email: email });
    if (!user)
      return res.json({ success: false, message: "រកមិនឃើញគណនីអ៊ីមែលនេះទេ!" });

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    await Otp.create({ email: user.email, otp: otpCode });

    // ផ្ញើ Email ដោយបញ្ជូន purpose ទៅជាមួយ
    const emailSent = await sendOTP(
      user.email,
      otpCode,
      purpose || "security_pass",
    );

    if (emailSent) {
      res.json({
        success: true,
        message: "លេខកូដ OTP ត្រូវបានផ្ញើទៅកាន់ Email របស់អ្នកហើយ!",
      });
    } else {
      res
        .status(500)
        .json({ success: false, message: "បរាជ័យក្នុងការផ្ញើ Email!" });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// ==========================================
// ⚙️ ផ្នែកទី ៦៖ ការកំណត់សុវត្ថិភាព និងប្រវត្តិរូប (Security & Profile Settings)
// ==========================================

/**
 * 📌 ឆែកលេខសម្ងាត់ចាស់ មុនអនុញ្ញាតឱ្យប្តូរ
 */
const verifyCurrentPassword = async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (user && user.password === password) {
      res.json({ success: true });
    } else {
      res.json({
        success: false,
        message: "លេខសម្ងាត់បច្ចុប្បន្នមិនត្រឹមត្រូវទេ!",
      });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * 📌 ឆែកលេខ PIN ចាស់ មុនអនុញ្ញាតឱ្យប្តូរ
 */
const verifyCurrentPin = async (req, res) => {
  const { username, pin } = req.body;
  try {
    const user = await User.findOne({ username });
    if (user && user.pin === pin) {
      res.json({ success: true });
    } else {
      res.json({ success: false, message: "លេខ PIN ចាស់មិនត្រឹមត្រូវទេ!" });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * 📌 ប្តូរលេខសម្ងាត់ (Change Password)
 */
const changePassword = async (req, res) => {
  const { username, oldPassword, newPassword } = req.body;
  try {
    const user = await User.findOne({ username });
    if (user && user.password === oldPassword) {
      user.password = newPassword;
      await user.save();
      res.json({ success: true });
    } else
      res.json({ success: false, message: "លេខសម្ងាត់ចាស់មិនត្រឹមត្រូវទេ" });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

/**
 * 📌 ប្តូរលេខ PIN (Change PIN)
 */
const changePin = async (req, res) => {
  const { username, oldPin, newPin } = req.body;
  try {
    const user = await User.findOne({ username });
    if (user && user.pin === oldPin) {
      user.pin = newPin;
      user.pinAttempts = 0;
      await user.save();
      res.json({ success: true });
    } else res.json({ success: false, message: "លេខ PIN ចាស់មិនត្រឹមត្រូវទេ" });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

/**
 * 📌 ប្តូររូបភាពប្រវត្តិរូប (Upload Image)
 */
const uploadImage = async (req, res) => {
  const { id, imageUrl } = req.body;
  if (!imageUrl)
    return res.json({ success: false, message: "មិនមាន URL រូបភាពទេ!" });
  try {
    const user = await User.findOne({ $or: [{ id: id }, { username: id }] });
    if (user) {
      user.profileImage = imageUrl;
      await user.save();
      res.json({ success: true, imageUrl: imageUrl });
    } else res.json({ success: false, message: "User not found" });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

/**
 * 📌 បញ្ជូនឯកសារ KYC
 */
const submitKyc = async (req, res) => {
  const { username, kycUrl } = req.body;
  if (!kycUrl)
    return res.json({ success: false, message: "មិនមាន URL ឯកសារទេ!" });
  try {
    const user = await User.findOne({ username });
    if (user) {
      user.kycStatus = "pending";
      user.kycDocument = kycUrl;
      user.kycSubmittedAt = getFormattedDate();
      await user.save();
      res.json({
        success: true,
        message: "ឯកសារបញ្ជាក់អត្តសញ្ញាណត្រូវបានបញ្ជូន!",
      });
    } else res.json({ success: false, message: "User not found" });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

// ==========================================
// 🏦 ផ្នែកទី ៧៖ គ្រប់គ្រងគណនីជាក់លាក់ (Account Settings: Rename, Limit, Freeze, Hide)
// ==========================================

/**
 * 📌 ប្តូរឈ្មោះគណនី (អនុញ្ញាតតែ Sub-Accounts)
 */
const renameAccount = async (req, res) => {
  const { accountNumber, newName } = req.body;
  const username = req.user.username;

  try {
    const user = await User.findOne({ username });
    if (!user) return res.json({ success: false, message: "រកគណនីមិនឃើញទេ!" });

    let updated = false;
    const subAcc = user.subAccounts.find(
      (a) => String(a.accountNumber) === String(accountNumber),
    );

    if (subAcc) {
      subAcc.accountName = newName;
      updated = true;
    }

    if (updated) {
      user.markModified("subAccounts");
      await user.save();
      const safeUser = user.toObject();
      delete safeUser.password;
      delete safeUser.pin;
      res.json({ success: true, user: safeUser });
    } else {
      res.json({
        success: false,
        message: "មិនអាចប្តូរឈ្មោះគណនីគោលបានទេ ឫ រកគណនីមិនឃើញ!",
      });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: "មានបញ្ហា Server" });
  }
};

/**
 * 📌 កំណត់កម្រិតចំណាយប្រចាំថ្ងៃ (Daily Limit)
 */
const updateAccountLimit = async (req, res) => {
  const { accountNumber, dailyLimit } = req.body;
  const username = req.user.username;

  try {
    const user = await User.findOne({ username });
    if (!user) return res.json({ success: false, message: "រកគណនីមិនឃើញទេ!" });

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
    } else if (String(user.accountNumber) === String(accountNumber)) {
      user.trxLimit = dailyLimit;
      updated = true;
    } else {
      const subAcc = user.subAccounts.find(
        (a) => String(a.accountNumber) === String(accountNumber),
      );
      if (subAcc) {
        subAcc.dailyLimit = dailyLimit;
        updated = true;

        if (subAcc.accountType === "junior") {
          const juniorUser = await User.findOne({
            $or: [
              { "mainAccounts.USD.accountNumber": accountNumber },
              { accountNumber: accountNumber },
            ],
          });
          if (juniorUser) {
            if (juniorUser.mainAccounts?.USD)
              juniorUser.mainAccounts.USD.dailyLimit = dailyLimit;
            else juniorUser.dailyLimit = dailyLimit;
            await juniorUser.save();
          }
        }
      }
    }

    if (updated) {
      user.markModified("mainAccounts");
      user.markModified("subAccounts");
      await user.save();
      const safeUser = user.toObject();
      delete safeUser.password;
      delete safeUser.pin;
      res.json({ success: true, user: safeUser });
    } else {
      res.json({ success: false, message: "រកគណនីមិនឃើញ!" });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: "មានបញ្ហា Server" });
  }
};

/**
 * 📌 ផ្អាក / បើកដំណើរការគណនី (Freeze / Unfreeze)
 */
const toggleFreezeAccount = async (req, res) => {
  const { accountNumber } = req.body;
  const username = req.user.username;

  try {
    const user = await User.findOne({ username });
    if (!user) return res.json({ success: false, message: "រកគណនីមិនឃើញទេ!" });

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
    } else if (String(user.accountNumber) === String(accountNumber)) {
      newStatus = !user.isFrozen;
      user.isFrozen = newStatus;
      updated = true;
    } else {
      const subAcc = user.subAccounts.find(
        (a) => String(a.accountNumber) === String(accountNumber),
      );
      if (subAcc) {
        newStatus = !subAcc.isFrozen;
        subAcc.isFrozen = newStatus;
        updated = true;

        if (subAcc.accountType === "junior") {
          const juniorUser = await User.findOne({
            $or: [
              { "mainAccounts.USD.accountNumber": accountNumber },
              { accountNumber: accountNumber },
            ],
          });
          if (juniorUser) {
            juniorUser.isFrozen = newStatus;
            if (juniorUser.mainAccounts?.USD)
              juniorUser.mainAccounts.USD.isFrozen = newStatus;
            if (juniorUser.mainAccounts?.KHR)
              juniorUser.mainAccounts.KHR.isFrozen = newStatus;
            await juniorUser.save();
          }
        }
      }
    }

    if (updated) {
      user.markModified("mainAccounts");
      user.markModified("subAccounts");
      await user.save();
      const safeUser = user.toObject();
      delete safeUser.password;
      delete safeUser.pin;
      res.json({
        success: true,
        isFrozen: newStatus,
        message: newStatus
          ? "គណនីត្រូវបានផ្អាកបណ្តោះអាសន្ន!"
          : "គណនីត្រូវបានបើកដំណើរការវិញ!",
        user: safeUser,
      });
    } else {
      res.json({ success: false, message: "រកគណនីមិនឃើញ!" });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: "មានបញ្ហា Server" });
  }
};

/**
 * 📌 លាក់ / បង្ហាញគណនី (Hide / Unhide)
 */
const toggleHideAccount = async (req, res) => {
  const { accountNumber } = req.body;
  const username = req.user.username;

  try {
    const user = await User.findOne({ username });
    if (!user) return res.json({ success: false, message: "រកគណនីមិនឃើញទេ!" });

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
      const subAcc = user.subAccounts.find(
        (a) => String(a.accountNumber) === String(accountNumber),
      );
      if (subAcc) {
        isHiddenNow = !subAcc.isHidden;
        subAcc.isHidden = isHiddenNow;
        updated = true;
      }
    }

    if (updated) {
      user.markModified("mainAccounts");
      user.markModified("subAccounts");
      await user.save();
      const safeUser = user.toObject();
      delete safeUser.password;
      delete safeUser.pin;
      res.json({
        success: true,
        user: safeUser,
        message: isHiddenNow ? "គណនីត្រូវបានលាក់!" : "គណនីត្រូវបានបង្ហាញ!",
      });
    } else {
      res.json({ success: false, message: "រកគណនីមិនឃើញ!" });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: "មានបញ្ហា Server" });
  }
};

// ==========================================
// 📡 ផ្នែកទី ៨៖ ការទាញយកទិន្នន័យ (Data Retrieval & Status)
// ==========================================

/**
 * 📌 ឆែកមើល User នៅ Online ឫអត់ (Heartbeat)
 */
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

/**
 * 📌 ទាញយកអ្នកប្រើប្រាស់ទាំងអស់ (សម្រាប់ Admin ឫ ប្រព័ន្ធ)
 */
const getUsers = async (req, res) => {
  try {
    const users = await User.find({});
    const allTransactions = await Transaction.find({}).sort({ createdAt: -1 });
    const allNotifications = await Notification.find({}).sort({
      createdAt: -1,
    });

    const allJointAccounts = await JointAccount.find({});
    const jointMap = {};
    allJointAccounts.forEach((ja) => {
      jointMap[ja.accountId] = ja.balance;
    });

    const usersWithTrx = users.map((user) => {
      const userObj = user.toObject();
      if (userObj.subAccounts && userObj.subAccounts.length > 0) {
        userObj.subAccounts.forEach((sa) => {
          if (
            (sa.accountType === "joint" || sa.accountType === "joint_member") &&
            jointMap[sa.accountId] !== undefined
          ) {
            sa.balance = jointMap[sa.accountId];
          }
        });
      }
      userObj.transactions = allTransactions.filter(
        (t) => t.username === user.username,
      );
      userObj.notifications = allNotifications.filter(
        (n) => n.username === user.username,
      );
      return userObj;
    });

    res.json(usersWithTrx);
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

/**
 * 📌 ផ្ទៀងផ្ទាត់ និងទាញយកឈ្មោះម្ចាស់គណនី (សម្រាប់ការផ្ទេរប្រាក់)
 */
const verifyAccount = async (req, res) => {
  const { account_number } = req.params;
  try {
    const targetUser = await User.findOne({
      $or: [
        { "mainAccounts.USD.accountNumber": account_number },
        { "mainAccounts.KHR.accountNumber": account_number },
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

// ==========================================
// 🤖 ផ្នែកទី ៩៖ ការតភ្ជាប់ជាមួយ Telegram
// ==========================================

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
      const oldChatId = user.telegramChatId; // 📌 រក្សាទុក Chat ID ទុកសិនមុនលុប
      const userFullName = user.fullName || user.username;

      user.telegramChatId = null;
      await user.save();

      // 🚀 ហៅ Telegram Bot ឱ្យបាញ់សារទៅប្រាប់ Group/Chat នោះថាបានផ្តាច់រួចរាល់
      if (oldChatId) {
        await bot.sendUserUnlinkAlert(oldChatId, userFullName);
      }

      res.json({ success: true });
    } else {
      res.json({ success: false, message: "រកមិនឃើញអ្នកប្រើប្រាស់ទេ!" });
    }
  } catch (err) {
    console.error("Unlink Telegram Error:", err);
    res.status(500).json({ success: false });
  }
};

// ==========================================
// 🛡️ ផ្នែកទី ១០៖ ការគ្រប់គ្រងដោយ Admin (Admin & System Operations)
// ==========================================

/**
 * 📌 ចូលគណនី Admin
 */
const adminLogin = async (req, res) => {
  const { username, password } = req.body;
  try {
    let isValid = false;
    let finalRole = "support_agent";
    let adminId = "";
    let fullName = username;
    let staffId = "UPAY-SYSTEM";

    const newAdminAcc = await Admin.findOne({ username: username });

    if (newAdminAcc) {
      if (newAdminAcc.isActive === false)
        return res.json({
          success: false,
          message: "គណនីរបស់អ្នកត្រូវបានបិទដោយ Super Admin!",
        });
      isValid = await bcrypt.compare(password, newAdminAcc.password);
      if (!isValid && newAdminAcc.password === password) isValid = true;
      if (isValid) {
        finalRole = newAdminAcc.role;
        adminId = newAdminAcc.id || newAdminAcc._id;
        fullName = newAdminAcc.fullName || newAdminAcc.username;
        staffId = newAdminAcc.staffId || "UPAY-SYSTEM";
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
        fullName = legacyAdmin.fullName || legacyAdmin.username;
        staffId = legacyAdmin.staffId || "UPAY-SUPER";
      }
    }

    if (!isValid)
      return res.json({
        success: false,
        message: "ឈ្មោះ ឬលេខសម្ងាត់ Admin មិនត្រឹមត្រូវទេ!",
      });

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
        fullName: fullName,
        staffId: staffId,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

/**
 * 📌 ចូលគណនី Admin ដោយប្រើកាត NFC
 */
const adminNfcLogin = async (req, res) => {
  const { nfcUid } = req.body;
  try {
    if (!nfcUid)
      return res.json({ success: false, message: "រកមិនឃើញលេខកូដកាត NFC ទេ!" });
    const adminAcc = await Admin.findOne({
      nfcUid: nfcUid.trim().toUpperCase(),
    });
    if (!adminAcc)
      return res.json({
        success: false,
        message: "កាត NFC នេះមិនត្រូវបានចុះបញ្ជីក្នុងប្រព័ន្ធទេ!",
      });
    if (adminAcc.isActive === false)
      return res.json({
        success: false,
        message: "គណនីកាត NFC នេះត្រូវបានបិទដោយ Super Admin!",
      });

    const finalRole = adminAcc.role;
    const token = jwt.sign(
      {
        id: adminAcc.id || adminAcc._id,
        username: adminAcc.username,
        role: finalRole,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );
    res.json({
      success: true,
      token: token,
      user: {
        username: adminAcc.username,
        role: finalRole,
        fullName: adminAcc.fullName || adminAcc.username,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

/**
 * 📌 ជម្លៀសប្រតិបត្តិការចាស់ៗចូលទៅ Schema ថ្មី (Data Migration)
 */
const migrateTransactions = async (req, res) => {
  try {
    const users = await User.find({ "transactions.0": { $exists: true } });
    let totalMigrated = 0;
    for (let user of users) {
      if (user.transactions && user.transactions.length > 0) {
        const trxsToInsert = user.transactions.map((t) => ({
          ...(t.toObject ? t.toObject() : t),
          username: user.username,
        }));
        await Transaction.insertMany(trxsToInsert);
        totalMigrated += trxsToInsert.length;
        user.transactions = undefined;
        await user.save();
      }
    }
    await User.updateMany({}, { $unset: { transactions: 1 } });
    res.json({
      success: true,
      message: `បានជម្លៀសប្រតិបត្តិការចាស់ៗចំនួន ${totalMigrated} ទៅកាន់ប្រព័ន្ធថ្មីដោយជោគជ័យ!`,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ==========================================
// 📤 ផ្នែកទី ១១៖ បញ្ចេញមុខងារ (Exports)
// ==========================================

module.exports = {
  // Auth & Registration
  requestRegisterOTP,
  verifyAndRegister,
  register,
  login,
  logout,

  // Forgot Password
  verifyUserAccount,
  verifyUser: verifyUserAccount, // ទុកឈ្មោះចាស់ការពារក្រែងលោ Frontend នៅហៅ
  verifyForgotOtp,
  resetPassword,
  sendSecurityOtp,

  // Security & Profile
  verifyCurrentPassword,
  verifyCurrentPin,
  changePassword,
  changePin,
  uploadImage,
  submitKyc,

  // Account Management
  renameAccount,
  updateAccountLimit,
  toggleFreezeAccount,
  toggleHideAccount,

  // Data & Status
  heartbeat,
  getUsers,
  verifyAccount,

  // Telegram
  generateTelegramCode,
  unlinkTelegram,

  // Admin
  adminLogin,
  adminNfcLogin,
  migrateTransactions,
};
