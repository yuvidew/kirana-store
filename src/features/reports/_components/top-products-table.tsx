import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";

import type { TopSellingProduct } from "../types";

/**
 * Top 10 products by revenue for the selected period, most-revenue-first.
 * @param products - Already-ranked (revenue desc) products from the reports summary.
 */
export const TopProductsTable = ({ products }: { products: TopSellingProduct[] }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Top selling products</CardTitle>
      </CardHeader>
      <CardContent>
        {products.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No sales in this period.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Qty sold</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product, index) => (
                <TableRow key={product.id}>
                  <TableCell className="font-mono tabular-nums text-muted-foreground">{index + 1}</TableCell>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {product.quantitySold} {product.unit}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{formatCurrency(product.revenue)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};
