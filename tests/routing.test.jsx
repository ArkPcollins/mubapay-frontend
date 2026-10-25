import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from '../src/App';
import { SessionProvider } from '../src/lib/session';

const meta = { branding: { name: 'MubaPay' }, coverageStates: ['Anambra', 'Enugu', 'Imo'], collectionPoints: [], maintenance: { enabled: false }, features: {}, integrations: {}, environment: 'test' };

function mount(path, { user = null } = {}) {
  vi.stubGlobal('fetch', vi.fn((url) => {
    const ok = (data, extra = {}) => Promise.resolve(new Response(JSON.stringify({ success: true, data, ...extra }), { status: 200 }));
    if (url.includes('/auth/me')) return user ? ok({ user }) : Promise.resolve(new Response(JSON.stringify({ success: false, error: { code: 'UNAUTHENTICATED' } }), { status: 401 }));
    if (url.includes('/auth/refresh')) return Promise.resolve(new Response('{}', { status: 401 }));
    if (url.includes('/meta')) return ok(meta);
    if (url.includes('/notifications')) return ok([], { meta: { page: 1, pages: 1, total: 0, unread: 0 } });
    if (url.includes('/marketplace/products') || url.includes('/realestate/properties')) return ok({ items: [], sponsored: [] }, { meta: { page: 1, pages: 1, total: 0 } });
    return ok([]);
  }));
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><MemoryRouter initialEntries={[path]}><SessionProvider><App /></SessionProvider></MemoryRouter></QueryClientProvider>);
}

afterEach(() => vi.unstubAllGlobals());

describe('routing and guards', () => {
  it('renders the public home page', async () => {
    mount('/');
    expect(await screen.findByRole('main')).toBeInTheDocument();
    expect(document.querySelector('h1')).not.toBeNull();
  });

  it('sends signed-out visitors from the account area to sign-in', async () => {
    mount('/app/wallet');
    expect(await screen.findByRole('heading', { name: /sign in/i })).toBeInTheDocument();
  });

  it('keeps customers out of the staff console', async () => {
    mount('/admin', { user: { id: 'u1', email: 'a@b.ng', firstName: 'Ada', roles: ['customer'], capabilities: {}, preferences: {}, addresses: [] } });
    expect(await screen.findByRole('heading', { name: /hello, ada/i })).toBeInTheDocument();
  });

  it('forces staff without two-step verification to set it up first', async () => {
    mount('/admin', { user: { id: 's1', email: 's@b.ng', firstName: 'Sam', roles: ['customer', 'admin'], staffPermissions: ['users.view'], twoFactorEnabled: false, capabilities: {}, preferences: {}, addresses: [] } });
    expect(await screen.findByText(/staff accounts need two-step verification/i)).toBeInTheDocument();
  });

  it('shows a not-found page for unknown public paths', async () => {
    mount('/no-such-page');
    expect(await screen.findByText(/couldn.t find that page/i)).toBeInTheDocument();
  });
});
