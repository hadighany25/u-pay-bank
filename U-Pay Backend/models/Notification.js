// ============================================================================
// ឯកសារ: models/Notification.js
// អត្ថន័យ: Schema សម្រាប់សារជូនដំណឹង (Strict _id Binding)
// ============================================================================

const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    // 🔗 សោរភ្ជាប់ទៅកាន់គណនីអតិថិជន (Foreign Key ប្រើ _id ធានាសុវត្ថិភាព ១០០%)
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    type: { type: String, required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    date: { type: String },

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

notificationSchema.set("toJSON", {
  virtuals: true,
  transform: function (doc, ret) {
    if (!ret.id) ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
  },
});

module.exports = mongoose.model("Notification", notificationSchema);
