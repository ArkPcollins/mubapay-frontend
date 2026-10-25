import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { get, post } from '../../lib/api';
import { date, dateTime, humanize, naira, toKobo } from '../../lib/format';
import { Button, Checkbox, EmptyState, ErrorState, Input, KeyValue, Money, Notice, PageHeader, Panel, Select, Spinner, Status, Table } from '../../components/ui';
import { ConfirmDialog, Dialog } from '../../components/ui/dialog';
import { MoneyInput, PolicyConsent } from '../../components/ui/forms';
import { toast, toastError } from '../../components/ui/toast';
import { useFinancialAction } from '../../components/domain';

export function SavingsListPage() {
  const q = useQuery({ queryKey: ['savings'], queryFn: () => get('/savings/accounts') });
  return (
    <>
      <PageHeader title="Savings" description="Money you’ve set aside. It doesn’t earn interest; any early-exit penalty is the one you agreed to." actions={<Button to="/app/savings/new">New savings plan</Button>} />
      {q.isLoading ? <Spinner /> : q.isError ? <ErrorState error={q.error} /> : q.data.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {q.data.map((s) => (
            <Link key={s.id} to={`/app/savings/${s.id}`} className="panel block p-5 hover:border-ink/40">
              <div className="flex items-start justify-between gap-3"><p className="font-display text-lg font-bold">{s.name}</p><Status value={s.status} /></div>
              <p className="mt-2 font-display text-3xl font-extrabold tnum">{naira(s.balanceKobo)}</p>
              {s.targetKobo ? (
                <>
                  <div className="mt-3 h-2 rounded-full bg-ink/10" role="progressbar" aria-label="Progress to target" aria-valuenow={Math.round(s.progress * 100)} aria-valuemin={0} aria-valuemax={100}><div className="h-full rounded-full bg-kola" style={{ width: `${s.progress * 100}%` }} /></div>
                  <p className="mt-1 text-sm text-muted">{Math.round(s.progress * 100)}% of {naira(s.targetKobo)}</p>
                </>
              ) : null}
              <p className="mt-3 text-sm text-muted">{s.status === 'active' || s.status === 'paused' ? `Matures ${date(s.maturityDate)} (${s.daysToMaturity} days)` : `Closed`}{s.schedule?.frequency ? `, ${naira(s.schedule.amountKobo)} ${s.schedule.frequency}` : ''}</p>
            </Link>
          ))}
        </div>
      ) : <EmptyState title="No savings plans yet" body="Start with any amount. You choose when the money becomes available." action={<Button to="/app/savings/new">Start saving</Button>} />}
    </>
  );
}

export function SavingsNewPage() {
  const nav = useNavigate();
  const plans = useQuery({ queryKey: ['plans'], queryFn: () => get('/savings/plans') });
  const cards = useQuery({ queryKey: ['cards'], queryFn: () => get('/wallet/cards') });
  const outstanding = useQuery({ queryKey: ['terms', 'savings'], queryFn: () => get('/account/terms/outstanding?context=savings') });
  const [planId, setPlanId] = useState('');
  const [f, setF] = useState({ name: '', target: '', durationDays: 90, frequency: 'monthly', amount: '', fundingSource: 'wallet', savedCardId: '', payoutPreference: 'wallet' });
  const [confirm, setConfirm] = useState(false);
  const [accepted, setAccepted] = useState([]);
  const plan = plans.data?.find((p) => p.id === planId);
  const create = useMutation({
    mutationFn: () => post('/savings/accounts', {
      planId, name: f.name || undefined, targetKobo: toKobo(f.target) || undefined, durationDays: Number(f.durationDays), confirmTerms: confirm, payoutPreference: f.payoutPreference,
      acceptedPolicies: accepted.length ? accepted : undefined,
      ...(plan?.contributionMode === 'scheduled' ? { frequency: f.frequency, amountKobo: toKobo(f.amount), fundingSource: f.fundingSource, savedCardId: f.fundingSource === 'card' ? f.savedCardId : undefined } : {}),
    }),
    onSuccess: (r) => { toast({ tone: 'success', title: 'Savings plan created' }); nav(`/app/savings/${r.id}`); },
    onError: toastError,
  });
  if (plans.isLoading) return <Spinner />;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="New savings plan" />
      <fieldset className="space-y-3">
        <legend className="label">Choose a plan</legend>
        {(plans.data || []).map((p) => (
          <label key={p.id} className={`panel flex cursor-pointer gap-3 p-4 ${planId === p.id ? 'border-palm ring-2 ring-palm/30' : ''}`}>
            <input type="radio" name="plan" className="mt-1 h-5 w-5 accent-[rgb(var(--palm))]" checked={planId === p.id} onChange={() => { setPlanId(p.id); setF({ ...f, durationDays: Math.max(p.minDurationDays, Math.min(p.maxDurationDays, f.durationDays)) }); }} />
            <span><span className="font-semibold">{p.name}</span><span className="block text-sm text-muted">{p.description}</span><span className="mt-1 block text-sm">{p.disclosures.penalty}</span></span>
          </label>
        ))}
      </fieldset>
      {plan && (
        <form className="mt-6 space-y-4" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
          <Input label="Name your goal" placeholder="e.g. Rent for next year" value={f.name} onChange={set('name')} />
          <MoneyInput label="Target amount (optional)" value={f.target} onChange={(v) => setF({ ...f, target: v })} />
          <Input label="Lock for (days)" type="number" min={plan.minDurationDays} max={plan.maxDurationDays} value={f.durationDays} onChange={set('durationDays')} hint={`Between ${plan.minDurationDays} and ${plan.maxDurationDays} days. Matures on ${date(Date.now() + Number(f.durationDays || 0) * 864e5)}.`} />
          {plan.contributionMode === 'scheduled' && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Select label="How often" value={f.frequency} onChange={set('frequency')} options={plan.allowedFrequencies} />
                <MoneyInput label="Amount each time" value={f.amount} onChange={(v) => setF({ ...f, amount: v })} hint={`Minimum ${naira(plan.minContributionKobo)}`} />
              </div>
              <Select label="Pay from" value={f.fundingSource} onChange={set('fundingSource')} options={[{ value: 'wallet', label: 'My MubaPay wallet' }, { value: 'card', label: 'A saved card' }]} />
              {f.fundingSource === 'card' && (cards.data?.length ? <Select label="Card" value={f.savedCardId} onChange={set('savedCardId')} placeholder="Choose a card" options={cards.data.map((c) => ({ value: c.id, label: `${c.brand} •••• ${c.last4}` }))} /> : <Notice tone="warn">You have no saved cards. Make a card contribution to any plan with “save card” ticked, or pay from your wallet.</Notice>)}
            </>
          )}
          <Select label="At maturity, send my money to" value={f.payoutPreference} onChange={set('payoutPreference')} options={[{ value: 'wallet', label: 'My MubaPay wallet' }, { value: 'bank', label: 'My bank (via a withdrawal request)' }]} />
          <Panel title="Before you confirm">
            <ul className="list-disc space-y-1.5 pl-5 text-sm">
              <li>{plan.disclosures.interest}</li>
              <li>{plan.disclosures.penalty}</li>
              <li>{plan.disclosures.missed}</li>
              <li>{plan.disclosures.maturity}</li>
            </ul>
            {(outstanding.data || []).length > 0 && <div className="mt-4"><PolicyConsent slugs={['savings_terms']} accepted={accepted} onChange={setAccepted} /></div>}
            <Checkbox className="mt-4" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} label="I understand these terms, including the early-exit penalty" description="These terms are saved with your plan and won’t change unless you agree to new ones." />
          </Panel>
          <Button type="submit" loading={create.isPending} disabled={!confirm}>Create savings plan</Button>
        </form>
      )}
    </div>
  );
}

function DepositDialog({ open, onClose, account }) {
  const [amount, setAmount] = useState('');
  const [source, setSource] = useState('wallet');
  const [saveCard, setSaveCard] = useState(true);
  const kobo = toKobo(amount);
  const m = useFinancialAction((_, key) => post(`/savings/accounts/${account.id}/deposits`, { amountKobo: kobo, source, saveCard }, { idempotencyKey: key }), {
    invalidate: [['savings'], ['wallet']],
    onSuccess: (r) => {
      if (r.authorizationUrl) return window.location.assign(r.authorizationUrl);
      toast({ tone: 'success', title: 'Added to savings', body: naira(kobo) });
      onClose();
    },
  });
  return (
    <Dialog open={open} onClose={onClose} title={`Add to ${account.name}`} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={!kobo} loading={m.isPending} onClick={() => m.mutate()}>{source === 'wallet' ? 'Move money' : 'Continue to Paystack'}</Button></>}>
      <div className="space-y-4">
        <MoneyInput label="Amount" value={amount} onChange={setAmount} />
        <Select label="From" value={source} onChange={(e) => setSource(e.target.value)} options={[{ value: 'wallet', label: 'Wallet' }, { value: 'card', label: 'Card (Paystack)' }]} />
        {source === 'card' && <Checkbox checked={saveCard} onChange={(e) => setSaveCard(e.target.checked)} label="Save this card for scheduled contributions" />}
      </div>
    </Dialog>
  );
}

export function SavingsDetailPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['savings', id], queryFn: () => get(`/savings/accounts/${id}`) });
  const [dlg, setDlg] = useState(null);
  const quote = useQuery({ queryKey: ['savings', id, 'exit'], queryFn: () => get(`/savings/accounts/${id}/early-exit`), enabled: dlg === 'exit' });
  const exit = useMutation({ mutationFn: () => post(`/savings/accounts/${id}/early-exit`, { confirmPenaltyKobo: quote.data.penaltyKobo }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['savings'] }); qc.invalidateQueries({ queryKey: ['wallet'] }); setDlg(null); toast({ tone: 'success', title: 'Plan closed', body: 'The money is in your wallet.' }); }, onError: toastError });
  const toggle = useMutation({ mutationFn: (action) => post(`/savings/accounts/${id}/${action}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['savings', id] }), onError: toastError });
  if (q.isLoading) return <Spinner />;
  if (q.isError) return <ErrorState error={q.error} />;
  const s = q.data;
  const open = ['active', 'paused'].includes(s.status);
  return (
    <>
      <PageHeader title={s.name} description={`${s.terms.planName}, ${humanize(s.terms.contributionMode)}`} actions={open && <>
        <Button onClick={() => setDlg('deposit')}>Add money</Button>
        {s.schedule?.frequency && <Button variant="secondary" onClick={() => toggle.mutate(s.status === 'paused' ? 'resume' : 'pause')}>{s.status === 'paused' ? 'Resume schedule' : 'Pause schedule'}</Button>}
        {!s.withdrawal.eligibleWithoutPenalty && <Button variant="ghost" onClick={() => setDlg('exit')}>Close early</Button>}
      </>} />
      {s.status === 'paused' && <div className="mb-4"><Notice tone="warn" title="Schedule paused">{s.consecutiveMissed ? `Paused after ${s.consecutiveMissed} missed contributions, as set out in your plan terms. ` : ''}Your balance is safe. Resume whenever you’re ready.</Notice></div>}
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Panel>
          <p className="text-sm text-muted">Balance</p>
          <p className="font-display text-4xl font-extrabold tnum">{naira(s.balanceKobo)}</p>
          {s.targetKobo ? <div className="mt-4 h-2.5 rounded-full bg-ink/10" role="progressbar" aria-label="Progress" aria-valuenow={Math.round(s.progress * 100)} aria-valuemin={0} aria-valuemax={100}><div className="h-full rounded-full bg-kola" style={{ width: `${s.progress * 100}%` }} /></div> : null}
          <div className="mt-5"><KeyValue items={[['Status', <Status key="s" value={s.status} />], ['Matures', date(s.maturityDate)], ['Days left', s.daysToMaturity], s.schedule?.frequency && ['Next contribution', `${naira(s.schedule.amountKobo)} on ${date(s.schedule.nextDueAt)}`], ['Paid out to', s.payoutPreference === 'bank' ? 'Bank (withdrawal request)' : 'Wallet']]} /></div>
        </Panel>
        <Panel title="Your accepted terms">
          <p className="text-sm">{s.terms.disclosure}</p>
          <p className="mt-2 text-sm text-muted">Accepted {dateTime(s.terms.acceptedAt)}. Grace period {s.terms.graceDays} day(s).</p>
          {open && <p className="mt-3 text-sm">Closing now: penalty {naira(s.withdrawal.earlyExitPenaltyKobo)}, you’d receive {naira(s.withdrawal.earlyExitPayoutKobo)}.</p>}
        </Panel>
      </div>
      <h2 className="mb-3 mt-8 text-lg font-bold">Contributions</h2>
      <Table caption="Contributions" rows={s.contributions} rowKey={(r) => r.reference} empty={<EmptyState title="No contributions yet" />} columns={[
        { header: 'Date', render: (r) => dateTime(r.createdAt) },
        { header: 'Type', render: (r) => `${humanize(r.kind)} from ${r.source === 'wallet' ? 'wallet' : 'card'}` },
        { header: 'Amount', align: 'right', render: (r) => <Money kobo={r.amountKobo} /> },
        { header: 'Status', render: (r) => <><Status value={r.status} />{r.failureReason && <p className="mt-1 text-xs text-muted">{r.failureReason}</p>}</> },
      ]} />
      {dlg === 'deposit' && <DepositDialog open onClose={() => setDlg(null)} account={s} />}
      <ConfirmDialog open={dlg === 'exit'} onClose={() => setDlg(null)} danger loading={exit.isPending} title="Close this plan early?" confirmLabel={quote.data ? `Close and receive ${naira(quote.data.payoutKobo)}` : 'Close plan'} onConfirm={() => exit.mutate()} body={quote.isLoading ? <Spinner /> : quote.data && <div className="space-y-2"><KeyValue items={[['Balance', naira(quote.data.balanceKobo)], ['Early-exit penalty', naira(quote.data.penaltyKobo)], ['You receive in your wallet', naira(quote.data.payoutKobo)]]} /><p className="text-muted">{quote.data.statement}</p></div>} />
    </>
  );
}
