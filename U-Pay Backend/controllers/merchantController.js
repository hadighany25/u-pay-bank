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

// 🔍 អនុគមន៍ជំនួយ៖ ផ្ទៀងផ្ទាត់ថាគណនីដែលយកមកភ្ជាប់ពិតជារបស់គាត់មែន និងមិនមែនជាកុងកុមារ (Junior)
function verifyValidMerchantAccount(owner, accNum, expectedCurrency) {
  if (!accNum) return null;
  const cleanNum = String(accNum).includes("_")
    ? String(accNum).split("_")[1]
    : String(accNum).trim();

  if (
    expectedCurrency === "USD" &&
    (cleanNum === "USD" || cleanNum === owner.mainAccounts?.USD?.accountNumber)
  ) {
    return owner.mainAccounts?.USD?.accountNumber || owner.accountNumber;
  }
  if (
    expectedCurrency === "KHR" &&
    (cleanNum === "KHR" || cleanNum === owner.mainAccounts?.KHR?.accountNumber)
  ) {
    return owner.mainAccounts?.KHR?.accountNumber || owner.accountNumberKHR;
  }

  if (owner.subAccounts && owner.subAccounts.length > 0) {
    const sub = owner.subAccounts.find(
      (s) =>
        s.accountNumber === cleanNum &&
        s.currency === expectedCurrency &&
        s.accountType !== "junior",
    );
    if (sub) return sub.accountNumber;
  }
  return null;
}

// ១. មុខងារបង្កើតហាងថ្មី (Create Merchant - គាំទ្ររូបឡូហ្គោហាង និងការកំណត់ដាច់ដោយឡែក)
exports.createMerchant = async (req, res) => {
  try {
    const {
      name,
      logo,
      city,
      category,
      linkedAccUSD,
      linkedAccKHR,
      pin,
      settings,
    } = req.body;
    const username = req.user.username;

    const owner = await User.findOne({ username });
    if (!owner)
      return res
        .status(404)
        .json({ success: false, message: "រកមិនឃើញគណនីរបស់អ្នកទេ" });
    if (owner.pin !== pin)
      return res
        .status(400)
        .json({ success: false, message: "លេខកូដ PIN មិនត្រឹមត្រូវទេ" });

    const validUsdAcc = verifyValidMerchantAccount(owner, linkedAccUSD, "USD");
    const validKhrAcc = verifyValidMerchantAccount(owner, linkedAccKHR, "KHR");

    if (!validUsdAcc && !validKhrAcc) {
      return res.status(400).json({
        success: false,
        message: "សូមជ្រើសរើសគណនីភ្ជាប់ដែលត្រឹមត្រូវយ៉ាងហោចណាស់មួយ!",
      });
    }

    const merchantId = "500" + generateRandomNumber(12);
    const apiKey = "upay_live_" + crypto.randomBytes(16).toString("hex");
    const apiSecret = crypto.randomBytes(32).toString("hex");

    let accountNumbers = { USD: null, KHR: null };
    let linkedAccounts = { USD: null, KHR: null };

    if (validUsdAcc) {
      accountNumbers.USD = "888" + generateRandomNumber(9);
      linkedAccounts.USD = validUsdAcc;
    }
    if (validKhrAcc) {
      accountNumbers.KHR = "999" + generateRandomNumber(9);
      linkedAccounts.KHR = validKhrAcc;
    }

    const newMerchant = new Merchant({
      ownerId: owner._id,
      userCustomId: owner.userId || owner.id || owner._id.toString(),
      username: owner.username,
      userId: owner.username,
      name: String(name || "").trim(),
      logo: logo || "",
      city: city || "Phnom Penh",
      category: category || "Food & Beverage",
      merchantId,
      apiKey,
      apiSecret,
      linkedAccounts,
      accountNumbers,
      collected: { USD: 0.0, KHR: 0 },
      settings: {
        voiceEnabled: settings?.voiceEnabled !== false,
        voiceLang: settings?.voiceLang || "km",
        soundChime: settings?.soundChime !== false,
        telegramAlertEnabled: true,
        defaultCurrency: validUsdAcc ? "USD" : "KHR",
        receiptFooter:
          settings?.receiptFooter || "សូមអរគុណដែលបានគាំទ្រហាងយើងខ្ញុំ!",
      },
      status: "Active",
    });

    const savedMerchant = await newMerchant.save();

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
      merchant: savedMerchant,
    });
  } catch (error) {
    console.error("CREATE MERCHANT ERROR:", error);
    res
      .status(500)
      .json({ success: false, message: "មានបញ្ហាបច្ចេកទេសលើ Server" });
  }
};

// ២. ទាញយកហាងទាំងអស់របស់អ្នកប្រើប្រាស់ (Get Merchants + Auto-Migrate សុវត្ថិភាព ៣ ជាន់)
exports.getMyMerchants = async (req, res) => {
  try {
    const username = req.user.username;
    const owner = await User.findOne({ username }).select(
      "_id id userId username",
    );

    const query = owner
      ? {
          $or: [
            { userId: username },
            { username: username },
            { ownerId: owner._id },
          ],
        }
      : { $or: [{ userId: username }, { username: username }] };

    const merchants = await Merchant.find(query).select("-apiSecret");

    // 🔄 Auto-Migrate: បើហាងចាស់ៗអត់ទាន់មាន ownerId, username, ឬ userCustomId គឺបំពេញឱ្យអូតូ
    if (owner && merchants.length > 0) {
      for (const m of merchants) {
        if (!m.ownerId || !m.username || !m.userCustomId) {
          m.ownerId = owner._id;
          m.username = owner.username;
          m.userCustomId = owner.userId || owner.id || owner._id.toString();
          await m.save();
        }
      }
    }

    res.status(200).json({ success: true, merchants });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ៣. លុបហាង (Delete Merchant by Owner)
exports.deleteMerchant = async (req, res) => {
  try {
    const { merchantId } = req.params;
    const username = req.user.username;

    const merchant = await Merchant.findOneAndDelete({
      _id: merchantId,
      $or: [{ userId: username }, { username: username }],
    });
    if (!merchant)
      return res
        .status(404)
        .json({ success: false, message: "Merchant not found" });

    const owner = await User.findOne({ username });
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

// ៤. កែប្រែព័ត៌មានហាង រូបឡូហ្គោ គណនីភ្ជាប់ និងការកំណត់ដាច់ដោយឡែកតាមហាង (Update Merchant & Per-Shop Settings)
exports.updateMerchant = async (req, res) => {
  try {
    const {
      name,
      logo,
      city,
      category,
      linkedAccUSD,
      linkedAccKHR,
      webhookUrl,
      settings,
    } = req.body;
    const username = req.user.username;

    const owner = await User.findOne({ username });
    if (!owner)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    const merchant = await Merchant.findOne({
      _id: req.params.merchantId,
      $or: [{ userId: username }, { username: username }],
    });

    if (!merchant)
      return res
        .status(404)
        .json({ success: false, message: "Merchant not found" });

    if (name !== undefined && String(name).trim() !== "") {
      merchant.name = String(name).trim();
    }
    if (logo !== undefined) merchant.logo = logo;
    if (city !== undefined) merchant.city = city;
    if (category !== undefined) merchant.category = category;
    if (webhookUrl !== undefined) merchant.webhookUrl = webhookUrl;

    // ⚙️ អាប់ដេតការកំណត់ដាច់ដោយឡែកសម្រាប់តែហាងនេះ (Per-Shop Settings)
    if (settings && typeof settings === "object") {
      merchant.settings = {
        ...(merchant.settings
          ? merchant.settings.toObject?.() || merchant.settings
          : {}),
        ...settings,
      };
      merchant.markModified("settings");
    }

    // 🔗 បើមានបញ្ជូនគណនីភ្ជាប់ថ្មីមក ធ្វើការផ្ទៀងផ្ទាត់ និងអាប់ដេត
    if (linkedAccUSD !== undefined || linkedAccKHR !== undefined) {
      const validUsdAcc = verifyValidMerchantAccount(
        owner,
        linkedAccUSD,
        "USD",
      );
      const validKhrAcc = verifyValidMerchantAccount(
        owner,
        linkedAccKHR,
        "KHR",
      );

      if (!validUsdAcc && !validKhrAcc) {
        return res.status(400).json({
          success: false,
          message: "សូមជ្រើសរើសគណនីទទួលប្រាក់យ៉ាងហោចណាស់មួយ!",
        });
      }

      let newLinked = { USD: null, KHR: null };
      let newAccNums = {
        USD: merchant.accountNumbers?.USD || null,
        KHR: merchant.accountNumbers?.KHR || null,
      };

      if (validUsdAcc) {
        newLinked.USD = validUsdAcc;
        if (!newAccNums.USD) newAccNums.USD = "888" + generateRandomNumber(9);
      } else {
        newAccNums.USD = null;
      }

      if (validKhrAcc) {
        newLinked.KHR = validKhrAcc;
        if (!newAccNums.KHR) newAccNums.KHR = "999" + generateRandomNumber(9);
      } else {
        newAccNums.KHR = null;
      }

      merchant.linkedAccounts = newLinked;
      merchant.accountNumbers = newAccNums;
      merchant.markModified("linkedAccounts");
      merchant.markModified("accountNumbers");
    }

    merchant.ownerId = owner._id;
    merchant.username = owner.username;
    merchant.userCustomId = owner.userId || owner.id || owner._id.toString();

    await merchant.save();
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

// ៨. ផ្តាច់ការជូនដំណឹងពី Telegram វិញ (ដាច់ដោយឡែកតាមហាង)
exports.unlinkTelegram = async (req, res) => {
  try {
    const { merchantId } = req.body;
    const userId = req.user.username;

    const merchant = await Merchant.findOne({
      _id: merchantId,
      $or: [{ userId: userId }, { username: userId }],
    });
    if (!merchant)
      return res
        .status(404)
        .json({ success: false, message: "រកមិនឃើញហាងរបស់អ្នកទេ" });

    const bot = require("../services/telegramBot");
    if (merchant.telegramChatId && bot && bot.sendMerchantUnlinkAlert) {
      await bot.sendMerchantUnlinkAlert(merchant.telegramChatId, merchant.name);
    }

    merchant.telegramChatId = null;
    merchant.telegramGroupName = "";
    await merchant.save();

    res
      .status(200)
      .json({ success: true, message: "បានផ្តាច់ Telegram ដោយជោគជ័យ" });
  } catch (error) {
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

// ៩. ស្វែងរកគណនី U-Pay របស់កូនចៅ (គាំទ្រទាំងលេខគណនី, @username, និងលេខទូរស័ព្ទ!)
exports.searchCashierAccount = async (req, res) => {
  try {
    const clean = String(req.params.accountNumber || "")
      .replace(/^@/, "")
      .trim();
    const rx = new RegExp(
      "^" + clean.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$",
      "i",
    );

    const user = await User.findOne({
      $or: [
        { "mainAccounts.USD.accountNumber": clean },
        { "mainAccounts.KHR.accountNumber": clean },
        { "subAccounts.accountNumber": clean },
        { accountNumber: clean },
        { accountNumberKHR: clean },
        { username: rx },
        { phone: clean },
      ],
    });

    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "រកមិនឃើញគណនីបុគ្គលិកនេះទេ!" });

    const primaryAcc =
      user.mainAccounts?.USD?.accountNumber ||
      user.mainAccounts?.KHR?.accountNumber ||
      user.accountNumber ||
      user.username;

    res.status(200).json({
      success: true,
      accountName: user.fullName || user.username,
      username: user.username,
      profileImage: user.profileImage || "",
      accountNumber: primaryAcc,
    });
  } catch (error) {
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
// 💳 ផ្នែកទី ៦៖ TAP TO PAY (NFC Card Payment - Fixed & Secured)
// =======================================================
const activeTaps = new Set();

exports.processTapToPay = async (req, res) => {
  const { uid, amount, currency, pin, merchantId, cashierAcc } = req.body;
  const payAmount = parseFloat(amount);

  // 🌟 1. Normalize UID ឱ្យត្រូវគ្រប់ទម្រង់ទាំងអស់ (Hex vs Decimal)
  const rawInputUid = String(uid || "").trim();
  let cleanUid = rawInputUid.replaceAll(":", "").toUpperCase();
  if (/^\d{10}$/.test(cleanUid)) {
    let hex = parseInt(cleanUid, 10)
      .toString(16)
      .toUpperCase()
      .padStart(8, "0");
    cleanUid =
      hex.substring(6, 8) +
      hex.substring(4, 6) +
      hex.substring(2, 4) +
      hex.substring(0, 2);
  }

  const tapLockKey = `${cleanUid}_${merchantId}_${payAmount}`;
  if (activeTaps.has(tapLockKey))
    return res.json({
      success: false,
      message: "កំពុងដំណើរការទូទាត់ សូមរង់ចាំបន្តិច!",
    });
  activeTaps.add(tapLockKey);

  try {
    const System = require("../models/System");
    const JointAccount = require("../models/JointAccount");
    const Card = require("../models/Card");

    if (!rawInputUid || !amount || !currency || !merchantId) {
      return res.json({
        success: false,
        message: "ទិន្នន័យផ្ញើមកមិនគ្រប់គ្រាន់ទេ!",
      });
    }

    // 🌟 2. ស្វែងរកកាតតាមគ្រប់លក្ខខណ្ឌទាំងអស់ (Flexible Query)
    const card = await Card.findOne({
      $or: [
        { uid: cleanUid },
        { uid: rawInputUid },
        { uid: rawInputUid.toUpperCase() },
        { uid: rawInputUid.toLowerCase() },
        { uid: { $regex: new RegExp("^" + cleanUid + "$", "i") } },
      ],
    });

    if (!card)
      return res.json({
        success: false,
        message: "រកមិនឃើញកាតនេះក្នុងប្រព័ន្ធទេ (Card not found)!",
      });

    // 🛡️ ការពារ៖ ហាមយកកាតនិម្មិត (Virtual Card) មកស្កេន NFC
    const cardCat =
      card.cardCategory || (card.isPhysical ? "debit" : "virtual");
    if (cardCat === "virtual" && !card.isPhysical) {
      return res.json({
        success: false,
        message:
          "កាតនិម្មិត (Virtual Card) មិនអាចប្រើប្រាស់សម្រាប់ស្កេនទូទាត់តាម POS ទេ។",
      });
    }

    if (card.isLocked)
      return res.json({ success: false, message: "កាតនេះត្រូវបាន Block!" });

    const customer = await User.findOne({
      $or: [{ _id: card.userId }, { username: card.username }],
    });
    if (!customer)
      return res.json({ success: false, message: "រកមិនឃើញគណនីម្ចាស់កាតទេ!" });
    if (customer.isFrozen)
      return res.json({ success: false, message: "គណនីអតិថិជនត្រូវបានផ្អាក!" });

    let exchangeRate = 4110;
    try {
      const sys = await System.findOne({ settingId: "GLOBAL_SETTINGS" });
      if (sys && sys.fxRates && sys.fxRates.usdToKhrBuy) {
        exchangeRate = parseFloat(sys.fxRates.usdToKhrBuy);
      }
    } catch (e) {}

    // 🔍 ស្វែងរកគណនីកាត់លុយពិតប្រាកដ (គាំទ្រទាំងលេខកុង Main និង Sub Accounts)
    let cardLinkedAcc = String(card.linkedAccount || "USD").trim();
    if (cardLinkedAcc.includes("_"))
      cardLinkedAcc = cardLinkedAcc.split("_")[1];

    let customerDeductAccObj = null;
    let customerAccType = "MAIN";
    let customerSubIndex = -1;

    if (
      cardLinkedAcc === "USD" ||
      cardLinkedAcc === customer.mainAccounts?.USD?.accountNumber
    ) {
      customerDeductAccObj = customer.mainAccounts.USD;
    } else if (
      cardLinkedAcc === "KHR" ||
      cardLinkedAcc === customer.mainAccounts?.KHR?.accountNumber
    ) {
      customerDeductAccObj = customer.mainAccounts.KHR;
    } else if (customer.subAccounts && customer.subAccounts.length > 0) {
      customerSubIndex = customer.subAccounts.findIndex(
        (s) => String(s.accountNumber) === String(cardLinkedAcc),
      );
      if (customerSubIndex !== -1) {
        customerDeductAccObj = customer.subAccounts[customerSubIndex];
        customerAccType = "SUB";
      }
    }

    // Fallback បើរកកុងភ្ជាប់មិនឃើញ ប្រើ Main USD អូតូ
    if (!customerDeductAccObj && customer.mainAccounts?.USD) {
      customerDeductAccObj = customer.mainAccounts.USD;
    }

    if (!customerDeductAccObj) {
      return res.json({
        success: false,
        message: "រកគណនីដែលភ្ជាប់ជាមួយកាតនេះមិនឃើញទេ!",
      });
    }

    let cardCurrency = customerDeductAccObj.currency || "USD";
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
    }

    let limitUsd =
      cardCurrency === "USD"
        ? deductUsd > 0
          ? deductUsd
          : 0
        : deductKhr / exchangeRate;
    if (limitUsd > 20 && !pin) {
      return res.json({
        success: false,
        message:
          "ទឹកប្រាក់លើសកម្រិតកំណត់ សូមអតិថិជនវាយបញ្ជាក់លេខសម្ងាត់ (PIN)!",
      });
    }
    if (pin && card.pin && card.pin !== pin) {
      return res.json({
        success: false,
        message: "លេខសម្ងាត់កាត (PIN) មិនត្រឹមត្រូវទេ!",
      });
    }

    let currentCustomerBal = customerDeductAccObj.balance || 0;
    let jointDataForDeduct = null;

    if (
      customerAccType === "SUB" &&
      (customerDeductAccObj.accountType === "joint" ||
        customerDeductAccObj.accountType === "joint_member")
    ) {
      jointDataForDeduct = await JointAccount.findOne({
        accountId: customerDeductAccObj.accountId,
      });
      if (jointDataForDeduct)
        currentCustomerBal = jointDataForDeduct.balance || 0;
    }

    let deductAmount = cardCurrency === "USD" ? deductUsd : deductKhr;

    if (currentCustomerBal < deductAmount) {
      return res.json({
        success: false,
        message: `សមតុល្យក្នុងគណនីកាត (${cardCurrency}) មិនគ្រប់គ្រាន់ទេ!`,
      });
    }

    let shop = null;
    if (merchantId.match(/^[0-9a-fA-F]{24}$/))
      shop = await Merchant.findById(merchantId);
    if (!shop) shop = await Merchant.findOne({ merchantId: merchantId });
    if (!shop) return res.json({ success: false, message: "រកមិនឃើញហាងទេ!" });

    const shopOwner = await User.findOne({ username: shop.userId });
    if (!shopOwner)
      return res.json({ success: false, message: "រកម្ចាស់ហាងមិនឃើញទេ!" });

    const dateStr = getKhmerDate();
    let amtInUsdForLimit = deductUsd > 0 ? deductUsd : deductKhr / exchangeRate;

    // កាត់លុយពីអតិថិជន
    if (customerAccType === "MAIN") {
      if (cardCurrency === "USD")
        customer.mainAccounts.USD.balance -= deductUsd;
      else customer.mainAccounts.KHR.balance -= deductKhr;
    } else {
      if (jointDataForDeduct) {
        jointDataForDeduct.balance -= deductAmount;
        await jointDataForDeduct.save();
        customer.subAccounts[customerSubIndex].balance =
          jointDataForDeduct.balance;
      } else {
        customer.subAccounts[customerSubIndex].balance -= deductAmount;
      }
    }

    customer.markModified("mainAccounts");
    customer.markModified("subAccounts");
    await customer.save();

    card.dailySpentToday = (card.dailySpentToday || 0) + amtInUsdForLimit;
    card.dailyTxCountToday = (card.dailyTxCountToday || 0) + 1;
    await card.save();

    // បញ្ចូលលុយទៅហាង
    let targetReceiveAccNumber = shop.linkedAccounts
      ? shop.linkedAccounts[currency]
      : null;

    if (targetReceiveAccNumber) {
      let isReceived = false;
      if (
        shopOwner.mainAccounts?.USD?.accountNumber === targetReceiveAccNumber
      ) {
        shopOwner.mainAccounts.USD.balance += payAmount;
        isReceived = true;
      } else if (
        shopOwner.mainAccounts?.KHR?.accountNumber === targetReceiveAccNumber
      ) {
        shopOwner.mainAccounts.KHR.balance += payAmount;
        isReceived = true;
      } else if (shopOwner.subAccounts && shopOwner.subAccounts.length > 0) {
        const subIdx = shopOwner.subAccounts.findIndex(
          (s) => s.accountNumber === targetReceiveAccNumber,
        );
        if (subIdx !== -1) {
          shopOwner.subAccounts[subIdx].balance += payAmount;
          shopOwner.markModified("subAccounts");
          isReceived = true;
        }
      }
      if (isReceived) {
        shopOwner.markModified("mainAccounts");
        await shopOwner.save();
      }
    }

    const incEscrow =
      currency === "USD"
        ? { "escrowHold.USD": payAmount }
        : { "escrowHold.KHR": payAmount };
    await Merchant.updateOne({ _id: shop._id }, { $inc: incEscrow });

    const trxRef = generateStandardRefId("TAP");
    const trxHash = generateStandardHash();
    const cashierName = cashierAcc ? ` (Cashier: ${cashierAcc})` : "";
    const receiverDisplayName = `${shop.name}${cashierName}`;
    const actualCustomerAcc =
      customerDeductAccObj.accountNumber || cardLinkedAcc;
    const actualMerchantReceiveAcc =
      targetReceiveAccNumber ||
      (shop.accountNumbers ? shop.accountNumbers[currency] : "N/A");

    await Notification.create({
      userId: customer._id,
      username: customer.username,
      title: "ទូទាត់ប្រាក់ (Tap to Pay) 💳",
      message: `អ្នកបានទូទាត់ប្រាក់ ${currency === "USD" ? "$" : "៛"}${payAmount.toLocaleString()} ទៅកាន់ហាង ${shop.name} ពីគណនី (${actualCustomerAcc})។`,
      date: dateStr,
      type: "tap_to_pay",
      isRead: false,
    });

    await Transaction.create({
      userId: customer._id,
      username: customer.username,
      refId: trxRef,
      hash: trxHash,
      date: dateStr,
      type: "Tap to Pay",
      amount: deductUsd > 0 ? -deductUsd : -deductKhr,
      currency: effectiveCurrency,
      senderName: customer.fullName || customer.username,
      senderAcc: actualCustomerAcc,
      receiverName: receiverDisplayName,
      receiverAcc: actualMerchantReceiveAcc,
      cardId: card.id,
      cardNumber: card.number,
      status: "Hold",
      remark: `ទូទាត់កាត NFC ហាង ${shop.name}`,
      trxMethod: "NFC Payment",
      merchantId: shop.merchantId,
    });

    await Transaction.create({
      userId: shopOwner ? shopOwner._id : undefined,
      username: shop.userId,
      refId: trxRef,
      hash: trxHash,
      date: dateStr,
      type: "Received",
      amount: payAmount,
      currency: currency,
      senderName: customer.fullName || customer.username,
      senderAcc: actualCustomerAcc,
      receiverName: receiverDisplayName,
      receiverAcc: actualMerchantReceiveAcc,
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
    }

    res.json({ success: true, message: "ការទូទាត់បានជោគជ័យ!" });
  } catch (error) {
    console.error("Tap to Pay Processing Error:", error);
    res
      .status(500)
      .json({ success: false, message: "Server Error: " + error.message });
  } finally {
    setTimeout(() => activeTaps.delete(tapLockKey), 5000);
  }
};

// =======================================================
// 💳 CHECK CARD BEFORE PAYMENT (Fixed & Secured with Smart UID Normalization)
// =======================================================
exports.checkCardBeforePayment = async (req, res) => {
  const { uid, amount, currency } = req.body;
  try {
    const System = require("../models/System");
    const JointAccount = require("../models/JointAccount");
    const Card = require("../models/Card");

    const rawInputUid = String(uid || "").trim();
    if (!rawInputUid) {
      return res.json({
        success: false,
        message: "មិនមានទិន្នន័យ UID របស់កាតទេ!",
      });
    }

    // 🌟 1. បង្កើតទម្រង់ UID គ្រប់បែបយ៉ាង ដើម្បីធានាថាស្គាល់គ្រប់កាតទាំងអស់
    let cleanUid = rawInputUid.replaceAll(":", "").toUpperCase();

    // បើជា Decimal 10 ខ្ទង់ បម្លែងទៅជា Hex 8 ខ្ទង់
    if (/^\d{10}$/.test(cleanUid)) {
      let hex = parseInt(cleanUid, 10)
        .toString(16)
        .toUpperCase()
        .padStart(8, "0");
      cleanUid =
        hex.substring(6, 8) +
        hex.substring(4, 6) +
        hex.substring(2, 4) +
        hex.substring(0, 2);
    }

    // 🌟 2. ស្វែងរកក្នុង Database តាមគ្រប់លក្ខខណ្ឌ (ទាំង Clean, Raw, Upper, Lower)
    const card = await Card.findOne({
      $or: [
        { uid: cleanUid },
        { uid: rawInputUid },
        { uid: rawInputUid.toUpperCase() },
        { uid: rawInputUid.toLowerCase() },
        { uid: { $regex: new RegExp("^" + cleanUid + "$", "i") } },
      ],
    });

    if (!card)
      return res.json({
        success: false,
        message: "កាតនេះមិនមានក្នុងប្រព័ន្ធ U-Pay ទេ!",
      });

    const cardCat =
      card.cardCategory || (card.isPhysical ? "debit" : "virtual");
    if (cardCat === "virtual" && !card.isPhysical) {
      return res.json({
        success: false,
        message:
          "កាតនិម្មិត (Virtual Card) មិនអាចប្រើប្រាស់ស្កេនទូទាត់តាម POS ទេ។",
      });
    }

    if (card.isLocked)
      return res.json({ success: false, message: "កាតនេះត្រូវបាន Block!" });
    if (card.isOnlinePayEnabled === false)
      return res.json({
        success: false,
        message: "កាតនេះត្រូវបានបិទមុខងារទូទាត់!",
      });

    const customer = await User.findOne({
      $or: [{ _id: card.userId }, { username: card.username }],
    });
    if (!customer)
      return res.json({ success: false, message: "រកមិនឃើញគណនីម្ចាស់កាតទេ!" });
    if (customer.isFrozen)
      return res.json({ success: false, message: "គណនីអតិថិជនត្រូវបានផ្អាក!" });

    let exchangeRate = 4110;
    try {
      const sys = await System.findOne({ settingId: "GLOBAL_SETTINGS" });
      if (sys && sys.fxRates && sys.fxRates.usdToKhrBuy) {
        exchangeRate = parseFloat(sys.fxRates.usdToKhrBuy);
      }
    } catch (e) {}

    let rawLink = String(card.linkedAccount || "USD");
    let cardLinkedAcc = rawLink.includes("_") ? rawLink.split("_")[1] : rawLink;

    let customerDeductAccObj = null;
    let customerAccType = "MAIN";

    if (
      cardLinkedAcc === customer.mainAccounts?.USD?.accountNumber ||
      cardLinkedAcc === "USD"
    ) {
      customerDeductAccObj = customer.mainAccounts.USD;
    } else if (
      cardLinkedAcc === customer.mainAccounts?.KHR?.accountNumber ||
      cardLinkedAcc === "KHR"
    ) {
      customerDeductAccObj = customer.mainAccounts.KHR;
    } else if (customer.subAccounts && customer.subAccounts.length > 0) {
      const subIdx = customer.subAccounts.findIndex(
        (s) => String(s.accountNumber) === String(cardLinkedAcc),
      );
      if (subIdx !== -1) {
        customerDeductAccObj = customer.subAccounts[subIdx];
        customerAccType = "SUB";
      }
    }

    if (!customerDeductAccObj && customer.mainAccounts?.USD) {
      customerDeductAccObj = customer.mainAccounts.USD;
    }

    if (!customerDeductAccObj) {
      return res.json({
        success: false,
        message: "រកគណនីដែលភ្ជាប់ជាមួយកាតនេះមិនឃើញទេ!",
      });
    }

    let cardCurrency = customerDeductAccObj.currency || "USD";
    let availableBalance = customerDeductAccObj.balance || 0;

    if (
      customerAccType === "SUB" &&
      (customerDeductAccObj.accountType === "joint" ||
        customerDeductAccObj.accountType === "joint_member")
    ) {
      const jointData = await JointAccount.findOne({
        accountId: customerDeductAccObj.accountId,
      });
      if (jointData) availableBalance = jointData.balance || 0;
    }

    res.json({
      success: true,
      message: "កាតត្រឹមត្រូវ និងអាចទូទាត់បាន",
      cardType: card.type,
      cardCurrency: cardCurrency,
      balance: availableBalance,
    });
  } catch (err) {
    console.error("Check Card Error:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// =======================================================
// ↩️ ផ្នែកទី ៧៖ មុខងារបង្វិលប្រាក់ (Refund ចូលគណនីដើមរបស់កាត និងដកពីកុងហាង)
// =======================================================
exports.refundTransaction = async (req, res) => {
  const { merchantId, refId, pin } = req.body;

  try {
    const JointAccount = require("../models/JointAccount");

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

    const merchantTrx = trxs.find((t) => t.amount > 0);
    if (!merchantTrx || merchantTrx.status !== "Hold") {
      return res.json({
        success: false,
        message:
          "អាចធ្វើការ Refund បានតែលើប្រតិបត្តិការដែលមានស្ថានភាព Hold ប៉ុណ្ណោះ!",
      });
    }

    const customerTrx = trxs.find((t) => t.amount < 0);
    if (!customerTrx)
      return res.json({ success: false, message: "រកមិនឃើញព័ត៌មានអតិថិជន!" });

    const refundAmount = Math.abs(customerTrx.amount);
    const customerCurrency = customerTrx.currency;
    const merchantCurrency = merchantTrx.currency;
    const customerUsername = customerTrx.username;

    // ១. ដកលុយចេញពី Escrow របស់ហាង និងដកពីគណនីដែលហាងបានទទួលប្រាក់ (merchantTrx.receiverAcc)
    const decEscrow =
      merchantCurrency === "USD"
        ? { "escrowHold.USD": -merchantTrx.amount }
        : { "escrowHold.KHR": -merchantTrx.amount };
    await Merchant.updateOne({ _id: shop._id }, { $inc: decEscrow });

    const shopReceiveAcc =
      merchantTrx.receiverAcc ||
      (shop.linkedAccounts ? shop.linkedAccounts[merchantCurrency] : null);
    if (shopReceiveAcc) {
      if (owner.mainAccounts?.USD?.accountNumber === shopReceiveAcc) {
        owner.mainAccounts.USD.balance -= merchantTrx.amount;
        owner.markModified("mainAccounts");
      } else if (owner.mainAccounts?.KHR?.accountNumber === shopReceiveAcc) {
        owner.mainAccounts.KHR.balance -= merchantTrx.amount;
        owner.markModified("mainAccounts");
      } else if (owner.subAccounts && owner.subAccounts.length > 0) {
        const sIdx = owner.subAccounts.findIndex(
          (s) => s.accountNumber === shopReceiveAcc,
        );
        if (sIdx !== -1) {
          const sub = owner.subAccounts[sIdx];
          if (
            sub.accountType === "joint" ||
            sub.accountType === "joint_member"
          ) {
            const jDoc = await JointAccount.findOne({
              accountId: sub.accountId,
            });
            if (jDoc) {
              jDoc.balance -= merchantTrx.amount;
              await jDoc.save();
              owner.subAccounts[sIdx].balance = jDoc.balance;
            }
          } else {
            owner.subAccounts[sIdx].balance -= merchantTrx.amount;
          }
          owner.markModified("subAccounts");
        }
      }
      await owner.save();
    }

    // ២. បង្វិលលុយចូលគណនីដើមរបស់អតិថិជនដែលបានភ្ជាប់ជាមួយកាត (customerTrx.senderAcc)
    const customerObj = await User.findOne({ username: customerUsername });
    if (customerObj) {
      const targetRefundAcc = customerTrx.senderAcc;
      let refundedToSpecific = false;

      if (targetRefundAcc && targetRefundAcc !== "N/A") {
        if (customerObj.mainAccounts?.USD?.accountNumber === targetRefundAcc) {
          customerObj.mainAccounts.USD.balance += refundAmount;
          refundedToSpecific = true;
        } else if (
          customerObj.mainAccounts?.KHR?.accountNumber === targetRefundAcc
        ) {
          customerObj.mainAccounts.KHR.balance += refundAmount;
          refundedToSpecific = true;
        } else if (
          customerObj.subAccounts &&
          customerObj.subAccounts.length > 0
        ) {
          const subIdx = customerObj.subAccounts.findIndex(
            (s) => s.accountNumber === targetRefundAcc,
          );
          if (subIdx !== -1) {
            const subAcc = customerObj.subAccounts[subIdx];
            if (
              subAcc.accountType === "joint" ||
              subAcc.accountType === "joint_member"
            ) {
              const jointDoc = await JointAccount.findOne({
                accountId: subAcc.accountId,
              });
              if (jointDoc) {
                jointDoc.balance += refundAmount;
                await jointDoc.save();
                customerObj.subAccounts[subIdx].balance = jointDoc.balance;
                refundedToSpecific = true;
              }
            } else {
              customerObj.subAccounts[subIdx].balance += refundAmount;
              refundedToSpecific = true;
            }
            customerObj.markModified("subAccounts");
          }
        }
      }

      // Fallback បើរកកុងដើមមិនឃើញ ទើបដាក់ចូល Main Account
      if (!refundedToSpecific) {
        if (customerCurrency === "USD") {
          if (customerObj.mainAccounts?.USD)
            customerObj.mainAccounts.USD.balance += refundAmount;
        } else {
          if (customerObj.mainAccounts?.KHR)
            customerObj.mainAccounts.KHR.balance += refundAmount;
        }
      }

      customerObj.markModified("mainAccounts");
      await customerObj.save();

      const dateStr = getKhmerDate();

      await Notification.create({
        userId: customerObj._id,
        username: customerObj.username,
        title: "ប្រាក់ត្រូវបានបង្វិលត្រឡប់ ↩️",
        message: `ហាង ${shop.name} បានបង្វិលប្រាក់ ${customerCurrency === "USD" ? "$" : "៛"}${refundAmount.toLocaleString()} ចូលគណនី (${targetRefundAcc}) របស់អ្នកវិញហើយ។`,
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
        senderAcc: shopReceiveAcc || "N/A",
        receiverName: customerTrx.senderName,
        receiverAcc: targetRefundAcc, // 🌟 បង្ហាញវិក្កយបត្រ Refund ចំគណនីដែលបានភ្ជាប់កាត
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
        senderAcc: shopReceiveAcc || "N/A",
        receiverName: customerTrx.senderName,
        receiverAcc: targetRefundAcc,
        status: "Success",
        remark: `បានធ្វើការបង្វិលប្រាក់ទៅអតិថិជន (Ref: ${refId})`,
        trxMethod: "Refund",
      });

      if (typeof bot !== "undefined" && bot && bot.sendMerchantAlert) {
        const refundMsg = `🔄 <b>ប្រាក់ត្រូវបានបង្វិល (Refunded)</b>\n\nហាងរបស់អ្នកបានបង្វិលប្រាក់ចំនួន <b>${merchantCurrency === "USD" ? "$" : "៛"}${Math.abs(merchantTrx.amount).toLocaleString()}</b> ទៅកាន់អតិថិជន <b>${customerTrx.senderName}</b> វិញជោគជ័យ។\nលេខយោង៖ #${newRefId}`;
        bot.sendMerchantAlert(shop._id, refundMsg).catch(() => {});
      }

      if (global.io) {
        global.io.to(shop.userId).emit("transactionUpdated");
        global.io.to(customerUsername).emit("transactionUpdated");
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

// =======================================================
// 🔊 ផ្នែកទី ៩៖ ប្រព័ន្ធបង្កើតសំឡេងនិយាយខ្មែរ & អង់គ្លេស (Cloud TTS Proxy Streamer)
// ធានាថាដើរ ១០០% លើគ្រប់ឧបករណ៍ទាំងអស់ដោយមិនជាប់ CORS Block!
// =======================================================
exports.streamMerchantTTS = async (req, res) => {
  try {
    const text = String(req.query.text || "").trim();
    const lang = String(req.query.lang || "km").trim();
    if (!text) return res.status(400).send("Missing text");

    const tl = lang === "en" ? "en" : "km";
    const ttsUrl = `https://translate.googleapis.com/translate_tts?client=tw-ob&ie=UTF-8&tl=${tl}&q=${encodeURIComponent(text)}`;

    const response = await fetch(ttsUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      },
    });

    if (!response.ok) {
      return res.status(502).send("TTS fetch failed");
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(buffer);
  } catch (err) {
    console.error("TTS Stream Error:", err.message);
    res.status(500).send("TTS Error");
  }
};
