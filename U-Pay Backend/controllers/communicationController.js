const User = require("../models/User");
const Chat = require("../models/Chat");
const { getFormattedDate } = require("../services/helpers");

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
  /* កូដ session ក្នុង file ដើមមានបញ្ហា (មិនប្រើ) យើងឆ្លងកាត់សិន */ res.json({
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

    if (
      senderAcc === "ADMIN" &&
      message.includes("ការសន្ទនាត្រូវបានបញ្ចប់ដោយ Admin")
    ) {
      const realUser = await User.findOne({
        accountNumber: receiver.accountNumber,
      });
      if (realUser) {
        realUser.needsSupport = false;
        await realUser.save();
      }
    } else if (senderAcc !== "ADMIN") {
      const realUser = await User.findOne({
        accountNumber: sender.accountNumber,
      });
      if (
        realUser &&
        !realUser.needsSupport &&
        (message.toLowerCase().includes("human") ||
          message.includes("ភ្នាក់ងារ"))
      ) {
        realUser.needsSupport = true;
        await realUser.save();
      }
    }

    const newMessage = new Chat({
      id: "MSG-" + Date.now(),
      senderAcc: sender.accountNumber || "ADMIN",
      receiverAcc: receiver.accountNumber || "ADMIN",
      message: message,
      adminName: adminName || null,
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
        pImg = "";

      if (partnerAcc === "ADMIN") {
        pName = "U-PAY Support";
        pImg =
          "https://ui-avatars.com/api/?name=Support&background=004d40&color=fff";
      } else {
        const partnerInfo = users.find((u) => u.accountNumber === partnerAcc);
        if (partnerInfo) {
          pName = partnerInfo.fullName || partnerInfo.username;
          pImg = partnerInfo.profileImage;
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
};
