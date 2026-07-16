const mongoose = require("mongoose");

const merchantSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    city: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      required: true,
      default: "Other",
    },
    // 🔥 កែត្រង់នេះ៖ ជំនួស linkedAccount ចាស់ដោយ linkedAccounts ថ្មី
    linkedAccounts: {
      USD: { type: String, default: null }, // លេខគណនីប្រាក់ដុល្លារដែលម្ចាស់ហាងរើសយកមកភ្ជាប់
      KHR: { type: String, default: null }, // លេខគណនីប្រាក់រៀលដែលម្ចាស់ហាងរើសយកមកភ្ជាប់
    },
    merchantId: {
      type: String,
      required: true,
      unique: true,
    },
    // លេខកុង QR របស់ហាងផ្ទាល់ (បង្កើតអូតូ សម្រាប់ឱ្យគេ Scan)
    accountNumbers: {
      USD: { type: String, default: null },
      KHR: { type: String, default: null },
    },
    collected: {
      USD: { type: Number, default: 0.0 },
      KHR: { type: Number, default: 0 },
    },
    apiKey: {
      type: String,
      required: true,
      unique: true,
    },
    apiSecret: {
      type: String,
      required: true,
    },
    webhookUrl: {
      type: String,
      default: "",
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
