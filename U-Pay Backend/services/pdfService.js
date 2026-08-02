// services/pdfService.js
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

const generateOfficialReceiptPDF = async (transaction, merchant) => {
  return new Promise((resolve, reject) => {
    try {
      // ១. បង្កើតឯកសារ PDF ទំហំ A4
      const doc = new PDFDocument({ size: "A4", margin: 50 });

      // ២. กำหนดទីតាំងសម្រាប់រក្សាទុក File ជាបណ្តោះអាសន្នក្នុង Server
      const fileName = `Receipt-${transaction.referenceId}.pdf`;
      const filePath = path.join(__dirname, `../public/receipts/${fileName}`);

      // ធានាថាមាន Folder សម្រាប់เก็บ
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.existsSync(dir, { recursive: true });
        fs.mkdirSync(dir, { recursive: true });
      }

      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // ==========================================
      // 🎨 ៣. ចាប់ផ្តើម "គូរ" ឯកសារ PDF
      // ==========================================

      // ក្បាលទំព័រ (Header): ឈ្មោះក្រុមហ៊ុន U-Pay
      doc
        .fontSize(20)
        .fillColor("#1a365d")
        .text("U-PAY FINANCIAL SERVICE", { align: "center" });
      doc
        .fontSize(10)
        .fillColor("#718096")
        .text("Official Escrow & Payment Gateway Receipt", { align: "center" });
      doc.moveDown(1.5);

      // เส้น分隔线 (Horizontal Line)
      doc
        .strokeColor("#cbd5e0")
        .lineWidth(1)
        .moveTo(50, doc.y)
        .lineTo(545, doc.y)
        .stroke();
      doc.moveDown(1);

      // ព័ត៌មានប្រតិបត្តិការ (Transaction Details)
      doc
        .fontSize(12)
        .fillColor("#2d3748")
        .text(`លេខកូដប្រតិបត្តិការ (Reference ID): ${transaction.referenceId}`);
      doc.text(
        `កាលបរិច្ឆេទ (Date & Time): ${new Date(transaction.completedAt).toLocaleString()}`,
      );
      doc.text(
        `ក្រុមហ៊ុនដៃគូ (Merchant): ${merchant.name} (${merchant.merchantId})`,
      );
      doc.text(
        `គណនីអ្នកទទួល (Receiver Account): ${transaction.receiverAccount}`,
      );
      doc.moveDown(1);

      // ប្រអប់បង្ហាញទឹកប្រាក់ (Amount Box)
      doc.rect(50, doc.y, 495, 50).fillAndStroke("#ebf8ff", "#bee3f8");
      doc
        .fillColor("#2b6cb0")
        .fontSize(14)
        .text(
          `ទឹកប្រាក់បានទូទាត់ជោគជ័យ: $${transaction.amount.toFixed(2)} ${transaction.currency}`,
          70,
          doc.y - 35,
          { align: "left" },
        );
      doc.moveDown(2);

      // ការពិពណ៌នាបញ្ជាក់
      doc.fontSize(10).fillColor("#4a5568");
      doc.text(
        "ប្រាក់នេះត្រូវបានកាត់ចេញពីគណនីតម្កល់ និងបានផ្ទេរចូលទៅកាន់គណនីអ្នកលក់ (Seller) ដោយសុវត្ថិភាពនិងស្វ័យប្រវត្តិ។ ឯកសារនេះត្រូវបានចេញដោយប្រព័ន្ធ U-Pay បញ្ជាក់ជាផ្លូវការ។",
      );

      doc.moveDown(3);

      // ត្រា និងហត្ថលេខាឌីជីថល (Digital Stamp Mock)
      doc
        .fontSize(12)
        .fillColor("#2d3748")
        .text("U-PAY SYSTEM VERIFIED", { align: "right" });
      doc
        .fontSize(8)
        .fillColor("#38a169")
        .text("[ ត្រាផ្លូវការ / Authorized Digital Stamp ]", {
          align: "right",
        });

      // 4. បញ្ចប់ការគូរ និង Save ឯកសារ
      doc.end();

      stream.on("finish", () => {
        // បន្ទាប់ពី Save រួច យើងจะได้ URL សម្រាប់ឱ្យគេទាញយក
        // ឧ. Upload ទៅ Cloud (AWS S3) ឬទុកក្នុង Local Server
        const publicUrl = `https://api.upay.com/receipts/${fileName}`;
        resolve(publicUrl);
      });
    } catch (error) {
      reject(error);
    }
  });
};

module.exports = { generateOfficialReceiptPDF };
