import { NextResponse } from 'next/server';

const DEFAULT_LIMIT = 60;
const WINDOW_MS = 60_000;
const CLEANUP_INTERVAL = 256;
const storeKey = Symbol.for('printshop-pos.rate-limits');
const store = globalThis[storeKey] || (globalThis[storeKey] = new Map());
let requestsSinceCleanup = 0;

export async function withRateLimit(request, scope, handler, limit = DEFAULT_LIMIT) {
  const now = Date.now();
  const clientIp = getClientIp(request);
  const key = `${scope}:${clientIp}`;
  let entry = store.get(key);

  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + WINDOW_MS };
  }

  if (++requestsSinceCleanup >= CLEANUP_INTERVAL) {
    removeExpiredEntries(now);
    requestsSinceCleanup = 0;
  }

  const resetInSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
  const headers = new Headers({
    'RateLimit-Limit': `${limit};w=${WINDOW_MS / 1000}`,
    'RateLimit-Remaining': String(Math.max(0, limit - entry.count)),
    'RateLimit-Reset': String(resetInSeconds)
  });

  if (entry.count >= limit) {
    headers.set('Retry-After', String(resetInSeconds));
    return NextResponse.json(
      { success: false, error: 'Terlalu banyak permintaan. Silakan coba lagi nanti.' },
      { status: 429, headers }
    );
  }

  entry.count += 1;
  store.set(key, entry);
  headers.set('RateLimit-Remaining', String(limit - entry.count));

  const response = await handler();
  headers.forEach((value, name) => response.headers.set(name, value));
  return response;
}

function getClientIp(request) {
  return request.ip || 'unknown';
}

function removeExpiredEntries(now) {
  for (const [key, entry] of store) {
    if (now >= entry.resetAt) {
      store.delete(key);
    }
  }
}
