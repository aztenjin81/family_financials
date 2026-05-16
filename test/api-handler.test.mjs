import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import test from 'node:test';
import { handleApiRequest } from '../scripts/api-handler.mjs';
import { getDashboardData } from '../scripts/dashboard-query.mjs';
import { getAppConnectionString, withClient } from '../scripts/db-utils.mjs';

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

function createRequest({ method = 'GET', url = '/', body = null } = {}) {
  const request = body === null
    ? Readable.from([])
    : Readable.from([JSON.stringify(body)]);

  request.method = method;
  request.url = url;
  request.headers = { host: '127.0.0.1', 'content-type': 'application/json' };
  return request;
}

test('handleApiRequest ignores non-api dashboard paths', async () => {
  const response = createResponse();
  const handled = await handleApiRequest(createRequest({ url: '/' }), response);

  assert.equal(handled, false);
  assert.equal(response.statusCode, null);
});

test('handleApiRequest returns dashboard JSON', async () => {
  const response = createResponse();
  const handled = await handleApiRequest(createRequest({ url: '/api/dashboard' }), response);
  const data = JSON.parse(response.body);

  assert.equal(handled, true);
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers['Content-Type'], 'application/json; charset=utf-8');
  assert.equal(data.family, 'The Czechowski Family');
});

test('handleApiRequest validates chore update payloads', async () => {
  const response = createResponse();
  const handled = await handleApiRequest(
    createRequest({ method: 'PATCH', url: '/api/chores/1', body: { done: 'yes' } }),
    response,
  );
  const data = JSON.parse(response.body);

  assert.equal(handled, true);
  assert.equal(response.statusCode, 400);
  assert.equal(data.error, '`done` must be a boolean');
});

test('handleApiRequest updates chore completion and can restore it', async () => {
  const dashboard = await getDashboardData();
  const chore = dashboard.kids.flatMap((kid) => kid.chores)[0];
  const nextDone = !chore.done;

  try {
    const updateResponse = createResponse();
    const handled = await handleApiRequest(
      createRequest({ method: 'PATCH', url: `/api/chores/${chore.id}`, body: { done: nextDone } }),
      updateResponse,
    );
    const updateData = JSON.parse(updateResponse.body);

    assert.equal(handled, true);
    assert.equal(updateResponse.statusCode, 200);
    assert.equal(updateData.chore.id, chore.id);
    assert.equal(updateData.chore.done, nextDone);

    const changedDashboard = await getDashboardData();
    const changedChore = changedDashboard.kids.flatMap((kid) => kid.chores).find((item) => item.id === chore.id);
    assert.equal(changedChore.done, nextDone);
  } finally {
    const restoreResponse = createResponse();
    await handleApiRequest(
      createRequest({ method: 'PATCH', url: `/api/chores/${chore.id}`, body: { done: chore.done } }),
      restoreResponse,
    );
  }
});

test('handleApiRequest validates transaction insert payloads', async () => {
  const response = createResponse();
  await handleApiRequest(
    createRequest({ method: 'POST', url: '/api/transactions', body: { merchant: '', amount: 12 } }),
    response,
  );
  const data = JSON.parse(response.body);

  assert.equal(response.statusCode, 400);
  assert.equal(data.error, 'Merchant is required');
});

test('handleApiRequest inserts a transaction and can clean it up', async () => {
  const merchant = `Test Transaction ${Date.now()}`;
  let transactionId = null;

  try {
    const response = createResponse();
    await handleApiRequest(
      createRequest({
        method: 'POST',
        url: '/api/transactions',
        body: {
          merchant,
          category: 'Groceries',
          amount: 12.34,
          memberSlug: 'alex',
          postedLabel: 'Today',
          timeLabel: '10:41 PM',
          emoji: '🧪',
          isIncome: false,
        },
      }),
      response,
    );
    const data = JSON.parse(response.body);
    transactionId = data.transaction.id;

    assert.equal(response.statusCode, 201);
    assert.equal(data.transaction.merchant, merchant);
    assert.equal(data.transaction.amount, -12.34);

    const dashboard = await getDashboardData();
    const merchants = dashboard.transactions.flatMap((group) => group.items.map((item) => item.merch));
    assert.ok(merchants.includes(merchant));
  } finally {
    if (transactionId) {
      await withClient(getAppConnectionString(), async (client) => {
        await client.query('delete from transactions where id = $1', [transactionId]);
      });
    }
  }
});
