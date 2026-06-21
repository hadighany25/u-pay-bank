const mongoose = require("mongoose");

const systemSchema = new mongoose.Schema({
  settingId: { type: String, default: "GLOBAL_SETTINGS" },
  isSystemFrozen: { type: Boolean, default: false },
  fxRates: { type: Object, default: { usdToKhrBuy: 4050, usdToKhrSell: 4100 } },

  // 🔥 បន្ថែម ២ បន្ទាត់នេះសម្រាប់គ្រប់គ្រងកម្រិត និងសេវា
  transferLimit: { type: Number, default: 5000 }, // លុយអតិបរមាអាចវេរបានក្នុង១ថ្ងៃ
  feeTiers: {
    type: Array,
    default: [
      { min: 0, max: 50, fee: 0 },
      { min: 50.01, max: 999999, fee: 0.5 },
    ],
  },
});

module.exports = mongoose.model("System", systemSchema);
