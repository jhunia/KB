'use client';
import { useEffect, useState, useCallback, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { db } from '@/lib/db';
import ProductCard from '@/components/ui/ProductCard';
import ProductCardSkeleton from '@/components/ui/ProductCardSkeleton';
import type { Product } from '@/lib/types';
import { getBrandLogo } from '@/lib/brandLogos';
import { normalizeSize, sizeGroups } from '@/lib/sizes';

const PER_PAGE = 9;
const PRICE_SLIDER_MAX = 1000;
const ALL_STYLES = ['casual', 'formal', 'party', 'gym'];
// Preferred display order; any other category that products use is added after these
const CATEGORY_ORDER = ['tshirts', 'shirts', 'jerseys', 'jeans', 'hoodies', 'jackets', 'suits', 'shoes', 'sandals', 'accessories'];

export default function CategoryPage() {
  return (
    <Suspense fallback={<main className="category-main"><div className="container" /></main>}>
      <CategoryPageInner />
    </Suspense>
  );
}

function CategoryPageInner() {
  const params = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [sort, setSort] = useState('popular');

  const [selCategories, setSelCategories] = useState<string[]>([]);
  const [selSizes, setSelSizes] = useState<string[]>([]);
  const [selStyles, setSelStyles] = useState<string[]>(() => {
    const style = params.get('style');
    return style ? [style] : [];
  });
  const [priceMax, setPriceMax] = useState(PRICE_SLIDER_MAX);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      await db.init();
      setProducts(db.getProducts());
      setBrands(db.getBrands());
      setLoaded(true);
    })();
  }, []);

  // Apply filters (derived from products + URL params + sidebar selections)
  const filtered = useMemo(() => {
    const filterTag = params.get('filter');
    const searchQ = params.get('search');
    const gender = params.get('gender');
    const brand = params.get('brand');
    const style = params.get('style') || (selStyles.length === 1 ? selStyles[0] : null);

    let result = [...products];

    if (searchQ) result = result.filter(p => p.name.toLowerCase().includes(searchQ.toLowerCase()) || (p.description || '').toLowerCase().includes(searchQ.toLowerCase()));
    if (filterTag === 'new') result = result.filter(p => p.tag === 'new');
    else if (filterTag === 'sale') result = result.filter(p => p.discount && p.discount > 0);
    else if (filterTag === 'top') result = result.filter(p => p.tag === 'top');
    if (gender) result = result.filter(p => p.gender === gender || p.gender === 'Uni-sex');
    if (brand) result = result.filter(p => p.brand === brand);
    if (style && !params.get('style')) result = result.filter(p => p.style?.toLowerCase() === style);
    if (params.get('style')) result = result.filter(p => p.style?.toLowerCase() === params.get('style'));
    if (selCategories.length) result = result.filter(p => selCategories.includes(p.category));
    if (selSizes.length) result = result.filter(p => p.sizes.some(s => selSizes.includes(normalizeSize(s))));
    if (selStyles.length && !params.get('style')) result = result.filter(p => selStyles.includes(p.style?.toLowerCase() || ''));
    // Slider at its maximum means "any price", so expensive items are never silently hidden
    if (priceMax < PRICE_SLIDER_MAX) result = result.filter(p => p.price <= priceMax);

    if (sort === 'price-asc') result.sort((a, b) => a.price - b.price);
    else if (sort === 'price-desc') result.sort((a, b) => b.price - a.price);
    else if (sort === 'newest') result.sort((a, b) => b.id - a.id);
    else result.sort((a, b) => b.rating - a.rating);

    return result;
  }, [products, params, selCategories, selSizes, selStyles, priceMax, sort]);

  // Go back to page 1 whenever the filtered list changes
  const [pageState, setPageState] = useState({ list: filtered, page: 1 });
  const page = pageState.list === filtered ? pageState.page : 1;
  const setPage = (next: number | ((p: number) => number)) =>
    setPageState({ list: filtered, page: typeof next === 'function' ? next(page) : next });

  // Filter options come from the catalogue itself, so every product can be reached
  const sizeOptions = useMemo(() => sizeGroups(products.flatMap(p => p.sizes)), [products]);
  const categoryOptions = useMemo(() => {
    const used = new Set(products.map(p => p.category).filter(Boolean));
    return [...CATEGORY_ORDER.filter(c => used.has(c)), ...[...used].filter(c => !CATEGORY_ORDER.includes(c)).sort()];
  }, [products]);

  const isBrandsView = params.get('filter') === 'brands';
  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const pageProducts = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const toggleFilter = useCallback((arr: string[], val: string, setter: (v: string[]) => void) => {
    setter(arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val]);
  }, []);

  const getBreadcrumb = () => {
    const style = params.get('style');
    const filter = params.get('filter');
    const gender = params.get('gender');
    const brand = params.get('brand');
    const search = params.get('search');
    if (search) return `Search: "${search}"`;
    if (style) return style.charAt(0).toUpperCase() + style.slice(1);
    if (filter === 'new') return 'New Arrivals';
    if (filter === 'sale') return 'On Sale';
    if (filter === 'top') return 'Top Selling';
    if (filter === 'brands') return 'Brands';
    if (gender) return `${gender}'s Collection`;
    if (brand) return `${brand} Collection`;
    return 'All Products';
  };

  return (
    <main>
      <div className="container">
        {/* Breadcrumb */}
        <div className="breadcrumb">
          <Link href="/">Home</Link>
          <span>›</span>
          <span id="breadcrumbCurrent">{getBreadcrumb()}</span>
        </div>

        {/* Brands Grid View */}
        {isBrandsView ? (
          <div style={{ paddingBottom: 64 }}>
            <h1 className="section-title" style={{ textAlign: 'left', marginBottom: 32 }}>Shop By Brand</h1>
            <div className="brands-grid">
              {brands.map(brand => {
                const count = products.filter(p => p.brand === brand).length;
                const logoSrc = getBrandLogo(brand, 80);
                return (
                  <Link key={brand} href={`/category?brand=${encodeURIComponent(brand)}`} className="brand-card">
                    <div className="brand-logo-wrap">
                      {logoSrc ? (
                        // Third-party logo CDN with an onError text fallback; next/image would proxy it through the optimiser.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={logoSrc}
                          alt={brand}
                          className="brand-logo-img"
                          onError={(e) => {
                            // Fallback to text if logo fails to load
                            (e.currentTarget as HTMLImageElement).style.display = 'none';
                            const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                            if (fallback) fallback.style.display = 'block';
                          }}
                        />
                      ) : null}
                      <span className="brand-logo-fallback" style={{ display: logoSrc ? 'none' : 'block' }}>
                        {brand}
                      </span>
                    </div>
                    <div className="brand-card-count">{count} product{count !== 1 ? 's' : ''}</div>
                  </Link>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="category-layout">
            {/* FILTER SIDEBAR */}
            <aside className={`filter-sidebar${filterOpen ? ' open' : ''}`}>
              <div className="filter-header">
                <h3>Filters</h3>
                <button className="filter-close-mobile" onClick={() => setFilterOpen(false)} style={{ display: 'block' }}>✕</button>
              </div>

              <div className="filter-group">
                <div className="filter-group-title">Categories</div>
                <div className="filter-group-content">
                  {categoryOptions.map(cat => (
                    <label key={cat} className="filter-check">
                      <input type="checkbox" checked={selCategories.includes(cat)} onChange={() => toggleFilter(selCategories, cat, setSelCategories)} />
                      {cat === 'tshirts' ? 'T-shirts' : cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </label>
                  ))}
                </div>
              </div>

              <hr className="filter-divider" />

              <div className="filter-group">
                <div className="filter-group-title">Price (up to GH₵{priceMax}{priceMax >= PRICE_SLIDER_MAX ? '+' : ''})</div>
                <div className="filter-group-content">
                  <div className="price-range">
                    <input type="range" min={50} max={PRICE_SLIDER_MAX} value={priceMax} onChange={e => setPriceMax(Number(e.target.value))} style={{ width: '100%', pointerEvents: 'all' }} />
                  </div>
                  <div className="price-labels"><span>GH₵50</span><span>GH₵{priceMax}{priceMax >= PRICE_SLIDER_MAX ? '+' : ''}</span></div>
                </div>
              </div>

              <hr className="filter-divider" />

              <div className="filter-group">
                <div className="filter-group-title">Size</div>
                <div className="filter-group-content">
                  {sizeOptions.map(group => (
                    <div key={group.label} className="size-group">
                      {sizeOptions.length > 1 && <div className="size-group-label">{group.label}</div>}
                      <div className="size-pills">
                        {group.sizes.map(s => (
                          <button key={s} type="button" aria-pressed={selSizes.includes(s)} className={`size-pill${selSizes.includes(s) ? ' active' : ''}`} onClick={() => toggleFilter(selSizes, s, setSelSizes)}>{s}</button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <hr className="filter-divider" />

              <div className="filter-group">
                <div className="filter-group-title">Style</div>
                <div className="filter-group-content">
                  {ALL_STYLES.map(st => (
                    <label key={st} className="filter-check">
                      <input type="checkbox" checked={selStyles.includes(st)} onChange={() => toggleFilter(selStyles, st, setSelStyles)} />
                      {st.charAt(0).toUpperCase() + st.slice(1)}
                    </label>
                  ))}
                </div>
              </div>

              <hr className="filter-divider" />

              <button
                className="btn btn-primary btn-sm"
                style={{ width: '100%', marginTop: 8 }}
                onClick={() => { setSelCategories([]); setSelSizes([]); setSelStyles([]); setPriceMax(PRICE_SLIDER_MAX); }}
              >
                Reset Filters
              </button>
            </aside>

            {/* MAIN CONTENT */}
            <div className="category-main">
              <div className="category-top-bar">
                <div className="category-info">Showing {Math.min((page-1)*PER_PAGE+1, filtered.length)}–{Math.min(page*PER_PAGE, filtered.length)} of {filtered.length} Products</div>
                <div className="category-controls">
                  <button className="mobile-filter-btn" onClick={() => setFilterOpen(true)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
                    Filters
                  </button>
                  <select className="sort-select" value={sort} onChange={e => setSort(e.target.value)}>
                    <option value="popular">Most Popular</option>
                    <option value="newest">Newest</option>
                    <option value="price-asc">Price: Low to High</option>
                    <option value="price-desc">Price: High to Low</option>
                  </select>
                </div>
              </div>

              {!loaded ? (
                <div className="products-grid category-grid" aria-busy="true" aria-label="Loading products">
                  {Array.from({ length: 6 }).map((_, i) => <ProductCardSkeleton key={i} />)}
                </div>
              ) : pageProducts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '80px 0' }}>
                  <p style={{ fontSize: 18, color: 'var(--gray-600)' }}>No products found. Try adjusting your filters.</p>
                </div>
              ) : (
                <div className="products-grid category-grid">
                  {pageProducts.map(p => <ProductCard key={p.id} product={p} />)}
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="pagination">
                  <button className="pagination-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                    ← Previous
                  </button>
                  <div className="pagination-numbers">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                      <button key={n} className={`page-num${n === page ? ' active' : ''}`} onClick={() => setPage(n)}>{n}</button>
                    ))}
                  </div>
                  <button className="pagination-btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                    Next →
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
