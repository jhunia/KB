'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/db';
import { useAuth } from '@/context/AuthContext';
import type { Order } from '@/lib/types';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      await db.init();
      const u = db.getCurrentUser();
      if (!u) { router.push('/auth'); return; }
      const userOrders = await db.getUserOrders();
      setOrders(userOrders);
      setLoading(false);
    })();
  }, [router]);

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  const handleCancelOrder = async (orderId: string) => {
    const ok = await db.requestCancellation(orderId);
    if (ok) {
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'Cancellation Requested' } : o));
      alert('Cancellation requested successfully!');
    } else {
      alert('This order cannot be cancelled (already shipped or delivered).');
    }
  };

  const statusClass = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('processing') || s.includes('paid') || s.includes('pending')) return 'processing';
    if (s.includes('ship')) return 'shipped';
    if (s.includes('deliver')) return 'delivered';
    return '';
  };

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  if (!user) return null;

  return (
    <main className="profile-main">
      <div className="container">
        {/* Profile Header */}
        <div className="profile-header">
          <div className="profile-avatar">{getInitials(user.name || user.email)}</div>
          <div className="profile-info">
            <h1>{user.name || 'KB Member'}</h1>
            <p>{user.email}</p>
            {user.phone && <p>{user.phone}</p>}
          </div>
          <button
            className="btn btn-outline btn-sm"
            style={{ marginLeft: 'auto' }}
            onClick={handleLogout}
          >
            Log Out
          </button>
        </div>

        {/* Orders */}
        <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 24 }}>Your Orders</h2>

        {loading ? (
          <p style={{ color: 'var(--gray-600)' }}>Loading orders…</p>
        ) : orders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <p style={{ color: 'var(--gray-600)', marginBottom: 24, fontSize: 16 }}>You haven&apos;t placed any orders yet.</p>
            <Link href="/category" className="btn btn-primary">Start Shopping</Link>
          </div>
        ) : (
          <div className="orders-list">
            {orders.map(order => (
              <div key={order.id} className="order-card">
                <div className="order-header">
                  <div>
                    <div className="order-id">{order.id}</div>
                    <div className="order-date">
                      {new Date(order.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span className={`order-status ${statusClass(order.status)}`}>{order.status}</span>
                    {['Processing', 'paid', 'pending_payment'].includes(order.status) && (
                      <button
                        onClick={() => handleCancelOrder(order.id)}
                        style={{ padding: '6px 12px', borderRadius: 99, fontSize: 12, border: '1px solid var(--danger)', color: 'var(--danger)', background: 'none', cursor: 'pointer', fontWeight: 600 }}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>

                <div className="order-items">
                  {order.items.map((item, i) => {
                    const product = db.getProductById(item.productId);
                    return (
                      <div key={i} className="order-item">
                        {product?.images?.[0] && (
                          <img src={product.images[0]} alt={product?.name} className="order-item-img" />
                        )}
                        <div className="order-item-info">
                          <div className="order-item-name">{product?.name || `Product #${item.productId}`}</div>
                          <div className="order-item-meta">Size: {item.size} | Color: {item.color} | Qty: {item.quantity}</div>
                        </div>
                        <div style={{ fontWeight: 700, fontSize: 16 }}>
                          GH₵{product ? (product.price * item.quantity).toFixed(2) : '—'}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="order-footer">
                  Total: GH₵{order.total.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
