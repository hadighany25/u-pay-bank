// ========================================================================
// ឯកសារ: admin-fx.js (100% Pro 4-Card Carousel + NBC Weekly Auto-Sync)
// អត្ថន័យ: គ្រប់គ្រងអត្រាប្តូរប្រាក់ USD ⇄ KHR, តារាងរូបិយប័ណ្ណអន្តរជាតិ និង NBC Sync
// ========================================================================

window.currentFXRates = {
  usdToKhrBuy: 4050,
  usdToKhrSell: 4100,
  autoWeeklySync: true,
  lastNbcSyncAt: null,
  multiCurrencies: [],
};

// តារាងរូបិយប័ណ្ណអន្តរជាតិស្តង់ដារទាំង ៨ (ប្រើកូដប្រទេស c1, c2 សម្រាប់ទាញរូបទង់ជាតិ HD)
const DEFAULT_MULTI_CURRENCIES = [
  {
    code: "USD/KHR",
    c1: "us",
    c2: "kh",
    name: "ដុល្លារអាមេរិក ⇄ រៀលខ្មែរ",
    unit: "1 USD",
    buy: 4050,
    sell: 4100,
    quote: "៛",
    change: "+0.12%",
    trend: "up",
    isCore: true,
  },
  {
    code: "THB/KHR",
    c1: "th",
    c2: "kh",
    name: "បាតថៃ ⇄ រៀលខ្មែរ",
    unit: "1 THB",
    buy: 118.5,
    sell: 121.0,
    quote: "៛",
    change: "+0.25%",
    trend: "up",
  },
  {
    code: "CNY/KHR",
    c1: "cn",
    c2: "kh",
    name: "យន់ចិន ⇄ រៀលខ្មែរ",
    unit: "1 CNY",
    buy: 562.0,
    sell: 575.0,
    quote: "៛",
    change: "-0.08%",
    trend: "down",
  },
  {
    code: "EUR/KHR",
    c1: "eu",
    c2: "kh",
    name: "អឺរ៉ូ ⇄ រៀលខ្មែរ",
    unit: "1 EUR",
    buy: 4380,
    sell: 4460,
    quote: "៛",
    change: "+0.31%",
    trend: "up",
  },
  {
    code: "SGD/KHR",
    c1: "sg",
    c2: "kh",
    name: "ដុល្លារសិង្ហបុរី ⇄ រៀលខ្មែរ",
    unit: "1 SGD",
    buy: 3015,
    sell: 3075,
    quote: "៛",
    change: "+0.15%",
    trend: "up",
  },
  {
    code: "VND/KHR",
    c1: "vn",
    c2: "kh",
    name: "ដុងវៀតណាម ⇄ រៀលខ្មែរ",
    unit: "1,000 VND",
    buy: 161.0,
    sell: 166.5,
    quote: "៛",
    change: "-0.05%",
    trend: "down",
  },
  {
    code: "AUD/KHR",
    c1: "au",
    c2: "kh",
    name: "ដុល្លារអូស្ត្រាលី ⇄ រៀលខ្មែរ",
    unit: "1 AUD",
    buy: 2680,
    sell: 2740,
    quote: "៛",
    change: "+0.19%",
    trend: "up",
  },
  {
    code: "JPY/KHR",
    c1: "jp",
    c2: "kh",
    name: "យ៉េនជប៉ុន ⇄ រៀលខ្មែរ",
    unit: "100 JPY",
    buy: 2690,
    sell: 2755,
    quote: "៛",
    change: "-0.14%",
    trend: "down",
  },
];

let activeMultiCurrencies = JSON.parse(
  JSON.stringify(DEFAULT_MULTI_CURRENCIES),
);
let currentCarouselGroup = 0; // 0 = ក្រុមទី ១ (កាត 1-4), 1 = ក្រុមទី ២ (កាត 5-8)
let fxCarouselTimer = null;

// បង្កើត HTML រូបទង់ជាតិភ្លោះច្បាស់ៗ (HD Flag Pair)
function renderFlagPairHtml(c1 = "us", c2 = "kh") {
  const code1 = String(c1 || "us").toLowerCase();
  const code2 = String(c2 || "kh").toLowerCase();
  return `
    <div class="afx-flag-pair">
      <img src="https://flagcdn.com/w40/${code1}.png" class="afx-flag-img-1" alt="${code1}">
      <img src="https://flagcdn.com/w40/${code2}.png" class="afx-flag-img-2" alt="${code2}">
    </div>
  `;
}

// ភ្ជាប់កូដប្រទេសសម្រាប់ទិន្នន័យចាស់ដែលមិនទាន់មាន c1, c2
function normalizeCurrencyFlags(list) {
  const flagMap = {
    "USD/KHR": ["us", "kh"],
    "THB/KHR": ["th", "kh"],
    "CNY/KHR": ["cn", "kh"],
    "EUR/KHR": ["eu", "kh"],
    "SGD/KHR": ["sg", "kh"],
    "VND/KHR": ["vn", "kh"],
    "AUD/KHR": ["au", "kh"],
    "JPY/KHR": ["jp", "kh"],
  };
  return list.map((item) => {
    const pair = flagMap[item.code] || ["us", "kh"];
    return {
      ...item,
      c1: item.c1 || pair[0],
      c2: item.c2 || pair[1],
    };
  });
}

// ========================================================================
// 🔄 SECTION 1: FETCH & SYNC FX RATES FROM SERVER
// ========================================================================

window.fetchFXRates = async function (showToast = false) {
  const spinIcon = document.getElementById("afx-refresh-icon");
  if (spinIcon) spinIcon.classList.add("fa-spin");

  try {
    const res = await fetch("/api/admin/fx/rates", {
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (data.success && data.rates) {
      window.currentFXRates = data.rates;
      const buyVal = parseFloat(data.rates.usdToKhrBuy) || 4050;
      const sellVal = parseFloat(data.rates.usdToKhrSell) || 4100;

      const buyInput = document.getElementById("fxBuy");
      const sellInput = document.getElementById("fxSell");
      if (buyInput) buyInput.value = buyVal;
      if (sellInput) sellInput.value = sellVal;

      const autoCheck = document.getElementById("afxAutoWeeklySyncCheck");
      if (autoCheck) {
        autoCheck.checked = data.rates.autoWeeklySync !== false;
      }

      if (
        Array.isArray(data.rates.multiCurrencies) &&
        data.rates.multiCurrencies.length >= 4
      ) {
        activeMultiCurrencies = normalizeCurrencyFlags(
          data.rates.multiCurrencies,
        );
      } else {
        activeMultiCurrencies = JSON.parse(
          JSON.stringify(DEFAULT_MULTI_CURRENCIES),
        );
      }

      if (activeMultiCurrencies[0]) {
        activeMultiCurrencies[0].buy = buyVal;
        activeMultiCurrencies[0].sell = sellVal;
      }

      // បង្ហាញកាលបរិច្ឆេទ Sync ចុងក្រោយលើផ្លាក
      const metaBadge = document.getElementById("afx-sync-meta-badge");
      if (metaBadge) {
        if (data.rates.lastNbcSyncAt) {
          const dStr = new Date(data.rates.lastNbcSyncAt).toLocaleDateString(
            "en-GB",
            { day: "2-digit", month: "short", year: "numeric" },
          );
          metaBadge.innerText = `NBC Sync ចុងក្រោយ៖ ${dStr}`;
        } else {
          metaBadge.innerText = `Auto-Sync រៀងរាល់ ៧ ថ្ងៃម្ដង`;
        }
      }

      renderFxDashboardUI();
      if (typeof renderFeeTiers === "function") renderFeeTiers();

      if (showToast) {
        Swal.fire({
          toast: true,
          position: "top-end",
          icon: "success",
          title: "ទាញយកអត្រាប្តូរប្រាក់បច្ចុប្បន្នជោគជ័យ!",
          showConfirmButton: false,
          timer: 1300,
          customClass: { popup: "kh-text" },
        });
      }
    }
  } catch (e) {
    console.error("Error loading FX rates:", e);
  } finally {
    if (spinIcon) spinIcon.classList.remove("fa-spin");
  }
};

// 🏦 ប៊ូតុងចុចទាញអត្រាប្តូរប្រាក់ពីធនាគារជាតិភ្លាមៗ (Sync NBC Now)
window.syncFromNationalBank = async function () {
  const icon = document.getElementById("afx-nbc-sync-icon");
  if (icon) icon.classList.add("fa-bounce");

  Swal.fire({
    title: "កំពុងទាញអត្រាប្តូរប្រាក់ពីធនាគារជាតិ...",
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading(),
    customClass: { popup: "premium-swal kh-text" },
  });

  try {
    const res = await fetch("/api/admin/fx/sync-nbc", {
      method: "POST",
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (data.success) {
      await fetchFXRates();
      Swal.fire({
        icon: "success",
        title: "ធ្វើបច្ចុប្បន្នភាពតាមធនាគារជាតិជោគជ័យ!",
        text: data.message,
        timer: 2200,
        showConfirmButton: false,
        customClass: { popup: "premium-swal kh-text" },
      });
    } else {
      Swal.fire({
        icon: "error",
        title: "បរាជ័យ",
        text: data.message || "មិនអាចទាញទិន្នន័យបានទេ",
        customClass: { popup: "premium-swal kh-text" },
      });
    }
  } catch (err) {
    Swal.fire("Error", "មានបញ្ហាតភ្ជាប់ទៅកាន់ Server", "error");
  } finally {
    if (icon) icon.classList.remove("fa-bounce");
  }
};

// ========================================================================
// 🎨 SECTION 2: 4-CARD ROTATING CAROUSEL & MULTI-CURRENCY BOARD
// ========================================================================

function renderFxDashboardUI() {
  const buyVal =
    parseFloat(document.getElementById("fxBuy")?.value) ||
    window.currentFXRates.usdToKhrBuy ||
    4050;
  const sellVal =
    parseFloat(document.getElementById("fxSell")?.value) ||
    window.currentFXRates.usdToKhrSell ||
    4100;

  const spread = sellVal - buyVal;
  const midRate = (buyVal + sellVal) / 2;
  const spreadPct = buyVal > 0 ? ((spread / buyVal) * 100).toFixed(2) : "0.00";

  const setTxt = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.innerText = val;
  };
  setTxt("afx-kpi-buy", `${buyVal.toLocaleString("en-US")} ៛`);
  setTxt("afx-kpi-sell", `${sellVal.toLocaleString("en-US")} ៛`);
  setTxt(
    "afx-kpi-spread",
    `${spread.toLocaleString("en-US")} ៛ (${spreadPct}%)`,
  );
  setTxt("afx-kpi-mid", `${midRate.toLocaleString("en-US")} ៛`);

  if (activeMultiCurrencies[0]) {
    activeMultiCurrencies[0].buy = buyVal;
    activeMultiCurrencies[0].sell = sellVal;
  }

  render4CardCarousel();
  renderMultiCurrencyTable();
  runFxSimulator();
}

// ✈️ បង្ហាញម្ដង ៤ កាតពេញទទឹង ១០០% ជាមួយចលនាទឹករលកព្រលានយន្តហោះ (Airport Wave Flip)
function render4CardCarousel(animateWave = false) {
  const track = document.getElementById("afx-live-ticker-track");
  if (!track) return;

  const startIndex = currentCarouselGroup * 4;
  const fourItems = activeMultiCurrencies.slice(startIndex, startIndex + 4);

  document
    .getElementById("afx-carousel-btn-0")
    ?.classList.toggle("active", currentCarouselGroup === 0);
  document
    .getElementById("afx-carousel-btn-1")
    ?.classList.toggle("active", currentCarouselGroup === 1);

  track.innerHTML = fourItems
    .map((c, idx) => {
      const isUp = c.trend !== "down";
      const trendColor = isUp ? "#34d399" : "#f87171";
      const trendBg = isUp
        ? "rgba(16, 185, 129, 0.15)"
        : "rgba(239, 68, 68, 0.15)";
      const trendIcon = isUp ? "fa-caret-up" : "fa-caret-down";

      // 🌊 កំណត់ Delay ជាទឹករលកពីកាតទី ១ ដល់កាតទី ៤ (0ms, 95ms, 190ms, 285ms)
      const waveClass = animateWave ? "wave-flip-in" : "";
      const waveDelayStyle = animateWave
        ? `animation-delay: ${idx * 95}ms;`
        : "";

      return `
        <div class="afx-ticker-card ${waveClass}" id="afx-ticker-chip-${idx}" style="${waveDelayStyle}">
          ${renderFlagPairHtml(c.c1, c.c2)}
          <div style="flex: 1; min-width: 0;">
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 6px;">
              <span style="font-size: 0.95rem; font-weight: 900; color: #f8fafc; letter-spacing: 0.5px;">${c.code}</span>
              <span style="font-size: 0.74rem; font-weight: 800; color: ${trendColor}; background: ${trendBg}; padding: 2px 8px; border-radius: 6px; white-space: nowrap;">
                <i class="fa-solid ${trendIcon}"></i> ${c.change || "+0.10%"}
              </span>
            </div>
            <div style="font-size: 0.86rem; font-weight: 800; color: #94a3b8; display: flex; justify-content: space-between; align-items: center; gap: 8px; border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 6px;">
              <span>ទិញ: <b style="color:#34d399; font-size:0.94rem;">${Number(c.buy).toLocaleString("en-US")}</b></span>
              <span>លក់: <b style="color:#60a5fa; font-size:0.94rem;">${Number(c.sell).toLocaleString("en-US")} ${c.quote}</b></span>
            </div>
          </div>
        </div>
      `;
    })
    .join("");
}

// 🌊 ប្តូររវាងក្រុមទី ១ និងក្រុមទី ២ ដោយលោតបាត់អាចាស់ម្ដងមួយៗជាទឹករលក រួចលោតអាថ្មីមកជំនួស
let isFlippingCarousel = false;
window.switchFxCarouselPage = function (groupIndex) {
  const track = document.getElementById("afx-live-ticker-track");
  if (!track || isFlippingCarousel) return;
  isFlippingCarousel = true;

  // ១. ឱ្យកាតចាស់ទាំង ៤ បង្វិលបាត់ទៅខាងលើជាទឹករលក (ពីឆ្វេងទៅស្តាំ ម្ដងមួយៗ)
  const currentCards = track.querySelectorAll(".afx-ticker-card");
  currentCards.forEach((card, idx) => {
    card.classList.remove("wave-flip-in");
    card.style.animationDelay = `${idx * 75}ms`;
    card.classList.add("wave-flip-out");
  });

  // ២. គ្រាន់តែកាតចាស់បង្វិលផុតភ្លាម បញ្ចូលកាតថ្មីទាំង ៤ ឱ្យបង្វិលលោតចេញមកជាទឹករលកបន្តកន្ទុយគ្នា!
  setTimeout(() => {
    currentCarouselGroup = groupIndex;
    render4CardCarousel(true);
    setTimeout(() => {
      isFlippingCarousel = false;
    }, 600);
  }, 460);
};

function renderMultiCurrencyTable() {
  const tbody = document.getElementById("afxMultiCurrencyBody");
  if (!tbody) return;

  tbody.innerHTML = activeMultiCurrencies
    .map((c, idx) => {
      const spreadVal = (Number(c.sell) - Number(c.buy)).toFixed(
        Number(c.buy) < 500 ? 2 : 0,
      );
      const isUp = c.trend !== "down";

      return `
        <tr style="border-bottom: 1px solid var(--border, #e2e8f0);">
          <td style="padding: 13px 12px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              ${renderFlagPairHtml(c.c1, c.c2)}
              <div>
                <div style="font-weight: 900; font-size: 0.92rem; color: var(--text-main);">${c.code}</div>
                <div style="font-size: 0.78rem; color: var(--text-muted); font-weight: 700;">${c.name}</div>
              </div>
            </div>
          </td>
          <td style="padding: 13px 12px; font-weight: 800; font-size: 0.86rem; color: var(--text-muted);">
            ${c.unit}
          </td>
          <td style="padding: 13px 12px;">
            <div style="display: inline-flex; align-items: center; gap: 6px;">
              <input type="number" step="any" class="afx-table-input" value="${c.buy}" onchange="onMultiCurrencyCellEdit(${idx}, 'buy', this.value)" ${c.isCore ? "readonly style='opacity:0.75; cursor:not-allowed;'" : ""}>
              <span style="font-weight: 800; color: var(--text-muted);">${c.quote}</span>
            </div>
          </td>
          <td style="padding: 13px 12px;">
            <div style="display: inline-flex; align-items: center; gap: 6px;">
              <input type="number" step="any" class="afx-table-input" value="${c.sell}" onchange="onMultiCurrencyCellEdit(${idx}, 'sell', this.value)" ${c.isCore ? "readonly style='opacity:0.75; cursor:not-allowed;'" : ""}>
              <span style="font-weight: 800; color: var(--text-muted);">${c.quote}</span>
            </div>
          </td>
          <td style="padding: 13px 12px; font-weight: 800; color: #f59e0b;">
            +${spreadVal} ${c.quote}
          </td>
          <td style="padding: 13px 12px; text-align: right;">
            <span style="padding: 4px 10px; border-radius: 20px; font-size: 0.76rem; font-weight: 800; background: ${isUp ? "rgba(16, 185, 129, 0.14)" : "rgba(239, 68, 68, 0.14)"}; color: ${isUp ? "#10b981" : "#ef4444"};">
              <i class="fa-solid ${isUp ? "fa-arrow-trend-up" : "fa-arrow-trend-down"}"></i> ${c.change || "+0.10%"}
            </span>
          </td>
        </tr>
      `;
    })
    .join("");
}

// ========================================================================
// ⚡ SECTION 3: INTERACTIVE CONTROLS, SIMULATOR & LIVE PULSE ANIMATION
// ========================================================================

window.stepCoreFxRate = function (inputId, delta) {
  const el = document.getElementById(inputId);
  if (!el) return;
  const cur = parseFloat(el.value) || 4050;
  el.value = Math.max(100, cur + delta);
  onCoreFxInputChange();
};

window.applyQuickFxPreset = function (buyVal, sellVal) {
  const bEl = document.getElementById("fxBuy");
  const sEl = document.getElementById("fxSell");
  if (bEl) bEl.value = buyVal;
  if (sEl) sEl.value = sellVal;
  onCoreFxInputChange();
};

window.onCoreFxInputChange = function () {
  renderFxDashboardUI();
};

window.onMultiCurrencyCellEdit = function (index, field, val) {
  const num = parseFloat(val);
  if (isNaN(num) || num <= 0) return;
  if (activeMultiCurrencies[index]) {
    activeMultiCurrencies[index][field] = num;
    render4CardCarousel();
    renderMultiCurrencyTable();
    runFxSimulator();
  }
};

window.simulateLiveMarketPulse = function () {
  activeMultiCurrencies.forEach((c) => {
    const isUp = Math.random() > 0.42;
    c.trend = isUp ? "up" : "down";
    const pct = (Math.random() * 0.35 + 0.04).toFixed(2);
    c.change = `${isUp ? "+" : "-"}${pct}%`;
  });

  render4CardCarousel();
  renderMultiCurrencyTable();

  for (let i = 0; i < 4; i++) {
    const chip = document.getElementById(`afx-ticker-chip-${i}`);
    if (chip) {
      const item = activeMultiCurrencies[currentCarouselGroup * 4 + i];
      const isUp = item?.trend !== "down";
      chip.classList.add(isUp ? "pulse-up" : "pulse-down");
      setTimeout(() => {
        chip.classList.remove("pulse-up", "pulse-down");
      }, 850);
    }
  }
};

window.runFxSimulator = function () {
  const fromCurr = document.getElementById("afxSimFrom")?.value || "USD";
  const toCurr = document.getElementById("afxSimTo")?.value || "KHR";
  const amt = parseFloat(document.getElementById("afxSimAmount")?.value) || 0;

  const resEl = document.getElementById("afxSimResultText");
  const subEl = document.getElementById("afxSimRateSub");
  if (!resEl || !subEl) return;

  const getKhrRate = (code) => {
    if (code === "KHR") return { buy: 1, sell: 1 };
    if (code === "USD") {
      return {
        buy: parseFloat(document.getElementById("fxBuy")?.value) || 4050,
        sell: parseFloat(document.getElementById("fxSell")?.value) || 4100,
      };
    }
    const found = activeMultiCurrencies.find((item) =>
      item.code.startsWith(code),
    );
    if (!found) return { buy: 1, sell: 1 };
    const divisor = found.unit.includes("1,000")
      ? 1000
      : found.unit.includes("100")
        ? 100
        : 1;
    return {
      buy: Number(found.buy) / divisor,
      sell: Number(found.sell) / divisor,
    };
  };

  if (fromCurr === toCurr) {
    resEl.innerText = `${amt.toLocaleString("en-US")} ${toCurr}`;
    subEl.innerText = `រូបិយប័ណ្ណដូចគ្នា (1 ${fromCurr} = 1 ${toCurr})`;
    return;
  }

  const fromRate = getKhrRate(fromCurr);
  const toRate = getKhrRate(toCurr);

  const amountInKhr = amt * fromRate.buy;
  const finalOut = toCurr === "KHR" ? amountInKhr : amountInKhr / toRate.sell;

  const formattedOut =
    toCurr === "KHR" || toCurr === "VND"
      ? `${Math.round(finalOut).toLocaleString("en-US")} ${toCurr === "KHR" ? "៛" : "₫"}`
      : `${finalOut.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${toCurr}`;

  resEl.innerText = formattedOut;
  const effRate = amt > 0 ? finalOut / amt : fromRate.buy / toRate.sell;
  subEl.innerText = `អត្រាគណនា៖ 1 ${fromCurr} ≈ ${effRate > 10 ? effRate.toFixed(2) : effRate.toFixed(4)} ${toCurr}`;
};

// ========================================================================
// 💾 SECTION 4: SAVE FX RATES TO SERVER
// ========================================================================

window.updateFX = async function () {
  const buy = parseFloat(document.getElementById("fxBuy")?.value) || 0;
  const sell = parseFloat(document.getElementById("fxSell")?.value) || 0;
  const autoWeeklySync =
    document.getElementById("afxAutoWeeklySyncCheck")?.checked !== false;

  if (buy <= 0 || sell <= 0) {
    return Swal.fire({
      icon: "warning",
      title: "តម្លៃមិនត្រឹមត្រូវ",
      text: "សូមបញ្ចូលអត្រាប្តូរប្រាក់ធំជាង 0!",
      customClass: { popup: "kh-text" },
    });
  }

  if (activeMultiCurrencies[0]) {
    activeMultiCurrencies[0].buy = buy;
    activeMultiCurrencies[0].sell = sell;
  }

  try {
    Swal.fire({
      title: "កំពុងរក្សាទុកអត្រាប្តូរប្រាក់...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
      customClass: { popup: "premium-swal kh-text" },
    });

    const res = await fetch("/api/admin/fx/update", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        buy,
        sell,
        autoWeeklySync,
        multiCurrencies: activeMultiCurrencies,
      }),
    });
    const data = await res.json();

    if (data.success) {
      await fetchFXRates();
      Swal.fire({
        icon: "success",
        title: "រក្សាទុកជោគជ័យ!",
        text: "អត្រាប្តូរប្រាក់ត្រូវបានធ្វើបច្ចុប្បន្នភាពក្នុងប្រព័ន្ធ!",
        timer: 1600,
        showConfirmButton: false,
        customClass: { popup: "premium-swal kh-text" },
      });
    } else {
      Swal.fire({
        icon: "error",
        title: "បរាជ័យ!",
        text: data.message || "មិនអាចកែប្រែបានទេ",
        customClass: { popup: "premium-swal kh-text" },
      });
    }
  } catch (error) {
    Swal.fire("Error", "បញ្ហាតភ្ជាប់ទៅកាន់ Server", "error");
  }
};

// Auto-Rotate ម្ដង ៤ កាត រៀងរាល់ ៥ វិនាទីម្ដង
document.addEventListener("DOMContentLoaded", () => {
  fetchFXRates();

  if (fxCarouselTimer) clearInterval(fxCarouselTimer);
  fxCarouselTimer = setInterval(() => {
    const secFx = document.getElementById("sec-fx");
    if (secFx && secFx.style.display !== "none") {
      const nextGroup = currentCarouselGroup === 0 ? 1 : 0;
      switchFxCarouselPage(nextGroup);
    }
  }, 5000);
});
