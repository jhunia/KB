'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { listCustomers, fmtMoney, fmtDate, whatsappNumber, type AdminCustomer } from '@/lib/admin';
import { PageHeader, Card, Badge, EmptyState, SkeletonRows, SearchInput, Pagination } from '@/components/admin/ui';
import { useFeedback } from '@/components/admin/Feedback';

const PAGE_SIZE = 30;

export default function CustomersPage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { toast } = useFeedback();

  const q = params.get('q') || '';
  const type = params.get('type') || '';
  const sort = params.get('sort') || 'spend';
  const page = Math.max(1, Number(params.get('page')) || 1);

  const [search, setSearch] = useState(q);
  const [customers, setCustomers] = useState<AdminCustomer[] | null>(null);

  const setParams = useCallback((next: Record<string, string | null>) => {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) { if (v) sp.set(k, v); else sp.delete(k); }
    router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
  }, [params, pathname, router]);

  useEffect(() => {
    if (search === q) return;
    const t = setTimeout(() => setParams({ q: search.trim() || null, page: null }), 250);
    return () => clearTimeout(t);
  }, [search, q, setParams]);

  useEffect(() => {
    listCustomers().then(setCustomers).catch(e => { toast(e instanceof Error ? e.message : 'Could not load customers.', 'error'); setCustomers([]); });
  }, [toast]);

  const visible = useMemo(() => {
    if (!customers) return null;
    const term = q.toLowerCase().replace(/\s/g, '');
    const list = customers.filter(c =>
      (!term || c.name.toLowerCase().replace(/\s/g, '').includes(term) || c.email.toLowerCase().includes(term) || c.phone.replace(/\s/g, '').includes(term)) &&
      (!type || (type === 'registered' ? c.registered : !c.registered)));
    const sorters: Record<string, (a: AdminCustomer, b: AdminCustomer) => number> = {
      spend: (a, b) => b.spend - a.spend,
      orders: (a, b) => b.orders - a.orders,
      recent: (a, b) => (b.lastOrder || b.joined || '').localeCompare(a.lastOrder || a.joined || ''),
      name: (a, b) => a.name.localeCompare(b.name),
    };
    return list.sort(sorters[sort] || sorters.spend);
  }, [customers, q, type, sort]);

  const pageItems = visible?.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) || [];

  const exportCsv = () => {
    if (!visible) return;
    const esc = (v: unknown) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const rows = [['Name', 'Email', 'Phone', 'Type', 'Orders', 'Paid spend', 'Last order', 'Joined'],
      ...visible.map(c => [c.name, c.email, c.phone, c.registered ? 'Registered' : 'Guest', c.orders, c.spend.toFixed(2), c.lastOrder ? fmtDate(c.lastOrder) : '', c.joined ? fmtDate(c.joined) : ''])];
    const url = URL.createObjectURL(new Blob([rows.map(r => r.map(esc).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = `kbent-customers-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const openOrders = (c: AdminCustomer) => router.push(`/admin/orders?view=all&q=${encodeURIComponent(c.email)}`);

  return (
    <>
      <PageHeader
        title="Customers"
        subtitle={customers ? `${customers.filter(c => c.registered).length} registered · ${customers.filter(c => !c.registered).length} guest shoppers` : ' '}
        actions={<button type="button" className="adm-btn" onClick={exportCsv} disabled={!visible?.length}>Export CSV</button>}
      />
      <Card>
        <div className="adm-toolbar">
          <SearchInput value={search} onChange={setSearch} placeholder="Search name, email or phone" />
          <select className="adm-select" style={{ width: 'auto' }} value={type} onChange={e => setParams({ type: e.target.value || null, page: null })} aria-label="Customer type">
            <option value="">Everyone</option>
            <option value="registered">Registered</option>
            <option value="guest">Guests</option>
          </select>
          <select className="adm-select" style={{ width: 'auto' }} value={sort} onChange={e => setParams({ sort: e.target.value === 'spend' ? null : e.target.value })} aria-label="Sort">
            <option value="spend">Top spenders</option>
            <option value="orders">Most orders</option>
            <option value="recent">Most recent</option>
            <option value="name">Name A–Z</option>
          </select>
        </div>

        {visible === null ? <SkeletonRows /> : visible.length === 0 ? (
          <EmptyState title={q ? `No customers match “${q}”` : 'No customers yet'} />
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr><th>Customer</th><th className="num">Orders</th><th className="num">Spent</th><th>Last order</th><th><span className="sr-only">Contact</span></th></tr>
              </thead>
              <tbody>
                {pageItems.map(c => (
                  <tr key={c.key} tabIndex={0} onClick={() => openOrders(c)} onKeyDown={e => e.key === 'Enter' && openOrders(c)} title="See this customer's orders">
                    <td className="adm-td-main" style={{ maxWidth: 300 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <strong>{c.name}</strong>
                        {c.registered ? <Badge tone="blue">Registered</Badge> : <Badge>Guest</Badge>}
                      </div>
                      <div className="adm-muted adm-small" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.email}>{c.email}</div>
                      {c.phone && <div className="adm-muted adm-small">{c.phone}</div>}
                    </td>
                    <td data-label="Orders" className="num">{c.orders}</td>
                    <td data-label="Spent" className="num">{fmtMoney(c.spend)}</td>
                    <td data-label="Last order" style={{ whiteSpace: 'nowrap' }}>{c.lastOrder ? fmtDate(c.lastOrder) : '—'}</td>
                    <td data-label="" onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        {c.phone && <a className="adm-btn adm-btn-sm" href={`https://wa.me/${whatsappNumber(c.phone)}`} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp ${c.name}`}>WhatsApp</a>}
                        <a className="adm-btn adm-btn-sm" href={`mailto:${c.email}`} aria-label={`Email ${c.name}`}>Email</a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {visible && <Pagination page={page} pageSize={PAGE_SIZE} total={visible.length} onPage={p => setParams({ page: p > 1 ? String(p) : null })} />}
      </Card>
    </>
  );
}
