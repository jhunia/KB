'use client';
import Link from 'next/link';
import { useWishlist } from '@/context/WishlistContext';

interface Product {
  id: number;
  name: string;
  price: number;
  originalPrice: number | null;
  rating: number;
  images: string[];
  inStock: boolean;
}

interface ProductCardProps {
  product: Product;
  carousel?: boolean;
}

export default function ProductCard({ product, carousel = false }: ProductCardProps) {
  const { isLiked, toggle } = useWishlist();
  const liked = isLiked(product.id);

  const handleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggle(product.id);
  };

  const cardStyle: React.CSSProperties = carousel
    ? { minWidth: 260, width: 260, maxWidth: 260, flexShrink: 0 }
    : {};

  return (
    <Link href={`/product/${product.id}`} className="product-card" style={cardStyle}>
      <div className="product-card-img" style={{ position: 'relative' }}>

        {product.inStock === false && (
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%,-50%)',
            background: 'rgba(255,255,255,0.9)', color: '#000',
            padding: '8px 16px', fontWeight: 700, borderRadius: 4,
            zIndex: 2, fontSize: 14, whiteSpace: 'nowrap',
          }}>
            OUT OF STOCK
          </div>
        )}

        <img
          src={product.images[0]}
          alt={product.name}
          loading="lazy"
          style={product.inStock === false ? { opacity: 0.5, filter: 'grayscale(100%)' } : undefined}
        />

        <button
          className={`wishlist-btn${liked ? ' active' : ''}`}
          aria-label={liked ? 'Remove from wishlist' : 'Add to wishlist'}
          style={{ zIndex: 3 }}
          onClick={handleWishlist}
        >
          <svg
            width="20" height="20" viewBox="0 0 24 24"
            fill={liked ? '#FF3333' : 'none'}
            stroke={liked ? '#FF3333' : 'currentColor'}
            strokeWidth="2"
            style={{ transition: 'fill 0.2s ease, stroke 0.2s ease' }}
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
      </div>

      <h3 className="product-card-title">{product.name}</h3>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        <div className="product-card-price" style={{ marginTop: 0 }}>
          <span className="price-current">GH₵{product.price}</span>
          {product.originalPrice && (
            <span className="price-original">GH₵{product.originalPrice}</span>
          )}
        </div>
        <div className="product-card-rating" style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
          <span className="stars" style={{ color: '#FFB800' }}>★</span>
          <span className="rating-text">{product.rating}/5</span>
        </div>
      </div>
    </Link>
  );
}
