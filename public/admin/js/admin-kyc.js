// ========================================================================
// ឯកសារ: admin-kyc.js
// អត្ថន័យ: គ្រប់គ្រងការបង្ហាញ ស្វែងរក និងវាយតម្លៃ KYC របស់អតិថិជន
// ========================================================================

// ========================================================================
// 📦 SECTION 1: STATE MANAGEMENT (អថេរគ្រប់គ្រងទិន្នន័យ និងទំព័រ)
// ========================================================================
let currentKycPage = 1;
const KYC_PER_PAGE = 10; // កំណត់ចំនួនទិន្នន័យបង្ហាញក្នុងមួយទំព័រ
let filteredKycList = [];

// ========================================================================
// 🔍 SECTION 2: SEARCH & TABLE INITIALIZATION (ការស្វែងរក និងរៀបចំតារាង)
// ========================================================================

/**
 * 📌 ២.១ ចាប់ផ្ដើមទាញយកទិន្នន័យ និងត្រងទិន្នន័យ (Universal Search)
 */
function initKycTable() {
  const searchBox = document.getElementById("searchKycBox");
  const keyword = searchBox ? searchBox.value : "";

  // ទាញយកទិន្នន័យដែលបានរៀបចំពី admin-core.js
  const allPending = window.globalPendingKycData || [];

  // 🟢 ប្រើប្រាស់មុខងារស្តង់ដារ (Universal Search) ប្រសិនបើមាន
  if (typeof window.standardDataSearch === "function") {
    filteredKycList = window.standardDataSearch(allPending, keyword, [
      "fullName",
      "username",
      "email",
      "phone",
      "idNumber",
      "userId",
      "mainAccounts.USD.accountNumber",
      "mainAccounts.KHR.accountNumber",
    ]);
  } else {
    // 🟡 Fallback: ប្រើប្រព័ន្ធ Search ធម្មតាក្នុងករណីរកមុខងារស្តង់ដារមិនឃើញ
    const lowerKeyword = keyword.toLowerCase().trim();
    filteredKycList = allPending.filter((u) => {
      const text =
        `${u.fullName || ""} ${u.username || ""} ${u.email || ""} ${u.phone || ""} ${u.idNumber || ""}`.toLowerCase();
      return text.includes(lowerKeyword);
    });
  }

  // កំណត់ទំព័រទៅលេខ ១ វិញរាល់ពេល Search ម្តងៗ រួចគូរតារាង
  currentKycPage = 1;
  renderKycTablePage();
}

/**
 * 📌 ២.២ មុខងារហៅពេលកំពុងវាយអក្សរស្វែងរក (Triggered by onkeyup)
 */
function filterKycTable() {
  initKycTable();
}

// ========================================================================
// 📊 SECTION 3: PAGINATION & RENDERING (ការបែងចែកទំព័រ និងគូរតារាង)
// ========================================================================

/**
 * 📌 ៣.១ គូរតារាងទិន្នន័យដោយផ្អែកលើទំព័របច្ចុប្បន្ន (Page Rendering)
 */
function renderKycTablePage() {
  const tbody = document.getElementById("kycTableBody");
  const paginationContainer = document.getElementById("kycPaginationFooter");

  // ករណីគ្មានទិន្នន័យ
  if (!filteredKycList || filteredKycList.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="5" style="text-align:center; padding: 20px; color: var(--text-muted);">គ្មានសំណើ KYC ទេ</td></tr>';
    if (paginationContainer) paginationContainer.style.display = "none";
    return;
  }

  // គណនាចំនួនទំព័រសរុប
  const totalPages = Math.ceil(filteredKycList.length / KYC_PER_PAGE);
  if (currentKycPage > totalPages) currentKycPage = totalPages;
  if (currentKycPage < 1) currentKycPage = 1;

  // កំណត់ចំណុចចាប់ផ្តើម និងបញ្ចប់នៃ Array សម្រាប់ទំព័រនីមួយៗ
  const startIndex = (currentKycPage - 1) * KYC_PER_PAGE;
  const endIndex = startIndex + KYC_PER_PAGE;
  const pageItems = filteredKycList.slice(startIndex, endIndex);

  // បង្កើត HTML សម្រាប់តារាង
  let kycHtml = "";
  pageItems.forEach((u) => {
    kycHtml += `<tr>
        <td>
            <div style="font-weight:600; color: var(--text-main);">${u.fullName || u.username}</div>
            <div style="font-size:0.8rem; color:var(--text-muted);">Account: ${u.accountNumber || u.mainAccounts?.USD?.accountNumber || "N/A"}</div>
        </td>
        <td style="color: var(--text-main);">Identity Document</td>
        <td style="color: var(--text-muted);">${u.kycSubmittedAt || "Recent"}</td>
        <td><span style="background:#fef3c7; color:#d97706; padding:3px 10px; border-radius:12px; font-size:0.8rem; font-weight:bold;">PENDING</span></td>
        <td style="text-align: right;">
            <button class="btn-action" style="background:var(--primary);" onclick="openKycDetails('${u.username}')" title="ពិនិត្យលម្អិត">
                <i class="fa-solid fa-eye"></i>
            </button>
        </td>
    </tr>`;
  });

  tbody.innerHTML = kycHtml;

  // គ្រប់គ្រងការបង្ហាញ Footer (ប៊ូតុង Next/Prev)
  if (filteredKycList.length <= KYC_PER_PAGE) {
    paginationContainer.style.display = "none";
  } else {
    paginationContainer.style.display = "flex";
    document.getElementById("kycPageInfo").innerText =
      `ទំព័រទី ${currentKycPage} / ${totalPages}`;

    // បិទប៊ូតុងពេលដល់ចុងកាត់ ឬដើមទី
    const prevBtn = document.getElementById("kycPrevBtn");
    const nextBtn = document.getElementById("kycNextBtn");

    prevBtn.disabled = currentKycPage === 1;
    nextBtn.disabled = currentKycPage >= totalPages;

    // ដូរពណ៌ (Opacity) ឱ្យងាយស្រួលមើល
    prevBtn.style.opacity = currentKycPage === 1 ? "0.5" : "1";
    nextBtn.style.opacity = currentKycPage >= totalPages ? "0.5" : "1";
  }
}

/**
 * 📌 ៣.២ ប្តូរទំព័រនៅពេលចុចប៊ូតុង ថយក្រោយ/បន្ទាប់
 */
function changeKycPage(step) {
  const totalPages = Math.ceil(filteredKycList.length / KYC_PER_PAGE);
  currentKycPage += step;

  if (currentKycPage < 1) currentKycPage = 1;
  if (currentKycPage > totalPages) currentKycPage = totalPages;

  renderKycTablePage();
}

// ========================================================================
// 🖥️ SECTION 4: KYC DETAILS VIEW (ការបង្ហាញទំព័រលម្អិត និង UI)
// ========================================================================

/**
 * 📌 ៤.១ បើកផ្ទាំង KYC Details (លាក់ List View)
 */
function openKycDetails(username) {
  const user = globalUsersData.find((u) => u.username === username);
  if (!user) {
    Swal.fire({
      icon: "error",
      title: "បរាជ័យ",
      text: "រកមិនឃើញទិន្នន័យអតិថិជននេះទេ!",
    });
    return;
  }

  document.getElementById("kyc-list-view").style.display = "none";
  document.getElementById("kyc-details-view").style.display = "block";

  renderKycDetailsContent(user);
}

/**
 * 📌 ៤.២ បិទផ្ទាំង KYC Details (ត្រឡប់ទៅបញ្ជីដើមវិញ)
 */
function closeKycDetails() {
  document.getElementById("kyc-details-view").style.display = "none";
  document.getElementById("kyc-list-view").style.display = "block";
}

/**
 * 📌 ៤.៣ បង្កើត UI លម្អិត (Support Dark Mode, Responsive, Khmer Fonts)
 */
function renderKycDetailsContent(user) {
  const container = document.getElementById("kyc-details-content");

  const idUrl =
    user.kycDocument || "https://placehold.co/400x250?text=No+ID+Document";
  const selfieUrl =
    user.selfieUrl || "https://placehold.co/250x250?text=No+Selfie";

  // 🟢 លក្ខខណ្ឌបង្ហាញប្រអប់ព្រមាន តែពេលមាន Duplicate Reason ប៉ុណ្ណោះ
  let duplicateWarningHtml = "";
  if (user.duplicateIdReason && user.duplicateIdReason.trim() !== "") {
    duplicateWarningHtml = `
            <div style="background: #fef2f2; border: 1px solid #ef4444; padding: 15px; border-radius: 8px; margin-bottom: 20px; animation: pulse 2s infinite;">
                <h4 style="color: #ef4444; margin: 0 0 5px 0; font-family: 'Kantumruy Pro', sans-serif;"><i class="fa-solid fa-triangle-exclamation"></i> ប្រយ័ត្ន៖ អត្តសញ្ញាណប័ណ្ណនេះមានក្នុងប្រព័ន្ធរួចហើយ!</h4>
                <p style="margin: 0; color: #7f1d1d; font-size: 0.95rem; font-family: 'Kantumruy Pro', sans-serif;">មូលហេតុរបស់អតិថិជន៖ <b style="font-size: 1rem;">"${user.duplicateIdReason}"</b></p>
            </div>
        `;
  }

  // 🟢 លក្ខខណ្ឌបង្ហាញអ្នកណែនាំ (បើមាន)
  let referredByHtml = "";
  if (user.referredBy && user.referredBy.trim() !== "") {
    referredByHtml = `
            <div style="background: #f0fdfa; padding: 12px; border-radius: 8px; border: 1px dashed #14b8a6; margin-top: 5px;">
                <span style="color: #0d9488; font-size: 0.85rem; font-family: 'Kantumruy Pro', sans-serif;"><i class="fa-solid fa-users"></i> អ្នកណែនាំ (Referred By)</span><br>
                <b style="color: #0f766e; font-size: 1.05rem;">${user.referredBy}</b>
            </div>
        `;
  }

  container.innerHTML = `
        <style>
            /* 📱 Responsive Grid Layout សម្រាប់គ្រប់ Screen */
            .kyc-detail-grid {
                display: grid;
                grid-template-columns: 1fr 1.5fr;
                gap: 30px;
            }
            @media (max-width: 992px) {
                .kyc-detail-grid {
                    grid-template-columns: 1fr;
                    gap: 20px;
                }
            }
            .kyc-img-flex {
                display: flex;
                gap: 20px;
                margin-top: 15px;
            }
            @media (max-width: 600px) {
                .kyc-img-flex {
                    flex-direction: column;
                    align-items: center;
                }
            }
        </style>

        <div class="kyc-detail-grid" style="font-family: 'Kantumruy Pro', 'Inter', sans-serif;">
            <!-- ជួរខាងឆ្វេង៖ ព័ត៌មានអក្សរ -->
            <div>
                ${duplicateWarningHtml}
                
                <h3 style="border-bottom: 1px solid var(--border); padding-bottom: 10px; margin-top: 0; color: var(--text-main);">ព័ត៌មានផ្ទាល់ខ្លួន</h3>
                
                <div style="display: flex; flex-direction: column; gap: 15px; margin-top: 15px;">
                    <!-- ព័ត៌មានអត្តសញ្ញាណ -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <div><span style="color: var(--text-muted); font-size: 0.85rem;">ឈ្មោះពេញ (Full Name)</span><br><b style="font-size: 1.1rem; color: var(--text-main);">${user.fullName || "N/A"}</b></div>
                        <div><span style="color: var(--text-muted); font-size: 0.85rem;">ភេទ (Gender)</span><br><b style="color: var(--text-main);">${user.gender || "N/A"}</b></div>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <div><span style="color: var(--text-muted); font-size: 0.85rem;">ថ្ងៃខែឆ្នាំកំណើត (DOB)</span><br><b style="color: var(--text-main);">${user.dob || "N/A"}</b></div>
                        <div>
                            <span style="color: var(--text-muted); font-size: 0.85rem;">លេខអត្តសញ្ញាណប័ណ្ណ</span><br>
                            <b style="color: var(--text-main); font-size: 1.15rem; font-weight: 700; background: rgba(16, 185, 129, 0.15); padding: 2px 8px; border-radius: 6px; display: inline-block; margin-top: 2px;">${user.idNumber || "N/A"}</b>
                        </div>
                    </div>

                    <hr style="border: 0; border-top: 1px dashed var(--border); margin: 5px 0;">

                    <!-- ព័ត៌មានប្រព័ន្ធ -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <div><span style="color: var(--text-muted); font-size: 0.85rem;">ឈ្មោះគណនី (Username)</span><br><b style="color: var(--accent);">@${user.username}</b></div>
                        <div><span style="color: var(--text-muted); font-size: 0.85rem;">លេខសម្គាល់ (User ID)</span><br><b style="font-family: monospace; color: var(--text-main);">${user.userId || "N/A"}</b></div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <div><span style="color: var(--text-muted); font-size: 0.85rem;">លេខទូរស័ព្ទ (Phone)</span><br><b style="color: var(--text-main);">${user.phone || "N/A"}</b></div>
                        <div><span style="color: var(--text-muted); font-size: 0.85rem;">អ៊ីមែល (Email)</span><br><b style="color: var(--text-main); word-break: break-all;">${user.email || "N/A"}</b></div>
                    </div>

                    <div><span style="color: var(--text-muted); font-size: 0.85rem;"><i class="fa-regular fa-clock"></i> ពេលវេលាបញ្ជូន (Submitted At)</span><br><b style="color: var(--text-main);">${user.kycSubmittedAt || user.createdAt || "N/A"}</b></div>
                    
                    ${referredByHtml}
                </div>
            </div>

            <!-- ជួរខាងស្តាំ៖ រូបភាពអត្តសញ្ញាណ -->
            <div>
                <h3 style="border-bottom: 1px solid var(--border); padding-bottom: 10px; margin-top: 0; color: var(--text-main);">ឯកសារ និង រូបថត</h3>
                <div class="kyc-img-flex">
                    <div style="flex: 1; width: 100%;">
                        <span style="color: var(--text-muted); font-size: 0.85rem; display: block; margin-bottom: 5px;">អត្តសញ្ញាណប័ណ្ណ (ID Card)</span>
                        <a href="${idUrl}" target="_blank">
                            <img src="${idUrl}" style="width: 100%; max-height: 240px; object-fit: contain; border-radius: 8px; border: 1px solid var(--border); cursor: pointer; transition: 0.3s; background: #000;" onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'" title="ចុចដើម្បីមើលរូបធំ">
                        </a>
                    </div>
                    <div style="flex: 1; text-align: center;">
                        <span style="color: var(--text-muted); font-size: 0.85rem; display: block; margin-bottom: 5px;">រូបថតផ្ទាល់ (Live Selfie)</span>
                        <a href="${selfieUrl}" target="_blank">
                            <img src="${selfieUrl}" style="width: 200px; height: 200px; object-fit: cover; border-radius: 5%; border: 4px solid var(--border); cursor: pointer; transition: 0.3s; box-shadow: 0 4px 10px rgba(0,0,0,0.1);" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'" title="ចុចដើម្បីមើលរូបធំ">
                        </a>
                    </div>
                </div>
            </div>
        </div>

        <!-- ប៊ូតុងសកម្មភាពនៅខាងក្រោម -->
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid var(--border); display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 15px; font-family: 'Kantumruy Pro', sans-serif;">
            <button class="btn-cancel" style="background: #ef4444; color: white; border: none; padding: 12px 25px; font-weight: bold; border-radius: 8px; cursor: pointer; font-family: 'Kantumruy Pro', sans-serif; display: flex; align-items: center; gap: 8px;" onclick="processKyc('${user.username}', 'rejected')">
                <i class="fa-solid fa-xmark"></i> បដិសេធ (Reject)
            </button>
            <button class="btn-primary" style="background: #10b981; color: white; border: none; padding: 12px 35px; font-weight: bold; border-radius: 8px; cursor: pointer; font-family: 'Kantumruy Pro', sans-serif; display: flex; align-items: center; gap: 8px;" onclick="processKyc('${user.username}', 'approved')">
                <i class="fa-solid fa-check-circle"></i> អនុម័ត (Approve)
            </button>
        </div>
    `;
}

// ========================================================================
// ⚙️ SECTION 5: ACTION HANDLERS (ដំណើរការអនុម័ត និងបដិសេធ)
// ========================================================================

/**
 * 📌 ៥.១ ដំណើរការប៊ូតុងអនុម័ត ឬបដិសេធ ដោយហៅមុខងាររបស់ admin-core.js
 */
function processKyc(username, action) {
  Swal.fire({
    title: action === "approved" ? "អនុម័ត KYC?" : "បដិសេធ KYC?",
    text:
      action === "approved"
        ? "តើអ្នកប្រាកដថាទិន្នន័យនេះត្រឹមត្រូវហើយមែនទេ?"
        : "សូមបញ្ជាក់ការបដិសេធ!",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: action === "approved" ? "#10b981" : "#ef4444",
    cancelButtonColor: "#94a3b8",
    confirmButtonText: "បាទ/ចាស",
    cancelButtonText: "បោះបង់",
  }).then((result) => {
    if (result.isConfirmed) {
      // ហៅមុខងារ 'kycAction' ចេញពី admin-core.js ដើម្បីភ្ជាប់ទៅ Server
      if (typeof kycAction === "function") {
        kycAction(username, action);
        closeKycDetails(); // ត្រឡប់មកតារាង List View វិញពេលដំណើរការរួច
      } else {
        Swal.fire("Error", "រកមិនឃើញមុខងារ kycAction ក្នុងប្រព័ន្ធ", "error");
      }
    }
  });
}

/**
 * 📌 មុខងារកណ្តាលសម្រាប់ផ្ញើសំណើ Approve / Reject / Revoke KYC ទៅកាន់ Server
 */
async function kycAction(username, action) {
  try {
    const res = await fetch("/api/admin/kyc-action", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ username, action }),
    });
    const data = await res.json();

    if (data.success) {
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: `KYC ត្រូវបាន ${action === "approved" ? "អនុម័ត" : "បដិសេធ"} រួចរាល់!`,
        showConfirmButton: false,
        timer: 1500,
        customClass: { popup: "premium-swal" },
      });
      // ធ្វើបច្ចុប្បន្នភាពទិន្នន័យលើតារាងឡើងវិញ
      if (typeof loadData === "function") loadData();
    } else {
      Swal.fire({
        icon: "error",
        title: "បរាជ័យ",
        text: data.message || "មិនអាចធ្វើបច្ចុប្បន្នភាព KYC បានទេ",
        customClass: { popup: "premium-swal" },
      });
    }
  } catch (err) {
    Swal.fire({
      icon: "error",
      title: "Error",
      text: "មានបញ្ហាតភ្ជាប់ទៅកាន់ Server",
      customClass: { popup: "premium-swal" },
    });
  }
}
