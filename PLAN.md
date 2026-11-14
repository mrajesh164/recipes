# Project v1 — System Design and Build Plan

Design, Build, Ship · MPCS 51238 · due **Tuesday 17 November, 5:30 PM**
Budget: 7.5–10 hours. Graded against the **Design** focus, held to a higher standard than the rest.

---

## 1. What v1 is

**Core task:** *"I want a chewy chocolate chip cookie. Tell me which recipe to use."*

A new person lands on the live URL, picks a texture, and gets one recommended real
recipe with the evidence for why it was picked. No account required to do this.

Deliberately **not** in v1:

| Cut | Why |
|---|---|
| Tabular Recipe Notation display | Needs ingredient→step grouping that structured data doesn't carry. Deferred by decision on 14 Nov. |
| Any dish but chocolate chip cookies | One dish proves the idea; breadth costs hours and proves nothing extra |
| "Ingredients I have" matching | Different entry point, different matching problem |
| Live web search | Corpus covers v1 |
| Cups/grams toggle | Show both units inline instead; no control to build |
| Saving, history-based recommendations | Post-task, needs auth, needs a history that doesn't exist yet |

**Open decision: does v1 have accounts at all?** The core task doesn't need them, and a
signup wall in front of a fair demo is a cost, not a feature. Clerk is planned below so it
can be added in one slice, but it is scheduled last and is cuttable. Recommendation: ship
the core task signed-out, add Clerk only if there's time on Monday.

---

## 2. Repository

**Naming is an open decision.** The folder is `app/` as a placeholder. The GitHub repo name
is worth five minutes of thought because it ends up in the Vercel URL and on the Classroom
submission. Not `project-v1`.

New repo, not the `project-proposal` one. That repo is a finished artifact with its own
Vercel project; mixing an app into it means the proposal rebuilds every time the app changes.

### Monorepo, with npm workspaces

**Decision, 14 Nov:** this is the final project and it grows past v1, so the package
boundaries go in now rather than being retrofitted.

The concrete justification is a problem already met in `wanderlist2`: one `tsconfig.json`
covering both a Next.js app and non-Next code meant adding `supabase` to the exclude list or
the Next build would try to typecheck the Deno worker and fail. That's two runtimes straining
through one config, and it gets worse with each component added. Workspaces give each runtime
its own config and make the shared-code boundary explicit.

**npm workspaces, not Turborepo or pnpm.** npm is already in use here, workspaces are built
in, and nothing new has to be learned mid-quarter. Turborepo's build graph and remote caching
solve problems that don't exist at this size; that can be added later without moving a file.

```
/
├── package.json                # { "workspaces": ["apps/*", "packages/*"] }
├── .githooks/pre-push          # typecheck, lint, secret scan
├── .claude/settings.json       # deny rules (see §5)
├── .mcp.json                   # Supabase MCP, new project_ref
├── AGENTS.md                   # context file. No CLAUDE.md
├── PLAN.md                     # this file
├── supabase/
│   ├── migrations/             # timestamped, CLI-generated
│   └── seed.sql                # the corpus
├── packages/
│   ├── core/                   # pure logic. No Next, no Node, no network.
│   │   ├── units.ts            #   the normalizer. Unit-tested.
│   │   └── texture.ts          #   ratios + method → chewy/cakey/crispy
│   └── corpus/                 # Node-only. Never bundled for a browser.
│       ├── probe.ts            #   structured-data probe (from the spike)
│       └── seed.ts             #   fetch, parse, normalize, emit seed rows
└── apps/
    └── web/                    # the Next.js app
        ├── next.config.ts
        ├── tsconfig.json
        └── src/{app,components,lib}
```

**Why this split and not some other one.** `core` is the only package with two consumers:
`web` reads it at request time, `corpus` reads it at seed time. That shared dependency is the
actual reason workspaces earn their keep here — without it this would just be folders. Keeping
`core` free of Next, Node and network imports is what makes it testable in isolation and safe
to import from either side.

`corpus` is Node-only on purpose. It touches the filesystem and the network and holds the
service-role key path; nothing in it should ever be reachable from browser code, and a package
boundary makes that a build error rather than a code review.

**Vercel needs two settings and one line of config:**

- Root Directory → `apps/web`. Vercel installs from the repo root and builds that directory.
- `next.config.ts` → `transpilePackages: ["@recipes/core"]`, which lets Next compile the
  workspace package's TypeScript directly. Without it you need a build step per package
  producing `dist/`, which is the main way small monorepos turn tedious.

Expect the first deploy to be the fiddly one. After that it behaves like a single app.

---

## 3. Data model

Three tables. Keep it narrow; the comparison is a query, not a computation.

```
recipes          id, source_url, source_name, title, yield_count,
                 rating, rating_count, method (melted|creamed|other),
                 bake_temp_f, bake_minutes, chills_dough bool,
                 raw_jsonld jsonb, hand_entered bool, created_at

ingredients      id, recipe_id fk, position, raw_text,
                 canonical_name, grams numeric, display_qty, display_unit

texture_scores   recipe_id fk, chewy numeric, cakey numeric, crispy numeric
```

Notes that matter:

- **`grams` is the only thing the comparison reads.** `display_qty`/`display_unit` exist so
  the UI can show "¾ cup (170 g)" without re-parsing. `raw_text` is kept so a bad parse is
  debuggable rather than lost.
- **`hand_entered`** is honest bookkeeping. Roughly half the sites block automated fetching
  (see §8), so part of the corpus is typed in from a browser. Knowing which rows those are
  matters when you report parser health.
- **`texture_scores` is computed at seed time, not at request time.** It's a pure function of
  ratios plus `method`. Precomputing makes the recommendation a sort, keeps the page fast,
  and means the scoring is inspectable in the database rather than hidden in a handler.
- **`method`** carries the melted/creamed distinction. This is the "ratios paired with
  methods" feedback, and it is a bigger texture lever than most ingredient ratios.

### Row-level security

Every table is public-read, nobody-writes. Writes happen through migrations and the seed
script using the service role **from your machine only** — never from the app.

```sql
alter table public.recipes enable row level security;
create policy "recipes are readable by anyone"
  on public.recipes for select using (true);
-- no insert/update/delete policy: the app cannot write, by construction
```

If accounts ship and people save recipes, that table follows the `wanderlist2` pattern:

> **`user_id` is `text`, not `uuid`.** Clerk subjects are strings (`user_2abc…`), so
> `auth.uid()` will not work. Compare against the JWT `sub` claim instead. From your own
> migration comments: *"the single most likely thing to get wrong, and it fails quietly —
> the policies match nothing and the app looks empty rather than broken."*

---

## 4. Environments, databases and keys

### Databases

Supabase's free tier allows two active projects. Two realistic options:

| Option | Setup cost | Verdict |
|---|---|---|
| **Local via `supabase start`** | Docker must be running; first pull is slow | Correct in principle. The Docker dependency is a bad bet with three days left. |
| **One hosted project, migrations as source of truth** | Minutes | **Recommended for v1.** `supabase db reset` rebuilds from migrations + seed whenever you need a clean slate. |

Either way, **migrations are the source of truth** and the schema is never edited by hand in
the dashboard. That's what makes a second environment a ten-minute job later rather than an
archaeology project.

### Keys

| Variable | Where it lives | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local`, Vercel | Public |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `.env.local`, Vercel | Public, RLS-protected |
| `SUPABASE_SERVICE_ROLE_KEY` | `.env.local` **only** | Never in Vercel for v1. Seed scripts run locally. |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `.env.local`, Vercel | `pk_test_*` is fine on `*.vercel.app` |
| `CLERK_SECRET_KEY` | `.env.local`, Vercel | |

**Clerk has dev and prod instances built in.** The dev instance works on localhost and on
`*.vercel.app` with no domain configuration. You do not need a production instance for v1.

**The service role key does not go to Vercel.** `wanderlist2` already establishes the rule —
the app uses the caller's own token so RLS stays in force even server-side. Seeding is a
local operation, so the service key never needs to leave your machine. That removes an entire
category of exposure from the deployed app.

---

## 5. Guardrails

The v1 brief has a security checklist. These satisfy it.

**`.gitignore`** — `.env*` except `.env.example`. Commit `.env.example` with the variable
names and empty values, so the repo documents what's needed without leaking anything.

**`.claude/settings.json`** — the brief requires a deny rule keeping agents out of `.env`.
`wanderlist2` already has exactly this; copy it:

```json
{ "permissions": { "deny": ["Read(**/.env*)", "Edit(**/.env*)", "Write(**/.env*)"] } }
```

**Pre-push hook.** Version-controlled via `core.hooksPath` rather than husky — no dependency,
no install step, one `git config` line:

```bash
git config core.hooksPath .githooks
```

`.githooks/pre-push` should do three things, in this order, cheapest first:

1. **Secret scan** — grep the diff for `sk_live`, `pk_live`, `service_role`, `eyJ`, and
   anything that looks like a Supabase JWT. Refuse the push on a hit.
2. **`tsc --noEmit`** — catches the type error that would otherwise fail the Vercel build
   five minutes later.
3. **`next lint`**

The point is not ceremony. It's that a failed Vercel build on Monday night costs more than
the thirty seconds the hook costs on every push.

**`/security-review`** — run it before you submit, as the brief asks. Not at the end of
Monday; run it Sunday so there's time to act on whatever it finds.

---

## 6. Service setup, in order

1. **Supabase project.** Create it, note the project ref. `supabase link --project-ref <ref>`,
   then `supabase db push` to apply migrations.
2. **`.mcp.json`** — the Supabase MCP is project-level config, read when a session starts in
   this directory. It is not a global connector:
   ```json
   { "mcpServers": { "supabase": { "type": "http",
       "url": "https://mcp.supabase.com/mcp?project_ref=<new-ref>" } } }
   ```
   Worth knowing: this gives an agent real write access to the database. That's fine for
   schema iteration on a project whose data you can rebuild from migrations in seconds, and
   it's exactly why migrations-as-source-of-truth matters.
3. **Vercel.** Import the repo. Framework preset Next.js. Add the env vars (not the service
   key). Deploy before there is anything to see.
4. **Clerk.** Last, and only if accounts ship.

---

## 7. Working with agents

**One issue per vertical slice**, not per file. A slice is something that can be deployed and
looked at. Eight to twelve issues covers v1.

Each issue body carries the acceptance criterion as a sentence a human can check:

```
## Done when
Someone on the live URL can pick "chewy" and see one recommended recipe.

## Not in scope
Styling beyond legibility. The evidence panel (#7).
```

**Flow:**

```bash
gh issue create --title "Normalize ingredient strings to grams" --label slice
git switch -c 12-normalize-units
# ... agent works, scoped to the issue ...
gh pr create --fill --body "Closes #12"
```

Branch names prefixed with the issue number keep the mapping obvious in `git branch` and in
Vercel's preview deploy list.

**Give an agent the issue number, not a paraphrase.** `gh issue view 12` is one command and
the issue is the spec. A paraphrase is a second source of truth that drifts.

**Labels worth having:** `slice` (ships something), `chore` (setup, config), `design` (the
graded surface), `risk` (might not work — do these first).

**Note on permissions:** `hw6/.claude/settings.json` denies `Bash(git push:*)`,
`Bash(git commit:*)` and `Bash(gh issue create:*)`. That was right for a harness that reads
your life data. For this project it would mean approving every commit by hand. Decide
deliberately which of those to allow here — the `.env` deny rule is the one that must stay.

---

## 8. What the spike already settled

Run on 14 Nov against 15 real recipe sites:

- **7 of 11 conclusive tests returned 403.** Allrecipes, Serious Eats, Simply Recipes, Sally's
  Baking Addiction, Preppy Kitchen, Budget Bytes, Cookie and Kate all block automated
  requests, and a full set of real browser headers does not get past it. **Do not build a
  crawler.**
- **Where it works the data is good.** King Arthur, Love and Lemons and Food.com all returned
  full ingredient lists, `HowToStep` instructions, and ratings with counts.
- **King Arthur publishes gram weights inline** — `2/3 cup (142g) light brown sugar, packed`.
  Weighting the corpus toward sources that do this removes most of the normalization problem.
- **Method sometimes lives in the ingredient string** — Love and Lemons writes
  `¾ cup unsalted butter (1½ sticks, melted and cooled slightly)`. Cheaper than parsing
  instructions.
- **Unicode fractions are real.** `¾`, `½`, `⅓` are single characters. A parser that only
  handles `3/4` fails silently and produces wrong numbers, which is worse than crashing.
- **One source served the wrong recipe.** A Food.com cookie URL returned "Apricot Banana
  Bread". Validate at seed time that the title plausibly matches what was requested.

**Corpus approach:** hand-curate 25–40 recipes. Parse the sites that allow it so the pipeline
is genuinely real; for blocked sites, read them in a browser like a person and type the
numbers in. Budget ~90 minutes. Mark `hand_entered` honestly.

---

## 9. Build plan

Deploy after every slice. The live URL exists from slice 0 with nothing on it.

| # | Slice | Done when | Est |
|---|---|---|---|
| 0 | Workspaces + Vercel + Supabase linked | Live URL serves a styled empty page | 75m |
| 1 | Schema + 5 hand-entered recipes | The five appear on the live URL | 45m |
| 2 | `units.ts` + tests | `¾ cup butter` → `170 g`, and the tests prove it | 60m |
| 3 | `texture.ts` scoring | Each recipe has chewy/cakey/crispy numbers in the DB | 45m |
| 4 | **Core task end to end** | Pick a texture → get one recommendation | 60m |
| 5 | Evidence panel | "Why this one" shows 2–3 ratios vs the others | 60m |
| 6 | Corpus to 25–40 | Recommendations stop feeling arbitrary | 90m |
| 7 | **Design pass** | Phone-width, states, type, the graded surface | 120m |
| 8 | Security checklist + `/security-review` | Clean | 30m |
| 9 | Accounts *(cuttable)* | Sign in, save a recipe | 60m |

Slices 0–4 are the submission. Everything after is quality, and slice 7 is where the grade is.

**Sequencing note:** slice 2 before slice 4 looks like a detour but isn't — the recommendation
is meaningless if the numbers it sorts on are wrong, and unit bugs are silent.

---

## 10. Still to do, outside the code

- **User testing (brief step 3).** Give two people the core task on the live URL and watch
  without helping. Write down what they did. The v2 plan is specified as downstream of this,
  so skipping it makes requirement 3 hard to satisfy honestly.
- **The v2 plan** is a graded requirement in its own right.
- **Free tier limits.** Supabase pauses a free project after a week of inactivity — open the
  app once before grading. No model API is in v1, so there is no spend to cap.

---

## 11. Open decisions

1. Repo name
2. Accounts in v1, or cut
3. How many questions before the recommendation — one (texture only) or two or three
4. Second option shown alongside, or behind a tap
