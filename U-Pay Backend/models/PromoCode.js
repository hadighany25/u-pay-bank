const mongoose = require("mongoose");

const promoCodeSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true }, // ឈ្មោះកូដ (ឧ. NEWYEAR26)
  rewardValue: { type: Number, required: true }, // ចំនួនលុយដែលត្រូវឲ្យ (ឧ. $2.00)
  maxUsage: { type: Number, default: 100 }, // ចំនួនអ្នកអាចប្រើបានអតិបរមា (ឧ. ១០០នាក់)
  usedCount: { type: Number, default: 0 }, // ចំនួនអ្នកដែលបានប្រើរួច
  usedBy: [{ type: String }], // បញ្ជីឈ្មោះអ្នកដែលបានយកលុយហើយ (ការពារកុំឲ្យម្នាក់យកបាន ២ដង)
  expiresAt: { type: Date }, // ថ្ងៃផុតកំណត់
  isActive: { type: Boolean, default: true }, // ស្ថានភាពបិទ/បើក
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("PromoCode", promoCodeSchema);
