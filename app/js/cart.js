import { db } from './db.js';
import { loadPaystackScript, initPaystackPayment } from './paystack.js';

let discountPercent = 0;
const DELIVERY_FEE = 15;
let currentOrder = null; // Store order during payment process

// ============================================
// Self-contained card renderer (cart.js context)
// ============================================
function renderStars(rating) {
  let html = '';
  for (let i = 1; i <= 5; i++) {
    html += i <= Math.floor(rating) ? '★' : (i - rating < 1 && i - rating > 0 ? '★' : '☆');
  }
  return html;
}

function createCardHTML(product) {
  const isInWishlist = db.isInWishlist(product.id);
  const outBadge = product.inStock === false
    ? '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(255,255,255,0.9);color:#000;padding:8px 16px;font-weight:700;border-radius:4px;z-index:2;font-size:14px;white-space:nowrap;">OUT OF STOCK</div>'
    : '';
  const imgStyle = product.inStock === false ? 'opacity:0.5;filter:grayscale(100%);' : '';

  return `
    <div class="product-card" data-product-id="${product.id}" style="cursor:pointer;">
      <div class="product-card-img" style="position:relative;">
        ${outBadge}
        <img src="${product.images[0]}" alt="${product.name}" loading="lazy" style="${imgStyle}" />
        <button class="wishlist-btn ${isInWishlist ? 'active' : ''}" data-product-id="${product.id}" aria-label="Add to wishlist" style="z-index:3;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="${isInWishlist ? '#FF3333' : 'none'}" stroke="${isInWishlist ? '#FF3333' : 'currentColor'}" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        </button>
      </div>
      <h3 class="product-card-title">${product.name}</h3>
      <div class="product-card-rating">
        <span class="stars">${renderStars(product.rating)}</span>
        <span class="rating-text">${product.rating}/5</span>
      </div>
      <div class="product-card-price">
        <span class="price-current">$${product.price}</span>
        ${product.originalPrice ? `<span class="price-original">$${product.originalPrice}</span>` : ''}
        ${product.discount ? `<span class="discount-badge">-${product.discount}%</span>` : ''}
      </div>
      ${product.inStock !== false ? `<button class="buy-now-btn" data-product-id="${product.id}" style="width:100%; margin-top:12px; padding:10px; background:var(--black); color:var(--white); border:none; border-radius:4px; font-weight:600; cursor:pointer; font-family:var(--font-body); transition: opacity 0.3s;" onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">Buy Now</button>` : ''}
    </div>
  `;
}

function initCartPage() {
  // Auto-apply any earned promo from post-purchase signup
  const earnedPromo = localStorage.getItem('kb_next_promo');
  if (earnedPromo === 'KBNEW10') {
    discountPercent = 10;
    localStorage.removeItem('kb_next_promo'); // Use once
  }

  renderCart();
  updateBadge();
  renderStillInterested();

  // Banner
  const banner = document.getElementById('topBanner');
  const bannerClose = document.getElementById('bannerClose');
  if (localStorage.getItem('kb_banner_closed') === 'true' && banner) banner.style.display = 'none';
  bannerClose?.addEventListener('click', () => { banner.style.display = 'none'; localStorage.setItem('kb_banner_closed', 'true'); });
}

function renderCart() {
  const layout = document.getElementById('cartLayout');
  if (!layout) return;

  const cart = db.getCart();

  if (cart.length === 0) {
    layout.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 100px 0;">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="1" style="margin-bottom:20px;"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>
        <h2 style="font-family:var(--font-display);font-size:24px;margin-bottom:16px;">Your cart is empty</h2>
        <a href="/category.html" class="btn btn-primary">Continue Shopping</a>
      </div>
    `;
    return;
  }

  const subtotal = db.getCartTotal();
  const discountAmount = Math.round(subtotal * (discountPercent / 100));
  const total = subtotal - discountAmount + DELIVERY_FEE;

  let itemsHTML = cart.map((item, index) => {
    const p = db.getProductById(item.productId);
    if (!p) return '';
    return `
      <div class="cart-item">
        <div class="cart-item-img"><img src="${p.images[0]}" alt="${p.name}"></div>
        <div class="cart-item-details">
          <div>
            <div class="cart-item-title-row">
              <div class="cart-item-title">${p.name}</div>
              <button class="cart-item-remove" data-index="${index}" aria-label="Remove item">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
              </button>
            </div>
            <div class="cart-item-meta">Size: ${item.size}</div>
            ${item.color ? `<div class="cart-item-meta">Color: <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${item.color};border:1px solid #ddd;vertical-align:middle;"></span></div>` : ''}
          </div>
          <div class="cart-item-bottom">
            <div class="cart-item-price">$${p.price}</div>
            <div class="qty-control">
              <button class="qty-btn" data-action="dec" data-index="${index}">−</button>
              <span>${item.quantity}</span>
              <button class="qty-btn" data-action="inc" data-index="${index}">+</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  layout.innerHTML = `
    <div class="cart-items-container">
      ${itemsHTML}
    </div>
    
    <div class="cart-summary">
      <h3>Order Summary</h3>
      <div class="summary-row">
        <span class="label">Subtotal</span>
        <span>$${subtotal}</span>
      </div>
      <div class="summary-row">
        <span class="label">Discount (-${discountPercent}%)</span>
        <span class="discount">-$${discountAmount}</span>
      </div>
      <div class="summary-row">
        <span class="label">Delivery Fee</span>
        <span>$${DELIVERY_FEE}</span>
      </div>
      <div class="summary-row total">
        <span class="label">Total</span>
        <span>$${total}</span>
      </div>

      <div class="promo-code-container">
        <input type="text" id="promoCode" placeholder="Add promo code" />
        <button id="applyPromoBtn">Apply</button>
      </div>

      <button class="checkout-btn" id="goCheckoutBtn">
        Proceed to Checkout
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
      </button>
    </div>

    <!-- Paystack Modal -->
    <div class="checkout-modal-overlay" id="checkoutModal">
      <div class="checkout-modal">
        <div class="modal-header">
          <h3>Checkout</h3>
          <button id="closeModal" style="font-size:24px;">✕</button>
        </div>
        <div class="paystack-badge" style="background:#00C853;color:#fff;padding:8px 16px;border-radius:4px;font-size:14px;font-weight:600;text-align:center;margin-bottom:16px;">
          🔒 Secure Payment with Paystack
        </div>
        <form id="checkoutForm">
          <div class="form-group">
            <label>Full Name</label>
            <input type="text" id="custName" required value="Test User" placeholder="Enter your full name">
          </div>
          <div class="form-group">
            <label>Email</label>
            <input type="email" id="custEmail" required value="test@kb.ent" placeholder="Enter your email">
          </div>
          <div class="form-group">
            <label>Phone Number</label>
            <input type="tel" id="custPhone" required value="0241234567" placeholder="e.g. 024xxxxxxx">
          </div>
          <div class="form-group">
            <label>Delivery Address</label>
            <input type="text" id="custAddress" required value="123 Test Street, Accra" placeholder="Enter your delivery address">
          </div>
          <button type="submit" class="checkout-btn" style="margin-top:24px;">
            Pay $${total} with Paystack
          </button>
        </form>
      </div>
    </div>
  `;

  bindCartEvents();
}

function bindCartEvents() {
  // Re-query layout here so all nested handlers (handlePaymentSuccess,
  // handlePaymentCancel) have a valid DOM reference regardless of scope.
  const layout = document.getElementById('cartLayout');

  // Quantities
  document.querySelectorAll('.qty-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index);
      const cart = db.getCart();
      const newQty = btn.dataset.action === 'inc' ? cart[idx].quantity + 1 : cart[idx].quantity - 1;
      db.updateCartQuantity(idx, newQty);
      renderCart();
      updateBadge();
    });
  });

  // Removes
  document.querySelectorAll('.cart-item-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index);
      db.removeFromCart(idx);
      renderCart();
      updateBadge();
    });
  });

  // Promo Code (Mock simply makes 'KBFIRST' work for 20% off)
  const applyBtn = document.getElementById('applyPromoBtn');
  const promoInput = document.getElementById('promoCode');
  const subtotal = db.getCartTotal(); // Re-eval to check minimum balance if we want.

  applyBtn?.addEventListener('click', () => {
    const code = promoInput.value.trim().toUpperCase();
    if (code === 'KBFIRST') {
      discountPercent = 20;
      renderCart();
      showToast('Promo code applied successfully!');
    } else if (code === 'KBNEW10') {
      discountPercent = 10;
      renderCart();
      showToast('Welcome offer code applied successfully!');
    } else {
      discountPercent = 0;
      showToast('Invalid promo code');
    }
  });


  // Checkout Modal — no auth required (guest checkout)
  const modal = document.getElementById('checkoutModal');
  document.getElementById('goCheckoutBtn')?.addEventListener('click', () => {
    // Pre-fill if logged in for convenience, otherwise leave blank for guest
    const user = db.getCurrentUser();
    if (user) {
      document.getElementById('custName').value = user.name || '';
      document.getElementById('custEmail').value = user.email || '';
      document.getElementById('custPhone').value = user.phone || '';
    }
    modal.classList.add('open');
  });

  document.getElementById('closeModal')?.addEventListener('click', () => {
    modal.classList.remove('open');
  });

  // Form Submit - DB-first approach: Create order, then Paystack payment
  document.getElementById('checkoutForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Create Order with pending_payment status
    const subtotal = db.getCartTotal();
    const discountAmount = Math.round(subtotal * (discountPercent / 100));
    const total = subtotal - discountAmount + DELIVERY_FEE;

    const order = {
      customer: {
        name: document.getElementById('custName').value,
        email: document.getElementById('custEmail').value,
        phone: document.getElementById('custPhone').value,
        address: document.getElementById('custAddress').value,
      },
      items: db.getCart(),
      subtotal: subtotal,
      discount: discountAmount,
      deliveryFee: DELIVERY_FEE,
      total: total,
      paymentMethod: 'paystack'
    };

    // Save order to DB with pending_payment status BEFORE opening Paystack.
    currentOrder = db.addOrder(order, 'pending_payment');

    // Close the checkout form modal
    modal.classList.remove('open');

    // Load Paystack inline.js if it isn't already on the page (with retry)
    try {
      await loadPaystackScript();
    } catch (err) {
      console.error('[Cart] Paystack script load failed:', err.message);
      alert('Failed to load payment gateway. Please check your connection and try again.');
      return;
    }

    // Open the Paystack popup
    initPaystackPayment(
      currentOrder,
      (response) => {
        // Only called after a confirmed successful charge or fallback simulation
        handlePaymentSuccess(currentOrder, response);
      },
      () => {
        // User closed the popup without paying — cart is still intact
        handlePaymentCancel(currentOrder);
      }
    );
  });

  // Handle successful payment
  function handlePaymentSuccess(order, response) {
    // Update order status to paid
    db.updateOrderStatus(order.id, 'paid');

    // NOW it is safe to clear the cart — payment is confirmed
    db.clearCart();
    updateBadge();
    
    const guestEmail = order.customer.email;
    const guestName = order.customer.name;
    const isGuest = !db.getCurrentUser();
    
    // Show success confirmation
    layout.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 60px 0 40px;">
        <!-- Success Icon -->
        <div style="width:72px;height:72px;border-radius:50%;background:#ECFDF5;display:inline-flex;align-items:center;justify-content:center;margin-bottom:24px;">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>
        </div>
        <h2 style="font-family:var(--font-display);font-size:32px;margin-bottom:12px;">Payment Successful! 🎉</h2>
        <p style="color:var(--gray-600);font-size:16px;max-width:480px;margin:0 auto 8px;">Thank you, <strong>${guestName}</strong>. Your payment has been received and your order is confirmed.</p>
        <p style="color:var(--gray-500);font-size:14px;margin-bottom:20px;">Order ID: <strong style="color:var(--black);">${order.id}</strong></p>
        <p style="color:var(--gray-500);font-size:14px;margin-bottom:40px;">Transaction Ref: <strong>${response.reference}</strong></p>

        ${isGuest ? `
        <!-- Post-purchase sign-up prompt for guests -->
        <div id="postPurchaseSignup" style="max-width:460px;margin:0 auto 40px;border:2px solid #000;border-radius:16px;padding:32px;text-align:left;position:relative;overflow:hidden;">
          <div style="position:absolute;top:0;right:0;background:#000;color:#fff;font-size:11px;font-weight:700;padding:6px 16px;border-radius:0 0 0 12px;letter-spacing:0.5px;">SPECIAL OFFER</div>
          <div style="font-size:28px;margin-bottom:8px;">🎁</div>
          <h3 style="font-family:var(--font-display);font-size:20px;font-weight:700;margin-bottom:8px;">Get 10% off your next order</h3>
          <p style="color:var(--gray-600);font-size:14px;margin-bottom:20px;line-height:1.6;">Create a free KB.ENT account and unlock exclusive discounts, track your orders, and save your wishlist forever.</p>
          <form id="postSignupForm">
            <div style="display:flex;flex-direction:column;gap:12px;">
              <input type="text" id="postSignupName" value="${guestName}" placeholder="Full name" required
                style="padding:12px 16px;border:1px solid #ddd;border-radius:8px;font-size:14px;width:100%;box-sizing:border-box;">
              <input type="email" id="postSignupEmail" value="${guestEmail}" placeholder="Email address" required
                style="padding:12px 16px;border:1px solid #ddd;border-radius:8px;font-size:14px;width:100%;box-sizing:border-box;">
              <input type="password" id="postSignupPass" placeholder="Create a password" required minlength="6"
                style="padding:12px 16px;border:1px solid #ddd;border-radius:8px;font-size:14px;width:100%;box-sizing:border-box;">
              <button type="submit"
                style="padding:14px;background:#000;color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;">Create Account &amp; Claim 10% Off</button>
            </div>
          </form>
          <button id="skipSignup" style="display:block;width:100%;margin-top:12px;padding:10px;background:transparent;border:none;font-size:13px;color:var(--gray-500);cursor:pointer;text-decoration:underline;">No thanks, continue as guest</button>
        </div>
        ` : ''}

        <a href="/" class="btn btn-primary" style="display:inline-block;">Continue Shopping</a>
      </div>
    `;
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Bind post-purchase sign-up form
    if (isGuest) {
      document.getElementById('postSignupForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const name  = document.getElementById('postSignupName').value.trim();
        const email = document.getElementById('postSignupEmail').value.trim();
        const pass  = document.getElementById('postSignupPass').value;
        const result = db.signup(name, email, pass, order.customer.phone);

        if (result.success) {
          // Save the 10% promo for their next visit
          localStorage.setItem('kb_next_promo', 'KBNEW10');
          document.getElementById('postPurchaseSignup').innerHTML = `
            <div style="text-align:center;padding:20px 0;">
              <div style="font-size:40px;margin-bottom:12px;">✅</div>
              <h3 style="font-family:var(--font-display);font-size:20px;margin-bottom:8px;">Welcome to KB.ENT, ${name}!</h3>
              <p style="color:var(--gray-600);font-size:14px;">Your account is live. Use code <strong style="background:#000;color:#fff;padding:2px 10px;border-radius:4px;letter-spacing:1px;">KBNEW10</strong> on your next order for 10% off.</p>
            </div>
          `;
        } else {
          alert(result.message);
        }
      });

      document.getElementById('skipSignup')?.addEventListener('click', () => {
        document.getElementById('postPurchaseSignup').style.display = 'none';
      });
    }
  }

  // Handle payment cancellation
  function handlePaymentCancel(order) {
    // Order remains in pending_payment status
    // User can retry or it will be handled separately
    layout.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 60px 0 40px;">
        <div style="width:72px;height:72px;border-radius:50%;background:#FEF3C7;display:inline-flex;align-items:center;justify-content:center;margin-bottom:24px;">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2.5"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
        </div>
        <h2 style="font-family:var(--font-display);font-size:32px;margin-bottom:12px;">Payment Incomplete</h2>
        <p style="color:var(--gray-600);font-size:16px;max-width:480px;margin:0 auto 8px;">Your order <strong>${order.id}</strong> has been saved but payment was not completed.</p>
        <p style="color:var(--gray-500);font-size:14px;margin-bottom:40px;">You can retry payment from your order history or contact support.</p>
        <a href="/" class="btn btn-primary" style="display:inline-block;">Continue Shopping</a>
      </div>
    `;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function updateBadge() {
  const badge = document.getElementById('cartPageBadge');
  if (!badge) return;
  const count = db.getCartCount();
  badge.textContent = count;
  badge.classList.toggle('hidden', count === 0);
}

function showToast(message) {
  let toast = document.getElementById('toastNotification');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toastNotification';
    toast.className = 'toast';
    // Base styles inside js for simplicity, or we can reuse product.css style
    toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(100px);background:var(--black);color:var(--white);padding:16px 32px;border-radius:var(--radius-full);font-size:14px;font-weight:500;z-index:10000;opacity:0;transition:all 0.3s ease;box-shadow:var(--shadow-lg);';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  // forced reflow
  void toast.offsetWidth;
  toast.style.transform = 'translateX(-50%) translateY(0)';
  toast.style.opacity = '1';
  setTimeout(() => {
    toast.style.transform = 'translateX(-50%) translateY(100px)';
    toast.style.opacity = '0';
  }, 3000);
}

document.addEventListener('DOMContentLoaded', initCartPage);

// Render Still Interested Section
function renderStillInterested() {
  const container = document.getElementById('stillInterestedGrid');
  const section = document.getElementById('stillInterestedSection');
  if (!container || !section) return;

  const wishlist = db.getWishlist();
  if (!wishlist || wishlist.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';
  container.innerHTML = '';

  // Render up to 4 wishlisted items
  wishlist.slice(0, 4).forEach(itemId => {
    const p = db.getProductById(itemId);
    if (p) container.innerHTML += createCardHTML(p);
  });

  // Wishlist toggle
  container.querySelectorAll('.wishlist-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = parseInt(btn.dataset.productId);
      db.toggleWishlist(id);
      renderStillInterested(); // re-render to remove unfav'd items
    });
  });

  // Navigate to product
  container.querySelectorAll('.product-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.wishlist-btn') || e.target.closest('.buy-now-btn')) return;
      window.location.href = `/product.html?id=${card.dataset.productId}`;
    });
  });

  // Buy Now toggle
  container.querySelectorAll('.buy-now-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = parseInt(btn.dataset.productId);
      const product = db.getProductById(id);
      if (product && product.inStock !== false) {
        // Find first available size
        const size = product.sizes && product.sizes.length > 0 ? product.sizes[0] : 'Medium';
        // Find first available color.
        // product.colors is an array of plain hex strings e.g. ["#000000", "#FFFFFF"]
        let color = null;
        if (product.colors && product.colors.length > 0) {
          const availableColors = product.colors.filter(c =>
            !product.colorStock || product.colorStock[c] !== false
          );
          color = availableColors.length > 0 ? availableColors[0] : product.colors[0];
        }
        
        db.addToCart(id, size, color, 1);
        if (db.isInWishlist(id)) {
          db.toggleWishlist(id);
          renderStillInterested();
        }
        showToast(`${product.name} added to cart`);
        renderCart();
        updateBadge();
      }
    });
  });
}
