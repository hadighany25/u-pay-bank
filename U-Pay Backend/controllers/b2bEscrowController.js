// controllers/b2bEscrowController.js
const Merchant = require("../models/Merchant");
const EscrowTransaction = require("../models/EscrowTransaction");

const freezeFunds = async (req, res) => {
  try {
    const { referenceId, amount, currency = "USD", receiverAccount } = req.body;
    const merchant = req.merchant; // ទិន្នន័យនេះបានមកពី b2bAuthMiddleware ដែលយើងទើបបង្កើត

    // ១. ផ្ទៀងផ្ទាត់ទិន្នន័យចាំបាច់
    if (!referenceId || !amount || !receiverAccount) {
      return res.status(400).json({
        success: false,
        message:
          "សូមបញ្ជាក់ព័ត៌មានឱ្យបានគ្រប់គ្រាន់ (referenceId, amount, receiverAccount)!",
      });
    }

    // ២. ការពារការបាញ់ API ជាន់គ្នា (Duplicate Request)
    const existingTxn = await EscrowTransaction.findOne({
      merchantId: merchant._id,
      referenceId,
    });

    if (existingTxn) {
      return res.status(400).json({
        success: false,
        message:
          "លេខប្រតិបត្តិការ (Reference ID) នេះមានរួចរាល់ហើយ មិនអាចស្នើសុំជាន់គ្នាបានទេ!",
      });
    }

    // ៣. ឆែកមើលសមតុល្យប្រាក់របស់ Merchant (តើមានលុយគ្រប់ដើម្បីបង្កកទេ?)
    if (merchant.collected[currency] < amount) {
      return res.status(400).json({
        success: false,
        message: "សមតុល្យទឹកប្រាក់របស់អ្នកមិនគ្រប់គ្រាន់សម្រាប់ការបង្កកទេ!",
      });
    }

    // ៤. ធ្វើការកាត់ប្រាក់ពី 'collected' យកទៅដាក់ក្នុង 'escrowHold'
    merchant.collected[currency] -= amount;
    merchant.escrowHold[currency] += amount;
    await merchant.save();

    // ៥. កត់ត្រាប្រតិបត្តិការនេះចូលទៅក្នុង Database
    const newTransaction = await EscrowTransaction.create({
      merchantId: merchant._id,
      referenceId,
      currency,
      amount,
      receiverAccount,
      status: "frozen",
    });

    // ៦. ឆ្លើយតបទៅកាន់ U-Mall វិញថាជោគជ័យ
    return res.status(200).json({
      success: true,
      message: "ប្រាក់ត្រូវបានបង្កកដោយជោគជ័យ!",
      data: {
        transactionId: newTransaction._id,
        referenceId: newTransaction.referenceId,
        amountFrozen: newTransaction.amount,
        status: newTransaction.status,
        frozenAt: newTransaction.frozenAt,
      },
    });
  } catch (error) {
    console.error("Freeze Error:", error);
    return res.status(500).json({
      success: false,
      message: "មានបញ្ហាក្នុងការបង្កកប្រាក់ (Internal Server Error)",
    });
  }
};

// controllers/b2bEscrowController.js (បន្តពីលើ)

// មុខងារជំនួយ (Helper Function) សម្រាប់បង្កើត PDF - យើងនឹងសរសេរលម្អិតពេលក្រោយ
// បច្ចុប្បន្នប្រើជាទម្រង់ Mock សិន ដើម្បីឱ្យដំណើរការ API ដើររលូន
const generateOfficialReceiptPDF = async (transactionData, merchantData) => {
  // នៅទីនេះ យើងអាចប្រើ Library ដូចជា 'pdfkit' ឬ 'puppeteer'
  // ដើម្បីគូសវិក្កយបត្រមានត្រា U-Pay រួច Upload ចូល AWS S3 ឬ Google Drive

  const fakePdfUrl = `https://api.upay.com/receipts/UPAY-TXN-${transactionData._id}.pdf`;
  return fakePdfUrl;
};

// 🔥 API: ព្រលែងប្រាក់ និងបញ្ជាក់ការទូទាត់ (Release Funds)
const releaseFunds = async (req, res) => {
  try {
    const { referenceId } = req.body;
    const merchant = req.merchant; // មកពី b2bAuthMiddleware

    if (!referenceId) {
      return res.status(400).json({
        success: false,
        message: "សូមបញ្ជាក់លេខប្រតិបត្តិការ (referenceId)!",
      });
    }

    // ១. ស្វែងរកប្រតិបត្តិការដែលកំពុង "បង្កក (frozen)"
    const transaction = await EscrowTransaction.findOne({
      merchantId: merchant._id,
      referenceId: referenceId,
      status: "frozen",
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "រកមិនឃើញប្រតិបត្តិការនេះទេ ឬក៏ប្រាក់ត្រូវបានទូទាត់រួចហើយ!",
      });
    }

    const amount = transaction.amount;
    const currency = transaction.currency;

    // ២. កាត់ប្រាក់ចេញពីគណនីបង្កក (escrowHold) របស់ក្រុមហ៊ុន
    // (ដោយសារលុយនេះត្រូវបានផ្ទេរចូលគណនីអ្នកលក់ពិតប្រាកដរួចហើយក្នុងប្រព័ន្ធ U-Pay)
    if (merchant.escrowHold[currency] < amount) {
      return res.status(400).json({
        success: false,
        message: "ប្រព័ន្ធមានភាពរអាក់រអួល: សមតុល្យបង្កកមិនគ្រប់គ្រាន់ទេ!",
      });
    }

    merchant.escrowHold[currency] -= amount;
    await merchant.save();

    // ៣. បង្កើតវិក្កយបត្រ PDF ផ្លូវការ (Official Receipt)
    const pdfUrl = await generateOfficialReceiptPDF(transaction, merchant);

    // ៤. ធ្វើបច្ចុប្បន្នភាពប្រតិបត្តិការទៅជា Completed
    transaction.status = "completed";
    transaction.completedAt = Date.now();
    transaction.receiptPdfUrl = pdfUrl;
    await transaction.save();

    // ៥. ឆ្លើយតបជោគជ័យទៅកាន់ U-Mall វិញ
    return res.status(200).json({
      success: true,
      message: "ប្រាក់ត្រូវបានទូទាត់ និងព្រលែងដោយជោគជ័យ!",
      data: {
        transactionId: transaction._id,
        referenceId: transaction.referenceId,
        amountReleased: transaction.amount,
        status: transaction.status,
        completedAt: transaction.completedAt,
        receiptUrl: transaction.receiptPdfUrl, // ជូន Link PDF ទៅ U-Mall វិញ
      },
    });
  } catch (error) {
    console.error("Release Error:", error);
    return res.status(500).json({
      success: false,
      message: "មានបញ្ហាក្នុងការព្រលែងប្រាក់ (Internal Server Error)",
    });
  }
};

// កុំភ្លេច Export វាបញ្ចូលគ្នាជាមួយ freezeFunds ណា
module.exports = { freezeFunds, releaseFunds };
