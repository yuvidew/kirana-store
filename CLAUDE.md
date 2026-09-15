@AGENTS.md

# Kirana Store — Project Conventions

## Stack
Next.js 16 (App Router) + React 19 + TypeScript + Tailwind v4 + shadcn/ui
+ Prisma + MySQL + TanStack Query + axios. Full stack lives in this one
Next.js app. No tRPC — TanStack Query talks to this app's own Route Handlers
via axios (mirrors the `weave` project's pattern, not repo-mind/project-iq's
tRPC pattern).

## Folder structure (per feature: auth, products, billing, bills, dashboard, reports)
- `src/app/` — routing only (page/layout/loading/error). Renders a feature's
  `*-view.tsx`; no Prisma/axios calls here directly.
- `src/app/api/<resource>/route.ts` — Route Handlers; the backend TanStack
  Query calls. Always call `verifySession()` (from `lib/dal.ts`) before
  touching Prisma.
- `src/features/<name>/api/index.ts` — axios functions calling this app's
  own `/api/*` routes, typed against `types.ts`. One function per endpoint.
- `src/features/<name>/hook/use-*.ts` — TanStack Query hooks wrapping the
  api functions (`useQuery`/`useMutation`). Mutations invalidate the
  relevant `queryKey`(s) in `onSuccess` and surface a toast on both
  success and error.
- `src/features/<name>/types.ts` — flat file of request/response types.
- `src/features/<name>/_components/` — feature UI; the page-level
  composition is named `<name>-view.tsx` and is what `app/.../page.tsx`
  renders.
- `src/features/auth/` is the exception: `actions.ts` holds `'use server'`
  Server Actions for login/logout (no axios/TanStack here) — matches
  Next.js's own recommended auth pattern.
- `src/components/ui/` — shadcn primitives only. Add with
  `npx shadcn add <name>`; never hand-edit generated files.
- `src/components/layout/` — shared shell UI (sidebar, topbar).
- `src/components/providers/query-provider.tsx` — the `QueryClientProvider`,
  `'use client'`, `QueryClient` created via `useState(() => new QueryClient())`.
  Imported once in the root `layout.tsx`.
- `src/lib/` — cross-cutting singletons: `db.ts` (Prisma client), `session.ts`,
  `dal.ts`, `utils.ts`.
- `prisma/schema.prisma` — all models in one file.

## Auth (hand-rolled, no auth library)
- `src/lib/session.ts`: encrypt/decrypt the session payload with `jose`,
  set/delete the HTTP-only session cookie.
- `src/lib/dal.ts`: `verifySession()` is the real authorization boundary —
  call it at the top of every Route Handler and every protected
  page/layout that touches user data.
- `src/proxy.ts`: optimistic redirect only (cookie-presence check). Next.js
  16 renamed `middleware.ts` to `proxy.ts` — same behavior, new filename —
  and it must never be the only line of defense; enforcement happens in
  `verifySession()`.

## shadcn/ui
- This project uses the `base-vega` preset style (see `components.json`).
  Add components with `npx shadcn add <name>`, don't hand-write them.
- `TooltipProvider` (from `src/components/ui/tooltip.tsx`) must wrap the app
  in `layout.tsx` — several shadcn components use tooltips internally.

## Environment
- Required vars: `DATABASE_URL`, `SESSION_SECRET`, `ADMIN_EMAIL`,
  `ADMIN_PASSWORD_HASH`. Keep `.env.example` in sync with `.env.local`.

## Reuse over duplication
- Before writing a new component, hook, type, or helper, check whether one
  already covers it: `src/components/ui/` (shadcn primitives),
  `src/components/layout/` (shared shell), `src/lib/utils.ts` (formatting/
  helpers), `src/hooks/` (shared hooks), and other features' `_components/`
  for a piece that generalizes (e.g. a table, a dialog, an empty state).
- Shared UI that more than one feature needs (a data table shell, a
  confirm-delete dialog, a currency/date display) belongs in
  `src/components/` or `src/lib/utils.ts`, not copy-pasted into each
  feature's `_components/`.
- Within one feature, factor out repeated JSX/logic (e.g. the same form
  fields used by both create and edit) into a shared component/function in
  that feature rather than duplicating it across files.
