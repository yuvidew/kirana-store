# Phase 6 — Reports & Analytics (PRD 2.6)

## Context

Phases 1–5 (auth, products, billing, bills list, dashboard) are done and merged. `/reports` currently renders a placeholder ("Built in Phase 6 — this placeholder confirms the authenticated route is reachable"), and `src/app/api/reports/`, `src/app/(protected)/reports/`, and `src/features/reports/{api,hook,_components}` already exist as empty `.gitkeep` scaffolding reserved for exactly this phase. The sidebar already links "Reports" → `/reports` — no sidebar or `proxy.ts` change needed.

This phase replaces the placeholder with a real analytics page: a period selector, revenue/bills-per-day trend charts, a stock received-vs-sold comparison, top-selling products, and period summary cards — so the shopkeeper can review business performance over a week/month/custom range instead of only the Dashboard's fixed 7-day snapshot.

**Scope confirmed with the user (do not re-litigate):**
1. **Period selector** — "This week" / "This month" preset buttons, plus the existing `DateRangePicker` (built in Phase 5, `src/components/date-range-picker.tsx`) for a fully custom range. No new Tabs-toggle component. Defaults to "This week" on load.
2. **Export** — skipped entirely this phase (no PDF/Excel). Charts/tables/cards only.
3. **Low-stock list** — skipped on Reports; Dashboard already has a live one, not duplicated here.
4. **Top selling products** — ranked by **revenue**, not quantity (differentiates from the Dashboard's existing quantity-based widget).

No new dependencies — `recharts`, the shadcn `chart.tsx` wrapper, `date-fns`, and `card.tsx`/`table.tsx`/`button-group.tsx` are already installed and used elsewhere.

## Reused patterns (read before writing)

- `src/app/api/dashboard/summary/route.ts` / `src/features/dashboard/types.ts` — single aggregation endpoint via `Promise.all`, JS-side day-bucketing (`buildSalesTrend`), `_sum` null-fallback (`?? "0.00"`), `groupBy` + re-sort-via-`Map` pattern for top products (`findMany`'s `in` filter doesn't preserve order).
- `src/features/dashboard/_components/sales-trend-chart.tsx` — `ChartContainer`/`ChartConfig`/`AreaChart`/`ChartTooltip` pattern from `@/components/ui/chart`.
- `src/features/dashboard/_components/dashboard-view.tsx` — one `LoadingCard`/`ErrorCard` gate for the whole page once the single summary query resolves (not per-widget skeletons).
- `src/app/api/bills/route.ts` — manual query-param parsing (no zod on `GET`), the `dateFrom`/`dateTo` inclusive-day convention (`to.setDate(to.getDate() + 1)` → `lt`).
- `src/components/date-range-picker.tsx` — reused as-is, untouched.
- `src/components/query-state.tsx` — `LoadingCard`/`ErrorCard`, reused as-is.
- `prisma/schema.prisma` — `Bill` (`totalAmount`, `createdAt`, `isCredit`), `BillItem` (`quantity`, `lineTotal`, links `Bill`↔`Product`), `StockMovement` (`type`: `RECEIVED`/`SOLD`, `quantity`, `createdAt`) — confirmed both `RECEIVED` (`src/app/api/products/[id]/stock/route.ts`) and `SOLD` (`src/app/api/bills/route.ts`) rows are already written on the existing add-stock and create-bill flows.
- `src/components/ui/chart.tsx` — confirms `ChartLegend`/`ChartLegendContent` are exported alongside `ChartContainer`/`ChartTooltip`/`ChartTooltipContent` (needed for the two-series stock chart).
- `src/components/ui/button-group.tsx` — exists; used for the preset-button pair (active/inactive via `variant="default"`/`"outline"`, no controlled-selection API of its own).

## Design decisions

**One endpoint** (`GET /api/reports/summary`), not a per-widget split: every widget on the page shares the same date-range filter and is read together on every preset/range change, matching the Dashboard's "one summary query backs one page" convention — avoids a 5-way request waterfall.

**Move `StatCard` to `src/components/stat-card.tsx`** (currently `src/features/dashboard/_components/stat-card.tsx`): it's already fully generic (`label`, `value`, `sublabel?`, `icon?`) with zero dashboard-specific logic. Per CLAUDE.md's "Reuse over duplication" section, a generic presentational primitive like this belongs in `src/components/`, not copied into a second feature's `_components/`. Update `dashboard-kpi-row.tsx`'s import; no changes to the component itself.

**Day-bucketing for an arbitrary-length range**: keep the Dashboard's proven single-`findMany`-plus-JS-`Map` approach (no raw SQL), but seed the zero-value bucket map with `eachDayOfInterval({ start, end })` instead of a fixed 7-day loop. Always bucket by day regardless of range length — no weekly/monthly re-bucketing for long custom ranges (keeps server logic uniform; a many-week range just means a denser chart). Client-side mitigation only: an `XAxis interval` tick-thinning helper so labels don't overlap on long ranges — every data point still plots.

## 1. `src/features/reports/types.ts` (new)

```ts
// Money/quantity fields backed by Prisma Decimal columns are serialized as
// strings, matching dashboard/bills/products' types.ts convention.

export type ReportsQuery = {
  dateFrom: string; // "yyyy-MM-dd", inclusive, local calendar day
  dateTo: string; // "yyyy-MM-dd", inclusive, local calendar day
};

export type ReportsPeriod = {
  dateFrom: string;
  dateTo: string;
};

export type ReportsSummaryTotals = {
  totalRevenue: string;
  totalBills: number;
  itemsSold: string;
  itemsReceived: string;
};

/** One calendar day's revenue + bill count — backs both the Sales Trend and Bills Generated charts (bucketed once, shared by both). */
export type DailySalesPoint = {
  date: string; // "yyyy-MM-dd"
  revenue: string;
  billCount: number;
};

/** One calendar day's stock received vs. sold quantities. */
export type StockMovementPoint = {
  date: string;
  received: string;
  sold: string;
};

/** A product's quantity sold + revenue for the selected period, ranked by revenue desc. */
export type TopSellingProduct = {
  id: number;
  name: string;
  unit: string;
  quantitySold: string;
  revenue: string;
};

export type ReportsSummaryResponse = {
  period: ReportsPeriod; // the resolved range actually used (post default/swap)
  summary: ReportsSummaryTotals;
  dailySales: DailySalesPoint[]; // one point per calendar day in [dateFrom, dateTo], zero-filled
  stockMovement: StockMovementPoint[]; // same day range as dailySales
  topProducts: TopSellingProduct[]; // up to 10, revenue desc
};
```

## 2. `src/app/api/reports/summary/route.ts` (new)

`verifySession()` first, no zod (query params only), `try/catch` → generic 500.

Default/edge handling: missing/invalid `dateFrom`/`dateTo` → default to the current calendar week (`startOfWeek(now, { weekStartsOn: 1 })` through `now`); `dateTo < dateFrom` → swap (defensive against a malformed direct API call); `dateTo` inclusive of its whole day via the same `+1 day` → `lt` trick as `bills/route.ts`.

```ts
import { eachDayOfInterval, format, startOfDay, startOfWeek } from "date-fns";
import { NextResponse } from "next/server";

import type { Bill as BillModel, StockMovement as StockMovementModel } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { verifySession } from "@/lib/dal";
import type {
  DailySalesPoint,
  ReportsSummaryResponse,
  StockMovementPoint,
  TopSellingProduct,
} from "@/features/reports/types";

const TOP_PRODUCTS_LIMIT = 10;

/** Parses a "yyyy-MM-dd" query param into a Date, or undefined if missing/invalid. */
const parseDateParam = (value: string | null): Date | undefined => {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

/**
 * Buckets bills into one { revenue, billCount } pair per local calendar day
 * across [start, end] inclusive, zero-filling days with no bills so both
 * the Sales Trend and Bills Generated charts get a full, gap-free domain
 * regardless of the caller-supplied range length.
 */
const buildDailySales = (
  bills: Pick<BillModel, "totalAmount" | "createdAt">[],
  start: Date,
  end: Date
): DailySalesPoint[] => {
  const byDay = new Map<string, { revenue: number; billCount: number }>(
    eachDayOfInterval({ start, end }).map((day) => [format(day, "yyyy-MM-dd"), { revenue: 0, billCount: 0 }])
  );
  for (const bill of bills) {
    const bucket = byDay.get(format(bill.createdAt, "yyyy-MM-dd"));
    if (!bucket) continue;
    bucket.revenue += Number(bill.totalAmount);
    bucket.billCount += 1;
  }
  return Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { revenue, billCount }]) => ({ date, revenue: revenue.toFixed(2), billCount }));
};

/** Buckets stock movements into one { received, sold } quantity pair per local calendar day across [start, end] inclusive, zero-filled. */
const buildStockMovementTrend = (
  movements: Pick<StockMovementModel, "type" | "quantity" | "createdAt">[],
  start: Date,
  end: Date
): StockMovementPoint[] => {
  const byDay = new Map<string, { received: number; sold: number }>(
    eachDayOfInterval({ start, end }).map((day) => [format(day, "yyyy-MM-dd"), { received: 0, sold: 0 }])
  );
  for (const movement of movements) {
    const bucket = byDay.get(format(movement.createdAt, "yyyy-MM-dd"));
    if (!bucket) continue;
    if (movement.type === "RECEIVED") bucket.received += Number(movement.quantity);
    else bucket.sold += Number(movement.quantity);
  }
  return Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { received, sold }]) => ({ date, received: received.toFixed(2), sold: sold.toFixed(2) }));
};

/**
 * Returns the reports summary for a caller-supplied date range: period
 * totals (revenue, bills, items sold, items received), a daily
 * revenue/bill-count series, a daily stock-received-vs-sold series, and the
 * top 10 products by revenue. One GET backs the whole /reports page,
 * mirroring the dashboard's single-summary-endpoint pattern.
 * @param request - Query params: `dateFrom`/`dateTo` ("yyyy-MM-dd",
 * inclusive local calendar days). Defaults to the current calendar week
 * (Mon–today) if missing/invalid; a reversed range is swapped.
 */
export const GET = async (request: Request) => {
  await verifySession();

  const { searchParams } = new URL(request.url);
  const now = new Date();
  let from = parseDateParam(searchParams.get("dateFrom")) ?? startOfWeek(now, { weekStartsOn: 1 });
  let to = parseDateParam(searchParams.get("dateTo")) ?? now;
  if (to < from) [from, to] = [to, from];

  const start = startOfDay(from);
  const endOfRangeDay = startOfDay(to);
  const endExclusive = new Date(endOfRangeDay);
  endExclusive.setDate(endExclusive.getDate() + 1);

  const periodWhere = { createdAt: { gte: start, lt: endExclusive } };

  try {
    const [billAggregate, itemsSoldAggregate, itemsReceivedAggregate, bills, movements, topGroups] =
      await Promise.all([
        db.bill.aggregate({ where: periodWhere, _sum: { totalAmount: true }, _count: true }),
        db.billItem.aggregate({ where: { bill: periodWhere }, _sum: { quantity: true } }),
        db.stockMovement.aggregate({
          where: { type: "RECEIVED", createdAt: periodWhere.createdAt },
          _sum: { quantity: true },
        }),
        db.bill.findMany({ where: periodWhere, select: { totalAmount: true, createdAt: true } }),
        db.stockMovement.findMany({
          where: { createdAt: periodWhere.createdAt },
          select: { type: true, quantity: true, createdAt: true },
        }),
        db.billItem.groupBy({
          by: ["productId"],
          where: { bill: periodWhere },
          _sum: { lineTotal: true, quantity: true },
          orderBy: { _sum: { lineTotal: "desc" } },
          take: TOP_PRODUCTS_LIMIT,
        }),
      ]);

    const topProductIds = topGroups.map((group) => group.productId);
    const topProductRows = topProductIds.length
      ? await db.product.findMany({ where: { id: { in: topProductIds } }, select: { id: true, name: true, unit: true } })
      : [];
    const productsById = new Map(topProductRows.map((product) => [product.id, product]));
    const topProducts: TopSellingProduct[] = topGroups.flatMap((group) => {
      const product = productsById.get(group.productId);
      return product
        ? [
            {
              id: product.id,
              name: product.name,
              unit: product.unit,
              quantitySold: (group._sum.quantity ?? 0).toString(),
              revenue: (group._sum.lineTotal ?? 0).toString(),
            },
          ]
        : [];
    });

    return NextResponse.json<ReportsSummaryResponse>({
      period: { dateFrom: format(start, "yyyy-MM-dd"), dateTo: format(endOfRangeDay, "yyyy-MM-dd") },
      summary: {
        totalRevenue: billAggregate._sum.totalAmount?.toString() ?? "0.00",
        totalBills: billAggregate._count,
        itemsSold: (itemsSoldAggregate._sum.quantity ?? 0).toString(),
        itemsReceived: (itemsReceivedAggregate._sum.quantity ?? 0).toString(),
      },
      dailySales: buildDailySales(bills, start, endOfRangeDay),
      stockMovement: buildStockMovementTrend(movements, start, endOfRangeDay),
      topProducts,
    });
  } catch {
    return NextResponse.json({ error: "Something went wrong loading the reports summary." }, { status: 500 });
  }
};
```

`db.billItem.aggregate({ where: { bill: periodWhere } })` and the `groupBy`'s relation filter reuse the exact through-relation pattern already proven in the Dashboard's `billItem.groupBy({ where: { bill: { createdAt: {...} } } } )`. `_sum.lineTotal` is valid since `lineTotal` is a `Decimal` column on `BillItem`.

**Reminder (AGENTS.md):** skim `node_modules/next/dist/docs/` for this Next.js version's current Route Handler / `NextResponse` / `searchParams` conventions before writing this file, in case anything differs from training-data assumptions.

## 3. `src/features/reports/api/index.ts` (new)

```ts
import axios from "axios";

import type { ReportsQuery, ReportsSummaryResponse } from "../types";

/** Fetches the reports summary (period totals, daily series, stock movement, top products) for a date range. */
export const getReportsSummary = async (query: ReportsQuery) => {
  const { data } = await axios.get<ReportsSummaryResponse>("/api/reports/summary", {
    params: { dateFrom: query.dateFrom, dateTo: query.dateTo },
  });
  return data;
};
```

## 4. `src/features/reports/hook/use-reports.ts` (new)

```ts
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { getReportsSummary } from "../api";
import type { ReportsQuery } from "../types";

/**
 * Query hook for the reports summary over a date range — the one endpoint
 * backing the whole /reports page (period cards, sales trend,
 * bills-per-day, stock movement, top products).
 * @param query - `dateFrom`/`dateTo` ("yyyy-MM-dd") defining the period.
 * @param options - Optional `refetchInterval` for polling (unused by
 * default — reports isn't a counter-screen page like the dashboard).
 */
export const useReportsSummary = (query: ReportsQuery, options?: { refetchInterval?: number }) => {
  return useQuery({
    queryFn: () => getReportsSummary(query),
    queryKey: ["reports-summary", query],
    placeholderData: keepPreviousData,
    refetchInterval: options?.refetchInterval,
  });
};
```

## 5. `src/lib/utils.ts` — additive helper

```ts
/**
 * Recharts `<XAxis interval>` value that skips enough tick labels to stay
 * readable once a period has more than ~14 days of points (e.g. a custom
 * multi-month range) — every data point still renders, only the label
 * density changes.
 * @param pointCount - Number of points on the axis (one per day).
 */
export const chartTickInterval = (pointCount: number) => (pointCount > 14 ? Math.ceil(pointCount / 12) : 0);
```

Shared (not reports-specific) since all three time-series charts use it.

## 6. Move `stat-card.tsx` to `src/components/stat-card.tsx`

Move file verbatim from `src/features/dashboard/_components/stat-card.tsx` (no code changes). Update `src/features/dashboard/_components/dashboard-kpi-row.tsx`'s import from `./stat-card` to `@/components/stat-card`. The new reports component imports it from the same shared path.

## 7. `src/features/reports/_components/`

```
period-selector.tsx         preset buttons (This week/This month) + DateRangePicker
period-summary-cards.tsx    4 StatCards: total revenue, total bills, items sold, items received
sales-trend-chart.tsx       area chart, revenue per day, arbitrary-length period
bills-per-day-chart.tsx     bar chart, bill count per day, same data source as sales-trend-chart
stock-movement-chart.tsx    grouped bar chart, received vs sold quantity per day
top-products-table.tsx      table: rank, name, qty sold, revenue — top 10 by revenue
reports-view.tsx            top-level composition, owns period state + the one query
```

**`period-selector.tsx`** — stateless controls; parent owns the actual range.

```tsx
"use client";

import type { DateRange } from "react-day-picker";

import { DateRangePicker } from "@/components/date-range-picker";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";

export type PeriodPreset = "week" | "month" | "custom";

/**
 * Period picker for the Reports page: "This week"/"This month" preset
 * buttons plus a custom DateRangePicker.
 * @param preset - Which preset is currently active ("custom" once the user
 * picks their own range via the DateRangePicker).
 * @param onPresetSelect - Called with "week" or "month" when a preset button is clicked.
 * @param dateRange - The range currently shown in the DateRangePicker.
 * @param onDateRangeChange - Called with the user's custom picked range.
 */
export const PeriodSelector = ({
  preset,
  onPresetSelect,
  dateRange,
  onDateRangeChange,
}: {
  preset: PeriodPreset;
  onPresetSelect: (preset: "week" | "month") => void;
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
}) => {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <ButtonGroup>
        <Button variant={preset === "week" ? "default" : "outline"} onClick={() => onPresetSelect("week")}>
          This week
        </Button>
        <Button variant={preset === "month" ? "default" : "outline"} onClick={() => onPresetSelect("month")}>
          This month
        </Button>
      </ButtonGroup>
      <DateRangePicker value={dateRange} onChange={onDateRangeChange} placeholder="Custom range" />
    </div>
  );
};
```

**`period-summary-cards.tsx`** — 4 `StatCard`s (`@/components/stat-card`), `formatCurrency` for revenue, plain numbers for the rest. Icons: `IndianRupeeIcon`, `ReceiptTextIcon`, `PackageIcon`, `TruckIcon`.

**`sales-trend-chart.tsx`** — same `ChartContainer`/`AreaChart` structure as the Dashboard's, generalized: title "Sales trend" (no fixed "last 7 days"), `chartTickInterval` on the `XAxis`, `tickFormatter` using `"MMM d"` (not `"EEE"` — day-of-week stops being unambiguous once the period isn't a fixed week), prop `dailySales: DailySalesPoint[]`, plots `revenue`. Empty state ("no sales in this period") when every point's revenue is 0.

**`bills-per-day-chart.tsx`** — bar chart, same `dailySales` prop, plots `billCount` (`Bar dataKey="billCount"`), `chartConfig = { billCount: { label: "Bills", color: "var(--chart-2)" } }`. Empty state when every `billCount === 0`.

**`stock-movement-chart.tsx`** — grouped (not stacked) bar chart, two `<Bar>` elements with no shared `stackId` so RECEIVED/SOLD render side-by-side per day:

```ts
const chartConfig = {
  received: { label: "Received", color: "var(--chart-2)" },
  sold: { label: "Sold", color: "var(--chart-3)" },
} satisfies ChartConfig;
```

Uses `ChartLegend`/`ChartLegendContent` (confirmed exported from `src/components/ui/chart.tsx`) since two series need a legend. Same `chartTickInterval` on `XAxis`. Empty state only when **both** series are zero on every day (a period with only RECEIVED or only SOLD movements should still render, with the other series flat at zero, not trigger the empty state).

**`top-products-table.tsx`** — plain `Card` + `Table` (not a chart), read-only, no row actions:

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";

import type { TopSellingProduct } from "../types";

/**
 * Top 10 products by revenue for the selected period, most-revenue-first.
 * @param products - Already-ranked (revenue desc) products from the reports summary.
 */
export const TopProductsTable = ({ products }: { products: TopSellingProduct[] }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Top selling products</CardTitle>
      </CardHeader>
      <CardContent>
        {products.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No sales in this period.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Qty sold</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product, index) => (
                <TableRow key={product.id}>
                  <TableCell className="font-mono tabular-nums text-muted-foreground">{index + 1}</TableCell>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {product.quantitySold} {product.unit}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{formatCurrency(product.revenue)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};
```

**`reports-view.tsx`** — owns preset + range state (mirrors `bills-view.tsx` owning filter state directly). "This week" = Monday–Sunday of the current week; "This month" = calendar month start–end. Both presets **clamp their upper bound to today** (a future upper bound would show meaningless trailing empty days).

```tsx
"use client";

import { endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from "date-fns";
import { useState } from "react";
import type { DateRange } from "react-day-picker";

import { ErrorCard, LoadingCard } from "@/components/query-state";

import { useReportsSummary } from "../hook/use-reports";
import { BillsPerDayChart } from "./bills-per-day-chart";
import { PeriodSelector, type PeriodPreset } from "./period-selector";
import { PeriodSummaryCards } from "./period-summary-cards";
import { SalesTrendChart } from "./sales-trend-chart";
import { StockMovementChart } from "./stock-movement-chart";
import { TopProductsTable } from "./top-products-table";

const clampToToday = (date: Date) => (date > new Date() ? new Date() : date);

const thisWeekRange = (): DateRange => ({
  from: startOfWeek(new Date(), { weekStartsOn: 1 }),
  to: clampToToday(endOfWeek(new Date(), { weekStartsOn: 1 })),
});

const thisMonthRange = (): DateRange => ({
  from: startOfMonth(new Date()),
  to: clampToToday(endOfMonth(new Date())),
});

/**
 * The Reports & Analytics page: a period selector (This week/This month
 * presets, or a custom date range), period summary cards, sales trend,
 * bills-per-day, and stock received-vs-sold charts, and a top-selling-
 * products table — all driven by one query keyed on the selected range.
 */
export const ReportsView = () => {
  const [preset, setPreset] = useState<PeriodPreset>("week");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(thisWeekRange());

  const handlePresetSelect = (nextPreset: "week" | "month") => {
    setPreset(nextPreset);
    setDateRange(nextPreset === "week" ? thisWeekRange() : thisMonthRange());
  };
  const handleDateRangeChange = (range: DateRange | undefined) => {
    setPreset("custom");
    setDateRange(range);
  };

  // A range with only a "from" picked so far (mid-drag in the calendar) is
  // treated as a single-day query until "to" is chosen.
  const fallbackFrom = thisWeekRange().from!;
  const dateFrom = format(dateRange?.from ?? fallbackFrom, "yyyy-MM-dd");
  const dateTo = format(dateRange?.to ?? dateRange?.from ?? fallbackFrom, "yyyy-MM-dd");

  const { data, isLoading, isError, refetch } = useReportsSummary({ dateFrom, dateTo });

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-heading text-xl font-semibold tracking-tight">Reports</h1>
        <PeriodSelector
          preset={preset}
          onPresetSelect={handlePresetSelect}
          dateRange={dateRange}
          onDateRangeChange={handleDateRangeChange}
        />
      </div>

      {isLoading ? (
        <LoadingCard title="Loading reports…" />
      ) : isError || !data ? (
        <ErrorCard
          title="Couldn't load reports"
          description="Something went wrong loading the reports summary."
          onRetry={() => refetch()}
        />
      ) : (
        <>
          <PeriodSummaryCards summary={data.summary} />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <SalesTrendChart dailySales={data.dailySales} />
            <BillsPerDayChart dailySales={data.dailySales} />
          </div>
          <StockMovementChart stockMovement={data.stockMovement} />
          <TopProductsTable products={data.topProducts} />
        </>
      )}
    </div>
  );
};
```

## 8. `src/app/(protected)/reports/page.tsx` — replace placeholder

```tsx
import { ReportsView } from "@/features/reports/_components/reports-view";

/** /reports — reports & analytics: period selector, sales trend, bills-per-day, and stock-movement charts, plus a top-selling-products table for the selected period. */
const ReportsPage = () => <ReportsView />;

export default ReportsPage;
```

No sidebar or `proxy.ts` changes needed.

## Edge cases (explicit)

- **Empty period**: `_sum` fields fall back to `"0.00"`/`0`; `dailySales`/`stockMovement` still return one zero-filled point per day (never `[]`); `topProducts` returns `[]` → table empty-state.
- **Only RECEIVED or only SOLD movements in period**: the other series stays flat at zero — the chart's "no movement" empty state only fires when *both* series are zero every day, not when just one is.
- **Zero bills but stock movement exists**: KPI cards/charts derived from bills zero out; the stock-movement chart is independent and may still show data.
- **1-day range**: `eachDayOfInterval` with `start === end` returns exactly one day; all bucketed series produce a single-point series — Recharts handles this without special-casing.
- **Long multi-month custom range**: no server-side cap or re-bucketing; `chartTickInterval` thins X-axis labels only — every data point still plots. Deliberate, documented limitation matching this app's single-shop scale.
- **Reversed range from a malformed direct API call**: swapped server-side before querying.
- **Preset upper bound in the future** (e.g. "This month" clicked early in the month): clamped to `today` client-side before the query fires.
- **Custom range mid-drag (only "from" picked)**: `dateTo` falls back to `dateFrom` for a valid single-day query; `keepPreviousData` avoids a loading flash once "to" is picked.

## Sequencing

1. `src/features/reports/types.ts` — everything else depends on it.
2. `src/lib/utils.ts`'s `chartTickInterval` addition — standalone.
3. `src/app/api/reports/summary/route.ts`.
4. `src/features/reports/api/index.ts` + `hook/use-reports.ts`.
5. Move `stat-card.tsx` → `src/components/stat-card.tsx`, fix `dashboard-kpi-row.tsx`'s import — before writing `period-summary-cards.tsx`.
6. `_components/period-selector.tsx`, `period-summary-cards.tsx`, `sales-trend-chart.tsx`, `bills-per-day-chart.tsx`, `stock-movement-chart.tsx`, `top-products-table.tsx`, then `reports-view.tsx` last.
7. `src/app/(protected)/reports/page.tsx` — replaces the placeholder last.

## Verification

1. `npx tsc --noEmit` — confirms the new type chain (route → api → hook → components) and the moved `StatCard`'s updated import are clean end-to-end.
2. `npm run dev`, log in, visit `/reports`.
3. Empty/fresh DB: all 4 summary cards show `₹0.00`/`0`, all three charts show empty-state messages, top-products table shows its empty row — no 500s from `GET /api/reports/summary`.
4. Create products (including a received-stock event) and bills spread across ≥2 days within the current week, mixing Cash/Udhaar. On the default "This week" view, confirm totals match manual sums, sales-trend/bills-per-day charts show activity on the right days, and top products rank by revenue (verify with one high-quantity/low-price product and one low-quantity/high-price product — the latter should rank higher if its revenue is greater).
5. Click "This month" — confirm the full current month's data loads; clicking back to "This week" restores the narrower range.
6. Pick a custom range with no bills — confirm zero-filled rendering, not a stuck loading state or error.
7. Pick a long multi-month custom range — confirm X-axis labels thin out but every day still plots.
8. Pick a 1-day custom range — confirm every widget renders without erroring.
9. Confirm `StockMovementChart` shows RECEIVED vs SOLD with a legend, and a period with only one type still renders (other series flat at zero, not an empty state).
10. Regression: `/dashboard` renders unchanged after `StatCard`'s move.
11. Clear the session cookie and hit `GET /api/reports/summary` directly → confirm `verifySession()` blocks it.
12. Consult `node_modules/next/dist/docs/` for this Next.js version's Route Handler/`searchParams` conventions if anything behaves unexpectedly during implementation (per AGENTS.md).
