import { pushConfigured, sendToAdmins } from '@/lib/push';
import { serviceClient } from '@/lib/supabase/service';

/*
 * Called by the database (trigger "order_alert" — see app/supabase_push_alerts.sql)
 * when an order becomes paid or a cancellation is requested. Only the order id is
 * trusted from the request: the order is re-read here, and push_log makes sure each
 * alert is sent once, so calling this by hand can't fake or repeat a notification.
 */

const PAID = ['paid', 'Processing', 'Shipped', 'Delivered'];
const money = (n: number) => `GH₵${Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export async function POST(request: Request) {
  if (!pushConfigured()) return Response.json({ skipped: 'push not configured' }, { status: 503 });

  const { orderId } = await request.json().catch(() => ({} as { orderId?: unknown }));
  if (typeof orderId !== 'string' || !orderId || orderId.length > 100) {
    return Response.json({ error: 'orderId required' }, { status: 400 });
  }

  const db = serviceClient();
  const { data: order } = await db
    .from('orders')
    .select('id, status, total, customer_info, created_at, order_items(quantity, products(name))')
    .eq('id', orderId)
    .maybeSingle();
  if (!order) return Response.json({ error: 'not found' }, { status: 404 });

  const event = order.status === 'Cancellation Requested' ? 'cancel_request' : PAID.includes(order.status) ? 'paid' : null;
  if (!event) return Response.json({ skipped: 'nothing to announce' });

  // Ignore stale orders (alerts are for things happening now)
  const ageDays = (Date.now() - new Date(order.created_at).getTime()) / 86_400_000;
  if (ageDays > (event === 'paid' ? 2 : 60)) return Response.json({ skipped: 'too old' });

  // Claim this alert — if the row already exists, it was sent before
  const { error: dup } = await db.from('push_log').insert({ order_id: order.id, event });
  if (dup) return Response.json({ skipped: 'already sent' });

  const name = (order.customer_info as { name?: string } | null)?.name?.trim() || 'A customer';
  const items = (order.order_items || []) as unknown as { quantity: number; products: { name: string } | null }[];
  const first = items[0];
  const itemText = first
    ? `${first.products?.name || 'Item'} ×${first.quantity}${items.length > 1 ? ` +${items.length - 1} more` : ''}`
    : '';

  const payload = event === 'paid'
    ? { title: `New order · ${money(order.total)}`, body: [name, itemText].filter(Boolean).join(' — ') }
    : { title: 'Cancellation requested', body: `${name} wants to cancel order ${order.id}` };

  const result = await sendToAdmins({ ...payload, url: `/admin/orders/${encodeURIComponent(order.id)}`, tag: `${order.id}-${event}` });
  return Response.json(result);
}
