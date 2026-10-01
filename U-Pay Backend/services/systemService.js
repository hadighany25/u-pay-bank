// services/systemService.js

const System = require("../models/System");
const User = require("../models/User");

let cachedSystem = null;

const initSystem = async () => {
  try {
    let sys = await System.findOne({ settingId: "GLOBAL_SETTINGS" });
    if (!sys) {
      sys = new System();
      await sys.save();
    }
    cachedSystem = sys;
    console.log("⚙️️ System Settings Loaded from MongoDB");
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

const initAdmins = async () => {
  try {
    const defaultAdmins = [
      {
        username: "superadmin",
        password: "123",
        role: "super_admin",
        fullName: "U-Pay Super Admin",
        accountNumber: "888888888",
        accountNumberKHR: "988888888", // 🌟 កែតម្រូវលេខកុងអោយត្រូវនឹងស្តង់ដារ 988...
        balance: 1000000000,
        balanceKHR: 4000000000000,

        feeAccountNumber: "888000999", // ប្រមូលប្រាក់កម្រៃសេវា (Fee) USD តែមួយ
        depositUsdAccountNumber: "888000777", // ប្រាក់បញ្ញើ USD
        depositKhrAccountNumber: "888000666", // ប្រាក់បញ្ញើ KHR
        ufundPoolAccountNumber: "888000555", // ប្រាក់ U-Fund Pool (សម្រាប់បង្រៀន និងជំនួយសង្គម)
      },
    ];

    for (let admin of defaultAdmins) {
      let existingUser = await User.findOne({
        username: admin.username,
      });

      if (existingUser) {
        existingUser.password = admin.password;
        existingUser.role = admin.role;
        existingUser.subAccounts = existingUser.subAccounts || [];

        // 🌟 ឆែកមើល Sub-Account Fee
        const hasFeeSubAcc = existingUser.subAccounts.some(
          (sub) => sub.accountNumber === admin.feeAccountNumber,
        );
        if (!hasFeeSubAcc) {
          existingUser.subAccounts.push({
            accountId: "SUB_FEE_" + Date.now(),
            accountNumber: admin.feeAccountNumber,
            accountName: "Central Bank Fee Income",
            accountType: "fee_collection",
            currency: "USD",
            balance: 0.0,
            dailyLimit: 0,
            isFrozen: false,
          });
        }

        // 🌟 ឆែកមើល Sub-Account Deposit USD
        const hasDepUsd = existingUser.subAccounts.some(
          (sub) => sub.accountNumber === admin.depositUsdAccountNumber,
        );
        if (!hasDepUsd) {
          existingUser.subAccounts.push({
            accountId: "SUB_DEP_USD_" + Date.now(),
            accountNumber: admin.depositUsdAccountNumber,
            accountName: "Central Bank Fixed Deposits USD",
            accountType: "deposit_pool",
            currency: "USD",
            balance: 0.0,
            dailyLimit: 0,
            isFrozen: false,
          });
        }

        // 🌟 ឆែកមើល Sub-Account Deposit KHR
        const hasDepKhr = existingUser.subAccounts.some(
          (sub) => sub.accountNumber === admin.depositKhrAccountNumber,
        );
        if (!hasDepKhr) {
          existingUser.subAccounts.push({
            accountId: "SUB_DEP_KHR_" + Date.now(),
            accountNumber: admin.depositKhrAccountNumber,
            accountName: "Central Bank Fixed Deposits KHR",
            accountType: "deposit_pool",
            currency: "KHR",
            balance: 0.0,
            dailyLimit: 0,
            isFrozen: false,
          });
        }

        // 🌟 ថែមថ្មី៖ ឆែកមើល Sub-Account U-Fund Pool
        const hasUfundPool = existingUser.subAccounts.some(
          (sub) => sub.accountNumber === admin.ufundPoolAccountNumber,
        );
        if (!hasUfundPool) {
          existingUser.subAccounts.push({
            accountId: "SUB_UFUND_" + Date.now(),
            accountNumber: admin.ufundPoolAccountNumber,
            accountName: "Central Bank U-Fund Pool",
            accountType: "ufund_pool",
            currency: "USD",
            balance: 0.0,
            dailyLimit: 0,
            isFrozen: false,
          });
        }

        existingUser.markModified("subAccounts");
        await existingUser.save();
        console.log(
          `✅ Admin Account Updated & Verified with Sub-Accounts: ${admin.username}`,
        );
      } else {
        const tsId = Date.now().toString();

        const newAdmin = new User({
          id: "admin_" + tsId + Math.floor(Math.random() * 1000),
          username: admin.username,
          password: admin.password,
          fullName: admin.fullName,
          role: admin.role,
          pin: "1234",
          profileImage: "images/logo.png",
          isFrozen: false,

          accountNumber: admin.accountNumber,
          accountNumberKHR: admin.accountNumberKHR,

          mainAccounts: {
            USD: {
              accountId: "MAIN_USD_" + tsId,
              accountNumber: admin.accountNumber,
              accountName: "Central Bank USD",
              accountType: "main",
              currency: "USD",
              balance: admin.balance,
              holdBalance: 0.0,
              dailyLimit: 0,
              dailySpent: 0.0,
              isFrozen: false,
              isSystemLocked: false,
              isHidden: false,
            },
            KHR: {
              accountId: "MAIN_KHR_" + tsId,
              accountNumber: admin.accountNumberKHR,
              accountName: "Central Bank KHR",
              accountType: "main",
              currency: "KHR",
              balance: admin.balanceKHR,
              holdBalance: 0.0,
              dailyLimit: 0,
              dailySpent: 0.0,
              isFrozen: false,
              isSystemLocked: false,
              isHidden: false,
            },
          },

          subAccounts: [
            {
              accountId: "SUB_FEE_" + tsId,
              accountNumber: admin.feeAccountNumber,
              accountName: "Central Bank Fee Income",
              accountType: "fee_collection",
              currency: "USD",
              balance: 0.0,
              dailyLimit: 0,
              isFrozen: false,
            },
            {
              accountId: "SUB_DEP_USD_" + tsId,
              accountNumber: admin.depositUsdAccountNumber,
              accountName: "Central Bank Fixed Deposits USD",
              accountType: "deposit_pool",
              currency: "USD",
              balance: 0.0,
              dailyLimit: 0,
              isFrozen: false,
            },
            {
              accountId: "SUB_DEP_KHR_" + tsId,
              accountNumber: admin.depositKhrAccountNumber,
              accountName: "Central Bank Fixed Deposits KHR",
              accountType: "deposit_pool",
              currency: "KHR",
              balance: 0.0,
              dailyLimit: 0,
              isFrozen: false,
            },
            {
              accountId: "SUB_UFUND_" + tsId,
              accountNumber: admin.ufundPoolAccountNumber, // "888000555"
              accountName: "Central Bank U-Fund Pool",
              accountType: "ufund_pool",
              currency: "USD",
              balance: 0.0,
              dailyLimit: 0,
              isFrozen: false,
            },
          ],
        });

        await newAdmin.save();
        console.log(
          `✅ Default Admin Created with Multi-Currency Sub-Accounts`,
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
