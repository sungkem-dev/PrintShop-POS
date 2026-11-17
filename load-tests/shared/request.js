import http from 'k6/http';

export function sendRequest(profile) {
  const baseUrl = (__ENV.RATE_LIMIT_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
  const url = __ENV.RATE_LIMIT_URL || `${baseUrl}${profile.endpoint}`;
  const method = (__ENV.RATE_LIMIT_METHOD || profile.method).toUpperCase();
  const body = __ENV.RATE_LIMIT_BODY || profile.body || null;
  const headers = {
    Accept: 'application/json',
    ...(profile.headers || {}),
    ...parseHeaders(__ENV.RATE_LIMIT_HEADERS)
  };

  if (__ENV.RATE_LIMIT_TOKEN) {
    headers.Authorization = `Bearer ${__ENV.RATE_LIMIT_TOKEN}`;
  }

  if (body !== null && !headers['Content-Type'] && !headers['content-type']) {
    headers['Content-Type'] = 'application/json';
  }

  return http.request(method, url, body, {
    headers,
    responseCallback: http.expectedStatuses(profile.successStatus, 429),
    tags: { name: `rate-limit ${profile.feature} ${method}` }
  });
}

export function responseHeader(response, name) {
  const expectedName = name.toLowerCase();
  const entry = Object.entries(response.headers).find(
    ([headerName]) => headerName.toLowerCase() === expectedName
  );
  return entry ? entry[1] : undefined;
}

export function hasRateLimitHeaders(response) {
  const limit = rateLimitLimit(response);
  const remaining = Number(responseHeader(response, 'RateLimit-Remaining'));
  const reset = Number(responseHeader(response, 'RateLimit-Reset'));

  return Number.isFinite(limit) && limit > 0 &&
    Number.isFinite(remaining) && remaining >= 0 &&
    Number.isFinite(reset) && reset >= 0;
}

export function rateLimitLimit(response) {
  const match = /^\s*(\d+)/.exec(responseHeader(response, 'RateLimit-Limit') || '');
  return match ? Number(match[1]) : Number.NaN;
}

export function hasRetryAfter(response) {
  const retryAfter = responseHeader(response, 'Retry-After');
  if (!retryAfter) return false;

  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds)) return seconds > 0;

  const retryDate = Date.parse(retryAfter);
  return Number.isFinite(retryDate) && retryDate >= Date.now() - 1000;
}

function parseHeaders(value) {
  if (!value) return {};

  const parsed = JSON.parse(value);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('RATE_LIMIT_HEADERS must be a JSON object');
  }
  return parsed;
}
