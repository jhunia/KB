import Link from 'next/link';
import { SITE } from '@/lib/site';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Terms & Conditions' };

export default function TermsPage() {
  return (
    <main className="legal-page">
      <div className="legal-container">
        <Link href="/" style={{ color: 'var(--gray-600)', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 24 }}>← Back to Home</Link>
        <h1>Terms &amp; Conditions</h1>
        <p className="legal-updated">Last updated: January 1, 2025</p>
        <div className="legal-section">
          <h2>1. Acceptance of Terms</h2>
          <p>By accessing and using stress_d, you accept and agree to be bound by the terms and provisions of this agreement. If you do not agree to abide by these terms, please do not use this service.</p>
        </div>
        <div className="legal-section">
          <h2>2. Products &amp; Pricing</h2>
          <p>All prices are listed in Ghana Cedis (GH₵) and are subject to change without notice. We reserve the right to modify or discontinue any product at any time.</p>
        </div>
        <div className="legal-section">
          <h2>3. Orders &amp; Payment</h2>
          <p>Orders are processed upon payment confirmation via Paystack. We accept MoMo and major card payments. In the event of a payment failure, your order will not be fulfilled.</p>
        </div>
        <div className="legal-section">
          <h2>4. Shipping &amp; Delivery</h2>
          <p>We offer delivery across Ghana. Delivery times may vary. We are not responsible for delays caused by third-party logistics providers.</p>
        </div>
        <div className="legal-section">
          <h2>5. Intellectual Property</h2>
          <p>All content on this site, including images, logos, and text, is the property of stress_d and is protected by applicable intellectual property laws.</p>
        </div>
        <div className="legal-section">
          <h2>6. Limitation of Liability</h2>
          <p>stress_d shall not be liable for any indirect, incidental, or consequential damages arising from the use of our products or services.</p>
        </div>
        <div className="legal-section">
          <h2>7. Contact</h2>
          <p>For questions about these terms, contact us at <a href={`mailto:${SITE.supportEmail}`} className="legal-link">{SITE.supportEmail}</a>.</p>
        </div>
      </div>
    </main>
  );
}
