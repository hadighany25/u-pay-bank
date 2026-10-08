// controllers/merchantController.js
const Merchant = require("../models/Merchant");
const crypto = require("crypto");
const User = require("../models/User");
const Transaction = require("../models/Transaction");
const Notification = require("../models/Notification");
const PDFDocument = require("pdfkit");
const path = require("path");
const fs = require("fs");
const bot = require("../services/telegramBot"); // 🌟 នាំចូល Telegram Bot Service

// ========================================================
// 🛠️ ផ្នែកទី ១៖ Function ជំនួយ (Helpers)
// ========================================================
const generateRandomNumber = (length) => {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += Math.floor(Math.random() * 10).toString();
  }
  return result;
};

// បង្កើត Hash ស្តង់ដារ (១០ខ្ទង់ លាយអក្សរធំ និងលេខ)
const generateStandardHash = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 10; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// បង្កើត Ref ID ស្តង់ដារ (ក្បាលអក្សរ + លេខ ៨ខ្ទង់)
const generateStandardRefId = (prefix) => {
  const random8Digits = Math.floor(10000000 + Math.random() * 90000000);
  return `${prefix}-${random8Digits}`;
};

// យកម៉ោងស្តង់ដារកម្ពុជា
const getKhmerDate = () => {
  return new Date().toLocaleString("en-US", {
    timeZone: "Asia/Phnom_Penh",
    hour12: true,
  });
};

// ========================================================
// 🏪 ផ្នែកទី ២៖ Merchant APIs (សម្រាប់អតិថិជនជាម្ចាស់ហាង)
// ========================================================

// ១. មុខងារបង្កើតហាងថ្មី (Create Merchant)
exports.createMerchant = async (req, res) => {
  try {
    const { name, city, category, linkedAccUSD, linkedAccKHR, pin } = req.body;
    const userId = req.user.username;

    // ឆែកមើលថាមាន User ដែរឬទេ និង ផ្ទៀងផ្ទាត់ PIN
    const owner = await User.findOne({ username: userId });
    if (!owner)
      return res
        .status(404)
        .json({ success: false, message: "រកមិនឃើញគណនីរបស់អ្នកទេ" });
    if (owner.pin !== pin)
      return res
        .status(400)
        .json({ success: false, message: "លេខកូដ PIN មិនត្រឹមត្រូវទេ" });

    // ត្រូវមានយ៉ាងហោចណាស់គណនីមួយដែលបានភ្ជាប់ (ដើម្បីទទួលប្រាក់)
    if (!linkedAccUSD && !linkedAccKHR) {
      return res
        .status(400)
        .json({ success: false, message: "សូមភ្ជាប់គណនីយ៉ាងហោចណាស់មួយ!" });
    }

    const merchantId = "500" + generateRandomNumber(12);
    const apiKey = "upay_live_" + crypto.randomBytes(16).toString("hex");
    const apiSecret = crypto.randomBytes(32).toString("hex");

    // បង្កើតលេខគណនី QR របស់ហាង ដោយផ្អែកលើគណនីដែលគេភ្ជាប់
    let accountNumbers = { USD: null, KHR: null };
    let linkedAccounts = { USD: null, KHR: null };

    if (linkedAccUSD) {
      accountNumbers.USD = "888" + generateRandomNumber(9);
      linkedAccounts.USD = linkedAccUSD;
    }
    if (linkedAccKHR) {
      accountNumbers.KHR = "999" + generateRandomNumber(9);
      linkedAccounts.KHR = linkedAccKHR;
    }

    const newMerchant = new Merchant({
      userId,
      name,
      city,
      category,
      merchantId,
      apiKey,
      apiSecret,
      linkedAccounts: linkedAccounts,
      accountNumbers: accountNumbers,
      collected: { USD: 0.0, KHR: 0 },
    });

    const savedMerchant = await newMerchant.save();

    // 🌟 ផ្តល់ដំណឹងចូល App (In-App Notification)
    await Notification.create({
      userId: owner._id,
      username: owner.username,
      title: "បង្កើតហាងជោគជ័យ! 🏪",
      message: `អបអរសាទរ! ហាង "${name}" ត្រូវបានបង្កើតដោយជោគជ័យ និងរួចរាល់សម្រាប់ទទួលប្រាក់។`,
      type: "system_alert",
      date: getKhmerDate(),
      isRead: false,
    });

    res.status(201).json({
      success: true,
      merchant: {
        id: savedMerchant._id.toString(),
        merchantId: savedMerchant.merchantId,
        name: savedMerchant.name,
        category: savedMerchant.category,
        linkedAccounts: savedMerchant.linkedAccounts,
        accountNumbers: savedMerchant.accountNumbers,
        apiKey: savedMerchant.apiKey,
        apiSecret: savedMerchant.apiSecret,
      },
    });
  } catch (error) {
    console.error("CREATE MERCHANT ERROR:", error);
    res
      .status(500)
      .json({ success: false, message: "មានបញ្ហាបច្ចេកទេសលើ Server" });
  }
};

// ២. ទាញយកហាងទាំងអស់របស់អ្នកប្រើប្រាស់ (Get Merchants)
exports.getMyMerchants = async (req, res) => {
  try {
    const username = req.user.username;
    // ទាញយកហាងរបស់គាត់ តែលាក់ API Secret ដើម្បីសុវត្ថិភាព
    const merchants = await Merchant.find({ userId: username }).select(
      "-apiSecret",
    );
    res.status(200).json({ success: true, merchants });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ៣. លុបហាង (Delete Merchant by Owner)
exports.deleteMerchant = async (req, res) => {
  try {
    const { merchantId } = req.params;
    const userId = req.user.username;

    const merchant = await Merchant.findOneAndDelete({
      _id: merchantId,
      userId: userId,
    });
    if (!merchant)
      return res
        .status(404)
        .json({ success: false, message: "Merchant not found" });

    // 🌟 ផ្តល់ដំណឹងចូល App ពេលលុបហាង
    const owner = await User.findOne({ username: userId });
    if (owner) {
      await Notification.create({
        userId: owner._id,
        username: owner.username,
        title: "ហាងត្រូវបានលុប! ❌",
        message: `ហាង "${merchant.name}" របស់អ្នកត្រូវបានលុបចេញពីប្រព័ន្ធ U-Pay រួចរាល់។`,
        type: "system_alert",
        date: getKhmerDate(),
        isRead: false,
      });
    }

    res
      .status(200)
      .json({ success: true, message: "Merchant deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ៤. កែប្រែឈ្មោះហាង (Update Merchant Info by Owner)
exports.updateMerchant = async (req, res) => {
  try {
    const { name } = req.body;
    const userId = req.user.username;

    const merchant = await Merchant.findOneAndUpdate(
      { _id: req.params.merchantId, userId: userId },
      { name },
      { new: true },
    );

    if (!merchant)
      return res
        .status(404)
        .json({ success: false, message: "Merchant not found" });

    // 🌟 ផ្តល់ដំណឹងចូល App
    const owner = await User.findOne({ username: userId });
    if (owner) {
      await Notification.create({
        userId: owner._id,
        username: owner.username,
        title: "ព័ត៌មានហាងត្រូវបានកែប្រែ 📝",
        message: `ព័ត៌មានហាងរបស់អ្នកត្រូវបានកែប្រែទៅជាឈ្មោះ "${name}" រួចរាល់។`,
        type: "system_alert",
        date: getKhmerDate(),
        isRead: false,
      });
    }

    res.json({ success: true, merchant });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ៥. ទាញយកប្រវត្តិប្រតិបត្តិការហាង (Get Transactions)
exports.getMerchantTransactions = async (req, res) => {
  try {
    const { merchantId } = req.params;
    const { filter } = req.query;

    const merchant = await Merchant.findById(merchantId);
    if (!merchant)
      return res
        .status(404)
        .json({ success: false, message: "Shop not found" });

    let searchConditions = [{ merchantId: merchant.merchantId }];

    if (merchant.accountNumbers && merchant.accountNumbers.USD)
      searchConditions.push({ receiverAcc: merchant.accountNumbers.USD });
    if (merchant.accountNumbers && merchant.accountNumbers.KHR)
      searchConditions.push({ receiverAcc: merchant.accountNumbers.KHR });

    if (merchant.cashiers && merchant.cashiers.length > 0) {
      merchant.cashiers.forEach((c) => {
        if (c.virtualAccounts && c.virtualAccounts.USD)
          searchConditions.push({ receiverAcc: c.virtualAccounts.USD });
        if (c.virtualAccounts && c.virtualAccounts.KHR)
          searchConditions.push({ receiverAcc: c.virtualAccounts.KHR });
        if (c.virtualAccount)
          searchConditions.push({ receiverAcc: c.virtualAccount });
      });
    }

    let transactions = await Transaction.find({
      $or: searchConditions,
      amount: { $gt: 0 },
    }).sort({ _id: -1 });

    const currentUTC = new Date();
    const nowKhmerTime = new Date(currentUTC.getTime() + 7 * 60 * 60 * 1000);

    transactions = transactions.filter((t) => {
      const trxUTC = new Date(t.date);
      const trxKhmerTime = new Date(trxUTC.getTime() + 7 * 60 * 60 * 1000);

      if (filter === "today")
        return (
          trxKhmerTime.toISOString().split("T")[0] ===
          nowKhmerTime.toISOString().split("T")[0]
        );
      if (filter === "week") {
        const lastWeek = new Date(nowKhmerTime);
        lastWeek.setDate(lastWeek.getDate() - 7);
        return trxKhmerTime >= lastWeek;
      }
      if (filter === "month")
        return (
          trxKhmerTime.getMonth() === nowKhmerTime.getMonth() &&
          trxKhmerTime.getFullYear() === nowKhmerTime.getFullYear()
        );
      return true;
    });

    res.status(200).json({ success: true, transactions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ៦. ទាញយកចំណូលហាងសរុប (Revenue)
exports.getMerchantRevenue = async (req, res) => {
  try {
    const merchant = await Merchant.findById(req.params.merchantId);
    if (!merchant)
      return res
        .status(404)
        .json({ success: false, message: "Shop not found" });
    res.status(200).json({ success: true, revenue: merchant.collected });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========================================================
// 👑 ផ្នែកទី ៣៖ Admin Management APIs (សម្រាប់តែ Admin)
// ========================================================

// ផ្អាក ឬបើកដំណើរការហាង (Freeze/Unfreeze)
exports.adminToggleMerchantFreeze = async (req, res) => {
  try {
    const { id, isFrozen } = req.body;
    const status = isFrozen ? "Suspended" : "Active";
    await Merchant.findByIdAndUpdate(id, { status: status });
    res.json({ success: true, message: "Status updated successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Admin លុបហាងចោលពីប្រព័ន្ធ
exports.adminDeleteMerchant = async (req, res) => {
  try {
    await Merchant.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Merchant deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Admin កែប្រែព័ត៌មានហាង
exports.adminEditMerchant = async (req, res) => {
  try {
    const { id, name, merchantId, category, webhookUrl, linkedAccount } =
      req.body;

    const existing = await Merchant.findOne({
      merchantId: merchantId,
      _id: { $ne: id },
    });
    if (existing)
      return res.json({
        success: false,
        message: "Merchant ID នេះមានអ្នកប្រើហើយ!",
      });

    await Merchant.findByIdAndUpdate(id, {
      name,
      merchantId,
      category,
      webhookUrl,
      linkedAccount,
    });
    res.json({
      success: true,
      message: "កែប្រែព័ត៌មានហាង និង Webhook ជោគជ័យ!",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========================================================
// 🤖 ផ្នែកទី ៤៖ Telegram Bot Alert APIs (សម្រាប់ហាង)
// ========================================================

const pendingMerchantTeleCodes = {};
exports.pendingMerchantTeleCodes = pendingMerchantTeleCodes;

// ៧. បង្កើតលេខកូដ ៤ ខ្ទង់សម្រាប់ភ្ជាប់ Telegram
exports.generateTelegramCode = async (req, res) => {
  try {
    const { merchantId } = req.body;
    const userId = req.user.username;

    const merchant = await Merchant.findOne({
      _id: merchantId,
      userId: userId,
    });
    if (!merchant)
      return res
        .status(404)
        .json({ success: false, message: "រកមិនឃើញហាងរបស់អ្នកទេ" });

    const code = Math.floor(1000 + Math.random() * 9000).toString();

    pendingMerchantTeleCodes[code] = {
      merchantId: merchant._id.toString(),
      expiresAt: Date.now() + 5 * 60 * 1000,
    };

    for (let key in pendingMerchantTeleCodes) {
      if (pendingMerchantTeleCodes[key].expiresAt < Date.now()) {
        delete pendingMerchantTeleCodes[key];
      }
    }

    res.status(200).json({ success: true, code: code });
  } catch (error) {
    res.status(500).json({ success: false, message: "មានបញ្ហាបច្ចេកទេស" });
  }
};

// ៨. ផ្តាច់ការជូនដំណឹងពី Telegram វិញ
exports.unlinkTelegram = async (req, res) => {
  try {
    const { merchantId } = req.body;
    const userId = req.user.username;

    // ស្វែងរកហាង រួច Set telegramChatId ទៅជា null វិញ
    const merchant = await Merchant.findOne({
      _id: merchantId,
      userId: userId,
    });
    if (!merchant)
      return res
        .status(404)
        .json({ success: false, message: "រកមិនឃើញហាងរបស់អ្នកទេ" });

    // 🔥 ហៅ Telegram Bot នៅទីនេះផ្ទាល់ ដើម្បីដោះស្រាយបញ្ហា Circular Dependency
    const bot = require("../services/telegramBot");

    // 🔥 ហៅមុខងារបាញ់សារជូនដំណឹងចូល Telegram មុនពេលលុបទិន្នន័យ
    if (merchant.telegramChatId && bot && bot.sendMerchantUnlinkAlert) {
      await bot.sendMerchantUnlinkAlert(merchant.telegramChatId, merchant.name);
    }

    // ធ្វើការ Update លុប ChatID ចោលពី Database
    merchant.telegramChatId = null;
    await merchant.save();

    res
      .status(200)
      .json({ success: true, message: "បានផ្តាច់ Telegram ដោយជោគជ័យ" });
  } catch (error) {
    console.error("Unlink Merchant Error:", error);
    res.status(500).json({ success: false, message: "មានបញ្ហាបច្ចេកទេស" });
  }
};

// ========================================================
// 💰 ៩. API សម្រាប់ Partner ឬ កម្មវិធីភាគីទី៣ ស្នើសុំ QR Code
// ========================================================
exports.createMerchantQR = async (req, res) => {
  try {
    const {
      merchant_id,
      order_id,
      amount,
      remark,
      notify_url,
      req_time,
      sign,
    } = req.body;

    const merchant = await Merchant.findOne({ merchantId: merchant_id });
    if (!merchant)
      return res
        .status(404)
        .json({ code: "FAIL", message: "រកមិនឃើញគណនី Merchant នេះទេ" });

    const receiveAccount = merchant.accountNumbers.USD;
    const deepLink = `https://u-pay-bank.fly.dev/index.html?acc=${receiveAccount}&o=${order_id}&a=${amount}`;

    res.status(200).json({
      code: "SUCCESS",
      message: "ជោគជ័យ",
      data: { qr_code_data: deepLink, deeplink: deepLink },
    });
  } catch (error) {
    res
      .status(500)
      .json({ code: "FAIL", message: "បញ្ហាបច្ចេកទេសក្នុងប្រព័ន្ធ" });
  }
};

// ========================================================
// 👨‍💼 ផ្នែកទី ៥៖ Cashier Management (គ្រប់គ្រងអ្នកគិតលុយ)
// ========================================================

// ៩. ស្វែងរកគណនី U-Pay របស់កូនចៅ
exports.searchCashierAccount = async (req, res) => {
  try {
    const { accountNumber } = req.params;

    // 🌟 កែប្រែទៅតាមទម្រង់ Model ថ្មី (Support ទាំង USD, KHR និង Sub-Accounts)
    const user = await User.findOne({
      $or: [
        { "mainAccounts.USD.accountNumber": accountNumber },
        { "mainAccounts.KHR.accountNumber": accountNumber },
        { "subAccounts.accountNumber": accountNumber },
        // រក្សាទុកកុងចាស់បន្តិចសិន ការពារក្រែងលោមានគណនីចាស់មិនទាន់ Update ចូល Main Accounts
        { accountNumber: accountNumber },
        { accountNumberKHR: accountNumber },
      ],
    });

    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "រកមិនឃើញគណនីកូនចៅនេះទេ!" });

    res.status(200).json({
      success: true,
      accountName: user.fullName || user.username,
      accountNumber: accountNumber,
    });
  } catch (error) {
    console.error("SEARCH CASHIER ERROR:", error);
    res.status(500).json({ success: false, message: "មានបញ្ហាបច្ចេកទេស" });
  }
};

// ១០. បន្ថែមអ្នកគិតលុយចូលក្នុងហាង
exports.addCashier = async (req, res) => {
  try {
    const {
      merchantId,
      cashierAccountNumber,
      cashierOriginalName,
      cashierDisplayName,
    } = req.body;
    const userId = req.user.username;

    const merchant = await Merchant.findOne({
      _id: merchantId,
      userId: userId,
    });
    if (!merchant)
      return res
        .status(404)
        .json({ success: false, message: "រកមិនឃើញហាងរបស់អ្នកទេ" });

    const existingCashier = merchant.cashiers.find(
      (c) => c.accountNumber === cashierAccountNumber,
    );
    if (existingCashier)
      return res
        .status(400)
        .json({ success: false, message: "កូនចៅម្នាក់នេះមានក្នុងហាងរួចហើយ!" });

    let virtualAccounts = { USD: null, KHR: null };
    let seq = merchant.cashiers.length + 1;

    if (merchant.accountNumbers && merchant.accountNumbers.USD) {
      let baseAccUSD = merchant.accountNumbers.USD;
      let vAccUSD =
        baseAccUSD.substring(0, baseAccUSD.length - 2) +
        seq.toString().padStart(2, "0");
      while (
        merchant.cashiers.some(
          (c) =>
            c.virtualAccounts?.USD === vAccUSD || c.virtualAccount === vAccUSD,
        ) ||
        vAccUSD === baseAccUSD
      ) {
        seq++;
        vAccUSD =
          baseAccUSD.substring(0, baseAccUSD.length - 2) +
          seq.toString().padStart(2, "0");
      }
      virtualAccounts.USD = vAccUSD;
    }

    if (merchant.accountNumbers && merchant.accountNumbers.KHR) {
      let baseAccKHR = merchant.accountNumbers.KHR;
      let vAccKHR =
        baseAccKHR.substring(0, baseAccKHR.length - 2) +
        seq.toString().padStart(2, "0");
      while (
        merchant.cashiers.some((c) => c.virtualAccounts?.KHR === vAccKHR) ||
        vAccKHR === baseAccKHR
      ) {
        seq++;
        vAccKHR =
          baseAccKHR.substring(0, baseAccKHR.length - 2) +
          seq.toString().padStart(2, "0");
      }
      virtualAccounts.KHR = vAccKHR;
    }

    merchant.cashiers.push({
      accountNumber: cashierAccountNumber,
      virtualAccounts: virtualAccounts,
      virtualAccount: virtualAccounts.USD || virtualAccounts.KHR,
      originalName: cashierOriginalName,
      displayName: cashierDisplayName,
      status: "Active",
    });

    await merchant.save();

    // 🌟 ផ្តល់ដំណឹង Telegram ទៅកាន់ម្ចាស់ហាង (Merchant Alert)
    if (typeof bot !== "undefined" && bot && bot.sendMerchantAlert) {
      const msg = `👨‍💼 <b>បន្ថែមអ្នកគិតលុយថ្មី</b>\n\nអ្នកបានបន្ថែម <b>${cashierDisplayName}</b> ទៅក្នុងហាង ${merchant.name} ដោយជោគជ័យ។`;
      bot.sendMerchantAlert(merchant._id, msg).catch(() => {});
    }

    res.status(200).json({
      success: true,
      message: "បានបន្ថែមអ្នកគិតលុយជោគជ័យ!",
      cashiers: merchant.cashiers,
    });
  } catch (error) {
    console.error("ADD CASHIER ERROR:", error);
    res.status(500).json({ success: false, message: "មានបញ្ហាបច្ចេកទេស" });
  }
};

// ១១. លុបអ្នកគិតលុយចេញពីហាង
exports.removeCashier = async (req, res) => {
  try {
    const { merchantId, cashierId } = req.params;
    const userId = req.user.username;

    const merchant = await Merchant.findOne({
      _id: merchantId,
      userId: userId,
    });
    if (!merchant)
      return res
        .status(404)
        .json({ success: false, message: "រកមិនឃើញហាងរបស់អ្នកទេ" });

    // រក្សាឈ្មោះទុកមុននឹងលុប ដើម្បីបាញ់សារ
    const removedCashier = merchant.cashiers.find(
      (c) => c._id.toString() === cashierId,
    );

    merchant.cashiers = merchant.cashiers.filter(
      (c) => c._id.toString() !== cashierId,
    );
    await merchant.save();

    // 🌟 ផ្តល់ដំណឹង Telegram ទៅម្ចាស់ហាង
    if (
      removedCashier &&
      typeof bot !== "undefined" &&
      bot &&
      bot.sendMerchantAlert
    ) {
      const msg = `🗑️ <b>លុបអ្នកគិតលុយចេញ</b>\n\nអ្នកគិតលុយឈ្មោះ <b>${removedCashier.displayName}</b> ត្រូវបានដកចេញពីហាង ${merchant.name} រួចរាល់។`;
      bot.sendMerchantAlert(merchant._id, msg).catch(() => {});
    }

    res.status(200).json({
      success: true,
      message: "បានលុបអ្នកគិតលុយជោគជ័យ!",
      cashiers: merchant.cashiers,
    });
  } catch (error) {
    console.error("REMOVE CASHIER ERROR:", error);
    res.status(500).json({ success: false, message: "មានបញ្ហាបច្ចេកទេស" });
  }
};

// =======================================================
// 💳 ផ្នែកទី ៦៖ TAP TO PAY (NFC Card Payment)
// =======================================================
const activeTaps = new Set(); // សម្រាប់ចាក់សោរការពារការឈូតត្រួតគ្នា

exports.processTapToPay = async (req, res) => {
  const { uid, amount, currency, pin, merchantId, cashierAcc } = req.body;
  const payAmount = parseFloat(amount);

  const tapLockKey = `${uid}_${merchantId}_${payAmount}`;
  if (activeTaps.has(tapLockKey))
    return res.json({
      success: false,
      message: "កំពុងដំណើរការទូទាត់ សូមរង់ចាំបន្តិច!",
    });
  activeTaps.add(tapLockKey);

  try {
    const System = require("../models/System");
    if (!uid || !amount || !currency || !merchantId)
      return res.json({
        success: false,
        message: "ទិន្នន័យផ្ញើមកមិនគ្រប់គ្រាន់ទេ!",
      });

    let exchangeRate = 4110;
    try {
      const sys = await System.findOne({ settingId: "GLOBAL_SETTINGS" });
      if (sys && sys.fxRates && sys.fxRates.usdToKhrBuy) {
        exchangeRate = parseFloat(sys.fxRates.usdToKhrBuy);
      }
    } catch (e) {}

    const customer = await User.findOne({ "virtualCards.uid": uid });
    if (!customer)
      return res.json({
        success: false,
        message: "រកមិនឃើញកាតនេះក្នុងប្រព័ន្ធទេ!",
      });
    if (customer.isFrozen)
      return res.json({ success: false, message: "គណនីអតិថិជនត្រូវបានផ្អាក!" });

    const card = customer.virtualCards.find((c) => c.uid === uid);
    if (!card)
      return res.json({ success: false, message: "រកមិនឃើញព័ត៌មានកាត!" });
    if (card.isLocked)
      return res.json({ success: false, message: "កាតនេះត្រូវបាន Block!" });

    let cardCurrency = card.linkedAccount || card.currency || "USD";
    let deductUsd = 0;
    let deductKhr = 0;
    let effectiveCurrency = currency;

    if (cardCurrency === currency) {
      if (currency === "USD") deductUsd = payAmount;
      else deductKhr = payAmount;
    } else if (cardCurrency === "USD" && currency === "KHR") {
      deductUsd = parseFloat((payAmount / exchangeRate).toFixed(2));
      effectiveCurrency = "USD";
    } else if (cardCurrency === "KHR" && currency === "USD") {
      deductKhr = payAmount * exchangeRate;
      effectiveCurrency = "KHR";
    } else {
      return res.json({
        success: false,
        message: "ប្រភេទរូបិយប័ណ្ណមិនត្រូវគ្នាទេ!",
      });
    }

    let requiresPin = false;
    let limitUsd =
      cardCurrency === "USD"
        ? deductUsd > 0
          ? deductUsd
          : 0
        : deductKhr / exchangeRate;
    if (limitUsd > 20) requiresPin = true;

    if (requiresPin && !pin)
      return res.json({
        success: false,
        message:
          "ទឹកប្រាក់លើសកម្រិតកំណត់ សូមអតិថិជនវាយបញ្ជាក់លេខសម្ងាត់ (PIN)!",
      });
    if (pin && card.pin !== pin)
      return res.json({
        success: false,
        message: "លេខសម្ងាត់កាត (PIN) មិនត្រឹមត្រូវទេ!",
      });

    // 🌟 ឆែកសមតុល្យតាមទម្រង់ User ថ្មី
    const mainUsdBal =
      customer.mainAccounts?.USD?.balance || customer.balance || 0;
    const mainKhrBal =
      customer.mainAccounts?.KHR?.balance || customer.balanceKHR || 0;

    if (deductUsd > 0 && mainUsdBal < deductUsd)
      return res.json({
        success: false,
        message: "សមតុល្យទឹកប្រាក់ USD ក្នុងកុងមិនគ្រប់គ្រាន់ទេ!",
      });
    if (deductKhr > 0 && mainKhrBal < deductKhr)
      return res.json({
        success: false,
        message: "សមតុល្យទឹកប្រាក់ KHR ក្នុងកុងមិនគ្រប់គ្រាន់ទេ!",
      });

    let shop = null;
    if (merchantId.match(/^[0-9a-fA-F]{24}$/))
      shop = await Merchant.findById(merchantId);
    if (!shop) shop = await Merchant.findOne({ merchantId: merchantId });
    if (!shop) return res.json({ success: false, message: "រកមិនឃើញហាងទេ!" });

    const dateStr = getKhmerDate();
    let amtInUsdForLimit = deductUsd > 0 ? deductUsd : deductKhr / exchangeRate;

    // 🌟 កាត់ប្រាក់តាមទម្រង់ User ថ្មី
    if (deductUsd > 0) {
      if (customer.mainAccounts?.USD)
        customer.mainAccounts.USD.balance -= deductUsd;
      else customer.balance -= deductUsd;
    }
    if (deductKhr > 0) {
      if (customer.mainAccounts?.KHR)
        customer.mainAccounts.KHR.balance -= deductKhr;
      else customer.balanceKHR -= deductKhr;
    }

    // អាប់ដេតចំណាយកាត
    card.dailySpentToday = (card.dailySpentToday || 0) + amtInUsdForLimit;

    customer.markModified("mainAccounts");
    customer.markModified("virtualCards");
    await customer.save();

    await Notification.create({
      userId: customer._id,
      username: customer.username,
      title: "ទូទាត់ប្រាក់ (Tap to Pay) 💳",
      message: `អ្នកបានទូទាត់ប្រាក់ ${currency === "USD" ? "$" : "៛"}${payAmount.toLocaleString()} ទៅកាន់ហាង ${shop.name}។`,
      date: dateStr,
      type: "tap_to_pay",
      isRead: false,
    });

    const incEscrow =
      currency === "USD"
        ? { "escrowHold.USD": payAmount }
        : { "escrowHold.KHR": payAmount };
    await Merchant.updateOne({ _id: shop._id }, { $inc: incEscrow });

    const trxRef = generateStandardRefId("TAP");
    const trxHash = generateStandardHash();

    const cashierName = cashierAcc ? ` (Cashier: ${cashierAcc})` : "";
    const receiverDisplayName = `${shop.name}${cashierName}`;
    const customerReceiverAcc =
      cashierAcc ||
      (shop.accountNumbers ? shop.accountNumbers[currency] : "N/A");

    let merchantLinkedAcc = shop.linkedAccounts
      ? shop.linkedAccounts[currency]
      : null;
    if (!merchantLinkedAcc && shop.linkedAccounts)
      merchantLinkedAcc =
        shop.linkedAccounts.USD || shop.linkedAccounts.KHR || "N/A";

    // 🌟 ទាញយកលេខកុងពិតប្រាកដរបស់អតិថិជន
    const actualCustomerAcc =
      deductUsd > 0
        ? customer.mainAccounts?.USD?.accountNumber || customer.accountNumber
        : customer.mainAccounts?.KHR?.accountNumber ||
          customer.accountNumberKHR;

    await Transaction.create({
      userId: customer._id,
      username: customer.username, // 🌟 ថែម Username
      refId: trxRef,
      hash: trxHash,
      date: dateStr,
      type: "Tap to Pay",
      amount: deductUsd > 0 ? -deductUsd : -deductKhr,
      currency: effectiveCurrency,
      senderName: customer.fullName || customer.username,
      senderAcc: actualCustomerAcc || "N/A", // 🌟 ជួសជុលបញ្ហា "N/A"
      receiverName: receiverDisplayName,
      receiverAcc: customerReceiverAcc,
      cardId: card.id,
      cardNumber: card.number,
      status: "Hold",
      remark: `ទូទាត់កាតតាមអត្រាប្តូរប្រាក់ស្វ័យប្រវត្តិ`,
      trxMethod: "NFC Payment",
      merchantId: shop.merchantId, // 🌟 ថែម Merchant ID
    });

    const shopOwner = await User.findOne({ username: shop.userId });
    await Transaction.create({
      userId: shopOwner ? shopOwner._id : undefined,
      username: shop.userId, // 🌟 ថែម Username
      refId: trxRef,
      hash: trxHash,
      date: dateStr,
      type: "Received",
      amount: payAmount,
      currency: currency,
      senderName: customer.fullName || customer.username,
      senderAcc: actualCustomerAcc || "N/A", // 🌟 ជួសជុលបញ្ហា "N/A"
      receiverName: receiverDisplayName,
      receiverAcc: merchantLinkedAcc,
      merchantId: shop.merchantId,
      cardId: card.id,
      cardNumber: card.number,
      status: "Hold",
      remark: "ប្រតិបត្តិការទូទាត់ឈូតកាត",
      trxMethod: "NFC Payment",
    });

    if (typeof bot !== "undefined" && bot && bot.sendMerchantPaymentAlert) {
      bot
        .sendMerchantPaymentAlert(shop._id, {
          amount: payAmount,
          currency: currency,
          senderName: customer.fullName || customer.username,
          refId: trxRef,
        })
        .catch(() => {});
    }

    if (global.io) {
      global.io.to(shop.userId).emit("transactionUpdated");
      global.io.to(customer.username).emit("transactionUpdated");
      global.io.to(shop.userId).emit("paymentReceived", {
        amount: payAmount,
        currency: currency,
        senderName: customer.fullName || customer.username,
      });
    }

    res.json({
      success: true,
      message: "ការទូទាត់ប្តូរប្រាក់អូតូតាម Rate បានជោគជ័យ!",
    });
  } catch (error) {
    console.error("Tap to Pay Exchange Error:", error);
    res
      .status(500)
      .json({ success: false, message: "Server Error: " + error.message });
  } finally {
    setTimeout(() => activeTaps.delete(tapLockKey), 5000);
  }
};

// =======================================================
// 💳 CHECK CARD BEFORE PAYMENT
// =======================================================
exports.checkCardBeforePayment = async (req, res) => {
  const { uid, amount, currency } = req.body;
  try {
    const System = require("../models/System");

    const customer = await User.findOne({ "virtualCards.uid": uid });
    if (!customer)
      return res.json({
        success: false,
        message: "កាតនេះមិនមានក្នុងប្រព័ន្ធ U-Pay ទេ!",
      });

    const card = customer.virtualCards.find((c) => c.uid === uid);
    if (!card)
      return res.json({ success: false, message: "ព័ត៌មានកាតមិនត្រឹមត្រូវ!" });
    if (card.isLocked)
      return res.json({ success: false, message: "កាតនេះត្រូវបាន Block!" });
    if (customer.isFrozen)
      return res.json({ success: false, message: "គណនីអតិថិជនត្រូវបានផ្អាក!" });
    if (card.isOnlinePayEnabled === false)
      return res.json({
        success: false,
        message: "កាតនេះត្រូវបានបិទមុខងារទូទាត់!",
      });

    let exchangeRate = 4110;
    try {
      const sys = await System.findOne({ settingId: "GLOBAL_SETTINGS" });
      if (sys && sys.fxRates && sys.fxRates.usdToKhrBuy) {
        exchangeRate = parseFloat(sys.fxRates.usdToKhrBuy);
      }
    } catch (e) {}

    let cardCurrency = card.linkedAccount || card.currency || "USD";
    const payAmount = parseFloat(amount);

    let requiredUsd = 0;
    let requiredKhr = 0;

    if (cardCurrency === currency) {
      if (currency === "USD") requiredUsd = payAmount;
      else requiredKhr = payAmount;
    } else if (cardCurrency === "USD" && currency === "KHR") {
      requiredUsd = payAmount / exchangeRate;
    } else if (cardCurrency === "KHR" && currency === "USD") {
      requiredKhr = payAmount * exchangeRate;
    } else {
      return res.json({
        success: false,
        message: "ប្រភេទរូបិយប័ណ្ណមិនត្រូវគ្នាទេ!",
      });
    }

    let payAmountUsd =
      cardCurrency === "USD" ? requiredUsd : requiredKhr / exchangeRate;
    const currentSpentToday = card.dailySpentToday || 0;
    const allowedLimit = card.dailyLimit || 0;

    if (allowedLimit > 0 && currentSpentToday + payAmountUsd > allowedLimit) {
      return res.json({
        success: false,
        message: `លើសដែនកំណត់ចំណាយប្រចាំថ្ងៃ (Daily Limit: $${allowedLimit})!`,
      });
    }

    if (requiredUsd > 0 && customer.balance < requiredUsd)
      return res.json({
        success: false,
        message: "សមតុល្យទឹកប្រាក់ USD ក្នុងកុងមិនគ្រប់គ្រាន់ទេ!",
      });
    if (requiredKhr > 0 && customer.balanceKHR < requiredKhr)
      return res.json({
        success: false,
        message: "សមតុល្យទឹកប្រាក់ KHR ក្នុងកុងមិនគ្រប់គ្រាន់ទេ!",
      });

    res.json({
      success: true,
      message: "កាតត្រឹមត្រូវ និងអាចទូទាត់បានតាម Exchange Rate",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// =======================================================
// ↩️ ផ្នែកទី ៧៖ មុខងារបង្វិលប្រាក់ (Refund Transaction)
// =======================================================
exports.refundTransaction = async (req, res) => {
  const { merchantId, refId, pin } = req.body;

  try {
    const shop = await Merchant.findOne({
      $or: [{ merchantId: merchantId }, { _id: merchantId }],
    });
    if (!shop) return res.json({ success: false, message: "រកហាងមិនឃើញទេ!" });

    const owner = await User.findOne({ username: shop.userId });
    if (!owner)
      return res.json({ success: false, message: "រកម្ចាស់ហាងមិនឃើញទេ!" });
    if (owner.pin !== pin)
      return res.json({
        success: false,
        message: "លេខសម្ងាត់ PIN មិនត្រឹមត្រូវទេ!",
      });

    const trxs = await Transaction.find({ refId: refId });
    if (!trxs || trxs.length === 0)
      return res.json({ success: false, message: "រកមិនឃើញប្រវត្តិនេះទេ!" });

    const isAlreadyRefunded = trxs.some(
      (t) => t.status === "Refunded" || t.status === "Voided",
    );
    if (isAlreadyRefunded)
      return res.json({
        success: false,
        message: "ប្រតិបត្តិការនេះត្រូវបានបង្វិលប្រាក់រួចហើយ!",
      });

    // 🌟 កែតម្រូវការស្វែងរក Transaction
    // ប្រើ amount > 0 សម្រាប់ហាង (ព្រោះហាងអ្នកទទួលលុយ ទោះជា Hold ក៏ដោយ)
    const merchantTrx = trxs.find((t) => t.amount > 0);
    if (!merchantTrx || merchantTrx.status !== "Hold") {
      return res.json({
        success: false,
        message:
          "អាចធ្វើការ Refund បានតែលើប្រតិបត្តិការដែលមានស្ថានភាព Hold ប៉ុណ្ណោះ!",
      });
    }

    // ប្រើ amount < 0 សម្រាប់អតិថិជន (ព្រោះអតិថិជនជាអ្នកចំណាយ)
    const customerTrx = trxs.find((t) => t.amount < 0);
    if (!customerTrx)
      return res.json({ success: false, message: "រកមិនឃើញព័ត៌មានអតិថិជន!" });

    const refundAmount = Math.abs(customerTrx.amount);
    const customerCurrency = customerTrx.currency;
    const merchantCurrency = merchantTrx.currency;
    const customerUsername = customerTrx.username;

    // ១. ដកលុយចេញពី Escrow របស់ហាង
    const decEscrow =
      merchantCurrency === "USD"
        ? { "escrowHold.USD": -merchantTrx.amount }
        : { "escrowHold.KHR": -merchantTrx.amount };
    await Merchant.updateOne({ _id: shop._id }, { $inc: decEscrow });

    // ២. បង្វិលលុយចូលគណនីអតិថិជនវិញ (Support ទម្រង់ User.js ថ្មី)
    const customerObj = await User.findOne({ username: customerUsername });
    if (customerObj) {
      if (customerCurrency === "USD") {
        if (customerObj.mainAccounts?.USD)
          customerObj.mainAccounts.USD.balance += refundAmount;
        else customerObj.balance += refundAmount;
      } else {
        if (customerObj.mainAccounts?.KHR)
          customerObj.mainAccounts.KHR.balance += refundAmount;
        else customerObj.balanceKHR += refundAmount;
      }
      customerObj.markModified("mainAccounts");
      await customerObj.save();

      const dateStr = getKhmerDate();

      // 🌟 Notification ប្រាប់អតិថិជន
      await Notification.create({
        userId: customerObj._id,
        username: customerObj.username,
        title: "ប្រាក់ត្រូវបានបង្វិលត្រឡប់ ↩️",
        message: `ហាង ${shop.name} បានបង្វិលប្រាក់ ${customerCurrency === "USD" ? "$" : "៛"}${refundAmount.toLocaleString()} ជូនអ្នកវិញហើយ។`,
        date: dateStr,
        type: "refund_receive",
        isRead: false,
      });

      await Transaction.updateMany(
        { refId: refId },
        { $set: { status: "Refunded" } },
      );

      const newRefId = generateStandardRefId("RFD");
      const newHash = generateStandardHash();

      await Transaction.create({
        userId: customerObj._id,
        username: customerUsername,
        refId: newRefId,
        hash: newHash,
        date: dateStr,
        type: "Refunded",
        amount: refundAmount,
        currency: customerCurrency,
        senderName: shop.name,
        receiverName: customerTrx.senderName,
        status: "Success",
        remark: `បង្វិលប្រាក់ត្រឡប់វិញពីហាង (Ref: ${refId})`,
        trxMethod: "Refund",
        cardId: customerTrx.cardId,
        cardNumber: customerTrx.cardNumber,
      });

      await Transaction.create({
        userId: owner._id,
        username: shop.userId,
        merchantId: shop.merchantId,
        refId: newRefId,
        hash: newHash,
        date: dateStr,
        type: "Refund",
        amount: -merchantTrx.amount,
        currency: merchantCurrency,
        senderName: shop.name,
        receiverName: customerTrx.senderName,
        status: "Success",
        remark: `បានធ្វើការបង្វិលប្រាក់ទៅអតិថិជន (Ref: ${refId})`,
        trxMethod: "Refund",
      });

      // 🌟 Telegram Merchant Alert
      if (typeof bot !== "undefined" && bot && bot.sendMerchantAlert) {
        const refundMsg = `🔄 <b>ប្រាក់ត្រូវបានបង្វិល (Refunded)</b>\n\nហាងរបស់អ្នកបានបង្វិលប្រាក់ចំនួន <b>${merchantCurrency === "USD" ? "$" : "៛"}${Math.abs(merchantTrx.amount).toLocaleString()}</b> ទៅកាន់អតិថិជន <b>${customerTrx.senderName}</b> វិញជោគជ័យ។\nលេខយោង៖ #${newRefId}`;
        bot.sendMerchantAlert(shop._id, refundMsg).catch(() => {});
      }

      if (global.io) {
        global.io.to(shop.userId).emit("transactionUpdated");
        global.io.to(customerUsername).emit("transactionUpdated");
        global.io.to(shop.userId).emit("paymentReceived", {
          amount: Math.abs(merchantTrx.amount),
          currency: merchantCurrency,
          senderName: customerTrx.senderName,
          refId: newRefId,
          hash: newHash,
        });
      }

      res.json({
        success: true,
        message: "ការបង្វិលប្រាក់បានសម្រេចជោគជ័យ!",
        refId: newRefId,
        hash: newHash,
        senderName: customerTrx.senderName,
      });
    } else {
      res.json({
        success: false,
        message: "រកមិនឃើញគណនីអតិថិជនដើម្បីបង្វិលប្រាក់ទេ!",
      });
    }
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Server Error: " + error.message });
  }
};

// =======================================================
// 📄 ផ្នែកទី ៨៖ ការទាញយកវិក្កយបត្រ (PDF Generator)
// =======================================================
exports.downloadMerchantCredentialPDF = async (req, res) => {
  try {
    if (
      req.user.role !== "super_admin" &&
      req.user.role !== "finance_admin" &&
      req.user.role !== "custom"
    ) {
      return res
        .status(403)
        .json({ success: false, message: "Access Denied!" });
    }

    const { id } = req.params;
    const showApiKey = req.query.showKey === "true";
    const showApiSecret = req.query.showSecret === "true";
    const showWebhook = req.query.showWebhook === "true";

    const merchant = await Merchant.findById(id);
    if (!merchant)
      return res
        .status(404)
        .json({ success: false, message: "រកមិនឃើញហាងនេះទេ!" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=Merchant-Credentials-${merchant.merchantId}.pdf`,
    );

    const doc = new PDFDocument({ margin: 0, size: "A4" });
    doc.pipe(res);

    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];
    const timeStr = now.toTimeString().split(" ")[0];

    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#475569")
      .text(`Date: ${dateStr}`, 450, 40)
      .text(`Time: ${timeStr}`, 450, 55);

    const logoPath = path.join(__dirname, "../public/images/logo.png");
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 200, 35, { width: 35 });
      doc
        .font("Helvetica-Bold")
        .fontSize(26)
        .fillColor("#004d40")
        .text("UPAY", 245, 40);
    } else {
      doc
        .font("Helvetica-Bold")
        .fontSize(26)
        .fillColor("#004d40")
        .text("U UPAY", 0, 40, { align: "center" });
    }

    doc
      .font("Helvetica-Bold")
      .fontSize(14)
      .fillColor("#004d40")
      .text("MERCHANT INFORMATION", 0, 80, { align: "center" });
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#64748b")
      .text("Merchant Profile & Account Details", 0, 98, { align: "center" });
    doc.moveTo(40, 125).lineTo(555, 125).lineWidth(1.5).stroke("#059669");

    let currentY = 140;
    const pageHeight = 842;

    function checkPageBreak(requiredSpace) {
      if (currentY + requiredSpace > pageHeight - 80) {
        doc.addPage();
        currentY = 40;
      }
    }

    function drawSection(title, data, themeColor, bgLightColor) {
      const rowHeight = 22;
      const titleHeight = 26;
      const sectionHeight = titleHeight + data.length * rowHeight + 5;

      checkPageBreak(sectionHeight);

      doc.save();
      doc.roundedRect(40, currentY, 515, titleHeight, 5).fill(bgLightColor);
      doc.rect(40, currentY + 10, 515, titleHeight - 10).fill(bgLightColor);
      doc.restore();

      doc
        .roundedRect(40, currentY, 515, sectionHeight, 5)
        .lineWidth(1)
        .stroke(themeColor);
      doc
        .font("Helvetica-Bold")
        .fontSize(11)
        .fillColor(themeColor)
        .text(title, 55, currentY + 8);
      currentY += titleHeight;

      doc.font("Helvetica").fontSize(9);
      data.forEach((row, i) => {
        if (i > 0)
          doc
            .moveTo(41, currentY)
            .lineTo(554, currentY)
            .lineWidth(0.5)
            .stroke("#e2e8f0");

        doc
          .fillColor("#475569")
          .text(row.label, 50, currentY + 6, { width: 140 });

        if (row.isBadge) {
          doc.roundedRect(200, currentY + 4, 45, 14, 7).fill("#10b981");
          doc
            .fillColor("#ffffff")
            .font("Helvetica-Bold")
            .fontSize(8)
            .text(row.value, 200, currentY + 8, { width: 45, align: "center" });
          doc.font("Helvetica").fontSize(9);
        } else if (row.isLink) {
          doc.fillColor("#3b82f6").text(row.value, 200, currentY + 6, {
            width: 340,
            lineBreak: false,
          });
        } else {
          doc.fillColor("#0f172a").text(row.value, 200, currentY + 6, {
            width: 340,
            lineBreak: false,
          });
        }
        currentY += rowHeight;
      });
      currentY += 15;
    }

    const dateCreated = merchant.createdAt
      ? new Date(merchant.createdAt).toISOString()
      : "N/A";
    const dateUpdated = merchant.updatedAt
      ? new Date(merchant.updatedAt).toISOString()
      : "N/A";

    drawSection(
      "Merchant Information",
      [
        { label: "User ID", value: merchant.userId || "N/A" },
        { label: "Name", value: merchant.name || "N/A" },
        { label: "City", value: merchant.city || "N/A" },
        { label: "Category", value: merchant.category || "N/A" },
        { label: "Merchant ID", value: merchant.merchantId || "N/A" },
        { label: "Status", value: merchant.status || "Active", isBadge: true },
        { label: "Created At", value: dateCreated },
        { label: "Updated At", value: dateUpdated },
      ],
      "#059669",
      "#ecfdf5",
    );

    drawSection(
      "Linked Accounts",
      [
        { label: "Currency", value: "USD" },
        {
          label: "Account Number",
          value: merchant.linkedAccounts?.USD || "N/A",
        },
        { label: "Currency", value: "KHR" },
        {
          label: "Account Number",
          value: merchant.linkedAccounts?.KHR || "N/A",
        },
        { label: "Merchant ID", value: merchant.merchantId || "N/A" },
      ],
      "#0284c7",
      "#e0f2fe",
    );

    drawSection(
      "Account Numbers",
      [
        { label: "Currency", value: "USD" },
        {
          label: "Account Number",
          value: merchant.accountNumbers?.USD || "N/A",
        },
        { label: "Currency", value: "KHR" },
        {
          label: "Account Number",
          value: merchant.accountNumbers?.KHR || "N/A",
        },
      ],
      "#059669",
      "#ecfdf5",
    );

    drawSection(
      "Collected",
      [
        { label: "Currency", value: "USD" },
        { label: "Amount", value: (merchant.collected?.USD || 0).toString() },
        { label: "Currency", value: "KHR" },
        { label: "Amount", value: (merchant.collected?.KHR || 0).toString() },
      ],
      "#d97706",
      "#fef3c7",
    );

    drawSection(
      "Escrow Hold",
      [
        { label: "Currency", value: "USD" },
        { label: "Amount", value: (merchant.escrowHold?.USD || 0).toString() },
        { label: "Currency", value: "KHR" },
        { label: "Amount", value: (merchant.escrowHold?.KHR || 0).toString() },
      ],
      "#7c3aed",
      "#f3e8ff",
    );

    const apiKeyDisplay = showApiKey
      ? merchant.apiKey || "N/A"
      : "******************************** (Hidden)";
    const apiSecretDisplay = showApiSecret
      ? merchant.apiSecret || "N/A"
      : "******************************** (Hidden)";
    const webhookDisplay = showWebhook
      ? merchant.webhookUrl || "null"
      : "******************************** (Hidden)";

    drawSection(
      "API & Webhook",
      [
        { label: "API Key", value: apiKeyDisplay },
        { label: "API Secret", value: apiSecretDisplay },
        { label: "Webhook URL", value: webhookDisplay, isLink: showWebhook },
        { label: "Telegram Chat ID", value: merchant.telegramChatId || "null" },
        {
          label: "Cashiers",
          value: merchant.cashiers
            ? `[${merchant.cashiers.length} Users]`
            : "[]",
        },
      ],
      "#0284c7",
      "#f0f9ff",
    );

    checkPageBreak(120);
    currentY += 20;

    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor("#059669")
      .text("Prepared By", 60, currentY)
      .text("Received By", 350, currentY);

    currentY += 40;
    doc.lineWidth(1).stroke("#cbd5e1");

    doc.moveTo(40, currentY).lineTo(140, currentY).stroke();
    doc.moveTo(150, currentY).lineTo(250, currentY).stroke();
    doc.moveTo(260, currentY).lineTo(320, currentY).stroke();

    doc.moveTo(340, currentY).lineTo(440, currentY).stroke();
    doc.moveTo(450, currentY).lineTo(550, currentY).stroke();

    currentY += 8;
    doc.font("Helvetica").fontSize(8).fillColor("#64748b");
    doc.text("Name", 80, currentY);
    doc.text("Signature", 185, currentY);
    doc.text("Date", 280, currentY);
    doc.text("Name", 380, currentY);
    doc.text("Signature", 485, currentY);

    const bottomY = pageHeight - 40;
    doc
      .font("Helvetica-Bold")
      .fontSize(12)
      .fillColor("#004d40")
      .text("UPAY", 0, bottomY - 15, { align: "center" });
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#64748b")
      .text("Secure Payment • Better Business", 0, bottomY, {
        align: "center",
      });
    doc
      .polygon(
        [0, pageHeight],
        [0, pageHeight - 15],
        [595, pageHeight - 30],
        [595, pageHeight],
      )
      .fill("#059669");

    doc.end();
  } catch (error) {
    if (!res.headersSent)
      res.status(500).json({ success: false, message: error.message });
  }
};
