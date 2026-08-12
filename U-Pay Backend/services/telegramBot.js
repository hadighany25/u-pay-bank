// services/telegramBot.js
const TelegramBot = require("node-telegram-bot-api");
const User = require("../models/User");
const Merchant = require("../models/Merchant");
const merchantController = require("../controllers/merchantController");
require("dotenv").config();

const token = process.env.TELEGRAM_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// 🔥 ការពារកុំឱ្យ Server គាំង ពេលមានបញ្ហា Polling (ឧទាហរណ៍ ដើរម៉ាស៊ីន២)
bot.on("polling_error", (error) => {
  console.log(
    `⚠️ [Telegram Polling Warning]: ${error.code} - ${error.message}`,
  );
});

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text ? msg.text.trim() : "";

  if (text.length === 4 && !isNaN(text)) {
    try {
      // ==========================================
      // ១. ឆែកមើលសម្រាប់ USER ធម្មតា
      // ==========================================
      let user = await User.findOne({ linkCode: text });
      if (user) {
        user.telegramChatId = chatId.toString();
        user.linkCode = null;
        await user.save();

        await bot.sendMessage(
          chatId,
          `🎉 អបអរសាទរ! គណនី U-Pay (<b>${user.username}</b>) ត្រូវបានភ្ជាប់ជោគជ័យ!`,
          { parse_mode: "HTML" },
        );
        console.log(
          `✅ Linked User: Account: ${user.username}, Group: ${chatId}`,
        );

        const io = global.io;
        if (io) {
          io.to(user.username).emit("telegramLinked", {
            success: true,
            telegramChatId: user.telegramChatId,
            message: "គណនីរបស់អ្នកត្រូវបានភ្ជាប់ Telegram រួចរាល់!",
          });
        }
        return;
      }

      // ==========================================
      // ២. ឆែកមើលសម្រាប់ MERCHANT
      // ==========================================
      const pendingMerchCodes = merchantController.pendingMerchantTeleCodes;
      if (pendingMerchCodes && pendingMerchCodes[text]) {
        const data = pendingMerchCodes[text];

        if (data.expiresAt < Date.now()) {
          await bot.sendMessage(
            chatId,
            "❌ លេខកូដនេះហួសកំណត់ ៥នាទីហើយ! សូមទាញយកលេខកូដថ្មីពី App។",
          );
          delete pendingMerchCodes[text];
          return;
        }

        const merchant = await Merchant.findByIdAndUpdate(
          data.merchantId,
          { telegramChatId: chatId.toString() },
          { new: true },
        );

        if (merchant) {
          const successMsg = `✅ <b>ការភ្ជាប់ជោគជ័យ! (Linked Successfully)</b>\n\n🏪 ហាង៖ <b>${merchant.name}</b>\n\nចាប់ពីពេលនេះតទៅ រាល់ពេលមានអតិថិជនទូទាត់ប្រាក់ចូលហាងនេះ ប្រព័ន្ធនឹងលោតសារជូនដំណឹងចូលមកទីនេះភ្លាមៗ។ 🚀`;
          await bot.sendMessage(chatId, successMsg, { parse_mode: "HTML" });
          console.log(`✅ Linked Merchant: ${merchant.name}, Group: ${chatId}`);
          delete pendingMerchCodes[text];
        }
        return;
      }
    } catch (err) {
      console.error("Telegram Binding Error:", err.message);
      try {
        await bot.sendMessage(
          chatId,
          "❌ មានបញ្ហាបច្ចេកទេសក្នុងការភ្ជាប់ សូមសាកល្បងម្តងទៀត។",
        );
      } catch (e) {
        /* Ignore Error បើបាញ់សារអត់ទៅទៀត */
      }
    }
  }
});

// ========================================================
// មុខងារទី ១៖ បាញ់សារទៅ USER ធម្មតា ពេលមានលុយចូល
// ========================================================
bot.sendUserPaymentAlert = async (userId, paymentData) => {
  try {
    const user = await User.findById(userId);
    if (user && user.telegramChatId) {
      const symbol = paymentData.currency === "USD" ? "$" : "៛";
      const amountStr =
        paymentData.currency === "USD"
          ? paymentData.amount.toFixed(2)
          : paymentData.amount.toLocaleString();

      const alertMsg = `🔔 <b>ទទួលបានការផ្ទេរប្រាក់ថ្មី!</b>
━━━━━━━━━━━━━━━━━
💵 ចំនួនទឹកប្រាក់៖ <b>+${symbol}${amountStr}</b>
👤 ពីគណនី៖ ${paymentData.senderName}
📝 លេខប្រតិបត្តិការ៖ <code>${paymentData.refId}</code>
🕒 ម៉ោង៖ ${new Date().toLocaleString("en-GB", { timeZone: "Asia/Phnom_Penh" })}
✅ <b>ស្ថានភាព៖ ជោគជ័យ</b>`;

      // 🔥 ការពារកុំអោយគាំង បើ User Block Telegram Bot
      await bot.sendMessage(user.telegramChatId, alertMsg, {
        parse_mode: "HTML",
      });
    }
  } catch (error) {
    console.error("⚠️ Failed to send user telegram alert:", error.message);
  }
};

// ========================================================
// មុខងារទី ២៖ បាញ់សារទៅ MERCHANT ពេលមានលុយចូល
// ========================================================
bot.sendMerchantPaymentAlert = async (merchantId, paymentData) => {
  try {
    const merchant = await Merchant.findById(merchantId);
    if (merchant && merchant.telegramChatId) {
      const symbol = paymentData.currency === "USD" ? "$" : "៛";
      const amountStr =
        paymentData.currency === "USD"
          ? paymentData.amount.toFixed(2)
          : paymentData.amount.toLocaleString();

      const alertMsg = `🔔 <b>ទទួលបានការទូទាត់ប្រាក់ថ្មី!</b>
━━━━━━━━━━━━━━━━━
🏪 ហាង៖ <b>${merchant.name}</b>
💵 ចំនួនទឹកប្រាក់៖ <b>+${symbol}${amountStr}</b>
👤 ពីអតិថិជន៖ ${paymentData.senderName}
📝 លេខប្រតិបត្តិការ៖ <code>${paymentData.refId}</code>
🕒 កាលបរិច្ឆេទ៖ ${new Date().toLocaleString("en-GB", { timeZone: "Asia/Phnom_Penh" })}
✅ <b>ស្ថានភាព៖ ជោគជ័យ</b>`;

      // 🔥 ការពារកុំអោយគាំង បើ Merchant Block Telegram Bot
      await bot.sendMessage(merchant.telegramChatId, alertMsg, {
        parse_mode: "HTML",
      });
    }
  } catch (error) {
    console.error("⚠️ Failed to send merchant telegram alert:", error.message);
  }
};

module.exports = bot;
