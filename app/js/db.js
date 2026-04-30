/* ============================================
   Mock Database & State Management
   ============================================ */

const PRODUCTS = [
  {
    id: 1,
    name: "Classic Graphic T-Shirt",
    price: 45,
    originalPrice: null,
    discount: null,
    rating: 4.5,
    reviews: 128,
    category: "tshirts",
    brand: "Nike",
    gender: "Men",
    style: "casual",
    sizes: ["Small", "Medium", "Large", "X-Large"],
    colors: ["#000000", "#4B5563"],
    colorStock: { "#000000": true, "#4B5563": true },
    images: ["/assets/images/graphic_tshirt.jpg", "/assets/images/tshirt_icon_pic.jpg"],
    tag: "new",
    description: "Premium oversized graphic T-shirt that fits your aesthetic. Made from 100% thick cotton.",
    inStock: true
  },
  {
    id: 2,
    name: "Baggy Casual Jeans",
    price: 65,
    originalPrice: 85,
    discount: 25,
    rating: 4.8,
    reviews: 112,
    category: "jeans",
    brand: "Zara",
    gender: "Men",
    style: "casual",
    sizes: ["30", "32", "34", "36"],
    colors: ["#7FA6D6", "#000000"],
    colorStock: { "#7FA6D6": true, "#000000": true },
    images: ["/assets/images/baggy_casual_jeans.jpg", "/assets/images/baggy casual black.jpg", "/assets/images/mens_casual_pants.jpg"],
    description: "Ultra-comfortable baggy denim jeans fit for any street style look.",
    tag: "top",
    inStock: true
  },
  {
    id: 3,
    name: "Boxy Hoodie",
    price: 120,
    rating: 4.9,
    reviews: 320,
    category: "hoodies",
    brand: "Adidas",
    gender: "Uni-sex",
    style: "casual",
    sizes: ["Medium", "Large", "X-Large"],
    colors: ["#D1D5DB", "#000000"],
    colorStock: { "#D1D5DB": true, "#000000": true },
    images: ["/assets/images/Boxy hoodie_.jpg", "/assets/images/Hoodie.jpg"],
    tag: "sale",
    description: "Thick, boxy hoodie. Featuring dropped shoulders and a heavy 400gsm cotton blend.",
    inStock: true
  },
  {
    id: 4,
    name: "Tailored Motionflex Suit",
    price: 250,
    originalPrice: 300,
    discount: 16,
    rating: 4.7,
    reviews: 89,
    category: "suits",
    brand: "Hugo Boss",
    gender: "Men",
    style: "formal",
    sizes: ["38R", "40R", "42R", "44R"],
    colors: ["#000000", "#4B5563"],
    colorStock: { "#000000": true, "#4B5563": true },
    images: ["/assets/images/black suit.jpg", "/assets/images/grey suit.jpg", "/assets/images/Mens Next Black Tailored Fit Wool Blend Motionflex Suit Trousers -  black.jpg"],
    description: "Sharp, elegant, and surprisingly stretchy. Complete your formal look without sacrificing comfort.",
    tag: "top",
    inStock: true
  },
  {
    id: 5,
    name: "Signature Cap",
    price: 25,
    rating: 4.2,
    reviews: 45,
    category: "accessories",
    brand: "Puma",
    gender: "Uni-sex",
    style: "gym",
    sizes: ["One Size"],
    colors: ["#000000", "#FFFFFF"],
    colorStock: { "#000000": false, "#FFFFFF": false },
    images: ["/assets/images/SIG CAP.jpg", "/assets/images/cap icon.jpg", "/assets/images/cap1.jpg", "/assets/images/cap3.jpg"],
    tag: "new",
    description: "Classic snapback cap with our signature embroidery. Works perfectly for sunny days or gym sessions.",
    inStock: false
  },
  {
    id: 6,
    name: "90's Punk Style Vest",
    price: 85,
    rating: 4.9,
    reviews: 215,
    category: "shirts",
    brand: "H&M",
    gender: "Men",
    style: "party",
    sizes: ["Small", "Medium", "Large", "X-Large"],
    colors: ["#000000", "#FFFFFF"],
    colorStock: { "#000000": true, "#FFFFFF": true },
    images: ["/assets/images/punk_vest.jpg", "/assets/images/vest1.jpg", "/assets/images/vest2.jpg"],
    tag: "new",
    description: "Channel your inner rebel with this 90's punk-inspired vest. Distressed details and a raw edge finish make it a statement piece.",
    inStock: true
  },
  {
    id: 7,
    name: "Performance Gym Top",
    price: 45,
    rating: 4.6,
    reviews: 310,
    category: "tshirts",
    brand: "Under Armour",
    gender: "Men",
    style: "gym",
    sizes: ["Small", "Medium", "Large"],
    colors: ["#333333", "#000000"],
    colorStock: { "#333333": true, "#000000": true },
    images: ["/assets/images/gym product 1.jpg"],
    description: "Moisture-wicking, breathable gym wear that helps you hit your PRs.",
    inStock: true
  },
  {
    id: 8,
    name: "Leather Jacket",
    price: 280,
    originalPrice: 350,
    discount: 20,
    rating: 5.0,
    reviews: 180,
    category: "jackets",
    brand: "Zara",
    gender: "Men",
    style: "party",
    sizes: ["Medium", "Large", "X-Large"],
    colors: ["#000000"],
    colorStock: { "#000000": true },
    images: ["/assets/images/leather jacket.jpg"],
    description: "Real biker leather jacket. Guaranteed to turn heads everywhere you go.",
    tag: "top",
    inStock: true
  },
  {
    id: 9,
    name: "Classic Lacoste Polo",
    price: 90,
    rating: 4.7,
    reviews: 420,
    category: "tshirts",
    brand: "Lacoste",
    gender: "Men",
    style: "casual",
    sizes: ["Medium", "Large", "X-Large"],
    colors: ["#FFFFFF", "#000000"],
    colorStock: { "#FFFFFF": true, "#000000": true },
    images: ["/assets/images/lacoste1.jpg", "/assets/images/lacoste2.jpg", "/assets/images/classy casual.jpg"],
    tag: "featured",
    description: "Premium knit polo shirt with excellent breathability.",
    inStock: true
  },
  {
    id: 10,
    name: "Classic T-Shirt",
    price: 35,
    rating: 3.8,
    reviews: 18,
    tag: "sale",
    category: "tshirts",
    brand: "H&M",
    gender: "Uni-sex",
    style: "casual",
    sizes: ["Small", "Medium"],
    colors: ["#FFFFFF", "#0000FF"],
    colorStock: { "#FFFFFF": true, "#0000FF": true },
    images: ["/assets/images/tshirt3.jpg", "/assets/images/Graphic T-shirt.jpg"],
    description: "Classic staple t-shirt that goes with almost everything.",
    inStock: true
  },
  {
    id: 11,
    name: "FC Barcelona Jersey",
    price: 95,
    rating: 4.8,
    reviews: 210,
    tag: "featured",
    category: "jerseys",
    brand: "Nike",
    gender: "Men",
    style: "gym",
    sizes: ["Medium", "Large", "X-Large"],
    colors: ["#A50044"],
    colorStock: { "#A50044": true },
    images: ["/assets/images/epl jersey.jpg"],
    description: "Official 24/25 replica jersey. Visca el Barca/EPL!",
    inStock: true
  },
  {
    id: 12,
    name: "Chelsea FC Jersey",
    price: 90,
    rating: 4.6,
    reviews: 145,
    category: "jerseys",
    brand: "Nike",
    gender: "Men",
    style: "gym",
    sizes: ["Small", "Medium", "Large"],
    colors: ["#034694"],
    colorStock: { "#034694": false },
    images: ["/assets/images/chelsea.jpg"],
    description: "Pride of London. Excellent breathable materials for maximum performance.",
    inStock: false
  },
  {
    id: 13,
    name: "Liverpool Home Kit",
    price: 90,
    rating: 4.9,
    reviews: 320,
    category: "jerseys",
    brand: "Nike",
    gender: "Men",
    style: "gym",
    sizes: ["Large", "X-Large"],
    colors: ["#C8102E"],
    colorStock: { "#C8102E": true },
    images: ["/assets/images/liverpool football club.jpg"],
    description: "You'll Never Walk Alone. Stand out at Anfield with the latest home kit.",
    inStock: true
  },
  {
    id: 14,
    name: "Ghana Black Stars Home",
    price: 85,
    rating: 4.7,
    reviews: 280,
    tag: "top",
    category: "jerseys",
    brand: "Puma",
    gender: "Men",
    style: "casual",
    sizes: ["Medium", "Large"],
    colors: ["#FFFFFF"],
    colorStock: { "#FFFFFF": true },
    images: ["/assets/images/ghana jersey1.jpg", "/assets/images/ghana jersey2.jpg"],
    description: "Rep the Black Stars. Premium sweat-wicking materials.",
    inStock: true
  },
  {
    id: 15,
    name: "Classic Leather Boots",
    price: 150,
    rating: 4.6,
    reviews: 90,
    category: "shoes",
    brand: "Clarks",
    gender: "Men",
    style: "formal",
    sizes: ["40", "41", "42", "43", "44"],
    colors: ["#654321", "#000000"],
    colorStock: { "#654321": true, "#000000": true },
    images: ["/assets/images/shoe1.jpg"],
    description: "Timeless leather boots perfect for completing your formal or smart-casual outfit.",
    tag: "top",
    inStock: true
  },
  {
    id: 16,
    name: "Urban Sneakers",
    price: 110,
    rating: 4.5,
    reviews: 175,
    category: "shoes",
    brand: "Adidas",
    gender: "Men",
    style: "casual",
    sizes: ["41", "42", "43", "45"],
    colors: ["#FFFFFF", "#CCCCCC"],
    colorStock: { "#FFFFFF": false, "#CCCCCC": false },
    images: ["/assets/images/shoe2.jpg"],
    description: "Comfort meets street style with these everyday wear urban sneakers.",
    inStock: false
  },
  {
    id: 17,
    name: "High-Top Athletics",
    price: 180,
    rating: 4.9,
    reviews: 410,
    tag: "new",
    category: "shoes",
    brand: "Nike",
    gender: "Men",
    style: "party",
    sizes: ["42", "43", "44"],
    colors: ["#000000", "#FF0000"],
    colorStock: { "#000000": true, "#FF0000": true },
    images: ["/assets/images/shoe3_pic.jpg", "/assets/images/shoe3_video.jpg"],
    description: "Make a statement with these premium high-top athletic shoes.",
    inStock: true
  }
];

class KBDatabase {
  constructor() {
    this._initProducts();
    this._initCart();
    this._initWishlist();
    this._initOrders();
    this._initUsers();
  }

  _initProducts() {
    if (!localStorage.getItem('kb_products')) {
      localStorage.setItem('kb_products', JSON.stringify(PRODUCTS));
    }
  }

  _initCart() {
    if (!localStorage.getItem('kb_cart')) {
      localStorage.setItem('kb_cart', JSON.stringify([]));
    }
  }

  _initWishlist() {
    if (!localStorage.getItem('kb_wishlist')) {
      localStorage.setItem('kb_wishlist', JSON.stringify([]));
    }
  }

  _initOrders() {
    if (!localStorage.getItem('kb_orders')) {
      // Seed with realistic demo orders
      const seed = [
        { id: 'ORD-4821', date: new Date(Date.now() - 1000*60*60*2).toISOString(), status: 'Processing', total: 155, customer: { name: 'Kwame Asante', email: 'kwame@gmail.com', phone: '0241112233' }, items: [{productId:1, size:'L', color:'#000', quantity:2},{productId:5, size:'OS', color:'#000', quantity:1}] },
        { id: 'ORD-3317', date: new Date(Date.now() - 1000*60*60*26).toISOString(), status: 'Shipped', total: 250, customer: { name: 'Abena Mensah', email: 'abena@gmail.com', phone: '0551223344' }, items: [{productId:4, size:'40R', color:'#000', quantity:1}] },
        { id: 'ORD-2209', date: new Date(Date.now() - 1000*60*60*72).toISOString(), status: 'Delivered', total: 390, customer: { name: 'Yaw Boateng', email: 'yaw@outlook.com', phone: '0241987654' }, items: [{productId:8, size:'L', color:'#000', quantity:1},{productId:2, size:'32', color:'#7FA6D6', quantity:2}] },
        { id: 'ORD-5503', date: new Date(Date.now() - 1000*60*60*120).toISOString(), status: 'Delivered', total: 90, customer: { name: 'Ama Owusu', email: 'ama.owusu@yahoo.com', phone: '0275556677' }, items: [{productId:9, size:'M', color:'#FFF', quantity:1}] },
        { id: 'ORD-1188', date: new Date(Date.now() - 1000*60*60*200).toISOString(), status: 'Delivered', total: 180, customer: { name: 'Kofi Adjei', email: 'kofi.adj@gmail.com', phone: '0209876543' }, items: [{productId:17, size:'43', color:'#000', quantity:1}] }
      ];
      localStorage.setItem('kb_orders', JSON.stringify(seed));
    }
  }

  _initUsers() {
    if (!localStorage.getItem('kb_users')) {
      // Create default accounts
      localStorage.setItem('kb_users', JSON.stringify([
        { id: 'usr_1', name: 'Demo User', email: 'demo@kb.ent', password: 'password123', phone: '0241234567', role: 'customer' },
        { id: 'usr_admin', name: 'KB Admin', email: 'admin@kb.ent', password: 'admin2026', phone: '0000000000', role: 'admin' }
      ]));
    }
    if (!localStorage.getItem('kb_current_user')) {
      localStorage.setItem('kb_current_user', null);
    }
  }

  // --- Auth & Users ---
  getCurrentUser() {
    return JSON.parse(localStorage.getItem('kb_current_user'));
  }

  login(email, password) {
    const users = JSON.parse(localStorage.getItem('kb_users'));
    const user = users.find(u => u.email === email && u.password === password);
    if (user) {
      const sessionUser = { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role || 'customer' };
      localStorage.setItem('kb_current_user', JSON.stringify(sessionUser));
      return { success: true, user: sessionUser };
    }
    return { success: false, message: 'Invalid email or password' };
  }

  signup(name, email, password, phone) {
    const users = JSON.parse(localStorage.getItem('kb_users'));
    if (users.find(u => u.email === email)) {
      return { success: false, message: 'Email already exists' };
    }
    const newUser = { id: 'usr_' + Date.now(), name, email, password, phone };
    users.push(newUser);
    localStorage.setItem('kb_users', JSON.stringify(users));
    
    const sessionUser = { id: newUser.id, name: newUser.name, email: newUser.email, phone: newUser.phone };
    localStorage.setItem('kb_current_user', JSON.stringify(sessionUser));
    return { success: true, user: sessionUser };
  }

  logout() {
    localStorage.setItem('kb_current_user', null);
  }

  // --- Products ---
  getProducts() {
    return JSON.parse(localStorage.getItem('kb_products')) || PRODUCTS;
  }

  getProductById(id) {
    const products = this.getProducts();
    return products.find(p => p.id === parseInt(id));
  }

  getProductsByTag(tag) {
    const products = this.getProducts();
    return products.filter(p => p.tag === tag).slice(0, 8);
  }

  getProductsByBrand(brand) {
    const products = this.getProducts();
    return products.filter(p => p.brand === brand);
  }

  getProductsByGender(gender) {
    const products = this.getProducts();
    return products.filter(p => p.gender === gender || p.gender === 'Uni-sex');
  }

  getBrands() {
    const products = this.getProducts();
    const brands = new Set(products.map(p => p.brand).filter(Boolean));
    return Array.from(brands).sort();
  }

  // Hybrid Recommendation Engine ("Complete Your Fit")
  getComplementaryProducts(productId) {
    const current = this.getProductById(productId);
    if (!current) return [];
    const all = this.getProducts();

    // Mapping rules
    let targetCats = [];
    if (['tshirts', 'shirts', 'hoodies', 'jackets'].includes(current.category)) {
      targetCats = ['jeans', 'accessories', 'suits', 'shoes'];
    } else if (['jeans', 'suits'].includes(current.category)) {
      targetCats = ['tshirts', 'shirts', 'hoodies', 'accessories', 'shoes'];
    } else {
      targetCats = ['tshirts', 'jeans', 'jackets'];
    }

    // Filter by target categories and similar style
    const recs = all.filter(p => p.id !== current.id && targetCats.includes(p.category) && p.style === current.style);

    // If we don't have enough recommendations, pad with top rated
    if (recs.length < 3) {
      const padded = all.filter(p => p.id !== current.id && !recs.includes(p)).sort((a,b) => b.rating - a.rating);
      return [...recs, ...padded].slice(0, 4);
    }
    return recs.slice(0, 4);
  }

  getExploreProducts(excludeId) {
    const all = this.getProducts();
    return all.filter(p => p.id !== excludeId).sort(() => 0.5 - Math.random()).slice(0, 8);
  }

  // --- Cart ---
  getCart() {
    return JSON.parse(localStorage.getItem('kb_cart'));
  }

  addToCart(productId, size, color, quantity = 1) {
    let cart = this.getCart();
    const existingIndex = cart.findIndex(item => item.productId === productId && item.size === size && item.color === color);
    
    if (existingIndex > -1) {
      cart[existingIndex].quantity += quantity;
    } else {
      cart.push({ productId, size, color, quantity });
    }
    localStorage.setItem('kb_cart', JSON.stringify(cart));
  }

  updateCartQuantity(index, newQuantity) {
    let cart = this.getCart();
    if (newQuantity <= 0) {
      cart.splice(index, 1);
    } else {
      cart[index].quantity = newQuantity;
    }
    localStorage.setItem('kb_cart', JSON.stringify(cart));
  }

  removeFromCart(index) {
    let cart = this.getCart();
    cart.splice(index, 1);
    localStorage.setItem('kb_cart', JSON.stringify(cart));
  }

  clearCart() {
    localStorage.setItem('kb_cart', JSON.stringify([]));
  }

  getCartCount() {
    return this.getCart().reduce((sum, item) => sum + item.quantity, 0);
  }

  getCartTotal() {
    const cart = this.getCart();
    const products = this.getProducts();
    return cart.reduce((total, item) => {
      const p = products.find(p => p.id === item.productId);
      return total + (p ? p.price * item.quantity : 0);
    }, 0);
  }

  // --- Wishlist ---
  getWishlist() {
    return JSON.parse(localStorage.getItem('kb_wishlist'));
  }

  toggleWishlist(productId) {
    let list = this.getWishlist();
    if (list.includes(productId)) {
      list = list.filter(id => id !== productId);
    } else {
      list.push(productId);
    }
    localStorage.setItem('kb_wishlist', JSON.stringify(list));
  }

  isInWishlist(productId) {
    return this.getWishlist().includes(productId);
  }

  // --- Orders ---
  addOrder(orderData) {
    let orders = JSON.parse(localStorage.getItem('kb_orders')) || [];
    orderData.id = 'ORD-' + Math.floor(1000 + Math.random() * 9000);
    orderData.date = new Date().toISOString();
    orderData.status = 'Processing';
    orders.push(orderData);
    localStorage.setItem('kb_orders', JSON.stringify(orders));
    return orderData;
  }

  getOrders() {
    return JSON.parse(localStorage.getItem('kb_orders')) || [];
  }

  getUserOrders(userEmail) {
    const orders = this.getOrders();
    return orders.filter(o => o.customer && o.customer.email === userEmail);
  }

  getCustomers() {
    const users = JSON.parse(localStorage.getItem('kb_users')) || [];
    const orders = this.getOrders();
    // Return customers (non-admin) enriched with their order count + total spend
    return users
      .filter(u => u.role !== 'admin')
      .map(u => {
        const userOrders = orders.filter(o => o.customer && o.customer.email === u.email);
        return {
          ...u,
          orderCount: userOrders.length,
          totalSpend: userOrders.reduce((s, o) => s + o.total, 0)
        };
      });
  }

  updateOrderStatus(orderId, newStatus) {
    let orders = this.getOrders();
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx > -1) {
      orders[idx].status = newStatus;
      localStorage.setItem('kb_orders', JSON.stringify(orders));
      return true;
    }
    return false;
  }

  updateProductStock(productId, inStockStatus) {
    let products = this.getProducts();
    const idx = products.findIndex(p => p.id === productId);
    if (idx > -1) {
      products[idx].inStock = inStockStatus;
      localStorage.setItem('kb_products', JSON.stringify(products));
      return true;
    }
    return false;
  }

  addProduct(productData) {
    let products = this.getProducts();
    // Auto-increment ID based on highest
    const maxId = products.length > 0 ? Math.max(...products.map(p => p.id)) : 0;
    productData.id = maxId + 1;
    productData.rating = 5.0; // default for new products
    productData.reviews = 0;
    products.push(productData);
    localStorage.setItem('kb_products', JSON.stringify(products));
    return productData;
  }

  updateProduct(productId, updatedData) {
    let products = this.getProducts();
    const idx = products.findIndex(p => p.id === productId);
    if (idx > -1) {
      products[idx] = { ...products[idx], ...updatedData };
      localStorage.setItem('kb_products', JSON.stringify(products));
      return products[idx];
    }
    return null;
  }

  deleteProduct(productId) {
    let products = this.getProducts();
    const filtered = products.filter(p => p.id !== productId);
    if (products.length !== filtered.length) {
      localStorage.setItem('kb_products', JSON.stringify(filtered));
      return true;
    }
    return false;
  }

  // --- Fake Reviews ---
  getReviews(productId) {
    const reviewsPool = [
      { user: "Alex M.", displayDate: "August 14, 2024", text: "Absolutely love the quality. Exceeded my expectations!", rating: 5, verified: true },
      { user: "Sarah K.", displayDate: "July 28, 2024", text: "Fits perfectly. The material feels very premium.", rating: 4, verified: true },
      { user: "James T.", displayDate: "August 02, 2024", text: "Good buy, shipping was fast too.", rating: 4, verified: false },
      { user: "Emily R.", displayDate: "September 05, 2024", text: "A bit looser than I expected, but still looks great.", rating: 4, verified: true },
      { user: "Michael B.", displayDate: "August 20, 2024", text: "Five stars. Best purchase I've made this year.", rating: 5, verified: true }
    ];

    // Seeded random subset based on product ID
    let count = (productId % 3) + 2; 
    let reviews = [];
    for(let i=0; i<count; i++) {
       reviews.push(reviewsPool[(productId + i) % reviewsPool.length]);
    }
    return reviews.map(r => ({...r, date: r.displayDate}));
  }

  // --- Testimonials (Homepage) ---
  getTestimonials() {
    return [
      { name: "Sarah M.", text: "The quality of these clothes is unmatched. I love the fit and feel of every single piece.", rating: 5, verified: true },
      { name: "Alex K.", text: "Finding my style was never easier. The modern designs perfectly match what I was looking for.", rating: 5, verified: true },
      { name: "James L.", text: "As someone who appreciates craftsmanship, KB.ENT delivers on every front. Highly recommended.", rating: 4.8, verified: true },
      { name: "Elena R.", text: "Super fast shipping and the packaging felt so premium. Will definitely shop here again.", rating: 5, verified: true },
      { name: "David O.", text: "The formal suits are incredibly comfortable. Best purchase for my business meetings.", rating: 4.9, verified: false }
    ];
  }
}

export const db = new KBDatabase();

// --- Global Header Search ---
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    // Desktop Search
    const searchInput = document.querySelector('.header-search input');
    if (searchInput) {
      searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          const val = searchInput.value.trim();
          if (val) {
            window.location.href = `/category.html?search=${encodeURIComponent(val)}`;
          }
        }
      });
    }

    // Mobile menu toggle (centralized as it is used on every page)
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const navLinks = document.getElementById('navLinks');
    if (mobileMenuBtn && navLinks) {
      mobileMenuBtn.addEventListener('click', () => {
        navLinks.classList.toggle('mobile-open');
      });
    }
  });
}
