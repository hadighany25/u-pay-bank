const User = require("../models/User");
const Transaction = require("../models/Transaction");
const JointAccount = require("../models/JointAccount");
const {
  getFormattedDate,
  generateRefId,
  generateHash,
} = require("../services/helpers");

// ==========================================
// ១. រូបមន្តគណនាតម្លៃលេខ
// ==========================================
function calculatePremiumPrice(numStr) {
  if (numStr.length === 6) return 100;
  if (numStr.length !== 9) return 0;

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
  if (/(.)\1{3}/.test(numStr)) return 20;
  if (/(.)\1{2}/.test(numStr)) return 15;
  if (numStr.endsWith("00") || numStr.endsWith("88") || numStr.endsWith("99"))
    return 10;

  return 5;
}

// ==========================================
// ២. API បង្កើតគណនី Premium
// ==========================================
exports.createPremiumAccount = async (req, res) => {
  const { username, requestedNumber, accountName, price, pin, currencyOption } =
    req.body;

  try {
    const user = await User.findOne({ username });
    if (!user) return res.json({ success: false, message: "រកគណនីមិនឃើញទេ!" });
    if (user.pin !== pin)
      return res.json({ success: false, message: "លេខ PIN មិនត្រឹមត្រូវ!" });

    const existingMainAcc = await User.findOne({
      $or: [
        { accountNumber: requestedNumber },
        { accountNumberKHR: requestedNumber },
      ],
    });
    const existingSubAcc = await User.findOne({
      "subAccounts.accountNumber": requestedNumber,
    });
    const existingJointAcc = await JointAccount.findOne({
      accountNumber: requestedNumber,
    });

    if (existingMainAcc || existingSubAcc || existingJointAcc) {
      return res.json({
        success: false,
        message: "លេខគណនីនេះមានអ្នកយកបាត់ហើយ!",
      });
    }

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
      const checkJointSecond = await JointAccount.findOne({
        accountNumber: secondNumber,
      });

      if (checkSecondAcc || checkJointSecond) {
        return res.json({
          success: false,
          message: `ប្រព័ន្ធមិនអាចបង្កើតគណនីទី២ (${secondNumber}) បានទេ ដោយសារវាត្រូវបានប្រើប្រាស់ហើយ។`,
        });
      }
    }

    const actualPrice = calculatePremiumPrice(requestedNumber);
    if (price !== actualPrice)
      return res.json({
        success: false,
        message: "ទិន្នន័យតម្លៃមិនត្រឹមត្រូវ!",
      });
    if (actualPrice > 0 && user.balance < actualPrice)
      return res.json({ success: false, message: "សមតុល្យមិនគ្រប់គ្រាន់ទេ!" });

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

      await Transaction.create([
        {
          username: user.username,
          refId,
          hash,
          date: dateNow,
          type: "Premium Account Purchase",
          amount: -actualPrice,
          currency: "USD",
          senderName: user.fullName || user.username,
          receiverName: "Buy Premium Account",
          remark: `Bought Acc No: ${requestedNumber}`,
          status: "Success",
          trxMethod: "Main Account",
        },
        {
          username: centralBank.username,
          refId,
          hash,
          date: dateNow,
          type: "Premium Account Revenue",
          amount: actualPrice,
          currency: "USD",
          senderName: user.fullName || user.username,
          receiverName: "Buy Premium Account",
          remark: `Sold Acc No: ${requestedNumber}`,
          status: "Success",
          trxMethod: "System Receipt",
        },
      ]);
      await centralBank.save();
    }

    const baseAccountId = Date.now().toString();

    if (currencyOption === "USD" || currencyOption === "BOTH") {
      user.subAccounts.push({
        accountId: baseAccountId + "_1",
        accountNumber: requestedNumber,
        accountName,
        accountType: "premium",
        balance: 0,
        currency: "USD",
      });
    }
    if (currencyOption === "KHR") {
      user.subAccounts.push({
        accountId: baseAccountId + "_1",
        accountNumber: requestedNumber,
        accountName,
        accountType: "premium",
        balance: 0,
        currency: "KHR",
      });
    }
    if (currencyOption === "BOTH" && secondNumber) {
      user.subAccounts.push({
        accountId: baseAccountId + "_2",
        accountNumber: secondNumber,
        accountName: accountName + " (KHR)",
        accountType: "premium",
        balance: 0,
        currency: "KHR",
      });
    }

    await user.save();
    res.json({
      success: true,
      message: "បង្កើតគណនីបានជោគជ័យ!",
      user,
      secondNumber,
    });
  } catch (error) {
    console.error("Create Premium Acc Error:", error);
    res.json({ success: false, message: "បរាជ័យក្នុងការបង្កើតគណនី!" });
  }
};

// ==========================================
// ៣. API ទាញយកលេខណែនាំពិសេសៗ
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
    const existingJoints = await JointAccount.find({
      accountNumber: { $in: generatedNumbers },
    });

    const takenNumbers = new Set();
    existingUsers.forEach((user) => {
      takenNumbers.add(user.accountNumber);
      takenNumbers.add(user.accountNumberKHR);
      user.subAccounts.forEach((sub) => takenNumbers.add(sub.accountNumber));
    });
    existingJoints.forEach((joint) => takenNumbers.add(joint.accountNumber));

    const availableNumbers = generatedNumbers.filter(
      (num) => !takenNumbers.has(num),
    );
    const suggestedList = availableNumbers
      .slice(0, 12)
      .map((num) => ({ number: num, price: calculatePremiumPrice(num) }));

    res.json({ success: true, data: suggestedList });
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
  const joint = await JointAccount.findOne({ accountNumber: number });

  if (user || joint) return res.json({ available: false });
  return res.json({ available: true });
};

// =========================================================================
// ៤.១ API ស្វែងរកគណនីដៃគូ (Joint Partner)
// =========================================================================
exports.searchUserForJoint = async (req, res) => {
  try {
    const { identifier } = req.params;
    const user = await User.findOne({
      $or: [
        { username: identifier },
        { phone: identifier },
        { accountNumber: identifier },
        { accountNumberKHR: identifier },
      ],
    }).select("username fullName profileImage");

    if (!user)
      return res.json({ success: false, message: "រកមិនឃើញគណនីនេះទេ!" });
    res.json({ success: true, user });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "មានបញ្ហាក្នុងការស្វែងរក" });
  }
};

// =========================================================================
// 🌟 ៥. API បង្កើតគណនីរួម (JointAccount Database ថ្មី)
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
    if (!user || user.pin !== pin)
      return res.json({ success: false, message: "គណនី ឬ PIN មិនត្រឹមត្រូវ!" });

    const partner = await User.findOne({ username: partnerUsername });
    if (!partner)
      return res.json({ success: false, message: "រកគណនីដៃគូមិនឃើញទេ!" });
    if (partner.username === user.username)
      return res.json({ success: false, message: "មិនអាចអញ្ជើញខ្លួនឯងបានទេ!" });

    const existingMainAcc = await User.findOne({
      $or: [
        { accountNumber: requestedNumber },
        { accountNumberKHR: requestedNumber },
      ],
    });
    const existingSubAcc = await User.findOne({
      "subAccounts.accountNumber": requestedNumber,
    });
    const existingJointAcc = await JointAccount.findOne({
      accountNumber: requestedNumber,
    });

    if (existingMainAcc || existingSubAcc || existingJointAcc)
      return res.json({ success: false, message: "លេខគណនីនេះមានអ្នកយកហើយ!" });

    let secondNumber = null;
    if (currencyOption === "BOTH") {
      let lastDigit = parseInt(requestedNumber.slice(-1));
      let baseNum = requestedNumber.slice(0, -1);
      secondNumber = baseNum + (lastDigit < 9 ? lastDigit + 1 : lastDigit - 1);

      const checkSecondAcc = await User.findOne({
        $or: [
          { accountNumber: secondNumber },
          { accountNumberKHR: secondNumber },
          { "subAccounts.accountNumber": secondNumber },
        ],
      });
      const checkJointSecond = await JointAccount.findOne({
        accountNumber: secondNumber,
      });

      if (checkSecondAcc || checkJointSecond)
        return res.json({
          success: false,
          message: `មិនអាចបង្កើតគណនីទី២ (${secondNumber}) បានទេ!`,
        });
    }

    const actualPrice = calculatePremiumPrice(requestedNumber);
    if (price !== actualPrice)
      return res.json({ success: false, message: "តម្លៃមិនត្រឹមត្រូវ!" });
    if (actualPrice > 0 && user.balance < actualPrice)
      return res.json({ success: false, message: "សមតុល្យមិនគ្រប់គ្រាន់ទេ!" });

    if (actualPrice > 0) {
      const centralBank = await User.findOne({ accountNumber: "888888888" });
      user.balance -= actualPrice;
      centralBank.balance += actualPrice;

      const dateNow = getFormattedDate();
      const refId = generateRefId();
      const hash = generateHash();
      await Transaction.create([
        {
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
        },
        {
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
        },
      ]);
      await centralBank.save();
    }

    const jointAccountName = `${(user.fullName || user.username).toUpperCase()} AND ${(partner.fullName || partner.username).toUpperCase()}`;
    const baseAccountId = "JNT_" + Date.now().toString();

    const createJointRecord = async (accountId, accNum, suffix, curr) => {
      await JointAccount.create({
        accountId: accountId,
        accountNumber: accNum,
        accountName: jointAccountName + suffix,
        balance: 0,
        currency: curr,
        members: [
          { username: user.username, role: "owner", status: "active" },
          {
            username: partner.username,
            role: "co-owner",
            dailyLimit: dailyLimit || 0,
            spentToday: 0,
            status: "pending",
          },
        ],
        metadata: { pricePaid: actualPrice },
      });

      user.subAccounts.push({
        accountId: accountId,
        accountNumber: accNum,
        accountName: jointAccountName + suffix,
        accountType: "joint",
        currency: curr,
      });
    };

    if (currencyOption === "USD" || currencyOption === "BOTH") {
      await createJointRecord(baseAccountId + "_1", requestedNumber, "", "USD");
    }
    if (currencyOption === "KHR") {
      await createJointRecord(baseAccountId + "_1", requestedNumber, "", "KHR");
    }
    if (currencyOption === "BOTH" && secondNumber) {
      await createJointRecord(
        baseAccountId + "_2",
        secondNumber,
        " (KHR)",
        "KHR",
      );
    }

    if (!partner.notifications) partner.notifications = [];
    partner.notifications.unshift({
      id: "INV-" + Date.now(),
      title: "ការអញ្ជើញចូលគណនីរួម (Joint Account)",
      message: `អ្នកត្រូវបានអញ្ជើញដោយ ${user.fullName || user.username} ឱ្យចូលរួមគណនីរួមលេខ: ${requestedNumber}។ សូមចូលទៅយល់ព្រម ឬបដិសេធ។`,
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
      user,
      secondNumber,
    });
  } catch (error) {
    console.error("Create Joint Acc Error:", error);
    res.json({ success: false, message: "បរាជ័យក្នុងការបង្កើតគណនីរួម!" });
  }
};

// =========================================================================
// 🌟 ៦. API ឆ្លើយតបការអញ្ជើញ (Accept/Reject Joint Account)
// =========================================================================
exports.respondToJointInvite = async (req, res) => {
  const { inviteeUsername, ownerUsername, accountNumber, action } = req.body;

  try {
    const owner = await User.findOne({ username: ownerUsername });
    const invitee = await User.findOne({ username: inviteeUsername });

    if (!owner || !invitee)
      return res.json({ success: false, message: "រកគណនីមិនឃើញទេ!" });

    // ទាញយកគណនីរួមចេញពីធុង JointAccount
    const baseNumber = accountNumber.substring(0, 8); // ចាប់យកលេខដើម ដើម្បីរកទាំង USD និង KHR (បើមាន)
    const linkedAccs = await JointAccount.find({
      accountNumber: new RegExp("^" + baseNumber),
      "members.username": inviteeUsername,
      "members.status": "pending",
    });

    if (linkedAccs.length === 0) {
      return res.json({
        success: false,
        message: "រកគណនីរួមនេះមិនឃើញទេ ឬត្រូវបានលុបបាត់ហើយ!",
      });
    }

    // --- ករណីបដិសេធ (Reject) ---
    if (action === "reject") {
      const pricePaid = linkedAccs[0].metadata?.pricePaid || 0;
      const refundAmount = pricePaid / 2;

      if (refundAmount > 0) {
        const centralBank = await User.findOne({ accountNumber: "888888888" });
        if (centralBank) {
          owner.balance += refundAmount;
          centralBank.balance -= refundAmount;

          const dateNow = getFormattedDate();
          const refId = "REF-" + Date.now().toString().slice(-6);
          const hash = generateHash();

          await Transaction.create([
            {
              username: owner.username,
              refId,
              hash,
              date: dateNow,
              type: "Joint Account Refund",
              amount: refundAmount,
              currency: "USD",
              senderName: "System",
              receiverName: owner.fullName || owner.username,
              remark: `Refund 50% for Rejected Joint Acc: ${accountNumber}`,
              status: "Success",
              trxMethod: "System Refund",
            },
            {
              username: centralBank.username,
              refId,
              hash,
              date: dateNow,
              type: "Joint Acc Refund Deducted",
              amount: -refundAmount,
              currency: "USD",
              senderName: "System",
              receiverName: owner.fullName || owner.username,
              remark: `Refund 50% to ${owner.username}`,
              status: "Success",
              trxMethod: "System Refund",
            },
          ]);
          await centralBank.save();
        }
      }

      const accIdsToRemove = linkedAccs.map((a) => a.accountId);
      await JointAccount.deleteMany({ accountId: { $in: accIdsToRemove } });
      owner.subAccounts = owner.subAccounts.filter(
        (sa) => !accIdsToRemove.includes(sa.accountId),
      );

      if (!owner.notifications) owner.notifications = [];
      owner.notifications.unshift({
        id: "NOTIF-" + Date.now(),
        title: "ការអញ្ជើញត្រូវបានបដិសេធ ❌",
        message: `${invitee.fullName || invitee.username} បានបដិសេធការអញ្ជើញរបស់អ្នក។ គណនីរួមលេខ ${accountNumber} ត្រូវបានលុបចោល ហើយទទួលបានលុយវិញ ៥០% ($${refundAmount})។`,
        date: getFormattedDate(),
        isRead: false,
      });

      await owner.save();
      return res.json({
        success: true,
        message: "អ្នកបានបដិសេធ។ គណនីត្រូវបានលុប!",
      });
    }

    // --- ករណីយល់ព្រម (Accept) ---
    if (action === "accept") {
      for (let la of linkedAccs) {
        let mIdx = la.members.findIndex((m) => m.username === inviteeUsername);
        if (mIdx !== -1) {
          la.members[mIdx].status = "active";
          await la.save();
        }

        invitee.subAccounts.push({
          accountId: la.accountId,
          accountNumber: la.accountNumber,
          accountName: la.accountName,
          accountType: "joint_member",
          currency: la.currency,
        });
      }

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
        message: "អ្នកបានចូលរួមគណនីគ្រួសារនេះដោយជោគជ័យ!",
      });
    }
  } catch (error) {
    console.error("Accept Joint Invite Error:", error);
    res.json({ success: false, message: "មានបញ្ហាក្នុងការទទួលយកការអញ្ជើញ!" });
  }
};
