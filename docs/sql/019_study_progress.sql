alter table public.profiles
  add column if not exists streak_days integer not null default 0,
  add column if not exists longest_streak integer not null default 0,
  add column if not exists total_xp integer not null default 0,
  add column if not exists last_active_date date;

create table if not exists public.daily_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_date date not null,
  messages_count integer not null default 0,
  qbank_messages integer not null default 0,
  abroad_messages integer not null default 0,
  xp_earned integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, activity_date)
);

create index if not exists daily_activity_user_date_idx
  on public.daily_activity (user_id, activity_date desc);

create or replace function public.set_updated_at_daily_activity()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_set_updated_at_daily_activity on public.daily_activity;
create trigger trg_set_updated_at_daily_activity
before update on public.daily_activity
for each row
execute function public.set_updated_at_daily_activity();

create or replace function public.record_study_activity(
  p_user_id uuid,
  p_activity_date date,
  p_product text,
  p_base_xp integer,
  p_attachment_bonus integer default 0,
  p_message_count integer default 1
)
returns void
language plpgsql
security definer
as $$
declare
  v_today_exists boolean;
  v_previous_active date;
  v_previous_streak integer;
  v_new_streak integer;
  v_xp_gain integer;
begin
  insert into public.profiles (
    id,
    nationality,
    onboarding_completed,
    wants_deadline_alerts,
    streak_days,
    longest_streak,
    total_xp,
    last_active_date
  )
  values (
    p_user_id,
    'Bangladesh',
    false,
    true,
    0,
    0,
    0,
    null
  )
  on conflict (id) do nothing;

  select exists(
    select 1
    from public.daily_activity
    where user_id = p_user_id
      and activity_date = p_activity_date
  ) into v_today_exists;

  v_xp_gain := greatest(coalesce(p_base_xp, 0), 0) + greatest(coalesce(p_attachment_bonus, 0), 0);
  if not v_today_exists then
    v_xp_gain := v_xp_gain + 20;
  end if;

  insert into public.daily_activity (
    user_id,
    activity_date,
    messages_count,
    qbank_messages,
    abroad_messages,
    xp_earned
  )
  values (
    p_user_id,
    p_activity_date,
    greatest(coalesce(p_message_count, 1), 1),
    case when p_product = 'qbank' then greatest(coalesce(p_message_count, 1), 1) else 0 end,
    case when p_product = 'abroad' then greatest(coalesce(p_message_count, 1), 1) else 0 end,
    v_xp_gain
  )
  on conflict (user_id, activity_date) do update
  set
    messages_count = public.daily_activity.messages_count + excluded.messages_count,
    qbank_messages = public.daily_activity.qbank_messages + excluded.qbank_messages,
    abroad_messages = public.daily_activity.abroad_messages + excluded.abroad_messages,
    xp_earned = public.daily_activity.xp_earned + excluded.xp_earned,
    updated_at = now();

  select
    last_active_date,
    coalesce(streak_days, 0)
  into
    v_previous_active,
    v_previous_streak
  from public.profiles
  where id = p_user_id
  for update;

  if v_previous_active is null then
    v_new_streak := 1;
  elsif v_previous_active = p_activity_date then
    v_new_streak := greatest(v_previous_streak, 1);
  elsif v_previous_active = (p_activity_date - interval '1 day')::date then
    v_new_streak := v_previous_streak + 1;
  else
    v_new_streak := 1;
  end if;

  update public.profiles
  set
    total_xp = greatest(coalesce(total_xp, 0), 0) + v_xp_gain,
    last_active_date = greatest(coalesce(last_active_date, p_activity_date), p_activity_date),
    streak_days = case
      when last_active_date = p_activity_date then greatest(coalesce(streak_days, 0), 1)
      else v_new_streak
    end,
    longest_streak = greatest(
      coalesce(longest_streak, 0),
      case
        when last_active_date = p_activity_date then greatest(coalesce(streak_days, 0), 1)
        else v_new_streak
      end
    ),
    updated_at = now()
  where id = p_user_id;
end;
$$;
