import fs from 'fs';

async function fetchDetails() {
  const domainId = '587821c6-9f94-41f8-ae08-6b5da2cfb6be';
  const actionOutput = JSON.parse(fs.readFileSync('scratch/action-output.json', 'utf8'));
  const setCookieHeaders = actionOutput.headers.filter(([k]) => k.toLowerCase() === 'set-cookie');
  
  const cookies = [];
  for (const [_, value] of setCookieHeaders) {
    const cookiePart = value.split(';')[0];
    cookies.push(cookiePart);
  }
  const cookieHeader = cookies.join('; ');

  console.log(`Fetching domain details for ${domainId} as RSC...`);
  const res = await fetch(`https://resend.com/domains/${domainId}`, {
    headers: {
      'Cookie': cookieHeader,
      'Rsc': '1',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });

  console.log('Status:', res.status);
  const text = await res.text();
  fs.writeFileSync('scratch/domain-details-real.txt', text);
  console.log('Saved domain details RSC to scratch/domain-details-real.txt');
}

fetchDetails().catch(console.error);
