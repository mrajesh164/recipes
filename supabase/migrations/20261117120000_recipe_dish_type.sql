-- The corpus is no longer only chocolate chip cookies.
--
-- It needed to be roughly 200 recipes and was 13. There are not 200 chocolate
-- chip cookies on the twelve sites that answer an automated request -- King
-- Arthur, the richest of them, has twelve -- so the corpus widened to other
-- drop cookies: oatmeal, peanut butter, sugar, snickerdoodle. They are mixed
-- and scooped the same way, so their ratios are comparable.
--
-- "Comparable" is not "interchangeable". The texture scoring is calibrated on
-- chocolate chip cookies, and an oatmeal cookie's oats read as flour that is
-- not there. Recording which dish each recipe is lets the app compare like
-- with like rather than silently ranking a snickerdoodle against a Toll House
-- clone -- and lets it say which it is doing.
--
-- Nullable, because the hand-entered rows predate it and a null here means
-- "nobody has said", not "chocolate chip".

alter table public.recipes
  add column if not exists dish_type text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'recipes_dish_type_check'
  ) then
    alter table public.recipes
      add constraint recipes_dish_type_check
      check (dish_type in (
        'chocolate chip', 'oatmeal', 'peanut butter', 'sugar', 'snickerdoodle'
      ));
  end if;
end $$;

comment on column public.recipes.dish_type is
  'Which drop cookie this is. The texture scoring is calibrated on chocolate '
  'chip; the others are comparable, not interchangeable. Null for rows that '
  'predate the widening.';
