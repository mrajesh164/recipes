-- The three tables v1 needs. Read-only to the world; nothing writes through
-- the API at all.
--
-- Writes happen from a laptop, via the seed script and the secret key, which
-- never reaches Vercel. So there is deliberately no insert/update/delete
-- policy anywhere below: the app *cannot* write to these tables, rather than
-- being trusted not to.
--
-- "Automatically expose new tables" is off on this project, so each table also
-- needs an explicit grant to be reachable through the Data API. That is the
-- point -- being public is a line you can see in a migration, not a default
-- you inherited. "Enable automatic RLS" is on, so RLS is already enabled by an
-- event trigger by the time these statements run; the explicit `enable row
-- level security` below is harmless and keeps the migration self-contained if
-- it is ever replayed somewhere without that trigger.

-- -------------------------------------------------------------- recipes ----

create table public.recipes (
  id            uuid primary key default gen_random_uuid(),

  -- Unique so re-running the seed updates rather than duplicates.
  source_url    text not null unique,
  source_name   text not null,          -- "King Arthur Baking"
  title         text not null,

  yield_count   int,                    -- cookies, not "about 3 dozen"
  rating        numeric(2,1),           -- from aggregateRating, when present
  rating_count  int,

  -- The biggest texture lever that is not a ratio. Melted butter skips the
  -- aeration of creaming and develops more gluten, which is most of the
  -- difference between a chewy cookie and a cakey one.
  method        text check (method in ('melted', 'creamed', 'other')),

  bake_temp_f   int,
  bake_minutes  int,
  chills_dough  boolean not null default false,

  -- Roughly half of the big recipe sites return 403 to any automated request,
  -- so part of this corpus is read in a browser and typed in. Recording which
  -- rows those are keeps the parser-health number honest.
  hand_entered  boolean not null default false,

  -- Kept so a bad parse is debuggable instead of lost. Null for hand-entered.
  raw_jsonld    jsonb,

  created_at    timestamptz not null default now()
);

alter table public.recipes enable row level security;

create policy "recipes are readable by anyone"
  on public.recipes for select using (true);

grant select on public.recipes to anon, authenticated;


-- ---------------------------------------------------------- ingredients ----

create table public.ingredients (
  id             uuid primary key default gen_random_uuid(),
  recipe_id      uuid not null references public.recipes(id) on delete cascade,
  position       int  not null,

  -- The source string, always. Everything below is derived from it, and when
  -- a conversion looks wrong this is the only way to find out why.
  raw_text       text not null,

  -- "butter", "flour", "brown sugar". Null when nothing matched, which is a
  -- signal the normalizer needs another synonym rather than a reason to drop
  -- the row.
  canonical_name text,

  -- The only field the comparison reads. Null means "could not convert", and
  -- a null here must exclude the ingredient from a comparison rather than
  -- silently count as zero.
  grams          numeric,

  -- 'stated'   -- the source already gave grams, e.g. "2/3 cup (142g)"
  -- 'converted'-- we multiplied a volume by a density
  grams_source   text check (grams_source in ('stated', 'converted')),

  -- What to show a person, so the UI never re-parses raw_text.
  display_qty    text,                  -- "¾"
  display_unit   text,                  -- "cup"

  unique (recipe_id, position)
);

alter table public.ingredients enable row level security;

create policy "ingredients are readable by anyone"
  on public.ingredients for select using (true);

grant select on public.ingredients to anon, authenticated;

-- Postgres does not index foreign keys automatically, and every page load
-- joins this way.
create index ingredients_recipe_id_idx on public.ingredients (recipe_id);


-- -------------------------------------------------------- texture_scores ----

-- Computed at seed time, not per request. It is a pure function of the ratios
-- plus `method`, so there is nothing to recompute between seeds -- and keeping
-- it in a column means the recommendation is an ORDER BY, and the scoring is
-- inspectable in the database rather than buried in a handler.
create table public.texture_scores (
  recipe_id   uuid primary key references public.recipes(id) on delete cascade,
  chewy       numeric not null,
  cakey       numeric not null,
  crispy      numeric not null,
  computed_at timestamptz not null default now()
);

alter table public.texture_scores enable row level security;

create policy "texture scores are readable by anyone"
  on public.texture_scores for select using (true);

grant select on public.texture_scores to anon, authenticated;
