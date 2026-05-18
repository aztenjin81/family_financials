import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import test from 'node:test';

import { handlePlaidWebhookRequest } from '../scripts/plaid-webhook-handler.mjs';

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

function createRequest({ method = 'GET', url = '/', body = null, rawBody = null, headers = {} } = {}) {
  const requestBody = rawBody != null ? String(rawBody) : body === null ? null : JSON.stringify(body);
  const request = requestBody === null ? Readable.from([]) : Readable.from([requestBody]);
  request.method = method;
  request.url = url;
  request.headers = {
    host: '127.0.0.1',
    'content-type': 'application/json',
    ...headers,
  };
  return request;
}

test('plaid webhook handler ignores non-webhook routes', async () => {
  const response = createResponse();
  const handled = await handlePlaidWebhookRequest(createRequest({ url: '/' }), response);

  assert.equal(handled, false);
  assert.equal(response.statusCode, null);
});

test('plaid webhook handler rejects requests without the verification header', async () => {
  const response = createResponse();
  const handled = await handlePlaidWebhookRequest(
    createRequest({ method: 'POST', url: '/api/plaid/webhook', body: { webhook_type: 'ITEM' } }),
    response,
  );
  const data = JSON.parse(response.body);

  assert.equal(handled, true);
  assert.equal(response.statusCode, 400);
  assert.equal(data.error, 'Plaid verification header is required');
});
