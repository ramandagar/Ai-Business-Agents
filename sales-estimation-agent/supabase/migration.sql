-- ============================================================
-- Supabase pgvector migration for Sales Agent RAG
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. Enable pgvector extension
create extension if not exists vector with schema "public";

-- 2. Projects table (past projects, portfolio items)
create table if not exists projects (
  id          bigint generated always as identity primary key,
  name        text not null,
  description text not null,
  cost        integer,
  currency    text default 'INR',
  timeline    text,
  scope       text,
  impact      text,
  tech_stack  text[] default '{}',
  live_url    text,
  image_url   text,
  category    text,
  embedding   vector(3072),
  created_at  timestamptz default now()
);

-- 3. Documents table (uploaded PDFs, proposals, case studies)
create table if not exists documents (
  id          bigint generated always as identity primary key,
  filename    text not null,
  content     text not null,
  source_type text default 'upload',  -- 'upload', 'proposal', 'case_study'
  metadata    jsonb default '{}',
  embedding   vector(3072),
  created_at  timestamptz default now()
);

-- 4. Services table (from pricing.json + any custom services)
create table if not exists services (
  id          bigint generated always as identity primary key,
  name        text not null,
  tags        text[] default '{}',
  min_price   integer not null,
  max_price   integer not null,
  currency    text default 'INR',
  timeline    text,
  includes    text[] default '{}',
  description text,
  embedding   vector(3072),
  created_at  timestamptz default now()
);

-- 5. Similarity search function for projects
create or replace function match_projects(
  query_embedding vector(3072),
  match_count int default 5,
  match_threshold float default 0.5
)
returns table (
  id bigint,
  name text,
  description text,
  cost integer,
  currency text,
  timeline text,
  scope text,
  impact text,
  tech_stack text[],
  live_url text,
  image_url text,
  category text,
  similarity float
)
language sql stable
as $$
  select
    id, name, description, cost, currency, timeline, scope, impact,
    tech_stack, live_url, image_url, category,
    1 - (embedding <=> query_embedding) as similarity
  from projects
  where embedding is not null
    and 1 - (embedding <=> query_embedding) > match_threshold
  order by embedding <=> query_embedding
  limit match_count;
$$;

-- 6. Similarity search function for documents
create or replace function match_documents(
  query_embedding vector(3072),
  match_count int default 5,
  match_threshold float default 0.5
)
returns table (
  id bigint,
  filename text,
  content text,
  source_type text,
  metadata jsonb,
  similarity float
)
language sql stable
as $$
  select
    id, filename, content, source_type, metadata,
    1 - (embedding <=> query_embedding) as similarity
  from documents
  where embedding is not null
    and 1 - (embedding <=> query_embedding) > match_threshold
  order by embedding <=> query_embedding
  limit match_count;
$$;

-- 7. Similarity search function for services
create or replace function match_services(
  query_embedding vector(3072),
  match_count int default 5,
  match_threshold float default 0.4
)
returns table (
  id bigint,
  name text,
  tags text[],
  min_price integer,
  max_price integer,
  currency text,
  timeline text,
  includes text[],
  description text,
  similarity float
)
language sql stable
as $$
  select
    id, name, tags, min_price, max_price, currency, timeline,
    includes, description,
    1 - (embedding <=> query_embedding) as similarity
  from services
  where embedding is not null
    and 1 - (embedding <=> query_embedding) > match_threshold
  order by embedding <=> query_embedding
  limit match_count;
$$;

-- 8. Unified search across all tables
create or replace function match_all(
  query_embedding vector(3072),
  match_count int default 8,
  match_threshold float default 0.4
)
returns table (
  source text,
  id bigint,
  content text,
  metadata jsonb,
  similarity float
)
language sql stable
as $$
  select 'project' as source, id,
    name || ': ' || description as content,
    jsonb_build_object(
      'name', name, 'cost', cost, 'currency', currency,
      'timeline', timeline, 'scope', scope, 'impact', impact,
      'live_url', live_url, 'image_url', image_url, 'category', category
    ) as metadata,
    1 - (embedding <=> query_embedding) as similarity
  from projects where embedding is not null
    and 1 - (embedding <=> query_embedding) > match_threshold

  union all

  select 'document' as source, id,
    content,
    jsonb_build_object('filename', filename, 'source_type', source_type) || coalesce(metadata, '{}'::jsonb),
    1 - (embedding <=> query_embedding) as similarity
  from documents where embedding is not null
    and 1 - (embedding <=> query_embedding) > match_threshold

  union all

  select 'service' as source, id,
    name || ': ' || coalesce(description, '') as content,
    jsonb_build_object(
      'name', name, 'tags', tags, 'min_price', min_price,
      'max_price', max_price, 'currency', currency,
      'timeline', timeline, 'includes', includes
    ) as metadata,
    1 - (embedding <=> query_embedding) as similarity
  from services where embedding is not null
    and 1 - (embedding <=> query_embedding) > match_threshold

  order by similarity desc
  limit match_count;
$$;

-- 9. Enable Row Level Security (allow anon read for service role)
alter table projects enable row level security;
alter table documents enable row level security;
alter table services enable row level security;

-- Allow service role (backend) full access
create policy "Service role full access on projects" on projects
  for all using (auth.role() = 'service_role');

create policy "Service role full access on documents" on documents
  for all using (auth.role() = 'service_role');

create policy "Service role full access on services" on services
  for all using (auth.role() = 'service_role');

-- Allow anon key to read (for client-side if needed later)
create policy "Public read projects" on projects
  for select using (true);

create policy "Public read services" on services
  for select using (true);
