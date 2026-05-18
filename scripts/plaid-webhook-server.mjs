import { createServer } from 'node:http';
import { handlePlaidWebhookRequest } from './plaid-webhook-handler.mjs';

const host = process.env.PLAID_WEBHOOK_HOST || '127.0.0.1';
const port = Number(process.env.PLAID_WEBHOOK_PORT || 4010);

createServer(async (req, res) => {
  if (await handlePlaidWebhookRequest(req, res)) {
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
}).listen(port, host, () => {
  console.log(`Plaid webhook listener is running at http://${host}:${port}/api/plaid/webhook`);
});
