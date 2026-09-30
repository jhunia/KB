import Link from 'next/link';
import { SITE } from '@/lib/site';
import Logo from '@/components/ui/Logo';

const SOCIAL_ICONS: Record<keyof typeof SITE.social, { label: string; path: string }> = {
  instagram: { label: 'Instagram', path: 'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z' },
  tiktok: { label: 'TikTok', path: 'M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z' },
  x: { label: 'X (Twitter)', path: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z' },
  facebook: { label: 'Facebook', path: 'M9 8h-3v4h3v12h5v-12h3.642l.358-4h-4v-1.667c0-.955.192-1.333 1.115-1.333h2.885v-5h-3.808c-3.596 0-5.192 1.583-5.192 4.615v3.385z' },
};

export default function Footer() {
  const year = new Date().getFullYear();
  const socials = (Object.keys(SITE.social) as (keyof typeof SITE.social)[]).filter(k => SITE.social[k]);

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <div className="footer-brand"><Logo variant="badge" size={104} /></div>
            <p className="footer-brand-desc">Clothes that suit your style and that you&apos;re proud to wear — for men and women.</p>
            {socials.length > 0 && (
              <div className="footer-social">
                {socials.map(k => (
                  <a key={k} href={SITE.social[k]} target="_blank" rel="noopener noreferrer" aria-label={`stress_d on ${SOCIAL_ICONS[k].label}`}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={SOCIAL_ICONS[k].path} /></svg>
                  </a>
                ))}
              </div>
            )}
          </div>
          <div>
            <h4 className="footer-col-title">Shop</h4>
            <ul className="footer-links">
              <li><Link href="/category">All products</Link></li>
              <li><Link href="/category?filter=new">New arrivals</Link></li>
              <li><Link href="/category?filter=sale">On sale</Link></li>
              <li><Link href="/about">About us</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="footer-col-title">Help</h4>
            <ul className="footer-links">
              <li><Link href="/support">Customer support</Link></li>
              <li><Link href="/delivery">Delivery details</Link></li>
              <li><Link href="/faq#orders">FAQ — Orders</Link></li>
              <li><Link href="/faq#payments">FAQ — Payments</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="footer-col-title">Policies</h4>
            <ul className="footer-links">
              <li><Link href="/terms">Terms &amp; conditions</Link></li>
              <li><Link href="/privacy">Privacy policy</Link></li>
              <li><Link href="/refund">Refund policy</Link></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <p className="footer-copyright">
            &copy; {year > SITE.established ? `${SITE.established}–${year}` : SITE.established} stress_d. All rights reserved.
          </p>
          {/* Only what the checkout actually accepts (via Paystack) */}
          <div className="payment-icons" aria-label="Accepted payments">
            <div className="payment-icon">VISA</div>
            <div className="payment-icon">MC</div>
            <div className="payment-icon">MoMo</div>
          </div>
        </div>
      </div>
    </footer>
  );
}
