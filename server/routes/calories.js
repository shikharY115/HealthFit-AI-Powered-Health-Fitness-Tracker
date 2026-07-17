const express = require("express");
const router = express.Router();
const {
  searchFood, addMeal, getMeals, updateMeal, deleteMeal, getStats, getMacros
} = require("../controllers/calorieController");
const { protect } = require("../middleware/auth");

router.use(protect);

router.get("/search-food", searchFood);
router.post("/meal", addMeal);
router.get("/meals", getMeals);
router.put("/meal/:id", updateMeal);
router.delete("/meal/:id", deleteMeal);
router.get("/stats", getStats);
router.get("/macros", getMacros);

module.exports = router;
