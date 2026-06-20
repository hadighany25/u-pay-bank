const mongoose = require("mongoose");

const ChatSchema = new mongoose.Schema({
  id: String,
  senderAcc: String,
  receiverAcc: String,
  message: String,
  adminName: String,
  time: String,
  timestamp: Number,
  isRead: Boolean,
  deletedBy: { type: Array, default: [] },
});

module.exports = mongoose.model("Chat", ChatSchema);
