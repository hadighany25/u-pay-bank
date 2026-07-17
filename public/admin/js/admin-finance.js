// ==========================================
// 1. FX Rate (អត្រាប្តូរប្រាក់)
// ==========================================
async function fetchFXRates() {
  const res = await fetch("/api/admin/fx/rates", { headers: getAuthHeaders() });
  const data = await res.json();
  if (data.success && data.rates) {
    document.getElementById("fxBuy").value = data.rates.usdToKhrBuy;
    document.getElementById("fxSell").value = data.rates.usdToKhrSell;
  }
}

async function updateFX() {
  const buy = document.getElementById("fxBuy").value;
  const sell = document.getElementById("fxSell").value;
  try {
    Swal.fire({ title: "កំពុងរក្សាទុក...", didOpen: () => Swal.showLoading() });
    const res = await fetch("/api/admin/fx/update", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ buy, sell }),
    });
    const data = await res.json();
    if (data.success)
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "Exchange Rates Updated!",
        showConfirmButton: false,
        timer: 1500,
      });
    else
      Swal.fire(
        "បរាជ័យ!",
        data.message || "មិនអាចកែប្រែអត្រាប្តូរប្រាក់បានទេ",
        "error",
      );
  } catch (error) {
    Swal.fire("Error", "បញ្ហាតភ្ជាប់ទៅកាន់ Server", "error");
  }
}

// ==========================================
// 2. Fees & Limits (កម្រៃសេវា និង ដែនកំណត់)
// ==========================================
let feeTiersList = [];
async function loadFeeSettings() {
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
}

function formatDecimal(input) {
  let val = input.value.replace(/,/g, ".");
  val = val.replace(/[^0-9.]/g, "");
  if ((val.match(/\./g) || []).length > 1) {
    val = val.substring(0, val.lastIndexOf("."));
  }
  input.value = val;
  return val;
}

function getCurrentFXRate() {
  const fxSellInput =
    document.getElementById("usdToKhrSell") ||
    document.getElementById("fxSell");
  return fxSellInput ? parseFloat(fxSellInput.value) || 4000 : 4000;
}

function syncCurrency(element, type, index, field) {
  const exchangeRate = getCurrentFXRate();
  let value = parseFloat(element.value) || 0;
  if (type === "USD") {
    let khrValue = Math.round(value * exchangeRate);
    document.getElementById(`${field}Khr_${index}`).value = khrValue;
    feeTiersList[index][field] = value;
  } else if (type === "KHR") {
    let usdValue = (value / exchangeRate).toFixed(2);
    document.getElementById(`${field}Usd_${index}`).value = usdValue;
    feeTiersList[index][field] = parseFloat(usdValue);
  }
}

function syncFeeCurrency(element, type, index) {
  const exchangeRateInput = document.getElementById("fxSell");
  let exchangeRate = exchangeRateInput
    ? parseFloat(exchangeRateInput.value)
    : 4000;
  let value = parseFloat(element.value) || 0;
  if (type === "USD") {
    let khrValue = Math.round(value * exchangeRate);
    document.getElementById(`feeKhr_${index}`).value = khrValue;
  } else if (type === "KHR") {
    let usdValue = (value / exchangeRate).toFixed(2);
    document.getElementById(`feeUsd_${index}`).value = usdValue;
  }
}

function renderFeeTiers() {
  const tbody = document.getElementById("feeTiersBody");
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
              <span style="font-size: 0.8rem; color: #64748b; font-weight:bold;">$</span>
              <input type="text" id="minUsd_${index}" inputmode="decimal" class="form-input" style="width: 80px; text-align:center; font-weight: 600;" value="${tier.min}" placeholder="0.00" oninput="formatDecimal(this); syncCurrency(this, 'USD', ${index}, 'min')">
            </div>
            <div style="display: flex; align-items: center; gap: 5px;">
              <span style="font-size: 0.8rem; color: #64748b; font-weight:bold;">៛</span>
              <input type="text" id="minKhr_${index}" inputmode="decimal" class="form-input" style="width: 80px; text-align:center; font-size: 0.85rem; background: #f8fafc;" value="${minKhr}" placeholder="0 ៛" oninput="formatDecimal(this); syncCurrency(this, 'KHR', ${index}, 'min')">
            </div>
          </div>
        </td>
        <td style="padding: 12px 10px;">
          <div style="display: flex; flex-direction: column; gap: 6px; align-items: center;">
            <div style="display: flex; align-items: center; gap: 5px;">
              <span style="font-size: 0.8rem; color: #64748b; font-weight:bold;">$</span>
              <input type="text" id="maxUsd_${index}" inputmode="decimal" class="form-input" style="width: 80px; text-align:center; font-weight: 600;" value="${tier.max}" placeholder="0.00" oninput="formatDecimal(this); syncCurrency(this, 'USD', ${index}, 'max')">
            </div>
            <div style="display: flex; align-items: center; gap: 5px;">
              <span style="font-size: 0.8rem; color: #64748b; font-weight:bold;">៛</span>
              <input type="text" id="maxKhr_${index}" inputmode="decimal" class="form-input" style="width: 80px; text-align:center; font-size: 0.85rem; background: #f8fafc;" value="${maxKhr}" placeholder="0 ៛" oninput="formatDecimal(this); syncCurrency(this, 'KHR', ${index}, 'max')">
            </div>
          </div>
        </td>
        <td style="padding: 12px 10px;">
          <div style="display: flex; flex-direction: column; gap: 6px; align-items: center;">
            <div style="display: flex; align-items: center; gap: 5px;">
              <span style="font-size: 0.8rem; color: #64748b; font-weight:bold;">$</span>
              <input type="text" id="feeUsd_${index}" inputmode="decimal" class="form-input" style="width: 80px; text-align:center; color: #00b894; font-weight: bold;" value="${tier.fee}" placeholder="0.00" oninput="formatDecimal(this); syncCurrency(this, 'USD', ${index}, 'fee')">
            </div>
            <div style="display: flex; align-items: center; gap: 5px;">
              <span style="font-size: 0.8rem; color: #64748b; font-weight:bold;">៛</span>
              <input type="text" id="feeKhr_${index}" inputmode="decimal" class="form-input" style="width: 80px; text-align:center; font-size: 0.85rem; background: #f8fafc;" value="${feeKhr}" placeholder="0 ៛" oninput="formatDecimal(this); syncCurrency(this, 'KHR', ${index}, 'fee')">
            </div>
          </div>
        </td>
        <td style="padding: 12px 10px; text-align: center; vertical-align: middle;">
          <button class="btn-action btn-delete" onclick="removeTier(${index})" style="background: #ef4444; color: white; border: none; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; transition: 0.2s;"><i class="fa-solid fa-trash-can"></i></button>
        </td>
      </tr>
    `;
  });
}

function addFeeTier() {
  feeTiersList.push({ min: 0, max: 0, fee: 0 });
  renderFeeTiers();
}
function removeTier(index) {
  feeTiersList.splice(index, 1);
  renderFeeTiers();
}

async function saveFeeSettings() {
  const limit = document.getElementById("dailyTrxLimit").value;
  const cleanTiers = feeTiersList.map((t) => ({
    min: parseFloat(t.min) || 0,
    max: parseFloat(t.max) || 0,
    fee: parseFloat(t.fee) || 0,
  }));
  try {
    Swal.fire({ title: "កំពុងរក្សាទុក...", didOpen: () => Swal.showLoading() });
    const res = await fetch("/api/admin/fees", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ transferLimit: limit, feeTiers: cleanTiers }),
    });
    const data = await res.json();
    if (data.success) {
      Swal.fire(
        "ជោគជ័យ!",
        data.message || "រក្សាទុកការកំណត់បានជោគជ័យ!",
        "success",
      );
      loadFeeSettings();
    } else {
      Swal.fire("បរាជ័យ", data.message, "error");
    }
  } catch (err) {
    Swal.fire("Error", "បញ្ហាភ្ជាប់ទៅកាន់ Server", "error");
  }
}
setTimeout(loadFeeSettings, 1000);

// ==========================================
// 3. Promo Codes (ប្រូម៉ូសិនកូដ)
// ==========================================
function openPromoModal() {
  document.getElementById("prmCode").value = "";
  document.getElementById("prmReward").value = "";
  document.getElementById("prmMax").value = "100";
  document.getElementById("prmExpiry").value = "";
  document
    .getElementById("promoModal")
    .style.setProperty("display", "flex", "important");
}

async function savePromoCode() {
  const code = document.getElementById("prmCode").value.trim();
  const reward = document.getElementById("prmReward").value;
  const max = document.getElementById("prmMax").value;
  const expiry = document.getElementById("prmExpiry").value;
  if (!code || !reward)
    return Swal.fire(
      "បំពេញមិនគ្រប់",
      "សូមបញ្ចូលឈ្មោះកូដ និងទឹកប្រាក់រង្វាន់!",
      "warning",
    );
  Swal.fire({ title: "កំពុងបង្កើត...", didOpen: () => Swal.showLoading() });
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
      Swal.fire("ជោគជ័យ!", data.message, "success");
      closeModal("promoModal");
      loadPromoCodes();
    } else Swal.fire("បរាជ័យ", data.message, "error");
  } catch (e) {
    Swal.fire("Error", "បញ្ហាភ្ជាប់ទៅកាន់ Server", "error");
  }
}

async function loadPromoCodes() {
  try {
    const res = await fetch("/api/admin/promos", { headers: getAuthHeaders() });
    const data = await res.json();
    const tbody = document.getElementById("promoTableBody");
    if (data.success && data.promos && data.promos.length > 0) {
      tbody.innerHTML = data.promos
        .map((p) => {
          const status = p.isActive
            ? `<span style="color:#10b981; font-weight:bold;">Active 🟢</span>`
            : `<span style="color:#ef4444; font-weight:bold;">Disabled 🛑</span>`;
          const usage = `${p.usedCount} / ${p.maxUsage}`;
          const expiry = p.expiresAt
            ? new Date(p.expiresAt).toLocaleDateString("en-GB")
            : "គ្មានកំណត់";
          return `<tr style="border-bottom: 1px solid var(--border);"><td style="font-weight:900; color:var(--primary); font-size:1.1rem; letter-spacing:1.5px;">${p.code}</td><td style="color:#10b981; font-weight:bold; font-size:1.1rem;">$${p.rewardValue.toFixed(2)}</td><td><b>${usage} នាក់</b><br><span style="font-size:0.8rem; color:var(--text-muted);">ផុតកំណត់: ${expiry}</span></td><td>${status}</td><td style="text-align: right;"><label class="switch"><input type="checkbox" ${p.isActive ? "checked" : ""} onchange="togglePromoStatus('${p._id}')"><span class="slider"></span></label></td></tr>`;
        })
        .join("");
    } else {
      tbody.innerHTML =
        '<tr><td colspan="5" style="text-align:center; padding:40px; color:var(--text-muted);"><i class="fa-solid fa-ticket" style="font-size:2rem; margin-bottom:10px; opacity:0.5;"></i><br>មិនទាន់មានកូដប្រូម៉ូសិននៅឡើយទេ</td></tr>';
    }
  } catch (e) {}
}

async function togglePromoStatus(id) {
  await fetch("/api/admin/promo/toggle", {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ id }),
  });
  loadPromoCodes();
}

// ==========================================
// 4. Cashier (បេឡាករ) Logic - ភ្ជាប់ API ពិតប្រាកដ
// ==========================================
let currentTargetUser = null;
let currentDepositorUser = null;

// ១. បិទ/បើក ប្រអប់ "អ្នកផ្សេងដាក់ឱ្យ"
function toggleDepositorType() {
  const type = document.querySelector(
    'input[name="depositorType"]:checked',
  ).value;
  const otherDiv = document.getElementById("otherDepositorDiv");
  if (type === "other") {
    otherDiv.style.display = "block";
  } else {
    otherDiv.style.display = "none";
    currentDepositorUser = null;
    document.getElementById("depositorSearch").value = "";
    document.getElementById("depositorName").style.display = "none";
  }
}

// ២. ស្វែងរកអ្នកទទួលប្រាក់ (ហៅ API)
async function searchTargetUser() {
  const searchValue = document.getElementById("targetUserSearch").value.trim();
  if (!searchValue)
    return Swal.fire("បំរាម", "សូមវាយលេខគណនី ឬ Username", "warning");

  Swal.fire({ title: "កំពុងស្វែងរក...", didOpen: () => Swal.showLoading() });

  try {
    const res = await fetch(`/api/admin/cashier/search/${searchValue}`, {
      method: "GET",
      headers: getAuthHeaders(),
    });
    const result = await res.json();
    Swal.close();

    if (result.success) {
      currentTargetUser = result.data;

      // បង្ហាញទិន្នន័យលើកាត
      document.getElementById("cardName").innerText =
        `${currentTargetUser.fullName} (@${currentTargetUser.username})`;
      document.getElementById("cardBalUSD").innerText =
        `USD: $${currentTargetUser.balanceUSD.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
      document.getElementById("cardBalKHR").innerText =
        `KHR: ៛${currentTargetUser.balanceKHR.toLocaleString("en-US")}`;

      document.getElementById("targetUserCard").style.display = "flex";
      document.getElementById("transactionForm").style.display = "block";
    } else {
      Swal.fire("រកមិនឃើញ", result.message, "error");
      document.getElementById("targetUserCard").style.display = "none";
      document.getElementById("transactionForm").style.display = "none";
      currentTargetUser = null;
    }
  } catch (error) {
    Swal.close();
    Swal.fire("Error", "បញ្ហាភ្ជាប់ទៅកាន់ Server", "error");
  }
}

// ៣. ឆែកឈ្មោះអ្នកដាក់ឱ្យ (ហៅ API)
async function verifyDepositor() {
  const val = document.getElementById("depositorSearch").value.trim();
  const nameText = document.getElementById("depNameText");

  if (val.length >= 3) {
    document.getElementById("depositorName").style.display = "block";
    nameText.innerText = "កំពុងស្វែងរក...";
    nameText.style.color = "#475569";

    try {
      const res = await fetch(`/api/admin/cashier/search/${val}`, {
        method: "GET",
        headers: getAuthHeaders(),
      });
      const result = await res.json();

      if (result.success) {
        currentDepositorUser = result.data;
        nameText.innerText = `${currentDepositorUser.fullName} (@${currentDepositorUser.username})`;
        nameText.style.color = "#16a34a"; // ពណ៌បៃតងពេលរកឃើញ
      } else {
        currentDepositorUser = null;
        nameText.innerText = "រកមិនឃើញគណនីនេះទេ!";
        nameText.style.color = "#ef4444"; // ពណ៌ក្រហមពេលរកមិនឃើញ
      }
    } catch (error) {
      nameText.innerText = "Error Network";
    }
  } else {
    document.getElementById("depositorName").style.display = "none";
    currentDepositorUser = null;
  }
}

// ៤. មើល KYC
function viewKYC() {
  if (!currentTargetUser || !currentTargetUser.kycImage) {
    return Swal.fire("ព័ត៌មាន", "អតិថិជននេះមិនទាន់មានរូប KYC ទេ", "info");
  }
  Swal.fire({
    title: `អត្តសញ្ញាណប័ណ្ណរបស់ ${currentTargetUser.fullName}`,
    imageUrl: currentTargetUser.kycImage, // ទាញរូបពី Database ពិត
    imageWidth: 400,
    imageAlt: "KYC Image",
  });
}

// ៥. ពេលចុចប៊ូតុងបញ្ជាក់ការដាក់ប្រាក់ (បញ្ជូនទិន្នន័យទៅ Backend)
async function processCashTransaction() {
  const type = document.querySelector(
    'input[name="depositorType"]:checked',
  ).value;

  // 🔥 បន្ថែមការចាប់យកលេខគណនីដែល Admin បានរើស (Main ឬ កុងរង)
  const targetAccountElement = document.getElementById("targetAccountSelect");
  const targetAccount = targetAccountElement
    ? targetAccountElement.value
    : null;

  const currency = document.getElementById("cashCurrency").value;
  const amount = document.getElementById("cashAmount").value;
  let remark = document.getElementById("cashRemark").value.trim();

  // លក្ខខណ្ឌត្រួតពិនិត្យ
  if (!amount || amount <= 0)
    return Swal.fire(
      "កំហុស",
      "សូមបញ្ចូលចំនួនទឹកប្រាក់ឱ្យបានត្រឹមត្រូវ",
      "error",
    );

  // 🔥 បន្ថែមការត្រួតពិនិត្យថាបានរើសកុងហើយឬនៅ
  if (!targetAccount)
    return Swal.fire(
      "កំហុស",
      "សូមជ្រើសរើសគណនី (Main ឬ កុងរង) ដែលត្រូវទទួលប្រាក់សិន",
      "error",
    );

  if (type === "other" && !currentDepositorUser)
    return Swal.fire(
      "កំហុស",
      "សូមស្វែងរកគណនីអ្នកដាក់ប្រាក់ឱ្យបានត្រឹមត្រូវ",
      "error",
    );

  // កំណត់ Remark ស្វ័យប្រវត្តិ
  if (!remark) {
    if (type === "self") {
      remark = `ដាក់ប្រាក់ដោយម្ចាស់គណនី (${currentTargetUser.fullName})`;
    } else {
      remark = `ដាក់ប្រាក់ដោយ ${currentDepositorUser.fullName} ជូនទៅ ${currentTargetUser.fullName}`;
    }
  }

  // បង្ហាញលេខកុងនៅក្នុងផ្ទាំងបញ្ជាក់ (Swal) ឱ្យកាន់តែច្បាស់
  Swal.fire({
    title: "បញ្ជាក់ការដាក់ប្រាក់",
    html: `អ្នកកំពុងដាក់ប្រាក់ <b>${currency === "USD" ? "$" : "៛"}${amount}</b> <br>ចូលទៅគណនី <b>${targetAccount}</b> របស់ <b>@${currentTargetUser.username}</b> <br><br> <i>ចំណាំ៖ ${remark}</i>`,
    icon: "question",
    showCancelButton: true,
    confirmButtonColor: "#10b981",
    confirmButtonText: "យល់ព្រមដាក់ប្រាក់",
  }).then(async (result) => {
    if (result.isConfirmed) {
      Swal.fire({
        title: "កំពុងដំណើរការ...",
        didOpen: () => Swal.showLoading(),
      });

      try {
        const res = await fetch("/api/admin/cashier/transaction", {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            targetUsername: currentTargetUser.username,
            targetAccount: targetAccount, // 🔥 បញ្ជូនលេខគណនីដែលបានរើសទៅកាន់ Backend
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
          Swal.fire("ជោគជ័យ!", data.message, "success");

          // Clear ទិន្នន័យចេញពី Form ពេលជោគជ័យ
          document.getElementById("cashAmount").value = "";
          document.getElementById("cashRemark").value = "";
          document.getElementById("depositorSearch").value = "";
          document.getElementById("targetUserSearch").value = "";
          if (targetAccountElement) targetAccountElement.value = ""; // Clear Dropdown
          document.getElementById("targetUserCard").style.display = "none";
          document.getElementById("transactionForm").style.display = "none";
          currentTargetUser = null;
          currentDepositorUser = null;
        } else {
          Swal.fire("បរាជ័យ", data.message, "error");
        }
      } catch (error) {
        Swal.fire("Error", "បញ្ហាភ្ជាប់ទៅកាន់ Server", "error");
      }
    }
  });
}
