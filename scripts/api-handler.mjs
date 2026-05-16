import { getDashboardData } from './dashboard-query.mjs';
import { updateSpendingBudget } from './budget-commands.mjs';
import { addAccount, syncImportedAccount, updateAccount } from './account-commands.mjs';
import { updateChoreDone } from './chore-commands.mjs';
import { addTransaction, deleteTransaction, updateTransaction } from './transaction-commands.mjs';

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-cache',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PATCH, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(body));
}

async function readJsonBody(req) {
  let body = '';

  for await (const chunk of req) {
    body += chunk;
  }

  if (!body) {
    return {};
  }

  try {
    return JSON.parse(body);
  } catch {
    const error = new Error('Invalid JSON');
    error.statusCode = 400;
    throw error;
  }
}

export async function handleApiRequest(req, res) {
  const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);

  if (!url.pathname.startsWith('/api/')) {
    return false;
  }

  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return true;
  }

  try {
    if (url.pathname === '/api/dashboard' && (!req.method || req.method === 'GET')) {
      sendJson(res, 200, await getDashboardData());
      return true;
    }

    const choreMatch = url.pathname.match(/^\/api\/chores\/(\d+)$/);
    if (choreMatch && req.method === 'PATCH') {
      const payload = await readJsonBody(req);

      if (typeof payload.done !== 'boolean') {
        sendJson(res, 400, { error: '`done` must be a boolean' });
        return true;
      }

      const chore = await updateChoreDone(Number(choreMatch[1]), payload.done);

      if (!chore) {
        sendJson(res, 404, { error: 'Chore not found' });
        return true;
      }

      sendJson(res, 200, { chore });
      return true;
    }

    if (url.pathname === '/api/transactions' && req.method === 'POST') {
      const payload = await readJsonBody(req);
      let transaction;
      try {
        transaction = await addTransaction(payload);
      } catch (error) {
        sendJson(res, 400, { error: error.message });
        return true;
      }

      sendJson(res, 201, { transaction });
      return true;
    }

    if (url.pathname === '/api/accounts' && req.method === 'POST') {
      const payload = await readJsonBody(req);
      let account;

      try {
        account = await addAccount(payload);
      } catch (error) {
        sendJson(res, 400, { error: error.message });
        return true;
      }

      sendJson(res, 201, { account });
      return true;
    }

    if (url.pathname === '/api/accounts/import' && req.method === 'POST') {
      const payload = await readJsonBody(req);
      let account;

      try {
        account = await syncImportedAccount(payload);
      } catch (error) {
        sendJson(res, 400, { error: error.message });
        return true;
      }

      sendJson(res, account.inserted ? 201 : 200, { account });
      return true;
    }

    const spendingMatch = url.pathname.match(/^\/api\/spending-categories\/(\d+)$/);
    if (spendingMatch && req.method === 'PATCH') {
      const payload = await readJsonBody(req);
      let spendingCategory;

      try {
        spendingCategory = await updateSpendingBudget(Number(spendingMatch[1]), payload);
      } catch (error) {
        sendJson(res, 400, { error: error.message });
        return true;
      }

      if (!spendingCategory) {
        sendJson(res, 404, { error: 'Budget category not found' });
        return true;
      }

      sendJson(res, 200, { spendingCategory });
      return true;
    }

    const accountMatch = url.pathname.match(/^\/api\/accounts\/(\d+)$/);
    if (accountMatch && req.method === 'PATCH') {
      const payload = await readJsonBody(req);
      let account;

      try {
        account = await updateAccount(Number(accountMatch[1]), payload);
      } catch (error) {
        sendJson(res, 400, { error: error.message });
        return true;
      }

      if (!account) {
        sendJson(res, 404, { error: 'Account not found' });
        return true;
      }

      sendJson(res, 200, { account });
      return true;
    }

    const transactionMatch = url.pathname.match(/^\/api\/transactions\/(\d+)$/);
    if (transactionMatch && req.method === 'PATCH') {
      const payload = await readJsonBody(req);
      let transaction;

      try {
        transaction = await updateTransaction(Number(transactionMatch[1]), payload);
      } catch (error) {
        sendJson(res, 400, { error: error.message });
        return true;
      }

      if (!transaction) {
        sendJson(res, 404, { error: 'Transaction not found' });
        return true;
      }

      sendJson(res, 200, { transaction });
      return true;
    }

    if (transactionMatch && req.method === 'DELETE') {
      const transaction = await deleteTransaction(Number(transactionMatch[1]));

      if (!transaction) {
        sendJson(res, 404, { error: 'Transaction not found' });
        return true;
      }

      sendJson(res, 200, { transaction });
      return true;
    }

    sendJson(res, 404, { error: 'Not found' });
  } catch (error) {
    sendJson(res, error.statusCode || 500, { error: error.message });
  }

  return true;
}
