import { format } from "date-fns";
import { MoreHorizontalIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";

import type { Product } from "../types";

/**
 * Product list table with per-row actions (edit, add stock, deactivate).
 * @param products - The rows to render (already filtered by the caller).
 * @param onEdit - Called with the row's product when "Edit" is chosen.
 * @param onAddStock - Called with the row's product when "Add stock" is chosen.
 * @param onDeactivate - Called with the row's product when "Deactivate" is chosen.
 */
export const ProductTable = ({
  products,
  onEdit,
  onAddStock,
  onDeactivate,
}: {
  products: Product[];
  onEdit: (product: Product) => void;
  onAddStock: (product: Product) => void;
  onDeactivate: (product: Product) => void;
}) => {
  return (
    <Table className="border">
      <TableHeader className="bg-secondary">
        <TableRow className="divide-x divide-border bg-secondary">
          <TableHead>Name</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Unit</TableHead>
          <TableHead className="text-right">Price</TableHead>
          <TableHead className="text-right">Stock</TableHead>
          <TableHead className="text-center">Expiry</TableHead>
          <TableHead className="text-center">Status</TableHead>
          <TableHead className="w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {products.map((product) => {
          const isLowStock =
            product.lowStockThreshold != null && Number(product.stock) <= Number(product.lowStockThreshold);

          return (
            <TableRow key={product.id} className="divide-x divide-border">
              <TableCell className="font-medium">{product.name}</TableCell>
              <TableCell>{product.category}</TableCell>
              <TableCell>{product.unit}</TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {formatCurrency(product.price)}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                <div className="flex items-center justify-end gap-2">
                  <span className="font-mono text-right tabular-nums">{product.stock}</span>
                  {isLowStock && <Badge variant="destructive">Low stock</Badge>}
                </div>
              </TableCell>
              <TableCell className="text-center font-mono tabular-nums">
                {product.expiryDate ? format(new Date(product.expiryDate), "PP") : "—"}
              </TableCell>
              <TableCell  className="text-center font-mono tabular-nums">
                <Badge variant={product.isActive ? "success" : "destructive"}>
                  {product.isActive ? "Active" : "Inactive"}
                </Badge>
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
                    <MoreHorizontalIcon />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit(product)}>Edit</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onAddStock(product)}>Add stock</DropdownMenuItem>
                    {product.isActive && (
                      <DropdownMenuItem onClick={() => onDeactivate(product)}>Deactivate</DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};
