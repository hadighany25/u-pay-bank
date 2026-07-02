const Merchant = require("../models/Merchant");
const crypto = require("crypto");

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
    const { name, city, linkedAccount } = req.body;
    // ត្រូវប្រាកដថាទាញបាន userId ត្រឹមត្រូវ
    const userId = req.user.id || req.user._id;

    const merchantId = "500" + generateRandomNumber(12);
    const accountNumberUSD = "888" + generateRandomNumber(9);
    const accountNumberKHR = "999" + generateRandomNumber(9); // ឧទាហរណ៍ ផ្តើមដោយ 999 សម្រាប់រៀល
    const apiKey = "upay_live_" + crypto.randomBytes(16).toString("hex");
    const apiSecret = crypto.randomBytes(32).toString("hex");

    // ត្រូវតែប្រាកដថាដាក់ឈ្មោះនេះ (មាន s នៅខាងក្រោយ)
    const newMerchant = new Merchant({
      userId,
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
    const userId = req.user.id || req.user._id;

    // ទាញទិន្នន័យ (យើងមិនបង្ហាញ apiSecret ទេពេលទាញធម្មតា ដើម្បីសុវត្ថិភាព)
    const merchants = await Merchant.find({ userId }).select("-apiSecret");

    res.status(200).json({ success: true, merchants });
  } catch (error) {
    console.error("DEBUG ERROR (GET):", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ៣. មុខងារលុបហាង (Delete Merchant)
exports.deleteMerchant = async (req, res) => {
  try {
    const { merchantId } = req.params;
    const userId = req.user.id || req.user._id;

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
