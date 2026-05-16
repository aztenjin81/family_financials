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
  const response = createResponse();
  await handleApiRequest(
    createRequest({ method: 'PATCH', url: '/api/transactions/1', body: { merchant: '', amount: 'bad' } }),
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
