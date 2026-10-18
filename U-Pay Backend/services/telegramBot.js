// ============================================================================
// ឯកសារ: services/telegramBot.js
// អត្ថន័យ: គ្រប់គ្រងការភ្ជាប់ Telegram ដាច់ដោយឡែកតាមហាងនីមួយៗ (1 Group = 1 Shop Strictly)
// ============================================================================

const TelegramBot = require("node-telegram-bot-api");
const User = require("../models/User");
const Merchant = require("../models/Merchant");
const merchantController = require("../controllers/merchantController");
require("dotenv").config();

const token = process.env.TELEGRAM_TOKEN;
const bot = new TelegramBot(token, { polling: true });

bot.on("polling_error", (error) => {
  console.log(
    `⚠️ [Telegram Polling Warning]: ${error.code} - ${error.message}`,
  );
});

// ========================================================
// 🔗 ផ្នែកទី ២៖ មុខងារភ្ជាប់គណនី (Account Linking via 4-Digit Code)
// ========================================================
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text ? msg.text.trim() : "";

  if (text.length === 4 && !isNaN(text)) {
    try {
      // ក. សម្រាប់គណនីអតិថិជនធម្មតា (User)
      let user = await User.findOne({ linkCode: text });
      if (user) {
        user.telegramChatId = chatId.toString();
        user.linkCode = null;
        await user.save();

        const displayName = user.fullName || user.username;
        await bot.sendMessage(
          chatId,
          `🎉 <b>អបអរសាទរការភ្ជាប់ Telegram ជោគជ័យ!</b>\n\n👤 ឈ្មោះម្ចាស់គណនី៖ <b>${displayName}</b>\n📱 ប្រព័ន្ធទូទាត់៖ <b>U-Pay Bank</b>\n\nចាប់ពីពេលនេះតទៅ រាល់សកម្មភាពលុយចូលនឹងមានសារជូនដំណឹងមកកាន់ទីនេះជាស្វ័យប្រវត្តិ។ 🚀`,
          { parse_mode: "HTML" },
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

      // ខ. សម្រាប់គណនីហាងលក់ (Merchant / Group - ដាច់ដោយឡែកតាមសាខា ១០០%)
      const pendingMerchCodes = merchantController.pendingMerchantTeleCodes;
      if (pendingMerchCodes && pendingMerchCodes[text]) {
        const data = pendingMerchCodes[text];

        if (data.expiresAt < Date.now()) {
          await bot.sendMessage(
            chatId,
            "❌ លេខកូដនេះហួសកំណត់ ៥នាទីហើយ! សូមទាញយកលេខកូដថ្មីពីក្នុងការកំណត់ហាងរបស់អ្នក។",
          );
          delete pendingMerchCodes[text];
          return;
        }

        // 🛑 ត្រួតពិនិត្យដាច់ខាត៖ ហាមយក Telegram Group ឬ Chat តែមួយទៅភ្ជាប់ជាន់គ្នាជាមួយហាងផ្សេង!
        const existingLinkedShop = await Merchant.findOne({
          telegramChatId: chatId.toString(),
          _id: { $ne: data.merchantId },
        });

        if (existingLinkedShop) {
          await bot.sendMessage(
            chatId,
            `🚫 <b>មិនអាចភ្ជាប់ជាន់គ្នាបានទេ!</b>\n\nប្រអប់សារ ឬ Group នេះកំពុងភ្ជាប់ជាមួយសាខាហាង <b>"${existingLinkedShop.name}"</b> រួចហើយ!\n\n👉 ដើម្បីកុំឱ្យច្រឡំវិក្កយបត្រលុយចូលរវាងសាខានីមួយៗ សូមបង្កើត Telegram Group ថ្មីមួយដាច់ដោយឡែកសម្រាប់ហាងនេះ ឬផ្តាច់ចេញពីហាងចាស់ជាមុនសិន។`,
            { parse_mode: "HTML" },
          );
          return;
        }

        const groupTitle =
          msg.chat.title ||
          msg.chat.username ||
          msg.from?.first_name ||
          "Telegram Chat";

        const merchant = await Merchant.findByIdAndUpdate(
          data.merchantId,
          {
            telegramChatId: chatId.toString(),
            telegramGroupName: groupTitle,
          },
          { new: true },
        );

        if (merchant) {
          const successMsg = `✅ <b>ការភ្ជាប់ប្រព័ន្ធជូនដំណឹងជោគជ័យ!</b>\n━━━━━━━━━━━━━━━━\n🏪 សាខាហាង៖ <b>${merchant.name}</b>\n🆔 លេខសម្គាល់៖ <code>${merchant.merchantId}</code>\n📡 ភ្ជាប់ជាមួយ៖ <b>${groupTitle}</b>\n\nចាប់ពីពេលនេះតទៅ រាល់ពេលអតិថិជនស្កេន KHQR ឬ Tap កាតទូទាត់ប្រាក់ចូលសាខា <b>${merchant.name}</b> ប្រព័ន្ធនឹងលោតសារជូនដំណឹងចូលទីនេះភ្លាមៗ! 🚀`;
          await bot.sendMessage(chatId, successMsg, { parse_mode: "HTML" });
          delete pendingMerchCodes[text];
        }
        return;
      }
    } catch (err) {
      console.error("Telegram Binding Error:", err.message);
    }
  }
});

bot.sendUserUnlinkAlert = async (chatId, userFullName) => {
  try {
    if (!chatId) return;
    const unlinkMsg = `⚠️ <b>ការផ្តាច់គណនី Telegram ជោគជ័យ!</b>\n━━━━━━━━━━━━━━━\n👤 ម្ចាស់គណនី៖ <b>${userFullName}</b>\n\nគណនី Telegram នេះត្រូវបានផ្តាច់ចេញពីប្រព័ន្ធ U-Pay រួចរាល់។`;
    await bot.sendMessage(chatId, unlinkMsg, { parse_mode: "HTML" });
  } catch (error) {}
};

bot.sendUserPaymentAlert = async (userId, paymentData) => {
  try {
    const user = await User.findById(userId);
    if (user && user.telegramChatId) {
      const symbol = paymentData.currency === "USD" ? "$" : "៛";
      const amountStr =
        paymentData.currency === "USD"
          ? paymentData.amount.toFixed(2)
          : paymentData.amount.toLocaleString();

      const alertMsg = `🔔 <b>ទទួលបានការផ្ទេរប្រាក់ថ្មី!</b>\n━━━━━━━━━━━━━━━\n💵 ចំនួនទឹកប្រាក់៖ <b>+${symbol}${amountStr}</b>\n👤 ពីគណនី៖ ${paymentData.senderName}\n📝 លេខប្រតិបត្តិការ៖ <code>${paymentData.refId}</code>\n🕒 ម៉ោង៖ ${new Date().toLocaleString("en-GB", { timeZone: "Asia/Phnom_Penh" })}\n✅ <b>ស្ថានភាព៖ ជោគជ័យ</b>`;

      await bot.sendMessage(user.telegramChatId, alertMsg, {
        parse_mode: "HTML",
      });
    }
  } catch (error) {}
};

bot.sendMerchantPaymentAlert = async (merchantId, paymentData) => {
  try {
    const merchant = await Merchant.findById(merchantId);
    if (
      merchant &&
      merchant.telegramChatId &&
      merchant.settings?.telegramAlertEnabled !== false
    ) {
      const symbol = paymentData.currency === "USD" ? "$" : "៛";
      const amountStr =
        paymentData.currency === "USD"
          ? paymentData.amount.toFixed(2)
          : paymentData.amount.toLocaleString();

      const alertMsg = `🔔 <b>ទទួលបានការទូទាត់ប្រាក់ថ្មី!</b>\n━━━━━━━━━━━━━━━━\n🏪 សាខាហាង៖ <b>${merchant.name}</b>\n💵 ចំនួនទឹកប្រាក់៖ <b>+${symbol}${amountStr} (${paymentData.currency})</b>\n👤 ពីអតិថិជន៖ <b>${paymentData.senderName}</b>\n📝 លេខយោង៖ <code>${paymentData.refId}</code>\n🕒 ម៉ោង៖ ${new Date().toLocaleString("en-GB", { timeZone: "Asia/Phnom_Penh" })}\n✅ <b>ស្ថានភាព៖ ទទួលបានជោគជ័យ</b>`;

      await bot.sendMessage(merchant.telegramChatId, alertMsg, {
        parse_mode: "HTML",
      });
    }
  } catch (error) {}
};

bot.sendMerchantAlert = async (merchantId, messageContent) => {
  try {
    const merchant = await Merchant.findById(merchantId);
    if (
      merchant &&
      merchant.telegramChatId &&
      merchant.settings?.telegramAlertEnabled !== false
    ) {
      await bot.sendMessage(merchant.telegramChatId, messageContent, {
        parse_mode: "HTML",
      });
    }
  } catch (error) {}
};

bot.sendMerchantUnlinkAlert = async (chatId, merchantName) => {
  try {
    if (!chatId) return;
    const unlinkMsg = `⚠️ <b>ការផ្តាច់គណនី Telegram (Unlinked)</b>\n━━━━━━━━━━━━━━\n🏪 សាខាហាង៖ <b>${merchantName}</b>\n\nGroup នេះត្រូវបានផ្តាច់ចេញពីប្រព័ន្ធជូនដំណឹងរបស់ហាង ${merchantName} រួចរាល់។`;
    await bot.sendMessage(chatId, unlinkMsg, { parse_mode: "HTML" });
  } catch (error) {}
};

module.exports = bot;
