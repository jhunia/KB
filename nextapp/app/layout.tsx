import type { Metadata } from 'next';
import './globals.css';
import { CartProvider } from '@/context/CartContext';
import { AuthProvider } from '@/context/AuthContext';
import { WishlistProvider } from '@/context/WishlistContext';
import { Analytics } from '@vercel/analytics/react';

export const metadata: Metadata = {
  // Absolute base for link-preview images (set NEXT_PUBLIC_SITE_URL once you have a custom domain)
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://stressd.vercel.app'),
  // Each page sets its own title; "%s" becomes e.g. "Leather Jacket | stress_d"
  title: {
    default: 'stress_d — Clothes That Match Your Style',
    template: '%s | stress_d',
  },
  description: 'stress_d is your one-stop destination for premium fashion. Discover the latest trends in casual, formal, and streetwear clothing.',
  openGraph: {
    siteName: 'stress_d',
    type: 'website',
    images: [{ url: '/brand/og-image.png', width: 1200, height: 630, alt: 'stress_d — est. 2026' }],
  },
};

// Providers shared by the store (app/(store)) and the admin area (app/admin).
// Each area adds its own header/navigation in its own layout.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // data-scroll-behavior: lets Next switch off the smooth scrolling (globals.css) during page changes,
    // so a new page opens at the top instead of animating from the old scroll position
    <html lang="en" data-scroll-behavior="smooth">
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
