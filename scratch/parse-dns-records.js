import fs from 'fs';

function parse() {
  const content = fs.readFileSync('scratch/domain-details-real.txt', 'utf8');

  console.log('Searching for DNS records in domains detail RSC...');

  // Let's search for JSON data containing record details.
  // We can look for substrings starting with '"records":' or containing array of objects with keys like 'type', 'value', 'status'.
  
  // Let's try to extract any JSON-like structures that list DNS records
  const regex = /"records":\s*(\[[^\]]+\])/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    console.log('Found records array:', match[1]);
  }

  // Let's do a general search for records, host names, values
  const regex2 = /\{"id":"[^"]+","type":"[A-Z]+","name":"[^"]+","value":"[^"]+"[^\}]*\}/g;
  const matches = content.match(regex2);
  if (matches) {
    console.log(`Found ${matches.length} record objects:`);
    for (const m of matches) {
      console.log(' -', m);
    }
  } else {
    // If not found as objects, let's search for strings like "resend-verification" or "feedback" or "sendgrid"
    console.log('No structured record objects found. Searching for text snippets...');
    const searchTerms = ['verification', 'dkim', 'feedback', 'mx', 'spf', 'txt', 'cname'];
    const lines = content.split('\n');
    for (const line of lines) {
      if (searchTerms.some(term => line.toLowerCase().includes(term))) {
        // Snippet around the match
        console.log('Line snippet:', line.substring(0, 1000));
      }
    }
  }
}

parse();
