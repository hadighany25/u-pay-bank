// controllers/communicationController.js

const User = require("../models/User");
const Chat = require("../models/Chat");
const { getFormattedDate } = require("../services/helpers");

// 🛡️ មុខងារបិទបាំងទិន្នន័យសម្ងាត់ (ការពារមិនឱ្យ AI ដឹងលេខកាត ឬ លេខទូរស័ព្ទ)
const maskSensitiveData = (text) => {
  if (!text) return text;
  let safeText = text.replace(/\b\d{6,}\b/g, "[លេខត្រូវបានលាក់]");
  safeText = safeText.replace(
    /(0\d{2}[-\s]?\d{3}[-\s]?\d{3,4})/g,
    "[លេខទូរស័ព្ទត្រូវបានលាក់]",
  );
  return safeText;
};

// === ផ្នែក TICKET ===
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

// === ផ្នែក NOTIFICATIONS & BROADCAST ===
const getNotifications = async (req, res) => {
  res.json({
    hasNew: false,
    count: 0,
  });
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
  const { senderAcc, receiverAcc, message, adminName } = req.body;
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

    // ១. បើ Admin ជាអ្នកផ្ញើ
    if (
      senderAcc === "ADMIN" &&
      message.includes("ការសន្ទនាត្រូវបានបញ្ចប់ដោយ Admin")
    ) {
      const realUser = await User.findOne({
        accountNumber: receiver.accountNumber,
      });
      if (realUser) {
        realUser.needsSupport = false;
        realUser.chatStatus = "resolved"; // 🟢 ដោះស្រាយរួចពេល Admin បិទ Chat
        await realUser.save();
      }
    }
    // ២. បើ User ជាអ្នកផ្ញើទៅកាន់ Admin
    else if (senderAcc !== "ADMIN") {
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

        // 🤖 --- ចាប់ផ្តើម AI SENTIMENT ANALYSIS (វិភាគអារម្មណ៍) ---
        if (receiverAcc === "ADMIN") {
          try {
            const apiKey = process.env.GROQ_API_KEY
              ? process.env.GROQ_API_KEY.trim().replace(/^["'](.+)["']$/, "$1")
              : "";

            if (apiKey) {
              // 🛡️ បិទបាំងទិន្នន័យ មុនបញ្ជូនទៅ AI
              const safeMessageForAI = maskSensitiveData(message);

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
                        content: `You are a sentiment analyzer for U-PAY bank. Read the message and reply with EXACTLY ONE WORD:
                      - 'angry' (If user complains, urgent, angry. Keywords: "បាត់លុយ", "គាំង", "យឺត", "ខឹង", "អត់ដើរ", "លុយអត់ចូល", "កាត់លុយ", "ជួយផង")
                      - 'happy' (If user is satisfied. Keywords: "អរគុណ", "ល្អ", "ok", "បានហើយ")
                      - 'neutral' (Normal chat. Keywords: "សួស្តី", "សួរតិច")
                      
                      User Message: "${safeMessageForAI}"`,
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
                  realUser.chatStatus = "urgent"; // 🟢 បើខឹង ដាក់ Status ជាបន្ទាន់(Urgent) ស្វ័យប្រវត្តិ
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
        // 🤖 --- បញ្ចប់ការវិភាគ ---

        await realUser.save();
      }
    }

    // ត្រង់កន្លែងបង្កើត newMessage ក្នុង sendChat៖
    const newMessage = new Chat({
      id: "MSG-" + Date.now(),
      senderAcc: sender.accountNumber || "ADMIN",
      receiverAcc: receiver.accountNumber || "ADMIN",
      message: message,
      // 🟢 បើ senderAcc ជា ADMIN ត្រូវบังคับឱ្យវាប្រើ adminName ដែលផ្ញើមក (ពោលគឺ Nickname) បើគ្មានទើបប្រើ Support Agent
      adminName: senderAcc === "ADMIN" ? adminName || "Support Agent" : null,
      time: getFormattedDate(),
      timestamp: Date.now(),
      isRead: false,
    });
    await newMessage.save();
    res.json({ success: true, message: newMessage });
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
    });
    history = history.filter((m) => !m.deletedBy.includes(user1Acc));
    await Chat.updateMany(
      { receiverAcc: user1Acc, senderAcc: user2Acc, isRead: false },
      { $set: { isRead: true } },
    );
    res.json({ success: true, history: history });
  } catch (err) {
    res.status(500).json({ success: false, history: [] });
  }
};

const chatContacts = async (req, res) => {
  const { myAcc } = req.body;
  try {
    let chats = await Chat.find({
      $or: [{ senderAcc: myAcc }, { receiverAcc: myAcc }],
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
  const { receiverAcc, adminName } = req.body;
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

// 🟢 មុខងារសម្រាប់ Update Status ពេល Admin ចុចដូរនៅលើ Dashboard
const updateChatStatus = async (req, res) => {
  const { userAcc, status } = req.body;
  try {
    const user = await User.findOne({ accountNumber: userAcc });
    if (user) {
      user.chatStatus = status;
      await user.save();
      res.json({ success: true });
    } else {
      res.json({ success: false, message: "រកមិនឃើញគណនី!" });
    }
  } catch (err) {
    res.status(500).json({ success: false });
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
};
