-- ============================================
-- ACCOUNT DETAILS + ORDER SECURITY
-- Run once in Supabase → SQL Editor. Safe to re-run.
--
--   • Customers can save a delivery address (pre-filled at checkout).
--   • A customer's email can't be changed once the account exists (it's the account's
--     identity: sign-in, order history, promo codes are once per email). Editing the
--     profile row directly can't change it either. If you ever change someone's sign-in
--     email yourself in Supabase → Authentication, their profile follows automatically.
-- ============================================

alter table public.profiles add column if not exists address text;

-- 1. Customers can't edit their profile email directly (admins and the server still can)
create or replace function public.protect_profile_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() and new.email is distinct from old.email then
    new.email := old.email;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_email on public.profiles;
create trigger protect_profile_email
  before update on public.profiles
  for each row execute function public.protect_profile_email();

-- 2. If the sign-in email is changed in Supabase (by you), copy it to the profile
create or replace function public.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (new.email is distinct from old.email)
  execute function public.sync_profile_email();

-- ============================================
-- 3. SECURITY: order items can only be added to your own order while it's being placed
--    (before: anyone could add items to ANY order, including paid ones — e.g. slipping
--    extra items into someone's order before it's packed)
-- ============================================
drop policy if exists "Users can create order items" on public.order_items;
drop policy if exists "Order items insert" on public.order_items;
drop policy if exists "Order items can be added while placing an order" on public.order_items;
do $$
declare p record;
begin
  -- remove any other INSERT policy on order_items (the original one allowed everything)
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'order_items' and cmd = 'INSERT' loop
    execute format('drop policy %I on public.order_items', p.policyname);
  end loop;
end $$;

-- Guests can't read the orders table, so the check runs in a function that can
create or replace function public.can_add_order_item(p_order_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from orders o
     where o.id = p_order_id
       and o.status = 'pending_payment'
       and o.created_at > now() - interval '30 minutes'
       and (o.user_id is null or o.user_id = auth.uid())
  );
$$;

create policy "Order items can be added while placing an order" on public.order_items
  for insert with check (public.is_admin() or public.can_add_order_item(order_id));
