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
    // 🔥 បន្ថែម Field នេះចូល៖
    category: {
      type: String,
      required: true, // ដាក់ true ប្រសិនបើបងចង់ឱ្យគ្រប់ហាងត្រូវតែមាន Category
      default: "Other", // ដាក់តម្លៃ Default ទុកជាមុន
    },
    linkedAccount: {
      type: String,
      enum: ["USD", "KHR"],
      required: true,
    },
    merchantId: {
      type: String,
      required: true,
      unique: true,
    },
    accountNumbers: {
      USD: { type: String, required: true },
      KHR: { type: String, required: true },
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
