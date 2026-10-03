import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Track your order',
  description: 'Check the status of your stress_d order with your order number and email or phone number.',
};

export default function TrackLayout({ children }: { children: React.ReactNode }) {
  return children;
}
