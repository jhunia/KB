'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/db';
import { useCart } from '@/context/CartContext';
import ProductCard from '@/components/ui/ProductCard';
import type { Product, Review } from '@/lib/types';

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
  const { addToCart } = useCart();
  const router = useRouter();

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
      if (p.sizes?.length) setSelectedSize(p.sizes[0]);
      if (p.colors?.length) setSelectedColor(p.colors[0]);
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

  const handleAddToCart = async () => {
    if (!product) return;
    if (!selectedSize) { toast('Please select a size'); return; }
    if (!selectedColor) { toast('Please select a color'); return; }
    await addToCart(product.id, selectedSize, selectedColor, quantity);
    toast(`${product.name} added to cart!`);
  };

  const handleBuyNow = async () => {
    await handleAddToCart();
    router.push('/cart');
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
                <div key={i} className={`gallery-thumb${i === selectedImg ? ' active' : ''}`} onClick={() => setSelectedImg(i)}>
                  <img src={img} alt={`${product.name} ${i + 1}`} />
                </div>
              ))}
            </div>
            <div className="gallery-main">
              {product.inStock === false && (
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'rgba(255,255,255,0.9)', color: '#000', padding: '12px 24px', fontWeight: 700, borderRadius: 4, zIndex: 5, letterSpacing: 1 }}>
                  OUT OF STOCK
                </div>
              )}
              <img
                src={product.images[selectedImg]}
                alt={product.name}
                style={product.inStock === false ? { opacity: 0.5, filter: 'grayscale(100%)' } : undefined}
              />
            </div>
          </div>

          {/* Product Info */}
          <div className="product-info">
            <h1 className="product-title">{product.name}</h1>
            <div className="product-rating">
              <span className="stars">{renderStars(product.rating)}</span>
              <span className="rating-text">{product.rating}/5 ({product.reviews} reviews)</span>
            </div>
            <div className="product-price-row">
              <span className="product-price">GH₵{product.price}</span>
              {product.originalPrice && <span className="product-original-price">GH₵{product.originalPrice}</span>}
              {product.discount && <span className="product-discount-badge">-{product.discount}%</span>}
            </div>
            {product.description && <p className="product-desc">{product.description}</p>}

            {/* Color Selection */}
            {product.colors.length > 0 && (
              <>
                <p className="option-label">Select Color: <strong>{selectedColor}</strong></p>
                <div className="color-swatches">
                  {product.colors.map(color => (
                    <button
                      key={color}
                      className={`color-swatch${selectedColor === color ? ' active' : ''}`}
                      onClick={() => setSelectedColor(color)}
                      title={color}
                      style={{ backgroundColor: color.toLowerCase() === 'white' ? '#f5f5f5' : color.toLowerCase() === 'beige' ? '#f5f0e8' : color.toLowerCase() }}
                    />
                  ))}
                </div>
              </>
            )}

            {/* Size Selection */}
            {product.sizes.length > 0 && (
              <>
                <p className="option-label">Select Size: <strong>{selectedSize}</strong></p>
                <div className="size-options">
                  {product.sizes.map(size => (
                    <button key={size} className={`size-option${selectedSize === size ? ' active' : ''}`} onClick={() => setSelectedSize(size)}>
                      {size}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Actions */}
            <div className="product-actions">
              <div className="qty-selector">
                <button onClick={() => setQuantity(q => Math.max(1, q - 1))} aria-label="Decrease">−</button>
                <span className="qty-value">{quantity}</span>
                <button onClick={() => setQuantity(q => q + 1)} aria-label="Increase">+</button>
              </div>
              <div className="product-cta-buttons">
                <button className="add-to-cart-btn" onClick={handleAddToCart} disabled={product.inStock === false}>
                  {product.inStock === false ? 'Out of Stock' : 'Add to Cart'}
                </button>
                {product.inStock !== false && (
                  <button className="buy-now-btn" onClick={handleBuyNow}>Buy Now</button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Reviews Section */}
        <div style={{ marginTop: 64, paddingBottom: 64 }}>
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

      {/* Toast */}
      <div className={`toast${showToast ? ' show' : ''}`}>{toastMsg}</div>
    </main>
  );
}
