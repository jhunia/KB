/* ============================================
   Store details used by the footer and the help pages.
   Fill in the blanks — anything left empty is simply hidden
   (so there are never dead links or made-up contact details).
   ============================================ */

export const SITE = {
  name: 'stress_d',
  established: 2026,

  // Customer contact. The email matches the one in the Terms page — make sure this mailbox exists.
  supportEmail: 'support@kbent.com',
  phone: '+233 55 287 4892',    // shown with a "Call us" button
  whatsapp: '+233 55 287 4892', // shown with a "Chat on WhatsApp" button (footer, support, order confirmation)
  hours: '',          // e.g. 'Mon–Sat, 9am–6pm'

  // Full profile links, e.g. 'https://instagram.com/stress_d'
  social: {
    instagram: '',
    tiktok: '',
    x: '',
    facebook: '',
  },
};

/** 0241234567 / +233 24 123 4567 → 233241234567 for wa.me links */
export function waNumber(phone: string) {
  const d = phone.replace(/\D/g, '');
  return d.startsWith('233') ? d : d.startsWith('0') ? '233' + d.slice(1) : d;
}

/** wa.me link to the store's WhatsApp, optionally with a pre-filled message */
export function storeWhatsAppLink(text?: string) {
  if (!SITE.whatsapp) return '';
  return `https://wa.me/${waNumber(SITE.whatsapp)}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}
