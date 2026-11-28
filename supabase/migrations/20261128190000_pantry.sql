-- What a reader has in the cupboard.
--
-- One row per item rather than an array on a profile, for the same reason
-- saved_recipes is a row per save: adding and removing one thing is then an
-- insert and a delete rather than a read-modify-write of a whole column, which
-- two tabs open at once would lose.
--
-- The item is stored as the reader typed it, lowercased and trimmed. Matching
-- against a recipe happens in the corpus code, not here -- where the parser has
-- named an ingredient line the pantry has to say that name, and that rule
-- belongs with the parser rather than in SQL.
--
-- unique (user_id, item) so adding the same thing twice is idempotent rather
-- than a duplicate row to deduplicate on read.

create table if not exists public.pantry_items (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null,
  item       text not null,
  created_at timestamptz not null default now(),
  unique (user_id, item)
);

create index if not exists pantry_items_user_id_idx on public.pantry_items (user_id);

alter table public.pantry_items enable row level security;

-- Same three policies as saved_recipes, and the same reasoning: the table has
-- no policy that lets one reader see another's, so a missing policy fails
-- closed rather than open.

drop policy if exists "read own pantry" on public.pantry_items;
create policy "read own pantry"
  on public.pantry_items for select
  using ((auth.jwt() ->> 'sub') = user_id);

drop policy if exists "add to own pantry" on public.pantry_items;
create policy "add to own pantry"
  on public.pantry_items for insert
  with check ((auth.jwt() ->> 'sub') = user_id);

drop policy if exists "remove from own pantry" on public.pantry_items;
create policy "remove from own pantry"
  on public.pantry_items for delete
  using ((auth.jwt() ->> 'sub') = user_id);

comment on table public.pantry_items is
  'One ingredient a reader says they have. Read all at once with their user, '
  'never queried across users. Matching against recipes lives in @recipes/core.';
