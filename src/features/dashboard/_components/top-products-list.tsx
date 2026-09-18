import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import type { TopProduct } from "../types";

/**
 * The top 5 products by quantity sold over the trailing 7 days.
 * @param products - The top products, already ranked by quantity sold.
 */
export const TopProductsList = ({ products }: { products: TopProduct[] }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Top products (7 days)</CardTitle>
      </CardHeader>
      <CardContent>
        {products.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No sales in the last 7 days.</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {products.map((product, index) => (
              <li key={product.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-2">
                  <span className="font-mono text-muted-foreground">{index + 1}.</span>
                  <span className="font-medium">{product.name}</span>
                </span>
                <span className="font-mono tabular-nums text-muted-foreground">
                  {product.quantitySold} {product.unit}
                </span>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
};
