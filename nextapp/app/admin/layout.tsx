import type { Metadata } from 'next';
import './admin.css';
import AdminShell from '@/components/admin/AdminShell';

export const metadata: Metadata = {
  // "absolute" stops the store's "| KB.ENT" suffix being added on top
  title: { absolute: 'Dashboard | KB.ENT Admin', template: '%s | KB.ENT Admin' },
  robots: { index: false, follow: false }, // keep the admin out of search engines
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
