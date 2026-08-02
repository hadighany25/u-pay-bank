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

    // 💰 លុយដែលអាចចាយ/ដកបាន (Available Balance)
    collected: {
      USD: { type: Number, default: 0.0 },
      KHR: { type: Number, default: 0 },
    },

    // 🔥 [បន្ថែមថ្មី] សម្រាប់ B2B API: លុយដែលកំពុងបង្កក (រង់ចាំទូទាត់ឱ្យ Seller)
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
