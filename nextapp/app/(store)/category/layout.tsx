import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Shop', description: 'Browse all KB.ENT clothing, shoes and accessories — filter by style, size and price.' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
