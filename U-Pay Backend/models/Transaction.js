const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, index: true }, // សំខាន់! សម្គាល់ថា Transaction នេះជារបស់ User ណា (ម្ចាស់គណនី)
    refId: { type: String },
    hash: { type: String },
    type: { type: String },
    amount: { type: Number },
    currency: { type: String },
    senderName: { type: String },
    senderAcc: { type: String }, // ត្រូវមានមួយនេះ
    receiverAcc: { type: String }, // និងមួយនេះ
    receiverName: { type: String },
    receiverAcc: { type: String },
    trxMethod: { type: String },
    date: { type: String },
    remark: { type: String },
    status: { type: String },
  },
  { timestamps: true },
); // timestamps ជួយកត់ត្រាម៉ោងបង្កើតដោយស្វ័យប្រវត្តិ

module.exports = mongoose.model("Transaction", transactionSchema);
