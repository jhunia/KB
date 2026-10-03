/* Orders placed as a guest on this device, so /track can show them without typing anything.
   Kept in localStorage (per browser) — the server still checks the email/phone before showing an order. */

const KEY = 'stressd_guest_orders';
/** contact = the email or phone number the order was placed / looked up with */
export type GuestOrderRef = { id: string; contact: string };

export function getGuestOrders(): GuestOrderRef[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]');
    if (!Array.isArray(list)) return [];
    return list
      .map(o => ({ id: o?.id, contact: o?.contact ?? o?.email })) // older entries stored "email"
      .filter((o): o is GuestOrderRef => typeof o.id === 'string' && typeof o.contact === 'string');
  } catch {
    return [];
  }
}

export function rememberGuestOrder(ref: GuestOrderRef) {
  try {
    const list = [ref, ...getGuestOrders().filter(o => o.id !== ref.id)].slice(0, 10);
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch { /* private mode / storage blocked — the form still works */ }
}

export function forgetGuestOrders() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
