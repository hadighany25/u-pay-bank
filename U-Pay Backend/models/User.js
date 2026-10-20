// ============================================================================
// ឯកសារ: models/User.js
// អត្ថន័យ: Schema ស្តង់ដារកម្រិតធនាគារសម្រាប់អ្នកប្រើប្រាស់ (Strict _id & userId Binding)
// ============================================================================

const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    // ==========================================
    // 👤 ១. ព័ត៌មានគណនីមូលដ្ឋាន (Basic User Info & Immutable IDs)
    // ==========================================
    id: { type: String, default: () => Date.now().toString(), index: true },
    userId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
      default: () => Math.floor(10000000 + Math.random() * 90000000).toString(),
    }, // លេខសម្គាល់អតិថិជន ៨ខ្ទង់ មិនជាន់គ្នា
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
    // 🏦 ២. គណនីចម្បង (Main Accounts - ញែក USD និង KHR ដាច់ពីគ្នា)
    // ==========================================
    mainAccounts: {
      USD: {
        accountId: {
          type: String,
          default: () => "MAIN_USD_" + Date.now().toString(),
        },
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
        accountId: {
          type: String,
          default: () => "MAIN_KHR_" + Date.now().toString(),
        },
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
    // 👨‍👦 ៣. ការគ្រប់គ្រងកុងកុមារ (Junior Profile Control - Strict _id & userId Link)
    // ==========================================
    role: { type: String, default: "user", index: true }, // "user", "junior", "admin"
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    }, // 🔗 ភ្ជាប់ទៅ _id របស់ប៉ាម៉ាក់ផ្ទាល់
    parentUserId: { type: String, default: null, index: true }, // 🔗 ភ្ជាប់ទៅ userId ៨ខ្ទង់របស់ប៉ាម៉ាក់
    parentUsername: { type: String, default: null },
    dailyLimit: { type: Number, default: 20.0 },
    dailySpent: { type: Number, default: 0.0 },

    // ==========================================
    // 🛡️ ៤. ការកំណត់ប្រព័ន្ធសុវត្ថិភាព និងរូបភាព Profile
    // ==========================================
    pin: { type: String, default: "1111" },
    pinAttempts: { type: Number, default: 0 },
    passwordAttempts: { type: Number, default: 0 },
    profileImage: { type: String, default: "" }, // 🖼️ រូបភាពសម្រាប់បង្ហាញលើ Profile (ដាច់ពីរូប KYC)
    isFrozen: { type: Boolean, default: false },
    isOnline: { type: Boolean, default: false },
    resetToken: { type: String, default: null },
    resetTokenExpire: { type: Date, default: null },

    // ==========================================
    // 📝 ៥. ព័ត៌មាន KYC (Identity Verification - រក្សាទុកដាច់ដោយឡែកពី Profile)
    // ==========================================
    kycStatus: { type: String, default: "unverified" },
    kycDocument: { type: String, default: "" }, // រូបអត្តសញ្ញាណប័ណ្ណ ឬ សំបុត្រកំណើតកូន
    kycImage: { type: String, default: "" },
    selfieUrl: { type: String, default: "" }, // 🪪 រូបថតមុខពេលធ្វើ KYC (មិនប្រែប្រួលពេលដូរ Profile ទេ)
    kycSubmittedAt: { type: String, default: "" },
    kycUploadedBy: { type: String, default: "" },
    kycApprovedBy: { type: String, default: "" },
    kycApprovedAt: { type: String, default: "" },
    kycRejectedBy: { type: String, default: "" },
    kycRejectedAt: { type: String, default: "" },
    kycRejectReason: { type: String, default: "" },

    // ==========================================
    // 🎧 ៦. ការកំណត់សេវាកម្មអតិថិជន និងផែនការចំណាយ (Support & Budget)
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
    // 💸 ៧. សេវាកម្ម និងគណនីរង (P2P Debts, Sub-Accounts, Junior Links)
    // ==========================================
    p2pDebts: [
      {
        type: { type: String, enum: ["owe", "lend"], default: "owe" },
        partnerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        partnerUserId: String,
        partnerUsername: String,
        partnerName: String,
        amount: Number,
        fundName: String,
        date: String,
        refId: String,
      },
    ],

    subAccounts: [
      {
        accountId: {
          type: String,
          default: () => "SUB_" + Date.now().toString(),
        },
        // 🔗 សម្រាប់គណនីកូន (Junior) ភ្ជាប់ទៅកាន់ _id និង userId របស់កូនផ្ទាល់
        linkedUserId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          default: null,
        },
        linkedUserCustomId: { type: String, default: null },
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

    // ==========================================
    // ⏱️ ៨. កត់ត្រាពេលវេលា និងសកម្មភាព (Timestamps)
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

// 🛡️ រក្សាទុកទាំង _id, id, និង userId ពេលបោះទៅ Frontend ដើម្បីឱ្យគ្រប់មុខងារចាប់តាម _id បាន ១០០%
userSchema.set("toJSON", {
  virtuals: true,
  transform: function (doc, ret) {
    ret._id = doc._id.toString();
    ret.id = doc._id.toString();
    delete ret.__v;
  },
});

module.exports = mongoose.model("User", userSchema);
