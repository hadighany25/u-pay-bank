const TelegramBot = require("node-telegram-bot-api");
const User = require("../models/User"); // ទាញ Model User មកប្រើ
require("dotenv").config();

// ទាញយក Token ពី .env មិនមែនសរសេរចំហរទៀតទេ
const token = process.env.TELEGRAM_TOKEN;
const bot = new TelegramBot(token, { polling: true });

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text ? msg.text.trim() : "";

  if (text.length === 4 && !isNaN(text)) {
    try {
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
        console.log(`✅ Linked: Account: ${user.username}, Group: ${chatId}`);
      }
    } catch (err) {
      console.error("Telegram Binding Error:", err);
    }
  }
});

module.exports = bot;
