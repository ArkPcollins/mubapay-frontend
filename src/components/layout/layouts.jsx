import { useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Bell, Building2, CalendarClock, ChevronDown, Gauge, Home, LifeBuoy, LogOut, Menu, MessageSquare, Moon, Package, PiggyBank, Settings, ShieldCheck, ShoppingBag, Store, Sun, Wallet, X, Users, Landmark, ClipboardCheck, Scale, Truck, FileText, BarChart3, ScrollText, Siren, Flag, Server, BadgeCheck, Undo2, Gavel, HandCoins, Tags, KeyRound,
} from 'lucide-react';
import { useSession, useTheme } from '../../lib/session';
import { get } from '../../lib/api';
import { Button, Spinner, cx } from '../ui';

export function Logo({ className }) {
  return (
    <Link to="/" className={cx('flex items-center gap-2 font-display text-xl font-extrabold tracking-tight', className)} aria-label="MubaPay home">
      <svg viewBox="0 0 64 64" className="h-8 w-8" aria-hidden><rect width="64" height="64" rx="16" fill="rgb(var(--ink))" /><path d="M14 44V20l18 14 18-14v24" fill="none" stroke="rgb(var(--palm))" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      <span>MubaPay</span>
    </Link>
  );
}

export function ThemeToggle() {
  const [theme, setTheme] = useTheme();
  const next = theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark';
  const Icon = theme === 'dark' ? Moon : Sun;
  return (
    <button className="inline-flex min-h-[44px] items-center gap-2 rounded-lg px-3 text-sm font-medium hover:bg-ink/5" onClick={() => setTheme(next)} aria-label={`Theme: ${theme}. Switch to ${next}`}>
      <Icon className="h-4 w-4" aria-hidden /> <span className="hidden sm:inline">{theme === 'system' ? 'Auto' : theme === 'dark' ? 'Dark' : 'Light'}</span>
    </button>
  );
}

function MaintenanceBanner() {
  const { meta } = useSession();
  if (!meta?.maintenance?.enabled) return null;
  return <div role="status" className="bg-warn-soft px-4 py-2 text-center text-sm font-medium text-warn">{meta.maintenance.message} You can still view your account; new transactions are paused.</div>;
}

// ---------------------------------------------------------------- public
export function PublicLayout() {
  const { user } = useSession();
  const [open, setOpen] = useState(false);
  const links = [['/savings', 'Savings'], ['/marketplace', 'Marketplace'], ['/real-estate', 'Real estate'], ['/how-it-works', 'How it works']];
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-surface focus:p-3">Skip to content</a>
      <MaintenanceBanner />
      <header className="border-b border-line bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Logo />
          <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
            {links.map(([to, l]) => <NavLink key={to} to={to} className={({ isActive }) => cx('rounded-lg px-3 py-2 text-sm font-semibold', isActive ? 'text-palm' : 'text-ink hover:bg-ink/5')}>{l}</NavLink>)}
          </nav>
          <div className="hidden items-center gap-2 md:flex">
            <ThemeToggle />
            {user ? <Button to="/app">Open my account</Button> : (<><Button variant="ghost" to="/login">Sign in</Button><Button to="/register">Create account</Button></>)}
          </div>
          <button className="rounded-lg p-2 md:hidden" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button>
        </div>
        {open && (
          <nav aria-label="Mobile" className="border-t border-line px-4 py-3 md:hidden">
            {links.map(([to, l]) => <Link key={to} to={to} onClick={() => setOpen(false)} className="block min-h-[44px] py-3 font-semibold">{l}</Link>)}
            <div className="mt-2 flex gap-2">{user ? <Button to="/app" className="flex-1">Open my account</Button> : (<><Button variant="secondary" to="/login" className="flex-1">Sign in</Button><Button to="/register" className="flex-1">Create account</Button></>)}</div>
            <ThemeToggle />
          </nav>
        )}
      </header>
      <main id="main" className="flex-1"><Outlet /></main>
      <footer className="border-t border-line">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3">
          <div>
            <Logo />
            <p className="mt-3 max-w-xs text-sm text-muted">Savings, payments, shopping and homes for Anambra, Enugu and Imo.</p>
          </div>
          <nav aria-label="Company" className="text-sm">
            <p className="mb-2 font-semibold">Company</p>
            {[['/about', 'About'], ['/contact', 'Contact'], ['/faqs', 'FAQs']].map(([to, l]) => <Link key={to} to={to} className="block py-1.5 text-muted hover:text-ink">{l}</Link>)}
          </nav>
          <nav aria-label="Legal" className="text-sm">
            <p className="mb-2 font-semibold">Policies</p>
            {[['/legal/terms_of_service', 'Terms'], ['/legal/privacy_policy', 'Privacy'], ['/legal/cookie_policy', 'Cookies'], ['/legal', 'All policies']].map(([to, l]) => <Link key={to} to={to} className="block py-1.5 text-muted hover:text-ink">{l}</Link>)}
          </nav>
        </div>
        <p className="mx-auto max-w-6xl px-4 pb-8 text-xs text-muted">MubaPay does not collect rent, deposits or property purchase prices. Payments are processed by Paystack.</p>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------- guards
export function RequireAuth({ children }) {
  const { user, loading } = useSession();
  const loc = useLocation();
  if (loading) return <div className="p-8"><Spinner /></div>;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  if ((user.roles.includes('admin') || user.roles.includes('superadmin')) && !user.twoFactorEnabled && !loc.pathname.startsWith('/app/settings/security')) {
    return <Navigate to="/app/settings/security?setup2fa=1" replace />;
  }
  return children;
}

export function RequireStaff({ children }) {
  const { isStaff } = useSession();
  if (!isStaff) return <Navigate to="/app" replace />;
  return children;
}

// ---------------------------------------------------------------- app shell
function SideLink({ to, icon: Icon, children, end, onClick, badge }) {
  return (
    <NavLink to={to} end={end} onClick={onClick} className={({ isActive }) => cx('flex min-h-[44px] items-center gap-3 rounded-lg px-3 text-sm font-semibold', isActive ? 'bg-palm-soft text-palm' : 'text-ink hover:bg-ink/5')}>
      <Icon className="h-[18px] w-[18px]" aria-hidden />
      <span className="flex-1">{children}</span>
      {badge ? <span className="rounded-full bg-palm px-2 text-xs text-palm-ink">{badge}<span className="sr-only"> unread</span></span> : null}
    </NavLink>
  );
}

function Group({ label, children }) {
  return (
    <div className="mt-5">
      <p className="mb-1 px-3 text-xs font-semibold text-muted">{label}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function Shell({ nav, title }) {
  const { user, signOut } = useSession();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const unread = useQuery({ queryKey: ['notifications', 'count'], queryFn: () => get('/notifications?limit=1').then((r) => r.meta.unread), refetchInterval: 60000, enabled: Boolean(user) });
  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 py-4"><Logo /><button className="rounded p-2 lg:hidden" aria-label="Close menu" onClick={close}><X /></button></div>
      <nav aria-label={title} className="flex-1 overflow-y-auto px-2 pb-4">{nav(close, unread.data)}</nav>
      <div className="border-t border-line p-3">
        <p className="truncate px-1 text-sm font-semibold">{user?.firstName} {user?.lastName}</p>
        <p className="truncate px-1 text-xs text-muted">{user?.email}</p>
        <div className="mt-2 flex items-center justify-between"><ThemeToggle /><button className="inline-flex min-h-[44px] items-center gap-2 rounded-lg px-3 text-sm font-medium hover:bg-ink/5" onClick={signOut}><LogOut className="h-4 w-4" aria-hidden /> Sign out</button></div>
      </div>
    </div>
  );
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-surface focus:p-3">Skip to content</a>
      <aside className="hidden border-r border-line bg-surface lg:sticky lg:top-0 lg:block lg:h-screen">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-ink/40" onClick={close} />
          <aside className="absolute inset-y-0 left-0 w-[86%] max-w-xs bg-surface shadow-xl">{sidebar}</aside>
        </div>
      )}
      <div className="min-w-0">
        <MaintenanceBanner />
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-paper/90 px-4 py-2 backdrop-blur lg:hidden">
          <button className="rounded-lg p-2" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)}><Menu /></button>
          <Logo />
        </header>
        <main id="main" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-8"><Outlet /></main>
      </div>
    </div>
  );
}

export function AppLayout() {
  const { user, isStaff } = useSession();
  const caps = user?.capabilities || {};
  return (
    <Shell title="Account" nav={(close, unread) => (
      <>
        <div className="space-y-0.5">
          <SideLink to="/app" end icon={Home} onClick={close}>Overview</SideLink>
          <SideLink to="/app/wallet" icon={Wallet} onClick={close}>Wallet</SideLink>
          <SideLink to="/app/savings" icon={PiggyBank} onClick={close}>Savings</SideLink>
          <SideLink to="/app/orders" icon={Package} onClick={close}>Orders</SideLink>
          <SideLink to="/app/appointments" icon={CalendarClock} onClick={close}>Viewings</SideLink>
          <SideLink to="/app/messages" icon={MessageSquare} onClick={close}>Messages</SideLink>
          <SideLink to="/app/notifications" icon={Bell} onClick={close} badge={unread}>Notifications</SideLink>
        </div>
        <Group label="Browse">
          <SideLink to="/marketplace" icon={ShoppingBag} onClick={close}>Marketplace</SideLink>
          <SideLink to="/real-estate" icon={Building2} onClick={close}>Real estate</SideLink>
          <SideLink to="/app/saved" icon={Tags} onClick={close}>Saved</SideLink>
        </Group>
        <Group label="Workspaces">
          <SideLink to="/app/seller" icon={Store} onClick={close}>Sell used items</SideLink>
          {(caps.landlord || caps.agent) ? <SideLink to="/app/properties" icon={Landmark} onClick={close}>{caps.agent && !caps.landlord ? 'Agent workspace' : 'Landlord workspace'}</SideLink> : <SideLink to="/app/verification" icon={Landmark} onClick={close}>Become a landlord or agent</SideLink>}
        </Group>
        <Group label="Account">
          <SideLink to="/app/verification" icon={BadgeCheck} onClick={close}>Verification</SideLink>
          <SideLink to="/app/disputes" icon={Scale} onClick={close}>Refunds & disputes</SideLink>
          <SideLink to="/app/support" icon={LifeBuoy} onClick={close}>Support</SideLink>
          <SideLink to="/app/settings" icon={Settings} onClick={close}>Settings</SideLink>
          {isStaff && <SideLink to="/admin" icon={ShieldCheck} onClick={close}>Staff console</SideLink>}
        </Group>
      </>
    )} />
  );
}

export function AdminLayout() {
  const { can, user } = useSession();
  const L = (perm, to, icon, label) => (!perm || (Array.isArray(perm) ? perm.some(can) : can(perm))) && <SideLink key={to} to={to} icon={icon}>{label}</SideLink>;
  return (
    <Shell title="Staff console" nav={() => (
      <>
        <div className="space-y-0.5">
          <SideLink to="/admin" end icon={Gauge}>Overview</SideLink>
          <SideLink to="/admin/approvals" icon={ClipboardCheck}>Approvals</SideLink>
        </div>
        <Group label="People">
          {L('users.view', '/admin/users', Users, 'Users')}
          {L('kyc.view', '/admin/verification', BadgeCheck, 'Identity verification')}
          {L('roles.review', '/admin/verification/roles', Landmark, 'Landlord & agent applications')}
          {L('staff.manage', '/admin/staff', KeyRound, 'Staff & permissions')}
        </Group>
        <Group label="Money">
          {L('withdrawals.view', '/admin/withdrawals', HandCoins, 'Withdrawals')}
          {L(['finance.view', 'risk.review'], '/admin/finance', Wallet, 'Ledger & transfers')}
          {L('reconciliation.view', '/admin/reconciliation', Scale, 'Reconciliation')}
          {L('savings.view', '/admin/savings', PiggyBank, 'Savings')}
          {L('settlements.view', '/admin/settlements', Landmark, 'Seller settlements')}
        </Group>
        <Group label="Marketplace & property">
          {L(['products.manage', 'categories.manage'], '/admin/products', ShoppingBag, 'Products & categories')}
          {L(['listings.moderate', 'properties.moderate', 'messaging.moderate'], '/admin/moderation', Flag, 'Moderation')}
          {L('orders.view', '/admin/orders', Package, 'Orders')}
          {L('deliveries.manage', '/admin/deliveries', Truck, 'Deliveries')}
          {L('refunds.view', '/admin/refunds', Undo2, 'Refunds')}
          {L('disputes.manage', '/admin/disputes', Gavel, 'Disputes')}
          {L('appointments.view', '/admin/appointments', CalendarClock, 'Viewings')}
        </Group>
        <Group label="Operations">
          {L('support.view', '/admin/support', LifeBuoy, 'Support queue')}
          {L('reports.view', '/admin/reports', BarChart3, 'Reports')}
          {L('audit.view', '/admin/audit', ScrollText, 'Audit log')}
          {L(['alerts.manage', 'system.health'], '/admin/alerts', Siren, 'Alerts')}
          {L('settings.view', '/admin/settings', Settings, 'Settings & features')}
          {L('legal.manage', '/admin/legal', FileText, 'Legal documents')}
          {L('system.health', '/admin/system', Server, 'System health')}
        </Group>
        <Group label="You"><SideLink to="/app" icon={Home}>Back to my account</SideLink></Group>
        <p className="mt-4 px-3 text-xs text-muted">Signed in as {user?.roles?.includes('superadmin') ? 'superadmin' : 'admin'}. Every action here is logged.</p>
      </>
    )} />
  );
}

export { ChevronDown };
