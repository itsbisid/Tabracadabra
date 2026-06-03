import fs from 'fs';

function parseList() {
  const content = fs.readFileSync('scratch/domains-rsc.txt', 'utf8');

  console.log('Searching for tabracadabra.com in domains list...');

  const index = content.indexOf('tabracadabra.com');
  if (index !== -1) {
    console.log('Found tabracadabra.com at index', index);
    const start = Math.max(0, index - 500);
    const end = Math.min(content.length, index + 1000);
    console.log('=== Surrounding text ===');
    console.log(content.substring(start, end));
  } else {
    console.log('tabracadabra.com not found in domains list.');
    // Let's print some general text to see what is there
    console.log('=== Start of file ===');
    console.log(content.substring(0, 2000));
  }
}

parseList();
