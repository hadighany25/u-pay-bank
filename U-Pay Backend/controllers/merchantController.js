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
    console.log("Request Body:", req.body); // មើលទិន្នន័យមកពី Front
    console.log("User ID:", req.user.id); // មើលថា User មានសិទ្ធិអត់
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

      res.status(201).json({
        success: true,
        message: "Merchant created successfully",
        merchant: {
          id: newMerchant._id,
          name: newMerchant.name,
          merchantId: newMerchant.merchantId,
          accountNumber: newMerchant.accountNumber,
          balance: newMerchant.balance,
          apiKey: newMerchant.apiKey, // បង្ហាញតែពេលបង្កើតដំបូង
          apiSecret: newMerchant.apiSecret,
        },
      });
    } catch (error) {
      console.error("Error creating merchant:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  } catch (error) {
    console.error("FULL ERROR DETAILS:", error); // នេះនឹងប្រាប់ Error 100%
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
