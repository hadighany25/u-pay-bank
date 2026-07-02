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
    // 🔥 កែទី១៖ ទទួលយក userId ពី Frontend ដែលយើងបានបញ្ជូនមក
    const { name, city, linkedAccount, userId: bodyUserId } = req.body;

    // 🔥 កែទី២៖ ប្រើ username របស់ម្ចាស់ហាងជាអាទិភាព (ដើម្បីងាយស្រួលផ្ទេរលុយ Auto-Sweep)
    const userId =
      req.user.username || bodyUserId || req.user.id || req.user._id;

    const merchantId = "500" + generateRandomNumber(12);
    const accountNumberUSD = "888" + generateRandomNumber(9);
    const accountNumberKHR = "999" + generateRandomNumber(9); // ឧទាហរណ៍ ផ្តើមដោយ 999 សម្រាប់រៀល
    const apiKey = "upay_live_" + crypto.randomBytes(16).toString("hex");
    const apiSecret = crypto.randomBytes(32).toString("hex");

    // ត្រូវតែប្រាកដថាដាក់ឈ្មោះនេះ (មាន s នៅខាងក្រោយ)
    const newMerchant = new Merchant({
      userId, // ឥឡូវនេះវានឹង Save ជា 'dara123' មិនមែនលេខ Timestamp ទេ!
      name,
      city,
      linkedAccount,
      merchantId,
      accountNumbers: {
        // ត្រូវប្រាកដថាប្រើឈ្មោះនេះ
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

    // ត្រឡប់ទិន្នន័យឱ្យចំឈ្មោះដែល Frontend ត្រូវការ (ជាពិសេសគឺ id)
    res.status(201).json({
      success: true,
      merchant: {
        id: savedMerchant._id.toString(), // បម្លែងទៅជា String ឱ្យប្រាកដ
        merchantId: savedMerchant.merchantId,
        accountNumbers: savedMerchant.accountNumbers,
        name: savedMerchant.name,
        balance: savedMerchant.balance,
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
    // 🔥 កែទី៤៖ ពេលលុប ក៏ត្រូវផ្ទៀងផ្ទាត់តាម username ដូចគ្នា
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
    console.error("DEBUG ERROR (DELETE):", error);
    res.status(500).json({ success: false, message: "Server error" });
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
