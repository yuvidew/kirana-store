"use client";

import { useState } from "react";
import type { SubmitEvent } from "react";
import { MinusIcon, PlusIcon } from "lucide-react";

import { DatePicker } from "@/components/date-picker";
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
 * given) exposes name/category/price/costPrice/unit/lowStockThreshold/
 * expiryDate — stock changes only ever happen via the dedicated "add stock"
 * action, to keep the StockMovement audit trail accurate.
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
  const [expiryDate, setExpiryDate] = useState<Date | undefined>(
    product?.expiryDate ? new Date(product.expiryDate) : undefined
  );
  const createProductMutation = useCreateProduct();
  const updateProductMutation = useUpdateProduct();
  const isPending = createProductMutation.isPending || updateProductMutation.isPending;

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") ?? "");
    const category = String(formData.get("category") ?? "");
    const price = Number(formData.get("price"));
    const costPrice = Number(formData.get("costPrice"));
    const rawLowStockThreshold = formData.get("lowStockThreshold");
    const lowStockThreshold = rawLowStockThreshold ? Number(rawLowStockThreshold) : undefined;

    if (isEditing) {
      updateProductMutation.mutate(
        {
          id: product.id,
          name,
          category,
          price,
          costPrice,
          unit,
          lowStockThreshold,
          expiryDate: expiryDate?.toISOString(),
        },
        { onSuccess: () => onOpenChange(false) }
      );
      return;
    }

    createProductMutation.mutate(
      {
        name,
        category,
        price,
        costPrice,
        unit,
        initialStock: initialStock > 0 ? initialStock : undefined,
        lowStockThreshold,
        expiryDate: expiryDate?.toISOString(),
      },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* max-h + overflow-y-auto: the base shadcn DialogContent has neither,
          so a form this long would overflow past the viewport top/bottom
          with no way to scroll to the footer buttons. sm:max-w-xl (instead
          of the default sm:max-w-md) gives the two-column field rows below
          room to breathe. */}
      <DialogContent className="flex max-h-[85vh] flex-col overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit product" : "Add product"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="name">Name</FieldLabel>
              <Input id="name" name="name" defaultValue={product?.name} required />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="category">Category</FieldLabel>
                <Input id="category" name="category" defaultValue={product?.category} required />
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
            </div>
            <div className="grid grid-cols-2 gap-4">
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
                <FieldLabel htmlFor="costPrice">Cost price (₹)</FieldLabel>
                <Input
                  id="costPrice"
                  name="costPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={product?.costPrice}
                  required
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="lowStockThreshold">Low-stock threshold (optional)</FieldLabel>
                <Input
                  id="lowStockThreshold"
                  name="lowStockThreshold"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={product?.lowStockThreshold ?? ""}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="expiryDate">Expiry date (optional)</FieldLabel>
                <DatePicker date={expiryDate} onDateChange={setExpiryDate} placeholder="No expiry date" />
              </Field>
            </div>
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
