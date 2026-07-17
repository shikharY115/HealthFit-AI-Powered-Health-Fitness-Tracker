const fetch = require('node-fetch');

async function testUSDA(query) {
  const apiKey = 'DEMO_KEY';
  const url = 'https://api.nal.usda.gov/fdc/v1/foods/search?query=' +
    encodeURIComponent(query) + '&api_key=' + apiKey + '&pageSize=3&dataType=Foundation,SR%20Legacy,Branded';
  
  console.log('\n=== USDA Test: "' + query + '" ===');
  const res = await fetch(url, { timeout: 12000 });
  console.log('Status:', res.status);
  const data = await res.json();
  
  if (data.foods && data.foods.length > 0) {
    const f = data.foods[0];
    const kcal = (f.foodNutrients || []).find(n => n.nutrientId === 1008 || n.nutrientName === 'Energy');
    const prot = (f.foodNutrients || []).find(n => n.nutrientId === 1003 || n.nutrientName === 'Protein');
    const carb = (f.foodNutrients || []).find(n => n.nutrientId === 1005 || n.nutrientName === 'Carbohydrate, by difference');
    const fat  = (f.foodNutrients || []).find(n => n.nutrientId === 1004 || n.nutrientName === 'Total lipid (fat)');
    console.log('✅ Found:', f.description);
    console.log('  Cal:', kcal?.value, 'kcal/100g | Protein:', prot?.value, 'g | Carbs:', carb?.value, 'g | Fat:', fat?.value, 'g');
  } else {
    console.log('❌ No results');
    if (data.error) console.log('Error:', data.error);
  }
}

async function testNutritionAnalysis(query) {
  const appId  = 'd564f7ee';
  const appKey = '36ec14328ae1de0be13f3f8364720c7e';
  const ingr   = '100g ' + query;
  const url = 'https://api.edamam.com/api/nutrition-data?app_id=' + appId +
    '&app_key=' + appKey + '&nutrition-type=logging&ingr=' + encodeURIComponent(ingr);

  console.log('\n=== Nutrition Analysis Test: "' + query + '" (ingr: "' + ingr + '") ===');
  const res = await fetch(url, { timeout: 12000 });
  console.log('Status:', res.status);
  const data = await res.json();

  if (data.error) {
    console.log('❌ Error:', data.error, data.message);
    return;
  }

  const n = data.totalNutrients || {};
  if (data.calories && data.calories > 0) {
    console.log('✅ Calories:', data.calories, 'for 100g');
    console.log('  Protein:', n.PROCNT?.quantity?.toFixed(1), 'g | Carbs:', n.CHOCDF?.quantity?.toFixed(1), 'g | Fat:', n.FAT?.quantity?.toFixed(1), 'g');
  } else {
    console.log('❌ No calories returned (calories=', data.calories, ')');
  }
}

(async () => {
  const foods = ['milk', 'rice', 'chicken', 'egg', 'banana', 'pizza'];
  
  console.log('\n========== USDA FoodData Central API ==========');
  for (const f of foods) await testUSDA(f);

  console.log('\n\n========== Edamam Nutrition Analysis API ==========');
  for (const f of foods) await testNutritionAnalysis(f);

  console.log('\n\nDone.');
})();
