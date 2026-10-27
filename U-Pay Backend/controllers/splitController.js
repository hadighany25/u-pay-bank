// ============================================================================
// ឯកសារ: controllers/splitController.js
// អត្ថន័យ: Controller សម្រាប់គ្រប់គ្រងមុខងារ «រួមគ្នាទូទាត់ (Smart Split Bill)» (100% Pure _id)
// ============================================================================
const bcrypt = require("bcryptjs");
const SplitBill = require("../models/SplitBill");
const User = require("../models/User");

// ============================================================================
// 🛠️ មុខងារជំនួយ (HELPER FUNCTIONS)
// ============================================================================

// ១. បង្កើតទម្រង់កាលបរិច្ឆេទម៉ោងនៅភ្នំពេញ
function getPhnomPenhDateStr() {
  return new Date().toLocaleString("en-US", {
    timeZone: "Asia/Phnom_Penh",
    hour12: true,
  });
}

// ២. ផ្ទៀងផ្ទាត់លេខកូដសម្ងាត់ PIN ៤ ខ្ទង់របស់អ្នកប្រើប្រាស់
async function verifyUserPinCode(userDoc, plainPin) {
  if (!plainPin || !userDoc) return false;
  const storedPin = String(userDoc.pin || "");
  if (storedPin.startsWith("$2a$") || storedPin.startsWith("$2b$")) {
    return await bcrypt.compare(String(plainPin), storedPin);
  }
  return storedPin === String(plainPin);
}

// ============================================================================
// 📌 ១. បង្កើតវិក្កយបត្ររួមគ្នាថ្មី (Create Split Bill)
// គាំទ្រទាំងការមិនបាច់ Add មនុស្ស (កំណត់តែចំនួននាក់) និងការ Add មិត្តភក្តិបាញ់សារ
// ============================================================================
exports.createSplitBill = async (req, res) => {
  try {
    const {
      hostUserId,
      title,
      hostAccount,
      currency,
      splitMode,
      totalAmount,
      perPersonAmount,
      totalHeadcount,
      participants,
    } = req.body;

    const hostUser = await User.findById(hostUserId);
    if (!hostUser) {
      return res
        .status(404)
        .json({ success: false, message: "រកមិនឃើញគណនីម្ចាស់វិក្កយបត្រទេ!" });
    }

    const billId =
      "SPL-" +
      Date.now().toString().slice(-6) +
      Math.floor(10 + Math.random() * 89);
    const nowStr = getPhnomPenhDateStr();

    // រៀបចំបញ្ជីសមាជិក និងកៅអីទទេ (បើអត់បាន Add ឈ្មោះមិត្តភក្តិគ្រប់ចំនួន)
    const finalParticipants = [];
    const inputList = Array.isArray(participants) ? participants : [];
    const targetCount = Math.max(2, Number(totalHeadcount) || inputList.length);

    for (let i = 0; i < targetCount; i++) {
      const existing = inputList[i];
      if (existing) {
        finalParticipants.push({
          slotNumber: i + 1,
          userId: existing.userId || null,
          username: existing.username || "",
          fullName: existing.fullName || `សមាជិកទី ${i + 1}`,
          profileImage: existing.profileImage || "",
          isHost: Boolean(existing.isHost),
          amount: Number(existing.amount || perPersonAmount || 0),
          status: existing.isHost ? "Paid" : "Pending",
          paidAt: existing.isHost ? nowStr : "",
          refId: existing.isHost ? "HOST-SHARE" : "",
        });
      } else {
        finalParticipants.push({
          slotNumber: i + 1,
          userId: null,
          username: "",
          fullName: `សមាជិកទី ${i + 1} (រង់ចាំស្កេន/បង់)`,
          profileImage: "",
          isHost: false,
          amount: Number(perPersonAmount || 0),
          status: "Pending",
        });
      }
    }

    const newSplit = await SplitBill.create({
      billId,
      title: title || "រួមគ្នាទូទាត់",
      hostUserId: hostUser._id,
      hostUsername: hostUser.username,
      hostFullName: hostUser.fullName || hostUser.username,
      hostProfileImage: hostUser.profileImage || "",
      hostAccount,
      currency: currency === "KHR" ? "KHR" : "USD",
      splitMode: splitMode === "custom" ? "custom" : "equal",
      totalAmount: Number(totalAmount),
      perPersonAmount: Number(perPersonAmount),
      totalHeadcount: targetCount,
      participants: finalParticipants,
      status: "Active",
      createdAtStr: nowStr,
    });

    // 🔔 ប្រសិនបើមាន Add មិត្តភក្តិដែលជាសមាជិក U-Pay (មាន userId) ត្រូវបាញ់សារជូនដំណឹងទៅពួកគេភ្លាមៗ!
    const io = req.app.get("io");
    const sym = currency === "KHR" ? "៛" : "$";

    for (const p of finalParticipants) {
      if (!p.isHost && p.userId && String(p.userId) !== String(hostUser._id)) {
        const friendDoc = await User.findById(p.userId);
        if (friendDoc) {
          const amtStr =
            currency === "KHR"
              ? Math.round(p.amount).toLocaleString("en-US")
              : Number(p.amount).toFixed(2);

          const notifObj = {
            id: "NOTIF-SPL-" + Date.now() + "-" + p.slotNumber,
            title: "🧾 សំណើរួមគ្នាទូទាត់ (Split Bill)",
            message: `${hostUser.fullName || hostUser.username} បានស្នើសុំរួមគ្នាទូទាត់លើ «${newSplit.title}» ចំណែករបស់អ្នកគឺ ${sym}${amtStr}។ ចុចចូលទៅទូទាត់ក្នុងម៉ឺនុយ រួមគ្នាទូទាត់!`,
            date: nowStr,
            isRead: false,
            type: "split_bill_request",
            metadata: {
              billId: newSplit.billId,
              hostUserId: String(hostUser._id),
              hostName: hostUser.fullName || hostUser.username,
              hostAccount: newSplit.hostAccount,
              amount: p.amount,
              currency: newSplit.currency,
              title: newSplit.title,
            },
          };

          friendDoc.notifications = friendDoc.notifications || [];
          friendDoc.notifications.unshift(notifObj);
          await friendDoc.save();

          if (io) {
            io.to(String(friendDoc._id)).emit("splitBillInvited", {
              billId: newSplit.billId,
              hostName: hostUser.fullName || hostUser.username,
              amount: p.amount,
              currency: newSplit.currency,
              title: newSplit.title,
            });
            io.to(String(friendDoc._id)).emit("transactionUpdated");
          }
        }
      }
    }

    return res.json({
      success: true,
      message: "បានបង្កើតវិក្កយបត្ររួមគ្នាដោយជោគជ័យ!",
      bill: newSplit,
    });
  } catch (err) {
    console.error("Create Split Bill Error:", err);
    return res
      .status(500)
      .json({ success: false, message: "មានបញ្ហាក្នុងការបង្កើតវិក្កយបត្រ!" });
  }
};

// ============================================================================
// 📌 ២. ទាញយកបញ្ជីវិក្កយបត្រទាំងអស់របស់ខ្ញុំ (Get My Split Bills)
// ============================================================================
exports.getMySplitBills = async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ success: false, message: "ខ្វះ userId!" });
    }

    const bills = await SplitBill.find({
      $or: [{ hostUserId: userId }, { "participants.userId": userId }],
    })
      .sort({ createdAt: -1 })
      .limit(40);

    return res.json({ success: true, bills });
  } catch (err) {
    return res
      .status(500)
      .json({ success: false, message: "បរាជ័យក្នុងការទាញទិន្នន័យ" });
  }
};

// ============================================================================
// 📌 ៣. ទាញយកព័ត៌មានលម្អិតនៃវិក្កយបត្រ ១ តាមរយៈ billId (Get Bill Detail)
// ============================================================================
exports.getSplitBillDetail = async (req, res) => {
  try {
    const bill = await SplitBill.findOne({ billId: req.params.billId });
    if (!bill) {
      return res
        .status(404)
        .json({ success: false, message: "រកមិនឃើញវិក្កយបត្រនេះទេ!" });
    }
    return res.json({ success: true, bill });
  } catch (err) {
    return res
      .status(500)
      .json({ success: false, message: "មានបញ្ហាទាញព័ត៌មានវិក្កយបត្រ" });
  }
};

// ============================================================================
// 📌 ៤. ទូទាត់ប្រាក់ចំណែកវិក្កយបត្រផ្ទាល់នៅក្នុង split.html (Pay Split Share)
// ============================================================================
exports.paySplitBillShare = async (req, res) => {
  try {
    const { payerUserId, billId, fromAccountNumber, slotNumber, pin } =
      req.body;

    const payer = await User.findById(payerUserId);
    if (!payer) {
      return res
        .status(404)
        .json({ success: false, message: "រកមិនឃើញគណនីអ្នកទូទាត់ទេ!" });
    }

    // ១. ផ្ទៀងផ្ទាត់លេខកូដ PIN ៤ ខ្ទង់
    const isPinOk = await verifyUserPinCode(payer, pin);
    if (!isPinOk) {
      return res
        .status(400)
        .json({
          success: false,
          message: "លេខកូដសម្ងាត់ PIN មិនត្រឹមត្រូវទេ!",
        });
    }

    const bill = await SplitBill.findOne({ billId });
    if (!bill) {
      return res
        .status(404)
        .json({ success: false, message: "រកមិនឃើញវិក្កយបត្រនេះទេ!" });
    }
    if (bill.status !== "Active") {
      return res.status(400).json({
        success: false,
        message: "វិក្កយបត្រនេះត្រូវបានបិទ ឬបញ្ចប់រួចហើយ!",
      });
    }

    const host = await User.findById(bill.hostUserId);
    if (!host) {
      return res
        .status(404)
        .json({ success: false, message: "រកមិនឃើញគណនីម្ចាស់វិក្កយបត្រទេ!" });
    }

    // ២. ស្វែងរកកៅអី (Slot) របស់អ្នកបង់ប្រាក់
    let targetSlot = null;
    if (slotNumber) {
      targetSlot = bill.participants.find(
        (p) => p.slotNumber === Number(slotNumber) && p.status !== "Paid",
      );
    }
    if (!targetSlot) {
      targetSlot = bill.participants.find(
        (p) =>
          p.userId &&
          String(p.userId) === String(payer._id) &&
          p.status !== "Paid",
      );
    }
    if (!targetSlot) {
      targetSlot = bill.participants.find(
        (p) => !p.isHost && !p.userId && p.status !== "Paid",
      );
    }
    if (!targetSlot) {
      targetSlot = bill.participants.find(
        (p) => !p.isHost && p.status !== "Paid",
      );
    }

    if (!targetSlot) {
      return res.status(400).json({
        success: false,
        message: "វិក្កយបត្រនេះត្រូវបានសមាជិកទូទាត់គ្រប់ចំនួនអស់ហើយ!",
      });
    }

    const payAmount = Number(targetSlot.amount || bill.perPersonAmount);
    const cur = bill.currency;

    // ៣. ត្រួតពិនិត្យ និងកាត់លុយពីគណនីរបស់អ្នកបង់ (Payer)
    let payerAccUsed = "";
    if (
      payer.mainAccounts?.[cur] &&
      (!fromAccountNumber ||
        payer.mainAccounts[cur].accountNumber === fromAccountNumber)
    ) {
      if (payer.mainAccounts[cur].isFrozen) {
        return res
          .status(400)
          .json({
            success: false,
            message: "គណនីរបស់អ្នកកំពុងជាប់សោ (Frozen)!",
          });
      }
      if ((payer.mainAccounts[cur].balance || 0) < payAmount) {
        return res.status(400).json({
          success: false,
          message: `សមតុល្យគណនី ${cur} របស់អ្នកមិនគ្រប់គ្រាន់ទេ!`,
        });
      }
      payer.mainAccounts[cur].balance -= payAmount;
      payerAccUsed = payer.mainAccounts[cur].accountNumber;
      if (cur === "USD") payer.balance = payer.mainAccounts.USD.balance;
      if (cur === "KHR") payer.balanceKHR = payer.mainAccounts.KHR.balance;
    } else {
      const subAcc = (payer.subAccounts || []).find(
        (s) => s.accountNumber === fromAccountNumber && s.currency === cur,
      );
      if (!subAcc) {
        return res.status(400).json({
          success: false,
          message: `រកមិនឃើញគណនី ${cur} សម្រាប់កាត់ប្រាក់ទេ!`,
        });
      }
      if (subAcc.isFrozen || subAcc.isLocked) {
        return res
          .status(400)
          .json({ success: false, message: "គណនីរងនេះកំពុងជាប់សោ!" });
      }
      if ((subAcc.balance || 0) < payAmount) {
        return res
          .status(400)
          .json({
            success: false,
            message: "សមតុល្យក្នុងគណនីរងមិនគ្រប់គ្រាន់ទេ!",
          });
      }
      subAcc.balance -= payAmount;
      payerAccUsed = subAcc.accountNumber;
    }

    // ៤. បញ្ចូលលុយទៅកាន់គណនីរបស់ម្ចាស់វិក្កយបត្រ (Host)
    const hostTargetAcc = bill.hostAccount;
    let creditedHost = false;

    if (host.mainAccounts?.[cur]?.accountNumber === hostTargetAcc) {
      host.mainAccounts[cur].balance =
        (host.mainAccounts[cur].balance || 0) + payAmount;
      if (cur === "USD") host.balance = host.mainAccounts.USD.balance;
      if (cur === "KHR") host.balanceKHR = host.mainAccounts.KHR.balance;
      creditedHost = true;
    } else {
      const hSub = (host.subAccounts || []).find(
        (s) => s.accountNumber === hostTargetAcc,
      );
      if (hSub) {
        hSub.balance = (hSub.balance || 0) + payAmount;
        creditedHost = true;
      }
    }

    if (!creditedHost && host.mainAccounts?.[cur]) {
      host.mainAccounts[cur].balance =
        (host.mainAccounts[cur].balance || 0) + payAmount;
      if (cur === "USD") host.balance = host.mainAccounts.USD.balance;
      if (cur === "KHR") host.balanceKHR = host.mainAccounts.KHR.balance;
    }

    // ៥. កត់ត្រាប្រវត្តិប្រតិបត្តិការទាំងសងខាង និងធ្វើបច្ចុប្បន្នភាពស្ថានភាពកៅអីក្នុង SplitBill
    const refId = "SPL" + Date.now().toString().slice(-8);
    const nowStr = getPhnomPenhDateStr();

    const payerTrx = {
      refId,
      date: nowStr,
      type: "Split Bill Payment",
      trxMethod: "U-Pay Split Bill",
      amount: -payAmount,
      currency: cur,
      senderName: payer.fullName || payer.username,
      senderAcc: payerAccUsed,
      receiverName: host.fullName || host.username,
      receiverAcc: hostTargetAcc,
      remark: `រួមគ្នាទូទាត់៖ ${bill.title} (#${bill.billId})`,
      status: "Success",
      userId: String(payer._id),
    };

    const hostTrx = {
      refId,
      date: nowStr,
      type: "Split Bill Received",
      trxMethod: "U-Pay Split Bill",
      amount: payAmount,
      currency: cur,
      senderName: payer.fullName || payer.username,
      senderAcc: payerAccUsed,
      receiverName: host.fullName || host.username,
      receiverAcc: hostTargetAcc,
      remark: `ទទួលពីការរួមគ្នាទូទាត់៖ ${bill.title} (#${bill.billId})`,
      status: "Success",
      userId: String(host._id),
    };

    payer.transactions = payer.transactions || [];
    payer.transactions.unshift(payerTrx);

    host.transactions = host.transactions || [];
    host.transactions.unshift(hostTrx);

    const sym = cur === "KHR" ? "៛" : "$";
    const fmtAmt =
      cur === "KHR"
        ? Math.round(payAmount).toLocaleString("en-US")
        : payAmount.toFixed(2);

    host.notifications = host.notifications || [];
    host.notifications.unshift({
      id: "NOTIF-PAID-" + Date.now(),
      title: "✅ ទទួលបានប្រាក់រួមគ្នាទូទាត់!",
      message: `${payer.fullName || payer.username} បានទូទាត់ចំណែក ${sym}${fmtAmt} សម្រាប់ «${bill.title}» រួចរាល់ហើយ!`,
      date: nowStr,
      isRead: false,
      type: "split_bill_paid",
    });

    // ធ្វើបច្ចុប្បន្នភាពឈ្មោះ និងស្ថានភាពកៅអីក្នុង SplitBill
    targetSlot.userId = payer._id;
    targetSlot.username = payer.username;
    targetSlot.fullName = payer.fullName || payer.username;
    targetSlot.profileImage = payer.profileImage || "";
    targetSlot.status = "Paid";
    targetSlot.paidAt = nowStr;
    targetSlot.refId = refId;

    const allPaid = bill.participants.every((p) => p.status === "Paid");
    if (allPaid) bill.status = "Completed";

    await payer.save();
    await host.save();
    await bill.save();

    // ៦. បាញ់ Socket.io ប្រាប់ម្ចាស់វិក្កយបត្រភ្លាមៗ!
    const io = req.app.get("io");
    if (io) {
      io.to(String(host._id)).emit("splitBillUpdated", { bill });
      io.to(String(host._id)).emit("paymentReceived", {
        amount: payAmount,
        currency: cur,
        senderName: payer.fullName || payer.username,
        refId,
        trxMethod: "រួមគ្នាទូទាត់ (Split Bill)",
      });
      io.to(String(payer._id)).emit("splitBillUpdated", { bill });
    }

    return res.json({
      success: true,
      message: "ទូទាត់ចំណែកវិក្កយបត្រជោគជ័យ!",
      transaction: payerTrx,
      bill,
      user: payer,
    });
  } catch (err) {
    console.error("Pay Split Bill Error:", err);
    return res
      .status(500)
      .json({ success: false, message: "មានបញ្ហាក្នុងការទូទាត់វិក្កយបត្រ!" });
  }
};

// ============================================================================
// 📌 ៥. ម្ចាស់វិក្កយបត្រចុចបញ្ជាក់ថាសមាជិកបានបង់ប្រាក់សុទ្ធរួច (Mark Slot as Paid)
// ============================================================================
exports.markSlotAsPaid = async (req, res) => {
  try {
    const { hostUserId, billId, slotNumber } = req.body;
    const bill = await SplitBill.findOne({ billId, hostUserId });
    if (!bill) {
      return res
        .status(404)
        .json({ success: false, message: "រកមិនឃើញវិក្កយបត្រទេ!" });
    }

    const slot = bill.participants.find(
      (p) => p.slotNumber === Number(slotNumber),
    );
    if (slot) {
      slot.status = "Paid";
      slot.paidAt = getPhnomPenhDateStr();
      slot.refId = "CASH-MANUAL";
    }

    if (bill.participants.every((p) => p.status === "Paid")) {
      bill.status = "Completed";
    }
    await bill.save();

    return res.json({ success: true, bill });
  } catch (err) {
    return res
      .status(500)
      .json({ success: false, message: "មិនអាចធ្វើបច្ចុប្បន្នភាពបានទេ" });
  }
};

// ============================================================================
// 📌 ៦. បន្ថែមមិត្តភក្តិថ្មីចូលក្នុងវិក្កយបត្រដែលមានស្រាប់ (Add Member to Bill)
// ============================================================================
exports.addMemberToSplitBill = async (req, res) => {
  try {
    const { hostUserId, billId, memberQuery } = req.body;
    const bill = await SplitBill.findOne({ billId, hostUserId });
    if (!bill) {
      return res
        .status(404)
        .json({ success: false, message: "រកមិនឃើញវិក្កយបត្រទេ!" });
    }

    const cleanQ = String(memberQuery || "")
      .replace(/^@/, "")
      .trim();
    const foundUser = await User.findOne({
      $or: [
        { username: new RegExp(`^${cleanQ}$`, "i") },
        { phone: cleanQ },
        { "mainAccounts.USD.accountNumber": cleanQ },
        { "mainAccounts.KHR.accountNumber": cleanQ },
      ],
    });

    const newSlotNum = bill.participants.length + 1;
    const newMember = {
      slotNumber: newSlotNum,
      userId: foundUser ? foundUser._id : null,
      username: foundUser ? foundUser.username : "",
      fullName: foundUser
        ? foundUser.fullName || foundUser.username
        : cleanQ || `សមាជិកទី ${newSlotNum}`,
      profileImage: foundUser ? foundUser.profileImage || "" : "",
      isHost: false,
      amount: bill.perPersonAmount,
      status: "Pending",
    };

    bill.participants.push(newMember);
    bill.totalHeadcount = bill.participants.length;
    bill.totalAmount += Number(bill.perPersonAmount);
    await bill.save();

    if (foundUser) {
      const sym = bill.currency === "KHR" ? "៛" : "$";
      foundUser.notifications = foundUser.notifications || [];
      foundUser.notifications.unshift({
        id: "NOTIF-SPL-" + Date.now(),
        title: "🧾 សំណើរួមគ្នាទូទាត់ (Split Bill)",
        message: `${bill.hostFullName} បានបន្ថែមអ្នកចូលក្នុងការរួមគ្នាទូទាត់ «${bill.title}» ចំនួន ${sym}${bill.perPersonAmount.toLocaleString()}។`,
        date: getPhnomPenhDateStr(),
        isRead: false,
        type: "split_bill_request",
        metadata: {
          billId: bill.billId,
          hostName: bill.hostFullName,
          hostAccount: bill.hostAccount,
          amount: bill.perPersonAmount,
          currency: bill.currency,
          title: bill.title,
        },
      });
      await foundUser.save();
    }

    return res.json({
      success: true,
      message: "បានបន្ថែមសមាជិកថ្មីរួចរាល់!",
      bill,
    });
  } catch (err) {
    return res
      .status(500)
      .json({ success: false, message: "មិនអាចបន្ថែមសមាជិកបានទេ" });
  }
};

// ============================================================================
// 📌 ៧. គោះតឿនសមាជិកដែលមិនទាន់បង់ប្រាក់ (Remind Unpaid Member)
// ============================================================================
exports.remindSplitMember = async (req, res) => {
  try {
    const { hostUserId, billId, slotNumber } = req.body;
    const bill = await SplitBill.findOne({ billId, hostUserId });
    if (!bill) {
      return res
        .status(404)
        .json({ success: false, message: "រកមិនឃើញវិក្កយបត្រទេ!" });
    }

    const slot = bill.participants.find(
      (p) => p.slotNumber === Number(slotNumber),
    );
    if (!slot || !slot.userId) {
      return res.status(400).json({
        success: false,
        message:
          "សមាជិកនេះជាកៅអីទូទៅ សូមផ្ញើ QR ឬ Link ទៅគាត់តាមរយៈ Chat ផ្ទាល់!",
      });
    }

    const friendDoc = await User.findById(slot.userId);
    if (friendDoc) {
      const sym = bill.currency === "KHR" ? "៛" : "$";
      friendDoc.notifications = friendDoc.notifications || [];
      friendDoc.notifications.unshift({
        id: "NOTIF-REM-" + Date.now(),
        title: "🔔 រំលឹកការរួមគ្នាទូទាត់ (Split Bill Reminder)",
        message: `${bill.hostFullName} កំពុងរង់ចាំការទូទាត់ចំណែករបស់អ្នកចំនួន ${sym}${slot.amount.toLocaleString()} សម្រាប់ «${bill.title}»។`,
        date: getPhnomPenhDateStr(),
        isRead: false,
        type: "split_bill_request",
        metadata: {
          billId: bill.billId,
          hostName: bill.hostFullName,
          hostAccount: bill.hostAccount,
          amount: slot.amount,
          currency: bill.currency,
          title: bill.title,
        },
      });
      await friendDoc.save();
    }

    return res.json({
      success: true,
      message: `បានផ្ញើសាររំលឹកទៅកាន់ ${slot.fullName} រួចរាល់!`,
    });
  } catch (err) {
    return res
      .status(500)
      .json({ success: false, message: "មិនអាចផ្ញើសាររំលឹកបានទេ" });
  }
};

// ============================================================================
// 📌 ៨. លុបវិក្កយបត្រចោល (Delete Split Bill)
// ============================================================================
exports.deleteSplitBill = async (req, res) => {
  try {
    const { userId } = req.query;
    await SplitBill.findOneAndDelete({
      billId: req.params.billId,
      hostUserId: userId,
    });
    return res.json({ success: true, message: "បានលុបវិក្កយបត្ររួចរាល់!" });
  } catch (err) {
    return res
      .status(500)
      .json({ success: false, message: "មិនអាចលុបវិក្កយបត្របានទេ" });
  }
};
