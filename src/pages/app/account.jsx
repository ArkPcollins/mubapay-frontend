import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, del, download, get, patch, post } from '../../lib/api';
import { dateTime, humanize } from '../../lib/format';
import { useSession, useTheme } from '../../lib/session';
import { Button, Checkbox, EmptyState, ErrorState, Input, KeyValue, Notice, PageHeader, Panel, Select, Spinner, Status, Tabs, Textarea } from '../../components/ui';
import { ConfirmDialog, Dialog } from '../../components/ui/dialog';
import { FileField } from '../../components/ui/forms';
import { toast, toastError } from '../../components/ui/toast';

const NG_STATES = ['Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara'];
export const stateOptions = NG_STATES.map((s) => ({ value: s, label: s }));

// ---------------------------------------------------------------- settings
export function SettingsPage() {
  const [params, setParams] = useSearchParams();
  const { tab: pathTab } = useParams();
  const tab = params.get('tab') || pathTab || (params.get('setup2fa') ? 'security' : 'profile');
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Settings" />
      <Tabs value={tab} onChange={(t) => setParams({ tab: t })} tabs={[{ value: 'profile', label: 'Profile' }, { value: 'addresses', label: 'Addresses' }, { value: 'security', label: 'Security' }, { value: 'preferences', label: 'Notifications & display' }, { value: 'privacy', label: 'Privacy & data' }]} />
      {tab === 'profile' && <ProfileTab />}
      {tab === 'addresses' && <AddressesTab />}
      {tab === 'security' && <SecurityTab forceSetup={Boolean(params.get('setup2fa'))} />}
      {tab === 'preferences' && <PreferencesTab />}
      {tab === 'privacy' && <PrivacyTab />}
    </div>
  );
}

function ProfileTab() {
  const { user, setUser } = useSession();
  const [f, setF] = useState({ firstName: user.firstName || '', lastName: user.lastName || '' });
  const m = useMutation({ mutationFn: () => patch('/account/profile', f), onSuccess: (u) => { setUser(u); toast({ tone: 'success', title: 'Profile saved' }); }, onError: toastError });
  return (
    <Panel>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="First name" value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} required />
          <Input label="Last name" value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} required />
        </div>
        <KeyValue items={[['Email', `${user.email}${user.emailVerified ? ' (verified)' : ' (not verified)'}`], ['Phone', user.phone ? `${user.phone}${user.phoneVerified ? ' (verified)' : ' (not verified)'}` : 'Not added'], ['Verification level', humanize(user.verificationTier)], ['Member since', dateTime(user.createdAt)]]} />
        <p className="text-sm text-muted">Your name must match your ID for identity verification and withdrawals. To change your phone number, verify the new one from <a className="link" href="/app/onboarding">account setup</a>.</p>
        <Button type="submit" loading={m.isPending}>Save profile</Button>
      </form>
    </Panel>
  );
}

const blankAddress = { label: '', recipientName: '', phone: '', line1: '', line2: '', city: '', lga: '', state: 'Anambra', landmark: '', isDefault: false };

function AddressesTab() {
  const { user, refresh } = useSession();
  const [edit, setEdit] = useState(null);
  const save = useMutation({
    mutationFn: (a) => {
      const body = Object.fromEntries(Object.entries(a).filter(([k, v]) => k !== '_id' && v !== ''));
      return a._id ? patch(`/account/addresses/${a._id}`, body) : post('/account/addresses', body);
    },
    onSuccess: () => { refresh(); setEdit(null); toast({ tone: 'success', title: 'Address saved' }); },
    onError: toastError,
  });
  const remove = useMutation({ mutationFn: (id) => del(`/account/addresses/${id}`), onSuccess: () => refresh(), onError: toastError });
  return (
    <>
      <div className="mb-4 flex justify-end"><Button onClick={() => setEdit({ ...blankAddress })}>Add address</Button></div>
      {user.addresses?.length ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {user.addresses.map((a) => (
            <li key={a._id} className="rounded-xl border border-line bg-surface p-4">
              <p className="font-semibold">{a.label || 'Address'}{a.isDefault && <span className="ml-2 text-xs font-medium text-palm">Default</span>}</p>
              <p className="mt-1 text-sm">{[a.line1, a.line2, a.city, a.lga, a.state].filter(Boolean).join(', ')}</p>
              {a.landmark && <p className="text-sm text-muted">Near {a.landmark}</p>}
              <div className="mt-3 flex gap-2"><Button size="sm" variant="secondary" onClick={() => setEdit({ ...blankAddress, ...a })}>Edit</Button><Button size="sm" variant="ghost" onClick={() => remove.mutate(a._id)}>Remove</Button></div>
            </li>
          ))}
        </ul>
      ) : <EmptyState title="No saved addresses" body="Save a delivery address to check out faster." />}
      <Dialog open={Boolean(edit)} onClose={() => setEdit(null)} title={edit?._id ? 'Edit address' : 'Add address'} footer={<><Button variant="secondary" onClick={() => setEdit(null)}>Cancel</Button><Button loading={save.isPending} onClick={() => save.mutate(edit)}>Save address</Button></>}>
        {edit && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Label" placeholder="Home, Office" value={edit.label} onChange={(e) => setEdit({ ...edit, label: e.target.value })} />
            <Input label="Recipient name" value={edit.recipientName} onChange={(e) => setEdit({ ...edit, recipientName: e.target.value })} />
            <Input className="sm:col-span-2" label="Street address" value={edit.line1} onChange={(e) => setEdit({ ...edit, line1: e.target.value })} required />
            <Input className="sm:col-span-2" label="Apartment, estate (optional)" value={edit.line2} onChange={(e) => setEdit({ ...edit, line2: e.target.value })} />
            <Input label="City or town" value={edit.city} onChange={(e) => setEdit({ ...edit, city: e.target.value })} required />
            <Input label="LGA" value={edit.lga} onChange={(e) => setEdit({ ...edit, lga: e.target.value })} />
            <Select label="State" value={edit.state} onChange={(e) => setEdit({ ...edit, state: e.target.value })} options={stateOptions} />
            <Input label="Phone for delivery" type="tel" value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} />
            <Input className="sm:col-span-2" label="Landmark" value={edit.landmark} onChange={(e) => setEdit({ ...edit, landmark: e.target.value })} />
            <Checkbox className="sm:col-span-2" label="Use as my default address" checked={edit.isDefault} onChange={(e) => setEdit({ ...edit, isDefault: e.target.checked })} />
          </div>
        )}
      </Dialog>
    </>
  );
}

function SecurityTab({ forceSetup }) {
  const { user, refresh, isStaff } = useSession();
  const qc = useQueryClient();
  const [setup, setSetup] = useState(null);
  const [code, setCode] = useState('');
  const [codes, setCodes] = useState(null);
  const [dlg, setDlg] = useState(null);
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [disable, setDisable] = useState({ password: '', code: '' });
  const sessions = useQuery({ queryKey: ['sessions'], queryFn: () => get('/auth/sessions') });
  const begin = useMutation({ mutationFn: () => post('/auth/2fa/setup'), onSuccess: setSetup, onError: toastError });
  const enable = useMutation({ mutationFn: () => post('/auth/2fa/enable', { code }), onSuccess: (r) => { setCodes(r.recoveryCodes); setSetup(null); setCode(''); refresh(); }, onError: toastError });
  const off = useMutation({ mutationFn: () => post('/auth/2fa/disable', disable), onSuccess: () => { setDlg(null); refresh(); toast({ title: 'Two-step verification turned off' }); }, onError: toastError });
  const regen = useMutation({ mutationFn: (c) => post('/auth/2fa/recovery-codes', { code: c }), onSuccess: (r) => { setDlg(null); setCodes(r.recoveryCodes); }, onError: toastError });
  const change = useMutation({ mutationFn: () => post('/auth/password/change', pw), onSuccess: () => { setPw({ currentPassword: '', newPassword: '' }); toast({ tone: 'success', title: 'Password changed', body: 'Other devices have been signed out.' }); qc.invalidateQueries({ queryKey: ['sessions'] }); }, onError: toastError });
  const revoke = useMutation({ mutationFn: (id) => del(`/auth/sessions/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['sessions'] }), onError: toastError });
  const revokeAll = useMutation({ mutationFn: () => post('/auth/logout-all'), onSuccess: () => window.location.assign('/login'), onError: toastError });
  useEffect(() => {
    if (forceSetup && !user.twoFactorEnabled && !setup && !begin.isPending) begin.mutate();
  }, [forceSetup]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="space-y-6">
      {forceSetup && !user.twoFactorEnabled && <Notice tone="warn" title="Staff accounts need two-step verification">Set it up to open the staff console.</Notice>}
      <Panel title="Two-step verification">
        {user.twoFactorEnabled ? (
          <>
            <p className="text-sm">On. You’ll be asked for a code from your authenticator app when you sign in and before sensitive actions.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setDlg('regen')}>New recovery codes</Button>
              {!isStaff && <Button variant="ghost" onClick={() => setDlg('disable')}>Turn off</Button>}
            </div>
          </>
        ) : setup ? (
          <div className="space-y-4">
            <p className="text-sm">Scan this code with an authenticator app such as Google Authenticator, Microsoft Authenticator or 1Password.</p>
            <img src={setup.qrDataUrl} alt="QR code for your authenticator app" className="h-48 w-48 rounded-lg border border-line bg-white p-2" />
            <details className="text-sm"><summary className="cursor-pointer">Can’t scan? Enter this key instead</summary><code className="mt-2 block break-all rounded bg-ink/5 p-2">{setup.secret}</code></details>
            <Input label="6-digit code from the app" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
            <Button loading={enable.isPending} disabled={code.length !== 6} onClick={() => enable.mutate()}>Turn on</Button>
          </div>
        ) : (
          <>
            <p className="text-sm">Add a second step to sign-in using an authenticator app.</p>
            <Button className="mt-3" loading={begin.isPending} onClick={() => begin.mutate()}>Set up two-step verification</Button>
          </>
        )}
      </Panel>
      <Panel title="Change password">
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); change.mutate(); }}>
          <Input label="Current password" type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} hint="Leave empty if you signed up with Google and haven’t set one." />
          <Input label="New password" type="password" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} hint="At least 10 characters. Avoid passwords you use elsewhere." required />
          <Button type="submit" loading={change.isPending}>Change password</Button>
        </form>
      </Panel>
      <Panel title="Where you’re signed in" action={<Button size="sm" variant="ghost" onClick={() => setDlg('all')}>Sign out everywhere</Button>}>
        {sessions.isLoading ? <Spinner /> : (
          <ul className="divide-y divide-line">
            {(sessions.data || []).map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <span><span className="font-medium">{shortAgent(s.userAgent)}</span>{s.current && <span className="ml-2 text-xs font-semibold text-palm">This device</span>}<span className="block text-xs text-muted">Last active {dateTime(s.lastUsedAt || s.createdAt)}{s.ip ? `, from ${s.ip}` : ''}</span></span>
                {!s.current && <Button size="sm" variant="secondary" onClick={() => revoke.mutate(s.id)}>Sign out</Button>}
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Dialog open={Boolean(codes)} onClose={() => setCodes(null)} title="Save your recovery codes" footer={<Button onClick={() => setCodes(null)}>I’ve saved them</Button>}>
        <p className="text-sm">Each code works once if you lose your phone. They won’t be shown again.</p>
        <ul className="mt-3 grid grid-cols-2 gap-2 font-mono text-sm">{codes?.map((c) => <li key={c} className="rounded bg-ink/5 px-2 py-1">{c}</li>)}</ul>
      </Dialog>
      <Dialog open={dlg === 'disable'} onClose={() => setDlg(null)} title="Turn off two-step verification" footer={<><Button variant="secondary" onClick={() => setDlg(null)}>Cancel</Button><Button variant="danger" loading={off.isPending} onClick={() => off.mutate()}>Turn off</Button></>}>
        <div className="space-y-3">
          <Input label="Password" type="password" value={disable.password} onChange={(e) => setDisable({ ...disable, password: e.target.value })} />
          <Input label="Code from your app" inputMode="numeric" value={disable.code} onChange={(e) => setDisable({ ...disable, code: e.target.value })} />
        </div>
      </Dialog>
      <CodeDialog open={dlg === 'regen'} onClose={() => setDlg(null)} title="Create new recovery codes" loading={regen.isPending} onSubmit={(c) => regen.mutate(c)} />
      <ConfirmDialog open={dlg === 'all'} onClose={() => setDlg(null)} title="Sign out everywhere?" body="You’ll be signed out on every device, including this one." confirmLabel="Sign out everywhere" loading={revokeAll.isPending} onConfirm={() => revokeAll.mutate()} />
    </div>
  );
}

function CodeDialog({ open, onClose, title, onSubmit, loading }) {
  const [c, setC] = useState('');
  return (
    <Dialog open={open} onClose={onClose} title={title} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={loading} disabled={c.length < 6} onClick={() => onSubmit(c)}>Continue</Button></>}>
      <Input label="Code from your authenticator app" inputMode="numeric" maxLength={6} value={c} onChange={(e) => setC(e.target.value.replace(/\D/g, ''))} />
    </Dialog>
  );
}

function shortAgent(ua = '') {
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  return os ? `${browser} on ${os}` : browser;
}

const NOTIF_CATS = [
  ['savings', 'Savings reminders and maturity'], ['orders', 'Orders'], ['delivery', 'Delivery updates'], ['property', 'Properties and viewings'], ['support', 'Support replies'], ['disputes', 'Refunds and disputes'], ['account', 'Account and verification'],
];

function PreferencesTab() {
  const { user, setUser } = useSession();
  const { setTheme } = useTheme();
  const [prefs, setPrefs] = useState(() => ({ theme: user.preferences?.theme || 'system', marketingEmail: Boolean(user.preferences?.marketingEmail), notifications: user.preferences?.notifications || {}, shareContactWithProviders: Boolean(user.privacy?.shareContactWithProviders) }));
  const m = useMutation({ mutationFn: () => patch('/account/preferences', prefs), onSuccess: (u) => { if (u?.id) setUser(u); setTheme(prefs.theme); toast({ tone: 'success', title: 'Preferences saved' }); }, onError: toastError });
  const ch = (cat, k, v) => setPrefs({ ...prefs, notifications: { ...prefs.notifications, [cat]: { email: true, inApp: true, ...prefs.notifications[cat], [k]: v } } });
  return (
    <div className="space-y-6">
      <Panel title="Notifications">
        <p className="mb-3 text-sm text-muted">Security and money notifications are always sent by email and in the app.</p>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-muted"><th className="py-2 font-medium">Topic</th><th className="w-20 py-2 text-center font-medium">Email</th><th className="w-20 py-2 text-center font-medium">In app</th></tr></thead>
          <tbody className="divide-y divide-line">
            {NOTIF_CATS.map(([cat, label]) => (
              <tr key={cat}>
                <td className="py-2.5">{label}</td>
                <td className="text-center"><input type="checkbox" aria-label={`${label} by email`} className="h-5 w-5 accent-[rgb(var(--palm))]" checked={prefs.notifications[cat]?.email !== false} onChange={(e) => ch(cat, 'email', e.target.checked)} /></td>
                <td className="text-center"><input type="checkbox" aria-label={`${label} in app`} className="h-5 w-5 accent-[rgb(var(--palm))]" checked={prefs.notifications[cat]?.inApp !== false} onChange={(e) => ch(cat, 'inApp', e.target.checked)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <Checkbox className="mt-4" label="Send me occasional offers and product news" checked={prefs.marketingEmail} onChange={(e) => setPrefs({ ...prefs, marketingEmail: e.target.checked })} />
      </Panel>
      <Panel title="Display">
        <Select label="Theme" value={prefs.theme} onChange={(e) => setPrefs({ ...prefs, theme: e.target.value })} options={[{ value: 'system', label: 'Match my device' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
      </Panel>
      <Panel title="Sharing">
        <Checkbox label="Share my phone number with a landlord or agent once a viewing is confirmed" description="Off by default. You can always talk through MubaPay messages." checked={prefs.shareContactWithProviders} onChange={(e) => setPrefs({ ...prefs, shareContactWithProviders: e.target.checked })} />
      </Panel>
      <Button loading={m.isPending} onClick={() => m.mutate()}>Save preferences</Button>
    </div>
  );
}

function PrivacyTab() {
  const nav = useNavigate();
  const check = useQuery({ queryKey: ['closure'], queryFn: () => get('/account/closure') });
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ password: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const exp = async () => {
    setBusy(true);
    try {
      await download('/account/export', `mubapay-data-${new Date().toISOString().slice(0, 10)}.json`);
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  };
  const close = useMutation({ mutationFn: () => post('/account/closure', f), onSuccess: () => nav('/', { replace: true }), onError: toastError });
  return (
    <div className="space-y-6">
      <Panel title="Download your data">
        <p className="text-sm">Get a copy of your profile, transactions, savings, orders, viewings and messages as a JSON file. Identity document images are not included; request them from support.</p>
        <Button className="mt-3" variant="secondary" loading={busy} onClick={exp}>Download my data</Button>
      </Panel>
      <Panel title="Statements">
        <p className="text-sm">Separate statements for your wallet, savings and orders for the last 90 days.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {['wallet', 'savings', 'orders'].map((k) => ['pdf', 'csv'].map((fmt) => <Button key={k + fmt} size="sm" variant="secondary" onClick={() => download(`/account/statements/${k}/${fmt}`, `mubapay-${k}-statement.${fmt}`).catch(toastError)}>{humanize(k)} ({fmt.toUpperCase()})</Button>))}
        </div>
      </Panel>
      <Panel title="Close your account">
        <p className="text-sm">Closing removes your personal details. We keep financial records for as long as the law requires, as explained in the <a className="link" href="/legal/privacy_policy">privacy policy</a>.</p>
        {check.data && !check.data.canClose && (
          <div className="mt-3"><Notice tone="warn" title="Before you can close your account"><ul className="list-disc pl-5">{check.data.blockers.map((b) => <li key={b.code}>{b.message}</li>)}</ul></Notice></div>
        )}
        <Button className="mt-3" variant="danger" disabled={!check.data?.canClose} onClick={() => setOpen(true)}>Close my account</Button>
      </Panel>
      <Dialog open={open} onClose={() => setOpen(false)} title="Close your account" footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Keep my account</Button><Button variant="danger" disabled={f.confirm !== 'CLOSE MY ACCOUNT'} loading={close.isPending} onClick={() => close.mutate()}>Close account</Button></>}>
        <div className="space-y-3">
          <p className="text-sm">This can’t be undone.</p>
          <Input label="Password" type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
          <Input label="Type CLOSE MY ACCOUNT to confirm" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} />
        </div>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------- verification
const ID_TYPES = [['nin_slip', 'NIN slip'], ['national_id_card', 'National ID card'], ['drivers_licence', 'Driver’s licence'], ['international_passport', 'International passport'], ['voters_card', 'Voter’s card']];

export function VerificationPage() {
  const { user, refresh } = useSession();
  const qc = useQueryClient();
  const v = useQuery({ queryKey: ['verification'], queryFn: () => get('/account/verification') });
  const roles = useQuery({ queryKey: ['role-applications'], queryFn: () => get('/account/role-applications') });
  const [appeal, setAppeal] = useState(false);
  const submit = useMutation({
    mutationFn: (form) => api('/account/verification', { method: 'POST', form }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['verification'] }); refresh(); toast({ tone: 'success', title: 'Submitted for review', body: 'We’ll email you when it’s reviewed.' }); },
    onError: toastError,
  });
  const appealM = useMutation({ mutationFn: (text) => post(`/account/verification/${v.data.latest.id}/appeal`, { text }), onSuccess: () => { setAppeal(false); qc.invalidateQueries({ queryKey: ['verification'] }); }, onError: toastError });
  const applyRole = useMutation({ mutationFn: (form) => api('/account/role-applications', { method: 'POST', form }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['role-applications'] }); toast({ tone: 'success', title: 'Application sent' }); }, onError: toastError });
  if (v.isLoading) return <Spinner />;
  if (v.isError) return <ErrorState error={v.error} />;
  const latest = v.data.latest;
  const canSubmit = !latest || ['rejected', 'resubmission_required'].includes(latest.status);
  const onIdentity = (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set('address', JSON.stringify({ line1: fd.get('a_line1'), city: fd.get('a_city'), state: fd.get('a_state') }));
    ['a_line1', 'a_city', 'a_state'].forEach((k) => fd.delete(k));
    submit.mutate(fd);
  };
  const onRole = (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set('operatingStates', fd.getAll('operatingStates').join(','));
    applyRole.mutate(fd);
  };
  const pendingRoles = (roles.data || []).filter((r) => r.status === 'pending').map((r) => r.role);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Verification" description="Identity verification unlocks withdrawals, selling used items, listing property and higher limits. Your documents are stored privately and only reviewed by trained staff." />
      <Panel title="Identity">
        {latest && (
          <div className="mb-4 space-y-2">
            <KeyValue items={[['Status', <Status key="s" value={latest.status} />], ['ID', `${humanize(latest.idType)} ending ${latest.idNumberLast4}`], ['Submitted', dateTime(latest.createdAt)], latest.customerMessage && ['Message from our team', latest.customerMessage]]} />
            {latest.status === 'rejected' && !latest.appeal?.text && <Button variant="ghost" size="sm" onClick={() => setAppeal(true)}>Appeal this decision</Button>}
            {latest.appeal?.text && <p className="text-sm text-muted">Appeal sent {dateTime(latest.appeal.at)}.</p>}
          </div>
        )}
        {canSubmit ? (
          <form className="space-y-4" onSubmit={onIdentity}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input name="legalFirstName" label="First name (as on ID)" defaultValue={user.firstName} required />
              <Input name="legalLastName" label="Last name (as on ID)" defaultValue={user.lastName} required />
              <Input name="dateOfBirth" type="date" label="Date of birth" required />
              <Select name="idType" label="ID type" options={ID_TYPES.map(([value, label]) => ({ value, label }))} />
              <Input name="idNumber" label="ID number" required className="sm:col-span-2" autoComplete="off" />
              <Input name="a_line1" label="Home address" required className="sm:col-span-2" />
              <Input name="a_city" label="City or town" required />
              <Select name="a_state" label="State" options={stateOptions} defaultValue="Anambra" />
            </div>
            <FileField name="idDocument" label="Photo or scan of your ID" required />
            <FileField name="selfie" label="A clear selfie" accept="image/jpeg,image/png,image/webp" hint="Face the camera in good light, no hat or sunglasses." required />
            <FileField name="proofOfAddress" label="Proof of address (optional)" hint="A recent utility bill or bank statement." />
            <Button type="submit" loading={submit.isPending}>Submit for review</Button>
          </form>
        ) : latest.status === 'approved' ? <Notice tone="success">Your identity is verified.</Notice> : <Notice>We’re reviewing your documents. This usually takes one to two working days.</Notice>}
      </Panel>
      <Panel title="Landlords and agents">
        <p className="text-sm">To list property, apply as a landlord or agent. You’ll need a verified identity first. Approval means we checked the documents you provided; it is not a guarantee about any property.</p>
        {roles.data?.length > 0 && (
          <ul className="my-3 divide-y divide-line text-sm">{roles.data.map((r) => <li key={r._id} className="flex justify-between py-2"><span>{humanize(r.role)} application, {dateTime(r.createdAt)}{r.customerMessage ? ` — ${r.customerMessage}` : ''}</span><Status value={r.status} /></li>)}</ul>
        )}
        {user.kycStatus !== 'approved' ? <p className="mt-3 text-sm text-muted">Finish identity verification above to apply.</p> : (
          <form className="mt-4 space-y-4" onSubmit={onRole}>
            <Select name="role" label="I want to apply as" options={[{ value: 'landlord', label: 'Landlord (I own the property)' }, { value: 'agent', label: 'Agent (I market property for owners)' }].filter((o) => !pendingRoles.includes(o.value) && !user.capabilities?.[o.value])} />
            <Input name="businessName" label="Business name (optional)" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input name="registrationNumber" label="CAC or registration number (optional)" />
              <Input name="yearsExperience" type="number" min={0} label="Years of experience" />
            </div>
            <Input name="professionalBody" label="Professional body membership (optional)" hint="For example NIESV or ESVARBON registration." />
            <fieldset><legend className="label">States you operate in</legend><div className="flex flex-wrap gap-3">{['Anambra', 'Enugu', 'Imo'].map((s) => <label key={s} className="inline-flex items-center gap-2 text-sm"><input type="checkbox" name="operatingStates" value={s} className="h-4 w-4" />{s}</label>)}</div></fieldset>
            <Textarea name="statement" label="Tell us about your properties or work" />
            <FileField name="documents" label="Supporting documents" hint="Proof of ownership, agency letter or registration certificate. JPEG, PNG or PDF." />
            <Button type="submit" loading={applyRole.isPending}>Send application</Button>
          </form>
        )}
      </Panel>
      <AppealDialog open={appeal} onClose={() => setAppeal(false)} loading={appealM.isPending} onSubmit={(t) => appealM.mutate(t)} />
    </div>
  );
}

function AppealDialog({ open, onClose, onSubmit, loading }) {
  const [t, setT] = useState('');
  return (
    <Dialog open={open} onClose={onClose} title="Appeal the decision" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={loading} disabled={t.trim().length < 10} onClick={() => onSubmit(t)}>Send appeal</Button></>}>
      <Textarea label="Why should we look again?" value={t} onChange={(e) => setT(e.target.value)} hint="At least 10 characters." />
    </Dialog>
  );
}
