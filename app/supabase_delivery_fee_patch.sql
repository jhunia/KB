-- ============================================
-- KB.ENT — Remove hardcoded delivery fee default
-- Run in Supabase SQL Editor
-- ============================================

-- Change the default delivery_fee from 15 to 0.
-- Delivery is now quoted per-order by the admin after the customer pays for their products.
ALTER TABLE orders ALTER COLUMN delivery_fee SET DEFAULT 0;

-- Update the INSERT policy constraint so delivery_fee of 0 is explicitly valid.
-- (Already valid since the constraint is >= 0, but making it explicit for clarity)
-- No change needed to existing RLS — delivery_fee >= 0 already covers 0.

-- Verify:
-- SELECT column_name, column_default FROM information_schema.columns
-- WHERE table_name = 'orders' AND column_name = 'delivery_fee';
