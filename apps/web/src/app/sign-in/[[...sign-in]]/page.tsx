import { Suspense } from "react";
import { SignIn } from "@clerk/nextjs";

/**
 * Clerk's <SignIn /> reads the URL via usePathname() internally. Under Cache
 * Components that counts as runtime data, so without a boundary the route
 * cannot be prerendered and the build fails.
 */
export default function Page() {
  return (
    <main className="mx-auto flex max-w-md flex-1 flex-col items-center px-6 py-16">
      <Suspense fallback={<p className="text-sm text-ink-soft">Loading sign in…</p>}>
        <SignIn />
      </Suspense>
    </main>
  );
}
