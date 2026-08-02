// middlewares/b2bAuthMiddleware.js
const crypto = require("crypto");
const Merchant = require("../models/Merchant");

const verifyB2BSignature = async (req, res, next) => {
  try {
    // ១. ទាញយក API Key, Signature និង Timestamp ពី Header ដែល U-Mall បោះមក
    const apiKey = req.headers["x-api-key"];
    const signature = req.headers["x-signature"];
    const timestamp = req.headers["x-timestamp"];

    // បើគ្មានទិន្នន័យទាំងនេះទេ បដិសេធភ្លាមៗ
    if (!apiKey || !signature || !timestamp) {
      return res.status(401).json({
        success: false,
        message:
          "បាត់បង់ព័ត៌មានផ្ទៀងផ្ទាត់ (Missing API Key, Signature, or Timestamp)",
      });
    }

    // ២. ការពារការវាយប្រហារបែប Replay Attack (ឧ. ហាមប្រើ Request ចាស់លើសពី ៥ នាទី)
    const currentTime = Date.now();
    const requestTime = parseInt(timestamp, 10);
    const timeDifference = currentTime - requestTime;

    if (timeDifference > 5 * 60 * 1000) {
      // 5 នាទី
      return res.status(401).json({
        success: false,
        message: "សំណើនេះហួសពេលកំណត់ហើយ (Request Expired)",
      });
    }

    // ៣. ស្វែងរកក្រុមហ៊ុន (Merchant) តាមរយៈ API Key ក្នុង Database
    const merchant = await Merchant.findOne({ apiKey, status: "Active" });
    if (!merchant) {
      return res.status(401).json({
        success: false,
        message:
          "រកមិនឃើញគណនីក្រុមហ៊ុន ឬគណនីត្រូវបានផ្អាក (Invalid or Inactive Merchant)",
      });
    }

    // ៤. បង្កើត Signature សាកល្បងដោយខ្លួនឯង ដើម្បីផ្ទៀងផ្ទាត់ជាមួយ Signature ដែល U-Mall បោះមក
    // រូបមន្ត: HMAC-SHA256 ( Body + Timestamp ) ដោយប្រើ apiSecret របស់ Merchant
    const payload = JSON.stringify(req.body) + timestamp;
    const expectedSignature = crypto
      .createHmac("sha256", merchant.apiSecret)
      .update(payload)
      .digest("hex");

    // ៥. ផ្ទៀងផ្ទាត់ថាតើវាដូចគ្នាដែរឬទេ?
    if (signature !== expectedSignature) {
      return res.status(401).json({
        success: false,
        message: "ហត្ថលេខាមិនត្រឹមត្រូវ (Invalid Signature) 🛑",
      });
    }

    // ៦. បើជោគជ័យ ភ្ជាប់ព័ត៌មាន Merchant ទៅកាន់ Request ហើយឱ្យឆ្លងកាត់
    req.merchant = merchant;
    next();
  } catch (error) {
    console.error("B2B Auth Error:", error);
    return res.status(500).json({
      success: false,
      message: "មានបញ្ហាក្នុងការផ្ទៀងផ្ទាត់ប្រព័ន្ធ (Internal Server Error)",
    });
  }
};

module.exports = { verifyB2BSignature };
