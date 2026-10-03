import { serviceClient } from '@/lib/supabase/service';

/*
 * Guest order tracking (/track).
 *
 * A guest proves who they are with ONE paid order number + the email or phone number used
 * for it. Once that matches, every order placed with that same email / phone is shown,
 * so they see their whole order history. Unpaid orders only show themselves: anyone can
 * start an order with someone else's email or phone, so they prove nothing. An email or phone number on its own is never
 * enough — phone numbers are widely known, and orders show what someone bought.
 * Only what the customer needs is returned (no address or phone).
 *
 * Body: { orders: [{ id, contact }, …] } (up to 10 — the form, or orders remembered on this device)
 */
type Lookup = { id?: unknown; contact?: unknown; email?: unknown };
type Info = { email?: string; phone?: string } | null;

// Phone numbers are compared on their last 9 digits, so 024 123 4567, 0241234567,
// +233 24 123 4567 and 233241234567 all match each other
const phoneKey = (v: string) => v.replace(/\D/g, '').slice(-9);
const isPhone = (v: string) => !v.includes('@') && v.replace(/\D/g, '').length >= 7;

function matches(contact: string, info: Info) {
  if (!info) return false;
  if (contact.includes('@')) return contact === String(info.email || '').trim().toLowerCase();
  return isPhone(contact) && !!info.phone && phoneKey(contact) === phoneKey(String(info.phone));
}

const FIELDS = 'id, created_at, status, total, discount_amount, delivery_fee, customer_info, order_items(product_id, size, color, quantity, unit_price)';
const MAX_ORDERS = 30;

export async function POST(request: Request) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return Response.json({ error: 'not configured' }, { status: 503 });

  const body = await request.json().catch(() => ({})) as { orders?: Lookup[] };
  const wanted = (Array.isArray(body.orders) ? body.orders : [])
    .slice(0, 10)
    .map(o => ({ id: o.id, contact: o.contact ?? o.email })) // "email" = orders remembered before phone lookup existed
    .filter((o): o is { id: string; contact: string } =>
      typeof o.id === 'string' && typeof o.contact === 'string' && o.id.length <= 100 && o.contact.length <= 254)
    .map(o => ({ id: o.id.trim().toUpperCase(), contact: o.contact.trim().toLowerCase() }))
    .filter(o => o.contact.includes('@') || isPhone(o.contact));
  if (!wanted.length) return Response.json({ orders: [], verified: [] });

  const db = serviceClient();

  // 1. Proof: the order numbers given, with a matching email / phone
  const { data: direct, error } = await db.from('orders').select(FIELDS).in('id', wanted.map(w => w.id));
  if (error) return Response.json({ error: 'lookup failed' }, { status: 500 });
  const proven = (direct || []).filter(o => wanted.some(w => w.id === o.id && matches(w.contact, o.customer_info as Info)));
  const PAID = ['paid', 'Processing', 'Shipped', 'Delivered', 'Cancellation Requested', 'Cancelled'];
  const contacts = Array.from(new Set(
    wanted.filter(w => proven.some(o => o.id === w.id && PAID.includes(o.status as string))).map(w => w.contact)));

  // 2. Every other order placed with a proven email / phone
  const found = new Map(proven.map(o => [o.id as string, o]));
  for (const contact of contacts) {
    const query = db.from('orders').select(FIELDS).order('created_at', { ascending: false }).limit(MAX_ORDERS);
    const { data } = contact.includes('@')
      ? await query.ilike('customer_info->>email', contact)
      // digits may be stored with spaces or dashes (055 287 4892), so allow anything between them; exact check below
      : await query.ilike('customer_info->>phone', `%${phoneKey(contact).split('').join('%')}%`);
    for (const o of data || []) if (matches(contact, o.customer_info as Info)) found.set(o.id as string, o);
  }

  const orders = Array.from(found.values())
    .map(o => ({
      id: o.id, date: o.created_at, status: o.status,
      total: Number(o.total), discount: Number(o.discount_amount || 0), deliveryFee: Number(o.delivery_fee || 0),
      items: (o.order_items || []).map((i: Record<string, unknown>) => ({
        productId: i.product_id as number, size: i.size as string, color: i.color as string, quantity: i.quantity as number,
        unitPrice: i.unit_price != null ? Number(i.unit_price) : undefined,
      })),
    }))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, MAX_ORDERS);

  // verified = the order numbers that proved the contact (the page remembers these on the device)
  return Response.json({ orders, verified: proven.map(o => o.id) });
}
