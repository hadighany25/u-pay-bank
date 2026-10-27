// ============================================================================
// ឯកសារ: controllers/authController.js
// អត្ថន័យ: គ្រប់គ្រងការចុះឈ្មោះ, ចូលគណនី, ការកំណត់ទម្រង់គណនី និងគ្រប់គ្រងគណនី (Strict _id Binding)
// ============================================================================

// ==========================================
// 📦 ផ្នែកទី ១៖ ទាញយក Modules, Models និង Utils
// ==========================================
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const Tesseract = require("tesseract.js");
const crypto = require("crypto");
const { sendOTP, sendResetLink } = require("../utils/sendEmail");

// តារាងទិន្នន័យ (Database Models)
const User = require("../models/User");
const Transaction = require("../models/Transaction");
const JointAccount = require("../models/JointAccount");
const Admin = require("../models/Admin");
const Notification = require("../models/Notification");
const Otp = require("../models/Otp");

// មុខងារជំនួយ (Services & Utils)
const bot = require("../services/telegramBot");
const { getFormattedDate } = require("../services/helpers");

// អថេរសម្រាប់ផ្ទុក OTP បណ្តោះអាសន្នពេលភ្លេចលេខសម្ងាត់
let tempForgotOtps = {};

// ==========================================
// 🛠️ ផ្នែកទី ២៖ មុខងារជំនួយទូទៅ (Helper Functions)
// ==========================================

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

const generateUserId = async () => {
  let isUnique = false;
  let newUserId = "";

  while (!isUnique) {
    newUserId = Math.floor(10000000 + Math.random() * 90000000).toString();
    const exists = await User.findOne({ userId: newUserId });
    if (!exists) isUnique = true;
  }
  return newUserId;
};

// ==========================================
// 🚪 ផ្នែកទី ៣៖ ការចូល និងចាកចេញ (Login & Logout)
// ==========================================

const login = async (req, res) => {
  const { identifier, password } = req.body;
  try {
    let user = await User.findOne({
      $or: [
        { username: identifier },
        { phone: identifier },
        { email: identifier },
        { fullName: identifier },
      ],
    });

    if (!user) {
      return res.json({
        success: false,
        message: "ព័ត៌មានគណនីមិនត្រឹមត្រូវទេ (Invalid Credentials)",
      });
    }

    if (user.isFrozen) {
      return res.json({
        success: false,
        message: "គណនីរបស់អ្នកត្រូវបានបិទ (Frozen)! សូមទាក់ទងមកកាន់ធនាគារ។",
      });
    }

    if (user.password !== password) {
      user.passwordAttempts = (user.passwordAttempts || 0) + 1;

      if (user.passwordAttempts >= 5) {
        user.isFrozen = true;
        await user.save();
        return res.json({
          success: false,
          message:
            "អ្នកបានវាយពាក្យសម្ងាត់ខុស ៥ដង! គណនីត្រូវបានផ្អាកជាបណ្តោះអាសន្ន ដើម្បីសុវត្ថិភាព។",
        });
      }

      await user.save();
      return res.json({
        success: false,
        message: `ពាក្យសម្ងាត់មិនត្រឹមត្រូវ! អ្នកនៅសល់ឱកាស ${5 - user.passwordAttempts} ដងទៀត។`,
      });
    }

    const clientIp =
      req.headers["x-forwarded-for"] ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      "Unknown IP";
    const cleanIp = clientIp.replace(/^.*:/, "");

    const rawUserAgent = req.headers["user-agent"] || "";
    let deviceName = "Unknown Device";
    if (rawUserAgent.includes("iPhone")) deviceName = "Apple iPhone";
    else if (rawUserAgent.includes("iPad")) deviceName = "Apple iPad";
    else if (rawUserAgent.includes("Android")) deviceName = "Android Device";
    else if (rawUserAgent.includes("Windows")) deviceName = "Windows PC";
    else if (rawUserAgent.includes("Mac")) deviceName = "Mac OS";
    else if (rawUserAgent.includes("Postman")) deviceName = "Postman / API";
    else deviceName = rawUserAgent.substring(0, 30) + "...";

    const currentLoginTime = new Date().toISOString();

    const newDeviceObj = {
      ip: cleanIp,
      device: deviceName,
      time: currentLoginTime,
    };

    user = await User.findOneAndUpdate(
      { _id: user._id },
      {
        $set: {
          forceLogout: false,
          isOnline: true,
          lastActive: currentLoginTime,
          lastIp: cleanIp,
          lastDevice: deviceName,
          lastLogin: currentLoginTime,
          passwordAttempts: 0,
        },
        $push: {
          connectedDevices: {
            $each: [newDeviceObj],
            $position: 0,
            $slice: 4,
          },
        },
      },
      { new: true },
    );

    const token = jwt.sign(
      { id: user.id || user._id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    const safeUser = user.toObject();

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
            (sa.accountType === "joint" || sa.accountType === "joint_member") &&
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
  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

const logout = async (req, res) => {
  const { username, userId } = req.body;
  try {
    const query =
      userId && mongoose.isValidObjectId(userId)
        ? { _id: userId }
        : { username };
    await User.findOneAndUpdate(
      query,
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
    await Otp.deleteMany({ email: email });
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

const verifyRegisterOTP = async (req, res) => {
  const { email, otp } = req.body;
  try {
    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "សូមបញ្ចូលអ៊ីមែល និងលេខកូដ OTP ៦ខ្ទង់!",
      });
    }

    const validOtp = await Otp.findOne({
      email: { $regex: new RegExp("^" + email.trim() + "$", "i") },
      otp: String(otp).trim(),
    });

    if (!validOtp) {
      return res.status(400).json({
        success: false,
        message: "លេខកូដ OTP មិនត្រឹមត្រូវទេ! សូមពិនិត្យម្ដងទៀត។",
      });
    }

    await Otp.deleteOne({ _id: validOtp._id });

    return res.json({
      success: true,
      message:
        "ផ្ទៀងផ្ទាត់ OTP ជោគជ័យ! អ្នកអាចបំពេញព័ត៌មានបន្តដោយគ្មានកំណត់ម៉ោង។",
    });
  } catch (error) {
    console.error("Verify Register OTP Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

const verifyAndRegister = async (req, res) => {
  const {
    username,
    password,
    fullName,
    phone,
    email,
    pin,
    otp,
    otpVerified,
    dob,
    gender,
    idNumber,
    referralCode,
    duplicateReason,
    duplicateIdReason,
    idCardUrl,
    selfieUrl,
  } = req.body;

  try {
    if (!otpVerified) {
      const validOtp = await Otp.findOne({ email: email, otp: otp });
      if (validOtp) {
        await Otp.deleteOne({ _id: validOtp._id });
      }
    }

    const existingUser = await User.findOne({
      $or: [{ username }, { phone }, { email }],
    });
    if (existingUser) {
      return res
        .status(400)
        .json({ success: false, message: "គណនីនេះត្រូវបានចុះឈ្មោះរួចហើយ!" });
    }

    const cleanIdNumber = String(idNumber || "").trim();
    let finalDuplicateReason = String(
      duplicateReason || duplicateIdReason || "",
    ).trim();

    let existingSameIdUsers = [];
    if (cleanIdNumber && cleanIdNumber !== "N/A") {
      existingSameIdUsers = await User.find({ idNumber: cleanIdNumber });
      if (existingSameIdUsers.length > 0 && !finalDuplicateReason) {
        return res.status(400).json({
          success: false,
          requireDuplicateReason: true,
          message:
            "លេខអត្តសញ្ញាណប័ណ្ណនេះធ្លាប់បានប្រើប្រាស់រួចហើយ! សូមបញ្ចូលមូលហេតុនៃការបើកគណនីបន្ថែម។",
        });
      }
    }

    const newAccs = await generatePatternAccounts();
    const newUserId = await generateUserId();
    const tsId = Date.now().toString();

    let initialKycStatus = "unverified";
    if (idCardUrl && selfieUrl) {
      initialKycStatus = "pending";
    }

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
      idNumber: cleanIdNumber,
      referredBy: referralCode || "",
      pin,

      duplicateIdReason: finalDuplicateReason,
      kycStatus: initialKycStatus,
      kycDocument: idCardUrl || "",
      kycImage: idCardUrl || "",
      selfieUrl: selfieUrl || "",
      kycSubmittedAt: initialKycStatus === "pending" ? getFormattedDate() : "",
      kycUploadedBy: "អតិថិជនផ្ទាល់",

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

    if (
      cleanIdNumber &&
      cleanIdNumber !== "N/A" &&
      (existingSameIdUsers.length > 0 || finalDuplicateReason)
    ) {
      const reasonToSync =
        finalDuplicateReason ||
        existingSameIdUsers.find((u) => u.duplicateIdReason)
          ?.duplicateIdReason ||
        "ប្រើប្រាស់អត្តសញ្ញាណប័ណ្ណរួមគ្នា (Multiple Accounts)";

      await User.updateMany(
        { idNumber: cleanIdNumber },
        { $set: { duplicateIdReason: reasonToSync } },
      );
      newUser.duplicateIdReason = reasonToSync;
    }

    const token = jwt.sign(
      {
        id: newUser.id || newUser._id,
        username: newUser.username,
        role: newUser.role,
      },
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

// ==========================================
// 🔑 ផ្នែកទី ៥៖ ការសង្គ្រោះគណនី (Forgot Password)
// ==========================================

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

const sendSecurityOtp = async (req, res) => {
  const { email, purpose } = req.body;
  try {
    const user = await User.findOne({ email: email });
    if (!user)
      return res.json({ success: false, message: "រកមិនឃើញគណនីអ៊ីមែលនេះទេ!" });

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    await Otp.create({ email: user.email, otp: otpCode });

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

const verifyCurrentPassword = async (req, res) => {
  const { username, userId, password } = req.body;
  try {
    const targetUserId =
      userId || (req.user ? req.user._id || req.user.id : null);
    const user =
      targetUserId && mongoose.isValidObjectId(targetUserId)
        ? await User.findById(targetUserId)
        : await User.findOne({
            username: username || (req.user ? req.user.username : ""),
          });

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

const verifyCurrentPin = async (req, res) => {
  const { username, userId, pin } = req.body;
  try {
    const targetUserId =
      userId || (req.user ? req.user._id || req.user.id : null);
    const user =
      targetUserId && mongoose.isValidObjectId(targetUserId)
        ? await User.findById(targetUserId)
        : await User.findOne({
            username: username || (req.user ? req.user.username : ""),
          });

    if (user && user.pin === pin) {
      res.json({ success: true });
    } else {
      res.json({ success: false, message: "លេខ PIN ចាស់មិនត្រឹមត្រូវទេ!" });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

const changePassword = async (req, res) => {
  const { username, userId, oldPassword, newPassword } = req.body;
  try {
    const targetUserId =
      userId || (req.user ? req.user._id || req.user.id : null);
    const user =
      targetUserId && mongoose.isValidObjectId(targetUserId)
        ? await User.findById(targetUserId)
        : await User.findOne({
            username: username || (req.user ? req.user.username : ""),
          });

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

const changePin = async (req, res) => {
  const { username, userId, oldPin, newPin } = req.body;
  try {
    const targetUserId =
      userId || (req.user ? req.user._id || req.user.id : null);
    const user =
      targetUserId && mongoose.isValidObjectId(targetUserId)
        ? await User.findById(targetUserId)
        : await User.findOne({
            username: username || (req.user ? req.user.username : ""),
          });

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

const uploadImage = async (req, res) => {
  const { id, imageUrl } = req.body;
  if (!imageUrl)
    return res.json({ success: false, message: "មិនមាន URL រូបភាពទេ!" });
  try {
    const query = mongoose.isValidObjectId(id)
      ? { _id: id }
      : { $or: [{ id: id }, { username: id }] };
    const user = await User.findOne(query);
    if (user) {
      user.profileImage = imageUrl;
      await user.save();
      res.json({ success: true, imageUrl: imageUrl });
    } else res.json({ success: false, message: "User not found" });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

const submitKyc = async (req, res) => {
  const {
    username,
    userId,
    kycUrl,
    idCardUrl,
    selfieUrl,
    fullName,
    idNumber,
    dob,
    gender,
    duplicateReason,
    duplicateIdReason,
  } = req.body;

  const finalIdUrl = idCardUrl || kycUrl || "";
  if (!finalIdUrl || !selfieUrl) {
    return res.json({
      success: false,
      message:
        "សូមបង្ហោះទាំងរូបថតអត្តសញ្ញាណប័ណ្ណ និងរូបថតផ្ទាល់ខ្លួន (Selfie) ឱ្យបានគ្រប់គ្រាន់!",
    });
  }

  try {
    const targetUserId =
      userId || (req.user ? req.user._id || req.user.id : null);
    const user =
      targetUserId && mongoose.isValidObjectId(targetUserId)
        ? await User.findById(targetUserId)
        : await User.findOne({
            username: username || (req.user ? req.user.username : ""),
          });

    if (!user) return res.json({ success: false, message: "រកមិនឃើញគណនីទេ!" });

    const cleanIdNumber = String(idNumber || user.idNumber || "").trim();
    const cleanFullName = String(fullName || user.fullName || "")
      .trim()
      .toUpperCase();
    let finalDupReason = String(
      duplicateIdReason || duplicateReason || "",
    ).trim();

    if (!cleanFullName || !cleanIdNumber || !dob || !gender) {
      return res.json({
        success: false,
        message:
          "សូមបំពេញព័ត៌មានអត្តសញ្ញាណ (ឈ្មោះ, លេខ ID, ថ្ងៃកំណើត, ភេទ) ឱ្យបានគ្រប់គ្រាន់!",
      });
    }

    const otherUsersWithSameId = await User.find({
      idNumber: cleanIdNumber,
      _id: { $ne: user._id },
    });

    if (otherUsersWithSameId.length > 0 && !finalDupReason) {
      return res.json({
        success: false,
        requireDuplicateReason: true,
        message:
          "លេខអត្តសញ្ញាណប័ណ្ណនេះធ្លាប់ត្រូវបានប្រើប្រាស់ក្នុងប្រព័ន្ធរួចហើយ! សូមបញ្ជាក់មូលហេតុនៃការប្រើប្រាស់អត្តសញ្ញាណប័ណ្ណរួមគ្នា។",
      });
    }

    user.fullName = cleanFullName;
    user.idNumber = cleanIdNumber;
    user.dob = dob;
    user.gender = gender;
    user.kycDocument = finalIdUrl;
    user.kycImage = finalIdUrl;
    user.selfieUrl = selfieUrl;
    user.kycStatus = "pending";
    user.kycSubmittedAt = getFormattedDate();
    user.kycUploadedBy = "អតិថិជនផ្ទាល់";
    user.kycRejectReason = "";

    if (otherUsersWithSameId.length > 0) {
      user.duplicateIdReason = finalDupReason;
    } else {
      user.duplicateIdReason = "";
    }

    await user.save();

    if (otherUsersWithSameId.length > 0 && finalDupReason) {
      await User.updateMany(
        { idNumber: cleanIdNumber },
        { $set: { duplicateIdReason: finalDupReason } },
      );
    }

    const safeUser = user.toObject();
    delete safeUser.password;
    delete safeUser.pin;

    res.json({
      success: true,
      message: "ឯកសារបញ្ជាក់អត្តសញ្ញាណ (KYC) ត្រូវបានបញ្ជូនដោយជោគជ័យ!",
      user: safeUser,
    });
  } catch (err) {
    console.error("Submit KYC Error:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// MRZ Helpers & Parsing
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

function cleanMrzName(value = "") {
  if (!value) return null;
  const repaired = repairMrzFiller(value);
  const cleaned = repaired
    .replace(/</g, " ")
    .replace(/[^A-Z ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || null;
}

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

function parseKhmerIdMRZ(lines) {
  if (!lines || lines.length < 3) return null;
  const line1 = normalizeMrzChars(lines[0]);
  const line2 = normalizeMrzChars(lines[1]);
  const line3 = normalizeMrzChars(lines[2]);

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

  const idLine1Candidates = normalized
    .map(repairIdPrefix)
    .filter((x) => /^(?:ID|1D|I[O0]).{0,3}KHM/i.test(x));

  const idLine2Candidates = normalized.filter((x) =>
    /^\d{6}\d[MF]/i.test(normalizeNumeric(x)),
  );

  const idLine3Candidates = normalized.filter((x) => {
    if (/^(?:ID|1D|I[O0])/i.test(x)) return false;
    if (/^\d{6}/.test(normalizeNumeric(x))) return false;
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

  return [];
}

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
        tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<LKI",
      });
      results.push({ mode: config.name, text: text || "" });
    } catch (error) {
      console.error(`OCR ${config.name} failed:`, error.message);
    }
  }
  return results;
}

const scanIdCard = async (req, res) => {
  const { imageUrl } = req.body;
  if (!imageUrl)
    return res.status(400).json({ success: false, message: "មិនមានរូបភាពទេ!" });

  try {
    const ocrResults = await runMultipleOCR(imageUrl);
    if (!ocrResults.length) {
      return res
        .status(400)
        .json({ success: false, message: "មិនអាចអាន OCR បានទេ!" });
    }

    const allOcrLines = [];
    for (const result of ocrResults) {
      const cleaned = cleanOcrText(result.text);
      allOcrLines.push(...cleaned);
    }
    const uniqueLines = [...new Set(allOcrLines)];

    const mrzLines = extractMrzLines(uniqueLines);
    if (!mrzLines || !mrzLines.length) {
      return res.status(400).json({
        success: false,
        message:
          "មិនអាចរកខ្សែអក្សរ MRZ តាមស្តង់ដារបានទេ។ សូមថតឯកសារឱ្យច្បាស់ និងត្រង់។",
        rawOcrText: ocrResults.map((x) => x.text).join("\n"),
      });
    }

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
// 🏦 ផ្នែកទី ៧៖ គ្រប់គ្រងគណនីជាក់លាក់ (Account Settings)
// ==========================================

const renameAccount = async (req, res) => {
  const { accountNumber, newName } = req.body;
  const userId = req.user._id || req.user.id;

  try {
    const user =
      userId && mongoose.isValidObjectId(userId)
        ? await User.findById(userId)
        : await User.findOne({ username: req.user.username });

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

const updateAccountLimit = async (req, res) => {
  const { accountNumber, dailyLimit } = req.body;
  const userId = req.user._id || req.user.id;

  try {
    const user =
      userId && mongoose.isValidObjectId(userId)
        ? await User.findById(userId)
        : await User.findOne({ username: req.user.username });

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

const toggleFreezeAccount = async (req, res) => {
  const { accountNumber } = req.body;
  const userId = req.user._id || req.user.id;

  try {
    const user =
      userId && mongoose.isValidObjectId(userId)
        ? await User.findById(userId)
        : await User.findOne({ username: req.user.username });

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

const toggleHideAccount = async (req, res) => {
  const { accountNumber } = req.body;
  const userId = req.user._id || req.user.id;

  try {
    const user =
      userId && mongoose.isValidObjectId(userId)
        ? await User.findById(userId)
        : await User.findOne({ username: req.user.username });

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

const heartbeat = async (req, res) => {
  const { username, userId } = req.body;
  try {
    const targetUserId =
      userId || (req.user ? req.user._id || req.user.id : null);
    const user =
      targetUserId && mongoose.isValidObjectId(targetUserId)
        ? await User.findById(targetUserId)
        : await User.findOne({
            username: username || (req.user ? req.user.username : ""),
          });

    if (user) {
      user.lastActive = new Date().toISOString();
      user.isOnline = true;
      await user.save();
      res.json({ success: true });
    } else res.json({ success: false });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

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
        (t) =>
          String(t.userId) === String(user._id) || t.username === user.username,
      );
      userObj.notifications = allNotifications.filter(
        (n) =>
          String(n.userId) === String(user._id) || n.username === user.username,
      );
      return userObj;
    });

    res.json(usersWithTrx);
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

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

const checkUsername = async (req, res) => {
  try {
    const { username } = req.body;
    const user = await User.findOne({ username: username.toLowerCase() });
    if (user) return res.json({ available: false });
    return res.json({ available: true });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

const checkIdNumber = async (req, res) => {
  try {
    const cleanId = String(req.body.idNumber || "").trim();
    const excludeUsername = String(req.body.excludeUsername || "").trim();
    if (!cleanId) return res.json({ exists: false, count: 0 });

    const query = { idNumber: cleanId };
    if (excludeUsername) {
      query.username = { $ne: excludeUsername };
    }

    const existingUsers = await User.find(query).select(
      "username fullName duplicateIdReason",
    );

    if (existingUsers.length > 0) {
      const existingReason =
        existingUsers.find((u) => u.duplicateIdReason)?.duplicateIdReason || "";
      return res.json({
        exists: true,
        count: existingUsers.length,
        existingReason,
        accounts: existingUsers.map((u) => ({
          username: u.username,
          fullName: u.fullName,
        })),
      });
    }
    return res.json({ exists: false, count: 0 });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

const checkReferralCode = async (req, res) => {
  try {
    const { referralCode } = req.body;
    const user = await User.findOne({ userId: referralCode });

    if (user) {
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
  const { username, userId } = req.body;
  try {
    const targetUserId =
      userId || (req.user ? req.user._id || req.user.id : null);
    const user =
      targetUserId && mongoose.isValidObjectId(targetUserId)
        ? await User.findById(targetUserId)
        : await User.findOne({
            username: username || (req.user ? req.user.username : ""),
          });

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
  const { username, userId } = req.body;
  try {
    const targetUserId =
      userId || (req.user ? req.user._id || req.user.id : null);
    const user =
      targetUserId && mongoose.isValidObjectId(targetUserId)
        ? await User.findById(targetUserId)
        : await User.findOne({
            username: username || (req.user ? req.user.username : ""),
          });

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

const migrateTransactions = async (req, res) => {
  try {
    const users = await User.find({ "transactions.0": { $exists: true } });
    let totalMigrated = 0;
    for (let user of users) {
      if (user.transactions && user.transactions.length > 0) {
        const trxsToInsert = user.transactions.map((t) => ({
          ...(t.toObject ? t.toObject() : t),
          userId: user._id,
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

const requestCredentialReset = async (req, res) => {
  const { username, userId, resetType } = req.body;

  try {
    const targetUserId =
      userId || (req.user ? req.user._id || req.user.id : null);
    const user =
      targetUserId && mongoose.isValidObjectId(targetUserId)
        ? await User.findById(targetUserId)
        : await User.findOne({
            username: username || (req.user ? req.user.username : ""),
          });

    if (!user) return res.json({ success: false, message: "រកគណនីមិនឃើញទេ!" });

    if (!user.email) {
      return res.json({
        success: false,
        message: "អតិថិជននេះមិនទាន់មានអ៊ីមែល (Email) ទេ។ សូមឱ្យគាត់បញ្ចូលសិន។",
      });
    }

    if (user.resetTokenExpire && user.resetTokenExpire > Date.now()) {
      const timeLeft = Math.ceil(
        (user.resetTokenExpire - Date.now()) / 1000 / 60,
      );
      return res.json({
        success: false,
        message: `សូមរង់ចាំ ${timeLeft} នាទីទៀត ទើបអាចផ្ញើ Link សារជាថ្មីได้! (ការពារการផ្ញើស្ទួន)`,
      });
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    user.resetToken = hashedToken;
    user.resetTokenExpire = Date.now() + 5 * 60 * 1000;
    await user.save();

    const baseUrl = process.env.CLIENT_URL || "https://u-pay-bank.fly.dev";
    const resetUrl = `${baseUrl}/reset-credential?token=${rawToken}&type=${resetType}`;

    const emailSent = await sendResetLink(
      user.email,
      user.fullName || user.username,
      resetUrl,
      resetType,
    );

    if (!emailSent) {
      return res.json({
        success: false,
        message: "មានបញ្ហាក្នុងการផ្ញើអ៊ីមែល!",
      });
    }

    res.json({
      success: true,
      message: "ได้ផ្ញើ Link ទៅកាន់អ៊ីមែលរបស់អតិថិជនរួចរាល់!",
    });
  } catch (error) {
    console.error("Request Reset Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

const verifyAndSaveNewCredential = async (req, res) => {
  const { token, type, newValue } = req.body;

  try {
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      resetToken: hashedToken,
      resetTokenExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.json({
        success: false,
        message: "តំណភ្ជាប់นี้ไม่ถูกต้อง หรือได้หมดอายุแล้ว (เกินกว่า 5 นาที)!",
      });
    }

    if (type === "PIN") {
      if (!/^\d{4}$/.test(newValue)) {
        return res.json({
          success: false,
          message: "លេខ PIN ត្រូវតែជាលេខសុទ្ធ และมี 4 หลักถ้วน!",
        });
      }
      user.pin = newValue;
      user.pinAttempts = 0;
    } else if (type === "Password") {
      user.password = newValue;
    } else {
      return res.json({ success: false, message: "ប្រភេទไม่ถูกต้อง!" });
    }

    user.resetToken = undefined;
    user.resetTokenExpire = undefined;
    await user.save();

    res.json({
      success: true,
      message: `${type} របស់ท่านได้รับการเปลี่ยนแปลงด้วยความสำเร็จ!`,
    });
  } catch (error) {
    console.error("Save Credential Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

const verifyResetToken = async (req, res) => {
  try {
    const { token } = req.query;
    if (!token)
      return res.json({ success: false, message: "ไม่พบ Token ความลับ!" });

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      resetToken: hashedToken,
      resetTokenExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.json({
        success: false,
        message:
          "តំណភ្ជាប់นี้ไม่ถูกต้อง หรือมีอายุการใช้งานเกินกว่า 5 นาทีแล้ว",
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Verify Reset Token Error:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "เกิดข้อผิดพลาดทางระบบ (Server Error)",
      });
  }
};

const createTicket = async (req, res) => {
  const { username, userId, subject, priority, description, message } =
    req.body;
  try {
    const targetUserId =
      userId || (req.user ? req.user._id || req.user.id : null);
    const user =
      targetUserId && mongoose.isValidObjectId(targetUserId)
        ? await User.findById(targetUserId)
        : await User.findOne({
            username: username || (req.user ? req.user.username : ""),
          });

    if (!user)
      return res.json({ success: false, message: "រកមិនឃើញគណនីអតិថិជនទេ!" });

    if (!user.tickets) user.tickets = [];

    const newTicket = {
      ticketId: "TCK-" + Math.floor(100000 + Math.random() * 900000),
      subject: subject || "Support Request",
      priority: priority || "Normal",
      message: message || description || "",
      description: description || message || "",
      status: "Pending",
      adminReply: "",
      date:
        typeof getFormattedDate === "function"
          ? getFormattedDate()
          : new Date().toLocaleString(),
      createdAt: new Date(),
    };

    user.tickets.unshift(newTicket);
    user.markModified("tickets");
    await user.save();

    await Notification.create({
      userId: user._id,
      title: "New Support Ticket 🎫",
      message: `សំណើរថ្មី: "${subject}" ត្រូវបានដាក់ស្នើដោយជោគជ័យ`,
      date: newTicket.date,
      type: "ticket_created",
      isRead: false,
    });

    res.json({
      success: true,
      message: "សំណូមពររបស់អ្នកត្រូវបានបញ្ជូនជោគជ័យ!",
      ticket: newTicket,
    });
  } catch (err) {
    console.error("Create Ticket Error:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

module.exports = {
  requestRegisterOTP,
  verifyRegisterOTP,
  verifyAndRegister,
  login,
  logout,
  verifyUserAccount,
  verifyUser: verifyUserAccount,
  verifyForgotOtp,
  resetPassword,
  sendSecurityOtp,
  verifyCurrentPassword,
  verifyCurrentPin,
  changePassword,
  changePin,
  uploadImage,
  submitKyc,
  scanIdCard,
  renameAccount,
  updateAccountLimit,
  toggleFreezeAccount,
  toggleHideAccount,
  heartbeat,
  getUsers,
  verifyAccount,
  checkUsername,
  checkIdNumber,
  checkReferralCode,
  createTicket,
  generateTelegramCode,
  unlinkTelegram,
  adminLogin,
  adminNfcLogin,
  migrateTransactions,
  requestCredentialReset,
  verifyAndSaveNewCredential,
  verifyResetToken,
};

setInterval(async () => {
  try {
    if (mongoose.connection.readyState !== 1) return;
    const now = Date.now();
    const dueMessages = await Chat.find({
      isScheduled: true,
      scheduledFor: { $lte: now, $ne: null },
    });

    for (const msg of dueMessages) {
      msg.isScheduled = undefined;
      msg.scheduledFor = undefined;
      msg.timestamp = now;
      msg.time = new Date(now).toLocaleTimeString("en-US", {
        timeZone: "Asia/Phnom_Penh",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
      await msg.save();
    }
  } catch (err) {}
}, 2000);
