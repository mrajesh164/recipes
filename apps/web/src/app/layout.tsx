import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono, Dancing_Script } from "next/font/google";
import {
  ClerkProvider,
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/nextjs";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

/**
 * The wordmark face. Display only -- a script at body size is hard to read,
 * and the whole point of the chalky palette is that the interface stays quiet
 * so the photographs can be loud.
 */
const script = Dancing_Script({
  variable: "--font-script",
  subsets: ["latin"],
  weight: ["600", "700"],
});

export const metadata: Metadata = {
  title: "The Perfect Batch",
  description:
    "Say how you want your cookies to come out and this picks one of the real recipes it has, showing the ratios behind the choice.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${script.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {/* Inside <body>, not around <html>. Current Clerk Next.js SDKs
            require it here. */}
        <ClerkProvider>
          <div className="scallop" aria-hidden />

          <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-6 py-4">
            <Link
              href="/"
              className="font-script text-xl font-bold leading-none text-clay-deep hover:text-clay sm:text-2xl"
            >
              The Perfect Batch
            </Link>

            {/* Auth state is runtime data, and Cache Components will not
                prerender a route that reads it outside a boundary -- it fails
                the build on /_not-found, not just here. The fallback reserves
                the same height so the header does not jump when it resolves. */}
            {/* Pills, not bare links. On an opaque header these would read as
                navigation on their own; on the sprinkled background they read
                as text floating over a pattern until the cursor finds them. */}
            <nav className="flex min-h-[2.5rem] items-center gap-2">
              <Suspense fallback={<span className="h-10" aria-hidden />}>
              <Show when="signed-in">
                {/* Secondary to the task on the home page, deliberately. */}
                <Link href="/recipes" className="rounded-full border border-line bg-paper whitespace-nowrap px-3 py-2 text-sm font-semibold text-ink transition-colors hover:border-pink-deep hover:bg-cream-deep sm:px-4">
                  All recipes
                </Link>
                <Link href="/saved" className="rounded-full border border-line bg-paper whitespace-nowrap px-3 py-2 text-sm font-semibold text-ink transition-colors hover:border-pink-deep hover:bg-cream-deep sm:px-4">
                  Saved
                </Link>
                <UserButton />
              </Show>

              <Show when="signed-out">
                <SignInButton mode="modal">
                  <button
                    type="button"
                    className="rounded-full border border-line bg-paper whitespace-nowrap px-3 py-2 text-sm font-semibold text-ink transition-colors hover:border-pink-deep hover:bg-cream-deep sm:px-4"
                  >
                    Sign in
                  </button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button
                    type="button"
                    className="whitespace-nowrap rounded-full bg-clay-deep px-3 py-2 text-sm font-semibold text-paper hover:bg-clay sm:px-4"
                  >
                    Sign up
                  </button>
                </SignUpButton>
              </Show>
              </Suspense>
            </nav>
          </header>

          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
