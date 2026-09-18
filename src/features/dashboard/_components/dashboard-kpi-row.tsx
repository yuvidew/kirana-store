import { CalendarIcon, ReceiptTextIcon, TrendingUpIcon, WarehouseIcon } from "lucide-react";

import { formatCurrency } from "@/lib/utils";

import type { DashboardKpis, InventoryValuation } from "../types";
import { StatCard } from "./stat-card";

/**
 * The dashboard's top row of KPI tiles: today's and this month's revenue and
 * bill count, plus current inventory valuation.
 * @param kpis - Today/this-month revenue and bill counts.
 * @param inventoryValuation - Current stock's total worth and active count.
 */
export const DashboardKpiRow = ({
  kpis,
  inventoryValuation,
}: {
  kpis: DashboardKpis;
  inventoryValuation: InventoryValuation;
}) => {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
      <StatCard
        label="Today's revenue"
        value={formatCurrency(kpis.todayRevenue)}
        sublabel={`${kpis.todayBillCount} bill${kpis.todayBillCount === 1 ? "" : "s"}`}
        icon={TrendingUpIcon}
      />
      <StatCard label="Today's bills" value={String(kpis.todayBillCount)} icon={ReceiptTextIcon} />
      <StatCard
        label="This month's revenue"
        value={formatCurrency(kpis.monthRevenue)}
        sublabel={`${kpis.monthBillCount} bill${kpis.monthBillCount === 1 ? "" : "s"}`}
        icon={CalendarIcon}
      />
      <StatCard label="This month's bills" value={String(kpis.monthBillCount)} icon={ReceiptTextIcon} />
      <StatCard
        label="Inventory value"
        value={formatCurrency(inventoryValuation.totalValue)}
        sublabel={`${inventoryValuation.activeProductCount} active product${inventoryValuation.activeProductCount === 1 ? "" : "s"}`}
        icon={WarehouseIcon}
      />
    </div>
  );
};
