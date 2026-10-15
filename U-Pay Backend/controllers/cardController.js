// ============================================================================
// ឯកសារ: controllers/cardController.js (100% Full Code - 3 Card Categories Flow)
// ============================================================================

const User = require("../models/User");
const Card = require("../models/Card");
const Transaction = require("../models/Transaction");
const System = require("../models/System");
const JointAccount = require("../models/JointAccount");
const Notification = require("../models/Notification");

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
    };
  }
  if (accNum === "KHR" || accNum === user.mainAccounts?.KHR?.accountNumber) {
    return {
      type: "MAIN_KHR",
      accObj: user.mainAccounts.KHR,
      currency: "KHR",
      accountNumber:
        user.mainAccounts?.KHR?.accountNumber || user.accountNumberKHR,
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
        };
      }
      return {
        type: "SUB",
        subIndex: idx,
        accObj: sub,
        currency: sub.currency || "USD",
        accountNumber: sub.accountNumber,
      };
    }
  }
  return null;
}

// =======================================================
// ០. ទាញយកកាតទាំងអស់របស់ User (រួមទាំង Auto-Migrate កាតចាស់)
// =======================================================
const getMyCards = async (req, res) => {
  try {
    const username = req.user.username;
    let cards = await Card.find({ username }).sort({
      orderIndex: 1,
      createdAt: 1,
    });

    // 🔄 AUTO-MIGRATION: បើក្នុងតារាង Card ថ្មីអត់ទាន់មាន តែក្នុង User ចាស់មាន គឺចម្លងចូលអូតូ!
    if (cards.length === 0) {
      const rawUser = await User.collection.findOne({ username });
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
            userCustomId: rawUser.id || rawUser._id.toString(),
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

  if (req.user.username !== username)
    return res.status(403).json({ success: false, message: "Unauthorized!" });

  try {
    const user = await User.findOne({ username });
    if (!user) return res.json({ success: false, message: "User not found" });
    if (user.pin !== pin)
      return res.json({ success: false, message: "លេខ PIN មិនត្រឹមត្រូវទេ!" });

    const existingCardsCount = await Card.countDocuments({ username });
    if (existingCardsCount >= 10) {
      return res.json({
        success: false,
        message: "អ្នកអាចបង្កើតកាតបានត្រឹមតែ ១០ សន្លឹកប៉ុណ្ណោះ!",
      });
    }

    const cleanCategory = ["virtual", "debit", "credit"].includes(cardCategory)
      ? cardCategory
      : "virtual";

    // 🛡️ បើជា Virtual Card អនុញ្ញាតឱ្យតែ Standard និង Metal Gold ប៉ុណ្ណោះ
    let finalCardType = cardType || "standard";
    if (
      cleanCategory === "virtual" &&
      finalCardType !== "standard" &&
      finalCardType !== "metal"
    ) {
      finalCardType = "standard";
    }

    // 🌟 ស្វែងរកគណនីដែលអតិថិជនជ្រើសរើស (សម្រាប់ភ្ជាប់ និងកាត់ថ្លៃសេវាចេញកាត)
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

    // គណនាថ្លៃសេវាតាមរូបិយប័ណ្ណរបស់គណនីដែលបានជ្រើសរើស
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

    // 💸 កាត់លុយថ្លៃសេវាពីគណនីដែលបានជ្រើសរើសផ្ទាល់តែម្តង
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

    // 🏦 បូកលុយថ្លៃសេវាចូលគណនីកណ្តាលរបស់ Super Admin (888000999)
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

    // គណនាថ្ងៃកំណត់បង់ប្រាក់សម្រាប់ Credit Card (៣០ ថ្ងៃក្រោយ)
    const dueD = new Date();
    dueD.setDate(dueD.getDate() + 30);
    const billingDueStr = dueD.toISOString().split("T")[0];

    const approvedCreditLimit =
      cleanCategory === "credit"
        ? Math.min(10000, Math.max(100, parseFloat(creditLimit) || 1000))
        : 0;

    // 💳 បង្កើតកាតទុកក្នុង Model Card.js ថ្មី
    await Card.create({
      userId: user._id,
      username: user.username,
      userCustomId: user.id || user._id.toString(),
      id: newCardId,
      cardCategory: cleanCategory,
      type: finalCardType,
      name: tier.name,
      number: details.number,
      cvv: details.cvv,
      expiry: details.expiry,
      // Credit Card ប្រើវង់ប្រាក់ធនាគារ តែរក្សាទុកកុងបង្គោលសម្រាប់យោង
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

    // 🧾 វិក្កយបត្រកាត់លុយថ្លៃសេវាចេញកាត
    await Transaction.create({
      userId: user._id,
      username: user.username,
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

    // 🧾 វិក្កយបត្រចំណូលប្រព័ន្ធ (System Fee)
    await Transaction.create({
      userId: superAdmin?._id,
      username: superAdmin ? superAdmin.username : "superadmin",
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

    // 🔔 ផ្ញើសារជូនដំណឹងទៅអតិថិជន (ដោយមិនបង្ហាញលេខ ៤ ខ្ទង់ចុងក្រោយឡើយ)
    if (isPhysicalCard) {
      await Notification.create({
        userId: user._id,
        username: user.username,
        title: `💳 សំណើផលិត ${catDisplayLabel} ជោគជ័យ`,
        message: `សំណើផលិតកាត ${tier.name} (លេខសម្គាល់: #${refId}) ត្រូវបានទទួល។ វិធីទទួលកាត: ${deliveryMethod || "Branch Pickup"}។ ពេលទទួលបានកាតពិតក្នុងដៃ សូមវាយលេខ ៤ ខ្ទង់ចុងក្រោយដែលបោះពុម្ពលើកាតដើម្បីបើកដំណើរការ!`,
        date: dateStr,
        type: "info",
        isRead: false,
      });
    }

    const allCards = await Card.find({ username }).sort({
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
// ១.១ [ថ្មី] អតិថិជនវាយលេខ ៤ ខ្ទង់ចុងក្រោយដើម្បី Activate កាតរូបវ័ន្ត
// =======================================================
const activatePhysicalCard = async (req, res) => {
  const { username, cardId, last4Digits, pin } = req.body;
  if (req.user.username !== username)
    return res.status(403).json({ success: false, message: "Unauthorized!" });

  try {
    const user = await User.findOne({ username });
    if (!user) return res.json({ success: false, message: "User not found" });
    if (user.pin !== pin) {
      return res.json({
        success: false,
        message: "លេខសម្ងាត់ PIN គណនីមិនត្រឹមត្រូវទេ!",
      });
    }

    const card = await Card.findOne({ id: cardId, username });
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
      username: user.username,
      title: "🟢 កាតរូបវ័ន្តត្រូវបានបើកដំណើរការជោគជ័យ!",
      message: `កាត ${card.name} (**** ${actualLast4}) របស់អ្នកត្រូវបានផ្ទៀងផ្ទាត់ និងបើកដំណើរការពេញលេញហើយ។`,
      date: nowStr,
      type: "info",
      isRead: false,
    });

    const cards = await Card.find({ username }).sort({
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
// ១.២ [ថ្មី] អតិថិជនបង់ប្រាក់សងបំណុលកាតឥណទាន (Pay Credit Card Bill)
// =======================================================
const payCreditCardBill = async (req, res) => {
  const { username, cardId, fromAccount, amount, pin } = req.body;
  if (req.user.username !== username)
    return res.status(403).json({ success: false, message: "Unauthorized!" });

  try {
    const user = await User.findOne({ username });
    if (!user) return res.json({ success: false, message: "User not found" });
    if (user.pin !== pin) {
      return res.json({
        success: false,
        message: "លេខសម្ងាត់ PIN មិនត្រឹមត្រូវទេ!",
      });
    }

    const card = await Card.findOne({ id: cardId, username });
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
      payAmountUSD = currentDebtUSD; // ការពារកុំឱ្យបង់លើសចំនួនជំពាក់
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

    // ១. កាត់ប្រាក់ពីគណនីរបស់អតិថិជន
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

    // ២. កាត់បន្ថយបំណុលក្នុងកាត Credit
    card.currentDebt = Math.max(
      0,
      Number((currentDebtUSD - payAmountUSD).toFixed(2)),
    );
    await card.save();

    // ៣. បូកចូលគណនី Central Bank (888888888)
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
      username: user.username,
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

    const cards = await Card.find({ username }).sort({
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
  const { cardId, isLocked } = req.body;
  const username = req.user ? req.user.username : req.body.username;
  try {
    const card = await Card.findOne({ id: cardId, username });
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
  const { username, cardId, isEnabled } = req.body;
  if (req.user.username !== username)
    return res.status(403).json({ success: false });
  try {
    const card = await Card.findOne({ id: cardId, username });
    if (!card) return res.json({ success: false });

    card.isOnlinePayEnabled = isEnabled;
    await card.save();

    const cards = await Card.find({ username }).sort({
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
  const { username, cardId, newLimit, newCountLimit } = req.body;
  if (req.user.username !== username)
    return res.status(403).json({ success: false });
  try {
    const card = await Card.findOne({ id: cardId, username });
    if (!card) return res.json({ success: false });

    if (newLimit !== undefined) card.dailyLimit = parseFloat(newLimit);
    if (newCountLimit !== undefined)
      card.dailyTxCountLimit = parseInt(newCountLimit, 10);
    await card.save();

    const cards = await Card.find({ username }).sort({
      orderIndex: 1,
      createdAt: 1,
    });
    res.json({ success: true, cards });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

// =======================================================
// ៥. លុបកាត (ការពារមិនឱ្យលុប Credit Card ដែលនៅជំពាក់លុយ)
// =======================================================
const deleteCard = async (req, res) => {
  const { username, cardId } = req.body;
  if (req.user.username !== username)
    return res.status(403).json({ success: false });
  try {
    const card = await Card.findOne({ id: cardId, username });
    if (!card) {
      return res.json({ success: false, message: "រកមិនឃើញកាតនេះទេ!" });
    }

    if (card.cardCategory === "credit" && (card.currentDebt || 0) > 0) {
      return res.json({
        success: false,
        message: `មិនអាចបិទកាតឥណទាននេះបានទេ! អ្នកនៅជំពាក់ទឹកប្រាក់ចំនួន $${Number(card.currentDebt).toFixed(2)} សូមទូទាត់សងជាមុនសិន។`,
      });
    }

    await Card.findOneAndDelete({ id: cardId, username });
    const cards = await Card.find({ username }).sort({
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
  const { username, cardId, oldPin, newPin } = req.body;
  if (req.user.username !== username)
    return res.status(403).json({ success: false });
  try {
    const card = await Card.findOne({ id: cardId, username });
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
  const { username, cardId, name } = req.body;
  if (req.user.username !== username)
    return res.status(403).json({ success: false });
  try {
    const card = await Card.findOne({ id: cardId, username });
    if (!card) return res.json({ success: false });

    card.name = name.toUpperCase();
    await card.save();

    const cards = await Card.find({ username }).sort({
      orderIndex: 1,
      createdAt: 1,
    });
    res.json({ success: true, cards });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

// =======================================================
// ៨. ភ្ជាប់កាត NFC (អនុញ្ញាតតែលើកាត Debit និង Credit ប៉ុណ្ណោះ)
// =======================================================
const bindNfcCard = async (req, res) => {
  try {
    const { username, cardId, pin, uid } = req.body;
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

    const targetCard = await Card.findOne({ id: cardId, username });
    if (!targetCard)
      return res.json({ success: false, message: "រកកាតនេះមិនឃើញទេ!" });

    if (targetCard.cardCategory === "virtual" && !targetCard.isPhysical) {
      return res.json({
        success: false,
        message:
          "🛑 កាតនិម្មិត (Virtual Card) មិនអាចភ្ជាប់បន្ទះឈីប NFC បានទេ! សូមប្រើប្រាស់កាត Debit ឬ Credit។",
      });
    }

    if (targetCard.uid && targetCard.uid !== "") {
      return res.json({
        success: false,
        message:
          "⚠️ កាតនេះបានភ្ជាប់ NFC រួចរាល់ហើយ! សូម 'ផ្តាច់កាត' (Unbind) ចាស់ចេញជាមុនសិន។",
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
    const { username, cardId } = req.body;
    const card = await Card.findOne({ id: cardId, username });
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
  const { username, orderedIds } = req.body;
  if (req.user.username !== username)
    return res.status(403).json({ success: false });

  try {
    if (Array.isArray(orderedIds)) {
      await Promise.all(
        orderedIds.map((cardId, idx) =>
          Card.updateOne(
            { id: cardId, username },
            { $set: { orderIndex: idx } },
          ),
        ),
      );
    }
    const cards = await Card.find({ username }).sort({
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
