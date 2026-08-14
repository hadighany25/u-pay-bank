const User = require("../models/User");
const Merchant = require("../models/Merchant");
const Transaction = require("../models/Transaction");
const crypto = require("crypto");
const axios = require("axios");

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

// 1. API ទទួលសំណើកាតពី U-Mall
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

    if (sourceAccNum === "USD" || sourceAccNum === user.accountNumber) {
      availableBalance = user.balance;
      sourceAccNum = user.accountNumber;
    } else if (
      sourceAccNum === "KHR" ||
      sourceAccNum === user.accountNumberKHR
    ) {
      availableBalance = user.balanceKHR;
      sourceAccNum = user.accountNumberKHR;
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

    const pendingTrx = new Transaction({
      username: user.username,
      refId: orderId,
      hash: crypto.randomBytes(8).toString("hex"),
      type: "Online Payment",
      amount: -parseFloat(amount),
      currency: currency,
      senderName: user.fullName || user.username,
      senderAcc: sourceAccNum,
      receiverName: merchant.name,
      receiverAcc: isKHR
        ? merchant.accountNumbers.KHR
        : merchant.accountNumbers.USD,
      trxMethod: "Card Payment",
      merchantId: merchant.merchantId,
      date: new Date().toLocaleString("en-US", {
        timeZone: "Asia/Phnom_Penh",
        hour12: true,
      }),
      remark: `Payment for Order: ${orderId}`,
      status: "Pending",
    });
    await pendingTrx.save();

    const notifData = {
      title: "សំណើទូទាត់ប្រាក់ 🛒",
      message: `ហាង ${merchant.name} បានស្នើសុំកាត់ប្រាក់ $${parseFloat(amount).toFixed(2)}។ សូមចុចដើម្បីបញ្ជាក់ការទូទាត់!`,
      type: "card_payment_request",
      date: new Date().toLocaleString("en-US", {
        timeZone: "Asia/Phnom_Penh",
        hour12: true,
      }),
      isRead: false,
      metadata: {
        transactionId: pendingTrx._id,
        merchantName: merchant.name,
        amount: amount,
        currency: currency,
        orderId: orderId,
      },
    };

    user.notifications = user.notifications || [];
    user.notifications.push(notifData);
    await user.save();

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

// 2. API ម្ចាស់កាតចុច "យល់ព្រម"
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

    let deducted = false;
    if (trx.senderAcc === user.accountNumber) {
      user.balance -= amount;
      deducted = true;
    } else if (trx.senderAcc === user.accountNumberKHR) {
      user.balanceKHR -= amount;
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

    await Transaction.create({
      username: merchant.userId,
      refId: trx.refId,
      hash: trx.hash,
      date: trx.date,
      type: "Receive",
      amount: amount,
      currency: trx.currency,
      senderName: user.fullName || user.username,
      receiverName: merchant.name,
      receiverAcc: trx.receiverAcc,
      senderAcc: trx.senderAcc,
      trxMethod: "Card Payment",
      remark: trx.remark,
      status: "Hold",
      merchantId: merchant.merchantId,
    });

    const webhookPayload = {
      orderId: trx.refId,
      status: "SUCCESS", // U-Mall មើលឃើញ SUCCESS ទើបវាដើរ Process
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

// 3. API ម្ចាស់កាតចុច "បដិសេធ"
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

// 🌟 4. API ថ្មី៖ សម្រាប់បញ្ចេញលុយ Hold ភ្លាមៗ (Manual Release)
exports.releaseHoldPayment = async (req, res) => {
  try {
    const { transactionId } = req.body;

    // ស្វែងរក Transaction ដែលកំពុងជាប់ Hold (របស់អ្នកទទួល/ហាង)
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
    const user = await User.findOne({ username: merchant.userId }); // ថៅកែហាង

    if (!merchant || !user)
      return res
        .status(404)
        .json({ success: false, message: "រកមិនឃើញគណនីហាង!" });

    const amount = Math.abs(trx.amount);
    const isKHR = trx.currency === "KHR";

    // ១. ដកលុយពីប្រអប់ Escrow បញ្ចូលទៅកុង Balance ធម្មតាវិញ
    if (isKHR) {
      merchant.escrowHold.KHR -= amount;
      user.balanceKHR += amount;
    } else {
      merchant.escrowHold.USD -= amount;
      user.balance += amount;
    }

    // ២. ប្តូរ Status ទៅជា Success ទាំងប្រតិបត្តិការអ្នកផ្ញើ និងអ្នកទទួល
    trx.status = "Success";
    await trx.save();

    // ដូរ Status របស់ភ្ញៀវដែលកាត់លុយអោយទៅជា Success ដែរ
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

// // =======================================================
// // ប្រព័ន្ធទម្លាក់លុយអូតូ (Auto Release Escrow) ក្រោយ ២៤ម៉ោង (រក្សាទុកដដែល)
// // =======================================================
// const autoReleaseEscrow = async () => {
//   try {
//     const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
//     const holdTrxs = await Transaction.find({
//       status: "Hold",
//       type: "Receive",
//     });

//     for (let trx of holdTrxs) {
//       const trxDate = new Date(trx.createdAt || trx.date);
//       if (trxDate <= twentyFourHoursAgo) {
//         const merchant = await Merchant.findOne({ merchantId: trx.merchantId });
//         const user = await User.findOne({ username: merchant.userId });

//         if (merchant && user) {
//           const amount = Math.abs(trx.amount);
//           const isKHR = trx.currency === "KHR";

//           if (isKHR) {
//             merchant.escrowHold.KHR -= amount;
//             user.balanceKHR += amount;
//           } else {
//             merchant.escrowHold.USD -= amount;
//             user.balance += amount;
//           }

//           trx.status = "Success";
//           await trx.save();
//           await Transaction.updateMany(
//             { refId: trx.refId, hash: trx.hash },
//             { status: "Success" },
//           );

//           await merchant.save();
//           await user.save();
//         }
//       }
//     }
//   } catch (error) {
//     console.error("Auto Release Error:", error);
//   }
// };

// setInterval(autoReleaseEscrow, 3600000);

// =======================================================
// ប្រព័ន្ធទម្លាក់លុយអូតូ (Auto Release Escrow)
// =======================================================
const autoReleaseEscrow = async () => {
  try {
    // ⏳ កន្លែងកែម៉ោង: 2 * 60 * 1000 គឺស្មើនឹង "២ នាទី" (សម្រាប់តេស្ត)
    // 💡 ពេលតេស្តចប់ ចង់បាន ២៤ម៉ោងវិញ សូមដូរទៅជា: 24 * 60 * 60 * 1000
    const timeLimit = new Date(Date.now() - 2 * 60 * 1000);

    const holdTrxs = await Transaction.find({
      status: "Hold",
      type: "Receive",
    });

    for (let trx of holdTrxs) {
      const trxDate = new Date(trx.createdAt || trx.date);

      // បើប្រតិបត្តិការនោះ ហួស ២ នាទី វានឹងចូលមកធ្វើការទម្លាក់លុយ
      if (trxDate <= timeLimit) {
        const merchant = await Merchant.findOne({ merchantId: trx.merchantId });
        const user = await User.findOne({ username: merchant.userId }); // ថៅកែហាង

        if (merchant && user) {
          const amount = Math.abs(trx.amount);
          const isKHR = trx.currency === "KHR";

          // ដកពី Escrow បញ្ចូលទៅ Balance កុងធំវិញ
          if (isKHR) {
            merchant.escrowHold.KHR -= amount;
            user.balanceKHR += amount;
          } else {
            merchant.escrowHold.USD -= amount;
            user.balance += amount;
          }

          trx.status = "Success";
          await trx.save();

          // អាប់ដេតខាងកុងអ្នកបង់ប្រាក់អោយទៅជា Success ដែរ
          await Transaction.updateMany(
            { refId: trx.refId, hash: trx.hash },
            { status: "Success" },
          );

          await merchant.save();
          await user.save();
          console.log(
            `✅ Auto-Released: ប្រាក់ $${amount} ត្រូវបានទម្លាក់ចូលកុង ${merchant.name} រួចរាល់!`,
          );
        }
      }
    }
  } catch (error) {
    console.error("Auto Release Error:", error);
  }
};

// ⏳ សម្រាប់តេស្ត៖ អោយវាដើរឆែករៀងរាល់ "៣០ វិនាទី" ម្តង (30000ms)
// 💡 ពេលតេស្តចប់ ចង់បាន ១ម៉ោងឆែកម្តង សូមដូរទៅជា: 3600000
setInterval(autoReleaseEscrow, 30000);
