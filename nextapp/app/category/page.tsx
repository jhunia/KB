'use client';
import { useEffect, useState, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { db } from '@/lib/db';
import ProductCard from '@/components/ui/ProductCard';
import type { Product } from '@/lib/types';

const PER_PAGE = 9;
const ALL_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const ALL_STYLES = ['casual', 'formal', 'party', 'gym'];
const ALL_CATEGORIES = ['tshirts', 'shirts', 'jeans', 'hoodies', 'jackets', 'suits', 'shoes', 'accessories'];

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
  const [filtered, setFiltered] = useState<Product[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [initialized, setInitialized] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [sort, setSort] = useState('popular');

  const [selCategories, setSelCategories] = useState<string[]>([]);
  const [selSizes, setSelSizes] = useState<string[]>([]);
  const [selStyles, setSelStyles] = useState<string[]>([]);
  const [priceMax, setPriceMax] = useState(600);

  // Read initial URL params for style/filter
  useEffect(() => {
    const style = params.get('style');
    const filter = params.get('filter');
    if (style) setSelStyles([style]);
    (async () => {
      await db.init();
      setProducts(db.getProducts());
      setBrands(db.getBrands());
      setInitialized(true);
    })();
  }, []); // eslint-disable-line

  // Apply filters whenever dependencies change
  useEffect(() => {
    if (!initialized) return;
    const filterTag = params.get('filter');
    const searchQ = params.get('search');
    const gender = params.get('gender');
    const brand = params.get('brand');
    const style = params.get('style') || (selStyles.length === 1 ? selStyles[0] : null);

    let result = [...products];

    if (searchQ) result = result.filter(p => p.name.toLowerCase().includes(searchQ.toLowerCase()) || (p.description || '').toLowerCase().includes(searchQ.toLowerCase()));
    if (filterTag === 'new') result = result.filter(p => p.tag === 'new');
    else if (filterTag === 'sale') result = result.filter(p => p.discount && p.discount > 0);
    if (gender) result = result.filter(p => p.gender === gender || p.gender === 'Uni-sex');
    if (brand) result = result.filter(p => p.brand === brand);
    if (style && !params.get('style')) result = result.filter(p => p.style?.toLowerCase() === style);
    if (params.get('style')) result = result.filter(p => p.style?.toLowerCase() === params.get('style'));
    if (selCategories.length) result = result.filter(p => selCategories.includes(p.category));
    if (selSizes.length) result = result.filter(p => selSizes.some(s => p.sizes.includes(s)));
    if (selStyles.length && !params.get('style')) result = result.filter(p => selStyles.includes(p.style?.toLowerCase() || ''));
    result = result.filter(p => p.price <= priceMax);

    if (sort === 'price-asc') result.sort((a, b) => a.price - b.price);
    else if (sort === 'price-desc') result.sort((a, b) => b.price - a.price);
    else if (sort === 'newest') result.sort((a, b) => b.id - a.id);
    else result.sort((a, b) => b.rating - a.rating);

    setFiltered(result);
    setPage(1);
  }, [initialized, products, params, selCategories, selSizes, selStyles, priceMax, sort]);

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
                return (
                  <Link key={brand} href={`/category?brand=${encodeURIComponent(brand)}`} className="brand-card">
                    <div className="brand-card-title">{brand}</div>
                    <div className="brand-card-count">{count} products</div>
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
                  {ALL_CATEGORIES.map(cat => (
                    <label key={cat} className="filter-check">
                      <input type="checkbox" checked={selCategories.includes(cat)} onChange={() => toggleFilter(selCategories, cat, setSelCategories)} />
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </label>
                  ))}
                </div>
              </div>

              <hr className="filter-divider" />

              <div className="filter-group">
                <div className="filter-group-title">Price (up to GH₵{priceMax})</div>
                <div className="filter-group-content">
                  <div className="price-range">
                    <input type="range" min={50} max={1000} value={priceMax} onChange={e => setPriceMax(Number(e.target.value))} style={{ width: '100%', pointerEvents: 'all' }} />
                  </div>
                  <div className="price-labels"><span>GH₵50</span><span>GH₵{priceMax}</span></div>
                </div>
              </div>

              <hr className="filter-divider" />

              <div className="filter-group">
                <div className="filter-group-title">Size</div>
                <div className="filter-group-content">
                  <div className="size-pills">
                    {ALL_SIZES.map(s => (
                      <button key={s} className={`size-pill${selSizes.includes(s) ? ' active' : ''}`} onClick={() => toggleFilter(selSizes, s, setSelSizes)}>{s}</button>
                    ))}
                  </div>
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
                onClick={() => { setSelCategories([]); setSelSizes([]); setSelStyles([]); setPriceMax(600); }}
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

              {pageProducts.length === 0 ? (
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
