'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { db } from '@/lib/db';
import { fmtMoney, CATEGORIES, categoryLabel } from '@/lib/admin';
import type { Product } from '@/lib/types';
import { PageHeader, Card, Badge, EmptyState, SkeletonRows, SearchInput } from '@/components/admin/ui';
import { useFeedback } from '@/components/admin/Feedback';

export default function ProductsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { toast, confirm } = useFeedback();

  const q = params.get('q') || '';
  const category = params.get('category') || '';
  const stock = params.get('stock') || '';
  const sort = params.get('sort') || 'newest';

  const [search, setSearch] = useState(q);
  const [products, setProducts] = useState<Product[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);

  const setParams = useCallback((next: Record<string, string | null>) => {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) { if (v) sp.set(k, v); else sp.delete(k); }
    router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
  }, [params, pathname, router]);

  useEffect(() => {
    if (search === q) return;
    const t = setTimeout(() => setParams({ q: search.trim() || null }), 250);
    return () => clearTimeout(t);
  }, [search, q, setParams]);

  useEffect(() => {
    let cancelled = false;
    db.init()
      .then(() => db._loadProducts()) // always fresh in the admin
      .then(() => { if (!cancelled) setProducts([...db.getProducts()]); });
    return () => { cancelled = true; };
  }, []);

  const visible = useMemo(() => {
    if (!products) return null;
    const term = q.toLowerCase();
    const list = products.filter(p =>
      (!term || p.name.toLowerCase().includes(term) || (p.brand || '').toLowerCase().includes(term)) &&
      (!category || p.category === category) &&
      (!stock || (stock === 'out' ? p.inStock === false : p.inStock !== false)));
    const sorters: Record<string, (a: Product, b: Product) => number> = {
      newest: (a, b) => b.id - a.id,
      name: (a, b) => a.name.localeCompare(b.name),
      'price-asc': (a, b) => a.price - b.price,
      'price-desc': (a, b) => b.price - a.price,
    };
    return [...list].sort(sorters[sort] || sorters.newest);
  }, [products, q, category, stock, sort]);

  const allSelected = !!visible?.length && visible.every(p => selected.has(p.id));
  const toggle = (id: number) => setSelected(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const setStock = async (ids: number[], inStock: boolean) => {
    setBusy(true);
    let failed = 0;
    for (const id of ids) if (!(await db.updateProduct(id, { inStock }))) failed++;
    setBusy(false);
    setSelected(new Set());
    setProducts([...db.getProducts()]);
    toast(failed ? `${failed} product(s) could not be updated.` : `Marked ${ids.length} product(s) ${inStock ? 'in stock' : 'out of stock'}.`, failed ? 'error' : 'success');
  };

  const bulkStock = async (inStock: boolean) => {
    const ok = await confirm({ title: `Mark ${selected.size} product(s) ${inStock ? 'in stock' : 'out of stock'}?`, confirmLabel: 'Update' });
    if (ok) setStock([...selected], inStock);
  };

  const outCount = products?.filter(p => p.inStock === false).length ?? 0;

  return (
    <>
      <PageHeader
        title="Products"
        subtitle={products ? `${products.length} products · ${outCount} out of stock` : ' '}
        actions={<Link href="/admin/products/new" className="adm-btn adm-btn-primary">+ Add product</Link>}
      />
      <Card>
        <div className="adm-toolbar">
          <SearchInput value={search} onChange={setSearch} placeholder="Search name or brand" />
          <select className="adm-select" style={{ width: 'auto' }} value={category} onChange={e => setParams({ category: e.target.value || null })} aria-label="Category">
            <option value="">All categories</option>
            {Array.from(new Set([...CATEGORIES, ...(products || []).map(p => p.category).filter(Boolean)])).map(c => <option key={c} value={c}>{categoryLabel(c)}</option>)}
          </select>
          <select className="adm-select" style={{ width: 'auto' }} value={stock} onChange={e => setParams({ stock: e.target.value || null })} aria-label="Stock">
            <option value="">Any stock</option>
            <option value="in">In stock</option>
            <option value="out">Out of stock</option>
          </select>
          <select className="adm-select" style={{ width: 'auto' }} value={sort} onChange={e => setParams({ sort: e.target.value === 'newest' ? null : e.target.value })} aria-label="Sort">
            <option value="newest">Newest first</option>
            <option value="name">Name A–Z</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
          </select>
        </div>

        {selected.size > 0 && (
          <div className="adm-bulkbar" role="region" aria-label="Bulk actions">
            <strong>{selected.size} selected</strong>
            <button type="button" className="adm-btn adm-btn-sm" disabled={busy} onClick={() => bulkStock(true)}>Mark in stock</button>
            <button type="button" className="adm-btn adm-btn-sm" disabled={busy} onClick={() => bulkStock(false)}>Mark out of stock</button>
            <button type="button" className="adm-btn adm-btn-sm" onClick={() => setSelected(new Set())}>Clear</button>
          </div>
        )}

        {visible === null ? <SkeletonRows /> : visible.length === 0 ? (
          <EmptyState title="No products match these filters">
            {products?.length ? <button type="button" className="adm-link" onClick={() => { setSearch(''); router.replace(pathname); }}>Clear filters</button> : <Link className="adm-link" href="/admin/products/new">Add your first product</Link>}
          </EmptyState>
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th className="check"><input type="checkbox" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(visible.map(p => p.id)))} aria-label="Select all products shown" /></th>
                  <th>Product</th>
                  <th>Category</th>
                  <th className="num">Price</th>
                  <th>Stock</th>
                  <th><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {visible.map(p => (
                  <tr key={p.id} className={selected.has(p.id) ? 'selected' : ''} tabIndex={0}
                    onClick={() => router.push(`/admin/products/${p.id}`)} onKeyDown={e => e.key === 'Enter' && router.push(`/admin/products/${p.id}`)}>
                    <td className="check" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} aria-label={`Select ${p.name}`} />
                    </td>
                    <td className="adm-td-main">
                      <div className="adm-cell-main">
                        {p.images[0] ? <Image src={p.images[0]} alt="" width={88} height={88} className="adm-thumb" /> : <div className="adm-thumb" />}
                        <div style={{ minWidth: 0 }}>
                          <strong>{p.name}</strong>
                          <div className="adm-muted adm-small">{p.brand || 'No brand'} · {p.colors.length} colour(s) · {p.sizes.join(', ') || 'no sizes'}</div>
                        </div>
                      </div>
                    </td>
                    <td data-label="Category">{categoryLabel(p.category)}</td>
                    <td data-label="Price" className="num">
                      {fmtMoney(p.price)}
                      {p.originalPrice && <div className="adm-muted adm-small" style={{ textDecoration: 'line-through' }}>{fmtMoney(p.originalPrice)}</div>}
                    </td>
                    <td data-label="Stock">{p.inStock === false ? <Badge tone="red">Out of stock</Badge> : <Badge tone="green">In stock</Badge>}</td>
                    <td data-label="" onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button type="button" className="adm-btn adm-btn-sm" disabled={busy} onClick={() => setStock([p.id], p.inStock === false)}>
                          {p.inStock === false ? 'Restock' : 'Sold out'}
                        </button>
                        <a className="adm-btn adm-btn-sm" href={`/product/${p.id}`} target="_blank" rel="noopener noreferrer" aria-label={`View ${p.name} in store`}>View</a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
