'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { db } from '@/lib/db';
import { dashboardData, fmtMoney, fmtDateTime } from '@/lib/admin';
import { Card, PageHeader, StatCard, StatusBadge, EmptyState, SkeletonRows } from '@/components/admin/ui';
import { useFeedback } from '@/components/admin/Feedback';

type Data = Awaited<ReturnType<typeof dashboardData>>;

export default function AdminDashboard() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [outOfStock, setOutOfStock] = useState(0);
  const [embedded, setEmbedded] = useState(0);
  const [migrating, setMigrating] = useState(false);
  const router = useRouter();
  const { toast } = useFeedback();

  const [reloadKey, setReloadKey] = useState(0);
  const load = () => setReloadKey(k => k + 1);

  useEffect(() => {
    let cancelled = false;
    db.init()
      .then(() => dashboardData(30))
      .then(d => {
        if (cancelled) return;
        setData(d);
        setError('');
        setOutOfStock(db.getProducts().filter(p => p.inStock === false).length);
        setEmbedded(db.getProductsWithEmbeddedImages().length);
      })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load the dashboard.'); });
    return () => { cancelled = true; };
  }, [reloadKey]);

  const migrate = async () => {
    setMigrating(true);
    const { migrated, failed } = await db.migrateEmbeddedImages();
    setMigrating(false);
    setEmbedded(db.getProductsWithEmbeddedImages().length);
    if (failed.length) toast(`Moved ${migrated}, ${failed.length} failed: ${failed[0].message}. If the bucket is missing, run app/supabase_storage_patch.sql.`, 'error');
    else toast(`Moved images for ${migrated} product(s) — the store will load faster now.`);
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const maxDay = data ? Math.max(...data.series.map(s => s.total), 1) : 1;

  return (
    <>
      <PageHeader title={greeting} subtitle="Here's what's happening in your store over the last 30 days." />

      {embedded > 0 && (
        <div className="adm-callout">
          <div>
            <strong>{embedded} product(s) have images stored inside the database.</strong>
            <div className="adm-muted adm-small">This slows down every page of the store. Moving them to image storage takes a moment and changes nothing visually.</div>
          </div>
          <button type="button" className="adm-btn adm-btn-primary" onClick={migrate} disabled={migrating}>{migrating ? 'Moving…' : 'Move images to storage'}</button>
        </div>
      )}

      {error && <div className="adm-callout" role="alert"><span>{error}</span><button className="adm-btn" onClick={load}>Retry</button></div>}

      <div className="adm-grid adm-grid-4" style={{ marginBottom: 16 }}>
        <StatCard label="Revenue (30 days)" value={data ? fmtMoney(data.revenue) : '—'} hint={data ? `${data.paidOrders} paid orders · avg ${fmtMoney(data.avgOrder)}` : ' '} />
        <StatCard label="Orders to fulfil" value={data?.counts.to_fulfil ?? '—'} hint="Paid, waiting to be packed or shipped" href="/admin/orders?view=to_fulfil" tone={data?.counts.to_fulfil ? 'amber' : undefined} />
        <StatCard label="Cancellation requests" value={data?.counts.cancel_requests ?? '—'} hint="Customers waiting on you" href="/admin/orders?view=cancel_requests" tone={data?.counts.cancel_requests ? 'red' : undefined} />
        <StatCard label="Out of stock" value={data ? outOfStock : '—'} hint="Products hidden from sale" href="/admin/products?stock=out" />
      </div>

      <div className="adm-grid adm-grid-main">
        <div className="adm-stack">
          <Card title="Sales — last 30 days" actions={<span className="adm-muted adm-small">Paid orders</span>}>
            {!data ? <SkeletonRows rows={3} /> : (
              <>
                <div className="adm-chart" role="img" aria-label={`Daily sales for the last 30 days, total ${fmtMoney(data.revenue)}`}>
                  {data.series.map(s => (
                    <div
                      key={s.day.toISOString()}
                      className={`adm-chart-bar${s.total ? '' : ' zero'}`}
                      style={{ height: `${Math.max((s.total / maxDay) * 100, 1.5)}%` }}
                      title={`${s.day.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}: ${fmtMoney(s.total)}`}
                    />
                  ))}
                </div>
                <div className="adm-chart-axis">
                  <span>{data.series[0].day.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                  <span>Today</span>
                </div>
              </>
            )}
          </Card>

          <Card title="Latest orders" actions={<Link href="/admin/orders?view=all" className="adm-link adm-small">View all</Link>}>
            {!data ? <SkeletonRows rows={4} /> : data.latest.length === 0 ? (
              <EmptyState title="No orders yet">Orders will appear here as soon as customers check out.</EmptyState>
            ) : (
              <div className="adm-table-wrap">
                <table className="adm-table">
                  <thead><tr><th>Order</th><th>Customer</th><th>Status</th><th className="num">Total</th></tr></thead>
                  <tbody>
                    {data.latest.map(o => (
                      <tr key={o.id} tabIndex={0} onClick={() => router.push(`/admin/orders/${encodeURIComponent(o.id)}`)}
                        onKeyDown={e => e.key === 'Enter' && router.push(`/admin/orders/${encodeURIComponent(o.id)}`)}>
                        <td className="adm-td-main"><span className="adm-mono">{o.id}</span><div className="adm-muted adm-small">{fmtDateTime(o.date)}</div></td>
                        <td data-label="Customer">{o.customer.name}</td>
                        <td data-label="Status"><StatusBadge status={o.status} /></td>
                        <td data-label="Total" className="num">{fmtMoney(o.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div className="adm-stack">
          <Card title="Needs attention">
            {!data ? <SkeletonRows rows={3} /> : (
              <ul className="adm-line-items">
                <li><span style={{ flex: 1 }}>Orders to pack &amp; ship</span><Link className="adm-link" href="/admin/orders?view=to_fulfil">{data.counts.to_fulfil}</Link></li>
                <li><span style={{ flex: 1 }}>Cancellation requests</span><Link className="adm-link" href="/admin/orders?view=cancel_requests">{data.counts.cancel_requests}</Link></li>
                <li><span style={{ flex: 1 }}>Shipped, not yet delivered</span><Link className="adm-link" href="/admin/orders?view=shipped">{data.counts.shipped}</Link></li>
                <li><span style={{ flex: 1 }}>Checkouts awaiting payment</span><Link className="adm-link" href="/admin/orders?view=awaiting_payment">{data.counts.awaiting_payment}</Link></li>
                <li><span style={{ flex: 1 }}>Products out of stock</span><Link className="adm-link" href="/admin/products?stock=out">{outOfStock}</Link></li>
              </ul>
            )}
          </Card>

          <Card title="Best sellers (30 days)">
            {!data ? <SkeletonRows rows={3} /> : data.topProducts.length === 0 ? (
              <p className="adm-muted">No paid sales in the last 30 days yet.</p>
            ) : (
              <ul className="adm-line-items">
                {data.topProducts.map(t => (
                  <li key={t.id}>
                    {t.product?.images[0] && <Image src={t.product.images[0]} alt="" width={88} height={88} className="adm-thumb" />}
                    <Link href={`/admin/products/${t.id}`} className="adm-link" style={{ flex: 1, minWidth: 0 }}>{t.product?.name || `Product #${t.id}`}</Link>
                    <span className="adm-muted">{t.qty} sold</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
