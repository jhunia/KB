'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/db';
import type { Order, Product } from '@/lib/types';
import Image from 'next/image';
import { colorName } from '@/lib/colors';

type Tab = 'dashboard' | 'orders' | 'products' | 'customers';

const AVAILABLE_COLORS = [
  { name: 'Black', hex: '#000000' }, { name: 'White', hex: '#f5f5f5' },
  { name: 'Grey', hex: '#808080' }, { name: 'Navy Blue', hex: '#000080' },
  { name: 'Red', hex: '#FF0000' }, { name: 'Burgundy', hex: '#800020' },
  { name: 'Blue', hex: '#0000FF' }, { name: 'Light Blue', hex: '#ADD8E6' },
  { name: 'Green', hex: '#008000' }, { name: 'Olive', hex: '#808000' },
  { name: 'Khaki', hex: '#F0E68C' }, { name: 'Beige', hex: '#F5F5DC' },
  { name: 'Brown', hex: '#A52A2A' }, { name: 'Tan', hex: '#D2B48C' },
  { name: 'Pink', hex: '#FFC0CB' }, { name: 'Purple', hex: '#800080' },
  { name: 'Orange', hex: '#FFA500' }, { name: 'Yellow', hex: '#FFFF00' },
];
const ALL_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'One Size'];
const ALL_BRANDS = ['Adidas', 'Nike', 'Gucci', 'Zara', 'H&M', 'Puma', 'Lacoste', 'Calvin Klein', 'Other'];

/* ─────────────── helpers ─────────────── */
function statusBadge(status: string) {
  const map: Record<string, { bg: string; color: string }> = {
    pending_payment: { bg: '#FEF3C7', color: '#92400E' },
    paid: { bg: '#D1FAE5', color: '#065F46' },
    Processing: { bg: '#DBEAFE', color: '#1E40AF' },
    Shipped: { bg: '#EDE9FE', color: '#5B21B6' },
    Delivered: { bg: '#D1FAE5', color: '#065F46' },
    Cancelled: { bg: '#FEE2E2', color: '#991B1B' },
    'Cancellation Requested': { bg: '#FEF3C7', color: '#92400E' },
    payment_failed: { bg: '#FEE2E2', color: '#991B1B' },
  };
  const s = map[status] || { bg: '#F3F4F6', color: '#374151' };
  return (
    <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>
      {status}
    </span>
  );
}

function fmt(n: number) { return `GH₵${n.toFixed(2)}`; }
function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/* ─────────────── MODALS ─────────────── */
function Modal({ open, onClose, title, children, width = 600 }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; width?: number }) {
  if (!open) return null;
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--white)', borderRadius: 20, width: '100%', maxWidth: width, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--gray-100)' }}>
          <h3 style={{ fontWeight: 700, fontSize: 18 }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--gray-600)' }}>✕</button>
        </div>
        <div style={{ padding: 24 }}>{children}</div>
      </div>
    </div>
  );
}

/* ─────────────── MAIN PAGE ─────────────── */
export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [promoActive, setPromoActive] = useState(false);
  const [promoToggling, setPromoToggling] = useState(false);

  // Filters
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatus, setOrderStatus] = useState('all');
  const [productSearch, setProductSearch] = useState('');
  const [productCategory, setProductCategory] = useState('');

  // Detail modals
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Record<string, unknown> | null>(null);

  // Product add/edit modal
  const [productModal, setProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [prodImages, setProdImages] = useState<string[]>([]);
  const [selColors, setSelColors] = useState<string[]>([]);
  const [selSizes, setSelSizes] = useState<string[]>([]);
  const [prodSaving, setProdSaving] = useState(false);
  const [imgUploading, setImgUploading] = useState(0);
  const [embeddedCount, setEmbeddedCount] = useState(0);
  const [migrating, setMigrating] = useState(false);
  const [prodForm, setProdForm] = useState({
    name: '', price: '', originalPrice: '', discount: '',
    category: 'tshirts', brand: 'Adidas', brandOther: '',
    gender: 'Uni-sex', style: 'casual', description: '', tag: 'new',
  });
  const [stockUpdating, setStockUpdating] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const refresh = useCallback(async () => {
    const [o, c] = await Promise.all([db.getOrders(), db.getCustomers()]);
    setOrders(o);
    setProducts(db.getProducts());
    setCustomers(c);
    setEmbeddedCount(db.getProductsWithEmbeddedImages().length);
  }, []);

  useEffect(() => {
    (async () => {
      await db.init();
      // Re-validate role live from DB — never trust the cached value for admin access.
      // proxy.ts already blocks at the server, but this handles mid-session role changes.
      const { getClient } = await import('@/lib/supabase/client');
      const supabase = getClient();
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) { router.push('/auth'); return; }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', authUser.id).single();
      if (!profile || profile.role !== 'admin') { router.push('/'); return; }
      await refresh();
      const active = await db.getSiteSetting('promo_banner_active', false);
      setPromoActive(active === true);
      setLoading(false);
    })();
  }, [router, refresh]);

  /* ── filtered lists ── */
  const filteredOrders = orders.filter(o => {
    const q = orderSearch.toLowerCase();
    const matchSearch = !q || (o.customer?.name || '').toLowerCase().includes(q) || (o.customer?.email || '').toLowerCase().includes(q) || o.id.includes(q);
    const matchStatus = orderStatus === 'all' || o.status === orderStatus;
    return matchSearch && matchStatus;
  });

  const filteredProducts = products.filter(p => {
    const q = productSearch.toLowerCase();
    return (!q || p.name.toLowerCase().includes(q)) && (!productCategory || p.category === productCategory);
  });

  /* ── order actions ── */
  const handleStatusChange = async (orderId: string, status: string) => {
    await db.updateOrderStatus(orderId, status);
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
    if (selectedOrder?.id === orderId) setSelectedOrder(prev => prev ? { ...prev, status } : null);
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (!confirm('Delete this order? This cannot be undone.')) return;
    const ok = await db.deleteOrder(orderId);
    if (ok) { setOrders(prev => prev.filter(o => o.id !== orderId)); setSelectedOrder(null); }
  };

  const handleApproveCancellation = async (orderId: string) => {
    if (!confirm('Approve cancellation and mark as Cancelled?')) return;
    await handleStatusChange(orderId, 'Cancelled');
  };

  /* ── product actions ── */
  const handleToggleStock = async (productId: number) => {
    setStockUpdating(productId);
    const p = db.getProductById(productId);
    if (p) await db.updateProduct(productId, { inStock: !p.inStock });
    setProducts(db.getProducts());
    if (selectedProduct?.id === productId) setSelectedProduct(db.getProductById(productId) || null);
    setStockUpdating(null);
  };

  const handleDeleteProduct = async (productId: number) => {
    if (!confirm('Delete this product permanently?')) return;
    await db.deleteProduct(productId);
    setProducts(prev => prev.filter(p => p.id !== productId));
    setSelectedProduct(null);
  };

  /* ── product add/edit modal ── */
  const openAddModal = () => {
    setEditingProduct(null);
    setProdImages([]);
    setSelColors([]);
    setSelSizes([]);
    setProdForm({ name: '', price: '', originalPrice: '', discount: '', category: 'tshirts', brand: 'Adidas', brandOther: '', gender: 'Uni-sex', style: 'casual', description: '', tag: 'new' });
    setProductModal(true);
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setProdImages([...p.images]);
    setSelColors([...p.colors]);
    setSelSizes([...p.sizes]);
    setProdForm({
      name: p.name, price: String(p.price),
      originalPrice: p.originalPrice ? String(p.originalPrice) : '',
      discount: p.discount ? String(p.discount) : '',
      category: p.category || 'tshirts', brand: p.brand || 'Adidas', brandOther: '',
      gender: p.gender || 'Uni-sex', style: p.style || 'casual',
      description: p.description || '', tag: p.tag || 'new',
    });
    setSelectedProduct(null);
    setProductModal(true);
  };

  // Images are compressed and uploaded to Supabase Storage straight away; only the URL is kept on the product.
  const handleImageFiles = async (files: FileList | null) => {
    if (!files) return;
    const images = Array.from(files).filter(file => file.type.startsWith('image/'));
    if (!images.length) return;
    setImgUploading(n => n + images.length);
    await Promise.all(images.map(async file => {
      try {
        const url = await db.uploadProductImage(file);
        setProdImages(prev => [...prev, url]);
      } catch (err) {
        alert(`Could not upload "${file.name}": ${err instanceof Error ? err.message : err}\n\nIf this says the bucket was not found, run app/supabase_storage_patch.sql in the Supabase SQL editor.`);
      } finally {
        setImgUploading(n => n - 1);
      }
    }));
  };

  const handleMigrateImages = async () => {
    setMigrating(true);
    const { migrated, failed } = await db.migrateEmbeddedImages();
    setProducts([...db.getProducts()]);
    setEmbeddedCount(db.getProductsWithEmbeddedImages().length);
    setMigrating(false);
    if (failed.length) {
      alert(`Moved ${migrated} product(s). ${failed.length} failed:\n` + failed.map(f => `#${f.id}: ${f.message}`).join('\n') +
        '\n\nIf this says the bucket was not found, run app/supabase_storage_patch.sql in the Supabase SQL editor.');
    }
  };

  const handleProdSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selColors.length === 0) { alert('Select at least one color.'); return; }
    if (selSizes.length === 0) { alert('Select at least one size.'); return; }
    if (prodImages.length === 0) { alert('Add at least one image.'); return; }

    const price = parseFloat(prodForm.price);
    if (!Number.isFinite(price) || price <= 0) { alert('Enter a selling price greater than 0.'); return; }
    const originalPrice = prodForm.originalPrice ? parseFloat(prodForm.originalPrice) : null;
    // Only keep a "was" price if it's actually higher than the selling price
    const hasMarkdown = originalPrice !== null && Number.isFinite(originalPrice) && originalPrice > price;
    const discount = prodForm.discount ? parseInt(prodForm.discount) : null;

    setProdSaving(true);
    const brand = prodForm.brand === 'Other' ? prodForm.brandOther : prodForm.brand;
    const data = {
      name: prodForm.name, price,
      originalPrice: hasMarkdown ? originalPrice : null,
      discount: hasMarkdown ? (discount && discount > 0 && discount < 100 ? discount : Math.round((1 - price / originalPrice!) * 100)) : null,
      category: prodForm.category, brand, gender: prodForm.gender,
      style: prodForm.style, sizes: selSizes, colors: selColors,
      // Keep existing per-colour stock when editing; new colours start in stock
      colorStock: Object.fromEntries(selColors.map(c => [c, editingProduct?.colorStock?.[c] ?? true])),
      images: prodImages, description: prodForm.description,
      inStock: editingProduct ? editingProduct.inStock !== false : true,
      tag: prodForm.tag,
    };

    if (editingProduct) {
      await db.updateProduct(editingProduct.id, data);
    } else {
      await db.addProduct(data);
    }
    await refresh();
    setProdSaving(false);
    setProductModal(false);
  };

  /* auto-calc discounted price */
  const calcPrice = (orig: string, disc: string) => {
    const o = parseFloat(orig), d = parseFloat(disc);
    if (o && d && d > 0 && d <= 100) setProdForm(f => ({ ...f, price: String(Math.round(o * (1 - d / 100) * 100) / 100) }));
  };

  /* ── KPIs ── */
  const revenue = orders.filter(o => o.status === 'Delivered').reduce((s, o) => s + o.total, 0);
  const pendingRev = orders.filter(o => ['paid', 'Processing', 'Shipped'].includes(o.status)).reduce((s, o) => s + o.total, 0);
  const activeOrders = orders.filter(o => ['paid', 'Processing', 'Shipped', 'pending_payment'].includes(o.status)).length;

  /* ── Chart ── */
  const chartData = (() => {
    const days: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      days.push(d.toLocaleDateString('en-US', { weekday: 'short' }));
    }
    const totals = days.map((_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i));
      const ds = d.toDateString();
      return orders.filter(o => ['Delivered', 'paid'].includes(o.status) && new Date(o.date).toDateString() === ds).reduce((s, o) => s + o.total, 0);
    });
    return { days, totals, max: Math.max(...totals, 1) };
  })();

  if (loading) return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--gray-600)' }}>Loading admin panel…</p>
    </main>
  );

  /* ── Styles ── */
  const card = { background: 'var(--white)', border: '1px solid var(--gray-200)', borderRadius: 16, boxShadow: '0 1px 4px rgba(0,0,0,.06)' };
  const th = { textAlign: 'left' as const, padding: '10px 14px', fontSize: 12, fontWeight: 700, color: 'var(--gray-600)', borderBottom: '2px solid var(--gray-100)', whiteSpace: 'nowrap' as const };
  const td = { padding: '12px 14px', borderBottom: '1px solid var(--gray-50)', fontSize: 14, verticalAlign: 'middle' as const };
  const rowHover = { cursor: 'pointer' };

  return (
    <main style={{ background: '#F8F9FB', minHeight: '100vh', paddingBottom: 60 }}>
      {/* Responsive overrides for admin panel */}
      <style>{`
        .admin-topbar { background: var(--white); border-bottom: 1px solid var(--gray-200); padding: 14px 24px; display: flex; align-items: center; justify-content: space-between; }
        .admin-wrap { max-width: 1400px; margin: 0 auto; padding: 20px 16px 0; }
        .admin-tabs { display: flex; gap: 4; margin-bottom: 24px; background: var(--gray-100); padding: 4px; border-radius: 12px; width: 100%; overflow-x: auto; scrollbar-width: none; }
        .admin-tabs::-webkit-scrollbar { display: none; }
        .admin-tab-btn { padding: 9px 18px; border-radius: 8px; border: none; font-size: 14px; cursor: pointer; text-transform: capitalize; white-space: nowrap; flex-shrink: 0; }
        .admin-kpi-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 16px; margin-bottom: 28px; }
        .admin-orders-filters { display: flex; gap: 10px; flex-wrap: wrap; }
        .admin-orders-filters input, .admin-orders-filters select { width: 100%; max-width: 220px; }
        @media (max-width: 768px) {
          .admin-topbar { padding: 12px 16px; }
          .admin-wrap { padding: 16px 12px 0; }
          .admin-kpi-grid { grid-template-columns: repeat(2,1fr); gap: 12px; }
          .admin-orders-filters input, .admin-orders-filters select { max-width: 100%; }
          .admin-tab-btn { padding: 8px 14px; font-size: 13px; }
        }
        @media (max-width: 480px) {
          .admin-kpi-grid { grid-template-columns: 1fr 1fr; gap: 10px; }
          .admin-topbar span { font-size: 18px !important; }
        }
      `}</style>

      {/* Top Bar */}
      <div className="admin-topbar">
        <div>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 900 }}>KB.ENT Admin</span>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Link href="/" className="btn btn-outline btn-sm">← Store</Link>
        </div>
      </div>

      <div className="admin-wrap">
        {/* Tab Bar */}
        <div className="admin-tabs">
          {(['dashboard', 'orders', 'products', 'customers'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)} className="admin-tab-btn" style={{
              fontWeight: tab === t ? 700 : 400,
              background: tab === t ? 'var(--white)' : 'transparent',
              boxShadow: tab === t ? '0 1px 4px rgba(0,0,0,.1)' : 'none',
            }}>{t}</button>
          ))}
        </div>

        {/* ═══ DASHBOARD ═══ */}
        {tab === 'dashboard' && (
          <div>
            {/* One-time fix: move base64 images out of the products table */}
            {embeddedCount > 0 && (
              <div style={{ ...card, padding: 20, marginBottom: 28, borderColor: '#F59E0B', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 260px' }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{embeddedCount} product(s) have images stored inside the database</div>
                  <div style={{ fontSize: 12, color: 'var(--gray-600)', marginTop: 4 }}>
                    This makes every page on the store load slowly. Move them to image storage — it only takes a moment and nothing changes visually.
                  </div>
                </div>
                <button
                  onClick={handleMigrateImages}
                  disabled={migrating}
                  style={{ padding: '10px 20px', background: 'var(--black)', color: 'var(--white)', border: 'none', borderRadius: 8, fontWeight: 700, cursor: migrating ? 'wait' : 'pointer', opacity: migrating ? 0.7 : 1 }}
                >
                  {migrating ? 'Moving images…' : 'Move images to storage'}
                </button>
              </div>
            )}

            {/* KPI Cards */}
            <div className="admin-kpi-grid">
              {[
                { label: 'Confirmed Revenue', value: fmt(revenue), sub: `+${fmt(pendingRev)} pending`, subColor: '#F59E0B' },
                { label: 'Total Orders', value: orders.length, sub: `${activeOrders} active` },
                { label: 'Products', value: products.length },
                { label: 'Customers', value: customers.length },
              ].map((k, i) => (
                <div key={i} style={{ ...card, padding: 20 }}>
                  <div style={{ fontSize: 12, color: 'var(--gray-600)', marginBottom: 6 }}>{k.label}</div>
                  <div style={{ fontSize: 26, fontWeight: 800, fontFamily: 'var(--font-display)' }}>{k.value}</div>
                  {k.sub && <div style={{ fontSize: 12, marginTop: 4, color: k.subColor || 'var(--gray-600)' }}>{k.sub}</div>}
                </div>
              ))}
            </div>


            {/* Sales Chart */}
            <div style={{ ...card, padding: 24, marginBottom: 28 }}>
              <h3 style={{ fontWeight: 700, marginBottom: 20, fontSize: 16 }}>7-Day Sales (Delivered + Paid)</h3>
              <div style={{ display: 'flex', alignItems: 'flex-end', height: 160, gap: 8, marginBottom: 8 }}>
                {chartData.totals.map((val, i) => (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                    {val > 0 && <span style={{ fontSize: 10, color: 'var(--gray-600)', fontWeight: 600 }}>₵{Math.round(val)}</span>}
                    <div style={{ width: '100%', background: val > 0 ? 'var(--black)' : 'var(--gray-200)', borderRadius: '4px 4px 0 0', height: Math.max(val / chartData.max * 140, 4) }} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {chartData.days.map(d => <div key={d} style={{ flex: 1, textAlign: 'center', fontSize: 11, color: 'var(--gray-600)' }}>{d}</div>)}
              </div>
            </div>

            {/* Site Settings Card */}
            <div style={{ ...card, padding: 24, marginBottom: 28 }}>
              <h3 style={{ fontWeight: 700, fontSize: 16, marginBottom: 20 }}>Site Settings</h3>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>Promo Banner</div>
                  <div style={{ fontSize: 12, color: 'var(--gray-600)', marginTop: 2 }}>
                    Toggle the promotional banner on the homepage
                  </div>
                </div>
                <button
                  disabled={promoToggling}
                  onClick={async () => {
                    setPromoToggling(true);
                    const next = !promoActive;
                    const ok = await db.setSiteSetting('promo_banner_active', next);
                    if (ok) setPromoActive(next);
                    setPromoToggling(false);
                  }}
                  style={{
                    position: 'relative', width: 52, height: 28, borderRadius: 99,
                    border: 'none', cursor: promoToggling ? 'not-allowed' : 'pointer',
                    background: promoActive ? 'var(--black)' : 'var(--gray-300)',
                    transition: 'background 0.2s ease',
                    flexShrink: 0,
                    opacity: promoToggling ? 0.6 : 1,
                  }}
                  aria-label={promoActive ? 'Disable promo banner' : 'Enable promo banner'}
                >
                  <span style={{
                    position: 'absolute', top: 4, width: 20, height: 20, borderRadius: '50%',
                    background: 'white', transition: 'left 0.2s ease',
                    left: promoActive ? 28 : 4,
                    boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                  }} />
                </button>
              </div>
            </div>

            {/* Recent Orders */}
            <div style={{ ...card, padding: 24 }}>
              <h3 style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Recent Orders</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>{['Customer', 'Date', 'Total', 'Status'].map(h => <th key={h} style={th}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {orders.slice(0, 5).map(o => (
                      <tr key={o.id} style={rowHover} onClick={() => setSelectedOrder(o)}>
                        <td style={td}>{o.customer?.name}</td>
                        <td style={{ ...td, color: 'var(--gray-600)', fontSize: 12 }}>{fmtDate(o.date)}</td>
                        <td style={{ ...td, fontWeight: 700 }}>{fmt(o.total)}</td>
                        <td style={td}>{statusBadge(o.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ═══ ORDERS ═══ */}
        {tab === 'orders' && (
          <div style={{ ...card, padding: 24 }}>
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontWeight: 700, fontSize: 18 }}>All Orders ({filteredOrders.length})</h3>
              <div className="admin-orders-filters">
                <input value={orderSearch} onChange={e => setOrderSearch(e.target.value)} placeholder="Search name, email, ID…" style={{ padding: '8px 14px', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 14 }} />
                <select value={orderStatus} onChange={e => setOrderStatus(e.target.value)} style={{ padding: '8px 12px', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 14 }}>
                  <option value="all">All Statuses</option>
                  {['pending_payment', 'paid', 'Processing', 'Shipped', 'Delivered', 'Cancellation Requested', 'Cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>{['Customer', 'Items', 'Total', 'Status', 'Date'].map(h => <th key={h} style={th}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {filteredOrders.length === 0 ? (
                    <tr><td colSpan={5} style={{ ...td, textAlign: 'center', color: 'var(--gray-600)' }}>No orders found</td></tr>
                  ) : filteredOrders.map(o => (
                    <tr key={o.id} style={{ ...rowHover, background: 'transparent' }} onClick={() => setSelectedOrder(o)}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--gray-50)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={td}>
                        <div style={{ fontWeight: 600 }}>{o.customer?.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--gray-600)' }}>{o.customer?.email}</div>
                      </td>
                      <td style={td}>{o.items?.length || 0}</td>
                      <td style={{ ...td, fontWeight: 700 }}>{fmt(o.total)}</td>
                      <td style={td}>{statusBadge(o.status)}</td>
                      <td style={{ ...td, fontSize: 12, color: 'var(--gray-600)' }}>{fmtDate(o.date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══ PRODUCTS ═══ */}
        {tab === 'products' && (
          <div style={{ ...card, padding: 24 }}>
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontWeight: 700, fontSize: 18 }}>Products ({filteredProducts.length})</h3>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <input value={productSearch} onChange={e => setProductSearch(e.target.value)} placeholder="Search products…" style={{ padding: '8px 14px', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 14, width: 200 }} />
                <select value={productCategory} onChange={e => setProductCategory(e.target.value)} style={{ padding: '8px 12px', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 14 }}>
                  <option value="">All Categories</option>
                  {['tshirts', 'shirts', 'jeans', 'hoodies', 'jackets', 'suits', 'shoes', 'accessories'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <button onClick={openAddModal} style={{ padding: '8px 20px', background: 'var(--black)', color: 'var(--white)', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                  + Add Product
                </button>
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>{['Image', 'Name', 'Price', 'Category', 'Stock', 'Actions'].map(h => <th key={h} style={th}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {filteredProducts.length === 0 ? (
                    <tr><td colSpan={6} style={{ ...td, textAlign: 'center', color: 'var(--gray-600)' }}>No products found</td></tr>
                  ) : filteredProducts.map(p => (
                    <tr key={p.id} style={{ ...rowHover, background: 'transparent' }} onClick={() => setSelectedProduct(p)}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--gray-50)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={td}><Image src={p.images[0]} alt={p.name} width={96} height={96} style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 8 }} /></td>
                      <td style={{ ...td, fontWeight: 600, maxWidth: 200 }}>{p.name}</td>
                      <td style={{ ...td, fontWeight: 700 }}>
                        {fmt(p.price)}
                        {p.discount && <span style={{ marginLeft: 6, fontSize: 11, color: '#DC2626', fontWeight: 700 }}>-{p.discount}%</span>}
                      </td>
                      <td style={{ ...td, textTransform: 'capitalize' }}>{p.category}</td>
                      <td style={td}>
                        <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: p.inStock !== false ? '#D1FAE5' : '#FEE2E2', color: p.inStock !== false ? '#065F46' : '#991B1B' }}>
                          {p.inStock !== false ? 'In Stock' : 'Out of Stock'}
                        </span>
                      </td>
                      <td style={td} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => openEditModal(p)} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid var(--gray-300)', background: 'none', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>Edit</button>
                          <button onClick={() => handleToggleStock(p.id)} disabled={stockUpdating === p.id} style={{ padding: '5px 12px', borderRadius: 6, border: `1px solid ${p.inStock !== false ? '#FCA5A5' : '#6EE7B7'}`, color: p.inStock !== false ? '#DC2626' : '#059669', background: 'none', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                            {p.inStock !== false ? 'Out of Stock' : 'In Stock'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══ CUSTOMERS ═══ */}
        {tab === 'customers' && (
          <div style={{ ...card, padding: 24 }}>
            <h3 style={{ fontWeight: 700, fontSize: 18, marginBottom: 20 }}>Customers ({customers.length})</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>{['Name', 'Email', 'Phone', 'Orders', 'Total Spend'].map(h => <th key={h} style={th}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {customers.map((c, i) => (
                    <tr key={i} style={{ ...rowHover, background: 'transparent' }} onClick={() => setSelectedCustomer(c)}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--gray-50)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ ...td, fontWeight: 700 }}>{c.name as string}</td>
                      <td style={{ ...td, color: 'var(--gray-600)' }}>{c.email as string}</td>
                      <td style={{ ...td, color: 'var(--gray-600)' }}>{(c.phone as string) || '—'}</td>
                      <td style={td}>{c.orderCount as number}</td>
                      <td style={{ ...td, fontWeight: 700 }}>{fmt(c.totalSpend as number)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ═══════════ MODALS ═══════════ */}

      {/* Order Detail */}
      <Modal open={!!selectedOrder} onClose={() => setSelectedOrder(null)} title="Order Details" width={600}>
        {selectedOrder && (() => {
          const o = selectedOrder;
          return (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                <div><div style={{ fontSize: 11, color: 'var(--gray-600)', marginBottom: 4 }}>ORDER ID</div><div style={{ fontFamily: 'monospace', fontSize: 13 }}>{o.id}</div></div>
                <div><div style={{ fontSize: 11, color: 'var(--gray-600)', marginBottom: 4 }}>STATUS</div>{statusBadge(o.status)}</div>
                <div><div style={{ fontSize: 11, color: 'var(--gray-600)', marginBottom: 4 }}>CUSTOMER</div><div style={{ fontWeight: 700 }}>{o.customer?.name}</div></div>
                <div><div style={{ fontSize: 11, color: 'var(--gray-600)', marginBottom: 4 }}>DATE</div><div style={{ fontSize: 13 }}>{fmtDate(o.date)}</div></div>
                <div><div style={{ fontSize: 11, color: 'var(--gray-600)', marginBottom: 4 }}>EMAIL</div><div style={{ fontSize: 13 }}>{o.customer?.email}</div></div>
                <div><div style={{ fontSize: 11, color: 'var(--gray-600)', marginBottom: 4 }}>PHONE</div><div style={{ fontSize: 13 }}>{o.customer?.phone}</div></div>
                {o.customer?.address && <div style={{ gridColumn: '1/-1' }}><div style={{ fontSize: 11, color: 'var(--gray-600)', marginBottom: 4 }}>ADDRESS</div><div style={{ fontSize: 13 }}>{o.customer.address}</div></div>}
              </div>
              <div style={{ borderTop: '1px solid var(--gray-100)', paddingTop: 16, marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: 'var(--gray-600)', marginBottom: 12 }}>ITEMS ({o.items?.length || 0})</div>
                {(o.items || []).map((item, i) => {
                  const p = db.getProductById(item.productId);
                  return (
                    <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--gray-50)' }}>
                      {p?.images?.[0] && <Image src={p.images[0]} alt={p.name} width={112} height={112} style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8 }} />}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{p?.name || `Product #${item.productId}`}</div>
                        <div style={{ fontSize: 12, color: 'var(--gray-600)' }}>Size: {item.size} | Color: {colorName(item.color)} | Qty: {item.quantity}</div>
                      </div>
                      <div style={{ fontWeight: 700 }}>{p ? fmt(p.price * item.quantity) : '—'}</div>
                    </div>
                  );
                })}
              </div>
              <div style={{ background: 'var(--gray-50)', borderRadius: 8, padding: 16, marginBottom: 20 }}>
                {o.subtotal && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 14 }}><span>Subtotal</span><span>{fmt(o.subtotal)}</span></div>}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 14 }}><span>Delivery</span><span>{fmt(15)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 16, borderTop: '1px solid var(--gray-200)', paddingTop: 8, marginTop: 8 }}><span>Total</span><span>{fmt(o.total)}</span></div>
              </div>
              {/* Status Change */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-600)', display: 'block', marginBottom: 6 }}>UPDATE STATUS</label>
                <select value={o.status} onChange={e => handleStatusChange(o.id, e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 14 }}>
                  {['pending_payment', 'paid', 'Processing', 'Shipped', 'Delivered', 'Cancellation Requested', 'Cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                {o.status === 'Cancellation Requested' && (
                  <button onClick={() => handleApproveCancellation(o.id)} style={{ padding: '10px 20px', background: '#DC2626', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
                    Approve Cancellation
                  </button>
                )}
                <button onClick={() => handleDeleteOrder(o.id)} style={{ padding: '10px 20px', border: '1px solid #FCA5A5', color: '#DC2626', background: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
                  Delete Order
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Product Detail */}
      <Modal open={!!selectedProduct} onClose={() => setSelectedProduct(null)} title="Product Details" width={520}>
        {selectedProduct && (() => {
          const p = selectedProduct;
          return (
            <div>
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <Image src={p.images[0]} alt={p.name} width={360} height={360} style={{ width: 180, height: 180, objectFit: 'cover', borderRadius: 12 }} />
              </div>
              <div style={{ marginBottom: 16 }}><div style={{ fontSize: 11, color: 'var(--gray-600)', marginBottom: 4 }}>NAME</div><div style={{ fontWeight: 700, fontSize: 18 }}>{p.name}</div></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div><div style={{ fontSize: 11, color: 'var(--gray-600)', marginBottom: 4 }}>PRICE</div><div style={{ fontWeight: 700, fontSize: 18 }}>{fmt(p.price)} {p.discount && <span style={{ color: '#DC2626', fontSize: 13 }}>-{p.discount}%</span>}</div></div>
                <div><div style={{ fontSize: 11, color: 'var(--gray-600)', marginBottom: 4 }}>STOCK</div><span style={{ padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: p.inStock !== false ? '#D1FAE5' : '#FEE2E2', color: p.inStock !== false ? '#065F46' : '#991B1B' }}>{p.inStock !== false ? 'In Stock' : 'Out of Stock'}</span></div>
                <div><div style={{ fontSize: 11, color: 'var(--gray-600)', marginBottom: 4 }}>CATEGORY</div><div style={{ textTransform: 'capitalize' }}>{p.category}</div></div>
                <div><div style={{ fontSize: 11, color: 'var(--gray-600)', marginBottom: 4 }}>BRAND</div><div>{p.brand || '—'}</div></div>
              </div>
              <div style={{ marginBottom: 12 }}><div style={{ fontSize: 11, color: 'var(--gray-600)', marginBottom: 6 }}>COLORS</div><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{p.colors.map(c => <span key={c} title={c} style={{ width: 22, height: 22, borderRadius: '50%', background: c, border: '1px solid var(--gray-200)', display: 'inline-block' }} />)}</div></div>
              <div style={{ marginBottom: 16 }}><div style={{ fontSize: 11, color: 'var(--gray-600)', marginBottom: 4 }}>SIZES</div><div>{p.sizes.join(', ') || '—'}</div></div>
              {p.description && <div style={{ marginBottom: 16 }}><div style={{ fontSize: 11, color: 'var(--gray-600)', marginBottom: 4 }}>DESCRIPTION</div><div style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--gray-700)' }}>{p.description}</div></div>}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap', paddingTop: 16, borderTop: '1px solid var(--gray-100)' }}>
                <button onClick={() => handleToggleStock(p.id)} style={{ padding: '9px 18px', border: `1px solid ${p.inStock !== false ? '#FCA5A5' : '#6EE7B7'}`, color: p.inStock !== false ? '#DC2626' : '#059669', background: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
                  Mark {p.inStock !== false ? 'Out of Stock' : 'In Stock'}
                </button>
                <button onClick={() => handleDeleteProduct(p.id)} style={{ padding: '9px 18px', border: '1px solid #FCA5A5', color: '#DC2626', background: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Delete</button>
                <button onClick={() => openEditModal(p)} style={{ padding: '9px 18px', background: 'var(--black)', color: 'var(--white)', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Edit Product</button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Customer Detail */}
      <Modal open={!!selectedCustomer} onClose={() => setSelectedCustomer(null)} title="Customer Profile" width={480}>
        {selectedCustomer && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--black)', color: 'var(--white)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, fontWeight: 700, margin: '0 auto' }}>
                {(selectedCustomer.name as string).charAt(0).toUpperCase()}
              </div>
            </div>
            <div style={{ marginBottom: 16 }}><div style={{ fontSize: 11, color: 'var(--gray-600)', marginBottom: 4 }}>NAME</div><div style={{ fontWeight: 700, fontSize: 20 }}>{selectedCustomer.name as string}</div></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
              <div><div style={{ fontSize: 11, color: 'var(--gray-600)', marginBottom: 4 }}>EMAIL</div><div style={{ fontSize: 14 }}>{selectedCustomer.email as string}</div></div>
              <div><div style={{ fontSize: 11, color: 'var(--gray-600)', marginBottom: 4 }}>PHONE</div><div style={{ fontSize: 14 }}>{(selectedCustomer.phone as string) || '—'}</div></div>
              <div><div style={{ fontSize: 11, color: 'var(--gray-600)', marginBottom: 4 }}>TOTAL ORDERS</div><div style={{ fontWeight: 800, fontSize: 28 }}>{selectedCustomer.orderCount as number}</div></div>
              <div><div style={{ fontSize: 11, color: 'var(--gray-600)', marginBottom: 4 }}>TOTAL SPEND</div><div style={{ fontWeight: 800, fontSize: 28 }}>{fmt(selectedCustomer.totalSpend as number)}</div></div>
            </div>
          </div>
        )}
      </Modal>

      {/* ═══ ADD / EDIT PRODUCT MODAL ═══ */}
      <Modal open={productModal} onClose={() => setProductModal(false)} title={editingProduct ? 'Edit Product' : 'Add New Product'} width={680}>
        <form onSubmit={handleProdSubmit}>
          {/* Name */}
          <div className="form-group">
            <label>Product Name *</label>
            <input value={prodForm.name} onChange={e => setProdForm(f => ({ ...f, name: e.target.value }))} required placeholder="e.g. Slim Fit Blazer" />
          </div>

          {/* Price row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label>Original Price</label>
              <input type="number" step="0.01" value={prodForm.originalPrice} onChange={e => { setProdForm(f => ({ ...f, originalPrice: e.target.value })); calcPrice(e.target.value, prodForm.discount); }} placeholder="e.g. 200" />
            </div>
            <div className="form-group">
              <label>Discount %</label>
              <input type="number" min="0" max="100" value={prodForm.discount} onChange={e => { setProdForm(f => ({ ...f, discount: e.target.value })); calcPrice(prodForm.originalPrice, e.target.value); }} placeholder="e.g. 20" />
            </div>
            <div className="form-group">
              <label>Selling Price *</label>
              <input type="number" step="0.01" min="0.01" value={prodForm.price} onChange={e => setProdForm(f => ({ ...f, price: e.target.value }))} required placeholder="Auto or manual" />
            </div>
          </div>

          {/* Category / Gender / Style / Tag row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label>Category *</label>
              <select value={prodForm.category} onChange={e => setProdForm(f => ({ ...f, category: e.target.value }))}>
                {['tshirts', 'shirts', 'jeans', 'hoodies', 'jackets', 'suits', 'shoes', 'accessories'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Gender</label>
              <select value={prodForm.gender} onChange={e => setProdForm(f => ({ ...f, gender: e.target.value }))}>
                {['Uni-sex', 'Men', 'Women', 'Kids'].map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Style</label>
              <select value={prodForm.style} onChange={e => setProdForm(f => ({ ...f, style: e.target.value }))}>
                {['casual', 'formal', 'party', 'gym', 'streetwear'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Tag</label>
              <select value={prodForm.tag} onChange={e => setProdForm(f => ({ ...f, tag: e.target.value }))}>
                <option value="new">New Arrival</option>
                <option value="top">Top Selling</option>
                <option value="">None</option>
              </select>
            </div>
          </div>

          {/* Brand */}
          <div style={{ display: 'grid', gridTemplateColumns: prodForm.brand === 'Other' ? '1fr 1fr' : '1fr', gap: 12 }}>
            <div className="form-group">
              <label>Brand</label>
              <select value={prodForm.brand} onChange={e => setProdForm(f => ({ ...f, brand: e.target.value }))}>
                {ALL_BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            {prodForm.brand === 'Other' && (
              <div className="form-group">
                <label>Brand Name *</label>
                <input value={prodForm.brandOther} onChange={e => setProdForm(f => ({ ...f, brandOther: e.target.value }))} required placeholder="Enter brand name" />
              </div>
            )}
          </div>

          {/* Sizes */}
          <div className="form-group">
            <label>Sizes *</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
              {ALL_SIZES.map(s => (
                <button key={s} type="button" onClick={() => setSelSizes(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])}
                  style={{ padding: '6px 14px', borderRadius: 99, border: `1px solid ${selSizes.includes(s) ? 'var(--black)' : 'var(--gray-300)'}`, background: selSizes.includes(s) ? 'var(--black)' : 'transparent', color: selSizes.includes(s) ? 'white' : 'inherit', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Colors */}
          <div className="form-group">
            <label>Colors *</label>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
              {AVAILABLE_COLORS.map(c => (
                <label key={c.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 10, color: 'var(--gray-600)' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: c.hex, border: selColors.includes(c.name) ? '3px solid var(--black)' : '1px solid var(--gray-300)', outline: selColors.includes(c.name) ? '2px solid var(--black)' : 'none', outlineOffset: 2, boxSizing: 'border-box', cursor: 'pointer' }}
                    onClick={() => setSelColors(prev => prev.includes(c.name) ? prev.filter(x => x !== c.name) : [...prev, c.name])} />
                  {c.name}
                </label>
              ))}
            </div>
          </div>

          {/* Image Upload */}
          <div className="form-group">
            <label>Images *</label>
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--black)'; }}
              onDragLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--gray-300)'; }}
              onDrop={e => { e.preventDefault(); (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--gray-300)'; handleImageFiles(e.dataTransfer.files); }}
              style={{ border: '2px dashed var(--gray-300)', borderRadius: 12, padding: 24, textAlign: 'center', cursor: 'pointer', fontSize: 14, color: 'var(--gray-600)', marginTop: 8 }}
            >
              {imgUploading > 0 ? `Uploading ${imgUploading} image(s)…` : 'Click or drag & drop images here'}
            </div>
            <input ref={fileInputRef} type="file" multiple accept="image/*" style={{ display: 'none' }} onChange={e => handleImageFiles(e.target.files)} />
            {prodImages.length > 0 && (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
                {prodImages.map((src, i) => (
                  <div key={i} style={{ position: 'relative' }}>
                    <Image src={src} alt={`img${i}`} width={144} height={144} style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--gray-200)' }} />
                    <button type="button" onClick={() => setProdImages(prev => prev.filter((_, j) => j !== i))} style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', background: '#DC2626', color: 'white', border: 'none', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Description */}
          <div className="form-group">
            <label>Description</label>
            <textarea value={prodForm.description} onChange={e => setProdForm(f => ({ ...f, description: e.target.value }))} rows={3} style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--gray-200)', borderRadius: 8, fontFamily: 'inherit', fontSize: 14, resize: 'vertical' }} placeholder="Product details…" />
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', paddingTop: 8 }}>
            <button type="button" onClick={() => setProductModal(false)} style={{ padding: '10px 24px', border: '1px solid var(--gray-200)', borderRadius: 8, background: 'none', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
            <button type="submit" disabled={prodSaving || imgUploading > 0} style={{ padding: '10px 28px', background: 'var(--black)', color: 'var(--white)', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', opacity: prodSaving || imgUploading > 0 ? 0.7 : 1 }}>
              {prodSaving ? 'Saving…' : editingProduct ? 'Save Changes' : 'Add Product'}
            </button>
          </div>
        </form>
      </Modal>
    </main>
  );
}
