const getFormattedDate = () => {
  return new Date().toLocaleString("en-US", {
    timeZone: "Asia/Phnom_Penh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
};

const getDevice = (ua) => {
  if (!ua) return "Unknown";
  if (ua.includes("iPhone")) return "iPhone";
  if (ua.includes("Android")) return "Android";
  if (ua.includes("Windows")) return "PC (Windows)";
  if (ua.includes("Mac")) return "Mac";
  return "Web Browser";
};

const generateRefId = () =>
  Math.floor(1000000000 + Math.random() * 9000000000).toString();

const generateHash = () => {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 8; i++)
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
};

const generateCompactHash = () =>
  Math.random().toString(36).substring(2, 10).toUpperCase();

// Export មុខងារទាំងអស់នេះដើម្បីឱ្យ File ផ្សេងៗអាចទាញយកទៅប្រើបាន
module.exports = {
  getFormattedDate,
  getDevice,
  generateRefId,
  generateHash,
  generateCompactHash,
};
