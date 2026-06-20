const mongoose = require("mongoose");

const systemSchema = new mongoose.Schema(
  {
    settingId: { type: String, default: "GLOBAL_SETTINGS" },
    isSystemFrozen: { type: Boolean, default: false },
    fxRates: {
      usdToKhrBuy: { type: Number, default: 4050 },
      usdToKhrSell: { type: Number, default: 4100 },
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("System", systemSchema);
