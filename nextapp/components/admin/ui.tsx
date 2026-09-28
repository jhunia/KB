'use client';
/* Small shared building blocks for admin pages */
import Link from 'next/link';
import type { ReactNode } from 'react';
import { statusLabel } from '@/lib/admin';

const STATUS_TONE: Record<string, string> = {
  pending_payment: 'amber', paid: 'blue', Processing: 'indigo', Shipped: 'purple',
  Delivered: 'green', 'Cancellation Requested': 'amber', Cancelled: 'red', payment_failed: 'red',
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={`adm-badge adm-tone-${STATUS_TONE[status] || 'gray'}`}>{statusLabel(status)}</span>;
}

export function Badge({ tone = 'gray', children }: { tone?: string; children: ReactNode }) {
  return <span className={`adm-badge adm-tone-${tone}`}>{children}</span>;
}

export function PageHeader({ title, subtitle, actions, back }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="adm-page-header">
      <div style={{ minWidth: 0 }}>
        {back && <Link href={back.href} className="adm-back">← {back.label}</Link>}
        <h1>{title}</h1>
        {subtitle && <p className="adm-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="adm-page-actions">{actions}</div>}
    </div>
  );
}

export function Card({ title, actions, children, className = '' }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`adm-card ${className}`}>
      {(title || actions) && (
        <div className="adm-card-head">
          {title && <h2>{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function StatCard({ label, value, hint, href, tone }: { label: string; value: ReactNode; hint?: ReactNode; href?: string; tone?: 'amber' | 'red' }) {
  const body = (
    <>
      <div className="adm-stat-label">{label}</div>
      <div className="adm-stat-value">{value}</div>
      {hint && <div className="adm-stat-hint">{hint}</div>}
    </>
  );
  const cls = `adm-card adm-stat${tone ? ` adm-stat-${tone}` : ''}`;
  return href ? <Link href={href} className={cls}>{body}</Link> : <div className={cls}>{body}</div>;
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="adm-empty">
      <strong>{title}</strong>
      {children && <div>{children}</div>}
    </div>
  );
}

export function SkeletonRows({ rows = 6 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => <div key={i} className="adm-skeleton-row skeleton" />)}
    </div>
  );
}

export function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <nav className="adm-pagination" aria-label="Pagination">
      <span>{from}–{to} of {total}</span>
      <div>
        <button type="button" className="adm-btn adm-btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>← Prev</button>
        <span className="adm-page-num">Page {page} of {pages}</span>
        <button type="button" className="adm-btn adm-btn-sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next →</button>
      </div>
    </nav>
  );
}

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="adm-search">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
      <input type="search" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
    </div>
  );
}
