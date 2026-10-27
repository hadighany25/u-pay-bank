// ============================================================================
// ឯកសារ: models/UFund.js
// អត្ថន័យ: Schema ស្តង់ដារសម្រាប់គម្រោងសន្សំប្រាក់រួម និងផ្ទាល់ខ្លួន (Strict _id Binding & Compact)
// ============================================================================

const mongoose = require("mongoose");

const ufundSchema = new mongoose.Schema(
  {
    // ==========================================
    // 🎯 ១. ព័ត៌មានមូលដ្ឋានគម្រោង និងម្ចាស់គម្រោង (Basic Fund & Creator Info)
    // ==========================================
    creatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    }, // 🔗 សោរគោលភ្ជាប់ទៅកាន់ _id របស់អ្នកបង្កើតគម្រោង
    creator: { type: String, required: true }, // Snapshot សម្រាប់មើលឈ្មោះគណនីបង្កើត
    creatorUserId: { type: String }, // Snapshot លេខសម្គាល់ ៨ ខ្ទង់ (បើមាន)

    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ["personal", "group"], default: "personal" },
    targetAmount: { type: Number, required: true },
    baseContribution: { type: Number, default: 0 },
    currentAmount: { type: Number, default: 0 },
    currency: { type: String, enum: ["USD", "KHR"], default: "USD" },
    qrCodeString: { type: String },

    // ==========================================
    // ⚙️ ២. ការកំណត់ជាន់ខ្ពស់ពី Admin ក្រុម (Advanced Settings)
    // ==========================================
    isLocked: { type: Boolean, default: false },
    deadline: { type: Date },
    announcement: { type: String },

    // ==========================================
    // ⚖️ ៣. ច្បាប់ និងលក្ខខណ្ឌពិសេស (Rules & Policies)
    // ==========================================
    lateJoinerRule: {
      type: String,
      enum: ["zero", "catchup"],
      default: "zero",
    },
    penaltyRule: {
      enabled: { type: Boolean, default: false },
      amount: { type: Number },
      gracePeriodDays: { type: Number },
    },

    // ==========================================
    // 👥 ៤. ទិន្នន័យសមាជិក និងបំណុល (Members & Contributions - Strict _id)
    // ==========================================
    members: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        }, // 🔗 សោរគោលភ្ជាប់ទៅកាន់ _id របស់សមាជិកម្នាក់ៗ
        username: { type: String }, // Snapshot សម្រាប់មើល
        fullName: { type: String }, // Snapshot សម្រាប់បង្ហាញឈ្មោះពេញ
        profileImage: { type: String },

        role: { type: String, enum: ["admin", "member"], default: "member" },
        status: {
          type: String,
          enum: ["active", "pending", "overdue"],
          default: "active",
        },
        contributedAmount: { type: Number, default: 0 },
        invitedAt: { type: Number },

        // 🌟 បង្ហាញតែពេលមានបំណុលជំពាក់គម្រោង
        debtAmount: { type: Number, default: 0 },
        overdueSince: { type: Date },

        // 🚪 បង្កើតតែពេលសមាជិកដាក់សំណើសុំចាកចេញប៉ុណ្ណោះ
        leaveRequest: {
          requested: { type: Boolean },
          reason: { type: String },
          requestedAt: { type: Date },
        },

        // ⏰ បង្កើតតែពេលសមាជិកបើកមុខងារកាត់ប្រាក់ស្វ័យប្រវត្តិប៉ុណ្ណោះ
        autoDeposit: {
          enabled: { type: Boolean },
          amount: { type: Number },
          frequency: {
            type: String,
            enum: ["none", "daily", "weekly", "monthly"],
          },
          time: { type: String },
          dayOfWeek: { type: Number },
          dayOfMonth: { type: Number },
        },
      },
    ],

    // ==========================================
    // 🧾 ៥. ប្រវត្តិប្រតិបត្តិការក្នុងក្រុម (Transaction Logs - Strict _id)
    // ==========================================
    history: [
      {
        refId: { type: String },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // 🔗 _id របស់សមាជិកដែលធ្វើប្រតិបត្តិការ
        username: { type: String },
        fullName: { type: String },
        amount: { type: Number },
        date: { type: String },
        type: {
          type: String,
          enum: ["deposit", "withdraw", "penalty", "refund"],
          default: "deposit",
        },
        remark: { type: String },
      },
    ],
  },
  { timestamps: true, minimize: true },
);

ufundSchema.set("toJSON", {
  virtuals: true,
  transform: function (doc, ret) {
    ret._id = doc._id.toString();
    ret.id = doc._id.toString();
    delete ret.__v;
  },
});

module.exports = mongoose.model("UFund", ufundSchema);
