import type { Metadata } from 'next';
import './globals.css';
import { CartProvider } from '@/context/CartContext';
import { AuthProvider } from '@/context/AuthContext';
import { WishlistProvider } from '@/context/WishlistContext';
import { Analytics } from '@vercel/analytics/react';

export const metadata: Metadata = {
  // Absolute base for link-preview images (set NEXT_PUBLIC_SITE_URL once you have a custom domain)
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://kb-wheat-chi.vercel.app'),
  // Each page sets its own title; "%s" becomes e.g. "Leather Jacket | KB.ENT"
  title: {
    default: 'KB.ENT — We Have Clothes That Match Your Style',
    template: '%s | KB.ENT',
  },
  description: 'KB is your one-stop destination for premium fashion. Discover the latest trends in casual, formal, and streetwear clothing.',
  openGraph: {
    siteName: 'KB.ENT',
    type: 'website',
    images: ['/assets/images/landing_page.jpg'],
  },
};

// Providers shared by the store (app/(store)) and the admin area (app/admin).
// Each area adds its own header/navigation in its own layout.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <WishlistProvider>
            <CartProvider>
              {children}
              <Analytics />
            </CartProvider>
          </WishlistProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
