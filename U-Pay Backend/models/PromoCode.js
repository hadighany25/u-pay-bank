// ============================================================================
// ឯកសារ: models/PromoCode.js
// អត្ថន័យ: Schema ស្តង់ដារសម្រាប់គ្រប់គ្រងកូដប្រូម៉ូសិន និងរង្វាន់ (Strict _id Tracking)
// ============================================================================

const mongoose = require("mongoose");

const promoCodeSchema = new mongoose.Schema(
  {
    // ==========================================
    // 🎟️ ១. ព័ត៌មានកូដប្រូម៉ូសិន និងទឹកប្រាក់រង្វាន់ (Promo Code & Reward)
    // ==========================================
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    rewardValue: { type: Number, required: true, min: 0.01 },
    maxUsage: { type: Number, default: 100 },
    usedCount: { type: Number, default: 0 },

    // ==========================================
    // 👥 ២. បញ្ជីអតិថិជនដែលបានប្រើប្រាស់រួច (រក្សាទុកតាម User _id ការពារការប្រើស្ទួន)
    // ==========================================
    usedBy: [{ type: String }], // 🔗 ផ្ទុក String(User._id) ជាគោល

    // ==========================================
    // ⏳ ៣. សុពលភាព និងស្ថានភាព (Expiration & Status)
    // ==========================================
    expiresAt: { type: Date }, // បង្កើតតែពេលមានកំណត់ថ្ងៃផុតកំណត់
    isActive: { type: Boolean, default: true },
    createdByAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    }, // 🔗 _id របស់ Admin ដែលបង្កើតកូដនេះ (បើមាន)
  },
  { timestamps: true, minimize: true },
);

promoCodeSchema.set("toJSON", {
  virtuals: true,
  transform: function (doc, ret) {
    ret._id = doc._id.toString();
    ret.id = doc._id.toString();
    delete ret.__v;
  },
});

module.exports = mongoose.model("PromoCode", promoCodeSchema);
