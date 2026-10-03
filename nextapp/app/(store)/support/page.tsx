import Link from 'next/link';
import type { Metadata } from 'next';
import { SITE, storeWhatsAppLink } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Customer support',
  description: 'Get help with your stress_d order — tracking, cancellations, refunds, payments and delivery.',
};

export default function SupportPage() {
  return (
    <main className="legal-page">
      <div className="legal-container">
        <Link href="/" className="legal-back">← Back to Home</Link>
        <h1>Customer support</h1>
        <p className="legal-updated">We&apos;re here to help{SITE.hours ? ` · ${SITE.hours}` : ''}</p>

        <div className="help-contact">
          {SITE.whatsapp && (
            <a className="help-contact-card" href={storeWhatsAppLink()} target="_blank" rel="noopener noreferrer">
              <strong>Chat on WhatsApp</strong><span>{SITE.whatsapp}</span>
            </a>
          )}
          {SITE.phone && (
            <a className="help-contact-card" href={`tel:${SITE.phone.replace(/\s/g, '')}`}>
              <strong>Call us</strong><span>{SITE.phone}</span>
            </a>
          )}
          {SITE.supportEmail && (
            <a className="help-contact-card" href={`mailto:${SITE.supportEmail}`}>
              <strong>Email us</strong><span>{SITE.supportEmail}</span>
            </a>
          )}
        </div>
        <p className="help-note">Include your order number (it starts with “SD-”) so we can help you faster.</p>

        <div className="legal-section">
          <h2>Quick help</h2>
          <ul className="help-links">
            <li><Link href="/track"><strong>Track an order</strong><span>Check your order status with your order number and email or phone.</span></Link></li>
            <li><Link href="/faq#cancel"><strong>Cancel an order</strong><span>Possible until your order has shipped.</span></Link></li>
            <li><Link href="/delivery"><strong>Delivery</strong><span>How delivery and the delivery fee work.</span></Link></li>
            <li><Link href="/refund"><strong>Refunds &amp; damaged items</strong><span>Cancellations, refunds and wrong or damaged items.</span></Link></li>
            <li><Link href="/faq#payments"><strong>Payment problems</strong><span>Failed payments, MoMo and card questions.</span></Link></li>
            <li><Link href="/faq"><strong>All FAQs</strong><span>Answers to the most common questions.</span></Link></li>
          </ul>
        </div>
      </div>
    </main>
  );
}
