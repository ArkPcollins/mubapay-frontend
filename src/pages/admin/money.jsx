import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { get, patch, post } from '../../lib/api';
import { dateTime, humanize, naira } from '../../lib/format';
import { useSession } from '../../lib/session';
import { Button, EmptyState, ErrorState, Input, KeyValue, Notice, PageHeader, Panel, Pagination, Select, Spinner, Status, Table, Tabs, Textarea } from '../../components/ui';
import { ConfirmDialog, Dialog } from '../../components/ui/dialog';
import { KoboInput } from '../../components/ui/forms';
import { toast, toastError } from '../../components/ui/toast';
import { AdminList } from './shared';
import { ReasonApproval, useInitiateApproval } from './people';

// ---------------------------------------------------------------- withdrawals
export function WithdrawalsAdminPage() {
  const { can } = useSession();
  const qc = useQueryClient();
  const [dlg, setDlg] = useState(null);
  const [bankRef, setBankRef] = useState('');
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin-withdrawals'] });
  const act = useMutation({ mutationFn: ({ ref, path, body }) => post(`/admin/withdrawals/${ref}/${path}`, body || {}), onSuccess: (r) => { setDlg(null); setBankRef(''); refresh(); toast({ title: `Withdrawal ${humanize(r.status)}` }); }, onError: toastError });
  const dest = useQuery({ queryKey: ['withdrawal-dest', dlg?.w?.reference], queryFn: () => get(`/admin/withdrawals/${dlg.w.reference}/destination`), enabled: dlg?.kind === 'manual-confirm' || dlg?.kind === 'details', staleTime: 0, gcTime: 0 });
  return (
    <>
      <PageHeader title="Withdrawals" description="Every withdrawal is reviewed before money leaves. Funds stay reserved from the customer’s wallet until it’s paid or rejected." />
      <AdminList queryKey={['admin-withdrawals']} path="/admin/withdrawals" statuses={['pending_review', 'approved', 'payout_processing', 'payout_uncertain', 'manual_payout_pending', 'completed', 'rejected', 'failed', 'reversed', '']} defaultStatus="pending_review" caption="Withdrawals" empty={<EmptyState title="No withdrawals in this state" />} columns={[
        { header: 'Reference', render: (w) => <><span className="font-mono text-xs">{w.reference}</span><span className="block text-xs text-muted">{dateTime(w.createdAt)}</span></> },
        { header: 'Customer', render: (w) => <Link className="link" to={`/admin/users/${w.userId}`}>View</Link> },
        { header: 'Amount', render: (w) => <><strong>{naira(w.amountKobo)}</strong>{w.feeKobo ? <span className="block text-xs text-muted">+ {naira(w.feeKobo)} fee</span> : null}</> },
        { header: 'To', render: (w) => (w.destination ? <span className="text-sm">{w.destination.accountName}, {w.destination.bankName} ••{w.destination.accountNumberLast4}{w.destination.nameMatchStatus !== 'matched' && <span className="block text-xs text-danger">Name {humanize(w.destination.nameMatchStatus)}</span>}</span> : '—') },
        { header: 'Status', render: (w) => <><Status value={w.status} />{w.requiresDualApproval && <span className="block text-xs text-muted">Needs 2 approvals ({w.approvals?.length || 0} so far)</span>}{w.failureReason && <span className="block text-xs text-danger">{w.failureReason}</span>}</> },
        { header: '', render: (w) => (
          <div className="flex flex-wrap gap-1">
            {w.status === 'pending_review' && can('withdrawals.approve') && <><Button size="sm" onClick={() => setDlg({ kind: 'approve', w })}>Approve</Button><Button size="sm" variant="ghost" onClick={() => setDlg({ kind: 'reject', w })}>Reject</Button></>}
            {w.status === 'approved' && can('withdrawals.payout') && <><Button size="sm" onClick={() => setDlg({ kind: 'payout', w })}>Pay via Paystack</Button><Button size="sm" variant="secondary" onClick={() => setDlg({ kind: 'manual', w })}>Pay manually</Button></>}
            {['payout_processing', 'payout_uncertain'].includes(w.status) && can('withdrawals.payout') && <Button size="sm" variant="secondary" onClick={() => act.mutate({ ref: w.reference, path: 'check' })}>Check status with Paystack</Button>}
            {w.status === 'manual_payout_pending' && can('withdrawals.payout') && <><Button size="sm" onClick={() => setDlg({ kind: 'manual-confirm', w })}>Confirm sent</Button><Button size="sm" variant="ghost" onClick={() => setDlg({ kind: 'manual-failed', w })}>Mark failed</Button></>}
          </div>
        ) },
      ]} />
      <ConfirmDialog open={dlg?.kind === 'approve'} onClose={() => setDlg(null)} title={`Approve ${dlg ? naira(dlg.w.amountKobo) : ''}?`} body="Check the account name matches the customer and that nothing about this account is unusual. You cannot approve a withdrawal you requested." confirmLabel="Approve" loading={act.isPending} onConfirm={() => act.mutate({ ref: dlg.w.reference, path: 'approve' })} />
      <ConfirmDialog open={dlg?.kind === 'reject'} onClose={() => setDlg(null)} danger title="Reject this withdrawal?" body="The reserved funds go back to the customer’s wallet and they’re told why." requireReason confirmLabel="Reject" loading={act.isPending} onConfirm={(reason) => act.mutate({ ref: dlg.w.reference, path: 'reject', body: { reason } })} />
      <ConfirmDialog open={dlg?.kind === 'payout'} onClose={() => setDlg(null)} title="Send this payout through Paystack?" body="If Paystack’s answer is unclear, the withdrawal is marked uncertain and must be checked before anything else is done. Never pay it again manually while it’s uncertain." confirmLabel="Send payout" loading={act.isPending} onConfirm={() => act.mutate({ ref: dlg.w.reference, path: 'payout' })} />
      <ConfirmDialog open={dlg?.kind === 'manual'} onClose={() => setDlg(null)} title="Pay this withdrawal manually?" body="Use this when Paystack payouts aren’t available. You’ll make the transfer from the company bank account, then confirm it here with the bank reference." confirmLabel="Start manual payout" loading={act.isPending} onConfirm={() => act.mutate({ ref: dlg.w.reference, path: 'manual' })} />
      <Dialog open={dlg?.kind === 'manual-confirm'} onClose={() => setDlg(null)} title="Confirm the bank transfer was sent" footer={<><Button variant="secondary" onClick={() => setDlg(null)}>Cancel</Button><Button loading={act.isPending} disabled={bankRef.length < 4} onClick={() => act.mutate({ ref: dlg.w.reference, path: 'manual/confirm', body: { bankReference: bankRef } })}>Confirm paid</Button></>}>
        {dest.isLoading ? <Spinner /> : dest.isError ? <ErrorState error={dest.error} /> : dest.data && <KeyValue items={[['Amount to send', naira(dlg.w.amountKobo)], ['Bank', dest.data.bankName], ['Account number', <span key="n" className="font-mono">{dest.data.accountNumber}</span>], ['Account name', dest.data.accountName]]} />}
        <p className="mt-2 text-xs text-muted">Viewing these details is recorded in the audit log.</p>
        <Input className="mt-3" label="Bank transfer reference" value={bankRef} onChange={(e) => setBankRef(e.target.value)} />
      </Dialog>
      <ConfirmDialog open={dlg?.kind === 'manual-failed'} onClose={() => setDlg(null)} danger title="Mark the manual payout as failed?" body="Only do this if you’re sure no money was sent. The funds return to the customer’s wallet." requireReason confirmLabel="Mark failed" loading={act.isPending} onConfirm={(reason) => act.mutate({ ref: dlg.w.reference, path: 'manual/failed', body: { reason } })} />
    </>
  );
}

// ---------------------------------------------------------------- finance
export function FinancePage() {
  const { can } = useSession();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || (can('finance.view') ? 'accounts' : 'transfers');
  return (
    <>
      <PageHeader title="Ledger and transfers" description="Read-only views of the double-entry ledger. Balances can only change through posted transactions." />
      <Tabs value={tab} onChange={(t) => setParams({ tab: t })} tabs={[can('finance.view') && { value: 'accounts', label: 'Accounts' }, can('finance.view') && { value: 'transactions', label: 'Transactions' }, can('finance.view') && { value: 'payments', label: 'Card payments' }, { value: 'transfers', label: 'Transfers' }, can('finance.view') && { value: 'integrity', label: 'Integrity check' }].filter(Boolean)} />
      {tab === 'accounts' && <AccountsTab />}
      {tab === 'transactions' && <TransactionsTab />}
      {tab === 'payments' && <PaymentsTab />}
      {tab === 'transfers' && <TransfersTab />}
      {tab === 'integrity' && <IntegrityTab />}
    </>
  );
}

function AccountsTab() {
  const [system, setSystem] = useState('true');
  return (
    <AdminList queryKey={['ledger-accounts']} path="/admin/finance/accounts" extraParams={{ system }} caption="Ledger accounts" rowKey={(a) => a.code} columns={[
      { header: 'Account', render: (a) => <Link className="link font-mono text-xs" to={`/admin/finance/accounts/${encodeURIComponent(a.code)}`}>{a.code}</Link> },
      { header: 'Name', key: 'name' },
      { header: 'Purpose', render: (a) => humanize(a.purpose) },
      { header: 'Kind', render: (a) => humanize(a.kind) },
      { header: 'Balance', render: (a) => <strong className="tabular-nums">{naira(a.balance)}</strong> },
    ]}>
      <div className="w-56"><Select label="Show" value={system} onChange={(e) => setSystem(e.target.value)} options={[{ value: 'true', label: 'System accounts' }, { value: '', label: 'All accounts' }]} /></div>
    </AdminList>
  );
}

export function LedgerAccountPage() {
  const { code } = useParams();
  const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: ['ledger-account', code, page], queryFn: () => get(`/admin/finance/accounts/${encodeURIComponent(code)}/entries?page=${page}`) });
  if (q.isLoading) return <Spinner />;
  if (q.isError) return <ErrorState error={q.error} />;
  const { account, entries } = q.data.data;
  return (
    <>
      <PageHeader title={account.name || account.code} description={account.code} />
      <Panel className="mb-4"><KeyValue items={[['Balance', naira(account.balance)], ['Purpose', humanize(account.purpose)], ['Status', humanize(account.status)]]} /></Panel>
      <Table caption="Entries" rows={entries} rowKey={(e) => e._id} columns={[
        { header: 'Posted', render: (e) => dateTime(e.postedAt) },
        { header: 'Transaction', render: (e) => <Link className="link font-mono text-xs" to={`/admin/finance/transactions/${e.reference}`}>{e.reference}</Link> },
        { header: 'Debit', render: (e) => (e.direction === 'debit' ? naira(e.amount) : '') },
        { header: 'Credit', render: (e) => (e.direction === 'credit' ? naira(e.amount) : '') },
        { header: 'Balance after', render: (e) => naira(e.balanceAfter) },
      ]} />
      <Pagination meta={q.data.meta} onPage={setPage} />
    </>
  );
}

function TransactionsTab() {
  const [ref, setRef] = useState('');
  const [search, setSearch] = useState('');
  return (
    <AdminList queryKey={['ledger-tx']} path="/admin/finance/transactions" extraParams={{ reference: search }} caption="Transactions" columns={[
      { header: 'Posted', render: (t) => dateTime(t.postedAt) },
      { header: 'Reference', render: (t) => <Link className="link font-mono text-xs" to={`/admin/finance/transactions/${t.reference}`}>{t.reference}</Link> },
      { header: 'Type', render: (t) => humanize(t.type) },
      { header: 'Description', key: 'description' },
      { header: 'Amount', render: (t) => naira(t.totalKobo) },
    ]}>
      <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); setSearch(ref); }}><Input label="Reference starts with" value={ref} onChange={(e) => setRef(e.target.value)} /><Button type="submit" variant="secondary">Search</Button></form>
    </AdminList>
  );
}

export function LedgerTransactionPage() {
  const { reference } = useParams();
  const { can } = useSession();
  const [open, setOpen] = useState(false);
  const initiate = useInitiateApproval(() => setOpen(false));
  const q = useQuery({ queryKey: ['ledger-tx', reference], queryFn: () => get(`/admin/finance/transactions/${reference}`) });
  if (q.isLoading) return <Spinner />;
  if (q.isError) return <ErrorState error={q.error} />;
  const t = q.data;
  return (
    <>
      <PageHeader title={t.reference} description={t.description} actions={can('finance.adjust.initiate') && !t.reversal && !t.reversalOf && <Button variant="secondary" onClick={() => setOpen(true)}>Propose reversal</Button>} />
      <Panel className="mb-4"><KeyValue items={[['Type', humanize(t.type)], ['Posted', dateTime(t.postedAt)], ['Total', naira(t.totalKobo)], t.relatedType && ['Related', `${humanize(t.relatedType)} ${t.relatedId || ''}`], t.reversal && ['Reversed by', <Link key="r" className="link" to={`/admin/finance/transactions/${t.reversal.reference}`}>{t.reversal.reference}</Link>]]} /></Panel>
      <Table caption="Entries" rows={t.entries} rowKey={(e) => e._id} columns={[
        { header: 'Account', render: (e) => <span className="font-mono text-xs">{e.accountCode}</span> },
        { header: 'Debit', render: (e) => (e.direction === 'debit' ? naira(e.amount) : '') },
        { header: 'Credit', render: (e) => (e.direction === 'credit' ? naira(e.amount) : '') },
        { header: 'Balance after', render: (e) => naira(e.balanceAfter) },
      ]} />
      <p className="mt-2 text-xs text-muted">Entries are immutable. A mistake is corrected by a new, dual-approved reversing transaction.</p>
      <ReasonApproval open={open} onClose={() => setOpen(false)} title="Propose a full reversal" body="A reversing transaction swaps every entry. It runs only if a second authorised person approves and balances allow it." loading={initiate.isPending} onSubmit={(reason) => initiate.mutate({ action: 'ledger.reversal', payload: { reference: t.reference }, reason })} />
    </>
  );
}

function PaymentsTab() {
  const qc = useQueryClient();
  const verify = useMutation({ mutationFn: (ref) => post(`/admin/finance/payments/${ref}/verify`), onSuccess: (r) => { qc.invalidateQueries({ queryKey: ['admin-payments'] }); toast({ title: `Paystack says: ${humanize(r.status)}` }); }, onError: toastError });
  return (
    <AdminList queryKey={['admin-payments']} path="/admin/finance/payments" statuses={['', 'initialized', 'pending', 'uncertain', 'amount_mismatch', 'success', 'failed', 'abandoned']} caption="Card payments" columns={[
      { header: 'Reference', render: (p) => <span className="font-mono text-xs">{p.reference}</span> },
      { header: 'Purpose', render: (p) => humanize(p.purpose) },
      { header: 'Amount', render: (p) => naira(p.amountKobo) },
      { header: 'Created', render: (p) => dateTime(p.createdAt) },
      { header: 'Status', render: (p) => <><Status value={p.status} />{p.fulfilledAt && <span className="block text-xs text-muted">Credited {dateTime(p.fulfilledAt)}</span>}</> },
      { header: '', render: (p) => !p.fulfilledAt && <Button size="sm" variant="secondary" loading={verify.isPending && verify.variables === p.reference} onClick={() => verify.mutate(p.reference)}>Verify with Paystack</Button> },
    ]} />
  );
}

function TransfersTab() {
  const { can } = useSession();
  const qc = useQueryClient();
  const [dlg, setDlg] = useState(null);
  const m = useMutation({ mutationFn: (note) => post(`/admin/finance/transfers/${dlg.t.reference}/review`, { decision: dlg.decision, note }), onSuccess: () => { setDlg(null); qc.invalidateQueries({ queryKey: ['admin-transfers'] }); }, onError: toastError });
  return (
    <>
      <AdminList queryKey={['admin-transfers']} path="/admin/finance/transfers" statuses={['', 'held', 'completed', 'rejected']} caption="Transfers" columns={[
        { header: 'Reference', render: (t) => <span className="font-mono text-xs">{t.reference}</span> },
        { header: 'Amount', render: (t) => naira(t.amountKobo) },
        { header: 'From', render: (t) => <Link className="link" to={`/admin/users/${t.senderId}`}>Sender</Link> },
        { header: 'To', render: (t) => <Link className="link" to={`/admin/users/${t.recipientId}`}>Recipient</Link> },
        { header: 'Created', render: (t) => dateTime(t.createdAt) },
        { header: 'Status', render: (t) => <><Status value={t.status} />{t.holdReason && <span className="block text-xs text-muted">{t.holdReason}</span>}</> },
        { header: '', render: (t) => t.status === 'held' && can('risk.review') && <div className="flex gap-1"><Button size="sm" onClick={() => setDlg({ t, decision: 'approve' })}>Release</Button><Button size="sm" variant="ghost" onClick={() => setDlg({ t, decision: 'reject' })}>Reject</Button></div> },
      ]} />
      <ConfirmDialog open={Boolean(dlg)} onClose={() => setDlg(null)} danger={dlg?.decision === 'reject'} title={dlg?.decision === 'approve' ? 'Release this transfer?' : 'Reject and return the funds to the sender?'} requireReason confirmLabel={dlg?.decision === 'approve' ? 'Release' : 'Reject'} loading={m.isPending} onConfirm={(note) => m.mutate(note)} />
    </>
  );
}

function IntegrityTab() {
  const q = useQuery({ queryKey: ['invariants'], queryFn: () => get('/admin/finance/invariants') });
  if (q.isLoading) return <Spinner label="Checking the ledger" />;
  if (q.isError) return <ErrorState error={q.error} />;
  const r = q.data;
  return (
    <Panel>
      {r.ok ? <Notice tone="success" title="The ledger balances">Every transaction’s debits equal its credits, and stored balances match their entries.</Notice> : <Notice tone="danger" title="Ledger problems found">Raise this with finance and engineering immediately. Don’t correct balances directly.</Notice>}
      <pre className="mt-4 overflow-x-auto rounded-lg bg-ink/5 p-3 text-xs">{JSON.stringify(r, null, 2)}</pre>
      <Button className="mt-3" variant="secondary" onClick={() => q.refetch()}>Check again</Button>
    </Panel>
  );
}

// ---------------------------------------------------------------- reconciliation
export function ReconciliationPage() {
  const { can } = useSession();
  const qc = useQueryClient();
  const [tab, setTab] = useState('exceptions');
  const [dlg, setDlg] = useState(null);
  const runs = useQuery({ queryKey: ['recon-runs'], queryFn: () => get('/admin/reconciliation/runs'), enabled: tab === 'runs' });
  const run = useMutation({ mutationFn: (type) => post('/admin/reconciliation/run', { type }), onSuccess: (r) => { qc.invalidateQueries({ queryKey: ['recon-runs'] }); qc.invalidateQueries({ queryKey: ['recon-exceptions'] }); toast({ title: 'Reconciliation finished', body: r?.stats ? Object.entries(r.stats).map(([k, v]) => `${humanize(k)}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(', ') : r?.ok === false ? 'Problems found' : undefined }); }, onError: toastError });
  const resolve = useMutation({ mutationFn: ({ status, note }) => post(`/admin/reconciliation/exceptions/${dlg.e._id}`, { status, note }), onSuccess: () => { setDlg(null); qc.invalidateQueries({ queryKey: ['recon-exceptions'] }); }, onError: toastError });
  return (
    <>
      <PageHeader title="Reconciliation" description="Compares Paystack, payouts and the ledger. Differences are never fixed automatically: investigate, then correct through an approved adjustment if needed." actions={
        <div className="flex flex-wrap gap-2">{[['paystack_payments', 'Check Paystack payments'], ['payouts', 'Check payouts'], ['ledger_invariants', 'Check ledger'], ['pending_sweep', 'Re-verify pending payments']].map(([t, l]) => <Button key={t} size="sm" variant="secondary" loading={run.isPending && run.variables === t} onClick={() => run.mutate(t)}>{l}</Button>)}</div>
      } />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'exceptions', label: 'Differences' }, { value: 'runs', label: 'Run history' }]} />
      {tab === 'exceptions' && (
        <AdminList queryKey={['recon-exceptions']} path="/admin/reconciliation/exceptions" statuses={[{ value: '', label: 'Open and investigating' }, 'resolved', 'dismissed']} caption="Differences" empty={<EmptyState title="No open differences" />} columns={[
          { header: 'Found', render: (e) => dateTime(e.createdAt) },
          { header: 'Type', render: (e) => humanize(e.type) },
          { header: 'Reference', render: (e) => <span className="font-mono text-xs">{e.reference}</span> },
          { header: 'Severity', render: (e) => <Status value={e.severity} /> },
          { header: 'Detail', render: (e) => <span className="text-xs">{e.details ? Object.entries(e.details).map(([k, v]) => `${humanize(k)}: ${/kobo/i.test(k) && typeof v === 'number' ? naira(v) : typeof v === 'object' ? JSON.stringify(v) : v}`).join('; ') : ''}</span> },
          { header: 'Status', render: (e) => <Status value={e.status} /> },
          { header: '', render: (e) => can('reconciliation.resolve') && ['open', 'investigating'].includes(e.status) && <Button size="sm" variant="secondary" onClick={() => setDlg({ e, status: 'investigating', note: '' })}>Update</Button> },
        ]} />
      )}
      {tab === 'runs' && (runs.isLoading ? <Spinner /> : <Table caption="Runs" rows={runs.data} rowKey={(r) => r._id} columns={[
        { header: 'Started', render: (r) => dateTime(r.createdAt) },
        { header: 'Type', render: (r) => humanize(r.type) },
        { header: 'Status', render: (r) => <Status value={r.status} /> },
        { header: 'Result', render: (r) => <span className="text-xs">{r.stats ? Object.entries(r.stats).map(([k, v]) => `${humanize(k)}: ${v}`).join(', ') : r.error || ''}</span> },
      ]} />)}
      <Dialog open={Boolean(dlg)} onClose={() => setDlg(null)} title="Update this difference" footer={<><Button variant="secondary" onClick={() => setDlg(null)}>Cancel</Button><Button loading={resolve.isPending} disabled={(dlg?.note || '').length < 10} onClick={() => resolve.mutate({ status: dlg.status, note: dlg.note })}>Save</Button></>}>
        {dlg && <div className="space-y-3"><Select label="Status" value={dlg.status} onChange={(e) => setDlg({ ...dlg, status: e.target.value })} options={['investigating', 'resolved', 'dismissed'].map((v) => ({ value: v, label: humanize(v) }))} /><Textarea label="What did you find?" value={dlg.note} onChange={(e) => setDlg({ ...dlg, note: e.target.value })} hint="At least 10 characters. Include any adjustment or approval reference." /></div>}
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------- savings
const blankPlan = { name: '', description: '', contributionMode: 'flexible', minDurationDays: 30, maxDurationDays: 365, allowedFrequencies: ['weekly', 'monthly'], minContributionKobo: 10000, earlyExit: { type: 'percent', bp: 0, fixedKobo: 0 } };

export function SavingsAdminPage() {
  const { can } = useSession();
  const qc = useQueryClient();
  const [tab, setTab] = useState('plans');
  const [edit, setEdit] = useState(null);
  const plans = useQuery({ queryKey: ['admin-plans'], queryFn: () => get('/admin/savings/plans') });
  const liab = useQuery({ queryKey: ['savings-liab'], queryFn: () => get('/admin/savings/liabilities'), enabled: tab === 'liabilities' });
  const save = useMutation({
    mutationFn: (p) => {
      const body = { name: p.name, description: p.description, contributionMode: p.contributionMode, minDurationDays: Number(p.minDurationDays), maxDurationDays: Number(p.maxDurationDays), allowedFrequencies: p.allowedFrequencies, minContributionKobo: p.minContributionKobo || undefined, earlyExit: p.earlyExit, ...(p._id ? { status: p.status } : {}) };
      return p._id ? patch(`/admin/savings/plans/${p._id}`, body) : post('/admin/savings/plans', body);
    },
    onSuccess: () => { setEdit(null); qc.invalidateQueries({ queryKey: ['admin-plans'] }); toast({ tone: 'success', title: 'Plan saved' }); },
    onError: toastError,
  });
  return (
    <>
      <PageHeader title="Savings" description="Personal savings plans. Changes to a plan never alter the terms of plans customers already joined." actions={can('savings.manage_plans') && tab === 'plans' && <Button onClick={() => setEdit({ ...blankPlan })}>New plan</Button>} />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'plans', label: 'Plans' }, { value: 'accounts', label: 'Customer savings' }, { value: 'liabilities', label: 'Totals held' }]} />
      {tab === 'plans' && (plans.isLoading ? <Spinner /> : <Table caption="Plans" rows={plans.data} rowKey={(p) => p._id} columns={[
        { header: 'Plan', render: (p) => <><span className="font-medium">{p.name}</span><span className="block text-xs text-muted">{p.description}</span></> },
        { header: 'Contributions', render: (p) => humanize(p.contributionMode) },
        { header: 'Duration', render: (p) => `${p.minDurationDays} to ${p.maxDurationDays} days` },
        { header: 'Early exit', render: (p) => (p.earlyExit?.type === 'percent' ? `${(p.earlyExit.bp || 0) / 100}% penalty` : p.earlyExit?.type === 'fixed' ? `${naira(p.earlyExit.fixedKobo)} penalty` : 'Not allowed') },
        { header: 'Version', key: 'version' },
        { header: 'Status', render: (p) => <Status value={p.status} /> },
        { header: '', render: (p) => can('savings.manage_plans') && <Button size="sm" variant="secondary" onClick={() => setEdit({ ...blankPlan, ...p, earlyExit: { ...blankPlan.earlyExit, ...p.earlyExit } })}>Edit</Button> },
      ]} />)}
      {tab === 'accounts' && <AdminList queryKey={['admin-savings-accounts']} path="/admin/savings/accounts" statuses={['', 'active', 'paused', 'matured', 'closed_early']} caption="Customer savings" columns={[
        { header: 'Name', key: 'name' },
        { header: 'Customer', render: (a) => <Link className="link" to={`/admin/users/${a.userId}`}>View</Link> },
        { header: 'Target', render: (a) => (a.targetKobo ? naira(a.targetKobo) : '—') },
        { header: 'Matures', render: (a) => dateTime(a.maturityDate) },
        { header: 'Status', render: (a) => <Status value={a.status} /> },
      ]} />}
      {tab === 'liabilities' && (liab.isLoading ? <Spinner /> : liab.data && <Panel><KeyValue items={Object.entries(liab.data).map(([k, v]) => [humanize(k), typeof v === 'number' && /kobo/i.test(k) ? naira(v) : typeof v === 'object' ? JSON.stringify(v) : String(v)])} /><p className="mt-3 text-sm text-muted">This is money owed to customers, not MubaPay revenue.</p></Panel>)}
      <Dialog wide open={Boolean(edit)} onClose={() => setEdit(null)} title={edit?._id ? 'Edit plan' : 'New savings plan'} footer={<><Button variant="secondary" onClick={() => setEdit(null)}>Cancel</Button><Button loading={save.isPending} onClick={() => save.mutate(edit)}>Save plan</Button></>}>
        {edit && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Input className="sm:col-span-2" label="Name" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            <Textarea className="sm:col-span-2" label="Description" value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />
            <Select label="Contributions" value={edit.contributionMode} onChange={(e) => setEdit({ ...edit, contributionMode: e.target.value })} options={[{ value: 'flexible', label: 'Any time' }, { value: 'scheduled', label: 'On a schedule' }]} />
            <KoboInput label="Minimum contribution" value={edit.minContributionKobo} onChange={(v) => setEdit({ ...edit, minContributionKobo: v })} />
            <Input label="Shortest duration (days)" type="number" value={edit.minDurationDays} onChange={(e) => setEdit({ ...edit, minDurationDays: e.target.value })} />
            <Input label="Longest duration (days)" type="number" value={edit.maxDurationDays} onChange={(e) => setEdit({ ...edit, maxDurationDays: e.target.value })} />
            <fieldset className="sm:col-span-2"><legend className="label">Schedules allowed</legend><div className="flex gap-4">{['daily', 'weekly', 'monthly'].map((f) => <label key={f} className="inline-flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4" checked={edit.allowedFrequencies.includes(f)} onChange={(e) => setEdit({ ...edit, allowedFrequencies: e.target.checked ? [...edit.allowedFrequencies, f] : edit.allowedFrequencies.filter((x) => x !== f) })} />{humanize(f)}</label>)}</div></fieldset>
            <Select label="Early withdrawal" value={edit.earlyExit.type} onChange={(e) => setEdit({ ...edit, earlyExit: { ...edit.earlyExit, type: e.target.value } })} options={[{ value: 'percent', label: 'Allowed, percentage penalty' }, { value: 'fixed', label: 'Allowed, fixed penalty' }, { value: 'none', label: 'Allowed, no penalty' }]} />
            {edit.earlyExit.type === 'percent' && <Input label="Penalty (%)" type="number" step="0.01" min={0} value={(edit.earlyExit.bp || 0) / 100} onChange={(e) => setEdit({ ...edit, earlyExit: { ...edit.earlyExit, bp: Math.round(Number(e.target.value) * 100) } })} hint="Capped by the settings limit." />}
            {edit.earlyExit.type === 'fixed' && <KoboInput label="Penalty" value={edit.earlyExit.fixedKobo} onChange={(v) => setEdit({ ...edit, earlyExit: { ...edit.earlyExit, fixedKobo: v } })} />}
            {edit._id && <Select label="Status" value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })} options={[{ value: 'active', label: 'Open to new savers' }, { value: 'retired', label: 'Retired (existing savers unaffected)' }]} />}
            <p className="text-sm text-muted sm:col-span-2">MubaPay plans do not pay interest. Don’t describe them as investments.</p>
          </div>
        )}
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------- settlements
export function SettlementsAdminPage() {
  const { can } = useSession();
  const qc = useQueryClient();
  const [dlg, setDlg] = useState(null);
  const act = useMutation({ mutationFn: ({ s, kind, reason }) => post(`/admin/settlements/${s._id}/${kind}`, kind === 'hold' ? { reason } : {}), onSuccess: () => { setDlg(null); qc.invalidateQueries({ queryKey: ['admin-settlements'] }); }, onError: toastError });
  return (
    <>
      <PageHeader title="Seller settlements" description="Proceeds of used-item sales, released after delivery or collection and the return window. Held automatically while a refund or dispute is open." />
      <AdminList queryKey={['admin-settlements']} path="/admin/settlements" statuses={['', 'pending_release', 'on_hold', 'released']} caption="Settlements" columns={[
        { header: 'Reference', render: (s) => <span className="font-mono text-xs">{s.reference}</span> },
        { header: 'Seller', render: (s) => <Link className="link" to={`/admin/users/${s.sellerId}`}>View</Link> },
        { header: 'Gross', render: (s) => naira(s.grossKobo) },
        { header: 'Commission', render: (s) => naira(s.commissionKobo) },
        { header: 'Net', render: (s) => <strong>{naira(s.netKobo)}</strong> },
        { header: 'Status', render: (s) => <><Status value={s.status} />{s.holdReason && <span className="block text-xs text-muted">{s.holdReason}</span>}</> },
        { header: '', render: (s) => can('settlements.release') && s.status === 'pending_release' && <div className="flex gap-1"><Button size="sm" onClick={() => setDlg({ s, kind: 'release' })}>Release</Button><Button size="sm" variant="ghost" onClick={() => setDlg({ s, kind: 'hold' })}>Hold</Button></div> },
      ]} />
      <ConfirmDialog open={dlg?.kind === 'release'} onClose={() => setDlg(null)} title="Release to the seller’s wallet?" body="This is refused automatically if a refund or dispute is open or the return window hasn’t ended." confirmLabel="Release" loading={act.isPending} onConfirm={() => act.mutate(dlg)} />
      <ConfirmDialog open={dlg?.kind === 'hold'} onClose={() => setDlg(null)} title="Hold this settlement?" requireReason confirmLabel="Hold" loading={act.isPending} onConfirm={(reason) => act.mutate({ ...dlg, reason })} />
    </>
  );
}
