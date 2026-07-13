const User = require("../models/User");
const UFund = require("../models/UFund"); // បន្ថែមនេះ
const Transaction = require("../models/Transaction");
const cron = require("node-cron"); // បន្ថែមនេះ
const moment = require("moment-timezone"); // បន្ថែមនេះ
const { getFormattedDate, generateHash, generateRefId } = require("./helpers");

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

  // ២. មុខងារថ្មីសម្រាប់ U-Fund (Auto-Deduct)
  cron.schedule(
    "* * * * *",
    async () => {
      try {
        const now = moment().tz("Asia/Phnom_Penh");
        const currentTime = now.format("HH:mm");
        const funds = await UFund.find({ "members.autoDeposit.enabled": true });

        for (let fund of funds) {
          let fundUpdated = false;
          for (let member of fund.members) {
            const auto = member.autoDeposit;
            if (auto.enabled && auto.time === currentTime) {
              const user = await User.findOne({ username: member.username });
              const centralBank = await User.findOne({
                accountNumber: "888888888",
              });

              if (user && centralBank && user.balance >= auto.amount) {
                user.balance -= auto.amount;
                centralBank.balance += auto.amount;
                fund.currentAmount += auto.amount;
                member.contributedAmount += auto.amount;
                member.status = "active";

                await Transaction.create({
                  username: user.username,
                  refId: generateRefId(),
                  hash: generateHash(),
                  date: getFormattedDate(),
                  type: "U-Fund Deposit",
                  amount: -auto.amount,
                  currency: "USD",
                  remark: "Auto Deposit Executed",
                });

                await user.save();
                await centralBank.save();
                fundUpdated = true;
              } else if (user && user.balance < auto.amount) {
                member.status = "overdue";
                fundUpdated = true;
              }
            }
          }
          if (fundUpdated) await fund.save();
        }
      } catch (err) {
        console.error("❌ Error in U-Fund Cron Job:", err);
      }
    },
    { timezone: "Asia/Phnom_Penh" },
  );
};

module.exports = initCronJobs;
