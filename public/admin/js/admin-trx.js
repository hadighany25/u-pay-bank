// ========================================================================
// ឯកសារ: admin-trx.js
// អត្ថន័យ: ពិនិត្យវិក្កយបត្រ (Transaction Check), ការអនុម័ត និងការធ្វើ Refund
// ========================================================================

async function searchTrx() {
  const id = document.getElementById("searchTrxId").value.trim();
  if (!id)
    return Swal.fire("បំរាម", "សូមបញ្ចូលលេខ Ref ID ឬ Hash Code!", "warning");

  Swal.fire({
    title: "Searching...",
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading(),
  });

  try {
    const res = await fetch(`/api/admin/transaction/${id}`, {
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    const box = document.getElementById("trxResult");
    Swal.close();

    if (data.success && data.transaction) {
      const t = data.transaction;
      const isPending = t.status === "Pending";
      const isKHR = t.currency === "KHR";
      const currSym = isKHR ? "៛" : "$";

      const fmtAmt = isKHR
        ? Math.abs(t.amount || 0).toLocaleString("en-US", {
            maximumFractionDigits: 0,
          })
        : Math.abs(t.amount || 0).toFixed(2);
      const fmtFee = isKHR
        ? Math.abs(t.fee || 0).toLocaleString("en-US", {
            maximumFractionDigits: 0,
          })
        : Math.abs(t.fee || 0).toFixed(2);
      const fmtProfit = isKHR
        ? Math.abs(t.profit || t.commission || 0).toLocaleString("en-US", {
            maximumFractionDigits: 0,
          })
        : Math.abs(t.profit || t.commission || 0).toFixed(2);

      let sName =
        t.senderName || t.sender || t.fromName || t.senderPhone || "System";
      let sAcc =
        t.senderAcc ||
        t.senderAccount ||
        t.fromAccount ||
        t.accountNumber ||
        "N/A";
      let rName =
        t.receiverName || t.receiver || t.toName || t.receiverPhone || "System";
      let rAcc = t.receiverAcc || t.receiverAccount || t.toAccount || "N/A";

      let sDevice = t.senderDevice || "Mobile Device";
      let rDevice = t.receiverDevice || "Mobile Device";
      let sIp = t.senderIp || "127.0.0.1";
      let rIp = t.receiverIp || "127.0.0.1";

      let sKyc = t.senderKyc || t.kycStatus || "Unverified";
      let rKyc = t.receiverKyc || t.kycStatus || "Unverified";
      let sKycColor =
        sKyc.toLowerCase() === "verified" || sKyc.toLowerCase() === "approved"
          ? "#10b981"
          : "#ef4444";
      let rKycColor =
        rKyc.toLowerCase() === "verified" || rKyc.toLowerCase() === "approved"
          ? "#10b981"
          : "#ef4444";

      let depositorHtml = "";

      if (t.type === "Cash Deposit") {
        sName = "Cash Deposit (ដាក់ប្រាក់)";
        sAcc = "CASH-DESK";
        sDevice = "Branch Admin System";
        sIp = "Internal Network";
        t.senderType = "System";
        sKyc = "System";
        sKycColor = "#3b82f6";

        let dName = t.depositorName;
        if (!dName)
          dName =
            t.remark && t.remark.includes("អ្នកផ្សេង")
              ? t.remark
              : "ម្ចាស់គណនីផ្ទាល់ (Self)";
        let dAcc =
          t.depositorAcc && t.depositorAcc !== "N/A"
            ? `(${t.depositorAcc})`
            : "";
        depositorHtml = `<div class="t-row"><span class="t-label">Deposited By</span><span class="t-value" style="font-weight: 900; color: #d97706; background: #fffbeb; padding: 3px 10px; border-radius: 6px; border: 1px dashed #fcd34d;">${dName} ${dAcc}</span></div>`;
      } else if (t.type === "Cash Withdrawal") {
        rName = "Cash Withdrawal (ដកប្រាក់)";
        rAcc = "CASH-DESK";
        rDevice = "Branch Admin System";
        rIp = "Internal Network";
        t.receiverType = "System";
        rKyc = "System";
        rKycColor = "#3b82f6";
      } else if (
        t.type === "Card Issuance Fee" ||
        (t.type && t.type.includes("Fee")) ||
        (rName && rName.toLowerCase().includes("service"))
      ) {
        rAcc = "SYSTEM-FEE-WALLET";
        rDevice = "U-PAY Core System";
        rIp = "Internal Network";
        t.receiverType = "System Revenue";
        rKyc = "System";
        rKycColor = "#3b82f6";
      }

      if (sName.toLowerCase().includes("system")) {
        sAcc = "SYSTEM-WALLET";
        sDevice = "System Server";
        sIp = "Internal Network";
        t.senderType = "System";
        sKyc = "System";
        sKycColor = "#3b82f6";
      }
      if (rName.toLowerCase().includes("system")) {
        rAcc = "SYSTEM-WALLET";
        rDevice = "System Server";
        rIp = "Internal Network";
        t.receiverType = "System";
        rKyc = "System";
        rKycColor = "#3b82f6";
      }

      let mId = t.merchantId || t.receiverMerchantId;
      let merchantHtml = mId
        ? `<div class="t-row"><span class="t-label">Merchant ID</span> <span class="t-value" style="font-family: monospace; color: #8b5cf6; font-weight: 900; background: #f5f3ff; padding: 3px 10px; border-radius: 6px; border: 1px dashed #ddd6fe;">${mId}</span></div>`
        : "";

      let canRefund =
        adminRole === "super_admin" ||
        (myAdminPermissions && myAdminPermissions.actions?.refund);
      let refundHtml = canRefund
        ? `<button onclick="handleAdminAction('refund', '${t.refId || t.id}')" style="padding: 8px 15px; background: #ef4444; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; font-family: inherit; font-size: 0.9rem; display: flex; align-items: center; gap: 6px; transition: 0.2s;" onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'"><i class="fa-solid fa-rotate-left"></i> Refund Transaction</button>`
        : `<span style="color: var(--text-muted);">គ្មានសិទ្ធិ Refund ទេ</span>`;

      box.style.display = "block";
      box.innerHTML = `
        <div class="trx-grid">
          <div class="trx-box">
            <h4><i class="fa-solid fa-arrow-up-right-from-square"></i> Sender Details</h4>
            <div class="t-row"><span class="t-label">Name</span> <span class="t-value">${sName}</span></div>
            ${depositorHtml}
            <div class="t-row"><span class="t-label">Account No.</span> <span class="t-value" style="font-family: monospace; color: var(--accent);">${sAcc}</span></div>
            <div class="t-row"><span class="t-label">Device</span> <span class="t-value">${sDevice}</span></div>
            <div class="t-row"><span class="t-label">IP Address</span> <span class="t-value">${sIp}</span></div>
            <div class="t-row"><span class="t-label">Account Type</span> <span class="t-value">${t.senderType || t.accountType || "Personal"}</span></div>
            <div class="t-row"><span class="t-label">KYC Status</span> <span class="t-value" style="font-weight: 600; color: ${sKycColor}">${sKyc}</span></div>
            <div class="t-row"><span class="t-label">Remark</span> <span class="t-value">${t.senderNote || t.remark || "General"}</span></div>
          </div>
          <div class="trx-box">
            <h4><i class="fa-solid fa-arrow-down-to-bracket"></i> Receiver Details</h4>
            <div class="t-row"><span class="t-label">Name</span> <span class="t-value">${rName}</span></div>
            ${merchantHtml}
            <div class="t-row"><span class="t-label">Account No.</span> <span class="t-value" style="font-family: monospace; color: var(--accent);">${rAcc}</span></div>
            <div class="t-row"><span class="t-label">Device</span> <span class="t-value">${rDevice}</span></div>
            <div class="t-row"><span class="t-label">IP Address</span> <span class="t-value">${rIp}</span></div>
            <div class="t-row"><span class="t-label">Account Type</span> <span class="t-value">${t.receiverType || (merchantHtml ? "Merchant" : "Personal")}</span></div>
            <div class="t-row"><span class="t-label">KYC Status</span> <span class="t-value" style="font-weight: 600; color: ${rKycColor}">${rKyc}</span></div>
            <div class="t-row"><span class="t-label">Remark</span> <span class="t-value">${t.receiverNote || t.remark || "General"}</span></div>
          </div>
          <div class="trx-box full">
            <h4><i class="fa-solid fa-circle-info"></i> Transaction Information</h4>
            <div class="t-row"><span class="t-label">Transaction Type</span> <span class="t-value" style="font-weight: 600; color: #3b82f6;">${t.type || "Platform Transfer"}</span></div>
            <div class="t-row"><span class="t-label">Payment Method</span> <span class="t-value">${t.trxMethod || t.method || "App Deep Link"}</span></div>
            <div class="t-row"><span class="t-label">Amount</span> <span class="t-value" style="font-size: 1.1rem; font-weight: bold; color: #10b981;">${isKHR ? "" : currSym}${fmtAmt}${isKHR ? " " + currSym : ""}</span></div>
            <div class="t-row"><span class="t-label">Status</span> <span class="t-value" style="color: ${isPending ? "#d97706" : t.status === "Failed" || t.status === "Rejected" || t.status === "Refunded" ? "#ef4444" : "#10b981"}; font-weight: bold;">${t.status || "Success"}</span></div>
            <div class="t-row"><span class="t-label">Network Fee</span> <span class="t-value">${isKHR ? "" : currSym}${fmtFee}${isKHR ? " " + currSym : ""}</span></div>
            <div class="t-row"><span class="t-label">System Profit</span> <span class="t-value" style="color: #6366f1;">${isKHR ? "" : currSym}${fmtProfit}${isKHR ? " " + currSym : ""}</span></div>
            <div class="t-row"><span class="t-label">Reference ID</span> <span class="t-value" style="font-family: monospace;">${t.refId || t.id || "N/A"}</span></div>
            <div class="t-row"><span class="t-label">Blockchain/Hash</span> <span class="t-value hash" style="font-family: monospace; word-break: break-all;">${t.hash || "N/A"}</span></div>
            <div class="t-row"><span class="t-label">Date & Time</span> <span class="t-value">${t.date || t.createdAt || "N/A"}</span></div>
            <div class="t-row" style="align-items: center;"><span class="t-label">Action</span><span class="t-value">${refundHtml}</span></div>
          </div>
        </div>
        ${isPending ? `<div class="trx-r-footer"><button class="btn-action-lg btn-approve" onclick="handleAdminAction('approve', '${t.refId || t.id}')"><i class="fa-solid fa-check"></i> Approve Only</button></div>` : ""}
      `;
    } else {
      box.style.display = "none";
      Swal.fire(
        "Not Found",
        data.message || "មិនមានទិន្នន័យប្រតិបត្តិការនេះនៅក្នុងប្រព័ន្ធទេ!",
        "error",
      );
    }
  } catch (error) {
    Swal.fire("Error", "មានបញ្ហាតភ្ជាប់ទៅកាន់ Server!", "error");
  }
}

async function handleAdminAction(action, id) {
  if (!id || id === "undefined")
    return Swal.fire(
      "Error",
      "រកមិនឃើញលេខសម្គាល់ប្រតិបត្តិការ (ID) ទេ!",
      "error",
    );
  let reason = "Admin Action";
  if (action === "refund") {
    const { value: text, isDismissed } = await Swal.fire({
      title: "បញ្ជាក់ការ Refund",
      input: "textarea",
      inputLabel: "សូមបញ្ជាក់មូលហេតុដែលដកលុយឱ្យអ្នកផ្ញើវិញ៖",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#94a3b8",
      confirmButtonText: "យល់ព្រម Refund",
      inputValidator: (value) => {
        if (!value || value.trim() === "")
          return "អ្នកត្រូវតែសរសេរមូលហេតុជាដាច់ខាត!";
      },
    });
    if (isDismissed || !text) return;
    reason = text;
  }
  const endpoint =
    action === "approve"
      ? "/api/admin/approve-transaction"
      : "/api/admin/refund-transaction";
  try {
    Swal.fire({
      title: "កំពុងដំណើរការ...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });
    const res = await fetch(endpoint, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ refId: id, reason: reason }),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      Swal.fire("ជោគជ័យ!", data.message, "success");
      if (typeof searchTrx === "function") searchTrx();
      else location.reload();
    } else {
      Swal.fire(
        "បរាជ័យ!",
        data.message || "មិនអាចធ្វើប្រតិបត្តិការបានទេ",
        "error",
      );
    }
  } catch (err) {
    Swal.fire("Error", "បញ្ហាក្នុងការតភ្ជាប់ទៅកាន់ Server", "error");
  }
}
