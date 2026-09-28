'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/db';
import { useCart } from '@/context/CartContext';
import ProductCard from '@/components/ui/ProductCard';
import type { Product, Review } from '@/lib/types';
import Image from 'next/image';
import { colorName, swatchColor } from '@/lib/colors';
import SizeGuide from '@/components/ui/SizeGuide';

interface Props { params: Promise<{ id: string }> }

export default function ProductPage({ params }: Props) {
  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [selectedImg, setSelectedImg] = useState(0);
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [toastMsg, setToastMsg] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [missing, setMissing] = useState<'color' | 'size' | null>(null);
  const [showSizeGuide, setShowSizeGuide] = useState(false);
  const [ctaVisible, setCtaVisible] = useState(true);
  const colorRef = useRef<HTMLDivElement>(null);
  const sizeRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const { addToCart, items: cartItems, openDrawer } = useCart();
  const [justAdded, setJustAdded] = useState(false);
  const addedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (addedTimer.current) clearTimeout(addedTimer.current); }, []);

  // How many of this product (any option) and of the chosen size/colour are already in the cart
  const productId_ = product?.id;
  const inCart = cartItems.filter(i => i.productId === productId_).reduce((s, i) => s + i.quantity, 0);
  const variantInCart = cartItems
    .filter(i => i.productId === productId_ && i.size === selectedSize && i.color === selectedColor)
    .reduce((s, i) => s + i.quantity, 0);
  const addLabel = justAdded ? '✓ Added' : variantInCart > 0 ? 'Add another' : 'Add to Cart';
  const router = useRouter();

  // Show the sticky mobile "Add to Cart" bar only while the main buttons are scrolled out of view
  useEffect(() => {
    const el = ctaRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setCtaVisible(entry.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, [product]);

  const [productId, setProductId] = useState<number>(0);

  useEffect(() => {
    params.then(p => setProductId(Number(p.id)));
  }, [params]);

  useEffect(() => {
    if (!productId) return;
    (async () => {
      await db.init();
      const p = db.getProductById(productId);
      if (!p) { router.push('/category'); return; }
      setProduct(p);
      // Only pre-select when there's no real choice — picking a size for the shopper leads to wrong-size orders
      if (p.sizes?.length === 1) setSelectedSize(p.sizes[0]);
      if (p.colors?.length === 1) setSelectedColor(p.colors[0]);
      setRelatedProducts(db.getComplementaryProducts(productId));
      const revs = await db.getReviews(productId);
      setReviews(revs);
    })();
  }, [productId, router]);

  const toast = (msg: string) => {
    setToastMsg(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  // Returns false (and points the shopper at what's missing) if a colour or size still needs choosing
  const handleAddToCart = async (): Promise<boolean> => {
    if (!product) return false;
    if (product.colors.length > 0 && !selectedColor) {
      setMissing('color');
      colorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return false;
    }
    if (product.sizes.length > 0 && !selectedSize) {
      setMissing('size');
      sizeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return false;
    }
    await addToCart(product.id, selectedSize, selectedColor, quantity);
    toast(`${quantity > 1 ? `${quantity} × ` : ''}${product.name} added to cart`);
    // Brief "Added" confirmation on the button itself, then it offers "Add another"
    setJustAdded(true);
    if (addedTimer.current) clearTimeout(addedTimer.current);
    addedTimer.current = setTimeout(() => setJustAdded(false), 2000);
    return true;
  };

  const handleBuyNow = async () => {
    // Already in the cart in this size/colour: go to checkout rather than adding a duplicate
    if (variantInCart > 0 || (await handleAddToCart())) router.push('/cart');
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewText.trim()) return;
    const res = await db.addReview(productId, reviewRating, reviewText);
    if (res.success) {
      setShowReviewForm(false);
      setReviewText('');
      const revs = await db.getReviews(productId);
      setReviews(revs);
      toast('Review submitted!');
    } else {
      toast(res.message || 'Failed to submit review');
    }
  };

  const renderStars = (rating: number) => {
    let s = '';
    for (let i = 1; i <= 5; i++) s += i <= Math.floor(rating) ? '★' : '☆';
    return s;
  };

  if (!product) {
    return (
      <main>
        <div className="container" style={{ padding: '80px 16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '45% 1fr', gap: 48 }}>
            <div style={{ aspectRatio: '3/4', background: '#F0F0F0', borderRadius: 20 }} className="skeleton" />
            <div style={{ paddingTop: 8 }}>
              <div style={{ height: 48, width: '80%', background: '#F0F0F0', borderRadius: 8, marginBottom: 16 }} className="skeleton" />
              <div style={{ height: 24, width: '40%', background: '#F0F0F0', borderRadius: 8, marginBottom: 16 }} className="skeleton" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  const user = db.getCurrentUser();
  const userHasReview = reviews.some(r => r.userId === user?.id);

  return (
    <main>
      <div className="container">
        {/* Breadcrumb */}
        <div className="breadcrumb">
          <Link href="/">Home</Link>
          <span>›</span>
          <Link href="/category">Shop</Link>
          <span>›</span>
          <span>{product.name}</span>
        </div>

        {/* Product Detail */}
        <div className="product-detail">
          {/* Gallery */}
          <div className="product-gallery">
            <div className="gallery-thumbs">
              {product.images.map((img, i) => (
                <button
                  key={i}
                  type="button"
                  className={`gallery-thumb${i === selectedImg ? ' active' : ''}`}
                  onClick={() => setSelectedImg(i)}
                  aria-label={`Show image ${i + 1} of ${product.images.length}`}
                  aria-pressed={i === selectedImg}
                >
                  <Image src={img} alt="" width={200} height={240} />
                </button>
              ))}
            </div>
            <div className="gallery-main">
              {product.inStock === false && (
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'rgba(255,255,255,0.9)', color: '#000', padding: '12px 24px', fontWeight: 700, borderRadius: 4, zIndex: 5, letterSpacing: 1 }}>
                  OUT OF STOCK
                </div>
              )}
              <Image
                src={product.images[selectedImg]}
                alt={product.name}
                width={900}
                height={1200}
                sizes="(max-width: 768px) 100vw, 45vw"
                preload
                style={product.inStock === false ? { opacity: 0.5, filter: 'grayscale(100%)' } : undefined}
              />
            </div>
          </div>

          {/* Product Info */}
          <div className="product-info">
            <h1 className="product-title">{product.name}</h1>
            <div className="product-rating">
              {product.reviews > 0 ? (
                <>
                  <span className="stars" aria-hidden="true">{renderStars(product.rating)}</span>
                  <a href="#reviews" className="rating-text" aria-label={`Rated ${product.rating} out of 5. Read ${product.reviews} reviews`}>
                    {product.rating}/5 ({product.reviews} {product.reviews === 1 ? 'review' : 'reviews'})
                  </a>
                </>
              ) : (
                <a href="#reviews" className="rating-text">No reviews yet</a>
              )}
            </div>
            <div className="product-price-row">
              <span className="product-price">GH₵{product.price}</span>
              {product.originalPrice && <span className="product-original-price">GH₵{product.originalPrice}</span>}
              {product.discount && <span className="product-discount-badge">-{product.discount}%</span>}
            </div>
            {product.description && <p className="product-desc">{product.description}</p>}

            {/* Color Selection */}
            {product.colors.length > 0 && (
              <div ref={colorRef} className={`option-block${missing === 'color' ? ' needs-choice' : ''}`}>
                <p className="option-label" id="color-label">
                  Color: <strong>{selectedColor ? colorName(selectedColor) : 'Choose a colour'}</strong>
                </p>
                <div className="color-swatches" role="group" aria-labelledby="color-label">
                  {product.colors.map(color => {
                    const soldOut = product.colorStock?.[color] === false;
                    return (
                      <button
                        key={color}
                        type="button"
                        className={`color-swatch${selectedColor === color ? ' active' : ''}${soldOut ? ' sold-out' : ''}`}
                        onClick={() => { setSelectedColor(color); setMissing(null); }}
                        title={colorName(color) + (soldOut ? ' (sold out)' : '')}
                        aria-label={colorName(color) + (soldOut ? ', sold out' : '')}
                        aria-pressed={selectedColor === color}
                        disabled={soldOut}
                        style={{ backgroundColor: swatchColor(color) }}
                      />
                    );
                  })}
                </div>
                {missing === 'color' && <p className="option-error" role="alert">Please choose a colour.</p>}
              </div>
            )}

            {/* Size Selection */}
            {product.sizes.length > 0 && (
              <div ref={sizeRef} className={`option-block${missing === 'size' ? ' needs-choice' : ''}`}>
                <div className="option-label-row">
                  <p className="option-label" id="size-label">
                    Size: <strong>{selectedSize || 'Choose a size'}</strong>
                  </p>
                  <button type="button" className="size-guide-link" onClick={() => setShowSizeGuide(true)}>Size guide</button>
                </div>
                <div className="size-options" role="group" aria-labelledby="size-label">
                  {product.sizes.map(size => (
                    <button
                      key={size}
                      type="button"
                      className={`size-option${selectedSize === size ? ' active' : ''}`}
                      onClick={() => { setSelectedSize(size); setMissing(null); }}
                      aria-pressed={selectedSize === size}
                    >
                      {size}
                    </button>
                  ))}
                </div>
                {missing === 'size' && <p className="option-error" role="alert">Please choose a size.</p>}
              </div>
            )}

            {/* Actions */}
            <div className="product-actions" ref={ctaRef}>
              <div className="qty-selector">
                <button type="button" onClick={() => setQuantity(q => Math.max(1, q - 1))} aria-label="Decrease quantity" disabled={quantity <= 1}>−</button>
                <span className="qty-value" aria-live="polite" aria-label={`Quantity ${quantity}`}>{quantity}</span>
                <button type="button" onClick={() => setQuantity(q => q + 1)} aria-label="Increase quantity">+</button>
              </div>
              <div className="product-cta-buttons">
                <button className={`add-to-cart-btn${justAdded ? ' is-added' : ''}`} onClick={handleAddToCart} disabled={product.inStock === false}>
                  {product.inStock === false ? 'Out of Stock' : addLabel}
                </button>
                {product.inStock !== false && (
                  <button className="buy-now-btn" onClick={handleBuyNow}>{variantInCart > 0 ? 'Go to checkout' : 'Buy Now'}</button>
                )}
              </div>
            </div>
            {inCart > 0 && (
              <p className="in-cart-note" role="status">
                <span>✓ {inCart} in your cart</span>
                <button type="button" onClick={openDrawer}>View cart</button>
              </p>
            )}
          </div>
        </div>

        {/* Reviews Section */}
        <div id="reviews" style={{ marginTop: 64, paddingBottom: 64, scrollMarginTop: 96 }}>
          <div className="reviews-header">
            <span className="reviews-tab">All Reviews ({reviews.length})</span>
          </div>
          <div className="reviews-top-bar">
            <div className="reviews-count">{reviews.length} Reviews</div>
            {user && !userHasReview && (
              <button className="write-review-btn" onClick={() => setShowReviewForm(v => !v)}>
                Write a Review
              </button>
            )}
          </div>

          {showReviewForm && (
            <form onSubmit={handleReviewSubmit} style={{ marginBottom: 32, padding: 24, border: '1px solid var(--gray-200)', borderRadius: 20 }}>
              <div className="form-group">
                <label>Rating</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[1,2,3,4,5].map(n => (
                    <button key={n} type="button" onClick={() => setReviewRating(n)} style={{ fontSize: 24, color: n <= reviewRating ? '#FFC633' : '#ccc', background: 'none', border: 'none', cursor: 'pointer' }}>★</button>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label>Review</label>
                <textarea value={reviewText} onChange={e => setReviewText(e.target.value)} rows={4} style={{ width: '100%', padding: '12px 16px', border: '1px solid var(--gray-200)', borderRadius: 8, fontFamily: 'inherit', fontSize: 15, resize: 'vertical' }} placeholder="Share your experience..." required />
              </div>
              <button type="submit" className="btn btn-primary btn-sm">Submit Review</button>
            </form>
          )}

          {reviews.length === 0 ? (
            <p style={{ color: 'var(--gray-600)', padding: '32px 0' }}>No reviews yet. Be the first to review this product!</p>
          ) : (
            <div className="reviews-grid">
              {reviews.map(r => (
                <div key={r.id} className="review-card">
                  <div className="review-stars">{renderStars(r.rating)}</div>
                  <div className="review-author">
                    {r.user}
                    {r.verified && <span className="verified-badge" title="Verified Purchase">✓</span>}
                  </div>
                  <p className="review-text">&ldquo;{r.text}&rdquo;</p>
                  <div className="review-date">{r.date}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* You Might Also Like */}
        {relatedProducts.length > 0 && (
          <div style={{ paddingBottom: 64 }}>
            <h2 className="section-title">You Might Also Like</h2>
            <div className="explore-carousel-wrapper">
              <div className="explore-grid">
                {relatedProducts.map(p => <ProductCard key={p.id} product={p} carousel />)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sticky mobile add-to-cart bar (CSS shows it on small screens only) */}
      {product.inStock !== false && (
        <div className={`sticky-cta${ctaVisible ? '' : ' show'}`} aria-hidden={ctaVisible}>
          <div className="sticky-cta-info">
            <div className="sticky-cta-name">{inCart > 0 ? <span className="sticky-cta-incart">✓ {inCart} in your cart</span> : product.name}</div>
            <div className="sticky-cta-price">
              GH₵{product.price}
              {(selectedSize || selectedColor) && (
                <span className="sticky-cta-meta">
                  {[selectedColor && colorName(selectedColor), selectedSize].filter(Boolean).join(' · ')}
                </span>
              )}
            </div>
          </div>
          {inCart > 0 && (
            <button type="button" className="sticky-cta-view" onClick={openDrawer} tabIndex={ctaVisible ? -1 : 0} aria-label={`View cart, ${inCart} of this item`}>
              View cart
            </button>
          )}
          <button type="button" className={`add-to-cart-btn${justAdded ? ' is-added' : ''}`} onClick={handleAddToCart} tabIndex={ctaVisible ? -1 : 0}>
            {addLabel}
          </button>
        </div>
      )}

      {showSizeGuide && <SizeGuide category={product.category} onClose={() => setShowSizeGuide(false)} />}

      {/* Toast */}
      <div className={`toast${showToast ? ' show' : ''}`} role="status" aria-live="polite">{toastMsg}</div>
    </main>
  );
}
