const mongoose = require("mongoose");

const adminLogSchema = new mongoose.Schema({
  admin: { type: String, required: true }, // ឈ្មោះ Admin ដែលបានធ្វើសកម្មភាព
  action: { type: String, required: true }, // ប្រភេទសកម្មភាព (ឧ. "Refund", "Adjust Balance")
  target: { type: String }, // គោលដៅ (ឧ. ឈ្មោះអតិថិជនដែលត្រូវគេវេរលុយអោយ)
  details: { type: String }, // ព័ត៌មានលម្អិត
  date: { type: String }, // កាលបរិច្ឆេទ
});

module.exports = mongoose.model("AdminLog", adminLogSchema);
