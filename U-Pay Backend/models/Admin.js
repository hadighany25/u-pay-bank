const mongoose = require("mongoose");

const adminSchema = new mongoose.Schema({
  staffId: { type: String, unique: true }, // 🟢 ថ្មី: លេខកូដបុគ្គលិក (ឧ. UPAY-123456)
  fullName: { type: String, uppercase: true }, // 🟢 ថ្មី: ឈ្មោះពេញ (អក្សរធំអូតូ)
  nickname: { type: String }, // 🟢 ថ្មី: ឈ្មោះហៅក្រៅ
  phone: { type: String }, // 🟢 ថ្មី: លេខទូរស័ព្ទ
  email: { type: String }, // 🟢 ថ្មី: អ៊ីមែល
  department: { type: String }, // 🟢 ថ្មី: នាយកដ្ឋាន ឬសាខា
  remarks: { type: String }, // 🟢 ថ្មី: កំណត់ចំណាំរបស់ Admin
  nfcUid: { type: String, default: null }, // 🟢 ថ្មី: លេខកាត NFC សម្រាប់ Log in ឬសន្តិសុខ
  isActive: { type: Boolean, default: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ["super_admin", "finance_admin", "support_agent", "custom"],
    default: "support_agent",
  },
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
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Admin", adminSchema);
