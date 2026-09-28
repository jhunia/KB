import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import CartDrawer from '@/components/layout/CartDrawer';

// Shopper-facing chrome. The admin area (app/admin) has its own layout instead.
export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <CartDrawer />
      {children}
      <Footer />
    </>
  );
}
