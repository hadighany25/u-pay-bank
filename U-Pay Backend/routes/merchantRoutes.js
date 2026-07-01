const express = require("express");

const router = express.Router();

// ១. Import Controllers

const merchantController = require("../controllers/merchantController");

// ២. Import Middleware (សាកល្បង Import ទាំង២ទម្រង់ដើម្បីការពារ Error)

let protectMiddleware;

const authMiddleware = require("../middleware/authMiddleware");

// ឆែកមើលថាវាប្រើទម្រង់មួយណាទើបត្រូវ

if (typeof authMiddleware === "function") {
  protectMiddleware = authMiddleware; // ករណី module.exports = protect;
} else if (typeof authMiddleware.protect === "function") {
  protectMiddleware = authMiddleware.protect; // ករណី module.exports = { protect };
} else {
  // បង្កើត Middleware បណ្ដោះអាសន្នបើរកមិនឃើញ ដើម្បីកុំអោយគាំង Server

  console.warn(
    "⚠️ Warning: protect middleware not found! Using dummy middleware.",
  );

  protectMiddleware = (req, res, next) => next();
}

// ៣. កំណត់ Routes (ត្រូវប្រាកដថា Functions ទាំងនេះពិតជាមានក្នុង merchantController.js)

router.post("/create", protectMiddleware, merchantController.createMerchant);

router.get(
  "/my-merchants",

  protectMiddleware,

  merchantController.getMyMerchants,
);

router.delete(
  "/:merchantId",

  protectMiddleware,

  merchantController.deleteMerchant,
);

module.exports = router;
