// ============================================================================
// ឯកសារ: models/User.js
// អត្ថន័យ: Schema ស្តង់ដារកម្រិតធនាគារសម្រាប់អ្នកប្រើប្រាស់ (Strict _id Binding)
// ============================================================================

const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    // ==========================================
    // 👤 ១. ព័ត៌មានគណនីមូលដ្ឋាន (Basic User Info)
    // ==========================================
    userId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
      default: () => Math.floor(10000000 + Math.random() * 90000000).toString(),
    }, // លេខសម្គាល់អតិថិជន ៨ខ្ទង់ សម្រាប់បង្ហាញ (Display ID)
    username: { type: String, required: true, unique: true, index: true },
    password: { type: String, required: true },
    fullName: { type: String, default: "" },

    dob: { type: String, default: "" },
    gender: { type: String, default: "" },
    idNumber: { type: String, default: "" },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
    referredBy: { type: String, default: "" },
    duplicateIdReason: { type: String, default: "" },

    // ==========================================
    // 🏦 ២. គណនីចម្បង (Main Accounts - USD & KHR)
    // ==========================================
    mainAccounts: {
      USD: {
        accountId: { type: String, default: () => "MAIN_USD_" + Date.now() },
        accountNumber: { type: String, unique: true, sparse: true },
        accountName: { type: String, default: "Main Account USD" },
        accountType: { type: String, default: "main" },
        currency: { type: String, default: "USD" },
        balance: { type: Number, default: 0.0 },
        holdBalance: { type: Number, default: 0.0 },
        dailyLimit: { type: Number, default: 1000.0 },
        dailySpent: { type: Number, default: 0.0 },
        lastSpentDate: { type: String, default: "" },
        isFrozen: { type: Boolean, default: false },
        isSystemLocked: { type: Boolean, default: false },
        isHidden: { type: Boolean, default: false },
      },
      KHR: {
        accountId: { type: String, default: () => "MAIN_KHR_" + Date.now() },
        accountNumber: { type: String, unique: true, sparse: true },
        accountName: { type: String, default: "Main Account KHR" },
        accountType: { type: String, default: "main" },
        currency: { type: String, default: "KHR" },
        balance: { type: Number, default: 0.0 },
        holdBalance: { type: Number, default: 0.0 },
        dailyLimit: { type: Number, default: 4000000.0 },
        dailySpent: { type: Number, default: 0.0 },
        lastSpentDate: { type: String, default: "" },
        isFrozen: { type: Boolean, default: false },
        isSystemLocked: { type: Boolean, default: false },
        isHidden: { type: Boolean, default: false },
      },
    },

    // ==========================================
    // 👨‍👦 ៣. ការគ្រប់គ្រងកុងកុមារ (Junior Profile Control)
    // ==========================================
    role: { type: String, default: "user", index: true }, // "user", "junior", "admin"
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    }, // 🔗 ភ្ជាប់ទៅ _id របស់ប៉ាម៉ាក់ផ្ទាល់
    dailyLimit: { type: Number, default: 20.0 },
    dailySpent: { type: Number, default: 0.0 },

    // ==========================================
    // 🛡️ ៤. ប្រព័ន្ធសុវត្ថិភាព និងរូបភាព
    // ==========================================
    pin: { type: String, default: "1111" },
    pinAttempts: { type: Number, default: 0 },
    passwordAttempts: { type: Number, default: 0 },
    profileImage: { type: String, default: "" },
    isFrozen: { type: Boolean, default: false },
    isOnline: { type: Boolean, default: false },
    resetToken: { type: String, default: null },
    resetTokenExpire: { type: Date, default: null },

    // ==========================================
    // 📝 ៥. ព័ត៌មាន KYC (Identity Verification)
    // ==========================================
    kycStatus: { type: String, default: "unverified" },
    kycDocument: { type: String, default: "" },
    kycImage: { type: String, default: "" },
    selfieUrl: { type: String, default: "" },
    kycSubmittedAt: { type: String, default: "" },
    kycUploadedBy: { type: String, default: "" },
    kycApprovedBy: { type: String, default: "" },
    kycApprovedAt: { type: String, default: "" },
    kycRejectedBy: { type: String, default: "" },
    kycRejectedAt: { type: String, default: "" },
    kycRejectReason: { type: String, default: "" },

    // ==========================================
    // 🎧 ៦. សេវាកម្មអតិថិជន និងសំណូមពរ (Support & Tickets)
    // ==========================================
    needsSupport: { type: Boolean, default: false },
    chatStatus: { type: String, default: "pending" },
    chatSentiment: { type: String, default: "neutral" },
    telegramChatId: { type: String, default: null },
    linkCode: { type: String, default: null },
    budgetSettings: { type: Object, default: {} },

    tickets: [
      {
        ticketId: { type: String, default: () => "TCK-" + Date.now() },
        subject: { type: String, required: true },
        priority: { type: String, default: "Normal" },
        message: { type: String, required: true },
        description: { type: String },
        status: { type: String, default: "Pending" },
        adminReply: { type: String, default: "" },
        repliedBy: { type: String, default: "" },
        repliedAt: { type: String, default: "" },
        date: { type: String, default: () => new Date().toLocaleString() },
        createdAt: { type: Date, default: Date.now },
      },
    ],

    // ==========================================
    // 💸 ៧. គណនីរង និងសេវាកម្មរួម (Sub-Accounts & P2P Debts)
    // ==========================================
    p2pDebts: [
      {
        type: { type: String, enum: ["owe", "lend"], default: "owe" },
        partnerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        amount: Number,
        fundName: String,
        date: String,
        refId: String,
      },
    ],

    subAccounts: [
      {
        accountId: { type: String, default: () => "SUB_" + Date.now() },
        linkedUserId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          default: null,
        }, // 🔗 ភ្ជាប់ទៅ _id របស់កូន
        accountNumber: { type: String },
        accountName: { type: String },
        accountType: { type: String, default: "premium" },
        currency: { type: String, default: "USD" },
        balance: { type: Number, default: 0.0 },
        holdBalance: { type: Number, default: 0.0 },
        dailyLimit: { type: Number, default: 1000.0 },
        dailySpent: { type: Number, default: 0.0 },
        lastSpentDate: { type: String, default: "" },
        isFrozen: { type: Boolean, default: false },
        isLocked: { type: Boolean, default: false },
        isSystemLocked: { type: Boolean, default: false },
        isHidden: { type: Boolean, default: false },
        members: [
          {
            userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
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

    // ==========================================
    // ⏱️ ៨. កត់ត្រាពេលវេលា និងឧបករណ៍ (Timestamps & Devices)
    // ==========================================
    lastActive: { type: String, default: "" },
    joinDate: { type: String, default: "" },
    forceLogout: { type: Boolean, default: false },
    lastIp: { type: String, default: "" },
    lastDevice: { type: String, default: "" },
    lastLogin: { type: String, default: "" },
    connectedDevices: { type: Array, default: [] },
  },
  { timestamps: true },
);

userSchema.set("toJSON", {
  virtuals: true,
  transform: function (doc, ret) {
    ret._id = doc._id.toString();
    ret.id = doc._id.toString();
    delete ret.__v;
  },
});

module.exports = mongoose.model("User", userSchema);
