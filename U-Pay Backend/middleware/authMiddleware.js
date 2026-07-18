const jwt = require("jsonwebtoken");
const { readSystemStatus } = require("../services/systemService");
require("dotenv").config();

// ១. ឆ្មាំយាមទ្វារទូទៅ (ផ្ទៀងផ្ទាត់ Token ធម្មតា)
const verifyAdmin = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "គ្មានសិទ្ធិអនុញ្ញាតទេ! (No Token Provided)",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (err) {
    return res
      .status(401)
      .json({ success: false, message: "Token ផុតកំណត់ ឬមិនត្រឹមត្រូវ!" });
  }
};

// ២. ឆ្មាំយាមទ្វារបែងចែកសិទ្ធិ (RBAC) - សម្រាប់ Admin Dashboard
const checkRole = (allowedRoles) => {
  return (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res
        .status(401)
        .json({ success: false, message: "គ្មានសិទ្ធិអនុញ្ញាតទេ! (No Token)" });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      if (!allowedRoles.includes(decoded.role)) {
        return res.status(403).json({
          success: false,
          message:
            "គណនីរបស់អ្នកគ្មានសិទ្ធិ (Permission) ក្នុងការប្រើប្រាស់មុខងារនេះទេ!",
        });
      }

      req.admin = decoded;
      next();
    } catch (err) {
      return res
        .status(401)
        .json({ success: false, message: "Token ផុតកំណត់ ឬមិនត្រឹមត្រូវ!" });
    }
  };
};

// ៣. របាំងការពារ System Freeze (Kill Switch) - សម្រាប់អតិថិជន
const enforceSystemActive = (req, res, next) => {
  const sysStatus = readSystemStatus();

  if (sysStatus.isSystemFrozen) {
    return res.status(403).json({
      success: false,
      message:
        "ប្រព័ន្ធកំពុងផ្អាកដំណើរការបណ្តោះអាសន្ន! សូមរង់ចាំបន្តិច... (System Under Maintenance) 🛑",
    });
  }

  next();
};

// 🔥 ឆ្មាំយាមទ្វារសម្រាប់ User ធម្មតា
const verifyUser = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res
      .status(401)
      .json({ success: false, message: "សូម Login ចូលគណនីរបស់អ្នកជាមុនសិន!" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // ផ្ទុកទិន្នន័យអតិថិជន (id, username, role)
    next(); // អនុញ្ញាតអោយឆ្លងកាត់
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: "វគ្គ (Session) របស់អ្នកផុតកំណត់ហើយ សូម Login ម្តងទៀត!",
    });
  }
};

// យកវាមក Export រួមគ្នាខាងក្រោមគេបង្អស់
module.exports = { verifyAdmin, checkRole, enforceSystemActive, verifyUser };
