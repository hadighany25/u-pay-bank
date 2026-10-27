// ============================================================================
// ឯកសារ: controllers/accountController.js
// អត្ថន័យ: គ្រប់គ្រងមុខងារទាំងអស់ទាក់ទងនឹងគណនី (100% Pure _id Binding Only)
// ============================================================================

// 📦 ការនាំចូលម៉ូដែល និងសេវាកម្មចាំបាច់ (Dependencies)
const mongoose = require("mongoose");
const User = require("../models/User");
const Transaction = require("../models/Transaction");
const JointAccount = require("../models/JointAccount");
const Notification = require("../models/Notification");
const { getFormattedDate } = require("../services/helpers");

// ============================================================================
// ផ្នែកទី ១៖ 🛠️ មុខងារជំនួយ (Helper Functions & Business Logic)
// ============================================================================

/**
 * 🔹 បង្កើត Hash ស្ដង់ដារ (១០ ខ្ទង់ចៃដន្យរួមបញ្ចូលអក្សរ និងលេខ)
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
 * 🔹 បង្កើត Reference ID ស្ដង់ដារ (៨ ខ្ទង់ចៃដន្យជាមួយ Prefix)
 * @param {string} prefix - អក្សរកាត់ខាងមុខ (ឧ. "PRM", "JNT", "JUN")
 * @returns {string} ឧ. "PRM-12345678"
 */
const generateStandardRefId = (prefix) => {
  const random8Digits = Math.floor(10000000 + Math.random() * 90000000);
  return `${prefix}-${random8Digits}`;
};

/**
 * 🔹 គណនាតម្លៃសម្រាប់លេខគណនីពិសេស (Premium Account Pricing)
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

// ============================================================================
// ផ្នែកទី ២៖ 🧒 គ្រប់គ្រងគណនីកុមារ (Junior Accounts Management - 100% Pure _id)
// ============================================================================

/**
 * 🔹 ១. មុខងារបង្កើតគណនីកុមារពេញលេញ + បំបែករូប KYC (selfieUrl) និងរូប Profile (profileImage) ដាច់ពីគ្នា
 */
exports.createJuniorAccount = async (req, res) => {
  try {
    const {
      parentUserId,
      childName,
      childDob,
      childGender,
      birthCertNumber,
      birthCertUrl,
      childKycPhotoUrl,
      childPhotoUrl,
      childUsername,
      childPassword,
      childPin,
      dailyLimit,
      requestedNumber,
      price,
      pin,
      currencyOption,
    } = req.body;

    // 🆔 ចាប់យកប៉ាម៉ាក់តាម _id តែមួយគត់
    const targetParentId = parentUserId || req.user?._id || req.user?.id;
    const parent = await User.findById(targetParentId);
    if (!parent) {
      return res
        .status(404)
        .json({ success: false, message: "រកមិនឃើញគណនីអាណាព្យាបាលទេ!" });
    }

    if (parent.pin !== String(pin).trim()) {
      return res.status(400).json({
        success: false,
        message: "លេខកូដសម្ងាត់ PIN របស់ប៉ាម៉ាក់មិនត្រឹមត្រូវទេ!",
      });
    }

    // រូបថតមុខកូនពេលបង្កើតដំបូង៖ រក្សាទុកក្នុង selfieUrl (សម្រាប់ KYC ជានិច្ច) ហើយចម្លងដាក់ក្នុង profileImage សម្រាប់បង្ហាញក្នុង App សិន
    const kycFaceImg = String(childKycPhotoUrl || childPhotoUrl || "").trim();
    if (
      !childName ||
      !childDob ||
      !childGender ||
      !birthCertUrl ||
      !kycFaceImg
    ) {
      return res.status(400).json({
        success: false,
        message:
          "សូមបំពេញព័ត៌មានកូន ថ្ងៃខែឆ្នាំកំណើត និង Upload រូបថតសំបុត្រកំណើតព្រមទាំងរូបថតមុខកូន (KYC) ឱ្យបានគ្រប់គ្រាន់!",
      });
    }

    // គណនាតម្លៃលេខគណនីពិតប្រាកដតាមស្តង់ដារធនាគារ
    const actualPrice = calculatePremiumPrice(String(requestedNumber).trim());
    const parentUsdBal =
      parent.mainAccounts?.USD?.balance ?? parent.balance ?? 0;
    if (actualPrice > 0 && parentUsdBal < actualPrice) {
      return res.status(400).json({
        success: false,
        message:
          "សមតុល្យក្នុងគណនី USD របស់ប៉ាម៉ាក់មិនគ្រប់គ្រាន់សម្រាប់បង់ថ្លៃសេវាទេ!",
      });
    }

    const cleanChildUser = String(childUsername || "")
      .trim()
      .toLowerCase();
    // ឆែកកុំឱ្យបង្កើត Username ជាន់គ្នាពេលចុះឈ្មោះកូនថ្មី
    const existingUser = await User.findOne({ username: cleanChildUser });
    if (existingUser) {
      return res
        .status(400)
        .json({ success: false, message: "Username នេះមានអ្នកប្រើប្រាស់ហើយ!" });
    }

    const existingNum = await User.findOne({
      $or: [
        { "mainAccounts.USD.accountNumber": requestedNumber },
        { "mainAccounts.KHR.accountNumber": requestedNumber },
        { accountNumber: requestedNumber },
        { accountNumberKHR: requestedNumber },
        { "subAccounts.accountNumber": requestedNumber },
      ],
    });
    if (existingNum) {
      return res
        .status(400)
        .json({ success: false, message: "លេខគណនីនេះត្រូវបានគេយកបាត់ហើយ!" });
    }

    let primaryNumber = String(requestedNumber).trim();
    let secondaryNumber = null;
    if (currencyOption === "BOTH") {
      let lastDigit = parseInt(primaryNumber.slice(-1), 10);
      let newLastDigit = lastDigit === 9 ? 8 : lastDigit + 1;
      secondaryNumber = primaryNumber.slice(0, -1) + newLastDigit;
    }

    const tsId = Date.now().toString();
    const dateStr = new Date().toLocaleString("en-US", {
      timeZone: "Asia/Phnom_Penh",
      hour12: true,
    });

    // 🔒 បង្កើតគណនីកុមារ៖ ចងភ្ជាប់តាម parentId (_id) ដាច់ខាត
    const newJunior = new User({
      id: tsId,
      userId: Math.floor(10000000 + Math.random() * 90000000).toString(),
      username: cleanChildUser,
      password: childPassword,
      pin: childPin && /^\d{4}$/.test(childPin) ? childPin : "1234",
      fullName: String(childName).trim().toUpperCase(),
      dob: childDob,
      gender: childGender,
      idNumber: birthCertNumber
        ? `BC-${birthCertNumber.trim()}`
        : `JR-${tsId.slice(-6)}`,
      phone: parent.phone || "",
      email: parent.email || "",
      role: "junior",
      parentId: parent._id, // 🔗 សោរគោលភ្ជាប់ទៅ _id របស់ប៉ាម៉ាក់
      parentUserId: parent.userId || null,
      parentUsername: parent.username,

      // 🖼️ ១. រូបថត Profile សម្រាប់បង្ហាញក្នុងកម្មវិធី
      profileImage: kycFaceImg,

      // 🪪 ២. រូបថត KYC និងសំបុត្រកំណើត
      kycStatus: "pending",
      kycDocument: birthCertUrl,
      kycImage: birthCertUrl,
      selfieUrl: kycFaceImg,
      kycSubmittedAt: dateStr,
      kycUploadedBy: `អាណាព្យាបាល (@${parent.username})`,

      dailyLimit: Number(dailyLimit) || 20,
      dailySpent: 0,
      isFrozen: true, // 🔒 ផ្អាកសិន រហូតទាល់តែ Admin ចុច Approve KYC ទើបបើកអូតូ!
      joinDate: new Date().toISOString(),
      lastActive: new Date().toISOString(),

      mainAccounts: {
        ...(currencyOption !== "KHR" && {
          USD: {
            accountId: "MAIN_USD_" + tsId,
            accountNumber: primaryNumber,
            accountName: childName + " USD",
            accountType: "main",
            currency: "USD",
            balance: 0,
            dailyLimit: Number(dailyLimit) || 20,
            dailySpent: 0,
            isFrozen: true,
            isSystemLocked: true,
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
            dailyLimit: (Number(dailyLimit) || 20) * 4100,
            dailySpent: 0,
            isFrozen: true,
            isSystemLocked: true,
          },
        }),
      },
    });

    await newJunior.save();

    // កាត់លុយថ្លៃសេវាពីប៉ាម៉ាក់ចូលគណនីប្រមូលកម្រៃសេវារបស់ធនាគារកណ្តាល (888000999)
    let feeTrxRecord = null;
    if (actualPrice > 0) {
      let superAdmin = await User.findOne({
        "subAccounts.accountNumber": "888000999",
      });

      if (parent.mainAccounts?.USD) {
        parent.mainAccounts.USD.balance -= actualPrice;
        parent.markModified("mainAccounts");
      } else {
        parent.balance -= actualPrice;
      }

      let superAdminFeeAccId = "888000999";
      if (superAdmin) {
        let targetFeeSub = superAdmin.subAccounts?.find(
          (sub) => sub.accountNumber === "888000999",
        );
        if (targetFeeSub) {
          targetFeeSub.balance += actualPrice;
          superAdminFeeAccId = targetFeeSub.accountId || "888000999";
          superAdmin.markModified("subAccounts");
        } else if (superAdmin.mainAccounts?.USD) {
          superAdmin.mainAccounts.USD.balance += actualPrice;
          superAdminFeeAccId =
            superAdmin.mainAccounts.USD.accountId || "MAIN_USD";
          superAdmin.markModified("mainAccounts");
        }
        await superAdmin.save();
      }

      const sharedRefId = generateStandardRefId("JUN");
      const sharedHash = generateStandardHash();

      feeTrxRecord = {
        userId: parent._id,
        accountId: parent.mainAccounts?.USD?.accountId || "MAIN_USD",
        username: parent.username,
        refId: sharedRefId,
        hash: sharedHash,
        date: dateStr,
        type: "Junior Account Fee",
        amount: -actualPrice,
        currency: "USD",
        senderName: parent.fullName || parent.username,
        receiverName: "U-PAY Central Bank Fee",
        senderAcc:
          parent.mainAccounts?.USD?.accountNumber || parent.accountNumber,
        receiverAcc: "888000999",
        remark: `បើកគណនីកុមារឱ្យ ${childName} (#${primaryNumber})`,
        status: "Success",
        trxMethod: "Junior Onboarding",
      };

      await Transaction.create([
        feeTrxRecord,
        {
          userId: superAdmin?._id,
          accountId: superAdminFeeAccId,
          username: superAdmin ? superAdmin.username : "superadmin",
          refId: sharedRefId,
          hash: sharedHash,
          date: dateStr,
          type: "System Income",
          amount: actualPrice,
          currency: "USD",
          senderName: parent.fullName || parent.username,
          receiverName: "Central Bank Fee Income",
          senderAcc:
            parent.mainAccounts?.USD?.accountNumber || parent.accountNumber,
          receiverAcc: "888000999",
          remark: `Junior Creation Fee: ${childName} (#${primaryNumber})`,
          status: "Success",
          trxMethod: "System Receipt",
        },
      ]);
    }

    parent.subAccounts = parent.subAccounts || [];
    parent.subAccounts.push({
      accountId: String(newJunior._id), // 🔗 ប្រើ _id របស់កូនសុទ្ធសាធ
      linkedUserId: newJunior._id,
      linkedUserCustomId: newJunior.userId,
      accountNumber: primaryNumber,
      accountName: childName + " (Junior)",
      accountType: "junior",
      balance: 0,
      dailyLimit: Number(dailyLimit) || 20,
      isFrozen: true,
      currency: currencyOption === "KHR" ? "KHR" : "USD",
    });

    if (currencyOption === "BOTH" && secondaryNumber) {
      parent.subAccounts.push({
        accountId: String(newJunior._id) + "_khr", // 🔗 ប្រើ _id របស់កូនសុទ្ធសាធ
        linkedUserId: newJunior._id,
        linkedUserCustomId: newJunior.userId,
        accountNumber: secondaryNumber,
        accountName: childName + " (Junior KHR)",
        accountType: "junior",
        balance: 0,
        dailyLimit: (Number(dailyLimit) || 20) * 4100,
        isFrozen: true,
        currency: "KHR",
      });
    }

    parent.markModified("subAccounts");
    await parent.save();

    res.json({
      success: true,
      message:
        "បង្កើតគណនីកុមារជោគជ័យ! សំបុត្រកំណើតត្រូវបានបញ្ជូនទៅកាន់ Admin ដើម្បីពិនិត្យ និងអនុម័ត (Pending KYC Approval)។",
      secondNumber: secondaryNumber,
      transaction: feeTrxRecord,
      user: parent,
    });
  } catch (error) {
    console.error("Junior Creation Error:", error);
    res
      .status(500)
      .json({ success: false, message: "មានបញ្ហាបច្ចេកទេសលើ Server!" });
  }
};

/**
 * 🔹 ២. មុខងារ ផ្អាក ឬ បើកសោរគណនីកូន (Toggle Freeze - 100% Pure _id)
 */
exports.toggleFreeze = async (req, res) => {
  try {
    const { parentUserId, childUserId, childAccountNumber, pin, isFrozen } =
      req.body;

    const targetParentId = parentUserId || req.user?._id || req.user?.id;
    const parent = await User.findById(targetParentId);
    if (!parent)
      return res
        .status(404)
        .json({ success: false, message: "រកមិនឃើញគណនីមេ!" });
    if (parent.pin !== String(pin).trim())
      return res
        .status(400)
        .json({ success: false, message: "លេខសម្ងាត់ PIN មិនត្រឹមត្រូវទេ!" });

    const child = childUserId
      ? await User.findOne({ _id: childUserId, role: "junior" })
      : await User.findOne({
          parentId: parent._id,
          role: "junior",
          $or: [
            { "mainAccounts.USD.accountNumber": childAccountNumber },
            { "mainAccounts.KHR.accountNumber": childAccountNumber },
          ],
        });

    if (!child)
      return res
        .status(404)
        .json({ success: false, message: "រកមិនឃើញគណនីកូននេះទេ!" });

    // 🔒 ត្រួតពិនិត្យថា Admin បាន Approve សំបុត្រកំណើត (KYC) របស់កូនហើយឬនៅ
    if (child.kycStatus !== "verified" && child.kycStatus !== "approved") {
      return res.json({
        success: false,
        message:
          "⏳ គណនីកូនកំពុងរង់ចាំ Admin ពិនិត្យ និងអនុម័តសំបុត្រកំណើត (Pending KYC)! បន្ទាប់ពី Admin អនុម័តរួច គណនីកូននឹងបើកដំណើរការដោយស្វ័យប្រវត្តិ។",
      });
    }

    child.isFrozen = isFrozen;
    if (child.mainAccounts?.USD) {
      child.mainAccounts.USD.isFrozen = isFrozen;
      child.mainAccounts.USD.isSystemLocked = isFrozen;
    }
    if (child.mainAccounts?.KHR) {
      child.mainAccounts.KHR.isFrozen = isFrozen;
      child.mainAccounts.KHR.isSystemLocked = isFrozen;
    }
    child.markModified("mainAccounts");
    await child.save();

    parent.subAccounts.forEach((acc) => {
      if (
        (acc.linkedUserId && String(acc.linkedUserId) === String(child._id)) ||
        acc.accountNumber === childAccountNumber
      ) {
        acc.isLocked = isFrozen;
        acc.isFrozen = isFrozen;
      }
    });
    parent.markModified("subAccounts");
    await parent.save();

    res.json({
      success: true,
      message: `គណនីកូនត្រូវបាន ${isFrozen ? "ផ្អាក" : "បើកដំណើរការវិញ"} ជោគជ័យ!`,
      user: parent,
    });
  } catch (error) {
    console.error("Freeze Junior Error:", error);
    res
      .status(500)
      .json({ success: false, message: "មានបញ្ហាបច្ចេកទេសលើ Server!" });
  }
};

/**
 * 🔹 ៣. មុខងារ កំណត់រនាំងចំណាយប្រចាំថ្ងៃ (Update Daily Limit - 100% Pure _id)
 */
exports.updateDailyLimit = async (req, res) => {
  try {
    const { parentUserId, childUserId, childAccountNumber, pin, dailyLimit } =
      req.body;

    const targetParentId = parentUserId || req.user?._id || req.user?.id;
    const parent = await User.findById(targetParentId);
    if (!parent)
      return res
        .status(404)
        .json({ success: false, message: "រកមិនឃើញគណនីមេ!" });
    if (parent.pin !== String(pin).trim())
      return res
        .status(400)
        .json({ success: false, message: "លេខសម្ងាត់ PIN មិនត្រឹមត្រូវទេ!" });

    const child = childUserId
      ? await User.findOne({ _id: childUserId, role: "junior" })
      : await User.findOne({
          parentId: parent._id,
          role: "junior",
          $or: [
            { "mainAccounts.USD.accountNumber": childAccountNumber },
            { "mainAccounts.KHR.accountNumber": childAccountNumber },
          ],
        });

    if (!child)
      return res
        .status(404)
        .json({ success: false, message: "រកមិនឃើញគណនីកូននេះទេ!" });

    child.dailyLimit = Number(dailyLimit);
    if (child.mainAccounts?.USD) {
      child.mainAccounts.USD.dailyLimit = Number(dailyLimit);
      child.markModified("mainAccounts");
    }
    await child.save();

    parent.subAccounts.forEach((acc) => {
      if (
        (acc.linkedUserId && String(acc.linkedUserId) === String(child._id)) ||
        acc.accountNumber === childAccountNumber
      ) {
        acc.dailyLimit = Number(dailyLimit);
      }
    });
    parent.markModified("subAccounts");
    await parent.save();

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

/**
 * 🔹 ៤. មុខងារ ដាក់ប្រាក់ឱ្យកូន (Top-Up) ឬ ដកប្រាក់ពីកូនមកវិញ (Recall) ដោយប៉ាម៉ាក់ (100% Pure _id)
 */
exports.transferJuniorFunds = async (req, res) => {
  try {
    const {
      parentUserId,
      childUserId,
      direction,
      currency,
      amount,
      remark,
      pin,
    } = req.body;

    const cleanAmt = parseFloat(amount);
    if (!cleanAmt || cleanAmt <= 0) {
      return res.json({
        success: false,
        message: "សូមបញ្ចូលចំនួនទឹកប្រាក់ឱ្យបានត្រឹមត្រូវ!",
      });
    }

    const targetParentId = parentUserId || req.user?._id || req.user?.id;
    const parent = await User.findById(targetParentId);
    if (!parent) {
      return res.json({ success: false, message: "រកមិនឃើញគណនីប៉ាម៉ាក់ទេ!" });
    }
    if (parent.pin !== String(pin).trim()) {
      return res.json({
        success: false,
        message: "លេខកូដសម្ងាត់ PIN មិនត្រឹមត្រូវទេ!",
      });
    }

    const child = await User.findOne({ _id: childUserId, role: "junior" });
    if (!child) {
      return res.json({ success: false, message: "រកមិនឃើញគណនីកូននេះទេ!" });
    }

    // 🔒 ត្រួតពិនិត្យថា Admin បាន Approve សំបុត្រកំណើត (KYC) របស់កូនហើយឬនៅ
    if (child.kycStatus !== "verified" && child.kycStatus !== "approved") {
      return res.json({
        success: false,
        message:
          "⏳ គណនីកូនកំពុងរង់ចាំ Admin ពិនិត្យ និងអនុម័តសំបុត្រកំណើត (Pending KYC)! បន្ទាប់ពី Admin អនុម័តរួច ទើបអាចដាក់ប្រាក់ឱ្យកូនចាយបាន។",
      });
    }

    const cur = currency === "KHR" ? "KHR" : "USD";
    const parentAcc = parent.mainAccounts?.[cur];
    const childAcc = child.mainAccounts?.[cur];

    if (!parentAcc || !parentAcc.accountNumber) {
      return res.json({
        success: false,
        message: `ប៉ាម៉ាក់មិនមានគណនីគោល (${cur}) ទេ!`,
      });
    }
    if (!childAcc || !childAcc.accountNumber) {
      return res.json({
        success: false,
        message: `គណនីកូនមិនទាន់មានគណនី (${cur}) ទេ!`,
      });
    }

    const isTopUp = direction !== "RECALL";

    if (isTopUp) {
      if ((parentAcc.balance || 0) < cleanAmt) {
        return res.json({
          success: false,
          message: `សមតុល្យក្នុងគណនី (${cur}) របស់ប៉ាម៉ាក់មិនគ្រប់គ្រាន់ទេ!`,
        });
      }
      parent.mainAccounts[cur].balance -= cleanAmt;
      child.mainAccounts[cur].balance =
        (child.mainAccounts[cur].balance || 0) + cleanAmt;
    } else {
      if ((childAcc.balance || 0) < cleanAmt) {
        return res.json({
          success: false,
          message: `សមតុល្យក្នុងគណនី (${cur}) របស់កូនមិនគ្រប់គ្រាន់សម្រាប់ដកមកវិញទេ!`,
        });
      }
      child.mainAccounts[cur].balance -= cleanAmt;
      parent.mainAccounts[cur].balance =
        (parent.mainAccounts[cur].balance || 0) + cleanAmt;
    }

    if (Array.isArray(parent.subAccounts)) {
      const sIdx = parent.subAccounts.findIndex(
        (s) => s.accountNumber === childAcc.accountNumber,
      );
      if (sIdx !== -1) {
        parent.subAccounts[sIdx].balance = child.mainAccounts[cur].balance;
        parent.markModified("subAccounts");
      }
    }

    parent.markModified("mainAccounts");
    child.markModified("mainAccounts");
    await parent.save();
    await child.save();

    const refId = generateStandardRefId(isTopUp ? "JTP" : "JRC");
    const hash = generateStandardHash();
    const dateStr = new Date().toLocaleString("en-US", {
      timeZone: "Asia/Phnom_Penh",
      hour12: true,
    });

    const parentName = parent.fullName || parent.username;
    const childName = child.fullName || child.username;
    const sym = cur === "KHR" ? "៛" : "$";
    const fmtAmt =
      cur === "KHR" ? cleanAmt.toLocaleString() : cleanAmt.toFixed(2);

    const parentTrxDoc = {
      userId: parent._id,
      accountId: parentAcc.accountId || `MAIN_${cur}`,
      username: parent.username,
      refId,
      hash,
      date: dateStr,
      type: isTopUp ? "Junior Allowance Top-Up" : "Junior Fund Recall",
      amount: isTopUp ? -cleanAmt : cleanAmt,
      currency: cur,
      senderName: isTopUp ? parentName : childName,
      senderAcc: isTopUp ? parentAcc.accountNumber : childAcc.accountNumber,
      receiverName: isTopUp ? childName : parentName,
      receiverAcc: isTopUp ? childAcc.accountNumber : parentAcc.accountNumber,
      remark:
        remark ||
        (isTopUp
          ? `ដាក់ប្រាក់ឱ្យកូន (${childName})`
          : `ដកប្រាក់ពីគណនីកូន (${childName})`),
      status: "Success",
      trxMethod: "Junior Parental Control",
    };

    const childTrxDoc = {
      ...parentTrxDoc,
      userId: child._id,
      accountId: childAcc.accountId || `MAIN_${cur}`,
      username: child.username,
      type: isTopUp ? "Received from Parent" : "Recalled by Parent",
      amount: isTopUp ? cleanAmt : -cleanAmt,
    };

    await Transaction.create([parentTrxDoc, childTrxDoc]);

    await Notification.create({
      userId: child._id,
      username: child.username,
      title: isTopUp
        ? "ទទួលបានប្រាក់ឧបត្ថម្ភពីប៉ាម៉ាក់! 🎉"
        : "ប៉ាម៉ាក់បានដកប្រាក់ពីគណនី 🔄",
      message: isTopUp
        ? `ប៉ាម៉ាក់ (${parentName}) បានដាក់ប្រាក់ចំនួន +${sym}${fmtAmt} ចូលក្នុងគណនីរបស់កូន។ ${remark ? `ចំណាំ៖ "${remark}"` : ""}`
        : `ប៉ាម៉ាក់ (${parentName}) បានដកប្រាក់ចំនួន -${sym}${fmtAmt} ពីគណនីរបស់កូនត្រឡប់ទៅវិញ។`,
      date: dateStr,
      type: isTopUp ? "deposit" : "deduction",
      isRead: false,
    });

    res.json({
      success: true,
      message: isTopUp
        ? `បានដាក់ប្រាក់ ${sym}${fmtAmt} ចូលគណនីកូនដោយជោគជ័យ!`
        : `បានដកប្រាក់ ${sym}${fmtAmt} ពីគណនីកូនមកវិញដោយជោគជ័យ!`,
      transaction: parentTrxDoc,
      user: parent,
    });
  } catch (error) {
    console.error("Transfer Junior Funds Error:", error);
    res
      .status(500)
      .json({ success: false, message: "មានបញ្ហាបច្ចេកទេសលើ Server!" });
  }
};

/**
 * 🔹 ៥. មុខងារទាញយកទិន្នន័យគណនីកូនៗទាំងអស់សម្រាប់ប៉ាម៉ាក់ (100% Pure _id)
 */
exports.getJuniorAccountsDashboard = async (req, res) => {
  try {
    const targetParentId =
      req.user?._id || req.user?.id || req.query?.parentUserId;
    const parent = await User.findById(targetParentId).lean();
    if (!parent) {
      return res
        .status(404)
        .json({ success: false, message: "រកមិនឃើញគណនីអាណាព្យាបាលទេ!" });
    }

    const juniorLinkedIds = (parent.subAccounts || [])
      .filter(
        (s) =>
          s.accountType === "junior" &&
          s.linkedUserId &&
          mongoose.Types.ObjectId.isValid(String(s.linkedUserId)),
      )
      .map((s) => s.linkedUserId);

    const childrenDocs = await User.find({
      $or: [
        { parentId: parent._id, role: "junior" },
        { _id: { $in: juniorLinkedIds }, role: "junior" },
      ],
    })
      .select("-password")
      .lean();

    const childrenWithDetails = await Promise.all(
      childrenDocs.map(async (child) => {
        const usdAccObj = child.mainAccounts?.USD || null;
        const khrAccObj = child.mainAccounts?.KHR || null;

        // 🆔 ទាញប្រតិបត្តិការរបស់កូនតាម userId (_id) របស់កូនតែមួយគត់!
        const trxs = await Transaction.find({ userId: child._id })
          .sort({ _id: -1 })
          .limit(200)
          .lean();

        const todayStr = new Date().toDateString();
        let spentTodayUSD = 0;
        let spentMonthUSD = 0;
        let receivedFromParentUSD = 0;
        const now = new Date();

        const formattedTrxs = trxs.map((t) => {
          const isInc = Number(t.amount) > 0;
          const rawAmt = Math.abs(Number(t.amount || 0));
          const cur = t.currency === "KHR" ? "KHR" : "USD";
          const amtUSD = cur === "KHR" ? rawAmt / 4100 : rawAmt;
          const tDate = new Date(t.createdAt || t.date || Date.now());

          if (!isInc && t.status !== "Refunded") {
            if (tDate.toDateString() === todayStr) {
              spentTodayUSD += amtUSD;
            }
            if (
              tDate.getMonth() === now.getMonth() &&
              tDate.getFullYear() === now.getFullYear()
            ) {
              spentMonthUSD += amtUSD;
            }
          } else if (isInc) {
            receivedFromParentUSD += amtUSD;
          }

          return {
            _id: t._id,
            refId: t.refId || "N/A",
            hash: t.hash || "",
            date:
              t.date || new Date(t.createdAt || Date.now()).toLocaleString(),
            timestamp: tDate.getTime(),
            type: t.type || "Transaction",
            trxMethod: t.trxMethod || "U-PAY",
            isIncome: isInc,
            amount: rawAmt,
            currency: cur,
            amountUSD: Number(amtUSD.toFixed(2)),
            senderName: t.senderName || child.fullName,
            receiverName: t.receiverName || "Merchant/User",
            senderAcc: t.senderAcc || "",
            receiverAcc: t.receiverAcc || "",
            counterparty: isInc
              ? t.senderName || "ប៉ាម៉ាក់ (Parent)"
              : t.receiverName || "ហាងទំនិញ / មិត្តភក្តិ",
            remark: t.remark || "",
            status: t.status || "Success",
          };
        });

        const isOnlineNow = child.lastActive
          ? Date.now() - new Date(child.lastActive).getTime() < 120000
          : Boolean(child.isOnline);

        return {
          _id: child._id,
          username: child.username,
          fullName: child.fullName || child.username,
          dob: child.dob || "",
          gender: child.gender || "",
          idNumber: child.idNumber || "",
          // 🖼️ បំបែកដាច់ពីគ្នា៖ profileImage សម្រាប់បង្ហាញក្នុងកម្មវិធី និង selfieUrl សម្រាប់ KYC
          profileImage: child.profileImage || child.selfieUrl || "",
          kycSelfieUrl: child.selfieUrl || "",
          birthCertUrl: child.kycDocument || "",
          kycStatus: child.kycStatus || "verified",
          kycRejectReason: child.kycRejectReason || "",
          isFrozen: Boolean(
            child.isFrozen ||
            usdAccObj?.isSystemLocked ||
            khrAccObj?.isSystemLocked,
          ),
          isOnline: isOnlineNow,
          lastActive: child.lastActive || child.joinDate || "",
          dailyLimit: Number(usdAccObj?.dailyLimit ?? child.dailyLimit ?? 20),
          spentTodayUSD: Number(spentTodayUSD.toFixed(2)),
          spentMonthUSD: Number(spentMonthUSD.toFixed(2)),
          receivedFromParentUSD: Number(receivedFromParentUSD.toFixed(2)),
          accounts: {
            USD: usdAccObj
              ? {
                  accountNumber: usdAccObj.accountNumber,
                  balance: Number(usdAccObj.balance || 0),
                }
              : null,
            KHR: khrAccObj
              ? {
                  accountNumber: khrAccObj.accountNumber,
                  balance: Number(khrAccObj.balance || 0),
                }
              : null,
          },
          primaryAccountNumber:
            usdAccObj?.accountNumber ||
            khrAccObj?.accountNumber ||
            child.accountNumber ||
            "",
          transactions: formattedTrxs,
        };
      }),
    );

    res.json({
      success: true,
      parentAccounts: {
        USD: {
          accountNumber: parent.mainAccounts?.USD?.accountNumber || "",
          balance: Number(parent.mainAccounts?.USD?.balance || 0),
        },
        KHR: {
          accountNumber: parent.mainAccounts?.KHR?.accountNumber || "",
          balance: Number(parent.mainAccounts?.KHR?.balance || 0),
        },
      },
      children: childrenWithDetails,
    });
  } catch (error) {
    console.error("Get Junior Dashboard Error:", error);
    res
      .status(500)
      .json({ success: false, message: "មានបញ្ហាបច្ចេកទេសលើ Server!" });
  }
};

/**
 * 🔹 ៦. មុខងារ កែប្រែឈ្មោះ លេខសម្ងាត់ PIN ឬប្តូររូបថត Profile របស់កូន (100% Pure _id)
 */
exports.resetJuniorCredentials = async (req, res) => {
  try {
    const {
      parentUserId,
      childUserId,
      newPassword,
      newChildPin,
      newChildName,
      newProfileImage,
      pin,
    } = req.body;

    const targetParentId = parentUserId || req.user?._id || req.user?.id;
    const parent = await User.findById(targetParentId);
    if (!parent) {
      return res.json({ success: false, message: "រកមិនឃើញគណនីប៉ាម៉ាក់ទេ!" });
    }
    if (parent.pin !== String(pin).trim()) {
      return res.json({
        success: false,
        message: "លេខកូដសម្ងាត់ PIN របស់ប៉ាម៉ាក់មិនត្រឹមត្រូវទេ!",
      });
    }

    const child = await User.findOne({ _id: childUserId, role: "junior" });
    if (!child) {
      return res.json({ success: false, message: "រកមិនឃើញគណនីកូននេះទេ!" });
    }

    if (newChildName && String(newChildName).trim() !== "") {
      child.fullName = String(newChildName).trim().toUpperCase();
    }
    if (newPassword && String(newPassword).trim().length >= 4) {
      child.password = String(newPassword).trim();
    }
    if (newChildPin && /^\d{4}$/.test(String(newChildPin).trim())) {
      child.pin = String(newChildPin).trim();
    }
    // 🖼️ ប្តូរតែរូបថត Profile (profileImage) ប៉ុណ្ណោះ រីឯរូបថត KYC (selfieUrl) រក្សាទុកដដែលក្នុង Database!
    if (newProfileImage && String(newProfileImage).trim() !== "") {
      child.profileImage = String(newProfileImage).trim();
    }

    await child.save();

    res.json({
      success: true,
      message: "ព័ត៌មានគណនីកូនត្រូវបានធ្វើបច្ចុប្បន្នភាពដោយជោគជ័យ!",
    });
  } catch (error) {
    console.error("Reset Junior Credentials Error:", error);
    res
      .status(500)
      .json({ success: false, message: "មានបញ្ហាបច្ចេកទេសលើ Server!" });
  }
};

// ============================================================================
// ផ្នែកទី ៣៖ 🌟 គ្រប់គ្រងគណនីលំដាប់ខ្ពស់ (Premium Accounts Management - 100% Pure _id)
// ============================================================================

/**
 * 🔹 បង្កើតគណនី Premium ថ្មី (Create Premium Account)
 */
exports.createPremiumAccount = async (req, res) => {
  const { userId, requestedNumber, accountName, price, pin, currencyOption } =
    req.body;

  try {
    // ជំហានទី ១៖ ផ្ទៀងផ្ទាត់អ្នកប្រើប្រាស់តាម _id តែមួយគត់ និង PIN
    const targetUserId = userId || req.user?._id || req.user?.id;
    const user = await User.findById(targetUserId);
    if (!user) return res.json({ success: false, message: "រកគណនីមិនឃើញទេ!" });
    if (user.pin !== pin)
      return res.json({ success: false, message: "លេខ PIN មិនត្រឹមត្រូវ!" });

    // ជំហានទី ២៖ ឆែកមើលភាពទំនេរនៃលេខគណនីទី១
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

    // ជំហានទី ៤៖ ផ្ទៀងផ្ទាត់តម្លៃ និងសមតុល្យ
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
      let superAdmin = await User.findOne({
        "subAccounts.accountNumber": "888000999",
      });

      if (user.mainAccounts?.USD) {
        user.mainAccounts.USD.balance -= actualPrice;
        user.markModified("mainAccounts");
      } else {
        user.balance -= actualPrice;
      }

      let superAdminFeeAccId = "888000999";
      if (superAdmin) {
        let targetFeeSub = superAdmin.subAccounts?.find(
          (sub) => sub.accountNumber === "888000999",
        );
        if (targetFeeSub) {
          targetFeeSub.balance += actualPrice;
          superAdminFeeAccId = targetFeeSub.accountId || "888000999";
          superAdmin.markModified("subAccounts");
        } else if (superAdmin.mainAccounts?.USD) {
          superAdmin.mainAccounts.USD.balance += actualPrice;
          superAdminFeeAccId =
            superAdmin.mainAccounts.USD.accountId || "MAIN_USD";
          superAdmin.markModified("mainAccounts");
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
          accountId: user.mainAccounts?.USD?.accountId || "MAIN_USD",
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
          accountId: superAdminFeeAccId,
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
          remark: `Sold Acc No: ${requestedNumber}`,
          status: "Success",
          trxMethod: "System Receipt",
        },
      ]);
    }

    // ជំហានទី ៦៖ បង្កើតគណនីរង (Sub Accounts) បញ្ចូលទៅកាន់អ្នកប្រើប្រាស់
    const baseAccountId = "SUB_" + Date.now().toString();

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
    user.markModified("subAccounts");
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
 * 🔹 ទាញយកបញ្ជីលេខណែនាំពិសេសៗ (Get Suggested Premium Numbers)
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

    // ជំហានទី ២៖ ឆែកមើលលេខដែលមានអ្នកប្រើប្រាស់រួចហើយ
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
 * 🔹 ត្រួតពិនិត្យភាពទំនេរនៃលេខគណនី (Check Availability)
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

// ============================================================================
// ផ្នែកទី ៤៖ 🤝 គ្រប់គ្រងគណនីរួម (Joint Accounts Management - 100% Pure _id)
// ============================================================================

/**
 * 🔹 ស្វែងរកគណនីដៃគូសម្រាប់អញ្ជើញ (Search User for Joint Account -> ត្រឡប់ _id ទៅវិញ)
 */
exports.searchUserForJoint = async (req, res) => {
  try {
    const { identifier } = req.params;
    const clean = String(identifier || "")
      .replace(/^@/, "")
      .trim();

    const orConds = [
      { username: clean },
      { phone: clean },
      { userId: clean },
      { "mainAccounts.USD.accountNumber": clean },
      { "mainAccounts.KHR.accountNumber": clean },
      { accountNumber: clean },
      { accountNumberKHR: clean },
    ];
    if (mongoose.Types.ObjectId.isValid(clean)) {
      orConds.unshift({ _id: clean });
    }

    const user = await User.findOne({ $or: orConds }).select(
      "_id username fullName profileImage",
    );

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
 * 🔹 បង្កើតគណនីរួម និងបញ្ជូនការអញ្ជើញ (Create Joint Account & Invite - 100% Pure _id)
 */
exports.createJointAccount = async (req, res) => {
  const {
    userId,
    partnerUserId,
    requestedNumber,
    price,
    pin,
    currencyOption,
    dailyLimit,
  } = req.body;

  try {
    // ជំហានទី ១៖ ផ្ទៀងផ្ទាត់ម្ចាស់គណនី និងដៃគូតាម _id តែមួយគត់!
    const targetOwnerId = userId || req.user?._id || req.user?.id;
    const user = await User.findById(targetOwnerId);
    if (!user || user.pin !== pin)
      return res.json({ success: false, message: "គណនី ឬ PIN មិនត្រឹមត្រូវ!" });

    const partner = await User.findById(partnerUserId);
    if (!partner)
      return res.json({ success: false, message: "រកគណនីដៃគូមិនឃើញទេ!" });
    if (String(partner._id) === String(user._id))
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

    // ជំហានទី ៤៖ ផ្ទៀងផ្ទាត់តម្លៃ និងសមតុល្យ
    const actualPrice = calculatePremiumPrice(requestedNumber);
    if (price !== actualPrice)
      return res.json({ success: false, message: "តម្លៃមិនត្រឹមត្រូវ!" });

    const userUsdBal = user.mainAccounts?.USD?.balance || user.balance || 0;
    if (actualPrice > 0 && userUsdBal < actualPrice)
      return res.json({ success: false, message: "សមតុល្យមិនគ្រប់គ្រាន់ទេ!" });

    // ជំហានទី ៥៖ កាត់ប្រាក់ និងកត់ត្រាប្រតិបត្តិការ (ប្រសិនបើមានតម្លៃ)
    if (actualPrice > 0) {
      let superAdmin = await User.findOne({
        "subAccounts.accountNumber": "888000999",
      });

      if (user.mainAccounts?.USD) {
        user.mainAccounts.USD.balance -= actualPrice;
        user.markModified("mainAccounts");
      } else {
        user.balance -= actualPrice;
      }

      let superAdminFeeAccId = "888000999";
      if (superAdmin) {
        let targetFeeSub = superAdmin.subAccounts?.find(
          (sub) => sub.accountNumber === "888000999",
        );
        if (targetFeeSub) {
          targetFeeSub.balance += actualPrice;
          superAdminFeeAccId = targetFeeSub.accountId || "888000999";
          superAdmin.markModified("subAccounts");
        } else if (superAdmin.mainAccounts?.USD) {
          superAdmin.mainAccounts.USD.balance += actualPrice;
          superAdminFeeAccId =
            superAdmin.mainAccounts.USD.accountId || "MAIN_USD";
          superAdmin.markModified("mainAccounts");
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
          accountId: user.mainAccounts?.USD?.accountId || "MAIN_USD",
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
          trxMethod: "U-PAY System",
        },
        {
          userId: superAdmin?._id,
          accountId: superAdminFeeAccId,
          username: superAdmin ? superAdmin.username : "superadmin",
          refId,
          hash,
          date: dateNow,
          type: "U-PAY System",
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

    // ជំហានទី ៦៖ បង្កើតទិន្នន័យ Joint Account (ចងតាម userId _id សុទ្ធសាធ)
    const jointAccountName = `${(user.fullName || user.username).toUpperCase()} AND ${(partner.fullName || partner.username).toUpperCase()}`;
    const baseAccountId = "JNT_" + Date.now().toString();

    const createJointRecord = async (accountId, accNum, suffix, curr) => {
      await JointAccount.create({
        accountId: accountId,
        accountNumber: accNum,
        accountName: jointAccountName + suffix,
        ownerId: user._id, // 🔗 _id របស់ម្ចាស់ដើម
        balance: 0,
        currency: curr,
        members: [
          {
            userId: user._id, // 🔗 _id របស់ម្ចាស់ដើម
            username: user.username,
            fullName: user.fullName || user.username,
            role: "owner",
            status: "active",
          },
          {
            userId: partner._id, // 🔗 _id របស់ដៃគូ
            username: partner.username,
            fullName: partner.fullName || partner.username,
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

    // ជំហានទី ៧៖ បង្កើត Notification សារអញ្ជើញទៅកាន់ដៃគូតាម _id
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
        ownerId: String(user._id),
        ownerUsername: user.username,
        accountNumber: requestedNumber,
      },
    });

    user.markModified("subAccounts");
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
 * 🔹 ឆ្លើយតបទៅនឹងការអញ្ជើញ (Accept/Reject Joint Account Invitation - 100% Pure _id)
 */
exports.respondToJointInvite = async (req, res) => {
  const { inviteeUserId, ownerUserId, accountNumber, action } = req.body;

  try {
    const targetInviteeId = inviteeUserId || req.user?._id || req.user?.id;
    const invitee = await User.findById(targetInviteeId);
    if (!invitee)
      return res.json({ success: false, message: "រកគណនីអ្នកទទួលមិនឃើញទេ!" });

    const baseNumber = accountNumber.substring(0, 8);
    const linkedAccs = await JointAccount.find({
      accountNumber: new RegExp("^" + baseNumber),
      "members.userId": invitee._id,
      "members.status": "pending",
    });

    if (linkedAccs.length === 0) {
      return res.json({
        success: false,
        message: "រកគណនីរួមនេះមិនឃើញទេ ឬត្រូវបានលុបបាត់ហើយ!",
      });
    }

    const resolvedOwnerId = ownerUserId || linkedAccs[0].ownerId;
    const owner = await User.findById(resolvedOwnerId);
    if (!owner)
      return res.json({ success: false, message: "រកគណនីម្ចាស់ដើមមិនឃើញទេ!" });

    // =====================================
    // ករណីបដិសេធ (Reject)
    // =====================================
    if (action === "reject") {
      const pricePaid = linkedAccs[0].metadata?.pricePaid || 0;
      const refundAmount = pricePaid / 2;

      if (refundAmount > 0) {
        let superAdmin = await User.findOne({
          "subAccounts.accountNumber": "888000999",
        });
        if (owner.mainAccounts?.USD) {
          owner.mainAccounts.USD.balance += refundAmount;
          owner.markModified("mainAccounts");
        } else {
          owner.balance += refundAmount;
        }

        let superAdminFeeAccId = "888000999";
        if (superAdmin) {
          let targetFeeSub = superAdmin.subAccounts?.find(
            (sub) => sub.accountNumber === "888000999",
          );
          if (targetFeeSub) {
            targetFeeSub.balance -= refundAmount;
            superAdminFeeAccId = targetFeeSub.accountId || "888000999";
            superAdmin.markModified("subAccounts");
          } else if (superAdmin.mainAccounts?.USD) {
            superAdmin.mainAccounts.USD.balance -= refundAmount;
            superAdminFeeAccId =
              superAdmin.mainAccounts.USD.accountId || "MAIN_USD";
            superAdmin.markModified("mainAccounts");
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
            accountId: owner.mainAccounts?.USD?.accountId || "MAIN_USD",
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
            accountId: superAdminFeeAccId,
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
      owner.markModified("subAccounts");

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
        let mIdx = la.members.findIndex(
          (m) => String(m.userId) === String(invitee._id),
        );
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

      owner.markModified("subAccounts");
      invitee.markModified("subAccounts");
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
