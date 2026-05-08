import { db } from './db.js';

document.addEventListener('DOMContentLoaded', async () => {
  // MUST initialise db before any other db call
  await db.init();

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
  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await db.logout();
    window.location.href = '/';
  });

  // Render Orders
  const ordersList = document.getElementById('ordersList');

  async function renderOrders() {
    // getUserOrders is async — must be awaited
    const orders = await db.getUserOrders(currentUser.id);

    if (!orders || orders.length === 0) {
      ordersList.innerHTML = '<p style="color:var(--gray-600);">You have no orders yet.</p>';
    } else {
      // Sort by date descending (newest first). IDs are strings like 'ORD-4821', not numbers.
      orders.sort((a, b) => new Date(b.date) - new Date(a.date));

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

        const statusLower = order.status.toLowerCase().replace(/\s+/g, '-');
        const canCancel = order.status === 'pending_payment' || order.status === 'Processing' || order.status === 'paid';

        return `
          <div class="order-card">
            <div class="order-header">
              <div>
                <div class="order-id">Order ${order.id}</div>
                <div class="order-date">${date}</div>
              </div>
              <div class="order-status ${statusLower}">${order.status}</div>
            </div>
            <div class="order-items">
              ${itemsHtml}
            </div>
            <div class="order-footer" style="display: flex; justify-content: space-between; align-items: center;">
              <div>Total: $${order.total}</div>
              ${canCancel ? `<button class="btn btn-outline btn-sm cancel-order-btn" data-order-id="${order.id}">Cancel Order</button>` : ''}
            </div>
          </div>
        `;
      }).join('');

      document.querySelectorAll('.cancel-order-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          if (confirm('Are you sure you want to request a cancellation for this order?')) {
            const orderId = e.target.dataset.orderId;
            await db.requestCancellation(orderId);
            await renderOrders();
          }
        });
      });
    }
  }

  await renderOrders();
});
