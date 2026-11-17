import { Suspense } from "react";
import { SignUp } from "@clerk/nextjs";

export default function Page() {
  return (
    <main className="mx-auto flex max-w-md flex-1 flex-col items-center px-6 py-16">
      <Suspense fallback={<p className="text-sm text-ink-soft">Loading sign up…</p>}>
        <SignUp />
      </Suspense>
    </main>
  );
}
