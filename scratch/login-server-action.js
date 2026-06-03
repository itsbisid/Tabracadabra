import fs from 'fs';

async function testAction() {
  const email = 'awinbisid.bugbilla@ashesi.edu.gh';
  const password = 'HC2aJV3_NWrPkPV';

  console.log('Calling login server action...');
  const res = await fetch('https://resend.com/login', {
    method: 'POST',
    headers: {
      'Next-Action': '7f90838f4366f1a63fb053a4e52f36f3319e6d310b',
      'Content-Type': 'text/plain;charset=UTF-8',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': '*/*'
    },
    body: JSON.stringify([{
      email,
      password,
      payload: undefined,
      radarSessionToken: undefined,
      redirectTo: undefined
    }])
  });

  const status = res.status;
  const text = await res.text();
  const headers = [...res.headers.entries()];

  const output = {
    status,
    body: text,
    headers
  };

  fs.writeFileSync('scratch/action-output.json', JSON.stringify(output, null, 2));
  console.log('Status:', status);
  console.log('Result written to scratch/action-output.json');
}

testAction().catch(console.error);
