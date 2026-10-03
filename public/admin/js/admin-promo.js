// ========================================================================
// ឯកសារ: admin-promo.js
// អត្ថន័យ: គ្រប់គ្រងលេខកូដប្រូម៉ូសិន (Promo Codes)
// ========================================================================

let allPromoCodes = [];

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

  if (!code || !reward) {
    return Swal.fire({
      icon: "warning",
      title: "បំពេញមិនគ្រប់",
      text: "សូមបញ្ចូលឈ្មោះកូដ និងទឹកប្រាក់រង្វាន់!",
      customClass: { popup: "premium-swal" },
    });
  }

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
    } else {
      Swal.fire({
        icon: "error",
        title: "បរាជ័យ",
        text: data.message,
        customClass: { popup: "premium-swal" },
      });
    }
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
    if (data.success && data.promos && data.promos.length > 0) {
      allPromoCodes = data.promos;
      renderPromoCodes(allPromoCodes);
    } else {
      allPromoCodes = [];
      const tbody = document.getElementById("promoTableBody");
      if (tbody)
        tbody.innerHTML =
          '<tr><td colspan="5" style="text-align:center; padding:40px; color:var(--text-muted);"><i class="fa-solid fa-ticket" style="font-size:2rem; margin-bottom:10px; opacity:0.5;"></i><br>មិនទាន់មានកូដប្រូម៉ូសិននៅឡើយទេ</td></tr>';
    }
  } catch (e) {}
};

window.filterPromoCodes = function () {
  const searchBox = document.getElementById("searchPromoBox"); // (ត្រូវប្រាកដថាអ្នកបានបន្ថែម Input នេះក្នុង HTML)
  const keyword = searchBox ? searchBox.value : "";

  if (typeof window.standardDataSearch === "function") {
    const filteredPromos = window.standardDataSearch(allPromoCodes, keyword, [
      "code",
    ]);
    renderPromoCodes(filteredPromos);
  } else {
    const lowerKeyword = keyword.toLowerCase().trim();
    const filteredPromos = allPromoCodes.filter((p) =>
      p.code.toLowerCase().includes(lowerKeyword),
    );
    renderPromoCodes(filteredPromos);
  }
};

window.renderPromoCodes = function (promosToRender) {
  const tbody = document.getElementById("promoTableBody");
  if (!tbody) return;

  if (!promosToRender || promosToRender.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="5" style="text-align:center; padding:40px; color:var(--text-muted);">រកមិនឃើញកូដនេះទេ</td></tr>';
    return;
  }

  tbody.innerHTML = promosToRender
    .map((p) => {
      const status = p.isActive
        ? `<span style="color:var(--secondary); font-weight:bold;">Active 🟢</span>`
        : `<span style="color:#ef4444; font-weight:bold;">Disabled 🛑</span>`;
      const usage = `${p.usedCount} / ${p.maxUsage}`;
      const expiry = p.expiresAt
        ? new Date(p.expiresAt).toLocaleDateString("en-GB")
        : "គ្មានកំណត់";

      return `
        <tr style="border-bottom: 1px solid var(--border);">
          <td style="font-weight:900; color:var(--accent); font-size:1.1rem; letter-spacing:1.5px;">${p.code}</td>
          <td style="color:var(--secondary); font-weight:bold; font-size:1.1rem;">$${p.rewardValue.toFixed(2)}</td>
          <td><b>${usage} នាក់</b><br><span style="font-size:0.8rem; color:var(--text-muted);">ផុតកំណត់: ${expiry}</span></td>
          <td>${status}</td>
          <td style="text-align: right;">
            <label class="switch"><input type="checkbox" ${p.isActive ? "checked" : ""} onchange="togglePromoStatus('${p._id}')"><span class="slider"></span></label>
          </td>
        </tr>`;
    })
    .join("");
};

window.togglePromoStatus = async function (id) {
  await fetch("/api/admin/promo/toggle", {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ id }),
  });
  loadPromoCodes();
};
