import Link from 'next/link';
import type { Metadata } from 'next';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'About us',
  description: `stress_d is a Ghanaian fashion store, established in ${SITE.established}, bringing you clothing, shoes and accessories for every style.`,
};

export default function AboutPage() {
  return (
    <main className="legal-page">
      <div className="legal-container">
        <Link href="/" className="legal-back">← Back to Home</Link>
        <h1>About stress_d</h1>
        <p className="legal-updated">Established {SITE.established}</p>

        <div className="legal-section">
          <p>
            stress_d is a fashion store for people who want clothes that match their style. We bring together
            everyday casual pieces, sharp formal wear, stand-out party looks and gym gear — all in one place,
            with prices in Ghana cedis and payment by Mobile Money or card.
          </p>
        </div>

        <div className="legal-section">
          <h2>How we work</h2>
          <ul>
            <li><strong>Shop your way</strong> — check out as a guest, or create an account to track orders and save your favourites.</li>
            <li><strong>Pay securely</strong> — payments are handled by Paystack; we never see your card or MoMo PIN.</li>
            <li><strong>Personal delivery</strong> — after you order, we call you to confirm your delivery fee and arrange a time that suits you.</li>
            <li><strong>Stay updated</strong> — follow your order from “Order received” to “Delivered” in your account.</li>
          </ul>
        </div>

        <div className="legal-section">
          <h2>Get in touch</h2>
          <p>Questions, feedback or sizing help? Our <Link href="/support" className="legal-link">customer support page</Link> has every way to reach us.</p>
        </div>

        <div className="help-cta">
          <Link href="/category" className="btn btn-primary">Start shopping</Link>
        </div>
      </div>
    </main>
  );
}
