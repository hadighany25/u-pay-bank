// ============================================================================
// ឯកសារ: models/Otp.js
// អត្ថន័យ: Schema សម្រាប់ផ្ទៀងផ្ទាត់លេខកូដសម្ងាត់ OTP (Auto-Expire TTL 180s)
// ============================================================================

const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema(
  {
    // ==========================================
    // 🔐 ១. អត្តសញ្ញាណអ៊ីមែល និងកូដ OTP (Email & OTP Code)
    // ==========================================
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    }, // 🔗 ភ្ជាប់ទៅ User._id (បើមានគណនីរួចហើយ)
    email: { type: String, required: true, trim: true, index: true },
    otp: { type: String, required: true },

    // ==========================================
    // ⏳ ២. ពេលវេលាបង្កើត និងលុបស្វ័យប្រវត្តិក្រោយ ៣ នាទី (TTL Index)
    // ==========================================
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 180, // លុបចេញពី MongoDB ដោយស្វ័យប្រវត្តិក្រោយ ១៨០ វិនាទី
    },
  },
  { minimize: true, versionKey: false },
);

module.exports = mongoose.model("Otp", otpSchema);
