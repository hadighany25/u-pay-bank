const User = require("../models/User");
const Chat = require("../models/Chat");
const { getFormattedDate } = require("../services/helpers");

// 🛡️ មុខងារបិទបាំងទិន្នន័យសម្ងាត់
const maskSensitiveData = (text) => {
  if (!text) return text;
  let safeText = text.replace(/\b\d{6,}\b/g, "[លេខត្រូវបានលាក់]");
  safeText = safeText.replace(
    /(0\d{2}[-\s]?\d{3}[-\s]?\d{3,4})/g,
    "[លេខទូរស័ព្ទត្រូវបានលាក់]",
  );
  return safeText;
};

// === ផ្នែក TICKET & NOTIFICATIONS ===
const createTicket = async (req, res) => {
  const { username, subject, description, priority } = req.body;
  try {
    const user = await User.findOne({ username });
    if (user) {
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
    } else res.json({ success: false });
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
    if (user && user.notifications) {
      user.notifications.forEach((n) => (n.isRead = true));
      user.markModified("notifications");
      await user.save();
      res.json({ success: true });
    } else res.json({ success: false });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

const broadcast = async (req, res) => {
  const { title, message, sender } = req.body;
  const sharedNotifId = "BC-" + Date.now();
  try {
    const result = await User.updateMany(
      { role: { $ne: "admin" } },
      {
        $push: {
          notifications: {
            $each: [
              {
                id: sharedNotifId,
                title,
                message,
                sender: sender || "admin",
                date: new Date().toLocaleString(),
                isRead: false,
              },
            ],
            $position: 0,
          },
        },
      },
    );
    res.json({ success: true, count: result.matchedCount });
  } catch (error) {
    res.status(500).json({ success: false });
  }
};

const deleteBroadcast = async (req, res) => {
  const { notifId } = req.body;
  try {
    await User.updateMany(
      { "notifications.id": notifId },
      { $pull: { notifications: { id: notifId } } },
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

// === ផ្នែក CHAT SYSTEM ===
const sendChat = async (req, res) => {
  const {
    senderAcc,
    receiverAcc,
    message,
    adminName,
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
  } = req.body;

  try {
    const getAcc = async (acc) => {
      if (acc === "ADMIN") return { accountNumber: "ADMIN" };
      return await User.findOne({
        $or: [{ accountNumber: acc }, { accountNumberKHR: acc }],
      });
    };
    const sender = await getAcc(senderAcc);
    const receiver = await getAcc(receiverAcc);
    if (!sender || !receiver)
      return res.json({ success: false, message: "រកមិនឃើញគណនីនេះទេ!" });

    if (
      senderAcc === "ADMIN" &&
      message.includes("ការសន្ទនាត្រូវបានបញ្ចប់ដោយ Admin")
    ) {
      const realUser = await User.findOne({
        accountNumber: receiver.accountNumber,
      });
      if (realUser) {
        realUser.needsSupport = false;
        realUser.chatStatus = "resolved";
        await realUser.save();
      }
    } else if (senderAcc !== "ADMIN") {
      const realUser = await User.findOne({
        accountNumber: sender.accountNumber,
      });
      if (realUser) {
        if (
          !realUser.needsSupport &&
          (message.toLowerCase().includes("human") ||
            message.includes("ភ្នាក់ងារ"))
        ) {
          realUser.needsSupport = true;
        }
        if (receiverAcc === "ADMIN") {
          try {
            const apiKey = process.env.GROQ_API_KEY
              ? process.env.GROQ_API_KEY.trim().replace(/^["'](.+)["']$/, "$1")
              : "";
            if (apiKey) {
              const safeMessageForAI =
                typeof maskSensitiveData === "function"
                  ? maskSensitiveData(message)
                  : message;
              const aiRes = await fetch(
                "https://api.groq.com/openai/v1/chat/completions",
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${apiKey}`,
                  },
                  body: JSON.stringify({
                    model: "llama-3.1-8b-instant",
                    messages: [
                      {
                        role: "system",
                        content: `You are a sentiment analyzer for U-PAY bank. Read the message and reply with EXACTLY ONE WORD: - 'angry' (Keywords: "បាត់លុយ", "គាំង", "យឺត", "ខឹង", "អត់ដើរ", "លុយអត់ចូល", "កាត់លុយ", "ជួយផង") - 'happy' (Keywords: "អរគុណ", "ល្អ", "ok", "បានហើយ") - 'neutral' User Message: "${safeMessageForAI}"`,
                      },
                    ],
                    temperature: 0.1,
                    max_tokens: 10,
                  }),
                },
              );
              const aiData = await aiRes.json();
              if (aiData.choices && aiData.choices.length > 0) {
                let mood = aiData.choices[0].message.content
                  .trim()
                  .toLowerCase();
                if (mood.includes("angry")) {
                  realUser.chatSentiment = "angry";
                  realUser.chatStatus = "urgent";
                } else if (mood.includes("happy")) {
                  realUser.chatSentiment = "happy";
                  realUser.chatStatus = "pending";
                } else {
                  realUser.chatSentiment = "neutral";
                  realUser.chatStatus = "pending";
                }
              }
            }
          } catch (e) {
            console.error("AI Sentiment Error:", e);
          }
        }
        await realUser.save();
      }
    }

    const scheduledNum = scheduledFor ? Number(scheduledFor) : null;
    const isSch = isScheduled === true || isScheduled === "true";

    const newMessage = new Chat({
      id: "MSG-" + Date.now(),
      senderAcc: sender.accountNumber || "ADMIN",
      receiverAcc: receiver.accountNumber || "ADMIN",
      message: message,
      adminName: senderAcc === "ADMIN" ? adminName || "Support Agent" : null,
      time:
        typeof getFormattedDate === "function"
          ? getFormattedDate()
          : new Date().toLocaleString(),
      timestamp: Date.now(),
      isRead: false,
      replyToId: replyToId || null,
      forwardedFrom: forwardedFrom || null,
      forwardedFromAcc: forwardedFromAcc || null,
      imageUrl: imageUrl || null,
      audioUrl: audioUrl || null,
      fileUrl: fileUrl || null,
      fileName: fileName || null,
      fileSize: fileSize || null,
      autoDeleteTimer: autoDeleteTimer || 0,
      expiresAt: null,
      isScheduled: isSch,
      scheduledFor: scheduledNum,
    });

    await newMessage.save();
    res.json({ success: true, message: newMessage });
  } catch (err) {
    res.status(500).json({ success: false });
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

const chatHistory = async (req, res) => {
  const { user1Acc, user2Acc } = req.body;
  try {
    let history = await Chat.find({
      $or: [
        { senderAcc: user1Acc, receiverAcc: user2Acc },
        { senderAcc: user2Acc, receiverAcc: user1Acc },
      ],
      isScheduled: { $ne: true },
    });
    history = history.filter((m) => !m.deletedBy.includes(user1Acc));

    const unreadMsgs = await Chat.find({
      receiverAcc: user1Acc,
      senderAcc: user2Acc,
      isRead: false,
    });

    for (const msg of unreadMsgs) {
      msg.isRead = true;
      if (msg.autoDeleteTimer > 0 && !msg.expiresAt) {
        msg.expiresAt = new Date(Date.now() + msg.autoDeleteTimer * 1000);
      }
      await msg.save();
    }

    let updatedHistory = await Chat.find({
      $or: [
        { senderAcc: user1Acc, receiverAcc: user2Acc },
        { senderAcc: user2Acc, receiverAcc: user1Acc },
      ],
      isScheduled: { $ne: true },
    });
    updatedHistory = updatedHistory.filter(
      (m) => !m.deletedBy.includes(user1Acc),
    );

    // 🔥 ទាញយកចំនួនសារដែល Scheduled
    const scheduledCount = await Chat.countDocuments({
      senderAcc: user1Acc,
      receiverAcc: user2Acc,
      isScheduled: true,
    });

    // ផ្ញើ hasScheduled ទៅអោយ Frontend
    res.json({
      success: true,
      history: updatedHistory,
      hasScheduled: scheduledCount > 0,
    });
  } catch (err) {
    res.status(500).json({ success: false, history: [] });
  }
};

const chatContacts = async (req, res) => {
  const { myAcc } = req.body;
  try {
    let chats = await Chat.find({
      $or: [{ senderAcc: myAcc }, { receiverAcc: myAcc }],
      isScheduled: { $ne: true },
    });
    chats = chats.filter((c) => !c.deletedBy.includes(myAcc));
    const users = await User.find({});
    let contactMap = {};

    for (let c of chats) {
      const partnerAcc = c.senderAcc === myAcc ? c.receiverAcc : c.senderAcc;
      let isValidToDisplay = true,
        pName = "Unknown",
        pImg = "",
        pStatus = "pending",
        pSentiment = "neutral";

      if (partnerAcc === "ADMIN") {
        pName = "U-PAY Support";
        pImg =
          "https://ui-avatars.com/api/?name=Support&background=004d40&color=fff";
      } else {
        const partnerInfo = users.find((u) => u.accountNumber === partnerAcc);
        if (partnerInfo) {
          pName = partnerInfo.fullName || partnerInfo.username;
          pImg = partnerInfo.profileImage;
          pStatus = partnerInfo.chatStatus || "pending";
          pSentiment = partnerInfo.chatSentiment || "neutral";
          if (myAcc === "ADMIN" && !partnerInfo.needsSupport)
            isValidToDisplay = false;
        }
      }

      if (isValidToDisplay) {
        if (
          !contactMap[partnerAcc] ||
          contactMap[partnerAcc].timestamp < c.timestamp
        ) {
          const unreadCount = chats.filter(
            (m) =>
              m.receiverAcc === myAcc &&
              m.senderAcc === partnerAcc &&
              !m.isRead,
          ).length;
          contactMap[partnerAcc] = {
            accountNumber: partnerAcc,
            name: pName,
            profileImage: pImg,
            lastMessage: c.message,
            time: c.time,
            timestamp: c.timestamp,
            unreadCount: unreadCount,
            status: pStatus,
            sentiment: pSentiment,
          };
        }
      }
    }
    const activeContacts = Object.values(contactMap)
      .filter((c) => {
        if (
          myAcc === "ADMIN" &&
          c.lastMessage.includes("ការសន្ទនាត្រូវបានបញ្ចប់ដោយ Admin")
        )
          return false;
        return true;
      })
      .sort((a, b) => b.timestamp - a.timestamp);
    res.json({ success: true, contacts: activeContacts });
  } catch (err) {
    res.status(500).json({ success: false, contacts: [] });
  }
};

const checkChatUser = async (req, res) => {
  const { accountNumber } = req.body;
  try {
    const targetUser = await User.findOne({
      $or: [
        { accountNumber: accountNumber },
        { accountNumberKHR: accountNumber },
      ],
    });
    if (targetUser)
      res.json({
        success: true,
        name: targetUser.fullName || targetUser.username,
        accountNumber: targetUser.accountNumber,
        profileImage: targetUser.profileImage,
      });
    else res.json({ success: false, message: "លេខគណនីមិនត្រឹមត្រូវទេ!" });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

const deleteMsg = async (req, res) => {
  const { msgId, deleteType, reqAcc } = req.body;
  try {
    const msg = await Chat.findOne({ id: msgId });
    if (!msg) return res.json({ success: false });
    if (deleteType === "everyone") {
      await Chat.deleteOne({ id: msgId });
    } else if (deleteType === "me") {
      if (!msg.deletedBy.includes(reqAcc)) {
        msg.deletedBy.push(reqAcc);
        await msg.save();
      }
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

const deleteConvo = async (req, res) => {
  const { myAcc, targetAcc } = req.body;
  try {
    const chats = await Chat.find({
      $or: [
        { senderAcc: myAcc, receiverAcc: targetAcc },
        { senderAcc: targetAcc, receiverAcc: myAcc },
      ],
    });
    for (let c of chats) {
      if (!c.deletedBy.includes(myAcc)) {
        c.deletedBy.push(myAcc);
        await c.save();
      }
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

const forceStartChat = async (req, res) => {
  const { receiverAcc } = req.body;
  try {
    const user = await User.findOne({
      $or: [{ accountNumber: receiverAcc }, { accountNumberKHR: receiverAcc }],
    });
    if (!user)
      return res.json({ success: false, message: "រកមិនឃើញគណនីនេះទេ!" });
    user.needsSupport = true;
    await user.save();
    res.json({
      success: true,
      message: "Chat បានត្រៀមរួចរាល់",
      userAcc: user.accountNumber,
    });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

const updateChatStatus = async (req, res) => {
  const { userAcc, status } = req.body;
  try {
    const user = await User.findOne({ accountNumber: userAcc });
    if (user) {
      user.chatStatus = status;
      await user.save();
      res.json({ success: true });
    } else res.json({ success: false, message: "រកមិនឃើញគណនី!" });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

const toggleReaction = async (req, res) => {
  const { msgId, emoji, userAcc } = req.body;
  try {
    const msg = await Chat.findOne({ id: msgId });
    if (!msg) return res.json({ success: false, message: "រកមិនឃើញសារ!" });
    const existingIdx = msg.reactions.findIndex(
      (r) => r.userAcc === userAcc && r.emoji === emoji,
    );
    if (existingIdx > -1) msg.reactions.splice(existingIdx, 1);
    else msg.reactions.push({ emoji, userAcc });
    msg.markModified("reactions");
    await msg.save();
    res.json({ success: true, reactions: msg.reactions });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

const globalSearch = async (req, res) => {
  const { myAcc, keyword } = req.body;
  try {
    if (!keyword || keyword.trim() === "")
      return res.json({ success: true, contacts: [], messages: [] });
    const regex = new RegExp(keyword, "i");
    const history = await Chat.find({
      $or: [{ senderAcc: myAcc }, { receiverAcc: myAcc }],
    });
    const chattedAccs = new Set();
    history.forEach((msg) => {
      if (msg.senderAcc !== myAcc && msg.senderAcc !== "ADMIN")
        chattedAccs.add(msg.senderAcc);
      if (msg.receiverAcc !== myAcc && msg.receiverAcc !== "ADMIN")
        chattedAccs.add(msg.receiverAcc);
    });
    const contacts = await User.find({
      accountNumber: { $in: Array.from(chattedAccs) },
      $or: [
        { fullName: regex },
        { name: regex },
        { username: regex },
        { accountNumber: regex },
      ],
    }).limit(10);
    const messages = await Chat.find({
      $and: [
        { $or: [{ senderAcc: myAcc }, { receiverAcc: myAcc }] },
        { message: regex },
        { deletedFor: { $ne: myAcc } },
      ],
    })
      .sort({ timestamp: -1 })
      .limit(20);
    const formattedMessages = await Promise.all(
      messages.map(async (msg) => {
        let partnerAcc =
          msg.senderAcc === myAcc ? msg.receiverAcc : msg.senderAcc;
        let partnerName = "Unknown",
          partnerAvatar = "";
        if (partnerAcc === "ADMIN") partnerName = "U-PAY Support";
        else {
          const partner = await User.findOne({ accountNumber: partnerAcc });
          if (partner) {
            partnerName =
              partner.fullName ||
              partner.name ||
              partner.username ||
              partner.accountNumber;
            partnerAvatar = partner.profileImage || "";
          }
        }
        return {
          id: msg.id,
          partnerAcc,
          partnerName,
          partnerAvatar,
          message: msg.message,
          time: msg.time,
          timestamp: msg.timestamp,
        };
      }),
    );
    res.json({
      success: true,
      contacts: contacts,
      messages: formattedMessages,
    });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

const editMsg = async (req, res) => {
  const { msgId, newText, reqAcc } = req.body;
  try {
    const msg = await Chat.findOne({ id: msgId });
    if (!msg) return res.json({ success: false, message: "រកមិនឃើញសារ!" });
    if (msg.senderAcc !== reqAcc && reqAcc !== "ADMIN")
      return res.json({ success: false, message: "គ្មានសិទ្ធិ!" });
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
  const { userAcc, partnerAcc } = req.body;
  try {
    const scheduledMsgs = await Chat.find({
      senderAcc: userAcc,
      receiverAcc: partnerAcc,
      isScheduled: true,
    }).sort({ scheduledFor: 1 });
    res.json({ success: true, history: scheduledMsgs });
  } catch (err) {
    res.status(500).json({ success: false, history: [] });
  }
};

module.exports = {
  createTicket,
  getNotifications,
  readNotifications,
  broadcast,
  deleteBroadcast,
  sendChat,
  chatHistory,
  chatContacts,
  checkChatUser,
  deleteMsg,
  deleteConvo,
  forceStartChat,
  updateChatStatus,
  togglePinMsg,
  toggleReaction,
  globalSearch,
  editMsg,
  getScheduledMessages,
};

// =======================================================
// 🔥 កម្មវិធីរត់ស្វ័យប្រវត្តិ សម្រាប់ Scheduled Message (ល្បឿន ២ វិនាទី)
// =======================================================
setInterval(async () => {
  try {
    const now = Date.now();
    const dueMessages = await Chat.find({
      isScheduled: true,
      scheduledFor: { $lte: now, $ne: null },
    });

    for (let msg of dueMessages) {
      msg.isScheduled = false; // ដោះសោរ
      msg.timestamp = now;

      const d = new Date(now);
      const displayTime = d.toLocaleTimeString("en-US", {
        timeZone: "Asia/Phnom_Penh",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
      msg.time = displayTime;

      await msg.save();
    }
  } catch (err) {
    console.error("Error checking scheduled messages:", err);
  }
}, 2000);
