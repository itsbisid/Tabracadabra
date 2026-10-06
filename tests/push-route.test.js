// BP regression: the merged push function still serves the original endpoint URLs.
import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/push.js';

async function call(url, query) {
  let status = 200, body = '';
  const response = { statusCode: 200, setHeader() {}, writeHead(code) { this.statusCode = code; }, end(raw) { status = this.statusCode; body = raw || ''; } };
  await handler({ method: 'GET', url, query, headers: {}, on() {} }, response);
  return { status, body };
}

test('push endpoints keep their URLs after merging into one function', async () => {
  const unknown = await call('/api/push-nope');
  assert.equal(unknown.status, 404);
  for (const [url, query] of [['/api/push-config'], ['/api/push?route=config'], ['/api/push', { route: 'config' }]]) {
    const result = await call(url, query);
    assert.notEqual(result.status, 404, `${url} should reach the config handler`);
    assert.ok(!/Unknown push endpoint/.test(result.body));
  }
});
