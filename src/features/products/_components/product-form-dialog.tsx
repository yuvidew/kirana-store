"use client";

import { useState } from "react";
import type { SubmitEvent } from "react";
import { MinusIcon, PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useCreateProduct, useUpdateProduct } from "../hook/use-products";
import { PRODUCT_UNITS } from "../types";
import type { Product } from "../types";

/**
 * Shared create/edit dialog for a product. Edit mode (when `product` is
 * given) only exposes name/price/unit — stock changes only ever happen via
 * the dedicated "add stock" action, to keep the StockMovement audit trail
 * accurate.
 * @param open - Whether the dialog is open.
 * @param onOpenChange - Called to open/close the dialog.
 * @param product - The product to edit, or `undefined` to create a new one.
 */
export const ProductFormDialog = ({
  open,
  onOpenChange,
  product,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product;
}) => {
  const isEditing = !!product;
  const [unit, setUnit] = useState(product?.unit ?? PRODUCT_UNITS[0]);
  const [initialStock, setInitialStock] = useState(0);
  const createProductMutation = useCreateProduct();
  const updateProductMutation = useUpdateProduct();
  const isPending = createProductMutation.isPending || updateProductMutation.isPending;

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") ?? "");
    const price = Number(formData.get("price"));

    if (isEditing) {
      updateProductMutation.mutate(
        { id: product.id, name, price, unit },
        { onSuccess: () => onOpenChange(false) }
      );
      return;
    }

    createProductMutation.mutate(
      { name, price, unit, initialStock: initialStock > 0 ? initialStock : undefined },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit product" : "Add product"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="name">Name</FieldLabel>
              <Input id="name" name="name" defaultValue={product?.name} required />
            </Field>
            <Field>
              <FieldLabel htmlFor="price">Price (₹)</FieldLabel>
              <Input
                id="price"
                name="price"
                type="number"
                step="0.01"
                min="0.01"
                defaultValue={product?.price}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="unit">Unit</FieldLabel>
              <Select value={unit} onValueChange={(value) => value && setUnit(value)}>
                <SelectTrigger id="unit" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCT_UNITS.map((unitOption) => (
                    <SelectItem key={unitOption} value={unitOption}>
                      {unitOption}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {!isEditing && (
              <Field>
                <FieldLabel htmlFor="initialStock">Initial stock (optional)</FieldLabel>
                <InputGroup>
                  <InputGroupAddon align="inline-start">
                    <InputGroupButton
                      aria-label="Decrease initial stock"
                      disabled={initialStock <= 0}
                      onClick={() => setInitialStock((quantity) => Math.max(0, quantity - 1))}
                    >
                      <MinusIcon />
                    </InputGroupButton>
                  </InputGroupAddon>
                  <InputGroupInput
                    id="initialStock"
                    value={initialStock}
                    readOnly
                    className="text-center"
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      aria-label="Increase initial stock"
                      onClick={() => setInitialStock((quantity) => quantity + 1)}
                    >
                      <PlusIcon />
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
              </Field>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
};
