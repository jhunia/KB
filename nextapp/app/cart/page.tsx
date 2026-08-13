'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/db';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { loadPaystackScript, initPaystackPayment } from '@/lib/paystack';
import type { Product } from '@/lib/types';

const DELIVERY_FEE = 0; // Delivery quoted per order — admin calls customer to confirm

/* ── Small liked-item tile used in both the cart section and checkout modal ── */
function LikedTile({
  product,
  compact = false,
  onAddToCart,
}: {
  product: Product;
  compact?: boolean;
  onAddToCart?: (p: Product) => void;
}) {
  const { isLiked, toggle } = useWishlist();
  const liked = isLiked(product.id);

  if (compact) {
    /* Inside checkout modal — very minimal */
    return (
      <div style={{
        display: 'flex', gap: 12, alignItems: 'center',
        padding: '10px 0', borderBottom: '1px solid var(--gray-100)',
      }}>
        <Link href={`/product/${product.id}`} style={{ flexShrink: 0 }}>
          <img
            src={product.images[0]}
            alt={product.name}
            style={{ width: 52, height: 52, borderRadius: 8, objectFit: 'cover', background: 'var(--gray-100)' }}
          />
        </Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {product.name}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>GH₵{product.price}</div>
        </div>
        {onAddToCart && product.inStock !== false && (
          <button
            onClick={() => onAddToCart(product)}
            style={{
              padding: '6px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600,
              background: 'var(--black)', color: 'var(--white)', border: 'none', cursor: 'pointer',
              flexShrink: 0, whiteSpace: 'nowrap',
            }}
          >
            + Add
          </button>
        )}
      </div>
    );
  }

  /* Full tile in cart page */
  return (
    <div style={{
      border: '1px solid var(--gray-200)', borderRadius: 16, overflow: 'hidden',
      background: 'var(--white)', transition: 'box-shadow 0.2s ease', cursor: 'pointer',
      minWidth: 180, maxWidth: 220, flexShrink: 0,
    }}>
      <div style={{ position: 'relative' }}>
        <Link href={`/product/${product.id}`}>
          <img
            src={product.images[0]}
            alt={product.name}
            style={{ width: '100%', height: 180, objectFit: 'cover', display: 'block' }}
          />
        </Link>
        {/* Heart button */}
        <button
          onClick={() => toggle(product.id)}
          style={{
            position: 'absolute', top: 8, right: 8, width: 32, height: 32,
            borderRadius: '50%', background: 'white', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}
          aria-label="Remove from liked"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill={liked ? '#FF3333' : 'none'} stroke={liked ? '#FF3333' : 'currentColor'} strokeWidth="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
        {product.inStock === false && (
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, letterSpacing: 1,
          }}>OUT OF STOCK</div>
        )}
      </div>
      <div style={{ padding: '10px 12px' }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
          {product.name}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>GH₵{product.price}</span>
          {product.inStock !== false && (
            <Link
              href={`/product/${product.id}`}
              style={{
                padding: '4px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600,
                background: 'var(--black)', color: 'var(--white)',
              }}
            >
              View
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
/*  CART PAGE                                                       */
/* ═══════════════════════════════════════════════════════════════ */
export default function CartPage() {
  const { items, removeFromCart, updateQuantity, clearCart, cartTotal, getProductById, addToCart } = useCart();
  const { wishlistProducts } = useWishlist();

  const [promoCode, setPromoCode] = useState('');
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [promoMsg, setPromoMsg] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [customerForm, setCustomerForm] = useState({ name: '', email: '', phone: '', address: '' });
  const [quickAddMsg, setQuickAddMsg] = useState('');
  const [showSignupNudge, setShowSignupNudge] = useState(false);
  const [guestOrderId, setGuestOrderId] = useState<string | null>(null);
  const router = useRouter();

  const subtotal = cartTotal;
  const discountAmount = Math.round(subtotal * (promoDiscount / 100));
  const total = Math.max(0, subtotal - discountAmount);

  useEffect(() => {
    db.init().then(() => {
      const user = db.getCurrentUser();
      if (user) setCustomerForm(f => ({ ...f, name: user.name || '', email: user.email || '', phone: user.phone || '' }));
    });
    loadPaystackScript();
  }, []);

  const handlePromo = async () => {
    if (!promoCode.trim()) return;
    const res = await db.validatePromoCode(promoCode);
    if (res.valid) {
      setPromoDiscount(res.discount);
      setPromoMsg(`✅ ${res.discount}% discount applied!`);
    } else {
      setPromoDiscount(0);
      setPromoMsg(`❌ ${res.reason || 'Invalid or expired promo code.'}`);
    }
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;
    // Guest checkout allowed — no login required
    const user = db.getCurrentUser();

    setModalLoading(true);
    const order = await db.addOrder({
      customer: customerForm,
      subtotal, discount: discountAmount, deliveryFee: DELIVERY_FEE, total,
      paymentMethod: 'paystack',
      items: items.map(i => ({ productId: i.productId, size: i.size, color: i.color, quantity: i.quantity })),
    });
    if (!order) { setModalLoading(false); alert('Failed to create order. Please try again.'); return; }
    setModalLoading(false);

    initPaystackPayment(
      { id: order.id, total, customer: customerForm },
      async ({ reference }) => {
        await db.savePaymentRef(order.id, reference);
        if (promoCode.trim() && promoDiscount > 0) {
          await db.recordPromoUse(promoCode, customerForm.email);
        }
        clearCart();
        setShowModal(false);
        if (user) {
          // Logged-in: go straight to order page
          router.push(`/profile?order=${order.id}`);
        } else {
          // Guest: show signup nudge with bonus offer
          setGuestOrderId(order.id);
          setShowSignupNudge(true);
        }
      },
      () => {},
    );
    setShowModal(false);
  };

  /* Quick-add a liked product to cart with default size/color */
  const quickAddToCart = async (product: Product) => {
    const size = product.sizes?.[0] || 'M';
    const color = product.colors?.[0] || 'Black';
    // Use CartContext addToCart so cartTotal and item list update reactively
    await addToCart(product.id, size, color, 1);
    setQuickAddMsg(`${product.name} added to cart!`);
    setTimeout(() => setQuickAddMsg(''), 2500);
  };

  const formatPrice = (p: number) => `GH₵${p.toFixed(2)}`;

  /* ── Empty cart ── */
  if (items.length === 0) {
    return (
      <main>
        <div className="container" style={{ padding: '80px 16px', textAlign: 'center' }}>
          <div className="breadcrumb" style={{ justifyContent: 'center' }}>
            <Link href="/">Home</Link><span>›</span><span>Cart</span>
          </div>
          <h1 className="cart-title" style={{ marginTop: 40 }}>Your Cart</h1>
          <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="var(--gray-300)" strokeWidth="1" style={{ margin: '0 auto 24px' }}>
            <circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" />
            <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
          </svg>
          <p style={{ color: 'var(--gray-600)', marginBottom: 32, fontSize: 18 }}>Your cart is empty</p>
          <Link href="/category" className="btn btn-primary">Start Shopping</Link>

          {/* Show liked items even on empty cart */}
          {wishlistProducts.length > 0 && (
            <div style={{ marginTop: 64, textAlign: 'left' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, marginBottom: 20 }}>
                ❤️ Your Liked Items
              </h2>
              <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 8 }}>
                {wishlistProducts.map(p => <LikedTile key={p.id} product={p} />)}
              </div>
            </div>
          )}
        </div>
      </main>
    );
  }

  return (
    <>
    <main>
      <div className="container">
        <div className="breadcrumb">
          <Link href="/">Home</Link><span>›</span><span>Cart</span>
        </div>
        <h1 className="cart-title">YOUR CART</h1>

        <div className="cart-layout">
          {/* ── Cart Items ── */}
          <div>
            <div className="cart-items-container">
              {items.map((item, index) => {
                const product = getProductById(item.productId);
                if (!product) return null;
                return (
                  <div key={`${item.productId}-${item.size}-${item.color}`} className="cart-item">
                    <div className="cart-item-img">
                      <Link href={`/product/${product.id}`}>
                        <img src={product.images[0]} alt={product.name} />
                      </Link>
                    </div>
                    <div className="cart-item-details">
                      <div className="cart-item-title-row">
                        <div>
                          <div className="cart-item-title">{product.name}</div>
                          <div className="cart-item-meta">Size: {item.size} | Color: {item.color}</div>
                        </div>
                        <button className="cart-item-remove" onClick={() => removeFromCart(index)} aria-label="Remove">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                          </svg>
                        </button>
                      </div>
                      <div className="cart-item-bottom">
                        <span className="cart-item-price">{formatPrice(product.price * item.quantity)}</span>
                        <div className="qty-control">
                          <button onClick={() => updateQuantity(index, item.quantity - 1)}>−</button>
                          <span>{item.quantity}</span>
                          <button onClick={() => updateQuantity(index, item.quantity + 1)}>+</button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── LIKED ITEMS section ── */}
            {wishlistProducts.length > 0 && (
              <div style={{ marginTop: 40 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="#FF3333" stroke="#FF3333" strokeWidth="1.5">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                  </svg>
                  <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700 }}>
                    Liked Items
                  </h2>
                  <span style={{ fontSize: 13, color: 'var(--gray-600)', marginLeft: 4 }}>
                    ({wishlistProducts.length})
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 8, scrollbarWidth: 'none' }}>
                  {wishlistProducts.map(p => <LikedTile key={p.id} product={p} />)}
                </div>
              </div>
            )}
          </div>

          {/* ── Order Summary ── */}
          <div className="cart-summary">
            <h3>Order Summary</h3>
            <div className="summary-row"><span className="label">Subtotal</span><span>{formatPrice(subtotal)}</span></div>
            {discountAmount > 0 && (
              <div className="summary-row"><span className="label">Discount ({promoDiscount}%)</span><span className="discount">-{formatPrice(discountAmount)}</span></div>
            )}
            <div className="summary-row">
              <span className="label">Delivery Fee</span>
              <span style={{ color: 'var(--gray-500)', fontStyle: 'italic' }}>Quoted on call</span>
            </div>
            <div className="summary-row total"><span className="label">Total</span><span>{formatPrice(total)}</span></div>
            <div className="promo-code-container">
              <input
                type="text" placeholder="Enter promo code"
                value={promoCode} onChange={e => setPromoCode(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handlePromo()}
              />
              <button onClick={handlePromo}>Apply</button>
            </div>
            {promoMsg && <p style={{ fontSize: 13, marginTop: -16, marginBottom: 16 }}>{promoMsg}</p>}
            <button className="checkout-btn" onClick={() => setShowModal(true)}>
              Go to Checkout →
            </button>
            <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--gray-500)', marginTop: 10, lineHeight: 1.5 }}>
              🚚 You pay for products now. We&apos;ll call you to confirm the delivery fee for your location.
            </p>
          </div>
        </div>
      </div>

      {/* ── Checkout Modal ── */}
      <div
        className={`checkout-modal-overlay${showModal ? ' open' : ''}`}
        onClick={e => e.target === e.currentTarget && setShowModal(false)}
      >
        <div className="checkout-modal" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
          <div className="modal-header">
            <h3>Complete Your Order</h3>
            <button onClick={() => setShowModal(false)}>✕</button>
          </div>

          <form onSubmit={handleCheckout}>
            <div className="form-group">
              <label>Full Name</label>
              <input type="text" value={customerForm.name} onChange={e => setCustomerForm(f => ({ ...f, name: e.target.value }))} placeholder="John Doe" required />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={customerForm.email} onChange={e => setCustomerForm(f => ({ ...f, email: e.target.value }))} placeholder="you@email.com" required />
            </div>
            <div className="form-group">
              <label>Phone</label>
              <input type="tel" value={customerForm.phone} onChange={e => setCustomerForm(f => ({ ...f, phone: e.target.value }))} placeholder="024XXXXXXX" required />
            </div>
            <div className="form-group">
              <label>Delivery Address</label>
              <input type="text" value={customerForm.address} onChange={e => setCustomerForm(f => ({ ...f, address: e.target.value }))} placeholder="House no., Street, City" />
            </div>

            <div className="paystack-badge" style={{ width: '100%', textAlign: 'center' }}>
              🔒 Secure Payment via Paystack
            </div>

            {/* ── STILL INTERESTED? ── */}
            {wishlistProducts.length > 0 && (
              <div style={{ margin: '16px 0', padding: '16px', background: 'var(--gray-50)', borderRadius: 12, border: '1px solid var(--gray-200)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#FF3333" stroke="#FF3333" strokeWidth="1.5">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                  </svg>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>Still interested?</span>
                  <span style={{ fontSize: 12, color: 'var(--gray-600)' }}>Add your liked items before checking out</span>
                </div>
                <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                  {wishlistProducts.map(p => (
                    <LikedTile
                      key={p.id}
                      product={p}
                      compact
                      onAddToCart={quickAddToCart}
                    />
                  ))}
                </div>
                {quickAddMsg && (
                  <div style={{ marginTop: 8, fontSize: 13, color: '#059669', fontWeight: 600 }}>
                    ✅ {quickAddMsg}
                  </div>
                )}
              </div>
            )}

            <button type="submit" className="checkout-btn" disabled={modalLoading} style={{ marginTop: 8 }}>
              {modalLoading ? 'Creating order…' : `Pay ${formatPrice(total)} (Products Only)`}
            </button>
            <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--gray-500)', marginTop: 8 }}>
              Delivery fee confirmed separately after your order is placed.
            </p>
          </form>
        </div>
      </div>
    </main>

      {/* ── Guest Signup Nudge Modal ── */}
      {showSignupNudge && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16, animation: 'fadeIn 0.3s ease',
        }}>
          <div style={{
            background: '#fff', borderRadius: 24, padding: '40px 36px',
            maxWidth: 460, width: '100%', textAlign: 'center',
            boxShadow: '0 24px 80px rgba(0,0,0,0.3)',
            position: 'relative',
          }}>
            {/* Celebration emoji */}
            <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>

            <h2 style={{ fontSize: 24, fontWeight: 900, marginBottom: 8 }}>
              Your order is confirmed!
            </h2>
            <p style={{ color: 'var(--gray-600)', fontSize: 15, marginBottom: 24, lineHeight: 1.6 }}>
              Thank you for shopping with <strong>KB.ENT</strong>. We&apos;ll call you shortly to arrange delivery.
            </p>

            {/* Bonus offer card */}
            <div style={{
              background: 'linear-gradient(135deg, #1a1a2e, #0f3460)',
              borderRadius: 16, padding: '20px 24px', marginBottom: 24, color: '#fff',
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 2, opacity: 0.7, textTransform: 'uppercase', marginBottom: 6 }}>
                🎁 Exclusive Member Bonus
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 6 }}>
                Get <span style={{ color: '#e94560' }}>10% OFF</span> your next order
              </div>
              <div style={{ fontSize: 13, opacity: 0.85 }}>
                Create a free account to unlock your discount, track orders, and save wishlists.
              </div>
            </div>

            <a
              href={`/auth?signup=true&email=${encodeURIComponent(customerForm.email)}&promo=WELCOME10`}
              style={{
                display: 'block', width: '100%', padding: '16px',
                background: '#1a1a2e', color: '#fff', borderRadius: 99,
                fontWeight: 700, fontSize: 16, textDecoration: 'none',
                marginBottom: 12, transition: 'transform 0.2s',
              }}
            >
              Create Account &amp; Claim 10% Off →
            </a>

            <button
              onClick={() => { setShowSignupNudge(false); router.push('/'); }}
              style={{
                background: 'none', border: 'none', color: 'var(--gray-500)',
                fontSize: 14, cursor: 'pointer', padding: '8px',
              }}
            >
              No thanks, continue as guest
            </button>
          </div>
        </div>
      )}
    </>
  );
}
