// ============================================================================
// ឯកសារ: models/JointAccount.js
// អត្ថន័យ: Schema ស្តង់ដារសម្រាប់គណនីរួម (Joint Account - Strict _id Binding & Compact)
// ============================================================================

const mongoose = require("mongoose");

const jointAccountSchema = new mongoose.Schema(
  {
    // ==========================================
    // 🔑 ១. អត្តសញ្ញាណគណនីរួម និងម្ចាស់បង្កើតដំបូង (Account & Creator Identity)
    // ==========================================
    accountId: { type: String, required: true, unique: true, index: true },
    accountNumber: { type: String, required: true, unique: true, index: true },
    accountName: { type: String, required: true, trim: true },

    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    }, // 🔗 _id របស់អ្នកបង្កើតគណនីរួមដំបូង

    // ==========================================
    // 💰 ២. សមតុល្យកណ្តាល និងស្ថានភាព (Single Source of Truth Balance)
    // ==========================================
    balance: { type: Number, default: 0.0 },
    currency: { type: String, enum: ["USD", "KHR"], default: "USD" },
    isLocked: { type: Boolean, default: false },

    // ==========================================
    // 👥 ៣. បញ្ជីសមាជិកគណនីរួម (Members - Strict _id Binding)
    // ==========================================
    members: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
          index: true,
        }, // 🔗 សោរគោលភ្ជាប់ទៅកាន់ _id របស់សមាជិកម្នាក់ៗ
        username: { type: String }, // Snapshot សម្រាប់មើលងាយស្រួល
        fullName: { type: String }, // Snapshot សម្រាប់បង្ហាញឈ្មោះពេញ

        role: {
          type: String,
          enum: ["owner", "co-owner", "member"],
          default: "member",
        },
        dailyLimit: { type: Number, default: 0 },
        spentToday: { type: Number, default: 0 },
        lastSpentDate: { type: String },
        status: {
          type: String,
          enum: ["pending", "active", "rejected"],
          default: "pending",
        },
      },
    ],

    // ==========================================
    // 🗂️ ៤. ទិន្នន័យបន្ថែម (បង្កើតតែពេលមានទិន្នន័យប៉ុណ្ណោះ)
    // ==========================================
    metadata: { type: Object },
  },
  { timestamps: true, minimize: true },
);

jointAccountSchema.set("toJSON", {
  virtuals: true,
  transform: function (doc, ret) {
    ret._id = doc._id.toString();
    ret.id = doc._id.toString();
    delete ret.__v;
  },
});

module.exports = mongoose.model("JointAccount", jointAccountSchema);
