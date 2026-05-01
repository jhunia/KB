import { db } from '../../js/db.js';

// ============================================
// State & Routing
// ============================================
let uploadedImagesBase64 = []; // Stores current images for the modal

const AVAILABLE_COLORS = [
  { name: 'Black', hex: '#000000' }, { name: 'White', hex: '#FFFFFF' }, { name: 'Grey', hex: '#808080' },
  { name: 'Navy Blue', hex: '#000080' }, { name: 'Red', hex: '#FF0000' }, { name: 'Burgundy', hex: '#800020' },
  { name: 'Blue', hex: '#0000FF' }, { name: 'Light Blue', hex: '#ADD8E6' }, { name: 'Green', hex: '#008000' },
  { name: 'Olive', hex: '#808000' }, { name: 'Khaki', hex: '#F0E68C' }, { name: 'Beige', hex: '#F5F5DC' },
  { name: 'Brown', hex: '#A52A2A' }, { name: 'Tan', hex: '#D2B48C' }, { name: 'Pink', hex: '#FFC0CB' },
  { name: 'Purple', hex: '#800080' }, { name: 'Orange', hex: '#FFA500' }, { name: 'Yellow', hex: '#FFFF00' },
  { name: 'Gold', hex: '#FFD700' }, { name: 'Silver', hex: '#C0C0C0' }, { name: 'Multi-color', hex: 'linear-gradient(45deg, red, blue, green, yellow)' }
];

function initDashboard() {
  // 1. Auth Check
  const user = db.getCurrentUser();
  if (!user || user.role !== 'admin') {
    window.location.href = '/admin/login.html';
    return;
  }
  document.getElementById('adminNameDisplay').textContent = user.name;
  
  // 2. Setup Routing & Mobile Menu
  const navItems = document.querySelectorAll('.nav-item');
  const pages = document.querySelectorAll('.page-container');
  const title = document.getElementById('topbarTitle');
  const sidebar = document.querySelector('.sidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  const mobileMenuToggle = document.getElementById('mobileMenuToggle');

  function toggleSidebar() {
    sidebar.classList.toggle('open');
    sidebarOverlay.classList.toggle('open');
  }

  function closeSidebar() {
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('open');
  }

  if (mobileMenuToggle) {
    mobileMenuToggle.addEventListener('click', toggleSidebar);
  }
  if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', closeSidebar);
  }

  // Close sidebar on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sidebar.classList.contains('open')) {
      closeSidebar();
    }
  });

  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      navItems.forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      title.textContent = item.textContent.trim();

      const targetId = item.dataset.target;
      pages.forEach(p => p.classList.remove('active'));
      document.getElementById(targetId).classList.add('active');
      
      if (window.innerWidth <= 768) {
        closeSidebar();
      }

      if (targetId === 'view-dashboard') renderKPIs();
      if (targetId === 'view-orders') renderOrdersTable();
      if (targetId === 'view-products') renderProductsTable();
      if (targetId === 'view-customers') renderCustomersTable();
    });
  });

  // 3. Logout
  document.getElementById('logoutBtn').addEventListener('click', () => {
    db.logout();
    window.location.href = '/admin/login.html';
  });

  // 4. Modal Handlers
  setupProductModal();

  // INITIAL RENDER
  renderKPIs();
  renderProductsTable();
  renderOrdersTable();
}

// ============================================
// Utils
// ============================================
function formatDate(isoString) {
  const d = new Date(isoString);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
}

function getStatusBadgeClass(status) {
  if (status === 'pending_payment') return 'status-pending';
  if (status === 'paid') return 'status-paid';
  if (status === 'Processing') return 'status-processing';
  if (status === 'Shipped') return 'status-shipped';
  if (status === 'Delivered') return 'status-delivered';
  if (status === 'payment_failed') return 'status-failed';
  return '';
}

// ============================================
// Product Modal (Add & Edit)
// ============================================
function setupProductModal() {
  const modal = document.getElementById('productModal');
  const form = document.getElementById('productForm');
  
  // Render Colors
  const colorsContainer = document.getElementById('prodColorsContainer');
  colorsContainer.innerHTML = AVAILABLE_COLORS.map(c => `
    <label class="color-swatch-item">
      <input type="checkbox" name="prodColor" value="${c.hex}" data-name="${c.name}">
      <div class="color-circle" style="background:${c.hex}"></div>
      ${c.name}
    </label>
  `).join('');

  // Handle "Other" Brand logic
  const brandSelect = document.getElementById('prodBrand');
  const brandOtherInput = document.getElementById('prodBrandOther');
  brandSelect.addEventListener('change', () => {
    if (brandSelect.value === 'Other') {
      brandOtherInput.style.display = 'block';
      brandOtherInput.setAttribute('required', 'true');
    } else {
      brandOtherInput.style.display = 'none';
      brandOtherInput.removeAttribute('required');
    }
  });

  // Auto-calculate discounted price when original price and discount are entered
  const prodOriginalPrice = document.getElementById('prodOriginalPrice');
  const prodDiscount = document.getElementById('prodDiscount');
  const prodPrice = document.getElementById('prodPrice');

  function calculateDiscountedPrice() {
    const original = parseFloat(prodOriginalPrice.value);
    const discount = parseFloat(prodDiscount.value);
    if (original && discount && discount > 0 && discount <= 100) {
      const discounted = original * (1 - discount / 100);
      prodPrice.value = Math.round(discounted * 100) / 100; // Round to 2 decimal places
    }
  }

  prodOriginalPrice.addEventListener('input', calculateDiscountedPrice);
  prodDiscount.addEventListener('input', calculateDiscountedPrice);

  // Handle Image Uploads via FileReader (Base64)
  const imageUploadZone = document.getElementById('imageUploadZone');
  const fileInput = document.getElementById('prodImageInput');
  const previewContainer = document.getElementById('imagePreviewContainer');

  const handleFiles = (files) => {
    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        uploadedImagesBase64.push(e.target.result);
        renderImagePreviews();
      };
      reader.readAsDataURL(file);
    });
  };

  imageUploadZone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => handleFiles(e.target.files));
  imageUploadZone.addEventListener('dragover', (e) => { e.preventDefault(); imageUploadZone.style.borderColor = 'var(--primary)'; });
  imageUploadZone.addEventListener('dragleave', () => imageUploadZone.style.borderColor = 'var(--border)');
  imageUploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    imageUploadZone.style.borderColor = 'var(--border)';
    handleFiles(e.dataTransfer.files);
  });

  window.removePreviewImage = (index) => {
    uploadedImagesBase64.splice(index, 1);
    renderImagePreviews();
  };

  function renderImagePreviews() {
    previewContainer.innerHTML = uploadedImagesBase64.map((src, i) => `
      <div class="image-preview-item">
        <img src="${src}">
        <button type="button" class="image-preview-remove" onclick="removePreviewImage(${i})">✕</button>
      </div>
    `).join('');
  }

  // Open Add Modal
  document.getElementById('openAddProductModalBtn')?.addEventListener('click', () => {
    form.reset();
    document.getElementById('editProductId').value = '';
    document.getElementById('productModalTitle').textContent = 'Add New Product';
    brandOtherInput.style.display = 'none';
    brandOtherInput.removeAttribute('required');
    uploadedImagesBase64 = [];
    renderImagePreviews();
    modal.style.display = 'flex';
  });

  // Close Modal
  const close = () => modal.style.display = 'none';
  document.getElementById('closeProductModal')?.addEventListener('click', close);
  document.getElementById('cancelProductBtn')?.addEventListener('click', close);

  // Form Submit
  form.addEventListener('submit', (e) => {
    e.preventDefault();

    // Collect Colors & Sizes
    const selectedColors = [];
    const colorStock = {};
    document.querySelectorAll('input[name="prodColor"]:checked').forEach(cb => {
      selectedColors.push(cb.value);
      colorStock[cb.value] = true; // By default, in stock
    });

    const selectedSizes = [];
    document.querySelectorAll('input[name="prodSize"]:checked').forEach(cb => {
      selectedSizes.push(cb.value);
    });

    if (selectedColors.length === 0) { alert('Please select at least one color.'); return; }
    if (selectedSizes.length === 0) { alert('Please select at least one size.'); return; }
    if (uploadedImagesBase64.length === 0) { alert('Please add at least one image.'); return; }

    const brand = brandSelect.value === 'Other' ? brandOtherInput.value.trim() : brandSelect.value;
    const discountVal = document.getElementById('prodDiscount').value;
    const originalPriceVal = document.getElementById('prodOriginalPrice').value;

    const productData = {
      name: document.getElementById('prodName').value.trim(),
      price: parseFloat(document.getElementById('prodPrice').value),
      originalPrice: originalPriceVal ? parseFloat(originalPriceVal) : null,
      discount: discountVal ? parseInt(discountVal) : null,
      category: document.getElementById('prodCategory').value,
      brand: brand,
      gender: document.getElementById('prodGender').value,
      style: document.getElementById('prodStyle').value,
      sizes: selectedSizes,
      colors: selectedColors,
      colorStock: colorStock,
      images: uploadedImagesBase64,
      description: document.getElementById('prodDesc').value.trim(),
      inStock: true
    };
    
    const editId = document.getElementById('editProductId').value;
    if (editId) {
      db.updateProduct(parseInt(editId), productData);
    } else {
      productData.tag = 'new'; // default
      db.addProduct(productData);
    }
    
    close();
    renderProductsTable();
  });

  // Global function for edit
  window.openEditModal = (id) => {
    const p = db.getProductById(id);
    if (!p) return;
    
    form.reset();
    document.getElementById('editProductId').value = p.id;
    document.getElementById('productModalTitle').textContent = 'Edit Product';

    document.getElementById('prodName').value = p.name;
    document.getElementById('prodGender').value = p.gender || 'Uni-sex';
    document.getElementById('prodPrice').value = p.price;
    document.getElementById('prodOriginalPrice').value = p.originalPrice || '';
    document.getElementById('prodDiscount').value = p.discount || '';
    document.getElementById('prodCategory').value = p.category;
    document.getElementById('prodStyle').value = p.style;
    document.getElementById('prodDesc').value = p.description;

    // Brand
    const isStandardBrand = Array.from(brandSelect.options).some(opt => opt.value === p.brand) && p.brand !== 'Other';
    if (isStandardBrand) {
      brandSelect.value = p.brand;
      brandOtherInput.style.display = 'none';
      brandOtherInput.removeAttribute('required');
    } else {
      brandSelect.value = 'Other';
      brandOtherInput.value = p.brand;
      brandOtherInput.style.display = 'block';
      brandOtherInput.setAttribute('required', 'true');
    }

    // Sizes
    document.querySelectorAll('input[name="prodSize"]').forEach(cb => {
      cb.checked = p.sizes.includes(cb.value);
    });

    // Colors
    document.querySelectorAll('input[name="prodColor"]').forEach(cb => {
      cb.checked = p.colors.includes(cb.value);
      // We could add advanced stock toggle here, but for now just check them
    });

    // Images
    uploadedImagesBase64 = [...p.images];
    renderImagePreviews();

    modal.style.display = 'flex';
  };
}

// ============================================
// Dashboard KPIs View
// ============================================
function renderKPIs() {
  const orders = db.getOrders();
  let rev = 0;
  let active = 0;

  orders.forEach(o => {
    // Count revenue from delivered and paid orders
    if (o.status === 'Delivered' || o.status === 'paid') rev += o.total;
    // Active orders: paid, processing, shipped, or pending payment
    if (['paid', 'Processing', 'Shipped', 'pending_payment'].includes(o.status)) active++;
  });

  document.getElementById('kpiRevenue').textContent = `$${rev.toFixed(2)}`;
  document.getElementById('kpiOrders').textContent = orders.length;
  document.getElementById('kpiActive').textContent = active;
  document.getElementById('kpiCustomers').textContent = db.getCustomers().length;

  const chart = document.getElementById('salesChart');
  const labels = document.getElementById('salesChartLabels');
  if (chart) {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toLocaleDateString('en-US', { weekday: 'short' }));
    }

    const dayTotals = days.map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const dayStr = d.toDateString();
      return orders
        .filter(o => (o.status === 'Delivered' || o.status === 'paid') && new Date(o.date).toDateString() === dayStr)
        .reduce((sum, o) => sum + o.total, 0);
    });

    const maxVal = Math.max(...dayTotals, 1);

    chart.innerHTML = dayTotals.map((val, i) => `
      <div style="flex:1; display:flex; flex-direction:column; align-items:center; justify-content:flex-end; gap:4px;">
        <span style="font-size:11px; color:var(--text-sub); font-weight:600;">${val > 0 ? '$' + val : ''}</span>
        <div style="width:100%; background:${val > 0 ? 'var(--primary)' : 'var(--border)'}; border-radius:4px 4px 0 0; height:${Math.max(val / maxVal * 150, 4)}px;"></div>
      </div>
    `).join('');

    labels.innerHTML = days.map(d => `
      <div style="flex:1; text-align:center; font-size:12px; color:var(--text-sub);">${d}</div>
    `).join('');
  }

  const recent = [...orders].reverse().slice(0, 5);
  const tbody = document.getElementById('recentOrdersTbody');
  
  if (recent.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--text-sub);">No orders yet</td></tr>`;
    return;
  }

  tbody.innerHTML = recent.map(o => `
    <tr class="clickable-row" data-type="order" data-id="${o.id}">
      <td>${o.customer.name}</td>
      <td>${formatDate(o.date)}</td>
      <td style="font-weight:600;">$${o.total.toFixed(2)}</td>
      <td><span class="badge ${getStatusBadgeClass(o.status)}">${o.status}</span></td>
    </tr>
  `).join('');

  // Add click handlers
  tbody.querySelectorAll('.clickable-row').forEach(row => {
    row.addEventListener('click', () => showOrderDetail(row.dataset.id));
  });
}

// ============================================
// Orders Management View
// ============================================
function renderOrdersTable() {
  const tbody = document.getElementById('allOrdersTbody');
  const orders = [...db.getOrders()].reverse();

  if (orders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;color:var(--text-sub);">No orders found</td></tr>`;
    return;
  }

  tbody.innerHTML = orders.map(o => `
    <tr class="clickable-row" data-type="order" data-id="${o.id}">
      <td>
        <div style="font-weight:600;">${o.customer.name}</div>
        <div style="font-size:12px;color:var(--text-sub);">${o.customer.email}</div>
      </td>
      <td style="font-weight:600;">$${o.total.toFixed(2)}</td>
      <td><span class="badge ${getStatusBadgeClass(o.status)}">${o.status}</span></td>
    </tr>
  `).join('');

  // Add click handlers
  tbody.querySelectorAll('.clickable-row').forEach(row => {
    row.addEventListener('click', () => showOrderDetail(row.dataset.id));
  });
}

// ============================================
// Products Management View
// ============================================
function renderProductsTable() {
  const tbody = document.getElementById('productsTbody');
  const products = db.getProducts();

  tbody.innerHTML = products.map(p => `
    <tr class="clickable-row" data-type="product" data-id="${p.id}">
      <td style="font-weight:600;">${p.name}</td>
      <td style="font-weight:600;">$${p.price} ${p.discount ? `<span style="color:var(--danger);font-size:12px;margin-left:4px;">-${p.discount}%</span>` : ''}</td>
    </tr>
  `).join('');

  // Add click handlers
  tbody.querySelectorAll('.clickable-row').forEach(row => {
    row.addEventListener('click', () => showProductDetail(row.dataset.id));
  });
}

// ============================================
// Customers View
// ============================================
function renderCustomersTable() {
  const tbody = document.getElementById('customersTbody');
  const countEl = document.getElementById('customerCount');
  const customers = db.getCustomers();

  if (countEl) countEl.textContent = `${customers.length} registered`;

  if (customers.length === 0) {
    tbody.innerHTML = `<tr><td colspan="2" style="text-align:center;color:var(--text-sub);">No customers yet</td></tr>`;
    return;
  }

  tbody.innerHTML = customers.map(c => `
    <tr class="clickable-row" data-type="customer" data-id="${c.email}">
      <td style="font-weight:600;">${c.name}</td>
      <td style="color:var(--text-sub);">${c.phone || '—'}</td>
    </tr>
  `).join('');

  // Add click handlers
  tbody.querySelectorAll('.clickable-row').forEach(row => {
    row.addEventListener('click', () => showCustomerDetail(row.dataset.id));
  });
}

// ============================================
// Detail Modal Functions
// ============================================
function showOrderDetail(orderId) {
  const order = db.getOrderById(orderId);
  if (!order) return;

  const modal = document.getElementById('orderDetailModal');
  const content = document.getElementById('orderDetailContent');

  const itemsHtml = order.items.map(item => {
    const product = db.getProductById(item.productId);
    return `
      <div style="display:flex; gap:12px; padding:12px; border:1px solid var(--border); border-radius:8px; margin-bottom:8px;">
        <img src="${product?.images[0] || ''}" style="width:60px; height:60px; object-fit:cover; border-radius:4px;">
        <div>
          <div style="font-weight:600;">${product?.name || 'Unknown Product'}</div>
          <div style="font-size:12px; color:var(--text-sub);">Size: ${item.size} | Color: ${item.color}</div>
          <div style="font-size:12px; color:var(--text-sub);">Qty: ${item.quantity}</div>
        </div>
      </div>
    `;
  }).join('');

  content.innerHTML = `
    <div style="margin-bottom:16px;">
      <div style="font-size:12px; color:var(--text-sub);">Order ID</div>
      <div style="font-weight:600; font-size:18px;">${order.id}</div>
    </div>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px;">
      <div>
        <div style="font-size:12px; color:var(--text-sub);">Customer</div>
        <div style="font-weight:600;">${order.customer.name}</div>
      </div>
      <div>
        <div style="font-size:12px; color:var(--text-sub);">Status</div>
        <span class="badge ${getStatusBadgeClass(order.status)}">${order.status}</span>
      </div>
      <div>
        <div style="font-size:12px; color:var(--text-sub);">Date</div>
        <div>${formatDate(order.date)}</div>
      </div>
      <div>
        <div style="font-size:12px; color:var(--text-sub);">Total</div>
        <div style="font-weight:600; font-size:18px;">$${order.total.toFixed(2)}</div>
      </div>
    </div>
    <div style="margin-bottom:16px;">
      <div style="font-size:12px; color:var(--text-sub);">Contact</div>
      <div>${order.customer.email}</div>
      <div>${order.customer.phone}</div>
    </div>
    <div>
      <div style="font-size:12px; color:var(--text-sub); margin-bottom:8px;">Items (${order.items.length})</div>
      ${itemsHtml}
    </div>
  `;

  modal.style.display = 'flex';
}

function showProductDetail(productId) {
  const product = db.getProductById(parseInt(productId));
  if (!product) return;

  const modal = document.getElementById('productDetailModal');
  const content = document.getElementById('productDetailContent');

  const colorsHtml = product.colors?.map(c => `
    <span style="display:inline-block; width:20px; height:20px; background:${c}; border-radius:50%; border:1px solid #ddd;"></span>
  `).join('') || '—';

  const sizesHtml = product.sizes?.join(', ') || '—';

  content.innerHTML = `
    <div style="text-align:center; margin-bottom:24px;">
      <img src="${product.images[0]}" style="width:200px; height:200px; object-fit:cover; border-radius:12px;">
    </div>
    <div style="margin-bottom:16px;">
      <div style="font-size:12px; color:var(--text-sub);">Product Name</div>
      <div style="font-weight:600; font-size:18px;">${product.name}</div>
    </div>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px;">
      <div>
        <div style="font-size:12px; color:var(--text-sub);">Price</div>
        <div style="font-weight:600; font-size:18px;">$${product.price} ${product.discount ? `<span style="color:var(--danger);">-${product.discount}%</span>` : ''}</div>
      </div>
      <div>
        <div style="font-size:12px; color:var(--text-sub);">Stock Status</div>
        <span class="badge ${product.inStock ? 'stock-in' : 'stock-out'}">${product.inStock ? 'In Stock' : 'Out of Stock'}</span>
      </div>
      <div>
        <div style="font-size:12px; color:var(--text-sub);">Category</div>
        <div style="text-transform:capitalize;">${product.category}</div>
      </div>
      <div>
        <div style="font-size:12px; color:var(--text-sub);">Brand</div>
        <div>${product.brand || '—'}</div>
      </div>
    </div>
    <div style="margin-bottom:16px;">
      <div style="font-size:12px; color:var(--text-sub);">Colors</div>
      <div style="display:flex; gap:8px;">${colorsHtml}</div>
    </div>
    <div style="margin-bottom:16px;">
      <div style="font-size:12px; color:var(--text-sub);">Sizes</div>
      <div>${sizesHtml}</div>
    </div>
    <div>
      <div style="font-size:12px; color:var(--text-sub);">Description</div>
      <div style="font-size:14px; line-height:1.5;">${product.description || 'No description'}</div>
    </div>
    <div style="margin-top:24px; display:flex; gap:12px; justify-content:flex-end; flex-wrap:wrap;">
      <button class="action-btn ${product.inStock ? '' : 'primary'}" onclick="toggleProductStock(${product.id}); closeProductDetailModal(); renderProductsTable();">
        ${product.inStock ? 'Out of Stock' : 'In Stock'}
      </button>
      <button class="action-btn" style="color:var(--danger); border-color:#FCA5A5;" onclick="deleteProduct(${product.id}); closeProductDetailModal(); renderProductsTable();">
        Delete Product
      </button>
      <button class="action-btn primary" onclick="closeProductDetailModal(); openEditModal(${product.id});">Edit Product</button>
    </div>
  `;

  modal.style.display = 'flex';
}

function showCustomerDetail(customerEmail) {
  const customers = db.getCustomers();
  const customer = customers.find(c => c.email === customerEmail);
  if (!customer) return;

  const modal = document.getElementById('customerDetailModal');
  const content = document.getElementById('customerDetailContent');

  content.innerHTML = `
    <div style="text-align:center; margin-bottom:24px;">
      <div style="width:80px; height:80px; border-radius:50%; background:var(--primary); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:32px; margin:0 auto;">
        ${customer.name.charAt(0).toUpperCase()}
      </div>
    </div>
    <div style="margin-bottom:16px;">
      <div style="font-size:12px; color:var(--text-sub);">Name</div>
      <div style="font-weight:600; font-size:18px;">${customer.name}</div>
    </div>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px;">
      <div>
        <div style="font-size:12px; color:var(--text-sub);">Email</div>
        <div>${customer.email}</div>
      </div>
      <div>
        <div style="font-size:12px; color:var(--text-sub);">Phone</div>
        <div>${customer.phone || '—'}</div>
      </div>
    </div>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
      <div>
        <div style="font-size:12px; color:var(--text-sub);">Total Orders</div>
        <div style="font-weight:600; font-size:24px;">${customer.orderCount}</div>
      </div>
      <div>
        <div style="font-size:12px; color:var(--text-sub);">Total Spend</div>
        <div style="font-weight:600; font-size:24px;">$${customer.totalSpend.toFixed(2)}</div>
      </div>
    </div>
  `;

  modal.style.display = 'flex';
}

// Global functions for onclick handlers
window.closeOrderDetailModal = () => document.getElementById('orderDetailModal').style.display = 'none';
window.closeProductDetailModal = () => document.getElementById('productDetailModal').style.display = 'none';
window.closeCustomerDetailModal = () => document.getElementById('customerDetailModal').style.display = 'none';

window.toggleProductStock = (id) => {
  const product = db.getProductById(id);
  if (product) {
    db.updateProductStock(id, !product.inStock);
  }
};

window.deleteProduct = (id) => {
  if (confirm('Are you certain you want to permanently delete this product?')) {
    db.deleteProduct(id);
  }
};

// Add overlay click handlers for detail modals
document.getElementById('orderDetailModal').addEventListener('click', (e) => {
  if (e.target.id === 'orderDetailModal') closeOrderDetailModal();
});
document.getElementById('productDetailModal').addEventListener('click', (e) => {
  if (e.target.id === 'productDetailModal') closeProductDetailModal();
});
document.getElementById('customerDetailModal').addEventListener('click', (e) => {
  if (e.target.id === 'customerDetailModal') closeCustomerDetailModal();
});

document.addEventListener('DOMContentLoaded', initDashboard);
