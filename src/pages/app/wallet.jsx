import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDownLeft, ArrowUpRight, Plus, Send, Banknote, Download } from 'lucide-react';
import { get, post, del, download } from '../../lib/api';
import { naira, dateTime, humanize, toKobo } from '../../lib/format';
import { useSession } from '../../lib/session';
import { Button, EmptyState, ErrorState, Input, KeyValue, Money, Notice, PageHeader, Pagination, Panel, Select, Spinner, Status, Table, Tabs } from '../../components/ui';
import { Dialog } from '../../components/ui/dialog';
import { MoneyInput, PolicyConsent } from '../../components/ui/forms';
import { toast, toastError } from '../../components/ui/toast';
import { BalanceStrip, useFinancialAction } from '../../components/domain';

export function useWallet() {
  return useQuery({ queryKey: ['wallet'], queryFn: () => get('/wallet'), refetchInterval: 30000 });
}

function TierNotice({ need, action }) {
  const { user } = useSession();
  if (user.verificationTier >= need) return null;
  return (
    <Notice tone="warn" title={`${action} needs more verification`}>
      {need === 1 ? 'Verify your phone number to unlock wallet funding, transfers and savings.' : 'Verify your identity to unlock withdrawals and higher limits.'} <Link className="link" to="/app/verification">Verify now</Link>
    </Notice>
  );
}

function FundDialog({ open, onClose }) {
  const [amount, setAmount] = useState('');
  const [accepted, setAccepted] = useState([]);
  const outstanding = useQuery({ queryKey: ['terms', 'wallet'], queryFn: () => get('/account/terms/outstanding?context=wallet'), enabled: open });
  const kobo = toKobo(amount);
  const fund = useFinancialAction((_, key) => post('/wallet/fund', { amountKobo: kobo, acceptedPolicies: accepted.length ? accepted : undefined }, { idempotencyKey: key }), {
    onSuccess: (r) => {
      if (r.authorizationUrl) window.location.assign(r.authorizationUrl);
    },
  });
  const needsTerms = (outstanding.data || []).length > 0;
  return (
    <Dialog open={open} onClose={onClose} title="Add money" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={fund.isPending} disabled={!kobo || (needsTerms && !accepted.length)} onClick={() => fund.mutate()}>Continue to Paystack</Button></>}>
      <div className="space-y-4">
        <MoneyInput label="Amount" value={amount} onChange={setAmount} hint="Minimum ₦100. Your limits depend on your verification level." />
        {needsTerms && <PolicyConsent slugs={['wallet_terms']} accepted={accepted} onChange={setAccepted} />}
        <p className="text-sm text-muted">You’ll pay on Paystack’s secure page. Your wallet is credited only after Paystack confirms the payment — closing the page early does not lose your money, and you should not pay twice.</p>
      </div>
    </Dialog>
  );
}

function TransferDialog({ open, onClose }) {
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [narration, setNarration] = useState('');
  const [found, setFound] = useState(null);
  const [step, setStep] = useState('form');
  const lookup = useMutation({ mutationFn: () => get(`/wallet/recipient?identifier=${encodeURIComponent(recipient)}`), onSuccess: (r) => { setFound(r); setStep('confirm'); }, onError: toastError });
  const kobo = toKobo(amount);
  const send = useFinancialAction((_, key) => post('/wallet/transfers', { recipient, amountKobo: kobo, narration: narration || undefined }, { idempotencyKey: key }), {
    invalidate: [['wallet'], ['transactions']],
    onSuccess: (r) => {
      toast({ tone: r.status === 'held' ? 'info' : 'success', title: r.status === 'held' ? 'Transfer under review' : 'Transfer sent', body: r.status === 'held' ? 'For your security we’re reviewing this transfer. The money is reserved until then.' : `${naira(r.amountKobo)} sent.` });
      onClose();
      setStep('form');
    },
  });
  return (
    <Dialog open={open} onClose={() => { onClose(); setStep('form'); }} title={step === 'confirm' ? 'Confirm transfer' : 'Send money'} footer={step === 'form' ? <><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={!recipient || !kobo} loading={lookup.isPending} onClick={() => lookup.mutate()}>Review</Button></> : <><Button variant="secondary" onClick={() => setStep('form')}>Back</Button><Button loading={send.isPending} onClick={() => send.mutate()}>Send {naira(kobo)}</Button></>}>
      {step === 'form' ? (
        <div className="space-y-4">
          <Input label="Recipient" value={recipient} onChange={(e) => setRecipient(e.target.value)} hint="Their MubaPay email or verified phone number." />
          <MoneyInput label="Amount" value={amount} onChange={setAmount} hint="Transfers between MubaPay users are free." />
          <Input label="Note (optional)" maxLength={140} value={narration} onChange={(e) => setNarration(e.target.value)} />
        </div>
      ) : (
        <KeyValue items={[['To', found?.displayName], ['Amount', naira(kobo)], ['Fee', '₦0'], ['Note', narration || '—']]} />
      )}
    </Dialog>
  );
}

function WithdrawDialog({ open, onClose }) {
  const banks = useQuery({ queryKey: ['bank-accounts'], queryFn: () => get('/wallet/bank-accounts'), enabled: open });
  const [bankId, setBankId] = useState('');
  const [amount, setAmount] = useState('');
  const kobo = toKobo(amount);
  const w = useFinancialAction((_, key) => post('/wallet/withdrawals', { amountKobo: kobo, bankAccountId: bankId }, { idempotencyKey: key }), {
    invalidate: [['wallet'], ['withdrawals']],
    onSuccess: () => {
      toast({ tone: 'success', title: 'Withdrawal requested', body: 'The amount is reserved while our team reviews it.' });
      onClose();
    },
  });
  useEffect(() => {
    if (banks.data?.length && !bankId) setBankId(banks.data[0].id);
  }, [banks.data]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Dialog open={open} onClose={onClose} title="Withdraw to bank" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={!kobo || !bankId} loading={w.isPending} onClick={() => w.mutate()}>Request withdrawal</Button></>}>
      {banks.isLoading ? <Spinner /> : !banks.data?.length ? <EmptyState title="Add a bank account first" action={<Button to="/app/wallet?tab=banks" onClick={onClose}>Add bank account</Button>} /> : (
        <div className="space-y-4">
          <Select label="Bank account" value={bankId} onChange={(e) => setBankId(e.target.value)} options={banks.data.map((b) => ({ value: b.id, label: `${b.bankName || b.bankCode} •••• ${b.accountNumberLast4}${b.accountName ? ` (${b.accountName})` : ''}` }))} />
          <MoneyInput label="Amount" value={amount} onChange={setAmount} hint="Minimum ₦1,000. Every withdrawal is reviewed by our team before payout." />
        </div>
      )}
    </Dialog>
  );
}

function BankAccounts() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['bank-accounts'], queryFn: () => get('/wallet/bank-accounts') });
  const banks = useQuery({ queryKey: ['banks'], queryFn: () => get('/wallet/banks'), retry: false });
  const [bankCode, setBankCode] = useState('');
  const [acct, setAcct] = useState('');
  const add = useMutation({ mutationFn: () => post('/wallet/bank-accounts', { bankCode, bankName: banks.data?.find((b) => b.code === bankCode)?.name, accountNumber: acct }), onSuccess: (r) => { qc.invalidateQueries({ queryKey: ['bank-accounts'] }); setAcct(''); toast({ tone: r.nameMatchStatus === 'mismatch' ? 'danger' : 'success', title: r.nameMatchStatus === 'mismatch' ? 'Account name doesn’t match your verified name' : 'Bank account added', body: r.accountName }); }, onError: toastError });
  const remove = useMutation({ mutationFn: (id) => del(`/wallet/bank-accounts/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['bank-accounts'] }) });
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel title="Saved bank accounts">
        {list.isLoading ? <Spinner /> : list.data?.length ? (
          <ul className="divide-y divide-line">
            {list.data.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 py-3">
                <div><p className="font-semibold">{b.bankName || b.bankCode} •••• {b.accountNumberLast4}</p><p className="text-sm text-muted">{b.accountName || 'Name not verified'}</p></div>
                <div className="flex items-center gap-2"><Status value={b.nameMatchStatus === 'matched' ? 'approved' : b.nameMatchStatus === 'mismatch' ? 'rejected' : 'pending'}>{b.nameMatchStatus === 'matched' ? 'Name matches' : b.nameMatchStatus === 'mismatch' ? 'Name mismatch' : 'Unverified'}</Status><Button variant="ghost" size="sm" onClick={() => remove.mutate(b.id)}>Remove</Button></div>
              </li>
            ))}
          </ul>
        ) : <EmptyState title="No bank accounts yet" body="Add the account you want withdrawals paid into. It must be in your verified name." />}
      </Panel>
      <Panel title="Add a bank account">
        {banks.isError ? <Notice tone="warn">Bank list unavailable: {banks.error.message}</Notice> : (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); add.mutate(); }}>
            <Select label="Bank" value={bankCode} onChange={(e) => setBankCode(e.target.value)} placeholder="Choose your bank" required options={(banks.data || []).map((b) => ({ value: b.code, label: b.name }))} />
            <Input label="Account number" inputMode="numeric" maxLength={10} value={acct} onChange={(e) => setAcct(e.target.value.replace(/\D/g, ''))} required hint="10-digit NUBAN. We’ll check the name with your bank." />
            <Button type="submit" loading={add.isPending} disabled={acct.length !== 10 || !bankCode}>Verify and add</Button>
          </form>
        )}
      </Panel>
    </div>
  );
}

function Transactions() {
  const [page, setPage] = useState(1);
  const [type, setType] = useState('');
  const q = useQuery({ queryKey: ['transactions', page, type], queryFn: () => get(`/wallet/transactions?page=${page}${type ? `&type=${type}` : ''}`), keepPreviousData: true });
  const [range, setRange] = useState({ from: new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10), to: new Date().toISOString().slice(0, 10) });
  const dl = (fmt) => download(`/account/statements/wallet/${fmt}?from=${range.from}T00:00:00.000Z&to=${range.to}T23:59:59.999Z`, `mubapay-wallet-statement.${fmt}`).catch(toastError);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <Select label="Type" value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} placeholder="All" options={['wallet_funding', 'transfer', 'withdrawal_hold', 'withdrawal_release', 'order_payment', 'order_refund', 'savings_deposit', 'savings_maturity', 'savings_early_exit', 'viewing_fee_payment', 'seller_settlement_release']} className="w-56" />
      </div>
      {q.isError ? <ErrorState error={q.error} /> : q.isLoading ? <Spinner /> : (
        <Table caption="Wallet transactions" rows={q.data.data} rowKey={(r) => r.reference} empty={<EmptyState title="No transactions yet" body="Add money to get started." />} columns={[
          { header: 'Date', render: (r) => dateTime(r.postedAt) },
          { header: 'Description', render: (r) => <><p className="font-medium">{r.description}</p><p className="text-xs text-muted">{r.reference}</p></> },
          { header: 'Amount', align: 'right', render: (r) => <span className={r.direction === 'in' ? 'text-palm' : ''}>{r.direction === 'in' ? <ArrowDownLeft className="mr-1 inline h-4 w-4" aria-label="Money in" /> : <ArrowUpRight className="mr-1 inline h-4 w-4" aria-label="Money out" />}<Money kobo={r.direction === 'in' ? r.amountKobo : -r.amountKobo} /></span> },
          { header: 'Balance after', align: 'right', render: (r) => <Money kobo={r.balanceAfterKobo} /> },
        ]} />
      )}
      <Pagination meta={q.data?.meta} onPage={setPage} />
      <Panel title="Download a statement">
        <div className="flex flex-wrap items-end gap-3">
          <Input label="From" type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
          <Input label="To" type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
          {['pdf', 'csv', 'xlsx'].map((f) => <Button key={f} variant="secondary" onClick={() => dl(f)}><Download className="h-4 w-4" aria-hidden /> {f.toUpperCase()}</Button>)}
        </div>
      </Panel>
    </div>
  );
}

function Withdrawals() {
  const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: ['withdrawals', page], queryFn: () => get(`/wallet/withdrawals?page=${page}`) });
  if (q.isLoading) return <Spinner />;
  if (q.isError) return <ErrorState error={q.error} />;
  return (
    <>
      <Table caption="Withdrawals" rows={q.data.data} empty={<EmptyState title="No withdrawals yet" />} columns={[
        { header: 'Requested', render: (r) => dateTime(r.createdAt) },
        { header: 'Reference', key: 'reference' },
        { header: 'Amount', align: 'right', render: (r) => <Money kobo={r.amountKobo} /> },
        { header: 'Status', render: (r) => <><Status value={r.status} />{r.rejectionReason && <p className="mt-1 text-xs text-muted">{r.rejectionReason}</p>}</> },
      ]} />
      <Pagination meta={q.data.meta} onPage={setPage} />
    </>
  );
}

export function WalletPage() {
  const [sp, setSp] = useSearchParams();
  const tab = sp.get('tab') || 'activity';
  const w = useWallet();
  const [dlg, setDlg] = useState(null);
  return (
    <>
      <PageHeader title="Wallet" actions={<>
        <Button onClick={() => setDlg('fund')}><Plus className="h-4 w-4" aria-hidden /> Add money</Button>
        <Button variant="secondary" onClick={() => setDlg('transfer')}><Send className="h-4 w-4" aria-hidden /> Send</Button>
        <Button variant="secondary" onClick={() => setDlg('withdraw')}><Banknote className="h-4 w-4" aria-hidden /> Withdraw</Button>
      </>} />
      <div className="space-y-3"><TierNotice need={1} action="Funding" /></div>
      <div className="mt-4 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Panel>{w.isLoading ? <Spinner /> : w.isError ? <ErrorState error={w.error} onRetry={w.refetch} /> : <BalanceStrip overview={w.data} />}</Panel>
        {w.data && (
          <Panel title="Your limits">
            <p className="text-sm text-muted">Verification level {w.data.limits.tier}</p>
            <dl className="mt-3 space-y-2 text-sm">
              {[['Funding today', w.data.limits.used.fundingDaily, w.data.limits.limits.fundingDaily], ['Transfers today', w.data.limits.used.transferDaily, w.data.limits.limits.transferDaily], ['Withdrawals today', w.data.limits.used.withdrawalDaily, w.data.limits.limits.withdrawalDaily]].map(([l, used, max]) => (
                <div key={l} className="flex justify-between gap-3"><dt>{l}</dt><dd className="tnum">{max ? `${naira(used)} of ${naira(max)}` : 'Not available yet'}</dd></div>
              ))}
            </dl>
            {w.data.limits.tier < 2 && <Link to="/app/verification" className="link mt-3 inline-block text-sm">Raise your limits</Link>}
          </Panel>
        )}
      </div>
      <div className="mt-8">
        <Tabs value={tab} onChange={(t) => setSp({ tab: t })} tabs={[{ value: 'activity', label: 'Activity' }, { value: 'withdrawals', label: 'Withdrawals' }, { value: 'banks', label: 'Bank accounts' }]} />
        {tab === 'activity' && <Transactions />}
        {tab === 'withdrawals' && <Withdrawals />}
        {tab === 'banks' && <BankAccounts />}
      </div>
      <FundDialog open={dlg === 'fund'} onClose={() => setDlg(null)} />
      <TransferDialog open={dlg === 'transfer'} onClose={() => setDlg(null)} />
      <WithdrawDialog open={dlg === 'withdraw'} onClose={() => setDlg(null)} />
    </>
  );
}

/** Return page after Paystack: polls the server until the payment is verified (never trusts the redirect). */
export function PaymentReturnPage({ backTo = '/app/wallet', backLabel = 'Back to wallet' }) {
  const [sp] = useSearchParams();
  const ref = sp.get('reference') || sp.get('trxref');
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['payment', ref],
    queryFn: () => get(`/wallet/payments/${encodeURIComponent(ref)}`),
    enabled: Boolean(ref),
    refetchInterval: (query) => (['pending', 'initialized', 'uncertain'].includes(query.state.data?.status) ? 4000 : false),
  });
  useEffect(() => {
    if (q.data?.fulfilled) qc.invalidateQueries({ queryKey: ['wallet'] });
  }, [q.data?.fulfilled]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!ref) return <ErrorState error={{ message: 'Missing payment reference.' }} />;
  return (
    <div className="mx-auto max-w-lg">
      <PageHeader title="Payment status" />
      <Panel>
        {q.isLoading ? <Spinner label="Checking with Paystack" /> : q.isError ? <ErrorState error={q.error} onRetry={q.refetch} /> : (
          <div className="space-y-4">
            <Status value={q.data.status} />
            <p className="font-display text-3xl font-bold tnum">{naira(q.data.amountKobo + (q.data.feeKobo || 0))}</p>
            <p>{q.data.statusExplanation}</p>
            {q.data.fulfillmentNote && <Notice tone="warn">{q.data.fulfillmentNote}</Notice>}
            <p className="text-sm text-muted">Reference: {q.data.reference}</p>
            <Button to={backTo}>{backLabel}</Button>
          </div>
        )}
      </Panel>
    </div>
  );
}

export { humanize, useNavigate };
