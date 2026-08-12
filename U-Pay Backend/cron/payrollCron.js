// cron/payrollCron.js
const cron = require("node-cron");
const Payroll = require("../models/Payroll");
const { executePayroll } = require("../services/payrollProcessor");

// ដំណើរការរាល់ ១ នាទីម្តង
cron.schedule("* * * * *", async () => {
  try {
    const now = new Date();

    // ទាញយកកាលវិភាគដែលកំពុង "active" ទាំងអស់
    const activePayrolls = await Payroll.find({
      status: "active",
      isTemplate: false,
    });

    if (activePayrolls.length === 0) return;

    // 🕒 កំណត់ម៉ោងនៅកម្ពុជា (Asia/Phnom_Penh)
    const timeFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Phnom_Penh",
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    });
    const parts = timeFormatter.formatToParts(now);
    const currentHour =
      parts.find((p) => p.type === "hour")?.value.padStart(2, "0") || "00";
    const currentMinute =
      parts.find((p) => p.type === "minute")?.value.padStart(2, "0") || "00";
    const currentTimeStr = `${currentHour}:${currentMinute}`;

    // 📅 ទាញយកកាលបរិច្ឆេទនៅកម្ពុជា
    const dateLocalStr = now.toLocaleDateString("en-CA", {
      timeZone: "Asia/Phnom_Penh",
    }); // YYYY-MM-DD

    const localDateObj = new Date(
      now.toLocaleString("en-US", { timeZone: "Asia/Phnom_Penh" }),
    );
    const currentDayOfWeek = localDateObj.getDay(); // 0-6
    const currentDayOfMonth = localDateObj.getDate(); // 1-31
    const currentMonth = localDateObj.getMonth(); // 0-11

    // ប្រមូលផ្តុំកាលវិភាគដែលត្រូវរត់ (Promises) ដើម្បីរត់ដំណាលគ្នា
    const payrollTasks = [];

    for (let payroll of activePayrolls) {
      const details = payroll.scheduleDetails;
      if (!details) continue;

      let isDue = false;

      // 🛑 ឆែកមើលថាតើថ្ងៃនេះ បានបើកប្រាក់ខែឱ្យហើយឬនៅ? (ការពារការបើក ២ដងក្នុង១ថ្ងៃ)
      let alreadyExecutedToday = false;
      if (payroll.lastExecutedAt) {
        const lastExecDateStr = new Date(
          payroll.lastExecutedAt,
        ).toLocaleDateString("en-CA", { timeZone: "Asia/Phnom_Penh" });
        if (lastExecDateStr === dateLocalStr) {
          alreadyExecutedToday = true;
        }
      }

      if (!alreadyExecutedToday) {
        const scheduledTime = details.time || "00:00";

        if (payroll.frequency === "once" && details.date) {
          const scheduleDateTime = `${details.date} ${scheduledTime}`;
          const currentLocalDateTime = `${dateLocalStr} ${currentTimeStr}`;
          // បើដល់ថ្ងៃនិងម៉ោង ឬហួសម៉ោងហើយ តែអត់ទាន់បានបើក
          if (currentLocalDateTime >= scheduleDateTime) isDue = true;
        } else if (payroll.frequency === "weekly") {
          if (
            details.daysOfWeek &&
            details.daysOfWeek.map(String).includes(String(currentDayOfWeek)) &&
            currentTimeStr >= scheduledTime
          ) {
            isDue = true;
          }
        } else if (payroll.frequency === "monthly") {
          if (
            Number(details.dayOfMonth) === currentDayOfMonth &&
            currentTimeStr >= scheduledTime
          ) {
            isDue = true;
          }
        } else if (payroll.frequency === "yearly") {
          if (
            Number(details.month) === currentMonth &&
            Number(details.dayOfMonth) === currentDayOfMonth &&
            currentTimeStr >= scheduledTime
          ) {
            isDue = true;
          }
        }
      }

      if (isDue) {
        // 🔥 ATOMIC LOCK: ចាប់យកទិន្នន័យនេះយកមកធ្វើការ ហើយប្តូរ Status ភ្លាមៗ ដើម្បីកុំអោយ Server ផ្សេងទាញយកទៅជាន់គ្នា
        const lockedPayroll = await Payroll.findOneAndUpdate(
          { _id: payroll._id, status: "active" },
          { $set: { status: "processing" } },
          { new: true },
        );

        if (lockedPayroll) {
          console.log(
            `⏳ [CRON] ដល់ម៉ោងហើយ! ចាប់ផ្តើមបាញ់ប្រាក់: ${lockedPayroll.name}`,
          );

          // រៀបចំការងារចូលក្នុងបញ្ជីរង់ចាំ ដើម្បីឲ្យវាធ្វើការដំណាលគ្នា
          payrollTasks.push(
            (async () => {
              const success = await executePayroll(lockedPayroll);

              // បន្ទាប់ពីធ្វើការចប់ Update ពេលវេលា និង Status ត្រឡប់មកវិញ
              lockedPayroll.lastExecutedAt = new Date();
              if (lockedPayroll.frequency === "once") {
                lockedPayroll.status = success ? "completed" : "failed";
              } else {
                lockedPayroll.status = "active"; // ទុកអោយវារត់នៅខែ/សប្តាហ៍ក្រោយទៀត
              }
              await lockedPayroll.save();
            })(),
          );
        }
      }
    }

    // 🚀 បញ្ជាឱ្យកាលវិភាគទាំងអស់ដំណើរការដំណាលគ្នា (មិនស្ទះ Event Loop)
    if (payrollTasks.length > 0) {
      await Promise.allSettled(payrollTasks);
    }
  } catch (error) {
    console.error("Cron Job Payroll Error:", error.message);
  }
});
