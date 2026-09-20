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
