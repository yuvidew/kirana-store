import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import type { LowStockItem } from "../types";

/**
 * Active products at or below their configured low-stock threshold.
 * @param items - The low-stock products to list.
 */
export const LowStockList = ({ items }: { items: LowStockItem[] }) => {
  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Low stock</CardTitle>
        {items.length > 0 && <Badge variant="destructive">{items.length}</Badge>}
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            All products are above their low-stock threshold.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="font-medium">{item.name}</span>
                <span className="font-mono tabular-nums text-muted-foreground">
                  {item.stock}/{item.lowStockThreshold} {item.unit}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};
