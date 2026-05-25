create table if not exists public.payment_logs (
  id bigserial primary key,
  tran_id text not null unique,
  user_id uuid references auth.users(id) on delete set null,
  amount integer not null,
  status text not null default 'pending',
  val_id text,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists payment_logs_user_id_idx on public.payment_logs(user_id);
create index if not exists payment_logs_status_idx on public.payment_logs(status);
