// មុខងារសម្រាប់បង្កើតទម្រង់ Slip HTML បញ្ចូលទៅក្នុងទំព័រដោយស្វ័យប្រវត្តិ
document.addEventListener("DOMContentLoaded", () => {
  if (!document.getElementById("slipModal")) {
    const slipHTML = `
      <div id="slipModal" class="modal-overlay" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.85); z-index: 99999; align-items: center; justify-content: center; flex-direction: column;">
        <div id="captureArea" class="slip-container" style="width: 340px; margin: 0 auto; background: white; border-radius: 20px; overflow: hidden; box-shadow: 0 15px 40px rgba(0,0,0,0.4);">
          <div class="slip-header" id="slipHeaderBg" style="padding: 25px 20px 30px; text-align: center; color: white;">
            <div class="slip-status-icon" id="slipIconBox" style="width: 60px; height: 60px; background: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.8rem; margin: 0 auto 10px;">
              <i id="slipIcon" class="fa-solid fa-check"></i>
            </div>
            <div class="slip-title" id="slipTitle" style="font-weight: 600; font-size: 1.1rem;">Transfer Successful</div>
            <div class="slip-amount" id="slipAmount" style="font-size: 2.5rem; font-weight: 800; margin-top: 5px;">$0.00</div>
          </div>
          <div class="slip-body" style="padding: 20px 25px; background: white;">
            <div class="detail-row" style="display:flex; justify-content:space-between; margin-bottom:12px; font-size:0.9rem;"><span style="color:#888;">Trx ID</span><span id="slipRef" style="font-family:monospace; font-weight:bold; color:#004d40;">...</span></div>
            <div class="detail-row" style="display:flex; justify-content:space-between; margin-bottom:12px; font-size:0.9rem;"><span style="color:#888;">Hash</span><span id="slipHash" style="font-family:monospace; font-weight:bold; color:#004d40; font-size:0.8rem;">...</span></div>
            <div style="margin: 15px -25px; border-top: 2px dashed #ddd;"></div>
            <div class="detail-row" style="display:flex; justify-content:space-between; margin-bottom:12px; font-size:0.9rem;"><span style="color:#888;">From</span><span id="slipSenderName" style="font-weight:bold; text-align:right;">...</span></div>
            <div class="detail-row" style="display:flex; justify-content:space-between; margin-bottom:12px; font-size:0.9rem;"><span style="color:#888;">To</span><span id="slipReceiverName" style="font-weight:bold; text-align:right;">...</span></div>
            <div class="detail-row" style="display:flex; justify-content:space-between; margin-bottom:12px; font-size:0.9rem;"><span style="color:#888;">Payment Via</span><span id="slipMethod" style="font-weight:bold; text-align:right;">...</span></div>
            <div class="detail-row" style="display:flex; justify-content:space-between; margin-bottom:12px; font-size:0.9rem;"><span style="color:#888;">Date</span><span id="slipDate" style="font-weight:bold; text-align:right;">...</span></div>
            <div class="detail-row" style="display:flex; justify-content:space-between; margin-bottom:12px; font-size:0.9rem;"><span style="color:#888;">Fee</span><span id="slipFee" style="font-weight:bold; text-align:right;">$0.00</span></div>
            <div class="detail-row" style="display:flex; justify-content:space-between; margin-bottom:12px; font-size:0.9rem;"><span style="color:#888;">Remark</span><span id="slipRemark" style="font-weight:bold; text-align:right; max-width:60%;">...</span></div>
            
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:15px;">
              <div style="display:flex; align-items:center; gap:8px; border:1px solid #eee; padding:5px 10px; border-radius:10px; background:#f9fafb;">
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=Verify" style="width:35px; height:35px;"/>
                <div style="font-size:0.6rem; font-weight:800; color:#004d40;">SCAN TO<br/>CHECK</div>
              </div>
              <img src="images/logo.png" style="width:70px;" onerror="this.style.display='none'"/>
            </div>
          </div>
          <div style="display:flex; justify-content:center; gap:30px; padding:20px; background:#fff; border-top:1px solid #f0f0f0;">
            <div onclick="downloadSlipGlobal()" style="cursor:pointer; text-align:center; color:#004d40;">
              <div style="width:50px; height:50px; border-radius:50%; border:1px solid #eee; display:flex; align-items:center; justify-content:center; font-size:1.2rem; margin:0 auto 5px;"><i class="fa-solid fa-share-nodes"></i></div><span style="font-size:0.8rem; font-weight:bold;">Share</span>
            </div>
            <div onclick="document.getElementById('slipModal').style.display='none'" style="cursor:pointer; text-align:center; color:#004d40;">
              <div style="width:50px; height:50px; border-radius:50%; border:1px solid #eee; display:flex; align-items:center; justify-content:center; font-size:1.2rem; margin:0 auto 5px;"><i class="fa-solid fa-xmark"></i></div><span style="font-size:0.8rem; font-weight:bold;">Done</span>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML("beforeend", slipHTML);
  }
});

// មុខងារបង្ហាញ Slip ដែលអាចហៅប្រើពី File ណាក៏បាន
function openGlobalSlip(t, currentUsername) {
  if (!t) return;
  const isKHR = t.currency === "KHR";
  const currSym = isKHR ? "៛" : "$";

  // Format លុយ
  const formattedAmt = Math.abs(t.amount).toLocaleString("en-US", {
    minimumFractionDigits: isKHR ? 0 : 2,
  });

  // កំណត់ពណ៌
  let bgColor = "#004d40";
  let iconColor = "#004d40";
  let iconClass = "fa-check";
  let titleText = t.amount < 0 ? "Transfer Sent" : "Transfer Received";

  if (t.type === "Refund Received") {
    bgColor = "#3b82f6";
    iconColor = "#3b82f6";
    iconClass = "fa-rotate-left";
    titleText = "Refund Received";
  } else if (t.type === "Refund Deducted") {
    bgColor = "#ef4444";
    iconColor = "#ef4444";
    iconClass = "fa-clock-rotate-left";
    titleText = "Refund Deducted";
  } else if (t.type === "Bill Payment") {
    bgColor = "#f59e0b";
    iconColor = "#f59e0b";
    iconClass = "fa-file-invoice-dollar";
    titleText = "Bill Paid";
  } else if (t.type === "Cashback Reward" || t.type === "System Income") {
    bgColor = "#8b5cf6";
    iconColor = "#8b5cf6";
    iconClass = "fa-gift";
    titleText = "Cashback Reward";
  }

  // បញ្ចូលទិន្នន័យ
  document.getElementById("slipHeaderBg").style.background = bgColor;
  document.getElementById("slipIconBox").style.color = iconColor;
  document.getElementById("slipIcon").className = `fa-solid ${iconClass}`;
  document.getElementById("slipTitle").innerText = titleText;

  document.getElementById("slipAmount").innerText = currSym + formattedAmt;
  document.getElementById("slipRef").innerText = t.refId || "N/A";
  document.getElementById("slipHash").innerText = t.hash || "N/A";
  document.getElementById("slipDate").innerText = t.date;
  document.getElementById("slipSenderName").innerText =
    t.amount > 0 ? t.senderName || "System" : currentUsername;
  document.getElementById("slipReceiverName").innerText =
    t.amount < 0 ? t.receiverName || "Unknown" : currentUsername;
  document.getElementById("slipMethod").innerText =
    t.trxMethod || "U-PAY System";
  document.getElementById("slipRemark").innerText = t.remark || "-";
  document.getElementById("slipFee").innerText = currSym + "0.00";

  document.getElementById("slipModal").style.display = "flex";
}

// មុខងារ Share/Download
function downloadSlipGlobal() {
  if (typeof html2canvas === "undefined") {
    alert("សូមរង់ចាំបន្តិច ប្រព័ន្ធកំពុងផ្ទុកមុខងារ Share...");
    return;
  }
  const captureArea = document.getElementById("captureArea");
  html2canvas(captureArea, {
    scale: 3,
    useCORS: true,
    backgroundColor: null,
  }).then((canvas) => {
    const link = document.createElement("a");
    link.download = `Slip_${Date.now()}.png`;
    link.href = canvas.toDataURL();
    link.click();
  });
}
