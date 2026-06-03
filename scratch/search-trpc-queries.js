import fs from 'fs';
import path from 'path';

function search() {
  const files = fs.readdirSync('scratch').filter(f => f.startsWith('js-') && f.endsWith('.js'));
  console.log(`Searching ${files.length} files...`);

  for (const file of files) {
    const content = fs.readFileSync(path.join('scratch', file), 'utf8');
    
    // Find all occurrences of domains.something or TRPC queries
    const regex = /"domains\.[a-zA-Z]+"/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      console.log(`Found in ${file}: ${match[0]}`);
    }

    // Also search for general trpc query names
    if (content.includes('trpc') || content.includes('domains')) {
      // Look for strings like "domains.list" or similar
      const regex2 = /'domains\.[a-zA-Z]+'/g;
      let match2;
      while ((match2 = regex2.exec(content)) !== null) {
        console.log(`Found in ${file}: ${match2[0]}`);
      }
    }
  }
}

search();
