// controllers/b2bEscrowController.js

/**
 * ============================================================================
 * 🤝 B2B ESCROW CONTROLLER (MERCHANT ESCROW SYSTEM)
 * ============================================================================
 * តួនាទី (Role): ឯកសារនេះគ្រប់គ្រងប្រព័ន្ធទូទាត់ប្រាក់ B2B (ដូចជា U-Mall)។
 * វាមានតួនាទីបង្កកប្រាក់ (Freeze) ពេលអតិថិជនកុម្ម៉ង់ទំនិញ និងព្រលែងប្រាក់ (Release)
 * ទៅកាន់គណនីអ្នកលក់ (Seller) ពេលប្រតិបត្តិការត្រូវបានបញ្ជាក់ថាជោគជ័យ។
 * ============================================================================
 */

const Merchant = require("../models/Merchant");
const EscrowTransaction = require("../models/EscrowTransaction");
const Transaction = require("../models/Transaction");
const User = require("../models/User");

const { generateOfficialReceiptPDF } = require("../services/pdfService");
const { sendWebhookNotification } = require("../services/webhookService");

// ========================================================
// 🛠️ ផ្នែកទី ០៖ មុខងារជំនួយ (Helpers) សម្រាប់បង្កើត Hash & Ref ID
// ========================================================
const generateStandardHash = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 10; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const generateStandardRefId = (prefix) => {
  // បង្កើតលេខ ៨ខ្ទង់ចៃដន្យ (ពី 10000000 ដល់ 99999999) សម្រាប់លេខយោង
  const random8Digits = Math.floor(10000000 + Math.random() * 90000000);
  return `${prefix}-${random8Digits}`;
};

// ========================================================
// ❄️ ផ្នែកទី ១៖ API បង្កកប្រាក់ (Freeze Funds)
// ========================================================
const freezeFunds = async (req, res) => {
  try {
    const { referenceId, amount, currency = "USD", receiverAccount } = req.body;
    const merchant = req.merchant;

    // ១. ផ្ទៀងផ្ទាត់ទិន្នន័យចាំបាច់
    if (!referenceId || !amount || !receiverAccount) {
      return res.status(400).json({
        success: false,
        message:
          "សូមបញ្ជាក់ព័ត៌មានឱ្យបានគ្រប់គ្រាន់ (referenceId, amount, receiverAccount)!",
      });
    }

    // ២. ការពារការបាញ់ API ជាន់គ្នា (Duplicate Request Preventer)
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

    // ៣. ឆែកមើលសមតុល្យប្រាក់ចំណូលរបស់ Merchant
    if (merchant.collected[currency] < amount) {
      return res.status(400).json({
        success: false,
        message: "សមតុល្យទឹកប្រាក់របស់អ្នកមិនគ្រប់គ្រាន់សម្រាប់ការបង្កកទេ!",
      });
    }

    // ៤. ធ្វើការកាត់ប្រាក់ពី 'collected' យកទៅដាក់ក្នុង 'escrowHold' ឱ្យសុវត្ថិភាព
    merchant.collected[currency] -= amount;
    merchant.escrowHold[currency] += amount;
    await merchant.save();

    // ៥. កត់ត្រាប្រតិបត្តិការនេះចូលទៅក្នុង Database (Escrow Table)
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
    console.error("❄️ Freeze Error:", error);
    return res.status(500).json({
      success: false,
      message: "មានបញ្ហាក្នុងការបង្កកប្រាក់ (Internal Server Error)",
    });
  }
};

// ========================================================
// 💸 ផ្នែកទី ២៖ API ព្រលែងប្រាក់ និងបញ្ជាក់ការទូទាត់ (Release Funds)
// ========================================================
const releaseFunds = async (req, res) => {
  try {
    const { referenceId } = req.body;
    const merchant = req.merchant;

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

    // ២. ត្រួតពិនិត្យ និងកាត់ប្រាក់ចេញពីគណនីបង្កក (escrowHold)
    if (merchant.escrowHold[currency] < amount) {
      return res.status(400).json({
        success: false,
        message: "ប្រព័ន្ធមានភាពរអាក់រអួល: សមតុល្យបង្កកមិនគ្រប់គ្រាន់ទេ!",
      });
    }

    merchant.escrowHold[currency] -= amount;
    await merchant.save();

    // ៣. បង្កើត Link វិក្កយបត្រ (PDF Slip)
    const pdfUrl = `https://u-pay-bank.fly.dev/api/receipt/${transaction._id}`;

    // ៤. ធ្វើបច្ចុប្បន្នភាពប្រតិបត្តិការទៅជា Completed
    transaction.status = "completed";
    transaction.completedAt = Date.now();
    transaction.receiptPdfUrl = pdfUrl;
    await transaction.save();

    // ========================================================
    // 🔥 ៥. ចាក់បញ្ចូលលុយទៅកាន់អ្នកលក់ (ផ្អែកលើ User.js ថ្មី)
    // ========================================================
    const receiverUser = await User.findOne({
      $or: [
        { "mainAccounts.USD.accountNumber": transaction.receiverAccount },
        { "mainAccounts.KHR.accountNumber": transaction.receiverAccount },
        { "subAccounts.accountNumber": transaction.receiverAccount },
        { accountNumber: transaction.receiverAccount }, // Legacy USD
        { accountNumberKHR: transaction.receiverAccount }, // Legacy KHR
      ],
    });

    if (receiverUser) {
      let accountFound = false;

      // ឆែកមើលថាតើលេខកុងដែលផ្ញើចូល ត្រូវគ្នានឹង Main Account USD ដែរទេ
      if (
        receiverUser.mainAccounts?.USD?.accountNumber ===
        transaction.receiverAccount
      ) {
        receiverUser.mainAccounts.USD.balance += amount;
        accountFound = true;
      }
      // ឆែកមើល Main Account KHR
      else if (
        receiverUser.mainAccounts?.KHR?.accountNumber ===
        transaction.receiverAccount
      ) {
        receiverUser.mainAccounts.KHR.balance += amount;
        accountFound = true;
      }
      // ឆែកមើល Sub Accounts
      else {
        const subAcc = receiverUser.subAccounts?.find(
          (a) => a.accountNumber === transaction.receiverAccount,
        );
        if (subAcc) {
          subAcc.balance += amount;
          accountFound = true;
        }
      }

      // បើលេខកុងមិនត្រូវនឹងទម្រង់ថ្មីទេ សាកល្បងបញ្ចូលតាមទម្រង់ Legacy (ចាស់)
      if (!accountFound) {
        if (currency === "USD") receiverUser.balance += amount;
        else if (currency === "KHR") receiverUser.balanceKHR += amount;
      }

      receiverUser.markModified("mainAccounts");
      receiverUser.markModified("subAccounts");
      await receiverUser.save();
    }

    // ========================================================
    // 📝 ៦. កត់ត្រាប្រវត្តិប្រតិបត្តិការ (Transaction History)
    // ========================================================
    if (Transaction) {
      const owner = await User.findOne({ username: merchant.userId });
      const stdRefId = generateStandardRefId("ESC");
      const stdHash = generateStandardHash();
      const dateStr = new Date().toLocaleString("en-US", {
        timeZone: "Asia/Phnom_Penh",
        hour12: true,
      });

      // ៦.១ កត់ត្រាសម្រាប់ម្ចាស់ហាង (Merchant - លុយចេញ)
      await Transaction.create({
        userId: owner ? owner._id : undefined,
        username: merchant.userId,
        refId: stdRefId,
        hash: stdHash,
        date: dateStr,
        type: "Escrow Payout",
        amount: -parseFloat(amount), // ដាក់សញ្ញាដក (-) ព្រោះជាលុយចេញ
        currency: currency,
        senderName: merchant.name,
        receiverName: receiverUser
          ? receiverUser.fullName || receiverUser.username
          : "Seller Account",
        senderAcc: merchant.accountNumbers
          ? merchant.accountNumbers[currency]
          : "N/A",
        receiverAcc: transaction.receiverAccount,
        trxMethod: "B2B Escrow",
        status: "Success",
        remark: `Payout for Order Ref: ${referenceId}`,
        receiptUrl: pdfUrl,
        merchantId: merchant.merchantId,
      });

      // ៦.២ កត់ត្រាសម្រាប់អ្នកលក់ (Seller - លុយចូល)
      if (receiverUser) {
        await Transaction.create({
          userId: receiverUser._id,
          username: receiverUser.username,
          refId: stdRefId,
          hash: stdHash,
          date: dateStr,
          type: "Escrow Received",
          amount: parseFloat(amount), // បូក (+) ព្រោះជាលុយចូល
          currency: currency,
          senderName: merchant.name,
          receiverName: receiverUser.fullName || receiverUser.username,
          senderAcc: merchant.accountNumbers
            ? merchant.accountNumbers[currency]
            : "N/A",
          receiverAcc: transaction.receiverAccount,
          trxMethod: "B2B Escrow",
          status: "Success",
          remark: `Payment received for Order Ref: ${referenceId}`,
          receiptUrl: pdfUrl,
        });
      }
    }

    // ៧. បាញ់ Webhook ទៅកាន់ U-Mall វិញ (រត់ Background)
    sendWebhookNotification(merchant, transaction, pdfUrl);

    // ៨. ឆ្លើយតបជោគជ័យទៅកាន់ U-Mall វិញ
    return res.status(200).json({
      success: true,
      message: "ប្រាក់ត្រូវបានទូទាត់ និងព្រលែងដោយជោគជ័យ!",
      data: {
        transactionId: transaction._id,
        referenceId: transaction.referenceId,
        amountReleased: transaction.amount,
        status: transaction.status,
        completedAt: transaction.completedAt,
        receiptUrl: transaction.receiptPdfUrl,
      },
    });
  } catch (error) {
    console.error("💸 Release Error:", error);
    return res.status(500).json({
      success: false,
      message: "មានបញ្ហាក្នុងការព្រលែងប្រាក់ (Internal Server Error)",
    });
  }
};

module.exports = { freezeFunds, releaseFunds };
