// models/UFund.js
const mongoose = require("mongoose");

const ufundSchema = new mongoose.Schema(
  {
    // ==========================================
    // 🎯 ១. ព័ត៌មានមូលដ្ឋានគម្រោង (Basic Fund Info)
    // ==========================================
    name: { type: String, required: true }, // ឈ្មោះគម្រោង
    type: { type: String, enum: ["personal", "group"], default: "personal" },
    targetAmount: { type: Number, required: true }, // គោលដៅប្រាក់ត្រូវសន្សំ
    baseContribution: { type: Number, default: 0 }, // ខ្នាតគោល (Fair Share) ដែលកើនឡើងរាល់ពេលប្រព័ន្ធកាត់លុយ
    currentAmount: { type: Number, default: 0 }, // ទឹកប្រាក់សន្សំបានបច្ចុប្បន្ន
    currency: { type: String, default: "USD" },
    creator: { type: String, required: true }, // ឈ្មោះ Admin
    qrCodeString: { type: String }, // កូដសម្រាប់ផ្ទាំង Scan

    // ==========================================
    // ⚙️ ២. ការកំណត់ជាន់ខ្ពស់ពី Admin (Advanced Settings)
    // ==========================================
    isLocked: { type: Boolean, default: false }, // ទប់ស្កាត់ការស្នើសុំដកប្រាក់ ឬចាកចេញ
    deadline: { type: Date }, // កាលបរិច្ឆេទផុតកំណត់គម្រោង
    announcement: { type: String, default: "" }, // សារប្រកាស (Pinned Memo)

    // ==========================================
    // ⚖️ ៣. ច្បាប់ និងលក្ខខណ្ឌពិសេស (Rules & Policies)
    // ==========================================
    // ច្បាប់សម្រាប់អ្នកសុំចូលជាសមាជិកតាមក្រោយ
    lateJoinerRule: {
      type: String,
      enum: ["zero", "catchup"], // "zero" អត់បាច់បង់បង្គ្រប់, "catchup" ត្រូវបង់លុយតាមគេឱ្យទាន់
      default: "zero",
    },

    // ច្បាប់ពិន័យអ្នកបង់យឺតយ៉ាវ
    penaltyRule: {
      enabled: { type: Boolean, default: false },
      amount: { type: Number, default: 0 }, // ចំនួនប្រាក់ពិន័យ
      gracePeriodDays: { type: Number, default: 1 }, // ចំនួនថ្ងៃអនុញ្ញាតឱ្យយឺត
    },

    // ==========================================
    // 👥 ៤. ទិន្នន័យសមាជិក និងបំណុល (Members & Contributions)
    // ==========================================
    members: [
      {
        // ព័ត៌មានផ្ទាល់ខ្លួនរបស់សមាជិក
        username: String,
        fullName: String,
        profileImage: String,
        role: { type: String, enum: ["admin", "member"], default: "member" },
        status: {
          type: String,
          enum: ["active", "pending", "overdue"], // overdue = កំពុងជំពាក់
          default: "active",
        },
        contributedAmount: { type: Number, default: 0 }, // ទឹកប្រាក់បង់រួច
        invitedAt: { type: Number },

        // 🌟 ប្រព័ន្ធបំណុលរវាងសមាជិកនិងគម្រោង
        debtAmount: { type: Number, default: 0 }, // ចំនួនលុយជំពាក់គម្រោង
        overdueSince: { type: Date }, // ចាប់ផ្តើមជំពាក់ពីថ្ងៃណា

        // សំណើសុំចាកចេញពីគម្រោង (ត្រូវការការអនុម័តពី Admin)
        leaveRequest: {
          requested: { type: Boolean, default: false },
          reason: { type: String, default: "" },
          requestedAt: { type: Date },
        },

        // ការកំណត់កាត់ប្រាក់ស្វ័យប្រវត្តិ
        autoDeposit: {
          enabled: { type: Boolean, default: false },
          amount: { type: Number, default: 0 },
          frequency: {
            type: String,
            enum: ["none", "daily", "weekly", "monthly"],
            default: "none",
          },
          time: { type: String, default: "08:00" },
          dayOfWeek: { type: Number },
          dayOfMonth: { type: Number },
        },
      },
    ],

    // ==========================================
    // 🧾 ៥. ប្រវត្តិប្រតិបត្តិការក្នុងក្រុម (Transaction Logs)
    // ==========================================
    history: [
      {
        refId: String,
        username: String,
        fullName: String,
        amount: Number,
        date: String,
        type: {
          type: String,
          enum: ["deposit", "withdraw", "penalty", "refund"],
          default: "deposit",
        },
        remark: String,
      },
    ],
  },
  { timestamps: true },
);

module.exports = mongoose.model("UFund", ufundSchema);
