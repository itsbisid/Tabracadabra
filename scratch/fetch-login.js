import fs from 'fs';

async function fetchLoginPage() {
  const res = await fetch('https://resend.com/login', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    }
  });

  const text = await res.text();
  console.log('Status:', res.status);
  fs.writeFileSync('scratch/login-page.html', text);
}

fetchLoginPage().catch(console.error);
