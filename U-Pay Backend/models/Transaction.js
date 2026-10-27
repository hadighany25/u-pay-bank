// ============================================================================
// ឯកសារ: models/Transaction.js
// អត្ថន័យ: Schema ស្តង់ដារកម្រិតធនាគារសម្រាប់ប្រតិបត្តិការហិរញ្ញវត្ថុ (Strict _id & accountId Binding)
// ============================================================================

const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
    // ==========================================
    // 👤 ១. អត្តសញ្ញាណម្ចាស់ប្រតិបត្តិការ និងកាបូបលុយគោល (Strict _id & Immutable Wallet ID)
    // ==========================================
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    }, // 🔗 សោរគោលភ្ជាប់ទៅកាន់ User._id ដាច់ខាត (ការពារការជាន់ប្រវត្តិពេលគេទិញលេខកុងចាស់យកទៅប្រើ)
    username: { type: String, index: true }, // Snapshot សម្រាប់មើលក្នុង DB

    // 🏦 លេខសម្គាល់កាបូបលុយខាងក្នុងមិនប្រែប្រួល (ឧ. "MAIN_USD_...", "SUB_...")
    // ទោះបីអតិថិជនប្តូរលេខគណនី (accountNumber) ថ្មី ក៏ប្រវត្តិនៅតែរត់តាមកាបូបដដែល ១០០% ដូច ACLEDA!
    accountId: { type: String, index: true },

    // ==========================================
    // 🔑 ២. លេខយោងវិក្កយបត្រ និងកូដសុវត្ថិភាព (Reference & Hash)
    // ==========================================
    refId: { type: String, index: true },
    hash: { type: String, index: true },

    // ==========================================
    // 💸 ៣. ព័ត៌មានទឹកប្រាក់ និងគូភាគីប្រតិបត្តិការ (Financial & Counterparty Details)
    // ==========================================
    type: { type: String },
    trxMethod: { type: String },
    amount: { type: Number, required: true },
    fee: { type: Number, default: 0 },
    currency: { type: String, enum: ["USD", "KHR"], default: "USD" },
    balanceAfter: { type: Number }, // សមតុល្យនៅសល់ក្រោយប្រតិបត្តិការ (បង្កើតតែពេលមានតម្លៃ)

    senderUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // 🔗 _id អ្នកផ្ញើ (បើមាន)
    senderName: { type: String },
    senderAcc: { type: String, index: true },

    receiverUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // 🔗 _id អ្នកទទួល (បើមាន)
    receiverName: { type: String },
    receiverAcc: { type: String, index: true },

    // ==========================================
    // 📊 ៤. ស្ថានភាព កាលបរិច្ឆេទ និងចំណាំ (Status & Timestamps)
    // ==========================================
    date: { type: String },
    remark: { type: String },
    status: { type: String, default: "Success", index: true },

    // ==========================================
    // 💳 ៥. ទិន្នន័យបន្ថែមសម្រាប់ហាងទំនិញ កាត និង B2B (បង្កើតក្នុង DB តែពេលប្រើប៉ុណ្ណោះ!)
    // ==========================================
    merchantId: { type: String },
    cardId: { type: String },
    cardNumber: { type: String },
    receiptUrl: { type: String },
  },
  { timestamps: true, minimize: true },
);

transactionSchema.set("toJSON", {
  virtuals: true,
  transform: function (doc, ret) {
    ret._id = doc._id.toString();
    ret.id = doc._id.toString();
    delete ret.__v;
  },
});

module.exports = mongoose.model("Transaction", transactionSchema);
