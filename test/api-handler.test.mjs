import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import test from 'node:test';
import { handleApiRequest } from '../scripts/api-handler.mjs';
import { getDashboardData } from '../scripts/dashboard-query.mjs';
import { getAppConnectionString, withClient } from '../scripts/db-utils.mjs';
import { resetMockDatabase } from '../scripts/mock-db.mjs';
import { getSuggestedChoreTemplates } from '../src/lib/chore-templates.js';

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

function createRequest({ method = 'GET', url = '/', body = null, rawBody = null } = {}) {
  const request = rawBody !== null
    ? Readable.from([rawBody])
    : body === null
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

test('handleApiRequest rejects malformed chore JSON', async () => {
  const response = createResponse();
  await handleApiRequest(
    createRequest({ method: 'PATCH', url: '/api/chores/1', rawBody: '{' }),
    response,
  );
  const data = JSON.parse(response.body);

  assert.equal(response.statusCode, 400);
  assert.equal(data.error, 'Invalid JSON');
});

test('handleApiRequest returns 404 for missing chore ids', async () => {
  const response = createResponse();
  await handleApiRequest(
    createRequest({ method: 'PATCH', url: '/api/chores/999999', body: { done: true } }),
    response,
  );
  const data = JSON.parse(response.body);

  assert.equal(response.statusCode, 404);
  assert.equal(data.error, 'Chore not found');
});

test('handleApiRequest validates chore creation payloads', async () => {
  const response = createResponse();
  const handled = await handleApiRequest(
    createRequest({ method: 'POST', url: '/api/chores', body: { memberSlug: '', label: '', reward: -1 } }),
    response,
  );
  const data = JSON.parse(response.body);

  assert.equal(handled, true);
  assert.equal(response.statusCode, 400);
  assert.equal(data.error, 'Member is required');
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

test('handleApiRequest creates a chore from an age-aware suggestion', async () => {
  const dashboard = await getDashboardData();
  const kid = dashboard.kids.find((entry) => entry.age >= 10);
  const suggestion = kid ? getSuggestedChoreTemplates(kid.age)[0] : null;
  const template = suggestion ? { memberSlug: kid.who, label: suggestion.label, reward: suggestion.reward } : null;

  assert.ok(template);

  const response = createResponse();
  const handled = await handleApiRequest(
    createRequest({ method: 'POST', url: '/api/chores', body: template }),
    response,
  );
  const data = JSON.parse(response.body);

  assert.equal(handled, true);
  assert.equal(response.statusCode, 201);
  assert.equal(data.chore.label, template.label);
  assert.equal(data.chore.done, false);
});

test('handleApiRequest updates and moves a chore', async () => {
  const dashboard = await getDashboardData();
  const choreOwner = dashboard.kids.find((kid) => kid.chores.length > 0);
  const chore = choreOwner.chores[0];
  const nextLabel = `${chore.label} updated`;
  const nextReward = Number((chore.reward + 0.5).toFixed(2));

  try {
    const response = createResponse();
    const handled = await handleApiRequest(
      createRequest({
        method: 'PATCH',
        url: `/api/chores/${chore.id}`,
        body: {
          memberSlug: dashboard.kids[1]?.who || dashboard.kids[0].who,
          label: nextLabel,
          reward: nextReward,
          done: !chore.done,
        },
      }),
      response,
    );
    const data = JSON.parse(response.body);

    assert.equal(handled, true);
    assert.equal(response.statusCode, 200);
    assert.equal(data.chore.id, chore.id);
    assert.equal(data.chore.label, nextLabel);
    assert.equal(data.chore.reward, nextReward);
    assert.equal(data.chore.done, !chore.done);
  } finally {
    const restoreResponse = createResponse();
    await handleApiRequest(
      createRequest({
        method: 'PATCH',
        url: `/api/chores/${chore.id}`,
        body: {
          memberSlug: choreOwner.who,
          label: chore.label,
          reward: chore.reward,
          done: chore.done,
        },
      }),
      restoreResponse,
    );
  }
});

test('handleApiRequest deletes a chore and can restore the list', async () => {
  const dashboard = await getDashboardData();
  const kid = dashboard.kids.find((entry) => entry.age >= 10) || dashboard.kids[0];
  const template = getSuggestedChoreTemplates(kid.age)[0];

  assert.ok(template);

  const createResponseHandle = createResponse();
  const createHandled = await handleApiRequest(
    createRequest({
      method: 'POST',
      url: '/api/chores',
      body: { memberSlug: kid.who, label: template.label, reward: template.reward },
    }),
    createResponseHandle,
  );
  const createdData = JSON.parse(createResponseHandle.body);
  const createdId = createdData.chore.id;
  const beforeCount = dashboard.kids.flatMap((entry) => entry.chores).length;

  assert.equal(createHandled, true);
  assert.equal(createResponseHandle.statusCode, 201);

  try {
    const deleteResponse = createResponse();
    const deletedHandled = await handleApiRequest(
      createRequest({ method: 'DELETE', url: `/api/chores/${createdId}` }),
      deleteResponse,
    );
    const deleteData = JSON.parse(deleteResponse.body);
    const after = await getDashboardData();

    assert.equal(deletedHandled, true);
    assert.equal(deleteResponse.statusCode, 200);
    assert.equal(deleteData.chore.id, createdId);
    assert.equal(after.kids.flatMap((entry) => entry.chores).length, beforeCount);
  } finally {
    const cleanupDashboard = await getDashboardData();
    const stillThere = cleanupDashboard.kids.flatMap((entry) => entry.chores).find((item) => item.id === createdId);

    if (stillThere) {
      const cleanupResponse = createResponse();
      await handleApiRequest(
        createRequest({ method: 'DELETE', url: `/api/chores/${createdId}` }),
        cleanupResponse,
      );
    }
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

test('handleApiRequest rejects malformed transaction JSON', async () => {
  const response = createResponse();
  await handleApiRequest(
    createRequest({ method: 'POST', url: '/api/transactions', rawBody: '{' }),
    response,
  );
  const data = JSON.parse(response.body);

  assert.equal(response.statusCode, 400);
  assert.equal(data.error, 'Invalid JSON');
});

test('handleApiRequest validates transaction update payloads', async () => {
  const dashboard = await getDashboardData();
  const transaction = dashboard.transactions.flatMap((group) => group.items)[0];
  const response = createResponse();
  await handleApiRequest(
    createRequest({
      method: 'PATCH',
      url: `/api/transactions/${transaction.id}`,
      body: { merchant: '', amount: 'bad' },
    }),
    response,
  );
  const data = JSON.parse(response.body);

  assert.equal(response.statusCode, 400);
  assert.equal(data.error, 'Amount must be greater than zero');
});

test('handleApiRequest rejects malformed transaction update JSON', async () => {
  const response = createResponse();
  await handleApiRequest(
    createRequest({ method: 'PATCH', url: '/api/transactions/1', rawBody: '{' }),
    response,
  );
  const data = JSON.parse(response.body);

  assert.equal(response.statusCode, 400);
  assert.equal(data.error, 'Invalid JSON');
});

test('handleApiRequest preserves the current member when editing a transaction amount', async () => {
  const dashboard = await getDashboardData();
  const transaction = dashboard.transactions.flatMap((group) => group.items)[0];
  const nextAmount = Number((Math.abs(transaction.amt) + 2).toFixed(2));

  try {
    const response = createResponse();
    const handled = await handleApiRequest(
      createRequest({
        method: 'PATCH',
        url: `/api/transactions/${transaction.id}`,
        body: {
          merchant: transaction.merch,
          category: transaction.cat,
          memberSlug: '',
          postedLabel: transaction.postedLabel || 'Today',
          timeLabel: transaction.time,
          emoji: transaction.emoji,
          amount: nextAmount,
          isIncome: Boolean(transaction.income),
        },
      }),
      response,
    );
    const data = JSON.parse(response.body);

    assert.equal(handled, true);
    assert.equal(response.statusCode, 200);
    assert.equal(data.transaction.id, transaction.id);
    assert.equal(data.transaction.amount, transaction.income ? nextAmount : -nextAmount);
  } finally {
    const restoreResponse = createResponse();
    await handleApiRequest(
      createRequest({
        method: 'PATCH',
        url: `/api/transactions/${transaction.id}`,
        body: {
          merchant: transaction.merch,
          category: transaction.cat,
          memberSlug: transaction.who,
          postedLabel: transaction.postedLabel || 'Today',
          timeLabel: transaction.time,
          emoji: transaction.emoji,
          amount: Math.abs(transaction.amt),
          isIncome: Boolean(transaction.income),
        },
      }),
      restoreResponse,
    );
  }
});

test('handleApiRequest validates account insert payloads', async () => {
  const response = createResponse();
  await handleApiRequest(
    createRequest({ method: 'POST', url: '/api/accounts', body: { accountGroup: '', name: 'Test', ownerSlug: 'john', balance: 0 } }),
    response,
  );
  const data = JSON.parse(response.body);

  assert.equal(response.statusCode, 400);
  assert.equal(data.error, 'Account group is required');
});

test('handleApiRequest rejects malformed account JSON', async () => {
  const response = createResponse();
  await handleApiRequest(
    createRequest({ method: 'POST', url: '/api/accounts', rawBody: '{' }),
    response,
  );
  const data = JSON.parse(response.body);

  assert.equal(response.statusCode, 400);
  assert.equal(data.error, 'Invalid JSON');
});

test('handleApiRequest validates account update payloads', async () => {
  const response = createResponse();
  await handleApiRequest(
    createRequest({ method: 'PATCH', url: '/api/accounts/1', body: { accountGroup: '', name: 'Test', ownerSlug: 'john', balance: 0 } }),
    response,
  );
  const data = JSON.parse(response.body);

  assert.equal(response.statusCode, 400);
  assert.equal(data.error, 'Account group is required');
});

test('handleApiRequest pays weekly allowance and records a history batch', async () => {
  resetMockDatabase();
  const before = await getDashboardData();
  const updateResponse = createResponse();
  const response = createResponse();

  try {
    await handleApiRequest(
      createRequest({ method: 'PATCH', url: '/api/household/allowance', body: { weeklyAmount: 7.5 } }),
      updateResponse,
    );

    await handleApiRequest(
      createRequest({ method: 'POST', url: '/api/allowance/pay-weekly' }),
      response,
    );
    const data = JSON.parse(response.body);
    const after = await getDashboardData();

    assert.equal(response.statusCode, 200);
    assert.equal(data.allowancePayment.entries.length, before.kids.length);
    assert.equal(data.allowancePayment.entries[0].weeklyAmount, 7.5);
    assert.equal(data.allowancePayment.total, before.kids.length * 7.5);
    assert.equal(after.allowanceHistory.length, before.allowanceHistory.length + 1);
    assert.equal(after.allowanceHistory[0].entries.length, before.kids.length);
    assert.equal(after.kids[0].balance, before.kids[0].balance + 7.5);
  } finally {
    const restoreAllowance = createResponse();
    await handleApiRequest(
      createRequest({ method: 'PATCH', url: '/api/household/allowance', body: { weeklyAmount: 5 } }),
      restoreAllowance,
    );
    resetMockDatabase();
  }
});

test('handleApiRequest updates the household weekly allowance amount', async () => {
  resetMockDatabase();
  const response = createResponse();

  try {
    await handleApiRequest(
      createRequest({ method: 'PATCH', url: '/api/household/allowance', body: { weeklyAmount: 7.5 } }),
      response,
    );
    const data = JSON.parse(response.body);
    const after = await getDashboardData();

    assert.equal(response.statusCode, 200);
    assert.equal(data.allowance.weeklyAmount, 7.5);
    assert.equal(after.allowance.weeklyAmount, 7.5);
  } finally {
    resetMockDatabase();
  }
});

test('handleApiRequest voids the latest allowance payout and restores jar balances', async () => {
  resetMockDatabase();
  const before = await getDashboardData();
  const payResponse = createResponse();
  const voidResponse = createResponse();

  try {
    await handleApiRequest(
      createRequest({ method: 'POST', url: '/api/allowance/pay-weekly' }),
      payResponse,
    );

    const paid = await getDashboardData();

    await handleApiRequest(
      createRequest({ method: 'POST', url: '/api/allowance/void-latest' }),
      voidResponse,
    );

    const data = JSON.parse(voidResponse.body);
    const after = await getDashboardData();

    assert.equal(voidResponse.statusCode, 200);
    assert.equal(data.allowanceReversal.entries.length, before.kids.length);
    assert.equal(data.allowanceReversal.total, -before.kids.length * before.allowance.weeklyAmount);
    assert.equal(paid.kids[0].balance, before.kids[0].balance + before.allowance.weeklyAmount);
    assert.equal(after.kids[0].balance, before.kids[0].balance);
    assert.equal(after.allowanceHistory[0].total, -before.kids.length * before.allowance.weeklyAmount);
  } finally {
    resetMockDatabase();
  }
});

test('handleApiRequest validates goal insert payloads', async () => {
  const response = createResponse();
  await handleApiRequest(
    createRequest({
      method: 'POST',
      url: '/api/goals',
      body: { ownerSlug: 'john', name: '', currentAmount: 0, targetAmount: 100 },
    }),
    response,
  );
  const data = JSON.parse(response.body);

  assert.equal(response.statusCode, 400);
  assert.equal(data.error, 'Goal name is required');
});

test('handleApiRequest rejects malformed goal JSON', async () => {
  const response = createResponse();
  await handleApiRequest(
    createRequest({ method: 'POST', url: '/api/goals', rawBody: '{' }),
    response,
  );
  const data = JSON.parse(response.body);

  assert.equal(response.statusCode, 400);
  assert.equal(data.error, 'Invalid JSON');
});

test('handleApiRequest validates investment holding update payloads', async () => {
  const response = createResponse();
  await handleApiRequest(
    createRequest({
      method: 'PATCH',
      url: '/api/investments/1',
      body: { ticker: '', name: 'Test holding', value: 'bad', dailyChangePercent: 1.2 },
    }),
    response,
  );
  const data = JSON.parse(response.body);

  assert.equal(response.statusCode, 400);
  assert.equal(data.error, 'Ticker is required');
});

test('handleApiRequest returns 404 for missing investment holding ids', async () => {
  const response = createResponse();
  await handleApiRequest(
    createRequest({
      method: 'PATCH',
      url: '/api/investments/999999',
      body: { ticker: 'TEST', name: 'Missing holding', value: 10, dailyChangePercent: 1 },
    }),
    response,
  );
  const data = JSON.parse(response.body);

  assert.equal(response.statusCode, 404);
  assert.equal(data.error, 'Holding not found');
});

test('handleApiRequest updates an investment holding and can restore it', async () => {
  const dashboard = await getDashboardData();
  const holding = dashboard.investments.holdings[0];
  const nextValue = Number((holding.val + 50).toFixed(2));
  const nextChange = Number((holding.d + 0.15).toFixed(2));

  try {
    const response = createResponse();
    await handleApiRequest(
      createRequest({
        method: 'PATCH',
        url: `/api/investments/${holding.id}`,
        body: {
          ticker: holding.tk,
          name: `${holding.name} Updated`,
          value: nextValue,
          dailyChangePercent: nextChange,
        },
      }),
      response,
    );
    const data = JSON.parse(response.body);

    assert.equal(response.statusCode, 200);
    assert.equal(data.holding.id, holding.id);
    assert.equal(data.holding.name, `${holding.name} Updated`);
    assert.equal(data.holding.value, nextValue);
    assert.equal(data.holding.dailyChangePercent, nextChange);

    const changedDashboard = await getDashboardData();
    const changedHolding = changedDashboard.investments.holdings.find((item) => item.id === holding.id);
    assert.equal(changedHolding.name, `${holding.name} Updated`);
    assert.equal(changedHolding.val, nextValue);
  } finally {
    const restoreResponse = createResponse();
    await handleApiRequest(
      createRequest({
        method: 'PATCH',
        url: `/api/investments/${holding.id}`,
        body: {
          ticker: holding.tk,
          name: holding.name,
          value: holding.val,
          dailyChangePercent: holding.d,
        },
      }),
      restoreResponse,
    );
  }
});

test('handleApiRequest validates bill insert payloads', async () => {
  const response = createResponse();
  await handleApiRequest(
    createRequest({
      method: 'POST',
      url: '/api/bills',
      body: {
        memberSlug: 'john',
        monthLabel: '',
        dayOfMonth: 14,
        name: '',
        subtitle: '',
        amount: 22.99,
      },
    }),
    response,
  );
  const data = JSON.parse(response.body);

  assert.equal(response.statusCode, 400);
  assert.equal(data.error, 'Month label is required');
});

test('handleApiRequest rejects malformed bill JSON', async () => {
  const response = createResponse();
  await handleApiRequest(
    createRequest({ method: 'POST', url: '/api/bills', rawBody: '{' }),
    response,
  );
  const data = JSON.parse(response.body);

  assert.equal(response.statusCode, 400);
  assert.equal(data.error, 'Invalid JSON');
});

test('handleApiRequest rejects malformed account update JSON', async () => {
  const response = createResponse();
  await handleApiRequest(
    createRequest({ method: 'PATCH', url: '/api/accounts/1', rawBody: '{' }),
    response,
  );
  const data = JSON.parse(response.body);

  assert.equal(response.statusCode, 400);
  assert.equal(data.error, 'Invalid JSON');
});

test('handleApiRequest validates budget update payloads', async () => {
  const response = createResponse();
  await handleApiRequest(
    createRequest({ method: 'PATCH', url: '/api/spending-categories/1', body: { budget: 'nope' } }),
    response,
  );
  const data = JSON.parse(response.body);

  assert.equal(response.statusCode, 400);
  assert.equal(data.error, 'Budget must be a number');
});

test('handleApiRequest returns 404 for missing budget category ids', async () => {
  const response = createResponse();
  await handleApiRequest(
    createRequest({ method: 'PATCH', url: '/api/spending-categories/999999', body: { budget: 123.45 } }),
    response,
  );
  const data = JSON.parse(response.body);

  assert.equal(response.statusCode, 404);
  assert.equal(data.error, 'Budget category not found');
});

test('handleApiRequest returns 404 for missing goal ids', async () => {
  const response = createResponse();
  await handleApiRequest(
    createRequest({
      method: 'PATCH',
      url: '/api/goals/999999',
      body: {
        ownerSlug: 'john',
        name: 'Missing goal',
        currentAmount: 0,
        targetAmount: 10,
        color: '#1F7A4D',
        targetLabel: 'by December',
      },
    }),
    response,
  );
  const data = JSON.parse(response.body);

  assert.equal(response.statusCode, 404);
  assert.equal(data.error, 'Goal not found');
});

test('handleApiRequest validates debt insert payloads', async () => {
  const response = createResponse();
  await handleApiRequest(
    createRequest({
      method: 'POST',
      url: '/api/debts',
      body: {
        name: '',
        paid: 0,
        total: 1000,
        apr: 5,
        pmt: 25,
        end: 'May 2026',
      },
    }),
    response,
  );
  const data = JSON.parse(response.body);

  assert.equal(response.statusCode, 400);
  assert.equal(data.error, 'Debt name is required');
});

test('handleApiRequest rejects malformed debt JSON', async () => {
  const response = createResponse();
  await handleApiRequest(
    createRequest({ method: 'POST', url: '/api/debts', rawBody: '{' }),
    response,
  );
  const data = JSON.parse(response.body);

  assert.equal(response.statusCode, 400);
  assert.equal(data.error, 'Invalid JSON');
});

test('handleApiRequest returns 404 for missing debt ids', async () => {
  const response = createResponse();
  await handleApiRequest(
    createRequest({
      method: 'PATCH',
      url: '/api/debts/999999',
      body: {
        name: 'Missing debt',
        paid: 0,
        total: 1000,
        apr: 5,
        pmt: 25,
        end: 'May 2026',
        revolving: false,
      },
    }),
    response,
  );
  const data = JSON.parse(response.body);

  assert.equal(response.statusCode, 404);
  assert.equal(data.error, 'Debt not found');
});

test('handleApiRequest validates bill status payloads', async () => {
  const response = createResponse();
  await handleApiRequest(
    createRequest({ method: 'PATCH', url: '/api/bills/1/status', body: { status: '' } }),
    response,
  );
  const data = JSON.parse(response.body);

  assert.equal(response.statusCode, 400);
  assert.equal(data.error, 'Status is required');
});

test('handleApiRequest returns 404 for missing bill ids', async () => {
  const response = createResponse();
  await handleApiRequest(
    createRequest({
      method: 'PATCH',
      url: '/api/bills/999999',
      body: {
        memberSlug: 'john',
        monthLabel: 'May',
        dayOfMonth: 14,
        name: 'Missing bill',
        subtitle: '',
        amount: 25,
        isSoon: true,
        status: 'upcoming',
      },
    }),
    response,
  );
  const data = JSON.parse(response.body);

  assert.equal(response.statusCode, 404);
  assert.equal(data.error, 'Bill not found');
});

test('handleApiRequest inserts a debt and can clean it up', async () => {
  const name = `Test Debt ${Date.now()}`;
  let debtId = null;

  try {
    const response = createResponse();
    await handleApiRequest(
      createRequest({
        method: 'POST',
        url: '/api/debts',
        body: {
          name,
          paid: 12.34,
          total: 1200,
          apr: 7.5,
          pmt: 45.67,
          end: 'Jun 2027',
          revolving: false,
        },
      }),
      response,
    );
    const data = JSON.parse(response.body);
    debtId = data.debt.id;

    assert.equal(response.statusCode, 201);
    assert.equal(data.debt.name, name);
    assert.equal(data.debt.paid, 12.34);
    assert.equal(data.debt.total, 1200);
  } finally {
    if (debtId) {
      await withClient(getAppConnectionString(), async (client) => {
        await client.query('delete from debts where id = $1', [debtId]);
      });
    }
  }
});

test('handleApiRequest updates a debt and can restore it', async () => {
  const dashboard = await getDashboardData();
  const debt = dashboard.debts[0];
  const nextPaid = Number((debt.paid + 25).toFixed(2));
  const nextPmt = Number((debt.pmt + 5).toFixed(2));

  try {
    const response = createResponse();
    await handleApiRequest(
      createRequest({
        method: 'PATCH',
        url: `/api/debts/${debt.id}`,
        body: {
          name: `${debt.name} Updated`,
          paid: nextPaid,
          total: debt.total,
          apr: debt.apr,
          pmt: nextPmt,
          end: debt.end,
          revolving: debt.revolving,
        },
      }),
      response,
    );
    const data = JSON.parse(response.body);

    assert.equal(response.statusCode, 200);
    assert.equal(data.debt.id, debt.id);
    assert.equal(data.debt.name, `${debt.name} Updated`);
    assert.equal(data.debt.paid, nextPaid);
    assert.equal(data.debt.pmt, nextPmt);

    const changedDashboard = await getDashboardData();
    const changedDebt = changedDashboard.debts.find((item) => item.id === debt.id);
    assert.equal(changedDebt.name, `${debt.name} Updated`);
    assert.equal(changedDebt.paid, nextPaid);
  } finally {
    const restoreResponse = createResponse();
    await handleApiRequest(
      createRequest({
        method: 'PATCH',
        url: `/api/debts/${debt.id}`,
        body: {
          name: debt.name,
          paid: debt.paid,
          total: debt.total,
          apr: debt.apr,
          pmt: debt.pmt,
          end: debt.end,
          revolving: debt.revolving,
        },
      }),
      restoreResponse,
    );
  }
});

test('handleApiRequest updates a budget and can restore it', async () => {
  const dashboard = await getDashboardData();
  const category = dashboard.spending[0];
  const nextBudget = Number((category.budget + 25).toFixed(2));

  try {
    const updateResponse = createResponse();
    const handled = await handleApiRequest(
      createRequest({ method: 'PATCH', url: `/api/spending-categories/${category.id}`, body: { budget: nextBudget } }),
      updateResponse,
    );
    const updateData = JSON.parse(updateResponse.body);

    assert.equal(handled, true);
    assert.equal(updateResponse.statusCode, 200);
    assert.equal(updateData.spendingCategory.id, category.id);
    assert.equal(updateData.spendingCategory.budget, nextBudget);

    const changedDashboard = await getDashboardData();
    const changedCategory = changedDashboard.spending.find((item) => item.id === category.id);
    assert.equal(changedCategory.budget, nextBudget);
  } finally {
    const restoreResponse = createResponse();
    await handleApiRequest(
      createRequest({ method: 'PATCH', url: `/api/spending-categories/${category.id}`, body: { budget: category.budget } }),
      restoreResponse,
    );
  }
});

test('handleApiRequest inserts a goal and can clean it up', async () => {
  const name = `Test Goal ${Date.now()}`;
  let goalId = null;

  try {
    const response = createResponse();
    await handleApiRequest(
      createRequest({
        method: 'POST',
        url: '/api/goals',
        body: {
          ownerSlug: 'john',
          name,
          currentAmount: 25,
          targetAmount: 100,
          color: '#1F7A4D',
          targetLabel: 'by June',
        },
      }),
      response,
    );
    const data = JSON.parse(response.body);
    goalId = data.goal.id;

    assert.equal(response.statusCode, 201);
    assert.equal(data.goal.name, name);
    assert.equal(data.goal.current, 25);
    assert.equal(data.goal.target, 100);
    assert.equal(data.goal.ownerSlug, 'john');
  } finally {
    if (goalId) {
      await withClient(getAppConnectionString(), async (client) => {
        await client.query('delete from goals where id = $1', [goalId]);
      });
    }
  }
});

test('handleApiRequest inserts a bill and can clean it up', async () => {
  const name = `Test Bill ${Date.now()}`;
  let billId = null;

  try {
    const response = createResponse();
    await handleApiRequest(
      createRequest({
        method: 'POST',
        url: '/api/bills',
        body: {
          memberSlug: 'john',
          monthLabel: 'May',
          dayOfMonth: 17,
          name,
          subtitle: 'Utilities',
          amount: 88.12,
          isSoon: true,
          status: 'upcoming',
        },
      }),
      response,
    );
    const data = JSON.parse(response.body);
    billId = data.bill.id;

    assert.equal(response.statusCode, 201);
    assert.equal(data.bill.name, name);
    assert.equal(data.bill.amount, 88.12);
    assert.equal(data.bill.memberSlug, 'john');
    assert.equal(data.bill.status, 'upcoming');
  } finally {
    if (billId) {
      await withClient(getAppConnectionString(), async (client) => {
        await client.query('delete from bills where id = $1', [billId]);
      });
    }
  }
});

test('handleApiRequest updates a bill and can restore it', async () => {
  const dashboard = await getDashboardData();
  const bill = dashboard.bills[0];
  const nextAmount = Number((bill.amt + 10).toFixed(2));

  try {
    const response = createResponse();
    await handleApiRequest(
      createRequest({
        method: 'PATCH',
        url: `/api/bills/${bill.id}`,
        body: {
          memberSlug: bill.who,
          monthLabel: bill.date.m,
          dayOfMonth: bill.date.d,
          name: `${bill.name} Updated`,
          subtitle: bill.sub,
          amount: nextAmount,
          isSoon: bill.soon,
          status: bill.status,
        },
      }),
      response,
    );
    const data = JSON.parse(response.body);

    assert.equal(response.statusCode, 200);
    assert.equal(data.bill.id, bill.id);
    assert.equal(data.bill.name, `${bill.name} Updated`);
    assert.equal(data.bill.amount, nextAmount);

    const changedDashboard = await getDashboardData();
    const changedBill = changedDashboard.bills.find((item) => item.id === bill.id);
    assert.equal(changedBill.name, `${bill.name} Updated`);
    assert.equal(changedBill.amt, nextAmount);
  } finally {
    const restoreResponse = createResponse();
    await handleApiRequest(
      createRequest({
        method: 'PATCH',
        url: `/api/bills/${bill.id}`,
        body: {
          memberSlug: bill.who,
          monthLabel: bill.date.m,
          dayOfMonth: bill.date.d,
          name: bill.name,
          subtitle: bill.sub,
          amount: bill.amt,
          isSoon: bill.soon,
          status: bill.status,
        },
      }),
      restoreResponse,
    );
  }
});

test('handleApiRequest updates bill status and can restore it', async () => {
  const dashboard = await getDashboardData();
  const bill = dashboard.bills[0];

  try {
    const response = createResponse();
    await handleApiRequest(
      createRequest({ method: 'PATCH', url: `/api/bills/${bill.id}/status`, body: { status: 'paid' } }),
      response,
    );
    const data = JSON.parse(response.body);

    assert.equal(response.statusCode, 200);
    assert.equal(data.bill.id, bill.id);
    assert.equal(data.bill.status, 'paid');

    const changedDashboard = await getDashboardData();
    const changedBill = changedDashboard.bills.find((item) => item.id === bill.id);
    assert.equal(changedBill.status, 'paid');
  } finally {
    const restoreResponse = createResponse();
    await handleApiRequest(
      createRequest({
        method: 'PATCH',
        url: `/api/bills/${bill.id}/status`,
        body: { status: bill.status },
      }),
      restoreResponse,
    );
  }
});

test('handleApiRequest updates a goal and can restore it', async () => {
  const dashboard = await getDashboardData();
  const goal = dashboard.goals[0];
  const nextTarget = Number((goal.target + 50).toFixed(2));

  try {
    const response = createResponse();
    await handleApiRequest(
      createRequest({
        method: 'PATCH',
        url: `/api/goals/${goal.id}`,
        body: {
          ownerSlug: goal.owner,
          name: `${goal.name} Updated`,
          currentAmount: goal.current,
          targetAmount: nextTarget,
          color: goal.color,
          targetLabel: goal.by,
        },
      }),
      response,
    );
    const data = JSON.parse(response.body);

    assert.equal(response.statusCode, 200);
    assert.equal(data.goal.id, goal.id);
    assert.equal(data.goal.name, `${goal.name} Updated`);
    assert.equal(data.goal.target, nextTarget);

    const changedDashboard = await getDashboardData();
    const changedGoal = changedDashboard.goals.find((item) => item.id === goal.id);
    assert.equal(changedGoal.name, `${goal.name} Updated`);
    assert.equal(changedGoal.target, nextTarget);
  } finally {
    const restoreResponse = createResponse();
    await handleApiRequest(
      createRequest({
        method: 'PATCH',
        url: `/api/goals/${goal.id}`,
        body: {
          ownerSlug: goal.owner,
          name: goal.name,
          currentAmount: goal.current,
          targetAmount: goal.target,
          color: goal.color,
          targetLabel: goal.by,
        },
      }),
      restoreResponse,
    );
  }
});

test('handleApiRequest inserts a transaction and can clean it up', async () => {
  const merchant = `Test Transaction ${Date.now()}`;
  const todayGroup = (await getDashboardData()).transactions.find((group) => group.day.startsWith('Today · '));
  let transactionId = null;

  assert.ok(todayGroup);

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
          memberSlug: 'john',
          postedDate: todayGroup.date,
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
    assert.equal(data.transaction.postedDate, todayGroup.date);
    assert.equal(data.transaction.postedLabel, todayGroup.day);

    const dashboard = await getDashboardData();
    const insertedGroup = dashboard.transactions.find((group) => (
      group.items.some((item) => item.merch === merchant)
    ));

    assert.equal(insertedGroup.date, todayGroup.date);
    assert.equal(insertedGroup.day, todayGroup.day);
  } finally {
    if (transactionId) {
      await withClient(getAppConnectionString(), async (client) => {
        await client.query('delete from transactions where id = $1', [transactionId]);
      });
    }
  }
});

test('handleApiRequest updates an inserted transaction and can restore cleanup', async () => {
  const merchant = `Update Test ${Date.now()}`;
  let transactionId = null;

  try {
    const insertResponse = createResponse();
    await handleApiRequest(
      createRequest({
        method: 'POST',
        url: '/api/transactions',
        body: {
          merchant,
          category: 'Groceries',
          amount: 9.99,
          memberSlug: 'john',
          postedDate: '2026-05-11',
          postedLabel: 'Today',
          timeLabel: '10:15 PM',
          emoji: '🧪',
          isIncome: false,
        },
      }),
      insertResponse,
    );
    const insertData = JSON.parse(insertResponse.body);
    transactionId = insertData.transaction.id;

    const updateResponse = createResponse();
    await handleApiRequest(
      createRequest({
        method: 'PATCH',
        url: `/api/transactions/${transactionId}`,
        body: {
          merchant: `${merchant} Updated`,
          category: 'Dining out',
          amount: 12.34,
          memberSlug: 'stephanie',
          postedDate: '2026-05-10',
          postedLabel: 'Today',
          timeLabel: '10:22 PM',
          emoji: '☕',
          isIncome: true,
        },
      }),
      updateResponse,
    );
    const updateData = JSON.parse(updateResponse.body);

    assert.equal(updateResponse.statusCode, 200);
    assert.equal(updateData.transaction.id, transactionId);
    assert.equal(updateData.transaction.merchant, `${merchant} Updated`);
    assert.equal(updateData.transaction.amount, 12.34);
    assert.equal(updateData.transaction.isIncome, true);
    assert.equal(updateData.transaction.postedDate, '2026-05-10');

    const dashboard = await getDashboardData();
    const updatedGroup = dashboard.transactions.find((group) => (
      group.items.some((item) => item.id === transactionId)
    ));

    assert.ok(updatedGroup);
    assert.ok(updatedGroup.items.some((item) => item.merch === `${merchant} Updated`));
    assert.equal(updatedGroup.date, '2026-05-10');
  } finally {
    if (transactionId) {
      await withClient(getAppConnectionString(), async (client) => {
        await client.query('delete from transactions where id = $1', [transactionId]);
      });
    }
  }
});

test('handleApiRequest returns 404 for missing transaction ids', async () => {
  const response = createResponse();
  await handleApiRequest(
    createRequest({ method: 'DELETE', url: '/api/transactions/999999' }),
    response,
  );
  const data = JSON.parse(response.body);

  assert.equal(response.statusCode, 404);
  assert.equal(data.error, 'Transaction not found');
});

test('handleApiRequest returns 404 for missing transaction ids on update', async () => {
  const response = createResponse();
  await handleApiRequest(
    createRequest({
      method: 'PATCH',
      url: '/api/transactions/999999',
      body: {
        merchant: 'Missing',
        category: 'Groceries',
        amount: 1,
        memberSlug: 'john',
        postedLabel: 'Today',
        timeLabel: '9:00 AM',
        emoji: '🧪',
        isIncome: false,
      },
    }),
    response,
  );
  const data = JSON.parse(response.body);

  assert.equal(response.statusCode, 404);
  assert.equal(data.error, 'Transaction not found');
});

test('handleApiRequest preserves the current transaction date when editing amount only', async () => {
  const dashboard = await getDashboardData();
  const transaction = dashboard.transactions.flatMap((group) => group.items)[0];
  const nextAmount = Number((Math.abs(transaction.amt) + 2).toFixed(2));

  try {
    const response = createResponse();
    await handleApiRequest(
      createRequest({
        method: 'PATCH',
        url: `/api/transactions/${transaction.id}`,
        body: {
          merchant: transaction.merch,
          category: transaction.cat,
          memberSlug: '',
          postedLabel: transaction.postedLabel || 'Today',
          timeLabel: transaction.time,
          emoji: transaction.emoji,
          amount: nextAmount,
          isIncome: Boolean(transaction.income),
        },
      }),
      response,
    );
    const data = JSON.parse(response.body);

    assert.equal(response.statusCode, 200);
    assert.equal(data.transaction.id, transaction.id);
    assert.equal(data.transaction.amount, transaction.income ? nextAmount : -nextAmount);
    assert.equal(data.transaction.postedDate, transaction.postedDate);
  } finally {
    const restoreResponse = createResponse();
    await handleApiRequest(
      createRequest({
        method: 'PATCH',
        url: `/api/transactions/${transaction.id}`,
        body: {
          merchant: transaction.merch,
          category: transaction.cat,
          memberSlug: transaction.who,
          postedDate: transaction.postedDate,
          postedLabel: transaction.postedLabel || 'Today',
          timeLabel: transaction.time,
          emoji: transaction.emoji,
          amount: Math.abs(transaction.amt),
          isIncome: Boolean(transaction.income),
        },
      }),
      restoreResponse,
    );
  }
});

test('handleApiRequest inserts an account and can clean it up', async () => {
  const name = `Test Account ${Date.now()}`;
  let accountId = null;

  try {
    const response = createResponse();
    await handleApiRequest(
      createRequest({
        method: 'POST',
        url: '/api/accounts',
        body: {
          accountGroup: 'Cash',
          name,
          subtitle: 'Autotest',
          icon: 'Vault',
          balance: 123.45,
          ownerSlug: 'john',
        },
      }),
      response,
    );
    const data = JSON.parse(response.body);
    accountId = data.account.id;

    assert.equal(response.statusCode, 201);
    assert.equal(data.account.name, name);
    assert.equal(data.account.accountGroup, 'Cash');
    assert.equal(data.account.balance, 123.45);

    const dashboard = await getDashboardData();
    const insertedAccount = dashboard.accounts.flatMap((group) => group.items).find((item) => item.name === name);
    assert.equal(insertedAccount.name, name);
  } finally {
    if (accountId) {
      await withClient(getAppConnectionString(), async (client) => {
        await client.query('delete from accounts where id = $1', [accountId]);
      });
    }
  }
});

test('handleApiRequest updates an inserted account and can restore cleanup', async () => {
  const name = `Update Account ${Date.now()}`;
  let accountId = null;

  try {
    const insertResponse = createResponse();
    await handleApiRequest(
      createRequest({
        method: 'POST',
        url: '/api/accounts',
        body: {
          accountGroup: 'Cash',
          name,
          subtitle: 'Autotest',
          icon: 'Vault',
          balance: 99.99,
          ownerSlug: 'john',
        },
      }),
      insertResponse,
    );
    const insertData = JSON.parse(insertResponse.body);
    accountId = insertData.account.id;

    const updateResponse = createResponse();
    await handleApiRequest(
      createRequest({
        method: 'PATCH',
        url: `/api/accounts/${accountId}`,
        body: {
          accountGroup: 'Credit',
          name: `${name} Updated`,
          subtitle: 'Changed',
          icon: 'Card',
          balance: -12.34,
          ownerSlug: 'stephanie',
        },
      }),
      updateResponse,
    );
    const updateData = JSON.parse(updateResponse.body);

    assert.equal(updateResponse.statusCode, 200);
    assert.equal(updateData.account.id, accountId);
    assert.equal(updateData.account.name, `${name} Updated`);
    assert.equal(updateData.account.accountGroup, 'Credit');
    assert.equal(updateData.account.balance, -12.34);

    const dashboard = await getDashboardData();
    const updatedAccount = dashboard.accounts.flatMap((group) => group.items).find((item) => item.id === accountId);
    assert.equal(updatedAccount.name, `${name} Updated`);
  } finally {
    if (accountId) {
      await withClient(getAppConnectionString(), async (client) => {
        await client.query('delete from accounts where id = $1', [accountId]);
      });
    }
  }
});

test('handleApiRequest returns 404 for missing account ids on update', async () => {
  const response = createResponse();
  await handleApiRequest(
    createRequest({
      method: 'PATCH',
      url: '/api/accounts/999999',
      body: {
        accountGroup: 'Cash',
        name: 'Missing',
        subtitle: '',
        icon: 'Bank',
        balance: 0,
        ownerSlug: 'john',
      },
    }),
    response,
  );
  const data = JSON.parse(response.body);

  assert.equal(response.statusCode, 404);
  assert.equal(data.error, 'Account not found');
});

test('handleApiRequest imports an account and upserts the same external account', async () => {
  const externalAccountId = `plaid-account-${Date.now()}`;
  const externalItemId = `plaid-item-${Date.now()}`;

  try {
    const insertResponse = createResponse();
    await handleApiRequest(
      createRequest({
        method: 'POST',
        url: '/api/accounts/import',
        body: {
          provider: 'plaid',
          externalItemId,
          externalAccountId,
          accountGroup: 'Cash',
          name: 'Plaid Checking',
          subtitle: 'Imported via Plaid',
          icon: 'Bank',
          balance: 456.78,
          ownerSlug: 'john',
        },
      }),
      insertResponse,
    );
    const insertData = JSON.parse(insertResponse.body);

    assert.equal(insertResponse.statusCode, 201);
    assert.equal(insertData.account.externalProvider, 'plaid');
    assert.equal(insertData.account.externalAccountId, externalAccountId);
    assert.equal(insertData.account.syncStatus, 'synced');
    assert.equal(insertData.account.inserted, true);

    const updateResponse = createResponse();
    await handleApiRequest(
      createRequest({
        method: 'POST',
        url: '/api/accounts/import',
        body: {
          provider: 'plaid',
          externalItemId: `${externalItemId}-updated`,
          externalAccountId,
          accountGroup: 'Cash',
          name: 'Plaid Checking Updated',
          subtitle: 'Imported via Plaid again',
          icon: 'Vault',
          balance: 512.34,
          ownerSlug: 'john',
        },
      }),
      updateResponse,
    );
    const updateData = JSON.parse(updateResponse.body);

    assert.equal(updateResponse.statusCode, 200);
    assert.equal(updateData.account.externalProvider, 'plaid');
    assert.equal(updateData.account.externalAccountId, externalAccountId);
    assert.equal(updateData.account.syncStatus, 'synced');
    assert.equal(updateData.account.inserted, false);
    assert.equal(updateData.account.name, 'Plaid Checking Updated');
    assert.equal(updateData.account.balance, 512.34);

    const dashboard = await getDashboardData();
    const matchingAccounts = dashboard.accounts.flatMap((group) => group.items).filter((item) => item.externalAccountId === externalAccountId);

    assert.equal(matchingAccounts.length, 1);
    assert.equal(matchingAccounts[0].name, 'Plaid Checking Updated');
    assert.equal(matchingAccounts[0].externalProvider, 'plaid');
    assert.equal(matchingAccounts[0].syncStatus, 'synced');
    assert.ok(matchingAccounts[0].importedAt);
  } finally {
    await withClient(getAppConnectionString(), async (client) => {
      await client.query(
        'delete from accounts where external_provider = $1 and external_account_id = $2',
        ['plaid', externalAccountId],
      );
    });
  }
});

test('handleApiRequest validates imported account payloads', async () => {
  const response = createResponse();
  await handleApiRequest(
    createRequest({
      method: 'POST',
      url: '/api/accounts/import',
      body: {
        externalAccountId: 'plaid-account-1',
        accountGroup: 'Cash',
        name: 'Plaid Checking',
        balance: 456.78,
        ownerSlug: 'john',
      },
    }),
    response,
  );
  const data = JSON.parse(response.body);

  assert.equal(response.statusCode, 400);
  assert.equal(data.error, 'Provider is required');
});

test('handleApiRequest deletes an inserted transaction and can restore cleanup', async () => {
  const merchant = `Delete Test ${Date.now()}`;
  let transactionId = null;

  try {
    const insertResponse = createResponse();
    await handleApiRequest(
      createRequest({
        method: 'POST',
        url: '/api/transactions',
        body: {
          merchant,
          category: 'Groceries',
          amount: 7.89,
          memberSlug: 'john',
          postedLabel: 'Today',
          timeLabel: '11:07 PM',
          emoji: '🧪',
          isIncome: false,
        },
      }),
      insertResponse,
    );
    const insertData = JSON.parse(insertResponse.body);
    transactionId = insertData.transaction.id;

    const deleteResponse = createResponse();
    await handleApiRequest(
      createRequest({ method: 'DELETE', url: `/api/transactions/${transactionId}` }),
      deleteResponse,
    );
    const deleteData = JSON.parse(deleteResponse.body);

    assert.equal(deleteResponse.statusCode, 200);
    assert.equal(deleteData.transaction.id, transactionId);

    const dashboard = await getDashboardData();
    const deletedGroup = dashboard.transactions.find((group) => (
      group.items.some((item) => item.merch === merchant)
    ));
    assert.equal(deletedGroup, undefined);
  } finally {
    if (transactionId) {
      await withClient(getAppConnectionString(), async (client) => {
        await client.query('delete from transactions where id = $1', [transactionId]);
      });
    }
  }
});
