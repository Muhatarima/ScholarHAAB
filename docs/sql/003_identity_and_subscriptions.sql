create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  default_product text check (default_product in ('abroad', 'qbank')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tier text not null check (tier in ('trial', 'pro', 'premium')),
  status text not null check (status in ('trialing', 'active', 'canceled', 'past_due', 'expired')),
  provider text,
  provider_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_user_status_idx
  on public.subscriptions (user_id, status, updated_at desc);

create unique index if not exists subscriptions_provider_unique
  on public.subscriptions (provider, provider_subscription_id)
  where provider is not null and provider_subscription_id is not null;

create or replace function public.set_updated_at_profiles()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_set_updated_at_profiles on public.profiles;
create trigger trg_set_updated_at_profiles
before update on public.profiles
for each row
execute function public.set_updated_at_profiles();

create or replace function public.set_updated_at_subscriptions()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_set_updated_at_subscriptions on public.subscriptions;
create trigger trg_set_updated_at_subscriptions
before update on public.subscriptions
for each row
execute function public.set_updated_at_subscriptions();
