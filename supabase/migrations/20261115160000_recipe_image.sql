-- Every recipe in the corpus already carries an image URL in its structured
-- data -- image is a required property for Google's recipe rich results, so
-- any page that publishes a Recipe publishes a photograph with it. It was in
-- raw_jsonld all along and simply never read out.
--
-- Photography is what makes a baking site feel like somewhere you want to
-- bake from. Without it the interface has to generate all its own warmth,
-- which is a losing fight against thirteen pictures of cookies.

alter table public.recipes add column image_url text;

comment on column public.recipes.image_url is
  'From schema.org Recipe.image. Null when the source published none.';
