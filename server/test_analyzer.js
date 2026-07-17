require('dotenv').config();
const { processChatInput } = require('./utils/aiAnalyzer');

(async () => {
  const messages = [
    "I ate 3 roti, 1 bowl dal, and 100g paneer",
    "I had 1 pizza and 1 cup milk"
  ];
  
  for (const msg of messages) {
    console.log(`\nTesting message: "${msg}"`);
    try {
      const res = await processChatInput(msg, {});
      console.log(JSON.stringify(res, null, 2));
    } catch (e) {
      console.error(e);
    }
  }
})();
