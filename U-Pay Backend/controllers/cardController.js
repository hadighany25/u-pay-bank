// ============================================================================
// ឯកសារ: controllers/cardController.js
// អត្ថន័យ: ខួរក្បាលស្នូលសម្រាប់គ្រប់គ្រងកាតទាំង ៣ ប្រភេទ និងការទូទាត់សងប្រាក់ (Strict _id Binding)
// ============================================================================

const User = require("../models/User");
const Card = require("../models/Card");
const Transaction = require("../models/Transaction");
const System = require("../models/System");
const JointAccount = require("../models/JointAccount");
const Notification = require("../models/Notification");
const mongoose = require("mongoose");

// ========================================================
// 🛠️ Function ជំនួយ (Helpers)
// ========================================================
const generateStandardHash = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 10; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const generateStandardRefId = (prefix) => {
  const random8Digits = Math.floor(10000000 + Math.random() * 90000000);
  return `${prefix}-${random8Digits}`;
};

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
  custom: { name: "CUSTOM VIP", price: 25.0 },
};

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

// 🔍 អនុគមន៍ជំនួយ៖ ស្វែងរកគណនីពិតប្រាកដរបស់ User (Main, Sub, ឬ Joint)
async function resolveUserAccount(user, linkedAccStr) {
  let rawAcc = String(linkedAccStr || "USD");
  let accNum = rawAcc.includes("_") ? rawAcc.split("_")[1] : rawAcc;

  if (accNum === "USD" || accNum === user.mainAccounts?.USD?.accountNumber) {
    return {
      type: "MAIN_USD",
      accObj: user.mainAccounts.USD,
      currency: "USD",
      accountNumber:
        user.mainAccounts?.USD?.accountNumber || user.accountNumber,
      accountId: user.mainAccounts?.USD?.accountId || "MAIN_USD",
    };
  }
  if (accNum === "KHR" || accNum === user.mainAccounts?.KHR?.accountNumber) {
    return {
      type: "MAIN_KHR",
      accObj: user.mainAccounts.KHR,
      currency: "KHR",
      accountNumber:
        user.mainAccounts?.KHR?.accountNumber || user.accountNumberKHR,
      accountId: user.mainAccounts?.KHR?.accountId || "MAIN_KHR",
    };
  }
  if (user.subAccounts && user.subAccounts.length > 0) {
    const idx = user.subAccounts.findIndex(
      (s) =>
        s.accountNumber === accNum ||
        `${s.currency}_${s.accountNumber}` === rawAcc,
    );
    if (idx !== -1) {
      const sub = user.subAccounts[idx];
      if (sub.accountType === "joint" || sub.accountType === "joint_member") {
        const jointDoc = await JointAccount.findOne({
          accountId: sub.accountId,
        });
        return {
          type: "JOINT",
          subIndex: idx,
          accObj: sub,
          jointDoc,
          currency: sub.currency || "USD",
          accountNumber: sub.accountNumber,
          accountId: sub.accountId,
        };
      }
      return {
        type: "SUB",
        subIndex: idx,
        accObj: sub,
        currency: sub.currency || "USD",
        accountNumber: sub.accountNumber,
        accountId: sub.accountId,
      };
    }
  }
  return null;
}

// =======================================================
// ០. ទាញយកកាតទាំងអស់របស់ User (តាម _id និង Auto-Migrate កាតចាស់)
// =======================================================
const getMyCards = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const userDoc =
      userId && mongoose.isValidObjectId(userId)
        ? await User.findById(userId)
        : await User.findOne({ username: req.user.username });

    if (!userDoc)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    let cards = await Card.find({ userId: userDoc._id }).sort({
      orderIndex: 1,
      createdAt: 1,
    });

    // 🔄 AUTO-MIGRATION
    if (cards.length === 0) {
      const rawUser = await User.collection.findOne({ _id: userDoc._id });
      if (rawUser && rawUser.virtualCards && rawUser.virtualCards.length > 0) {
        const migrated = [];
        for (let i = 0; i < rawUser.virtualCards.length; i++) {
          const oldC = rawUser.virtualCards[i];
          let linkAcc = oldC.linkedAccount || "USD";
          if (linkAcc === "USD" && rawUser.mainAccounts?.USD?.accountNumber) {
            linkAcc = rawUser.mainAccounts.USD.accountNumber;
          } else if (
            linkAcc === "KHR" &&
            rawUser.mainAccounts?.KHR?.accountNumber
          ) {
            linkAcc = rawUser.mainAccounts.KHR.accountNumber;
          } else if (linkAcc.includes("_")) {
            linkAcc = linkAcc.split("_")[1];
          }

          const hasNfc = Boolean(
            oldC.isPhysical || (oldC.uid && oldC.uid !== ""),
          );

          const newCardDoc = await Card.create({
            userId: rawUser._id,
            username: rawUser.username,
            userCustomId:
              rawUser.userId || rawUser.id || rawUser._id.toString(),
            id: oldC.id || "card_" + Date.now() + "_" + i,
            cardCategory: oldC.cardCategory || (hasNfc ? "debit" : "virtual"),
            type: oldC.type || "standard",
            name: oldC.name || "STANDARD",
            number: oldC.number,
            cvv: oldC.cvv,
            expiry: oldC.expiry,
            linkedAccount: linkAcc,
            currency: oldC.linkedAccount === "KHR" ? "KHR" : "USD",
            isLocked: oldC.isLocked || false,
            lockedByAdmin: oldC.lockedByAdmin || false,
            isOnlinePayEnabled: oldC.isOnlinePayEnabled !== false,
            dailyLimit: oldC.dailyLimit || 500,
            dailyTxCountLimit: oldC.dailyTxCountLimit || 10,
            pin: oldC.pin || "0000",
            uid: oldC.uid || null,
            isPhysical: hasNfc,
            deliveryStatus: hasNfc ? "Activated" : "None",
            customBgUrl: oldC.customBgUrl || "",
            orderIndex: i,
          });
          migrated.push(newCardDoc);
        }
        await User.collection.updateOne(
          { _id: rawUser._id },
          { $unset: { virtualCards: "" } },
        );
        cards = migrated;
      }
    }

    res.json({ success: true, cards });
  } catch (err) {
    console.error("Get My Cards Error:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// =======================================================
// ១. បង្កើតកាតថ្មី (គាំទ្រទាំង ៣ ប្រភេទ៖ Virtual, Debit, និង Credit)
// =======================================================
const generateCard = async (req, res) => {
  const {
    username,
    userId,
    cardCategory = "virtual",
    cardType,
    customBgUrl,
    linkedAccount,
    creditLimit,
    deliveryMethod,
    deliveryPhone,
    deliveryAddress,
    pin,
  } = req.body;

  try {
    const targetUserId = userId || req.user._id || req.user.id;
    const user =
      targetUserId && mongoose.isValidObjectId(targetUserId)
        ? await User.findById(targetUserId)
        : await User.findOne({ username });

    if (!user) return res.json({ success: false, message: "User not found" });
    if (user.pin !== pin)
      return res.json({ success: false, message: "លេខ PIN មិនត្រឹមត្រូវទេ!" });

    const existingCardsCount = await Card.countDocuments({ userId: user._id });
    if (existingCardsCount >= 10) {
      return res.json({
        success: false,
        message: "អ្នកអាចបង្កើតកាតได้ត្រឹមតែ ១០ សន្លឹកប៉ុណ្ណោះ!",
      });
    }

    const cleanCategory = ["virtual", "debit", "credit"].includes(cardCategory)
      ? cardCategory
      : "virtual";

    let finalCardType = cardType || "standard";
    if (
      cleanCategory === "virtual" &&
      finalCardType !== "standard" &&
      finalCardType !== "metal"
    ) {
      finalCardType = "standard";
    }

    const targetAcc = await resolveUserAccount(user, linkedAccount);
    if (!targetAcc || !targetAcc.accObj) {
      return res.json({
        success: false,
        message: "រកមិនឃើញគណនីប្រភពសម្រាប់កាត់ថ្លៃសេវាចេញកាតទេ!",
      });
    }

    const tier = cardTiersConfig[finalCardType] || cardTiersConfig["standard"];
    const issuanceFeeUSD = tier.price;

    let exchangeRate = 4110;
    try {
      const sys = await System.findOne({ settingId: "GLOBAL_SETTINGS" });
      if (sys && sys.fxRates && sys.fxRates.usdToKhrBuy) {
        exchangeRate = parseFloat(sys.fxRates.usdToKhrBuy);
      }
    } catch (e) {}

    const feeInAccCurrency =
      targetAcc.currency === "USD"
        ? issuanceFeeUSD
        : issuanceFeeUSD * exchangeRate;

    const currentBal =
      targetAcc.type === "JOINT" && targetAcc.jointDoc
        ? targetAcc.jointDoc.balance
        : targetAcc.accObj.balance || 0;

    if (currentBal < feeInAccCurrency) {
      const feeStr =
        targetAcc.currency === "USD"
          ? `$${feeInAccCurrency.toFixed(2)}`
          : `៛${feeInAccCurrency.toLocaleString()}`;
      return res.json({
        success: false,
        message: `សមតុល្យក្នុងគណនី (${targetAcc.accountNumber}) មិនគ្រប់គ្រាន់សម្រាប់បង់សេវាចេញកាតតម្លៃ ${feeStr} ទេ!`,
      });
    }

    // 💸 កាត់លុយថ្លៃសេវា
    if (targetAcc.type === "MAIN_USD") {
      user.mainAccounts.USD.balance -= feeInAccCurrency;
      user.markModified("mainAccounts");
    } else if (targetAcc.type === "MAIN_KHR") {
      user.mainAccounts.KHR.balance -= feeInAccCurrency;
      user.markModified("mainAccounts");
    } else if (targetAcc.type === "SUB") {
      user.subAccounts[targetAcc.subIndex].balance -= feeInAccCurrency;
      user.markModified("subAccounts");
    } else if (targetAcc.type === "JOINT" && targetAcc.jointDoc) {
      targetAcc.jointDoc.balance -= feeInAccCurrency;
      await targetAcc.jointDoc.save();
      user.subAccounts[targetAcc.subIndex].balance = targetAcc.jointDoc.balance;
      user.markModified("subAccounts");
    }
    await user.save();

    // 🏦 បូកចូល Super Admin
    let superAdmin = await User.findOne({ username: "superadmin" });
    if (superAdmin) {
      let targetFeeSub = superAdmin.subAccounts?.find(
        (sub) => sub.accountNumber === "888000999",
      );
      if (targetFeeSub) {
        targetFeeSub.balance += issuanceFeeUSD;
        superAdmin.markModified("subAccounts");
      } else if (superAdmin.mainAccounts?.USD) {
        superAdmin.mainAccounts.USD.balance += issuanceFeeUSD;
        superAdmin.markModified("mainAccounts");
      }
      await superAdmin.save();
    }

    const refId = generateStandardRefId("CARD");
    const trxHash = generateStandardHash();
    const dateStr = new Date().toLocaleString("en-US", {
      timeZone: "Asia/Phnom_Penh",
      hour12: true,
    });

    const details = generateCardDetails();
    const newCardId = "card_" + Date.now();
    const isPhysicalCard =
      cleanCategory === "debit" || cleanCategory === "credit";

    const dueD = new Date();
    dueD.setDate(dueD.getDate() + 30);
    const billingDueStr = dueD.toISOString().split("T")[0];

    const approvedCreditLimit =
      cleanCategory === "credit"
        ? Math.min(10000, Math.max(100, parseFloat(creditLimit) || 1000))
        : 0;

    await Card.create({
      userId: user._id,
      username: user.username,
      userCustomId: user.userId || user.id || user._id.toString(),
      id: newCardId,
      cardCategory: cleanCategory,
      type: finalCardType,
      name: tier.name,
      number: details.number,
      cvv: details.cvv,
      expiry: details.expiry,
      linkedAccount:
        cleanCategory === "credit" ? "CREDIT_LINE" : targetAcc.accountNumber,
      currency: cleanCategory === "credit" ? "USD" : targetAcc.currency,
      creditLimit: approvedCreditLimit,
      currentDebt: 0.0,
      billingDueDate: cleanCategory === "credit" ? billingDueStr : "",
      isLocked: false,
      isOnlinePayEnabled: true,
      dailyLimit: cleanCategory === "credit" ? approvedCreditLimit : 500,
      dailyTxCountLimit: 10,
      pin: "0000",
      uid: null,
      isPhysical: isPhysicalCard,
      deliveryStatus: isPhysicalCard ? "Requested" : "None",
      deliveryMethod: isPhysicalCard
        ? deliveryMethod || "Branch Pickup"
        : "None",
      deliveryPhone: isPhysicalCard ? deliveryPhone || user.phone || "" : "",
      deliveryAddress: isPhysicalCard ? deliveryAddress || "" : "",
      deliveryUpdatedAt: isPhysicalCard ? dateStr : "",
      customBgUrl: finalCardType === "custom" ? customBgUrl : "",
      orderIndex: existingCardsCount,
    });

    const catDisplayLabel =
      cleanCategory === "credit"
        ? "Credit Card"
        : cleanCategory === "debit"
          ? "Physical Debit Card"
          : "Virtual Card";

    // 🧾 វិក្កយបត្រកាត់លុយ
    await Transaction.create({
      userId: user._id,
      accountId: targetAcc.accountId,
      refId,
      hash: trxHash,
      date: dateStr,
      type: "Card Issuance Fee",
      amount: -feeInAccCurrency,
      currency: targetAcc.currency,
      senderName: user.fullName || user.username,
      senderAcc: targetAcc.accountNumber,
      receiverName: "Card Issuance Service",
      receiverAcc: "888000999",
      cardId: newCardId,
      cardNumber: details.number,
      status: "Success",
      remark: `Issued ${tier.name} ${catDisplayLabel}`,
    });

    await Transaction.create({
      userId: superAdmin?._id,
      accountId: superAdmin
        ? superAdmin.mainAccounts?.USD?.accountId
        : undefined,
      refId,
      hash: trxHash,
      date: dateStr,
      type: "System Income",
      amount: issuanceFeeUSD,
      currency: "USD",
      senderName: user.username,
      receiverName: "Central Bank Fee Income",
      senderAcc: targetAcc.accountNumber,
      receiverAcc: "888000999",
      status: "Success",
      remark: `${catDisplayLabel} Issuance Fee`,
    });

    if (isPhysicalCard) {
      await Notification.create({
        userId: user._id,
        title: `💳 សំណើផលិត ${catDisplayLabel} ជោគជ័យ`,
        message: `សំណើផលិតកាត ${tier.name} (លេខសម្គាល់: #${refId}) ត្រូវបានទទួល។ វិធីទទួលកាត: ${deliveryMethod || "Branch Pickup"}។`,
        date: dateStr,
        type: "info",
        isRead: false,
      });
    }

    const allCards = await Card.find({ userId: user._id }).sort({
      orderIndex: 1,
      createdAt: 1,
    });

    res.json({
      success: true,
      cards: allCards,
      user: user,
    });
  } catch (err) {
    console.error("Generate Card Error:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// =======================================================
// ១.១ Activate Physical Card
// =======================================================
const activatePhysicalCard = async (req, res) => {
  const { username, userId, cardId, last4Digits, pin } = req.body;
  try {
    const targetUserId = userId || req.user._id || req.user.id;
    const user =
      targetUserId && mongoose.isValidObjectId(targetUserId)
        ? await User.findById(targetUserId)
        : await User.findOne({ username });

    if (!user) return res.json({ success: false, message: "User not found" });
    if (user.pin !== pin) {
      return res.json({
        success: false,
        message: "លេខសម្ងាត់ PIN គណនីមិនត្រឹមត្រូវទេ!",
      });
    }

    const card = await Card.findOne({ id: cardId, userId: user._id });
    if (!card) {
      return res.json({ success: false, message: "រកមិនឃើញកាតនេះទេ!" });
    }

    const actualLast4 = String(card.number || "").slice(-4);
    if (String(last4Digits || "").trim() !== actualLast4) {
      return res.json({
        success: false,
        message: "លេខកាត ៤ ខ្ទង់ចុងក្រោយមិនត្រឹមត្រូវទេ!",
      });
    }

    const nowStr = new Date().toLocaleString("en-US", {
      timeZone: "Asia/Phnom_Penh",
      hour12: true,
    });

    card.deliveryStatus = "Activated";
    card.deliveryUpdatedAt = nowStr;
    await card.save();

    await Notification.create({
      userId: user._id,
      title: "🟢 កាតរូបវ័ន្តត្រូវបានបើកដំណើរការជោគជ័យ!",
      message: `កាត ${card.name} (**** ${actualLast4}) របស់អ្នកត្រូវបានផ្ទៀងផ្ទាត់ និងបើកដំណើរការពេញលេញហើយ។`,
      date: nowStr,
      type: "info",
      isRead: false,
    });

    const cards = await Card.find({ userId: user._id }).sort({
      orderIndex: 1,
      createdAt: 1,
    });

    res.json({
      success: true,
      message: "កាតរូបវ័ន្តត្រូវបានបើកដំណើរការដោយជោគជ័យ!",
      cards,
    });
  } catch (err) {
    console.error("Activate Physical Card Error:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// =======================================================
// ១.២ Pay Credit Card Bill
// =======================================================
const payCreditCardBill = async (req, res) => {
  const { username, userId, cardId, fromAccount, amount, pin } = req.body;
  try {
    const targetUserId = userId || req.user._id || req.user.id;
    const user =
      targetUserId && mongoose.isValidObjectId(targetUserId)
        ? await User.findById(targetUserId)
        : await User.findOne({ username });

    if (!user) return res.json({ success: false, message: "User not found" });
    if (user.pin !== pin) {
      return res.json({
        success: false,
        message: "លេខសម្ងាត់ PIN មិនត្រឹមត្រូវទេ!",
      });
    }

    const card = await Card.findOne({ id: cardId, userId: user._id });
    if (!card || card.cardCategory !== "credit") {
      return res.json({
        success: false,
        message: "រកមិនឃើញកាតឥណទាន (Credit Card) នេះទេ!",
      });
    }

    const currentDebtUSD = Number(card.currentDebt || 0);
    if (currentDebtUSD <= 0) {
      return res.json({
        success: false,
        message: "កាតនេះមិនមានទឹកប្រាក់ជំពាក់ដែលត្រូវសងទេ!",
      });
    }

    let payAmountUSD = parseFloat(amount);
    if (isNaN(payAmountUSD) || payAmountUSD <= 0) {
      return res.json({
        success: false,
        message: "ចំនួនទឹកប្រាក់មិនត្រឹមត្រូវ!",
      });
    }
    if (payAmountUSD > currentDebtUSD) {
      payAmountUSD = currentDebtUSD;
    }

    const sourceAcc = await resolveUserAccount(user, fromAccount);
    if (!sourceAcc || !sourceAcc.accObj) {
      return res.json({
        success: false,
        message: "រកមិនឃើញគណនីប្រភពសម្រាប់កាត់ប្រាក់ទេ!",
      });
    }

    let exchangeRate = 4110;
    try {
      const sys = await System.findOne({ settingId: "GLOBAL_SETTINGS" });
      if (sys && sys.fxRates && sys.fxRates.usdToKhrBuy) {
        exchangeRate = parseFloat(sys.fxRates.usdToKhrBuy);
      }
    } catch (e) {}

    const deductInAccCurrency =
      sourceAcc.currency === "USD" ? payAmountUSD : payAmountUSD * exchangeRate;

    const currentBal =
      sourceAcc.type === "JOINT" && sourceAcc.jointDoc
        ? sourceAcc.jointDoc.balance
        : sourceAcc.accObj.balance || 0;

    if (currentBal < deductInAccCurrency) {
      return res.json({
        success: false,
        message: `សមតុល្យក្នុងគណនី (${sourceAcc.accountNumber}) មិនគ្រប់គ្រាន់សម្រាប់សងប្រាក់កាតទេ!`,
      });
    }

    if (sourceAcc.type === "MAIN_USD") {
      user.mainAccounts.USD.balance -= deductInAccCurrency;
      user.markModified("mainAccounts");
    } else if (sourceAcc.type === "MAIN_KHR") {
      user.mainAccounts.KHR.balance -= deductInAccCurrency;
      user.markModified("mainAccounts");
    } else if (sourceAcc.type === "SUB") {
      user.subAccounts[sourceAcc.subIndex].balance -= deductInAccCurrency;
      user.markModified("subAccounts");
    } else if (sourceAcc.type === "JOINT" && sourceAcc.jointDoc) {
      sourceAcc.jointDoc.balance -= deductInAccCurrency;
      await sourceAcc.jointDoc.save();
      user.subAccounts[sourceAcc.subIndex].balance = sourceAcc.jointDoc.balance;
      user.markModified("subAccounts");
    }
    await user.save();

    card.currentDebt = Math.max(
      0,
      Number((currentDebtUSD - payAmountUSD).toFixed(2)),
    );
    await card.save();

    const centralBank = await User.findOne({
      "mainAccounts.USD.accountNumber": "888888888",
    });
    if (centralBank && centralBank.mainAccounts?.USD) {
      centralBank.mainAccounts.USD.balance += payAmountUSD;
      centralBank.markModified("mainAccounts");
      await centralBank.save();
    }

    const refId = generateStandardRefId("BILL");
    const trxHash = generateStandardHash();
    const dateStr = new Date().toLocaleString("en-US", {
      timeZone: "Asia/Phnom_Penh",
      hour12: true,
    });

    await Transaction.create({
      userId: user._id,
      accountId: sourceAcc.accountId,
      refId,
      hash: trxHash,
      date: dateStr,
      type: "Credit Card Repayment",
      amount: -deductInAccCurrency,
      currency: sourceAcc.currency,
      senderName: user.fullName || user.username,
      senderAcc: sourceAcc.accountNumber,
      receiverName: `Credit Card (**** ${card.number.slice(-4)})`,
      receiverAcc: "888888888",
      cardId: card.id,
      cardNumber: card.number,
      status: "Success",
      remark: `សងប្រាក់កាតឥណទានចំនួន $${payAmountUSD.toFixed(2)}`,
    });

    const cards = await Card.find({ userId: user._id }).sort({
      orderIndex: 1,
      createdAt: 1,
    });

    res.json({
      success: true,
      message: `បានទូទាត់សងប្រាក់កាតឥណទានចំនួន $${payAmountUSD.toFixed(2)} ដោយជោគជ័យ!`,
      cards,
      user,
    });
  } catch (err) {
    console.error("Pay Credit Card Bill Error:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// =======================================================
// ២. បិទ/បើក កាត (Freeze / Unfreeze)
// =======================================================
const toggleLock = async (req, res) => {
  const { cardId, isLocked, userId, username } = req.body;
  try {
    const targetUserId =
      userId || (req.user ? req.user._id || req.user.id : null);
    const userDoc =
      targetUserId && mongoose.isValidObjectId(targetUserId)
        ? await User.findById(targetUserId)
        : await User.findOne({
            username: username || (req.user ? req.user.username : ""),
          });

    if (!userDoc)
      return res.json({ success: false, message: "User not found" });

    const card = await Card.findOne({ id: cardId, userId: userDoc._id });
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
    await card.save();

    res.json({ success: true, isLocked: card.isLocked });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// =======================================================
// ៣. បិទ/បើក ការទិញអនឡាញ
// =======================================================
const toggleOnlinePay = async (req, res) => {
  const { username, userId, cardId, isEnabled } = req.body;
  try {
    const targetUserId =
      userId || (req.user ? req.user._id || req.user.id : null);
    const userDoc =
      targetUserId && mongoose.isValidObjectId(targetUserId)
        ? await User.findById(targetUserId)
        : await User.findOne({
            username: username || (req.user ? req.user.username : ""),
          });

    if (!userDoc) return res.json({ success: false });

    const card = await Card.findOne({ id: cardId, userId: userDoc._id });
    if (!card) return res.json({ success: false });

    card.isOnlinePayEnabled = isEnabled;
    await card.save();

    const cards = await Card.find({ userId: userDoc._id }).sort({
      orderIndex: 1,
      createdAt: 1,
    });
    res.json({ success: true, cards });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

// =======================================================
// ៤. ផ្លាស់ប្តូរដែនកំណត់ ២ ជាន់ (Dual Limits)
// =======================================================
const updateLimit = async (req, res) => {
  const { username, userId, cardId, newLimit, newCountLimit } = req.body;
  try {
    const targetUserId =
      userId || (req.user ? req.user._id || req.user.id : null);
    const userDoc =
      targetUserId && mongoose.isValidObjectId(targetUserId)
        ? await User.findById(targetUserId)
        : await User.findOne({
            username: username || (req.user ? req.user.username : ""),
          });

    if (!userDoc) return res.json({ success: false });

    const card = await Card.findOne({ id: cardId, userId: userDoc._id });
    if (!card) return res.json({ success: false });

    if (newLimit !== undefined) card.dailyLimit = parseFloat(newLimit);
    if (newCountLimit !== undefined)
      card.dailyTxCountLimit = parseInt(newCountLimit, 10);
    await card.save();

    const cards = await Card.find({ userId: userDoc._id }).sort({
      orderIndex: 1,
      createdAt: 1,
    });
    res.json({ success: true, cards });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

// =======================================================
// ៥. លុបកាត
// =======================================================
const deleteCard = async (req, res) => {
  const { username, userId, cardId } = req.body;
  try {
    const targetUserId =
      userId || (req.user ? req.user._id || req.user.id : null);
    const userDoc =
      targetUserId && mongoose.isValidObjectId(targetUserId)
        ? await User.findById(targetUserId)
        : await User.findOne({
            username: username || (req.user ? req.user.username : ""),
          });

    if (!userDoc) return res.json({ success: false });

    const card = await Card.findOne({ id: cardId, userId: userDoc._id });
    if (!card) {
      return res.json({ success: false, message: "រកមិនឃើញកាតនេះទេ!" });
    }

    if (card.cardCategory === "credit" && (card.currentDebt || 0) > 0) {
      return res.json({
        success: false,
        message: `មិនអាចបិទកាតឥណទាននេះได้ទេ! អ្នកនៅជំពាក់ទឹកប្រាក់ចំនួន $${Number(card.currentDebt).toFixed(2)} សូមទូទាត់សងជាមុនសិន។`,
      });
    }

    await Card.findOneAndDelete({ id: cardId, userId: userDoc._id });
    const cards = await Card.find({ userId: userDoc._id }).sort({
      orderIndex: 1,
      createdAt: 1,
    });
    res.json({ success: true, cards });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

// =======================================================
// ៦. ផ្លាស់ប្តូរលេខសម្ងាត់កាត (PIN)
// =======================================================
const resetPin = async (req, res) => {
  const { username, userId, cardId, oldPin, newPin } = req.body;
  try {
    const targetUserId =
      userId || (req.user ? req.user._id || req.user.id : null);
    const userDoc =
      targetUserId && mongoose.isValidObjectId(targetUserId)
        ? await User.findById(targetUserId)
        : await User.findOne({
            username: username || (req.user ? req.user.username : ""),
          });

    if (!userDoc) return res.json({ success: false });

    const card = await Card.findOne({ id: cardId, userId: userDoc._id });
    if (!card) return res.json({ success: false, message: "រកមិនឃើញកាតទេ!" });

    const currentPin = card.pin || "0000";
    if (currentPin !== oldPin) {
      return res.json({
        success: false,
        message: "លេខ PIN ចាស់មិនត្រឹមត្រូវទេ!",
      });
    }
    card.pin = newPin;
    await card.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

// =======================================================
// ៧. ប្តូរឈ្មោះកាត
// =======================================================
const renameCard = async (req, res) => {
  const { username, userId, cardId, name } = req.body;
  try {
    const targetUserId =
      userId || (req.user ? req.user._id || req.user.id : null);
    const userDoc =
      targetUserId && mongoose.isValidObjectId(targetUserId)
        ? await User.findById(targetUserId)
        : await User.findOne({
            username: username || (req.user ? req.user.username : ""),
          });

    if (!userDoc) return res.json({ success: false });

    const card = await Card.findOne({ id: cardId, userId: userDoc._id });
    if (!card) return res.json({ success: false });

    card.name = name.toUpperCase();
    await card.save();

    const cards = await Card.find({ userId: userDoc._id }).sort({
      orderIndex: 1,
      createdAt: 1,
    });
    res.json({ success: true, cards });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

// =======================================================
// ៨. ភ្ជាប់កាត NFC
// =======================================================
const bindNfcCard = async (req, res) => {
  try {
    const { username, userId, cardId, pin, uid } = req.body;
    const cleanUid = String(uid || "")
      .replaceAll(":", "")
      .trim()
      .toUpperCase();

    const existingUid = await Card.findOne({ uid: cleanUid });
    if (existingUid) {
      return res.json({
        success: false,
        message:
          "⚠️ កាត Physical នេះត្រូវបានភ្ជាប់រួចជាស្រេចជាមួយគណនីផ្សេងបាត់ទៅហើយ!",
      });
    }

    const targetUserId =
      userId || (req.user ? req.user._id || req.user.id : null);
    const userDoc =
      targetUserId && mongoose.isValidObjectId(targetUserId)
        ? await User.findById(targetUserId)
        : await User.findOne({
            username: username || (req.user ? req.user.username : ""),
          });

    if (!userDoc)
      return res.json({ success: false, message: "User not found" });

    const targetCard = await Card.findOne({ id: cardId, userId: userDoc._id });
    if (!targetCard)
      return res.json({ success: false, message: "រកកាតនេះមិនឃើញទេ!" });

    if (targetCard.cardCategory === "virtual" && !targetCard.isPhysical) {
      return res.json({
        success: false,
        message:
          "🛑 កាតនិម្មិត (Virtual Card) មិនអាចភ្ជាប់បន្ទះឈីប NFC ได้ទេ! សូមប្រើប្រាស់កាត Debit ឬ Credit។",
      });
    }

    if (targetCard.uid && targetCard.uid !== "") {
      return res.json({
        success: false,
        message:
          "⚠️ កាតនេះได้ភ្ជាប់ NFC រួចរាល់ហើយ! សូម 'ផ្តាច់កាត' (Unbind) ចាស់ចេញជាមុនសិន។",
      });
    }

    targetCard.uid = cleanUid;
    if (pin) targetCard.pin = pin;
    targetCard.isPhysical = true;
    await targetCard.save();

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
    const { username, userId, cardId } = req.body;
    const targetUserId =
      userId || (req.user ? req.user._id || req.user.id : null);
    const userDoc =
      targetUserId && mongoose.isValidObjectId(targetUserId)
        ? await User.findById(targetUserId)
        : await User.findOne({
            username: username || (req.user ? req.user.username : ""),
          });

    if (!userDoc)
      return res.json({ success: false, message: "User not found" });

    const card = await Card.findOne({ id: cardId, userId: userDoc._id });
    if (card) {
      card.uid = null;
      await card.save();
      return res.json({ success: true, message: "ផ្តាច់កាតជោគជ័យ!" });
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
  const { username, userId, orderedIds } = req.body;
  try {
    const targetUserId =
      userId || (req.user ? req.user._id || req.user.id : null);
    const userDoc =
      targetUserId && mongoose.isValidObjectId(targetUserId)
        ? await User.findById(targetUserId)
        : await User.findOne({
            username: username || (req.user ? req.user.username : ""),
          });

    if (!userDoc) return res.status(403).json({ success: false });

    if (Array.isArray(orderedIds)) {
      await Promise.all(
        orderedIds.map((cardId, idx) =>
          Card.updateOne(
            { id: cardId, userId: userDoc._id },
            { $set: { orderIndex: idx } },
          ),
        ),
      );
    }
    const cards = await Card.find({ userId: userDoc._id }).sort({
      orderIndex: 1,
      createdAt: 1,
    });
    res.json({ success: true, cards });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

module.exports = {
  getMyCards,
  generateCard,
  activatePhysicalCard,
  payCreditCardBill,
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
