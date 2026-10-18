// ============================================================================
// ឯកសារ: models/Merchant.js
// អត្ថន័យ: Schema ស្តង់ដារសម្រាប់គ្រប់គ្រងហាងទំនិញ និងការកំណត់ដាច់ដោយឡែកតាមសាខា (Per-Shop Settings)
// ============================================================================

const mongoose = require("mongoose");

const merchantSchema = new mongoose.Schema(
  {
    // 🛡️ សុវត្ថិភាព ៣ ជាន់ ភ្ជាប់ទៅកាន់ម្ចាស់ហាង (User)
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    userCustomId: { type: String, index: true },
    username: { type: String, index: true },
    userId: { type: String, required: true, index: true },

    name: { type: String, required: true, trim: true },
    logo: { type: String, default: "" }, // 🖼️ រូបឡូហ្គោហាងដាច់ដោយឡែកតាមសាខា
    city: { type: String, required: true },
    category: { type: String, required: true, default: "Food & Beverage" },

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

    // 👨‍💼 ប្រព័ន្ធគ្រប់គ្រងអ្នកគិតលុយ (Cashiers) ប្រចាំហាងនីមួយៗ
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

    // 🔥 សម្រាប់ B2B API & POS: លុយដែលកំពុងបង្កក (Escrow Hold)
    escrowHold: {
      USD: { type: Number, default: 0.0 },
      KHR: { type: Number, default: 0.0 },
    },

    // 🔒 ផ្នែកសុវត្ថិភាពសម្រាប់ហៅ B2B API
    apiKey: { type: String, required: true, unique: true },
    apiSecret: { type: String, required: true },

    // 📡 សម្រាប់ការផ្តល់ដំណឹងស្វ័យប្រវត្តិ (ដាច់ដោយឡែកតាមហាងនីមួយៗ)
    webhookUrl: { type: String, default: "" },
    telegramChatId: { type: String, default: null },
    telegramGroupName: { type: String, default: "" },

    // ⚙️ ការកំណត់ដាច់ដោយឡែកសម្រាប់តែហាងនេះមួយគត់ (Per-Shop Isolated Settings)
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

module.exports = mongoose.model("Merchant", merchantSchema);
