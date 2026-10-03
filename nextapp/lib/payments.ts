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
    .select('id, status, total, subtotal, discount_amount, delivery_fee, order_items(quantity, product_id)')
    .eq('id', orderIdOf(tx))
    .maybeSingle();
  if (!order) return { ok: false, reason: 'order not found' };
  if (!['pending_payment', 'payment_failed'].includes(order.status)) return { ok: true, status: order.status, already: true };

  // 1. They paid exactly the order total
  const expectedPesewas = Math.round(Number(order.total) * 100);
  if (tx.amount !== expectedPesewas) return { ok: false, reason: `paid ${tx.amount} but order total is ${expectedPesewas}` };

  // 2. The order total itself is honest: the browser created the order, so re-price the items
  //    from the products table. Allow at most the biggest active promo discount.
  const items = (order.order_items || []) as { quantity: number; product_id: number }[];
  const { data: products } = await db.from('products').select('id, price').in('id', items.map(i => i.product_id));
  const priceOf = new Map((products || []).map(p => [p.id as number, Number(p.price)]));
  const itemsTotal = items.reduce((sum, i) => sum + (priceOf.get(i.product_id) ?? 0) * i.quantity, 0);
  const { data: promos } = await db.from('promo_codes').select('discount_percent').eq('is_active', true);
  const maxPct = Math.max(0, ...(promos || []).map(p => Number(p.discount_percent) || 0));
  const lowestHonestTotal = itemsTotal * (1 - maxPct / 100) + Math.max(0, Number(order.delivery_fee) || 0);
  if (Number(order.total) + 0.01 < lowestHonestTotal) {
    return { ok: false, reason: `order total ${order.total} is below the item prices (${lowestHonestTotal.toFixed(2)})` };
  }

  const { error } = await db
    .from('orders')
    .update({ status: 'paid', payment_ref: String(tx.id || tx.reference) })
    .eq('id', order.id)
    .in('status', ['pending_payment', 'payment_failed']); // don't overwrite a concurrent update
  if (error) return { ok: false, reason: error.message };
  return { ok: true, status: 'paid' };
}
