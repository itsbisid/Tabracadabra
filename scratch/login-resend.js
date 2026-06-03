import fs from 'fs';

async function login() {
  const email = 'awinbisid.bugbilla@ashesi.edu.gh';
  const password = 'HC2aJV3_NWrPkPV';

  console.log('Fetching CSRF token...');
  const csrfRes = await fetch('https://resend.com/api/auth/csrf');
  const csrfData = await csrfRes.json();
  const csrfToken = csrfData.csrfToken;
  console.log('CSRF Token:', csrfToken);

  console.log('Sending login request...');
  const loginRes = await fetch('https://resend.com/api/auth/callback/credentials', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
    body: new URLSearchParams({
      csrfToken,
      username: email,
      password: password,
      json: 'true',
      redirect: 'false'
    })
  });

  const status = loginRes.status;
  const text = await loginRes.text();
  const headers = [...loginRes.headers.entries()];

  const output = {
    status,
    body: text,
    headers
  };

  fs.writeFileSync('scratch/login-output.json', JSON.stringify(output, null, 2));
  console.log('Output written to scratch/login-output.json');
}

login().catch(console.error);
