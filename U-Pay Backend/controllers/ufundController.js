const User = require("../models/User");
const UFund = require("../models/UFund");
const Transaction = require("../models/Transaction"); // ត្រូវប្រើដើម្បីកត់ត្រាវិក្កយបត្រ
const {
  getFormattedDate,
  generateRefId,
  generateHash,
} = require("../services/helpers");

// ១. បង្កើត U-Fund ថ្មី (Personal ឬ Group)
exports.createFund = async (req, res) => {
  const { username, name, targetAmount, type, isLocked } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user) return res.json({ success: false, message: "User not found!" });

    const newFund = new UFund({
      name,
      type: type || "personal", // personal ឬ group
      targetAmount: parseFloat(targetAmount),
      creator: username,
      isLocked: isLocked || false,
      qrCodeString: `UFND-${Date.now()}-${username}`, // សម្រាប់ស្កេនដាក់លុយ
      members: [
        {
          username: user.username,
          fullName: user.fullName || user.username,
          role: "admin",
          status: "active",
          contributedAmount: 0,
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
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// ២. អញ្ជើញសមាជិក (វាយបញ្ចូល Username, លេខទូរស័ព្ទ ឬ លេខគណនី)
exports.inviteMember = async (req, res) => {
  const { fundId, inviteeIdentifier, inviterUsername } = req.body;
  try {
    const fund = await UFund.findById(fundId);
    if (!fund)
      return res.json({ success: false, message: "រកប្រអប់សន្សំមិនឃើញ!" });

    // ស្វែងរកអ្នកដែលត្រូវអញ្ជើញ
    const invitee = await User.findOne({
      $or: [
        { username: inviteeIdentifier },
        { phone: inviteeIdentifier },
        { phoneNumber: inviteeIdentifier },
        { accountNumber: inviteeIdentifier },
        { accountNumberKHR: inviteeIdentifier },
      ],
    });

    if (!invitee)
      return res.json({ success: false, message: "រកមិនឃើញគណនីមិត្តភក្តិទេ!" });

    // ឆែកក្រែងលោគាត់មានឈ្មោះរួចហើយ
    const existingMember = fund.members.find(
      (m) => m.username === invitee.username,
    );
    if (existingMember)
      return res.json({
        success: false,
        message: "មិត្តភក្តិនេះស្ថិតក្នុងក្រុមរួចហើយ!",
      });

    // បន្ថែមជា Pending Member
    fund.members.push({
      username: invitee.username,
      fullName: invitee.fullName || invitee.username,
      role: "member",
      status: "pending", // ត្រូវចាំគាត់ Accept តាម UI
    });

    // បាញ់ Notification ទៅប្រាប់គាត់
    if (!invitee.notifications) invitee.notifications = [];
    invitee.notifications.unshift({
      id: "INV-" + Date.now(),
      title: "ការអញ្ជើញចូល U-Fund 🎯",
      message: `${inviterUsername} បានអញ្ជើញអ្នកឱ្យចូលរួមសន្សំប្រាក់ក្នុងក្រុម "${fund.name}"។`,
      date: getFormattedDate(),
      isRead: false,
      type: "ufund_invite",
      fundId: fund._id,
    });
    invitee.markModified("notifications");

    await Promise.all([fund.save(), invitee.save()]);
    res.json({ success: true, message: "បានផ្ញើការអញ្ជើញជោគជ័យ!" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// ៣. ដាក់ប្រាក់ចូល U-Fund (Manual Deposit)
exports.depositFund = async (req, res) => {
  const { username, fundId, amount, isAuto } = req.body;
  try {
    const user = await User.findOne({ username });
    const fund = await UFund.findById(fundId);

    if (!user || !fund)
      return res.json({ success: false, message: "ទិន្នន័យមិនត្រឹមត្រូវ!" });

    const depositAmount = parseFloat(amount);
    if (user.balance < depositAmount) {
      // បើជាការកាត់ Auto ហើយអត់លុយ ត្រូវដូរ Status គាត់ទៅជា Overdue (ជំពាក់)
      if (isAuto) {
        const member = fund.members.find((m) => m.username === username);
        if (member) member.status = "overdue";
        await fund.save();
        return res.json({
          success: false,
          message: "ការកាត់ប្រាក់ស្វ័យប្រវត្តិបរាជ័យ។ សមតុល្យមិនគ្រប់គ្រាន់!",
        });
      }
      return res.json({
        success: false,
        message: "ទឹកប្រាក់របស់អ្នកមិនគ្រប់គ្រាន់ទេ!",
      });
    }

    // ១. កាត់លុយពី User
    user.balance -= depositAmount;

    // ២. បញ្ចូលលុយទៅ U-Fund
    fund.currentAmount += depositAmount;

    // Update លុយសមាជិក និងដោះ Status "overdue" ចេញ (បើធ្លាប់ជំពាក់)
    const member = fund.members.find((m) => m.username === username);
    if (member) {
      member.contributedAmount += depositAmount;
      if (member.status === "overdue") member.status = "active";
    }

    const dateNow = getFormattedDate();
    const refId = generateRefId();

    // ៣. កត់ត្រាប្រវត្តិក្នុង U-Fund (Shared History)
    fund.history.unshift({
      refId: refId,
      username: user.username,
      fullName: user.fullName || user.username,
      amount: depositAmount,
      date: dateNow,
      type: "deposit",
      remark: isAuto ? "Auto Deposit" : "Manual Deposit",
    });

    // ៤. បង្កើតវិក្កយបត្រពិតប្រាកដក្នុង Transaction Collection
    await Transaction.create({
      refId: refId,
      hash: generateHash(),
      date: dateNow,
      type: "U-Fund Deposit",
      amount: -depositAmount,
      currency: "USD",
      senderName: user.fullName || user.username,
      senderAcc: user.accountNumber,
      receiverName: `U-Fund: ${fund.name}`,
      receiverAcc: "U-FUND-SYSTEM",
      remark: "Saved to U-Fund",
      status: "Success",
      trxMethod: "U-PAY App",
    });

    await Promise.all([user.save(), fund.save()]);

    res.json({ success: true, message: "ដាក់ប្រាក់ជោគជ័យ!", fund });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// ៤. ទាញយកបញ្ជី U-Fund របស់ User ទាំងអស់មកបង្ហាញ
exports.getMyFunds = async (req, res) => {
  const { username } = req.body;
  try {
    // រកមើលប្រអប់ណាដែលមានឈ្មោះគាត់ជា Member (ទាំង Pending ទាំង Active)
    const funds = await UFund.find({ "members.username": username }).sort({
      createdAt: -1,
    });
    res.json({ success: true, funds });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// ៥. កំណត់ Auto Deposit សម្រាប់សមាជិក
exports.setAutoDeposit = async (req, res) => {
  const { username, fundId, enabled, amount, frequency } = req.body;
  try {
    const fund = await UFund.findById(fundId);
    const member = fund.members.find((m) => m.username === username);
    if (member) {
      member.autoDeposit = { enabled, amount, frequency };
      await fund.save();
      res.json({ success: true });
    }
  } catch (e) {
    res.status(500).json({ success: false });
  }
};
