'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { getClient } from '@/lib/supabase/client';

type AuthView = 'login' | 'signup' | 'forgot' | 'reset';

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="auth-main" />}>
      <AuthPageInner />
    </Suspense>
  );
}

function AuthPageInner() {
  const { user, login, signup, requestPasswordReset, updatePassword } = useAuth();
  const [view, setView] = useState<AuthView>('login');
  const [alert, setAlert] = useState<{ msg: string; type: 'error' | 'success' } | null>(null);
  const [loading, setLoading] = useState(false);
  const [prefilledEmail, setPrefilledEmail] = useState('');
  const router = useRouter();
  const params = useSearchParams();

  const redirectUrl = params.get('redirect') || '/profile';

  // Detect PASSWORD_RECOVERY event from Supabase email link
  useEffect(() => {
    const supabase = getClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setView('reset');
        setAlert({ msg: 'Enter your new password below.', type: 'success' });
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      if (params.get('checkout') === 'true' && params.get('redirect')) {
        router.push(params.get('redirect')!);
      } else {
        router.push(user.role === 'admin' ? '/admin' : '/profile');
      }
    }
  }, [user, router, params]);

  // Show checkout prompt
  useEffect(() => {
    if (params.get('checkout') === 'true') {
      setAlert({ msg: 'Please log in or sign up to complete your purchase.', type: 'success' });
    }
  }, [params]);

  // Pre-fill signup tab when coming from the guest signup nudge
  useEffect(() => {
    if (params.get('signup') === 'true') {
      setView('signup');
      const email = params.get('email');
      if (email) {
        // Set email field after mount via a ref-free approach: store in state used by signup form
        setPrefilledEmail(email);
      }
      if (params.get('promo')) {
        setAlert({ msg: `🎁 Sign up now to claim your ${params.get('promo')} discount on your next order!`, type: 'success' });
      }
    }
  }, [params]);

  const showAlert = (msg: string, type: 'error' | 'success' = 'error') => setAlert({ msg, type });

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
      router.push((res as { success: boolean; user?: { role: string } }).user?.role === 'admin' ? '/admin' : redirectUrl);
    } else {
      showAlert(res.message || 'Login failed.');
    }
  };

  // ── Signup ─────────────────────────────────────────────
  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    showAlert('Creating account…', 'success');
    const res = await signup(
      fd.get('name') as string,
      fd.get('email') as string,
      fd.get('password') as string,
      fd.get('phone') as string
    );
    setLoading(false);
    if (res.success) router.push(redirectUrl);
    else showAlert(res.message || 'Signup failed.');
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
      // Disable to prevent re-sending
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
      showAlert('✅ Password updated! Signing you out for a clean session…', 'success');
      if (btn) btn.disabled = true;
      // Use replace so the back button doesn't return to the reset form
      setTimeout(() => router.replace('/auth'), 2000);
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
            <button
              onClick={() => router.back()}
              style={{ background: 'none', border: 'none', color: 'var(--gray-600)', cursor: 'pointer', fontSize: 14, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 6, padding: 0 }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
              Go Back
            </button>

            {/* Tabs — only show for login/signup */}
            {(view === 'login' || view === 'signup') && (
              <div className="auth-tabs">
                <button className={`auth-tab${view === 'login' ? ' active' : ''}`} onClick={() => { setView('login'); setAlert(null); }}>Login</button>
                <button className={`auth-tab${view === 'signup' ? ' active' : ''}`} onClick={() => { setView('signup'); setAlert(null); }}>Sign Up</button>
              </div>
            )}

            {alert && <div className={`auth-alert ${alert.type}`}>{alert.msg}</div>}

            {/* LOGIN */}
            {view === 'login' && (
              <form className="auth-form" onSubmit={handleLogin}>
                <h2 className="auth-title">Welcome Back</h2>
                <p className="auth-desc">Enter your details to access your KB account.</p>
                <div className="form-group">
                  <label>Email</label>
                  <input name="email" type="email" placeholder="you@example.com" required />
                </div>
                <div className="form-group">
                  <label>Password</label>
                  <input name="password" type="password" placeholder="••••••••" required />
                </div>
                <button type="submit" className="auth-btn" disabled={loading}>{loading ? 'Logging in…' : 'Log In'}</button>
                <p style={{ textAlign: 'center', marginTop: 16, fontSize: 14, color: 'var(--gray-600)' }}>
                  <button type="button" onClick={() => setView('forgot')} style={{ background: 'none', border: 'none', color: 'var(--black)', fontWeight: 600, textDecoration: 'underline', cursor: 'pointer' }}>
                    Forgot your password?
                  </button>
                </p>
              </form>
            )}

            {/* FORGOT */}
            {view === 'forgot' && (
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

            {/* RESET */}
            {view === 'reset' && (
              <form className="auth-form" onSubmit={handleReset}>
                <h2 className="auth-title">Set New Password</h2>
                <p className="auth-desc">Choose a strong new password for your KB.ENT account.</p>
                <div className="form-group">
                  <label>New Password</label>
                  <input name="newPassword" type="password" placeholder="At least 6 characters" required minLength={6} />
                </div>
                <div className="form-group">
                  <label>Confirm New Password</label>
                  <input name="confirmPassword" type="password" placeholder="Repeat your new password" required minLength={6} />
                </div>
                <button type="submit" className="auth-btn" disabled={loading}>{loading ? 'Updating…' : 'Update Password'}</button>
              </form>
            )}

            {/* SIGNUP */}
            {view === 'signup' && (
              <form className="auth-form" onSubmit={handleSignup}>
                <h2 className="auth-title">Create Account</h2>
                <p className="auth-desc">Join KB to start managing your orders and wishlist.</p>
                <div className="form-group">
                  <label>Full Name</label>
                  <input name="name" type="text" placeholder="John Doe" required />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input name="email" type="email" placeholder="you@example.com" required />
                </div>
                <div className="form-group">
                  <label>MoMo Number (Phone)</label>
                  <input name="phone" type="tel" placeholder="024XXXXXXX" required />
                </div>
                <div className="form-group">
                  <label>Password</label>
                  <input name="password" type="password" placeholder="••••••••" required />
                </div>
                <button type="submit" className="auth-btn" disabled={loading}>{loading ? 'Creating account…' : 'Sign Up'}</button>
              </form>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
