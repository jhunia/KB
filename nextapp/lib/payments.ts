import 'server-only';
import { createHmac, timingSafeEqual } from 'crypto';
import { serviceClient } from '@/lib/supabase/service';

/*
 * Server-side Paystack checks. An order is only marked paid after Paystack itself
 * confirms the payment, and the amount matches what the order should cost.
 * Used by /api/paystack/verify (right after checkout) and /api/paystack/webhook
 * (Paystack's own notification — covers customers who close the page after paying).
 * Needs PAYSTACK_SECRET_KEY and SUPABASE_SERVICE_ROLE_KEY.
 */

export type PaystackTx = {
  status: string;      // 'success' when paid
  reference: string;   // our order id (newer payments) or a Paystack-made "T…" reference (older ones)
  amount: number;      // in pesewas
  currency: string;
  id: number;
  metadata?: { order_id?: string; custom_fields?: { variable_name: string; value: unknown }[] } | string | null;
};

/** Which order a payment belongs to: metadata.order_id, the "Order ID" custom field, or the reference */
export function orderIdOf(tx: PaystackTx): string {
  const meta = typeof tx.metadata === 'object' && tx.metadata ? tx.metadata : null;
  const field = meta?.custom_fields?.find(f => f.variable_name === 'order_id')?.value;
  return String(meta?.order_id || field || tx.reference);
}

export function paymentsConfigured() {
  return Boolean(process.env.PAYSTACK_SECRET_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/** Asks Paystack for the real state of a transaction */
export async function fetchTransaction(reference: string): Promise<PaystackTx | null> {
  const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const body = await res.json().catch(() => null);
  return body?.status ? (body.data as PaystackTx) : null;
}

/**
 * Finds the payment for an order (admin "Check payment" button). Newer payments use the
 * order id as the reference; older ones only carry it in the metadata, so recent
 * transactions since the order was placed are searched for it.
 */
export async function findTransactionForOrder(orderId: string, placedAt: string): Promise<PaystackTx | null> {
  const direct = await fetchTransaction(orderId);
  if (direct) return direct;
  const from = new Date(new Date(placedAt).getTime() - 60 * 60 * 1000).toISOString();
  const res = await fetch(`https://api.paystack.co/transaction?perPage=100&from=${encodeURIComponent(from)}`, {
    headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const list = ((await res.json().catch(() => null))?.data || []) as PaystackTx[];
  const mine = list.filter(t => orderIdOf(t) === orderId);
  return mine.find(t => t.status === 'success') || mine[0] || null;
}

/** True when a webhook really came from Paystack (HMAC-SHA512 of the raw body with the secret key) */
export function isPaystackSignature(rawBody: string, signature: string | null) {
  if (!signature) return false;
  const expected = createHmac('sha512', process.env.PAYSTACK_SECRET_KEY!).update(rawBody).digest('hex');
  const a = Buffer.from(expected), b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** name+anything@gmail.com → name@gmail.com, lowercased (same as normalize_email in SQL) */
const normalizeEmail = (email: string) => {
  const [local = '', domain = ''] = email.trim().toLowerCase().split('@');
  return `${local.replace(/\+.*$/, '')}@${domain}`;
};

export type MarkResult =
  | { ok: true; status: string; already?: boolean }
  | { ok: false; reason: string };

/**
 * Marks the order paid if the Paystack transaction checks out. Safe to call more than
 * once (verify + webhook both run for most payments) — the second call is a no-op.
 */
export async function markOrderPaid(tx: PaystackTx): Promise<MarkResult> {
  if (tx.status !== 'success') return { ok: false, reason: `payment ${tx.status}` };
  if (tx.currency !== 'GHS') return { ok: false, reason: `unexpected currency ${tx.currency}` };

  const db = serviceClient();
  const { data: order } = await db
    .from('orders')
    .select('id, status, total, subtotal, discount_amount, delivery_fee, promo_code, user_id, created_at, order_items(quantity, product_id)')
    .eq('id', orderIdOf(tx))
    .maybeSingle();
  if (!order) return { ok: false, reason: 'order not found' };
  if (!['pending_payment', 'payment_failed'].includes(order.status)) return { ok: true, status: order.status, already: true };

  // 1. They paid exactly the order total
  const expectedPesewas = Math.round(Number(order.total) * 100);
  if (tx.amount !== expectedPesewas) return { ok: false, reason: `paid ${tx.amount} but order total is ${expectedPesewas}` };

  // 2. The order total itself is honest: the browser created the order, so re-price the items
  //    from the products table, and only allow a discount that matches a real, unused promo code.
  const items = (order.order_items || []) as { quantity: number; product_id: number }[];
  const { data: products } = await db.from('products').select('id, price').in('id', items.map(i => i.product_id));
  const priceOf = new Map((products || []).map(p => [p.id as number, Number(p.price)]));
  const itemsTotal = items.reduce((sum, i) => sum + (priceOf.get(i.product_id) ?? 0) * i.quantity, 0);

  // Promo codes are members-only and once per account email (same rules as validate_promo_code)
  let promoEmail = '';
  let allowedDiscount = 0;
  if (order.promo_code) {
    const code = String(order.promo_code).toUpperCase();
    if (!order.user_id) return { ok: false, reason: `promo code ${code} used without an account` };
    const [{ data: promo }, { data: profile }] = await Promise.all([
      db.from('promo_codes').select('discount_percent, is_active, starts_at, ends_at').eq('code', code).maybeSingle(),
      db.from('profiles').select('email').eq('id', order.user_id).maybeSingle(),
    ]);
    // Dates are checked against when the order was placed, so paying a minute after a promo ends still counts
    const placed = new Date(order.created_at).getTime();
    const inWindow = promo && (!promo.starts_at || placed >= new Date(promo.starts_at).getTime())
      && (!promo.ends_at || placed < new Date(promo.ends_at).getTime());
    if (!promo?.is_active || !inWindow) return { ok: false, reason: `promo code ${code} was not valid when the order was placed` };
    promoEmail = normalizeEmail(String(profile?.email || ''));
    const { count } = await db.from('promo_uses').select('id', { count: 'exact', head: true })
      .eq('promo_code', code).eq('normalized_email', promoEmail).or(`order_id.is.null,order_id.neq.${order.id}`);
    if (count) return { ok: false, reason: `promo code ${code} was already used by this customer` };
    allowedDiscount = Math.round(itemsTotal * (Number(promo.discount_percent) / 100)); // same rounding as the checkout
  }
  const lowestHonestTotal = itemsTotal - allowedDiscount + Math.max(0, Number(order.delivery_fee) || 0);
  if (Number(order.total) + 0.01 < lowestHonestTotal) {
    return { ok: false, reason: `order total ${order.total} is below the item prices (${lowestHonestTotal.toFixed(2)})` };
  }

  const { error } = await db
    .from('orders')
    .update({ status: 'paid', payment_ref: String(tx.id || tx.reference) })
    .eq('id', order.id)
    .in('status', ['pending_payment', 'payment_failed']); // don't overwrite a concurrent update
  if (error) return { ok: false, reason: error.message };

  // The code is now used up for this customer
  if (order.promo_code && promoEmail) {
    await db.from('promo_uses').insert({
      promo_code: String(order.promo_code).toUpperCase(), normalized_email: promoEmail,
      user_id: order.user_id, order_id: order.id,
    }).then(({ error: useError }) => { if (useError) console.warn('[payments] promo use not recorded:', useError.message); });
  }
  return { ok: true, status: 'paid' };
}
