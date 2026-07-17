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
// ២. API បង្កើតគណនី Premium
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
        receiverName: "Buy Premium Account",
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
        receiverName: "Buy Premium Account",
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
      secondNumber: secondNumber,
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

    for (let i = 0; i < 15; i++) {
      let prefix = Math.floor(100 + Math.random() * 899).toString();
      let suffix =
        specialSuffixes[Math.floor(Math.random() * specialSuffixes.length)];
      let middle = Math.floor(100 + Math.random() * 899).toString();

      let num = prefix + middle + suffix;
      if (num.length > 9) num = num.substring(0, 9);
      if (num.length < 9) num = num.padEnd(9, "0");
      generatedNumbers.push(num);
    }

    generatedNumbers.push(
      Math.floor(100000 + Math.random() * 899999).toString(),
    );
    generatedNumbers.push(
      "168" + Math.floor(100 + Math.random() * 899).toString(),
    );

    generatedNumbers = [...new Set(generatedNumbers)];

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

    const availableNumbers = generatedNumbers.filter(
      (num) => !takenNumbers.includes(num),
    );

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
// ៤. API ឆែកភាពទំនេរ
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

// =========================================================================
// 🌟 ៥. API បង្កើតគណនីរួម (JOINT ACCOUNT)
// =========================================================================
exports.createJointAccount = async (req, res) => {
  const {
    username,
    requestedNumber,
    price,
    pin,
    currencyOption,
    partnerUsername,
    dailyLimit,
  } = req.body;

  try {
    const user = await User.findOne({ username });
    if (!user)
      return res.json({
        success: false,
        message: "រកគណនីអ្នកប្រើប្រាស់មិនឃើញទេ!",
      });

    if (user.pin !== pin)
      return res.json({
        success: false,
        message: "លេខសម្ងាត់ PIN មិនត្រឹមត្រូវទេ!",
      });

    // ឆែកមើលដៃគូ (Partner)
    const partner = await User.findOne({ username: partnerUsername });
    if (!partner)
      return res.json({
        success: false,
        message: "រកមិនឃើញគណនីដៃគូ (Partner) របស់អ្នកទេ!",
      });
    if (partner.username === user.username)
      return res.json({
        success: false,
        message: "អ្នកមិនអាចអញ្ជើញខ្លួនឯងបានទេ!",
      });

    // ឆែកលេខគណនីទំនេរ
    const existingMainAcc = await User.findOne({
      $or: [
        { accountNumber: requestedNumber },
        { accountNumberKHR: requestedNumber },
      ],
    });
    const existingSubAcc = await User.findOne({
      "subAccounts.accountNumber": requestedNumber,
    });
    if (existingMainAcc || existingSubAcc)
      return res.json({
        success: false,
        message: "សូមអភ័យទោស លេខគណនីនេះមានអ្នកយកបាត់ហើយ!",
      });

    let secondNumber = null;
    if (currencyOption === "BOTH") {
      let lastDigit = parseInt(requestedNumber.slice(-1));
      let baseNum = requestedNumber.slice(0, -1);
      let newLastDigit = lastDigit < 9 ? lastDigit + 1 : lastDigit - 1;
      secondNumber = baseNum + newLastDigit;

      const checkSecondAcc = await User.findOne({
        $or: [
          { accountNumber: secondNumber },
          { accountNumberKHR: secondNumber },
          { "subAccounts.accountNumber": secondNumber },
        ],
      });
      if (checkSecondAcc)
        return res.json({
          success: false,
          message: `ប្រព័ន្ធមិនអាចបង្កើតគណនីទី២ (${secondNumber}) បានទេ!`,
        });
    }

    const actualPrice = calculatePremiumPrice(requestedNumber);
    if (price !== actualPrice)
      return res.json({
        success: false,
        message: "ទិន្នន័យតម្លៃមិនត្រឹមត្រូវទេ! (Price mismatch)",
      });
    if (actualPrice > 0 && user.balance < actualPrice)
      return res.json({
        success: false,
        message: "សមតុល្យទឹកប្រាក់របស់អ្នកមិនគ្រប់គ្រាន់ទេ!",
      });

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
        refId,
        hash,
        date: dateNow,
        type: "Joint Account Purchase",
        amount: -actualPrice,
        currency: "USD",
        senderName: user.fullName || user.username,
        receiverName: "Buy Joint Account",
        remark: `Bought Joint Acc No: ${requestedNumber}`,
        status: "Success",
        trxMethod: "Main Account",
      });

      await Transaction.create({
        username: centralBank.username,
        refId,
        hash,
        date: dateNow,
        type: "Joint Account Revenue",
        amount: actualPrice,
        currency: "USD",
        senderName: user.fullName || user.username,
        receiverName: "Buy Joint Account",
        remark: `Sold Joint Acc No: ${requestedNumber}`,
        status: "Success",
        trxMethod: "System Receipt",
      });
      await centralBank.save();
    }

    // បង្កើតឈ្មោះគណនីរួម (ឧ. SOK DARA AND TORANY ALHADI)
    const ownerName = user.fullName || user.username;
    const partnerName = partner.fullName || partner.username;
    const jointAccountName = `${ownerName.toUpperCase()} AND ${partnerName.toUpperCase()}`;

    // រៀបចំសមាជិក
    const jointMember = {
      username: partner.username,
      role: "co-owner",
      dailyLimit: dailyLimit || 0,
      spentToday: 0,
      status: "pending",
    };

    // បង្កើតអនុគណនី ដោយរក្សាទុកតម្លៃដែលបង់ (pricePaid) នៅក្នុង metadata សម្រាប់ Refund
    if (currencyOption === "USD" || currencyOption === "BOTH") {
      user.subAccounts.push({
        accountId: "JNT_" + Date.now().toString() + "_1",
        accountNumber: requestedNumber,
        accountName: jointAccountName,
        accountType: "joint",
        balance: 0,
        currency: "USD",
        members: [jointMember],
        metadata: { pricePaid: actualPrice }, // 🔥 រក្សាទុកតម្លៃដែលបង់
      });
    }

    if (currencyOption === "KHR") {
      user.subAccounts.push({
        accountId: "JNT_" + Date.now().toString() + "_1",
        accountNumber: requestedNumber,
        accountName: jointAccountName,
        accountType: "joint",
        balance: 0,
        currency: "KHR",
        members: [jointMember],
        metadata: { pricePaid: actualPrice }, // 🔥 រក្សាទុកតម្លៃដែលបង់
      });
    }

    if (currencyOption === "BOTH" && secondNumber) {
      user.subAccounts.push({
        accountId: "JNT_" + Date.now().toString() + "_2",
        accountNumber: secondNumber,
        accountName: jointAccountName + " (KHR)",
        accountType: "joint",
        balance: 0,
        currency: "KHR",
        members: [jointMember],
        metadata: { pricePaid: actualPrice }, // 🔥 រក្សាទុកតម្លៃដែលបង់
      });
    }

    // ផ្ញើ Notification ទៅកាន់ដៃគូ
    if (!partner.notifications) partner.notifications = [];
    partner.notifications.unshift({
      id: "INV-" + Date.now(),
      title: "ការអញ្ជើញចូលគណនីរួម (Joint Account)",
      message: `អ្នកត្រូវបានអញ្ជើញដោយ ${ownerName} ឱ្យចូលរួមគ្រប់គ្រងគណនីរួមលេខ: ${requestedNumber}។ សូមចូលទៅកាន់ការកំណត់ដើម្បីយល់ព្រម ឬបដិសេធ (មានសុពលភាព ២៤ ម៉ោង)។`,
      date: getFormattedDate(),
      isRead: false,
      metadata: {
        type: "joint_invite",
        ownerUsername: user.username,
        accountNumber: requestedNumber,
      },
    });

    await partner.save();
    await user.save();

    res.json({
      success: true,
      message: "បង្កើតគណនីរួម និងបញ្ជូនការអញ្ជើញបានជោគជ័យ!",
      user: user,
      secondNumber: secondNumber,
    });
  } catch (error) {
    console.error("Create Joint Acc Error:", error);
    res.json({ success: false, message: "បរាជ័យក្នុងការបង្កើតគណនីរួម!" });
  }
};

// =========================================================================
// 🌟 ៦. API ឆ្លើយតបការអញ្ជើញ (Accept Joint Account) - ថែមលក្ខខណ្ឌ ២៤ម៉ោង & Refund ៥០%
// =========================================================================
exports.respondToJointInvite = async (req, res) => {
  const { inviteeUsername, ownerUsername, accountNumber, action } = req.body;

  try {
    const owner = await User.findOne({ username: ownerUsername });
    const invitee = await User.findOne({ username: inviteeUsername });

    if (!owner || !invitee)
      return res.json({ success: false, message: "រកគណនីមិនឃើញទេ!" });

    // រកមើលគណនីរួមនៅក្នុងគណនីរបស់មេ (Owner)
    let foundSubAccountIndex = owner.subAccounts.findIndex(
      (acc) =>
        acc.accountNumber === accountNumber && acc.accountType === "joint",
    );

    if (foundSubAccountIndex === -1) {
      return res.json({
        success: false,
        message: "រកគណនីរួមនេះមិនឃើញទេ ឬត្រូវបានលុបបាត់ហើយ!",
      });
    }

    let jointAcc = owner.subAccounts[foundSubAccountIndex];
    let memberIndex = jointAcc.members.findIndex(
      (m) => m.username === inviteeUsername,
    );

    if (memberIndex === -1) {
      return res.json({
        success: false,
        message: "អ្នកមិនមានសិទ្ធិក្នុងគណនីនេះទេ!",
      });
    }

    // 🔥 ឆែកមើលថាតើហួស ២៤ម៉ោង ឬនៅ?
    const createdAtTime = new Date(jointAcc.createdAt).getTime();
    const currentTime = Date.now();
    const hoursDifference = (currentTime - createdAtTime) / (1000 * 60 * 60);
    const isExpired =
      hoursDifference > 24 &&
      jointAcc.members[memberIndex].status === "pending";

    // ប្រសិនបើចុចបដិសេធ (reject) ឬ ហួសកំណត់ ២៤ម៉ោង (expired) -> Refund ៥០%
    if (action === "reject" || isExpired) {
      const pricePaid = jointAcc.metadata?.pricePaid || 0;
      const refundAmount = pricePaid / 2; // បង្វិលសង ៥០% (៥០% ទៀតធនាគារយក)

      if (refundAmount > 0) {
        const centralBank = await User.findOne({ accountNumber: "888888888" });
        if (centralBank) {
          owner.balance += refundAmount;
          centralBank.balance -= refundAmount;

          const dateNow = getFormattedDate();
          const refId = "REF-" + Date.now().toString().slice(-6);
          const hash = generateHash();

          // កត់ត្រា Transaction ឱ្យ Owner
          await Transaction.create({
            username: owner.username,
            refId: refId,
            hash: hash,
            date: dateNow,
            type: "Joint Account Refund",
            amount: refundAmount,
            currency: "USD",
            senderName: "System",
            receiverName: owner.fullName || owner.username,
            remark: `Refund 50% for Cancelled/Expired Joint Acc: ${accountNumber}`,
            status: "Success",
            trxMethod: "System Refund",
          });

          // កត់ត្រា Transaction ឱ្យ Central Bank
          await Transaction.create({
            username: centralBank.username,
            refId: refId,
            hash: hash,
            date: dateNow,
            type: "Joint Account Refund Deducted",
            amount: -refundAmount,
            currency: "USD",
            senderName: "System",
            receiverName: owner.fullName || owner.username,
            remark: `Refund 50% to ${owner.username} for Joint Acc: ${accountNumber}`,
            status: "Success",
            trxMethod: "System Refund",
          });
          await centralBank.save();
        }
      }

      // លុបគណនីរួមនេះចេញពី Owner ដោយសារដៃគូបដិសេធ ឬហួសម៉ោង
      owner.subAccounts.splice(foundSubAccountIndex, 1);

      // លោត Notification ប្រាប់ Owner
      let notifMessage =
        action === "reject"
          ? `${invitee.fullName || invitee.username} បានបដិសេធការអញ្ជើញរបស់អ្នក។ គណនីត្រូវបានលុបចោល ហើយប្រព័ន្ធបានបង្វិលសង ៥០% ទៅគណនីអ្នកវិញ។`
          : `ការអញ្ជើញគណនីរួមលេខ ${accountNumber} ហួសកំណត់ ២៤ម៉ោង។ ប្រព័ន្ធបានលុបចោល និងបង្វិលប្រាក់ ៥០% ចូលគណនីអ្នកវិញ។`;

      if (!owner.notifications) owner.notifications = [];
      owner.notifications.unshift({
        id: "NOTIF-" + Date.now(),
        title:
          action === "reject"
            ? "ការអញ្ជើញត្រូវបានបដិសេធ ❌"
            : "គណនីរួមផុតកំណត់ ⏱️",
        message: notifMessage,
        date: getFormattedDate(),
        isRead: false,
      });

      await owner.save();

      return res.json({
        success: action === "reject" ? true : false,
        message:
          action === "reject"
            ? "អ្នកបានបដិសេធការអញ្ជើញនេះដោយជោគជ័យ។"
            : "ការអញ្ជើញនេះហួសកំណត់ ២៤ ម៉ោងហើយ! ប្រព័ន្ធបានលុបចោល និងបង្វិលសង ៥០% ទៅម្ចាស់គណនីវិញ។",
      });
    }

    // ប្រសិនបើដៃគូយល់ព្រម (Accept) ក្នុងកំឡុងពេល ២៤ម៉ោង
    if (action === "accept") {
      // កែស្ថានភាពទៅជា active
      owner.subAccounts[foundSubAccountIndex].members[memberIndex].status =
        "active";

      // វេទមន្តនៅទីនេះ៖ Copy គណនីរួមនោះ ញាត់ចូលទៅក្នុង subAccounts របស់ invitee ផ្ទាល់!
      invitee.subAccounts.push({
        accountId: jointAcc.accountId,
        accountNumber: jointAcc.accountNumber,
        accountName: jointAcc.accountName,
        accountType: "joint_member", // សំខាន់ណាស់!
        balance: jointAcc.balance,
        currency: jointAcc.currency,
        metadata: { owner: ownerUsername }, // ចំណាំថាកុងនេះជារបស់អ្នកណា
      });

      // ផ្ញើ Notification ប្រាប់ Owner វិញ
      if (!owner.notifications) owner.notifications = [];
      owner.notifications.unshift({
        id: "NOTIF-" + Date.now(),
        title: "ការអញ្ជើញត្រូវបានយល់ព្រម ✅",
        message: `${invitee.fullName || invitee.username} បានយល់ព្រមចូលរួមគណនីរួម (${accountNumber}) របស់អ្នកហើយ។`,
        date: getFormattedDate(),
        isRead: false,
      });

      await owner.save();
      await invitee.save();

      return res.json({
        success: true,
        message:
          "អ្នកបានចូលរួមគណនីគ្រួសារនេះដោយជោគជ័យ! លេខគណនីនេះនឹងបង្ហាញក្នុងជម្រើសរបស់អ្នក។",
      });
    }
  } catch (error) {
    console.error("Accept Joint Invite Error:", error);
    res.json({ success: false, message: "មានបញ្ហាក្នុងការទទួលយកការអញ្ជើញ!" });
  }
};
