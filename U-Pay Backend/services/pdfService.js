// ============================================================================
// 📦 1. Dependencies
// ============================================================================
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const QRCode = require("qrcode");
const crypto = require("crypto");
const mongoose = require("mongoose");
const EscrowTransaction = require("../models/EscrowTransaction");
const Transaction = require("../models/Transaction");

// ============================================================================
// 🛠️ 2. Helper Functions
// ============================================================================
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

// ============================================================================
// 🖨️ 3. Main PDF Streamer (Targeting Exactly the Sample Design)
// ============================================================================
const streamOfficialReceiptPDF = async (transactionId, res) => {
  try {
    // --- 3.1 Data Fetching ---
    let queryConditions = [
      { refId: transactionId },
      { hash: transactionId },
      { referenceId: transactionId },
      { transactionId: transactionId },
      { upayTransactionId: transactionId },
      { txId: transactionId },
    ];

    if (mongoose.Types.ObjectId.isValid(transactionId)) {
      queryConditions.push({ _id: transactionId });
    }

    let transaction = await EscrowTransaction.findOne({
      $or: queryConditions,
    }).populate("merchantId");
    let merchant = {};

    if (!transaction) {
      transaction = await Transaction.findOne({ $or: queryConditions });

      if (!transaction) {
        return res.status(404).send(`
          <div style="text-align:center; padding: 50px; font-family: Helvetica, Arial, sans-serif;">
            <h2 style="color: red;">⚠️ Transaction Not Found</h2>
            <p>ID: <b>${transactionId}</b> does not exist in the database.</p>
          </div>
        `);
      }
    }

    // Map Real Data from Database
    const displayTxId =
      transaction.referenceId ||
      transaction.refId ||
      transaction.hash ||
      transactionId;
    const amount = Number(transaction.amount || 0);
    const fee = Number(transaction.fee || 0);
    const total = amount + fee;
    const currency = transaction.currency || "USD";
    const dateStr = formatDateTime(
      transaction.createdAt || transaction.date || Date.now(),
    );

    // Sender (FROM) Details
    const senderName =
      transaction.senderName ||
      (transaction.merchantId ? transaction.merchantId.name : "U-MALL");
    const senderAcc = transaction.senderAcc || "System Account";

    // Receiver (TO) Details
    const receiverName = transaction.receiverName || "Bank Account";
    const receiverAcc =
      transaction.receiverAccount || transaction.receiverAcc || "N/A";

    const txType = transaction.type || "Fund Transfer";
    const remark = transaction.remark || "Payment for invoice";
    const channel =
      transaction.trxMethod || transaction.paymentMethod || "U-Pay System";

    // --- 3.2 PDF Setup (Using Standard Helvetica Only) ---
    const fileName = `Receipt-${displayTxId}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);

    const doc = new PDFDocument({ size: "A4", margin: 0 });
    doc.pipe(res);

    const logoPath = path.join(__dirname, "../public/images/logo.png");

    const fReg = "Helvetica";
    const fBold = "Helvetica-Bold";

    // Define Standard Colors matching the sample
    const colorTeal = "#00a980";
    const colorDarkBlue = "#1d4e89";
    const colorTextDark = "#1a202c";
    const colorTextLight = "#718096";
    const colorBorder = "#e2e8f0";

    // --- 3.3 Top Header (Gradient Background) ---
    const grad = doc.linearGradient(0, 0, 595, 0);
    grad.stop(0, "#004b93").stop(1, "#00a980"); // Blue to Teal
    doc.rect(0, 0, 595, 80).fill(grad);

    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 30, 20, { height: 35 });
    } else {
      doc.font(fBold).fontSize(26).fillColor("#ffffff").text("U-PAY", 30, 25);
    }

    doc
      .font(fBold)
      .fontSize(11)
      .fillColor("#ffffff")
      .text("PAYMENT RECEIPT", 0, 35, { align: "right", width: 565 });

    // --- 3.4 Status & Info Section ---
    let currentY = 110;

    // Green Checkmark icon
    doc.circle(45, currentY + 12, 16).fill(colorTeal);
    doc
      .lineWidth(3)
      .strokeColor("#ffffff")
      .moveTo(38, currentY + 12)
      .lineTo(43, currentY + 17)
      .lineTo(52, currentY + 7)
      .stroke();

    doc
      .font(fBold)
      .fontSize(13)
      .fillColor(colorTeal)
      .text("SUCCESSFUL", 70, currentY + 6);

    doc
      .font(fReg)
      .fontSize(9.5)
      .fillColor(colorTextLight)
      .text("Reference No.", 320, currentY);
    doc
      .font(fBold)
      .fillColor(colorTextDark)
      .text(displayTxId, 420, currentY, { align: "right", width: 145 });

    doc
      .font(fReg)
      .fillColor(colorTextLight)
      .text("Transaction Date", 320, currentY + 20);
    doc
      .font(fBold)
      .fillColor(colorTextDark)
      .text(dateStr, 420, currentY + 20, { align: "right", width: 145 });

    currentY += 60;

    // --- 3.5 FROM and TO Boxes ---
    const boxW = 260;
    const boxH = 115;
    const rowGap = 20;

    // --- FROM BOX ---
    doc
      .roundedRect(30, currentY, boxW, boxH, 6)
      .lineWidth(1)
      .strokeColor(colorBorder)
      .stroke();
    doc.roundedRect(30, currentY, boxW, 25, 6).fill(colorDarkBlue);
    doc.rect(30, currentY + 10, boxW, 15).fill(colorDarkBlue); // Hide bottom corners
    doc
      .font(fBold)
      .fontSize(9.5)
      .fillColor("#ffffff")
      .text("FROM", 40, currentY + 8);

    let innerY = currentY + 35;
    const drawBoxRow = (label, val, xLabel, xVal) => {
      doc
        .font(fReg)
        .fontSize(9)
        .fillColor(colorTextLight)
        .text(label, xLabel, innerY);
      doc
        .font(fBold)
        .fillColor(colorTextDark)
        .text(val, xVal, innerY, { width: 140, align: "left" });
    };

    drawBoxRow("Account Name", senderName, 40, 130);
    innerY += rowGap;
    drawBoxRow("Account Number", senderAcc, 40, 130);
    innerY += rowGap;
    drawBoxRow("Account Type", "U-Pay Account", 40, 130);
    innerY += rowGap;
    drawBoxRow(
      "Wallet ID",
      "UPAY" + displayTxId.substring(0, 8).toUpperCase(),
      40,
      130,
    );

    // --- TO BOX ---
    innerY = currentY + 35; // reset Y
    doc
      .roundedRect(305, currentY, boxW, boxH, 6)
      .lineWidth(1)
      .strokeColor(colorBorder)
      .stroke();
    doc.roundedRect(305, currentY, boxW, 25, 6).fill(colorDarkBlue);
    doc.rect(305, currentY + 10, boxW, 15).fill(colorDarkBlue);
    doc
      .font(fBold)
      .fontSize(9.5)
      .fillColor("#ffffff")
      .text("TO", 315, currentY + 8);

    drawBoxRow("Recipient Name", receiverName, 315, 410);
    innerY += rowGap;
    drawBoxRow("Account Number", receiverAcc, 315, 410);
    innerY += rowGap;
    drawBoxRow("Bank / Wallet", "U-Pay Account", 315, 410);
    innerY += rowGap;
    drawBoxRow(
      "Wallet ID",
      "UPAY" +
        (transaction.receiverAccount || "WALLET").substring(0, 8).toUpperCase(),
      315,
      410,
    );

    currentY += 140;

    // --- 3.6 Central Watermark ---
    doc.save();
    doc.opacity(0.03);
    if (fs.existsSync(logoPath))
      doc.image(logoPath, 150, currentY, { width: 300 });
    doc.restore();

    // --- 3.7 TRANSACTION DETAILS Section ---
    doc.roundedRect(30, currentY, 535, 22, 3).fill(colorDarkBlue);
    doc
      .font(fBold)
      .fontSize(9.5)
      .fillColor("#ffffff")
      .text("TRANSACTION DETAILS", 40, currentY + 6);

    currentY += 35;

    const drawDetailRow = (label, value, isGreen = false, isLarge = false) => {
      doc
        .font(fReg)
        .fontSize(9.5)
        .fillColor(colorTextLight)
        .text(label, 40, currentY);

      const vFont = isLarge ? fBold : fReg;
      const vSize = isLarge ? 12 : 9.5;
      const vColor = isGreen ? colorTeal : colorTextDark;

      doc
        .font(vFont)
        .fontSize(vSize)
        .fillColor(vColor)
        .text(value, 300, currentY - (isLarge ? 2 : 0), {
          align: "right",
          width: 265,
        });
      currentY += 20;
    };

    drawDetailRow("Transaction Type", txType);
    drawDetailRow("Amount", `${currency} ${amount.toFixed(2)}`, true, true);
    drawDetailRow("Fee", `${currency} ${fee.toFixed(2)}`);
    drawDetailRow("Total", `${currency} ${total.toFixed(2)}`);
    drawDetailRow("From Account Currency", currency);
    drawDetailRow("To Account Currency", currency);
    drawDetailRow("Remark", remark);
    drawDetailRow("Channel", channel);
    drawDetailRow("Transaction ID", displayTxId);

    // Bottom divider line
    currentY += 10;
    doc
      .lineWidth(1)
      .strokeColor(colorBorder)
      .moveTo(30, currentY)
      .lineTo(565, currentY)
      .stroke();

    // --- 3.8 Footer Section (Stamp & QR Code) ---
    currentY += 25;

    // U-PAY Verified Stamp (Exactly like the sample)
    const stampX = 70;
    const stampY = currentY + 35;
    // Outer Circle
    doc
      .circle(stampX, stampY, 32)
      .lineWidth(1.5)
      .strokeColor(colorTeal)
      .stroke();
    // Inner Circle
    doc
      .circle(stampX, stampY, 28)
      .lineWidth(0.5)
      .strokeColor(colorTeal)
      .stroke();

    // Stamp Text
    doc
      .font(fBold)
      .fontSize(6)
      .fillColor(colorTeal)
      .text("U-PAY", stampX - 11, stampY - 20);
    doc
      .font(fBold)
      .fontSize(22)
      .fillColor(colorTeal)
      .text("U", stampX - 8, stampY - 12);
    doc
      .font(fBold)
      .fontSize(5)
      .text("★ VERIFIED ★", stampX - 16, stampY + 14);

    // Disclaimer text
    doc
      .font(fReg)
      .fontSize(9)
      .fillColor(colorTextLight)
      .text("This receipt is computer generated and", 120, currentY + 25);
    doc.text("does not require signature.", 120, currentY + 37);

    // QR Code
    const verifyLink = `https://u-pay-bank.fly.dev/receipt/${displayTxId}`;
    const qrBuffer = await QRCode.toBuffer(verifyLink, {
      margin: 1,
      width: 150,
    });
    doc.image(qrBuffer, 480, currentY, { width: 85 });
    doc
      .font(fReg)
      .fontSize(7)
      .fillColor(colorTextLight)
      .text("Scan to verify", 480, currentY - 10, {
        align: "center",
        width: 85,
      });

    // --- 3.9 Absolute Bottom Bar (Clean English Text, No Emojis) ---
    const bottomY = doc.page.height - 45;

    // A subtle line above footer
    doc
      .lineWidth(0.5)
      .strokeColor(colorBorder)
      .moveTo(30, bottomY - 15)
      .lineTo(565, bottomY - 15)
      .stroke();

    doc.font(fReg).fontSize(8).fillColor(colorTextLight);
    doc.text("Website: https://u-pay-bank.fly.dev", 30, bottomY);
    doc.text("Phone: +855 95 40 42 42", 250, bottomY);
    doc.text("Email: support@u-pay-bank.fly.dev", 415, bottomY);

    // Finalize PDF
    doc.end();
  } catch (error) {
    console.error("Error Streaming PDF:", error);
    if (!res.headersSent) {
      res.status(500).send("Error generating PDF document.");
    }
  }
};

module.exports = { streamOfficialReceiptPDF };
