// ============================================================================
// ឯកសារ: js/admin-tickets.js (100% Fixed & Clean Enterprise Helpdesk Logic)
// អត្ថន័យ: គ្រប់គ្រងសំបុត្រសំណូមពរ និងការឆ្លើយតបបញ្ហាអតិថិជន (Support Tickets Hub)
// ស្តង់ដារថ្មី: ចាប់ទិន្នន័យម្ចាស់សំបុត្រតាម MongoDB `_id` សុទ្ធសាធ + បង្ហាញឈ្មោះពេញ (fullName)
// ============================================================================

// ============================================================================
// 🎫 ជំពូកទី ១៖ អថេរសកល និងអត្តសញ្ញាណមន្ត្រីឆ្លើយតប (GLOBAL STATE & ADMIN IDENTITY)
// ============================================================================
let globalSupportTicketsList = [];
let filteredSupportTicketsList = [];
let currentMainTicketPage = 1;
const mainTicketsPerPage = 8;

/**
 * 🔹 ១.១ ទាញយកឈ្មោះពេញរបស់បុគ្គលិក Admin ដែលកំពុង Login (សម្រាប់បង្ហាញលើរបាយការណ៍ឆ្លើយតប)
 */
function getActiveAdminDisplayName() {
  const domName = document
    .getElementById("adminNameDisplay")
    ?.innerText?.trim();
  if (domName) return domName.replace(/^@/, "");
  const sessionName = sessionStorage.getItem("adminFullName");
  if (sessionName) return sessionName.replace(/^@/, "");
  return "មន្ត្រីផ្នែកជំនួយអតិថិជន U-Pay";
}

/**
 * 🔹 ១.២ ស្វែងរកសំបុត្រតាមរយៈ `userId` (`_id`) និង `ticketId`
 */
function findSupportTicketRecord(ownerIdentifier, ticketId) {
  const cleanOwner = String(ownerIdentifier || "").trim();
  const cleanTckId = String(ticketId || "").trim();

  let ticket = globalSupportTicketsList.find(
    (t) =>
      (String(t.ticketId) === cleanTckId || String(t._id) === cleanTckId) &&
      (String(t.userId) === cleanOwner || String(t.username) === cleanOwner),
  );

  if (!ticket) {
    ticket = globalSupportTicketsList.find(
      (t) => String(t.ticketId) === cleanTckId || String(t._id) === cleanTckId,
    );
  }

  if (!ticket && typeof globalUsersData !== "undefined") {
    const targetUser = (globalUsersData || []).find(
      (u) => String(u._id || u.id) === cleanOwner || u.username === cleanOwner,
    );
    ticket = targetUser?.tickets?.find(
      (t) => String(t.ticketId) === cleanTckId || String(t._id) === cleanTckId,
    );
    if (ticket && targetUser) {
      ticket = {
        ...ticket,
        userId: String(targetUser._id || targetUser.id),
        username: targetUser.username,
        fullName: targetUser.fullName || targetUser.username,
      };
    }
  }
  return ticket || null;
}

// ============================================================================
// 🔄 ជំពូកទី ២៖ ការទាញយកសំបុត្រជំនួយទាំងអស់ និងគណនាស្ថិតិ KPI (FETCH & KPI STATS)
// ============================================================================

/**
 * 🔹 ២.១ ទាញយកទិន្នន័យសំបុត្រទាំងអស់ពី API (`/api/admin/all-tickets`)
 */
window.fetchAllSupportTickets = async function (showToast = false) {
  const tbody = document.getElementById("ticketTableBody");
  const refreshIcon = document.getElementById("tck-hub-refresh-icon");
  if (refreshIcon) refreshIcon.classList.add("fa-spin");

  if (tbody && globalSupportTicketsList.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 45px; color: var(--text-muted);">
          <i class="fa-solid fa-circle-notch fa-spin fa-2x" style="color: #0d9488; margin-bottom: 10px;"></i>
          <div class="kh-text" style="font-size: 0.9rem;">កំពុងទាញយករបាយការណ៍សំណូមពរពី Server...</div>
        </td>
      </tr>
    `;
  }

  try {
    const res = await fetch("/api/admin/all-tickets", {
      headers: getAuthHeaders(),
    });
    const data = await res.json();

    if (data.success && Array.isArray(data.tickets)) {
      globalSupportTicketsList = data.tickets;
    } else {
      globalSupportTicketsList = extractTicketsFromGlobalUsers();
    }

    updateMainTicketKPIs();
    filterMainTicketsTable(false);

    if (showToast) {
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "ទិន្នន័យសំណូមពរត្រូវបានធ្វើបច្ចុប្បន្នភាព!",
        showConfirmButton: false,
        timer: 1400,
      });
    }
  } catch (err) {
    globalSupportTicketsList = extractTicketsFromGlobalUsers();
    updateMainTicketKPIs();
    filterMainTicketsTable(false);
  } finally {
    if (refreshIcon) refreshIcon.classList.remove("fa-spin");
  }
};

/**
 * 🔹 ២.២ អនុគមន៍ជំនួយ Fallback ទាញចេញពី `globalUsersData` ដោយភ្ជាប់ `userId: _id`
 */
function extractTicketsFromGlobalUsers() {
  let list = [];
  if (
    typeof globalUsersData !== "undefined" &&
    Array.isArray(globalUsersData)
  ) {
    globalUsersData.forEach((u) => {
      const canonicalId = String(u._id || u.id || "");
      if (Array.isArray(u.tickets)) {
        u.tickets.forEach((t) => {
          list.push({
            ...t,
            userId: canonicalId,
            userCustomId: canonicalId,
            username: u.username,
            fullName: u.fullName || u.username,
            phone: u.phone || "N/A",
            profileImage: u.profileImage || "../images/default-avatar.png",
          });
        });
      }
    });
  }
  return list.sort(
    (a, b) =>
      new Date(b.createdAt || b.date || 0) -
      new Date(a.createdAt || a.date || 0),
  );
}

/**
 * 🔹 ២.៣ គណនា និងបង្ហាញតួលេខលើប្រអប់ KPI ទាំង ៤
 */
function updateMainTicketKPIs() {
  const total = globalSupportTicketsList.length;
  const answered = globalSupportTicketsList.filter(
    (t) =>
      t.status === "Answered" ||
      t.status === "Resolved" ||
      t.status === "Closed",
  ).length;
  const pending = total - answered;
  const high = globalSupportTicketsList.filter(
    (t) => (t.priority || "").toLowerCase() === "high",
  ).length;

  const elTotal = document.getElementById("tck-count-total");
  const elPending = document.getElementById("tck-count-pending");
  const elHigh = document.getElementById("tck-count-high");
  const elAnswered = document.getElementById("tck-count-answered");

  if (elTotal) elTotal.innerText = total;
  if (elPending) elPending.innerText = pending;
  if (elHigh) elHigh.innerText = high;
  if (elAnswered) elAnswered.innerText = answered;
}

// ============================================================================
// 🔍 ជំពូកទី ៣៖ ការចម្រាញ់ទិន្នន័យ និងគូរតារាងសំបុត្រតាម `_id` (FILTERING & TABLE RENDERING BY `_id`)
// ============================================================================

/**
 * 🔹 ៣.១ ចុចជ្រើសរើសលើប្រអប់ KPI ដើម្បីចម្រាញ់រហ័ស (Quick Filter)
 */
window.setMainTicketQuickFilter = function (mode) {
  document
    .querySelectorAll(".tck-hub-kpi-card")
    .forEach((el) => el.classList.remove("active-kpi"));

  const pSelect = document.getElementById("tck-hub-priority-filter");
  const sSelect = document.getElementById("tck-hub-status-filter");

  if (mode === "all") {
    document.getElementById("tck-kpi-all")?.classList.add("active-kpi");
    if (pSelect) pSelect.value = "ALL";
    if (sSelect) sSelect.value = "ALL";
  } else if (mode === "Pending") {
    document.getElementById("tck-kpi-pending")?.classList.add("active-kpi");
    if (pSelect) pSelect.value = "ALL";
    if (sSelect) sSelect.value = "Pending";
  } else if (mode === "High") {
    document.getElementById("tck-kpi-high")?.classList.add("active-kpi");
    if (pSelect) pSelect.value = "High";
    if (sSelect) sSelect.value = "ALL";
  } else if (mode === "Answered") {
    document.getElementById("tck-kpi-answered")?.classList.add("active-kpi");
    if (pSelect) pSelect.value = "ALL";
    if (sSelect) sSelect.value = "Answered";
  }

  filterMainTicketsTable(true);
};

/**
 * 🔹 ៣.២ ចម្រាញ់សំបុត្រតាមពាក្យគន្លឹះ, កម្រិតអាទិភាព និងស្ថានភាព
 */
window.filterMainTicketsTable = function (resetPage = false) {
  if (resetPage) currentMainTicketPage = 1;

  const keyword = (document.getElementById("tck-hub-search")?.value || "")
    .toLowerCase()
    .trim();
  const priorityVal =
    document.getElementById("tck-hub-priority-filter")?.value || "ALL";
  const statusVal =
    document.getElementById("tck-hub-status-filter")?.value || "ALL";

  filteredSupportTicketsList = globalSupportTicketsList.filter((t) => {
    const isAns =
      t.status === "Answered" ||
      t.status === "Resolved" ||
      t.status === "Closed";

    if (statusVal === "Pending" && isAns) return false;
    if (statusVal === "Answered" && !isAns) return false;

    if (
      priorityVal !== "ALL" &&
      (t.priority || "Normal").toLowerCase() !== priorityVal.toLowerCase()
    ) {
      return false;
    }

    if (keyword) {
      const matchId = (t.ticketId || "").toLowerCase().includes(keyword);
      const matchOwnerId = String(t.userId || "")
        .toLowerCase()
        .includes(keyword);
      const matchUser = (t.username || "").toLowerCase().includes(keyword);
      const matchName = (t.fullName || "").toLowerCase().includes(keyword);
      const matchSub = (t.subject || "").toLowerCase().includes(keyword);
      const matchMsg = (t.description || t.message || "")
        .toLowerCase()
        .includes(keyword);
      const matchAdmin = (t.repliedBy || "").toLowerCase().includes(keyword);
      return (
        matchId ||
        matchOwnerId ||
        matchUser ||
        matchName ||
        matchSub ||
        matchMsg ||
        matchAdmin
      );
    }

    return true;
  });

  renderMainTicketsTableRows();
};

/**
 * 🔹 ៣.៣ គូរជួរដេកក្នុងតារាងសំបុត្រដោយចាប់តាម `ownerId` (`_id`) និងបង្ហាញតែឈ្មោះពេញ (`fullName`)
 */
function renderMainTicketsTableRows() {
  const tbody = document.getElementById("ticketTableBody");
  const prevBtn = document.getElementById("tck-hub-prev-btn");
  const nextBtn = document.getElementById("tck-hub-next-btn");
  const pageInfo = document.getElementById("tck-hub-page-info");

  if (!tbody) return;

  if (filteredSupportTicketsList.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 55px 20px;">
          <div style="width: 64px; height: 64px; border-radius: 50%; background: #f1f5f9; color: #94a3b8; display: flex; align-items: center; justify-content: center; font-size: 1.8rem; margin: 0 auto 12px;">
            <i class="fa-solid fa-inbox"></i>
          </div>
          <div class="kh-text" style="font-weight: 800; color: var(--text-main); font-size: 1rem; margin-bottom: 4px;">មិនមានទិន្នន័យសំណូមពរទេ</div>
          <div class="kh-text" style="font-size: 0.85rem; color: var(--text-muted);">សូមសាកល្បងផ្លាស់ប្តូរពាក្យស្វែងរក ឬតម្រង (Filter) ខាងលើ។</div>
        </td>
      </tr>
    `;
    if (pageInfo) pageInfo.innerText = "ទំព័រ 0 នៃ 0";
    if (prevBtn) prevBtn.disabled = true;
    if (nextBtn) nextBtn.disabled = true;
    return;
  }

  const totalPages = Math.ceil(
    filteredSupportTicketsList.length / mainTicketsPerPage,
  );
  if (currentMainTicketPage > totalPages) currentMainTicketPage = totalPages;
  if (currentMainTicketPage < 1) currentMainTicketPage = 1;

  const startIdx = (currentMainTicketPage - 1) * mainTicketsPerPage;
  const pageItems = filteredSupportTicketsList.slice(
    startIdx,
    startIdx + mainTicketsPerPage,
  );

  tbody.innerHTML = pageItems
    .map((t) => {
      const tId = t.ticketId || t._id || "N/A";
      const ownerKey = String(t.userId || t.userCustomId || t.username || "");
      const customerFullName = t.fullName || t.username || "អតិថិជន U-Pay";

      const isAnswered =
        t.status === "Answered" ||
        t.status === "Resolved" ||
        t.status === "Closed";
      const isHigh = (t.priority || "").toLowerCase() === "high";
      const msgPreview = t.description || t.message || "គ្មានខ្លឹមសារ";
      const responderName = t.repliedBy
        ? String(t.repliedBy).replace(/^@/, "")
        : "";
      const responderDisplay = responderName || "មន្ត្រីធនាគារ";

      const priorityHtml = isHigh
        ? `<span style="background: #fee2e2; color: #ef4444; padding: 4px 10px; border-radius: 8px; font-size: 0.75rem; font-weight: 800; display: inline-flex; align-items: center; gap: 5px;"><i class="fa-solid fa-fire"></i> High</span>`
        : `<span style="background: #f1f5f9; color: #475569; padding: 4px 10px; border-radius: 8px; font-size: 0.75rem; font-weight: 700; display: inline-flex; align-items: center; gap: 5px;"><i class="fa-solid fa-circle-dot" style="font-size: 0.5rem;"></i> Normal</span>`;

      const statusHtml = isAnswered
        ? `<div style="display: flex; flex-direction: column; align-items: flex-start; gap: 4px;">
             <span style="background: #dcfce7; color: #059669; padding: 4px 11px; border-radius: 20px; font-size: 0.75rem; font-weight: 800; display: inline-flex; align-items: center; gap: 5px;">
               <i class="fa-solid fa-file-circle-check"></i> Answered
             </span>
             ${
               responderName
                 ? `<span style="font-size: 0.7rem; color: #0f766e; font-weight: 700; padding-left: 4px;"><i class="fa-solid fa-user-shield"></i> ${responderName}</span>`
                 : ""
             }
           </div>`
        : `<span style="background: #fef9c3; color: #d97706; padding: 4px 11px; border-radius: 20px; font-size: 0.75rem; font-weight: 800; display: inline-flex; align-items: center; gap: 5px;">
             <i class="fa-solid fa-clock"></i> Pending
           </span>`;

      return `
        <tr>
          <!-- 1. Ticket ID & Date -->
          <td>
            <div onclick="navigator.clipboard.writeText('${tId}'); Swal.fire({toast:true, position:'top-end', icon:'success', title:'Copied ${tId}', showConfirmButton:false, timer:1000});" style="font-family: 'JetBrains Mono', monospace; font-weight: 800; font-size: 0.85rem; color: #0f172a; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; background: #f1f5f9; padding: 4px 9px; border-radius: 6px;" title="ចុចដើម្បី Copy">
              #${tId} <i class="fa-regular fa-copy" style="font-size: 0.7rem; color: #64748b;"></i>
            </div>
            <div style="font-size: 0.72rem; color: var(--text-muted); font-family: monospace; margin-top: 4px;">
              <i class="fa-regular fa-calendar"></i> ${t.date || "N/A"}
            </div>
          </td>

          <!-- 2. Customer (ចុចលោតទៅ Customer 360° តាម _id បាន) -->
          <td>
            <div class="tck-user-pill" onclick="jumpFromTicketToCustomer360('${ownerKey}')" title="ចុចដើម្បីបើកមើលក្នុង Customer 360° តាម _id">
              <img src="${t.profileImage || "../images/default-avatar.png"}" onerror="this.src='../images/default-avatar.png'" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;">
              <div>
                <div style="font-weight: 800; font-size: 0.86rem; color: var(--text-main); line-height: 1.2;">${customerFullName}</div>
                <div style="font-size: 0.72rem; color: #0d9488; font-weight: 700;">មើល 360° <i class="fa-solid fa-arrow-up-right-from-square" style="font-size: 0.6rem;"></i></div>
              </div>
            </div>
          </td>

          <!-- 3. Subject & Message Preview -->
          <td style="max-width: 320px;">
            <div class="kh-text" style="font-weight: 800; color: var(--text-main); font-size: 0.92rem; margin-bottom: 3px;">
              ${t.subject || "សំណូមពរទូទៅ"}
            </div>
            <div class="kh-text" style="font-size: 0.8rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              "${msgPreview}"
            </div>
            ${
              t.adminReply
                ? `<div class="kh-text" style="font-size: 0.75rem; color: #0f766e; background: #f0fdfa; padding: 3px 8px; border-radius: 6px; margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; border-left: 3px solid #0d9488;">
                     <b>${responderDisplay}:</b>${t.adminReply}
                   </div>`
                : ""
            }
          </td>

          <!-- 4. Priority -->
          <td>${priorityHtml}</td>

          <!-- 5. Status & Responder -->
          <td>${statusHtml}</td>

          <!-- 6. Actions -->
          <td style="text-align: right; white-space: nowrap;">
            <button onclick="viewUserMessage('${ownerKey}', '${tId}')" class="kh-text" style="padding: 7px 12px; border-radius: 8px; border: 1px solid var(--border, #cbd5e1); background: var(--bg-body, #f8fafc); color: var(--text-main); font-weight: 700; font-size: 0.8rem; cursor: pointer; margin-right: 6px; transition: 0.2s;" title="មើលរបាយការណ៍លម្អិត">
              <i class="fa-solid fa-file-magnifying-glass" style="color: #0d9488;"></i> មើលសារ
            </button>
            <button onclick="replyTicket('${ownerKey}', '${tId}')" class="kh-text" style="padding: 7px 14px; border-radius: 8px; border: none; background: ${isAnswered ? "#0f766e" : "#2563eb"}; color: white; font-weight: 700; font-size: 0.8rem; cursor: pointer; transition: 0.2s; box-shadow: 0 3px 8px rgba(37, 99, 235, 0.18);">
              <i class="fa-solid ${isAnswered ? "fa-pen-to-square" : "fa-reply"}"></i> ${isAnswered ? "កែចម្លើយ" : "ឆ្លើយតប"}
            </button>
          </td>
        </tr>
      `;
    })
    .join("");

  if (pageInfo)
    pageInfo.innerText = `ទំព័រ ${currentMainTicketPage} នៃ ${totalPages} (សរុប ${filteredSupportTicketsList.length})`;
  if (prevBtn) prevBtn.disabled = currentMainTicketPage === 1;
  if (nextBtn) nextBtn.disabled = currentMainTicketPage === totalPages;
}

window.changeMainTicketPage = function (step) {
  currentMainTicketPage += step;
  renderMainTicketsTableRows();
};

// ============================================================================
// 🔎 ជំពូកទី ៤៖ ការមើលសំបុត្រលម្អិត និងការឆ្លើយតបតាម `_id` (VIEW & REPLY MODAL BY `_id`)
// ============================================================================

/**
 * 🔹 ៤.១ លោតពីតារាង Ticket ទៅបើក Customer 360° តាមរយៈ MongoDB `_id` របស់អតិថិជន
 */
window.jumpFromTicketToCustomer360 = function (ownerId) {
  const c360MenuBtn = document.getElementById("menu-customer-360");
  if (typeof showSection === "function") {
    showSection("customer-360", c360MenuBtn);
  }

  const searchInput = document.getElementById("searchC360");
  if (searchInput && typeof searchCustomer360 === "function") {
    searchInput.value = ownerId;
    searchCustomer360().then(() => {
      if (typeof switchC360Tab === "function") {
        switchC360Tab("tickets");
      }
    });
  }
};

/**
 * 🔹 ៤.២ មើលរបាយការណ៍សំណូមពរលម្អិតតាមរយៈ `ownerId` (`_id`) និងបង្ហាញឈ្មោះពេញ
 */
window.viewUserMessage = function (ownerId, ticketId) {
  const ticket = findSupportTicketRecord(ownerId, ticketId);
  if (!ticket) return;

  const isAnswered =
    ticket.status === "Answered" || ticket.status === "Resolved";
  const customerFullName =
    ticket.fullName || ticket.username || "អតិថិជន U-Pay";
  const adminFullName = String(
    ticket.repliedBy || getActiveAdminDisplayName(),
  ).replace(/^@/, "");

  Swal.fire({
    title: `<span class="kh-text" style="color:#004d40; font-size: 1.2rem;"><i class="fa-solid fa-file-contract"></i> របាយការណ៍សំបុត្រ #${ticket.ticketId || "N/A"}</span>`,
    html: `
      <div style="text-align: left; font-family: 'Kantumruy Pro', sans-serif; margin-top: 8px;">
        <div style="margin-bottom: 12px; padding: 16px; background: #f8fafc; border-radius: 14px; border: 1px solid #e2e8f0;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-size: 0.78rem; color: #64748b; font-weight: 800;"><i class="fa-solid fa-user-pen"></i> សំណើពីអតិថិជន៖ ${customerFullName}</span>
            <span style="font-size: 0.75rem; font-weight: 800; padding: 2px 9px; border-radius: 12px; background: ${isAnswered ? "#dcfce7" : "#fef9c3"}; color: ${isAnswered ? "#059669" : "#d97706"};">${ticket.status || "Pending"}</span>
          </div>
          <div style="font-size: 0.98rem; font-weight: 800; color: #0f172a; margin-bottom: 8px;">ប្រធានបទ៖ ${ticket.subject || "N/A"}</div>
          <div style="margin: 0; font-size: 0.95rem; color: #1e293b; line-height: 1.6; background: white; padding: 12px; border-radius: 10px; border: 1px solid #e2e8f0;">
            ${ticket.description || ticket.message || ""}
          </div>
        </div>

        ${
          ticket.adminReply
            ? `<div style="margin-bottom: 12px; padding: 14px; background: #f0fdfa; border-radius: 14px; border: 1px solid #99f6e4;">
                 <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                   <span style="font-size: 0.78rem; color: #0f766e; font-weight: 800;"><i class="fa-solid fa-file-signature"></i> របាយការណ៍ឆ្លើយតបផ្លូវការ៖</span>
                   <span style="font-size: 0.74rem; background: #ccfbf1; color: #0f766e; padding: 2px 8px; border-radius: 6px; font-weight: 800;">${adminFullName}</span>
                 </div>
                 <p style="margin: 0; font-size: 0.92rem; color: #0f172a; line-height: 1.5;">
                   <strong style="color: #0f766e;">${adminFullName}:</strong>${ticket.adminReply}
                 </p>
               </div>`
            : ""
        }

        <div style="font-size: 0.78rem; color: #94a3b8; display: flex; justify-content: space-between; padding: 0 4px;">
          <span><i class="fa-regular fa-clock"></i> បញ្ជូននៅ៖ ${ticket.date || "N/A"}</span>
          ${ticket.repliedAt ? `<span><i class="fa-solid fa-check-double"></i> ឆ្លើយតប៖ ${ticket.repliedAt}</span>` : ""}
        </div>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText:
      '<span class="kh-text"><i class="fa-solid fa-file-pen"></i> ឆ្លើយតបសំណើ</span>',
    cancelButtonText: '<span class="kh-text">បិទផ្ទាំង</span>',
    confirmButtonColor: "#0f766e",
    cancelButtonColor: "#64748b",
    customClass: { popup: "modal-radius kh-text premium-swal" },
  }).then((res) => {
    if (res.isConfirmed) {
      replyTicket(ownerId, ticketId);
    }
  });
};

/**
 * 🔹 ៤.៣ ឆ្លើយតបសំបុត្រជំនួយតាមរយៈ MongoDB `_id` របស់អតិថិជន (បង្ហាញឈ្មោះពេញ `fullName`)
 */
window.replyTicket = async function (ownerId, ticketId) {
  const ticket = findSupportTicketRecord(ownerId, ticketId);
  const canonicalOwnerId = ticket
    ? String(ticket.userId || ticket.userCustomId || ownerId)
    : String(ownerId).trim();
  const customerFullName = ticket
    ? ticket.fullName || ticket.username
    : String(ownerId);
  const activeAdminName = getActiveAdminDisplayName();

  const { value: text } = await Swal.fire({
    title: `<span class="kh-text" style="font-size: 1.25rem; color: #0f172a;"><i class="fa-solid fa-file-signature" style="color: #0d9488;"></i> របាយការណ៍ឆ្លើយតបសំណូមពរ</span>`,
    html: `
      <div style="text-align: left; font-family: 'Kantumruy Pro', sans-serif; margin-top: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center; background: #f0fdfa; padding: 8px 12px; border-radius: 10px; border: 1px solid #99f6e4; margin-bottom: 12px; font-size: 0.8rem;">
          <span style="color: #0f766e; font-weight: 700;"><i class="fa-solid fa-user-shield"></i> មន្ត្រីឆ្លើយតប (Admin):</span>
          <span style="font-weight: 800; color: #0f766e; background: #ccfbf1; padding: 2px 8px; border-radius: 6px;">${activeAdminName}</span>
        </div>

        ${
          ticket
            ? `<div style="background: #f8fafc; padding: 12px 14px; border-radius: 12px; border-left: 4px solid #f59e0b; margin-bottom: 14px; font-size: 0.85rem;">
                 <div style="font-weight: 800; color: #0f172a; margin-bottom: 3px;">ប្រធានបទ៖ ${ticket.subject} (${customerFullName})</div>
                 <div style="color: #475569;">"${ticket.description || ticket.message || ""}"</div>
               </div>`
            : ""
        }

        <label style="font-size: 0.8rem; font-weight: 700; color: #64748b; display: block; margin-bottom: 6px;">ជ្រើសរើសទម្រង់របាយការណ៍រហ័ស (Quick Templates)៖</label>
        <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px;">
          <span onclick="document.getElementById('swal-main-tck-reply').value='សួស្តីបង! ក្រុមការងារបានពិនិត្យ និងដោះស្រាយបញ្ហារបស់បងរួចរាល់ហើយ។ សូមអរគុណ!'" style="font-size: 0.75rem; background: #f0fdfa; color: #0f766e; border: 1px solid #99f6e4; padding: 4px 10px; border-radius: 20px; cursor: pointer; font-weight: 700;">✅ ដោះស្រាយរួចរាល់</span>
          <span onclick="document.getElementById('swal-main-tck-reply').value='សួស្តីបង! ក្រុមការងារកំពុងត្រួតពិនិត្យករណីនេះជូនបង សូមរង់ចាំបន្តិចណា។ សូមបងជួយផ្តល់ព័ត៌មាន ឬលេខយោងប្រតិបត្តិការ (Ref ID) បន្ថែម ដើម្បីឱ្យក្រុមការងារងាយស្រួលឆែកជូនណា។'" style="font-size: 0.75rem; background: #fef9c3; color: #d97706; border: 1px solid #fde68a; padding: 4px 10px; border-radius: 20px; cursor: pointer; font-weight: 700;">⏳ កំពុងពិនិត្យ & សុំ Ref ID</span>
          <span onclick="document.getElementById('swal-main-tck-reply').value='សួស្តីបង! ករណីនេះត្រូវបានបញ្ជូនទៅកាន់ផ្នែកបច្ចេកទេសជាន់ខ្ពស់ដើម្បីផ្ទៀងផ្ទាត់ជូនបងហើយ។'" style="font-size: 0.75rem; background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; padding: 4px 10px; border-radius: 20px; cursor: pointer; font-weight: 700;">📋 បញ្ជូនទៅផ្នែកបច្ចេកទេស</span>
        </div>

        <label style="font-size: 0.8rem; font-weight: 700; color: #475569; display: block; margin-bottom: 6px;">ខ្លឹមសាររបាយការណ៍ឆ្លើយតបទៅកាន់ ${customerFullName} <span style="color:red">*</span></label>
        <textarea id="swal-main-tck-reply" class="swal2-textarea kh-text" placeholder="វាយបញ្ចូលរបាយការណ៍ឆ្លើយតបនៅទីនេះ..." style="width: 100%; min-height: 110px; margin: 0; font-size: 0.92rem; padding: 12px; border-radius: 12px; box-sizing: border-box; font-family: 'Kantumruy Pro', sans-serif;">${ticket?.adminReply || ""}</textarea>
      </div>
    `,
    width: "550px",
    showCancelButton: true,
    confirmButtonText:
      '<span class="kh-text"><i class="fa-solid fa-paper-plane"></i> បញ្ជូនរបាយការណ៍</span>',
    cancelButtonText: '<span class="kh-text">បោះបង់</span>',
    confirmButtonColor: "#0f766e",
    cancelButtonColor: "#64748b",
    customClass: { popup: "modal-radius kh-text premium-swal" },
    preConfirm: () => {
      const val = document.getElementById("swal-main-tck-reply").value.trim();
      if (!val) {
        Swal.showValidationMessage("សូមវាយបញ្ចូលខ្លឹមសារឆ្លើយតប!");
        return false;
      }
      return val;
    },
  });

  if (text) {
    Swal.fire({
      title: "កំពុងបញ្ជូនរបាយការណ៍...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
      customClass: { popup: "premium-swal kh-text" },
    });

    try {
      const res = await fetch("/api/admin/ticket-reply", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          _id: canonicalOwnerId,
          userId: canonicalOwnerId,
          username: ticket ? ticket.username : ownerId,
          ticketId,
          replyMessage: text,
        }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchAllSupportTickets(false);
        if (typeof loadData === "function") loadData();
        Swal.fire({
          icon: "success",
          title: "បានបញ្ជូនរបាយការណ៍ជោគជ័យ!",
          text: `ឆ្លើយតបដោយ ${activeAdminName} ទៅកាន់ ${customerFullName} រួចរាល់។`,
          timer: 1700,
          showConfirmButton: false,
          customClass: { popup: "premium-swal kh-text" },
        });
      } else {
        Swal.fire("បរាជ័យ", data.message || "មិនអាចផ្ញើសារបានទេ", "error");
      }
    } catch (e) {
      Swal.fire("Error", "មានបញ្ហាតភ្ជាប់ទៅកាន់ Server", "error");
    }
  }
};

// ============================================================================
// 🎬 ជំពូកទី ៥៖ ការចាប់ផ្តើមដំណើរការតារាងសំបុត្រជំនួយដោយស្វ័យប្រវត្តិ (AUTO-INIT HOOK)
// ============================================================================
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    if (document.getElementById("ticketTableBody")) {
      fetchAllSupportTickets(false);
    }
  }, 600);
});
