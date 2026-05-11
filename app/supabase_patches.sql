-- ============================================
-- KB.ENT — Security & Data Patches
-- Run this in Supabase SQL Editor AFTER the
-- original supabase_migration.sql has been run.
-- ============================================

-- ============================================
-- FIX #7: Move promo codes to the database
-- so they are not visible in client-side JS
-- ============================================
CREATE TABLE IF NOT EXISTS promo_codes (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  discount_percent INTEGER NOT NULL CHECK (discount_percent BETWEEN 1 AND 100),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;

-- Only authenticated users can look up promo codes (no anonymous fishing)
CREATE POLICY "Authenticated users can validate promo codes"
  ON promo_codes FOR SELECT USING (auth.uid() IS NOT NULL AND is_active = TRUE);

-- Only admins can manage promo codes
CREATE POLICY "Admins can manage promo codes"
  ON promo_codes FOR ALL USING (public.is_admin());

-- Seed initial promo codes
INSERT INTO promo_codes (code, discount_percent, is_active) VALUES
  ('KBFIRST', 20, TRUE),
  ('KBNEW10', 10, TRUE)
ON CONFLICT (code) DO NOTHING;


-- ============================================
-- FIX #5: Tighten orders INSERT policy
-- Remove the open anonymous insert policy
-- and require a non-null total > 0
-- (Full server-side verification via webhook
--  is recommended for production)
-- ============================================
DROP POLICY IF EXISTS "Users can create orders" ON orders;
CREATE POLICY "Users can create orders"
  ON orders FOR INSERT WITH CHECK (
    total > 0
    AND subtotal >= 0
    AND delivery_fee >= 0
  );


-- ============================================
-- FIX #16: Add DELETE policy on orders for admins
-- (Required for the admin Delete Order button to work)
-- ============================================
DROP POLICY IF EXISTS "Admins can delete orders" ON orders;
CREATE POLICY "Admins can delete orders"
  ON orders FOR DELETE USING (public.is_admin());


-- ============================================
-- FIX #17: Add DELETE policy on order_items for admins
-- ============================================
DROP POLICY IF EXISTS "Admins can delete order items" ON order_items;
CREATE POLICY "Admins can delete order items"
  ON order_items FOR DELETE USING (public.is_admin());


-- ============================================
-- FIX #14: Add updated_at column to products
-- ============================================
ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Auto-update updated_at whenever a product row is changed
CREATE OR REPLACE FUNCTION public.handle_product_updated()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_product_updated ON products;
CREATE TRIGGER on_product_updated
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION public.handle_product_updated();


-- ============================================
-- Remove dummy seed orders (Fix #20)
-- Run ONLY if you want to clear all demo data
-- ============================================
-- DELETE FROM order_items WHERE order_id IN ('ORD-4821','ORD-3317','ORD-2209','ORD-5503','ORD-1188');
-- DELETE FROM orders WHERE id IN ('ORD-4821','ORD-3317','ORD-2209','ORD-5503','ORD-1188');


-- ============================================
-- FIX #23: Tighten customer query to exclude
-- all non-customer roles (future-proof)
-- The app already filters neq('role','admin')
-- but add a DB-level view for safety:
-- ============================================
CREATE OR REPLACE VIEW customer_profiles AS
  SELECT * FROM profiles WHERE role = 'customer';

-- Grant read access to authenticated users
GRANT SELECT ON customer_profiles TO authenticated;


-- ============================================
-- Verify:
-- SELECT COUNT(*) FROM orders;          -- all orders
-- SELECT COUNT(*) FROM order_items;     -- all items
-- SELECT * FROM information_schema.columns WHERE table_name='products' AND column_name='updated_at';
-- ============================================
