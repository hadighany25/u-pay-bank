// ============================================================================
// ឯកសារ: models/Card.js
// អត្ថន័យ: Schema ដាច់ដោយឡែកសម្រាប់គ្រប់គ្រងកាតនិម្មិត និងកាត NFC (Banking Standard)
// ============================================================================

const mongoose = require("mongoose");

const cardSchema = new mongoose.Schema(
  {
    // 🛡️ សុវត្ថិភាព ៣ ជាន់ ភ្ជាប់ទៅកាន់ម្ចាស់ដើម (User)
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    username: { type: String, required: true, index: true },
    userCustomId: { type: String, required: true }, // ភ្ជាប់ជាមួយ user.id

    // 💳 ព័ត៌មានសម្គាល់កាត
    id: { type: String, required: true, unique: true, index: true }, // ឧ. card_1791963797488
    type: { type: String, default: "standard" },
    name: { type: String, default: "STANDARD" },
    number: { type: String, required: true, unique: true, index: true },
    cvv: { type: String, required: true },
    expiry: { type: String, required: true },

    // 🔗 គណនីដែលភ្ជាប់ជាមួយកាត (ផ្ទុកលេខគណនីពិតប្រាកដ ឧ. 123123123)
    linkedAccount: { type: String, required: true },
    currency: { type: String, default: "USD" }, // USD ឬ KHR

    // ⚙️ ការកំណត់ និងដែនកំណត់ចំណាយ (Limits & Controls)
    isLocked: { type: Boolean, default: false },
    lockedByAdmin: { type: Boolean, default: false },
    isOnlinePayEnabled: { type: Boolean, default: true },
    dailyLimit: { type: Number, default: 500.0 }, // គិតជា USD
    dailyTxCountLimit: { type: Number, default: 10 },
    dailySpentToday: { type: Number, default: 0.0 },
    dailyTxCountToday: { type: Number, default: 0 },
    lastSpentDate: { type: String, default: "" },

    // 📡 សុវត្ថិភាព និង NFC
    pin: { type: String, default: "0000" },
    uid: { type: String, default: null, sparse: true, index: true }, // លេខបន្ទះឈីប NFC
    isPhysical: { type: Boolean, default: false },
    customBgUrl: { type: String, default: "" },

    // 🖐️ សម្រាប់តម្រៀបលំដាប់កាត (Drag & Drop Order)
    orderIndex: { type: Number, default: 0 },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Card", cardSchema);
