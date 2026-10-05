// ============================================================================
// ឯកសារ: models/CashierTicket.js
// អត្ថន័យ: សំបុត្រស្នើសុំប្រតិបត្តិការនៅបញ្ជរ (Maker-Checker Workflow)
// ============================================================================

const mongoose = require("mongoose");

const cashierTicketSchema = new mongoose.Schema(
  {
    // 🔗 ការតភ្ជាប់ទៅកាន់ User & Transaction
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    transactionId: { type: String, default: null }, // លេខ Ref ID បើលុយចូល/កាត់ជោគជ័យ

    // 👤 Maker - Checker
    maker: { type: String, required: true }, // Admin អ្នកវាយបញ្ជូល
    checker: { type: String, default: null }, // Admin អ្នកផ្ទៀងផ្ទាត់ / អនុម័ត

    // 💵 ព័ត៌មានប្រតិបត្តិការ
    requestType: {
      type: String,
      enum: ["Deposit", "Withdrawal"],
      required: true,
    },
    amount: { type: Number, required: true },
    currency: { type: String, required: true },
    targetAcc: { type: String, required: true },
    depositorName: { type: String },

    // 📊 ស្ថានភាព (Status)
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
    },

    remark: { type: String },
    rejectReason: { type: String, default: null },

    // 🧾 ទុកទិន្នន័យបន្ថែម សម្រាប់ Print Slip
    slipData: { type: Object, default: {} },
  },
  { timestamps: true },
);

module.exports = mongoose.model("CashierTicket", cashierTicketSchema);
