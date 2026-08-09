const mongoose = require("mongoose");

const payrollSchema = new mongoose.Schema({
  userId: {
    type: String, // កែមកជា String វិញដើម្បីងាយស្រួលយល់ជាមួយ JWT Token
    required: true,
  },
  type: {
    type: String,
    enum: ["single", "bulk"],
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  sourceAccount: {
    type: String,
    required: true,
  },
  recipients: [
    {
      account: { type: String, required: true },
      name: { type: String },
      amount: { type: Number, required: true },
      remark: { type: String, default: "" },
    },
  ],
  totalAmount: {
    type: Number,
    required: true,
  },
  frequency: {
    type: String,
    enum: ["once", "weekly", "monthly", "yearly", "manual"],
    default: "once",
  },
  scheduleDetails: {
    type: Object,
    default: {},
  },
  isTemplate: {
    type: Boolean,
    default: false,
  },
  status: {
    type: String,
    enum: ["active", "completed", "failed", "paused", "draft"],
    default: "active",
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// ⚠️ ខ្ញុំបានលុបការកំណត់ unique index ចេញ ដើម្បីអោយវាអាច Save បានទោះជាឈ្មោះដូចគ្នាក៏ដោយ

module.exports = mongoose.model("Payroll", payrollSchema);
