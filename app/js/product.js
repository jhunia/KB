import { db } from './db.js';

// ============================================
// State
// ============================================
let currentProduct = null;
let selectedColor = null;
let selectedSize = null;
let quantity = 1;

// ============================================
// Stars utility (shared function simulation)
// ============================================
function renderStars(rating) {
  let html = '';
  for (let i = 1; i <= 5; i++) {
    html += i <= Math.floor(rating) ? '★' : (i - rating < 1 && i - rating > 0 ? '★' : '☆');
  }
  return html;
}

window.createProductCardHTML = function(product) {
  const isInWishlist = db.isInWishlist(product.id);
  const outOfStockLabel = product.inStock === false ? '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(255,255,255,0.9);color:#000;padding:8px 16px;font-weight:700;border-radius:4px;z-index:2;letter-spacing:1px;font-size:14px;white-space:nowrap;">OUT OF STOCK</div>' : '';
  const imgStyle = product.inStock === false ? 'opacity: 0.5; filter: grayscale(100%);' : '';

  return `
    <div class="product-card" data-product-id="${product.id}" style="cursor:pointer;">
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

// ============================================
// Initialization
// ============================================
function initProductPage() {
  const params = new URLSearchParams(window.location.search);
  const idStr = params.get('id');
  const id = idStr ? parseInt(idStr) : 1; // Default to product 1 if no ID

  currentProduct = db.getProductById(id);

  if (!currentProduct) {
    document.getElementById('productDetail').innerHTML = '<h2>Product not found</h2>';
    return;
  }

  // Set default selections
  if (currentProduct.colors && currentProduct.colors.length > 0) {
    selectedColor = currentProduct.colors[0];
  }
  if (currentProduct.sizes && currentProduct.sizes.length > 0) {
    selectedSize = currentProduct.sizes[0];
  }

  renderProductInfo();
  renderReviews();
  renderCompleteYourFit();
  renderExplore();
  initCartDrawer();
  updateBadge();
}

// ============================================
// Render Main Product Info
// ============================================
function renderProductInfo() {
  const container = document.getElementById('productDetail');

  // Breadcrumb
  document.getElementById('breadcrumbProduct').textContent = currentProduct.name;

  // Gallery Thumbs
  let thumbsHTML = currentProduct.images.map((img, i) => `
    <div class="gallery-thumb ${i === 0 ? 'active' : ''}" data-index="${i}">
      <img src="${img}" alt="Thumbnail ${i+1}">
    </div>
  `).join('');

  // Main Image
  const mainImageHTML = `<img src="${currentProduct.images[0]}" alt="${currentProduct.name}" id="mainImage">`;

  // Colors
  let colorsHTML = '';
  if (currentProduct.colors && currentProduct.colors.length > 0) {
    colorsHTML = `
      <div class="option-label">Select Colors</div>
      <div class="color-swatches">
        ${currentProduct.colors.map(c => `
          <div class="color-swatch ${c === selectedColor ? 'active' : ''}" style="background-color: ${c}; border: 1px solid #ddd;" data-color="${c}"></div>
        `).join('')}
      </div>
      <hr class="section-divider" style="margin-bottom: 24px;" />
    `;
  }

  // Sizes
  let sizesHTML = '';
  if (currentProduct.sizes && currentProduct.sizes.length > 0) {
    sizesHTML = `
      <div class="option-label">Choose Size</div>
      <div class="size-options">
        ${currentProduct.sizes.map(s => `
          <button class="size-option ${s === selectedSize ? 'active' : ''}" data-size="${s}">${s}</button>
        `).join('')}
      </div>
    `;
  }

  container.innerHTML = `
    <!-- Gallery -->
    <div class="product-gallery">
      <div class="gallery-thumbs" id="galleryThumbs">
        ${thumbsHTML}
      </div>
      <div class="gallery-main" id="galleryMain">
        ${mainImageHTML}
        <!-- Mobile dot indicators -->
        <div class="gallery-dots" id="galleryDots">
          ${currentProduct.images.map((_, i) => `<span class="gallery-dot ${i === 0 ? 'active' : ''}" data-index="${i}"></span>`).join('')}
        </div>
        <!-- Mobile fav button -->
        <button class="mobile-wishlist-btn ${db.isInWishlist(currentProduct.id) ? 'active' : ''}" id="mobileWishlistBtn" aria-label="Add to wishlist">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="${db.isInWishlist(currentProduct.id) ? '#FF3333' : 'none'}" stroke="${db.isInWishlist(currentProduct.id) ? '#FF3333' : 'currentColor'}" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        </button>
      </div>
    </div>

    <!-- Info -->
    <div class="product-info">
      <h1 class="product-title">${currentProduct.name}</h1>
      <div class="product-rating">
        <span class="stars">${renderStars(currentProduct.rating)}</span>
        <span class="rating-text">${currentProduct.rating}/5  <span style="color:#999; margin-left:8px;">(${currentProduct.reviews} reviews)</span></span>
      </div>
      <div class="product-price-row">
        <span class="product-price">$${currentProduct.price}</span>
        ${currentProduct.originalPrice ? `<span class="product-original-price">$${currentProduct.originalPrice}</span>` : ''}
        ${currentProduct.discount ? `<span class="product-discount-badge">-${currentProduct.discount}%</span>` : ''}
      </div>
      <p class="product-desc">${currentProduct.description}</p>
      
      ${colorsHTML}
      ${sizesHTML}

      <div class="product-actions">
        <div class="qty-selector" style="${currentProduct.inStock === false ? 'opacity:0.5;pointer-events:none;' : ''}">
          <button id="qtyDec">−</button>
          <span class="qty-value" id="qtyVal">${quantity}</span>
          <button id="qtyInc">+</button>
        </div>
        <div class="product-cta-buttons">
          <button class="add-to-cart-btn" id="addToCartBtn" ${currentProduct.inStock === false ? 'disabled style="background:#ccc;cursor:not-allowed;"' : ''}>
            ${currentProduct.inStock === false ? 'Out of Stock' : 'Add to Cart'}
          </button>
          ${currentProduct.inStock !== false ? `<button class="buy-now-btn" id="buyNowBtn">Buy Now</button>` : ''}
        </div>
      </div>
    </div>
  `;

  // Gallery thumbs + mobile swipe dots
  const thumbs = document.querySelectorAll('.gallery-thumb');
  const mainImage = document.getElementById('mainImage');
  const dots = document.querySelectorAll('.gallery-dot');

  function setActiveImage(idx) {
    mainImage.src = currentProduct.images[idx];
    thumbs.forEach(t => t.classList.remove('active'));
    if (thumbs[idx]) thumbs[idx].classList.add('active');
    dots.forEach(d => d.classList.remove('active'));
    if (dots[idx]) dots[idx].classList.add('active');
  }

  thumbs.forEach(thumb => {
    thumb.addEventListener('click', () => setActiveImage(parseInt(thumb.dataset.index)));
  });

  dots.forEach(dot => {
    dot.addEventListener('click', () => setActiveImage(parseInt(dot.dataset.index)));
  });

  // Mobile gallery swipe support
  let touchStartX = 0;
  const galleryMain = document.getElementById('galleryMain');
  if (galleryMain) {
    galleryMain.addEventListener('touchstart', (e) => { touchStartX = e.touches[0].clientX; }, { passive: true });
    galleryMain.addEventListener('touchend', (e) => {
      const diff = touchStartX - e.changedTouches[0].clientX;
      const currentIdx = [...dots].findIndex(d => d.classList.contains('active'));
      if (Math.abs(diff) > 40) {
        const next = diff > 0
          ? Math.min(currentIdx + 1, currentProduct.images.length - 1)
          : Math.max(currentIdx - 1, 0);
        setActiveImage(next);
      }
    }, { passive: true });
  }

  // Mobile wishlist
  const mobileWishBtn = document.getElementById('mobileWishlistBtn');
  if (mobileWishBtn) {
    mobileWishBtn.addEventListener('click', () => {
      db.toggleWishlist(currentProduct.id);
      const isNow = db.isInWishlist(currentProduct.id);
      mobileWishBtn.classList.toggle('active', isNow);
      mobileWishBtn.querySelector('svg').setAttribute('fill', isNow ? '#FF3333' : 'none');
      mobileWishBtn.querySelector('svg').setAttribute('stroke', isNow ? '#FF3333' : 'currentColor');
    });
  }

  // Colors
  const swatches = document.querySelectorAll('.color-swatch');
  swatches.forEach(swatch => {
    swatch.addEventListener('click', () => {
      swatches.forEach(s => s.classList.remove('active'));
      swatch.classList.add('active');
      selectedColor = swatch.dataset.color;
    });
  });

  // Sizes
  const sizeBtns = document.querySelectorAll('.size-option');
  sizeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      sizeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedSize = btn.dataset.size;
    });
  });

  // Quantity
  document.getElementById('qtyDec').addEventListener('click', () => {
    if (quantity > 1) {
      quantity--;
      document.getElementById('qtyVal').textContent = quantity;
    }
  });

  document.getElementById('qtyInc').addEventListener('click', () => {
    quantity++;
    document.getElementById('qtyVal').textContent = quantity;
  });

  // Add to Cart
  document.getElementById('addToCartBtn').addEventListener('click', () => {
    db.addToCart(currentProduct.id, selectedSize, selectedColor, quantity);
    showToast('Item added to your cart successfully');
    document.getElementById('cartDrawer').classList.add('open');
    document.getElementById('cartOverlay').classList.add('open');
    document.body.style.overflow = 'hidden';
    renderCartDrawerSpecific();
    updateBadge();
  });

  // Buy Now — add to cart then go to checkout
  const buyNowBtn = document.getElementById('buyNowBtn');
  if (buyNowBtn) {
    buyNowBtn.addEventListener('click', () => {
      db.addToCart(currentProduct.id, selectedSize, selectedColor, quantity);
      window.location.href = '/cart.html';
    });
  }
}

function showToast(message) {
  let toast = document.getElementById('toastNotification');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toastNotification';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// ============================================
// Render Reviews
// ============================================
function renderReviews() {
  const container = document.getElementById('reviewsSection');
  const reviews = db.getReviews(currentProduct.id);

  container.innerHTML = `
    <div class="reviews-header">
      <div class="reviews-tab">Product Reviews</div>
    </div>
    <div class="reviews-top-bar">
      <div class="reviews-count">All Reviews <span style="color:#999;font-weight:400;font-size:16px;">(${reviews.length})</span></div>
      <div class="reviews-actions">
        <button class="review-filter-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
          Latest
        </button>
        <button class="write-review-btn">Write a Review</button>
      </div>
    </div>
    <div class="reviews-grid">
      ${reviews.map(r => `
        <div class="review-card">
          <div class="review-stars">${renderStars(r.rating)}</div>
          <div class="review-author">${r.user} ${r.verified ? '<span class="verified-badge" style="display:inline-flex;width:16px;height:16px;border-radius:50%;background:#10B981;color:white;font-size:10px;align-items:center;justify-content:center;">✓</span>' : ''}</div>
          <p class="review-text">${r.text}</p>
          <div class="review-date">Posted on ${r.date}</div>
        </div>
      `).join('')}
    </div>
    ${reviews.length === 0 ? '<div style="text-align:center;padding:40px 0;color:#666;">No reviews yet.</div>' : ''}
  `;

  const writeReviewBtn = container.querySelector('.write-review-btn');
  if (writeReviewBtn) {
    writeReviewBtn.addEventListener('click', () => {
      const user = db.getCurrentUser();
      if (!user) {
        window.location.href = `/auth.html?redirect=/product.html?id=${currentProduct.id}&review=true`;
      } else {
        showToast("Review modal is under construction!");
      }
    });
  }
}

// ============================================
// Render Related Sections
// ============================================
function renderCompleteYourFit() {
  const container = document.getElementById('completeYourFit');
  const products = db.getComplementaryProducts(currentProduct.id);
  if (products.length === 0) {
    document.getElementById('completeYourFit').parentElement.parentElement.style.display = 'none';
    return;
  }
  container.innerHTML = products.map(window.createProductCardHTML).join('');
  bindCardEvents(container);
}

function renderExplore() {
  const container = document.getElementById('exploreGrid');
  const products = db.getExploreProducts(currentProduct.id);
  if (products.length === 0) {
    document.getElementById('exploreGrid').parentElement.parentElement.parentElement.style.display = 'none';
    return;
  }
  container.innerHTML = products.map(window.createProductCardHTML).join('');
  bindCardEvents(container);
}

function bindCardEvents(container) {
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
      const isNow = db.isInWishlist(id);
      btn.classList.toggle('active', isNow);
      const svg = btn.querySelector('svg path');
      if (svg) {
        svg.setAttribute('fill', isNow ? '#FF3333' : 'none');
        svg.setAttribute('stroke', isNow ? '#FF3333' : 'currentColor');
      }
    });
  });
}

// ============================================
// Cart Drawer Implementation
// ============================================
function initCartDrawer() {
  const toggle = document.getElementById('cartToggle');
  const drawer = document.getElementById('cartDrawer');
  const overlay = document.getElementById('cartOverlay');
  const close = document.getElementById('cartDrawerClose');
  if (!toggle || !drawer) return;
  const open = () => { drawer.classList.add('open'); overlay.classList.add('open'); document.body.style.overflow = 'hidden'; renderCartDrawerSpecific(); };
  const shut = () => { drawer.classList.remove('open'); overlay.classList.remove('open'); document.body.style.overflow = ''; };
  toggle.addEventListener('click', open);
  overlay?.addEventListener('click', shut);
  close?.addEventListener('click', shut);
}

function renderCartDrawerSpecific() {
  const container = document.getElementById('cartDrawerItems');
  const footer = document.getElementById('cartDrawerFooter');
  const totalEl = document.getElementById('cartDrawerTotal');
  const cart = db.getCart();
  if (cart.length === 0) {
    container.innerHTML = '<div class="cart-drawer-empty"><p>Your cart is empty</p></div>';
    footer.style.display = 'none';
    return;
  }
  footer.style.display = '';
  container.innerHTML = cart.map((item, i) => {
    const p = db.getProductById(item.productId);
    if (!p) return '';
    return `<div class="cart-drawer-item"><div class="cart-drawer-item-img"><img src="${p.images[0]}" alt="${p.name}" /></div><div class="cart-drawer-item-info"><div class="cart-drawer-item-name">${p.name}</div><div class="cart-drawer-item-meta">Size: ${item.size} ${item.color ? '· Color' : ''}</div><div class="cart-drawer-item-bottom"><span class="cart-drawer-item-price">$${p.price * item.quantity}</span><div class="qty-control"><button data-action="dec" data-index="${i}">−</button><span>${item.quantity}</span><button data-action="inc" data-index="${i}">+</button></div></div></div></div>`;
  }).join('');
  totalEl.textContent = `$${db.getCartTotal()}`;
  container.querySelectorAll('.qty-control button').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index);
      const c = db.getCart();
      db.updateCartQuantity(idx, btn.dataset.action === 'inc' ? c[idx].quantity + 1 : c[idx].quantity - 1);
      renderCartDrawerSpecific();
      updateBadge();
    });
  });
}

function updateBadge() {
  const badge = document.getElementById('cartBadge');
  if (!badge) return;
  const count = db.getCartCount();
  badge.textContent = count;
  badge.classList.toggle('hidden', count === 0);
}

// ============================================
// On Load
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  initProductPage();

  // Banner
  const banner = document.getElementById('topBanner');
  const bannerClose = document.getElementById('bannerClose');
  if (localStorage.getItem('kb_banner_closed') === 'true' && banner) banner.style.display = 'none';
  bannerClose?.addEventListener('click', () => { banner.style.display = 'none'; localStorage.setItem('kb_banner_closed', 'true'); });
});
