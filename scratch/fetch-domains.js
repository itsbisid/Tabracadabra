import fs from 'fs';

async function fetchDomains() {
  // Extract cookie from action-output.json
  const actionOutput = JSON.parse(fs.readFileSync('scratch/action-output.json', 'utf8'));
  const setCookieHeaders = actionOutput.headers.filter(([k]) => k.toLowerCase() === 'set-cookie');
  
  const cookies = [];
  for (const [_, value] of setCookieHeaders) {
    const cookiePart = value.split(';')[0];
    cookies.push(cookiePart);
  }

  const cookieHeader = cookies.join('; ');
  console.log('Using Cookie:', cookieHeader);

  // Try fetching /domains page
  console.log('Fetching https://resend.com/domains...');
  const resPage = await fetch('https://resend.com/domains', {
    headers: {
      'Cookie': cookieHeader,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });

  const pageText = await resPage.text();
  fs.writeFileSync('scratch/domains-page.html', pageText);
  console.log('Page Status:', resPage.status);
  console.log('Page content saved to scratch/domains-page.html');

  // Try fetching /api/domains
  console.log('Fetching https://resend.com/api/domains...');
  const resApi = await fetch('https://resend.com/api/domains', {
    headers: {
      'Cookie': cookieHeader,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });

  console.log('API Status:', resApi.status);
  if (resApi.ok) {
    const apiText = await resApi.text();
    fs.writeFileSync('scratch/domains-api.json', apiText);
    console.log('API content saved to scratch/domains-api.json');
  }
}

fetchDomains().catch(console.error);
