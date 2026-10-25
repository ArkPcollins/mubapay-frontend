import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

const listeners = new Set();
let id = 0;

/** Fire a toast from anywhere: toast({ title, body, tone }) */
export function toast(t) {
  const item = { id: (id += 1), tone: 'info', ...t };
  listeners.forEach((l) => l(item));
}

export function Toaster() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const l = (t) => {
      setItems((s) => [...s.slice(-3), t]);
      setTimeout(() => setItems((s) => s.filter((x) => x.id !== t.id)), t.tone === 'danger' ? 9000 : 5000);
    };
    listeners.add(l);
    return () => listeners.delete(l);
  }, []);
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col items-end gap-2 sm:left-auto sm:w-96">
      {items.map((t) => (
        <div key={t.id} role={t.tone === 'danger' ? 'alert' : 'status'} className={`pointer-events-auto w-full rounded-xl border p-4 shadow-lg ${t.tone === 'danger' ? 'border-danger/50 bg-danger-soft' : t.tone === 'success' ? 'border-palm/50 bg-palm-soft' : 'border-line bg-surface'}`}>
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <p className="font-semibold">{t.title}</p>
              {t.body && <p className="mt-0.5 text-sm text-muted">{t.body}</p>}
            </div>
            <button aria-label="Dismiss" className="rounded p-1 hover:bg-ink/5" onClick={() => setItems((s) => s.filter((x) => x.id !== t.id))}>
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export const toastError = (e) => toast({ tone: 'danger', title: e?.message || 'Something went wrong', body: e?.details?.[0]?.message });
