// cron/payrollCron.js
const cron = require("node-cron");
const Payroll = require("../models/Payroll");
const { executePayroll } = require("../services/payrollProcessor");

// ដំណើរការរាល់ ១ នាទីម្តង
cron.schedule("* * * * *", async () => {
  try {
    console.log("🤖 [CRON] កំពុងឆែកមើលកាលវិភាគ Auto Payout...");

    const now = new Date();
    const activePayrolls = await Payroll.find({
      status: "active",
      isTemplate: false,
    });

    for (let payroll of activePayrolls) {
      let isDue = false;
      const details = payroll.scheduleDetails;

      if (!details) continue;

      // 🕒 ទាញយក ម៉ោង និង នាទី បច្ចុប្បន្ននៅកម្ពុជា (Asia/Phnom_Penh)
      const timeFormatter = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Phnom_Penh",
        hour: "numeric",
        minute: "numeric",
        hour12: false,
      });
      const parts = timeFormatter.formatToParts(now);
      const hourPart = parts.find((p) => p.type === "hour");
      const minutePart = parts.find((p) => p.type === "minute");

      const currentHour = hourPart
        ? String(hourPart.value).padStart(2, "0")
        : "00";
      const currentMinute = minutePart
        ? String(minutePart.value).padStart(2, "0")
        : "00";
      const currentTimeStr = `${currentHour}:${currentMinute}`;

      // 📅 ទាញយកកាលបរិច្ឆេទជា YYYY-MM-DD នៅកម្ពុជា
      const dateLocalStr = now.toLocaleDateString("en-CA", {
        timeZone: "Asia/Phnom_Penh",
      }); // Format: YYYY-MM-DD

      if (payroll.frequency === "once") {
        if (details.date && details.time) {
          // ប្រៀបធៀបថាតើដល់ថ្ងៃ និងដល់ម៉ោង ឬហួសម៉ោងហើយឬยัง
          const scheduleDateTime = `${details.date} ${details.time}`;
          const currentLocalDateTime = `${dateLocalStr} ${currentTimeStr}`;

          if (currentLocalDateTime >= scheduleDateTime) {
            isDue = true;
          }
        }
      } else if (payroll.frequency === "monthly") {
        const formatter = new Intl.DateTimeFormat("en-US", {
          timeZone: "Asia/Phnom_Penh",
          day: "numeric",
        });
        const todayDate = Number(formatter.format(now));

        const scheduledTime = details.time || "00:00";
        if (
          todayDate === Number(details.dayOfMonth) &&
          currentTimeStr === scheduledTime
        ) {
          isDue = true;
        }
      } else if (payroll.frequency === "weekly") {
        // យកលេខថ្ងៃក្នុងសប្តាហ៍ (0 = អាទិត្យ, 1 = ច័ន្ទ, ... 6 = សៅរ៍) ដោយសុវត្ថិភាព
        const jsDay = new Date(
          now.toLocaleString("en-US", { timeZone: "Asia/Phnom_Penh" }),
        ).getDay();

        const scheduledTime = details.time || "00:00";
        if (
          details.daysOfWeek &&
          details.daysOfWeek.map(String).includes(String(jsDay)) &&
          currentTimeStr === scheduledTime
        ) {
          isDue = true;
        }
      } else if (payroll.frequency === "yearly") {
        const localDateObj = new Date(
          now.toLocaleString("en-US", { timeZone: "Asia/Phnom_Penh" }),
        );
        const currentMonth = localDateObj.getMonth(); // 0-11
        const currentDay = localDateObj.getDate();

        const scheduledTime = details.time || "00:00";
        if (
          Number(details.month) === currentMonth &&
          Number(details.dayOfMonth) === currentDay &&
          currentTimeStr === scheduledTime
        ) {
          isDue = true;
        }
      }

      if (isDue) {
        console.log(
          `⏳ [CRON] ដល់ម៉ោងហើយ! ចាប់ផ្តើមបាញ់ប្រាក់: ${payroll.name}`,
        );
        const success = await executePayroll(payroll);

        // បើប្រភេទ Once បាញ់រួចដូរ status ជា completed/failed
        if (payroll.frequency === "once") {
          payroll.status = success ? "completed" : "failed";
          payroll.lastExecutedAt = new Date();
          await payroll.save();
        } else {
          payroll.lastExecutedAt = new Date();
          await payroll.save();
        }
      }
    }
  } catch (error) {
    console.error("Cron Job Payroll Error:", error.message);
  }
});
