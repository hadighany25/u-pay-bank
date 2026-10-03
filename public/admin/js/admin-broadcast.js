// ========================================================================
// ឯកសារ: admin-broadcast.js
// អត្ថន័យ: ផ្ញើសារជូនដំណឹងជាប្រព័ន្ធ (Broadcast Messages) និងប្រវត្តិសាស្ត្រ
// ========================================================================

async function sendBroadcast() {
  const { value: formValues } = await Swal.fire({
    title:
      '<i class="fa-solid fa-bullhorn" style="color:var(--secondary); font-size: 2.5rem; margin-bottom: 10px;"></i><br>Send Broadcast',
    html: '<div style="text-align: left; margin-bottom: 8px; font-size: 0.9rem; font-weight: 600; color: var(--text-main);">Notification Title</div><input id="swal-title" class="swal2-input" placeholder="e.g., System Maintenance" style="width: 100%; box-sizing: border-box; margin: 0 0 20px 0; border-radius: 10px;"><div style="text-align: left; margin-bottom: 8px; font-size: 0.9rem; font-weight: 600; color: var(--text-main);">Message Content</div><textarea id="swal-msg" class="swal2-textarea" placeholder="Type your message here..." style="width: 100%; box-sizing: border-box; margin: 0; border-radius: 10px;"></textarea>',
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: "Blast to All Users",
    confirmButtonColor: "#10b981",
    preConfirm: () => {
      const title = document.getElementById("swal-title").value;
      const msg = document.getElementById("swal-msg").value;
      if (!title || !msg) {
        Swal.showValidationMessage("Title and Message are required!");
        return false;
      }
      return { title: title, message: msg };
    },
  });
  if (formValues && formValues.title && formValues.message) {
    try {
      const res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ ...formValues, sender: "admin" }),
      });
      const data = await res.json();
      if (data.success) {
        Swal.fire(
          "Sent!",
          `Broadcast delivered to ${data.count} accounts.`,
          "success",
        );
        loadData();
      } else Swal.fire("Error!", "Failed to send broadcast.", "error");
    } catch (error) {
      Swal.fire("Error!", "Connection issue.", "error");
    }
  }
}

async function loadBroadcastHistory() {
  try {
    const list = document.getElementById("broadcastList");
    list.innerHTML =
      '<tr><td colspan="4" style="text-align: center; padding: 40px; color: var(--text-muted);">កំពុងទាញយកទិន្នន័យ...</td></tr>';

    // ហៅ API ថ្មីដែលទាញយកពី Notification Collection ផ្ទាល់
    const res = await fetch("/api/admin/broadcast-history", {
      headers: getAuthHeaders(),
    });
    const data = await res.json();

    list.innerHTML = "";

    if (!data.success || !data.broadcasts || data.broadcasts.length === 0) {
      list.innerHTML =
        '<tr><td colspan="4" style="text-align: center; padding: 40px; color: var(--text-muted);">គ្មានប្រវត្តិផ្ញើសារ Broadcast ទេ</td></tr>';
      return;
    }

    data.broadcasts.forEach((n) => {
      const safeId = n.id || n._id;
      list.innerHTML += `<tr style="border-bottom: 1px solid var(--border);">
        <td style="color:var(--text-muted); font-size: 0.85rem;"><i class="fa-regular fa-clock" style="margin-right: 5px;"></i> ${n.date || "N/A"}</td>
        <td style="font-weight:600; color:var(--text-main);">${n.title || ""}</td>
        <td style="color:var(--text-muted); font-size: 0.9rem;">${n.message || ""}</td>
        <td style="text-align: right;">
          <button onclick="deleteBroadcast('${safeId}')" class="btn-action btn-delete" style="width: auto; padding: 0 15px; background: #fee2e2; color: #ef4444;">
            <i class="fa-solid fa-trash-can" style="margin-right: 5px;"></i> Recall
          </button>
        </td>
      </tr>`;
    });
  } catch (error) {
    console.error("Error loading broadcast history:", error);
    document.getElementById("broadcastList").innerHTML =
      '<tr><td colspan="4" style="text-align: center; padding: 40px; color: #ef4444;">មានបញ្ហាក្នុងការទាញយកទិន្នន័យពី Server</td></tr>';
  }
}

async function deleteBroadcast(notifId) {
  const result = await Swal.fire({
    title: "Recall Broadcast?",
    text: "This will delete the message from all users' inboxes.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#ef4444",
    confirmButtonText: "Recall",
  });
  if (result.isConfirmed) {
    const res = await fetch("/api/admin/delete-broadcast", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ notifId }),
    });
    const data = await res.json();
    if (data.success) {
      Swal.fire("Recalled", "Message removed.", "success");
      loadBroadcastHistory();
    }
  }
}
