import { IndianRupeeIcon, PackageIcon, ReceiptTextIcon, TruckIcon } from "lucide-react";

import { StatCard } from "@/components/stat-card";
import { formatCurrency } from "@/lib/utils";

import type { ReportsSummaryTotals } from "../types";

/**
 * The Reports page's 4 period-total tiles: total revenue, total bills, items
 * sold, and items received, for the currently selected date range.
 * @param summary - Period totals from the reports summary response.
 */
export const PeriodSummaryCards = ({ summary }: { summary: ReportsSummaryTotals }) => {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard label="Total revenue" value={formatCurrency(summary.totalRevenue)} icon={IndianRupeeIcon} />
      <StatCard label="Total bills" value={String(summary.totalBills)} icon={ReceiptTextIcon} />
      <StatCard label="Items sold" value={summary.itemsSold} icon={PackageIcon} />
      <StatCard label="Items received" value={summary.itemsReceived} icon={TruckIcon} />
    </div>
  );
};
