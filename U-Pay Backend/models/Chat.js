// ============================================================================
// ឯកសារ: models/Chat.js
// អត្ថន័យ: Ultra-Compact Telegram Schema សន្សំទំហំផ្ទុក និងចាប់តាម User _id សុទ្ធសាធ
// ============================================================================

const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema(
  {
    // ==========================================
    // 🆔 ១. អត្តសញ្ញាណសារ និងគូភាគីសន្ទនា (Strict _id Binding)
    // ==========================================
    id: { type: String, required: true, index: true },
    senderId: { type: String, required: true, index: true }, // 🔗 User._id ឬ "ADMIN"
    receiverId: { type: String, required: true, index: true }, // 🔗 User._id ឬ "ADMIN"

    // Snapshot លេខគណនីសម្រាប់មើលងាយស្រួល (បង្កើតតែពេលមានបញ្ជូនមកប៉ុណ្ណោះ)
    senderAcc: { type: String },
    receiverAcc: { type: String },

    // ==========================================
    // 💬 ២. ខ្លឹមសារសារ និងពេលវេលា (Core Message Content)
    // ==========================================
    message: { type: String, required: true },
    adminName: { type: String }, // បង្កើតតែពេលសារចេញពី Admin ឬ Bot
    time: { type: String, required: true },
    timestamp: { type: Number, required: true, index: true },
    isRead: { type: Boolean, default: false },

    // ==========================================
    // 📎 ៣. មុខងារបន្ថែម (Optional Fields - បង្កើតក្នុង DB តែពេលប្រើប្រាស់ប៉ុណ្ណោះ!)
    // ==========================================
    deletedBy: { type: [String], default: undefined },
    reactions: { type: Array, default: undefined },
    replyToId: { type: String },
    forwardedFrom: { type: String },
    forwardedFromId: { type: String },
    isPinned: { type: Boolean },
    isEdited: { type: Boolean },
    editedAt: { type: Number },

    // ឯកសារភ្ជាប់ (Media Attachments)
    imageUrl: { type: String },
    audioUrl: { type: String },
    fileUrl: { type: String },
    fileName: { type: String },
    fileSize: { type: String },

    // កំណត់ម៉ោងលុប ឬ កំណត់ម៉ោងផ្ញើ (Timers & Scheduling)
    autoDeleteTimer: { type: Number },
    expiresAt: { type: Date },
    isScheduled: { type: Boolean },
    scheduledFor: { type: Number },
  },
  { minimize: true, versionKey: false },
);

// លុបសារស្វ័យប្រវត្តិពេលដល់ម៉ោងកំណត់ (TTL Index)
chatSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("Chat", chatSchema);
