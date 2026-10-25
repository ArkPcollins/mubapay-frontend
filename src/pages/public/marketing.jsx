import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PiggyBank, ShoppingBag, Building2, ShieldCheck, Lock, Scale } from 'lucide-react';
import { get } from '../../lib/api';
import { Button, Spinner } from '../../components/ui';
import { BalanceStrip, ProductCard, PropertyCard } from '../../components/domain';
import { useSession } from '../../lib/session';

/** Uli-inspired line motif (Igbo body/wall art): drawn strokes, used only in the hero. */
function UliLines() {
  return (
    <svg aria-hidden viewBox="0 0 600 400" className="pointer-events-none absolute -right-24 top-0 hidden h-full w-[620px] text-palm/25 lg:block" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M40 360 C140 260 120 140 220 80 S420 40 560 120" />
      <path d="M80 380 C180 290 170 180 260 120 S440 90 580 170" />
      <path d="M300 60 q30 40 0 80 q-30 40 0 80 q30 40 0 80" />
      <circle cx="430" cy="250" r="34" />
      <circle cx="430" cy="250" r="12" />
      <path d="M470 330 l40 -40 m-20 50 l40 -40 m-20 50 l40 -40" />
    </svg>
  );
}

const example = { availableKobo: 18450000, savingsTotalKobo: 32000000, reservedForWithdrawalsKobo: 5000000, sellerProceedsPendingKobo: 0, pendingFundingKobo: 1000000, pendingFundingCount: 1 };

export function HomePage() {
  const { user, meta } = useSession();
  const products = useQuery({ queryKey: ['home-products'], queryFn: () => get('/marketplace/products?limit=4&sort=newest') });
  const props = useQuery({ queryKey: ['home-props'], queryFn: () => get('/realestate/properties?limit=3') });
  return (
    <>
      <section className="relative overflow-hidden border-b border-line">
        <UliLines />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-14 lg:grid-cols-[1.1fr_0.9fr] lg:py-20">
          <div>
            <h1 className="font-display text-4xl font-extrabold leading-[1.05] sm:text-6xl">Know where every naira is.</h1>
            <p className="mt-5 max-w-xl text-lg text-muted">Save towards rent, shop new and fairly used items, and book property viewings in Anambra, Enugu and Imo. Your wallet always shows what you can spend, what is set aside, and what is still being confirmed.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button to={user ? '/app' : '/register'}>{user ? 'Open my account' : 'Create a free account'}</Button>
              <Button variant="secondary" to="/how-it-works">How MubaPay works</Button>
            </div>
            <p className="mt-6 text-sm text-muted">Delivery currently covers {(meta?.coverageStates || ['Anambra', 'Enugu', 'Imo']).join(', ')}.</p>
          </div>
          <div className="panel p-6 shadow-sm">
            <p className="mb-4 text-xs font-semibold text-muted">Example wallet</p>
            <BalanceStrip overview={example} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        <div className="grid gap-8 md:grid-cols-3">
          {[
            [PiggyBank, 'Personal savings', 'Lock money away until a date you choose. Flexible or scheduled. Any early-exit penalty is shown before you join and again before you leave.', '/savings'],
            [ShoppingBag, 'Marketplace', 'New products sold by MubaPay and fairly used items from verified people. Every used listing is reviewed before it goes live.', '/marketplace'],
            [Building2, 'Homes and land', 'Rentals, houses and plots from verified landlords and agents. Book viewings and message without sharing your phone number.', '/real-estate'],
          ].map(([Icon, t, b, to]) => (
            <Link key={t} to={to} className="group block">
              <Icon className="h-7 w-7 text-palm" aria-hidden />
              <h2 className="mt-3 text-xl font-bold group-hover:underline">{t}</h2>
              <p className="mt-2 text-muted">{b}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-y border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-2xl font-bold">New on the marketplace</h2>
            <Link to="/marketplace" className="link text-sm">Browse all products</Link>
          </div>
          {products.isLoading ? <Spinner /> : (
            <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">{(products.data?.data?.items || []).map((p) => <ProductCard key={p.id} p={p} />)}</div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-2xl font-bold">Recently listed homes</h2>
          <Link to="/real-estate" className="link text-sm">See all properties</Link>
        </div>
        {props.isLoading ? <Spinner /> : <div className="mt-6 grid gap-4 md:grid-cols-3">{(props.data?.data?.items || []).map((p) => <PropertyCard key={p.id} p={p} />)}</div>}
      </section>

      <section className="border-t border-line">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-3">
          {[[ShieldCheck, 'Verified people', 'Sellers, landlords and agents are identity-checked by our team before they can list.'], [Lock, 'Payments confirmed, not assumed', 'We credit money only after Paystack confirms it. A slow network never turns into a double charge.'], [Scale, 'Disputes handled by people', 'If something goes wrong, our team reviews the evidence before any refund or payout.']].map(([Icon, t, b]) => (
            <div key={t}><Icon className="h-6 w-6 text-ink" aria-hidden /><h3 className="mt-2 font-bold">{t}</h3><p className="mt-1 text-sm text-muted">{b}</p></div>
          ))}
        </div>
      </section>
    </>
  );
}

function Prose({ title, children }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="page-title">{title}</h1>
      <div className="mt-6 space-y-4 leading-7 text-ink/90">{children}</div>
    </div>
  );
}

export function SavingsInfoPage() {
  const plans = useQuery({ queryKey: ['plans'], queryFn: () => get('/savings/plans') });
  return (
    <Prose title="Personal savings">
      <p>Put money aside for rent, school fees or a goal, and keep it out of everyday reach until the date you choose.</p>
      <ul className="list-disc space-y-2 pl-5">
        <li>No interest is paid. You get back what you saved, less any early-exit penalty you agreed to.</li>
        <li>Choose flexible saving, or a weekly or monthly schedule from your wallet or a saved card.</li>
        <li>If a scheduled payment fails we retry during a grace period. Missed contributions never cost you a fee.</li>
        <li>At maturity your savings go to your wallet, or to your bank through a withdrawal request.</li>
      </ul>
      <h2 className="pt-4 text-xl font-bold">Plans available now</h2>
      {plans.isLoading ? <Spinner /> : (plans.data || []).map((p) => (
        <div key={p.id} className="panel p-4">
          <p className="font-semibold">{p.name}</p>
          <p className="text-sm text-muted">{p.description}</p>
          <p className="mt-2 text-sm">{p.disclosures.penalty} {p.disclosures.missed}</p>
        </div>
      ))}
      <Button to="/app/savings/new">Start saving</Button>
    </Prose>
  );
}

export function HowItWorksPage() {
  const steps = [
    ['Create your account', 'Sign up with email or Google, then verify your email address.'],
    ['Verify your phone', 'A code confirms your number. This unlocks wallet funding, transfers and savings with starter limits.'],
    ['Verify your identity', 'Upload a government ID and a selfie. Our team reviews it, usually within one working day. This unlocks withdrawals, selling used items and higher limits.'],
    ['Fund your wallet', 'Pay with card, bank transfer or USSD through Paystack. Your balance updates when Paystack confirms the payment.'],
    ['Save, shop or book a viewing', 'Everything you do shows up in your wallet history with a reference you can quote to support.'],
  ];
  return (
    <Prose title="How MubaPay works">
      <ol className="space-y-5">
        {steps.map(([t, b], i) => (
          <li key={t} className="flex gap-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-palm-soft font-bold text-palm" aria-hidden>{i + 1}</span>
            <div><p className="font-semibold">{t}</p><p className="text-muted">{b}</p></div>
          </li>
        ))}
      </ol>
      <h2 className="pt-6 text-xl font-bold">What MubaPay does not do</h2>
      <p>We do not collect rent, deposits or purchase prices for property. Pay those only after you have verified the property and its documents independently.</p>
    </Prose>
  );
}

export function AboutPage() {
  return (
    <Prose title="About MubaPay">
      <p>MubaPay brings saving, payments, shopping and property search together for people in South-East Nigeria, starting with Anambra, Enugu and Imo.</p>
      <p>We are building carefully: every financial service runs only where the required authorisation or licensed partner arrangement is in place, every withdrawal is reviewed by a person, and every correction to money is approved by two members of staff.</p>
    </Prose>
  );
}

export function ContactPage() {
  const ch = useQuery({ queryKey: ['support-channels'], queryFn: () => get('/support/channels') });
  const { user } = useSession();
  return (
    <Prose title="Contact us">
      <p>The fastest way to reach us is a support request from your account — financial and security issues are handled first.</p>
      <Button to={user ? '/app/support/new' : '/login?next=/app/support/new'}>Open a support request</Button>
      {ch.data?.email?.available && <p>Email: <a className="link" href={`mailto:${ch.data.email.address}`}>{ch.data.email.address}</a></p>}
      {ch.data && !ch.data.whatsapp.available && <p className="text-sm text-muted">WhatsApp support is not available yet.</p>}
    </Prose>
  );
}

const FAQS = [
  ['Is my money safe if a payment page times out?', 'Yes. We only credit or debit after confirming with Paystack. If the confirmation is slow, the payment stays "awaiting confirmation" and we keep checking automatically. Do not pay twice.'],
  ['Why is part of my balance "reserved"?', 'When you request a withdrawal, the amount is set aside while our team reviews it and the bank processes it. If the withdrawal is declined or fails, it returns to your available balance.'],
  ['How long do withdrawals take?', 'Every withdrawal is reviewed by a person first. After approval, bank payouts usually arrive the same working day.'],
  ['Can I sell my used phone?', 'Yes, once your identity is verified. Listings are reviewed before they go live and you are paid after the buyer receives the item and the short hold period passes.'],
  ['Do you charge for transfers?', 'Transfers between MubaPay users are free.'],
  ['What happens if I cancel a property viewing?', 'Cancel at least 24 hours before and any viewing fee is refunded. Later cancellations are not refunded. If the landlord or agent cancels or does not turn up, you get a full refund.'],
];
export function FaqPage() {
  return (
    <Prose title="Frequently asked questions">
      {FAQS.map(([q, a]) => (
        <details key={q} className="panel p-4">
          <summary className="cursor-pointer font-semibold">{q}</summary>
          <p className="mt-2 text-muted">{a}</p>
        </details>
      ))}
    </Prose>
  );
}

export function NotFoundPage() {
  return (
    <Prose title="We couldn’t find that page">
      <p>The link may be old, or the listing may no longer be available.</p>
      <Button to="/">Go to the home page</Button>
    </Prose>
  );
}
