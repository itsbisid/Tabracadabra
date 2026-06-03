import fs from 'fs';

async function checkCsrf() {
  const res = await fetch('https://resend.com/api/auth/csrf', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json'
    }
  });

  const text = await res.text();
  console.log('Status:', res.status);
  console.log('Content-Type:', res.headers.get('content-type'));
  fs.writeFileSync('scratch/csrf-raw.txt', text);
}

checkCsrf().catch(console.error);
