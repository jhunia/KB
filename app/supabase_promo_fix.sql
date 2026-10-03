-- ============================================
-- PROMO CODES — working version
-- Run once in Supabase → SQL Editor. Safe to re-run.
-- (Replaces supabase_email_promo_patch.sql — don't run that one.)
--
--   • Only signed-in customers can use codes.
--   • Each code works once per account email (name+1@gmail.com counts as name@gmail.com).
--   • Optional start / end dates: a code switches itself on and off (e.g. a Christmas code
--     valid 24–26 Dec). Codes without dates work until paused.
--   • The order remembers which code was used; the server re-checks it when the payment is
--     confirmed and only then records the use (lib/payments.ts).
-- ============================================

-- name+anything@gmail.com → name@gmail.com, lowercased
create or replace function public.normalize_email(email text)
returns text
language plpgsql immutable strict
as $$
begin
  return lower(regexp_replace(split_part(email, '@', 1), '\+.*$', '') || '@' || split_part(email, '@', 2));
end;
$$;

-- When a code is valid. starts_at empty = from now; ends_at empty = no end (ends_at is exclusive)
alter table public.promo_codes add column if not exists starts_at timestamptz;
alter table public.promo_codes add column if not exists ends_at timestamptz;

-- Who used which code (written by the server after payment — no browser access)
create table if not exists public.promo_uses (
  id                serial primary key,
  promo_code        text not null,
  normalized_email  text not null,
  user_id           uuid references public.profiles(id) on delete set null,
  used_at           timestamptz default now(),
  unique (promo_code, normalized_email)
);
alter table public.promo_uses add column if not exists order_id text;
alter table public.promo_uses enable row level security;

drop policy if exists "Users can record their promo use" on public.promo_uses;
drop policy if exists "Admins can view promo uses" on public.promo_uses;
create policy "Admins can view promo uses" on public.promo_uses for select using (public.is_admin());

-- Checks a code for the signed-in customer: active, within its dates, not used before
drop function if exists public.validate_promo_code(text, text, uuid);
drop function if exists public.validate_promo_code(text, text);
create or replace function public.validate_promo_code(p_code text)
returns table (is_valid boolean, discount_percent integer, reason text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_code  promo_codes%rowtype;
begin
  select email into v_email from auth.users where id = auth.uid();
  if v_email is null then
    return query select false, 0, 'Log in to use a promo code.'::text;
    return;
  end if;

  select * into v_code from promo_codes pc where pc.code = upper(trim(p_code)) and pc.is_active = true;
  if v_code.id is null then
    return query select false, 0, 'That code isn’t valid.'::text;
    return;
  end if;
  if v_code.starts_at is not null and now() < v_code.starts_at then
    return query select false, 0, 'That code isn’t active yet.'::text;
    return;
  end if;
  if v_code.ends_at is not null and now() >= v_code.ends_at then
    return query select false, 0, 'That code has expired.'::text;
    return;
  end if;

  if exists (
    select 1 from promo_uses pu
     where pu.promo_code = v_code.code
       and pu.normalized_email = public.normalize_email(v_email)
  ) then
    return query select false, 0, 'You’ve already used this code.'::text;
    return;
  end if;

  return query select true, v_code.discount_percent, 'OK'::text;
end;
$$;

revoke all on function public.validate_promo_code(text) from public, anon;
grant execute on function public.validate_promo_code(text) to authenticated;

-- Which code an order used (checked by the server before the order is marked paid)
alter table public.orders add column if not exists promo_code text;
