const Merchant = require("../models/Merchant");
const crypto = require("crypto");
const User = require("../models/User");
const Transaction = require("../models/Transaction");

// ========================================================
// Function ជំនួយ (Helpers)
// ========================================================
const generateRandomNumber = (length) => {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += Math.floor(Math.random() * 10).toString();
  }
  return result;
};

// ========================================================
// Merchant End-User APIs (សម្រាប់ម្ចាស់ហាង)
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

    // ត្រូវមានយ៉ាងហោចណាស់គណនីមួយដែលបានភ្ជាប់
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
      linkedAccounts: linkedAccounts, // គណនីគោលដែលភ្ជាប់
      accountNumbers: accountNumbers, // លេខកុង QR របស់ហាង
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
    const merchants = await Merchant.find({ userId: username }).select(
      "-apiSecret",
    );
    res.status(200).json({ success: true, merchants });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ៣. លុបហាង (Delete Merchant)
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

    res
      .status(200)
      .json({ success: true, message: "Merchant deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ៤. កែប្រែឈ្មោះហាង (Update Merchant)
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

    // 🔥 កែត្រង់នេះ៖ លុបការស្វែងរកតាម { receiverName: merchant.name } ចេញ!
    let searchConditions = [
      { merchantId: merchant.merchantId },
      { receiverName: merchant.name, trxMethod: "Merchant Payment" }, // 🔥 ចាប់បានទាំង Transaction ថ្មីៗដែលរត់ចូលកុងរង
      // ទុកលក្ខខណ្ឌចាស់ ការពារកុំឱ្យបាត់ប្រវត្តិ Transaction ចាស់ៗ
      { receiverAcc: merchant.accountNumbers.USD },
      { receiverAcc: merchant.accountNumbers.KHR },
    ];

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

// ៦. ទាញយកចំណូលហាង (Revenue)
exports.getMerchantRevenue = async (req, res) => {
  try {
    const { merchantId } = req.params;
    const merchant = await Merchant.findById(merchantId);
    if (!merchant)
      return res
        .status(404)
        .json({ success: false, message: "Shop not found" });

    // 🔥 ប្រើប្រាស់ merchant.collected តែម្តង លឿន និងមិនជាន់ជាមួយទិន្នន័យចាស់ៗទេ
    res.status(200).json({ success: true, revenue: merchant.collected });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========================================================
// Admin Business Management APIs
// ========================================================
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

exports.adminDeleteMerchant = async (req, res) => {
  try {
    await Merchant.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Merchant deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.adminEditMerchant = async (req, res) => {
  try {
    const { id, name, merchantId, category } = req.body;

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
