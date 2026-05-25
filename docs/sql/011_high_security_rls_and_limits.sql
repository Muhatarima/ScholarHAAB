-- 1. Create the user_devices table for tracking the 3-device limit
create table if not exists public.user_devices (
  user_id uuid not null references auth.users(id) on delete cascade,
  viewer_key text not null,
  last_active timestamptz not null default now(),
  primary key (user_id, viewer_key)
);

create index if not exists user_devices_user_id_idx on public.user_devices(user_id);

-- 2. RPC function to securely register or reject a device
create or replace function public.register_user_device(p_user_id uuid, p_viewer_key text)
returns boolean
language plpgsql
security definer
as $$
declare
  v_device_count int;
  v_device_exists boolean;
begin
  -- Check if device is already registered
  select exists(
    select 1 from public.user_devices 
    where user_id = p_user_id and viewer_key = p_viewer_key
  ) into v_device_exists;

  if v_device_exists then
    update public.user_devices 
    set last_active = now() 
    where user_id = p_user_id and viewer_key = p_viewer_key;
    return true;
  end if;

  -- Count existing devices
  select count(*) into v_device_count 
  from public.user_devices 
  where user_id = p_user_id;

  if v_device_count >= 3 then
    return false; -- Reached the 3 device limit, absolutely no more allowed.
  end if;

  -- Insert new device securely
  insert into public.user_devices (user_id, viewer_key) 
  values (p_user_id, p_viewer_key);
  
  return true;
end;
$$;

-- 3. RPC function to prevent usage limit cheating via atomic lock
create or replace function public.commit_usage_atomic(
  p_viewer_key text,
  p_usage_date text,
  p_tier text,
  p_cost integer,
  p_daily_limit integer
)
returns integer
language plpgsql
security definer
as $$
declare
  v_used integer;
begin
  -- Attempt to lock the row securely
  select credits_used into v_used 
  from public.daily_usage 
  where viewer_key = p_viewer_key and usage_date = p_usage_date::date
  for update;

  if not found then
    -- Doesn't exist, insert if under limit
    if p_cost > p_daily_limit then
      raise exception 'Daily limit reached';
    end if;

    insert into public.daily_usage (viewer_key, usage_date, tier, credits_used, actions_count)
    values (p_viewer_key, p_usage_date::date, p_tier, p_cost, 1);
    
    return p_cost;
  end if;

  if (v_used + p_cost) > p_daily_limit then
    raise exception 'Daily limit reached';
  end if;

  update public.daily_usage 
  set 
    credits_used = credits_used + p_cost,
    actions_count = actions_count + 1,
    tier = p_tier,
    updated_at = now()
  where viewer_key = p_viewer_key and usage_date = p_usage_date::date;

  return v_used + p_cost;
end;
$$;

-- 4. Secure all database tables directly by overriding with Row Level Security defaulting to "Deny All"
DO $$ 
DECLARE 
  r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', r.tablename);
  END LOOP;
END $$;
