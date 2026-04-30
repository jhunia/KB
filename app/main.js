import { db } from './js/db.js';

// ============================================
// UTILITY: Generate Star HTML
// ============================================
function renderStars(rating) {
  let html = '';
  for (let i = 1; i <= 5; i++) {
    if (i <= Math.floor(rating)) {
      html += '★';
    } else if (i - rating < 1 && i - rating > 0) {
      html += '★';
    } else {
      html += '☆';
    }
  }
  return html;
}

// ============================================
// PRODUCT CARD COMPONENT (shared globally)
// ============================================
window.renderStars = renderStars;

window.createProductCardHTML = function(product) {
  const isInWishlist = db.isInWishlist(product.id);
  const outOfStockLabel = product.inStock === false ? '<div class="out-of-stock-badge" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(255,255,255,0.9);color:#000;padding:8px 16px;font-weight:700;border-radius:4px;z-index:2;letter-spacing:1px;font-size:14px;white-space:nowrap;">OUT OF STOCK</div>' : '';
  const imgStyle = product.inStock === false ? 'opacity: 0.5; filter: grayscale(100%);' : '';

  return `
    <div class="product-card" data-product-id="${product.id}">
      <div class="product-card-img" style="position:relative;">
        ${outOfStockLabel}
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
    </div>
  `;
}

function bindProductCardEvents(container) {
  container.querySelectorAll('.product-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.wishlist-btn')) return;
      window.location.href = `/product.html?id=${card.dataset.productId}`;
    });
  });

  container.querySelectorAll('.wishlist-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = parseInt(btn.dataset.productId);
      db.toggleWishlist(id);
      const isNowWished = db.isInWishlist(id);
      btn.classList.toggle('active', isNowWished);
      const svg = btn.querySelector('svg path');
      if (svg) {
        svg.setAttribute('fill', isNowWished ? '#FF3333' : 'none');
        svg.setAttribute('stroke', isNowWished ? '#FF3333' : 'currentColor');
      }
    });
  });
}

// ============================================
// RENDER PRODUCT GRIDS
// ============================================
function renderProductGrid(containerId, products) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = products.map(p => window.createProductCardHTML(p)).join('');
  bindProductCardEvents(container);
}

// ============================================
// CAROUSEL LOGIC — Auto-slide with dots
// ============================================
function initHomePageCarousels() {
  const CARD_WIDTH = 276; // 260px card + 16px gap
  const AUTO_INTERVAL = 3000; // ms between slides

  const setupCarousel = (gridId, dotsContainerId) => {
    const grid = document.getElementById(gridId);
    const dotsEl = document.getElementById(dotsContainerId);
    if (!grid || !dotsEl) return;

    const wrapper = grid.parentElement; // .carousel-wrapper
    const totalCards = grid.children.length;
    if (totalCards === 0) return;

    let currentIndex = 0;

    // Build dots
    dotsEl.innerHTML = '';
    for (let i = 0; i < totalCards; i++) {
      const dot = document.createElement('span');
      dot.style.cssText = `display:inline-block; width:${i===0?'20px':'8px'}; height:8px; border-radius:${i===0?'4px':'50%'}; background:${i===0?'#000':'#ccc'}; cursor:pointer; transition:all 0.3s ease;`;
      dot.dataset.index = i;
      dot.addEventListener('click', () => goTo(i));
      dotsEl.appendChild(dot);
    }

    function updateDots(idx) {
      dotsEl.querySelectorAll('span').forEach((d, i) => {
        const active = i === idx;
        d.style.width = active ? '20px' : '8px';
        d.style.borderRadius = active ? '4px' : '50%';
        d.style.background = active ? '#000' : '#ccc';
      });
    }

    function goTo(idx) {
      currentIndex = idx;
      wrapper.scrollTo({ left: CARD_WIDTH * idx, behavior: 'smooth' });
      updateDots(idx);
    }

    // Auto advance
    let timer = setInterval(() => {
      const next = (currentIndex + 1) % totalCards;
      goTo(next);
    }, AUTO_INTERVAL);

    // Pause on hover
    wrapper.addEventListener('mouseenter', () => clearInterval(timer));
    wrapper.addEventListener('mouseleave', () => {
      timer = setInterval(() => {
        const next = (currentIndex + 1) % totalCards;
        goTo(next);
      }, AUTO_INTERVAL);
    });

    // Sync dots on manual scroll
    wrapper.addEventListener('scroll', () => {
      const idx = Math.round(wrapper.scrollLeft / CARD_WIDTH);
      if (idx !== currentIndex) {
        currentIndex = idx;
        updateDots(idx);
      }
    }, { passive: true });
  };

  // Wait for grids to be populated first
  setTimeout(() => {
    setupCarousel('newArrivalsGrid', 'newArrDots');
    setupCarousel('topSellingGrid', 'topSellDots');
  }, 50);
}

// ============================================
// TESTIMONIALS
// ============================================
function renderTestimonials() {
  const track = document.getElementById('testimonialsTrack');
  if (!track) return;
  const testimonials = db.getTestimonials();
  track.innerHTML = testimonials.map(t => `
    <div class="testimonial-card">
      <div class="testimonial-stars">${renderStars(t.rating)}</div>
      <div class="testimonial-name">${t.name} ${t.verified ? '<span class="verified-badge">✓</span>' : ''}</div>
      <p class="testimonial-text">${t.text}</p>
    </div>
  `).join('');

  let offset = 0;
  const cardWidth = 420;
  document.getElementById('testimonialNext')?.addEventListener('click', () => {
    const max = Math.max(0, track.scrollWidth - track.parentElement.offsetWidth);
    offset = Math.min(offset + cardWidth, max);
    track.style.transform = `translateX(-${offset}px)`;
  });
  document.getElementById('testimonialPrev')?.addEventListener('click', () => {
    offset = Math.max(offset - cardWidth, 0);
    track.style.transform = `translateX(-${offset}px)`;
  });
}

// ============================================
// CART DRAWER
// ============================================
function initCartDrawer() {
  const toggle = document.getElementById('cartToggle');
  const drawer = document.getElementById('cartDrawer');
  const overlay = document.getElementById('cartOverlay');
  const close = document.getElementById('cartDrawerClose');
  if (!toggle || !drawer) return;

  const open = () => {
    drawer.classList.add('open');
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    renderCartDrawer();
  };
  const shut = () => {
    drawer.classList.remove('open');
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  };
  toggle.addEventListener('click', open);
  overlay?.addEventListener('click', shut);
  close?.addEventListener('click', shut);
}

function renderCartDrawer() {
  const container = document.getElementById('cartDrawerItems');
  const footer = document.getElementById('cartDrawerFooter');
  const totalEl = document.getElementById('cartDrawerTotal');
  const cart = db.getCart();

  if (cart.length === 0) {
    container.innerHTML = `
      <div class="cart-drawer-empty">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>
        <p>Your cart is empty</p>
        <a href="/category.html" class="btn btn-primary btn-sm" style="margin-top:16px;">Start Shopping</a>
      </div>`;
    footer.style.display = 'none';
    return;
  }

  footer.style.display = '';
  container.innerHTML = cart.map((item, i) => {
    const p = db.getProductById(item.productId);
    if (!p) return '';
    return `
      <div class="cart-drawer-item">
        <div class="cart-drawer-item-img"><img src="${p.images[0]}" alt="${p.name}" /></div>
        <div class="cart-drawer-item-info">
          <div class="cart-drawer-item-name">${p.name}</div>
          <div class="cart-drawer-item-meta">Size: ${item.size}${item.color ? ' · ' + item.color : ''}</div>
          <div class="cart-drawer-item-bottom">
            <span class="cart-drawer-item-price">$${p.price * item.quantity}</span>
            <div class="qty-control">
              <button data-action="dec" data-index="${i}">−</button>
              <span>${item.quantity}</span>
              <button data-action="inc" data-index="${i}">+</button>
            </div>
          </div>
        </div>
      </div>`;
  }).join('');
  totalEl.textContent = `$${db.getCartTotal()}`;

  container.querySelectorAll('.qty-control button').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index);
      const act = btn.dataset.action;
      const c = db.getCart();
      db.updateCartQuantity(idx, act === 'inc' ? c[idx].quantity + 1 : c[idx].quantity - 1);
      renderCartDrawer();
      updateCartBadge();
    });
  });
}

// ============================================
// CART BADGE
// ============================================
function updateCartBadge() {
  const badge = document.getElementById('cartBadge');
  if (!badge) return;
  const count = db.getCartCount();
  badge.textContent = count;
  badge.classList.toggle('hidden', count === 0);
}
window.updateCartBadge = updateCartBadge;

// ============================================
// TOP BANNER DISMISS
// ============================================
function initBanner() {
  const banner = document.getElementById('topBanner');
  const closeBtn = document.getElementById('bannerClose');
  if (!banner || !closeBtn) return;
  if (localStorage.getItem('kb_banner_closed') === 'true') {
    banner.style.display = 'none';
    return;
  }
  closeBtn.addEventListener('click', () => {
    banner.style.display = 'none';
    localStorage.setItem('kb_banner_closed', 'true');
  });
}

// ============================================
// INIT
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  initBanner();

  // Homepage grids
  renderProductGrid('newArrivalsGrid', db.getProductsByTag('new'));
  renderProductGrid('topSellingGrid', db.getProductsByTag('top'));
  renderTestimonials();

  initCartDrawer();
  updateCartBadge();
  initHomePageCarousels();
});
