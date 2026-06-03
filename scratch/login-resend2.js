import fs from 'fs';

async function login() {
  const email = 'awinbisid.bugbilla@ashesi.edu.gh';
  const password = 'HC2aJV3_NWrPkPV';

  console.log('Sending login POST to https://resend.com/login...');
  const loginRes = await fetch('https://resend.com/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
    body: JSON.stringify({ email, password })
  });

  const status = loginRes.status;
  const text = await loginRes.text();
  const headers = [...loginRes.headers.entries()];

  const output = {
    status,
    body: text,
    headers
  };

  fs.writeFileSync('scratch/login-output2.json', JSON.stringify(output, null, 2));
  console.log('Status:', status);
  console.log('Output written to scratch/login-output2.json');
}

login().catch(console.error);
