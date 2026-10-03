// ========================================================================
// ឯកសារ: admin-cashier.js
// អត្ថន័យ: គ្រប់គ្រងប្រព័ន្ធបេឡាករ (Cashier System) ដាក់/ដកប្រាក់
// ========================================================================

let currentTargetUser = null;
let currentDepositorUser = null;

window.toggleDepositorType = function () {
  const typeEle = document.querySelector('input[name="depositorType"]:checked');
  if (!typeEle) return;
  const type = typeEle.value;
  const otherDiv = document.getElementById("otherDepositorDiv");

  if (type === "other") {
    otherDiv.style.display = "block";
  } else {
    otherDiv.style.display = "none";
    currentDepositorUser = null;
    document.getElementById("depositorSearch").value = "";
    document.getElementById("depositorName").style.display = "none";
  }
};

window.searchTargetUser = async function () {
  const searchVal = document.getElementById("targetUserSearch").value.trim();
  if (!searchVal) return;

  // បើអ្នកចង់ប្រើ Universal Search សម្រាប់ទិន្នន័យ Local អ្នកអាចឆែក `globalUsersData` ជាមុនបាន
  // តែដោយសារ Cashier ទាមទារទិន្នន័យ Balance ច្បាស់លាស់ ១០០% ការទាញផ្ទាល់ពី API គឺល្អជាង។

  Swal.fire({
    title: "កំពុងស្វែងរក...",
    didOpen: () => Swal.showLoading(),
    customClass: { popup: "premium-swal" },
  });

  try {
    const res = await fetch(`/api/admin/cashier/search/${searchVal}`, {
      headers: getAuthHeaders(),
    });
    const data = await res.json();

    if (data.success) {
      Swal.close();
      currentTargetUser = data.user;

      document.getElementById("targetUserCard").style.display = "flex";
      document.getElementById("transactionForm").style.display = "block";

      document.getElementById("cardAvatar").src =
        currentTargetUser.profileImage || "../images/default-avatar.png";
      document.getElementById("cardName").textContent =
        `${currentTargetUser.fullName} (@${currentTargetUser.username})`;

      const balUSD = currentTargetUser.mainAccounts?.USD?.balance || 0;
      const balKHR = currentTargetUser.mainAccounts?.KHR?.balance || 0;

      document.getElementById("cardBalUSD").textContent =
        `USD: $${balUSD.toFixed(2)}`;
      document.getElementById("cardBalKHR").textContent =
        `KHR: ៛${balKHR.toLocaleString()}`;

      const accountSelect = document.getElementById("targetAccountSelect");
      let optionHTML = "";

      const accUSD = currentTargetUser.mainAccounts?.USD?.accountNumber;
      const accKHR = currentTargetUser.mainAccounts?.KHR?.accountNumber;

      if (accUSD)
        optionHTML += `<option value="${accUSD}">Main USD: ${accUSD}</option>`;
      if (accKHR)
        optionHTML += `<option value="${accKHR}">Main KHR: ${accKHR}</option>`;

      if (
        currentTargetUser.subAccounts &&
        currentTargetUser.subAccounts.length > 0
      ) {
        currentTargetUser.subAccounts.forEach((sub) => {
          optionHTML += `<option value="${sub.accountNumber}">${sub.accountName} (${sub.currency}): ${sub.accountNumber}</option>`;
        });
      }

      accountSelect.innerHTML = optionHTML;

      let foundExactMatch = false;
      for (let i = 0; i < accountSelect.options.length; i++) {
        if (accountSelect.options[i].value === searchVal) {
          accountSelect.selectedIndex = i;
          foundExactMatch = true;

          const cashCurrency = document.getElementById("cashCurrency");
          const selectedSub = currentTargetUser.subAccounts?.find(
            (s) => s.accountNumber === searchVal,
          );

          if (selectedSub) cashCurrency.value = selectedSub.currency;
          else if (
            searchVal === currentTargetUser.mainAccounts?.KHR?.accountNumber
          )
            cashCurrency.value = "KHR";
          else cashCurrency.value = "USD";
          break;
        }
      }
      if (!foundExactMatch)
        document.getElementById("cashCurrency").value = "USD";

      if (typeof previewCashierExchange === "function")
        previewCashierExchange();
    } else {
      Swal.fire({
        icon: "error",
        title: "បរាជ័យ",
        text: data.message || "រកមិនឃើញគណនីនេះទេ!",
        customClass: { popup: "premium-swal" },
      });
      document.getElementById("targetUserCard").style.display = "none";
      document.getElementById("transactionForm").style.display = "none";
      currentTargetUser = null;
    }
  } catch (error) {
    Swal.fire({
      icon: "error",
      title: "Error",
      text: "បញ្ហាភ្ជាប់ទៅកាន់ Server",
      customClass: { popup: "premium-swal" },
    });
  }
};

window.verifyDepositor = async function () {
  const val = document.getElementById("depositorSearch").value.trim();
  const nameText = document.getElementById("depNameText");

  if (val.length >= 3) {
    document.getElementById("depositorName").style.display = "block";
    nameText.innerText = "កំពុងស្វែងរក...";
    nameText.style.color = "var(--text-muted)";

    try {
      const res = await fetch(`/api/admin/cashier/search/${val}`, {
        method: "GET",
        headers: getAuthHeaders(),
      });
      const result = await res.json();

      if (result.success) {
        currentDepositorUser = result.user;
        nameText.innerText = `${currentDepositorUser.fullName} (@${currentDepositorUser.username})`;
        nameText.style.color = "var(--secondary)";
      } else {
        currentDepositorUser = null;
        nameText.innerText = "រកមិនឃើញគណនីនេះទេ!";
        nameText.style.color = "#ef4444";
      }
    } catch (error) {
      nameText.innerText = "មានបញ្ហាតភ្ជាប់ (Error Network)";
      nameText.style.color = "#ef4444";
    }
  } else {
    document.getElementById("depositorName").style.display = "none";
    currentDepositorUser = null;
  }
};

window.viewKYC = function () {
  if (!currentTargetUser || !currentTargetUser.kycImage) {
    return Swal.fire({
      icon: "info",
      title: "ព័ត៌មាន",
      text: "អតិថិជននេះមិនទាន់មានរូប KYC ទេ",
      customClass: { popup: "premium-swal" },
    });
  }
  Swal.fire({
    title: `អត្តសញ្ញាណប័ណ្ណរបស់ ${currentTargetUser.fullName}`,
    imageUrl: currentTargetUser.kycImage,
    imageWidth: 400,
    imageAlt: "KYC Image",
    customClass: { popup: "premium-swal" },
  });
};

window.previewCashierExchange = function () {
  const targetSelect = document.getElementById("targetAccountSelect");
  if (!targetSelect || targetSelect.options.length === 0) return;

  const selectedText = targetSelect.options[targetSelect.selectedIndex].text;
  let destCurrency = "USD";
  if (selectedText.includes("KHR") || selectedText.includes("៛"))
    destCurrency = "KHR";

  const currencySelect = document.getElementById("cashCurrency");
  if (!currencySelect) return;
  const inputCurrency = currencySelect.value;

  const amountInput = document.getElementById("cashAmount");
  if (!amountInput) return;
  const amount = parseFloat(amountInput.value) || 0;

  const previewBox = document.getElementById("cashierExchangePreview");
  const rateDisplay = document.getElementById("cashierFxRateDisplay");
  const resultText = document.getElementById("cashierExchangeResult");

  if (!previewBox || !rateDisplay || !resultText) return;

  const rateBuy = window.currentFXRates
    ? window.currentFXRates.usdToKhrBuy || 4050
    : 4050;
  const rateSell = window.currentFXRates
    ? window.currentFXRates.usdToKhrSell || 4100
    : 4100;

  if (amount > 0 && destCurrency !== inputCurrency) {
    previewBox.style.display = "block";

    if (inputCurrency === "USD" && destCurrency === "KHR") {
      const khrAmt = Math.round(amount * rateBuy);
      rateDisplay.innerText = `$1 = ${rateBuy.toLocaleString("en-US")} ៛`;
      resultText.innerText = `${khrAmt.toLocaleString("en-US")} ៛`;
    } else if (inputCurrency === "KHR" && destCurrency === "USD") {
      const usdAmt = (amount / rateSell).toFixed(2);
      rateDisplay.innerText = `$1 = ${rateSell.toLocaleString("en-US")} ៛`;
      resultText.innerText = `$${usdAmt}`;
    }
  } else {
    previewBox.style.display = "none";
  }
};

window.processCashTransaction = async function () {
  const typeEle = document.querySelector('input[name="depositorType"]:checked');
  const type = typeEle ? typeEle.value : "self";
  const targetAccountElement = document.getElementById("targetAccountSelect");
  const targetAccount = targetAccountElement
    ? targetAccountElement.value
    : null;
  const currency = document.getElementById("cashCurrency").value;
  const amount = document.getElementById("cashAmount").value;
  let remark = document.getElementById("cashRemark").value.trim();

  if (!amount || amount <= 0)
    return Swal.fire({
      icon: "error",
      title: "កំហុស",
      text: "សូមបញ្ចូលចំនួនទឹកប្រាក់ឱ្យបានត្រឹមត្រូវ",
      customClass: { popup: "premium-swal" },
    });
  if (!targetAccount)
    return Swal.fire({
      icon: "error",
      title: "កំហុស",
      text: "សូមជ្រើសរើសគណនី (Main ឬ កុងរង) ដែលត្រូវទទួលប្រាក់សិន",
      customClass: { popup: "premium-swal" },
    });
  if (type === "other" && !currentDepositorUser)
    return Swal.fire({
      icon: "error",
      title: "កំហុស",
      text: "សូមស្វែងរកគណនីអ្នកដាក់ប្រាក់ឱ្យបានត្រឹមត្រូវ",
      customClass: { popup: "premium-swal" },
    });

  if (!remark) {
    if (type === "self")
      remark = `ដាក់ប្រាក់ដោយម្ចាស់គណនី (${currentTargetUser.fullName})`;
    else
      remark = `ដាក់ប្រាក់ដោយ ${currentDepositorUser.fullName} ជូនទៅ ${currentTargetUser.fullName}`;
  }

  Swal.fire({
    title: "បញ្ជាក់ការដាក់ប្រាក់",
    html: `អ្នកកំពុងដាក់ប្រាក់ <b>${currency === "USD" ? "$" : "៛"}${amount}</b> <br>ចូលទៅគណនី <b>${targetAccount}</b> របស់ <b>@${currentTargetUser.username}</b> <br><br> <i>ចំណាំ៖ ${remark}</i>`,
    icon: "question",
    showCancelButton: true,
    confirmButtonColor: "#10b981",
    confirmButtonText: "យល់ព្រមដាក់ប្រាក់",
    customClass: { popup: "premium-swal" },
  }).then(async (result) => {
    if (result.isConfirmed) {
      Swal.fire({
        title: "កំពុងដំណើរការ...",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
        customClass: { popup: "premium-swal" },
      });

      try {
        const res = await fetch("/api/admin/cashier/transaction", {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            targetUsername: currentTargetUser.username,
            targetAccount: targetAccount,
            depositorType: type,
            depositorUsername: currentDepositorUser
              ? currentDepositorUser.username
              : null,
            currency: currency,
            amount: amount,
            remark: remark,
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

          // Clear ទិន្នន័យចេញពី Form ពេលជោគជ័យ
          document.getElementById("cashAmount").value = "";
          document.getElementById("cashRemark").value = "";
          document.getElementById("depositorSearch").value = "";
          document.getElementById("targetUserSearch").value = "";
          if (targetAccountElement) targetAccountElement.value = "";
          document.getElementById("targetUserCard").style.display = "none";
          document.getElementById("transactionForm").style.display = "none";
          const preBox = document.getElementById("cashierExchangePreview");
          if (preBox) preBox.style.display = "none";

          currentTargetUser = null;
          currentDepositorUser = null;
        } else {
          Swal.fire({
            icon: "error",
            title: "បរាជ័យ",
            text: data.message,
            customClass: { popup: "premium-swal" },
          });
        }
      } catch (error) {
        Swal.fire({
          icon: "error",
          title: "Error",
          text: "បញ្ហាភ្ជាប់ទៅកាន់ Server",
          customClass: { popup: "premium-swal" },
        });
      }
    }
  });
};
