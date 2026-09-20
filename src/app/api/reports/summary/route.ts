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
