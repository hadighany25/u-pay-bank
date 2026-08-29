const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema({
  id: { type: String, required: true },
  senderAcc: { type: String, required: true },
  receiverAcc: { type: String, required: true },
  message: { type: String, required: true },
  adminName: { type: String, default: null },
  time: { type: String, required: true },
  timestamp: { type: Number, required: true },
  isRead: { type: Boolean, default: false },
  deletedBy: { type: [String], default: [] },
  reactions: { type: Array, default: [] },

  replyToId: { type: String, default: null },
  forwardedFrom: { type: String, default: null },
  forwardedFromAcc: { type: String, default: null },
  isPinned: { type: Boolean, default: false },
  isEdited: { type: Boolean, default: false },
  editedAt: { type: Number, default: null },
  imageUrl: { type: String, default: null },
  audioUrl: { type: String, default: null },
  fileUrl: { type: String, default: null },
  fileName: { type: String, default: null },
  fileSize: { type: String, default: null },

  autoDeleteTimer: { type: Number, default: 0 },
  expiresAt: { type: Date, default: null },

  // 🔥 ត្រូវប្រាកដថា Field ទាំង ២ នេះមាន
  isScheduled: { type: Boolean, default: false },
  scheduledFor: { type: Number, default: null },
});

// លុបសារស្វ័យប្រវត្តិ
chatSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("Chat", chatSchema);
