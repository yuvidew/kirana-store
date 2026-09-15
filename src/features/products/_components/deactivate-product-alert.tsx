"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { useDeactivateProduct } from "../hook/use-products";
import type { Product } from "../types";

/**
 * Confirmation dialog for deactivating (soft-deleting) a product.
 * @param open - Whether the dialog is open.
 * @param onOpenChange - Called to open/close the dialog.
 * @param product - The product to deactivate, or `null` when closed.
 */
export const DeactivateProductAlert = ({
  open,
  onOpenChange,
  product,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
}) => {
  const deactivateProductMutation = useDeactivateProduct();

  const handleConfirm = () => {
    if (!product) return;
    deactivateProductMutation.mutate(
      { id: product.id, productName: product.name },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Deactivate product?</AlertDialogTitle>
          {product && (
            <AlertDialogDescription>
              {product.name} will be hidden from the active product list. This can be reversed later
              from the database if needed.
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={deactivateProductMutation.isPending}>
            {deactivateProductMutation.isPending ? "Deactivating…" : "Deactivate"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
