const User = require("../models/User");
const Transaction = require("../models/Transaction");
const {
  getFormattedDate,
  generateRefId,
  generateHash,
} = require("../services/helpers");

// ==========================================
// ១. រូបមន្តគណនាតម្លៃលេខ (ត្រូវឱ្យដូច Frontend ១០០%)
// ==========================================
function calculatePremiumPrice(numStr) {
  if (numStr.length === 6) return 100; // លេខ 6 ខ្ទង់ ចាប់ពី 100$ ឡើង
  if (numStr.length !== 9) return 0; // បើមិនមែន 6 ឬ 9 ខ្ទង់ទេ តម្លៃ 0 (ឬ Error)

  // លក្ខខណ្ឌសម្រាប់លេខ 9 ខ្ទង់
  if (numStr.includes("88888") || numStr.includes("99999")) return 250;
  if (
    numStr.includes("8888") ||
    numStr.includes("9999") ||
    numStr.includes("168168")
  )
    return 100;
  if (
    numStr.includes("888") ||
    numStr.includes("999") ||
    numStr.includes("168")
  )
    return 50;

  // ឆែកលេខស្ទួន ៤ ខ្ទង់ (ឧ. 4444)
  if (/(.)\1{3}/.test(numStr)) return 20;
  // ឆែកលេខស្ទួន ៣ ខ្ទង់ (ឧ. 777)
  if (/(.)\1{2}/.test(numStr)) return 15;

  // លេខគូស្អាតចុងកន្ទុយ
  if (numStr.endsWith("00") || numStr.endsWith("88") || numStr.endsWith("99"))
    return 10;

  return 5; // លេខធម្មតា គឺ 5$
}

// ==========================================
// ២. API បង្កើតគណនី
// ==========================================
exports.createPremiumAccount = async (req, res) => {
  const { username, requestedNumber, accountName, price, pin, currencyOption } =
    req.body;

  try {
    const user = await User.findOne({ username });
    if (!user)
      return res.json({
        success: false,
        message: "រកគណនីអ្នកប្រើប្រាស់មិនឃើញទេ!",
      });

    if (user.pin !== pin) {
      return res.json({
        success: false,
        message: "លេខសម្ងាត់ PIN មិនត្រឹមត្រូវទេ!",
      });
    }

    // ឆែកមើលថាតើលេខគណនីទី១ មានអ្នកយកហើយឬនៅ?
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

    // Logic សម្រាប់បង្កើតលេខទី២ បើជ្រើសរើស BOTH
    let secondNumber = null;
    if (currencyOption === "BOTH") {
      let lastDigit = parseInt(requestedNumber.slice(-1));
      let baseNum = requestedNumber.slice(0, -1);

      // បើលេខចុងក្រោយតូចជាង 9 យើងបូក 1, បើស្មើ 9 យើងដក 1 វិញ
      let newLastDigit = lastDigit < 9 ? lastDigit + 1 : lastDigit - 1;
      secondNumber = baseNum + newLastDigit;

      // ឆែកមើលថាតើលេខគណនីទី២ ទំនេរឬអត់?
      const checkSecondAcc = await User.findOne({
        $or: [
          { accountNumber: secondNumber },
          { accountNumberKHR: secondNumber },
          { "subAccounts.accountNumber": secondNumber },
        ],
      });

      if (checkSecondAcc) {
        return res.json({
          success: false,
          message: `ប្រព័ន្ធមិនអាចបង្កើតគណនីទី២ (${secondNumber}) បានទេ ដោយសារវាត្រូវបានប្រើប្រាស់ហើយ។ សូមជ្រើសរើសតែមួយគណនីសិន។`,
        });
      }
    }

    // ផ្ទៀងផ្ទាត់តម្លៃឡើងវិញការពារ Hacker កែពី Frontend
    const actualPrice = calculatePremiumPrice(requestedNumber);
    if (price !== actualPrice) {
      return res.json({
        success: false,
        message: "ទិន្នន័យតម្លៃមិនត្រឹមត្រូវទេ! (Price mismatch)",
      });
    }

    // ឆែកលុយក្នុងកុង
    if (actualPrice > 0 && user.balance < actualPrice) {
      return res.json({
        success: false,
        message: "សមតុល្យទឹកប្រាក់របស់អ្នកមិនគ្រប់គ្រាន់ទេ!",
      });
    }

    // ដំណើរការកាត់លុយ
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

    // បង្កើតអនុគណនីទៅតាមរូបិយប័ណ្ណដែលបានជ្រើសរើស
    if (currencyOption === "USD" || currencyOption === "BOTH") {
      user.subAccounts.push({
        accountId: Date.now().toString() + "_1",
        accountNumber: requestedNumber,
        accountName: accountName,
        accountType: "premium",
        balance: 0,
        currency: "USD",
        isLocked: false,
        createdAt: new Date(),
      });
    }

    if (currencyOption === "KHR") {
      user.subAccounts.push({
        accountId: Date.now().toString() + "_1",
        accountNumber: requestedNumber,
        accountName: accountName,
        accountType: "premium",
        balance: 0,
        currency: "KHR",
        isLocked: false,
        createdAt: new Date(),
      });
    }

    if (currencyOption === "BOTH" && secondNumber) {
      user.subAccounts.push({
        accountId: Date.now().toString() + "_2",
        accountNumber: secondNumber,
        accountName: accountName + " (KHR)",
        accountType: "premium",
        balance: 0,
        currency: "KHR",
        isLocked: false,
        createdAt: new Date(),
      });
    }

    await user.save();

    res.json({
      success: true,
      message: "បង្កើតគណនីបានជោគជ័យ!",
      user: user,
      secondNumber: secondNumber, // បោះលេខទី២ ទៅអោយ Frontend បង្ហាញលើវិក្កយបត្រ
    });
  } catch (error) {
    console.error("Create Premium Acc Error:", error);
    res.json({ success: false, message: "បរាជ័យក្នុងការបង្កើតគណនី!" });
  }
};

// ==========================================
// ៣. API ទាញយកលេខណែនាំពិសេសៗ (១២ លេខ)
// ==========================================
exports.getSuggestedNumbers = async (req, res) => {
  try {
    let generatedNumbers = [];
    const specialSuffixes = [
      "168",
      "888",
      "999",
      "000",
      "777",
      "168168",
      "8888",
      "99999",
    ];

    // Generate លេខ ៩ ខ្ទង់ចំនួន ១៥ ជម្រើស (ទុកពេលខ្លះវាជាន់គ្នា)
    for (let i = 0; i < 15; i++) {
      let prefix = Math.floor(100 + Math.random() * 899).toString();
      let suffix =
        specialSuffixes[Math.floor(Math.random() * specialSuffixes.length)];
      let middle = Math.floor(100 + Math.random() * 899).toString();

      let num = prefix + middle + suffix;
      if (num.length > 9) num = num.substring(0, 9);
      if (num.length < 9) num = num.padEnd(9, "0"); // បំពេញឱ្យគ្រប់ ៩ខ្ទង់
      generatedNumbers.push(num);
    }

    // បន្ថែមលេខ ៦ ខ្ទង់ពិសេសៗខ្លះ
    generatedNumbers.push(
      Math.floor(100000 + Math.random() * 899999).toString(),
    );
    generatedNumbers.push(
      "168" + Math.floor(100 + Math.random() * 899).toString(),
    );

    // ដកលេខដែលជាន់គ្នា (Duplicates) នៅក្នុង Array
    generatedNumbers = [...new Set(generatedNumbers)];

    // ឆែកក្នុង Database ថាតើលេខទាំងនេះមានអ្នកយកហើយឬនៅ?
    const existingUsers = await User.find({
      $or: [
        { accountNumber: { $in: generatedNumbers } },
        { accountNumberKHR: { $in: generatedNumbers } },
        { "subAccounts.accountNumber": { $in: generatedNumbers } },
      ],
    });

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

    // ចម្រាញ់យកតែលេខណាដែល "ទំនេរ"
    const availableNumbers = generatedNumbers.filter(
      (num) => !takenNumbers.includes(num),
    );

    // រៀបចំទិន្នន័យត្រឹម ១២ លេខ ដើម្បីបញ្ជូនទៅ Frontend
    const suggestedList = availableNumbers.slice(0, 12).map((num) => {
      return {
        number: num,
        price: calculatePremiumPrice(num),
      };
    });

    res.json({
      success: true,
      data: suggestedList,
    });
  } catch (error) {
    console.error("Get Suggested Numbers Error:", error);
    res.json({ success: false, message: "មិនអាចទាញយកលេខណែនាំបានទេ!" });
  }
};

// ==========================================
// ៤. API ឆែកភាពទំនេរ (Backend - សម្រាប់ Live Search ថ្ងៃក្រោយបើត្រូវការ)
// ==========================================
exports.checkAvailability = async (req, res) => {
  const { number } = req.body;
  const user = await User.findOne({
    $or: [
      { accountNumber: number },
      { accountNumberKHR: number },
      { "subAccounts.accountNumber": number },
    ],
  });

  if (user) return res.json({ available: false });
  return res.json({ available: true });
};
