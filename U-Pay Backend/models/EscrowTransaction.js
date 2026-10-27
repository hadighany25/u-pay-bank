// ============================================================================
// ឯកសារ: models/EscrowTransaction.js
// អត្ថន័យ: Schema ស្តង់ដារសម្រាប់ប្រតិបត្តិការបង្កកប្រាក់ B2B / U-Mall (Strict _id Binding & Compact)
// ============================================================================

const mongoose = require("mongoose");

const escrowTransactionSchema = new mongoose.Schema(
  {
    // ==========================================
    // 🏪 ១. អត្តសញ្ញាណហាង និងអ្នកទទួលប្រាក់ (Merchant & Receiver _id)
    // ==========================================
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Merchant",
      required: true,
      index: true,
    }, // 🔗 ភ្ជាប់ទៅ _id របស់ហាងទំនិញ (Merchant)
    receiverUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    }, // 🔗 ភ្ជាប់ទៅ _id របស់ម្ចាស់គណនីអ្នកលក់ (Seller User _id)
    receiverAccount: {
      type: String,
      required: true, // លេខគណនី U-Pay របស់អ្នកលក់
    },

    // ==========================================
    // 💸 ២. ព័ត៌មានទឹកប្រាក់ និងលេខយោង (Escrow Details)
    // ==========================================
    referenceId: {
      type: String,
      required: true, // ឧ. Withdrawal ID ពី U-Mall (WD-00123)
    },
    currency: {
      type: String,
      enum: ["USD", "KHR"],
      default: "USD",
    },
    amount: {
      type: Number,
      required: true,
    },

    // ==========================================
    // 📊 ៣. ស្ថានភាព និងវិក្កយបត្រ (Status & Timestamps)
    // ==========================================
    status: {
      type: String,
      enum: ["frozen", "completed", "failed", "refunded"],
      default: "frozen",
    },
    receiptPdfUrl: {
      type: String, // បង្កើតតែពេលទូទាត់ជោគជ័យមាន Link PDF
    },
    frozenAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
  },
  { timestamps: true, minimize: true },
);

// បង្កើត Index ការពារកុំឱ្យបាញ់ Reference ID ស្ទួនក្នុងហាងតែមួយ
escrowTransactionSchema.index(
  { merchantId: 1, referenceId: 1 },
  { unique: true },
);

escrowTransactionSchema.set("toJSON", {
  virtuals: true,
  transform: function (doc, ret) {
    ret._id = doc._id.toString();
    ret.id = doc._id.toString();
    delete ret.__v;
  },
});

module.exports = mongoose.model("EscrowTransaction", escrowTransactionSchema);
