import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Refund Policy' };

export default function RefundPage() {
  return (
    <main className="legal-page">
      <div className="legal-container">
        <Link href="/" className="legal-back">← Back to Home</Link>
        <h1>Refund Policy</h1>
        <p className="legal-updated">Last updated: 30 September 2026</p>
        <div className="legal-section">
          <h2>Returns &amp; exchanges</h2>
          <p>
            We don&apos;t accept returns or exchanges for change of mind, including when an item doesn&apos;t fit.
            Please check the <strong>Size guide</strong> on the product page before you order — and if you&apos;re unsure,{' '}
            <Link href="/support" className="legal-link">contact us</Link> for sizing help first.
          </p>
        </div>
        <div className="legal-section">
          <h2>Cancellations</h2>
          <p>
            You can cancel an order until it has shipped — in <Link href="/profile" className="legal-link">My Account</Link>,
            choose “Cancel order”. Guests can contact us with their order number. If you&apos;ve already paid, we refund you once
            the cancellation is approved.
          </p>
        </div>
        <div className="legal-section">
          <h2>Damaged or wrong items</h2>
          <p>If you receive a damaged or incorrect item, please contact us within 48 hours of delivery at returns@kbent.com with photos, and we will make it right at no additional cost.</p>
        </div>
        <div className="legal-section">
          <h2>How refunds are paid</h2>
          <p>Approved refunds are issued to your original payment method (Mobile Money or card) within 5–7 business days.</p>
        </div>
      </div>
    </main>
  );
}
