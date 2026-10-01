// services/webhookService.js

/**
 * ============================================================================
 * 🌐 WEBHOOK SERVICE (B2B NOTIFICATION)
 * ============================================================================
 * តួនាទី (Role): ឯកសារនេះទទួលបន្ទុកក្នុងការបាញ់សារ (Webhook) ទៅកាន់ប្រព័ន្ធដៃគូ
 * (ឧ. U-Mall) ដោយស្វ័យប្រវត្តិ នៅពេលដែលប្រាក់ត្រូវបានព្រលែង (Release Funds)
 * ចូលទៅគណនីអ្នកលក់ជោគជ័យ។ វាមានភ្ជាប់មកជាមួយនូវ Digital Signature ដើម្បីសុវត្ថិភាព។
 * ============================================================================
 */

const axios = require("axios");
const crypto = require("crypto");

/**
 * មុខងារផ្ញើ Webhook ទៅកាន់ Merchant
 * @param {Object} merchant - ទិន្នន័យរបស់ក្រុមហ៊ុន (Merchant)
 * @param {Object} transaction - ទិន្នន័យប្រតិបត្តិការ (Escrow Transaction)
 * @param {String} receiptUrl - តំណភ្ជាប់ (URL) សម្រាប់ទាញយកវិក្កយបត្រ PDF
 */
const sendWebhookNotification = async (merchant, transaction, receiptUrl) => {
  try {
    // ------------------------------------------------------------------------
    // ១. ពិនិត្យមើល Webhook URL របស់ Merchant
    // ------------------------------------------------------------------------
    const webhookUrl = merchant.webhookUrl;

    if (!webhookUrl) {
      console.log(
        `⚠️ [Webhook] Merchant ${merchant.name} មិនបានកំណត់ Webhook URL ទេ (Skip Webhook).`,
      );
      return;
    }

    // ------------------------------------------------------------------------
    // ២. រៀបចំទិន្នន័យ (Payload) ដែលត្រូវផ្ញើទៅប្រព័ន្ធដៃគូ (U-Mall)
    // ------------------------------------------------------------------------
    const payload = {
      event: "payout.completed",
      transactionId: transaction._id,
      referenceId: transaction.referenceId, // លេខកូដយោងដើមរបស់ U-Mall
      amount: transaction.amount,
      currency: transaction.currency,
      status: "COMPLETED",
      receiptUrl: receiptUrl, // ភ្ជាប់ Link PDF ដើម្បីឱ្យ U-Mall ទាញយកវិក្កយបត្រ
      timestamp: Date.now(),
    };

    // ------------------------------------------------------------------------
    // ៣. បង្កើត Digital Signature (HMAC-SHA256) ដើម្បីសុវត្ថិភាព
    // ------------------------------------------------------------------------
    // U-Mall នឹងយក apiSecret របស់គាត់មកផ្ទៀងផ្ទាត់ហត្ថលេខានេះ ដើម្បីប្រាកដថាចេញពី U-Pay ពិតមែន
    const payloadString = JSON.stringify(payload);
    const signature = crypto
      .createHmac("sha256", merchant.apiSecret)
      .update(payloadString)
      .digest("hex");

    // ------------------------------------------------------------------------
    // ៤. បាញ់ Request (POST) ទៅកាន់ U-Mall
    // ------------------------------------------------------------------------
    const response = await axios.post(webhookUrl, payload, {
      headers: {
        "Content-Type": "application/json",
        "x-upay-signature": signature, // Header សម្រាប់ U-Mall ផ្ទៀងផ្ទាត់
      },
      timeout: 5000, // កំណត់ត្រឹម ៥ វិនាទី បើ U-Mall អត់ឆ្លើយតប ចាត់ទុកថា Time Out
    });

    console.log(
      `✅ [Webhook] ផ្ញើជោគជ័យទៅកាន់ ${webhookUrl} - Status: ${response.status}`,
    );
  } catch (error) {
    // ------------------------------------------------------------------------
    // ៥. ការគ្រប់គ្រងកំហុស (Error Handling លម្អិត)
    // ------------------------------------------------------------------------
    if (error.response) {
      // U-Mall ឆ្លើយតបមកវិញ តែជួបបញ្ហា (ឧទាហរណ៍: 404 អត់មាន Link ឬ 500 Error)
      console.error(
        `❌ [Webhook Error] ដៃគូឆ្លើយតបត្រឡប់មកវិញជាមួយកំហុស Status: ${error.response.status}`,
      );
    } else if (error.request) {
      // បាញ់ទៅហើយ តែ U-Mall អត់ឆ្លើយតប (Time Out ឬ Server គេដាច់)
      console.error(
        `❌ [Webhook Error] គ្មានការឆ្លើយតបពីប្រព័ន្ធដៃគូ (Timeout/Network Error) - ${error.message}`,
      );
    } else {
      // បញ្ហាក្នុងការរៀបចំកូដ (កម្រកើតមាន)
      console.error(`❌ [Webhook Error] បញ្ហាផ្ទៃក្នុង: ${error.message}`);
    }

    // ចំណាំ៖ នៅទីនេះយើងអាចរៀបចំប្រព័ន្ធ Retry (ផ្ញើឡើងវិញ ៣ ទៅ ៥ដង ជាស្វ័យប្រវត្តិ) នាពេលអនាគត
  }
};

module.exports = { sendWebhookNotification };
