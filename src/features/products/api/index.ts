import axios from "axios";

import type {
  ProductsQuery,
  ProductsResponse,
  CreateProductInput,
  CreateProductResponse,
  UpdateProductInput,
  UpdateProductResponse,
  DeactivateProductInput,
  DeactivateProductResponse,
  AddProductStockInput,
  AddProductStockResponse,
} from "../types";

export const allProducts = async (query: ProductsQuery) => {
  const { data } = await axios.get<ProductsResponse>("/api/products", {
    params: {
      search: query.search || undefined,
      unit: query.unit || undefined,
      status: query.status,
      page: query.page,
      pageSize: query.pageSize,
    },
  });
  return data;
};

export const createProduct = async (input: CreateProductInput) => {
  const { data } = await axios.post<CreateProductResponse>("/api/products", input);
  return data.product;
};

export const updateProduct = async ({ id, ...input }: UpdateProductInput) => {
  const { data } = await axios.patch<UpdateProductResponse>(`/api/products/${id}`, input);
  return data.product;
};

export const deactivateProduct = async ({ id }: DeactivateProductInput) => {
  const { data } = await axios.delete<DeactivateProductResponse>(`/api/products/${id}`);
  return data.product;
};

export const addProductStock = async ({ id, quantity }: AddProductStockInput) => {
  const { data } = await axios.post<AddProductStockResponse>(`/api/products/${id}/stock`, { quantity });
  return data.product;
};
