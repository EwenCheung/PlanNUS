-- RAG UPDATE SCRIPT
-- Copy and run this in your Supabase SQL Editor to enable AI features
-- This is safe to run on an existing database with data.

-- 1. Enable the Vector extension
create extension if not exists vector
with schema public;

-- 2. Add the embedding column to your EXISTING modules table
-- (This will not delete any data)
alter table "modules" 
add column if not exists "embedding" vector(1536);

-- 3. Create the search function for the AI Agent
-- This allows the agent to find similar modules by meaning
create or replace function match_modules (
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
returns table (
  module_code varchar,
  title varchar,
  description text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    modules.module_code,
    modules.title,
    modules.description,
    1 - (modules.embedding <=> query_embedding) as similarity
  from modules
  where 1 - (modules.embedding <=> query_embedding) > match_threshold
  order by modules.embedding <=> query_embedding
  limit match_count;
end;
$$;
