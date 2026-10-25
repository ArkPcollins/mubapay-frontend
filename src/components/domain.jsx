import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MapContainer, Marker, TileLayer, useMapEvents, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { BedDouble, Bath, MapPin, Ruler, Truck, Store, Eye } from 'lucide-react';
import { get, newIdempotencyKey } from '../lib/api';
import { naira, humanize } from '../lib/format';
import { toastError } from './ui/toast';
import { cx, Money, Status } from './ui';

/**
 * The balance strip: one bar, proportioned by where the customer's money
 * actually is. Each segment is labelled in words and amounts (not colour alone).
 */
export function BalanceStrip({ overview }) {
  const parts = [
    { key: 'available', label: 'Available to spend', kobo: overview.availableKobo, cls: 'bg-palm' },
    { key: 'savings', label: 'In savings', kobo: overview.savingsTotalKobo, cls: 'bg-kola' },
    { key: 'reserved', label: 'Reserved for withdrawals', kobo: overview.reservedForWithdrawalsKobo, cls: 'bg-ink/60 bg-[repeating-linear-gradient(45deg,transparent,transparent_4px,rgba(255,255,255,.35)_4px,rgba(255,255,255,.35)_8px)]' },
    { key: 'seller', label: 'Sale proceeds on hold', kobo: overview.sellerProceedsPendingKobo, cls: 'bg-ink/30' },
    { key: 'pending', label: 'Payments awaiting confirmation', kobo: overview.pendingFundingKobo, cls: 'bg-warn/70 bg-[repeating-linear-gradient(-45deg,transparent,transparent_3px,rgba(255,255,255,.4)_3px,rgba(255,255,255,.4)_6px)]' },
  ];
  const total = parts.reduce((a, p) => a + Math.max(0, p.kobo || 0), 0);
  return (
    <div>
      <p className="text-sm text-muted">Available to spend</p>
      <p className="font-display text-4xl font-extrabold tnum sm:text-5xl">{naira(overview.availableKobo)}</p>
      <div className="mt-4 flex h-3 w-full overflow-hidden rounded-full bg-ink/10" role="img" aria-label={parts.map((p) => `${p.label}: ${naira(p.kobo)}`).join('; ')}>
        {total > 0 && parts.filter((p) => p.kobo > 0).map((p) => <div key={p.key} className={p.cls} style={{ width: `${Math.max(2, (p.kobo / total) * 100)}%` }} />)}
      </div>
      <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
        {parts.slice(1).map((p) => (
          <div key={p.key} className="flex items-center justify-between gap-3">
            <dt className="flex items-center gap-2 text-muted"><span aria-hidden className={cx('inline-block h-2.5 w-2.5 rounded-sm', p.cls)} />{p.label}</dt>
            <dd className="font-semibold tnum">{naira(p.kobo)}</dd>
          </div>
        ))}
      </dl>
      {overview.pendingFundingCount > 0 && <p className="mt-3 text-sm text-warn">{overview.pendingFundingCount} payment(s) are still being confirmed with Paystack and are not spendable yet.</p>}
    </div>
  );
}

export function ProductCard({ p, sponsored }) {
  return (
    <Link to={`/marketplace/${p.slug}`} className="group flex flex-col overflow-hidden rounded-xl border border-line bg-surface hover:border-ink/40">
      <div className="relative aspect-[4/3] bg-ink/5">
        {p.images?.[0]?.url ? <img src={p.images[0].url} alt={p.images[0].alt || p.title} loading="lazy" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-sm text-muted">No photo yet</div>}
        {(sponsored || p.sponsored) && <span className="absolute left-2 top-2 rounded bg-surface/95 px-2 py-0.5 text-xs font-semibold">Sponsored</span>}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="line-clamp-2 font-semibold group-hover:underline">{p.title}</p>
        <p className="text-sm text-muted">{p.kind === 'used' ? `Fairly used, ${humanize(p.condition).toLowerCase()}` : 'New'}, sold by {p.seller?.displayName}</p>
        <p className="mt-auto pt-1 font-display text-lg font-bold tnum">{naira(p.priceKobo)}</p>
        <p className="flex items-center gap-3 text-xs text-muted">
          {p.fulfilment?.delivery && <span className="inline-flex items-center gap-1"><Truck className="h-3.5 w-3.5" aria-hidden /> Delivery</span>}
          {p.fulfilment?.collection && <span className="inline-flex items-center gap-1"><Store className="h-3.5 w-3.5" aria-hidden /> Collection</span>}
          {!p.inStock && <span className="font-semibold text-danger">Out of stock</span>}
        </p>
      </div>
    </Link>
  );
}

export function PropertyCard({ p }) {
  return (
    <Link to={`/real-estate/${p.slug}`} className="group flex flex-col overflow-hidden rounded-xl border border-line bg-surface hover:border-ink/40">
      <div className="relative aspect-[16/10] bg-ink/5">
        {p.media?.find((m) => m.kind === 'photo')?.url ? <img src={p.media.find((m) => m.kind === 'photo').url} alt={p.title} loading="lazy" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-sm text-muted">Photos coming soon</div>}
        {p.sponsored && <span className="absolute left-2 top-2 rounded bg-surface/95 px-2 py-0.5 text-xs font-semibold">Sponsored</span>}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="text-sm font-semibold text-palm">{p.listingType === 'rent' ? 'For rent' : p.listingType === 'land' ? 'Land for sale' : 'For sale'}</p>
        <p className="line-clamp-2 font-semibold group-hover:underline">{p.title}</p>
        <p className="flex items-center gap-1 text-sm text-muted"><MapPin className="h-3.5 w-3.5" aria-hidden />{[p.location?.area, p.location?.city, p.location?.state].filter(Boolean).join(', ')}</p>
        <p className="mt-auto pt-1 font-display text-lg font-bold tnum">{naira(p.priceKobo)}{p.rentPeriod ? <span className="font-sans text-sm font-medium text-muted"> / {p.rentPeriod === 'yearly' ? 'year' : 'month'}</span> : null}</p>
        <p className="flex flex-wrap items-center gap-3 text-xs text-muted">
          {p.bedrooms != null && <span className="inline-flex items-center gap-1"><BedDouble className="h-3.5 w-3.5" aria-hidden />{p.bedrooms} bed</span>}
          {p.bathrooms != null && <span className="inline-flex items-center gap-1"><Bath className="h-3.5 w-3.5" aria-hidden />{p.bathrooms} bath</span>}
          {p.landSizeSqm ? <span className="inline-flex items-center gap-1"><Ruler className="h-3.5 w-3.5" aria-hidden />{p.landSizeSqm} m²</span> : null}
          {p.viewingFee?.required ? <span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" aria-hidden />Viewing fee {naira(p.viewingFee.amountKobo)}</span> : <span>Free viewing</span>}
        </p>
      </div>
    </Link>
  );
}

const pin = L.divIcon({ className: '', html: '<div style="width:18px;height:18px;border-radius:50%;background:rgb(14,124,102);border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>', iconSize: [18, 18], iconAnchor: [9, 9] });
const TILE = import.meta.env.VITE_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTR = import.meta.env.VITE_MAP_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/** OpenStreetMap map. Properties show approximate locations only. */
export function PropertyMap({ items, height = 360 }) {
  const pts = items.filter((p) => p.location?.approxCoordinates);
  const center = pts[0] ? [pts[0].location.approxCoordinates.lat, pts[0].location.approxCoordinates.lng] : [6.21, 7.07];
  return (
    <div style={{ height }} className="overflow-hidden rounded-xl border border-line">
      <MapContainer center={center} zoom={pts.length ? 11 : 8} style={{ height: '100%' }} scrollWheelZoom={false}>
        <TileLayer url={TILE} attribution={ATTR} />
        {pts.map((p) => (
          <Marker key={p.id} position={[p.location.approxCoordinates.lat, p.location.approxCoordinates.lng]} icon={pin}>
            <Popup><Link to={`/real-estate/${p.slug}`}>{p.title}</Link><br />{naira(p.priceKobo)}</Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

function ClickToPin({ onPick }) {
  useMapEvents({ click: (e) => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

/** Map pin selection with optional geocoded search (Nominatim via the API). */
export function LocationPicker({ value, onChange }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');
  const search = async () => {
    setError('');
    try {
      setResults(await get(`/realestate/geocode?q=${encodeURIComponent(q)}`));
    } catch (e) {
      setError(e.code === 'INTEGRATION_NOT_CONFIGURED' ? 'Address search is not configured on this server. Drop a pin on the map instead.' : e.message);
    }
  };
  const center = value?.lat ? [value.lat, value.lng] : [6.21, 7.07];
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input className="field" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search an area, e.g. Ifite Awka" aria-label="Search location" />
        <button type="button" className="rounded-lg border border-line px-4 font-semibold" onClick={search}>Search</button>
      </div>
      {error && <p className="text-sm text-warn">{error}</p>}
      {results.length > 0 && (
        <ul className="rounded-lg border border-line">
          {results.map((r) => <li key={r.displayName}><button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-ink/5" onClick={() => { onChange({ lat: r.lat, lng: r.lng, state: r.state, city: r.city }); setResults([]); }}>{r.displayName}</button></li>)}
        </ul>
      )}
      <div style={{ height: 260 }} className="overflow-hidden rounded-xl border border-line">
        <MapContainer center={center} zoom={value?.lat ? 14 : 8} style={{ height: '100%' }}>
          <TileLayer url={TILE} attribution={ATTR} />
          <ClickToPin onPick={(p) => onChange({ ...value, ...p })} />
          {value?.lat && <Marker position={[value.lat, value.lng]} icon={pin} />}
        </MapContainer>
      </div>
      <p className="hint">Click the map to drop a pin. Only an approximate location is shown publicly.</p>
    </div>
  );
}

/** Interactive 2D plan renderer (only shown when a plan was actually provided). */
export function Plan2D({ plan }) {
  const [active, setActive] = useState(null);
  const rooms = useMemo(() => plan?.rooms || [], [plan]);
  const bounds = useMemo(() => {
    const xs = rooms.flatMap((r) => r.points.map((p) => p[0]));
    const ys = rooms.flatMap((r) => r.points.map((p) => p[1]));
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)];
  }, [rooms]);
  if (!rooms.length) return null;
  return (
    <div>
      <svg viewBox={bounds.join(' ')} className="w-full rounded-xl border border-line bg-surface" role="img" aria-label="Floor plan">
        {rooms.map((r, i) => (
          <polygon key={r.name} points={r.points.map((p) => p.join(',')).join(' ')} className={cx('cursor-pointer stroke-ink', active === i ? 'fill-palm/40' : 'fill-palm/10 hover:fill-palm/25')} strokeWidth={bounds[2] / 200} onClick={() => setActive(i)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setActive(i)} aria-label={r.name} />
        ))}
      </svg>
      <p className="mt-2 text-sm">{active != null ? `${rooms[active].name}${rooms[active].areaSqm ? `, ${rooms[active].areaSqm} m²` : ''}` : 'Select a room to see its details.'}</p>
    </div>
  );
}

/**
 * Financial action helper: generates one idempotency key per user intent and
 * reuses it for retries of the same intent (so a double-click or network retry
 * can never create two transactions).
 */
export function useFinancialAction(fn, { onSuccess, invalidate = [] } = {}) {
  const key = useRef(newIdempotencyKey());
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: (vars) => fn(vars, key.current),
    onSuccess: (data, vars) => {
      key.current = newIdempotencyKey();
      invalidate.forEach((k) => qc.invalidateQueries({ queryKey: k }));
      onSuccess?.(data, vars);
    },
    onError: (e) => {
      if (e.status && e.status < 500 && e.code !== 'REQUEST_IN_PROGRESS') key.current = newIdempotencyKey();
      toastError(e);
    },
  });
  return m;
}

export function useList(key, path, params) {
  return useQuery({ queryKey: [...key, params], queryFn: () => get(path + (params ? `?${new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null))}` : '')), keepPreviousData: true });
}

export function StatusTimeline({ items }) {
  return (
    <ol className="relative ml-2 border-l-2 border-line">
      {(items || []).map((h, i) => (
        <li key={i} className="mb-4 ml-4">
          <span className="absolute -left-[7px] mt-1.5 h-3 w-3 rounded-full border-2 border-surface bg-palm" aria-hidden />
          <p className="text-sm font-semibold">{humanize(h.status)}</p>
          <p className="text-xs text-muted">{new Date(h.at).toLocaleString('en-NG', { timeZone: 'Africa/Lagos' })}{h.note ? ` — ${h.note}` : ''}</p>
        </li>
      ))}
    </ol>
  );
}

export { Money, Status };
