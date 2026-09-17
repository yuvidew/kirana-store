"use client";

import { MinusIcon, PlusIcon, ShoppingCartIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";

import type { BillLineItem } from "./billing-view";

/**
 * Current line items in the bill being built: quantity steppers, line
 * totals, and a remove action per row.
 * @param lineItems - The bill's current line items.
 * @param onQuantityChange - Called with a product's id and its new quantity.
 * @param onRemove - Called with a product's id to remove its line item.
 */
export const BillLineItemsTable = ({
  lineItems,
  onQuantityChange,
  onRemove,
}: {
  lineItems: BillLineItem[];
  onQuantityChange: (productId: number, quantity: number) => void;
  onRemove: (productId: number) => void;
}) => {
  if (lineItems.length === 0) {
    return (
      <Empty className="min-h-32 py-2">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ShoppingCartIcon />
          </EmptyMedia>
          <EmptyTitle>No products added</EmptyTitle>
          <EmptyDescription>Search for a product above to add it to this bill.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Product</TableHead>
          <TableHead className="text-right">Price</TableHead>
          <TableHead className="text-center">Quantity</TableHead>
          <TableHead className="text-right">Line total</TableHead>
          <TableHead className="w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {lineItems.map((item) => (
          <TableRow key={item.productId}>
            <TableCell className="font-medium">{item.productName}</TableCell>
            <TableCell className="text-right font-mono text-sm tabular-nums text-muted-foreground">
              {formatCurrency(item.price)} / {item.unit}
            </TableCell>
            <TableCell>
              <InputGroup className="mx-auto w-32">
                <InputGroupAddon align="inline-start">
                  <InputGroupButton
                    aria-label={`Decrease quantity for ${item.productName}`}
                    disabled={item.quantity <= 1}
                    onClick={() => onQuantityChange(item.productId, item.quantity - 1)}
                  >
                    <MinusIcon />
                  </InputGroupButton>
                </InputGroupAddon>
                <InputGroupInput value={item.quantity} readOnly className="text-center font-mono tabular-nums" />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    aria-label={`Increase quantity for ${item.productName}`}
                    disabled={item.quantity >= item.stock}
                    onClick={() => onQuantityChange(item.productId, item.quantity + 1)}
                  >
                    <PlusIcon />
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
            </TableCell>
            <TableCell className="text-right font-mono font-medium tabular-nums">
              {formatCurrency(item.price * item.quantity)}
            </TableCell>
            <TableCell>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${item.productName}`}
                onClick={() => onRemove(item.productId)}
              >
                <XIcon />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
