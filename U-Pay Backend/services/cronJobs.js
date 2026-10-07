// ឯកសារ: services/cronJobs.js

const User = require("../models/User");
const UFund = require("../models/UFund");
const Transaction = require("../models/Transaction");
const Payroll = require("../models/Payroll");
const Notification = require("../models/Notification"); // 🌟 ថែមបន្ទាត់នេះចូល! 🌟
const { executePayroll } = require("./payrollProcessor");
const cron = require("node-cron");
const moment = require("moment-timezone");
const { getFormattedDate, generateHash, generateRefId } = require("./helpers");

const initCronJobs = () => {
  // ==========================================
  // ១. មុខងារបញ្ចេញប្រាក់ដែលជាប់ Hold ស្វ័យប្រវត្តិ
  // ប្រើប្រាស់: Central Bank Main Account (888888888)
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

      // 🌟 ប្រើប្រាស់ Central Bank Main Account
      let centralBank = await User.findOne({
        "mainAccounts.USD.accountNumber": "888888888",
      });
      if (!centralBank) return;

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

            // 🌟 បញ្ចេញលុយចូល Main Account របស់ Central Bank
            if (centralBank.mainAccounts?.USD) {
              centralBank.mainAccounts.USD.balance += amountToRelease;
            } else {
              centralBank.balance += amountToRelease;
            }

            if (!centralBank.transactions) centralBank.transactions = [];
            centralBank.transactions.unshift({
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
      centralBank.markModified("transactions");
      await centralBank.save();
    } catch (err) {
      console.error("❌ Error in autoReleaseHold Job:", err);
    }
  };
  setInterval(autoReleaseHold, 10000);

  // ==========================================
  // ២. មុខងារកាត់ប្រាក់ U-Fund (Auto-Deduct & 🌟 Fair Share Cap)
  // ប្រើប្រាស់: Sub-Account (Central Bank U-Fund Pool - 888000555)
  // ==========================================
  cron.schedule(
    "* * * * *",
    async () => {
      try {
        const now = moment().tz("Asia/Phnom_Penh");
        const currentTime = now.format("HH:mm");
        const funds = await UFund.find({ "members.autoDeposit.enabled": true });

        for (let fund of funds) {
          if (fund.currentAmount >= fund.targetAmount) continue;

          let fundUpdated = false;
          let roundDeductAmount = 0;
          const dateStr = getFormattedDate();

          const activeCount = fund.members.filter(
            (m) => m.status !== "pending",
          ).length;
          const fairShare = fund.targetAmount / (activeCount || 1);

          for (let member of fund.members) {
            const auto = member.autoDeposit;
            if (member.status === "pending") continue;

            if (auto.enabled && auto.time === currentTime) {
              if (member.contributedAmount >= fairShare) continue;

              let deductAmount = auto.amount;
              if (member.contributedAmount + deductAmount > fairShare) {
                deductAmount = fairShare - member.contributedAmount;
              }
              deductAmount = Math.round(deductAmount * 100) / 100;

              if (deductAmount <= 0) continue;

              const user = await User.findOne({ username: member.username });
              const centralBank = await User.findOne({
                "mainAccounts.USD.accountNumber": "888888888",
              });

              const userUsdBal = user?.mainAccounts?.USD?.balance || 0;

              if (user && centralBank && userUsdBal >= deductAmount) {
                // 🌟 រកមើល Sub-Account 888000555 របស់ Central Bank
                const cbUfundAcc = centralBank.subAccounts.find(
                  (acc) => acc.accountNumber === "888000555",
                );

                if (cbUfundAcc) {
                  user.mainAccounts.USD.balance -= deductAmount;
                  cbUfundAcc.balance += deductAmount; // 🌟 បូកចូល U-Fund Pool
                  centralBank.markModified("subAccounts");

                  fund.currentAmount += deductAmount;
                  member.contributedAmount += deductAmount;

                  if (roundDeductAmount < deductAmount)
                    roundDeductAmount = deductAmount;

                  const refId = generateRefId();
                  const hash = generateHash();
                  const depositorName = user.fullName || user.username;

                  await Transaction.create({
                    userId: user._id,
                    username: user.username,
                    refId: refId,
                    hash: hash,
                    date: dateStr,
                    type: "U-Fund Deposit",
                    amount: -deductAmount,
                    currency: "USD",
                    senderName: depositorName,
                    receiverName: `U-Fund: ${fund.name}`,
                    senderAcc: user.mainAccounts?.USD?.accountNumber,
                    remark: "Auto Deposit Executed",
                    status: "Success",
                    trxMethod: "System Auto",
                  });

                  await Transaction.create({
                    userId: centralBank._id,
                    username: centralBank.username,
                    refId: refId,
                    hash: hash,
                    date: dateStr,
                    type: "U-Fund Pool Receive",
                    amount: deductAmount,
                    currency: "USD",
                    senderName: depositorName,
                    receiverName: "U-Pay Central Bank",
                    receiverAcc: "888000555", // 🌟 កត់ត្រាចូលលេខកុង U-Fund Pool
                    remark: `Auto Receive for U-Fund: ${fund.name}`,
                    status: "Success",
                    trxMethod: "System Auto",
                  });

                  await Notification.create({
                    userId: user._id,
                    username: user.username,
                    title: "កាត់ប្រាក់ស្វ័យប្រវត្តិជោគជ័យ! ✅",
                    message: `ប្រព័ន្ធបានកាត់ប្រាក់ $${deductAmount} បញ្ចូលទៅគម្រោង "${fund.name}" ដោយស្វ័យប្រវត្តិ។`,
                    date: dateStr,
                    type: "ufund_deposit",
                    isRead: false,
                  });

                  const isTargetReachedNow =
                    fund.currentAmount >= fund.targetAmount;
                  if (isTargetReachedNow) {
                    fund.members = fund.members.filter(
                      (m) => m.status !== "pending",
                    );
                    for (let m of fund.members) {
                      const notifyUser =
                        m.username === user.username
                          ? user
                          : await User.findOne({ username: m.username });
                      if (notifyUser) {
                        await Notification.create({
                          userId: notifyUser._id,
                          username: notifyUser.username,
                          title: "គោលដៅត្រូវបានសម្រេច! 🎉",
                          message: `អបអរសាទរ! គម្រោង "${fund.name}" ប្រមូលប្រាក់បានគ្រប់ចំនួនហើយ។ ប្រព័ន្ធនឹងបញ្ឈប់ការកាត់ប្រាក់!`,
                          date: dateStr,
                          type: "ufund_success",
                          isRead: false,
                        });
                      }
                    }
                  }

                  await user.save();
                  await centralBank.save();
                  fundUpdated = true;
                } else {
                  console.error(
                    "❌ មិនអាចកាត់លុយបាន ព្រោះរកកុង 888000555 មិនឃើញ",
                  );
                }
              } else if (user && userUsdBal < deductAmount) {
                member.status = "overdue";
                member.debtAmount = (member.debtAmount || 0) + deductAmount;

                if (!member.overdueSince) member.overdueSince = new Date();

                await Notification.create({
                  userId: user._id,
                  username: user.username,
                  title: "បរាជ័យក្នុងការកាត់ប្រាក់ ❌",
                  message: `ប្រព័ន្ធមិនអាចកាត់ប្រាក់ $${deductAmount} ចូលគម្រោង "${fund.name}" បានទេ។ ទឹកប្រាក់នេះត្រូវបានបូកបញ្ចូលជាបំណុល!`,
                  date: dateStr,
                  type: "ufund_fail",
                  isRead: false,
                });

                const adminUser = await User.findOne({
                  username: fund.creator,
                });
                if (adminUser && adminUser.username !== user.username) {
                  await Notification.create({
                    userId: adminUser._id,
                    username: adminUser.username,
                    title: "កូនក្រុមខកខានបង់ប្រាក់ ⚠️",
                    message: `សមាជិក ${user.fullName || user.username} មិនមានប្រាក់គ្រប់គ្រាន់សម្រាប់កាត់ស្វ័យប្រវត្តិចូលគម្រោង "${fund.name}" ទេ។`,
                    date: dateStr,
                    type: "ufund_fail",
                    isRead: false,
                  });
                }
                fundUpdated = true;
              }
            }
          }

          if (roundDeductAmount > 0) {
            fund.baseContribution =
              (fund.baseContribution || 0) + roundDeductAmount;
            fundUpdated = true;
          }

          if (fundUpdated) {
            fund.markModified("members");
            await fund.save();
          }
        }
      } catch (err) {
        console.error("❌ Error in U-Fund Auto-Deduct Job:", err);
      }
    },
    { timezone: "Asia/Phnom_Penh" },
  );

  // ==========================================
  // ៣. មុខងារលុបគណនីរួមស្វ័យប្រវត្តិ (Joint Account > 24H)
  // ប្រើប្រាស់: Sub-Account (Central Bank Fee Income - 888000999)
  // ==========================================
  cron.schedule(
    "0 * * * *",
    async () => {
      try {
        const nowMs = Date.now();
        const users = await User.find({ "subAccounts.accountType": "joint" });
        if (users.length === 0) return;

        let centralBank = await User.findOne({
          "mainAccounts.USD.accountNumber": "888888888",
        });
        let cbUpdated = false;

        for (let u of users) {
          let userChanged = false;

          for (let i = u.subAccounts.length - 1; i >= 0; i--) {
            let acc = u.subAccounts[i];

            if (acc.accountType === "joint") {
              let isPending = acc.members.some((m) => m.status === "pending");
              let hoursPassed =
                (nowMs - new Date(acc.createdAt).getTime()) / (1000 * 60 * 60);

              if (isPending && hoursPassed > 24) {
                const pricePaid = acc.metadata?.pricePaid || 0;
                const refundAmount = pricePaid / 2;

                if (refundAmount > 0 && centralBank) {
                  // 🌟 រកមើល Sub-Account 888000999 (Fee Income)
                  const cbFeeAcc = centralBank.subAccounts.find(
                    (a) => a.accountNumber === "888000999",
                  );

                  if (cbFeeAcc) {
                    u.mainAccounts.USD.balance += refundAmount;
                    cbFeeAcc.balance -= refundAmount; // 🌟 ដកលុយពី Fee Income វិញ ៥០%
                    cbUpdated = true;

                    const dateNow = getFormattedDate();
                    const refId = "REF-" + Date.now().toString().slice(-6);
                    const hash = generateHash();

                    await Transaction.create({
                      userId: u._id,
                      username: u.username,
                      refId: refId,
                      hash: hash,
                      date: dateNow,
                      type: "Joint Account Refund",
                      amount: refundAmount,
                      currency: "USD",
                      senderName: "System",
                      receiverName: u.fullName || u.username,
                      senderAcc: "888000999",
                      remark: `Refund 50% for Expired Joint Acc: ${acc.accountNumber}`,
                      status: "Success",
                      trxMethod: "System Auto",
                    });

                    await Transaction.create({
                      userId: centralBank._id,
                      username: centralBank.username,
                      refId: refId,
                      hash: hash,
                      date: dateNow,
                      type: "Joint Acc Refund Deducted",
                      amount: -refundAmount,
                      currency: "USD",
                      senderName: "System",
                      receiverName: u.fullName || u.username,
                      senderAcc: "888000999", // 🌟 កត់ត្រាចូលកុង Fee
                      remark: `Refund 50% to ${u.username} for Expired Joint Acc: ${acc.accountNumber}`,
                      status: "Success",
                      trxMethod: "System Auto",
                    });
                  }
                }

                await Notification.create({
                  userId: u._id,
                  username: u.username,
                  title: "គណនីរួមផុតកំណត់ ⏱️",
                  message: `ការអញ្ជើញគណនីរួមលេខ ${acc.accountNumber} ហួសកំណត់ ២៤ម៉ោង។ ប្រព័ន្ធបានលុបចោល និងបង្វិលប្រាក់ ៥០% ចូលគណនីអ្នកវិញដោយស្វ័យប្រវត្តិ។`,
                  date: getFormattedDate(),
                  type: "info",
                  isRead: false,
                });

                u.subAccounts.splice(i, 1);
                userChanged = true;
              }
            }
          }

          if (userChanged) {
            u.markModified("subAccounts");
            await u.save();
          }
        }

        if (cbUpdated && centralBank) {
          centralBank.markModified("subAccounts");
          await centralBank.save();
        }
      } catch (err) {
        console.error("❌ Error in Joint Account Auto-Cleanup Job:", err);
      }
    },
    { timezone: "Asia/Phnom_Penh" },
  );

  // ==========================================
  // ៤. មុខងារទូទាត់បំណុលស្វ័យប្រវត្តិ (Auto-Retry Overdue)
  // ប្រើប្រាស់: Sub-Account (Central Bank U-Fund Pool - 888000555)
  // ==========================================
  cron.schedule("*/5 * * * *", async () => {
    try {
      const funds = await UFund.find({ "members.status": "overdue" });
      const centralBank = await User.findOne({
        "mainAccounts.USD.accountNumber": "888888888",
      });
      if (!centralBank) return;

      for (let fund of funds) {
        if (fund.currentAmount >= fund.targetAmount) continue;

        let fundUpdated = false;
        let cbUpdated = false;

        for (let member of fund.members) {
          if (member.status === "overdue") {
            const user = await User.findOne({ username: member.username });
            const amountDue =
              member.debtAmount > 0
                ? member.debtAmount
                : member.autoDeposit.amount;

            const userUsdBal = user?.mainAccounts?.USD?.balance || 0;

            if (user && userUsdBal >= amountDue) {
              // 🌟 រកមើល Sub-Account 888000555
              const cbUfundAcc = centralBank.subAccounts.find(
                (a) => a.accountNumber === "888000555",
              );

              if (cbUfundAcc) {
                user.mainAccounts.USD.balance -= amountDue;
                cbUfundAcc.balance += amountDue; // 🌟 បូកចូល U-Fund Pool
                cbUpdated = true;

                fund.currentAmount += amountDue;
                member.contributedAmount += amountDue;

                member.status = "active";
                member.debtAmount = 0;
                member.overdueSince = null;

                const dateStr = getFormattedDate();
                const refId = generateRefId();
                const hash = generateHash();

                await Transaction.create({
                  userId: user._id,
                  username: user.username,
                  refId: refId,
                  hash: hash,
                  date: dateStr,
                  type: "U-Fund Auto Retry",
                  amount: -amountDue,
                  currency: "USD",
                  senderName: "System Auto-Retry",
                  receiverName: `U-Fund: ${fund.name}`,
                  senderAcc: user.mainAccounts?.USD?.accountNumber,
                  remark: "Auto recovered overdue payment",
                  status: "Success",
                  trxMethod: "System Auto",
                });

                await Transaction.create({
                  userId: centralBank._id,
                  username: centralBank.username,
                  refId: refId,
                  hash: hash,
                  date: dateStr,
                  type: "U-Fund Pool Receive",
                  amount: amountDue,
                  currency: "USD",
                  senderName: user.fullName || user.username,
                  receiverName: "U-Pay Central Bank",
                  receiverAcc: "888000555", // 🌟 កត់ត្រាចូលកុង U-Fund
                  remark: `Auto recovered overdue for: ${fund.name}`,
                  status: "Success",
                  trxMethod: "System Auto",
                });

                await Notification.create({
                  userId: user._id,
                  username: user.username,
                  title: "ទូទាត់បំណុលជោគជ័យ! ✅",
                  message: `ប្រព័ន្ធបានកាត់ប្រាក់ $${amountDue} ដើម្បីទូទាត់ការជំពាក់ក្នុងគម្រោង "${fund.name}" ស្វ័យប្រវត្តិ។`,
                  date: dateStr,
                  type: "ufund_success",
                  isRead: false,
                });

                await user.save();
                fundUpdated = true;
              }
            }
          }
        }

        if (fundUpdated) {
          fund.markModified("members");
          await fund.save();
        }
        if (cbUpdated) {
          centralBank.markModified("subAccounts");
          await centralBank.save();
        }
      }
    } catch (err) {
      console.error("❌ Error in Auto-Retry Cron Job:", err);
    }
  });

  // ==========================================
  // 🚨 ៥. ម៉ាស៊ីនពិន័យអធ្រាត្រ (Midnight Penalty System)
  // ប្រើប្រាស់: Sub-Account (Central Bank U-Fund Pool - 888000555)
  // ==========================================
  cron.schedule(
    "1 0 * * *",
    async () => {
      try {
        console.log("🌙 Running Midnight Penalty System...");

        const funds = await UFund.find({
          "penaltyRule.enabled": true,
          "members.status": "overdue",
        });

        const centralBank = await User.findOne({
          "mainAccounts.USD.accountNumber": "888888888",
        });
        if (!centralBank) return;

        const now = new Date();

        for (let fund of funds) {
          if (fund.currentAmount >= fund.targetAmount) continue;
          let fundUpdated = false;
          let cbUpdated = false;

          const penaltyAmount = fund.penaltyRule.amount;
          const graceDays = fund.penaltyRule.gracePeriodDays || 1;
          const graceMs = graceDays * 24 * 60 * 60 * 1000;

          for (let member of fund.members) {
            if (member.status === "overdue" && member.overdueSince) {
              const timeOverdue =
                now.getTime() - new Date(member.overdueSince).getTime();

              if (timeOverdue >= graceMs) {
                const user = await User.findOne({ username: member.username });
                if (!user) continue;

                const userUsdBal = user?.mainAccounts?.USD?.balance || 0;

                if (userUsdBal >= penaltyAmount) {
                  // 🌟 រកមើល Sub-Account 888000555
                  const cbUfundAcc = centralBank.subAccounts.find(
                    (a) => a.accountNumber === "888000555",
                  );

                  if (cbUfundAcc) {
                    user.mainAccounts.USD.balance -= penaltyAmount;
                    cbUfundAcc.balance += penaltyAmount; // 🌟 បូកចូល U-Fund Pool
                    cbUpdated = true;

                    fund.currentAmount += penaltyAmount;

                    const dateStr = getFormattedDate();
                    const refId = generateRefId();
                    const hash = generateHash();

                    await Transaction.create({
                      userId: user._id,
                      username: user.username,
                      refId: refId,
                      hash: hash,
                      date: dateStr,
                      type: "U-Fund Penalty Deducted",
                      amount: -penaltyAmount,
                      currency: "USD",
                      senderName: "System Penalty",
                      receiverName: `U-Fund: ${fund.name}`,
                      senderAcc: user.mainAccounts?.USD?.accountNumber,
                      remark: "Late payment penalty fee",
                      status: "Success",
                      trxMethod: "System Auto",
                    });

                    await Notification.create({
                      userId: user._id,
                      username: user.username,
                      title: "ការផាកពិន័យការយឺតយ៉ាវ! 💸",
                      message: `ប្រព័ន្ធបានកាត់ប្រាក់ពិន័យ $${penaltyAmount} ចូលគម្រោង "${fund.name}" ដោយសារការយឺតយ៉ាវហួសថ្ងៃកំណត់។`,
                      date: dateStr,
                      type: "ufund_fail",
                      isRead: false,
                    });
                  }
                } else {
                  member.debtAmount += penaltyAmount;

                  await Notification.create({
                    userId: user._id,
                    username: user.username,
                    title: "ការផាកពិន័យការយឺតយ៉ាវ! 💸",
                    message: `អ្នកត្រូវបានផាកពិន័យ $${penaltyAmount} ដោយសារការយឺតយ៉ាវគម្រោង "${fund.name}"។ ទឹកប្រាក់នេះត្រូវបានបូកចូលបំណុលសរុប។`,
                    date: getFormattedDate(),
                    type: "ufund_fail",
                    isRead: false,
                  });
                }

                await user.save();

                member.overdueSince = new Date(
                  now.getTime() + 10 * 365 * 24 * 60 * 60 * 1000,
                );
                fundUpdated = true;
              }
            }
          }

          if (fundUpdated) {
            fund.markModified("members");
            await fund.save();
          }
          if (cbUpdated) {
            centralBank.markModified("subAccounts");
            await centralBank.save();
          }
        }
      } catch (err) {
        console.error("❌ Error in Midnight Penalty System:", err);
      }
    },
    { timezone: "Asia/Phnom_Penh" },
  );

  // ==========================================
  // 👻 ៦. ម៉ាស៊ីនតាមទារបំណុលខ្មោច (P2P Ghost Debt Auto-Recovery)
  // (P2P មិនពាក់ព័ន្ធជាមួយលុយ Central Bank ទេ)
  // ==========================================
  cron.schedule(
    "*/2 * * * *",
    async () => {
      try {
        console.log("👻 [P2P Debt] ម៉ាស៊ីនទារបំណុលចាប់ផ្តើមស្វែងរក...");

        const debtors = await User.find({
          "p2pDebts.type": "owe",
          "mainAccounts.USD.balance": { $gt: 0 },
        });

        if (debtors.length === 0) {
          return;
        }

        for (let debtor of debtors) {
          let isUpdated = false;

          for (let i = debtor.p2pDebts.length - 1; i >= 0; i--) {
            if (debtor.mainAccounts.USD.balance <= 0) break;

            let debt = debtor.p2pDebts[i];
            if (debt.type !== "owe") continue;

            let payAmount = Math.min(
              debtor.mainAccounts.USD.balance,
              debt.amount,
            );

            if (payAmount > 0) {
              const creditor = await User.findOne({
                username: debt.partnerUsername,
              });

              if (!creditor) continue;

              debtor.mainAccounts.USD.balance -= payAmount;
              debt.amount -= payAmount;
              creditor.mainAccounts.USD.balance += payAmount;

              const lendRecordIndex = creditor.p2pDebts.findIndex(
                (d) =>
                  d.type === "lend" &&
                  d.partnerUsername === debtor.username &&
                  d.fundName === debt.fundName,
              );

              if (lendRecordIndex !== -1) {
                creditor.p2pDebts[lendRecordIndex].amount -= payAmount;
                // 🌟 បើគេសងអស់ ខាងអ្នកឱ្យខ្ចីអត់លុបចោលទេ (រក្សាទុកឱ្យឃើញ $0) តាមការចង់បានរបស់បង
                if (creditor.p2pDebts[lendRecordIndex].amount <= 0) {
                  creditor.p2pDebts[lendRecordIndex].amount = 0;
                }
                creditor.markModified("p2pDebts");
              }

              // 🌟 នេះហើយដែលកូដចាស់បាត់ ធ្វើឱ្យលុយខាងអ្នកឱ្យខ្ចីអត់ថយចុះ!
              creditor.markModified("mainAccounts");
              await creditor.save();

              const dateStr = getFormattedDate();
              const refId = generateRefId();
              const hash = generateHash();

              await Transaction.create({
                userId: debtor._id,
                username: debtor.username,
                refId: refId,
                hash: hash,
                date: dateStr,
                type: "P2P Debt Paid",
                amount: -payAmount,
                currency: "USD",
                senderName: "System Auto-Deduct",
                receiverName: creditor.fullName || creditor.username,
                senderAcc: debtor.mainAccounts?.USD?.accountNumber,
                remark: `Auto-paid P2P debt for fund: ${debt.fundName}`,
                status: "Success",
                trxMethod: "System Auto",
              });

              await Transaction.create({
                userId: creditor._id,
                username: creditor.username,
                refId: refId,
                hash: hash,
                date: dateStr,
                type: "P2P Debt Received",
                amount: payAmount,
                currency: "USD",
                senderName: debtor.fullName || debtor.username,
                receiverName: "You",
                receiverAcc: creditor.mainAccounts?.USD?.accountNumber,
                remark: `Auto-recovered P2P debt for fund: ${debt.fundName}`,
                status: "Success",
                trxMethod: "System Auto",
              });

              await Notification.create({
                userId: creditor._id,
                username: creditor.username,
                title: "ទារបំណុលចាស់បានជោគជ័យ! 💸",
                message: `ប្រព័ន្ធទើបតែឆក់យកលុយ $${payAmount.toFixed(2)} ពី ${debtor.fullName || debtor.username} (បំណុលក្នុងគម្រោង ${debt.fundName}) មកបញ្ចូលក្នុងគណនីអ្នកវិញដោយជោគជ័យ។`,
                date: dateStr,
                type: "ufund_success",
                isRead: false,
              });

              await Notification.create({
                userId: debtor._id,
                username: debtor.username,
                title: "ប្រព័ន្ធកាត់ប្រាក់សងបំណុលចាស់ ⚠️",
                message: `ប្រព័ន្ធបានកាត់ប្រាក់ $${payAmount.toFixed(2)} ស្វ័យប្រវត្តិ ដើម្បីសងបំណុល P2P ដែលអ្នកជំពាក់ ${creditor.fullName || creditor.username} ក្នុងគម្រោង ${debt.fundName}។`,
                date: dateStr,
                type: "ufund_fail",
                isRead: false,
              });

              if (debt.amount <= 0) {
                debtor.p2pDebts.splice(i, 1);
              }

              isUpdated = true;
            }
          }

          if (isUpdated) {
            debtor.markModified("p2pDebts");
            await debtor.save();
          }
        }
      } catch (err) {
        console.error("❌ Error in P2P Debt Auto-Recovery:", err);
      }
    },
    { timezone: "Asia/Phnom_Penh" },
  );

  // ==========================================
  // 💼 ៧. មុខងាររុករកនិងកាត់ប្រាក់ Payroll / Auto Payouts ស្វ័យប្រវត្តិ
  // ==========================================
  cron.schedule(
    "* * * * *",
    async () => {
      try {
        const now = moment().tz("Asia/Phnom_Penh");
        const currentDateStr = now.format("YYYY-MM-DD");
        const currentTimeStr = now.format("HH:mm");

        const activePayrolls = await Payroll.find({
          status: "active",
          isTemplate: false,
        });

        for (let payroll of activePayrolls) {
          let shouldRun = false;
          const sd = payroll.scheduleDetails || {};

          if (payroll.frequency === "once" && sd.date === currentDateStr) {
            if (!sd.time || sd.time === currentTimeStr) shouldRun = true;
          } else if (payroll.frequency === "monthly") {
            const currentDay = now.date().toString();
            if (
              sd.dayOfMonth === currentDay &&
              (!sd.time || sd.time === currentTimeStr)
            )
              shouldRun = true;
          } else if (payroll.frequency === "weekly") {
            const currentDayOfWeek = now.day().toString();
            if (
              sd.daysOfWeek &&
              sd.daysOfWeek.includes(currentDayOfWeek) &&
              (!sd.time || sd.time === currentTimeStr)
            )
              shouldRun = true;
          }

          if (shouldRun) {
            // 🌟 Lock កាលវិភាគជាមុនសិន ដើម្បីការពារកុំឱ្យមានការរត់ជាន់គ្នា (Race Condition)
            const lockedPayroll = await Payroll.findOneAndUpdate(
              { _id: payroll._id, status: "active" },
              { status: "processing" },
              { new: true },
            );

            if (!lockedPayroll) continue;

            console.log(
              `⏳ [CRON] ដល់ម៉ោងហើយ! ចាប់ផ្តើមបាញ់ប្រាក់: ${lockedPayroll.name}`,
            );
            const success = await executePayroll(lockedPayroll);

            if (success) {
              if (lockedPayroll.frequency === "once") {
                lockedPayroll.status = "completed";
              } else {
                lockedPayroll.status = "active";
              }
              lockedPayroll.lastExecutedAt = new Date();
              await lockedPayroll.save();
            } else {
              lockedPayroll.status = "failed";
              await lockedPayroll.save();
            }
          }
        }
      } catch (err) {
        console.error("❌ Error in Payroll Cron Job:", err);
      }
    },
    { timezone: "Asia/Phnom_Penh" },
  );
};

module.exports = initCronJobs;
