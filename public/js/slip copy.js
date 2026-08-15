// js/slip.js

// ១. បង្កើតទម្រង់ Slip HTML បញ្ចូលទៅក្នុងទំព័រដោយស្វ័យប្រវត្តិ
document.addEventListener("DOMContentLoaded", () => {
  if (!document.getElementById("slipModal")) {
    const slipHTML = `
      <div id="slipModal" class="modal-overlay" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(15, 23, 42, 0.9); backdrop-filter: blur(5px); z-index: 99999; align-items: center; justify-content: center; flex-direction: column;">
        <div id="captureArea" class="slip-container" style="width: 340px; margin: 0 auto; background: white; border-radius: 20px; overflow: hidden; box-shadow: 0 15px 40px rgba(0,0,0,0.3);">
          
          <div class="slip-header" id="slipHeaderBg" style="padding: 30px 20px 25px; text-align: center; color: white; transition: background 0.3s;">
            <div class="slip-status-icon" id="slipIconBox" style="width: 65px; height: 65px; background: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 2rem; margin: 0 auto 15px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
              <i id="slipIcon" class="fa-solid fa-check"></i>
            </div>
            <div class="slip-title" id="slipTitle" style="font-weight: 700; font-size: 1.15rem; letter-spacing: 0.5px;">Transfer Successful</div>
            <div class="slip-amount" id="slipAmount" style="font-size: 2.8rem; font-weight: 900; margin-top: 5px; font-family: 'Inter', sans-serif; letter-spacing: -1px;">$0.00</div>
          </div>

          <div class="slip-body" style="padding: 20px 25px; background: white;">
            <div class="detail-row" style="display:flex; justify-content:space-between; margin-bottom:12px; font-size:0.85rem;"><span style="color:#64748b; font-weight:500;">Trx ID</span><span id="slipRef" style="font-family:monospace; font-weight:700; color:#004d40;">...</span></div>
            <div class="detail-row" style="display:flex; justify-content:space-between; margin-bottom:12px; font-size:0.85rem;"><span style="color:#64748b; font-weight:500;">Hash</span><span id="slipHash" style="font-family:monospace; font-weight:700; color:#3b82f6; font-size:0.8rem;">...</span></div>
            
            <div style="margin: 15px -25px; border-top: 2px dashed #e2e8f0;"></div>
            
            <!-- Labels អាចប្តូរបាន (Sender/Receiver) -->
            <div class="detail-row" style="display:flex; justify-content:space-between; margin-bottom:15px; font-size:0.85rem; align-items: flex-start;">
                <span id="lblSender" style="color:#64748b; font-weight:500; white-space: nowrap;">Sender</span>
                <span id="slipSenderName" style="font-weight:bold; text-align:right; color:#1e293b; line-height: 1.3;">...</span>
            </div>
            <div class="detail-row" style="display:flex; justify-content:space-between; margin-bottom:15px; font-size:0.85rem; align-items: flex-start;">
                <span id="lblReceiver" style="color:#64748b; font-weight:500; white-space: nowrap;">Receiver</span>
                <span id="slipReceiverName" style="font-weight:bold; text-align:right; color:#1e293b; line-height: 1.3;">...</span>
            </div>

            <div class="detail-row" style="display:flex; justify-content:space-between; margin-bottom:12px; font-size:0.85rem;"><span style="color:#64748b; font-weight:500;">Payment Via</span><span id="slipMethod" style="font-weight:bold; text-align:right; color:#1e293b;">...</span></div>
            <div class="detail-row" style="display:flex; justify-content:space-between; margin-bottom:12px; font-size:0.85rem;"><span style="color:#64748b; font-weight:500;">Date</span><span id="slipDate" style="font-weight:bold; text-align:right; color:#1e293b;">...</span></div>
            <div class="detail-row" style="display:flex; justify-content:space-between; margin-bottom:12px; font-size:0.85rem;"><span style="color:#64748b; font-weight:500;">Fee</span><span id="slipFee" style="font-weight:bold; text-align:right; color:#ef4444;">$0.00</span></div>
            <div class="detail-row" style="display:flex; justify-content:space-between; margin-bottom:12px; font-size:0.85rem; align-items: flex-start;"><span style="color:#64748b; font-weight:500;">Remark</span><span id="slipRemark" style="font-weight:bold; text-align:right; max-width:65%; color:#475569;">...</span></div>
            
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:20px;">
              <div style="display:flex; align-items:center; gap:8px; border:1px solid #e2e8f0; padding:6px 10px; border-radius:12px; background:#f8fafc;">
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=Verify" style="width:35px; height:35px;"/>
                <div style="font-size:0.65rem; font-weight:800; color:#004d40; line-height: 1.2;">SCAN TO<br/>VERIFY</div>
              </div>
              <img src="images/logo.png" style="width:75px;" onerror="this.style.display='none'"/>
            </div>
          </div>
        </div>
        
        <!-- ផ្ទាំងប៊ូតុងខាងក្រោម ៣ -->
        <div style="display:flex; justify-content:center; gap:35px; margin-top: 25px;">
          <div onclick="shareSlipGlobal()" style="cursor:pointer; text-align:center; color:white; transition: 0.2s;" onmousedown="this.style.transform='scale(0.9)'" onmouseup="this.style.transform='scale(1)'">
            <div style="width:55px; height:55px; border-radius:50%; background: rgba(255,255,255,0.2); backdrop-filter: blur(5px); display:flex; align-items:center; justify-content:center; font-size:1.3rem; margin:0 auto 8px;"><i class="fa-solid fa-share-nodes"></i></div>
            <span style="font-size:0.85rem; font-weight:600;">Share</span>
          </div>
          <div onclick="downloadSlipPDF()" style="cursor:pointer; text-align:center; color:white; transition: 0.2s;" onmousedown="this.style.transform='scale(0.9)'" onmouseup="this.style.transform='scale(1)'">
            <div style="width:55px; height:55px; border-radius:50%; background: rgba(255,255,255,0.2); backdrop-filter: blur(5px); display:flex; align-items:center; justify-content:center; font-size:1.3rem; margin:0 auto 8px;"><i class="fa-solid fa-file-pdf"></i></div>
            <span style="font-size:0.85rem; font-weight:600;">PDF</span>
          </div>
          <div onclick="closeSlipGlobal()" style="cursor:pointer; text-align:center; color:white; transition: 0.2s;" onmousedown="this.style.transform='scale(0.9)'" onmouseup="this.style.transform='scale(1)'">
            <div style="width:55px; height:55px; border-radius:50%; background: rgba(255,255,255,0.2); backdrop-filter: blur(5px); display:flex; align-items:center; justify-content:center; font-size:1.3rem; margin:0 auto 8px;"><i class="fa-solid fa-xmark"></i></div>
            <span style="font-size:0.85rem; font-weight:600;">Done</span>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML("beforeend", slipHTML);
  }
});

window.currentSlipData = null;

// ២. មុខងារបង្ហាញ Slip
function openGlobalSlip(t, currentUsername) {
  if (!t) return;
  window.currentSlipData = t; // កត់ត្រាទុកអោយ PDF
  const isKHR = t.currency === "KHR";
  const currSym = isKHR ? "៛" : "$";
  const isIncome = t.amount > 0;

  const feeAmount = t.fee ? parseFloat(t.fee) : 0;
  let principalAmount = Math.abs(t.amount);
  if (!isIncome && feeAmount > 0) {
    principalAmount = Math.abs(t.amount) - feeAmount;
  }

  const formattedAmt = principalAmount.toLocaleString("en-US", {
    minimumFractionDigits: isKHR ? 0 : 2,
    maximumFractionDigits: isKHR ? 0 : 2,
  });
  const formattedFee = feeAmount.toLocaleString("en-US", {
    minimumFractionDigits: isKHR ? 0 : 2,
    maximumFractionDigits: isKHR ? 0 : 2,
  });

  let bgColor = "#004d40";
  let iconColor = "#004d40";
  let iconClass = "fa-check";
  let titleText = isIncome ? "Transfer Received" : "Transfer Sent";

  let lblSenderText = "Sender";
  let lblReceiverText = "Receiver";

  const tType = (t.type || "").toLowerCase();

  if (tType.includes("deposit")) {
    bgColor = "#10b981";
    iconColor = "#10b981";
    iconClass = "fa-hand-holding-dollar";
    titleText = "Cash Deposit";
    lblSenderText = "Deposited By";
    lblReceiverText = "Credited To";
  } else if (tType.includes("payroll")) {
    bgColor = "#0ea5e9";
    iconColor = "#0ea5e9";
    iconClass = "fa-money-bill-transfer";
    titleText = isIncome ? "Salary Received" : "Payroll Processed";
    lblSenderText = "Company / Payer";
    lblReceiverText = "Employee";
  } else if (
    tType.includes("merchant") ||
    tType.includes("scan") ||
    t.merchantId
  ) {
    bgColor = "#8b5cf6";
    iconColor = "#8b5cf6";
    iconClass = "fa-store";
    titleText = isIncome ? "Payment Received" : "Payment Sent";
    lblSenderText = "Paid By";
    lblReceiverText = "Paid To (Merchant)";
  } else if (tType.includes("bill")) {
    bgColor = "#f97316";
    iconColor = "#f97316";
    iconClass = "fa-file-invoice-dollar";
    titleText = "Bill Paid";
    lblSenderText = "Paid By";
    lblReceiverText = "Biller / Company";
  } else if (tType.includes("promo") || tType.includes("cashback")) {
    bgColor = "#f59e0b";
    iconColor = "#f59e0b";
    iconClass = "fa-sack-dollar";
    titleText = "Reward Credited";
    lblSenderText = "Reward From";
    lblReceiverText = "Credited To";
  } else if (tType.includes("fund") || tType.includes("saving")) {
    bgColor = "#ec4899";
    iconColor = "#ec4899";
    iconClass = "fa-piggy-bank";
    titleText = isIncome ? "U-Fund Added" : "Contributed to U-Fund";
    lblSenderText = "Contributor";
    lblReceiverText = "U-Fund Goal";
  } else if (tType.includes("gift")) {
    bgColor = "#dc2626";
    iconColor = "#dc2626";
    iconClass = "fa-gift";
    titleText = isIncome ? "E-Gift Received" : "E-Gift Sent";
  }

  document.getElementById("slipHeaderBg").style.background = bgColor;
  document.getElementById("slipIconBox").style.color = iconColor;
  document.getElementById("slipIcon").className = `fa-solid ${iconClass}`;
  document.getElementById("slipTitle").innerText = titleText;
  document.getElementById("slipAmount").innerText = currSym + formattedAmt;

  document.getElementById("slipRef").innerText = t.refId || "N/A";
  document.getElementById("slipHash").innerText = t.hash || "N/A";
  document.getElementById("slipDate").innerText = t.date;

  let senderNameFull = t.senderName || "SYSTEM";
  let receiverNameFull = t.receiverName || "SYSTEM";

  if (!isIncome && t.senderAcc)
    senderNameFull += `<br><span style="font-size:0.75rem; color:#64748b; font-family:monospace;">${t.senderAcc}</span>`;
  if (isIncome && t.receiverAcc)
    receiverNameFull += `<br><span style="font-size:0.75rem; color:#64748b; font-family:monospace;">${t.receiverAcc}</span>`;

  document.getElementById("lblSender").innerText = lblSenderText;
  document.getElementById("lblReceiver").innerText = lblReceiverText;
  document.getElementById("slipSenderName").innerHTML = senderNameFull;
  document.getElementById("slipReceiverName").innerHTML = receiverNameFull;

  document.getElementById("slipMethod").innerText =
    t.trxMethod || "U-PAY System";
  document.getElementById("slipRemark").innerText = t.remark || "-";
  document.getElementById("slipFee").innerText = currSym + formattedFee;

  document.getElementById("slipModal").style.display = "flex";
}

// ៣. មុខងារ Share ពិតៗ (Web Share API)
async function shareSlipGlobal() {
  const iconBox = document.querySelector(
    "#slipModal .fa-share-nodes",
  ).parentElement;
  const originalIcon = iconBox.innerHTML;
  iconBox.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

  try {
    if (typeof html2canvas === "undefined") {
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src =
          "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }

    const captureArea = document.getElementById("captureArea");
    const canvas = await html2canvas(captureArea, {
      scale: 3,
      useCORS: true,
      backgroundColor: "#ffffff",
    });
    iconBox.innerHTML = originalIcon;

    canvas.toBlob((blob) => {
      const file = new File([blob], `UPay_Slip_${Date.now()}.png`, {
        type: "image/png",
      });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator
          .share({
            files: [file],
            title: "U-Pay Transaction",
            text: "នេះជាវិក្កយបត្របញ្ជាក់ការទូទាត់ពី U-Pay របស់ខ្ញុំ។",
          })
          .catch((err) => console.log("Share cancelled", err));
      } else {
        const link = document.createElement("a");
        link.download = file.name;
        link.href = URL.createObjectURL(file);
        link.click();
      }
    }, "image/png");
  } catch (err) {
    iconBox.innerHTML = originalIcon;
    alert("មានបញ្ហាក្នុងការ Share!");
  }
}

// ៤. មុខងារបិទ Slip
function closeSlipGlobal() {
  document.getElementById("slipModal").style.display = "none";
}

// ៥. មុខងារ Download PDF ទម្រង់ U-Pay Standard ថ្មី (Classic ABA Style + Khmer Sanitizer)
async function downloadSlipPDF() {
  const t = window.currentSlipData;
  if (!t) return;

  const iconBox = document.querySelector(
    "#slipModal .fa-file-pdf",
  ).parentElement;
  const originalIcon = iconBox.innerHTML;
  iconBox.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

  try {
    if (typeof window.jspdf === "undefined") {
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src =
          "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }

    setTimeout(() => {
      try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF("p", "pt", "a4");
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;

        const isKHR = t.currency === "KHR";
        const currSym = isKHR ? " KHR" : " USD";
        const formatMoney = (val) =>
          isKHR
            ? Math.abs(val).toLocaleString("en-US", {
                maximumFractionDigits: 0,
              })
            : Math.abs(val).toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              });
        const isIncome = t.amount > 0;
        const tType = (t.type || "").toLowerCase();

        // 🛠️ អនុគមន៍សម្រាប់លុបអក្សរខ្មែរចេញពី PDF ដើម្បីកុំអោយចេញ Š¶€... ខូចជួរ
        const cleanKhmer = (str) => {
          if (!str) return "N/A";
          // Regex នេះនឹងលុបអក្សរខ្មែរទាំងអស់ចេញ រក្សាទុកតែអង់គ្លេស និងលេខ
          let cleaned = str.replace(/[\u1780-\u17FF\u200B]/g, "").trim();
          return cleaned.length > 0 ? cleaned : "-";
        };

        // ១. ក្បាលទំព័រ (Header & Logo)
        // ប្រើទំហំ 90x24 ដើម្បីអោយ logo វែងល្មម មិនកន្តឿ
        doc.addImage("images/logo-nobg.png", "PNG", 40, 40, 90, 24);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.setTextColor(0, 77, 64);
        doc.text("TRANSACTION DETAILS", pageWidth - 40, 50, { align: "right" });

        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text(
          "Generated: " + new Date().toLocaleString("en-US"),
          pageWidth - 40,
          65,
          { align: "right" },
        );

        // គូរបន្ទាត់កាត់
        doc.setDrawColor(220, 220, 220);
        doc.setLineWidth(1);
        doc.line(40, 85, pageWidth - 40, 85);

        // ២. ACCOUNT DETAILS (ក្បាលដែលភ្លេច)
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(100, 116, 139);
        doc.text("ACCOUNT DETAILS", 40, 110);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.text("Account holder:", 40, 130);
        doc.text("Account No:", 40, 145);

        doc.setTextColor(30, 41, 59);
        doc.setFont("helvetica", "bold");
        let sessionUser = JSON.parse(sessionStorage.getItem("user")) || {
          fullName: "USER",
        };
        let myName = (
          sessionUser.fullName || sessionUser.username
        ).toUpperCase();
        doc.text(myName, 130, 130);

        let ownerAcc =
          (isIncome ? t.receiverAcc : t.senderAcc) || "MAIN ACCOUNT";
        doc.text(ownerAcc, 130, 145);

        // ៣. ចំណងជើងប្រតិបត្តិការ និងលុយ (ធំៗ)
        let displayTitle =
          (isIncome ? t.senderName : t.receiverName) || "SYSTEM";
        if (tType.includes("deposit")) displayTitle = "CASH DEPOSIT";
        else if (tType.includes("payroll"))
          displayTitle = isIncome ? "SALARY" : "PAYROLL";
        else if (tType.includes("fund") || tType.includes("saving"))
          displayTitle = "U-FUND";
        else if (t.type === "Merchant Payment")
          displayTitle = t.receiverName || t.merchantName || "MERCHANT PAYMENT";
        else if (tType.includes("gift"))
          displayTitle = isIncome ? "E-GIFT RECEIVED" : "E-GIFT SENT";

        doc.setFontSize(14);
        doc.text(displayTitle.toUpperCase(), 40, 190);

        doc.setFontSize(16);
        doc.text(formatMoney(t.amount) + currSym, pageWidth - 40, 190, {
          align: "right",
        });

        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 116, 139);
        doc.text(t.date || "N/A", 40, 205); // Date ដាក់ពីក្រោមចំណងជើង

        doc.setDrawColor(230, 230, 230);
        doc.line(40, 215, pageWidth - 40, 215);

        // ៤. ព័ត៌មានលម្អិត (Details Grid - តម្រង់ជួរត្រឹមត្រូវ)
        let startY = 235;
        const leftX = 40;
        const rightX = pageWidth - 40;

        const drawRow = (label, value) => {
          if (!value || value === "N/A" || value === "-") return; // រំលងបើគ្មានទិន្នន័យ
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);
          doc.setTextColor(100, 116, 139);
          doc.text(label, leftX, startY);

          doc.setFont("helvetica", "bold");
          doc.setTextColor(30, 41, 59);

          const cleanVal = cleanKhmer(value); // លុបអក្សរខ្មែរការពារខូចជួរ
          const splitText = doc.splitTextToSize(cleanVal, 260);
          doc.text(splitText, rightX, startY, { align: "right" });

          startY += splitText.length * 15 + 15;
          doc.setDrawColor(240, 240, 240);
          doc.line(40, startY - 10, pageWidth - 40, startY - 10);
        };

        let otherName = (isIncome ? t.senderName : t.receiverName) || "SYSTEM";

        // ដាក់ទិន្នន័យ
        drawRow("Transaction ID", t.refId || "N/A"); // ប្រើលេខ RefID ពិតៗ
        drawRow("Payment Method", t.trxMethod || "U-Pay Transfer");

        drawRow("Sender", isIncome ? otherName.toUpperCase() : myName);
        if (!isIncome && t.senderAcc) drawRow("Sender Account", t.senderAcc);

        drawRow("Receiver", isIncome ? myName : otherName.toUpperCase());
        if (isIncome && t.receiverAcc)
          drawRow("Receiver Account", t.receiverAcc);

        drawRow("Blockchain Hash", t.hash || "N/A");
        drawRow("Transaction Fee", "0.00" + currSym);
        drawRow("Remark", t.remark || "-");

        // ៥. កន្ទុយទំព័រ (Footer)
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.setFont("helvetica", "normal");
        doc.text(
          "DISCLAIMER: This E-Receipt is computer generated and does not require a signature.",
          40,
          pageHeight - 50,
        );
        doc.text(
          "For any inquiries, please contact U-Pay Customer Support at +855 98 203 203.",
          40,
          pageHeight - 35,
        );

        // Logo តូចខាងស្តាំ
        doc.addImage(
          "images/logo-nobg.png",
          "PNG",
          pageWidth - 80,
          pageHeight - 55,
          40,
          11,
        );

        doc.save(`UPay_Receipt_${t.refId || Date.now()}.pdf`);
        iconBox.innerHTML = originalIcon;
      } catch (e) {
        console.error(e);
        iconBox.innerHTML = originalIcon;
        alert("មានបញ្ហាក្នុងការបង្កើត PDF");
      }
    }, 150);
  } catch (err) {
    console.error(err);
    iconBox.innerHTML = originalIcon;
    alert("មានបញ្ហាក្នុងការទាញយក Library!");
  }
}
