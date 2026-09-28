'use client';
import Link from 'next/link';
import Image from 'next/image';
import type { Product } from '@/lib/types';

const STYLES = [
  { key: 'casual', label: 'Casual', blurb: 'Everyday fits', image: '/assets/images/causal.jpg' },
  { key: 'formal', label: 'Formal', blurb: 'Suits & smart wear', image: '/assets/images/black suit.jpg' },
  { key: 'party', label: 'Party', blurb: 'Stand-out looks', image: '/assets/images/party.jpg' },
  { key: 'gym', label: 'Gym', blurb: 'Train in comfort', image: '/assets/images/Gym.jpg' },
];

/** "Shop by style" tiles, each showing how many products are in that style */
export default function StyleShowcase({ products, loading }: { products: Product[]; loading: boolean }) {
  const count = (style: string) => products.filter(p => p.style?.toLowerCase() === style && p.inStock !== false).length;

  return (
    <section className="style-section" aria-labelledby="style-heading">
      <div className="container">
        <div className="style-showcase">
          <div className="style-showcase-head">
            <div>
              <h2 id="style-heading" className="section-title">SHOP BY STYLE</h2>
              <p className="style-showcase-sub">Find the look for every moment — from weekend casual to big nights out.</p>
            </div>
            <Link href="/category" className="style-showcase-all">View all styles →</Link>
          </div>
          <div className="style-tiles">
            {STYLES.map((s, i) => {
              const n = count(s.key);
              return (
                <Link key={s.key} href={`/category?style=${s.key}`} className={`style-tile style-tile-${i + 1}`} aria-label={`Shop ${s.label}${loading ? '' : `, ${n} items`}`}>
                  <Image src={s.image} alt="" fill sizes="(max-width: 768px) 50vw, 40vw" className="style-tile-img" />
                  <span className="style-tile-body">
                    <span className="style-tile-label">{s.label}</span>
                    <span className="style-tile-meta">{loading ? s.blurb : n ? `${n} item${n === 1 ? '' : 's'}` : s.blurb}</span>
                  </span>
                  <span className="style-tile-arrow" aria-hidden="true">→</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
