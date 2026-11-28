-- What people wrote about a recipe, so the app can quote them.
--
-- Everything the recommendation says today is inferred from an ingredient
-- list: butter per flour, brown sugar share, whether the method creams or
-- melts. A review is the only place in the corpus where somebody says how the
-- thing actually came out of the oven, which makes it the only direct evidence
-- there is -- and when a reviewer uses the same word the reader typed, that is
-- a better answer to "why this one" than another plot of the same three
-- ratios.
--
-- The text was already being collected: schema.org puts it in the review
-- array of the Recipe node, and raw_jsonld has held it all along. It is
-- extracted into its own column rather than read out of the blob because
-- raw_jsonld is deliberately not selected by the app -- it is the whole
-- structured-data document per recipe, and fetching it to reach four short
-- strings would put megabytes on the wire.
--
-- text[] rather than a reviews table: these are read all-or-nothing with their
-- recipe, never queried across recipes, never joined, and capped at four each
-- by the extractor. A table would buy indexing nobody needs and cost a join on
-- every read.
--
-- Nullable, because 743 of the 1,385 recipes publish no review text at all,
-- and an empty array would claim we looked and found none when for some sites
-- there was never anything to look at.

alter table public.recipes
  add column if not exists reviews text[];

comment on column public.recipes.reviews is
  'Review bodies from the page''s schema.org data, whitespace collapsed, at '
  'most four, each truncated to 180 characters. Null where the page published '
  'none. Quoted in the app when a reviewer uses the word the reader asked for.';
