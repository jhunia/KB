-- ============================================
-- PAYMENT SECURITY PATCH
-- Run once in Supabase → SQL Editor (after the other patches). Safe to re-run.
--
-- Before: the customer's browser marked its own order "paid" (blocked for guests,
-- so guest orders stayed "Awaiting payment"; and logged-in customers could edit
-- their orders freely). Now only the website's server marks orders paid, after
-- Paystack confirms the payment (app/api/paystack/verify + webhook).
-- ============================================

-- 1. Customers can no longer update orders directly — only admins can.
drop policy if exists "Users can update their own orders" on public.orders;
drop policy if exists "Admins can update orders" on public.orders;
create policy "Admins can update orders" on public.orders
  for update using (public.is_admin()) with check (public.is_admin());

-- 2. New orders from the shop must start unpaid (no creating an order that's already "paid").
drop policy if exists "Users can create orders" on public.orders;
create policy "Users can create orders" on public.orders
  for insert with check (
    total > 0
    and subtotal >= 0
    and delivery_fee >= 0
    and (
      public.is_admin()
      or (status = 'pending_payment' and payment_ref is null and (user_id is null or user_id = auth.uid()))
    )
  );

-- 3. Customers can still ask to cancel their own order, through this function only.
create or replace function public.request_order_cancellation(p_order_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.orders
     set status = 'Cancellation Requested'
   where id = p_order_id
     and user_id = auth.uid()
     and status in ('pending_payment', 'paid', 'Processing');
  return found;
end;
$$;

revoke all on function public.request_order_cancellation(text) from public, anon;
grant execute on function public.request_order_cancellation(text) to authenticated;
