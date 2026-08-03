const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const QRCode = require("qrcode");
const crypto = require("crypto"); // សម្រាប់បង្កើត Digital Signature (SHA256)
const EscrowTransaction = require("../models/EscrowTransaction");

// Function សម្រាប់ Format ថ្ងៃខែ (រក្សាទុកដូចដើម)
const formatDateTime = (dateInput) => {
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

  const time = `${String(hours).padStart(2, "0")}:${minutes}:${seconds} ${ampm}`;
  return `${day} ${month} ${year}, ${time}`;
};

// 🔥 មុខងារថ្មី៖ Generate និង Stream PDF ទៅកាន់ Browser ផ្ទាល់ (Real-time)
const streamOfficialReceiptPDF = async (transactionId, res) => {
  try {
    const transaction = await EscrowTransaction.findOne({
      $or: [{ referenceId: transactionId }, { transactionId: transactionId }],
    }).populate("merchantId");
    if (!transaction) {
      return res.status(404).send("Transaction not found");
    }
    const merchant = transaction.merchantId || {};

    const fileName = `Receipt-${transaction.referenceId}.pdf`;

    // 🌟 កំណត់ Header ឱ្យ Browser ស្គាល់ថាវាជា PDF និងឱ្យបើកមើលផ្ទាល់ (inline)
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);

    // Paths សម្រាប់ Fonts និង Images
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

    // 🌟 បាញ់ទិន្នន័យ PDF ចូលទៅកាន់ Response (Browser) ផ្ទាល់តែម្ដង មិនបាច់ Save File ទេ
    doc.pipe(res);

    // Register Fonts
    doc.registerFont("Khmer", fontKhmer);
    doc.registerFont("En-Reg", fontEnReg);
    doc.registerFont("En-Medium", fontEnMedium);
    doc.registerFont("En-SemiBold", fontEnSemiBold);
    doc.registerFont("En-Bold", fontEnBold);

    // ==========================================
    // 🎨 ចាប់ផ្តើមគូរ (រក្សាទុកទម្រង់ដើម ១០០%)
    // ==========================================

    // -- 1. Watermark (ចំណុចទី ៦: ធំជាងមុន និងដាក់ចំកណ្តាលល្អ) --
    doc.save();
    doc.opacity(0.05);
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 110, 240, { width: 380 });
    }
    doc.restore();

    // -- Header Background & Logo --
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

    doc
      .font("Khmer")
      .fontSize(14)
      .fillColor("#ffffff")
      .text("ប័ណ្ណទទួលប្រាក់", 0, 35, { align: "right", width: 555 });
    doc
      .font("En-Medium")
      .fontSize(10)
      .text("PAYMENT RECEIPT", 0, 55, { align: "right", width: 555 });

    let currentY = 140;
    const marginX = 40;

    // -- 2. ស្ថានភាព និង លេខរៀង (មុខងារថ្មីទី ១: Status Badge) --
    doc
      .font("Khmer")
      .fontSize(12)
      .fillColor("#10b981")
      .text("ទូទាត់ដោយជោគជ័យ", marginX, currentY);

    // Rounded Green Badge
    doc.roundedRect(marginX, currentY + 18, 85, 18, 9).fill("#10b981");
    doc
      .font("En-Bold")
      .fontSize(9)
      .fillColor("#ffffff")
      .text("SUCCESSFUL", marginX, currentY + 22.5, {
        align: "center",
        width: 85,
      });

    doc.font("En-Reg").fontSize(9).fillColor("#4a5568");
    doc.text(`Reference No:`, 300, currentY);
    doc
      .font("En-SemiBold")
      .fillColor("#1a202c")
      .text(transaction.referenceId ?? "-", 400, currentY, {
        align: "right",
        width: 155,
      });

    doc
      .font("En-Reg")
      .fillColor("#4a5568")
      .text(`Transaction Date:`, 300, currentY + 18);
    // ប្រើ Date Formatter
    const formattedDate = formatDateTime(transaction.createdAt);
    doc
      .font("En-SemiBold")
      .fillColor("#1a202c")
      .text(formattedDate, 400, currentY + 18, {
        align: "right",
        width: 155,
      });

    currentY += 60;

    // -- 3. ប្រអប់ FROM និង TO --
    doc
      .roundedRect(marginX, currentY, 245, 90, 8)
      .fillAndStroke("#ffffff", "#e2e8f0");
    doc.roundedRect(marginX, currentY, 245, 25, 8).fill("#00a86b");
    doc
      .font("Khmer")
      .fontSize(9)
      .fillColor("#ffffff")
      .text("អ្នកបង់ប្រាក់ FROM", marginX + 10, currentY + 7);

    doc.font("En-Reg").fontSize(8.5).fillColor("#718096");
    doc.text("Account Name", marginX + 10, currentY + 35);
    doc
      .font("En-SemiBold")
      .fillColor("#2d3748")
      .text(merchant.name ?? "N/A", marginX + 10, currentY + 47);
    doc
      .font("En-Reg")
      .fillColor("#718096")
      .text("Account Number", marginX + 10, currentY + 65);
    doc
      .font("En-SemiBold")
      .fillColor("#2d3748")
      .text(merchant.accountNumber ?? "-", marginX + 10, currentY + 77);

    doc
      .roundedRect(310, currentY, 245, 90, 8)
      .fillAndStroke("#ffffff", "#e2e8f0");
    doc.roundedRect(310, currentY, 245, 25, 8).fill("#00a86b");
    doc
      .font("Khmer")
      .fontSize(9)
      .fillColor("#ffffff")
      .text("អ្នកទទួលប្រាក់ TO", 320, currentY + 7);

    doc.font("En-Reg").fontSize(8.5).fillColor("#718096");
    doc.text("Recipient Name", 320, currentY + 35);
    doc
      .font("En-SemiBold")
      .fillColor("#2d3748")
      .text(transaction.receiverName ?? "N/A", 320, currentY + 47);
    doc
      .font("En-Reg")
      .fillColor("#718096")
      .text("Account Number", 320, currentY + 65);
    doc
      .font("En-SemiBold")
      .fillColor("#2d3748")
      .text(transaction.receiverAccount ?? "-", 320, currentY + 77);

    currentY += 120;

    // -- 4. TRANSACTION DETAILS --
    doc.roundedRect(marginX, currentY, 220, 20, 4).fill("#008080");
    doc
      .font("Khmer")
      .fontSize(9)
      .fillColor("#ffffff")
      .text("ព័ត៌មានប្រតិបត្តិការ", marginX + 10, currentY + 4.5);
    doc
      .font("En-SemiBold")
      .text("TRANSACTION DETAILS", marginX + 90, currentY + 5);

    currentY += 35;

    // Function គូរ Row
    const drawRow = (label, value, isBold = false, isKhmer = false) => {
      const displayValue = String(value ?? "-");
      const fontName = isKhmer ? "Khmer" : isBold ? "En-Bold" : "En-Medium";
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
    const displayTxId = transaction.transactionId || transaction.referenceId;

    const paymentMethod = transaction.paymentMethod || "U-Pay Wallet";
    const merchantId = merchant.merchantId || "MER000000";
    const invoiceNo = transaction.invoiceNo || "N/A";

    drawRow("Transaction Type", transaction.type || "Fund Transfer");
    drawRow("Payment Method", paymentMethod);
    drawRow("Merchant ID", merchantId);
    drawRow("Invoice No", invoiceNo);
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
    drawRow(
      "Remark",
      transaction.remark || "Payment via U-Pay Gateway",
      false,
      true,
    );
    drawRow("Transaction ID", displayTxId);

    currentY += 5;
    doc
      .strokeColor("#e2e8f0")
      .lineWidth(1)
      .moveTo(marginX, currentY)
      .lineTo(555, currentY)
      .stroke();
    currentY += 15;

    // -- 5. Digital Signature --
    const rawData = `${displayTxId}|${amount}|${merchantId}|${transaction.createdAt}`;
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

    // -- 6. QR Code (🚀 ប្រើ Buffer ជំនួស DataURL និង File) --
    const verifyLink = `https://u-pay-bank.fly.dev/receipt/${transaction.referenceId}`;

    // បង្កើត QR ជា Buffer ដោយផ្ទាល់ មិនបាច់ Save ចូល Folder ទេ
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

    // -- 7. គូរត្រា VERIFIED --
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

    // -- 8. Footer --
    const bottomY = doc.page.height - 45;
    doc.rect(0, bottomY - 15, doc.page.width, 60).fill("#f8fafc");
    doc.font("En-Medium").fontSize(8).fillColor("#4a5568");

    doc.text("Website: https://u-pay-bank.fly.dev", marginX, bottomY);
    doc.text("Phone: +855 95 40 42 42", 220, bottomY);
    doc.text("Email: support@u-pay-bank.fly.dev", 380, bottomY, {
      width: 180,
      align: "right",
    });

    // បញ្ចប់ការគូរ (ពេលហៅ doc.end() វានឹងរុញទិន្នន័យទាំងអស់ទៅកាន់ Browser ភ្លាមៗ)
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

// Export ឈ្មោះថ្មីយកទៅប្រើ
module.exports = { streamOfficialReceiptPDF };
