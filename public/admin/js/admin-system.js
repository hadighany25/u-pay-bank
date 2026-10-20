// ============================================================================
// ឯកសារ: js/admin-system.js (Pro Automated Scheduler + Auto-Freeze & Auto-Resume)
// អត្ថន័យ: គ្រប់គ្រងការកំណត់ម៉ោងបិទ/បើកប្រព័ន្ធស្វ័យប្រវត្តិ, ផ្ញើសារជូនដំណឹង & របាយការណ៍
// ស្តង់ដារថ្មី: បង្ហាញឈ្មោះពេញរបស់មន្ត្រីប្រតិបត្តិ (fullName) និងរៀបចំជំពូកស្តង់ដារ
// ============================================================================

// ============================================================================
// ⏰ ជំពូកទី ១៖ អថេរសកល និងការកំណត់ម៉ោងថែទាំដំបូង (GLOBAL STATE & DEFAULT TIMERS)
// ============================================================================
let globalSystemStatusData = {
  isSystemFrozen: false,
  maintenanceMeta: {},
  maintenanceHistory: [],
};
let systemOutageInterval = null;
let systemAutoPollInterval = null;

/**
 * 🔹 ១.១ បម្លែង Date Object ឱ្យទៅជាទម្រង់សម្រាប់ប្រអប់ `<input type="datetime-local">`
 */
function formatLocalDatetimeInput(dateObj) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())}T${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}`;
}

/**
 * 🔹 ១.២ កំណត់ម៉ោងចាប់ផ្តើម និងម៉ោងបញ្ចប់លំនាំដើម (ឥឡូវនេះ + ១ ម៉ោង)
 */
function initSystemDefaultTimes() {
  const startEl = document.getElementById("asysStartTime");
  const endEl = document.getElementById("asysExpectedEnd");
  const now = new Date();
  const plus1Hour = new Date(now.getTime() + 60 * 60 * 1000);
  if (startEl && !startEl.value) startEl.value = formatLocalDatetimeInput(now);
  if (endEl && !endEl.value) endEl.value = formatLocalDatetimeInput(plus1Hour);
}

/**
 * 🔹 ១.៣ បំពេញមូលហេតុ និងរយៈពេលថែទាំដោយស្វ័យប្រវត្តិ (Quick Presets)
 */
window.applySystemReasonPreset = function (presetKey) {
  const reasonEl = document.getElementById("asysReasonInput");
  const typeEl = document.getElementById("asysFreezeType");
  const startEl = document.getElementById("asysStartTime");
  const endEl = document.getElementById("asysExpectedEnd");
  if (!reasonEl) return;

  const baseStart =
    startEl && startEl.value ? new Date(startEl.value) : new Date();

  if (presetKey === "MAINT_30M") {
    if (typeEl) typeEl.value = "Scheduled Maintenance";
    if (endEl)
      endEl.value = formatLocalDatetimeInput(
        new Date(baseStart.getTime() + 30 * 60 * 1000),
      );
    reasonEl.value =
      "ធនាគារកំពុងធ្វើបច្ចុប្បន្នភាពប្រព័ន្ធប្រតិបត្តិការតាមកាលកំណត់រយៈពេល ៣០ នាទី ដើម្បីបង្កើនល្បឿនសេវាកម្ម។";
  } else if (presetKey === "MAINT_2H") {
    if (typeEl) typeEl.value = "Database & Core Upgrade";
    if (endEl)
      endEl.value = formatLocalDatetimeInput(
        new Date(baseStart.getTime() + 120 * 60 * 1000),
      );
    reasonEl.value =
      "ធនាគារកំពុងអាប់ដេតប្រព័ន្ធមូលដ្ឋានទិន្នន័យ និងសុវត្ថិភាពស្នូលរយៈពេល ២ ម៉ោង។";
  } else if (presetKey === "EMERGENCY") {
    if (typeEl) typeEl.value = "Emergency Security Freeze";
    if (startEl) startEl.value = formatLocalDatetimeInput(new Date());
    if (endEl)
      endEl.value = formatLocalDatetimeInput(
        new Date(Date.now() + 60 * 60 * 1000),
      );
    reasonEl.value =
      "ផ្អាកប្រតិបត្តិការបណ្តោះអាសន្នដើម្បីត្រួតពិនិត្យប្រព័ន្ធសុវត្ថិភាពបន្ទាន់។";
  }
};

// ============================================================================
// 🔄 ជំពូកទី ២៖ ការទាញយកស្ថានភាពប្រព័ន្ធ និងបង្ហាញផ្ទាំងបញ្ជា (LOAD & RENDER UI)
// ============================================================================

/**
 * 🔹 ២.១ ទាញយកស្ថានភាពប្រព័ន្ធ និងប្រវត្តិថែទាំពី `/api/admin/system-status`
 */
window.loadSystemControlHub = async function (showSpin = false) {
  const spinIcon = document.getElementById("asys-refresh-icon");
  if (showSpin && spinIcon) spinIcon.classList.add("fa-spin");

  initSystemDefaultTimes();

  try {
    const res = await fetch("/api/admin/system-status", {
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    globalSystemStatusData = {
      isSystemFrozen: Boolean(data.isSystemFrozen),
      maintenanceMeta: data.maintenanceMeta || {},
      maintenanceHistory: Array.isArray(data.maintenanceHistory)
        ? data.maintenanceHistory
        : [],
    };
    renderSystemControlUI();
  } catch (err) {
    console.error("Load System Control Error:", err);
  } finally {
    if (showSpin && spinIcon) {
      setTimeout(() => spinIcon.classList.remove("fa-spin"), 350);
    }
  }
};

function formatCountdownHMS(msLeft) {
  const totalSec = Math.max(0, Math.floor(msLeft / 1000));
  const h = String(Math.floor(totalSec / 3600)).padStart(2, "0");
  const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0");
  const s = String(totalSec % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

/**
 * 🔹 ២.២ គូរផ្ទាំងបញ្ជាប្រព័ន្ធ (Hero Banner, KPI Cards, Service Impact & Countdown Timer)
 */
function renderSystemControlUI() {
  const isFrozen = globalSystemStatusData.isSystemFrozen;
  const meta = globalSystemStatusData.maintenanceMeta || {};
  const isScheduled =
    !isFrozen &&
    meta.scheduleStatus === "SCHEDULED" &&
    meta.startAtMs &&
    Number(meta.startAtMs) > Date.now();
  const history = globalSystemStatusData.maintenanceHistory || [];

  const banner = document.getElementById("asysHeroBanner");
  const iconBox = document.getElementById("asysHeroIconBox");
  const liveBadge = document.getElementById("asysLiveBadge");
  const heroTitle = document.getElementById("asysHeroTitle");
  const heroSub = document.getElementById("asysHeroSub");
  const quickBtn = document.getElementById("asysQuickMasterBtn");
  const submitBtn = document.getElementById("asysSubmitActionBtn");
  const formHeaderTitle = document.getElementById("asysFormHeaderTitle");

  // ២.២.១ អាប់ដេត Hero Banner តាមស្ថានភាពទាំង ៣ (ONLINE, SCHEDULED, FROZEN)
  if (banner) {
    if (isFrozen) {
      banner.className = "asys-hero-banner state-frozen";
      banner.style.background =
        "linear-gradient(135deg, #7f1d1d 0%, #dc2626 100%)";
    } else if (isScheduled) {
      banner.className = "asys-hero-banner";
      banner.style.background =
        "linear-gradient(135deg, #9a3412 0%, #ea580c 100%)";
    } else {
      banner.className = "asys-hero-banner state-online";
      banner.style.background =
        "linear-gradient(135deg, #004d40 0%, #0d9488 100%)";
    }
  }

  if (iconBox) {
    iconBox.innerHTML = isFrozen
      ? '<i class="fa-solid fa-triangle-exclamation fa-beat-fade"></i>'
      : isScheduled
        ? '<i class="fa-solid fa-clock fa-spin"></i>'
        : '<i class="fa-solid fa-shield-halved"></i>';
  }

  if (liveBadge) {
    liveBadge.innerText = isFrozen
      ? `🛑 SYSTEM FROZEN (${meta.incidentId || "MAINTENANCE"})`
      : isScheduled
        ? `⏳ SCHEDULED AUTO-FREEZE (${meta.incidentId || "PENDING"})`
        : "🟢 SYSTEM ONLINE";
  }

  if (heroTitle) {
    heroTitle.innerText = isFrozen
      ? `ប្រព័ន្ធកំពុងត្រូវបានផ្អាកដំណើរការ (${meta.freezeType || "Maintenance Mode"})`
      : isScheduled
        ? `បានកំណត់ម៉ោងបិទប្រព័ន្ធស្វ័យប្រវត្តិ (${meta.freezeType || "Scheduled"})`
        : "ប្រព័ន្ធធនាគារកំពុងដំណើរការធម្មតា ១០០% (All Services Operational)";
  }

  if (heroSub) {
    heroSub.innerText = isFrozen
      ? `មូលហេតុ៖ ${meta.reason || "កំពុងថែទាំប្រព័ន្ធ"} • ចាប់ផ្តើម៖ ${meta.startTime || "N/A"} • បើកវិញអូតូ៖ ${meta.expectedEndTime || "N/A"}`
      : isScheduled
        ? `នឹងបិទអូតូនៅម៉ោង៖ ${meta.startTime} • និងបើកវិញអូតូនៅម៉ោង៖ ${meta.expectedEndTime} • មូលហេតុ៖ ${meta.reason}`
        : "រាល់ប្រតិបត្តិការផ្ទេរប្រាក់ ដាក់/ដកប្រាក់ ស្កេន QR ហាង និងកាត NFC ដំណើរការដោយរលូន។";
  }

  if (quickBtn) {
    if (isFrozen) {
      quickBtn.setAttribute(
        "onclick",
        "triggerSystemActionFromForm('RESUME_NOW')",
      );
      quickBtn.innerHTML =
        '<i class="fa-solid fa-circle-play" style="color:#10b981"></i> <span>បើកដំណើរការប្រព័ន្ធឥឡូវនេះ (Resume Now)</span>';
    } else if (isScheduled) {
      quickBtn.setAttribute("onclick", "cancelScheduledSystemFreeze()");
      quickBtn.innerHTML =
        '<i class="fa-solid fa-calendar-xmark" style="color:#ef4444"></i> <span>បោះបង់ការកំណត់ម៉ោង (Cancel Schedule)</span>';
    } else {
      quickBtn.setAttribute("onclick", "triggerSystemActionFromForm()");
      quickBtn.innerHTML =
        '<i class="fa-solid fa-power-off" style="color:#ef4444"></i> <span>បិទ ឬ កំណត់ម៉ោងបិទប្រព័ន្ធ</span>';
    }
  }

  if (submitBtn) {
    submitBtn.style.background = isFrozen
      ? "linear-gradient(135deg, #004d40, #10b981)"
      : "linear-gradient(135deg, #b91c1c, #ef4444)";
    submitBtn.innerHTML = isFrozen
      ? '<i class="fa-solid fa-circle-check"></i> <span>បើកដំណើរការប្រព័ន្ធឡើងវិញឥឡូវនេះ និងជូនដំណឹងអតិថិជន</span>'
      : '<i class="fa-solid fa-clock"></i> <span>អនុម័តកំណត់ម៉ោងបិទ-បើកអូតូ ឬ បិទប្រព័ន្ធឥឡូវនេះ</span>';
  }

  if (formHeaderTitle) {
    formHeaderTitle.innerText = isFrozen
      ? "១. បញ្ចប់ការថែទាំ និងបើកប្រព័ន្ធឡើងវិញ (Resume System Operations)"
      : "១. កំណត់ម៉ោងបិទ-បើកប្រព័ន្ធស្វ័យប្រវត្តិ និងជូនដំណឹងអតិថិជន (Auto-Schedule & Freeze Setup)";
  }

  // ២.២.២ អាប់ដេត KPI Cards ទាំង ៤ (បង្ហាញឈ្មោះពេញរបស់មន្ត្រីប្រតិបត្តិ)
  const kpiState = document.getElementById("asys-kpi-state");
  const kpiCount = document.getElementById("asys-kpi-count");
  const kpiEta = document.getElementById("asys-kpi-eta");
  const kpiOp = document.getElementById("asys-kpi-operator");

  if (kpiState) {
    kpiState.innerText = isFrozen
      ? "FROZEN 🛑"
      : isScheduled
        ? "SCHEDULED ⏳"
        : "ONLINE 🟢";
    kpiState.style.color = isFrozen
      ? "#ef4444"
      : isScheduled
        ? "#f59e0b"
        : "#10b981";
  }
  if (kpiCount) kpiCount.innerText = `${history.length} ដង`;
  if (kpiEta) {
    kpiEta.innerText =
      isFrozen || isScheduled
        ? meta.expectedEndTime || "មិនកំណត់"
        : "គ្មានការថែទាំ";
  }
  if (kpiOp) {
    const lastActor =
      meta.frozenBy ||
      meta.lastResumedBy ||
      (history[0] &&
        (history[0].resumedBy !== "-"
          ? history[0].resumedBy
          : history[0].frozenBy)) ||
      "គណៈគ្រប់គ្រងប្រព័ន្ធ";
    kpiOp.innerText = String(lastActor).replace(/^@/, "");
  }

  // ២.២.៣ អាប់ដេត Service Impact Pills
  document.querySelectorAll(".asys-svc-pill").forEach((pill) => {
    pill.innerText = isFrozen
      ? "ត្រូវបានផ្អាក (Blocked 🛑)"
      : isScheduled
        ? "ដំណើរការ (រង់ចាំដល់ម៉ោងបិទ ⏳)"
        : "ដំណើរការធម្មតា 🟢";
    pill.style.color = isFrozen
      ? "#ef4444"
      : isScheduled
        ? "#f59e0b"
        : "#10b981";
  });

  // ២.២.៤ នាឡិការាប់ថយក្រោយដោយស្វ័យប្រវត្តិ
  if (systemOutageInterval) clearInterval(systemOutageInterval);
  const timerBadge = document.getElementById("asysTimerBadge");

  if (timerBadge) {
    if (isScheduled && meta.startAtMs) {
      const tickSchedule = () => {
        const msLeft = Number(meta.startAtMs) - Date.now();
        if (msLeft <= 0) {
          clearInterval(systemOutageInterval);
          timerBadge.innerText = "⚡ កំពុងបិទប្រព័ន្ធដោយស្វ័យប្រវត្តិ...";
          loadSystemControlHub(false);
          if (typeof refreshAdminDashboard === "function")
            refreshAdminDashboard(false);
          return;
        }
        timerBadge.innerText = `⏳ នឹងបិទអូតូក្នុងរយៈពេល៖ ${formatCountdownHMS(msLeft)}`;
      };
      tickSchedule();
      systemOutageInterval = setInterval(tickSchedule, 1000);
    } else if (isFrozen) {
      const tickFrozen = () => {
        const now = Date.now();
        const elapsed = Math.max(
          0,
          now - Number(meta.frozenAtMs || meta.startAtMs || now),
        );
        let text = `⏱️ បានផ្អាក៖ ${formatCountdownHMS(elapsed)}`;

        if (meta.expectedEndAtMs) {
          const leftToResume = Number(meta.expectedEndAtMs) - now;
          if (leftToResume <= 0) {
            clearInterval(systemOutageInterval);
            timerBadge.innerText = "⚡ កំពុងបើកប្រព័ន្ធវិញដោយស្វ័យប្រវត្តិ...";
            loadSystemControlHub(false);
            if (typeof refreshAdminDashboard === "function")
              refreshAdminDashboard(false);
            return;
          }
          text += ` | 🟢 បើកវិញអូតូក្នុង៖ ${formatCountdownHMS(leftToResume)}`;
        }
        timerBadge.innerText = text;
      };
      tickFrozen();
      systemOutageInterval = setInterval(tickFrozen, 1000);
    } else {
      timerBadge.innerText = "";
    }
  }

  renderSystemHistoryTable();
}

// ============================================================================
// 📋 ជំពូកទី ៣៖ តារាងប្រវត្តិថែទាំប្រព័ន្ធ និងសកម្មភាពបញ្ជា (HISTORY TABLE & ACTIONS)
// ============================================================================

/**
 * 🔹 ៣.១ គូរតារាងប្រវត្តិរបាយការណ៍ថែទាំប្រព័ន្ធ (បង្ហាញឈ្មោះពេញរបស់មន្ត្រីប្រតិបត្តិ)
 */
window.renderSystemHistoryTable = function () {
  const tbody = document.getElementById("asysHistoryTableBody");
  if (!tbody) return;

  const kw = String(document.getElementById("asysSearchHistory")?.value || "")
    .toLowerCase()
    .trim();

  const list = (globalSystemStatusData.maintenanceHistory || []).filter(
    (item) => {
      if (!kw) return true;
      return (
        String(item.incidentId || "")
          .toLowerCase()
          .includes(kw) ||
        String(item.freezeType || "")
          .toLowerCase()
          .includes(kw) ||
        String(item.reason || "")
          .toLowerCase()
          .includes(kw) ||
        String(item.frozenBy || "")
          .toLowerCase()
          .includes(kw) ||
        String(item.resumedBy || "")
          .toLowerCase()
          .includes(kw)
      );
    },
  );

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center; padding:40px; color:var(--text-muted)">
          <i class="fa-solid fa-shield-heart" style="font-size:2rem; color:#10b981; margin-bottom:10px"></i><br/>
          មិនទាន់មានប្រវត្តិរបាយការណ៍បិទប្រព័ន្ធនៅឡើយទេ
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = list
    .map((item) => {
      let badgeHtml = `<span style="background:rgba(16,185,129,0.14); color:#10b981; border:1px solid rgba(16,185,129,0.3); padding:4px 10px; border-radius:20px; font-size:0.74rem; font-weight:800">✅ បានបើកវិញ</span>`;
      if (item.status === "FROZEN") {
        badgeHtml = `<span style="background:rgba(239,68,68,0.14); color:#ef4444; border:1px solid rgba(239,68,68,0.3); padding:4px 10px; border-radius:20px; font-size:0.74rem; font-weight:800">🛑 កំពុងផ្អាក</span>`;
      } else if (item.status === "SCHEDULED") {
        badgeHtml = `<span style="background:rgba(245,158,11,0.15); color:#f59e0b; border:1px solid rgba(245,158,11,0.35); padding:4px 10px; border-radius:20px; font-size:0.74rem; font-weight:800">⏳ រង់ចាំដល់ម៉ោង</span>`;
      } else if (item.status === "CANCELLED") {
        badgeHtml = `<span style="background:rgba(148,163,184,0.15); color:#64748b; border:1px solid rgba(148,163,184,0.35); padding:4px 10px; border-radius:20px; font-size:0.74rem; font-weight:800">🚫 បានបោះបង់</span>`;
      }

      const frozenByFullName = String(
        item.frozenBy || "គណៈគ្រប់គ្រងប្រព័ន្ធ",
      ).replace(/^@/, "");
      const resumedByFullName =
        item.resumedBy && item.resumedBy !== "-"
          ? String(item.resumedBy).replace(/^@/, "")
          : "-";

      return `
        <tr>
          <td>
            <div style="font-family:'JetBrains Mono',monospace; font-weight:900; color:#0d9488; font-size:0.86rem">${item.incidentId || "INC-SYS"}</div>
            <div style="font-size:0.76rem; color:var(--text-muted); font-weight:700">${item.freezeType || "Maintenance"}</div>
          </td>
          <td style="font-size:0.82rem; font-weight:700">${item.startTimeStr || "-"}</td>
          <td style="font-size:0.82rem; font-weight:700">
            <div>${item.actualEndTimeStr || "-"}</div>
            <div style="font-size:0.72rem; color:var(--text-muted)">គ្រោងបើកវិញ៖ ${item.expectedEndTimeStr || "-"}</div>
          </td>
          <td>
            <span style="font-family:'JetBrains Mono',monospace; font-weight:800; font-size:0.82rem; color:${item.status === "FROZEN" ? "#ef4444" : "var(--text-main)"}">
              ${item.durationText || "-"}
            </span>
          </td>
          <td style="max-width:280px">
            <div style="font-weight:700; font-size:0.84rem; color:var(--text-main)">${item.reason || "-"}</div>
            ${
              item.resolutionNote && item.resolutionNote !== "-"
                ? `<div style="font-size:0.75rem; color:#10b981; margin-top:3px">✔️ ${item.resolutionNote}</div>`
                : ""
            }
          </td>
          <td style="font-size:0.8rem">
            <div>បិទដោយ៖ <b>${frozenByFullName}</b></div>
            <div>បើកដោយ៖ <b>${resumedByFullName}</b></div>
          </td>
          <td style="text-align:right">${badgeHtml}</td>
        </tr>
      `;
    })
    .join("");
};

/**
 * 🔹 ៣.២ បោះបង់ការកំណត់ម៉ោងថែទាំប្រព័ន្ធដែលបានដាក់ទុកមុន
 */
window.cancelScheduledSystemFreeze = async function () {
  const confirmRes = await Swal.fire({
    title: "បោះបង់ការកំណត់ម៉ោងថែទាំ?",
    text: "តើអ្នកពិតជាចង់លុបចោលគម្រោងបិទប្រព័ន្ធដែលបានកំណត់ម៉ោងទុកនេះមែនទេ?",
    icon: "question",
    showCancelButton: true,
    confirmButtonColor: "#ef4444",
    cancelButtonColor: "#64748b",
    confirmButtonText: "បាទ, បោះបង់ការកំណត់ម៉ោង",
    cancelButtonText: "ទុកដដែល",
  });

  if (!confirmRes.isConfirmed) return;

  try {
    const res = await fetch("/api/admin/toggle-system", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ actionMode: "CANCEL_SCHEDULE" }),
    });
    const data = await res.json();
    if (data.success) {
      await loadSystemControlHub(false);
      Swal.fire(
        "បានបោះបង់!",
        "ការកំណត់ម៉ោងថែទាំប្រព័ន្ធត្រូវបានលុបចោល។",
        "success",
      );
    }
  } catch (e) {
    Swal.fire("Error", "មិនអាចភ្ជាប់ទៅកាន់ Server បានទេ!", "error");
  }
};

/**
 * 🔹 ៣.៣ អនុវត្តការបញ្ជាបិទភ្លាមៗ, កំណត់ម៉ោងបិទ/បើកអូតូ, ឬបើកប្រព័ន្ធវិញ
 */
window.triggerSystemActionFromForm = async function (forcedActionMode = null) {
  const isCurrentlyFrozen = globalSystemStatusData.isSystemFrozen;
  const freezeType =
    document.getElementById("asysFreezeType")?.value || "Scheduled Maintenance";
  const startRaw = document.getElementById("asysStartTime")?.value || "";
  const endRaw = document.getElementById("asysExpectedEnd")?.value || "";
  const reasonVal = (
    document.getElementById("asysReasonInput")?.value || ""
  ).trim();
  const notifyUsers =
    document.getElementById("asysNotifyToggle")?.checked !== false;

  if (!isCurrentlyFrozen && !reasonVal) {
    Swal.fire({
      icon: "warning",
      title: "សូមបញ្ចូលមូលហេតុ!",
      text: "សូមសរសេរមូលហេតុនៃការផ្អាកប្រព័ន្ធ ឬជ្រើសរើសគំរូមូលហេតុរហ័សជាមុនសិន។",
    });
    return;
  }

  const startAtMs = startRaw ? new Date(startRaw).getTime() : Date.now();
  const expectedEndAtMs = endRaw ? new Date(endRaw).getTime() : null;

  if (!isCurrentlyFrozen && expectedEndAtMs && expectedEndAtMs <= startAtMs) {
    Swal.fire({
      icon: "warning",
      title: "ម៉ោងបញ្ចប់មិនត្រឹមត្រូវ!",
      text: "ម៉ោងរំពឹងបើកដំណើរការវិញ (Estimated Resume) ត្រូវតែធំជាងម៉ោងចាប់ផ្តើមបិទ!",
    });
    return;
  }

  const isFutureSchedule =
    !isCurrentlyFrozen &&
    forcedActionMode !== "FORCE_FREEZE_NOW" &&
    startAtMs > Date.now() + 30000;

  const fmtTime = (val) =>
    val ? new Date(val).toLocaleString("en-US", { hour12: true }) : "";

  const confirmRes = await Swal.fire({
    title: isCurrentlyFrozen
      ? "បើកដំណើរការប្រព័ន្ធវិញឥឡូវនេះ?"
      : isFutureSchedule
        ? "កំណត់ម៉ោងបិទ-បើកប្រព័ន្ធស្វ័យប្រវត្តិ? ⏰"
        : "ផ្អាកប្រព័ន្ធធនាគារឥឡូវនេះ? 🛑",
    html: isCurrentlyFrozen
      ? `អតិថិជនទាំងអស់នឹងអាចធ្វើប្រតិបត្តិការបានធម្មតាវិញភ្លាមៗ។`
      : `<div style="text-align:left; background:#f8fafc; padding:12px 14px; border-radius:10px; margin-top:10px; font-size:0.84rem; color:#0f172a; line-height:1.6">
          <b>• របៀបដំណើរការ៖</b> <span style="color:${isFutureSchedule ? "#ea580c" : "#ef4444"}; font-weight:800">${isFutureSchedule ? "រង់ចាំដល់ម៉ោង ទើបបិទអូតូ (Scheduled Auto-Freeze)" : "បិទភ្លាមៗឥឡូវនេះ (Immediate Freeze)"}</span><br/>
          <b>• ចាប់ផ្តើមបិទនៅម៉ោង៖</b> ${fmtTime(startRaw) || "ឥឡូវនេះ"}<br/>
          <b>• បើកដំណើរការវិញអូតូ៖</b> <span style="color:#10b981; font-weight:800">${fmtTime(endRaw) || "មិនកំណត់"}</span><br/>
          <b>• មូលហេតុ៖</b> ${reasonVal}
        </div>`,
    icon: isFutureSchedule ? "info" : "warning",
    showCancelButton: true,
    confirmButtonColor: isCurrentlyFrozen
      ? "#10b981"
      : isFutureSchedule
        ? "#ea580c"
        : "#ef4444",
    cancelButtonColor: "#64748b",
    confirmButtonText: isCurrentlyFrozen
      ? "បាទ, បើកដំណើរការវិញ 🟢"
      : isFutureSchedule
        ? "បាទ, កំណត់ម៉ោងអូតូ ⏰"
        : "បាទ, ផ្អាកឥឡូវនេះ 🛑",
    cancelButtonText: "បោះបង់",
  });

  if (!confirmRes.isConfirmed) return;

  try {
    const res = await fetch("/api/admin/toggle-system", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        actionMode:
          forcedActionMode ||
          (isCurrentlyFrozen ? "RESUME_NOW" : "FREEZE_OR_SCHEDULE"),
        targetFreezeState: !isCurrentlyFrozen,
        freezeType,
        reason: reasonVal,
        startTime: fmtTime(startRaw),
        expectedEndTime: fmtTime(endRaw),
        startAtMs,
        expectedEndAtMs,
        resolutionNote: isCurrentlyFrozen ? reasonVal : "",
        notifyUsers,
      }),
    });

    const data = await res.json();
    if (data.success) {
      document.getElementById("asysReasonInput").value = "";
      await loadSystemControlHub(false);
      if (typeof refreshAdminDashboard === "function") {
        refreshAdminDashboard(false);
      }

      Swal.fire({
        icon: "success",
        title: data.isScheduled
          ? "បានកំណត់ម៉ោងបិទ-បើកអូតូជោគជ័យ! ⏰"
          : data.isSystemFrozen
            ? "ប្រព័ន្ធត្រូវបានផ្អាកបណ្តោះអាសន្ន! 🛑"
            : "ប្រព័ន្ធដំណើរការធម្មតាវិញហើយ! 🟢",
        html: data.isScheduled
          ? `ប្រព័ន្ធនឹងបិទដោយស្វ័យប្រវត្តិនៅម៉ោង <b>${fmtTime(startRaw)}</b> ហើយបើកវិញដោយស្វ័យប្រវត្តិនៅម៉ោង <b>${fmtTime(endRaw)}</b>!`
          : data.broadcastCount > 0
            ? `បានកត់ត្រារបាយការណ៍ និងផ្ញើសារជូនដំណឹងទៅកាន់អតិថិជនចំនួន <b>${data.broadcastCount} នាក់</b> រួចរាល់!`
            : "បានកត់ត្រាចូលក្នុងរបាយការណ៍ប្រព័ន្ធរួចរាល់!",
      });
    }
  } catch (err) {
    Swal.fire("Error", "មិនអាចភ្ជាប់ទៅកាន់ Server បានទេ!", "error");
  }
};

/**
 * 🔹 ៣.៤ ទាញយកប្រវត្តិរបាយការណ៍ថែទាំប្រព័ន្ធជាឯកសារ CSV
 */
window.exportSystemMaintenanceCSV = function () {
  const list = globalSystemStatusData.maintenanceHistory || [];
  if (list.length === 0) {
    Swal.fire(
      "គ្មានទិន្នន័យ",
      "មិនទាន់មានប្រវត្តិរបាយការណ៍សម្រាប់ទាញយកទេ!",
      "info",
    );
    return;
  }

  const headers = [
    "Incident ID",
    "Category",
    "Start Time",
    "Expected Resume",
    "Actual Resume",
    "Duration",
    "Reason",
    "Resolution Note",
    "Frozen By",
    "Resumed By",
    "Status",
  ];

  const rows = list.map((item) => [
    item.incidentId || "",
    item.freezeType || "",
    item.startTimeStr || "",
    item.expectedEndTimeStr || "",
    item.actualEndTimeStr || "",
    item.durationText || "",
    `"${String(item.reason || "").replace(/"/g, '""')}"`,
    `"${String(item.resolutionNote || "").replace(/"/g, '""')}"`,
    String(item.frozenBy || "").replace(/^@/, ""),
    String(item.resumedBy || "").replace(/^@/, ""),
    item.status || "",
  ]);

  const csvContent =
    "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `UPAY_System_Maintenance_Report_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
};

window.toggleSystemFreeze = function () {
  const sysBtn = document.getElementById("menu-system");
  showSection("system", sysBtn);
};

// ============================================================================
// 🎬 ជំពូកទី ៤៖ ការឆែកស្ថានភាពប្រព័ន្ធដោយស្វ័យប្រវត្តិរៀងរាល់ ១៥ វិនាទី (AUTO-POLLING)
// ============================================================================
if (!systemAutoPollInterval) {
  systemAutoPollInterval = setInterval(() => {
    const activeSec = sessionStorage.getItem("activeSection");
    if (activeSec === "system") {
      loadSystemControlHub(false);
    }
  }, 15000);
}
