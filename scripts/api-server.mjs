import { createServer } from 'node:http';
import { handleApiRequest } from './api-handler.mjs';

const host = process.env.API_HOST || '127.0.0.1';
const port = Number(process.env.API_PORT || 8787);

createServer(async (req, res) => {
  if (await handleApiRequest(req, res)) {
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
}).listen(port, host, () => {
  console.log(`Family Financials API is running at http://${host}:${port}/api/dashboard`);
});
