// ============================================================================
// ឯកសារ: models/SplitBill.js
// អត្ថន័យ: Database Model សម្រាប់ប្រព័ន្ធ «រួមគ្នាទូទាត់ (Smart Split Bill)» (100% Pure _id)
// ============================================================================
const mongoose = require("mongoose");

const SplitParticipantSchema = new mongoose.Schema({
  slotNumber: { type: Number, required: true },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  username: { type: String, default: "" },
  fullName: { type: String, default: "សមាជិក (រង់ចាំស្កេន/បង់)" },
  profileImage: { type: String, default: "" },
  isHost: { type: Boolean, default: false },
  amount: { type: Number, required: true, default: 0 },
  status: {
    type: String,
    enum: ["Pending", "Paid"],
    default: "Pending",
  },
  paidAt: { type: String, default: "" },
  refId: { type: String, default: "" },
});

const SplitBillSchema = new mongoose.Schema(
  {
    billId: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true, default: "រួមគ្នាទូទាត់" },
    hostUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    hostUsername: { type: String, default: "" },
    hostFullName: { type: String, required: true },
    hostProfileImage: { type: String, default: "" },
    hostAccount: { type: String, required: true },
    currency: { type: String, enum: ["USD", "KHR"], default: "USD" },
    splitMode: { type: String, enum: ["equal", "custom"], default: "equal" },
    totalAmount: { type: Number, required: true },
    perPersonAmount: { type: Number, required: true },
    totalHeadcount: { type: Number, required: true, default: 2 },
    participants: [SplitParticipantSchema],
    status: {
      type: String,
      enum: ["Active", "Completed", "Cancelled"],
      default: "Active",
    },
    createdAtStr: { type: String, default: "" },
  },
  { timestamps: true },
);

module.exports = mongoose.model("SplitBill", SplitBillSchema);
