// middlewares/b2bAuthMiddleware.js

/**
 * ============================================================================
 * 🛡️ B2B AUTHENTICATION MIDDLEWARE
 * ============================================================================
 * តួនាទី: ការពារ API របស់ U-Pay ពីការវាយប្រហារ។
 * ត្រូវប្រាកដថារាល់សំណើ (Request) ដែលបាញ់ចូលមក គឺពិតជាចេញពីដៃគូ (ឧ. U-Mall)
 * ពិតប្រាកដមែន តាមរយៈការផ្ទៀងផ្ទាត់ API Key, Timestamp និង HMAC-SHA256 Signature។
 * ============================================================================
 */

const crypto = require("crypto");
const Merchant = require("../models/Merchant");

const verifyB2BSignature = async (req, res, next) => {
  try {
    // ------------------------------------------------------------------------
    // ១. ទាញយកទិន្នន័យសុវត្ថិភាពពី Headers
    // ------------------------------------------------------------------------
    const apiKey = req.headers["x-api-key"];
    const signature = req.headers["x-signature"];
    const timestamp = req.headers["x-timestamp"];

    // បើគ្មានទិន្នន័យទាំងនេះទេ បដិសេធសំណើភ្លាមៗ (Unauthorized)
    if (!apiKey || !signature || !timestamp) {
      return res.status(401).json({
        success: false,
        message:
          "បាត់បង់ព័ត៌មានផ្ទៀងផ្ទាត់ (Missing API Key, Signature, or Timestamp)",
      });
    }

    // ------------------------------------------------------------------------
    // ២. ការពារការវាយប្រហារបែប Replay Attack (សុពលភាពត្រឹម ៥ នាទី)
    // ------------------------------------------------------------------------
    const currentTime = Date.now();
    const requestTime = parseInt(timestamp, 10);
    const timeDifference = Math.abs(currentTime - requestTime); // ប្រើ Math.abs ដើម្បីការពារម៉ោងខុសគ្នាទាំងសងខាង

    const FIVE_MINUTES = 5 * 60 * 1000;
    if (timeDifference > FIVE_MINUTES) {
      return res.status(401).json({
        success: false,
        message:
          "សំណើនេះហួសពេលកំណត់ហើយ (Request Expired / Replay Attack Prevented)",
      });
    }

    // ------------------------------------------------------------------------
    // ៣. ស្វែងរកក្រុមហ៊ុន (Merchant) ក្នុងប្រព័ន្ធ
    // ------------------------------------------------------------------------
    const merchant = await Merchant.findOne({
      apiKey: apiKey,
      status: "Active",
    });

    if (!merchant) {
      return res.status(401).json({
        success: false,
        message:
          "រកមិនឃើញគណនីក្រុមហ៊ុន ឬគណនីត្រូវបានផ្អាក (Invalid or Inactive Merchant API Key)",
      });
    }

    // ------------------------------------------------------------------------
    // ៤. បង្កើត និងផ្ទៀងផ្ទាត់ហត្ថលេខា (HMAC-SHA256 Verification)
    // ------------------------------------------------------------------------
    // រូបមន្តស្តង់ដារ: HMAC-SHA256 ( JSON.stringify(body) + timestamp, apiSecret )
    const payload = JSON.stringify(req.body) + timestamp;

    // [សម្រាប់អ្នកអភិវឌ្ឍន៍] បង្ហាញ Payload ពិតប្រាកដក្នុង Terminal ងាយស្រួលតាមដាន (អាចលុបចោលពេលដាក់អោយប្រើប្រាស់ពិត)
    console.log("🔍 [B2B Auth] Payload expected by U-Pay:", payload);

    const expectedSignature = crypto
      .createHmac("sha256", merchant.apiSecret)
      .update(payload)
      .digest("hex");

    if (signature !== expectedSignature) {
      return res.status(401).json({
        success: false,
        message: "ហត្ថលេខាមិនត្រឹមត្រូវ (Invalid Signature) 🛑",
      });
    }

    // ------------------------------------------------------------------------
    // ៥. អនុញ្ញាតឱ្យឆ្លងកាត់ និងបញ្ជូនទិន្នន័យ Merchant ទៅកាន់ Controller
    // ------------------------------------------------------------------------
    req.merchant = merchant;
    next();
  } catch (error) {
    console.error("❌ B2B Auth Middleware Error:", error);
    return res.status(500).json({
      success: false,
      message: "មានបញ្ហាក្នុងការផ្ទៀងផ្ទាត់ប្រព័ន្ធ (Internal Server Error)",
    });
  }
};

module.exports = { verifyB2BSignature };
