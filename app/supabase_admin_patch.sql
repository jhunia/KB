-- ============================================================
-- KB.ENT — admin / order-history fixes
-- Run this once in your Supabase SQL editor. Safe to run twice.
-- ============================================================

-- 0. SECURITY: stop customers from making themselves admin.
--    The "Users can update their own profile" policy allows updating every column,
--    including `role`, so any signed-in user could promote themselves from the browser.
--    This trigger only lets existing admins (or you, in this SQL editor) change roles,
--    and forces new profiles created by users to start as 'customer'.
create or replace function public.protect_profile_role()
returns trigger as $$
begin
  -- auth.uid() is null in the Supabase SQL editor / service role, so you can still change roles here
  if auth.uid() is not null and not public.is_admin() then
    if tg_op = 'INSERT' then
      new.role := 'customer';
    elsif new.role is distinct from old.role then
      raise exception 'Only admins can change account roles';
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists protect_profile_role on profiles;
create trigger protect_profile_role
  before insert or update on profiles
  for each row execute function public.protect_profile_role();

-- 1. Remember what each item actually cost when it was ordered.
--    Without this, the admin panel prices old orders at today's product price.
--    Existing orders are left empty (the app shows them as "current price").
alter table order_items add column if not exists unit_price numeric(10, 2);

-- 2. Stop product deletes from wiping order history.
--    order_items.product_id was ON DELETE CASCADE, so deleting a product silently
--    removed it from every past order. RESTRICT makes the database refuse instead.
do $$
declare fk text;
begin
  select tc.constraint_name into fk
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
  where tc.table_schema = 'public' and tc.table_name = 'order_items'
    and tc.constraint_type = 'FOREIGN KEY' and kcu.column_name = 'product_id'
  limit 1;
  if fk is not null then
    execute format('alter table order_items drop constraint %I', fk);
  end if;
  alter table order_items
    add constraint order_items_product_id_fkey
    foreign key (product_id) references products(id) on delete restrict;
end $$;

-- 3. Private admin notes on each order (e.g. "Customer asked for evening delivery").
alter table orders add column if not exists admin_notes text;
