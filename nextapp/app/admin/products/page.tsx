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
      .then(() => { if (!cancelled) setProducts([...db.getAllProducts()]); });
    return () => { cancelled = true; };
  }, []);

  const visible = useMemo(() => {
    if (!products) return null;
    const term = q.toLowerCase();
    const list = products.filter(p =>
      (!term || p.name.toLowerCase().includes(term) || (p.brand || '').toLowerCase().includes(term)) &&
      (!category || p.category === category) &&
      // Archived (removed) products only show under the "Archived" filter
      (stock === 'archived' ? p.archived : !p.archived) &&
      (!stock || stock === 'archived' || (stock === 'out' ? p.inStock === false : p.inStock !== false)));
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
    setProducts([...db.getAllProducts()]);
    toast(failed ? `${failed} product(s) could not be updated.` : `Marked ${ids.length} product(s) ${inStock ? 'in stock' : 'out of stock'}.`, failed ? 'error' : 'success');
  };

  const bulkStock = async (inStock: boolean) => {
    const ok = await confirm({ title: `Mark ${selected.size} product(s) ${inStock ? 'in stock' : 'out of stock'}?`, confirmLabel: 'Update' });
    if (ok) setStock([...selected], inStock);
  };

  // Never ordered → deleted for good; ordered → archived (see db.deleteProduct)
  const removeProducts = async (ids: number[]) => {
    const names = ids.length === 1 ? `“${products?.find(p => p.id === ids[0])?.name}”` : `${ids.length} products`;
    const ok = await confirm({
      title: `Delete ${names}?`,
      message: 'Products nobody has ordered are deleted for good. Products that have been ordered are removed from the shop but kept in past orders — you can restore them from the Archived filter.',
      confirmLabel: 'Delete', danger: true,
    });
    if (!ok) return;
    setBusy(true);
    let deleted = 0, archived = 0, failed = 0, lastError = '';
    for (const id of ids) {
      const res = await db.deleteProduct(id);
      if (!res.success) { failed++; lastError = res.message || ''; } else if (res.archived) archived++; else deleted++;
    }
    setBusy(false);
    setSelected(new Set());
    setProducts([...db.getAllProducts()]);
    const parts = [deleted && `${deleted} deleted`, archived && `${archived} removed from the shop (kept in past orders)`, failed && `${failed} failed${lastError ? `: ${lastError}` : ''}`].filter(Boolean);
    toast(parts.join(' · '), failed ? 'error' : 'success');
  };

  const restore = async (id: number) => {
    setBusy(true);
    const ok = await db.restoreProduct(id);
    setBusy(false);
    setProducts([...db.getAllProducts()]);
    toast(ok ? 'Back in the shop.' : 'Could not restore the product.', ok ? 'success' : 'error');
  };

  const live = products?.filter(p => !p.archived) ?? [];
  const outCount = live.filter(p => p.inStock === false).length;
  const archivedCount = (products?.length ?? 0) - live.length;

  return (
    <>
      <PageHeader
        title="Products"
        subtitle={products ? `${live.length} products · ${outCount} out of stock${archivedCount ? ` · ${archivedCount} archived` : ''}` : ' '}
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
            <option value="archived">Archived (removed from shop)</option>
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
            <button type="button" className="adm-btn adm-btn-sm adm-btn-danger" disabled={busy} onClick={() => removeProducts([...selected])}>Delete</button>
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
                    <td data-label="Stock">{p.archived ? <Badge tone="gray">Archived</Badge> : p.inStock === false ? <Badge tone="red">Out of stock</Badge> : <Badge tone="green">In stock</Badge>}</td>
                    <td data-label="" onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        {p.archived ? (
                          <button type="button" className="adm-btn adm-btn-sm" disabled={busy} onClick={() => restore(p.id)}>Restore</button>
                        ) : (
                          <>
                            <button type="button" className="adm-btn adm-btn-sm" disabled={busy} onClick={() => setStock([p.id], p.inStock === false)}>
                              {p.inStock === false ? 'Restock' : 'Sold out'}
                            </button>
                            <a className="adm-btn adm-btn-sm" href={`/product/${p.id}`} target="_blank" rel="noopener noreferrer" aria-label={`View ${p.name} in store`}>View</a>
                          </>
                        )}
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
