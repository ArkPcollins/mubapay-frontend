import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { get, post } from '../../lib/api';
import { useSession } from '../../lib/session';
import { useSeo } from '../../lib/seo';
import { Button, Checkbox, ErrorState, Input, Notice, Spinner } from '../../components/ui';
import { PolicyConsent } from '../../components/ui/forms';
import { Logo } from '../../components/layout/layouts';

function AuthCard({ title, subtitle, children }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Logo className="mb-8" />
        <h1 className="font-display text-3xl font-bold">{title}</h1>
        {subtitle && <p className="mt-2 text-muted">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

const fieldErr = (e, path) => e?.details?.find?.((d) => d.path === path)?.message;

/** Google Identity Services button — rendered only when the server has GOOGLE_CLIENT_ID configured. */
function GoogleButton({ onCredential }) {
  const cfg = useQuery({ queryKey: ['google-config'], queryFn: () => get('/auth/google/config') });
  const ref = useRef(null);
  useEffect(() => {
    if (!cfg.data?.configured) return;
    const init = () => {
      window.google?.accounts?.id?.initialize({ client_id: cfg.data.clientId, callback: (r) => onCredential(r.credential) });
      window.google?.accounts?.id?.renderButton(ref.current, { theme: 'outline', size: 'large', width: 360, text: 'continue_with' });
    };
    if (window.google?.accounts) return init();
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = init;
    document.head.appendChild(s);
  }, [cfg.data]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!cfg.data?.configured) return null;
  return <div className="mt-4"><div ref={ref} /><p className="my-4 text-center text-sm text-muted">or use your email</p></div>;
}

export function LoginPage() {
  useSeo({ title: 'Sign in', noindex: true });
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const { setUser } = useSession();
  const [form, setForm] = useState({ email: '', password: '' });
  const [challenge, setChallenge] = useState(null);
  const [code, setCode] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);
  const [consentNeeded, setConsentNeeded] = useState(null);
  const [accepted, setAccepted] = useState([]);
  const next = sp.get('next') || '/app';
  const done = (r) => {
    if (r.twoFactorRequired) return setChallenge(r.challengeToken);
    setUser(r.user);
    nav(next.startsWith('/') ? next : '/app', { replace: true });
  };
  const login = useMutation({ mutationFn: () => post('/auth/login', form), onSuccess: done });
  const twofa = useMutation({ mutationFn: () => post('/auth/login/2fa', useRecovery ? { challengeToken: challenge, recoveryCode: code } : { challengeToken: challenge, code }), onSuccess: done });
  const google = useMutation({ mutationFn: (b) => post('/auth/google', b), onSuccess: (r, b) => (r.needsConsent ? setConsentNeeded({ ...r, credential: b.credential }) : done(r)) });

  if (consentNeeded) {
    return (
      <AuthCard title="One more step" subtitle={`Create your MubaPay account for ${consentNeeded.email}.`}>
        <PolicyConsent slugs={['terms_of_service', 'privacy_policy']} accepted={accepted} onChange={setAccepted} />
        {google.isError && <div className="mt-3"><ErrorState error={google.error} /></div>}
        <Button className="mt-4 w-full" disabled={accepted.length < 2} loading={google.isPending} onClick={() => google.mutate({ credential: consentNeeded.credential, acceptedPolicies: accepted })}>Create account</Button>
      </AuthCard>
    );
  }
  if (challenge) {
    return (
      <AuthCard title="Two-step verification" subtitle={useRecovery ? 'Enter one of your recovery codes. Each code works once.' : 'Enter the 6-digit code from your authenticator app.'}>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); twofa.mutate(); }}>
          <Input label={useRecovery ? 'Recovery code' : 'Authentication code'} value={code} onChange={(e) => setCode(e.target.value.trim())} autoComplete="one-time-code" inputMode={useRecovery ? 'text' : 'numeric'} autoFocus required error={twofa.error?.message} />
          <Button type="submit" className="w-full" loading={twofa.isPending}>Verify and sign in</Button>
          <button type="button" className="link text-sm" onClick={() => { setUseRecovery(!useRecovery); setCode(''); }}>{useRecovery ? 'Use my authenticator app instead' : 'I can’t use my authenticator app'}</button>
        </form>
      </AuthCard>
    );
  }
  return (
    <AuthCard title="Sign in" subtitle="Welcome back.">
      <GoogleButton onCredential={(credential) => google.mutate({ credential })} />
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); login.mutate(); }}>
        <Input label="Email" type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        <Input label="Password" type="password" autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
        {login.isError && <Notice tone="danger">{login.error.message}</Notice>}
        {google.isError && <Notice tone="danger">{google.error.message}</Notice>}
        <Button type="submit" className="w-full" loading={login.isPending}>Sign in</Button>
      </form>
      <div className="mt-6 flex justify-between text-sm">
        <Link className="link" to="/forgot-password">Forgot password?</Link>
        <Link className="link" to="/register">Create an account</Link>
      </div>
    </AuthCard>
  );
}

export function RegisterPage() {
  useSeo({ title: 'Create your account', noindex: true });
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', password: '' });
  const [accepted, setAccepted] = useState([]);
  const [marketing, setMarketing] = useState(false);
  const reg = useMutation({ mutationFn: () => post('/auth/register', { ...form, phone: form.phone || undefined, acceptedPolicies: accepted, marketingOptIn: marketing }) });
  const google = useMutation({ mutationFn: (b) => post('/auth/google', b) });
  const nav = useNavigate();
  if (reg.isSuccess) {
    return (
      <AuthCard title="Check your email" subtitle={`We sent a verification link to ${form.email}. Open it on this device to finish setting up your account.`}>
        <Button variant="secondary" to="/login">Go to sign in</Button>
      </AuthCard>
    );
  }
  const e = reg.error;
  const set = (k) => (ev) => setForm({ ...form, [k]: ev.target.value });

  return (
    <AuthCard title="Create your account" subtitle="It takes about two minutes. You can browse straight away; money features unlock as you verify.">
      <GoogleButton onCredential={(credential) => google.mutate({ credential, acceptedPolicies: accepted }, { onSuccess: (r) => (r.user ? nav('/app/onboarding') : null) })} />
      <form className="space-y-4" onSubmit={(ev) => { ev.preventDefault(); reg.mutate(); }}>
        <div className="grid grid-cols-2 gap-3">
          <Input label="First name" autoComplete="given-name" value={form.firstName} onChange={set('firstName')} required error={fieldErr(e, 'firstName')} />
          <Input label="Last name" autoComplete="family-name" value={form.lastName} onChange={set('lastName')} required error={fieldErr(e, 'lastName')} />
        </div>
        <Input label="Email" type="email" autoComplete="email" value={form.email} onChange={set('email')} required error={fieldErr(e, 'email')} />
        <Input label="Phone number" type="tel" autoComplete="tel" placeholder="0803 000 0000" value={form.phone} onChange={set('phone')} hint="You’ll verify it later with a code." error={fieldErr(e, 'phone')} />
        <Input label="Password" type="password" autoComplete="new-password" value={form.password} onChange={set('password')} required hint="At least 10 characters, with upper and lower case letters and a number." error={fieldErr(e, 'password')} />
        <PolicyConsent slugs={['terms_of_service', 'privacy_policy']} accepted={accepted} onChange={setAccepted} />
        <Checkbox label="Send me product news and offers by email" description="Optional. You can unsubscribe at any time." checked={marketing} onChange={(ev) => setMarketing(ev.target.checked)} />
        {e && !e.details && <Notice tone="danger">{e.message}</Notice>}
        {e?.details?.some((d) => d.path?.startsWith('acceptedPolicies')) && <Notice tone="danger">Please accept the current Terms of Service and Privacy Policy.</Notice>}
        <Button type="submit" className="w-full" loading={reg.isPending} disabled={accepted.length < 2}>Create account</Button>
      </form>
      <p className="mt-6 text-sm">Already have an account? <Link className="link" to="/login">Sign in</Link></p>
    </AuthCard>
  );
}

export function VerifyEmailPage() {
  const [sp] = useSearchParams();
  const { refresh } = useSession();
  const m = useMutation({ mutationFn: () => post('/auth/verify-email', { token: sp.get('token') }), onSuccess: refresh });
  useEffect(() => {
    if (sp.get('token')) m.mutate();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <AuthCard title="Verifying your email">
      {m.isPending && <Spinner />}
      {m.isSuccess && <><Notice tone="success">Your email is verified.</Notice><Button className="mt-4" to="/app/onboarding">Continue setting up</Button></>}
      {m.isError && <><ErrorState error={m.error} /><p className="mt-4 text-sm">Signed in? You can request a new link from your account overview.</p></>}
    </AuthCard>
  );
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const m = useMutation({ mutationFn: () => post('/auth/password/forgot', { email }) });
  return (
    <AuthCard title="Reset your password" subtitle="We’ll email you a link that works for 30 minutes.">
      {m.isSuccess ? <Notice tone="success">If an account exists for {email}, a reset link is on its way.</Notice> : (
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Button type="submit" className="w-full" loading={m.isPending}>Send reset link</Button>
        </form>
      )}
      <Link className="link mt-6 inline-block text-sm" to="/login">Back to sign in</Link>
    </AuthCard>
  );
}

export function ResetPasswordPage() {
  const [sp] = useSearchParams();
  const [password, setPassword] = useState('');
  const m = useMutation({ mutationFn: () => post('/auth/password/reset', { token: sp.get('token'), password }) });
  return (
    <AuthCard title="Choose a new password" subtitle="This signs you out on every other device.">
      {m.isSuccess ? <><Notice tone="success">Password changed.</Notice><Button className="mt-4" to="/login">Sign in</Button></> : (
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
          <Input label="New password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required hint="At least 10 characters, with upper and lower case letters and a number." error={m.error?.details?.[0]?.message || (m.isError ? m.error.message : undefined)} />
          <Button type="submit" className="w-full" loading={m.isPending}>Save new password</Button>
        </form>
      )}
    </AuthCard>
  );
}

export function UnsubscribePage() {
  const [sp] = useSearchParams();
  const q = useQuery({ queryKey: ['unsub'], queryFn: () => get(`/account/unsubscribe?token=${encodeURIComponent(sp.get('token') || '')}`), retry: false });
  return (
    <AuthCard title="Email preferences">
      {q.isLoading ? <Spinner /> : q.isError ? <ErrorState error={q.error} /> : <Notice tone="success">You’ve been unsubscribed from marketing emails. You’ll still receive security and transaction messages.</Notice>}
    </AuthCard>
  );
}
