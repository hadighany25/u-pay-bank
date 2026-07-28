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
    linkedAccounts: {
      USD: { type: String, default: null },
      KHR: { type: String, default: null },
    },
    merchantId: {
      type: String,
      required: true,
      unique: true,
    },
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
    // 🔥 បន្ថែម Field នេះសម្រាប់ទុក Telegram Chat ID របស់ហាងនីមួយៗ
    telegramChatId: {
      type: String,
      default: null,
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
