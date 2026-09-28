/* ============================================
   Admin data layer — queries used only by the /admin area.
   Lists are filtered, searched and paginated in the database
   (not by downloading everything), so the admin stays fast
   as the number of orders grows.
   ============================================ */
import { getClient } from './supabase/client';
import { db } from './db';
import type { Order } from './types';

export type AdminOrder = Order & { adminNotes?: string | null };

/* ---------- Order statuses ---------- */

export const ORDER_STATUSES = ['pending_payment', 'paid', 'Processing', 'Shipped', 'Delivered', 'Cancellation Requested', 'Cancelled', 'payment_failed'] as const;
/** Statuses where the customer has paid (used for revenue) */
export const PAID_STATUSES = ['paid', 'Processing', 'Shipped', 'Delivered', 'Cancellation Requested'];

const STATUS_LABELS: Record<string, string> = {
  pending_payment: 'Awaiting payment', paid: 'Paid — to pack', Processing: 'Processing',
  Shipped: 'Shipped', Delivered: 'Delivered', 'Cancellation Requested': 'Cancel requested',
  Cancelled: 'Cancelled', payment_failed: 'Payment failed',
};
export const statusLabel = (s: string) => STATUS_LABELS[s] || s;

/** The usual next step for an order, shown as a one-click button */
export const NEXT_STEP: Record<string, { status: string; label: string } | undefined> = {
  paid: { status: 'Processing', label: 'Start processing' },
  Processing: { status: 'Shipped', label: 'Mark as shipped' },
  Shipped: { status: 'Delivered', label: 'Mark as delivered' },
};

/** Tabs on the Orders page, each mapping to one or more statuses */
export const ORDER_VIEWS = [
  { key: 'to_fulfil', label: 'To fulfil', statuses: ['paid', 'Processing'] },
  { key: 'cancel_requests', label: 'Cancel requests', statuses: ['Cancellation Requested'] },
  { key: 'shipped', label: 'Shipped', statuses: ['Shipped'] },
  { key: 'delivered', label: 'Delivered', statuses: ['Delivered'] },
  { key: 'awaiting_payment', label: 'Awaiting payment', statuses: ['pending_payment'] },
  { key: 'cancelled', label: 'Cancelled / failed', statuses: ['Cancelled', 'payment_failed'] },
  { key: 'all', label: 'All', statuses: [] as string[] },
] as const;
export type OrderViewKey = (typeof ORDER_VIEWS)[number]['key'];

/* ---------- Catalogue options ---------- */

export const CATEGORIES = ['tshirts', 'shirts', 'jeans', 'hoodies', 'jackets', 'suits', 'shoes', 'sandals', 'accessories'];
export const categoryLabel = (c: string) => (c === 'tshirts' ? 'T-shirts' : c ? c.charAt(0).toUpperCase() + c.slice(1) : '—');
export const SIZE_PRESETS: Record<string, string[]> = {
  clothing: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
  trousers: ['28', '30', '32', '34', '36', '38'],
  shoes: ['39', '40', '41', '42', '43', '44', '45'],
  other: ['One Size'],
};
export const BRANDS = ['Adidas', 'Nike', 'Gucci', 'Zara', 'H&M', 'Puma', 'Lacoste', 'Calvin Klein'];
export const GENDERS = ['Uni-sex', 'Men', 'Women', 'Kids'];
export const STYLES = ['casual', 'formal', 'party', 'gym', 'streetwear'];

/* ---------- Helpers ---------- */

function mapOrder(o: Record<string, unknown>): AdminOrder {
  return {
    id: o.id as string,
    date: o.created_at as string,
    status: o.status as string,
    total: Number(o.total),
    subtotal: o.subtotal != null ? Number(o.subtotal) : undefined,
    discount: Number(o.discount_amount || 0),
    deliveryFee: Number(o.delivery_fee || 0),
    paymentMethod: o.payment_method as string,
    paymentRef: o.payment_ref as string | null,
    userId: o.user_id as string,
    customer: (o.customer_info as Order['customer']) || { name: '', email: '', phone: '', address: '' },
    adminNotes: (o.admin_notes as string | null) ?? null,
    items: ((o.order_items as Record<string, unknown>[]) || []).map(i => ({
      productId: i.product_id as number, size: i.size as string, color: i.color as string, quantity: i.quantity as number,
      unitPrice: i.unit_price != null ? Number(i.unit_price) : undefined,
    })),
  };
}

// Characters that would break PostgREST's filter syntax
const cleanSearch = (q: string) => q.replace(/[,()*%\\"]/g, ' ').trim();

/** Ghana numbers like 024 123 4567 → 233241234567 for WhatsApp links */
export function whatsappNumber(phone: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.startsWith('233')) return digits;
  if (digits.startsWith('0')) return '233' + digits.slice(1);
  return digits;
}

export const fmtMoney = (n: number) => `GH₵${(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
export const fmtDateTime = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/* ---------- Orders ---------- */

export async function listOrders(opts: { view: OrderViewKey; q?: string; page: number; pageSize: number }) {
  const supabase = getClient();
  const view = ORDER_VIEWS.find(v => v.key === opts.view) || ORDER_VIEWS[ORDER_VIEWS.length - 1];
  let query = supabase.from('orders').select('*, order_items(*)', { count: 'exact' });
  if (view.statuses.length) query = query.in('status', view.statuses as unknown as string[]);
  const q = cleanSearch(opts.q || '');
  if (q) {
    query = query.or([
      `id.ilike.%${q}%`,
      `customer_info->>name.ilike.%${q}%`,
      `customer_info->>email.ilike.%${q}%`,
      `customer_info->>phone.ilike.%${q.replace(/\s/g, '')}%`,
    ].join(','));
  }
  const from = (opts.page - 1) * opts.pageSize;
  const { data, count, error } = await query.order('created_at', { ascending: false }).range(from, from + opts.pageSize - 1);
  if (error) throw new Error(error.message);
  return { orders: (data || []).map(mapOrder), total: count || 0 };
}

/** Number of orders in each Orders-page tab */
export async function orderViewCounts(): Promise<Record<string, number>> {
  const supabase = getClient();
  const results = await Promise.all(ORDER_VIEWS.map(async v => {
    let query = supabase.from('orders').select('id', { count: 'exact', head: true });
    if (v.statuses.length) query = query.in('status', v.statuses as unknown as string[]);
    const { count } = await query;
    return [v.key, count || 0] as const;
  }));
  return Object.fromEntries(results);
}

export async function getOrder(id: string): Promise<AdminOrder | null> {
  const supabase = getClient();
  const { data, error } = await supabase.from('orders').select('*, order_items(*)').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapOrder(data) : null;
}

/** Changes status (and sends the customer's shipping email where applicable) */
export async function setOrderStatus(id: string, status: string): Promise<void> {
  const ok = await db.updateOrderStatus(id, status);
  if (!ok) throw new Error('The database rejected the status change.');
}

export async function setOrdersStatus(ids: string[], status: string): Promise<{ done: number; failed: number }> {
  let done = 0, failed = 0;
  // One at a time so each customer still gets their shipping-update email
  for (const id of ids) {
    try { await setOrderStatus(id, status); done++; } catch { failed++; }
  }
  return { done, failed };
}

/** Delivery fee agreed on the phone (collected separately) and private admin notes */
export async function updateOrderDetails(id: string, fields: { deliveryFee?: number; adminNotes?: string }): Promise<void> {
  const supabase = getClient();
  const patch: Record<string, unknown> = {};
  if (fields.deliveryFee !== undefined) patch.delivery_fee = fields.deliveryFee;
  if (fields.adminNotes !== undefined) patch.admin_notes = fields.adminNotes;
  const { error } = await supabase.from('orders').update(patch).eq('id', id);
  if (error) {
    if (/admin_notes/.test(error.message)) throw new Error('Notes need a database update — run app/supabase_admin_patch.sql in Supabase.');
    throw new Error(error.message);
  }
}

export async function deleteOrder(id: string): Promise<void> {
  const ok = await db.deleteOrder(id);
  if (!ok) throw new Error('The database rejected the delete.');
}

/** Every order matching the filters, for CSV export */
export async function exportOrdersCsv(opts: { view: OrderViewKey; q?: string }): Promise<string> {
  const { orders } = await listOrders({ ...opts, page: 1, pageSize: 5000 });
  const header = ['Order ID', 'Date', 'Status', 'Customer', 'Email', 'Phone', 'Address', 'Items', 'Subtotal', 'Discount', 'Paid online', 'Delivery fee', 'Payment ref'];
  const esc = (v: unknown) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = orders.map(o => [
    o.id, new Date(o.date).toISOString(), statusLabel(o.status), o.customer.name, o.customer.email, o.customer.phone, o.customer.address,
    o.items.map(i => `${db.getProductById(i.productId)?.name || '#' + i.productId} (${i.size}, ${i.color}) x${i.quantity}`).join('; '),
    o.subtotal ?? '', o.discount ?? 0, o.total, o.deliveryFee ?? 0, o.paymentRef ?? '',
  ].map(esc).join(','));
  return [header.join(','), ...rows].join('\n');
}

/* ---------- Dashboard ---------- */

export async function dashboardData(days = 30) {
  const supabase = getClient();
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (days - 1));

  const [recentRes, counts, latestRes] = await Promise.all([
    supabase.from('orders').select('id, status, total, created_at, order_items(product_id, quantity)').gte('created_at', since.toISOString()),
    orderViewCounts(),
    supabase.from('orders').select('*, order_items(*)').order('created_at', { ascending: false }).limit(6),
  ]);
  if (recentRes.error) throw new Error(recentRes.error.message);

  const paid = (recentRes.data || []).filter(o => PAID_STATUSES.includes(o.status as string));
  const byDay = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    const d = new Date(since); d.setDate(since.getDate() + i);
    byDay.set(d.toDateString(), 0);
  }
  const productQty = new Map<number, number>();
  for (const o of paid) {
    const key = new Date(o.created_at as string).toDateString();
    byDay.set(key, (byDay.get(key) || 0) + Number(o.total));
    for (const i of (o.order_items as Array<{ product_id: number; quantity: number }>) || []) {
      productQty.set(i.product_id, (productQty.get(i.product_id) || 0) + i.quantity);
    }
  }
  const revenue = paid.reduce((s, o) => s + Number(o.total), 0);
  const topProducts = [...productQty.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([id, qty]) => ({ product: db.getProductById(id), id, qty }));

  return {
    revenue,
    paidOrders: paid.length,
    avgOrder: paid.length ? revenue / paid.length : 0,
    series: [...byDay.entries()].map(([day, total]) => ({ day: new Date(day), total })),
    counts,
    latest: (latestRes.data || []).map(mapOrder),
    topProducts,
  };
}

/* ---------- Customers ---------- */

export type AdminCustomer = {
  key: string;            // email (lower-case) — identifies guests and members alike
  name: string;
  email: string;
  phone: string;
  registered: boolean;
  joined?: string;
  orders: number;
  spend: number;          // paid orders only
  lastOrder?: string;
};

/** Registered customers plus guest shoppers (from their orders), merged by email */
export async function listCustomers(): Promise<AdminCustomer[]> {
  const supabase = getClient();
  const [profilesRes, ordersRes] = await Promise.all([
    supabase.from('profiles').select('id, name, email, phone, role, created_at').neq('role', 'admin'),
    supabase.from('orders').select('status, total, created_at, customer_info').order('created_at', { ascending: false }).limit(10000),
  ]);
  if (profilesRes.error) throw new Error(profilesRes.error.message);
  if (ordersRes.error) throw new Error(ordersRes.error.message);

  const map = new Map<string, AdminCustomer>();
  for (const p of profilesRes.data || []) {
    const key = String(p.email || '').toLowerCase();
    if (!key) continue;
    map.set(key, { key, name: p.name || '—', email: p.email, phone: p.phone || '', registered: true, joined: p.created_at, orders: 0, spend: 0 });
  }
  for (const o of ordersRes.data || []) {
    const info = (o.customer_info || {}) as Order['customer'];
    const key = String(info.email || '').toLowerCase();
    if (!key) continue;
    const c = map.get(key) || { key, name: info.name || '—', email: info.email, phone: info.phone || '', registered: false, orders: 0, spend: 0 };
    if (!c.phone && info.phone) c.phone = info.phone;
    c.orders++;
    if (PAID_STATUSES.includes(o.status)) c.spend += Number(o.total);
    if (!c.lastOrder) c.lastOrder = o.created_at; // orders are newest-first
    map.set(key, c);
  }
  return [...map.values()];
}

/* ---------- Promo codes ---------- */

export type PromoCode = { id: number; code: string; discountPercent: number; isActive: boolean; createdAt: string; uses: number };

export async function listPromoCodes(): Promise<PromoCode[]> {
  const supabase = getClient();
  const [codesRes, usesRes] = await Promise.all([
    supabase.from('promo_codes').select('*').order('created_at', { ascending: false }),
    supabase.from('promo_uses').select('promo_code'),
  ]);
  if (codesRes.error) throw new Error(codesRes.error.message);
  const uses = new Map<string, number>();
  for (const u of usesRes.data || []) uses.set(u.promo_code, (uses.get(u.promo_code) || 0) + 1);
  return (codesRes.data || []).map(c => ({
    id: c.id, code: c.code, discountPercent: c.discount_percent, isActive: c.is_active, createdAt: c.created_at, uses: uses.get(c.code) || 0,
  }));
}

export async function createPromoCode(code: string, discountPercent: number): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase.from('promo_codes').insert({ code: code.trim().toUpperCase(), discount_percent: discountPercent, is_active: true });
  if (error) throw new Error(/duplicate|unique/i.test(error.message) ? 'That code already exists.' : error.message);
}

export async function setPromoActive(id: number, isActive: boolean): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase.from('promo_codes').update({ is_active: isActive }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deletePromoCode(id: number): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase.from('promo_codes').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
