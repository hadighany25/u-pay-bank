let currentC360User = null;

function searchCustomer360() {
  const term = document.getElementById("searchC360").value.toLowerCase().trim();
  if (!term) return;

  // ស្វែងរកក្នុងទិន្នន័យ User ទាំងអស់ដែល loadData() បានទាញមករួច
  const foundUser = globalUsersData.find(
    (u) =>
      (u.username && u.username.toLowerCase().includes(term)) ||
      (u.phoneNumber && u.phoneNumber.includes(term)) ||
      (u.accountNumber && u.accountNumber.includes(term)) ||
      (u.fullName && u.fullName.toLowerCase().includes(term)),
  );

  if (foundUser) {
    renderCustomerProfile(foundUser);
  } else {
    Swal.fire({
      icon: "error",
      title: "រកមិនឃើញអតិថិជននេះទេ",
      text: "សូមពិនិត្យមើលឈ្មោះ, លេខទូរស័ព្ទ ឬលេខគណនីម្តងទៀត។",
      customClass: { popup: "premium-swal" },
    });
    document.getElementById("c360-result-container").style.display = "none";
  }
}

function renderCustomerProfile(user) {
  currentC360User = user;
  document.getElementById("c360-result-container").style.display = "block";

  // 1. ព័ត៌មានទូទៅ
  document.getElementById("c360-avatar").src =
    user.profileImage || "../images/default-avatar.png";
  document.getElementById("c360-name").innerText =
    user.fullName || user.username;
  document.getElementById("c360-username").innerHTML =
    `<i class="fa-solid fa-at"></i> ${user.username}`;
  document.getElementById("c360-phone").innerHTML =
    `<i class="fa-solid fa-phone"></i> ${user.phoneNumber || "N/A"}`;

  // Status Badges
  let statusHtml = "";
  if (user.isFrozen)
    statusHtml += `<span style="background: #fee2e2; color: #ef4444; padding: 4px 8px; border-radius: 8px; font-weight: bold; font-size: 0.75rem;">FROZEN</span> `;
  else
    statusHtml += `<span style="background: #dcfce7; color: #10b981; padding: 4px 8px; border-radius: 8px; font-weight: bold; font-size: 0.75rem;">ACTIVE</span> `;

  if (user.kycStatus === "verified" || user.kycStatus === "approved")
    statusHtml += `<span style="background: #dbeafe; color: #3b82f6; padding: 4px 8px; border-radius: 8px; font-weight: bold; font-size: 0.75rem;"><i class="fa-solid fa-circle-check"></i> KYC</span>`;
  document.getElementById("c360-status-badge").innerHTML = statusHtml;

  // 2. គូរ Tab KYC និងប៊ូតុងបដិសេធ (Revoke KYC)
  renderKycTab(user);
}

function switchC360Tab(tabName) {
  document
    .querySelectorAll(".c360-tab")
    .forEach((t) => t.classList.remove("active"));
  document
    .querySelectorAll(".c360-tab-content")
    .forEach((c) => (c.style.display = "none"));

  event.currentTarget.classList.add("active");
  document.getElementById(`c360-tab-${tabName}`).style.display = "block";
}

function renderKycTab(user) {
  const kycTab = document.getElementById("c360-tab-kyc");
  if (!user.kycDocument) {
    kycTab.innerHTML = `<div style="text-align:center; padding: 30px; color: var(--text-muted);">អតិថិជននេះមិនទាន់បានបញ្ជូនឯកសារ KYC ទេ។</div>`;
    return;
  }

  // បើធ្លាប់ Approve ហើយ បង្ហាញប៊ូតុង Revoke
  let revokeBtnHtml = "";
  if (user.kycStatus === "verified" || user.kycStatus === "approved") {
    revokeBtnHtml = `
      <div style="margin-top: 20px; border-top: 1px dashed var(--border); padding-top: 20px;">
        <button onclick="promptRevokeKyc('${user.username}')" style="background: #ef4444; color: white; border: none; padding: 10px 20px; border-radius: 10px; cursor: pointer; font-weight: bold;">
          <i class="fa-solid fa-ban"></i> បដិសេធ KYC វិញ (Revoke)
        </button>
        <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 10px;">*ការចុចបដិសេធ នឹងទម្លាក់គណនីនេះទៅជា Unverified វិញ។</p>
      </div>
    `;
  } else if (user.kycStatus === "pending") {
    revokeBtnHtml = `<div style="margin-top: 20px; color: #f59e0b; font-weight: bold;">ឯកសារនេះកំពុងរង់ចាំការពិនិត្យ (Pending)</div>`;
  } else {
    revokeBtnHtml = `<div style="margin-top: 20px; color: #ef4444; font-weight: bold;">ឯកសារនេះត្រូវបានបដិសេធរួចហើយ។</div>`;
  }

  kycTab.innerHTML = `
    <h4>ឯកសារអត្តសញ្ញាណប័ណ្ណ / លិខិតឆ្លងដែន</h4>
    <img src="${user.kycDocument}" style="max-width: 400px; border-radius: 15px; border: 1px solid var(--border); cursor: pointer;" onclick="viewKycDocument('${user.kycDocument}')" />
    ${revokeBtnHtml}
  `;
}

// មុខងារ Admin ដកសិទ្ធិ KYC វិញ (Revoke)
async function promptRevokeKyc(username) {
  const { value: reason } = await Swal.fire({
    title: "បដិសេធឯកសារ KYC នេះ?",
    input: "text",
    inputLabel: "មូលហេតុនៃការបដិសេធ (Reason):",
    inputPlaceholder: "ឧ. ឯកសារផុតកំណត់, រូបភាពមិនច្បាស់...",
    showCancelButton: true,
    confirmButtonColor: "#ef4444",
    confirmButtonText: "បញ្ជាក់ការបដិសេធ",
    customClass: { popup: "premium-swal" },
    inputValidator: (value) => {
      if (!value) return "សូមបញ្ជាក់មូលហេតុ!";
    },
  });

  if (reason) {
    // កន្លែងនេះនឹងត្រូវហៅ API ទៅ Backend របស់អ្នកដើម្បីប្តូរ Status
    Swal.fire({
      icon: "success",
      title: "បានបដិសេធ KYC ជោគជ័យ!",
      text: `មូលហេតុ: ${reason}`,
      customClass: { popup: "premium-swal" },
    });
    // Update UI បណ្តោះអាសន្ន
    currentC360User.kycStatus = "rejected";
    renderCustomerProfile(currentC360User);
  }
}
