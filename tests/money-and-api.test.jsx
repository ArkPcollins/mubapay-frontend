import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { naira, toKobo, humanize, qs } from '../src/lib/format';
import { api, post, newIdempotencyKey, ApiError } from '../src/lib/api';

describe('money formatting (integer kobo only)', () => {
  it('formats kobo as naira without floating point', () => {
    expect(naira(0)).toBe('₦0');
    expect(naira(150050)).toBe('₦1,500.50');
    expect(naira(100000000)).toBe('₦1,000,000');
    expect(naira(-2500)).toBe('−₦25');
    expect(naira(5, { sign: true })).toBe('+₦0.05');
    expect(naira(null)).toBe('—');
  });
  it('parses typed naira into exact kobo', () => {
    expect(toKobo('1,500.50')).toBe(150050);
    expect(toKobo('₦ 20')).toBe(2000);
    expect(toKobo('0.1')).toBe(10);
    expect(toKobo('19.99')).toBe(1999); // 19.99 * 100 in floats is 1998.9999…
    expect(toKobo('1.234')).toBeNull();
    expect(toKobo('abc')).toBeNull();
    expect(toKobo('')).toBeNull();
    expect(toKobo('-5')).toBeNull();
  });
  it('humanises codes and builds query strings', () => {
    expect(humanize('pending_review')).toBe('Pending review');
    expect(qs({ a: 1, b: '', c: null, d: 'x y' })).toBe('?a=1&d=x+y');
    expect(qs({})).toBe('');
  });
});

describe('API client', () => {
  let calls;
  beforeEach(() => {
    calls = [];
    document.cookie = 'mp_csrf=tok123; path=/';
  });
  afterEach(() => vi.unstubAllGlobals());

  const respond = (status, body) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));

  it('sends the CSRF header and idempotency key on writes, with credentials', async () => {
    vi.stubGlobal('fetch', vi.fn((url, init) => { calls.push([url, init]); return respond(200, { success: true, data: { ok: 1 } }); }));
    const key = newIdempotencyKey();
    const r = await post('/wallet/transfers', { amountKobo: 100 }, { idempotencyKey: key });
    expect(r).toEqual({ ok: 1 });
    const [url, init] = calls[0];
    expect(url).toBe('/api/v1/wallet/transfers');
    expect(init.credentials).toBe('include');
    expect(init.headers['x-csrf-token']).toBe('tok123');
    expect(init.headers['idempotency-key']).toBe(key);
    expect(JSON.parse(init.body)).toEqual({ amountKobo: 100 });
  });

  it('generates distinct idempotency keys', () => {
    const a = newIdempotencyKey();
    expect(a).toMatch(/^ik_[0-9a-f]{32}$/);
    expect(newIdempotencyKey()).not.toBe(a);
  });

  it('refreshes once on 401 and retries the original request', async () => {
    let n = 0;
    vi.stubGlobal('fetch', vi.fn((url) => {
      calls.push(url);
      if (url.endsWith('/auth/refresh')) return respond(200, { success: true, data: {} });
      n += 1;
      return n === 1 ? respond(401, { success: false, error: { code: 'UNAUTHENTICATED', message: 'Sign in' } }) : respond(200, { success: true, data: { user: 1 } });
    }));
    expect(await api('/auth/me')).toEqual({ user: 1 });
    expect(calls).toEqual(['/api/v1/auth/me', '/api/v1/auth/refresh', '/api/v1/auth/me']);
  });

  it('normalises errors into ApiError with code and details', async () => {
    vi.stubGlobal('fetch', vi.fn(() => respond(422, { success: false, error: { code: 'VALIDATION_FAILED', message: 'Check the form', details: [{ path: 'amountKobo' }] }, requestId: 'r1' })));
    const err = await api('/wallet/fund', { method: 'POST', body: {} }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(422);
    expect(err.code).toBe('VALIDATION_FAILED');
    expect(err.details).toEqual([{ path: 'amountKobo' }]);
    expect(err.requestId).toBe('r1');
  });

  it('returns data and meta together for paginated responses', async () => {
    vi.stubGlobal('fetch', vi.fn(() => respond(200, { success: true, data: [1, 2], meta: { page: 1, pages: 3 } })));
    expect(await api('/wallet/transactions')).toEqual({ data: [1, 2], meta: { page: 1, pages: 3 } });
  });
});
