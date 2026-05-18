import { getDashboardData } from './dashboard-query.mjs';
import { updateSpendingBudget } from './budget-commands.mjs';
import { addBill, setBillStatus, updateBill } from './bill-commands.mjs';
import { payWeeklyAllowance, updateHouseholdAllowance, voidLatestAllowancePayment } from './allowance-commands.mjs';
import { addDebt, updateDebt } from './debt-commands.mjs';
import { addGoal, updateGoal } from './goal-commands.mjs';
import { addAccount, syncImportedAccount, updateAccount } from './account-commands.mjs';
import { createChore, deleteChore, updateChore, updateChoreDone } from './chore-commands.mjs';
import { addTransaction, deleteTransaction, updateTransaction } from './transaction-commands.mjs';
import { updateInvestmentHolding } from './investment-commands.mjs';
import {
  createPlaidLinkToken,
  createPlaidUpdateToken,
  exchangePlaidPublicToken,
  handlePlaidWebhook,
  reviewPlaidItemAccounts,
  syncPlaidData,
} from './plaid-commands.mjs';

const plaidSyncCooldowns = new Map();

function enforcePlaidSyncCooldown(householdId, windowMs = 5000) {
  const key = String(householdId);
  const now = Date.now();
  const last = plaidSyncCooldowns.get(key) || 0;

  if (now - last < windowMs) {
    const error = new Error('Please wait a few seconds before syncing Plaid again.');
    error.statusCode = 429;
    throw error;
  }

  plaidSyncCooldowns.set(key, now);
}

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

async function readTextBody(req) {
  let body = '';

  for await (const chunk of req) {
    body += chunk;
  }

  return body;
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

      const hasEditFields = payload.memberSlug != null || payload.member_slug != null || payload.label != null || payload.reward != null;
      const hasDoneField = payload.done != null;
      let chore;

      try {
        if (hasEditFields) {
          chore = await updateChore(Number(choreMatch[1]), payload);
        } else if (hasDoneField) {
          if (typeof payload.done !== 'boolean') {
            sendJson(res, 400, { error: '`done` must be a boolean' });
            return true;
          }

          chore = await updateChoreDone(Number(choreMatch[1]), payload.done);
        } else {
          sendJson(res, 400, { error: 'At least one chore field must be provided' });
          return true;
        }
      } catch (error) {
        sendJson(res, 400, { error: error.message });
        return true;
      }

      if (!chore) {
        sendJson(res, 404, { error: 'Chore not found' });
        return true;
      }

      sendJson(res, 200, { chore });
      return true;
    }

    if (choreMatch && req.method === 'DELETE') {
      const chore = await deleteChore(Number(choreMatch[1]));

      if (!chore) {
        sendJson(res, 404, { error: 'Chore not found' });
        return true;
      }

      sendJson(res, 200, { chore });
      return true;
    }

    if (url.pathname === '/api/chores' && req.method === 'POST') {
      const payload = await readJsonBody(req);
      let chore;

      try {
        chore = await createChore(payload);
      } catch (error) {
        sendJson(res, 400, { error: error.message });
        return true;
      }

      sendJson(res, 201, { chore });
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

    if (url.pathname === '/api/goals' && req.method === 'POST') {
      const payload = await readJsonBody(req);
      let goal;

      try {
        goal = await addGoal(payload);
      } catch (error) {
        sendJson(res, 400, { error: error.message });
        return true;
      }

      sendJson(res, 201, { goal });
      return true;
    }

    if (url.pathname === '/api/bills' && req.method === 'POST') {
      const payload = await readJsonBody(req);
      let bill;

      try {
        bill = await addBill(payload);
      } catch (error) {
        sendJson(res, 400, { error: error.message });
        return true;
      }

      sendJson(res, 201, { bill });
      return true;
    }

    if (url.pathname === '/api/household/allowance' && req.method === 'PATCH') {
      const payload = await readJsonBody(req);

      try {
        const result = await updateHouseholdAllowance(payload);
        sendJson(res, 200, result);
      } catch (error) {
        sendJson(res, error.statusCode || 400, { error: error.message });
      }

      return true;
    }

    if (url.pathname === '/api/allowance/pay-weekly' && req.method === 'POST') {
      try {
        const result = await payWeeklyAllowance();
        sendJson(res, 200, result);
      } catch (error) {
        sendJson(res, error.statusCode || 400, { error: error.message });
      }

      return true;
    }

    if (url.pathname === '/api/allowance/void-latest' && req.method === 'POST') {
      try {
        const result = await voidLatestAllowancePayment();
        sendJson(res, 200, result);
      } catch (error) {
        sendJson(res, error.statusCode || 400, { error: error.message });
      }

      return true;
    }

    if (url.pathname === '/api/plaid/link-token' && req.method === 'POST') {
      let linkToken;

      try {
        linkToken = await createPlaidLinkToken({ householdId: 1 });
      } catch (error) {
        sendJson(res, 503, { error: error.message });
        return true;
      }

      sendJson(res, 200, linkToken);
      return true;
    }

    if (url.pathname === '/api/plaid/exchange' && req.method === 'POST') {
      const payload = await readJsonBody(req);

      if (!String(payload.publicToken || '').trim()) {
        sendJson(res, 400, { error: 'Public token is required' });
        return true;
      }

      let result;

      try {
        result = await exchangePlaidPublicToken({
          householdId: 1,
          publicToken: payload.publicToken,
          selectedAccountIds: payload.selectedAccountIds || [],
          ownerSlug: payload.ownerSlug || 'john',
          institutionName: payload.institutionName || '',
          linkSessionId: payload.linkSessionId || '',
        });
      } catch (error) {
        sendJson(res, 400, { error: error.message });
        return true;
      }

      sendJson(res, 200, result);
      return true;
    }

    if (url.pathname === '/api/plaid/update-token' && req.method === 'POST') {
      const payload = await readJsonBody(req);

      if (!String(payload.itemId || '').trim()) {
        sendJson(res, 400, { error: 'Plaid item ID is required' });
        return true;
      }

      try {
        const result = await createPlaidUpdateToken({
          householdId: 1,
          itemId: payload.itemId,
        });

        sendJson(res, 200, result);
      } catch (error) {
        sendJson(res, 400, { error: error.message });
      }

      return true;
    }

    if (url.pathname === '/api/plaid/review' && req.method === 'POST') {
      const payload = await readJsonBody(req);

      if (!String(payload.itemId || '').trim()) {
        sendJson(res, 400, { error: 'Plaid item ID is required' });
        return true;
      }

      try {
        const result = await reviewPlaidItemAccounts({
          householdId: 1,
          itemId: payload.itemId,
        });
        sendJson(res, 200, result);
      } catch (error) {
        sendJson(res, error.statusCode || 400, { error: error.message });
      }

      return true;
    }

    if (url.pathname === '/api/plaid/webhook' && req.method === 'POST') {
      const body = await readTextBody(req);
      const signedWebhook = req.headers['plaid-verification'];

      if (!String(signedWebhook || '').trim()) {
        sendJson(res, 400, { error: 'Plaid verification header is required' });
        return true;
      }

      try {
        const result = await handlePlaidWebhook({
          body,
          signedWebhook,
          householdId: 1,
        });

        sendJson(res, 200, result);
      } catch (error) {
        sendJson(res, error.statusCode || 400, { error: error.message });
      }

      return true;
    }

    if (url.pathname === '/api/plaid/sync' && req.method === 'POST') {
      const payload = await readJsonBody(req);

      try {
        enforcePlaidSyncCooldown(1);
        const result = await syncPlaidData({
          householdId: 1,
          itemId: payload.itemId || null,
        });
        sendJson(res, 200, result);
      } catch (error) {
        sendJson(res, error.statusCode || 400, { error: error.message });
      }

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

    const goalMatch = url.pathname.match(/^\/api\/goals\/(\d+)$/);
    if (goalMatch && req.method === 'PATCH') {
      const payload = await readJsonBody(req);
      let goal;

      try {
        goal = await updateGoal(Number(goalMatch[1]), payload);
      } catch (error) {
        sendJson(res, 400, { error: error.message });
        return true;
      }

      if (!goal) {
        sendJson(res, 404, { error: 'Goal not found' });
        return true;
      }

      sendJson(res, 200, { goal });
      return true;
    }

    if (url.pathname === '/api/debts' && req.method === 'POST') {
      const payload = await readJsonBody(req);
      let debt;

      try {
        debt = await addDebt(payload);
      } catch (error) {
        sendJson(res, 400, { error: error.message });
        return true;
      }

      sendJson(res, 201, { debt });
      return true;
    }

    const debtMatch = url.pathname.match(/^\/api\/debts\/(\d+)$/);
    if (debtMatch && req.method === 'PATCH') {
      const payload = await readJsonBody(req);
      let debt;

      try {
        debt = await updateDebt(Number(debtMatch[1]), payload);
      } catch (error) {
        sendJson(res, 400, { error: error.message });
        return true;
      }

      if (!debt) {
        sendJson(res, 404, { error: 'Debt not found' });
        return true;
      }

      sendJson(res, 200, { debt });
      return true;
    }

    const holdingMatch = url.pathname.match(/^\/api\/investments\/(\d+)$/);
    if (holdingMatch && req.method === 'PATCH') {
      const payload = await readJsonBody(req);
      let holding;

      try {
        holding = await updateInvestmentHolding(Number(holdingMatch[1]), payload);
      } catch (error) {
        sendJson(res, 400, { error: error.message });
        return true;
      }

      if (!holding) {
        sendJson(res, 404, { error: 'Holding not found' });
        return true;
      }

      sendJson(res, 200, { holding });
      return true;
    }

    const billMatch = url.pathname.match(/^\/api\/bills\/(\d+)$/);
    if (billMatch && req.method === 'PATCH') {
      const payload = await readJsonBody(req);
      let bill;

      try {
        bill = await updateBill(Number(billMatch[1]), payload);
      } catch (error) {
        sendJson(res, 400, { error: error.message });
        return true;
      }

      if (!bill) {
        sendJson(res, 404, { error: 'Bill not found' });
        return true;
      }

      sendJson(res, 200, { bill });
      return true;
    }

    const billStatusMatch = url.pathname.match(/^\/api\/bills\/(\d+)\/status$/);
    if (billStatusMatch && req.method === 'PATCH') {
      const payload = await readJsonBody(req);

      if (!String(payload.status || '').trim()) {
        sendJson(res, 400, { error: 'Status is required' });
        return true;
      }

      let bill;

      try {
        bill = await setBillStatus(Number(billStatusMatch[1]), payload.status);
      } catch (error) {
        sendJson(res, 400, { error: error.message });
        return true;
      }

      if (!bill) {
        sendJson(res, 404, { error: 'Bill not found' });
        return true;
      }

      sendJson(res, 200, { bill });
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
