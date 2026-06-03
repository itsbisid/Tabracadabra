import fs from 'fs';
import path from 'path';

async function analyze() {
  const html = fs.readFileSync('scratch/login-page.html', 'utf8');
  
  // Find all script tags src attributes starting with /_next
  const scriptRegex = /<script[^>]+src="([^"]+)"/g;
  let match;
  const urls = [];
  while ((match = scriptRegex.exec(html)) !== null) {
    urls.push(match[1]);
  }

  console.log(`Found ${urls.length} scripts.`);

  for (const url of urls) {
    const fullUrl = url.startsWith('http') ? url : `https://resend.com${url}`;
    const filename = path.basename(url.split('?')[0]);
    const cachePath = `scratch/js-${filename}`;

    let content;
    if (fs.existsSync(cachePath)) {
      content = fs.readFileSync(cachePath, 'utf8');
    } else {
      console.log(`Downloading ${fullUrl}...`);
      try {
        const res = await fetch(fullUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        if (!res.ok) {
          console.log(`Failed to download ${fullUrl}: ${res.status}`);
          continue;
        }
        content = await res.text();
        fs.writeFileSync(cachePath, content);
      } catch (err) {
        console.error(`Error downloading ${fullUrl}:`, err);
        continue;
      }
    }

    // Search for patterns
    if (content.includes('password') || content.includes('/login') || content.includes('Next-Action') || content.includes('action:')) {
      console.log(`>>> Found match in ${filename}!`);
      // Print matches around "password" or "/login"
      const lines = content.split('\n');
      for (const line of lines) {
        if (line.length > 500) {
          // It's probably minified, search by regex and print snippet
          const matchIndex = line.indexOf('password');
          if (matchIndex !== -1) {
            console.log(`Snippet around "password": ${line.substring(Math.max(0, matchIndex - 100), Math.min(line.length, matchIndex + 200))}`);
          }
          const loginIndex = line.indexOf('/login');
          if (loginIndex !== -1) {
            console.log(`Snippet around "/login": ${line.substring(Math.max(0, loginIndex - 100), Math.min(line.length, loginIndex + 200))}`);
          }
        } else {
          if (line.includes('password') || line.includes('/login')) {
            console.log(`Line: ${line}`);
          }
        }
      }
    }
  }
}

analyze().catch(console.error);
