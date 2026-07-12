const User = require("../models/User");
const Transaction = require("../models/Transaction"); // 🔥 ទី១៖ ត្រូវហៅ Model ថ្មីមកប្រើ
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

// ១. បង្កើតកាតថ្មី (កាត់លុយ $5 និងបាញ់ចូល system_fee)
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

    // 🔥 ស្វែងរកគណនី system_fee បើគ្មានទេ បង្កើតវាភ្លាមៗ
    let systemFeeAcc = await User.findOne({ username: "system_fee" });
    if (!systemFeeAcc) {
      systemFeeAcc = new User({
        id: "sys_" + Date.now(),
        username: "system_fee",
        fullName: "U-Pay System Fee",
        accountNumber: "999999999", // លេខគណនីពិសេសសម្រាប់ Fee
        balance: 0.0,
        balanceKHR: 0.0,
        role: "user",
      });
      await systemFeeAcc.save();
    }

    // កាត់លុយ $5 ពី User
    user.balance -= 5;
    const refId = "CARD-" + Date.now().toString().slice(-6);
    const trxHash = Math.random().toString(36).substring(2, 11);
    const dateStr = new Date().toLocaleString("en-US", {
      timeZone: "Asia/Phnom_Penh",
      hour12: true,
    });

    // បញ្ជូន Transaction សម្រាប់អតិថិជន
    await Transaction.create({
      username: user.username,
      refId: refId,
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

    // បញ្ចូលលុយទៅគណនី system_fee
    systemFeeAcc.balance += 5;

    // បញ្ជូន Transaction សម្រាប់ system_fee
    await Transaction.create({
      username: systemFeeAcc.username,
      refId: refId,
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

    await systemFeeAcc.save(); // Save លុយថ្មីរបស់ system_fee

    // បង្កើតកាតថ្មី
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
    console.error("GENERATE CARD ERROR:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// ២. បិទ/បើកកាត (Freeze)
const toggleLock = async (req, res) => {
  const { cardId, isLocked } = req.body;

  // ទាញយក username ពី Token របស់អតិថិជន
  const username = req.user ? req.user.username : req.body.username;

  try {
    const user = await User.findOne({ username });

    if (!user || !user.virtualCards) {
      return res.json({ success: false, message: "រកមិនឃើញគណនី ឬកាតទេ!" });
    }

    const card = user.virtualCards.find((c) => c.id === cardId);
    if (!card) {
      return res.json({ success: false, message: "រកមិនឃើញកាតនេះទេ!" });
    }

    // =======================================================
    // 🔥 កូដអំណាច Admin (ការពារកុំអោយអតិថិជនចុច Unfreeze បាន)
    // =======================================================
    if (isLocked === false && card.lockedByAdmin === true) {
      return res.json({
        success: false,
        message:
          "បម្រាម៖ កាតនេះត្រូវបានបង្កកដោយU PAY ។ សូមទាក់ទងផ្នែកបម្រើអតិថិជនដើម្បីបើកកាតវិញ! 🛑",
      });
    }

    // បើកាតមិនជាប់សោរ Admin ទេ គឺអនុញ្ញាតអោយអតិថិជនបិទ/បើកកាតតាមធម្មតា
    card.isLocked = isLocked;

    // បើអតិថិជនចុចបិទកាតខ្លួនឯង យើងត្រូវប្រាកដថា lockedByAdmin = false
    if (isLocked === true) {
      card.lockedByAdmin = false;
    }

    user.markModified("virtualCards");
    await user.save();

    res.json({ success: true, isLocked: card.isLocked });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
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
