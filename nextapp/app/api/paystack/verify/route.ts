import { fetchTransaction, findTransactionForOrder, markOrderPaid, paymentsConfigured } from '@/lib/payments';
import { serviceClient } from '@/lib/supabase/service';

/*
 * Called by the checkout right after the Paystack pop-up reports success.
 * The browser's word isn't trusted: Paystack is asked directly, then the order is checked.
 */
export async function POST(request: Request) {
  if (!paymentsConfigured()) return Response.json({ ok: false, reason: 'payments not configured' }, { status: 503 });

  // { reference } from the checkout, or { orderId } from the admin "Check payment with Paystack" button
  const { reference, orderId } = await request.json().catch(() => ({} as { reference?: unknown; orderId?: unknown }));
  const valid = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 100;
  if (!valid(reference) && !valid(orderId)) {
    return Response.json({ ok: false, reason: 'reference or orderId required' }, { status: 400 });
  }

  let tx;
  if (valid(reference)) {
    tx = await fetchTransaction(reference);
  } else {
    const { data: order } = await serviceClient().from('orders').select('created_at').eq('id', orderId).maybeSingle();
    if (!order) return Response.json({ ok: false, reason: 'order not found' }, { status: 404 });
    tx = await findTransactionForOrder(orderId as string, order.created_at);
  }
  if (!tx) return Response.json({ ok: false, reason: 'transaction not found' }, { status: 404 });

  const result = await markOrderPaid(tx);
  if (!result.ok) console.warn('[paystack verify]', reference, result.reason);
  return Response.json(result, { status: result.ok ? 200 : 409 });
}
