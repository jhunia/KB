import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <div className="legal-container">
        <Link href="/" style={{ color: 'var(--gray-600)', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 24 }}>← Back to Home</Link>
        <h1>Privacy Policy</h1>
        <p className="legal-updated">Last updated: January 1, 2025</p>
        <div className="legal-section">
          <h2>1. Information We Collect</h2>
          <p>We collect information you provide directly to us, including your name, email address, phone number, and payment information when you make a purchase.</p>
        </div>
        <div className="legal-section">
          <h2>2. How We Use Your Information</h2>
          <ul>
            <li>To process and fulfill your orders</li>
            <li>To send order confirmations and shipping updates</li>
            <li>To improve our products and services</li>
            <li>To communicate promotional offers (with your consent)</li>
          </ul>
        </div>
        <div className="legal-section">
          <h2>3. Data Security</h2>
          <p>We implement industry-standard security measures to protect your data. Payment processing is handled securely by Paystack and we do not store your payment card details.</p>
        </div>
        <div className="legal-section">
          <h2>4. Data Sharing</h2>
          <p>We do not sell, trade, or rent your personal information to third parties. We may share data with trusted service providers who assist in our operations, subject to confidentiality agreements.</p>
        </div>
        <div className="legal-section">
          <h2>5. Cookies</h2>
          <p>We use cookies to enhance your browsing experience. You may disable cookies in your browser settings, but some features of the site may not function properly.</p>
        </div>
        <div className="legal-section">
          <h2>6. Your Rights</h2>
          <p>You have the right to access, correct, or delete your personal data at any time. Contact us at privacy@kbent.com to exercise these rights.</p>
        </div>
      </div>
    </main>
  );
}
