// ============================================================================
// ឯកសារ: models/System.js
// អត្ថន័យ: រក្សាទុកការកំណត់សកលរបស់ប្រព័ន្ធ (FX Rates, NBC Auto-Sync, Fees & Limits)
// ============================================================================
const mongoose = require("mongoose");

const systemSchema = new mongoose.Schema(
  {
    settingId: { type: String, default: "GLOBAL_SETTINGS" },
    isSystemFrozen: { type: Boolean, default: false },
    maintenanceMeta: { type: Object, default: {} },
    maintenanceHistory: { type: Array, default: [] },

    // 💱 អត្រាប្តូរប្រាក់គោល និងតារាងរូបិយប័ណ្ណអន្តរជាតិទាំង ៨ + កាលបរិច្ឆេទ Sync ធនាគារជាតិ
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

    // 🛡️ ដែនកំណត់ផ្ទេរប្រាក់ប្រចាំថ្ងៃ និងតារាងកម្រៃសេវា (Fees & Limits)
    transferLimit: { type: Number, default: 5000 },
    feeTiers: {
      type: Array,
      default: [
        { min: 0, max: 50, fee: 0 },
        { min: 50.01, max: 999999, fee: 0.5 },
      ],
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("System", systemSchema);
