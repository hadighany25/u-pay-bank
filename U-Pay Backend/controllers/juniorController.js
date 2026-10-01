// juniorController.js
const User = require("../models/User");
const Transaction = require("../models/Transaction");

// ========================================================
// 🛠️ Function ជំនួយ (Helpers) សម្រាប់បង្កើត Hash & Ref ID
// ========================================================
const generateStandardHash = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 10; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const generateStandardRefId = (prefix) => {
  // បង្កើតលេខ ៨ខ្ទង់ចៃដន្យ (ពី 10000000 ដល់ 99999999)
  const random8Digits = Math.floor(10000000 + Math.random() * 90000000);
  return `${prefix}-${random8Digits}`;
};

// ========================================================
// 🧒 មុខងារបង្កើតគណនីកុមារ (Create Junior Account)
// ========================================================
const createJuniorAccount = async (req, res) => {
  try {
    const {
      parentUsername,
      childName,
      childUsername,
      childPassword,
      dailyLimit,
      requestedNumber,
      price,
      pin,
      currencyOption,
    } = req.body;

    // ១. ផ្ទៀងផ្ទាត់អាណាព្យាបាល (Parent)
    const parent = await User.findOne({ username: parentUsername });
    if (!parent)
      return res
        .status(404)
        .json({ success: false, message: "រកមិនឃើញគណនីមេ!" });

    // ២. ផ្ទៀងផ្ទាត់ PIN របស់ប៉ាម៉ាក់ (ប្រៀបធៀបផ្ទាល់)
    if (parent.pin !== pin) {
      return res.status(400).json({
        success: false,
        message: "លេខសម្ងាត់ PIN មិនត្រឹមត្រូវ!",
      });
    }

    // ៣. ឆែកសមតុល្យលុយតាមរចនាសម្ព័ន្ធថ្មី (mainAccounts.USD.balance)
    const parentUsdBal =
      parent.mainAccounts?.USD?.balance || parent.balance || 0;
    if (parentUsdBal < price) {
      return res.status(400).json({
        success: false,
        message: "សមតុល្យមិនគ្រប់គ្រាន់សម្រាប់ការបង្កើតគណនីទេ!",
      });
    }

    // ៤. ឆែកមើលក្រែងលោ Username ឬ លេខគណនីកូន ជាន់គ្នាជាមួយអ្នកផ្សេង
    const existingUser = await User.findOne({ username: childUsername });
    if (existingUser)
      return res
        .status(400)
        .json({ success: false, message: "Username នេះមានអ្នកប្រើប្រាស់ហើយ!" });

    const existingNum = await User.findOne({
      $or: [
        { "mainAccounts.USD.accountNumber": requestedNumber },
        { "mainAccounts.KHR.accountNumber": requestedNumber },
        { accountNumber: requestedNumber },
        { accountNumberKHR: requestedNumber },
        { "subAccounts.accountNumber": requestedNumber },
      ],
    });
    if (existingNum)
      return res
        .status(400)
        .json({ success: false, message: "លេខគណនីនេះត្រូវបានគេយកបាត់ហើយ!" });

    // ៥. កំណត់លេខគណនីទី២ (បើ Parent ជ្រើសរើសយក 'BOTH')
    let primaryNumber = requestedNumber;
    let secondaryNumber = null;
    if (currencyOption === "BOTH") {
      let lastDigit = parseInt(primaryNumber.slice(-1));
      let newLastDigit = lastDigit === 9 ? 8 : lastDigit + 1;
      secondaryNumber = primaryNumber.slice(0, -1) + newLastDigit;
    }

    // ៦. 🔒 បង្កើតគណនីកុមារ (Shadow User)
    const tsId = Date.now().toString();
    const newJunior = new User({
      id: tsId,
      username: childUsername,
      password: childPassword,
      fullName: childName,
      role: "junior",
      parentUsername: parent.username,
      dailyLimit: dailyLimit,
      dailySpent: 0,
      isFrozen: false,
      joinDate: new Date().toISOString(),
      lastActive: new Date().toISOString(),

      // រចនាសម្ព័ន្ធ Main Accounts ថ្មីសម្រាប់កូន (បើកតាមជម្រើស)
      mainAccounts: {
        ...(currencyOption !== "KHR" && {
          USD: {
            accountId: "MAIN_USD_" + tsId,
            accountNumber: primaryNumber,
            accountName: childName + " USD",
            accountType: "main",
            currency: "USD",
            balance: 0,
            dailyLimit: dailyLimit,
            dailySpent: 0,
          },
        }),
        ...(currencyOption !== "USD" && {
          KHR: {
            accountId: "MAIN_KHR_" + tsId,
            accountNumber:
              currencyOption === "BOTH" ? secondaryNumber : primaryNumber,
            accountName: childName + " KHR",
            accountType: "main",
            currency: "KHR",
            balance: 0,
            dailyLimit: 0,
            dailySpent: 0,
          },
        }),
      },
    });

    await newJunior.save();

    // ៧. កាត់លុយថ្លៃសេវាពីគណនីប៉ាម៉ាក់ និងបញ្ជូនចូល Sub-Account Fee (888000999) របស់ធនាគារកណ្តាល
    if (price > 0) {
      let superAdmin = await User.findOne({ username: "superadmin" });

      if (parent.mainAccounts?.USD) {
        parent.mainAccounts.USD.balance -= price;
      } else {
        parent.balance -= price;
      }

      if (superAdmin) {
        let targetFeeSub = superAdmin.subAccounts?.find(
          (sub) => sub.accountNumber === "888000999",
        );
        if (targetFeeSub) {
          targetFeeSub.balance += price;
          superAdmin.markModified("subAccounts");
        } else if (superAdmin.mainAccounts?.USD) {
          superAdmin.mainAccounts.USD.balance += price;
        } else {
          superAdmin.balance += price;
        }
        await superAdmin.save();
      }

      const sharedRefId = generateStandardRefId("JUN");
      const sharedHash = generateStandardHash();
      const dateStr = new Date().toLocaleString("en-US", {
        timeZone: "Asia/Phnom_Penh",
        hour12: true,
      });

      await Transaction.create([
        {
          userId: parent._id,
          username: parent.username,
          refId: sharedRefId,
          hash: sharedHash,
          date: dateStr,
          type: "Junior Creation Fee",
          amount: -price,
          currency: "USD",
          senderName: parent.fullName || parent.username,
          receiverName: "Central Bank Fee Income",
          senderAcc:
            parent.mainAccounts?.USD?.accountNumber || parent.accountNumber,
          receiverAcc: "888000999",
          remark: `ថ្លៃសេវាបង្កើតគណនីកុមារ: ${childName}`,
          status: "Success",
        },
        {
          userId: superAdmin?._id,
          username: superAdmin ? superAdmin.username : "superadmin",
          refId: sharedRefId,
          hash: sharedHash,
          date: dateStr,
          type: "System Income",
          amount: price,
          currency: "USD",
          senderName: parent.fullName || parent.username,
          receiverName: "Central Bank Fee Income",
          receiverAcc: "888000999",
          remark: `Junior Creation Fee: ${childName}`,
          status: "Success",
        },
      ]);
    }

    // ៨. ភ្ជាប់គណនីកូនចូលទៅក្នុង Dropdown `subAccounts` របស់ប៉ាម៉ាក់
    parent.subAccounts = parent.subAccounts || [];
    parent.subAccounts.push({
      accountId: newJunior.username,
      accountNumber: primaryNumber,
      accountName: childName + " (Junior)",
      accountType: "junior",
      balance: 0,
      currency: currencyOption === "KHR" ? "KHR" : "USD",
    });

    if (currencyOption === "BOTH" && secondNumber) {
      parent.subAccounts.push({
        accountId: newJunior.username + "_khr",
        accountNumber: secondaryNumber,
        accountName: childName + " (Junior KHR)",
        accountType: "junior",
        balance: 0,
        currency: "KHR",
      });
    }

    await parent.save();

    // ៩. ជោគជ័យ! បោះទិន្នន័យត្រឡប់ទៅ Frontend វិញ
    res.json({
      success: true,
      message: "គណនីកុមារត្រូវបានបង្កើតជោគជ័យ!",
      secondNumber: secondaryNumber,
      user: parent,
    });
  } catch (error) {
    console.error("Junior Creation Error:", error);
    res
      .status(500)
      .json({ success: false, message: "មានបញ្ហាបច្ចេកទេសលើ Server!" });
  }
};

// ==========================================
// 🔒 មុខងារ ផ្អាក ឬ បើកសោរគណនីកូន (Toggle Freeze)
// ==========================================
const toggleFreeze = async (req, res) => {
  try {
    const { parentUsername, childAccountNumber, pin, isFrozen } = req.body;

    // ១. ផ្ទៀងផ្ទាត់អាណាព្យាបាល និង PIN
    const parent = await User.findOne({ username: parentUsername });
    if (!parent)
      return res
        .status(404)
        .json({ success: false, message: "រកមិនឃើញគណនីមេ!" });
    if (parent.pin !== pin)
      return res
        .status(400)
        .json({ success: false, message: "លេខសម្ងាត់ PIN មិនត្រឹមត្រូវទេ!" });

    // ២. ស្វែងរកគណនីកូនពិតប្រាកដ (តាមរចនាសម្ព័ន្ធថ្មី)
    const child = await User.findOne({
      $or: [
        { "mainAccounts.USD.accountNumber": childAccountNumber },
        { "mainAccounts.KHR.accountNumber": childAccountNumber },
        { accountNumber: childAccountNumber },
      ],
      role: "junior",
    });
    if (!child)
      return res
        .status(404)
        .json({ success: false, message: "រកមិនឃើញគណនីកូននេះទេ!" });

    // ៣. Update ស្ថានភាពក្នុងគណនីកូន
    child.isFrozen = isFrozen;
    if (child.mainAccounts?.USD)
      child.mainAccounts.USD.isSystemLocked = isFrozen;
    if (child.mainAccounts?.KHR)
      child.mainAccounts.KHR.isSystemLocked = isFrozen;
    await child.save();

    // ៤. Update ស្ថានភាពក្នុង subAccounts របស់ប៉ាម៉ាក់ ដើម្បីឱ្យ Frontend ឃើញភ្លាមៗ
    const subAccIndex = parent.subAccounts.findIndex(
      (acc) => acc.accountNumber === childAccountNumber,
    );
    if (subAccIndex !== -1) {
      parent.subAccounts[subAccIndex].isLocked = isFrozen;
      parent.markModified("subAccounts");
      await parent.save();
    }

    res.json({
      success: true,
      message: `គណនីកូនត្រូវបាន ${isFrozen ? "ផ្អាក" : "បើក"} ជោគជ័យ!`,
      user: parent,
    });
  } catch (error) {
    console.error("Freeze Junior Error:", error);
    res
      .status(500)
      .json({ success: false, message: "មានបញ្ហាបច្ចេកទេសលើ Server!" });
  }
};

// ==========================================
// 📊 មុខងារ កំណត់រនាំងចំណាយប្រចាំថ្ងៃ (Update Daily Limit)
// ==========================================
const updateDailyLimit = async (req, res) => {
  try {
    const { parentUsername, childAccountNumber, pin, dailyLimit } = req.body;

    // ១. ផ្ទៀងផ្ទាត់អាណាព្យាបាល និង PIN
    const parent = await User.findOne({ username: parentUsername });
    if (!parent)
      return res
        .status(404)
        .json({ success: false, message: "រកមិនឃើញគណនីមេ!" });
    if (parent.pin !== pin)
      return res
        .status(400)
        .json({ success: false, message: "លេខសម្ងាត់ PIN មិនត្រឹមត្រូវទេ!" });

    // ២. ស្វែងរកគណនីកូន
    const child = await User.findOne({
      $or: [
        { "mainAccounts.USD.accountNumber": childAccountNumber },
        { "mainAccounts.KHR.accountNumber": childAccountNumber },
        { accountNumber: childAccountNumber },
      ],
      role: "junior",
    });
    if (!child)
      return res
        .status(404)
        .json({ success: false, message: "រកមិនឃើញគណនីកូននេះទេ!" });

    // ៣. Update លីមីតក្នុងគណនីកូនផ្ទាល់
    child.dailyLimit = Number(dailyLimit);
    if (child.mainAccounts?.USD)
      child.mainAccounts.USD.dailyLimit = Number(dailyLimit);
    await child.save();

    // ៤. Update លីមីតក្នុង subAccounts របស់ប៉ាម៉ាក់ ដើម្បីឱ្យ UI ស្គាល់
    const subAccIndex = parent.subAccounts.findIndex(
      (acc) => acc.accountNumber === childAccountNumber,
    );
    if (subAccIndex !== -1) {
      parent.subAccounts[subAccIndex].dailyLimit = Number(dailyLimit);
      parent.markModified("subAccounts");
      await parent.save();
    }

    res.json({
      success: true,
      message: "កំណត់រនាំងចំណាយប្រចាំថ្ងៃជោគជ័យ!",
      user: parent,
    });
  } catch (error) {
    console.error("Update Limit Error:", error);
    res
      .status(500)
      .json({ success: false, message: "មានបញ្ហាបច្ចេកទេសលើ Server!" });
  }
};

// កុំភ្លេច Export មុខងារទាំងនេះចេញ
module.exports = { createJuniorAccount, toggleFreeze, updateDailyLimit };
