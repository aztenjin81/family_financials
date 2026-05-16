import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { handleApiRequest } from '../scripts/api-handler.mjs';

function createResponse() {
  const response = new EventEmitter();
  response.statusCode = null;
  response.headers = null;
  response.body = '';
  response.writeHead = (statusCode, headers) => {
    response.statusCode = statusCode;
    response.headers = headers;
  };
  response.end = (body = '') => {
    response.body += body;
    response.emit('finish');
  };
  return response;
}

test('handleApiRequest ignores non-api dashboard paths', async () => {
  const response = createResponse();
  const handled = await handleApiRequest({ url: '/', headers: { host: '127.0.0.1' } }, response);

  assert.equal(handled, false);
  assert.equal(response.statusCode, null);
});

test('handleApiRequest returns dashboard JSON', async () => {
  const response = createResponse();
  const handled = await handleApiRequest({ url: '/api/dashboard', headers: { host: '127.0.0.1' } }, response);
  const data = JSON.parse(response.body);

  assert.equal(handled, true);
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers['Content-Type'], 'application/json; charset=utf-8');
  assert.equal(data.family, 'The Czechowski Family');
});
