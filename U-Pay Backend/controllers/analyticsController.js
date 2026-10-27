// ============================================================================
// ឯកសារ: controllers/analyticsController.js
// អត្ថន័យ: ខួរក្បាលវិភាគលំហូរសាច់ប្រាក់ ចំណូល-ចំណាយ និងផែនការកំណត់ការចាយ (Strict _id Binding)
// ============================================================================

const User = require("../models/User");
const Transaction = require("../models/Transaction");
const Notification = require("../models/Notification");
const { readFXRates } = require("../services/systemService");
const mongoose = require("mongoose");

// 🛠️ អនុគមន៍ចាត់ថ្នាក់ប្រតិបត្តិការទៅតាមប្រភេទចំណូល និងចំណាយដោយស្វ័យប្រវត្តិ
function classifyTransactionCategory(trx, isIncome) {
  const type = String(trx.type || "").toLowerCase();
  const method = String(trx.trxMethod || "").toLowerCase();
  const remark = String(trx.remark || "").toLowerCase();

  if (isIncome) {
    if (type.includes("deposit") || method.includes("cash deposit")) {
      return "deposit"; // 🏦 ដាក់ប្រាក់ចូល
    }
    if (
      type.includes("promo") ||
      type.includes("reward") ||
      type.includes("bonus") ||
      remark.includes("promo")
    ) {
      return "reward"; // 🎁 រង្វាន់ និងប្រូម៉ូសិន
    }
    if (type.includes("refund")) {
      return "refund"; // ↩️ ប្រាក់បង្វិលត្រឡប់
    }
    return "transfer_in"; // 📥 ទទួលប្រាក់ផ្ទេរ
  } else {
    if (
      trx.cardId ||
      trx.cardNumber ||
      type.includes("card") ||
      type.includes("tap to pay") ||
      method.includes("nfc")
    ) {
      return "card_spend"; // 💳 ចំណាយតាមកាត
    }
    if (
      trx.merchantId ||
      type.includes("merchant") ||
      method.includes("qr") ||
      remark.includes("ហាង") ||
      remark.includes("កាហ្វេ") ||
      remark.includes("អាហារ")
    ) {
      return "food_shopping"; // 🍔 អាហារ និងហាងទំនិញ
    }
    if (
      type.includes("bill") ||
      trx.receiverAcc === "777888999" ||
      remark.includes("ទឹក") ||
      remark.includes("ភ្លើង") ||
      remark.includes("អ៊ីនធឺណិត")
    ) {
      return "bills"; // ⚡ ទូទាត់វិក្កយបត្រ
    }
    if (type.includes("withdrawal") || method.includes("withdrawal")) {
      return "withdrawal"; // 🏧 ដកសាច់ប្រាក់
    }
    if (type.includes("transfer") || type.includes("sent")) {
      return "transfer_out"; // 💸 ផ្ទេរប្រាក់ចេញ
    }
    return "other_expense"; // 📦 ចំណាយផ្សេងៗ
  }
}

/**
 * 📌 ១. ទាញយកទិន្នន័យវិភាគចំណូល-ចំណាយ និងស្ថានភាពផែនការចំណាយ (Budget Status)
 */
exports.getUserAnalyticsSummary = async (req, res) => {
  try {
    const userId =
      req.user?.id || req.user?._id || req.query?.userId || req.body?.userId;
    const username =
      req.user?.username || req.query?.username || req.body?.username;

    const user =
      userId && mongoose.isValidObjectId(userId)
        ? await User.findById(userId).lean()
        : username
          ? await User.findOne({ username }).lean()
          : null;

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "រកមិនឃើញគណនីអ្នកប្រើប្រាស់ទេ!" });
    }

    const fx = readFXRates() || { usdToKhrBuy: 4050, usdToKhrSell: 4100 };
    const khrRate = parseFloat(fx.usdToKhrSell) || 4100;

    // ប្រមូលលេខគណនីទាំងអស់របស់ User (Main + Sub)
    const myAccounts = [];
    if (user.mainAccounts?.USD?.accountNumber) {
      myAccounts.push(user.mainAccounts.USD.accountNumber);
    }
    if (user.mainAccounts?.KHR?.accountNumber) {
      myAccounts.push(user.mainAccounts.KHR.accountNumber);
    }
    if (Array.isArray(user.subAccounts)) {
      user.subAccounts.forEach((s) => {
        if (s.accountNumber) myAccounts.push(s.accountNumber);
      });
    }

    // 🌟 ស្វែងរក Transaction តាម userId _id ជាគោលដាច់ខាត
    const transactions = await Transaction.find({
      $or: [
        { userId: user._id },
        { username: user.username },
        { senderAcc: { $in: myAccounts } },
        { receiverAcc: { $in: myAccounts } },
      ],
      status: { $nin: ["Refunded", "Voided", "Rejected"] },
    })
      .sort({ _id: -1 })
      .limit(1500)
      .lean();

    // រៀបចំប្រតិបត្តិការឱ្យមាន Category ច្បាស់លាស់
    const normalizedTrxs = [];
    const seenIds = new Set();

    transactions.forEach((t) => {
      const idStr = String(t._id);
      if (seenIds.has(idStr)) return;
      seenIds.add(idStr);

      let isIncome = false;
      if (
        String(t.userId) === String(user._id) ||
        t.username === user.username
      ) {
        isIncome = Number(t.amount) > 0;
      } else if (
        myAccounts.includes(t.receiverAcc) &&
        !myAccounts.includes(t.senderAcc)
      ) {
        isIncome = true;
      } else if (
        myAccounts.includes(t.senderAcc) &&
        !myAccounts.includes(t.receiverAcc)
      ) {
        isIncome = false;
      } else {
        isIncome = Number(t.amount) > 0;
      }

      const rawAmt = Math.abs(Number(t.amount || 0));
      const cur = t.currency === "KHR" ? "KHR" : "USD";
      const amtUSD = cur === "KHR" ? rawAmt / khrRate : rawAmt;
      const amtKHR = cur === "USD" ? rawAmt * khrRate : rawAmt;

      const categoryKey = classifyTransactionCategory(t, isIncome);
      const accountUsed = isIncome
        ? t.receiverAcc || user.mainAccounts?.[cur]?.accountNumber || ""
        : t.senderAcc || user.mainAccounts?.[cur]?.accountNumber || "";

      normalizedTrxs.push({
        _id: t._id,
        refId: t.refId || "N/A",
        date: t.date || new Date(t.createdAt || Date.now()).toLocaleString(),
        timestamp: new Date(t.createdAt || t.date || Date.now()).getTime(),
        type: t.type || "Transaction",
        trxMethod: t.trxMethod || "U-PAY",
        isIncome,
        category: categoryKey,
        amount: rawAmt,
        currency: cur,
        amountUSD: Number(amtUSD.toFixed(2)),
        amountKHR: Math.round(amtKHR),
        counterparty: isIncome
          ? t.senderName || "System"
          : t.receiverName || "Merchant/User",
        accountUsed,
        remark: t.remark || "",
        status: t.status || "Success",
      });
    });

    const defaultBudget = {
      monthlyLimitUSD: 500,
      alertThresholdPct: 80,
      notifyOnAlert: true,
      categoryLimitsUSD: {
        food_shopping: 200,
        transfer_out: 150,
        card_spend: 100,
        bills: 50,
      },
    };

    const budgetConfig = {
      ...defaultBudget,
      ...(user.budgetSettings || {}),
      categoryLimitsUSD: {
        ...defaultBudget.categoryLimitsUSD,
        ...(user.budgetSettings?.categoryLimitsUSD || {}),
      },
    };

    res.json({
      success: true,
      fxRate: khrRate,
      accounts: {
        mainUSD: user.mainAccounts?.USD?.accountNumber || "",
        mainKHR: user.mainAccounts?.KHR?.accountNumber || "",
        subAccounts: (user.subAccounts || []).map((s) => ({
          accountNumber: s.accountNumber,
          accountName: s.accountName,
          currency: s.currency,
        })),
      },
      budgetConfig,
      transactions: normalizedTrxs,
    });
  } catch (error) {
    console.error("Get User Analytics Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * 📌 ២. រក្សាទុកការកំណត់ផែនការចំណាយប្រចាំខែ (Save Monthly & Category Budget)
 */
exports.saveUserBudgetSettings = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id || req.body?.userId;
    const username = req.user?.username || req.body?.username;
    const {
      monthlyLimitUSD,
      alertThresholdPct,
      notifyOnAlert,
      categoryLimitsUSD,
    } = req.body;

    const user =
      userId && mongoose.isValidObjectId(userId)
        ? await User.findById(userId)
        : username
          ? await User.findOne({ username })
          : null;

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "រកមិនឃើញគណនីអ្នកប្រើប្រាស់ទេ!" });
    }

    const updatedBudget = {
      monthlyLimitUSD: Math.max(1, parseFloat(monthlyLimitUSD) || 500),
      alertThresholdPct: Math.min(
        99,
        Math.max(50, parseInt(alertThresholdPct, 10) || 80),
      ),
      notifyOnAlert: notifyOnAlert !== false,
      categoryLimitsUSD: {
        food_shopping: parseFloat(categoryLimitsUSD?.food_shopping) || 0,
        transfer_out: parseFloat(categoryLimitsUSD?.transfer_out) || 0,
        card_spend: parseFloat(categoryLimitsUSD?.card_spend) || 0,
        bills: parseFloat(categoryLimitsUSD?.bills) || 0,
      },
      updatedAt: new Date().toISOString(),
    };

    user.set("budgetSettings", updatedBudget, { strict: false });
    user.markModified("budgetSettings");
    await user.save();

    res.json({
      success: true,
      message: "បានរក្សាទុកផែនការកំណត់ការចាយប្រចាំខែជោគជ័យ!",
      budgetConfig: updatedBudget,
    });
  } catch (error) {
    console.error("Save Budget Settings Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};
