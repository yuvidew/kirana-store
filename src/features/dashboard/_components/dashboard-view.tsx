"use client";

import { ErrorCard, LoadingCard } from "@/components/query-state";

import { useDashboardSummary } from "../hook/use-dashboard";
import { DashboardKpiRow } from "./dashboard-kpi-row";
import { LowStockList } from "./low-stock-list";
import { RecentBillsList } from "./recent-bills-list";
import { SalesTrendChart } from "./sales-trend-chart";
import { TopProductsList } from "./top-products-list";

// Keeps the dashboard current if left open on a shop counter screen.
const REFETCH_INTERVAL_MS = 60_000;

/**
 * The dashboard page: today/this-month KPIs, a 7-day sales trend, low-stock
 * alerts, recent bills, and top-selling products — all from one polled
 * summary query.
 */
export const DashboardView = () => {
  const { data, isLoading, isError, refetch } = useDashboardSummary({ refetchInterval: REFETCH_INTERVAL_MS });

  return (
    <div className="flex flex-col gap-4 p-6">
      <h1 className="font-heading text-xl font-semibold tracking-tight">Dashboard</h1>

      {isLoading ? (
        <LoadingCard title="Loading dashboard…" />
      ) : isError || !data ? (
        <ErrorCard
          title="Couldn't load dashboard"
          description="Something went wrong loading the dashboard summary."
          onRetry={() => refetch()}
        />
      ) : (
        <>
          <DashboardKpiRow kpis={data.kpis} inventoryValuation={data.inventoryValuation} />
          <SalesTrendChart salesTrend={data.salesTrend} />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <LowStockList items={data.lowStockItems} />
            <RecentBillsList bills={data.recentBills} />
            <TopProductsList products={data.topProducts} />
          </div>
        </>
      )}
    </div>
  );
};
