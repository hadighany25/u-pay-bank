// ========================================================================
// 📊 ផ្នែកទី ២៖ ហិរញ្ញវត្ថុ បេឡាករ និងការកំណត់ (FINANCE & CASHIER LOGIC)
// ========================================================================

// ------------------------------------------------------------------------
// 📌 ២.១ ការកំណត់អត្រាប្តូរប្រាក់ (FX Rates ដែលទាញពី Database)
// ------------------------------------------------------------------------
window.currentFXRates = { usdToKhrBuy: 4050, usdToKhrSell: 4100 }; // អថេរសកល (Global Variable)

async function fetchFXRates() {
  try {
    const res = await fetch("/api/admin/fx/rates", {
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (data.success && data.rates) {
      window.currentFXRates = data.rates; // រក្សាទុកតម្លៃដែលទាញពី Database

      const buyInput = document.getElementById("fxBuy");
      const sellInput = document.getElementById("fxSell");
      if (buyInput) buyInput.value = data.rates.usdToKhrBuy;
      if (sellInput) sellInput.value = data.rates.usdToKhrSell;
    }
  } catch (e) {
    console.error("Error loading FX rates", e);
  }
}
fetchFXRates(); // ហៅឱ្យរត់ពេលបើក Script ភ្លាម

window.updateFX = async function () {
  const buy = document.getElementById("fxBuy").value;
  const sell = document.getElementById("fxSell").value;
  try {
    Swal.fire({
      title: "កំពុងរក្សាទុក...",
      didOpen: () => Swal.showLoading(),
      customClass: { popup: "premium-swal" },
    });
    const res = await fetch("/api/admin/fx/update", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ buy, sell }),
    });
    const data = await res.json();
    if (data.success) {
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "Exchange Rates Updated!",
        showConfirmButton: false,
        timer: 1500,
        customClass: { popup: "premium-swal" },
      });
      fetchFXRates(); // Refresh លេខកូដសកលឡើងវិញ
    } else
      Swal.fire({
        icon: "error",
        title: "បរាជ័យ!",
        text: data.message || "មិនអាចកែប្រែបានទេ",
        customClass: { popup: "premium-swal" },
      });
  } catch (error) {
    Swal.fire({
      icon: "error",
      title: "Error",
      text: "បញ្ហាតភ្ជាប់ទៅកាន់ Server",
      customClass: { popup: "premium-swal" },
    });
  }
};

// ------------------------------------------------------------------------
// 📌 ២.២ ការកំណត់កម្រៃសេវា និងដែនកំណត់ (Fees & Limits)
// ------------------------------------------------------------------------
let feeTiersList = [];

window.loadFeeSettings = async function () {
  try {
    const res = await fetch("/api/admin/fees", { headers: getAuthHeaders() });
    const data = await res.json();
    if (data.success) {
      document.getElementById("dailyTrxLimit").value = data.transferLimit;
      feeTiersList = data.feeTiers || [];
      renderFeeTiers();
    }
  } catch (e) {
    console.error("Error loading fees");
  }
};

window.formatDecimal = function (input) {
  let val = input.value.replace(/,/g, ".");
  val = val.replace(/[^0-9.]/g, "");
  if ((val.match(/\./g) || []).length > 1)
    val = val.substring(0, val.lastIndexOf("."));
  input.value = val;
  return val;
};

// ប្រើប្រាស់អត្រាប្តូរប្រាក់សកលសម្រាប់គណនាសេវា
function getCurrentFXRate() {
  return window.currentFXRates ? window.currentFXRates.usdToKhrSell : 4100;
}

window.syncCurrency = function (element, type, index, field) {
  const exchangeRate = getCurrentFXRate();
  let value = parseFloat(element.value) || 0;
  if (type === "USD") {
    let khrValue = Math.round(value * exchangeRate);
    const khrInput = document.getElementById(`${field}Khr_${index}`);
    if (khrInput) khrInput.value = khrValue;
    feeTiersList[index][field] = value;
  } else if (type === "KHR") {
    let usdValue = (value / exchangeRate).toFixed(2);
    const usdInput = document.getElementById(`${field}Usd_${index}`);
    if (usdInput) usdInput.value = usdValue;
    feeTiersList[index][field] = parseFloat(usdValue);
  }
};

window.renderFeeTiers = function () {
  const tbody = document.getElementById("feeTiersBody");
  if (!tbody) return;
  tbody.innerHTML = "";
  const currentRate = getCurrentFXRate();

  feeTiersList.forEach((tier, index) => {
    const minKhr = Math.round((parseFloat(tier.min) || 0) * currentRate);
    const maxKhr = Math.round((parseFloat(tier.max) || 0) * currentRate);
    const feeKhr = Math.round((parseFloat(tier.fee) || 0) * currentRate);

    tbody.innerHTML += `
      <tr style="border-bottom: 1px dashed var(--border);">
        <td style="padding: 12px 10px;">
          <div style="display: flex; flex-direction: column; gap: 6px; align-items: center;">
            <div style="display: flex; align-items: center; gap: 5px;">
              <span style="font-size: 0.8rem; color: var(--text-muted); font-weight:bold;">$</span>
              <input type="text" id="minUsd_${index}" inputmode="decimal" class="form-input" style="width: 80px; text-align:center; font-weight: 600;" value="${tier.min}" placeholder="0.00" oninput="formatDecimal(this); syncCurrency(this, 'USD', ${index}, 'min')">
            </div>
            <div style="display: flex; align-items: center; gap: 5px;">
              <span style="font-size: 0.8rem; color: var(--text-muted); font-weight:bold;">៛</span>
              <input type="text" id="minKhr_${index}" inputmode="decimal" class="form-input" style="width: 80px; text-align:center; font-size: 0.85rem; background: var(--bg-body);" value="${minKhr}" placeholder="0 ៛" oninput="formatDecimal(this); syncCurrency(this, 'KHR', ${index}, 'min')">
            </div>
          </div>
        </td>
        <td style="padding: 12px 10px;">
          <div style="display: flex; flex-direction: column; gap: 6px; align-items: center;">
            <div style="display: flex; align-items: center; gap: 5px;">
              <span style="font-size: 0.8rem; color: var(--text-muted); font-weight:bold;">$</span>
              <input type="text" id="maxUsd_${index}" inputmode="decimal" class="form-input" style="width: 80px; text-align:center; font-weight: 600;" value="${tier.max}" placeholder="0.00" oninput="formatDecimal(this); syncCurrency(this, 'USD', ${index}, 'max')">
            </div>
            <div style="display: flex; align-items: center; gap: 5px;">
              <span style="font-size: 0.8rem; color: var(--text-muted); font-weight:bold;">៛</span>
              <input type="text" id="maxKhr_${index}" inputmode="decimal" class="form-input" style="width: 80px; text-align:center; font-size: 0.85rem; background: var(--bg-body);" value="${maxKhr}" placeholder="0 ៛" oninput="formatDecimal(this); syncCurrency(this, 'KHR', ${index}, 'max')">
            </div>
          </div>
        </td>
        <td style="padding: 12px 10px;">
          <div style="display: flex; flex-direction: column; gap: 6px; align-items: center;">
            <div style="display: flex; align-items: center; gap: 5px;">
              <span style="font-size: 0.8rem; color: var(--text-muted); font-weight:bold;">$</span>
              <input type="text" id="feeUsd_${index}" inputmode="decimal" class="form-input" style="width: 80px; text-align:center; color: var(--secondary); font-weight: bold;" value="${tier.fee}" placeholder="0.00" oninput="formatDecimal(this); syncCurrency(this, 'USD', ${index}, 'fee')">
            </div>
            <div style="display: flex; align-items: center; gap: 5px;">
              <span style="font-size: 0.8rem; color: var(--text-muted); font-weight:bold;">៛</span>
              <input type="text" id="feeKhr_${index}" inputmode="decimal" class="form-input" style="width: 80px; text-align:center; font-size: 0.85rem; background: var(--bg-body);" value="${feeKhr}" placeholder="0 ៛" oninput="formatDecimal(this); syncCurrency(this, 'KHR', ${index}, 'fee')">
            </div>
          </div>
        </td>
        <td style="padding: 12px 10px; text-align: center; vertical-align: middle;">
          <button class="btn-action btn-delete" onclick="removeTier(${index})" style="background: #ef4444; color: white; border: none; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; transition: 0.2s;"><i class="fa-solid fa-trash-can"></i></button>
        </td>
      </tr>
    `;
  });
};

window.addFeeTier = function () {
  feeTiersList.push({ min: 0, max: 0, fee: 0 });
  renderFeeTiers();
};
window.removeTier = function (index) {
  feeTiersList.splice(index, 1);
  renderFeeTiers();
};

window.saveFeeSettings = async function () {
  const limit = document.getElementById("dailyTrxLimit").value;
  const cleanTiers = feeTiersList.map((t) => ({
    min: parseFloat(t.min) || 0,
    max: parseFloat(t.max) || 0,
    fee: parseFloat(t.fee) || 0,
  }));
  try {
    Swal.fire({
      title: "កំពុងរក្សាទុក...",
      didOpen: () => Swal.showLoading(),
      customClass: { popup: "premium-swal" },
    });
    const res = await fetch("/api/admin/fees", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ transferLimit: limit, feeTiers: cleanTiers }),
    });
    const data = await res.json();
    if (data.success) {
      Swal.fire({
        icon: "success",
        title: "ជោគជ័យ!",
        text: data.message || "រក្សាទុកការកំណត់បានជោគជ័យ!",
        customClass: { popup: "premium-swal" },
      });
      loadFeeSettings();
    } else
      Swal.fire({
        icon: "error",
        title: "បរាជ័យ",
        text: data.message,
        customClass: { popup: "premium-swal" },
      });
  } catch (err) {
    Swal.fire({
      icon: "error",
      title: "Error",
      text: "បញ្ហាភ្ជាប់ទៅកាន់ Server",
      customClass: { popup: "premium-swal" },
    });
  }
};
setTimeout(loadFeeSettings, 1000);

// ------------------------------------------------------------------------
// 📌 ២.៣ ការបង្កើតប្រូម៉ូសិនកូដ (Promo Codes)
// ------------------------------------------------------------------------
window.openPromoModal = function () {
  document.getElementById("prmCode").value = "";
  document.getElementById("prmReward").value = "";
  document.getElementById("prmMax").value = "100";
  document.getElementById("prmExpiry").value = "";
  document
    .getElementById("promoModal")
    .style.setProperty("display", "flex", "important");
};

window.savePromoCode = async function () {
  const code = document.getElementById("prmCode").value.trim();
  const reward = document.getElementById("prmReward").value;
  const max = document.getElementById("prmMax").value;
  const expiry = document.getElementById("prmExpiry").value;

  if (!code || !reward)
    return Swal.fire({
      icon: "warning",
      title: "បំពេញមិនគ្រប់",
      text: "សូមបញ្ចូលឈ្មោះកូដ និងទឹកប្រាក់រង្វាន់!",
      customClass: { popup: "premium-swal" },
    });
  Swal.fire({
    title: "កំពុងបង្កើត...",
    didOpen: () => Swal.showLoading(),
    customClass: { popup: "premium-swal" },
  });

  try {
    const res = await fetch("/api/admin/promo/create", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        code: code,
        rewardValue: reward,
        maxUsage: max,
        expiresAt: expiry || null,
      }),
    });
    const data = await res.json();
    if (data.success) {
      Swal.fire({
        icon: "success",
        title: "ជោគជ័យ!",
        text: data.message,
        customClass: { popup: "premium-swal" },
      });
      closeModal("promoModal");
      loadPromoCodes();
    } else
      Swal.fire({
        icon: "error",
        title: "បរាជ័យ",
        text: data.message,
        customClass: { popup: "premium-swal" },
      });
  } catch (e) {
    Swal.fire({
      icon: "error",
      title: "Error",
      text: "បញ្ហាភ្ជាប់ទៅកាន់ Server",
      customClass: { popup: "premium-swal" },
    });
  }
};

window.loadPromoCodes = async function () {
  try {
    const res = await fetch("/api/admin/promos", { headers: getAuthHeaders() });
    const data = await res.json();
    const tbody = document.getElementById("promoTableBody");
    if (!tbody) return;

    if (data.success && data.promos && data.promos.length > 0) {
      tbody.innerHTML = data.promos
        .map((p) => {
          const status = p.isActive
            ? `<span style="color:var(--secondary); font-weight:bold;">Active 🟢</span>`
            : `<span style="color:#ef4444; font-weight:bold;">Disabled 🛑</span>`;
          const usage = `${p.usedCount} / ${p.maxUsage}`;
          const expiry = p.expiresAt
            ? new Date(p.expiresAt).toLocaleDateString("en-GB")
            : "គ្មានកំណត់";
          return `<tr style="border-bottom: 1px solid var(--border);"><td style="font-weight:900; color:var(--accent); font-size:1.1rem; letter-spacing:1.5px;">${p.code}</td><td style="color:var(--secondary); font-weight:bold; font-size:1.1rem;">$${p.rewardValue.toFixed(2)}</td><td><b>${usage} នាក់</b><br><span style="font-size:0.8rem; color:var(--text-muted);">ផុតកំណត់: ${expiry}</span></td><td>${status}</td><td style="text-align: right;"><label class="switch"><input type="checkbox" ${p.isActive ? "checked" : ""} onchange="togglePromoStatus('${p._id}')"><span class="slider"></span></label></td></tr>`;
        })
        .join("");
    } else
      tbody.innerHTML =
        '<tr><td colspan="5" style="text-align:center; padding:40px; color:var(--text-muted);"><i class="fa-solid fa-ticket" style="font-size:2rem; margin-bottom:10px; opacity:0.5;"></i><br>មិនទាន់មានកូដប្រូម៉ូសិននៅឡើយទេ</td></tr>';
  } catch (e) {}
};

window.togglePromoStatus = async function (id) {
  await fetch("/api/admin/promo/toggle", {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ id }),
  });
  loadPromoCodes();
};

// ------------------------------------------------------------------------
// 📌 ២.៤ បេឡាករ (CASHIER SYSTEM) - ដាក់ប្រាក់/ដកប្រាក់
// ------------------------------------------------------------------------
let currentTargetUser = null;
let currentDepositorUser = null;

window.toggleDepositorType = function () {
  const typeEle = document.querySelector('input[name="depositorType"]:checked');
  if (!typeEle) return;
  const type = typeEle.value;
  const otherDiv = document.getElementById("otherDepositorDiv");

  if (type === "other") {
    otherDiv.style.display = "block";
  } else {
    otherDiv.style.display = "none";
    currentDepositorUser = null;
    document.getElementById("depositorSearch").value = "";
    document.getElementById("depositorName").style.display = "none";
  }
};

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

      document.getElementById("targetUserCard").style.display = "flex";
      document.getElementById("transactionForm").style.display = "block";
      document.getElementById("cardName").textContent =
        `${currentTargetUser.fullName} (@${currentTargetUser.username})`;

      const balUSD = currentTargetUser.balance || 0;
      const balKHR = currentTargetUser.balanceKHR || 0;
      document.getElementById("cardBalUSD").textContent =
        `USD: $${balUSD.toFixed(2)}`;
      document.getElementById("cardBalKHR").textContent =
        `KHR: ៛${balKHR.toLocaleString()}`;

      const accountSelect = document.getElementById("targetAccountSelect");
      let optionHTML = "";

      if (currentTargetUser.accountNumber)
        optionHTML += `<option value="${currentTargetUser.accountNumber}">Main USD: ${currentTargetUser.accountNumber}</option>`;
      if (currentTargetUser.accountNumberKHR)
        optionHTML += `<option value="${currentTargetUser.accountNumberKHR}">Main KHR: ${currentTargetUser.accountNumberKHR}</option>`;

      if (
        currentTargetUser.subAccounts &&
        currentTargetUser.subAccounts.length > 0
      ) {
        currentTargetUser.subAccounts.forEach((sub) => {
          optionHTML += `<option value="${sub.accountNumber}">${sub.accountName} (${sub.currency}): ${sub.accountNumber}</option>`;
        });
      }

      accountSelect.innerHTML = optionHTML;

      let foundExactMatch = false;
      for (let i = 0; i < accountSelect.options.length; i++) {
        if (accountSelect.options[i].value === searchVal) {
          accountSelect.selectedIndex = i;
          foundExactMatch = true;

          const cashCurrency = document.getElementById("cashCurrency");
          const selectedSub = currentTargetUser.subAccounts?.find(
            (s) => s.accountNumber === searchVal,
          );

          if (selectedSub) cashCurrency.value = selectedSub.currency;
          else if (searchVal === currentTargetUser.accountNumberKHR)
            cashCurrency.value = "KHR";
          else cashCurrency.value = "USD";
          break;
        }
      }
      if (!foundExactMatch)
        document.getElementById("cashCurrency").value = "USD";

      // ហៅ Preview Exchange សារថ្មីពេលរកឃើញ
      if (typeof previewCashierExchange === "function")
        previewCashierExchange();
    } else {
      Swal.fire({
        icon: "error",
        title: "បរាជ័យ",
        text: data.message || "រកមិនឃើញគណនីនេះទេ!",
        customClass: { popup: "premium-swal" },
      });
      document.getElementById("targetUserCard").style.display = "none";
      document.getElementById("transactionForm").style.display = "none";
      currentTargetUser = null;
    }
  } catch (error) {
    Swal.fire({
      icon: "error",
      title: "Error",
      text: "បញ្ហាភ្ជាប់ទៅកាន់ Server",
      customClass: { popup: "premium-swal" },
    });
  }
};

window.verifyDepositor = async function () {
  const val = document.getElementById("depositorSearch").value.trim();
  const nameText = document.getElementById("depNameText");

  if (val.length >= 3) {
    document.getElementById("depositorName").style.display = "block";
    nameText.innerText = "កំពុងស្វែងរក...";
    nameText.style.color = "var(--text-muted)";

    try {
      const res = await fetch(`/api/admin/cashier/search/${val}`, {
        method: "GET",
        headers: getAuthHeaders(),
      });
      const result = await res.json();

      if (result.success) {
        currentDepositorUser = result.user;
        nameText.innerText = `${currentDepositorUser.fullName} (@${currentDepositorUser.username})`;
        nameText.style.color = "var(--secondary)";
      } else {
        currentDepositorUser = null;
        nameText.innerText = "រកមិនឃើញគណនីនេះទេ!";
        nameText.style.color = "#ef4444";
      }
    } catch (error) {
      nameText.innerText = "មានបញ្ហាតភ្ជាប់ (Error Network)";
      nameText.style.color = "#ef4444";
    }
  } else {
    document.getElementById("depositorName").style.display = "none";
    currentDepositorUser = null;
  }
};

window.viewKYC = function () {
  if (!currentTargetUser || !currentTargetUser.kycImage) {
    return Swal.fire({
      icon: "info",
      title: "ព័ត៌មាន",
      text: "អតិថិជននេះមិនទាន់មានរូប KYC ទេ",
      customClass: { popup: "premium-swal" },
    });
  }
  Swal.fire({
    title: `អត្តសញ្ញាណប័ណ្ណរបស់ ${currentTargetUser.fullName}`,
    imageUrl: currentTargetUser.kycImage,
    imageWidth: 400,
    imageAlt: "KYC Image",
    customClass: { popup: "premium-swal" },
  });
};

// 🔥 មុខងារគណនាបង្ហាញលុយមុន (Live Preview) សម្រាប់ Cashier ដោយទាញអត្រាប្តូរប្រាក់អូតូពី Database
window.previewCashierExchange = function () {
  const targetSelect = document.getElementById("targetAccountSelect");
  if (!targetSelect || targetSelect.options.length === 0) return;

  const selectedText = targetSelect.options[targetSelect.selectedIndex].text;
  let destCurrency = "USD";
  if (selectedText.includes("KHR") || selectedText.includes("៛"))
    destCurrency = "KHR";

  const currencySelect = document.getElementById("cashCurrency");
  if (!currencySelect) return;
  const inputCurrency = currencySelect.value;

  const amountInput = document.getElementById("cashAmount");
  if (!amountInput) return;
  const amount = parseFloat(amountInput.value) || 0;

  const previewBox = document.getElementById("cashierExchangePreview");
  const rateDisplay = document.getElementById("cashierFxRateDisplay");
  const resultText = document.getElementById("cashierExchangeResult");

  if (!previewBox || !rateDisplay || !resultText) return;

  // ទាញអត្រាប្តូរប្រាក់ពីអថេរសកល (Global Variable ដែលបាន Update ដោយ fetchFXRates)
  const rateBuy = window.currentFXRates
    ? window.currentFXRates.usdToKhrBuy || 4050
    : 4050;
  const rateSell = window.currentFXRates
    ? window.currentFXRates.usdToKhrSell || 4100
    : 4100;

  if (amount > 0 && destCurrency !== inputCurrency) {
    previewBox.style.display = "block"; // លោតបង្ហាញ

    if (inputCurrency === "USD" && destCurrency === "KHR") {
      const khrAmt = Math.round(amount * rateBuy);
      rateDisplay.innerText = `$1 = ${rateBuy.toLocaleString("en-US")} ៛`;
      resultText.innerText = `${khrAmt.toLocaleString("en-US")} ៛`;
    } else if (inputCurrency === "KHR" && destCurrency === "USD") {
      const usdAmt = (amount / rateSell).toFixed(2);
      rateDisplay.innerText = `$1 = ${rateSell.toLocaleString("en-US")} ៛`;
      resultText.innerText = `$${usdAmt}`;
    }
  } else {
    previewBox.style.display = "none"; // លាក់វិញ
  }
};

window.processCashTransaction = async function () {
  const typeEle = document.querySelector('input[name="depositorType"]:checked');
  const type = typeEle ? typeEle.value : "self";
  const targetAccountElement = document.getElementById("targetAccountSelect");
  const targetAccount = targetAccountElement
    ? targetAccountElement.value
    : null;
  const currency = document.getElementById("cashCurrency").value;
  const amount = document.getElementById("cashAmount").value;
  let remark = document.getElementById("cashRemark").value.trim();

  if (!amount || amount <= 0)
    return Swal.fire({
      icon: "error",
      title: "កំហុស",
      text: "សូមបញ្ចូលចំនួនទឹកប្រាក់ឱ្យបានត្រឹមត្រូវ",
      customClass: { popup: "premium-swal" },
    });
  if (!targetAccount)
    return Swal.fire({
      icon: "error",
      title: "កំហុស",
      text: "សូមជ្រើសរើសគណនី (Main ឬ កុងរង) ដែលត្រូវទទួលប្រាក់សិន",
      customClass: { popup: "premium-swal" },
    });
  if (type === "other" && !currentDepositorUser)
    return Swal.fire({
      icon: "error",
      title: "កំហុស",
      text: "សូមស្វែងរកគណនីអ្នកដាក់ប្រាក់ឱ្យបានត្រឹមត្រូវ",
      customClass: { popup: "premium-swal" },
    });

  if (!remark) {
    if (type === "self")
      remark = `ដាក់ប្រាក់ដោយម្ចាស់គណនី (${currentTargetUser.fullName})`;
    else
      remark = `ដាក់ប្រាក់ដោយ ${currentDepositorUser.fullName} ជូនទៅ ${currentTargetUser.fullName}`;
  }

  Swal.fire({
    title: "បញ្ជាក់ការដាក់ប្រាក់",
    html: `អ្នកកំពុងដាក់ប្រាក់ <b>${currency === "USD" ? "$" : "៛"}${amount}</b> <br>ចូលទៅគណនី <b>${targetAccount}</b> របស់ <b>@${currentTargetUser.username}</b> <br><br> <i>ចំណាំ៖ ${remark}</i>`,
    icon: "question",
    showCancelButton: true,
    confirmButtonColor: "#10b981",
    confirmButtonText: "យល់ព្រមដាក់ប្រាក់",
    customClass: { popup: "premium-swal" },
  }).then(async (result) => {
    if (result.isConfirmed) {
      Swal.fire({
        title: "កំពុងដំណើរការ...",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
        customClass: { popup: "premium-swal" },
      });

      try {
        const res = await fetch("/api/admin/cashier/transaction", {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            targetUsername: currentTargetUser.username,
            targetAccount: targetAccount,
            depositorType: type,
            depositorUsername: currentDepositorUser
              ? currentDepositorUser.username
              : null,
            currency: currency,
            amount: amount,
            remark: remark,
          }),
        });
        const data = await res.json();

        if (data.success) {
          Swal.fire({
            icon: "success",
            title: "ជោគជ័យ!",
            text: data.message,
            customClass: { popup: "premium-swal" },
          });

          document.getElementById("cashAmount").value = "";
          document.getElementById("cashRemark").value = "";
          document.getElementById("depositorSearch").value = "";
          document.getElementById("targetUserSearch").value = "";
          if (targetAccountElement) targetAccountElement.value = "";
          document.getElementById("targetUserCard").style.display = "none";
          document.getElementById("transactionForm").style.display = "none";
          const preBox = document.getElementById("cashierExchangePreview");
          if (preBox) preBox.style.display = "none";
          currentTargetUser = null;
          currentDepositorUser = null;
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
          title: "Error",
          text: "បញ្ហាភ្ជាប់ទៅកាន់ Server",
          customClass: { popup: "premium-swal" },
        });
      }
    }
  });
};
