import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Truck, Store, Minus, Plus, Trash2 } from 'lucide-react';
import { get, post, put, del } from '../../lib/api';
import { dateTime, humanize, naira, toKobo } from '../../lib/format';
import { useSession } from '../../lib/session';
import { Button, EmptyState, ErrorState, Input, KeyValue, Money, Notice, PageHeader, Pagination, Panel, Select, Spinner, Status, Table, Tabs, Textarea } from '../../components/ui';
import { ConfirmDialog, Dialog } from '../../components/ui/dialog';
import { MoneyInput, PolicyConsent } from '../../components/ui/forms';
import { toast, toastError } from '../../components/ui/toast';
import { ProductCard, PropertyCard, StatusTimeline, useFinancialAction } from '../../components/domain';

const ISSUE = { unavailable: 'No longer available', out_of_stock: 'Out of stock', insufficient_stock: 'Not enough in stock', own_listing: 'This is your own listing' };

export function CartPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['cart'], queryFn: () => get('/marketplace/cart') });
  const set = useMutation({ mutationFn: ({ productId, quantity }) => put('/marketplace/cart', { productId, quantity }), onSuccess: (d) => qc.setQueryData(['cart'], d), onError: toastError });
  if (q.isLoading) return <Spinner />;
  if (q.isError) return <ErrorState error={q.error} />;
  const c = q.data;
  return (
    <>
      <PageHeader title="Your cart" />
      {!c.items.length ? <EmptyState title="Your cart is empty" action={<Button to="/marketplace">Browse the marketplace</Button>} /> : (
        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <ul className="space-y-3">
            {c.items.map((i) => (
              <li key={i.productId} className="panel flex gap-4 p-4">
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-ink/5">{i.product?.image && <img src={i.product.image} alt="" className="h-full w-full object-cover" />}</div>
                <div className="min-w-0 flex-1">
                  <Link to={`/marketplace/${i.product?.slug}`} className="font-semibold hover:underline">{i.product?.title || 'Unavailable item'}</Link>
                  <p className="text-sm text-muted">{i.product?.kind === 'used' ? 'Fairly used' : 'New'}, ships from {i.product?.originState}</p>
                  {i.issues.map((x) => <p key={x} className="text-sm font-semibold text-danger">{ISSUE[x]}</p>)}
                  <div className="mt-2 flex items-center gap-2">
                    <Button variant="secondary" size="sm" aria-label="Decrease quantity" onClick={() => set.mutate({ productId: i.productId, quantity: i.quantity - 1 })}><Minus className="h-4 w-4" /></Button>
                    <span className="w-8 text-center tnum" aria-label="Quantity">{i.quantity}</span>
                    <Button variant="secondary" size="sm" aria-label="Increase quantity" disabled={i.quantity >= (i.product?.stock || 0)} onClick={() => set.mutate({ productId: i.productId, quantity: i.quantity + 1 })}><Plus className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => set.mutate({ productId: i.productId, quantity: 0 })}><Trash2 className="h-4 w-4" aria-hidden /> Remove</Button>
                  </div>
                </div>
                <Money kobo={i.lineTotalKobo} className="font-semibold" />
              </li>
            ))}
          </ul>
          <Panel title="Summary">
            <div className="flex justify-between"><span>Items</span><Money kobo={c.subtotalKobo} className="font-semibold" /></div>
            <p className="mt-1 text-sm text-muted">Delivery is quoted at checkout before you pay.</p>
            {c.hasIssues && <div className="mt-3"><Notice tone="warn">Remove unavailable items to continue.</Notice></div>}
            <Button className="mt-4 w-full" to="/app/checkout" disabled={c.hasIssues}>Checkout</Button>
          </Panel>
        </div>
      )}
    </>
  );
}

export function CheckoutPage() {
  const { user, meta } = useSession();
  const nav = useNavigate();
  const cart = useQuery({ queryKey: ['cart'], queryFn: () => get('/marketplace/cart') });
  const terms = useQuery({ queryKey: ['terms', 'checkout'], queryFn: () => get('/account/terms/outstanding?context=checkout') });
  const [method, setMethod] = useState('delivery');
  const [addressId, setAddressId] = useState(user.addresses?.find((a) => a.isDefault)?._id || user.addresses?.[0]?._id || '');
  const [pointId, setPointId] = useState(meta?.collectionPoints?.[0]?.id || '');
  const [payment, setPayment] = useState('wallet');
  const [accepted, setAccepted] = useState([]);
  const [choice, setChoice] = useState({});
  const quote = useMutation({ mutationFn: () => post('/marketplace/checkout/delivery-quote', { addressId }), onError: toastError });
  const groups = quote.data?.groups || [];
  const deliveryTotal = method === 'delivery' ? groups.reduce((a, g) => {
    if (!g.deliveryAvailable) return a;
    const opts = [g.selected, ...(g.alternatives || [])];
    return a + (opts[choice[g.groupKey] || 0]?.feeKobo || 0);
  }, 0) : 0;
  const pay = useFinancialAction((_, key) => post('/marketplace/checkout', {
    fulfilmentMethod: method, addressId: method === 'delivery' ? addressId : undefined, collectionPointId: method === 'collection' ? pointId : undefined,
    deliveryQuotes: method === 'delivery' ? Object.fromEntries(groups.filter((g) => g.deliveryAvailable).map((g) => [g.groupKey, { quoteId: g.quoteId, optionIndex: choice[g.groupKey] || 0 }])) : undefined,
    paymentMethod: payment, acceptedPolicies: accepted.length ? accepted : undefined,
  }, { idempotencyKey: key }), {
    invalidate: [['cart'], ['wallet'], ['orders']],
    onSuccess: (r) => {
      if (r.authorizationUrl) return window.location.assign(r.authorizationUrl);
      nav(`/app/checkout/return?checkout=${r.id}`);
    },
  });
  if (cart.isLoading) return <Spinner />;
  const subtotal = cart.data?.subtotalKobo || 0;
  const needTerms = (terms.data || []).length > 0;
  const blocked = method === 'delivery' && (!quote.data || groups.some((g) => !g.deliveryAvailable));
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Checkout" />
      <Panel title="How do you want to receive your order?">
        <div className="grid gap-3 sm:grid-cols-2">
          {[['delivery', Truck, 'Delivery to my address'], ['collection', Store, 'Collect from a MubaPay point']].map(([v, Icon, l]) => (
            <label key={v} className={`panel flex cursor-pointer items-center gap-3 p-4 ${method === v ? 'border-palm ring-2 ring-palm/30' : ''}`}><input type="radio" name="method" checked={method === v} onChange={() => setMethod(v)} className="h-5 w-5 accent-[rgb(var(--palm))]" /><Icon className="h-5 w-5" aria-hidden /><span className="font-semibold">{l}</span></label>
          ))}
        </div>
        {method === 'delivery' ? (
          <div className="mt-4 space-y-3">
            {user.addresses?.length ? <Select label="Deliver to" value={addressId} onChange={(e) => { setAddressId(e.target.value); quote.reset(); }} options={user.addresses.map((a) => ({ value: a._id, label: `${a.label || 'Address'}: ${a.line1}, ${a.city}, ${a.state}` }))} /> : <Notice tone="warn">Add a delivery address in <Link className="link" to="/app/settings/addresses">Settings</Link> first.</Notice>}
            <Button variant="secondary" loading={quote.isPending} disabled={!addressId} onClick={() => quote.mutate()}>Get delivery quote</Button>
            {groups.map((g) => (
              <div key={g.groupKey} className="rounded-lg border border-line p-3">
                <p className="text-sm font-semibold">{g.groupKey === 'mubapay' ? 'Items sold by MubaPay' : 'Items from a verified seller'}</p>
                {!g.deliveryAvailable ? <p className="text-sm text-danger">{g.reason}</p> : (
                  <fieldset className="mt-2 space-y-2">
                    <legend className="sr-only">Delivery option</legend>
                    {[g.selected, ...(g.alternatives || [])].map((o, i) => (
                      <label key={i} className="flex items-center gap-3 text-sm"><input type="radio" name={`q-${g.groupKey}`} checked={(choice[g.groupKey] || 0) === i} onChange={() => setChoice({ ...choice, [g.groupKey]: i })} className="h-5 w-5 accent-[rgb(var(--palm))]" /><span className="flex-1">{o.courierName} ({o.etaText})</span><Money kobo={o.feeKobo} className="font-semibold" /></label>
                    ))}
                  </fieldset>
                )}
              </div>
            ))}
            <p className="text-xs text-muted">Coverage: {(meta?.coverageStates || []).join(', ')}.</p>
          </div>
        ) : (
          <div className="mt-4"><Select label="Collection point" value={pointId} onChange={(e) => setPointId(e.target.value)} options={(meta?.collectionPoints || []).map((c) => ({ value: c.id, label: `${c.name}, ${c.state}` }))} hint="You’ll get a one-time code when your order is ready. Show it only when you have your item." /></div>
        )}
      </Panel>
      <Panel title="Pay with">
        <div className="space-y-2">
          <label className="flex items-center gap-3"><input type="radio" name="pay" checked={payment === 'wallet'} onChange={() => setPayment('wallet')} className="h-5 w-5 accent-[rgb(var(--palm))]" />MubaPay wallet</label>
          <label className="flex items-center gap-3"><input type="radio" name="pay" checked={payment === 'paystack'} onChange={() => setPayment('paystack')} className="h-5 w-5 accent-[rgb(var(--palm))]" />Card, bank transfer or USSD (Paystack)</label>
        </div>
      </Panel>
      <Panel title="Order total">
        <KeyValue items={[['Items', naira(subtotal)], ['Delivery', method === 'delivery' ? (quote.data ? naira(deliveryTotal) : 'Get a quote') : naira(0)], ['Total', <strong key="t" className="font-display text-xl tnum">{naira(subtotal + deliveryTotal)}</strong>]]} />
        <p className="mt-3 text-sm text-muted">Your payment is held until your order is delivered or collected. You can request a refund within 7 days of delivery.</p>
        {needTerms && <div className="mt-4"><PolicyConsent slugs={['marketplace_refund_policy', 'delivery_policy']} accepted={accepted} onChange={setAccepted} /></div>}
        <Button className="mt-4 w-full" loading={pay.isPending} disabled={blocked || (needTerms && accepted.length < terms.data.length)} onClick={() => pay.mutate()}>Pay {naira(subtotal + deliveryTotal)}</Button>
      </Panel>
    </div>
  );
}

export function CheckoutReturnPage() {
  const [sp] = useSearchParams();
  const id = sp.get('checkout');
  const ref = sp.get('reference') || sp.get('trxref');
  const lookup = useQuery({ queryKey: ['checkout-by-ref', ref], queryFn: async () => (await get(`/wallet/payments/${ref}`)).relatedId, enabled: !id && Boolean(ref) });
  const cid = id || lookup.data;
  const q = useQuery({ queryKey: ['checkout', cid], queryFn: () => get(`/marketplace/checkout/${cid}`), enabled: Boolean(cid), refetchInterval: (query) => (query.state.data?.status === 'payment_processing' ? 4000 : false) });
  if (!cid || q.isLoading) return <Spinner label="Confirming your payment" />;
  if (q.isError) return <ErrorState error={q.error} />;
  const c = q.data;
  return (
    <div className="mx-auto max-w-lg">
      <PageHeader title={c.status === 'paid' ? 'Order confirmed' : c.status === 'payment_processing' ? 'Confirming payment' : 'Order not completed'} />
      <Panel>
        <Status value={c.status} />
        <p className="mt-3">{c.status === 'paid' ? 'Thanks! We’ve sent your order to the seller.' : c.status === 'payment_processing' ? 'We’re waiting for Paystack to confirm your payment. This page updates automatically — please don’t pay again.' : 'The payment wasn’t completed and your items were released. If money left your account, it will be credited to your wallet once confirmed.'}</p>
        <ul className="mt-4 space-y-2">{c.orders.map((o) => <li key={o.id}><Link className="link" to={`/app/orders/${o.id}`}>{o.orderNumber}</Link> — {naira(o.totalKobo)}</li>)}</ul>
      </Panel>
    </div>
  );
}

export function OrdersPage() {
  const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: ['orders', page], queryFn: () => get(`/marketplace/orders?page=${page}`) });
  return (
    <>
      <PageHeader title="Orders" actions={<Button variant="secondary" to="/app/cart">Cart</Button>} />
      {q.isLoading ? <Spinner /> : q.isError ? <ErrorState error={q.error} /> : (
        <>
          <Table caption="Orders" rows={q.data.data} empty={<EmptyState title="No orders yet" action={<Button to="/marketplace">Start shopping</Button>} />} columns={[
            { header: 'Order', render: (o) => <Link className="link" to={`/app/orders/${o.id}`}>{o.orderNumber}</Link> },
            { header: 'Placed', render: (o) => dateTime(o.createdAt) },
            { header: 'Items', render: (o) => o.items.map((i) => `${i.quantity} × ${i.title}`).join(', ') },
            { header: 'Total', align: 'right', render: (o) => <Money kobo={o.totalKobo} /> },
            { header: 'Status', render: (o) => <Status value={o.status} /> },
          ]} />
          <Pagination meta={q.data.meta} onPage={setPage} />
        </>
      )}
    </>
  );
}

function RefundDialog({ open, onClose, subjectType, subjectId, maxKobo }) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState(maxKobo ? String(maxKobo / 100) : '');
  const [reason, setReason] = useState('not_as_described');
  const [description, setDescription] = useState('');
  const [evidence, setEvidence] = useState('');
  const m = useMutation({ mutationFn: () => post('/marketplace/refunds', { subjectType, subjectId, amountKobo: toKobo(amount), reason, description, evidence: evidence ? [{ type: 'link', ref: evidence }] : undefined }), onSuccess: () => { qc.invalidateQueries(); toast({ tone: 'success', title: 'Refund requested', body: 'Our team will review it. Payout to the seller is paused meanwhile.' }); onClose(); }, onError: toastError });
  return (
    <Dialog open={open} onClose={onClose} title="Request a refund" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={m.isPending} disabled={!toKobo(amount)} onClick={() => m.mutate()}>Send request</Button></>}>
      <div className="space-y-4">
        <MoneyInput label="Amount" value={amount} onChange={setAmount} hint={maxKobo ? `Up to ${naira(maxKobo)}` : undefined} />
        <Select label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} options={subjectType === 'order' ? ['not_received', 'damaged', 'not_as_described', 'wrong_item', 'other'] : ['provider_cancelled', 'other']} />
        <Textarea label="What happened?" value={description} onChange={(e) => setDescription(e.target.value)} />
        <Input label="Link to photos or evidence (optional)" type="url" value={evidence} onChange={(e) => setEvidence(e.target.value)} hint="For example a shared Google Drive or Dropbox link." />
        <p className="text-sm text-muted">Approved refunds go to your MubaPay wallet by default.</p>
      </div>
    </Dialog>
  );
}

function DisputeDialog({ open, onClose, subjectType, subjectId }) {
  const nav = useNavigate();
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const m = useMutation({ mutationFn: () => post('/marketplace/disputes', { subjectType, subjectId, reason, description }), onSuccess: (d) => nav(`/app/disputes/${d._id}`), onError: toastError });
  return (
    <Dialog open={open} onClose={onClose} title="Open a dispute" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={m.isPending} disabled={reason.length < 3 || description.length < 10} onClick={() => m.mutate()}>Open dispute</Button></>}>
      <div className="space-y-4">
        <p className="text-sm text-muted">Use this if you can’t resolve the problem with the other person. Money still held by MubaPay stays on hold while our team reviews.</p>
        <div><label className="label" htmlFor="dr">Short summary</label><input id="dr" className="field" value={reason} maxLength={120} onChange={(e) => setReason(e.target.value)} /></div>
        <Textarea label="Details" value={description} onChange={(e) => setDescription(e.target.value)} hint="At least 10 characters." />
      </div>
    </Dialog>
  );
}

export function OrderDetailPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['order', id], queryFn: () => get(`/marketplace/orders/${id}`), refetchInterval: 30000 });
  const notes = useQuery({ queryKey: ['notifications', 'collect', id], queryFn: () => get('/notifications?limit=50'), enabled: q.data?.status === 'ready_for_collection' });
  const [dlg, setDlg] = useState(null);
  const cancel = useMutation({ mutationFn: (reason) => post(`/marketplace/orders/${id}/cancel`, { reason }), onSuccess: () => { qc.invalidateQueries(); setDlg(null); toast({ tone: 'success', title: 'Order cancelled', body: 'The full amount was refunded to your wallet.' }); }, onError: toastError });
  if (q.isLoading) return <Spinner />;
  if (q.isError) return <ErrorState error={q.error} />;
  const o = q.data;
  const code = notes.data?.data?.find((n) => n.type === 'ready_for_collection' && n.link?.includes(id))?.data?.collectionCode;
  const remaining = o.totalKobo - o.refundedKobo;
  const canRefund = ['paid', 'processing', 'ready_for_dispatch', 'ready_for_collection', 'dispatched', 'delivered', 'collected', 'settlement_pending', 'partially_refunded', 'delivery_failed'].includes(o.status);
  return (
    <>
      <PageHeader title={`Order ${o.orderNumber}`} description={`Placed ${dateTime(o.createdAt)}`} actions={o.viewerRole === 'buyer' && <>
        {['paid', 'processing'].includes(o.status) && <Button variant="secondary" onClick={() => setDlg('cancel')}>Cancel order</Button>}
        {canRefund && remaining > 0 && <Button variant="secondary" onClick={() => setDlg('refund')}>Request refund</Button>}
        {canRefund && <Button variant="ghost" onClick={() => setDlg('dispute')}>Open dispute</Button>}
      </>} />
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Panel title="Items">
            <ul className="divide-y divide-line">{o.items.map((i) => <li key={i.productId} className="flex justify-between gap-3 py-2"><span>{i.quantity} × {i.title}</span><Money kobo={i.lineTotalKobo} /></li>)}</ul>
            <div className="mt-3 border-t border-line pt-3"><KeyValue items={[['Items', naira(o.subtotalKobo)], ['Delivery', naira(o.deliveryFeeKobo)], ['Total paid', naira(o.totalKobo)], o.refundedKobo > 0 && ['Refunded', naira(o.refundedKobo)]]} /></div>
          </Panel>
          {o.status === 'ready_for_collection' && o.viewerRole === 'buyer' && (
            <Panel title="Your collection code">
              {code ? <p className="font-display text-5xl font-extrabold tracking-[0.3em] tnum" aria-label={`Collection code ${code.split('').join(' ')}`}>{code}</p> : <p className="text-sm">Your code is in your notifications.</p>}
              <p className="mt-2 text-sm text-muted">Collect from {o.collectionPoint?.name}. Show this code only once you have checked your item. It works once.</p>
            </Panel>
          )}
          {o.delivery && (
            <Panel title="Delivery">
              <KeyValue items={[['Courier', o.delivery.courierName || humanize(o.delivery.provider)], ['Status', <Status key="d" value={o.delivery.status} />], o.delivery.shipmentRef && ['Tracking number', o.delivery.shipmentRef]]} />
              {o.delivery.trackingUrl && <a href={o.delivery.trackingUrl} target="_blank" rel="noreferrer" className="link mt-3 inline-block">Track with the courier</a>}
              <div className="mt-4"><StatusTimeline items={o.delivery.timeline.map((t) => ({ status: t.status, at: t.at, note: t.note }))} /></div>
            </Panel>
          )}
          {(o.refunds?.length > 0 || o.disputes?.length > 0) && (
            <Panel title="Refunds and disputes">
              {o.refunds.map((r) => <p key={r._id} className="flex justify-between py-1 text-sm"><span>Refund {naira(r.amountKobo)} ({humanize(r.reason)})</span><Status value={r.status} /></p>)}
              {o.disputes.map((d) => <Link key={d._id} to={`/app/disputes/${d._id}`} className="flex justify-between py-1 text-sm hover:underline"><span>Dispute: {d.reason}</span><Status value={d.status} /></Link>)}
            </Panel>
          )}
        </div>
        <Panel title="Status"><Status value={o.status} /><div className="mt-4"><StatusTimeline items={o.statusHistory} /></div></Panel>
      </div>
      <RefundDialog open={dlg === 'refund'} onClose={() => setDlg(null)} subjectType="order" subjectId={o.id} maxKobo={remaining} />
      <DisputeDialog open={dlg === 'dispute'} onClose={() => setDlg(null)} subjectType="order" subjectId={o.id} />
      <ConfirmDialog open={dlg === 'cancel'} onClose={() => setDlg(null)} title="Cancel this order?" body={`${naira(remaining)} will be refunded to your MubaPay wallet straight away.`} confirmLabel="Cancel order" danger requireReason reasonLabel="Why are you cancelling?" loading={cancel.isPending} onConfirm={(r) => cancel.mutate(r)} />
    </>
  );
}

export function DisputesPage() {
  const d = useQuery({ queryKey: ['disputes'], queryFn: () => get('/marketplace/disputes') });
  const r = useQuery({ queryKey: ['refunds'], queryFn: () => get('/marketplace/refunds') });
  return (
    <>
      <PageHeader title="Refunds & disputes" />
      <h2 className="mb-2 text-lg font-bold">Refund requests</h2>
      {r.isLoading ? <Spinner /> : <Table caption="Refunds" rows={r.data || []} rowKey={(x) => x._id} empty={<EmptyState title="No refund requests" />} columns={[{ header: 'Requested', render: (x) => dateTime(x.createdAt) }, { header: 'For', render: (x) => humanize(x.subjectType) }, { header: 'Amount', align: 'right', render: (x) => <Money kobo={x.amountKobo} /> }, { header: 'Status', render: (x) => <><Status value={x.status} />{x.decision?.note && <p className="mt-1 text-xs text-muted">{x.decision.note}</p>}</> }]} />}
      <h2 className="mb-2 mt-8 text-lg font-bold">Disputes</h2>
      {d.isLoading ? <Spinner /> : <Table caption="Disputes" rows={d.data || []} rowKey={(x) => x._id} empty={<EmptyState title="No disputes" />} columns={[{ header: 'Opened', render: (x) => dateTime(x.createdAt) }, { header: 'Summary', render: (x) => <Link className="link" to={`/app/disputes/${x._id}`}>{x.reason}</Link> }, { header: 'Status', render: (x) => <Status value={x.status} /> }]} />}
    </>
  );
}

export function DisputeDetailPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const { user } = useSession();
  const q = useQuery({ queryKey: ['dispute', id], queryFn: () => get(`/marketplace/disputes/${id}`) });
  const [text, setText] = useState('');
  const m = useMutation({ mutationFn: () => post(`/marketplace/disputes/${id}/statements`, { text }), onSuccess: () => { setText(''); qc.invalidateQueries({ queryKey: ['dispute', id] }); }, onError: toastError });
  if (q.isLoading) return <Spinner />;
  if (q.isError) return <ErrorState error={q.error} />;
  const d = q.data;
  const open = ['open', 'under_review'].includes(d.status);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={`Dispute ${d.reference}`} description={d.reason} />
      <Status value={d.status} />
      {d.resolution?.note && <div className="mt-4"><Notice tone="info" title="Decision">{d.resolution.note}{d.resolution.refundKobo ? ` Refund: ${naira(d.resolution.refundKobo)}.` : ''}</Notice></div>}
      <ol className="mt-6 space-y-3">
        {d.statements.map((s, i) => (
          <li key={i} className={`panel p-4 ${String(s.by) === user.id ? 'border-palm/40' : ''}`}>
            <p className="text-xs font-semibold text-muted">{String(s.by) === user.id ? 'You' : s.role === 'staff' ? 'MubaPay team' : 'Other party'}, {dateTime(s.at)}</p>
            <p className="mt-1 whitespace-pre-line">{s.text}</p>
          </li>
        ))}
      </ol>
      {open && (
        <div className="mt-6">
          <Textarea label="Add a statement" value={text} onChange={(e) => setText(e.target.value)} />
          <Button className="mt-2" loading={m.isPending} disabled={text.length < 2} onClick={() => m.mutate()}>Add statement</Button>
        </div>
      )}
    </div>
  );
}

export function SavedPage() {
  const [tab, setTab] = useState('products');
  const qc = useQueryClient();
  const p = useQuery({ queryKey: ['saved-products'], queryFn: () => get('/marketplace/saved') });
  const r = useQuery({ queryKey: ['saved-properties'], queryFn: () => get('/realestate/saved') });
  const s = useQuery({ queryKey: ['saved-searches'], queryFn: () => get('/marketplace/saved-searches') });
  const upd = useMutation({ mutationFn: ({ id, body }) => api2(id, body), onSuccess: () => qc.invalidateQueries({ queryKey: ['saved-searches'] }) });
  const rm = useMutation({ mutationFn: (id) => del(`/marketplace/saved-searches/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['saved-searches'] }) });
  return (
    <>
      <PageHeader title="Saved" />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'products', label: 'Products' }, { value: 'properties', label: 'Properties' }, { value: 'searches', label: 'Searches & alerts' }]} />
      {tab === 'products' && (p.data?.length ? <div className="grid grid-cols-2 gap-4 md:grid-cols-4">{p.data.map((x) => <ProductCard key={x.id} p={x} />)}</div> : <EmptyState title="No saved products" />)}
      {tab === 'properties' && (r.data?.length ? <div className="grid gap-4 md:grid-cols-3">{r.data.map((x) => <PropertyCard key={x.id} p={x} />)}</div> : <EmptyState title="No saved properties" />)}
      {tab === 'searches' && (
        <Table caption="Saved searches" rows={s.data || []} rowKey={(x) => x._id} empty={<EmptyState title="No saved searches" body="Use “Save this search” on the marketplace to get alerts for new listings." />} columns={[
          { header: 'Search', render: (x) => <Link className="link" to={`/marketplace?${new URLSearchParams(x.query)}`}>{x.name}</Link> },
          { header: 'Alerts', render: (x) => <select aria-label="Alert frequency" className="field w-auto" value={x.alertsEnabled ? x.alertFrequency : 'off'} onChange={(e) => upd.mutate({ id: x._id, body: e.target.value === 'off' ? { alertsEnabled: false } : { alertsEnabled: true, alertFrequency: e.target.value } })}><option value="off">Off</option><option value="instant">As they appear</option><option value="daily">Daily</option><option value="weekly">Weekly</option></select> },
          { header: '', render: (x) => <Button variant="ghost" size="sm" onClick={() => rm.mutate(x._id)}>Delete</Button> },
        ]} />
      )}
    </>
  );
}
const api2 = (id, body) => import('../../lib/api').then((m) => m.patch(`/marketplace/saved-searches/${id}`, body));

export { RefundDialog, DisputeDialog, useMemo };
