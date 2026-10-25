import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { download, get, patch, post, put } from '../../lib/api';
import { dateTime, humanize, naira } from '../../lib/format';
import { useSession } from '../../lib/session';
import { Button, Checkbox, EmptyState, ErrorState, Input, KeyValue, Notice, PageHeader, Panel, Select, Spinner, Status, Table, Tabs, Textarea } from '../../components/ui';
import { ConfirmDialog, Dialog } from '../../components/ui/dialog';
import { KoboInput } from '../../components/ui/forms';
import { toast, toastError } from '../../components/ui/toast';
import { StatusTimeline } from '../../components/domain';
import { MediaUploader } from '../workspace/workspace';
import { AdminList, DocumentButton, who } from './shared';
import { useInitiateApproval } from './people';

// ================================================================ products & categories
const blankProduct = { title: '', description: '', brand: '', categoryId: '', priceKobo: 0, stock: 0, weightKg: '', images: [], fulfilment: { delivery: true, collection: true, originState: 'Anambra', originCity: 'Awka' }, status: 'draft' };

export function ProductsAdminPage() {
  const { can } = useSession();
  const qc = useQueryClient();
  const [tab, setTab] = useState(can('products.manage') ? 'products' : 'categories');
  const [edit, setEdit] = useState(null);
  const [cat, setCat] = useState(null);
  const cats = useQuery({ queryKey: ['admin-categories'], queryFn: () => get('/admin/categories'), enabled: can('categories.manage') || can('products.manage') });
  const saveP = useMutation({
    mutationFn: (p) => {
      const body = { title: p.title, description: p.description, brand: p.brand || undefined, categoryId: p.categoryId, priceKobo: p.priceKobo, stock: Number(p.stock), images: p.images.map(({ url, publicId, alt }) => ({ url, publicId, alt })), weightKg: p.weightKg ? Number(p.weightKg) : undefined, fulfilment: p.fulfilment, status: p.status };
      return p._id ? patch(`/admin/products/${p._id}`, body) : post('/admin/products', body);
    },
    onSuccess: () => { setEdit(null); qc.invalidateQueries({ queryKey: ['admin-products'] }); toast({ tone: 'success', title: 'Product saved' }); },
    onError: toastError,
  });
  const saveC = useMutation({ mutationFn: (c) => { const body = { name: c.name, allowsUsed: c.allowsUsed, allowsNew: c.allowsNew, prohibited: c.prohibited, prohibitedReason: c.prohibitedReason || undefined, active: c.active, sortOrder: Number(c.sortOrder) || 0 }; return c._id ? patch(`/admin/categories/${c._id}`, body) : post('/admin/categories', body); }, onSuccess: () => { setCat(null); qc.invalidateQueries({ queryKey: ['admin-categories'] }); }, onError: toastError });
  const catName = (id) => cats.data?.find((c) => c._id === String(id))?.name || '—';
  return (
    <>
      <PageHeader title="Products and categories" description="New products sold by MubaPay. Used-item listings are handled in Moderation." actions={tab === 'products' ? can('products.manage') && <Button onClick={() => setEdit({ ...blankProduct })}>New product</Button> : can('categories.manage') && <Button onClick={() => setCat({ name: '', allowsUsed: true, allowsNew: true, prohibited: false, active: true, sortOrder: 0 })}>New category</Button>} />
      <Tabs value={tab} onChange={setTab} tabs={[can('products.manage') && { value: 'products', label: 'MubaPay products' }, can('categories.manage') && { value: 'categories', label: 'Categories' }].filter(Boolean)} />
      {tab === 'products' && <AdminList queryKey={['admin-products']} path="/admin/products" extraParams={{ kind: 'new' }} statuses={['', 'draft', 'published', 'hidden', 'archived']} caption="Products" columns={[
        { header: 'Product', render: (p) => <><span className="font-medium">{p.title}</span><span className="block text-xs text-muted">{catName(p.categoryId)}</span></> },
        { header: 'Price', render: (p) => naira(p.priceKobo) },
        { header: 'Stock', key: 'stock' },
        { header: 'Sold', render: (p) => p.soldCount || 0 },
        { header: 'Status', render: (p) => <Status value={p.status} /> },
        { header: '', render: (p) => <Button size="sm" variant="secondary" onClick={() => setEdit({ ...blankProduct, ...p, categoryId: String(p.categoryId), weightKg: p.weightKg || '', fulfilment: { ...blankProduct.fulfilment, ...p.fulfilment } })}>Edit</Button> },
      ]} />}
      {tab === 'categories' && (cats.isLoading ? <Spinner /> : <Table caption="Categories" rows={cats.data} rowKey={(c) => c._id} columns={[
        { header: 'Name', key: 'name' },
        { header: 'New', render: (c) => (c.allowsNew ? 'Yes' : 'No') },
        { header: 'Used', render: (c) => (c.allowsUsed ? 'Yes' : 'No') },
        { header: 'Prohibited', render: (c) => (c.prohibited ? <span className="text-danger">Yes{c.prohibitedReason ? `: ${c.prohibitedReason}` : ''}</span> : 'No') },
        { header: 'Active', render: (c) => (c.active ? 'Yes' : 'No') },
        { header: '', render: (c) => <Button size="sm" variant="secondary" onClick={() => setCat({ ...c })}>Edit</Button> },
      ]} />)}
      <Dialog wide open={Boolean(edit)} onClose={() => setEdit(null)} title={edit?._id ? 'Edit product' : 'New product'} footer={<><Button variant="secondary" onClick={() => setEdit(null)}>Cancel</Button><Button loading={saveP.isPending} onClick={() => saveP.mutate(edit)}>Save product</Button></>}>
        {edit && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Input className="sm:col-span-2" label="Title" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
            <Select label="Category" placeholder="Choose" value={edit.categoryId} onChange={(e) => setEdit({ ...edit, categoryId: e.target.value })} options={(cats.data || []).filter((c) => c.allowsNew && !c.prohibited).map((c) => ({ value: c._id, label: c.name }))} />
            <Input label="Brand" value={edit.brand || ''} onChange={(e) => setEdit({ ...edit, brand: e.target.value })} />
            <Textarea className="sm:col-span-2" label="Description" value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />
            <KoboInput label="Price" value={edit.priceKobo} onChange={(v) => setEdit({ ...edit, priceKobo: v })} />
            <Input label="Stock" type="number" min={0} value={edit.stock} onChange={(e) => setEdit({ ...edit, stock: e.target.value })} />
            <Input label="Weight (kg)" type="number" step="0.1" value={edit.weightKg} onChange={(e) => setEdit({ ...edit, weightKg: e.target.value })} />
            <Select label="Status" value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })} options={['draft', 'published', 'hidden', 'archived'].map((v) => ({ value: v, label: humanize(v) }))} />
            <Checkbox label="Delivery" checked={edit.fulfilment.delivery} onChange={(e) => setEdit({ ...edit, fulfilment: { ...edit.fulfilment, delivery: e.target.checked } })} />
            <Checkbox label="Collection" checked={edit.fulfilment.collection} onChange={(e) => setEdit({ ...edit, fulfilment: { ...edit.fulfilment, collection: e.target.checked } })} />
            <div className="sm:col-span-2"><MediaUploader purpose="products" items={edit.images} onChange={(v) => setEdit({ ...edit, images: v })} /></div>
          </div>
        )}
      </Dialog>
      <Dialog open={Boolean(cat)} onClose={() => setCat(null)} title={cat?._id ? 'Edit category' : 'New category'} footer={<><Button variant="secondary" onClick={() => setCat(null)}>Cancel</Button><Button loading={saveC.isPending} onClick={() => saveC.mutate(cat)}>Save</Button></>}>
        {cat && (
          <div className="space-y-3">
            <Input label="Name" value={cat.name} onChange={(e) => setCat({ ...cat, name: e.target.value })} />
            <Checkbox label="MubaPay can sell new items here" checked={cat.allowsNew} onChange={(e) => setCat({ ...cat, allowsNew: e.target.checked })} />
            <Checkbox label="Customers can list used items here" checked={cat.allowsUsed} onChange={(e) => setCat({ ...cat, allowsUsed: e.target.checked })} />
            <Checkbox label="Prohibited category" checked={cat.prohibited} onChange={(e) => setCat({ ...cat, prohibited: e.target.checked })} />
            {cat.prohibited && <Input label="Why it’s prohibited" value={cat.prohibitedReason || ''} onChange={(e) => setCat({ ...cat, prohibitedReason: e.target.value })} />}
            <Checkbox label="Active" checked={cat.active} onChange={(e) => setCat({ ...cat, active: e.target.checked })} />
            <Input label="Sort order" type="number" value={cat.sortOrder || 0} onChange={(e) => setCat({ ...cat, sortOrder: e.target.value })} />
          </div>
        )}
      </Dialog>
    </>
  );
}

// ================================================================ moderation
export function ModerationPage() {
  const { can } = useSession();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || (can('listings.moderate') ? 'products' : can('properties.moderate') ? 'properties' : 'reports');
  return (
    <>
      <PageHeader title="Moderation" description="Check listings against the prohibited items policy and the evidence provided. Every decision is logged and the lister is told the reason." />
      <Tabs value={tab} onChange={(t) => setParams({ tab: t })} tabs={[can('listings.moderate') && { value: 'products', label: 'Used items' }, can('properties.moderate') && { value: 'properties', label: 'Properties' }, can('messaging.moderate') && { value: 'reports', label: 'Reported users' }].filter(Boolean)} />
      {tab === 'products' && <ProductModeration />}
      {tab === 'properties' && <PropertyModeration />}
      {tab === 'reports' && <UserReports />}
    </>
  );
}

function DecisionDialog({ target, onClose, onSubmit, loading, extra }) {
  const [reason, setReason] = useState('');
  const needs = target && target.decision !== 'approve' && target.decision !== 'unhide';
  return (
    <Dialog open={Boolean(target)} onClose={() => { setReason(''); onClose(); }} title={target ? `${humanize(target.decision)}: ${target.title}` : ''} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant={needs ? 'danger' : 'primary'} loading={loading} disabled={needs && reason.trim().length < 5} onClick={() => { onSubmit(reason.trim()); setReason(''); }}>Confirm</Button></>}>
      {extra}
      <Textarea label={needs ? 'Reason shown to the lister' : 'Note (optional)'} value={reason} onChange={(e) => setReason(e.target.value)} />
    </Dialog>
  );
}

function ProductModeration() {
  const qc = useQueryClient();
  const [t, setT] = useState(null);
  const m = useMutation({ mutationFn: (reason) => post(`/admin/moderation/products/${t.id}`, { decision: t.decision, reason: reason || undefined }), onSuccess: () => { setT(null); qc.invalidateQueries({ queryKey: ['mod-products'] }); }, onError: toastError });
  return (
    <>
      <AdminList queryKey={['mod-products']} path="/admin/moderation/products" statuses={['pending_review', 'reported', 'published', 'hidden', 'rejected']} defaultStatus="pending_review" caption="Used items" empty={<EmptyState title="Nothing to moderate" />} columns={[
        { header: 'Item', render: (p) => <div className="flex gap-3">{p.images?.[0] && <img src={p.images[0].url} alt="" className="h-14 w-14 rounded object-cover" />}<span><span className="font-medium">{p.title}</span><span className="block text-xs text-muted">{p.categoryName}, {humanize(p.condition)}, {naira(p.priceKobo)}</span><span className="block text-xs">{p.conditionNotes}</span></span></div> },
        { header: 'Seller', render: (p) => p.sellerId && <Link className="link" to={`/admin/users/${p.sellerId}`}>{p.seller?.displayName || 'View'}</Link> },
        { header: 'Reports', render: (p) => (p.reports?.length ? <ul className="text-xs">{p.reports.map((r) => <li key={r._id}>{humanize(r.category)}{r.details ? `: ${r.details}` : ''}</li>)}</ul> : '—') },
        { header: 'Status', render: (p) => <Status value={p.status} /> },
        { header: '', render: (p) => <div className="flex flex-wrap gap-1">
          {p.status === 'pending_review' && <><Button size="sm" onClick={() => setT({ ...p, decision: 'approve' })}>Approve</Button><Button size="sm" variant="ghost" onClick={() => setT({ ...p, decision: 'reject' })}>Reject</Button></>}
          {p.status === 'published' && <Button size="sm" variant="ghost" onClick={() => setT({ ...p, decision: 'hide' })}>Hide</Button>}
          {p.status === 'hidden' && <Button size="sm" variant="secondary" onClick={() => setT({ ...p, decision: 'unhide' })}>Unhide</Button>}
        </div> },
      ]} />
      <DecisionDialog target={t} onClose={() => setT(null)} loading={m.isPending} onSubmit={(r) => m.mutate(r)} />
    </>
  );
}

function PropertyModeration() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('pending_review');
  const [t, setT] = useState(null);
  const [authority, setAuthority] = useState(false);
  const q = useQuery({ queryKey: ['mod-properties', status], queryFn: () => get(`/admin/moderation/properties?status=${status}`) });
  const m = useMutation({ mutationFn: (reason) => post(`/admin/moderation/properties/${t.id}`, { decision: t.decision, reason: reason || undefined, authorityVerified: t.decision === 'approve' ? authority : undefined }), onSuccess: () => { setT(null); setAuthority(false); qc.invalidateQueries({ queryKey: ['mod-properties'] }); }, onError: toastError });
  return (
    <>
      <div className="mb-4 w-56"><Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)} options={['pending_review', 'published', 'hidden', 'rejected'].map((v) => ({ value: v, label: humanize(v) }))} /></div>
      {q.isLoading ? <Spinner /> : <Table caption="Properties" rows={q.data} empty={<EmptyState title="Nothing to moderate" />} columns={[
        { header: 'Property', render: (p) => <><span className="font-medium">{p.title}</span><span className="block text-xs text-muted">{humanize(p.listingType)}, {humanize(p.propertyType)}, {naira(p.priceKobo)}</span><span className="block text-xs">{p.location?.address}, {p.location?.city}, {p.location?.state}</span></> },
        { header: 'Lister', render: (p) => <><Link className="link" to={`/admin/users/${p.submittedBy?._id}`}>{who(p.submittedBy)}</Link><span className="block text-xs text-muted">{humanize(p.listingAuthority?.basis)}{p.listingAuthority?.notes ? `: ${p.listingAuthority.notes}` : ''}</span></> },
        { header: 'Evidence', render: (p) => <div className="flex flex-wrap gap-1">{p.documents?.length ? p.documents.map((d) => <DocumentButton key={d.id} doc={d} />) : <span className="text-xs text-danger">No documents</span>}<span className="text-xs text-muted">{p.media?.length || 0} media</span></div> },
        { header: 'Status', render: (p) => <Status value={p.status} /> },
        { header: '', render: (p) => <div className="flex flex-wrap gap-1">
          {p.status === 'pending_review' && <><Button size="sm" onClick={() => setT({ ...p, decision: 'approve' })}>Approve</Button><Button size="sm" variant="ghost" onClick={() => setT({ ...p, decision: 'reject' })}>Reject</Button></>}
          {p.status === 'published' && <Button size="sm" variant="ghost" onClick={() => setT({ ...p, decision: 'hide' })}>Hide</Button>}
          {p.status === 'hidden' && <Button size="sm" variant="secondary" onClick={() => setT({ ...p, decision: 'unhide' })}>Unhide</Button>}
        </div> },
      ]} />}
      <DecisionDialog target={t} onClose={() => setT(null)} loading={m.isPending} onSubmit={(r) => m.mutate(r)} extra={t?.decision === 'approve' && <div className="mb-3"><Checkbox label="I checked the ownership or authority documents" description="Shown internally only. We never tell customers a property is guaranteed." checked={authority} onChange={(e) => setAuthority(e.target.checked)} /></div>} />
    </>
  );
}

function UserReports() {
  const qc = useQueryClient();
  const [t, setT] = useState(null);
  const q = useQuery({ queryKey: ['user-reports'], queryFn: () => get('/admin/moderation/users') });
  const m = useMutation({ mutationFn: (note) => post(`/admin/moderation/users/${t.r._id}`, { action: t.action, note }), onSuccess: () => { setT(null); qc.invalidateQueries({ queryKey: ['user-reports'] }); }, onError: toastError });
  return (
    <>
      {q.isLoading ? <Spinner /> : <Table caption="Reports" rows={q.data} rowKey={(r) => r._id} empty={<EmptyState title="No open reports" />} columns={[
        { header: 'Reported', render: (r) => <Link className="link" to={`/admin/users/${r.targetUserId?._id}`}>{who(r.targetUserId)}</Link> },
        { header: 'By', render: (r) => who(r.reporterId) },
        { header: 'Reason', render: (r) => <>{humanize(r.reason)}<span className="block text-xs text-muted">{r.details}</span></> },
        { header: 'When', render: (r) => dateTime(r.createdAt) },
        { header: '', render: (r) => <Select label="Action" value="" onChange={(e) => e.target.value && setT({ r, action: e.target.value })} placeholder="Choose" options={[{ value: 'dismiss', label: 'Dismiss' }, { value: 'warn', label: 'Warn the user' }, { value: 'restrict_messaging', label: 'Restrict messaging' }, r.messageId && { value: 'hide_message', label: 'Hide the message' }].filter(Boolean)} /> },
      ]} />}
      <ConfirmDialog open={Boolean(t)} onClose={() => setT(null)} title={t ? humanize(t.action) : ''} requireReason reasonLabel="Note" loading={m.isPending} onConfirm={(n) => m.mutate(n)} />
    </>
  );
}

// ================================================================ orders & deliveries
export function OrdersAdminPage() {
  const [num, setNum] = useState('');
  const [search, setSearch] = useState('');
  return (
    <>
      <PageHeader title="Orders" />
      <AdminList queryKey={['admin-orders']} path="/admin/orders" extraParams={{ orderNumber: search }} statuses={['', 'pending_payment', 'payment_processing', 'paid', 'processing', 'ready_for_collection', 'ready_for_dispatch', 'dispatched', 'delivered', 'collected', 'delivery_failed', 'refund_requested', 'partially_refunded', 'refunded', 'disputed', 'settlement_pending', 'settled', 'cancelled']} caption="Orders" columns={[
        { header: 'Order', render: (o) => <Link className="link" to={`/admin/orders/${o._id}`}>{o.orderNumber}</Link> },
        { header: 'Seller', render: (o) => humanize(o.sellerKind) },
        { header: 'Total', render: (o) => naira(o.totalKobo) },
        { header: 'Fulfilment', render: (o) => humanize(o.fulfilmentMethod) },
        { header: 'Placed', render: (o) => dateTime(o.createdAt) },
        { header: 'Status', render: (o) => <Status value={o.status} /> },
      ]}>
        <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); setSearch(num.trim()); }}><Input label="Order number" value={num} onChange={(e) => setNum(e.target.value)} /><Button type="submit" variant="secondary">Find</Button></form>
      </AdminList>
    </>
  );
}

export function OrderAdminDetailPage({ id }) {
  const { can } = useSession();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['order', id], queryFn: () => get(`/marketplace/orders/${id}`) });
  const [note, setNote] = useState('');
  const [open, setOpen] = useState(false);
  const fulfil = useMutation({ mutationFn: (action) => post(`/marketplace/orders/${id}/fulfilment`, { action }), onSuccess: () => qc.invalidateQueries({ queryKey: ['order', id] }), onError: toastError });
  const collect = useMutation({ mutationFn: () => post(`/marketplace/orders/${id}/collection/confirm`, { staffAssisted: true, identityNote: note }), onSuccess: () => { setOpen(false); qc.invalidateQueries({ queryKey: ['order', id] }); }, onError: toastError });
  if (q.isLoading) return <Spinner />;
  if (q.isError) return <ErrorState error={q.error} />;
  const o = q.data;
  return (
    <div className="space-y-6">
      <PageHeader title={`Order ${o.orderNumber}`} actions={<Status value={o.status} />} />
      <Panel><KeyValue items={[['Buyer', <Link key="b" className="link" to={`/admin/users/${o.buyerId}`}>View buyer</Link>], o.sellerId && ['Seller', <Link key="s" className="link" to={`/admin/users/${o.sellerId}`}>View seller</Link>], ['Items', o.items.map((i) => `${i.quantity} × ${i.title}`).join(', ')], ['Subtotal', naira(o.subtotalKobo)], ['Delivery', naira(o.deliveryFeeKobo || 0)], ['Total', naira(o.totalKobo)], ['Refunded', naira(o.refundedKobo || 0)], ['Fulfilment', humanize(o.fulfilmentMethod)], o.delivery && ['Delivery', `${o.delivery.provider}: ${humanize(o.delivery.status)}`], o.settlement && ['Settlement', `${naira(o.settlement.netKobo)} (${humanize(o.settlement.status)})`]]} /></Panel>
      {!o.sellerId && can('orders.manage') && (
        <div className="flex flex-wrap gap-2">
          {o.status === 'paid' && <Button onClick={() => fulfil.mutate('start_processing')}>Start preparing</Button>}
          {o.status === 'processing' && <Button onClick={() => fulfil.mutate('ready')}>Mark ready</Button>}
        </div>
      )}
      {o.status === 'ready_for_collection' && can('collections.confirm') && <Button variant="secondary" onClick={() => setOpen(true)}>Confirm collection without a code</Button>}
      {o.delivery?.timeline?.length > 0 && <Panel title="Delivery tracking"><StatusTimeline items={o.delivery.timeline} /></Panel>}
      <Panel title="Order history"><StatusTimeline items={o.history} /></Panel>
      <Dialog open={open} onClose={() => setOpen(false)} title="Staff-assisted collection" footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button loading={collect.isPending} disabled={note.length < 10} onClick={() => collect.mutate()}>Confirm collection</Button></>}>
        <Textarea label="How did you verify the buyer’s identity?" value={note} onChange={(e) => setNote(e.target.value)} hint="For example: checked national ID card matching the buyer’s verified name." />
      </Dialog>
    </div>
  );
}

export function DeliveriesAdminPage() {
  const qc = useQueryClient();
  const providers = useQuery({ queryKey: ['delivery-providers'], queryFn: () => get('/admin/deliveries/providers') });
  const [dlg, setDlg] = useState(null);
  const update = useMutation({ mutationFn: () => post(`/admin/deliveries/${dlg.d._id}/status`, { status: dlg.status, note: dlg.note || undefined, evidenceRef: dlg.evidenceRef || undefined }), onSuccess: () => { setDlg(null); qc.invalidateQueries({ queryKey: ['admin-deliveries'] }); }, onError: toastError });
  const book = useMutation({ mutationFn: (id) => post(`/admin/deliveries/${id}/book`), onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-deliveries'] }), onError: toastError });
  return (
    <>
      <PageHeader title="Deliveries" description="Anambra, Enugu and Imo. Manual updates need evidence such as a rider confirmation or a signed waybill." />
      {providers.data && <div className="mb-4 flex flex-wrap gap-2">{providers.data.map((p) => <span key={p.name} className="rounded-full border border-line px-3 py-1 text-sm">{humanize(p.name)}: {p.configured ? 'credentials set' : 'not configured'}</span>)}</div>}
      <AdminList queryKey={['admin-deliveries']} path="/admin/deliveries" statuses={['', 'pending_booking', 'booking_failed', 'booked', 'in_transit', 'delivered', 'failed', 'redelivery_scheduled', 'cancelled']} caption="Deliveries" columns={[
        { header: 'Order', render: (d) => <Link className="link" to={`/admin/orders/${d.orderId}`}>Open order</Link> },
        { header: 'Provider', render: (d) => `${humanize(d.provider)}${d.manual ? ' (manual)' : ''}` },
        { header: 'Shipment', render: (d) => (d.trackingUrl ? <a className="link" href={d.trackingUrl} target="_blank" rel="noreferrer">{d.shipmentRef || 'Track'}</a> : d.shipmentRef || '—') },
        { header: 'Fee', render: (d) => (d.quotedFeeKobo ? naira(d.quotedFeeKobo) : '—') },
        { header: 'Status', render: (d) => <><Status value={d.status} />{d.failure?.reason && <span className="block text-xs text-danger">{d.failure.reason}</span>}</> },
        { header: '', render: (d) => <div className="flex flex-wrap gap-1">{['pending_booking', 'booking_failed'].includes(d.status) && <Button size="sm" variant="secondary" loading={book.isPending && book.variables === d._id} onClick={() => book.mutate(d._id)}>Book with provider</Button>}{!['delivered', 'cancelled'].includes(d.status) && <Button size="sm" variant="ghost" onClick={() => setDlg({ d, status: 'in_transit', note: '', evidenceRef: '' })}>Update</Button>}</div> },
      ]} />
      <Dialog open={Boolean(dlg)} onClose={() => setDlg(null)} title="Update delivery status" footer={<><Button variant="secondary" onClick={() => setDlg(null)}>Cancel</Button><Button loading={update.isPending} onClick={() => update.mutate()}>Save</Button></>}>
        {dlg && <div className="space-y-3"><Select label="Status" value={dlg.status} onChange={(e) => setDlg({ ...dlg, status: e.target.value })} options={['booked', 'in_transit', 'delivered', 'failed', 'redelivery_scheduled', 'cancelled'].map((v) => ({ value: v, label: humanize(v) }))} /><Input label="Evidence reference" value={dlg.evidenceRef} onChange={(e) => setDlg({ ...dlg, evidenceRef: e.target.value })} hint="Waybill number, rider name and phone, or photo reference." /><Textarea label="Note" value={dlg.note} onChange={(e) => setDlg({ ...dlg, note: e.target.value })} /></div>}
      </Dialog>
    </>
  );
}

// ================================================================ refunds & disputes
export function RefundsAdminPage() {
  const { can } = useSession();
  const qc = useQueryClient();
  const [dlg, setDlg] = useState(null);
  const m = useMutation({ mutationFn: () => post(`/admin/refunds/${dlg.r._id}/decision`, { decision: dlg.decision, note: dlg.note, amountKobo: dlg.decision === 'approve' ? dlg.amountKobo : undefined }), onSuccess: () => { setDlg(null); qc.invalidateQueries({ queryKey: ['admin-refunds'] }); }, onError: toastError });
  return (
    <>
      <PageHeader title="Refunds" description="Approving posts the refund through the ledger. Refunds to cards go through Paystack; the customer sees “processing” until Paystack confirms." />
      <AdminList queryKey={['admin-refunds']} path="/admin/refunds" statuses={['pending_review', 'approved', 'processing', 'completed', 'rejected', 'failed']} defaultStatus="pending_review" caption="Refunds" empty={<EmptyState title="No refunds in this state" />} columns={[
        { header: 'Reference', render: (r) => <span className="font-mono text-xs">{r.reference}</span> },
        { header: 'For', render: (r) => (r.subjectType === 'order' ? <Link className="link" to={`/admin/orders/${r.subjectId}`}>Order</Link> : 'Viewing') },
        { header: 'Amount', render: (r) => naira(r.amountKobo) },
        { header: 'Reason', render: (r) => <>{humanize(r.reason)}<span className="block text-xs text-muted">{r.description}</span></> },
        { header: 'To', render: (r) => humanize(r.destination) },
        { header: 'Status', render: (r) => <Status value={r.status} /> },
        { header: '', render: (r) => r.status === 'pending_review' && can('refunds.decide') && <div className="flex gap-1"><Button size="sm" onClick={() => setDlg({ r, decision: 'approve', amountKobo: r.amountKobo, note: '' })}>Approve</Button><Button size="sm" variant="ghost" onClick={() => setDlg({ r, decision: 'reject', note: '' })}>Reject</Button></div> },
      ]} />
      <Dialog open={Boolean(dlg)} onClose={() => setDlg(null)} title={dlg?.decision === 'approve' ? 'Approve refund' : 'Reject refund'} footer={<><Button variant="secondary" onClick={() => setDlg(null)}>Cancel</Button><Button loading={m.isPending} disabled={(dlg?.note || '').length < 5} onClick={() => m.mutate()}>Save decision</Button></>}>
        {dlg && <div className="space-y-3">{dlg.decision === 'approve' && <KoboInput label="Amount to refund" value={dlg.amountKobo} max={dlg.r.amountKobo} onChange={(v) => setDlg({ ...dlg, amountKobo: v })} hint={`Requested ${naira(dlg.r.amountKobo)}. You can approve less.`} />}<Textarea label="Note to the customer" value={dlg.note} onChange={(e) => setDlg({ ...dlg, note: e.target.value })} /></div>}
      </Dialog>
    </>
  );
}

export function DisputesAdminPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(null);
  const [res, setRes] = useState({ outcome: 'under_review', note: '', refundKobo: 0 });
  const detail = useQuery({ queryKey: ['dispute', open], queryFn: () => get(`/marketplace/disputes/${open}`), enabled: Boolean(open) });
  const m = useMutation({ mutationFn: () => post(`/admin/disputes/${open}/resolve`, { outcome: res.outcome, note: res.note || undefined, refundKobo: res.outcome === 'resolved_for_customer' ? res.refundKobo : undefined }), onSuccess: () => { setOpen(null); qc.invalidateQueries({ queryKey: ['admin-disputes'] }); }, onError: toastError });
  return (
    <>
      <PageHeader title="Disputes" description="Read both sides’ statements and evidence before deciding. Settlements stay on hold while a dispute is open." />
      <AdminList queryKey={['admin-disputes']} path="/admin/disputes" statuses={[{ value: '', label: 'Open and under review' }, 'resolved_for_customer', 'resolved_for_provider', 'withdrawn']} caption="Disputes" empty={<EmptyState title="No open disputes" />} columns={[
        { header: 'Reference', render: (d) => <span className="font-mono text-xs">{d.reference}</span> },
        { header: 'About', render: (d) => humanize(d.subjectType) },
        { header: 'Reason', render: (d) => <>{d.reason}<span className="block text-xs text-muted">{d.description?.slice(0, 120)}</span></> },
        { header: 'Opened', render: (d) => dateTime(d.createdAt) },
        { header: 'Status', render: (d) => <Status value={d.status} /> },
        { header: '', render: (d) => <Button size="sm" variant="secondary" onClick={() => { setOpen(d._id); setRes({ outcome: 'under_review', note: '', refundKobo: 0 }); }}>Open</Button> },
      ]} />
      <Dialog wide open={Boolean(open)} onClose={() => setOpen(null)} title="Dispute" footer={['open', 'under_review'].includes(detail.data?.status) && <><Button variant="secondary" onClick={() => setOpen(null)}>Close</Button><Button loading={m.isPending} onClick={() => m.mutate()}>Save outcome</Button></>}>
        {detail.isLoading ? <Spinner /> : detail.data && (
          <div className="space-y-4">
            <p className="whitespace-pre-line text-sm">{detail.data.description}</p>
            <ol className="space-y-2">{(detail.data.statements || []).map((s, i) => <li key={i} className="rounded-lg border border-line p-3 text-sm"><p className="text-xs font-semibold text-muted">{humanize(s.role)}, {dateTime(s.at)}</p><p className="mt-1 whitespace-pre-line">{s.text}</p></li>)}</ol>
            {['open', 'under_review'].includes(detail.data.status) && (
              <div className="space-y-3 border-t border-line pt-4">
                <Select label="Outcome" value={res.outcome} onChange={(e) => setRes({ ...res, outcome: e.target.value })} options={[{ value: 'under_review', label: 'Still under review' }, { value: 'resolved_for_customer', label: 'In the customer’s favour' }, { value: 'resolved_for_provider', label: 'In the seller’s or provider’s favour' }]} />
                {res.outcome === 'resolved_for_customer' && <KoboInput label="Refund to the customer" value={res.refundKobo} onChange={(v) => setRes({ ...res, refundKobo: v })} />}
                <Textarea label="Explanation shared with both parties" value={res.note} onChange={(e) => setRes({ ...res, note: e.target.value })} />
              </div>
            )}
          </div>
        )}
      </Dialog>
    </>
  );
}

export function AppointmentsAdminPage() {
  return (
    <>
      <PageHeader title="Viewings" />
      <AdminList queryKey={['admin-appointments']} path="/admin/appointments" statuses={['', 'requested', 'proposed', 'awaiting_payment', 'confirmed', 'completed', 'no_show_customer', 'no_show_provider', 'cancelled_by_customer', 'cancelled_by_provider', 'declined', 'expired', 'disputed']} caption="Viewings" columns={[
        { header: 'Reference', render: (a) => <span className="font-mono text-xs">{a.reference}</span> },
        { header: 'Time', render: (a) => (a.scheduledAt ? dateTime(a.scheduledAt) : 'Not set') },
        { header: 'Customer', render: (a) => <Link className="link" to={`/admin/users/${a.customerId}`}>View</Link> },
        { header: 'Provider', render: (a) => <Link className="link" to={`/admin/users/${a.providerId}`}>View</Link> },
        { header: 'Fee', render: (a) => (a.fee?.amountKobo ? `${naira(a.fee.amountKobo)} (${humanize(a.fee.status)})` : 'None') },
        { header: 'Status', render: (a) => <Status value={a.status} /> },
      ]} />
    </>
  );
}

// ================================================================ support
export function SupportQueuePage() {
  const { can, user } = useSession();
  const qc = useQueryClient();
  const [assigned, setAssigned] = useState(can('support.view_all') ? '' : 'me');
  const assign = useMutation({ mutationFn: (id) => post(`/admin/support/tickets/${id}/assign`, { assigneeId: user.id }), onSuccess: () => qc.invalidateQueries({ queryKey: ['support-queue'] }), onError: toastError });
  return (
    <>
      <PageHeader title="Support queue" description="Sorted by priority: security and money first." />
      <AdminList queryKey={['support-queue']} path="/admin/support/tickets" extraParams={{ assigned }} statuses={[{ value: '', label: 'Open' }, 'pending_staff', 'pending_customer', 'resolved', 'closed']} caption="Tickets" empty={<EmptyState title="Queue is clear" />} columns={[
        { header: 'Ticket', render: (t) => <><Link className="link" to={`/admin/support/${t.id}`}>{t.subject}</Link><span className="block text-xs text-muted">{t.lastMessage}</span></> },
        { header: 'Priority', render: (t) => <Status value={t.priority <= 1 ? 'danger' : 'info'} tone={t.priority <= 1 ? 'danger' : 'info'}>{`P${t.priority}`}</Status> },
        { header: 'Category', render: (t) => humanize(t.category) },
        { header: 'Channel', render: (t) => humanize(t.channel) },
        { header: 'Opened', render: (t) => dateTime(t.createdAt) },
        { header: 'Status', render: (t) => <Status value={t.status} /> },
        { header: '', render: (t) => !t.assignedTo && can('support.manage') && <Button size="sm" variant="secondary" onClick={() => assign.mutate(t.id)}>Take it</Button> },
      ]}>
        {can('support.view_all') && <div className="w-48"><Select label="Assigned" value={assigned} onChange={(e) => setAssigned(e.target.value)} options={[{ value: '', label: 'Everyone' }, { value: 'me', label: 'Me' }, { value: 'unassigned', label: 'Nobody' }]} /></div>}
      </AdminList>
    </>
  );
}

// ================================================================ reports
const chartTick = { fill: 'rgb(var(--muted))', fontSize: 12 };

export function ReportsPage() {
  const { can } = useSession();
  const today = new Date().toISOString().slice(0, 10);
  const [range, setRange] = useState({ from: new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10), to: today });
  const params = `?from=${range.from}T00:00:00%2B01:00&to=${range.to}T23:59:59%2B01:00`;
  const fin = useQuery({ queryKey: ['report-fin', range], queryFn: () => get(`/admin/reports/financial${params}`) });
  const ops = useQuery({ queryKey: ['report-ops', range], queryFn: () => get(`/admin/reports/operational${params}`) });
  const exp = (type, format) => download(`/admin/reports/export/${type}/${format}${params}`, `mubapay-${type}.${format}`).catch(toastError);
  const volume = fin.data ? Object.entries(fin.data.transactionVolume.byType).map(([k, v]) => ({ name: humanize(k), naira: v.totalKobo / 100, count: v.count })).sort((a, b) => b.naira - a.naira) : [];
  return (
    <>
      <PageHeader title="Reports" description="Revenue is only what MubaPay has actually earned. Customer money moving through the platform is shown separately as volume." />
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <Input label="From" type="date" value={range.from} max={range.to} onChange={(e) => setRange({ ...range, from: e.target.value })} />
        <Input label="To" type="date" value={range.to} max={today} onChange={(e) => setRange({ ...range, to: e.target.value })} />
        {can('reports.export') && <div className="flex flex-wrap gap-2">{['financial', 'operational', 'ledger', 'withdrawals'].map((t) => <Select key={t} label={`Export ${humanize(t)}`} value="" placeholder="Format" onChange={(e) => e.target.value && exp(t, e.target.value)} options={[{ value: 'csv', label: 'CSV' }, { value: 'xlsx', label: 'Excel' }, { value: 'pdf', label: 'PDF' }]} />)}</div>}
      </div>
      {fin.isLoading ? <Spinner /> : fin.isError ? <ErrorState error={fin.error} /> : (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Panel title="Settled revenue"><p className="font-display text-3xl font-bold tabular-nums">{naira(fin.data.settledRevenue.totalKobo)}</p><p className="mt-1 text-xs text-muted">{fin.data.settledRevenue.note}</p></Panel>
            <Panel title="Owed to customers"><p className="font-display text-3xl font-bold tabular-nums">{naira(Object.values(fin.data.liabilities).reduce((a, b) => a + b, 0))}</p><p className="mt-1 text-xs text-muted">Wallets, savings, reserved withdrawals and funds awaiting fulfilment.</p></Panel>
            <Panel title="Provider fees paid"><p className="font-display text-3xl font-bold tabular-nums">{naira(fin.data.providerFeesExpenseKobo)}</p></Panel>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Revenue by stream"><KeyValue items={Object.entries(fin.data.settledRevenue.byStream).map(([k, v]) => [humanize(k.replace(/^SYS:REVENUE_?/, '')), naira(v)])} /></Panel>
            <Panel title="Liabilities"><KeyValue items={Object.entries(fin.data.liabilities).map(([k, v]) => [humanize(k.replace(/Kobo$/, '')), naira(v)])} /></Panel>
          </div>
          <Panel title="Money moved for customers, by type" action={<span className="text-xs text-muted">Not revenue</span>}>
            {volume.length ? (
              <div style={{ height: Math.max(180, volume.length * 40) }} role="img" aria-label="Transaction volume by type">
                <ResponsiveContainer>
                  <BarChart data={volume} layout="vertical" margin={{ left: 8, right: 24 }}>
                    <CartesianGrid horizontal={false} stroke="rgb(var(--line))" />
                    <XAxis type="number" tick={chartTick} tickFormatter={(v) => `₦${Intl.NumberFormat('en-NG', { notation: 'compact' }).format(v)}`} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={170} tick={chartTick} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: 'rgb(var(--ink) / 0.05)' }} contentStyle={{ background: 'rgb(var(--surface))', border: '1px solid rgb(var(--line))', borderRadius: 8, color: 'rgb(var(--ink))' }} formatter={(v, _n, p) => [`${naira(Math.round(v * 100))} across ${p.payload.count} transactions`, 'Volume']} />
                    <Bar dataKey="naira" fill="rgb(var(--palm))" radius={[0, 4, 4, 0]} maxBarSize={22} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : <p className="text-sm text-muted">No transactions in this period.</p>}
            <details className="mt-3 text-sm"><summary className="cursor-pointer">Show as a table</summary><Table caption="Volume" rows={volume} rowKey={(r) => r.name} columns={[{ header: 'Type', key: 'name' }, { header: 'Transactions', key: 'count' }, { header: 'Volume', render: (r) => naira(Math.round(r.naira * 100)) }]} /></details>
          </Panel>
          <Panel title="Pending and unreconciled">
            <KeyValue items={[['Card payments not yet confirmed', `${fin.data.pending.fundingUnconfirmed.count}, ${naira(fin.data.pending.fundingUnconfirmed.totalKobo)}`], ['Withdrawals in progress', `${fin.data.pending.withdrawals.count}, ${naira(fin.data.pending.withdrawals.totalKobo)}`], ['Refunds under review', `${fin.data.pending.refundsUnderReview.count}, ${naira(fin.data.pending.refundsUnderReview.totalKobo)}`], ['Open reconciliation differences', <Link key="r" className="link" to="/admin/reconciliation">{fin.data.reconciliationDifferences.open}</Link>]]} />
          </Panel>
        </div>
      )}
      {ops.data && (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Panel title="New sign-ups per day">
            {ops.data.users.growthByDay.length ? (
              <div style={{ height: 220 }} role="img" aria-label="New sign-ups per day">
                <ResponsiveContainer>
                  <LineChart data={ops.data.users.growthByDay} margin={{ right: 16 }}>
                    <CartesianGrid vertical={false} stroke="rgb(var(--line))" />
                    <XAxis dataKey="date" tick={chartTick} axisLine={false} tickLine={false} minTickGap={24} />
                    <YAxis allowDecimals={false} tick={chartTick} axisLine={false} tickLine={false} width={32} />
                    <Tooltip contentStyle={{ background: 'rgb(var(--surface))', border: '1px solid rgb(var(--line))', borderRadius: 8, color: 'rgb(var(--ink))' }} formatter={(v) => [v, 'Sign-ups']} />
                    <Line type="monotone" dataKey="count" stroke="rgb(var(--palm))" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : <p className="text-sm text-muted">No sign-ups in this period.</p>}
            <p className="mt-2 text-sm text-muted">{ops.data.users.new} new, {ops.data.users.total} total, {ops.data.users.activeSignIns} signed in.</p>
          </Panel>
          <Panel title="Operations">
            <KeyValue items={[
              ['Orders', Object.entries(ops.data.marketplace.ordersByStatus).map(([k, v]) => `${humanize(k)} ${v}`).join(', ') || 'None'],
              ['Customer spend (GMV)', Object.entries(ops.data.marketplace.grossMerchandiseValue).map(([k, v]) => `${humanize(k)}: ${naira(v.totalKobo)}`).join(', ') || 'None'],
              ['Delivery success', ops.data.delivery.successRate == null ? 'No completed deliveries' : `${Math.round(ops.data.delivery.successRate * 100)}%`],
              ['Properties', `${ops.data.realEstate.published} published, ${ops.data.realEstate.pendingReview} waiting review`],
              ['Viewings', Object.entries(ops.data.realEstate.viewingsByStatus).map(([k, v]) => `${humanize(k)} ${v}`).join(', ') || 'None'],
              ['Disputes', Object.entries(ops.data.disputes).map(([k, v]) => `${humanize(k)} ${v}`).join(', ') || 'None'],
              ['Pending approvals', ops.data.pendingApprovals],
            ]} />
          </Panel>
        </div>
      )}
    </>
  );
}

// ================================================================ audit & alerts
export function AuditPage() {
  const [f, setF] = useState({ category: '', action: '', targetId: '' });
  const [applied, setApplied] = useState({});
  return (
    <>
      <PageHeader title="Audit log" description="Append-only. Viewing this log is itself recorded." />
      <AdminList queryKey={['audit']} path="/admin/audit" extraParams={applied} caption="Audit events" rowKey={(e) => e._id} columns={[
        { header: 'When', render: (e) => dateTime(e.at) },
        { header: 'Who', render: (e) => <span className="text-sm">{e.actorId ? <Link className="link" to={`/admin/users/${e.actorId}`}>{humanize(e.actorType)}</Link> : humanize(e.actorType || 'system')}{e.ip ? <span className="block text-xs text-muted">{e.ip}</span> : null}</span> },
        { header: 'Action', render: (e) => <><code className="text-xs">{e.action}</code>{e.sensitiveRead && <span className="ml-1 text-xs text-warn">sensitive</span>}</> },
        { header: 'Target', render: (e) => <span className="text-xs">{e.targetType} {e.targetId}</span> },
        { header: 'Reason', render: (e) => <span className="text-sm">{e.reason}</span> },
        { header: 'Outcome', render: (e) => <Status value={e.outcome === 'success' ? 'success' : e.outcome} /> },
      ]}>
        <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); setApplied(Object.fromEntries(Object.entries(f).filter(([, v]) => v))); }}>
          <Select label="Category" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} options={['', 'security', 'finance', 'kyc', 'access', 'config', 'support', 'moderation', 'operations', 'export'].map((v) => ({ value: v, label: v ? humanize(v) : 'All' }))} />
          <Input label="Action" value={f.action} onChange={(e) => setF({ ...f, action: e.target.value })} placeholder="withdrawal.approved" />
          <Input label="Target ID" value={f.targetId} onChange={(e) => setF({ ...f, targetId: e.target.value })} />
          <Button type="submit" variant="secondary">Filter</Button>
        </form>
      </AdminList>
    </>
  );
}

export function AlertsPage() {
  const { can } = useSession();
  const qc = useQueryClient();
  const [status, setStatus] = useState('open');
  const [dlg, setDlg] = useState(null);
  const q = useQuery({ queryKey: ['alerts', status], queryFn: () => get(`/admin/alerts?status=${status}`), refetchInterval: 30000 });
  const m = useMutation({ mutationFn: (note) => post(`/admin/alerts/${dlg.a._id}/${dlg.action}`, { note }), onSuccess: () => { setDlg(null); qc.invalidateQueries({ queryKey: ['alerts'] }); }, onError: toastError });
  return (
    <>
      <PageHeader title="Alerts" description="Acknowledging an alert never deletes it; its history stays." />
      <div className="mb-4 w-48"><Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)} options={['open', 'acknowledged', 'resolved'].map((v) => ({ value: v, label: humanize(v) }))} /></div>
      {q.isLoading ? <Spinner /> : <Table caption="Alerts" rows={q.data} rowKey={(a) => a._id} empty={<EmptyState title="No alerts" />} columns={[
        { header: 'Severity', render: (a) => <Status value={a.severity} tone={a.severity === 'critical' ? 'danger' : a.severity === 'warning' ? 'pending' : 'info'}>{humanize(a.severity)}</Status> },
        { header: 'Alert', render: (a) => <><span className="font-medium">{a.message}</span><span className="block text-xs text-muted">{a.type}{a.refId ? `, ${a.refType} ${a.refId}` : ''}</span></> },
        { header: 'Raised', render: (a) => dateTime(a.createdAt) },
        { header: '', render: (a) => can('alerts.manage') && a.status !== 'resolved' && <div className="flex gap-1">{a.status === 'open' && <Button size="sm" variant="secondary" onClick={() => setDlg({ a, action: 'acknowledge' })}>Acknowledge</Button>}<Button size="sm" variant="ghost" onClick={() => setDlg({ a, action: 'resolve' })}>Resolve</Button></div> },
      ]} />}
      <ConfirmDialog open={Boolean(dlg)} onClose={() => setDlg(null)} title={dlg ? `${humanize(dlg.action)} alert` : ''} requireReason reasonLabel="Note" loading={m.isPending} onConfirm={(n) => m.mutate(n)} />
    </>
  );
}

// ================================================================ settings, flags, maintenance
export function SettingsAdminPage() {
  const { can } = useSession();
  const [tab, setTab] = useState('settings');
  return (
    <>
      <PageHeader title="Settings and features" description="Every change needs a reason, is versioned, and is checked against safe limits." />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'settings', label: 'Settings' }, { value: 'flags', label: 'Features' }, can('system.maintenance') && { value: 'maintenance', label: 'Maintenance' }, { value: 'compliance', label: 'Compliance' }].filter(Boolean)} />
      {tab === 'settings' && <SettingsEditor />}
      {tab === 'flags' && <FlagsEditor />}
      {tab === 'maintenance' && <MaintenanceEditor />}
      {tab === 'compliance' && <ComplianceEditor />}
    </>
  );
}

function SettingsEditor() {
  const { can } = useSession();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin-settings'], queryFn: () => get('/admin/settings') });
  const [key, setKey] = useState('fees');
  const [draft, setDraft] = useState(null);
  const [reason, setReason] = useState('');
  const hist = useQuery({ queryKey: ['settings-history', key], queryFn: () => get(`/admin/settings/${key}/history`) });
  const save = useMutation({ mutationFn: () => patch(`/admin/settings/${key}`, { value: JSON.parse(draft), reason }), onSuccess: () => { setDraft(null); setReason(''); qc.invalidateQueries({ queryKey: ['admin-settings'] }); qc.invalidateQueries({ queryKey: ['settings-history', key] }); toast({ tone: 'success', title: 'Setting saved' }); }, onError: toastError });
  if (q.isLoading) return <Spinner />;
  if (q.isError) return <ErrorState error={q.error} />;
  const keys = Object.keys(q.data).filter((k) => !['compliance', 'maintenance'].includes(k));
  const value = q.data[key];
  let parseError = '';
  if (draft != null) {
    try {
      JSON.parse(draft);
    } catch (e) {
      parseError = e.message;
    }
  }
  return (
    <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
      <nav aria-label="Setting groups"><ul className="space-y-1">{keys.map((k) => <li key={k}><button className={`w-full rounded-lg px-3 py-2 text-left text-sm font-semibold ${k === key ? 'bg-palm-soft text-palm' : 'hover:bg-ink/5'}`} onClick={() => { setKey(k); setDraft(null); }}>{humanize(k)}</button></li>)}</ul></nav>
      <div className="space-y-4">
        <Panel title={humanize(key)} action={can('settings.manage') && draft == null && <Button size="sm" variant="secondary" onClick={() => setDraft(JSON.stringify(value, null, 2))}>Edit</Button>}>
          {draft == null ? (
            <KeyValue items={Object.entries(value || {}).map(([k, v]) => [humanize(k), /Kobo$/.test(k) && typeof v === 'number' ? naira(v) : /Bp$/.test(k) && typeof v === 'number' ? `${v / 100}%` : typeof v === 'object' ? <code key={k} className="text-xs">{JSON.stringify(v)}</code> : String(v)])} />
          ) : (
            <div className="space-y-3">
              <Notice>Money is in kobo (₦1 = 100 kobo). Percentages ending in “Bp” are basis points (100 = 1%). The server rejects values outside safe limits.</Notice>
              <Textarea label="Value (JSON)" rows={14} className="font-mono" value={draft} onChange={(e) => setDraft(e.target.value)} error={parseError} />
              <Textarea label="Reason for the change" value={reason} onChange={(e) => setReason(e.target.value)} />
              <div className="flex gap-2"><Button loading={save.isPending} disabled={Boolean(parseError) || reason.length < 5} onClick={() => save.mutate()}>Save</Button><Button variant="ghost" onClick={() => setDraft(null)}>Cancel</Button></div>
            </div>
          )}
        </Panel>
        <Panel title="History">{hist.data?.length ? <ul className="divide-y divide-line text-sm">{hist.data.map((h) => <li key={h._id} className="py-2">Version {h.version}, {dateTime(h.createdAt)}, {who(h.changedBy)}: {h.reason}</li>)}</ul> : <p className="text-sm text-muted">Using defaults.</p>}</Panel>
      </div>
    </div>
  );
}

function FlagsEditor() {
  const { can } = useSession();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['flags'], queryFn: () => get('/admin/flags') });
  const [dlg, setDlg] = useState(null);
  const m = useMutation({ mutationFn: (reason) => put(`/admin/flags/${dlg.key}`, { enabled: !dlg.enabled, reason }), onSuccess: () => { setDlg(null); qc.invalidateQueries({ queryKey: ['flags'] }); }, onError: toastError });
  if (q.isLoading) return <Spinner />;
  return (
    <>
      <Table caption="Features" rows={q.data} rowKey={(f) => f.key} columns={[
        { header: 'Feature', render: (f) => <><span className="font-medium">{f.description}</span><code className="block text-xs text-muted">{f.key}</code></> },
        { header: 'Status', render: (f) => (f.laterPhase ? <Status value="neutral">Later phase</Status> : <Status value={f.enabled ? 'active' : 'neutral'}>{f.enabled ? 'On' : 'Off'}</Status>) },
        { header: '', render: (f) => can('flags.manage') && !f.laterPhase && <Button size="sm" variant={f.enabled ? 'ghost' : 'secondary'} onClick={() => setDlg(f)}>{f.enabled ? 'Turn off' : 'Turn on'}</Button> },
      ]} />
      <ConfirmDialog open={Boolean(dlg)} onClose={() => setDlg(null)} danger={dlg?.enabled} title={dlg ? `${dlg.enabled ? 'Turn off' : 'Turn on'} ${dlg.description}?` : ''} body={dlg?.enabled ? 'Customers lose access straight away. Work already in progress (pending payments, withdrawals) still completes.' : undefined} requireReason loading={m.isPending} onConfirm={(r) => m.mutate(r)} />
    </>
  );
}

function MaintenanceEditor() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin-settings'], queryFn: () => get('/admin/settings') });
  const [msg, setMsg] = useState('');
  const [open, setOpen] = useState(false);
  const cur = q.data?.maintenance;
  const m = useMutation({ mutationFn: (reason) => post('/admin/maintenance', { enabled: !cur.enabled, message: msg || undefined, reason }), onSuccess: () => { setOpen(false); qc.invalidateQueries({ queryKey: ['admin-settings'] }); qc.invalidateQueries({ queryKey: ['meta'] }); }, onError: toastError });
  if (!cur) return <Spinner />;
  return (
    <Panel>
      <p className="text-sm">Maintenance mode is <strong>{cur.enabled ? 'on' : 'off'}</strong>. While on, customers can’t start new financial actions; webhooks, sign-in and the staff console keep working.</p>
      {!cur.enabled && <Input className="mt-3" label="Message shown to customers" value={msg} onChange={(e) => setMsg(e.target.value)} placeholder={cur.message} />}
      <Button className="mt-3" variant={cur.enabled ? 'primary' : 'danger'} onClick={() => setOpen(true)}>{cur.enabled ? 'End maintenance' : 'Start maintenance'}</Button>
      <ConfirmDialog open={open} onClose={() => setOpen(false)} danger={!cur.enabled} title={cur.enabled ? 'End maintenance?' : 'Start maintenance?'} requireReason loading={m.isPending} onConfirm={(r) => m.mutate(r)} />
    </Panel>
  );
}

function ComplianceEditor() {
  const q = useQuery({ queryKey: ['admin-settings'], queryFn: () => get('/admin/settings') });
  const [d, setD] = useState(null);
  const [reason, setReason] = useState('');
  const initiate = useInitiateApproval(() => { setD(null); setReason(''); });
  const c = q.data?.compliance;
  if (!c) return <Spinner />;
  const form = d || { walletOperationsAuthorized: Boolean(c.walletOperationsAuthorized), savingsAuthorized: Boolean(c.savingsAuthorized), settlementHoldingAuthorized: Boolean(c.settlementHoldingAuthorized), authorizationReference: c.authorizationReference || '' };
  return (
    <Panel title="Regulatory authorisation">
      <Notice tone="warn">In production, customer wallets, savings and held seller funds stay switched off until MubaPay’s legal basis to operate them is recorded here. Only record what has actually been obtained, with a real reference. Changes need a second approver.</Notice>
      <div className="mt-4 space-y-2">
        <Checkbox label="Authorised to operate customer wallets" checked={form.walletOperationsAuthorized} onChange={(e) => setD({ ...form, walletOperationsAuthorized: e.target.checked })} />
        <Checkbox label="Authorised to hold customer savings" checked={form.savingsAuthorized} onChange={(e) => setD({ ...form, savingsAuthorized: e.target.checked })} />
        <Checkbox label="Authorised to hold seller settlement funds" checked={form.settlementHoldingAuthorized} onChange={(e) => setD({ ...form, settlementHoldingAuthorized: e.target.checked })} />
        <Input label="Licence, partner agreement or legal opinion reference" value={form.authorizationReference} onChange={(e) => setD({ ...form, authorizationReference: e.target.value })} />
      </div>
      {d && (
        <div className="mt-4 space-y-3">
          <Textarea label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} hint="At least 10 characters." />
          <Button loading={initiate.isPending} disabled={reason.length < 10} onClick={() => initiate.mutate({ action: 'settings.compliance', payload: { ...form, authorizationReference: form.authorizationReference || null }, reason })}>Send for approval</Button>
        </div>
      )}
    </Panel>
  );
}

// ================================================================ legal
export function LegalAdminPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin-legal'], queryFn: () => get('/admin/legal') });
  const [draft, setDraft] = useState(null);
  const [pub, setPub] = useState(null);
  const [reviewed, setReviewed] = useState(false);
  const create = useMutation({ mutationFn: () => post('/admin/legal', draft), onSuccess: () => { setDraft(null); qc.invalidateQueries({ queryKey: ['admin-legal'] }); toast({ tone: 'success', title: 'Draft saved' }); }, onError: toastError });
  const publish = useMutation({ mutationFn: () => post(`/admin/legal/${pub._id}/publish`, { reviewedByProfessional: reviewed }), onSuccess: () => { setPub(null); setReviewed(false); qc.invalidateQueries({ queryKey: ['admin-legal'] }); }, onError: toastError });
  const startDraft = async (doc) => {
    try {
      const cur = await get(`/legal/${doc.slug}`);
      setDraft({ slug: doc.slug, title: cur.title, content: cur.content, summaryOfChanges: '', material: false });
    } catch {
      setDraft({ slug: doc.slug, title: doc.title, content: '', summaryOfChanges: '', material: false });
    }
  };
  return (
    <>
      <PageHeader title="Legal documents" description="Templates must be reviewed by a qualified Nigerian lawyer before launch. Published versions are never edited; publish a new version instead." />
      {q.isLoading ? <Spinner /> : <Table caption="Documents" rows={q.data} rowKey={(d) => d._id} columns={[
        { header: 'Document', render: (d) => <><span className="font-medium">{d.title}</span><code className="block text-xs text-muted">{d.slug}</code></> },
        { header: 'Version', key: 'version' },
        { header: 'Status', render: (d) => <Status value={d.status} /> },
        { header: 'Lawyer reviewed', render: (d) => (d.reviewedByProfessional ? 'Yes' : <span className="text-warn">No</span>) },
        { header: 'Effective', render: (d) => (d.effectiveAt ? dateTime(d.effectiveAt) : '—') },
        { header: '', render: (d) => (d.status === 'draft' ? <Button size="sm" onClick={() => setPub(d)}>Publish</Button> : d.status === 'published' && <Button size="sm" variant="secondary" onClick={() => startDraft(d)}>New version</Button>) },
      ]} />}
      <Dialog wide open={Boolean(draft)} onClose={() => setDraft(null)} title="New version" footer={<><Button variant="secondary" onClick={() => setDraft(null)}>Cancel</Button><Button loading={create.isPending} onClick={() => create.mutate()}>Save draft</Button></>}>
        {draft && <div className="space-y-3"><Input label="Title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /><Textarea label="Content (Markdown)" rows={16} className="font-mono" value={draft.content} onChange={(e) => setDraft({ ...draft, content: e.target.value })} /><Textarea label="Summary of changes" value={draft.summaryOfChanges} onChange={(e) => setDraft({ ...draft, summaryOfChanges: e.target.value })} /><Checkbox label="Material change: customers must accept it again" checked={draft.material} onChange={(e) => setDraft({ ...draft, material: e.target.checked })} /></div>}
      </Dialog>
      <Dialog open={Boolean(pub)} onClose={() => setPub(null)} title={pub ? `Publish ${pub.title} v${pub.version}?` : ''} footer={<><Button variant="secondary" onClick={() => setPub(null)}>Cancel</Button><Button loading={publish.isPending} onClick={() => publish.mutate()}>Publish</Button></>}>
        <p className="text-sm">The current version will be superseded.{pub?.material ? ' Customers will be asked to accept the new version.' : ''}</p>
        <Checkbox className="mt-3" label="A qualified lawyer has reviewed this version" description="Only tick this if it’s true. It’s recorded in the audit log." checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} />
      </Dialog>
    </>
  );
}

// ================================================================ system
export function SystemPage() {
  const qc = useQueryClient();
  const [jobStatus, setJobStatus] = useState('failed');
  const h = useQuery({ queryKey: ['system-health'], queryFn: () => get('/admin/system/health'), refetchInterval: 30000 });
  const jobs = useQuery({ queryKey: ['system-jobs', jobStatus], queryFn: () => get(`/admin/system/jobs?status=${jobStatus}`) });
  const retry = useMutation({ mutationFn: (id) => post(`/admin/system/jobs/${id}/retry`), onSuccess: () => qc.invalidateQueries({ queryKey: ['system-jobs'] }), onError: toastError });
  if (h.isLoading) return <Spinner />;
  if (h.isError) return <ErrorState error={h.error} />;
  const d = h.data;
  const integ = Object.entries(d.integrations).filter(([k]) => k !== 'note');
  return (
    <>
      <PageHeader title="System health" description={`Build: ${d.variant === 'with-redis' ? 'with Redis and BullMQ' : 'MongoDB only, no Redis'}. Environment: ${d.env}. Node ${d.node}.`} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Database"><KeyValue items={Object.entries(d.database).map(([k, v]) => [humanize(k), typeof v === 'object' ? JSON.stringify(v) : String(v)])} /></Panel>
        <Panel title="Queues and cache"><KeyValue items={Object.entries(d.infrastructure).map(([k, v]) => [humanize(k), typeof v === 'object' ? <code key={k} className="text-xs">{JSON.stringify(v)}</code> : String(v)])} /></Panel>
        <Panel title="Integrations" className="lg:col-span-2">
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{integ.map(([k, v]) => <li key={k} className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-sm"><span>{humanize(k)}</span><Status value={v.configured ? 'active' : 'neutral'}>{v.used === false ? 'Not used in this build' : v.configured ? 'Credentials set' : 'Not configured'}</Status></li>)}</ul>
          <p className="mt-2 text-xs text-muted">{d.integrations.note}</p>
        </Panel>
      </div>
      <Panel title="Background jobs" className="mt-6">
        {jobs.data?.stats && <p className="mb-3 text-sm">{Object.entries(jobs.data.stats).map(([k, v]) => `${humanize(k)}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(', ')}</p>}
        <div className="mb-3 w-48"><Select label="Show" value={jobStatus} onChange={(e) => setJobStatus(e.target.value)} options={['failed', 'pending', 'running', 'succeeded'].map((v) => ({ value: v, label: humanize(v) }))} /></div>
        {jobs.isLoading ? <Spinner /> : <Table caption="Jobs" rows={jobs.data?.jobs} rowKey={(j) => String(j._id)} empty={<EmptyState title="No jobs in this state" />} columns={[
          { header: 'Job', render: (j) => <code className="text-xs">{j.name}</code> },
          { header: 'Attempts', render: (j) => j.attempts ?? 0 },
          { header: 'Last error', render: (j) => <span className="text-xs text-danger">{j.lastError}</span> },
          { header: 'When', render: (j) => dateTime(j.updatedAt) },
          { header: '', render: (j) => jobStatus === 'failed' && <Button size="sm" variant="secondary" onClick={() => retry.mutate(String(j._id))}>Retry</Button> },
        ]} />}
      </Panel>
    </>
  );
}
