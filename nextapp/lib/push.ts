import 'server-only';
import webpush from 'web-push';
import { serviceClient } from '@/lib/supabase/service';
import { SITE } from '@/lib/site';

/*
 * Server-side web push for admin order alerts.
 * Needs (in .env.local and in Vercel → Environment Variables):
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, SUPABASE_SERVICE_ROLE_KEY
 */

export type PushPayload = { title: string; body: string; url: string; tag?: string };

export function pushConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

let vapidSet = false;
function setupVapid() {
  if (vapidSet) return;
  webpush.setVapidDetails(`mailto:${SITE.supportEmail}`, process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  vapidSet = true;
}

/**
 * Sends a notification to every registered admin device (or only one admin's devices).
 * Devices the push service reports as gone (uninstalled app, alerts turned off) are removed.
 */
export async function sendToAdmins(payload: PushPayload, onlyUserId?: string): Promise<{ sent: number; failed: number }> {
  setupVapid();
  const db = serviceClient();
  let query = db.from('push_subscriptions').select('id, endpoint, p256dh, auth');
  if (onlyUserId) query = query.eq('user_id', onlyUserId);
  const { data: subs, error } = await query;
  if (error) throw error;

  let sent = 0, failed = 0;
  const gone: number[] = [];
  await Promise.all((subs || []).map(async s => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload),
        { TTL: 60 * 60 * 24, urgency: 'high' },
      );
      sent++;
    } catch (err) {
      failed++;
      const code = (err as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) gone.push(s.id);
      else console.error('push failed', code, (err as Error).message);
    }
  }));
  if (gone.length) await db.from('push_subscriptions').delete().in('id', gone);
  return { sent, failed };
}
