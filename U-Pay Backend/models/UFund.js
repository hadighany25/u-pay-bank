const mongoose = require("mongoose");

const ufundSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    type: { type: String, enum: ["personal", "group"], default: "personal" },
    targetAmount: { type: Number, required: true },
    currentAmount: { type: Number, default: 0 },
    currency: { type: String, default: "USD" },
    creator: { type: String, required: true }, // Username ម្ចាស់ប្រអប់
    isLocked: { type: Boolean, default: false }, // បើ true គឺហាមដកលុយទាល់តែគ្រប់គោលដៅ
    qrCodeString: { type: String }, // លេខកូដសម្រាប់ Generate QR

    // បញ្ជីសមាជិកក្រុម
    members: [
      {
        username: String,
        fullName: String,
        role: { type: String, enum: ["admin", "member"], default: "member" },
        status: {
          type: String,
          enum: ["active", "pending", "overdue"],
          default: "active",
        }, // pending=រង់ចាំការយល់ព្រម, overdue=ជំពាក់លុយអត់ដាក់
        contributedAmount: { type: Number, default: 0 }, // លុយដែលគាត់បានដាក់ចូល

        // ការកំណត់កាត់លុយស្វ័យប្រវត្តិ
        autoDeposit: {
          enabled: { type: Boolean, default: false },
          amount: { type: Number, default: 0 },
          frequency: {
            type: String,
            enum: ["none", "daily", "weekly", "monthly"],
            default: "none",
          },
          dayOfWeek: { type: Number }, // 1 (Mon) ដល់ 7 (Sun)
          dayOfMonth: { type: Number }, // 1 ដល់ 28
        },
      },
    ],

    // ប្រវត្តិប្រតិបត្តិការក្នុងក្រុម (Log)
    history: [
      {
        refId: String,
        username: String,
        fullName: String,
        amount: Number,
        date: String,
        type: {
          type: String,
          enum: ["deposit", "withdraw", "penalty"],
          default: "deposit",
        },
        remark: String,
      },
    ],
  },
  { timestamps: true },
);

module.exports = mongoose.model("UFund", ufundSchema);
