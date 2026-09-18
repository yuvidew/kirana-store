// Money/quantity fields that come from Prisma Decimal columns are
// serialized as strings, matching the convention in products/types.ts and
// bills/types.ts. Counts are plain numbers since they never touch a
// Decimal column.

export type DashboardKpis = {
  todayRevenue: string;
  todayBillCount: number;
  monthRevenue: string;
  monthBillCount: number;
};

export type SalesTrendPoint = {
  // Local calendar day this bucket represents, "yyyy-MM-dd".
  date: string;
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
  // Always exactly 7 points (including zero-revenue days), oldest first.
  salesTrend: SalesTrendPoint[];
  lowStockItems: LowStockItem[];
  recentBills: RecentBillItem[];
  topProducts: TopProduct[];
  inventoryValuation: InventoryValuation;
};
