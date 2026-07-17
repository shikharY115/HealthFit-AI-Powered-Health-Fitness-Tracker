const express = require("express");
const router = express.Router();
const { calculateBMI, getBMIHistory, deleteBMIRecord } = require("../controllers/bmiController");
const { protect } = require("../middleware/auth");

router.use(protect); // All BMI routes are protected

router.post("/calculate", calculateBMI);
router.get("/history", getBMIHistory);
router.delete("/:id", deleteBMIRecord);

module.exports = router;
