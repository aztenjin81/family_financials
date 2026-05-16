import { getDashboardData } from './dashboard-query.mjs';

export async function handleApiRequest(req, res) {
  const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);

  if (url.pathname !== '/api/dashboard') {
    return false;
  }

  try {
    const data = await getDashboardData();
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify(data));
  } catch (error) {
    res.writeHead(500, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify({ error: error.message }));
  }

  return true;
}
