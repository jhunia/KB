import type { Metadata, Viewport } from 'next';
import './admin.css';
import AdminShell from '@/components/admin/AdminShell';

export const metadata: Metadata = {
  // "absolute" stops the store's "| stress_d" suffix being added on top
  title: { absolute: 'Dashboard | stress_d admin', template: '%s | stress_d admin' },
  robots: { index: false, follow: false }, // keep the admin out of search engines
  // Installable as its own app ("Add to Home Screen") — icon: app/admin/apple-icon.png
  manifest: '/admin.webmanifest',
  appleWebApp: { capable: true, title: 'stress_d Admin', statusBarStyle: 'default' },
};

export const viewport: Viewport = { themeColor: '#ffffff' };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
