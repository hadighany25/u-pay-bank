// ============================================================================
// ឯកសារ: middleware/authMiddleware.js
// អត្ថន័យ: ឆ្មាំយាមទ្វារ (Middlewares) សម្រាប់ការផ្ទៀងផ្ទាត់សិទ្ធិអំណាច និងសុវត្ថិភាពប្រព័ន្ធ
// ============================================================================

// ==========================================
// 📦 ផ្នែកទី ១៖ ទាញយក Modules
// ==========================================
const jwt = require("jsonwebtoken");
const { readSystemStatus } = require("../services/systemService");
require("dotenv").config();

// ==========================================
// 🛡️ ផ្នែកទី ២៖ ឆ្មាំយាមទ្វារសម្រាប់អ្នកគ្រប់គ្រង (Admin Middlewares)
// ==========================================

/**
 * 📌 ១. ឆ្មាំយាមទ្វារទូទៅ (Admin Token Verification)
 * ត្រួតពិនិត្យថាពិតជាមាន Token របស់ Admin ត្រឹមត្រូវឬអត់ មុនអនុញ្ញាតឱ្យចូលប្រើ API
 */
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
    req.admin = decoded; // ផ្ទុកទិន្នន័យ Admin ទៅក្នុង Request
    next(); // អនុញ្ញាតឱ្យឆ្លងកាត់
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: "Token ផុតកំណត់ ឬមិនត្រឹមត្រូវ!",
    });
  }
};

/**
 * 📌 ២. ឆ្មាំយាមទ្វារបែងចែកសិទ្ធិ (Role-Based Access Control - RBAC)
 * ពិនិត្យថាតើ Admin ម្នាក់នោះមានតួនាទី (Role) អនុញ្ញាតឱ្យប្រើប្រាស់មុខងារនេះដែរឬទេ
 */
const checkRole = (allowedRoles) => {
  return (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "គ្មានសិទ្ធិអនុញ្ញាតទេ! (No Token)",
      });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // ឆែកមើលថាតើតួនាទីរបស់គាត់ មានក្នុងបញ្ជីដែលអនុញ្ញាតឬអត់
      if (!allowedRoles.includes(decoded.role)) {
        return res.status(403).json({
          success: false,
          message:
            "គណនីរបស់អ្នកគ្មានសិទ្ធិ (Permission) ក្នុងការប្រើប្រាស់មុខងារនេះទេ!",
        });
      }

      req.admin = decoded;
      next(); // អនុញ្ញាតឱ្យឆ្លងកាត់
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: "Token ផុតកំណត់ ឬមិនត្រឹមត្រូវ!",
      });
    }
  };
};

// ==========================================
// 👤 ផ្នែកទី ៣៖ ឆ្មាំយាមទ្វារសម្រាប់អតិថិជន (User Middlewares)
// ==========================================

/**
 * 📌 ៣. ឆ្មាំយាមទ្វារសម្រាប់ User ធម្មតា (User Token Verification)
 * ត្រួតពិនិត្យថាអតិថិជនពិតជាបាន Login និងមាន Token ត្រឹមត្រូវ
 */
const verifyUser = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "សូម Login ចូលគណនីរបស់អ្នកជាមុនសិន!",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // ផ្ទុកទិន្នន័យអតិថិជន (id, username, role)
    next(); // អនុញ្ញាតឱ្យឆ្លងកាត់
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: "វគ្គ (Session) របស់អ្នកផុតកំណត់ហើយ សូម Login ម្តងទៀត!",
    });
  }
};

// ==========================================
// 🛑 ផ្នែកទី ៤៖ របាំងការពារប្រព័ន្ធ (System Middlewares)
// ==========================================

/**
 * 📌 ៤. របាំងការពារ System Freeze (Kill Switch)
 * ទប់ស្កាត់រាល់ប្រតិបត្តិការទាំងអស់ ប្រសិនបើ Super Admin បានចុចបិទប្រព័ន្ធ (Maintenance Mode)
 */
const enforceSystemActive = (req, res, next) => {
  const sysStatus = readSystemStatus();

  if (sysStatus.isSystemFrozen) {
    return res.status(403).json({
      success: false,
      message:
        "ប្រព័ន្ធកំពុងផ្អាកដំណើរការបណ្តោះអាសន្ន! សូមរង់ចាំបន្តិច... (System Under Maintenance) 🛑",
    });
  }

  next(); // អនុញ្ញាតឱ្យឆ្លងកាត់បើប្រព័ន្ធដើរធម្មតា
};

// ==========================================
// 📤 ផ្នែកទី ៥៖ បញ្ចេញមុខងារ (Exports)
// ==========================================

module.exports = {
  verifyAdmin,
  checkRole,
  enforceSystemActive,
  verifyUser,
};
