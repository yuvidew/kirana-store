import { format } from "date-fns";
import { NextResponse } from "next/server";

import type { Bill as BillModel, Product as ProductModel } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { verifySession } from "@/lib/dal";
import type {
  DashboardSummaryResponse,
  InventoryValuation,
  LowStockItem,
  SalesTrendPoint,
  TopProduct,
} from "@/features/dashboard/types";

// Trend chart + top-products window — a week is enough for a quick-glance
// counter-screen dashboard without a date-range picker.
const TREND_WINDOW_DAYS = 7;
const RECENT_BILLS_LIMIT = 8;
const TOP_PRODUCTS_LIMIT = 5;

/**
 * Buckets bills into one revenue total per local calendar day across the
 * trend window, zero-filling days with no sales so the chart always has a
 * full 7-point domain.
 */
const buildSalesTrend = (
  bills: Pick<BillModel, "totalAmount" | "createdAt">[],
  startOfTrendWindow: Date
): SalesTrendPoint[] => {
  const totalsByDay = new Map<string, number>();
  for (let i = 0; i < TREND_WINDOW_DAYS; i++) {
    const day = new Date(startOfTrendWindow);
    day.setDate(day.getDate() + i);
    totalsByDay.set(format(day, "yyyy-MM-dd"), 0);
  }

  for (const bill of bills) {
    const key = format(bill.createdAt, "yyyy-MM-dd");
    totalsByDay.set(key, (totalsByDay.get(key) ?? 0) + Number(bill.totalAmount));
  }

  return Array.from(totalsByDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, revenue]) => ({ date, revenue: revenue.toFixed(2) }));
};

/**
 * Filters active products down to those at or below their configured
 * low-stock threshold. Products without a threshold set are excluded — a
 * known, accepted limitation rather than a bug. Prisma can't compare two
 * columns directly in a `where` filter without raw SQL, so the comparison
 * happens here in JS at this app's small (single-shop) scale.
 */
const filterLowStock = (
  products: Pick<ProductModel, "id" | "name" | "unit" | "stock" | "lowStockThreshold">[]
): LowStockItem[] =>
  products
    .filter((product) => product.lowStockThreshold != null && Number(product.stock) <= Number(product.lowStockThreshold))
    .map((product) => ({
      id: product.id,
      name: product.name,
      unit: product.unit,
      stock: product.stock.toString(),
      // Non-null: filtered above.
      lowStockThreshold: product.lowStockThreshold!.toString(),
    }));

/**
 * Returns the dashboard summary: today/this-month revenue and bill counts,
 * a 7-day daily revenue trend, active products at or below their low-stock
 * threshold, the most recent bills, the top 5 products by quantity sold
 * over the trend window, and the current inventory valuation. One
 * no-input GET backs the entire dashboard page.
 */
export const GET = async () => {
  await verifySession();

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfTrendWindow = new Date(startOfToday);
  startOfTrendWindow.setDate(startOfTrendWindow.getDate() - (TREND_WINDOW_DAYS - 1));

  try {
    const [
      todayAggregate,
      monthAggregate,
      trendBills,
      lowStockCandidates,
      recentBills,
      topProductGroups,
      inventoryProducts,
    ] = await Promise.all([
      db.bill.aggregate({ where: { createdAt: { gte: startOfToday } }, _sum: { totalAmount: true }, _count: true }),
      db.bill.aggregate({ where: { createdAt: { gte: startOfMonth } }, _sum: { totalAmount: true }, _count: true }),
      db.bill.findMany({
        where: { createdAt: { gte: startOfTrendWindow } },
        select: { totalAmount: true, createdAt: true },
      }),
      db.product.findMany({
        where: { isActive: true, lowStockThreshold: { not: null } },
        select: { id: true, name: true, unit: true, stock: true, lowStockThreshold: true },
      }),
      db.bill.findMany({
        orderBy: { createdAt: "desc" },
        take: RECENT_BILLS_LIMIT,
        select: { id: true, customerName: true, totalAmount: true, isCredit: true, createdAt: true },
      }),
      db.billItem.groupBy({
        by: ["productId"],
        where: { bill: { createdAt: { gte: startOfTrendWindow } } },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: TOP_PRODUCTS_LIMIT,
      }),
      db.product.findMany({ where: { isActive: true }, select: { stock: true, costPrice: true } }),
    ]);

    const topProductIds = topProductGroups.map((group) => group.productId);
    const topProductRows = topProductIds.length
      ? await db.product.findMany({ where: { id: { in: topProductIds } }, select: { id: true, name: true, unit: true } })
      : [];
    const productsById = new Map(topProductRows.map((product) => [product.id, product]));
    // `findMany`'s `in` filter doesn't preserve order — re-sort back into
    // the groupBy result's quantity-sold order.
    const topProducts: TopProduct[] = topProductGroups.flatMap((group) => {
      const product = productsById.get(group.productId);
      return product
        ? [{ id: product.id, name: product.name, unit: product.unit, quantitySold: (group._sum.quantity ?? 0).toString() }]
        : [];
    });

    const totalValue = inventoryProducts.reduce((sum, product) => sum + Number(product.stock) * Number(product.costPrice), 0);
    const inventoryValuation: InventoryValuation = {
      totalValue: totalValue.toFixed(2),
      activeProductCount: inventoryProducts.length,
    };

    return NextResponse.json<DashboardSummaryResponse>({
      kpis: {
        todayRevenue: todayAggregate._sum.totalAmount?.toString() ?? "0.00",
        todayBillCount: todayAggregate._count,
        monthRevenue: monthAggregate._sum.totalAmount?.toString() ?? "0.00",
        monthBillCount: monthAggregate._count,
      },
      salesTrend: buildSalesTrend(trendBills, startOfTrendWindow),
      lowStockItems: filterLowStock(lowStockCandidates),
      recentBills: recentBills.map((bill) => ({
        id: bill.id,
        customerName: bill.customerName,
        totalAmount: bill.totalAmount.toString(),
        isCredit: bill.isCredit,
        createdAt: bill.createdAt.toISOString(),
      })),
      topProducts,
      inventoryValuation,
    });
  } catch(error) {
    console.log("error", error)
    return NextResponse.json({ error: "Something went wrong loading the dashboard." }, { status: 500 });
  }
};
