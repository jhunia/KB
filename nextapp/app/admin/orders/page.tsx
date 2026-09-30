'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { db } from '@/lib/db';
import {
  listOrders, orderViewCounts, setOrdersStatus, exportOrdersCsv,
  ORDER_VIEWS, NEXT_STEP, statusLabel, fmtMoney, fmtDateTime, type AdminOrder, type OrderViewKey,
} from '@/lib/admin';
import { PageHeader, Card, StatusBadge, EmptyState, SkeletonRows, Pagination, SearchInput } from '@/components/admin/ui';
import { useFeedback } from '@/components/admin/Feedback';

const PAGE_SIZE = 25;

export default function OrdersPage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { toast, confirm } = useFeedback();

  // Filters live in the URL, so refresh / back / bookmarks / shared links keep them
  const view = (params.get('view') as OrderViewKey) || 'to_fulfil';
  const q = params.get('q') || '';
  const page = Math.max(1, Number(params.get('page')) || 1);

  const [search, setSearch] = useState(q);
  const [reloadKey, setReloadKey] = useState(0);
  // Results are tagged with the filters they were fetched for, so a change of tab/search/page shows the loader
  const queryKey = `${view}|${q}|${page}|${reloadKey}`;
  const [result, setResult] = useState<{ key: string; orders: AdminOrder[]; total: number; error: string } | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [selection, setSelection] = useState<{ key: string; ids: Set<string> }>({ key: '', ids: new Set() });
  const [busy, setBusy] = useState(false);

  const orders = result?.key === queryKey ? result.orders : null;
  const total = result?.total ?? 0;
  const error = result?.key === queryKey ? result.error : '';
  // Selection resets whenever the list changes
  const selected = useMemo(() => (selection.key === queryKey ? selection.ids : new Set<string>()), [selection, queryKey]);
  const setSelected = (ids: Set<string> | ((s: Set<string>) => Set<string>)) =>
    setSelection({ key: queryKey, ids: typeof ids === 'function' ? ids(selected) : ids });

  const setParams = useCallback((next: Record<string, string | null>) => {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) { if (v) sp.set(k, v); else sp.delete(k); }
    router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
  }, [params, pathname, router]);

  // Debounce typing into the search box
  useEffect(() => {
    if (search === q) return;
    const t = setTimeout(() => setParams({ q: search.trim() || null, page: null }), 350);
    return () => clearTimeout(t);
  }, [search, q, setParams]);

  useEffect(() => {
    let cancelled = false;
    db.init()
      .then(() => Promise.all([listOrders({ view, q, page, pageSize: PAGE_SIZE }), orderViewCounts()]))
      .then(([res, c]) => {
        if (cancelled) return;
        setResult({ key: queryKey, orders: res.orders, total: res.total, error: '' });
        setCounts(c);
      })
      .catch(e => {
        if (!cancelled) setResult({ key: queryKey, orders: [], total: 0, error: e instanceof Error ? e.message : 'Could not load orders.' });
      });
    return () => { cancelled = true; };
  }, [view, q, page, queryKey]);

  const load = () => setReloadKey(k => k + 1);

  const allSelected = !!orders?.length && orders.every(o => selected.has(o.id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(orders?.map(o => o.id)));
  const toggle = (id: string) => setSelected(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  // Bulk actions offered depend on what's selected
  const selectedOrders = useMemo(() => (orders || []).filter(o => selected.has(o.id)), [orders, selected]);
  // One-click next step when every selected order is at the same stage (e.g. all Processing → "Mark as shipped")
  const commonStatus = selectedOrders.length && selectedOrders.every(o => o.status === selectedOrders[0].status) ? selectedOrders[0].status : null;
  const nextStep = commonStatus ? NEXT_STEP[commonStatus] : undefined;

  const bulkUpdate = async (status: string, label: string) => {
    const ok = await confirm({
      title: `${label} ${selectedOrders.length} order(s)?`,
      message: ['Shipped', 'Delivered', 'Processing'].includes(status) ? 'Customers see the new status in their account (and get an email once order emails are set up).' : undefined,
      confirmLabel: label,
      danger: status === 'Cancelled',
    });
    if (!ok) return;
    setBusy(true);
    const { done, failed } = await setOrdersStatus(selectedOrders.map(o => o.id), status);
    setBusy(false);
    toast(failed ? `Updated ${done}, ${failed} failed — please retry those.` : `Updated ${done} order(s).`, failed ? 'error' : 'success');
    load();
  };

  const exportCsv = async () => {
    setBusy(true);
    try {
      const csv = await exportOrdersCsv({ view, q });
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `stressd-orders-${view}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Export failed.', 'error');
    }
    setBusy(false);
  };

  const open = (id: string) => router.push(`/admin/orders/${encodeURIComponent(id)}`);
  const currentView = ORDER_VIEWS.find(v => v.key === view);

  return (
    <>
      <PageHeader
        title="Orders"
        subtitle="Pack, ship and track customer orders."
        actions={<button type="button" className="adm-btn" onClick={exportCsv} disabled={busy}>Export CSV</button>}
      />

      <nav className="adm-tabs" aria-label="Order status">
        {ORDER_VIEWS.map(v => (
          <button key={v.key} type="button" className={`adm-tab${v.key === view ? ' active' : ''}`} aria-current={v.key === view ? 'page' : undefined}
            onClick={() => setParams({ view: v.key, page: null })}>
            {v.label}
            {counts[v.key] !== undefined && <span className="adm-tab-count">{counts[v.key]}</span>}
          </button>
        ))}
      </nav>

      <Card>
        <div className="adm-toolbar">
          <SearchInput value={search} onChange={setSearch} placeholder="Search order ID, name, email or phone" />
        </div>

        {selected.size > 0 && (
          <div className="adm-bulkbar" role="region" aria-label="Bulk actions">
            <strong>{selected.size} selected</strong>
            {nextStep && (
              <button type="button" className="adm-btn adm-btn-sm" disabled={busy} onClick={() => bulkUpdate(nextStep.status, nextStep.label)}>{nextStep.label}</button>
            )}
            <select
              className="adm-btn adm-btn-sm"
              value=""
              disabled={busy}
              aria-label="Set status of selected orders"
              onChange={e => e.target.value && bulkUpdate(e.target.value, `Set to ${statusLabel(e.target.value)}`)}
            >
              <option value="" style={{ color: '#111' }}>Set status…</option>
              {['Processing', 'Shipped', 'Delivered', 'Cancelled'].map(s => <option key={s} value={s} style={{ color: '#111' }}>{statusLabel(s)}</option>)}
            </select>
            <button type="button" className="adm-btn adm-btn-sm" onClick={() => setSelected(new Set())}>Clear</button>
          </div>
        )}

        {error && <p role="alert" className="adm-callout">{error}</p>}

        {orders === null ? <SkeletonRows /> : orders.length === 0 ? (
          <EmptyState title={q ? `No orders match “${q}”` : `No orders in “${currentView?.label}”`}>
            {view === 'to_fulfil' && !q ? 'You’re all caught up.' : 'Try another tab or search.'}
          </EmptyState>
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th className="check"><input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all orders on this page" /></th>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Items</th>
                  <th>Status</th>
                  <th className="num">Paid</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o.id} className={selected.has(o.id) ? 'selected' : ''} tabIndex={0} onClick={() => open(o.id)}
                    onKeyDown={e => { if (e.key === 'Enter') open(o.id); }}>
                    <td className="check" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(o.id)} onChange={() => toggle(o.id)} aria-label={`Select order ${o.id}`} />
                    </td>
                    <td className="adm-td-main">
                      <span className="adm-mono">{o.id}</span>
                      <div className="adm-muted adm-small">{fmtDateTime(o.date)}</div>
                    </td>
                    <td data-label="Customer">
                      <div>{o.customer.name}</div>
                      <div className="adm-muted adm-small adm-td-hide-sm">{o.customer.phone}</div>
                    </td>
                    <td data-label="Items">{o.items.reduce((s, i) => s + i.quantity, 0)}</td>
                    <td data-label="Status"><StatusBadge status={o.status} /></td>
                    <td data-label="Paid" className="num">{fmtMoney(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPage={p => setParams({ page: p > 1 ? String(p) : null })} />
      </Card>
    </>
  );
}
