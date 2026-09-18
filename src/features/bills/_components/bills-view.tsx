"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { BillDetailDialog } from "./bill-detail-dialog";
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
 * actions open a `BillDetailDialog` in place — there's no separate
 * `/bills/[id]` page. A one-time `?billId=` param (set after creating a bill,
 * or from the dashboard's recent-bills list) opens that bill's dialog on load.
 */
export const BillsView = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<BillPaymentFilter>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [page, setPage] = useState(1);
  // Seeded from a one-time `?billId=` param — set by the billing form and the
  // dashboard's recent-bills list to deep-link straight into a bill's dialog.
  const [selectedBillId, setSelectedBillId] = useState<number | null>(() => {
    const param = searchParams.get("billId");
    return param ? Number(param) : null;
  });

  useEffect(() => {
    // Strip the param immediately after consuming it into dialog state, so
    // closing the dialog (or reloading the page) doesn't reopen it.
    if (searchParams.get("billId")) {
      router.replace("/bills");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Reset to page 1 alongside the debounced search value so a new search
    // doesn't leave the view stranded on a now out-of-range page.
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
          <BillsTable bills={bills} onView={setSelectedBillId} />
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

      <BillDetailDialog
        billId={selectedBillId}
        onOpenChange={(open) => !open && setSelectedBillId(null)}
      />
    </div>
  );
};
