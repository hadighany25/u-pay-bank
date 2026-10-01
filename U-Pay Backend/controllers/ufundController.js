// controllers/ufundController.js

/**
 * ============================================================================
 * 🏦 U-FUND CONTROLLER (CENTRAL BRAIN)
 * ============================================================================
 * តួនាទី (Role): ឯកសារនេះគឺជាខួរក្បាលស្នូលសម្រាប់គ្រប់គ្រងប្រព័ន្ធសន្សំ U-Fund។
 * វាទទួលបន្ទុកលើការបង្កើតគម្រោង ដាក់ប្រាក់ (Manual & QR Scan) ចេញលុយជួស (Bailout)
 * អញ្ជើញសមាជិក ការគ្រប់គ្រងបំណុលទ្វេភាគ (P2P Debt) និងដំណើរការបិទ/រំសាយគម្រោង។
 * ============================================================================
 */

// ==========================================
// 📦 ផ្នែកទី ០៖ នាំចូលម៉ូឌុល និងមុខងារជំនួយ (Imports & Helpers)
// ==========================================
const mongoose = require("mongoose");
const User = require("../models/User");
const UFund = require("../models/UFund");
const Transaction = require("../models/Transaction");
const Notification = require("../models/Notification");
const crypto = require("crypto");

const { getFormattedDate } = require("../services/helpers");

// មុខងារបង្កើត Hash ស្តង់ដារសម្រាប់ការពារប្រតិបត្តិការ
const generateStandardHash = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 10; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// មុខងារបង្កើតលេខយោង (Trx ID) ដែលមិនជាន់គ្នា
const generateStandardRefId = (prefix) => {
  const random8Digits = Math.floor(10000000 + Math.random() * 90000000);
  return `${prefix}-${random8Digits}`;
};

/**
 * ============================================================================
 * 📋 ផ្នែកទី ១៖ ការទាញយកទិន្នន័យគម្រោង (FUND FETCHING)
 * ============================================================================
 */

// ---------------------------------------------------------
// ១. ទាញយកបញ្ជី U-Fund (Get My Funds)
// តួនាទី៖ បាញ់បញ្ជីគម្រោងទាំងអស់ដែល User នេះជាសមាជិក ទៅឱ្យ Frontend រួមទាំង Auto-Sync រូប Profile
// ---------------------------------------------------------
exports.getMyFunds = async (req, res) => {
  const { username } = req.body;
  try {
    let funds = await UFund.find({ "members.username": username }).sort({
      createdAt: -1,
    });

    for (let fund of funds) {
      let isModified = false;
      for (let member of fund.members) {
        const u = await User.findOne({ username: member.username }).select(
          "profileImage",
        );
        if (
          u &&
          u.profileImage !== undefined &&
          u.profileImage !== member.profileImage
        ) {
          member.profileImage = u.profileImage;
          isModified = true;
        }
      }
      if (isModified) {
        fund.markModified("members");
        await fund.save();
      }
    }

    funds = funds.filter((fund) => {
      const member = fund.members.find((m) => m.username === username);
      return member && member.status !== "pending";
    });

    res.json({ success: true, funds });
  } catch (error) {
    console.error("Get Funds Error:", error);
    res.json({
      success: false,
      message: "បរាជ័យក្នុងការទាញយកទិន្នន័យពី Server",
    });
  }
};

/**
 * ============================================================================
 * 🏗️ ផ្នែកទី ២៖ ការបង្កើត និងកែប្រែគម្រោង (CREATION & SETTINGS)
 * ============================================================================
 */

// ---------------------------------------------------------
// ២. បង្កើត U-Fund ថ្មី (Create Fund)
// ---------------------------------------------------------
exports.createFund = async (req, res) => {
  const {
    username,
    name,
    target,
    type,
    isLocked,
    deadline,
    announcement,
    penaltyRule,
    autoAmt,
    autoFreq,
    autoTime,
    lateJoinerRule,
  } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user)
      return res.json({ success: false, message: "រកមិនឃើញគណនីរបស់អ្នកទេ!" });

    if (!name || !target) {
      return res.json({
        success: false,
        message: "សូមបំពេញឈ្មោះ និងចំនួនទឹកប្រាក់គោលដៅអោយបានត្រឹមត្រូវ!",
      });
    }

    const newFund = new UFund({
      name: name,
      type: type || "personal",
      targetAmount: parseFloat(target),
      creator: username,
      qrCodeString: `UFND-${Date.now()}-${username}`,
      isLocked: isLocked || false,
      deadline: deadline ? new Date(deadline) : null,
      announcement: announcement || "",
      lateJoinerRule: lateJoinerRule || "zero",
      penaltyRule: penaltyRule || {
        enabled: false,
        amount: 0,
        gracePeriodDays: 1,
      },
      members: [
        {
          username: user.username,
          fullName: user.fullName || user.username,
          profileImage: user.profileImage || "",
          role: "admin",
          status: "active",
          contributedAmount: 0,
          autoDeposit: {
            enabled: autoFreq && autoFreq !== "none",
            amount: parseFloat(autoAmt) || 0,
            frequency: autoFreq || "none",
            time: autoTime || "08:00",
          },
        },
      ],
    });

    await newFund.save();
    res.json({
      success: true,
      message: "U-Fund បង្កើតបានជោគជ័យ!",
      fund: newFund,
    });
  } catch (error) {
    console.error("Create Fund Error:", error.message);
    res.json({ success: false, message: "បរាជ័យក្នុងការបង្កើត U-Fund" });
  }
};

// ---------------------------------------------------------
// ៣. កែប្រែគម្រោង (Update Settings)
// ---------------------------------------------------------
exports.updateSettings = async (req, res) => {
  const {
    username,
    fundId,
    name,
    target,
    isLocked,
    deadline,
    announcement,
    penaltyRule,
    autoDeposit,
    lateJoinerRule,
  } = req.body;
  try {
    const fund = await UFund.findById(fundId);
    if (!fund) return res.json({ success: false, message: "Fund Not Found!" });
    if (fund.creator !== username)
      return res.json({ success: false, message: "អ្នកគ្មានសិទ្ធិកែប្រែទេ!" });

    if (name) fund.name = name;
    if (target) fund.targetAmount = parseFloat(target);
    if (typeof isLocked === "boolean") fund.isLocked = isLocked;
    if (deadline) fund.deadline = new Date(deadline);
    if (announcement !== undefined) fund.announcement = announcement;
    if (penaltyRule) fund.penaltyRule = penaltyRule;
    if (lateJoinerRule) fund.lateJoinerRule = lateJoinerRule;
    if (autoDeposit) {
      fund.members.forEach((m) => {
        m.autoDeposit = autoDeposit;
      });
      fund.markModified("members");
    }

    await fund.save();

    for (let m of fund.members) {
      if (m.username !== username && m.status !== "pending") {
        const mUser = await User.findOne({ username: m.username });
        if (mUser) {
          await Notification.create({
            userId: mUser._id,
            username: mUser.username,
            title: "ការកំណត់គម្រោងត្រូវបានផ្លាស់ប្តូរ ⚙️",
            message: `Admin បានកែប្រែការកំណត់ថ្មី ឬមានសារប្រកាសថ្មីនៅក្នុងគម្រោង "${fund.name}"។ សូមចូលទៅពិនិត្យមើល!`,
            date: getFormattedDate(),
            isRead: false,
            type: "ufund_update",
            fundId: fund._id,
          });
        }
      }
    }

    res.json({
      success: true,
      message: "ការកំណត់ត្រូវបានផ្លាស់ប្តូរដោយជោគជ័យ!",
    });
  } catch (error) {
    console.error("Update Settings Error:", error);
    res.json({ success: false, message: "បរាជ័យក្នុងការកែប្រែ" });
  }
};

/**
 * ============================================================================
 * 💸 ផ្នែកទី ៣៖ ការទូទាត់ និងការចេញជួស (DEPOSITS & BAILOUTS)
 * ============================================================================
 */

// ---------------------------------------------------------
// ៤. ដាក់ប្រាក់ និង ចេញលុយជួសសមាជិក (Manual Deposit)
// ---------------------------------------------------------
exports.depositFund = async (req, res) => {
  const { username, fundId, amount, isAuto, bailoutTarget } = req.body;
  try {
    const user = await User.findOne({ username });
    const centralBank = await User.findOne({
      "mainAccounts.USD.accountNumber": "888888888",
    });
    const fund = await UFund.findById(fundId);

    if (!user || !centralBank)
      return res.json({ success: false, message: "គណនីមិនត្រឹមត្រូវ!" });
    if (!fund)
      return res.json({ success: false, message: "រកគម្រោង U-Fund មិនឃើញទេ!" });
    if (fund.currentAmount >= fund.targetAmount)
      return res.json({
        success: false,
        message: "គម្រោងនេះបានសម្រេចគោលដៅរួចរាល់ហើយ!",
      });

    const member = fund.members.find((m) => m.username === username);
    if (member && member.status === "pending") {
      if (isAuto)
        return res.json({
          success: false,
          message: "Pending User - Skipped auto-deposit.",
        });
      return res.json({
        success: false,
        message: "អ្នកត្រូវចុច 'យល់ព្រម' ការអញ្ជើញសិន ទើបអាចដាក់ប្រាក់បាន!",
      });
    }

    const depositAmount = parseFloat(amount);
    const userUsdBalance = user.mainAccounts?.USD?.balance || 0;

    if (userUsdBalance < depositAmount) {
      if (isAuto)
        return res.json({
          success: false,
          message: "ការកាត់ប្រាក់ស្វ័យប្រវត្តិបរាជ័យ ដោយសារខ្វះប្រាក់។",
        });
      return res.json({
        success: false,
        message: "ទឹកប្រាក់របស់អ្នកមិនគ្រប់គ្រាន់ទេ!",
      });
    }

    let targetMember = null;
    let isBailout = false;

    if (bailoutTarget) {
      targetMember = fund.members.find((m) => m.username === bailoutTarget);
      if (!targetMember || targetMember.status !== "overdue") {
        return res.json({
          success: false,
          message: "រកអ្នកជំពាក់នេះមិនឃើញទេ!",
        });
      }
      isBailout = true;
    } else {
      targetMember = member;
    }

    // 🌟 កាត់ប្រាក់ពី User និងបញ្ចូលទៅ Sub-Account 888000555 របស់ Central Bank
    user.mainAccounts.USD.balance -= depositAmount;

    const cbUfundAcc = centralBank.subAccounts.find(
      (acc) => acc.accountNumber === "888000555",
    );
    if (cbUfundAcc) {
      cbUfundAcc.balance += depositAmount;
      centralBank.markModified("subAccounts");
    } else {
      // ករណីរកមិនឃើញកុងនេះ ក៏បូកចូលលុយចម្បងធម្មតាវិញ
      if (centralBank.mainAccounts?.USD)
        centralBank.mainAccounts.USD.balance += depositAmount;
      else centralBank.balance += depositAmount;
    }

    fund.currentAmount += depositAmount;

    if (targetMember) {
      targetMember.contributedAmount += depositAmount;
      if (targetMember.status === "overdue") {
        targetMember.debtAmount =
          (targetMember.debtAmount || 0) - depositAmount;
        if (targetMember.debtAmount <= 0) {
          targetMember.debtAmount = 0;
          targetMember.status = "active";
          targetMember.overdueSince = null;
        }
      }
    }

    const dateNow = getFormattedDate();
    const refId = generateStandardRefId("FND");
    const hash = generateStandardHash();
    const depositorName = user.fullName || user.username;

    // កត់ត្រា P2P Debt ទាំងសងខាង
    if (isBailout) {
      const tUser = await User.findOne({ username: bailoutTarget });
      if (tUser) {
        tUser.p2pDebts = tUser.p2pDebts || [];
        tUser.p2pDebts.push({
          type: "owe",
          partnerUsername: username,
          partnerName: depositorName,
          amount: depositAmount,
          fundName: fund.name,
          date: dateNow,
          refId: refId,
        });

        await Notification.create({
          userId: tUser._id,
          username: tUser.username,
          title: "មានអ្នកចេញលុយជួសអ្នក! 🤝",
          message: `${depositorName} បានចេញលុយសងបំណុល U-Fund ជួសអ្នកចំនួន $${depositAmount}។ ប្រព័ន្ធបានកត់ត្រាវាជាបំណុលបុគ្គល (P2P) ដែលអ្នកត្រូវសងគាត់វិញ។`,
          date: dateNow,
          isRead: false,
          type: "ufund_update",
          fundId: fund._id,
        });

        tUser.markModified("p2pDebts");
        await tUser.save();

        user.p2pDebts = user.p2pDebts || [];
        user.p2pDebts.push({
          type: "lend",
          partnerUsername: tUser.username,
          partnerName: tUser.fullName || tUser.username,
          amount: depositAmount,
          fundName: fund.name,
          date: dateNow,
          refId: refId,
        });
        user.markModified("p2pDebts");
      }
    }

    await Transaction.create({
      userId: user._id,
      username: user.username,
      refId: refId,
      hash: hash,
      date: dateNow,
      type: isBailout ? "U-Fund Bailout Pay" : "U-Fund Deposit",
      amount: -depositAmount,
      currency: "USD",
      senderName: depositorName,
      receiverName: isBailout
        ? `Bailout for ${targetMember.fullName}`
        : `U-Fund: ${fund.name}`,
      senderAcc: user.mainAccounts?.USD?.accountNumber,
      remark: isBailout ? "Paid on behalf of another member" : "Manual Deposit",
      status: "Success",
      trxMethod: "U-PAY App",
    });

    await Transaction.create({
      userId: centralBank._id,
      username: centralBank.username,
      refId: refId,
      hash: hash,
      date: dateNow,
      type: "U-Fund Pool Receive",
      amount: depositAmount,
      currency: "USD",
      senderName: depositorName,
      receiverName: "U-Pay Central Bank",
      receiverAcc: "888000555", // កត់ត្រាចូលកុង U-Fund របស់ Central Bank
      remark: `Received for U-Fund: ${fund.name}`,
      status: "Success",
      trxMethod: "System Transfer",
    });

    const isTargetReachedNow = fund.currentAmount >= fund.targetAmount;

    const notifyPromises = fund.members.map(async (m) => {
      if (m.username !== user.username && m.status !== "pending") {
        const otherMember = await User.findOne({ username: m.username });
        if (otherMember) {
          let alertMsg = isBailout
            ? `${depositorName} បានបង់ប្រាក់ $${depositAmount} សងជួស ${targetMember.fullName} នៅក្នុងគម្រោង "${fund.name}"។`
            : `${depositorName} បានដាក់ប្រាក់ $${depositAmount} ចូលគម្រោង "${fund.name}"។`;

          return Notification.create({
            userId: otherMember._id,
            username: otherMember.username,
            title: isBailout ? "មានអ្នកសងជួស! 🤝" : "មានការដាក់ប្រាក់ថ្មី! 💰",
            message: alertMsg,
            date: dateNow,
            isRead: false,
            type: "ufund_deposit",
            fundId: fund._id,
          });
        }
      }
    });
    await Promise.all(notifyPromises);

    if (isTargetReachedNow) {
      fund.members = fund.members.filter((m) => m.status !== "pending");
    }

    fund.markModified("members");
    await Promise.all([user.save(), centralBank.save(), fund.save()]);

    let responseMsg = isTargetReachedNow
      ? "ដាក់ប្រាក់ជោគជ័យ! ហើយគម្រោងបានពេញល្មម 🎉"
      : "ដាក់ប្រាក់ជោគជ័យ!";
    if (isBailout)
      responseMsg = `អ្នកបានចេញលុយសងជួស ${targetMember.fullName} ជោគជ័យ! បំណុលនេះនឹងត្រូវទារមកវិញនៅពេលក្រោយ។`;

    res.json({ success: true, message: responseMsg, fund });
  } catch (error) {
    console.error("Deposit Error:", error);
    res.json({ success: false, message: "បរាជ័យក្នុងការដាក់ប្រាក់" });
  }
};

// ---------------------------------------------------------
// ៥. មុខងារ Scan QR ដាក់ប្រាក់ចូល U-Fund (Scan Pay)
// ---------------------------------------------------------
exports.scanDepositFund = async (req, res) => {
  const { username, qrString, amount, bailoutTarget } = req.body;
  try {
    const fund = await UFund.findOne({ qrCodeString: qrString });
    if (!fund)
      return res.json({
        success: false,
        message: "QR Code មិនត្រឹមត្រូវ ឬគម្រោងត្រូវបានលុប!",
      });
    if (fund.currentAmount >= fund.targetAmount)
      return res.json({
        success: false,
        message: "គម្រោងនេះពេញលុយហើយ មិនអាចដាក់ប្រាក់បានទៀតទេ!",
      });

    const user = await User.findOne({ username });
    const centralBank = await User.findOne({
      "mainAccounts.USD.accountNumber": "888888888",
    });

    if (!user || !centralBank)
      return res.json({ success: false, message: "គណនីមិនត្រឹមត្រូវ!" });

    const depositAmount = parseFloat(amount);
    if (depositAmount <= 0)
      return res.json({
        success: false,
        message: "ចំនួនទឹកប្រាក់ត្រូវធំជាង ០!",
      });

    const userUsdBalance = user.mainAccounts?.USD?.balance || 0;
    if (userUsdBalance < depositAmount)
      return res.json({
        success: false,
        message: "សមតុល្យរបស់អ្នកមិនគ្រប់គ្រាន់ទេ!",
      });

    let member = fund.members.find((m) => m.username === username);
    const adminMember = fund.members.find((m) => m.role === "admin");

    const catchUpAmount =
      fund.lateJoinerRule === "catchup" ? fund.baseContribution || 0 : 0;
    let wasNewOrPending = false;

    if (!member) {
      wasNewOrPending = true;
      const autoInfo = adminMember
        ? adminMember.autoDeposit
        : { enabled: false, amount: 0, frequency: "none", time: "08:00" };

      fund.members.push({
        username: user.username,
        fullName: user.fullName || user.username,
        profileImage: user.profileImage || "",
        role: "member",
        status: "active",
        contributedAmount: 0,
        debtAmount: 0,
        overdueSince: null,
        autoDeposit: { ...autoInfo },
      });
      member = fund.members[fund.members.length - 1];
    } else if (member.status === "pending") {
      wasNewOrPending = true;
      member.status = "active";
    }

    if (wasNewOrPending && fund.type === "group" && catchUpAmount > 0) {
      member.status = "overdue";
      member.debtAmount = catchUpAmount;
      member.overdueSince = new Date();
    }

    let targetMember = null;
    let isBailout = false;

    if (bailoutTarget) {
      targetMember = fund.members.find((m) => m.username === bailoutTarget);
      if (!targetMember || targetMember.status !== "overdue")
        return res.json({
          success: false,
          message: "រកអ្នកជំពាក់នេះមិនឃើញទេ!",
        });
      isBailout = true;
    } else {
      targetMember = member;
    }

    // 🌟 កាត់ប្រាក់ពី User និងបញ្ចូលទៅ Sub-Account 888000555 របស់ Central Bank
    user.mainAccounts.USD.balance -= depositAmount;

    const cbUfundAcc = centralBank.subAccounts?.find(
      (acc) => acc.accountNumber === "888000555",
    );
    if (cbUfundAcc) {
      cbUfundAcc.balance += depositAmount;
      centralBank.markModified("subAccounts");
    } else {
      if (centralBank.mainAccounts?.USD)
        centralBank.mainAccounts.USD.balance += depositAmount;
      else centralBank.balance += depositAmount;
    }

    fund.currentAmount += depositAmount;

    if (targetMember) {
      targetMember.contributedAmount += depositAmount;
      if (targetMember.status === "overdue") {
        targetMember.debtAmount =
          (targetMember.debtAmount || 0) - depositAmount;
        if (targetMember.debtAmount <= 0) {
          targetMember.debtAmount = 0;
          targetMember.status = "active";
          targetMember.overdueSince = null;
        }
      }
    }

    const dateNow = getFormattedDate();
    const refId = generateStandardRefId("FND");
    const hash = generateStandardHash();
    const depositorName = user.fullName || user.username;

    // កត់ត្រា P2P Debt & បាញ់សារ (QR Scan)
    if (isBailout) {
      const tUser = await User.findOne({ username: bailoutTarget });
      if (tUser) {
        tUser.p2pDebts = tUser.p2pDebts || [];
        tUser.p2pDebts.push({
          type: "owe",
          partnerUsername: username,
          partnerName: depositorName,
          amount: depositAmount,
          fundName: fund.name,
          date: dateNow,
          refId: refId,
        });

        await Notification.create({
          userId: tUser._id,
          username: tUser.username,
          title: "មានអ្នកចេញលុយជួសអ្នក! 🤝",
          message: `${depositorName} បានចេញលុយសងបំណុល U-Fund ជួសអ្នកចំនួន $${depositAmount} តាមរយៈ QR។ ប្រព័ន្ធបានកត់ត្រាវាជាបំណុលបុគ្គល (P2P) ដែលអ្នកត្រូវសងគាត់វិញ។`,
          date: dateNow,
          isRead: false,
          type: "ufund_update",
          fundId: fund._id,
        });

        tUser.markModified("p2pDebts");
        await tUser.save();

        user.p2pDebts = user.p2pDebts || [];
        user.p2pDebts.push({
          type: "lend",
          partnerUsername: tUser.username,
          partnerName: tUser.fullName || tUser.username,
          amount: depositAmount,
          fundName: fund.name,
          date: dateNow,
          refId: refId,
        });
        user.markModified("p2pDebts");
      }
    }

    await Transaction.create({
      userId: user._id,
      username: user.username,
      refId: refId,
      hash: hash,
      date: dateNow,
      type: isBailout ? "U-Fund Bailout Scan Pay" : "U-Fund Scan Pay",
      amount: -depositAmount,
      currency: "USD",
      senderName: depositorName,
      receiverName: isBailout
        ? `Bailout for ${targetMember.fullName}`
        : `U-Fund: ${fund.name}`,
      senderAcc: user.mainAccounts?.USD?.accountNumber,
      remark: isBailout
        ? "Scan QR to pay on behalf of member"
        : "QR Scan Deposit",
      status: "Success",
      trxMethod: "Scan QR",
    });

    await Transaction.create({
      userId: centralBank._id,
      username: centralBank.username,
      refId: refId,
      hash: hash,
      date: dateNow,
      type: "U-Fund Pool Receive",
      amount: depositAmount,
      currency: "USD",
      senderName: depositorName,
      receiverName: "U-Pay Central Bank",
      receiverAcc: "888000555", // កត់ត្រាចូលកុង U-Fund របស់ Central Bank
      remark: `QR Scan for U-Fund: ${fund.name}`,
      status: "Success",
      trxMethod: "System Transfer",
    });

    const isTargetReachedNow = fund.currentAmount >= fund.targetAmount;

    const notifyPromises = fund.members.map(async (m) => {
      if (m.username !== user.username && m.status !== "pending") {
        const otherMember = await User.findOne({ username: m.username });
        if (otherMember) {
          let alertMsg = isBailout
            ? `${depositorName} បានបង់ប្រាក់តាម QR ជួស ${targetMember.fullName} ចំនួន $${depositAmount} នៅក្នុងគម្រោង "${fund.name}"។`
            : `${depositorName} បាន Scan ដាក់ប្រាក់ $${depositAmount} ចូលគម្រោង "${fund.name}"។`;

          return Notification.create({
            userId: otherMember._id,
            username: otherMember.username,
            title: isBailout
              ? "មានអ្នកសងជួស (QR)! 🤝"
              : "មានការដាក់ប្រាក់តាម QR! 💸",
            message: alertMsg,
            date: dateNow,
            isRead: false,
            type: "ufund_deposit",
            fundId: fund._id,
          });
        }
      }
    });

    await Promise.all(notifyPromises);

    if (isTargetReachedNow) {
      await Notification.create({
        userId: user._id,
        username: user.username,
        title: "គោលដៅត្រូវបានសម្រេច! 🎉",
        message: `អបអរសាទរ! គម្រោង "${fund.name}" ប្រមូលប្រាក់បានគ្រប់ចំនួន ($${fund.targetAmount}) ហើយ។`,
        date: dateNow,
        isRead: false,
        type: "ufund_success",
        fundId: fund._id,
      });
      fund.members = fund.members.filter((m) => m.status !== "pending");
    }

    fund.markModified("members");
    await Promise.all([user.save(), centralBank.save(), fund.save()]);

    let responseMsg = "Scan បង់ប្រាក់ចូល U-Fund ជោគជ័យ!";
    if (isTargetReachedNow)
      responseMsg = "Scan បង់ប្រាក់ជោគជ័យ! ហើយគម្រោងបានពេញល្មម 🎉";
    if (isBailout)
      responseMsg = `អ្នកបាន Scan បង់ជួស ${targetMember.fullName} ជោគជ័យ! បំណុលនេះនឹងត្រូវទារមកវិញនៅពេលក្រោយ។`;

    res.json({ success: true, message: responseMsg, fund });
  } catch (error) {
    console.error("Scan U-Fund Error:", error);
    res.json({ success: false, message: "បរាជ័យក្នុងការ Scan ដាក់ប្រាក់" });
  }
};

// ---------------------------------------------------------
// ៦. មុខងារទូទាត់ការជំពាក់ដោយផ្ទាល់ដៃ (Pay Overdue)
// ---------------------------------------------------------
exports.payOverdue = async (req, res) => {
  const { username, fundId } = req.body;
  try {
    const fund = await UFund.findById(fundId);
    const user = await User.findOne({ username });
    const centralBank = await User.findOne({
      "mainAccounts.USD.accountNumber": "888888888",
    });

    if (!fund || !user || !centralBank)
      return res.json({ success: false, message: "ទិន្នន័យមិនត្រឹមត្រូវ!" });

    const member = fund.members.find((m) => m.username === username);
    if (!member || member.status !== "overdue")
      return res.json({
        success: false,
        message: "អ្នកមិនមានជំពាក់ប្រាក់ក្នុងគម្រោងនេះទេ!",
      });

    const overdueAmount =
      member.debtAmount > 0 ? member.debtAmount : member.autoDeposit.amount;
    const userUsdBalance = user.mainAccounts?.USD?.balance || 0;

    if (userUsdBalance < overdueAmount)
      return res.json({
        success: false,
        message: `ទឹកប្រាក់មិនគ្រប់គ្រាន់ទេ! អ្នកត្រូវមានយ៉ាងហោចណាស់ $${overdueAmount} ដើម្បីទូទាត់បំណុល។`,
      });

    // 🌟 កាត់ប្រាក់ពី User និងបញ្ចូលទៅ Sub-Account 888000555 របស់ Central Bank
    user.mainAccounts.USD.balance -= overdueAmount;

    const cbUfundAcc = centralBank.subAccounts?.find(
      (acc) => acc.accountNumber === "888000555",
    );
    if (cbUfundAcc) {
      cbUfundAcc.balance += overdueAmount;
      centralBank.markModified("subAccounts");
    } else {
      if (centralBank.mainAccounts?.USD)
        centralBank.mainAccounts.USD.balance += overdueAmount;
      else centralBank.balance += overdueAmount;
    }

    fund.currentAmount += overdueAmount;
    member.contributedAmount += overdueAmount;
    member.status = "active";
    member.debtAmount = 0;
    member.overdueSince = null;

    const dateNow = getFormattedDate();
    const refId = generateStandardRefId("FND");
    const hash = generateStandardHash();

    await Transaction.create({
      userId: user._id,
      username: user.username,
      refId: refId,
      hash: hash,
      date: dateNow,
      type: "U-Fund Overdue Paid",
      amount: -overdueAmount,
      currency: "USD",
      senderName: user.fullName || user.username,
      receiverName: `U-Fund: ${fund.name}`,
      senderAcc: user.mainAccounts?.USD?.accountNumber,
      remark: "Paid Overdue Balance",
      status: "Success",
      trxMethod: "U-PAY App",
    });

    await Transaction.create({
      userId: centralBank._id,
      username: centralBank.username,
      refId: refId,
      hash: hash,
      date: dateNow,
      type: "U-Fund Pool Receive",
      amount: overdueAmount,
      currency: "USD",
      senderName: user.fullName || user.username,
      receiverName: "U-Pay Central Bank",
      receiverAcc: "888000555", // កត់ត្រាចូលកុង U-Fund របស់ Central Bank
      remark: `Overdue Received for: ${fund.name}`,
      status: "Success",
      trxMethod: "System Transfer",
    });

    fund.markModified("members");
    await Promise.all([user.save(), centralBank.save(), fund.save()]);

    res.json({
      success: true,
      message: "ទូទាត់ជោគជ័យ! គណនីរបស់អ្នកដំណើរការធម្មតាវិញហើយ។",
    });
  } catch (error) {
    console.error("Pay Overdue Error:", error);
    res.json({ success: false, message: "បរាជ័យក្នុងការទូទាត់" });
  }
};

/**
 * ============================================================================
 * 💌 ផ្នែកទី ៤៖ ការអញ្ជើញ និងឆ្លើយតប (INVITATIONS)
 * ============================================================================
 */

// ---------------------------------------------------------
// ៧. អញ្ជើញមិត្តភក្តិ (Invite Member)
// ---------------------------------------------------------
exports.inviteMember = async (req, res) => {
  const { fundId, inviteeIdentifier, inviterUsername } = req.body;
  try {
    const fund = await UFund.findById(fundId);
    if (!fund)
      return res.json({ success: false, message: "រកប្រអប់សន្សំមិនឃើញ!" });
    if (fund.currentAmount >= fund.targetAmount)
      return res.json({
        success: false,
        message: "គម្រោងនេះពេញហើយ មិនអាចអញ្ជើញសមាជិកថ្មីបានទេ!",
      });

    const invitee = await User.findOne({
      $or: [
        { username: inviteeIdentifier },
        { phone: inviteeIdentifier },
        { "mainAccounts.USD.accountNumber": inviteeIdentifier },
        { "mainAccounts.KHR.accountNumber": inviteeIdentifier },
        { accountNumber: inviteeIdentifier },
      ],
    });

    if (!invitee)
      return res.json({ success: false, message: "រកមិនឃើញគណនីមិត្តភក្តិទេ!" });

    const existingMember = fund.members.find(
      (m) => m.username === invitee.username,
    );
    if (existingMember)
      return res.json({
        success: false,
        message: "គាត់ស្ថិតក្នុងក្រុមរួចហើយ!",
      });

    const adminMember = fund.members.find((m) => m.role === "admin");

    fund.members.push({
      username: invitee.username,
      fullName: invitee.fullName || invitee.username,
      profileImage: invitee.profileImage || "",
      role: "member",
      status: "pending",
      contributedAmount: 0,
      invitedAt: Date.now(),
      autoDeposit: {
        enabled: adminMember.autoDeposit.enabled,
        amount: adminMember.autoDeposit.amount,
        frequency: adminMember.autoDeposit.frequency,
        time: adminMember.autoDeposit.time,
      },
    });
    fund.markModified("members");

    await Notification.create({
      userId: invitee._id,
      username: invitee.username,
      title: "ការអញ្ជើញចូល U-Fund 🎯",
      message: `${inviterUsername} បានអញ្ជើញអ្នកចូលរួមសន្សំប្រាក់ក្នុងក្រុម "${fund.name}" (លក្ខខណ្ឌ: $${adminMember.autoDeposit.amount} / ${adminMember.autoDeposit.frequency})។`,
      date: getFormattedDate(),
      isRead: false,
      type: "ufund_invite",
      fundId: fund._id,
    });

    await Promise.all([fund.save()]);
    res.json({ success: true, message: "បានផ្ញើការអញ្ជើញជោគជ័យ!" });
  } catch (error) {
    console.error("Invite Error:", error);
    res.json({ success: false, message: "បរាជ័យក្នុងការផ្ញើការអញ្ជើញ" });
  }
};

// ---------------------------------------------------------
// ៨. ឆ្លើយតបការអញ្ជើញ (Accept / Decline)
// ---------------------------------------------------------
exports.respondToInvite = async (req, res) => {
  const { username, fundId, response, notifId } = req.body;
  try {
    const fund = await UFund.findById(fundId);
    if (!fund)
      return res.json({ success: false, message: "រកប្រអប់សន្សំមិនឃើញទេ!" });

    if (response === "accept" && fund.currentAmount >= fund.targetAmount) {
      return res.json({
        success: false,
        message: "សុំទោស គម្រោងនេះបានពេញសមាជិកហើយ!",
      });
    }

    const memberIndex = fund.members.findIndex((m) => m.username === username);
    if (memberIndex === -1) {
      return res.json({
        success: false,
        message: "សំណើអញ្ជើញនេះត្រូវបានម្ចាស់គម្រោងលុបចោល ឬផុតកំណត់ហើយ!",
      });
    }

    const member = fund.members[memberIndex];

    if (response === "accept") {
      if (fund.lateJoinerRule === "catchup") {
        const catchUpAmount = fund.baseContribution || 0;
        if (catchUpAmount > 0) {
          const user = await User.findOne({ username });
          const centralBank = await User.findOne({
            "mainAccounts.USD.accountNumber": "888888888",
          });

          const userUsdBalance = user.mainAccounts?.USD?.balance || 0;

          if (user && centralBank && userUsdBalance >= catchUpAmount) {
            // 🌟 កាត់ប្រាក់ពី User និងបញ្ចូលទៅ Sub-Account 888000555 របស់ Central Bank
            user.mainAccounts.USD.balance -= catchUpAmount;

            const cbUfundAcc = centralBank.subAccounts?.find(
              (acc) => acc.accountNumber === "888000555",
            );
            if (cbUfundAcc) {
              cbUfundAcc.balance += catchUpAmount;
              centralBank.markModified("subAccounts");
            } else {
              if (centralBank.mainAccounts?.USD)
                centralBank.mainAccounts.USD.balance += catchUpAmount;
              else centralBank.balance += catchUpAmount;
            }

            fund.currentAmount += catchUpAmount;
            member.contributedAmount += catchUpAmount;
            member.status = "active";

            const dateNow = getFormattedDate();
            const refId = generateStandardRefId("FND");
            const hash = generateStandardHash();

            await Transaction.create({
              userId: user._id,
              username: user.username,
              refId: refId,
              hash: hash,
              date: dateNow,
              type: "U-Fund Deposit",
              amount: -catchUpAmount,
              currency: "USD",
              senderName: user.fullName || user.username,
              receiverName: `U-Fund: ${fund.name}`,
              senderAcc: user.mainAccounts?.USD?.accountNumber,
              remark: "Catch-Up Payment (បង់បង្គ្រប់)",
              status: "Success",
              trxMethod: "System Auto",
            });

            await Transaction.create({
              userId: centralBank._id,
              username: centralBank.username,
              refId: refId,
              hash: hash,
              date: dateNow,
              type: "U-Fund Pool Receive",
              amount: catchUpAmount,
              currency: "USD",
              senderName: user.fullName || user.username,
              receiverName: "U-Pay Central Bank",
              receiverAcc: "888000555", // កត់ត្រាចូលកុង U-Fund របស់ Central Bank
              remark: `Catch-Up Receive for: ${fund.name}`,
              status: "Success",
              trxMethod: "System Transfer",
            });

            await user.save();
            await centralBank.save();
          } else {
            member.status = "overdue";
            member.debtAmount = catchUpAmount;
            member.overdueSince = new Date();
            if (user) {
              await Notification.create({
                userId: user._id,
                username: user.username,
                title: "អ្នកជំពាក់ប្រាក់បង់បង្គ្រប់! ⚠️",
                message: `អ្នកបានចូលក្រុម "${fund.name}" ជោគជ័យ។ ប៉ុន្តែអ្នកត្រូវបង់ប្រាក់បង្គ្រប់ចំនួន $${catchUpAmount} ឱ្យស្មើនឹងសមាជិកចាស់។`,
                date: getFormattedDate(),
                isRead: false,
                type: "ufund_failed",
                fundId: fund._id,
              });
            }
          }
        } else {
          member.status = "active";
        }
      } else {
        member.status = "active";
      }
    } else if (response === "decline") {
      // 🌟 បាញ់សារប្រាប់ Admin ពេលកូនក្រុម Reject
      const adminMember = fund.members.find((m) => m.role === "admin");
      if (adminMember) {
        const adminUser = await User.findOne({
          username: adminMember.username,
        });
        if (adminUser) {
          await Notification.create({
            userId: adminUser._id,
            username: adminUser.username,
            title: "សមាជិកបដិសេធការអញ្ជើញ ❌",
            message: `${member.fullName || member.username} បានបដិសេធការអញ្ជើញចូលរួមគម្រោងសន្សំ "${fund.name}" របស់អ្នក។`,
            date: getFormattedDate(),
            isRead: false,
            type: "ufund_fail",
            fundId: fund._id,
          });
        }
      }
      fund.members.splice(memberIndex, 1);
    }

    fund.markModified("members");
    await fund.save();

    if (notifId) {
      try {
        if (mongoose.Types.ObjectId.isValid(notifId)) {
          await Notification.findByIdAndUpdate(notifId, {
            responseStatus: response === "accept" ? "accepted" : "rejected",
            isRead: true,
          });
        }
      } catch (err) {
        console.error("Update Notification Error:", err);
      }
    }

    res.json({
      success: true,
      message: `អ្នកបាន ${response} ការអញ្ជើញរួចរាល់!`,
    });
  } catch (error) {
    console.error("Respond Invite Error:", error);
    res.json({ success: false, message: "មានបញ្ហាក្នុងការឆ្លើយតប" });
  }
};

// ---------------------------------------------------------
// ៩. Admin ដកហូតសំណើអញ្ជើញវិញ (Cancel Pending Invite)
// ---------------------------------------------------------
exports.cancelInvite = async (req, res) => {
  const { adminUsername, targetUsername, fundId } = req.body;
  try {
    const fund = await UFund.findById(fundId);
    if (!fund)
      return res.json({ success: false, message: "រកគម្រោងមិនឃើញទេ!" });
    if (fund.creator !== adminUsername)
      return res.json({ success: false, message: "អ្នកគ្មានសិទ្ធិទេ!" });

    const memberIndex = fund.members.findIndex(
      (m) => m.username === targetUsername && m.status === "pending",
    );
    if (memberIndex === -1)
      return res.json({
        success: false,
        message: "រកអ្នក Pending នេះមិនឃើញ ឬគាត់ចូលក្រុមរួចហើយ!",
      });

    fund.members.splice(memberIndex, 1);
    fund.markModified("members");
    await fund.save();

    const targetUser = await User.findOne({ username: targetUsername });
    if (targetUser) {
      await Notification.create({
        userId: targetUser._id,
        username: targetUser.username,
        title: "សំណើអញ្ជើញត្រូវបានលុបចោល ❌",
        message: `ម្ចាស់គម្រោង "${fund.name}" បានដកហូតសំណើអញ្ជើញរបស់អ្នកវិញហើយ។`,
        date: getFormattedDate(),
        isRead: false,
        type: "ufund_expired",
        fundId: fund._id,
      });
    }

    res.json({ success: true, message: "បានបោះបង់សំណើអញ្ជើញជោគជ័យ!" });
  } catch (error) {
    res.json({ success: false, message: "បរាជ័យក្នុងការបោះបង់" });
  }
};

/**
 * ============================================================================
 * 📣 ផ្នែកទី ៥៖ ការបញ្ជា និងសាររំលឹកពីអ្នកគ្រប់គ្រង (ADMIN CONTROLS)
 * ============================================================================
 */

// ---------------------------------------------------------
// ១០. Admin បាញ់សាររំលឹកអ្នកជំពាក់ (Overdue Reminder)
// ---------------------------------------------------------
exports.remindMember = async (req, res) => {
  const { adminUsername, targetUsername, fundId } = req.body;
  try {
    const fund = await UFund.findById(fundId);
    if (!fund) return res.json({ success: false });

    const targetUser = await User.findOne({ username: targetUsername });
    if (targetUser) {
      await Notification.create({
        userId: targetUser._id,
        username: targetUser.username,
        title: "សាររំលឹកពីម្ចាស់គម្រោង 🔔",
        message: `អ្នកមានការជំពាក់មិនទាន់បង់នៅក្នុងគម្រោង "${fund.name}"។ សូមបញ្ចូលប្រាក់ក្នុងគណនីដើម្បីធ្វើការទូទាត់!`,
        date: getFormattedDate(),
        isRead: false,
        type: "ufund_reminder",
        fundId: fund._id,
      });
    }
    res.json({ success: true, message: "បានផ្ញើសាររំលឹករួចរាល់!" });
  } catch (error) {
    res.json({ success: false });
  }
};

// ---------------------------------------------------------
// ១១. Admin ចុចកណ្តឹងហៅអ្នក Pending (Nudge Pending)
// ---------------------------------------------------------
exports.nudgePending = async (req, res) => {
  const { adminUsername, targetUsername, fundId } = req.body;
  try {
    const fund = await UFund.findById(fundId);
    if (!fund) return res.json({ success: false, message: "Fund Not Found!" });

    const targetUser = await User.findOne({ username: targetUsername });
    if (targetUser) {
      await Notification.create({
        userId: targetUser._id,
        username: targetUser.username,
        title: "កុំភ្លេចចូលរួមគម្រោងសន្សំយើងណា! 👋",
        message: `ម្ចាស់គម្រោង "${fund.name}" កំពុងរង់ចាំអ្នកយល់ព្រមចូលរួម។ សូមប្រញាប់ឡើង មុនពេលការអញ្ជើញហួសកំណត់!`,
        date: getFormattedDate(),
        isRead: false,
        type: "ufund_nudge",
        fundId: fund._id,
      });
    }
    res.json({ success: true, message: "បានផ្ញើសារទាក់ទាញ (Nudge) រួចរាល់!" });
  } catch (error) {
    res.json({ success: false, message: "Error sending nudge" });
  }
};

// ---------------------------------------------------------
// ១២. Admin ផ្ទេរសិទ្ធិ (Transfer Admin Ownership)
// ---------------------------------------------------------
exports.transferAdmin = async (req, res) => {
  const { adminUsername, targetUsername, fundId } = req.body;
  try {
    const fund = await UFund.findById(fundId);
    if (!fund)
      return res.json({ success: false, message: "រកគម្រោងមិនឃើញទេ!" });
    if (fund.creator !== adminUsername)
      return res.json({ success: false, message: "អ្នកគ្មានសិទ្ធិទេ!" });

    const currentAdmin = fund.members.find((m) => m.username === adminUsername);
    const targetMember = fund.members.find(
      (m) => m.username === targetUsername,
    );

    if (!targetMember || targetMember.status !== "active")
      return res.json({
        success: false,
        message: "សមាជិកនេះមិនអាចទទួលសិទ្ធិបានទេ (ត្រូវតែ Active)!",
      });

    if (currentAdmin) currentAdmin.role = "member";
    targetMember.role = "admin";
    fund.creator = targetUsername;

    fund.markModified("members");
    await fund.save();

    const tUser = await User.findOne({ username: targetUsername });
    if (tUser) {
      await Notification.create({
        userId: tUser._id,
        username: tUser.username,
        title: "អ្នកក្លាយជាម្ចាស់គម្រោងថ្មី! 👑",
        message: `អបអរសាទរ! ${currentAdmin.fullName || adminUsername} បានផ្ទេរសិទ្ធិគ្រប់គ្រងគម្រោង "${fund.name}" មកឱ្យអ្នក។`,
        date: getFormattedDate(),
        isRead: false,
        type: "ufund_update",
        fundId: fund._id,
      });
    }

    res.json({ success: true, message: "ផ្ទេរសិទ្ធិជា Admin ជោគជ័យ!" });
  } catch (error) {
    console.error("Transfer Admin Error:", error);
    res.json({ success: false, message: "បរាជ័យក្នុងការផ្ទេរសិទ្ធិ" });
  }
};

/**
 * ============================================================================
 * 🚪 ផ្នែកទី ៦៖ ការចាកចេញ និងការរំសាយគម្រោង (LEAVE & CLOSURE)
 * ============================================================================
 */

// ---------------------------------------------------------
// ១៣. កូនក្រុមស្នើសុំចាកចេញ (Request Leave)
// ---------------------------------------------------------
exports.requestLeave = async (req, res) => {
  const { username, fundId, reason } = req.body;
  try {
    const fund = await UFund.findById(fundId);
    if (!fund) return res.json({ success: false, message: "Fund Not Found!" });

    if (fund.isLocked)
      return res.json({
        success: false,
        message:
          "គម្រោងនេះត្រូវបានចាក់សោរ (Locked) ដោយ Admin អ្នកមិនអាចស្នើសុំចាកចេញបានទេ!",
      });

    const member = fund.members.find((m) => m.username === username);
    if (!member)
      return res.json({
        success: false,
        message: "អ្នកមិនមែនជាសមាជិកក្នុងគម្រោងនេះទេ!",
      });

    member.leaveRequest = {
      requested: true,
      reason: reason || "គ្មានមូលហេតុ",
      requestedAt: new Date(),
    };
    fund.markModified("members");
    await fund.save();

    const adminUser = await User.findOne({ username: fund.creator });
    if (adminUser) {
      await Notification.create({
        userId: adminUser._id,
        username: adminUser.username,
        title: "សំណើចាកចេញពីកូនក្រុម 🚪",
        message: `សមាជិក ${member.fullName || member.username} បានស្នើសុំចាកចេញពីគម្រោង "${fund.name}"។ មូលហេតុ៖ "${member.leaveRequest.reason}"`,
        date: getFormattedDate(),
        isRead: false,
        type: "ufund_leave_request",
        fundId: fund._id,
      });
    }

    res.json({
      success: true,
      message: "សំណើចាកចេញរបស់អ្នកត្រូវបានបញ្ជូនទៅ Admin រង់ចាំការយល់ព្រម។",
    });
  } catch (error) {
    res.json({ success: false, message: "បរាជ័យក្នុងការស្នើសុំចាកចេញ" });
  }
};

// ---------------------------------------------------------
// ១៤. កូនក្រុមបោះបង់ការសុំចេញ (Cancel Leave Request)
// ---------------------------------------------------------
exports.cancelLeaveRequest = async (req, res) => {
  const { username, fundId } = req.body;
  try {
    const fund = await UFund.findById(fundId);
    if (!fund)
      return res.json({ success: false, message: "រកគម្រោងមិនឃើញទេ!" });

    const member = fund.members.find((m) => m.username === username);
    if (!member)
      return res.json({ success: false, message: "រកសមាជិកមិនឃើញ!" });

    if (!member.leaveRequest || !member.leaveRequest.requested)
      return res.json({
        success: false,
        message: "អ្នកមិនបានស្នើសុំចាកចេញទេ!",
      });

    member.leaveRequest.requested = false;
    member.leaveRequest.reason = "";

    fund.markModified("members");
    await fund.save();

    const adminUser = await User.findOne({ username: fund.creator });
    if (adminUser) {
      await Notification.create({
        userId: adminUser._id,
        username: adminUser.username,
        title: "កូនក្រុមប្តូរចិត្តមិនចេញវិញទេ 🔄",
        message: `សមាជិក ${member.fullName || member.username} បានលុបចោលសំណើសុំចាកចេញពីគម្រោង "${fund.name}" ហើយ។`,
        date: getFormattedDate(),
        isRead: false,
        type: "ufund_update",
        fundId: fund._id,
      });
    }

    res.json({
      success: true,
      message: "អ្នកបានបោះបង់ការសុំចាកចេញជោគជ័យ! រីករាយការសន្សំបន្ត។",
    });
  } catch (error) {
    console.error("Cancel Leave Error:", error);
    res.json({ success: false, message: "បរាជ័យក្នុងការបោះបង់សំណើ" });
  }
};

// ---------------------------------------------------------
// ១៥. Admin យល់ព្រមអោយកូនក្រុមចេញ (Approve Leave)
// ---------------------------------------------------------
exports.approveLeave = async (req, res) => {
  const { adminUsername, targetUsername, fundId } = req.body;
  try {
    const fund = await UFund.findById(fundId);
    const centralBank = await User.findOne({
      "mainAccounts.USD.accountNumber": "888888888",
    });
    const targetUser = await User.findOne({ username: targetUsername });

    if (!fund || !centralBank || !targetUser)
      return res.json({ success: false, message: "ទិន្នន័យមិនត្រឹមត្រូវ!" });
    if (fund.creator !== adminUsername)
      return res.json({ success: false, message: "អ្នកគ្មានសិទ្ធិទេ!" });

    const memberIndex = fund.members.findIndex(
      (m) => m.username === targetUsername,
    );
    if (memberIndex === -1)
      return res.json({ success: false, message: "រកសមាជិកនេះមិនឃើញ!" });

    const member = fund.members[memberIndex];
    const refundAmount = member.contributedAmount;

    if (refundAmount > 0) {
      // 🌟 ដកលុយពី Sub-Account U-Fund របស់ Central Bank បង្វិលទៅ User វិញ
      targetUser.mainAccounts.USD.balance += refundAmount;

      const cbUfundAcc = centralBank.subAccounts?.find(
        (acc) => acc.accountNumber === "888000555",
      );
      if (cbUfundAcc) {
        cbUfundAcc.balance -= refundAmount;
        centralBank.markModified("subAccounts");
      } else {
        if (centralBank.mainAccounts?.USD)
          centralBank.mainAccounts.USD.balance -= refundAmount;
        else centralBank.balance -= refundAmount;
      }

      fund.currentAmount -= refundAmount;

      const dateNow = getFormattedDate();
      const refId = generateStandardRefId("FND");
      const hash = generateStandardHash();

      await Transaction.create({
        userId: targetUser._id,
        username: targetUser.username,
        refId: refId,
        hash: hash,
        date: dateNow,
        type: "U-Fund Refund",
        amount: refundAmount,
        currency: "USD",
        senderName: "U-Pay U-Fund Pool",
        receiverName: targetUser.fullName || targetUser.username,
        receiverAcc: targetUser.mainAccounts?.USD?.accountNumber,
        remark: `Approved Leave from: ${fund.name}`,
        status: "Success",
      });

      await Transaction.create({
        userId: centralBank._id,
        username: centralBank.username,
        refId: refId,
        hash: hash,
        date: dateNow,
        type: "U-Fund Pool Refund",
        amount: -refundAmount,
        currency: "USD",
        senderName: "U-Pay U-Fund Pool",
        receiverName: targetUser.fullName || targetUser.username,
        senderAcc: "888000555", // កត់ត្រាដកពីកុង U-Fund របស់ Central Bank
        remark: `Refund to member leaving ${fund.name}`,
        status: "Success",
      });
    }

    await Notification.create({
      userId: targetUser._id,
      username: targetUser.username,
      title: "អ្នកបានចាកចេញពីគម្រោង 🚪",
      message: `Admin បានយល់ព្រមអោយអ្នកចាកចេញពីគម្រោង "${fund.name}" ហើយទឹកប្រាក់ $${refundAmount.toLocaleString()} ត្រូវបានបង្វិលសងចូលគណនីអ្នកវិញ។`,
      date: getFormattedDate(),
      isRead: false,
      type: "ufund_leave_approved",
      fundId: fund._id,
    });

    fund.members.splice(memberIndex, 1);
    fund.markModified("members");

    await Promise.all([targetUser.save(), centralBank.save(), fund.save()]);

    res.json({
      success: true,
      message: `បានយល់ព្រមឱ្យ ${targetUser.fullName || targetUsername} ចាកចេញ និងបង្វិលប្រាក់សងជោគជ័យ!`,
    });
  } catch (error) {
    console.error("Approve Leave Error:", error);
    res.json({ success: false, message: "បរាជ័យក្នុងការអនុម័ត" });
  }
};

// ---------------------------------------------------------
// ១៦. បិទគម្រោងជោគជ័យ ឬ រំសាយគម្រោងចោល (Close / Cancel Fund)
// ---------------------------------------------------------
exports.closeOrCancelFund = async (req, res) => {
  const { username, fundId } = req.body;
  try {
    const fund = await UFund.findById(fundId);
    const centralBank = await User.findOne({
      "mainAccounts.USD.accountNumber": "888888888",
    });

    if (!fund || !centralBank)
      return res.json({ success: false, message: "ទិន្នន័យមិនត្រឹមត្រូវ!" });
    if (fund.creator !== username)
      return res.json({ success: false, message: "អ្នកគ្មានសិទ្ធិទេ!" });

    const isFull = fund.currentAmount >= fund.targetAmount;
    const dateNow = getFormattedDate();
    const cbUfundAcc = centralBank.subAccounts?.find(
      (acc) => acc.accountNumber === "888000555",
    );

    // 🌟 ករណីបិទជោគជ័យ (Close Success)
    if (isFull) {
      const creatorUser = await User.findOne({ username: fund.creator });

      // 🌟 ដកលុយពី Sub-Account U-Fund របស់ Central Bank ចូលកុង Admin គម្រោង
      creatorUser.mainAccounts.USD.balance += fund.currentAmount;
      if (cbUfundAcc) {
        cbUfundAcc.balance -= fund.currentAmount;
        centralBank.markModified("subAccounts");
      } else {
        if (centralBank.mainAccounts?.USD)
          centralBank.mainAccounts.USD.balance -= fund.currentAmount;
        else centralBank.balance -= fund.currentAmount;
      }

      const refId = generateStandardRefId("FND");
      const hash = generateStandardHash();
      const creatorName = creatorUser.fullName || creatorUser.username;

      await Transaction.create({
        userId: creatorUser._id,
        username: creatorUser.username,
        refId: refId,
        hash: hash,
        date: dateNow,
        type: "U-Fund Completed",
        amount: fund.currentAmount,
        currency: "USD",
        senderName: "U-Pay U-Fund Pool",
        receiverName: creatorName,
        receiverAcc: creatorUser.mainAccounts?.USD?.accountNumber,
        remark: `Fund target reached: ${fund.name}`,
        status: "Success",
      });

      await Transaction.create({
        userId: centralBank._id,
        username: centralBank.username,
        refId: refId,
        hash: hash,
        date: dateNow,
        type: "U-Fund Payout",
        amount: -fund.currentAmount,
        currency: "USD",
        senderName: "U-Pay U-Fund Pool",
        receiverName: creatorName,
        senderAcc: "888000555", // កត់ត្រាដកពីកុង U-Fund របស់ Central Bank
        remark: `Payout for U-Fund: ${fund.name}`,
        status: "Success",
      });

      const notifyPromises = fund.members.map(async (member) => {
        let mUser =
          member.username === creatorUser.username
            ? creatorUser
            : await User.findOne({ username: member.username });
        if (mUser) {
          return Notification.create({
            userId: mUser._id,
            username: mUser.username,
            title: "គម្រោងសន្សំជោគជ័យ! 🎉",
            message: `គម្រោង "${fund.name}" សម្រេចគោលដៅហើយ! ទឹកប្រាក់សរុប $${fund.currentAmount.toLocaleString()} ត្រូវបានដកដោយម្ចាស់គម្រោង (${creatorName}) រួចរាល់។`,
            date: dateNow,
            isRead: false,
            type: "ufund_success",
            fundId: fund._id,
          });
        }
      });
      await Promise.all(notifyPromises);

      await Promise.all([
        creatorUser.save(),
        centralBank.save(),
        UFund.findByIdAndDelete(fundId),
      ]);
      return res.json({
        success: true,
        message:
          "គម្រោងត្រូវបានបិទ! ប្រាក់បានបញ្ចូលទៅគណនីអ្នក ហើយសមាជិកទាំងអស់ទទួលបានសារដំណឹង។",
      });

      // 🌟 ករណីរំសាយមុនកំណត់ (Cancel & Refund)
    } else {
      const refundPromises = fund.members.map(async (member) => {
        if (member.contributedAmount > 0) {
          const mUser = await User.findOne({ username: member.username });
          if (mUser) {
            // 🌟 បង្វិលប្រាក់ពី Sub-Account U-Fund ចូលសមាជិកវិញ
            mUser.mainAccounts.USD.balance += member.contributedAmount;
            if (cbUfundAcc) {
              cbUfundAcc.balance -= member.contributedAmount;
              centralBank.markModified("subAccounts");
            } else {
              if (centralBank.mainAccounts?.USD)
                centralBank.mainAccounts.USD.balance -=
                  member.contributedAmount;
              else centralBank.balance -= member.contributedAmount;
            }

            const refId = generateStandardRefId("FND");
            const hash = generateStandardHash();

            await Transaction.create({
              userId: mUser._id,
              username: mUser.username,
              refId: refId,
              hash: hash,
              date: dateNow,
              type: "U-Fund Refund",
              amount: member.contributedAmount,
              currency: "USD",
              senderName: "U-Pay U-Fund Pool",
              receiverName: mUser.fullName || mUser.username,
              receiverAcc: mUser.mainAccounts?.USD?.accountNumber,
              remark: `Fund Cancelled: ${fund.name}`,
              status: "Success",
            });

            await Transaction.create({
              userId: centralBank._id,
              username: centralBank.username,
              refId: refId,
              hash: hash,
              date: dateNow,
              type: "U-Fund Pool Refund",
              amount: -member.contributedAmount,
              currency: "USD",
              senderName: "U-Pay U-Fund Pool",
              receiverName: mUser.fullName || mUser.username,
              senderAcc: "888000555", // កត់ត្រាដកពីកុង U-Fund របស់ Central Bank
              remark: `Refund to member for ${fund.name}`,
              status: "Success",
            });

            await Notification.create({
              userId: mUser._id,
              username: mUser.username,
              title: "គម្រោងត្រូវបានរំសាយ ⚠️",
              message: `គម្រោង "${fund.name}" ត្រូវបានបិទមុនកំណត់។ ទឹកប្រាក់ $${member.contributedAmount.toLocaleString()} ត្រូវបានបង្វិលចូលគណនីរបស់អ្នកវិញ។`,
              date: dateNow,
              isRead: false,
              type: "ufund_cancelled",
              fundId: fund._id,
            });
            await mUser.save();
          }
        }
      });
      await Promise.all(refundPromises);

      await centralBank.save();
      await UFund.findByIdAndDelete(fundId);
      return res.json({
        success: true,
        message: "គម្រោងត្រូវបានរំសាយ ហើយលុយបានបង្វិលសងសមាជិកវិញរួចរាល់។",
      });
    }
  } catch (error) {
    console.error("Close Fund Error:", error);
    res.json({ success: false, message: "បរាជ័យក្នុងការបិទគម្រោង" });
  }
};

/**
 * ============================================================================
 * 🔍 ផ្នែកទី ៧៖ មុខងារបន្ថែម (UTILITIES)
 * ============================================================================
 */

// ---------------------------------------------------------
// ១៧. ទាញយកឈ្មោះអ្នកជំពាក់ដើម្បីបង្ហាញកន្លែង Scan QR
// ---------------------------------------------------------
exports.getUFundName = async (req, res) => {
  const { qrString } = req.body;
  try {
    const fund = await UFund.findOne({ qrCodeString: qrString });
    if (fund) {
      const overdueMembers = fund.members
        .filter((m) => m.status === "overdue")
        .map((m) => ({
          username: m.username,
          fullName: m.fullName || m.username,
          debtAmount:
            m.debtAmount > 0
              ? m.debtAmount
              : m.autoDeposit
                ? m.autoDeposit.amount
                : 0,
        }));

      res.json({ success: true, projectName: fund.name, overdueMembers });
    } else {
      res.json({ success: false });
    }
  } catch (err) {
    res.json({ success: false });
  }
};
