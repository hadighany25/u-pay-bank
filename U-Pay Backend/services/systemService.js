const System = require("../models/System");
const User = require("../models/User");

// រក្សាទុកទិន្នន័យបណ្តោះអាសន្នក្នុង Memory ដើម្បីអោយការអានទិន្នន័យលឿន
let cachedSystem = null;

const initSystem = async () => {
  try {
    let sys = await System.findOne({ settingId: "GLOBAL_SETTINGS" });
    if (!sys) {
      sys = new System();
      await sys.save();
    }
    cachedSystem = sys;
    console.log("⚙️ System Settings Loaded from MongoDB");
  } catch (err) {
    console.error("❌ Failed to load system settings:", err);
  }
};

const readSystemStatus = () => {
  if (!cachedSystem) return { isSystemFrozen: false };
  return { isSystemFrozen: cachedSystem.isSystemFrozen };
};

const writeSystemStatus = async (data) => {
  if (cachedSystem) {
    cachedSystem.isSystemFrozen = data.isSystemFrozen;
    await cachedSystem.save();
  }
};

const readFXRates = () => {
  if (!cachedSystem) return { usdToKhrBuy: 4050, usdToKhrSell: 4100 };
  return cachedSystem.fxRates;
};

const writeFXRates = async (data) => {
  if (cachedSystem) {
    cachedSystem.fxRates = data;
    await cachedSystem.save();
  }
};

// 🔥 ថែម ២ មុខងារនេះ សម្រាប់គ្រប់គ្រង Fee & Limit
const readFeeSettings = () => {
  if (!cachedSystem) return { transferLimit: 5000, feeTiers: [] };
  return {
    transferLimit: cachedSystem.transferLimit || 5000,
    feeTiers: cachedSystem.feeTiers || [],
  };
};

const writeFeeSettings = async (data) => {
  if (cachedSystem) {
    cachedSystem.transferLimit = data.transferLimit;
    cachedSystem.feeTiers = data.feeTiers;
    await cachedSystem.save();
  }
};

// 👇 ទុកតែ Super Admin មួយគត់សម្រាប់គ្រប់គ្រងប្រព័ន្ធធំ និងលុយ Central Bank
const initAdmins = async () => {
  try {
    const defaultAdmins = [
      {
        username: "superadmin",
        password: "123",
        role: "super_admin",
        fullName: "U-Pay Super Admin",
        accountNumber: "888888888",
        accountNumberKHR: "988888888",
        balance: 1000000000,
        balanceKHR: 4000000000000,
      },
      // លុប finance និង support ចេញអស់ហើយ!
    ];

    for (let admin of defaultAdmins) {
      // ស្វែងរកតាម លេខគណនី ជំនួសអោយ ឈ្មោះ ដើម្បីការពារការជាន់គ្នា
      let existingUser = await User.findOne({
        accountNumber: admin.accountNumber,
      });

      if (existingUser) {
        // បើមានគណនីហ្នឹងហើយ យើងគ្រាន់តែ Update ឈ្មោះ លេខសម្ងាត់ និងសិទ្ធិរបស់វា
        existingUser.username = admin.username;
        existingUser.password = admin.password;
        existingUser.role = admin.role;
        await existingUser.save();
        console.log(
          `✅ Admin Account Updated: ${admin.username} [Role: ${admin.role}]`,
        );
      } else {
        // បើអត់ទាន់មាន ទើបយើងបង្កើតថ្មី
        const newAdmin = new User({
          id: "admin_" + Date.now() + Math.floor(Math.random() * 1000),
          username: admin.username,
          password: admin.password,
          fullName: admin.fullName,
          role: admin.role,
          accountNumber: admin.accountNumber,
          accountNumberKHR: admin.accountNumberKHR,
          balance: admin.balance,
          balanceKHR: admin.balanceKHR,
          pin: "1234",
          profileImage: "images/logo.png",
          isFrozen: false,
        });
        await newAdmin.save();
        console.log(
          `✅ Default Admin Created: ${admin.username} [Role: ${admin.role}]`,
        );
      }
    }
  } catch (err) {
    console.error("❌ Error generating admins:", err);
  }
};

module.exports = {
  initSystem,
  readSystemStatus,
  writeSystemStatus,
  readFXRates,
  writeFXRates,
  initAdmins,
  readFeeSettings,
  writeFeeSettings,
};
