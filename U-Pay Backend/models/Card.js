// ============================================================================
// ឯកសារ: models/Card.js
// អត្ថន័យ: Schema ស្តង់ដារសម្រាប់កាតទាំង ៣ ប្រភេទ (Virtual, Debit, Credit - Strict _id Binding & Compact)
// ============================================================================

const mongoose = require("mongoose");

const cardSchema = new mongoose.Schema(
  {
    // ==========================================
    // 👤 ១. ព័ត៌មានម្ចាស់កាត (Owner Identity - Strict _id)
    // ==========================================
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    }, // 🔗 សោរគោលភ្ជាប់ទៅកាន់ User._id ដាច់ខាត
    username: { type: String }, // Snapshot សម្រាប់មើលក្នុង DB
    userCustomId: { type: String }, // Snapshot លេខសម្គាល់ ៨ ខ្ទង់សម្រាប់មើល

    // ==========================================
    // 💳 ២. ព័ត៌មានមូលដ្ឋានរបស់កាត (Core Card Info)
    // ==========================================
    id: { type: String, required: true, unique: true, index: true },
    cardCategory: {
      type: String,
      enum: ["virtual", "debit", "credit"],
      default: "virtual",
    },
    type: { type: String, default: "standard" },
    name: { type: String, default: "STANDARD" },
    number: { type: String, required: true, unique: true, index: true },
    cvv: { type: String, required: true },
    expiry: { type: String, required: true },
    customBgUrl: { type: String }, // បង្កើតតែពេលប្រើកាត Custom VIP

    // ==========================================
    // 🔗 ៣. គណនីភ្ជាប់ និងវង់ប្រាក់ឥណទាន (Account Link & Credit Line)
    // ==========================================
    linkedAccount: { type: String, default: "" },
    currency: { type: String, enum: ["USD", "KHR"], default: "USD" },

    // បង្កើត និងប្រើប្រាស់សម្រាប់តែកាត Credit ប៉ុណ្ណោះ
    creditLimit: { type: Number },
    currentDebt: { type: Number },
    billingDueDate: { type: String },

    // ==========================================
    // 🛡️ ៤. ការកំណត់សុវត្ថិភាព និងដែនកំណត់ចំណាយ (Security & Limits)
    // ==========================================
    isLocked: { type: Boolean, default: false },
    lockedByAdmin: { type: Boolean, default: false },
    isOnlinePayEnabled: { type: Boolean, default: true },
    dailyLimit: { type: Number, default: 500.0 },
    dailyTxCountLimit: { type: Number, default: 10 },
    pin: { type: String, default: "0000" },
    orderIndex: { type: Number, default: 0 },

    // ==========================================
    // 📡 ៥. បន្ទះឈីប NFC និងការដឹកជញ្ជូនកាតរូបវ័ន្ត (Physical Card & NFC Only)
    // ==========================================
    isPhysical: { type: Boolean, default: false },
    uid: { type: String, sparse: true, index: true }, // លេខឈីប NFC (មានតែពេលស្កេនភ្ជាប់)

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
    },
    deliveryMethod: { type: String },
    trackingNumber: { type: String },
    deliveryAddress: { type: String },
    deliveryPhone: { type: String },
    deliveryUpdatedAt: { type: String },
  },
  { timestamps: true, minimize: true },
);

cardSchema.set("toJSON", {
  virtuals: true,
  transform: function (doc, ret) {
    ret._id = doc._id.toString();
    if (!ret.id) ret.id = doc._id.toString();
    delete ret.__v;
  },
});

module.exports = mongoose.model("Card", cardSchema);
