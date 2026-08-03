const axios = require("axios");
const crypto = require("crypto");

const sendWebhookNotification = async (merchant, transaction, receiptUrl) => {
  try {
    // ទីតាំង Webhook URL របស់ U-Mall (ត្រូវមានក្នុង Merchant Model)
    const webhookUrl = merchant.webhookUrl;

    if (!webhookUrl) {
      console.log(
        `[Webhook] Merchant ${merchant.name} មិនបានកំណត់ Webhook URL ទេ.`,
      );
      return;
    }

    // ១. រៀបចំទិន្នន័យ (Payload) ដែលត្រូវផ្ញើទៅ U-Mall
    const payload = {
      event: "payout.completed",
      transactionId: transaction._id,
      referenceId: transaction.referenceId, // លេខកូដយោងរបស់ U-Mall
      amount: transaction.amount,
      currency: transaction.currency,
      status: "COMPLETED",
      receiptUrl: receiptUrl, // ផ្ញើ Link PDF ទៅឱ្យ U-Mall
      timestamp: Date.now(),
    };

    // ២. បង្កើត Digital Signature (HMAC-SHA256) ដើម្បីសុវត្ថិភាព
    const payloadString = JSON.stringify(payload);
    const signature = crypto
      .createHmac("sha256", merchant.apiSecret)
      .update(payloadString)
      .digest("hex");

    // ៣. បាញ់ Request ទៅកាន់ U-Mall
    const response = await axios.post(webhookUrl, payload, {
      headers: {
        "Content-Type": "application/json",
        "x-upay-signature": signature, // U-Mall នឹងយកកូដនេះទៅផ្ទៀងផ្ទាត់
      },
      timeout: 5000, // រង់ចាំតែ 5 វិនាទី
    });

    console.log(
      `[Webhook] ផ្ញើជោគជ័យទៅកាន់ ${webhookUrl} - Status: ${response.status}`,
    );
  } catch (error) {
    console.error(
      `[Webhook Error] បរាជ័យក្នុងការផ្ញើទៅកាន់ U-Mall:`,
      error.message,
    );
    // នៅកន្លែងនេះ បងអាចរៀបចំប្រព័ន្ធ Retry (ផ្ញើសារឡើងវិញ) បើចង់
  }
};

module.exports = { sendWebhookNotification };
