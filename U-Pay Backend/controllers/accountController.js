// ============================================================================
// ឯកសារ: accountController.js
// អត្ថន័យ: គ្រប់គ្រងមុខងារទាំងអស់ទាក់ទងនឹងគណនី (Premium & Joint Accounts)
// ============================================================================

const User = require("../models/User");
const Transaction = require("../models/Transaction");
const JointAccount = require("../models/JointAccount");
const Notification = require("../models/Notification"); // 🌟 ថែម Notification Model ថ្មី
const { getFormattedDate } = require("../services/helpers");

// ----------------------------------------------------------------------------
// ផ្នែកទី ១៖ មុខងារជំនួយ (Helper Functions & Business Logic)
// ----------------------------------------------------------------------------

/**
 * បង្កើត Hash ស្ដង់ដារ (១០ ខ្ទង់ចៃដន្យរួមបញ្ចូលអក្សរ និងលេខ)
 * @returns {string} ឧ. "A1B2C3D4E5"
 */
const generateStandardHash = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 10; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * បង្កើត Reference ID ស្ដង់ដារ (៨ ខ្ទង់ចៃដន្យជាមួយ Prefix)
 * @param {string} prefix - អក្សរកាត់ខាងមុខ (ឧ. "PRM", "JNT")
 * @returns {string} ឧ. "PRM-12345678"
 */
const generateStandardRefId = (prefix) => {
  const random8Digits = Math.floor(10000000 + Math.random() * 90000000);
  return `${prefix}-${random8Digits}`;
};

/**
 * គណនាតម្លៃសម្រាប់លេខគណនីពិសេស (Premium Account Pricing)
 * @param {string} numStr - លេខគណនីដែលបានស្នើ
 * @returns {number} តម្លៃគិតជាដុល្លារ
 */
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

// ----------------------------------------------------------------------------
// ផ្នែកទី ២៖ គ្រប់គ្រងគណនីលំដាប់ខ្ពស់ (Premium Accounts Management)
// ----------------------------------------------------------------------------

/**
 * បង្កើតគណនី Premium ថ្មី (Create Premium Account)
 */
exports.createPremiumAccount = async (req, res) => {
  const { username, requestedNumber, accountName, price, pin, currencyOption } =
    req.body;

  try {
    // ជំហានទី ១៖ ផ្ទៀងផ្ទាត់អ្នកប្រើប្រាស់ និង PIN
    const user = await User.findOne({ username });
    if (!user) return res.json({ success: false, message: "រកគណនីមិនឃើញទេ!" });
    if (user.pin !== pin)
      return res.json({ success: false, message: "លេខ PIN មិនត្រឹមត្រូវ!" });

    // ជំហានទី ២៖ ឆែកមើលភាពទំនេរនៃលេខគណនីទី១ (រចនាសម្ព័ន្ធថ្មី + Legacy Support)
    const isTaken = await Promise.all([
      User.findOne({
        $or: [
          { "mainAccounts.USD.accountNumber": requestedNumber },
          { "mainAccounts.KHR.accountNumber": requestedNumber },
          { accountNumber: requestedNumber },
          { accountNumberKHR: requestedNumber },
        ],
      }),
      User.findOne({ "subAccounts.accountNumber": requestedNumber }),
      JointAccount.findOne({ accountNumber: requestedNumber }),
    ]);

    if (isTaken.some((result) => result !== null)) {
      return res.json({
        success: false,
        message: "លេខគណនីនេះមានអ្នកយកបាត់ហើយ!",
      });
    }

    // ជំហានទី ៣៖ រៀបចំលេខគណនីទី២ (ករណីជ្រើសរើសរូបិយប័ណ្ណ "BOTH")
    let secondNumber = null;
    if (currencyOption === "BOTH") {
      let lastDigit = parseInt(requestedNumber.slice(-1));
      let baseNum = requestedNumber.slice(0, -1);
      let newLastDigit = lastDigit < 9 ? lastDigit + 1 : lastDigit - 1;
      secondNumber = baseNum + newLastDigit;

      const isSecondTaken = await Promise.all([
        User.findOne({
          $or: [
            { "mainAccounts.USD.accountNumber": secondNumber },
            { "mainAccounts.KHR.accountNumber": secondNumber },
            { accountNumber: secondNumber },
            { accountNumberKHR: secondNumber },
            { "subAccounts.accountNumber": secondNumber },
          ],
        }),
        JointAccount.findOne({ accountNumber: secondNumber }),
      ]);

      if (isSecondTaken.some((result) => result !== null)) {
        return res.json({
          success: false,
          message: `ប្រព័ន្ធមិនអាចបង្កើតគណនីទី២ (${secondNumber}) បានទេ ដោយសារវាត្រូវបានប្រើប្រាស់ហើយ។`,
        });
      }
    }

    // ជំហានទី ៤៖ ផ្ទៀងផ្ទាត់តម្លៃ និងសមតុល្យ (តាមទម្រង់ថ្មី mainAccounts.USD.balance)
    const actualPrice = calculatePremiumPrice(requestedNumber);
    if (price !== actualPrice)
      return res.json({
        success: false,
        message: "ទិន្នន័យតម្លៃមិនត្រឹមត្រូវ!",
      });

    const userUsdBal = user.mainAccounts?.USD?.balance || user.balance || 0;
    if (actualPrice > 0 && userUsdBal < actualPrice)
      return res.json({ success: false, message: "សមតុល្យមិនគ្រប់គ្រាន់ទេ!" });

    // ជំហានទី ៥៖ កាត់ប្រាក់ និងកត់ត្រាប្រតិបត្តិការ (Transaction) ប្រសិនបើមានតម្លៃ
    if (actualPrice > 0) {
      // ស្វែងរក Super Admin និង Sub-Account សម្រាប់ប្រមូល Fee (888000999)
      let superAdmin = await User.findOne({ username: "superadmin" });

      // កាត់លុយពី Main Account USD ថ្មី
      if (user.mainAccounts?.USD) {
        user.mainAccounts.USD.balance -= actualPrice;
      } else {
        user.balance -= actualPrice;
      }

      // បូកលុយចូល Sub-Account Fee របស់ Super Admin
      if (superAdmin) {
        let targetFeeSub = superAdmin.subAccounts?.find(
          (sub) => sub.accountNumber === "888000999",
        );
        if (targetFeeSub) {
          targetFeeSub.balance += actualPrice;
          superAdmin.markModified("subAccounts");
        } else if (superAdmin.mainAccounts?.USD) {
          superAdmin.mainAccounts.USD.balance += actualPrice;
        } else {
          superAdmin.balance += actualPrice;
        }
        await superAdmin.save();
      }

      const dateNow = getFormattedDate();
      const refId = generateStandardRefId("PRM");
      const hash = generateStandardHash();

      await Transaction.create([
        {
          userId: user._id,
          username: user.username,
          refId,
          hash,
          date: dateNow,
          type: "Premium Account Purchase",
          amount: -actualPrice,
          currency: "USD",
          senderName: user.fullName || user.username,
          receiverName: "Buy Premium Account",
          senderAcc:
            user.mainAccounts?.USD?.accountNumber || user.accountNumber,
          remark: `Bought Acc No: ${requestedNumber}`,
          status: "Success",
          trxMethod: "Main Account",
        },
        {
          userId: superAdmin?._id,
          username: superAdmin ? superAdmin.username : "superadmin",
          refId,
          hash,
          date: dateNow,
          type: "System Income",
          amount: actualPrice,
          currency: "USD",
          senderName: user.fullName || user.username,
          receiverName: "Central Bank Fee Income",
          receiverAcc: "888000999", // 🌟 ចង្អុលចំលេខកុង Sub-Account Fee
          remark: `Sold Acc No: ${requestedNumber}`,
          status: "Success",
          trxMethod: "System Receipt",
        },
      ]);
    }

    // ជំហានទី ៦៖ បង្កើតគណនីរង (Sub Accounts) បញ្ចូលទៅកាន់អ្នកប្រើប្រាស់
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

    // ជំហានទី ៧៖ រក្សាទុកទិន្នន័យ
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

/**
 * ទាញយកបញ្ជីលេខណែនាំពិសេសៗ (Get Suggested Premium Numbers)
 */
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

    // ជំហានទី ១៖ បង្កើតលេខចៃដន្យលាយជាមួយលេខពិសេស
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
    generatedNumbers = [...new Set(generatedNumbers)]; // លុបលេខស្ទួន

    // ជំហានទី ២៖ ឆែកមើលលេខដែលមានអ្នកប្រើប្រាស់រួចហើយ (រចនាសម្ព័ន្ធថ្មី)
    const existingUsers = await User.find({
      $or: [
        { "mainAccounts.USD.accountNumber": { $in: generatedNumbers } },
        { "mainAccounts.KHR.accountNumber": { $in: generatedNumbers } },
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
      if (user.mainAccounts?.USD?.accountNumber)
        takenNumbers.add(user.mainAccounts.USD.accountNumber);
      if (user.mainAccounts?.KHR?.accountNumber)
        takenNumbers.add(user.mainAccounts.KHR.accountNumber);
      if (user.accountNumber) takenNumbers.add(user.accountNumber);
      if (user.accountNumberKHR) takenNumbers.add(user.accountNumberKHR);
      user.subAccounts.forEach((sub) => takenNumbers.add(sub.accountNumber));
    });
    existingJoints.forEach((joint) => takenNumbers.add(joint.accountNumber));

    // ជំហានទី ៣៖ ចម្រាញ់យកលេខដែលទំនេរ និងចងក្រងជាមួយតម្លៃ
    const availableNumbers = generatedNumbers.filter(
      (num) => !takenNumbers.has(num),
    );
    const suggestedList = availableNumbers.slice(0, 12).map((num) => ({
      number: num,
      price: calculatePremiumPrice(num),
    }));

    res.json({ success: true, data: suggestedList });
  } catch (error) {
    console.error("Get Suggested Numbers Error:", error);
    res.json({ success: false, message: "មិនអាចទាញយកលេខណែនាំបានទេ!" });
  }
};

/**
 * ត្រួតពិនិត្យភាពទំនេរនៃលេខគណនី (Check Availability)
 */
exports.checkAvailability = async (req, res) => {
  const { number } = req.body;
  const user = await User.findOne({
    $or: [
      { "mainAccounts.USD.accountNumber": number },
      { "mainAccounts.KHR.accountNumber": number },
      { accountNumber: number },
      { accountNumberKHR: number },
      { "subAccounts.accountNumber": number },
    ],
  });
  const joint = await JointAccount.findOne({ accountNumber: number });

  if (user || joint) return res.json({ available: false });
  return res.json({ available: true });
};

// ----------------------------------------------------------------------------
// ផ្នែកទី ៣៖ គ្រប់គ្រងគណនីរួម (Joint Accounts Management)
// ----------------------------------------------------------------------------

/**
 * ស្វែងរកគណនីដៃគូសម្រាប់អញ្ជើញ (Search User for Joint Account)
 */
exports.searchUserForJoint = async (req, res) => {
  try {
    const { identifier } = req.params;
    const user = await User.findOne({
      $or: [
        { username: identifier },
        { phone: identifier },
        { "mainAccounts.USD.accountNumber": identifier },
        { "mainAccounts.KHR.accountNumber": identifier },
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

/**
 * បង្កើតគណនីរួម និងបញ្ជូនការអញ្ជើញ (Create Joint Account & Invite)
 */
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
    // ជំហានទី ១៖ ផ្ទៀងផ្ទាត់ម្ចាស់គណនី និងដៃគូ
    const user = await User.findOne({ username });
    if (!user || user.pin !== pin)
      return res.json({ success: false, message: "គណនី ឬ PIN មិនត្រឹមត្រូវ!" });

    const partner = await User.findOne({ username: partnerUsername });
    if (!partner)
      return res.json({ success: false, message: "រកគណនីដៃគូមិនឃើញទេ!" });
    if (partner.username === user.username)
      return res.json({ success: false, message: "មិនអាចអញ្ជើញខ្លួនឯងបានទេ!" });

    // ជំហានទី ២៖ ឆែកភាពទំនេរនៃលេខគណនី
    const isTaken = await Promise.all([
      User.findOne({
        $or: [
          { "mainAccounts.USD.accountNumber": requestedNumber },
          { "mainAccounts.KHR.accountNumber": requestedNumber },
          { accountNumber: requestedNumber },
          { accountNumberKHR: requestedNumber },
        ],
      }),
      User.findOne({ "subAccounts.accountNumber": requestedNumber }),
      JointAccount.findOne({ accountNumber: requestedNumber }),
    ]);

    if (isTaken.some((result) => result !== null)) {
      return res.json({ success: false, message: "លេខគណនីនេះមានអ្នកយកហើយ!" });
    }

    // ជំហានទី ៣៖ រៀបចំលេខគណនីទី២ (ករណីជ្រើសរើសរូបិយប័ណ្ណ "BOTH")
    let secondNumber = null;
    if (currencyOption === "BOTH") {
      let lastDigit = parseInt(requestedNumber.slice(-1));
      let baseNum = requestedNumber.slice(0, -1);
      secondNumber = baseNum + (lastDigit < 9 ? lastDigit + 1 : lastDigit - 1);

      const isSecondTaken = await Promise.all([
        User.findOne({
          $or: [
            { "mainAccounts.USD.accountNumber": secondNumber },
            { "mainAccounts.KHR.accountNumber": secondNumber },
            { accountNumber: secondNumber },
            { accountNumberKHR: secondNumber },
            { "subAccounts.accountNumber": secondNumber },
          ],
        }),
        JointAccount.findOne({ accountNumber: secondNumber }),
      ]);

      if (isSecondTaken.some((result) => result !== null)) {
        return res.json({
          success: false,
          message: `មិនអាចបង្កើតគណនីទី២ (${secondNumber}) បានទេ!`,
        });
      }
    }

    // ជំហានទី ៤៖ ផ្ទៀងផ្ទាត់តម្លៃ និងសមតុល្យ (តាមទម្រង់ថ្មី)
    const actualPrice = calculatePremiumPrice(requestedNumber);
    if (price !== actualPrice)
      return res.json({ success: false, message: "តម្លៃមិនត្រឹមត្រូវ!" });

    const userUsdBal = user.mainAccounts?.USD?.balance || user.balance || 0;
    if (actualPrice > 0 && userUsdBal < actualPrice)
      return res.json({ success: false, message: "សមតុល្យមិនគ្រប់គ្រាន់ទេ!" });

    // ជំហានទី ៥៖ កាត់ប្រាក់ និងកត់ត្រាប្រតិបត្តិការ (ប្រសិនបើមានតម្លៃ)
    if (actualPrice > 0) {
      let superAdmin = await User.findOne({ username: "superadmin" });

      if (user.mainAccounts?.USD) {
        user.mainAccounts.USD.balance -= actualPrice;
      } else {
        user.balance -= actualPrice;
      }

      if (superAdmin) {
        let targetFeeSub = superAdmin.subAccounts?.find(
          (sub) => sub.accountNumber === "888000999",
        );
        if (targetFeeSub) {
          targetFeeSub.balance += actualPrice;
          superAdmin.markModified("subAccounts");
        } else if (superAdmin.mainAccounts?.USD) {
          superAdmin.mainAccounts.USD.balance += actualPrice;
        } else {
          superAdmin.balance += actualPrice;
        }
        await superAdmin.save();
      }

      const dateNow = getFormattedDate();
      const refId = generateStandardRefId("JNT");
      const hash = generateStandardHash();

      await Transaction.create([
        {
          userId: user._id,
          username: user.username,
          refId,
          hash,
          date: dateNow,
          type: "Joint Account Purchase",
          amount: -actualPrice,
          currency: "USD",
          senderName: user.fullName || user.username,
          receiverName: "Buy Joint Account",
          senderAcc:
            user.mainAccounts?.USD?.accountNumber || user.accountNumber,
          remark: `Bought Joint Acc No: ${requestedNumber}`,
          status: "Success",
          trxMethod: "Main Account",
        },
        {
          userId: superAdmin?._id,
          username: superAdmin ? superAdmin.username : "superadmin",
          refId,
          hash,
          date: dateNow,
          type: "System Income",
          amount: actualPrice,
          currency: "USD",
          senderName: user.fullName || user.username,
          receiverName: "Central Bank Fee Income",
          receiverAcc: "888000999",
          remark: `Sold Joint Acc No: ${requestedNumber}`,
          status: "Success",
          trxMethod: "System Receipt",
        },
      ]);
    }

    // ជំហានទី ៦៖ បង្កើតទិន្នន័យ Joint Account (Database Record)
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
        balance: 0,
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

    // ជំហានទី ៧៖ បង្កើត Notification សារអញ្ជើញទៅកាន់ដៃគូ
    await Notification.create({
      userId: partner._id,
      username: partner.username,
      title: "ការអញ្ជើញចូលគណនីរួម (Joint Account)",
      message: `អ្នកត្រូវបានអញ្ជើញដោយ ${user.fullName || user.username} ឱ្យចូលរួមគណនីរួមលេខ: ${requestedNumber}។ សូមចូលទៅយល់ព្រម ឬបដិសេធ។`,
      date: getFormattedDate(),
      isRead: false,
      type: "info",
      metadata: {
        type: "joint_invite",
        ownerUsername: user.username,
        accountNumber: requestedNumber,
      },
    });

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

/**
 * ឆ្លើយតបទៅនឹងការអញ្ជើញ (Accept/Reject Joint Account Invitation)
 */
exports.respondToJointInvite = async (req, res) => {
  const { inviteeUsername, ownerUsername, accountNumber, action } = req.body;

  try {
    const owner = await User.findOne({ username: ownerUsername });
    const invitee = await User.findOne({ username: inviteeUsername });

    if (!owner || !invitee)
      return res.json({ success: false, message: "រកគណនីមិនឃើញទេ!" });

    const baseNumber = accountNumber.substring(0, 8);
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

    // =====================================
    // ករណីបដិសេធ (Reject)
    // =====================================
    if (action === "reject") {
      const pricePaid = linkedAccs[0].metadata?.pricePaid || 0;
      const refundAmount = pricePaid / 2;

      // សងប្រាក់វិញ ៥០% ទៅម្ចាស់ដើម (រចនាសម្ព័ន្ធថ្មី mainAccounts.USD)
      if (refundAmount > 0) {
        let superAdmin = await User.findOne({ username: "superadmin" });
        if (owner.mainAccounts?.USD) {
          owner.mainAccounts.USD.balance += refundAmount;
        } else {
          owner.balance += refundAmount;
        }

        if (superAdmin) {
          let targetFeeSub = superAdmin.subAccounts?.find(
            (sub) => sub.accountNumber === "888000999",
          );
          if (targetFeeSub) {
            targetFeeSub.balance -= refundAmount;
            superAdmin.markModified("subAccounts");
          } else if (superAdmin.mainAccounts?.USD) {
            superAdmin.mainAccounts.USD.balance -= refundAmount;
          } else {
            superAdmin.balance -= refundAmount;
          }
          await superAdmin.save();
        }

        const dateNow = getFormattedDate();
        const refId = generateStandardRefId("REF");
        const hash = generateStandardHash();

        await Transaction.create([
          {
            userId: owner._id,
            username: owner.username,
            refId,
            hash,
            date: dateNow,
            type: "Joint Account Refund",
            amount: refundAmount,
            currency: "USD",
            senderName: "System",
            receiverName: owner.fullName || owner.username,
            receiverAcc:
              owner.mainAccounts?.USD?.accountNumber || owner.accountNumber,
            remark: `Refund 50% for Rejected Joint Acc: ${accountNumber}`,
            status: "Success",
            trxMethod: "System Refund",
          },
          {
            userId: superAdmin?._id,
            username: superAdmin ? superAdmin.username : "superadmin",
            refId,
            hash,
            date: dateNow,
            type: "Joint Acc Refund Deducted",
            amount: -refundAmount,
            currency: "USD",
            senderName: "System",
            receiverName: owner.fullName || owner.username,
            senderAcc: "888000999",
            remark: `Refund 50% to ${owner.username}`,
            status: "Success",
            trxMethod: "System Refund",
          },
        ]);
      }

      // លុបទិន្នន័យគណនីរួម
      const accIdsToRemove = linkedAccs.map((a) => a.accountId);
      await JointAccount.deleteMany({ accountId: { $in: accIdsToRemove } });
      owner.subAccounts = owner.subAccounts.filter(
        (sa) => !accIdsToRemove.includes(sa.accountId),
      );

      // ជូនដំណឹងដល់ម្ចាស់ដើម
      await Notification.create({
        userId: owner._id,
        username: owner.username,
        title: "ការអញ្ជើញត្រូវបានបដិសេធ ❌",
        message: `${invitee.fullName || invitee.username} បានបដិសេធការអញ្ជើញរបស់អ្នក។ គណនីរួមលេខ ${accountNumber} ត្រូវបានលុបចោល ហើយទទួលបានលុយវិញ ៥០% ($${refundAmount})។`,
        date: getFormattedDate(),
        isRead: false,
        type: "info",
      });

      await owner.save();
      return res.json({
        success: true,
        message: "អ្នកបានបដិសេធ។ គណនីត្រូវបានលុប!",
      });
    }

    // =====================================
    // ករណីយល់ព្រម (Accept)
    // =====================================
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
          balance: la.balance,
        });
      }

      // ជូនដំណឹងដល់ម្ចាស់ដើមពីការយល់ព្រម
      await Notification.create({
        userId: owner._id,
        username: owner.username,
        title: "ការអញ្ជើញត្រូវបានយល់ព្រម ✅",
        message: `${invitee.fullName || invitee.username} បានយល់ព្រមចូលរួមគណនីរួម (${accountNumber}) របស់អ្នកហើយ។`,
        date: getFormattedDate(),
        isRead: false,
        type: "info",
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
