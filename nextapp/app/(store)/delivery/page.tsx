import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Delivery details',
  description: 'How stress_d delivery works — delivery across Ghana, how the delivery fee is confirmed, and how to track your order.',
};

export default function DeliveryPage() {
  return (
    <main className="legal-page">
      <div className="legal-container">
        <Link href="/" className="legal-back">← Back to Home</Link>
        <h1>Delivery details</h1>
        <p className="legal-updated">We deliver across Ghana</p>

        <div className="legal-section">
          <h2>How it works</h2>
          <ol>
            <li><strong>Place your order</strong> and pay for your items online with Mobile Money or card.</li>
            <li><strong>We call you</strong> on the phone number you gave at checkout to confirm your address and your delivery fee.</li>
            <li><strong>We pack and send</strong> your order. You can follow its progress in your account, and we&apos;ll keep you updated.</li>
          </ol>
        </div>

        <div className="legal-section">
          <h2>Delivery fee</h2>
          <p>
            Because the cost depends on where you are, the delivery fee isn&apos;t charged at checkout. We quote it when we call
            you, and you pay it separately. Your online payment covers the items only.
          </p>
        </div>

        <div className="legal-section">
          <h2>Delivery times</h2>
          <p>
            Delivery times depend on your location. We&apos;ll give you an estimate when we call to confirm your order.
            We aren&apos;t responsible for delays caused by third-party delivery providers.
          </p>
        </div>

        <div className="legal-section">
          <h2>Tracking your order</h2>
          <p>
            If you have an account, open <Link href="/profile" className="legal-link">My Account</Link> to see each order move from
            “Order received” to “Being prepared”, “On its way” and “Delivered”. If you checked out as a guest, keep your order
            number (it starts with “SD-”) and <Link href="/support" className="legal-link">contact us</Link> for an update.
          </p>
        </div>

        <div className="legal-section">
          <h2>Please make sure</h2>
          <ul>
            <li>Your phone number is correct and reachable — we can&apos;t arrange delivery without speaking to you.</li>
            <li>Your delivery address includes a landmark if your street is hard to find.</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
