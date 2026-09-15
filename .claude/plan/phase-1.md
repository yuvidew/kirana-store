# Phase 1 — Setup & Authentication (PRD 2.1)

## Context

The repo is a fresh `create-next-app` scaffold (Next.js 16.3.5 / React 19.2.8)
plus one commit that ran `npx shadcn init` and added ~60 shadcn primitives
(`base-vega` style, `components.json` configured). Folder skeletons for every
feature (`src/features/*`, `src/app/(protected)/*`, `src/app/api/*`) already
exist as empty `.gitkeep` placeholders per `CLAUDE.md`'s conventions — nothing
has actual code yet. `prisma/` is empty, no `@prisma/client`/`prisma`/`jose`/
`bcryptjs`/`@tanstack/react-query`/`axios`/`react-hook-form`/`zod` are
installed, and `src/app/layout.tsx` / `page.tsx` are still the stock
create-next-app boilerplate (no `TooltipProvider`, no `QueryClientProvider`).

This phase turns that scaffold into a working app shell with real
authentication, per PRD section 2.1 ("Login Page": email+password fields,
default/pre-set admin credentials, no signup flow, error message on invalid
credentials, optional remember-me) and `CLAUDE.md`'s hand-rolled-auth
convention (`session.ts` + `dal.ts` + `proxy.ts`). It also stands up the
Prisma/MySQL data layer (`Product`, `Bill`, `BillItem`, `StockMovement`) that
every later phase depends on, since nothing can be built before the DB exists.

Next.js 16's own reference auth guide
(`node_modules/next/dist/docs/01-app/02-guides/authentication.md`) describes
almost exactly this pattern — `lib/session.ts` (jose encrypt/decrypt + `cookies()`),
an **optimistic** `proxy.ts` cookie-presence check, and a `cache()`-wrapped
`verifySession()` in `lib/dal.ts` as the real enforcement point — confirming
`CLAUDE.md`'s convention is intentional and not just aspirational. Key 16-specific
constraints confirmed from the docs:
- `src/proxy.ts` (not `middleware.ts`) exporting `proxy(request)`; runtime is
  fixed to **Node.js only** (no Edge) — fine, since we need `bcryptjs`/`jose`
  which are Node-friendly anyway.
- `cookies()` (from `next/headers`) is **async** everywhere; only settable
  inside Server Actions/Route Handlers, not during Server Component render.
- A proxy matcher that excludes a path also skips Server Action POSTs to that
  path — so `verifySession()` inside the action/DAL is the real boundary,
  never the proxy matcher alone (this matches `CLAUDE.md` already).

**Decisions locked in with the user:**
- MySQL: user will point `DATABASE_URL` at their own directly-installed local
  MySQL server (no Docker Compose, no managed cloud provider setup by us).
- Password hashing: `bcryptjs` (pure JS, no native build step — avoids
  node-gyp friction on Windows).
- Shell setup (`QueryClientProvider`, axios instance, `TooltipProvider`) is
  included in this phase, not deferred to Phase 2, since every later feature
  needs it and it's a handful of small foundational files.

---

## 1. Dependencies to add

```
npm install @prisma/client jose bcryptjs @tanstack/react-query axios react-hook-form zod @hookform/resolvers
npm install -D prisma @types/bcryptjs
```

Then `npx shadcn add form` (generates `src/components/ui/form.tsx` — needed
for the login form; not yet present despite the other 60 components).

## 2. Database & Prisma

- `npx prisma init --datasource-provider mysql` — reconcile the generated
  `.env`/`schema.prisma` with the existing `.env.example` vars (don't
  duplicate/overwrite `SESSION_SECRET`/`ADMIN_EMAIL`/`ADMIN_PASSWORD_HASH`).
- `prisma/schema.prisma` — define the four models the plan doc calls for:
  - `Product`: `id, name, price Decimal, unit String, stock Decimal, isActive Boolean @default(true), createdAt, updatedAt`
  - `Bill`: `id, customerName String?, customerPhone String?, totalAmount Decimal, createdAt`, relation to `BillItem[]`/`StockMovement[]`
  - `BillItem`: `id, billId, productId, quantity Decimal, unitPrice Decimal, lineTotal Decimal` (snapshot price at sale time, per PRD 2.4's "auto price + total calculation")
  - `StockMovement`: `id, productId, type` (enum `RECEIVED`/`SOLD`), `quantity Decimal, billId Int?` (set only for `SOLD` movements), `createdAt`
- `src/lib/db.ts` — the standard Next.js Prisma singleton pattern (cache on
  `globalThis` in dev to survive hot-reload without exhausting connections).
- `npx prisma migrate dev --name init` against the user's local MySQL to
  create the tables (run during verification, not blind — needs their real
  `DATABASE_URL` in `.env.local` first).

## 3. Auth core (`src/lib/`)

- `src/lib/session.ts` — `encrypt`/`decrypt` a JWT payload via `jose`
  (`SignJWT`/`jwtVerify`, `SESSION_SECRET`), `createSession()` (sets the
  HTTP-only cookie, longer `maxAge` if "remember me" was checked),
  `deleteSession()` (clears it). Mirrors the official `app/lib/session.ts`
  pattern from the Next.js auth guide almost verbatim.
- `src/lib/dal.ts` — `verifySession()` wrapped in React's `cache()`: reads
  the cookie via `await cookies()`, decrypts it, redirects to `/login` if
  invalid/missing. This is the real authorization boundary called from every
  protected Route Handler/layout, per `CLAUDE.md`.
- `src/proxy.ts` — optimistic check only (cookie presence + well-formed,
  no DB/JWT-verify call): redirect unauthenticated requests hitting
  `(protected)` routes to `/login`, redirect already-authenticated requests
  hitting `/login` to `/dashboard`. `config.matcher` excludes `_next/*`,
  static assets, and `favicon.ico`.

## 4. Auth feature (`src/features/auth/`)

- `src/features/auth/actions.ts` — `'use server'`:
  - `login(prevState, formData)`: validates email against `ADMIN_EMAIL`,
    compares password via `bcryptjs.compare` against `ADMIN_PASSWORD_HASH`;
    on success calls `createSession()` + `redirect('/dashboard')`; on failure
    returns `{ error: 'Invalid email or password' }` for `useActionState`
    (matches PRD 2.1's single generic error message, no user enumeration).
  - `logout()`: calls `deleteSession()` + `redirect('/login')`.
- `src/features/auth/types.ts` — `LoginFormState` etc.
- `src/features/auth/_components/login-form.tsx` — `'use client'`, shadcn
  `form`/`input`/`button`/`checkbox` (remember me), driven by
  `useActionState(login, initialState)`.
- `src/app/login/page.tsx` — renders `LoginForm` only, no Prisma/axios calls
  (routing-only, per `CLAUDE.md`).

## 5. Protected shell

- `src/app/(protected)/layout.tsx` — calls `verifySession()` (defense in
  depth behind the proxy's optimistic check), renders a minimal top bar with
  a logout button (form bound to the `logout()` action) plus `children`. Kept
  intentionally bare — the real sidebar/topbar shell is later-phase UI work,
  but Phase 1 needs *some* logout affordance to be end-to-end testable.
- `src/app/page.tsx` — replace the stock starter page with
  `redirect('/dashboard')` (the proxy then bounces unauthenticated visitors
  to `/login`).

## 6. Global app shell

- `src/components/providers/query-provider.tsx` — `'use client'`,
  `QueryClientProvider` with `QueryClient` via `useState(() => new QueryClient())`.
- `src/lib/axios.ts` — shared axios instance (`baseURL: '/api'`) that every
  feature's `features/<name>/api/index.ts` will import later.
- `src/app/layout.tsx` — wrap `children` in `TooltipProvider` (required by
  `CLAUDE.md` before any tooltip-using shadcn component renders) and
  `QueryProvider`; replace the `metadata` title/description
  ("Create Next App" boilerplate) with real app values.

## 7. Env

- `.env.example` already declares the right four vars — no changes needed
  there.
- `.env.local` (gitignored, user-supplied): real `DATABASE_URL` for their
  local MySQL, a random `SESSION_SECRET`, `ADMIN_EMAIL`, and
  `ADMIN_PASSWORD_HASH` (generate via a one-off
  `node -e "console.log(require('bcryptjs').hashSync('<password>', 10))"`).

---

## Verification (end-to-end)

1. `npm install`, then `npx shadcn add form`.
2. Fill in `.env.local`; run `npx prisma migrate dev --name init` and confirm
   the four tables exist in the local MySQL database.
3. `npm run dev` → visit `/login`:
   - Wrong credentials → generic "Invalid email or password" shown, no
     redirect.
   - Correct credentials → redirected to `/dashboard`; devtools Application
     tab shows the session cookie as `HttpOnly`.
4. Open `/dashboard` in an incognito window (no cookie) → redirected to
   `/login` (proves `proxy.ts`'s optimistic check).
5. Click logout from the protected layout → cookie cleared, redirected to
   `/login`; re-visiting `/dashboard` redirects to `/login` again (proves
   `deleteSession()` + both enforcement layers).
6. `npm run lint` and `npx tsc --noEmit` clean.
