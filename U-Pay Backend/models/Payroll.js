// ============================================================================
// ឯកសារ: models/Payroll.js
// អត្ថន័យ: Schema ស្តង់ដារកម្រិតធនាគារសម្រាប់ការបើកប្រាក់ខែស្វ័យប្រវត្តិ (Strict _id & Compact)
// ============================================================================

const mongoose = require("mongoose");

const payrollSchema = new mongoose.Schema(
  {
    // ==========================================
    // 👤 ១. ព័ត៌មានម្ចាស់កាលវិភាគ (Owner Info - Strict _id)
    // ==========================================
    creatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    }, // 🔗 សោរគោលភ្ជាប់ទៅកាន់ User._id
    username: { type: String, required: true }, // Snapshot សម្រាប់មើលងាយស្រួល

    // ==========================================
    // 📋 ២. ព័ត៌មានទូទៅនៃប្រតិបត្តិការ (General Payroll Info)
    // ==========================================
    type: {
      type: String,
      enum: ["single", "bulk"],
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    currency: {
      type: String,
      enum: ["USD", "KHR"],
      default: "USD",
    },

    // ==========================================
    // 🏦 ៣. ប្រភពទឹកប្រាក់ និងអ្នកទទួល (Source & Recipients - Strict _id)
    // ==========================================
    sourceAccount: {
      type: String,
      required: true,
    },
    recipients: [
      {
        recipientId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        }, // 🔗 _id របស់បុគ្គលិកទទួលប្រាក់ខែ (បើមាន)
        account: { type: String, required: true },
        name: { type: String, default: "Unknown" },
        amount: { type: Number, required: true, min: 0.01 },
        remark: { type: String }, // បង្កើតតែពេលមានវាយចំណាំប៉ុណ្ណោះ
      },
    ],
    totalAmount: {
      type: Number,
      required: true,
      min: 0.01,
    },

    // ==========================================
    // ⏰ ៤. ការកំណត់កាលវិភាគ (Scheduling Details)
    // ==========================================
    frequency: {
      type: String,
      enum: ["once", "weekly", "monthly", "yearly", "manual"],
      default: "once",
    },
    scheduleDetails: {
      type: Object, // បង្កើតតែពេលមានកំណត់ម៉ោង/ថ្ងៃប៉ុណ្ណោះ
    },
    isTemplate: {
      type: Boolean,
      default: false,
    },

    // ==========================================
    // 📊 ៥. ស្ថានភាព និងការតាមដាន (Status & Tracking Logs)
    // ==========================================
    status: {
      type: String,
      enum: ["active", "completed", "failed", "paused", "draft"],
      default: "active",
    },
    executionCount: {
      type: Number,
      default: 0,
    },
    lastExecutedAt: {
      type: Date,
    },
    failureReason: {
      type: String, // បង្កើតតែពេល Status លោតទៅជា "failed" ប៉ុណ្ណោះ
    },
  },
  { timestamps: true, minimize: true },
);

payrollSchema.set("toJSON", {
  virtuals: true,
  transform: function (doc, ret) {
    ret._id = doc._id.toString();
    ret.id = doc._id.toString();
    delete ret.__v;
  },
});

module.exports = mongoose.model("Payroll", payrollSchema);
