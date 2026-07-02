const mongoose = require("mongoose");

const merchantSchema = new mongoose.Schema(
  {
    userId: {
      type: String, // ប្តូរពី ObjectId មកជា String ធម្មតា
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
    linkedAccount: {
      type: String,
      enum: ["USD", "KHR"],
      required: true,
    },
    // លេខសម្គាល់ហាង ១៥ ខ្ទង់
    merchantId: {
      type: String,
      required: true,
      unique: true,
    },
    // លេខគណនីហាង ១២ ខ្ទង់ (សម្រាប់ទទួលលុយ)
    accountNumber: {
      type: String,
      required: true,
      unique: true,
    },
    balance: {
      type: Number,
      default: 0.0,
    },
    // Keys សម្រាប់ភ្ជាប់ API
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
