const { PDFParse } = require('pdf-parse');
const fs = require('fs');

async function run() {
  const buf = fs.readFileSync('requirements.pdf');
  const parser = new PDFParse();
  await parser.load(buf);
  const text = await parser.getText();
  console.log("TEXT EXTRACTED:", text.substring(0, 100));
}
run();
