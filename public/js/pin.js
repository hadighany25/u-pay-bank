// ==========================================
// 🔐 REUSABLE PIN MODAL MODULE (js/pin.js)
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
  // បង្កើត HTML របស់ PIN Modal បញ្ចូលទៅក្នុងទំព័រដោយស្វ័យប្រវត្តិ ពេលទំព័រ Load
  if (!document.getElementById("globalPinModal")) {
    const pinHTML = `
      <div class="pin-modal-overlay" id="globalPinModal" style="display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(5px); z-index: 99999; align-items: center; justify-content: center;">
        <div class="pin-card" style="background: white; width: 85%; max-width: 320px; border-radius: 24px; padding: 30px 20px; text-align: center; box-shadow: 0 15px 40px rgba(0,0,0,0.3); position: relative; animation: popIn 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);">
          
          <!-- ប៊ូតុងបិទ (X) -->
          <button onclick="closeGlobalPin()" style="position: absolute; top: 15px; right: 15px; background: #f1f5f9; border: none; width: 32px; height: 32px; border-radius: 50%; color: #64748b; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.2s;">
             <i class="fa-solid fa-xmark"></i>
          </button>

          <i class="fa-solid fa-shield-halved" style="font-size: 3rem; color: #10b981; margin-bottom: 15px;"></i>
          
          <h3 style="margin: 0 0 5px 0; color: #1e293b; font-family: 'Kantumruy Pro', sans-serif;" id="pinModalTitle">
            សូមបញ្ចូលលេខកូដ PIN
          </h3>
          <p style="font-size: 0.85rem; color: #64748b; margin: 0 0 20px 0; font-family: 'Kantumruy Pro', sans-serif;" id="pinModalDesc">
            ដើម្បីបញ្ជាក់ប្រតិបត្តិការ
          </p>
          
          <div class="pin-dots-container" style="display: flex; justify-content: center; gap: 15px; margin: 25px 0;" onclick="document.getElementById('hiddenGlobalPin').focus()">
            <div class="pin-dot" id="gDot1" style="width: 16px; height: 16px; border-radius: 50%; border: 2px solid #cbd5e1; transition: 0.2s;"></div>
            <div class="pin-dot" id="gDot2" style="width: 16px; height: 16px; border-radius: 50%; border: 2px solid #cbd5e1; transition: 0.2s;"></div>
            <div class="pin-dot" id="gDot3" style="width: 16px; height: 16px; border-radius: 50%; border: 2px solid #cbd5e1; transition: 0.2s;"></div>
            <div class="pin-dot" id="gDot4" style="width: 16px; height: 16px; border-radius: 50%; border: 2px solid #cbd5e1; transition: 0.2s;"></div>
          </div>
          
          <!-- Input លាក់ពីក្រោយ សម្រាប់ចាប់យកលេខនៅលើទូរស័ព្ទ -->
          <input
            type="tel"
            id="hiddenGlobalPin"
            maxlength="4"
            style="opacity: 0; position: absolute; z-index: -1;"
            oninput="handleGlobalPinInput(this.value)"
            pattern="[0-9]*"
            inputmode="numeric"
          />
          
          <button style="width: 100%; background: #004d40; color: white; border: none; padding: 14px; border-radius: 14px; font-weight: bold; font-family: 'Kantumruy Pro', sans-serif; cursor: pointer; transition: 0.2s; box-shadow: 0 4px 10px rgba(0, 77, 64, 0.2);" onclick="document.getElementById('hiddenGlobalPin').focus()">
             ចុចដើម្បីវាយលេខកូដ
          </button>
        </div>
      </div>
      <style>
        @keyframes popIn { 0% { transform: scale(0.8); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        /* មុខងារងងឹត (Dark Mode) សម្រាប់ PIN */
        body.dark-mode .pin-card { background: #1e293b !important; }
        body.dark-mode #pinModalTitle { color: #f8fafc !important; }
        body.dark-mode #pinModalDesc { color: #94a3b8 !important; }
        body.dark-mode .pin-dot { border-color: #475569 !important; }
      </style>
    `;
    document.body.insertAdjacentHTML("beforeend", pinHTML);
  }
});

// អថេរទុកសម្រាប់ដំណើរការមុខងារបន្ទាប់ពីវាយលេខកូដត្រូវ
let pinSuccessCallback = null;

// មុខងារបង្ហាញ PIN
// ឧទាហរណ៍ប្រើ៖ requestPinVerification("វេរប្រាក់", "បញ្ជាក់ការវេរប្រាក់ចំនួន $10", function() { លុយបាញ់ចេញ })
function requestPinVerification(titleText, descText, onSuccess) {
  document.getElementById("pinModalTitle").innerText =
    titleText || "សូមបញ្ចូលលេខកូដ PIN";
  document.getElementById("pinModalDesc").innerText =
    descText || "ដើម្បីបញ្ជាក់ប្រតិបត្តិការ";

  pinSuccessCallback = onSuccess;

  const modal = document.getElementById("globalPinModal");
  const hiddenInput = document.getElementById("hiddenGlobalPin");

  // Clear ចាស់ចោល
  hiddenInput.value = "";
  updateGlobalPinDots(0);

  modal.style.display = "flex";

  // Auto-focus បន្ទាប់ពីលោតចេញ
  setTimeout(() => {
    hiddenInput.focus();
  }, 100);
}

// មុខងារបិទ PIN Modal ដោយដៃ
function closeGlobalPin() {
  document.getElementById("globalPinModal").style.display = "none";
  document.getElementById("hiddenGlobalPin").blur();
  pinSuccessCallback = null; // ដក Callback ចេញដើម្បីការពារ Error
}

// មុខងារចាប់លេខកូដដែលកំពុងវាយ
function handleGlobalPinInput(val) {
  // កាត់យកត្រឹម ៤ខ្ទង់
  if (val.length > 4) {
    val = val.substring(0, 4);
    document.getElementById("hiddenGlobalPin").value = val;
  }

  updateGlobalPinDots(val.length);

  // ពេលវាយគ្រប់ ៤ខ្ទង់
  if (val.length === 4) {
    const inputPin = val;
    document.getElementById("hiddenGlobalPin").blur();

    // សុំផ្អាកមួយភ្លែត (Loading) ដើម្បីឆែក
    document.getElementById("globalPinModal").style.display = "none";

    // ទាញ User ពី Session ដើម្បីយក PIN ពិតប្រាកដមកផ្ទៀង
    const user = JSON.parse(sessionStorage.getItem("user"));

    if (user && user.pin === inputPin) {
      // បើវាយត្រូវ ហៅមុខងារ Callback មកដំណើរការ
      if (typeof pinSuccessCallback === "function") {
        pinSuccessCallback();
      }
    } else {
      // បើវាយខុស លោតសារ ហើយអោយវាយម្តងទៀត
      Swal.fire({
        icon: "error",
        title: "លេខកូដមិនត្រឹមត្រូវ!",
        text: "សូមព្យាយាមម្តងទៀត។",
        confirmButtonColor: "#ef4444",
        customClass: { popup: "premium-swal" },
      }).then(() => {
        // លុបទិន្នន័យចាស់ រួចហៅ Modal មកវិញ
        document.getElementById("hiddenGlobalPin").value = "";
        updateGlobalPinDots(0);
        document.getElementById("globalPinModal").style.display = "flex";
        setTimeout(
          () => document.getElementById("hiddenGlobalPin").focus(),
          300,
        );
      });
    }
  }
}

// មុខងារប្តូរពណ៌ដុត (Dots) ពេលវាយ
function updateGlobalPinDots(len) {
  for (let i = 1; i <= 4; i++) {
    const dot = document.getElementById("gDot" + i);
    if (i <= len) {
      dot.style.background = "#10b981"; // បៃតង U-Pay
      dot.style.borderColor = "#10b981";
    } else {
      // ដកពណ៌ចេញវិញបើលុប
      const isDark = document.body.classList.contains("dark-mode");
      dot.style.background = "transparent";
      dot.style.borderColor = isDark ? "#475569" : "#cbd5e1";
    }
  }
}
