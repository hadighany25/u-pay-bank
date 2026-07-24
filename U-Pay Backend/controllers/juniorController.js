const User = require("../models/User");
const Transaction = require("../models/Transaction");
// លុបការទាញយក bcryptjs ចោល ព្រោះប្រព័ន្ធរបស់បងរក្សាទុក Password ជាអក្សរធម្មតា

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

    // ៣. ឆែកសមតុល្យលុយ (ដើម្បីកាត់ថ្លៃសេវា)
    if (parent.balance < price) {
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
        { accountNumber: requestedNumber },
        { accountNumberKHR: requestedNumber },
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
    // 🔥 កែចំណុចនេះ៖ រក្សាទុក Password ធម្មតា និងបន្ថែម ID/Date ដើម្បីកុំឱ្យមានបញ្ហាពេល Login
    const newJunior = new User({
      id: Date.now().toString(), // ទាមទារដោយ Model ដើម
      username: childUsername,
      password: childPassword, // 👈 មិនបាច់ Hash ទេ ព្រោះប្រព័ន្ធបងឆែក Password ធម្មតា
      fullName: childName,
      accountNumber: currencyOption === "KHR" ? null : primaryNumber,
      accountNumberKHR:
        currencyOption === "USD"
          ? null
          : currencyOption === "BOTH"
            ? secondaryNumber
            : primaryNumber,
      balance: 0,
      balanceKHR: 0,
      role: "junior", // សម្គាល់ថាជាគណនីកូន
      parentUsername: parent.username, // ភ្ជាប់ទៅកាន់ប៉ាម៉ាក់
      dailyLimit: dailyLimit,
      dailySpent: 0,
      isFrozen: false,
      joinDate: new Date().toISOString(),
      lastActive: new Date().toISOString(),
    });

    await newJunior.save();

    // ៧. កាត់លុយថ្លៃសេវាពីគណនីប៉ាម៉ាក់ និងកត់ត្រាប្រវត្តិ
    if (price > 0) {
      parent.balance -= price;
      const sharedHash = Math.random().toString(36).substring(2, 11);

      await Transaction.create({
        username: parent.username,
        refId: "JUN-" + Date.now().toString().slice(-6),
        hash: sharedHash,
        date: new Date().toLocaleString("en-US", {
          timeZone: "Asia/Phnom_Penh",
          hour12: true,
        }),
        type: "Junior Creation Fee",
        amount: -price,
        currency: "USD",
        senderName: parent.fullName || parent.username,
        receiverName: "U-Pay System",
        remark: `ថ្លៃសេវាបង្កើតគណនីកុមារ: ${childName}`,
        status: "Success",
      });
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

    // ២. ស្វែងរកគណនីកូនពិតប្រាកដ (Primary Account របស់កូន)
    const child = await User.findOne({
      accountNumber: childAccountNumber,
      role: "junior",
    });
    if (!child)
      return res
        .status(404)
        .json({ success: false, message: "រកមិនឃើញគណនីកូននេះទេ!" });

    // ៣. Update ស្ថានភាពក្នុងគណនីកូន
    child.isFrozen = isFrozen;
    await child.save();

    // ៤. Update ស្ថានភាពក្នុង subAccounts របស់ប៉ាម៉ាក់ ដើម្បីឱ្យ Frontend ឃើញភ្លាមៗ
    const subAccIndex = parent.subAccounts.findIndex(
      (acc) => acc.accountNumber === childAccountNumber,
    );
    if (subAccIndex !== -1) {
      parent.subAccounts[subAccIndex].isLocked = isFrozen;
      // ត្រូវប្រាប់ Mongoose ថាមានការប្រែប្រួលក្នុង Array បើមិនអញ្ចឹងវាមិន Save ទេ
      parent.markModified("subAccounts");
      await parent.save();
    }

    res.json({
      success: true,
      message: `គណនីកូនត្រូវបាន ${isFrozen ? "ផ្អាក" : "បើក"} ជោគជ័យ!`,
      user: parent, // បោះទិន្នន័យម៉ាក់ប៉ាថ្មីទៅ Frontend
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
      accountNumber: childAccountNumber,
      role: "junior",
    });
    if (!child)
      return res
        .status(404)
        .json({ success: false, message: "រកមិនឃើញគណនីកូននេះទេ!" });

    // ៣. Update លីមីតក្នុងគណនីកូន
    child.dailyLimit = Number(dailyLimit);
    await child.save();

    res.json({
      success: true,
      message: "កំណត់រនាំងចំណាយប្រចាំថ្ងៃជោគជ័យ!",
      // ត្រង់នេះយើងមិនចាំបាច់ Update ចូល subAccounts ក៏បាន ព្រោះ Frontend មិនទាន់ត្រូវការវាបន្ទាន់
    });
  } catch (error) {
    console.error("Update Limit Error:", error);
    res
      .status(500)
      .json({ success: false, message: "មានបញ្ហាបច្ចេកទេសលើ Server!" });
  }
};

// កុំភ្លេច Export មុខងារទាំង ២ នេះចេញ
module.exports = { createJuniorAccount, toggleFreeze, updateDailyLimit };
