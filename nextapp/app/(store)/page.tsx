'use client';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { db } from '@/lib/db';
import ProductCard from '@/components/ui/ProductCard';
import ProductCardSkeleton from '@/components/ui/ProductCardSkeleton';
import type { Product } from '@/lib/types';
import StyleShowcase from '@/components/home/StyleShowcase';
import CustomerReviews from '@/components/home/CustomerReviews';
import { getBrandLogo } from '@/lib/brandLogos';
import Image from 'next/image';
import { getPromo, isPromoLive, type PromoSettings } from '@/lib/promo';


// ── Carousel section with scroll-synced dots ────────────────────────────────
function CarouselSection({ title, products, viewAllHref, loading }: {
  title: string;
  products: Product[];
  viewAllHref: string;
  loading: boolean;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const DOT_COUNT = Math.min(products.length, 8);

  // Track scroll position to update active dot
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const onScroll = () => {
      const pct = el.scrollLeft / Math.max(1, el.scrollWidth - el.clientWidth);
      setActiveIdx(Math.round(pct * (DOT_COUNT - 1)));
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [products, DOT_COUNT]);

  // Dot click — scroll proportionally
  const scrollToIdx = (i: number) => {
    const el = wrapperRef.current;
    if (!el) return;
    const target = (i / Math.max(1, DOT_COUNT - 1)) * (el.scrollWidth - el.clientWidth);
    el.scrollTo({ left: target, behavior: 'smooth' });
  };

  // Auto-advance — pauses while the shopper is hovering, touching or focused inside,
  // and never runs for people who have asked their device to reduce motion
  useEffect(() => {
    if (!products.length) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const iv = setInterval(() => {
      const el = wrapperRef.current;
      if (!el || pausedRef.current || el.scrollWidth <= el.clientWidth) return;
      const nextScroll = el.scrollLeft + el.clientWidth * 0.8;
      el.scrollTo({ left: nextScroll >= el.scrollWidth - el.clientWidth ? 0 : nextScroll, behavior: 'smooth' });
    }, 3500);
    return () => clearInterval(iv);
  }, [products]);

  return (
    <section>
      <div className="container">
        <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <h2 className="section-title" style={{ marginBottom: 0 }}>{title}</h2>
        </div>
        <div
          ref={wrapperRef}
          className="carousel-wrapper"
          onMouseEnter={() => { pausedRef.current = true; }}
          onMouseLeave={() => { pausedRef.current = false; }}
          onTouchStart={() => { pausedRef.current = true; }}
          onFocus={() => { pausedRef.current = true; }}
          onBlur={() => { pausedRef.current = false; }}
        >
          <div className="products-grid carousel-grid">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => <ProductCardSkeleton key={i} carousel />)
              : products.map(p => <ProductCard key={p.id} product={p} carousel />)}
          </div>
        </div>
        {!loading && products.length === 0 && (
          <p style={{ color: 'var(--gray-600)', textAlign: 'center', padding: '24px 0' }}>New styles are on the way — check back soon.</p>
        )}
        {products.length > 3 && (
          <div className="carousel-dots">
            {Array.from({ length: DOT_COUNT }).map((_, i) => (
              <button type="button" key={i} className={i === activeIdx ? 'active' : ''} onClick={() => scrollToIdx(i)} aria-label={`Scroll to part ${i + 1} of ${DOT_COUNT}`} aria-current={i === activeIdx} />
            ))}
          </div>
        )}
        <div className="view-all-wrap">
          <Link href={viewAllHref} className="btn btn-outline">View All</Link>
        </div>
      </div>
    </section>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function HomePage() {
  const [newArrivals, setNewArrivals] = useState<Product[]>([]);
  const [topSelling, setTopSelling] = useState<Product[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  // undefined = still loading (so the hero doesn't flash the normal photo before the sale ad)
  const [promo, setPromo] = useState<PromoSettings | null | undefined>(undefined);
  const [loaded, setLoaded] = useState(false);

  // Fetched straight away (not after the product load) so the hero image is decided quickly
  useEffect(() => {
    getPromo().then(setPromo).catch(() => setPromo(null));
  }, []);

  useEffect(() => {
    (async () => {
      await db.init();
      setNewArrivals(db.getProductsByTag('new'));
      setTopSelling(db.getProductsByTag('top'));
      setAllProducts(db.getProducts());
      setLoaded(true);
    })();
  }, []);

  return (
    <main>
      {/* HERO */}
      <section className="hero">
        <div className="hero-inner">
          <div className="hero-content">
            <p className="hero-kicker">new season · est. 2026</p>
            <h1 className="hero-title">Stressed?<br />Get dressed.</h1>
            <p className="hero-desc">
              Fits that take the pressure off. Streetwear and everyday staples,
              delivered to your door — wherever in the world that is.
            </p>
            <div className="hero-actions">
              <Link href="/category" className="btn btn-primary">Shop now</Link>
              <Link href="/category?filter=new" className="btn btn-outline">New drops</Link>
            </div>
          </div>
          <div className="hero-image">
            {promo === undefined ? null : promo && isPromoLive(promo) && promo.image ? (
              // Promo running: the ad takes the place of the usual photo (no extra section) and links to the sale
              <Link href={promo.ctaHref} className="hero-promo-link">
                <Image src={promo.image} alt={promo.title.trim() || 'Sale — shop now'} width={1200} height={1500} sizes="(max-width: 768px) 100vw, 50vw" preload />
              </Link>
            ) : (
              <Image src="/assets/images/landing_page.jpg" alt="stress_d fashion" width={736} height={920} sizes="(max-width: 768px) 100vw, 50vw" preload />
            )}
          </div>
        </div>
      </section>

      {/* BRANDS BAR */}
      {(() => {
        const track1 = ['Versace', 'Zara', 'Gucci', 'Prada', 'Calvin Klein', 'Dior', 'Nike', 'Chanel', 'Balenciaga', 'Adidas'];
        const track2 = ['Puma', 'Lacoste', 'Hugo Boss', 'Under Armour', 'H&M', 'Clarks', 'Zara', 'Nike', 'Gucci', 'Prada'];

        const renderLogo = (b: string, i: number) => {
          const src = getBrandLogo(b, 80);
          return (
            <span key={i} className="brand-logo-item">
              {src && (
                // Third-party logo CDN with an onError text fallback; next/image would proxy it through the optimiser.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={src}
                  alt=""
                  className="brand-bar-logo-img"
                  // Start invisible — only reveal on successful load
                  style={{ opacity: 0, transition: 'opacity 0.3s ease' }}
                  onLoad={(e) => {
                    const img = e.currentTarget as HTMLImageElement;
                    img.style.opacity = '0.85';
                    // Hide the text fallback sitting beside it
                    const txt = img.nextElementSibling as HTMLElement;
                    if (txt) txt.style.display = 'none';
                  }}
                  onError={(e) => {
                    // Image failed — hide it completely, show the text fallback
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                    const txt = e.currentTarget.nextElementSibling as HTMLElement;
                    if (txt) txt.style.display = 'inline';
                  }}
                />
              )}
              {/* Text shown by default; hidden by onLoad if the image succeeds */}
              <span className="brand-bar-logo-text">{b.toUpperCase()}</span>
            </span>
          );
        };

        const t1 = [...track1, ...track1];
        const t2 = [...track2, ...track2];
        return (
          <div className="brands-bar">
            <div className="brands-bar-inner track-1">
              {t1.map(renderLogo)}
            </div>
            <div className="brands-bar-inner track-2 mobile-only">
              {t2.map(renderLogo)}
            </div>
          </div>
        );
      })()}


      {/* NEW ARRIVALS */}
      <CarouselSection title="NEW ARRIVALS" products={newArrivals} viewAllHref="/category?filter=new" loading={!loaded} />

      <hr className="section-divider" />

      {/* TOP SELLING */}
      <CarouselSection title="TOP SELLING" products={topSelling} viewAllHref="/category?filter=top" loading={!loaded} />

      {/* SHOP BY STYLE */}
      <StyleShowcase products={allProducts} loading={!loaded} />

      {/* REAL CUSTOMER REVIEWS (hidden until there are some) */}
      <CustomerReviews />
    </main>
  );
}