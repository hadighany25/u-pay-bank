// controllers/cardController.js

const User = require("../models/User");
const Transaction = require("../models/Transaction");
const { getFormattedDate, generateHash } = require("../services/helpers");

// =======================================================
// 💳 ការកំណត់តម្លៃ និងឈ្មោះប្រភេទកាតទាំង ៨ (Card Tiers Config)
// =======================================================
const cardTiersConfig = {
  standard: { name: "STANDARD", price: 5.0 },
  fifa: { name: "FIFA WORLD CUP", price: 15.0 },
  metal: { name: "METAL GOLD", price: 5.0 },
  celebrity: { name: "BTS EDITION", price: 15.0 },
  anime: { name: "NARUTO EDITION", price: 15.0 },
  gamer: { name: "GAMER PRO", price: 15.0 },
  eco: { name: "ECO GREEN", price: 5.0 },
  platinum: { name: "PLATINUM PREMIUM", price: 25.0 },
  animal: { name: "ANIMAL EDITION", price: 15.0 },
  custom: { name: "CUSTOM VIP", price: 25.0 }, // 🟢 កាតរើសរូបបាន
};

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

// =======================================================
// ១. បង្កើតកាតថ្មី (Smart Issuance Flow)
// =======================================================
const generateCard = async (req, res) => {
  // 🟢 ទទួលយក linkedAccount ពី Frontend បន្ថែម
  const { username, cardType, customBgUrl, linkedAccount, pin } = req.body;
  if (req.user.username !== username)
    return res.status(403).json({ success: false, message: "Unauthorized!" });

  try {
    const user = await User.findOne({ username });
    if (!user) return res.json({ success: false, message: "User not found" });
    if (user.pin !== pin)
      return res.json({ success: false, message: "លេខ PIN មិនត្រឹមត្រូវទេ!" });

    // 🟢 កំណត់តម្លៃសេវា និងឈ្មោះតាមប្រភេទកាតជាក់លាក់
    const tier = cardTiersConfig[cardType] || cardTiersConfig["standard"];
    const issuanceFee = tier.price;

    if (user.balance < issuanceFee)
      return res.json({
        success: false,
        message: `សមតុល្យ USD មិនគ្រប់គ្រាន់សម្រាប់បង់សេវាបង្កើតកាតតម្លៃ $${issuanceFee.toFixed(2)} ទេ!`,
      });

    let systemFeeAcc = await User.findOne({ username: "system_fee" });
    if (!systemFeeAcc) {
      systemFeeAcc = new User({
        id: "FEE_" + Date.now(),
        username: "system_fee",
        fullName: "U PAY FEE",
        accountNumber: "999999999",
        balance: 0.0,
        balanceKHR: 0.0,
        role: "user",
      });
      await systemFeeAcc.save();
    }

    // កាត់លុយថ្លៃសេវា
    user.balance -= issuanceFee;
    const refId = "CARD-" + Date.now().toString().slice(-6);
    const trxHash = Math.random().toString(36).substring(2, 11).toUpperCase();
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
      amount: -issuanceFee,
      currency: "USD",
      senderName: user.username,
      receiverName: "Card Issuance Service",
      status: "Success",
      remark: `Issued ${tier.name} Virtual Card`,
    });

    systemFeeAcc.balance += issuanceFee;
    await Transaction.create({
      username: systemFeeAcc.username,
      refId,
      hash: trxHash,
      date: dateStr,
      type: "System Income",
      amount: issuanceFee,
      currency: "USD",
      senderName: user.username,
      receiverName: "Card Issuance Service",
      status: "Success",
      remark: "Card Issuance Fee",
    });

    await systemFeeAcc.save();

    // បង្កើតកាតថ្មី
    const details = generateCardDetails();
    const newCard = {
      id: "card_" + Date.now(),
      type: cardType,
      name: tier.name, // 🟢 ឈ្មោះកំណត់អូតូ
      number: details.number,
      cvv: details.cvv,
      expiry: details.expiry,
      isLocked: false,
      isOnlinePayEnabled: true,
      dailyLimit: 500, // ដែនកំណត់លុយ Default
      dailyTxCountLimit: 10, // 🟢 ដែនកំណត់ចំនួនដង Default
      linkedAccount: linkedAccount || "USD", // 🟢 ភ្ជាប់គណនីអូតូពេលបង្កើត
      pin: "0000",
      uid: null,
      isPhysical: false, // 🟢 សម្គាល់ថាវាគ្រាន់តែជា Virtual (គ្មានសញ្ញា NFC)
      customBgUrl: cardType === "custom" ? customBgUrl : "", // 🟢 Save Link រូបភាព
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

// =======================================================
// ២. បិទ/បើក កាត
// =======================================================
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
          "បម្រាម៖ កាតនេះត្រូវបានបង្កកដោយ U-PAY។ សូមទាក់ទងផ្នែកបម្រើអតិថិជន! 🛑",
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

// =======================================================
// ៣. បិទ/បើក ការទិញអនឡាញ
// =======================================================
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

// =======================================================
// ៤. ផ្លាស់ប្តូរដែនកំណត់ ២ ជាន់ (Dual Limits)
// =======================================================
const updateLimit = async (req, res) => {
  const { username, cardId, newLimit, newCountLimit } = req.body; // 🟢 ទទួលយកទាំង ២
  if (req.user.username !== username)
    return res.status(403).json({ success: false });
  try {
    const user = await User.findOne({ username });
    const card = user.virtualCards.find((c) => c.id === cardId);
    if (card) {
      if (newLimit !== undefined) card.dailyLimit = parseFloat(newLimit);
      if (newCountLimit !== undefined)
        card.dailyTxCountLimit = parseInt(newCountLimit, 10);

      user.markModified("virtualCards");
      await user.save();
      res.json({ success: true, cards: user.virtualCards });
    } else res.json({ success: false });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

// =======================================================
// ៥. លុបកាត
// =======================================================
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

// =======================================================
// ៦. ផ្លាស់ប្តូរលេខសម្ងាត់កាត (PIN)
// =======================================================
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

// =======================================================
// ៧. ប្តូរឈ្មោះកាត
// =======================================================
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

// ❌ ចំណាំ៖ បានលុបមុខងារ changeAccount() ចេញតាមស្តង់ដារធនាគារ

// =======================================================
// ៨. ភ្ជាប់កាត NFC (Physical Card)
// =======================================================
const bindNfcCard = async (req, res) => {
  try {
    const { username, cardId, pin, uid } = req.body;

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

    const targetCard = user.virtualCards.find((c) => c.id === cardId);
    if (!targetCard)
      return res.json({ success: false, message: "រកកាតនេះមិនឃើញទេ!" });

    if (targetCard.uid && targetCard.uid !== "" && targetCard.uid !== null) {
      return res.json({
        success: false,
        message:
          "⚠️ គណនីនេះបានភ្ជាប់កាត NFC រួចរាល់ហើយ! សូម 'ផ្តាច់កាត' (Unbind) ចាស់ចេញជាមុនសិន។",
      });
    }

    targetCard.uid = uid;
    targetCard.pin = pin;
    targetCard.isPhysical = true; // 🟢 បង្ហាញសញ្ញា Wi-Fi/NFC លើកាត Frontend

    user.markModified("virtualCards");
    await user.save();

    res.json({ success: true, message: "ភ្ជាប់ជោគជ័យ!" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// =======================================================
// ៩. ផ្តាច់កាត NFC
// =======================================================
const unbindNfcCard = async (req, res) => {
  try {
    const { username, cardId } = req.body;
    const user = await User.findOne({ username });

    if (user) {
      const card = user.virtualCards.find((c) => c.id === cardId);
      if (card) {
        card.uid = null;
        card.isPhysical = false; // 🟢 លាក់សញ្ញា Wi-Fi/NFC ចេញពីកាត
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

// =======================================================
// ១០. រៀបចំទីតាំងកាតឡើងវិញ (Drag & Drop Reorder)
// =======================================================
const reorderCards = async (req, res) => {
  const { username, orderedIds } = req.body;
  if (req.user.username !== username)
    return res.status(403).json({ success: false });

  try {
    const user = await User.findOne({ username });
    if (user && user.virtualCards) {
      // តម្រៀបកាតចាស់ ឱ្យទៅតាមលំដាប់ ID ថ្មីដែល Frontend បោះមក
      const newCardsArray = orderedIds
        .map((id) => user.virtualCards.find((c) => c.id === id))
        .filter(Boolean);

      // ការពារក្រែងលោមានកាតណាមួយធ្លាក់ជ្រុះ ក៏យកមកតពីក្រោយគេ
      const existingIds = newCardsArray.map((c) => c.id);
      const missedCards = user.virtualCards.filter(
        (c) => !existingIds.includes(c.id),
      );

      user.virtualCards = [...newCardsArray, ...missedCards];
      user.markModified("virtualCards");
      await user.save();

      res.json({ success: true, cards: user.virtualCards });
    } else {
      res.json({ success: false });
    }
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
  bindNfcCard,
  unbindNfcCard,
  reorderCards,
};
