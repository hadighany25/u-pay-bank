const mongoose = require("mongoose");

const adminSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ["super_admin", "finance_admin", "support_agent", "custom"], // 👈 ថែម custom
    default: "support_agent",
  },
  // 🔥 បន្ថែម Object នេះដើម្បីផ្ទុកសិទ្ធិទាំងអស់
  permissions: {
    customRoleName: { type: String, default: "" },
    workStart: { type: String, default: "00:00" },
    workEnd: { type: String, default: "23:59" },
    menus: {
      users: { type: Boolean, default: true },
      checktrx: { type: Boolean, default: true },
      broadcast: { type: Boolean, default: false },
      fx: { type: Boolean, default: false },
      cards: { type: Boolean, default: false },
      kyc: { type: Boolean, default: true },
      tickets: { type: Boolean, default: true },
      chat: { type: Boolean, default: true },
    },
    actions: {
      editUser: { type: Boolean, default: false },
      deleteUser: { type: Boolean, default: false },
      freezeUser: { type: Boolean, default: false },
      adjustBal: { type: Boolean, default: false },
      refund: { type: Boolean, default: false },
    },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Admin", adminSchema);
