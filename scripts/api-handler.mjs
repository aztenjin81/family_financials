import { getDashboardData } from './dashboard-query.mjs';
import { updateChoreDone } from './chore-commands.mjs';
import { addTransaction } from './transaction-commands.mjs';

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-cache',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PATCH, OPTIONS',
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

    sendJson(res, 404, { error: 'Not found' });
  } catch (error) {
    sendJson(res, error.statusCode || 500, { error: error.message });
  }

  return true;
}
