import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { get } from '../../lib/api';
import { toKobo, naira } from '../../lib/format';
import { Checkbox, Field } from './index';

/** Naira text input: value/onChange carry the typed naira string. Convert with toKobo() on submit. */
export function MoneyInput({ label, value, onChange, hint, error, required, max }) {
  return (
    <Field label={label} hint={hint} error={error} required={required}>
      {(a) => (
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-semibold text-muted">₦</span>
          <input
            {...a}
            inputMode="decimal"
            autoComplete="off"
            className="field pl-8 tnum"
            value={value}
            onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ''))}
            aria-label={label}
            placeholder="0.00"
          />
          {max != null && <span className="sr-only">Maximum {naira(max)}</span>}
        </div>
      )}
    </Field>
  );
}
export { toKobo };

/** Naira input bound to integer kobo: value is kobo, onChange receives kobo (0 when empty or invalid). */
export function KoboInput({ value, onChange, ...rest }) {
  const fmt = (k) => (k ? String(k / 100) : '');
  const [text, setText] = useState(fmt(value));
  useEffect(() => {
    if ((toKobo(text) ?? 0) !== (value || 0)) setText(fmt(value));
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  return <MoneyInput {...rest} value={text} onChange={(t) => { setText(t); onChange(toKobo(t) ?? 0); }} error={rest.error || (text && toKobo(text) == null ? 'Enter an amount like 1500 or 1500.50' : undefined)} />;
}

/** Required policy acceptance checkboxes (current published versions). */
export function PolicyConsent({ slugs, accepted, onChange }) {
  const q = useQuery({ queryKey: ['legal'], queryFn: () => get('/legal'), staleTime: 10 * 60e3 });
  const docs = (q.data || []).filter((d) => slugs.includes(d.slug));
  const toggle = (d, on) => {
    const rest = accepted.filter((a) => a.slug !== d.slug);
    onChange(on ? [...rest, { slug: d.slug, version: d.version }] : rest);
  };
  return (
    <div className="space-y-2">
      {docs.map((d) => (
        <Checkbox
          key={d.slug}
          checked={accepted.some((a) => a.slug === d.slug && a.version === d.version)}
          onChange={(e) => toggle(d, e.target.checked)}
          label={<>I have read and accept the <Link className="link" to={`/legal/${d.slug}`} target="_blank">{d.title}</Link> (version {d.version})</>}
        />
      ))}
    </div>
  );
}

export const allAccepted = (slugs, accepted, docs) => slugs.every((s) => accepted.some((a) => a.slug === s)) || !docs;

export function FileField({ label, hint, name, accept = 'image/jpeg,image/png,image/webp,application/pdf', required, onChange }) {
  return (
    <Field label={label} hint={hint || 'JPEG, PNG, WEBP or PDF, up to 8MB.'} required={required}>
      {(a) => <input {...a} type="file" name={name} accept={accept} required={required} onChange={onChange} className="field file:mr-3 file:rounded-md file:border-0 file:bg-palm-soft file:px-3 file:py-1.5 file:font-semibold file:text-palm" />}
    </Field>
  );
}
