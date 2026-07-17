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
        id: { type: String },
        type: { type: String },
        name: { type: String },
        number: { type: String },
        cvv: { type: String },
        expiry: { type: String },
        isLocked: { type: Boolean, default: false },
        isOnlinePayEnabled: { type: Boolean, default: true },
        dailyLimit: { type: Number },
        linkedAccount: { type: String },
        pin: { type: String },
        lockedByAdmin: { type: Boolean, default: false },
      },
    ],

    // 🔥 កែប្រែថ្មី: បន្ថែមរចនាសម្ព័ន្ធសម្រាប់គាំទ្រ គណនីរួម (Joint Account)
    subAccounts: [
      {
        accountId: { type: String, default: () => Date.now().toString() },
        accountNumber: { type: String },
        accountName: { type: String },
        accountType: { type: String, default: "premium" }, // premium, joint, junior
        balance: { type: Number, default: 0.0 },
        currency: { type: String, default: "USD" },
        isLocked: { type: Boolean, default: false },

        // 👥 សម្រាប់ផ្ទុកសមាជិកក្នុងគណនីរួម (បើជាគណនី premium ធម្មតា Array នេះនឹងនៅទទេ)
        members: [
          {
            username: { type: String },
            role: { type: String, default: "member" }, // ឧ. "co-owner" (ម្ចាស់រួម) ឬ "member" (សមាជិកធម្មតា)
            dailyLimit: { type: Number, default: 0 }, // 0 មានន័យថាគ្មានដែនកំណត់
            spentToday: { type: Number, default: 0 }, // កត់ត្រាលុយដែលបានចាយថ្ងៃនេះ
            lastSpentDate: { type: String, default: "" }, // សម្រាប់ Reset Limit រៀងរាល់ថ្ងៃថ្មី
            status: { type: String, default: "pending" }, // pending (រង់ចាំការយល់ព្រម), active (កំពុងប្រើ)
          },
        ],

        metadata: { type: Object, default: {} },
        createdAt: { type: Date, default: Date.now },
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
