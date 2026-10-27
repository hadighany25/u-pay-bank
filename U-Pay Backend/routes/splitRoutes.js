// ============================================================================
// ឯកសារ: routes/splitRoutes.js
// អត្ថន័យ: API Routes សម្រាប់ភ្ជាប់ទៅកាន់ splitController.js (100% Pure _id)
// ============================================================================
const express = require("express");
const router = express.Router();
const splitController = require("../controllers/splitController");

// ១. បង្កើតវិក្កយបត្ររួមគ្នាថ្មី
router.post("/create", splitController.createSplitBill);

// ២. ទាញយកបញ្ជីវិក្កយបត្រទាំងអស់របស់ខ្ញុំ (ទាំងខ្ញុំជាម្ចាស់ និងគេអញ្ជើញខ្ញុំ)
router.get("/my-bills", splitController.getMySplitBills);

// ៣. ទាញយកព័ត៌មានលម្អិតនៃវិក្កយបត្រ ១ តាមរយៈ billId
router.get("/detail/:billId", splitController.getSplitBillDetail);

// ៤. ទូទាត់ប្រាក់ចំណែកវិក្កយបត្រផ្ទាល់នៅក្នុង split.html
router.post("/pay", splitController.paySplitBillShare);

// ៥. ម្ចាស់វិក្កយបត្រចុចបញ្ជាក់ថាសមាជិកបានបង់ប្រាក់សុទ្ធរួច
router.post("/mark-paid", splitController.markSlotAsPaid);

// ៦. បន្ថែមមិត្តភក្តិថ្មីចូលក្នុងវិក្កយបត្រដែលមានស្រាប់
router.post("/add-member", splitController.addMemberToSplitBill);

// ៧. គោះតឿនសមាជិកដែលមិនទាន់បង់ប្រាក់
router.post("/remind", splitController.remindSplitMember);

// ៨. លុបវិក្កយបត្រចោល
router.delete("/:billId", splitController.deleteSplitBill);

module.exports = router;
