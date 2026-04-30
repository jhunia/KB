import { db } from './db.js';

document.addEventListener('DOMContentLoaded', () => {
  const tabLogin = document.getElementById('tabLogin');
  const tabSignup = document.getElementById('tabSignup');
  const formLogin = document.getElementById('loginForm');
  const formSignup = document.getElementById('signupForm');
  const alertBox = document.getElementById('authAlert');

  // URL Params handling
  const params = new URLSearchParams(window.location.search);
  let redirectUrl = params.get('redirect') || '/profile.html';
  
  // Show message if redirected from checkout
  if (params.get('checkout') === 'true') {
    showAlert('Please log in or sign up to complete your purchase.', 'success');
  }

  // Check if already logged in
  const currentUser = db.getCurrentUser();
  if (currentUser) {
    if (params.get('checkout') === 'true' && params.get('redirect')) {
      window.location.href = params.get('redirect');
    } else {
      window.location.href = currentUser.role === 'admin' ? '/admin/index.html' : '/profile.html';
    }
    return;
  }

  // --- Tabs Toggle ---
  tabLogin.addEventListener('click', () => {
    tabLogin.classList.add('active');
    tabSignup.classList.remove('active');
    formLogin.classList.add('active');
    formSignup.classList.remove('active');
    hideAlert();
  });

  tabSignup.addEventListener('click', () => {
    tabSignup.classList.add('active');
    tabLogin.classList.remove('active');
    formSignup.classList.add('active');
    formLogin.classList.remove('active');
    hideAlert();
  });

  // --- Alert Helper ---
  function showAlert(msg, type) {
    alertBox.textContent = msg;
    alertBox.className = `auth-alert ${type}`;
  }

  function hideAlert() {
    alertBox.className = 'auth-alert hidden';
  }

  // --- Login Submit ---
  formLogin.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value.trim();

    const res = db.login(email, password);
    if (res.success) {
      if (res.user.role === 'admin') redirectUrl = '/admin/index.html';
      window.location.href = redirectUrl;
    } else {
      showAlert(res.message, 'error');
    }
  });

  // --- Signup Submit ---
  formSignup.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('signupName').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const phone = document.getElementById('signupPhone').value.trim();
    const password = document.getElementById('signupPassword').value.trim();

    const res = db.signup(name, email, password, phone);
    if (res.success) {
      window.location.href = redirectUrl;
    } else {
      showAlert(res.message, 'error');
    }
  });

});
