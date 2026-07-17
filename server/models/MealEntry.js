/**
 * server/models/MealEntry.js
 * Stores daily meal entries with full nutrition breakdown.
 * Each entry represents one meal (breakfast, lunch, dinner, snack).
 */

const mongoose = require("mongoose");

// Sub-schema for individual food items within a meal
const FoodItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  quantity: { type: String, default: "1 serving" }, // e.g., "100g", "1 cup"
  // Nutrition data fetched from USDA API
  calories: { type: Number, required: true, min: 0 },
  protein: { type: Number, default: 0 }, // grams
  carbs: { type: Number, default: 0 },   // grams
  fat: { type: Number, default: 0 },     // grams
  fiber: { type: Number, default: 0 },   // grams
  sugar: { type: Number, default: 0 },   // grams
  sodium: { type: Number, default: 0 },  // mg
  // USDA FDC ID for reference (null if manually entered)
  fdcId: { type: String, default: null },
  // Source: 'usda_api', 'ai_estimated', 'manual'
  source: { type: String, default: "manual" },
});

const MealEntrySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // Date of the meal (YYYY-MM-DD for easy day-level grouping)
    date: {
      type: String, // stored as "2024-01-15"
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    mealType: {
      type: String,
      enum: ["breakfast", "lunch", "dinner", "snack", "pre_workout", "post_workout"],
      required: true,
    },
    mealName: { type: String, required: true }, // e.g. "Lunch - Dal Chawal"
    foods: [FoodItemSchema],
    // Aggregated totals (pre-calculated for performance)
    totalCalories: { type: Number, default: 0 },
    totalProtein: { type: Number, default: 0 },
    totalCarbs: { type: Number, default: 0 },
    totalFat: { type: Number, default: 0 },
    totalFiber: { type: Number, default: 0 },
    // AI analysis note (if meal was analyzed by AI)
    aiNote: { type: String, default: null },
    // Suggestions from AI
    aiSuggestions: [{ type: String }],
    notes: { type: String, maxlength: 500 },
  },
  {
    timestamps: true,
  }
);

// Pre-save hook: auto-calculate totals from food items
MealEntrySchema.pre("save", function (next) {
  if (this.foods && this.foods.length > 0) {
    this.totalCalories = Math.round(this.foods.reduce((sum, f) => sum + (f.calories || 0), 0));
    this.totalProtein = Math.round(this.foods.reduce((sum, f) => sum + (f.protein || 0), 0) * 10) / 10;
    this.totalCarbs = Math.round(this.foods.reduce((sum, f) => sum + (f.carbs || 0), 0) * 10) / 10;
    this.totalFat = Math.round(this.foods.reduce((sum, f) => sum + (f.fat || 0), 0) * 10) / 10;
    this.totalFiber = Math.round(this.foods.reduce((sum, f) => sum + (f.fiber || 0), 0) * 10) / 10;
  }
  next();
});

// Compound index for efficient daily queries
MealEntrySchema.index({ user: 1, date: -1 });

module.exports = mongoose.model("MealEntry", MealEntrySchema);
