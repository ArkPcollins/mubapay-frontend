import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Heart, Flag, Truck, Store, MapPin, BedDouble, Bath, Ruler, Eye, ArrowLeft } from 'lucide-react';
import { get, post, put, del } from '../../lib/api';
import { naira, humanize } from '../../lib/format';
import { useSeo } from '../../lib/seo';
import { useSession } from '../../lib/session';
import { Button, ErrorState, EmptyState, Input, Notice, Pagination, Select, Spinner, Textarea, cx } from '../../components/ui';
import { Dialog } from '../../components/ui/dialog';
import { toast, toastError } from '../../components/ui/toast';
import { ProductCard, PropertyCard, PropertyMap, Plan2D } from '../../components/domain';

function useParamsState() {
  const [sp, setSp] = useSearchParams();
  const params = Object.fromEntries(sp.entries());
  const set = (patch) => {
    const next = { ...params, ...patch };
    if (!('page' in patch)) next.page = '';
    setSp(Object.fromEntries(Object.entries(next).filter(([, v]) => v !== '' && v != null)));
  };
  return [params, set];
}

// ---------------------------------------------------------------- marketplace
export function MarketplacePage() {
  useSeo({ title: 'Marketplace', description: 'New and fairly used products with delivery in Anambra, Enugu and Imo.' });
  const [p, set] = useParamsState();
  const { user } = useSession();
  const cats = useQuery({ queryKey: ['categories'], queryFn: () => get('/marketplace/categories') });
  const q = useQuery({ queryKey: ['products', p], queryFn: () => get(`/marketplace/products?${new URLSearchParams(p)}`), keepPreviousData: true });
  const [query, setQuery] = useState(p.q || '');
  const saveSearch = useMutation({ mutationFn: () => post('/marketplace/saved-searches', { scope: 'products', name: p.q || 'My search', query: p, alertsEnabled: true, alertFrequency: 'daily' }), onSuccess: () => toast({ tone: 'success', title: 'Search saved', body: 'We’ll let you know about new matches daily.' }), onError: toastError });
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="page-title">Marketplace</h1>
      <form className="mt-4 flex gap-2" role="search" onSubmit={(e) => { e.preventDefault(); set({ q: query }); }}>
        <input className="field" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search phones, blenders, furniture…" aria-label="Search products" />
        <Button type="submit">Search</Button>
      </form>
      <div className="mt-6 grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside aria-label="Filters" className="space-y-4">
          <Select label="Category" value={p.category || ''} onChange={(e) => set({ category: e.target.value })} placeholder="All categories" options={(cats.data || []).filter((c) => !c.prohibited).map((c) => ({ value: c._id, label: c.name }))} />
          <Select label="New or used" value={p.kind || ''} onChange={(e) => set({ kind: e.target.value })} placeholder="Both" options={[{ value: 'new', label: 'New (sold by MubaPay)' }, { value: 'used', label: 'Fairly used' }]} />
          <Select label="Condition" value={p.condition || ''} onChange={(e) => set({ condition: e.target.value })} placeholder="Any" options={['new', 'like_new', 'good', 'fair']} />
          <div className="grid grid-cols-2 gap-2">
            <Input label="Min ₦" inputMode="numeric" defaultValue={p.minPrice ? p.minPrice / 100 : ''} onBlur={(e) => set({ minPrice: e.target.value ? Number(e.target.value) * 100 : '' })} />
            <Input label="Max ₦" inputMode="numeric" defaultValue={p.maxPrice ? p.maxPrice / 100 : ''} onBlur={(e) => set({ maxPrice: e.target.value ? Number(e.target.value) * 100 : '' })} />
          </div>
          <Input label="Brand" defaultValue={p.brand || ''} onBlur={(e) => set({ brand: e.target.value })} />
          <Select label="Seller" value={p.seller || ''} onChange={(e) => set({ seller: e.target.value })} placeholder="Anyone" options={[{ value: 'mubapay', label: 'MubaPay' }, { value: 'individual', label: 'Verified individuals' }]} />
          <Select label="Deliver to" value={p.state || ''} onChange={(e) => set({ state: e.target.value })} placeholder="Any state" options={['Anambra', 'Enugu', 'Imo', 'Lagos', 'Abuja (FCT)', 'Rivers']} hint="We currently deliver within Anambra, Enugu and Imo." />
          <fieldset className="space-y-2 text-sm">
            <legend className="label">Options</legend>
            {[['inStock', 'In stock only'], ['delivery', 'Delivery available'], ['collection', 'Collection available']].map(([k, l]) => (
              <label key={k} className="flex items-center gap-2"><input type="checkbox" checked={p[k] === 'true'} onChange={(e) => set({ [k]: e.target.checked ? 'true' : '' })} className="h-5 w-5 accent-[rgb(var(--palm))]" />{l}</label>
            ))}
          </fieldset>
        </aside>
        <section aria-live="polite">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted">{q.data?.meta?.total ?? '…'} products</p>
            <div className="flex items-center gap-2">
              {user && <Button variant="ghost" size="sm" onClick={() => saveSearch.mutate()}>Save this search</Button>}
              <label className="sr-only" htmlFor="sort">Sort</label>
              <select id="sort" className="field w-auto" value={p.sort || 'relevance'} onChange={(e) => set({ sort: e.target.value })}>
                <option value="relevance">Most relevant</option><option value="newest">Newest</option><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option><option value="popular">Most popular</option>
              </select>
            </div>
          </div>
          {q.data?.data?.notice && <Notice tone="warn">{q.data.data.notice}</Notice>}
          {q.isError && <ErrorState error={q.error} onRetry={q.refetch} />}
          {q.isLoading ? <Spinner /> : (
            <>
              {q.data?.data?.sponsored?.length > 0 && (
                <div className="mb-6">
                  <p className="mb-2 text-sm font-semibold">Sponsored</p>
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-3">{q.data.data.sponsored.map((x) => <ProductCard key={`s-${x.id}`} p={x} sponsored />)}</div>
                </div>
              )}
              {q.data?.data?.items?.length ? <div className="grid grid-cols-2 gap-4 md:grid-cols-3">{q.data.data.items.map((x) => <ProductCard key={x.id} p={x} />)}</div> : !q.isError && <EmptyState title="No products match" body="Try removing a filter or searching for something broader." />}
              <Pagination meta={q.data?.meta} onPage={(page) => set({ page })} />
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function ReportDialog({ open, onClose, onSubmit, categories }) {
  const [cat, setCat] = useState(categories[0][0]);
  const [details, setDetails] = useState('');
  return (
    <Dialog open={open} onClose={onClose} title="Report this listing" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={() => onSubmit({ category: cat, details })}>Send report</Button></>}>
      <div className="space-y-3">
        <Select label="What’s wrong?" value={cat} onChange={(e) => setCat(e.target.value)} options={categories.map(([v, l]) => ({ value: v, label: l }))} />
        <Textarea label="Details (optional)" value={details} onChange={(e) => setDetails(e.target.value)} />
        <p className="text-sm text-muted">Reports are reviewed by our moderators. A listing is hidden automatically only when several serious reports are received.</p>
      </div>
    </Dialog>
  );
}

export function ProductPage() {
  const { slug } = useParams();
  const { user } = useSession();
  const nav = useNavigate();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['product', slug], queryFn: () => get(`/marketplace/products/${slug}`) });
  const [qty, setQty] = useState(1);
  const [report, setReport] = useState(false);
  const p = q.data;
  useSeo({
    title: p?.title, description: p?.description, noindex: p && !p.indexable,
    jsonLd: p && p.indexable ? { '@context': 'https://schema.org', '@type': 'Product', name: p.title, description: p.description, brand: p.brand ? { '@type': 'Brand', name: p.brand } : undefined, image: p.images?.map((i) => i.url), itemCondition: p.kind === 'used' ? 'https://schema.org/UsedCondition' : 'https://schema.org/NewCondition', offers: { '@type': 'Offer', priceCurrency: 'NGN', price: (p.priceKobo / 100).toFixed(2), availability: p.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock' } } : null,
  });
  const add = useMutation({ mutationFn: () => put('/marketplace/cart', { productId: p.id, quantity: qty }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['cart'] }); toast({ tone: 'success', title: 'Added to your cart' }); }, onError: toastError });
  const save = useMutation({ mutationFn: () => put(`/marketplace/products/${p.id}/save`), onSuccess: () => toast({ tone: 'success', title: 'Saved' }), onError: toastError });
  const sendReport = useMutation({ mutationFn: (b) => post(`/marketplace/products/${p.id}/report`, b), onSuccess: () => { setReport(false); toast({ tone: 'success', title: 'Report sent', body: 'Thanks — a moderator will review it.' }); }, onError: toastError });
  if (q.isLoading) return <div className="mx-auto max-w-6xl px-4 py-8"><Spinner /></div>;
  if (q.isError) return <div className="mx-auto max-w-6xl px-4 py-8"><ErrorState error={q.error} /></div>;
  const needAuth = (fn) => (user ? fn() : nav(`/login?next=/marketplace/${slug}`));
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link to="/marketplace" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" aria-hidden /> Back to marketplace</Link>
      {p.status && p.status !== 'published' && <Notice tone="warn" title={`This listing is ${humanize(p.status)}`}>{p.rejectionReason || p.hiddenReason || 'Only you and MubaPay staff can see it.'}</Notice>}
      <div className="mt-4 grid gap-8 lg:grid-cols-2">
        <div className="space-y-3">
          {p.images?.length ? p.images.map((i) => <img key={i.url} src={i.url} alt={i.alt || p.title} className="w-full rounded-xl border border-line object-cover" />) : <div className="flex aspect-[4/3] items-center justify-center rounded-xl border border-line text-muted">No photos yet</div>}
        </div>
        <div>
          <p className="text-sm font-semibold text-palm">{p.kind === 'used' ? `Fairly used, ${humanize(p.condition).toLowerCase()} condition` : 'Brand new'}</p>
          <h1 className="mt-1 font-display text-3xl font-bold">{p.title}</h1>
          <p className="mt-3 font-display text-3xl font-extrabold tnum">{naira(p.priceKobo)}</p>
          <p className="mt-2 text-sm text-muted">Sold by {p.seller.type === 'mubapay' ? 'MubaPay' : `${p.seller.displayName}, a verified individual seller`}{p.categoryName ? ` in ${p.categoryName}` : ''}</p>
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            {p.fulfilment.delivery && <span className="inline-flex items-center gap-1.5"><Truck className="h-4 w-4" aria-hidden /> Delivery from {p.fulfilment.originState}</span>}
            {p.fulfilment.collection && <span className="inline-flex items-center gap-1.5"><Store className="h-4 w-4" aria-hidden /> Collection available</span>}
          </div>
          {p.inStock ? (
            <div className="mt-6 flex items-end gap-3">
              <Input label="Quantity" type="number" min={1} max={p.stock} value={qty} onChange={(e) => setQty(Math.max(1, Math.min(p.stock, Number(e.target.value) || 1)))} className="w-28" />
              <Button loading={add.isPending} onClick={() => needAuth(() => add.mutate())}>Add to cart</Button>
              <Button variant="secondary" aria-label="Save product" onClick={() => needAuth(() => save.mutate())}><Heart className="h-4 w-4" aria-hidden /> Save</Button>
            </div>
          ) : <Notice tone="warn">This item is out of stock.</Notice>}
          <h2 className="mt-8 text-lg font-bold">Description</h2>
          <p className="mt-2 whitespace-pre-line leading-7">{p.description}</p>
          {p.conditionNotes && (<><h2 className="mt-6 text-lg font-bold">Condition notes from the seller</h2><p className="mt-2 leading-7">{p.conditionNotes}</p></>)}
          <p className="mt-6 text-sm text-muted">Delivery fees are confirmed at checkout before you pay. Refund requests are accepted within 7 days of delivery.</p>
          {user && p.status === 'published' && <button className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-danger" onClick={() => setReport(true)}><Flag className="h-4 w-4" aria-hidden /> Report this listing</button>}
        </div>
      </div>
      <ReportDialog open={report} onClose={() => setReport(false)} onSubmit={(b) => sendReport.mutate(b)} categories={[['misleading', 'Misleading description'], ['prohibited_item', 'Prohibited item'], ['fraud', 'Looks like a scam'], ['stolen_goods', 'Might be stolen'], ['wrong_category', 'Wrong category'], ['offensive', 'Offensive content'], ['other', 'Something else']]} />
    </div>
  );
}

// ---------------------------------------------------------------- real estate
export function RealEstatePage() {
  useSeo({ title: 'Homes and land', description: 'Rentals, homes and land from verified landlords and agents in Anambra, Enugu and Imo.' });
  const [p, set] = useParamsState();
  const [view, setView] = useState('list');
  const q = useQuery({ queryKey: ['properties', p], queryFn: () => get(`/realestate/properties?${new URLSearchParams(p)}`), keepPreviousData: true });
  const items = q.data?.data?.items || [];
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="page-title">Homes and land</h1>
      <p className="mt-1 max-w-2xl text-muted">Every listing is from a landlord or agent our team has verified. MubaPay never collects rent, deposits or purchase prices.</p>
      <div className="mt-6 grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside aria-label="Filters" className="space-y-4">
          <Select label="Looking to" value={p.listingType || ''} onChange={(e) => set({ listingType: e.target.value })} placeholder="Rent or buy" options={[{ value: 'rent', label: 'Rent' }, { value: 'sale', label: 'Buy a property' }, { value: 'land', label: 'Buy land' }]} />
          <Select label="State" value={p.state || ''} onChange={(e) => set({ state: e.target.value })} placeholder="Any" options={['Anambra', 'Enugu', 'Imo']} />
          <Input label="City or town" defaultValue={p.city || ''} onBlur={(e) => set({ city: e.target.value })} />
          <Select label="Property type" value={p.propertyType || ''} onChange={(e) => set({ propertyType: e.target.value })} placeholder="Any" options={['apartment', 'self_contain', 'mini_flat', 'bungalow', 'duplex', 'terrace', 'detached', 'commercial', 'shop', 'land']} />
          <div className="grid grid-cols-2 gap-2">
            <Input label="Min ₦" inputMode="numeric" defaultValue={p.minPrice ? p.minPrice / 100 : ''} onBlur={(e) => set({ minPrice: e.target.value ? Number(e.target.value) * 100 : '' })} />
            <Input label="Max ₦" inputMode="numeric" defaultValue={p.maxPrice ? p.maxPrice / 100 : ''} onBlur={(e) => set({ maxPrice: e.target.value ? Number(e.target.value) * 100 : '' })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Select label="Bedrooms" value={p.bedrooms || ''} onChange={(e) => set({ bedrooms: e.target.value })} placeholder="Any" options={['1', '2', '3', '4', '5'].map((v) => ({ value: v, label: `${v}+` }))} />
            <Select label="Bathrooms" value={p.bathrooms || ''} onChange={(e) => set({ bathrooms: e.target.value })} placeholder="Any" options={['1', '2', '3', '4'].map((v) => ({ value: v, label: `${v}+` }))} />
          </div>
          <Input label="Min land size (m²)" inputMode="numeric" defaultValue={p.minLand || ''} onBlur={(e) => set({ minLand: e.target.value })} />
          <Select label="Furnishing" value={p.furnishing || ''} onChange={(e) => set({ furnishing: e.target.value })} placeholder="Any" options={['unfurnished', 'semi_furnished', 'furnished']} />
          <Input label="Amenities" hint="Comma separated, e.g. borehole, parking" defaultValue={p.amenities || ''} onBlur={(e) => set({ amenities: e.target.value.split(',').map((s) => s.trim()).filter(Boolean).join(',') })} />
          <Select label="Viewing fee" value={p.viewingFee || ''} onChange={(e) => set({ viewingFee: e.target.value })} placeholder="Any" options={[{ value: 'none', label: 'Free viewing only' }, { value: 'required', label: 'Fee required' }]} />
          <Select label="Media" value={p.media || ''} onChange={(e) => set({ media: e.target.value })} placeholder="Any" options={[{ value: 'photo', label: 'Has photos' }, { value: 'floor_plan', label: 'Has a floor plan' }, { value: 'tour_360', label: 'Has a 360° tour' }, { value: 'walkthrough_3d', label: 'Has a 3D walkthrough' }]} />
          <Select label="Listed" value={p.listedWithinDays || ''} onChange={(e) => set({ listedWithinDays: e.target.value })} placeholder="Any time" options={[{ value: '7', label: 'Last 7 days' }, { value: '30', label: 'Last 30 days' }]} />
        </aside>
        <section aria-live="polite">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted">{q.data?.meta?.total ?? '…'} properties</p>
            <div className="flex gap-2">
              <div role="group" aria-label="View" className="flex rounded-lg border border-line p-0.5">
                {['list', 'map'].map((v) => <button key={v} aria-pressed={view === v} onClick={() => setView(v)} className={cx('min-h-[36px] rounded-md px-3 text-sm font-semibold', view === v ? 'bg-palm-soft text-palm' : 'text-muted')}>{v === 'list' ? 'List' : 'Map'}</button>)}
              </div>
              <select aria-label="Sort" className="field w-auto" value={p.sort || 'relevance'} onChange={(e) => set({ sort: e.target.value })}>
                <option value="relevance">Newest first</option><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option>
              </select>
            </div>
          </div>
          {q.isError && <ErrorState error={q.error} onRetry={q.refetch} />}
          {q.isLoading ? <Spinner /> : view === 'map' ? <PropertyMap items={items} height={520} /> : (
            items.length ? <div className="grid gap-4 md:grid-cols-2">{items.map((x) => <PropertyCard key={x.id} p={x} />)}</div> : <EmptyState title="No properties match" body="Widen your price range or try another town." />
          )}
          <Pagination meta={q.data?.meta} onPage={(page) => set({ page })} />
        </section>
      </div>
    </div>
  );
}

export function PropertyPage() {
  const { slug } = useParams();
  const { user } = useSession();
  const nav = useNavigate();
  const q = useQuery({ queryKey: ['property', slug], queryFn: () => get(`/realestate/properties/${slug}`) });
  const [slots, setSlots] = useState(['']);
  const [msg, setMsg] = useState('');
  const p = q.data;
  useSeo({ title: p?.title, description: p?.description, noindex: p && !p.indexable, jsonLd: p && p.indexable ? { '@context': 'https://schema.org', '@type': 'Residence', name: p.title, description: p.description, address: { '@type': 'PostalAddress', addressLocality: p.location.city, addressRegion: p.location.state, addressCountry: 'NG' } } : null });
  const enquire = useMutation({ mutationFn: () => post(`/realestate/properties/${p.id}/enquiries`, { message: msg }), onSuccess: (r) => nav(`/app/messages/${r.conversationId}`), onError: toastError });
  const book = useMutation({ mutationFn: () => post(`/realestate/properties/${p.id}/viewings`, { slots: slots.filter(Boolean).map((s) => new Date(s).toISOString()) }), onSuccess: (r) => nav(`/app/appointments/${r.id}`), onError: toastError });
  const save = useMutation({ mutationFn: () => put(`/realestate/properties/${p.id}/save`), onSuccess: () => toast({ tone: 'success', title: 'Saved' }), onError: toastError });
  if (q.isLoading) return <div className="mx-auto max-w-6xl px-4 py-8"><Spinner /></div>;
  if (q.isError) return <div className="mx-auto max-w-6xl px-4 py-8"><ErrorState error={q.error} /></div>;
  const needAuth = (fn) => (user ? fn() : nav(`/login?next=/real-estate/${slug}`));
  const photos = p.media.filter((m) => m.kind === 'photo' || m.kind === 'site_photo');
  const plans = p.media.filter((m) => m.kind === 'floor_plan');
  const tours = p.media.filter((m) => m.kind === 'tour_360' || m.kind === 'walkthrough_3d');
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link to="/real-estate" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" aria-hidden /> Back to properties</Link>
      {p.status && p.status !== 'published' && <Notice tone="warn" title={`This listing is ${humanize(p.status)}`}>{p.rejectionReason || 'It is not visible to the public.'}</Notice>}
      <div className="mt-4 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <p className="text-sm font-semibold text-palm">{p.listingType === 'rent' ? 'For rent' : p.listingType === 'land' ? 'Land for sale' : 'For sale'}, listed by a {p.listedBy.toLowerCase()}</p>
          <h1 className="mt-1 font-display text-3xl font-bold">{p.title}</h1>
          <p className="mt-2 flex items-center gap-1 text-muted"><MapPin className="h-4 w-4" aria-hidden />{p.location.address || [p.location.area, p.location.city, p.location.state].filter(Boolean).join(', ')}</p>
          <div className="mt-5 space-y-3">{photos.length ? photos.map((m) => <img key={m._id || m.url} src={m.url} alt={m.caption || p.title} className="w-full rounded-xl border border-line" />) : <div className="flex aspect-[16/10] items-center justify-center rounded-xl border border-line text-muted">Photos coming soon</div>}</div>
          <h2 className="mt-8 text-lg font-bold">About this property</h2>
          <p className="mt-2 whitespace-pre-line leading-7">{p.description}</p>
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            {p.bedrooms != null && <span className="inline-flex items-center gap-1.5"><BedDouble className="h-4 w-4" aria-hidden />{p.bedrooms} bedrooms</span>}
            {p.bathrooms != null && <span className="inline-flex items-center gap-1.5"><Bath className="h-4 w-4" aria-hidden />{p.bathrooms} bathrooms</span>}
            {p.landSizeSqm ? <span className="inline-flex items-center gap-1.5"><Ruler className="h-4 w-4" aria-hidden />{p.landSizeSqm} m²</span> : null}
            {p.furnishing && <span>{humanize(p.furnishing)}</span>}
          </div>
          {p.amenities?.length > 0 && <ul className="mt-3 flex flex-wrap gap-2">{p.amenities.map((a) => <li key={a} className="rounded-full border border-line px-3 py-1 text-sm">{a}</li>)}</ul>}
          {p.plan2d && (<><h2 className="mt-8 text-lg font-bold">Interactive floor plan</h2><div className="mt-2"><Plan2D plan={p.plan2d} /></div></>)}
          {plans.length > 0 && (<><h2 className="mt-8 text-lg font-bold">Floor plans</h2>{plans.map((m) => <img key={m.url} src={m.url} alt={m.caption || 'Floor plan'} className="mt-2 w-full rounded-xl border border-line" />)}</>)}
          {tours.length > 0 && (<><h2 className="mt-8 text-lg font-bold">Virtual tours</h2>{tours.map((m) => <a key={m.url} href={m.url} target="_blank" rel="noreferrer" className="link mt-2 block">{m.kind === 'tour_360' ? 'Open the 360° tour' : 'Open the 3D walkthrough'}{m.caption ? `: ${m.caption}` : ''}</a>)}</>)}
          {p.location.approxCoordinates && <div className="mt-8"><h2 className="mb-2 text-lg font-bold">Approximate location</h2><PropertyMap items={[p]} height={280} /></div>}
        </div>
        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <div className="panel p-5">
            <p className="font-display text-3xl font-extrabold tnum">{naira(p.priceKobo)}{p.rentPeriod && <span className="font-sans text-base font-medium text-muted"> per {p.rentPeriod === 'yearly' ? 'year' : 'month'}</span>}</p>
            <p className="mt-1 text-sm text-muted">Availability: {humanize(p.availability?.status)}</p>
            <p className="mt-3 inline-flex items-center gap-1.5 text-sm"><Eye className="h-4 w-4" aria-hidden />{p.viewingFee?.required ? `Viewing fee ${naira(p.viewingFee.amountKobo)}, paid on MubaPay after the time is confirmed` : 'Free viewing'}</p>
            <h2 className="mt-5 font-bold">Request a viewing</h2>
            <p className="text-sm text-muted">Suggest up to three times. The landlord or agent confirms one or proposes another.</p>
            {slots.map((s, i) => <input key={i} type="datetime-local" aria-label={`Preferred time ${i + 1}`} className="field mt-2" value={s} onChange={(e) => setSlots(slots.map((x, j) => (j === i ? e.target.value : x)))} />)}
            {slots.length < 3 && <button className="link mt-2 text-sm" onClick={() => setSlots([...slots, ''])}>Add another time</button>}
            <Button className="mt-3 w-full" loading={book.isPending} disabled={!slots.some(Boolean)} onClick={() => needAuth(() => book.mutate())}>Request viewing</Button>
            <p className="mt-2 text-xs text-muted">Cancel at least 24 hours before for a full refund of any viewing fee.</p>
          </div>
          <div className="panel p-5">
            <h2 className="font-bold">Ask a question</h2>
            <Textarea label="Message" value={msg} onChange={(e) => setMsg(e.target.value)} rows={3} hint="Phone numbers and emails are hidden until a viewing is confirmed." />
            <Button variant="secondary" className="mt-2 w-full" loading={enquire.isPending} onClick={() => needAuth(() => enquire.mutate())}>Send message</Button>
            <button className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-muted" onClick={() => needAuth(() => save.mutate())}><Heart className="h-4 w-4" aria-hidden /> Save property</button>
          </div>
          <Notice tone="warn" title="Stay safe">Never pay rent, deposits or agency fees through chat links. MubaPay only collects disclosed viewing fees.</Notice>
        </aside>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- legal
export function LegalIndexPage() {
  useSeo({ title: 'Policies' });
  const q = useQuery({ queryKey: ['legal'], queryFn: () => get('/legal') });
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="page-title">Policies</h1>
      {q.isLoading ? <Spinner /> : <ul className="mt-6 divide-y divide-line rounded-xl border border-line">{(q.data || []).map((d) => <li key={d.slug}><Link to={`/legal/${d.slug}`} className="flex min-h-[52px] items-center justify-between px-4 hover:bg-ink/5"><span className="font-semibold">{d.title}</span><span className="text-sm text-muted">Version {d.version}</span></Link></li>)}</ul>}
    </div>
  );
}

function renderMarkdown(md) {
  // Minimal, safe renderer for our own policy markdown (headings, lists, paragraphs, blockquote, bold).
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  const out = [];
  let list = null;
  for (const line of md.split('\n')) {
    if (/^\s*[-*] /.test(line) || /^\s*\d+\. /.test(line)) {
      const ordered = /^\s*\d+\. /.test(line);
      if (!list) { list = { ordered, items: [] }; }
      list.items.push(inline(line.replace(/^\s*([-*]|\d+\.) /, '')));
      continue;
    }
    if (list) { out.push(`<${list.ordered ? 'ol' : 'ul'} class="${list.ordered ? 'list-decimal' : 'list-disc'} pl-6 space-y-1">${list.items.map((i) => `<li>${i}</li>`).join('')}</${list.ordered ? 'ol' : 'ul'}>`); list = null; }
    if (/^# /.test(line)) continue; // page title rendered separately
    if (/^## /.test(line)) out.push(`<h2 class="mt-6 text-xl font-bold">${inline(line.slice(3))}</h2>`);
    else if (/^> /.test(line)) out.push(`<p class="rounded-lg border border-warn/40 bg-warn-soft p-3 text-sm">${inline(line.slice(2))}</p>`);
    else if (line.trim()) out.push(`<p>${inline(line)}</p>`);
  }
  if (list) out.push(`<ul class="list-disc pl-6">${list.items.map((i) => `<li>${i}</li>`).join('')}</ul>`);
  return out.join('');
}

export function LegalDocPage() {
  const { slug } = useParams();
  const [sp] = useSearchParams();
  const v = sp.get('version');
  const q = useQuery({ queryKey: ['legal', slug, v], queryFn: () => get(`/legal/${slug}${v ? `?version=${v}` : ''}`) });
  useSeo({ title: q.data?.title });
  if (q.isLoading) return <div className="mx-auto max-w-3xl px-4 py-12"><Spinner /></div>;
  if (q.isError) return <div className="mx-auto max-w-3xl px-4 py-12"><ErrorState error={q.error} /></div>;
  const d = q.data;
  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="page-title">{d.title}</h1>
      <p className="mt-1 text-sm text-muted">Version {d.version}, effective {new Date(d.effectiveAt).toLocaleDateString('en-NG')}{d.status === 'superseded' ? ' (superseded — not the current version)' : ''}</p>
      <div className="mt-6 space-y-4 leading-7" dangerouslySetInnerHTML={{ __html: renderMarkdown(d.content) }} />
      {d.versions?.length > 1 && (
        <div className="mt-10">
          <h2 className="text-lg font-bold">Version history</h2>
          <ul className="mt-2 space-y-1 text-sm">{d.versions.map((x) => <li key={x.version}><Link className="link" to={`/legal/${slug}?version=${x.version}`}>Version {x.version}</Link> — {x.summaryOfChanges || 'No summary'} ({humanize(x.status)})</li>)}</ul>
        </div>
      )}
    </article>
  );
}

export { del };
