/* ============================================
   stress_d Database — Supabase Backend (Next.js port of db.js)
   ============================================ */
import { getClient } from './supabase/client';
import type { Product, CartItem, User, Order, FeaturedReview } from './types';
import { compressImage, dataUrlToBlob, extensionFor } from './imageUpload';

const PRODUCT_IMAGE_BUCKET = 'product-images';

class KBDatabase {
  private _productsCache: Product[] | null = null;
  private _cartCache: CartItem[] = [];
  private _wishlistCache: number[] = [];
  private _currentUser: User | null = null;
  private _initialized = false;
  private _initPromise: Promise<void> | null = null;

  // Must be called before any other method (client-side only).
  // Concurrent callers share one in-flight load instead of each re-fetching everything.
  init(): Promise<void> {
    if (this._initialized) return Promise.resolve();
    if (!this._initPromise) {
      this._initPromise = this._doInit().finally(() => { this._initPromise = null; });
    }
    return this._initPromise;
  }

  private async _doInit() {
    await this._loadProducts();
    await this._loadSession();
    if (this._currentUser) {
      await this._loadCart();
      await this._loadWishlist();
    } else {
      if (typeof window !== 'undefined') {
        this._cartCache = JSON.parse(localStorage.getItem('kb_cart') || '[]');
        this._wishlistCache = JSON.parse(localStorage.getItem('kb_wishlist') || '[]');
      }
    }
    this._initialized = true;
  }

  async _loadProducts() {
    const supabase = getClient();
    const [{ data, error }, { data: reviewRows, error: reviewError }] = await Promise.all([
      supabase.from('products').select('*').order('id'),
      supabase.from('reviews').select('product_id, rating'),
    ]);
    if (error) { console.error('[DB] Products load error:', error); this._productsCache = []; return; }
    if (reviewError) console.error('[DB] Review stats load error:', reviewError);

    // Ratings shown to shoppers come from real reviews only, so the star rating and
    // the review list on the product page always agree.
    const stats = new Map<number, { sum: number; count: number }>();
    for (const r of (reviewRows || []) as Array<{ product_id: number; rating: number }>) {
      const s = stats.get(r.product_id) || { sum: 0, count: 0 };
      s.sum += r.rating; s.count++;
      stats.set(r.product_id, s);
    }

    this._productsCache = (data || []).map((p: Record<string, unknown>) => ({
      id: p.id as number,
      name: p.name as string,
      price: Number(p.price),
      originalPrice: p.original_price ? Number(p.original_price) : null,
      discount: p.discount as number | null,
      rating: stats.has(p.id as number) ? Math.round((stats.get(p.id as number)!.sum / stats.get(p.id as number)!.count) * 10) / 10 : 0,
      reviews: stats.get(p.id as number)?.count ?? 0,
      category: p.category as string,
      brand: p.brand as string | null,
      gender: p.gender as string,
      style: p.style as string,
      sizes: (p.sizes as string[]) || [],
      colors: (p.colors as string[]) || [],
      colorStock: (p.color_stock as Record<string, boolean>) || {},
      images: (p.images as string[]) || [],
      tag: p.tag as string | null,
      description: p.description as string | null,
      inStock: p.in_stock as boolean,
    }));
  }

  async _loadSession() {
    const supabase = getClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      if (profile) {
        this._currentUser = {
          id: profile.id,
          name: profile.name,
          email: profile.email,
          phone: profile.phone,
          role: profile.role,
        };
      }
    }
  }

  async _loadCart() {
    if (!this._currentUser) return;
    const supabase = getClient();
    const { data } = await supabase.from('cart_items').select('*').eq('user_id', this._currentUser.id);
    this._cartCache = (data || []).map((item: Record<string, unknown>) => ({
      productId: item.product_id as number,
      size: item.size as string,
      color: item.color as string,
      quantity: item.quantity as number,
      _dbId: item.id as string,
    }));
  }

  async _loadWishlist() {
    if (!this._currentUser) return;
    const supabase = getClient();
    const { data } = await supabase.from('wishlist').select('product_id').eq('user_id', this._currentUser.id);
    this._wishlistCache = (data || []).map((w: Record<string, unknown>) => w.product_id as number);
  }

  // ---- PRODUCTS ----
  getProducts(): Product[] { return this._productsCache || []; }
  getProductById(id: number): Product | undefined { return this.getProducts().find(p => p.id === id); }

  getProductsByTag(tag: string): Product[] {
    const filtered = this.getProducts().filter(p => p.tag === tag);
    return tag === 'new' ? [...filtered].reverse().slice(0, 8) : filtered.slice(0, 8);
  }

  getProductsByBrand(brand: string): Product[] { return this.getProducts().filter(p => p.brand === brand); }
  getProductsByGender(gender: string): Product[] { return this.getProducts().filter(p => p.gender === gender || p.gender === 'Uni-sex'); }

  getBrands(): string[] {
    const brands = new Set(this.getProducts().map(p => p.brand).filter(Boolean) as string[]);
    return Array.from(brands).sort();
  }

  getComplementaryProducts(productId: number): Product[] {
    const current = this.getProductById(productId);
    if (!current) return [];
    const all = this.getProducts();
    let targetCats: string[] = [];
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

  getExploreProducts(excludeId: number): Product[] {
    return this.getProducts().filter(p => p.id !== excludeId).sort(() => 0.5 - Math.random()).slice(0, 8);
  }

  // ---- AUTH ----
  getCurrentUser(): User | null { return this._currentUser; }

  async login(email: string, password: string) {
    const supabase = getClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { success: false, message: error.message };
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
    if (!profile) {
      // Don't leave a half-signed-in session behind if the profile row is missing
      await supabase.auth.signOut();
      return { success: false, message: 'Your account profile could not be found. Please contact support.' };
    }
    this._currentUser = { id: profile.id, name: profile.name, email: profile.email, phone: profile.phone, role: profile.role };
    await this._mergeGuestCart();
    await this._loadWishlist();
    return { success: true, user: this._currentUser };
  }

  async signup(name: string, email: string, password: string, phone: string) {
    const supabase = getClient();
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const { data, error } = await supabase.auth.signUp({
      email, password,
      // Send the confirmation link back to whichever deployment the user signed up on
      options: { data: { name, phone }, emailRedirectTo: `${origin}/auth/confirm` }
    });
    if (error) return { success: false, message: error.message };
    // Supabase returns a user with no identities (and no error) when the email is already registered
    if (data.user && data.user.identities?.length === 0) {
      return { success: false, message: 'An account with this email already exists. Try logging in, or use "Forgot your password?".' };
    }
    // When email confirmation is enabled, session is null until the user confirms.
    if (!data.session) {
      return { success: true, emailConfirmationRequired: true };
    }
    this._currentUser = { id: data.user!.id, name, email, phone, role: 'customer' };
    await this._mergeGuestCart();
    return { success: true, user: this._currentUser };
  }

  async logout() {
    const supabase = getClient();
    await supabase.auth.signOut();
    this._currentUser = null;
    this._cartCache = [];
    this._wishlistCache = [];
    if (typeof window !== 'undefined') {
      localStorage.removeItem('kb_cart');
      localStorage.removeItem('kb_wishlist');
    }
    this._initialized = false;
  }

  /** Sends the sign-up confirmation email again (for "I didn't get the email") */
  async resendConfirmation(email: string) {
    const supabase = getClient();
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const { error } = await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: `${origin}/auth/confirm` } });
    if (error) return { success: false, message: error.message };
    return { success: true };
  }

  async requestPasswordReset(email: string) {
    const supabase = getClient();
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/confirm`, // see app/auth/confirm/route.ts
    });
    if (error) return { success: false, message: error.message };
    return { success: true };
  }

  async updatePassword(newPassword: string) {
    const supabase = getClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { success: false, message: error.message };
    return { success: true };
  }

  // ---- CART ----
  getCart(): CartItem[] { return this._cartCache; }
  getCartCount(): number { return this._cartCache.reduce((sum, item) => sum + item.quantity, 0); }
  getCartTotal(): number {
    return this._cartCache.reduce((total, item) => {
      const p = this.getProductById(item.productId);
      return total + (p ? p.price * item.quantity : 0);
    }, 0);
  }

  addToCart(productId: number, size: string, color: string, quantity = 1): Promise<void> {
    const supabase = getClient();
    const existing = this._cartCache.findIndex(item => item.productId === productId && item.size === size && item.color === color);
    let promise: Promise<void> = Promise.resolve();
    if (existing > -1) {
      this._cartCache[existing].quantity += quantity;
      if (this._currentUser && this._cartCache[existing]._dbId) {
        promise = Promise.resolve(supabase.from('cart_items').update({ quantity: this._cartCache[existing].quantity }).eq('id', this._cartCache[existing]._dbId).then(() => {}));
      }
    } else {
      const newItem: CartItem = { productId, size, color, quantity };
      this._cartCache.push(newItem);
      if (this._currentUser) {
        promise = Promise.resolve(supabase.from('cart_items').insert({ user_id: this._currentUser.id, product_id: productId, size, color, quantity })
          .select().single().then(({ data }) => { if (data) newItem._dbId = data.id; }));
      }
    }
    if (!this._currentUser && typeof window !== 'undefined') localStorage.setItem('kb_cart', JSON.stringify(this._cartCache));
    return promise;
  }

  updateCartQuantity(index: number, newQuantity: number) {
    const supabase = getClient();
    if (newQuantity <= 0) {
      const removed = this._cartCache.splice(index, 1)[0];
      if (this._currentUser && removed?._dbId) supabase.from('cart_items').delete().eq('id', removed._dbId).then(() => {});
    } else {
      this._cartCache[index].quantity = newQuantity;
      if (this._currentUser && this._cartCache[index]._dbId) {
        supabase.from('cart_items').update({ quantity: newQuantity }).eq('id', this._cartCache[index]._dbId).then(() => {});
      }
    }
    if (!this._currentUser && typeof window !== 'undefined') localStorage.setItem('kb_cart', JSON.stringify(this._cartCache));
  }

  removeFromCart(index: number) {
    const supabase = getClient();
    const removed = this._cartCache.splice(index, 1)[0];
    if (this._currentUser && removed?._dbId) supabase.from('cart_items').delete().eq('id', removed._dbId).then(() => {});
    if (!this._currentUser && typeof window !== 'undefined') localStorage.setItem('kb_cart', JSON.stringify(this._cartCache));
  }

  clearCart() {
    const supabase = getClient();
    if (this._currentUser) supabase.from('cart_items').delete().eq('user_id', this._currentUser.id).then(() => {});
    this._cartCache = [];
    if (typeof window !== 'undefined') localStorage.setItem('kb_cart', JSON.stringify([]));
  }

  async _mergeGuestCart() {
    if (typeof window === 'undefined') return;
    const supabase = getClient();
    const guestCart: CartItem[] = JSON.parse(localStorage.getItem('kb_cart') || '[]');
    if (guestCart.length === 0 || !this._currentUser) return;
    for (const item of guestCart) {
      await supabase.from('cart_items').insert({
        user_id: this._currentUser.id, product_id: item.productId, size: item.size, color: item.color, quantity: item.quantity
      });
    }
    localStorage.setItem('kb_cart', JSON.stringify([]));
    await this._loadCart();
  }

  // ---- WISHLIST ----
  getWishlist(): number[] { return this._wishlistCache; }
  isInWishlist(productId: number): boolean { return this._wishlistCache.includes(productId); }

  toggleWishlist(productId: number) {
    const supabase = getClient();
    if (this._wishlistCache.includes(productId)) {
      this._wishlistCache = this._wishlistCache.filter(id => id !== productId);
      if (this._currentUser) supabase.from('wishlist').delete().eq('user_id', this._currentUser.id).eq('product_id', productId).then(() => {});
    } else {
      this._wishlistCache.push(productId);
      if (this._currentUser) supabase.from('wishlist').insert({ user_id: this._currentUser.id, product_id: productId }).then(() => {});
    }
    if (!this._currentUser && typeof window !== 'undefined') localStorage.setItem('kb_wishlist', JSON.stringify(this._wishlistCache));
  }

  // ---- ORDERS ----
  async addOrder(orderData: {
    customer: { name: string; email: string; phone: string; address: string };
    subtotal: number; discount: number; deliveryFee: number; total: number;
    paymentMethod?: string;
    items: Array<{ productId: number; size: string; color: string; quantity: number }>;
  }, status = 'pending_payment'): Promise<Order | null> {
    const supabase = getClient();
    const orderId = 'ORD-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    const customerInfo = {
      name: orderData.customer.name,
      email: orderData.customer.email,
      phone: orderData.customer.phone,
      address: orderData.customer.address || '',
    };
    const { error } = await supabase.from('orders').insert({
      id: orderId, user_id: this._currentUser?.id || null, status,
      subtotal: orderData.subtotal, discount_amount: orderData.discount,
      delivery_fee: orderData.deliveryFee, total: orderData.total,
      payment_method: orderData.paymentMethod || 'paystack',
      customer_info: customerInfo,
    });
    if (error) { console.error('[DB] Order insert error:', error); return null; }
    const items = orderData.items.map(item => ({
      order_id: orderId, product_id: item.productId, size: item.size, color: item.color, quantity: item.quantity,
      // Price paid per unit, so later price changes don't rewrite order history
      unit_price: this.getProductById(item.productId)?.price ?? null,
    }));
    if (items.length > 0) {
      let { error: itemsErr } = await supabase.from('order_items').insert(items);
      // Database not yet patched with the unit_price column (app/supabase_admin_patch.sql) — save without it
      if (itemsErr && /unit_price/.test(itemsErr.message)) {
        ({ error: itemsErr } = await supabase.from('order_items').insert(
          items.map(i => ({ order_id: i.order_id, product_id: i.product_id, size: i.size, color: i.color, quantity: i.quantity }))));
      }
      if (itemsErr) console.error('[DB] Order items error:', itemsErr);
    }
    return { ...orderData, id: orderId, date: new Date().toISOString(), status, customer: customerInfo };
  }

  async savePaymentRef(orderId: string, ref: string): Promise<boolean> {
    const supabase = getClient();
    // Mark order as paid and save the payment reference atomically
    const { error } = await supabase
      .from('orders')
      .update({ payment_ref: ref, status: 'paid' })
      .eq('id', orderId);
    if (error) console.error('[DB] Payment ref save error:', error);
    return !error;
  }

  async deleteOrder(orderId: string): Promise<boolean> {
    const supabase = getClient();
    const { error } = await supabase.from('orders').delete().eq('id', orderId);
    if (error) { console.error('[DB] Delete order error:', error); return false; }
    return true;
  }

  async updateOrderStatus(orderId: string, newStatus: string): Promise<boolean> {
    const supabase = getClient();
    const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
    if (!error && ['shipped', 'delivered', 'processing'].includes(newStatus.toLowerCase())) {
      try {
        await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-shipping-update`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({ orderId, newStatus })
        });
      } catch (err) {
        console.error('[DB] Failed to send shipping update email:', err);
      }
    }
    return !error;
  }

  async requestCancellation(orderId: string): Promise<boolean> {
    const supabase = getClient();
    const { data } = await supabase.from('orders').select('status').eq('id', orderId).single();
    if (data && ['pending_payment', 'Processing', 'paid'].includes(data.status)) {
      await supabase.from('orders').update({ status: 'Cancellation Requested' }).eq('id', orderId);
      return true;
    }
    return false;
  }

  async validatePromoCode(code: string): Promise<{ valid: boolean; discount: number; reason?: string }> {
    const supabase = getClient();
    const user = this._currentUser;
    const email = user?.email || '';
    if (!email) return { valid: false, discount: 0, reason: 'You must be logged in to use promo codes.' };

    const { data, error } = await supabase.rpc('validate_promo_code', {
      p_code: code.toUpperCase().trim(),
      p_email: email,
      p_user_id: user?.id || null,
    });
    if (error || !data || data.length === 0) return { valid: false, discount: 0, reason: 'Invalid or expired promo code.' };
    const row = data[0] as { is_valid: boolean; discount_percent: number; reason: string };
    return { valid: row.is_valid, discount: row.discount_percent || 0, reason: row.reason };
  }

  async recordPromoUse(code: string, customerEmail: string): Promise<void> {
    if (!code) return;
    const supabase = getClient();
    const user = this._currentUser;
    const { error } = await supabase.from('promo_uses').insert({
      promo_code: code.toUpperCase().trim(),
      normalized_email: customerEmail.toLowerCase().replace(/\+.*@/, '@'),
      user_id: user?.id || null,
    });
    if (error) console.warn('[DB] Could not record promo use (may already be recorded):', error.message);
  }

  async getOrders(limit = 200): Promise<Order[]> {
    const supabase = getClient();
    const { data } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .order('created_at', { ascending: false })
      .limit(limit);
    return (data || []).map((o: Record<string, unknown>) => ({
      id: o.id as string, date: o.created_at as string, status: o.status as string,
      total: Number(o.total), userId: o.user_id as string,
      subtotal: Number(o.subtotal), discount: Number(o.discount_amount), deliveryFee: Number(o.delivery_fee),
      paymentMethod: o.payment_method as string, paymentRef: o.payment_ref as string | null,
      customer: o.customer_info as Order['customer'],
      items: ((o.order_items as Record<string, unknown>[]) || []).map(i => ({
        productId: i.product_id as number, size: i.size as string, color: i.color as string, quantity: i.quantity as number,
        unitPrice: i.unit_price != null ? Number(i.unit_price) : undefined,
      }))
    }));
  }

  async getUserOrders(): Promise<Order[]> {
    if (!this._currentUser) return [];
    const supabase = getClient();
    const { data } = await supabase.from('orders').select('*, order_items(*)')
      .eq('user_id', this._currentUser.id).order('created_at', { ascending: false });
    return (data || []).map((o: Record<string, unknown>) => ({
      id: o.id as string, date: o.created_at as string, status: o.status as string,
      total: Number(o.total), discount: Number(o.discount_amount || 0), deliveryFee: Number(o.delivery_fee || 0),
      customer: o.customer_info as Order['customer'],
      items: ((o.order_items as Record<string, unknown>[]) || []).map(i => ({
        productId: i.product_id as number, size: i.size as string, color: i.color as string, quantity: i.quantity as number,
        unitPrice: i.unit_price != null ? Number(i.unit_price) : undefined,
      }))
    }));
  }

  async getOrderById(orderId: string): Promise<Order | null> {
    const supabase = getClient();
    const { data } = await supabase.from('orders').select('*, order_items(*)').eq('id', orderId).single();
    if (!data) return null;
    return {
      id: data.id, date: data.created_at, status: data.status, total: Number(data.total),
      customer: data.customer_info,
      items: (data.order_items || []).map((i: Record<string, unknown>) => ({ productId: i.product_id as number, size: i.size as string, color: i.color as string, quantity: i.quantity as number }))
    };
  }

  // ---- ADMIN: Products ----
  async addProduct(productData: Partial<Product>): Promise<Product | null> {
    const supabase = getClient();
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
    const mapped = { ...productData, id: data.id, rating: 5.0, reviews: 0 } as Product;
    this._productsCache?.push(mapped);
    return mapped;
  }

  async updateProduct(productId: number, updatedData: Partial<Product>): Promise<Product | null> {
    const supabase = getClient();
    const dbData: Record<string, unknown> = {};
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
    const idx = this._productsCache?.findIndex(p => p.id === productId) ?? -1;
    if (idx > -1 && this._productsCache) this._productsCache[idx] = { ...this._productsCache[idx], ...updatedData };
    return this._productsCache?.[idx] || null;
  }

  // ---- PRODUCT IMAGES (Supabase Storage) ----
  /** Compresses and uploads an image to the `product-images` bucket, returning its public URL. */
  async uploadProductImage(file: Blob, folder = 'products'): Promise<string> {
    const supabase = getClient();
    const blob = await compressImage(file);
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extensionFor(blob.type)}`;
    const { error } = await supabase.storage.from(PRODUCT_IMAGE_BUCKET).upload(path, blob, {
      contentType: blob.type,
      cacheControl: '31536000',
    });
    if (error) throw new Error(error.message);
    return supabase.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
  }

  /** Products whose images are still embedded as base64 data URLs in the table. */
  getProductsWithEmbeddedImages(): Product[] {
    return this.getProducts().filter(p => p.images.some(img => img.startsWith('data:')));
  }

  /** Moves every embedded base64 image into Storage and rewrites the product rows to use the URLs. */
  async migrateEmbeddedImages(): Promise<{ migrated: number; failed: { id: number; message: string }[] }> {
    const failed: { id: number; message: string }[] = [];
    let migrated = 0;
    for (const product of this.getProductsWithEmbeddedImages()) {
      try {
        const images: string[] = [];
        for (const img of product.images) {
          images.push(img.startsWith('data:') ? await this.uploadProductImage(await dataUrlToBlob(img)) : img);
        }
        const updated = await this.updateProduct(product.id, { images });
        if (!updated) throw new Error('Could not save the new image URLs.');
        migrated++;
      } catch (e) {
        failed.push({ id: product.id, message: e instanceof Error ? e.message : String(e) });
      }
    }
    return { migrated, failed };
  }

  /**
   * Deletes a product only if no order contains it. The database cascades product
   * deletes into order_items, so deleting an ordered product would erase it from
   * customers' order history — those products should be marked out of stock instead.
   */
  async deleteProduct(productId: number): Promise<{ success: boolean; message?: string }> {
    const supabase = getClient();
    const { count, error: countError } = await supabase
      .from('order_items').select('id', { count: 'exact', head: true }).eq('product_id', productId);
    if (countError) return { success: false, message: countError.message };
    if (count && count > 0) {
      return { success: false, message: `This product appears in ${count} order line(s). Deleting it would remove it from those orders, so mark it Out of Stock instead.` };
    }
    const { error } = await supabase.from('products').delete().eq('id', productId);
    if (error) { console.error('[DB] Delete product error:', error); return { success: false, message: error.message }; }
    this._productsCache = this._productsCache?.filter(p => p.id !== productId) || [];
    return { success: true };
  }

  async getCustomers() {
    const supabase = getClient();
    const { data: profiles } = await supabase.from('profiles').select('*').neq('role', 'admin');
    const orders = await this.getOrders();
    return (profiles || []).map((u: Record<string, unknown>) => {
      const userOrders = orders.filter(o => o.userId === u.id);
      return { ...u, orderCount: userOrders.length, totalSpend: userOrders.reduce((s, o) => s + o.total, 0) };
    });
  }

  // ---- REVIEWS ----
  async getReviews(productId: number) {
    const supabase = getClient();
    const { data, error } = await supabase
      .from('reviews')
      .select('*, profiles(name)')
      .eq('product_id', productId)
      .order('created_at', { ascending: false });
    if (error) { console.error('[DB] Reviews load error:', error); return []; }
    return (data || []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      userId: r.user_id as string,
      user: (r.profiles as Record<string, unknown>)?.name as string || 'Anonymous',
      text: r.body as string,
      rating: r.rating as number,
      verified: r.verified_purchase as boolean,
      date: new Date(r.created_at as string).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    }));
  }

  async addReview(productId: number, rating: number, body: string) {
    if (!this._currentUser) return { success: false, message: 'You must be logged in to leave a review.' };
    const supabase = getClient();
    const userOrders = await this.getUserOrders();
    const hasBought = userOrders.some(o =>
      o.status === 'Delivered' && o.items.some(i => i.productId === productId)
    );
    const { error } = await supabase.from('reviews').insert({
      product_id: productId, user_id: this._currentUser.id, rating, body, verified_purchase: hasBought
    });
    if (error) return { success: false, message: error.message };
    const { data: allReviews } = await supabase.from('reviews').select('rating').eq('product_id', productId);
    if (allReviews && allReviews.length > 0) {
      const avgRating = allReviews.reduce((s: number, r: Record<string, unknown>) => s + (r.rating as number), 0) / allReviews.length;
      await supabase.from('products').update({
        rating: Math.round(avgRating * 10) / 10, reviews: allReviews.length
      }).eq('id', productId);
      const idx = this._productsCache?.findIndex(p => p.id === productId) ?? -1;
      if (idx > -1 && this._productsCache) {
        this._productsCache[idx].rating = Math.round(avgRating * 10) / 10;
        this._productsCache[idx].reviews = allReviews.length;
      }
    }
    return { success: true };
  }

  async editReview(productId: number, rating: number, body: string) {
    if (!this._currentUser) return { success: false, message: 'You must be logged in.' };
    const supabase = getClient();
    const { error } = await supabase.from('reviews')
      .update({ rating, body })
      .eq('product_id', productId)
      .eq('user_id', this._currentUser.id);
    if (error) return { success: false, message: error.message };
    return { success: true };
  }

  async deleteReview(productId: number) {
    if (!this._currentUser) return { success: false, message: 'You must be logged in.' };
    const supabase = getClient();
    const { error } = await supabase.from('reviews')
      .delete()
      .eq('product_id', productId)
      .eq('user_id', this._currentUser.id);
    if (error) return { success: false, message: error.message };
    return { success: true };
  }

  // ---- SITE SETTINGS ----
  // Reads a single key from the `site_settings` table.
  // Falls back to `defaultValue` if the table doesn't exist yet or the row is missing.
  async getSiteSetting(key: string, defaultValue: unknown = null): Promise<unknown> {
    const supabase = getClient();
    const { data, error } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', key)
      .single();
    if (error || !data) return defaultValue;
    return data.value;
  }

  async setSiteSetting(key: string, value: unknown): Promise<boolean> {
    const supabase = getClient();
    const { error } = await supabase
      .from('site_settings')
      .upsert({ key, value }, { onConflict: 'key' });
    if (error) { console.error('[DB] setSiteSetting error:', error); return false; }
    return true;
  }

  // ---- TESTIMONIALS ----

  /**
   * Real customer reviews for the homepage (4★ and up, newest first), plus store-wide
   * rating stats. Replaces the old hard-coded testimonials, which weren't real customers.
   */
  async getFeaturedReviews(limit = 12): Promise<{ reviews: FeaturedReview[]; average: number; count: number }> {
    const supabase = getClient();
    const { data, error } = await supabase
      .from('reviews')
      .select('id, rating, body, created_at, verified_purchase, product_id, profiles(name)')
      .gte('rating', 4)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) console.error('[DB] Featured reviews error:', error);
    // Show "Kwame M." rather than a customer's full name
    const shortName = (full: string) => {
      const [first, ...rest] = (full || 'Customer').trim().split(/\s+/);
      return rest.length ? `${first} ${rest[rest.length - 1][0].toUpperCase()}.` : first;
    };
    const reviews = (data || []).filter(r => (r.body as string)?.trim()).map((r: Record<string, unknown>) => ({
      id: String(r.id),
      name: shortName(((r.profiles as { name?: string } | null)?.name) || 'Customer'),
      text: r.body as string,
      rating: r.rating as number,
      verified: !!r.verified_purchase,
      date: r.created_at as string,
      product: this.getProductById(r.product_id as number) || null,
    }));
    const totals = this.getProducts().reduce((t, p) => ({ sum: t.sum + p.rating * p.reviews, count: t.count + p.reviews }), { sum: 0, count: 0 });
    return { reviews, average: totals.count ? Math.round((totals.sum / totals.count) * 10) / 10 : 0, count: totals.count };
  }
}



export const db = new KBDatabase();

export function escapeHTML(str: unknown): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
