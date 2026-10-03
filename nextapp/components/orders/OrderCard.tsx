'use client';
import Link from 'next/link';
import Image from 'next/image';
import { db } from '@/lib/db';
import { colorName } from '@/lib/colors';
import { CUSTOMER_STATUS, STEPS, STEP_INDEX, UNPAID, money } from '@/lib/orderStatus';
import type { Order } from '@/lib/types';

/** One order with its status, progress tracker and items — used by My Account and Track order */
export default function OrderCard({ order, highlight, actions, children }: {
  order: Order;
  highlight?: boolean;
  /** Buttons shown next to the status (e.g. "Cancel order") */
  actions?: React.ReactNode;
  /** Extra content under the header (confirmations, notices) */
  children?: React.ReactNode;
}) {
  const status = CUSTOMER_STATUS[order.status] || { label: order.status, tone: '' };
  const step = STEP_INDEX[order.status];

  return (
    <div id={`order-${order.id}`} className={`order-card${highlight ? ' order-card-highlight' : ''}`}>
      <div className="order-header">
        <div>
          <div className="order-id">{order.id}</div>
          <div className="order-date">
            {new Date(order.date).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span className={`order-status ${status.tone}`}>{status.label}</span>
          {actions}
        </div>
      </div>

      {children}

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
        <span>{UNPAID.includes(order.status) ? 'Order total' : 'Paid online'}: {money(order.total)}</span>
        <span className="order-footer-note">
          {order.deliveryFee ? `Delivery ${money(order.deliveryFee)} (paid separately)` : 'Delivery fee confirmed by phone'}
        </span>
      </div>
    </div>
  );
}
