// ============================================================================
// ឯកសារ: models/System.js
// អត្ថន័យ: រក្សាទុកការកំណត់សកលរបស់ប្រព័ន្ធ (System Maintenance, FX Rates & Fee Tiers)
// ============================================================================

const mongoose = require("mongoose");

const systemSchema = new mongoose.Schema(
  {
    // ==========================================
    // ⚙️ ១. អត្តសញ្ញាណការកំណត់ និងស្ថានភាពថែទាំប្រព័ន្ធ (Global Maintenance Control)
    // ==========================================
    settingId: {
      type: String,
      default: "GLOBAL_SETTINGS",
      unique: true,
      index: true,
    },
    isSystemFrozen: { type: Boolean, default: false },
    maintenanceMeta: { type: Object, default: {} },
    maintenanceHistory: { type: Array, default: [] },

    // ==========================================
    // 💱 ២. អត្រាប្តូរប្រាក់ផ្លូវការ និងការភ្ជាប់ធនាគារជាតិ (FX Rates & NBC Sync)
    // ==========================================
    fxRates: {
      type: Object,
      default: {
        usdToKhrBuy: 4050,
        usdToKhrSell: 4100,
        autoWeeklySync: true,
        lastNbcSyncAt: null,
        lastModifiedBy: "System",
        multiCurrencies: [],
      },
    },

    // ==========================================
    // 🛡️ ៣. ដែនកំណត់ផ្ទេរប្រាក់ប្រចាំថ្ងៃ និងតារាងកម្រៃសេវា (Transfer Limits & Fee Tiers)
    // ==========================================
    transferLimit: { type: Number, default: 5000 },
    feeTiers: {
      type: Array,
      default: [
        { min: 0, max: 50, fee: 0 },
        { min: 50.01, max: 999999, fee: 0.5 },
      ],
    },
  },
  { timestamps: true, minimize: true },
);

systemSchema.set("toJSON", {
  virtuals: true,
  transform: function (doc, ret) {
    ret._id = doc._id.toString();
    ret.id = doc._id.toString();
    delete ret.__v;
  },
});

module.exports = mongoose.model("System", systemSchema);
