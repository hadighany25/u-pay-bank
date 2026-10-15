// ============================================================================
// ឯកសារ: models/Card.js (Upgraded for 3 Card Types & Credit Billing)
// ============================================================================
const mongoose = require("mongoose");

const cardSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    username: { type: String, required: true, index: true },
    userCustomId: { type: String, required: true },

    id: { type: String, required: true, unique: true, index: true },

    // 🟢 ប្រភេទកាតធំៗទាំង ៣: "virtual", "debit", "credit"
    cardCategory: {
      type: String,
      enum: ["virtual", "debit", "credit"],
      default: "virtual",
    },

    type: { type: String, default: "standard" }, // standard, gold (សម្រាប់ virtual) ឬ standard, platinum (សម្រាប់ physical)
    name: { type: String, default: "STANDARD" },
    number: { type: String, required: true, unique: true, index: true },
    cvv: { type: String, required: true },
    expiry: { type: String, required: true },

    // 🔗 គណនីភ្ជាប់ (សម្រាប់ Virtual និង Debit) ឯ Credit ទុកទទេរព្រោះជាវលន់ធនាគារ
    linkedAccount: { type: String, default: "" },
    currency: { type: String, default: "USD" },

    // 💳 សម្រាប់ Credit Card (วงเงิน និងប្រាក់ត្រូវសង)
    creditLimit: { type: Number, default: 1000.0 }, // ទំហំឥណទានចាយមុន
    currentDebt: { type: Number, default: 0.0 }, // ទឹកប្រាក់សរុបដែលត្រូវសងធនាគារ
    billingDueDate: { type: String, default: "" }, // ថ្ងៃត្រូវសងប្រាក់

    // ⚙️ ការកំណត់ និងស្ថានភាព
    isLocked: { type: Boolean, default: false },
    lockedByAdmin: { type: Boolean, default: false },
    isOnlinePayEnabled: { type: Boolean, default: true },
    dailyLimit: { type: Number, default: 500.0 },
    dailyTxCountLimit: { type: Number, default: 10 },
    pin: { type: String, default: "0000" },

    // 📡 NFC & Fulfillment (សម្រាប់ Debit & Credit)
    uid: { type: String, default: null, sparse: true, index: true },
    isPhysical: { type: Boolean, default: false },
    customBgUrl: { type: String, default: "" },

    deliveryStatus: {
      type: String,
      enum: [
        "None",
        "Requested",
        "Printing",
        "Shipped",
        "Delivered",
        "Activated",
      ],
      default: "None",
    },
    deliveryMethod: { type: String, default: "Branch Pickup" },
    trackingNumber: { type: String, default: "" },
    deliveryAddress: { type: String, default: "" },
    deliveryPhone: { type: String, default: "" },
    deliveryUpdatedAt: { type: String, default: "" },

    orderIndex: { type: Number, default: 0 },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Card", cardSchema);
