import { isAxiosError } from "axios";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { toast } from "@/components/ui/toast";

import { allProducts, createProduct, updateProduct, deactivateProduct, addProductStock } from "../api";
import type { ProductsQuery } from "../types";

const getErrorMessage = (error: unknown, fallback: string) =>
  isAxiosError<{ error?: string }>(error) && error.response?.data?.error
    ? error.response.data.error
    : fallback;

/**
 * Query hook for the paginated, filtered product list.
 * @param query - `search`/`showInactive`/`page`/`pageSize` filters.
 * @param options - Optional `refetchInterval` for polling.
 */
export const useAllProducts = (query: ProductsQuery, options?: { refetchInterval?: number }) => {
  return useQuery({
    queryFn: () => allProducts(query),
    queryKey: ["all-products", query],
    placeholderData: keepPreviousData,
    refetchInterval: options?.refetchInterval,
  });
};

/** Mutation hook for creating a product. */
export const useCreateProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createProduct,
    mutationKey: ["create-product"],
    onSuccess: (product) => {
      queryClient.invalidateQueries({ queryKey: ["all-products"] });
      toast.add({ title: "Product added", description: `${product.name} was added.`, type: "success" });
    },
    onError: (error) => {
      toast.add({
        title: "Couldn't add product",
        description: getErrorMessage(error, "Something went wrong adding the product. Please try again."),
        type: "error",
      });
    },
  });
};

/** Mutation hook for updating a product's name/price/unit. */
export const useUpdateProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateProduct,
    mutationKey: ["update-product"],
    onSuccess: (product) => {
      queryClient.invalidateQueries({ queryKey: ["all-products"] });
      toast.add({ title: "Product updated", description: `${product.name} was updated.`, type: "success" });
    },
    onError: (error) => {
      toast.add({
        title: "Couldn't update product",
        description: getErrorMessage(error, "Something went wrong updating the product. Please try again."),
        type: "error",
      });
    },
  });
};

/** Mutation hook for deactivating (soft-deleting) a product. */
export const useDeactivateProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deactivateProduct,
    mutationKey: ["deactivate-product"],
    onSuccess: (_data, { productName }) => {
      queryClient.invalidateQueries({ queryKey: ["all-products"] });
      toast.add({
        title: "Product deactivated",
        description: productName ? `${productName} is no longer active.` : "The product is no longer active.",
        type: "success",
      });
    },
    onError: (error) => {
      toast.add({
        title: "Couldn't deactivate product",
        description: getErrorMessage(error, "Something went wrong deactivating the product. Please try again."),
        type: "error",
      });
    },
  });
};

/** Mutation hook for recording received stock against a product. */
export const useAddProductStock = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: addProductStock,
    mutationKey: ["add-product-stock"],
    onSuccess: (_data, { quantity, productName }) => {
      queryClient.invalidateQueries({ queryKey: ["all-products"] });
      toast.add({
        title: "Stock added",
        description: `Added ${quantity} to ${productName ?? "the product"}.`,
        type: "success",
      });
    },
    onError: (error) => {
      toast.add({
        title: "Couldn't add stock",
        description: getErrorMessage(error, "Something went wrong adding stock. Please try again."),
        type: "error",
      });
    },
  });
};
