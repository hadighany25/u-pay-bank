// ============================================================================
// ឯកសារ: js/luckySpin.js
// អត្ថន័យ: ម៉ូឌុលកងបង្វិលសំណាងសកល (Global Lucky Spin Cashback Module)
// ============================================================================

(function () {
  let spinIsActive = false;
  let onSpinFinishCallback = null;
  let currentSpinPayload = null;

  const PRIZES = [
    { label: "$0.05", value: 0.05, color: "#f59e0b" },
    { label: "$0.50", value: 0.5, color: "#10b981" },
    { label: "Oops!", value: 0.0, color: "#64748b" },
    { label: "$0.10", value: 0.1, color: "#3b82f6" },
    { label: "$1.00", value: 1.0, color: "#ef4444" },
    { label: "$0.20", value: 0.2, color: "#8b5cf6" },
  ];

  function ensureSpinModalDOM() {
    if (document.getElementById("upayGlobalSpinModal")) return;

    const style = document.createElement("style");
    style.innerHTML = `
      #upayGlobalSpinModal {
        display: none;
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.94);
        backdrop-filter: blur(6px);
        z-index: 99998;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        padding: 20px;
        font-family: "Kantumruy Pro", "Inter", sans-serif !important;
        animation: upaySpinFadeIn 0.3s ease;
      }
      @keyframes upaySpinFadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      .upay-wheel-card {
        background: linear-gradient(145deg, #1e293b, #0f172a);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 28px;
        padding: 28px 24px 22px;
        text-align: center;
        max-width: 360px;
        width: 100%;
        box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
      }
      .upay-wheel-box {
        position: relative;
        width: 270px;
        height: 270px;
        margin: 18px auto 24px;
      }
      .upay-wheel-pointer {
        position: absolute;
        top: -14px;
        left: 50%;
        transform: translateX(-50%);
        width: 0;
        height: 0;
        border-left: 14px solid transparent;
        border-right: 14px solid transparent;
        border-top: 26px solid #fbbf24;
        filter: drop-shadow(0 4px 6px rgba(0,0,0,0.4));
        z-index: 10;
      }
      .upay-wheel-canvas {
        width: 100%;
        height: 100%;
        border-radius: 50%;
        border: 6px solid #ffffff;
        box-shadow: 0 0 30px rgba(16, 185, 129, 0.45);
      }
      .upay-btn-spin-center {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 68px;
        height: 68px;
        border-radius: 50%;
        border: 4px solid #ffffff;
        background: linear-gradient(135deg, #004d40, #10b981);
        color: #ffffff;
        font-weight: 900;
        font-size: 1rem;
        cursor: pointer;
        z-index: 5;
        box-shadow: 0 6px 15px rgba(0, 0, 0, 0.35);
        transition: transform 0.2s;
      }
      .upay-btn-spin-center:active {
        transform: translate(-50%, -50%) scale(0.93);
      }
      .upay-btn-skip-spin {
        background: rgba(255, 255, 255, 0.08);
        color: #cbd5e1;
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 12px;
        font-size: 0.9rem;
        cursor: pointer;
        font-weight: 700;
        padding: 10px 22px;
        width: 100%;
        transition: 0.2s;
      }
      .upay-btn-skip-spin:hover {
        background: rgba(255, 255, 255, 0.15);
        color: #ffffff;
      }
    `;
    document.head.appendChild(style);

    const modal = document.createElement("div");
    modal.id = "upayGlobalSpinModal";
    modal.innerHTML = `
      <div class="upay-wheel-card">
        <div style="display:inline-flex; align-items:center; gap:6px; background:rgba(16,185,129,0.15); color:#34d399; padding:4px 12px; border-radius:20px; font-size:0.78rem; font-weight:800; margin-bottom:8px;">
          <i class="fa-solid fa-gift"></i> រង្វាន់ពិសេសពី U-PAY
        </div>
        <h2 style="color: #ffffff; margin: 0 0 6px; font-size: 1.5rem; font-weight: 800;">
          🎉 បង្វិលកងសំណាង (Lucky Spin)
        </h2>
        <p style="color: #94a3b8; margin: 0; font-size: 0.85rem; line-height: 1.4;">
          អ្នកបានផ្ទេរប្រាក់ចាប់ពី $10 ឡើងទៅ! សូមចុច <b>SPIN</b> ដើម្បីឈ្នះទឹកប្រាក់ត្រឡប់មកវិញ (Cashback)!
        </p>

        <div class="upay-wheel-box">
          <div class="upay-wheel-pointer"></div>
          <canvas id="upayWheelCanvas" class="upay-wheel-canvas" width="280" height="280"></canvas>
          <button type="button" id="upaySpinCenterBtn" class="upay-btn-spin-center">SPIN</button>
        </div>

        <button type="button" id="upaySkipSpinBtn" class="upay-btn-skip-spin">
          រំលង និងមើលវិក្កយបត្រ (Skip & View Slip)
        </button>
      </div>
    `;
    document.body.appendChild(modal);

    document
      .getElementById("upaySpinCenterBtn")
      .addEventListener("click", executeWheelSpin);
    document
      .getElementById("upaySkipSpinBtn")
      .addEventListener("click", closeAndFinishSpin);

    drawWheelCanvas();
  }

  function drawWheelCanvas() {
    const canvas = document.getElementById("upayWheelCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const arc = Math.PI / (PRIZES.length / 2);

    ctx.clearRect(0, 0, 280, 280);
    for (let i = 0; i < PRIZES.length; i++) {
      const a = i * arc;
      ctx.beginPath();
      ctx.fillStyle = PRIZES[i].color;
      ctx.moveTo(140, 140);
      ctx.arc(140, 140, 140, a, a + arc, false);
      ctx.lineTo(140, 140);
      ctx.fill();

      ctx.save();
      ctx.fillStyle = "#ffffff";
      ctx.translate(
        140 + Math.cos(a + arc / 2) * 88,
        140 + Math.sin(a + arc / 2) * 88,
      );
      ctx.rotate(a + arc / 2 + Math.PI / 2);
      ctx.font = "bold 19px 'Inter', sans-serif";
      const txt = PRIZES[i].label;
      ctx.fillText(txt, -ctx.measureText(txt).width / 2, 0);
      ctx.restore();
    }
  }

  async function executeWheelSpin() {
    if (spinIsActive || !currentSpinPayload) return;
    spinIsActive = true;

    const r = Math.random();
    const idx = r < 0.1 ? 4 : r < 0.3 ? 1 : r < 0.6 ? 5 : r < 0.8 ? 3 : 0;
    const chosenPrize = PRIZES[idx];

    const canvas = document.getElementById("upayWheelCanvas");
    canvas.style.transition = "transform 4s cubic-bezier(0.2, 0.8, 0.2, 1)";
    canvas.style.transform = `rotate(${360 * 5 + (270 - (idx * 60 + 30))}deg)`;

    setTimeout(async () => {
      if (chosenPrize.value > 0) {
        try {
          const res = await fetch("/api/reward/cashback", {
            method: "POST",
            headers: currentSpinPayload.authHeaders,
            body: JSON.stringify({
              username: currentSpinPayload.user.username,
              amount: chosenPrize.value,
              refId: currentSpinPayload.slipData?.refId || "TRX",
            }),
          });
          const d = await res.json();
          if (d.success) {
            if (
              currentSpinPayload.user.mainAccounts &&
              currentSpinPayload.user.mainAccounts.USD
            ) {
              currentSpinPayload.user.mainAccounts.USD.balance = d.balance;
            } else {
              currentSpinPayload.user.balance = d.balance;
            }
            sessionStorage.setItem(
              "user",
              JSON.stringify(currentSpinPayload.user),
            );

            try {
              new Audio(
                "https://notificationsounds.com/storage/sounds/file-sounds-1148-juntos.mp3",
              ).play();
            } catch (e) {}

            await Swal.fire({
              icon: "success",
              title: `អបអរសាទរ! ឈ្នះ $${chosenPrize.value.toFixed(2)}! 🎉`,
              text: "ទឹកប្រាក់រង្វាន់ Cashback ត្រូវបានបញ្ចូលក្នុងគណនី USD របស់អ្នករួចរាល់។",
              confirmButtonColor: "#004d40",
            });
          }
        } catch (err) {}
      } else {
        await Swal.fire({
          icon: "info",
          title: "សូមព្យាយាមម្ដងទៀតលើកក្រោយ!",
          text: "សូមអរគុណសម្រាប់ការប្រើប្រាស់សេវាកម្ម U-Pay។",
          confirmButtonColor: "#004d40",
        });
      }
      closeAndFinishSpin();
    }, 4100);
  }

  function closeAndFinishSpin() {
    const modal = document.getElementById("upayGlobalSpinModal");
    if (modal) modal.style.display = "none";
    spinIsActive = false;
    if (typeof onSpinFinishCallback === "function") {
      const cb = onSpinFinishCallback;
      onSpinFinishCallback = null;
      cb();
    }
  }

  // 🌐 អនុគមន៍សកលសម្រាប់ហៅបើកកងសំណាងពីទំព័រណាក៏បាន
  window.openLuckySpinModal = function ({
    user,
    authHeaders,
    slipData,
    onFinish,
  }) {
    ensureSpinModalDOM();
    currentSpinPayload = { user, authHeaders, slipData };
    onSpinFinishCallback = onFinish;
    spinIsActive = false;

    const canvas = document.getElementById("upayWheelCanvas");
    if (canvas) {
      canvas.style.transition = "none";
      canvas.style.transform = "rotate(0deg)";
    }

    document.getElementById("upayGlobalSpinModal").style.display = "flex";
  };
})();
