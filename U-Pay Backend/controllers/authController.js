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
const Tesseract = require("tesseract.js");

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

/**
 * 📌 បង្កើត User ID ៨ ខ្ទង់ (សម្រាប់ធ្វើជា Referral Code ណែនាំមិត្តភ័ក្តិ)
 */
const generateUserId = async () => {
  let isUnique = false;
  let newUserId = "";

  while (!isUnique) {
    // បង្កើតលេខចៃដន្យ ៨ ខ្ទង់ (ចាប់ពី 10000000 ដល់ 99999999)
    newUserId = Math.floor(10000000 + Math.random() * 90000000).toString();
    const exists = await User.findOne({ userId: newUserId });
    if (!exists) isUnique = true;
  }
  return newUserId;
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
    // 🟢 ១. ស្វែងរកអតិថិជនសិន ដើម្បីឆែក Password និងស្ថានភាពគណនី
    let user = await User.findOne({
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

      // 🟢 ២. ប្រើប្រាស់ findOneAndUpdate ដើម្បីធានាថា Database ត្រូវបាន Update ពិតប្រាកដ ១០០%
      user = await User.findOneAndUpdate(
        { _id: user._id },
        {
          $set: {
            forceLogout: false, // 🔓 ដោះសោរ
            isOnline: true,
            lastActive: new Date().toISOString(),
          },
        },
        { new: true }, // យកទិន្នន័យដែល Update រួចមកប្រើបន្ត
      );

      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: "7d" },
      );

      const safeUser = user.toObject();

      // ការធ្វើបច្ចុប្បន្នភាពគណនី Joint (រក្សាកូដចាស់ដដែល)
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
    console.error("Login Error:", err);
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
 * - ឆែកកុំឱ្យស្ទួន Username, Phone, Email
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
 * 📌 ផ្ទៀងផ្ទាត់ OTP រួចទើបបង្កើតគណនីពិតប្រាកដ (Verify & Register - អាប់ដេតថ្មី)
 * - ទទួលយកទិន្នន័យ KYC, រូបថត, លេខអ្នកណែនាំ, ភេទ និងថ្ងៃខែឆ្នាំកំណើត
 */
const verifyAndRegister = async (req, res) => {
  const {
    username,
    password,
    fullName,
    phone,
    email,
    pin,
    otp,
    dob,
    gender,
    idNumber,
    referralCode,
    duplicateReason,
    idCardUrl,
    selfieUrl,
  } = req.body;

  try {
    // ៤.១ ផ្ទៀងផ្ទាត់កូដ OTP
    const validOtp = await Otp.findOne({ email: email, otp: otp });
    if (!validOtp) {
      return res.status(400).json({
        success: false,
        message: "លេខកូដ OTP មិនត្រឹមត្រូវ ឬផុតកំណត់!",
      });
    }

    // ៤.២ ឆែកការពារក្រែងលោមានអ្នកបង្កើតគណនីស្របគ្នាក្នុងពេលតែមួយ
    const existingUser = await User.findOne({
      $or: [{ username }, { phone }, { email }],
    });
    if (existingUser) {
      return res
        .status(400)
        .json({ success: false, message: "គណនីនេះត្រូវបានចុះឈ្មោះរួចហើយ!" });
    }

    // ៤.៣ បង្កើតលេខគណនីធនាគារ និង លេខសម្គាល់អ្នកប្រើប្រាស់ ៨ខ្ទង់
    const newAccs = await generatePatternAccounts();
    const newUserId = await generateUserId();
    const tsId = Date.now().toString();

    // ៤.៤ រៀបចំស្ថានភាព KYC (បើមានរូប Upload គឺដាក់ Pending)
    let initialKycStatus = "unverified";
    if (idCardUrl && selfieUrl) {
      initialKycStatus = "pending";
    }

    // ៤.៥ បង្កើតគណនីថ្មី
    const newUser = new User({
      id: tsId,
      userId: newUserId,
      username,
      password,
      email,
      fullName: fullName || username,
      phone,
      dob: dob || "",
      gender: gender || "",
      idNumber: idNumber || "",
      referredBy: referralCode || "",
      pin,

      duplicateIdReason: duplicateReason || "",
      kycStatus: initialKycStatus,
      kycDocument: idCardUrl || "",
      selfieUrl: selfieUrl || "",
      kycSubmittedAt: initialKycStatus === "pending" ? getFormattedDate() : "",

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

    // ៤.៦ លុបកូដ OTP ចោលក្រោយប្រើប្រាស់រួច
    await Otp.deleteOne({ _id: validOtp._id });

    // ៤.៧ បង្កើត Token សម្រាប់ Login ដោយស្វ័យប្រវត្តិ
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
 * - រក្សាទុកដដែលដើម្បីកុំឱ្យ Error ជាមួយប្រព័ន្ធចាស់ៗ
 */
const register = async (req, res) => {
  const { username, password, fullName, phone, pin } = req.body;
  try {
    const existingUser = await User.findOne({ username });
    if (existingUser)
      return res.json({ success: false, message: "Username already taken!" });

    const newAccs = await generatePatternAccounts();
    const newUserId = await generateUserId();
    const tsId = Date.now().toString();

    const newUser = new User({
      id: tsId,
      userId: newUserId,
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
 * 📌 បញ្ជូនឯកសារ KYC (ពីមុខងារ Settings)
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

// ============================================================================
// ⚙ MRZ HELPER FUNCTIONS & ICAO VALIDATION
// ============================================================================
const MRZ_LETTER_TO_DIGIT = {
  O: "0",
  Q: "0",
  D: "0",
  I: "1",
  L: "1",
  Z: "2",
  S: "5",
  G: "6",
  T: "7",
  B: "8",
  A: "4",
};

function cleanOcrText(text = "") {
  return text
    .toUpperCase()
    .replace(/[|¦]/g, "I")
    .replace(/[“”"'`]/g, "")
    .replace(/[‐-–—]/g, "-")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function normalizeMrzChars(line = "") {
  return line
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9<]/g, "");
}

function normalizeNumeric(value = "") {
  return value
    .toUpperCase()
    .split("")
    .map((ch) => (/^\d$/.test(ch) ? ch : MRZ_LETTER_TO_DIGIT[ch] || ch))
    .join("");
}

// 🟢 ជួសជុល Filler << ដែល OCR អានខុសជា L ឬ K
function repairMrzFiller(value = "") {
  return normalizeMrzChars(value).replace(/[LK]{2,}/g, "<<");
}

function repairIdPrefix(value = "") {
  let x = normalizeMrzChars(value);
  if (/^BFKHM/i.test(x)) {
    x = x.replace(/^BFKHM/i, "IDKHM");
  } else if (/^1DKHM/i.test(x)) {
    x = x.replace(/^1DKHM/i, "IDKHM");
  } else if (/^IOKHM/i.test(x)) {
    x = x.replace(/^IOKHM/i, "IDKHM");
  }
  return x;
}

// 🟢 កែសម្រួល cleanMrzName ឱ្យរក្សាទុកការដកឃ្លា (Space) រវាង නាមត្រកូល និងនាមខ្លួន
function cleanMrzName(value = "") {
  if (!value) return null;
  const repaired = repairMrzFiller(value);
  const cleaned = repaired
    .replace(/</g, " ") // ប្តូរសញ្ញា < ទៅជា Space វិញ ដើម្បីឱ្យមានដកឃ្លា
    .replace(/[^A-Z ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || null;
}

// 🧮 ICAO 7-3-1 Check Digit Algorithm
function mrzCheckDigit(value = "") {
  const weights = [7, 3, 1];
  let sum = 0;
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    let valueNumber = 0;
    if (ch === "<") valueNumber = 0;
    else if (/^\d$/.test(ch)) valueNumber = Number(ch);
    else if (/^[A-Z]$/.test(ch)) valueNumber = ch.charCodeAt(0) - 55;
    sum += valueNumber * weights[i % 3];
  }
  return String(sum % 10);
}

function validateMrzCheckDigit(data, checkDigit) {
  if (!data || !/^\d$/.test(checkDigit)) return false;
  return mrzCheckDigit(data) === checkDigit;
}

function parseMrzDate(value) {
  if (!value) return null;
  const normalized = normalizeNumeric(value);
  if (!/^\d{6}$/.test(normalized)) return null;

  const yy = Number(normalized.substring(0, 2));
  const mm = Number(normalized.substring(2, 4));
  const dd = Number(normalized.substring(4, 6));

  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;

  const currentYear = new Date().getFullYear();
  const currentYY = currentYear % 100;
  const fullYear = yy <= currentYY ? 2000 + yy : 1900 + yy;

  const date = new Date(Date.UTC(fullYear, mm - 1, dd));
  if (
    date.getUTCFullYear() !== fullYear ||
    date.getUTCMonth() !== mm - 1 ||
    date.getUTCDate() !== dd
  )
    return null;

  return `${fullYear}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

// ============================================================================
// 🛂 DOCUMENT SPECIFIC PARSERS
// ============================================================================

function parseKhmerIdMRZ(lines) {
  if (!lines || lines.length < 3) return null;
  const line1 = normalizeMrzChars(lines[0]);
  const line2 = normalizeMrzChars(lines[1]);
  const line3 = normalizeMrzChars(lines[2]);

  // LINE 1: IDKHM + 9 digit ID
  const idMatch = line1.match(
    /^ID.?KHM([0-9OQDILZSGTBA]{9})([0-9OQDILZSGTBA])/i,
  );
  let idNumber = null,
    idCheckDigit = null,
    idCheckValid = false;

  if (idMatch) {
    idNumber = normalizeNumeric(idMatch[1]);
    idCheckDigit = normalizeNumeric(idMatch[2]);
    if (/^\d{9}$/.test(idNumber) && /^\d$/.test(idCheckDigit)) {
      idCheckValid = validateMrzCheckDigit(idNumber, idCheckDigit);
    }
  }

  // LINE 2: YYMMDD + CHECK + GENDER
  let dob = null,
    gender = null,
    dobCheckValid = false;
  if (line2.length >= 8) {
    const dobRaw = line2.substring(0, 6);
    const dobCheck = line2.substring(6, 7);
    const genderRaw = line2.substring(7, 8);

    const normalizedDob = normalizeNumeric(dobRaw);
    if (/^\d{6}$/.test(normalizedDob)) {
      dob = parseMrzDate(normalizedDob);
      if (/^\d$/.test(dobCheck)) {
        dobCheckValid = validateMrzCheckDigit(normalizedDob, dobCheck);
      }
    }

    if (genderRaw === "M") gender = "Male";
    else if (genderRaw === "F") gender = "Female";
  }

  // LINE 3: SURNAME<<GIVEN NAME
  let fullName = null;
  const repairedLine3 = repairMrzFiller(line3);

  if (repairedLine3.includes("<<")) {
    const nameParts = repairedLine3.split("<<").filter(Boolean);
    if (nameParts.length > 0) {
      const surname = nameParts[0];
      const givenName = nameParts.slice(1).join(" ");
      fullName = cleanMrzName(`${surname} ${givenName}`);
    }
  }

  return {
    documentType: "KHMER_ID_CARD",
    idNumber,
    passportNumber: null,
    fullName,
    dob,
    gender,
    validation: {
      idNumber: /^\d{9}$/.test(idNumber || ""),
      idCheckDigit: idCheckValid,
      dob: dob !== null,
      dobCheckDigit: dobCheckValid,
      gender: gender !== null,
      fullName: !!fullName,
    },
  };
}

function parseKhmerPassportMRZ(lines) {
  if (!lines || lines.length < 2) return null;
  const line1 = normalizeMrzChars(lines[0]);
  const line2 = normalizeMrzChars(lines[1]);

  let fullName = null;

  if (/^P</i.test(line1) && line1.length >= 6) {
    const issuingState = line1.substring(2, 5);
    const namePart = line1.substring(5);

    if (issuingState === "KHM" && namePart.includes("<<")) {
      const parts = namePart.split("<<").filter(Boolean);
      if (parts.length > 0) {
        fullName = cleanMrzName(parts.join(" "));
      }
    }
  }

  let passportNumber = null,
    passCheckValid = false,
    dob = null,
    gender = null,
    dobCheckValid = false;

  if (line2.length >= 21) {
    const passRaw = line2.substring(0, 9);
    const passCheck = line2.substring(9, 10);
    passportNumber = passRaw.replace(/<+$/, "");

    const normalizedPassCheck = normalizeNumeric(passCheck);

    if (/^\d$/.test(normalizedPassCheck)) {
      passCheckValid = validateMrzCheckDigit(passRaw, normalizedPassCheck);
    }

    const dobRaw = line2.substring(13, 19);
    const dobCheck = line2.substring(19, 20);
    const genderRaw = line2.substring(20, 21).toUpperCase();
    const normalizedDob = normalizeNumeric(dobRaw);

    if (/^\d{6}$/.test(normalizedDob)) {
      dob = parseMrzDate(normalizedDob);
      if (/^\d$/.test(dobCheck)) {
        dobCheckValid = validateMrzCheckDigit(normalizedDob, dobCheck);
      }
    }
    if (genderRaw === "M") gender = "Male";
    else if (genderRaw === "F") gender = "Female";
  }

  return {
    documentType: "KHMER_PASSPORT",
    idNumber: null,
    passportNumber,
    fullName,
    dob,
    gender,
    validation: {
      documentNumber: !!passportNumber,
      documentNumberCheckDigit: passCheckValid,
      dob: dob !== null,
      dobCheckDigit: dobCheckValid,
      gender: gender !== null,
      fullName: !!fullName,
    },
  };
}

// ============================================================================
// 🏆 CANDIDATE VOTING & SCORING (ID Card & Passport)
// ============================================================================

function scoreIdCombination(line1, line2, line3) {
  let score = 0;
  const parsed = parseKhmerIdMRZ([line1, line2, line3]);

  if (!parsed) return { score: -1, parsed: null };

  if (line1.length >= 30) score += 10;
  if (line2.length >= 30) score += 10;
  if (line3.length >= 30) score += 10;

  if (parsed.validation.idNumber) score += 20;
  if (parsed.validation.idCheckDigit) score += 30;
  if (parsed.validation.dob) score += 15;
  if (parsed.validation.dobCheckDigit) score += 20;
  if (parsed.validation.gender) score += 5;
  if (parsed.validation.fullName) score += 10;

  return { score, parsed };
}

function findBestIdMrzCombination(
  line1Candidates,
  line2Candidates,
  line3Candidates,
) {
  let best = null;
  for (const line1 of line1Candidates) {
    for (const line2 of line2Candidates) {
      for (const line3 of line3Candidates) {
        const result = scoreIdCombination(line1, line2, line3);
        if (result.parsed && (!best || result.score > best.score)) {
          best = {
            line1,
            line2,
            line3,
            score: result.score,
            parsed: result.parsed,
          };
        }
      }
    }
  }
  return best;
}

function scorePassportCombination(line1, line2) {
  const parsed = parseKhmerPassportMRZ([line1, line2]);
  if (!parsed) return { score: -1, parsed: null };

  let score = 0;
  if (line1.length === 44) score += 20;
  if (line2.length === 44) score += 20;

  if (parsed.validation.documentNumber) score += 20;
  if (parsed.validation.documentNumberCheckDigit) score += 30;
  if (parsed.validation.dob) score += 15;
  if (parsed.validation.dobCheckDigit) score += 20;
  if (parsed.validation.gender) score += 5;
  if (parsed.validation.fullName) score += 10;

  return { score, parsed };
}

function findBestPassportMrzCombination(line1Candidates, line2Candidates) {
  let best = null;
  for (const line1 of line1Candidates) {
    for (const line2 of line2Candidates) {
      const result = scorePassportCombination(line1, line2);
      if (result.parsed && (!best || result.score > best.score)) {
        best = { line1, line2, score: result.score, parsed: result.parsed };
      }
    }
  }
  return best;
}

function extractMrzLines(lines = []) {
  const normalized = [...new Set(lines.map(normalizeMrzChars).filter(Boolean))];

  // ============================================================
  // ID CARD CANDIDATES (TD1)
  // ============================================================
  const idLine1Candidates = normalized
    .map(repairIdPrefix)
    .filter((x) => /^(?:ID|1D|I[O0]).{0,3}KHM/i.test(x));

  const idLine2Candidates = normalized.filter((x) =>
    /^\d{6}\d[MF]/i.test(normalizeNumeric(x)),
  );

  // 🟢 រឹតបន្តឹង Line 3៖ បដិសេធដាច់ខាតនូវ Line 1 និង Line 2 កុំឱ្យមកធ្វើជា Line 3
  const idLine3Candidates = normalized.filter((x) => {
    if (/^(?:ID|1D|I[O0])/i.test(x)) return false;
    if (/^\d{6}/.test(normalizeNumeric(x))) return false;

    // បន្ទាប់ពីជួសជុល L ឬ K ត្រូវតែមាន << ទើបចាត់ទុកថាជាឈ្មោះ
    return repairMrzFiller(x).includes("<<");
  });

  if (
    idLine1Candidates.length &&
    idLine2Candidates.length &&
    idLine3Candidates.length
  ) {
    const best = findBestIdMrzCombination(
      idLine1Candidates,
      idLine2Candidates,
      idLine3Candidates,
    );
    if (best) return [best.line1, best.line2, best.line3];
  }

  // ============================================================
  // PASSPORT CANDIDATES (TD3)
  // ============================================================
  const passportLine1Candidates = normalized.filter(
    (x) => /^P</i.test(x) || /^P.?KHM/i.test(x),
  );

  const passportLine2Candidates = normalized.filter((x) => {
    if (x.length < 21) return false;
    const normalizedLine = normalizeNumeric(x);
    const dob = normalizedLine.substring(13, 19);
    const gender = x.substring(20, 21).toUpperCase();
    return /^\d{6}$/.test(dob) && ["M", "F"].includes(gender);
  });

  if (passportLine1Candidates.length && passportLine2Candidates.length) {
    const best = findBestPassportMrzCombination(
      passportLine1Candidates,
      passportLine2Candidates,
    );
    if (best) return [best.line1, best.line2];
  }

  // 🔴 គ្មាន Generic Fallback ទេ!
  return [];
}

// ============================================================================
// 🔄 MULTI-PASS OCR ENGINE
// ============================================================================
async function runMultipleOCR(imageUrl) {
  const configs = [
    { psm: 6, name: "PSM6" },
    { psm: 11, name: "PSM11" },
    { psm: 12, name: "PSM12" },
  ];
  const results = [];

  for (const config of configs) {
    try {
      const {
        data: { text },
      } = await Tesseract.recognize(imageUrl, "eng", {
        logger: (m) => {
          if (m.status === "recognizing text")
            console.log(
              `[${config.name}] OCR: ${Math.round(m.progress * 100)}%`,
            );
        },
        tessedit_pageseg_mode: String(config.psm),
        // 🟢 អនុញ្ញាត K ដើម្បីឱ្យ repairMrzFiller អាចកែវាទៅជា << វិញបាន
        tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<LKI",
      });
      results.push({ mode: config.name, text: text || "" });
    } catch (error) {
      console.error(`OCR ${config.name} failed:`, error.message);
    }
  }
  return results;
}

// ============================================================================
// 🚀 MAIN API CONTROLLER: scanIdCard
// ============================================================================
const scanIdCard = async (req, res) => {
  const { imageUrl } = req.body;
  if (!imageUrl)
    return res.status(400).json({ success: false, message: "មិនមានរូបភាពទេ!" });

  try {
    console.log("====================================");
    console.log("Starting Smart MRZ OCR (Strict Mode without Fallback)...");
    console.log("====================================");

    // 1. MULTI-PASS OCR
    const ocrResults = await runMultipleOCR(imageUrl);
    if (!ocrResults.length) {
      return res
        .status(400)
        .json({ success: false, message: "មិនអាចអាន OCR បានទេ!" });
    }

    // 2. MERGE OCR TEXT
    const allOcrLines = [];
    for (const result of ocrResults) {
      const cleaned = cleanOcrText(result.text);
      allOcrLines.push(...cleaned);
    }
    const uniqueLines = [...new Set(allOcrLines)];

    // 3. FIND MRZ
    const mrzLines = extractMrzLines(uniqueLines);
    if (!mrzLines || !mrzLines.length) {
      return res.status(400).json({
        success: false,
        message:
          "មិនអាចរកខ្សែអក្សរ MRZ តាមស្តង់ដារបានទេ។ សូមថតឯកសារឱ្យច្បាស់ និងត្រង់។",
        rawOcrText: ocrResults.map((x) => x.text).join("\n"),
      });
    }

    // 4. DOCUMENT TYPE & PARSING
    const mrzJoined = mrzLines.join("");
    const isKhmerId = /^(?:ID|1D|I[O0])/i.test(mrzLines[0]);
    const isPassport = /^P/i.test(mrzLines[0]);

    let parsedResult = null;

    if (isKhmerId) {
      parsedResult = parseKhmerIdMRZ(mrzLines);
    } else if (isPassport) {
      parsedResult = parseKhmerPassportMRZ(mrzLines);
    }

    if (!parsedResult) {
      return res.status(400).json({
        success: false,
        message:
          "មិនអាចបញ្ជាក់ថាជា Khmer ID Card ឬ Khmer Passport ពី MRZ បានទេ។",
        mrzLines,
      });
    }

    // 5. SMART CONFIDENCE SCORING
    let confidence = 0;

    if (parsedResult.documentType === "KHMER_ID_CARD") {
      if (parsedResult.validation.idNumber) confidence += 20;
      if (parsedResult.validation.idCheckDigit) confidence += 20;
    } else {
      if (parsedResult.validation.documentNumber) confidence += 20;
      if (parsedResult.validation.documentNumberCheckDigit) confidence += 20;
    }

    if (parsedResult.validation.fullName) confidence += 20;
    if (parsedResult.validation.dob) confidence += 15;
    if (parsedResult.validation.dobCheckDigit) confidence += 15;
    if (parsedResult.validation.gender) confidence += 10;

    confidence = Math.min(100, confidence);

    let status;
    if (confidence >= 90) status = "VERY_HIGH";
    else if (confidence >= 75) status = "HIGH";
    else if (confidence >= 50) status = "MEDIUM";
    else status = "LOW";

    // 6. FINAL VERIFICATION
    let mrzValid = false;
    if (parsedResult.documentType === "KHMER_ID_CARD") {
      mrzValid =
        parsedResult.validation.idNumber &&
        parsedResult.validation.idCheckDigit &&
        parsedResult.validation.dob &&
        parsedResult.validation.dobCheckDigit &&
        parsedResult.validation.fullName &&
        parsedResult.validation.gender;
    } else if (parsedResult.documentType === "KHMER_PASSPORT") {
      mrzValid =
        parsedResult.validation.documentNumber &&
        parsedResult.validation.documentNumberCheckDigit &&
        parsedResult.validation.dob &&
        parsedResult.validation.dobCheckDigit &&
        parsedResult.validation.fullName &&
        parsedResult.validation.gender;
    }

    return res.json({
      success: true,
      data: {
        documentType: parsedResult.documentType,
        idNumber:
          parsedResult.documentType === "KHMER_ID_CARD"
            ? parsedResult.idNumber
            : null,
        passportNumber: parsedResult.passportNumber || null,
        fullName: parsedResult.fullName,
        dob: parsedResult.dob,
        gender: parsedResult.gender,
      },
      verification: {
        mrzValid,
        mrzConfidence: confidence,
        documentAuthenticity: null,
        status,
      },
      validation: parsedResult.validation,
      mrz: { lines: mrzLines, joined: mrzLines.join("") },
      rawOcrText: ocrResults.map((x) => x.text).join("\n--- OCR PASS ---\n"),
    });
  } catch (err) {
    console.error("Smart OCR Error:", err);
    return res.status(500).json({
      success: false,
      message: "បរាជ័យក្នុងការស្កេនឯកសារ។ សូមព្យាយាមថតរូបម្ដងទៀត។",
    });
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

/**
 * 📌 ឆែកមើលថា Username មានអ្នកប្រើប្រាស់ហើយឬនៅ (Real-time check)
 */
const checkUsername = async (req, res) => {
  try {
    const { username } = req.body;
    // ឆែករកឈ្មោះដោយបំប្លែងជាអក្សរតូចទាំងអស់
    const user = await User.findOne({ username: username.toLowerCase() });
    if (user) return res.json({ available: false });
    return res.json({ available: true });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * 📌 ឆែកមើលថា លេខអត្តសញ្ញាណប័ណ្ណ មានក្នុងប្រព័ន្ធហើយឬនៅ
 */
const checkIdNumber = async (req, res) => {
  try {
    const { idNumber } = req.body;
    const user = await User.findOne({ idNumber: idNumber });
    if (user) return res.json({ exists: true });
    return res.json({ exists: false });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * 📌 ឆែកមើលលេខកូដអ្នកណែនាំ (Referral Code) ថាមានពិតឬអត់
 */
const checkReferralCode = async (req, res) => {
  try {
    const { referralCode } = req.body;
    // ស្វែងរកអ្នកប្រើប្រាស់ដែលមាន userId ស្មើនឹង referralCode
    const user = await User.findOne({ userId: referralCode });

    if (user) {
      // បើមាន បោះឈ្មោះពេញរបស់គាត់ទៅឱ្យ Frontend បង្ហាញ
      return res.json({
        valid: true,
        referrerName: user.fullName || user.username,
      });
    }
    return res.json({ valid: false });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
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
      const oldChatId = user.telegramChatId;
      const userFullName = user.fullName || user.username;

      user.telegramChatId = null;
      await user.save();

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
  verifyUser: verifyUserAccount,
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
  scanIdCard,

  // Account Management
  renameAccount,
  updateAccountLimit,
  toggleFreezeAccount,
  toggleHideAccount,

  // Data & Status
  heartbeat,
  getUsers,
  verifyAccount,
  checkUsername,
  checkIdNumber,
  checkReferralCode,

  // Telegram
  generateTelegramCode,
  unlinkTelegram,

  // Admin
  adminLogin,
  adminNfcLogin,
  migrateTransactions,
};
