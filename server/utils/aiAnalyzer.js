/**
 * server/utils/aiAnalyzer.js
 * AI-powered meal analyzer and Chatbot using Google Gemini API.
 * Dual Mode: Detects if the user is asking a general question or logging a meal.
 * Uses Edamam API for exact calorie matching.
 */

const { searchFood } = require("./nutritionApi");
const fetch = require("node-fetch");

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

const UNIT_TO_GRAMS = { g: 1, kg: 1000, piece: 40, bowl: 200, cup: 240, serving: 100, roti: 40, chapati: 40, plate: 400 };

const parseFoodString = (input) => {
  const match = input.toLowerCase().match(/^([\d.]+)\s*(g|kg|piece|pieces|bowl|bowls|cup|cups|serving|servings|roti|rotis|chapati|chapatis|plate|plates)?\s+(.+)$/i);
  if (match) {
    let unit = match[2] ? match[2].replace(/s$/, '') : 'serving';
    return {
      qty: parseFloat(match[1]) || 1,
      unit: unit,
      food: match[3].trim()
    };
  }
  return { qty: 1, unit: 'serving', food: input.toLowerCase().trim() };
};

/**
 * Main Chatbot function. Analyzes intent and acts accordingly.
 * @param {string} message - User message
 * @param {Object} userContext - Context (BMI, Goal, etc.)
 * @returns {Object} { type: "chat"|"meal", message: string, data?: Object }
 */
const processChatInput = async (message, userContext = {}) => {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === "your_gemini_api_key_here") {
    // --- Multi-food fallback (no Gemini key) ---
    // Detect if the message looks like a meal description
    const isMealMessage =
      /\b(ate|had|eaten|consumed|eating|having|eat)\b/i.test(message) ||
      /\d+\s*(g|kg|bowl|cup|piece|roti|chapati|plate)/i.test(message) ||
      message.includes(",");

    if (isMealMessage) {
      // Step 3: Split message into individual food segments
      const rawSegments = message.split(/,|\band\b|\bwith\b|\bplus\b/i);

      const foodSegments = rawSegments
        .map((s) =>
          s
            .replace(/^(i\s+)?(ate|had|eaten|consumed|eating|having|eat)\s+/i, "")
            .trim()
        )
        .filter((s) => s.length > 1);

      // Step 3–4: Call searchFood for EACH item separately, aggregate all
      const analyzedFoods = [];
      for (const segment of foodSegments) {
        const { qty, unit, food } = parseFoodString(segment);
        const results = await searchFood(food);
        if (results && results.length > 0) {
          const bestResult = results[0];
          const grams = qty * (UNIT_TO_GRAMS[unit] || 100);
          
          analyzedFoods.push({
            ...bestResult,
            rawInput: segment,
            calories: Math.round((bestResult.calories / 100) * grams),
            protein: Math.round((bestResult.protein / 100) * grams * 10) / 10,
            carbs: Math.round((bestResult.carbs / 100) * grams * 10) / 10,
            fat: Math.round((bestResult.fat / 100) * grams * 10) / 10,
          });
        }
      }

      if (analyzedFoods.length > 0) {
        // Step 4: Sum ALL items — never use only results[0]
        const totalCalories = analyzedFoods.reduce((s, f) => s + (f.calories || 0), 0);
        const totalProtein = Math.round(analyzedFoods.reduce((s, f) => s + (f.protein || 0), 0) * 10) / 10;
        const totalCarbs = Math.round(analyzedFoods.reduce((s, f) => s + (f.carbs || 0), 0) * 10) / 10;
        const totalFat = Math.round(analyzedFoods.reduce((s, f) => s + (f.fat || 0), 0) * 10) / 10;

        const suggestions = [];
        if (totalProtein < 10) suggestions.push("Consider adding a protein source like paneer, dal, or eggs.");
        if (totalCalories > 800) suggestions.push("This is a fairly high-calorie meal — consider a lighter option next time.");

        return {
          type: "meal",
          message: `Found ${analyzedFoods.length} food item${analyzedFoods.length > 1 ? "s" : ""}! Total: ${totalCalories} kcal.`,
          data: {
            foods: analyzedFoods,
            totalCalories,
            totalProtein,
            totalCarbs,
            totalFat,
            suggestions,
          },
        };
      }
    }

    // Step 5: Generic chat fallback — no fake AI, just honest guidance
    return {
      type: "chat",
      message:
        'I can help you track meals! Try describing what you ate, e.g.: "3 chapatis, 1 bowl dal, 100g curd".\n\nFor full AI-powered health chat, add your Gemini API key to the server .env file.',
    };
  }

  const contextStr = userContext.bmi
    ? `User Context: BMI ${userContext.bmi}, Goal: ${userContext.goal || "maintain weight"}`
    : "";

  const prompt = `You are a helpful, intelligent, and highly conversational AI assistant for a Health & Fitness app.
${contextStr}

Analyze the user's message and determine the intent.
1. If the user is describing a meal they ate, or asking to track food, extract the food items and their exact quantities (e.g., "1 bowl dal", "100g chicken", "3 roti"). Return intent as "meal".
2. If the user is asking ANY general question (fitness, programming, general knowledge, jokes, greetings, etc.), answer it naturally and conversationally. Do NOT force the answer into calories. Return intent as "chat".

Return ONLY a valid JSON object in this exact format (no markdown fences, no extra text):
For meal:
{
  "intent": "meal",
  "foods": ["quantity food_name", "quantity food_name"],
  "response": "Sure, I can track that meal for you!"
}
For general chat:
{
  "intent": "chat",
  "response": "Your natural, conversational answer here."
}

User Message: "${message}"`;

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
      }),
      timeout: 15000,
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      throw new Error(`Gemini API error: ${response.status} ${errBody.slice(0, 200)}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Empty Gemini response");

    // Strip markdown fences and extract the first JSON object
    let jsonStr = text.replace(/```json\n?|\n?```/g, "").trim();
    const jsonStart = jsonStr.indexOf('{');
    const jsonEnd   = jsonStr.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) throw new Error("No JSON found in Gemini response");
    jsonStr = jsonStr.slice(jsonStart, jsonEnd + 1);
    const parsed = JSON.parse(jsonStr);

    if (parsed.intent === "meal" && parsed.foods && parsed.foods.length > 0) {
      // It's a meal! Let's fetch exact calories via Spoonacular
      const analyzedFoods = [];
      for (const foodStr of parsed.foods) {
        const { qty, unit, food } = parseFoodString(foodStr);
        const results = await searchFood(food);
        if (results && results.length > 0) {
          const bestResult = results[0];
          const grams = qty * (UNIT_TO_GRAMS[unit] || 100);

          analyzedFoods.push({
            ...bestResult,
            rawInput: foodStr,
            calories: Math.round((bestResult.calories / 100) * grams),
            protein: Math.round((bestResult.protein / 100) * grams * 10) / 10,
            carbs: Math.round((bestResult.carbs / 100) * grams * 10) / 10,
            fat: Math.round((bestResult.fat / 100) * grams * 10) / 10,
          });
        }
      }

      if (analyzedFoods.length === 0) {
        return {
          type: "chat",
          message: "I couldn't find nutritional information for those foods. Please try being more specific with quantities.",
        };
      }

      const totalCalories = analyzedFoods.reduce((s, f) => s + f.calories, 0);
      const totalProtein = Math.round(analyzedFoods.reduce((s, f) => s + f.protein, 0) * 10) / 10;
      const totalCarbs = Math.round(analyzedFoods.reduce((s, f) => s + f.carbs, 0) * 10) / 10;
      const totalFat = Math.round(analyzedFoods.reduce((s, f) => s + f.fat, 0) * 10) / 10;

      const suggestions = [];
      if (totalProtein < 10) suggestions.push("Consider adding a protein source like paneer, dal, or eggs to this meal.");
      if (totalCalories > 800) suggestions.push("This is a fairly high-calorie meal.");

      return {
        type: "meal",
        message: parsed.response || `I found your foods! Total: ${totalCalories} kcal.`,
        data: {
          foods: analyzedFoods,
          totalCalories,
          totalProtein,
          totalCarbs,
          totalFat,
          suggestions
        }
      };
    }

    // Default to general chat
    return {
      type: "chat",
      message: parsed.response || "I'm here to help with your health and fitness goals!",
    };

  } catch (error) {
    console.error("Gemini AI failed:", error.message);
    return {
      type: "chat",
      message: "Sorry, I am having trouble connecting to my AI brain right now.",
    };
  }
};

/**
 * Legacy wrapper for analyzeMeal to avoid breaking changes if used elsewhere.
 */
const analyzeMeal = async (mealText) => {
  const result = await processChatInput(mealText);
  if (result.type === "meal") {
    return {
      foods: result.data.foods,
      totalCalories: result.data.totalCalories,
      totalProtein: result.data.totalProtein,
      totalCarbs: result.data.totalCarbs,
      totalFat: result.data.totalFat,
      suggestions: result.data.suggestions,
      analyzedBy: "gemini_edamam"
    };
  }
  return null;
};

/**
 * Legacy wrapper for health questions.
 */
const answerHealthQuestion = async (question, userContext) => {
  const result = await processChatInput(question, userContext);
  return { answer: result.message, source: "gemini_ai" };
};

module.exports = { analyzeMeal, answerHealthQuestion, processChatInput };
