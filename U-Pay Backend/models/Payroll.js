// ============================================================================
// ឯកសារ: models/Payroll.js
// អត្ថន័យ: Schema ស្តង់ដារកម្រិតធនាគារសម្រាប់ការបើកប្រាក់ខែ និងទូទាត់ស្វ័យប្រវត្តិ
// ============================================================================

const mongoose = require("mongoose");

const payrollSchema = new mongoose.Schema(
  {
    // ==========================================
    // 👤 ១. ព័ត៌មានម្ចាស់កាលវិភាគ (Owner Info)
    // ==========================================
    creatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true, // បង្កើនល្បឿនក្នុងការស្វែងរកទិន្នន័យ (Query Performance)
    },
    username: {
      type: String, // រក្សាទុកជា Snapshot ដើម្បីងាយស្រួលបង្ហាញដោយមិនបាច់ Populate រាល់ដង
      required: true,
    },

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
    },
    currency: {
      type: String,
      enum: ["USD", "KHR"],
      default: "USD", // សម្គាល់រូបិយប័ណ្ណនៃការទូទាត់
    },

    // ==========================================
    // 🏦 ៣. ប្រភពទឹកប្រាក់ និងអ្នកទទួល (Source & Recipients)
    // ==========================================
    sourceAccount: {
      type: String,
      required: true, // លេខកុងជាក់ស្តែង ឧ. 100100100 (Main USD/KHR)
    },
    recipients: [
      {
        account: { type: String, required: true },
        name: { type: String, default: "Unknown" },
        amount: { type: Number, required: true, min: 0.01 },
        remark: { type: String, default: "" },
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
      type: Object,
      default: {},
      // ទម្រង់កំណត់ត្រា: { date: "YYYY-MM-DD", time: "HH:mm", daysOfWeek: ["1","2"], dayOfMonth: "15" }
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
      default: 0, // រាប់ចំនួនដងដែលបានកាត់លុយជោគជ័យ (មានប្រយោជន៍សម្រាប់ប្រេកង់ប្រចាំខែ)
    },
    lastExecutedAt: {
      type: Date,
      default: null, // កាលបរិច្ឆេទដែលបានកាត់លុយចុងក្រោយ
    },
    failureReason: {
      type: String,
      default: null, // កត់ត្រាមូលហេតុពេល Status លោតទៅជា "failed" (ឧ. "សមតុល្យមិនគ្រប់គ្រាន់")
    },
  },
  {
    timestamps: true, // Mongoose នឹងបង្កើត createdAt និង updatedAt ដោយស្វ័យប្រវត្តិ
  },
);

// ផ្លាស់ប្តូរ _id ឱ្យទៅជា id អូតូពេលបោះទិន្នន័យទៅ Frontend
payrollSchema.set("toJSON", {
  virtuals: true,
  transform: function (doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
  },
});

module.exports = mongoose.model("Payroll", payrollSchema);
