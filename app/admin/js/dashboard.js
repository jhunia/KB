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
  
  // 2. Setup Routing
  const navItems = document.querySelectorAll('.nav-item');
  const pages = document.querySelectorAll('.page-container');
  const title = document.getElementById('topbarTitle');

  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      navItems.forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      title.textContent = item.textContent.trim();

      const targetId = item.dataset.target;
      pages.forEach(p => p.classList.remove('active'));
      document.getElementById(targetId).classList.add('active');
      
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
  if (status === 'Processing') return 'status-processing';
  if (status === 'Shipped') return 'status-shipped';
  if (status === 'Delivered') return 'status-delivered';
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
    if (o.status === 'Delivered') rev += o.total;
    if (o.status === 'Processing' || o.status === 'Shipped') active++;
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
        .filter(o => o.status === 'Delivered' && new Date(o.date).toDateString() === dayStr)
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
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-sub);">No orders yet</td></tr>`;
    return;
  }

  tbody.innerHTML = recent.map(o => `
    <tr>
      <td style="font-weight:600;">${o.id}</td>
      <td>${o.customer.name}</td>
      <td>${formatDate(o.date)}</td>
      <td style="font-weight:600;">$${o.total.toFixed(2)}</td>
      <td><span class="badge ${getStatusBadgeClass(o.status)}">${o.status}</span></td>
    </tr>
  `).join('');
}

// ============================================
// Orders Management View
// ============================================
function renderOrdersTable() {
  const tbody = document.getElementById('allOrdersTbody');
  const orders = [...db.getOrders()].reverse();

  if (orders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-sub);">No orders found</td></tr>`;
    return;
  }

  tbody.innerHTML = orders.map(o => `
    <tr>
      <td style="font-weight:600;">${o.id}</td>
      <td style="font-size:12px;color:var(--text-sub);">${formatDate(o.date)}</td>
      <td>
        <div style="font-weight:600;">${o.customer.name}</div>
        <div style="font-size:12px;color:var(--text-sub);">${o.customer.email} | ${o.customer.phone}</div>
      </td>
      <td style="font-weight:600;">$${o.total.toFixed(2)}</td>
      <td><span class="badge ${getStatusBadgeClass(o.status)}" id="badge-${o.id}">${o.status}</span></td>
      <td>
        <select class="status-select" data-id="${o.id}">
          <option value="Processing" ${o.status === 'Processing' ? 'selected' : ''}>Processing</option>
          <option value="Shipped" ${o.status === 'Shipped' ? 'selected' : ''}>Shipped</option>
          <option value="Delivered" ${o.status === 'Delivered' ? 'selected' : ''}>Delivered</option>
        </select>
      </td>
    </tr>
  `).join('');

  document.querySelectorAll('.status-select').forEach(sel => {
    sel.addEventListener('change', (e) => {
      const id = e.target.dataset.id;
      const newStatus = e.target.value;
      db.updateOrderStatus(id, newStatus);
      
      const badge = document.getElementById(`badge-${id}`);
      if (badge) {
        badge.className = `badge ${getStatusBadgeClass(newStatus)}`;
        badge.textContent = newStatus;
      }
      renderKPIs();
    });
  });
}

// ============================================
// Products Management View
// ============================================
function renderProductsTable() {
  const tbody = document.getElementById('productsTbody');
  const products = db.getProducts();

  tbody.innerHTML = products.map(p => `
    <tr>
      <td>
        <div class="product-cell-img">
          <img src="${p.images[0]}" alt="${p.name}">
          <div>
            <div class="product-cell-name">${p.name}</div>
            <div style="font-size:12px;color:var(--text-sub);">ID: ${p.id} | ${p.brand || 'Unbranded'}</div>
          </div>
        </div>
      </td>
      <td style="text-transform:capitalize;">${p.category} <br><span style="font-size:12px;color:#999;">${p.gender || 'Uni-sex'}</span></td>
      <td style="font-weight:600;">$${p.price} ${p.discount ? `<span style="color:var(--danger);font-size:12px;margin-left:4px;">-${p.discount}%</span>` : ''}</td>
      <td>
        <span class="badge ${p.inStock ? 'stock-in' : 'stock-out'}" id="stock-badge-${p.id}">
          ${p.inStock ? 'In Stock' : 'Out of Stock'}
        </span>
      </td>
      <td style="display:flex; gap:8px;">
        <button class="action-btn" onclick="openEditModal(${p.id})">Edit</button>
        <button class="action-btn ${p.inStock ? '' : 'primary'}" data-action="toggle-stock" data-id="${p.id}">
          ${p.inStock ? 'Out of Stock' : 'In Stock'}
        </button>
        <button class="action-btn" style="color:var(--danger); border-color:#FCA5A5;" data-action="delete" data-id="${p.id}">
          Delete
        </button>
      </td>
    </tr>
  `).join('');

  document.querySelectorAll('button[data-action="toggle-stock"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = parseInt(e.target.dataset.id);
      const product = db.getProductById(id);
      const newStatus = !product.inStock;
      db.updateProductStock(id, newStatus);
      
      const badge = document.getElementById(`stock-badge-${id}`);
      if (badge) {
        badge.className = `badge ${newStatus ? 'stock-in' : 'stock-out'}`;
        badge.textContent = newStatus ? 'In Stock' : 'Out of Stock';
      }
      e.target.className = `action-btn ${newStatus ? '' : 'primary'}`;
      e.target.textContent = newStatus ? 'Out of Stock' : 'In Stock';
    });
  });

  document.querySelectorAll('button[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      if (confirm('Are you certain you want to permanently delete this product?')) {
        const id = parseInt(e.target.dataset.id);
        db.deleteProduct(id);
        renderProductsTable();
      }
    });
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
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-sub);">No customers yet</td></tr>`;
    return;
  }

  tbody.innerHTML = customers.map(c => `
    <tr>
      <td>
        <div style="display:flex; align-items:center; gap:10px;">
          <div style="width:32px;height:32px;border-radius:50%;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;">
            ${c.name.charAt(0).toUpperCase()}
          </div>
          <span style="font-weight:600;">${c.name}</span>
        </div>
      </td>
      <td style="color:var(--text-sub);">${c.email}</td>
      <td style="color:var(--text-sub);">${c.phone || '—'}</td>
      <td>
        <span class="badge ${c.orderCount > 0 ? 'status-shipped' : ''}">${c.orderCount} order${c.orderCount !== 1 ? 's' : ''}</span>
      </td>
      <td style="font-weight:600;">${c.totalSpend > 0 ? '$' + c.totalSpend.toFixed(2) : '—'}</td>
    </tr>
  `).join('');
}

document.addEventListener('DOMContentLoaded', initDashboard);
