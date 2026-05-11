import { db } from './db.js';
import { supabase } from './supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
  await db.init();

  const tabLogin   = document.getElementById('tabLogin');
  const tabSignup  = document.getElementById('tabSignup');
  const formLogin  = document.getElementById('loginForm');
  const formSignup = document.getElementById('signupForm');
  const formForgot = document.getElementById('forgotForm');
  const formReset  = document.getElementById('resetForm');
  const alertBox   = document.getElementById('authAlert');

  const params      = new URLSearchParams(window.location.search);
  let   redirectUrl = params.get('redirect') || '/profile.html';

  // ── Alert helpers ──────────────────────────────────────────────
  function showAlert(msg, type = 'error') {
    alertBox.textContent = msg;
    alertBox.className = `auth-alert ${type}`;
  }
  function hideAlert() {
    alertBox.className = 'auth-alert hidden';
  }

  // ── View switcher ──────────────────────────────────────────────
  function showView(view) {
    // view: 'login' | 'signup' | 'forgot' | 'reset'
    formLogin.classList.remove('active');
    formSignup.classList.remove('active');
    formForgot.classList.remove('active');
    formReset.classList.remove('active');
    tabLogin.classList.remove('active');
    tabSignup.classList.remove('active');
    hideAlert();

    if (view === 'login')  { formLogin.classList.add('active');  tabLogin.classList.add('active'); }
    if (view === 'signup') { formSignup.classList.add('active'); tabSignup.classList.add('active'); }
    if (view === 'forgot') { formForgot.classList.add('active'); }
    if (view === 'reset')  { formReset.classList.add('active'); }
  }

  // ── Check for PASSWORD_RECOVERY event (user clicked email link) ─
  // Supabase fires this when the URL contains a recovery token.
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') {
      // Token has been consumed by the client — show the new password form
      showView('reset');
      showAlert('Enter your new password below.', 'success');
    }
  });

  // ── If already logged in, redirect away ───────────────────────
  const currentUser = db.getCurrentUser();
  if (currentUser) {
    if (params.get('checkout') === 'true' && params.get('redirect')) {
      window.location.href = params.get('redirect');
    } else {
      window.location.href = currentUser.role === 'admin' ? '/admin/index.html' : '/profile.html';
    }
    return;
  }

  // Show login prompt if redirected from checkout
  if (params.get('checkout') === 'true') {
    showAlert('Please log in or sign up to complete your purchase.', 'success');
  }

  // Default view
  showView('login');

  // ── Tab switching ──────────────────────────────────────────────
  tabLogin.addEventListener('click',  () => showView('login'));
  tabSignup.addEventListener('click', () => showView('signup'));

  // ── Forgot password link ───────────────────────────────────────
  document.getElementById('forgotPasswordLink')?.addEventListener('click', (e) => {
    e.preventDefault();
    showView('forgot');
    // Pre-fill email if user already typed it
    const typedEmail = document.getElementById('loginEmail').value.trim();
    if (typedEmail) document.getElementById('forgotEmail').value = typedEmail;
  });

  document.getElementById('backToLoginLink')?.addEventListener('click', (e) => {
    e.preventDefault();
    showView('login');
  });

  // ── Login submit ───────────────────────────────────────────────
  formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email    = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value.trim();
    const btn      = document.getElementById('loginSubmitBtn');

    btn.disabled = true;
    btn.textContent = 'Logging in…';
    showAlert('Logging in…', 'success');

    const res = await db.login(email, password);
    btn.disabled = false;
    btn.textContent = 'Log In';

    if (res.success) {
      if (res.user.role === 'admin') redirectUrl = '/admin/index.html';
      window.location.href = redirectUrl;
    } else {
      showAlert(res.message);
    }
  });

  // ── Signup submit ──────────────────────────────────────────────
  formSignup.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name     = document.getElementById('signupName').value.trim();
    const email    = document.getElementById('signupEmail').value.trim();
    const phone    = document.getElementById('signupPhone').value.trim();
    const password = document.getElementById('signupPassword').value.trim();
    const btn      = document.getElementById('signupForm').querySelector('button[type="submit"]');

    btn.disabled = true;
    btn.textContent = 'Creating account…';
    showAlert('Creating account…', 'success');

    const res = await db.signup(name, email, password, phone);
    btn.disabled = false;
    btn.textContent = 'Sign Up';

    if (res.success) {
      window.location.href = redirectUrl;
    } else {
      showAlert(res.message);
    }
  });

  // ── Forgot password submit (Step 1: send reset email) ─────────
  formForgot.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('forgotEmail').value.trim();
    const btn   = document.getElementById('forgotSubmitBtn');

    btn.disabled = true;
    btn.textContent = 'Sending…';
    showAlert('Sending reset link…', 'success');

    const res = await db.requestPasswordReset(email);
    btn.disabled = false;
    btn.textContent = 'Send Reset Link';

    if (res.success) {
      showAlert('✅ Check your email! A password reset link has been sent. It may take a minute to arrive.', 'success');
    } else {
      showAlert(res.message);
    }
  });

  // ── Reset password submit (Step 2: set new password) ──────────
  formReset.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newPass     = document.getElementById('newPassword').value;
    const confirmPass = document.getElementById('confirmPassword').value;
    const btn         = document.getElementById('resetSubmitBtn');

    if (newPass !== confirmPass) {
      showAlert('Passwords do not match. Please try again.');
      return;
    }
    if (newPass.length < 6) {
      showAlert('Password must be at least 6 characters.');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Updating…';
    showAlert('Updating password…', 'success');

    const res = await db.updatePassword(newPass);
    btn.disabled = false;
    btn.textContent = 'Update Password';

    if (res.success) {
      showAlert('✅ Password updated successfully! Redirecting to your profile…', 'success');
      // Sign out and redirect so session is clean
      setTimeout(async () => {
        await db.logout();
        window.location.href = '/auth.html';
      }, 2000);
    } else {
      showAlert(res.message);
    }
  });

});
