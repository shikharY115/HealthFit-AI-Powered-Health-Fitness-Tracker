/**
 * server/controllers/aiController.js
 * AI meal analysis and health Q&A chat interface.
 * Integrates Gemini AI with Edamam nutrition data, auto-adds meals to tracker.
 */

const MealEntry = require("../models/MealEntry");
const ChatRecord = require("../models/ChatRecord");
const { analyzeMeal, processChatInput } = require("../utils/aiAnalyzer");
const User = require("../models/User");
const BMIRecord = require("../models/BMIRecord");

const todayStr = () => new Date().toISOString().split("T")[0];

// @desc    Analyze meal from natural language text and optionally save it
// @route   POST /api/ai/analyze-meal
// @access  Private
exports.analyzeMeal = async (req, res) => {
  const { mealText, mealType, autoSave, date } = req.body;

  if (!mealText || mealText.trim().length < 3) {
    return res.status(400).json({
      success: false,
      message: "Please describe your meal (e.g., 'I ate 3 chapatis, 1 bowl dal, 100g curd')",
    });
  }

  // Analyze the meal using legacy wrapper which uses new dual mode internally
  const analysis = await analyzeMeal(mealText.trim());
  if (!analysis) {
     return res.status(500).json({ success: false, message: "Failed to analyze meal."});
  }

  let savedMeal = null;

  // Auto-save to calorie tracker if requested
  if (autoSave && analysis.foods && analysis.foods.length > 0) {
    const foods = analysis.foods.map((f) => ({
      name: f.name,
      quantity: f.quantity || "1 serving",
      calories: f.calories || 0,
      protein: f.protein || 0,
      carbs: f.carbs || 0,
      fat: f.fat || 0,
      fiber: f.fiber || 0,
      sugar: f.sugar || 0,
      sodium: f.sodium || 0,
      fdcId: f.fdcId || null,
      source: f.source || "ai_estimated",
    }));

    savedMeal = await MealEntry.create({
      user: req.user._id,
      date: date || todayStr(),
      mealType: mealType || "lunch",
      mealName: `AI Analyzed: ${mealText.substring(0, 40)}${mealText.length > 40 ? "..." : ""}`,
      foods,
      aiNote: `Analyzed by: ${analysis.analyzedBy}`,
      aiSuggestions: analysis.suggestions || [],
    });
  }

  res.json({
    success: true,
    data: {
      originalText: mealText,
      analysis,
      savedMeal: savedMeal ? { id: savedMeal._id, ...savedMeal.toObject() } : null,
      message: autoSave
        ? `✅ Meal analyzed and added to your tracker! Total: ${analysis.totalCalories} kcal`
        : `✅ Meal analyzed! Total: ${analysis.totalCalories} kcal`,
    },
  });
};

// @desc    Health Q&A Chat (Dual Mode)
// @route   POST /api/ai/chat
// @access  Private
exports.chat = async (req, res) => {
  const { message } = req.body;

  if (!message || message.trim().length < 2) {
    return res.status(400).json({ success: false, message: "Please enter a message" });
  }

  // Save User Message
  await ChatRecord.create({
    user: req.user._id,
    message: message.trim(),
    sender: "user",
    type: "chat"
  });

  // Build user context for personalized responses
  const user = await User.findById(req.user._id);
  const latestBMI = await BMIRecord.findOne({ user: req.user._id }).sort({ createdAt: -1 });

  const userContext = {
    name: user?.name,
    bmi: latestBMI?.bmi,
    category: latestBMI?.category,
    goal: user?.goal,
    age: user?.age,
    gender: user?.gender,
  };

  const result = await processChatInput(message.trim(), userContext);

  // Save AI Response
  const aiRecord = await ChatRecord.create({
    user: req.user._id,
    message: result.message,
    sender: "ai",
    type: result.type,
    data: result.data || null
  });

  res.json({
    success: true,
    data: aiRecord
  });
};

// @desc    Get Chat History
// @route   GET /api/ai/history
// @access  Private
exports.getChatHistory = async (req, res) => {
  const history = await ChatRecord.find({ user: req.user._id }).sort({ createdAt: 1 });
  res.json({
    success: true,
    data: history
  });
};

// @desc    Get AI status (which AI provider is active)
// @route   GET /api/ai/status
// @access  Private
exports.getAIStatus = (req, res) => {
  const hasGemini = !!(
    process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "your_gemini_api_key_here"
  );
  const hasEdamam = !!(process.env.EDAMAM_APP_ID && process.env.EDAMAM_APP_ID !== "your_app_id");

  res.json({
    success: true,
    data: {
      aiProvider: hasGemini ? "Google Gemini 1.5 Flash" : "Fallback AI",
      nutritionProvider: hasEdamam ? "Edamam Nutrition API" : "Mock Data",
      aiPowered: hasGemini,
      capabilities: {
        mealAnalysis: true,
        calorieEstimation: true,
        healthChat: true,
        aiPowered: hasGemini,
        realNutritionData: hasEdamam,
      },
    },
  });
};
