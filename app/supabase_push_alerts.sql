-- ============================================
-- ORDER ALERTS (push notifications to the admin app)
-- Run once in Supabase → SQL Editor. Safe to re-run.
--
-- How it works: when an order becomes paid (or a cancellation is requested),
-- the database itself calls the website's /api/push/order endpoint, which sends
-- a notification to every phone that turned on alerts in the admin.
-- Because the database makes the call, alerts arrive even if the customer
-- closes their browser straight after paying.
-- ============================================

-- Lets the database make web requests (built into Supabase)
create extension if not exists pg_net;

-- 1. Phones / browsers that turned on order alerts (one row per device)
create table if not exists public.push_subscriptions (
  id          bigserial primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  device      text,
  created_at  timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

-- Only admins can register a device, and only for themselves
drop policy if exists "Admins manage own push subscriptions" on public.push_subscriptions;
create policy "Admins manage own push subscriptions" on public.push_subscriptions
  for all
  using (auth.uid() = user_id and public.is_admin())
  with check (auth.uid() = user_id and public.is_admin());

-- 2. Which alerts were already sent, so an order never buzzes twice for the same thing.
--    Only the server (service role) touches this table — RLS on with no policies.
create table if not exists public.push_log (
  order_id  text not null,
  event     text not null,
  sent_at   timestamptz not null default now(),
  primary key (order_id, event)
);
alter table public.push_log enable row level security;

-- 3. Database → website call.
--    ▶ CHANGE THIS URL if your site moves (e.g. to your own domain), then re-run this file.
--    Only the order id is sent; the website re-reads the order itself, so nobody can
--    fake an alert by calling the endpoint.
create or replace function public.notify_order_alert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url     := 'https://stressd.vercel.app/api/push/order',
    body    := jsonb_build_object('orderId', new.id),
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  return new;
exception when others then
  -- An alert must never block an order from being saved
  return new;
end;
$$;

drop trigger if exists order_alert on public.orders;
create trigger order_alert
  after insert or update of status on public.orders
  for each row
  when (new.status in ('paid', 'Cancellation Requested'))
  execute function public.notify_order_alert();
