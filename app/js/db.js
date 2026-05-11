/* ============================================
   KB.ENT Database — Supabase Backend
   ============================================ */
import { supabase } from './supabase.js';

class KBDatabase {
  constructor() {
    this._productsCache = null;
    this._cartCache = [];
    this._wishlistCache = [];
    this._currentUser = null;
    this._initialized = false;
  }

  // Must be called before using any other method
  async init() {
    if (this._initialized) return;
    await this._loadProducts();
    await this._loadSession();
    if (this._currentUser) {
      await this._loadCart();
      await this._loadWishlist();
    } else {
      this._cartCache = JSON.parse(localStorage.getItem('kb_cart') || '[]');
      this._wishlistCache = JSON.parse(localStorage.getItem('kb_wishlist') || '[]');
    }
    this._initialized = true;
  }

  async _loadProducts() {
    const { data, error } = await supabase.from('products').select('*').order('id');
    if (error) { console.error('[DB] Products load error:', error); this._productsCache = []; return; }
    this._productsCache = data.map(p => ({
      id: p.id, name: p.name, price: Number(p.price),
      originalPrice: p.original_price ? Number(p.original_price) : null,
      discount: p.discount, rating: Number(p.rating), reviews: p.reviews,
      category: p.category, brand: p.brand, gender: p.gender, style: p.style,
      sizes: p.sizes || [], colors: p.colors || [], colorStock: p.color_stock || {},
      images: p.images || [], tag: p.tag, description: p.description, inStock: p.in_stock
    }));
  }

  async _loadSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      if (profile) {
        this._currentUser = { id: profile.id, name: profile.name, email: profile.email, phone: profile.phone, role: profile.role };
      }
    }
  }

  async _loadCart() {
    if (!this._currentUser) return;
    const { data } = await supabase.from('cart_items').select('*').eq('user_id', this._currentUser.id);
    this._cartCache = (data || []).map(item => ({
      productId: item.product_id, size: item.size, color: item.color, quantity: item.quantity, _dbId: item.id
    }));
  }

  async _loadWishlist() {
    if (!this._currentUser) return;
    const { data } = await supabase.from('wishlist').select('product_id').eq('user_id', this._currentUser.id);
    this._wishlistCache = (data || []).map(w => w.product_id);
  }

  // ---- PRODUCTS (sync from cache) ----
  getProducts() { return this._productsCache || []; }
  getProductById(id) { return this.getProducts().find(p => p.id === parseInt(id)); }

  getProductsByTag(tag) {
    const filtered = this.getProducts().filter(p => p.tag === tag);
    return tag === 'new' ? [...filtered].reverse().slice(0, 8) : filtered.slice(0, 8);
  }

  getProductsByBrand(brand) { return this.getProducts().filter(p => p.brand === brand); }
  getProductsByGender(gender) { return this.getProducts().filter(p => p.gender === gender || p.gender === 'Uni-sex'); }

  getBrands() {
    const brands = new Set(this.getProducts().map(p => p.brand).filter(Boolean));
    return Array.from(brands).sort();
  }

  getComplementaryProducts(productId) {
    const current = this.getProductById(productId);
    if (!current) return [];
    const all = this.getProducts();
    let targetCats = [];
    if (['tshirts', 'shirts', 'hoodies', 'jackets'].includes(current.category)) {
      targetCats = ['jeans', 'accessories', 'suits', 'shoes'];
    } else if (['jeans', 'suits'].includes(current.category)) {
      targetCats = ['tshirts', 'shirts', 'hoodies', 'accessories', 'shoes'];
    } else {
      targetCats = ['tshirts', 'jeans', 'jackets'];
    }
    const recs = all.filter(p => p.id !== current.id && targetCats.includes(p.category) && p.style === current.style);
    if (recs.length < 3) {
      const padded = all.filter(p => p.id !== current.id && !recs.includes(p)).sort((a, b) => b.rating - a.rating);
      return [...recs, ...padded].slice(0, 4);
    }
    return recs.slice(0, 4);
  }

  getExploreProducts(excludeId) {
    return this.getProducts().filter(p => p.id !== excludeId).sort(() => 0.5 - Math.random()).slice(0, 8);
  }

  // ---- AUTH ----
  getCurrentUser() { return this._currentUser; }

  async login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { success: false, message: error.message };
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
    if (!profile) return { success: false, message: 'Profile not found.' };
    this._currentUser = { id: profile.id, name: profile.name, email: profile.email, phone: profile.phone, role: profile.role };
    await this._mergeGuestCart();
    await this._loadWishlist();
    return { success: true, user: this._currentUser };
  }

  async signup(name, email, password, phone) {
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { name, phone } }
    });
    if (error) return { success: false, message: error.message };
    // Profile is auto-created by the DB trigger
    this._currentUser = { id: data.user.id, name, email, phone, role: 'customer' };
    await this._mergeGuestCart();
    return { success: true, user: this._currentUser };
  }

  async logout() {
    await supabase.auth.signOut();
    this._currentUser = null;
    // Fix #18: fully clear localStorage on logout — don't carry over old guest data
    this._cartCache = [];
    this._wishlistCache = [];
    localStorage.removeItem('kb_cart');
    localStorage.removeItem('kb_wishlist');
    this._initialized = false; // Force re-init on next page load
  }

  // ---- FORGOT / RESET PASSWORD ----
  async requestPasswordReset(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/auth.html'
    });
    if (error) return { success: false, message: error.message };
    return { success: true };
  }

  async updatePassword(newPassword) {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { success: false, message: error.message };
    return { success: true };
  }

  // ---- CART (cache-first, async-write) ----
  getCart() { return this._cartCache; }

  getCartCount() { return this._cartCache.reduce((sum, item) => sum + item.quantity, 0); }

  getCartTotal() {
    return this._cartCache.reduce((total, item) => {
      const p = this.getProductById(item.productId);
      return total + (p ? p.price * item.quantity : 0);
    }, 0);
  }

  addToCart(productId, size, color, quantity = 1) {
    const existing = this._cartCache.findIndex(item => item.productId === productId && item.size === size && item.color === color);
    let promise = Promise.resolve();
    if (existing > -1) {
      this._cartCache[existing].quantity += quantity;
      if (this._currentUser && this._cartCache[existing]._dbId) {
        promise = supabase.from('cart_items').update({ quantity: this._cartCache[existing].quantity }).eq('id', this._cartCache[existing]._dbId).then();
      }
    } else {
      const newItem = { productId, size, color, quantity };
      this._cartCache.push(newItem);
      if (this._currentUser) {
        promise = supabase.from('cart_items').insert({ user_id: this._currentUser.id, product_id: productId, size, color, quantity })
          .select().single().then(({ data }) => { if (data) newItem._dbId = data.id; });
      }
    }
    if (!this._currentUser) localStorage.setItem('kb_cart', JSON.stringify(this._cartCache));
    return promise;
  }

  updateCartQuantity(index, newQuantity) {
    if (newQuantity <= 0) {
      const removed = this._cartCache.splice(index, 1)[0];
      if (this._currentUser && removed?._dbId) supabase.from('cart_items').delete().eq('id', removed._dbId).then();
    } else {
      this._cartCache[index].quantity = newQuantity;
      if (this._currentUser && this._cartCache[index]._dbId) {
        supabase.from('cart_items').update({ quantity: newQuantity }).eq('id', this._cartCache[index]._dbId).then();
      }
    }
    if (!this._currentUser) localStorage.setItem('kb_cart', JSON.stringify(this._cartCache));
  }

  removeFromCart(index) {
    const removed = this._cartCache.splice(index, 1)[0];
    if (this._currentUser && removed?._dbId) supabase.from('cart_items').delete().eq('id', removed._dbId).then();
    if (!this._currentUser) localStorage.setItem('kb_cart', JSON.stringify(this._cartCache));
  }

  clearCart() {
    if (this._currentUser) supabase.from('cart_items').delete().eq('user_id', this._currentUser.id).then();
    this._cartCache = [];
    localStorage.setItem('kb_cart', JSON.stringify([]));
  }

  async _mergeGuestCart() {
    const guestCart = JSON.parse(localStorage.getItem('kb_cart') || '[]');
    if (guestCart.length === 0 || !this._currentUser) return;
    for (const item of guestCart) {
      await supabase.from('cart_items').insert({
        user_id: this._currentUser.id, product_id: item.productId, size: item.size, color: item.color, quantity: item.quantity
      });
    }
    localStorage.setItem('kb_cart', JSON.stringify([]));
    await this._loadCart();
  }

  // ---- WISHLIST (cache-first, async-write) ----
  getWishlist() { return this._wishlistCache; }
  isInWishlist(productId) { return this._wishlistCache.includes(productId); }

  toggleWishlist(productId) {
    if (this._wishlistCache.includes(productId)) {
      this._wishlistCache = this._wishlistCache.filter(id => id !== productId);
      if (this._currentUser) supabase.from('wishlist').delete().eq('user_id', this._currentUser.id).eq('product_id', productId).then();
    } else {
      this._wishlistCache.push(productId);
      if (this._currentUser) supabase.from('wishlist').insert({ user_id: this._currentUser.id, product_id: productId }).then();
    }
    if (!this._currentUser) localStorage.setItem('kb_wishlist', JSON.stringify(this._wishlistCache));
  }

  // ---- ORDERS ----
  async addOrder(orderData, status = 'pending_payment') {
    // Fix #9: timestamp + random suffix prevents collisions
    const orderId = 'ORD-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    // Fix #12: ensure address is stored inside customer_info
    const customerInfo = {
      name: orderData.customer.name,
      email: orderData.customer.email,
      phone: orderData.customer.phone,
      address: orderData.customer.address || ''
    };
    const { error } = await supabase.from('orders').insert({
      id: orderId, user_id: this._currentUser?.id || null, status,
      subtotal: orderData.subtotal, discount_amount: orderData.discount,
      delivery_fee: orderData.deliveryFee, total: orderData.total,
      payment_method: orderData.paymentMethod || 'paystack',
      customer_info: customerInfo
    });
    if (error) { console.error('[DB] Order insert error:', error); return null; }

    // Insert order items
    const items = (orderData.items || []).map(item => ({
      order_id: orderId, product_id: item.productId, size: item.size, color: item.color, quantity: item.quantity
    }));
    if (items.length > 0) {
      const { error: itemsErr } = await supabase.from('order_items').insert(items);
      if (itemsErr) console.error('[DB] Order items error:', itemsErr);
    }

    return { ...orderData, id: orderId, date: new Date().toISOString(), status };
  }

  // Fix #13: save payment reference after successful payment
  async savePaymentRef(orderId, ref) {
    const { error } = await supabase.from('orders').update({ payment_ref: ref }).eq('id', orderId);
    if (error) console.error('[DB] Payment ref save error:', error);
    return !error;
  }

  // Fix #3: proper deleteOrder method so admin can call db.deleteOrder()
  async deleteOrder(orderId) {
    const { error } = await supabase.from('orders').delete().eq('id', orderId);
    if (error) { console.error('[DB] Delete order error:', error); return false; }
    return true;
  }

  async updateOrderStatus(orderId, newStatus) {
    const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
    return !error;
  }

  async requestCancellation(orderId) {
    const { data } = await supabase.from('orders').select('status').eq('id', orderId).single();
    if (data && ['pending_payment', 'Processing', 'paid'].includes(data.status)) {
      await supabase.from('orders').update({ status: 'Cancellation Requested' }).eq('id', orderId);
      return true;
    }
    return false;
  }

  // Fix #7: validate promo codes against the database, not client-side hardcoded strings
  async validatePromoCode(code) {
    const { data, error } = await supabase
      .from('promo_codes')
      .select('discount_percent')
      .eq('code', code.toUpperCase().trim())
      .eq('is_active', true)
      .single();
    if (error || !data) return { valid: false, discount: 0 };
    return { valid: true, discount: data.discount_percent };
  }

  async getOrders() {
    const { data } = await supabase.from('orders').select('*, order_items(*)').order('created_at', { ascending: false });
    return (data || []).map(o => ({
      id: o.id, date: o.created_at, status: o.status, total: Number(o.total),
      userId: o.user_id,
      subtotal: Number(o.subtotal), discount: Number(o.discount_amount), deliveryFee: Number(o.delivery_fee),
      paymentMethod: o.payment_method, paymentRef: o.payment_ref,
      customer: o.customer_info,
      items: (o.order_items || []).map(i => ({ productId: i.product_id, size: i.size, color: i.color, quantity: i.quantity }))
    }));
  }

  async getUserOrders(userId) {
    if (!this._currentUser) return [];
    const { data } = await supabase.from('orders').select('*, order_items(*)')
      .eq('user_id', this._currentUser.id).order('created_at', { ascending: false });
    return (data || []).map(o => ({
      id: o.id, date: o.created_at, status: o.status, total: Number(o.total),
      customer: o.customer_info,
      items: (o.order_items || []).map(i => ({ productId: i.product_id, size: i.size, color: i.color, quantity: i.quantity }))
    }));
  }

  async getOrderById(orderId) {
    const { data } = await supabase.from('orders').select('*, order_items(*)').eq('id', orderId).single();
    if (!data) return null;
    return {
      id: data.id, date: data.created_at, status: data.status, total: Number(data.total),
      customer: data.customer_info,
      items: (data.order_items || []).map(i => ({ productId: i.product_id, size: i.size, color: i.color, quantity: i.quantity }))
    };
  }

  // ---- ADMIN: Products ----
  async addProduct(productData) {
    const { data, error } = await supabase.from('products').insert({
      name: productData.name, price: productData.price,
      original_price: productData.originalPrice || null, discount: productData.discount || null,
      rating: 5.0, reviews: 0, category: productData.category, brand: productData.brand || null,
      gender: productData.gender, style: productData.style, sizes: productData.sizes || [],
      colors: productData.colors || [], color_stock: productData.colorStock || {},
      images: productData.images || [], tag: productData.tag || 'new',
      description: productData.description, in_stock: productData.inStock !== false
    }).select().single();
    if (error) { console.error('[DB] Add product error:', error); return null; }
    const mapped = { ...productData, id: data.id, rating: 5.0, reviews: 0 };
    this._productsCache.push(mapped);
    return mapped;
  }

  async updateProduct(productId, updatedData) {
    const dbData = {};
    if (updatedData.name !== undefined) dbData.name = updatedData.name;
    if (updatedData.price !== undefined) dbData.price = updatedData.price;
    if (updatedData.originalPrice !== undefined) dbData.original_price = updatedData.originalPrice;
    if (updatedData.discount !== undefined) dbData.discount = updatedData.discount;
    if (updatedData.category !== undefined) dbData.category = updatedData.category;
    if (updatedData.brand !== undefined) dbData.brand = updatedData.brand;
    if (updatedData.gender !== undefined) dbData.gender = updatedData.gender;
    if (updatedData.style !== undefined) dbData.style = updatedData.style;
    if (updatedData.sizes !== undefined) dbData.sizes = updatedData.sizes;
    if (updatedData.colors !== undefined) dbData.colors = updatedData.colors;
    if (updatedData.colorStock !== undefined) dbData.color_stock = updatedData.colorStock;
    if (updatedData.images !== undefined) dbData.images = updatedData.images;
    if (updatedData.tag !== undefined) dbData.tag = updatedData.tag;
    if (updatedData.description !== undefined) dbData.description = updatedData.description;
    if (updatedData.inStock !== undefined) dbData.in_stock = updatedData.inStock;

    const { error } = await supabase.from('products').update(dbData).eq('id', productId);
    if (error) { console.error('[DB] Update product error:', error); return null; }
    const idx = this._productsCache.findIndex(p => p.id === productId);
    if (idx > -1) this._productsCache[idx] = { ...this._productsCache[idx], ...updatedData };
    return this._productsCache[idx] || null;
  }

  async deleteProduct(productId) {
    const { error } = await supabase.from('products').delete().eq('id', productId);
    if (error) { console.error('[DB] Delete product error:', error); return false; }
    this._productsCache = this._productsCache.filter(p => p.id !== productId);
    return true;
  }

  async updateProductStock(productId, inStockStatus) {
    return this.updateProduct(productId, { inStock: inStockStatus });
  }

  // ---- ADMIN: Customers ----
  async getCustomers() {
    const { data: profiles } = await supabase.from('profiles').select('*').neq('role', 'admin');
    const orders = await this.getOrders();
    return (profiles || []).map(u => {
      // Join by user_id (correct FK) — email-join breaks for guest orders
      const userOrders = orders.filter(o => o.userId === u.id);
      return { ...u, orderCount: userOrders.length, totalSpend: userOrders.reduce((s, o) => s + o.total, 0) };
    });
  }

  // ---- REVIEWS (real Supabase) ----
  async getReviews(productId) {
    const { data, error } = await supabase
      .from('reviews')
      .select('*, profiles(name)')
      .eq('product_id', productId)
      .order('created_at', { ascending: false });
    if (error) { console.error('[DB] Reviews load error:', error); return []; }
    return (data || []).map(r => ({
      id: r.id,
      userId: r.user_id,
      user: r.profiles?.name || 'Anonymous',
      text: r.body,
      rating: r.rating,
      verified: r.verified_purchase,
      date: new Date(r.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    }));
  }

  async addReview(productId, rating, body) {
    if (!this._currentUser) return { success: false, message: 'You must be logged in to leave a review.' };

    // Fix #8: check if user has a delivered order containing this product
    const userOrders = await this.getUserOrders();
    const hasBought = userOrders.some(o =>
      o.status === 'Delivered' &&
      o.items.some(i => i.productId === productId)
    );

    const { error } = await supabase.from('reviews').insert({
      product_id: productId,
      user_id: this._currentUser.id,
      rating,
      body,
      verified_purchase: hasBought  // Fix #8: set true if they actually purchased
    });
    if (error) return { success: false, message: error.message };

    // Fix #15: recalculate and update the product's live rating and review count
    const { data: allReviews } = await supabase.from('reviews').select('rating').eq('product_id', productId);
    if (allReviews && allReviews.length > 0) {
      const avgRating = allReviews.reduce((s, r) => s + r.rating, 0) / allReviews.length;
      await supabase.from('products').update({
        rating: Math.round(avgRating * 10) / 10,
        reviews: allReviews.length
      }).eq('id', productId);
      // Update local cache too
      const idx = this._productsCache?.findIndex(p => p.id === productId);
      if (idx > -1) {
        this._productsCache[idx].rating = Math.round(avgRating * 10) / 10;
        this._productsCache[idx].reviews = allReviews.length;
      }
    }
    return { success: true };
  }

  async editReview(productId, rating, body) {
    if (!this._currentUser) return { success: false, message: 'You must be logged in.' };
    const { error } = await supabase.from('reviews')
      .update({ rating, body })
      .eq('product_id', productId)
      .eq('user_id', this._currentUser.id);
    if (error) return { success: false, message: error.message };
    return { success: true };
  }

  async deleteReview(productId) {
    if (!this._currentUser) return { success: false, message: 'You must be logged in.' };
    const { error } = await supabase.from('reviews')
      .delete()
      .eq('product_id', productId)
      .eq('user_id', this._currentUser.id);
    if (error) return { success: false, message: error.message };
    return { success: true };
  }

  // ---- TESTIMONIALS (unchanged) ----
  getTestimonials() {
    return [
      { name: "Sarah M.", text: "The quality of these clothes is unmatched.", rating: 5, verified: true },
      { name: "Alex K.", text: "Finding my style was never easier. The modern designs perfectly match what I was looking for.", rating: 5, verified: true },
      { name: "James L.", text: "As someone who appreciates craftsmanship, KB.ENT delivers on every front. Highly recommended.", rating: 4.8, verified: true },
      { name: "Elena R.", text: "Super fast shipping and the packaging felt so premium. Will definitely shop here again.", rating: 5, verified: true },
      { name: "David O.", text: "The formal suits are incredibly comfortable. Best purchase for my business meetings.", rating: 4.9, verified: false }
    ];
  }
}

export const db = new KBDatabase();

/**
 * Escapes user-supplied strings before injecting them into innerHTML.
 * Prevents XSS attacks from review bodies, customer names, etc.
 * Usage: element.innerHTML = `<p>${escapeHTML(userText)}</p>`
 */
export function escapeHTML(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}


// --- Global Header Search & Mobile Menu ---
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.querySelector('.header-search input');
    if (searchInput) {
      searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          const val = searchInput.value.trim();
          if (val) window.location.href = `/category.html?search=${encodeURIComponent(val)}`;
        }
      });
    }

    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const navLinks = document.getElementById('navLinks');
    const navDropdown = document.querySelector('.nav-dropdown');
    const navDropdownToggle = document.querySelector('.nav-dropdown-toggle');
    if (mobileMenuBtn && navLinks) {
      mobileMenuBtn.addEventListener('click', () => { navLinks.classList.toggle('mobile-open'); mobileMenuBtn.classList.toggle('active'); });
      navDropdownToggle?.addEventListener('click', (e) => { if (window.innerWidth <= 768) { e.preventDefault(); navDropdown?.classList.toggle('mobile-open'); } });
      document.addEventListener('click', (e) => {
        if (navLinks.classList.contains('mobile-open') && !navLinks.contains(e.target) && !mobileMenuBtn.contains(e.target)) {
          navLinks.classList.remove('mobile-open'); mobileMenuBtn.classList.remove('active');
          if (navDropdown) navDropdown.classList.remove('mobile-open');
        }
      });
    }
  });
}
