# Phase 5 — Bills List / History (PRD 2.5)

## Context

Phases 1 (Auth), 2/2.5 (Products), 3 (Bill Generation), and 4 (Dashboard) are
done and merged. Phase 3's plan explicitly deferred the full searchable Bills
List/History table to this phase — it only built bill *creation* and a
single-bill *receipt* view (`/bills/[id]`, fully working with PDF download
and WhatsApp share). `/bills` (the list route) currently exists only as a
placeholder page stating "Built in Phase 5." This phase replaces that
placeholder with the real thing: a searchable, filterable, paginated table of
every bill ever created, so the shopkeeper can look up past sales instead of
only ever seeing the one bill they just made or the dashboard's "last 8"
snapshot.

**Scope decision confirmed with the user:** the PRD's payment-status column
asks for three states (Cash / Udhaar / Udhaar-paid), but the schema has no
way to know if a credit bill was ever paid off — `Bill.isCredit` is a bare
boolean, no `paidAt`/`CustomerPayment`/`Customer.balance` exists yet. That's
explicitly Phase 7's job (same reasoning Phase 3 used to defer
`Customer.balance`). **This phase ships a 2-state status (Cash/Udhaar) only,
with no schema change and no migration.** Phase 7 will need to revisit this
column once real payoff tracking exists.

Everything needed already exists in the schema (`Bill`, `BillItem`,
`Customer`) and in established patterns — this is purely additive code, no
new dependencies, no new shadcn installs. The paginated/searchable/filterable
list pattern to mirror exactly is `src/features/products/` (see
`products-view.tsx`, `use-products.ts`, `src/app/api/products/route.ts`).

## Reused patterns / files (read before writing)

- `src/features/products/types.ts`, `api/index.ts`, `hook/use-products.ts`,
  `src/app/api/products/route.ts` — the pagination/search/filter contract:
  `{ search?, ...filters, page?, pageSize? }` query → `{ items, page,
  pageSize, totalCount, totalPages }` response, built via
  `Promise.all([findMany, count])` with a conditionally-built `where`.
- `src/features/products/_components/products-view.tsx` — state management
  to copy verbatim in shape: local `search` + `debouncedSearch` (300ms
  inline `setTimeout`/`useEffect`, no shared debounce hook exists in this
  repo — don't add one), filter `Select`s that reset `page` to 1, hand-rolled
  Prev/Next pagination buttons (`src/components/ui/pagination.tsx` exists
  but is intentionally unused elsewhere — stay consistent, don't introduce
  it here), `LoadingCard`/`ErrorCard` (`@/components/query-state`), shadcn
  `Empty*` zero-state with a message that differs between "no results for
  these filters" and "nothing exists yet."
- `src/app/api/bills/route.ts` — already has `POST` + a `toBillDto` mapper
  that eager-loads `items.product` (too heavy for a list row). Add a
  separate, lighter `GET` + `toBillListItemDto` alongside it, not a reuse of
  `toBillDto`.
- `src/features/bills/{types,api/index,hook/use-bills}.ts` — currently only
  has the single-bill detail shapes (`Bill`, `BillItemDto`, `BillResponse`,
  `getBill`, `useBill`). Add the list shapes/functions/hook alongside them
  in the same files (per the folder convention: one feature, one file per
  concern, list + detail colocated).
- `src/features/bills/_components/bill-receipt-view.tsx` — already uses the
  dual-state badge convention `variant={bill.isCredit ? "destructive" :
  "success"}` / `{bill.isCredit ? "Udhaar" : "Cash"}`. Reuse this exact
  convention for the new table (not the dashboard's credit-only `secondary`
  badge in `recent-bills-list.tsx` — two conventions currently exist in the
  codebase for the same flag; standardize on the receipt view's since it
  needs to show both states as a real column). `src/components/ui/badge.tsx`
  confirms a `success` variant already exists.
- `src/components/date-picker.tsx` — single-date Popover+Calendar wrapper to
  clone into a range version. `src/components/ui/calendar.tsx` already
  passes through all of `react-day-picker`'s props (including `mode="range"`
  and `numberOfMonths`) — no new shadcn install needed.
- `src/lib/utils.ts`'s `formatCurrency` — the only formatting helper; dates
  are formatted inline with `date-fns`'s `format()` everywhere else
  (`"PPp"` for date+time, matching `recent-bills-list.tsx`).

---

## 1. `src/features/bills/types.ts` — additive

Append below the existing `BillItemDto`/`Bill`/`BillResponse`:

```ts
/** Payment-status filter for the bills list — "all" applies no isCredit filter. */
export const BILL_PAYMENT_FILTERS = ["all", "cash", "udhaar"] as const;
export type BillPaymentFilter = (typeof BILL_PAYMENT_FILTERS)[number];

/**
 * Lightweight row shape for the bills list/history table — an `itemCount`
 * instead of full `items`, since the list endpoint doesn't eager-load line
 * items/products the way the single-bill detail endpoint does.
 */
export type BillListItem = {
  id: number;
  customerName: string | null;
  customerPhone: string | null;
  isCredit: boolean;
  totalAmount: string;
  itemCount: number;
  createdAt: string;
};

export type BillsQuery = {
  search?: string;
  payment?: BillPaymentFilter;
  dateFrom?: string; // "yyyy-MM-dd", inclusive, local calendar day
  dateTo?: string; // "yyyy-MM-dd", inclusive, local calendar day
  page?: number;
  pageSize?: number;
};

export type BillsResponse = {
  bills: BillListItem[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};
```

Naming mirrors `Product`/`ProductsQuery`/`ProductsResponse`/
`ProductStatusFilter` exactly. `payment` (not raw `isCredit`) is the
query-param name since it's a UI-facing tri-value filter, same relationship
as `status` wrapping `isActive` on products.

---

## 2. `GET /api/bills` — `src/app/api/bills/route.ts` (additive)

Add alongside the existing `toBillDto`/`POST` (don't reorder/touch them).

```ts
type BillListRow = Pick<
  BillModel,
  "id" | "customerName" | "customerPhone" | "isCredit" | "totalAmount" | "createdAt"
> & { _count: { items: number } };

/** Maps a Prisma `Bill` row (selected with `_count.items`) to the bills-list row shape — no item/product join needed. */
const toBillListItemDto = (bill: BillListRow): BillListItem => ({
  id: bill.id,
  customerName: bill.customerName,
  customerPhone: bill.customerPhone,
  isCredit: bill.isCredit,
  totalAmount: bill.totalAmount.toString(),
  itemCount: bill._count.items,
  createdAt: bill.createdAt.toISOString(),
});

const DEFAULT_PAGE_SIZE = 10;

/**
 * Lists bills, filtered by customer name/phone search, payment mode, and a
 * created-date range, paginated and sorted latest-first.
 * @param request - Query params: `search?` (matches customerName OR
 * customerPhone), `payment?` ("all"/"cash"/"udhaar", default "all"),
 * `dateFrom?`/`dateTo?` (inclusive "yyyy-MM-dd"), `page?` (default 1),
 * `pageSize?` (default 10).
 */
export const GET = async (request: Request) => {
  await verifySession();

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim() || undefined;
  const paymentParam = searchParams.get("payment");
  const payment = (BILL_PAYMENT_FILTERS as readonly string[]).includes(paymentParam ?? "")
    ? (paymentParam as BillPaymentFilter)
    : "all";
  const dateFromParam = searchParams.get("dateFrom");
  const dateToParam = searchParams.get("dateTo");
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const pageSize = Math.max(1, Number(searchParams.get("pageSize")) || DEFAULT_PAGE_SIZE);

  // "dateTo" is treated as inclusive of the whole day by pushing the upper
  // bound to the next local midnight, rather than depending on a
  // time-of-day component in the incoming "yyyy-MM-dd" string.
  const createdAtFilter: { gte?: Date; lt?: Date } = {};
  if (dateFromParam) {
    const from = new Date(dateFromParam);
    if (!Number.isNaN(from.getTime())) createdAtFilter.gte = from;
  }
  if (dateToParam) {
    const to = new Date(dateToParam);
    if (!Number.isNaN(to.getTime())) {
      to.setDate(to.getDate() + 1);
      createdAtFilter.lt = to;
    }
  }

  const where = {
    ...(search
      ? { OR: [{ customerName: { contains: search } }, { customerPhone: { contains: search } }] }
      : {}),
    ...(payment === "all" ? {} : { isCredit: payment === "udhaar" }),
    ...(Object.keys(createdAtFilter).length ? { createdAt: createdAtFilter } : {}),
  };

  try {
    const [bills, totalCount] = await Promise.all([
      db.bill.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          customerName: true,
          customerPhone: true,
          isCredit: true,
          totalAmount: true,
          createdAt: true,
          _count: { select: { items: true } },
        },
      }),
      db.bill.count({ where }),
    ]);

    return NextResponse.json<BillsResponse>({
      bills: bills.map(toBillListItemDto),
      page,
      pageSize,
      totalCount,
      totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
    });
  } catch {
    return NextResponse.json({ error: "Something went wrong loading bills." }, { status: 500 });
  }
};
```

Import additions to the top of the file: `BILL_PAYMENT_FILTERS`,
`BillListItem`, `BillPaymentFilter`, `BillsResponse` from
`@/features/bills/types` (added to the existing `Bill`/`BillItemDto`/
`BillResponse` import line). `orderBy` is fixed to `createdAt: "desc"` — the
PRD only asks for latest-first, no sort-toggle UI needed.

---

## 3. `src/features/bills/api/index.ts` — additive

```ts
export const allBills = async (query: BillsQuery) => {
  const { data } = await axios.get<BillsResponse>("/api/bills", {
    params: {
      search: query.search || undefined,
      payment: query.payment,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      page: query.page,
      pageSize: query.pageSize,
    },
  });
  return data;
};
```

`getBill` stays unchanged; add `BillsQuery`/`BillsResponse` to the existing
type import line.

---

## 4. `src/features/bills/hook/use-bills.ts` — additive

```ts
/**
 * Query hook for the paginated, filtered bills list/history.
 * @param query - `search`/`payment`/`dateFrom`/`dateTo`/`page`/`pageSize` filters.
 * @param options - Optional `refetchInterval` for polling.
 */
export const useAllBills = (query: BillsQuery, options?: { refetchInterval?: number }) => {
  return useQuery({
    queryFn: () => allBills(query),
    queryKey: ["all-bills", query],
    placeholderData: keepPreviousData,
    refetchInterval: options?.refetchInterval,
  });
};
```

Add `keepPreviousData` to the existing `@tanstack/react-query` import,
`allBills` to the existing `../api` import, `BillsQuery` to the type import.
`useBill` stays unchanged; put `useAllBills` above it (list hook leads,
matching `use-products.ts`'s ordering).

---

## 5. New component: `src/components/date-range-picker.tsx`

Shared (not feature-scoped) since it's generic UI, colocated with the
existing `date-picker.tsx`:

```tsx
"use client";

import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * A button that opens a calendar popover to pick a date range (from/to).
 * @param value - The currently selected range, or undefined.
 * @param onChange - Called with the newly picked range (or undefined if cleared).
 * @param placeholder - Button text shown when no range is selected.
 */
export const DateRangePicker = ({
  value,
  onChange,
  placeholder = "Filter by date",
}: {
  value: DateRange | undefined;
  onChange: (range: DateRange | undefined) => void;
  placeholder?: string;
}) => {
  const label = value?.from
    ? value.to
      ? `${format(value.from, "PP")} – ${format(value.to, "PP")}`
      : format(value.from, "PP")
    : placeholder;

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            className={cn("w-auto justify-start font-normal", !value?.from && "text-muted-foreground")}
          />
        }
      >
        <CalendarIcon />
        {label}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar mode="range" selected={value} onSelect={onChange} numberOfMonths={2} />
      </PopoverContent>
    </Popover>
  );
};
```

Mirrors `date-picker.tsx`'s exact structure (`Popover`/`PopoverTrigger`
`render` prop pattern, confirmed correct against `src/components/ui/button.tsx`
and `popover.tsx`), swapping `mode="single"`/`Date` for `mode="range"`/
`DateRange`. `numberOfMonths={2}` so both ends of a short range are visible
without renavigating months.

---

## 6. New component: `src/features/bills/_components/bills-table.tsx`

Read-only table (no row mutations, unlike `product-table.tsx`) — the only
row action is a link to the existing `/bills/[id]` receipt view.

```tsx
import { format } from "date-fns";
import Link from "next/link";
import { ReceiptTextIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";

import type { BillListItem } from "../types";

/**
 * Bills list/history table. Each row links to the existing `/bills/[id]`
 * receipt view (Phase 3) via its action column — no bill mutation happens
 * from this table.
 * @param bills - The rows to render (already filtered/paginated by the caller).
 */
export const BillsTable = ({ bills }: { bills: BillListItem[] }) => {
  return (
    <Table className="border bg-card p-3">
      <TableHeader className="bg-secondary">
        <TableRow className="divide-x divide-border bg-secondary">
          <TableHead>Bill ID</TableHead>
          <TableHead>Date &amp; time</TableHead>
          <TableHead>Customer</TableHead>
          <TableHead className="text-right">Items</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead className="text-center">Payment</TableHead>
          <TableHead className="w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {bills.map((bill) => (
          <TableRow key={bill.id} className="divide-x divide-border">
            <TableCell className="font-mono tabular-nums">#{bill.id}</TableCell>
            <TableCell className="font-mono tabular-nums">{format(new Date(bill.createdAt), "PPp")}</TableCell>
            <TableCell>
              <div className="flex flex-col">
                <span className="font-medium">{bill.customerName || "Walk-in customer"}</span>
                {bill.customerPhone && <span className="text-xs text-muted-foreground">{bill.customerPhone}</span>}
              </div>
            </TableCell>
            <TableCell className="text-right font-mono tabular-nums">{bill.itemCount}</TableCell>
            <TableCell className="text-right font-mono tabular-nums">{formatCurrency(bill.totalAmount)}</TableCell>
            <TableCell className="text-center">
              <Badge variant={bill.isCredit ? "destructive" : "success"}>{bill.isCredit ? "Udhaar" : "Cash"}</Badge>
            </TableCell>
            <TableCell>
              <Button
                variant="ghost"
                size="icon-sm"
                render={<Link href={`/bills/${bill.id}`} aria-label={`View bill #${bill.id}`} />}
              >
                <ReceiptTextIcon />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
```

---

## 7. New component: `src/features/bills/_components/bills-view.tsx`

Page-level composition, structurally mirroring `products-view.tsx` (state
management, debounce, filter-resets-page, pagination footer, empty states).
No separate `bills-filters.tsx` — inline, matching how `products-view.tsx`
keeps its filter row inline.

```tsx
"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ChevronLeftIcon, ChevronRightIcon, ReceiptTextIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { DateRangePicker } from "@/components/date-range-picker";
import { ErrorCard, LoadingCard } from "@/components/query-state";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { useAllBills } from "../hook/use-bills";
import { BILL_PAYMENT_FILTERS } from "../types";
import type { BillPaymentFilter } from "../types";
import { BillsTable } from "./bills-table";

const PAGE_SIZE = 10;
// Delay before a search keystroke fires a request, matching products' list.
const SEARCH_DEBOUNCE_MS = 300;

const PAYMENT_FILTER_LABELS: Record<BillPaymentFilter, string> = {
  all: "All payments",
  cash: "Cash",
  udhaar: "Udhaar",
};

/**
 * Bills list/history page: search by customer name/phone, filter by date
 * range and payment status, paginated table sorted latest-first. All
 * filtering/pagination is server-side via `useAllBills`'s query params. Row
 * actions link out to the existing `/bills/[id]` receipt view.
 */
export const BillsView = () => {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<BillPaymentFilter>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [search]);

  const handlePaymentFilterChange = (value: BillPaymentFilter) => {
    setPaymentFilter(value);
    setPage(1);
  };
  const handleDateRangeChange = (range: DateRange | undefined) => {
    setDateRange(range);
    setPage(1);
  };

  const { data, isLoading, isError, refetch } = useAllBills({
    search: debouncedSearch || undefined,
    payment: paymentFilter,
    dateFrom: dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : undefined,
    dateTo: dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  const bills = data?.bills ?? [];
  const totalPages = data?.totalPages ?? 1;
  const hasActiveFilters = !!debouncedSearch || paymentFilter !== "all" || !!dateRange?.from;

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-heading text-xl font-semibold tracking-tight">Bills</h1>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Input
          placeholder="Search by customer name or phone…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="max-w-xs"
        />
        <DateRangePicker value={dateRange} onChange={handleDateRangeChange} />
        <Select
          value={paymentFilter}
          onValueChange={(value) => value && handlePaymentFilterChange(value as BillPaymentFilter)}
        >
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BILL_PAYMENT_FILTERS.map((filter) => (
              <SelectItem key={filter} value={filter}>
                {PAYMENT_FILTER_LABELS[filter]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <LoadingCard title="Loading bills…" />
      ) : isError ? (
        <ErrorCard
          title="Couldn't load bills"
          description="Something went wrong loading the bill history."
          onRetry={() => refetch()}
        />
      ) : bills.length === 0 ? (
        <Empty className="min-h-64">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ReceiptTextIcon />
            </EmptyMedia>
            <EmptyTitle>No bills found</EmptyTitle>
            <EmptyDescription>
              {hasActiveFilters
                ? "No bills match your search or filters."
                : "Bills you create from the Billing page will show up here."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <BillsTable bills={bills} />
          <div className="flex items-center justify-between">
            <p className="font-mono text-sm tabular-nums text-muted-foreground">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                <ChevronLeftIcon />
                Prev
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                Next
                <ChevronRightIcon />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
```

Note on the empty-state message: unlike products (which distinguishes
"no results" vs. "add your first" using `totalCount > 0`, a check that's
only meaningful when no filters are active), this uses `hasActiveFilters`
directly — simpler and avoids products' existing ambiguity (its
`hasAnyResults` can't tell "zero ever" from "zero on this filtered page"
either, a pre-existing limitation, not something to fix here).

---

## 8. `src/app/(protected)/bills/page.tsx` — replace placeholder

```tsx
import { BillsView } from "@/features/bills/_components/bills-view";

/** /bills — bill list/history: search, filter by date range and payment status, paginated table. */
const BillsPage = () => <BillsView />;

export default BillsPage;
```

One-line wrapper, matching `products/page.tsx` and `dashboard/page.tsx`.
`src/app/(protected)/bills/[id]/page.tsx` is untouched — already fully built.

---

## Sequencing

1. `types.ts` (§1) — everything else depends on these types.
2. `src/app/api/bills/route.ts`'s new `GET` (§2).
3. `features/bills/api/index.ts` + `hook/use-bills.ts` (§3–4).
4. `src/components/date-range-picker.tsx` (§5) — standalone, no dependency on bills code.
5. `_components/bills-table.tsx` then `bills-view.tsx` (§6–7).
6. `app/(protected)/bills/page.tsx` (§8) — last, wires it all up.

## Verification

1. `npx tsc --noEmit` — confirms the new DTO/type chain (route → api → hook → components) is clean.
2. `npm run dev`, log in, go to `/bills`.
3. No seed script exists in this repo — manually create test bills via `/billing` first: at least 2 cash and 2 Udhaar bills (Udhaar needs a phone number, per the existing form), across at least 2 different customer names/phones and item counts.
4. On `/bills`, confirm: table shows Bill ID, date/time, customer (name + phone), item count, total, payment badge (Cash = green `success`, Udhaar = red `destructive`), and each row's action button navigates to `/bills/[id]` with the existing receipt view unchanged.
5. Sort order is latest-first with no explicit sort control.
6. Search: typing a customer name, then a customer phone, each filter correctly after the 300ms debounce; clearing restores the full list.
7. Payment filter: "Cash"/"Udhaar"/"All payments" each show the correct subset.
8. Date range: a range excluding all bills shows the "no bills match" empty state (not the cold-start message); a range including them shows them; picking only a "from" date works as an open-ended lower bound.
9. Any filter/search change resets to page 1; with 11+ bills, confirm Prev/Next enable/disable correctly and "Page X of Y" updates.
10. Zero-state text is correct in both the "no bills exist at all" and "filters matched nothing" cases.
11. Regression: `POST /api/bills` (create) and `GET /api/bills/[id]` (detail, PDF, WhatsApp share) still work unchanged — nothing shared was modified, only additive exports.
12. Clear the session cookie and hit `GET /api/bills` directly → confirm `verifySession()` blocks it.
