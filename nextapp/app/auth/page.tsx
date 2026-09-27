'use client';
import { useState, useEffect, Suspense, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

type AuthView = 'login' | 'signup' | 'forgot' | 'reset' | 'confirm';

// ── Reusable password field with show/hide toggle ────────────────────────────
function PasswordInput({ name, placeholder, label }: { name: string; placeholder?: string; label: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="form-group">
      <label>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          name={name}
          type={show ? 'text' : 'password'}
          placeholder={placeholder || '••••••••'}
          required
          style={{ paddingRight: 44 }}
        />
        <button
          type="button"
          onClick={() => setShow(v => !v)}
          aria-label={show ? 'Hide password' : 'Show password'}
          style={{
            position: 'absolute', right: 2, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--gray-500)', padding: 11, display: 'flex', alignItems: 'center',
          }}
        >
          {show ? (
            // Eye-off icon
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
              <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
          ) : (
            // Eye icon
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="auth-main" />}>
      <AuthPageInner />
    </Suspense>
  );
}

// Only allow same-site paths as post-login destinations (blocks ?redirect=https://evil.example)
function safeRedirect(target: string | null): string {
  if (!target || !target.startsWith('/') || target.startsWith('//') || target.startsWith('/\\')) return '/profile';
  return target;
}

// Supabase reports failed/expired email links as error params in the query (PKCE) or hash (implicit)
function readLinkError(params: URLSearchParams): string | null {
  const hash = typeof window !== 'undefined' ? new URLSearchParams(window.location.hash.slice(1)) : null;
  const desc = params.get('error_description') || hash?.get('error_description');
  if (!desc) return null;
  const code = params.get('error_code') || hash?.get('error_code');
  if (code === 'otp_expired') return 'That email link has expired or was already used. Please request a new one.';
  return desc.replace(/\+/g, ' ');
}

function AuthPageInner() {
  const { user, initialized, passwordRecovery, finishPasswordRecovery, login, signup, logout, requestPasswordReset, updatePassword } = useAuth();
  const router = useRouter();
  const params = useSearchParams();

  const [view, setView] = useState<AuthView>(() => (params.get('signup') === 'true' ? 'signup' : 'login'));
  const [alert, setAlert] = useState<{ msg: string; type: 'error' | 'success' } | null>(() => {
    const linkError = readLinkError(params);
    if (linkError) return { msg: linkError, type: 'error' };
    if (params.get('signup') === 'true' && params.get('promo')) {
      return { msg: `🎁 Sign up now to claim your ${params.get('promo')} discount on your next order!`, type: 'success' };
    }
    if (params.get('checkout') === 'true') return { msg: 'Please log in or sign up to complete your purchase.', type: 'success' };
    return null;
  });
  const [loading, setLoading] = useState(false);
  const [prefilledEmail] = useState(() => (params.get('signup') === 'true' && params.get('email')) || '');
  const [confirmedEmail, setConfirmedEmail] = useState('');
  // An auth code in the URL means we arrived from an email link (signup confirmation or password reset)
  const [arrivedWithCode] = useState(() => params.has('code'));

  const redirectUrl = safeRedirect(params.get('redirect'));
  // A password-reset link signs the user in, but they must set a new password before going anywhere
  const currentView: AuthView = passwordRecovery ? 'reset' : view;

  // Single place that sends signed-in users onward (after login, signup, email confirmation, or an existing session)
  useEffect(() => {
    if (!user || passwordRecovery) return;
    router.replace(user.role === 'admin' ? '/admin' : redirectUrl);
  }, [user, passwordRecovery, router, redirectUrl]);

  // Email link opened but no session came out of it (e.g. confirmed in a different browser/app)
  const linkNotice = arrivedWithCode && initialized && !user && !passwordRecovery && !alert
    ? { msg: 'Your email link was opened, but we couldn’t sign you in automatically (this happens if it was opened in a different browser). If you just confirmed your email, please log in below.', type: 'success' as const }
    : null;
  const recoveryNotice = currentView === 'reset' && !alert ? { msg: 'Enter your new password below.', type: 'success' as const } : null;
  const shownAlert = alert || recoveryNotice || linkNotice;

  const showAlert = useCallback((msg: string, type: 'error' | 'success' = 'error') => {
    setAlert({ msg, type });
  }, []);

  // ── Login ──────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = fd.get('email') as string;
    const password = fd.get('password') as string;
    setLoading(true);
    showAlert('Logging in…', 'success');
    const res = await login(email, password);
    setLoading(false);
    if (res.success) {
      showAlert('Logged in — redirecting…', 'success'); // the redirect effect takes it from here
    } else {
      showAlert(res.message || 'Login failed.');
    }
  };

  // ── Signup ─────────────────────────────────────────────
  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = fd.get('email') as string;
    setLoading(true);
    showAlert('Creating account…', 'success');
    const res = await signup(
      fd.get('name') as string,
      email,
      fd.get('password') as string,
      fd.get('phone') as string
    );
    setLoading(false);
    if (res.success) {
      if ((res as { success: boolean; emailConfirmationRequired?: boolean }).emailConfirmationRequired) {
        // Email confirmation is required — show a holding screen
        setConfirmedEmail(email);
        setAlert(null);
        setView('confirm');
      } else {
        showAlert('Account created — redirecting…', 'success'); // the redirect effect takes it from here
      }
    } else {
      showAlert(res.message || 'Signup failed.');
    }
  };

  // ── Forgot ─────────────────────────────────────────────
  const handleForgot = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const btn = (e.currentTarget.querySelector('button[type="submit"]') as HTMLButtonElement);
    setLoading(true);
    showAlert('Sending reset link…', 'success');
    const res = await requestPasswordReset(fd.get('email') as string);
    setLoading(false);
    if (res.success) {
      showAlert('✅ Reset link sent! Check your inbox and spam folder. It may take a minute to arrive.', 'success');
      if (btn) { btn.disabled = true; btn.textContent = 'Email Sent'; }
    } else {
      showAlert(res.message || 'Failed to send reset link.');
    }
  };

  // ── Reset ──────────────────────────────────────────────
  const handleReset = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const newPass = fd.get('newPassword') as string;
    const confirmPass = fd.get('confirmPassword') as string;
    if (newPass !== confirmPass) { showAlert('Passwords do not match.'); return; }
    if (newPass.length < 6) { showAlert('Password must be at least 6 characters.'); return; }
    const btn = (e.currentTarget.querySelector('button[type="submit"]') as HTMLButtonElement);
    setLoading(true);
    showAlert('Updating password…', 'success');
    const res = await updatePassword(newPass);
    setLoading(false);
    if (res.success) {
      if (btn) btn.disabled = true;
      // Sign out the temporary recovery session so the user logs in fresh with the new password
      await logout();
      finishPasswordRecovery();
      router.replace('/auth');
      setView('login');
      showAlert('✅ Password updated! Please log in with your new password.', 'success');
    } else {
      showAlert(res.message || 'Failed to update password.');
    }
  };

  return (
    <>
      <header className="header">
        <div className="header-inner" style={{ justifyContent: 'center' }}>
          <Link href="/" className="logo">KB.ENT</Link>
        </div>
      </header>

      <main className="auth-main">
        <div className="auth-container">
          <div className="auth-box">

            {/* Back button — hide on the confirm screen */}
            {currentView !== 'confirm' && (
              <button
                onClick={() => router.back()}
                style={{ background: 'none', border: 'none', color: 'var(--gray-600)', cursor: 'pointer', fontSize: 14, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6, padding: '10px 0' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
                Go Back
              </button>
            )}

            {/* Tabs — only show for login/signup */}
            {(currentView === 'login' || currentView === 'signup') && (
              <div className="auth-tabs">
                <button className={`auth-tab${view === 'login' ? ' active' : ''}`} onClick={() => { setView('login'); setAlert(null); }}>Login</button>
                <button className={`auth-tab${view === 'signup' ? ' active' : ''}`} onClick={() => { setView('signup'); setAlert(null); }}>Sign Up</button>
              </div>
            )}

            {shownAlert && <div className={`auth-alert ${shownAlert.type}`}>{shownAlert.msg}</div>}

            {/* ── EMAIL CONFIRM HOLDING SCREEN ── */}
            {currentView === 'confirm' && (
              <div style={{ textAlign: 'center', padding: '8px 0' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📧</div>
                <h2 className="auth-title">Check your inbox</h2>
                <p className="auth-desc" style={{ marginBottom: 8 }}>
                  We sent a confirmation link to:
                </p>
                <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 20, wordBreak: 'break-all' }}>
                  {confirmedEmail}
                </p>
                <p className="auth-desc" style={{ marginBottom: 28 }}>
                  Click the link in that email to activate your account. You&apos;ll be signed in automatically.
                  <br /><br />
                  Don&apos;t see it? Check your <strong>spam or junk folder</strong>.
                </p>
                <button
                  onClick={() => { setView('login'); setAlert(null); }}
                  className="btn btn-outline"
                  style={{ width: '100%' }}
                >
                  Back to Login
                </button>
              </div>
            )}

            {/* ── LOGIN ── */}
            {currentView === 'login' && (
              <form className="auth-form" onSubmit={handleLogin}>
                <h2 className="auth-title">Welcome Back</h2>
                <p className="auth-desc">Enter your details to access your KB account.</p>
                <div className="form-group">
                  <label>Email</label>
                  <input name="email" type="email" placeholder="you@example.com" required />
                </div>
                <PasswordInput name="password" label="Password" />
                <button type="submit" className="auth-btn" disabled={loading}>{loading ? 'Logging in…' : 'Log In'}</button>
                <p style={{ textAlign: 'center', marginTop: 16, fontSize: 14, color: 'var(--gray-600)' }}>
                  <button type="button" onClick={() => setView('forgot')} style={{ background: 'none', border: 'none', color: 'var(--black)', fontWeight: 600, textDecoration: 'underline', cursor: 'pointer' }}>
                    Forgot your password?
                  </button>
                </p>
              </form>
            )}

            {/* ── FORGOT ── */}
            {currentView === 'forgot' && (
              <form className="auth-form" onSubmit={handleForgot}>
                <h2 className="auth-title">Reset Password</h2>
                <p className="auth-desc">Enter your email and we&apos;ll send you a reset link.</p>
                <div className="form-group">
                  <label>Email</label>
                  <input name="email" type="email" placeholder="you@example.com" required />
                </div>
                <button type="submit" className="auth-btn" disabled={loading}>{loading ? 'Sending…' : 'Send Reset Link'}</button>
                <p style={{ textAlign: 'center', marginTop: 16, fontSize: 14 }}>
                  <button type="button" onClick={() => setView('login')} style={{ background: 'none', border: 'none', color: 'var(--black)', fontWeight: 600, cursor: 'pointer' }}>
                    ← Back to Login
                  </button>
                </p>
              </form>
            )}

            {/* ── RESET ── */}
            {currentView === 'reset' && (
              <form className="auth-form" onSubmit={handleReset}>
                <h2 className="auth-title">Set New Password</h2>
                <p className="auth-desc">Choose a strong new password for your KB.ENT account.</p>
                <PasswordInput name="newPassword" label="New Password" placeholder="At least 6 characters" />
                <PasswordInput name="confirmPassword" label="Confirm New Password" placeholder="Repeat your new password" />
                <button type="submit" className="auth-btn" disabled={loading}>{loading ? 'Updating…' : 'Update Password'}</button>
              </form>
            )}

            {/* ── SIGNUP ── */}
            {currentView === 'signup' && (
              <form className="auth-form" onSubmit={handleSignup}>
                <h2 className="auth-title">Create Account</h2>
                <p className="auth-desc">Join KB to start managing your orders and wishlist.</p>
                <div className="form-group">
                  <label>Full Name</label>
                  <input name="name" type="text" placeholder="John Doe" required />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input name="email" type="email" placeholder="you@example.com" required defaultValue={prefilledEmail} />
                </div>
                <div className="form-group">
                  <label>MoMo Number (Phone)</label>
                  <input name="phone" type="tel" placeholder="024XXXXXXX" required />
                </div>
                <PasswordInput name="password" label="Password" />
                <button type="submit" className="auth-btn" disabled={loading}>{loading ? 'Creating account…' : 'Sign Up'}</button>
              </form>
            )}

          </div>
        </div>
      </main>
    </>
  );
}
