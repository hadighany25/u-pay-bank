let feeTiersList = [];

function formatDecimal(input) {
  let val = input.value.replace(/,/g, ".");
  val = val.replace(/[^0-9.]/g, "");
  if ((val.match(/\./g) || []).length > 1)
    val = val.substring(0, val.lastIndexOf("."));
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

function renderFeeTiers() {
  const tbody = document.getElementById("feeTiersBody");
  tbody.innerHTML = "";
  const currentRate = getCurrentFXRate();
  feeTiersList.forEach((tier, index) => {
    const minKhr = Math.round((parseFloat(tier.min) || 0) * currentRate);
    const maxKhr = Math.round((parseFloat(tier.max) || 0) * currentRate);
    const feeKhr = Math.round((parseFloat(tier.fee) || 0) * currentRate);
    tbody.innerHTML += `<tr style="border-bottom: 1px dashed var(--border);"><td style="padding: 12px 10px;"><div style="display: flex; flex-direction: column; gap: 6px; align-items: center;"><div style="display: flex; align-items: center; gap: 5px;"><span style="font-size: 0.8rem; color: #64748b; font-weight:bold;">$</span><input type="text" id="minUsd_${index}" inputmode="decimal" class="form-input" style="width: 80px; text-align:center; font-weight: 600;" value="${tier.min}" placeholder="0.00" oninput="formatDecimal(this); syncCurrency(this, 'USD', ${index}, 'min')"></div><div style="display: flex; align-items: center; gap: 5px;"><span style="font-size: 0.8rem; color: #64748b; font-weight:bold;">៛</span><input type="text" id="minKhr_${index}" inputmode="decimal" class="form-input" style="width: 80px; text-align:center; font-size: 0.85rem; background: #f8fafc;" value="${minKhr}" placeholder="0 ៛" oninput="formatDecimal(this); syncCurrency(this, 'KHR', ${index}, 'min')"></div></div></td><td style="padding: 12px 10px;"><div style="display: flex; flex-direction: column; gap: 6px; align-items: center;"><div style="display: flex; align-items: center; gap: 5px;"><span style="font-size: 0.8rem; color: #64748b; font-weight:bold;">$</span><input type="text" id="maxUsd_${index}" inputmode="decimal" class="form-input" style="width: 80px; text-align:center; font-weight: 600;" value="${tier.max}" placeholder="0.00" oninput="formatDecimal(this); syncCurrency(this, 'USD', ${index}, 'max')"></div><div style="display: flex; align-items: center; gap: 5px;"><span style="font-size: 0.8rem; color: #64748b; font-weight:bold;">៛</span><input type="text" id="maxKhr_${index}" inputmode="decimal" class="form-input" style="width: 80px; text-align:center; font-size: 0.85rem; background: #f8fafc;" value="${maxKhr}" placeholder="0 ៛" oninput="formatDecimal(this); syncCurrency(this, 'KHR', ${index}, 'max')"></div></div></td><td style="padding: 12px 10px;"><div style="display: flex; flex-direction: column; gap: 6px; align-items: center;"><div style="display: flex; align-items: center; gap: 5px;"><span style="font-size: 0.8rem; color: #64748b; font-weight:bold;">$</span><input type="text" id="feeUsd_${index}" inputmode="decimal" class="form-input" style="width: 80px; text-align:center; color: #00b894; font-weight: bold;" value="${tier.fee}" placeholder="0.00" oninput="formatDecimal(this); syncCurrency(this, 'USD', ${index}, 'fee')"></div><div style="display: flex; align-items: center; gap: 5px;"><span style="font-size: 0.8rem; color: #64748b; font-weight:bold;">៛</span><input type="text" id="feeKhr_${index}" inputmode="decimal" class="form-input" style="width: 80px; text-align:center; font-size: 0.85rem; background: #f8fafc;" value="${feeKhr}" placeholder="0 ៛" oninput="formatDecimal(this); syncCurrency(this, 'KHR', ${index}, 'fee')"></div></div></td><td style="padding: 12px 10px; text-align: center; vertical-align: middle;"><button class="btn-action btn-delete" onclick="removeTier(${index})" style="background: #ef4444; color: white; border: none; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; transition: 0.2s;"><i class="fa-solid fa-trash-can"></i></button></td></tr>`;
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
    } else Swal.fire("បរាជ័យ", data.message, "error");
  } catch (err) {
    Swal.fire("Error", "បញ្ហាភ្ជាប់ទៅកាន់ Server", "error");
  }
}
setTimeout(loadFeeSettings, 1000);

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
    } else
      tbody.innerHTML =
        '<tr><td colspan="5" style="text-align:center; padding:40px; color:var(--text-muted);"><i class="fa-solid fa-ticket" style="font-size:2rem; margin-bottom:10px; opacity:0.5;"></i><br>មិនទាន់មានកូដប្រូម៉ូសិននៅឡើយទេ</td></tr>';
  } catch (e) {
    console.error(e);
  }
}
async function togglePromoStatus(id) {
  await fetch("/api/admin/promo/toggle", {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ id }),
  });
  loadPromoCodes();
}
