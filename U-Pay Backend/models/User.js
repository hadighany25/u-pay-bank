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

    // 🔥 Sub-Accounts
    subAccounts: [
      {
        accountId: { type: String, default: () => Date.now().toString() },
        accountNumber: { type: String },
        accountName: { type: String },
        accountType: { type: String, default: "premium" }, // premium, joint, junior

        // ចំណាំ៖ balance នេះនឹងប្រើសម្រាប់តែគណនី premium ប៉ុណ្ណោះ
        // បើជាគណនី joint យើងនឹងទាញយកលុយពី JointAccount Collection វិញ
        balance: { type: Number, default: 0.0 },
        currency: { type: String, default: "USD" },
        isLocked: { type: Boolean, default: false },

        // ក្រុមសមាជិកនេះនៅរក្សាទុក ដើម្បីកុំឱ្យ Error កូដ Frontend ចាស់
        // តែទិន្នន័យពិតប្រាកដសម្រាប់គណនីរួម គឺស្ថិតនៅ JointAccount
        members: [
          {
            username: { type: String },
            role: { type: String, default: "member" },
            dailyLimit: { type: Number, default: 0 },
            spentToday: { type: Number, default: 0 },
            lastSpentDate: { type: String, default: "" },
            status: { type: String, default: "pending" },
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
