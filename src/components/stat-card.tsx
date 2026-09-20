import type { LucideIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * A single KPI tile — a label, a big value, and an optional sublabel/icon.
 * Reused for each dashboard stat (today/month revenue and bill counts,
 * inventory valuation).
 * @param label - The stat's name, e.g. "Today's revenue".
 * @param value - The stat's formatted value, e.g. "₹1,250.00".
 * @param sublabel - Optional supporting text under the value.
 * @param icon - Optional lucide icon shown beside the label.
 */
export const StatCard = ({
  label,
  value,
  sublabel,
  icon: Icon,
}: {
  label: string;
  value: string;
  sublabel?: string;
  icon?: LucideIcon;
}) => {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-normal text-muted-foreground">
          {Icon && <Icon className="size-4" />}
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="font-mono text-2xl font-semibold tabular-nums">{value}</p>
        {sublabel && <p className="text-sm text-muted-foreground">{sublabel}</p>}
      </CardContent>
    </Card>
  );
};
