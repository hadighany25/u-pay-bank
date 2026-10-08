// gatewayController.js
const User = require("../models/User");
const Merchant = require("../models/Merchant");
const Transaction = require("../models/Transaction");
const Notification = require("../models/Notification");
const crypto = require("crypto");
const axios = require("axios");

// ========================================================
// 🛠️ Function ជំនួយ (Helpers) សម្រាប់បង្កើត Hash & Ref ID
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

// ========================================================
// 🌐 មុខងារបាញ់ Webhook ទៅកាន់ U-Mall
// ========================================================
const fireWebhook = async (webhookUrl, payload, apiSecret) => {
  try {
    if (!webhookUrl) return;
    const signature = crypto
      .createHmac("sha256", apiSecret)
      .update(JSON.stringify(payload))
      .digest("hex");
    await axios.post(webhookUrl, payload, {
      headers: { "x-upay-signature": signature },
    });
    console.log(`✅ Webhook ជោគជ័យទៅកាន់: ${webhookUrl}`);
  } catch (error) {
    console.error(`⚠️ Webhook បរាជ័យ: ${error.message}`);
  }
};

// ========================================================
// ១. API ទទួលសំណើកាត់ប្រាក់ពីកាត (Request from U-Mall)
// ========================================================
exports.requestCardPayment = async (req, res) => {
  try {
    const {
      merchantId,
      orderId,
      amount,
      currency,
      cardNumber,
      expiry,
      cvv,
      timestamp,
      hash,
    } = req.body;

    const merchant = await Merchant.findOne({
      merchantId: merchantId,
      status: "Active",
    });
    if (!merchant)
      return res
        .status(404)
        .json({ success: false, message: "រកមិនឃើញគណនីអាជីវកម្មនេះទេ!" });

    const dataToSign = `${merchantId}${orderId}${amount}${currency}${cardNumber}${timestamp}`;
    const expectedHash = crypto
      .createHmac("sha256", merchant.apiSecret)
      .update(dataToSign)
      .digest("hex");

    if (hash !== expectedHash) {
      return res.status(403).json({
        success: false,
        message: "ហាមឃាត់៖ សោរសម្ងាត់មិនត្រឹមត្រូវ (Invalid Signature)!",
      });
    }

    const cleanCardNum = cardNumber.replace(/\s+/g, "");
    const spacedCardNum = cleanCardNum.replace(/(.{4})/g, "$1 ").trim();

    const user = await User.findOne({
      $or: [
        { "virtualCards.number": cleanCardNum },
        { "virtualCards.number": spacedCardNum },
      ],
    });

    if (!user)
      return res.status(404).json({
        success: false,
        message: "រកមិនឃើញលេខកាតនេះក្នុងប្រព័ន្ធ U-Pay ទេ!",
      });

    const cleanInputExpiry = String(expiry).trim();
    const cleanInputCvv = String(cvv).trim();

    const card = user.virtualCards.find((c) => {
      if (!c.number || !c.expiry || !c.cvv) return false;
      const dbCardNum = String(c.number).replace(/\s+/g, "");
      let dbExpiry = String(c.expiry).trim();
      const dbCvv = String(c.cvv).trim();
      if (dbExpiry.length === 7 && dbExpiry.includes("/20")) {
        dbExpiry = dbExpiry.replace("/20", "/");
      }
      return (
        dbCardNum === cleanCardNum &&
        dbExpiry === cleanInputExpiry &&
        dbCvv === cleanInputCvv
      );
    });

    if (!card)
      return res.status(400).json({
        success: false,
        message: "ថ្ងៃផុតកំណត់ (Expiry) ឬ លេខកូដសម្ងាត់ (CVV) មិនត្រឹមត្រូវទេ!",
      });
    if (card.isLocked || card.lockedByAdmin)
      return res.status(403).json({
        success: false,
        message: "កាតនេះត្រូវបានផ្អាកដំណើរការជាបណ្តោះអាសន្ន!",
      });
    if (!card.isOnlinePayEnabled)
      return res.status(403).json({
        success: false,
        message: "កាតនេះមិនទាន់បានបើកមុខងារទូទាត់អនឡាញទេ!",
      });

    const isKHR = currency === "KHR";
    let availableBalance = 0;
    let sourceAccNum = card.linkedAccount;

    // 🌟 កែតម្រូវឱ្យស្គាល់ទម្រង់ User.js ថ្មី (Main Accounts)
    const mainUsdNum =
      user.mainAccounts?.USD?.accountNumber || user.accountNumber;
    const mainKhrNum =
      user.mainAccounts?.KHR?.accountNumber || user.accountNumberKHR;

    if (sourceAccNum === "USD" || sourceAccNum === mainUsdNum) {
      availableBalance = user.mainAccounts?.USD?.balance || user.balance || 0;
      sourceAccNum = mainUsdNum;
    } else if (sourceAccNum === "KHR" || sourceAccNum === mainKhrNum) {
      availableBalance =
        user.mainAccounts?.KHR?.balance || user.balanceKHR || 0;
      sourceAccNum = mainKhrNum;
    } else {
      const sub = user.subAccounts.find(
        (s) => s.accountNumber === sourceAccNum,
      );
      if (sub) availableBalance = sub.balance;
    }

    if (availableBalance < parseFloat(amount)) {
      return res.status(400).json({
        success: false,
        message: "សមតុល្យក្នុងគណនីរបស់អ្នកមិនគ្រប់គ្រាន់ទេ!",
      });
    }

    // 🌟 បន្ថែម cardId និង cardNumber ចូលដើម្បីកុំឱ្យគាំង Slip
    const pendingTrx = new Transaction({
      userId: user._id,
      username: user.username,
      refId: orderId,
      hash: generateStandardHash(),
      type: "Online Payment",
      amount: -parseFloat(amount),
      currency: currency,
      senderName: user.fullName || user.username,
      senderAcc: sourceAccNum, // លេខកុងថ្មីពិតប្រាកដ
      receiverName: merchant.name,
      receiverAcc: isKHR
        ? merchant.accountNumbers.KHR
        : merchant.accountNumbers.USD,
      trxMethod: "Card Payment",
      merchantId: merchant.merchantId,
      cardId: card.id, // 🔥 ការពារកុំឱ្យគាំង Slip
      cardNumber: card.number, // 🔥 ការពារកុំឱ្យគាំង Slip
      date: new Date().toLocaleString("en-US", {
        timeZone: "Asia/Phnom_Penh",
        hour12: true,
      }),
      remark: `Payment for Order: ${orderId}`,
      status: "Pending",
    });
    await pendingTrx.save();

    await Notification.create({
      userId: user._id,
      username: user.username,
      title: "សំណើទូទាត់ប្រាក់ 🛒",
      message: `ហាង ${merchant.name} បានស្នើសុំកាត់ប្រាក់ ${isKHR ? "៛" : "$"}${parseFloat(amount).toLocaleString()}។ សូមចុចដើម្បីបញ្ជាក់ការទូទាត់!`,
      type: "card_payment_request",
      date: new Date().toLocaleString("en-US", {
        timeZone: "Asia/Phnom_Penh",
        hour12: true,
      }),
      isRead: false,
      metadata: {
        transactionId: pendingTrx._id.toString(),
        merchantName: merchant.name,
        amount: amount,
        currency: currency,
        orderId: orderId,
      },
    });

    res.status(200).json({
      success: true,
      message: "សំណើបានបញ្ជូនទៅកាន់ម្ចាស់កាតជោគជ័យ។",
      transactionId: pendingTrx._id,
    });
  } catch (error) {
    console.error("Gateway Request Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// ========================================================
// ២. API ម្ចាស់កាតចុច "យល់ព្រម" លើការទូទាត់ (Approve Payment)
// ========================================================
exports.confirmPayment = async (req, res) => {
  try {
    const { transactionId, pin } = req.body;

    let user = null;
    if (req.user) {
      const userId = req.user.id || req.user._id;
      if (userId) {
        try {
          user = await User.findOne({
            $or: [{ id: String(userId) }, { _id: userId }],
          });
        } catch (err) {
          user = await User.findOne({ id: String(userId) });
        }
      }
      if (!user && req.user.username) {
        user = await User.findOne({ username: req.user.username });
      }
    }

    if (!user)
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized: រកមិនឃើញគណនី!" });
    if (user.pin !== pin)
      return res
        .status(400)
        .json({ success: false, message: "លេខសម្ងាត់ PIN មិនត្រឹមត្រូវទេ!" });

    const trx = await Transaction.findById(transactionId);
    if (!trx || trx.status !== "Pending" || trx.username !== user.username) {
      return res.status(404).json({
        success: false,
        message: "សំណើទូទាត់មិនត្រឹមត្រូវ ឬផុតកំណត់!",
      });
    }

    const merchant = await Merchant.findOne({ merchantId: trx.merchantId });
    if (!merchant)
      return res
        .status(404)
        .json({ success: false, message: "រកមិនឃើញគណនីហាងនេះទេ!" });

    const amount = Math.abs(trx.amount);
    const isKHR = trx.currency === "KHR";

    // 🌟 ការកាត់ប្រាក់ផ្អែកលើទម្រង់ User.js ថ្មី
    let deducted = false;
    const mainUsdNum =
      user.mainAccounts?.USD?.accountNumber || user.accountNumber;
    const mainKhrNum =
      user.mainAccounts?.KHR?.accountNumber || user.accountNumberKHR;

    if (trx.senderAcc === mainUsdNum || trx.senderAcc === user.accountNumber) {
      if (user.mainAccounts?.USD) user.mainAccounts.USD.balance -= amount;
      else user.balance -= amount;
      user.markModified("mainAccounts");
      deducted = true;
    } else if (
      trx.senderAcc === mainKhrNum ||
      trx.senderAcc === user.accountNumberKHR
    ) {
      if (user.mainAccounts?.KHR) user.mainAccounts.KHR.balance -= amount;
      else user.balanceKHR -= amount;
      user.markModified("mainAccounts");
      deducted = true;
    } else {
      const sub = user.subAccounts.find(
        (s) => s.accountNumber === trx.senderAcc,
      );
      if (sub) {
        sub.balance -= amount;
        user.markModified("subAccounts");
        deducted = true;
      }
    }

    if (!deducted)
      return res
        .status(400)
        .json({ success: false, message: "សមតុល្យមិនគ្រប់គ្រាន់!" });
    await user.save();

    if (!merchant.escrowHold) merchant.escrowHold = { USD: 0, KHR: 0 };
    if (isKHR)
      merchant.escrowHold.KHR = (merchant.escrowHold.KHR || 0) + amount;
    else merchant.escrowHold.USD = (merchant.escrowHold.USD || 0) + amount;
    await merchant.save();

    trx.status = "Hold";
    await trx.save();

    let linkedAcc = isKHR
      ? merchant.linkedAccounts.KHR
      : merchant.linkedAccounts.USD;
    if (!linkedAcc)
      linkedAcc = merchant.linkedAccounts.USD || merchant.linkedAccounts.KHR;

    const merchantOwner = await User.findOne({ username: merchant.userId });

    // 🌟 កត់ត្រាប្រវត្តិ ទទួលលុយ អោយ Merchant
    await Transaction.create({
      userId: merchantOwner ? merchantOwner._id : undefined,
      username: merchant.userId,
      refId: trx.refId,
      hash: trx.hash,
      date: trx.date,
      type: "Receive",
      amount: amount,
      currency: trx.currency,
      senderName: user.fullName || user.username,
      receiverName: merchant.name,
      receiverAcc: linkedAcc,
      senderAcc: trx.senderAcc,
      trxMethod: "Card Payment",
      remark: trx.remark,
      status: "Hold",
      merchantId: merchant.merchantId,
      cardId: trx.cardId, // 🔥 ការពារកុំឱ្យគាំង Slip ពេលហាងមើល
      cardNumber: trx.cardNumber, // 🔥 ការពារកុំឱ្យគាំង Slip ពេលហាងមើល
    });

    const webhookPayload = {
      orderId: trx.refId,
      status: "SUCCESS",
      amount: amount,
      currency: trx.currency,
      upayTransactionId: trx._id,
    };
    await fireWebhook(merchant.webhookUrl, webhookPayload, merchant.apiSecret);

    res.status(200).json({ success: true, message: "ការទូទាត់ជោគជ័យ!" });
  } catch (error) {
    console.error("Confirm Payment Error:", error);
    res
      .status(500)
      .json({ success: false, message: "Server Error: " + error.message });
  }
};

// ========================================================
// ៣. API ម្ចាស់កាតចុច "បដិសេធ" (Reject Payment)
// ========================================================
exports.rejectPayment = async (req, res) => {
  try {
    const { transactionId } = req.body;

    let user = null;
    if (req.user) {
      const userId = req.user.id || req.user._id;
      if (userId) {
        try {
          user = await User.findOne({
            $or: [{ id: String(userId) }, { _id: userId }],
          });
        } catch (err) {
          user = await User.findOne({ id: String(userId) });
        }
      }
      if (!user && req.user.username)
        user = await User.findOne({ username: req.user.username });
    }

    if (!user)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const trx = await Transaction.findById(transactionId);
    if (!trx || trx.status !== "Pending" || trx.username !== user.username) {
      return res
        .status(404)
        .json({ success: false, message: "សំណើមិនត្រឹមត្រូវ!" });
    }

    trx.status = "Failed";
    await trx.save();

    const merchant = await Merchant.findOne({ merchantId: trx.merchantId });
    if (merchant && merchant.webhookUrl) {
      const webhookPayload = {
        orderId: trx.refId,
        status: "FAILED",
        reason: "អតិថិជនបានបដិសេធការទូទាត់",
      };
      await fireWebhook(
        merchant.webhookUrl,
        webhookPayload,
        merchant.apiSecret,
      );
    }

    res
      .status(200)
      .json({ success: true, message: "អ្នកបានបដិសេធសំណើនេះរួចរាល់។" });
  } catch (error) {
    console.error("Reject Payment Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// ========================================================
// ៤. API បញ្ចេញលុយ Hold ភ្លាមៗ (Manual Release)
// ========================================================
exports.releaseHoldPayment = async (req, res) => {
  try {
    const { transactionId } = req.body;

    const trx = await Transaction.findOne({
      _id: transactionId,
      status: "Hold",
      type: "Receive",
    });
    if (!trx)
      return res.status(404).json({
        success: false,
        message: "រកមិនឃើញប្រតិបត្តិការ ឬមិនស្ថិតក្នុងស្ថានភាព Hold ទេ!",
      });

    const merchant = await Merchant.findOne({ merchantId: trx.merchantId });
    const user = await User.findOne({ username: merchant.userId });

    if (!merchant || !user)
      return res
        .status(404)
        .json({ success: false, message: "រកមិនឃើញគណនីហាង!" });

    const amount = Math.abs(trx.amount);
    const isKHR = trx.currency === "KHR";

    // 🌟 ការបញ្ចេញលុយចូលកុងថ្មី
    if (isKHR) {
      merchant.escrowHold.KHR -= amount;
      if (user.mainAccounts?.KHR) user.mainAccounts.KHR.balance += amount;
      else user.balanceKHR += amount;
    } else {
      merchant.escrowHold.USD -= amount;
      if (user.mainAccounts?.USD) user.mainAccounts.USD.balance += amount;
      else user.balance += amount;
    }
    user.markModified("mainAccounts");

    trx.status = "Success";
    await trx.save();

    await Transaction.updateMany(
      { refId: trx.refId, hash: trx.hash },
      { status: "Success" },
    );

    await merchant.save();
    await user.save();

    res.status(200).json({
      success: true,
      message: "ប្រាក់ត្រូវបានបញ្ចេញចូលគណនីហាងដោយជោគជ័យ!",
    });
  } catch (error) {
    console.error("Manual Release Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// =======================================================
// ៥. ប្រព័ន្ធទម្លាក់លុយអូតូ (Auto Release Escrow) ក្រោយ ២៤ម៉ោង
// =======================================================
const autoReleaseEscrow = async () => {
  try {
    const timeLimit = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const holdTrxs = await Transaction.find({
      status: "Hold",
      type: { $in: ["Receive", "Received"] },
    });

    for (let trx of holdTrxs) {
      const trxDate = new Date(trx.createdAt || trx.date);

      if (trxDate <= timeLimit) {
        const merchant = await Merchant.findOne({ merchantId: trx.merchantId });
        if (!merchant) continue;

        const user = await User.findOne({ username: merchant.userId });

        if (merchant && user) {
          const amount = Math.abs(trx.amount);
          const isKHR = trx.currency === "KHR";

          // 🌟 ការបញ្ចេញលុយចូលកុងថ្មី
          if (isKHR) {
            merchant.escrowHold.KHR = (merchant.escrowHold.KHR || 0) - amount;
            merchant.collected.KHR = (merchant.collected.KHR || 0) + amount;
            if (user.mainAccounts?.KHR) user.mainAccounts.KHR.balance += amount;
            else user.balanceKHR += amount;
          } else {
            merchant.escrowHold.USD = (merchant.escrowHold.USD || 0) - amount;
            merchant.collected.USD = (merchant.collected.USD || 0) + amount;
            if (user.mainAccounts?.USD) user.mainAccounts.USD.balance += amount;
            else user.balance += amount;
          }
          user.markModified("mainAccounts");

          trx.status = "Success";
          await trx.save();

          await Transaction.updateMany(
            { refId: trx.refId, hash: trx.hash },
            { status: "Success" },
          );

          await merchant.save();
          await user.save();
          console.log(
            `✅ Auto-Released: ប្រាក់ ${isKHR ? "៛" : "$"}${amount} ត្រូវបានទម្លាក់ចូលកុង ${merchant.name} រួចរាល់!`,
          );
        }
      }
    }
  } catch (error) {
    console.error("Auto Release Error:", error);
  }
};

setInterval(autoReleaseEscrow, 3600000);
