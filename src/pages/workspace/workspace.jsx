import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ImagePlus, Trash2 } from 'lucide-react';
import { api, get, patch, post } from '../../lib/api';
import { dateTime, humanize, naira, toKobo } from '../../lib/format';
import { useSession } from '../../lib/session';
import { Button, Checkbox, EmptyState, ErrorState, Input, KeyValue, Notice, PageHeader, Panel, Select, Spinner, Status, Table, Tabs, Textarea } from '../../components/ui';
import { ConfirmDialog } from '../../components/ui/dialog';
import { KoboInput, PolicyConsent } from '../../components/ui/forms';
import { toast, toastError } from '../../components/ui/toast';
import { LocationPicker, StatusTimeline } from '../../components/domain';
import { stateOptions } from '../app/account';

/**
 * Direct-to-Cloudinary signed upload. The server signs (folder, timestamp,
 * owner context); the file never passes through our API. If Cloudinary is
 * not configured, the server answers INTEGRATION_NOT_CONFIGURED and the
 * uploader says so instead of pretending to work.
 */
export function MediaUploader({ purpose, items, onChange, kinds, max = 10 }) {
  const { meta } = useSession();
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState(kinds?.[0]?.value);
  if (meta && !meta.integrations?.cloudinary) {
    return <Notice tone="warn" title="Photo uploads aren’t available yet">Media storage isn’t configured on this server. You can save a draft now and add photos once it’s set up.</Notice>;
  }
  const upload = async (files) => {
    setBusy(true);
    try {
      const added = [];
      for (const file of Array.from(files).slice(0, max - items.length)) {
        if (file.size > 10 * 1024 * 1024) throw new Error(`${file.name} is larger than 10MB`);
        const sig = await post('/marketplace/media/sign', { purpose });
        const fd = new FormData();
        fd.append('file', file);
        fd.append('api_key', sig.apiKey);
        fd.append('timestamp', String(sig.timestamp));
        fd.append('folder', sig.folder);
        fd.append('context', sig.context);
        fd.append('signature', sig.signature);
        const res = await fetch(sig.uploadUrl, { method: 'POST', body: fd });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.error?.message || 'Upload failed');
        added.push({ url: body.secure_url, publicId: body.public_id, width: body.width, height: body.height, ...(kind ? { kind } : {}) });
      }
      onChange([...items, ...added]);
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {items.map((m, i) => (
          <figure key={m.url} className="relative overflow-hidden rounded-lg border border-line">
            <img src={m.url} alt={m.alt || m.caption || `Upload ${i + 1}`} className="aspect-square w-full object-cover" />
            {m.kind && <figcaption className="absolute bottom-0 left-0 right-0 bg-ink/70 px-1 text-[11px] text-white">{humanize(m.kind)}</figcaption>}
            <button type="button" className="absolute right-1 top-1 rounded bg-surface/90 p-1" aria-label="Remove image" onClick={() => onChange(items.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></button>
          </figure>
        ))}
        {items.length < max && (
          <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-line text-sm text-muted hover:border-palm">
            {busy ? <Spinner label="Uploading" /> : <><ImagePlus className="h-6 w-6" aria-hidden />Add</>}
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" disabled={busy} onChange={(e) => upload(e.target.files)} />
          </label>
        )}
      </div>
      {kinds && <div className="mt-2 max-w-xs"><Select label="Next upload is a" value={kind} onChange={(e) => setKind(e.target.value)} options={kinds} /></div>}
    </div>
  );
}

// ================================================================ seller (used items)
export function SellerPage() {
  const { user } = useSession();
  const [tab, setTab] = useState('listings');
  const listings = useQuery({ queryKey: ['seller-listings'], queryFn: () => get('/marketplace/seller/listings') });
  const orders = useQuery({ queryKey: ['orders', 'seller'], queryFn: () => get('/marketplace/orders?role=seller'), enabled: tab === 'orders' });
  const settlements = useQuery({ queryKey: ['seller-settlements'], queryFn: () => get('/marketplace/seller/settlements'), enabled: tab === 'settlements' });
  const verified = user.kycStatus === 'approved';
  return (
    <>
      <PageHeader title="Sell used items" description="List things you no longer need. Every listing is checked by our team before it goes live. You’re paid after the buyer receives the item and the return window closes." actions={verified && <Button to="/app/seller/new">New listing</Button>} />
      {!verified && <div className="mb-4"><Notice tone="warn" title="Verify your identity to sell">Only verified people can sell on MubaPay. <Link className="link" to="/app/verification">Start verification</Link></Notice></div>}
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'listings', label: 'Listings' }, { value: 'orders', label: 'Orders to fulfil' }, { value: 'settlements', label: 'Payouts' }]} />
      {tab === 'listings' && (listings.isLoading ? <Spinner /> : (
        <Table caption="Your listings" rows={listings.data} empty={<EmptyState title="No listings yet" body="Phones, furniture, appliances and more sell well." />} columns={[
          { header: 'Item', render: (p) => <Link className="link" to={`/app/seller/${p.id}`}>{p.title}</Link> },
          { header: 'Price', render: (p) => naira(p.priceKobo) },
          { header: 'Stock', key: 'stock' },
          { header: 'Status', render: (p) => <><Status value={p.status} />{p.rejectionReason && <span className="block text-xs text-muted">{p.rejectionReason}</span>}</> },
        ]} />
      ))}
      {tab === 'orders' && (orders.isLoading ? <Spinner /> : (
        <Table caption="Orders" rows={orders.data?.data} empty={<EmptyState title="No orders yet" />} columns={[
          { header: 'Order', render: (o) => <Link className="link" to={`/app/seller/orders/${o.id}`}>{o.orderNumber}</Link> },
          { header: 'Placed', render: (o) => dateTime(o.createdAt) },
          { header: 'Fulfilment', render: (o) => humanize(o.fulfilmentMethod) },
          { header: 'Status', render: (o) => <Status value={o.status} /> },
        ]} />
      ))}
      {tab === 'settlements' && (settlements.isLoading ? <Spinner /> : (
        <Table caption="Payouts" rows={settlements.data} rowKey={(s) => s.reference} empty={<EmptyState title="No payouts yet" />} columns={[
          { header: 'Reference', key: 'reference' },
          { header: 'Sale', render: (s) => naira(s.grossKobo) },
          { header: 'Commission', render: (s) => naira(s.commissionKobo) },
          { header: 'You receive', render: (s) => <strong>{naira(s.netKobo)}</strong> },
          { header: 'Status', render: (s) => <><Status value={s.status} />{s.holdReason && <span className="block text-xs text-muted">{s.holdReason}</span>}</> },
        ]} />
      ))}
    </>
  );
}

const blankListing = { title: '', description: '', brand: '', categoryId: '', condition: 'good', conditionNotes: '', priceKobo: 0, stock: 1, weightKg: '', images: [], fulfilment: { delivery: true, collection: false, originState: 'Anambra', originCity: '', originAddress: '' } };

export function SellerListingEditPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const isNew = !id || id === 'new';
  const cats = useQuery({ queryKey: ['categories'], queryFn: () => get('/marketplace/categories') });
  const existing = useQuery({ queryKey: ['seller-listings'], queryFn: () => get('/marketplace/seller/listings'), enabled: !isNew });
  const [f, setF] = useState(null);
  const [accepted, setAccepted] = useState([]);
  const current = !isNew ? existing.data?.find((p) => p.id === id) : null;
  const form = f || (isNew ? blankListing : current && { ...blankListing, ...current, weightKg: current.weightKg || '', fulfilment: { ...blankListing.fulfilment, ...current.fulfilment } });
  const set = (k, v) => setF({ ...form, [k]: v });
  const save = useMutation({
    mutationFn: (submit) => {
      const body = {
        title: form.title, description: form.description, brand: form.brand || undefined, categoryId: form.categoryId, condition: form.condition, conditionNotes: form.conditionNotes,
        priceKobo: form.priceKobo, stock: Number(form.stock) || 1, images: form.images.map(({ url, publicId, width, height, alt }) => ({ url, publicId, width, height, alt })), weightKg: form.weightKg ? Number(form.weightKg) : undefined,
        fulfilment: form.fulfilment, submit, acceptedPolicies: submit ? accepted : undefined,
      };
      return isNew ? post('/marketplace/seller/listings', body) : patch(`/marketplace/seller/listings/${id}`, body);
    },
    onSuccess: (p, submit) => { qc.invalidateQueries({ queryKey: ['seller-listings'] }); toast({ tone: 'success', title: submit ? 'Sent for review' : 'Draft saved' }); nav(isNew ? `/app/seller/${p.id}` : '/app/seller'); },
    onError: toastError,
  });
  const archive = useMutation({ mutationFn: () => post(`/marketplace/seller/listings/${id}/archive`), onSuccess: () => { qc.invalidateQueries({ queryKey: ['seller-listings'] }); nav('/app/seller'); }, onError: toastError });
  const [confirmArchive, setConfirmArchive] = useState(false);
  if (!isNew && existing.isLoading) return <Spinner />;
  if (!form) return <ErrorState error={{ message: 'Listing not found' }} />;
  const locked = current && ['pending_review', 'sold_out'].includes(current.status);
  const leaf = (cats.data || []).filter((c) => c.allowsUsed !== false);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={isNew ? 'New listing' : form.title} actions={current && <Status value={current.status} />} />
      {current?.rejectionReason && <Notice tone="warn" title="Changes requested">{current.rejectionReason}</Notice>}
      {locked && <Notice>This listing is under review and can’t be edited right now.</Notice>}
      <fieldset disabled={locked} className="space-y-6">
        <Panel title="What are you selling?">
          <div className="space-y-4">
            <Input label="Title" value={form.title} onChange={(e) => set('title', e.target.value)} maxLength={140} hint="Say exactly what it is, for example “Samsung Galaxy A54, 128GB, black”." required />
            <div className="grid gap-4 sm:grid-cols-2">
              <Select label="Category" value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)} placeholder="Choose a category" options={leaf.map((c) => ({ value: c._id, label: c.name }))} required />
              <Input label="Brand (optional)" value={form.brand} onChange={(e) => set('brand', e.target.value)} />
            </div>
            <Textarea label="Description" rows={6} value={form.description} onChange={(e) => set('description', e.target.value)} hint="At least 20 characters. Include size, model, age and what’s included." required />
          </div>
        </Panel>
        <Panel title="Condition">
          <div className="space-y-4">
            <Select label="Condition" value={form.condition} onChange={(e) => set('condition', e.target.value)} options={[{ value: 'like_new', label: 'Like new: barely used, no marks' }, { value: 'good', label: 'Good: light signs of use' }, { value: 'fair', label: 'Fair: visible wear, works fully' }]} />
            <Textarea label="Describe any marks, faults or repairs" value={form.conditionNotes} onChange={(e) => set('conditionNotes', e.target.value)} hint="Be honest. Items that don’t match the description can be returned at your cost." required />
          </div>
        </Panel>
        <Panel title="Photos">
          <MediaUploader purpose="products" items={form.images} onChange={(v) => set('images', v)} />
          <p className="mt-2 text-sm text-muted">Use your own photos in good light. Show any faults clearly.</p>
        </Panel>
        <Panel title="Price and delivery">
          <div className="grid gap-4 sm:grid-cols-3">
            <KoboInput label="Price" value={form.priceKobo} onChange={(v) => set('priceKobo', v)} required />
            <Input label="Quantity" type="number" min={1} max={20} value={form.stock} onChange={(e) => set('stock', e.target.value)} />
            <Input label="Weight in kg" type="number" step="0.1" min={0.01} value={form.weightKg} onChange={(e) => set('weightKg', e.target.value)} hint="Used for delivery quotes." />
          </div>
          <div className="mt-4 space-y-2">
            <Checkbox label="Offer delivery (Anambra, Enugu and Imo)" checked={form.fulfilment.delivery} onChange={(e) => set('fulfilment', { ...form.fulfilment, delivery: e.target.checked })} />
            <Checkbox label="Allow collection from a MubaPay collection point" checked={form.fulfilment.collection} onChange={(e) => set('fulfilment', { ...form.fulfilment, collection: e.target.checked })} />
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Select label="Item is in" value={form.fulfilment.originState} onChange={(e) => set('fulfilment', { ...form.fulfilment, originState: e.target.value })} options={['Anambra', 'Enugu', 'Imo'].map((s) => ({ value: s, label: s }))} />
            <Input label="City or town" value={form.fulfilment.originCity} onChange={(e) => set('fulfilment', { ...form.fulfilment, originCity: e.target.value })} />
            <Input className="sm:col-span-2" label="Pickup address for the courier" value={form.fulfilment.originAddress || ''} onChange={(e) => set('fulfilment', { ...form.fulfilment, originAddress: e.target.value })} hint="Only shared with the delivery partner." />
          </div>
        </Panel>
        <Panel title="Before you submit">
          <PolicyConsent slugs={['prohibited_items_policy', 'marketplace_refund_policy']} accepted={accepted} onChange={setAccepted} />
        </Panel>
        <div className="flex flex-wrap gap-2">
          <Button loading={save.isPending && save.variables === true} onClick={() => save.mutate(true)}>Submit for review</Button>
          <Button variant="secondary" loading={save.isPending && save.variables === false} onClick={() => save.mutate(false)}>Save draft</Button>
          {current && current.status !== 'archived' && <Button variant="ghost" onClick={() => setConfirmArchive(true)}>Archive listing</Button>}
        </div>
      </fieldset>
      {current?.moderationHistory?.length > 0 && <Panel title="Review history"><StatusTimeline items={current.moderationHistory.map((h) => ({ status: h.action || h.status, at: h.at, note: h.reason || h.note }))} /></Panel>}
      <ConfirmDialog open={confirmArchive} onClose={() => setConfirmArchive(false)} title="Archive this listing?" body="It will be removed from the marketplace. Orders already placed are not affected." confirmLabel="Archive" loading={archive.isPending} onConfirm={() => archive.mutate()} />
    </div>
  );
}

export function SellerOrderPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['order', id], queryFn: () => get(`/marketplace/orders/${id}`) });
  const [code, setCode] = useState('');
  const [dlg, setDlg] = useState(null);
  const act = useMutation({ mutationFn: (body) => post(`/marketplace/orders/${id}/fulfilment`, body), onSuccess: () => { setDlg(null); qc.invalidateQueries({ queryKey: ['order', id] }); }, onError: toastError });
  const collect = useMutation({ mutationFn: () => post(`/marketplace/orders/${id}/collection/confirm`, { code }), onSuccess: () => { toast({ tone: 'success', title: 'Collection confirmed' }); qc.invalidateQueries({ queryKey: ['order', id] }); }, onError: toastError });
  if (q.isLoading) return <Spinner />;
  if (q.isError) return <ErrorState error={q.error} />;
  const o = q.data;
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={`Order ${o.orderNumber}`} actions={<Status value={o.status} />} />
      <Panel title="Items">
        <ul className="divide-y divide-line text-sm">{o.items.map((i) => <li key={i.productId} className="flex justify-between py-2"><span>{i.quantity} × {i.title}</span><span>{naira(i.unitPriceKobo * i.quantity)}</span></li>)}</ul>
      </Panel>
      <Panel title="Fulfilment">
        <KeyValue items={[['Method', humanize(o.fulfilmentMethod)], o.delivery?.trackingUrl && ['Tracking', <a key="t" className="link" href={o.delivery.trackingUrl} target="_blank" rel="noreferrer">Track parcel</a>], o.delivery?.status && ['Delivery status', humanize(o.delivery.status)]]} />
        <div className="mt-4 flex flex-wrap gap-2">
          {o.status === 'paid' && <Button onClick={() => act.mutate({ action: 'start_processing' })}>Start preparing</Button>}
          {o.status === 'processing' && <Button onClick={() => act.mutate({ action: 'ready' })}>{o.fulfilmentMethod === 'collection' ? 'Ready for collection' : 'Ready for pickup by courier'}</Button>}
          {['paid', 'processing'].includes(o.status) && <Button variant="ghost" onClick={() => setDlg('cancel')}>I can’t fulfil this order</Button>}
        </div>
        {o.status === 'ready_for_collection' && (
          <form className="mt-4 flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); collect.mutate(); }}>
            <Input label="Buyer’s 6-digit collection code" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
            <Button type="submit" loading={collect.isPending} disabled={code.length !== 6}>Confirm handover</Button>
          </form>
        )}
      </Panel>
      <Panel title="History"><StatusTimeline items={o.history} /></Panel>
      <ConfirmDialog open={dlg === 'cancel'} onClose={() => setDlg(null)} danger title="Cancel this order?" body="The buyer is refunded in full. Frequent cancellations can limit your selling." requireReason confirmLabel="Cancel order" loading={act.isPending} onConfirm={(note) => act.mutate({ action: 'cancel', note })} />
    </div>
  );
}

// ================================================================ landlord / agent
export function PropertiesWorkspacePage() {
  const q = useQuery({ queryKey: ['my-properties'], queryFn: () => get('/realestate/listings/mine') });
  return (
    <>
      <PageHeader title="Your properties" description="Listings are reviewed before they’re published. MubaPay does not collect rent, deposits or purchase payments; only optional viewing fees." actions={<><Button variant="secondary" to="/app/provider/appointments">Viewing requests</Button><Button to="/app/properties/new">New listing</Button></>} />
      {q.isLoading ? <Spinner /> : (
        <Table caption="Properties" rows={q.data} empty={<EmptyState title="No properties yet" action={<Button to="/app/properties/new">List a property</Button>} />} columns={[
          { header: 'Property', render: (p) => <Link className="link" to={`/app/properties/${p.id}`}>{p.title}</Link> },
          { header: 'Type', render: (p) => `${humanize(p.listingType)}, ${humanize(p.propertyType)}` },
          { header: 'Price', render: (p) => `${naira(p.priceKobo)}${p.rentPeriod ? ` per ${p.rentPeriod === 'yearly' ? 'year' : 'month'}` : ''}` },
          { header: 'Your role', render: (p) => humanize(p.myRole) },
          { header: 'Views', render: (p) => p.stats?.views ?? 0 },
          { header: 'Status', render: (p) => <><Status value={p.status} />{p.rejectionReason && <span className="block text-xs text-muted">{p.rejectionReason}</span>}</> },
        ]} />
      )}
    </>
  );
}

const blankProperty = {
  title: '', description: '', listingType: 'rent', propertyType: 'apartment', priceKobo: 0, rentPeriod: 'yearly',
  location: { addressPrivate: '', area: '', city: '', lga: '', state: 'Anambra' }, lat: null, lng: null, bedrooms: 2, bathrooms: 2, landSizeSqm: '',
  amenities: [], furnishing: 'unfurnished', availability: { status: 'available' }, media: [], viewingFee: { required: false, amountKobo: 0 }, listingAuthority: { basis: 'owner', notes: '' },
};
const AMENITIES = ['Borehole', 'Prepaid meter', 'Security', 'Parking', 'Fenced compound', 'Tiled floors', 'POP ceiling', 'Wardrobes', 'Kitchen cabinets', 'Generator house', 'Water heater', 'Air conditioning'];

export function PropertyEditPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { user } = useSession();
  const isNew = !id || id === 'new';
  const mine = useQuery({ queryKey: ['my-properties'], queryFn: () => get('/realestate/listings/mine'), enabled: !isNew });
  const current = !isNew ? mine.data?.find((p) => p.id === id) : null;
  const [f, setF] = useState(null);
  const [agentEmail, setAgentEmail] = useState('');
  const form = f || (isNew ? { ...blankProperty, listingAuthority: { basis: user.capabilities?.landlord ? 'owner' : 'agent_mandate', notes: '' } } : current && {
    ...blankProperty, ...current, location: { ...blankProperty.location, ...current.location, addressPrivate: current.location?.address || '' },
    lat: current.location?.approxCoordinates?.lat ?? null, lng: current.location?.approxCoordinates?.lng ?? null, landSizeSqm: current.landSizeSqm || '', viewingFee: current.viewingFee || blankProperty.viewingFee, listingAuthority: blankProperty.listingAuthority,
  });
  const set = (k, v) => setF({ ...form, [k]: v });
  const setLoc = (k, v) => setF({ ...form, location: { ...form.location, [k]: v } });
  const save = useMutation({
    mutationFn: (submit) => {
      const body = {
        title: form.title, description: form.description, listingType: form.listingType, propertyType: form.propertyType, priceKobo: form.priceKobo,
        rentPeriod: form.listingType === 'rent' ? form.rentPeriod : undefined, location: Object.fromEntries(Object.entries(form.location).filter(([k, v]) => v && k !== 'approxCoordinates' && k !== 'address')),
        ...(form.lat != null ? { lat: form.lat, lng: form.lng } : {}), bedrooms: form.propertyType === 'land' ? undefined : Number(form.bedrooms), bathrooms: form.propertyType === 'land' ? undefined : Number(form.bathrooms),
        landSizeSqm: form.landSizeSqm ? Number(form.landSizeSqm) : undefined, amenities: form.amenities, furnishing: form.furnishing, availability: { status: form.availability?.status || 'available' },
        media: form.media.map(({ url, publicId, caption, kind }) => ({ url, publicId, caption, kind: kind || 'photo' })), viewingFee: form.viewingFee, listingAuthority: isNew ? form.listingAuthority : undefined, submit,
      };
      return isNew ? post('/realestate/listings', body) : patch(`/realestate/listings/${id}`, body);
    },
    onSuccess: (p, submit) => { qc.invalidateQueries({ queryKey: ['my-properties'] }); toast({ tone: 'success', title: submit ? 'Sent for review' : 'Draft saved' }); if (isNew) nav(`/app/properties/${p.id}`); },
    onError: toastError,
  });
  const docUpload = useMutation({ mutationFn: ({ file, category }) => { const fd = new FormData(); fd.append('file', file); fd.append('category', category); return api(`/realestate/listings/${id}/documents`, { method: 'POST', form: fd }); }, onSuccess: () => toast({ tone: 'success', title: 'Document uploaded', body: 'Stored privately for our review team.' }), onError: toastError });
  const agent = useMutation({ mutationFn: (revoke) => post(`/realestate/listings/${id}/agents`, { agentEmail, revoke }), onSuccess: () => { setAgentEmail(''); toast({ tone: 'success', title: 'Agent updated' }); qc.invalidateQueries({ queryKey: ['my-properties'] }); }, onError: toastError });
  const [docCat, setDocCat] = useState('ownership');
  if (!isNew && mine.isLoading) return <Spinner />;
  if (!form) return <ErrorState error={{ message: 'Property not found' }} />;
  const isLand = form.propertyType === 'land';
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={isNew ? 'List a property' : form.title} actions={current && <><Status value={current.status} />{current.status === 'published' && <Button variant="ghost" to={`/real-estate/${current.slug}`}>View listing</Button>}</>} />
      {current?.rejectionReason && <Notice tone="warn" title="Changes requested">{current.rejectionReason}</Notice>}
      <Panel title="The basics">
        <div className="space-y-4">
          <Input label="Title" value={form.title} onChange={(e) => set('title', e.target.value)} hint="For example “3-bedroom flat in Independence Layout”." required />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Listing type" value={form.listingType} onChange={(e) => set('listingType', e.target.value)} options={[{ value: 'rent', label: 'For rent' }, { value: 'sale', label: 'For sale' }, { value: 'land', label: 'Land' }]} />
            <Select label="Property type" value={form.propertyType} onChange={(e) => set('propertyType', e.target.value)} options={['apartment', 'self_contain', 'mini_flat', 'bungalow', 'duplex', 'terrace', 'detached', 'commercial', 'shop', 'land'].map((v) => ({ value: v, label: humanize(v) }))} />
            <KoboInput label={form.listingType === 'rent' ? 'Rent' : 'Price'} value={form.priceKobo} onChange={(v) => set('priceKobo', v)} required />
            {form.listingType === 'rent' && <Select label="Rent is paid" value={form.rentPeriod} onChange={(e) => set('rentPeriod', e.target.value)} options={[{ value: 'yearly', label: 'Yearly' }, { value: 'monthly', label: 'Monthly' }]} />}
          </div>
          <Textarea label="Description" rows={6} value={form.description} onChange={(e) => set('description', e.target.value)} hint="At least 30 characters. Mention water, power, road access and any service charge." required />
        </div>
      </Panel>
      <Panel title="Location">
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="State" value={form.location.state} onChange={(e) => setLoc('state', e.target.value)} options={stateOptions} />
          <Input label="City or town" value={form.location.city} onChange={(e) => setLoc('city', e.target.value)} required />
          <Input label="Area or neighbourhood" value={form.location.area} onChange={(e) => setLoc('area', e.target.value)} />
          <Input label="LGA" value={form.location.lga} onChange={(e) => setLoc('lga', e.target.value)} />
          <Input className="sm:col-span-2" label="Exact address" value={form.location.addressPrivate} onChange={(e) => setLoc('addressPrivate', e.target.value)} hint="Kept private. Shared only with customers whose viewing is confirmed." />
        </div>
        <div className="mt-4"><LocationPicker value={form.lat != null ? { lat: form.lat, lng: form.lng } : null} onChange={(p) => setF({ ...form, lat: p.lat, lng: p.lng, location: { ...form.location, ...(p.city && !form.location.city ? { city: p.city } : {}) } })} /></div>
      </Panel>
      <Panel title="Details">
        <div className="grid gap-4 sm:grid-cols-3">
          {!isLand && <Input label="Bedrooms" type="number" min={0} value={form.bedrooms} onChange={(e) => set('bedrooms', e.target.value)} />}
          {!isLand && <Input label="Bathrooms" type="number" min={0} value={form.bathrooms} onChange={(e) => set('bathrooms', e.target.value)} />}
          <Input label="Land size (m²)" type="number" min={0} value={form.landSizeSqm} onChange={(e) => set('landSizeSqm', e.target.value)} />
          {!isLand && <Select label="Furnishing" value={form.furnishing} onChange={(e) => set('furnishing', e.target.value)} options={['unfurnished', 'semi_furnished', 'furnished'].map((v) => ({ value: v, label: humanize(v) }))} />}
          <Select label="Availability" value={form.availability?.status || 'available'} onChange={(e) => set('availability', { status: e.target.value })} options={['available', 'under_offer', 'let', 'sold'].map((v) => ({ value: v, label: humanize(v) }))} />
        </div>
        {!isLand && <fieldset className="mt-4"><legend className="label">Amenities</legend><div className="flex flex-wrap gap-x-4 gap-y-2">{AMENITIES.map((a) => <label key={a} className="inline-flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4" checked={form.amenities.includes(a)} onChange={(e) => set('amenities', e.target.checked ? [...form.amenities, a] : form.amenities.filter((x) => x !== a))} />{a}</label>)}</div></fieldset>}
      </Panel>
      <Panel title="Photos, plans and tours">
        <MediaUploader purpose="properties" max={40} items={form.media} onChange={(v) => set('media', v)} kinds={[{ value: 'photo', label: 'Photo' }, { value: 'site_photo', label: 'Site photo' }, { value: 'floor_plan', label: 'Floor plan image' }, { value: 'tour_360', label: '360° photo' }]} />
        <p className="mt-2 text-sm text-muted">Only upload real photos of this property. 360° photos are shown as-is; we don’t generate tours.</p>
      </Panel>
      <Panel title="Viewing fee">
        <Checkbox label="Charge a viewing fee" description="Held by MubaPay and released to you after the viewing. Refunded to the customer if you cancel or don’t show up." checked={form.viewingFee.required} onChange={(e) => set('viewingFee', { ...form.viewingFee, required: e.target.checked })} />
        {form.viewingFee.required && <div className="mt-3 max-w-xs"><KoboInput label="Fee" value={form.viewingFee.amountKobo} onChange={(v) => set('viewingFee', { ...form.viewingFee, amountKobo: v })} hint="Our current maximum applies; we’ll tell you if it’s over." /></div>}
      </Panel>
      {isNew && (
        <Panel title="Your right to list this property">
          <Select label="I am" value={form.listingAuthority.basis} onChange={(e) => set('listingAuthority', { ...form.listingAuthority, basis: e.target.value })} options={[user.capabilities?.landlord && { value: 'owner', label: 'The owner' }, user.capabilities?.agent && { value: 'agent_mandate', label: 'An agent with the owner’s permission' }].filter(Boolean)} />
          <Textarea className="mt-3" label="Notes for our review team (optional)" value={form.listingAuthority.notes} onChange={(e) => set('listingAuthority', { ...form.listingAuthority, notes: e.target.value })} />
          <p className="mt-2 text-sm text-muted">After saving, upload proof of ownership or the owner’s authority letter below.</p>
        </Panel>
      )}
      <div className="flex flex-wrap gap-2">
        <Button loading={save.isPending && save.variables === true} onClick={() => save.mutate(true)}>Submit for review</Button>
        <Button variant="secondary" loading={save.isPending && save.variables === false} onClick={() => save.mutate(false)}>Save draft</Button>
      </div>
      {!isNew && (
        <>
          <Panel title="Documents for review">
            <p className="text-sm text-muted">Stored privately. Never shown on the public listing.</p>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <Select label="Document type" value={docCat} onChange={(e) => setDocCat(e.target.value)} options={[{ value: 'ownership', label: 'Proof of ownership' }, { value: 'agent_authority', label: 'Owner’s authority letter' }, { value: 'agreement', label: 'Agreement' }, { value: 'other', label: 'Other' }]} />
              <label className="inline-flex min-h-[44px] cursor-pointer items-center rounded-lg border border-line px-4 font-semibold hover:bg-ink/5">{docUpload.isPending ? 'Uploading…' : 'Choose file'}<input type="file" className="sr-only" accept="image/jpeg,image/png,application/pdf" onChange={(e) => e.target.files[0] && docUpload.mutate({ file: e.target.files[0], category: docCat })} /></label>
            </div>
          </Panel>
          {current?.myRole === 'landlord' && (
            <Panel title="Authorise an agent">
              <p className="text-sm">Let a verified MubaPay agent manage viewings for this property.</p>
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <Input label="Agent’s email" type="email" value={agentEmail} onChange={(e) => setAgentEmail(e.target.value)} />
                <Button variant="secondary" loading={agent.isPending} disabled={!agentEmail} onClick={() => agent.mutate(false)}>Authorise</Button>
                <Button variant="ghost" disabled={!agentEmail} onClick={() => agent.mutate(true)}>Remove</Button>
              </div>
            </Panel>
          )}
          {current?.moderationHistory?.length > 0 && <Panel title="Review history"><StatusTimeline items={current.moderationHistory.map((h) => ({ status: h.action || h.status, at: h.at, note: h.reason || h.note }))} /></Panel>}
        </>
      )}
    </div>
  );
}

export { toKobo };
