-- ============================================================
-- KB.ENT — product image storage
-- Run this once in your Supabase SQL editor.
--
-- Creates a public `product-images` bucket so the admin panel uploads
-- image files to Storage instead of embedding base64 data in the
-- products table (which made every page download ~2MB of JSON).
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880, -- 5 MB per file
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Anyone can view product images
drop policy if exists "Public read product-images" on storage.objects;
create policy "Public read product-images"
  on storage.objects for select
  using (bucket_id = 'product-images');

-- Only admins can upload / replace / delete product images
drop policy if exists "Admin insert product-images" on storage.objects;
create policy "Admin insert product-images"
  on storage.objects for insert
  with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "Admin update product-images" on storage.objects;
create policy "Admin update product-images"
  on storage.objects for update
  using (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "Admin delete product-images" on storage.objects;
create policy "Admin delete product-images"
  on storage.objects for delete
  using (bucket_id = 'product-images' and public.is_admin());
