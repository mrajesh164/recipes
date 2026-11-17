-- The one table a person owns.
--
-- Everything else in this schema is shared reference data that nobody owns and
-- the app cannot write to. This is the opposite: each row belongs to exactly
-- one Clerk user, and row-level security is the only thing standing between
-- them.
--
-- user_id is TEXT, not uuid. Clerk subjects are strings ("user_2abc..."), so
-- auth.uid() -- which expects a Supabase uuid -- does not work here. Every
-- policy below compares against the JWT's subject claim instead.
--
-- From wanderlist2's AGENTS.md, and worth repeating because it has already
-- cost time once: "This is the single most likely thing to get wrong." It also
-- fails quietly. If Supabase's third-party auth integration is not pointed at
-- the Clerk instance, auth.jwt() ->> 'sub' resolves to null, every policy
-- matches nothing, and the app looks *empty* rather than broken. Rule that out
-- first when saved recipes vanish.
--
-- Written to be safe to run twice: it can be pasted into the Supabase SQL
-- editor by hand and still re-applied later by `supabase db push` without
-- colliding. Policies are dropped before being created because Postgres has
-- no `create policy if not exists`.

create table if not exists public.saved_recipes (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null,
  recipe_id  uuid not null references public.recipes(id) on delete cascade,

  -- What they typed when they saved it. Worth keeping: "quick, no mixer" is a
  -- better reminder of why this recipe is in the list than the title alone,
  -- and it is the raw material for recommending from history later.
  saved_for  text,

  created_at timestamptz not null default now(),

  -- Saving the same recipe twice is a no-op, not a second row.
  unique (user_id, recipe_id)
);

alter table public.saved_recipes enable row level security;

drop policy if exists "read own saves" on public.saved_recipes;
create policy "read own saves"
  on public.saved_recipes for select
  using ((auth.jwt() ->> 'sub') = user_id);

drop policy if exists "create own saves" on public.saved_recipes;
create policy "create own saves"
  on public.saved_recipes for insert
  with check ((auth.jwt() ->> 'sub') = user_id);

drop policy if exists "delete own saves" on public.saved_recipes;
create policy "delete own saves"
  on public.saved_recipes for delete
  using ((auth.jwt() ->> 'sub') = user_id);

-- No update policy. A save has nothing worth editing -- you either saved it or
-- you unsaved it -- and a table with no update path cannot be updated wrongly.

-- "Automatically expose new tables" is off on this project, so without this
-- the table is unreachable through the Data API no matter what the policies
-- say. Only the authenticated role: there is no anonymous use for this table.
grant select, insert, delete on public.saved_recipes to authenticated;

create index if not exists saved_recipes_user_id_idx on public.saved_recipes (user_id);
