import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { Spinner } from './components/ui';
import { AdminLayout, AppLayout, PublicLayout, RequireAuth, RequireStaff } from './components/layout/layouts';
import { AboutPage, ContactPage, FaqPage, HomePage, HowItWorksPage, NotFoundPage, SavingsInfoPage } from './pages/public/marketing';
import { LegalDocPage, LegalIndexPage, MarketplacePage, ProductPage, PropertyPage, RealEstatePage } from './pages/public/browse';
import { ForgotPasswordPage, LoginPage, RegisterPage, ResetPasswordPage, UnsubscribePage, VerifyEmailPage } from './pages/auth/auth';
import { DashboardPage, OnboardingPage } from './pages/app/home';
import { PaymentReturnPage, WalletPage } from './pages/app/wallet';
import { SavingsDetailPage, SavingsListPage, SavingsNewPage } from './pages/app/savings';
import { CartPage, CheckoutPage, CheckoutReturnPage, DisputeDetailPage, DisputesPage, OrderDetailPage, OrdersPage, SavedPage } from './pages/app/commerce';
import { AppointmentDetailPage, AppointmentsPage, ConversationPage, MessagesPage, NotificationsPage, SupportNewPage, SupportPage, TicketPage } from './pages/app/engagement';
import { SettingsPage, VerificationPage } from './pages/app/account';

// Workspaces and the staff console are split into their own chunks: most
// customers never load them.
const W = lazy(() => import('./pages/workspace/workspace').then((m) => ({ default: ({ page, ...p }) => { const C = m[page]; return <C {...p} />; } })));
const A = lazy(() => import('./pages/admin/index').then((m) => ({ default: ({ page, ...p }) => { const C = m[page]; return <C {...p} />; } })));

const Loading = () => <div className="p-8"><Spinner /></div>;
const ws = (page, props) => <Suspense fallback={<Loading />}><W page={page} {...props} /></Suspense>;
const ad = (page, props) => <Suspense fallback={<Loading />}><A page={page} {...props} /></Suspense>;

function AdminOrder() {
  const { id } = useParams();
  return ad('OrderAdminDetailPage', { id });
}

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<HomePage />} />
        <Route path="savings" element={<SavingsInfoPage />} />
        <Route path="how-it-works" element={<HowItWorksPage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="contact" element={<ContactPage />} />
        <Route path="faq" element={<FaqPage />} />
        <Route path="marketplace" element={<MarketplacePage />} />
        <Route path="marketplace/:slug" element={<ProductPage />} />
        <Route path="real-estate" element={<RealEstatePage />} />
        <Route path="real-estate/:slug" element={<PropertyPage />} />
        <Route path="legal" element={<LegalIndexPage />} />
        <Route path="legal/:slug" element={<LegalDocPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="verify-email" element={<VerifyEmailPage />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
        <Route path="reset-password" element={<ResetPasswordPage />} />
        <Route path="unsubscribe" element={<UnsubscribePage />} />
      </Route>

      <Route path="app" element={<RequireAuth><AppLayout /></RequireAuth>}>
        <Route index element={<DashboardPage />} />
        <Route path="onboarding" element={<OnboardingPage />} />
        <Route path="wallet" element={<WalletPage />} />
        <Route path="wallet/withdrawals" element={<Navigate to="/app/wallet?tab=withdrawals" replace />} />
        <Route path="wallet/funding/return" element={<PaymentReturnPage />} />
        <Route path="payments/return" element={<PaymentReturnPage />} />
        <Route path="savings" element={<SavingsListPage />} />
        <Route path="savings/new" element={<SavingsNewPage />} />
        <Route path="savings/:id" element={<SavingsDetailPage />} />
        <Route path="cart" element={<CartPage />} />
        <Route path="checkout" element={<CheckoutPage />} />
        <Route path="checkout/return" element={<CheckoutReturnPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="orders/:id" element={<OrderDetailPage />} />
        <Route path="disputes" element={<DisputesPage />} />
        <Route path="disputes/:id" element={<DisputeDetailPage />} />
        <Route path="saved" element={<SavedPage />} />
        <Route path="appointments" element={<AppointmentsPage />} />
        <Route path="appointments/:id" element={<AppointmentDetailPage />} />
        <Route path="messages" element={<MessagesPage />} />
        <Route path="messages/:id" element={<ConversationPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="support" element={<SupportPage />} />
        <Route path="support/new" element={<SupportNewPage />} />
        <Route path="support/:id" element={<TicketPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="settings/:tab" element={<SettingsPage />} />
        <Route path="verification" element={<VerificationPage />} />
        {/* workspaces */}
        <Route path="seller" element={ws('SellerPage')} />
        <Route path="seller/listings" element={<Navigate to="/app/seller" replace />} />
        <Route path="seller/settlements" element={<Navigate to="/app/seller" replace />} />
        <Route path="seller/new" element={ws('SellerListingEditPage')} />
        <Route path="seller/orders/:id" element={ws('SellerOrderPage')} />
        <Route path="seller/:id" element={ws('SellerListingEditPage')} />
        <Route path="properties" element={ws('PropertiesWorkspacePage')} />
        <Route path="properties/new" element={ws('PropertyEditPage')} />
        <Route path="properties/:id" element={ws('PropertyEditPage')} />
        <Route path="landlord/properties" element={<Navigate to="/app/properties" replace />} />
        <Route path="agent" element={<Navigate to="/app/properties" replace />} />
        <Route path="workspace" element={<Navigate to="/app/properties" replace />} />
        <Route path="provider/appointments" element={<AppointmentsPage as="provider" />} />
        <Route path="provider/appointments/:id" element={<AppointmentDetailPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      <Route path="admin" element={<RequireAuth><RequireStaff><AdminLayout /></RequireStaff></RequireAuth>}>
        <Route index element={ad('AdminOverviewPage')} />
        <Route path="approvals" element={ad('ApprovalsPage')} />
        <Route path="users" element={ad('UsersPage')} />
        <Route path="users/:id" element={ad('UserDetailPage')} />
        <Route path="staff" element={ad('StaffPage')} />
        <Route path="verification" element={ad('IdentityQueuePage')} />
        <Route path="verification/roles" element={ad('RoleQueuePage')} />
        <Route path="withdrawals" element={ad('WithdrawalsAdminPage')} />
        <Route path="finance" element={ad('FinancePage')} />
        <Route path="risk" element={<Navigate to="/admin/finance?tab=transfers" replace />} />
        <Route path="finance/accounts/:code" element={ad('LedgerAccountPage')} />
        <Route path="finance/transactions/:reference" element={ad('LedgerTransactionPage')} />
        <Route path="reconciliation" element={ad('ReconciliationPage')} />
        <Route path="savings" element={ad('SavingsAdminPage')} />
        <Route path="settlements" element={ad('SettlementsAdminPage')} />
        <Route path="products" element={ad('ProductsAdminPage')} />
        <Route path="moderation" element={ad('ModerationPage')} />
        <Route path="moderation/products" element={<Navigate to="/admin/moderation?tab=products" replace />} />
        <Route path="moderation/properties" element={<Navigate to="/admin/moderation?tab=properties" replace />} />
        <Route path="moderation/users" element={<Navigate to="/admin/moderation?tab=reports" replace />} />
        <Route path="orders" element={ad('OrdersAdminPage')} />
        <Route path="orders/:id" element={<AdminOrder />} />
        <Route path="deliveries" element={ad('DeliveriesAdminPage')} />
        <Route path="refunds" element={ad('RefundsAdminPage')} />
        <Route path="disputes" element={ad('DisputesAdminPage')} />
        <Route path="appointments" element={ad('AppointmentsAdminPage')} />
        <Route path="support" element={ad('SupportQueuePage')} />
        <Route path="support/:id" element={<TicketPage staff />} />
        <Route path="reports" element={ad('ReportsPage')} />
        <Route path="reports/runs/:id" element={<Navigate to="/admin/reports" replace />} />
        <Route path="audit" element={ad('AuditPage')} />
        <Route path="alerts" element={ad('AlertsPage')} />
        <Route path="settings" element={ad('SettingsAdminPage')} />
        <Route path="legal" element={ad('LegalAdminPage')} />
        <Route path="system" element={ad('SystemPage')} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      <Route element={<PublicLayout />}>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
