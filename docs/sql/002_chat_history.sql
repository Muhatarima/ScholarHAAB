create table if not exists public.chat_sessions (
  id text primary key,
  viewer_key text not null,
  product text not null check (product in ('abroad', 'qbank')),
  mode text not null check (mode in ('direct', 'tutor')),
  title text not null,
  last_message_preview text,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chat_sessions_viewer_product_updated_idx
  on public.chat_sessions (viewer_key, product, updated_at desc);

create table if not exists public.chat_messages (
  id text primary key,
  session_id text not null references public.chat_sessions(id) on delete cascade,
  viewer_key text not null,
  product text not null check (product in ('abroad', 'qbank')),
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  sequence_no integer not null,
  created_at timestamptz not null default now()
);

create unique index if not exists chat_messages_session_sequence_idx
  on public.chat_messages (session_id, sequence_no);

create index if not exists chat_messages_viewer_product_created_idx
  on public.chat_messages (viewer_key, product, created_at desc);

create or replace function public.set_updated_at_chat_sessions()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_set_updated_at_chat_sessions on public.chat_sessions;
create trigger trg_set_updated_at_chat_sessions
before update on public.chat_sessions
for each row
execute function public.set_updated_at_chat_sessions();
