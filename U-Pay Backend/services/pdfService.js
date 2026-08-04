// ============================================================================
// 📦 ១. នាំចូលបណ្ណាល័យដែលចាំបាច់ (Dependencies)
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
// 🛠️ ២. មុខងារជំនួយ (Helper Functions)
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
// 🖨️ ៣. មុខងារចម្បងសម្រាប់បង្កើត និងបញ្ចេញវិក្កយបត្រ (Main PDF Streamer)
// ============================================================================
const streamOfficialReceiptPDF = async (transactionId, res) => {
  try {
    // ------------------------------------------------------------------------
    // ផ្នែកទី ៣.១: ស្វែងរកទិន្នន័យ (Query Data)
    // ------------------------------------------------------------------------
    let queryConditions = [
      { refId: transactionId }, // ចាប់យកទម្រង់ B2B-...
      { hash: transactionId }, // ចាប់យកទម្រង់ rxh8222e...
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
          <div style="text-align:center; padding: 50px; font-family: Arial, sans-serif;">
            <h2 style="color: red;">⚠️ រកមិនឃើញប្រតិបត្តិការទេ (Transaction Not Found)</h2>
            <p>លេខ ID: <b>${transactionId}</b> ពុំមាននៅក្នុង Database ឡើយ។</p>
          </div>
        `);
      }

      merchant = {
        name: transaction.senderName || "U-Mall Payout",
        accountNumber: "System Payout",
        merchantId: "B2B_WITHDRAWAL",
      };

      transaction.referenceId = transaction.refId || transactionId;
      transaction.receiverName = transaction.receiverName || "Bank Account";
      transaction.receiverAccount = transaction.receiverAcc || "N/A";
      transaction.type = "Payout / Withdrawal";
      transaction.remark = transaction.remark || "ទូទាត់ប្រាក់ពី U-Mall";
      transaction.amount = transaction.amount || 0;
      transaction.createdAt = transaction.date || transaction.createdAt;
    }

    // ------------------------------------------------------------------------
    // ផ្នែកទី ៣.២: រៀបចំឯកសារ PDF និង ហ្វុងអក្សរ (PDF & Fonts Setup)
    // ------------------------------------------------------------------------
    const displayTxId =
      transaction.referenceId || transaction.hash || transactionId;
    const fileName = `Receipt-${displayTxId}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);

    const doc = new PDFDocument({ size: "A4", margin: 0 });
    doc.pipe(res);

    // ទីតាំង File Fonts
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

    // 🌟 ប្រព័ន្ធការពារការគាំង (Font Fallback System) 🌟
    let hasKhmer = false,
      hasEnReg = false,
      hasEnMed = false,
      hasEnSemi = false,
      hasEnBold = false;

    if (fs.existsSync(fontKhmer)) {
      doc.registerFont("Khmer", fontKhmer);
      hasKhmer = true;
    }
    if (fs.existsSync(fontEnReg)) {
      doc.registerFont("En-Reg", fontEnReg);
      hasEnReg = true;
    }
    if (fs.existsSync(fontEnMedium)) {
      doc.registerFont("En-Medium", fontEnMedium);
      hasEnMed = true;
    }
    if (fs.existsSync(fontEnSemiBold)) {
      doc.registerFont("En-SemiBold", fontEnSemiBold);
      hasEnSemi = true;
    }
    if (fs.existsSync(fontEnBold)) {
      doc.registerFont("En-Bold", fontEnBold);
      hasEnBold = true;
    }

    const fKhmer = hasKhmer ? "Khmer" : "Helvetica-Bold";
    const fReg = hasEnReg ? "En-Reg" : "Helvetica";
    const fMed = hasEnMed ? "En-Medium" : "Helvetica";
    const fSemi = hasEnSemi ? "En-SemiBold" : "Helvetica-Bold";
    const fBold = hasEnBold ? "En-Bold" : "Helvetica-Bold";

    // ------------------------------------------------------------------------
    // ផ្នែកទី ៣.៣: គូររចនាប័ទ្មខាងលើ (Header & Watermark)
    // ------------------------------------------------------------------------
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
        .font(fMed)
        .fontSize(7)
        .fillColor("#ffffff")
        .text("FAST • SECURE • TRUSTED", 40, 75, { characterSpacing: 1.5 });
    }

    doc
      .font(fKhmer)
      .fontSize(14)
      .fillColor("#ffffff")
      .text("ប័ណ្ណទទួលប្រាក់", 0, 35, { align: "right", width: 555 });
    doc
      .font(fMed)
      .fontSize(10)
      .text("PAYMENT RECEIPT", 0, 55, { align: "right", width: 555 });

    let currentY = 140;
    const marginX = 40;

    // ------------------------------------------------------------------------
    // ផ្នែកទី ៣.៤: ព័ត៌មានប្រតិបត្តិការ (Status & Date)
    // ------------------------------------------------------------------------
    doc
      .font(fKhmer)
      .fontSize(12)
      .fillColor("#10b981")
      .text("ទូទាត់ដោយជោគជ័យ", marginX, currentY);

    doc.roundedRect(marginX, currentY + 18, 85, 18, 9).fill("#10b981");
    doc
      .font(fBold)
      .fontSize(9)
      .fillColor("#ffffff")
      .text("SUCCESSFUL", marginX, currentY + 22.5, {
        align: "center",
        width: 85,
      });

    doc
      .font(fReg)
      .fontSize(9)
      .fillColor("#4a5568")
      .text(`Reference No:`, 300, currentY);
    doc
      .font(fSemi)
      .fillColor("#1a202c")
      .text(displayTxId, 400, currentY, { align: "right", width: 155 });

    doc
      .font(fReg)
      .fillColor("#4a5568")
      .text(`Transaction Date:`, 300, currentY + 18);
    const formattedDate = formatDateTime(transaction.createdAt || Date.now());
    doc
      .font(fSemi)
      .fillColor("#1a202c")
      .text(formattedDate, 400, currentY + 18, { align: "right", width: 155 });

    currentY += 60;

    // ------------------------------------------------------------------------
    // ផ្នែកទី ៣.៥: ប្រអប់អ្នកផ្ញើ និង អ្នកទទួល (From & To Boxes)
    // ------------------------------------------------------------------------

    // [FROM]
    doc
      .roundedRect(marginX, currentY, 245, 90, 8)
      .fillAndStroke("#ffffff", "#e2e8f0");
    doc.roundedRect(marginX, currentY, 245, 25, 8).fill("#00a86b");
    doc
      .font(fKhmer)
      .fontSize(9)
      .fillColor("#ffffff")
      .text("អ្នកបង់ប្រាក់ FROM", marginX + 10, currentY + 7);
    doc
      .font(fReg)
      .fontSize(8.5)
      .fillColor("#718096")
      .text("Account Name", marginX + 10, currentY + 35);
    doc
      .font(fSemi)
      .fillColor("#2d3748")
      .text(merchant.name || "N/A", marginX + 10, currentY + 47);
    doc
      .font(fReg)
      .fillColor("#718096")
      .text("Account Number", marginX + 10, currentY + 65);
    doc
      .font(fSemi)
      .fillColor("#2d3748")
      .text(merchant.accountNumber || "-", marginX + 10, currentY + 77);

    // [TO]
    doc
      .roundedRect(310, currentY, 245, 90, 8)
      .fillAndStroke("#ffffff", "#e2e8f0");
    doc.roundedRect(310, currentY, 245, 25, 8).fill("#00a86b");
    doc
      .font(fKhmer)
      .fontSize(9)
      .fillColor("#ffffff")
      .text("អ្នកទទួលប្រាក់ TO", 320, currentY + 7);
    doc
      .font(fReg)
      .fontSize(8.5)
      .fillColor("#718096")
      .text("Recipient Name", 320, currentY + 35);
    doc
      .font(fSemi)
      .fillColor("#2d3748")
      .text(transaction.receiverName || "N/A", 320, currentY + 47);
    doc
      .font(fReg)
      .fillColor("#718096")
      .text("Account Number", 320, currentY + 65);
    doc
      .font(fSemi)
      .fillColor("#2d3748")
      .text(transaction.receiverAccount || "-", 320, currentY + 77);

    currentY += 120;

    // ------------------------------------------------------------------------
    // ផ្នែកទី ៣.៦: ព័ត៌មានលម្អិតនៃប្រតិបត្តិការ (Transaction Details)
    // ------------------------------------------------------------------------
    doc.roundedRect(marginX, currentY, 220, 20, 4).fill("#008080");
    doc
      .font(fKhmer)
      .fontSize(9)
      .fillColor("#ffffff")
      .text("ព័ត៌មានប្រតិបត្តិការ", marginX + 10, currentY + 4.5);
    doc.font(fSemi).text("TRANSACTION DETAILS", marginX + 90, currentY + 5);

    currentY += 35;

    const drawRow = (label, value, isBold = false, isKhmer = false) => {
      const displayValue = String(value || "-");
      const fontName = isKhmer ? fKhmer : isBold ? fBold : fMed;
      const fontSize = isBold ? 11 : 9;

      const labelHeight = doc
        .font(fReg)
        .fontSize(9)
        .heightOfString(label, { width: 200 });
      const valueHeight = doc
        .font(fontName)
        .fontSize(fontSize)
        .heightOfString(displayValue, { width: 255 });
      const rowHeight = Math.max(labelHeight, valueHeight);

      doc
        .font(fReg)
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

    // ------------------------------------------------------------------------
    // ផ្នែកទី ៣.៧: សន្តិសុខ និង ការផ្ទៀងផ្ទាត់ (Security & Verification)
    // ------------------------------------------------------------------------
    const rawData = `${displayTxId}|${amount}|${transaction.createdAt}`;
    const digitalSignature = crypto
      .createHash("sha256")
      .update(rawData)
      .digest("hex")
      .toUpperCase();

    doc
      .font(fMed)
      .fontSize(7)
      .fillColor("#a0aec0")
      .text("Digital Signature (SHA-256):", marginX, currentY);
    doc
      .font(fReg)
      .fontSize(6)
      .text(digitalSignature, marginX, currentY + 10, { width: 350 });

    const verifyLink = `https://u-pay-bank.fly.dev/receipt/${displayTxId}`;
    const qrBuffer = await QRCode.toBuffer(verifyLink, {
      margin: 1,
      width: 150,
    });

    doc.image(qrBuffer, 485, currentY - 15, { width: 70 });
    doc
      .font(fMed)
      .fontSize(7)
      .fillColor("#718096")
      .text("Scan to verify", 485, currentY - 25);

    const stampX = 350;
    const stampY = currentY + 20;
    doc.circle(stampX, stampY, 28).lineWidth(2).strokeColor("#00a86b").stroke();
    doc.circle(stampX, stampY, 23).lineWidth(1).strokeColor("#00a86b").stroke();
    doc
      .font(fBold)
      .fontSize(16)
      .fillColor("#00a86b")
      .text("U", stampX - 6, stampY - 8);
    doc
      .font(fSemi)
      .fontSize(5)
      .text("★ VERIFIED ★", stampX - 18, stampY + 12);

    // ------------------------------------------------------------------------
    // ផ្នែកទី ៣.៨: ជើងទំព័រ (Footer)
    // ------------------------------------------------------------------------
    const bottomY = doc.page.height - 45;
    doc.rect(0, bottomY - 15, doc.page.width, 60).fill("#f8fafc");

    doc.font(fMed).fontSize(8).fillColor("#4a5568");
    doc.text("Website: https://u-pay-bank.fly.dev", marginX, bottomY);
    doc.text("Phone: +855 95 40 42 42", 220, bottomY);
    doc.text("Email: support@u-pay-bank.fly.dev", 380, bottomY, {
      width: 180,
      align: "right",
    });

    doc.end();
  } catch (error) {
    // ------------------------------------------------------------------------
    // ផ្នែកទី ៣.៩: ការគ្រប់គ្រងកំហុស (Error Handling)
    // ------------------------------------------------------------------------
    console.error("Error Streaming PDF:", error);
    if (!res.headersSent) {
      res
        .status(500)
        .send("មិនអាចបង្កើតវិក្កយបត្របានទេ / Error generating PDF");
    }
  }
};

module.exports = { streamOfficialReceiptPDF };
