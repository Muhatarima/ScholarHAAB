create table if not exists public.llm_usage (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  provider text not null,
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  call_count integer not null default 0,
  estimated_cost_usd double precision not null default 0,
  unique (date, provider, model)
);

create index if not exists idx_llm_usage_date
  on public.llm_usage (date desc);

create or replace function public.increment_llm_usage(
  p_date date,
  p_provider text,
  p_model text,
  p_input_tokens integer,
  p_output_tokens integer,
  p_cost double precision
)
returns void
language plpgsql
as $$
begin
  insert into public.llm_usage (
    date,
    provider,
    model,
    input_tokens,
    output_tokens,
    call_count,
    estimated_cost_usd
  )
  values (
    p_date,
    p_provider,
    p_model,
    greatest(coalesce(p_input_tokens, 0), 0),
    greatest(coalesce(p_output_tokens, 0), 0),
    1,
    greatest(coalesce(p_cost, 0), 0)
  )
  on conflict (date, provider, model) do update
  set
    input_tokens = public.llm_usage.input_tokens + greatest(coalesce(p_input_tokens, 0), 0),
    output_tokens = public.llm_usage.output_tokens + greatest(coalesce(p_output_tokens, 0), 0),
    call_count = public.llm_usage.call_count + 1,
    estimated_cost_usd = public.llm_usage.estimated_cost_usd + greatest(coalesce(p_cost, 0), 0);
end;
$$;
