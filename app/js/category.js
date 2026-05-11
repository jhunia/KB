import { db } from './db.js';

// ============================================
// Stars utility
// ============================================
function renderStars(rating) {
  let html = '';
  for (let i = 1; i <= 5; i++) {
    html += i <= Math.floor(rating) ? '★' : (i - rating < 1 && i - rating > 0 ? '★' : '☆');
  }
  return html;
}

function createProductCardHTML(product) {
  const isInWishlist = db.isInWishlist(product.id);
  const outOfStockLabel = product.inStock === false ? '<div class="out-of-stock-badge" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(255,255,255,0.9);color:#000;padding:8px 16px;font-weight:700;border-radius:4px;z-index:2;letter-spacing:1px;font-size:14px;white-space:nowrap;">OUT OF STOCK</div>' : '';
  const imgStyle = product.inStock === false ? 'opacity: 0.5; filter: grayscale(100%);' : '';

  return `
    <div class="product-card" data-product-id="${product.id}">
      <div class="product-card-img">
        ${outOfStockLabel}
        <img src="${product.images[0]}" alt="${product.name}" loading="lazy" style="${imgStyle}" />
        <button class="wishlist-btn ${isInWishlist ? 'active' : ''}" data-product-id="${product.id}" aria-label="Add to wishlist" style="z-index:3;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="${isInWishlist ? '#FF3333' : 'none'}" stroke="${isInWishlist ? '#FF3333' : 'currentColor'}" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        </button>
      </div>
      <h3 class="product-card-title">${product.name}</h3>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
        <div class="product-card-price" style="margin-top: 0;">
          <span class="price-current">$${product.price}</span>
          ${product.originalPrice ? `<span class="price-original">$${product.originalPrice}</span>` : ''}
        </div>
        <div class="product-card-rating" style="margin-top: 0; display: flex; align-items: center; gap: 4px;">
          <span class="stars" style="color: #FFB800;">★</span>
          <span class="rating-text">${product.rating}/5</span>
        </div>
      </div>
    </div>
  `;
}

// ============================================
// State
// ============================================
let currentPage = 1;
const perPage = 9;
let filteredProducts = [];
let activeFilters = {
  categories: [],
  sizes: [],
  styles: [],
  priceMin: 50,
  priceMax: 600,
  sort: 'popular'
};

// ============================================
// Read URL Params
// ============================================
function readURLParams() {
  const params = new URLSearchParams(window.location.search);
  const style = params.get('style');
  const filter = params.get('filter');
  const gender = params.get('gender');

  if (style) {
    activeFilters.styles = [style];
    const checkbox = document.querySelector(`input[name="style"][value="${style}"]`);
    if (checkbox) checkbox.checked = true;
    document.getElementById('breadcrumbCurrent').textContent = style.charAt(0).toUpperCase() + style.slice(1);
  }

  if (filter === 'new') {
    document.getElementById('breadcrumbCurrent').textContent = 'New Arrivals';
  } else if (filter === 'sale') {
    document.getElementById('breadcrumbCurrent').textContent = 'On Sale';
  } else if (filter === 'brands') {
    document.getElementById('breadcrumbCurrent').textContent = 'Brands';
  } else if (gender) {
    document.getElementById('breadcrumbCurrent').textContent = gender + "'s Collection";
  } else if (params.get('brand')) {
    document.getElementById('breadcrumbCurrent').textContent = params.get('brand') + ' Collection';
  } else if (!style) {
    document.getElementById('breadcrumbCurrent').textContent = 'All Products';
  }
}

// ============================================
// Apply Filters
// ============================================
function applyFilters() {
  const params = new URLSearchParams(window.location.search);
  const filterTag = params.get('filter');
  const searchQ = params.get('search');

  let products = db.getProducts();

  // Search filter
  if (searchQ) {
    const term = searchQ.toLowerCase();
    products = products.filter(p => p.name.toLowerCase().includes(term) || p.description.toLowerCase().includes(term));
    document.getElementById('breadcrumbCurrent').textContent = `Search: "${searchQ}"`;
  }

  // URL-based tag filter
  if (filterTag === 'new') {
    products = products.filter(p => p.tag === 'new');
  } else if (filterTag === 'sale') {
    products = products.filter(p => p.discount && p.discount > 0);
  }

  // Gender filter
  const gender = params.get('gender');
  if (gender) {
    products = products.filter(p => p.gender === gender || p.gender === 'Uni-sex');
  }

  // Brand filter
  const brand = params.get('brand');
  if (brand) {
    products = products.filter(p => p.brand === brand);
  }

  // Category
  if (activeFilters.categories.length > 0) {
    products = products.filter(p => activeFilters.categories.includes(p.category));
  }

  // Style
  if (activeFilters.styles.length > 0) {
    products = products.filter(p => activeFilters.styles.includes(p.style));
  }

  // Size
  if (activeFilters.sizes.length > 0) {
    products = products.filter(p => p.sizes.some(s => activeFilters.sizes.includes(s)));
  }

  // Price
  products = products.filter(p => p.price >= activeFilters.priceMin && p.price <= activeFilters.priceMax);

  // Sort
  switch (activeFilters.sort) {
    case 'newest':
      products.sort((a, b) => b.id - a.id);
      break;
    case 'price-low':
      products.sort((a, b) => a.price - b.price);
      break;
    case 'price-high':
      products.sort((a, b) => b.price - a.price);
      break;
    case 'rating':
      products.sort((a, b) => b.rating - a.rating);
      break;
    default: // popular by reviews
      products.sort((a, b) => b.reviews - a.reviews);
  }

  filteredProducts = products;
  currentPage = 1;
  renderGrid();
  renderPagination();
}

// ============================================
// Render Brands
// ============================================
function renderBrandsView() {
  const brandsGrid = document.getElementById('brandsGrid');
  const brands = db.getBrands();

  if (brands.length === 0) {
    brandsGrid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:80px 0;color:#666;">No brands found.</div>';
    return;
  }

  brandsGrid.innerHTML = brands.map(brand => {
    // Count products for this brand
    const count = db.getProductsByBrand(brand).length;
    const brandStr = String(brand);
    const brandFileName = brandStr.toLowerCase().replace(/[\s&]+/g, '_') + '.png';
    return `
      <a href="/category.html?brand=${encodeURIComponent(brandStr)}" class="brand-card">
        <div style="width: 80px; height: 80px; margin-bottom: 16px; display: flex; align-items: center; justify-content: center; background: #fff; border-radius: 50%; border: 1px solid var(--border); overflow: hidden; padding: 10px;">
          <img src="/assets/images/brands/${brandFileName}" alt="${brandStr}" style="max-width: 100%; max-height: 100%; object-fit: contain;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
          <span style="display:none; font-weight: bold; font-size: 28px; color: #ccc; align-items: center; justify-content: center; width: 100%; height: 100%;">${brandStr.charAt(0).toUpperCase()}</span>
        </div>
        <h3 class="brand-card-title">${brandStr}</h3>
        <p class="brand-card-count">${count} Product${count !== 1 ? 's' : ''}</p>
      </a>
    `;
  }).join('');
}

// ============================================
// Render Grid
// ============================================
function renderGrid() {
  const grid = document.getElementById('categoryGrid');
  const start = (currentPage - 1) * perPage;
  const end = start + perPage;
  const pageProducts = filteredProducts.slice(start, end);

  if (pageProducts.length === 0) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:80px 0;color:#666;">No products found matching your filters.</div>';
  } else {
    grid.innerHTML = pageProducts.map(p => createProductCardHTML(p)).join('');
    bindCardEvents(grid);
  }

  // Update count
  const countEl = document.getElementById('resultCount');
  const total = filteredProducts.length;
  countEl.textContent = `Showing ${Math.min(start + 1, total)}-${Math.min(end, total)} of ${total}`;
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
// Pagination
// ============================================
function renderPagination() {
  const container = document.getElementById('pagination');
  const totalPages = Math.ceil(filteredProducts.length / perPage);
  if (totalPages <= 1) { container.innerHTML = ''; return; }

  let html = `<button class="pagination-btn" id="prevPage" ${currentPage === 1 ? 'disabled' : ''}>← Previous</button>`;
  html += '<div class="pagination-numbers">';
  for (let i = 1; i <= totalPages; i++) {
    if (totalPages > 7 && i > 3 && i < totalPages - 1 && Math.abs(i - currentPage) > 1) {
      if (i === 4) html += '<span class="page-num">...</span>';
      continue;
    }
    html += `<button class="page-num ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
  }
  html += '</div>';
  html += `<button class="pagination-btn" id="nextPage" ${currentPage === totalPages ? 'disabled' : ''}>Next →</button>`;
  container.innerHTML = html;

  container.querySelectorAll('.page-num[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      currentPage = parseInt(btn.dataset.page);
      renderGrid();
      renderPagination();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  document.getElementById('prevPage')?.addEventListener('click', () => {
    if (currentPage > 1) { currentPage--; renderGrid(); renderPagination(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  });
  document.getElementById('nextPage')?.addEventListener('click', () => {
    if (currentPage < totalPages) { currentPage++; renderGrid(); renderPagination(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  });
}

// ============================================
// Cart Drawer (reuse from main.js logic)
// ============================================
function initCartDrawer() {
  const toggle = document.getElementById('cartToggle');
  const drawer = document.getElementById('cartDrawer');
  const overlay = document.getElementById('cartOverlay');
  const close = document.getElementById('cartDrawerClose');
  if (!toggle || !drawer) return;
  const open = () => { drawer.classList.add('open'); overlay.classList.add('open'); document.body.style.overflow = 'hidden'; renderCartDrawerCategory(); };
  const shut = () => { drawer.classList.remove('open'); overlay.classList.remove('open'); document.body.style.overflow = ''; };
  toggle.addEventListener('click', open);
  overlay?.addEventListener('click', shut);
  close?.addEventListener('click', shut);
}

function renderCartDrawerCategory() {
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
    return `<div class="cart-drawer-item"><div class="cart-drawer-item-img"><img src="${p.images[0]}" alt="${p.name}" /></div><div class="cart-drawer-item-info"><div class="cart-drawer-item-name">${p.name}</div><div class="cart-drawer-item-meta">Size: ${item.size}</div><div class="cart-drawer-item-bottom"><span class="cart-drawer-item-price">$${p.price * item.quantity}</span><div class="qty-control"><button data-action="dec" data-index="${i}">−</button><span>${item.quantity}</span><button data-action="inc" data-index="${i}">+</button></div></div></div></div>`;
  }).join('');
  totalEl.textContent = `$${db.getCartTotal()}`;
  container.querySelectorAll('.qty-control button').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index);
      const c = db.getCart();
      db.updateCartQuantity(idx, btn.dataset.action === 'inc' ? c[idx].quantity + 1 : c[idx].quantity - 1);
      renderCartDrawerCategory();
      updateBadge();
    });
  });

  // === FAVOURITES SECTION ===
  const wishlist = db.getWishlist();
  let wishlistSection = document.getElementById('drawerWishlist');
  if (!wishlistSection) {
    wishlistSection = document.createElement('div');
    wishlistSection.id = 'drawerWishlist';
    container.after(wishlistSection);
  }

  if (wishlist && wishlist.length > 0) {
    const favItems = wishlist.map(id => db.getProductById(id)).filter(Boolean);
    wishlistSection.innerHTML = `
      <div class="drawer-fav-header">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="#FF3333" stroke="#FF3333" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        <span>Saved Items</span>
      </div>
      <div class="drawer-fav-list">
        ${favItems.map(p => `
          <div class="drawer-fav-item" data-product-id="${p.id}">
            <img src="${p.images[0]}" alt="${p.name}" class="drawer-fav-img" />
            <div class="drawer-fav-info">
              <div class="drawer-fav-name">${p.name}</div>
              <div class="drawer-fav-price">$${p.price}</div>
            </div>
            <button class="drawer-fav-remove" data-id="${p.id}" aria-label="Remove from saved">✕</button>
          </div>
        `).join('')}
      </div>
    `;
    wishlistSection.querySelectorAll('.drawer-fav-item').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('.drawer-fav-remove')) return;
        window.location.href = `/product.html?id=${row.dataset.productId}`;
      });
    });
    wishlistSection.querySelectorAll('.drawer-fav-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        db.toggleWishlist(parseInt(btn.dataset.id));
        renderCartDrawerCategory();
      });
    });
  } else {
    wishlistSection.innerHTML = '';
  }
}

function updateBadge() {
  const badge = document.getElementById('cartBadge');
  if (!badge) return;
  const count = db.getCartCount();
  badge.textContent = count;
  badge.classList.toggle('hidden', count === 0);
}

// ============================================
// INIT
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
  // MUST initialise db before any other db call
  await db.init();

  readURLParams();

  const params = new URLSearchParams(window.location.search);
  if (params.get('filter') === 'brands') {
    document.getElementById('categoryLayout').style.display = 'none';
    document.getElementById('brandsContainer').style.display = 'block';
    renderBrandsView();
    initCartDrawer();
    updateBadge();
  } else {
    document.getElementById('categoryLayout').style.display = 'flex';
    document.getElementById('brandsContainer').style.display = 'none';
    applyFilters();
    initFilterEvents();
    initCartDrawer();
    updateBadge();
  }

  // Banner
  const banner = document.getElementById('topBanner');
  const bannerClose = document.getElementById('bannerClose');
  if (localStorage.getItem('kb_banner_closed') === 'true' && banner) banner.style.display = 'none';
  bannerClose?.addEventListener('click', () => { banner.style.display = 'none'; localStorage.setItem('kb_banner_closed', 'true'); });
});

function initFilterEvents() {
  // Collapsible filter groups
  document.querySelectorAll('.filter-group-title.collapsible').forEach(title => {
    title.addEventListener('click', () => {
      const targetId = title.dataset.target;
      const content = document.getElementById(targetId);
      if (content) {
        title.classList.toggle('collapsed');
        content.classList.toggle('collapsed');
      }
    });
  });

  // Filter interactions
  document.querySelectorAll('input[name="category"]').forEach(cb => {
    cb.addEventListener('change', () => {
      activeFilters.categories = [...document.querySelectorAll('input[name="category"]:checked')].map(c => c.value);
    });
  });

  document.querySelectorAll('input[name="style"]').forEach(cb => {
    cb.addEventListener('change', () => {
      activeFilters.styles = [...document.querySelectorAll('input[name="style"]:checked')].map(c => c.value);
    });
  });

  document.querySelectorAll('.size-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      pill.classList.toggle('active');
      activeFilters.sizes = [...document.querySelectorAll('.size-pill.active')].map(p => p.dataset.size);
    });
  });

  const priceMin = document.getElementById('priceMin');
  const priceMax = document.getElementById('priceMax');
  priceMin?.addEventListener('input', () => {
    activeFilters.priceMin = parseInt(priceMin.value);
    document.getElementById('priceMinLabel').textContent = `$${priceMin.value}`;
  });
  priceMax?.addEventListener('input', () => {
    activeFilters.priceMax = parseInt(priceMax.value);
    document.getElementById('priceMaxLabel').textContent = `$${priceMax.value}`;
  });

  document.getElementById('sortSelect')?.addEventListener('change', (e) => {
    activeFilters.sort = e.target.value;
    applyFilters();
  });

  document.getElementById('applyFilters')?.addEventListener('click', () => {
    applyFilters();
    // Close mobile filter if open
    document.getElementById('filterSidebar')?.classList.remove('open');
  });

  // Mobile filter toggle
  document.getElementById('filterToggle')?.addEventListener('click', () => {
    document.getElementById('filterSidebar')?.classList.add('open');
  });
  document.getElementById('filterClose')?.addEventListener('click', () => {
    document.getElementById('filterSidebar')?.classList.remove('open');
  });
}
