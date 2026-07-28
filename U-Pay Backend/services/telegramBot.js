const TelegramBot = require("node-telegram-bot-api");
const User = require("../models/User");
const Merchant = require("../models/Merchant");
const merchantController = require("../controllers/merchantController");
require("dotenv").config();

const token = process.env.TELEGRAM_TOKEN;
const bot = new TelegramBot(token, { polling: true });

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
        // 🔥 ជួសជុលត្រង់នេះ៖ ប្តូរទៅជា .toString() ដើម្បីឱ្យវា Save ចូល Database ជោគជ័យ
        user.telegramChatId = chatId.toString();
        user.linkCode = null;
        await user.save(); // បើ Save ជោគជ័យ ផ្ទាំង Web នឹងលោតអូតូ!

        bot.sendMessage(
          chatId,
          `🎉 អបអរសាទរ! គណនី U-Pay (<b>${user.username}</b>) ត្រូវបានភ្ជាប់ជោគជ័យ!`,
          { parse_mode: "HTML" },
        );
        console.log(
          `✅ Linked User: Account: ${user.username}, Group: ${chatId}`,
        );
        return;
      }

      // ==========================================
      // ២. ឆែកមើលសម្រាប់ MERCHANT
      // ==========================================
      const pendingMerchCodes = merchantController.pendingMerchantTeleCodes;
      if (pendingMerchCodes && pendingMerchCodes[text]) {
        const data = pendingMerchCodes[text];

        if (data.expiresAt < Date.now()) {
          bot.sendMessage(
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
          bot.sendMessage(chatId, successMsg, { parse_mode: "HTML" });
          console.log(`✅ Linked Merchant: ${merchant.name}, Group: ${chatId}`);
          delete pendingMerchCodes[text];
        }
        return;
      }
    } catch (err) {
      console.error("Telegram Binding Error:", err);
      bot.sendMessage(
        chatId,
        "❌ មានបញ្ហាបច្ចេកទេសក្នុងការភ្ជាប់ សូមសាកល្បងម្តងទៀត។",
      );
    }
  }
});

// ========================================================
// មុខងារទី ១៖ បាញ់សារទៅ USER ធម្មតា ពេលមានលុយចូល (🔥 ថែមថ្មីវិញ)
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

      bot.sendMessage(user.telegramChatId, alertMsg, { parse_mode: "HTML" });
    }
  } catch (error) {
    console.error("Failed to send user telegram alert:", error);
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

      bot.sendMessage(merchant.telegramChatId, alertMsg, {
        parse_mode: "HTML",
      });
    }
  } catch (error) {
    console.error("Failed to send merchant telegram alert:", error);
  }
};

module.exports = bot;
