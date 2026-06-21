const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    id: { type: String, default: () => Date.now().toString() },
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    fullName: { type: String, default: "" },
    phone: { type: String, default: "" },
    pin: { type: String, default: "1111" },
    accountNumber: { type: String, unique: true },
    accountNumberKHR: { type: String, unique: true },
    balance: { type: Number, default: 0.0 },
    balanceKHR: { type: Number, default: 0.0 },
    role: { type: String, default: "user" },
    trxLimit: { type: Number, default: 1000.0 },
    profileImage: { type: String, default: "" },
    isFrozen: { type: Boolean, default: false },
    isOnline: { type: Boolean, default: false },
    pinAttempts: { type: Number, default: 0 },
    transactions: { type: Array, default: [] },
    notifications: { type: Array, default: [] },
    tickets: { type: Array, default: [] },
    savings: { type: Array, default: [] },
    deposits: { type: Array, default: [] },
    kycStatus: { type: String, default: "unverified" },
    kycDocument: { type: String, default: "" },
    kycSubmittedAt: { type: String, default: "" },
    needsSupport: { type: Boolean, default: false },
    telegramChatId: { type: String, default: null },
    linkCode: { type: String, default: null },
    lastActive: { type: String, default: "" },
    joinDate: { type: String, default: "" },
    suspiciousActivities: { type: Array, default: [] },
    virtualCards: [
      {
        id: String,
        type: String,
        name: String,
        number: String,
        cvv: String,
        expiry: String,
        isLocked: { type: Boolean, default: false },
        isOnlinePayEnabled: { type: Boolean, default: true },
        dailyLimit: Number,
        linkedAccount: String,
        pin: String,
        // 👇 ត្រូវបន្ថែមបន្ទាត់នេះដាច់ខាត ទើបអតិថិជនបើកកាតវិញមិនកើត (បងធ្វើត្រូវហើយ!)
        lockedByAdmin: { type: Boolean, default: false },
      },
    ],
  },
  { timestamps: true },
);

// ផ្លាស់ប្តូរ _id ឱ្យទៅជា id អូតូពេលបោះទៅ Frontend
userSchema.set("toJSON", {
  virtuals: true,
  transform: function (doc, ret) {
    if (!ret.id) ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
  },
});

module.exports = mongoose.model("User", userSchema);
