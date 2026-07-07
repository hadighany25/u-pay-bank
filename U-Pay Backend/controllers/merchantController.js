const Merchant = require("../models/Merchant");
const crypto = require("crypto");
const User = require("../models/User");

// Function ជំនួយសម្រាប់បង្កើតលេខ Random តាមចំនួនខ្ទង់ដែលចង់បាន
const generateRandomNumber = (length) => {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += Math.floor(Math.random() * 10).toString();
  }
  return result;
};

// ១. មុខងារបង្កើតហាងថ្មី (Create Merchant)
exports.createMerchant = async (req, res) => {
  try {
    // 🔥 កែទី១៖ ទទួលយក category ពី Frontend ដែលយើងបានបញ្ជូនមក
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
      category, // 🔥 បន្ថែម: Save category ចូល Database
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
        category: savedMerchant.category, // 🔥 បន្ថែម: ត្រឡប់ទៅឱ្យ Frontend វិញ
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
    console.log("Fetching merchants for username:", username); // បន្ថែម Log នេះដើម្បីមើលក្នុង terminal

    // ស្វែងរកហាងតាម userId ដែលយើងបាន Save ជា username
    const merchants = await Merchant.find({ userId: username }).select(
      "-apiSecret",
    );

    console.log("Found merchants:", merchants); // បន្ថែម Log នេះដើម្បីមើលថាតើវាឃើញហាងដែរឬទេ

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

    // 🔥 បន្ថែមការឆែកក្រែងរកមិនឃើញ
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

// ៤. មុខងារទាញយកចំណូលហាង (Revenue)
exports.getMerchantTransactions = async (req, res) => {
  try {
    const { merchantId } = req.params;
    const { filter } = req.query; // ទទួលយក filter: today, week, month, total

    const merchant = await Merchant.findById(merchantId);
    if (!merchant)
      return res
        .status(404)
        .json({ success: false, message: "Shop not found" });

    // ទាញយក Transactions ទាំងអស់ពីគណនីមេ (ម្ចាស់ហាង)
    const user = await User.findOne({ username: merchant.userId });
    let transactions = user.transactions || [];

    // Filter តាមហាង
    transactions = transactions.filter((t) => t.receiverName === merchant.name);

    // 🔥 កែត្រង់នេះ៖ ត្រងតាមពេលវេលា (បំប្លែងទៅជាម៉ោងកម្ពុជា UTC+7)
    const currentUTC = new Date();
    // បូក ៧ ម៉ោង ដើម្បីឱ្យស្មើម៉ោងនៅស្រុកខ្មែរ
    const nowKhmerTime = new Date(currentUTC.getTime() + 7 * 60 * 60 * 1000);

    transactions = transactions.filter((t) => {
      const trxUTC = new Date(t.date);
      // បូក ៧ ម៉ោងឱ្យប្រតិបត្តិការនីមួយៗ ដើម្បីប្រៀបធៀបគ្នាឱ្យត្រូវ
      const trxKhmerTime = new Date(trxUTC.getTime() + 7 * 60 * 60 * 1000);

      if (filter === "today") {
        // ប្រៀបធៀបតែ ឆ្នាំ-ខែ-ថ្ងៃ (YYYY-MM-DD)
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

// ៥. មុខងារទាញយកចំណូលហាង (Revenue)
exports.getMerchantRevenue = async (req, res) => {
  try {
    const { merchantId } = req.params;
    const merchant = await Merchant.findById(merchantId);
    if (!merchant)
      return res
        .status(404)
        .json({ success: false, message: "Shop not found" });

    // ទាញយកលុយដែលបានពីការលក់ (collected)
    const revenue =
      merchant.linkedAccount === "USD"
        ? merchant.collected?.USD || 0
        : merchant.collected?.KHR || 0;

    res.status(200).json({ success: true, revenue });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========================================================
// admin Merchant/Business Management APIs
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

// ១. មុខងារ Admin លុបហាងចោល
exports.adminDeleteMerchant = async (req, res) => {
  try {
    const { id } = req.params;
    await Merchant.findByIdAndDelete(id);
    res.json({ success: true, message: "Merchant deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ២. មុខងារ Admin កែប្រែព័ត៌មានហាង
exports.adminEditMerchant = async (req, res) => {
  try {
    const { id, name, category } = req.body;
    await Merchant.findByIdAndUpdate(id, { name: name, category: category });
    res.json({ success: true, message: "Merchant updated successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
