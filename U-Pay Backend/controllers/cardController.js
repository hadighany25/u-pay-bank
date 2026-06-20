const User = require("../models/User");
const { getFormattedDate, generateHash } = require("../services/helpers");

// មុខងារជំនួយ: បង្កើតលេខកាត
const generateCardDetails = () => {
  // លេខកាត Visa ផ្តើមដោយលេខ 4
  const number =
    "4" +
    Math.floor(Math.random() * 900000000000000)
      .toString()
      .padStart(15, "0");
  const cvv = Math.floor(100 + Math.random() * 900).toString();
  const d = new Date();
  d.setFullYear(d.getFullYear() + 4); // ផុតកំណត់ ៤ ឆ្នាំក្រោយ
  const expiry =
    ("0" + (d.getMonth() + 1)).slice(-2) +
    "/" +
    d.getFullYear().toString().slice(-2);
  return { number, cvv, expiry };
};

// ១. បង្កើតកាតថ្មី (កាត់លុយ $5)
const generateCard = async (req, res) => {
  const { username, cardType, pin } = req.body;

  // របាំងការពារ Security
  if (req.user.username !== username)
    return res.status(403).json({ success: false, message: "Unauthorized!" });

  try {
    const user = await User.findOne({ username });
    const centralBank = await User.findOne({ accountNumber: "888888888" });

    if (!user) return res.json({ success: false, message: "User not found" });
    if (user.pin !== pin)
      return res.json({ success: false, message: "លេខ PIN មិនត្រឹមត្រូវទេ!" });
    if (user.balance < 5)
      return res.json({
        success: false,
        message: "សមតុល្យមិនគ្រប់គ្រាន់សម្រាប់បង់សេវា $5 ទេ!",
      });

    // កាត់លុយ $5 ពី User
    user.balance -= 5;
    const refId = "CARD-" + Date.now().toString().slice(-6);
    user.transactions.unshift({
      refId,
      date: getFormattedDate(),
      type: "Card Issuance Fee",
      amount: -5,
      currency: "USD",
      senderName: user.username,
      receiverName: "U-Pay System",
      status: "Success",
      remark: `Issued ${cardType} Virtual Card`,
    });

    // បញ្ចូលលុយទៅធនាគារកណ្តាល
    if (centralBank) {
      centralBank.balance += 5;
      centralBank.transactions.unshift({
        refId,
        date: getFormattedDate(),
        type: "System Income",
        amount: 5,
        currency: "USD",
        senderName: user.username,
        receiverName: "U-Pay System",
        status: "Success",
        remark: "Card Issuance Fee",
      });
      await centralBank.save();
    }

    // បង្កើតកាតថ្មី
    const details = generateCardDetails();
    const newCard = {
      id: "card_" + Date.now(),
      type: cardType, // 'platinum' or 'standard'
      name: cardType === "platinum" ? "VISA PLATINUM" : "VISA STANDARD",
      number: details.number,
      cvv: details.cvv,
      expiry: details.expiry,
      isLocked: false,
      isOnlinePayEnabled: true,
      dailyLimit: 500,
      linkedAccount: "USD",
      pin: "0000", // PIN កាតដើម
    };

    if (!user.virtualCards) user.virtualCards = [];
    user.virtualCards.push(newCard);

    user.markModified("transactions");
    user.markModified("virtualCards");
    await user.save();

    res.json({
      success: true,
      cards: user.virtualCards,
      newBalance: user.balance,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// ២. បិទ/បើកកាត (Freeze)
const toggleLock = async (req, res) => {
  const { username, cardId, isLocked } = req.body;
  if (req.user.username !== username)
    return res.status(403).json({ success: false });

  try {
    const user = await User.findOne({ username });
    const card = user.virtualCards.find((c) => c.id === cardId);
    if (card) {
      card.isLocked = isLocked;
      user.markModified("virtualCards");
      await user.save();
      res.json({ success: true, cards: user.virtualCards });
    } else res.json({ success: false, message: "Card not found" });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

// ៣. បិទ/បើក Online Payment
const toggleOnlinePay = async (req, res) => {
  const { username, cardId, isEnabled } = req.body;
  if (req.user.username !== username)
    return res.status(403).json({ success: false });

  try {
    const user = await User.findOne({ username });
    const card = user.virtualCards.find((c) => c.id === cardId);
    if (card) {
      card.isOnlinePayEnabled = isEnabled;
      user.markModified("virtualCards");
      await user.save();
      res.json({ success: true, cards: user.virtualCards });
    } else res.json({ success: false });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

// ៤. កំណត់ Daily Limit
const updateLimit = async (req, res) => {
  const { username, cardId, newLimit } = req.body;
  if (req.user.username !== username)
    return res.status(403).json({ success: false });

  try {
    const user = await User.findOne({ username });
    const card = user.virtualCards.find((c) => c.id === cardId);
    if (card) {
      card.dailyLimit = parseFloat(newLimit);
      user.markModified("virtualCards");
      await user.save();
      res.json({ success: true, cards: user.virtualCards });
    } else res.json({ success: false });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

// ៥. ដកកាតចេញ (Close Card)
const deleteCard = async (req, res) => {
  const { username, cardId, reason } = req.body;
  if (req.user.username !== username)
    return res.status(403).json({ success: false });

  try {
    const user = await User.findOne({ username });
    user.virtualCards = user.virtualCards.filter((c) => c.id !== cardId);
    user.markModified("virtualCards");
    await user.save();
    res.json({ success: true, cards: user.virtualCards });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

// ៦. ប្តូរ PIN កាត (Reset PIN)
const resetPin = async (req, res) => {
  const { username, cardId, oldPin, newPin } = req.body;
  if (req.user.username !== username)
    return res.status(403).json({ success: false });

  try {
    const user = await User.findOne({ username });
    const card = user.virtualCards.find((c) => c.id === cardId);
    if (card) {
      const currentPin = card.pin || "0000"; // កាតទើបបង្កើតមាន PIN 0000
      if (currentPin !== oldPin)
        return res.json({
          success: false,
          message: "លេខ PIN ចាស់មិនត្រឹមត្រូវទេ!",
        });

      card.pin = newPin;
      user.markModified("virtualCards");
      await user.save();
      res.json({ success: true });
    } else res.json({ success: false });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

// ៧. ប្តូរឈ្មោះកាត (Rename)
const renameCard = async (req, res) => {
  const { username, cardId, name } = req.body;
  if (req.user.username !== username)
    return res.status(403).json({ success: false });

  try {
    const user = await User.findOne({ username });
    const card = user.virtualCards.find((c) => c.id === cardId);
    if (card) {
      card.name = name.toUpperCase();
      user.markModified("virtualCards");
      await user.save();
      res.json({ success: true, cards: user.virtualCards });
    } else res.json({ success: false });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

// ៨. ប្តូរគណនីប្រភព (Change Linked Account)
const changeAccount = async (req, res) => {
  const { username, cardId, linkedAccount } = req.body;
  if (req.user.username !== username)
    return res.status(403).json({ success: false });

  try {
    const user = await User.findOne({ username });
    const card = user.virtualCards.find((c) => c.id === cardId);
    if (card) {
      card.linkedAccount = linkedAccount; // 'USD' ឬ 'KHR'
      user.markModified("virtualCards");
      await user.save();
      res.json({ success: true, cards: user.virtualCards });
    } else res.json({ success: false });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

module.exports = {
  generateCard,
  toggleLock,
  toggleOnlinePay,
  updateLimit,
  deleteCard,
  resetPin,
  renameCard,
  changeAccount,
};
