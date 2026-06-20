require("dotenv").config();
const PAYHUB_URL = process.env.PAYHUB_URL || "https://payhub-kh.onrender.com";

// សេវាកម្ម Scan វិក្កយបត្រ
const checkBillFromPayHub = async (bill_id) => {
  try {
    const response = await fetch(
      `${PAYHUB_URL}/api/gateway/check-bill?query=${encodeURIComponent(bill_id)}`,
    );
    return await response.json();
  } catch (err) {
    throw new Error("មិនអាចភ្ជាប់ទៅប្រព័ន្ធ PayHub បានទេ");
  }
};

// សេវាកម្មកាត់លុយវិក្កយបត្រ
const payBillToPayHub = async (bill_id) => {
  try {
    const response = await fetch(`${PAYHUB_URL}/api/gateway/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bill_id }),
    });
    return await response.json();
  } catch (err) {
    throw new Error("ការទូទាត់បរាជ័យ (Server Error)");
  }
};

// សេវាកម្មទាញយកព័ត៌មានក្រុមហ៊ុនពី PayHub
const getCompanyDetails = async (companyName) => {
  try {
    const response = await fetch(`${PAYHUB_URL}/api/admin/users`);
    const users = await response.json();
    return users.find((u) => u.name === companyName && u.role === "company");
  } catch (err) {
    return null;
  }
};

module.exports = { checkBillFromPayHub, payBillToPayHub, getCompanyDetails };
