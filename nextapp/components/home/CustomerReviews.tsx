'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { db } from '@/lib/db';
import type { FeaturedReview } from '@/lib/types';

const stars = (r: number) => Array.from({ length: 5 }, (_, i) => (i < Math.round(r) ? '★' : '☆')).join('');

function timeAgo(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days < 1) return 'Today';
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  if (days < 60) return `${Math.floor(days / 7)} week${days < 14 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

/**
 * Real reviews left on product pages. The carousel uses native scroll-snap, so it
 * swipes naturally on phones; arrow buttons scroll it on larger screens.
 */
export default function CustomerReviews() {
  const [data, setData] = useState<{ reviews: FeaturedReview[]; average: number; count: number } | null>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    db.init().then(() => db.getFeaturedReviews()).then(d => { if (!cancelled) setData(d); });
    return () => { cancelled = true; };
  }, []);

  // Enable/disable the arrows depending on scroll position
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const update = () => {
      setCanPrev(el.scrollLeft > 4);
      setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => { el.removeEventListener('scroll', update); window.removeEventListener('resize', update); };
  }, [data]);

  const scroll = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' });
  };

  // Nothing real to show yet — better no section than a fake one
  if (!data || data.reviews.length === 0) return null;

  return (
    <section className="reviews-home" aria-labelledby="reviews-heading">
      <div className="container">
        <div className="reviews-home-head">
          <div>
            <h2 id="reviews-heading" className="section-title">WHAT CUSTOMERS SAY</h2>
            {data.count > 0 && (
              <p className="reviews-home-summary">
                <span className="reviews-home-stars" aria-hidden="true">{stars(data.average)}</span>
                <strong>{data.average.toFixed(1)}</strong> out of 5 · {data.count} review{data.count === 1 ? '' : 's'}
              </p>
            )}
          </div>
          {data.reviews.length > 1 && (
            <div className="reviews-home-nav">
              <button type="button" onClick={() => scroll(-1)} disabled={!canPrev} aria-label="Previous reviews">←</button>
              <button type="button" onClick={() => scroll(1)} disabled={!canNext} aria-label="More reviews">→</button>
            </div>
          )}
        </div>

        <div className="reviews-home-track" ref={trackRef} role="list">
          {data.reviews.map(r => (
            <article key={r.id} className="reviews-home-card" role="listitem">
              <div className="reviews-home-card-top">
                <span className="reviews-home-stars" aria-label={`${r.rating} out of 5 stars`}>{stars(r.rating)}</span>
                <span className="reviews-home-date">{timeAgo(r.date)}</span>
              </div>
              <p className="reviews-home-text">&ldquo;{r.text}&rdquo;</p>
              <div className="reviews-home-author">
                <span className="reviews-home-avatar" aria-hidden="true">{r.name.charAt(0).toUpperCase()}</span>
                <span>
                  <strong>{r.name}</strong>
                  {r.verified && <span className="reviews-home-verified">✓ Verified buyer</span>}
                </span>
              </div>
              {r.product && (
                <Link href={`/product/${r.product.id}`} className="reviews-home-product">
                  {r.product.images[0] && <Image src={r.product.images[0]} alt="" width={80} height={80} />}
                  <span>
                    <span className="reviews-home-product-label">Reviewed</span>
                    <span className="reviews-home-product-name">{r.product.name}</span>
                  </span>
                  <span aria-hidden="true">→</span>
                </Link>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
