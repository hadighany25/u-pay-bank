// ========================================================================
// ឯកសារ: admin-cashier.js
// អត្ថន័យ: គ្រប់គ្រងប្រព័ន្ធបេឡាករ (Cashier System) ជាមួយលំហូរ ៣ ដំណាក់កាល
// ========================================================================

// ==========================================
// 📌 អថេរទូទៅ (Global Variables)
// ==========================================
let currentTargetUser = null;
let currentDepositorUser = null;
let activeTrxType = "Deposit";
let activeDepositorType = "self";
let isUserLocked = false;
let depositorTimeout = null;
let currentPayload = null; // ទុកទិន្នន័យបណ្តោះអាសន្នសម្រាប់ Submit

let allTickets = [];
let filteredTickets = [];
let currentTicketPage = 1;
const TICKETS_PER_PAGE = 10;
let viewingTicketId = null;

const currentAdminUser =
  sessionStorage.getItem("adminUsername") ||
  document.getElementById("adminNameDisplay").innerText;

// ==========================================
// 🔄 គ្រប់គ្រង TAB (Teller vs Approval)
// ==========================================
window.switchCashierTab = function (tabName) {
  document.getElementById("tabTeller").classList.remove("active");
  document.getElementById("tabApproval").classList.remove("active");
  document.getElementById("viewTeller").style.display = "none";
  document.getElementById("viewApproval").style.display = "none";

  if (tabName === "teller") {
    document.getElementById("tabTeller").classList.add("active");
    document.getElementById("viewTeller").style.display = "flex";
  } else {
    document.getElementById("tabApproval").classList.add("active");
    document.getElementById("viewApproval").style.display = "block";
    loadCashierTickets();
  }
};

// ==========================================
// 🏦 TAB 1: TELLER DESK LOGIC (ទម្រង់បញ្ជរគិតប្រាក់)
// ==========================================

// 🟢 កំណត់ប្រភេទប្រតិបត្តិការពីខាងក្រៅ (Deposit / Withdrawal)
window.setExternalTrxType = function (type) {
  if (isUserLocked) return;

  activeTrxType = type;
  const lblDep = document.getElementById("extLblDep");
  const lblWit = document.getElementById("extLblWit");
  const btnStep1 = document.getElementById("btnSubmitTrx");
  const formTitle = document.getElementById("formTitleText");
  const depSection = document.getElementById("depositorSection");

  if (type === "Deposit") {
    lblDep.style.background = "rgba(16,185,129,0.1)";
    lblDep.style.color = "#10b981";
    lblWit.style.background = "transparent";
    lblWit.style.color = "var(--text-muted)";

    btnStep1.style.background = "#10b981";
    formTitle.innerHTML = `<i class="fa-solid fa-file-invoice-dollar"></i> បំពេញទិន្នន័យដាក់ប្រាក់`;
    if (depSection) depSection.style.display = "block";
  } else {
    lblWit.style.background = "rgba(239,68,68,0.1)";
    lblWit.style.color = "#ef4444";
    lblDep.style.background = "transparent";
    lblDep.style.color = "var(--text-muted)";

    btnStep1.style.background = "#ef4444";
    formTitle.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color:#ef4444;"></i> បំពេញទិន្នន័យដកប្រាក់`;
    if (depSection) depSection.style.display = "none";
    activeDepositorType = "self";
  }
};

// 🟢 បង្ហាញ/លាក់ប៊ូតុងបោះបង់ (X) ពេលវាយលេខកុង
window.checkSearchInput = function () {
  if (isUserLocked) return;
  const val = document.getElementById("targetUserSearch").value.trim();
  const btnCancel = document.getElementById("btnCancelSearch");
  btnCancel.style.display = val.length > 0 ? "block" : "none";
};

// 🟢 ប៊ូតុងបោះបង់ (Reset Search & Form) មានការសួរបញ្ជាក់យ៉ាងឆ្លាតវៃ
window.resetCashierSearch = function () {
  const searchVal = document.getElementById("targetUserSearch").value.trim();
  const amountVal = document.getElementById("cashAmount").value.trim();
  const remarkVal = document.getElementById("cashRemark").value.trim();
  const depositorVal =
    document.getElementById("depositorSearchInput")?.value.trim() || "";

  const hasData =
    searchVal !== "" ||
    amountVal !== "" ||
    remarkVal !== "" ||
    depositorVal !== "" ||
    currentTargetUser !== null;

  if (hasData) {
    Swal.fire({
      title: "បោះបង់ការប្រតិបត្តិការ?",
      text: "ទិន្នន័យដែលអ្នកបំពេញនឹងត្រូវលុបចោលទាំងអស់។ តើអ្នកពិតជាចង់បោះបង់មែនទេ?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#64748b",
      confirmButtonText: "បាទ/ចាស, បោះបង់",
      cancelButtonText: "បន្តបំពេញ",
      customClass: { popup: "premium-swal" },
    }).then((result) => {
      if (result.isConfirmed) executeFormReset();
    });
  } else {
    executeFormReset();
  }
};

// 🟢 មុខងារ Reset ទិន្នន័យទាំងអស់ទៅសភាពដើម
window.executeFormReset = function () {
  isUserLocked = false;
  currentPayload = null;

  document.getElementById("step2_PreviewForm").style.display = "none";
  document.getElementById("step1_InputForm").style.display = "block";
  document.getElementById("previewTitleText").innerHTML =
    `<i class="fa-solid fa-magnifying-glass"></i> ផ្ទៀងផ្ទាត់ប្រតិបត្តិការ`;

  document.getElementById("targetUserSearch").value = "";
  document.getElementById("targetUserSearch").disabled = false;
  document.getElementById("btnCancelSearch").style.display = "none";
  document.getElementById("cashAmount").value = "";
  document.getElementById("cashRemark").value = "";
  document.getElementById("targetAccountDisplay").value = "";
  document.getElementById("targetAccountSelect").value = "";

  const depInput = document.getElementById("depositorSearchInput");
  if (depInput) depInput.value = "";
  document.getElementById("depositorCardPreview").style.display = "none";
  document.getElementById("depositorInputWrapper").style.display = "none";
  setDepositorType("self");

  document.getElementById("targetUserCard").style.display = "none";
  document.getElementById("transactionForm").style.display = "none";
  const previewBox = document.getElementById("cashierExchangePreview");
  if (previewBox) previewBox.style.display = "none";

  document.getElementById("extLblDep").style.pointerEvents = "auto";
  document.getElementById("extLblWit").style.pointerEvents = "auto";

  currentTargetUser = null;
  currentDepositorUser = null;
  document.getElementById("targetUserSearch").focus();
};

// 🟢 កំណត់ប្រភេទអ្នកដាក់ប្រាក់
window.setDepositorType = function (type) {
  activeDepositorType = type;
  document.getElementById("lblSelf").classList.remove("active");
  document.getElementById("lblOther").classList.remove("active");

  const depWrapper = document.getElementById("depositorInputWrapper");
  const depPreview = document.getElementById("depositorCardPreview");

  if (type === "self") {
    document.getElementById("lblSelf").classList.add("active");
    depWrapper.style.display = "none";
    depPreview.style.display = "none";
    document.getElementById("depositorSearchInput").value = "";
    currentDepositorUser = null;
  } else {
    document.getElementById("lblOther").classList.add("active");
    depWrapper.style.display = "block";
  }
};

// 🟢 ស្វែងរកអ្នកតំណាង
window.verifyDepositorAccount = function (val) {
  val = val.trim();
  const previewCard = document.getElementById("depositorCardPreview");
  const depName = document.getElementById("depName");
  const depInfo = document.getElementById("depInfo");
  const depAvatar = document.getElementById("depAvatar");

  if (!val) {
    previewCard.style.display = "none";
    currentDepositorUser = null;
    return;
  }

  clearTimeout(depositorTimeout);
  depositorTimeout = setTimeout(async () => {
    try {
      const res = await fetch(`/api/admin/cashier/search/${val}`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      previewCard.style.display = "flex";

      if (data.success) {
        if (
          data.user.username === currentTargetUser.username ||
          data.user.idNumber === currentTargetUser.idNumber
        ) {
          depAvatar.style.display = "none";
          depName.innerHTML = `<span style="color:#ef4444;"><i class="fa-solid fa-triangle-exclamation"></i> អ្នកតំណាងមិនអាចជាម្ចាស់គណនីផ្ទាល់បានទេ!</span>`;
          depInfo.innerText = "សូមជ្រើសរើស 'ម្ចាស់គណនីផ្ទាល់' វិញ...";
          currentDepositorUser = null;
          return;
        }

        currentDepositorUser = data.user;
        depAvatar.style.display = "block";
        depAvatar.src =
          currentDepositorUser.profileImage || "../images/default-avatar.png";
        depName.innerHTML = `<i class="fa-solid fa-circle-check" style="color:#10b981;"></i> ${currentDepositorUser.fullName || currentDepositorUser.username}`;
        depInfo.innerText = `ID: ${currentDepositorUser.userId || "N/A"} | Tel: ${currentDepositorUser.phone || "N/A"}`;
      } else {
        depAvatar.style.display = "none";
        depName.innerHTML = `<span style="color:#ef4444;"><i class="fa-solid fa-circle-xmark"></i> រកមិនឃើញគណនីនេះទេ</span>`;
        depInfo.innerText = "មិនអនុញ្ញាតឱ្យធ្វើប្រតិបត្តិការ...";
        currentDepositorUser = null;
      }
    } catch (e) {
      console.error(e);
    }
  }, 500);
};

window.viewDepositorKYC = function () {
  if (!currentDepositorUser || !currentDepositorUser.kycImage) {
    return Swal.fire({
      icon: "info",
      text: "អ្នកតំណាងនេះមិនទាន់មានរូប KYC ទេ",
      customClass: { popup: "premium-swal" },
    });
  }
  Swal.fire({
    title: `អត្តសញ្ញាណប័ណ្ណអ្នកតំណាង`,
    imageUrl: currentDepositorUser.kycImage,
    imageWidth: 400,
    customClass: { popup: "premium-swal" },
  });
};

// 🟢 ស្វែងរកម្ចាស់គណនី
window.searchTargetUser = async function () {
  const searchVal = document.getElementById("targetUserSearch").value.trim();
  if (!searchVal) return;

  Swal.fire({
    title: "កំពុងស្វែងរក...",
    didOpen: () => Swal.showLoading(),
    customClass: { popup: "premium-swal" },
  });

  try {
    const res = await fetch(`/api/admin/cashier/search/${searchVal}`, {
      headers: getAuthHeaders(),
    });
    const data = await res.json();

    if (data.success) {
      Swal.close();
      currentTargetUser = data.user;
      isUserLocked = true;

      document.getElementById("targetUserSearch").disabled = true;
      document.getElementById("extLblDep").style.pointerEvents = "none";
      document.getElementById("extLblWit").style.pointerEvents = "none";
      document.getElementById("targetUserCard").style.display = "block";
      document.getElementById("transactionForm").style.display = "block";

      document.getElementById("cardAvatar").src =
        currentTargetUser.profileImage || "../images/default-avatar.png";
      document.getElementById("cardName").textContent =
        `${currentTargetUser.fullName || currentTargetUser.username}`;
      document.getElementById("cardUserId").textContent =
        `ID : ${currentTargetUser.userId || "N/A"}`;
      document.getElementById("cardUIdNum").textContent =
        `CARD ID : ${currentTargetUser.idNumber || "N/A"}`;
      document.getElementById("cardPhone").textContent =
        currentTargetUser.phone || "N/A";
      document.getElementById("cardEmail").textContent =
        currentTargetUser.email || "N/A";

      const balancesContainer = document.getElementById(
        "cardBalancesContainer",
      );
      let balancesHtml = "";
      const allAccounts = [];

      const usdBal = currentTargetUser.mainAccounts?.USD?.balance || 0;
      const usdAccNum = currentTargetUser.mainAccounts?.USD?.accountNumber;
      if (usdAccNum) {
        allAccounts.push({
          name: "Main USD",
          currency: "USD",
          accountNumber: usdAccNum,
        });
        balancesHtml += `<div style="background: var(--bg-card); padding: 12px 16px; border-radius: 12px; border: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; box-shadow: 0 2px 5px rgba(0,0,0,0.02);"><div><div style="display: flex; align-items: center; gap: 8px;"><div style="width: 8px; height: 8px; background: #0ea5e9; border-radius: 50%;"></div><span style="color: var(--text-main); font-weight: bold; font-size: 0.9rem;">Main USD</span></div><div style="font-size: 0.7rem; color: var(--text-muted); font-family: monospace; margin-left: 16px;">${usdAccNum}</div></div><span style="font-family: monospace; font-weight: bold; font-size: 1.05rem; color: #0ea5e9;">$${usdBal.toFixed(2)}</span></div>`;
      }

      const khrBal = currentTargetUser.mainAccounts?.KHR?.balance || 0;
      const khrAccNum = currentTargetUser.mainAccounts?.KHR?.accountNumber;
      if (khrAccNum) {
        allAccounts.push({
          name: "Main KHR",
          currency: "KHR",
          accountNumber: khrAccNum,
        });
        balancesHtml += `<div style="background: var(--bg-card); padding: 12px 16px; border-radius: 12px; border: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; box-shadow: 0 2px 5px rgba(0,0,0,0.02);"><div><div style="display: flex; align-items: center; gap: 8px;"><div style="width: 8px; height: 8px; background: #10b981; border-radius: 50%;"></div><span style="color: var(--text-main); font-weight: bold; font-size: 0.9rem;">Main KHR</span></div><div style="font-size: 0.7rem; color: var(--text-muted); font-family: monospace; margin-left: 16px;">${khrAccNum}</div></div><span style="font-family: monospace; font-weight: bold; font-size: 1.05rem; color: #10b981;">៛${khrBal.toLocaleString()}</span></div>`;
      }

      if (
        currentTargetUser.subAccounts &&
        currentTargetUser.subAccounts.length > 0
      ) {
        currentTargetUser.subAccounts.forEach((sub) => {
          allAccounts.push({
            name: sub.accountName,
            currency: sub.currency,
            accountNumber: sub.accountNumber,
          });
          const subColor = sub.currency === "USD" ? "#3b82f6" : "#059669";
          balancesHtml += `<div style="background: var(--bg-card); padding: 12px 16px; border-radius: 12px; border: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; box-shadow: 0 2px 5px rgba(0,0,0,0.02);"><div><div style="display: flex; align-items: center; gap: 8px;"><div style="width: 8px; height: 8px; background: ${subColor}; border-radius: 50%;"></div><span style="color: var(--text-main); font-weight: bold; font-size: 0.9rem;">${sub.accountName} (${sub.currency})</span></div><div style="font-size: 0.7rem; color: var(--text-muted); font-family: monospace; margin-left: 16px;">${sub.accountNumber}</div></div><span style="font-family: monospace; font-weight: bold; font-size: 1.05rem; color: ${subColor};">${sub.currency === "USD" ? "$" : "៛"}${sub.balance.toLocaleString()}</span></div>`;
        });
      }
      balancesContainer.innerHTML = balancesHtml;

      const kycStat = (
        currentTargetUser.kycStatus || "unverified"
      ).toUpperCase();
      const kycBadge = document.getElementById("cardKycBadge");
      kycBadge.textContent = `KYC: ${kycStat}`;
      kycBadge.style.background =
        kycStat === "VERIFIED" || kycStat === "APPROVED"
          ? "rgba(16, 185, 129, 0.1)"
          : "rgba(245, 158, 11, 0.1)";
      kycBadge.style.color =
        kycStat === "VERIFIED" || kycStat === "APPROVED"
          ? "#10b981"
          : "#f59e0b";

      const isFrozen = currentTargetUser.isFrozen;
      const statusBadge = document.getElementById("cardStatusBadge");
      statusBadge.textContent = isFrozen ? "FROZEN" : "ACTIVE";
      statusBadge.style.background = isFrozen
        ? "rgba(239, 68, 68, 0.1)"
        : "rgba(16, 185, 129, 0.1)";
      statusBadge.style.color = isFrozen ? "#ef4444" : "#10b981";

      let matchedAcc = allAccounts.find((a) => a.accountNumber === searchVal);
      if (!matchedAcc && allAccounts.length > 0) matchedAcc = allAccounts[0];

      if (matchedAcc) {
        document.getElementById("targetAccountSelect").value =
          matchedAcc.accountNumber;
        document.getElementById("targetAccountDisplay").value =
          `${matchedAcc.name} (${matchedAcc.currency}) - ${matchedAcc.accountNumber}`;
        document.getElementById("cashCurrency").value = matchedAcc.currency;
      }
      previewCashierExchange();
    } else {
      Swal.fire({
        icon: "error",
        title: "រកមិនឃើញទេ!",
        text: data.message,
        customClass: { popup: "premium-swal" },
      });
      executeFormReset();
    }
  } catch (error) {
    Swal.fire({
      icon: "error",
      title: "Error",
      text: "បញ្ហាភ្ជាប់ទៅ Server",
      customClass: { popup: "premium-swal" },
    });
  }
};

window.viewKYC = function () {
  if (!currentTargetUser || !currentTargetUser.kycImage) {
    return Swal.fire({
      icon: "info",
      text: "អតិថិជននេះមិនទាន់មានរូប KYC ទេ",
      customClass: { popup: "premium-swal" },
    });
  }
  Swal.fire({
    title: `អត្តសញ្ញាណប័ណ្ណ`,
    imageUrl: currentTargetUser.kycImage,
    imageWidth: 400,
    customClass: { popup: "premium-swal" },
  });
};

window.previewCashierExchange = function () {
  const targetSelectValue = document.getElementById(
    "targetAccountSelect",
  ).value;
  if (!targetSelectValue) return;

  const displayVal = document.getElementById("targetAccountDisplay").value;
  let destCurrency =
    displayVal.includes("KHR") || displayVal.includes("៛") ? "KHR" : "USD";
  const inputCurrency = document.getElementById("cashCurrency").value;
  const rawValue = document
    .getElementById("cashAmount")
    .value.replace(/,/g, "");
  const amount = parseFloat(rawValue) || 0;

  const rateBuy = window.currentFXRates?.usdToKhrBuy || 4050;
  const rateSell = window.currentFXRates?.usdToKhrSell || 4100;

  if (amount > 0 && destCurrency !== inputCurrency) {
    document.getElementById("cashierExchangePreview").style.display = "block";
    if (inputCurrency === "USD" && destCurrency === "KHR") {
      document.getElementById("cashierFxRateDisplay").innerText =
        `$1 = ${rateBuy.toLocaleString()} ៛`;
      document.getElementById("cashierExchangeResult").innerText =
        `${Math.round(amount * rateBuy).toLocaleString()} ៛`;
    } else if (inputCurrency === "KHR" && destCurrency === "USD") {
      document.getElementById("cashierFxRateDisplay").innerText =
        `$1 = ${rateSell.toLocaleString()} ៛`;
      document.getElementById("cashierExchangeResult").innerText =
        `$${(amount / rateSell).toFixed(2)}`;
    }
  } else {
    document.getElementById("cashierExchangePreview").style.display = "none";
  }
};

// ==========================================
// 🚀 ដំណើរការ ៣ ដំណាក់កាល (Input -> Preview -> Success)
// ==========================================

function numberToWordsUSD(amount) {
  return (
    amount.toLocaleString("en-US", { style: "currency", currency: "USD" }) +
    " ONLY"
  );
}
function numberToWordsKHR(amount) {
  return amount.toLocaleString() + " RIELS ONLY";
}

// 🟢 ចូលទៅកាន់ដំណាក់កាលទី ២៖ ផ្ទាំង Preview វិក្កយបត្រ
window.goToPreviewStep = function () {
  const rawValue = document
    .getElementById("cashAmount")
    .value.replace(/,/g, "");
  const amount = parseFloat(rawValue);
  if (!amount || amount <= 0)
    return Swal.fire({
      icon: "warning",
      text: "សូមវាយទឹកប្រាក់ជាមុនសិន!",
      customClass: { popup: "premium-swal" },
    });

  const targetAccount = document.getElementById("targetAccountSelect").value;
  const currency = document.getElementById("cashCurrency").value;
  const remark = document.getElementById("cashRemark").value.trim();

  let finalDepositorName = "";
  let finalDepositorAccount = ""; // 🟢 បន្ថែមអថេរលេខកុងអ្នកដាក់ប្រាក់

  if (activeTrxType === "Deposit" && activeDepositorType === "other") {
    if (!currentDepositorUser)
      return Swal.fire({
        icon: "warning",
        text: "សូមស្វែងរកគណនីអ្នកតំណាងឱ្យបានត្រឹមត្រូវ!",
        customClass: { popup: "premium-swal" },
      });
    finalDepositorName =
      currentDepositorUser.fullName || currentDepositorUser.username;
    // ទាញយកលេខកុងអ្នកតំណាង
    finalDepositorAccount =
      currentDepositorUser.mainAccounts?.USD?.accountNumber ||
      currentDepositorUser.mainAccounts?.KHR?.accountNumber ||
      "N/A";
  } else {
    finalDepositorName =
      currentTargetUser.fullName || currentTargetUser.username;
    // ទាញយកលេខកុងម្ចាស់គណនី
    finalDepositorAccount =
      currentTargetUser.mainAccounts?.USD?.accountNumber ||
      currentTargetUser.mainAccounts?.KHR?.accountNumber ||
      "N/A";
  }

  currentPayload = {
    targetUsername: currentTargetUser.username,
    targetAccount: targetAccount,
    requestType: activeTrxType,
    depositorName: finalDepositorName,
    depositorAccount: finalDepositorAccount, // 🟢 បញ្ជូនទៅ Backend ដើម្បីប្រើប្រាស់
    currency: currency,
    amount: amount,
    remark: remark,
  };

  // ១. ទាញយកសមតុល្យចាស់
  let currentBal = 0;
  if (currentTargetUser.mainAccounts?.USD?.accountNumber === targetAccount)
    currentBal = Number(currentTargetUser.mainAccounts.USD.balance) || 0;
  else if (currentTargetUser.mainAccounts?.KHR?.accountNumber === targetAccount)
    currentBal = Number(currentTargetUser.mainAccounts.KHR.balance) || 0;
  else {
    const sub = currentTargetUser.subAccounts?.find(
      (s) => s.accountNumber === targetAccount,
    );
    if (sub) currentBal = Number(sub.balance) || 0;
  }

  // ២. ធ្វើការបូក (Deposit) ឬ ដក (Withdrawal)
  const numericAmount = Number(amount) || 0;
  let newBal =
    activeTrxType === "Deposit"
      ? currentBal + numericAmount
      : currentBal - numericAmount;

  let curSymbol = currency === "USD" ? "$" : "៛";

  const slipTypeElem = document.getElementById("inlineSlipType");
  const btnFinalSubmit = document.getElementById("btnFinalSubmit");

  if (activeTrxType === "Deposit") {
    slipTypeElem.innerText = "ប័ណ្ណដាក់ប្រាក់ / CASH DEPOSIT";
    slipTypeElem.style.color = "#10b981";
    btnFinalSubmit.style.background = "#10b981";
    document.getElementById("inlineSlipAmount").style.color = "#10b981";
    document.getElementById("inlineSlipDepositorLabel").innerText =
      "អ្នកដាក់ប្រាក់ / Deposited By:";
    document.getElementById("sigLabelDepositor").innerHTML =
      "អ្នកដាក់ប្រាក់<br>Depositor";
  } else {
    slipTypeElem.innerText = "ប័ណ្ណដកប្រាក់ / CASH WITHDRAWAL";
    slipTypeElem.style.color = "#ef4444";
    btnFinalSubmit.style.background = "#ef4444";
    document.getElementById("inlineSlipAmount").style.color = "#ef4444";
    document.getElementById("inlineSlipDepositorLabel").innerText =
      "អ្នកដកប្រាក់ / Withdrawn By:";
    document.getElementById("sigLabelDepositor").innerHTML =
      "អ្នកដកប្រាក់<br>Withdrawer";
  }

  document.getElementById("inlineSlipDate").innerText =
    new Date().toLocaleString();
  document.getElementById("inlineSlipMaker").innerText = currentAdminUser;
  document.getElementById("inlineSlipCustomer").innerText =
    currentTargetUser.fullName || currentTargetUser.username;
  document.getElementById("inlineSlipAccount").innerText = targetAccount;
  document.getElementById("inlineSlipDepositor").innerText = finalDepositorName;

  // កែទម្រង់ចំនួនទឹកប្រាក់
  document.getElementById("inlineSlipAmount").innerText =
    `${curSymbol}${amount.toLocaleString("en-US", {
      minimumFractionDigits: currency === "USD" ? 2 : 0,
      maximumFractionDigits: currency === "USD" ? 2 : 0,
    })}`;

  // 🟢 ជួសជុលបញ្ហាទី១៖ បង្ហាញទឹកប្រាក់ជាអក្សរនៅក្រោមទំហំទឹកប្រាក់
  document.getElementById("inlineSlipAmountWords").innerText =
    currency === "USD" ? numberToWordsUSD(amount) : numberToWordsKHR(amount);

  // កែទម្រង់សមតុល្យចាស់ & ថ្មី
  document.getElementById("inlineSlipOldBal").innerText =
    `${curSymbol}${currentBal.toLocaleString("en-US", {
      minimumFractionDigits: currency === "USD" ? 2 : 0,
      maximumFractionDigits: currency === "USD" ? 2 : 0,
    })}`;

  document.getElementById("inlineSlipNewBal").innerText =
    `${curSymbol}${newBal.toLocaleString("en-US", {
      minimumFractionDigits: currency === "USD" ? 2 : 0,
      maximumFractionDigits: currency === "USD" ? 2 : 0,
    })}`;

  // 🟢 ជួសជុលបញ្ហាទី២៖ កំណត់ Remark ស្វ័យប្រវត្តិបង្ហាញលើ Preview Slip ឱ្យដូច Backend
  const autoRemark =
    activeTrxType === "Deposit"
      ? `ដាក់ប្រាក់ដោយ: ${finalDepositorName} (${finalDepositorAccount})`
      : `ដកប្រាក់ដោយ: ${finalDepositorName} (${finalDepositorAccount})`;

  const finalRemark =
    remark && remark.trim() !== ""
      ? `${remark.trim()} | ${autoRemark}`
      : autoRemark;

  document.getElementById("inlineSlipRemark").innerText = finalRemark;

  document.getElementById("inlineSlipStatus").innerText =
    "PENDING VERIFICATION";
  document.getElementById("inlineSlipStatus").style.color = "#d97706";

  document.getElementById("inlineSlipQRCode").src =
    `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://u-pay-bank.fly.dev/`;
  document.getElementById("inlineSlipTrxBox").style.display = "none";

  let isBigTrx = false;
  if (currency === "USD" && amount > 10000) isBigTrx = true;
  if (currency === "KHR" && amount > 40000000) isBigTrx = true;
  document.getElementById("inlineSlipWarning").style.display = isBigTrx
    ? "block"
    : "none";

  document.getElementById("step1_InputForm").style.display = "none";
  document.getElementById("step2_PreviewForm").style.display = "block";
  document.getElementById("previewActionBtns").style.display = "grid";
  document.getElementById("successActionBtns").style.display = "none";
};

// 🟢 ថយក្រោយទៅកាន់ដំណាក់កាលទី ១ វិញ
window.backToInputForm = function () {
  document.getElementById("step2_PreviewForm").style.display = "none";
  document.getElementById("step1_InputForm").style.display = "block";
};

// 🟢 បញ្ជូនទិន្នន័យចុងក្រោយ (Submit -> API)
window.submitCashierTrx = async function () {
  if (!currentPayload) return;

  Swal.fire({
    title: "កំពុងដំណើរការ...",
    didOpen: () => Swal.showLoading(),
    customClass: { popup: "premium-swal" },
  });

  try {
    const res = await fetch("/api/admin/cashier/ticket/create", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(currentPayload),
    });
    const data = await res.json();

    if (data.success) {
      Swal.close();

      document.getElementById("previewTitleText").innerHTML =
        `<i class="fa-solid fa-circle-check" style="color: #10b981;"></i> ប្រតិបត្តិការជោគជ័យ`;

      // 🟢 ទាញយក Status ពិតប្រាកដដែលបានសន្សំក្នុង Database តាមរយៈ data.ticket.status
      const dbStatus = data.ticket?.status || "pending_verify";
      const formattedStatus = formatTicketStatus(dbStatus);

      document.getElementById("inlineSlipStatus").innerText = formattedStatus;
      document.getElementById("inlineSlipStatus").style.color =
        dbStatus.includes("pending") ? "#d97706" : "#10b981";

      const realTrxId =
        data.ticket?.transactionId || data.transactionId || null;
      if (realTrxId) {
        document.getElementById("inlineSlipRef").innerText = realTrxId;
        document.getElementById("inlineSlipTrxBox").style.display = "block";
        document.getElementById("inlineSlipQRCode").src =
          `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://u-pay-bank.fly.dev/receipt/${realTrxId}`;
      }

      document.getElementById("previewActionBtns").style.display = "none";
      document.getElementById("successActionBtns").style.display = "grid";
    } else {
      Swal.fire({
        icon: "error",
        title: "បរាជ័យ",
        text: data.message,
        customClass: { popup: "premium-swal" },
      });
    }
  } catch (error) {
    Swal.fire({
      icon: "error",
      title: "កំហុស",
      text: "បញ្ហាភ្ជាប់ទៅ Server",
      customClass: { popup: "premium-swal" },
    });
  }
};

// 🟢 មុខងារកាត់ក្បៀសស្វ័យប្រវត្តិ និងការពារការវាយអក្សរ
window.formatCurrencyInput = function (input) {
  // លុបអក្សរ ឬនិមិត្តសញ្ញាផ្សេងៗទុកតែលេខ និងសញ្ញាចុច (.) ប៉ុណ្ណោះ
  let value = input.value.replace(/[^0-9.]/g, "");

  // ការពារកុំឱ្យវាយសញ្ញាចុច (.) លើសពីមួយដង
  const parts = value.split(".");
  if (parts.length > 2) {
    value = parts[0] + "." + parts.slice(1).join("");
  }

  // កាត់ក្បៀសសម្រាប់ផ្នែកចំនួនគត់រាល់ ៣ ខ្ទង់
  if (parts[0]) {
    parts[0] = parseInt(parts[0], 10).toLocaleString("en-US");
  }

  input.value = parts.join(".");
};

// 🟢 ព្រីនវិក្កយបត្រ A4 បញ្ឈរ (Customer & Bank Copy - ស្មើគ្នា ១០០% ល្មម ១ សន្លឹក មិនធ្លាក់)
window.printInlineSlip = function () {
  const printContent = document.getElementById("inlineSlipArea").innerHTML;
  const printWindow = window.open("", "_blank", "width=800,height=900");

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>U-Pay Transaction Slip</title>
        <link href="https://fonts.googleapis.com/css2?family=Kantumruy+Pro:wght@400;600;700;800&family=JetBrains+Mono:wght@400;700;800&display=swap" rel="stylesheet">
        <style>
          /* 🟢 កំណត់ទំហំ A4 បញ្ឈរ និងលុប Margin របស់ Browser ចោល ១០០% */
          @page { size: A4 portrait; margin: 0 !important; }
          
          body { 
            font-family: 'Kantumruy Pro', sans-serif; 
            color: #0f172a; 
            padding: 0; 
            margin: 0; 
            -webkit-print-color-adjust: exact !important; 
            color-adjust: exact !important;
            box-sizing: border-box;
            background: white;
          }

          /* គ្រប់គ្រងក្រដាស A4 ទាំងមូលកម្ពស់ត្រឹម 297mm (ទំហំស្តង់ដារ) */
          .page-container { 
            display: flex; 
            flex-direction: column; 
            width: 210mm; 
            height: 297mm; 
            overflow: hidden; 
            margin: 0 auto; 
            background: white;
          }

          /* បែងចែកកាតជា ២ ស្មើគ្នា (៥០% ម្នាក់) និងតម្រឹមអោយនៅកណ្តាល */
          .slip-half { 
            flex: 1; 
            height: 50%; 
            padding: 10mm 20mm; /* គម្លាតស្មើគ្នាទាំងលើក្រោម និងឆ្វេងស្តាំ */
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            justify-content: center; /* ទាញ Content អោយនៅកណ្តាលជានិច្ច កុំអោយប៉ះគែម */
          }

          /* ✂️ បន្ទាត់កន្ត្រៃកាត់ពុះកណ្តាលក្រដាសដាច់ដោយឡែក */
          .cut-line-container {
            width: 100%;
            height: 0; /* មិនអោយស៊ីកម្ពស់ */
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            z-index: 10;
          }
          .cut-line {
            width: 100%;
            border-top: 1px dashed #94a3b8;
            position: absolute;
          }
          .cut-icon {
            background: white;
            padding: 0 10px;
            color: #64748b;
            font-size: 16px;
            position: relative;
            z-index: 11;
          }
          
          .copy-label { 
            text-align: center; 
            font-size: 0.65rem; 
            color: #64748b; 
            font-weight: 800; 
            text-transform: uppercase; 
            letter-spacing: 1px; 
            margin-bottom: 10px; 
          }

          /* បង្រួម Content ខាងក្នុងបន្តិចកុំអោយតឹងពេក */
          .slip-content {
            transform: scale(0.95);
            transform-origin: center center;
            width: 100%;
          }
          
          /* 🟢 រចនាបថអក្សរ និងគម្លាតខាងក្នុង Slip */
          .pro-slip-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px; margin-bottom: 8px; }
          .pro-slip-header img { height: 35px !important; }
          .pro-slip-title { text-align: right; }
          .pro-slip-title h2 { margin: 0; font-size: 0.95rem; font-weight: 800; text-transform: uppercase; }
          #inlineSlipDate { margin: 2px 0 0 0 !important; font-size: 0.7rem !important; }
          #inlineSlipTrxBox { margin-top: 2px !important; font-size: 0.8rem !important; }
          #inlineSlipRef { font-size: 0.9rem !important; }

          .pro-slip-box { background: #ffffff !important; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; padding: 5px 0; margin-bottom: 6px; }
          .pro-slip-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
          .pro-slip-row:last-child { margin-bottom: 0; }
          .pro-slip-label { font-size: 0.65rem; color: #64748b; font-weight: 600; }
          .pro-slip-value { font-size: 0.8rem; font-weight: 700; color: #0f172a; }
          .pro-slip-value.acc-num { font-family: 'JetBrains Mono', monospace; color: #2563eb; font-size: 0.85rem; }
          .pro-slip-amount { font-size: 1.15rem; font-weight: 800; font-family: 'JetBrains Mono', monospace; }
          #inlineSlipAmountWords { font-size: 0.65rem !important; margin-top: 2px !important; }
          
          /* ហត្ថលេខា និង QR */
          .signature-section { display: flex; gap: 10px; margin-top: 8px; padding-top: 8px; border-top: 1px solid #e2e8f0; }
          #inlineSlipQRCode { width: 60px !important; height: 60px !important; }
          .qr-text { font-size: 0.55rem !important; margin-top: 3px !important; }
          .signature-box { flex: 1; text-align: center; height: 60px !important; display: flex !important; flex-direction: column; justify-content: flex-end; }
          .signature-line { border-bottom: 1px dashed #94a3b8; width: 100%; margin-bottom: 4px; }
          .signature-label { font-size: 0.5rem; font-weight: bold; color: #475569; text-transform: uppercase; line-height: 1.2; margin-top: 2px !important; }
          
          #inlineSlipWarning { display: none !important; }
        </style>
      </head>
      <body>
        <div class="page-container">
          
          <!-- ផ្នែកខាងលើ (Customer Copy) -->
          <div class="slip-half">
            <div class="slip-content">
              <div class="copy-label">CUSTOMER COPY</div>
              ${printContent}
            </div>
          </div>

          <!-- បន្ទាត់កន្ត្រៃកណ្តាលក្រដាស (មិនជាន់លើ Content) -->
          <div class="cut-line-container">
            <div class="cut-line"></div>
            <div class="cut-icon">✂️</div>
          </div>

          <!-- ផ្នែកខាងក្រោម (Bank Copy) -->
          <div class="slip-half">
            <div class="slip-content">
              <div class="copy-label">BANK COPY</div>
              ${printContent}
            </div>
          </div>

        </div>
        <script>
          window.onload = function() {
            setTimeout(() => {
              window.print();
              window.close();
            }, 300);
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
};

// ==========================================
// 🛡️ TAB 2: APPROVALS LOGIC (MAKER-CHECKER)
// ==========================================

window.loadCashierTickets = async function () {
  try {
    const res = await fetch("/api/admin/cashier/tickets", {
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (data.success) {
      allTickets = data.tickets;
      filterTickets();
    }
  } catch (e) {
    console.error(e);
  }
};

window.filterTickets = function () {
  const term = document.getElementById("searchTicket").value.toLowerCase();
  const dateF = document.getElementById("ticketDate").value;
  const statusF = document.getElementById("ticketStatus").value;

  filteredTickets = allTickets.filter((t) => {
    let matchTerm = true;
    if (term)
      matchTerm =
        t.targetAcc?.toLowerCase().includes(term) ||
        t.maker?.toLowerCase().includes(term) ||
        t._id?.toLowerCase().includes(term);
    let matchDate = true;
    if (dateF) matchDate = t.createdAt && t.createdAt.startsWith(dateF);
    let matchStatus = true;
    if (statusF !== "ALL") matchStatus = t.status === statusF;
    return matchTerm && matchDate && matchStatus;
  });

  currentTicketPage = 1;
  renderCashierTickets();
};

function renderCashierTickets() {
  const tbody = document.getElementById("ticketsTableBody");
  if (filteredTickets.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 30px; color: var(--text-muted);">មិនមានទិន្នន័យទេ</td></tr>`;
    updateTicketPagination(0);
    return;
  }

  const totalPages = Math.ceil(filteredTickets.length / TICKETS_PER_PAGE);
  const start = (currentTicketPage - 1) * TICKETS_PER_PAGE;
  const items = filteredTickets.slice(start, start + TICKETS_PER_PAGE);
  let html = "";

  items.forEach((t) => {
    const date = new Date(t.createdAt).toLocaleString();
    const typeColor = t.requestType === "Deposit" ? "#10b981" : "#f59e0b";
    let statusBadge = "";

    if (t.status === "pending_approve")
      statusBadge = `<span style="background:#fef3c7; color:#d97706; padding:4px 8px; border-radius:8px; font-size:0.75rem; font-weight:bold;">Pending Approve</span>`;
    else if (t.status === "pending_verify")
      statusBadge = `<span style="background:#e0e7ff; color:#4f46e5; padding:4px 8px; border-radius:8px; font-size:0.75rem; font-weight:bold;">Pending Verify</span>`;
    else if (t.status === "approved" || t.status === "verified")
      statusBadge = `<span style="background:#dcfce7; color:#10b981; padding:4px 8px; border-radius:8px; font-size:0.75rem; font-weight:bold;">${t.status.toUpperCase()}</span>`;
    else
      statusBadge = `<span style="background:#fee2e2; color:#ef4444; padding:4px 8px; border-radius:8px; font-size:0.75rem; font-weight:bold;">REJECTED</span>`;

    // 🟢 បង្ហាញលេខ TRX ID ពេញលេញ
    const displayRefId = t.transactionId
      ? t.transactionId
      : t._id.toUpperCase();

    html += `
      <tr style="cursor: pointer; transition: 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'" onclick="openTicketDrawer('${t._id}')">
        <td style="font-size: 0.85rem; color: var(--text-muted);">${date}</td>
        <td style="font-family: monospace; font-weight: bold; color: var(--text-main);">${displayRefId}</td>
        <td style="color: ${typeColor}; font-weight: bold;">${t.requestType}</td>
        <td style="font-family: monospace;">${t.targetAcc}</td>
        <td style="font-weight: bold;">${t.currency === "USD" ? "$" : "៛"}${t.amount.toLocaleString()}</td>
        <td>@${t.maker}</td>
        <td>${statusBadge}</td>
        <td style="text-align: right;"><button class="btn-action"><i class="fa-solid fa-eye"></i></button></td>
      </tr>`;
  });

  tbody.innerHTML = html;
  updateTicketPagination(totalPages);
}

window.changeTicketPage = function (step) {
  currentTicketPage += step;
  renderCashierTickets();
};

function updateTicketPagination(totalPages) {
  document.getElementById("btnPrevTicket").disabled = currentTicketPage <= 1;
  document.getElementById("btnNextTicket").disabled =
    currentTicketPage >= totalPages || totalPages === 0;
  document.getElementById("ticketPageInfo").innerText =
    totalPages === 0 ? "ទំព័រ 0" : `ទំព័រ ${currentTicketPage} / ${totalPages}`;
}

// ==========================================
// 🧾 SLIP DRAWER & ACTIONS
// ==========================================

window.openTicketDrawer = function (id) {
  const t = allTickets.find((x) => x._id === id);
  if (!t) return;
  viewingTicketId = id;

  document.getElementById("slipType").innerText =
    `CASH ${t.requestType.toUpperCase()}`;
  document.getElementById("slipDate").innerText = new Date(
    t.createdAt,
  ).toLocaleString();

  // 🟢 បង្ហាញលេខ TRX ID ពេញលេញនៅពេលបើកមើល Slip ឡើងវិញ
  const displayRefId = t.transactionId ? t.transactionId : t._id.toUpperCase();
  document.getElementById("slipRef").innerText = displayRefId;

  // 🟢 យក Status ពិតប្រាកដពី Database មកបំលែងបង្ហាញលើ Drawer Slip
  document.getElementById("slipStatus").innerText = formatTicketStatus(
    t.status,
  );
  document.getElementById("slipMaker").innerText = t.maker;
  document.getElementById("slipChecker").innerText = t.checker || "N/A";
  document.getElementById("slipCustomer").innerText =
    t.slipData?.customerName || "Unknown";
  document.getElementById("slipAccount").innerText = t.targetAcc;
  document.getElementById("slipDepositor").innerText =
    t.depositorName || t.slipData?.customerName || "Unknown";
  document.getElementById("slipAmount").innerText =
    `${t.currency === "USD" ? "$" : "៛"}${t.amount.toLocaleString()}`;
  document.getElementById("slipRemark").innerText = t.remark || "N/A";

  const actionArea = document.getElementById("checkerActionArea");
  const existingMsg = document.getElementById("makerWarningMsg");
  if (existingMsg) existingMsg.remove();

  if (t.status.includes("pending")) {
    if (t.maker === currentAdminUser) {
      actionArea.style.display = "none";
      actionArea.insertAdjacentHTML(
        "afterend",
        `<div id="makerWarningMsg" style="color:#ef4444; font-size:0.8rem; text-align:center; font-weight:bold; margin-top:10px;"><i class="fa-solid fa-lock"></i> អ្នកមិនអាចអនុម័តប្រតិបត្តិការខ្លួនឯងបានទេ (Maker-Checker Policy)</div>`,
      );
    } else {
      actionArea.style.display = "grid";
      const btnApprove = actionArea.querySelector(".btn-primary");
      if (t.status === "pending_verify")
        btnApprove.innerHTML = "✅ ផ្ទៀងផ្ទាត់ (Verify)";
      else btnApprove.innerHTML = "✅ អនុម័ត (Approve)";
    }
  } else {
    actionArea.style.display = "none";
  }

  document.getElementById("ticketDrawer").classList.add("open");
};

// 🟢 មុខងារជំនួយសម្រាប់បម្លែង Status ពី Database ឱ្យទៅជាអក្សរស្អាតមានអនាម័យ
window.formatTicketStatus = function (status) {
  if (!status) return "UNKNOWN";
  switch (status.toLowerCase()) {
    case "pending_verify":
      return "PENDING VERIFY";
    case "pending_approve":
      return "PENDING APPROVE";
    case "verified":
      return "VERIFIED";
    case "approved":
      return "APPROVED";
    case "rejected":
      return "REJECTED";
    case "completed":
      return "COMPLETED";
    default:
      return status.toUpperCase();
  }
};

window.closeTicketDrawer = function () {
  document.getElementById("ticketDrawer").classList.remove("open");
  viewingTicketId = null;
};

window.printSlip = function () {
  const printContent = document.getElementById("printSlipArea").innerHTML;
  const originalContent = document.body.innerHTML;
  document.body.innerHTML = `<div style="padding: 20px; font-family: monospace;">${printContent}</div>`;
  window.print();
  document.body.innerHTML = originalContent;
  location.reload();
};

window.approveTicket = async function () {
  if (!viewingTicketId) return;
  Swal.fire({
    title: "យល់ព្រមប្រតិបត្តិការនេះ?",
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "បាទ/ចាស អនុម័ត",
    cancelButtonText: "បោះបង់",
    customClass: { popup: "premium-swal" },
  }).then(async (result) => {
    if (result.isConfirmed) {
      Swal.fire({
        title: "កំពុងដំណើរការ...",
        didOpen: () => Swal.showLoading(),
        customClass: { popup: "premium-swal" },
      });
      try {
        const res = await fetch("/api/admin/cashier/ticket/action", {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            ticketId: viewingTicketId,
            action: "approve",
          }),
        });
        const data = await res.json();
        if (data.success) {
          Swal.fire({
            icon: "success",
            title: "ជោគជ័យ!",
            text: "ប្រតិបត្តិការត្រូវបានអនុម័តរួចរាល់។",
            customClass: { popup: "premium-swal" },
          });
          closeTicketDrawer();
          loadCashierTickets();
        } else {
          Swal.fire({
            icon: "error",
            title: "បរាជ័យ",
            text: data.message,
            customClass: { popup: "premium-swal" },
          });
        }
      } catch (error) {
        Swal.fire({
          icon: "error",
          title: "កំហុសប្រព័ន្ធ",
          text: "មិនអាចភ្ជាប់ទៅកាន់ Server បានទេ។",
          customClass: { popup: "premium-swal" },
        });
      }
    }
  });
};
