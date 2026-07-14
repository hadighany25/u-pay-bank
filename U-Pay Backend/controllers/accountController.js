const User = require("../models/User");
const Account = require("../models/Account"); // បងត្រូវបង្កើត Schema Account មួយ
const Transaction = require("../models/Transaction");
const {
  getFormattedDate,
  generateRefId,
  generateHash,
} = require("../services/helpers");

exports.createPremiumAccount = async (req, res) => {
  const { username, requestedNumber, accountName, price, pin } = req.body;

  try {
    const user = await User.findOne({ username });
    if (!user)
      return res.json({
        success: false,
        message: "រកមិនឃើញគណនីអ្នកប្រើប្រាស់!",
      });

    // ១. ផ្ទៀងផ្ទាត់ PIN (ສົมมุติว่าបងមាន Function ឆែក PIN ស្រាប់)
    if (user.pin !== pin) {
      return res.json({
        success: false,
        message: "លេខសម្ងាត់ PIN មិនត្រឹមត្រូវទេ!",
      });
    }

    // ២. ឆែកមើលថាតើលេខគណនីនេះ មានអ្នកយកហើយឬនៅ?
    const existingAcc = await Account.findOne({
      accountNumber: requestedNumber,
    });
    if (existingAcc) {
      return res.json({
        success: false,
        message: "សូមអភ័យទោស លេខនេះទើបតែមានអ្នកទិញមុននេះបន្តិច!",
      });
    }

    // ៣. ឆែកលុយក្នុងកុង (បើតម្លៃ > 0)
    if (price > 0 && user.balance < price) {
      return res.json({
        success: false,
        message: "សមតុល្យទឹកប្រាក់របស់អ្នកមិនគ្រប់គ្រាន់ទេ!",
      });
    }

    // ៤. ដំណើរការកាត់លុយ និងបូកចូល U-Pay (888888888)
    if (price > 0) {
      const centralBank = await User.findOne({ accountNumber: "888888888" });
      if (!centralBank)
        return res.json({ success: false, message: "ប្រព័ន្ធមានបញ្ហា!" });

      user.balance -= price;
      centralBank.balance += price;

      const dateNow = getFormattedDate();
      const refId = generateRefId();
      const hash = generateHash();

      // កត់ត្រាវិក្កយបត្រកាត់លុយ (User)
      await Transaction.create({
        username: user.username,
        refId: refId,
        hash: hash,
        date: dateNow,
        type: "Purchase Premium Account",
        amount: -price,
        currency: "USD",
        senderName: user.fullName,
        receiverName: "U-Pay Central Bank",
        remark: `Bought Acc No: ${requestedNumber}`,
        status: "Success",
      });

      // កត់ត្រាវិក្កយបត្រទទួលលុយ (U-Pay Central Bank)
      await Transaction.create({
        username: centralBank.username,
        refId: refId,
        hash: hash,
        date: dateNow,
        type: "Premium Account Revenue",
        amount: price,
        currency: "USD",
        senderName: user.fullName,
        receiverName: "U-Pay Central Bank",
        remark: `Sold Acc No: ${requestedNumber}`,
        status: "Success",
      });

      await centralBank.save();
    }

    // ៥. បង្កើតគណនីថ្មី
    const newAccount = new Account({
      ownerUsername: user.username,
      accountNumber: requestedNumber,
      accountName: accountName,
      accountType: "premium",
      balance: 0,
      currency: "USD",
      isLocked: false,
    });

    await newAccount.save();
    await user.save();

    res.json({ success: true, message: "បង្កើតគណនីបានជោគជ័យ!", newAccount });
  } catch (error) {
    console.error("Create Premium Acc Error:", error);
    res.json({ success: false, message: "បរាជ័យក្នុងការបង្កើតគណនី!" });
  }
};
