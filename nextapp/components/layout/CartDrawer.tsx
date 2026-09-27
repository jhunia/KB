'use client';
import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import Image from 'next/image';
import { colorName } from '@/lib/colors';

export default function CartDrawer() {
  const { items, isOpen, closeDrawer, removeFromCart, updateQuantity, cartTotal, getProductById } = useCart();
  const { wishlistProducts } = useWishlist();

  const formatPrice = (p: number) => `GH₵${p.toFixed(2)}`;

  return (
    <>
      <div className={`cart-overlay${isOpen ? ' open' : ''}`} onClick={closeDrawer} />
      <div className={`cart-drawer${isOpen ? ' open' : ''}`} id="cartDrawer">
        <div className="cart-drawer-header">
          <h3>Your Cart</h3>
          <button className="cart-drawer-close" onClick={closeDrawer} aria-label="Close cart">✕</button>
        </div>

        <div className="cart-drawer-items" id="cartDrawerItems">
          {items.length === 0 ? (
            <div className="cart-drawer-empty" id="cartDrawerEmpty">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                <circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" />
                <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
              </svg>
              <p>Your cart is empty</p>
              <Link href="/category" className="btn btn-primary btn-sm" style={{ marginTop: 16 }} onClick={closeDrawer}>
                Start Shopping
              </Link>
            </div>
          ) : (
            items.map((item, index) => {
              const product = getProductById(item.productId);
              if (!product) return null;
              return (
                <div className="cart-drawer-item" key={`${item.productId}-${item.size}-${item.color}`}>
                  <div className="cart-drawer-item-img">
                    <Image src={product.images[0]} alt={product.name} width={160} height={160} />
                  </div>
                  <div className="cart-drawer-item-info">
                    <div className="cart-drawer-item-name">{product.name}</div>
                    <div className="cart-drawer-item-meta">Size: {item.size} | Color: {colorName(item.color)}</div>
                    <div className="cart-drawer-item-bottom">
                      <span className="cart-drawer-item-price">{formatPrice(product.price * item.quantity)}</span>
                      <div className="qty-control">
                        <button onClick={() => updateQuantity(index, item.quantity - 1)} aria-label="Decrease">−</button>
                        <span>{item.quantity}</span>
                        <button onClick={() => updateQuantity(index, item.quantity + 1)} aria-label="Increase">+</button>
                      </div>
                    </div>
                  </div>
                  <button
                    className="cart-drawer-remove"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#FF3333', alignSelf: 'flex-start', paddingTop: 4 }}
                    onClick={() => removeFromCart(index)}
                    aria-label="Remove item"
                  >✕</button>
                </div>
              );
            })
          )}
        </div>

        {/* ── Favourites section ─────────────────────────────────────────── */}
        {wishlistProducts.length > 0 && (
          <div className="cart-drawer-favourites">
            <div className="cart-drawer-favourites-header">
              <span>❤️ Favourited Items</span>
              <Link href="/profile" className="cart-drawer-favourites-view" onClick={closeDrawer}>View all</Link>
            </div>
            <div className="cart-drawer-favourites-list">
              {wishlistProducts.slice(0, 4).map(p => (
                <Link
                  key={p.id}
                  href={`/product/${p.id}`}
                  className="cart-drawer-fav-item"
                  onClick={closeDrawer}
                >
                  <div className="cart-drawer-fav-img">
                    <Image src={p.images[0]} alt={p.name} width={104} height={104} />
                  </div>
                  <div className="cart-drawer-fav-info">
                    <div className="cart-drawer-fav-name">{p.name}</div>
                    <div className="cart-drawer-fav-price">{formatPrice(p.price)}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {items.length > 0 && (
          <div className="cart-drawer-footer" id="cartDrawerFooter">
            <div className="cart-drawer-total">
              <span>Subtotal</span>
              <span id="cartDrawerTotal">{formatPrice(cartTotal)}</span>
            </div>
            <Link href="/cart" className="btn btn-primary" style={{ width: '100%' }} onClick={closeDrawer}>
              View Cart
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
