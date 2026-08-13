'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { db } from '@/lib/db';
import ProductCard from '@/components/ui/ProductCard';
import type { Product, Testimonial } from '@/lib/types';

// ── Promo configuration — edit to change the active promo ───────────────────
const PROMO = {
  active: true,
  badge: '🎉 Limited Time',
  title: 'END OF SEASON\nSALE',
  subtitle: "Up to 40% off on selected styles. Don't miss out — stock is flying off the shelves.",
  gradient: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
  accentColor: '#e94560',
  btnLabel: 'Shop the Sale',
  btnHref: '/category',
  countdownTo: '2026-09-01T00:00:00', // set to null to hide countdown
  visual: '🛍️',
};

function useCountdown(target: string | null) {
  const calc = () => {
    if (!target) return null;
    const diff = new Date(target).getTime() - Date.now();
    if (diff <= 0) return { d: 0, h: 0, m: 0, s: 0 };
    return {
      d: Math.floor(diff / 86400000),
      h: Math.floor((diff % 86400000) / 3600000),
      m: Math.floor((diff % 3600000) / 60000),
      s: Math.floor((diff % 60000) / 1000),
    };
  };
  // Start as null so SSR and the first client render both output nothing,
  // avoiding a hydration mismatch from Date.now() ticking between renders.
  const [time, setTime] = useState<ReturnType<typeof calc>>(null);
  useEffect(() => {
    if (!target) return;
    setTime(calc()); // populate immediately after mount
    const iv = setInterval(() => setTime(calc()), 1000);
    return () => clearInterval(iv);
  }, [target]);
  return time;
}

function PromoBanner() {
  const countdown = useCountdown(PROMO.countdownTo);
  if (!PROMO.active) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    <section className="promo-section">
      <div className="container">
        <div className="promo-banner" style={{ background: PROMO.gradient }}>
          <div className="promo-content">
            <div className="promo-badge" style={{ color: PROMO.accentColor, borderColor: PROMO.accentColor, background: `${PROMO.accentColor}22` }}>
              {PROMO.badge}
            </div>
            <div className="promo-title">
              {PROMO.title.split('\n').map((line, i, arr) => (
                <span key={i} style={i === arr.length - 1 ? { color: PROMO.accentColor } : undefined}>
                  {line}{i < arr.length - 1 && <br />}
                </span>
              ))}
            </div>
            <p className="promo-subtitle">{PROMO.subtitle}</p>
            <div className="promo-actions">
              <Link href={PROMO.btnHref} className="promo-btn" style={{ color: '#1a1a2e' }}>
                {PROMO.btnLabel} →
              </Link>
              {countdown && (
                <div className="promo-countdown">
                  {([['d', 'Days'], ['h', 'Hrs'], ['m', 'Min'], ['s', 'Sec']] as [keyof typeof countdown, string][]).map(([k, label]) => (
                    <div className="countdown-unit" key={k}>
                      <span className="countdown-number">{pad(countdown[k] as number)}</span>
                      <span className="countdown-label">{label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="promo-visual" aria-hidden="true" style={{ fontSize: 96, filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.3))' }}>
            {PROMO.visual}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Carousel section with scroll-synced dots ────────────────────────────────
function CarouselSection({ title, products, viewAllHref }: {
  title: string;
  products: Product[];
  viewAllHref: string;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
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

  // Auto-advance
  useEffect(() => {
    if (!products.length) return;
    const iv = setInterval(() => {
      const el = wrapperRef.current;
      if (!el) return;
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
        <div ref={wrapperRef} style={{ overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
          <div className="products-grid carousel-grid" style={{ display: 'flex', gap: 16, minWidth: 'min-content' }}>
            {products.map(p => <ProductCard key={p.id} product={p} carousel />)}
          </div>
        </div>
        {products.length > 3 && (
          <div className="carousel-dots">
            {Array.from({ length: DOT_COUNT }).map((_, i) => (
              <span key={i} className={i === activeIdx ? 'active' : ''} onClick={() => scrollToIdx(i)} />
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
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [testimonialIdx, setTestimonialIdx] = useState(0);
  const testimonialRef = useRef<HTMLDivElement>(null);
  const testimonialWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      await db.init();
      setNewArrivals(db.getProductsByTag('new'));
      setTopSelling(db.getProductsByTag('top'));
      setTestimonials(db.getTestimonials());
    })();
  }, []);

  // Testimonial auto-cycle
  useEffect(() => {
    if (!testimonials.length) return;
    const iv = setInterval(() => setTestimonialIdx(i => (i + 1) % testimonials.length), 4000);
    return () => clearInterval(iv);
  }, [testimonials.length]);

  // Testimonial scroll — use wrapper's ACTUAL width so mobile never shows a blank
  useEffect(() => {
    const wrapper = testimonialWrapperRef.current;
    const track = testimonialRef.current;
    if (!wrapper || !track) return;
    const cardW = wrapper.clientWidth;
    track.style.transform = `translateX(-${testimonialIdx * (cardW + 20)}px)`;
  }, [testimonialIdx]);

  const renderStars = (rating: number) => Array.from({ length: 5 }, (_, i) => i < Math.floor(rating) ? '★' : '☆').join('');

  return (
    <main>
      {/* HERO */}
      <section className="hero">
        <div className="hero-inner">
          <div className="hero-content">
            <h1 className="hero-title">WE HAVE CLOTHES THAT MATCH YOUR STYLE</h1>
            <p className="hero-desc">
              Browse through our diverse range of meticulously crafted garments, designed to bring out
              your individuality and cater to your sense of style.
            </p>
            <Link href="/category" className="btn btn-primary">Shop Now</Link>
            <div className="hero-stats">
              <div className="hero-stat"><div className="number">200+</div><div className="label">International Brands</div></div>
              <div className="hero-stat"><div className="number">2,000+</div><div className="label">High-Quality Products</div></div>
              <div className="hero-stat"><div className="number">30,000+</div><div className="label">Happy Customers</div></div>
            </div>
          </div>
          <div className="hero-image">
            <img src="/assets/images/landing_page.jpg" alt="KB.ENT Fashion" loading="lazy" />
          </div>
        </div>
      </section>

      {/* BRANDS BAR */}
      <div className="brands-bar">
        <div className="brands-bar-inner track-1">
          {['VERSACE', 'ZARA', 'GUCCI', 'PRADA', 'Calvin Klein', 'VERSACE', 'ZARA', 'GUCCI', 'PRADA', 'Calvin Klein'].map((b, i) => (
            <span key={i} className="brand-logo">{b}</span>
          ))}
        </div>
        <div className="brands-bar-inner track-2 mobile-only">
          {['DIOR', 'NIKE', 'CHANEL', 'BALENCIAGA', 'DIOR', 'NIKE', 'CHANEL', 'BALENCIAGA'].map((b, i) => (
            <span key={i} className="brand-logo">{b}</span>
          ))}
        </div>
      </div>

      {/* NEW ARRIVALS */}
      <CarouselSection title="NEW ARRIVALS" products={newArrivals} viewAllHref="/category?filter=new" />

      <hr className="section-divider" />

      {/* TOP SELLING */}
      <CarouselSection title="TOP SELLING" products={topSelling} viewAllHref="/category?filter=top" />

      {/* PROMO BANNER */}
      <PromoBanner />

      {/* BROWSE BY STYLE */}
      <section className="style-section">
        <div className="container">
          <div className="style-grid">
            <h2 className="section-title" style={{ marginBottom: 36 }}>BROWSE BY DRESS STYLE</h2>
            <div className="style-grid-inner">
              <Link href="/category?style=casual" className="style-card" style={{ backgroundImage: "url('/assets/images/causal.jpg')", backgroundColor: '#F0F0F0' }}>
                <span className="style-card-label">Casual</span>
              </Link>
              <Link href="/category?style=formal" className="style-card" style={{ backgroundImage: "url('/assets/images/black suit.jpg')", backgroundColor: '#F0F0F0' }}>
                <span className="style-card-label">Formal</span>
              </Link>
              <Link href="/category?style=party" className="style-card" style={{ backgroundImage: "url('/assets/images/party.jpg')", backgroundColor: '#F0F0F0' }}>
                <span className="style-card-label">Party</span>
              </Link>
              <Link href="/category?style=gym" className="style-card" style={{ backgroundImage: "url('/assets/images/Gym.jpg')", backgroundColor: '#F0F0F0' }}>
                <span className="style-card-label">Gym</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="testimonials-section">
        <div className="container">
          <div className="testimonials-header">
            <h2 className="testimonials-title">OUR HAPPY CUSTOMERS</h2>
            <div className="testimonials-dots">
              {testimonials.map((_, i) => (
                <span key={i} className={i === testimonialIdx ? 'active' : ''} onClick={() => setTestimonialIdx(i)} />
              ))}
            </div>
          </div>
          <div className="testimonials-track-wrapper" ref={testimonialWrapperRef}>
            <div className="testimonials-track" ref={testimonialRef}>
              {testimonials.map((t, i) => (
                <div className="testimonial-card" key={i}>
                  <div className="testimonial-stars">{renderStars(t.rating)}</div>
                  <div className="testimonial-name">
                    {t.name}
                    {t.verified && <span className="verified-badge" title="Verified Purchase">✓</span>}
                  </div>
                  <p className="testimonial-text">&ldquo;{t.text}&rdquo;</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}