import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Sign in or create an account', robots: { index: false } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
