import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

/**
 * Protected by default; a short list of routes stays open.
 *
 * Allow-listing the public routes rather than enumerating the private ones
 * means a route added later is protected unless someone says otherwise, which
 * is the safer direction to be wrong in. Same shape as wanderlist2.
 *
 * `/` is open on purpose. The picker on it requires sign-in -- the core task
 * is gated, as asked -- but the page itself still says what this is and shows
 * the cookies, so a classmate or a grader opening the link learns what they
 * are being asked to sign in *for*. A bare sign-in wall is the dead-end empty
 * screen Assignment 3 was about avoiding.
 */
const isPublicRoute = createRouteMatcher(["/", "/sign-in(.*)", "/sign-up(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return;

  // Without unauthenticatedUrl, auth.protect() answers a signed-out request
  // with 404 rather than a redirect -- deliberate on Clerk's part, so a
  // protected route does not reveal that it exists. Here that trade is not
  // worth it: /saved is linked from our own header, so its existence is not a
  // secret, and a bookmarked link after the session expires should land on
  // sign-in rather than a dead end.
  await auth.protect({ unauthenticatedUrl: new URL("/sign-in", req.url).toString() });
});

export const config = {
  matcher: [
    // Everything except Next internals and static files, plus always run on
    // API routes.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
