/**
 * server/utils/nutritionApi.js
 *
 * SINGLE SOURCE: Spoonacular Food Ingredients API
 * Docs: https://spoonacular.com/food-api/docs
 *
 * Flow:
 *   1. GET /food/ingredients/search  → find food ID by name
 *   2. GET /food/ingredients/{id}/information?amount=100&unit=grams → get per-100g nutrition
 *
 * All nutrients stored as per-100g values.
 * Frontend computePer100g() receives servingSize=100 and extracts them unchanged.
 * recalcNutrition() scales by (qty × gramsPerUnit) / 100.
 */

const fetch = require("node-fetch");

const BASE = "https://api.spoonacular.com";

// Simple in-memory cache keyed by lowercase trimmed query
const cache = new Map();

// ── Helper: pick the result whose name most closely matches the query ─────────
// Spoonacular /search sometimes puts "chicken fat" before "chicken breast".
// We prefer an exact or prefix match over a substring match.
const bestMatch = (results, query) => {
  const q = query.toLowerCase().trim();

  // 1. Exact name match
  const exact = results.find(r => r.name.toLowerCase() === q);
  if (exact) return exact;

  // 2. Name starts with query word
  const prefix = results.find(r => r.name.toLowerCase().startsWith(q));
  if (prefix) return prefix;

  // 3. First result (Spoonacular's default ranking)
  return results[0];
};

/**
 * Look up per-100g nutrition for a single food name via Spoonacular.
 *
 * @param {string} query  - e.g. "milk", "chicken breast", "paneer"
 * @param {number} limit  - max results to return from search (default 8)
 * @returns {Array}  Array of normalised food objects, empty if not found.
 */
const searchFood = async (query, limit = 8) => {
  const apiKey = (process.env.SPOONACULAR_API_KEY || "").trim();
  const cacheKey = query.toLowerCase().trim();

  // ── Cache hit ──────────────────────────────────────────────────────────────
  if (cache.has(cacheKey)) {
    console.log(`[nutritionApi] Cache hit: "${query}"`);
    return cache.get(cacheKey);
  }

  // ── Validate key ───────────────────────────────────────────────────────────
  if (!apiKey) {
    console.error("[nutritionApi] ❌ SPOONACULAR_API_KEY is missing in .env");
    return [];
  }

  // ── Step 1: Search for the food ────────────────────────────────────────────
  const searchUrl =
    BASE + "/food/ingredients/search" +
    "?query="  + encodeURIComponent(query) +
    "&number=" + limit +
    "&apiKey=" + apiKey;

  console.log(`[nutritionApi] 🔍 Search: "${query}"`);

  let searchResults;
  try {
    const res = await fetch(searchUrl, { timeout: 12000 });
    console.log(`[nutritionApi] Search HTTP ${res.status} for "${query}"`);

    if (!res.ok) {
      const body = await res.text();
      console.error(`[nutritionApi] ❌ Search failed: ${res.status} — ${body.slice(0, 200)}`);
      return [];
    }

    const data = await res.json();
    searchResults = data.results || [];
  } catch (err) {
    console.error(`[nutritionApi] ❌ Search error for "${query}":`, err.message);
    return [];
  }

  if (searchResults.length === 0) {
    console.warn(`[nutritionApi] ⚠️ No ingredients found for: "${query}"`);
    return [];
  }

  // ── Step 2: Get per-100g nutrition for the best match ─────────────────────
  // We fetch the top result + optionally a few more to return a richer list
  const topIds = searchResults.slice(0, Math.min(limit, searchResults.length));

  // Pick the single best match for the primary result
  const best = bestMatch(searchResults, query);
  console.log(`[nutritionApi] Best match for "${query}": ${best.name} (id=${best.id})`);

  const results = [];
  const seen    = new Set();

  for (const item of topIds) {
    if (results.length >= limit) break;
    if (seen.has(item.id)) continue;
    seen.add(item.id);

    const nutUrl =
      BASE + "/food/ingredients/" + item.id + "/information" +
      "?amount=100&unit=grams&apiKey=" + apiKey;

    try {
      const res2 = await fetch(nutUrl, { timeout: 12000 });
      if (!res2.ok) {
        console.warn(`[nutritionApi] Nutrition HTTP ${res2.status} for id=${item.id}`);
        continue;
      }

      const nut = await res2.json();
      const nutrients = (nut.nutrition && nut.nutrition.nutrients) || [];

      const get = (name) => {
        const n = nutrients.find(n => n.name === name);
        return n ? n.amount : 0;
      };

      const calories = Math.round(get("Calories") * 10) / 10;

      // Skip items with 0 calories (likely a bad match)
      if (calories === 0) {
        console.warn(`[nutritionApi] Skipping ${item.name} — 0 kcal returned`);
        continue;
      }

      results.push({
        fdcId:           String(item.id),
        name:            nut.name || item.name,
        // All values are per 100g (we request amount=100&unit=grams)
        calories:        calories,
        protein:         Math.round(get("Protein")        * 10) / 10,
        carbs:           Math.round(get("Carbohydrates")  * 10) / 10,
        fat:             Math.round(get("Fat")            * 10) / 10,
        fiber:           Math.round(get("Fiber")          * 10) / 10,
        sugar:           Math.round(get("Sugar")          * 10) / 10,
        sodium:          Math.round(get("Sodium")),
        // servingSize=100 so frontend computePer100g() works correctly
        servingSize:     100,
        servingSizeUnit: "g",
        source:          "spoonacular",
        image:           item.image
          ? "https://spoonacular.com/cdn/ingredients_100x100/" + item.image
          : null,
      });

    } catch (err) {
      console.warn(`[nutritionApi] Nutrition fetch error for ${item.name}:`, err.message);
    }
  }

  if (results.length === 0) {
    console.warn(`[nutritionApi] ⚠️ All nutrition fetches failed for: "${query}"`);
    return [];
  }

  // Sort: put the best-match item first
  results.sort((a, b) => {
    if (a.fdcId === String(best.id)) return -1;
    if (b.fdcId === String(best.id)) return  1;
    return 0;
  });

  console.log(`[nutritionApi] ✅ Returning ${results.length} results for: "${query}"`);
  cache.set(cacheKey, results);
  return results;
};

module.exports = { searchFood };
