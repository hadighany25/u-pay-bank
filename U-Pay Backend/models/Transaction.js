// Transaction.js
const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
    // 🌟 បន្ថែម userId ដើម្បីភ្ជាប់ជាមួយគណនីម្ចាស់ដើមពិតប្រាកដ និងធានាសុវត្ថិភាព Data Leakage
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },

    username: { type: String, required: true, index: true },

    // 🔥 ថែម index: true លើ refId និង hash ដើម្បីឱ្យពេល Cashier ស្វែងរកលេខកូដ វាដើរលឿនដូចរន្ទះ (ទោះមានទិន្នន័យ ១លាន ក៏រកឃើញភ្លាមៗ)
    refId: { type: String, index: true },
    hash: { type: String, index: true },

    type: { type: String },
    amount: { type: Number },

    // 🟢 ថែមថ្លៃសេវា (Fee) ព្រោះធនាគារតែងតែកត់ត្រាថ្លៃសេវាដាច់ដោយឡែកពីទឹកប្រាក់ផ្ញើ
    fee: { type: Number, default: 0 },

    currency: { type: String },
    senderName: { type: String },
    senderAcc: { type: String },
    receiverAcc: { type: String }, // ទុកតែមួយនេះបានហើយ កុំអោយជាន់គ្នា
    receiverName: { type: String },
    trxMethod: { type: String },
    merchantId: { type: String, default: null },

    // 🛡️ រក្សាទុក date ជា String ដដែល ដើម្បីការពារកុំអោយ Error ទិន្នន័យចាស់!
    date: { type: String },

    // 🟢 ថែមសមតុល្យនៅសល់ (Running Balance) ធនាគារពិតប្រាកដត្រូវតែមានដឹងថា ក្រោយវេរលុយហើយ គាត់សល់លុយប៉ុន្មាន
    balanceAfter: { type: Number, default: null },

    remark: { type: String },
    status: { type: String },

    // សម្រាប់កាត (Virtual Cards)
    cardId: { type: String },
    cardNumber: { type: String },

    // 🌟 បន្ថែម receiptUrl សម្រាប់ U-Mall B2B Transfer Slip (អ្នកកាត់លុយអាចមើលវិក្កយបត្របាន)
    receiptUrl: { type: String, default: null },
  },
  {
    // 🟢 timestamps: true វានឹងបង្កើត field "createdAt" និង "updatedAt" ជាប្រភេទ ISODate អូតូ!
    // ថ្ងៃក្រោយយើងនឹងប្រើ "createdAt" នេះសម្រាប់តម្រៀប (Sort) និង ស្វែងរកតាមថ្ងៃខែ (Date Range Filter)
    timestamps: true,
  },
);

module.exports = mongoose.model("Transaction", transactionSchema);
