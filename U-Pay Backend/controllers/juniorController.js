const User = require("../models/User");
const Transaction = require("../models/Transaction");
const bcrypt = require("bcryptjs");

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

    // ២. ផ្ទៀងផ្ទាត់ PIN របស់ប៉ាម៉ាក់ (កែមកប្រៀបធៀបផ្ទាល់បែបនេះវិញ)
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
    const hashedChildPassword = await bcrypt.hash(childPassword, 10);

    const newJunior = new User({
      username: childUsername,
      password: hashedChildPassword, // កូនប្រើ Password នេះដើម្បី Login ចូល App
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
      accountId: newJunior.username, // ទុក Username កូន ដើម្បីងាយស្រួលទាញទិន្នន័យ
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
      user: parent, // ផ្ញើទិន្នន័យ Parent ថ្មីដើម្បី Update Session
    });
  } catch (error) {
    console.error("Junior Creation Error:", error);
    res
      .status(500)
      .json({ success: false, message: "មានបញ្ហាបច្ចេកទេសលើ Server!" });
  }
};

module.exports = { createJuniorAccount };
