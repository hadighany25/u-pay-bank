// ============================================================================
// ឯកសារ: models/User.js
// អត្ថន័យ: Schema ស្តង់ដារកម្រិតធនាគារសម្រាប់អ្នកប្រើប្រាស់ (User Profile & Accounts)
// ============================================================================

const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    // ==========================================
    // 👤 ១. ព័ត៌មានគណនីមូលដ្ឋាន (Basic User Info)
    // ==========================================
    id: { type: String, default: () => Date.now().toString() },
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    fullName: { type: String, default: "" },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },

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
    // 👨‍👦 ៣. ការគ្រប់គ្រងកុងកុមារ (Junior Profile Control)
    // ==========================================
    role: { type: String, default: "user" }, // "user", "junior", "admin"
    parentUsername: { type: String, default: null },

    // ==========================================
    // 🛡️ ៤. ការកំណត់ប្រព័ន្ធសុវត្ថិភាពកម្រិតទម្រង់ (Profile Security)
    // ==========================================
    pin: { type: String, default: "1111" },
    pinAttempts: { type: Number, default: 0 },
    profileImage: { type: String, default: "" },
    isFrozen: { type: Boolean, default: false },
    isOnline: { type: Boolean, default: false },

    // ==========================================
    // 📝 ៥. ព័ត៌មាន KYC (Identity Verification)
    // ==========================================
    kycStatus: { type: String, default: "unverified" },
    kycDocument: { type: String, default: "" },
    kycSubmittedAt: { type: String, default: "" },

    // ==========================================
    // 🎧 ៦. ការកំណត់សេវាកម្មអតិថិជន (Customer Support)
    // ==========================================
    needsSupport: { type: Boolean, default: false },
    chatStatus: { type: String, default: "pending" },
    chatSentiment: { type: String, default: "neutral" },
    telegramChatId: { type: String, default: null },
    linkCode: { type: String, default: null },

    // ==========================================
    // 📦 ៧. បញ្ជីទិន្នន័យពាក់ព័ន្ធ (Related Data Arrays)
    // ==========================================
    // ❌ បានលុប `tickets`, `savings`, `deposits`, និង `transactions` ចេញ ដើម្បីអោយ Database ស្រាល និងដើរលឿន!

    // 🌟 ប្រព័ន្ធកត់ត្រាបំណុលទ្វេភាគ (Double-Entry P2P Debt)
    p2pDebts: [
      {
        type: { type: String, enum: ["owe", "lend"], default: "owe" },
        partnerUsername: String,
        partnerName: String,
        amount: Number,
        fundName: String,
        date: String,
        refId: String,
      },
    ],

    // 💳 កាតនិម្មិត (Virtual & Physical Cards)
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
        dailyTxCountLimit: { type: Number },
        linkedAccount: { type: String },
        pin: { type: String },
        lockedByAdmin: { type: Boolean, default: false },
        uid: { type: String, default: null },
        isPhysical: { type: Boolean, default: false },
        customBgUrl: { type: String, default: "" },
      },
    ],

    // 👥 គណនីរង និង គណនីរួម (Sub-Accounts & Joint Accounts)
    subAccounts: [
      {
        accountId: {
          type: String,
          default: () => "SUB_" + Date.now().toString(),
        },
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
        isSystemLocked: { type: Boolean, default: false },
        isHidden: { type: Boolean, default: false },

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

    // ==========================================
    // ⏱️ ៨. កត់ត្រាពេលវេលា និងសកម្មភាព (Timestamps)
    // ==========================================
    lastActive: { type: String, default: "" },
    joinDate: { type: String, default: "" },
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
