// migrate-transactions.js
require("dotenv").config(); // សម្រាប់ទាញយក process.env.MONGO_URI
const mongoose = require("mongoose");

// ==========================================
// ១. ភ្ជាប់ទៅកាន់ Database
// ==========================================
const MONGODB_URI = process.env.MONGO_URI || "mongodb://localhost:27017/umall";

// បង្កើត Schema ដោយផ្ទាល់ដើម្បីកុំអោយពិបាកហៅពី folder ផ្សេង (ការពារកំហុស)
const UserSchema = new mongoose.Schema({}, { strict: false });
const User = mongoose.model("User", UserSchema);

const TransactionSchema = new mongoose.Schema({}, { strict: false });
const Transaction = mongoose.model("Transaction", TransactionSchema);

async function runMigration() {
  try {
    console.log("🔗 កំពុងតភ្ជាប់ទៅកាន់ MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("✅ ភ្ជាប់ជោគជ័យ! ចាប់ផ្ដើមដំណើរការ Update ទិន្នន័យចាស់...\n");

    // ==========================================
    // ២. ទាញយកតែ Transaction ណាដែលមិនទាន់មាន userId
    // ==========================================
    const oldTransactions = await Transaction.find({
      userId: { $exists: false },
    });
    console.log(
      `🔍 រកឃើញទិន្នន័យចាស់ចំនួន ${oldTransactions.length} ដែលត្រូវការ Update។`,
    );

    let successCount = 0;
    let failCount = 0;

    // ==========================================
    // ៣. រត់ Loop កាត់ Transaction ម្ដងមួយៗ (Batch Update)
    // ==========================================
    for (let i = 0; i < oldTransactions.length; i++) {
      const txn = oldTransactions[i];

      if (!txn.username) {
        console.log(`⚠️ រំលង Transaction ID: ${txn._id} (គ្មាន Username)`);
        failCount++;
        continue;
      }

      // ៤. ស្វែងរកម្ចាស់គណនី (User) ផ្អែកលើ username នៅក្នុង Transaction នោះ
      const user = await User.findOne({ username: txn.username });

      if (user) {
        // ៥. បើរកឃើញ Update Transaction នោះដោយបញ្ចូល userId (ObjectId)
        await Transaction.updateOne(
          { _id: txn._id },
          { $set: { userId: user._id } },
        );
        successCount++;
        // console.log(`✅ Update ជោគជ័យ: Transaction ${txn._id} -> ភ្ជាប់ទៅអ្នកប្រើ ${user.username}`);
      } else {
        // ករណី User ត្រូវបានលុបពី Database បាត់ហើយ
        console.log(
          `❌ បរាជ័យ: រកមិនឃើញអ្នកប្រើឈ្មោះ "${txn.username}" សម្រាប់ Transaction ${txn._id} ទេ!`,
        );
        failCount++;
      }
    }

    // ==========================================
    // ៦. បញ្ចប់ប្រតិបត្តិការ
    // ==========================================
    console.log("\n🎉 ដំណើរការ Patching ត្រូវបានបញ្ចប់!");
    console.log(`🟢 ជោគជ័យសរុប: ${successCount} Records`);
    console.log(`🔴 បរាជ័យ ឬរំលង: ${failCount} Records`);
  } catch (error) {
    console.error("❌ មានកំហុសក្នុងការ Migration:", error);
  } finally {
    // បិទការភ្ជាប់ Database វិញបន្ទាប់ពីចប់ការងារ
    await mongoose.disconnect();
    console.log("🔌 Database ត្រូវបានផ្ដាច់! សូមអរគុណ។");
    process.exit(0);
  }
}

// ហៅមុខងារអោយដំណើរការ
runMigration();
