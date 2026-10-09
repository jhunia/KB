import Link from 'next/link';
import type { Product } from '@/lib/types';

/*
 * Scrolling strip of the brands the store actually stocks (from the products, most
 * stocked first). Each name links to that brand's products. Plain text on purpose:
 * no third-party logo images that can fail or flash empty boxes, and no brands that
 * aren't sold here.
 */
export default function BrandsBar({ products, loading }: { products: Product[]; loading: boolean }) {
  const counts = new Map<string, number>();
  for (const p of products) {
    const b = p.brand?.trim();
    if (b) counts.set(b, (counts.get(b) || 0) + 1);
  }
  const brands = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([b]) => b);

  // Keep the reserved space while products load so the page doesn't jump; hide if there are no brands
  if (loading) return <div className="brands-bar" aria-hidden="true"><div className="brands-bar-placeholder" /></div>;
  if (brands.length === 0) return null;

  // Repeat short lists so one copy is wider than the screen, then double it for a seamless loop
  const base: string[] = [];
  while (base.length < 12) base.push(...brands);
  const track = [...base, ...base];
  // A calm, steady pace (~5 s per name) however many brands there are
  const duration = `${base.length * 5}s`;

  const item = (b: string, i: number) => (
    <Link
      key={i}
      href={`/category?brand=${encodeURIComponent(b)}`}
      className="brand-bar-name"
      // only the first copy is reachable by keyboard / screen readers; the rest is visual repetition
      tabIndex={i < brands.length ? undefined : -1}
      aria-hidden={i < brands.length ? undefined : true}
    >
      {b}
    </Link>
  );

  return (
    <nav className="brands-bar" aria-label="Shop by brand">
      <div className="brands-bar-inner track-1" style={{ animationDuration: duration }}>{track.map(item)}</div>
    </nav>
  );
}
