// ============================================================================
// ឯកសារ: models/AdminLog.js
// អត្ថន័យ: កំណត់ត្រាសវនកម្មគ្រប់សកម្មភាពរបស់មន្ត្រីប្រតិបត្តិ (Audit Logs - Strict _id Target)
// ============================================================================

const mongoose = require("mongoose");

const adminLogSchema = new mongoose.Schema(
  {
    // ==========================================
    // 🛡️ ១. មន្ត្រីប្រតិបត្តិ និងសកម្មភាព (Admin Actor & Action)
    // ==========================================
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    }, // 🔗 _id របស់បុគ្គលិក Admin (បើមាន)
    admin: { type: String, required: true, index: true }, // ឈ្មោះបង្ហាញរបស់មន្ត្រី Admin
    action: { type: String, required: true, index: true }, // ប្រភេទសកម្មភាព (ឧ. "Approve KYC", "Refund")

    // ==========================================
    // 🎯 ២. គោលដៅនៃសកម្មភាព និងព័ត៌មានលម្អិត (Target _id & Details)
    // ==========================================
    target: { type: String, index: true }, // 🔗 ផ្ទុក String(User._id) ជាគោលសម្រាប់អតិថិជន
    details: { type: String }, // ខ្លឹមសារលម្អិត (បង្ហាញឈ្មោះពេញរបស់អតិថិជន)
    date: { type: String }, // កាលបរិច្ឆេទម៉ោងខ្មែរសម្រាប់បង្ហាញ
  },
  { timestamps: true, minimize: true },
);

adminLogSchema.set("toJSON", {
  virtuals: true,
  transform: function (doc, ret) {
    ret._id = doc._id.toString();
    ret.id = doc._id.toString();
    delete ret.__v;
  },
});

module.exports = mongoose.model("AdminLog", adminLogSchema);
