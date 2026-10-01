// models/Notification.js
const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    // 🔗 សោរភ្ជាប់ទៅកាន់គណនីអតិថិជន (Foreign Key ប្រើ _id ការពារការជាន់ Username)
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    username: { type: String, required: true },

    type: { type: String, required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    date: { type: String },

    // 🌟 ដាក់ fundId នៅខាងក្រៅស្រាប់ងាយស្រួលទាញយក
    fundId: { type: String },
    metadata: { type: Object, default: {} },
    egiftData: { type: Object },

    isRead: { type: Boolean, default: false },
    responseStatus: {
      type: String,
      enum: ["pending", "accepted", "rejected", "opened"],
      default: "pending",
    },
  },
  { timestamps: true },
);

// បំប្លែង _id ទៅជា id ស្វ័យប្រវត្តិពេលបញ្ជូនទៅ Frontend
notificationSchema.set("toJSON", {
  virtuals: true,
  transform: function (doc, ret) {
    if (!ret.id) ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
  },
});

module.exports = mongoose.model("Notification", notificationSchema);
