// ============================================================================
// ឯកសារ: models/Merchant.js
// អត្ថន័យ: Schema ស្តង់ដារសម្រាប់គ្រប់គ្រងហាងទំនិញ និងប្រព័ន្ធទូទាត់អាជីវករ
// ============================================================================

const mongoose = require("mongoose");

const merchantSchema = new mongoose.Schema(
  {
    // 🛡️ សុវត្ថិភាព ៣ ជាន់ ភ្ជាប់ទៅកាន់ម្ចាស់ហាង (User)
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true }, // ភ្ជាប់ជាមួយ user._id
    userCustomId: { type: String, index: true }, // ភ្ជាប់ជាមួយ user.id ឬ user.userId
    username: { type: String, index: true }, // ភ្ជាប់ជាមួយ user.username
    userId: { type: String, required: true, index: true }, // រក្សាទុកសម្រាប់ទិន្នន័យចាស់ (Backward Compatibility)

    name: { type: String, required: true, trim: true },
    city: { type: String, required: true },
    category: { type: String, required: true, default: "Other" },

    // 🔗 គណនីដែលភ្ជាប់សម្រាប់ទទួលប្រាក់ (អាចជា Main, Sub, ឬ Joint Account)
    linkedAccounts: {
      USD: { type: String, default: null },
      KHR: { type: String, default: null },
    },

    merchantId: { type: String, required: true, unique: true, index: true },

    // 💳 លេខគណនីសម្គាល់ QR របស់ហាង (888... និង 999...)
    accountNumbers: {
      USD: { type: String, default: null },
      KHR: { type: String, default: null },
    },

    // 👨‍💼 ប្រព័ន្ធគ្រប់គ្រងអ្នកគិតលុយ (Cashiers)
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

    // 💰 លុយដែលអាចចាយ/ដកបាន (Available Balance)
    collected: {
      USD: { type: Number, default: 0.0 },
      KHR: { type: Number, default: 0 },
    },

    // 🔥 សម្រាប់ B2B API: លុយដែលកំពុងបង្កក (រង់ចាំទូទាត់ឱ្យ Seller)
    escrowHold: {
      USD: { type: Number, default: 0.0 },
      KHR: { type: Number, default: 0.0 },
    },

    // 🔒 ផ្នែកសុវត្ថិភាពសម្រាប់ហៅ B2B API
    apiKey: { type: String, required: true, unique: true },
    apiSecret: { type: String, required: true },

    // 📡 សម្រាប់ការផ្តល់ដំណឹងស្វ័យប្រវត្តិ
    webhookUrl: { type: String, default: "" },
    telegramChatId: { type: String, default: null },

    status: {
      type: String,
      enum: ["Active", "Inactive", "Suspended"],
      default: "Active",
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Merchant", merchantSchema);
