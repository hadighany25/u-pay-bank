// ========================================================================
// ឯកសារ: admin-fx.js
// អត្ថន័យ: គ្រប់គ្រងការទាញយក និងកែប្រែអត្រាប្តូរប្រាក់ (Exchange Rates)
// ========================================================================

window.currentFXRates = { usdToKhrBuy: 4050, usdToKhrSell: 4100 }; // អថេរសកល (Global Variable)

async function fetchFXRates() {
  try {
    const res = await fetch("/api/admin/fx/rates", {
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (data.success && data.rates) {
      window.currentFXRates = data.rates;

      const buyInput = document.getElementById("fxBuy");
      const sellInput = document.getElementById("fxSell");
      if (buyInput) buyInput.value = data.rates.usdToKhrBuy;
      if (sellInput) sellInput.value = data.rates.usdToKhrSell;
    }
  } catch (e) {
    console.error("Error loading FX rates", e);
  }
}
fetchFXRates(); // ទាញយកអត្រាប្តូរប្រាក់ពេល Load ទំព័រភ្លាម

window.updateFX = async function () {
  const buy = document.getElementById("fxBuy").value;
  const sell = document.getElementById("fxSell").value;
  try {
    Swal.fire({
      title: "កំពុងរក្សាទុក...",
      didOpen: () => Swal.showLoading(),
      customClass: { popup: "premium-swal" },
    });
    const res = await fetch("/api/admin/fx/update", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ buy, sell }),
    });
    const data = await res.json();
    if (data.success) {
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "Exchange Rates Updated!",
        showConfirmButton: false,
        timer: 1500,
        customClass: { popup: "premium-swal" },
      });
      fetchFXRates(); // Refresh លេខកូដសកលឡើងវិញ
    } else {
      Swal.fire({
        icon: "error",
        title: "បរាជ័យ!",
        text: data.message || "មិនអាចកែប្រែបានទេ",
        customClass: { popup: "premium-swal" },
      });
    }
  } catch (error) {
    Swal.fire({
      icon: "error",
      title: "Error",
      text: "បញ្ហាតភ្ជាប់ទៅកាន់ Server",
      customClass: { popup: "premium-swal" },
    });
  }
};
