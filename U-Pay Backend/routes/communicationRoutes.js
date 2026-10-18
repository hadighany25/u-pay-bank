// ============================================================================
// ឯកសារ: routes/communicationRoutes.js (100% User-Only Routes)
// ============================================================================
const express = require("express");
const router = express.Router();

const {
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
} = require("../controllers/communicationController");

// User Tickets & Notifications
router.post("/ticket/create", createTicket);
router.get("/user/notifications", getNotifications);
router.post("/user/read-notifications", readNotifications);
router.post("/user/notifications/read/:notifId", readSingleNotification);

// User P2P & Bot Chat Features
router.post("/chat/send", sendChat);
router.post("/chat/history", chatHistory);
router.post("/chat/contacts", chatContacts);
router.post("/chat/check-user", checkChatUser);
router.post("/chat/delete-msg", deleteMsg);
router.post("/chat/delete-convo", deleteConvo);
router.post("/chat/toggle-pin", togglePinMsg);
router.post("/chat/react", toggleReaction);
router.post("/chat/search", globalSearch);
router.post("/chat/edit-msg", editMsg);
router.post("/chat/scheduled", getScheduledMessages);

module.exports = router;
