const mongoose = require("mongoose");
require("dotenv").config();

const connectDB = async () => {
  try {
    // ថែម { family: 4 } គឺដើម្បីបង្ខំឱ្យវាប្រើ IPv4 ដែលមិនសូវមានបញ្ហា
    await mongoose.connect(process.env.MONGO_URI, {
      family: 4,
      serverSelectionTimeoutMS: 5000, // កុំឱ្យវារង់ចាំយូរពេកបើគាំង
    });
    console.log("🟢 MongoDB Connected Successfully");
  } catch (err) {
    console.error("🔴 MongoDB Connection Error:", err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
