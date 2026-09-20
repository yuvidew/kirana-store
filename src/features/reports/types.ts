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
