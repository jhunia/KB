-- ============================================
-- KB.ENT — Email Aliasing & Promo Abuse Prevention
-- Run in Supabase SQL Editor AFTER supabase_patches.sql
-- ============================================

-- ============================================
-- Helper: Strip email aliases (e.g. user+promo@gmail.com → user@gmail.com)
-- Also lowercases the result for consistent comparison.
-- ============================================
CREATE OR REPLACE FUNCTION public.normalize_email(email TEXT)
RETURNS TEXT AS $$
BEGIN
  -- Remove everything between '+' and '@' (the alias part), then lowercase
  RETURN lower(
    regexp_replace(split_part(email, '@', 1), '\+.*$', '')
    || '@'
    || split_part(email, '@', 2)
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE STRICT;


-- ============================================
-- Add normalized_email to profiles table
-- This is computed on insert/update via a trigger
-- ============================================
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS normalized_email TEXT;

-- Backfill existing rows
UPDATE profiles
  SET normalized_email = public.normalize_email(email)
  WHERE normalized_email IS NULL;

-- Unique constraint: prevents two aliased variants of the same email
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS uq_profiles_normalized_email;
ALTER TABLE profiles
  ADD CONSTRAINT uq_profiles_normalized_email
  UNIQUE (normalized_email);

-- ============================================
-- Trigger: auto-populate normalized_email on insert/update
-- ============================================
CREATE OR REPLACE FUNCTION public.set_normalized_email()
RETURNS TRIGGER AS $$
BEGIN
  NEW.normalized_email := public.normalize_email(NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_normalized_email ON profiles;
CREATE TRIGGER trg_set_normalized_email
  BEFORE INSERT OR UPDATE OF email ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_normalized_email();


-- ============================================
-- Promo uses tracking table
-- Records which NORMALIZED email used which promo,
-- so +1 / +2 aliases cannot reuse the same promo.
-- ============================================
CREATE TABLE IF NOT EXISTS promo_uses (
  id              SERIAL PRIMARY KEY,
  promo_code      TEXT NOT NULL,
  normalized_email TEXT NOT NULL,
  user_id         UUID REFERENCES profiles(id) ON DELETE SET NULL,
  used_at         TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(promo_code, normalized_email)    -- one use per promo per base email
);

ALTER TABLE promo_uses ENABLE ROW LEVEL SECURITY;

-- Only admins can see promo uses
CREATE POLICY "Admins can view promo uses"
  ON promo_uses FOR SELECT USING (public.is_admin());

-- Authenticated users can record their own promo use
CREATE POLICY "Users can record their promo use"
  ON promo_uses FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid() = user_id
  );


-- ============================================
-- Updated promo validation function
-- Checks both: code is active AND normalized email hasn't used it before
-- Call from the app like: SELECT * FROM validate_promo_code('KBNEW10', 'user+alias@gmail.com', auth.uid());
-- ============================================
CREATE OR REPLACE FUNCTION public.validate_promo_code(
  p_code TEXT,
  p_email TEXT,
  p_user_id UUID
)
RETURNS TABLE(is_valid BOOLEAN, discount_percent INTEGER, reason TEXT) AS $$
DECLARE
  v_normalized TEXT;
  v_discount   INTEGER;
  v_already_used BOOLEAN;
BEGIN
  v_normalized := public.normalize_email(p_email);

  -- Check if promo code exists and is active
  SELECT pc.discount_percent INTO v_discount
  FROM promo_codes pc
  WHERE pc.code = upper(trim(p_code))
    AND pc.is_active = TRUE;

  IF v_discount IS NULL THEN
    RETURN QUERY SELECT FALSE, 0, 'Invalid or expired promo code.'::TEXT;
    RETURN;
  END IF;

  -- Check if this normalized email has already used this promo
  SELECT EXISTS (
    SELECT 1 FROM promo_uses pu
    WHERE pu.promo_code = upper(trim(p_code))
      AND pu.normalized_email = v_normalized
  ) INTO v_already_used;

  IF v_already_used THEN
    RETURN QUERY SELECT FALSE, 0, 'This promo code has already been used with this email.'::TEXT;
    RETURN;
  END IF;

  RETURN QUERY SELECT TRUE, v_discount, 'OK'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================
-- Verify:
-- SELECT public.normalize_email('User+Promo123@Gmail.COM');
-- -- Should return: user@gmail.com
--
-- SELECT * FROM public.validate_promo_code('KBNEW10', 'user+alias@gmail.com', auth.uid());
-- ============================================

-- ============================================
-- Guest Signup Bonus Promo Code
-- Shown in the post-checkout nudge modal; redeemable once per email.
-- ============================================
INSERT INTO promo_codes (code, discount_percent, description, max_uses, is_active)
VALUES ('WELCOME10', 10, 'Welcome bonus for guests who sign up after their first order', 99999, true)
ON CONFLICT (code) DO UPDATE
  SET discount_percent = EXCLUDED.discount_percent,
      is_active = true,
      description = EXCLUDED.description;
