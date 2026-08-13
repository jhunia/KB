/**
 * Shared brand logo utility powered by logo.dev
 * Token is read from NEXT_PUBLIC_LOGO_DEV_KEY at runtime (client-safe).
 */

const TOKEN = process.env.NEXT_PUBLIC_LOGO_DEV_KEY ?? '';

/** Returns the logo.dev CDN URL for a given domain. */
export const logoUrl = (domain: string, size = 80) =>
  `https://img.logo.dev/${domain}?token=${TOKEN}&size=${size}&format=webp`;

/** Map of brand display names → logo.dev domains */
export const BRAND_DOMAINS: Record<string, string> = {
  // ── Brands sold in the store ─────────────────────────────────────────────
  'Adidas':       'adidas.com',
  'Nike':         'nike.com',
  'Puma':         'puma.com',
  'Lacoste':      'lacoste.com',
  'Hugo Boss':    'hugoboss.com',
  'Under Armour': 'underarmour.com',
  'H&M':          'hm.com',
  'Zara':         'zara.com',
  'Clarks':       'clarks.com',

  // ── Aspirational / marquee brands shown in the scrolling bar ─────────────
  'Versace':      'versace.com',
  'Gucci':        'gucci.com',
  'Prada':        'prada.com',
  'Calvin Klein': 'calvinklein.com',
  'Dior':         'dior.com',
  'Chanel':       'chanel.com',
  'Balenciaga':   'balenciaga.com',
};

/** Returns the logo.dev URL for a brand name, or null if not found. */
export const getBrandLogo = (brand: string, size = 80): string | null => {
  const domain = BRAND_DOMAINS[brand];
  return domain ? logoUrl(domain, size) : null;
};
