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
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Unit</TableHead>
          <TableHead>Price</TableHead>
          <TableHead>Stock</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {products.map((product) => (
          <TableRow key={product.id}>
            <TableCell className="font-medium">{product.name}</TableCell>
            <TableCell>{product.unit}</TableCell>
            <TableCell>{formatCurrency(product.price)}</TableCell>
            <TableCell>{product.stock}</TableCell>
            <TableCell>
              <Badge variant={product.isActive ? "default" : "secondary"}>
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
        ))}
      </TableBody>
    </Table>
  );
};
