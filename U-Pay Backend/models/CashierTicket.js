// ============================================================================
// ឯកសារ: models/CashierTicket.js
// អត្ថន័យ: សំបុត្រស្នើសុំប្រតិបត្តិការដាក់/ដកប្រាក់នៅបញ្ជរ (Maker-Checker & Strict _id)
// ============================================================================

const mongoose = require("mongoose");

const cashierTicketSchema = new mongoose.Schema(
  {
    // ==========================================
    // 🔗 ១. ការតភ្ជាប់ទៅកាន់គណនីអតិថិជន និងវិក្កយបត្រ (User _id & Trx Link)
    // ==========================================
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    }, // 🔗 សោរគោលភ្ជាប់ទៅកាន់ User._id ដាច់ខាត
    username: { type: String }, // Snapshot សម្រាប់មើលងាយស្រួល

    ticketId: { type: String, required: true, unique: true, index: true }, // ឧ. TCK-12345678
    transactionId: { type: String, index: true }, // លេខ Ref ID ពេលប្រតិបត្តិការជោគជ័យ

    // ==========================================
    // 👨‍💼 ២. មន្ត្រីប្រតិបត្តិបញ្ជរ និងអ្នកត្រួតពិនិត្យ (Maker - Checker)
    // ==========================================
    makerId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" }, // 🔗 Admin._id អ្នកបង្កើតសំបុត្រ
    maker: { type: String, required: true }, // Snapshot ឈ្មោះ Maker

    checkerId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" }, // 🔗 Admin._id អ្នកអនុម័ត
    checker: { type: String }, // Snapshot ឈ្មោះ Checker (មានតែពេលពិនិត្យរួច)

    // ==========================================
    // 💵 ៣. ព័ត៌មានសាច់ប្រាក់ និងគណនីគោលដៅ (Cash Transaction Details)
    // ==========================================
    requestType: {
      type: String,
      enum: ["Deposit", "Withdrawal"],
      required: true,
    },
    amount: { type: Number, required: true },
    currency: { type: String, enum: ["USD", "KHR"], required: true },
    targetAcc: { type: String, required: true },
    depositorName: { type: String },

    // ==========================================
    // 📊 ៤. ស្ថានភាពសំបុត្រ និងទិន្នន័យបោះពុម្ពវិក្កយបត្រ (Status & Slip Data)
    // ==========================================
    status: {
      type: String,
      required: true,
      enum: [
        "pending_verify",
        "pending_approve",
        "verified",
        "approved",
        "rejected",
      ],
      index: true,
    },
    remark: { type: String },
    rejectReason: { type: String }, // បង្កើតតែពេលត្រូវបានបដិសេធ ("rejected") ប៉ុណ្ណោះ
    slipData: { type: Object }, // ទិន្នន័យសម្រាប់ Print Slip
  },
  { timestamps: true, minimize: true },
);

cashierTicketSchema.set("toJSON", {
  virtuals: true,
  transform: function (doc, ret) {
    ret._id = doc._id.toString();
    ret.id = doc._id.toString();
    delete ret.__v;
  },
});

module.exports = mongoose.model("CashierTicket", cashierTicketSchema);
