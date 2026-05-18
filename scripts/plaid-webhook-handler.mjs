import { handlePlaidWebhook } from './plaid-commands.mjs';

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-cache',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, plaid-verification',
  });
  res.end(JSON.stringify(body));
}

async function readTextBody(req) {
  let body = '';

  for await (const chunk of req) {
    body += chunk;
  }

  return body;
}

export async function handlePlaidWebhookRequest(req, res, { householdId = 1, env, fetchImpl } = {}) {
  const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);

  if (req.method === 'OPTIONS' && url.pathname === '/api/plaid/webhook') {
    sendJson(res, 204, {});
    return true;
  }

  if (req.method !== 'POST' || url.pathname !== '/api/plaid/webhook') {
    return false;
  }

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
      householdId,
      env,
      fetchImpl,
    });

    sendJson(res, 200, result);
  } catch (error) {
    sendJson(res, error.statusCode || 400, { error: error.message });
  }

  return true;
}
