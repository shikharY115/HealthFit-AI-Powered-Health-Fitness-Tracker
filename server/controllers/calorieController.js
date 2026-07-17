/**
 * server/controllers/calorieController.js
 * Manages meal entries, nutrition data via Edamam Food Database API, and calorie stats.
 */

const MealEntry = require("../models/MealEntry");
const { searchFood } = require("../utils/nutritionApi");
const User = require("../models/User");

// Helper: get today's date string
const todayStr = () => new Date().toISOString().split("T")[0];

// @desc    Search food items via USDA API
// @route   GET /api/calories/search-food?q=chicken
// @access  Private
exports.searchFood = async (req, res) => {
  const { q, pageSize = 8 } = req.query;
  if (!q) return res.status(400).json({ success: false, message: "Search query is required" });

  try {
    const results = await searchFood(q, parseInt(pageSize));
    if (results.length === 0) {
      console.log(`[calorieController] No results for: "${q}"`);
    }
    res.json({ success: true, data: results, count: results.length });
  } catch (err) {
    console.error('[calorieController] searchFood error:', err.message);
    res.status(500).json({ success: false, message: 'Food search failed', error: err.message });
  }
};

// @desc    Add a meal entry
// @route   POST /api/calories/meal
// @access  Private
exports.addMeal = async (req, res) => {
  const { date, mealType, mealName, foods, notes } = req.body;

  if (!mealType || !mealName || !foods || foods.length === 0) {
    return res.status(400).json({
      success: false,
      message: "mealType, mealName, and at least one food item are required",
    });
  }

  const entry = await MealEntry.create({
    user: req.user._id,
    date: date || todayStr(),
    mealType,
    mealName,
    foods,
    notes,
  });

  res.status(201).json({ success: true, data: entry, message: "Meal logged successfully!" });
};

// @desc    Get meals for a specific date (default: today)
// @route   GET /api/calories/meals?date=2024-01-15
// @access  Private
exports.getMeals = async (req, res) => {
  const date = req.query.date || todayStr();
  const user = await User.findById(req.user._id);

  const meals = await MealEntry.find({ user: req.user._id, date }).sort({ createdAt: 1 });

  // Calculate daily totals
  const totals = meals.reduce(
    (acc, meal) => {
      acc.calories += meal.totalCalories || 0;
      acc.protein += meal.totalProtein || 0;
      acc.carbs += meal.totalCarbs || 0;
      acc.fat += meal.totalFat || 0;
      acc.fiber += meal.totalFiber || 0;
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
  );

  totals.calories = Math.round(totals.calories);
  totals.protein = Math.round(totals.protein * 10) / 10;
  totals.carbs = Math.round(totals.carbs * 10) / 10;
  totals.fat = Math.round(totals.fat * 10) / 10;
  totals.fiber = Math.round(totals.fiber * 10) / 10;

  res.json({
    success: true,
    date,
    count: meals.length,
    data: meals,
    totals,
    dailyGoal: user?.dailyCalorieGoal || 2000,
    remaining: Math.max(0, (user?.dailyCalorieGoal || 2000) - totals.calories),
  });
};

// @desc    Get weekly calorie stats (last 7 days)
// @route   GET /api/calories/stats
// @access  Private
exports.getStats = async (req, res) => {
  // Build date range (last 7 days)
  const dates = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split("T")[0]);
  }

  const meals = await MealEntry.find({
    user: req.user._id,
    date: { $in: dates },
  });

  // Group by date
  const dailyStats = dates.map((date) => {
    const dayMeals = meals.filter((m) => m.date === date);
    return {
      date,
      calories: Math.round(dayMeals.reduce((s, m) => s + (m.totalCalories || 0), 0)),
      protein: Math.round(dayMeals.reduce((s, m) => s + (m.totalProtein || 0), 0) * 10) / 10,
      carbs: Math.round(dayMeals.reduce((s, m) => s + (m.totalCarbs || 0), 0) * 10) / 10,
      fat: Math.round(dayMeals.reduce((s, m) => s + (m.totalFat || 0), 0) * 10) / 10,
      mealCount: dayMeals.length,
    };
  });

  const user = await User.findById(req.user._id);
  const avgCalories = Math.round(dailyStats.reduce((s, d) => s + d.calories, 0) / 7);

  res.json({
    success: true,
    data: dailyStats,
    average: avgCalories,
    dailyGoal: user?.dailyCalorieGoal || 2000,
  });
};

// @desc    Update a meal entry
// @route   PUT /api/calories/meal/:id
// @access  Private
exports.updateMeal = async (req, res) => {
  let meal = await MealEntry.findOne({ _id: req.params.id, user: req.user._id });

  if (!meal) {
    return res.status(404).json({ success: false, message: "Meal not found" });
  }

  const { mealType, mealName, foods, notes } = req.body;
  if (mealType) meal.mealType = mealType;
  if (mealName) meal.mealName = mealName;
  if (foods) meal.foods = foods;
  if (notes !== undefined) meal.notes = notes;

  await meal.save(); // Triggers pre-save hook to recalculate totals

  res.json({ success: true, data: meal, message: "Meal updated successfully" });
};

// @desc    Delete a meal entry
// @route   DELETE /api/calories/meal/:id
// @access  Private
exports.deleteMeal = async (req, res) => {
  const meal = await MealEntry.findOne({ _id: req.params.id, user: req.user._id });

  if (!meal) {
    return res.status(404).json({ success: false, message: "Meal not found" });
  }

  await meal.deleteOne();
  res.json({ success: true, message: "Meal deleted successfully" });
};

// @desc    Get macro breakdown for a date (for doughnut chart)
// @route   GET /api/calories/macros?date=2024-01-15
// @access  Private
exports.getMacros = async (req, res) => {
  const date = req.query.date || todayStr();
  const meals = await MealEntry.find({ user: req.user._id, date });

  const macros = {
    protein: Math.round(meals.reduce((s, m) => s + (m.totalProtein || 0), 0) * 10) / 10,
    carbs: Math.round(meals.reduce((s, m) => s + (m.totalCarbs || 0), 0) * 10) / 10,
    fat: Math.round(meals.reduce((s, m) => s + (m.totalFat || 0), 0) * 10) / 10,
    fiber: Math.round(meals.reduce((s, m) => s + (m.totalFiber || 0), 0) * 10) / 10,
  };

  res.json({ success: true, date, data: macros });
};
