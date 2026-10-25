import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, get, post } from '../../lib/api';
import { humanize, qs } from '../../lib/format';
import { Button, ErrorState, Pagination, Select, Spinner, Table } from '../../components/ui';
import { toastError } from '../../components/ui/toast';

/** Paginated staff list with an optional status filter. */
export function AdminList({ queryKey, path, statuses, defaultStatus = '', columns, caption, empty, extraParams = {}, rowKey, children }) {
  const [status, setStatus] = useState(defaultStatus);
  const [page, setPage] = useState(1);
  const params = { ...extraParams, ...(status ? { status } : {}), page };
  const q = useQuery({ queryKey: [...queryKey, params], queryFn: () => get(`${path}${qs(params)}`), placeholderData: (prev) => prev });
  const rows = Array.isArray(q.data) ? q.data : q.data?.data;
  return (
    <div>
      {(statuses || children) && (
        <div className="mb-4 flex flex-wrap items-end gap-3">
          {statuses && <div className="w-56"><Select label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} options={statuses.map((s) => (typeof s === 'string' ? { value: s, label: s ? humanize(s) : 'All' } : s))} /></div>}
          {children}
        </div>
      )}
      {q.isLoading ? <Spinner /> : q.isError ? <ErrorState error={q.error} onRetry={q.refetch} /> : <Table caption={caption} rows={rows} columns={columns} empty={empty} rowKey={rowKey} />}
      <Pagination meta={q.data?.meta} onPage={setPage} />
    </div>
  );
}

/** Opens a private document through a short-lived, audited download token. */
export function DocumentButton({ doc }) {
  const [busy, setBusy] = useState(false);
  const open = async () => {
    setBusy(true);
    const w = window.open('', '_blank');
    if (w) w.opener = null;
    try {
      const { token } = await post(`/account/documents/${doc.id}/access`);
      const res = await api(`/account/documents/download/${token}`, { raw: true });
      const url = URL.createObjectURL(await res.blob());
      if (w) w.location.href = url;
      else window.location.assign(url);
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      w?.close();
      toastError(e);
    } finally {
      setBusy(false);
    }
  };
  return <Button size="sm" variant="secondary" loading={busy} onClick={open}>{humanize(doc.category)}</Button>;
}

export const who = (u) => (u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email : '—');
