'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { db } from '@/lib/db';
import { colorName } from '@/lib/colors';
import {
  getOrder, setOrderStatus, updateOrderDetails, deleteOrder,
  ORDER_STATUSES, NEXT_STEP, statusLabel, whatsappNumber, fmtMoney, fmtDateTime, type AdminOrder,
} from '@/lib/admin';
import { PageHeader, Card, StatusBadge, SkeletonRows, EmptyState } from '@/components/admin/ui';
import { useFeedback } from '@/components/admin/Feedback';

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const orderId = decodeURIComponent(id);
  const router = useRouter();
  const { toast, confirm } = useFeedback();

  const [order, setOrder] = useState<AdminOrder | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [deliveryFee, setDeliveryFee] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    let cancelled = false;
    db.init()
      .then(() => getOrder(orderId))
      .then(o => {
        if (cancelled) return;
        setOrder(o);
        if (o) {
          setDeliveryFee(o.deliveryFee ? String(o.deliveryFee) : '');
          setNotes(o.adminNotes || '');
        }
      })
      .catch(e => {
        if (cancelled) return;
        toast(e instanceof Error ? e.message : 'Could not load the order.', 'error');
        setOrder(null);
      });
    return () => { cancelled = true; };
  }, [orderId, toast]);

  const changeStatus = async (status: string) => {
    if (!order || status === order.status) return;
    if (status === 'Cancelled') {
      const paid = !['pending_payment', 'payment_failed'].includes(order.status);
      const ok = await confirm({
        title: 'Cancel this order?',
        message: paid ? 'The customer has paid — remember to refund them in your Paystack dashboard.' : undefined,
        confirmLabel: 'Cancel order', danger: true,
      });
      if (!ok) return;
    }
    setBusy(true);
    try {
      await setOrderStatus(order.id, status);
      setOrder({ ...order, status });
      toast(`Order marked as ${statusLabel(status)}.`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not update the status.', 'error');
    }
    setBusy(false);
  };

  const saveDetails = async () => {
    if (!order) return;
    const fee = deliveryFee.trim() === '' ? 0 : Number(deliveryFee);
    if (!Number.isFinite(fee) || fee < 0) { toast('Enter a valid delivery fee.', 'error'); return; }
    setBusy(true);
    try {
      await updateOrderDetails(order.id, { deliveryFee: fee, adminNotes: notes });
      setOrder({ ...order, deliveryFee: fee, adminNotes: notes });
      toast('Saved.');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save.', 'error');
    }
    setBusy(false);
  };

  // Re-asks Paystack about an unpaid order and marks it paid if Paystack confirms the payment
  const checkPayment = async () => {
    if (!order) return;
    setBusy(true);
    try {
      const res = await fetch('/api/paystack/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId: order.id }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.ok) {
        setOrder({ ...order, status: body.status });
        toast(body.already ? `Already ${statusLabel(body.status)}.` : 'Payment confirmed by Paystack — order marked as paid.');
      } else if (res.status === 404) {
        toast('Paystack has no payment for this order — the customer didn’t finish paying.', 'info');
      } else if (res.status === 503) {
        toast('Payment checks aren’t set up on the server yet (missing keys).', 'error');
      } else {
        toast(`Not marked as paid: ${body.reason || 'Paystack didn’t confirm the payment.'}`, 'error');
      }
    } catch {
      toast('Couldn’t reach the server. Try again.', 'error');
    }
    setBusy(false);
  };

  const remove = async () => {
    if (!order) return;
    const ok = await confirm({
      title: 'Delete this order permanently?',
      message: 'It disappears from sales figures and the customer’s order history. To stop an order, cancel it instead.',
      confirmLabel: 'Delete order', danger: true,
    });
    if (!ok) return;
    try {
      await deleteOrder(order.id);
      toast('Order deleted.');
      router.replace('/admin/orders');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not delete the order.', 'error');
    }
  };

  if (order === undefined) return <SkeletonRows rows={8} />;
  if (order === null) {
    return (
      <Card>
        <EmptyState title="Order not found">
          <Link className="adm-link" href="/admin/orders">Back to orders</Link>
        </EmptyState>
      </Card>
    );
  }

  const next = NEXT_STEP[order.status];
  const c = order.customer;
  const itemsTotal = order.items.reduce((s, i) => s + (i.unitPrice ?? db.getProductById(i.productId)?.price ?? 0) * i.quantity, 0);
  const anyCurrentPrice = order.items.some(i => i.unitPrice === undefined);
  const dirty = (deliveryFee || '0') !== String(order.deliveryFee || 0) || notes !== (order.adminNotes || '');

  return (
    <>
      <PageHeader
        back={{ href: '/admin/orders', label: 'Orders' }}
        title={<span className="adm-mono" style={{ fontSize: 'inherit', fontFamily: 'inherit' }}>{order.id}</span>}
        subtitle={<>Placed {fmtDateTime(order.date)} · <StatusBadge status={order.status} /></>}
        actions={
          <>
            {order.status === 'Cancellation Requested' && (
              <button type="button" className="adm-btn adm-btn-danger" disabled={busy} onClick={() => changeStatus('Cancelled')}>Approve cancellation</button>
            )}
            {['pending_payment', 'payment_failed'].includes(order.status) && (
              <button type="button" className="adm-btn" disabled={busy} onClick={checkPayment}>Check payment with Paystack</button>
            )}
            {next && <button type="button" className="adm-btn adm-btn-primary" disabled={busy} onClick={() => changeStatus(next.status)}>{next.label}</button>}
          </>
        }
      />

      <div className="adm-grid adm-grid-main">
        <div className="adm-stack">
          <Card title={`Items (${order.items.reduce((s, i) => s + i.quantity, 0)})`}>
            <ul className="adm-line-items">
              {order.items.map((item, i) => {
                const p = db.getProductById(item.productId);
                const unit = item.unitPrice ?? p?.price ?? 0;
                return (
                  <li key={i}>
                    {p?.images[0] ? <Image src={p.images[0]} alt="" width={88} height={88} className="adm-thumb" /> : <div className="adm-thumb" />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {p ? <Link href={`/admin/products/${p.id}`} className="adm-link">{p.name}</Link> : <strong>Product #{item.productId} (deleted)</strong>}
                      <div className="adm-muted adm-small">
                        {[item.color && colorName(item.color), item.size && `Size ${item.size}`].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    <div className="adm-muted adm-small" style={{ whiteSpace: 'nowrap' }}>{item.quantity} × {fmtMoney(unit)}</div>
                    <strong style={{ whiteSpace: 'nowrap' }}>{fmtMoney(unit * item.quantity)}</strong>
                  </li>
                );
              })}
            </ul>
            {anyCurrentPrice && <p className="adm-muted adm-small" style={{ marginTop: 8 }}>Some prices are today&apos;s product price — this order was placed before prices were recorded at checkout.</p>}
          </Card>

          <Card title="Payment">
            <dl className="adm-dl">
              <dt>Items</dt><dd>{fmtMoney(order.subtotal ?? itemsTotal)}</dd>
              {!!order.discount && <><dt>Discount</dt><dd>−{fmtMoney(order.discount)}</dd></>}
              <dt className="total">Paid online</dt><dd className="total">{fmtMoney(order.total)}</dd>
              <dt>Delivery fee</dt><dd>{order.deliveryFee ? `${fmtMoney(order.deliveryFee)} (collected separately)` : 'Not recorded yet'}</dd>
              <dt>Method</dt><dd style={{ textTransform: 'capitalize' }}>{order.paymentMethod || '—'}</dd>
              <dt>Paystack ref</dt><dd className="adm-mono">{order.paymentRef || '—'}</dd>
            </dl>
          </Card>

          <Card title="Delivery fee & notes">
            <div className="adm-form-grid">
              <div className="adm-field">
                <label htmlFor="fee">Delivery fee agreed with customer</label>
                <div className="adm-prefix"><span>GH₵</span><input id="fee" className="adm-input" type="number" min="0" step="0.01" inputMode="decimal" value={deliveryFee} onChange={e => setDeliveryFee(e.target.value)} placeholder="0.00" /></div>
                <span className="adm-hint">Record what you quoted on the phone. It isn&apos;t charged online.</span>
              </div>
              <div className="adm-field adm-span-2">
                <label htmlFor="notes">Private notes</label>
                <textarea id="notes" className="adm-textarea" value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Customer prefers evening delivery; rider: Kwame" />
                <span className="adm-hint">Only admins can see these.</span>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
              <button type="button" className="adm-btn adm-btn-primary" disabled={busy || !dirty} onClick={saveDetails}>Save</button>
            </div>
          </Card>
        </div>

        <div className="adm-stack">
          <Card title="Customer">
            <strong>{c.name}</strong>
            <div className="adm-muted" style={{ marginTop: 4, overflowWrap: 'anywhere' }}>{c.email}</div>
            <div className="adm-muted">{c.phone}</div>
            {c.address && <p style={{ marginTop: 10 }}>{c.address}</p>}
            <div className="adm-contact-actions">
              {c.phone && <a className="adm-btn adm-btn-sm" href={`tel:${c.phone}`}>Call</a>}
              {c.phone && <a className="adm-btn adm-btn-sm" href={`https://wa.me/${whatsappNumber(c.phone)}?text=${encodeURIComponent(`Hi ${c.name?.split(' ')[0] || ''}, this is stress_d about your order ${order.id}.`)}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>}
              {c.email && <a className="adm-btn adm-btn-sm" href={`mailto:${c.email}?subject=${encodeURIComponent(`Your stress_d order ${order.id}`)}`}>Email</a>}
              {c.address && <a className="adm-btn adm-btn-sm" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.address)}`} target="_blank" rel="noopener noreferrer">Map</a>}
            </div>
            {c.email && (
              <Link className="adm-link adm-small" style={{ display: 'inline-block', marginTop: 12 }} href={`/admin/orders?view=all&q=${encodeURIComponent(c.email)}`}>
                All orders from this customer →
              </Link>
            )}
          </Card>

          <Card title="Status">
            <div className="adm-field">
              <label htmlFor="status">Change status</label>
              <select id="status" className="adm-select" value={order.status} disabled={busy} onChange={e => changeStatus(e.target.value)}>
                {ORDER_STATUSES.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
              </select>
              <span className="adm-hint">Customers see this status in their account. Email updates start once the email functions are deployed.</span>
            </div>
          </Card>

          <Card title="Danger zone">
            <p className="adm-muted adm-small" style={{ marginBottom: 12 }}>Deleting removes the order completely. Cancel it instead unless it was a test.</p>
            <button type="button" className="adm-btn adm-btn-ghost-danger" onClick={remove}>Delete order</button>
          </Card>
        </div>
      </div>
    </>
  );
}
