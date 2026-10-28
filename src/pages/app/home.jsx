import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CheckCircle2, Circle, Package, CalendarClock, PiggyBank, LifeBuoy } from 'lucide-react';
import { get, post } from '../../lib/api';
import { dateTime, naira } from '../../lib/format';
import { useSession } from '../../lib/session';
import { Button, EmptyState, Input, Money, Notice, PageHeader, Panel, Spinner, Status } from '../../components/ui';
import { toast, toastError } from '../../components/ui/toast';
import { BalanceStrip } from '../../components/domain';
import { useWallet } from './wallet';

function VerificationProgress() {
  const { user } = useSession();
  const steps = [
    ['Email verified', user.emailVerified, null],
    ['Phone verified', user.phoneVerified, '/app/onboarding'],
    ['Identity verified', user.kycStatus === 'approved', '/app/verification'],
  ];
  if (steps.every((s) => s[1])) return null;
  return (
    <Panel title="Finish verifying your account">
      <ol className="space-y-2">
        {steps.map(([l, done, to]) => (
          <li key={l} className="flex items-center gap-2">
            {done ? <CheckCircle2 className="h-5 w-5 text-palm" aria-label="Done" /> : <Circle className="h-5 w-5 text-muted" aria-label="Not done" />}
            <span className={done ? 'text-muted line-through' : 'font-medium'}>{l}</span>
            {!done && to && <Link to={to} className="link ml-auto text-sm">Do this now</Link>}
          </li>
        ))}
      </ol>
      {user.kycStatus === 'pending' && <p className="mt-3 text-sm text-muted">Your identity documents are being reviewed.</p>}
    </Panel>
  );
}

export function DashboardPage() {
  const { user } = useSession();
  const w = useWallet();
  const tx = useQuery({ queryKey: ['transactions', 'recent'], queryFn: () => get('/wallet/transactions?limit=5') });
  const savings = useQuery({ queryKey: ['savings'], queryFn: () => get('/savings/accounts') });
  const orders = useQuery({ queryKey: ['orders', 'recent'], queryFn: () => get('/marketplace/orders?limit=3') });
  const appts = useQuery({ queryKey: ['appointments', 'customer'], queryFn: () => get('/realestate/appointments?as=customer') });
  const notes = useQuery({ queryKey: ['notifications', 'recent'], queryFn: () => get('/notifications?limit=5') });
  const tickets = useQuery({ queryKey: ['tickets'], queryFn: () => get('/support/tickets') });
  const saved = useQuery({ queryKey: ['saved-products'], queryFn: () => get('/marketplace/saved') });
  const resend = useMutation({ mutationFn: () => post('/auth/resend-verification'), onSuccess: () => toast({ tone: 'success', title: 'Verification email sent' }), onError: toastError });
  return (
    <>
      <PageHeader title={`Hello, ${user.firstName || 'there'}`} />
      {!user.emailVerified && <div className="mb-4"><Notice tone="warn" title="Verify your email">Check your inbox for the link we sent to {user.email}. <button className="link" onClick={() => resend.mutate()}>Send it again</button></Notice></div>}
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Panel title="Wallet" action={<Link to="/app/wallet" className="link text-sm">Open wallet</Link>}>{w.isLoading ? <Spinner /> : w.data && <BalanceStrip overview={w.data} />}</Panel>
          <Panel title="Recent activity" action={<Link to="/app/wallet" className="link text-sm">See all</Link>}>
            {tx.data?.data?.length ? (
              <ul className="divide-y divide-line">{tx.data.data.map((t) => <li key={t.reference} className="flex justify-between gap-3 py-2.5 text-sm"><span><span className="font-medium">{t.description}</span><span className="block text-xs text-muted">{dateTime(t.postedAt)}</span></span><Money kobo={t.direction === 'in' ? t.amountKobo : -t.amountKobo} className={t.direction === 'in' ? 'font-semibold text-palm' : 'font-semibold'} /></li>)}</ul>
            ) : <EmptyState title="No activity yet" body="Add money to your wallet to get started." action={<Button to="/app/wallet">Add money</Button>} />}
          </Panel>
          <div className="grid gap-6 sm:grid-cols-2">
            <Panel title="Orders" action={<Link to="/app/orders" className="link text-sm">All orders</Link>}>
              {orders.data?.data?.length ? orders.data.data.map((o) => <Link key={o.id} to={`/app/orders/${o.id}`} className="flex items-center justify-between gap-2 py-1.5 text-sm hover:underline"><span className="inline-flex items-center gap-2"><Package className="h-4 w-4" aria-hidden />{o.orderNumber}</span><Status value={o.status} /></Link>) : <p className="text-sm text-muted">No orders yet.</p>}
            </Panel>
            <Panel title="Viewings" action={<Link to="/app/appointments" className="link text-sm">All viewings</Link>}>
              {appts.data?.length ? appts.data.slice(0, 3).map((a) => <Link key={a.id} to={`/app/appointments/${a.id}`} className="flex items-center justify-between gap-2 py-1.5 text-sm hover:underline"><span className="inline-flex items-center gap-2"><CalendarClock className="h-4 w-4" aria-hidden />{a.property?.title}</span><Status value={a.status} /></Link>) : <p className="text-sm text-muted">No viewings booked.</p>}
            </Panel>
          </div>
        </div>
        <div className="space-y-6">
          <VerificationProgress />
          <Panel title="Savings" action={<Link to="/app/savings" className="link text-sm">Open savings</Link>}>
            {savings.data?.length ? savings.data.filter((s) => ['active', 'paused'].includes(s.status)).slice(0, 3).map((s) => (
              <Link key={s.id} to={`/app/savings/${s.id}`} className="block py-2 hover:underline">
                <div className="flex justify-between gap-2 text-sm"><span className="inline-flex items-center gap-2 font-medium"><PiggyBank className="h-4 w-4 text-kola" aria-hidden />{s.name}</span><Money kobo={s.balanceKobo} className="font-semibold" /></div>
                {s.targetKobo ? <div className="mt-1.5 h-1.5 rounded-full bg-ink/10" role="progressbar" aria-valuenow={Math.round(s.progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={`${s.name} progress`}><div className="h-full rounded-full bg-kola" style={{ width: `${s.progress * 100}%` }} /></div> : null}
              </Link>
            )) : <EmptyState title="Start a savings plan" body="Set money aside for rent, fees or a goal." action={<Button to="/app/savings/new" variant="secondary">Start saving</Button>} />}
          </Panel>
          <Panel title="Notifications" action={<Link to="/app/notifications" className="link text-sm">All</Link>}>
            {notes.data?.data?.length ? notes.data.data.map((n) => <div key={n._id} className="py-1.5 text-sm"><p className={n.readAt ? '' : 'font-semibold'}>{n.title}</p><p className="text-xs text-muted">{dateTime(n.createdAt)}</p></div>) : <p className="text-sm text-muted">You’re all caught up.</p>}
          </Panel>
          <Panel title="Saved items" action={<Link to="/app/saved" className="link text-sm">View</Link>}><p className="text-sm text-muted">{saved.data?.length || 0} saved product(s).</p></Panel>
          <Panel title="Support" action={<Link to="/app/support" className="link text-sm">Open</Link>}>
            {tickets.data?.filter((t) => !['resolved', 'closed'].includes(t.status)).length ? tickets.data.filter((t) => !['resolved', 'closed'].includes(t.status)).slice(0, 3).map((t) => <Link key={t.id} to={`/app/support/${t.id}`} className="flex items-center justify-between py-1.5 text-sm hover:underline"><span className="inline-flex items-center gap-2"><LifeBuoy className="h-4 w-4" aria-hidden />{t.subject}</span><Status value={t.status} /></Link>) : <p className="text-sm text-muted">No open requests.</p>}
          </Panel>
        </div>
      </div>
    </>
  );
}

/** Guided onboarding: phone verification, then what to do next. */
export function OnboardingPage() {
  const { user, refresh } = useSession();
  const nav = useNavigate();
  const [phone, setPhone] = useState(user.phone || '');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(null);
  const send = useMutation({
     mutationFn: () => post('/auth/phone/send-code', { phone }),
     onSuccess: (response) => {
      console.log('Send code response:', response.delivered);
  
      if (response.delivered) {
        setSent(true);
      }
      }, 
      onError: (err)=>{
        console.log({err})
        toastError(err)
      } 
      // onError: toastError 
    });
  const verify = useMutation({ mutationFn: () => post('/auth/phone/verify', { code }), onSuccess: () => { refresh(); toast({ tone: 'success', title: 'Phone verified', body: 'Wallet funding, transfers and savings are now unlocked.' }); post('/account/onboarding', { step: 'phone' }).catch(() => {}); }, onError: toastError });
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageHeader title="Set up your account" description="A few quick steps unlock everything MubaPay can do." />
      <Panel title="Step 1: Verify your phone">
        {user.phoneVerified ? <Notice tone="success">Your phone {user.phone} is verified.</Notice> : (
          <div className="space-y-4">
            <Input label="Phone number" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} hint="We’ll send a 6-digit code via WhatsApp." />
            <Button variant="secondary" loading={send.isPending} onClick={() => send.mutate()}>Send code</Button>
            {/* {sent && <Notice tone="warn">Development mode: the code was captured in the server console and was not actually sent.</Notice>} */}
            {sent && (<><Input label="Code" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} autoComplete="one-time-code" /><Button loading={verify.isPending} disabled={code.length !== 6} onClick={() => verify.mutate()}>Verify phone</Button></>)}
          </div>
        )}
      </Panel>
      <Panel title="Step 2: Verify your identity">
        <p className="text-sm text-muted">Needed for withdrawals, selling used items, listing property, and higher limits.</p>
        <Button className="mt-3" variant="secondary" to="/app/verification">{user.kycStatus === 'approved' ? 'Verified' : user.kycStatus === 'pending' ? 'Under review' : 'Start identity verification'}</Button>
      </Panel>
      <Panel title="Step 3: Choose where to start">
        <div className="grid gap-3 sm:grid-cols-3">
          <Button variant="secondary" to="/app/wallet">Add money</Button>
          <Button variant="secondary" to="/app/savings/new">Start saving</Button>
          <Button variant="secondary" to="/marketplace">Shop</Button>
        </div>
      </Panel>
      <Button onClick={() => { post('/account/onboarding', { step: 'done', complete: true }).catch(() => {}); nav('/app'); }}>Go to my account</Button>
    </div>
  );
}

export { naira };
