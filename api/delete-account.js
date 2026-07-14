import {
  deleteAccountData,
  getSessionContext,
  sendJson
} from '../api-shared/deletion-utils.js';

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    sendJson(response, 405, { error: 'Method not allowed.' });
    return;
  }

  try {
    const session = await getSessionContext(request);
    if (!session) {
      sendJson(response, 401, { error: 'You must be signed in to delete your account.' });
      return;
    }

    const result = await deleteAccountData(session.user);
    sendJson(response, 200, { ok: true, result });
  } catch (error) {
    sendJson(response, 500, { error: error.message || 'Could not delete your account.' });
  }
}
