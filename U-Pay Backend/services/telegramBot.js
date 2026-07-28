const TelegramBot = require("node-telegram-bot-api");
const User = require("../models/User");
const Merchant = require("../models/Merchant"); // ទាញ Model Merchant មកប្រើ
const merchantController = require("../controllers/merchantController"); // ទាញយក Controller មកដើម្បីយក Object ដែលស្តុកលេខកូដ
require("dotenv").config();

// ទាញយក Token ពី .env
const token = process.env.TELEGRAM_TOKEN;
const bot = new TelegramBot(token, { polling: true });

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text ? msg.text.trim() : "";

  // ឆែកមើលថាតើសារដែលគេវាយ ជាលេខកូដ ៤ ខ្ទង់ដែរឬទេ
  if (text.length === 4 && !isNaN(text)) {
    try {
      // ១. ឆែកមើលសម្រាប់ USER ធម្មតាជាមុនសិន
      let user = await User.findOne({ linkCode: text });
      if (user) {
        user.telegramChatId = chatId;
        user.linkCode = null;
        await user.save();
        bot.sendMessage(
          chatId,
          `🎉 អបអរសាទរ! គណនី U-Pay (<b>${user.username}</b>) ត្រូវបានភ្ជាប់ជោគជ័យ!`,
          { parse_mode: "HTML" },
        );
        console.log(
          `✅ Linked User: Account: ${user.username}, Group: ${chatId}`,
        );
        return; // ឈប់ត្រឹមនេះ បើស្គាល់ថាជា User
      }

      // ២. បើមិនមែនជា User ទេ, ឆែកមើលសម្រាប់ MERCHANT វិញម្តង
      const pendingMerchCodes = merchantController.pendingMerchantTeleCodes;
      if (pendingMerchCodes && pendingMerchCodes[text]) {
        const data = pendingMerchCodes[text];

        // ឆែកមើលថាតើកូដនេះហួសម៉ោង ៥នាទី (Expired) ទេ?
        if (data.expiresAt < Date.now()) {
          bot.sendMessage(
            chatId,
            "❌ លេខកូដនេះហួសកំណត់ ៥នាទីហើយ! សូមទាញយកលេខកូដថ្មីពី App។",
          );
          delete pendingMerchCodes[text];
          return;
        }

        // Update យក Chat ID នេះទៅតភ្ជាប់ជាមួយ Merchant នោះ
        const merchant = await Merchant.findByIdAndUpdate(
          data.merchantId,
          { telegramChatId: chatId.toString() },
          { new: true },
        );

        if (merchant) {
          const successMsg = `✅ <b>ការភ្ជាប់ជោគជ័យ! (Linked Successfully)</b>\n\n🏪 ហាង៖ <b>${merchant.name}</b>\n\nចាប់ពីពេលនេះតទៅ រាល់ពេលមានអតិថិជនទូទាត់ប្រាក់ចូលហាងនេះ ប្រព័ន្ធនឹងលោតសារជូនដំណឹងចូលមកទីនេះភ្លាមៗ។ 🚀`;
          bot.sendMessage(chatId, successMsg, { parse_mode: "HTML" });
          console.log(`✅ Linked Merchant: ${merchant.name}, Group: ${chatId}`);

          // លុបកូដនេះចេញពី Memory ក្រោយពេលភ្ជាប់ជោគជ័យ
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
// មុខងារបន្ថែម៖ បាញ់សារទៅ Merchant ពេលមានលុយចូល
// (យើងភ្ជាប់វាជាមួយ Object bot ដើម្បីងាយស្រួលហៅពីខាងក្រៅ)
// ========================================================
bot.sendMerchantPaymentAlert = async (merchantId, paymentData) => {
  try {
    const merchant = await Merchant.findById(merchantId);

    // ឆែកមើលថាហាងហ្នឹង ពិតជាបានភ្ជាប់ Telegram មែនឬអត់
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
