'use client';

/*
 * "Order alerts" bell in the admin top bar: turns on push notifications for this
 * device so the phone buzzes when an order is paid or a cancellation is requested.
 * On iPhone this only works once the admin is installed (Share → Add to Home Screen).
 * Server side: lib/push.ts, app/api/push/*, app/supabase_push_alerts.sql.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { getClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useFeedback } from '@/components/admin/Feedback';

type State = 'loading' | 'install' | 'unsupported' | 'denied' | 'off' | 'on';

const VAPID_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

function base64ToBytes(base64: string) {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isInstalled = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

async function detect(): Promise<{ state: State; sub: PushSubscription | null }> {
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && Boolean(VAPID_KEY);
  if (!supported) return { state: isIOS() && !isInstalled() ? 'install' : 'unsupported', sub: null };
  if (Notification.permission === 'denied') return { state: 'denied', sub: null };
  const reg = await navigator.serviceWorker.register('/admin-sw.js', { scope: '/admin/', updateViaCache: 'none' });
  const sub = await reg.pushManager.getSubscription();
  return { state: sub ? 'on' : 'off', sub };
}

export default function OrderAlerts() {
  const { user } = useAuth();
  const { toast } = useFeedback();
  const [state, setState] = useState<State>('loading');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const subRef = useRef<PushSubscription | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    detect()
      .then(({ state, sub }) => { subRef.current = sub; setState(state); })
      .catch(() => setState('unsupported'));
  }, []);

  // Close the panel on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!wrapRef.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const sendTest = useCallback(async () => {
    const res = await fetch('/api/push/test', { method: 'POST' });
    const body = await res.json().catch(() => ({}));
    if (res.ok) toast('Test alert sent — check your notifications');
    else toast(body.error || 'Couldn’t send a test alert', 'error');
  }, [toast]);

  const turnOn = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'off');
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToBytes(VAPID_KEY) });
      const json = sub.toJSON();
      const { error } = await getClient().from('push_subscriptions').upsert({
        user_id: user.id,
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh,
        auth: json.keys?.auth,
        device: isIOS() ? 'iPhone / iPad' : navigator.userAgent.slice(0, 120),
      }, { onConflict: 'endpoint' });
      if (error) {
        await sub.unsubscribe();
        throw error;
      }
      subRef.current = sub;
      setState('on');
      toast('Order alerts are on for this device');
      await sendTest();
    } catch (err) {
      console.error(err);
      toast('Couldn’t turn on alerts. Has app/supabase_push_alerts.sql been run?', 'error');
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async () => {
    setBusy(true);
    try {
      const sub = subRef.current;
      if (sub) {
        await getClient().from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        await sub.unsubscribe();
      }
      subRef.current = null;
      setState('off');
      toast('Order alerts turned off for this device');
    } finally {
      setBusy(false);
    }
  };

  if (state === 'loading') return null;

  return (
    <div className="adm-alerts" ref={wrapRef}>
      <button
        type="button"
        className="adm-alerts-btn"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-label={state === 'on' ? 'Order alerts: on' : 'Order alerts: off'}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {state !== 'on' && <span className="adm-alerts-dot" aria-hidden="true" />}
      </button>

      {open && (
        <div className="adm-alerts-panel" role="dialog" aria-label="Order alerts">
          <strong className="adm-alerts-title">Order alerts</strong>

          {state === 'on' && (
            <>
              <p>This device gets a notification when an order is paid or a customer asks to cancel.</p>
              <div className="adm-alerts-actions">
                <button type="button" className="adm-btn adm-btn-sm" onClick={sendTest} disabled={busy}>Send test alert</button>
                <button type="button" className="adm-btn adm-btn-sm" onClick={turnOff} disabled={busy}>Turn off</button>
              </div>
            </>
          )}

          {state === 'off' && (
            <>
              <p>Get a notification on this device the moment an order is paid — even when the app is closed.</p>
              <button type="button" className="adm-btn adm-btn-primary adm-btn-sm" onClick={turnOn} disabled={busy}>
                {busy ? 'Turning on…' : 'Turn on order alerts'}
              </button>
            </>
          )}

          {state === 'install' && (
            <>
              <p>On iPhone, alerts work once the admin is on your home screen:</p>
              <ol className="adm-alerts-steps">
                <li>Tap the <strong>Share</strong> button in Safari</li>
                <li>Choose <strong>Add to Home Screen</strong>, then <strong>Add</strong></li>
                <li>Open <strong>stress_d Admin</strong> from your home screen, sign in, and tap this bell again</li>
              </ol>
              <p className="adm-hint">Needs iOS 16.4 or newer.</p>
            </>
          )}

          {state === 'denied' && (
            <p>Notifications are blocked for this app. Allow them in your phone or browser settings (on iPhone: Settings → Notifications → stress_d Admin), then reopen the app.</p>
          )}

          {state === 'unsupported' && (
            <p>This browser can’t receive order alerts. Use Chrome, Edge, Firefox or Safari — or the admin app on your iPhone home screen.</p>
          )}
        </div>
      )}
    </div>
  );
}
