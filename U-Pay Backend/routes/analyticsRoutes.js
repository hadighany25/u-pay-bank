// ============================================================================
// ឯកសារ: routes/analyticsRoutes.js
// ============================================================================
const express = require("express");
const router = express.Router();
const analyticsController = require("../controllers/analyticsController");
const { verifyUser } = require("../middleware/authMiddleware");

router.get("/summary", verifyUser, analyticsController.getUserAnalyticsSummary);
router.post("/budget", verifyUser, analyticsController.saveUserBudgetSettings);

module.exports = router;
