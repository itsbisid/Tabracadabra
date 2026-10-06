// One Vercel function for the three push endpoints, to stay within the Hobby plan's
// 12-function limit. vercel.json rewrites /api/push-config|status|subscribe here, so the
// public URLs used by js/lib/push-service.js are unchanged.
import config from '../api-shared/push-routes/config.js';
import status from '../api-shared/push-routes/status.js';
import subscribe from '../api-shared/push-routes/subscribe.js';

const routes = { config, status, subscribe };

export default async function handler(request, response) {
  const url = new URL(request.url || '/', 'http://localhost');
  const route = request.query?.route || url.searchParams.get('route') || url.pathname.match(/\/api\/push-([a-z]+)/)?.[1];
  const target = routes[route];
  if (!target) {
    response.statusCode = 404;
    response.setHeader('Content-Type', 'application/json');
    return response.end(JSON.stringify({ error: 'Unknown push endpoint.' }));
  }
  return target(request, response);
}
