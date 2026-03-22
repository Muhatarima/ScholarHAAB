create table if not exists public.abroad_scholarships (
  id text primary key,
  title text not null,
  provider text,
  jurisdiction text,
  degree_levels jsonb not null default '[]'::jsonb,
  fields_of_study jsonb not null default '[]'::jsonb,
  funding_type text,
  funding_amount_text text,
  deadline_annual text,
  deadline_notes text,
  official_url text,
  last_checked text,
  authenticity_status text,
  live_answer_mode text,
  caution text,
  search_text text not null,
  fts tsvector generated always as (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(search_text, ''))
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists abroad_scholarships_fts_idx
  on public.abroad_scholarships using gin (fts);

create index if not exists abroad_scholarships_country_idx
  on public.abroad_scholarships (jurisdiction);

create table if not exists public.abroad_guidance (
  id text primary key,
  record_type text not null,
  jurisdiction text not null,
  topic text not null,
  title text not null,
  content text not null,
  source_url text,
  source_kind text not null,
  last_checked text,
  tags jsonb not null default '[]'::jsonb,
  fts tsvector generated always as (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(topic, '') || ' ' || coalesce(content, ''))
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists abroad_guidance_fts_idx
  on public.abroad_guidance using gin (fts);

create index if not exists abroad_guidance_jurisdiction_idx
  on public.abroad_guidance (jurisdiction);

create table if not exists public.abroad_document_cases (
  id text primary key,
  rubric_type text not null,
  quality_band text,
  input_text text not null,
  output_text text not null,
  tags jsonb not null default '[]'::jsonb,
  search_text text not null,
  fts tsvector generated always as (
    to_tsvector('english', coalesce(search_text, ''))
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists abroad_document_cases_fts_idx
  on public.abroad_document_cases using gin (fts);

create or replace function public.set_updated_at_abroad_knowledge()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_set_updated_at_abroad_scholarships on public.abroad_scholarships;
create trigger trg_set_updated_at_abroad_scholarships
before update on public.abroad_scholarships
for each row
execute function public.set_updated_at_abroad_knowledge();

drop trigger if exists trg_set_updated_at_abroad_guidance on public.abroad_guidance;
create trigger trg_set_updated_at_abroad_guidance
before update on public.abroad_guidance
for each row
execute function public.set_updated_at_abroad_knowledge();

drop trigger if exists trg_set_updated_at_abroad_document_cases on public.abroad_document_cases;
create trigger trg_set_updated_at_abroad_document_cases
before update on public.abroad_document_cases
for each row
execute function public.set_updated_at_abroad_knowledge();
