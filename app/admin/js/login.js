import { db } from '../../js/db.js';

document.addEventListener('DOMContentLoaded', async () => {
  // MUST initialise db before any other db call
  await db.init();

  // Check if already logged in as admin
  const user = db.getCurrentUser();
  if (user && user.role === 'admin') {
    window.location.href = '/admin/index.html';
    return;
  }

  const form = document.getElementById('adminLoginForm');
  const errorMsg = document.getElementById('errorMsg');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorMsg.style.display = 'none';

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();

    errorMsg.textContent = 'Logging in…';
    errorMsg.style.display = 'block';
    const result = await db.login(email, password);

    if (result.success) {
      if (result.user.role === 'admin') {
        window.location.href = '/admin/index.html';
      } else {
        // Log them back out if they aren't an admin
        db.logout();
        errorMsg.textContent = 'Access Denied: Insufficient permissions.';
        errorMsg.style.display = 'block';
      }
    } else {
      errorMsg.textContent = result.message;
      errorMsg.style.display = 'block';
    }
  });
});
