const Merchant = require("../models/Merchant");
const crypto = require("crypto");
const User = require("../models/User");
const Transaction = require("../models/Transaction");

// ========================================================
// 🛠️ Function ជំនួយ (Helpers)
// ========================================================
const generateRandomNumber = (length) => {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += Math.floor(Math.random() * 10).toString();
  }
  return result;
};

// ========================================================
// 🏪 Merchant End-User APIs (សម្រាប់អតិថិជនជាម្ចាស់ហាង)
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

    // 🔥 បង្កើតលេខគណនី QR របស់ហាង ដោយផ្អែកលើគណនីដែលគេភ្ជាប់
    let accountNumbers = { USD: null, KHR: null };
    let linkedAccounts = { USD: null, KHR: null };

    if (linkedAccUSD) {
      accountNumbers.USD = "888" + generateRandomNumber(9);
      linkedAccounts.USD = linkedAccUSD; // រក្សាទុកកុងពិតប្រាកដដែលម្ចាស់ហាងចង់បាន
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

    // អនុញ្ញាតអោយលុបបានតែហាងជារបស់ខ្លួនឯងប៉ុណ្ណោះ
    const merchant = await Merchant.findOneAndDelete({
      _id: merchantId,
      userId: userId,
    });
    if (!merchant)
      return res
        .status(404)
        .json({ success: false, message: "Merchant not found" });

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

    // ១. ចាប់យកតាម ID ហាងតែមួយគត់ដែលយើងបានភ្ជាប់ពេលវេរលុយ
    let searchConditions = [{ merchantId: merchant.merchantId }];

    // ២. ទុកលក្ខខណ្ឌចាស់ ដើម្បីកុំអោយបាត់ប្រវត្តិហាងចាស់ៗ
    if (merchant.accountNumbers && merchant.accountNumbers.USD)
      searchConditions.push({ receiverAcc: merchant.accountNumbers.USD });
    if (merchant.accountNumbers && merchant.accountNumbers.KHR)
      searchConditions.push({ receiverAcc: merchant.accountNumbers.KHR });

    // 🔥 ថែមលក្ខខណ្ឌអោយទាញយកប្រវត្តិ ដែលគេបាញ់ចូល Virtual Account របស់កូនចៅ
    if (merchant.cashiers && merchant.cashiers.length > 0) {
      merchant.cashiers.forEach((c) => {
        if (c.virtualAccounts && c.virtualAccounts.USD)
          searchConditions.push({ receiverAcc: c.virtualAccounts.USD });
        if (c.virtualAccounts && c.virtualAccounts.KHR)
          searchConditions.push({ receiverAcc: c.virtualAccounts.KHR });
        if (c.virtualAccount)
          // សម្រាប់ទិន្នន័យចាស់កុំអោយគាំង
          searchConditions.push({ receiverAcc: c.virtualAccount });
      });
    }

    let transactions = await Transaction.find({
      $or: searchConditions,
      amount: { $gt: 0 },
    }).sort({ _id: -1 });

    const currentUTC = new Date();
    // បំប្លែងម៉ោងទៅជាម៉ោងស្រុកខ្មែរ (UTC+7)
    const nowKhmerTime = new Date(currentUTC.getTime() + 7 * 60 * 60 * 1000);

    // តម្រង (Filter) តាមថ្ងៃ, សប្តាហ៍, និងខែ
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
// 👑 Admin Business Management APIs (សម្រាប់តែ Admin ប៉ុណ្ណោះ)
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
    const { id, name, merchantId, category } = req.body;

    // ឆែកមើលក្រែងលោមានហាងផ្សេងកំពុងប្រើ ID នេះ
    const existing = await Merchant.findOne({
      merchantId: merchantId,
      _id: { $ne: id },
    });
    if (existing)
      return res.json({
        success: false,
        message: "Merchant ID នេះមានអ្នកប្រើហើយ!",
      });

    await Merchant.findByIdAndUpdate(id, { name, merchantId, category });
    res.json({ success: true, message: "កែប្រែជោគជ័យ" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========================================================
// 🤖 Telegram Bot Alert APIs (សម្រាប់ Merchant)
// ========================================================

// Object សម្រាប់ផ្ទុកកូដ ៤ ខ្ទង់បណ្តោះអាសន្ន (ទុកក្នុង Memory)
const pendingMerchantTeleCodes = {};
// Export វាចេញ ដើម្បីអោយ File Bot អាចឆែកមើលបាន
exports.pendingMerchantTeleCodes = pendingMerchantTeleCodes;

// ៧. បង្កើតលេខកូដ ៤ ខ្ទង់សម្រាប់ភ្ជាប់ Telegram
exports.generateTelegramCode = async (req, res) => {
  try {
    const { merchantId } = req.body;
    const userId = req.user.username;

    // ផ្ទៀងផ្ទាត់ថាហាងនេះពិតជារបស់គាត់មែន
    const merchant = await Merchant.findOne({
      _id: merchantId,
      userId: userId,
    });
    if (!merchant) {
      return res
        .status(404)
        .json({ success: false, message: "រកមិនឃើញហាងរបស់អ្នកទេ" });
    }

    // បង្កើតកូដ ៤ ខ្ទង់ (ពី 1000 ដល់ 9999)
    const code = Math.floor(1000 + Math.random() * 9000).toString();

    // រក្សាទុកកូដនេះ ដោយភ្ជាប់ជាមួយ ID ហាង (កូដមានសុពលភាព ៥ នាទី)
    pendingMerchantTeleCodes[code] = {
      merchantId: merchant._id.toString(),
      expiresAt: Date.now() + 5 * 60 * 1000,
    };

    // (ស្រេចចិត្ត) លុបកូដចាស់ៗដែលហួសម៉ោងចោល ដើម្បីកុំអោយចង្អៀត Memory
    for (let key in pendingMerchantTeleCodes) {
      if (pendingMerchantTeleCodes[key].expiresAt < Date.now()) {
        delete pendingMerchantTeleCodes[key];
      }
    }

    res.status(200).json({ success: true, code: code });
  } catch (error) {
    console.error("GENERATE TELE CODE ERROR:", error);
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

    if (!merchant) {
      return res
        .status(404)
        .json({ success: false, message: "រកមិនឃើញហាងរបស់អ្នកទេ" });
    }

    // 🔥 ថែមថ្មី៖ បាញ់សារជូនដំណឹងចូល Telegram មុនពេលផ្តាច់
    if (merchant.telegramChatId) {
      try {
        const unlinkMsg = `⚠️ <b>ការផ្តាច់គណនី Telegram (Unlinked)</b>\n\n🏪 ហាង៖ <b>${merchant.name}</b>\n\nគណនី Telegram នេះត្រូវបានផ្តាច់ចេញពីប្រព័ន្ធ U-Pay ហាងរបស់អ្នកជោគជ័យ។ ចាប់ពីពេលនេះតទៅ នឹងមិនមានសារជូនដំណឹងលុយចូលទីនេះទៀតទេ។`;

        // ហៅ bot មកប្រើ
        await bot.sendMessage(merchant.telegramChatId, unlinkMsg, {
          parse_mode: "HTML",
        });
      } catch (teleErr) {
        console.error(
          "Failed to send telegram merchant unlink alert:",
          teleErr,
        );
      }
    }

    // ធ្វើការ Update លុប ChatID ចោល
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

    // ទាញយកលេខគណនី USD របស់ Merchant
    const receiveAccount = merchant.accountNumbers.USD;

    const deepLink = `https://u-pay-bank.fly.dev/index.html?acc=${receiveAccount}&o=${order_id}&a=${amount}`;

    res.status(200).json({
      code: "SUCCESS",
      message: "ជោគជ័យ",
      data: {
        qr_code_data: deepLink,
        deeplink: deepLink,
      },
    });
  } catch (error) {
    console.error("Error generating Merchant QR:", error);
    res.status(500).json({
      code: "FAIL",
      message: "បញ្ហាបច្ចេកទេសក្នុងប្រព័ន្ធធនាគារកណ្តាល",
    });
  }
};

// ========================================================
// 👨‍💼 Cashier Management APIs (សម្រាប់អ្នកគិតលុយ)
// ========================================================

// ៩. ស្វែងរកគណនី U-Pay របស់កូនចៅ ដើម្បីបន្ថែមជាអ្នកគិតលុយ
exports.searchCashierAccount = async (req, res) => {
  try {
    const { accountNumber } = req.params;

    // ស្វែងរកគណនី
    const user = await User.findOne({
      $or: [
        { accountNumber: accountNumber },
        { accountNumberKHR: accountNumber },
        { "subAccounts.accountNumber": accountNumber },
      ],
    });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "រកមិនឃើញគណនីកូនចៅនេះទេ!" });
    }

    // ត្រឡប់ទិន្នន័យចាំបាច់
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
    if (!merchant) {
      return res
        .status(404)
        .json({ success: false, message: "រកមិនឃើញហាងរបស់អ្នកទេ" });
    }

    // ឆែកក្រែងលោមានកូនចៅនេះហើយ
    const existingCashier = merchant.cashiers.find(
      (c) => c.accountNumber === cashierAccountNumber,
    );
    if (existingCashier) {
      return res
        .status(400)
        .json({ success: false, message: "កូនចៅម្នាក់នេះមានក្នុងហាងរួចហើយ!" });
    }

    // 🔥 បង្កើតលេខ Virtual Account អោយ Cashier ទាំង USD ទាំង KHR
    let virtualAccounts = { USD: null, KHR: null };
    let seq = merchant.cashiers.length + 1;

    // បង្កើត Virtual USD បើមានកុង USD
    if (merchant.accountNumbers && merchant.accountNumbers.USD) {
      let baseAccUSD = merchant.accountNumbers.USD;
      let vAccUSD =
        baseAccUSD.substring(0, baseAccUSD.length - 2) +
        seq.toString().padStart(2, "0");
      // ការពារកុំអោយលេខជាន់គ្នា
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

    // បង្កើត Virtual KHR បើមានកុង KHR
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

    // បន្ថែមចូលហាង
    merchant.cashiers.push({
      accountNumber: cashierAccountNumber,
      virtualAccounts: virtualAccounts,
      virtualAccount: virtualAccounts.USD || virtualAccounts.KHR, // Fallback
      originalName: cashierOriginalName,
      displayName: cashierDisplayName,
      status: "Active",
    });

    await merchant.save();

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
    if (!merchant) {
      return res
        .status(404)
        .json({ success: false, message: "រកមិនឃើញហាងរបស់អ្នកទេ" });
    }

    // ច្រោះយកតែកូនចៅដែលមិនត្រូវនឹង ID ដែលចង់លុប
    merchant.cashiers = merchant.cashiers.filter(
      (c) => c._id.toString() !== cashierId,
    );

    await merchant.save();

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
