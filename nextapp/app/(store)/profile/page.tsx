'use client';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { db } from '@/lib/db';
import { useAuth } from '@/context/AuthContext';
import type { Order } from '@/lib/types';
import OrderCard from '@/components/orders/OrderCard';
import { CANCELLABLE, UNPAID } from '@/lib/orderStatus';
import AccountDetails from '@/components/account/AccountDetails';

export default function ProfilePage() {
  return (
    <Suspense fallback={<main className="profile-main"><div className="container"><p style={{ color: 'var(--gray-600)' }}>Loading your account…</p></div></main>}>
      <ProfileInner />
    </Suspense>
  );
}

function ProfileInner() {
  const { user, initialized, logout } = useAuth();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ id: string; msg: string; tone: 'ok' | 'error' } | null>(null);
  const router = useRouter();
  const params = useSearchParams();
  const justPaid = params.get('order'); // set by checkout after a successful payment
  const tab = params.get('tab') === 'details' ? 'details' : 'orders';
  const switchTab = (t: 'orders' | 'details') => router.replace(t === 'details' ? '/profile?tab=details' : '/profile', { scroll: false });

  useEffect(() => {
    if (!initialized) return;
    if (!user) { router.replace('/auth?redirect=/profile'); return; }
    let cancelled = false;
    db.init().then(() => db.getUserOrders()).then(o => { if (!cancelled) setOrders(o); });
    return () => { cancelled = true; };
  }, [initialized, user, router]);

  // Bring the order that was just paid for into view
  useEffect(() => {
    if (justPaid && orders?.length) document.getElementById(`order-${justPaid}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [justPaid, orders]);

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  const handleCancelOrder = async (orderId: string) => {
    setConfirmCancel(null);
    const ok = await db.requestCancellation(orderId);
    if (ok) {
      setOrders(prev => prev?.map(o => o.id === orderId ? { ...o, status: 'Cancellation Requested' } : o) || null);
      setNotice({ id: orderId, msg: 'Cancellation requested. We’ll confirm by phone or email — if you’ve paid, your refund follows once it’s approved.', tone: 'ok' });
    } else {
      setNotice({ id: orderId, msg: 'This order can’t be cancelled any more because it has already shipped. Please contact us for help.', tone: 'error' });
    }
  };

  const getInitials = (name: string) => name.split(/\s+/).filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2);

  if (!initialized || !user) {
    return <main className="profile-main"><div className="container"><p style={{ color: 'var(--gray-600)' }}>Loading your account…</p></div></main>;
  }

  return (
    <main className="profile-main">
      <div className="container">
        <div className="profile-header">
          <div className="profile-avatar" aria-hidden="true">{getInitials(user.name || user.email)}</div>
          <div className="profile-info">
            <h1>{user.name || 'stress_d member'}</h1>
            <p>{user.email}</p>
            {user.phone && <p>{user.phone}</p>}
            {!user.phone && <button type="button" className="profile-add-phone" onClick={() => switchTab('details')}>+ Add your phone number</button>}
          </div>
          <button className="btn btn-outline btn-sm" style={{ marginLeft: 'auto' }} onClick={handleLogout}>Log Out</button>
        </div>

        {params.get('welcome') && (
          <div className="profile-thanks" role="status">
            <strong>🎉 Welcome to stress_d — your email is confirmed and you&apos;re signed in.</strong>
            <span>Your orders and wishlist will be saved to this account.</span>
          </div>
        )}

        {justPaid && orders?.some(o => o.id === justPaid) && tab === 'orders' && (
          UNPAID.includes(orders.find(o => o.id === justPaid)!.status) ? (
            <div className="profile-thanks pending" role="status">
              <strong>Thank you — we&apos;re confirming your payment with Paystack.</strong>
              <span>This usually takes a few seconds. Refresh the page if your order still says “Awaiting payment”.</span>
            </div>
          ) : (
            <div className="profile-thanks" role="status">
              <strong>🎉 Thank you — your payment was received.</strong>
              <span>We&apos;ll call you to arrange delivery. You can follow your order below.</span>
            </div>
          )
        )}

        <div className="account-tabs" role="tablist" aria-label="My account">
          <button type="button" role="tab" aria-selected={tab === 'orders'} className={tab === 'orders' ? 'active' : ''} onClick={() => switchTab('orders')}>
            Orders{orders?.length ? ` (${orders.length})` : ''}
          </button>
          <button type="button" role="tab" aria-selected={tab === 'details'} className={tab === 'details' ? 'active' : ''} onClick={() => switchTab('details')}>
            Account details
          </button>
        </div>

        {tab === 'details' ? <AccountDetails /> : <>

        {orders === null ? (
          <p style={{ color: 'var(--gray-600)' }}>Loading orders…</p>
        ) : orders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <p style={{ color: 'var(--gray-600)', marginBottom: 24, fontSize: 16 }}>You haven&apos;t placed any orders yet.</p>
            <Link href="/category" className="btn btn-primary">Start Shopping</Link>
          </div>
        ) : (
          <div className="orders-list">
            {orders.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                highlight={order.id === justPaid}
                actions={CANCELLABLE.includes(order.status) && confirmCancel !== order.id && (
                  <button type="button" className="order-cancel-btn" onClick={() => { setConfirmCancel(order.id); setNotice(null); }}>
                    Cancel order
                  </button>
                )}
              >
                {confirmCancel === order.id && (
                  <div className="order-confirm" role="alertdialog" aria-label="Confirm cancellation">
                    <span>Ask us to cancel this order?</span>
                    <div>
                      <button type="button" className="order-cancel-btn" onClick={() => handleCancelOrder(order.id)}>Yes, request cancellation</button>
                      <button type="button" className="order-keep-btn" onClick={() => setConfirmCancel(null)}>Keep order</button>
                    </div>
                  </div>
                )}
                {notice?.id === order.id && <p className={`order-notice ${notice.tone}`} role="status">{notice.msg}</p>}
              </OrderCard>
            ))}
          </div>
        )}
        </>}
      </div>
    </main>
  );
}
