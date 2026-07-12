const Merchant = require("../models/Merchant");
const crypto = require("crypto");
const User = require("../models/User");
// 🔥 ត្រូវ Import Transaction Model ចូល ព្រោះយើងបានផ្តាច់វាចេញពី User
const Transaction = require("../models/Transaction");

// ========================================================
// Function ជំនួយ (Helpers)
// ========================================================
// ជំនួយសម្រាប់បង្កើតលេខ Random តាមចំនួនខ្ទង់ដែលចង់បាន
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
    // ទទួលយកទិន្នន័យពី Frontend
    const {
      name,
      city,
      category,
      linkedAccount,
      userId: bodyUserId,
    } = req.body;

    const userId =
      req.user.username || bodyUserId || req.user.id || req.user._id;

    const merchantId = "500" + generateRandomNumber(12);
    const accountNumberUSD = "888" + generateRandomNumber(9);
    const accountNumberKHR = "999" + generateRandomNumber(9);
    const apiKey = "upay_live_" + crypto.randomBytes(16).toString("hex");
    const apiSecret = crypto.randomBytes(32).toString("hex");

    const newMerchant = new Merchant({
      userId,
      name,
      city,
      category, // Save category ចូល Database
      linkedAccount,
      merchantId,
      accountNumbers: {
        USD: accountNumberUSD,
        KHR: accountNumberKHR,
      },
      apiKey,
      apiSecret,
      collected: {
        USD: 0.0,
        KHR: 0,
      },
    });

    const savedMerchant = await newMerchant.save();

    res.status(201).json({
      success: true,
      merchant: {
        id: savedMerchant._id.toString(),
        merchantId: savedMerchant.merchantId,
        name: savedMerchant.name,
        category: savedMerchant.category, // ត្រឡប់ទៅឱ្យ Frontend វិញ
        accountNumbers: savedMerchant.accountNumbers,
        apiKey: savedMerchant.apiKey,
        apiSecret: savedMerchant.apiSecret,
      },
    });
  } catch (error) {
    console.error("DEBUG ERROR (CREATE):", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ២. មុខងារទាញយកហាងទាំងអស់របស់អ្នកប្រើប្រាស់ (Get Merchants)
exports.getMyMerchants = async (req, res) => {
  try {
    // យក username ពី req.user ដែលបានមកពី Auth Middleware
    const username = req.user.username;
    console.log("Fetching merchants for username:", username);

    // ស្វែងរកហាងតាម userId ដែលយើងបាន Save ជា username
    const merchants = await Merchant.find({ userId: username }).select(
      "-apiSecret",
    );

    console.log("Found merchants:", merchants);

    res.status(200).json({ success: true, merchants });
  } catch (error) {
    console.error("ERROR IN getMyMerchants:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ៣. មុខងារលុបហាង (Delete Merchant)
exports.deleteMerchant = async (req, res) => {
  try {
    const { merchantId } = req.params;
    const userId = req.user.username || req.user.id || req.user._id;

    const merchant = await Merchant.findOneAndDelete({
      _id: merchantId,
      userId: userId,
    });

    if (!merchant) {
      return res
        .status(404)
        .json({ success: false, message: "Merchant not found" });
    }

    res
      .status(200)
      .json({ success: true, message: "Merchant deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ៤. មុខងារកែប្រែឈ្មោះហាង (Update Merchant)
exports.updateMerchant = async (req, res) => {
  try {
    const { name } = req.body;
    const userId = req.user.username || req.user.id || req.user._id;

    const merchant = await Merchant.findOneAndUpdate(
      { _id: req.params.merchantId, userId: userId },
      { name },
      { new: true }, // ត្រឡប់ទិន្នន័យថ្មីបន្ទាប់ពី Update រួច
    );

    if (!merchant) {
      return res
        .status(404)
        .json({ success: false, message: "Merchant not found" });
    }

    res.json({ success: true, merchant });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ៥. មុខងារទាញយកប្រវត្តិប្រតិបត្តិការហាង (Get Transactions)
exports.getMerchantTransactions = async (req, res) => {
  try {
    const { merchantId } = req.params;
    const { filter } = req.query; // ទទួលយក filter: today, week, month, total

    const merchant = await Merchant.findById(merchantId);
    if (!merchant)
      return res
        .status(404)
        .json({ success: false, message: "Shop not found" });

    // 🔥 កែត្រង់នេះ៖ ទាញយក Transactions ទាំងអស់ពី Collection ថ្មីផ្ទាល់តែម្តង
    // ដោយស្វែងរកតាម ឈ្មោះហាង លេខគណនី ឬ Merchant ID
    let transactions = await Transaction.find({
      $or: [
        { receiverName: merchant.name },
        { merchantId: merchant.merchantId },
        { receiverAcc: merchant.accountNumbers.USD },
        { receiverAcc: merchant.accountNumbers.KHR },
      ],
    }).sort({ _id: -1 }); // រៀបចំឱ្យអាថ្មីលោតមកលើគេ

    // ត្រងតាមពេលវេលា (បំប្លែងទៅជាម៉ោងកម្ពុជា UTC+7)
    const currentUTC = new Date();
    const nowKhmerTime = new Date(currentUTC.getTime() + 7 * 60 * 60 * 1000);

    transactions = transactions.filter((t) => {
      const trxUTC = new Date(t.date);
      const trxKhmerTime = new Date(trxUTC.getTime() + 7 * 60 * 60 * 1000);

      if (filter === "today") {
        return (
          trxKhmerTime.toISOString().split("T")[0] ===
          nowKhmerTime.toISOString().split("T")[0]
        );
      }
      if (filter === "week") {
        const lastWeek = new Date(nowKhmerTime);
        lastWeek.setDate(lastWeek.getDate() - 7);
        return trxKhmerTime >= lastWeek;
      }
      if (filter === "month") {
        return (
          trxKhmerTime.getMonth() === nowKhmerTime.getMonth() &&
          trxKhmerTime.getFullYear() === nowKhmerTime.getFullYear()
        );
      }
      return true; // default: total
    });

    res.status(200).json({ success: true, transactions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ៦. មុខងារទាញយកចំណូលហាង (Revenue)
exports.getMerchantRevenue = async (req, res) => {
  try {
    const { merchantId } = req.params;
    const merchant = await Merchant.findById(merchantId);
    if (!merchant)
      return res
        .status(404)
        .json({ success: false, message: "Shop not found" });

    // 🔥 កែត្រង់នេះ៖ គណនាចំណូលឡើងវិញដោយស្វ័យប្រវត្តិពី Transaction Collection
    // ដើម្បីធានាថាទិន្នន័យលុយគឺច្បាស់លាស់ ១០០%
    const transactions = await Transaction.find({
      $or: [
        { receiverName: merchant.name },
        { merchantId: merchant.merchantId },
        { receiverAcc: merchant.accountNumbers.USD },
        { receiverAcc: merchant.accountNumbers.KHR },
      ],
      status: "Success", // បូកតែប្រតិបត្តិការណាដែលជោគជ័យប៉ុណ្ណោះ
    });

    let revenue = 0;

    // បូកលុយបញ្ចូលគ្នា ទៅតាមរូបិយប័ណ្ណដែលហាងជ្រើសរើស (USD ឬ KHR)
    transactions.forEach((t) => {
      if (t.currency === merchant.linkedAccount) {
        revenue += Math.abs(t.amount || 0);
      }
    });

    res.status(200).json({ success: true, revenue });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========================================================
// Admin Merchant/Business Management APIs (សម្រាប់ Admin)
// ========================================================

// ១. មុខងារ Admin ផ្អាកឬបើកដំណើរការហាង (Toggle Freeze)
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

// ២. មុខងារ Admin លុបហាងចោល (Delete Merchant)
exports.adminDeleteMerchant = async (req, res) => {
  try {
    const { id } = req.params;
    await Merchant.findByIdAndDelete(id);
    res.json({ success: true, message: "Merchant deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ៣. មុខងារ Admin កែប្រែព័ត៌មានហាង (Edit Merchant)
exports.adminEditMerchant = async (req, res) => {
  try {
    const { id, name, merchantId, linkedAccount, category } = req.body;

    // ឆែកមើលថា Merchant ID ថ្មីមានជាន់គេទេ (លើកលែងតែម្ចាស់ខ្លួនឯង)
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
      linkedAccount,
      category,
    });
    res.json({ success: true, message: "កែប្រែជោគជ័យ" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
