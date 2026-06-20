const express = require("express");
const router = express.Router();
const {
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
} = require("../controllers/communicationController");

router.post("/ticket/create", createTicket);
router.get("/user/notifications", getNotifications);
router.post("/user/read-notifications", readNotifications);
router.post("/admin/broadcast", broadcast);
router.post("/admin/delete-broadcast", deleteBroadcast);

router.post("/chat/send", sendChat);
router.post("/chat/history", chatHistory);
router.post("/chat/contacts", chatContacts);
router.post("/chat/check-user", checkChatUser);
router.post("/chat/delete-msg", deleteMsg);
router.post("/chat/delete-convo", deleteConvo);

module.exports = router;
