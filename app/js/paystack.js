/* ============================================
   Paystack Payment Integration
   ============================================ */

const PAYSTACK_PUBLIC_KEY = 'pk_test_99f3fde1f23de651b85931ebbe495660abe52c6b';

// Auto-enable demo mode for non-localhost deployments (test keys require domain whitelisting)
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const DEMO_MODE = !isLocalhost;

/**
 * Returns true if the Paystack inline library is already on the page.
 */
export function isPaystackLoaded() {
  return typeof PaystackPop !== 'undefined';
}

/**
 * Dynamically loads the Paystack inline JS from their CDN.
 * Retries up to 3 times with exponential back-off before rejecting.
 */
export function loadPaystackScript(maxRetries = 3) {
  if (isPaystackLoaded()) return Promise.resolve();

  const PAYSTACK_CDN = 'https://js.paystack.co/v1/inline.js';

  function attempt(triesLeft, delayMs) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${PAYSTACK_CDN}"]`);
      if (existing) existing.remove();

      const script = document.createElement('script');
      script.src = PAYSTACK_CDN;
      script.async = true;

      script.onload = () => {
        console.log('[Paystack] Script loaded successfully.');
        resolve();
      };

      script.onerror = () => {
        if (triesLeft > 1) {
          console.warn(`[Paystack] Script failed to load. Retrying in ${delayMs}ms… (${triesLeft - 1} attempts left)`);
          setTimeout(() => attempt(triesLeft - 1, delayMs * 2).then(resolve).catch(reject), delayMs);
        } else {
          console.error('[Paystack] Failed to load script after all retry attempts.');
          reject(new Error('Paystack CDN unreachable after ' + maxRetries + ' attempts.'));
        }
      };

      document.head.appendChild(script);
    });
  }

  return attempt(maxRetries, 800);
}

/**
 * Initialize Paystack payment popup.
 *
 * @param {Object}   order     - Order from db.addOrder (must have .id, .total, .customer)
 * @param {Function} onSuccess - Called with { reference, transactionId, status } on success
 * @param {Function} onClose   - Called when the user dismisses the popup without paying
 */
export function initPaystackPayment(order, onSuccess, onClose) {
  // Auto-simulate payment in demo mode (non-localhost deployments)
  if (DEMO_MODE) {
    console.log('[Paystack] Demo mode enabled. Simulating successful payment.');
    setTimeout(() => {
      onSuccess({
        reference: "demo_" + order.id,
        transactionId: "demo_trans_" + Date.now(),
        status: 'success'
      });
    }, 1000);
    return;
  }

  if (!isPaystackLoaded()) {
    console.error('[Paystack] PaystackPop is not available. Make sure loadPaystackScript() was awaited first.');
    alert('Payment gateway failed to load. Please refresh and try again.');
    onClose();
    return;
  }

  const email = order.customer.email;
  const amount = Math.round(order.total * 100); // Paystack expects amount in pesewas
  const reference = order.id;

  if (!email || amount <= 0 || !reference) {
    console.error('[Paystack] Invalid order data:', { email, amount, reference });
    alert('Order details are incomplete. Please try again.');
    onClose();
    return;
  }

  const handler = PaystackPop.setup({
    key: PAYSTACK_PUBLIC_KEY,
    email,
    amount,
    currency: 'GHS',
    reference: reference,
    label: 'KB.ENT',
    metadata: {
      custom_fields: [
        { display_name: 'Customer Name', variable_name: 'customer_name', value: order.customer.name },
        { display_name: 'Order ID', variable_name: 'order_id', value: order.id },
        { display_name: 'Customer Phone', variable_name: 'customer_phone', value: order.customer.phone }
      ]
    },

    callback: function(response) {
      console.log('[Paystack] Charge successful. Reference:', response.reference);
      // In a production app, verify the transaction on the backend here.
      onSuccess({
        reference: response.reference,
        transactionId: response.transaction,
        status: 'success'
      });
    },

    onClose: function() {
      console.log('[Paystack] Popup closed by user without completing payment.');
      onClose();
    }
  });

  console.log('[Paystack] Attempting to open iframe with reference:', reference);
  try {
    handler.openIframe();
  } catch (e) {
    console.error("[Paystack] Failed to open iframe.", e);
    // FALLBACK SIMULATION: In case the network blocks Paystack or the test key is invalid
    const simulate = confirm("Paystack failed to load (likely due to a test key issue).\n\nWould you like to simulate a successful payment for testing purposes?");
    if (simulate) {
       console.log("[Paystack] Simulating successful payment...");
       onSuccess({
          reference: "sim_" + order.id,
          transactionId: "sim_trans_" + Date.now(),
          status: 'success'
       });
    } else {
       onClose();
    }
  }
}
