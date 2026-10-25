import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { get, post } from '../../lib/api';
import { dateTime, humanize, naira } from '../../lib/format';
import { useSession } from '../../lib/session';
import { Button, Checkbox, EmptyState, ErrorState, Input, KeyValue, Notice, PageHeader, Panel, Select, Spinner, Status, Table, Tabs, Textarea } from '../../components/ui';
import { ConfirmDialog, Dialog } from '../../components/ui/dialog';
import { KoboInput } from '../../components/ui/forms';
import { toast, toastError } from '../../components/ui/toast';
import { AdminList, DocumentButton, who } from './shared';

// ---------------------------------------------------------------- overview
const COUNT_LINKS = {
  approvalsPending: ['Approvals waiting for you or a colleague', '/admin/approvals'],
  criticalAlerts: ['Critical alerts', '/admin/alerts'],
  withdrawalsPending: ['Withdrawals to review or pay out', '/admin/withdrawals'],
  transfersHeld: ['Transfers held for risk review', '/admin/finance?tab=transfers'],
  reconciliationOpen: ['Open reconciliation differences', '/admin/reconciliation'],
  kycPending: ['Identity checks waiting', '/admin/verification'],
  listingsPending: ['Used-item listings to moderate', '/admin/moderation'],
  propertiesPending: ['Properties to moderate', '/admin/moderation?tab=properties'],
  refundsPending: ['Refund requests', '/admin/refunds'],
  disputesOpen: ['Open disputes', '/admin/disputes'],
  ticketsOpen: ['Open support tickets', '/admin/support'],
};

export function AdminOverviewPage() {
  const { user } = useSession();
  const q = useQuery({ queryKey: ['admin-overview'], queryFn: () => get('/admin/overview'), refetchInterval: 60000 });
  return (
    <>
      <PageHeader title="Staff console" description={`Signed in as ${user.email}. You only see work your permissions allow.`} />
      {q.isLoading ? <Spinner /> : q.isError ? <ErrorState error={q.error} /> : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(q.data.counts).map(([k, n]) => (
            <li key={k}>
              <Link to={COUNT_LINKS[k]?.[1] || '/admin'} className={`block rounded-xl border bg-surface p-4 hover:border-palm ${n > 0 && (k === 'criticalAlerts' || k === 'reconciliationOpen') ? 'border-danger' : 'border-line'}`}>
                <span className="font-display text-3xl font-bold tabular-nums">{n}</span>
                <span className="mt-1 block text-sm text-muted">{COUNT_LINKS[k]?.[0] || humanize(k)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

// ---------------------------------------------------------------- approvals
export function ApprovalsPage() {
  const { user } = useSession();
  const qc = useQueryClient();
  const [dlg, setDlg] = useState(null);
  const act = useMutation({ mutationFn: ({ id, kind, note }) => post(`/admin/approvals/${id}/${kind}`, { note }), onSuccess: (r) => { setDlg(null); qc.invalidateQueries({ queryKey: ['approvals'] }); toast({ tone: r.status === 'failed' ? 'danger' : 'success', title: humanize(r.status), body: r.error }); }, onError: toastError });
  return (
    <>
      <PageHeader title="Approvals" description="Sensitive actions need a second person. You can’t approve a request you started." />
      <AdminList queryKey={['approvals']} path="/admin/approvals" statuses={['pending', 'executed', 'rejected', 'failed', 'all']} defaultStatus="pending" caption="Approval requests" empty={<EmptyState title="Nothing waiting for approval" />} columns={[
        { header: 'Action', render: (a) => <><span className="font-medium">{humanize(a.action)}</span><span className="block text-xs text-muted">{a.summary}</span></> },
        { header: 'Reason', render: (a) => <span className="text-sm">{a.reason}</span> },
        { header: 'Started by', render: (a) => `${who(a.initiatedBy)}, ${dateTime(a.createdAt)}` },
        { header: 'Approvals', render: (a) => `${a.approvals?.length || 0} of ${a.requiredApprovals}` },
        { header: 'Status', render: (a) => <><Status value={a.status} />{a.error && <span className="block text-xs text-danger">{a.error}</span>}</> },
        { header: '', render: (a) => a.status === 'pending' && String(a.initiatedBy?._id) !== user.id && !a.approvals?.some((x) => x.by?.email === user.email) && <div className="flex gap-1"><Button size="sm" onClick={() => setDlg({ id: a._id, kind: 'approve', a })}>Approve</Button><Button size="sm" variant="ghost" onClick={() => setDlg({ id: a._id, kind: 'reject', a })}>Reject</Button></div> },
      ]} />
      <ConfirmDialog open={Boolean(dlg)} onClose={() => setDlg(null)} danger={dlg?.kind === 'reject'} title={dlg?.kind === 'approve' ? 'Approve and run this action?' : 'Reject this request?'} body={dlg && <><p className="font-medium">{dlg.a.summary || humanize(dlg.a.action)}</p><pre className="mt-2 overflow-x-auto rounded bg-ink/5 p-2 text-xs">{JSON.stringify(dlg.a.payload, null, 2)}</pre></>} requireReason={dlg?.kind === 'reject'} reasonLabel="Why are you rejecting it?" confirmLabel={dlg?.kind === 'approve' ? 'Approve' : 'Reject'} loading={act.isPending} onConfirm={(note) => act.mutate({ id: dlg.id, kind: dlg.kind, note: note || undefined })} />
    </>
  );
}

/** Start a dual-approval request. */
export function useInitiateApproval(onDone) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ action, payload, reason }) => post('/admin/approvals', { action, payload, reason }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['approvals'] }); toast({ tone: 'success', title: 'Sent for approval', body: 'A second authorised person must approve it before it runs.' }); onDone?.(); },
    onError: toastError,
  });
}

// ---------------------------------------------------------------- users
export function UsersPage() {
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  return (
    <>
      <PageHeader title="Users" />
      <AdminList queryKey={['admin-users']} path="/admin/users" extraParams={{ q: search }} statuses={['', 'active', 'restricted', 'suspended', 'closed']} caption="Users" columns={[
        { header: 'Name', render: (u) => <Link className="link" to={`/admin/users/${u._id}`}>{who(u)}</Link> },
        { header: 'Email', key: 'email' },
        { header: 'Roles', render: (u) => u.roles.map(humanize).join(', ') },
        { header: 'Identity', render: (u) => <Status value={u.kycStatus} /> },
        { header: 'Account', render: (u) => <Status value={u.status} /> },
        { header: 'Joined', render: (u) => dateTime(u.createdAt) },
      ]}>
        <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); setSearch(q); }}>
          <Input label="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} />
          <Button type="submit" variant="secondary">Search</Button>
        </form>
      </AdminList>
    </>
  );
}

export function UserDetailPage() {
  const { id } = useParams();
  const { can, user: me } = useSession();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin-user', id], queryFn: () => get(`/admin/users/${id}`) });
  const [dlg, setDlg] = useState(null);
  const [adj, setAdj] = useState({ direction: 'credit', amountKobo: 0, relatedReference: '', reason: '' });
  const [restrict, setRestrict] = useState({ action: 'restrict', scopes: [] });
  const [note, setNote] = useState({ title: '', body: '' });
  const restrictM = useMutation({ mutationFn: (reason) => post(`/admin/users/${id}/restriction`, { ...restrict, reason }), onSuccess: () => { setDlg(null); qc.invalidateQueries({ queryKey: ['admin-user', id] }); }, onError: toastError });
  const initiate = useInitiateApproval(() => setDlg(null));
  const notify = useMutation({ mutationFn: () => post('/admin/notifications/send', { userId: id, category: 'account', ...note }), onSuccess: () => { setDlg(null); toast({ tone: 'success', title: 'Message sent' }); }, onError: toastError });
  if (q.isLoading) return <Spinner />;
  if (q.isError) return <ErrorState error={q.error} />;
  const u = q.data;
  const self = u.id === me.id;
  return (
    <div className="space-y-6">
      <PageHeader title={who(u)} description={u.email} actions={<Status value={u.status} />} />
      <Panel>
        <KeyValue items={[['Phone', u.phone || '—'], ['Roles', u.roles.map(humanize).join(', ')], ['Can act as', Object.entries(u.capabilities || {}).filter(([, v]) => v).map(([k]) => humanize(k)).join(', ') || '—'], ['Identity', <Status key="k" value={u.kycStatus} />], ['Verification level', humanize(u.verificationTier)], ['Two-step verification', u.twoFactorEnabled ? 'On' : 'Off'], ['Joined', dateTime(u.createdAt)], ['Last sign-in', u.lastLoginAt ? dateTime(u.lastLoginAt) : '—'], u.restriction && ['Restriction', `${u.restriction.reason} (${(u.restriction.scopes || []).join(', ') || 'all'})`]]} />
      </Panel>
      {u.ledgerAccounts && (
        <Panel title="Ledger accounts">
          <Table caption="Ledger accounts" rows={u.ledgerAccounts} rowKey={(a) => a.code} columns={[{ header: 'Account', render: (a) => <Link className="link" to={`/admin/finance/accounts/${encodeURIComponent(a.code)}`}>{a.code}</Link> }, { header: 'Purpose', render: (a) => humanize(a.purpose) }, { header: 'Balance', render: (a) => naira(a.balance) }]} />
          <p className="mt-2 text-xs text-muted">Balances are derived from immutable ledger entries. Staff cannot edit them directly; corrections go through dual-approved adjustments.</p>
        </Panel>
      )}
      {!self && (
        <div className="flex flex-wrap gap-2">
          {can('users.restrict') && <Button variant="secondary" onClick={() => setDlg('restrict')}>Restrict or suspend</Button>}
          {can('finance.adjust.initiate') && <Button variant="secondary" onClick={() => setDlg('adjust')}>Propose a wallet adjustment</Button>}
          {can('notifications.manage') && <Button variant="secondary" onClick={() => setDlg('notify')}>Send a message</Button>}
          {can('staff.manage') && !u.roles.includes('admin') && !u.roles.includes('superadmin') && <Button variant="secondary" to={`/admin/staff?promote=${u.id}`}>Make staff</Button>}
        </div>
      )}
      <Dialog open={dlg === 'restrict'} onClose={() => setDlg(null)} title="Change account access" footer={<><Button variant="secondary" onClick={() => setDlg(null)}>Cancel</Button><Button variant="danger" loading={restrictM.isPending} onClick={() => setDlg('restrict-confirm')}>Continue</Button></>}>
        <Select label="Action" value={restrict.action} onChange={(e) => setRestrict({ ...restrict, action: e.target.value })} options={[{ value: 'restrict', label: 'Restrict some features' }, { value: 'suspend', label: 'Suspend and sign out everywhere' }, { value: 'unrestrict', label: 'Remove restrictions' }]} />
        {restrict.action === 'restrict' && <fieldset className="mt-3 space-y-2"><legend className="label">Restrict</legend>{['messaging', 'financial', 'listings'].map((s) => <Checkbox key={s} label={humanize(s)} checked={restrict.scopes.includes(s)} onChange={(e) => setRestrict({ ...restrict, scopes: e.target.checked ? [...restrict.scopes, s] : restrict.scopes.filter((x) => x !== s) })} />)}</fieldset>}
      </Dialog>
      <ConfirmDialog open={dlg === 'restrict-confirm'} onClose={() => setDlg(null)} danger title={`${humanize(restrict.action)} this account?`} body="The customer is notified with the reason you give." requireReason loading={restrictM.isPending} onConfirm={(r) => restrictM.mutate(r)} />
      <Dialog open={dlg === 'adjust'} onClose={() => setDlg(null)} title="Propose a wallet adjustment" footer={<><Button variant="secondary" onClick={() => setDlg(null)}>Cancel</Button><Button loading={initiate.isPending} disabled={!adj.amountKobo || adj.reason.length < 10 || adj.relatedReference.length < 3} onClick={() => initiate.mutate({ action: 'ledger.wallet_adjustment', payload: { userId: u.id, direction: adj.direction, amountKobo: adj.amountKobo, relatedReference: adj.relatedReference }, reason: adj.reason })}>Send for approval</Button></>}>
        <div className="space-y-3">
          <Notice>Adjustments post a balanced ledger entry against the corrections account. They only run after a second authorised person approves.</Notice>
          <Select label="Direction" value={adj.direction} onChange={(e) => setAdj({ ...adj, direction: e.target.value })} options={[{ value: 'credit', label: 'Credit the customer’s wallet' }, { value: 'debit', label: 'Debit the customer’s wallet' }]} />
          <KoboInput label="Amount" value={adj.amountKobo} onChange={(v) => setAdj({ ...adj, amountKobo: v })} />
          <Input label="Related reference" value={adj.relatedReference} onChange={(e) => setAdj({ ...adj, relatedReference: e.target.value })} hint="Ticket, payment or reconciliation reference that justifies this." />
          <Textarea label="Reason" value={adj.reason} onChange={(e) => setAdj({ ...adj, reason: e.target.value })} hint="At least 10 characters." />
        </div>
      </Dialog>
      <Dialog open={dlg === 'notify'} onClose={() => setDlg(null)} title="Send a message to this customer" footer={<><Button variant="secondary" onClick={() => setDlg(null)}>Cancel</Button><Button loading={notify.isPending} onClick={() => notify.mutate()}>Send</Button></>}>
        <div className="space-y-3"><Input label="Title" value={note.title} onChange={(e) => setNote({ ...note, title: e.target.value })} /><Textarea label="Message" value={note.body} onChange={(e) => setNote({ ...note, body: e.target.value })} /></div>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------- verification
export function IdentityQueuePage() {
  const { can } = useSession();
  const qc = useQueryClient();
  const [rev, setRev] = useState(null);
  const m = useMutation({ mutationFn: () => post(`/admin/verification/identity/${rev.item.id}/review`, { decision: rev.decision, reviewerNotes: rev.notes || undefined, customerMessage: rev.message || undefined }), onSuccess: () => { setRev(null); qc.invalidateQueries({ queryKey: ['kyc-queue'] }); }, onError: toastError });
  return (
    <>
      <PageHeader title="Identity verification" description="Check that the name, date of birth and photo match the ID. Viewing a document is recorded in the audit log." />
      <AdminList queryKey={['kyc-queue']} path="/admin/verification/identity" statuses={['pending', 'approved', 'rejected', 'resubmission_required']} defaultStatus="pending" caption="Identity checks" empty={<EmptyState title="No identity checks waiting" />} columns={[
        { header: 'Name on ID', render: (i) => `${i.legalFirstName} ${i.legalLastName}` },
        { header: 'ID', render: (i) => `${humanize(i.idType)} ending ${i.idNumberLast4}` },
        { header: 'Address', render: (i) => (i.address ? `${i.address.city}, ${i.address.state}` : '—') },
        { header: 'Submitted', render: (i) => `${dateTime(i.createdAt)}${i.attempt > 1 ? ` (attempt ${i.attempt})` : ''}` },
        { header: 'Documents', render: (i) => <div className="flex flex-wrap gap-1">{i.documents.map((d) => <DocumentButton key={d.id} doc={d} />)}</div> },
        { header: '', render: (i) => i.status === 'pending' && can('kyc.review') && <Button size="sm" onClick={() => setRev({ item: i, decision: 'approve', notes: '', message: '' })}>Review</Button> },
      ]} />
      <ReviewDialog rev={rev} setRev={setRev} loading={m.isPending} onSubmit={() => m.mutate()} />
    </>
  );
}

function ReviewDialog({ rev, setRev, loading, onSubmit }) {
  return (
    <Dialog open={Boolean(rev)} onClose={() => setRev(null)} title="Record your decision" footer={<><Button variant="secondary" onClick={() => setRev(null)}>Cancel</Button><Button loading={loading} disabled={rev?.decision !== 'approve' && (rev?.message || '').length < 5} onClick={onSubmit}>Save decision</Button></>}>
      {rev && (
        <div className="space-y-3">
          {rev.item.appeal?.text && <Notice title="Customer appeal">{rev.item.appeal.text}</Notice>}
          <Select label="Decision" value={rev.decision} onChange={(e) => setRev({ ...rev, decision: e.target.value })} options={[{ value: 'approve', label: 'Approve' }, { value: 'request_resubmission', label: 'Ask for new documents' }, { value: 'reject', label: 'Reject' }]} />
          <Textarea label="Message to the customer" value={rev.message} onChange={(e) => setRev({ ...rev, message: e.target.value })} hint={rev.decision === 'approve' ? 'Optional.' : 'Required. Say what to fix.'} />
          <Textarea label="Internal notes" value={rev.notes} onChange={(e) => setRev({ ...rev, notes: e.target.value })} hint="Only staff see these." />
        </div>
      )}
    </Dialog>
  );
}

export function RoleQueuePage() {
  const qc = useQueryClient();
  const [rev, setRev] = useState(null);
  const m = useMutation({ mutationFn: () => post(`/admin/verification/roles/${rev.item._id}/review`, { decision: rev.decision, reviewerNotes: rev.notes || undefined, customerMessage: rev.message || undefined }), onSuccess: () => { setRev(null); qc.invalidateQueries({ queryKey: ['role-queue'] }); }, onError: toastError });
  return (
    <>
      <PageHeader title="Landlord and agent applications" description="Approval means the documents provided were checked. It isn’t a guarantee about any property." />
      <AdminList queryKey={['role-queue']} path="/admin/verification/roles" statuses={['pending', 'approved', 'rejected', 'resubmission_required']} defaultStatus="pending" caption="Applications" empty={<EmptyState title="No applications waiting" />} columns={[
        { header: 'Applicant', render: (a) => <><span className="font-medium">{who(a.userId)}</span><span className="block text-xs text-muted">Identity: {humanize(a.userId?.kycStatus)}</span></> },
        { header: 'Role', render: (a) => humanize(a.role) },
        { header: 'Details', render: (a) => <span className="text-sm">{[a.businessName, a.registrationNumber && `Reg. ${a.registrationNumber}`, a.professionalBody, a.yearsExperience != null && `${a.yearsExperience} yrs`, a.operatingStates?.join(', ')].filter(Boolean).join('; ')}</span> },
        { header: 'Documents', render: (a) => <div className="flex flex-wrap gap-1">{a.documents.map((d) => <DocumentButton key={d.id} doc={d} />)}</div> },
        { header: '', render: (a) => a.status === 'pending' && <Button size="sm" onClick={() => setRev({ item: a, decision: 'approve', notes: '', message: '' })}>Review</Button> },
      ]} />
      <ReviewDialog rev={rev} setRev={setRev} loading={m.isPending} onSubmit={() => m.mutate()} />
    </>
  );
}

// ---------------------------------------------------------------- staff
export function StaffPage() {
  const { user: me } = useSession();
  const staff = useQuery({ queryKey: ['staff'], queryFn: () => get('/admin/staff') });
  const cat = useQuery({ queryKey: ['permissions'], queryFn: () => get('/admin/permissions') });
  const params = new URLSearchParams(window.location.search);
  const [edit, setEdit] = useState(() => (params.get('promote') ? { userId: params.get('promote'), permissions: [], reason: '', isNew: true } : null));
  const [dlg, setDlg] = useState(null);
  const initiate = useInitiateApproval(() => { setEdit(null); setDlg(null); });
  const isSuper = me.roles.includes('superadmin');
  if (staff.isLoading || cat.isLoading) return <Spinner />;
  if (staff.isError) return <ErrorState error={staff.error} />;
  const { permissions, presets, superadminOnly } = cat.data;
  return (
    <>
      <PageHeader title="Staff and permissions" description="Changes to staff access need a second superadmin or staff manager to approve." />
      <Table caption="Staff" rows={staff.data} rowKey={(s) => s._id} columns={[
        { header: 'Name', render: (s) => <Link className="link" to={`/admin/users/${s._id}`}>{who(s)}</Link> },
        { header: 'Role', render: (s) => s.roles.filter((r) => r !== 'customer').map(humanize).join(', ') },
        { header: 'Permissions', render: (s) => (s.roles.includes('superadmin') ? 'All' : `${s.staffPermissions?.length || 0}`) },
        { header: '2-step', render: (s) => (s.twoFactor?.enabled ? 'On' : <span className="text-danger">Off</span>) },
        { header: 'Last sign-in', render: (s) => (s.security?.lastLoginAt ? dateTime(s.security.lastLoginAt) : '—') },
        { header: '', render: (s) => String(s._id) !== me.id && (
          <div className="flex flex-wrap gap-1">
            {!s.roles.includes('superadmin') && <Button size="sm" variant="secondary" onClick={() => setEdit({ userId: s._id, permissions: s.staffPermissions || [], reason: '' })}>Permissions</Button>}
            {isSuper && <Button size="sm" variant="ghost" onClick={() => setDlg({ kind: 'super', s })}>{s.roles.includes('superadmin') ? 'Remove superadmin' : 'Make superadmin'}</Button>}
            <Button size="sm" variant="ghost" onClick={() => setDlg({ kind: '2fa', s })}>Reset 2-step</Button>
            {!s.roles.includes('superadmin') && <Button size="sm" variant="ghost" onClick={() => setDlg({ kind: 'remove', s })}>Remove staff access</Button>}
          </div>
        ) },
      ]} />
      <Dialog wide open={Boolean(edit)} onClose={() => setEdit(null)} title={edit?.isNew ? 'Make this person staff' : 'Change permissions'} footer={<><Button variant="secondary" onClick={() => setEdit(null)}>Cancel</Button><Button loading={initiate.isPending} disabled={!edit?.permissions.length || (edit?.reason || '').length < 10} onClick={() => initiate.mutate({ action: 'staff.set_permissions', payload: { userId: edit.userId, makeAdmin: true, permissions: edit.permissions }, reason: edit.reason })}>Send for approval</Button></>}>
        {edit && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">{Object.entries(presets).map(([k, list]) => <Button key={k} size="sm" variant="secondary" onClick={() => setEdit({ ...edit, permissions: list })}>{humanize(k)} preset</Button>)}</div>
            <div className="grid max-h-80 gap-1 overflow-y-auto sm:grid-cols-2">
              {Object.entries(permissions).filter(([k]) => !superadminOnly.includes(k)).map(([k, desc]) => (
                <label key={k} className="flex items-start gap-2 rounded p-1.5 text-sm hover:bg-ink/5"><input type="checkbox" className="mt-1 h-4 w-4" checked={edit.permissions.includes(k)} onChange={(e) => setEdit({ ...edit, permissions: e.target.checked ? [...edit.permissions, k] : edit.permissions.filter((x) => x !== k) })} /><span><code className="text-xs">{k}</code><span className="block text-muted">{desc}</span></span></label>
              ))}
            </div>
            <Textarea label="Reason" value={edit.reason} onChange={(e) => setEdit({ ...edit, reason: e.target.value })} hint="At least 10 characters." />
          </div>
        )}
      </Dialog>
      <ReasonApproval open={dlg?.kind === 'super'} onClose={() => setDlg(null)} title={dlg?.s.roles.includes('superadmin') ? 'Remove superadmin?' : 'Grant superadmin?'} loading={initiate.isPending} onSubmit={(reason) => initiate.mutate({ action: 'staff.grant_superadmin', payload: { userId: dlg.s._id, grant: !dlg.s.roles.includes('superadmin') }, reason })} />
      <ReasonApproval open={dlg?.kind === '2fa'} onClose={() => setDlg(null)} title="Reset two-step verification?" body="They’ll have to set it up again before using the console. Confirm their identity out of band first." loading={initiate.isPending} onSubmit={(reason) => initiate.mutate({ action: 'security.reset_staff_2fa', payload: { userId: dlg.s._id }, reason })} />
      <ReasonApproval open={dlg?.kind === 'remove'} onClose={() => setDlg(null)} title="Remove staff access?" loading={initiate.isPending} onSubmit={(reason) => initiate.mutate({ action: 'staff.set_permissions', payload: { userId: dlg.s._id, makeAdmin: false, permissions: [] }, reason })} />
    </>
  );
}

function ReasonApproval({ open, onClose, title, body, onSubmit, loading }) {
  const [r, setR] = useState('');
  return (
    <Dialog open={open} onClose={onClose} title={title} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={loading} disabled={r.length < 10} onClick={() => onSubmit(r)}>Send for approval</Button></>}>
      {body && <p className="mb-3 text-sm">{body}</p>}
      <Textarea label="Reason" value={r} onChange={(e) => setR(e.target.value)} hint="At least 10 characters. A second person must approve." />
    </Dialog>
  );
}

export { ReasonApproval, Tabs };
