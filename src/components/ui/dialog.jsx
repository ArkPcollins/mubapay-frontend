import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from './index';

/** Accessible modal built on <dialog> (native focus trap + Esc). */
export function Dialog({ open, onClose, title, children, footer, wide }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="dlg-title" className={`m-auto w-[calc(100%-2rem)] ${wide ? 'max-w-2xl' : 'max-w-lg'} rounded-2xl border border-line bg-surface p-0 text-ink backdrop:bg-ink/40`}>
      {open && (
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
            <h2 id="dlg-title" className="text-lg font-bold">{title}</h2>
            <button className="rounded p-1.5 hover:bg-ink/5" aria-label="Close" onClick={onClose}><X className="h-5 w-5" /></button>
          </div>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

/** Confirmation with an optional required reason (used for staff and financial actions). */
export function ConfirmDialog({ open, onClose, onConfirm, title, body, confirmLabel = 'Confirm', danger, requireReason, reasonLabel = 'Reason', loading }) {
  const [reason, setReason] = useState('');
  useEffect(() => {
    if (!open) setReason('');
  }, [open]);
  const tooShort = requireReason && reason.trim().length < 5;
  return (
    <Dialog open={open} onClose={onClose} title={title} footer={<>
      <Button variant="secondary" onClick={onClose}>Cancel</Button>
      <Button variant={danger ? 'danger' : 'primary'} loading={loading} disabled={tooShort} onClick={() => onConfirm(reason.trim())}>{confirmLabel}</Button>
    </>}>
      <div className="space-y-4">
        {body && <div className="text-sm leading-6">{body}</div>}
        {requireReason && (
          <div>
            <label className="label" htmlFor="confirm-reason">{reasonLabel}</label>
            <textarea id="confirm-reason" className="field" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
            <p className="hint">At least 5 characters. This is recorded in the audit log.</p>
          </div>
        )}
      </div>
    </Dialog>
  );
}
