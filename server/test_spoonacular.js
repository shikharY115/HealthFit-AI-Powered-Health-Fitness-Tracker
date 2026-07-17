const fetch = require('node-fetch');
const apiKey = 'bac2214928f8414ea3da93100f90f9d6';

async function testSpoonacular(query) {
  // Step 1: search for ingredient
  const searchUrl = 'https://api.spoonacular.com/food/ingredients/search?query=' +
    encodeURIComponent(query) + '&number=3&apiKey=' + apiKey;

  console.log('\n=== "' + query + '" ===');
  const res1 = await fetch(searchUrl, { timeout: 10000 });
  console.log('Search HTTP:', res1.status);
  const searchData = await res1.json();

  if (!searchData.results || searchData.results.length === 0) {
    console.log('No search results'); return;
  }

  const top = searchData.results[0];
  console.log('Best match:', top.name, '(id=' + top.id + ')');

  // Step 2: get nutrition per 100g
  const nutUrl = 'https://api.spoonacular.com/food/ingredients/' + top.id +
    '/information?amount=100&unit=grams&apiKey=' + apiKey;
  const res2 = await fetch(nutUrl, { timeout: 10000 });
  console.log('Nutrition HTTP:', res2.status);
  const nutData = await res2.json();

  const nutrients = nutData.nutrition && nutData.nutrition.nutrients || [];
  const get = (name) => (nutrients.find(n => n.name === name) || {}).amount || 0;
  console.log('  Calories:', get('Calories').toFixed(1), 'kcal/100g');
  console.log('  Protein: ', get('Protein').toFixed(1), 'g');
  console.log('  Carbs:   ', get('Carbohydrates').toFixed(1), 'g');
  console.log('  Fat:     ', get('Fat').toFixed(1), 'g');
}

(async () => {
  try {
    for (const food of ['milk', 'rice', 'chicken', 'egg', 'banana', 'pizza', 'paneer']) {
      await testSpoonacular(food);
    }
    console.log('\n✅ Done');
  } catch (e) { console.error('Error:', e.message); }
})();
