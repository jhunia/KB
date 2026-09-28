'use client';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { db } from '@/lib/db';
import { useAuth } from '@/context/AuthContext';
import type { Order } from '@/lib/types';
import Image from 'next/image';
import { colorName } from '@/lib/colors';

// What customers see (the admin uses its own, more operational wording)
const CUSTOMER_STATUS: Record<string, { label: string; tone: string }> = {
  pending_payment: { label: 'Awaiting payment', tone: 'pending' },
  paid: { label: 'Order received', tone: 'processing' },
  Processing: { label: 'Being prepared', tone: 'processing' },
  Shipped: { label: 'On its way', tone: 'shipped' },
  Delivered: { label: 'Delivered', tone: 'delivered' },
  'Cancellation Requested': { label: 'Cancellation requested', tone: 'pending' },
  Cancelled: { label: 'Cancelled', tone: 'cancelled' },
  payment_failed: { label: 'Payment failed', tone: 'cancelled' },
};
const STEPS = ['Order received', 'Being prepared', 'On its way', 'Delivered'];
const STEP_INDEX: Record<string, number> = { paid: 0, Processing: 1, Shipped: 2, Delivered: 3 };
// Customers can ask to cancel until the order has been shipped
const CANCELLABLE = ['pending_payment', 'paid', 'Processing'];

const money = (n: number) => `GH₵${n.toFixed(2)}`;

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
            <h1>{user.name || 'KB Member'}</h1>
            <p>{user.email}</p>
            {user.phone && <p>{user.phone}</p>}
          </div>
          <button className="btn btn-outline btn-sm" style={{ marginLeft: 'auto' }} onClick={handleLogout}>Log Out</button>
        </div>

        {params.get('welcome') && (
          <div className="profile-thanks" role="status">
            <strong>🎉 Welcome to KB.ENT — your email is confirmed and you&apos;re signed in.</strong>
            <span>Your orders and wishlist will be saved to this account.</span>
          </div>
        )}

        {justPaid && orders?.some(o => o.id === justPaid) && (
          <div className="profile-thanks" role="status">
            <strong>🎉 Thank you — your payment was received.</strong>
            <span>We&apos;ll call you to arrange delivery. You can follow your order below.</span>
          </div>
        )}

        <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 24 }}>Your Orders</h2>

        {orders === null ? (
          <p style={{ color: 'var(--gray-600)' }}>Loading orders…</p>
        ) : orders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <p style={{ color: 'var(--gray-600)', marginBottom: 24, fontSize: 16 }}>You haven&apos;t placed any orders yet.</p>
            <Link href="/category" className="btn btn-primary">Start Shopping</Link>
          </div>
        ) : (
          <div className="orders-list">
            {orders.map(order => {
              const status = CUSTOMER_STATUS[order.status] || { label: order.status, tone: '' };
              const step = STEP_INDEX[order.status];
              return (
                <div key={order.id} id={`order-${order.id}`} className={`order-card${order.id === justPaid ? ' order-card-highlight' : ''}`}>
                  <div className="order-header">
                    <div>
                      <div className="order-id">{order.id}</div>
                      <div className="order-date">
                        {new Date(order.date).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <span className={`order-status ${status.tone}`}>{status.label}</span>
                      {CANCELLABLE.includes(order.status) && confirmCancel !== order.id && (
                        <button type="button" className="order-cancel-btn" onClick={() => { setConfirmCancel(order.id); setNotice(null); }}>
                          Cancel order
                        </button>
                      )}
                    </div>
                  </div>

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

                  {step !== undefined && (
                    <ol className="order-progress" aria-label={`Order progress: ${status.label}`}>
                      {STEPS.map((s, i) => (
                        <li key={s} className={i <= step ? 'done' : ''} aria-current={i === step ? 'step' : undefined}>{s}</li>
                      ))}
                    </ol>
                  )}

                  <div className="order-items">
                    {order.items.map((item, i) => {
                      const product = db.getProductById(item.productId);
                      const unit = item.unitPrice ?? product?.price;
                      return (
                        <div key={i} className="order-item">
                          {product?.images?.[0] && (
                            <Image src={product.images[0]} alt="" width={120} height={120} className="order-item-img" />
                          )}
                          <div className="order-item-info">
                            {product ? <Link href={`/product/${product.id}`} className="order-item-name">{product.name}</Link> : <div className="order-item-name">Item no longer available</div>}
                            <div className="order-item-meta">
                              {[item.color && colorName(item.color), item.size && `Size ${item.size}`, `Qty ${item.quantity}`].filter(Boolean).join(' · ')}
                            </div>
                          </div>
                          <div style={{ fontWeight: 700, fontSize: 16 }}>{unit !== undefined ? money(unit * item.quantity) : '—'}</div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="order-footer">
                    {!!order.discount && <span className="order-footer-note">Discount −{money(order.discount)}</span>}
                    <span>Paid online: {money(order.total)}</span>
                    <span className="order-footer-note">
                      {order.deliveryFee ? `Delivery ${money(order.deliveryFee)} (paid separately)` : 'Delivery fee confirmed by phone'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
