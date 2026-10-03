-- ============================================
-- GUEST ORDERS → ACCOUNT
-- Run once in Supabase → SQL Editor. Safe to re-run.
--
-- When someone who ordered as a guest later creates an account (or signs in) with the
-- same email, their guest orders are moved into the account so they show in My Account.
-- Only for confirmed emails — nobody can claim orders by signing up with someone else's address.
-- Called by the site when My Account loads its orders (lib/db.ts → getUserOrders).
-- ============================================

create or replace function public.claim_guest_orders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_count integer;
begin
  select lower(email) into v_email
    from auth.users
   where id = auth.uid()
     and email_confirmed_at is not null;

  if v_email is null then
    return 0;
  end if;

  update public.orders
     set user_id = auth.uid()
   where user_id is null
     and lower(customer_info->>'email') = v_email;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.claim_guest_orders() from public, anon;
grant execute on function public.claim_guest_orders() to authenticated;
