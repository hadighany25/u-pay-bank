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

module.exports = { freezeFunds };
