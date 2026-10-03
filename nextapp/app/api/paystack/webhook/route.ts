import { isPaystackSignature, markOrderPaid, paymentsConfigured, type PaystackTx } from '@/lib/payments';

/*
 * Paystack → website notification (Paystack dashboard → Settings → API Keys & Webhooks →
 * Webhook URL: https://stressd.vercel.app/api/paystack/webhook).
 * Marks orders paid even when the customer closed the page before the checkout could.
 */
export async function POST(request: Request) {
  if (!paymentsConfigured()) return new Response('payments not configured', { status: 503 });

  const raw = await request.text();
  if (!isPaystackSignature(raw, request.headers.get('x-paystack-signature'))) {
    return new Response('invalid signature', { status: 401 });
  }

  const event = JSON.parse(raw) as { event: string; data: PaystackTx };
  if (event.event === 'charge.success') {
    const result = await markOrderPaid(event.data);
    if (!result.ok) console.warn('[paystack webhook]', event.data.reference, result.reason);
  }
  // Always 200 for genuine Paystack calls, otherwise Paystack keeps retrying
  return new Response('ok');
}
