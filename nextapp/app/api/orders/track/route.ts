import { serviceClient } from '@/lib/supabase/service';

/*
 * Guest order tracking (/track). An order is only shown when the order number AND the
 * email or phone number used at checkout match — order numbers alone aren't enough.
 * Only what the customer needs is returned (no address or phone).
 * Body: { orders: [{ id, contact }, …] } (up to 10 — the form, or orders remembered on this device)
 */
type Lookup = { id?: unknown; contact?: unknown; email?: unknown };

// Phone numbers are compared on their last 9 digits, so 024 123 4567, 0241234567,
// +233 24 123 4567 and 233241234567 all match each other
const phoneKey = (v: string) => v.replace(/\D/g, '').slice(-9);
const isPhone = (v: string) => !v.includes('@') && v.replace(/\D/g, '').length >= 7;

function matches(contact: string, info: { email?: string; phone?: string } | null) {
  if (!info) return false;
  if (contact.includes('@')) return contact === String(info.email || '').trim().toLowerCase();
  return isPhone(contact) && !!info.phone && phoneKey(contact) === phoneKey(String(info.phone));
}

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
  if (!wanted.length) return Response.json({ orders: [] });

  const { data, error } = await serviceClient()
    .from('orders')
    .select('id, created_at, status, total, discount_amount, delivery_fee, customer_info, order_items(product_id, size, color, quantity, unit_price)')
    .in('id', wanted.map(w => w.id));
  if (error) return Response.json({ error: 'lookup failed' }, { status: 500 });

  const orders = (data || [])
    .filter(o => wanted.some(w => w.id === o.id && matches(w.contact, o.customer_info as { email?: string; phone?: string } | null)))
    .map(o => ({
      id: o.id, date: o.created_at, status: o.status,
      total: Number(o.total), discount: Number(o.discount_amount || 0), deliveryFee: Number(o.delivery_fee || 0),
      items: (o.order_items || []).map((i: Record<string, unknown>) => ({
        productId: i.product_id as number, size: i.size as string, color: i.color as string, quantity: i.quantity as number,
        unitPrice: i.unit_price != null ? Number(i.unit_price) : undefined,
      })),
    }))
    .sort((a, b) => b.date.localeCompare(a.date));

  return Response.json({ orders });
}
