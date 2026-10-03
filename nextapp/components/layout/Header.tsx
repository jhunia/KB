'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef, useSyncExternalStore } from 'react';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import Logo from '@/components/ui/Logo';

// Whether the top banner was dismissed lives in localStorage; read it as an
// external store so SSR renders the banner and the client hides it if closed.
const BANNER_KEY = 'kb_banner_closed';
const BANNER_EVENT = 'kb-banner-change';
const subscribeBanner = (onChange: () => void) => {
  window.addEventListener(BANNER_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(BANNER_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
};
const isBannerOpen = () => {
  try { return localStorage.getItem(BANNER_KEY) !== 'true'; } catch { return true; }
};

export default function Header() {
  const { cartCount, openDrawer } = useCart();
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const showBanner = useSyncExternalStore(subscribeBanner, isBannerOpen, () => true);
  const [searchVal, setSearchVal] = useState('');
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false); // guests: Log in / Create account / Track an order
  const accountRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const navRef = useRef<HTMLElement>(null);

  const closeBanner = () => {
    try { localStorage.setItem(BANNER_KEY, 'true'); } catch {}
    window.dispatchEvent(new Event(BANNER_EVENT));
  };

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchVal.trim()) {
      router.push(`/category?search=${encodeURIComponent(searchVal.trim())}`);
    }
  };

  const handleAccountClick = () => {
    if (user) {
      router.push(user.role === 'admin' ? '/admin' : '/profile');
    } else {
      setAccountOpen(v => !v);
    }
  };

  // Close the guest account menu on outside click / Escape
  useEffect(() => {
    if (!accountOpen) return;
    const onDown = (e: MouseEvent) => { if (!accountRef.current?.contains(e.target as Node)) setAccountOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setAccountOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [accountOpen]);

  // Close mobile nav on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (mobileOpen && navRef.current && !navRef.current.contains(e.target as Node)) {
        setMobileOpen(false);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [mobileOpen]);

  return (
    <>
      {showBanner && (
        <div className="top-banner" id="topBanner">
          <p>Sign up and get 20% off to your first order. <Link href="/auth">Sign Up Now</Link></p>
          <button className="banner-close" onClick={closeBanner} aria-label="Close banner">✕</button>
        </div>
      )}

      <header className="header">
        <div className="header-inner">
          <button
            className={`mobile-menu-btn${mobileOpen ? ' active' : ''}`}
            id="mobileMenuBtn"
            aria-label="Open menu"
            onClick={() => setMobileOpen(v => !v)}
          >
            <span /><span /><span />
          </button>

          <Link href="/" className="logo" aria-label="stress_d home"><Logo /></Link>

          <nav className={`nav-links${mobileOpen ? ' mobile-open' : ''}`} ref={navRef} id="navLinks">
            <Link href="/category" onClick={() => setMobileOpen(false)}>Shop</Link>
            <Link href="/category?filter=sale" onClick={() => setMobileOpen(false)}>On Sale</Link>
            <Link href="/category?filter=new" onClick={() => setMobileOpen(false)}>New Arrivals</Link>
            <Link href="/category?filter=brands" onClick={() => setMobileOpen(false)}>Brands</Link>
            <Link href="/track" className="nav-mobile-only" onClick={() => setMobileOpen(false)}>Track order</Link>
          </nav>

          <div className="header-search" role="search">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="search"
              placeholder="Search for products..."
              aria-label="Search products"
              id="searchInput"
              value={searchVal}
              onChange={e => setSearchVal(e.target.value)}
              onKeyDown={handleSearch}
            />
          </div>

          <div className="header-icons">
            <button
              className="mobile-search-btn"
              onClick={() => setMobileSearchOpen(v => !v)}
              aria-label={mobileSearchOpen ? 'Close search' : 'Search products'}
              aria-expanded={mobileSearchOpen}
              aria-controls="mobileSearch"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </button>
            <button onClick={openDrawer} aria-label="Open cart" id="cartToggle">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" />
                <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
              </svg>
              <span className={`cart-badge${cartCount === 0 ? ' hidden' : ''}`} id="cartBadge">{cartCount}</span>
            </button>
            <div className="account-menu-wrap" ref={accountRef}>
              <button
                onClick={handleAccountClick}
                aria-label={user ? 'My account' : 'Account'}
                aria-haspopup={user ? undefined : 'menu'}
                aria-expanded={user ? undefined : accountOpen}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </button>
              {!user && accountOpen && (
                <div className="account-menu" role="menu">
                  <Link href="/auth" role="menuitem" onClick={() => setAccountOpen(false)}>Log in</Link>
                  <Link href="/auth?signup=true" role="menuitem" onClick={() => setAccountOpen(false)}>Create account</Link>
                  <hr />
                  <Link href="/track" role="menuitem" onClick={() => setAccountOpen(false)}>Track an order</Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {mobileSearchOpen && (
          <div className="mobile-search-bar" id="mobileSearch" role="search">
            <input
              type="search"
              placeholder="Search for products..."
              aria-label="Search products"
              autoFocus
              value={searchVal}
              onChange={e => setSearchVal(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Escape') setMobileSearchOpen(false);
                if (e.key === 'Enter' && searchVal.trim()) setMobileSearchOpen(false);
                handleSearch(e);
              }}
            />
          </div>
        )}
      </header>
    </>
  );
}
