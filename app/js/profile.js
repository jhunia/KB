import { db } from './db.js';

document.addEventListener('DOMContentLoaded', () => {
  const currentUser = db.getCurrentUser();
  if (!currentUser) {
    window.location.href = '/auth.html';
    return;
  }

  // Populate Header
  document.getElementById('profileName').textContent = currentUser.name;
  document.getElementById('profileEmail').textContent = currentUser.email;
  
  const initials = currentUser.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  document.getElementById('profileInitials').textContent = initials;

  // Logout
  document.getElementById('logoutBtn').addEventListener('click', () => {
    db.logout();
    window.location.href = '/';
  });

  // Render Orders
  const ordersList = document.getElementById('ordersList');
  const orders = db.getUserOrders(currentUser.id);

  if (!orders || orders.length === 0) {
    ordersList.innerHTML = '<p style="color:var(--gray-600);">You have no orders yet.</p>';
  } else {
    // Sort orders by id descending (newest first)
    orders.sort((a, b) => b.id - a.id);

    ordersList.innerHTML = orders.map(order => {
      const date = new Date(order.date).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
      });

      const itemsHtml = order.items.map(item => {
        const product = db.getProductById(item.productId);
        if (!product) return '';
        return `
          <div class="order-item">
            <img src="${product.images[0]}" alt="${product.name}" class="order-item-img" />
            <div class="order-item-info">
              <div class="order-item-name">${product.name}</div>
              <div class="order-item-meta">Size: ${item.size} | Color: ${item.color} | Qty: ${item.quantity}</div>
            </div>
            <div style="font-weight: 600;">$${product.price * item.quantity}</div>
          </div>
        `;
      }).join('');

      return `
        <div class="order-card">
          <div class="order-header">
            <div>
              <div class="order-id">Order #${1000 + order.id}</div>
              <div class="order-date">${date}</div>
            </div>
            <div class="order-status ${order.status.toLowerCase()}">${order.status}</div>
          </div>
          <div class="order-items">
            ${itemsHtml}
          </div>
          <div class="order-footer">
            Total: $${order.total}
          </div>
        </div>
      `;
    }).join('');
  }
});
