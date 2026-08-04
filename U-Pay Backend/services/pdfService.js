const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const QRCode = require("qrcode");
const crypto = require("crypto");
const mongoose = require("mongoose");
const EscrowTransaction = require("../models/EscrowTransaction");
const Transaction = require("../models/Transaction");

const formatDateTime = (dateInput) => {
  if (!dateInput) return "N/A";
  const d = new Date(dateInput);
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const day = String(d.getDate()).padStart(2, "0");
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const seconds = String(d.getSeconds()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${day} ${month} ${year}, ${String(hours).padStart(2, "0")}:${minutes}:${seconds} ${ampm}`;
};

const streamOfficialReceiptPDF = async (transactionId, res) => {
  try {
    // 🌟 អាគមសំខាន់៖ បង្កើតលក្ខខណ្ឌស្វែងរកដ៏ឆ្លាតវៃ (រុករកគ្រប់កន្លែង)
    let queryConditions = [
      { transactionId: transactionId },
      { referenceId: transactionId },
      { upayTransactionId: transactionId },
      { txId: transactionId },
      { txnId: transactionId },
    ];

    // បើវាជា ObjectId របស់ Mongo (ដូចជា w._id ដែលបញ្ជូនពី U-Mall)
    if (mongoose.Types.ObjectId.isValid(transactionId)) {
      queryConditions.push({ _id: transactionId });
    }

    // ទី១៖ ស្វែងរកក្នុង Escrow ជាមុន
    let transaction = await EscrowTransaction.findOne({
      $or: queryConditions,
    }).populate("merchantId");
    let merchant = {};

    // ទី២៖ បើគ្មានក្នុង Escrow ទេ គឺច្បាស់ជាប្រតិបត្តិការ "ដកប្រាក់ (Withdrawal)"
    if (!transaction) {
      transaction = await Transaction.findOne({ $or: queryConditions });

      if (!transaction) {
        return res.status(404).send(`
          <div style="text-align:center; padding: 50px; font-family: Arial, sans-serif;">
            <h2 style="color: red;">⚠️ រកមិនឃើញប្រតិបត្តិការទេ (Transaction Not Found)</h2>
            <p>លេខ ID: <b>${transactionId}</b> ពុំមាននៅក្នុង Database របស់ធនាគារ U-Pay ឡើយ។</p>
          </div>
        `);
      }

      // រៀបចំទិន្នន័យដកប្រាក់ឱ្យចូលទម្រង់ PDF
      merchant = {
        name: "U-Mall Withdrawal (ដកប្រាក់)",
        accountNumber: transaction.senderPhone || "System Payout",
        merchantId: "WITHDRAWAL",
      };

      transaction.referenceId =
        transaction.referenceId || transaction.transactionId || transactionId;
      transaction.receiverName =
        transaction.accountName ||
        transaction.receiverName ||
        transaction.bankName ||
        "Bank Account";
      transaction.receiverAccount =
        transaction.accountNumber ||
        transaction.receiverAccount ||
        transaction.receiverPhone ||
        "N/A";
      transaction.type = "Payout / Withdrawal";
      transaction.remark =
        transaction.note || transaction.remark || "ទូទាត់ប្រាក់ពី U-Mall ទៅហាង";
      transaction.amount = transaction.amount || 0;
      transaction.fee = transaction.fee || 0;
    } else {
      merchant = transaction.merchantId || {};
    }

    // --- ដំណើរការបង្កើត PDF ---
    const fileName = `Receipt-${transaction.referenceId || transactionId}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);

    const fontKhmer = path.join(
      __dirname,
      "../public/fonts/NotoSansKhmer-Regular.ttf",
    );
    const fontEnReg = path.join(__dirname, "../public/fonts/Inter-Regular.ttf");
    const fontEnMedium = path.join(
      __dirname,
      "../public/fonts/Inter-Medium.ttf",
    );
    const fontEnSemiBold = path.join(
      __dirname,
      "../public/fonts/Inter-SemiBold.ttf",
    );
    const fontEnBold = path.join(__dirname, "../public/fonts/Inter-Bold.ttf");
    const logoPath = path.join(__dirname, "../public/images/logo.png");
    const headerBgPath = path.join(__dirname, "../public/images/header-bg.png");

    const doc = new PDFDocument({ size: "A4", margin: 0 });
    doc.pipe(res);

    if (fs.existsSync(fontKhmer)) doc.registerFont("Khmer", fontKhmer);
    if (fs.existsSync(fontEnReg)) doc.registerFont("En-Reg", fontEnReg);
    if (fs.existsSync(fontEnMedium))
      doc.registerFont("En-Medium", fontEnMedium);
    if (fs.existsSync(fontEnSemiBold))
      doc.registerFont("En-SemiBold", fontEnSemiBold);
    if (fs.existsSync(fontEnBold)) doc.registerFont("En-Bold", fontEnBold);

    doc.save();
    doc.opacity(0.05);
    if (fs.existsSync(logoPath)) doc.image(logoPath, 110, 240, { width: 380 });
    doc.restore();

    if (fs.existsSync(headerBgPath)) {
      doc.image(headerBgPath, 0, 0, { width: 595, height: 110 });
    } else {
      doc.rect(0, 0, 595, 110).fill("#00a86b");
    }

    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 40, 30, { width: 120 });
      doc
        .font("En-Medium")
        .fontSize(7)
        .fillColor("#ffffff")
        .text("FAST • SECURE • TRUSTED", 40, 75, { characterSpacing: 1.5 });
    }

    const khmerFont = fs.existsSync(fontKhmer) ? "Khmer" : "En-Bold";
    doc
      .font(khmerFont)
      .fontSize(14)
      .fillColor("#ffffff")
      .text("ប័ណ្ណទទួលប្រាក់", 0, 35, { align: "right", width: 555 });
    doc
      .font("En-Medium")
      .fontSize(10)
      .text("PAYMENT RECEIPT", 0, 55, { align: "right", width: 555 });

    let currentY = 140;
    const marginX = 40;

    doc
      .font(khmerFont)
      .fontSize(12)
      .fillColor("#10b981")
      .text("ទូទាត់ដោយជោគជ័យ", marginX, currentY);
    doc.roundedRect(marginX, currentY + 18, 85, 18, 9).fill("#10b981");
    doc
      .font("En-Bold")
      .fontSize(9)
      .fillColor("#ffffff")
      .text("SUCCESSFUL", marginX, currentY + 22.5, {
        align: "center",
        width: 85,
      });

    doc
      .font("En-Reg")
      .fontSize(9)
      .fillColor("#4a5568")
      .text(`Reference No:`, 300, currentY);
    doc
      .font("En-SemiBold")
      .fillColor("#1a202c")
      .text(transaction.referenceId || "N/A", 400, currentY, {
        align: "right",
        width: 155,
      });
    doc
      .font("En-Reg")
      .fillColor("#4a5568")
      .text(`Transaction Date:`, 300, currentY + 18);

    const formattedDate = formatDateTime(transaction.createdAt || Date.now());
    doc
      .font("En-SemiBold")
      .fillColor("#1a202c")
      .text(formattedDate, 400, currentY + 18, { align: "right", width: 155 });

    currentY += 60;

    // BOX FROM
    doc
      .roundedRect(marginX, currentY, 245, 90, 8)
      .fillAndStroke("#ffffff", "#e2e8f0");
    doc.roundedRect(marginX, currentY, 245, 25, 8).fill("#00a86b");
    doc
      .font(khmerFont)
      .fontSize(9)
      .fillColor("#ffffff")
      .text("អ្នកបង់ប្រាក់ FROM", marginX + 10, currentY + 7);
    doc
      .font("En-Reg")
      .fontSize(8.5)
      .fillColor("#718096")
      .text("Account Name", marginX + 10, currentY + 35);
    doc
      .font("En-SemiBold")
      .fillColor("#2d3748")
      .text(merchant.name || "N/A", marginX + 10, currentY + 47);
    doc
      .font("En-Reg")
      .fillColor("#718096")
      .text("Account Number", marginX + 10, currentY + 65);
    doc
      .font("En-SemiBold")
      .fillColor("#2d3748")
      .text(merchant.accountNumber || "-", marginX + 10, currentY + 77);

    // BOX TO
    doc
      .roundedRect(310, currentY, 245, 90, 8)
      .fillAndStroke("#ffffff", "#e2e8f0");
    doc.roundedRect(310, currentY, 245, 25, 8).fill("#00a86b");
    doc
      .font(khmerFont)
      .fontSize(9)
      .fillColor("#ffffff")
      .text("អ្នកទទួលប្រាក់ TO", 320, currentY + 7);
    doc
      .font("En-Reg")
      .fontSize(8.5)
      .fillColor("#718096")
      .text("Recipient Name", 320, currentY + 35);
    doc
      .font("En-SemiBold")
      .fillColor("#2d3748")
      .text(transaction.receiverName || "N/A", 320, currentY + 47);
    doc
      .font("En-Reg")
      .fillColor("#718096")
      .text("Account Number", 320, currentY + 65);
    doc
      .font("En-SemiBold")
      .fillColor("#2d3748")
      .text(transaction.receiverAccount || "-", 320, currentY + 77);

    currentY += 120;

    // DETAILS
    doc.roundedRect(marginX, currentY, 220, 20, 4).fill("#008080");
    doc
      .font(khmerFont)
      .fontSize(9)
      .fillColor("#ffffff")
      .text("ព័ត៌មានប្រតិបត្តិការ", marginX + 10, currentY + 4.5);
    doc
      .font("En-SemiBold")
      .text("TRANSACTION DETAILS", marginX + 90, currentY + 5);

    currentY += 35;

    const drawRow = (label, value, isBold = false, isKhmer = false) => {
      const displayValue = String(value || "-");
      const fontName = isKhmer ? khmerFont : isBold ? "En-Bold" : "En-Medium";
      const fontSize = isBold ? 11 : 9;

      const labelHeight = doc
        .font("En-Reg")
        .fontSize(9)
        .heightOfString(label, { width: 200 });
      const valueHeight = doc
        .font(fontName)
        .fontSize(fontSize)
        .heightOfString(displayValue, { width: 255 });
      const rowHeight = Math.max(labelHeight, valueHeight);

      doc
        .font("En-Reg")
        .fontSize(9)
        .fillColor("#718096")
        .text(label, marginX, currentY, { width: 200 });
      doc
        .font(fontName)
        .fillColor(isBold ? "#00a86b" : "#2d3748")
        .text(displayValue, 300, currentY, { align: "right", width: 255 });
      currentY += rowHeight + 10;
    };

    const amount = Number(transaction.amount || 0);
    const fee = Number(transaction.fee || 0);
    const total = amount + fee;
    const displayTxId =
      transaction.referenceId || transaction.transactionId || transactionId;

    drawRow("Transaction Type", transaction.type);
    drawRow("Payment Method", transaction.paymentMethod || "U-Pay System");
    drawRow("Merchant ID", merchant.merchantId || "MER000");
    drawRow(
      "Amount",
      `${transaction.currency || "USD"} ${amount.toFixed(2)}`,
      true,
    );
    drawRow("Fee", `${transaction.currency || "USD"} ${fee.toFixed(2)}`);
    drawRow(
      "Total",
      `${transaction.currency || "USD"} ${total.toFixed(2)}`,
      true,
    );
    drawRow("Remark", transaction.remark, false, true);
    drawRow("Transaction ID", displayTxId);

    currentY += 5;
    doc
      .strokeColor("#e2e8f0")
      .lineWidth(1)
      .moveTo(marginX, currentY)
      .lineTo(555, currentY)
      .stroke();
    currentY += 15;

    const rawData = `${displayTxId}|${amount}|${transaction.createdAt}`;
    const digitalSignature = crypto
      .createHash("sha256")
      .update(rawData)
      .digest("hex")
      .toUpperCase();

    doc
      .font("En-Medium")
      .fontSize(7)
      .fillColor("#a0aec0")
      .text("Digital Signature (SHA-256):", marginX, currentY);
    doc
      .font("En-Reg")
      .fontSize(6)
      .text(digitalSignature, marginX, currentY + 10, { width: 350 });

    const verifyLink = `https://u-pay-bank.fly.dev/receipt/${displayTxId}`;
    const qrBuffer = await QRCode.toBuffer(verifyLink, {
      margin: 1,
      width: 150,
    });
    doc.image(qrBuffer, 485, currentY - 15, { width: 70 });
    doc
      .font("En-Medium")
      .fontSize(7)
      .fillColor("#718096")
      .text("Scan to verify", 485, currentY - 25);

    const stampX = 350;
    const stampY = currentY + 20;
    doc.circle(stampX, stampY, 28).lineWidth(2).strokeColor("#00a86b").stroke();
    doc.circle(stampX, stampY, 23).lineWidth(1).strokeColor("#00a86b").stroke();
    doc
      .font("En-Bold")
      .fontSize(16)
      .fillColor("#00a86b")
      .text("U", stampX - 6, stampY - 8);
    doc
      .font("En-SemiBold")
      .fontSize(5)
      .text("★ VERIFIED ★", stampX - 18, stampY + 12);

    const bottomY = doc.page.height - 45;
    doc.rect(0, bottomY - 15, doc.page.width, 60).fill("#f8fafc");
    doc.font("En-Medium").fontSize(8).fillColor("#4a5568");
    doc.text("Website: https://u-pay-bank.fly.dev", marginX, bottomY);
    doc.text("Phone: +855 95 40 42 42", 220, bottomY);
    doc.text("Email: support@u-pay-bank.fly.dev", 380, bottomY, {
      width: 180,
      align: "right",
    });

    doc.end();
  } catch (error) {
    console.error("Error Streaming PDF:", error);
    if (!res.headersSent) {
      res
        .status(500)
        .send("មិនអាចបង្កើតវិក្កយបត្របានទេ / Error generating PDF");
    }
  }
};

module.exports = { streamOfficialReceiptPDF };
