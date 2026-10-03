/* ============================================
   Paystack Payment Integration — Next.js port
   ============================================ */

declare const PaystackPop: {
  setup(config: Record<string, unknown>): { openIframe(): void };
};

const PAYSTACK_PUBLIC_KEY = process.env.NEXT_PUBLIC_PAYSTACK_KEY;

export function isPaystackLoaded(): boolean {
  return typeof PaystackPop !== 'undefined';
}

export function loadPaystackScript(maxRetries = 3): Promise<void> {
  if (isPaystackLoaded()) return Promise.resolve();
  const PAYSTACK_CDN = 'https://js.paystack.co/v1/inline.js';

  function attempt(triesLeft: number, delayMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${PAYSTACK_CDN}"]`);
      if (existing) existing.remove();
      const script = document.createElement('script');
      script.src = PAYSTACK_CDN;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        if (triesLeft > 1) {
          setTimeout(() => attempt(triesLeft - 1, delayMs * 2).then(resolve).catch(reject), delayMs);
        } else {
          reject(new Error('Paystack CDN unreachable after ' + maxRetries + ' attempts.'));
        }
      };
      document.head.appendChild(script);
    });
  }
  return attempt(maxRetries, 800);
}

export function initPaystackPayment(
  order: { id: string; total: number; customer: { name: string; email: string; phone: string } },
  onSuccess: (result: { reference: string; transactionId: string; status: string }) => void,
  onClose: () => void
): void {
  if (!isPaystackLoaded()) {
    alert('Payment gateway failed to load. Please refresh and try again.');
    onClose();
    return;
  }

  const email = order.customer.email;
  const amount = Math.round(order.total * 100);
  const reference = order.id;

  if (!email || amount <= 0 || !reference) {
    alert('Order details are incomplete. Please try again.');
    onClose();
    return;
  }

  const handler = PaystackPop.setup({
    key: PAYSTACK_PUBLIC_KEY,
    email,
    amount,
    currency: 'GHS',
    ref: reference, // inline v1 reads "ref" (a "reference" key is ignored and Paystack makes up its own)
    label: 'stress_d',
    metadata: {
      order_id: order.id, // the server matches the payment to the order with this (lib/payments.ts)
      custom_fields: [
        { display_name: 'Customer Name', variable_name: 'customer_name', value: order.customer.name },
        { display_name: 'Order ID', variable_name: 'order_id', value: order.id },
        { display_name: 'Customer Phone', variable_name: 'customer_phone', value: order.customer.phone }
      ]
    },
    callback: function(response: { reference: string; transaction: string }) {
      onSuccess({ reference: response.reference, transactionId: response.transaction, status: 'success' });
    },
    onClose: function() {
      onClose();
    }
  });

  try {
    handler.openIframe();
  } catch (e) {
    console.error('[Paystack] Failed to open iframe.', e);
    alert('Payment gateway failed to open. Please check your connection and try again.');
    onClose();
  }
}
