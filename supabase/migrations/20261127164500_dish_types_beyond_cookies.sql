-- The corpus is no longer only cookies.
--
-- The previous migration widened it from chocolate chip to five drop cookies
-- and wrote that list into a check constraint. That was the right call at the
-- time: it is the constraint that would have caught a typo'd dish_type, and a
-- null means "nobody has said" rather than a default.
--
-- It is now the thing standing in the way. The corpus covers brownies,
-- blondies, muffins, quick breads and scones, and every one of those rows
-- would be rejected by the database -- most of the corpus, failing on insert
-- with a constraint error rather than anything that reads as a data problem.
--
-- Worth saying why the list is still a check and not an enum or a lookup
-- table: it changes once per category, seeding is the only writer, and the
-- failure it exists to catch is a misspelling in a script run from a laptop.
-- A check constraint is the cheapest thing that catches that, and the error
-- it raises names the column.
--
-- Note that the dish and its form are different questions. 'brownie' and
-- 'blondie' are both baked in a pan and compared against each other;
-- 'banana bread', 'pumpkin bread' and 'zucchini bread' are all loaves. The
-- form each dish belongs to lives in the corpus code, which is where the
-- comparison windows are built -- the database only needs to agree about
-- which names are real.

alter table public.recipes
  drop constraint if exists recipes_dish_type_check;

alter table public.recipes
  add constraint recipes_dish_type_check
  check (dish_type in (
    -- Cookies, told apart by what is in them.
    'chocolate chip', 'oatmeal', 'peanut butter', 'sugar', 'snickerdoodle',
    -- Everything else, told apart by what it is.
    'brownie', 'blondie',
    'muffin',
    'banana bread', 'pumpkin bread', 'zucchini bread',
    'scone'
  ));

comment on column public.recipes.dish_type is
  'Which baked good this is. Cookies are named by flavour, everything else by '
  'form. The form a dish belongs to, and the ratio windows each form is '
  'compared against, live in the corpus code. Null for rows that predate the '
  'widening.';
