/**
 * Hosts that refuse Vercel's image optimiser.
 *
 * Three of the sites in the corpus answer a request from a laptop and refuse
 * one from a datacentre, which is what Vercel's optimiser is. The source image
 * returns 200 from here and the deployed site returns 502 with
 * OPTIMIZED_EXTERNAL_IMAGE_REQUEST_UNAUTHORIZED -- the host said no, and Vercel
 * reports that as the request being unauthorised.
 *
 * Measured host by host against production: these three fail and the other 22
 * return 200, which is 169 of 1,385 recipes showing a broken-image icon.
 *
 * The way out is to not optimise them. The browser then fetches the photograph
 * itself, from the reader's own address, which these hosts are happy to serve.
 * It costs size -- 102 to 253 KB rather than about 28 KB for an optimised
 * tile -- and that is the right trade for a picture that otherwise does not
 * appear at all. It applies to 12% of the corpus, not all of it.
 *
 * Not a permanent fix so much as an honest one: if a host changes its mind the
 * only cost of leaving it here is a larger file.
 */
const REFUSES_OPTIMISER = new Set([
  "www.averiecooks.com",
  "barefeetinthekitchen.com",
  "natashaskitchen.com",
]);

export function refusesOptimiser(src: string | null | undefined): boolean {
  if (!src) return false;
  try {
    return REFUSES_OPTIMISER.has(new URL(src, "https://x.invalid").hostname);
  } catch {
    return false;
  }
}
