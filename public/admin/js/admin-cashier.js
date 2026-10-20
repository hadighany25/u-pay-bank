// ============================================================================
// ឯកសារ: js/admin-cashier.js (100% Pro Clean - Cashier & Maker-Checker Engine)
// អត្ថន័យ: គ្រប់គ្រងប្រព័ន្ធបេឡាករ (Cashier System) ជាមួយលំហូរ ៣ ដំណាក់កាល
// ស្តង់ដារថ្មី: ចាប់ទិន្នន័យអតិថិជនតាម MongoDB `_id` សុទ្ធសាធ + បង្ហាញឈ្មោះពេញ (fullName)
// ============================================================================

// ============================================================================
// 🧭 ជំពូកទី ១៖ អថេរសកល, មុខងារជំនួយ និងការគ្រប់គ្រងផ្ទាំង TABS (GLOBAL STATE & TABS)
// ============================================================================
const adminNameElem = document.getElementById("adminNameDisplay");
const currentAdminUser =
  sessionStorage.getItem("adminUsername") ||
  (adminNameElem ? adminNameElem.innerText : "");

let currentTargetUser = null;
let currentDepositorUser = null;
let activeTrxType = "Deposit";
let activeDepositorType = "self";
let isUserLocked = false;
let depositorTimeout = null;
let currentPayload = null;

let tellerPersonalTickets = [];
let allTickets = [];
let filteredTickets = [];
let currentTicketPage = 1;
const TICKETS_PER_PAGE = 10;
let viewingTicketId = null;

const storageKey = `makerFilters_${currentAdminUser}`;
let selectedMakersFilter = JSON.parse(localStorage.getItem(storageKey)) || [];
let globalAdminsList = [];

/**
 * 🔹 ១.១ អនុគមន៍ទាញយកឈ្មោះពេញរបស់បុគ្គលិក Admin (Maker) តាមរយៈ username ឬ _id
 */
function getMakerFullName(makerIdentifier) {
  if (!makerIdentifier) return "មន្ត្រីបេឡាករ U-Pay";
  const clean = String(makerIdentifier).replace(/^@/, "").trim().toLowerCase();

  if (Array.isArray(globalAdminsList) && globalAdminsList.length > 0) {
    const found = globalAdminsList.find(
      (a) =>
        (a.username && a.username.toLowerCase() === clean) ||
        String(a._id || a.id) === clean ||
        (a.fullName && a.fullName.toLowerCase() === clean),
    );
    if (found && found.fullName) return found.fullName;
  }

  const sessionUser = (
    sessionStorage.getItem("adminUsername") || ""
  ).toLowerCase();
  if (clean === sessionUser) {
    return (
      sessionStorage.getItem("adminFullName") ||
      document.getElementById("adminNameDisplay")?.innerText?.trim() ||
      makerIdentifier
    );
  }
  return String(makerIdentifier).replace(/^@/, "");
}

/**
 * 🔹 ១.២ អនុគមន៍ប្តូរផ្ទាំងរវាង បញ្ជរប្រតិបត្តិការ (Teller Desk) និង ផ្ទាំងអនុម័ត (Approvals)
 */
window.switchCashierTab = function (tabName) {
  const viewTeller = document.getElementById("viewTeller");
  const viewApproval = document.getElementById("viewApproval");
  const viewApprovalDetail = document.getElementById("viewApprovalDetail");

  if (viewTeller) viewTeller.style.display = "none";
  if (viewApproval) viewApproval.style.display = "none";
  if (viewApprovalDetail) viewApprovalDetail.style.display = "none";

  const allTabs = document.querySelectorAll(".cashier-tab");
  allTabs.forEach((tab) => tab.classList.remove("active"));

  sessionStorage.setItem("activeCashierTab", tabName);

  if (tabName === "teller") {
    if (viewTeller) viewTeller.style.display = "flex";
    const tellerTabs = document.querySelectorAll(
      "#tabTeller, [onclick*=\"switchCashierTab('teller')\"]",
    );
    tellerTabs.forEach((tab) => tab.classList.add("active"));
    loadTellerDashboard();
  } else {
    if (viewApproval) viewApproval.style.display = "block";
    const approvalTabs = document.querySelectorAll(
      "#tabApproval, [onclick*=\"switchCashierTab('approval')\"]",
    );
    approvalTabs.forEach((tab) => tab.classList.add("active"));

    fetchAdminsForFilter();
    renderMakerTags();
    loadCashierTickets();
  }
};

// ============================================================================
// 🏦 ជំពូកទី ២៖ បញ្ជរប្រតិបត្តិការបេឡាករតាម `_id` (TELLER DESK OPERATIONS BY `_id`)
// ============================================================================

/**
 * 🔹 ២.១ កំណត់ប្រភេទប្រតិបត្តិការ (Deposit ឬ Withdrawal) + Aliases សម្រាប់ហៅពីទំព័រ Users
 */
window.setExternalTrxType = function (type) {
  if (isUserLocked) return;

  activeTrxType = type;
  const lblDep = document.getElementById("extLblDep");
  const lblWit = document.getElementById("extLblWit");
  const btnStep1 = document.getElementById("btnSubmitTrx");
  const formTitle = document.getElementById("formTitleText");
  const depSection = document.getElementById("depositorSection");

  if (type === "Deposit") {
    if (lblDep) {
      lblDep.style.background = "rgba(16,185,129,0.1)";
      lblDep.style.color = "#10b981";
    }
    if (lblWit) {
      lblWit.style.background = "transparent";
      lblWit.style.color = "var(--text-muted)";
    }
    if (btnStep1) btnStep1.style.background = "#10b981";
    if (formTitle) {
      formTitle.innerHTML = `<i class="fa-solid fa-file-invoice-dollar"></i> បំពេញទិន្នន័យដាក់ប្រាក់`;
    }
    if (depSection) depSection.style.display = "block";
  } else {
    if (lblWit) {
      lblWit.style.background = "rgba(239,68,68,0.1)";
      lblWit.style.color = "#ef4444";
    }
    if (lblDep) {
      lblDep.style.background = "transparent";
      lblDep.style.color = "var(--text-muted)";
    }
    if (btnStep1) btnStep1.style.background = "#ef4444";
    if (formTitle) {
      formTitle.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color:#ef4444;"></i> បំពេញទិន្នន័យដកប្រាក់`;
    }
    if (depSection) depSection.style.display = "none";
    activeDepositorType = "self";
  }
};

// 🔗 Aliases សម្រាប់ភ្ជាប់ជាមួយ `goToCashierDesk(uid, type)` ពីក្នុង `admin-users.js`
window.selectCashierType = window.setExternalTrxType;
window.setCashierMode = window.setExternalTrxType;

window.checkSearchInput = function () {
  if (isUserLocked) return;
  const val = document.getElementById("targetUserSearch")?.value.trim() || "";
  const btnCancel = document.getElementById("btnCancelSearch");
  if (btnCancel) btnCancel.style.display = val.length > 0 ? "block" : "none";
};

window.resetCashierSearch = function () {
  const searchVal =
    document.getElementById("targetUserSearch")?.value.trim() || "";
  const amountVal = document.getElementById("cashAmount")?.value.trim() || "";
  const remarkVal = document.getElementById("cashRemark")?.value.trim() || "";
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

  const dashSection = document.getElementById("tellerDashboardSection");
  if (dashSection) dashSection.style.display = "block";

  const previewBox = document.getElementById("cashierExchangePreview");
  if (previewBox) previewBox.style.display = "none";

  document.getElementById("extLblDep").style.pointerEvents = "auto";
  document.getElementById("extLblWit").style.pointerEvents = "auto";

  currentTargetUser = null;
  currentDepositorUser = null;
  document.getElementById("targetUserSearch").focus();
};

/**
 * 🔹 ២.២ ការផ្ទៀងផ្ទាត់គណនីអ្នកតំណាងដាក់ប្រាក់តាមរយៈ MongoDB `_id`
 */
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
      const res = await fetch(
        `/api/admin/cashier/search/${encodeURIComponent(val)}`,
        {
          headers: getAuthHeaders(),
        },
      );
      const data = await res.json();
      previewCard.style.display = "flex";

      if (data.success && data.user) {
        // 🎯 ប្រៀបធៀបតាម MongoDB `_id` ដើម្បីការពារកុំឱ្យអ្នកតំណាងជាម្ចាស់គណនីខ្លួនឯង!
        if (
          currentTargetUser &&
          String(data.user._id) === String(currentTargetUser._id)
        ) {
          depAvatar.style.display = "none";
          depName.innerHTML = `<span style="color:#ef4444; font-family: 'Kantumruy Pro', sans-serif;"><i class="fa-solid fa-triangle-exclamation"></i> អ្នកតំណាងមិនអាចជាម្ចាស់គណនីផ្ទាល់បានទេ!</span>`;
          depInfo.innerHTML = `<span style="font-family: 'Kantumruy Pro', sans-serif;">សូមជ្រើសរើស 'ម្ចាស់គណនីផ្ទាល់' វិញ...</span>`;
          currentDepositorUser = null;
          return;
        }

        currentDepositorUser = data.user;
        depAvatar.style.display = "block";
        depAvatar.src =
          currentDepositorUser.profileImage || "../images/default-avatar.png";
        depName.innerHTML = `<i class="fa-solid fa-circle-check" style="color:#10b981;"></i> ${currentDepositorUser.fullName || currentDepositorUser.username}`;
        depInfo.innerText = `Tel: ${currentDepositorUser.phone || "N/A"} | CARD ID: ${currentDepositorUser.idNumber || "N/A"}`;
      } else {
        depAvatar.style.display = "none";
        depName.innerHTML = `<span style="color:#ef4444; font-family: 'Kantumruy Pro', sans-serif;"><i class="fa-solid fa-circle-xmark"></i> រកមិនឃើញគណនីនេះទេ</span>`;
        depInfo.innerHTML = `<span style="font-family: 'Kantumruy Pro', sans-serif;">មិនអនុញ្ញាតឱ្យធ្វើប្រតិបត្តិការ...</span>`;
        currentDepositorUser = null;
      }
    } catch (e) {
      console.error(e);
    }
  }, 500);
};

window.viewDepositorKYC = function () {
  const kycImg =
    currentDepositorUser?.kycDocument || currentDepositorUser?.kycImage;
  if (!currentDepositorUser || !kycImg) {
    return Swal.fire({
      icon: "info",
      text: "អ្នកតំណាងនេះមិនទាន់មានរូប KYC ទេ",
      customClass: { popup: "premium-swal" },
    });
  }
  Swal.fire({
    title: `អត្តសញ្ញាណប័ណ្ណអ្នកតំណាង (${currentDepositorUser.fullName || currentDepositorUser.username})`,
    imageUrl: kycImg,
    imageWidth: 400,
    customClass: { popup: "premium-swal" },
  });
};

/**
 * 🔹 ២.៣ ស្វែងរកគណនីអតិថិជនគោលដៅតាមរយៈ MongoDB `_id`, លេខគណនី, ឬលេខទូរស័ព្ទ
 */
window.searchTargetUser = async function () {
  const searchVal = document.getElementById("targetUserSearch").value.trim();
  if (!searchVal) return;

  Swal.fire({
    title: "កំពុងស្វែងរក...",
    didOpen: () => Swal.showLoading(),
    customClass: { popup: "premium-swal" },
  });

  try {
    const res = await fetch(
      `/api/admin/cashier/search/${encodeURIComponent(searchVal)}`,
      {
        headers: getAuthHeaders(),
      },
    );
    const data = await res.json();

    if (data.success && data.user) {
      Swal.close();
      currentTargetUser = data.user;
      isUserLocked = true;

      const canonicalId = String(
        currentTargetUser._id || currentTargetUser.id || "",
      );

      document.getElementById("targetUserSearch").disabled = true;
      document.getElementById("extLblDep").style.pointerEvents = "none";
      document.getElementById("extLblWit").style.pointerEvents = "none";
      document.getElementById("targetUserCard").style.display = "block";
      document.getElementById("transactionForm").style.display = "block";

      const dashSection = document.getElementById("tellerDashboardSection");
      if (dashSection) dashSection.style.display = "none";

      document.getElementById("cardAvatar").src =
        currentTargetUser.profileImage || "../images/default-avatar.png";
      document.getElementById("cardName").textContent =
        `${currentTargetUser.fullName || currentTargetUser.username}`;
      document.getElementById("cardUserId").textContent =
        `_id : ${canonicalId.slice(-8)}`;
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

// 🔗 Aliases សម្រាប់ហៅស្វែងរកអតិថិជនស្វ័យប្រវត្តិពេលលោតមកពីទំព័រ Users (`goToCashierDesk`)
window.searchCashierCustomer = window.searchTargetUser;
window.searchUserForCashier = window.searchTargetUser;

window.viewKYC = function () {
  const kycImg = currentTargetUser?.kycDocument || currentTargetUser?.kycImage;
  if (!currentTargetUser || !kycImg) {
    return Swal.fire({
      icon: "info",
      text: "អតិថិជននេះមិនទាន់មានរូប KYC ទេ",
      customClass: { popup: "premium-swal" },
    });
  }
  Swal.fire({
    title: `អត្តសញ្ញាណប័ណ្ណ (${currentTargetUser.fullName || currentTargetUser.username})`,
    imageUrl: kycImg,
    imageWidth: 400,
    customClass: { popup: "premium-swal" },
  });
};

window.previewCashierExchange = function () {
  const targetSelectValue = document.getElementById(
    "targetAccountSelect",
  )?.value;
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

function numberToWordsUSD(amount) {
  return (
    amount.toLocaleString("en-US", { style: "currency", currency: "USD" }) +
    " ONLY"
  );
}
function numberToWordsKHR(amount) {
  return amount.toLocaleString() + " RIELS ONLY";
}

/**
 * 🔹 ២.៤ ពិនិត្យផ្ទៀងផ្ទាត់វិក្កយបត្រ និងបញ្ជូនប្រតិបត្តិការដោយភ្ជាប់ MongoDB `_id` របស់អតិថិជនផ្ទាល់!
 */
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

  let currentBal = 0;
  let targetCurrency = "USD";

  if (currentTargetUser.mainAccounts?.USD?.accountNumber === targetAccount) {
    currentBal = Number(currentTargetUser.mainAccounts.USD.balance) || 0;
    targetCurrency = "USD";
  } else if (
    currentTargetUser.mainAccounts?.KHR?.accountNumber === targetAccount
  ) {
    currentBal = Number(currentTargetUser.mainAccounts.KHR.balance) || 0;
    targetCurrency = "KHR";
  } else if (
    currentTargetUser.subAccounts &&
    currentTargetUser.subAccounts.length > 0
  ) {
    const sub = currentTargetUser.subAccounts.find(
      (s) => s.accountNumber === targetAccount,
    );
    if (sub) {
      currentBal = Number(sub.balance) || 0;
      targetCurrency = sub.currency;
    }
  }

  if (activeTrxType === "Withdrawal") {
    let finalWithdrawAmount = amount;
    if (currency === "USD" && targetCurrency === "KHR") {
      finalWithdrawAmount =
        amount * (window.currentFXRates?.usdToKhrBuy || 4050);
    } else if (currency === "KHR" && targetCurrency === "USD") {
      finalWithdrawAmount =
        amount / (window.currentFXRates?.usdToKhrSell || 4100);
    }

    if (currentBal < finalWithdrawAmount) {
      return Swal.fire({
        icon: "error",
        title: "បរាជ័យ!",
        html: `សមតុល្យមិនគ្រប់គ្រាន់ទេ!<br>មានត្រឹមតែ៖ <b>${targetCurrency === "USD" ? "$" : "៛"}${currentBal.toLocaleString("en-US", { minimumFractionDigits: targetCurrency === "USD" ? 2 : 0 })}</b>`,
        customClass: { popup: "premium-swal" },
      });
    }
  }

  let finalDepositorName = "";
  let finalDepositorAccount = "";

  if (activeTrxType === "Deposit" && activeDepositorType === "other") {
    if (!currentDepositorUser)
      return Swal.fire({
        icon: "warning",
        text: "សូមស្វែងរកគណនីអ្នកតំណាងឱ្យបានត្រឹមត្រូវ!",
        customClass: { popup: "premium-swal" },
      });
    finalDepositorName =
      currentDepositorUser.fullName || currentDepositorUser.username;
    finalDepositorAccount =
      currentDepositorUser.mainAccounts?.USD?.accountNumber ||
      currentDepositorUser.mainAccounts?.KHR?.accountNumber ||
      "N/A";
  } else {
    finalDepositorName =
      currentTargetUser.fullName || currentTargetUser.username;
    finalDepositorAccount =
      currentTargetUser.mainAccounts?.USD?.accountNumber ||
      currentTargetUser.mainAccounts?.KHR?.accountNumber ||
      "N/A";
  }

  const canonicalTargetId = String(
    currentTargetUser._id || currentTargetUser.id || "",
  );

  // 🎯 បញ្ជូនទាំង `_id` (`targetUserId`) និង `targetUsername` ទៅឱ្យ Backend
  currentPayload = {
    _id: canonicalTargetId,
    targetUserId: canonicalTargetId,
    targetUsername: currentTargetUser.username,
    targetAccount: targetAccount,
    requestType: activeTrxType,
    depositorName: finalDepositorName,
    depositorAccount: finalDepositorAccount,
    currency: currency,
    amount: amount,
    remark: remark,
  };

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
  document.getElementById("inlineSlipMaker").innerText =
    getMakerFullName(currentAdminUser);
  document.getElementById("inlineSlipCustomer").innerText =
    currentTargetUser.fullName || currentTargetUser.username;
  document.getElementById("inlineSlipAccount").innerText = targetAccount;
  document.getElementById("inlineSlipDepositor").innerText = finalDepositorName;

  document.getElementById("inlineSlipAmount").innerText =
    `${curSymbol}${amount.toLocaleString("en-US", {
      minimumFractionDigits: currency === "USD" ? 2 : 0,
      maximumFractionDigits: currency === "USD" ? 2 : 0,
    })}`;

  document.getElementById("inlineSlipAmountWords").innerText =
    currency === "USD" ? numberToWordsUSD(amount) : numberToWordsKHR(amount);

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

window.backToInputForm = function () {
  document.getElementById("step2_PreviewForm").style.display = "none";
  document.getElementById("step1_InputForm").style.display = "block";
};

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

      const titleText = document.getElementById("previewTitleText");
      if (titleText) {
        titleText.innerHTML = `<i class="fa-solid fa-circle-check" style="color: #10b981;"></i> ប្រតិបត្តិការជោគជ័យ`;
      }

      const dbStatus = data.ticket?.status || "pending_verify";
      const formattedStatus = formatTicketStatus(dbStatus);

      const statusElem = document.getElementById("inlineSlipStatus");
      if (statusElem) {
        statusElem.innerText = formattedStatus;
        statusElem.style.color = dbStatus.includes("pending")
          ? "#d97706"
          : "#10b981";
      }

      const realTrxId =
        data.ticket?.transactionId ||
        data.transactionId ||
        data.ticket?.ticketId ||
        null;

      if (realTrxId) {
        const refElem = document.getElementById("inlineSlipRef");
        const boxElem = document.getElementById("inlineSlipTrxBox");
        const qrElem = document.getElementById("inlineSlipQRCode");

        if (refElem) refElem.innerText = realTrxId;
        if (boxElem) boxElem.style.display = "block";
        if (qrElem)
          qrElem.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://u-pay-bank.fly.dev/receipt/${realTrxId}`;
      }

      const previewBtns = document.getElementById("previewActionBtns");
      const successBtns = document.getElementById("successActionBtns");
      if (previewBtns) previewBtns.style.display = "none";
      if (successBtns) successBtns.style.display = "grid";
    } else {
      Swal.fire({
        icon: "error",
        title: "បរាជ័យ",
        text: data.message || "ប្រតិបត្តិការបរាជ័យ",
        customClass: { popup: "premium-swal" },
      });
    }
  } catch (error) {
    console.error("Submit Error:", error);
    Swal.fire({
      icon: "error",
      title: "កំហុស",
      text: "បញ្ហាភ្ជាប់ទៅ Server! សូមព្យាយាមម្តងទៀត។",
      customClass: { popup: "premium-swal" },
    });
  }
};

window.formatCurrencyInput = function (input) {
  let value = input.value.replace(/[^0-9.]/g, "");
  const parts = value.split(".");
  if (parts.length > 2) {
    value = parts[0] + "." + parts.slice(1).join("");
  }
  if (parts[0]) {
    parts[0] = parseInt(parts[0], 10).toLocaleString("en-US");
  }
  input.value = parts.join(".");
};

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

// ============================================================================
// 📊 ជំពូកទី ៣៖ ស្ថិតិបញ្ជរបេឡាករ និងប្រវត្តិផ្ទាល់ខ្លួនតាម `_id` (TELLER MINI DASHBOARD BY `_id`)
// ============================================================================

window.loadTellerDashboard = async function () {
  try {
    if (
      typeof globalAdminsList === "undefined" ||
      globalAdminsList.length === 0
    ) {
      try {
        const adminRes = await fetch("/api/admin/list-admins", {
          headers: getAuthHeaders(),
        });
        const adminData = await adminRes.json();
        if (adminData.success) {
          globalAdminsList = adminData.admins;
        }
      } catch (e) {}
    }

    const res = await fetch("/api/admin/cashier/tickets", {
      headers: getAuthHeaders(),
    });
    const data = await res.json();

    if (data.success) {
      const sessionStaffId = sessionStorage.getItem("adminStaffId");
      let targetUsername = (
        sessionStorage.getItem("adminUsername") || ""
      ).toLowerCase();
      let targetFullName = (
        sessionStorage.getItem("adminFullName") ||
        document.getElementById("adminNameDisplay")?.innerText ||
        ""
      )
        .trim()
        .toLowerCase();

      if (
        sessionStaffId &&
        typeof globalAdminsList !== "undefined" &&
        globalAdminsList.length > 0
      ) {
        const loggedInAdmin = globalAdminsList.find(
          (a) => a.staffId === sessionStaffId,
        );
        if (loggedInAdmin) {
          targetUsername = (loggedInAdmin.username || "").toLowerCase();
          targetFullName = (loggedInAdmin.fullName || "").trim().toLowerCase();
        }
      }

      tellerPersonalTickets = data.tickets.filter((t) => {
        if (!t.maker) return false;
        const makerDB = t.maker.trim().toLowerCase();
        return (
          (targetUsername !== "" && makerDB === targetUsername) ||
          (targetFullName !== "" && makerDB === targetFullName)
        );
      });

      filterTellerPersonalTickets();
    }
  } catch (error) {
    console.error("Error loading teller dashboard:", error);
    const tbody = document.getElementById("tellerPersonalTicketsBody");
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #ef4444;">កំហុសក្នុងការទាញយកទិន្នន័យ</td></tr>`;
    }
  }
};

function renderTellerDashboardStats(items = tellerPersonalTickets) {
  let depCount = 0,
    depAmountUSD = 0,
    depAmountKHR = 0;
  let witCount = 0,
    witAmountUSD = 0,
    witAmountKHR = 0;
  let appCount = 0,
    penCount = 0,
    rejCount = 0;

  items.forEach((t) => {
    if (
      t.status === "approved" ||
      t.status === "verified" ||
      t.status === "completed"
    )
      appCount++;
    else if (t.status.includes("pending")) penCount++;
    else if (t.status === "rejected") rejCount++;

    if (t.status !== "rejected") {
      if (t.requestType === "Deposit") {
        depCount++;
        if (t.currency === "USD") depAmountUSD += t.amount;
        if (t.currency === "KHR") depAmountKHR += t.amount;
      } else if (t.requestType === "Withdrawal") {
        witCount++;
        if (t.currency === "USD") witAmountUSD += t.amount;
        if (t.currency === "KHR") witAmountKHR += t.amount;
      }
    }
  });

  document.getElementById("dashTellerDepCount").innerText = `${depCount} បុង`;
  let depText = `$${depAmountUSD.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
  if (depAmountKHR > 0) depText += ` / ៛${depAmountKHR.toLocaleString()}`;
  document.getElementById("dashTellerDepAmount").innerText = depText;

  document.getElementById("dashTellerWitCount").innerText = `${witCount} បុង`;
  let witText = `$${witAmountUSD.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
  if (witAmountKHR > 0) witText += ` / ៛${witAmountKHR.toLocaleString()}`;
  document.getElementById("dashTellerWitAmount").innerText = witText;

  document.getElementById("dashTellerAppCount").innerText = appCount;
  document.getElementById("dashTellerPenCount").innerText = penCount;
  document.getElementById("dashTellerRejCount").innerText = rejCount;
}

/**
 * 🔹 ៣.២ បើកមើលវិក្កយបត្រចាស់របស់បេឡាករ និងទាញព័ត៌មានអតិថិជនតាមរយៈ `t.userId` (`_id`) ជាអាទិភាពទី ១!
 */
window.openTellerPreviewSlip = async function (id) {
  const t = tellerPersonalTickets.find((x) => x._id === id);
  if (!t) return;

  const isDeposit = t.requestType.toLowerCase() === "deposit";
  const curSymbol = t.currency === "USD" ? "$" : "៛";
  const displayRefId =
    t.transactionId || t.ticketId || t._id.substring(0, 10).toUpperCase();

  const dashSection = document.getElementById("tellerDashboardSection");
  if (dashSection) dashSection.style.display = "none";

  const targetCard = document.getElementById("targetUserCard");
  const trxForm = document.getElementById("transactionForm");
  if (targetCard) targetCard.style.display = "block";
  if (trxForm) trxForm.style.display = "block";

  const step1 = document.getElementById("step1_InputForm");
  const step2 = document.getElementById("step2_PreviewForm");
  if (step1) step1.style.display = "none";
  if (step2) step2.style.display = "block";

  // 🎯 ទាញយកទិន្នន័យអតិថិជនតាមរយៈ `t.userId` (MongoDB `_id`) មុនគេបង្អស់!
  const lookupKey = t.userId || t.targetAcc;
  try {
    const userRes = await fetch(
      `/api/admin/cashier/search/${encodeURIComponent(lookupKey)}`,
      {
        headers: getAuthHeaders(),
      },
    );
    const userData = await userRes.json();

    if (userData.success && userData.user) {
      currentTargetUser = userData.user;
      const u = userData.user;
      const canonicalId = String(u._id || u.id || "");

      document.getElementById("cardAvatar").src =
        u.profileImage || "../images/default-avatar.png";
      document.getElementById("cardName").textContent =
        `${u.fullName || u.username}`;
      document.getElementById("cardUserId").textContent =
        `_id : ${canonicalId.slice(-8)}`;
      document.getElementById("cardUIdNum").textContent =
        `CARD ID : ${u.idNumber || "N/A"}`;
      document.getElementById("cardPhone").textContent = u.phone || "N/A";
      document.getElementById("cardEmail").textContent = u.email || "N/A";

      const balancesContainer = document.getElementById(
        "cardBalancesContainer",
      );
      let balancesHtml = "";
      const usdBal = u.mainAccounts?.USD?.balance || 0;
      const usdAccNum = u.mainAccounts?.USD?.accountNumber;
      if (usdAccNum) {
        balancesHtml += `<div style="background: var(--bg-card); padding: 12px 16px; border-radius: 12px; border: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;"><div><div style="display: flex; align-items: center; gap: 8px;"><div style="width: 8px; height: 8px; background: #0ea5e9; border-radius: 50%;"></div><span style="color: var(--text-main); font-weight: bold; font-size: 0.9rem;">Main USD</span></div><div style="font-size: 0.7rem; color: var(--text-muted); font-family: monospace; margin-left: 16px;">${usdAccNum}</div></div><span style="font-family: monospace; font-weight: bold; font-size: 1.05rem; color: #0ea5e9;">$${usdBal.toFixed(2)}</span></div>`;
      }
      const khrBal = u.mainAccounts?.KHR?.balance || 0;
      const khrAccNum = u.mainAccounts?.KHR?.accountNumber;
      if (khrAccNum) {
        balancesHtml += `<div style="background: var(--bg-card); padding: 12px 16px; border-radius: 12px; border: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;"><div><div style="display: flex; align-items: center; gap: 8px;"><div style="width: 8px; height: 8px; background: #10b981; border-radius: 50%;"></div><span style="color: var(--text-main); font-weight: bold; font-size: 0.9rem;">Main KHR</span></div><div style="font-size: 0.7rem; color: var(--text-muted); font-family: monospace; margin-left: 16px;">${khrAccNum}</div></div><span style="font-family: monospace; font-weight: bold; font-size: 1.05rem; color: #10b981;">៛${khrBal.toLocaleString()}</span></div>`;
      }
      if (u.subAccounts && u.subAccounts.length > 0) {
        u.subAccounts.forEach((sub) => {
          const subColor = sub.currency === "USD" ? "#3b82f6" : "#059669";
          balancesHtml += `<div style="background: var(--bg-card); padding: 12px 16px; border-radius: 12px; border: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;"><div><div style="display: flex; align-items: center; gap: 8px;"><div style="width: 8px; height: 8px; background: ${subColor}; border-radius: 50%;"></div><span style="color: var(--text-main); font-weight: bold; font-size: 0.9rem;">${sub.accountName} (${sub.currency})</span></div><div style="font-size: 0.7rem; color: var(--text-muted); font-family: monospace; margin-left: 16px;">${sub.accountNumber}</div></div><span style="font-family: monospace; font-weight: bold; font-size: 1.05rem; color: ${subColor};">${sub.currency === "USD" ? "$" : "៛"}${sub.balance.toLocaleString()}</span></div>`;
        });
      }
      balancesContainer.innerHTML = balancesHtml;

      const kycStat = (u.kycStatus || "unverified").toUpperCase();
      const kycBadge = document.getElementById("cardKycBadge");
      if (kycBadge) {
        kycBadge.textContent = `KYC: ${kycStat}`;
        kycBadge.style.background =
          kycStat === "VERIFIED" || kycStat === "APPROVED"
            ? "rgba(16, 185, 129, 0.1)"
            : "rgba(245, 158, 11, 0.1)";
        kycBadge.style.color =
          kycStat === "VERIFIED" || kycStat === "APPROVED"
            ? "#10b981"
            : "#f59e0b";
      }

      const isFrozen = u.isFrozen;
      const statusBadge = document.getElementById("cardStatusBadge");
      if (statusBadge) {
        statusBadge.textContent = isFrozen ? "FROZEN" : "ACTIVE";
        statusBadge.style.background = isFrozen
          ? "rgba(239, 68, 68, 0.1)"
          : "rgba(16, 185, 129, 0.1)";
        statusBadge.style.color = isFrozen ? "#ef4444" : "#10b981";
      }
    }
  } catch (err) {
    console.error("Error fetching target user data for slip:", err);
  }

  const titleText = document.getElementById("previewTitleText");
  if (titleText) {
    if (t.status === "rejected") {
      titleText.innerHTML = `<i class="fa-solid fa-circle-xmark" style="color: #ef4444;"></i> ប្រតិបត្តិការត្រូវបានបដិសេធ`;
    } else if (t.status.includes("pending")) {
      titleText.innerHTML = `<i class="fa-solid fa-clock" style="color: #f59e0b;"></i> រង់ចាំការអនុម័ត`;
    } else {
      titleText.innerHTML = `<i class="fa-solid fa-circle-check" style="color: #10b981;"></i> ប្រតិបត្តិការជោគជ័យ`;
    }
  }

  const slipTypeElem = document.getElementById("inlineSlipType");
  if (slipTypeElem) {
    slipTypeElem.innerText = `ប័ណ្ណ${isDeposit ? "ដាក់" : "ដក"}ប្រាក់ / CASH ${t.requestType.toUpperCase()}`;
    slipTypeElem.style.color = isDeposit ? "#10b981" : "#ef4444";
  }

  document.getElementById("inlineSlipTrxBox").style.display = "block";
  document.getElementById("inlineSlipRef").innerText = displayRefId;
  document.getElementById("inlineSlipDate").innerText = new Date(
    t.createdAt,
  ).toLocaleString();
  document.getElementById("inlineSlipCustomer").innerText =
    t.slipData?.customerName || "Unknown";
  document.getElementById("inlineSlipAccount").innerText = t.targetAcc;

  const amountElem = document.getElementById("inlineSlipAmount");
  if (amountElem) {
    amountElem.innerText = `${curSymbol}${t.amount.toLocaleString("en-US", { minimumFractionDigits: t.currency === "USD" ? 2 : 0 })}`;
    amountElem.style.color = isDeposit ? "#10b981" : "#ef4444";
  }

  document.getElementById("inlineSlipAmountWords").innerText =
    t.currency === "USD"
      ? numberToWordsUSD(t.amount)
      : numberToWordsKHR(t.amount);

  document.getElementById("inlineSlipOldBal").innerText =
    `${curSymbol}${(t.slipData?.priorBalance || 0).toLocaleString("en-US", { minimumFractionDigits: t.currency === "USD" ? 2 : 0 })}`;
  document.getElementById("inlineSlipNewBal").innerText =
    `${curSymbol}${(t.slipData?.newBalance || 0).toLocaleString("en-US", { minimumFractionDigits: t.currency === "USD" ? 2 : 0 })}`;

  const depLabelElem = document.getElementById("inlineSlipDepositorLabel");
  const sigLabelElem = document.getElementById("sigLabelDepositor");
  if (depLabelElem)
    depLabelElem.innerText = isDeposit
      ? "អ្នកដាក់ប្រាក់ / Deposited By:"
      : "អ្នកដកប្រាក់ / Withdrawn By:";
  if (sigLabelElem)
    sigLabelElem.innerHTML = isDeposit
      ? "អ្នកដាក់ប្រាក់<br>DEPOSITOR"
      : "អ្នកដកប្រាក់<br>WITHDRAWER";

  document.getElementById("inlineSlipDepositor").innerText =
    t.depositorName || t.slipData?.customerName || "Unknown";

  const autoRemark = isDeposit
    ? `ដាក់ប្រាក់ដោយ: ${t.depositorName || "Unknown"} (${t.slipData?.depositorAccount || "N/A"})`
    : `ដកប្រាក់ដោយ: ${t.depositorName || "Unknown"} (${t.slipData?.depositorAccount || "N/A"})`;
  let finalRemark = t.remark || "";
  if (
    !finalRemark.includes("ដាក់ប្រាក់ដោយ:") &&
    !finalRemark.includes("ដកប្រាក់ដោយ:")
  ) {
    finalRemark =
      finalRemark.trim() !== ""
        ? `${finalRemark.trim()} | ${autoRemark}`
        : autoRemark;
  }
  document.getElementById("inlineSlipRemark").innerText = finalRemark;
  document.getElementById("inlineSlipMaker").innerText = getMakerFullName(
    t.maker,
  );

  const statusElem = document.getElementById("inlineSlipStatus");
  if (statusElem) {
    statusElem.innerText = formatTicketStatus(t.status);
    statusElem.style.color = t.status.includes("pending")
      ? "#d97706"
      : t.status === "rejected"
        ? "#ef4444"
        : "#10b981";
  }

  const qrElem = document.getElementById("inlineSlipQRCode");
  if (qrElem)
    qrElem.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://u-pay-bank.fly.dev/receipt/${displayRefId}`;

  document.getElementById("inlineSlipWarning").style.display = "none";
  document.getElementById("previewActionBtns").style.display = "none";

  const successBtns = document.getElementById("successActionBtns");
  if (successBtns) successBtns.style.display = "grid";
};

function setDefaultDatesIfNeeded() {
  const startInput = document.getElementById("tellerStartDate");
  const endInput = document.getElementById("tellerEndDate");

  if (startInput && !startInput.value && endInput && !endInput.value) {
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
    );
    const todayEnd = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
    );

    const formatDateInput = (d) => {
      const pad = (n) => (n < 10 ? "0" + n : n);
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    startInput.value = formatDateInput(todayStart);
    endInput.value = formatDateInput(todayEnd);
  }
}

window.filterTellerPersonalTickets = function () {
  setDefaultDatesIfNeeded();

  const term =
    document.getElementById("searchTellerTicket")?.value.toLowerCase() || "";
  const startDateVal = document.getElementById("tellerStartDate")?.value;
  const endDateVal = document.getElementById("tellerEndDate")?.value;
  const statusF = document.getElementById("tellerTicketStatus")?.value || "ALL";

  const startTimestamp = startDateVal ? new Date(startDateVal).getTime() : null;
  const endTimestamp = endDateVal ? new Date(endDateVal).getTime() : null;

  const filtered = tellerPersonalTickets.filter((t) => {
    let matchTerm = true;
    if (term) {
      matchTerm =
        (t.transactionId && t.transactionId.toLowerCase().includes(term)) ||
        (t._id && t._id.toLowerCase().includes(term)) ||
        (t.userId && String(t.userId).toLowerCase().includes(term)) ||
        (t.targetAcc && t.targetAcc.toLowerCase().includes(term)) ||
        (t.depositorName && t.depositorName.toLowerCase().includes(term)) ||
        (t.slipData &&
          t.slipData.customerName &&
          t.slipData.customerName.toLowerCase().includes(term));
    }

    let matchDate = true;
    if (t.createdAt) {
      const tTime = new Date(t.createdAt).getTime();
      if (startTimestamp && tTime < startTimestamp) matchDate = false;
      if (endTimestamp && tTime > endTimestamp) matchDate = false;
    }

    let matchStatus = true;
    if (statusF !== "ALL") {
      if (statusF === "pending") {
        matchStatus = t.status.includes("pending");
      } else if (statusF === "completed") {
        matchStatus =
          t.status === "approved" ||
          t.status === "verified" ||
          t.status === "completed";
      } else if (statusF === "rejected") {
        matchStatus = t.status === "rejected";
      }
    }

    return matchTerm && matchDate && matchStatus;
  });

  renderTellerDashboardStats(filtered);
  renderFilteredTellerTickets(filtered);
};

function renderFilteredTellerTickets(items) {
  const tbody = document.getElementById("tellerPersonalTicketsBody");
  if (!tbody) return;

  const countNumElem = document.getElementById("tellerTotalCountNum");
  if (countNumElem) {
    countNumElem.innerText = items.length;
  }

  if (items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px; color: var(--text-muted); font-family: 'Kantumruy Pro', sans-serif;">មិនមានទិន្នន័យស្វែងរកឃើញទេ</td></tr>`;
    return;
  }

  let html = "";
  const displayItems = items.slice(0, 50);

  displayItems.forEach((t) => {
    const date = new Date(t.createdAt).toLocaleString();
    const typeColor = t.requestType === "Deposit" ? "#10b981" : "#ef4444";
    let statusBadge = "";

    if (
      t.status === "pending_approve" ||
      t.status === "pending_verify" ||
      t.status.includes("pending")
    )
      statusBadge = `<span style="color:#d97706; font-weight:bold; font-size:0.8rem;">PENDING</span>`;
    else if (
      t.status === "approved" ||
      t.status === "verified" ||
      t.status === "completed"
    )
      statusBadge = `<span style="color:#10b981; font-weight:bold; font-size:0.8rem;">COMPLETED</span>`;
    else
      statusBadge = `<span style="color:#ef4444; font-weight:bold; font-size:0.8rem;">REJECTED</span>`;

    let displayRefId =
      t.transactionId || t.ticketId || t._id.substring(0, 10).toUpperCase();

    html += `
      <tr style="cursor: pointer; transition: 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'" onclick="openTellerPreviewSlip('${t._id}')">
        <td style="font-size: 0.8rem; color: var(--text-muted);">${date}</td>
        <td style="font-family: monospace; font-weight: bold; color: var(--text-main); font-size: 0.85rem;">${displayRefId}</td>
        <td style="color: ${typeColor}; font-weight: bold; font-size: 0.85rem;">${t.requestType}</td>
        <td style="font-family: monospace; font-size: 0.85rem;">${t.targetAcc}</td>
        <td style="font-weight: bold; font-size: 0.9rem;">${t.currency === "USD" ? "$" : "៛"}${t.amount.toLocaleString()}</td>
        <td>${statusBadge}</td>
      </tr>`;
  });

  tbody.innerHTML = html;
}

window.checkTellerSearchInput = function () {
  const val = document.getElementById("searchTellerTicket")?.value.trim() || "";
  const btnClear = document.getElementById("btnClearTellerSearch");
  if (btnClear) {
    btnClear.style.display = val.length > 0 ? "block" : "none";
  }
};

window.resetTellerSearch = function () {
  const input = document.getElementById("searchTellerTicket");
  if (input) {
    input.value = "";
    checkTellerSearchInput();
    filterTellerPersonalTickets();
    input.focus();
  }
};

function startAutoRefresh() {
  setInterval(async () => {
    const cashierSec = document.getElementById("sec-cashier");
    if (!cashierSec || cashierSec.style.display === "none") return;

    try {
      const res = await fetch("/api/admin/cashier/tickets", {
        headers: getAuthHeaders(),
      });
      const data = await res.json();

      if (data.success) {
        const activeTab =
          sessionStorage.getItem("activeCashierTab") || "teller";

        if (activeTab === "teller") {
          const actualLoggedInUser = (
            sessionStorage.getItem("adminUsername") || ""
          )
            .trim()
            .toLowerCase();
          const sessionStaffId = sessionStorage.getItem("adminStaffId");
          const uiName = (
            document.getElementById("adminNameDisplay")?.innerText || ""
          )
            .trim()
            .toLowerCase();

          let targetUsername = actualLoggedInUser;
          if (
            sessionStaffId &&
            typeof globalAdminsList !== "undefined" &&
            globalAdminsList.length > 0
          ) {
            const foundAdmin = globalAdminsList.find(
              (a) => a.staffId === sessionStaffId,
            );
            if (foundAdmin && foundAdmin.username)
              targetUsername = foundAdmin.username.toLowerCase();
          }

          tellerPersonalTickets = data.tickets.filter((t) => {
            if (!t.maker) return false;
            const makerDB = t.maker.trim().toLowerCase();
            return makerDB === targetUsername || makerDB === uiName;
          });

          filterTellerPersonalTickets();
        } else {
          allTickets = data.tickets;
          filterTickets();
        }
      }
    } catch (error) {
      console.error("Auto-refresh background error:", error);
    }
  }, 5000);
}

// ============================================================================
// ✅ ជំពូកទី ៤៖ ការត្រួតពិនិត្យ និងអនុម័តសំបុត្របេឡាករតាម `_id` (CHECKER APPROVALS BY `_id` & `fullName`)
// ============================================================================

async function fetchAdminsForFilter() {
  try {
    const res = await fetch("/api/admin/list-admins", {
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (data.success) {
      globalAdminsList = data.admins;
    }
  } catch (e) {
    console.log("Error fetching admins list", e);
  }
}

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
  const term =
    document.getElementById("searchTicket")?.value.toLowerCase() || "";
  const dateF = document.getElementById("ticketDate")?.value || "";
  const statusF = document.getElementById("ticketStatus")?.value || "ALL";

  filteredTickets = allTickets.filter((t) => {
    let matchTerm = true;
    if (term) {
      matchTerm =
        (t.transactionId && t.transactionId.toLowerCase().includes(term)) ||
        (t._id && t._id.toLowerCase().includes(term)) ||
        (t.userId && String(t.userId).toLowerCase().includes(term)) ||
        (t.targetAcc && t.targetAcc.toLowerCase().includes(term)) ||
        (t.depositorName && t.depositorName.toLowerCase().includes(term)) ||
        (t.slipData &&
          t.slipData.customerName &&
          t.slipData.customerName.toLowerCase().includes(term));
    }

    let matchDate = true;
    if (dateF) matchDate = t.createdAt && t.createdAt.startsWith(dateF);

    let matchStatus = true;
    if (statusF !== "ALL") matchStatus = t.status === statusF;

    let matchMaker = true;
    if (selectedMakersFilter.length > 0) {
      const ticketMaker = t.maker ? t.maker.toLowerCase() : "";
      matchMaker = selectedMakersFilter.some((m) => m.username === ticketMaker);
    }

    return matchTerm && matchDate && matchStatus && matchMaker;
  });

  currentTicketPage = 1;
  renderCashierTickets();
};

window.addMakerFilterFromInput = function () {
  const input = document.getElementById("addMakerInput");
  let val = input.value.trim().replace("@", "").toLowerCase();

  if (!val) return;
  if (globalAdminsList.length === 0)
    return Swal.fire({
      icon: "info",
      text: "កំពុងទាញយកទិន្នន័យ Admin, សូមរង់ចាំបន្តិច!",
      customClass: { popup: "premium-swal" },
    });

  const foundAdmin = globalAdminsList.find(
    (a) =>
      String(a._id || a.id).toLowerCase() === val ||
      (a.username && a.username.toLowerCase() === val) ||
      (a.staffId && a.staffId.toLowerCase() === val) ||
      (a.fullName && a.fullName.toLowerCase() === val),
  );

  if (foundAdmin) {
    const loggedInUser = (
      sessionStorage.getItem("adminUsername") || ""
    ).toLowerCase();
    const loggedInName = (
      document.getElementById("adminNameDisplay")?.innerText || ""
    )
      .trim()
      .toLowerCase();

    const targetUser = (foundAdmin.username || "").toLowerCase();
    const targetName = (foundAdmin.fullName || "").toLowerCase();

    if (
      (loggedInUser && targetUser === loggedInUser) ||
      (loggedInName && targetName === loggedInName) ||
      (loggedInName && targetUser === loggedInName)
    ) {
      input.value = "";
      return Swal.fire({
        icon: "warning",
        title: "បម្រាម Maker-Checker",
        text: "អ្នកមិនអាចត្រួតពិនិត្យ (Approve) ប្រតិបត្តិការខ្លួនឯងបានទេ ដូច្នេះមិនអាចបន្ថែមឈ្មោះខ្លួនឯងចូលតម្រងឡើយ!",
        customClass: { popup: "premium-swal" },
      });
    }

    const alreadyAdded = selectedMakersFilter.some(
      (m) => m.username === foundAdmin.username,
    );
    if (!alreadyAdded) {
      selectedMakersFilter.push({
        _id: String(foundAdmin._id || foundAdmin.id || ""),
        username: foundAdmin.username,
        fullName: foundAdmin.fullName || foundAdmin.username,
        staffId: foundAdmin.staffId || "N/A",
      });
      localStorage.setItem(storageKey, JSON.stringify(selectedMakersFilter));

      renderMakerTags();
      filterTickets();
    } else {
      Swal.fire({
        icon: "warning",
        text: "បុគ្គលិកនេះមានក្នុងបញ្ជីតម្រងរួចហើយ!",
        toast: true,
        position: "top-end",
        timer: 2000,
        showConfirmButton: false,
      });
    }
  } else {
    Swal.fire({
      icon: "error",
      title: "រកមិនឃើញ",
      text: `មិនមានបុគ្គលិកដែលមានទិន្នន័យ "${input.value}" ទេ!`,
      customClass: { popup: "premium-swal" },
    });
  }
  input.value = "";
};

window.removeMakerFilter = function (usernameToRemove, fullName) {
  Swal.fire({
    title: "ដកចេញពីបញ្ជី?",
    html: `តើអ្នកពិតជាចង់ដក <b>${fullName}</b> ចេញពីតម្រងមែនទេ?`,
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#ef4444",
    cancelButtonColor: "#64748b",
    confirmButtonText: "បាទ/ចាស, ដកចេញ",
    cancelButtonText: "បោះបង់",
    customClass: { popup: "premium-swal" },
  }).then((result) => {
    if (result.isConfirmed) {
      selectedMakersFilter = selectedMakersFilter.filter(
        (m) => m.username !== usernameToRemove,
      );
      localStorage.setItem(storageKey, JSON.stringify(selectedMakersFilter));
      renderMakerTags();
      filterTickets();
    }
  });
};

window.renderMakerTags = function () {
  const container = document.getElementById("makerTagsContainer");
  if (!container) return;

  if (selectedMakersFilter.length === 0) {
    container.innerHTML = `<span style="font-size: 0.8rem; color: var(--text-muted);">កំពុងបង្ហាញប្រតិបត្តិការរបស់បេឡាករទាំងអស់ (All Makers)</span>`;
    return;
  }

  let html = "";
  selectedMakersFilter.forEach((m) => {
    html += `
      <div style="background: var(--secondary); color: white; padding: 6px 12px; border-radius: 8px; display: flex; align-items: center; gap: 12px; box-shadow: 0 2px 5px rgba(16,185,129,0.2); border: 1px solid rgba(255,255,255,0.2);">
        <div style="display: flex; flex-direction: column; line-height: 1.2;">
          <span style="font-weight: bold; font-size: 0.85rem;">${m.fullName}</span>
          <span style="font-size: 0.65rem; color: rgba(255,255,255,0.8); font-family: 'JetBrains Mono', monospace;">ID: ${m.staffId}</span>
        </div>
        <div style="height: 100%; border-left: 1px solid rgba(255,255,255,0.3); padding-left: 10px; display: flex; align-items: center;">
          <button onclick="removeMakerFilter('${m.username}', '${m.fullName}')" title="លុបតម្រងនេះ" style="background: none; border: none; color: white; cursor: pointer; padding: 0; display: flex; align-items: center; justify-content: center;">
            <i class="fa-solid fa-xmark" style="font-size: 1rem; opacity: 0.7; transition: 0.2s;" onmouseover="this.style.opacity='1'; this.style.transform='scale(1.2)'" onmouseout="this.style.opacity='0.7'; this.style.transform='scale(1)'"></i>
          </button>
        </div>
      </div>
    `;
  });
  container.innerHTML = html;
};

function renderCashierTickets() {
  const tbody = document.getElementById("ticketsTableBody");
  if (!tbody) return;

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

    let displayRefId =
      t.transactionId || t.ticketId || t._id.substring(0, 10).toUpperCase();
    const makerFullName = getMakerFullName(t.maker);

    html += `
      <tr style="cursor: pointer; transition: 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'" onclick="openTicketDrawer('${t._id}')">
        <td style="font-size: 0.85rem; color: var(--text-muted);">${date}</td>
        <td style="font-family: monospace; font-weight: bold; color: var(--text-main);">${displayRefId}</td>
        <td style="color: ${typeColor}; font-weight: bold;">${t.requestType}</td>
        <td style="font-family: monospace;">${t.targetAcc}</td>
        <td style="font-weight: bold;">${t.currency === "USD" ? "$" : "៛"}${t.amount.toLocaleString()}</td>
        <td style="font-weight: 700;">${makerFullName}</td>
        <td>${statusBadge}</td>
        <td style="text-align: right;">
          <button class="btn-action" style="color: #3b82f6; background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.2); padding: 8px 12px; border-radius: 8px; cursor: pointer; transition: 0.2s;" onmouseover="this.style.background='rgba(59, 130, 246, 0.2)'" onmouseout="this.style.background='rgba(59, 130, 246, 0.1)'">
            <i class="fa-solid fa-eye"></i>
          </button>
        </td>
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

window.backToApprovalTable = function () {
  document.getElementById("viewApprovalDetail").style.display = "none";
  document.getElementById("viewApproval").style.display = "block";
};

/**
 * 🔹 ៤.៤ បើកផ្ទាំងពិនិត្យលម្អិតសំបុត្របេឡាករ (Approval Detail Split UI) ដោយទាញអតិថិជនតាម `t.userId` (`_id`)
 */
window.openTicketDrawer = async function (id) {
  const t = allTickets.find((x) => x._id === id);
  if (!t) return;

  viewingTicketId = id;
  const isDeposit = t.requestType.toLowerCase() === "deposit";
  const curSymbol = t.currency === "USD" ? "$" : "៛";
  const displayRefId =
    t.transactionId || t.ticketId || t._id.substring(0, 10).toUpperCase();

  const viewTable = document.getElementById("viewApproval");
  const viewDetail = document.getElementById("viewApprovalDetail");

  if (viewTable && viewDetail) {
    viewTable.style.display = "none";
    viewDetail.style.display = "block";
  }

  const safeSetText = (elId, text, color = null) => {
    const el = document.getElementById(elId);
    if (el) {
      el.innerText = text;
      if (color) el.style.color = color;
    }
  };

  safeSetText(
    "approvalSlipType",
    `ប័ណ្ណ${isDeposit ? "ដាក់" : "ដក"}ប្រាក់ / CASH ${t.requestType.toUpperCase()}`,
    isDeposit ? "#10b981" : "#ef4444",
  );
  safeSetText("approvalSlipRef", displayRefId);
  safeSetText("approvalSlipDate", new Date(t.createdAt).toLocaleString());
  safeSetText("approvalSlipCustomer", t.slipData?.customerName || "Unknown");
  safeSetText("approvalSlipAccount", t.targetAcc);

  const formatBal = (val) =>
    `${curSymbol}${(val || 0).toLocaleString("en-US", { minimumFractionDigits: t.currency === "USD" ? 2 : 0 })}`;

  safeSetText(
    "approvalSlipAmount",
    formatBal(t.amount),
    isDeposit ? "#10b981" : "#ef4444",
  );
  safeSetText(
    "approvalSlipAmountWords",
    t.currency === "USD"
      ? numberToWordsUSD(t.amount)
      : numberToWordsKHR(t.amount),
  );
  safeSetText("approvalSlipOldBal", formatBal(t.slipData?.priorBalance));
  safeSetText("approvalSlipNewBal", formatBal(t.slipData?.newBalance));

  safeSetText(
    "approvalSlipDepositorLabel",
    isDeposit
      ? "អ្នកដាក់ប្រាក់ / Deposited By:"
      : "អ្នកដកប្រាក់ / Withdrawn By:",
  );
  document.getElementById("approvalSigLabelDepositor").innerHTML = isDeposit
    ? "អ្នកដាក់ប្រាក់<br>DEPOSITOR"
    : "អ្នកដកប្រាក់<br>WITHDRAWER";

  safeSetText(
    "approvalSlipDepositor",
    t.depositorName || t.slipData?.customerName || "Unknown",
  );

  const autoRemark = isDeposit
    ? `ដាក់ប្រាក់ដោយ: ${t.depositorName || "Unknown"} (${t.slipData?.depositorAccount || "N/A"})`
    : `ដកប្រាក់ដោយ: ${t.depositorName || "Unknown"} (${t.slipData?.depositorAccount || "N/A"})`;

  let finalRemark = t.remark || "";
  if (
    !finalRemark.includes("ដាក់ប្រាក់ដោយ:") &&
    !finalRemark.includes("ដកប្រាក់ដោយ:")
  ) {
    finalRemark =
      finalRemark.trim() !== ""
        ? `${finalRemark.trim()} | ${autoRemark}`
        : autoRemark;
  }

  safeSetText("approvalSlipRemark", finalRemark);
  safeSetText("approvalSlipMaker", getMakerFullName(t.maker));

  const statusColor = t.status.includes("pending")
    ? "#d97706"
    : t.status === "rejected"
      ? "#ef4444"
      : "#10b981";
  safeSetText("approvalSlipStatus", formatTicketStatus(t.status), statusColor);

  const qrEl = document.getElementById("approvalSlipQRCode");
  if (qrEl)
    qrEl.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://u-pay-bank.fly.dev/receipt/${displayRefId}`;

  const actionArea = document.getElementById("approvalActionArea");
  const existingMsg = document.getElementById("approvalMakerWarningMsg");
  const printArea = document.getElementById("approvalPrintArea");

  if (existingMsg) existingMsg.style.display = "none";
  if (printArea) printArea.style.display = "none";
  if (actionArea) actionArea.style.display = "none";

  if (t.status.includes("pending")) {
    const actualLoggedInUser = (
      sessionStorage.getItem("adminUsername") || ""
    ).toLowerCase();

    if (t.maker && t.maker.toLowerCase() === actualLoggedInUser) {
      if (existingMsg) existingMsg.style.display = "block";
    } else if (actionArea) {
      actionArea.style.display = "flex";
      actionArea.style.justifyContent = "center";
      actionArea.style.alignItems = "center";
      actionArea.style.gap = "16px";
      actionArea.style.flexWrap = "wrap";
      actionArea.style.padding = "15px 0";

      const approveBtnText =
        t.status === "pending_verify"
          ? '<i class="fa-solid fa-check-circle"></i> ផ្ទៀងផ្ទាត់ (Verify)'
          : '<i class="fa-solid fa-check-circle"></i> អនុម័ត (Approve)';

      actionArea.innerHTML = ` 
        <button id="drawerBtnReject" class="btn-action kh-text" 
          style="background: #fff5f5; color: #dc2626; border: 1px solid #fca5a5; padding: 12px 28px; border-radius: 8px; font-size: 1rem; font-weight: 600; display: flex; justify-content: center; align-items: center; gap: 8px; font-family: 'Kantumruy Pro', sans-serif; min-width: 160px; cursor: pointer; transition: all 0.2s ease;" 
          onmouseover="this.style.background='#fee2e2'; this.style.borderColor='#ef4444';" 
          onmouseout="this.style.background='#fff5f5'; this.style.borderColor='#fca5a5';"> 
          <i class="fa-solid fa-xmark"></i> បដិសេធ (Reject) 
        </button> 

        <button id="drawerBtnApprove" class="btn-primary kh-text" 
          style="background: #10b981; color: white; border: none; padding: 12px 28px; border-radius: 8px; font-size: 1rem; font-weight: 600; display: flex; justify-content: center; align-items: center; gap: 8px; font-family: 'Kantumruy Pro', sans-serif; min-width: 160px; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 2px 6px rgba(16, 185, 129, 0.2);" 
          onmouseover="this.style.background='#059669'; this.style.boxShadow='0 4px 12px rgba(16, 185, 129, 0.3)';" 
          onmouseout="this.style.background='#10b981'; this.style.boxShadow='0 2px 6px rgba(16, 185, 129, 0.2)';"> 
          ${approveBtnText} 
        </button> 
      `;

      setTimeout(() => {
        const btnReject = document.getElementById("drawerBtnReject");
        const btnApprove = document.getElementById("drawerBtnApprove");
        if (btnReject) btnReject.onclick = window.rejectTicket;
        if (btnApprove) btnApprove.onclick = window.approveTicket;
      }, 100);
    }
  } else if (printArea) {
    printArea.style.display = "block";
  }

  // 🎯 ទាញយកទិន្នន័យអតិថិជនតាមរយៈ `t.userId` (MongoDB `_id`) មុនគេបង្អស់!
  const ctxContainer = document.getElementById("approvalCustomerContext");
  if (!ctxContainer) return;

  ctxContainer.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 40px; font-family: 'Kantumruy Pro', sans-serif;"><i class="fa-solid fa-spinner fa-spin fa-2x"></i><br><br>កំពុងទាញយកទិន្នន័យ...</div>`;

  const lookupKey = t.userId || t.targetAcc;
  try {
    const res = await fetch(
      `/api/admin/cashier/search/${encodeURIComponent(lookupKey)}`,
      {
        headers: getAuthHeaders(),
      },
    );
    const data = await res.json();

    if (data.success && data.user) {
      const u = data.user;
      const canonicalId = String(u._id || u.id || "");
      const kycStat = (u.kycStatus || "unverified").toUpperCase();
      const isVerified = kycStat === "VERIFIED" || kycStat === "APPROVED";
      const isFrozen = u.isFrozen;

      let balancesHtml = "";
      const addBalHtml = (name, accNum, bal, cur, color) => {
        if (!accNum) return;
        balancesHtml += `
          <div style="background: var(--bg-card); padding: 12px 16px; border-radius: 12px; border: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; box-shadow: 0 2px 5px rgba(0,0,0,0.02); margin-bottom: 10px;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <div style="width: 8px; height: 8px; background: ${color}; border-radius: 50%;"></div>
                <span style="color: var(--text-main); font-weight: bold; font-size: 0.9rem; font-family: 'Kantumruy Pro', sans-serif;">${name}</span>
              </div>
              <div style="font-size: 0.7rem; color: var(--text-muted); font-family: 'JetBrains Mono', monospace; margin-left: 16px;">${accNum}</div>
            </div>
            <span style="font-family: 'JetBrains Mono', monospace; font-weight: bold; font-size: 1.05rem; color: ${color};">${cur}${bal.toLocaleString("en-US", { minimumFractionDigits: cur === "$" ? 2 : 0 })}</span>
          </div>`;
      };

      addBalHtml(
        "Main USD",
        u.mainAccounts?.USD?.accountNumber,
        u.mainAccounts?.USD?.balance,
        "$",
        "#0ea5e9",
      );
      addBalHtml(
        "Main KHR",
        u.mainAccounts?.KHR?.accountNumber,
        u.mainAccounts?.KHR?.balance,
        "៛",
        "#10b981",
      );

      if (u.subAccounts) {
        u.subAccounts.forEach((sub) =>
          addBalHtml(
            `${sub.accountName} (${sub.currency})`,
            sub.accountNumber,
            sub.balance,
            sub.currency === "USD" ? "$" : "៛",
            sub.currency === "USD" ? "#3b82f6" : "#059669",
          ),
        );
      }

      let html = `
        <div style="border: 1px solid var(--border); padding: 24px; border-radius: 20px; background: var(--bg-body); text-align: left; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.04);">
          <div style="display: flex; align-items: center; gap: 15px; border-bottom: 1px solid var(--border); padding-bottom: 18px; margin-bottom: 18px;">
            <img src="${u.profileImage || "../images/default-avatar.png"}" style="width: 72px; height: 72px; border-radius: 50%; object-fit: cover; border: 3px solid var(--secondary); box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);">
            <div style="flex: 1; overflow: hidden">
              <h3 style="margin: 0; color: var(--text-main); font-size: 1.25rem; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-family: 'Kantumruy Pro', sans-serif;">${u.fullName || u.username}</h3>
              <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 5px; font-family: 'JetBrains Mono', monospace; display: flex; flex-direction: column; gap: 2px; font-weight: 600;">
                <div>_id : ${canonicalId.slice(-8)}</div>
                <div>CARD ID : ${u.idNumber || "N/A"}</div>
              </div>
            </div>
          </div>
          
          <div style="max-height: 200px; overflow-y: auto;">${balancesHtml}</div>
          
          <div style="background: var(--bg-card); padding: 15px; border-radius: 14px; border: 1px solid var(--border); margin: 18px 0;">
            <div style="color: var(--text-muted); font-weight: 700; font-size: 0.8rem; text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.5px; font-family: 'Kantumruy Pro', sans-serif;">ព័ត៌មានទំនាក់ទំនង</div>
            <div style="font-size: 0.95rem; color: var(--text-main); margin-bottom: 6px;"><i class="fa-solid fa-phone" style="width: 20px; color: var(--text-muted)"></i> <span style="font-family: 'JetBrains Mono', monospace; font-weight: 600">${u.phone || "N/A"}</span></div>
            <div style="font-size: 0.95rem; color: var(--text-main); margin-bottom: 12px;"><i class="fa-solid fa-envelope" style="width: 20px; color: var(--text-muted)"></i> <span style="font-family: 'JetBrains Mono', monospace; font-weight: 600">${u.email || "N/A"}</span></div>
            <div style="display: flex; justify-content: center; align-items: center; gap: 12px; border-top: 1px dashed var(--border); padding-top: 12px;">
              <span style="flex: 1; text-align: center; padding: 6px 10px; border-radius: 20px; font-size: 0.8rem; font-weight: bold; background: ${isVerified ? "rgba(16, 185, 129, 0.1)" : "rgba(245, 158, 11, 0.1)"}; color: ${isVerified ? "#10b981" : "#f59e0b"}; font-family: 'Kantumruy Pro', sans-serif;">KYC: ${kycStat}</span>
              <span style="flex: 1; text-align: center; padding: 6px 10px; border-radius: 20px; font-size: 0.8rem; font-weight: bold; background: ${isFrozen ? "rgba(239, 68, 68, 0.1)" : "rgba(16, 185, 129, 0.1)"}; color: ${isFrozen ? "#ef4444" : "#10b981"}; font-family: 'Kantumruy Pro', sans-serif;">${isFrozen ? "FROZEN" : "ACTIVE"}</span>
            </div>
          </div>
          
          <button class="kh-text" style="width: 100%; padding: 13px; border-radius: 12px; cursor: pointer; font-weight: 700; font-size: 1rem; background: var(--bg-card); border: 1px solid var(--border); color: var(--text-main); display: flex; align-items: center; justify-content: center; gap: 8px; transition: 0.2s; box-shadow: 0 2px 5px rgba(0, 0, 0, 0.02); font-family: 'Kantumruy Pro', sans-serif;" onclick="viewCustomerKYC('${u.kycDocument || u.kycImage || ""}')">
            <i class="fa-solid fa-id-card" style="color: var(--secondary)"></i> មើលអត្តសញ្ញាណប័ណ្ណ
          </button>
        </div>
      `;

      if (
        t.slipData?.depositorAccount &&
        t.slipData.depositorAccount !== "N/A" &&
        t.depositorName !== (u.fullName || u.username)
      ) {
        html += `
          <div style="margin-top: 15px; padding-top: 15px; border-top: 1px dashed var(--border);">
             <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; font-weight: bold; margin-bottom: 8px; font-family: 'Kantumruy Pro', sans-serif;">អ្នកតំណាងប្រតិបត្តិការ (Representative)</div>
             <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-card); padding: 10px; border-radius: 8px; border: 1px solid var(--border);">
               <div>
                 <div style="font-weight: bold; font-size: 0.9rem; color: var(--text-main); font-family: 'Kantumruy Pro', sans-serif;">${t.depositorName}</div>
                 <div style="font-size: 0.75rem; font-family: 'JetBrains Mono', monospace; color: var(--text-muted);">${t.slipData.depositorAccount}</div>
               </div>
             </div>
          </div>
        `;
      }
      ctxContainer.innerHTML = html;
    } else {
      ctxContainer.innerHTML = `<div style="text-align: center; color: #ef4444; font-size: 0.85rem;"><i class="fa-solid fa-circle-exclamation"></i> រកទិន្នន័យមិនឃើញ</div>`;
    }
  } catch (error) {
    ctxContainer.innerHTML = `<div style="text-align: center; color: #ef4444; font-size: 0.85rem;"><i class="fa-solid fa-triangle-exclamation"></i> បញ្ហាភ្ជាប់ Server</div>`;
  }
};

window.viewCustomerKYC = function (kycUrl) {
  if (!kycUrl || kycUrl === "") {
    return Swal.fire({
      icon: "info",
      text: "អតិថិជននេះមិនទាន់មានឯកសារបញ្ជាក់អត្តសញ្ញាណ (KYC) ទេ!",
      customClass: { popup: "premium-swal" },
    });
  }

  Swal.fire({
    title: `អត្តសញ្ញាណប័ណ្ណ (KYC)`,
    imageUrl: kycUrl,
    imageWidth: 400,
    imageAlt: "KYC Document",
    customClass: { popup: "premium-swal" },
  });
};

window.closeTicketDrawer = function () {
  const drawer = document.getElementById("ticketDrawer");
  if (drawer) {
    drawer.classList.remove("open");
  }

  const viewDetail = document.getElementById("viewApprovalDetail");
  const viewApproval = document.getElementById("viewApproval");
  if (viewDetail && viewApproval) {
    viewDetail.style.display = "none";
    viewApproval.style.display = "block";
  }

  viewingTicketId = null;
};

// ============================================================================
// 🖨️ ជំពូកទី ៥៖ ការបោះពុម្ពវិក្កយបត្រ និងសកម្មភាពអនុម័ត/បដិសេធ (PRINT SLIP & ACTIONS)
// ============================================================================

window.printInlineSlip = function (areaId = "inlineSlipArea") {
  const printElement = document.getElementById(areaId);
  if (!printElement) {
    console.error("រកមិនឃើញកន្លែងព្រីន: " + areaId);
    return;
  }

  const printContent = printElement.innerHTML;
  const printWindow = window.open("", "_blank", "width=800,height=900");

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>U-Pay Transaction Slip</title>
        <link href="https://fonts.googleapis.com/css2?family=Kantumruy+Pro:wght@400;600;700;800&family=JetBrains+Mono:wght@400;700;800&display=swap" rel="stylesheet">
        <style>
          @page { size: A4 portrait; margin: 0 !important; }
          body { font-family: 'Kantumruy Pro', sans-serif; color: #0f172a; padding: 0; margin: 0; -webkit-print-color-adjust: exact !important; color-adjust: exact !important; box-sizing: border-box; background: white;}
          .page-container { display: flex; flex-direction: column; width: 210mm; height: 297mm; overflow: hidden; margin: 0 auto; background: white;}
          .slip-half { flex: 1; height: 50%; padding: 10mm 20mm; box-sizing: border-box; display: flex; flex-direction: column; justify-content: center; }
          .cut-line-container { width: 100%; height: 0; display: flex; align-items: center; justify-content: center; position: relative; z-index: 10; }
          .cut-line { width: 100%; border-top: 1px dashed #94a3b8; position: absolute; }
          .cut-icon { background: white; padding: 0 10px; color: #64748b; font-size: 16px; position: relative; z-index: 11; }
          .copy-label { text-align: center; font-size: 0.65rem; color: #64748b; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; }
          .slip-content { transform: scale(0.95); transform-origin: center center; width: 100%; }
          .pro-slip-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px; margin-bottom: 8px; }
          .pro-slip-header img { height: 35px !important; }
          .pro-slip-title { text-align: right; }
          .pro-slip-title h2 { margin: 0; font-size: 0.95rem; font-weight: 800; text-transform: uppercase; }
          #inlineSlipDate, #approvalSlipDate { margin: 2px 0 0 0 !important; font-size: 0.7rem !important; }
          #inlineSlipTrxBox, #approvalSlipTrxBox { margin-top: 2px !important; font-size: 0.8rem !important; }
          #inlineSlipRef, #approvalSlipRef { font-size: 0.9rem !important; }
          .pro-slip-box { background: #ffffff !important; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; padding: 5px 0; margin-bottom: 6px; }
          .pro-slip-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
          .pro-slip-row:last-child { margin-bottom: 0; }
          .pro-slip-label { font-size: 0.65rem; color: #64748b; font-weight: 600; }
          .pro-slip-value { font-size: 0.8rem; font-weight: 700; color: #0f172a; }
          .pro-slip-value.acc-num { font-family: 'JetBrains Mono', monospace; color: #2563eb; font-size: 0.85rem; }
          .pro-slip-amount { font-size: 1.15rem; font-weight: 800; font-family: 'JetBrains Mono', monospace; }
          #inlineSlipAmountWords, #approvalSlipAmountWords { font-size: 0.65rem !important; margin-top: 2px !important; }
          .signature-section { display: flex; gap: 10px; margin-top: 8px; padding-top: 8px; border-top: 1px solid #e2e8f0; }
          #inlineSlipQRCode, #approvalSlipQRCode { width: 60px !important; height: 60px !important; }
          .qr-text { font-size: 0.55rem !important; margin-top: 3px !important; }
          .signature-box { flex: 1; text-align: center; height: 60px !important; display: flex !important; flex-direction: column; justify-content: flex-end; }
          .signature-line { border-bottom: 1px dashed #94a3b8; width: 100%; margin-bottom: 4px; }
          .signature-label { font-size: 0.5rem; font-weight: bold; color: #475569; text-transform: uppercase; line-height: 1.2; margin-top: 2px !important; }
          #inlineSlipWarning, #approvalSlipWarning { display: none !important; }
        </style>
      </head>
      <body>
        <div class="page-container">
          <div class="slip-half"><div class="slip-content"><div class="copy-label">CUSTOMER COPY</div>${printContent}</div></div>
          <div class="cut-line-container"><div class="cut-line"></div><div class="cut-icon">✂️</div></div>
          <div class="slip-half"><div class="slip-content"><div class="copy-label">BANK COPY</div>${printContent}</div></div>
        </div>
        <script>window.onload = function() { setTimeout(() => { window.print(); window.close(); }, 300); };</script>
      </body>
    </html>
  `);
  printWindow.document.close();
};

window.approveTicket = async function () {
  if (!viewingTicketId) return;

  Swal.fire({
    title: "យល់ព្រមប្រតិបត្តិការនេះ?",
    text: "តើអ្នកពិតជាចង់អនុម័តប្រតិបត្តិការនេះមែនទេ?",
    icon: "question",
    showCancelButton: true,
    confirmButtonColor: "#10b981",
    cancelButtonColor: "#64748b",
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

        if (res.ok && data.success) {
          Swal.fire({
            icon: "success",
            title: "ជោគជ័យ!",
            text: data.message || "ប្រតិបត្តិការត្រូវបានអនុម័តរួចរាល់។",
            customClass: { popup: "premium-swal" },
          });
          closeTicketDrawer();
          loadCashierTickets();
        } else {
          Swal.fire({
            icon: "error",
            title: "បរាជ័យ",
            text: data.message || "មិនអាចអនុម័តបានទេ",
            customClass: { popup: "premium-swal" },
          });
        }
      } catch (error) {
        Swal.fire({
          icon: "error",
          title: "កំហុសប្រព័ន្ធ",
          text: "មានបញ្ហាក្នុងការបញ្ជូនទិន្នន័យទៅ Server!",
          customClass: { popup: "premium-swal" },
        });
      }
    }
  });
};

window.rejectTicket = async function () {
  if (!viewingTicketId) return;

  Swal.fire({
    title: "បដិសេធប្រតិបត្តិការ?",
    input: "textarea",
    inputLabel:
      "សូមបញ្ជាក់មូលហេតុ (ចំណាំ៖ លុយដែល Hold នឹងបង្វិលចូលកុងអតិថិជនវិញ)",
    inputPlaceholder: "ឧ. ឯកសារមិនគ្រប់គ្រាន់, អតិថិជនសុំបោះបង់...",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#ef4444",
    cancelButtonColor: "#64748b",
    confirmButtonText: "បាទ/ចាស បដិសេធ",
    cancelButtonText: "បោះបង់",
    customClass: { popup: "premium-swal" },
    inputValidator: (value) => {
      if (!value || value.trim() === "") {
        return "អ្នកត្រូវតែបញ្ជាក់មូលហេតុក្នុងការបដិសេធ!";
      }
    },
  }).then(async (result) => {
    if (result.isConfirmed) {
      Swal.fire({
        title: "កំពុងបង្វិលប្រាក់ និងបដិសេធ...",
        didOpen: () => Swal.showLoading(),
        customClass: { popup: "premium-swal" },
      });

      try {
        const res = await fetch("/api/admin/cashier/ticket/action", {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            ticketId: viewingTicketId,
            action: "reject",
            reason: result.value.trim(),
          }),
        });

        const data = await res.json();

        if (res.ok && data.success) {
          Swal.fire({
            icon: "success",
            title: "ជោគជ័យ!",
            text: data.message || "ប្រតិបត្តិការត្រូវបានបដិសេធរួចរាល់។",
            customClass: { popup: "premium-swal" },
          });
          closeTicketDrawer();
          loadCashierTickets();
        } else {
          Swal.fire({
            icon: "error",
            title: "បរាជ័យ",
            text: data.message || "មិនអាចបដិសេធបានទេ",
            customClass: { popup: "premium-swal" },
          });
        }
      } catch (error) {
        Swal.fire({
          icon: "error",
          title: "កំហុសប្រព័ន្ធ",
          text: "មានបញ្ហាក្នុងការបញ្ជូនទិន្នន័យទៅ Server!",
          customClass: { popup: "premium-swal" },
        });
      }
    }
  });
};

// ============================================================================
// 🎬 ជំពូកទី ៦៖ ការចាប់ផ្តើមដំណើរការប្រព័ន្ធបេឡាករដោយស្វ័យប្រវត្តិ (AUTO-INIT HOOK)
// ============================================================================
document.addEventListener("DOMContentLoaded", () => {
  const savedTab = sessionStorage.getItem("activeCashierTab") || "teller";
  if (document.getElementById("sec-cashier")) {
    switchCashierTab(savedTab);
  }
  startAutoRefresh();
});
