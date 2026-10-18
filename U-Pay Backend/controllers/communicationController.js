// ============================================================================
// ឯកសារ: controllers/communicationController.js
// អត្ថន័យ: ប្រព័ន្ធសារ និងការជូនដំណឹងសម្រាប់អតិថិជនសុទ្ធសាធ (100% User-Only Controller)
// - ចាប់តាម User _id 100%, លោតទៅ Admin តែពេលស្នើសុំជួបភ្នាក់ងារផ្ទាល់ (Strict Escalation)
// ============================================================================
const mongoose = require("mongoose");
const User = require("../models/User");
const Chat = require("../models/Chat");
const Notification = require("../models/Notification");
const { getFormattedDate } = require("../services/helpers");

// 🛠️ ១. អនុគមន៍ជំនួយសម្រាប់កំណត់អត្តសញ្ញាណ _id របស់ User
const extractCanonicalUserId = (userObj) => {
  if (!userObj) return "";
  if (userObj.accountNumber === "ADMIN" || userObj._id === "ADMIN") {
    return "ADMIN";
  }
  return String(userObj._id);
};

const extractPrimaryAcc = (userObj) => {
  if (!userObj) return "";
  if (userObj.accountNumber === "ADMIN" || userObj._id === "ADMIN") {
    return "ADMIN";
  }
  return (
    userObj.mainAccounts?.USD?.accountNumber ||
    userObj.accountNumber ||
    userObj.mainAccounts?.KHR?.accountNumber ||
    userObj.accountNumberKHR ||
    userObj.username ||
    ""
  );
};

const getAllUserIdentifiers = (userObj, rawInput = "") => {
  const set = new Set();
  if (rawInput) set.add(String(rawInput).trim());
  if (!userObj) return Array.from(set);
  if (userObj._id === "ADMIN" || userObj.accountNumber === "ADMIN") {
    return ["ADMIN", "UPAY_BOT"];
  }
  if (userObj._id) set.add(String(userObj._id));
  if (userObj.mainAccounts?.USD?.accountNumber)
    set.add(String(userObj.mainAccounts.USD.accountNumber));
  if (userObj.mainAccounts?.KHR?.accountNumber)
    set.add(String(userObj.mainAccounts.KHR.accountNumber));
  if (userObj.accountNumber) set.add(String(userObj.accountNumber));
  if (userObj.accountNumberKHR) set.add(String(userObj.accountNumberKHR));
  if (userObj.username) set.add(String(userObj.username));
  return Array.from(set);
};

const findUserByAnyIdentifier = async (identifier) => {
  if (!identifier) return null;
  const clean = String(identifier).replace(/^@/, "").trim();
  if (clean.toUpperCase() === "ADMIN" || clean.toUpperCase() === "UPAY_BOT") {
    return {
      _id: "ADMIN",
      accountNumber: "ADMIN",
      fullName: "U-PAY Assistant",
      username: "ADMIN",
    };
  }

  const orConditions = [
    { "mainAccounts.USD.accountNumber": clean },
    { "mainAccounts.KHR.accountNumber": clean },
    { "subAccounts.accountNumber": clean },
    { accountNumber: clean },
    { accountNumberKHR: clean },
    { phone: clean },
    { phoneNumber: clean },
    { userId: clean },
  ];

  if (mongoose.Types.ObjectId.isValid(clean)) {
    orConditions.unshift({ _id: clean });
  }

  const exactRegex = new RegExp(
    "^" + clean.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$",
    "i",
  );
  orConditions.push({ username: exactRegex }, { fullName: exactRegex });

  return await User.findOne({ $or: orConditions });
};

// 🟢 ២. កត់ត្រាស្ថានភាព Online និងម៉ោងសកម្មពិតប្រាកដរបស់ User
const touchUserPresence = async (userObj) => {
  if (!userObj || !userObj._id || userObj._id === "ADMIN") return;
  try {
    await User.updateOne(
      { _id: userObj._id },
      { $set: { isOnline: true, lastActive: new Date().toISOString() } },
    );
  } catch (e) {}
};

const isUserReallyOnline = (userObj) => {
  if (!userObj) return false;
  if (userObj.lastActive) {
    const diffMs = Date.now() - new Date(userObj.lastActive).getTime();
    if (!isNaN(diffMs) && diffMs < 90000) return true;
  }
  return false;
};

// 🤖 ៣. ខួរក្បាល AI Smart Bot សម្រាប់ឆ្លើយតបអតិថិជន (ភ្ជាប់ទៅ Admin តែពេលអតិថិជនស្នើសុំប៉ុណ្ណោះ!)
async function generateSmartCustomerBotReply(userText, userName = "បង") {
  const raw = String(userText || "").trim();
  const lower = raw.toLowerCase();

  // 🚨 ឆែកថាតើអតិថិជនពិតជាចង់ជួបភ្នាក់ងារមនុស្ស (Human Agent) ឬមានបញ្ហាបន្ទាន់មែនឬអត់
  const wantsHumanAgent = Boolean(
    lower.match(
      /human|ភ្នាក់ងារ|មនុស្ស|ជួបបុគ្គលិក|បុគ្គលិក|live agent|admin|បាត់លុយ|កាត់លុយ|វេរអត់ចូល|លុយអត់ចូល|ជាប់សោ/,
    ),
  );

  if (wantsHumanAgent) {
    const isUrgentIssue = Boolean(
      lower.match(/បាត់លុយ|កាត់លុយ|វេរអត់ចូល|លុយអត់ចូល|ជាប់សោ/),
    );
    return {
      switchedToAgent: true,
      isUrgent: isUrgentIssue,
      reply: `បាទ/ចាសបង <b>${userName}</b>! 👨‍💻 ប្រព័ន្ធបានបញ្ជូនសំណើរបស់បងទៅកាន់ភ្នាក់ងារបម្រើអតិថិជនផ្ទាល់ (Live Support Agent) រួចរាល់ហើយ។ បុគ្គលិកយើងខ្ញុំនឹងចូលមកឆ្លើយតបបងក្នុងពេលបន្តិចទៀតនេះ សូមមេត្តារង់ចាំបន្តិចណាបង! 🙏`,
    };
  }

  const botSystemPrompt = `អ្នកគឺជា "U-PAY Smart Bot 🤖" ជាជំនួយការ AI ផ្លូវការរបស់ធនាគារឌីជីថល U-PAY។
សូមឆ្លើយតបទៅកាន់អតិថិជនឈ្មោះ "${userName}" ជាភាសាខ្មែរ ឱ្យបានពិរោះ គួរសម ឆ្លាតវៃ និងខ្លីល្មមងាយយល់ (២-៤ ប្រយោគ)។
ចំណេះដឹងអំពីធនាគារ U-PAY៖
- វេរលុយ (Transfer): អាចវេរតាមលេខគណនី (USD/KHR) ឬស្កេន KHQR បានភ្លាមៗ។
- កាតធនាគារ (Cards): មានកាតនិម្មិត (Virtual Card) សម្រាប់ទិញអនឡាញ និងកាតរូបវ័ន្ត (Physical Debit/Credit Card) មានបន្ទះឈីប NFC សម្រាប់ស្កេនម៉ាស៊ីន POS។
- សន្សំប្រាក់ (Fixed Deposit / Savings): ផ្តល់ការប្រាក់ខ្ពស់ និងសុវត្ថិភាព។
- បើអតិថិជនចង់ជួបបុគ្គលិកផ្ទាល់ សូមណែនាំឱ្យគាត់វាយពាក្យ "ភ្នាក់ងារ"។`;

  try {
    const controller = new AbortController();
    const tId = setTimeout(() => controller.abort(), 5500);
    const res = await fetch("https://text.pollinations.ai/openai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: "openai",
        messages: [
          { role: "system", content: botSystemPrompt },
          { role: "user", content: raw },
        ],
        temperature: 0.4,
      }),
    });
    clearTimeout(tId);
    if (res.ok) {
      const data = await res.json();
      const aiTxt = data?.choices?.[0]?.message?.content?.trim();
      if (aiTxt) {
        return { switchedToAgent: false, isUrgent: false, reply: aiTxt };
      }
    }
  } catch (e) {}

  if (lower.match(/វេរលុយ|ផ្ទេរ|transfer/)) {
    return {
      switchedToAgent: false,
      isUrgent: false,
      reply: `💸 <b>របៀបវេរប្រាក់ក្នុង U-PAY៖</b> សូមបងចូលទៅកាន់ទំព័រដើម រួចចុចប៊ូតុង <b>"វេរប្រាក់ (Transfer)"</b> បន្ទាប់មកវាយលេខគណនីទទួល និងចំនួនទឹកប្រាក់ រួចបញ្ចូលលេខកូដ PIN ៤ ខ្ទង់ជាការស្រេច!`,
    };
  }
  if (lower.match(/ស្កេន|qr|khqr/)) {
    return {
      switchedToAgent: false,
      isUrgent: false,
      reply: `📷 <b>របៀបស្កេនទូទាត់ KHQR៖</b> សូមចុចលើរូប <b>"ស្កេន QR"</b> នៅរបារខាងក្រោមនៃទំព័រដើម រួចដាក់កាមេរ៉ាទៅកាន់ QR ហាងទំនិញ ឬអតិថិជនដើម្បីទូទាត់ប្រាក់ភ្លាមៗ!`,
    };
  }
  if (lower.match(/កាត|card|nfc/)) {
    return {
      switchedToAgent: false,
      isUrgent: false,
      reply: `💳 <b>សេវាកម្មកាតធនាគារ U-PAY៖</b> បងអាចបង្កើតកាតនិម្មិត (Virtual Card) ឬស្នើសុំកាតរូបវ័ន្ត (Physical Debit/Credit NFC) បានយ៉ាងងាយស្រួលនៅក្នុងម៉ឺនុយ <b>"Cards"</b> នៅលើទំព័រដើម!`,
    };
  }

  return {
    switchedToAgent: false,
    isUrgent: false,
    reply: `សួស្តីបង <b>${userName}</b>! 🤖 ខ្ញុំបានទទួលសាររបស់បងហើយ។ ប្រសិនបើបងចង់ជជែកផ្ទាល់ជាមួយបុគ្គលិកធនាគារ សូមចុចប៊ូតុងខាងក្រោម ឬវាយពាក្យ <b>"ភ្នាក់ងារ"</b> ណាបង! 🙏<br/><button onclick="window.requestHumanAgent()" class="bot-human-btn" style="margin-top:8px"><i class="fa-solid fa-headset" style="margin-right:8px; color:#0ea5e9"></i> ភ្ជាប់ទៅភ្នាក់ងារផ្ទាល់ (Live Agent)</button>`,
  };
}

// ==========================================
// 🎫 ផ្នែកទី ១៖ USER TICKETS & NOTIFICATIONS
// ==========================================
const createTicket = async (req, res) => {
  const { username, subject, description, priority } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user) return res.json({ success: false });

    if (!user.tickets) user.tickets = [];
    const results = await User.aggregate([
      {
        $project: {
          numberOfTickets: { $size: { $ifNull: ["$tickets", []] } },
        },
      },
      { $group: { _id: null, total: { $sum: "$numberOfTickets" } } },
    ]);
    const allTicketsCount = results.length > 0 ? results[0].total : 0;
    const formattedId =
      "TK-" + (allTicketsCount + 1).toString().padStart(3, "0");

    user.tickets.push({
      ticketId: formattedId,
      subject,
      description,
      priority: priority || "Normal",
      status: "Open",
      date: getFormattedDate(),
    });
    user.markModified("tickets");
    await user.save();
    res.json({
      success: true,
      message: "Ticket Created!",
      ticketId: formattedId,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

const getNotifications = async (req, res) => {
  res.json({ hasNew: false, count: 0 });
};

const readNotifications = async (req, res) => {
  const { username } = req.body;
  try {
    const user = await User.findOne({ username });
    if (user) {
      await Notification.updateMany(
        { userId: user._id, isRead: false },
        { $set: { isRead: true } },
      );
      res.json({ success: true });
    } else res.json({ success: false });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

const readSingleNotification = async (req, res) => {
  try {
    const { notifId } = req.params;
    if (!notifId || !mongoose.Types.ObjectId.isValid(notifId)) {
      return res
        .status(400)
        .json({ success: false, message: "លេខសម្គាល់សារមិនត្រឹមត្រូវទេ!" });
    }
    const updatedNotif = await Notification.findByIdAndUpdate(
      notifId,
      { $set: { isRead: true } },
      { new: true },
    );
    if (updatedNotif) return res.json({ success: true });
    return res.status(404).json({ success: false });
  } catch (error) {
    return res.status(500).json({ success: false });
  }
};

// ==========================================
// 💬 ផ្នែកទី ២៖ USER CHAT ENGINE (ចាប់តាម _id 100%)
// ==========================================
const sendChat = async (req, res) => {
  const {
    senderId,
    receiverId,
    senderAcc,
    receiverAcc,
    message,
    replyToId,
    forwardedFrom,
    forwardedFromAcc,
    imageUrl,
    audioUrl,
    fileUrl,
    fileName,
    fileSize,
    autoDeleteTimer,
    isScheduled,
    scheduledFor,
    requestAiBotReply,
    escalateToAgent, // 👈 ទង់ពិសេសពេលអតិថិជនចុចប៊ូតុង "ភ្ជាប់ទៅភ្នាក់ងារផ្ទាល់"
  } = req.body;

  try {
    const sender = await findUserByAnyIdentifier(senderId || senderAcc);
    const receiver = await findUserByAnyIdentifier(receiverId || receiverAcc);

    if (!sender || !receiver) {
      return res.json({ success: false, message: "រកមិនឃើញគណនីនេះទេ!" });
    }

    await touchUserPresence(sender);

    const canonicalSenderId = extractCanonicalUserId(sender);
    const canonicalReceiverId = extractCanonicalUserId(receiver);

    const scheduledNum = scheduledFor ? Number(scheduledFor) : null;
    const isSch = isScheduled === true || isScheduled === "true";
    const nowTs = Date.now();
    const timeFormatted = new Date(nowTs).toLocaleTimeString("en-US", {
      timeZone: "Asia/Phnom_Penh",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    const msgLower = String(message || "").toLowerCase();
    const explicitlyAsksForAgent =
      Boolean(escalateToAgent) ||
      Boolean(
        msgLower.match(
          /human|ភ្នាក់ងារ|មនុស្ស|ជួបបុគ្គលិក|បុគ្គលិក|live agent/,
        ),
      );
    const isUrgentKeywords = Boolean(
      msgLower.match(/បាត់លុយ|កាត់លុយ|វេរអត់ចូល|លុយអត់ចូល|ជាប់សោ|បន្ទាន់/),
    );

    // 🎯 គោលការណ៍ដែកថែប៖
    // - បើអតិថិជនកំពុងនៅក្នុង Mode Bot (requestAiBotReply === true) ហើយមិនបានចុចសុំជួបភ្នាក់ងារទេ គឺបិទ needsSupport = false ដាច់ខាត!
    if (canonicalReceiverId === "ADMIN" && sender._id) {
      if (explicitlyAsksForAgent) {
        sender.needsSupport = true;
        sender.chatStatus = isUrgentKeywords ? "urgent" : "pending";
        sender.chatSentiment = isUrgentKeywords ? "angry" : "neutral";
        await sender.save();
      } else if (requestAiBotReply) {
        if (sender.needsSupport) {
          sender.needsSupport = false;
          await sender.save();
        }
      } else if (sender.needsSupport) {
        // កំពុងជជែកជាមួយភ្នាក់ងារស្រាប់
        if (isUrgentKeywords) {
          sender.chatStatus = "urgent";
          sender.chatSentiment = "angry";
          await sender.save();
        }
      }
    }

    const msgPayload = {
      id: "MSG-" + nowTs + "-" + Math.floor(100 + Math.random() * 899),
      senderId: canonicalSenderId,
      receiverId: canonicalReceiverId,
      message: String(message || "").trim() || "ឯកសារភ្ជាប់ 📁",
      time: timeFormatted,
      timestamp: nowTs,
      // បើគ្រាន់តែសួរ Bot មិនបាច់ដាក់ isRead: false ឱ្យលោតលេខក្រហមក្នុង Admin ទេ
      isRead:
        canonicalReceiverId === "ADMIN" && !sender.needsSupport ? true : false,
    };

    if (replyToId) msgPayload.replyToId = replyToId;
    if (forwardedFrom) msgPayload.forwardedFrom = forwardedFrom;
    if (forwardedFromAcc) msgPayload.forwardedFromId = forwardedFromAcc;
    if (imageUrl) msgPayload.imageUrl = imageUrl;
    if (audioUrl) msgPayload.audioUrl = audioUrl;
    if (fileUrl) {
      msgPayload.fileUrl = fileUrl;
      if (fileName) msgPayload.fileName = fileName;
      if (fileSize) msgPayload.fileSize = fileSize;
    }
    if (Number(autoDeleteTimer) > 0) {
      msgPayload.autoDeleteTimer = Number(autoDeleteTimer);
    }
    if (isSch && scheduledNum) {
      msgPayload.isScheduled = true;
      msgPayload.scheduledFor = scheduledNum;
    }

    const newMessage = await Chat.create(msgPayload);

    const io = req.app ? req.app.get("io") : global.io;

    // 🤖 ប្រសិនបើអតិថិជនកំពុងសួរ Bot ឬទើបតែចុចសុំជួបភ្នាក់ងារ
    let botMessageDoc = null;
    if (
      canonicalReceiverId === "ADMIN" &&
      canonicalSenderId !== "ADMIN" &&
      (requestAiBotReply || explicitlyAsksForAgent) &&
      !isSch
    ) {
      const botRes = await generateSmartCustomerBotReply(
        explicitlyAsksForAgent ? "ភ្នាក់ងារ (Human)" : msgPayload.message,
        sender.fullName || sender.username,
      );

      if (botRes.switchedToAgent && sender._id) {
        sender.needsSupport = true;
        sender.chatStatus = botRes.isUrgent ? "urgent" : "pending";
        await sender.save();
      }

      const botNow = Date.now();
      botMessageDoc = await Chat.create({
        id: "MSG-BOT-" + botNow,
        senderId: "ADMIN",
        receiverId: canonicalSenderId,
        adminName: "UPAY_BOT",
        message: botRes.reply,
        time: new Date(botNow).toLocaleTimeString("en-US", {
          timeZone: "Asia/Phnom_Penh",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        }),
        timestamp: botNow,
        isRead: true,
      });

      if (io) {
        io.emit("new_chat_message", {
          ...botMessageDoc.toObject(),
          needsSupport: Boolean(sender.needsSupport),
        });
      }
    } else if (io && !isSch) {
      io.emit("new_chat_message", {
        ...newMessage.toObject(),
        needsSupport: Boolean(sender.needsSupport),
      });
    }

    res.json({
      success: true,
      message: newMessage,
      botReply: botMessageDoc,
      needsSupport: Boolean(sender.needsSupport),
    });
  } catch (err) {
    console.error("User Send Chat Error:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

const chatHistory = async (req, res) => {
  const { user1Acc, user2Acc, user1Id, user2Id } = req.body;
  try {
    const u1 = await findUserByAnyIdentifier(user1Id || user1Acc);
    const u2 = await findUserByAnyIdentifier(user2Id || user2Acc);

    if (u1 && u1._id !== "ADMIN") {
      await touchUserPresence(u1);
    }

    const u1Variants = getAllUserIdentifiers(u1, user1Id || user1Acc);
    const u2Variants = getAllUserIdentifiers(u2, user2Id || user2Acc);
    const canonicalU1 =
      extractCanonicalUserId(u1) || String(user1Id || user1Acc);
    const canonicalU2 =
      extractCanonicalUserId(u2) || String(user2Id || user2Acc);

    const unreadMsgs = await Chat.find({
      $and: [
        {
          $or: [
            { receiverId: { $in: u1Variants } },
            { receiverAcc: { $in: u1Variants } },
          ],
        },
        {
          $or: [
            { senderId: { $in: u2Variants } },
            { senderAcc: { $in: u2Variants } },
          ],
        },
        { isRead: false },
        { isScheduled: { $ne: true } },
      ],
    });

    if (unreadMsgs.length > 0) {
      for (const msg of unreadMsgs) {
        msg.isRead = true;
        if (msg.autoDeleteTimer > 0 && !msg.expiresAt) {
          msg.expiresAt = new Date(Date.now() + msg.autoDeleteTimer * 1000);
        }
        if (!msg.senderId) msg.senderId = canonicalU2;
        if (!msg.receiverId) msg.receiverId = canonicalU1;
        await msg.save();
      }

      const io = req.app ? req.app.get("io") : global.io;
      if (io) {
        io.emit("chat_messages_read", {
          readerId: canonicalU1,
          senderId: canonicalU2,
        });
      }
    }

    let history = await Chat.find({
      $and: [
        {
          $or: [
            {
              $and: [
                {
                  $or: [
                    { senderId: { $in: u1Variants } },
                    { senderAcc: { $in: u1Variants } },
                  ],
                },
                {
                  $or: [
                    { receiverId: { $in: u2Variants } },
                    { receiverAcc: { $in: u2Variants } },
                  ],
                },
              ],
            },
            {
              $and: [
                {
                  $or: [
                    { senderId: { $in: u2Variants } },
                    { senderAcc: { $in: u2Variants } },
                  ],
                },
                {
                  $or: [
                    { receiverId: { $in: u1Variants } },
                    { receiverAcc: { $in: u1Variants } },
                  ],
                },
              ],
            },
          ],
        },
        { isScheduled: { $ne: true } },
      ],
    })
      .sort({ timestamp: 1 })
      .lean();

    history = history.filter(
      (m) =>
        !Array.isArray(m.deletedBy) ||
        !m.deletedBy.some((d) => u1Variants.includes(String(d))),
    );

    const scheduledCount = await Chat.countDocuments({
      $or: [
        { senderId: { $in: u1Variants }, receiverId: { $in: u2Variants } },
        { senderAcc: { $in: u1Variants }, receiverAcc: { $in: u2Variants } },
      ],
      isScheduled: true,
    });

    const partnerPresence =
      u2 && u2._id !== "ADMIN"
        ? {
            partnerId: String(u2._id),
            accountNumber: extractPrimaryAcc(u2),
            name: u2.fullName || u2.username,
            username: u2.username || "",
            profileImage: u2.profileImage || "",
            isOnline: isUserReallyOnline(u2),
            lastActive: u2.lastActive || null,
          }
        : {
            partnerId: "ADMIN",
            accountNumber: "ADMIN",
            name: "U-PAY Assistant",
            isOnline: true,
            lastActive: new Date().toISOString(),
          };

    res.json({
      success: true,
      history,
      hasScheduled: scheduledCount > 0,
      partnerPresence,
    });
  } catch (err) {
    res.status(500).json({ success: false, history: [] });
  }
};

const chatContacts = async (req, res) => {
  const { myAcc, myId } = req.body;
  try {
    const meUser = await findUserByAnyIdentifier(myId || myAcc);
    if (!meUser) return res.json({ success: true, contacts: [] });

    await touchUserPresence(meUser);
    const myVariants = getAllUserIdentifiers(meUser, myId || myAcc);

    let chats = await Chat.find({
      $and: [
        {
          $or: [
            { senderId: { $in: myVariants } },
            { receiverId: { $in: myVariants } },
            { senderAcc: { $in: myVariants } },
            { receiverAcc: { $in: myVariants } },
          ],
        },
        { isScheduled: { $ne: true } },
      ],
    })
      .sort({ timestamp: 1 })
      .lean();

    chats = chats.filter(
      (c) =>
        !Array.isArray(c.deletedBy) ||
        !c.deletedBy.some((d) => myVariants.includes(String(d))),
    );

    const allUsers = await User.find({})
      .select(
        "_id username fullName name profileImage mainAccounts accountNumber accountNumberKHR isOnline lastActive",
      )
      .lean();

    const contactMap = {};

    for (const c of chats) {
      const sKey = c.senderId || c.senderAcc;
      const rKey = c.receiverId || c.receiverAcc;
      const isMeSender = myVariants.includes(String(sKey));
      const rawPartnerKey = isMeSender ? rKey : sKey;

      if (
        !rawPartnerKey ||
        rawPartnerKey === "ADMIN" ||
        rawPartnerKey === "UPAY_BOT"
      ) {
        continue;
      }

      const partnerDoc = allUsers.find((u) =>
        getAllUserIdentifiers(u).includes(String(rawPartnerKey)),
      );
      if (!partnerDoc) continue;

      const canonicalPartnerId = String(partnerDoc._id);
      const displayAccNum = extractPrimaryAcc(partnerDoc);
      const pName =
        partnerDoc.fullName || partnerDoc.name || partnerDoc.username;
      const partnerVars = getAllUserIdentifiers(partnerDoc);

      const unreadCount = chats.filter((m) => {
        const mSender = String(m.senderId || m.senderAcc || "");
        const mReceiver = String(m.receiverId || m.receiverAcc || "");
        return (
          myVariants.includes(mReceiver) &&
          partnerVars.includes(mSender) &&
          !m.isRead
        );
      }).length;

      contactMap[canonicalPartnerId] = {
        partnerId: canonicalPartnerId,
        accountNumber: displayAccNum,
        name: pName,
        fullName: pName,
        username: partnerDoc.username || "",
        profileImage: partnerDoc.profileImage || "",
        lastMessage: c.message,
        lastMsgIsMine: isMeSender,
        lastMsgRead: Boolean(c.isRead),
        time: c.time,
        timestamp: c.timestamp,
        unreadCount,
        isOnline: isUserReallyOnline(partnerDoc),
        lastActive: partnerDoc.lastActive || null,
      };
    }

    const activeContacts = Object.values(contactMap).sort(
      (a, b) => b.timestamp - a.timestamp,
    );

    res.json({ success: true, contacts: activeContacts });
  } catch (err) {
    res.status(500).json({ success: false, contacts: [] });
  }
};

const checkChatUser = async (req, res) => {
  const { accountNumber, identifier } = req.body;
  try {
    const targetUser = await findUserByAnyIdentifier(
      identifier || accountNumber,
    );
    if (targetUser && targetUser._id !== "ADMIN") {
      res.json({
        success: true,
        partnerId: String(targetUser._id),
        name: targetUser.fullName || targetUser.username,
        username: targetUser.username || "",
        accountNumber: extractPrimaryAcc(targetUser),
        profileImage: targetUser.profileImage || "",
        isOnline: isUserReallyOnline(targetUser),
        lastActive: targetUser.lastActive || null,
      });
    } else {
      res.json({
        success: false,
        message: "រកមិនឃើញគណនី ឬឈ្មោះអ្នកប្រើប្រាស់នេះទេ!",
      });
    }
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

const deleteMsg = async (req, res) => {
  const { msgId, deleteType, reqAcc, reqId } = req.body;
  try {
    const msg = await Chat.findOne({ id: msgId });
    if (!msg) return res.json({ success: false });
    if (deleteType === "everyone") {
      await Chat.deleteOne({ id: msgId });
    } else if (deleteType === "me") {
      const actor = String(reqId || reqAcc || "");
      if (!Array.isArray(msg.deletedBy)) msg.deletedBy = [];
      if (!msg.deletedBy.includes(actor)) {
        msg.deletedBy.push(actor);
        await msg.save();
      }
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

const deleteConvo = async (req, res) => {
  const { myAcc, targetAcc, myId, targetId } = req.body;
  try {
    const u1 = await findUserByAnyIdentifier(myId || myAcc);
    const u2 = await findUserByAnyIdentifier(targetId || targetAcc);
    const v1 = getAllUserIdentifiers(u1, myId || myAcc);
    const v2 = getAllUserIdentifiers(u2, targetId || targetAcc);
    const actor = extractCanonicalUserId(u1) || String(myId || myAcc);

    const chats = await Chat.find({
      $or: [
        { senderId: { $in: v1 }, receiverId: { $in: v2 } },
        { senderId: { $in: v2 }, receiverId: { $in: v1 } },
        { senderAcc: { $in: v1 }, receiverAcc: { $in: v2 } },
        { senderAcc: { $in: v2 }, receiverAcc: { $in: v1 } },
      ],
    });

    for (const c of chats) {
      if (!Array.isArray(c.deletedBy)) c.deletedBy = [];
      v1.forEach((idKey) => {
        if (!c.deletedBy.includes(idKey)) c.deletedBy.push(idKey);
      });
      if (!c.deletedBy.includes(actor)) c.deletedBy.push(actor);
      await c.save();
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

const toggleReaction = async (req, res) => {
  const { msgId, emoji, userAcc, userId } = req.body;
  try {
    const msg = await Chat.findOne({ id: msgId });
    if (!msg) return res.json({ success: false, message: "រកមិនឃើញសារ!" });
    const actor = String(userId || userAcc || "");
    if (!Array.isArray(msg.reactions)) msg.reactions = [];

    const existingIdx = msg.reactions.findIndex(
      (r) => (r.userId === actor || r.userAcc === actor) && r.emoji === emoji,
    );
    if (existingIdx > -1) msg.reactions.splice(existingIdx, 1);
    else msg.reactions.push({ emoji, userId: actor, userAcc: actor });

    msg.markModified("reactions");
    await msg.save();
    res.json({ success: true, reactions: msg.reactions });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

const globalSearch = async (req, res) => {
  const { myAcc, myId, keyword } = req.body;
  try {
    if (!keyword || keyword.trim() === "")
      return res.json({ success: true, contacts: [], messages: [] });

    const meUser = await findUserByAnyIdentifier(myId || myAcc);
    const myVariants = getAllUserIdentifiers(meUser, myId || myAcc);
    const canonicalMe = extractCanonicalUserId(meUser);

    const cleanKw = keyword.replace(/^@/, "").trim();
    const regex = new RegExp(
      cleanKw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "i",
    );

    const matchedUsers = await User.find({
      role: { $ne: "admin" },
      $or: [
        { fullName: regex },
        { username: regex },
        { phone: regex },
        { "mainAccounts.USD.accountNumber": regex },
        { "mainAccounts.KHR.accountNumber": regex },
      ],
    })
      .limit(12)
      .lean();

    const formattedContacts = matchedUsers
      .filter((u) => String(u._id) !== canonicalMe)
      .map((u) => ({
        partnerId: String(u._id),
        accountNumber: extractPrimaryAcc(u),
        fullName: u.fullName || u.username,
        username: u.username || "",
        profileImage: u.profileImage || "",
        isOnline: isUserReallyOnline(u),
        lastActive: u.lastActive || null,
      }));

    const messages = await Chat.find({
      $and: [
        {
          $or: [
            { senderId: { $in: myVariants } },
            { receiverId: { $in: myVariants } },
            { senderAcc: { $in: myVariants } },
            { receiverAcc: { $in: myVariants } },
          ],
        },
        { message: regex },
        { isScheduled: { $ne: true } },
      ],
    })
      .sort({ timestamp: -1 })
      .limit(20)
      .lean();

    const formattedMessages = await Promise.all(
      messages.map(async (msg) => {
        const sKey = msg.senderId || msg.senderAcc;
        const rKey = msg.receiverId || msg.receiverAcc;
        const rawPartner = myVariants.includes(String(sKey)) ? rKey : sKey;

        if (rawPartner === "ADMIN") {
          return {
            id: msg.id,
            partnerId: "ADMIN",
            partnerAcc: "ADMIN",
            partnerName: "U-PAY Support",
            partnerAvatar: "",
            message: msg.message,
            time: msg.time,
            timestamp: msg.timestamp,
          };
        }
        const partner = await findUserByAnyIdentifier(rawPartner);
        return {
          id: msg.id,
          partnerId: partner ? String(partner._id) : String(rawPartner),
          partnerAcc: partner ? extractPrimaryAcc(partner) : String(rawPartner),
          partnerName: partner
            ? partner.fullName || partner.username
            : `គណនី #${rawPartner}`,
          partnerAvatar: partner ? partner.profileImage || "" : "",
          message: msg.message,
          time: msg.time,
          timestamp: msg.timestamp,
        };
      }),
    );

    res.json({
      success: true,
      contacts: formattedContacts,
      messages: formattedMessages,
    });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

const editMsg = async (req, res) => {
  const { msgId, newText } = req.body;
  try {
    const msg = await Chat.findOne({ id: msgId });
    if (!msg) return res.json({ success: false, message: "រកមិនឃើញសារ!" });
    msg.message = newText;
    msg.isEdited = true;
    msg.editedAt = Date.now();
    await msg.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

const getScheduledMessages = async (req, res) => {
  const { userAcc, partnerAcc, userId, partnerId } = req.body;
  try {
    const u1 = await findUserByAnyIdentifier(userId || userAcc);
    const u2 = await findUserByAnyIdentifier(partnerId || partnerAcc);
    const v1 = getAllUserIdentifiers(u1, userId || userAcc);
    const v2 = getAllUserIdentifiers(u2, partnerId || partnerAcc);

    const scheduledMsgs = await Chat.find({
      $or: [
        { senderId: { $in: v1 }, receiverId: { $in: v2 } },
        { senderAcc: { $in: v1 }, receiverAcc: { $in: v2 } },
      ],
      isScheduled: true,
    }).sort({ scheduledFor: 1 });
    res.json({ success: true, history: scheduledMsgs });
  } catch (err) {
    res.status(500).json({ success: false, history: [] });
  }
};

const togglePinMsg = async (req, res) => {
  const { msgId } = req.body;
  try {
    const msg = await Chat.findOne({ id: msgId });
    if (!msg) return res.json({ success: false, message: "រកមិនឃើញសារនេះទេ!" });
    msg.isPinned = !msg.isPinned;
    await msg.save();
    res.json({ success: true, isPinned: msg.isPinned });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

module.exports = {
  createTicket,
  getNotifications,
  readNotifications,
  readSingleNotification,
  sendChat,
  chatHistory,
  chatContacts,
  checkChatUser,
  deleteMsg,
  deleteConvo,
  togglePinMsg,
  toggleReaction,
  globalSearch,
  editMsg,
  getScheduledMessages,
};

// រ៉ូបូតបញ្ជូនសារកំណត់ម៉ោងស្វ័យប្រវត្តិ
setInterval(async () => {
  try {
    if (mongoose.connection.readyState !== 1) return;
    const now = Date.now();
    const dueMessages = await Chat.find({
      isScheduled: true,
      scheduledFor: { $lte: now, $ne: null },
    });

    for (const msg of dueMessages) {
      msg.isScheduled = undefined;
      msg.scheduledFor = undefined;
      msg.timestamp = now;
      msg.time = new Date(now).toLocaleTimeString("en-US", {
        timeZone: "Asia/Phnom_Penh",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
      await msg.save();
    }
  } catch (err) {}
}, 2000);
