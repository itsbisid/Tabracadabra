import fs from 'fs';

const data = JSON.parse(fs.readFileSync('scratch/action-output.json', 'utf8'));
console.log('Status:', data.status);
console.log('Headers:');
for (const [key, value] of data.headers) {
  console.log(`  ${key}: ${value}`);
}
