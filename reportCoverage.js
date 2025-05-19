const fs = require('fs');
const path = require('path');
const url = require('url');

const coverageDir = path.join(__dirname, 'coverage');
let total = 0;
let covered = 0;

for (const file of fs.readdirSync(coverageDir)) {
  if (!file.endsWith('.json')) continue;
  const data = JSON.parse(fs.readFileSync(path.join(coverageDir, file)));
  for (const result of data.result) {
    if (!result.url.startsWith('file://')) continue;
    const filePath = url.fileURLToPath(result.url);
    if (!filePath.startsWith(__dirname)) continue;
    for (const fn of result.functions) {
      for (const range of fn.ranges) {
        total++;
        if (range.count > 0) covered++;
      }
    }
  }
}

const pct = total === 0 ? 0 : (covered / total) * 100;
console.log(`Coverage: ${pct.toFixed(2)}%`);
if (pct < 100) {
  console.error('Coverage below 100%');
  process.exitCode = 1;
}
