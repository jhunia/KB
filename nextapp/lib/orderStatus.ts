/* Order status wording and progress steps shown to customers (My Account and Track order).
   The admin uses its own, more operational wording (lib/admin.ts). */

export const CUSTOMER_STATUS: Record<string, { label: string; tone: string }> = {
  pending_payment: { label: 'Awaiting payment', tone: 'pending' },
  paid: { label: 'Order received', tone: 'processing' },
  Processing: { label: 'Being prepared', tone: 'processing' },
  Shipped: { label: 'On its way', tone: 'shipped' },
  Delivered: { label: 'Delivered', tone: 'delivered' },
  'Cancellation Requested': { label: 'Cancellation requested', tone: 'pending' },
  Cancelled: { label: 'Cancelled', tone: 'cancelled' },
  payment_failed: { label: 'Payment failed', tone: 'cancelled' },
};

export const STEPS = ['Order received', 'Being prepared', 'On its way', 'Delivered'];
export const STEP_INDEX: Record<string, number> = { paid: 0, Processing: 1, Shipped: 2, Delivered: 3 };

// Customers can ask to cancel until the order has been shipped
export const CANCELLABLE = ['pending_payment', 'paid', 'Processing'];

export const UNPAID = ['pending_payment', 'payment_failed'];

export const money = (n: number) => `GH₵${n.toFixed(2)}`;
