export function getApiRequestUrls(path, origin = globalThis.location?.origin) {
  const urls = [path];

  if (!origin) {
    return urls;
  }

  const current = new URL(origin);
  const isLocal = current.hostname === 'localhost' || current.hostname === '127.0.0.1';

  if (isLocal && current.port !== '8787') {
    urls.push(`http://127.0.0.1:8787${path}`);
  }

  return urls;
}

async function parseJsonResponse(response, path) {
  const contentType = response.headers.get('content-type') || '';

  if (!contentType.includes('application/json')) {
    throw new Error(`API returned ${contentType || 'unknown content'} for ${path}`);
  }

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || `API returned ${response.status} for ${path}`);
  }

  return payload;
}

export async function requestJson(path, options = {}) {
  const urls = getApiRequestUrls(path);
  const errors = [];

  for (const url of urls) {
    try {
      const response = await fetch(url, options);
      return await parseJsonResponse(response, path);
    } catch (error) {
      errors.push(error);
    }
  }

  throw new Error(errors.at(-1)?.message || `API request failed for ${path}`);
}
