-- ============================================================
-- KB.ENT — site_settings table
-- Run this once in your Supabase SQL editor
-- ============================================================

create table if not exists site_settings (
  key   text primary key,
  value jsonb not null,
  updated_at timestamptz default now()
);

-- Seed the promo banner setting (off by default)
insert into site_settings (key, value)
values ('promo_banner_active', 'false'::jsonb)
on conflict (key) do nothing;

-- Row-Level Security: anyone can read, only authenticated admins can write
alter table site_settings enable row level security;

create policy "Public read site_settings"
  on site_settings for select
  using (true);

create policy "Admin write site_settings"
  on site_settings for all
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );
