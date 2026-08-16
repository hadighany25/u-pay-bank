const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, index: true },
    refId: { type: String },
    hash: { type: String },
    type: { type: String },
    amount: { type: Number },
    currency: { type: String },
    senderName: { type: String },
    senderAcc: { type: String },
    receiverAcc: { type: String }, // 🔥 ជួសជុល: ទុកតែមួយនេះបានហើយ កុំអោយជាន់គ្នា
    receiverName: { type: String },
    trxMethod: { type: String },
    merchantId: { type: String, default: null },
    date: { type: String },
    remark: { type: String },
    status: { type: String },
    // 🟢 ថែម ២ ជួរនេះចូល ដើម្បីឱ្យ Database អនុញ្ញាតឱ្យ Save ទុក
    cardId: { type: String },
    cardNumber: { type: String },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Transaction", transactionSchema);
