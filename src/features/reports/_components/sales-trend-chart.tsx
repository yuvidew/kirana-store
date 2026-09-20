"use client";

import { format } from "date-fns";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { chartTickInterval, formatCurrency } from "@/lib/utils";

import type { DailySalesPoint } from "../types";

const chartConfig = {
  revenue: { label: "Revenue", color: "var(--chart-1)" },
} satisfies ChartConfig;

/**
 * Daily revenue over the selected period, as an area chart.
 * @param dailySales - Date-ordered points (zero-filled for days with no sales).
 */
export const SalesTrendChart = ({ dailySales }: { dailySales: DailySalesPoint[] }) => {
  const hasSales = dailySales.some((point) => Number(point.revenue) > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sales trend</CardTitle>
      </CardHeader>
      <CardContent>
        {hasSales ? (
          <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
            <AreaChart data={dailySales} margin={{ left: 12, right: 12 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                interval={chartTickInterval(dailySales.length)}
                tickFormatter={(value: string) => format(new Date(value), "MMM d")}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(_, payload) =>
                      payload?.[0]?.payload?.date ? format(new Date(payload[0].payload.date), "PP") : ""
                    }
                    formatter={(value) => formatCurrency(value as string)}
                  />
                }
              />
              <Area dataKey="revenue" type="monotone" fill="var(--color-revenue)" fillOpacity={0.2} stroke="var(--color-revenue)" />
            </AreaChart>
          </ChartContainer>
        ) : (
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
            No sales in this period.
          </div>
        )}
      </CardContent>
    </Card>
  );
};
