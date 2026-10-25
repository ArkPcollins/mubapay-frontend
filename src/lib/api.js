/**
 * API client.
 *  - Cookie sessions (httpOnly) + double-submit CSRF header on writes.
 *  - Transparent one-time refresh on 401, then retry.
 *  - Idempotency keys for financial POSTs (stable per user action).
 *  - Errors normalised to ApiError { status, code, message, details }.
 */
const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.error?.message || `Request failed (${status})`);
    this.status = status;
    this.code = body?.error?.code;
    this.details = body?.error?.details;
    this.requestId = body?.requestId;
  }
}

function csrf() {
  const m = document.cookie.match(/(?:^|; )mp_csrf=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : '';
}

export function newIdempotencyKey() {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return `ik_${Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}

let refreshing = null;
async function refresh() {
  refreshing = refreshing || fetch(`${BASE}/api/v1/auth/refresh`, { method: 'POST', credentials: 'include', headers: { 'x-csrf-token': csrf() } }).finally(() => setTimeout(() => (refreshing = null), 0));
  const r = await refreshing;
  return r.ok;
}

async function ensureCsrf() {
  if (!csrf()) await fetch(`${BASE}/api/v1/health`, { credentials: 'include' }).catch(() => {});
}

export async function api(path, { method = 'GET', body, idempotencyKey, raw = false, form, retry = true, signal } = {}) {
  const headers = {};
  if (method !== 'GET') {
    await ensureCsrf();
    headers['x-csrf-token'] = csrf();
  }
  if (body !== undefined && !form) headers['content-type'] = 'application/json';
  if (idempotencyKey) headers['idempotency-key'] = idempotencyKey;
  const res = await fetch(`${BASE}/api/v1${path}`, { method, headers, credentials: 'include', body: form || (body !== undefined ? JSON.stringify(body) : undefined), signal });
  if (res.status === 401 && retry && !path.startsWith('/auth/login') && !path.startsWith('/auth/refresh')) {
    if (await refresh()) return api(path, { method, body, idempotencyKey, raw, form, retry: false, signal });
  }
  if (raw) {
    if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => ({})));
    return res;
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) throw new ApiError(res.status, json);
  return json.meta ? { data: json.data, meta: json.meta } : json.data;
}

export const get = (p, o) => api(p, o);
export const post = (p, body, o = {}) => api(p, { ...o, method: 'POST', body });
export const patch = (p, body, o = {}) => api(p, { ...o, method: 'PATCH', body });
export const put = (p, body, o = {}) => api(p, { ...o, method: 'PUT', body });
export const del = (p, o = {}) => api(p, { ...o, method: 'DELETE' });

/** Download a file endpoint (statements, exports) through the authenticated session. */
export async function download(path, filename) {
  const res = await api(path, { raw: true });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const apiBase = BASE;
