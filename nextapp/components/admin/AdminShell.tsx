'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { FeedbackProvider } from '@/components/admin/Feedback';
import { orderViewCounts } from '@/lib/admin';
import Logo from '@/components/ui/Logo';
import OrderAlerts from '@/components/admin/OrderAlerts';

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: <><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></> },
  { href: '/admin/orders', label: 'Orders', icon: <><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></> },
  { href: '/admin/products', label: 'Products', icon: <><path d="m7.5 4.27 9 5.15" /><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /></> },
  { href: '/admin/customers', label: 'Customers', icon: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></> },
  { href: '/admin/promotions', label: 'Promotions', icon: <><path d="M12 2H2v10l9.29 9.29a1 1 0 0 0 1.42 0l8.58-8.58a1 1 0 0 0 0-1.42Z" /><circle cx="7" cy="7" r="1.5" /></> },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, initialized, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);
  const [needsAction, setNeedsAction] = useState(0);
  const isAdmin = user?.role === 'admin';

  // proxy.ts already blocks non-admins on the server; this covers sign-outs and role changes mid-session
  useEffect(() => {
    if (!initialized) return;
    if (!user) router.replace('/auth?redirect=/admin');
    else if (!isAdmin) router.replace('/');
  }, [initialized, user, isAdmin, router]);

  // Orders waiting on the admin (to fulfil + cancellation requests), refreshed on every page change
  useEffect(() => {
    if (!isAdmin) return;
    orderViewCounts().then(c => setNeedsAction((c.to_fulfil || 0) + (c.cancel_requests || 0))).catch(() => {});
  }, [isAdmin, pathname]);

  const isActive = (href: string) => (href === '/admin' ? pathname === '/admin' : pathname.startsWith(href));

  const handleLogout = async () => {
    await logout();
    router.replace('/auth');
  };

  if (!initialized || !isAdmin) {
    return <div className="adm-loading">Loading admin…</div>;
  }

  return (
    <FeedbackProvider>
      <div className={`adm-shell${navOpen ? ' nav-open' : ''}`}>
        <aside className="adm-sidebar" aria-label="Admin navigation">
          <Link href="/admin" className="adm-logo" onClick={() => setNavOpen(false)} aria-label="stress_d admin home"><Logo size={24} /><span className="adm-logo-tag">Admin</span></Link>
          <nav>
            {NAV.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={`adm-nav-link${isActive(item.href) ? ' active' : ''}`}
                aria-current={isActive(item.href) ? 'page' : undefined}
                onClick={() => setNavOpen(false)}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{item.icon}</svg>
                {item.label}
                {item.href === '/admin/orders' && needsAction > 0 && <span className="adm-nav-count" aria-label={`${needsAction} need attention`}>{needsAction}</span>}
              </Link>
            ))}
          </nav>
          <div className="adm-sidebar-foot">
            <Link href="/" className="adm-nav-link" target="_blank">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></svg>
              View store
            </Link>
          </div>
        </aside>
        {navOpen && <div className="adm-scrim" onClick={() => setNavOpen(false)} />}

        <div className="adm-main">
          <header className="adm-topbar">
            <button type="button" className="adm-menu-btn" onClick={() => setNavOpen(v => !v)} aria-label="Open navigation" aria-expanded={navOpen}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
            </button>
            <div className="adm-topbar-spacer" />
            <OrderAlerts />
            <span className="adm-user">{user.name || user.email}</span>
            <button type="button" className="adm-btn adm-btn-sm" onClick={handleLogout}>Log out</button>
          </header>
          <main className="adm-content">
            <Suspense fallback={<div className="adm-loading-inline">Loading…</div>}>{children}</Suspense>
          </main>
          {/* Phone: app-style tab bar (the sidebar drawer still holds everything) */}
          <nav className="adm-tabbar" aria-label="Admin sections">
            {NAV.map(item => (
              <Link key={item.href} href={item.href} className={isActive(item.href) ? 'active' : ''} aria-current={isActive(item.href) ? 'page' : undefined}>
                <span className="adm-tabbar-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{item.icon}</svg>
                  {item.href === '/admin/orders' && needsAction > 0 && <span className="adm-tabbar-count">{needsAction}</span>}
                </span>
                {item.label === 'Dashboard' ? 'Home' : item.label === 'Promotions' ? 'Promos' : item.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </FeedbackProvider>
  );
}
