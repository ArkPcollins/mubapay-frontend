/** Money is integer kobo everywhere. Display only; never do arithmetic with floats. */
export function naira(kobo, { sign = false } = {}) {
  if (kobo == null || Number.isNaN(kobo)) return '—';
  const neg = kobo < 0;
  const abs = Math.abs(Math.trunc(kobo));
  const whole = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const k = abs % 100;
  return `${neg ? '−' : sign ? '+' : ''}₦${whole}${k ? `.${String(k).padStart(2, '0')}` : ''}`;
}

/** Parse what a user types ("1,500.50") into kobo exactly. Returns null if invalid. */
export function toKobo(input) {
  const s = String(input ?? '').replace(/[₦,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [w, f = ''] = s.split('.');
  return Number(w) * 100 + Number(f.padEnd(2, '0'));
}

const dtf = new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Lagos' });
const df = new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeZone: 'Africa/Lagos' });
export const dateTime = (d) => (d ? dtf.format(new Date(d)) : '—');
export const date = (d) => (d ? df.format(new Date(d)) : '—');
export const humanize = (s) => String(s || '').replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
export const qs = (o) => {
  const p = new URLSearchParams();
  Object.entries(o || {}).forEach(([k, v]) => v !== undefined && v !== '' && v !== null && p.set(k, v));
  const s = p.toString();
  return s ? `?${s}` : '';
};
