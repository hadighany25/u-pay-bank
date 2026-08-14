const mongoose = require("mongoose");

const merchantSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    city: { type: String, required: true },
    category: { type: String, required: true, default: "Other" },
    linkedAccounts: {
      USD: { type: String, default: null },
      KHR: { type: String, default: null },
    },
    merchantId: { type: String, required: true, unique: true },
    accountNumbers: {
      USD: { type: String, default: null },
      KHR: { type: String, default: null },
    },

    // 👨‍💼 ប្រព័ន្ធគ្រប់គ្រងអ្នកគិតលុយ (Cashiers)
    cashiers: [
      {
        accountNumber: { type: String, required: true }, // លេខកុង U-Pay ពិត
        // 🔥 [អាប់ដេតថ្មី] បំបែក Virtual Accounts ជា ២ (USD និង KHR)
        virtualAccounts: {
          USD: { type: String, default: null },
          KHR: { type: String, default: null },
        },
        virtualAccount: { type: String }, // (រក្សាទុកក្រែងលោមានទិន្នន័យចាស់កុំឲ្យគាំង)
        originalName: { type: String, required: true }, // ឈ្មោះពិតក្នុងប្រព័ន្ធ (ការពារកុំឱ្យបន្លំ)
        displayName: { type: String, required: true }, // ឈ្មោះដែលថៅកែដាក់ឱ្យ (ឧ. T.A)
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
