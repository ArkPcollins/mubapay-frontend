import { forwardRef, useId } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Clock, Info, Loader2, XCircle, CircleDot, Inbox } from 'lucide-react';
import { humanize, naira } from '../../lib/format';

export function cx(...a) {
  return a.filter(Boolean).join(' ');
}

const BTN = {
  primary: 'bg-palm text-palm-ink hover:brightness-110 disabled:opacity-50',
  secondary: 'border border-line bg-surface text-ink hover:border-ink/40 disabled:opacity-50',
  ghost: 'text-ink hover:bg-ink/5 disabled:opacity-50',
  danger: 'bg-danger text-white hover:brightness-110 disabled:opacity-50',
};

export const Button = forwardRef(function Button({ variant = 'primary', size = 'md', loading, children, className, to, href, ...rest }, ref) {
  const cls = cx('inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-[filter,border-color,background-color] focus-visible:outline-palm', size === 'sm' ? 'min-h-[36px] px-3 text-sm' : 'min-h-[44px] px-4', BTN[variant], className);
  const content = (
    <>
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </>
  );
  if (to) return <Link ref={ref} to={to} className={cls} {...rest}>{content}</Link>;
  if (href) return <a ref={ref} href={href} className={cls} {...rest}>{content}</a>;
  return (
    <button ref={ref} className={cls} disabled={loading || rest.disabled} aria-busy={loading || undefined} {...rest}>
      {content}
    </button>
  );
});

/** Accessible field wrapper: label, hint, and error wired with aria attributes. */
export function Field({ label, hint, error, children, required, className }) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const child = typeof children === 'function' ? children({ id, 'aria-describedby': [hintId, errId].filter(Boolean).join(' ') || undefined, 'aria-invalid': error ? true : undefined }) : children;
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="label">
          {label}
          {required && <span aria-hidden className="text-danger"> *</span>}
        </label>
      )}
      {child}
      {hint && !error && <p id={hintId} className="hint">{hint}</p>}
      {error && (
        <p id={errId} role="alert" className="mt-1 flex items-center gap-1 text-sm font-medium text-danger">
          <XCircle className="h-4 w-4" aria-hidden /> {error}
        </p>
      )}
    </div>
  );
}

export const Input = forwardRef(function Input({ label, hint, error, required, className, ...props }, ref) {
  return (
    <Field label={label} hint={hint} error={error} required={required} className={className}>
      {(a) => <input ref={ref} className="field" required={required} {...a} {...props} />}
    </Field>
  );
});

export function Select({ label, hint, error, options, required, className, placeholder, ...props }) {
  return (
    <Field label={label} hint={hint} error={error} required={required} className={className}>
      {(a) => (
        <select className="field" required={required} {...a} {...props}>
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((o) => (typeof o === 'string' ? <option key={o} value={o}>{humanize(o)}</option> : <option key={o.value} value={o.value}>{o.label}</option>))}
        </select>
      )}
    </Field>
  );
}

export function Textarea({ label, hint, error, required, className, rows = 4, ...props }) {
  return (
    <Field label={label} hint={hint} error={error} required={required} className={className}>
      {(a) => <textarea className="field" rows={rows} required={required} {...a} {...props} />}
    </Field>
  );
}

export function Checkbox({ label, description, className, ...props }) {
  const id = useId();
  return (
    <div className={cx('flex items-start gap-3', className)}>
      <input id={id} type="checkbox" className="mt-1 h-5 w-5 rounded border-line accent-[rgb(var(--palm))]" {...props} />
      <label htmlFor={id} className="text-sm leading-6">
        <span className="font-medium">{label}</span>
        {description && <span className="block text-muted">{description}</span>}
      </label>
    </div>
  );
}

/** Status pill: icon + text so meaning never depends on colour alone. */
const TONES = {
  success: ['bg-palm-soft text-palm', CheckCircle2],
  pending: ['bg-warn-soft text-warn', Clock],
  danger: ['bg-danger-soft text-danger', XCircle],
  info: ['bg-ink/5 text-ink', Info],
  neutral: ['bg-ink/5 text-muted', CircleDot],
  gold: ['bg-kola-soft text-kola', CheckCircle2],
};
const STATUS_TONE = {
  success: 'success', completed: 'success', published: 'success', approved: 'success', active: 'success', paid: 'success', delivered: 'success', collected: 'success', settled: 'success', released: 'success', confirmed: 'success', executed: 'success', resolved: 'success', sent: 'success', matured: 'gold',
  pending: 'pending', pending_review: 'pending', pending_payment: 'pending', payment_processing: 'pending', processing: 'pending', requested: 'pending', proposed: 'pending', awaiting_payment: 'pending', held: 'pending', payout_processing: 'pending', manual_payout_pending: 'pending', settlement_pending: 'pending', in_transit: 'pending', booked: 'pending', dispatched: 'pending', open: 'pending', under_review: 'pending', pending_staff: 'pending', pending_customer: 'info', investigating: 'pending', uncertain: 'pending', payout_uncertain: 'pending', ready_for_collection: 'info', ready_for_dispatch: 'info', paused: 'pending', refund_requested: 'pending', partially_refunded: 'info', on_hold: 'pending',
  failed: 'danger', rejected: 'danger', cancelled: 'danger', declined: 'danger', reversed: 'danger', disputed: 'danger', amount_mismatch: 'danger', delivery_failed: 'danger', hidden: 'danger', closed_early: 'neutral', expired: 'neutral', abandoned: 'neutral', refunded: 'neutral', draft: 'neutral', archived: 'neutral', closed: 'neutral', missed: 'danger', no_show_customer: 'danger', no_show_provider: 'danger', critical: 'danger', warning: 'pending',
};
export function Status({ value, tone, children }) {
  const t = tone || STATUS_TONE[value] || 'neutral';
  const [cls, Icon] = TONES[t];
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold', cls)}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {children || humanize(value)}
    </span>
  );
}

export function Money({ kobo, className, sign }) {
  return <span className={cx('tnum', className)}>{naira(kobo, { sign })}</span>;
}

export function Spinner({ label = 'Loading' }) {
  return (
    <div role="status" className="flex items-center gap-2 py-8 text-muted">
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> <span>{label}…</span>
    </div>
  );
}

export function Skeleton({ className }) {
  return <div aria-hidden className={cx('animate-pulse rounded-lg bg-ink/10', className)} />;
}

export function EmptyState({ title, body, action }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-line p-6">
      <Inbox className="h-6 w-6 text-muted" aria-hidden />
      <div>
        <p className="font-semibold">{title}</p>
        {body && <p className="mt-1 max-w-prose text-sm text-muted">{body}</p>}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  const msg = error?.message || 'Something went wrong.';
  return (
    <div role="alert" className="flex flex-col gap-2 rounded-xl border border-danger/40 bg-danger-soft p-4 text-danger">
      <p className="flex items-center gap-2 font-semibold">
        <AlertTriangle className="h-5 w-5" aria-hidden /> {msg}
      </p>
      {error?.requestId && <p className="text-xs">Reference for support: {error.requestId}</p>}
      {onRetry && (
        <div>
          <Button variant="secondary" size="sm" onClick={onRetry}>Try again</Button>
        </div>
      )}
    </div>
  );
}

export function Notice({ tone = 'info', title, children }) {
  const map = { info: 'border-line bg-surface', warn: 'border-warn/40 bg-warn-soft', danger: 'border-danger/40 bg-danger-soft', success: 'border-palm/40 bg-palm-soft' };
  const Icon = { info: Info, warn: AlertTriangle, danger: XCircle, success: CheckCircle2 }[tone];
  return (
    <div className={cx('flex gap-3 rounded-xl border p-4', map[tone])}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <div className="text-sm">
        {title && <p className="font-semibold">{title}</p>}
        <div className={title ? 'mt-1' : ''}>{children}</div>
      </div>
    </div>
  );
}

export function Panel({ title, action, children, className }) {
  return (
    <section className={cx('panel p-4 sm:p-5', className)}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          {title && <h2 className="text-lg font-bold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function PageHeader({ title, description, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="page-title">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div role="tablist" className="mb-4 flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((t) => (
        <button key={t.value} role="tab" aria-selected={value === t.value} onClick={() => onChange(t.value)} className={cx('min-h-[44px] whitespace-nowrap border-b-2 px-3 text-sm font-semibold', value === t.value ? 'border-palm text-ink' : 'border-transparent text-muted hover:text-ink')}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Pagination({ meta, onPage }) {
  if (!meta || meta.pages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between gap-3 text-sm">
      <span className="text-muted">Page {meta.page} of {meta.pages}, {meta.total} results</span>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}>Previous</Button>
        <Button variant="secondary" size="sm" disabled={meta.page >= meta.pages} onClick={() => onPage(meta.page + 1)}>Next</Button>
      </div>
    </nav>
  );
}

/** Responsive table: horizontal scroll on small screens, semantic markup. */
export function Table({ columns, rows, empty, rowKey = (r) => r.id || r._id || r.reference, caption }) {
  if (!rows?.length) return empty || <EmptyState title="Nothing here yet" />;
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead className="bg-ink/[0.03] text-left">
          <tr>
            {columns.map((c) => (
              <th key={c.key || c.header} scope="col" className={cx('px-3 py-2.5 font-semibold text-muted', c.align === 'right' && 'text-right')}>{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={rowKey(r)} className="border-t border-line align-top">
              {columns.map((c) => (
                <td key={c.key || c.header} className={cx('px-3 py-2.5', c.align === 'right' && 'text-right tnum')}>{c.render ? c.render(r) : r[c.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function KeyValue({ items }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.filter(Boolean).map(([k, v]) => (
        <div key={k}>
          <dt className="text-sm text-muted">{k}</dt>
          <dd className="font-medium">{v ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}
