# Phase 4 — Dashboard

## Context

Phases 1–3 built auth, product management, and billing/bill viewing. `/dashboard`
currently renders a placeholder page ("Built in Phase 4 — this placeholder
confirms the authenticated route is reachable.") and the sidebar already links
to it. `src/features/dashboard/{api,hook,_components}` and
`src/app/api/dashboard/summary/` exist as empty `.gitkeep` scaffolding —
reserved for exactly this phase. This phase replaces the placeholder with a
real at-a-glance dashboard: today/this-month sales, a 7-day trend, low-stock
alerts, recent bills, top-selling products, and inventory valuation, so the
shopkeeper gets a live summary screen instead of having to dig through
Products/Billing/Bills individually. Scope was confirmed with the user:
fixed periods only (no date-range picker), no credit/udhaar outstanding
tracking (schema has no repayment ledger, so it'd be misleading), single
`GET /api/dashboard/summary` endpoint, and periodic polling (~60s) since this
is meant to be left open on a shop counter screen.

No new dependencies needed — `recharts` and the shadcn `chart.tsx` wrapper are
already installed, as are `card.tsx`, `skeleton.tsx`, `badge.tsx`, and
`date-fns`.

## Data model recap (`prisma/schema.prisma`)

Single-shop app, no tenant/user filtering needed anywhere. Relevant models:
`Product` (price/costPrice/stock/lowStockThreshold as Decimal), `Bill`
(totalAmount Decimal, isCredit, createdAt), `BillItem` (quantity, lineTotal
Decimal, links Bill↔Product). `Bill.totalAmount` is the post-discount/tax
figure — dashboard "revenue" uses this, not a recomputed subtotal.

## 1. `src/features/dashboard/types.ts`

Decimal-backed fields are strings (matches `products/types.ts`,
`bills/types.ts`); counts are plain numbers.

```ts
export type DashboardKpis = {
  todayRevenue: string;
  todayBillCount: number;
  monthRevenue: string;
  monthBillCount: number;
};

export type SalesTrendPoint = {
  date: string; // "yyyy-MM-dd" local calendar day
  revenue: string;
};

export type LowStockItem = {
  id: number;
  name: string;
  unit: string;
  stock: string;
  lowStockThreshold: string;
};

export type RecentBillItem = {
  id: number;
  customerName: string | null;
  totalAmount: string;
  isCredit: boolean;
  createdAt: string;
};

export type TopProduct = {
  id: number;
  name: string;
  unit: string;
  quantitySold: string;
};

export type InventoryValuation = {
  totalValue: string;
  activeProductCount: number;
};

export type DashboardSummaryResponse = {
  kpis: DashboardKpis;
  salesTrend: SalesTrendPoint[]; // always exactly 7 points, zero-filled
  lowStockItems: LowStockItem[];
  recentBills: RecentBillItem[];
  topProducts: TopProduct[];
  inventoryValuation: InventoryValuation;
};
```

No query/params type — this is a no-input `GET`.

## 2. `src/app/api/dashboard/summary/route.ts`

`verifySession()` first, no zod (nothing to validate), try/catch around all
Prisma work → generic 500 on failure, `NextResponse.json<DashboardSummaryResponse>(...)`
on success. All queries run inside one `Promise.all([...])` (plain reads on
the `db` singleton from `@/lib/db`, no `$transaction` needed).

**Day-bucketing: JS-side bucketing of a single `findMany`, not raw SQL** —
consistent with this app's existing pattern of fetching-and-reducing in JS at
this scale (see low-stock/inventory-valuation below), and avoids a
MySQL-version-specific `DATE_FORMAT` raw query for a single shop's small
weekly bill volume.

Boundaries (plain server-local `Date`, no timezone library — single
deployment, no multi-timezone concept anywhere else in this app):

```ts
const now = new Date();
const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
const startOfTrendWindow = new Date(startOfToday);
startOfTrendWindow.setDate(startOfTrendWindow.getDate() - 6); // today + 6 prior days
```

Queries:

1. **Today's KPIs** — `db.bill.aggregate({ where: { createdAt: { gte: startOfToday } }, _sum: { totalAmount: true }, _count: true })` → `todayRevenue = result._sum.totalAmount?.toString() ?? "0.00"`, `todayBillCount = result._count`. (`_sum` is `null` on an empty table — always fall back to `"0.00"`, never assume a Decimal.)
2. **This month's KPIs** — same shape with `startOfMonth`.
3. **7-day trend** — `db.bill.findMany({ where: { createdAt: { gte: startOfTrendWindow } }, select: { totalAmount: true, createdAt: true } })`, then bucket in JS: pre-seed a `Map<string, number>` with all 7 `format(d, "yyyy-MM-dd")` keys (date-fns) set to `0`, accumulate each bill's `totalAmount` into its day's bucket, emit `SalesTrendPoint[]` sorted ascending with each `revenue` as `.toFixed(2)`.
4. **Low stock** — `db.product.findMany({ where: { isActive: true, lowStockThreshold: { not: null } }, select: { id: true, name: true, unit: true, stock: true, lowStockThreshold: true } })`, then `.filter(p => Number(p.stock) <= Number(p.lowStockThreshold))` in JS — Prisma can't compare two columns in a `where` without raw SQL, and this app's scale doesn't warrant it. (Products that never got a threshold set are intentionally excluded — known, accepted limitation.)
5. **Recent bills** — `db.bill.findMany({ orderBy: { createdAt: "desc" }, take: 8, select: { id: true, customerName: true, totalAmount: true, isCredit: true, createdAt: true } })`.
6. **Top products (same 7-day window)** — `db.billItem.groupBy({ by: ["productId"], where: { bill: { createdAt: { gte: startOfTrendWindow } } }, _sum: { quantity: true }, orderBy: { _sum: { quantity: "desc" } }, take: 5 })`, then `db.product.findMany({ where: { id: { in: groupResult.map(g => g.productId) } }, select: { id: true, name: true, unit: true } })`. `findMany`'s `in` filter does **not** preserve order — re-sort the joined products back into the `groupBy` result's order via a `Map<id, product>` before assembling `TopProduct[]`.
7. **Inventory valuation** — `db.product.findMany({ where: { isActive: true }, select: { stock: true, costPrice: true } })`, reduce in JS: `products.reduce((sum, p) => sum + Number(p.stock) * Number(p.costPrice), 0)`, format with `.toFixed(2)`; `activeProductCount = products.length`.

Factor the two multi-step JS reductions into small local helpers for
readability (e.g. `buildSalesTrend(bills, startOfTrendWindow)`,
`filterLowStock(products)`) — no exported `to...Dto` mapper needed since
there's no collection/detail split like `products`/`bills` have.

**Edge cases to handle explicitly:**
- Empty DB: every `_sum` field falls back to `"0.00"`/`0`; `salesTrend` still returns 7 zero-value points (not `[]`) so the chart has a full axis domain; lists return `[]`.
- All JS-side money reductions are display-final — format with `.toFixed(2)` once, don't do further arithmetic on the wire string client-side (matches how `formatCurrency` already assumes a final value).

## 3. `src/features/dashboard/api/index.ts`

```ts
import axios from "axios";

import type { DashboardSummaryResponse } from "../types";

export const getDashboardSummary = async () => {
  const { data } = await axios.get<DashboardSummaryResponse>("/api/dashboard/summary");
  return data;
};
```

## 4. `src/features/dashboard/hook/use-dashboard.ts`

Single query hook, no mutations (read-only endpoint) — mirrors
`useAllProducts`'s `options?: { refetchInterval?: number }` passthrough. No
`getErrorMessage`/toast helper needed: toasts in this codebase are a
mutation-only convention (`useAllProducts` itself has none either) — a
failed query gets an inline error/empty state in the view instead.

```ts
import { useQuery } from "@tanstack/react-query";

import { getDashboardSummary } from "../api";

/**
 * Query hook for the dashboard summary (KPIs, trend, low stock, recent
 * bills, top products, inventory valuation) — one endpoint backs the whole
 * dashboard page.
 * @param options - Optional `refetchInterval` for polling (the dashboard
 * page passes ~60s so a counter screen stays current).
 */
export const useDashboardSummary = (options?: { refetchInterval?: number }) => {
  return useQuery({
    queryFn: getDashboardSummary,
    queryKey: ["dashboard-summary"],
    refetchInterval: options?.refetchInterval,
  });
};
```

## 5. `src/features/dashboard/_components/`

```
stat-card.tsx           reusable KPI card
dashboard-kpi-row.tsx   lays out 4 KPI cards + inventory valuation
sales-trend-chart.tsx   7-day revenue chart
low-stock-list.tsx      low-stock alert list
recent-bills-list.tsx   last 8 bills
top-products-list.tsx   top 5 products by qty sold (7d)
dashboard-view.tsx      top-level composition, owns the query + page wrapper
```

- **`stat-card.tsx`** — `label`, `value`, `sublabel?`, `icon?: LucideIcon`, `isLoading?` props. `Card`/`CardHeader`/`CardTitle`/`CardContent` from `@/components/ui/card`; when `isLoading`, renders `Skeleton` blocks in place of label/value/sublabel instead of a separate skeleton component. Reused 5x (4 KPIs + inventory valuation).
- **`dashboard-kpi-row.tsx`** — responsive grid (`grid-cols-2 lg:grid-cols-5`) of 5 `StatCard`s. Money via `formatCurrency` (`@/lib/utils`); counts as plain numbers. Takes `kpis`, `inventoryValuation`, `isLoading`.
- **`sales-trend-chart.tsx`** — `ChartContainer` (`@/components/ui/chart.tsx`) wrapping a Recharts `AreaChart`, single `revenue` series on the existing `--chart-1` theme variable, `ChartTooltip`/`ChartTooltipContent`. X-axis ticks via `format(new Date(point.date), "EEE")`; tooltip via `format(..., "PP")` + `formatCurrency`. Empty state (all points `"0.00"`): centered "No sales in the last 7 days" message instead of a flat zero line. Loading: `Skeleton` sized to the chart box, no Recharts mount.
- **`low-stock-list.tsx`** — `Card` with a `Badge variant="destructive"` count in the header (mirrors `product-table.tsx`'s existing low-stock badge), rows of name + stock/unit vs threshold. Empty: "All products are above their low-stock threshold." Loading: 3 `Skeleton` rows.
- **`recent-bills-list.tsx`** — `Card`, rows of `customerName ?? "Walk-in"`, `formatCurrency(totalAmount)`, `format(new Date(createdAt), "PPp")`, `Badge` for `isCredit` ("Udhaar"). Each row is a `Link href={`/bills/${id}`}`. Empty: "No bills yet — create your first bill" linking to `/billing`. Loading: `Skeleton` rows.
- **`top-products-list.tsx`** — `Card`, ranked 1–5 list of `name` + `quantitySold`/`unit`. Empty: "No sales in the last 7 days". Loading: `Skeleton` rows.
- **`dashboard-view.tsx`** — owns `<div className="flex flex-col gap-4 p-6">` + `<h1>Dashboard</h1>` (padding lives in the view, matching `products-view.tsx`, not in `page.tsx`). Calls `useDashboardSummary({ refetchInterval: 60_000 })` — the one query backing the whole page; passes its `isLoading`/`data` down uniformly (single request, no per-section staggering). Layout: `DashboardKpiRow` → full-width `SalesTrendChart` → `grid-cols-1 lg:grid-cols-3` row of `LowStockList` / `RecentBillsList` / `TopProductsList`.

## 6. `src/app/(protected)/dashboard/page.tsx`

Replace the placeholder with a one-line pass-through, matching
`products/page.tsx`:

```tsx
import { DashboardView } from "@/features/dashboard/_components/dashboard-view";

/** /dashboard — KPI cards, sales trend, low-stock alerts, recent bills, top products. */
const DashboardPage = () => <DashboardView />;

export default DashboardPage;
```

No changes needed to `src/components/layout/app-sidebar.tsx` (Dashboard nav
link already exists) or `src/proxy.ts` (`/dashboard` already protected).

## Verification

1. `npx prisma generate` if needed, then run the dev server; log in and visit `/dashboard`.
2. With an empty/fresh DB: confirm all KPIs show `₹0.00`/`0`, the trend chart shows its empty-state message (not a broken/flat chart), and each list shows its empty-state copy — no 500s.
3. Create a few products (including one with `lowStockThreshold` set above current stock) and a few bills (mix of today and a few days back, one `isCredit`) via the existing Products/Billing UI, then reload `/dashboard` and confirm: today/month revenue and counts match manually-summed expectations, the 7-day chart shows bars/area on the right days, the low-stock item appears, recent bills list them newest-first and link correctly to `/bills/[id]`, top products reflects quantity sold, inventory valuation matches `Σ(stock × costPrice)` for active products.
4. Leave the page open ~70s and confirm it silently refetches (network tab shows a poll to `/api/dashboard/summary`) without a full-page flicker.
5. `npx tsc --noEmit` to confirm types are clean end-to-end (route → api → hook → components).
