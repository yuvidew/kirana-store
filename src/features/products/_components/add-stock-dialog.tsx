"use client";

import type { SubmitEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import { useAddProductStock } from "../hook/use-products";
import type { Product } from "../types";

/**
 * Small dialog for recording received stock against a product.
 * @param open - Whether the dialog is open.
 * @param onOpenChange - Called to open/close the dialog.
 * @param product - The product to add stock to, or `null` when closed.
 */
export const AddStockDialog = ({
  open,
  onOpenChange,
  product,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
}) => {
  const addProductStockMutation = useAddProductStock();

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!product) return;

    const formData = new FormData(event.currentTarget);
    const quantity = Number(formData.get("quantity"));

    addProductStockMutation.mutate(
      { id: product.id, quantity, productName: product.name },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add stock</DialogTitle>
          {product && <DialogDescription>Record received stock for {product.name}.</DialogDescription>}
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="quantity">Quantity received</FieldLabel>
              <Input id="quantity" name="quantity" type="number" step="0.01" min="0.01" required />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={addProductStockMutation.isPending}>
                {addProductStockMutation.isPending ? "Adding…" : "Add stock"}
              </Button>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
};
