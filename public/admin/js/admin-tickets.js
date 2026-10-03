// ========================================================================
// ឯកសារ: admin-tickets.js
// អត្ថន័យ: គ្រប់គ្រងសំបុត្រសំណូមពរ និងការឆ្លើយតបបញ្ហាអតិថិជន (Support Tickets)
// ========================================================================

async function replyTicket(username, ticketId) {
  const { value: text } = await Swal.fire({
    title: "Reply to Ticket",
    input: "textarea",
    inputPlaceholder: "Type your reply here...",
    showCancelButton: true,
  });
  if (text) {
    const res = await fetch("/api/admin/ticket-reply", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ username, ticketId, replyMessage: text }),
    });
    const data = await res.json();
    if (data.success) {
      Swal.fire("Success", "Reply sent to user.", "success");
      loadData();
    }
  }
}

function viewUserMessage(username, ticketId) {
  const targetUser = globalUsersData.find((u) => u.username === username);
  const ticket = targetUser?.tickets?.find((t) => t.ticketId === ticketId);
  if (!ticket) return;
  Swal.fire({
    title:
      '<i class="fa-solid fa-envelope-open-text" style="color:#004d40;"></i> សារពីអតិថិជន',
    html: `<div style="text-align: left; font-family: 'Kantumruy Pro';"><div style="margin-bottom: 15px; padding: 18px; background: #f1f5f9; border-radius: 16px; border: 1px solid #e2e8f0;"><p style="margin: 0 0 8px; font-size: 0.85rem; color: #64748b; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">សេចក្តីពិពណ៌នាបញ្ហា៖</p><p style="margin: 0; font-size: 1.05rem; color: #1e293b; line-height: 1.6;">${ticket.description}</p></div><div style="font-size: 0.8rem; color: #94a3b8; padding-left: 5px;"><i class="fa-regular fa-clock"></i> បញ្ជូននៅថ្ងៃ៖ ${ticket.date}</div></div>`,
    confirmButtonText: "យល់ព្រម",
    buttonsStyling: false,
    customClass: {
      popup: "premium-swal",
      title: "premium-swal-title",
      confirmButton: "premium-btn-confirm",
    },
  });
}
