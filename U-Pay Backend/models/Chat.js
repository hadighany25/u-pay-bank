// ============================================================================
// ឯកសារ: models/Chat.js (Ultra-Compact Telegram Schema - សន្សំទំហំ MongoDB 80%)
// អត្ថន័យ: រក្សាទុកតែ Field ណាដែលមានទិន្នន័យពិតប្រាកដ និងភ្ជាប់តាម User _id
// ============================================================================
const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, index: true },
    // 🆔 ចាប់ស្គាល់គ្នាតាម _id របស់ User (ឬ "ADMIN" សម្រាប់ជំនួយការ)
    senderId: { type: String, required: true, index: true },
    receiverId: { type: String, required: true, index: true },

    // រក្សាទុកសម្រាប់គាំទ្រសារចាស់ៗ (Optional - មិនបង្កើតបើគ្មាន)
    senderAcc: { type: String },
    receiverAcc: { type: String },

    message: { type: String, required: true },
    adminName: { type: String },
    time: { type: String, required: true },
    timestamp: { type: Number, required: true, index: true },
    isRead: { type: Boolean, default: false },

    // Field ខាងក្រោមនេះ នឹងត្រូវបង្កើតក្នុង MongoDB តែពេលណាមានប្រើប្រាស់ប៉ុណ្ណោះ!
    deletedBy: { type: [String], default: undefined },
    reactions: { type: Array, default: undefined },
    replyToId: { type: String },
    forwardedFrom: { type: String },
    forwardedFromId: { type: String },
    isPinned: { type: Boolean },
    isEdited: { type: Boolean },
    editedAt: { type: Number },
    imageUrl: { type: String },
    audioUrl: { type: String },
    fileUrl: { type: String },
    fileName: { type: String },
    fileSize: { type: String },
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
