const fetch = require('node-fetch');

const appId  = 'd564f7ee';
const appKey = '36ec14328ae1de0be13f3f8364720c7e';

async function testFood(query) {
  const url = 'https://api.edamam.com/api/food-database/v2/parser' +
    '?app_id=' + appId +
    '&app_key=' + appKey +
    '&ingr=' + encodeURIComponent(query) +
    '&nutrition-type=logging';

  console.log('\n--- Testing: "' + query + '" ---');
  console.log('URL:', url);

  const res = await fetch(url, { timeout: 12000 });
  console.log('HTTP Status:', res.status);

  const data = await res.json();

  if (data.error) {
    console.error('API Error:', data.error, data.message);
    return;
  }

  const parsed = (data.parsed || []).map(p => p.food);
  const hints  = (data.hints  || []).map(h => h.food);
  const all    = [...parsed, ...hints].filter(Boolean);

  console.log('Parsed:', parsed.length, '| Hints:', hints.length);

  if (all.length > 0) {
    const f = all[0];
    const n = f.nutrients || {};
    console.log('Best result:', f.label);
    console.log('  Calories:', n.ENERC_KCAL, 'kcal/100g');
    console.log('  Protein: ', n.PROCNT, 'g/100g');
    console.log('  Carbs:   ', n.CHOCDF, 'g/100g');
    console.log('  Fat:     ', n.FAT, 'g/100g');
  } else {
    console.log('No results found!');
  }
}

(async () => {
  try {
    await testFood('milk');
    await testFood('rice');
    await testFood('chicken');
    await testFood('pizza');
    await testFood('egg');
    await testFood('banana');
    console.log('\n✅ All tests complete');
  } catch (err) {
    console.error('Test failed:', err.message);
  }
})();
