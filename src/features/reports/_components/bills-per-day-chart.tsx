"use client";

import { format } from "date-fns";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { chartTickInterval } from "@/lib/utils";

import type { DailySalesPoint } from "../types";

const chartConfig = {
  billCount: { label: "Bills", color: "var(--chart-2)" },
} satisfies ChartConfig;

/**
 * Daily bill count over the selected period, as a bar chart.
 * @param dailySales - Date-ordered points (zero-filled for days with no bills) — same data source as SalesTrendChart.
 */
export const BillsPerDayChart = ({ dailySales }: { dailySales: DailySalesPoint[] }) => {
  const hasBills = dailySales.some((point) => point.billCount > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bills generated</CardTitle>
      </CardHeader>
      <CardContent>
        {hasBills ? (
          <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
            <BarChart data={dailySales} margin={{ left: 12, right: 12 }}>
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
                  />
                }
              />
              <Bar dataKey="billCount" fill="var(--color-billCount)" radius={4} />
            </BarChart>
          </ChartContainer>
        ) : (
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
            No bills in this period.
          </div>
        )}
      </CardContent>
    </Card>
  );
};
