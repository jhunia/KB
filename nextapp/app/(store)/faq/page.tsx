import Link from 'next/link';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'FAQ',
  description: 'Answers to common questions about stress_d orders, payments, delivery and refunds.',
};

type QA = { id?: string; q: string; a: ReactNode };

const SECTIONS: { id: string; title: string; items: QA[] }[] = [
  {
    id: 'orders',
    title: 'Orders',
    items: [
      { q: 'Do I need an account to order?', a: <>No — you can check out as a guest and follow your order on the Track order page. With an account, all your orders and your wishlist are in one place.</> },
      { q: 'How do I track my order?', a: <>Open <Link href="/profile" className="legal-link">My Account</Link> to see where each order is. Ordered as a guest? Use <Link href="/track" className="legal-link">Track your order</Link> with your order number and email or phone number.</> },
      { id: 'cancel', q: 'Can I cancel my order?', a: <>Yes, until it has shipped. In <Link href="/profile" className="legal-link">My Account</Link>, choose “Cancel order” on the order. Guests can contact us. If you&apos;ve already paid, your refund follows once the cancellation is approved.</> },
      { q: 'How do I choose the right size?', a: <>Every clothing and shoe page has a <strong>Size guide</strong> link next to the sizes. If you&apos;re between sizes, pick the larger one for a relaxed fit.</> },
      { q: 'Can I return or exchange an item?', a: <>We don&apos;t accept returns or exchanges for change of mind, so please check the size guide before you order. If your item arrives damaged or wrong, contact us within 48 hours — see our <Link href="/refund" className="legal-link">refund policy</Link>.</> },
    ],
  },
  {
    id: 'payments',
    title: 'Payments',
    items: [
      { q: 'How can I pay?', a: <>By Mobile Money or by Visa / Mastercard. Payments are processed securely by Paystack — we never see your card details or MoMo PIN.</> },
      { q: 'Why wasn’t the delivery fee included?', a: <>Delivery costs depend on your location, so we confirm the fee by phone after you order and you pay it separately. See <Link href="/delivery" className="legal-link">delivery details</Link>.</> },
      { q: 'My payment failed — what should I do?', a: <>Nothing was taken if the payment didn&apos;t go through. Check your MoMo balance or card limit and try again from your cart. If money left your account but your order doesn&apos;t show as paid, <Link href="/support" className="legal-link">contact us</Link> with your order number.</> },
      { q: 'How do discount codes work?', a: <>Enter the code in your cart before checking out. You need to be logged in, and each code can be used once per customer.</> },
      { q: 'How long do refunds take?', a: <>Once approved, refunds are issued to your original payment method — see the <Link href="/refund" className="legal-link">refund policy</Link> for timings.</> },
    ],
  },
];

export default function FaqPage() {
  return (
    <main className="legal-page">
      <div className="legal-container">
        <Link href="/" className="legal-back">← Back to Home</Link>
        <h1>Frequently asked questions</h1>
        <p className="legal-updated">
          Jump to: <a href="#orders" className="legal-link">Orders</a> · <a href="#payments" className="legal-link">Payments</a>
        </p>

        {SECTIONS.map(section => (
          <section key={section.id} id={section.id} className="legal-section faq-section">
            <h2>{section.title}</h2>
            {section.items.map(item => (
              <div key={item.q} id={item.id} className="faq-item">
                <h3>{item.q}</h3>
                <p className="faq-answer">{item.a}</p>
              </div>
            ))}
          </section>
        ))}

        <div className="help-cta">
          <p>Still need help?</p>
          <Link href="/support" className="btn btn-primary">Contact customer support</Link>
        </div>
      </div>
    </main>
  );
}
