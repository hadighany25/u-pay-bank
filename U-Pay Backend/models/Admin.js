// ============================================================================
// ឯកសារ: models/Admin.js
// អត្ថន័យ: Schema ស្តង់ដារសម្រាប់គណនីបុគ្គលិក និងសិទ្ធិគ្រប់គ្រងប្រព័ន្ធ (IAM & RBAC)
// ============================================================================

const mongoose = require("mongoose");

const adminSchema = new mongoose.Schema(
  {
    // ==========================================
    // 👨‍💼 ១. អត្តសញ្ញាណបុគ្គលិក និងព័ត៌មានទំនាក់ទំនង (Staff Identity & Contact)
    // ==========================================
    staffId: { type: String, unique: true, sparse: true, index: true },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    password: { type: String, required: true },
    fullName: { type: String, uppercase: true, trim: true },
    nickname: { type: String, trim: true },
    profileImage: { type: String, default: "" },

    phone: { type: String },
    email: { type: String },
    department: { type: String },
    remarks: { type: String },

    // ==========================================
    // 🪪 ២. បន្ទះឈីបកាតបុគ្គលិក NFC និងស្ថានភាពគណនី (NFC Badge & Status)
    // ==========================================
    nfcUid: { type: String, default: null, sparse: true, index: true },
    isActive: { type: Boolean, default: true },
    role: {
      type: String,
      enum: ["super_admin", "finance_admin", "support_agent", "custom"],
      default: "support_agent",
      index: true,
    },

    // ==========================================
    // 🔐 ៣. សិទ្ធិប្រើប្រាស់ម៉ឺនុយ សកម្មភាព និងម៉ោងធ្វើការ (Granular Permissions)
    // ==========================================
    permissions: {
      customRoleName: { type: String, default: "" },
      workStart: { type: String, default: "00:00" },
      workEnd: { type: String, default: "23:59" },
      menus: {
        users: { type: Boolean, default: true },
        checktrx: { type: Boolean, default: true },
        merchant: { type: Boolean, default: false },
        cashier: { type: Boolean, default: false },
        broadcast: { type: Boolean, default: false },
        fx: { type: Boolean, default: false },
        cards: { type: Boolean, default: false },
        promos: { type: Boolean, default: false },
        kyc: { type: Boolean, default: true },
        tickets: { type: Boolean, default: true },
        chat: { type: Boolean, default: true },
        logs: { type: Boolean, default: false },
      },
      actions: {
        editUser: { type: Boolean, default: false },
        deleteUser: { type: Boolean, default: false },
        freezeUser: { type: Boolean, default: false },
        adjustBal: { type: Boolean, default: false },
        refund: { type: Boolean, default: false },
      },
    },
  },
  { timestamps: true, minimize: true },
);

adminSchema.set("toJSON", {
  virtuals: true,
  transform: function (doc, ret) {
    ret._id = doc._id.toString();
    ret.id = doc._id.toString();
    delete ret.__v;
  },
});

module.exports = mongoose.model("Admin", adminSchema);
