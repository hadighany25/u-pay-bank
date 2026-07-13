const User = require("../models/User");
const {
  getFormattedDate,
  generateRefId,
  generateHash,
} = require("../services/helpers");

// ១. គណនីបញ្ញើ (Fixed Deposit)
const createFixedDeposit = async (req, res) => {
  const { accountNumber, amount, pin, duration, rate, type, currency } =
    req.body;
  const depAmount = parseFloat(amount);
  try {
    const user = await User.findOne({
      $or: [
        { accountNumber: accountNumber },
        { accountNumberKHR: accountNumber },
      ],
    });
    if (!user || user.pin !== pin)
      return res.json({ success: false, message: "លេខ PIN មិនត្រឹមត្រូវទេ" });

    const isKHR = currency === "KHR";
    if (isKHR && (user.balanceKHR || 0) < depAmount)
      return res.json({
        success: false,
        message: "សមតុល្យប្រាក់រៀលមិនគ្រប់គ្រាន់ទេ",
      });
    if (!isKHR && (user.balance || 0) < depAmount)
      return res.json({
        success: false,
        message: "សមតុល្យប្រាក់ដុល្លារមិនគ្រប់គ្រាន់ទេ",
      });

    const centralBank = await User.findOne({ accountNumber: "888888888" });
    if (!centralBank)
      return res.json({
        success: false,
        message: "Central Bank Account Not Found",
      });

    if (!user.transactions) user.transactions = [];
    if (!centralBank.transactions) centralBank.transactions = [];
    if (!user.deposits) user.deposits = [];

    if (isKHR) {
      user.balanceKHR -= depAmount;
      centralBank.balanceKHR = (centralBank.balanceKHR || 0) + depAmount;
    } else {
      user.balance -= depAmount;
      centralBank.balance = (centralBank.balance || 0) + depAmount;
    }

    const dateStr = getFormattedDate();
    const refId = "DEP-" + Date.now();
    const hash = generateHash();
    const senderAcc = isKHR ? user.accountNumberKHR : user.accountNumber;
    const bankAcc = isKHR
      ? centralBank.accountNumberKHR
      : centralBank.accountNumber;

    user.transactions.unshift({
      refId,
      hash,
      date: dateStr,
      type: `Fixed Deposit - ${type}`,
      amount: -depAmount,
      currency: isKHR ? "KHR" : "USD",
      senderName: user.fullName || user.username,
      senderAccount: senderAcc,
      receiverName: "U-Pay Central Bank",
      receiverAccount: bankAcc,
      status: "Success",
      trxMethod: "Fixed Deposit",
      isHold: false,
    });

    centralBank.transactions.unshift({
      refId,
      hash,
      date: dateStr,
      type: `Received Deposit - ${type}`,
      amount: depAmount,
      currency: isKHR ? "KHR" : "USD",
      senderName: user.fullName || user.username,
      senderAccount: senderAcc,
      receiverName: "U-Pay Central Bank",
      receiverAccount: bankAcc,
      status: "Success",
      trxMethod: "Fixed Deposit",
      isHold: false,
    });

    user.deposits.push({
      id: "DEP" + Date.now(),
      amount: depAmount,
      currency: isKHR ? "KHR" : "USD",
      rate,
      type,
      durationMonths: duration,
      startDate: dateStr,
      maturityDate: new Date(
        new Date().setMonth(new Date().getMonth() + parseInt(duration)),
      ).toISOString(),
      status: "active",
    });

    user.markModified("transactions");
    user.markModified("deposits");
    centralBank.markModified("transactions");
    await user.save();
    await centralBank.save();
    res.json({
      success: true,
      newBalance: isKHR ? user.balanceKHR : user.balance,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const withdrawFixedDeposit = async (req, res) => {
  const { accountNumber, depositId } = req.body;
  try {
    const user = await User.findOne({
      $or: [
        { accountNumber: accountNumber },
        { accountNumberKHR: accountNumber },
      ],
    });
    const centralBank = await User.findOne({ accountNumber: "888888888" });
    if (!user || !centralBank || !user.deposits)
      return res.json({
        success: false,
        message: "រកមិនឃើញគណនី ឬប្រាក់បញ្ញើទេ",
      });

    const depIndex = user.deposits.findIndex(
      (d) => d.id === depositId && d.status === "active",
    );
    if (depIndex === -1)
      return res.json({
        success: false,
        message: "ប្រាក់បញ្ញើនេះត្រូវបានដក ឬអសកម្ម",
      });

    const deposit = user.deposits[depIndex];
    const withdrawAmount = deposit.amount;
    const isKHR = deposit.currency === "KHR";
    user.deposits[depIndex].status = "closed";

    if (isKHR) {
      user.balanceKHR = (user.balanceKHR || 0) + withdrawAmount;
      centralBank.balanceKHR = (centralBank.balanceKHR || 0) - withdrawAmount;
    } else {
      user.balance = (user.balance || 0) + withdrawAmount;
      centralBank.balance = (centralBank.balance || 0) - withdrawAmount;
    }

    const dateStr = getFormattedDate();
    const refId = "WD-" + Date.now();
    const hash = generateHash();

    user.transactions.unshift({
      refId,
      hash,
      date: dateStr,
      type: "Withdraw Deposit",
      amount: withdrawAmount,
      currency: isKHR ? "KHR" : "USD",
      senderName: "U-Pay Central Bank",
      receiverName: user.fullName || user.username,
      status: "Success",
      trxMethod: "Fixed Deposit",
    });
    centralBank.transactions.unshift({
      refId,
      hash,
      date: dateStr,
      type: "Deposit Refund",
      amount: -withdrawAmount,
      currency: isKHR ? "KHR" : "USD",
      senderName: "U-Pay Central Bank",
      receiverName: user.fullName || user.username,
      status: "Success",
      trxMethod: "Fixed Deposit",
    });

    user.markModified("transactions");
    user.markModified("deposits");
    centralBank.markModified("transactions");
    await user.save();
    await centralBank.save();
    res.json({
      success: true,
      newBalance: isKHR ? user.balanceKHR : user.balance,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ២. រង្វាន់ Cashbacks
const cashbackReward = async (req, res) => {
  const { username, amount, refId } = req.body;
  try {
    const user = await User.findOne({ username });
    if (user) {
      const reward = parseFloat(amount);
      if (reward > 0) {
        user.balance += reward;
        if (!user.transactions) user.transactions = [];
        user.transactions.unshift({
          refId: "RWD-" + Date.now().toString().slice(-6),
          hash: generateHash(),
          date: getFormattedDate(),
          type: "Cashback Reward",
          amount: reward,
          fee: 0,
          senderName: "U-Pay Lucky Spin",
          receiverName: user.username,
          remark: `Reward for Trx: ${refId}`,
          status: "Success",
          device: "App",
          ip: "127.0.0.1",
        });
        user.markModified("transactions");
        await user.save();
      }
      res.json({ success: true, balance: user.balance });
    } else res.json({ success: false });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = {
  createFixedDeposit,
  withdrawFixedDeposit,
  cashbackReward,
};
