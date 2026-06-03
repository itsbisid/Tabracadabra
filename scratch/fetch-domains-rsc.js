import fs from 'fs';

async function fetchRsc() {
  const actionOutput = JSON.parse(fs.readFileSync('scratch/action-output.json', 'utf8'));
  const setCookieHeaders = actionOutput.headers.filter(([k]) => k.toLowerCase() === 'set-cookie');
  
  const cookies = [];
  for (const [_, value] of setCookieHeaders) {
    const cookiePart = value.split(';')[0];
    cookies.push(cookiePart);
  }
  const cookieHeader = cookies.join('; ');

  console.log('Fetching https://resend.com/domains as RSC...');
  const res = await fetch('https://resend.com/domains', {
    headers: {
      'Cookie': cookieHeader,
      'Rsc': '1',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });

  console.log('Status:', res.status);
  const text = await res.text();
  fs.writeFileSync('scratch/domains-rsc.txt', text);
  console.log('Saved RSC payload to scratch/domains-rsc.txt');

  // Let's also fetch the specific tabracadabra.com domain page if possible
  // In Resend, domain details are typically at /domains/tabracadabra.com or similar
  console.log('Fetching https://resend.com/domains/tabracadabra.com as RSC...');
  const resDomain = await fetch('https://resend.com/domains/tabracadabra.com', {
    headers: {
      'Cookie': cookieHeader,
      'Rsc': '1',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });

  console.log('Domain Details Status:', resDomain.status);
  if (resDomain.ok) {
    const domainText = await resDomain.text();
    fs.writeFileSync('scratch/domain-details-rsc.txt', domainText);
    console.log('Saved domain details RSC to scratch/domain-details-rsc.txt');
  }
}

fetchRsc().catch(console.error);
