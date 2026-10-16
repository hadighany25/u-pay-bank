// ========================================================================
// ឯកសារ: admin-fees.js (100% Pro Redesign - Tiered Fee & Limit Policy Engine)
// អត្ថន័យ: គ្រប់គ្រងកម្រៃសេវា និងដែនកំណត់ផ្ទេរប្រាក់ (Bi-Directional USD ⇄ KHR + Simulator)
// ========================================================================

let feeTiersList = [];

function getCurrentFXRate() {
  return window.currentFXRates && window.currentFXRates.usdToKhrSell
    ? parseFloat(window.currentFXRates.usdToKhrSell)
    : 4100;
}

window.loadFeeSettings = async function (showToast = false) {
  const spinIcon = document.getElementById("afees-refresh-icon");
  if (spinIcon) spinIcon.classList.add("fa-spin");

  try {
    const res = await fetch("/api/admin/fees", { headers: getAuthHeaders() });
    const data = await res.json();
    if (data.success) {
      const limitEl = document.getElementById("dailyTrxLimit");
      if (limitEl) limitEl.value = data.transferLimit || 5000;
      feeTiersList = Array.isArray(data.feeTiers) ? data.feeTiers : [];
      renderFeeTiers();

      if (showToast) {
        Swal.fire({
          toast: true,
          position: "top-end",
          icon: "success",
          title: "ទាញយកការកំណត់ថ្លៃសេវាជោគជ័យ!",
          showConfirmButton: false,
          timer: 1300,
          customClass: { popup: "kh-text" },
        });
      }
    }
  } catch (e) {
    console.error("Error loading fees:", e);
  } finally {
    if (spinIcon) spinIcon.classList.remove("fa-spin");
  }
};

window.formatDecimal = function (input) {
  let val = String(input.value || "").replace(/,/g, ".");
  val = val.replace(/[^0-9.]/g, "");
  if ((val.match(/\./g) || []).length > 1) {
    val = val.substring(0, val.lastIndexOf("."));
  }
  input.value = val;
  return val;
};

window.onDailyLimitInputChange = function () {
  updateFeePolicyKpis();
  runLiveFeeSimulator();
};

window.setQuickDailyLimit = function (usdAmount) {
  const el = document.getElementById("dailyTrxLimit");
  if (el) {
    el.value = usdAmount;
    onDailyLimitInputChange();
  }
};

function updateFeePolicyKpis() {
  const limitUsd =
    parseFloat(document.getElementById("dailyTrxLimit")?.value) || 0;
  const fxRate = getCurrentFXRate();
  const limitKhr = Math.round(limitUsd * fxRate);

  const setTxt = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.innerText = val;
  };

  setTxt("afees-kpi-limit-usd", `$${limitUsd.toLocaleString("en-US")}`);
  setTxt("afees-kpi-limit-khr", `${limitKhr.toLocaleString("en-US")} ៛`);
  setTxt(
    "afees-limit-khr-sub",
    `សមមូលប្រាក់រៀល (តាមអត្រា ${fxRate}៛)៖ ${limitKhr.toLocaleString("en-US")} ៛ / ថ្ងៃ`,
  );
  setTxt("afees-kpi-tiers-count", `${feeTiersList.length} កម្រិត`);

  if (feeTiersList.length > 0) {
    const fees = feeTiersList.map((t) => parseFloat(t.fee) || 0);
    const minFee = Math.min(...fees);
    const maxFee = Math.max(...fees);
    setTxt(
      "afees-kpi-fee-range",
      `$${minFee.toFixed(2)} - $${maxFee.toFixed(2)}`,
    );
  } else {
    setTxt("afees-kpi-fee-range", "$0.00 (ឥតគិតថ្លៃ)");
  }
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

  updateFeePolicyKpis();
  runLiveFeeSimulator();
};

window.renderFeeTiers = function () {
  const tbody = document.getElementById("feeTiersBody");
  if (!tbody) return;

  const currentRate = getCurrentFXRate();

  if (!feeTiersList || feeTiersList.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 45px 20px; color: var(--text-muted);">
          <i class="fa-solid fa-hand-holding-dollar" style="font-size: 2.5rem; opacity: 0.3; margin-bottom: 10px; display: block;"></i>
          <div style="font-weight: 800; color: var(--text-main);">មិនទាន់មានកម្រិតថ្លៃសេវាទេ (ផ្ទេរប្រាក់ឥតគិតថ្លៃ $0.00)</div>
          <div style="font-size: 0.82rem; margin-top: 4px;">សូមចុចប៊ូតុង "បន្ថែមកម្រិតថ្មី (Add Tier)" ខាងលើ ដើម្បីកំណត់ថ្លៃសេវា។</div>
        </td>
      </tr>
    `;
    updateFeePolicyKpis();
    runLiveFeeSimulator();
    return;
  }

  tbody.innerHTML = feeTiersList
    .map((tier, index) => {
      const minUsd = parseFloat(tier.min) || 0;
      const maxUsd = parseFloat(tier.max) || 0;
      const feeUsd = parseFloat(tier.fee) || 0;

      const minKhr = Math.round(minUsd * currentRate);
      const maxKhr = Math.round(maxUsd * currentRate);
      const feeKhr = Math.round(feeUsd * currentRate);

      return `
        <tr style="border-bottom: 1px solid var(--border, #e2e8f0); transition: 0.15s;" onmouseover="this.style.background='rgba(15, 23, 42, 0.015)'" onmouseout="this.style.background='transparent'">
          <!-- ១. លេខរៀងកម្រិត -->
          <td style="padding: 14px 12px;">
            <span style="background: rgba(13, 148, 136, 0.12); color: #0d9488; border: 1px solid rgba(13, 148, 136, 0.3); padding: 4px 10px; border-radius: 8px; font-weight: 900; font-size: 0.78rem; font-family: 'JetBrains Mono', monospace;">
              TIER #${index + 1}
            </span>
          </td>

          <!-- ២. ចាប់ពីចំនួន (Min USD & KHR) -->
          <td style="padding: 14px 12px;">
            <div class="afees-dual-input-pair">
              <div class="afees-curr-box">
                <span class="afees-curr-tag" style="background: rgba(59, 130, 246, 0.14); color: #3b82f6;">$ USD</span>
                <input type="text" id="minUsd_${index}" inputmode="decimal" class="afees-tier-input" value="${minUsd}" placeholder="0.00" oninput="formatDecimal(this); syncCurrency(this, 'USD', ${index}, 'min')">
              </div>
              <div class="afees-curr-box">
                <span class="afees-curr-tag" style="background: rgba(16, 185, 129, 0.14); color: #10b981;">៛ KHR</span>
                <input type="text" id="minKhr_${index}" inputmode="decimal" class="afees-tier-input" value="${minKhr}" placeholder="0" oninput="formatDecimal(this); syncCurrency(this, 'KHR', ${index}, 'min')">
              </div>
            </div>
          </td>

          <!-- ៣. រហូតដល់ចំនួន (Max USD & KHR) -->
          <td style="padding: 14px 12px;">
            <div class="afees-dual-input-pair">
              <div class="afees-curr-box">
                <span class="afees-curr-tag" style="background: rgba(59, 130, 246, 0.14); color: #3b82f6;">$ USD</span>
                <input type="text" id="maxUsd_${index}" inputmode="decimal" class="afees-tier-input" value="${maxUsd}" placeholder="0.00" oninput="formatDecimal(this); syncCurrency(this, 'USD', ${index}, 'max')">
              </div>
              <div class="afees-curr-box">
                <span class="afees-curr-tag" style="background: rgba(16, 185, 129, 0.14); color: #10b981;">៛ KHR</span>
                <input type="text" id="maxKhr_${index}" inputmode="decimal" class="afees-tier-input" value="${maxKhr}" placeholder="0" oninput="formatDecimal(this); syncCurrency(this, 'KHR', ${index}, 'max')">
              </div>
            </div>
          </td>

          <!-- ៤. ថ្លៃសេវា (Fee USD & KHR) -->
          <td style="padding: 14px 12px;">
            <div class="afees-dual-input-pair">
              <div class="afees-curr-box" style="border-color: rgba(245, 158, 11, 0.45);">
                <span class="afees-curr-tag" style="background: rgba(245, 158, 11, 0.18); color: #d97706;">FEE $</span>
                <input type="text" id="feeUsd_${index}" inputmode="decimal" class="afees-tier-input" style="color: #d97706;" value="${feeUsd}" placeholder="0.00" oninput="formatDecimal(this); syncCurrency(this, 'USD', ${index}, 'fee')">
              </div>
              <div class="afees-curr-box">
                <span class="afees-curr-tag" style="background: rgba(148, 163, 184, 0.18); color: var(--text-muted);">FEE ៛</span>
                <input type="text" id="feeKhr_${index}" inputmode="decimal" class="afees-tier-input" value="${feeKhr}" placeholder="0" oninput="formatDecimal(this); syncCurrency(this, 'KHR', ${index}, 'fee')">
              </div>
            </div>
          </td>

          <!-- ៥. ប៊ូតុងលុប -->
          <td style="padding: 14px 12px; text-align: right;">
            <button type="button" onclick="removeTier(${index})" title="លុបកម្រិតនេះ" style="background: rgba(239, 68, 68, 0.12); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); width: 36px; height: 36px; border-radius: 10px; cursor: pointer; transition: 0.2s;">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </td>
        </tr>
      `;
    })
    .join("");

  updateFeePolicyKpis();
  runLiveFeeSimulator();
};

window.addFeeTier = function () {
  let nextMin = 0;
  if (feeTiersList.length > 0) {
    const lastMax = parseFloat(feeTiersList[feeTiersList.length - 1].max) || 0;
    nextMin = lastMax > 0 ? Number((lastMax + 0.01).toFixed(2)) : 0;
  }
  const nextMax = nextMin > 0 ? Math.round(nextMin + 500) : 100;
  feeTiersList.push({ min: nextMin, max: nextMax, fee: 0.5 });
  renderFeeTiers();
};

window.removeTier = function (index) {
  feeTiersList.splice(index, 1);
  renderFeeTiers();
};

window.sortAndCleanFeeTiers = function () {
  feeTiersList.sort(
    (a, b) => (parseFloat(a.min) || 0) - (parseFloat(b.min) || 0),
  );
  renderFeeTiers();
};

// ឧបករណ៍សាកល្បងគណនាថ្លៃសេវាផ្ទាល់ (Live Fee Simulator)
window.runLiveFeeSimulator = function () {
  const testAmt =
    parseFloat(document.getElementById("afeesSimAmount")?.value) || 0;
  const dailyLimit =
    parseFloat(document.getElementById("dailyTrxLimit")?.value) || 5000;
  const fxRate = getCurrentFXRate();

  const tierEl = document.getElementById("afeesSimTierMatched");
  const totalEl = document.getElementById("afeesSimTotalDeduct");
  const feeEl = document.getElementById("afeesSimFeeVal");
  const boxEl = document.getElementById("afeesSimResultBox");
  if (!tierEl || !totalEl || !feeEl || !boxEl) return;

  if (testAmt > dailyLimit) {
    boxEl.style.borderColor = "#ef4444";
    boxEl.style.background = "rgba(239, 68, 68, 0.08)";
    tierEl.innerHTML = `<span style="color:#ef4444;"><i class="fa-solid fa-triangle-exclamation"></i> លើសដែនកំណត់ប្រចាំថ្ងៃ ($${dailyLimit.toLocaleString("en-US")})</span>`;
    feeEl.style.color = "#ef4444";
    feeEl.innerText = "BLOCKED";
    totalEl.innerText = "ប្រតិបត្តិការនឹងត្រូវបដិសេធដោយប្រព័ន្ធ";
    return;
  }

  boxEl.style.borderColor = "#10b981";
  boxEl.style.background = "rgba(16, 185, 129, 0.08)";
  feeEl.style.color = "#10b981";

  let matchedFee = 0;
  let matchedIndex = -1;

  for (let i = 0; i < feeTiersList.length; i++) {
    const min = parseFloat(feeTiersList[i].min) || 0;
    const max = parseFloat(feeTiersList[i].max) || 0;
    if (testAmt >= min && testAmt <= max) {
      matchedFee = parseFloat(feeTiersList[i].fee) || 0;
      matchedIndex = i;
      break;
    }
  }

  const feeKhr = Math.round(matchedFee * fxRate);
  const totalUsd = testAmt + matchedFee;

  if (matchedIndex !== -1) {
    tierEl.innerText = `ត្រូវនឹងកម្រិត TIER #${matchedIndex + 1} ($${feeTiersList[matchedIndex].min} - $${feeTiersList[matchedIndex].max})`;
  } else {
    tierEl.innerText = `ក្រៅចន្លោះកម្រិត (ឥតគិតថ្លៃសេវា $0.00)`;
  }

  feeEl.innerText = `$${matchedFee.toFixed(2)} (${feeKhr.toLocaleString("en-US")} ៛)`;
  totalEl.innerText = `សរុបត្រូវកាត់ពីគណនី៖ $${totalUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

window.saveFeeSettings = async function () {
  const limit =
    parseFloat(document.getElementById("dailyTrxLimit")?.value) || 0;
  if (limit <= 0) {
    return Swal.fire({
      icon: "warning",
      title: "ដែនកំណត់មិនត្រឹមត្រូវ",
      text: "សូមបញ្ចូលពិដានទឹកប្រាក់ប្រចាំថ្ងៃធំជាង $0!",
      customClass: { popup: "kh-text" },
    });
  }

  const cleanTiers = feeTiersList
    .map((t) => ({
      min: parseFloat(t.min) || 0,
      max: parseFloat(t.max) || 0,
      fee: parseFloat(t.fee) || 0,
    }))
    .sort((a, b) => a.min - b.min);

  for (let i = 0; i < cleanTiers.length; i++) {
    if (cleanTiers[i].max < cleanTiers[i].min) {
      return Swal.fire({
        icon: "warning",
        title: `កម្រិត TIER #${i + 1} មិនត្រឹមត្រូវ`,
        text: `ចំនួនទឹកប្រាក់ "រហូតដល់ ($${cleanTiers[i].max})" មិនអាចតូចជាង "ចាប់ពី ($${cleanTiers[i].min})" បានទេ!`,
        customClass: { popup: "kh-text" },
      });
    }
  }

  try {
    Swal.fire({
      title: "កំពុងរក្សាទុកការកំណត់...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
      customClass: { popup: "premium-swal kh-text" },
    });

    const res = await fetch("/api/admin/fees", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ transferLimit: limit, feeTiers: cleanTiers }),
    });
    const data = await res.json();

    if (data.success) {
      await loadFeeSettings();
      Swal.fire({
        icon: "success",
        title: "រក្សាទុកជោគជ័យ!",
        text:
          data.message ||
          "ដែនកំណត់ និងតារាងថ្លៃសេវាត្រូវបានធ្វើបច្ចុប្បន្នភាព!",
        timer: 1600,
        showConfirmButton: false,
        customClass: { popup: "premium-swal kh-text" },
      });
    } else {
      Swal.fire({
        icon: "error",
        title: "បរាជ័យ",
        text: data.message,
        customClass: { popup: "premium-swal kh-text" },
      });
    }
  } catch (err) {
    Swal.fire({
      icon: "error",
      title: "Error",
      text: "បញ្ហាភ្ជាប់ទៅកាន់ Server",
      customClass: { popup: "premium-swal kh-text" },
    });
  }
};

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(loadFeeSettings, 900);
});
