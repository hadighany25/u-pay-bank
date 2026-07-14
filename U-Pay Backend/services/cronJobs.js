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
              // 🔥 បន្ថែម Logic ឆែក Frequency (Daily/Weekly/Monthly) ត្រង់នេះប្រសិនបើបងចង់

              const user = await User.findOne({ username: member.username });
              const centralBank = await User.findOne({
                accountNumber: "888888888",
              });

              if (user && centralBank && user.balance >= auto.amount) {
                // ដំណើរការកាត់លុយ
                user.balance -= auto.amount;
                centralBank.balance += auto.amount;
                fund.currentAmount += auto.amount;
                member.contributedAmount += auto.amount;
                member.status = "active";

                // ត្រៀមទិន្នន័យ វិក្កយបត្រ (Transaction)
                const dateStr = getFormattedDate();
                const refId = generateRefId();
                const hash = generateHash();
                const depositorName = user.fullName || user.username;

                // 🧾 ១. វិក្កយបត្រកាត់លុយ (User) ឱ្យពេញលេញដូចវេរលុយដៃ
                await Transaction.create({
                  username: user.username,
                  refId: refId,
                  hash: hash,
                  date: dateStr,
                  type: "U-Fund Deposit",
                  amount: -auto.amount,
                  currency: "USD",
                  senderName: depositorName,
                  receiverName: `U-Fund: ${fund.name}`,
                  remark: "Auto Deposit Executed",
                  status: "Success",
                  trxMethod: "System Auto", // បញ្ជាក់ថាកាត់ដោយប្រព័ន្ធ
                });

                // 🧾 ២. វិក្កយបត្រទទួលលុយ (Central Bank)
                await Transaction.create({
                  username: centralBank.username,
                  refId: refId,
                  hash: hash,
                  date: dateStr,
                  type: "U-Fund Pool Receive",
                  amount: auto.amount,
                  currency: "USD",
                  senderName: depositorName,
                  receiverName: "U-Pay Central Bank",
                  remark: `Auto Receive for U-Fund: ${fund.name}`,
                  status: "Success",
                  trxMethod: "System Auto",
                });

                // 🔔 ៣. លោតសារ Notification ប្រាប់ User ថាកាត់លុយជោគជ័យ
                if (!user.notifications) user.notifications = [];
                user.notifications.unshift({
                  id:
                    "AUTO-OK-" + Date.now() + Math.floor(Math.random() * 1000),
                  title: "កាត់ប្រាក់ស្វ័យប្រវត្តិជោគជ័យ! ✅",
                  message: `ប្រព័ន្ធបានកាត់ប្រាក់ $${auto.amount.toLocaleString()} បញ្ចូលទៅគម្រោង "${fund.name}" ដោយស្វ័យប្រវត្តិ។`,
                  date: dateStr,
                  isRead: false,
                  type: "ufund_deposit",
                });

                await user.save();
                await centralBank.save();
                fundUpdated = true;
              } else if (user && user.balance < auto.amount) {
                // ❌ លុយមិនគ្រប់ កំណត់ Status ជា "overdue" និងលោតសារប្រាប់
                member.status = "overdue";

                if (!user.notifications) user.notifications = [];
                user.notifications.unshift({
                  id:
                    "AUTO-FAIL-" +
                    Date.now() +
                    Math.floor(Math.random() * 1000),
                  title: "បរាជ័យក្នុងការកាត់ប្រាក់ ❌",
                  message: `ប្រព័ន្ធមិនអាចកាត់ប្រាក់ $${auto.amount} ចូលគម្រោង "${fund.name}" បានទេ ដោយសារសមតុល្យរបស់អ្នកមិនគ្រប់គ្រាន់។`,
                  date: getFormattedDate(),
                  isRead: false,
                  type: "ufund_fail",
                });

                await user.save();
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
