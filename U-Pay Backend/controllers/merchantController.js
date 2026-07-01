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
    const userId = req.user.id; // ទាញពី authMiddleware

    // បង្កើត Merchant ID ១៥ ខ្ទង់ (ឧ. ផ្តើមដោយ 500 + លេខ ១២ ខ្ទង់)
    const merchantId = "500" + generateRandomNumber(12);

    // បង្កើត លេខគណនី ១២ ខ្ទង់ (ឧ. ផ្តើមដោយ 888 + លេខ ៩ ខ្ទង់)
    const accountNumber = "888" + generateRandomNumber(9);

    // បង្កើត API Key & Secret
    const apiKey = "upay_live_" + crypto.randomBytes(16).toString("hex");
    const apiSecret = crypto.randomBytes(32).toString("hex");

    const newMerchant = new Merchant({
      userId,
      name,
      city,
      linkedAccount,
      merchantId,
      accountNumber,
      apiKey,
      apiSecret,
    });
    await newMerchant.save();

    // ត្រូវប្រាកដថាផ្ញើទៅវិញមានទម្រង់ត្រឹមត្រូវ (កុំឱ្យវា undefined)
    res.status(201).json({
      success: true,
      merchant: {
        id: savedMerchant._id, // ប្រើ _id ពី MongoDB
        merchantId: savedMerchant.merchantId,
        accountNumber: savedMerchant.accountNumber,
        name: savedMerchant.name,
        balance: savedMerchant.balance,
      },
    });
  } catch (error) {
    console.error("DEBUG ERROR:", error); // ដាក់ log នេះដើម្បីដឹងថាវាខុសត្រង់ណា
    res.status(500).json({ success: false, message: error.message });
  }
};

// ២. មុខងារទាញយកហាងទាំងអស់របស់អ្នកប្រើប្រាស់ (Get Merchants)
exports.getMyMerchants = async (req, res) => {
  try {
    const userId = req.user.id;

    // ទាញទិន្នន័យ (យើងមិនបង្ហាញ apiSecret ទេពេលទាញធម្មតា ដើម្បីសុវត្ថិភាព)
    const merchants = await Merchant.find({ userId }).select("-apiSecret");

    res.status(200).json({ success: true, merchants });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ៣. មុខងារលុបហាង (Delete Merchant)
exports.deleteMerchant = async (req, res) => {
  try {
    const { merchantId } = req.params;
    const userId = req.user.id;

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
    res.status(500).json({ success: false, message: "Server error" });
  }
};
