import Link from 'next/link';

export default function RefundPage() {
  return (
    <main className="legal-page">
      <div className="legal-container">
        <Link href="/" style={{ color: 'var(--gray-600)', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 24 }}>← Back to Home</Link>
        <h1>Refund Policy</h1>
        <p className="legal-updated">Last updated: January 1, 2025</p>
        <div className="legal-section">
          <h2>Returns</h2>
          <p>We accept returns within 14 days of delivery for items in their original condition with tags attached. Items must be unworn, unwashed, and in original packaging.</p>
        </div>
        <div className="legal-section">
          <h2>Non-Returnable Items</h2>
          <ul>
            <li>Items marked as final sale</li>
            <li>Undergarments and swimwear for hygiene reasons</li>
            <li>Items damaged due to misuse or negligence</li>
          </ul>
        </div>
        <div className="legal-section">
          <h2>Refund Process</h2>
          <p>Once we receive and inspect your return, we will process your refund within 5–7 business days. Refunds are issued to the original payment method.</p>
        </div>
        <div className="legal-section">
          <h2>Exchanges</h2>
          <p>We do not offer direct exchanges. If you need a different size or color, please return the original item and place a new order.</p>
        </div>
        <div className="legal-section">
          <h2>Damaged or Wrong Items</h2>
          <p>If you receive a damaged or incorrect item, please contact us within 48 hours of delivery at returns@kbent.com with photos, and we will make it right at no additional cost.</p>
        </div>
        <div className="legal-section">
          <h2>How to Start a Return</h2>
          <ol>
            <li>Email returns@kbent.com with your order ID and reason</li>
            <li>We will provide return shipping instructions</li>
            <li>Ship the item back to us</li>
            <li>Receive your refund within 5–7 business days</li>
          </ol>
        </div>
      </div>
    </main>
  );
}
