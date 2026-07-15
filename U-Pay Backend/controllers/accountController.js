const User = require("../models/User");
const Transaction = require("../models/Transaction");
const {
  getFormattedDate,
  generateRefId,
  generateHash,
} = require("../services/helpers");

// រូបមន្តគណនាតម្លៃលេខ
function calculatePremiumPrice(numStr) {
  let price = 0;
  if (numStr.length < 8) price += 50;

  let maxRepeat = 1;
  let currentRepeat = 1;
  for (let i = 1; i < numStr.length; i++) {
    if (numStr[i] === numStr[i - 1]) {
      currentRepeat++;
      if (currentRepeat > maxRepeat) maxRepeat = currentRepeat;
    } else {
      currentRepeat = 1;
    }
  }

  if (maxRepeat === 3) price += 10;
  else if (maxRepeat === 4) price += 50;
  else if (maxRepeat >= 5) price += 200;

  if (numStr.includes("168")) price += 88;
  if (numStr.includes("888") && maxRepeat < 3) price += 30;
  if (numStr.includes("999") && maxRepeat < 3) price += 30;

  return price;
}

exports.createPremiumAccount = async (req, res) => {
  const { username, requestedNumber, accountName, price, pin } = req.body;

  try {
    const user = await User.findOne({ username });
    if (!user)
      return res.json({
        success: false,
        message: "រកគណនីអ្នកប្រើប្រាស់មិនឃើញទេ!",
      });

    // ១. ផ្ទៀងផ្ទាត់ PIN
    if (user.pin !== pin) {
      return res.json({
        success: false,
        message: "លេខសម្ងាត់ PIN មិនត្រឹមត្រូវទេ!",
      });
    }

    // ២. ឆែកមើលថាតើលេខគណនីនេះមានអ្នកយកហើយឬនៅ?
    // (ឆែកទាំងលេខកុង Main ទាំងលេខកុង Sub របស់ User ទាំងអស់)
    const existingMainAcc = await User.findOne({
      $or: [
        { accountNumber: requestedNumber },
        { accountNumberKHR: requestedNumber },
      ],
    });
    const existingSubAcc = await User.findOne({
      "subAccounts.accountNumber": requestedNumber,
    });

    if (existingMainAcc || existingSubAcc) {
      return res.json({
        success: false,
        message: "សូមអភ័យទោស លេខគណនីនេះមានអ្នកយកបាត់ហើយ!",
      });
    }

    // ៣. ផ្ទៀងផ្ទាត់តម្លៃឡើងវិញ (ការពារ Hacker)
    const actualPrice = calculatePremiumPrice(requestedNumber);
    if (price !== actualPrice) {
      return res.json({
        success: false,
        message: "ទិន្នន័យតម្លៃមិនត្រឹមត្រូវទេ!",
      });
    }

    // ៤. ឆែកលុយក្នុងកុង
    if (actualPrice > 0 && user.balance < actualPrice) {
      return res.json({
        success: false,
        message: "សមតុល្យទឹកប្រាក់របស់អ្នកមិនគ្រប់គ្រាន់ទេ!",
      });
    }

    // ៥. កាត់លុយ និង បូកលុយ
    if (actualPrice > 0) {
      const centralBank = await User.findOne({ accountNumber: "888888888" });
      if (!centralBank)
        return res.json({
          success: false,
          message: "ប្រព័ន្ធធនាគារកណ្តាលមានបញ្ហា!",
        });

      user.balance -= actualPrice;
      centralBank.balance += actualPrice;

      const dateNow = getFormattedDate();
      const refId = generateRefId();
      const hash = generateHash();

      // កត់ត្រាវិក្កយបត្រ (User)
      await Transaction.create({
        username: user.username,
        refId: refId,
        hash: hash,
        date: dateNow,
        type: "Premium Account Purchase",
        amount: -actualPrice,
        currency: "USD",
        senderName: user.fullName || user.username,
        receiverName: "U-Pay System",
        remark: `Bought Acc No: ${requestedNumber}`,
        status: "Success",
        trxMethod: "Main Account",
      });

      // កត់ត្រាវិក្កយបត្រ (Central Bank)
      await Transaction.create({
        username: centralBank.username,
        refId: refId,
        hash: hash,
        date: dateNow,
        type: "Premium Account Revenue",
        amount: actualPrice,
        currency: "USD",
        senderName: user.fullName || user.username,
        receiverName: "U-Pay System",
        remark: `Sold Acc No: ${requestedNumber}`,
        status: "Success",
        trxMethod: "System Receipt",
      });

      await centralBank.save();
    }

    // ៦. បង្កើតអនុគណនីថ្មី (Push ចូល Array របស់ User ផ្ទាល់តែម្តង)
    const newSubAccount = {
      accountId: Date.now().toString(),
      accountNumber: requestedNumber,
      accountName: accountName,
      accountType: "premium",
      balance: 0,
      currency: "USD",
      isLocked: false,
      createdAt: new Date(),
    };

    user.subAccounts.push(newSubAccount);
    await user.save(); // Save User ទើប Sub-Account ដើរ!

    // ៧. បោះទិន្នន័យ User ថ្មីទៅឱ្យ Frontend ដើម្បី Update Session ភ្លាមៗ
    res.json({
      success: true,
      message: "បង្កើតគណនីបានជោគជ័យ!",
      user: user, // បោះ User ចេញទៅវិញដើម្បី Frontend ងាយស្រួលប្រើ
    });
  } catch (error) {
    console.error("Create Premium Acc Error:", error);
    res.json({ success: false, message: "បរាជ័យក្នុងការបង្កើតគណនី!" });
  }
};

const generateRandomDigits = (length) => {
  return Math.floor(
    Math.pow(10, length - 1) + Math.random() * 9 * Math.pow(10, length - 1),
  ).toString();
};

// 🌟 API: ទាញយកលេខណែនាំពិសេសៗ (Suggested Numbers)
exports.getSuggestedNumbers = async (req, res) => {
  try {
    // ១. បង្កើតទម្រង់លេខស្អាតៗ (Patterns)
    let generatedNumbers = [
      "168" + generateRandomDigits(3), // លេខហុងស៊ុយ 168xxx
      "8888" + generateRandomDigits(4), // លេខ 8888xxxx
      "9999" + generateRandomDigits(4), // លេខ 9999xxxx
      generateRandomDigits(2).repeat(3), // លេខគូ ៣ដង (ឧ. 454545)
      generateRandomDigits(1).repeat(6), // លេខដូចគ្នា ៦ខ្ទង់ (ឧ. 777777)
      "168168", // លេខពិសេសខ្លាំង
    ];

    // ២. ឆែកក្នុង Database ថាតើលេខទាំងនេះមានអ្នកយកហើយឬនៅ?
    // ឆែកទាំងក្នុងគណនី Main និង Sub-Accounts របស់ User ទាំងអស់
    const existingUsers = await User.find({
      $or: [
        { accountNumber: { $in: generatedNumbers } },
        { accountNumberKHR: { $in: generatedNumbers } },
        { "subAccounts.accountNumber": { $in: generatedNumbers } },
      ],
    });

    // ប្រមូលលេខដែលត្រូវគេយកបាត់ហើយដាក់ចូល Array មួយ
    const takenNumbers = [];
    existingUsers.forEach((user) => {
      if (generatedNumbers.includes(user.accountNumber))
        takenNumbers.push(user.accountNumber);
      if (generatedNumbers.includes(user.accountNumberKHR))
        takenNumbers.push(user.accountNumberKHR);
      user.subAccounts.forEach((sub) => {
        if (generatedNumbers.includes(sub.accountNumber))
          takenNumbers.push(sub.accountNumber);
      });
    });

    // ៣. ចម្រាញ់យកតែលេខណាដែល "ទំនេរ"
    const availableNumbers = generatedNumbers.filter(
      (num) => !takenNumbers.includes(num),
    );

    // ៤. គណនាតម្លៃសម្រាប់លេខទំនេរនីមួយៗ ហើយរៀបចំទិន្នន័យបញ្ជូនទៅ Frontend
    const suggestedList = availableNumbers.slice(0, 4).map((num) => {
      // យកតែ ៤ លេខបានហើយ
      return {
        number: num,
        price: calculatePremiumPrice(num), // ហៅរូបមន្តគណនាតម្លៃដែលយើងបានសរសេរ
      };
    });

    // ៥. បោះទិន្នន័យទៅឱ្យ Frontend
    res.json({
      success: true,
      data: suggestedList,
    });
  } catch (error) {
    console.error("Get Suggested Numbers Error:", error);
    res.json({ success: false, message: "មិនអាចទាញយកលេខណែនាំបានទេ!" });
  }
};
