"use client";

import { format } from "date-fns";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { chartTickInterval } from "@/lib/utils";

import type { StockMovementPoint } from "../types";

const chartConfig = {
  received: { label: "Received", color: "var(--chart-2)" },
  sold: { label: "Sold", color: "var(--chart-3)" },
} satisfies ChartConfig;

/**
 * Daily stock received vs. sold quantities over the selected period, as a
 * grouped bar chart. Only shows an empty state when both series are zero
 * across every day — a period with just one movement type still renders,
 * with the other series flat at zero.
 * @param stockMovement - Date-ordered points (zero-filled for days with no movement).
 */
export const StockMovementChart = ({ stockMovement }: { stockMovement: StockMovementPoint[] }) => {
  const hasMovement = stockMovement.some((point) => Number(point.received) > 0 || Number(point.sold) > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Stock movement</CardTitle>
      </CardHeader>
      <CardContent>
        {hasMovement ? (
          <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
            <BarChart data={stockMovement} margin={{ left: 12, right: 12 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                interval={chartTickInterval(stockMovement.length)}
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
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="received" fill="var(--color-received)" radius={4} />
              <Bar dataKey="sold" fill="var(--color-sold)" radius={4} />
            </BarChart>
          </ChartContainer>
        ) : (
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
            No stock movement in this period.
          </div>
        )}
      </CardContent>
    </Card>
  );
};
