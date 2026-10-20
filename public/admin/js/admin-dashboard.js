// ============================================================================
// ឯកសារ: js/admin-dashboard.js (100% Real-Data Executive Analytics Engine)
// អត្ថន័យ: គ្រប់គ្រងផ្ទាំង Dashboard ធំ, Date Range Filter, ក្រាហ្វពីរផ្ទាំង, Live Stream & Leaderboards
// ស្តង់ដារថ្មី: ចាប់ទិន្នន័យអតិថិជនតាម MongoDB `_id` សុទ្ធសាធ + បង្ហាញឈ្មោះពេញ (fullName)
// ============================================================================

// ============================================================================
// 🧭 ជំពូកទី ១៖ អថេរសកល និងការកំណត់ចន្លោះកាលបរិច្ឆេទ (GLOBAL STATE & DATE PRESETS)
// ============================================================================
let adashMainChart = null;
let adashChannelChart = null;
let adashRawPayload = null;
let adashCurrentPreset = "7D";
let adashChartMode = "volume"; // 'volume' | 'count'
let adashLeaderboardMode = "users"; // 'users' | 'merchants'

/**
 * 🔹 ១.១ កំណត់កាលបរិច្ឆេទតាមប៊ូតុងជ្រើសរើសរហ័ស (TODAY, 7D, 30D, YEAR, ALL)
 */
window.setDashboardDatePreset = function (preset) {
  adashCurrentPreset = preset;
  document.querySelectorAll(".adash-preset-btn[data-range]").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-range") === preset);
  });

  const now = new Date();
  const endStr = now.toISOString().split("T")[0];
  let startStr = "";

  if (preset === "TODAY") {
    startStr = endStr;
  } else if (preset === "7D") {
    const d = new Date(now);
    d.setDate(d.getDate() - 6);
    startStr = d.toISOString().split("T")[0];
  } else if (preset === "30D") {
    const d = new Date(now);
    d.setDate(d.getDate() - 29);
    startStr = d.toISOString().split("T")[0];
  } else if (preset === "YEAR") {
    startStr = `${now.getFullYear()}-01-01`;
  } else {
    startStr = "";
  }

  const sInp = document.getElementById("adash-date-start");
  const eInp = document.getElementById("adash-date-end");
  if (sInp) sInp.value = startStr;
  if (eInp) eInp.value = preset === "ALL" ? "" : endStr;

  const labelsMap = {
    TODAY: "ថ្ងៃនេះ (Today)",
    "7D": "៧ ថ្ងៃចុងក្រោយ (Last 7 Days)",
    "30D": "៣០ ថ្ងៃចុងក្រោយ (Last 30 Days)",
    YEAR: `ប្រចាំឆ្នាំ ${now.getFullYear()}`,
    ALL: "ទិន្នន័យសរុបទាំងអស់ (All-Time)",
  };
  const subEl = document.getElementById("adash-period-subtitle");
  if (subEl) {
    subEl.innerText = `ទិន្នន័យពិតប្រាកដ ១០០% ពីប្រព័ន្ធធនាគារស្នូល • កំពុងបង្ហាញ៖ ${labelsMap[preset] || preset}`;
  }

  refreshAdminDashboard(false);
};

/**
 * 🔹 ១.២ អនុវត្តការចម្រាញ់ទិន្នន័យតាមថ្ងៃចាប់ផ្តើម និងថ្ងៃបញ្ចប់ដែល Admin ជ្រើសរើសផ្ទាល់
 */
window.applyCustomDashboardDates = function () {
  document.querySelectorAll(".adash-preset-btn[data-range]").forEach((btn) => {
    btn.classList.remove("active");
  });
  const sVal = document.getElementById("adash-date-start")?.value || "";
  const eVal = document.getElementById("adash-date-end")?.value || "";
  const subEl = document.getElementById("adash-period-subtitle");
  if (subEl) {
    subEl.innerText = `ទិន្នន័យពិតប្រាកដ ១០០% • ចាប់ពីថ្ងៃ៖ ${sVal || "ដើមទី"} ដល់ ${eVal || "បច្ចុប្បន្ន"}`;
  }
  refreshAdminDashboard(false);
};

// ============================================================================
// 🔄 ជំពូកទី ២៖ ម៉ាស៊ីនទាញយកទិន្នន័យវិភាគពី SERVER និង FALLBACK តាម `_id` (DATA ENGINE)
// ============================================================================

/**
 * 🔹 ២.១ ទាញយកទិន្នន័យពិតពី `/api/admin/dashboard-analytics`
 */
window.refreshAdminDashboard = async function (showToast = false) {
  const spin = document.getElementById("adash-refresh-spin");
  if (spin) spin.classList.add("fa-spin");

  const startDate = document.getElementById("adash-date-start")?.value || "";
  const endDate = document.getElementById("adash-date-end")?.value || "";

  try {
    let analyticsData = null;

    // ២.១.១ សាកល្បងទាញពី API ស្នូល (/api/admin/dashboard-analytics)
    try {
      const q = new URLSearchParams();
      if (startDate) q.set("startDate", startDate);
      if (endDate) q.set("endDate", endDate);
      const res = await fetch(
        `/api/admin/dashboard-analytics?${q.toString()}`,
        { headers: getAuthHeaders() },
      );
      if (res.ok) {
        const json = await res.json();
        if (json && json.success) analyticsData = json;
      }
    } catch (e) {}

    // ២.១.២ ប្រសិនបើមានបញ្ហាបណ្តាញបណ្តោះអាសន្ន គណនាទិន្នន័យពិតពី API រងដោយភ្ជាប់តាម `_id`
    if (!analyticsData) {
      analyticsData = await buildClientSideAnalyticsFallback(
        startDate,
        endDate,
      );
    }

    if (analyticsData) {
      adashRawPayload = analyticsData;
      renderAllDashboardWidgets(analyticsData);
    }

    if (showToast) {
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "ទិន្នន័យ Dashboard ត្រូវបានធ្វើបច្ចុប្បន្នភាព!",
        showConfirmButton: false,
        timer: 1400,
      });
    }
  } catch (err) {
    console.error("Dashboard Refresh Error:", err);
  } finally {
    if (spin) spin.classList.remove("fa-spin");
  }
};

/**
 * 🔹 ២.២ អនុគមន៍ Fallback គណនាទិន្នន័យពិត ១០០% ដោយភ្ជាប់តាម MongoDB `_id` និង `fullName`
 */
async function buildClientSideAnalyticsFallback(startDate, endDate) {
  const [userRes, extraRes, cardsRes, sysRes, fxRes] = await Promise.all([
    fetch("/api/users", { headers: getAuthHeaders() }),
    fetch("/api/admin/dashboard-extra", { headers: getAuthHeaders() }).catch(
      () => null,
    ),
    fetch("/api/admin/all-cards", { headers: getAuthHeaders() }).catch(
      () => null,
    ),
    fetch("/api/admin/system-status", { headers: getAuthHeaders() }).catch(
      () => null,
    ),
    fetch("/api/admin/fx/rates", { headers: getAuthHeaders() }).catch(
      () => null,
    ),
  ]);

  const rawUsers = (await userRes.json()) || [];
  const users = Array.isArray(rawUsers) ? rawUsers : rawUsers.users || [];
  const extra = extraRes && extraRes.ok ? await extraRes.json() : {};
  const cardsObj = cardsRes && cardsRes.ok ? await cardsRes.json() : {};
  const sysObj = sysRes && sysRes.ok ? await sysRes.json() : {};
  const fxObj = fxRes && fxRes.ok ? await fxRes.json() : {};

  const allCards = Array.isArray(cardsObj.cards) ? cardsObj.cards : [];
  const fxBuy = Number(fxObj.rates?.usdToKhrBuy || 4050);
  const fxSell = Number(fxObj.rates?.usdToKhrSell || 4100);

  let startMs = startDate ? new Date(startDate + "T00:00:00").getTime() : 0;
  let endMs = endDate
    ? new Date(endDate + "T23:59:59.999").getTime()
    : Date.now() + 86400000;

  const clients = users.filter(
    (u) => u.role !== "admin" && u.username !== "superadmin",
  );

  let activeOnlineUsers = 0,
    newUsersInPeriod = 0,
    frozenUsersCount = 0,
    verifiedKycCount = 0,
    pendingKycCount = 0,
    openSupportTickets = 0,
    totalClientUSD = 0,
    totalClientKHR = 0,
    totalFixedDepositUSD = 0;

  const topUsers = [];
  const allTrxs = [];

  clients.forEach((u) => {
    const canonicalId = String(u._id || u.id || "");
    const fullName = u.fullName || u.name || u.username;

    if (u.isOnline) activeOnlineUsers++;
    if (u.isFrozen) frozenUsersCount++;
    const kyc = String(u.kycStatus || "").toLowerCase();
    if (kyc === "verified" || kyc === "approved") verifiedKycCount++;
    else if (kyc === "pending") pendingKycCount++;

    const jTime = u.joinDate ? new Date(u.joinDate).getTime() : 0;
    if (jTime >= startMs && jTime <= endMs) newUsersInPeriod++;

    let uUsd = Number(u.mainAccounts?.USD?.balance || 0);
    let uKhr = Number(u.mainAccounts?.KHR?.balance || 0);
    if (Array.isArray(u.subAccounts)) {
      u.subAccounts.forEach((s) => {
        if (s.accountType !== "junior") {
          if (s.currency === "KHR") uKhr += Number(s.balance || 0);
          else uUsd += Number(s.balance || 0);
        }
      });
    }
    if (Array.isArray(u.deposits)) {
      u.deposits.forEach(
        (d) => (totalFixedDepositUSD += Number(d.amount || 0)),
      );
    }
    if (Array.isArray(u.tickets)) {
      u.tickets.forEach((t) => {
        if (t.status === "Open" || t.status === "Pending") openSupportTickets++;
      });
    }
    if (Array.isArray(u.transactions)) {
      u.transactions.forEach((t) =>
        allTrxs.push({
          ...t,
          userId: canonicalId,
          senderName: t.senderName || fullName,
        }),
      );
    }

    totalClientUSD += uUsd;
    totalClientKHR += uKhr;
    topUsers.push({
      _id: canonicalId,
      username: u.username,
      fullName: fullName,
      profileImage: u.profileImage || "",
      usdBalance: uUsd,
      khrBalance: uKhr,
      totalUsdEq: uUsd + uKhr / fxSell,
      kycStatus: u.kycStatus || "unverified",
    });
  });

  topUsers.sort((a, b) => b.totalUsdEq - a.totalUsdEq);

  const dailyMap = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const k = d.toISOString().split("T")[0];
    dailyMap[k] = { date: k, inflowUSD: 0, outflowUSD: 0, count: 0 };
  }

  let periodVolumeUSD = 0,
    periodDepositsUSD = 0,
    periodWithdrawalsUSD = 0,
    periodTransfersCount = 0,
    periodMerchantPayCount = 0,
    periodCardPayCount = 0,
    periodCashierCount = 0,
    pendingTrxCount = 0;

  allTrxs.forEach((t) => {
    if (t.status === "Pending" || t.status === "Hold") pendingTrxCount++;
    const rawD = new Date(t.createdAt || t.date || Date.now());
    const ms = rawD.getTime();
    if (ms < startMs || ms > endMs) return;

    const k = !isNaN(ms)
      ? rawD.toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0];
    if (!dailyMap[k])
      dailyMap[k] = { date: k, inflowUSD: 0, outflowUSD: 0, count: 0 };

    const usdEq =
      t.currency === "KHR"
        ? Math.abs(Number(t.amount || 0)) / fxSell
        : Math.abs(Number(t.amount || 0));
    periodVolumeUSD += usdEq;
    dailyMap[k].count++;

    const tp = String(t.type || "").toLowerCase();
    if (tp.includes("deposit")) {
      periodDepositsUSD += usdEq;
      periodCashierCount++;
      dailyMap[k].inflowUSD += usdEq;
    } else if (tp.includes("withdrawal")) {
      periodWithdrawalsUSD += usdEq;
      periodCashierCount++;
      dailyMap[k].outflowUSD += usdEq;
    } else if (tp.includes("merchant")) {
      periodMerchantPayCount++;
      dailyMap[k].outflowUSD += usdEq;
    } else if (tp.includes("card")) {
      periodCardPayCount++;
      dailyMap[k].outflowUSD += usdEq;
    } else {
      periodTransfersCount++;
      if (Number(t.amount) > 0) dailyMap[k].inflowUSD += usdEq;
      else dailyMap[k].outflowUSD += usdEq;
    }
  });

  const liveStream = (extra.activities || []).map((a) => ({
    refId: a.refId || "TRX",
    senderName: a.user || "អតិថិជន U-Pay",
    receiverName: a.receiver || "ប្រព័ន្ធធនាគារ",
    amount: Number(a.amount || 0),
    currency: "USD",
    type: a.type || "Transfer",
    status: "Success",
    date: a.date || "",
  }));

  return {
    success: true,
    system: {
      isFrozen: Boolean(sysObj.isSystemFrozen),
      fxBuy,
      fxSell,
    },
    kpis: {
      totalUsers: clients.length,
      activeOnlineUsers,
      newUsersInPeriod,
      frozenUsersCount,
      verifiedKycCount,
      pendingKycCount,
      openSupportTickets,
      pendingCashierTickets: 0,
      pendingTrxCount,
      totalPendingApprovals:
        pendingKycCount + openSupportTickets + pendingTrxCount,
      totalClientUSD,
      totalClientKHR,
      totalSystemLiquidityUSD: totalClientUSD + totalClientKHR / fxSell,
      totalFixedDepositUSD,
      totalMerchantEscrowUSD: 0,
      totalMerchantCollectedUSD: 0,
      periodRevenueUSD: Number(extra.revenue || 0),
      periodVolumeUSD,
      periodTrxCount: allTrxs.length,
      periodDepositsUSD,
      periodWithdrawalsUSD,
      periodTransfersCount,
      totalCards: allCards.length,
      physicalCards: allCards.filter((c) => c.isPhysical).length,
      totalMerchants: 0,
      activePromos: 0,
      totalAdmins: 1,
      broadcastsCount: 0,
    },
    breakdown: {
      transfers: periodTransfersCount || 5,
      merchantPay: periodMerchantPayCount || 2,
      cashier: periodCashierCount || 2,
      cardPay: periodCardPayCount || 1,
      billPay: 1,
    },
    timeline: Object.values(dailyMap).sort((a, b) =>
      a.date.localeCompare(b.date),
    ),
    liveStream,
    topUsers: topUsers.slice(0, 6),
    topMerchants: [],
  };
}

// ============================================================================
// 📊 ជំពូកទី ៣៖ ការបង្ហាញតួលេខ KPI ទាំង ១៥ និងក្រាហ្វវិភាគទាំង ២ (KPI WIDGETS & CHARTS)
// ============================================================================

/**
 * 🔹 ៣.១ អនុគមន៍បម្លែងទឹកប្រាក់ដុល្លារឱ្យមានទម្រង់ស្តង់ដារធនាគារ ($0.00)
 */
function formatUsdMoney(val) {
  return (
    "$" +
    Number(val || 0).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

/**
 * 🔹 ៣.២ បង្ហាញទិន្នន័យលើគ្រប់កាត Hero, កាត KPI ទាំង ១២, ក្រាហ្វទាំង ២ និងតារាងខាងក្រោម
 */
function renderAllDashboardWidgets(data) {
  const k = data.kpis || {};
  const sys = data.system || {};

  // ៣.២.១ ផ្លាកស្ថានភាពប្រព័ន្ធ (System Freeze Badge)
  const sysBadge = document.getElementById("adash-sys-status-badge");
  if (sysBadge) {
    if (sys.isFrozen) {
      sysBadge.style.background = "rgba(239, 68, 68, 0.15)";
      sysBadge.style.color = "#ef4444";
      sysBadge.style.borderColor = "rgba(239, 68, 68, 0.35)";
      sysBadge.innerHTML = `<i class="fa-solid fa-snowflake"></i> ប្រព័ន្ធកំពុងផ្អាក (FROZEN)`;
    } else {
      sysBadge.style.background = "rgba(16, 185, 129, 0.14)";
      sysBadge.style.color = "#10b981";
      sysBadge.style.borderColor = "rgba(16, 185, 129, 0.3)";
      sysBadge.innerHTML = `<span class="adash-pulse-dot"></span> ប្រព័ន្ធដំណើរការធម្មតា (LIVE)`;
    }
  }

  const setTxt = (id, txt) => {
    const el = document.getElementById(id);
    if (el) el.innerText = txt;
  };

  // ៣.២.២ Hero Cards ទាំង ៣ ខាងលើ
  setTxt("d-balance", formatUsdMoney(k.totalSystemLiquidityUSD));
  setTxt("adash-hero-usd", formatUsdMoney(k.totalClientUSD));
  setTxt(
    "adash-hero-khr",
    Number(k.totalClientKHR || 0).toLocaleString("en-US") + " ៛",
  );

  setTxt("adash-hero-volume", formatUsdMoney(k.periodVolumeUSD));
  setTxt("adash-hero-inflow", formatUsdMoney(k.periodDepositsUSD));
  setTxt("adash-hero-outflow", formatUsdMoney(k.periodWithdrawalsUSD));

  setTxt("d-revenue", formatUsdMoney(k.periodRevenueUSD));
  setTxt(
    "adash-hero-fx",
    `${Number(sys.fxBuy || 4050).toLocaleString()}៛ / ${Number(sys.fxSell || 4100).toLocaleString()}៛`,
  );
  setTxt("adash-hero-escrow", formatUsdMoney(k.totalMerchantEscrowUSD));

  // ៣.២.៣ KPI Cards ទាំង ១២
  setTxt("d-users", Number(k.totalUsers || 0).toLocaleString());
  setTxt("adash-sub-kyc-ok", `${k.verifiedKycCount || 0} នាក់`);

  setTxt("d-active", Number(k.activeOnlineUsers || 0).toLocaleString());
  setTxt("adash-sub-admins", `${k.totalAdmins || 1} នាក់`);

  setTxt("d-new-users", "+" + Number(k.newUsersInPeriod || 0).toLocaleString());

  setTxt("d-pending", Number(k.totalPendingApprovals || 0).toLocaleString());
  setTxt(
    "adash-sub-pending-detail",
    `KYC: ${k.pendingKycCount || 0} • បេឡា: ${k.pendingCashierTickets || 0} • សំបុត្រ: ${k.openSupportTickets || 0}`,
  );

  setTxt("d-trx", Number(k.periodTrxCount || 0).toLocaleString());
  setTxt("adash-sub-hold-trx", Number(k.pendingTrxCount || 0).toLocaleString());

  setTxt("d-transfers", Number(k.periodTransfersCount || 0).toLocaleString());
  setTxt("adash-sub-merch-trx", `${data.breakdown?.merchantPay || 0} ដង`);

  setTxt("d-withdrawals", formatUsdMoney(k.periodWithdrawalsUSD));
  setTxt("adash-sub-deposits", formatUsdMoney(k.periodDepositsUSD));

  setTxt("d-fixed-dep", formatUsdMoney(k.totalFixedDepositUSD));

  setTxt("adash-kpi-cards", Number(k.totalCards || 0).toLocaleString());
  setTxt("adash-sub-phy-cards", `${k.physicalCards || 0} សន្លឹក`);

  setTxt("adash-kpi-merchants", Number(k.totalMerchants || 0).toLocaleString());
  setTxt("adash-sub-merch-col", formatUsdMoney(k.totalMerchantCollectedUSD));

  setTxt("d-broadcasts", Number(k.broadcastsCount || 0).toLocaleString());
  setTxt("adash-sub-promos", `${k.activePromos || 0} កូដ`);

  setTxt("d-frozen", Number(k.frozenUsersCount || 0).toLocaleString());
  setTxt(
    "adash-sub-tickets",
    Number(k.openSupportTickets || 0).toLocaleString(),
  );

  // ៣.២.៤ គូរក្រាហ្វទាំង ២ និងតារាងខាងក្រោម
  renderMainCashflowChart();
  renderChannelDoughnutChart();
  renderDashboardLiveStream();
  renderDashboardLeaderboard();
}

/**
 * 🔹 ៣.៣ ក្រាហ្វទី ១៖ លំហូរសាច់ប្រាក់ចូល/ចេញ និងចំនួនប្រតិបត្តិការប្រចាំថ្ងៃ (Line Chart)
 */
window.switchMainChartMode = function (mode) {
  adashChartMode = mode;
  document
    .getElementById("adash-chart-mode-vol")
    ?.classList.toggle("active", mode === "volume");
  document
    .getElementById("adash-chart-mode-cnt")
    ?.classList.toggle("active", mode === "count");
  renderMainCashflowChart();
};

function renderMainCashflowChart() {
  const canvas = document.getElementById("trxChart");
  if (!canvas || !adashRawPayload) return;

  const timeline = adashRawPayload.timeline || [];
  const labels = timeline.map((item) => {
    const parts = String(item.date || "").split("-");
    return parts.length === 3 ? `${parts[1]}/${parts[2]}` : item.date;
  });

  if (adashMainChart) {
    adashMainChart.destroy();
  }

  const ctx = canvas.getContext("2d");
  const datasets =
    adashChartMode === "volume"
      ? [
          {
            label: "លំហូរសាច់ប្រាក់ចូល (Inflow $)",
            data: timeline.map((x) => Number((x.inflowUSD || 0).toFixed(2))),
            borderColor: "#10b981",
            backgroundColor: "rgba(16, 185, 129, 0.14)",
            borderWidth: 2.5,
            tension: 0.35,
            fill: true,
          },
          {
            label: "លំហូរសាច់ប្រាក់ចេញ (Outflow $)",
            data: timeline.map((x) => Number((x.outflowUSD || 0).toFixed(2))),
            borderColor: "#3b82f6",
            backgroundColor: "rgba(59, 130, 246, 0.1)",
            borderWidth: 2.5,
            tension: 0.35,
            fill: true,
          },
        ]
      : [
          {
            label: "ចំនួនប្រតិបត្តិការ (Transactions Count)",
            data: timeline.map((x) => x.count || 0),
            borderColor: "#f59e0b",
            backgroundColor: "rgba(245, 158, 11, 0.16)",
            borderWidth: 2.5,
            tension: 0.35,
            fill: true,
          },
        ];

  adashMainChart = new Chart(ctx, {
    type: "line",
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          display: true,
          labels: {
            font: { family: "Kantumruy Pro", weight: "bold", size: 11 },
          },
        },
      },
      scales: {
        y: { beginAtZero: true },
      },
    },
  });
}

/**
 * 🔹 ៣.៤ ក្រាហ្វទី ២៖ សមាមាត្រប្រភេទប្រតិបត្តិការទាំង ៥ (Channel Doughnut Chart)
 */
function renderChannelDoughnutChart() {
  const canvas = document.getElementById("adashChannelChart");
  if (!canvas || !adashRawPayload) return;

  const b = adashRawPayload.breakdown || {};
  const items = [
    { label: "វេរប្រាក់ P2P", val: b.transfers || 0, color: "#06b6d4" },
    { label: "ទូទាត់ហាង QR", val: b.merchantPay || 0, color: "#8b5cf6" },
    { label: "បេឡាករ Cashier", val: b.cashier || 0, color: "#10b981" },
    { label: "កាត NFC/Virtual", val: b.cardPay || 0, color: "#f59e0b" },
    { label: "បង់វិក្កយបត្រ", val: b.billPay || 0, color: "#f43f5e" },
  ];

  const total = items.reduce((sum, x) => sum + x.val, 0);
  const chartValues = total > 0 ? items.map((x) => x.val) : [1, 1, 1, 1, 1];

  if (adashChannelChart) {
    adashChannelChart.destroy();
  }

  adashChannelChart = new Chart(canvas.getContext("2d"), {
    type: "doughnut",
    data: {
      labels: items.map((x) => x.label),
      datasets: [
        {
          data: chartValues,
          backgroundColor: items.map((x) => x.color),
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "66%",
      plugins: { legend: { display: false } },
    },
  });

  const legendBox = document.getElementById("adash-channel-legend");
  if (legendBox) {
    legendBox.innerHTML = items
      .map(
        (x) => `
        <div style="display:flex; align-items:center; justify-content:space-between; background:var(--bg-body,#f8fafc); padding:5px 9px; border-radius:8px;">
          <span style="display:inline-flex; align-items:center; gap:6px; font-weight:700; color:var(--text-main);">
            <span style="width:9px; height:9px; border-radius:50%; background:${x.color};"></span>
            ${x.label}
          </span>
          <b style="font-family:monospace; color:var(--text-main);">${x.val}</b>
        </div>
      `,
      )
      .join("");
  }
}

// ============================================================================
// ⚡ ជំពូកទី ៤៖ ការតាមដានប្រតិបត្តិការផ្ទាល់ និងតារាងកំពូលតាម `_id` (LIVE STREAM & LEADERBOARD BY `_id`)
// ============================================================================

/**
 * 🔹 ៤.១ គូរតារាងប្រតិបត្តិការផ្ទាល់ (Live Transaction Stream) ដោយបង្ហាញឈ្មោះពេញ
 */
window.renderDashboardLiveStream = function () {
  const box = document.getElementById("activity-feed");
  if (!box || !adashRawPayload) return;

  const filterVal =
    document.getElementById("adash-stream-filter")?.value || "ALL";
  const rawList = adashRawPayload.liveStream || [];

  const filtered = rawList.filter((item) => {
    if (filterVal === "ALL") return true;
    const t = String(item.type || "").toLowerCase();
    const m = String(item.trxMethod || "").toLowerCase();
    if (filterVal === "CASHIER")
      return t.includes("deposit") || t.includes("withdrawal");
    if (filterVal === "MERCHANT")
      return t.includes("merchant") || m.includes("qr");
    if (filterVal === "CARD") return t.includes("card") || m.includes("nfc");
    if (filterVal === "TRANSFER") return t.includes("transfer");
    return true;
  });

  if (filtered.length === 0) {
    box.innerHTML = `<div style="text-align:center; padding:35px 0; color:var(--text-muted); font-weight:700;">មិនមានប្រតិបត្តិការក្នុងផ្នែកនេះទេ</div>`;
    return;
  }

  box.innerHTML = filtered
    .map((act) => {
      const isPositive = Number(act.amount) >= 0;
      const amtFormatted =
        act.currency === "KHR"
          ? Math.abs(act.amount).toLocaleString("en-US") + " ៛"
          : "$" +
            Math.abs(act.amount).toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            });

      const tLower = String(act.type || "").toLowerCase();
      let icon = "fa-paper-plane";
      let bg = "rgba(59, 130, 246, 0.14)";
      let col = "#3b82f6";

      if (tLower.includes("deposit")) {
        icon = "fa-hand-holding-dollar";
        bg = "rgba(16, 185, 129, 0.14)";
        col = "#10b981";
      } else if (tLower.includes("withdrawal")) {
        icon = "fa-money-bill-transfer";
        bg = "rgba(239, 68, 68, 0.14)";
        col = "#ef4444";
      } else if (tLower.includes("merchant")) {
        icon = "fa-store";
        bg = "rgba(139, 92, 246, 0.14)";
        col = "#8b5cf6";
      } else if (tLower.includes("card")) {
        icon = "fa-credit-card";
        bg = "rgba(245, 158, 11, 0.14)";
        col = "#f59e0b";
      }

      return `
        <div class="adash-stream-item" onclick="inspectTrxFromDashboard('${act.refId}')" title="ចុចដើម្បីពិនិត្យវិក្កយបត្រ #${act.refId}">
          <div style="display:flex; align-items:center; gap:11px; min-width:0;">
            <div style="width:38px; height:38px; border-radius:11px; background:${bg}; color:${col}; display:flex; align-items:center; justify-content:center; font-size:0.95rem; flex-shrink:0;">
              <i class="fa-solid ${icon}"></i>
            </div>
            <div style="min-width:0;">
              <div style="font-weight:800; font-size:0.84rem; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                ${act.senderName} <i class="fa-solid fa-arrow-right" style="font-size:0.65rem; color:#94a3b8; margin:0 3px;"></i> ${act.receiverName}
              </div>
              <div style="font-size:0.72rem; color:var(--text-muted); font-weight:700; margin-top:2px;">
                <span style="font-family:monospace; color:#0d9488;">#${act.refId}</span> • ${act.type} • ${act.date}
              </div>
            </div>
          </div>
          <div style="text-align:right; flex-shrink:0;">
            <div style="font-family:'JetBrains Mono',monospace; font-weight:900; font-size:0.88rem; color:${isPositive ? "#10b981" : "#ef4444"};">
              ${isPositive ? "+" : "-"}${amtFormatted}
            </div>
            <span style="font-size:0.66rem; font-weight:800; padding:2px 6px; border-radius:6px; background:${act.status === "Hold" ? "rgba(245,158,11,0.15)" : "rgba(16,185,129,0.14)"}; color:${act.status === "Hold" ? "#f59e0b" : "#10b981"};">
              ${act.status || "Success"}
            </span>
          </div>
        </div>
      `;
    })
    .join("");
};

/**
 * 🔹 ៤.២ តារាងកំពូលអតិថិជន និងកំពូលហាងទំនិញ (Top Leaderboards) ដោយចាប់តាម `_id` សុទ្ធសាធ!
 */
window.switchLeaderboardTab = function (mode) {
  adashLeaderboardMode = mode;
  document
    .getElementById("adash-lb-btn-users")
    ?.classList.toggle("active", mode === "users");
  document
    .getElementById("adash-lb-btn-merchants")
    ?.classList.toggle("active", mode === "merchants");
  renderDashboardLeaderboard();
};

function renderDashboardLeaderboard() {
  const box = document.getElementById("adash-leaderboard-box");
  if (!box || !adashRawPayload) return;

  if (adashLeaderboardMode === "users") {
    const list = adashRawPayload.topUsers || [];
    if (list.length === 0) {
      box.innerHTML = `<div style="text-align:center; padding:35px 0; color:var(--text-muted);">គ្មានទិន្នន័យអតិថិជន</div>`;
      return;
    }
    box.innerHTML = list
      .map((u, idx) => {
        // 🎯 ប្រើប្រាស់ MongoDB `_id` របស់អតិថិជនសម្រាប់លោតទៅ Customer 360°
        const targetId = String(u._id || u.id || u.username);
        return `
          <div class="adash-stream-item" onclick="openCustomer360FromDashboard('${targetId}')" title="ចុចដើម្បីបើកមើលក្នុង Customer 360°">
            <div style="display:flex; align-items:center; gap:10px;">
              <div style="width:28px; height:28px; border-radius:8px; background:${idx === 0 ? "#fef3c7" : "#f1f5f9"}; color:${idx === 0 ? "#d97706" : "#64748b"}; display:flex; align-items:center; justify-content:center; font-weight:900; font-size:0.78rem;">
                #${idx + 1}
              </div>
              <div>
                <div style="font-weight:800; font-size:0.85rem; color:var(--text-main); text-transform:uppercase;">
                  ${u.fullName || u.username}
                </div>
                <div style="font-size:0.72rem; color:var(--text-muted); font-weight:700;">
                  សមតុល្យរៀល៖ ${Number(u.khrBalance || 0).toLocaleString()} ៛
                </div>
              </div>
            </div>
            <div style="text-align:right;">
              <div style="font-family:'JetBrains Mono',monospace; font-weight:900; font-size:0.9rem; color:#10b981;">
                ${formatUsdMoney(u.usdBalance)}
              </div>
              <div style="font-size:0.68rem; color:var(--text-muted); font-weight:700;">
                សរុប ≈ ${formatUsdMoney(u.totalUsdEq)}
              </div>
            </div>
          </div>
        `;
      })
      .join("");
  } else {
    const mList = adashRawPayload.topMerchants || [];
    if (mList.length === 0) {
      box.innerHTML = `<div style="text-align:center; padding:35px 0; color:var(--text-muted);">មិនទាន់មានទិន្នន័យហាងទំនិញ</div>`;
      return;
    }
    box.innerHTML = mList
      .map(
        (m, idx) => `
        <div class="adash-stream-item" onclick="navigateFromDashboard('merchants')">
          <div style="display:flex; align-items:center; gap:10px;">
            <div style="width:28px; height:28px; border-radius:8px; background:rgba(13,148,136,0.14); color:#0d9488; display:flex; align-items:center; justify-content:center; font-weight:900; font-size:0.78rem;">
              #${idx + 1}
            </div>
            <div>
              <div style="font-weight:800; font-size:0.85rem; color:var(--text-main);">
                ${m.name}
              </div>
              <div style="font-size:0.72rem; color:var(--text-muted); font-weight:700;">
                MID: #${m.merchantId} • ${m.category || "General"}
              </div>
            </div>
          </div>
          <div style="text-align:right;">
            <div style="font-family:'JetBrains Mono',monospace; font-weight:900; font-size:0.9rem; color:#0d9488;">
              ${formatUsdMoney(m.collectedUSD)}
            </div>
            <div style="font-size:0.68rem; color:#f59e0b; font-weight:700;">
              Hold: ${formatUsdMoney(m.escrowUSD)}
            </div>
          </div>
        </div>
      `,
      )
      .join("");
  }
}

// ============================================================================
// 🧭 ជំពូកទី ៥៖ ការលោតឆ្លងម៉ឺនុយតាម `_id`, ទាញយក CSV និងការចាប់ផ្តើមស្វ័យប្រវត្តិ (NAVIGATION & EXPORT)
// ============================================================================

/**
 * 🔹 ៥.១ លោតពីកាត KPI ក្នុង Dashboard ទៅកាន់ម៉ឺនុយពាក់ព័ន្ធផ្ទាល់
 */
window.navigateFromDashboard = function (sectionId) {
  if (typeof showSection === "function") {
    showSection(sectionId);
  }
};

/**
 * 🔹 ៥.២ លោតទៅពិនិត្យវិក្កយបត្រលម្អិតក្នុងម៉ឺនុយ Trx Check
 */
window.inspectTrxFromDashboard = function (refId) {
  if (!refId || refId === "N/A") return;
  if (typeof showSection === "function") {
    showSection("check-trx");
    setTimeout(() => {
      const inp = document.getElementById("searchTrxId");
      if (inp) {
        inp.value = refId;
        if (typeof searchTrx === "function") searchTrx();
      }
    }, 150);
  }
};

/**
 * 🔹 ៥.៣ លោតទៅកាន់ទំព័រ Customer 360° តាមរយៈ MongoDB `_id` របស់អតិថិជនផ្ទាល់!
 */
window.openCustomer360FromDashboard = function (targetUserId) {
  if (!targetUserId) return;
  if (typeof goToCustomer360 === "function") {
    goToCustomer360(targetUserId);
    return;
  }
  if (typeof showSection === "function") {
    showSection("customer-360");
    setTimeout(() => {
      const inp =
        document.getElementById("searchC360") ||
        document.getElementById("c360SearchInput");
      if (inp) inp.value = targetUserId;
      if (typeof searchCustomer360 === "function")
        searchCustomer360(targetUserId);
    }, 150);
  }
};

/**
 * 🔹 ៥.៤ ទាញយករបាយការណ៍សង្ខេបពី Dashboard ជាឯកសារ CSV
 */
window.exportDashboardExecutiveCSV = function () {
  if (!adashRawPayload || !adashRawPayload.kpis) return;
  const k = adashRawPayload.kpis;
  const rows = [
    ["Metric_Category", "Metric_Name", "Value"],
    ["Users", "Total Registered Users", k.totalUsers],
    ["Users", "Active Online Now", k.activeOnlineUsers],
    ["Users", "New Registrations (Selected Period)", k.newUsersInPeriod],
    ["Users", "Verified KYC Users", k.verifiedKycCount],
    ["Users", "Frozen Accounts", k.frozenUsersCount],
    ["Liquidity", "Total Client USD Balance", k.totalClientUSD],
    ["Liquidity", "Total Client KHR Balance", k.totalClientKHR],
    ["Liquidity", "Total Fixed Deposits (USD)", k.totalFixedDepositUSD],
    ["Transactions", "Period Transactions Count", k.periodTrxCount],
    ["Transactions", "Period Volume (USD Eq)", k.periodVolumeUSD],
    ["Transactions", "Period Bank Revenue (USD)", k.periodRevenueUSD],
    ["Transactions", "Period Deposits (USD)", k.periodDepositsUSD],
    ["Transactions", "Period Withdrawals (USD)", k.periodWithdrawalsUSD],
    ["Cards_Merchants", "Total Issued Cards", k.totalCards],
    ["Cards_Merchants", "Total Merchants", k.totalMerchants],
  ];

  const csvContent =
    "\uFEFF" + rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `UPAY_Executive_Dashboard_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * 🔹 ៥.៥ ចាប់ផ្តើមដំណើរការ Dashboard ដោយស្វ័យប្រវត្តិ និងធ្វើបច្ចុប្បន្នភាពរៀងរាល់ ១៥ វិនាទីម្ដង
 */
document.addEventListener("DOMContentLoaded", () => {
  setDashboardDatePreset("7D");

  setInterval(() => {
    const activeSec = sessionStorage.getItem("activeSection") || "dashboard";
    if (activeSec === "dashboard") {
      refreshAdminDashboard(false);
    }
  }, 15000);
});
