const User = require("../models/User");
const { getFormattedDate, generateHash } = require("./helpers");

const initCronJobs = () => {
  const autoReleaseHold = async () => {
    const now = Date.now();
    try {
      const users = await User.find({
        "transactions.isHold": true,
        "transactions.status": "Pending",
        "transactions.releaseDate": { $lte: now },
      });
      if (users.length === 0) return;
      let merchant = await User.findOne({ accountNumber: "100000004" });
      if (!merchant) return;

      for (let u of users) {
        let userChanged = false;
        u.transactions.forEach((t) => {
          if (
            t.isHold &&
            t.status === "Pending" &&
            t.releaseDate &&
            t.releaseDate <= now
          ) {
            t.status = "Success";
            t.isHold = false;
            const amountToRelease = Math.abs(t.amount);
            merchant.balance += amountToRelease;
            if (!merchant.transactions) merchant.transactions = [];
            merchant.transactions.unshift({
              refId:
                "TRX-" +
                Date.now().toString().slice(-10) +
                "-" +
                Math.floor(Math.random() * 1000),
              hash: generateHash(),
              date: getFormattedDate(),
              type: "Sale Income",
              amount: amountToRelease,
              senderName: t.senderName || "Unknown",
              status: "Success",
            });
            userChanged = true;
          }
        });
        if (userChanged) {
          u.markModified("transactions");
          await u.save();
        }
      }
      merchant.markModified("transactions");
      await merchant.save();
    } catch (err) {
      console.error("❌ Error in autoReleaseHold Job:", err);
    }
  };

  // ឱ្យវាដើររៀងរាល់ ១០ វិនាទី
  setInterval(autoReleaseHold, 10000);
};

module.exports = initCronJobs;
