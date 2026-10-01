// services/telegramBot.js

/**
 * ============================================================================
 * 🤖 TELEGRAM BOT SERVICE (U-PAY NOTIFICATION SYSTEM)
 * ============================================================================
 * តួនាទី: ឯកសារនេះគ្រប់គ្រងការភ្ជាប់គណនី (Link Account) និងការបញ្ជូនសារ
 * (Notifications) ទៅកាន់ Telegram របស់អតិថិជន (User) និង ម្ចាស់ហាង (Merchant)។
 * ============================================================================
 */

const TelegramBot = require("node-telegram-bot-api");
const User = require("../models/User");
const Merchant = require("../models/Merchant");
const merchantController = require("../controllers/merchantController");
require("dotenv").config();

// ========================================================
// ⚙️ ផ្នែកទី ១៖ ការរៀបចំ Bot (Initialization)
// ========================================================
const token = process.env.TELEGRAM_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// 🔥 ការពារកុំឱ្យ Server គាំង ពេលមានបញ្ហា Polling (ឧទាហរណ៍ ពេលអុីនធឺណិតដាច់)
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

  // ដំណើរការតែពេល User វាយបញ្ចូលលេខកូដ ៤ ខ្ទង់ប៉ុណ្ណោះ
  if (text.length === 4 && !isNaN(text)) {
    try {
      // ----------------------------------------------------
      // ក. ស្វែងរក និងភ្ជាប់សម្រាប់គណនីអតិថិជនធម្មតា (User)
      // ----------------------------------------------------
      let user = await User.findOne({ linkCode: text });
      if (user) {
        user.telegramChatId = chatId.toString();
        user.linkCode = null; // លុបកូដចោលវិញក្រោយភ្ជាប់រួច
        await user.save();

        // 🌟 ប្រើប្រាស់ fullName (បើគ្មាន ប្រើ username ជំនួស)
        const displayName = user.fullName || user.username;

        await bot.sendMessage(
          chatId,
          `🎉 <b>អបអរសាទរការភ្ជាប់ Telegram ជោគជ័យ!</b>\n\n👤 ឈ្មោះម្ចាស់គណនី៖ <b>${displayName}</b>\n📱 ប្រព័ន្ធទូទាត់៖ <b>U-Pay Bank</b>\n\nចាប់ពីពេលនេះតទៅ រាល់សកម្មភាពលុយចូលនឹងមានសារជូនដំណឹងមកកាន់ទីនេះជាស្វ័យប្រវត្តិ។ 🚀`,
          { parse_mode: "HTML" },
        );
        console.log(`✅ Linked User: ${user.username}, ChatID: ${chatId}`);

        // Update ទៅកាន់ App វិញតាមរយៈ Socket.io
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

      // ----------------------------------------------------
      // ខ. ស្វែងរក និងភ្ជាប់សម្រាប់គណនីហាងលក់ (Merchant / Group)
      // ----------------------------------------------------
      const pendingMerchCodes = merchantController.pendingMerchantTeleCodes;
      if (pendingMerchCodes && pendingMerchCodes[text]) {
        const data = pendingMerchCodes[text];

        // ឆែកមើលថាតើលេខកូដនេះហួសម៉ោង (៥ នាទី) ឬនៅ?
        if (data.expiresAt < Date.now()) {
          await bot.sendMessage(
            chatId,
            "❌ លេខកូដនេះហួសកំណត់ ៥នាទីហើយ! សូមទាញយកលេខកូដថ្មីពី App ហាងរបស់អ្នក។",
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
          const successMsg = `✅ <b>ការភ្ជាប់ជោគជ័យ! (Linked Successfully)</b>\n\n🏪 ហាង៖ <b>${merchant.name}</b>\n\nចាប់ពីពេលនេះតទៅ រាល់ពេលមានអតិថិជនទូទាត់ប្រាក់ចូលហាងនេះ ប្រព័ន្ធនឹងលោតសារជូនដំណឹងចូលមកក្នុង Group នេះភ្លាមៗ។ 🚀`;
          await bot.sendMessage(chatId, successMsg, { parse_mode: "HTML" });
          console.log(
            `✅ Linked Merchant: ${merchant.name}, ChatID: ${chatId}`,
          );
          delete pendingMerchCodes[text]; // លុបកូដចោលការពារកុំអោយគេប្រើជាន់គ្នា
        }
        return;
      }

      // បើលេខកូដ ៤ ខ្ទង់រកមិនឃើញក្នុងប្រព័ន្ធទាំងសងខាង
      // await bot.sendMessage(chatId, "❌ លេខកូដមិនត្រឹមត្រូវ ឬហួសពេលកំណត់។");
    } catch (err) {
      console.error("Telegram Binding Error:", err.message);
      try {
        await bot.sendMessage(
          chatId,
          "❌ មានបញ្ហាបច្ចេកទេសក្នុងការភ្ជាប់ សូមសាកល្បងម្តងទៀត។",
        );
      } catch (e) {
        /* Ignore */
      }
    }
  }
});

/**
 * ៤. បាញ់សារទៅកាន់ User ពេលម្ចាស់គណនីចុច "ផ្តាច់គណនី" (Unlink Telegram)
 */
bot.sendUserUnlinkAlert = async (chatId, userFullName) => {
  try {
    if (!chatId) return;

    const unlinkMsg = `⚠️ <b>ការផ្តាច់គណនី Telegram ជោគជ័យ!</b>
━━━━━━━━━━━━━━━━━
👤 ម្ចាស់គណនី៖ <b>${userFullName}</b>

គណនី Telegram នេះត្រូវបានផ្តាច់ចេញពីប្រព័ន្ធ U-Pay របស់អ្នកដោយជោគជ័យ។ ចាប់ពីពេលនេះតទៅនឹងគ្មានសារជូនដំណឹងពីប្រតិបត្តិការលុយណាមួយលោតចូលទីនេះទៀតទេ។`;

    await bot.sendMessage(chatId, unlinkMsg, { parse_mode: "HTML" });
  } catch (error) {
    console.error("⚠️ Failed to send user unlink alert:", error.message);
  }
};

// ========================================================
// 👤 ផ្នែកទី ៣៖ សារផ្តល់ដំណឹងសម្រាប់អតិថិជន (User Alerts)
// ========================================================

/**
 * បាញ់សារទៅកាន់ User ធម្មតា ពេលមានលុយចូល
 */
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

      await bot.sendMessage(user.telegramChatId, alertMsg, {
        parse_mode: "HTML",
      });
    }
  } catch (error) {
    console.error("⚠️ Failed to send user telegram alert:", error.message);
  }
};

// ========================================================
// 🏪 ផ្នែកទី ៤៖ សារផ្តល់ដំណឹងសម្រាប់ហាងលក់ (Merchant Alerts)
// ========================================================

/**
 * ១. បាញ់សារទៅកាន់ Merchant Group ពេលមានអតិថិជនទូទាត់ប្រាក់ (លុយចូល)
 */
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
━━━━━━━━━━━━━━━━
🏪 ហាង៖ <b>${merchant.name}</b>
💵 ចំនួនទឹកប្រាក់៖ <b>+${symbol}${amountStr}</b>
👤 ពីអតិថិជន៖ ${paymentData.senderName}
📝 លេខប្រតិបត្តិការ៖ <code>${paymentData.refId}</code>
🕒 ម៉ោង៖ ${new Date().toLocaleString("en-GB", { timeZone: "Asia/Phnom_Penh" })}
✅ <b>ស្ថានភាព៖ ជោគជ័យ</b>`;

      await bot.sendMessage(merchant.telegramChatId, alertMsg, {
        parse_mode: "HTML",
      });
    }
  } catch (error) {
    console.error("⚠️ Failed to send merchant payment alert:", error.message);
  }
};

/**
 * ២. បាញ់សារទូទៅទៅកាន់ Merchant Group (ឧទាហរណ៍៖ បន្ថែមកូនចៅ, លុបកូនចៅ, ឬ Refund)
 */
bot.sendMerchantAlert = async (merchantId, messageContent) => {
  try {
    const merchant = await Merchant.findById(merchantId);
    if (merchant && merchant.telegramChatId) {
      await bot.sendMessage(merchant.telegramChatId, messageContent, {
        parse_mode: "HTML",
      });
    }
  } catch (error) {
    console.error("⚠️ Failed to send merchant general alert:", error.message);
  }
};

/**
 * ៣. បាញ់សារទៅកាន់ Group ពេលម្ចាស់ហាងចុច "ផ្តាច់គណនី" (Unlink Telegram)
 * ចំណាំ៖ មុខងារនេះត្រូវបញ្ជូន ChatID ផ្ទាល់ ព្រោះក្រោយពេលផ្តាច់ យើងនឹងលុប ChatID ពី Database
 */
bot.sendMerchantUnlinkAlert = async (chatId, merchantName) => {
  try {
    if (!chatId) return;

    const unlinkMsg = `⚠️ <b>ការផ្តាច់គណនី Telegram (Unlinked)</b>
━━━━━━━━━━━━━━━━
🏪 ហាង៖ <b>${merchantName}</b>

គណនី Telegram នេះត្រូវបានផ្តាច់ចេញពីប្រព័ន្ធ U-Pay របស់ហាងអ្នកដោយជោគជ័យ។ 
ចាប់ពីពេលនេះតទៅ នឹងមិនមានសារជូនដំណឹងលុយចូល ឬសកម្មភាពនានាលោតចូលក្នុងក្រុមនេះទៀតទេ។`;

    await bot.sendMessage(chatId, unlinkMsg, { parse_mode: "HTML" });
  } catch (error) {
    console.error("⚠️ Failed to send merchant unlink alert:", error.message);
  }
};

// ========================================================
// នាំចេញ (Export) Bot សម្រាប់ឲ្យ Controller ហៅយកទៅប្រើ
// ========================================================
module.exports = bot;
