/* ============================================
   Homepage promo — managed from Admin → Promotions, stored in
   site_settings under the key "promo". While it's live, the ad
   image takes the place of the big photo at the top of the
   homepage. Nothing else on the page changes.
   ============================================ */
import { db } from './db';
import { getClient } from './supabase/client';

export type PromoSettings = {
  active: boolean;
  image: string | null;     // ad shown in place of the homepage hero photo
  title: string;            // short description of the ad, used as its alt text
  ctaHref: string;          // where tapping the ad goes
  endsAt: string | null;    // ISO date; the normal photo comes back after this
};

export const DEFAULT_PROMO: PromoSettings = {
  active: false,
  image: null,
  title: 'End of season sale',
  ctaHref: '/category?filter=sale',
  endsAt: null,
};

export const PROMO_LINKS = [
  { href: '/category?filter=sale', label: 'On sale items' },
  { href: '/category?filter=new', label: 'New arrivals' },
  { href: '/category', label: 'All products' },
  { href: '/category?filter=top', label: 'Top selling' },
];

/** Reads the campaign; falls back to the older on/off switch if the campaign was never saved. */
export async function getPromo(): Promise<PromoSettings> {
  const saved = await db.getSiteSetting('promo', null);
  if (saved && typeof saved === 'object') return { ...DEFAULT_PROMO, ...(saved as Partial<PromoSettings>) };
  const legacyActive = await db.getSiteSetting('promo_banner_active', false);
  return { ...DEFAULT_PROMO, active: legacyActive === true };
}

export async function savePromo(p: PromoSettings): Promise<boolean> {
  return db.setSiteSetting('promo', p);
}

/** False when app/supabase_site_settings.sql hasn't been run, so settings can't be saved */
export async function settingsTableExists(): Promise<boolean> {
  const { error } = await getClient().from('site_settings').select('key').limit(1);
  return !error || !/site_settings|PGRST205|does not exist/i.test(`${error.code} ${error.message}`);
}

/** On, and not past its end date */
export function isPromoLive(p: PromoSettings, now = Date.now()): boolean {
  return p.active && (!p.endsAt || new Date(p.endsAt).getTime() > now);
}
