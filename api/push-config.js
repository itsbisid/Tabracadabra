import { getPushEnv, sendJson } from './push-utils.js';

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    sendJson(response, 405, { error: 'Method not allowed.' });
    return;
  }

  const { publicKey } = getPushEnv();
  if (!publicKey) {
    sendJson(response, 500, { error: 'WEB_PUSH_PUBLIC_KEY is not configured.' });
    return;
  }

  sendJson(response, 200, { publicKey });
}
