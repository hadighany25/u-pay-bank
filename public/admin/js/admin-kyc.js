// ========================================================================
// ឯកសារ: admin-kyc.js (100% Pro Redesign - KYC Compliance Workbench)
// អត្ថន័យ: គ្រប់គ្រងការត្រួតពិនិត្យ អនុម័ត បដិសេធ និងកែប្រែ KYC តាមស្តង់ដារ Maker-Checker
// ========================================================================

let currentKycPage = 1;
const KYC_PER_PAGE = 5; // 🟢 បង្ហាញ ៥ គណនីក្នុង ១ ទំព័រ
let filteredKycList = [];
let gkycCurrentStatusFilter = "PENDING"; // 'PENDING', 'VERIFIED', 'REJECTED', 'UNVERIFIED', 'DUPLICATE', 'ALL'
let gkycSelectedUsername = null;

// 🔍 ១. ចាប់យកអត្តសញ្ញាណ Admin កំពុង Login (ទាំង Username និង Full Name)
function gkycGetAdminIdentity() {
  if (typeof c360GetActiveAdminIdentity === "function") {
    return c360GetActiveAdminIdentity();
  }
  let username = "";
  let fullName = "";
  try {
    const tokenKeys = ["adminToken", "token", "upay_admin_token"];
    for (const k of tokenKeys) {
      const tk = localStorage.getItem(k) || sessionStorage.getItem(k);
      if (tk && tk.includes(".")) {
        try {
          const payload = JSON.parse(atob(tk.split(".")[1]));
          if (payload && payload.username && payload.role !== "user") {
            username = String(payload.username).trim();
            if (payload.fullName) fullName = String(payload.fullName).trim();
            break;
          }
        } catch (err) {}
      }
    }
    const domDisp = document.getElementById("adminNameDisplay")?.innerText;
    if (domDisp && !fullName) fullName = domDisp.replace(/^@/, "").trim();
  } catch (e) {}

  return {
    username,
    usernameLower: username.toLowerCase(),
    fullName,
    fullNameLower: fullName.toLowerCase(),
  };
}

// 🔍 ២. រកមើលគណនីទាំងអស់ដែលប្រើលេខអត្តសញ្ញាណប័ណ្ណដូចគ្នា
function gkycFindSameIdAccounts(idNumber) {
  const cleanId = String(idNumber || "").trim();
  if (!cleanId || cleanId === "N/A" || typeof globalUsersData === "undefined") {
    return [];
  }
  return (globalUsersData || []).filter(
    (u) => String(u.idNumber || "").trim() === cleanId,
  );
}

// 🔍 ៣. ឆែកថាតើ Admin កំពុងមើលជា Maker នៃគណនីនោះឬអត់
function gkycIsAdminMakerForUser(user) {
  const adminIdent = gkycGetAdminIdentity();
  const rawUploader = String(user.kycUploadedBy || "")
    .replace(/^@/, "")
    .trim();
  const uploaderLower = rawUploader.toLowerCase();
  const customerUsernameLower = String(user.username || "").toLowerCase();

  const isUploadedByCustomer =
    !rawUploader ||
    rawUploader === "អតិថិជនផ្ទាល់" ||
    uploaderLower === customerUsernameLower;

  const isCurrentAdminTheMaker =
    !isUploadedByCustomer &&
    ((adminIdent.usernameLower !== "" &&
      uploaderLower === adminIdent.usernameLower) ||
      (adminIdent.fullNameLower !== "" &&
        uploaderLower === adminIdent.fullNameLower));

  return {
    isUploadedByCustomer,
    isCurrentAdminTheMaker,
    rawUploader: rawUploader || "អតិថិជនផ្ទាល់",
  };
}

// ========================================================================
// 🔄 SECTION 2: DATA REFRESH, KPI STATS & FILTERING
// ========================================================================

window.gkycRefreshAllData = async function () {
  const spinIcon = document.getElementById("gkyc-refresh-spin-icon");
  if (spinIcon) spinIcon.classList.add("fa-spin");

  try {
    if (typeof loadData === "function") {
      await loadData();
    }
    setTimeout(() => {
      initKycTable();
      if (
        gkycSelectedUsername &&
        document.getElementById("kyc-details-view")?.style.display === "block"
      ) {
        const freshUser = (globalUsersData || []).find(
          (u) => u.username === gkycSelectedUsername,
        );
        if (freshUser) renderKycDetailsContent(freshUser);
      }
      if (spinIcon) spinIcon.classList.remove("fa-spin");
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "ទិន្នន័យ KYC ត្រូវបានធ្វើបច្ចុប្បន្នភាព!",
        showConfirmButton: false,
        timer: 1200,
        customClass: { popup: "kh-text" },
      });
    }, 300);
  } catch (e) {
    if (spinIcon) spinIcon.classList.remove("fa-spin");
  }
};

window.gkycSetStatusFilter = function (filterKey) {
  gkycCurrentStatusFilter = filterKey;
  currentKycPage = 1;

  document.querySelectorAll(".gkyc-filter-pill").forEach((btn) => {
    btn.classList.toggle(
      "active",
      btn.getAttribute("data-filter") === filterKey,
    );
  });

  document.querySelectorAll(".gkyc-kpi-card").forEach((box) => {
    box.classList.remove("active-kpi");
  });
  const activeKpi = document.getElementById(`gkyc-kpi-${filterKey}`);
  if (activeKpi) activeKpi.classList.add("active-kpi");

  initKycTable();
};

function filterKycTable() {
  currentKycPage = 1;
  initKycTable();
}

function initKycTable() {
  const allUsers = (
    typeof globalUsersData !== "undefined" && Array.isArray(globalUsersData)
      ? globalUsersData
      : window.globalPendingKycData || []
  ).filter((u) => u && u.role !== "admin" && u.username !== "superadmin");

  // ១. គណនាចំនួន ID ដើម្បីដឹងថាគណនីណាខ្លះមានលេខអត្តសញ្ញាណប័ណ្ណស្ទួនពិតប្រាកដ (>= 2 គណនី)
  const idCounts = {};
  allUsers.forEach((u) => {
    const cleanId = String(u.idNumber || "").trim();
    if (cleanId && cleanId !== "N/A") {
      idCounts[cleanId] = (idCounts[cleanId] || 0) + 1;
    }
  });

  // ២. គណនាស្ថិតិ KPI ទាំង ៥
  let pendingCount = 0;
  let verifiedCount = 0;
  let rejectedCount = 0;
  let duplicateCount = 0;

  allUsers.forEach((u) => {
    const st = (u.kycStatus || "unverified").toLowerCase();
    if (st === "pending") pendingCount++;
    else if (st === "verified" || st === "approved") verifiedCount++;
    else if (st === "rejected") rejectedCount++;

    const cleanId = String(u.idNumber || "").trim();
    if (cleanId && idCounts[cleanId] > 1) {
      duplicateCount++;
    }
  });

  const setTxt = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.innerText = val;
  };
  setTxt("gkyc-stat-pending", pendingCount);
  setTxt("gkyc-stat-verified", verifiedCount);
  setTxt("gkyc-stat-rejected", rejectedCount);
  setTxt("gkyc-stat-duplicate", duplicateCount);
  setTxt("gkyc-stat-all", allUsers.length);

  // ៣. Filter តាម Status និងពាក្យស្វែងរក
  const keyword = (document.getElementById("searchKycBox")?.value || "")
    .toLowerCase()
    .trim();

  filteredKycList = allUsers.filter((u) => {
    const st = (u.kycStatus || "unverified").toLowerCase();
    const cleanId = String(u.idNumber || "").trim();
    const isDup = Boolean(cleanId && idCounts[cleanId] > 1);

    if (gkycCurrentStatusFilter === "PENDING" && st !== "pending") return false;
    if (
      gkycCurrentStatusFilter === "VERIFIED" &&
      st !== "verified" &&
      st !== "approved"
    )
      return false;
    if (gkycCurrentStatusFilter === "REJECTED" && st !== "rejected")
      return false;
    if (gkycCurrentStatusFilter === "UNVERIFIED" && st !== "unverified")
      return false;
    if (gkycCurrentStatusFilter === "DUPLICATE" && !isDup) return false;

    if (keyword) {
      const searchStr = [
        u.fullName,
        u.username,
        u.email,
        u.phone,
        u.phoneNumber,
        u.idNumber,
        u.userId,
        u.kycUploadedBy,
        u.mainAccounts?.USD?.accountNumber,
        u.mainAccounts?.KHR?.accountNumber,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchStr.includes(keyword);
    }
    return true;
  });

  // តម្រៀបឱ្យ Pending នៅខាងលើគេបង្អស់
  const priorityOrder = {
    pending: 1,
    rejected: 2,
    unverified: 3,
    verified: 4,
    approved: 4,
  };
  filteredKycList.sort((a, b) => {
    const pA = priorityOrder[(a.kycStatus || "unverified").toLowerCase()] || 5;
    const pB = priorityOrder[(b.kycStatus || "unverified").toLowerCase()] || 5;
    return pA - pB;
  });

  renderKycTablePage();
}

// ========================================================================
// 📊 SECTION 3: PAGINATION & TABLE RENDERING
// ========================================================================

function renderKycTablePage() {
  const tbody = document.getElementById("kycTableBody");
  const paginationContainer = document.getElementById("kycPaginationFooter");
  if (!tbody) return;

  if (!filteredKycList || filteredKycList.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 55px 20px; color: var(--text-muted);">
          <i class="fa-solid fa-id-card-clip" style="font-size: 3rem; opacity: 0.3; margin-bottom: 12px; display: block;"></i>
          <div style="font-weight: 800; font-size: 1rem; color: var(--text-main);">គ្មានទិន្នន័យសំណើ KYC ក្នុងផ្នែកនេះទេ</div>
          <div style="font-size: 0.85rem; margin-top: 4px;">សូមសាកល្បងប្តូរប្រភេទ Filter ខាងលើ ឬស្វែងរកឈ្មោះផ្សេង។</div>
        </td>
      </tr>
    `;
    if (paginationContainer) paginationContainer.style.display = "none";
    return;
  }

  const totalPages = Math.ceil(filteredKycList.length / KYC_PER_PAGE) || 1;
  if (currentKycPage > totalPages) currentKycPage = totalPages;
  if (currentKycPage < 1) currentKycPage = 1;

  const startIndex = (currentKycPage - 1) * KYC_PER_PAGE;
  const pageItems = filteredKycList.slice(
    startIndex,
    startIndex + KYC_PER_PAGE,
  );

  tbody.dataset.gkycCustomRendered = "true";
  tbody.innerHTML = pageItems
    .map((u) => {
      const st = (u.kycStatus || "unverified").toLowerCase();
      const fullNameUpper = String(u.fullName || u.username).toUpperCase();
      const idImg = u.kycDocument || u.kycImage || u.idCardImage || "";
      const selfieImg = u.selfieUrl || "";

      const makerInfo = gkycIsAdminMakerForUser(u);
      const sameIdAccs = gkycFindSameIdAccounts(u.idNumber);
      const hasDupId = sameIdAccs.length > 1;

      // រូបភាព مصغر ក្នុងតារាង
      let docsThumbHtml = "";
      if (idImg || selfieImg) {
        docsThumbHtml = `
          <div class="gkyc-doc-thumb-pair">
            ${
              idImg
                ? `<img src="${idImg}" class="gkyc-thumb-id" onclick="if(typeof c360ViewFullImage==='function') c360ViewFullImage('${idImg}', 'អត្តសញ្ញាណប័ណ្ណ៖ ${fullNameUpper}')" title="ចុចពង្រីកមើលរូបអត្តសញ្ញាណប័ណ្ណ">`
                : `<span style="font-size:0.72rem; color:#ef4444; font-weight:700;">គ្មានរូប ID</span>`
            }
            ${
              selfieImg
                ? `<img src="${selfieImg}" class="gkyc-thumb-selfie" onclick="if(typeof c360ViewFullImage==='function') c360ViewFullImage('${selfieImg}', 'រូបថត Selfie៖ ${fullNameUpper}')" title="ចុចពង្រីកមើលរូប Selfie">`
                : `<span style="font-size:0.72rem; color:#ef4444; font-weight:700;">គ្មាន Selfie</span>`
            }
          </div>
        `;
      } else {
        docsThumbHtml = `<span style="font-size: 0.76rem; color: var(--text-muted); background: var(--bg-body); padding: 4px 10px; border-radius: 6px; border: 1px dashed var(--border);">មិនទាន់បង្ហោះរូបភាព</span>`;
      }

      // ផ្លាកស្ថានភាព និងសិទ្ធិ Maker-Checker
      let statusBadgeHtml = "";
      if (st === "pending") {
        statusBadgeHtml = `
          <div style="display:flex; flex-direction:column; gap:4px; align-items:flex-start;">
            <span style="background: rgba(245, 158, 11, 0.15); color: #d97706; border: 1px solid rgba(245, 158, 11, 0.35); padding: 3px 10px; border-radius: 20px; font-size: 0.74rem; font-weight: 800;">
              <i class="fa-solid fa-clock"></i> រង់ចាំអនុម័ត
            </span>
            ${
              makerInfo.isCurrentAdminTheMaker
                ? `<span style="font-size:0.68rem; color:#ef4444; font-weight:800;"><i class="fa-solid fa-lock"></i> អ្នកជា Maker (រង់ចាំ Checker)</span>`
                : `<span style="font-size:0.68rem; color:#10b981; font-weight:800;"><i class="fa-solid fa-check-double"></i> អាចពិនិត្យអនុម័តបាន</span>`
            }
          </div>
        `;
      } else if (st === "verified" || st === "approved") {
        statusBadgeHtml = `
          <div style="display:flex; flex-direction:column; gap:3px; align-items:flex-start;">
            <span style="background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.35); padding: 3px 10px; border-radius: 20px; font-size: 0.74rem; font-weight: 800;">
              <i class="fa-solid fa-circle-check"></i> អនុម័តរួចរាល់
            </span>
            <span style="font-size:0.68rem; color:var(--text-muted); font-weight:700;">ដោយ: @${u.kycApprovedBy || "System"}</span>
          </div>
        `;
      } else if (st === "rejected") {
        statusBadgeHtml = `
          <div style="display:flex; flex-direction:column; gap:3px; align-items:flex-start;">
            <span style="background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.35); padding: 3px 10px; border-radius: 20px; font-size: 0.74rem; font-weight: 800;">
              <i class="fa-solid fa-circle-xmark"></i> បានបដិសេធ
            </span>
            <span style="font-size:0.68rem; color:#ef4444; font-weight:700; max-width:140px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${u.kycRejectReason || ""}">${u.kycRejectReason || ""}</span>
          </div>
        `;
      } else {
        statusBadgeHtml = `
          <span style="background: rgba(148, 163, 184, 0.15); color: var(--text-muted); padding: 3px 10px; border-radius: 20px; font-size: 0.74rem; font-weight: 800;">
            មិនទាន់មានឯកសារ
          </span>
        `;
      }

      // ប៊ូតុងសកម្មភាពរហ័សក្នុងតារាង
      let quickActionBtns = `
        <button type="button" class="gkyc-btn-act" style="background: #004d40; color: #ffffff;" onclick="openKycDetails('${u.username}')">
          <i class="fa-solid fa-magnifying-glass-chart"></i> ពិនិត្យលម្អិត
        </button>
      `;

      if (st === "pending" && !makerInfo.isCurrentAdminTheMaker) {
        quickActionBtns = `
          <button type="button" class="gkyc-btn-act" style="background: #ecfdf5; color: #059669; border-color: #a7f3d0;" title="អនុម័តរហ័ស" onclick="gkycTriggerAction('${u.username}', 'approved')">
            <i class="fa-solid fa-check"></i> អនុម័ត
          </button>
          <button type="button" class="gkyc-btn-act" style="background: #fef2f2; color: #ef4444; border-color: #fca5a5;" title="បដិសេធរហ័ស" onclick="gkycPromptReject('${u.username}', 'reject')">
            <i class="fa-solid fa-xmark"></i>
          </button>
          ${quickActionBtns}
        `;
      }

      return `
        <tr style="border-bottom: 1px solid var(--border, #e2e8f0); transition: 0.15s;" onmouseover="this.style.background='rgba(15, 23, 42, 0.015)'" onmouseout="this.style.background='transparent'">
          <!-- ១. ព័ត៌មានអតិថិជន -->
          <td style="padding: 14px 12px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <img src="${u.profileImage || "../images/default-avatar.png"}" style="width: 42px; height: 42px; border-radius: 50%; object-fit: cover; border: 1px solid var(--border);" onerror="this.src='../images/default-avatar.png'">
              <div>
                <div style="font-weight: 800; font-size: 0.94rem; color: var(--text-main); display: flex; align-items: center; gap: 6px;">
                  <span>${fullNameUpper}</span>
                  <button type="button" onclick="gkycJumpToCustomer360('${u.username}')" title="បើកមើលក្នុង Customer 360° (Tab 5)" style="background: var(--bg-body); border: 1px solid var(--border); color: #3b82f6; border-radius: 6px; padding: 2px 6px; font-size: 0.68rem; cursor: pointer; font-weight: 800;">
                    360° <i class="fa-solid fa-arrow-up-right-from-square" style="font-size: 0.6rem;"></i>
                  </button>
                </div>
                <div style="font-size: 0.76rem; color: var(--text-muted); margin-top: 2px;">
                  @${u.username} • <i class="fa-solid fa-phone" style="font-size: 0.65rem;"></i> ${u.phone || u.phoneNumber || "N/A"}
                </div>
              </div>
            </div>
          </td>

          <!-- ២. លេខអត្តសញ្ញាណប័ណ្ណ & ស្ទួន -->
          <td style="padding: 14px 12px;">
            <div style="font-family: 'JetBrains Mono', monospace; font-weight: 800; font-size: 0.92rem; color: var(--text-main);">
              ${u.idNumber || '<span style="color:#94a3b8; font-weight:600;">មិនទាន់មាន</span>'}
            </div>
            <div style="font-size: 0.74rem; color: var(--text-muted); margin-top: 3px;">
              DOB: ${u.dob || "N/A"} • ${u.gender || "N/A"}
            </div>
            ${
              hasDupId
                ? `<div style="margin-top: 4px; display: inline-flex; align-items: center; gap: 4px; background: rgba(249, 115, 22, 0.15); color: #ea580c; padding: 2px 8px; border-radius: 6px; font-size: 0.68rem; font-weight: 800;">
                     <i class="fa-solid fa-triangle-exclamation"></i> ស្ទួន ${sameIdAccs.length} គណនី
                   </div>`
                : ""
            }
          </td>

          <!-- ៣. រូបភាពឯកសារ -->
          <td style="padding: 14px 12px;">
            ${docsThumbHtml}
          </td>

          <!-- ៤. អ្នកបញ្ជូន (Maker) & កាលបរិច្ឆេទ -->
          <td style="padding: 14px 12px;">
            <div style="font-size: 0.8rem; font-weight: 800; color: var(--text-main);">
              ${
                makerInfo.isUploadedByCustomer
                  ? `<span style="color:#0284c7;"><i class="fa-solid fa-mobile-screen"></i> អតិថិជនផ្ទាល់</span>`
                  : `<span style="color:#7e22ce;"><i class="fa-solid fa-user-shield"></i> @${makerInfo.rawUploader}</span>`
              }
            </div>
            <div style="font-size: 0.72rem; color: var(--text-muted); font-family: monospace; margin-top: 3px;">
              ${u.kycSubmittedAt || "N/A"}
            </div>
          </td>

          <!-- ៥. ស្ថានភាព -->
          <td style="padding: 14px 12px;">
            ${statusBadgeHtml}
          </td>

          <!-- ៦. សកម្មភាព -->
          <td style="padding: 14px 12px; text-align: right; white-space: nowrap;">
            <div style="display: inline-flex; gap: 6px; align-items: center;">
              ${quickActionBtns}
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  // បង្ហាញ Pagination Footer ជានិច្ចតាមទម្រង់ "ថយក្រោយ | ទំព័រ 1 នៃ 22 | បន្ទាប់"
  if (paginationContainer) {
    paginationContainer.style.display = "flex";
    const pageInfo = document.getElementById("kycPageInfo");
    if (pageInfo) {
      pageInfo.innerText = `ទំព័រ ${currentKycPage} នៃ ${totalPages} (សរុប ${filteredKycList.length} គណនី)`;
    }
    const prevBtn = document.getElementById("kycPrevBtn");
    const nextBtn = document.getElementById("kycNextBtn");
    if (prevBtn) {
      prevBtn.disabled = currentKycPage === 1;
      prevBtn.style.opacity = currentKycPage === 1 ? "0.5" : "1";
    }
    if (nextBtn) {
      nextBtn.disabled = currentKycPage >= totalPages;
      nextBtn.style.opacity = currentKycPage >= totalPages ? "0.5" : "1";
    }
  }
}

function changeKycPage(step) {
  const totalPages = Math.ceil(filteredKycList.length / KYC_PER_PAGE) || 1;
  currentKycPage += step;
  if (currentKycPage < 1) currentKycPage = 1;
  if (currentKycPage > totalPages) currentKycPage = totalPages;
  renderKycTablePage();
}

// លោតទៅកាន់ Customer 360° ហើយបើក Tab 5 (KYC) ឱ្យអូតូ
window.gkycJumpToCustomer360 = function (username) {
  const searchInput = document.getElementById("searchC360");
  if (searchInput) {
    searchInput.value = username;
    const c360Nav = document.querySelector(`[onclick*="sec-c360"]`);
    if (c360Nav) c360Nav.click();
    if (typeof currentC360ActiveTab !== "undefined") {
      currentC360ActiveTab = "kyc";
    }
    if (typeof searchCustomer360 === "function") {
      searchCustomer360();
    }
  }
};

// ========================================================================
// 🖥️ SECTION 4: KYC DETAILS WORKBENCH (ប្រើប្រាស់មុខងារ និង API រួមជាមួយ Tab 5)
// ========================================================================

function openKycDetails(username) {
  const user = (globalUsersData || []).find((u) => u.username === username);
  if (!user) {
    Swal.fire({
      icon: "error",
      title: "បរាជ័យ",
      text: "រកមិនឃើញទិន្នន័យអតិថិជននេះទេ!",
      customClass: { popup: "kh-text" },
    });
    return;
  }

  gkycSelectedUsername = username;
  window.currentC360User = user; // Sync ជាមួយអថេរគោលដើម្បីប្រើមុខងារ Upload & Edit រួមគ្នាបាន 100%

  document.getElementById("kyc-list-view").style.display = "none";
  document.getElementById("kyc-details-view").style.display = "block";

  const topAct = document.getElementById("gkyc-detail-top-actions");
  if (topAct) {
    topAct.innerHTML = `
      <button type="button" onclick="gkycJumpToCustomer360('${user.username}')" style="padding: 9px 15px; border-radius: 10px; background: rgba(59, 130, 246, 0.12); color: #3b82f6; border: 1px solid rgba(59, 130, 246, 0.3); font-weight: 800; font-size: 0.82rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
        <i class="fa-solid fa-id-card"></i> បើកមើលក្នុង Customer 360°
      </button>
    `;
  }

  renderKycDetailsContent(user);
}

function closeKycDetails() {
  gkycSelectedUsername = null;
  document.getElementById("kyc-details-view").style.display = "none";
  document.getElementById("kyc-list-view").style.display = "block";
  initKycTable();
}

/**
 * 📌 គូរផ្ទាំង KYC Compliance Workbench (Split-Screen UI ប្លែកពី 360° តែមានគ្រប់មុខងារដូចគ្នា)
 */
function renderKycDetailsContent(user) {
  const container = document.getElementById("kyc-details-content");
  if (!container) return;

  const st = (user.kycStatus || "unverified").toLowerCase();
  const idUrl = user.kycDocument || user.kycImage || user.idCardImage || "";
  const selfieUrl = user.selfieUrl || "";
  const fullNameUpper = String(user.fullName || user.username).toUpperCase();

  const makerInfo = gkycIsAdminMakerForUser(user);
  const sameIdAccounts = gkycFindSameIdAccounts(user.idNumber);
  const hasRealDuplicateId =
    sameIdAccounts.filter((u) => u.username !== user.username).length > 0;

  // ប្រអប់អត្តសញ្ញាណប័ណ្ណស្ទួន (លាក់ចោលបើគ្មានស្ទួន!)
  let dupAlertHtml = "";
  if (hasRealDuplicateId) {
    const chips = sameIdAccounts
      .map((acc) => {
        const isCur = acc.username === user.username;
        return `
          <span onclick="${isCur ? "" : `openKycDetails('${acc.username}')`}"
                style="background:${isCur ? "#0f172a" : "var(--bg-card)"}; color:${isCur ? "#fef08a" : "var(--text-main)"}; border:1px solid ${isCur ? "#0f172a" : "var(--border)"}; padding:4px 10px; border-radius:8px; font-size:0.76rem; font-weight:800; cursor:${isCur ? "default" : "pointer"}; display:inline-flex; align-items:center; gap:5px;">
            <i class="fa-solid fa-user"></i> ${(acc.fullName || acc.username).toUpperCase()} (@${acc.username}) ${isCur ? "• កំពុងមើល" : '<i class="fa-solid fa-arrow-right" style="font-size:0.65rem; color:#3b82f6;"></i>'}
          </span>
        `;
      })
      .join("");

    dupAlertHtml = `
      <div style="background: rgba(249, 115, 22, 0.1); border: 1px solid rgba(249, 115, 22, 0.45); border-radius: 14px; padding: 15px 18px; margin-bottom: 18px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; flex-wrap:wrap;">
          <div>
            <div style="font-weight:800; color:#ea580c; font-size:0.92rem;">
              <i class="fa-solid fa-triangle-exclamation"></i> ប្រុងប្រយ័ត្ន៖ លេខអត្តសញ្ញាណប័ណ្ណ (${user.idNumber}) ត្រូវបានប្រើប្រាស់ស្ទួនចំនួន ${sameIdAccounts.length} គណនី!
            </div>
            <div style="font-size:0.84rem; color:var(--text-main); margin-top:5px;">
              <b>មូលហេតុរួមគ្នា៖</b> <span style="background:var(--bg-card); padding:2px 8px; border-radius:6px; font-weight:800; border:1px solid var(--border);">${user.duplicateIdReason || "មិនទាន់បញ្ជាក់មូលហេតុ"}</span>
            </div>
            <div style="margin-top:8px; display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
              <span style="font-size:0.75rem; font-weight:800;">គណនីពាក់ព័ន្ធ៖</span>
              ${chips}
            </div>
          </div>
          <button type="button" onclick="if(typeof c360EditDuplicateIdReasonModal==='function'){ c360EditDuplicateIdReasonModal().then(()=>setTimeout(()=>openKycDetails('${user.username}'), 600)); }" style="padding:7px 12px; border-radius:8px; background:var(--bg-card); color:#ea580c; border:1px solid rgba(249,115,22,0.5); font-weight:800; font-size:0.78rem; cursor:pointer;">
            <i class="fa-solid fa-pen-to-square"></i> កែមូលហេតុរួមគ្នា
          </button>
        </div>
      </div>
    `;
  }

  // ប៊ូតុងសកម្មភាពខាងក្រោមតាមគោលការណ៍ Maker-Checker
  let bottomActionsHtml = "";
  if (st === "pending") {
    if (makerInfo.isCurrentAdminTheMaker) {
      bottomActionsHtml = `
        <div style="background: rgba(59, 130, 246, 0.1); border: 1px dashed rgba(59, 130, 246, 0.45); border-radius: 14px; padding: 14px 18px; width: 100%; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
          <div style="display:flex; align-items:center; gap:10px; color:var(--text-main); font-weight:700; font-size:0.88rem;">
            <i class="fa-solid fa-user-lock" style="font-size:1.3rem; color:#3b82f6;"></i>
            <span><b>គោលការណ៍ Maker-Checker៖</b> អ្នកជាអ្នកបញ្ជូនឯកសារនេះ (@${makerInfo.rawUploader}) មិនអាចអនុម័តខ្លួនឯងបានទេ។ សូមរង់ចាំ Admin ផ្សេងទៀតជាអ្នកអនុម័ត។</span>
          </div>
          <button type="button" onclick="gkycWithdrawOwn('${user.username}')" style="padding:10px 16px; border-radius:10px; background:#fff1f2; color:#e11d48; border:1px solid #fda4af; font-weight:800; font-size:0.84rem; cursor:pointer;">
            <i class="fa-solid fa-rotate-left"></i> ដកសំណើមកកែវិញ
          </button>
        </div>
      `;
    } else {
      bottomActionsHtml = `
        <button type="button" onclick="gkycPromptReject('${user.username}', 'reject')" style="flex: 1; min-width: 200px; padding: 14px 22px; border-radius: 12px; background: rgba(239, 68, 68, 0.12); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.35); font-weight: 800; font-size: 0.96rem; cursor: pointer; display: flex; justify-content: center; align-items: center; gap: 8px;">
          <i class="fa-solid fa-circle-xmark"></i> បដិសេធសំណើ & លុបលេខ ID (Reject)
        </button>
        <button type="button" onclick="gkycTriggerAction('${user.username}', 'approved')" style="flex: 1.5; min-width: 240px; padding: 14px 25px; border-radius: 12px; background: linear-gradient(135deg, #059669, #10b981); color: #ffffff; border: none; font-weight: 800; font-size: 0.96rem; cursor: pointer; box-shadow: 0 6px 15px rgba(16, 185, 129, 0.25); display: flex; justify-content: center; align-items: center; gap: 8px;">
          <i class="fa-solid fa-circle-check"></i> អនុម័តឯកសារ (Approve KYC)
        </button>
      `;
    }
  } else if (st === "verified" || st === "approved") {
    bottomActionsHtml = `
      <button type="button" onclick="gkycPromptReject('${user.username}', 'revoke')" style="width: 100%; padding: 14px; border-radius: 12px; background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.35); font-weight: 800; font-size: 0.95rem; cursor: pointer; display: flex; justify-content: center; align-items: center; gap: 8px;">
        <i class="fa-solid fa-ban"></i> ដកហូតសិទ្ធិ KYC ឡើងវិញ និងលុបលេខ ID (Revoke Verification)
      </button>
    `;
  }

  container.innerHTML = `
    <style>
      .gkyc-wb-grid {
        display: grid;
        grid-template-columns: 1.25fr 1fr;
        gap: 24px;
      }
      @media (max-width: 960px) {
        .gkyc-wb-grid { grid-template-columns: 1fr; }
      }
      .gkyc-wb-info-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 14px;
        background: var(--bg-body, #f8fafc);
        border: 1px solid var(--border, #e2e8f0);
        border-radius: 11px;
        margin-bottom: 10px;
      }
      .gkyc-wb-lbl { font-size: 0.78rem; color: var(--text-muted); font-weight: 700; }
      .gkyc-wb-val { font-size: 0.95rem; color: var(--text-main); font-weight: 800; text-align: right; }
    </style>

    ${dupAlertHtml}

    <div class="gkyc-wb-grid">
      <!-- 🖼️ ខាងឆ្វេង៖ ផ្ទាំងរូបភាពឯកសារទាំង ២ (Visual Inspection Panel) -->
      <div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <h3 style="margin:0; font-size:1.05rem; color:var(--text-main); font-weight:800;">
            <i class="fa-solid fa-images" style="color:#0d9488;"></i> ១. ការត្រួតពិនិត្យរូបភាពឯកសារផ្ទាល់ (Visual Comparison)
          </h3>
          <span style="font-size:0.75rem; color:var(--text-muted);">ចុចលើរូបភាពដើម្បីពង្រីកមើលធំច្បាស់</span>
        </div>

        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 14px;">
          <!-- រូបអត្តសញ្ញាណប័ណ្ណ -->
          <div style="background:var(--bg-body); border:1px solid var(--border); border-radius:14px; overflow:hidden;">
            <div style="padding:10px 14px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
              <span style="font-weight:800; font-size:0.82rem;"><i class="fa-solid fa-id-card" style="color:#0d9488;"></i> អត្តសញ្ញាណប័ណ្ណ (ID Card)</span>
              ${
                idUrl
                  ? `<button type="button" onclick="if(typeof c360ViewFullImage==='function') c360ViewFullImage('${idUrl}', 'អត្តសញ្ញាណប័ណ្ណ៖ ${fullNameUpper}')" style="padding:4px 9px; font-size:0.72rem; font-weight:800; border-radius:6px; border:1px solid var(--border); background:var(--bg-card); color:var(--text-main); cursor:pointer;"><i class="fa-solid fa-expand"></i> ពង្រីក</button>`
                  : ""
              }
            </div>
            <div style="height:260px; background:#0f172a; display:flex; align-items:center; justify-content:center; cursor:pointer;"
                 onclick="${idUrl ? `if(typeof c360ViewFullImage==='function') c360ViewFullImage('${idUrl}', 'អត្តសញ្ញាណប័ណ្ណ៖ ${fullNameUpper}')` : ""}">
              ${
                idUrl
                  ? `<img src="${idUrl}" style="width:100%; height:100%; object-fit:contain;">`
                  : `<span style="color:#94a3b8; font-weight:700;">មិនទាន់មានរូបភាព ID</span>`
              }
            </div>
          </div>

          <!-- រូបថត Selfie -->
          <div style="background:var(--bg-body); border:1px solid var(--border); border-radius:14px; overflow:hidden;">
            <div style="padding:10px 14px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
              <span style="font-weight:800; font-size:0.82rem;"><i class="fa-solid fa-camera-retro" style="color:#2563eb;"></i> រូបថតផ្ទាល់ (Live Selfie)</span>
              ${
                selfieUrl
                  ? `<button type="button" onclick="if(typeof c360ViewFullImage==='function') c360ViewFullImage('${selfieUrl}', 'រូបថត Selfie៖ ${fullNameUpper}')" style="padding:4px 9px; font-size:0.72rem; font-weight:800; border-radius:6px; border:1px solid var(--border); background:var(--bg-card); color:var(--text-main); cursor:pointer;"><i class="fa-solid fa-expand"></i> ពង្រីក</button>`
                  : ""
              }
            </div>
            <div style="height:260px; background:#0f172a; display:flex; align-items:center; justify-content:center; cursor:pointer;"
                 onclick="${selfieUrl ? `if(typeof c360ViewFullImage==='function') c360ViewFullImage('${selfieUrl}', 'រូបថត Selfie៖ ${fullNameUpper}')` : ""}">
              ${
                selfieUrl
                  ? `<img src="${selfieUrl}" style="width:100%; height:100%; object-fit:contain;">`
                  : `<span style="color:#94a3b8; font-weight:700;">មិនទាន់មានរូបភាព Selfie</span>`
              }
            </div>
          </div>
        </div>
      </div>

      <!-- 📝 ខាងស្តាំ៖ តារាងទិន្នន័យអត្តសញ្ញាណ និង Audit Trail -->
      <div>
        <h3 style="margin:0 0 12px 0; font-size:1.05rem; color:var(--text-main); font-weight:800;">
          <i class="fa-solid fa-user-check" style="color:#2563eb;"></i> ២. ព័ត៌មានអត្តសញ្ញាណអតិថិជន (Identity Data)
        </h3>

        <div class="gkyc-wb-info-row">
          <span class="gkyc-wb-lbl">ឈ្មោះពេញ (FULL NAME)</span>
          <span class="gkyc-wb-val" style="font-size:1.05rem; text-transform:uppercase;">${fullNameUpper}</span>
        </div>

        <div class="gkyc-wb-info-row">
          <span class="gkyc-wb-lbl">លេខអត្តសញ្ញាណប័ណ្ណ (ID NUMBER)</span>
          <span class="gkyc-wb-val" style="font-family:'JetBrains Mono',monospace; font-size:1.05rem; color:#0d9488; background:rgba(13,148,136,0.12); padding:2px 10px; border-radius:6px;">${user.idNumber || "N/A"}</span>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div class="gkyc-wb-info-row">
            <span class="gkyc-wb-lbl">ថ្ងៃកំណើត (DOB)</span>
            <span class="gkyc-wb-val">${user.dob || "N/A"}</span>
          </div>
          <div class="gkyc-wb-info-row">
            <span class="gkyc-wb-lbl">ភេទ (GENDER)</span>
            <span class="gkyc-wb-val">${user.gender || "N/A"}</span>
          </div>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div class="gkyc-wb-info-row">
            <span class="gkyc-wb-lbl">គណនី (USERNAME)</span>
            <span class="gkyc-wb-val" style="color:#3b82f6;">@${user.username}</span>
          </div>
          <div class="gkyc-wb-info-row">
            <span class="gkyc-wb-lbl">ទូរស័ព្ទ (PHONE)</span>
            <span class="gkyc-wb-val">${user.phone || user.phoneNumber || "N/A"}</span>
          </div>
        </div>

        <div class="gkyc-wb-info-row">
          <span class="gkyc-wb-lbl">អ្នកបញ្ជូនសំណើ (MAKER)</span>
          <span class="gkyc-wb-val">${makerInfo.isUploadedByCustomer ? `អតិថិជនផ្ទាល់ (@${user.username})` : `Admin: @${makerInfo.rawUploader}`}</span>
        </div>

        <div class="gkyc-wb-info-row">
          <span class="gkyc-wb-lbl">កាលបរិច្ឆេទបញ្ជូន (SUBMITTED AT)</span>
          <span class="gkyc-wb-val" style="font-family:monospace; font-size:0.85rem;">${user.kycSubmittedAt || "N/A"}</span>
        </div>
      </div>
    </div>

    <!-- ប៊ូតុងអនុម័ត / បដិសេធ ខាងក្រោម -->
    <div style="margin-top: 25px; padding-top: 18px; border-top: 1px solid var(--border); display: flex; flex-wrap: wrap; gap: 14px;">
      ${bottomActionsHtml}
    </div>
  `;
}

// ========================================================================
// ⚙️ SECTION 5: ACTION HANDLERS (SHARED API `/api/admin/kyc-action`)
// ========================================================================

window.gkycPromptReject = async function (username, mode = "reject") {
  const isRevoke = mode === "revoke";
  const { value: reason } = await Swal.fire({
    title: `<span class="kh-text" style="font-size: 1.22rem; color: #ef4444;">${isRevoke ? "បញ្ជាក់ការដកហូតសិទ្ធិ KYC?" : "បញ្ជាក់ការបដិសេធសំណើ KYC?"}</span>`,
    html: `
      <p class="kh-text" style="font-size: 0.88rem; color: var(--text-muted); margin-bottom: 12px; text-align: left; line-height: 1.5;">
        ការបដិសេធនេះនឹង <b>លុបរូបភាព KYC និងលុបលេខអត្តសញ្ញាណប័ណ្ណចេញពីគណនី @${username}</b> ដោយស្វ័យប្រវត្តិ។ សូមជ្រើសរើស ឬវាយបញ្ជាក់មូលហេតុ៖
      </p>
      <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:10px;">
        <span onclick="document.getElementById('gkyc-swal-reject-reason').value='រូបថតអត្តសញ្ញាណប័ណ្ណព្រិល ឬចាំងពន្លឺមើលមិនច្បាស់'" style="font-size:0.75rem; background:#fef2f2; color:#dc2626; border:1px solid #fecaca; padding:4px 10px; border-radius:16px; cursor:pointer; font-weight:700;">រូបថតព្រិល/ចាំងពន្លឺ</span>
        <span onclick="document.getElementById('gkyc-swal-reject-reason').value='រូបថត Selfie មិនត្រូវគ្នាជាមួយរូបលើអត្តសញ្ញាណប័ណ្ណ'" style="font-size:0.75rem; background:#fef2f2; color:#dc2626; border:1px solid #fecaca; padding:4px 10px; border-radius:16px; cursor:pointer; font-weight:700;">ខុសមុខមាត់ Selfie</span>
        <span onclick="document.getElementById('gkyc-swal-reject-reason').value='ឯកសារអត្តសញ្ញាណប័ណ្ណផុតសុពលភាព ឬមិនត្រឹមត្រូវ'" style="font-size:0.75rem; background:#fef2f2; color:#dc2626; border:1px solid #fecaca; padding:4px 10px; border-radius:16px; cursor:pointer; font-weight:700;">ឯកសារផុតកំណត់</span>
      </div>
      <input id="gkyc-swal-reject-reason" class="swal2-input kh-text" placeholder="វាយបញ្ចូលមូលហេតុទីនេះ..." style="width:100%; margin:0; box-sizing:border-box; font-size: 0.95rem; padding: 10px; border-radius: 10px;">
    `,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: '<span class="kh-text">យល់ព្រមបដិសេធ & លុប ID</span>',
    cancelButtonText: '<span class="kh-text">បោះបង់</span>',
    confirmButtonColor: "#ef4444",
    cancelButtonColor: "#64748b",
    customClass: { popup: "modal-radius kh-text" },
    preConfirm: () => {
      const val = document
        .getElementById("gkyc-swal-reject-reason")
        .value.trim();
      if (!val) Swal.showValidationMessage("អ្នកត្រូវតែបញ្ចូលមូលហេតុ!");
      return val;
    },
  });

  if (reason) {
    await gkycTriggerAction(username, isRevoke ? "revoke" : "rejected", reason);
  }
};

window.gkycWithdrawOwn = async function (username) {
  const { value: reason } = await Swal.fire({
    title:
      '<span class="kh-text" style="font-size: 1.2rem; color: #e11d48;">ដកសំណើ KYC មកកែប្រែវិញ?</span>',
    input: "text",
    inputValue: "ដកសំណើដោយអ្នកបញ្ជូន (Maker) ដើម្បីកែសម្រួលឯកសារឡើងវិញ",
    showCancelButton: true,
    confirmButtonText: '<span class="kh-text">យល់ព្រមដកសំណើ</span>',
    cancelButtonText: '<span class="kh-text">បោះបង់</span>',
    confirmButtonColor: "#e11d48",
    customClass: { popup: "premium-swal kh-text" },
  });

  if (reason) {
    await gkycTriggerAction(username, "withdraw", reason);
  }
};

window.gkycTriggerAction = async function (
  username,
  action,
  rejectReason = "",
) {
  if (action === "approved") {
    const confirm = await Swal.fire({
      title:
        '<span class="kh-text" style="font-size: 1.25rem; color: #10b981;">អនុម័តឯកសារ KYC នេះ?</span>',
      text: `តើអ្នកបានពិនិត្យផ្ទៀងផ្ទាត់ឯកសាររបស់ @${username} ត្រឹមត្រូវ ១០០% ហើយមែនទេ?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: '<span class="kh-text">បាទ/ចាស អនុម័តឥឡូវនេះ</span>',
      cancelButtonText: '<span class="kh-text">ពិនិត្យម្តងទៀត</span>',
      confirmButtonColor: "#10b981",
      cancelButtonColor: "#64748b",
      customClass: { popup: "modal-radius kh-text" },
    });
    if (!confirm.isConfirmed) return;
  }

  Swal.fire({
    title: "កំពុងដំណើរការ...",
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading(),
    customClass: { popup: "premium-swal kh-text" },
  });

  try {
    const res = await fetch("/api/admin/kyc-action", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ username, action, rejectReason }),
    });
    const data = await res.json();

    if (data.success) {
      closeKycDetails();
      await gkycRefreshAllData();
      Swal.fire({
        icon: "success",
        title: "ជោគជ័យ!",
        text: data.message || "បានធ្វើបច្ចុប្បន្នភាពស្ថានភាព KYC រួចរាល់!",
        timer: 1600,
        showConfirmButton: false,
        customClass: { popup: "premium-swal kh-text" },
      });
    } else {
      Swal.fire({
        icon: "error",
        title: "បរាជ័យ",
        text: data.message || "មិនអាចធ្វើបច្ចុប្បន្នភាព KYC បានទេ",
        customClass: { popup: "premium-swal kh-text" },
      });
    }
  } catch (err) {
    Swal.fire("Error", "មានបញ្ហាតភ្ជាប់ទៅកាន់ Server", "error");
  }
};

// រក្សាទុកឈ្មោះអនុគមន៍ចាស់ការពារកន្លែងផ្សេងហៅប្រើ
window.processKyc = function (username, action) {
  if (action === "rejected") return gkycPromptReject(username, "reject");
  return gkycTriggerAction(username, action);
};

// Auto-Hook ពេលបើកទំព័រ ឬចុចចូល Menu KYC
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => initKycTable(), 600);

  document.body.addEventListener("click", (e) => {
    const navItem = e.target.closest("[onclick*='kyc'], [data-target*='kyc']");
    if (navItem) {
      setTimeout(() => initKycTable(), 100);
    }
  });
});
