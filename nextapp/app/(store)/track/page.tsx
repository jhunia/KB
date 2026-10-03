'use client';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { db } from '@/lib/db';
import { useAuth } from '@/context/AuthContext';
import OrderCard from '@/components/orders/OrderCard';
import { getGuestOrders, rememberGuestOrder, forgetGuestOrders } from '@/lib/guestOrders';
import { SITE, storeWhatsAppLink } from '@/lib/site';
import type { Order } from '@/lib/types';

/* Order tracking for guests: order number + the email or phone number used at checkout. Orders placed as a guest on
   this device are listed automatically. Signed-in customers see everything in My Account. */

/** All orders for the given proofs (order number + email/phone); "verified" = the order numbers that matched */
async function lookup(orders: { id: string; contact: string }[]): Promise<{ orders: Order[]; verified: string[] }> {
  if (!orders.length) return { orders: [], verified: [] };
  const res = await fetch('/api/orders/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orders }),
  });
  if (!res.ok) throw new Error('lookup failed');
  const body = await res.json();
  return { orders: (body.orders || []) as Order[], verified: (body.verified || []) as string[] };
}

export default function TrackPage() {
  return (
    <Suspense fallback={<main className="profile-main"><div className="container"><p style={{ color: 'var(--gray-600)' }}>Loading…</p></div></main>}>
      <TrackInner />
    </Suspense>
  );
}

function TrackInner() {
  const params = useSearchParams();
  const { user } = useAuth();
  const [orderId, setOrderId] = useState(params.get('order') || '');
  const [contact, setContact] = useState('');
  const [orders, setOrders] = useState<Order[] | null>(null); // null = still loading this device's orders
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const highlight = params.get('order');

  // Orders remembered on this device (product details come from the shared product list)
  useEffect(() => {
    const saved = getGuestOrders();
    Promise.all([db.init(), lookup(saved)])
      .then(([, { orders: found }]) => {
        setOrders(found);
        // Opened from the order confirmation: the order is already listed, so show it instead of the form
        if (highlight && found.some(o => o.id === highlight)) {
          setOrderId('');
          requestAnimationFrame(() => document.getElementById(`order-${highlight}`)?.scrollIntoView({ block: 'center' }));
        }
      })
      .catch(() => setOrders([]));
  }, [highlight]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSearching(true);
    try {
      const { orders: found, verified } = await lookup([{ id: orderId, contact }]);
      if (!verified.length) {
        setError('We couldn’t find an order with those details. Check the order number, and use the same email or phone number you gave at checkout.');
        return;
      }
      // Remember the proof on this device, so next time all their orders load by themselves
      rememberGuestOrder({ id: verified[0], contact: contact.trim().toLowerCase() });
      setOrders(prev => {
        const ids = new Set(found.map(o => o.id));
        return [...found, ...(prev || []).filter(o => !ids.has(o.id))].sort((a, b) => b.date.localeCompare(a.date));
      });
      setOrderId('');
      setContact('');
      requestAnimationFrame(() => document.getElementById(`order-${verified[0]}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    } catch {
      setError('Something went wrong. Please try again in a moment.');
    } finally {
      setSearching(false);
    }
  };

  const clearDevice = () => {
    forgetGuestOrders();
    setOrders([]);
  };

  return (
    <main className="profile-main">
      <div className="container">
        <h1 style={{ fontSize: 'clamp(28px, 5vw, 40px)', fontWeight: 800, marginBottom: 8 }}>Track your order</h1>
        <p style={{ color: 'var(--gray-600)', marginBottom: 24, maxWidth: 560 }}>
          {user
            ? <>You&apos;re signed in — all your orders are in <Link href="/profile" className="legal-link">My Account</Link>. You can still look up a guest order below.</>
            : <>Enter any one of your order numbers plus the email or phone number you used at checkout. We&apos;ll show all your orders placed with it.</>}
        </p>

        <form className="track-form" onSubmit={handleSubmit}>
          <div className="track-field">
            <label htmlFor="track-order">Order number</label>
            <input id="track-order" value={orderId} onChange={e => setOrderId(e.target.value)} placeholder="e.g. SD-7K3Q9M2X" autoComplete="off" required />
          </div>
          <div className="track-field">
            <label htmlFor="track-contact">Email or phone number</label>
            <input id="track-contact" value={contact} onChange={e => setContact(e.target.value)} placeholder="you@example.com or 024 123 4567" autoComplete="email" autoCapitalize="none" spellCheck={false} required />
          </div>
          <button type="submit" className="btn btn-primary" disabled={searching}>{searching ? 'Finding…' : 'Find order'}</button>
        </form>
        {error && <p className="track-error" role="alert">{error}</p>}

        {orders === null ? (
          <p style={{ color: 'var(--gray-600)', marginTop: 32 }}>Loading…</p>
        ) : orders.length > 0 && (
          <>
            <div className="track-list-head">
              <h2>Your orders ({orders.length})</h2>
              <button type="button" className="track-forget" onClick={clearDevice}>Forget orders on this device</button>
            </div>
            <div className="orders-list">
              {orders.map(order => <OrderCard key={order.id} order={order} highlight={order.id === highlight} />)}
            </div>
          </>
        )}

        <div className="track-help">
          {!user && (
            <p>
              <strong>Want all your orders in one place?</strong>{' '}
              <Link href="/auth?signup=true" className="legal-link">Create an account</Link> with the same email —
              orders you placed as a guest will show up in My Account automatically.
            </p>
          )}
          <p>
            Need to change or cancel an order?{' '}
            {SITE.whatsapp
              ? <a href={storeWhatsAppLink('Hi stress_d, I need help with my order.')} target="_blank" rel="noopener noreferrer" className="legal-link">Message us on WhatsApp</a>
              : <Link href="/support" className="legal-link">Contact us</Link>}
            {' '}with your order number.
          </p>
        </div>
      </div>
    </main>
  );
}
