// ========================================================================
// ឯកសារ: admin-fees.js
// អត្ថន័យ: គ្រប់គ្រងកម្រៃសេវា និងដែនកំណត់ផ្ទេរប្រាក់ (Fees & Limits)
// ========================================================================

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
    } else {
      Swal.fire({
        icon: "error",
        title: "បរាជ័យ",
        text: data.message,
        customClass: { popup: "premium-swal" },
      });
    }
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
