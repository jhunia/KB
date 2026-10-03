-- ============================================
-- PRODUCT ARCHIVE
-- Run once in Supabase → SQL Editor. Safe to re-run.
--
-- "Delete" in the admin now works like this:
--   • never ordered  → deleted for good (with its images)
--   • already ordered → archived: hidden from the shop, but still shown in past orders
--     and restorable from Admin → Products → Archived.
-- ============================================

alter table public.products add column if not exists archived_at timestamptz;

create index if not exists products_archived_at_idx on public.products (archived_at);
