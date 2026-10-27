// ============================================================================
// ឯកសារ: models/Merchant.js
// អត្ថន័យ: Schema សម្រាប់គ្រប់គ្រងហាងទំនិញ និងសាខា (Strict _id Binding)
// ============================================================================

const mongoose = require("mongoose");

const merchantSchema = new mongoose.Schema(
  {
    // 🛡️ ភ្ជាប់ទៅកាន់ម្ចាស់ហាងតាមរយៈ MongoDB _id ដាច់ខាត
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    name: { type: String, required: true, trim: true },
    logo: { type: String, default: "" },
    city: { type: String, required: true },
    category: { type: String, required: true, default: "Food & Beverage" },

    // 🔗 គណនីដែលភ្ជាប់សម្រាប់ទទួលប្រាក់
    linkedAccounts: {
      USD: { type: String, default: null },
      KHR: { type: String, default: null },
    },

    merchantId: { type: String, required: true, unique: true, index: true },

    accountNumbers: {
      USD: { type: String, default: null },
      KHR: { type: String, default: null },
    },

    cashiers: [
      {
        accountNumber: { type: String, required: true },
        virtualAccounts: {
          USD: { type: String, default: null },
          KHR: { type: String, default: null },
        },
        virtualAccount: { type: String },
        originalName: { type: String, required: true },
        displayName: { type: String, required: true },
        status: {
          type: String,
          enum: ["Active", "Suspended"],
          default: "Active",
        },
        addedAt: { type: Date, default: Date.now },
      },
    ],

    collected: {
      USD: { type: Number, default: 0.0 },
      KHR: { type: Number, default: 0 },
    },

    escrowHold: {
      USD: { type: Number, default: 0.0 },
      KHR: { type: Number, default: 0.0 },
    },

    apiKey: { type: String, required: true, unique: true },
    apiSecret: { type: String, required: true },

    webhookUrl: { type: String, default: "" },
    telegramChatId: { type: String, default: null },
    telegramGroupName: { type: String, default: "" },

    settings: {
      voiceEnabled: { type: Boolean, default: true },
      voiceProfile: { type: String, default: "km_female_1" },
      voiceLang: { type: String, default: "km" },
      soundChime: { type: Boolean, default: true },
      telegramAlertEnabled: { type: Boolean, default: true },
      defaultCurrency: { type: String, enum: ["USD", "KHR"], default: "USD" },
      receiptFooter: {
        type: String,
        default: "សូមអរគុណដែលបានគាំទ្រហាងយើងខ្ញុំ!",
      },
    },

    status: {
      type: String,
      enum: ["Active", "Inactive", "Suspended"],
      default: "Active",
    },
  },
  { timestamps: true },
);

merchantSchema.set("toJSON", {
  virtuals: true,
  transform: function (doc, ret) {
    if (!ret.id) ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
  },
});

module.exports = mongoose.model("Merchant", merchantSchema);
