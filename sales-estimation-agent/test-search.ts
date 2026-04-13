const { kb } = require('./src/services/knowledgeBase');
const fs = require('fs');

async function run() {
  const buf = fs.readFileSync('requirements.pdf');
  await kb.addPDF('requirements.pdf', buf);
  const results = kb.search('requirements.pdf');
  console.log(`Found ${results.length} chunks`);
  if (results.length > 0) console.log(results[0].text.substring(0, 100));
}
run();
