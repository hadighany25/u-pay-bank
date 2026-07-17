const User = require("../models/User");
const UFund = require("../models/UFund");
const Transaction = require("../models/Transaction");
const cron = require("node-cron");
const moment = require("moment-timezone");
const { getFormattedDate, generateHash, generateRefId } = require("./helpers");

const initCronJobs = () => {
  // ==========================================
  // ១. មុខងារបញ្ចេញប្រាក់ដែលជាប់ Hold ស្វ័យប្រវត្តិ
  // ==========================================
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

  // ==========================================
  // ២. មុខងារថ្មីសម្រាប់ U-Fund (Auto-Deduct)
  // ==========================================
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

                const dateStr = getFormattedDate();
                const refId = generateRefId();
                const hash = generateHash();
                const depositorName = user.fullName || user.username;

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
                  trxMethod: "System Auto",
                });

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

  // ==========================================
  // 🔥 ៣. មុខងារលុបគណនីរួមស្វ័យប្រវត្តិ (Joint Account > 24H)
  // ==========================================
  cron.schedule(
    "0 * * * *", // ដើររៀងរាល់ម៉ោងម្តង (រៀងរាល់នាទីសូន្យ ឧ.ម៉ោង 1:00, 2:00...)
    async () => {
      try {
        const nowMs = Date.now();
        // ស្វែងរកអ្នកប្រើប្រាស់ដែលមានគណនីប្រភេទ Joint
        const users = await User.find({ "subAccounts.accountType": "joint" });
        if (users.length === 0) return;

        let centralBank = await User.findOne({ accountNumber: "888888888" });
        let cbUpdated = false;

        for (let u of users) {
          let userChanged = false;

          // រត់ Loop ត្រលប់ក្រោយ (Backwards) ងាយស្រួលក្នុងការលុប Array ចេញ
          for (let i = u.subAccounts.length - 1; i >= 0; i--) {
            let acc = u.subAccounts[i];

            if (acc.accountType === "joint") {
              // ឆែកមើលថាតើមានសមាជិកណាមួយនៅ "pending" ដែរឬទេ
              let isPending = acc.members.some((m) => m.status === "pending");

              // គណនាម៉ោងដែលបានកន្លងផុតគិតចាប់តាំងពីពេលបង្កើត
              let hoursPassed =
                (nowMs - new Date(acc.createdAt).getTime()) / (1000 * 60 * 60);

              // ប្រសិនបើហួស ២៤ ម៉ោង ហើយនៅតែ Pending
              if (isPending && hoursPassed > 24) {
                const pricePaid = acc.metadata?.pricePaid || 0;
                const refundAmount = pricePaid / 2; // សងត្រលប់ ៥០%

                if (refundAmount > 0 && centralBank) {
                  u.balance += refundAmount;
                  centralBank.balance -= refundAmount;
                  cbUpdated = true;

                  const dateNow = getFormattedDate();
                  const refId = "REF-" + Date.now().toString().slice(-6);
                  const hash = generateHash();

                  // 📝 កត់ត្រាប្រវត្តិទទួលលុយសង 50% ឱ្យម្ចាស់ដើម
                  await Transaction.create({
                    username: u.username,
                    refId: refId,
                    hash: hash,
                    date: dateNow,
                    type: "Joint Account Refund",
                    amount: refundAmount,
                    currency: "USD",
                    senderName: "System",
                    receiverName: u.fullName || u.username,
                    remark: `Refund 50% for Expired Joint Acc: ${acc.accountNumber}`,
                    status: "Success",
                    trxMethod: "System Auto",
                  });

                  // 📝 កត់ត្រាប្រវត្តិកាត់លុយសង ពីធនាគារកណ្តាល
                  await Transaction.create({
                    username: centralBank.username,
                    refId: refId,
                    hash: hash,
                    date: dateNow,
                    type: "Joint Acc Refund Deducted",
                    amount: -refundAmount,
                    currency: "USD",
                    senderName: "System",
                    receiverName: u.fullName || u.username,
                    remark: `Refund 50% to ${u.username} for Expired Joint Acc: ${acc.accountNumber}`,
                    status: "Success",
                    trxMethod: "System Auto",
                  });
                }

                // 🔔 ផ្ញើ Notification ប្រាប់ម្ចាស់ដើមថាផុតកំណត់ហើយ
                if (!u.notifications) u.notifications = [];
                u.notifications.unshift({
                  id: "NOTIF-" + Date.now(),
                  title: "គណនីរួមផុតកំណត់ ⏱️",
                  message: `ការអញ្ជើញគណនីរួមលេខ ${acc.accountNumber} ហួសកំណត់ ២៤ម៉ោង។ ប្រព័ន្ធបានលុបចោល និងបង្វិលប្រាក់ ៥០% ចូលគណនីអ្នកវិញដោយស្វ័យប្រវត្តិ។`,
                  date: getFormattedDate(),
                  isRead: false,
                });

                // 🗑️ លុបគណនីនេះចេញពីប្រព័ន្ធ
                u.subAccounts.splice(i, 1);
                userChanged = true;
              }
            }
          }

          if (userChanged) {
            u.markModified("subAccounts");
            u.markModified("notifications");
            await u.save();
          }
        }

        if (cbUpdated && centralBank) {
          await centralBank.save();
        }
      } catch (err) {
        console.error("❌ Error in Joint Account Auto-Cleanup Job:", err);
      }
    },
    { timezone: "Asia/Phnom_Penh" },
  );
};

module.exports = initCronJobs;
