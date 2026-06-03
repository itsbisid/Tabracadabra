import fs from 'fs';

const content = fs.readFileSync('scratch/js-0jhrnbd8.zcis.js', 'utf8');

// Let's find the location of "LoginForm" and print the surrounding characters
const index = content.indexOf('LoginForm');
if (index !== -1) {
  console.log('Found LoginForm at index', index);
  // Let's print 3000 characters before and after to analyze
  const start = Math.max(0, index - 200);
  const end = Math.min(content.length, index + 4000);
  console.log(content.substring(start, end));
} else {
  console.log('LoginForm not found');
}
