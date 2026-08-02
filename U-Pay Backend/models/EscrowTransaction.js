const mongoose = require("mongoose");

const escrowTransactionSchema = new mongoose.Schema(
  {
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Merchant",
      required: true,
    },
    referenceId: {
      type: String,
      required: true, // ឧ. Withdrawal ID ពី U-Mall (WD-00123) ដើម្បីកុំឱ្យជាន់គ្នា
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
    receiverAccount: {
      type: String,
      required: true, // លេខគណនី U-Pay របស់អ្នកលក់ (Seller Account Number)
    },
    status: {
      type: String,
      enum: ["frozen", "completed", "failed", "refunded"],
      default: "frozen",
    },
    receiptPdfUrl: {
      type: String,
      default: "", // ទុក Link PDF ពេលទូទាត់ជោគជ័យ
    },
    frozenAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
  },
  { timestamps: true },
);

// បង្កើត Index ដើម្បីកុំឱ្យ U-Mall បាញ់ Reference ID ដដែលៗមកជាន់គ្នា
escrowTransactionSchema.index(
  { merchantId: 1, referenceId: 1 },
  { unique: true },
);

module.exports = mongoose.model("EscrowTransaction", escrowTransactionSchema);
