const User = require("../models/User");
const UFund = require("../models/UFund");
const Transaction = require("../models/Transaction"); // ត្រូវប្រាកដថាបងមាន File នេះ
const {
  getFormattedDate,
  generateRefId,
  generateHash,
} = require("../services/helpers");

// ---------------------------------------------------------
// ១. ទាញយកបញ្ជី U-Fund (List)
// ---------------------------------------------------------
exports.getMyFunds = async (req, res) => {
  const { username } = req.body;
  try {
    const funds = await UFund.find({ "members.username": username }).sort({
      createdAt: -1,
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

// ---------------------------------------------------------
// ២. បង្កើត U-Fund ថ្មី (Create)
// ---------------------------------------------------------
exports.createFund = async (req, res) => {
  // 🔥 បន្ថែមពាក្យ autoTime មកទទួលពី Frontend
  const { username, name, target, type, autoAmt, autoFreq, autoTime } =
    req.body;

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
      members: [
        {
          username: user.username,
          fullName: user.fullName || user.username,
          role: "admin",
          status: "active",
          contributedAmount: 0,
          autoDeposit: {
            enabled: autoFreq && autoFreq !== "none",
            amount: parseFloat(autoAmt) || 0,
            frequency: autoFreq || "none",
            time: autoTime || "08:00", // 👈 Save ម៉ោងចូល Database
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
    console.error("Create Fund Mongoose Error:", error.message);
    res.json({ success: false, message: "បរាជ័យក្នុងការបង្កើត U-Fund" });
  }
};

// ---------------------------------------------------------
// ៣. ដាក់ប្រាក់ចូល U-Fund (Deposit) + ផ្ទេរចូលធនាគារកណ្តាល + ជូនដំណឹង
// ---------------------------------------------------------
exports.depositFund = async (req, res) => {
  const { username, fundId, amount, isAuto } = req.body;
  try {
    const user = await User.findOne({ username });
    const fund = await UFund.findById(fundId);

    // ទាញយកគណនីធនាគារកណ្តាល (Central Bank USD)
    const centralBank = await User.findOne({ accountNumber: "888888888" });

    if (!user || !fund || !centralBank) {
      return res.json({
        success: false,
        message: "ទិន្នន័យគណនី ឬធនាគារកណ្តាលមិនត្រឹមត្រូវ!",
      });
    }

    const depositAmount = parseFloat(amount);
    if (user.balance < depositAmount) {
      if (isAuto) {
        const member = fund.members.find((m) => m.username === username);
        if (member) member.status = "overdue";
        await fund.save();
        return res.json({
          success: false,
          message: "ការកាត់ប្រាក់ស្វ័យប្រវត្តិបរាជ័យ។",
        });
      }
      return res.json({
        success: false,
        message: "ទឹកប្រាក់របស់អ្នកមិនគ្រប់គ្រាន់ទេ!",
      });
    }

    // 💸 កាត់លុយពី User និង បូកលុយចូល Central Bank
    user.balance -= depositAmount;
    centralBank.balance = (centralBank.balance || 0) + depositAmount;
    fund.currentAmount += depositAmount;

    // Update ទិន្នន័យសមាជិកដែលបានដាក់
    const member = fund.members.find((m) => m.username === username);
    if (member) {
      member.contributedAmount += depositAmount;
      if (member.status === "overdue") member.status = "active";
    }

    const dateNow = getFormattedDate();
    const refId = generateRefId();
    const hash = generateHash();
    const depositorName = user.fullName || user.username;

    // 🧾 វិក្កយបត្រកាត់លុយ (User)
    await Transaction.create({
      username: user.username,
      refId: refId,
      hash: hash,
      date: dateNow,
      type: "U-Fund Deposit",
      amount: -depositAmount,
      currency: "USD",
      senderName: depositorName,
      receiverName: `U-Fund: ${fund.name}`,
      remark: isAuto ? "Auto Deposit" : "Manual Deposit",
      status: "Success",
      trxMethod: "U-PAY App",
    });

    // 🧾 វិក្កយបត្រទទួលលុយ (Central Bank)
    await Transaction.create({
      username: centralBank.username,
      refId: refId,
      hash: hash,
      date: dateNow,
      type: "U-Fund Pool Receive",
      amount: depositAmount,
      currency: "USD",
      senderName: depositorName,
      receiverName: "U-Pay Central Bank",
      remark: `Received for U-Fund: ${fund.name}`,
      status: "Success",
      trxMethod: "System Transfer",
    });

    // 🔔 ផ្ញើ Notification ទៅកាន់សមាជិក "ផ្សេងទៀត" ទាំងអស់ក្នុងគម្រោង
    const notifyPromises = fund.members.map(async (m) => {
      // មិនបាច់ផ្ញើសារប្រាប់អ្នកដែលទើបតែដាក់លុយទេ (ព្រោះគាត់ដឹងហើយ)
      if (m.username !== user.username) {
        const otherMember = await User.findOne({ username: m.username });
        if (otherMember) {
          if (!otherMember.notifications) otherMember.notifications = [];

          otherMember.notifications.unshift({
            id: "FND-DEP-" + Date.now() + Math.floor(Math.random() * 1000),
            title: "មានការដាក់ប្រាក់ថ្មី! 💰",
            message: `${depositorName} បានដាក់ប្រាក់ $${depositAmount.toLocaleString()} ចូលគម្រោង "${fund.name}"។`,
            date: dateNow,
            isRead: false,
            type: "ufund_deposit",
          });

          otherMember.markModified("notifications");
          return otherMember.save();
        }
      }
    });

    // រង់ចាំរុញសារឱ្យសមាជិកទាំងអស់ចប់សិន
    await Promise.all(notifyPromises);

    // Save ទិន្នន័យចម្បងទាំង ៣ ព្រមគ្នា
    await Promise.all([user.save(), centralBank.save(), fund.save()]);
    res.json({ success: true, message: "ដាក់ប្រាក់ជោគជ័យ!", fund });
  } catch (error) {
    console.error("Deposit Error:", error);
    res.json({ success: false, message: "បរាជ័យក្នុងការដាក់ប្រាក់" });
  }
};

// ---------------------------------------------------------
// ៤. អញ្ជើញមិត្តភក្តិ (Invite)
// ---------------------------------------------------------
exports.inviteMember = async (req, res) => {
  const { fundId, inviteeIdentifier, inviterUsername } = req.body;
  try {
    const fund = await UFund.findById(fundId);
    if (!fund)
      return res.json({ success: false, message: "រកប្រអប់សន្សំមិនឃើញ!" });

    const invitee = await User.findOne({
      $or: [
        { username: inviteeIdentifier },
        { phone: inviteeIdentifier },
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

    fund.members.push({
      username: invitee.username,
      fullName: invitee.fullName || invitee.username,
      role: "member",
      status: "pending", // រង់ចាំគាត់ Accept ក្នុង Notification
    });

    // ផ្ញើ Notification ទៅគាត់
    if (!invitee.notifications) invitee.notifications = [];
    invitee.notifications.unshift({
      id: "INV-" + Date.now(),
      title: "ការអញ្ជើញចូល U-Fund 🎯",
      message: `${inviterUsername} បានអញ្ជើញអ្នកចូលរួមសន្សំប្រាក់ក្នុងក្រុម "${fund.name}"។`,
      date: getFormattedDate(),
      isRead: false,
      type: "ufund_invite",
      fundId: fund._id,
    });
    invitee.markModified("notifications");

    await Promise.all([fund.save(), invitee.save()]);
    res.json({ success: true, message: "បានផ្ញើការអញ្ជើញជោគជ័យ!" });
  } catch (error) {
    console.error("Invite Error:", error);
    res.json({ success: false, message: "បរាជ័យក្នុងការផ្ញើការអញ្ជើញ" });
  }
};

// ---------------------------------------------------------
// ៥. ឆ្លើយតបការអញ្ជើញ (Accept / Decline) ពី Notification
// ---------------------------------------------------------
exports.respondToInvite = async (req, res) => {
  const { username, fundId, response, notifId } = req.body; // response: 'accept' ឬ 'decline'
  try {
    const fund = await UFund.findById(fundId);
    if (!fund)
      return res.json({ success: false, message: "រកប្រអប់សន្សំមិនឃើញទេ!" });

    const memberIndex = fund.members.findIndex((m) => m.username === username);
    if (memberIndex !== -1) {
      if (response === "accept") {
        fund.members[memberIndex].status = "active";
      } else if (response === "decline") {
        fund.members.splice(memberIndex, 1); // លុបឈ្មោះចេញពីក្រុម
      }
      await fund.save();
    }

    // Mark Notification ជា "បានអាន"
    const user = await User.findOne({ username });
    if (user && notifId) {
      const notif = user.notifications.find((n) => n.id === notifId);
      if (notif) notif.isRead = true;
      user.markModified("notifications");
      await user.save();
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
// ៦. កែប្រែគម្រោង (Edit Fund)
// ---------------------------------------------------------
exports.editFund = async (req, res) => {
  const { username, fundId, name, target } = req.body;
  try {
    const fund = await UFund.findById(fundId);
    if (!fund) return res.json({ success: false, message: "Fund Not Found!" });
    if (fund.creator !== username)
      return res.json({ success: false, message: "អ្នកគ្មានសិទ្ធិកែប្រែទេ!" });

    fund.name = name || fund.name;
    fund.targetAmount = target ? parseFloat(target) : fund.targetAmount;

    await fund.save();
    res.json({ success: true, message: "កែប្រែជោគជ័យ!" });
  } catch (error) {
    console.error("Edit Fund Error:", error);
    res.json({ success: false, message: "បរាជ័យក្នុងការកែប្រែ" });
  }
};

// ---------------------------------------------------------
// ៧. បិទគម្រោង (Close Success / Cancel Refund) + ជូនដំណឹងដល់សមាជិក
// ---------------------------------------------------------
exports.closeOrCancelFund = async (req, res) => {
  const { username, fundId } = req.body;
  try {
    const fund = await UFund.findById(fundId);
    const centralBank = await User.findOne({ accountNumber: "888888888" });

    if (!fund) return res.json({ success: false, message: "Fund Not Found!" });
    if (!centralBank)
      return res.json({ success: false, message: "រកមិនឃើញគណនីធនាគារកណ្តាល!" });
    if (fund.creator !== username)
      return res.json({ success: false, message: "អ្នកគ្មានសិទ្ធិទេ!" });

    const isFull = fund.currentAmount >= fund.targetAmount;
    const dateNow = getFormattedDate();

    if (isFull) {
      // ✅ SUCCESS: ផ្ទេរលុយទាំងអស់ពី Central Bank ចូលកុងម្ចាស់គម្រោង
      const creatorUser = await User.findOne({ username: fund.creator });

      creatorUser.balance += fund.currentAmount;
      centralBank.balance -= fund.currentAmount;

      const refId = generateRefId();
      const hash = generateHash();
      const creatorName = creatorUser.fullName || creatorUser.username;

      // វិក្កយបត្រទទួលលុយ (Creator)
      await Transaction.create({
        username: creatorUser.username,
        refId: refId,
        hash: hash,
        date: dateNow,
        type: "U-Fund Completed",
        amount: fund.currentAmount,
        currency: "USD",
        senderName: "U-Pay U-Fund Pool",
        receiverName: creatorName,
        remark: `Fund target reached: ${fund.name}`,
        status: "Success",
      });

      // វិក្កយបត្រដកលុយ (Central Bank)
      await Transaction.create({
        username: centralBank.username,
        refId: refId,
        hash: hash,
        date: dateNow,
        type: "U-Fund Payout",
        amount: -fund.currentAmount,
        currency: "USD",
        senderName: "U-Pay U-Fund Pool",
        receiverName: creatorName,
        remark: `Payout for U-Fund: ${fund.name}`,
        status: "Success",
      });

      // 🔔 ផ្ញើ Notification ទៅកាន់សមាជិកទាំងអស់ក្នុងគម្រោង
      for (let member of fund.members) {
        // បើកអ្នកនោះជាម្ចាស់គម្រោងស្រាប់ យើងប្រើ object creatorUser, បើអ្នកផ្សេង យើង query ថ្មី
        let mUser =
          member.username === creatorUser.username
            ? creatorUser
            : await User.findOne({ username: member.username });

        if (mUser) {
          if (!mUser.notifications) mUser.notifications = [];

          mUser.notifications.unshift({
            id: "FND-WIN-" + Date.now() + Math.floor(Math.random() * 1000),
            title: "គម្រោងសន្សំជោគជ័យ! 🎉",
            message: `គម្រោង "${fund.name}" សម្រេចគោលដៅហើយ! ទឹកប្រាក់សរុប $${fund.currentAmount.toLocaleString()} ត្រូវបានដកដោយម្ចាស់គម្រោង (${creatorName}) រួចរាល់។`,
            date: dateNow,
            isRead: false,
            type: "ufund_success",
          });

          mUser.markModified("notifications");

          // Save សមាជិកផ្សេងៗ (ចំណែកឯម្ចាស់គម្រោងនឹងត្រូវ Save នៅខាងក្រោម)
          if (mUser.username !== creatorUser.username) {
            await mUser.save();
          }
        }
      }

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
    } else {
      // ❌ CANCEL: ដកពី Central Bank បង្វិលសងលុយ (Refund) ទៅសមាជិកគ្រប់គ្នាវិញ
      for (let member of fund.members) {
        if (member.contributedAmount > 0) {
          const mUser = await User.findOne({ username: member.username });
          if (mUser) {
            mUser.balance += member.contributedAmount;
            centralBank.balance -= member.contributedAmount;

            const refId = generateRefId();
            const hash = generateHash();

            // វិក្កយបត្រទទួលលុយវិញ (Member)
            await Transaction.create({
              username: mUser.username,
              refId: refId,
              hash: hash,
              date: dateNow,
              type: "U-Fund Refund",
              amount: member.contributedAmount,
              currency: "USD",
              senderName: "U-Pay U-Fund Pool",
              receiverName: mUser.fullName || mUser.username,
              remark: `Fund Cancelled: ${fund.name}`,
              status: "Success",
            });

            // វិក្កយបត្រដកលុយ (Central Bank)
            await Transaction.create({
              username: centralBank.username,
              refId: refId,
              hash: hash,
              date: dateNow,
              type: "U-Fund Pool Refund",
              amount: -member.contributedAmount,
              currency: "USD",
              senderName: "U-Pay U-Fund Pool",
              receiverName: mUser.fullName || mUser.username,
              remark: `Refund to member for ${fund.name}`,
              status: "Success",
            });

            // 🔔 ផ្ញើសារប្រាប់សមាជិកថាគម្រោងត្រូវលុបចោល ហើយលុយបានបង្វិលសងវិញ
            if (!mUser.notifications) mUser.notifications = [];
            mUser.notifications.unshift({
              id: "FND-CANC-" + Date.now() + Math.floor(Math.random() * 1000),
              title: "គម្រោងត្រូវបានរំសាយ ⚠️",
              message: `គម្រោង "${fund.name}" ត្រូវបានបិទមុនកំណត់។ ទឹកប្រាក់ $${member.contributedAmount.toLocaleString()} ត្រូវបានបង្វិលចូលគណនីរបស់អ្នកវិញ។`,
              date: dateNow,
              isRead: false,
              type: "ufund_cancelled",
            });
            mUser.markModified("notifications");

            await mUser.save();
          }
        }
      }

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
