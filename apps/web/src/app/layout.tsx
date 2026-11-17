import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
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

export const metadata: Metadata = {
  title: "Which chocolate chip cookie recipe should I make?",
  description:
    "Say how you want your cookies to come out and this picks one of the real recipes it has, showing the ratios behind the choice.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {/* Inside <body>, not around <html>. Current Clerk Next.js SDKs
            require it here. */}
        <ClerkProvider>
          <div className="scallop" aria-hidden />

          <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-6 py-4">
            <Link
              href="/"
              className="text-sm font-bold tracking-tight hover:text-clay-deep"
            >
              Cookie ratios
            </Link>

            {/* Auth state is runtime data, and Cache Components will not
                prerender a route that reads it outside a boundary -- it fails
                the build on /_not-found, not just here. The fallback reserves
                the same height so the header does not jump when it resolves. */}
            <nav className="flex min-h-[2.5rem] items-center gap-3">
              <Suspense fallback={<span className="h-10" aria-hidden />}>
              <Show when="signed-in">
                <Link
                  href="/saved"
                  className="rounded-full px-3 py-2 text-sm font-medium hover:bg-cream-deep"
                >
                  Saved
                </Link>
                <UserButton />
              </Show>

              <Show when="signed-out">
                <SignInButton mode="modal">
                  <button
                    type="button"
                    className="rounded-full px-4 py-2 text-sm font-medium hover:bg-cream-deep"
                  >
                    Sign in
                  </button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button
                    type="button"
                    className="rounded-full bg-clay-deep px-4 py-2 text-sm font-semibold text-paper hover:bg-clay"
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
