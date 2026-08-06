'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/db';

export default function Header() {
  const { cartCount, openDrawer } = useCart();
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showBanner, setShowBanner] = useState(true);
  const [searchVal, setSearchVal] = useState('');
  const router = useRouter();
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setShowBanner(localStorage.getItem('kb_banner_closed') !== 'true');
    }
  }, []);

  const closeBanner = () => {
    setShowBanner(false);
    localStorage.setItem('kb_banner_closed', 'true');
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
      router.push('/auth');
    }
  };

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

          <Link href="/" className="logo">KB.ENT</Link>

          <nav className={`nav-links${mobileOpen ? ' mobile-open' : ''}`} ref={navRef} id="navLinks">
            <Link href="/category" onClick={() => setMobileOpen(false)}>Shop</Link>
            <Link href="/category?filter=sale" onClick={() => setMobileOpen(false)}>On Sale</Link>
            <Link href="/category?filter=new" onClick={() => setMobileOpen(false)}>New Arrivals</Link>
            <Link href="/category?filter=brands" onClick={() => setMobileOpen(false)}>Brands</Link>
          </nav>

          <div className="header-search">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="text"
              placeholder="Search for products..."
              id="searchInput"
              value={searchVal}
              onChange={e => setSearchVal(e.target.value)}
              onKeyDown={handleSearch}
            />
          </div>

          <div className="header-icons">
            <button onClick={openDrawer} aria-label="Open cart" id="cartToggle">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" />
                <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
              </svg>
              <span className={`cart-badge${cartCount === 0 ? ' hidden' : ''}`} id="cartBadge">{cartCount}</span>
            </button>
            <button onClick={handleAccountClick} aria-label="Account">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </button>
          </div>
        </div>
      </header>
    </>
  );
}
