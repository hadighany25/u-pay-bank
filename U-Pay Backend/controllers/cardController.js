const User = require("../models/User");
const Transaction = require("../models/Transaction");
const { getFormattedDate, generateHash } = require("../services/helpers");

// មុខងារជំនួយ: បង្កើតលេខកាត Virtual
const generateCardDetails = () => {
  const number =
    "4" +
    Math.floor(Math.random() * 900000000000000)
      .toString()
      .padStart(15, "0");
  const cvv = Math.floor(100 + Math.random() * 900).toString();
  const d = new Date();
  d.setFullYear(d.getFullYear() + 4);
  const expiry =
    ("0" + (d.getMonth() + 1)).slice(-2) +
    "/" +
    d.getFullYear().toString().slice(-2);
  return { number, cvv, expiry };
};

const generateCard = async (req, res) => {
  const { username, cardType, pin } = req.body;
  if (req.user.username !== username)
    return res.status(403).json({ success: false, message: "Unauthorized!" });

  try {
    const user = await User.findOne({ username });
    if (!user) return res.json({ success: false, message: "User not found" });
    if (user.pin !== pin)
      return res.json({ success: false, message: "លេខ PIN មិនត្រឹមត្រូវទេ!" });
    if (user.balance < 5)
      return res.json({
        success: false,
        message: "សមតុល្យមិនគ្រប់គ្រាន់សម្រាប់បង់សេវា $5 ទេ!",
      });

    let systemFeeAcc = await User.findOne({ username: "system_fee" });
    if (!systemFeeAcc) {
      systemFeeAcc = new User({
        id: "sys_" + Date.now(),
        username: "system_fee",
        fullName: "U PAY FEE",
        accountNumber: "999999999",
        balance: 0.0,
        balanceKHR: 0.0,
        role: "user",
      });
      await systemFeeAcc.save();
    }

    user.balance -= 5;
    const refId = "CARD-" + Date.now().toString().slice(-6);
    const trxHash = Math.random().toString(36).substring(2, 11);
    const dateStr = new Date().toLocaleString("en-US", {
      timeZone: "Asia/Phnom_Penh",
      hour12: true,
    });

    await Transaction.create({
      username: user.username,
      refId,
      hash: trxHash,
      date: dateStr,
      type: "Card Issuance Fee",
      amount: -5,
      currency: "USD",
      senderName: user.username,
      receiverName: "Card Issuance Service",
      status: "Success",
      remark: `Issued ${cardType} Virtual Card`,
    });

    systemFeeAcc.balance += 5;
    await Transaction.create({
      username: systemFeeAcc.username,
      refId,
      hash: trxHash,
      date: dateStr,
      type: "System Income",
      amount: 5,
      currency: "USD",
      senderName: user.username,
      receiverName: "Card Issuance Service",
      status: "Success",
      remark: "Card Issuance Fee",
    });

    await systemFeeAcc.save();

    const details = generateCardDetails();
    const newCard = {
      id: "card_" + Date.now(),
      type: cardType,
      name: cardType === "platinum" ? "VISA PLATINUM" : "VISA STANDARD",
      number: details.number,
      cvv: details.cvv,
      expiry: details.expiry,
      isLocked: false,
      isOnlinePayEnabled: true,
      dailyLimit: 500,
      linkedAccount: "USD",
      pin: "0000",
      uid: null, // សម្រាប់ឈីប NFC
    };

    if (!user.virtualCards) user.virtualCards = [];
    user.virtualCards.push(newCard);
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

const toggleLock = async (req, res) => {
  const { cardId, isLocked } = req.body;
  const username = req.user ? req.user.username : req.body.username;
  try {
    const user = await User.findOne({ username });
    if (!user || !user.virtualCards)
      return res.json({ success: false, message: "រកមិនឃើញគណនី ឬកាតទេ!" });

    const card = user.virtualCards.find((c) => c.id === cardId);
    if (!card)
      return res.json({ success: false, message: "រកមិនឃើញកាតនេះទេ!" });

    if (isLocked === false && card.lockedByAdmin === true) {
      return res.json({
        success: false,
        message:
          "បម្រាម៖ កាតនេះត្រូវបានបង្កកដោយU PAY ។ សូមទាក់ទងផ្នែកបម្រើអតិថិជនដើម្បីបើកកាតវិញ! 🛑",
      });
    }

    card.isLocked = isLocked;
    if (isLocked === true) card.lockedByAdmin = false;

    user.markModified("virtualCards");
    await user.save();
    res.json({ success: true, isLocked: card.isLocked });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

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

const deleteCard = async (req, res) => {
  const { username, cardId } = req.body;
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

const resetPin = async (req, res) => {
  const { username, cardId, oldPin, newPin } = req.body;
  if (req.user.username !== username)
    return res.status(403).json({ success: false });
  try {
    const user = await User.findOne({ username });
    const card = user.virtualCards.find((c) => c.id === cardId);
    if (card) {
      const currentPin = card.pin || "0000";
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

const changeAccount = async (req, res) => {
  const { username, cardId, linkedAccount } = req.body;
  if (req.user.username !== username)
    return res.status(403).json({ success: false });
  try {
    const user = await User.findOne({ username });
    const card = user.virtualCards.find((c) => c.id === cardId);
    if (card) {
      card.linkedAccount = linkedAccount;
      user.markModified("virtualCards");
      await user.save();
      res.json({ success: true, cards: user.virtualCards });
    } else res.json({ success: false });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

// ៩. ភ្ជាប់កាត NFC ទៅនឹងកាត Virtual ដែលមានស្រាប់
const bindNfcCard = async (req, res) => {
  try {
    const { username, cardId, pin, uid } = req.body;

    // ១. ឆែកមើលថាតើកាត Physical (UID) ນี้ ធ្លាប់មានគេយកទៅភ្ជាប់ជាមួយកាតផ្សេងរួចហើយឬยัง?
    const existingUid = await User.findOne({ "virtualCards.uid": uid });
    if (existingUid) {
      return res.json({
        success: false,
        message:
          "⚠️ កាត Physical នេះត្រូវបានភ្ជាប់រួចជាស្រេចជាមួយគណនីផ្សេងបាត់ទៅហើយ!",
      });
    }

    const user = await User.findOne({ username });
    if (!user) return res.json({ success: false, message: "រកអតិថិជនមិនឃើញ!" });

    // ២. ឆែកមើលថាតើកាត Virtual គោលដៅនេះ ធ្លាប់មានភ្ជាប់ NFC រួចហើយឬនៅ?
    const targetCard = user.virtualCards.find((c) => c.id === cardId);
    if (!targetCard)
      return res.json({ success: false, message: "រកកាតនេះមិនឃើញទេ!" });

    if (targetCard.uid && targetCard.uid !== "" && targetCard.uid !== null) {
      return res.json({
        success: false,
        message:
          "⚠️ គណនីនេះបានភ្ជាប់កាត NFC រួចរាល់ហើយ! សូម 'ផ្តាច់កាត' (Unbind) ចាស់ចេញជាមុនសិន មុននឹងដាក់ភ្ជាប់កាតថ្មី។",
      });
    }

    // ៣. បើគ្មានបញ្ហា ធ្វើការ Save ចូល Database
    targetCard.uid = uid;
    targetCard.pin = pin;

    user.markModified("virtualCards");
    await user.save();

    res.json({ success: true, message: "ភ្ជាប់ជោគជ័យ!" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// ១០. ផ្តាច់កាត NFC ចេញពីកាត Virtual វិញ
const unbindNfcCard = async (req, res) => {
  try {
    const { username, cardId } = req.body;
    const user = await User.findOne({ username });

    if (user) {
      const card = user.virtualCards.find((c) => c.id === cardId);
      if (card) {
        card.uid = null;
        user.markModified("virtualCards");
        await user.save();
        return res.json({ success: true, message: "ផ្តាច់កាតជោគជ័យ!" });
      }
    }
    res.json({ success: false, message: "បរាជ័យ" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error" });
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
  bindNfcCard,
  unbindNfcCard,
};
