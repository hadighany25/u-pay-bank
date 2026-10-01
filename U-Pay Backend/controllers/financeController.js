// financeController.js
const User = require("../models/User");
const Transaction = require("../models/Transaction");
const System = require("../models/System");
const { getFormattedDate } = require("../services/helpers");

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

// ==========================================
// ១. គណនីបញ្ញើ (Fixed Deposit - CREATE)
// ==========================================
const createFixedDeposit = async (req, res) => {
  const {
    accountNumber,
    sourceAccount,
    amount,
    currency,
    pin,
    duration,
    rate,
    type,
  } = req.body;
  const depAmount = parseFloat(amount) || 0;
  const safeDuration = parseInt(duration) || 12;
  const safeRate = parseFloat(rate) || 0;

  try {
    const user = await User.findOne({ username: req.user.username });
    if (!user || user.pin !== pin)
      return res.json({ success: false, message: "លេខ PIN មិនត្រឹមត្រូវទេ" });
    if (user.isFrozen)
      return res.json({ success: false, message: "គណនីត្រូវបានបង្កក" });

    let fxRates = { usdToKhrBuy: 4050, usdToKhrSell: 4100 };
    try {
      const sysInfo = await System.findOne({ settingId: "GLOBAL_SETTINGS" });
      if (sysInfo && sysInfo.fxRates) fxRates = sysInfo.fxRates;
    } catch (e) {
      console.log("FX Rate fallback applied");
    }

    let sourceCurrency = "USD";
    let finalDeducted = depAmount;

    const mainUsdNum =
      user.mainAccounts?.USD?.accountNumber || user.accountNumber;
    const mainKhrNum =
      user.mainAccounts?.KHR?.accountNumber || user.accountNumberKHR;

    if (sourceAccount === "MAIN_KHR" || sourceAccount === mainKhrNum) {
      sourceCurrency = "KHR";
    } else if (sourceAccount !== "MAIN_USD" && sourceAccount !== mainUsdNum) {
      const sub = user.subAccounts.find(
        (a) => a.accountNumber === sourceAccount,
      );
      if (sub) sourceCurrency = sub.currency;
    }

    if (sourceCurrency !== currency) {
      if (sourceCurrency === "USD" && currency === "KHR") {
        finalDeducted = depAmount / fxRates.usdToKhrSell;
      } else if (sourceCurrency === "KHR" && currency === "USD") {
        finalDeducted = depAmount * fxRates.usdToKhrBuy;
      }
    }

    let sourceAvailableBal = 0;
    if (sourceAccount === "MAIN_KHR" || sourceAccount === mainKhrNum) {
      sourceAvailableBal =
        parseFloat(user.mainAccounts?.KHR?.balance ?? user.balanceKHR) || 0;
    } else if (sourceAccount === "MAIN_USD" || sourceAccount === mainUsdNum) {
      sourceAvailableBal =
        parseFloat(user.mainAccounts?.USD?.balance ?? user.balance) || 0;
    } else {
      const sub = user.subAccounts.find(
        (a) => a.accountNumber === sourceAccount,
      );
      sourceAvailableBal = sub ? parseFloat(sub.balance) : 0;
    }

    if (sourceAvailableBal < finalDeducted) {
      return res.json({
        success: false,
        message: `សមតុល្យប្រភពមិនគ្រប់គ្រាន់! (អ្នកមាន ${sourceAvailableBal.toLocaleString()} តែត្រូវការ ${finalDeducted.toLocaleString()} ${sourceCurrency})`,
      });
    }

    // 🌟 កំណត់លេខកុង Sub-Account តាម Currency (USD: 888000777, KHR: 888000666)
    const targetSubAccNum = currency === "KHR" ? "888000666" : "888000777";

    let centralBank = await User.findOne({
      "subAccounts.accountNumber": targetSubAccNum,
    });

    if (!centralBank) {
      centralBank = await User.findOne({});
      if (!centralBank) {
        return res.json({
          success: false,
          message: "រកមិនឃើញគណនីធនាគារកណ្តាលក្នុងប្រព័ន្ធទេ!",
        });
      }
    }

    let depositSubAcc = centralBank.subAccounts?.find(
      (sub) => sub.accountNumber === targetSubAccNum,
    );

    if (!depositSubAcc) {
      centralBank.subAccounts = centralBank.subAccounts || [];
      centralBank.subAccounts.push({
        accountId: "SUB_DEP_" + currency + "_" + Date.now(),
        accountNumber: targetSubAccNum,
        accountName: `Central Bank Fixed Deposits ${currency}`,
        accountType: "deposit_pool",
        currency: currency,
        balance: 0.0,
      });
      centralBank.markModified("subAccounts");
      depositSubAcc =
        centralBank.subAccounts[centralBank.subAccounts.length - 1];
    }

    // 💸 កាត់លុយចេញពីគណនីប្រភពរបស់ User
    if (sourceAccount === "MAIN_KHR" || sourceAccount === mainKhrNum) {
      if (user.mainAccounts?.KHR)
        user.mainAccounts.KHR.balance =
          (parseFloat(user.mainAccounts.KHR.balance) || 0) - finalDeducted;
      else user.balanceKHR = (parseFloat(user.balanceKHR) || 0) - finalDeducted;
    } else if (sourceAccount === "MAIN_USD" || sourceAccount === mainUsdNum) {
      if (user.mainAccounts?.USD)
        user.mainAccounts.USD.balance =
          (parseFloat(user.mainAccounts.USD.balance) || 0) - finalDeducted;
      else user.balance = (parseFloat(user.balance) || 0) - finalDeducted;
    } else {
      const subIdx = user.subAccounts.findIndex(
        (a) => a.accountNumber === sourceAccount,
      );
      if (subIdx !== -1) {
        user.subAccounts[subIdx].balance =
          (parseFloat(user.subAccounts[subIdx].balance) || 0) - finalDeducted;
        user.markModified("subAccounts");
      }
    }

    // 🏦 បូកលុយចូល Sub-Account តាម Currency ត្រូវគ្នា
    depositSubAcc.balance =
      (parseFloat(depositSubAcc.balance) || 0) + finalDeducted;
    centralBank.markModified("subAccounts");

    if (!user.deposits) user.deposits = [];

    const dateStr = getFormattedDate();
    const hash = generateStandardHash();
    const refId = generateStandardRefId("DEP");

    const senderAcc =
      sourceAccount.startsWith("MAIN_") ||
      sourceAccount === mainUsdNum ||
      sourceAccount === mainKhrNum
        ? sourceAccount === "MAIN_KHR" || sourceAccount === mainKhrNum
          ? mainKhrNum
          : mainUsdNum
        : sourceAccount;

    await Transaction.create([
      {
        userId: user._id,
        username: user.username,
        refId,
        hash,
        date: dateStr,
        type: `Fixed Deposit - ${type}`,
        amount: -finalDeducted,
        currency: sourceCurrency,
        fee: 0,
        senderName: user.fullName || user.username,
        receiverName: `Central Bank Fixed Deposits ${currency}`,
        senderAcc: senderAcc,
        receiverAcc: targetSubAccNum,
        status: "Success",
        trxMethod: "Fixed Deposit",
      },
      {
        userId: centralBank._id,
        username: centralBank.username,
        refId,
        hash,
        date: dateStr,
        type: `Received Deposit - ${type}`,
        amount: finalDeducted,
        currency: sourceCurrency,
        fee: 0,
        senderName: user.fullName || user.username,
        receiverName: `Central Bank Fixed Deposits ${currency}`,
        senderAcc: senderAcc,
        receiverAcc: targetSubAccNum,
        status: "Success",
        trxMethod: "Fixed Deposit",
      },
    ]);

    const maturityDate = new Date();
    maturityDate.setMonth(maturityDate.getMonth() + safeDuration);

    user.deposits.push({
      id: refId,
      amount: depAmount,
      currency: currency,
      deductedAmount: finalDeducted,
      sourceCurrency: sourceCurrency,
      rate: safeRate,
      type,
      durationMonths: safeDuration,
      startDate: dateStr,
      maturityDate: maturityDate.toISOString(),
      status: "active",
      sourceAcc: sourceAccount,
    });

    user.markModified("deposits");
    await user.save();
    await centralBank.save();

    return res.json({
      success: true,
      message: "បង្កើតប្រាក់បញ្ញើមានកាលកំណត់ជោគជ័យ!",
    });
  } catch (err) {
    console.error("Create FD Error:", err);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

// ==========================================
// ២. ដកប្រាក់បញ្ញើវិញ (Fixed Deposit - WITHDRAW)
// ==========================================
const withdrawFixedDeposit = async (req, res) => {
  const { depositId } = req.body;

  try {
    const user = await User.findOne({ username: req.user.username });
    if (!user || !user.deposits)
      return res.json({
        success: false,
        message: "រកមិនឃើញគណនី ឬប្រាក់បញ្ញើទេ",
      });

    const depIndex = user.deposits.findIndex((d) => d.id === depositId);
    if (depIndex === -1)
      return res.json({
        success: false,
        message: "រកមិនឃើញប្រាក់បញ្ញើនេះក្នុងប្រព័ន្ធទេ",
      });

    const deposit = user.deposits[depIndex];
    if (deposit.status !== "active")
      return res.json({
        success: false,
        message: "ប្រាក់បញ្ញើនេះត្រូវបានដក ឬបិទរួចរាល់ហើយ!",
      });

    const refundAmount =
      parseFloat(deposit.deductedAmount || deposit.amount) || 0;
    const refundCurrency = deposit.sourceCurrency || deposit.currency || "USD";
    const refundAccount = deposit.sourceAcc || "MAIN_USD";

    // 🌟 កំណត់កុង Sub-Account តាម Currency ពេលដកវិញ
    const targetSubAccNum =
      refundCurrency === "KHR" ? "888000666" : "888000777";

    const centralBank = await User.findOne({
      "subAccounts.accountNumber": targetSubAccNum,
    });
    if (!centralBank) {
      return res.json({
        success: false,
        message: "រកមិនឃើញគណនីធនាគារកណ្តាលក្នុងប្រព័ន្ធទេ!",
      });
    }

    let depositSubAcc = centralBank.subAccounts?.find(
      (sub) => sub.accountNumber === targetSubAccNum,
    );
    if (!depositSubAcc) {
      return res.json({
        success: false,
        message: "រកមិនឃើញ Sub-Account ប្រាក់បញ្ញើរបស់ធនាគារកណ្តាលទេ!",
      });
    }

    user.deposits[depIndex].status = "withdrawn";

    depositSubAcc.balance =
      (parseFloat(depositSubAcc.balance) || 0) - refundAmount;
    centralBank.markModified("subAccounts");

    const mainUsdNum =
      user.mainAccounts?.USD?.accountNumber || user.accountNumber;
    const mainKhrNum =
      user.mainAccounts?.KHR?.accountNumber || user.accountNumberKHR;

    if (refundAccount === "MAIN_KHR" || refundAccount === mainKhrNum) {
      if (user.mainAccounts?.KHR)
        user.mainAccounts.KHR.balance =
          (parseFloat(user.mainAccounts.KHR.balance) || 0) + refundAmount;
      else user.balanceKHR = (parseFloat(user.balanceKHR) || 0) + refundAmount;
    } else if (refundAccount === "MAIN_USD" || refundAccount === mainUsdNum) {
      if (user.mainAccounts?.USD)
        user.mainAccounts.USD.balance =
          (parseFloat(user.mainAccounts.USD.balance) || 0) + refundAmount;
      else user.balance = (parseFloat(user.balance) || 0) + refundAmount;
    } else {
      const subIdx = user.subAccounts.findIndex(
        (a) => a.accountNumber === refundAccount,
      );
      if (subIdx !== -1) {
        user.subAccounts[subIdx].balance =
          (parseFloat(user.subAccounts[subIdx].balance) || 0) + refundAmount;
        user.markModified("subAccounts");
      } else {
        if (refundCurrency === "KHR") {
          if (user.mainAccounts?.KHR)
            user.mainAccounts.KHR.balance =
              (parseFloat(user.mainAccounts.KHR.balance) || 0) + refundAmount;
          else
            user.balanceKHR = (parseFloat(user.balanceKHR) || 0) + refundAmount;
        } else {
          if (user.mainAccounts?.USD)
            user.mainAccounts.USD.balance =
              (parseFloat(user.mainAccounts.USD.balance) || 0) + refundAmount;
          else user.balance = (parseFloat(user.balance) || 0) + refundAmount;
        }
      }
    }

    user.markModified("deposits");
    await user.save();
    await centralBank.save();

    const dateStr = getFormattedDate();
    const hash = generateStandardHash();
    const refId = generateStandardRefId("WD");

    const receiverAccForTrx =
      refundAccount.startsWith("MAIN_") ||
      refundAccount === mainUsdNum ||
      refundAccount === mainKhrNum
        ? refundAccount === "MAIN_KHR" || refundAccount === mainKhrNum
          ? mainKhrNum
          : mainUsdNum
        : refundAccount;

    await Transaction.create([
      {
        userId: user._id,
        username: user.username,
        refId,
        hash,
        date: dateStr,
        type: "Withdraw Deposit",
        amount: refundAmount,
        currency: refundCurrency,
        fee: 0,
        senderName: `Central Bank Fixed Deposits ${refundCurrency}`,
        receiverName: user.fullName || user.username,
        senderAcc: targetSubAccNum,
        receiverAcc: receiverAccForTrx,
        status: "Success",
        trxMethod: "Fixed Deposit",
      },
      {
        userId: centralBank._id,
        username: centralBank.username,
        refId,
        hash,
        date: dateStr,
        type: "Deposit Refund",
        amount: -refundAmount,
        currency: refundCurrency,
        fee: 0,
        senderName: `Central Bank Fixed Deposits ${refundCurrency}`,
        receiverName: user.fullName || user.username,
        senderAcc: targetSubAccNum,
        receiverAcc: receiverAccForTrx,
        status: "Success",
        trxMethod: "Fixed Deposit",
      },
    ]);

    return res.json({
      success: true,
      message: "ប្រាក់ត្រូវបានបង្វិលចូលគណនីវិញជោគជ័យ!",
    });
  } catch (err) {
    console.error("Withdraw FD Error:", err);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

// ==========================================
// ៣. រង្វាន់ Cashbacks
// ==========================================
const cashbackReward = async (req, res) => {
  const { username, amount, refId } = req.body;
  try {
    const user = await User.findOne({ username });
    if (user) {
      const reward = parseFloat(amount);
      if (reward > 0) {
        if (user.mainAccounts?.USD) {
          user.mainAccounts.USD.balance =
            (parseFloat(user.mainAccounts.USD.balance) || 0) + reward;
        } else {
          user.balance = (parseFloat(user.balance) || 0) + reward;
        }

        await Transaction.create({
          userId: user._id,
          username: user.username,
          refId: generateStandardRefId("RWD"),
          hash: generateStandardHash(),
          date: getFormattedDate(),
          type: "Cashback Reward",
          amount: reward,
          currency: "USD",
          fee: 0,
          senderName: "U-Pay Lucky Spin",
          receiverName: user.username,
          receiverAcc:
            user.mainAccounts?.USD?.accountNumber || user.accountNumber,
          remark: `Reward for Trx: ${refId}`,
          status: "Success",
          device: "App",
          ip: "127.0.0.1",
        });
        await user.save();
      }
      return res.json({
        success: true,
        balance: user.mainAccounts?.USD?.balance || user.balance,
      });
    } else {
      return res.json({ success: false, message: "រកមិនឃើញគណនី" });
    }
  } catch (err) {
    console.error("Cashback Error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = {
  createFixedDeposit,
  withdrawFixedDeposit,
  cashbackReward,
};
