const mongoose = require("mongoose");

const jointAccountSchema = new mongoose.Schema(
  {
    // accountId នេះគឺជាកូនសោរ (Foreign Key) សម្រាប់ភ្ជាប់ទៅកាន់ accountId នៅក្នុង User.subAccounts
    accountId: { type: String, required: true, unique: true },
    accountNumber: { type: String, required: true, unique: true },
    accountName: { type: String, required: true },

    // 🔥 នេះគឺជាធុងលុយកណ្តាល (Single Source of Truth)
    balance: { type: Number, default: 0.0 },
    currency: { type: String, default: "USD" },
    isLocked: { type: Boolean, default: false },

    // 👥 សមាជិកពិតប្រាកដទាំងអស់ (រួមទាំង Owner ផងដែរ) នឹងត្រូវរក្សាទុកនៅទីនេះ
    members: [
      {
        username: { type: String, required: true },
        role: { type: String, default: "member" }, // ឧ. "owner", "co-owner", ឬ "member"
        dailyLimit: { type: Number, default: 0 }, // 0 មានន័យថាគ្មានដែនកំណត់
        spentToday: { type: Number, default: 0 },
        lastSpentDate: { type: String, default: "" },
        status: { type: String, default: "pending" }, // pending, active, rejected
      },
    ],

    metadata: { type: Object, default: {} },
  },
  { timestamps: true },
);

// ផ្លាស់ប្តូរ _id ឱ្យទៅជា id អូតូពេលបោះទៅ Frontend
jointAccountSchema.set("toJSON", {
  virtuals: true,
  transform: function (doc, ret) {
    if (!ret.id) ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
  },
});

module.exports = mongoose.model("JointAccount", jointAccountSchema);
