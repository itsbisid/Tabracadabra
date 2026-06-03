import fs from 'fs';

async function fetchResendRecords() {
  // Extract cookie from action-output.json
  if (!fs.existsSync('scratch/action-output.json')) {
    console.error('Error: login session file not found. Please log in first.');
    return;
  }
  const actionOutput = JSON.parse(fs.readFileSync('scratch/action-output.json', 'utf8'));
  const setCookieHeaders = actionOutput.headers.filter(([k]) => k.toLowerCase() === 'set-cookie');
  
  const cookies = [];
  for (const [_, value] of setCookieHeaders) {
    const cookiePart = value.split(';')[0];
    cookies.push(cookiePart);
  }

  const cookieHeader = cookies.join('; ');

  // Fetch the list of domains from the Resend dashboard API
  console.log('Fetching domains from Resend...');
  const res = await fetch('https://resend.com/api/domains', {
    headers: {
      'Cookie': cookieHeader,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json'
    }
  });

  if (!res.ok) {
    console.error(`Failed to fetch domains: ${res.status} ${res.statusText}`);
    const text = await res.text();
    console.error('Response:', text);
    return;
  }

  const domains = await res.json();
  console.log('Registered Domains:', JSON.stringify(domains, null, 2));

  // Write details to scratch/domains-data.json
  fs.writeFileSync('scratch/domains-data.json', JSON.stringify(domains, null, 2));
  console.log('Saved domain data to scratch/domains-data.json');
}

fetchResendRecords().catch(console.error);
